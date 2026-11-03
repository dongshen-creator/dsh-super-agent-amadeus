import assert from 'node:assert/strict'
import test from 'node:test'

import { makePlanner } from '../lib/api.js'

const CONFIG = {
  baseUrl: 'https://llm.example/v1/',
  apiKey: 'test-key',
  model: 'gpt-4.1-nano',
  timeoutMs: 1_000,
}

function reply(content, ok = true) {
  return async () => ({
    ok,
    status: ok ? 200 : 400,
    statusText: ok ? 'OK' : 'Bad Request',
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => 'bad request body',
  })
}

const TURNS = [{ role: 'user', content: '今天有点累。' }]

test('a valid action comes back as confident', async () => {
  let seenBody
  const planner = makePlanner(CONFIG, async (_url, init) => {
    seenBody = JSON.parse(init.body)
    return (await reply('{"result":"ask_question"}')())
  })

  const result = await planner.plan(TURNS)
  assert.equal(result.action, 'ask_question')
  assert.equal(result.confident, true)
  assert.equal(result.model, 'gpt-4.1-nano')

  assert.equal(seenBody.model, 'gpt-4.1-nano')
  assert.equal(seenBody.messages[0].role, 'system')
  assert.ok(seenBody.messages[0].content.includes('主动行动模块'))
  assert.deepEqual(seenBody.messages[1], { role: 'user', content: '今天有点累。' })
  assert.equal(seenBody.response_format.type, 'json_schema')
  assert.deepEqual(seenBody.response_format.json_schema.schema.properties.result.enum, [
    'continue_topic',
    'change_topic',
    'ask_question',
    'share_memory',
    'express_emotion',
  ])
})

test('the base URL trailing slash is normalized', async () => {
  let seenUrl
  const planner = makePlanner(CONFIG, async (url) => {
    seenUrl = url
    return (await reply('{"result":"continue_topic"}')())
  })
  await planner.plan(TURNS)
  assert.equal(seenUrl, 'https://llm.example/v1/chat/completions')
})

test('an out-of-vocabulary answer falls back without throwing', async () => {
  const planner = makePlanner(CONFIG, reply('{"result":"dance"}'))
  const result = await planner.plan(TURNS)
  assert.equal(result.action, 'share_memory')
  assert.equal(result.confident, false)
})

test('malformed JSON falls back without throwing', async () => {
  const planner = makePlanner(CONFIG, reply('not json at all'))
  const result = await planner.plan(TURNS)
  assert.equal(result.action, 'share_memory')
  assert.equal(result.confident, false)
})

test('empty history short-circuits to share_memory without a request', async () => {
  let called = false
  const planner = makePlanner(CONFIG, async () => {
    called = true
    throw new Error('should not be called')
  })
  const result = await planner.plan([])
  assert.equal(called, false)
  assert.equal(result.action, 'share_memory')
  assert.equal(result.confident, true)
})

test('a missing API key fails loudly instead of silently planning', async () => {
  const planner = makePlanner({ ...CONFIG, apiKey: '' }, reply('{"result":"ask_question"}'))
  await assert.rejects(() => planner.plan(TURNS), /no API key configured/)
})

test('an HTTP error surfaces status and body', async () => {
  const planner = makePlanner(CONFIG, reply('', false))
  await assert.rejects(
    () => planner.plan(TURNS),
    /planner returned 400 Bad Request — bad request body/,
  )
})

test('a timeout aborts the request with a readable message', async () => {
  const planner = makePlanner({ ...CONFIG, timeoutMs: 20 }, (_url, init) => {
    return new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })
  })
  await assert.rejects(() => planner.plan(TURNS), /timed out after 20ms/)
})
