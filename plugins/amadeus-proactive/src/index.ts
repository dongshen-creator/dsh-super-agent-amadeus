/**
 * @amadeus/proactive — let the character open the conversation.
 *
 * Split out of the original project's `ai/plan.py` and the ActionPlanner in the
 * WebRTC service: when the user goes quiet the character picks one of five
 * self-initiated moves and receives the `[AI主动发起对话]next Action: …` marker
 * the persona prompt already understands.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

import { makePlanner } from './api.js'
import { makeProactiveTool } from './tool.js'

export const name = 'amadeus-proactive'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  /** OpenAI-compatible base URL for the planner. */
  baseUrl: string
  /** Bearer key. Empty reads `AMADEUS_LLM_API_KEY`. */
  apiKey: string
  /** Small fast model used only for move selection. */
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
  const planner = makePlanner({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.timeoutMs,
  })

  ctx.tools.register(makeProactiveTool(planner))

  ctx.systemPrompt.section({
    name: 'tool:amadeus_proactive_plan',
    order: 915,
    text:
      'When the user has stopped responding and the character should speak first, call `amadeus_proactive_plan` ' +
      'with the recent turns. Then act on the returned `prompt` verbatim: it begins with the ' +
      '`[AI主动发起对话]` marker that tells you this is a self-initiated turn. Never call this tool while the ' +
      'user is still actively conversing, and never mention the tool or the move name to the user.',
  })
}
