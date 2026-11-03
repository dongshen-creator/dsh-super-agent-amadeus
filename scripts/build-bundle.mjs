#!/usr/bin/env node
/**
 * Build the fused dsh-super-agent-amadeus bundle.
 *
 * Orchestration:
 *   1. build the 8 Amadeus plugins from plugins/ (npm install → link → tsdown)
 *   2. sync their Node bundles into amadeus/<name>/ (browser client.js excluded)
 *   3. regenerate src/client/super-agent-client.js from the vendored upstream
 *   4. install root dev tooling and junction the host @deepseek-ai/* packages
 *   5. typecheck the composite client
 *   6. bundle the composite client to lib/client.js
 *   7. enforce the browser-bundle hard constraints
 *
 * Usage:
 *   node scripts/build-bundle.mjs
 *   SKIP_INSTALL=1 node scripts/build-bundle.mjs   # reuse node_modules
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const PLUGINS = join(ROOT, 'plugins')
const AMADEUS_OUT = join(ROOT, 'amadeus')

/** Short bundle dir name per plugin id; also the patch row id suffix. */
const SUITE = [
  'amadeus-persona',
  'amadeus-stt',
  'amadeus-tts',
  'amadeus-emotion',
  'amadeus-memory',
  'amadeus-voice-clone',
  'amadeus-proactive',
  'amadeus-live2d',
]

function run(cmd, args, opts = {}) {
  console.log(`[build-bundle] ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT, ...opts })
}

/**
 * npm/npx/python are .cmd shims on Windows; execFileSync without a shell
 * cannot spawn them. Route those through the shell with a joined command.
 */
function runShell(command) {
  console.log(`[build-bundle] ${command}`)
  const result = spawnSync(command, {
    stdio: 'inherit',
    cwd: ROOT,
    shell: true,
  })
  if (result.status !== 0) throw new Error(`command failed (${result.status}): ${command}`)
}

// 1) Build the eight plugins (their own script handles install/link/tsdown).
run('node', ['scripts/build.mjs', ...SUITE])

// 2) Sync Node bundles into amadeus/<name>/.
for (const id of SUITE) {
  const out = join(AMADEUS_OUT, id.replace(/^amadeus-/, ''))
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  const lib = join(PLUGINS, id, 'lib')
  for (const entry of readdirSync(lib, { withFileTypes: true })) {
    // client.js is the browser half (served from the fused lib/client.js);
    // .d.ts is build-time only. Everything else is the Node bundle.
    if (entry.isFile() && entry.name.endsWith('.d.ts')) continue
    if (entry.isFile() && entry.name === 'client.js') continue
    cpSync(join(lib, entry.name), join(out, entry.name), { recursive: true })
  }
  if (!existsSync(join(out, 'index.js'))) throw new Error(`[build-bundle] ${id}: amadeus/${id.replace(/^amadeus-/, '')}/index.js missing after sync`)
}
console.log('[build-bundle] amadeus/ node bundles synced')

// 3) Regenerate the vendored client factory (verifies itself).
run('node', ['scripts/gen-super-agent-client.mjs'])

// 4) Root tooling: npm install + junction host packages (typecheck support).
const nm = join(ROOT, 'node_modules')
if (!existsSync(join(nm, 'tsdown', 'package.json')) || process.env.SKIP_INSTALL !== '1') {
  runShell('npm install --legacy-peer-deps')
}
runShell('python scripts/link_root.py')

// 5) Typecheck the composite client (also typechecks the imported plugin views).
runShell('npx tsc -p tsconfig.json --noEmit')

// 6) Bundle the composite client.
runShell('npx tsdown')

// 7) Hard constraints on lib/client.js. JSDoc type annotations like
// {import('cordis').Context} mention `import(` inside comments, so strip
// block comments before the dynamic-import check.
const client = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8')
const clientCode = client.replace(/\/\*[\s\S]*?\*\//g, '')
if (!client.includes('__ModuleLoader__')) throw new Error('client.js: missing ModuleLoader wrapper')
if (/[^.a-zA-Z]import\(/.test(clientCode)) throw new Error('client.js: dynamic import() is forbidden')
const requires = [...clientCode.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1])
const ALLOW = [/^react$/, /^react\/jsx-runtime$/, /^@deepseek-ai\/dsh-client-/]
for (const spec of requires) {
  if (!ALLOW.some((pattern) => pattern.test(spec))) throw new Error(`client.js: require("${spec}") is not allowlisted`)
}
const BUILTIN = ['fs', 'path', 'os', 'crypto', 'url', 'util', 'child_process', 'node:fs', 'node:path', 'node:os', 'node:crypto']
for (const spec of requires) {
  if (BUILTIN.includes(spec)) throw new Error(`client.js: Node builtin "${spec}" is forbidden in the browser bundle`)
}
console.log(`[build-bundle] lib/client.js ok (${client.length} bytes, ${requires.length} requires)`)
console.log('[build-bundle] done')
