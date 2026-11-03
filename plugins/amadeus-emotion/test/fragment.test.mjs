/**
 * Contract tests for the emotion vocabulary, fallback and meta narrowing.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  DEFAULT_EMOTION,
  EMOTIONS,
  EMOTION_COLORS,
  EMOTION_LABELS,
  EMOTION_SYSTEM_PROMPT,
  emotionMetaFrom,
  isEmotion,
  normalizeEmotion,
} from '../lib/fragment.js'

test('exposes exactly the nine Live2D motion names', () => {
  assert.deepEqual([...EMOTIONS], [
    'neutral',
    'anger',
    'joy',
    'sadness',
    'shy',
    'shy2',
    'smile1',
    'smile2',
    'unhappy',
  ])
})

test('keeps the original classifier prompt', () => {
  assert.equal(
    EMOTION_SYSTEM_PROMPT,
    '你现在是一个虚拟形象的动作驱动器，你需要根据输入的虚拟形象的语言，驱动虚拟形象的动作和表情，请尽量输出得随机并丰富一些',
  )
})

test('recognises valid motions only', () => {
  assert.equal(isEmotion('joy'), true)
  assert.equal(isEmotion('happy'), false)
  assert.equal(isEmotion(undefined), false)
  assert.equal(isEmotion(1), false)
})

test('falls back to neutral on anything invalid', () => {
  assert.equal(DEFAULT_EMOTION, 'neutral')
  assert.equal(normalizeEmotion('anger'), 'anger')
  assert.equal(normalizeEmotion('nope'), 'neutral')
  assert.equal(normalizeEmotion(null), 'neutral')
})

test('labels and colours cover every motion', () => {
  for (const emotion of EMOTIONS) {
    assert.ok(EMOTION_LABELS[emotion].length > 0, `missing label for ${emotion}`)
    assert.ok(EMOTION_COLORS[emotion].startsWith('rgba('), `missing colour for ${emotion}`)
  }
})

test('narrows emotion meta and rejects malformed payloads', () => {
  const meta = emotionMetaFrom({
    kind: 'amadeus-emotion',
    emotion: 'smile2',
    label: '笑',
    color: 'rgba(1,2,3,0.2)',
    text: '太好了',
    confident: true,
  })
  assert.equal(meta?.emotion, 'smile2')
  assert.equal(meta?.confident, true)

  // An unknown motion name is not usable meta.
  assert.equal(emotionMetaFrom({ kind: 'amadeus-emotion', emotion: 'happy' }), undefined)
  assert.equal(emotionMetaFrom({ kind: 'other', emotion: 'joy' }), undefined)
  assert.equal(emotionMetaFrom('x'), undefined)
})
