import { describe, expect, it } from 'vitest'
import { resolveAnswers } from '../src/manifest.ts'
import { type RenderedFile, renderSkeleton } from '../src/render.ts'
import { everyRendering, manifest, ROOT, templateText, walk } from './helpers.ts'

/**
 * Keys the framework reads straight from the environment (never through a config file), so
 * secrets stay out of the config tree: they must be documented in .env.example too.
 */
const READ_BY_FRAMEWORK = ['DB_PASSWORD', 'DB_URL', 'LOG_SLACK_WEBHOOK_URL'] as const

/** Keys whose value is a secret or holds one: always empty in .env.example. */
const SECRET = /^(APP_KEY|APP_PREVIOUS_KEYS|DB_URL)$|PASSWORD|SECRET|TOKEN|WEBHOOK|_DSN$|API_KEY/

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
    const answers = resolveAnswers(manifest, { database: 'postgres' })
    const { set } = parseExample(exampleOf(renderSkeleton({ root: ROOT, manifest, answers })))
    const known = new Set<string>([...configKeys, ...READ_BY_FRAMEWORK])
    for (const key of set.keys()) expect(known.has(key), `${key} is read by nothing`).toBe(true)
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
