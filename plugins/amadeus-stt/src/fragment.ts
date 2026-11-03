/**
 * Speech-to-text contracts.
 *
 * Pure helpers shared by the Node tool, the browser toolview and the tests:
 * they decide how audio input is described and how a transcript is normalised.
 * No network, no filesystem — those live in `client.ts`.
 */

/** Audio formats the Whisper-compatible endpoints in this project accept. */
export type AudioFormat = 'wav' | 'mp3' | 'm4a' | 'webm' | 'ogg' | 'flac'

const FORMAT_BY_EXTENSION: Record<string, AudioFormat> = {
  '.wav': 'wav',
  '.mp3': 'mp3',
  '.m4a': 'm4a',
  '.webm': 'webm',
  '.ogg': 'ogg',
  '.flac': 'flac',
}

/** MIME type used when the caller only supplies a container format. */
const MIME_BY_FORMAT: Record<AudioFormat, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
}

/** Detect a supported audio format from a filename, or `undefined`. */
export function formatFromFilename(filename: string): AudioFormat | undefined {
  const dot = filename.lastIndexOf('.')
  if (dot < 0) return undefined
  return FORMAT_BY_EXTENSION[filename.slice(dot).toLowerCase()]
}

/** Map a format onto the MIME type a multipart upload should declare. */
export function mimeForFormat(format: AudioFormat): string {
  return MIME_BY_FORMAT[format]
}

/** Sniff a supported audio format from the first bytes of a buffer. */
export function formatFromMagicBytes(bytes: Uint8Array): AudioFormat | undefined {
  // RIFF....WAVE
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
  ) {
    return 'wav'
  }
  // ID3-tagged or raw MPEG frame sync
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return 'mp3'
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) {
    return 'mp3'
  }
  // OggS
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53
  ) {
    return 'ogg'
  }
  // EBML (WebM/Matroska)
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  ) {
    return 'webm'
  }
  // fLaC
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43
  ) {
    return 'flac'
  }
  // ....ftyp (ISO base media: m4a/mp4)
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'm4a'
  }
  return undefined
}

/**
 * Normalise a transcription response body.
 *
 * Whisper-compatible servers return either `{ text }` or a raw string, and some
 * proxies wrap it. Anything unexpected degrades to the empty string, matching
 * the original `transcribe()` behaviour (a failed STT yields no user turn).
 */
export function extractTranscript(payload: unknown): string {
  if (typeof payload === 'string') return payload.trim()
  if (payload !== null && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (typeof record.text === 'string') return record.text.trim()
  }
  return ''
}

/**
 * Decide whether a transcript is usable as a user turn.
 *
 * Voice activity detection upstream already trims silence; this guard drops
 * what Whisper hallucinates on near-silent audio (a lone "." or "[Music]").
 */
export function isUsableTranscript(text: string): boolean {
  const stripped = text.replace(/[\s.,!?;:'"()[\]{}<>-]/g, '')
  if (stripped.length === 0) return false
  if (/^\[(music|noise|silence|blank_audio)\]$/i.test(text.trim())) return false
  return true
}

/** Summarise a transcript for the model-facing one-liner. */
export function summarizeTranscript(text: string, language?: string): string {
  const preview = text.length > 120 ? `${text.slice(0, 120)}…` : text
  return language ? `转录完成（${language}）：${preview}` : `转录完成：${preview}`
}

/**
 * Presentation payload persisted on `tool/result` for the transcript card.
 *
 * A type alias so it satisfies the `JsonValue` return type of
 * `presentationMeta` (interfaces get no implicit index signature).
 */
export type TranscriptMeta = {
  readonly kind: 'amadeus-transcript'
  readonly text: string
  readonly language?: string
  readonly durationSeconds?: number
  readonly model?: string
  readonly usable: boolean
}

/** Narrow opaque persisted meta back to {@link TranscriptMeta}. */
export function transcriptMetaFrom(meta: unknown): TranscriptMeta | undefined {
  if (meta === null || typeof meta !== 'object') return undefined
  const record = meta as Record<string, unknown>
  if (record.kind !== 'amadeus-transcript' || typeof record.text !== 'string') return undefined
  return {
    kind: 'amadeus-transcript',
    text: record.text,
    language: typeof record.language === 'string' ? record.language : undefined,
    durationSeconds: typeof record.durationSeconds === 'number' ? record.durationSeconds : undefined,
    model: typeof record.model === 'string' ? record.model : undefined,
    usable: record.usable === true,
  }
}
