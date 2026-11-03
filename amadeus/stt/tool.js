import { isUsableTranscript, summarizeTranscript, transcriptMetaFrom } from "./fragment.js";
import { defineTool } from "@deepseek-ai/dsh-tools";
// src/tool.ts
/**
* The `amadeus_transcribe` tool: turn a recorded audio file into a user turn.
*/
function makeTranscribeTool(transcriber) {
	return defineTool({
		name: "amadeus_transcribe",
		description: "Transcribe a recorded audio file to text with a Whisper-compatible endpoint. Use when the user sends a voice recording, uploads an audio file, or asks what was said in audio. Returns the transcript as plain text. Silence or unintelligible audio returns an empty transcript with an explanation.",
		parameters: {
			path: {
				type: "string",
				required: true,
				description: "Absolute path to the audio file on the host (wav, mp3, m4a, webm, ogg or flac)."
			},
			language: {
				type: "string",
				description: "Optional spoken-language hint such as zh, en or ja. Omit to auto-detect."
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
					transcript: {
						type: "string",
						required: true
					},
					language: { type: "string" },
					usable: {
						type: "boolean",
						required: true
					},
					model: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}],
			presentationMeta: (_args, value) => ({
				kind: "amadeus-transcript",
				text: value.transcript,
				language: value.language,
				model: value.model,
				usable: value.usable
			})
		},
		isConcurrencySafe: () => true,
		presentCall: (args) => ({
			card: "generic",
			title: "转录音频",
			kind: "read",
			input: {
				path: args.path,
				...args.language ? { language: args.language } : {}
			}
		}),
		presentResult: (_args, result) => {
			if (result.isError) return void 0;
			const meta = transcriptMetaFrom(result.meta);
			if (meta === void 0) return void 0;
			return {
				card: "generic",
				title: meta.usable ? "转录完成" : "转录为空"
			};
		},
		async execute(args) {
			const path = typeof args.path === "string" ? args.path.trim() : "";
			if (path === "") throw new Error("amadeus_transcribe: `path` is required");
			const result = await transcriber.transcribe({
				path,
				...args.language ? { language: args.language } : {}
			});
			const usable = isUsableTranscript(result.text);
			return {
				text: usable ? summarizeTranscript(result.text, result.language) : "转录结果为空或无法识别（可能是静音或环境噪声），没有产生可用的用户发言。",
				transcript: result.text,
				language: result.language,
				usable,
				model: result.model
			};
		}
	});
}
export { makeTranscribeTool };
