import assert from 'node:assert/strict'
import test from 'node:test'

import { makeStageTool } from '../lib/tool.js'
import { DEFAULT_ROLE, LIVE2D_MODELS } from '../lib/fragment.js'

const SCHEMA_FIELDS = [
  'text',
  'role',
  'modelPath',
  'scale',
  'x',
  'y',
  'mobile',
  'emotion',
  'motion',
  'expression',
]

function tool(overrides = {}) {
  return makeStageTool({ defaultRole: DEFAULT_ROLE, random: () => 0, now: () => 1000, ...overrides })
}

test('execute returns exactly the fields declared in the output schema', async () => {
  const value = await tool().execute({})
  assert.deepEqual(Object.keys(value).sort(), [...SCHEMA_FIELDS].sort())
  // The runtime rejects a boolean where a string is declared, so be explicit.
  assert.equal(typeof value.text, 'string')
  assert.equal(typeof value.mobile, 'boolean')
  assert.equal(typeof value.scale, 'number')
})

test('an empty call uses the configured default role and desktop layout', async () => {
  const value = await tool().execute({})
  assert.equal(value.role, DEFAULT_ROLE)
  assert.equal(value.modelPath, LIVE2D_MODELS[DEFAULT_ROLE].path)
  assert.equal(value.x, 550)
  assert.equal(value.y, 50)
  assert.equal(value.mobile, false)
  assert.equal(value.expression, '')
  assert.ok(value.text.includes(DEFAULT_ROLE))
})

test('role, viewport width and mobile are honoured', async () => {
  const value = await tool().execute({ viewportWidth: 380, mobile: true })
  assert.equal(value.x, -100)
  assert.equal(value.y, 20)
  assert.equal(value.mobile, true)
})

test('an unknown role falls back rather than failing the call', async () => {
  const value = await tool().execute({ role: '不存在的角色' })
  assert.equal(value.role, DEFAULT_ROLE)
})

test('expression and motion are resolved before being reported', async () => {
  const joy = await tool().execute({ emotion: 'joy', motion: 'smile1' })
  assert.equal(joy.expression, 'joy')
  assert.equal(joy.motion, 'smile1')
  assert.ok(joy.text.includes('joy'))

  const neutral = await tool().execute({ emotion: 'neutral' })
  assert.equal(neutral.expression, '')

  const speaking = await tool().execute({ motion: 'speaking' })
  assert.equal(speaking.motion, 'random1')
})

test('presentationMeta carries the idle parameters and stage placement', async () => {
  const definition = tool()
  const value = await definition.execute({ emotion: 'shy' })
  const meta = definition.output.presentationMeta({ emotion: 'shy' }, value)

  assert.equal(meta.kind, 'amadeus-live2d')
  assert.equal(meta.role, DEFAULT_ROLE)
  assert.equal(meta.x, 550)
  assert.equal(meta.expression, 'shy')
  assert.equal(meta.parameters.length, 10)
  const names = meta.parameters.map((parameter) => parameter.name)
  assert.ok(names.includes('ParamAngleX'))
  assert.ok(names.includes('ParamEyeLOpen'))
})

test('idle animation continues across calls instead of resetting', async () => {
  // One definition, two calls: the head keeps converging toward the same
  // target, so the second frame differs from the first.
  const definition = tool()
  const a = await definition.execute({})
  const metaA = definition.output.presentationMeta({}, a)
  const b = await definition.execute({})
  const metaB = definition.output.presentationMeta({}, b)

  const headA = metaA.parameters.find((parameter) => parameter.name === 'ParamAngleX').value
  const headB = metaB.parameters.find((parameter) => parameter.name === 'ParamAngleX').value
  assert.notEqual(headA, headB)
  // Converging toward -12 from 0: -1.2 then -2.28.
  assert.ok(Math.abs(headA - -1.2) < 1e-9)
  assert.ok(Math.abs(headB - -2.28) < 1e-9)
})

test('a fresh tool instance starts from the constructor state', async () => {
  const a = await tool().execute({})
  const b = await tool().execute({})
  const headA = tool().output.presentationMeta({}, a).parameters
    .find((parameter) => parameter.name === 'ParamAngleX').value
  const headB = tool().output.presentationMeta({}, b).parameters
    .find((parameter) => parameter.name === 'ParamAngleX').value
  assert.equal(headA, headB)
})
