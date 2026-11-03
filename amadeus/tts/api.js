import { estimateDurationSeconds, toSegments } from "./fragment.js";
// src/api.ts
/**
* CosyVoice2 (SiliconFlow) speech synthesis client.
*
* The upstream API answers with raw PCM and the original project streamed it
* chunk-by-chunk into the WebRTC track. In a tool call there is no live track,
* so the same PCM is collected, wrapped in a WAV header, and returned as one
* playable data URI.
*/
/** Prepend a canonical 44-byte WAV header to little-endian PCM data. */
function pcmToWav(pcm, sampleRate, channels = 1, bitsPerSample = 16) {
	const header = /* @__PURE__ */ new ArrayBuffer(44);
	const view = new DataView(header);
	const writeAscii = (offset, text) => {
		for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
	};
	const blockAlign = channels * bitsPerSample / 8;
	writeAscii(0, "RIFF");
	view.setUint32(4, 36 + pcm.byteLength, true);
	writeAscii(8, "WAVE");
	writeAscii(12, "fmt ");
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, channels, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * blockAlign, true);
	view.setUint16(32, blockAlign, true);
	view.setUint16(34, bitsPerSample, true);
	writeAscii(36, "data");
	view.setUint32(40, pcm.byteLength, true);
	const out = new Uint8Array(44 + pcm.byteLength);
	out.set(new Uint8Array(header), 0);
	out.set(pcm, 44);
	return out;
}
/** Encode bytes as a base64 data URI without Node-only helpers (browser-safe). */
function toDataUri(bytes, mimeType) {
	let binary = "";
	const chunk = 32768;
	for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	return `data:${mimeType};base64,${btoa(binary)}`;
}
function makeSynthesizer(config, fetchImpl = fetch) {
	return {
		/** Synthesise one clause and return raw PCM bytes. */
		async synthesizeClause(text) {
			if (!config.apiKey) throw new Error("amadeus_tts: no API key configured (set apiKey or AMADEUS_SILICONFLOW_API_KEY)");
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), config.timeoutMs);
			try {
				const response = await fetchImpl(`${config.baseUrl.replace(/\/+$/, "")}/audio/speech`, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${config.apiKey}`,
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						model: config.model,
						input: text,
						voice: config.voice,
						sample_rate: config.sampleRate,
						response_format: "pcm"
					}),
					signal: controller.signal
				});
				if (!response.ok) {
					const body = await response.text().catch(() => "");
					throw new Error(`amadeus_tts: synthesis endpoint returned ${response.status} ${response.statusText}` + (body ? ` — ${body.slice(0, 300)}` : ""));
				}
				return new Uint8Array(await response.arrayBuffer());
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") throw new Error(`amadeus_tts: synthesis timed out after ${config.timeoutMs}ms`);
				throw error;
			} finally {
				clearTimeout(timer);
			}
		},
		/**
		* Synthesise a whole reply clause by clause, then join the PCM.
		* Clauses are synthesised in order so the result keeps the original pacing;
		* a failing clause is reported instead of silently shortening the audio.
		*/
		async synthesize(text, minSegmentLength) {
			const segments = toSegments(text, minSegmentLength);
			if (segments.length === 0) throw new Error("amadeus_tts: nothing to synthesise; the reply text was empty");
			const chunks = [];
			for (const segment of segments) chunks.push(await this.synthesizeClause(segment.text));
			const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
			const pcm = new Uint8Array(total);
			let offset = 0;
			for (const chunk of chunks) {
				pcm.set(chunk, offset);
				offset += chunk.byteLength;
			}
			return {
				segments,
				wav: pcmToWav(pcm, config.sampleRate),
				mimeType: "audio/wav",
				durationSeconds: estimateDurationSeconds(pcm.byteLength, config.sampleRate),
				voice: config.voice,
				model: config.model
			};
		}
	};
}
export { makeSynthesizer, pcmToWav, toDataUri };
