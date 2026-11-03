# @amadeus/stt

Amadeus 语音转文字：用 Whisper 兼容端点转录音频。

来源：原项目 `service/webrtc/stt/transcribe.py`。

## 贡献

- 工具 `amadeus_transcribe`
- 系统提示段落 `tool:amadeus_transcribe`（order 910）

## 工具

`amadeus_transcribe(path, language?)` → 转写文本 + 元数据。

格式从扩展名或文件头魔数判断（RIFF/WAVE、ID3、MPEG 同步字、OggS、EBML、fLaC、ftyp）。`[Music]`、`[BLANK_AUDIO]`、单独的 `.` 会被判为不可用并丢弃。

## 配置

| 键 | 默认值 |
| --- | --- |
| `baseUrl` | `AMADEUS_WHISPER_BASE_URL`（必填） |
| `apiKey` | `AMADEUS_WHISPER_API_KEY` |
| `model` | `whisper-large-v3` |
| `language` | 空（自动检测） |
| `timeoutMs` | `120000` |

## 说明

`makeTranscriber(config, fetchImpl)` 接收可注入 fetch，测试完全不联网。

## 构建与测试

```bash
node ../../scripts/build.mjs amadeus-stt
node --test test/*.test.mjs
npx tsc -p tsconfig.json --noEmit
```
