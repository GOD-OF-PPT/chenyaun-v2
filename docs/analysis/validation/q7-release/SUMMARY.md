# Q7（F38）阶段二测试环境全量验证与发布证据包

- **验证日期**：2026-11-24
- **验证分支**：`codex/quality-release`（基于已合入全部阶段一里程碑 `Q0–Q6` 的 `main @ 5115b8e`）
- **验证环境**：Ubuntu 24.04 Linux · Node.js `v22.23.5` · 1440×900 桌面 Chromium（`/usr/bin/google-chrome`，headless，各用例独立浏览器上下文；多标签页竞争为单独立上下文内同源多页）
- **发行入口**：`web/public/playable-v2.html`（由 `src/**` 经 `scripts/build-playable.mjs` 确定性组装，离线直接 `file://` 与静态 HTTP 双入口均已实测）

---

## 1. 阶段一已合入 `main` 交付总览（PR #20–#28）

| 里程碑 | 覆盖功能 | 分支 / PR | 合入 `main` 提交 | 状态 |
|---|---|---|---|---|
| **Q0-A** | `F01–F04`（美术清单去波动与 CI、隔离 runner、历史漂移修复、R3–R6 与 E2E 恢复） | `codex/q0-infra-and-tests` / PR #20 | `28d02e2` | `VERIFIED` |
| **Q0-B** | `F05–F06`（焦点/Enter 恢复、`modalOpen` 优先级、HUD 同步、文案公式对齐） | `codex/q0-focus-and-copy` / PR #21 | `292b7b1` | `VERIFIED` |
| **Q1** | `F07–F13`（待处置权益持久化、暂停令牌、战斗静默调度、过场顺序、防误触、通知总线） | `codex/combat-calm` / PR #22 | `dfbbd38` | `VERIFIED` |
| **Q2** | `F14–F18`（UI 语义色板、统一导航层级、抽屉收束、分级提醒/升级预览、显式批量与失败复盘） | `codex/navigation-hierarchy` / PR #23 | `6946074` | `VERIFIED` |
| **M7a（外部同步）** | 多标签 CRDT / 存档提示 / `R7-1..R7-3` | `codex/e2e-pass` / PR #25 | `2b1ca3a` | `VERIFIED` |
| **Q3** | `F19–F23`（收益账本、双流派样板、真实战斗评测矩阵、装备预算保底、经济与寿元闭环） | `codex/combat-growth-slice` / PR #24 | `fc9004f` | `VERIFIED` |
| **Q4** | `F24–F28`（首卷动作/场景/WebP 质检/音效反馈/首卷闭环）；`F29` 真人试玩 | `codex/first-volume-polish` / PR #26 | `4b86533` | 代码/自动化 `VERIFIED`；`F29 = NOT_RUN` |
| **Q5** | `F30–F33`（运行资产提取与零依赖确定性构建、纯规则 ESM 拆分、分层单测与调试兼容、文档同步） | `codex/modular-source` / PR #27 | `df5efda` | `VERIFIED` |
| **Q6** | `F34–F36`（2–6 卷覆盖、第五卷法则共鸣桥接与 5 项终局修复、高阶模式三分组与 D07 一致）；`F37` | `codex/campaign-quality` / PR #28 | `5115b8e` | `F34–F36 VERIFIED`；`F37 = DEFERRED` |
| **Q7** | `F38`（7 项遗留边界打磨收口 + 阶段二全量测试环境验证 + 证据包与状态日志更新） | `codex/quality-release` / PR #29 | 待合并 | 自动化与双入口 `VERIFIED`；真人试玩门禁 `NOT_RUN` |

> 说明：仓库现有无关草稿 PR #18（`codex/static-security-package-20261123`）、远端历史分支 `origin/codex/e2e-suite` 及历史记录 `docs/v2-overhaul-notes.md` 均完整保留，未受改动。

---

## 2. 阶段二实测命令与结果汇总

