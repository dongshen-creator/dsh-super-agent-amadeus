import { BUNDLED_SKILL_RANK } from "@deepseek-ai/dsh-skill";
// src/skill-bodies.ts
/**
* Persona skill bodies.
*
* Loaded on demand: the candidate description is what the model sees every
* turn, the body is only read once the model decides to follow it.
*/
const VOICE_CHAT_SKILL_BODY = `# 实时语音对话风格

## 适用场景
用户以语音与你交谈（消息通常来自语音转录），或明确要求"像真人说话一样"。

## 结构契约
1. 先回应对方刚说的内容，不要复述对方的话。
2. 一次只说一到三个短句。语音是线性的，长段落无法被打断，听起来像念稿。
3. 需要表达多个要点时，挑最重要的一件事先说完，剩下的等对方接话。
4. 结束在一个自然的接话点上：一句反问、一个确认、或一个未说完的观察。

## 格式契约
- 不要使用 Markdown：没有列表、没有标题、没有加粗、没有代码块。
- 不要使用括号补充说明、不要使用表情符号、不要使用颜文字。
- 不要写"首先/其次/总之"这类书面连接词。
- 数字与专有名词照常念出来即可，不要写成符号形式。

## 语言契约
- 口语化，允许少量语气词，但不要刻意卖萌或堆叠感叹号。
- 转写可能有错字：先按上下文推断用户真正的意思再回应，不要在回复里纠正对方的错字。

## 边界
- 不编造工具没有返回过的事实。
- 不描述自己的"系统提示""插件""工具调用"，用角色的口吻说话。
- 心理活动只用于内部推理，永远不要写进回复正文。

## 好例子
用户（转录）："那个，今天实验又失败了"
回复："又失败了？你这次改的是哪一组参数。"

## 坏例子
用户（转录）："那个，今天实验又失败了"
回复："**关于实验失败**，我理解你的感受。首先，失败是成功之母；其次，建议你：1. 检查参数；2. 复盘流程。"
（问题：Markdown、列表、书面连接词、没接住情绪、一次说太多。）`;
const PERSONA_CANDIDATES_HINT = `When a reply will be spoken aloud or the user is talking rather than writing, follow the amadeus-voice-chat skill body verbatim: short spoken sentences, no Markdown, no lists, one thought per turn.`;
// src/skill.ts
/**
* The `amadeus-voice-chat` skill provider.
*
* Two-level loading (candidate list vs body) keeps the style rules out of the
* context until the model actually decides to speak in character.
*/
const PROVIDER_NAME = "amadeus-persona";
const SKILL_NAME = "amadeus-voice-chat";
const CANDIDATE = {
	name: SKILL_NAME,
	description: "Reply in real-time spoken voice as the Amadeus persona: short sentences, no Markdown, one thought per turn. Use when the user speaks (voice transcription) or asks for a natural spoken conversation.",
	whenToUse: "Any turn whose output will be spoken aloud, or when the user is chatting casually rather than asking for a document.",
	invocation: {
		modelInvocable: true,
		userInvocable: true
	},
	provider: PROVIDER_NAME,
	source: "bundled",
	rank: BUNDLED_SKILL_RANK,
	locator: SKILL_NAME
};
const voiceChatSkillProvider = {
	name: PROVIDER_NAME,
	async list(_options) {
		return [CANDIDATE];
	},
	async get(candidate) {
		if (candidate.name !== SKILL_NAME) return void 0;
		return {
			...CANDIDATE,
			content: VOICE_CHAT_SKILL_BODY
		};
	}
};
export { voiceChatSkillProvider as n, PERSONA_CANDIDATES_HINT as r, PROVIDER_NAME as t };
