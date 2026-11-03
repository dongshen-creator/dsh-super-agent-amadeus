import { buildParameterValues, computeStageLayout, createIdleState, resolveExpression, resolveMotion, stageMetaFrom, stepIdle } from "./fragment.js";
import { defineTool } from "@deepseek-ai/dsh-tools";
// src/tool.ts
/**
* The `amadeus_stage` tool: place the avatar on its stage and pose it.
*
* The Node side owns the numbers (layout, expression, idle parameters); the
* browser card only draws them, which keeps replay identical.
*/
function makeStageTool(options) {
	const random = options.random ?? Math.random;
	const now = options.now ?? Date.now;
	let idle = createIdleState();
	return defineTool({
		name: "amadeus_stage",
		description: "Place the Amadeus character avatar on its stage and pose it. Use when showing, repositioning or reacting with the avatar: pick the character role, and optionally pass the emotion and motion you just decided. Returns the stage placement plus the idle animation parameters for this frame. Does not play audio; use `amadeus_speak` for that.",
		parameters: {
			role: {
				type: "string",
				description: "Character role name, e.g. 牧濑红莉栖. Unknown names fall back to the default model."
			},
			emotion: {
				type: "string",
				description: "Expression to show: neutral, anger, joy, sadness, shy, shy2, smile1, smile2, unhappy. neutral or anything containing \"random\" resets the face."
			},
			motion: {
				type: "string",
				description: "Motion to play. \"speaking\" and \"thinking\" pick a random idle motion; any other value is played as-is."
			},
			viewportWidth: {
				type: "number",
				description: "Viewport width in CSS pixels used for horizontal placement. Defaults to 1620."
			},
			mobile: {
				type: "boolean",
				description: "Pass true for the narrow-screen layout (uses the mobile placement variant)."
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
					role: {
						type: "string",
						required: true
					},
					modelPath: {
						type: "string",
						required: true
					},
					scale: {
						type: "number",
						required: true
					},
					x: {
						type: "number",
						required: true
					},
					y: {
						type: "number",
						required: true
					},
					mobile: {
						type: "boolean",
						required: true
					},
					emotion: {
						type: "string",
						required: true
					},
					motion: {
						type: "string",
						required: true
					},
					expression: {
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
				kind: "amadeus-live2d",
				role: value.role,
				modelPath: value.modelPath,
				scale: value.scale,
				x: value.x,
				y: value.y,
				mobile: value.mobile,
				emotion: value.emotion,
				motion: value.motion,
				expression: value.expression,
				parameters: buildParameterValues(idle)
			})
		},
		isConcurrencySafe: () => true,
		presentCall: (args) => ({
			card: "generic",
			title: "摆好虚拟形象",
			kind: "other",
			input: typeof args.role === "string" ? args.role : void 0
		}),
		presentResult: (_args, result) => {
			if (result.isError) return void 0;
			const meta = stageMetaFrom(result.meta);
			if (meta === void 0) return void 0;
			return {
				card: "generic",
				title: `舞台 · ${meta.role}`
			};
		},
		async execute(args) {
			const role = typeof args.role === "string" && args.role.trim() !== "" ? args.role.trim() : options.defaultRole;
			const viewportWidth = typeof args.viewportWidth === "number" ? args.viewportWidth : 1620;
			const mobile = args.mobile === true;
			const layout = computeStageLayout(role, viewportWidth, mobile);
			const emotion = typeof args.emotion === "string" ? args.emotion.trim().toLowerCase() : "";
			const expression = resolveExpression(emotion);
			const motion = resolveMotion(typeof args.motion === "string" ? args.motion.trim() : "", random);
			idle = stepIdle(idle, now(), random);
			const pose = [expression === "" ? "表情复位" : `表情 ${expression}`, motion === "" ? "待机动作" : `动作 ${motion}`].join("，");
			return {
				text: `已把 ${layout.role} 摆上舞台（${pose}）。模型地址：${layout.modelPath}`,
				role: layout.role,
				modelPath: layout.modelPath,
				scale: layout.scale,
				x: layout.x,
				y: layout.y,
				mobile: layout.mobile,
				emotion,
				motion,
				expression
			};
		}
	});
}
export { makeStageTool };
