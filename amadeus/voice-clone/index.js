import { makeVoiceCloner } from "./api.js";
import { makeCloneTool } from "./tool.js";
import z from "@deepseek-ai/schemastery";
// src/index.ts
const name = "amadeus-voice-clone";
const inject = ["tools", "systemPrompt"];
const Config = z.object({
	baseUrl: z.string().default(process.env.AMADEUS_SILICONFLOW_BASE_URL ?? "https://api.siliconflow.cn/v1"),
	apiKey: z.string().default(process.env.AMADEUS_SILICONFLOW_API_KEY ?? ""),
	model: z.string().default("FunAudioLLM/CosyVoice2-0.5B"),
	timeoutMs: z.number().default(3e5),
	proxyUrl: z.string().default(process.env.AMADEUS_PROXY_URL ?? "")
});
function apply(ctx, config) {
	const cloner = makeVoiceCloner({
		baseUrl: config.baseUrl,
		apiKey: config.apiKey,
		model: config.model,
		timeoutMs: config.timeoutMs,
		proxyUrl: config.proxyUrl || void 0
	});
	ctx.tools.register(makeCloneTool(cloner));
	ctx.systemPrompt.section({
		name: "tool:amadeus_voice_clone",
		order: 914,
		text: "When the user uploads a voice sample and asks to clone it, call `amadeus_clone_voice` with the file path, a name, and the exact words spoken in the recording. Ask for the transcript only if it is not obvious from the conversation; never invent it. The returned voice id is what `amadeus_speak` takes."
	});
}
export { Config, apply, inject, name };
