import { makePlanner } from "./api.js";
import { makeProactiveTool } from "./tool.js";
import z from "@deepseek-ai/schemastery";
// src/index.ts
const name = "amadeus-proactive";
const inject = ["tools", "systemPrompt"];
const Config = z.object({
	baseUrl: z.string().default(process.env.AMADEUS_LLM_BASE_URL ?? "https://api.openai.com/v1"),
	apiKey: z.string().default(process.env.AMADEUS_LLM_API_KEY ?? ""),
	model: z.string().default("gpt-4.1-nano"),
	timeoutMs: z.number().default(3e4)
});
function apply(ctx, config) {
	const planner = makePlanner({
		baseUrl: config.baseUrl,
		apiKey: config.apiKey,
		model: config.model,
		timeoutMs: config.timeoutMs
	});
	ctx.tools.register(makeProactiveTool(planner));
	ctx.systemPrompt.section({
		name: "tool:amadeus_proactive_plan",
		order: 915,
		text: "When the user has stopped responding and the character should speak first, call `amadeus_proactive_plan` with the recent turns. Then act on the returned `prompt` verbatim: it begins with the `[AI主动发起对话]` marker that tells you this is a self-initiated turn. Never call this tool while the user is still actively conversing, and never mention the tool or the move name to the user."
	});
}
export { Config, apply, inject, name };
