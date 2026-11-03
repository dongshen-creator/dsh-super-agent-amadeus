import { EMOTION_COLORS, EMOTION_LABELS, emotionMetaFrom } from "./fragment.js";
import { defineTool } from "@deepseek-ai/dsh-tools";
// src/tool.ts
/**
* The `amadeus_emotion` tool: pick the Live2D motion for a line of dialogue.
*/
function makeEmotionTool(classifier) {
	return defineTool({
		name: "amadeus_emotion",
		description: "Choose the Live2D motion and expression that fits a line of dialogue. Use after composing a spoken reply so the character avatar shows the matching emotion. Returns one of: neutral, anger, joy, sadness, shy, shy2, smile1, smile2, unhappy.",
		parameters: { text: {
			type: "string",
			required: true,
			description: "The dialogue line whose emotion should be shown, usually the reply just written."
		} },
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					text: {
						type: "string",
						required: true
					},
					emotion: {
						type: "string",
						required: true,
						enum: [
							"neutral",
							"anger",
							"joy",
							"sadness",
							"shy",
							"shy2",
							"smile1",
							"smile2",
							"unhappy"
						]
					},
					label: {
						type: "string",
						required: true
					},
					color: {
						type: "string",
						required: true
					},
					confident: {
						type: "boolean",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.text
			}],
			presentationMeta: (args, value) => ({
				kind: "amadeus-emotion",
				emotion: value.emotion,
				label: value.label,
				color: value.color,
				text: typeof args.text === "string" ? args.text : "",
				confident: value.confident
			})
		},
		isConcurrencySafe: () => true,
		presentCall: (args) => ({
			card: "generic",
			title: "选择表情动作",
			kind: "other",
			input: typeof args.text === "string" && args.text.length > 60 ? `${args.text.slice(0, 60)}…` : { text: args.text }
		}),
		presentResult: (_args, result) => {
			if (result.isError) return void 0;
			const meta = emotionMetaFrom(result.meta);
			if (meta === void 0) return void 0;
			return {
				card: "generic",
				title: `表情 · ${meta.label}`
			};
		},
		async execute(args) {
			const text = typeof args.text === "string" ? args.text.trim() : "";
			if (text === "") throw new Error("amadeus_emotion: `text` is required");
			const result = await classifier.classify(text);
			const label = EMOTION_LABELS[result.emotion];
			return {
				text: result.confident ? `表情动作：${result.emotion}（${label}），已驱动虚拟形象。` : `表情动作回退为 ${result.emotion}（${label}）：分类器未返回有效动作名。`,
				emotion: result.emotion,
				label,
				color: EMOTION_COLORS[result.emotion],
				confident: result.confident
			};
		}
	});
}
export { makeEmotionTool };
