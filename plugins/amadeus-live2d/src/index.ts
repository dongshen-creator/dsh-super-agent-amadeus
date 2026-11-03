/**
 * @amadeus/live2d — the avatar stage.
 *
 * Split out of the original client's `components/Live2dModel` and
 * `constants/live2d.ts`. The Node side owns placement math and the idle
 * animation state machine; the browser card draws a self-contained stage because
 * the harness sandbox forbids remote Live2D runtimes.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

import { DEFAULT_ROLE } from './fragment.js'
import { makeStageTool } from './tool.js'

export const name = 'amadeus-live2d'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  /** Character role shown when the caller does not name one. */
  role: string
  /** Reference width used to recentre the avatar, matching the original 1620px layout. */
  referenceWidth: number
}

export const Config: z<Config> = z.object({
  role: z.string().default(DEFAULT_ROLE),
  referenceWidth: z.number().default(1620),
})

export function apply(ctx: Context, config: Config): void {
  ctx.tools.register(makeStageTool({ defaultRole: config.role }))

  ctx.systemPrompt.section({
    name: 'tool:amadeus_stage',
    order: 916,
    text:
      'You can show the Amadeus character as a stage card. Call `amadeus_stage` when the user asks to see the ' +
      'avatar, when the character should visibly react, or right after `amadeus_emotion` if you want the pose ' +
      'mirrored on the stage. Pass the emotion you just chose so the drawn face matches. Do not describe the ' +
      'tool or the model path in your reply — just react in character.',
  })
}
