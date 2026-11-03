import { DEFAULT_ROLE } from "./fragment.js";
import { makeStageTool } from "./tool.js";
import z from "@deepseek-ai/schemastery";
// src/index.ts
const name = "amadeus-live2d";
const inject = ["tools", "systemPrompt"];
const Config = z.object({
	role: z.string().default(DEFAULT_ROLE),
	referenceWidth: z.number().default(1620)
});
function apply(ctx, config) {
	ctx.tools.register(makeStageTool({ defaultRole: config.role }));
	ctx.systemPrompt.section({
		name: "tool:amadeus_stage",
		order: 916,
		text: "You can show the Amadeus character as a stage card. Call `amadeus_stage` when the user asks to see the avatar, when the character should visibly react, or right after `amadeus_emotion` if you want the pose mirrored on the stage. Pass the emotion you just chose so the drawn face matches. Do not describe the tool or the model path in your reply — just react in character."
	});
}
export { Config, apply, inject, name };
