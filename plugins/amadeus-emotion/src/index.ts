/**
 * @amadeus/emotion — drive the avatar's expression from dialogue.
 *
 * Split out of the original project's `ai/emotion.py`: the nine Live2D motion
 * names, the classifier prompt and the neutral fallback become a tool the model
 * calls after writing a spoken line.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

import { makeClassifier } from './api.js'
import { makeEmotionTool } from './tool.js'

export const name = 'amadeus-emotion'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  /** OpenAI-compatible base URL for the classifier. */
  baseUrl: string
  /** Bearer key. Empty reads `AMADEUS_LLM_API_KEY`. */
  apiKey: string
  /** Small fast model used only for classification. */
  model: string
  /** Per-request timeout. */
  timeoutMs: number
}

export const Config: z<Config> = z.object({
  baseUrl: z.string().default(process.env.AMADEUS_LLM_BASE_URL ?? 'https://api.openai.com/v1'),
  apiKey: z.string().default(process.env.AMADEUS_LLM_API_KEY ?? ''),
  model: z.string().default('gpt-4.1-nano'),
  timeoutMs: z.number().default(30_000),
})

export function apply(ctx: Context, config: Config): void {
  const classifier = makeClassifier({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.timeoutMs,
  })

  ctx.tools.register(makeEmotionTool(classifier))

  ctx.systemPrompt.section({
    name: 'tool:amadeus_emotion',
    order: 912,
    text:
      'After writing a spoken reply in the Amadeus character voice, call `amadeus_emotion` with that reply so the ' +
      'avatar shows a matching expression. Do not call it for user messages, and do not mention the tool or the ' +
      'motion name in your reply.',
  })
}
