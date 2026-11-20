import { describe, expect, it } from 'vitest'
import { resolveAnswers } from '../src/manifest.ts'
import { type RenderedFile, renderSkeleton } from '../src/render.ts'
import { everyRendering, manifest, ROOT, templateText, walk } from './helpers.ts'

/** The keys of one extra database connection on a server (`DB_<NAME>_*`, decision #132). */
const SERVER_CONNECTION_KEYS = [
  'HOST',
  'PORT',
  'DATABASE',
  'TEST_DATABASE',
  'USERNAME',
  'PASSWORD',
  'URL',
  'SOCKET',
  'SSLMODE',
  'SSL_CA',
] as const

/** The extra connections config/database.ts declares, and the keys each one reads. */
const EXTRA_CONNECTIONS: Readonly<Record<string, readonly string[]>> = {
  mysql: SERVER_CONNECTION_KEYS,
  pgsql: SERVER_CONNECTION_KEYS,
  sqlite: ['DATABASE', 'TEST_DATABASE'],
}

/**
 * Keys the framework reads straight from the environment (never through a config file), so
 * secrets stay out of the config tree: they must be documented in .env.example too. An extra
 * connection's keys are read by the framework when that connection is first used.
 */
const READ_BY_FRAMEWORK: readonly string[] = [
  'DB_PASSWORD',
  'DB_URL',
  'DB_MIGRATION_REPLAY_TIMEOUT',
  'LOG_SLACK_WEBHOOK_URL',
  ...Object.entries(EXTRA_CONNECTIONS).flatMap(([name, keys]) =>
    keys.map((key) => `DB_${name.toUpperCase()}_${key}`),
  ),
]

/**
 * Keys of services the app gets from a later framework release or an add-on, listed now so the
 * app's .env is complete from the first day (decision #132). No skeleton config file reads them
 * yet; each group's comment in .env.example says what does.
 */
const LISTED_FOR_SERVICES: Readonly<Record<string, readonly string[]>> = {
  queue: ['QUEUE_CONNECTION'],
  mail: [
    'MAIL_MAILER',
    'MAIL_SCHEME',
    'MAIL_HOST',
    'MAIL_PORT',
    'MAIL_USERNAME',
    'MAIL_PASSWORD',
    'MAIL_FROM_ADDRESS',
    'MAIL_FROM_NAME',
  ],
  broadcast: ['BROADCAST_CONNECTION'],
  s3: [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_SESSION_TOKEN',
    'AWS_DEFAULT_REGION',
    'AWS_BUCKET',
    'AWS_URL',
    'AWS_ENDPOINT',
    'AWS_USE_PATH_STYLE_ENDPOINT',
  ],
  redis: [
    'REDIS_URL',
    'REDIS_HOST',
    'REDIS_PORT',
    'REDIS_USERNAME',
    'REDIS_PASSWORD',
    'REDIS_DB',
    'REDIS_TLS',
    'REDIS_TLS_CA',
    'REDIS_TLS_SERVERNAME',
    'REDIS_PREFIX',
    'REDIS_CONNECT_TIMEOUT',
    'REDIS_COMMAND_TIMEOUT',
  ],
}
const SERVICE_KEYS: readonly string[] = Object.values(LISTED_FOR_SERVICES).flat()

/**
 * Keys whose value is a secret or holds one: always empty in .env.example. Connection URLs carry
 * the password (postgres://user:pass@...), so every database URL and REDIS_URL count.
 */
const SECRET =
  /^(APP_KEY|APP_PREVIOUS_KEYS|REDIS_URL)$|^DB_([A-Z0-9]+_)?URL$|PASSWORD|SECRET|TOKEN|WEBHOOK|_DSN$|API_KEY|ACCESS_KEY/

/** A value that looks like key material: long and base64/hex-like. */
const KEY_MATERIAL = /^(base64:)?[A-Za-z0-9+/=_-]{24,}$/

/** Every env key a config file reads with the `env` helper or `process.env`. */
function keysReadByConfig(): Set<string> {
  const keys = new Set<string>()
  const configFiles = walk(`${ROOT}/template/config`).map((path) => `config/${path}`)
  for (const path of configFiles) {
    const text = templateText(path)
    for (const match of text.matchAll(
      /env\.(?:string|optional|integer|boolean|oneOf|url)\(\s*'([A-Z][A-Z0-9_]*)'/g,
    ))
      keys.add(match[1] ?? '')
    for (const match of text.matchAll(/process\.env\[\s*'([A-Z][A-Z0-9_]*)'\s*\]/g))
      keys.add(match[1] ?? '')
  }
  return keys
}

/** `KEY=value` lines; commented `# KEY=` lines are documented but not set. */
function parseExample(text: string): { set: Map<string, string>; documented: Set<string> } {
  const set = new Map<string, string>()
  const documented = new Set<string>()
  for (const line of text.split('\n')) {
    const active = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line)
    if (active !== null) {
      const [, key = '', value = ''] = active
      expect(set.has(key), `${key} appears twice in .env.example`).toBe(false)
      set.set(key, value)
      documented.add(key)
      continue
    }
    const commented = /^#\s*([A-Z][A-Z0-9_]*)=/.exec(line)
    if (commented !== null) documented.add(commented[1] ?? '')
  }
  return { set, documented }
}

const exampleOf = (files: readonly RenderedFile[]): string =>
  files.find((file) => file.path === '.env.example')?.content ?? ''

