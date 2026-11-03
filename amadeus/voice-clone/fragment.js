// src/fragment.ts
/**
* Voice-clone contracts.
*
* The original cloned voices by POSTing a multipart form to SiliconFlow. The
* rules worth pinning are: which audio forms are accepted, what a valid voice id
* looks like, and how a reference recording is turned into the base64 payload
* the API expects.
*/
/** Audio formats accepted as a cloning reference. */
const REFERENCE_FORMATS = [
	"wav",
	"mp3",
	"m4a",
	"flac"
];
const EXTENSION_TO_FORMAT = {
	".wav": "wav",
	".mp3": "mp3",
	".m4a": "m4a",
	".flac": "flac"
};
const MIME_BY_FORMAT = {
	wav: "audio/wav",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	flac: "audio/flac"
};
/** Detect a supported reference format from a filename. */
function referenceFormatFrom(filename) {
	const dot = filename.lastIndexOf(".");
	if (dot < 0) return void 0;
	return EXTENSION_TO_FORMAT[filename.slice(dot).toLowerCase()];
}
/** MIME type for a reference format. */
function referenceMime(format) {
	return MIME_BY_FORMAT[format];
}
/** The transcript that must accompany the reference audio. */
function validateReferenceText(text) {
	const trimmed = text.trim();
	if (trimmed === "") throw new Error("amadeus_voice_clone: `referenceText` is required — the voice service needs the exact words spoken in the recording");
	if (trimmed.length > 500) throw new Error("amadeus_voice_clone: `referenceText` must be at most 500 characters");
	return trimmed;
}
/** Normalise a requested custom voice name. */
function validateCustomName(name) {
	const trimmed = name.trim();
	if (trimmed === "") throw new Error("amadeus_voice_clone: `name` is required");
	if (trimmed.length > 64) throw new Error("amadeus_voice_clone: `name` must be at most 64 characters");
	return trimmed;
}
/**
* Extract the voice id from a clone response.
*
* SiliconFlow answers `{ uri: "speech:siliconflow-<name>:<id>:<model>" }`; older
* deployments answered `{ voice: "..." }`. Both are accepted, and a missing id is
* an error rather than a silent success.
*/
function extractVoiceId(payload) {
	if (payload !== null && typeof payload === "object") {
		const record = payload;
		for (const key of [
			"uri",
			"voice",
			"voice_id",
			"id"
		]) {
			const value = record[key];
			if (typeof value === "string" && value.trim() !== "") return value.trim();
		}
	}
	throw new Error("amadeus_voice_clone: the clone service did not return a voice id");
}
/** Turn raw bytes into the `data:<mime>;base64,...` string the API accepts. */
function toAudioDataUri(bytes, mimeType) {
	let binary = "";
	const chunk = 32768;
	for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	return `data:${mimeType};base64,${btoa(binary)}`;
}
/** Narrow opaque persisted meta back to {@link VoiceCloneMeta}. */
function voiceCloneMetaFrom(meta) {
	if (meta === null || typeof meta !== "object") return void 0;
	const record = meta;
	if (record.kind !== "amadeus-voice-clone" || typeof record.voiceId !== "string") return void 0;
	return {
		kind: "amadeus-voice-clone",
		voiceId: record.voiceId,
		name: typeof record.name === "string" ? record.name : "",
		model: typeof record.model === "string" ? record.model : "",
		referenceText: typeof record.referenceText === "string" ? record.referenceText : "",
		byteLength: typeof record.byteLength === "number" ? record.byteLength : 0,
		format: typeof record.format === "string" ? record.format : ""
	};
}
export { REFERENCE_FORMATS, extractVoiceId, referenceFormatFrom, referenceMime, toAudioDataUri, validateCustomName, validateReferenceText, voiceCloneMetaFrom };
