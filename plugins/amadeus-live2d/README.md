# @amadeus/live2d

Amadeus 虚拟形象舞台：摆放角色、驱动待机动画与表情。

来源：原项目 `src/components/Live2dModel/`（含 `AnimationControl.ts`）与 `src/constants/live2d.ts`。

## 贡献

- 工具 `amadeus_stage`
- 系统提示段落 `tool:amadeus_stage`（order 916）
- 浏览器卡片：自绘舞台（头身旋转、瞳孔跟随、眨眼、表情配色）

## 工具

`amadeus_stage(role?, emotion?, motion?, viewportWidth?, mobile?)` → 舞台坐标、缩放、表情、动作，以及这一帧的 10 个 Cubism 参数。

摆放公式与原实现一致：桌面 `x = x1 + (innerWidth - 1620) / 2`，移动端用 `x2 + (innerWidth - 380) / 2`。待机动画（头部随机摆动、眼球漂移、眨眼）逐帧复刻 `Animation_Control`。

`emotion` 为 `neutral` 或含 `random` 时复位表情；`motion` 为 `speaking`/`thinking` 时从 5 个随机待机动作里挑一个。

## 配置

| 键 | 默认值 |
| --- | --- |
| `role` | `牧濑红莉栖` |
| `referenceWidth` | `1620` |

## 说明

**没有真的加载 pixi-live2d**：harness 的浏览器沙箱禁止加载第三方 CDN 脚本，模型也在远端。所以 Node 端计算出与原实现完全一致的坐标与动画参数，浏览器卡片按这些参数自绘一个等价舞台，并给出模型文件链接。动画契约有 17 个测试覆盖。

待机状态在插件实例内连续推进，所以连续调用会看到头部继续收敛，而不是每次归零。

## 构建与测试

```bash
node ../../scripts/build.mjs amadeus-live2d
node --test test/*.test.mjs
npx tsc -p tsconfig.json --noEmit
```
