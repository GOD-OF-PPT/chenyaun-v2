# 尘缘问道 · 剑阵万象

2.5D 动作修仙网页游戏。直接用桌面浏览器打开 [playable-v2.html](web/public/playable-v2.html)，点击「踏入山雨 · 开启新卷」开始游戏。页面内嵌脚本、样式和 115 张 WebP 图片，音效由 Web Audio 生成。

## 本机或局域网运行

在仓库根目录使用 Python 3 启动静态服务：

```sh
python -m http.server 5174 --bind 127.0.0.1 --directory web/public
```

打开 <http://127.0.0.1:5174/playable-v2.html>。局域网试玩时，将命令和网址中的 `127.0.0.1` 都换成本机的局域网 IPv4 地址。同一浏览器使用相同的协议、地址和端口即可继续读取原站点的存档。

[版本更新记录](docs/v2-overhaul-notes.md) · [随包美术素材](web/public/art/v4)
