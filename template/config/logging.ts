// Logging (ADR-0022: Laravel-style channels, set from .env). Log files go to storage/logs.
//
//   LOG_CHANNEL=stack   the channel `Log.info()` writes to
//   LOG_STACK=daily     the channels a stack writes to, comma-separated (e.g. daily,slack)
//   LOG_LEVEL=debug     the lowest level written
//
// Add your own channel below (a `payments` file, say) and write to it with
// `Log.channel('payments').warning(...)`. Secrets are always redacted, whatever the channel.
import { defineConfig } from '@strutvane/framework'

/** RFC 5424 levels, most severe first (ADR-0022). */
const LEVELS = [
  'emergency',
  'alert',
  'critical',
  'error',
  'warning',
  'notice',
  'info',
  'debug',
] as const

/** Split a comma list from .env into clean names. */
function list(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

export default defineConfig((env) => {
  const path = env.string('LOG_PATH', 'storage/logs')
  const level = env.oneOf('LOG_LEVEL', LEVELS, 'debug')
  return {
    /** The channel `Log.info()` and friends write to. */
    default: env.string('LOG_CHANNEL', 'stack'),
    /** Where deprecation warnings go (`null` drops them). */
    deprecations: env.string('LOG_DEPRECATIONS_CHANNEL', 'null'),
    /** line: readable, like Laravel; json: one JSON object per line (for log shippers). */
    format: env.oneOf('LOG_FORMAT', ['line', 'json'], 'line'),
    /** A file starts a new part after this size. */
    max_file_size: env.string('LOG_MAX_FILE_SIZE', '100mb'),
    path,
    level,
    channels: {
      stack: { driver: 'stack', channels: list(env.string('LOG_STACK', 'daily')) },
      single: { driver: 'single', path: `${path}/strutvane.log`, level },
      daily: {
        driver: 'daily',
        path: `${path}/strutvane.log`,
        level,
        days: env.integer('LOG_DAILY_DAYS', 14),
      },
      stderr: { driver: 'stderr', level },
      stdout: { driver: 'stdout', level },
      // The webhook URL is a secret: the channel reads LOG_SLACK_WEBHOOK_URL from the environment
      // when it sends, so the URL never sits in the config tree (cached, and easy to dump).
      slack: { driver: 'slack', level: 'critical' },
      null: { driver: 'null' },
    },
  }
})
