# 尘缘问道 · 剑阵万象

2.5D 动作修仙网页游戏。直接用桌面浏览器打开 [playable-v2.html](web/public/playable-v2.html)，点击「踏入山雨 · 开启新卷」开始游戏。页面内嵌脚本、样式和 115 张 WebP 图片，音效由 Web Audio 生成。

## 本机或局域网运行

在仓库根目录使用 Python 3 启动静态服务（建议在 1440×900 桌面 Chromium/Chrome 视口下验收）：

```sh
python3 -m http.server 5174 --bind 127.0.0.1 --directory web/public
```

打开 <http://127.0.0.1:5174/playable-v2.html>。局域网试玩时，将命令和网址中的 `127.0.0.1` 都换成本机的局域网 IPv4 地址。同一浏览器使用相同的协议、地址和端口即可继续读取原站点的存档。

## 自动化回归验收（1440×900 Chromium）

需要 Node.js >= 20 以及本地已安装的 Chromium 或 Google Chrome。首次运行前安装依赖：

```sh
npm ci
npm run test:regression
```

脚本会自动起停本地静态 HTTP 服务，在独立的 1440×900 浏览器上下文中运行 **M1–M4 + P1–P5 共 24 项回归测试**，并要求 0 个控制台或页面运行时错误。

常用参数（通过 `--` 透传给脚本）：

```sh
npm run test:regression -- --filter M1
npm run test:regression -- --screenshots /tmp/cy_shots --report /tmp/cy_report.json
npm run test:regression -- --url http://127.0.0.1:5174/playable-v2.html
```

浏览器路径优先读取环境变量 `CHROMIUM_PATH`，未设置时依次回退查找 `/usr/bin/chromium`、`/usr/bin/chromium-browser`、`/usr/bin/google-chrome`：

```sh
CHROMIUM_PATH=/usr/bin/google-chrome npm run test:regression
```

## 美术溯源清单

生成或校验内联 WebP 与随包素材的 SHA-256 校验值、来源、许可及使用位置清单（[docs/art-manifest.md](docs/art-manifest.md)）：

```sh
npm run art:manifest
npm run art:manifest:check
```

[版本更新记录](docs/v2-overhaul-notes.md) · [美术溯源清单](docs/art-manifest.md) · [随包美术素材](web/public/art/v4)
