import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  holds,
  type Manifest,
  ManifestError,
  placeholderValues,
  resolveAnswers,
  snake,
  validateManifest,
} from '../src/manifest.ts'
import { manifest, ROOT, TEMPLATE, walk } from './helpers.ts'

/** A fresh, mutable copy of skeleton.json for the "bad manifest" cases. */
function rawManifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(ROOT, 'skeleton.json'), 'utf8')) as Record<string, unknown>
}

/** The problems validateManifest reports for a changed copy of skeleton.json. */
function problemsOf(change: (raw: Record<string, unknown>) => void): readonly string[] {
  const raw = rawManifest()
  change(raw)
  try {
    validateManifest(raw)
  } catch (error) {
    if (error instanceof ManifestError) return error.problems
    throw error
  }
  return []
}

const filesOf = (raw: Record<string, unknown>): Record<string, unknown>[] =>
  raw['files'] as Record<string, unknown>[]

describe('skeleton.json', () => {
  it('is valid', () => {
    expect(manifest.version).toBe(1)
    expect(manifest.files.length).toBeGreaterThan(40)
  })

  it('lists every file in template/, and every listed file exists', () => {
    const listed = manifest.files.map((file) => file.path).sort()
    expect(walk(TEMPLATE)).toEqual(listed)
  })

  it('pins the framework range the template depends on', () => {
    const framework = manifest.packageJson.dependencies.find(
      (rule) => rule.name === '@strutvane/framework',
    )
    expect(framework?.value).toBe(manifest.framework)
    expect(framework?.when).toBeUndefined()
  })

  it('has only UTF-8 text files with LF line endings (no binary, no CRLF)', () => {
    for (const path of walk(TEMPLATE)) {
      const bytes = readFileSync(join(TEMPLATE, path))
      expect(bytes.includes(0), `${path} looks binary`).toBe(false)
      expect(bytes.includes(13), `${path} has CR line endings`).toBe(false)
      expect(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes), path).not.toThrow()
    }
  })

  it('names the generator of every answers-mode file', () => {
    for (const file of manifest.files.filter((entry) => entry.mode === 'answers'))
      expect(file.generator, file.path).toMatch(/^[a-z][A-Za-z]+$/)
  })

  it('keeps installer-only files out of the template', () => {
    for (const entry of manifest.installerFiles)
      expect(walk(TEMPLATE), entry.path).not.toContain(entry.path)
  })
})

describe('validateManifest refuses broken manifests', () => {
  it('a condition on an unknown answer', () => {
    expect(
      problemsOf((raw) => {
        filesOf(raw)[0] = { path: '.editorconfig', mode: 'copy', when: { colour: { is: ['x'] } } }
      }),
    ).toContain('.editorconfig: when names the unknown answer "colour"')
  })

  it('a condition value the answer can never take', () => {
    expect(
      problemsOf((raw) => {
        filesOf(raw)[0] = { path: '.editorconfig', mode: 'copy', when: { ui: { is: ['web'] } } }
      }),
    ).toContain('.editorconfig: when.ui uses "web", which ui can never be')
  })

  it('a malformed condition', () => {
    expect(
      problemsOf((raw) => {
        filesOf(raw)[0] = { path: '.editorconfig', mode: 'copy', when: { ui: { is: [] } } }
      }),
    ).toContain('.editorconfig: when.ui must be { "is": [...] } or { "not": [...] }')
  })

  it('a path that escapes the template or is listed twice', () => {
    const problems = problemsOf((raw) => {
      filesOf(raw).push({ path: '../outside.ts', mode: 'copy' })
      filesOf(raw).push({ path: 'strut.js', mode: 'copy' })
    })
    expect(problems.some((problem) => problem.includes('safe relative POSIX path'))).toBe(true)
    expect(problems.some((problem) => problem.endsWith('strut.js is listed twice'))).toBe(true)
  })

  it('an answers-mode file without a generator', () => {
    expect(
      problemsOf((raw) => {
        filesOf(raw)[0] = { path: '.editorconfig', mode: 'answers' }
      }),
    ).toContain('.editorconfig: answers mode needs the generator that writes it')
  })

  it('a placeholder map that misses a value of its answer', () => {
    expect(
      problemsOf((raw) => {
        const placeholders = raw['placeholders'] as Record<string, Record<string, unknown>>
        placeholders['DB_PORT'] = { description: 'x', from: 'database', map: { mysql: '3306' } }
      }),
    ).toContain('placeholders.DB_PORT: map has no value for database="postgres"')
  })

  it('an unsafe placeholder value in a map', () => {
    expect(
      problemsOf((raw) => {
        const placeholders = raw['placeholders'] as Record<string, Record<string, unknown>>
        placeholders['DB_HOST'] = {
          description: 'x',
          from: 'docker',
          map: { true: 'db', false: '$(rm -rf /)' },
        }
      }),
    ).toContain('placeholders.DB_HOST: map.false must be a safe string')
  })

  it('an enum default that is not one of its values', () => {
    expect(
      problemsOf((raw) => {
        const answers = raw['answers'] as Record<string, Record<string, unknown>>
        answers['ui'] = { ...answers['ui'], default: 'web' }
      }),
    ).toContain('answers.ui: default "web" is not one of its values')
  })

  it('a dependency listed twice', () => {
    expect(
      problemsOf((raw) => {
        const pkg = raw['packageJson'] as Record<string, Record<string, unknown>[]>
        pkg['dependencies']?.push({ name: 'react', value: '1.0.0' })
      }),
    ).toContain('packageJson.dependencies[13]: react is listed twice')
  })

  it('an installer-only file with an unsafe path, with the invalid_manifest code', () => {
    const raw = rawManifest()
    ;(raw['installerFiles'] as Record<string, unknown>[]).push({ path: '../../etc/x', why: 'x' })
    try {
      validateManifest(raw)
      expect.unreachable()
    } catch (error) {
      expect(error instanceof ManifestError && error.code).toBe('invalid_manifest')
      expect(error instanceof ManifestError && error.problems).toContain(
        'installerFiles[18]: path must be a safe relative POSIX path',
      )
    }
  })

  it('something that is not an object at all', () => {
    expect(() => validateManifest([])).toThrow(ManifestError)
  })
})

