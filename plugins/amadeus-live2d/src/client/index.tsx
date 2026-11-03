/**
 * Browser entry: own the `amadeus_stage` tool card.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: brings the `ctx.slots` Context augmentation into scope.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'

import { StageView } from './StageView.js'

export const name = 'amadeus-live2d'
export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register(
      { name: 'tool.call.toolview', key: 'amadeus_stage' },
      StageView,
    ),
  )
}
