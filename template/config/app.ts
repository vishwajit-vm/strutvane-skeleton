// Application settings (Laravel's config/app.php). Per-machine values come from .env; the
// fallbacks here are what a fresh clone gets before `npm run setup` writes .env.
//
// Each value is typed from its reader: `env.boolean('APP_DEBUG')` makes `config('app.debug')` a
// boolean. A wrong value (APP_DEBUG=yes) stops the boot with a message that names the key.
import { APP_ENVIRONMENTS, defineConfig } from '@strutvane/framework'

export default defineConfig((env) => ({
  /** Shown in the UI, in mail and in log lines. */
  name: env.string('APP_NAME', '{{APP_NAME}}'),
  /** local, testing, staging or production. Unknown values stop the boot. */
  env: env.oneOf('APP_ENV', APP_ENVIRONMENTS, 'production'),
  /**
   * Detailed error pages. Only honoured with APP_ENV=local or testing: the framework refuses to
   * show stack traces in production even when this is true.
   */
  debug: env.boolean('APP_DEBUG', false),
  /** The public URL; https here makes the session cookie Secure with the __Host- prefix. */
  url: env.url('APP_URL', 'http://localhost:3000'),
  /** The port `node strut dev` and `node strut start` listen on (--port wins). */
  port: env.integer('APP_PORT', 3000),
  /**
   * The one root secret: cookies, sessions, signed URLs and encrypted columns all derive their
   * keys from it. Required: `node strut key:generate` writes it into .env (never into
   * .env.example). No fallback on purpose, so a missing key stops the boot instead of running
   * with a guessable one.
   */
  key: env.string('APP_KEY'),
  /**
   * Keys that were replaced by `node strut key:rotate`, comma-separated. Old cookies and
   * encrypted values keep working until they are re-encrypted with the new key.
   */
  previous_keys: env.string('APP_PREVIOUS_KEYS', ''),
  /** Language tag such as en or pt-BR. */
  locale: env.string('APP_LOCALE', '{{APP_LOCALE}}'),
  /** IANA time zone such as UTC or Europe/Berlin. Dates are stored in UTC either way. */
  timezone: env.string('APP_TIMEZONE', '{{APP_TIMEZONE}}'),
  /** ISO 4217 currency code for money columns and formatting. */
  currency: env.string('APP_CURRENCY', '{{APP_CURRENCY}}'),
}))
