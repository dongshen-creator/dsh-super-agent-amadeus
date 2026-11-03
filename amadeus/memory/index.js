import { makeMemoryClient } from "./api.js";
import { makeRecallTool, makeRememberTool } from "./tool.js";
import z from "@deepseek-ai/schemastery";
// src/index.ts
const name = "amadeus-memory";
const inject = ["tools", "systemPrompt"];
const Config = z.object({
	baseUrl: z.string().default(process.env.AMADEUS_MEM0_BASE_URL ?? "https://api.mem0.ai/v1"),
	apiKey: z.string().default(process.env.AMADEUS_MEM0_API_KEY ?? ""),
	userName: z.string().default(process.env.AMADEUS_USER_NAME ?? "用户"),
	searchLimit: z.number().default(3),
	enableRemember: z.boolean().default(true),
	timeoutMs: z.number().default(3e4)
});
function apply(ctx, config) {
	const client = makeMemoryClient({
		baseUrl: config.baseUrl,
		apiKey: config.apiKey,
		userName: config.userName,
		searchLimit: config.searchLimit,
		timeoutMs: config.timeoutMs
	});
	ctx.tools.register(makeRecallTool(client));
	if (config.enableRemember) ctx.tools.register(makeRememberTool(client));
	ctx.systemPrompt.section({
		name: "tool:amadeus_memory",
		order: 913,
		text: "Call `amadeus_recall` before answering anything that depends on what this user told you in earlier conversations; treat what it returns as facts the user shared, and say plainly when it finds nothing. After a turn that revealed a durable fact about the user, call `amadeus_remember` with the exact exchange. Never invent a memory, and never mention the memory store to the user."
	});
}
export { Config, apply, inject, name };
