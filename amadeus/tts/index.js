import { makeSynthesizer } from "./api.js";
import "./fragment.js";
import { makeSpeakTool } from "./tool.js";
import z from "@deepseek-ai/schemastery";
// src/index.ts
const name = "amadeus-tts";
const inject = ["tools", "systemPrompt"];
const Config = z.object({
	baseUrl: z.string().default(process.env.AMADEUS_SILICONFLOW_BASE_URL ?? "https://api.siliconflow.cn/v1"),
	apiKey: z.string().default(process.env.AMADEUS_SILICONFLOW_API_KEY ?? ""),
	voice: z.string().default(process.env.AMADEUS_SILICONFLOW_VOICE ?? "speech:siliconflow-kurisu:clzv7bjjm041fufyct2z0setm:mphrsbbmvrjfophbsted"),
	model: z.string().default("FunAudioLLM/CosyVoice2-0.5B"),
	sampleRate: z.number().default(32e3),
	timeoutMs: z.number().default(12e4),
	minSegmentLength: z.number().default(15)
});
function apply(ctx, config) {
	const synthesizer = makeSynthesizer({
		baseUrl: config.baseUrl,
		apiKey: config.apiKey,
		voice: config.voice,
		model: config.model,
		sampleRate: config.sampleRate,
		timeoutMs: config.timeoutMs
	});
	ctx.tools.register(makeSpeakTool(synthesizer, { minSegmentLength: config.minSegmentLength }));
	ctx.systemPrompt.section({
		name: "tool:amadeus_speak",
		order: 911,
		text: "When the user asks to hear a reply aloud, or inside the Amadeus voice conversation, call `amadeus_speak` with the exact text to speak. Pass plain prose: the tool splits it at punctuation and shows an audio player. Do not paste Markdown into `text` — it is read literally."
	});
}
export { Config, apply, inject, name };
