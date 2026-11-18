/**
 * Render the skeleton into a new folder, for trying it by hand and for the integration test:
 *
 *   node scripts/render.ts <target-folder> [answer=value ...]
 *   node scripts/render.ts .work/demo name=demo database=sqlite ui=none
 *
 * The target must not exist yet (never overwrite someone's files). This writes files only:
 * no `.env`, no install, no git. The installer does those steps (INSTALLER.md).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { loadManifest, ManifestError, resolveAnswers } from '../src/manifest.ts'
import { renderSkeleton } from '../src/render.ts'

const root = resolve(import.meta.dirname, '..')
const [target, ...pairs] = process.argv.slice(2)

if (target === undefined) {
  process.stderr.write('Usage: node scripts/render.ts <target-folder> [answer=value ...]\n')
  process.exit(1)
}
const destination = resolve(target)
if (existsSync(destination)) {
  process.stderr.write(`${destination} already exists: pick a new folder.\n`)
  process.exit(1)
}

try {
  const given: Record<string, string> = {}
  for (const pair of pairs) {
    const at = pair.indexOf('=')
    if (at < 1)
      throw new ManifestError('invalid_answers', 'Arguments', [`"${pair}" is not answer=value`])
    given[pair.slice(0, at)] = pair.slice(at + 1)
  }
  const manifest = loadManifest(join(root, 'skeleton.json'))
  const answers = resolveAnswers(manifest, given)
  const files = renderSkeleton({ root, manifest, answers })
  for (const file of files) {
    const path = join(destination, ...file.path.split('/'))
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, file.content)
  }
  process.stdout.write(`Rendered ${files.length} files into ${destination}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
}
