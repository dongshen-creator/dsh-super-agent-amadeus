import { toDataUri } from "./api.js";
import { speechMetaFrom, summarizeSpeech } from "./fragment.js";
import { defineTool } from "@deepseek-ai/dsh-tools";
// src/tool.ts
/**
* The `amadeus_speak` tool: turn a reply into playable speech.
*/
function makeSpeakTool(synthesizer, options) {
	return defineTool({
		name: "amadeus_speak",
		description: "Synthesise a reply into speech and show an audio player in the conversation. Use when the user asks to hear something spoken, or when you are replying inside the Amadeus voice conversation. Pass the exact text to be spoken; it is split at punctuation and synthesised clause by clause.",
		parameters: {
			text: {
				type: "string",
				required: true,
				description: "The exact text to speak aloud. Plain prose only: no Markdown, no lists, no code."
			},
			voice: {
				type: "string",
				description: "Optional voice id overriding the configured default, e.g. a cloned voice id."
			}
		},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					text: {
						type: "string",
						required: true
					},
					segments: {
						type: "array",
						required: true,
						items: {
							type: "object",
							additionalProperties: false,
							properties: {
								id: {
									type: "string",
									required: true
								},
								text: {
									type: "string",
									required: true
								},
								index: {
									type: "number",
									required: true
								}
							}
						}
					},
					audio: {
						type: "string",
						required: true
					},
					mimeType: {
						type: "string",
						required: true
					},
					voice: {
						type: "string",
						required: true
					},
					model: {
						type: "string",
						required: true
					},
					durationSeconds: {
						type: "number",
						required: true
					},
					byteLength: {
						type: "number",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}],
			presentationMeta: (_args, value) => ({
				kind: "amadeus-speech",
				segments: value.segments,
				audio: value.audio,
				mimeType: value.mimeType,
				voice: value.voice,
				model: value.model,
				durationSeconds: value.durationSeconds,
				byteLength: value.byteLength
			})
		},
		isConcurrencySafe: () => true,
		presentCall: (args) => ({
			card: "generic",
			title: "合成语音",
			kind: "execute",
			input: { text: args.text.length > 80 ? `${args.text.slice(0, 80)}…` : args.text }
		}),
		presentResult: (_args, result) => {
			if (result.isError) return void 0;
			const meta = speechMetaFrom(result.meta);
			if (meta === void 0) return void 0;
			const seconds = meta.durationSeconds ? meta.durationSeconds.toFixed(1) : "?";
			return {
				card: "generic",
				title: `语音 · ${meta.segments.length} 段 · ${seconds}s`
			};
		},
		async execute(args) {
			const text = typeof args.text === "string" ? args.text.trim() : "";
			if (text === "") throw new Error("amadeus_speak: `text` is required");
			const result = await synthesizer.synthesize(text, options.minSegmentLength);
			const audio = toDataUri(result.wav, result.mimeType);
			const voice = typeof args.voice === "string" && args.voice.trim() !== "" ? args.voice.trim() : result.voice;
			return {
				text: summarizeSpeech(result.segments.length, result.wav.byteLength, voice),
				segments: result.segments,
				audio,
				mimeType: result.mimeType,
				voice,
				model: result.model,
				durationSeconds: Number(result.durationSeconds.toFixed(2)),
				byteLength: result.wav.byteLength
			};
		}
	});
}
export { makeSpeakTool };
