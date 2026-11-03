# Amadeus 拆解为 DeepSeek Harness 插件

把 [ai-poet/amadeus-system-new](https://github.com/ai-poet/amadeus-system-new) 这个
「Live2D 语音陪伴智能体」整体拆成 **8 个 dsh 插件**。原来的 React/Vite 前端、
Node/Hono 语音克隆服务、Python FastAPI/WebRTC 服务里的每一块能力，现在都是
一个可以独立安装、独立测试的 harness 插件。

- 目标宿主：`dsh 0.1.5-rc.1`（本机安装版本），Cordis `^4`
- 全部插件 Node 端与浏览器端类型检查 0 错误
- 全部插件构建通过，**108 个测试通过**
- 8 个插件在同一个 Cordis Context 里真实挂载成功（见"验证"一节）

---

## 1. 原项目模块 → 插件映射

| 原项目位置 | 原实现 | dsh 插件 | 现在是什么 |
| --- | --- | --- | --- |
| `service/webrtc/utils/prompt_utils.py` | `generate_sys_prompt()` 拼人格提示词 | `@amadeus/persona` | 系统提示段落（order 900/901）+ 按需加载的「语音对话风格」技能 |
| `service/webrtc/stt/transcribe.py` | OpenAI `audio.transcriptions`，`whisper-large-v3` | `@amadeus/stt` | 工具 `amadeus_transcribe` |
| `service/webrtc/tts/speech.py` + `utils/stream_utils.py` | SiliconFlow CosyVoice2，PCM，按标点分段 | `@amadeus/tts` | 工具 `amadeus_speak` + 音频播放卡片 |
| `service/webrtc/ai/emotion.py` | LLM 输出 9 种 Live2D 动作名 | `@amadeus/emotion` | 工具 `amadeus_emotion` + 表情徽章卡片 |
| mem0 记忆（原项目内联在 WebRTC 服务里） | 检索/写入长期记忆，`user_id = md5(用户名+盐)[:16]` | `@amadeus/memory` | 工具 `amadeus_recall` / `amadeus_remember` |
| `service/src/services/voiceCloneService.ts` | 上传参考音频注册自定义音色 | `@amadeus/voice-clone` | 工具 `amadeus_clone_voice`（可选代理） |
| `service/webrtc/ai/plan.py` | LLM 从 5 个主动行动里挑一个 | `@amadeus/proactive` | 工具 `amadeus_proactive_plan` |
| `src/components/Live2dModel/` + `src/constants/live2d.ts` | pixi-live2d 舞台、待机动画状态机、表情/动作切换 | `@amadeus/live2d` | 工具 `amadeus_stage` + 自绘舞台卡片 |

原项目里的 **WebRTC 传输层**没有单独拆成插件：dsh 的会话本身就是传输层，
不需要再实现一遍信令与媒体协商。原项目里 **React 页面外壳**同理，由 harness
的 chat UI 承担。

### 每个插件贡献了什么

| 插件 | 工具 | 系统提示 | 浏览器卡片 | 技能 |
| --- | --- | --- | --- | --- |
| `@amadeus/persona` | — | 2 段 | — | `amadeus-voice-chat` |
| `@amadeus/stt` | `amadeus_transcribe` | 1 段 | — | — |
| `@amadeus/tts` | `amadeus_speak` | 1 段 | 音频播放器 | — |
| `@amadeus/emotion` | `amadeus_emotion` | 1 段 | 表情徽章 | — |
| `@amadeus/memory` | `amadeus_recall`、`amadeus_remember` | 1 段 | — | — |
| `@amadeus/voice-clone` | `amadeus_clone_voice` | 1 段 | — | — |
| `@amadeus/proactive` | `amadeus_proactive_plan` | 1 段 | — | — |
| `@amadeus/live2d` | `amadeus_stage` | 1 段 | 虚拟形象舞台 | — |

系统提示的 order 从 900 递增到 916，人格在前、工具约定在后，互不冲突。

---

## 2. 设计原则（来自 dsh-plugin-developer skill）

1. **`fragment.ts` 只放纯函数**：所有契约（枚举、分段、哈希、动画状态机）都在
   这里，不碰网络也不碰 DOM，因此可以用 `node --test` 直接测。
2. **`api.ts` 收可注入的 `fetch`**：测试注入假 fetch，不联网；真实运行才用全局
   fetch。`voice-clone` 额外支持 per-request `ProxyAgent`。
3. **`tool.ts` 分离 output 与 meta**：`render` 给模型看一句话，结构化数据进
   `presentationMeta`，由浏览器卡片渲染。`execute()` 返回值字段与
   `output.schema` 完全一致（漏一个字段，运行时就会拒掉每一次调用）。
4. **`index.ts` 只做装配**：`Config` + `apply()`，注册工具与提示段落。
5. **浏览器端只用 React + 内联 CSS**：单文件 `lib/client.js`，无动态 `import()`，
   不引 Node 内置模块，不加载任何第三方 CDN 脚本。
6. **凭据只从 `Config`/环境变量读**：不硬编码，也不回显到工具输出。

---

## 3. 目录结构

```
amadeus-dsh-plugins/
├── README.md
├── scripts/
│   ├── scaffold_all.py     # 生成 package.json / tsdown / tsconfig / cordis.patch.yml
│   ├── link_deps.py        # 把宿主 @deepseek-ai/* 以 junction 链进每个插件
│   └── build.mjs           # npm install → link → tsdown → 浏览器产物硬约束自检
└── plugins/
    ├── amadeus-persona/    # 人格提示词 + 语音对话技能
    ├── amadeus-stt/        # 语音转文字
    ├── amadeus-tts/        # 语音合成 + 播放卡片
    ├── amadeus-emotion/    # 表情动作 + 徽章卡片
    ├── amadeus-memory/     # 长期记忆
    ├── amadeus-voice-clone/# 音色克隆
    ├── amadeus-proactive/  # 主动对话规划
    └── amadeus-live2d/     # 虚拟形象舞台
```

每个插件内部结构一致：

```
plugins/<id>/
├── src/
│   ├── fragment.ts   # 纯契约函数（可测）
│   ├── api.ts        # 外部服务客户端（可注入 fetch）
│   ├── tool.ts       # 工具定义（参数 / output / meta）
│   ├── index.ts      # 插件入口（Config + apply）
│   └── client/       # 浏览器卡片（仅 tts / emotion / live2d）
├── test/*.test.mjs
├── cordis.patch.yml
├── package.json
└── tsdown.config.ts
```

---

## 4. 构建与测试

前置：**Node ≥ 22**（本机 v24），Python 3（只用于两个辅助脚本）。

```bash
cd amadeus-dsh-plugins

# 1. 生成/刷新骨架（只在新增插件或改模板时需要）
python scripts/scaffold_all.py

# 2. 一键构建全部 8 个插件
#    （自动完成 npm install → link_deps → tsdown → 浏览器产物自检）
node scripts/build.mjs

# 3. 只构建某几个
node scripts/build.mjs amadeus-tts amadeus-live2d

# 4. 跑测试
for d in plugins/*/; do (cd "$d" && node --test test/*.test.mjs); done

# 5. 类型检查
for d in plugins/*/; do (cd "$d" && npx tsc -p tsconfig.json --noEmit); done
for d in plugins/amadeus-{tts,emotion,live2d}; do
  (cd "$d" && npx tsc -p tsconfig.client.json --noEmit)
done
```

`scripts/build.mjs` 会对每个浏览器产物强制检查三件事，任何一条不满足就构建失败：

- 必须被 `window.__ModuleLoader__.load({...})` 包裹；
- 不允许出现动态 `import(`；
- 只允许 require `react`、`react/jsx-runtime`、`@deepseek-ai/dsh-client-*`。

### 依赖是怎么接进来的

dsh 把宿主包都装在自己目录里，插件靠 junction（Windows）软链过去，而不是从 npm
另装一份——这样插件编译时用的就是**当前运行中的 dsh** 的 API。`link_deps.py`
必须跑在 `npm install` 之后（npm 会清掉它不认识的目录），`build.mjs` 已经按这个
顺序编排。

---

## 5. 安装到 profile

先构建出 `lib/index.js`，再以 `file:` 方式加入：

```bash
dsh plugin --profile <profile> add file:<绝对路径>/plugins/amadeus-persona
dsh plugin --profile <profile> add file:<绝对路径>/plugins/amadeus-tts
# …每个插件一条
```

`cordis.patch.yml` 会把插件插进 profile 的 layer stack，不需要手改配置。

> **注意：`file:` 安装是复制，不是软链。** 改了代码必须重新
> `node scripts/build.mjs <id>`，然后把产物同步到 profile 并重启 dsh，否则运行的
> 还是旧代码。

只装一部分也可以——插件之间没有硬依赖。最小可用组合是 `persona` + `tts`；
想要"语音对话 + 表情 + 记忆"再加上 `stt`、`emotion`、`memory`。

---

## 6. 配置参考

所有可调项都在各自插件的 `Config`（schemastery `z.object`）里，可在 profile 补丁
层覆盖。默认值优先读环境变量，其次用内置默认。

| 插件 | 配置项 | 默认值 / 环境变量 |
| --- | --- | --- |
| persona | `persona` | 牧濑红莉栖人格描述 |
| | `voiceLanguage` / `textLanguage` | `ja` / `zh` |
| | `userName` | `用户` |
| | `registerSkill` | `true` |
| stt | `baseUrl` | `AMADEUS_WHISPER_BASE_URL`（必填） |
| | `apiKey` | `AMADEUS_WHISPER_API_KEY` |
| | `model` | `whisper-large-v3` |
| | `language` | 空（自动检测） |
| tts | `baseUrl` | `AMADEUS_SILICONFLOW_BASE_URL`，默认 `https://api.siliconflow.cn/v1` |
| | `apiKey` | `AMADEUS_SILICONFLOW_API_KEY`（必填） |
| | `voice` | `AMADEUS_SILICONFLOW_VOICE`，默认红莉栖音色 |
| | `model` | `FunAudioLLM/CosyVoice2-0.5B` |
| | `sampleRate` | `32000` |
| | `minSegmentLength` | `15` |
| emotion | `baseUrl` / `apiKey` | `AMADEUS_LLM_BASE_URL`（默认 OpenAI）/ `AMADEUS_LLM_API_KEY` |
| | `model` | `gpt-4.1-nano` |
| memory | `baseUrl` / `apiKey` | `AMADEUS_MEM0_BASE_URL` / `AMADEUS_MEM0_API_KEY` |
| | `userName` | `AMADEUS_USER_NAME`，默认 `用户` |
| | `searchLimit` | `3` |
| | `enableRemember` | `true` |
| voice-clone | `baseUrl` / `apiKey` | 同 tts（SiliconFlow） |
| | `model` | `FunAudioLLM/CosyVoice2-0.5B` |
| | `proxyUrl` | `AMADEUS_PROXY_URL`，空 = 直连 |
| proactive | `baseUrl` / `apiKey` / `model` | 同 emotion |
| live2d | `role` | `牧濑红莉栖` |
| | `referenceWidth` | `1620` |

`voice-clone` 的 `proxyUrl` 是**逐请求**注入的：undici `ProxyAgent` 在真正克隆时
才惰性加载，未配置代理就完全不走这条路。宿主没装 undici 时自动退化为直连，不会
把插件搞崩。

---

## 7. 验证

```
构建    8/8 插件产出 lib/index.js；3 个客户端插件产出 lib/client.js
类型    Node 端 8/8 无错误；客户端 3/3 无错误
测试    108 通过 / 0 失败
```

各插件测试数：persona 15（含 7 个跨插件集成测试）、live2d 25、proactive 16、
stt 14、tts 11、emotion 11、memory 8、voice-clone 8。

**跨插件集成测试**（`plugins/amadeus-persona/test/integration.test.mjs`）把 8 个
插件一次性挂进真实的 Cordis `Context`，用桩服务替换 `tools`/`systemPrompt`/`skills`，
断言：

- 8 个插件都能到达 ACTIVE 状态，互不冲突；
- 8 个工具名全部注册，且都带 `amadeus_` 前缀（不会撞宿主工具）；
- 9 个提示段落 order 唯一，人格段落在最前；
- 每个工具的 `output.schema` 都设了 `additionalProperties: false`；
- 技能 provider 的候选列表不带正文，`get()` 才返回正文（两级懒加载成立）。

### 端口行为对照

下列行为逐条对齐原项目，并有测试覆盖：

| 行为 | 原实现 | 插件 |
| --- | --- | --- |
| 9 种表情动作名与顺序 | `emotion.py` 枚举 | `EMOTIONS` |
| 表情回退值 `neutral` | `emotion.py` | `DEFAULT_EMOTION` |
| 5 种主动行动与回退 `share_memory` | `plan.py` | `ACTIONS` / `DEFAULT_ACTION` |
| 主动对话标记 `[AI主动发起对话]next Action: …` | WebRTC server | `buildProactivePrompt` |
| 15 组角色名中英日对照 | `prompt_utils.py` | `CHARACTER_NAME_MAP` |
| 按标点分段、`min_segment_length=15` | `stream_utils.py` | `splitForSpeech` |
| CosyVoice2 / PCM / 32 kHz | `speech.py` | tts `Config` + `pcmToWav` |
| `user_id = md5(用户名+盐)[:16]` | `user_utils.py` | `generateUserId` |
| Live2D 舞台坐标 `x1 + (innerWidth-1620)/2` | `Live2dModel/index.tsx` | `computeStageLayout` |
| 待机动画（头/眼/眨眼 lerp 状态机） | `AnimationControl.ts` | `stepIdle` |
| 表情含 `random` 时复位 | `Live2dModel/index.tsx` | `resolveExpression` |
| `speaking`/`thinking` 播随机待机动作 | `Live2dModel/index.tsx` | `resolveMotion` |

`generateUserId` 的结果与原 Python 实现逐字节一致（`用户` →
`7e49749f51d28f97`，`冈部` → `fb0f16e6827f35a5`，`牧濑` → `34041e7ef2976989`）。

---

## 8. 已知取舍

1. **Live2D 没有真的跑 pixi-live2d。** harness 的浏览器沙箱禁止加载第三方 CDN
   脚本，`*.model3.json` 也在远端。所以 `@amadeus/live2d` 的做法是：Node 端算出
   与原来完全一致的舞台坐标和待机动画参数，浏览器卡片按这些参数**自绘**一个等价
   舞台（头身旋转、瞳孔跟随、眨眼、表情配色），并给出模型文件链接。动画契约与
   原实现一致且有测试，只是渲染器换成了自绘 SVG。
2. **没有 WebRTC 插件。** dsh 会话本身承担传输，再实现一遍信令没有收益。
3. **音频走 data URI。** 卡片把整段 WAV 内联成 `data:` URI 给 `<audio>`，省掉了
   静态文件服务；代价是长文本的 meta 会比较大（按标点分段后通常可控）。
4. **`minSegmentLength` 的合并语义。** 短于阈值的子句会并入后一句，因此默认
   15 时「嗯。好的。」会合成一段；把阈值调到 2 才会逐句切分。这是对原实现的
   忠实移植，测试里显式覆盖了这个边界。

---

## 9. 新增一个插件

照着现有插件复制即可：

1. 在 `scripts/scaffold_all.py` 的 `PLUGINS` 和 `configs` 里各加一条；
2. `python scripts/scaffold_all.py <new-id>` 生成骨架；
3. 写 `src/fragment.ts`（纯契约）→ `src/api.ts`（可注入 fetch）→
   `src/tool.ts` → `src/index.ts`；
4. 写 `test/*.test.mjs`，构建，跑测试。

把 `output.schema` 的字段和 `execute()` 返回值对齐，是最容易踩的坑。
