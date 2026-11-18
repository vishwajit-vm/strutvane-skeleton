#!/usr/bin/env node
// The Strutvane command line for this project. Run: node strut <command>   (node strut list)
//
// Why a plain file run by node: no npm shim, no PowerShell execution policy, and no "--" needed
// before flags (npm run would swallow them). It works the same in PowerShell, cmd, bash and zsh.
//
// What this file does itself, and what it hands on:
// - `setup` finishes or repeats the installer's setup (always on this computer);
// - Docker mode (strutvane.json says "docker": true, unless .strutvane/local/env.json overrides
//   it for this computer): like Laravel Sail, every other command runs inside the app container.
//   On this computer it forwards `node strut <cmd>` to `docker compose exec app node strut <cmd>`;
//   inside the container (STRUTVANE_IN_CONTAINER=1) it runs the command itself. `services:*` and
//   `db:shell` talk to the containers from this computer;
// - the Sail-style pass-throughs `node strut npm|npx|node <args>` and `node strut shell`;
// - everything else is a framework command: it runs the `strutvane` program of the installed
//   @strutvane/framework (migrate, make:*, dev, list, ...). Arguments are passed as they are, with
//   no shell in between, and the exit code comes back to you.
//
// From strutvane-skeleton (template/strut.js). You may change it; `npm run setup` never overwrites it.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readSync, statSync } from 'node:fs'
import { delimiter, dirname, extname, isAbsolute, join } from 'node:path'
import { parseEnv } from 'node:util'

const root = import.meta.dirname
const argv = process.argv.slice(2)
// `node strut` alone lists the commands; `help` is an alias of `list` (decision #13).
const command = argv[0] === undefined || argv[0] === 'help' ? 'list' : argv[0]
const args = argv[0] === 'help' ? ['list', ...argv.slice(1)] : argv.length === 0 ? ['list'] : argv

/** Read a JSON file of the project, or undefined when it is missing or damaged. */
function readJson(relative) {
  try {
    return JSON.parse(readFileSync(join(root, relative), 'utf8'))
  } catch {
    return undefined
  }
}

