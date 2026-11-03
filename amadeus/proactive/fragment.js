// src/fragment.ts
/**
* Proactive-planning contracts.
*
* The original `ActionPlanner` let an LLM pick one of five self-initiated moves
* and fell back to `share_memory` on any failure. Both the vocabulary and the
* fallback are reproduced here.
*/
/** The five moves from `ai/plan.py`. */
const ACTIONS = [
	"continue_topic",
	"change_topic",
	"ask_question",
	"share_memory",
	"express_emotion"
];
/** Default when planning fails — matches `plan_next_action`. */
const DEFAULT_ACTION = "share_memory";
/** Planner system prompt, copied from `ai/plan.py`. */
const PLANNER_SYSTEM_PROMPT = "你现在是一个智能体的主动行动模块部分，根据当前智能体和用户的上下文，为我的智能体随机选择下一步行动";
function isAction(value) {
	return typeof value === "string" && ACTIONS.includes(value);
}
/** Coerce classifier output into a valid action, defaulting to share_memory. */
function normalizeAction(value) {
	return isAction(value) ? value : DEFAULT_ACTION;
}
/** Guidance handed to the model for each move. */
const ACTION_GUIDES = {
	continue_topic: "顺着刚才的话题再补一句，把对话往前推。",
	change_topic: "换一个相关但不同的话题，给对话一个新方向。",
	ask_question: "向用户提一个具体的问题，把话头交回给对方。",
	share_memory: "提起一件与当前情境相关的记忆或见闻。",
	express_emotion: "表达自己此刻的感受，让对话带上情绪。"
};
/** Human label for the card. */
const ACTION_LABELS = {
	continue_topic: "继续话题",
	change_topic: "切换话题",
	ask_question: "提问",
	share_memory: "分享记忆",
	express_emotion: "表达情感"
};
/**
* Build the instruction the model receives when a proactive move fires.
*
* The original sent the literal string `[AI主动发起对话]next Action: <action>`
* as the user turn; the same marker is kept so an existing persona prompt that
* keys on it continues to work.
*/
function buildProactivePrompt(action) {
	return `[AI主动发起对话]next Action: ${action}`;
}
/** Narrow opaque persisted meta back to {@link ProactiveMeta}. */
function proactiveMetaFrom(meta) {
	if (meta === null || typeof meta !== "object") return void 0;
	const record = meta;
	if (record.kind !== "amadeus-proactive" || !isAction(record.action)) return void 0;
	return {
		kind: "amadeus-proactive",
		action: record.action,
		label: typeof record.label === "string" ? record.label : ACTION_LABELS[record.action],
		guide: typeof record.guide === "string" ? record.guide : ACTION_GUIDES[record.action],
		prompt: typeof record.prompt === "string" ? record.prompt : buildProactivePrompt(record.action),
		confident: record.confident === true
	};
}
export { ACTIONS, ACTION_GUIDES, ACTION_LABELS, DEFAULT_ACTION, PLANNER_SYSTEM_PROMPT, buildProactivePrompt, isAction, normalizeAction, proactiveMetaFrom };
