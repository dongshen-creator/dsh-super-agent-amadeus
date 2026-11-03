# @amadeus/emotion

Amadeus 表情：把一句台词分类成 Live2D 动作，并渲染表情徽章。

来源：原项目 `service/webrtc/ai/emotion.py`。

## 贡献

- 工具 `amadeus_emotion`
- 系统提示段落 `tool:amadeus_emotion`（order 912）
- 浏览器卡片：表情徽章（动作名 + 中文标签 + 配色）

## 工具

`amadeus_emotion(text)` → 9 种动作之一 + 标签 + 配色。

动作枚举与原实现逐字一致：`neutral, anger, joy, sadness, shy, shy2, smile1, smile2, unhappy`。分类失败回退 `neutral`（`confident: false`）。请求用 `json_schema` + `strict` 约束输出，避免解析失败。

## 配置

| 键 | 默认值 |
| --- | --- |
| `baseUrl` | `https://api.openai.com/v1` |
| `apiKey` | `AMADEUS_LLM_API_KEY`（必填） |
| `model` | `gpt-4.1-nano` |
| `timeoutMs` | `30000` |

## 说明

分类器 prompt 逐字取自原项目：

> 你现在是一个虚拟形象的动作驱动器，你需要根据输入的虚拟形象的语言，驱动虚拟形象的动作和表情，请尽量输出得随机并丰富一些

## 构建与测试

```bash
node ../../scripts/build.mjs amadeus-emotion
node --test test/*.test.mjs
npx tsc -p tsconfig.json --noEmit
```
