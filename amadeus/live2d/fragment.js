// src/fragment.ts
/** Ported from `src/constants/live2d.ts` without changes. */
const LIVE2D_MODELS = { 牧濑红莉栖: {
	path: "https://static.amadeus-web.top/live2dmodels/steinsGateKurisuNew/红莉栖.model3.json",
	scale1: .42,
	scale2: .42,
	x1: 550,
	x2: -100,
	y1: 50,
	y2: 20
} };
/** Role used when the caller names one we do not have a model for. */
const DEFAULT_ROLE = "牧濑红莉栖";
/** The two reference widths the original subtracts the viewport from. */
const REFERENCE_VIEWPORT = {
	desktop: 1620,
	mobile: 380
};
/**
* Reproduce `model.x = config.x1 + (window.innerWidth - 1620) / 2` (and the
* mobile branch). Unknown roles fall back to the default model.
*/
function computeStageLayout(role, viewportWidth, mobile = false, override) {
	const key = role !== void 0 && role in LIVE2D_MODELS ? role : DEFAULT_ROLE;
	const entry = {
		...LIVE2D_MODELS[key],
		...stripUndefined(override)
	};
	const width = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : REFERENCE_VIEWPORT.desktop;
	if (mobile) return {
		role: key,
		modelPath: entry.path,
		scale: entry.scale2,
		x: entry.x2 + (width - REFERENCE_VIEWPORT.mobile) / 2,
		y: entry.y2,
		mobile: true,
		viewportWidth: width
	};
	return {
		role: key,
		modelPath: entry.path,
		scale: entry.scale1,
		x: entry.x1 + (width - REFERENCE_VIEWPORT.desktop) / 2,
		y: entry.y1,
		mobile: false,
		viewportWidth: width
	};
}
function stripUndefined(value) {
	if (value === void 0) return {};
	const out = {};
	for (const [key, item] of Object.entries(value)) if (typeof item === "number" && Number.isFinite(item)) out[key] = item;
	return out;
}
/** The nine expressions `emotion.py` can emit, plus the reset sentinel. */
const EXPRESSIONS = [
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
function isExpression(value) {
	return typeof value === "string" && EXPRESSIONS.includes(value);
}
/**
* `handleEmotion` in the original: `neutral` resets the expression, anything
* containing `random` also resets. Returns the expression to apply, or `''`
* to mean "reset".
*/
function resolveExpression(emotion) {
	if (emotion === void 0 || emotion === "") return "";
	if (emotion.includes("random")) return "";
	if (emotion === "neutral") return "";
	return isExpression(emotion) ? emotion : "";
}
/** Idle motions the original cycles through while speaking or thinking. */
const RANDOM_MOTIONS = [
	"random1",
	"random2",
	"random3",
	"random4",
	"random5"
];
/**
* `playRandomMotion` / `handleMotion`: `speaking` and `thinking` pick a random
* idle motion, everything else plays the named motion.
*/
function resolveMotion(motion, random = Math.random) {
	if (motion === void 0 || motion === "") return "";
	if (motion === "speaking" || motion === "thinking") {
		const index = Math.min(RANDOM_MOTIONS.length - 1, Math.floor(random() * RANDOM_MOTIONS.length));
		return RANDOM_MOTIONS[index];
	}
	return motion;
}
const IDLE_LIMITS = {
	headMin: [
		-12,
		-12,
		-12
	],
	headMax: [
		12,
		12,
		12
	],
	headSpeed: [1e3, 2e3],
	eyesMin: [-.5, -.5],
	eyesMax: [.5, .5],
	eyesSpeed: [1e3, 2e3],
	blinkSpeed: [5e3, 5e3],
	blinkLength: 100,
	lerpFactor: .1
};
/** Same initial values as the `Animation_Control` constructor. */
function createIdleState() {
	return {
		headMove: 0,
		head: [
			0,
			0,
			0
		],
		targetHead: [
			0,
			0,
			0
		],
		eyeMove: 0,
		eyes: [0, 0],
		targetEyes: [-20, 20],
		blinkTime: 0,
		eyeLids: [1, 1],
		blinkState: "Open"
	};
}
function lerp(a, b, t) {
	return a + (b - a) * t;
}
function randomBetween(min, max, random) {
	return random() * (max - min) + min;
}
/**
* Advance the idle animation by one tick, exactly like `head_movement`,
* `eyes_movement` and `eyes_lid_movement` do.
*
* The original wrapped all of this in `if (this.eye_lids_state === 'Blink')`,
* but that field is assigned once in the constructor and never mutated, so the
* guard is always true; it is dropped here with no behaviour change.
*/
function stepIdle(state, currentTime, random = Math.random) {
	const { lerpFactor, headSpeed, headMin, headMax, eyesSpeed, eyesMin, eyesMax, blinkSpeed, blinkLength } = IDLE_LIMITS;
	let headMove = state.headMove;
	let targetHead = state.targetHead;
	if (currentTime > headMove) {
		headMove = currentTime + randomBetween(headSpeed[0], headSpeed[1], random);
		targetHead = [
			randomBetween(headMin[0], headMax[0], random),
			randomBetween(headMin[1], headMax[1], random),
			randomBetween(headMin[2], headMax[2], random)
		];
	}
	const head = [
		lerp(state.head[0], targetHead[0], lerpFactor),
		lerp(state.head[1], targetHead[1], lerpFactor),
		lerp(state.head[2], targetHead[2], lerpFactor)
	];
	let eyeMove = state.eyeMove;
	let targetEyes = state.targetEyes;
	if (currentTime > eyeMove) {
		eyeMove = currentTime + randomBetween(eyesSpeed[0], eyesSpeed[1], random);
		targetEyes = [randomBetween(eyesMin[0], eyesMax[0], random), randomBetween(eyesMin[1], eyesMax[1], random)];
	}
	const eyes = [lerp(state.eyes[0], targetEyes[0], lerpFactor), lerp(state.eyes[1], targetEyes[1], lerpFactor)];
	let blinkTime = state.blinkTime;
	let eyeLids = state.eyeLids;
	let blinkState = state.blinkState;
	if (blinkState === "Blink" && currentTime > blinkTime) {
		blinkTime = currentTime + randomBetween(blinkSpeed[0], blinkSpeed[1], random);
		eyeLids = [1, 1];
		blinkState = "Open";
	} else if (currentTime > blinkTime) {
		blinkTime = currentTime + blinkLength;
		eyeLids = [0, 0];
		blinkState = "Blink";
	}
	return {
		headMove,
		head,
		targetHead,
		eyeMove,
		eyes,
		targetEyes,
		blinkTime,
		eyeLids,
		blinkState
	};
}
/** Parameter names and values pushed into the model each tick. */
function buildParameterValues(state) {
	return [
		{
			name: "ParamAngleX",
			value: state.head[0]
		},
		{
			name: "ParamAngleY",
			value: state.head[1]
		},
		{
			name: "ParamAngleZ",
			value: state.head[2]
		},
		{
			name: "ParamBodyAngleX",
			value: state.head[0] / 10
		},
		{
			name: "ParamBodyAngleY",
			value: state.head[1] / 10
		},
		{
			name: "ParamBodyAngleZ",
			value: state.head[2] / 10
		},
		{
			name: "ParamEyeBallX",
			value: state.eyes[0]
		},
		{
			name: "ParamEyeBallY",
			value: state.eyes[1]
		},
		{
			name: "ParamEyeLOpen",
			value: state.eyeLids[0]
		},
		{
			name: "ParamEyeROpen",
			value: state.eyeLids[1]
		}
	];
}
/** Narrow opaque persisted meta back to {@link StageMeta}. */
function stageMetaFrom(meta) {
	if (meta === null || typeof meta !== "object") return void 0;
	const record = meta;
	if (record.kind !== "amadeus-live2d") return void 0;
	if (typeof record.role !== "string" || typeof record.modelPath !== "string") return void 0;
	if (typeof record.scale !== "number" || typeof record.x !== "number" || typeof record.y !== "number") return;
	return {
		kind: "amadeus-live2d",
		role: record.role,
		modelPath: record.modelPath,
		scale: record.scale,
		x: record.x,
		y: record.y,
		mobile: record.mobile === true,
		emotion: typeof record.emotion === "string" ? record.emotion : "",
		motion: typeof record.motion === "string" ? record.motion : "",
		expression: typeof record.expression === "string" ? record.expression : "",
		parameters: normalizeParameters(record.parameters)
	};
}
function normalizeParameters(value) {
	if (!Array.isArray(value)) return [];
	const out = [];
	for (const item of value) {
		if (item === null || typeof item !== "object") continue;
		const record = item;
		if (typeof record.name !== "string" || typeof record.value !== "number") continue;
		out.push({
			name: record.name,
			value: record.value
		});
	}
	return out;
}
export { DEFAULT_ROLE, EXPRESSIONS, IDLE_LIMITS, LIVE2D_MODELS, RANDOM_MOTIONS, REFERENCE_VIEWPORT, buildParameterValues, computeStageLayout, createIdleState, isExpression, lerp, resolveExpression, resolveMotion, stageMetaFrom, stepIdle };