| 检查项 | 执行命令 | 实测结果 | 证据文件 |
|---|---|---|---|
| **确定性独立构建校验** | `npm run build:check` | **PASS**（`src/` 与 `web/public/playable-v2.html` 逐字节一致，115 张 WebP，10 个 ESM 模块，单 `<script>`，零外部 CDN） | 控制台输出 & `tests/unit/build-parity.test.mjs` |
| **美术溯源与 WebP 二进制质检** | `npm run art:manifest:check` | **PASS**（115 项内联资产、11 项磁盘文件、5 项 VP8X RGBA 受保护精灵哈希零漂移） | `docs/art-manifest.md` |
| **纯 Node 单元测试** | `npm run test:unit` | **32/32 PASS**（0 失败、0 跳过，覆盖 8 个单测文件，含裸副作用 import 负向守卫） | 控制台输出 |
| **1440×900 桌面 Chromium 全量回归（HTTP）** | `npm run test:regression -- --report docs/analysis/validation/q7-release/regression-report.json --screenshots /tmp/q7-regression-shots` | **77/77 PASS**（0 失败、0 错误、0 跳过、**0 运行时错误**，耗时 546.3s） | [regression-report.json](regression-report.json) |
| **1440×900 桌面 Chromium 全量 E2E（Tier 1–4）** | `npm run test:e2e -- --report docs/analysis/validation/q7-release/e2e-report.json` | **56/56 PASS**（Tier 1: 31/31 · Tier 2: 12/12 · Tier 3: 10/10 · Tier 4: 3/3，**0 运行时错误**，耗时 283.4s） | [e2e-report.json](e2e-report.json) |
| **直接 `file://` 入口、性能基线与 Q7 7 项收口验证** | 1440×900 Chromium 独立脚本（`file://` + 静态 HTTP） | **ALL PASS**（`firstInteractiveMs = 1197ms`，60 帧软件渲染 rAF `p50 = 50.1ms` / `p95 = 100.0ms`，0 运行时错误，7 项收口打磨全部实测通过） | [file-and-polish-check.json](file-and-polish-check.json) |
| **无头真实规则战斗矩阵评测** | `node scripts/eval-combat-matrix.mjs --seed 20261124` | **84/84 场景 PASS**（`allGearBudgetOk: true`, `bossWinRate: 1`, `afkZeroWins: true`, `outliers: []`） | [combat-matrix.json](combat-matrix.json) |
| **经济防套利与寿元闭环审计** | `node scripts/audit-economy.mjs --seed 20261124` | **PASS**（`violations: []`, `gearBudgetFailures: 0`, `d05Compliant: true`） | [economy-audit.json](economy-audit.json) |

**自动化测试总计**：**165/165 PASS**（32 单元 + 77 回归 + 56 E2E）+ 84/84 战斗矩阵 + 经济审计 + `file://` 与 Q7 专项校验，全程 **0 运行时错误**。

---

## 3. 核心验收场景 V01–V13 映射

| 用例 | 对应自动化套件 | 实测状态 |
|---|---|---|
| **V01**（焦点与 Enter 交互） | `Q0-1`, `R2-2`, `R2-6`, `E2E-T1-02`, `E2E-T1-03`, `E2E-T1-07`, `E2E-T3-02` | `PASS` |
| **V02**（背包满 24/24 与延期处置） | `Q1-1`, `R4-4`, `E2E-T1-27` | `PASS` |
| **V03**（待处理权益持久化/写失败/多标签冲突） | `Q1-1`, `Q1-2`, `R2-1`, `R2-3`, `R2-4`, `R2-5`, `R2-7`, `R7-1`, `E2E-T2-01..06`, `E2E-T3-01`, `E2E-T4-02` | `PASS` |
| **V04**（金灵/魂印/渡劫战中延期与持久化） | `Q1-1`, `Q1-6` | `PASS` |
| **V05**（残留危险区与多模式静默安全窗口） | `Q1-3`, `Q1-4`, `Q6-2` | `PASS` |
| **V06**（抽屉→详情→冲突/败北暂停与焦点释放） | `Q1-2`, `R2-2`, `R7-2` | `PASS` |
| **V07**（通知分级、防误触与危招/存档警示保留） | `Q1-5`, `Q1-6` | `PASS` |
| **V08**（战前剧情幂等刷怪与卷终落盘顺序） | `Q1-4`, `R5-2`, `E2E-T1-15`, `E2E-T1-16`, `E2E-T3-04` | `PASS` |
| **V09**（导航预览/入口收束/材料溯源返回焦点） | `Q2-1..Q2-5`, `file-and-polish-check.json`（多建筑洞府返焦 & 抽屉去重） | `PASS` |
| **V10**（收益账本、双流派样板、装备预算与经济闭环） | `Q0-2`, `Q3-1..Q3-5`, `tests/unit/*`, `combat-matrix.json`, `economy-audit.json` | `PASS` |
| **V11**（首卷动作/景深/资产/音效/动效与完整闭环） | `Q4-1..Q4-5`（自动化全部 `PASS`；**真人试玩 F29 = `NOT_RUN`**） | 自动化 `PASS` / 真人 `NOT_RUN` |
| **V12**（模块化构建、双入口一致、382 项 V18–V25 与旧档/云码/沙盒） | `Q5-1..Q5-3`, `tests/unit/build-parity.test.mjs`, `file-and-polish-check.json` | `PASS` |
| **V13**（全六卷覆盖、第五卷共鸣桥接、终局模式与 D07/D08 边界） | `Q6-1..Q6-4`, `tests/unit/campaign-q6.test.mjs`, `E2E-T4-03` | `PASS`（`F37 = DEFERRED`） |

