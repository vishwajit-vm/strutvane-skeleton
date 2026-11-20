# How create-strutvane switches to the skeleton

Today `create-strutvane` (branch `v2/installer`, 52cebb1) writes every file of a new app from inline TypeScript templates (`src/templates/{project,app-files,env,compose,workflow-files}.ts` plus `templates/strut.js`). This repo replaces the app part of that with one tested source, like `laravel/installer` uses `laravel/laravel`. The installer keeps the questions, the secrets, Docker, the setup steps and the files that are pure answers.

This file says exactly what changes in create-strutvane. **The change itself is done later, in that repo.**

## 1. Getting the skeleton into the installer: vendor it at build time

create-strutvane's build copies, from a **pinned skeleton tag** (for example `v0.2.0-next.0`, the core train version):

```text
skeleton/skeleton.json
skeleton/template/**          (two renamed files, see below)
skeleton/src/manifest.ts      the manifest reader
skeleton/src/render.ts        the renderer
```

into its own package (`create-strutvane/skeleton/`), listed in its `files`. The installer imports `renderSkeleton` and `resolveAnswers` from there, so there is **one** renderer, tested here and used there.

Why vendoring, not the alternatives:

| Option | Why not |
|---|---|
| Download the skeleton at install time (GitHub tarball) | Needs the network for a step that should work offline, and skips the registry's integrity and provenance checks (the same reason the `.npmrc` sets `allow-git=none`). |
| Publish the skeleton to npm (`@strutvane/skeleton`) | Possible later. It adds a package and a name to release and approve with 2FA, and the installer would still pin one version. Needs the project lead's decision. |
| Keep the inline templates | Two copies of the app drift; the inline ones already disagree with the framework (section 5). |

**npm pack drops two files**, so the vendoring step renames them and the installer renames them back when it writes the app:

| In the skeleton | Stored in the installer package as | Why |
|---|---|---|
| `template/.gitignore` | `template/_gitignore` | npm never packs `.gitignore` (it turns it into `.npmignore` handling) |
| `template/.npmrc` | `template/_npmrc` | npm never packs `.npmrc` |

A vendoring check in create-strutvane's tests compares the vendored copy with the pinned tag (file list and hashes), so a hand edit in the installer fails CI.

## 2. Rendering, step by step

The reference is `src/render.ts`. For each run:

1. **Map the installer's options to skeleton answers** (`skeleton.json` → `answers`, each names its `installerOption`):

   | Answer | From `ProjectOptions` |
   |---|---|
   | `name` | `options.name` |
   | `ui` | `options.ui ?? 'none'` (`admin`, `blank`, `none` = API only) |
   | `design` | `options.design ?? 'crisp'` |
   | `auth` | `options.auth` |
   | `teams` | `String(options.teams)` |
   | `database` | `options.database` |
   | `docker` | `String(options.docker)` |
   | `testing` | `options.testing` |
   | `locale`, `timezone`, `currency` | the same fields |

2. `resolveAnswers(manifest, answers)` checks every value (unknown answers and values are refused, never defaulted).
3. `renderSkeleton({ root, manifest, answers })` returns the files whose `when` holds:
   - `copy`: verbatim;
   - `template`: `@strut:if` blocks applied, then `{{PLACEHOLDER}}` values (all derived from answers by `skeleton.json` → `placeholders`; unknown placeholders are errors). `package.json` then gets the `packageJson` rules: answer-dependent dependencies, devDependencies and scripts are replaced;
   - `answers`: the template holds the Recommended rendering; **the installer overwrites it** with the named generator (`configAuth` → `config/auth.ts`, `tenancyConfig` → `config/tenancy.ts`). These are the only two, because their content is a set of switches that would make template syntax unreadable.
4. Write the files; `strut.js` gets mode `0o755` on POSIX.
5. Write the **installer-only files** (`skeleton.json` → `installerFiles`): `.env`, `strutvane.json`, `docker/compose.yaml`, the opt-in `Dockerfile` / `.dockerignore` / `.devcontainer/`, CI and editor files, `AGENTS.md`, `deploy/README.md`, the answer-only configs and the first-admin seeder.
6. Run the existing setup steps unchanged: secrets, ports, services, `npm ci`, `migrate --seed`, git.

## 3. `.env` and `.env.example`

