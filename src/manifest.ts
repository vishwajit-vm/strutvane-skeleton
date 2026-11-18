/**
 * `skeleton.json`: the manifest that makes `template/` consumable by create-strutvane.
 *
 * The template folder is a working app for the default (Recommended) answers. The manifest says
 * what changes with other answers, as data only (nothing to execute, so an installer can read a
 * skeleton it has not audited line by line):
 *
 * - **files**: every template file, with its `mode` (`copy` verbatim, `template` with
 *   `{{PLACEHOLDER}}` values and `@strut:if` blocks, or `answers`: the installer writes it from
 *   the answers with the named generator, and the template holds the default rendering) and an
 *   optional `when` condition that leaves the file out;
 * - **answers**: the installer answers the skeleton depends on, their values and defaults;
 * - **placeholders**: each `{{NAME}}`, and how its value is derived from one answer;
 * - **packageJson**: dependencies, devDependencies and scripts that depend on answers;
 * - **installerFiles**: files the installer still writes itself (secrets, Docker, CI), so the
 *   full list of a new app's files is known in one place.
 *
 * Why a manifest instead of the installer's inline templates: the app layout lives in one repo
 * (like laravel/laravel), is type-checked and booted by this repo's tests, and the installer only
 * applies answers.
 *
 * @module
 */
import { readFileSync } from 'node:fs'

/** An answer's value as the manifest sees it: booleans are the strings `true` and `false`. */
export type AnswerValue = string

/** One answer the skeleton depends on. */
export interface AnswerSpec {
  readonly description: string
  /** `enum` answers take one of `values`; `boolean` answers are `true` or `false`; `string` is free text checked by `pattern`. */
  readonly type: 'enum' | 'boolean' | 'string'
  readonly values?: readonly string[]
  /** For `string` answers: the value must match this regular expression (whole value). */
  readonly pattern?: string
  readonly default: AnswerValue
  /** Where create-strutvane keeps it (`ProjectOptions` field), for INSTALLER.md readers. */
  readonly installerOption: string
}

/** `{ answer: { is: [...] } }` or `{ answer: { not: [...] } }`; several answers must all hold. */
export type Condition = Readonly<
  Record<string, { readonly is: readonly string[] } | { readonly not: readonly string[] }>
>

/** How a placeholder's value is derived from one answer. */
export interface PlaceholderSpec {
  readonly description: string
  readonly from: string
  /** Value per answer value; without a map the answer's value is used as it is. */
  readonly map?: Readonly<Record<string, string>>
  /** A transform applied to the answer's value (after `map`, when both are present). */
  readonly transform?: 'snake'
}

/** One file of `template/`. */
export interface FileSpec {
  readonly path: string
  readonly mode: 'copy' | 'template' | 'answers'
  readonly when?: Condition
  /** `answers` mode: the create-strutvane function that writes this file from the answers. */
  readonly generator?: string
  readonly note?: string
}

/** A dependency or script that depends on the answers. */
export interface PackageRule {
  readonly name: string
  /** Version range for dependencies; the command for scripts. */
  readonly value: string
  readonly when?: Condition
}

/** A file the installer writes itself (not in `template/`). */
export interface InstallerFile {
  readonly path: string
  /** A condition on skeleton answers, when the file depends only on them. */
  readonly when?: Condition
  /** Informational: the installer answer it depends on, when that is not a skeleton answer. */
  readonly whenText?: string
  readonly why: string
}

/** The whole manifest. */
export interface Manifest {
  readonly version: 1
  readonly framework: string
  readonly templateDir: string
  readonly answers: Readonly<Record<string, AnswerSpec>>
  readonly placeholders: Readonly<Record<string, PlaceholderSpec>>
  readonly files: readonly FileSpec[]
  readonly packageJson: {
    readonly dependencies: readonly PackageRule[]
    readonly devDependencies: readonly PackageRule[]
    readonly scripts: readonly PackageRule[]
  }
  readonly installerFiles: readonly InstallerFile[]
}

/** The answers after defaults are applied: every answer has a value. */
export type Answers = Readonly<Record<string, AnswerValue>>

/**
 * What went wrong, as a stable code callers can branch on (RFC-0003 style): the manifest itself,
 * the answers given to it, or a template file.
 */
export type ManifestErrorCode = 'invalid_manifest' | 'invalid_answers' | 'invalid_template'

