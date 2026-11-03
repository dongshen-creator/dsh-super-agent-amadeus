import { buildPersonaPrompt, formatTimestamp } from "./fragment.js";
import { n as voiceChatSkillProvider, r as PERSONA_CANDIDATES_HINT } from "./chunks/skill.js";
import z from "@deepseek-ai/schemastery";
// src/index.ts
const name = "amadeus-persona";
const inject = ["systemPrompt", "skills"];
/** Placement for the persona body: after general rules, before per-tool notes. */
const PERSONA_ORDER = 900;
const STYLE_HINT_ORDER = 901;
const Config = z.object({
	persona: z.string().default("命运石之门(steins gate)的牧濑红莉栖(kurisu),一个天才少女,性格傲娇,不喜欢被叫克里斯蒂娜"),
	voiceLanguage: z.string().default("ja"),
	textLanguage: z.string().default("zh"),
	userName: z.string().default("用户"),
	registerSkill: z.boolean().default(true)
});
function apply(ctx, config) {
	ctx.systemPrompt.section({
		name: "amadeus:persona",
		order: PERSONA_ORDER,
		text: () => buildPersonaPrompt({
			persona: config.persona,
			voiceLanguage: config.voiceLanguage,
			textLanguage: config.textLanguage,
			userName: config.userName,
			now: formatTimestamp(/* @__PURE__ */ new Date())
		})
	});
	ctx.systemPrompt.section({
		name: "amadeus:voice-style-hint",
		order: STYLE_HINT_ORDER,
		text: PERSONA_CANDIDATES_HINT
	});
	if (config.registerSkill) ctx.skills.registerProvider(() => voiceChatSkillProvider);
}
export { Config, apply, inject, name };
