// src/fragment.ts
/**
* TTS contracts.
*
* The segmentation rules are the load-bearing part of the original project's
* `utils/stream_utils.py`: text is cut at punctuation so synthesis can start
* before the model finishes writing. Ported here as pure functions so the
* browser player, the Node tool and the tests agree on the same segments.
*/
/** Punctuation that ends a speakable clause. */
const PUNCTUATION = /([,.?!，。？！;；])/;
/** Default minimum segment length before a clause is released for synthesis. */
const DEFAULT_MIN_SEGMENT_LENGTH = 15;
/**
* Split text into speakable segments at punctuation, merging clauses shorter
* than `minLength` into the following one.
*
* Mirrors `split_text_by_punctuation` from the original project, with one
* fix: a trailing stub shorter than two characters is dropped only when it has
* no letters (the original dropped any 2-character tail, which ate "好。").
*/
function splitForSpeech(text, minLength = 15) {
	if (text.trim() === "") return [];
	const parts = text.split(PUNCTUATION);
	const merged = [];
	for (let i = 0; i < parts.length; i += 1) {
		const current = parts[i] ?? "";
		const next = parts[i + 1];
		if (next !== void 0 && PUNCTUATION.test(next)) {
			merged.push(current + next);
			i += 1;
		} else if (current.trim() !== "") merged.push(current);
	}
	const result = [];
	let buffer = "";
	for (const piece of merged) {
		if (buffer === "") {
			buffer = piece;
			continue;
		}
		const endsClause = /[,.?!，。？！;；]$/.test(buffer.trim());
		if (buffer.length >= minLength && endsClause) {
			result.push(buffer);
			buffer = piece;
		} else buffer += piece;
	}
	if (buffer !== "") result.push(buffer);
	return result.map((segment) => segment.trim()).filter((segment) => segment.length >= 2 || /[\p{L}\p{N}]/u.test(segment));
}
/** Attach stable ids and indices to raw segments. */
function toSegments(text, minLength = 15) {
	return splitForSpeech(text, minLength).map((segment, index) => ({
		id: `seg-${index + 1}`,
		text: segment,
		index: index + 1
	}));
}
/** Narrow opaque persisted meta back to {@link SpeechMeta}. */
function speechMetaFrom(meta) {
	if (meta === null || typeof meta !== "object") return void 0;
	const record = meta;
	if (record.kind !== "amadeus-speech") return void 0;
	if (typeof record.audio !== "string" || typeof record.mimeType !== "string") return void 0;
	return {
		kind: "amadeus-speech",
		segments: Array.isArray(record.segments) ? record.segments.filter((item) => item !== null && typeof item === "object" && typeof item.id === "string" && typeof item.text === "string" && typeof item.index === "number") : [],
		audio: record.audio,
		mimeType: record.mimeType,
		voice: typeof record.voice === "string" ? record.voice : void 0,
		model: typeof record.model === "string" ? record.model : void 0,
		durationSeconds: typeof record.durationSeconds === "number" ? record.durationSeconds : void 0,
		byteLength: typeof record.byteLength === "number" ? record.byteLength : 0
	};
}
/** One-line summary for the model. */
function summarizeSpeech(segments, byteLength, voice) {
	return `已合成 ${segments} 段语音，共 ${Math.max(1, Math.round(byteLength / 1024))} KB${voice ? `（音色 ${voice}）` : ""}，可在对话中的播放器里试听。`;
}
/** Estimate spoken duration from PCM byte length at a given sample rate. */
function estimateDurationSeconds(byteLength, sampleRate = 32e3, channels = 1) {
	const bytesPerSample = 2;
	if (byteLength <= 0) return 0;
	return byteLength / (sampleRate * bytesPerSample * channels);
}
export { DEFAULT_MIN_SEGMENT_LENGTH, estimateDurationSeconds, speechMetaFrom, splitForSpeech, summarizeSpeech, toSegments };
