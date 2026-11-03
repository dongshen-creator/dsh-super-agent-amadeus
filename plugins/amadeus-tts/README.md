# @amadeus/tts

Amadeus 语音合成：按标点分段、调 CosyVoice2、渲染播放卡片。

来源：原项目 `service/webrtc/tts/speech.py` 与 `utils/stream_utils.py`。

## 贡献

- 工具 `amadeus_speak`
- 系统提示段落 `tool:amadeus_speak`（order 911）
- 浏览器卡片：音频播放器 + 分段列表

## 工具

`amadeus_speak(text, voice?)` → 音频 data URI、分段、时长、字节数。

`splitForSpeech` 复刻 `split_text_by_punctuation`：按 `, . ? ! ， 。 ？ ！ ; ；` 切分，短于 `minSegmentLength` 的子句并入后一句，少于 2 字符的尾段丢弃。

## 配置

| 键 | 默认值 |
| --- | --- |
| `baseUrl` | `https://api.siliconflow.cn/v1` |
| `apiKey` | `AMADEUS_SILICONFLOW_API_KEY`（必填） |
| `voice` | 红莉栖音色 `speech:siliconflow-kurisu:…` |
| `model` | `FunAudioLLM/CosyVoice2-0.5B` |
| `sampleRate` | `32000` |
| `timeoutMs` | `120000` |
| `minSegmentLength` | `15` |

## 说明

API 返回裸 PCM，`pcmToWav` 补 44 字节 RIFF 头再转 data URI，浏览器 `<audio>` 才能直接播。

`minSegmentLength` 默认 15，所以「嗯。好的。」会合成一段；调到 2 才逐句切分。测试覆盖了这个边界。

## 构建与测试

```bash
node ../../scripts/build.mjs amadeus-tts
node --test test/*.test.mjs
npx tsc -p tsconfig.json --noEmit
```
