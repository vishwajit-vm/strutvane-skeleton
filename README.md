# strutvane-skeleton

> **Status: 0.2 (v2) in progress, on branch `v2/skeleton`.** Not used by `npm create strutvane` yet: [INSTALLER.md](INSTALLER.md) describes the switch, and [NEXT.md](NEXT.md) what is left.

**The application template that `npm create strutvane` installs**, the role [laravel/laravel](https://github.com/laravel/laravel) plays for Laravel. It is an app, not an npm package.

| | |
|---|---|
| Package | none: an app template (`template/`) plus a manifest (`skeleton.json`) |
| Part of | [Strutvane](https://github.com/vishwajit-vm/strutvane), a TypeScript framework and package ecosystem for B2B apps, in the spirit of Laravel |
| Framework | `@strutvane/framework` `^0.2.0-next.0` |
| License | MIT |

## What is in here

```text
template/        the app: a working Strutvane app for the default (Recommended) installer answers
skeleton.json    which files change with which answers: conditions, placeholders, package.json rules
src/             the manifest reader and the reference renderer (what the installer does with it)
scripts/         render.ts: render the template into a new folder
test/            the manifest, placeholders, .env.example and "no Docker files" checks, and an
                 integration test that installs the real framework and boots a rendered app
INSTALLER.md     how create-strutvane switches from its inline templates to this skeleton
```

The app layout follows the v2 blueprint (hub `docs/18-v2-blueprint.md` §3.1) and Laravel:

```text
strut.js                     node strut <command> (our php artisan)
bootstrap/app.ts             Application.configure(...).withConfig().withProviders().withRouting().create()
bootstrap/providers.ts       the providers that run at boot
app/http/controllers/        welcome + health controllers (invokable)
app/http/middleware/, requests/
app/models/user.ts           class User extends Model('users', { fillable, hidden })
app/policies/user.policy.ts  deny by default
app/providers/app.provider.ts
config/                      app, database, logging (ADR-0022), filesystems, cache, session (defineConfig);
                             tenancy, auth, ui (plain data read by the CLI and packages); index.ts
database/migrations/         users (sessions and cache use files; sign-in tables come with install:auth)
database/seeders/, factories/  DatabaseSeeder (strut:seeders markers) -> UserSeeder -> UserFactory
routes/web.ts, routes/api.ts defineRoutes(...); the API is served under /api, GET /up is built in
resources/ui/                React entry with @strutvane/ui and the chosen design (Crisp by default)
storage/{app,framework,logs}/, bootstrap/cache/  kept empty with .gitignore files, like Laravel
.strutvane/                  generated from the migrations by node strut migrate; committed
tests/feature, tests/unit    Vitest
.env.example                 every key the framework reads, grouped (#132); no secrets
```

No Docker file is ever committed here (ADR-0006). The local compose file and the opt-in production `Dockerfile` / `.devcontainer/` (ADR-0021) stay installer steps.

## Try it

```bash
npm ci
node scripts/render.ts .work/demo name=demo database=sqlite ui=none auth=none
```

Answers are listed in `skeleton.json` (`answers`); anything left out takes its default. Rendering writes files only: no `.env`, no install, no git (those are installer steps).

## Quality gate

```bash
npm ci
npm run ci        # biome check, tsc --noEmit, vitest run
```

The integration test (`test/integration.test.ts`) needs a framework tarball. Until `@strutvane/framework` 0.2.0-next.0 is on npm it uses `npm pack` of a sibling `../framework` checkout (the hub's local layout, with `dist/` built), or `STRUT_FRAMEWORK_TARBALL=<path>`. Without either it is skipped, and its title says why.
