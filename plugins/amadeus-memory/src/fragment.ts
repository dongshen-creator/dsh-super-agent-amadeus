/**
 * Memory contracts.
 *
 * The original project hashed the user name into a stable id and used it as the
 * mem0 `user_id`. That rule is reproduced here so an existing Amadeus memory
 * store keeps resolving to the same user after the port.
 */
/** Fixed salt from `utils/user_utils.py`. */
export const USER_ID_SALT = 'amadeus_system_fixed_salt_09876'

/**
 * One recalled memory.
 *
 * A type alias so it can be embedded in `MemoryMeta`, which must satisfy
 * `JsonValue` (interfaces get no implicit index signature).
 */
export type MemoryHit = {
  /** Memory text as stored. */
  readonly memory: string
  /** Similarity/score reported by the backend, when available. */
  readonly score?: number
  /** Backend id, usable for later updates in external tooling. */
  readonly id?: string
}

/**
 * Normalise a search response.
 *
 * mem0 answers `{ results: [...] }` on some versions and a bare array on
 * others; entries carry `memory` or `text`. Anything unrecognised is dropped,
 * matching the original `"\n".join(memory["memory"] ...)` intent without
 * crashing on a shape change.
 */
export function normalizeSearchResults(payload: unknown): MemoryHit[] {
  const list = Array.isArray(payload)
    ? payload
    : payload !== null && typeof payload === 'object' && Array.isArray((payload as { results?: unknown }).results)
      ? ((payload as { results: unknown[] }).results)
      : []

  const hits: MemoryHit[] = []
  for (const entry of list) {
    if (entry === null || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const text = typeof record.memory === 'string'
      ? record.memory
      : typeof record.text === 'string'
        ? record.text
        : undefined
    if (text === undefined || text.trim() === '') continue
    hits.push({
      memory: text,
      score: typeof record.score === 'number' ? record.score : undefined,
      id: typeof record.id === 'string' ? record.id : undefined,
    })
  }
  return hits
}

/**
 * Build the prompt fragment the original injected into the user turn.
 *
 * Same shape (`Relevant Memories/Facts:` then `User Question:`) so the persona
 * prompt keeps finding memories where it expects them.
 */
export function buildMemoryContext(hits: readonly MemoryHit[], question: string): string {
  if (hits.length === 0) return question
  return `Relevant Memories/Facts:\n${hits.map((hit) => hit.memory).join('\n')}\n\nUser Question: ${question}`
}

/** One-line summary for the model. */
export function summarizeHits(hits: readonly MemoryHit[], query: string): string {
  if (hits.length === 0) return `没有检索到与「${truncate(query, 30)}」相关的长期记忆。`
  return `检索到 ${hits.length} 条相关记忆：${hits.map((hit) => truncate(hit.memory, 40)).join('；')}`
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * Presentation payload persisted on `tool/result` for the memory card.
 *
 * A type alias with a mutable array so it satisfies the `JsonValue` return type
 * of `presentationMeta`.
 */
export type MemoryMeta = {
  readonly kind: 'amadeus-memory'
  readonly query: string
  readonly hits: MemoryHit[]
  readonly userId: string
}

/** Narrow opaque persisted meta back to {@link MemoryMeta}. */
export function memoryMetaFrom(meta: unknown): MemoryMeta | undefined {
  if (meta === null || typeof meta !== 'object') return undefined
  const record = meta as Record<string, unknown>
  if (record.kind !== 'amadeus-memory' || typeof record.query !== 'string') return undefined
  return {
    kind: 'amadeus-memory',
    query: record.query,
    hits: normalizeSearchResults(record.hits),
    userId: typeof record.userId === 'string' ? record.userId : '',
  }
}
