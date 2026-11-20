import { describe, expect, it } from 'vitest'
import { type Answers, ManifestError, resolveAnswers } from '../src/manifest.ts'
import {
  applyBlocks,
  fillPlaceholders,
  PLACEHOLDER,
  type RenderedFile,
  renderSkeleton,
} from '../src/render.ts'
import { everyRendering, manifest, ROOT, templateText } from './helpers.ts'

const render = (given: Readonly<Record<string, string | boolean>> = {}): RenderedFile[] =>
  renderSkeleton({ root: ROOT, manifest, answers: resolveAnswers(manifest, given) })

const fileOf = (files: readonly RenderedFile[], path: string): string => {
  const file = files.find((candidate) => candidate.path === path)
  if (file === undefined) throw new Error(`${path} was not rendered`)
  return file.content
}

const placeholdersIn = (text: string): string[] =>
  [...text.matchAll(PLACEHOLDER)].map((match) => match[1] ?? '')

describe('placeholders', () => {
  it('every {{NAME}} in the template is declared in skeleton.json', () => {
    for (const file of manifest.files)
      for (const name of placeholdersIn(templateText(file.path)))
        expect(manifest.placeholders, `${file.path} uses {{${name}}}`).toHaveProperty(name)
  })

  it('every declared placeholder is used somewhere', () => {
    const used = new Set(manifest.files.flatMap((file) => placeholdersIn(templateText(file.path))))
    for (const name of Object.keys(manifest.placeholders))
      expect(used.has(name), `{{${name}}} is never used`).toBe(true)
  })

  it('placeholders and @strut blocks appear only in template-mode files', () => {
    for (const file of manifest.files.filter((entry) => entry.mode !== 'template')) {
      const text = templateText(file.path)
      expect(placeholdersIn(text), file.path).toEqual([])
      expect(text, file.path).not.toMatch(/@strut:(if|endif)/)
    }
  })

  it('all resolve, for every combination of answers (no {{ or @strut marker is left)', () => {
    expect(everyRendering().length).toBe(648)
    for (const { files } of everyRendering()) {
      for (const file of files) {
        expect(file.content, file.path).not.toMatch(/\{\{|\}\}/)
        expect(file.content, file.path).not.toMatch(/@strut:(if|endif)/)
      }
    }
  })
})

describe('package.json', () => {
  it('rendering the defaults reproduces template/package.json exactly', () => {
    expect(fileOf(render(), 'package.json')).toBe(
      templateText('package.json').replace('{{APP_NAME}}', 'my-app'),
    )
  })

  it('is valid JSON with only answer-matching dependencies, for every combination', () => {
    for (const { answers, files } of everyRendering()) {
      const pkg = JSON.parse(fileOf(files, 'package.json')) as {
        dependencies: Record<string, string>
        devDependencies: Record<string, string>
        scripts: Record<string, string>
      }
      const deps = Object.keys(pkg.dependencies)
      expect(deps).toContain('@strutvane/framework')
      expect(deps.includes('@strutvane/ui')).toBe(answers['ui'] !== 'none')
      expect(deps.includes('@strutvane/auth')).toBe(answers['auth'] !== 'none')
      expect(deps.includes('mysql2')).toBe(answers['database'] === 'mysql')
      expect(deps.includes('pg')).toBe(answers['database'] === 'postgres')
      const designs = deps.filter((dep) => dep.startsWith('@strutvane/design-'))
      expect(designs).toEqual(
        answers['ui'] === 'none' ? [] : [`@strutvane/design-${answers['design']}`],
      )
      expect('vitest' in pkg.devDependencies).toBe(answers['testing'] !== 'none')
      expect('test' in pkg.scripts).toBe(answers['testing'] !== 'none')
      // Absorbed packages would install a second kernel next to the framework.
      for (const absorbed of ['contracts', 'core', 'cli', 'devkit', 'logs'])
        expect(deps).not.toContain(`@strutvane/${absorbed}`)
    }
  })
})

