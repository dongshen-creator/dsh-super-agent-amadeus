/**
 * Composite client smoke test.
 *
 * Loads the built lib/client.js (a CJS bundle wrapped in
 * window.__ModuleLoader__.load) ONCE, then invokes the captured factory with
 * a require shim per test — the factory is a pure function, so both the
 * module identity and the registration behaviour can be asserted without
 * fighting the CJS require cache.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire } from 'node:module'

const nodeRequire = createRequire(import.meta.url)

/** Execute lib/client.js under a ModuleLoader shim and capture its spec. */
const spec = (() => {
  let captured
  globalThis.window = {
    __ModuleLoader__: {
      load(loaded) {
        captured = loaded
      },
    },
  }
  try {
    nodeRequire('../lib/client.js')
  } finally {
    delete globalThis.window
  }
  assert.ok(captured, 'client.js never called __ModuleLoader__.load')
  return captured
})()

/** React is the only seed the fused client requires; resolve it in Node. */
function requireShim(id) {
  assert.ok(id === 'react' || id === 'react/jsx-runtime', `unexpected seed module ${id}`)
  return nodeRequire(id)
}

function makeStubCtx() {
  const injected = []
  const registered = []
  const dictionaries = []
  const ctx = {
    effect(fn) {
      fn()
    },
    locale: {
      register(ns) {
        dictionaries.push(ns)
        return () => {}
      },
      bind(ns) {
        return (key) => `${ns}.${key}`
      },
    },
    slots: {
      inject(name, factory) {
        injected.push(name)
        // Invoke so keyed registrations are observable. Upstream 'main' uses a
        // generator factory — drive it to completion; async factories are
        // left to settle unobserved.
        try {
          const handle = factory()
          if (handle && typeof handle.next === 'function') {
            let step = handle.next()
            while (!step.done) step = handle.next()
          } else if (handle && typeof handle.then === 'function') {
            handle.catch(() => {})
          }
        } catch {
          // A failing registration body is not this test's subject.
        }
      },
      register(spec, component) {
        registered.push(spec)
        return { dispose() {} }
      },
    },
  }
  return { ctx, injected, registered, dictionaries }
}

test('client bundle self-registers under the fused bundle id', () => {
  assert.equal(spec.id, 'dsh-super-agent-amadeus')
  assert.equal(typeof spec.factory, 'function')

  const mod = spec.factory(requireShim)
  assert.equal(typeof mod.apply, 'function')
  assert.ok(Array.isArray(mod.inject))
  // Upstream panel needs sessions/locale; the toolviews need slots.
  for (const service of ['sessions', 'slots', 'locale']) {
    assert.ok(mod.inject.includes(service), `composite inject must include ${service}`)
  }
})

test('apply registers the super-agent panel and the three amadeus toolviews', () => {
  const mod = spec.factory(requireShim)
  const { ctx, injected, registered, dictionaries } = makeStubCtx()

  mod.apply(ctx)

  // Upstream panel half.
  assert.ok(dictionaries.includes('super-agent'), 'upstream locale dictionary not registered')
  for (const slot of ['main', 'sidebar.panellist']) {
    assert.ok(injected.includes(slot), `panel slot ${slot} not injected`)
  }
  const panel = registered.find((entry) => entry.key === 'super-agent')
  assert.ok(panel, 'main panel not registered with key super-agent')

  // Amadeus toolview half — keyed by tool name.
  const keys = registered.map((entry) => entry.key)
  for (const key of ['amadeus_speak', 'amadeus_emotion', 'amadeus_stage']) {
    assert.ok(keys.includes(key), `toolview ${key} not registered`)
  }
  assert.ok(injected.filter((name) => name === 'tool.call.toolview').length >= 3)
})

test('client bundle contains no Node builtins or dynamic imports', () => {
  const source = nodeRequire('fs').readFileSync(
    nodeRequire.resolve('../lib/client.js'),
    'utf8',
  )
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(code, /[^.a-zA-Z]import\(/)
  for (const builtin of ["require('fs')", "require('path')", "require('os')", "require('crypto')"]) {
    assert.ok(!code.includes(builtin), `browser bundle must not require ${builtin}`)
  }
})
