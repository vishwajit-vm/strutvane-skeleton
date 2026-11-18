import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { ROOT, TEMPLATE, walk } from './helpers.ts'

/**
 * Docker files Strutvane's own repos never commit (ADR-0006). Generated apps write the local
 * compose file git-ignored, and a production Dockerfile or .devcontainer/ only on opt-in
 * (ADR-0021): both are installer steps, never part of this template.
 */
const DOCKER_FILE =
  /(^|\/)(Dockerfile(\.[^/]*)?|[^/]*\.dockerfile|\.dockerignore|(docker-)?compose(\.[^/]*)?\.ya?ml|\.devcontainer(\/.*)?)$/i

describe('no Docker files', () => {
  it('the matcher catches the usual names', () => {
    for (const name of [
      'Dockerfile',
      'docker/Dockerfile.prod',
      'app.dockerfile',
      '.dockerignore',
      'compose.yaml',
      'docker/compose.yml',
      'docker-compose.yml',
      'docker-compose.override.yaml',
      '.devcontainer/devcontainer.json',
    ])
      expect(DOCKER_FILE.test(name), name).toBe(true)
    expect(DOCKER_FILE.test('src/docker-notes.ts')).toBe(false)
  })

  it('none in the template', () => {
    expect(walk(TEMPLATE).filter((path) => DOCKER_FILE.test(path))).toEqual([])
  })

  it('none committed or staged anywhere in this repo', () => {
    const tracked = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    )
      .split('\n')
      .filter((path) => path !== '')
    expect(tracked.length).toBeGreaterThan(0)
    expect(tracked.filter((path) => DOCKER_FILE.test(path))).toEqual([])
  })

  it('no .env file is committed or waiting to be (only .env.example)', () => {
    const tracked = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard'],
      {
        cwd: ROOT,
        encoding: 'utf8',
      },
    ).split('\n')
    expect(tracked.filter((path) => /(^|\/)\.env(?!\.example$)/.test(path))).toEqual([])
  })
})
