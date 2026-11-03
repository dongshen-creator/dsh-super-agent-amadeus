/**
 * Proactive-planning contracts.
 *
 * The original `ActionPlanner` let an LLM pick one of five self-initiated moves
 * and fell back to `share_memory` on any failure. Both the vocabulary and the
 * fallback are reproduced here.
 */

/** The five moves from `ai/plan.py`. */
export const ACTIONS = [
  'continue_topic',
  'change_topic',
  'ask_question',
  'share_memory',
  'express_emotion',
] as const

export type Action = (typeof ACTIONS)[number]

/** Default when planning fails — matches `plan_next_action`. */
export const DEFAULT_ACTION: Action = 'share_memory'

/** Planner system prompt, copied from `ai/plan.py`. */
export const PLANNER_SYSTEM_PROMPT =
  '你现在是一个智能体的主动行动模块部分，根据当前智能体和用户的上下文，为我的智能体随机选择下一步行动'

export function isAction(value: unknown): value is Action {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value)
}

/** Coerce classifier output into a valid action, defaulting to share_memory. */
export function normalizeAction(value: unknown): Action {
  return isAction(value) ? value : DEFAULT_ACTION
}

/** Guidance handed to the model for each move. */
export const ACTION_GUIDES: Record<Action, string> = {
  continue_topic: '顺着刚才的话题再补一句，把对话往前推。',
  change_topic: '换一个相关但不同的话题，给对话一个新方向。',
  ask_question: '向用户提一个具体的问题，把话头交回给对方。',
  share_memory: '提起一件与当前情境相关的记忆或见闻。',
  express_emotion: '表达自己此刻的感受，让对话带上情绪。',
}

/** Human label for the card. */
export const ACTION_LABELS: Record<Action, string> = {
  continue_topic: '继续话题',
  change_topic: '切换话题',
  ask_question: '提问',
  share_memory: '分享记忆',
  express_emotion: '表达情感',
}

/**
 * Build the instruction the model receives when a proactive move fires.
 *
 * The original sent the literal string `[AI主动发起对话]next Action: <action>`
 * as the user turn; the same marker is kept so an existing persona prompt that
 * keys on it continues to work.
 */
export function buildProactivePrompt(action: Action): string {
  return `[AI主动发起对话]next Action: ${action}`
}

/**
 * Presentation payload persisted on `tool/result` for the plan card.
 *
 * A type alias because `presentationMeta` must return `JsonValue`, and only
 * aliases receive the implicit index signature that satisfies it.
 */
export type ProactiveMeta = {
  readonly kind: 'amadeus-proactive'
  readonly action: Action
  readonly label: string
  readonly guide: string
  readonly prompt: string
  /** True when the planner answered with a valid action. */
  readonly confident: boolean
}

/** Narrow opaque persisted meta back to {@link ProactiveMeta}. */
export function proactiveMetaFrom(meta: unknown): ProactiveMeta | undefined {
  if (meta === null || typeof meta !== 'object') return undefined
  const record = meta as Record<string, unknown>
  if (record.kind !== 'amadeus-proactive' || !isAction(record.action)) return undefined
  return {
    kind: 'amadeus-proactive',
    action: record.action,
    label: typeof record.label === 'string' ? record.label : ACTION_LABELS[record.action],
    guide: typeof record.guide === 'string' ? record.guide : ACTION_GUIDES[record.action],
    prompt: typeof record.prompt === 'string' ? record.prompt : buildProactivePrompt(record.action),
    confident: record.confident === true,
  }
}
