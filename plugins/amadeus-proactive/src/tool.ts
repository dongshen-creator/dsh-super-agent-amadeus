/**
 * The `amadeus_proactive_plan` tool: pick the character's next self-initiated move.
 */
import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'

import type { Planner, Turn } from './api.js'
import {
  ACTIONS,
  ACTION_GUIDES,
  ACTION_LABELS,
  buildProactivePrompt,
  proactiveMetaFrom,
  type Action,
  type ProactiveMeta,
} from './fragment.js'

export interface ProactiveToolValue {
  text: string
  action: Action
  label: string
  guide: string
  prompt: string
  confident: boolean
}

export function makeProactiveTool(planner: Planner): ToolDefinition {
  return defineTool({
    name: 'amadeus_proactive_plan',
    description:
      'Decide what the Amadeus character should do next when the user has gone quiet and the character should ' +
      'speak first. Picks one of five moves: continue_topic, change_topic, ask_question, share_memory, ' +
      'express_emotion. Use only for self-initiated turns, never in the middle of an active exchange. ' +
      'The returned `prompt` is the exact instruction to act on.',
    parameters: {
      recent: {
        type: 'array',
        description:
          'Recent conversation turns, oldest first, as objects with `role` (user or assistant) and `content`. ' +
          'Pass an empty array if there is no history yet.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            role: { type: 'string', required: true, enum: ['user', 'assistant'] },
            content: { type: 'string', required: true },
          },
        },
      },
      situation: {
        type: 'string',
        description:
          'Optional one-line note about the current situation (what the user is doing, how long the silence ' +
          'lasted). Used only as planner context.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', required: true },
          action: { type: 'string', required: true, enum: [...ACTIONS] },
          label: { type: 'string', required: true },
          guide: { type: 'string', required: true },
          prompt: { type: 'string', required: true },
          confident: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
      presentationMeta: (args, value): ProactiveMeta => ({
        kind: 'amadeus-proactive',
        action: value.action,
        label: value.label,
        guide: value.guide,
        prompt: value.prompt,
        confident: value.confident,
      }),
    },
    isConcurrencySafe: () => true,
    presentCall: () => ({
      card: 'generic',
      title: '规划主动对话',
      kind: 'other',
    }),
    presentResult: (_args, result) => {
      if (result.isError) return undefined
      const meta = proactiveMetaFrom(result.meta)
      if (meta === undefined) return undefined
      return { card: 'generic', title: `主动对话 · ${meta.label}` }
    },
    async execute(args) {
      const history = toHistory(args.recent)
      const situation = typeof args.situation === 'string' ? args.situation.trim() : ''
      const turns: Turn[] = situation === ''
        ? history
        : [...history, { role: 'system', content: `当前情境：${situation}` }]

      const plan = await planner.plan(turns)
      const label = ACTION_LABELS[plan.action]
      const guide = ACTION_GUIDES[plan.action]
      const prompt = buildProactivePrompt(plan.action)

      return {
        text: plan.confident
          ? `主动行动：${plan.action}（${label}）。${guide}`
          : `主动行动回退为 ${plan.action}（${label}）：规划器未返回有效动作名。${guide}`,
        action: plan.action,
        label,
        guide,
        prompt,
        confident: plan.confident,
      }
    },
  })
}

/**
 * Models sometimes hand back turns as strings rather than objects. Keep only
 * well-formed turns so a malformed item cannot poison the planner request.
 */
function toHistory(value: unknown): Turn[] {
  if (!Array.isArray(value)) return []
  const turns: Turn[] = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const role = record.role
    const content = record.content
    if (typeof content !== 'string' || content.trim() === '') continue
    if (role !== 'user' && role !== 'assistant' && role !== 'system') continue
    turns.push({ role, content })
  }
  return turns
}
