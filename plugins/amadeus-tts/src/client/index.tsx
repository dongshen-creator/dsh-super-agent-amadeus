/**
 * Browser entry: own the `amadeus_speak` tool card.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: brings the `ctx.slots` Context augmentation into scope.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'

import { SpeechPlayerView } from './SpeechPlayer.js'

export const name = 'amadeus-tts'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register(
      { name: 'tool.call.toolview', key: 'amadeus_speak' },
      SpeechPlayerView,
    ),
  )
}
