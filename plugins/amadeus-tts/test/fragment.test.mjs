/**
 * Contract tests for TTS segmentation, WAV wrapping and meta narrowing.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { pcmToWav, toDataUri } from '../lib/api.js'
import {
  estimateDurationSeconds,
  speechMetaFrom,
  splitForSpeech,
  summarizeSpeech,
  toSegments,
} from '../lib/fragment.js'

test('splits at sentence punctuation', () => {
  const segments = splitForSpeech('今天实验又失败了。你这次改的是哪一组参数？', 5)
  assert.deepEqual(segments, ['今天实验又失败了。', '你这次改的是哪一组参数？'])
})

test('merges clauses shorter than the minimum length', () => {
  // Default minimum is 15 characters: short clauses keep accumulating.
  const merged = splitForSpeech('嗯。好的。我们继续讨论这个很有意思的话题吧。')
  assert.deepEqual(merged, ['嗯。好的。我们继续讨论这个很有意思的话题吧。'])

  // A clause is released only once the accumulated buffer reaches the minimum,
  // so "嗯。" (2 chars) waits and absorbs the next clause when the minimum is 3.
  assert.deepEqual(splitForSpeech('嗯。好的。我们继续讨论这个很有意思的话题吧。', 3), [
    '嗯。好的。',
    '我们继续讨论这个很有意思的话题吧。',
  ])

  // At minimum 2 each clause qualifies on its own.
  assert.deepEqual(splitForSpeech('嗯。好的。我们继续讨论这个很有意思的话题吧。', 2), [
    '嗯。',
    '好的。',
    '我们继续讨论这个很有意思的话题吧。',
  ])
})

test('releases a short clause once it is long enough', () => {
  const segments = splitForSpeech('这是一段足够长的第一句话。短句。', 10)
  assert.deepEqual(segments, ['这是一段足够长的第一句话。', '短句。'])
})

test('drops pure whitespace and keeps meaningful short tails', () => {
  assert.deepEqual(splitForSpeech('   '), [])
  assert.deepEqual(splitForSpeech('好。'), ['好。'])
})

test('handles both Chinese and Latin punctuation', () => {
  assert.deepEqual(splitForSpeech('Hello there. How are you?', 6), ['Hello there.', 'How are you?'])
  assert.deepEqual(splitForSpeech('第一句；第二句！', 3), ['第一句；', '第二句！'])
})

test('produces stable ids and 1-based indices', () => {
  const segments = toSegments('第一句话足够长了。第二句也足够长了。', 5)
  assert.deepEqual(
    segments.map((s) => [s.id, s.index]),
    [['seg-1', 1], ['seg-2', 2]],
  )
})

test('wraps PCM in a valid 44-byte WAV header', () => {
  const pcm = new Uint8Array([1, 2, 3, 4])
  const wav = pcmToWav(pcm, 32_000)
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength)

  assert.equal(wav.byteLength, 48)
  assert.equal(String.fromCharCode(...wav.subarray(0, 4)), 'RIFF')
  assert.equal(String.fromCharCode(...wav.subarray(8, 12)), 'WAVE')
  assert.equal(String.fromCharCode(...wav.subarray(36, 40)), 'data')
  assert.equal(view.getUint32(4, true), 36 + 4)
  assert.equal(view.getUint16(22, true), 1)
  assert.equal(view.getUint32(24, true), 32_000)
  assert.equal(view.getUint16(34, true), 16)
  assert.equal(view.getUint32(40, true), 4)
  assert.deepEqual([...wav.subarray(44)], [1, 2, 3, 4])
})

test('builds a decodable data URI', () => {
  const uri = toDataUri(new Uint8Array([0x52, 0x49, 0x46, 0x46]), 'audio/wav')
  assert.ok(uri.startsWith('data:audio/wav;base64,'))
  assert.equal(atob(uri.split(',')[1]), 'RIFF')
})

test('estimates duration from PCM length', () => {
  // 32000 samples/s * 2 bytes = 64000 bytes per second
  assert.equal(estimateDurationSeconds(64_000, 32_000), 1)
  assert.equal(estimateDurationSeconds(0), 0)
})

test('summarises speech for the model', () => {
  assert.equal(summarizeSpeech(3, 2048, 'v1'), '已合成 3 段语音，共 2 KB（音色 v1），可在对话中的播放器里试听。')
  assert.match(summarizeSpeech(1, 100), /已合成 1 段语音，共 1 KB/)
})

test('narrows speech meta and rejects malformed payloads', () => {
  const meta = speechMetaFrom({
    kind: 'amadeus-speech',
    segments: [{ id: 'seg-1', text: 'hi', index: 1 }, { broken: true }],
    audio: 'data:audio/wav;base64,AA==',
    mimeType: 'audio/wav',
    byteLength: 4,
  })
  assert.equal(meta?.segments.length, 1)
  assert.equal(meta?.byteLength, 4)
  assert.equal(speechMetaFrom({ kind: 'amadeus-speech', mimeType: 'audio/wav' }), undefined)
  assert.equal(speechMetaFrom(null), undefined)
})
