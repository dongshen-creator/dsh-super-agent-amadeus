/**
 * @amadeus/persona — the Amadeus character, its system prompt, and its spoken
 * conversation style.
 *
 * Split out of the original project's `utils/prompt_utils.py`: the prompt text
 * becomes a live system-prompt section, and the "talk like a human on a voice
 * call" rules become an on-demand skill.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-system-prompt'
import z from '@deepseek-ai/schemastery'

import { buildPersonaPrompt, formatTimestamp } from './fragment.js'
import { PERSONA_CANDIDATES_HINT } from './skill-bodies.js'
import { voiceChatSkillProvider } from './skill.js'

export const name = 'amadeus-persona'
export const inject = ['systemPrompt', 'skills']

/** Placement for the persona body: after general rules, before per-tool notes. */
const PERSONA_ORDER = 900
const STYLE_HINT_ORDER = 901

export interface Config {
  /** Persona body the assistant plays, e.g. the Kurisu description. */
  persona: string
  /** Spoken output language code (`zh` | `en` | `ja`). */
  voiceLanguage: string
  /** Written transcript language code. */
  textLanguage: string
  /** Name the assistant uses for the user. */
  userName: string
  /** Register the spoken-conversation skill. Defaults to true. */
  registerSkill: boolean
}

export const Config: z<Config> = z.object({
  persona: z
    .string()
    .default(
      '命运石之门(steins gate)的牧濑红莉栖(kurisu),一个天才少女,性格傲娇,不喜欢被叫克里斯蒂娜',
    ),
  voiceLanguage: z.string().default('ja'),
  textLanguage: z.string().default('zh'),
  userName: z.string().default('用户'),
  registerSkill: z.boolean().default(true),
})

export function apply(ctx: Context, config: Config): void {
  ctx.systemPrompt.section({
    name: 'amadeus:persona',
    order: PERSONA_ORDER,
    text: () =>
      buildPersonaPrompt({
        persona: config.persona,
        voiceLanguage: config.voiceLanguage,
        textLanguage: config.textLanguage,
        userName: config.userName,
        now: formatTimestamp(new Date()),
      }),
  })

  ctx.systemPrompt.section({
    name: 'amadeus:voice-style-hint',
    order: STYLE_HINT_ORDER,
    text: PERSONA_CANDIDATES_HINT,
  })

  if (config.registerSkill) {
    ctx.skills.registerProvider(() => voiceChatSkillProvider)
  }
}
