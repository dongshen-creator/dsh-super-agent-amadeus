// src/fragment.ts
const FORMAT_BY_EXTENSION = {
	".wav": "wav",
	".mp3": "mp3",
	".m4a": "m4a",
	".webm": "webm",
	".ogg": "ogg",
	".flac": "flac"
};
/** MIME type used when the caller only supplies a container format. */
const MIME_BY_FORMAT = {
	wav: "audio/wav",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	webm: "audio/webm",
	ogg: "audio/ogg",
	flac: "audio/flac"
};
/** Detect a supported audio format from a filename, or `undefined`. */
function formatFromFilename(filename) {
	const dot = filename.lastIndexOf(".");
	if (dot < 0) return void 0;
	return FORMAT_BY_EXTENSION[filename.slice(dot).toLowerCase()];
}
/** Map a format onto the MIME type a multipart upload should declare. */
function mimeForFormat(format) {
	return MIME_BY_FORMAT[format];
}
/** Sniff a supported audio format from the first bytes of a buffer. */
function formatFromMagicBytes(bytes) {
	if (bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 65 && bytes[10] === 86 && bytes[11] === 69) return "wav";
	if (bytes.length >= 3 && bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51) return "mp3";
	if (bytes.length >= 2 && bytes[0] === 255 && (bytes[1] & 224) === 224) return "mp3";
	if (bytes.length >= 4 && bytes[0] === 79 && bytes[1] === 103 && bytes[2] === 103 && bytes[3] === 83) return "ogg";
	if (bytes.length >= 4 && bytes[0] === 26 && bytes[1] === 69 && bytes[2] === 223 && bytes[3] === 163) return "webm";
	if (bytes.length >= 4 && bytes[0] === 102 && bytes[1] === 76 && bytes[2] === 97 && bytes[3] === 67) return "flac";
	if (bytes.length >= 12 && bytes[4] === 102 && bytes[5] === 116 && bytes[6] === 121 && bytes[7] === 112) return "m4a";
}
/**
* Normalise a transcription response body.
*
* Whisper-compatible servers return either `{ text }` or a raw string, and some
* proxies wrap it. Anything unexpected degrades to the empty string, matching
* the original `transcribe()` behaviour (a failed STT yields no user turn).
*/
function extractTranscript(payload) {
	if (typeof payload === "string") return payload.trim();
	if (payload !== null && typeof payload === "object") {
		const record = payload;
		if (typeof record.text === "string") return record.text.trim();
	}
	return "";
}
/**
* Decide whether a transcript is usable as a user turn.
*
* Voice activity detection upstream already trims silence; this guard drops
* what Whisper hallucinates on near-silent audio (a lone "." or "[Music]").
*/
function isUsableTranscript(text) {
	if (text.replace(/[\s.,!?;:'"()[\]{}<>-]/g, "").length === 0) return false;
	if (/^\[(music|noise|silence|blank_audio)\]$/i.test(text.trim())) return false;
	return true;
}
/** Summarise a transcript for the model-facing one-liner. */
function summarizeTranscript(text, language) {
	const preview = text.length > 120 ? `${text.slice(0, 120)}…` : text;
	return language ? `转录完成（${language}）：${preview}` : `转录完成：${preview}`;
}
/** Narrow opaque persisted meta back to {@link TranscriptMeta}. */
function transcriptMetaFrom(meta) {
	if (meta === null || typeof meta !== "object") return void 0;
	const record = meta;
	if (record.kind !== "amadeus-transcript" || typeof record.text !== "string") return void 0;
	return {
		kind: "amadeus-transcript",
		text: record.text,
		language: typeof record.language === "string" ? record.language : void 0,
		durationSeconds: typeof record.durationSeconds === "number" ? record.durationSeconds : void 0,
		model: typeof record.model === "string" ? record.model : void 0,
		usable: record.usable === true
	};
}
export { extractTranscript, formatFromFilename, formatFromMagicBytes, isUsableTranscript, mimeForFormat, summarizeTranscript, transcriptMetaFrom };
