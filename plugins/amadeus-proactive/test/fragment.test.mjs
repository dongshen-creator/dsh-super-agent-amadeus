import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ACTIONS,
  ACTION_GUIDES,
  ACTION_LABELS,
  DEFAULT_ACTION,
  PLANNER_SYSTEM_PROMPT,
  buildProactivePrompt,
  isAction,
  normalizeAction,
  proactiveMetaFrom,
} from '../lib/fragment.js'

test('the five moves and their order match ai/plan.py', () => {
  assert.deepEqual([...ACTIONS], [
    'continue_topic',
    'change_topic',
    'ask_question',
    'share_memory',
    'express_emotion',
  ])
})

test('the planner prompt is copied verbatim from the source', () => {
  assert.equal(
    PLANNER_SYSTEM_PROMPT,
    '你现在是一个智能体的主动行动模块部分，根据当前智能体和用户的上下文，为我的智能体随机选择下一步行动',
  )
})

test('the fallback move is share_memory', () => {
  assert.equal(DEFAULT_ACTION, 'share_memory')
  assert.equal(normalizeAction('nonsense'), 'share_memory')
  assert.equal(normalizeAction(undefined), 'share_memory')
  assert.equal(normalizeAction(42), 'share_memory')
})

test('valid actions pass through normalization unchanged', () => {
  for (const action of ACTIONS) {
    assert.equal(isAction(action), true)
    assert.equal(normalizeAction(action), action)
  }
  assert.equal(isAction('CONTINUE_TOPIC'), false)
  assert.equal(isAction(' continue_topic'), false)
})

test('every move has a label and a guide', () => {
  for (const action of ACTIONS) {
    assert.equal(typeof ACTION_LABELS[action], 'string')
    assert.ok(ACTION_LABELS[action].length > 0)
    assert.equal(typeof ACTION_GUIDES[action], 'string')
    assert.ok(ACTION_GUIDES[action].length > 0)
  }
  assert.equal(ACTION_LABELS.share_memory, '分享记忆')
})

test('the proactive prompt keeps the marker the persona prompt keys on', () => {
  assert.equal(buildProactivePrompt('ask_question'), '[AI主动发起对话]next Action: ask_question')
  for (const action of ACTIONS) {
    const prompt = buildProactivePrompt(action)
    assert.ok(prompt.startsWith('[AI主动发起对话]next Action: '))
    assert.ok(prompt.endsWith(action))
  }
})

test('meta narrowing requires the plugin tag and a valid action', () => {
  const meta = proactiveMetaFrom({
    kind: 'amadeus-proactive',
    action: 'change_topic',
    label: '切换话题',
    guide: '换一个话题。',
    prompt: buildProactivePrompt('change_topic'),
    confident: true,
  })
  assert.ok(meta)
  assert.equal(meta.action, 'change_topic')
  assert.equal(meta.confident, true)

  assert.equal(proactiveMetaFrom({ kind: 'amadeus-emotion', action: 'change_topic' }), undefined)
  assert.equal(proactiveMetaFrom({ kind: 'amadeus-proactive', action: 'bogus' }), undefined)
  assert.equal(proactiveMetaFrom(null), undefined)
  assert.equal(proactiveMetaFrom('amadeus-proactive'), undefined)
})

test('meta narrowing fills missing display fields from the vocabulary tables', () => {
  const meta = proactiveMetaFrom({ kind: 'amadeus-proactive', action: 'share_memory' })
  assert.ok(meta)
  assert.equal(meta.label, ACTION_LABELS.share_memory)
  assert.equal(meta.guide, ACTION_GUIDES.share_memory)
  assert.equal(meta.prompt, buildProactivePrompt('share_memory'))
  assert.equal(meta.confident, false)
})
