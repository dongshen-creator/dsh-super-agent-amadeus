import { extractVoiceId, referenceFormatFrom, referenceMime, toAudioDataUri, validateCustomName, validateReferenceText } from "./fragment.js";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
// src/api.ts
/**
* Voice-clone client with an injectable fetch and optional per-request proxy.
*
* Two lessons from the skill's http-client guidance are applied here: fetch is
* never hard-wired, and a proxy (when configured) is applied per request via
* undici's ProxyAgent because mutating process-wide env after startup has no
* effect on an already-initialised dispatcher.
*/
/** Build a fetch implementation that honours the configured proxy. */
async function makeFetch(proxyUrl, fetchImpl = fetch) {
	if (!proxyUrl) return fetchImpl;
	try {
		const undici = await import("undici");
		const dispatcher = new undici.ProxyAgent({ uri: proxyUrl });
		const proxied = ((input, init) => undici.fetch(input, {
			...init,
			dispatcher
		}));
		return proxied;
	} catch {
		return fetchImpl;
	}
}
function makeVoiceCloner(config, fetchImpl) {
	let resolved = fetchImpl;
	const getFetch = async () => {
		if (resolved === void 0) resolved = await makeFetch(config.proxyUrl);
		return resolved;
	};
	return { async clone(input) {
		if (!config.apiKey) throw new Error("amadeus_voice_clone: no API key configured (set apiKey or AMADEUS_SILICONFLOW_API_KEY)");
		const doFetch = await getFetch();
		const referenceText = validateReferenceText(input.referenceText);
		const name = validateCustomName(input.name);
		const filename = basename(input.path);
		const format = referenceFormatFrom(filename);
		if (!format) throw new Error(`amadeus_voice_clone: unsupported reference format for ${filename}; use wav, mp3, m4a or flac`);
		const bytes = new Uint8Array(await readFile(input.path));
		if (bytes.byteLength === 0) throw new Error("amadeus_voice_clone: the reference recording is empty");
		const form = new FormData();
		form.append("audio", toAudioDataUri(bytes, referenceMime(format)));
		form.append("model", config.model);
		form.append("customName", name);
		form.append("text", referenceText);
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), config.timeoutMs);
		try {
			const response = await doFetch(`${config.baseUrl.replace(/\/+$/, "")}/uploads/audio/voice`, {
				method: "POST",
				headers: { Authorization: `Bearer ${config.apiKey}` },
				body: form,
				signal: controller.signal
			});
			if (!response.ok) {
				const body = await response.text().catch(() => "");
				if (response.status >= 400 && response.status < 500) throw new Error("amadeus_voice_clone: the voice service rejected the request — check that the account is verified and the API key is correct" + (body ? ` (${body.slice(0, 200)})` : ""));
				throw new Error(`amadeus_voice_clone: clone endpoint returned ${response.status} ${response.statusText}` + (body ? ` — ${body.slice(0, 300)}` : ""));
			}
			return {
				voiceId: extractVoiceId(await response.json()),
				name,
				model: config.model,
				referenceText,
				byteLength: bytes.byteLength,
				format
			};
		} catch (error) {
			if (error instanceof Error && error.name === "AbortError") throw new Error(`amadeus_voice_clone: cloning timed out after ${config.timeoutMs}ms`);
			throw error;
		} finally {
			clearTimeout(timer);
		}
	} };
}
export { makeFetch, makeVoiceCloner };
