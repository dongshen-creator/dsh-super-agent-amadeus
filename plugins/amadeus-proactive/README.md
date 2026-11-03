# @amadeus/proactive

Amadeus 主动对话：用户沉默时，让角色自己挑下一步行动。

来源：原项目 `service/webrtc/ai/plan.py` 与 WebRTC 服务里的 ActionPlanner。

## 贡献

- 工具 `amadeus_proactive_plan`
- 系统提示段落 `tool:amadeus_proactive_plan`（order 915）

## 工具

`amadeus_proactive_plan(recent[], situation?)` → 5 种行动之一 + 给模型的 `prompt`。

行动枚举与原实现一致：`continue_topic, change_topic, ask_question, share_memory, express_emotion`；失败回退 `share_memory`。

返回的 `prompt` 是 `[AI主动发起对话]next Action: <action>`——保留了原项目的标记，所以按这个标记写的旧人格提示词继续有效。

## 配置

| 键 | 默认值 |
| --- | --- |
| `baseUrl` | `https://api.openai.com/v1` |
| `apiKey` | `AMADEUS_LLM_API_KEY`（必填） |
| `model` | `gpt-4.1-nano` |
| `timeoutMs` | `30000` |

## 说明

历史为空时直接返回 `share_memory`（`confident: true`），不发请求——与原实现的默认路径一致。规划器 prompt 逐字取自 `plan.py`。

## 构建与测试

```bash
node ../../scripts/build.mjs amadeus-proactive
node --test test/*.test.mjs
npx tsc -p tsconfig.json --noEmit
```