describe('answer-dependent files', () => {
  it('an API-only app has no UI files and no UI packages', () => {
    const paths = render({ ui: 'none' }).map((file) => file.path)
    expect(paths.filter((path) => path.startsWith('resources/'))).toEqual([])
    expect(paths).not.toContain('vite.config.ts')
    expect(paths).not.toContain('config/ui.ts')
    expect(fileOf(render({ ui: 'none' }), 'README.md')).not.toContain('## Design')
  })

  it('a full app gets the chosen design everywhere', () => {
    const files = render({ design: 'vivid' })
    expect(fileOf(files, 'config/ui.ts')).toContain("design: 'vivid'")
    expect(fileOf(files, 'resources/ui/main.tsx')).toContain(
      "import * as designs from '@strutvane/design-vivid'",
    )
    expect(fileOf(files, 'resources/ui/main.tsx')).toContain("const design = designs['vivid']")
  })

  it('no sign-in means no auth config', () => {
    expect(render({ auth: 'none' }).map((file) => file.path)).not.toContain('config/auth.ts')
  })

  it('AUTH-2: with sign-in the auth provider is registered at boot; without it, not', () => {
    for (const auth of ['email', 'magic-link']) {
      const providers = fileOf(render({ auth }), 'bootstrap/providers.ts')
      expect(providers).toContain("import auth from '@strutvane/auth/provider'")
      expect(providers).toMatch(/\[\n {2}AppServiceProvider,\n {2}auth,\n\]/)
      expect(providers).not.toContain('@strut:')
    }
    const none = fileOf(render({ auth: 'none' }), 'bootstrap/providers.ts')
    expect(none).not.toContain('@strutvane/auth')
    expect(none).toMatch(/\[\n {2}AppServiceProvider,\n\]/)
  })

  it('UI-1/UI-2: the UI uses VITE_API_URL (default /api/v1), and asks for workspaces only with teams', () => {
    const off = fileOf(render({ teams: false }), 'resources/ui/main.tsx')
    expect(off).toContain("const apiUrl = import.meta.env['VITE_API_URL'] ?? '/api/v1'")
    expect(off).toContain('apiUrl={apiUrl}')
    expect(off).toContain('tenancy={false}')
    expect(off).not.toContain('@strut:')
    expect(fileOf(render({ teams: true }), 'resources/ui/main.tsx')).not.toContain('tenancy=')
  })

  it('the API is served under /api/v1, matching auth and the UI', () => {
    const files = render({})
    expect(fileOf(files, 'bootstrap/app.ts')).toContain("apiPrefix: '/api/v1'")
    expect(fileOf(files, 'tests/feature/health.test.ts')).toContain('/api/v1/health')
  })

  it('SKEL-3: every app gets LF line endings (.gitattributes)', () => {
    for (const { files } of everyRendering())
      expect(fileOf(files, '.gitattributes')).toContain('* text=auto eol=lf')
  })

  it('SQLite keeps the server keys commented; a server engine gets them set', () => {
    const sqlite = fileOf(render({ database: 'sqlite' }), '.env.example')
    expect(sqlite).toContain('DB_CONNECTION=sqlite\nDB_DATABASE=database/database.sqlite\n')
    expect(sqlite).toMatch(/^# DB_HOST=/m)
    expect(sqlite).not.toMatch(/^DB_HOST=/m)
    const postgres = fileOf(render({ database: 'postgres', name: 'acme-portal' }), '.env.example')
    expect(postgres).toContain('DB_CONNECTION=pgsql\n')
    expect(postgres).toContain('DB_PORT=5432\n')
    expect(postgres).toContain('DB_DATABASE=acme_portal\n')
    expect(postgres).toContain('DB_TEST_DATABASE=acme_portal_test\n')
  })

  it('Docker mode points the database host at the compose service', () => {
    expect(fileOf(render({ docker: true }), '.env.example')).toContain('DB_HOST=db\n')
  })

  it('no tests means no tests folder', () => {
    expect(render({ testing: 'none' }).some((file) => file.path.startsWith('tests/'))).toBe(false)
  })

  it('is deterministic', () => {
    expect(render({ name: 'acme' })).toEqual(render({ name: 'acme' }))
  })
})

describe('applyBlocks', () => {
  const answers: Answers = resolveAnswers(manifest, { ui: 'none', database: 'sqlite' })

  it('keeps or drops blocks, nested, and always removes the marker lines', () => {
    const text = [
      'a',
      '# @strut:if ui not none',
      'ui',
      '# @strut:endif',
      '// @strut:if database is sqlite,mysql',
      'db',
      '  <!-- @strut:if ui is none -->',
      'nested',
      '  <!-- @strut:endif -->',
      '// @strut:endif',
      'z',
    ].join('\n')
    expect(applyBlocks(text, answers, 'x')).toBe('a\ndb\nnested\nz')
  })

  it('refuses unbalanced blocks, unknown answers and markers inside other text', () => {
    expect(() => applyBlocks('# @strut:if ui is none\nx', answers, 'f')).toThrow(
      /without @strut:endif/,
    )
    expect(() => applyBlocks('x\n# @strut:endif', answers, 'f')).toThrow(/without @strut:if/)
    expect(() => applyBlocks('# @strut:if colour is red\n# @strut:endif', answers, 'f')).toThrow(
      /unknown answer "colour"/,
    )
    expect(() => applyBlocks('const a = 1 // @strut:if ui is none', answers, 'f')).toThrow(
      /whole comment line/,
    )
  })
})

describe('fillPlaceholders', () => {
  it('replaces known placeholders and refuses unknown or malformed ones', () => {
    expect(fillPlaceholders('n={{A}}, {{ A }}', { A: 'x' }, 'f')).toBe('n=x, x')
    expect(() => fillPlaceholders('{{B}}', { A: 'x' }, 'f')).toThrow(ManifestError)
    expect(() => fillPlaceholders('{{a-b}}', { A: 'x' }, 'f')).toThrow(/is not a placeholder/)
  })
})
