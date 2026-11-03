# @amadeus/persona

Amadeus 人格：角色系统提示段落 + 按需加载的语音对话技能。

来源：原项目 `service/webrtc/utils/prompt_utils.py` 的 `generate_sys_prompt()`。

## 贡献

- 系统提示段落 `amadeus:persona`（order 900）：<Instruction>/<Personality>/<Output_style>/<Output_language>/<Attention*>/<Interaction>/<InnerMonologue*>/<CurrentUser>/<CurrentTime>
- 系统提示段落 `amadeus:voice-style-hint`（order 901）
- 技能 provider `amadeus-persona`，提供 `amadeus-voice-chat`（候选常驻、正文懒加载）

## 工具

（无工具；本插件只提供提示词与技能）

## 配置

| 键 | 默认值 |
| --- | --- |
| `persona` | 牧濑红莉栖人格描述 |
| `voiceLanguage` | `ja` |
| `textLanguage` | `zh` |
| `userName` | `用户` |
| `registerSkill` | `true` |

## 说明

`buildPersonaPrompt` 在语音与文本语言相同时输出「语音与文本均使用X」，不同时输出「语音使用X，文本使用Y」；`<CurrentTime>` 每次组装时重新取值。

本插件还承载**跨插件集成测试**（`test/integration.test.mjs`），把 8 个插件挂进同一个 Cordis Context 做校验。

## 构建与测试

```bash
node ../../scripts/build.mjs amadeus-persona
node --test test/*.test.mjs
npx tsc -p tsconfig.json --noEmit
```
