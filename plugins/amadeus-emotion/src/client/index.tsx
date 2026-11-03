/**
 * Browser entry: own the `amadeus_emotion` tool card.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: brings the `ctx.slots` Context augmentation into scope.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'

import { EmotionBadgeView } from './EmotionBadge.js'

export const name = 'amadeus-emotion'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register(
      { name: 'tool.call.toolview', key: 'amadeus_emotion' },
      EmotionBadgeView,
    ),
  )
}