---

## 4. Q7 遗留边界打磨清单（本分支一并收口）

1. `startSectDefenseSiege()`：清理演武坪残留 `isDojoProp`（阵眼柱/玄冰晶）及 `waterPools`/`fireZones`。
2. `cold_pond_spring` 正道延寿选项（`karma_r_spring`）：延寿脱离大限后同步重置 `lifespanExhaustedPromptDismissed` 与 `pendingLifespanExhaustedPrompt`。
3. `load-latest-save` 失败分支：仅在当前开启 `save_conflict`/`save_corrupt` 弹窗时关闭，避免误关无关弹窗。
4. `closeDrawer()` 与洞府材料来源返焦：关闭抽屉时移除隐藏残留 `#btn-mat-source-return`，且多建筑共用缺材时精准匹配 `data-source-origin` 对应建筑返回焦点。
5. `spawnDojoDummy()`：非法模式回退至 `"static"`（消除冗余三目）。
6. `DAO_LAWS.wanjian` 与 `LAW_SHORT_BADGE.wanjian`：文案对齐 `getSwordCount()` 实际 `+1`（额外飞剑上限 +3）。
7. `formatGearStats()` 与 `scripts/build-playable.mjs`：为装备 `crit`/`spd`/`bonusSword` 补齐 `num()` 守卫；收紧 ESM `import` 正则至 `[^;]*?` 并显式拒绝裸副作用 `import "./x.mjs";`（已入单测）。

---

## 5. 诚实未决项与回退保障

- **未决项 1（F29 真人观察式试玩）**：当前状态 **`NOT_RUN`**（实际招募完成人数 `0 / 5~8`）。已交付 [playtest-protocol-v1.md](../../playtest-protocol-v1.md) 与纯内存遥测导出工具，等待真实新玩家试玩补齐体验验收；在真人试玩完成前，不宣称版本主观体验验收全部通过。
- **未决项 2（F37 非核心扩展）**：按 **D08 保守基线** 登记为 **`DEFERRED`**（未引入扫荡、9:16 移动端重写或长按自动连扣），详见 [q6-decisions-and-boundary.md](../../q6-decisions-and-boundary.md)。
- **未决项 3（D01–D08 架构/产品决策）**：本轮全部按 `PROJECT.md` 规定的保守基线落地，保持所有既有玩家资产、旧档、键鼠可达性与可选路线无回退；若后续决定启用某项结构性扩张（如强制炼丹门槛、槽位合并、新增第五卷独立地图/Boss、扫荡/移动端），可基于当前模块化源码与决策表单独拍板并做旧档迁移。
- **回退保障**：所有主存档 envelope v2、`game.pendingRewards`、`metaState` CRDT 与 `D05` 装备字段均经 `normalizeLoadedGame` 向前/向后兼容校验；任一里程碑对应独立非 force-push 合并提交（`28d02e2` → `5115b8e`），可随时通过 `git revert` 或检出 `main @ 5115b8e` 恢复兼容发行版且不丢弃既有 `pendingRewards` 字段。
