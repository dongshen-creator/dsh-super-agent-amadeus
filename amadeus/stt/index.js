import { makeTranscriber } from "./api.js";
import { makeTranscribeTool } from "./tool.js";
import z from "@deepseek-ai/schemastery";
// src/index.ts
const name = "amadeus-stt";
const inject = ["tools", "systemPrompt"];
const Config = z.object({
	baseUrl: z.string().default(process.env.AMADEUS_WHISPER_BASE_URL ?? ""),
	apiKey: z.string().default(process.env.AMADEUS_WHISPER_API_KEY ?? ""),
	model: z.string().default(process.env.AMADEUS_WHISPER_MODEL ?? "whisper-large-v3"),
	language: z.string().default(""),
	timeoutMs: z.number().default(12e4)
});
function apply(ctx, config) {
	const transcriber = makeTranscriber({
		baseUrl: config.baseUrl,
		apiKey: config.apiKey,
		model: config.model,
		timeoutMs: config.timeoutMs
	});
	ctx.tools.register(makeTranscribeTool(transcriber));
	ctx.systemPrompt.section({
		name: "tool:amadeus_transcribe",
		order: 910,
		text: "When the user sends a voice recording or asks what was said in an audio file, call `amadeus_transcribe` with the file path instead of guessing the content. An empty transcript means silence: say so plainly and ask the user to repeat, do not invent words."
	});
}
export { Config, apply, inject, name };
