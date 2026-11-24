# 尘缘问道 · 剑阵万象

2.5D 动作修仙网页游戏。直接用桌面浏览器打开独立发行入口 [web/public/playable-v2.html](web/public/playable-v2.html)（支持 `file://` 直接打开或静态 HTTP 入口，零外部 CDN 依赖），点击「踏入山雨 · 开启新卷」开始游戏。页面内嵌样式、脚本与 115 张 WebP 图片，音效由 Web Audio 实时合成。

## 本机或局域网运行

在仓库根目录使用 Python 3 启动静态服务（验收基准为 1440×900 桌面 Chromium/Chrome 视口）：

```sh
python3 -m http.server 5174 --bind 127.0.0.1 --directory web/public
```

打开 <http://127.0.0.1:5174/playable-v2.html>。局域网试玩时，将命令和网址中的 `127.0.0.1` 都换成本机的局域网 IPv4 地址。同一浏览器使用相同的协议、地址和端口即可继续读取原站点的存档。

## 模块化源码与确定性构建（Q5 · D06 保守基线）

编辑源按职责拆分于 `src/`，由零外部依赖的纯 Node ESM 构建脚本 [scripts/build-playable.mjs](scripts/build-playable.mjs) 确定性组装回单文件独立发行包 `web/public/playable-v2.html`：

- `src/template.html`、`src/styles/main.css`、`src/markup/body.html` — 文档壳、内联样式与页面结构
- `src/assets/art-index.json` + `src/assets/runtime/*.webp` — 从运行内联版本无损提取的 115 张 WebP（含 5 张受保护 VP8X RGBA 精灵）
- `src/config/` — 战斗参数、境界/物品/丹方与技能/法则/灵宠等纯配置表（`.mjs`）
- `src/rules/` — 属性账本、单击上限、装备预算/保底、经济/寿元、评分与 Q6 卷次/共鸣纯规则（`.mjs`，共 10 个纯 ESM 模块可供 Node 直接导入单测）
- `src/state/save-rules.mjs` — 存档封装 v2 FNV-1a 校验、规范化载荷与元存档 CRDT 合并规则
- `src/runtime/` — `preamble.js`、`main.js`、增补兼容门面 `debug-facade.js`（`window.__CHENYUAN_DEBUG__`，全量保留 `V18–V25` 全部 382 项接口并增补 `.q6` 辅助命名空间）与 `boot.js`

构建与一致性校验命令（需要 Node.js >= 20）：

```sh
npm run build         # 从 src/ 确定性生成 web/public/playable-v2.html
npm run build:check   # 内存中重建并与仓库内 web/public/playable-v2.html 逐字节比对
```

## 分层自动化测试与数值审计

首次运行前安装依赖（需要 Node.js >= 20 以及本地 Chromium / Google Chrome）：

```sh
npm ci
npm run build:check
npm run test:unit
npm run art:manifest:check
npm run test:regression
npm run test:e2e
```

- **纯规则单元测试（`npm run test:unit`）**：基于 Node 内置 `node:test` 运行 `tests/unit/*.test.mjs`（8 个测试文件、32 项测试覆盖属性账本、战斗数学与 45% 单击上限、1,000 次种子装备滚落预算与保底、经济防套利与寿元阈值、劫火与仙榜评分评级、存档封装与 CRDT 合并、Q6 全卷指引/共鸣/D07 规则、构建/VM 规则一致性及负向构建校验）。
- **回归套件（`npm run test:regression`）**：自动起停本地静态 HTTP 服务，在独立的 1440×900 浏览器上下文中运行 **M1–M4 + P1–P5 + R2–R7 + Q0–Q6 + T5 共 87 项回归测试**。默认在单条失败后继续执行全部套件并输出 `schemaVersion: 2` 汇总报告（及失败截图），要求 0 个控制台或页面运行时错误。
- **E2E 与对抗加固套件（`npm run test:e2e`）**：按 Tier 1–5 运行 **共 70 项端到端与白盒对抗验收测试**（Tier 1–4 黑盒验收 56 项：Tier 1 独立功能 31 项、Tier 2 边界与存档五场景 12 项、Tier 3 跨系统组合 10 项、Tier 4 玩家完整旅程 3 项；Tier 5 白盒对抗加固 14 项），详见 [TEST_INFRA.md](TEST_INFRA.md) 与 [TEST_READY.md](TEST_READY.md)。
- **无头数值与经济审计（Node VM）**：
  ```sh
  node scripts/eval-combat-matrix.mjs --seed 20261124   # 6境界×3装等×2流派×4策略×5遭遇（84 组战斗评测矩阵）
  node scripts/audit-economy.mjs --seed 20261124        # 全物品买卖套利、黑市礼包与寿元阈值闭环审计
  ```

常用参数（通过 `--` 透传给脚本）：

```sh
npm run test:regression -- --filter Q5
npm run test:regression -- --screenshots test-results/shots --report test-results/regression-report.json
npm run test:regression -- --fail-fast --timeout 90000
npm run test:regression -- --url http://127.0.0.1:5174/playable-v2.html

npm run test:e2e -- --tier 1,2 --report test-results/e2e-report.json
npm run test:e2e -- --filter E2E-T1-08
```

浏览器路径优先读取环境变量 `CHROMIUM_PATH`（若显式指定但路径不存在，将以退出码 `2` 快速失败），未设置时依次回退查找 `/usr/bin/chromium`、`/usr/bin/chromium-browser`、`/usr/bin/google-chrome`：

```sh
CHROMIUM_PATH=/usr/bin/google-chrome npm run test:regression
CHROMIUM_PATH=/usr/bin/google-chrome npm run test:e2e
```

## 美术溯源清单

生成或校验内联 WebP 与随包素材的稳定资源键/SHA-256 校验值、来源、许可及语义使用位置清单（[docs/art-manifest.md](docs/art-manifest.md)）：

```sh
npm run art:manifest
npm run art:manifest:check
```

[事实变更日志](docs/CHANGELOG.md) · [设计基线](docs/design.md) · [Q6 决策与扩展边界](docs/analysis/q6-decisions-and-boundary.md) · [历史改造志（保留原文）](docs/v2-overhaul-notes.md) · [美术溯源清单](docs/art-manifest.md) · [随包美术素材](web/public/art/v4) · [E2E 测试说明](TEST_INFRA.md)
