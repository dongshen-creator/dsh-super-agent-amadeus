# @amadeus/voice-clone

Amadeus 音色克隆：上传参考录音，注册自定义 SiliconFlow 音色。

来源：原项目 `service/src/services/voiceCloneService.ts`。

## 贡献

- 工具 `amadeus_clone_voice`
- 系统提示段落 `tool:amadeus_voice_clone`（order 914）

## 工具

`amadeus_clone_voice(path, referenceText, name)` → 新音色 id。

参考音频支持 `wav/mp3/m4a/flac`；`referenceText` ≤ 500 字，`name` ≤ 64 字。4xx 响应会翻成「请检查账号实名认证与 API Key」，而不是抛出原始 HTTP 错。

## 配置

| 键 | 默认值 |
| --- | --- |
| `baseUrl` | `https://api.siliconflow.cn/v1` |
| `apiKey` | `AMADEUS_SILICONFLOW_API_KEY`（必填） |
| `model` | `FunAudioLLM/CosyVoice2-0.5B` |
| `timeoutMs` | `300000` |
| `proxyUrl` | `AMADEUS_PROXY_URL`，空 = 直连 |

## 说明

`proxyUrl` 用 undici `ProxyAgent({ uri })` **逐请求**注入（v7 必须传对象，传字符串不生效）。undici 是惰性 `import()`，`apply()` 保持同步，注册不会与插件卸载竞态；宿主没有 undici 时退化为直连。

undici 在 tsdown 里被标为 `neverBundle`：它是可选运行时依赖，打进去会给每个安装加约 1 MB。

## 构建与测试

```bash
node ../../scripts/build.mjs amadeus-voice-clone
node --test test/*.test.mjs
npx tsc -p tsconfig.json --noEmit
```
