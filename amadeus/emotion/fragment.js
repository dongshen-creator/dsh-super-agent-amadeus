// src/fragment.ts
/**
* Emotion contracts.
*
* The original project asked an LLM to classify a reply into one of nine
* Live2D motions. Those names, the prompt, and the fallback behaviour are
* ported verbatim so the same model files still drive the same expressions.
*/
/** Motion names the Live2D model exposes (from `ai/emotion.py`). */
const EMOTIONS = [
	"neutral",
	"anger",
	"joy",
	"sadness",
	"shy",
	"shy2",
	"smile1",
	"smile2",
	"unhappy"
];
/** Default when classification fails — matches the original `predict_emotion`. */
const DEFAULT_EMOTION = "neutral";
/** Classifier system prompt, copied from `ai/emotion.py`. */
const EMOTION_SYSTEM_PROMPT = "你现在是一个虚拟形象的动作驱动器，你需要根据输入的虚拟形象的语言，驱动虚拟形象的动作和表情，请尽量输出得随机并丰富一些";
/** Whether a value is one of the nine motion names. */
function isEmotion(value) {
	return typeof value === "string" && EMOTIONS.includes(value);
}
/** Coerce any classifier output into a valid emotion, defaulting to neutral. */
function normalizeEmotion(value) {
	return isEmotion(value) ? value : DEFAULT_EMOTION;
}
/** Short human label used by the card. */
const EMOTION_LABELS = {
	neutral: "平静",
	anger: "生气",
	joy: "开心",
	sadness: "难过",
	shy: "害羞",
	shy2: "更害羞",
	smile1: "微笑",
	smile2: "笑",
	unhappy: "不高兴"
};
/** Emoji-free accent colour per emotion, used by the card. */
const EMOTION_COLORS = {
	neutral: "rgba(148, 163, 184, 0.22)",
	anger: "rgba(248, 113, 113, 0.22)",
	joy: "rgba(250, 204, 21, 0.22)",
	sadness: "rgba(96, 165, 250, 0.22)",
	shy: "rgba(244, 114, 182, 0.22)",
	shy2: "rgba(232, 121, 249, 0.22)",
	smile1: "rgba(74, 222, 128, 0.22)",
	smile2: "rgba(52, 211, 153, 0.22)",
	unhappy: "rgba(251, 146, 60, 0.22)"
};
/** Narrow opaque persisted meta back to {@link EmotionMeta}. */
function emotionMetaFrom(meta) {
	if (meta === null || typeof meta !== "object") return void 0;
	const record = meta;
	if (record.kind !== "amadeus-emotion" || !isEmotion(record.emotion)) return void 0;
	return {
		kind: "amadeus-emotion",
		emotion: record.emotion,
		label: typeof record.label === "string" ? record.label : EMOTION_LABELS[record.emotion],
		color: typeof record.color === "string" ? record.color : EMOTION_COLORS[record.emotion],
		text: typeof record.text === "string" ? record.text : "",
		confident: record.confident === true
	};
}
export { DEFAULT_EMOTION, EMOTIONS, EMOTION_COLORS, EMOTION_LABELS, EMOTION_SYSTEM_PROMPT, emotionMetaFrom, isEmotion, normalizeEmotion };
