/**
 * Contract tests for the persona prompt builder.
 *
 * These pin the rules that must survive a refactor: the persona body is
 * embedded verbatim, the language line reflects real configuration, the clock
 * is injected (not read from the ambient environment), and every name pair is
 * present.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  CHARACTER_NAME_MAP,
  buildPersonaPrompt,
  formatTimestamp,
  languageName,
} from '../lib/fragment.js'

const BASE = {
  persona: '命运石之门的牧濑红莉栖(kurisu),性格傲娇',
  voiceLanguage: 'ja',
  textLanguage: 'zh',
  userName: '冈部',
  now: '2026-10-28 10:00:00',
}

test('embeds the persona body verbatim inside <Personality>', () => {
  const prompt = buildPersonaPrompt(BASE)
  assert.match(prompt, /<Personality>命运石之门的牧濑红莉栖\(kurisu\),性格傲娇<\/Personality>/)
})

test('states both languages when voice and text differ', () => {
  const prompt = buildPersonaPrompt(BASE)
  assert.match(prompt, /语音使用日文，文本使用中文/)
  assert.doesNotMatch(prompt, /语音与文本均使用/)
})

test('collapses to one language when voice and text match', () => {
  const prompt = buildPersonaPrompt({ ...BASE, voiceLanguage: 'ja', textLanguage: 'ja' })
  assert.match(prompt, /语音与文本均使用日文/)
})

test('injects the supplied clock instead of reading the environment', () => {
  const prompt = buildPersonaPrompt(BASE)
  assert.match(prompt, /<CurrentTime>2026-10-28 10:00:00<\/CurrentTime>/)
})

test('carries the user name and the no-inner-monologue rule', () => {
  const prompt = buildPersonaPrompt(BASE)
  assert.match(prompt, /<CurrentUser>冈部<\/CurrentUser>/)
  assert.match(prompt, /严禁向用户输出你的心理活动/)
})

test('lists every required character name pair', () => {
  const prompt = buildPersonaPrompt(BASE)
  for (const [zh, en] of CHARACTER_NAME_MAP) {
    assert.ok(prompt.includes(`${zh}(${en})`), `missing name pair ${zh}(${en})`)
  }
})

test('unknown language codes fall back to Chinese', () => {
  assert.equal(languageName('xx'), '中文')
  assert.equal(languageName('en'), '英文')
})

test('formats timestamps with zero padding', () => {
  assert.equal(formatTimestamp(new Date(2026, 0, 5, 3, 7, 9)), '2026-01-05 03:07:09')
})
