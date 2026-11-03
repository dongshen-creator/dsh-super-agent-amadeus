/**
 * Fused-bundle mount test.
 *
 * Mounts all NINE plugin modules exactly as cordis.patch.yml declares them —
 * by their in-package relative paths — into one real Cordis context with stub
 * services, and asserts every one reaches ACTIVE with the expected
 * contributions. This is the executable form of the patch file: if a path
 * moves or a module breaks, this fails before dsh ever boots.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { Context } from '@deepseek-ai/cordis'

// The same specifiers cordis.patch.yml inserts, resolved through this package.
const ROWS = [
  { id: 'super-agent', module: () => import('../super-agent/lib/index.js') },
  { id: 'amadeus-persona', module: () => import('../amadeus/persona/index.js') },
  { id: 'amadeus-stt', module: () => import('../amadeus/stt/index.js') },
  { id: 'amadeus-tts', module: () => import('../amadeus/tts/index.js') },
  { id: 'amadeus-emotion', module: () => import('../amadeus/emotion/index.js') },
  { id: 'amadeus-memory', module: () => import('../amadeus/memory/index.js') },
  { id: 'amadeus-voice-clone', module: () => import('../amadeus/voice-clone/index.js') },
  { id: 'amadeus-proactive', module: () => import('../amadeus/proactive/index.js') },
  { id: 'amadeus-live2d', module: () => import('../amadeus/live2d/index.js') },
]

const AMADEUS_TOOLS = [
  'amadeus_transcribe',
  'amadeus_speak',
  'amadeus_emotion',
  'amadeus_recall',
  'amadeus_remember',
  'amadeus_clone_voice',
  'amadeus_proactive_plan',
  'amadeus_stage',
]

function makeContext() {
  const ctx = new Context()
  const tools = new Map()
  const sections = new Map()
  const providers = []
  const agentsCallbacks = []

  ctx.provide('tools', {
    register(definition) {
      if (tools.has(definition.name)) throw new Error(`duplicate tool: ${definition.name}`)
      tools.set(definition.name, definition)
      return () => tools.delete(definition.name)
    },
    get: (name) => tools.get(name),
    list: () => [...tools.values()],
  })
  ctx.provide('systemPrompt', {
    section(spec) {
      sections.set(spec.name, spec)
      return () => sections.delete(spec.name)
    },
  })
  ctx.provide('skills', {
    registerProvider(factory) {
      providers.push(factory)
      return () => providers.length = 0
    },
  })
  // Upstream super-agent does its per-agent work inside ctx.inject(['agents']).
  ctx.provide('agents', {})
  ctx.on('agent/created', () => {})
  return { ctx, tools, sections, providers, agentsCallbacks }
}

async function mountAll() {
  const harness = makeContext()
  const mounted = []
  for (const row of ROWS) {
    const mod = await row.module()
    assert.equal(typeof mod.apply, 'function', `${row.id} has no apply()`)
    assert.equal(typeof mod.name, 'string', `${row.id} has no name export`)
    const fiber = harness.ctx.plugin(mod, {})
    await fiber
    assert.ok(fiber.state === 2, `${row.id} did not reach ACTIVE (state=${fiber.state})`)
    mounted.push(row.id)
  }
  return { ...harness, mounted }
}

test('all nine plugins of the fused bundle mount in one context', async () => {
  const { mounted } = await mountAll()
  assert.deepEqual(mounted, ROWS.map((row) => row.id))
})

test('the eight amadeus tools are registered exactly once', async () => {
  const { tools } = await mountAll()
  for (const name of AMADEUS_TOOLS) {
    const definition = tools.get(name)
    assert.ok(definition, `missing tool ${name}`)
    assert.equal(definition.name, name)
    assert.equal(typeof definition.execute, 'function')
    assert.equal(definition.output?.schema?.additionalProperties, false, `${name}: additionalProperties must be false`)
  }
  assert.deepEqual([...tools.keys()].sort(), [...AMADEUS_TOOLS].sort())
})

test('nine prompt sections register (8 amadeus tool notes + persona voice-style hint)', async () => {
  const { sections } = await mountAll()
  // persona contributes amadeus:persona + amadeus:voice-style-hint (2),
  // the seven tool plugins contribute one each (stt, tts, emotion, memory,
  // voice-clone, proactive, live2d) => 9 total.
  const amadeus = [...sections.keys()].filter((name) => name.startsWith('amadeus:') || name.startsWith('tool:amadeus'))
  assert.equal(amadeus.length, 9, `got: ${amadeus.join(', ')}`)
  const orders = [...sections.values()].map((section) => section.order)
  assert.equal(new Set(orders).size, orders.length, 'duplicate prompt order across plugins')
})

test('the voice-chat skill provider is registered by persona', async () => {
  const { providers } = await mountAll()
  assert.equal(providers.length, 1)
  const provider = providers[0]({ signal: new AbortController().signal })
  const candidates = await provider.list()
  assert.ok(Array.isArray(candidates) && candidates.length >= 1)
  const full = await provider.get(candidates[0])
  assert.equal(typeof full.content, 'string')
  assert.ok(full.content.length > 200)
})

test('upstream super-agent exports its plugin identity', async () => {
  const mod = await ROWS[0].module()
  assert.equal(mod.name, 'super-agent')
  assert.equal(typeof mod.apply, 'function')
})
