# @amadeus/memory

Amadeus 长期记忆：通过 mem0 兼容客户端检索与写入记忆。

来源：原项目内联在 WebRTC 服务里的 mem0 调用与 `utils/user_utils.py` 的 user_id 规则。

## 贡献

- 工具 `amadeus_recall`、`amadeus_remember`
- 系统提示段落 `tool:amadeus_memory`（order 913）

## 工具

`amadeus_recall(query)` → 命中的记忆列表。
`amadeus_remember(text)` → 写入一条记忆（`enableRemember: false` 时禁用）。

`generateUserId` 复刻 `md5(f"{userName}_amadeus_system_fixed_salt_09876")[:16]`，与原 Python 逐字节一致。

## 配置

| 键 | 默认值 |
| --- | --- |
| `baseUrl` | `https://api.mem0.ai/v1` |
| `apiKey` | `AMADEUS_MEM0_API_KEY`（必填） |
| `userName` | `用户` |
| `searchLimit` | `3` |
| `enableRemember` | `true` |
| `timeoutMs` | `30000` |

## 说明

`normalizeSearchResults` 同时接受 `{results: [...]}` 与裸数组两种响应形态，条目字段取 `memory` 或 `text`，其余丢弃——这样换 mem0 版本不会把插件搞崩。

## 构建与测试

```bash
node ../../scripts/build.mjs amadeus-memory
node --test test/*.test.mjs
npx tsc -p tsconfig.json --noEmit
```
