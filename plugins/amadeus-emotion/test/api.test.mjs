/**
 * Client tests for the emotion classifier against an injected fetch.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeClassifier } from '../lib/api.js'

const BASE = { baseUrl: 'https://llm.example/v1', apiKey: 'k', model: 'gpt-4.1-nano', timeoutMs: 5000 }

function reply(content) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
}

test('sends a schema-constrained request and reads the motion', async () => {
  let sent
  const impl = async (_url, init) => {
    sent = JSON.parse(init.body)
    return reply(JSON.stringify({ result: 'smile2' }))
  }

  const result = await makeClassifier(BASE, impl).classify('太好了，实验成功了！')
  assert.equal(result.emotion, 'smile2')
  assert.equal(result.confident, true)

  assert.equal(sent.model, 'gpt-4.1-nano')
  assert.equal(sent.response_format.type, 'json_schema')
  assert.deepEqual(sent.response_format.json_schema.schema.properties.result.enum, [
    'neutral', 'anger', 'joy', 'sadness', 'shy', 'shy2', 'smile1', 'smile2', 'unhappy',
  ])
  assert.equal(sent.messages[1].content, '太好了，实验成功了！')
})

test('marks an out-of-vocabulary answer as not confident and defaults to neutral', async () => {
  const impl = async () => reply(JSON.stringify({ result: 'delighted' }))
  const result = await makeClassifier(BASE, impl).classify('嗯')
  assert.equal(result.emotion, 'neutral')
  assert.equal(result.confident, false)
})

test('survives malformed JSON content', async () => {
  const impl = async () => reply('not json at all')
  const result = await makeClassifier(BASE, impl).classify('嗯')
  assert.equal(result.emotion, 'neutral')
  assert.equal(result.confident, false)
})

test('short-circuits empty text without a request', async () => {
  let called = false
  const impl = async () => {
    called = true
    return reply('{}')
  }
  const result = await makeClassifier(BASE, impl).classify('   ')
  assert.equal(result.emotion, 'neutral')
  assert.equal(called, false)
})

test('surfaces endpoint errors', async () => {
  const impl = async () => new Response('quota', { status: 429, statusText: 'Too Many Requests' })
  await assert.rejects(
    () => makeClassifier(BASE, impl).classify('嗯'),
    /429 Too Many Requests — quota/,
  )
})
