/**
 * Composite browser entry for dsh-super-agent-amadeus.
 *
 * The bundle serves ONE client.js, so this apply brings up both halves:
 *
 * 1. The upstream Super-agent web panel (vendored, wrapper lifted into
 *    `superAgentClientFactory`; it only requires `react` from the seeds).
 * 2. The three Amadeus toolview cards (speech player, emotion badge, stage),
 *    re-using the plugin sources under plugins/ verbatim.
 */
import React from 'react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'

import { superAgentClientFactory } from './super-agent-client.js'
import { apply as ttsClientApply } from '../../plugins/amadeus-tts/src/client/index.js'
import { apply as emotionClientApply } from '../../plugins/amadeus-emotion/src/client/index.js'
import { apply as live2dClientApply } from '../../plugins/amadeus-live2d/src/client/index.js'

export const name = 'dsh-super-agent-amadeus'
/** Superset of the upstream panel's `['sessions', 'slots', 'locale']` and the toolviews' `['slots']`. */
export const inject = ['sessions', 'slots', 'locale']

export function apply(ctx: ClientContext): void {
  // 1) Super-agent panel — unchanged upstream behaviour.
  const superAgent = superAgentClientFactory((id: string) => {
    if (id === 'react') return React
    throw new Error(`dsh-super-agent-amadeus client: unsupported seed module ${id}`)
  })
  superAgent.apply(ctx)

  // 2) Amadeus toolviews, keyed by tool name.
  ttsClientApply(ctx)
  emotionClientApply(ctx)
  live2dClientApply(ctx)
}
