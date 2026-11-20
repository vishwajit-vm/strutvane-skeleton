# feat/env-keys: every key in `.env.example`, extra database connections (decision #132)

Branch `feat/env-keys` from `v2/skeleton` (ea31741, which contains 7a8be7e). Not pushed by the
agent. Framework side: `v2/env-connections` (RFC-0007, hub `docs/rfcs/0007-database-connections.md`).

## Done
- `template/.env.example`: every key the framework reads, each set (none only commented out),
  grouped with a comment each: application; default database (`DB_*`, also
  `DB_MIGRATION_REPLAY_TIMEOUT`); extra connections `DB_MYSQL_*`, `DB_PGSQL_*`, `DB_SQLITE_*`
  (host/port filled, database empty = checked on first use); logging; cache; sessions; queue
  (`QUEUE_CONNECTION=database`, RFC-0006); mail (`log`); broadcast (`log`); files + S3 (`AWS_*`,
  for `@strutvane/files`); Redis (`REDIS_HOST=127.0.0.1`, `REDIS_PORT=6379`, `REDIS_DB=0`,
  comment: needs `@strutvane/redis`). Secrets (passwords, URLs holding them, keys) empty.
- `template/config/database.ts`: `connections: { mysql, pgsql, sqlite }`; `filesystems.ts`
  comment names the S3 keys; template README "Settings and secrets".
- Tests (`test/env.test.ts`, `test/render.test.ts`): every key set for all answer combinations,
  no key nothing reads (service keys listed by group), secret URLs empty, server-free defaults,
  a comment before every block, Redis comment, the declared connections match the listed keys.

## Next
- Re-vendor into create-strutvane (`npm run vendor:skeleton`) once this is merged (the installer
  branch `feat/env-keys` already expects these keys).
- Run the integration test against a framework tarball with RFC-0007
  (`STRUT_FRAMEWORK_TARBALL=<pack of v2/env-connections>`); on 0.2.0-next.1 the `connections`
  block is ignored, so the app still boots.

## How to verify
`npm ci`, `npm run ci`; for the real app: `STRUT_FRAMEWORK_TARBALL=... npx vitest run test/integration.test.ts`.

# v2/skeleton: where this branch stands

The first build of `strutvane-skeleton`: the app template (`template/`), the manifest
(`skeleton.json`), the reference renderer (`src/`), tests, and the plan for create-strutvane
(`INSTALLER.md`). Not pushed; not used by the installer yet.

## Done
- `template/`: a minimal Laravel-like app for the Recommended answers (layout in README.md),
  checked against framework `main` 0.2.0-next.0 source and booted by the integration test.
- `skeleton.json`: 11 answers, 11 placeholders, every template file with its mode and condition,
  package.json rules, and the files the installer still writes itself.
- `src/manifest.ts`, `src/render.ts`, `scripts/render.ts`: validation (all problems at once),
  answer resolution (unknown answers refused), `@strut:if` blocks, placeholders (only safe
  characters), package.json rules.
- Tests: manifest validity and file inventory, placeholders over all 648 answer combinations,
  `.env.example` coverage and "no secrets", app `.gitignore`, no Docker files, and the
  integration test (render → install framework tarball → key:generate → tsc → migrate →
  `.strutvane/` drift → db:seed → migrate:status → the app's own Vitest → boot → `/up`).

- Reviewed by the `strutvane-ecosystem-guardian` agent (2026-11-18); fixed: `UserPolicy` grants
  no `update`, `Object.hasOwn` for answer lookups, safe paths and structured conditions for
  installer-only files (`whenText` is informational), stable `ManifestError` codes, no
  `console.*` allowed by Biome, `public/storage` ignored, `LOG_LEVEL=info` in the example.
  Not fixed here: the 0.2 packages are not on npm yet, so the default app cannot be installed
  from the registry until the core train is published.

## Open (in order)
1. **Framework bugs found here (report to the framework; not fixable in this repo):**
   - `package.json` `strutvane.compat` is `^0.1.0-next.0` in 0.2.0-next.0, so its own CLI refuses
     the framework's commands (`migrate`, `db:seed`, `sync`, `start`, `dev`, `build`). Release
     blocker. The integration test works around it inside `.work` only and has a `KNOWN BUG` test
     that turns red once fixed: then delete `acceptCompatOnce()` and that test.
   - `.strutvane/resources.json` lists internal tables (sessions, password_reset_tokens, cache,
     cache_locks) as visible sidebar resources, against blueprint §5 "internal tables never get an
     auto API or UI", and gives tables with a string primary key `primaryKey: "id"`. (The skeleton
     now ships only `users`, so it does not trigger this.)
   - `resources.json` takes `fillable` from the migration, not from the model: `users` gets
     `email_verified_at` as fillable although `User` allows only name and email. If the generated
     CRUD API trusts the manifest, a user could verify their own email. The skeleton's
     `UserPolicy` therefore grants no `update`; the framework must use the model's list.
   - The v2 `Application` opens no database connection: models work in `node strut` commands
     (seeders), not yet in request handlers. No provider calls `useConnection` at boot.
   - `ConfigOf` and `RoutesOf` are not exported, so an app cannot write the typed-registry
     augmentation that `foundation/registry.ts` documents. The skeleton leaves it out.
   - The migration replay sandbox has a fixed 10 s timeout (`DEFAULT_SANDBOX_TIMEOUT_MS`) that
     the CLI cannot raise: on a heavily loaded machine `migrate:status` failed with "Replaying the
     migrations took longer than 10000 ms" (gate run 2 of 2026-11-18). Needs a flag or env key.
   - ADR-0022 logging is not wired: nothing reads `config/logging.ts` or `LOG_*` yet, and the
     logger's levels (trace…fatal) differ from ADR-0022's RFC 5424 levels.
