/**
 * TTS contracts.
 *
 * The segmentation rules are the load-bearing part of the original project's
 * `utils/stream_utils.py`: text is cut at punctuation so synthesis can start
 * before the model finishes writing. Ported here as pure functions so the
 * browser player, the Node tool and the tests agree on the same segments.
 */

/** Punctuation that ends a speakable clause. */
const PUNCTUATION = /([,.?!，。？！;；])/

/** Default minimum segment length before a clause is released for synthesis. */
export const DEFAULT_MIN_SEGMENT_LENGTH = 15

/**
 * One synthesised clause.
 *
 * A type alias so it can be embedded in `SpeechMeta`, which must satisfy
 * `JsonValue` (interfaces get no implicit index signature).
 */
export type SpeechSegment = {
  /** Stable id; also the ordering key in the player. */
  readonly id: string
  /** Text sent to the synthesiser. */
  readonly text: string
  /** 1-based position in the utterance. */
  readonly index: number
}

/**
 * Split text into speakable segments at punctuation, merging clauses shorter
 * than `minLength` into the following one.
 *
 * Mirrors `split_text_by_punctuation` from the original project, with one
 * fix: a trailing stub shorter than two characters is dropped only when it has
 * no letters (the original dropped any 2-character tail, which ate "好。").
 */
export function splitForSpeech(text: string, minLength = DEFAULT_MIN_SEGMENT_LENGTH): string[] {
  if (text.trim() === '') return []

  const parts = text.split(PUNCTUATION)
  const merged: string[] = []
  for (let i = 0; i < parts.length; i += 1) {
    const current = parts[i] ?? ''
    const next = parts[i + 1]
    if (next !== undefined && PUNCTUATION.test(next)) {
      merged.push(current + next)
      i += 1
    } else if (current.trim() !== '') {
      merged.push(current)
    }
  }

  const result: string[] = []
  let buffer = ''
  for (const piece of merged) {
    if (buffer === '') {
      buffer = piece
      continue
    }
    const endsClause = /[,.?!，。？！;；]$/.test(buffer.trim())
    if (buffer.length >= minLength && endsClause) {
      result.push(buffer)
      buffer = piece
    } else {
      buffer += piece
    }
  }
  if (buffer !== '') result.push(buffer)

  return result
    .map((segment) => segment.trim())
    .filter((segment) => segment.length >= 2 || /[\p{L}\p{N}]/u.test(segment))
}

/** Attach stable ids and indices to raw segments. */
export function toSegments(text: string, minLength = DEFAULT_MIN_SEGMENT_LENGTH): SpeechSegment[] {
  return splitForSpeech(text, minLength).map((segment, index) => ({
    id: `seg-${index + 1}`,
    text: segment,
    index: index + 1,
  }))
}

/**
 * Presentation payload persisted on `tool/result` for the player card.
 *
 * A type alias with a mutable array so it satisfies the `JsonValue` return type
 * of `presentationMeta`.
 */
export type SpeechMeta = {
  readonly kind: 'amadeus-speech'
  readonly segments: SpeechSegment[]
  /** Full synthesised audio as a data URI (`audio/wav` or `audio/mpeg`). */
  readonly audio: string
  readonly mimeType: string
  readonly voice?: string
  readonly model?: string
  readonly durationSeconds?: number
  /** Total bytes of the encoded audio. */
  readonly byteLength: number
}

/** Narrow opaque persisted meta back to {@link SpeechMeta}. */
export function speechMetaFrom(meta: unknown): SpeechMeta | undefined {
  if (meta === null || typeof meta !== 'object') return undefined
  const record = meta as Record<string, unknown>
  if (record.kind !== 'amadeus-speech') return undefined
  if (typeof record.audio !== 'string' || typeof record.mimeType !== 'string') return undefined
  const segments = Array.isArray(record.segments)
    ? record.segments.filter(
        (item): item is SpeechSegment =>
          item !== null &&
          typeof item === 'object' &&
          typeof (item as SpeechSegment).id === 'string' &&
          typeof (item as SpeechSegment).text === 'string' &&
          typeof (item as SpeechSegment).index === 'number',
      )
    : []
  return {
    kind: 'amadeus-speech',
    segments,
    audio: record.audio,
    mimeType: record.mimeType,
    voice: typeof record.voice === 'string' ? record.voice : undefined,
    model: typeof record.model === 'string' ? record.model : undefined,
    durationSeconds: typeof record.durationSeconds === 'number' ? record.durationSeconds : undefined,
    byteLength: typeof record.byteLength === 'number' ? record.byteLength : 0,
  }
}

/** One-line summary for the model. */
export function summarizeSpeech(segments: number, byteLength: number, voice?: string): string {
  const kb = Math.max(1, Math.round(byteLength / 1024))
  const who = voice ? `（音色 ${voice}）` : ''
  return `已合成 ${segments} 段语音，共 ${kb} KB${who}，可在对话中的播放器里试听。`
}

/** Estimate spoken duration from PCM byte length at a given sample rate. */
export function estimateDurationSeconds(byteLength: number, sampleRate = 32_000, channels = 1): number {
  const bytesPerSample = 2
  if (byteLength <= 0) return 0
  return byteLength / (sampleRate * bytesPerSample * channels)
}
