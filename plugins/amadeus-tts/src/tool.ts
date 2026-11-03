/**
 * The `amadeus_speak` tool: turn a reply into playable speech.
 */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'

import { toDataUri, type Synthesizer } from './api.js'
import {
  speechMetaFrom,
  summarizeSpeech,
  type SpeechMeta,
  type SpeechSegment,
} from './fragment.js'

export interface SpeakToolValue {
  text: string
  segments: SpeechSegment[]
  audio: string
  mimeType: string
  voice: string
  model: string
  durationSeconds: number
  byteLength: number
}

export interface SpeakToolOptions {
  /** Minimum clause length before a segment is released. */
  minSegmentLength: number
}

export function makeSpeakTool(synthesizer: Synthesizer, options: SpeakToolOptions): ToolDefinition {
  return defineTool({
    name: 'amadeus_speak',
    description:
      'Synthesise a reply into speech and show an audio player in the conversation. ' +
      'Use when the user asks to hear something spoken, or when you are replying inside the Amadeus voice conversation. ' +
      'Pass the exact text to be spoken; it is split at punctuation and synthesised clause by clause.',
    parameters: {
      text: {
        type: 'string',
        required: true,
        description: 'The exact text to speak aloud. Plain prose only: no Markdown, no lists, no code.',
      },
      voice: {
        type: 'string',
        description: 'Optional voice id overriding the configured default, e.g. a cloned voice id.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
          segments: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                text: { type: 'string', required: true },
                index: { type: 'number', required: true },
              },
            },
          },
          audio: { type: 'string', required: true },
          mimeType: { type: 'string', required: true },
          voice: { type: 'string', required: true },
          model: { type: 'string', required: true },
          durationSeconds: { type: 'number', required: true },
          byteLength: { type: 'number', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (_args, value): SpeechMeta => ({
        kind: 'amadeus-speech',
        segments: value.segments,
        audio: value.audio,
        mimeType: value.mimeType,
        voice: value.voice,
        model: value.model,
        durationSeconds: value.durationSeconds,
        byteLength: value.byteLength,
      }),
    },
    isConcurrencySafe: () => true,
    presentCall: (args) => ({
      card: 'generic',
      title: '合成语音',
      kind: 'execute',
      input: { text: args.text.length > 80 ? `${args.text.slice(0, 80)}…` : args.text },
    }),
    presentResult: (_args, result) => {
      if (result.isError) return undefined
      const meta = speechMetaFrom(result.meta)
      if (meta === undefined) return undefined
      const seconds = meta.durationSeconds ? meta.durationSeconds.toFixed(1) : '?'
      return { card: 'generic', title: `语音 · ${meta.segments.length} 段 · ${seconds}s` }
    },
    async execute(args) {
      const text = typeof args.text === 'string' ? args.text.trim() : ''
      if (text === '') throw new Error('amadeus_speak: `text` is required')

      const result = await synthesizer.synthesize(text, options.minSegmentLength)
      const audio = toDataUri(result.wav, result.mimeType)
      const voice = typeof args.voice === 'string' && args.voice.trim() !== ''
        ? args.voice.trim()
        : result.voice

      const value: SpeakToolValue = {
        text: summarizeSpeech(result.segments.length, result.wav.byteLength, voice),
        segments: result.segments,
        audio,
        mimeType: result.mimeType,
        voice,
        model: result.model,
        durationSeconds: Number(result.durationSeconds.toFixed(2)),
        byteLength: result.wav.byteLength,
      }
      return value
    },
  })
}