/** Thrown when the manifest, the answers or a template is wrong; lists every problem at once. */
export class ManifestError extends Error {
  readonly code: ManifestErrorCode
  readonly problems: readonly string[]

  constructor(code: ManifestErrorCode, what: string, problems: readonly string[]) {
    super(`${what}:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
    this.name = 'ManifestError'
    this.code = code
    this.problems = Object.freeze([...problems])
  }
}

/** Placeholder names: `{{APP_NAME}}`. */
export const PLACEHOLDER_NAME: RegExp = /^[A-Z][A-Z0-9_]*$/

/**
 * Every placeholder value must match this: safe inside JSON strings, TypeScript strings, HTML,
 * CSS comments and .env values without any escaping (no quotes, spaces, `<`, `$` or newlines).
 */
export const SAFE_VALUE: RegExp = /^[A-Za-z0-9@/._:+-]*$/

/** Template paths: POSIX, relative, no `..`, no empty segments. */
const SAFE_PATH = /^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._@-]+(?:\/[A-Za-z0-9._@-]+)*$/

/**
 * Read and validate `skeleton.json`.
 *
 * @example
 * const manifest = loadManifest('skeleton.json')
 */
export function loadManifest(file: string): Manifest {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'))
  } catch (error) {
    throw new ManifestError('invalid_manifest', `${file} is not valid JSON`, [
      error instanceof Error ? error.message : String(error),
    ])
  }
  return validateManifest(parsed)
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/**
 * Check the shape and the cross-references (answers named by conditions and placeholders exist,
 * condition values are valid answer values, every path is safe and listed once). Returns the
 * manifest typed, or throws a {@link ManifestError} with every problem.
 *
 * @example
 * validateManifest(JSON.parse(text)).files.length
 */
export function validateManifest(value: unknown): Manifest {
  const problems: string[] = []
  if (!isRecord(value))
    throw new ManifestError('invalid_manifest', 'skeleton.json', ['must be a JSON object'])
  if (value['version'] !== 1) problems.push('version must be 1')
  if (typeof value['framework'] !== 'string') problems.push('framework must be a version range')
  if (typeof value['templateDir'] !== 'string' || !SAFE_PATH.test(value['templateDir']))
    problems.push('templateDir must be a relative folder name')

  const answers = isRecord(value['answers']) ? value['answers'] : {}
  if (!isRecord(value['answers'])) problems.push('answers must be an object')
  for (const [id, spec] of Object.entries(answers)) checkAnswer(id, spec, problems)

  const valuesOf = (id: string): readonly string[] | undefined => {
    const spec = answers[id]
    if (!isRecord(spec)) return undefined
    if (spec['type'] === 'boolean') return ['true', 'false']
    return isStringArray(spec['values']) ? spec['values'] : undefined
  }
  const checkCondition = (where: string, condition: unknown): void => {
    if (!isRecord(condition)) {
      problems.push(`${where}: when must be an object`)
      return
    }
    for (const [id, test] of Object.entries(condition)) {
      if (!Object.hasOwn(answers, id)) {
        problems.push(`${where}: when names the unknown answer "${id}"`)
        continue
      }
      const list = isRecord(test) ? (test['is'] ?? test['not']) : undefined
      const keys = isRecord(test) ? Object.keys(test) : []
      if (keys.length !== 1 || !isStringArray(list) || list.length === 0) {
        problems.push(`${where}: when.${id} must be { "is": [...] } or { "not": [...] }`)
        continue
      }
      const allowed = valuesOf(id)
      for (const item of list)
        if (allowed !== undefined && !allowed.includes(item))
          problems.push(`${where}: when.${id} uses "${item}", which ${id} can never be`)
    }
  }

  const placeholders = isRecord(value['placeholders']) ? value['placeholders'] : {}
  if (!isRecord(value['placeholders'])) problems.push('placeholders must be an object')
  for (const [name, spec] of Object.entries(placeholders)) {
    const where = `placeholders.${name}`
    if (!PLACEHOLDER_NAME.test(name)) problems.push(`${where}: names are UPPER_SNAKE_CASE`)
    if (!isRecord(spec)) {
      problems.push(`${where} must be an object`)
      continue
    }
    if (typeof spec['description'] !== 'string') problems.push(`${where}: description missing`)
    const from = spec['from']
    if (typeof from !== 'string' || !Object.hasOwn(answers, from))
      problems.push(`${where}: from must name an answer`)
    if (spec['transform'] !== undefined && spec['transform'] !== 'snake')
      problems.push(`${where}: transform must be "snake"`)
    if (spec['map'] !== undefined) {
      if (!isRecord(spec['map'])) problems.push(`${where}: map must be an object`)
      else {
        const allowed = typeof from === 'string' ? valuesOf(from) : undefined
        for (const [key, mapped] of Object.entries(spec['map'])) {
          if (typeof mapped !== 'string' || !SAFE_VALUE.test(mapped))
            problems.push(`${where}: map.${key} must be a safe string`)
          if (allowed !== undefined && !allowed.includes(key))
            problems.push(`${where}: map has "${key}", which ${String(from)} can never be`)
        }
        if (allowed !== undefined)
          for (const option of allowed)
            if (!Object.hasOwn(spec['map'], option))
              problems.push(`${where}: map has no value for ${String(from)}="${option}"`)
      }
    }
  }

  const seen = new Set<string>()
  const files = Array.isArray(value['files']) ? value['files'] : []
  if (!Array.isArray(value['files'])) problems.push('files must be an array')
  for (const [index, file] of files.entries()) {
    const where = `files[${index}]`
    if (!isRecord(file)) {
      problems.push(`${where} must be an object`)
      continue
    }
    const path = file['path']
    if (typeof path !== 'string' || !SAFE_PATH.test(path)) {
      problems.push(`${where}: path must be a safe relative POSIX path`)
      continue
    }
    if (seen.has(path)) problems.push(`${where}: ${path} is listed twice`)
    seen.add(path)
    if (!['copy', 'template', 'answers'].includes(String(file['mode'])))
      problems.push(`${path}: mode must be copy, template or answers`)
    if (file['mode'] === 'answers' && typeof file['generator'] !== 'string')
      problems.push(`${path}: answers mode needs the generator that writes it`)
    if (file['when'] !== undefined) checkCondition(path, file['when'])
  }

  const packageJson = isRecord(value['packageJson']) ? value['packageJson'] : {}
  if (!isRecord(value['packageJson'])) problems.push('packageJson must be an object')
  for (const section of ['dependencies', 'devDependencies', 'scripts'] as const) {
    const rules = packageJson[section]
    if (!Array.isArray(rules)) {
      problems.push(`packageJson.${section} must be an array`)
      continue
    }
    const names = new Set<string>()
    for (const [index, rule] of rules.entries()) {
      const where = `packageJson.${section}[${index}]`
      if (
        !isRecord(rule) ||
        typeof rule['name'] !== 'string' ||
        typeof rule['value'] !== 'string'
      ) {
        problems.push(`${where} needs a name and a value`)
        continue
      }
      if (names.has(rule['name'])) problems.push(`${where}: ${rule['name']} is listed twice`)
      names.add(rule['name'])
      if (rule['when'] !== undefined) checkCondition(where, rule['when'])
    }
  }

  const installerFiles = value['installerFiles']
  if (!Array.isArray(installerFiles)) problems.push('installerFiles must be an array')
  else
    for (const [index, entry] of installerFiles.entries()) {
      const where = `installerFiles[${index}]`
      if (!isRecord(entry) || typeof entry['path'] !== 'string' || typeof entry['why'] !== 'string')
        problems.push(`${where} needs a path and a why`)
      else if (!SAFE_PATH.test(entry['path']))
        problems.push(`${where}: path must be a safe relative POSIX path`)
      else if (seen.has(entry['path']))
        problems.push(`${where}: ${entry['path']} is also a template file`)
      else {
        if (entry['when'] !== undefined) checkCondition(where, entry['when'])
        if (entry['whenText'] !== undefined && typeof entry['whenText'] !== 'string')
          problems.push(`${where}: whenText must be text`)
      }
    }

  if (problems.length > 0)
    throw new ManifestError('invalid_manifest', 'skeleton.json has problems', problems)
  return value as unknown as Manifest
}

function checkAnswer(id: string, spec: unknown, problems: string[]): void {
  const where = `answers.${id}`
  if (!/^[a-z][A-Za-z0-9]*$/.test(id)) problems.push(`${where}: ids are camelCase`)
  if (!isRecord(spec)) {
    problems.push(`${where} must be an object`)
    return
  }
  if (typeof spec['description'] !== 'string') problems.push(`${where}: description missing`)
  if (typeof spec['installerOption'] !== 'string')
    problems.push(`${where}: installerOption missing`)
  const type = spec['type']
  const fallback = spec['default']
  if (typeof fallback !== 'string') problems.push(`${where}: default must be a string`)
  if (type === 'enum') {
    if (!isStringArray(spec['values']) || spec['values'].length < 2)
      problems.push(`${where}: an enum needs at least two values`)
    else if (typeof fallback === 'string' && !spec['values'].includes(fallback))
      problems.push(`${where}: default "${fallback}" is not one of its values`)
  } else if (type === 'boolean') {
    if (fallback !== 'true' && fallback !== 'false')
      problems.push(`${where}: a boolean default is "true" or "false"`)
  } else if (type === 'string') {
    if (typeof spec['pattern'] !== 'string') problems.push(`${where}: a string needs a pattern`)
    else if (typeof fallback === 'string' && !new RegExp(`^(?:${spec['pattern']})$`).test(fallback))
      problems.push(`${where}: default does not match its pattern`)
  } else problems.push(`${where}: type must be enum, boolean or string`)
}

/**
 * Fill in defaults and check every given answer. Unknown answers are refused (a typo must not
 * silently fall back to a default).
 *
 * @example
 * resolveAnswers(manifest, { name: 'acme', database: 'sqlite' }).ui // 'admin'
 */
export function resolveAnswers(
  manifest: Manifest,
  given: Readonly<Record<string, string | boolean>> = {},
): Answers {
  const problems: string[] = []
  const result: Record<string, string> = {}
  for (const id of Object.keys(given))
    if (!Object.hasOwn(manifest.answers, id))
      problems.push(`"${id}" is not an answer the skeleton knows`)
  for (const [id, spec] of Object.entries(manifest.answers)) {
    const raw = given[id]
    const value = raw === undefined ? spec.default : String(raw)
    if (spec.type === 'enum' && !(spec.values ?? []).includes(value))
      problems.push(`${id} must be one of ${(spec.values ?? []).join(', ')} (got "${value}")`)
    if (spec.type === 'boolean' && value !== 'true' && value !== 'false')
      problems.push(`${id} must be true or false (got "${value}")`)
    if (spec.type === 'string' && !new RegExp(`^(?:${spec.pattern ?? ''})$`).test(value))
      problems.push(`${id} has an invalid value "${value}"`)
    result[id] = value
  }
  if (problems.length > 0)
    throw new ManifestError('invalid_answers', 'The answers have problems', problems)
  return Object.freeze(result)
}

/**
 * Does a condition hold for these answers? No condition always holds.
 *
 * @example
 * holds({ ui: { not: ['none'] } }, answers)
 */
export function holds(condition: Condition | undefined, answers: Answers): boolean {
  if (condition === undefined) return true
  return Object.entries(condition).every(([id, test]) => {
    const value = answers[id]
    if (value === undefined) return false
    return 'is' in test ? test.is.includes(value) : !test.not.includes(value)
  })
}

/**
 * The value of every placeholder for these answers.
 *
 * @example
 * placeholderValues(manifest, answers)['DB_CONNECTION'] // 'pgsql'
 */
export function placeholderValues(manifest: Manifest, answers: Answers): Record<string, string> {
  const values: Record<string, string> = {}
  const problems: string[] = []
  for (const [name, spec] of Object.entries(manifest.placeholders)) {
    const answer = answers[spec.from] ?? ''
    let value = spec.map === undefined ? answer : (spec.map[answer] ?? '')
    if (spec.transform === 'snake') value = snake(value)
    if (!SAFE_VALUE.test(value))
      problems.push(`{{${name}}} would be "${value}", which is not safe to write into files`)
    values[name] = value
  }
  if (problems.length > 0)
    throw new ManifestError('invalid_answers', 'Placeholder values are unsafe', problems)
  return values
}

/**
 * A name as a SQL identifier and cookie name: lower case, `_` between words, at most 63
 * characters (PostgreSQL's limit), never starting with a digit.
 *
 * @example
 * snake('Acme-Portal.v2') // 'acme_portal_v2'
 */
export function snake(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const safe = /^[0-9]/.test(cleaned) ? `app_${cleaned}` : cleaned
  return (safe === '' ? 'app' : safe).slice(0, 63)
}
