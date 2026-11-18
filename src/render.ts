/**
 * Render `template/` for a set of answers: the reference implementation of what create-strutvane
 * does with this skeleton (INSTALLER.md), and what this repo's tests check.
 *
 * Rendering is a pure function of the template files, the manifest and the answers: no clock, no
 * randomness, no secrets (those are written into `.env` by the installer afterwards), so the same
 * answers always give the same files.
 *
 * Template syntax (only in `template` mode files):
 * - `{{NAME}}`: a placeholder from the manifest. An unknown name is an error, never left in.
 * - A whole line `# @strut:if <answer> is|not <v1,v2>` (also with `//` or `<!-- … -->`) up to
 *   `@strut:endif`: the lines between are kept only when the condition holds. Blocks nest. The
 *   marker lines themselves are always removed.
 *
 * @module
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type Answers,
  type Condition,
  holds,
  type Manifest,
  ManifestError,
  type PackageRule,
  placeholderValues,
} from './manifest.ts'

/** One rendered file: POSIX path relative to the new app's root, and its text. */
export interface RenderedFile {
  readonly path: string
  readonly content: string
}

/** Any `{{…}}` occurrence, valid name or not (so a typo is reported, not copied). */
export const PLACEHOLDER: RegExp = /\{\{\s*([^{}]*?)\s*\}\}/g

const IF_LINE =
  /^\s*(?:#|\/\/|<!--)\s*@strut:if\s+([a-z][A-Za-z0-9]*)\s+(is|not)\s+([A-Za-z0-9_,.-]+)\s*(?:-->)?\s*$/
const ENDIF_LINE = /^\s*(?:#|\/\/|<!--)\s*@strut:endif\s*(?:-->)?\s*$/
const ANY_MARKER = /@strut:(?:if|endif)\b/

/**
 * Apply `@strut:if` blocks. Throws on an unbalanced block, a marker that is not a whole marker
 * line, or a condition on an unknown answer.
 *
 * @example
 * applyBlocks('a\n# @strut:if ui not none\nb\n# @strut:endif\n', answers, 'x') // 'a\nb\n'
 */
export function applyBlocks(text: string, answers: Answers, file: string): string {
  const out: string[] = []
  const stack: boolean[] = []
  const lines = text.split('\n')
  for (const [index, line] of lines.entries()) {
    const where = `${file}:${index + 1}`
    const opening = IF_LINE.exec(line)
    if (opening !== null) {
      const [, id = '', op, list = ''] = opening
      if (!Object.hasOwn(answers, id))
        throw new ManifestError('invalid_template', where, [
          `@strut:if names unknown answer "${id}"`,
        ])
      const values = list.split(',')
      const condition: Condition = { [id]: op === 'is' ? { is: values } : { not: values } }
      stack.push(holds(condition, answers))
      continue
    }
    if (ENDIF_LINE.test(line)) {
      if (stack.pop() === undefined)
        throw new ManifestError('invalid_template', where, ['@strut:endif without @strut:if'])
      continue
    }
    if (ANY_MARKER.test(line))
      throw new ManifestError('invalid_template', where, [
        'a @strut marker must be a whole comment line',
      ])
    if (stack.every(Boolean)) out.push(line)
  }
  if (stack.length > 0)
    throw new ManifestError('invalid_template', file, ['@strut:if without @strut:endif'])
  return out.join('\n')
}

/**
 * Replace every `{{NAME}}`. Unknown or malformed placeholders are errors.
 *
 * @example
 * fillPlaceholders('name={{APP_NAME}}', { APP_NAME: 'acme' }, 'x') // 'name=acme'
 */
export function fillPlaceholders(
  text: string,
  values: Readonly<Record<string, string>>,
  file: string,
): string {
  const problems: string[] = []
  const result = text.replace(PLACEHOLDER, (whole, name: string) => {
    const value = values[name]
    if (value === undefined) {
      problems.push(`${whole} is not a placeholder in skeleton.json`)
      return whole
    }
    return value
  })
  if (problems.length > 0) throw new ManifestError('invalid_template', file, problems)
  return result
}

/** package.json after the manifest's rules: answer-dependent entries replaced, keys sorted. */
function applyPackageRules(text: string, manifest: Manifest, answers: Answers): string {
  const pkg = JSON.parse(text) as Record<string, unknown>
  const apply = (key: string, rules: readonly PackageRule[], sort: boolean): void => {
    const current = pkg[key]
    const section: Record<string, string> =
      typeof current === 'object' && current !== null
        ? { ...(current as Record<string, string>) }
        : {}
    for (const rule of rules) delete section[rule.name]
    for (const rule of rules) if (holds(rule.when, answers)) section[rule.name] = rule.value
    const entries = Object.entries(section)
    if (sort) entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    pkg[key] = Object.fromEntries(entries)
  }
  apply('dependencies', manifest.packageJson.dependencies, true)
  apply('devDependencies', manifest.packageJson.devDependencies, true)
  // Scripts keep the template's order (dev, build, start first); rules only add or drop.
  const scripts = { ...((pkg['scripts'] ?? {}) as Record<string, string>) }
  for (const rule of manifest.packageJson.scripts)
    if (holds(rule.when, answers)) scripts[rule.name] ??= rule.value
    else delete scripts[rule.name]
  pkg['scripts'] = scripts
  return `${JSON.stringify(pkg, null, 2)}\n`
}

/**
 * Render every file whose `when` holds, sorted by path.
 *
 * @example
 * renderSkeleton({ root: '.', manifest, answers }).map((f) => f.path)
 */
export function renderSkeleton(options: {
  readonly root: string
  readonly manifest: Manifest
  readonly answers: Answers
  /** How to read a template file (default: from disk). Tests pass a caching reader. */
  readonly read?: (path: string) => string
}): RenderedFile[] {
  const { root, manifest, answers } = options
  const read = options.read ?? ((path: string): string => readFileSync(path, 'utf8'))
  const values = placeholderValues(manifest, answers)
  const files: RenderedFile[] = []
  for (const spec of manifest.files) {
    if (!holds(spec.when, answers)) continue
    const raw = read(join(root, manifest.templateDir, spec.path))
    let content = raw
    if (spec.mode === 'template') {
      content = fillPlaceholders(applyBlocks(raw, answers, spec.path), values, spec.path)
      if (spec.path === 'package.json') content = applyPackageRules(content, manifest, answers)
    }
    files.push({ path: spec.path, content })
  }
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
}
