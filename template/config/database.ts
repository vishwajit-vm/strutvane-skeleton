// Database settings (Laravel's config/database.php), read from .env.
//
// `node strut migrate`, `db:seed` and the other database commands read the same DB_* keys from
// .env directly, so this file and the CLI always agree. DB_CONNECTION is mysql, mariadb, pgsql
// (postgres is accepted too) or sqlite. DB_URL, when set, wins over the separate keys.
//
// Why the password and DB_URL are not in this file: the config tree is kept for every request,
// written to bootstrap/cache by `node strut config:cache` and easy to dump while debugging. The
// framework reads them from the environment only when it connects, so they never sit in it.
import { defineConfig } from '@strutvane/framework'

const CONNECTIONS = ['mysql', 'mariadb', 'pgsql', 'postgres', 'sqlite'] as const

export default defineConfig((env) => ({
  /** The engine: mysql, mariadb, pgsql (postgres) or sqlite. */
  default: env.oneOf('DB_CONNECTION', CONNECTIONS, '{{DB_CONNECTION}}'),
  /** Server host (ignored for sqlite). */
  host: env.string('DB_HOST', '127.0.0.1'),
  /** Server port; empty means the engine's default (3306 or 5432). */
  port: env.optional('DB_PORT'),
  /** Database name, or the SQLite file relative to the project root. */
  database: env.string('DB_DATABASE', 'database/database.sqlite'),
  /** Login name (the password is read from DB_PASSWORD at connect time). */
  username: env.string('DB_USERNAME', ''),
  /** A Unix socket instead of host and port (MySQL/MariaDB). */
  socket: env.optional('DB_SOCKET'),
  /** TLS for remote and cloud databases: disable, prefer, require, verify-ca or verify-full. */
  sslmode: env.optional('DB_SSLMODE'),
  /** A CA certificate file for verify-ca / verify-full. */
  ssl_ca: env.optional('DB_SSL_CA'),
  /** The database `npm test` uses, so tests never touch your local data. */
  test_database: env.optional('DB_TEST_DATABASE'),
  migrations: {
    /** Where applied migrations are recorded (Laravel's name). */
    table: 'migrations',
    /** How long `migrate` waits for another run's lock: 10s, 30000 (ms) or 2min; 0 = forever. */
    lock_timeout: env.string('DB_MIGRATION_LOCK_TIMEOUT', '10s'),
  },
}))