- `.env.example` now comes from the skeleton. It lists **every key the framework reads** (decision #132: app, database with the extra `DB_MYSQL_*`/`DB_PGSQL_*`/`DB_SQLITE_*` connections, logging, cache, session, queue, mail, files/S3, broadcast, and `REDIS_*` for `@strutvane/redis`), every key set (none only commented out), grouped under a comment each, with no secrets (tested here). Keys the skeleton lists are set in place by the installer, never appended twice.
- The installer still writes `.env`: start from the rendered `.env.example`, set the local values (`APP_ENV=local`, `APP_DEBUG=true`, the chosen ports and URL), then the secrets step fills `APP_KEY` (and the generated database passwords in Docker mode). A typed database password or `DB_URL` goes to `.env` only, as today.
- Keys the installer **appends** to both files, because they belong to installer features that the skeleton does not have yet: Docker mode (`COMPOSE_PROJECT_NAME`, `FORWARD_DB_PORT`, `FORWARD_MAILPIT_PORT`, `STRUT_UID`, `STRUT_GID`, `DB_ROOT_PASSWORD`, and for PostgreSQL `DB_MIGRATION_USERNAME` / `DB_MIGRATION_PASSWORD`, with the app role in `DB_USERNAME`), mail (`MAIL_*`), the first admin (`SEED_ADMIN_EMAIL`) and AI (`AI_PROVIDER`, the provider's key line). Moving them into the skeleton is a follow-up (NEXT.md).

## 4. What is removed from create-strutvane, and what stays

| create-strutvane today | After the switch |
|---|---|
| `templates/strut.js`, `strutJs()` | removed: `template/strut.js` (same file, provenance line changed) |
| `NPMRC`, `GITIGNORE`, `packageJson()`, `readme()` | removed: the skeleton's `.npmrc`, `.gitignore`, `package.json` (+ rules), `README.md` |
| `app-files.ts`: `BOOTSTRAP`, `webRoutes`, `API_ROUTES`, `HEALTH_CONTROLLER`, `configApp`, `CONFIG_DATABASE`, `USER_MODEL`, `USER_POLICY`, `USER_FACTORY`, `migrations()`, the database seeder in `seeders()`, `uiFiles()`, `designFiles()`, `themeCss()`, `HEALTH_TEST` | removed: the matching template files |
| `configAuth`, `tenancyConfig` | stay, as the generators of the two `answers` files |
| `answerConfigFiles` (`config/api.ts`, `mail.ts`, `security.ts`, `monitoring.ts`, `permissions.ts`, `ai.ts`) | stay for now (installer-only files). `config/cache.ts` and `config/filesystems.ts` are **dropped** from it: the skeleton's typed versions replace them, and the answers become `.env` values (`CACHE_STORE`, `FILESYSTEM_DISK`) |
| `CONFIG_CORS` (`config/cors.ts`) | dropped: CORS is off by default (blueprint §5.2) and the v2 framework configures it in `bootstrap/app.ts` middleware, not from this file (to re-check when CORS lands) |
| `ADMIN_SEEDER`, `SAMPLE_DATA_SEEDER` | stay installer-only until `node strut install:auth` writes the first-admin seeder; they must use `@strutvane/framework/database` and the real `SeedContext` (section 5) |
| `env.ts` | keeps `.env`; `.env.example` comes from the skeleton plus the appended keys (section 3) |
| `compose.ts`, `workflow-files.ts`, `AGENTS.md`, `strutvane.json`, local package copies | unchanged |

The installer's snapshot tests then compare its output with `renderSkeleton` for the same answers instead of with inline strings.

## 5. What the switch fixes (the inline templates disagree with framework 0.2.0-next.0)

Checked against `packages/framework` `main` (0.2.0-next.0) source on 2026-11-18; the skeleton's integration test boots the result.

1. **Imports.** The inline files import `Model`, `migration`, `defineSeeder` and `defineFactory` from `@strutvane/framework`. The package root does not export them: models, seeders and factories come from `@strutvane/framework/database`, migrations from `@strutvane/framework/schema` (the only import the migration sandbox allows).
2. **Config.** The inline `config/*.ts` files are plain objects read from `process.env`. The v2 `Application` takes `defineConfig((env) => …)` files through `.withConfig(config)` (`config/index.ts`), which validates every value at boot. The skeleton does that; `bootstrap/app.ts` also registers `bootstrap/providers.ts`.
3. **Routes.** The inline route files default-export `(router) => void` and an object controller. The skeleton uses `defineRoutes(...)` with invokable controller classes (`__invoke(ctx)`), as the framework's own fixtures do.
4. **`npm start`.** The inline `package.json` runs `node build/server.js`, which framework 0.2.0-next.0 never writes. The skeleton runs `node strut start`.
5. **Factories.** `sequence((n) => …)`: the framework's `FactoryContext.sequence` is a number (`user${sequence}@example.test`).
6. **Seeders.** The admin seeder reads `env['SEED_ADMIN_EMAIL']`, but `SeedContext.env` is the `APP_ENV` string, not the environment.
7. **Cache.** `config/cache.ts` `store: 'database'`: the framework's cache drivers are `file` and `memory` today.
