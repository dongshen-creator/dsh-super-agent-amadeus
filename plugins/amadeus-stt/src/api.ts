/**
 * Whisper-compatible transcription client.
 *
 * `fetch` is injectable so the tool can be tested without a network and can be
 * pointed at a proxy-restricted endpoint by the host config.
 */
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import {
  extractTranscript,
  formatFromFilename,
  formatFromMagicBytes,
  mimeForFormat,
  type AudioFormat,
} from './fragment.js'

export interface TranscribeConfig {
  /** Base URL of the OpenAI-compatible endpoint, e.g. `https://host/v1`. */
  baseUrl: string
  /** Bearer key for that endpoint. */
  apiKey: string
  /** Whisper model id. */
  model: string
  /** Request timeout in milliseconds. */
  timeoutMs: number
  /** Optional proxy URL applied per request. */
  proxyUrl?: string
}

export interface TranscribeInput {
  /** Either an absolute path on the host, or raw audio bytes. */
  path?: string
  bytes?: Uint8Array
  /** Filename hint used for the multipart part name and format detection. */
  filename?: string
  /** Language hint (`zh`, `en`, `ja`, ...); omit to auto-detect. */
  language?: string
}

export interface TranscribeResult {
  text: string
  language?: string
  model: string
}

/** Resolve audio bytes plus a format from the caller's input. */
async function loadAudio(input: TranscribeInput): Promise<{ bytes: Uint8Array; format?: AudioFormat; filename: string }> {
  if (input.path) {
    const bytes = new Uint8Array(await readFile(input.path))
    const name = input.filename ?? basename(input.path)
    return { bytes, format: formatFromFilename(name) ?? formatFromMagicBytes(bytes), filename: name }
  }
  if (input.bytes && input.bytes.length > 0) {
    const name = input.filename ?? 'audio.wav'
    return { bytes: input.bytes, format: formatFromFilename(name) ?? formatFromMagicBytes(input.bytes), filename: name }
  }
  throw new Error('amadeus_stt: provide either `path` or `bytes` with the audio to transcribe')
}

/**
 * Build a transcription client bound to one configuration.
 * @param config - endpoint, model and timeout.
 * @param fetchImpl - injectable fetch (defaults to the global).
 * @param fetchFactory - optional hook to wrap fetch (proxy injection).
 */
export function makeTranscriber(
  config: TranscribeConfig,
  fetchImpl: typeof fetch = fetch,
) {
  return {
    async transcribe(input: TranscribeInput): Promise<TranscribeResult> {
      if (!config.apiKey) {
        throw new Error('amadeus_stt: no API key configured (set apiKey in the plugin config or AMADEUS_WHISPER_API_KEY)')
      }
      if (!config.baseUrl) {
        throw new Error('amadeus_stt: no base URL configured (set baseUrl or AMADEUS_WHISPER_BASE_URL)')
      }

      const audio = await loadAudio(input)
      if (!audio.format) {
        throw new Error(
          `amadeus_stt: could not determine the audio format of ${audio.filename}; ` +
            'pass a filename with a supported extension (wav/mp3/m4a/webm/ogg/flac)',
        )
      }

      const form = new FormData()
      // Re-wrap so the Blob gets an `ArrayBuffer`-backed view: a bare Uint8Array
      // typed against ArrayBufferLike is not a valid BlobPart under TS 5.7.
      const payload = new Uint8Array(audio.bytes.length)
      payload.set(audio.bytes)
      form.append(
        'file',
        new Blob([payload], { type: mimeForFormat(audio.format) }),
        audio.filename,
      )
      form.append('model', config.model)
      form.append('response_format', 'json')
      if (input.language) form.append('language', input.language)

      const url = `${config.baseUrl.replace(/\/+$/, '')}/audio/transcriptions`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.timeoutMs)
      try {
        const response = await fetchImpl(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.apiKey}` },
          body: form,
          signal: controller.signal,
        })
        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(
            `amadeus_stt: transcription endpoint returned ${response.status} ${response.statusText}` +
              (body ? ` — ${body.slice(0, 300)}` : ''),
          )
        }
        const text = extractTranscript(await response.json())
        return { text, language: input.language, model: config.model }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`amadeus_stt: transcription timed out after ${config.timeoutMs}ms`)
        }
        throw error
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

export type Transcriber = ReturnType<typeof makeTranscriber>