2. **Auth overlap:** `@strutvane/auth` (v2/native-engine) ships SQL migrations that
   `CREATE TABLE IF NOT EXISTS users` / `sessions`, and reads `config/app.ts` and
   `config/database.ts` as plain objects, while the v2 framework uses `defineConfig` files.
   Blueprint §6 says auth tables are app migrations. Decide who owns `users` before
   `install:auth` runs against this skeleton.
3. **UI variant not integration-tested:** `@strutvane/ui` and the designs are not on npm and their
   peer range is `^0.1.0-next.1`, so for the full app only the rendering is tested (files,
   placeholders, package.json rules); `resources/ui` has never been type-checked or built with
   Vite. Add a second integration run once they publish. `@tanstack/*` as direct dependencies
   follows what `@strutvane/ui/react` imports today *(unverified at runtime)*. Whether `node strut dev` mounts Vite for v2 `bootstrap/app.ts` apps is unverified.
4. **Installer switch** (in create-strutvane, later): INSTALLER.md, including vendoring
   `template/` + `src/` at a pinned tag with `.gitignore`/`.npmrc` renamed.
5. **Move installer-appended `.env` keys** (Docker, mail, first admin, AI) into the template with
   `@strut:if` blocks, so `.env.example` has one source.

## Synced from strutvane-tooling (`app-template` profile)
This repo is the `skeleton` target of strutvane-tooling's new `app-template` profile (tooling
branch `feat/npx-and-app-template`, not merged yet). Synced, never edit here: `.editorconfig`,
`.gitattributes`, `.gitignore` (library rules + `/.work/`, `*.tgz`), `.npmrc`, `biome.base.json`,
`tsconfig.base.json` (app variant: no `isolatedDeclarations` / `declaration` /
`declarationMap`), `.claude/ECOSYSTEM.md` + guardian agent + contribute skill,
`.github/workflows/ci.yml` (verify on Linux/Windows/macOS × Node 24/26 with check-deps,
check-code-rules, `npm audit signatures`, `npm run ci`; tests 3×; `npm audit --omit=dev` +
TruffleHog), `.github/workflows/scorecard.yml`, `.github/dependabot.yml`,
`.github/scripts/check-deps.mjs`, `.github/scripts/check-code-rules.mjs`. No release workflow,
publint/attw or `RELEASE-READINESS.md`: nothing here is published.
`tsconfig.json` and `biome.json` now extend the synced bases (`noConsole` stays `error` here).
After the first sync: biome, tsc, vitest green (54 passed, 8 skipped: the integration suite,
skipped with `STRUT_FRAMEWORK_TARBALL` pointing nowhere), check-deps and check-code-rules clean,
`npm audit --omit=dev --audit-level=high` 0 *(agent-reported)*.
Open: Dependabot watches only `/`, not `template/package.json` (the app's dependencies are bumped
by hand with the framework train); the integration suite skips in CI until the framework is on npm.

## How to verify
```bash
npm ci
npm run ci                      # biome, tsc, vitest; 3x in a row
# integration test, locally (needs packages/framework with dist built: npx tsdown there)
npx vitest run test/integration.test.ts
# after changing a migration: refresh template/.strutvane
STRUT_UPDATE_GENERATED=1 npx vitest run test/integration.test.ts
```
