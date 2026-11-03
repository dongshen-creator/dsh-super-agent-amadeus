/**
 * @amadeus/tts — text-to-speech for the Amadeus voice loop.
 *
 * Split out of the original project's `tts/speech.py` + `utils/stream_utils.py`:
 * punctuation segmentation becomes a shared contract, the CosyVoice2 call
 * becomes a tool, and the audio is presented as a player card.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

import { makeSynthesizer } from './api.js'
import { DEFAULT_MIN_SEGMENT_LENGTH } from './fragment.js'
import { makeSpeakTool } from './tool.js'

export const name = 'amadeus-tts'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  /** SiliconFlow-compatible base URL. */
  baseUrl: string
  /** Bearer key. Empty reads `AMADEUS_SILICONFLOW_API_KEY`. */
  apiKey: string
  /** Voice id used when the tool call does not override it. */
  voice: string
  /** Model id. */
  model: string
  /** PCM sample rate requested from the API. */
  sampleRate: number
  /** Per-clause request timeout. */
  timeoutMs: number
  /** Minimum clause length released for synthesis. */
  minSegmentLength: number
}

export const Config: z<Config> = z.object({
  baseUrl: z.string().default(process.env.AMADEUS_SILICONFLOW_BASE_URL ?? 'https://api.siliconflow.cn/v1'),
  apiKey: z.string().default(process.env.AMADEUS_SILICONFLOW_API_KEY ?? ''),
  voice: z
    .string()
    .default(
      process.env.AMADEUS_SILICONFLOW_VOICE ??
        'speech:siliconflow-kurisu:clzv7bjjm041fufyct2z0setm:mphrsbbmvrjfophbsted',
    ),
  model: z.string().default('FunAudioLLM/CosyVoice2-0.5B'),
  sampleRate: z.number().default(32_000),
  timeoutMs: z.number().default(120_000),
  minSegmentLength: z.number().default(DEFAULT_MIN_SEGMENT_LENGTH),
})

export function apply(ctx: Context, config: Config): void {
  const synthesizer = makeSynthesizer({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    voice: config.voice,
    model: config.model,
    sampleRate: config.sampleRate,
    timeoutMs: config.timeoutMs,
  })

  ctx.tools.register(
    makeSpeakTool(synthesizer, { minSegmentLength: config.minSegmentLength }),
  )

  ctx.systemPrompt.section({
    name: 'tool:amadeus_speak',
    order: 911,
    text:
      'When the user asks to hear a reply aloud, or inside the Amadeus voice conversation, call `amadeus_speak` ' +
      'with the exact text to speak. Pass plain prose: the tool splits it at punctuation and shows an audio player. ' +
      'Do not paste Markdown into `text` — it is read literally.',
  })
}
