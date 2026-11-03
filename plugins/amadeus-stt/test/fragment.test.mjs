/**
 * Contract tests for the STT fragment: format sniffing, transcript normalising
 * and the silence guard.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  extractTranscript,
  formatFromFilename,
  formatFromMagicBytes,
  isUsableTranscript,
  mimeForFormat,
  summarizeTranscript,
  transcriptMetaFrom,
} from '../lib/fragment.js'

const bytes = (...values) => Uint8Array.from(values)

test('detects formats from extensions', () => {
  assert.equal(formatFromFilename('voice.WAV'), 'wav')
  assert.equal(formatFromFilename('notes.m4a'), 'm4a')
  assert.equal(formatFromFilename('recording.webm'), 'webm')
  assert.equal(formatFromFilename('no-extension'), undefined)
  assert.equal(formatFromFilename('archive.zip'), undefined)
})

test('detects formats from magic bytes', () => {
  const riff = bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)
  assert.equal(formatFromMagicBytes(riff), 'wav')

  const ogg = bytes(0x4f, 0x67, 0x67, 0x53, 0, 0)
  assert.equal(formatFromMagicBytes(ogg), 'ogg')

  const webm = bytes(0x1a, 0x45, 0xdf, 0xa3, 0, 0)
  assert.equal(formatFromMagicBytes(webm), 'webm')

  const flac = bytes(0x66, 0x4c, 0x61, 0x43, 0, 0)
  assert.equal(formatFromMagicBytes(flac), 'flac')

  const mp3 = bytes(0x49, 0x44, 0x33, 4, 0, 0)
  assert.equal(formatFromMagicBytes(mp3), 'mp3')

  assert.equal(formatFromMagicBytes(bytes(0, 1, 2, 3)), undefined)
})

test('maps formats onto MIME types', () => {
  assert.equal(mimeForFormat('wav'), 'audio/wav')
  assert.equal(mimeForFormat('mp3'), 'audio/mpeg')
  assert.equal(mimeForFormat('m4a'), 'audio/mp4')
})

test('extracts transcripts from every response shape', () => {
  assert.equal(extractTranscript({ text: '  你好  ' }), '你好')
  assert.equal(extractTranscript('raw text'), 'raw text')
  assert.equal(extractTranscript({ segments: [] }), '')
  assert.equal(extractTranscript(null), '')
  assert.equal(extractTranscript(42), '')
})

test('rejects silence and Whisper hallucination artefacts', () => {
  assert.equal(isUsableTranscript(''), false)
  assert.equal(isUsableTranscript('   '), false)
  assert.equal(isUsableTranscript('...'), false)
  assert.equal(isUsableTranscript('[Music]'), false)
  assert.equal(isUsableTranscript('[BLANK_AUDIO]'), false)
  assert.equal(isUsableTranscript('今天天气不错'), true)
  assert.equal(isUsableTranscript('Hello there.'), true)
})

test('summarises with and without a language', () => {
  assert.equal(summarizeTranscript('你好', 'zh'), '转录完成（zh）：你好')
  assert.equal(summarizeTranscript('你好'), '转录完成：你好')
  assert.ok(summarizeTranscript('x'.repeat(200)).endsWith('…'))
})

test('narrows persisted meta and rejects malformed payloads', () => {
  const meta = transcriptMetaFrom({
    kind: 'amadeus-transcript',
    text: 'hi',
    language: 'en',
    usable: true,
  })
  assert.equal(meta?.text, 'hi')
  assert.equal(meta?.usable, true)
  assert.equal(transcriptMetaFrom({ kind: 'other', text: 'hi' }), undefined)
  assert.equal(transcriptMetaFrom(null), undefined)
  assert.equal(transcriptMetaFrom({ kind: 'amadeus-transcript' }), undefined)
})