describe('answers', () => {
  it('fills in the Recommended defaults', () => {
    expect(resolveAnswers(manifest)).toMatchObject({
      name: 'my-app',
      ui: 'admin',
      design: 'crisp',
      auth: 'email',
      database: 'mysql',
      docker: 'false',
      teams: 'false',
    })
  })

  it('accepts booleans and strings', () => {
    expect(resolveAnswers(manifest, { docker: true })['docker']).toBe('true')
  })

  it('refuses unknown answers, wrong enum values and unsafe names, all at once', () => {
    let problems: readonly string[] = []
    try {
      resolveAnswers(manifest, { colour: 'red', database: 'oracle', name: 'My App; rm -rf' })
    } catch (error) {
      if (error instanceof ManifestError) problems = error.problems
    }
    expect(problems).toEqual([
      '"colour" is not an answer the skeleton knows',
      'name has an invalid value "My App; rm -rf"',
      'database must be one of mysql, postgres, sqlite (got "oracle")',
    ])
  })

  it('refuses inherited object names as answers (constructor, __proto__)', () => {
    expect(() => resolveAnswers(manifest, { constructor: 'x' })).toThrow(
      /"constructor" is not an answer/,
    )
    try {
      resolveAnswers(manifest, { toString: 'x' })
    } catch (error) {
      expect(error instanceof ManifestError && error.code).toBe('invalid_answers')
    }
  })

  it('refuses a boolean answer that is not true or false', () => {
    expect(() => resolveAnswers(manifest, { teams: 'yes' })).toThrow(/teams must be true or false/)
  })
})

describe('conditions and placeholder values', () => {
  const answers = resolveAnswers(manifest, { ui: 'none', database: 'postgres' })

  it('holds() reads is / not, and ANDs several answers', () => {
    expect(holds(undefined, answers)).toBe(true)
    expect(holds({ ui: { is: ['none'] } }, answers)).toBe(true)
    expect(holds({ ui: { not: ['none'] } }, answers)).toBe(false)
    expect(holds({ ui: { is: ['none'] }, database: { is: ['mysql'] } }, answers)).toBe(false)
    expect(holds({ unknown: { is: ['x'] } }, answers)).toBe(false)
  })

  it('derives every placeholder from the answers', () => {
    expect(placeholderValues(manifest, answers)).toMatchObject({
      APP_NAME: 'my-app',
      APP_SLUG: 'my_app',
      DB_CONNECTION: 'pgsql',
      DB_PORT: '5432',
      DB_USERNAME: 'postgres',
      DB_HOST: '127.0.0.1',
    })
    expect(placeholderValues(manifest, resolveAnswers(manifest, { docker: true }))['DB_HOST']).toBe(
      'db',
    )
  })

  it('refuses a derived value that is not safe to write into files', () => {
    const unsafe: Manifest = {
      ...manifest,
      placeholders: { ...manifest.placeholders, BAD: { description: 'x', from: 'timezone' } },
    }
    const answers = resolveAnswers(manifest)
    expect(() =>
      placeholderValues(unsafe, { ...answers, timezone: 'Europe/Berlin"; drop' }),
    ).toThrow(/not safe to write into files/)
  })

  it('snake() makes SQL identifiers and cookie names', () => {
    expect(snake('acme-portal')).toBe('acme_portal')
    expect(snake('Acme.Portal--v2')).toBe('acme_portal_v2')
    expect(snake('2fast')).toBe('app_2fast')
    expect(snake('---')).toBe('app')
    expect(snake('a'.repeat(100))).toHaveLength(63)
  })
})
