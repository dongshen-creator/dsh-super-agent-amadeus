# dsh-super-agent-amadeus

一个 DeepSeek Harness 的**融合 bundle**：把 [TianzeLuo/dsh-super-agent](https://github.com/TianzeLuo/dsh-super-agent)
（Router/Worker Super-agent 控制面）与 [ai-poet/amadeus-system-new](https://github.com/ai-poet/amadeus-system-new)
拆解出的 **8 个 Amadeus 语音陪伴插件**组合成**一个可安装插件**。

一条 `dsh plugin add` 装完，得到：

- **Super-agent 控制面**：Router/Worker 双层调度、持久化 Trigger/Thread、
  跨项目 Worker、watchdog、左栏 Web 面板（全部上游原实现）；
- **Amadeus 语音陪伴套件**：牧濑红莉栖人格提示词 + 语音对话技能、Whisper 转写、
  CosyVoice2 语音合成（播放卡片）、表情动作（徽章卡片）、mem0 长期记忆、
  音色克隆、主动对话规划、Live2D 形象舞台（自绘卡片）。

```
┌─ profile 层栈（一个 bundle，9 个插件行） ─────────────────┐
│  super-agent      Router/Worker 控制面（vendored 上游）      │
│  amadeus-persona  人格 + 语音对话技能                        │
│  amadeus-stt      amadeus_transcribe 工具                   │
│  amadeus-tts      amadeus_speak 工具 + 音频播放卡片           │
│  amadeus-emotion  amadeus_emotion 工具 + 表情徽章卡片         │
│  amadeus-memory   amadeus_recall / amadeus_remember 工具     │
│  amadeus-voice-clone  amadeus_clone_voice 工具               │
│  amadeus-proactive    amadeus_proactive_plan 工具            │
│  amadeus-live2d   amadeus_stage 工具 + 形象舞台卡片           │
└────────────────────────────────────────────────────────┘
```

## 安装

```sh
dsh plugin --profile <profile> add <本仓库绝对路径>
```

一条命令即可：`cordis.patch.yml` 里的 9 行 `insert` 随包自动进入 profile 层栈。
重启 `dsh web`，左栏出现 **Super-agent** 面板（上游行为不变）。

> **不要**再单独安装上游 dsh-super-agent——本包已包含，重复安装会出现两个
> `super-agent` id。

## 组合原理

dsh 的 `insert` 行 `name` 字段是插件模块描述符，支持**相对路径**（由 app-boot
锚定在 patch 文件旁，见 `@deepseek-ai/dsh-app-boot` 的
`anchorInsertedPluginNames`）。因此一个 bundle 的 `cordis.patch.yml` 可以插入
任意多个插件行，各自指向包内不同路径的模块——本包正是利用这一点做到
"一个包，九个插件"：

```yaml
- insert:
    - id: super-agent
      name: './super-agent/lib/index.js'   # vendored 上游，零外部依赖
    - id: amadeus-persona
      name: './amadeus/persona/index.js'   # Amadeus 构建产物
    # …共 9 行
```

浏览器端同理：一个 bundle 只服务一个 `lib/client.js`，所以合成 client 把
上游面板工厂（从 `__ModuleLoader__` 包装中剥离）与三个 Amadeus toolview
打进同一个 `__ModuleLoader__.load({ id: 'dsh-super-agent-amadeus' })`。

## 目录结构

```
dsh-super-agent-amadeus/
├── cordis.patch.yml      # 9 行 insert（组合的声明式清单）
├── package.json          # bundle 元数据（dsh.bundle.patch / dsh.client）
├── lib/client.js         # 合成浏览器 bundle（面板 + 3 张卡片）
├── src/client/           # 合成 client 源码 + 生成的上游工厂
├── super-agent/          # vendored 上游完整源码（lib/bin/docs/test）
├── amadeus/              # 8 个插件的 Node 构建产物（运行时）
├── plugins/              # 8 个 Amadeus 插件的完整源码 + 测试 + 构建脚本
├── scripts/              # 构建/链接/生成脚本
└── test/                 # 挂载 + client 烟雾测试
```

`plugins/` 里是拆解自 amadeus-system-new 的全部源码：每个插件一个目录，
`src/fragment.ts`（纯契约）、`src/api.ts`（可注入 fetch 客户端）、
`src/tool.ts`（工具定义）、`src/index.ts`（装配）、`test/`（契约测试）、
各自 README。模块级映射、逐项行为对照与配置/环境变量说明见
[plugins/README.md](plugins/README.md)。

## 构建（改代码后）

```sh
node scripts/build-bundle.mjs
npm test
```

`build-bundle.mjs` 依次完成：构建 8 个插件 → 同步 Node 产物到 `amadeus/` →
重新生成上游 client 工厂 → 根安装 + junction 宿主包 → 类型检查合成 client →
打包 `lib/client.js` → 硬约束自检（ModuleLoader 包装、无动态 import、
require 白名单）。改了 `plugins/` 里的源码后重跑即可，不需要手动同步。

## 配置

九个插件各自的原有配置全部保留，在 profile 的 `cordis.patch.yml` 里按 id 覆盖：

```yaml
- id: amadeus-tts
  config:
    apiKey: sk-xxx        # 或环境变量 AMADEUS_SILICONFLOW_API_KEY
- id: super-agent
  config:
    superAgentHome: /abs/path
```

Amadeus 侧凭据全部走 `Config` / 环境变量（`AMADEUS_SILICONFLOW_API_KEY`、
`AMADEUS_WHISPER_API_KEY`、`AMADEUS_LLM_API_KEY`、`AMADEUS_MEM0_API_KEY` 等），
完整表见 [plugins/README.md](plugins/README.md)。Super-agent 侧配置见
[super-agent/README.md](super-agent/README.md)。

## 验证

```
构建    build-bundle.mjs 全链路通过（8 插件 + 合成 client + 硬约束）
挂载    test/mount.test.mjs：9 个插件在真实 Cordis Context 全部 ACTIVE，
        8 个 amadeus_* 工具、9 个提示段落、1 个技能 provider 逐一断言
client  test/client.test.mjs：合成 client.js 工厂加载、面板槽位 +
        3 张 toolview 卡片注册、无动态 import / Node 内置模块
插件级  plugins/*/test：108 个契约测试（见 plugins/README.md）
```

## 许可与归属

MIT。`super-agent/` 为 [TianzeLuo/dsh-super-agent](https://github.com/TianzeLuo/dsh-super-agent)
的原样 vendored 副本（MIT，见 `super-agent/LICENSE`）；Amadeus 插件套件拆解自
[ai-poet/amadeus-system-new](https://github.com/ai-poet/amadeus-system-new)。
详见 [LICENSE](LICENSE)。

## 已知取舍

- Live2D 卡片不加载 pixi-live2d 运行时：harness 浏览器沙箱禁止第三方 CDN
  脚本，所以 Node 端算出与原实现一致的舞台坐标与待机动画参数，卡片自绘等价
  舞台并给出模型文件链接（动画契约有测试覆盖）。
- 原项目的 WebRTC 传输层与 React 页面外壳未拆成插件：dsh 会话与 chat UI
  本身承担这两件事。
- 未配置 `AMADEUS_*` 凭据时，语音/表情/记忆工具会在调用时报"未配置"错误，
  不影响其余插件挂载与对话。