describe('.env.example', () => {
  const configKeys = keysReadByConfig()

  it('finds the keys the config files read (the scan itself works)', () => {
    expect(configKeys).toContain('APP_KEY')
    expect(configKeys).toContain('DB_CONNECTION')
    expect(configKeys).toContain('LOG_CHANNEL')
    expect(configKeys).toContain('SESSION_COOKIE')
    expect(configKeys.size).toBeGreaterThan(30)
  })

  it('documents every key the config files and the framework read, for every answer combination', () => {
    for (const { answers, files } of everyRendering()) {
      const { documented } = parseExample(exampleOf(files))
      for (const key of [...configKeys, ...READ_BY_FRAMEWORK])
        expect(documented.has(key), `${key} is missing (database=${answers['database']})`).toBe(
          true,
        )
    }
  })

  it('sets no key that nothing reads', () => {
    for (const database of ['postgres', 'sqlite']) {
      const answers = resolveAnswers(manifest, { database })
      const { set } = parseExample(exampleOf(renderSkeleton({ root: ROOT, manifest, answers })))
      const known = new Set<string>([...configKeys, ...READ_BY_FRAMEWORK, ...SERVICE_KEYS])
      for (const key of set.keys()) expect(known.has(key), `${key} is read by nothing`).toBe(true)
    }
  })

  it('sets every key (#132), none only commented out, for every answer combination', () => {
    for (const { answers, files } of everyRendering()) {
      const { set, documented } = parseExample(exampleOf(files))
      for (const key of [...configKeys, ...READ_BY_FRAMEWORK, ...SERVICE_KEYS])
        expect(set.has(key), `${key} is not set (database=${answers['database']})`).toBe(true)
      expect([...documented].filter((key) => !set.has(key))).toEqual([])
    }
  })

  it('fills in what works without a server, and leaves each extra database to be chosen', () => {
    const { set } = parseExample(
      exampleOf(renderSkeleton({ root: ROOT, manifest, answers: resolveAnswers(manifest) })),
    )
    expect(set.get('REDIS_HOST')).toBe('127.0.0.1')
    expect(set.get('REDIS_PORT')).toBe('6379')
    expect(set.get('REDIS_DB')).toBe('0')
    expect(set.get('DB_MYSQL_HOST')).toBe('127.0.0.1')
    expect(set.get('DB_MYSQL_PORT')).toBe('3306')
    expect(set.get('DB_PGSQL_PORT')).toBe('5432')
    expect(set.get('QUEUE_CONNECTION')).toBe('database')
    expect(set.get('MAIL_MAILER')).toBe('log')
    expect(set.get('CACHE_STORE')).toBe('file')
    // The framework checks a connection when it is first used: an empty database is the "not
    // configured yet" state, and the error then names DB_<NAME>_DATABASE.
    for (const name of Object.keys(EXTRA_CONNECTIONS))
      expect(set.get(`DB_${name.toUpperCase()}_DATABASE`)).toBe('')
  })

  it('groups the keys under a comment each, and says Redis needs @strutvane/redis', () => {
    for (const { answers, files } of everyRendering()) {
      const lines = exampleOf(files).split('\n')
      // A block of keys always starts right after a comment line, never after a blank line.
      lines.forEach((line, index) => {
        if (/^[A-Z]/.test(line) && (lines[index - 1] ?? '') === '')
          expect.fail(`${line} starts a block without a comment (database=${answers['database']})`)
      })
    }
    const text = exampleOf(
      renderSkeleton({ root: ROOT, manifest, answers: resolveAnswers(manifest) }),
    )
    const lines = text.split('\n')
    const redis = lines.findIndex((line) => line.startsWith('REDIS_'))
    expect(lines.slice(Math.max(0, redis - 3), redis).join('\n')).toContain('@strutvane/redis')
    for (const heading of [
      '# Application',
      '# Database',
      '# Extra database connections',
      '# Logging',
      '# Cache',
      '# Sessions',
      '# Queues',
      '# Mail',
      '# Broadcasting',
      '# Files',
      '# Redis',
    ])
      expect(text).toContain(heading)
  })

  it('declares in config/database.ts exactly the extra connections whose keys it lists', () => {
    const text = templateText('config/database.ts')
    for (const name of Object.keys(EXTRA_CONNECTIONS))
      expect(text).toContain(`${name}: { driver: '${name}' }`)
  })

  it('holds no secret: secret keys are empty and no value looks like key material', () => {
    for (const { files } of everyRendering()) {
      const { set } = parseExample(exampleOf(files))
      for (const [key, value] of set) {
        if (SECRET.test(key)) expect(value, `${key} must be empty`).toBe('')
        expect(KEY_MATERIAL.test(value), `${key}=${value} looks like a secret`).toBe(false)
      }
    }
  })

  it('ships production-safe defaults (debug off; the installer writes local values into .env)', () => {
    const { set } = parseExample(
      exampleOf(renderSkeleton({ root: ROOT, manifest, answers: resolveAnswers(manifest) })),
    )
    expect(set.get('APP_ENV')).toBe('production')
    expect(set.get('APP_DEBUG')).toBe('false')
  })
})

describe('.gitignore of the app', () => {
  const lines = templateText('.gitignore').split('\n')

  it('ignores every .env file except the example', () => {
    expect(lines).toContain('.env*')
    expect(lines).toContain('!.env.example')
    expect(lines.indexOf('!.env.example')).toBeGreaterThan(lines.indexOf('.env*'))
  })

  it('ignores the local Docker services, SQLite data and machine-local state', () => {
    expect(lines).toContain('docker/')
    expect(lines).toContain('database/*.sqlite*')
    expect(lines).toContain('.strutvane/local/')
    expect(lines).toContain('node_modules/')
  })

  it('keeps the runtime folders but never their contents', () => {
    for (const folder of ['storage/logs', 'storage/framework/cache', 'bootstrap/cache'])
      expect(templateText(`${folder}/.gitignore`).split('\n')).toEqual(['*', '!.gitignore', ''])
  })
})
