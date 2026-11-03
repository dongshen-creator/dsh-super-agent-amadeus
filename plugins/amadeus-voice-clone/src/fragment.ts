/**
 * Voice-clone contracts.
 *
 * The original cloned voices by POSTing a multipart form to SiliconFlow. The
 * rules worth pinning are: which audio forms are accepted, what a valid voice id
 * looks like, and how a reference recording is turned into the base64 payload
 * the API expects.
 */

/** Audio formats accepted as a cloning reference. */
export const REFERENCE_FORMATS = ['wav', 'mp3', 'm4a', 'flac'] as const
export type ReferenceFormat = (typeof REFERENCE_FORMATS)[number]

const EXTENSION_TO_FORMAT: Record<string, ReferenceFormat> = {
  '.wav': 'wav',
  '.mp3': 'mp3',
  '.m4a': 'm4a',
  '.flac': 'flac',
}

const MIME_BY_FORMAT: Record<ReferenceFormat, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
}

/** Detect a supported reference format from a filename. */
export function referenceFormatFrom(filename: string): ReferenceFormat | undefined {
  const dot = filename.lastIndexOf('.')
  if (dot < 0) return undefined
  return EXTENSION_TO_FORMAT[filename.slice(dot).toLowerCase()]
}

/** MIME type for a reference format. */
export function referenceMime(format: ReferenceFormat): string {
  return MIME_BY_FORMAT[format]
}

/** The transcript that must accompany the reference audio. */
export function validateReferenceText(text: string): string {
  const trimmed = text.trim()
  if (trimmed === '') {
    throw new Error(
      'amadeus_voice_clone: `referenceText` is required — the voice service needs the exact words spoken in the recording',
    )
  }
  if (trimmed.length > 500) {
    throw new Error('amadeus_voice_clone: `referenceText` must be at most 500 characters')
  }
  return trimmed
}

/** Normalise a requested custom voice name. */
export function validateCustomName(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '') throw new Error('amadeus_voice_clone: `name` is required')
  if (trimmed.length > 64) throw new Error('amadeus_voice_clone: `name` must be at most 64 characters')
  return trimmed
}

/**
 * Extract the voice id from a clone response.
 *
 * SiliconFlow answers `{ uri: "speech:siliconflow-<name>:<id>:<model>" }`; older
 * deployments answered `{ voice: "..." }`. Both are accepted, and a missing id is
 * an error rather than a silent success.
 */
export function extractVoiceId(payload: unknown): string {
  if (payload !== null && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    for (const key of ['uri', 'voice', 'voice_id', 'id']) {
      const value = record[key]
      if (typeof value === 'string' && value.trim() !== '') return value.trim()
    }
  }
  throw new Error('amadeus_voice_clone: the clone service did not return a voice id')
}

/** Turn raw bytes into the `data:<mime>;base64,...` string the API accepts. */
export function toAudioDataUri(bytes: Uint8Array, mimeType: string): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:${mimeType};base64,${btoa(binary)}`
}

/**
 * Presentation payload persisted on `tool/result` for the clone card.
 *
 * A type alias so it satisfies the `JsonValue` return type of
 * `presentationMeta` (interfaces get no implicit index signature).
 */
export type VoiceCloneMeta = {
  readonly kind: 'amadeus-voice-clone'
  readonly voiceId: string
  readonly name: string
  readonly model: string
  readonly referenceText: string
  readonly byteLength: number
  readonly format: string
}

/** Narrow opaque persisted meta back to {@link VoiceCloneMeta}. */
export function voiceCloneMetaFrom(meta: unknown): VoiceCloneMeta | undefined {
  if (meta === null || typeof meta !== 'object') return undefined
  const record = meta as Record<string, unknown>
  if (record.kind !== 'amadeus-voice-clone' || typeof record.voiceId !== 'string') return undefined
  return {
    kind: 'amadeus-voice-clone',
    voiceId: record.voiceId,
    name: typeof record.name === 'string' ? record.name : '',
    model: typeof record.model === 'string' ? record.model : '',
    referenceText: typeof record.referenceText === 'string' ? record.referenceText : '',
    byteLength: typeof record.byteLength === 'number' ? record.byteLength : 0,
    format: typeof record.format === 'string' ? record.format : '',
  }
}
