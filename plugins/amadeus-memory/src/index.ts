/**
 * @amadeus/memory — long-term memory for the Amadeus conversation.
 *
 * Split out of `server.py`'s inline mem0 calls: recall becomes a tool the model
 * calls before answering, and storing a turn becomes an explicit tool. The
 * user-scope id keeps the original `md5(userName + salt)[:16]` derivation so an
 * existing memory store still matches.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

import { makeMemoryClient } from './api.js'
import { makeRecallTool, makeRememberTool } from './tool.js'

export const name = 'amadeus-memory'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  /** mem0-compatible API root, e.g. `https://api.mem0.ai/v1`. */
  baseUrl: string
  /** Bearer key. Empty reads `AMADEUS_MEM0_API_KEY`. */
  apiKey: string
  /** User name whose hash scopes the store. */
  userName: string
  /** Default recall count. */
  searchLimit: number
  /** Register the write tool. Defaults to true. */
  enableRemember: boolean
  /** Per-request timeout. */
  timeoutMs: number
}

export const Config: z<Config> = z.object({
  baseUrl: z.string().default(process.env.AMADEUS_MEM0_BASE_URL ?? 'https://api.mem0.ai/v1'),
  apiKey: z.string().default(process.env.AMADEUS_MEM0_API_KEY ?? ''),
  userName: z.string().default(process.env.AMADEUS_USER_NAME ?? '用户'),
  searchLimit: z.number().default(3),
  enableRemember: z.boolean().default(true),
  timeoutMs: z.number().default(30_000),
})

export function apply(ctx: Context, config: Config): void {
  const client = makeMemoryClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    userName: config.userName,
    searchLimit: config.searchLimit,
    timeoutMs: config.timeoutMs,
  })

  ctx.tools.register(makeRecallTool(client))
  if (config.enableRemember) ctx.tools.register(makeRememberTool(client))

  ctx.systemPrompt.section({
    name: 'tool:amadeus_memory',
    order: 913,
    text:
      'Call `amadeus_recall` before answering anything that depends on what this user told you in earlier ' +
      'conversations; treat what it returns as facts the user shared, and say plainly when it finds nothing. ' +
      'After a turn that revealed a durable fact about the user, call `amadeus_remember` with the exact exchange. ' +
      'Never invent a memory, and never mention the memory store to the user.',
  })
}
