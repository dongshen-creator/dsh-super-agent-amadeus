/**
 * Contract tests for voice-clone input validation and response parsing.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  extractVoiceId,
  referenceFormatFrom,
  referenceMime,
  toAudioDataUri,
  validateCustomName,
  validateReferenceText,
  voiceCloneMetaFrom,
} from '../lib/fragment.js'

test('accepts the four supported reference formats', () => {
  assert.equal(referenceFormatFrom('voice.wav'), 'wav')
  assert.equal(referenceFormatFrom('VOICE.MP3'), 'mp3')
  assert.equal(referenceFormatFrom('a.m4a'), 'm4a')
  assert.equal(referenceFormatFrom('a.flac'), 'flac')
  assert.equal(referenceFormatFrom('a.webm'), undefined)
  assert.equal(referenceFormatFrom('noext'), undefined)
})

test('maps reference formats to MIME types', () => {
  assert.equal(referenceMime('wav'), 'audio/wav')
  assert.equal(referenceMime('mp3'), 'audio/mpeg')
})

test('requires a non-empty, bounded reference transcript', () => {
  assert.equal(validateReferenceText('  你好世界  '), '你好世界')
  assert.throws(() => validateReferenceText('   '), /`referenceText` is required/)
  assert.throws(() => validateReferenceText('x'.repeat(501)), /at most 500 characters/)
})

test('requires a bounded voice name', () => {
  assert.equal(validateCustomName('  kurisu '), 'kurisu')
  assert.throws(() => validateCustomName(''), /`name` is required/)
  assert.throws(() => validateCustomName('x'.repeat(65)), /at most 64 characters/)
})

test('reads the voice id from every documented response key', () => {
  assert.equal(extractVoiceId({ uri: 'speech:siliconflow-k:abc:model' }), 'speech:siliconflow-k:abc:model')
  assert.equal(extractVoiceId({ voice: 'v-1' }), 'v-1')
  assert.equal(extractVoiceId({ voice_id: 'v-2' }), 'v-2')
  assert.equal(extractVoiceId({ id: 'v-3' }), 'v-3')
})

test('rejects a response with no voice id instead of reporting success', () => {
  assert.throws(() => extractVoiceId({ ok: true }), /did not return a voice id/)
  assert.throws(() => extractVoiceId(null), /did not return a voice id/)
  assert.throws(() => extractVoiceId({ uri: '   ' }), /did not return a voice id/)
})

test('encodes audio as a data URI', () => {
  const uri = toAudioDataUri(new Uint8Array([0x52, 0x49, 0x46, 0x46]), 'audio/wav')
  assert.ok(uri.startsWith('data:audio/wav;base64,'))
  assert.equal(atob(uri.split(',')[1]), 'RIFF')
})

test('narrows clone meta and rejects malformed payloads', () => {
  const meta = voiceCloneMetaFrom({
    kind: 'amadeus-voice-clone',
    voiceId: 'v-1',
    name: 'kurisu',
    model: 'm',
    referenceText: 'hello',
    byteLength: 10,
    format: 'wav',
  })
  assert.equal(meta?.name, 'kurisu')
  assert.equal(meta?.byteLength, 10)
  assert.equal(voiceCloneMetaFrom({ kind: 'amadeus-voice-clone' }), undefined)
  assert.equal(voiceCloneMetaFrom([]), undefined)
})
