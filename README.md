# 尘缘问道 · 剑阵万象

2.5D 动作修仙网页游戏。直接用桌面浏览器打开 [playable-v2.html](web/public/playable-v2.html)，点击「踏入山雨 · 开启新卷」开始游戏。页面内嵌脚本、样式和 115 张 WebP 图片，音效由 Web Audio 生成。

## 本机或局域网运行

在仓库根目录使用 Python 3 启动静态服务（建议在 1440×900 桌面 Chromium/Chrome 视口下验收）：

```sh
python3 -m http.server 5174 --bind 127.0.0.1 --directory web/public
```

打开 <http://127.0.0.1:5174/playable-v2.html>。局域网试玩时，将命令和网址中的 `127.0.0.1` 都换成本机的局域网 IPv4 地址。同一浏览器使用相同的协议、地址和端口即可继续读取原站点的存档。

## 自动化回归与 E2E 验收（1440×900 Chromium）

需要 Node.js >= 20 以及本地已安装的 Chromium 或 Google Chrome。首次运行前安装依赖：

```sh
npm ci
npm run test:regression
npm run test:e2e
```

- **回归套件（`npm run test:regression`）**：自动起停本地静态 HTTP 服务，在独立的 1440×900 浏览器上下文中运行 **M1–M4 + P1–P5 + R2–R7 + Q0–Q4 + T5 共 79 项回归测试**。默认在单条失败后继续执行全部套件并输出 `schemaVersion: 2` 汇总报告（及失败截图），要求 0 个控制台或页面运行时错误。
- **E2E 验收与对抗加固套件（`npm run test:e2e`）**：按 Tier 1–5 运行 **共 68 项端到端测试**（Tier 1–4 共 56 项黑盒验收：独立功能 31 项、边界与存档五场景 12 项、跨系统组合 10 项、玩家完整旅程 3 项；Tier 5 白盒对抗加固 12 项），详见 [TEST_INFRA.md](TEST_INFRA.md) 与 [TEST_READY.md](TEST_READY.md)。

常用参数（通过 `--` 透传给脚本）：

```sh
npm run test:regression -- --filter M4
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

[版本更新记录](docs/v2-overhaul-notes.md) · [美术溯源清单](docs/art-manifest.md) · [随包美术素材](web/public/art/v4) · [E2E 测试说明](TEST_INFRA.md)
