/**
 * Client tests: transcription against an injected fetch, no real network.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { makeTranscriber } from '../lib/api.js'

const WAV = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])

function stubFetch(handler) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, init })
    return handler(url, init)
  }
  return { impl, calls }
}

const BASE = {
  baseUrl: 'https://whisper.example/v1/',
  apiKey: 'k',
  model: 'whisper-large-v3',
  timeoutMs: 5000,
}

test('posts multipart form to the transcriptions endpoint', async () => {
  const { impl, calls } = stubFetch(async () =>
    new Response(JSON.stringify({ text: '你好世界' }), { status: 200 }),
  )
  const result = await makeTranscriber(BASE, impl).transcribe({
    bytes: WAV,
    filename: 'turn.wav',
    language: 'zh',
  })

  assert.equal(result.text, '你好世界')
  assert.equal(result.model, 'whisper-large-v3')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://whisper.example/v1/audio/transcriptions')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer k')
  assert.ok(calls[0].init.body instanceof FormData)
})

test('omits the language part when no hint is given', async () => {
  const { impl, calls } = stubFetch(async () =>
    new Response(JSON.stringify({ text: 'auto' }), { status: 200 }),
  )
  await makeTranscriber(BASE, impl).transcribe({ bytes: WAV, filename: 'a.wav' })
  assert.equal(calls[0].init.body.get('language'), null)
})

test('surfaces endpoint failures with status and body', async () => {
  const { impl } = stubFetch(async () => new Response('bad key', { status: 401, statusText: 'Unauthorized' }))
  await assert.rejects(
    () => makeTranscriber(BASE, impl).transcribe({ bytes: WAV, filename: 'a.wav' }),
    /401 Unauthorized — bad key/,
  )
})

test('rejects unknown audio formats before calling the endpoint', async () => {
  const { impl, calls } = stubFetch(async () => new Response('{}', { status: 200 }))
  await assert.rejects(
    () => makeTranscriber(BASE, impl).transcribe({ bytes: Uint8Array.from([0, 1, 2]), filename: 'blob.bin' }),
    /could not determine the audio format/,
  )
  assert.equal(calls.length, 0)
})

test('rejects empty audio input', async () => {
  const { impl } = stubFetch(async () => new Response('{}', { status: 200 }))
  await assert.rejects(
    () => makeTranscriber(BASE, impl).transcribe({}),
    /provide either `path` or `bytes`/,
  )
})

test('reports missing credentials without a network call', async () => {
  const { impl, calls } = stubFetch(async () => new Response('{}', { status: 200 }))
  await assert.rejects(
    () => makeTranscriber({ ...BASE, apiKey: '' }, impl).transcribe({ bytes: WAV, filename: 'a.wav' }),
    /no API key configured/,
  )
  assert.equal(calls.length, 0)
})

test('turns an aborted request into a timeout message', async () => {
  const impl = async (_url, init) => {
    await new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      })
    })
  }
  await assert.rejects(
    () => makeTranscriber({ ...BASE, timeoutMs: 20 }, impl).transcribe({ bytes: WAV, filename: 'a.wav' }),
    /timed out after 20ms/,
  )
})
