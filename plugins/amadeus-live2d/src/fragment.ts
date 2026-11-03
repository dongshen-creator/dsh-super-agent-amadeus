/**
 * Avatar-stage contracts.
 *
 * Two things are ported verbatim from the original client:
 *
 * 1. `AnimationControl` (idle head sway, eye drift, blink) — reproduced as a
 *    pure state machine so both the browser renderer and the tests drive the
 *    same numbers.
 * 2. The model table and placement math from `constants/live2d.ts` plus
 *    `Live2dModel/index.tsx` (`x = x1 + (innerWidth - 1620) / 2`, mobile uses
 *    the `2` variant of every field).
 *
 * Deliberately no Live2D runtime: the harness sandbox forbids remote scripts and
 * third-party CDNs, so the card draws its own stage and reports the model URL.
 */

/** One character model entry, same fields as the original mapper. */
export interface Live2dModelEntry {
  readonly path: string
  readonly scale1: number
  readonly scale2: number
  readonly x1: number
  readonly x2: number
  readonly y1: number
  readonly y2: number
}

/** Ported from `src/constants/live2d.ts` without changes. */
export const LIVE2D_MODELS: Record<string, Live2dModelEntry> = {
  牧濑红莉栖: {
    path: 'https://static.amadeus-web.top/live2dmodels/steinsGateKurisuNew/红莉栖.model3.json',
    scale1: 0.42,
    scale2: 0.42,
    x1: 550,
    x2: -100,
    y1: 50,
    y2: 20,
  },
}

/** Role used when the caller names one we do not have a model for. */
export const DEFAULT_ROLE = '牧濑红莉栖'

/** The two reference widths the original subtracts the viewport from. */
export const REFERENCE_VIEWPORT = { desktop: 1620, mobile: 380 } as const

export interface StageLayout {
  readonly role: string
  readonly modelPath: string
  readonly scale: number
  readonly x: number
  readonly y: number
  readonly mobile: boolean
  readonly viewportWidth: number
}

export interface StageLayoutOverride {
  readonly scale1?: number
  readonly scale2?: number
  readonly x1?: number
  readonly x2?: number
  readonly y1?: number
  readonly y2?: number
}

/**
 * Reproduce `model.x = config.x1 + (window.innerWidth - 1620) / 2` (and the
 * mobile branch). Unknown roles fall back to the default model.
 */
export function computeStageLayout(
  role: string | undefined,
  viewportWidth: number,
  mobile = false,
  override?: StageLayoutOverride,
): StageLayout {
  const key = role !== undefined && role in LIVE2D_MODELS ? role : DEFAULT_ROLE
  const base = LIVE2D_MODELS[key] as Live2dModelEntry
  const entry: Live2dModelEntry = { ...base, ...stripUndefined(override) }
  const width = Number.isFinite(viewportWidth) && viewportWidth > 0
    ? viewportWidth
    : REFERENCE_VIEWPORT.desktop

  if (mobile) {
    return {
      role: key,
      modelPath: entry.path,
      scale: entry.scale2,
      x: entry.x2 + (width - REFERENCE_VIEWPORT.mobile) / 2,
      y: entry.y2,
      mobile: true,
      viewportWidth: width,
    }
  }

  return {
    role: key,
    modelPath: entry.path,
    scale: entry.scale1,
    x: entry.x1 + (width - REFERENCE_VIEWPORT.desktop) / 2,
    y: entry.y1,
    mobile: false,
    viewportWidth: width,
  }
}

function stripUndefined(value: StageLayoutOverride | undefined): StageLayoutOverride {
  if (value === undefined) return {}
  const out: Record<string, number> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'number' && Number.isFinite(item)) out[key] = item
  }
  return out
}

