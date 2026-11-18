# {{APP_NAME}}

A [Strutvane](https://github.com/vishwajit-vm/strutvane) app: TypeScript, MVC, in the spirit of Laravel.

## The commands you need

```text
npm run dev                  start the app on http://localhost:3000 (APP_PORT in .env)
node strut list              every project command (make:migration, migrate, db:seed, route:list, ...)
npm test                     run the tests (Vitest)
npm run setup                after git clone, or to finish a setup that stopped
```

`node strut <command>` is the project CLI (Laravel's `php artisan`). It works the same in PowerShell, cmd,
bash and zsh, with no `--` before flags.

## Adding a table

```text
node strut make:migration create_posts_table --seeder
  (edit database/migrations/..._create_posts_table.ts: add your columns)
node strut migrate
```

Columns live only in migrations. `migrate` applies them, then regenerates the types in `.strutvane/`
(committed, so a fresh clone type-checks), so `Post.query().where('title', ...)` is checked by the compiler.

## Where things are

| Path | What |
|---|---|
| `app/http/controllers/` | controllers (`post.controller.ts`) |
| `app/http/middleware/`, `app/http/requests/` | your middleware and form requests |
| `app/models/` | models (`post.ts`: `class Post extends Model('posts') {}`) |
| `app/policies/` | who may do what (`post.policy.ts`; deny by default) |
| `app/providers/` | service providers (`bootstrap/providers.ts` lists the ones that run) |
| `bootstrap/app.ts` | builds the app: config, providers, routes, middleware, error handling |
| `config/` | settings; values come from `.env` (`.env.example` lists every key, never a secret) |
| `database/migrations/`, `seeders/`, `factories/` | schema, sample data, fake data for tests |
| `routes/web.ts`, `routes/api.ts` | routes (the API is served under `/api`; `GET /up` is the health check) |
<!-- @strut:if ui not none -->
| `resources/ui/` | the React UI (`main.tsx`) and your theme overrides (`theme.css`) |
<!-- @strut:endif -->
| `storage/` | logs (`storage/logs`), uploaded files (`storage/app`), framework caches; never committed |
| `tests/` | `tests/feature` (boots the app) and `tests/unit` |
| `strut.js` | the `node strut` command |

## Settings and secrets

`.env` holds this computer's settings and secrets and is never committed. `APP_KEY` is the one root
secret: create it with `node strut key:generate`. Logging follows Laravel's channels: `LOG_CHANNEL`,
`LOG_STACK` and `LOG_LEVEL` in `.env`, files in `storage/logs`.
<!-- @strut:if ui not none -->

## Design

The UI uses the **{{DESIGN}}** design (`{{DESIGN_PACKAGE}}`, set in `config/ui.ts`). Your brand colour,
font and corner radius go in `resources/ui/theme.css`, which upgrades never touch. Switch design with
`node strut design:use <name>`.
<!-- @strut:endif -->

## Deploying

`npm run build`, then `npm start` (or `node strut start`) on the server, with `APP_ENV=production`,
`APP_DEBUG=false` and an https `APP_URL`. Health checks call `GET /up`. Run `node strut security:check`
before the first deploy.
