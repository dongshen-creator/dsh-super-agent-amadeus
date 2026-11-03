/**
 * @amadeus/voice-clone — register a custom voice from a reference recording.
 *
 * Split out of the original Node service's `voiceCloneService.ts`: the same
 * SiliconFlow upload flow, now a tool, with the proxy and fetch made injectable
 * so it survives restrictive networks and can be tested offline.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

import { makeVoiceCloner } from './api.js'
import { makeCloneTool } from './tool.js'

export const name = 'amadeus-voice-clone'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  /** API root that serves `/uploads/audio/voice`. */
  baseUrl: string
  /** Bearer key. Empty reads `AMADEUS_SILICONFLOW_API_KEY`. */
  apiKey: string
  /** Clone model id. */
  model: string
  /** Per-request timeout. */
  timeoutMs: number
  /** Optional proxy URL for restricted networks. */
  proxyUrl: string
}

export const Config: z<Config> = z.object({
  baseUrl: z.string().default(process.env.AMADEUS_SILICONFLOW_BASE_URL ?? 'https://api.siliconflow.cn/v1'),
  apiKey: z.string().default(process.env.AMADEUS_SILICONFLOW_API_KEY ?? ''),
  model: z.string().default('FunAudioLLM/CosyVoice2-0.5B'),
  timeoutMs: z.number().default(300_000),
  proxyUrl: z.string().default(process.env.AMADEUS_PROXY_URL ?? ''),
})

export function apply(ctx: Context, config: Config): void {
  const cloner = makeVoiceCloner({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.timeoutMs,
    proxyUrl: config.proxyUrl || undefined,
  })

  ctx.tools.register(makeCloneTool(cloner))

  ctx.systemPrompt.section({
    name: 'tool:amadeus_voice_clone',
    order: 914,
    text:
      'When the user uploads a voice sample and asks to clone it, call `amadeus_clone_voice` with the file path, ' +
      'a name, and the exact words spoken in the recording. Ask for the transcript only if it is not obvious ' +
      'from the conversation; never invent it. The returned voice id is what `amadeus_speak` takes.',
  })
}
