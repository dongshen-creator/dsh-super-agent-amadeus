import { EMOTIONS, EMOTION_SYSTEM_PROMPT, normalizeEmotion } from "./fragment.js";
// src/api.ts
/**
* Emotion classifier client.
*
* Uses JSON-schema-constrained decoding so the model can only answer with one
* of the nine motion names — the same technique as the original project, which
* removes the parse-failure path instead of patching it.
*/
function makeClassifier(config, fetchImpl = fetch) {
	return { async classify(text) {
		if (text.trim() === "") return {
			emotion: "neutral",
			confident: true,
			model: config.model
		};
		if (!config.apiKey) throw new Error("amadeus_emotion: no API key configured (set apiKey or AMADEUS_LLM_API_KEY)");
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), config.timeoutMs);
		try {
			const response = await fetchImpl(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					model: config.model,
					messages: [{
						role: "system",
						content: EMOTION_SYSTEM_PROMPT
					}, {
						role: "user",
						content: text
					}],
					response_format: {
						type: "json_schema",
						json_schema: {
							name: "motion_response",
							strict: true,
							schema: {
								type: "object",
								properties: { result: {
									type: "string",
									enum: [...EMOTIONS]
								} },
								required: ["result"],
								additionalProperties: false
							}
						}
					}
				}),
				signal: controller.signal
			});
			if (!response.ok) {
				const body = await response.text().catch(() => "");
				throw new Error(`amadeus_emotion: classifier returned ${response.status} ${response.statusText}` + (body ? ` — ${body.slice(0, 300)}` : ""));
			}
			const content = (await response.json()).choices?.[0]?.message?.content;
			const parsed = typeof content === "string" ? safeParse(content) : void 0;
			const raw = parsed !== void 0 && typeof parsed === "object" && parsed !== null ? parsed.result : void 0;
			const emotion = normalizeEmotion(raw);
			return {
				emotion,
				confident: emotion === raw,
				model: config.model
			};
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") throw new Error(`amadeus_emotion: classification timed out after ${config.timeoutMs}ms`);
			throw error;
		} finally {
			clearTimeout(timer);
		}
	} };
}
function safeParse(text) {
	try {
		return JSON.parse(text);
	} catch {
		return;
	}
}
export { makeClassifier };