/** Print a friendly message and stop with an exit code. */
function stop(message, code = 1) {
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

/** Does stdin and stdout belong to a terminal (someone can answer a question)? */
const interactive = process.stdin.isTTY === true && process.stdout.isTTY === true

/**
 * Find a program on PATH. Only absolute PATH entries count (never the current folder), and on
 * Windows only .exe/.com files (a .cmd/.bat shim would hand our arguments to cmd.exe).
 */
function onPath(name) {
  const extensions = process.platform === 'win32' && extname(name) === '' ? ['.exe', '.com'] : ['']
  for (const folder of (process.env.PATH ?? '').split(delimiter)) {
    const clean = folder.replace(/^"|"$/g, '')
    if (clean === '' || !isAbsolute(clean)) continue
    for (const extension of extensions) {
      const candidate = join(clean, name + extension)
      try {
        if (statSync(candidate).isFile()) return candidate
      } catch {}
    }
  }
  return undefined
}

/**
 * The docker program. STRUT_CONTAINER_CLI may name another binary (Podman, say), or, for tests, a
 * .js file run with node.
 */
function dockerCommand() {
  const wanted = process.env.STRUT_CONTAINER_CLI || 'docker'
  if (/\.[cm]?js$/.test(wanted)) return [process.execPath, wanted]
  if (/[/\\]/.test(wanted)) return [wanted]
  const found = onPath(wanted)
  if (found !== undefined) return [found]
  return stop(
    'Docker was not found. Install Docker Desktop (https://docs.docker.com/get-docker/), or run without Docker.',
  )
}

/** Run docker compose for this project (always -p, so other projects are never touched). */
function compose(composeArgs, options = {}) {
  const env = existsSync(join(root, '.env'))
    ? parseEnv(readFileSync(join(root, '.env'), 'utf8'))
    : {}
  const [program, ...prefix] = dockerCommand()
  const project = env.COMPOSE_PROJECT_NAME
  if (!project) stop('COMPOSE_PROJECT_NAME is missing in .env. Run: npm run setup')
  const full = [
    ...prefix,
    'compose',
    '-p',
    project,
    '--env-file',
    join(root, '.env'),
    '-f',
    join(root, 'docker', 'compose.yaml'),
    ...composeArgs,
  ]
  const result = spawnSync(program, full, {
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.error) stop(`Docker could not start: ${result.error.message}. Is Docker running?`)
  return result
}

/** Fail with the fix when a service is not running. */
function requireRunning(service) {
  const running = compose(['ps', '--status', 'running', '--services'], { capture: true })
  if (running.status !== 0) {
    stop(
      `Docker is not answering (${String(running.stderr).trim()}). Start Docker Desktop, then: node strut services:up`,
    )
  }
  if (!String(running.stdout).split(/\r?\n/).includes(service)) {
    stop(`The ${service} container is not running. Start it with: node strut services:up`)
  }
}

/**
 * Run a program inside a running container. `inner` is handed to `docker compose exec` as
 * separate arguments: no shell on our side, so `a&b` or `$(x)` arrive as plain text.
 */
function execIn(service, inner) {
  requireRunning(service)
  // -T (no terminal) when our output is not a terminal, e.g. in CI or when piped.
  const tty = interactive ? [] : ['-T']
  return compose(['exec', ...tty, service, ...inner]).status ?? 1
}

/** Sail-style pass-throughs. */
const PASS_THROUGH = new Set(['npm', 'npx', 'node', 'shell'])

/**
 * Inside the container: a fixed script (no user input in it) that prefers bash and falls back to
 * sh, because slim images often have no bash.
 */
const CONTAINER_SHELL = [
  'sh',
  '-c',
  'if command -v bash >/dev/null 2>&1; then exec bash; else exec sh; fi',
]

/**
 * The database shell in Docker mode: fixed scripts that read the login from the database
 * container's own environment, so no password ever appears on a command line.
 */
const DB_SHELL = {
  mysql: ['sh', '-c', 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot "$MYSQL_DATABASE"'],
  pgsql: ['sh', '-c', 'exec psql -U "$POSTGRES_USER" "$POSTGRES_DB"'],
}

/** npm's or npx's JS entry next to this node (Windows: node_modules; Linux/macOS: ../lib/node_modules). */
function npmEntry(tool) {
  const file = tool === 'npx' ? 'npx-cli.js' : 'npm-cli.js'
  // Under `npm run`, npm says where it is.
  const fromNpm = process.env.npm_execpath
  if (tool === 'npm' && fromNpm && /npm-cli\.js$/.test(fromNpm) && existsSync(fromNpm)) {
    return fromNpm
  }
  const home = dirname(process.execPath)
  const candidates = [
    join(home, 'node_modules', 'npm', 'bin', file),
    join(home, '..', 'lib', 'node_modules', 'npm', 'bin', file),
  ]
  return candidates.find((candidate) => existsSync(candidate))
}

/** Run a program here and return its exit code. Never through a shell. */
function run(program, programArgs) {
  const result = spawnSync(program, programArgs, { cwd: root, stdio: 'inherit', windowsHide: true })
  if (result.error) stop(`${program} could not start: ${result.error.message}`)
  return result.status ?? 1
}

/** Run a pass-through here (host mode, or already inside the container). */
function runHere(tool, toolArgs) {
  if (tool === 'node') return run(process.execPath, toolArgs)
  if (tool === 'shell') {
    const shell =
      process.platform === 'win32'
        ? (process.env.ComSpec ?? 'cmd.exe')
        : (process.env.SHELL ?? 'sh')
    return run(shell, [])
  }
  const entry = npmEntry(tool)
  // Without the JS entry, only a POSIX system can start npm by name without a shell (Windows
  // would need npm.cmd, which means cmd.exe parsing our arguments).
  if (entry === undefined && process.platform === 'win32') {
    stop(`${tool} was not found next to node (${process.execPath}).`)
  }
  return entry === undefined ? run(tool, toolArgs) : run(process.execPath, [entry, ...toolArgs])
}

/**
 * `node strut setup`: finish or repeat setup by resuming the installer, on this computer.
 * - The installer that made this copy left its command in .strutvane/local/setup.json; it is used
 *   while it still exists.
 * - Otherwise (a fresh clone, or a cleaned npm cache) the installer version recorded in the
 *   committed strutvane.json runs through `npm exec`, which works from strutvane.json alone.
 */
function setup() {
  const state = readJson('.strutvane/local/setup.json')
  const saved = Array.isArray(state?.resumeWith) ? state.resumeWith : []
  if (saved.length >= 2 && saved.slice(0, 2).every((part) => existsSync(part))) {
    const [program, ...rest] = saved
    return run(program, [...rest, root])
  }
  const manifest = readJson('strutvane.json')
  const version = /^create-strutvane (\S+)$/.exec(String(manifest?.createdWith ?? ''))?.[1]
  if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    stop(
      'strutvane.json does not say which create-strutvane made this project, so setup cannot resume. Restore strutvane.json from git.',
    )
  }
  const npm = npmEntry('npm')
  if (npm === undefined) stop(`npm was not found next to node (${process.execPath}).`)
  return run(process.execPath, [
    npm,
    'exec',
    '--yes',
    `--package=create-strutvane@${version}`,
    '--',
    'create-strutvane',
    '--resume',
    root,
  ])
}

/** `services:down --volumes` deletes the database: confirm first (decision #6). */
function confirmVolumes() {
  if (argv.includes('--force')) return
  if (!interactive) {
    stop(
      'services:down --volumes deletes your local database and its data. Add --force to confirm.',
    )
  }
  process.stdout.write(
    'This deletes the local database and every row in it. Type the project name to confirm: ',
  )
  const name = readJson('strutvane.json')?.answers?.name ?? ''
  const buffer = Buffer.alloc(256)
  let typed = ''
  try {
    const length = readSync(0, buffer)
    typed = buffer.subarray(0, length).toString('utf8').trim()
  } catch {}
  if (typed === '' || typed !== name) stop('Not confirmed: nothing was deleted.')
}

/** Docker or not: the committed project choice, unless this computer overrides it. */
function dockerMode() {
  const local = readJson('.strutvane/local/env.json')?.mode
  if (local === 'docker' || local === 'host') return local === 'docker'
  return readJson('strutvane.json')?.answers?.docker === true
}

/** The connection name for db:shell (mysql, mariadb, pgsql/postgres). */
function connection() {
  const env = existsSync(join(root, '.env'))
    ? parseEnv(readFileSync(join(root, '.env'), 'utf8'))
    : {}
  const value = String(env.DB_CONNECTION ?? '')
  return value === 'postgres' ? 'pgsql' : value === 'mariadb' ? 'mysql' : value
}

/**
 * The `strutvane` program of the installed framework, read from its package.json `bin` (so this
 * file never guesses a path inside the package).
 */
function frameworkProgram() {
  const folder = join(root, 'node_modules', '@strutvane', 'framework')
  const manifest = (() => {
    try {
      return JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'))
    } catch {
      return undefined
    }
  })()
  if (manifest === undefined) stop('Dependencies are not installed yet. Run: npm run setup')
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.strutvane
  if (typeof bin !== 'string' || bin.includes('..') || isAbsolute(bin)) {
    stop('The installed @strutvane/framework has no "strutvane" program. Run: npm run setup')
  }
  return join(folder, bin)
}

const inContainer = process.env.STRUTVANE_IN_CONTAINER === '1'

if (command === 'setup') process.exit(setup())

if (dockerMode() && !inContainer) {
  if (command === 'services:up') {
    process.exit(compose(['up', '-d', '--wait', '--wait-timeout', '180']).status ?? 1)
  }
  if (command === 'services:down') {
    const volumes = argv.includes('--volumes')
    if (volumes) confirmVolumes()
    process.exit(compose(['down', ...(volumes ? ['-v'] : [])]).status ?? 1)
  }
  if (command === 'services:status') process.exit(compose(['ps']).status ?? 1)
  if (command === 'services:logs') {
    process.exit(
      compose(['logs', '--follow', ...argv.slice(1).filter((a) => /^[a-z][a-z0-9-]*$/.test(a))])
        .status ?? 1,
    )
  }
  if (command === 'db:shell') {
    const script = DB_SHELL[connection()]
    if (script === undefined)
      stop('This project uses SQLite: open database/database.sqlite with any SQLite tool.')
    process.exit(execIn('db', script))
  }
  if (command === 'shell') process.exit(execIn('app', CONTAINER_SHELL))
  if (PASS_THROUGH.has(command)) process.exit(execIn('app', argv))
  process.exit(execIn('app', ['node', 'strut', ...args]))
}

if (PASS_THROUGH.has(command)) process.exit(runHere(command, argv.slice(1)))

if (command.startsWith('services:')) {
  stop('This project runs without Docker, so there are no services to start or stop.')
}

process.exit(run(process.execPath, [frameworkProgram(), ...args]))
