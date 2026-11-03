#!/usr/bin/env node
/**
 * Build every Amadeus plugin: install dev tooling, link host deps, bundle both
 * ends, then enforce the browser-bundle hard constraints.
 *
 * Usage:
 *   node scripts/build.mjs                # build all plugins
 *   node scripts/build.mjs amadeus-tts    # build one
 *   SKIP_INSTALL=1 node scripts/build.mjs # reuse existing node_modules
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PLUGINS = join(ROOT, 'plugins')

const ALLOWED_CLIENT_REQUIRES = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-',
]

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
}

/** Locate a Python interpreter; the link step is a Python script. */
function pythonCmd() {
  const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python']
  for (const cmd of candidates) {
    try {
      execFileSync(cmd, ['-c', 'print(1)'], { stdio: 'ignore', shell: process.platform === 'win32' })
      return cmd
    } catch {
      // try the next candidate
    }
  }
  throw new Error('no Python interpreter found; install Python 3 or link the host deps manually')
}

/** Verify the three browser-bundle hard constraints from the dsh docs. */
function checkClientBundle(pid, file) {
  const source = readFileSync(file, 'utf8')
  const problems = []

  if (!source.includes('__ModuleLoader__')) {
    problems.push('missing __ModuleLoader__ banner/footer')
  }
  if (/\bimport\s*\(/.test(source)) {
    problems.push('contains a dynamic import()')
  }
  for (const match of source.matchAll(/require\("([^"]+)"\)/g)) {
    const spec = match[1]
    if (/^node:|^(fs|path|os|url|crypto|http|https|net|stream|zlib|child_process)$/.test(spec)) {
      problems.push(`imports Node builtin ${spec}`)
      continue
    }
    if (!ALLOWED_CLIENT_REQUIRES.some((prefix) => spec === prefix || spec.startsWith(prefix))) {
      problems.push(`imports non-allowlisted module ${spec}`)
    }
  }
  if (problems.length > 0) {
    throw new Error(`[${pid}] client bundle rejected:\n  - ${problems.join('\n  - ')}`)
  }
}

function buildOne(pid) {
  const dir = join(PLUGINS, pid)
  console.log(`\n=== building ${pid} ===`)

  if (!process.env.SKIP_INSTALL && !existsSync(join(dir, 'node_modules', 'tsdown'))) {
    run('npm', ['install', '--legacy-peer-deps', '--no-audit', '--no-fund'], dir)
  }
  run(pythonCmd(), [join(ROOT, 'scripts', 'link_deps.py')], ROOT)
  run('npx', ['tsdown'], dir)

  const nodeOut = join(dir, 'lib', 'index.js')
  if (!existsSync(nodeOut)) throw new Error(`[${pid}] lib/index.js was not produced`)
  console.log(`[${pid}] lib/index.js ok (${statSync(nodeOut).size} bytes)`)

  const clientOut = join(dir, 'lib', 'client.js')
  if (existsSync(clientOut)) {
    checkClientBundle(pid, clientOut)
    console.log(`[${pid}] lib/client.js ok (${statSync(clientOut).size} bytes)`)
  }
}

const targets = process.argv.slice(2)
const ids = targets.length > 0
  ? targets
  : readdirSync(PLUGINS).filter((n) => existsSync(join(PLUGINS, n, 'package.json')))

for (const pid of ids) buildOne(pid)
console.log('\nall requested plugins built')
