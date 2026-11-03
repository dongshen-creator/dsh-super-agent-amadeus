/**
 * Emotion contracts.
 *
 * The original project asked an LLM to classify a reply into one of nine
 * Live2D motions. Those names, the prompt, and the fallback behaviour are
 * ported verbatim so the same model files still drive the same expressions.
 */

/** Motion names the Live2D model exposes (from `ai/emotion.py`). */
export const EMOTIONS = [
  'neutral',
  'anger',
  'joy',
  'sadness',
  'shy',
  'shy2',
  'smile1',
  'smile2',
  'unhappy',
] as const

export type Emotion = (typeof EMOTIONS)[number]

/** Default when classification fails — matches the original `predict_emotion`. */
export const DEFAULT_EMOTION: Emotion = 'neutral'

/** Classifier system prompt, copied from `ai/emotion.py`. */
export const EMOTION_SYSTEM_PROMPT =
  '你现在是一个虚拟形象的动作驱动器，你需要根据输入的虚拟形象的语言，驱动虚拟形象的动作和表情，请尽量输出得随机并丰富一些'

/** Whether a value is one of the nine motion names. */
export function isEmotion(value: unknown): value is Emotion {
  return typeof value === 'string' && (EMOTIONS as readonly string[]).includes(value)
}

/** Coerce any classifier output into a valid emotion, defaulting to neutral. */
export function normalizeEmotion(value: unknown): Emotion {
  return isEmotion(value) ? value : DEFAULT_EMOTION
}

/** Short human label used by the card. */
export const EMOTION_LABELS: Record<Emotion, string> = {
  neutral: '平静',
  anger: '生气',
  joy: '开心',
  sadness: '难过',
  shy: '害羞',
  shy2: '更害羞',
  smile1: '微笑',
  smile2: '笑',
  unhappy: '不高兴',
}

/** Emoji-free accent colour per emotion, used by the card. */
export const EMOTION_COLORS: Record<Emotion, string> = {
  neutral: 'rgba(148, 163, 184, 0.22)',
  anger: 'rgba(248, 113, 113, 0.22)',
  joy: 'rgba(250, 204, 21, 0.22)',
  sadness: 'rgba(96, 165, 250, 0.22)',
  shy: 'rgba(244, 114, 182, 0.22)',
  shy2: 'rgba(232, 121, 249, 0.22)',
  smile1: 'rgba(74, 222, 128, 0.22)',
  smile2: 'rgba(52, 211, 153, 0.22)',
  unhappy: 'rgba(251, 146, 60, 0.22)',
}

/**
 * Presentation payload persisted on `tool/result` for the emotion card.
 *
 * Declared as a type alias, not an interface: `presentationMeta` must return
 * `JsonValue`, and only type aliases get the implicit index signature that
 * makes an object assignable to `{ [key: string]: JsonValue }`.
 */
export type EmotionMeta = {
  readonly kind: 'amadeus-emotion'
  readonly emotion: Emotion
  readonly label: string
  readonly color: string
  /** The text that was classified, for context in the card. */
  readonly text: string
  /** True when the classifier answered with a valid motion name. */
  readonly confident: boolean
}

/** Narrow opaque persisted meta back to {@link EmotionMeta}. */
export function emotionMetaFrom(meta: unknown): EmotionMeta | undefined {
  if (meta === null || typeof meta !== 'object') return undefined
  const record = meta as Record<string, unknown>
  if (record.kind !== 'amadeus-emotion' || !isEmotion(record.emotion)) return undefined
  return {
    kind: 'amadeus-emotion',
    emotion: record.emotion,
    label: typeof record.label === 'string' ? record.label : EMOTION_LABELS[record.emotion],
    color: typeof record.color === 'string' ? record.color : EMOTION_COLORS[record.emotion],
    text: typeof record.text === 'string' ? record.text : '',
    confident: record.confident === true,
  }
}
