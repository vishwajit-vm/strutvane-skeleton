/** Shared paths and small helpers for the skeleton's tests. */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { type Answers, loadManifest, type Manifest, resolveAnswers } from '../src/manifest.ts'
import { type RenderedFile, renderSkeleton } from '../src/render.ts'

/** The repo root. */
export const ROOT: string = resolve(import.meta.dirname, '..')

/** The app template folder. */
export const TEMPLATE: string = join(ROOT, 'template')

/** The manifest, loaded and validated once. */
export const manifest: Manifest = loadManifest(join(ROOT, 'skeleton.json'))

/** Every file under a folder, as POSIX paths relative to it (folders themselves left out). */
export function walk(folder: string): string[] {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)).split('\\').join('/'))
    .sort()
}

/** A template file's text. */
export function templateText(path: string): string {
  return readFileSync(join(TEMPLATE, path), 'utf8')
}

/**
 * Every combination of the enum and boolean answers (string answers keep their defaults): the
 * renderer must work for all of them, not only the ones a person tried.
 */
export function everyAnswerCombination(): Answers[] {
  let combos: Record<string, string>[] = [{}]
  for (const [id, spec] of Object.entries(manifest.answers)) {
    const options =
      spec.type === 'boolean' ? ['true', 'false'] : spec.type === 'enum' ? (spec.values ?? []) : []
    if (options.length === 0) continue
    combos = combos.flatMap((combo) => options.map((value) => ({ ...combo, [id]: value })))
  }
  return combos.map((combo) => resolveAnswers(manifest, combo))
}

/** Template files read once per test file: 648 renderings would otherwise read ~35,000 files. */
const readCache = new Map<string, string>()
function cachedRead(path: string): string {
  let text = readCache.get(path)
  if (text === undefined) {
    text = readFileSync(path, 'utf8')
    readCache.set(path, text)
  }
  return text
}

/** One rendering per answer combination, computed once per test file (rendering is pure). */
let renderings: { readonly answers: Answers; readonly files: RenderedFile[] }[] | undefined

/**
 * Every combination of answers with its rendered files.
 *
 * @example
 * for (const { answers, files } of everyRendering()) { ... }
 */
export function everyRendering(): { readonly answers: Answers; readonly files: RenderedFile[] }[] {
  renderings ??= everyAnswerCombination().map((answers) => ({
    answers,
    files: renderSkeleton({ root: ROOT, manifest, answers, read: cachedRead }),
  }))
  return renderings
}
