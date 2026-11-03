// src/fragment.ts
/**
* Memory contracts.
*
* The original project hashed the user name into a stable id and used it as the
* mem0 `user_id`. That rule is reproduced here so an existing Amadeus memory
* store keeps resolving to the same user after the port.
*/
/** Fixed salt from `utils/user_utils.py`. */
const USER_ID_SALT = "amadeus_system_fixed_salt_09876";
/**
* Normalise a search response.
*
* mem0 answers `{ results: [...] }` on some versions and a bare array on
* others; entries carry `memory` or `text`. Anything unrecognised is dropped,
* matching the original `"\n".join(memory["memory"] ...)` intent without
* crashing on a shape change.
*/
function normalizeSearchResults(payload) {
	const list = Array.isArray(payload) ? payload : payload !== null && typeof payload === "object" && Array.isArray(payload.results) ? payload.results : [];
	const hits = [];
	for (const entry of list) {
		if (entry === null || typeof entry !== "object") continue;
		const record = entry;
		const text = typeof record.memory === "string" ? record.memory : typeof record.text === "string" ? record.text : void 0;
		if (text === void 0 || text.trim() === "") continue;
		hits.push({
			memory: text,
			score: typeof record.score === "number" ? record.score : void 0,
			id: typeof record.id === "string" ? record.id : void 0
		});
	}
	return hits;
}
/**
* Build the prompt fragment the original injected into the user turn.
*
* Same shape (`Relevant Memories/Facts:` then `User Question:`) so the persona
* prompt keeps finding memories where it expects them.
*/
function buildMemoryContext(hits, question) {
	if (hits.length === 0) return question;
	return `Relevant Memories/Facts:\n${hits.map((hit) => hit.memory).join("\n")}\n\nUser Question: ${question}`;
}
/** One-line summary for the model. */
function summarizeHits(hits, query) {
	if (hits.length === 0) return `没有检索到与「${truncate(query, 30)}」相关的长期记忆。`;
	return `检索到 ${hits.length} 条相关记忆：${hits.map((hit) => truncate(hit.memory, 40)).join("；")}`;
}
function truncate(text, max) {
	return text.length > max ? `${text.slice(0, max)}…` : text;
}
/** Narrow opaque persisted meta back to {@link MemoryMeta}. */
function memoryMetaFrom(meta) {
	if (meta === null || typeof meta !== "object") return void 0;
	const record = meta;
	if (record.kind !== "amadeus-memory" || typeof record.query !== "string") return void 0;
	return {
		kind: "amadeus-memory",
		query: record.query,
		hits: normalizeSearchResults(record.hits),
		userId: typeof record.userId === "string" ? record.userId : ""
	};
}
export { USER_ID_SALT, buildMemoryContext, memoryMetaFrom, normalizeSearchResults, summarizeHits };
