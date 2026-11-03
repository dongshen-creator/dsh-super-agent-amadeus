/**
 * The `amadeus-voice-chat` skill provider.
 *
 * Two-level loading (candidate list vs body) keeps the style rules out of the
 * context until the model actually decides to speak in character.
 */
import {
  BUNDLED_SKILL_RANK,
  type SkillCandidate,
  type SkillDefinition,
  type SkillLookupOptions,
  type SkillProvider,
} from '@deepseek-ai/dsh-skill'

import { VOICE_CHAT_SKILL_BODY } from './skill-bodies.js'

export const PROVIDER_NAME = 'amadeus-persona'
const SKILL_NAME = 'amadeus-voice-chat'

const CANDIDATE: SkillCandidate = {
  name: SKILL_NAME,
  description:
    'Reply in real-time spoken voice as the Amadeus persona: short sentences, no Markdown, one thought per turn. Use when the user speaks (voice transcription) or asks for a natural spoken conversation.',
  whenToUse:
    'Any turn whose output will be spoken aloud, or when the user is chatting casually rather than asking for a document.',
  invocation: { modelInvocable: true, userInvocable: true },
  provider: PROVIDER_NAME,
  source: 'bundled',
  rank: BUNDLED_SKILL_RANK,
  locator: SKILL_NAME,
}

export const voiceChatSkillProvider: SkillProvider = {
  name: PROVIDER_NAME,
  async list(_options: SkillLookupOptions): Promise<SkillCandidate[]> {
    return [CANDIDATE]
  },
  async get(candidate: SkillCandidate): Promise<SkillDefinition | undefined> {
    if (candidate.name !== SKILL_NAME) return undefined
    return { ...CANDIDATE, content: VOICE_CHAT_SKILL_BODY }
  },
}
