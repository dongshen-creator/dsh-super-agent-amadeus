/**
 * @amadeus/stt — speech-to-text for the Amadeus voice loop.
 *
 * Split out of the original project's `stt/transcribe.py`: the Whisper call
 * becomes a tool, so the model can turn a recording into a user turn on demand.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

import { makeTranscriber } from './api.js'
import { makeTranscribeTool } from './tool.js'

export const name = 'amadeus-stt'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  /** OpenAI-compatible base URL that serves `/audio/transcriptions`. */
  baseUrl: string
  /** Bearer key. Empty reads `AMADEUS_WHISPER_API_KEY` from the environment. */
  apiKey: string
  /** Whisper model id. */
  model: string
  /** Default spoken-language hint; empty means auto-detect. */
  language: string
  /** Per-request timeout. */
  timeoutMs: number
}

export const Config: z<Config> = z.object({
  baseUrl: z.string().default(process.env.AMADEUS_WHISPER_BASE_URL ?? ''),
  apiKey: z.string().default(process.env.AMADEUS_WHISPER_API_KEY ?? ''),
  model: z.string().default(process.env.AMADEUS_WHISPER_MODEL ?? 'whisper-large-v3'),
  language: z.string().default(''),
  timeoutMs: z.number().default(120_000),
})

export function apply(ctx: Context, config: Config): void {
  const transcriber = makeTranscriber({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model,
    timeoutMs: config.timeoutMs,
  })

  ctx.tools.register(makeTranscribeTool(transcriber))

  ctx.systemPrompt.section({
    name: 'tool:amadeus_transcribe',
    order: 910,
    text:
      'When the user sends a voice recording or asks what was said in an audio file, call `amadeus_transcribe` ' +
      'with the file path instead of guessing the content. An empty transcript means silence: say so plainly ' +
      'and ask the user to repeat, do not invent words.',
  })
}
