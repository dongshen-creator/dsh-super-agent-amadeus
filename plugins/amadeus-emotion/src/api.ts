/**
 * Emotion classifier client.
 *
 * Uses JSON-schema-constrained decoding so the model can only answer with one
 * of the nine motion names — the same technique as the original project, which
 * removes the parse-failure path instead of patching it.
 */
import { normalizeEmotion, EMOTIONS, EMOTION_SYSTEM_PROMPT, type Emotion } from './fragment.js'

export interface EmotionConfig {
  baseUrl: string
  apiKey: string
  /** Classifier model; the original used a small fast model. */
  model: string
  timeoutMs: number
}

export interface EmotionResult {
  emotion: Emotion
  /** False when the classifier failed and the default was substituted. */
  confident: boolean
  model: string
}

export function makeClassifier(config: EmotionConfig, fetchImpl: typeof fetch = fetch) {
  return {
    async classify(text: string): Promise<EmotionResult> {
      if (text.trim() === '') {
        return { emotion: 'neutral', confident: true, model: config.model }
      }
      if (!config.apiKey) {
        throw new Error('amadeus_emotion: no API key configured (set apiKey or AMADEUS_LLM_API_KEY)')
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.timeoutMs)
      try {
        const response = await fetchImpl(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: EMOTION_SYSTEM_PROMPT },
              { role: 'user', content: text },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'motion_response',
                strict: true,
                schema: {
                  type: 'object',
                  properties: { result: { type: 'string', enum: [...EMOTIONS] } },
                  required: ['result'],
                  additionalProperties: false,
                },
              },
            },
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.text().catch(() => '')
          throw new Error(
            `amadeus_emotion: classifier returned ${response.status} ${response.statusText}` +
              (body ? ` — ${body.slice(0, 300)}` : ''),
          )
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: unknown } }>
        }
        const content = payload.choices?.[0]?.message?.content
        const parsed = typeof content === 'string' ? safeParse(content) : undefined
        const raw = parsed !== undefined && typeof parsed === 'object' && parsed !== null
          ? (parsed as Record<string, unknown>).result
          : undefined

        const emotion = normalizeEmotion(raw)
        return { emotion, confident: emotion === raw, model: config.model }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`amadeus_emotion: classification timed out after ${config.timeoutMs}ms`)
        }
        throw error
      } finally {
        clearTimeout(timer)
      }
    },
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export type Classifier = ReturnType<typeof makeClassifier>
