/**
 * Contract tests for memory id derivation, result normalising and context
 * assembly.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { generateUserId } from '../lib/api.js'
import {
  buildMemoryContext,
  memoryMetaFrom,
  normalizeSearchResults,
  summarizeHits,
} from '../lib/fragment.js'

test('derives a stable 16-hex user id from the name', () => {
  const id = generateUserId('冈部')
  assert.match(id, /^[0-9a-f]{16}$/)
  assert.equal(generateUserId('冈部'), id)
  assert.notEqual(generateUserId('牧濑'), id)
})

test('matches the original python derivation exactly', () => {
  // Values produced by the original:
  //   hashlib.md5(f"{name}_{'amadeus_system_fixed_salt_09876'}".encode()).hexdigest()[:16]
  assert.equal(generateUserId('用户'), '7e49749f51d28f97')
  assert.equal(generateUserId('冈部'), 'fb0f16e6827f35a5')
  assert.equal(generateUserId('牧濑'), '34041e7ef2976989')
})

test('normalises both mem0 response shapes', () => {
  const wrapped = normalizeSearchResults({
    results: [{ memory: '喜欢喝黑咖啡', score: 0.91, id: 'm1' }, { text: '在实验室工作' }],
  })
  assert.equal(wrapped.length, 2)
  assert.equal(wrapped[0].memory, '喜欢喝黑咖啡')
  assert.equal(wrapped[0].score, 0.91)
  assert.equal(wrapped[1].memory, '在实验室工作')

  const bare = normalizeSearchResults([{ memory: 'a' }, { text: '' }, null, 'nope'])
  assert.deepEqual(bare, [{ memory: 'a', score: undefined, id: undefined }])
})

test('drops unusable payloads instead of throwing', () => {
  assert.deepEqual(normalizeSearchResults(null), [])
  assert.deepEqual(normalizeSearchResults({ unrelated: [] }), [])
  assert.deepEqual(normalizeSearchResults('text'), [])
})

test('builds the prompt fragment the persona expects', () => {
  const context = buildMemoryContext([{ memory: '喜欢黑咖啡' }, { memory: '在实验室工作' }], '我喝什么')
  assert.equal(
    context,
    'Relevant Memories/Facts:\n喜欢黑咖啡\n在实验室工作\n\nUser Question: 我喝什么',
  )
})

test('passes the question through when nothing was recalled', () => {
  assert.equal(buildMemoryContext([], '我喝什么'), '我喝什么')
})

test('summarises hits and the empty case', () => {
  assert.match(summarizeHits([{ memory: '喜欢黑咖啡' }], '喝什么'), /检索到 1 条相关记忆：喜欢黑咖啡/)
  assert.equal(summarizeHits([], '喝什么'), '没有检索到与「喝什么」相关的长期记忆。')
})

test('narrows memory meta and rejects malformed payloads', () => {
  const meta = memoryMetaFrom({
    kind: 'amadeus-memory',
    query: '咖啡',
    hits: [{ memory: '喜欢黑咖啡' }],
    userId: 'abc',
  })
  assert.equal(meta?.hits.length, 1)
  assert.equal(meta?.userId, 'abc')
  assert.equal(memoryMetaFrom({ kind: 'amadeus-memory' }), undefined)
  assert.equal(memoryMetaFrom({}), undefined)
})
