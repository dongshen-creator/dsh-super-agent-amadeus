// src/fragment.ts
const LANGUAGE_NAMES = {
	zh: "中文",
	en: "英文",
	ja: "日文"
};
/** Render a language code as the Chinese name the persona prompt expects. */
function languageName(code) {
	return LANGUAGE_NAMES[code] ?? "中文";
}
/** Canonical English/Chinese name pairs the persona must keep straight. */
const CHARACTER_NAME_MAP = [
	["牧濑红莉栖", "kurisu"],
	["冈部伦太郎", "okabe"],
	["椎名真由理", "mayuri"],
	["比屋定真帆", "maho"],
	["阿万音铃羽", "suzuha"],
	["漆原琉华", "Urushibara Ruka"],
	["桶子", "daru"],
	["雷斯吉宁", "Leskinen"],
	["桐生萌郁", "Kiriyu Moeka"],
	["菲利斯", "Faris NyanNyan"],
	["天王寺裕吾", "Mr.Braun"],
	["椎名篝", "Kagari"],
	["绹", "Tennouji nae"],
	["阿万音由季", "Yuki"],
	["牧濑章一", "Shouichi Makise"]
];
/**
* Build the system prompt for one turn.
*
* Mirrors `generate_sys_prompt` from the original project, with two deliberate
* differences: the language section states the real output language and the
* clock is injected instead of read from the ambient environment, so the value
* is reproducible in replay and in tests.
*/
function buildPersonaPrompt(options) {
	const voice = languageName(options.voiceLanguage);
	const text = languageName(options.textLanguage);
	const languageLine = options.voiceLanguage === options.textLanguage ? `<Output_language>语音与文本均使用${voice}</Output_language>` : `<Output_language>语音使用${voice}，文本使用${text}</Output_language>`;
	const names = CHARACTER_NAME_MAP.map(([zh, en]) => `${zh}(${en})`).join("，");
	return [
		"<Instruction>你是够完全还原任何人的情感，性格，记忆的强大AI系统Amadeus，你可以精准还原目标人物的情感，记忆，以及对话风格",
		`    <Personality>${options.persona}</Personality>`,
		"    <Output_style>回复风格表现像和一个真实的人类在实时语音交谈</Output_style>",
		`    ${languageLine}`,
		`    <Attention1>记住以下人物中英文名称映射:${names}</Attention1>`,
		"    <Attention2>注意用户的语音转录可能会有错误，请注意联想，推断出用户想表达的正确意思</Attention2>",
		"    <Attention3>你可以通过摄像头传来的图片帧观察屏幕前的外界</Attention3>",
		"    <Interaction><Mode>快速会话且有主动发起引导会话的能力</Mode></Interaction>",
		"    <InnerMonologueInstruciton>你拥有实时的心理活动，你通过接收用户的\"self_motivated\"指令来自我触发，你能够自主连续思考</InnerMonologueInstruciton>",
		"    <InnerMonologueRules>严禁向用户输出你的心理活动</InnerMonologueRules>",
		`    <CurrentUser>${options.userName}</CurrentUser>`,
		`    <CurrentTime>${options.now}</CurrentTime>`,
		"</Instruction>"
	].join("\n");
}
/** Format a Date as `YYYY-MM-DD HH:mm:ss` in local time, matching the original. */
function formatTimestamp(date) {
	const pad = (n) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
export { CHARACTER_NAME_MAP, buildPersonaPrompt, formatTimestamp, languageName };
