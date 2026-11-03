import { USER_ID_SALT, normalizeSearchResults } from "./fragment.js";
import { createHash } from "node:crypto";
// src/api.ts
/**
* mem0-compatible memory client.
*
* Both the search and the add endpoint are configurable: mem0 cloud serves
* `/v1/memories/search` and `/v1/memories`, and a self-hosted deployment can be
* pointed at the same shape.
*/
/** Derive the stable memory-scope id for a user name (md5, 16 hex chars). */
function generateUserId(userName) {
	return createHash("md5").update(`${userName}_${USER_ID_SALT}`, "utf8").digest("hex").slice(0, 16);
}
async function postJson(fetchImpl, url, apiKey, body, timeoutMs, signal) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const onAbort = () => controller.abort();
	signal?.addEventListener("abort", onAbort, { once: true });
	try {
		const response = await fetchImpl(url, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify(body),
			signal: controller.signal
		});
		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(`amadeus_memory: ${url} returned ${response.status} ${response.statusText}` + (text ? ` — ${text.slice(0, 300)}` : ""));
		}
		return await response.json();
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") throw new Error(`amadeus_memory: request timed out after ${timeoutMs}ms`);
		throw error;
	} finally {
		clearTimeout(timer);
		signal?.removeEventListener("abort", onAbort);
	}
}
function makeMemoryClient(config, fetchImpl = fetch) {
	const userId = generateUserId(config.userName);
	const root = config.baseUrl.replace(/\/+$/, "");
	return {
		userId,
		async search(query, limit, signal) {
			if (!config.apiKey) throw new Error("amadeus_memory: no API key configured (set apiKey or AMADEUS_MEM0_API_KEY)");
			const payload = await postJson(fetchImpl, `${root}/memories/search`, config.apiKey, {
				query,
				user_id: userId,
				limit: limit ?? config.searchLimit
			}, config.timeoutMs, signal);
			return normalizeSearchResults(payload);
		},
		async store(turn, signal) {
			if (!config.apiKey) throw new Error("amadeus_memory: no API key configured (set apiKey or AMADEUS_MEM0_API_KEY)");
			await postJson(fetchImpl, `${root}/memories`, config.apiKey, {
				messages: [{
					role: "user",
					content: turn.userText
				}, {
					role: "assistant",
					content: turn.assistantText
				}],
				user_id: userId
			}, config.timeoutMs, signal);
		}
	};
}
export { generateUserId, makeMemoryClient };
