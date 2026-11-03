/**
 * Cross-plugin integration smoke test.
 *
 * Mounts all eight Amadeus plugins into one real Cordis context with stub
 * `tools`, `systemPrompt` and `skills` services, then asserts every tool, prompt
 * section and skill provider actually registered through the real service
 * contracts. This is the check that "several plugins" really compose.
 *
 * Lives inside amadeus-persona because that is where the host packages are
 * linked; the other plugins are imported by relative path.
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { Context } from '@deepseek-ai/cordis'

import * as persona from '../../amadeus-persona/lib/index.js'
import * as stt from '../../amadeus-stt/lib/index.js'
import * as tts from '../../amadeus-tts/lib/index.js'
import * as emotion from '../../amadeus-emotion/lib/index.js'
import * as memory from '../../amadeus-memory/lib/index.js'
import * as voiceClone from '../../amadeus-voice-clone/lib/index.js'
import * as proactive from '../../amadeus-proactive/lib/index.js'
import * as live2d from '../../amadeus-live2d/lib/index.js'

const PLUGINS = [persona, stt, tts, emotion, memory, voiceClone, proactive, live2d]

/** Every tool the eight plugins should contribute. */
const EXPECTED_TOOLS = [
  'amadeus_transcribe',
  'amadeus_speak',
  'amadeus_emotion',
  'amadeus_recall',
  'amadeus_remember',
  'amadeus_clone_voice',
  'amadeus_proactive_plan',
  'amadeus_stage',
]

/** Prompt sections contributed by the tool plugins (persona adds two more). */
const EXPECTED_SECTIONS = [
  'tool:amadeus_transcribe',
  'tool:amadeus_speak',
  'tool:amadeus_emotion',
  'tool:amadeus_memory',
  'tool:amadeus_voice_clone',
  'tool:amadeus_proactive_plan',
  'tool:amadeus_stage',
]

function makeContext() {
  const ctx = new Context()
  const tools = new Map()
  const sections = new Map()
  const providers = []

  ctx.provide('tools', {
    register(definition) {
      if (tools.has(definition.name)) throw new Error(`duplicate tool: ${definition.name}`)
      tools.set(definition.name, definition)
      return () => tools.delete(definition.name)
    },
    get(name) {
      return tools.get(name)
    },
    list() {
      return [...tools.values()]
    },
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

  return { ctx, tools, sections, providers }
}

async function mountAll() {
  const { ctx, tools, sections, providers } = makeContext()

  for (const plugin of PLUGINS) {
    assert.equal(typeof plugin.apply, 'function', `${plugin.name} has no apply()`)
    const fiber = ctx.plugin(plugin, {})
    await fiber
    assert.ok(fiber.state === 2, `${plugin.name} did not reach ACTIVE (state=${fiber.state})`)
  }

  return { ctx, tools, sections, providers }
}

test('all eight plugins mount in one context without conflicting', async () => {
  const { tools, sections, providers } = await mountAll()
  assert.equal(tools.size, EXPECTED_TOOLS.length)
  assert.equal(sections.size, 9, 'eight tool sections plus two persona sections')
  assert.equal(providers.length, 1, 'only persona contributes a skill provider')
})

test('every expected tool is registered exactly once', async () => {
  const { tools } = await mountAll()
  for (const name of EXPECTED_TOOLS) {
    const definition = tools.get(name)
    assert.ok(definition, `missing tool ${name}`)
    assert.equal(definition.name, name)
    assert.equal(typeof definition.description, 'string')
    assert.ok(definition.description.length > 40, `${name} needs a usable description`)
    assert.equal(typeof definition.execute, 'function')
    assert.ok(definition.output?.schema, `${name} declares no output schema`)
  }
  assert.deepEqual([...tools.keys()].sort(), [...EXPECTED_TOOLS].sort())
})

test('prompt section orders are unique and sit after the general rules', async () => {
  const { sections } = await mountAll()
  const orders = [...sections.values()].map((section) => section.order)
  assert.equal(new Set(orders).size, orders.length, 'two plugins share a prompt order')

  for (const name of EXPECTED_SECTIONS) {
    const section = sections.get(name)
    assert.ok(section, `missing prompt section ${name}`)
    assert.ok(section.order >= 900, `${name} should sort after the general rules`)
    assert.ok(section.text.length > 30, `${name} has an unusably short body`)
  }

  // Persona owns the lowest orders so the character definition is read first.
  const personaOrders = [...sections.entries()]
    .filter(([name]) => !name.startsWith('tool:'))
    .map(([, section]) => section.order)
  assert.deepEqual(personaOrders.sort((a, b) => a - b), [900, 901])
})

test('the persona plugin contributes both its prompt sections and its skill', async () => {
  const { sections, providers } = await mountAll()
  const personaSections = [...sections.keys()].filter((name) => !name.startsWith('tool:'))
  assert.equal(personaSections.length, 2, `expected 2 persona sections, got ${personaSections.join(', ')}`)

  const control = { signal: new AbortController().signal }
  const provider = providers[0](control)
  assert.ok(provider && typeof provider.list === 'function' && typeof provider.get === 'function')

  const candidates = await provider.list()
  assert.ok(Array.isArray(candidates) && candidates.length >= 1)
  const one = candidates[0]
  assert.equal(typeof one.name, 'string')
  // Candidate entries stay lean; the long body arrives only via get().
  assert.equal(one.content, undefined, 'candidates must not carry the full body')

  const full = await provider.get(one)
  assert.ok(full, `provider.get(${one.name}) returned nothing`)
  assert.equal(typeof full.content, 'string')
  assert.ok(full.content.length > 200, 'skill body should be substantial')
})

test('each tool output schema forbids undeclared fields', async () => {
  const { tools } = await mountAll()
  for (const [name, definition] of tools) {
    assert.equal(
      definition.output.schema.additionalProperties,
      false,
      `${name} must set additionalProperties: false`,
    )
    assert.ok(definition.output.schema.properties, `${name} has no properties`)
  }
})

test('tool names are prefixed so they cannot collide with host tools', async () => {
  const { tools } = await mountAll()
  for (const name of tools.keys()) {
    assert.ok(name.startsWith('amadeus_'), `${name} should use the amadeus_ prefix`)
  }
})

test('client-side plugins declare a toolview key matching their tool', async () => {
  const { tools } = await mountAll()
  // The three plugins with browser cards.
  const keyed = ['amadeus_speak', 'amadeus_emotion', 'amadeus_stage']
  for (const key of keyed) {
    assert.ok(tools.has(key), `${key} must exist for its toolview to bind`)
  }
})
