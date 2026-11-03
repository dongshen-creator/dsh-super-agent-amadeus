/**
 * Proactive-move planner client.
 *
 * Uses schema-constrained decoding so the answer must be one of the five moves,
 * which removes the JSON-parse failure path the original had to guard.
 */
import { ACTIONS, normalizeAction, PLANNER_SYSTEM_PROMPT, type Action } from './fragment.js'

export interface PlannerConfig {
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
}

export interface Turn {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface PlanResult {
  action: Action
  confident: boolean
  model: string
}

export function makePlanner(config: PlannerConfig, fetchImpl: typeof fetch = fetch) {
  return {
    async plan(history: readonly Turn[]): Promise<PlanResult> {
      // No history yet: the original defaulted straight to sharing a memory.
      if (history.length === 0) {
        return { action: 'share_memory', confident: true, model: config.model }
      }
      if (!config.apiKey) {
        throw new Error('amadeus_proactive: no API key configured (set apiKey or AMADEUS_LLM_API_KEY)')
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
              { role: 'system', content: PLANNER_SYSTEM_PROMPT },
              ...history.map((turn) => ({ role: turn.role, content: turn.content })),
            ],
            response_format: {
              type: 'json_schema',
              json_schema: {
                name: 'action_response',
                strict: true,
                schema: {
                  type: 'object',
                  properties: { result: { type: 'string', enum: [...ACTIONS] } },
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
            `amadeus_proactive: planner returned ${response.status} ${response.statusText}` +
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

        const action = normalizeAction(raw)
        return { action, confident: action === raw, model: config.model }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`amadeus_proactive: planning timed out after ${config.timeoutMs}ms`)
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

export type Planner = ReturnType<typeof makePlanner>
