# Web Zip 安全扫描报告

扫描日期: 2026-11-23（Asia/Singapore）
扫描路径: `/Users/gordon/githome/cy-v2`；交付复扫路径: `dist/verified-static-web`（从实际 ZIP 解压）。
源码基线: `a71f915`；修复分支: `codex/static-security-package-20261123`。
扫描的 HTML 文件数: 源码 2；交付包 1。Vite 配置: 0。
问题统计: 修复前共 34 项，均为 High；修复后 High 0 / Medium 0 / 需人工复核 0。

## 总体结论

通过。本次复扫未命中本技能定义的安全规则。修复前的 33 处动态 HTML 写入属于规则命中，不等于已证实存在 33 个可利用的 XSS 漏洞。

## 高风险

已处理初扫全部 34 项：

- `web/public/index.html:5` 的 Meta Refresh 已移除。源码主页提供主动进入游戏的相对链接；交付包直接以游戏正文作为 `index.html`，不跳转。
- 33 处动态 HTML 写入均在最终写入位置调用 DOMPurify；另外 3 处静态 HTML 写入也统一净化，共 36 处。10 处清空 HTML 的操作改用 `textContent`。
- 净化保留界面使用的 `data-*`、ARIA、按钮、图片、SVG 与 canvas。SVG 子节点使用正确命名空间；禁止执行标签、事件属性、表单提交属性及可执行 Data URI，并阻断动态内容中的远程资源和 CSS URL。
- DOMPurify 3.5.0 使用锁定的本地 npm 发行文件，不使用 CDN。原始发行文件、source map、完整许可证与 SHA-256 清单位于 `web/public/vendor/`。`vendor:check` 已确认与安装的锁定依赖逐字节一致。库来源：[DOMPurify](https://github.com/cure53/DOMPurify)、[npm 3.5.0](https://www.npmjs.com/package/dompurify/v/3.5.0)。
- 为使用成熟净化器，游戏增加一个随包本地 JS 依赖。原有游戏逻辑与样式仍在 HTML 内，双击打开与 HTTP 静态托管均已验证。原存档 key 未改动。

当前未解决高风险: 0。

## 中风险

0。无中文路径、活跃 `src/action` Data URI、固定资源根路径或 Vite 固定 base 命中。

## 需人工复核

0 项规则命中。没有不可读文件或内联脚本解析失败。

## 验证与交付

- 5 组扫描器测试通过：规则族、行号、多行模板表达式、净化器识别、默认排除、URL 分类、损坏 UTF-8 与未加引号的 refresh。
- 源码与实际解压包各通过 7 项独立上下文 Chromium 验证，视口 1440×900：子目录入口和五类抽屉、弹窗焦点/SVG/炼丹画布/图片；真实渲染入口注入载荷；新档/刷新/旧档续玩；损坏存档保留；写入失败保留；两标签页冲突保护；`file://` 离线打开。
- 上述浏览器验证没有控制台或页面运行时错误，没有外部网络请求。测试状态只写入一次性浏览器上下文。
- 美术清单校验通过；修复前后清单内 138 个 SHA-256 值顺序完全相同，115 张内联 WebP 和 11 个磁盘素材未改变。清单更新仅反映 HTML 代码位移后的使用行号。
- ZIP CRC 检查、20 个文件的安全路径检查、包清单逐文件 SHA-256 检查通过；包内 `index.html` 与修复后的游戏 HTML 字节完全一致。
- 连续两次构建的 ZIP SHA-256 一致。去除已审阅的净化策略与 HTML sink 包装后，修复前后游戏脚本的规范化 AST 完全相同，确认其余玩法逻辑和数据未变化。
- 静态包仅包含游戏 HTML、art、vendor、许可证/溯源与部署说明，不包含依赖目录、Git、凭据、玩家存档、Node/Python 后端或测试脚本。完整上传解压目录或直接打开 `index.html` 即可。
- 仓库原有全量玩法回归在 `PROJECT.md` 中注明待 M7 统一适配；本次没有把该旧套件报告为通过。本次运行的是上述针对安全渲染、存档提示和交付路径的验证。

静态 ZIP: `dist/chenyuan-wendao-static.zip`

大小: 6,087,919 字节（5.81 MiB）。

SHA-256: `394354a0f720b055cefee122b3a69acc5564835a986f0611d83e5738fe34ff11`

复现命令：

```sh
npm ci
npm run vendor:check
npm run security:test
npm run security:scan -- .
npm run security:smoke
npm run build:static
npm run security:scan -- dist/static-web
npm run security:smoke -- --root dist/static-web
npm run art:manifest:check
```

机器证据位于本地 `dist/security/`；初扫完整 JSON 另存 `dist/security/before.json`。

## 扫描边界与回滚

默认跳过 `node_modules`、`.git`、`.svn`、`.hg`、`dist`、`build`、`.cache`、`.turbo`、`.next`、`coverage`、`Library`、`Temp`、`Logs`。源码扫描没有扩大排除目录范围；交付复扫以实际解压目录为独立扫描根，完整覆盖交付文件路径和 HTML。

HTML/HTM 与支持的 Vite 配置是默认内容扫描范围；独立 JS 不属于该技能的通用源码审计范围。随包 DOMPurify 的来源和字节完整性另行校验。扫描不获取外部脚本、不做 DNS 推断，不替代完整渗透测试，不能证明项目不存在所有安全漏洞。

修复在独立 Git 分支上完成；可回退该分支提交或恢复基线 `a71f915` 的项目文件。ZIP 可删除后使用构建脚本重新生成。不要删除或覆盖浏览器中的正式存档。

## 重复流程复用

| 工作流 | 已有证据 | 处理 |
| --- | --- | --- |
| 拉取、启动、入口确认 | 本会话 2026-11-22、2026-11-23 重复执行 | README 和 game-playtest 已覆盖，不创建重复技能或自动化。 |
| 扫描、净化、复扫、静态打包 | 已有 Web Zip 技能；本项目需要可复现的交付流程 | 补齐项目扫描器、供应文件校验、隔离验证和打包脚本；不另建全局技能。 |

## 附录：修复前的逐项证据

以下行号对应 `a71f915`，不是修复后行号。

### H-1 Meta Refresh 跳转

- 文件: `web/public/index.html`
- 行号: 5
- 风险级别: High
- 证据: `<meta http-equiv="refresh" content="0; url=playable-v2.html">`
- 原因: 页面加载时强制导航
- 修复: 移除自动跳转，并在交付包直接提供游戏正文。

### H-2 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 6871
- 风险级别: High
- 证据: `chBox.innerHTML = line.choices.map(o => { const ok = canAffordStoryOpt(game, o); return &#96;<button type="button" class="dlg-choice-btn" data-story-bar-id="${escapeHtml(line.storyId)}" data-story-bar-opt="${escapeHtml(o.id)}" ${ok ? "" : "disa`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-3 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 9024
- 风险级别: High
- 证据: `subEl.innerHTML = inMorphWin ? &#96;<strong style="color:#fff3b0;">⚡ 按\&#96;/LB触发【太虚易剑斩】!</strong>&#96; : (isHeavy ? "剑威+46% · 霸体崩盾 · 2.4x破弱点" : "攻速+28% · 迅捷游身 · 高频叠印")`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-4 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 9705
- 风险级别: High
- 证据: `wrap.innerHTML = roster.map(cid => { const sp = PLAYABLE_COMPANIONS[cid]; return &#96;<img src="${ART[sp.avatar]}" alt="${sp.name}" class="tag-avatar-mini ${cid === curId ? "active" : ""}" data-switch-char="${cid}" data-tip="${escTip(&#96;${sp.name`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-5 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 12576
- 风险级别: High
- 证据: `capRow.innerHTML = &#96; <span class="tag-chip ${pgNow.alchemyHp >= capsNow.alchemyHp ? "done" : ""}">丹道气血 ${pgNow.alchemyHp}/${capsNow.alchemyHp}${pgNow.alchemyHp >= capsNow.alchemyHp ? " (已达上限)" : ""}</span> <span class="tag-chip ${pgNow.alch`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-6 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 15041
- 风险级别: High
- 证据: `document.getElementById("recap-bars-box").innerHTML = rows.map(r => { const pct = realTot > 0 ? Math.round((r.val / tot) * 100) : 0; return &#96;<div class="dmg-bar-row"> <div style="display:flex;justify-content:space-between;font-size:10.5px;"`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-7 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 15057
- 风险级别: High
- 证据: `comBox.innerHTML = &#96; <img src="${ART[cmt.art]}" alt="${cmt.name}" /> <div style="font-size:10.5px;line-height:1.4;color:#e5f3ef;"> <strong style="color:var(--gold-bright);">${cmt.name} · 战后评语：</strong>${cmt.text} </div>&#96;`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-8 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 15107
- 风险级别: High
- 证据: `deriveEl.innerHTML = &#96;<strong style="color:#ffe89e;">★ 切手窗口激活：按右键派生【${morphNames[p.comboStep % 4]}】！</strong>&#96;`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-9 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 15117
- 风险级别: High
- 证据: `chainEl.innerHTML = arena.inputChain.map(it => &#96;<span class="tele-step-chip ${it.isBuffered ? "buffered" : ""}">${it.tag}</span>&#96;).join("▸")`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-10 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 15949
- 风险级别: High
- 证据: `el.innerHTML = sections.join("")`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-11 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 15969
- 风险级别: High
- 证据: `el.innerHTML = &#96; <span>⚠ <b>检测到另一标签页更新了存档</b>（${escapeHtml(saveConflictState.externalName)} · ${escapeHtml(saveConflictState.externalRealm)}，v${saveConflictState.externalRev}），已暂停自动覆盖。</span> <div style="display:flex;gap:6px;flex-shrink:0;"`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-12 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 15980
- 风险级别: High
- 证据: `el.innerHTML = &#96; <span>⚠ <b>本地存档写入失败</b>（${escapeHtml(storageWriteError.message)}）· 当前进度仅暂存内存，请备份云码。</span> <div style="display:flex;gap:6px;flex-shrink:0;"> <button type="button" class="btn-gold" style="padding:3px 9px;font-size:11px;" dat`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-13 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 15993
- 风险级别: High
- 证据: `el.innerHTML = &#96; <span>⚠ <b>检测到本地存档异常</b>（${escapeHtml(storageReadError.reason)}）· 已暂停自动保存并保留原数据。</span> <div style="display:flex;gap:6px;flex-shrink:0;"> ${storageReadError.raw ? &#96;<button type="button" class="btn-ghost" style="padding:3px `
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-14 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 16017
- 风险级别: High
- 证据: `el.innerHTML = &#96; <span>⚠ <b>元存档损坏</b>（${escapeHtml(metaReadError.reason)}）· 已保留原数据并暂停元存档覆写。</span> <div style="display:flex;gap:6px;flex-shrink:0;"> ${metaReadError.raw ? &#96;<button type="button" class="btn-ghost" style="padding:3px 9px;font-`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-15 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 16029
- 风险级别: High
- 证据: `el.innerHTML = &#96; <span>⚠ <b>元存档写入失败</b>（${escapeHtml(metaWriteError.message)}）· 累世功德暂存于内存，请清理存储空间后重试。</span> <div style="display:flex;gap:6px;flex-shrink:0;"> <button type="button" class="btn-gold" style="padding:3px 9px;font-size:11px;" da`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-16 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 16777
- 风险级别: High
- 证据: `el.innerHTML = &#96; <div class="unlock-card-top"> <div style="display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap;"> <span class="cinnabar-seal" style="font-size:9.5px;padding:1px 7px;">新神通 · ${escapeHtml(card.badge)}</span> <st`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-17 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 16985
- 风险级别: High
- 证据: `el.innerHTML = &#96; <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;"> <strong style="font-size:12px;color:var(--gold-bright);">✦ 新获${slotLabels[nw.slot] || "仙装"}对比（已暂存行囊）</strong> <button type="button" class=`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-18 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 18737
- 风险级别: High
- 证据: `bodyEl.innerHTML = rows.join("")`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-19 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 18769
- 风险级别: High
- 证据: `bar.innerHTML = &#96; <span class="ob-step-pill">入道 ${step.idx + 1}/4 · ${step.title}</span> <span class="ob-pips">${pips}</span> <span style="line-height:1.35;">${dynamicHint}</span> <span id="btn-skip-onboarding" class="ob-skip-link" role="bu`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-20 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 19302
- 风险级别: High
- 证据: `el.innerHTML = arena.runBoons.map(bid => { const b = RUN_BOONS.find(x => x.id === bid); if (!b) return ""; return &#96;<span class="run-boon-chip" data-tip="${escTip("秘境道韵 · " + b.name, b.desc)}">✦ ${b.name}</span>&#96;; }).join("")`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-21 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 19508
- 风险级别: High
- 证据: `svgEl.innerHTML = svgParts.join("")`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-22 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 24024
- 风险级别: High
- 证据: `el.innerHTML = &#96; <span class="prop-interact-key">Enter / 点击</span> <div style="display:flex;flex-direction:column;gap:1px;min-width:0;"> <strong style="font-size:12px;color:#fff2c4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-23 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 26939
- 风险级别: High
- 证据: `varRow.innerHTML = (arena.recentMoveHistory || []).slice(-4).map(m => &#96;<span class="style-move-tag">${STYLE_MOVE_LABELS[m] || m}</span>&#96;).join("")`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-24 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 27131
- 风险级别: High
- 证据: `hubBtn.innerHTML = arena.sanctumMode ? &#96;<svg class="svg-ico" style="width:13px;height:13px;" aria-hidden="true" viewBox="0 0 24 24"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/></svg><span>出征</span>&#96; : &#96;<svg class="svg-ico"`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-25 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 27180
- 风险级别: High
- 证据: `strip.innerHTML = icons.join("")`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-26 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 27251
- 风险级别: High
- 证据: `dotsRow.innerHTML = [0, 1, 2, 3, 4].map(i => &#96;<span class="wave-dot ${(bossDone || i < curL) ? "cleared" : i === curL ? "active" : ""}"></span>&#96;).join("")`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-27 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 27612
- 风险级别: High
- 证据: `box.innerHTML = html`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-28 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 27765
- 风险级别: High
- 证据: `body.innerHTML = &#96; ${muralHeader("banner_sanctum", "命盘道统", &#96;${game.name} · ${REALMS[game.realm].name}期命盘&#96;)} <!-- Complete RPG Character Attribute & 5D Dao Radar Sheet --> <div class="jade-card" style="gap:8px;"> <div style="display:flex;fle`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-29 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 28135
- 风险级别: High
- 证据: `body.innerHTML = &#96; ${muralHeader("banner_karma_duality", "正魔因果 · 红尘三阶羁绊", &#96;${getKarmaState(game).label} · 合击 ×${countBondedAllies(game)}&#96;)} <div class="jade-card" style="gap:6px;"> <div style="display:flex;justify-content:space-between;alig`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-30 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 28207
- 风险级别: High
- 证据: `body.innerHTML = &#96; ${muralHeader("scene_secret", "山海星盘", "九州洞府主城与五大秘境")} <div class="jade-card" style="flex-direction:row;align-items:center;justify-content:space-between;gap:8px;border-color:rgba(128,255,234,0.58);${expOk ? "" : "opacity:0`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-31 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 28279
- 风险级别: High
- 证据: `body.innerHTML = &#96; ${muralHeader("banner_alchemy", "紫微丹器百工台", "稳炼成丹 · 八卦控火 · 本命法宝")} <div class="jade-card" style="border-color:rgba(255,218,120,0.62);gap:7px;"> <div style="display:flex;justify-content:space-between;align-items:center;gap:`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-32 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 28433
- 风险级别: High
- 证据: `body.innerHTML = &#96; ${muralHeader("banner_archive", "云岚百宝", &#96;${ks.label} · 坊市采买 · 仙装行囊&#96;)} <div class="karma-market-card ${ks.mode}"> <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;"> <strong style="font-siz`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-33 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 29320
- 风险级别: High
- 证据: `document.getElementById("welcome-perk-grid").innerHTML = PERKS.map(p => { const unlocked = isPerkUnlocked(p); return &#96; <button type="button" class="perk-card ${selectedPerkId === p.id ? "selected" : ""}" data-perk="${p.id}" data-tip="${escT`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。

### H-34 动态 HTML 写入

- 文件: `web/public/playable-v2.html`
- 行号: 29332
- 风险级别: High
- 证据: `calBox.innerHTML = &#96; <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;flex-wrap:wrap;gap:6px;"> <strong style="color:#ffb4a8;">🔥 高阶【劫火周目】难度选择（飞升 1 世开启）</strong> <span style="color:#ffe28a;">当前：${acti`
- 原因: 动态数据进入 HTML 解析器；本规则不等同于已证实可利用的 XSS
- 修复: 该写入在最终 HTML sink 接入 DOMPurify.sanitize；清空操作改用 textContent。