/** The nine expressions `emotion.py` can emit, plus the reset sentinel. */
export const EXPRESSIONS = [
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

export type Expression = (typeof EXPRESSIONS)[number]

export function isExpression(value: unknown): value is Expression {
  return typeof value === 'string' && (EXPRESSIONS as readonly string[]).includes(value)
}

/**
 * `handleEmotion` in the original: `neutral` resets the expression, anything
 * containing `random` also resets. Returns the expression to apply, or `''`
 * to mean "reset".
 */
export function resolveExpression(emotion: string | undefined): Expression | '' {
  if (emotion === undefined || emotion === '') return ''
  if (emotion.includes('random')) return ''
  if (emotion === 'neutral') return ''
  return isExpression(emotion) ? emotion : ''
}

/** Idle motions the original cycles through while speaking or thinking. */
export const RANDOM_MOTIONS = ['random1', 'random2', 'random3', 'random4', 'random5'] as const

/**
 * `playRandomMotion` / `handleMotion`: `speaking` and `thinking` pick a random
 * idle motion, everything else plays the named motion.
 */
export function resolveMotion(motion: string | undefined, random: () => number = Math.random): string {
  if (motion === undefined || motion === '') return ''
  if (motion === 'speaking' || motion === 'thinking') {
    const index = Math.min(
      RANDOM_MOTIONS.length - 1,
      Math.floor(random() * RANDOM_MOTIONS.length),
    )
    return RANDOM_MOTIONS[index] as string
  }
  return motion
}

/** Mutable-by-replacement idle-animation state. */
export interface IdleState {
  readonly headMove: number
  readonly head: readonly [number, number, number]
  readonly targetHead: readonly [number, number, number]
  readonly eyeMove: number
  readonly eyes: readonly [number, number]
  readonly targetEyes: readonly [number, number]
  readonly blinkTime: number
  readonly eyeLids: readonly [number, number]
  readonly blinkState: 'Open' | 'Blink'
}

export const IDLE_LIMITS = {
  headMin: [-12, -12, -12] as const,
  headMax: [12, 12, 12] as const,
  headSpeed: [1000, 2000] as const,
  eyesMin: [-0.5, -0.5] as const,
  eyesMax: [0.5, 0.5] as const,
  eyesSpeed: [1000, 2000] as const,
  blinkSpeed: [5000, 5000] as const,
  blinkLength: 100,
  lerpFactor: 0.1,
} as const

/** Same initial values as the `Animation_Control` constructor. */
export function createIdleState(): IdleState {
  return {
    headMove: 0,
    head: [0, 0, 0],
    targetHead: [0, 0, 0],
    eyeMove: 0,
    eyes: [0, 0],
    // The original seeds this to [-20, 20], outside `eyesMin/eyesMax`; the first
    // step retargets immediately, so the value never reaches the model.
    targetEyes: [-20, 20],
    blinkTime: 0,
    eyeLids: [1, 1],
    blinkState: 'Open',
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function randomBetween(min: number, max: number, random: () => number): number {
  return random() * (max - min) + min
}

/**
 * Advance the idle animation by one tick, exactly like `head_movement`,
 * `eyes_movement` and `eyes_lid_movement` do.
 *
 * The original wrapped all of this in `if (this.eye_lids_state === 'Blink')`,
 * but that field is assigned once in the constructor and never mutated, so the
 * guard is always true; it is dropped here with no behaviour change.
 */
export function stepIdle(
  state: IdleState,
  currentTime: number,
  random: () => number = Math.random,
): IdleState {
  const { lerpFactor, headSpeed, headMin, headMax, eyesSpeed, eyesMin, eyesMax, blinkSpeed, blinkLength } =
    IDLE_LIMITS

  let headMove = state.headMove
  let targetHead = state.targetHead
  if (currentTime > headMove) {
    headMove = currentTime + randomBetween(headSpeed[0], headSpeed[1], random)
    targetHead = [
      randomBetween(headMin[0], headMax[0], random),
      randomBetween(headMin[1], headMax[1], random),
      randomBetween(headMin[2], headMax[2], random),
    ]
  }
  const head: [number, number, number] = [
    lerp(state.head[0], targetHead[0], lerpFactor),
    lerp(state.head[1], targetHead[1], lerpFactor),
    lerp(state.head[2], targetHead[2], lerpFactor),
  ]

  let eyeMove = state.eyeMove
  let targetEyes = state.targetEyes
  if (currentTime > eyeMove) {
    eyeMove = currentTime + randomBetween(eyesSpeed[0], eyesSpeed[1], random)
    targetEyes = [
      randomBetween(eyesMin[0], eyesMax[0], random),
      randomBetween(eyesMin[1], eyesMax[1], random),
    ]
  }
  const eyes: [number, number] = [
    lerp(state.eyes[0], targetEyes[0], lerpFactor),
    lerp(state.eyes[1], targetEyes[1], lerpFactor),
  ]

  let blinkTime = state.blinkTime
  let eyeLids = state.eyeLids
  let blinkState = state.blinkState
  if (blinkState === 'Blink' && currentTime > blinkTime) {
    blinkTime = currentTime + randomBetween(blinkSpeed[0], blinkSpeed[1], random)
    eyeLids = [1, 1]
    blinkState = 'Open'
  } else if (currentTime > blinkTime) {
    blinkTime = currentTime + blinkLength
    eyeLids = [0, 0]
    blinkState = 'Blink'
  }

  return { headMove, head, targetHead, eyeMove, eyes, targetEyes, blinkTime, eyeLids, blinkState }
}

/** Parameter names and values pushed into the model each tick. */
export function buildParameterValues(state: IdleState): Array<{ name: string; value: number }> {
  return [
    { name: 'ParamAngleX', value: state.head[0] },
    { name: 'ParamAngleY', value: state.head[1] },
    { name: 'ParamAngleZ', value: state.head[2] },
    { name: 'ParamBodyAngleX', value: state.head[0] / 10 },
    { name: 'ParamBodyAngleY', value: state.head[1] / 10 },
    { name: 'ParamBodyAngleZ', value: state.head[2] / 10 },
    { name: 'ParamEyeBallX', value: state.eyes[0] },
    { name: 'ParamEyeBallY', value: state.eyes[1] },
    { name: 'ParamEyeLOpen', value: state.eyeLids[0] },
    { name: 'ParamEyeROpen', value: state.eyeLids[1] },
  ]
}

/**
 * Presentation payload persisted on `tool/result` for the stage card.
 *
 * A type alias (not an interface) so it satisfies the `JsonValue` return type of
 * `presentationMeta`; the mutable array is required for the same reason.
 */
export type StageMeta = {
  readonly kind: 'amadeus-live2d'
  readonly role: string
  readonly modelPath: string
  readonly scale: number
  readonly x: number
  readonly y: number
  readonly mobile: boolean
  readonly emotion: string
  readonly motion: string
  readonly expression: string
  readonly parameters: Array<{ name: string; value: number }>
}

/** Narrow opaque persisted meta back to {@link StageMeta}. */
export function stageMetaFrom(meta: unknown): StageMeta | undefined {
  if (meta === null || typeof meta !== 'object') return undefined
  const record = meta as Record<string, unknown>
  if (record.kind !== 'amadeus-live2d') return undefined
  if (typeof record.role !== 'string' || typeof record.modelPath !== 'string') return undefined
  if (typeof record.scale !== 'number' || typeof record.x !== 'number' || typeof record.y !== 'number') {
    return undefined
  }
  return {
    kind: 'amadeus-live2d',
    role: record.role,
    modelPath: record.modelPath,
    scale: record.scale,
    x: record.x,
    y: record.y,
    mobile: record.mobile === true,
    emotion: typeof record.emotion === 'string' ? record.emotion : '',
    motion: typeof record.motion === 'string' ? record.motion : '',
    expression: typeof record.expression === 'string' ? record.expression : '',
    parameters: normalizeParameters(record.parameters),
  }
}

function normalizeParameters(value: unknown): Array<{ name: string; value: number }> {
  if (!Array.isArray(value)) return []
  const out: Array<{ name: string; value: number }> = []
  for (const item of value) {
    if (item === null || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.name !== 'string' || typeof record.value !== 'number') continue
    out.push({ name: record.name, value: record.value })
  }
  return out
}
