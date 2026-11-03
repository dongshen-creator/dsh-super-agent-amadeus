import { makeClassifier } from "./api.js";
import { makeEmotionTool } from "./tool.js";
import z from "@deepseek-ai/schemastery";
// src/index.ts
const name = "amadeus-emotion";
const inject = ["tools", "systemPrompt"];
const Config = z.object({
	baseUrl: z.string().default(process.env.AMADEUS_LLM_BASE_URL ?? "https://api.openai.com/v1"),
	apiKey: z.string().default(process.env.AMADEUS_LLM_API_KEY ?? ""),
	model: z.string().default("gpt-4.1-nano"),
	timeoutMs: z.number().default(3e4)
});
function apply(ctx, config) {
	const classifier = makeClassifier({
		baseUrl: config.baseUrl,
		apiKey: config.apiKey,
		model: config.model,
		timeoutMs: config.timeoutMs
	});
	ctx.tools.register(makeEmotionTool(classifier));
	ctx.systemPrompt.section({
		name: "tool:amadeus_emotion",
		order: 912,
		text: "After writing a spoken reply in the Amadeus character voice, call `amadeus_emotion` with that reply so the avatar shows a matching expression. Do not call it for user messages, and do not mention the tool or the motion name in your reply."
	});
}
export { Config, apply, inject, name };
