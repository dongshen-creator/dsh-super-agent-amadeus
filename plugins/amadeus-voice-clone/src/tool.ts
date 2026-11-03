/**
 * The `amadeus_clone_voice` tool.
 */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'

import type { VoiceCloner } from './api.js'
import { voiceCloneMetaFrom, type VoiceCloneMeta } from './fragment.js'

export interface CloneToolValue {
  text: string
  voiceId: string
  name: string
  model: string
  referenceText: string
  byteLength: number
  format: string
}

export function makeCloneTool(cloner: VoiceCloner): ToolDefinition {
  return defineTool({
    name: 'amadeus_clone_voice',
    description:
      'Register a custom voice from a reference recording so replies can be spoken in that voice. ' +
      'Use when the user uploads a voice sample and asks to clone it, or asks to change the assistant voice. ' +
      'Requires the exact words spoken in the recording. Returns the voice id to pass to amadeus_speak.',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the reference recording on the host (wav, mp3, m4a or flac).',
      },
      referenceText: {
        type: 'string',
        required: true,
        description: 'The exact words spoken in the recording, verbatim (max 500 characters).',
      },
      name: {
        type: 'string',
        required: true,
        description: 'Name for the new voice, e.g. "kurisu".',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
          voiceId: { type: 'string', required: true },
          name: { type: 'string', required: true },
          model: { type: 'string', required: true },
          referenceText: { type: 'string', required: true },
          byteLength: { type: 'number', required: true },
          format: { type: 'string', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (args, value): VoiceCloneMeta => ({
        kind: 'amadeus-voice-clone',
        voiceId: value.voiceId,
        name: value.name,
        model: value.model,
        referenceText: typeof args.referenceText === 'string' ? args.referenceText : value.referenceText,
        byteLength: value.byteLength,
        format: value.format,
      }),
    },
    isConcurrencySafe: () => false,
    presentCall: (args) => ({
      card: 'generic',
      title: '克隆音色',
      kind: 'execute',
      input: { path: args.path, name: args.name },
    }),
    presentResult: (_args, result) => {
      if (result.isError) return undefined
      const meta = voiceCloneMetaFrom(result.meta)
      if (meta === undefined) return undefined
      return { card: 'generic', title: `音色已创建 · ${meta.name}` }
    },
    async execute(args) {
      const path = typeof args.path === 'string' ? args.path.trim() : ''
      if (path === '') throw new Error('amadeus_voice_clone: `path` is required')

      const result = await cloner.clone({
        path,
        referenceText: typeof args.referenceText === 'string' ? args.referenceText : '',
        name: typeof args.name === 'string' ? args.name : '',
      })

      return {
        text:
          `音色已创建：${result.name}。音色 id：${result.voiceId}。` +
          '需要用它说话时，把该 id 作为 amadeus_speak 的 voice 参数传入。',
        voiceId: result.voiceId,
        name: result.name,
        model: result.model,
        referenceText: result.referenceText,
        byteLength: result.byteLength,
        format: result.format,
      }
    },
  })
}
