Project: 《尘缘问道 · 剑阵万象》体验收敛、品质迭代与 Round 3 决策实施

日期：2026-11-24。状态：**D01–D08 全部定稿，进入 Round 3（`R3-M0 → R3-M1 (D06) → R3-M2 (D05) → R3-M3 (D08)`）实施阶段**。

当前基线：干净 `main @ fffcb72`（阶段一/阶段二 Q0–Q7 对应 PR #20–#29 已全部合入 `main`；自动化验证 **165/165 PASS**：32 项纯 Node 单测 + 77 项 1440×900 桌面 Chromium 回归 + 56 项 Tier 1–4 E2E + `build:check` + `art:manifest:check` + 84/84 战斗矩阵 + 经济审计 + 直接 `file://` 启动校验，0 运行时错误；**F29 真人观察式试玩仍如实标记 `NOT_RUN`（0 / 5~8）**）。

本轮用户指令（2026-11-24）：用户已通过 `/grill-me` 对 `D01–D08` 全部 8 项产品/架构决策完成定稿，指示先将定稿结论与详细分步执行计划写回本 `PROJECT.md`（`R3-M0`），随后按 `D06 → D05 → D08` 三个独立 `codex/` 分支与 PR 依次实施、经 CI 门禁验证并串行合入 `main`。

**0. 文档职责与基线状态摘要**

| 文档 | 职责 |
|---|---|
| [overview.md](overview.md) | 2026-11-23 初始综合判断、证据边界与来源分歧（历史基线，决策以本 `PROJECT.md` 2026-11-24 定稿为准） |
| 本 PROJECT.md | Q0–Q7（`F01–F38`）交付总账、**D01–D08 定稿表**、Round 3（`R3-F01`–`R3-F08`、`R3-M0`–`R3-M3`）分步执行计划、接口合同与验收标准 |
| [根目录 PROJECT.md](../../PROJECT.md) | 原 M0–M7 的历史范围、交付及延期验证责任，保留原文 |
| [validation/q7-release/SUMMARY.md](validation/q7-release/SUMMARY.md) | Q7（`F38`）阶段二 165/165 自动化与双入口实测证据包 |
| [q6-decisions-and-boundary.md](q6-decisions-and-boundary.md) | Q6 阶段边界快照（由 `Q6-4` 回归直接解析，R3-M0 保持不动，待 R3-M3 随 D08 落地同步更新） |
| A：[打断源审计](2026-11-23-combat-interrupt-audit.md) / B：[玩法与界面差距报告](2026-11-23-gameplay-ui-gap-report.md) / C：[制作人评估](producer-review.md) | 前期调研原始依据，保持历史只读 |

根目录 H 计划的历史动态债已在 Q0–Q7 全部闭环并沉淀于自动化门禁。本文不覆盖根 `AGENTS.md` 与用户新指令。

| 领域 | 当前状态（`main @ fffcb72`） | Round 3 演进动作 |
|---|---|---|
| 战斗连续性与交互 | Q0–Q2 闭环：焦点/Enter、持久化 `pendingRewards`、`pauseTokens`、静默调度、防误触均已实测通过 | R3-M3（D08）补充三星/S 级扫荡与强化/炼丹长按连续养成 |
| 平衡、经济与评级 | Q3/Q6 闭环：84/84 战斗矩阵与经济审计通过；副货币与多套评级在 Q6 曾维持保守基线 | R3-M2（D05）落地主线境界动态缩放、精简副货币与统一 `S/A/B/C` 评级 |
| 界面、美术与试玩 | Q4 闭环：115 张 WebP 与 5 张 VP8X RGBA 质检零漂移；**F29 真人试玩仍 `NOT_RUN`** | 维持桌面 1440×900 键鼠，明确不做移动端适配（D08） |
| 模块化架构与测试 | Q5/Q7 闭环：10 个纯 ESM 模块 + 确定性单文件构建 + 165/165 PASS；`src/runtime/main.js` 仍约 31.4k 行且保留 `V18–V25` | R3-M1（D06）深拆 `main.js` 为 15+1 模块、统一 `__CHENYUAN_DEBUG__` 并清除 `V18–V25` |

**1. 产品目标、范围与决策定稿（D01–D08）**

核心体验：观察危险 → 走位/叠印 → 破势与反击 → 获得可解释的成长 → 主动选择下一场挑战。长线叙事维持“仗剑入世、结识故人、修炼渡劫”。始终保持实时动作、桌面 1440×900 横屏键鼠、离线单 HTML 发行（`web/public/playable-v2.html`），以及“玩家主动选择才推进剧情、消费或领取”原则。

**设计决策定稿表（全部 8 项已于 2026-11-24 `FINALIZED`：5 项 `LOCKED_BASELINE` + 3 项 `APPROVED_ROUND3`）**

| ID | 定稿状态 | 最终决策内容与依据 | 配置 / 存档影响 | 验证标准 | 回退方式 |
|---|---|---|---|---|---|
| **D01** | `LOCKED_BASELINE`（**维持现状无需再改**） | **保持可选**：炼丹与灵宠仅作推荐路线不卡主线（完整保留无丹强行渡劫），闭关不附加额外减益；保留玩家路线自由度 | 沿用 Q3/Q6 既有配置与存档字段，无破坏性变更 | Q3/Q6/Q7 已验证（`V10`/`V11`/`V13`） | 无需修改；保持 `main @ fffcb72` 基线 |
| **D02** | `LOCKED_BASELINE`（**维持现状无需再改**） | **保持现有操作体系**：保留现有战斗主动槽位与伙伴独立按键，不做槽位精简或技能合并；避免破坏已验证的键鼠肌肉记忆与双流派区分 | 沿用既有键位映射与 `DEFAULT_KEYBINDS`，无存档变更 | Q3/Q7 已验证（`V10`、`Q3-2`） | 无需修改；保持 `main @ fffcb72` 基线 |
| **D03** | `LOCKED_BASELINE`（**维持现状无需再改**） | **保持独立导航入口**：九州地图（`M`）与问道录（`T`）各自独立，右侧栏维持现有页签与分组结构；兼顾旧入口习惯与 Q2 导航层级 | 沿用 Q2 导航模型与旧入口路由，无存档变更 | Q2/Q7 已验证（`V09`、`Q2-1..Q2-4`） | 无需修改；保持 `main @ fffcb72` 基线 |
| **D04** | `LOCKED_BASELINE`（**维持现状无需再改**） | **维持法则共鸣桥接**：第五卷继续采用 Q6 落地的法则共鸣与叙事桥接方案，不新增独立第五卷地图/Boss，不抬高终局境界门槛 | 沿用 `src/rules/campaign-q6.mjs` 既有配置与存档进度 | Q6/Q7 已验证（`V13`、`Q6-1..Q6-3`） | 无需修改；保持 `main @ fffcb72` 基线 |
| **D07** | `LOCKED_BASELINE`（**维持现状无需再改**） | **维持金丹解封与显式暂停**：双人协同与天时相位均于金丹期解封；战中 `7/8/9` 保持双击防误触，仍允许玩家随时主动打开菜单暂停 | 沿用 Q1/Q6 既有境界门控与 `pauseTokens` 机制 | Q1/Q6/Q7 已验证（`V06`/`V13`、`Q6-2`） | 无需修改；保持 `main @ fffcb72` 基线 |
| **D06** | `APPROVED_ROUND3`（**R3-M1 实施**） | **深度拆分 `main.js` + 清理 `V18–V25`**：① 将 `src/runtime/main.js`（31,454 行）按连续拓扑子系统拆分为 15 个有序模块 + ~25 行主循环外壳，由 `scripts/build-playable.mjs`（`RUNTIME_MODULE_ORDER`）确定性打包为离线单文件 `web/public/playable-v2.html`；② 全部单测/77 回归/56 E2E/`eval-combat-matrix` 迁至统一 `window.__CHENYUAN_DEBUG__`（`d06-unified-1`），彻底删除 `window.__CHENYUAN_V18__`–`__V25__` | 不改变存档 schema 与离线单文件产物形态；`docs/art-manifest.md` 保持零漂移 | **`V14`**（`build:check`、`art:manifest:check`、零 `V18–V25` 残留、`test:unit`/`regression`/`e2e` 全绿） | 独立 PR（`codex/d06-modular-debug-clean`），可按合并提交整笔 `git revert` |
| **D05** | `APPROVED_ROUND3`（**R3-M2 实施**） | **主线动态缩放 + 精简副货币 + 统一 `S/A/B/C`**：① 主线关卡敌群随玩家境界同步缩放（`computeMainlineRealmScaling`，仅限主线上下文，保留低关修为衰减）；② 保留灵石与 7 种核心材料，移除/折合 `reincarnationPoints`（→ `bingjieCount` 折合至 `legacyStones <= 240`）与 `sectMerits`（→ `sectDefenseCleared`/`sectDefenseBestGrade` + 灵石/妖核/灵玉）；③ 全模式统一为 **`S / A / B / C`** 评级（主线维持 `3★ ↔ S` 精确双射） | **用户明确：不需要理会旧存档**（不编写旧副货币/旧超 S 评级兼容迁移垫片，按新口径直接清洗并执行新口径五场景存档测试） | **`V15`**（5×7 缩放、84/84 战斗矩阵、`audit-economy`、`spiritCh1WolfXp <= 15`、零副货币与零 `SS/SSS/S+/D`、全量 CI 绿） | 独立 PR（`codex/d05-scaling-economy-grade`），可整笔回退至 D06 合并提交 |
| **D08** | `APPROVED_ROUND3`（**R3-M3 实施**） | **关卡扫荡 + 长按连续养成（不做移动端适配）**：① **关卡扫荡**限已 3 星（S 级）通关副本，**显式确认**、**免耗寿（0 月）**，受每关每日 3 次上限 + 60 秒冷却限制并使用真实掉落规则与写失败原子回滚；② **长按连续养成**支持装备强化与稳炼成丹（380ms/220ms），明确单次扣费与进行中提示，**松手 / 移出 / 失焦 / 灵石或灵材不足（绝不自动补购）/ 满级 `+10` / 大限保护 / 写失败即停**，保留 Q2 显式批量弹窗；③ **明确不做移动端适配**，维持桌面 1440×900 键鼠 | 新增可选字段 `game.stageSweepState`（经 `normalizeLoadedGame` 校验并入 envelope v2）；不破坏旧档与 Q2 批量入口 | **`V16`**（扫荡正反 7 场景 + 长按 11 项停止矩阵与跨 DOM 重建 + 键鼠返焦 + `Q6-4` 更新 + 双入口全量 CI 绿） | 独立 PR（`codex/d08-sweep-hold-qol`），可整笔回退且 `stageSweepState` 为可选字段不伤其余存档 |

**2. Architecture（当前模块化架构与 D06 目标边界）**

经 Q5 改造，当前 `main @ fffcb72` 已完成源与发行产物分离：编辑源位于 `src/`（`src/template.html`、`src/styles/main.css`、`src/markup/body.html`、`src/assets/art-index.json` + 115 张 `src/assets/runtime/*.webp`、10 个纯 Node 可导入 ESM 模块 `ESM_MODULE_ORDER`，以及 `src/runtime/{preamble,main,debug-facade,boot}.js`），由零依赖构建脚本 `scripts/build-playable.mjs` 确定性打包成单一离线可运行的 `web/public/playable-v2.html`（严格单 `<script>`、零外部 URL、115 项 WebP SHA-256 与 5 项 VP8X RGBA 双向校验）。`game` 管理长期状态，`arena` 管理战斗临时状态，主存档（envelope v2 + FNV-1a）与元存档（CRDT rev）由 `localStorage` 保存。

| 职责 | 所在层级与输入/输出 | 边界 |
|---|---|---|
| 纯配置与规则（ESM） | `src/config/*.mjs`、`src/rules/*.mjs`、`src/state/save-rules.mjs` → 数值/成本/掉落/缩放/评级/扫荡/存档校验 | 零 DOM/副作用，可注入随机源与时钟；Node 单测与浏览器产物共用 |
| 战斗与玩法运行时 | `src/runtime/*`（R3-M1 拆分为 15 个有序子系统 + 薄 `main.js` 主循环） → 战斗与系统状态演进 | 按连续拓扑顺序装配入单一 IIFE，零 TDZ，不直接弹自动奖励窗口 |
| 事件调度与待处理权益 | `src/runtime/scheduler-rewards.js` → `pendingRewards` 排队/放行与通知总线 | 权益与战报文本分离，持久化且幂等，不代玩家确认 |
| 暂停与焦点所有权 | `pauseTokens` + `MODAL_PRIORITY` + 焦点返回 → 合法暂停与键鼠可达性 | 实例化 token 释放，不抢占主动聚焦控件 |
| 表现与素材 | `src/runtime/renderer.js`、`src/styles/main.css`、`src/assets/runtime/*.webp` → Canvas/DOM/声音 | 不作为数值与权益事实来源；`art-manifest.mjs` 按 2 空格顶层符号追踪 |
| 统一调试门面 | `src/runtime/debug-facade.js` → 单一 `window.__CHENYUAN_DEBUG__`（`d06-unified-1`） | 无副作用 `getState()` + 结构化分组 + 全量去重绑定 |
| 确定性离线构建 | `scripts/build-playable.mjs` → `web/public/playable-v2.html` | 字节级确定性复现，直接 `file://` 与静态 HTTP 双入口均不依赖服务器或 CDN |

**D06 最终演进契约（取代原 Q5 过渡期规则）**：在 **R3-M1** 中将 `src/runtime/main.js`（31,454 行）拆分为 15 个有序子系统模块 + ~25 行 `main.js` 主循环外壳（`RUNTIME_MODULE_ORDER`），并将全部测试与评测脚本迁移到单一 **`window.__CHENYUAN_DEBUG__`（`version: "d06-unified-1"`）** 后，**一次性彻底删除历史 `window.__CHENYUAN_V18__` 至 `window.__CHENYUAN_V25__`** 及过渡性的 `namespaces`/`getNamespace`。定位代码一律按函数/符号名检索，不按旧行号盲改。

**3. Feature Inventory（完整工作清单）**

### 3.1 Q0–Q7 工作清单（`F01–F38`，均已合入 `main @ fffcb72`）

截至 `main @ fffcb72`：**`F01–F28`、`F30–F36`、`F38`（自动化与双入口）均为 `VERIFIED`**；**`F29`（真人观察式试玩）如实标记 `NOT_RUN`（0 / 5~8）**；**`F37`（非核心扩展边界）**在 Q6 时按保守基线记为 `DEFERRED`，现由 Round 3 定稿的 **D08**（见 §3.2 `R3-F07`–`R3-F08`）接管实施（仅新增关卡扫荡与长按连续养成，明确不做移动端适配）。

| ID | 工作结果 | 验收要点 | 里程碑 | 来源 | 状态 |
|---|---|---|---|---|---|
| F01 | 恢复可重复的美术清单与 CI 流程 | 使用稳定资源 key/哈希识别变更；纯代码移动不产生无意义资源差异；真实缺图仍失败，CI 实际执行游戏检查 | Q0 | B§3；C§7；H T8/T9 | VERIFIED |
| F02 | 回归运行器隔离、继续执行及失败汇总 | 普通用例失败后其余用例可运行，最终非零退出；记录 skipped/error/failed，始终输出报告与失败截图 | Q0 | B阶段0；C§7 | VERIFIED |
| F03 | 分类修复旧测试与真实回归 | 对齐开场、单击上限、Boss 门控、卷终确认、沙盒与分境解锁；未知失败逐项定位，禁止直接删断言 | Q0 | H M3–M6 日志；B§3；C§7 | VERIFIED |
| F04 | 补 R3–R6 与 E2E 接受路径 | 对 H 特性逐项建立覆盖；恢复/完成 tests/e2e 入口；缺失测试不能计绿 | Q0 | H E1/E2；B§3 | VERIFIED |
| F05 | 键盘焦点与 Enter 交互恢复 | 鼠标/键盘结束对白后均可回战场；主动 Tab 到 HUD 保留按钮 Enter；弹窗/抽屉焦点循环与返回正常 | Q0 | B§1；H T2/T3/T7 | VERIFIED |
| F06 | 数值、键位与行为说明统一 | 聚宝乾坤/破妄/破阵及 B/Q 等说明与有效结果一致；受装备条件、上限影响时明确表达 | Q0 | C§3；B§3 | VERIFIED |
| F07 | 待处理权益持久化 | 排队与 active 项刷新不丢、不重领；旧档、写失败、冲突、切关、退出沙盒路径均覆盖 | Q1 | A A1/A2/A3/A5；C§5 | VERIFIED |
| F08 | 战斗静默与安全窗口判定 | 活敌、余留危险、波次、模式状态被正确识别；暂停/读档/关窗也能重新调度，无永久等待 | Q1 | A§3–5；B§1 | VERIFIED |
| F09 | 暂停所有权与事件优先级 | 多个界面嵌套/替换后只释放自身 token；败北、冲突、剧情、选择不相互覆盖 | Q1 | A暂停清单；C§5 | VERIFIED |
| F10 | 延后自动选择和对比卡 | 混战背包满、魂印、金灵、渡劫连环选择、大限及新神通不卡战斗；权益先记账，确认仍主动 | Q1 | A A1–A5/B1/B2 | VERIFIED |
| F11 | 战报汇总、飘字分类与提示密度 | 素材不误判大横幅；重复不足提示限流；危招与数据异常不被关闭；完整档也遵守安全门控 | Q1 | A C1–C17；B§1 | VERIFIED |
| F12 | 剧情、刷怪和卷终顺序 | 开战前对白结束才启动敌群；跳过/重复回调/读档不重刷；击杀事实落盘后串行演出和回顾 | Q1 | A A6–A9/A12；H S7/S8 | VERIFIED |
| F13 | 防误触与主动操作保护 | 对比卡不承接战斗连点的消费；熔炼明确确认；菜单策略不破坏键盘和用户主动暂停 | Q1 | A A13/A14/B1；B§1；D07 | VERIFIED |
| F14 | UI 语义与组件规范 | 主线/故人/试炼/经济/系统具颜色和形状双编码；明确字阶、间距、层级、焦点及按钮状态 | Q2 | B§2；C§4/5 | VERIFIED |
| F15 | 主线、支线和故人导航模型 | 当前目标、条件、奖励、地点、前往关系一致；预览不自动进入；M/T 保持独立（D03 定稿） | Q2 | B卷轴方案；C§5；D03 | VERIFIED |
| F16 | 重复入口与成长页面收束 | 历练当前目标优先；修行分核心/进阶/收藏；工具和玩法分组；旧入口跳转仍可用 | Q2 | B§2；C§5；D03 | VERIFIED |
| F17 | 提醒分级与升级结果预览 | 未解锁/不足不伪装可领取；消费前显示成本、收益和条件；无全屏红点竞争 | Q2 | C§5 | VERIFIED |
| F18 | 高频操作与失败复盘 | 明确数量的养成操作可取消；失败原因依据本局数据；建议只导航不自动消费，长按由 Round 3 D08 接续 | Q2 | C§5；D08 | VERIFIED |
| F19 | 收益账本及可配置说明 | 覆盖全部攻击/生存/资源来源、上限、触发和成本；选中贡献与最终收益可对照 | Q3 | C§3 | VERIFIED |
| F20 | 两流派与输入职责样板 | 御剑/雷符玩法可辨；完成叠印、爆剑、闪避及派生专项练习；槽位保持独立（D02 定稿） | Q3 | B§3；C§3/5；D02/D07 | VERIFIED |
| F21 | 真实战斗评测与强度矩阵 | 各境界/投入/策略/遭遇有可复现样本；记录耗时、承伤、控制、资源和伤害来源 | Q3 | B难度；C§3 | VERIFIED |
| F22 | 装备预算、保底与定向获得 | 检查极端词条组合和随机长尾；核心构筑有可达来源；不直接用新上限覆盖旧玩家资产 | Q3 | C§3 | VERIFIED |
| F23 | 经济与寿元闭环 | 列明各卷首通/重复产出及必要成本；查套利与必经死锁；时间成本和寿元影响可预见 | Q3 | B资源/闭关；C§3；D01/D05 | VERIFIED |
| F24 | 主角与首批敌人动作精修 | 待机/移动/普攻/重击/闪避/受击可辨；狼与石卫读招、锚点、朝向和判定一致 | Q4 | C§4 | VERIFIED |
| F25 | 场景整合与试炼辨识 | 首卷分层样稿，前景不遮危招；NPC 台座区分；闲置 scene 素材经审兼容 | Q4 | B§2；C§4 | VERIFIED |
| F26 | 资产质检与制作追溯 | 本轮素材具来源、许可、源文件、哈希、使用位置；检查透明边缘/尺寸/引用，保留原图 | Q4 | C§4；H T8 | VERIFIED |
| F27 | 反馈、音效、转场与性能预算 | 普通/重击/识破/终结分级；单独听评；动效可减弱，目标设备帧时间有前后对比 | Q4 | B§2；C§4/7 | VERIFIED |
| F28 | 首卷完整体验样板 | 自然状态完成救援—选择—整备—狼王—渡劫，目标/收益/失败原因明确 | Q4 | C§6；B核心循环；D01 | VERIFIED |
| F29 | 观察式试玩与问题闭环 | 按预定样本记录理解/停顿/失败归因，保留未达标项与复测证据（当前 0/5~8） | Q4 | C§8 | **NOT_RUN** |
| F30 | 运行资产提取与独立构建 | 从实际内联版本提取 115 张 WebP；源/产物哈希可核对；文件与 HTTP 入口均有效 | Q5 | B§3；C§7；D06 | VERIFIED |
| F31 | 规则和状态渐进拆分 | 提取 10 个纯 ESM 模块；新旧结果一致（运行时深拆由 Round 3 D06 `R3-F02` 接续） | Q5 | B§3；C§7；D06 | VERIFIED |
| F32 | 测试分层与调试兼容 | 迁出 32 项纯计算单测，建立 `__CHENYUAN_DEBUG__` 门面（清理 `V18–V25` 由 Round 3 D06 `R3-F03` 接续） | Q5 | H接口；B§3；C§7 | VERIFIED |
| F33 | 文档与版本记录同步 | README/命令/测试数量/构建步骤准确；历史更新志保留，新增事实性变更记录 | Q5 | B§3；C§7 | VERIFIED |
| F34 | 后续卷次、故人和遭遇覆盖 | 逐卷明确目标、敌招考题、成长收益与故事回应，正式进度链覆盖完整 | Q6 | B§3；C§6 | VERIFIED |
| F35 | 第五卷与进阶门槛方案 | 法则共鸣与叙事桥接，不新增地图/Boss/硬门槛（D01/D04 定稿锁定） | Q6 | B阶段2/5；C§6；D01/D04 | VERIFIED |
| F36 | 高阶系统与模式整合 | 高阶模式三分组与 D07 解锁一致；D05 缩放/货币/评级演进由 Round 3 `R3-F04`–`R3-F06` 接续 | Q6 | B阶段3；C§3/9；D02/D05/D07 | VERIFIED |
| F37 | 非核心扩展边界 | Q6 时按保守基线登记 DEFERRED；现由 Round 3 D08（`R3-F07`–`R3-F08`）接管扫荡与长按（不做移动端） | Q6 | C§5/9；D08 | SUPERSEDED_BY_R3_D08 |
| F38 | 最终回归、发布与回退交付 | 阶段二 165/165 自动化 + 双入口证据包落盘；F29 真人试玩仍 `NOT_RUN` | Q7 | H M7；A验证；B/C验收 | 自动化 VERIFIED / 真人 NOT_RUN |

### 3.2 Round 3 工作清单（`R3-F01`–`R3-F08`，承接定稿决策 D06 / D05 / D08）

| ID | 工作结果 | 验收要点 | 里程碑 | 对应决策 | 状态 |
|---|---|---|---|---|---|
| **R3-F01** | D01–D08 决策定稿写回与 Round 3 执行计划 | 将全部 8 项定稿（5 项锁定基线 + 3 项 Round 3 实施）与 `R3-M0→M1→M2→M3` 详细步骤、接口合同、验收场景写回 `docs/analysis/PROJECT.md`；不破坏 `Q6-4` | R3-M0 | D01–D08 | IMPLEMENTED |
| **R3-F02** | `src/runtime/main.js` 深度子系统拆分与确定性构建 | 将 31,454 行 `main.js` 按连续拓扑顺序拆为 15 个有序 `src/runtime/<subsystem>.js` + ~25L `main.js` 主循环外壳（保留 `L30896–30993` 交错监听）；`build-playable.mjs` 导出 `RUNTIME_MODULE_ORDER`，`build:check` 逐字节一致且 `art:manifest:check` 零漂移 | R3-M1 | D06 | PLANNED |
| **R3-F03** | 统一 `window.__CHENYUAN_DEBUG__` 与清除 `V18–V25` | 重写 `debug-facade.js` 为 `d06-unified-1`（无副作用统一 `getState()` + 5 结构化分组 + 363 去重键直接绑定）；迁移单测/77 回归/56 E2E/`eval-combat-matrix`，彻底删除 `V18–V25` 与 `namespaces`/`getNamespace` 并加静态守卫 | R3-M1 | D06 | PLANNED |
| **R3-F04** | 主线关卡敌群随玩家境界动态缩放 | 在 `src/rules/combat-stats.mjs` 新增纯函数 `computeMainlineRealmScaling(stageIdx, realmId, isBoss)` 锚定 `REALM_COMBAT_BASELINE`；仅注入主线 `spawnSingleEnemy()`（不双倍缩放非主线模式）；保留低关修为衰减 `spiritCh1WolfXp <= 15`；世界地图展示同步提示；84/84 战斗矩阵通过 | R3-M2 | D05 | PLANNED |
| **R3-F05** | 货币精简与零散副货币移除折合 | 保留灵石与 7 种核心材料，彻底删除 `metaState.reincarnationPoints`（改为 `bingjieCount` 折合至 `legacyStones <= 240`）与 `game.sectMerits`（改为 `sectDefenseCleared`/`sectDefenseBestGrade` 并折合为 320 灵石 + `core×2` + `jade×1~2`）；不背旧档迁移包袱；`audit-economy` 通过 | R3-M2 | D05 | PLANNED |
| **R3-F06** | 全模式统一 `S / A / B / C` 评级与 `stageStars` 兼容修复 | 消除 `D`/`SS`/`SSS`/`S+`，统一 `UNIFIED_GRADES = ["C","B","A","S"]` 与 `stageStarsToGrade`（`3★↔S`, `2★↔A`, `1★↔B`, `0★↔C`）覆盖道果金榜、万剑冢、风华评级、连击阶位、演武、主线及 5 个侧边模式；修复 `getExpeditionNodeStageSynergy` 纯对象 `stageStars` 缺陷；新口径五场景存档全绿 | R3-M2 | D05 | PLANNED |
| **R3-F07** | 关卡扫荡（限 3★ / S 级、显式确认、免耗寿） | `src/rules/sweep-rules.mjs` 实现 3 次/日上限 + 60 秒冷却 + 0 月寿元 + 真实掉落（含 24/24 溢出入 `pendingRewards`）；世界地图预览条与重构后的历练抽屉卡片均提供入口；显式确认弹窗 + `stageSweepState` 持久化 + 写入失败原子回滚 + 焦点返回 | R3-M3 | D08 | PLANNED |
| **R3-F08** | 长按连续养成（强化 / 炼丹）与桌面 1440×900 边界 | 支持装备强化与稳炼成丹长按（380ms 触发 / 220ms 步进、零误双扣、明确单次扣费与 `#hold-progression-status` 提示、跨 `renderDrawerContent()` DOM 重建保持状态与焦点、11 项立即停止矩阵含缺料不补购/大限保护/写失败回滚、键鼠一致、保留 Q2 批量弹窗）；明确不做移动端适配；同步更新 `Q6-4` 与 `q6-decisions-and-boundary.md` | R3-M3 | D08 | PLANNED |

**4. Milestones（依赖、状态与 Round 3 分步执行计划）**

### 4.1 阶段一 / 阶段二里程碑（Q0–Q7，均已合入 `main @ fffcb72`）

| 编号 | 范围 | 依赖 | 分支 / PR | 出口 | 状态 |
|---|---|---|---|---|---|
| Q0 | F01–F06 | 初始基线 | `codex/q0-infra-and-tests`、`codex/q0-focus-and-copy`（PR #20 `28d02e2`、PR #21 `292b7b1`） | 失败分类与修复有结果，历史关键动态债补齐，Enter 和说明正确 | VERIFIED |
| Q1 | F07–F13 | Q0 | `codex/combat-calm`（PR #22 `dfbbd38`） | 延期权益安全、调度/暂停/焦点一致，自动打断明显减少 | VERIFIED |
| Q2 | F14–F18 | Q1 | `codex/navigation-hierarchy`（PR #23 `6946074`） | 当前目标和常用操作可找到，入口迁移无丢失 | VERIFIED |
| Q3 | F19–F23 | Q2 | `codex/combat-growth-slice`（PR #24 `fc9004f`，融合 PR #25 `2b1ca3a`） | 两流派自然配置有证据，预算和经济可解释 | VERIFIED |
| Q4 | F24–F29 | Q3 | `codex/first-volume-polish`（PR #26 `4b86533`） | 动作/美术/音效/首卷联合验证；F29 真人试玩待招募（0/5~8） | F24–F28 VERIFIED / F29 NOT_RUN |
| Q5 | F30–F33 | Q4；D06 保守基线 | `codex/modular-source`（PR #27 `df5efda`） | 可重复生成独立发行包，兼容与对比结果通过 | VERIFIED |
| Q6 | F34–F37 | Q5；D01/D04/D05/D07/D08 保守基线 | `codex/campaign-quality`（PR #28 `5115b8e`） | 后续品质覆盖；F37 当时按 D08 记为 DEFERRED（现由 Round 3 D08 接管） | F34–F36 VERIFIED / F37 DEFERRED |
| Q7 | F38 | Q0–Q6 选定范围验收 | `codex/quality-release`（PR #29 `fffcb72`） | 最终自动化（165/165 PASS）与双入口证据包及回退说明完整，未决范围如实列出 | 自动化 VERIFIED / 真人试玩 NOT_RUN |

### 4.2 Round 3 里程碑总览（`R3-M0 → R3-M1 → R3-M2 → R3-M3`）

Round 3 按依赖顺序串行实施，每个里程碑在前一个 PR 通过 GitHub Actions 全量 CI 并合入 `origin/main` 后再切出新分支：

| 编号 | 对应决策与功能 | 依赖 | 独立分支 | 出口门禁 | 状态 |
|---|---|---|---|---|---|
| **R3-M0** | D01–D08 定稿写回与计划拆解（`R3-F01`） | Q7（`main @ fffcb72`） | `codex/r3-plan-update` | `docs/analysis/PROJECT.md` 完整定稿、无内部矛盾、不破 `Q6-4`；`build:check` / `test:unit` / `art:manifest:check` 与 CI 全绿 | IMPLEMENTED（待 CI/合入） |
| **R3-M1** | **D06** 深度拆分 `main.js` + 清理 `V18–V25`（`R3-F02`–`R3-F03`） | R3-M0 | `codex/d06-modular-debug-clean` | 15+1 模块确定性打包一致、`art:manifest:check` 零漂移、`V18–V25` 归零、统一 `__CHENYUAN_DEBUG__`（`d06-unified-1`）、`V14` 与全量 CI PASS | PLANNED |
| **R3-M2** | **D05** 主线动态缩放 + 精简副货币 + 统一 `S/A/B/C`（`R3-F04`–`R3-F06`，不需要理会旧存档） | R3-M1 | `codex/d05-scaling-economy-grade` | 主线 5×7 缩放、84/84 战斗矩阵与 `audit-economy` PASS、`reincarnationPoints`/`sectMerits` 零残留、全模式 `S/A/B/C`（`3★↔S`）、`V15` 与全量 CI PASS | PLANNED |
| **R3-M3** | **D08** 关卡扫荡 + 长按连续养成（`R3-F07`–`R3-F08`，不做移动端适配） | R3-M2 | `codex/d08-sweep-hold-qol` | 3★/S 免耗寿扫荡 + 长按强化/炼丹（11 项停止矩阵与 DOM 重建防护）+ `Q6-4` / `q6-decisions-and-boundary.md` 同步更新、`V16` 与双入口全量 CI PASS | PLANNED |

---

### 4.3 `R3-M1`（D06）详细执行步骤 — `codex/d06-modular-debug-clean`

> **目标**：将 31,454 行 `src/runtime/main.js` 按连续拓扑边界拆分为 15 个有序子系统模块 + ~25 行 `main.js` 主循环外壳；合并全部 364 个去重调试键至统一 `window.__CHENYUAN_DEBUG__`（`d06-unified-1`）并彻底删除 `V18–V25`。

1. **按连续拓扑顺序拆分 `src/runtime/main.js` 为 15+1 个运行时模块**（保持 2 空格顶层声明缩进与既有同步初始化顺序，确保零 TDZ 且 `scripts/art-manifest.mjs` 的 `usageSymbols` 零漂移；**关键注意**：提取并保留 `L30896–30993` 间与 `V18/V19/V25` 交错的 3 个真实 DOM 监听 `input`/`panelScrollBodyEl toggle`/`change` 到 `src/runtime/input-handlers.js`）：

| 顺序 | 模块文件 | 原 `main.js` 源码区间 | ~行数 | 职责边界 |
|---:|---|---|---:|---|
| 1 | `src/runtime/world-data.js` | `1–1684` | 1,684 | 战役/敌群/剧情/洞府/地宫/九州图/因果/Boss 数据表、`IMG_CACHE`、`metaState` 初始化、`game`/`checkpoint`/`cutscene`/`furnaceGame`、`STAGES`、`REGION_POEMS` |
| 2 | `src/runtime/narrative-state.js` | `1685–2765` | 1,081 | `CHAPTER_CUTSCENES*`、过场引擎、剑势/羁绊/飞升结局、`keysDown`/`pointer`、`arena` 核心状态、`BOSS_RUSH_ROSTER`、无障碍 `loadA11ySettings`、Q4 性能与试玩遥测、兵器/伙伴配置 |
| 3 | `src/runtime/flagship-systems.js` | `2766–4579` | 1,814 | V18（顿帧、Z 轴滞空、因果抉择、仙葫、外观、拍照模式）、V19（魂印、拼刀、处决、风华评级、残影录屏、星图）、V16/V17 键位与手柄输入缓冲 |
| 4 | `src/runtime/endgame-modes.js` | `4580–6600` | 2,021 | 万剑冢连战与心魔试炼、双人换阵、御剑滑翔与护宗大阵、V21 六象觉醒、双侠合击、云海空战、九重天阙、交互图鉴展示 |
| 5 | `src/runtime/primordial-systems.js` | `6601–8564` | 1,964 | V22（`loadAudioStems`、星辰法相、灵兽坐骑、奇门八门、自定义种子工坊）、V23（天时相位、本地双人协同、太虚炼器、空间裂隙、四格战卷） |
| 6 | `src/runtime/genesis-dojo.js` | `8565–11400` | 2,836 | V24（连招编排、三清分身、山河社稷域、远征驻守、仙舟炮击、云存档码）、Boss Rush 计分、动作/境界门控、元素机关、演武桩 AI、复盘与遥测界面、`loadKeybinds`、`createFreshGame`、`normalizeLoadedGame` |
| 7 | `src/runtime/persistence-sandbox.js` | `11401–12209` | 809 | M1 主/元存档读写校验与多标签页冲突引擎（`storage`/`pagehide`/`visibilitychange`）、沙盒隔离 |
| 8 | `src/runtime/scheduler-rewards.js` | `12210–13599` | 1,390 | Q1/Q2 `pauseTokens`、`MODAL_PRIORITY`、战斗静默调度、通知总线、持久化 `pendingRewards`、装备对比/溢出与防误触、解锁卡、升级预览、提醒分级、导航快照 |
| 9 | `src/runtime/sanctum-ecosystem.js` | `13600–15491` | 1,892 | M3 洞府建设、寿元/兵解轮回、故人枢纽与因果黑市；M4 生态阶梯、万世谱、劫火新周目、新手引导 |
| 10 | `src/runtime/stage-expedition.js` | `15492–17029` | 1,538 | 洞府入场、`initArenaStage`、波次与刷怪器、拾取磁吸、分支传送门、M2 五层星图与单局赐福 |
| 11 | `src/runtime/combat-skills.js` | `17030–19027` | 1,998 | 战斗技能、手动挥剑、收剑引爆、羁绊、太虚剑域、闪避识破、灵宠/伙伴技、实时渡劫、飞升/道果/流派构筑选择 |
| 12 | `src/runtime/combat-step.js` | `19028–21818` | 2,791 | `damageEnemy`、`handleEnemyDeath`、`stepFurnaceMinigame`、`stepArena(dt)`、机关交互、败北复盘与决策、`hurtPlayer`、石台抉择 |
| 13 | `src/runtime/renderer.js` | `21819–24748` | 2,930 | Canvas 适配、`SPRITE_ANCHORS`、角色动作骨骼与敌招预警、光影印章、飞剑/剑域/雷劫渲染、Q4 三层景深视差、`renderArenaCanvas()` |
| 14 | `src/runtime/ui-modals-drawer.js` | `24749–27872` | 3,124 | 道途雷达 SVG、HUD/Boss 血条/冷却、焦点陷阱与 `focusBattlefield`、模态/抽屉控制器、炼丹与强化单/批量界面、魂印/炼丹炉/结局/设置弹窗、标题页 |
| 15 | `src/runtime/input-handlers.js` | `27873–30868` + `30896–30927` + `30939–30993` | 3,083 | 全部全局输入与事件委托监听（`keydown`/`keyup`/`contextmenu`/`pointer*`/`wheel`/`input`/`click`、原交错的音轨/工坊/无障碍 `input`、`panelScrollBodyEl` `toggle` 与 `change`） |
| 16 | `src/runtime/main.js` | `30869–30888` | ~25 | 薄运行时主循环外壳：BGM `setInterval`、`lastTs`、`mainLoop(now)` |

2. **升级 `scripts/build-playable.mjs`**：导出 `RUNTIME_MODULE_ORDER`（上述 16 项，前接 `preamble.js`、后接 `debug-facade.js` + `boot.js`），逐个执行 `readUtf8Strict()`（禁 BOM、LF 规范化、拒 `</script`），以 `  // --- [runtime] ${relPath} ---\n` 拼接入单一 IIFE，返回 `runtimeModuleCount`，保持 `build:check` 与全部离线/SHA-256 守卫不变。
3. **重写 `src/runtime/debug-facade.js` 并删除 `V18–V25`**：
   - 彻底删除全部 8 个 `window.__CHENYUAN_V18__`–`__V25__` 定义及 `namespaces`/`getNamespace`。
   - 暴露单一 `window.__CHENYUAN_DEBUG__`（`version: "d06-unified-1"`）：① **无副作用统一 `getState()`**（合并原 V18–V25 全部互不冲突的状态字段，纯读取 `arena.coop2P || null`、`arena.sanqingState || null` 等，禁止在读状态时调用 `ensure*` 污染 `game`/`arena`）；② 结构化分组 `rules`、`q6`、`persistence`、`art`、`telemetry`（直接绑定内部函数）；③ 将原 363 个非 `getState` 去重符号（312 个 V25 键 + 51 个 V18–V24 独有键，完整保留 `startColossalTitanRaid: () => startBossRushGauntlet(7)` 与 `executeSixAspectAwakeningSkill: () => executeSixAspectAwakeningSkill(getCombatStats(game), 1.0, 1.0)` 包装）直接挂载于 `window.__CHENYUAN_DEBUG__`（顶层共 370 键）。
4. **迁移全部调用方与测试并加静态守卫**：
   - `scripts/eval-combat-matrix.mjs`（2 处 V25 → `sandbox.__CHENYUAN_DEBUG__`，返回 `debug`）；
   - `scripts/verify-playable-v2.mjs`（548 处 `V18–V25` → `window.__CHENYUAN_DEBUG__`；更新 `Q5-1` 断言 `V18–V25` 严格为 `undefined` 且 `version === "d06-unified-1"`、更新 `Q5-2` 校验 `file://` 版本号）；
   - `tests/e2e/tiers/tier{1..4}-*.mjs`（103 处 `V18/V25` → `window.__CHENYUAN_DEBUG__`）；
   - `tests/unit/build-parity.test.mjs`：断言 `V18–V25 === undefined`、校验 `RUNTIME_MODULE_ORDER`、扩展外部 URL 负向守卫到拆分模块，并新增跨 `src/`、`scripts/`、`tests/e2e/` 的零 `__CHENYUAN_V(1[89]|2[0-5])__` 残留静态守卫；
   - 运行 `npm run build`，同步 `docs/CHANGELOG.md`、`docs/design.md` 与 `docs/analysis/PROJECT.md` 状态日志。
5. **R3-M1 出口验收**：`npm run build:check`、`npm run test:unit`、`npm run art:manifest:check`（`docs/art-manifest.md` 零 diff）、`rg '__CHENYUAN_V(1[89]|2[0-5])__' src/ scripts/ tests/e2e/ web/public/playable-v2.html` 返回空、`node scripts/eval-combat-matrix.mjs`、`npm run test:regression`、`npm run test:e2e` 与 GitHub Actions CI 全绿后合入 `main`。

---

### 4.4 `R3-M2`（D05）详细执行步骤 — `codex/d05-scaling-economy-grade`

> **目标**：基于 R3-M1 拆分后的清晰模块，落地主线境界动态缩放、精简 `reincarnationPoints`/`sectMerits` 副货币与全模式统一 `S/A/B/C` 评级（含 `3★ ↔ S` 双射）。**用户明确不需要理会旧存档**，按新口径干净实现。

1. **实现主线敌群随玩家境界动态缩放（纯规则 + 主线隔离注入）**：
   - 在 `src/rules/combat-stats.mjs` 新增纯函数 `computeMainlineRealmScaling(stageIdx, realmId, isBoss = false)` 并挂载到 `window.__CHENYUAN_DEBUG__.rules`：
     - 锚定 `REALM_COMBAT_BASELINE`：`delta = rankOf(realmId) - clamp(0, 4, stageIdx)`；`delta <= 0` 时严格返回 `{ active: false, delta: 0, hpMult: 1, atkMult: 1, postureMult: 1, stoneMult: 1 }`（保持同境 100% 数值一致）。
     - `delta > 0` 时，由 `curRb / baseRb` 计算原始血/攻比值并施加阻尼：第 5 关（`stageIdx === 4`，兼承第五卷元婴与第六卷化神终局）在 `delta === 1`（化神）取 `hpEase = 1.0, atkEase = 1.0`（Boss HP `45,336 → 63,788`，TTK ~31.7s）、`delta >= 2`（飞升）取 `hpEase = 0.90`；回访前四关（`0..3`）取平滑阻尼 `hpEase = Math.max(0.65, 0.85 - (delta - 1) * 0.05)`、`atkEase = Math.min(0.82, hpEase)`（保持 Boss TTK 21.4s–36.4s、既具挑战又保留境界压制感），同步返回 `postureMult = Math.min(1.65, 1 + delta * 0.12)` 与 `stoneMult = Math.min(2.20, 1 + delta * 0.22)`。
   - 在 `spawnSingleEnemy()`（位于 R3-M1 拆分后的 `src/runtime/stage-expedition.js`）仅当**主线关卡上下文**（排除 `towerMode`、`bossRush`、`celestialSpire`、`sectDefense`、`cloudFlight`、`customSeedRun`）时应用 `rs.hpMult`/`rs.atkMult`/`rs.postureMult` 并记录 `e.realmScaledDelta = rs.delta`。
   - 在 `handleEnemyDeath()`（`src/runtime/combat-step.js`）对主线缩放击杀的灵石乘以 `rs.stoneMult`，同时**严格保留低关修为衰减 `realmPenalty`（`spiritCh1WolfXp <= 15`）**；在世界地图预览条（`openWorldMapModal`）展示动态同步提示（`⚖ 敌群随【xx期】动态同步 · 灵石 ×X`）。
2. **彻底精简零散副货币并折合入核心资源（零旧档迁移垫片）**：
   - **移除 `metaState.reincarnationPoints`（轮回道果点）**：清理 `src/state/save-rules.mjs`、`ensureMetaState`/`isMetaBehind`、`openLifespanExhaustedModal`、`executeReincarnation`、`recordPastLifeInHall`、`openHallOfLivesModal` 与 `scripts/audit-economy.mjs`；引入单调轮回计数 `metaState.bingjieCount`（CRDT `numMax` 合并），在 `createFreshGame()` 折合为开局传承灵石 `legacyStones = Math.min(240, (metaState.ascensions || 0) * 45 + (metaState.bingjieCount || 0) * 40)`（上限 240 防兵解刷石套利），更新兵解弹窗/提示/万世谱文案。
   - **移除 `game.sectMerits`（护宗功勋）**：清理 `startSectDefenseSiege`、`openSectDefenseResultModal`、`stepSectDefenseSiege`、`fireManualSlash` 与 `src/rules/campaign-q6.mjs` `VOL5_RESONANCE_PILLARS[5]`；新增明确初始化与清洗字段 `game.sectDefenseCleared = false` 与 `game.sectDefenseBestGrade = null`，护宗胜利奖励折合为 **`320 灵石`（+60）+ `core ×2` + `jade ×(S?2:1)`**（保留 `bonusStarPts +2` 与永久 `+16` 攻击），`fireManualSlash` 改为依据 `game.sectDefenseCleared` 生效，第五卷共鸣柱改判 `sectDefenseCleared || sectDefenseBestGrade`。保留 `bonusStarPts` 作为二十八星宿加点系统机制。
3. **全模式统一 `S / A / B / C` 评级并修复 `stageStars` 对象兼容**：
   - 在 `src/rules/scoring-rules.mjs` 定义唯一规范常量与纯函数：`UNIFIED_GRADES = ["C","B","A","S"]`、`UNIFIED_GRADE_RANK = { C: 1, B: 2, A: 3, S: 4 }`、`isValidUnifiedGrade`、`maxUnifiedGrade`、`stageStarsToGrade(stars)`（`3★↔S`, `2★↔A`, `1★↔B`, `0★↔C`）、`computeModeGrade(mode, metrics)`；在 `src/state/save-rules.mjs` 以 `UNIFIED_GRADE_RANK` 替换 `RUSH_GRADE_RANK` 并直接清洗非白名单评级。
   - 统一全部 6 套存量体系 + 补齐 5 套侧边模式评级：
     - **道果金榜 (`getScoreGrade`)**：4 档 `C/B/A/S`（`>=4200 S / >=2200 A / >=1000 B / else C`，保持全 5 关且 `>=10★` 才放行 `S`），`rushMap = { S: 360, A: 200, B: 100, C: 40 }`；
     - **万剑冢连战 (`computeBossRushScoreAndGrade`)**：`>=2000 S / >=1000 A / >=650 B / else C`，`rush_s` 词条与飞升剑气外观解锁统一改为 `metaState.bestRushGrade === "S"`；
     - **剑道风华评级仪 (`getStyleRankSpec`) & 连击阶位 (`getComboTier`)**：消除 `D`/`SSS` 收口为 `C/B/A/S`，星辰法相瞬发触发与 `#combo-rank-seal` 样式/提示改对 `rank === "S"`；
     - **演武训练 (`dojoSession.grade`)**：补齐 `C/B/A/S`；
     - **主线关卡 (`game.stageStars`)**：保留 `0..3` 作为星级里程碑/星魂点/D08 扫荡底层数据源，全 UI 统一双显 **`S 级 (★★★)` / `A 级 (★★☆)` / `B 级 (★☆☆)` / `C 级`**；
     - **侧边模式统一显示 `S/A/B/C`**：护宗大阵（存 `sectDefenseBestGrade`）、云海空战（存 `cloudSeaBestGrade`）、九重天阙、无尽锁妖塔、自定义种子工坊；
     - **顺带修复潜在缺陷**：修复 `src/rules/campaign-q6.mjs` 中 `getExpeditionNodeStageSynergy` 错误使用 `Array.isArray(g.stageStars)` 的问题，使其同时兼容线上纯对象 `{ 0: 3 }` 与数组。
4. **同步更新测试与审计脚本并新增 `R3-D05-*` 验收**：
   - 更新单测：`tests/unit/{scoring-rules,save-rules,campaign-q6,combat-math,build-parity}.test.mjs`（新增 `computeMainlineRealmScaling`、`stageStarsToGrade`、`computeModeGrade`、纯对象 `stageStars` 协同测试）；
   - 更新回归与 E2E：`scripts/verify-playable-v2.mjs`（适配 `S` 级与 `bingjieCount`/`sectDefenseCleared` 断言并新增 `R3-D05-*` 动态缩放、低关修为衰减保留、零超 S 评级、零副货币与新口径五场景存档测试）、`tests/e2e/lib/fixtures.mjs`；
   - 更新审计脚本：`scripts/audit-economy.mjs`（替换为 `d05CurrencyAudit` 校验副货币归零与 `legacyStones <= 240`）、运行 `scripts/eval-combat-matrix.mjs` 验证全 84+ 场景（含化神第 5 关与高境回访探针）`bossWinRate === 1`、`outliers === []`、`heavyHitsSurvivable >= 2.2`。
5. **R3-M2 出口验收**：`npm run build && npm run build:check && npm run art:manifest:check && npm run test:unit`、`eval-combat-matrix` & `audit-economy` PASS、零残留静态检索（`reincarnationPoints|sectMerits|轮回道果点|护宗功勋` 与 `"SSS"|"SS"|"S\+"`）、`npm run test:regression`、`npm run test:e2e` 与 CI 全绿后合入 `main`。

---

### 4.5 `R3-M3`（D08）详细执行步骤 — `codex/d08-sweep-hold-qol`

> **目标**：基于 R3-M2 统一 `S 级 (★★★)` 评级与新存档口径，落地**三星/S 级显式确认免耗寿关卡扫荡**与**强化/炼丹长按连续养成**；**明确不做移动端适配**，保持桌面 1440×900 键鼠。

1. **关卡扫荡纯规则模块（`src/rules/sweep-rules.mjs`，加入 `ESM_MODULE_ORDER`）**：
   - 常量：`STAGE_SWEEP_MAX_PER_DAY = 3`、`STAGE_SWEEP_COOLDOWN_MS = 60_000`、`STAGE_SWEEP_LIFESPAN_MONTHS = 0`。
   - 存档字段：`game.stageSweepState`（`createFreshGame` 初始化 `{}`，`normalizeLoadedGame` 严格校验 `0..4`、`dayKey`、`usedToday ∈ [0..3]`、`lastSweepAt`、`totalSweeps`，纳入 envelope v2 校验）。
   - 纯函数：`getStageSweepStatus(game, stageIdx, nowMs, env)`（校验境界解锁、`stageStars[stageIdx] >= 3` 即 `S` 级、非练习模式、每日剩余次数与冷却）、`computeStageSweepPreview(game, stageIdx, env)`、`rollStageSweepRewards(game, stageIdx, { rng, env })`（严格复用真实 `CAMPAIGN_ACTS` 9 小怪 + 1 Boss 的 `ENEMIES`/`gainRealmXp`/`rollGearItem`/`acquireGearItem` 公式，支持行囊满 24/24 入 `game.pendingRewards` 的 `gear_overflow`，绝不扣寿元，不发放 `bonusStarPts`/`soul_unlock`/过场剧情）。
2. **关卡扫荡 UI 入口、显式确认弹窗与原子回滚**：
   - **世界地图预览条**（`openWorldMapModal` `#world-map-preview-strip`）：新增 `#btn-map-sweep-stage`（`data-open-stage-sweep="${stageIdx}"`），按状态显示可扫荡余次 / `🔒 需三星(S级)扫荡` / 冷却秒数 / 今日已满。
   - **历练抽屉关卡卡**（`renderDrawerContent` explore 页签）：将外层 `<button class="visual-tile" data-warp-stage="${idx}">` 重构为 `<div class="visual-tile">`，内置并列的 `[data-warp-stage="${idx}"]`（出征，保持既有测试选择器完全兼容）与 `[data-open-stage-sweep="${idx}"]`（扫荡）按钮，规避 HTML5 按钮嵌套缺陷。
   - **显式确认弹窗**（`openStageSweepConfirmModal`）：在 `MODAL_PRIORITY` 注册 `stage_sweep: 40`，`closeModal()` 清空 `pendingStageSweep`；展示目标秘境、`S 级 (★★★)` 徽章、醒目 **`免耗寿元（消耗 0 月寿元）`** 标签、剩余次数与 60 秒冷却说明、真实奖励预览（行囊满时明确提示进【待处置】）、`取消`/`Esc` 与确认按钮 `#btn-confirm-stage-sweep`。
   - **原子执行与回滚**（`executeStageSweep`）：确认时二次校验资格，保存完整状态快照（`stones`/`xp`/`overflowXp`/`inventory`/`equippedGear`/`gearBag`/`pity`/`pendingRewards`/`resolvedRewardIds`/`stageSweepState`/`goalStats`/`journal.length`），通过 `acquireGearItem(..., { deferSave: true })` 合并在单次 `saveGame()` 提交；若写入失败立即原子回滚全部状态并弹明确错误提示；成功后关窗、刷新界面、返焦至触发按钮并弹清晰汇总提示。
3. **长按连续养成控制器（强化 / 炼丹，解决 `renderDrawerContent()` DOM 替换陷阱）**：
   - 保留 Q2 F18 显式批量按钮（`data-open-batch-enhance`、`data-open-batch-craft`）及批量弹窗不动。
   - 提取单步原子执行器 `executeSingleGearEnhance(slot, { silentToast, fromHold })` 与 `executeSingleAlchemyCraft(recId, { silentToast, fromHold })`（均为单步增加 `saveGame() === false` 原子回滚，且当 `fromHold === true` 时：遇炼丹缺料直接返回 `{ ok: false, stopReason: "missing_materials" }` 绝不自动花灵石补购或中途弹窗；遇 `previewLifespanImpact.willExhaust` 提前返回 `lifespan_guard` 绝不越过 100% 大限）。
   - 在模块级维护逻辑状态 `holdProgression = { active, kind, key, inputType, keyCode, pointerId, pointerX, pointerY, startTimer, repeatTimer, didRepeat, steps, totalStones, totalOutput, totalMonths, startLvl, endLvl, itemName }`（不绑定 DOM 节点实例）；设置 `HOLD_START_DELAY_MS = 380`、`HOLD_REPEAT_INTERVAL_MS = 220`；触发连续步进后设置 `suppressClickTarget` 吞掉释放时的尾随 `click` 确保零双扣。
   - 在按钮旁渲染清晰单次扣费说明，并在 `#jade-panel` 顶部渲染跨重绘持久化的 `#hold-progression-status`（`role="status"`、`aria-live="polite"`）；每次 `renderDrawerContent()` 替换 `#panel-scroll-body` 后立即按逻辑 `[data-enhance-slot="${key}"]`/`[data-quick-craft="${key}"]` 重新定位按钮，恢复 `.is-holding` 样式、键盘焦点与指针边界检查。
   - 在 `window`/`document` 及抽屉/模态生命周期接通全部 **11 项立即停止条件**（见 §5.8），并在 `drawerOpen` 的 `keydown`/`keyup` 中接管 `Space`/`Enter`（首按与 `ev.repeat` 均 `preventDefault()`），实现键鼠完全一致体验；停止时合并输出 1 条汇总反馈提示。
4. **明确桌面 1440×900 边界 & 更新 `Q6-4` 与文档**：
   - 不新增任何 9:16 竖屏布局、虚拟摇杆或移动端测试（保留 `src/styles/main.css` 既有无害窄窗规则不动）。
   - 同步更新 `docs/analysis/q6-decisions-and-boundary.md`（记录 D08 扫荡与长按已落地、移动端仍明确不做、F29 真人试玩仍 `NOT_RUN`）与 `scripts/verify-playable-v2.mjs` 的 `Q6-4` 断言（转为验证 D08 安全边界不变式，而非旧的 `sweepBtns === 0`）。
   - 新增单测 `tests/unit/sweep-rules.test.mjs` 与回归/E2E 用例 `R3-D08-*` 覆盖 `V16` 全部正反场景（含 0/1/2★ 拒绝、取消/Esc、0 耗寿、24/24 溢出、冷却与跨日重置、写失败原子回滚、短按单次、长按跨 DOM 重建、缺料/灵石不足/满级/大限/失焦/移出/键盘松手停止、Q2 批量共存、直接 `file://` 与 HTTP 双入口）。
5. **R3-M3 出口验收**：`npm run build && npm run build:check && npm run art:manifest:check && npm run test:unit`、`npm run test:regression`、`npm run test:e2e`、静态 HTTP 与直接 `file://` 1440×900 桌面 Chromium 实测及 GitHub Actions CI 全绿后合入 `main`。

**5. Interface Contracts（实现与验证合同）**

**5.1 通知、静默与安全状态**

通知类别 N0–N3 采用综述定义，与任务优先级 P0/P1 分开。建议事件数据包含 `eventId`、`kind`、`noticeClass`、`sourceMode`、`stageEpoch`、`createdAt`、`payload`、`status`；字段名可调整，但来源、身份和生命周期必须保留。日志字符串不能承载唯一奖励记录。

`isCombatCalm` 或等效逻辑检查活敌、危险投射物/区域、波次转换、渡劫、败北、过场及模式生命周期。洞府、星图房、连战、爬塔、空战、护山分别定义安全窗口；不能因空战 active 标记未清而永久压住队列。候选宽限 0.8 秒需配置化并验证，不能依靠恰好等待若干帧碰运气。

每次事件入队、战斗清场、模式结束、关窗、回洞府、读档和切换前台界面均重新评估。调度器可在独立 UI 更新或生命周期回调中运行，不能只放在 `stepArena` 的 paused 提前返回之后。自动放行只打开下一个合法界面，不代选、不自动前往下一卷。

玩家主动打开“待处置”可跳过普通战斗静默等待，但不得越过败北、冲突、只读、确认条件或正在进行的互斥流程。关闭后恢复合法状态，不泄露残留按键和鼠标点击。

**5.2 暂停与焦点所有权**

每个模态、抽屉、剧情、照片模式和败北界面持有独立 token；关闭/替换只释放自身 token，最后一个暂停来源解除后才能恢复战斗。若使用 Set，成员必须代表实例而非共享字符串 `modal`。`arena.paused` 暂时保留为兼容派生值，并逐个迁移写入者。

保留 Tab/Shift+Tab 循环、Escape 关闭规则、输入框快捷键隔离、重新绑定键位流程。剧情结束后若没有有效的原触发控件，焦点回到可操作的战场容器。战场焦点下 Enter 交互；用户主动聚焦按钮时 Enter 激活按钮。不得为了修复自动焦点错误而全局覆盖按钮和输入框行为。

**5.3 权益、保存、迁移与冲突**

建议用 `game.pendingRewards` 或等效新字段统一持久化必须保留的选择项。旧存档缺字段默认为空；现有已存入 owned/unlocked 数据的奖励不再二次发放。正在显示的 active 项仍属于待处理权益，不能 shift 出队后仅存剩余数组。

完成选择时，资源扣除/奖励变化和该事件完成标记写入同一规范化存档载荷。快速重复点击、刷新、重放旧回调不能重复消费或发放。写入失败保留可重试状态并明确告知，不伪报“保存成功”；冲突遵守现有 revision/只读保护，不能简单拼接两个标签页的奖励造成双领。

切关、返回标题、读档和沙盒切换只能清理视觉临时状态，不能清空未处理的正式权益。沙盒/练习来源与正式存档隔离，不能把其事件导出回正式队列。战报可有容量限制；待处理权益需有容量策略且不得静默丢弃。

新字段经 `normalizeLoadedGame` 校验类型、ID、数量与允许值，渲染继续转义；不从存档恢复函数或任意 HTML。主存档 envelope v2、元存档 rev 与原数据保护保持兼容。

- **D05 存档边界补充（2026-11-24 用户拍板）**：用户已明确 **D05 不需要理会旧存档**。因此 R3-M2 删除 `metaState.reincarnationPoints` 与 `game.sectMerits`、收口评级为 `S/A/B/C` 时，**不编写旧档副货币折算或旧 `SS/SSS/S+/D` 迁移兼容垫片**；`normalizeLoadedGame` 与 `ensureMetaState` 直接按新口径清洗（非白名单评级清洗为 `null` 或 `hallOfLives` 条目清洗为 `"C"`），同时严格保留新口径 schema 下的**五场景存档测试**（新开局、已存续玩、刷新、写入失败原子回滚、多标签页 CRDT 竞争）。
- **D08 `stageSweepState` 持久化与原子回滚合同（R3-M3）**：在 `game.stageSweepState` 记录 `{ [stageIdx]: { dayKey: "YYYY-MM-DD", usedToday: 0..3, lastSweepAt: number, totalSweeps: number } }`，由 `createFreshGame` 初始化为 `{}`、经 `normalizeLoadedGame` 严格校验并自动纳入 envelope v2 规范化载荷与 FNV-1a 校验；执行扫荡时必须在修改前保留完整状态快照，仅在单次 `saveGame()` 返回 `true` 后生效，若写入失败则原子回滚全部扣次与奖励并提示明确失败原因。

**5.4 剧情、波次和消费**

开场/战前叙事先完成或由玩家跳过，再启动敌人。使用 stageEpoch 或等效一次性标记隔离过期回调，防止跳过与正常结束都刷怪。卷 Boss 击杀事实按既有逻辑先保存，随后演出、回顾和传送入口串行；读档不得丢通关或重复发奖励。

普通战斗连点不能落在突然出现的熔炼/替换按钮上；破坏性操作明确确认并展示对象和收益。保留主动领取与选择，区分“已经获得的掉落”“待确认的奖励”“仅信息通知”。第三类没有领取行为，第一类的记录不应再凭空变成一次额外领奖。

**5.5 导航与数值合同**

导航节点保存稳定 ID、类型、卷次/地点、解锁条件、任务关系及目标入口。预览、引路与进入分开；M/T 和旧 `#nav-btn-story` 等入口保持独立与兼容路由（D03 定稿）。新增路线图无需强迫六卷与六张地图一一对应。

收益定义同时供计算与说明使用；纯常驻、条件效果、最终倍率分别展示。平衡样本记录版本、种子、游戏时间/真实时间、输入、装备和成本、模式、最终结果。自动化调用实际规则，不另造一套简化模型冒充实战。DPS/EHP 估算仅用于首轮调参，不能代替命中、控制、回复、阶段和玩家行为。

- **D05 主线动态缩放合同（R3-M2）**：新增纯函数 `computeMainlineRealmScaling(stageIdx, realmId, isBoss)`（锚定 `REALM_COMBAT_BASELINE`）：当 `delta = rankOf(realmId) - stageIdx <= 0` 时严格返回 `1.0×`；仅在**主线关卡上下文**注入 `spawnSingleEnemy()`（显式排除无尽塔、万剑冢连战、九重天阙、护宗大阵、云海空战、自定义种子工坊，严禁双倍缩放）；同步提升主线缩放时的灵石掉落（`stoneMult`，上限 `2.20×`），同时**完整保留低关修为衰减 `realmPenalty`（`spiritCh1WolfXp <= 15`）**防止低关刷修为套利。
- **D05 货币精简与统一 `S / A / B / C` 评级合同（R3-M2）**：保留灵石（`game.stones`）与 7 种核心材料（`herb/dew/core/jade/lotus/soul/dao`），彻底移除 `metaState.reincarnationPoints`（兵解改为 `metaState.bingjieCount` 折合至 `createFreshGame()` 传承灵石 `legacyStones <= 240`）与 `game.sectMerits`（护宗胜利改为 `game.sectDefenseCleared` + `game.sectDefenseBestGrade`，奖励折合为 `320 灵石 + core×2 + jade×1~2`）；`bonusStarPts` 作为二十八星宿加点系统机制保留，不视为副货币。全模式统一为 `UNIFIED_GRADES = ["C","B","A","S"]`（消除 `D/SS/SSS/S+`），主线关卡保持 `game.stageStars[idx]`（`0..3`）作为底层数据源并与统一评级建立精确双射 **`3★ ↔ S`、`2★ ↔ A`、`1★ ↔ B`、`0★/败北 ↔ C`**，确保与 D08 三星扫荡无缝一致。

**5.6 资产与发行合同**

从内联实际运行资源提取，不能用磁盘同名低透明度版本覆盖。来源、许可、原制作文件、派生文件、SHA-256 和使用位置可追溯；旧来源未知仍如实记录，不补造许可。检查逻辑以资源 key 和哈希为核心，行号可作诊断信息，但不让无关源码移动造成资源语义变更。

拆源后输出仍为 `web/public/playable-v2.html`。直接打开与静态 HTTP 均可运行，关键运行资源不依赖 CDN。相同输入能重建相同内容或清楚解释非确定元数据；构建结果与编辑源一并可回溯。系统字体约束保留，不提交字体、凭据或真实存档。

**5.7 测试接口与文档状态**

- **D06 单一调试门面合同（R3-M1 定稿生效）**：完成 `src/runtime/main.js` 15+1 模块拆分后，统一且**仅保留 `window.__CHENYUAN_DEBUG__`（`version: "d06-unified-1"`）**作为测试与评测入口（提供无副作用的统一 `getState()`、结构化分组 `rules/q6/persistence/art/telemetry` 以及原 363 个去重符号的直接内部绑定）；将全部单元测试、77 项回归、56 项 E2E 及 `eval-combat-matrix.mjs` 迁移完成后，**彻底删除 `window.__CHENYUAN_V18__` 至 `window.__CHENYUAN_V25__`** 及过渡性的 `namespaces`/`getNamespace`，并以单测静态守卫禁止回流。
- UI 测试以真实点击和按键驱动，状态注入仅用于构造必要前置；战斗数值评测可直接调用规则，但须与浏览器结果交叉验证。
- 命名约定：R3–R6 保留 H 历史含义，Q0–Q7 使用 `Q0-*` 至 `Q7-*`；Round 3 新增测试统一使用 **`R3-D06-*`**、**`R3-D05-*`**、**`R3-D08-*`** 前缀，不复用旧 ID 冒充新验收。每条结果注明 commit、环境、命令、前置、通过/失败/跳过及证据位置。

**5.8 D08 关卡扫荡与长按连续养成交互合同（R3-M3）**

1. **关卡扫荡（Stage Sweep）**：
   - **资格门槛**：纯谓词 `getStageSweepStatus(game, stageIdx, nowMs, env)` 要求 `stageIdx ∈ [0..4]`、境界已解锁、`game.stageStars[stageIdx] >= 3`（等价于 D05 `S 级 (★★★)`）、非练习模式，且满足每日次数与冷却约束。
   - **防白嫖限额与免耗寿**：每关每日上限 **`3` 次**（本地自然日 `YYYY-MM-DD` 重置），每关冷却 **`60` 秒**（支持测试注入 `nowMs`）；**严格免耗寿（消耗 `0` 月寿元，`game.elapsedMonths` 差值必须为 `0`）**。
   - **显式确认与真实掉落**：进入世界地图预览条（`#btn-map-sweep-stage`）或历练抽屉独立按钮（`[data-open-stage-sweep]`，外层卡片须重构为 `<div>` 禁止嵌套 `<button>`）必须弹出显式确认框（`MODAL_PRIORITY.stage_sweep = 40`，支持 `Esc`/取消与焦点返回），预览展示真实估算灵石、修为、必掉与池内材料、装备品阶范围及免耗寿/剩余次数/冷却说明；确认后调用真实 `CAMPAIGN_ACTS`/`ENEMIES`/`gainRealmXp`/`rollGearItem`/`acquireGearItem` 结算（含 24/24 行囊满安全入 `game.pendingRewards` 的 `gear_overflow`，不额外发放 `bonusStarPts`/`soul_unlock`/过场剧情），写入失败时原子回滚全部变更。
2. **长按连续养成（Long-Press Continuous Progression — 强化 / 炼丹）**：
   - **范围与兼容**：作用于装备淬火强化（`[data-enhance-slot]`）与稳炼成丹（`[data-quick-craft]`），完整保留 Q2 F18 的显式批量按钮（`多阶…` / `批量…`）与批量预览弹窗。
   - **触发节奏与零误双扣**：长按阈值 **`380ms`**、连续步进间隔 **`220ms`**；短按（`< 380ms`）只触发 1 次单步操作；一旦进入连续步进（`didRepeat = true`），吞掉释放时的尾随 `click` 事件确保不额外多扣 1 次。
   - **明确单次扣费提示**：按钮旁在长按前即标明单次成本（强化灵石 / 炼丹灵石与寿元月数，缺料时明示“缺料需单点确认补购，不支持长按”）；长按进行中在 `#jade-panel` 顶部显示持久化状态条 `#hold-progression-status`（`role="status"`、`aria-live="polite"`），实时反馈已执行步数、累计耗费、下一阶成本与“松手即停”。
   - **跨 DOM 重建控制器与 11 项立即停止矩阵**：由于单步强化/炼丹会调用 `renderDrawerContent()` 替换 `#panel-scroll-body` 内部 DOM，长按控制器必须在模块级维护逻辑目标 `{ kind, key }` 并在 `window`/`document` 挂载释放监听，每步重绘后重新恢复 `.is-holding` 状态与焦点；遇到以下任一条件**立即停止**：① `pointerup` ② `pointercancel` ③ 指针移出按钮区域 ④ `window.blur` / `visibilitychange(hidden)` ⑤ 键盘 `keyup`（`Space`/`Enter`）⑥ 关抽屉 / 切页签 / 弹模态 ⑦ 灵石不足 ⑧ 炼丹灵材不足（**长按绝不自动花灵石补购材料，也不中途强弹补购框**）⑨ 装备已达满级 `+10` ⑩ 炼丹下一步将触及 100% 大限保护（`previewLifespanImpact.willExhaust`）⑪ `saveGame() === false`（该步原子回滚并弹致命提示）。停止后合并输出 1 条汇总反馈提示。
   - **键鼠与平台边界**：完整支持指针按住与键盘 `Space`/`Enter` 按住（首按与 `ev.repeat` 均 `preventDefault()` 杜绝系统连发双触发），焦点不丢失；**明确不做移动端适配**，唯一验收目标维持 **1440×900 桌面 Chromium 键鼠**。

**6. Code Layout（`main @ fffcb72` 实际结构与 Round 3 演进产物）**

| 路径 | 当前状态 / 用途 | 写入约束 |
|---|---|---|
| `web/public/playable-v2.html` | 实际游戏入口与零依赖确定性离线发行单文件 | 必须由 `npm run build` 生成并通过 `npm run build:check`；同一时间仅一个实施主题写入 |
| `src/template.html`、`src/styles/main.css`、`src/markup/body.html` | 页面模板（21L）、样式表（3,961L）与主 DOM 结构（672L） | 修改后同步 `npm run build`；保持桌面 1440×900 键鼠，不引入外部 URL 或字体文件 |
| `src/assets/art-index.json`、`src/assets/runtime/*.webp` | 115 张运行 WebP 资产与索引（含 5 张受保护 VP8X RGBA 精灵） | 与 `npm run art:manifest:check` 双向核验，保留原制作素材与校验值 |
| `src/config/{combat-params,realms-items,progression-data}.mjs` | 3 个纯 ESM 配置模块（`ESM_MODULE_ORDER`） | 零 DOM/副作用，供 Node 单测与单文件构建共用 |
| `src/rules/{utils,gear-rules,campaign-q6,combat-stats,economy-rules,scoring-rules}.mjs` | 6 个纯 ESM 规则模块（R3-M3 计划新增 `src/rules/sweep-rules.mjs`） | 零 DOM/副作用，可注入随机源与时钟；D05/D08 规则优先落于此 |
| `src/state/save-rules.mjs` | 纯 ESM 存档/元存档/CRDT 规则模块（`ESM_MODULE_ORDER` 第 10 项） | 保持 envelope v2 与 FNV-1a 校验；D05 移除 `reincarnationPoints` 并引入 `bingjieCount` 与 `UNIFIED_GRADE_RANK` |
| `src/runtime/{preamble,main,debug-facade,boot}.js` | 运行时脚本（当前 `main.js` 31,454L）；**R3-M1（D06）**将 `main.js` 拆为 15 个有序 `src/runtime/<subsystem>.js` + ~25L `main.js` 主循环外壳，重写 `debug-facade.js` 为 `d06-unified-1` | 按 `RUNTIME_MODULE_ORDER` 顺序组装入单一 IIFE，保持 2 空格顶层缩进确保 `docs/art-manifest.md` 零漂移 |
| `scripts/build-playable.mjs` | 零依赖确定性单文件构建器（`npm run build` / `build:check`） | R3-M1 导出 `RUNTIME_MODULE_ORDER`；维持单 `<script>`、零外部 URL、115 WebP SHA-256 守卫 |
| `scripts/verify-playable-v2.mjs` | 77 套 1440×900 桌面 Chromium 回归测试套件（`npm run test:regression`） | R3-M1 全量迁至 `window.__CHENYUAN_DEBUG__`；R3-M2/M3 追加 `R3-D05-*`/`R3-D08-*` 并更新 `Q6-4` |
| `scripts/art-manifest.mjs`、`docs/art-manifest.md` | 美术溯源清单生成与校验（`npm run art:manifest:check`） | 脚本/清单变更同时验证，清单不手工伪改 |
| `scripts/eval-combat-matrix.mjs`、`scripts/audit-economy.mjs` | 无头真实规则 84 场景战斗矩阵与经济防套利审计 | R3-M1 迁至 `__CHENYUAN_DEBUG__`；R3-M2 适配 D05 缩放与货币口径 |
| `tests/unit/*.test.mjs` | 8 个纯 Node 单元测试文件（32 项，`npm run test:unit`） | 随 D06/D05/D08 增量补齐纯规则与构建/静态守卫单测 |
| `tests/e2e/{run.mjs,lib/*,tiers/tier1..4*.mjs}` | 56 项 Tier 1–4 桌面 Chromium E2E 套件（`npm run test:e2e`） | R3-M1 迁至 `__CHENYUAN_DEBUG__`；R3-M2/M3 同步适配与新增用例 |
| `.github/workflows/e2e.yml`、`package.json` | GitHub Actions CI 流水线与脚本入口 | CI 执行 `build:check`、`test:unit`、`vm.Script`、`art:manifest:check`、`test:regression`、`test:e2e` |
| `docs/analysis/PROJECT.md`、`docs/analysis/overview.md`、`docs/analysis/q6-decisions-and-boundary.md` | 计划、综述与 Q6 决策边界快照 | **注意**：`q6-decisions-and-boundary.md` 由 `Q6-4` 回归直接解析断言，R3-M0 保持不动，待 **R3-M3（D08）** 随 `Q6-4` 同步更新 |
| `docs/analysis/validation/q7-release/`（及后续 `r3-*/`） | 里程碑实测证据包与脱敏复现报告 | 保存结果 JSON 与摘要，不放真实玩家存档 |

原报告与 Q7 证据包作为基线证据完整保持；后续 Round 3 新增结果单独落盘并注明新提交哈希，不覆盖旧证据。

**7. Git / PR Workflow**

- 工作前核对仓库、分支、工作树和远端。当前仓库为 `GOD-OF-PPT/chenyaun-v2`，基线为干净 `main @ fffcb72`（Q0–Q7 的 PR #20–#29 已全部合入）。
- Round 3 严格采用**串行独立 `codex/` 分支与 PR** 推进：`R3-M0（codex/r3-plan-update） → R3-M1（codex/d06-modular-debug-clean） → R3-M2（codex/d05-scaling-economy-grade） → R3-M3（codex/d08-sweep-hold-qol）`。每个里程碑必须从上一个 PR 通过 CI 门禁并合入 `origin/main` 后的最新提交切出，避免单文件构建产物 `web/public/playable-v2.html` 与 `src/runtime/*` 发生合并冲突。
- **硬性隔离边界**：严禁触碰仓库既有无关草稿 **PR #18（`codex/static-security-package-20261123`）**、远端历史分支 `origin/codex/e2e-suite` 及历史文档 **`docs/v2-overhaul-notes.md`**。
- PR 描述附功能编号（`R3-F*`）、对应 `D` 决策、前后行为、真实验证命令与结果及回退方式；只报告实际执行结果。
- 保留已发布 Git 历史，严禁 `force-push`；严禁提交 `.agents/`、`node_modules/`、玩家存档、凭据或字体文件；所有子代理统一使用 `Workspace: inherit`。

**8. Verification Standard（里程碑与发布门禁）**

当前已验证基线（`main @ fffcb72`，PR #20–#29 全部合入）：**自动化 165/165 PASS**（32 项纯 Node 单测 + 77 项 1440×900 桌面 Chromium 回归 + 56 项 Tier 1–4 E2E），叠加 `npm run build:check` PASS、`npm run art:manifest:check` PASS、`eval-combat-matrix.mjs` 84/84 PASS、`audit-economy.mjs` PASS、直接 `file://` 启动与帧时间基线 PASS，全程 0 运行时错误（完整证据见 [validation/q7-release/SUMMARY.md](validation/q7-release/SUMMARY.md)）。**F29 真人观察式试玩仍如实标记 `NOT_RUN`（0 / 5~8）**。

**历史测试债对照（Q0–Q7 已全部闭环，持续作为回归守卫）**

| 债项 | 处理方法 | 完成标准 |
|---|---|---|
| H M3：M1-2/M1-3 瞬杀及 Boss 门控 | 失败流程测试使用 uncapped 或连续有效命中；另设单击上限独立验证，补 Boss 前置 | 不删除 45% 规则保护；失败与进阶路径均实测（Q0 已闭环） |
| H M4：远征时钟、沙盒确认、练习与永久成长 | 分离洞府/战斗/旧档解锁；真实确认进入沙盒；补 R4 覆盖 | 不以直改状态绕过正式隔离与主动消费（Q0/Q3 已闭环） |
| H M5：开场、步骤 ID、卷终回顾 | 帮助函数显式结束开场；保留专门逐句/跳过测试；更新步骤和确认路径 | 不全局跳过所有剧情而漏测新流程（Q0/Q1 已闭环） |
| H M6：分境门槛、三清、寿元、宠物 | 按实际境界验证允许和拒绝两侧；补 R6 边界与五存档场景 | 金丹不得用元婴能力通过耗蓝断言（Q0/Q6 已闭环） |
| B R2-2/R2-6 等未知失败 | 恢复最小复现，区分真实焦点缺陷、旧前置、环境问题 | 每项给出根因、修复及复测，不统称旧测试（Q0 已闭环） |
| E2E 缺失与 CI 跳过 | 检查历史 WIP，补入口及覆盖映射，发布流程不得静默跳过 | Tier 1–4 共 56 项实测并接入 `.github/workflows/e2e.yml`（Q0/Q7 已闭环） |

Tier 1–4 定义已落地于 `tests/e2e/tiers/`：Tier 1（31 项，启动、基础输入与单系统功能）、Tier 2（12 项，主线/边界/存档与写失败保护）、Tier 3（10 项，组合交互、冲突、沙盒与键鼠可访问性）、Tier 4（3 项，多模式与跨卷集成旅程）。最终对抗覆盖重复操作、损坏输入、过期回调和模式切换等边界。

**核心验收场景（V01–V13 为 Q0–Q7 基线，V14–V16 为 Round 3 新增门禁）**

| 用例 | 操作与预期 | 主要功能 |
|---|---|---|
| V01 | 新开局分别用鼠标、Space、Enter 结束/跳过对白；不补鼠标点击即可在战场合法交互；主动 Tab 到 HUD 后 Enter 仍激活 HUD | F05 |
| V02 | 背包24/24、活敌场景连续获得3件；不自动弹选择；窗口允许后逐项处置，取消/重开不重领 | F07–F10 |
| V03 | 在排队、active、确认后写失败三个位置刷新/重试；权益及材料账一致；多标签冲突不双领 | F07/F09 |
| V04 | 金灵被击杀但仍有敌人；魂印 Boss 死后仍有小怪；渡劫后尚有敌人；分别验证延期与持久化 | F08/F10 |
| V05 | 最后一敌死亡但残留弹幕/伤害区，及连战、空战、护山结束；不会危险中自动打开，也不会结算后永久不放行 | F08/F12 |
| V06 | 抽屉→详情→冲突/败北替换→关闭；逐层释放暂停和焦点，过期回调无效 | F09 |
| V07 | 高频普攻、拾取、资源不足；完整/精简/极简均保留危招和持久化警告；战报合并不改变实际奖励 | F11/F13 |
| V08 | 剧情正常结束、跳过、重复调用、切关后旧回调；只启动一次敌群，卷终落盘和回顾顺序正确 | F12 |
| V09 | 当前主线、故人、试炼从旧/新入口访问；导航预览不推进；材料获取返回原升级项，焦点正确 | F15–F18 |
| V10 | 常驻/条件收益在不同装备和上限下对照说明；两流派用自然配置挑战；随机极端样本可重放 | F06/F19–F23 |
| V11 | 首卷完整流程、暗/亮场景、多特效、减少动态效果及声音层次；关键危险和操作反馈可辨 | F24–F29 |
| V12 | 相同编辑源构建并核验资源，直接文件与 HTTP 运行；单测、旧档、云码及沙盒路径不回退（D06 落地后调试门面改由 V14 接管） | F30–F33 |
| V13 | 全六卷主线与选定侧边模式走通；第五卷/终局门槛按已选方案验证，旧进度不倒退 | F34–F36/F38 |
| **V14（D06）** | 15+1 个 `src/runtime/*.js` 模块经 `build-playable.mjs` 确定性打包成单 `<script>` 离线 `playable-v2.html`，`build:check` 逐字节一致、`art:manifest:check` 零漂移；`window.__CHENYUAN_V18__`–`__V25__` 全为 `undefined` 且仓库源码/测试零残留；统一 `window.__CHENYUAN_DEBUG__`（`d06-unified-1`）承载全部 364 键且 `getState()` 无副作用；原交错 `input`/`toggle`/`change` 监听完好；静态 HTTP 与 `file://` 双入口及 `eval-combat-matrix` 全绿 | R3-F02 / R3-F03 |
| **V15（D05）** | 主线 5 关 × 境界动态缩放验证（同境 `1.0×`；第 5 关化神 `1.407×` HP / `1.414×` ATK；高境回访低关按阻尼系数缩放且灵石随 `stoneMult` 提升；非主线模式不双倍缩放；低关修为衰减 `spiritCh1WolfXp <= 15` 保持）；`reincarnationPoints` 与 `sectMerits` 在 `src/` 零残留，兵解折合 `bingjieCount → legacyStones`（上限 240），护宗折合灵石 + 核心材料与 `sectDefenseCleared`/`sectDefenseBestGrade`；全模式统一 `S/A/B/C`（`3★ ↔ S`，零 `SS`/`SSS`/`S+`/`D`）；84/84 战斗矩阵与 `audit-economy` 全通过；新口径存档五场景（开局、续玩、刷新、写失败、多标签竞争）全通过 | R3-F04 / R3-F05 / R3-F06 |
| **V16（D08）** | **关卡扫荡**：0/1/2★ 不可扫荡，3★/S 级经显式确认弹窗后执行、取消/Esc 零扣次零发奖、免耗寿（`elapsedMonths` 差值严格为 0）、真实掉落含 24/24 溢出入 `pendingRewards`、每关每日 3 次上限 + 60 秒冷却持久化与跨日重置、写失败原子回滚、返焦准确；**长按连续养成**：强化/炼丹短按（`<380ms`）只执行 1 次无双扣、长按（`≥380ms` 起 220ms 步进）在 `renderDrawerContent()` 替换 DOM 后不中断且保持焦点、扣费提示清晰、全部 11 项停止条件（松手/移出/失焦/切页/关抽屉/灵石不足/缺料不自动补购/满级 `+10`/大限保护/写失败回滚）生效且保留 Q2 显式批量弹窗；桌面 1440×900 键鼠无移动端重写 | R3-F07 / R3-F08 |

涉及持久化的功能均覆盖：新开局、同口径已存续玩（注：D05 定稿明确不背旧副货币/旧超 S 评级的旧档迁移包袱，D05 及之后围绕新口径 schema 完整执行五场景）、刷新、写入失败/只读、多标签竞争。用例各自使用独立 1440×900 Chromium 上下文；多标签竞争在一个独立测试上下文内建立同源多页。状态注入和自然游玩结果分别记录。

当前仓库实测可运行验证命令（见 `package.json` 与 `.github/workflows/e2e.yml`；CI 使用流水线安装的 Chromium，不得硬编码本机绝对路径）：

```sh
npm ci
npm run build
npm run build:check
npm run art:manifest:check
npm run test:unit
node scripts/eval-combat-matrix.mjs --seed 20261124
node scripts/audit-economy.mjs --seed 20261124
npm run test:regression -- --report test-results/regression.json
npm run test:e2e -- --report test-results/e2e.json
python3 -m http.server 5174 --bind 127.0.0.1 --directory web/public
```

每个里程碑的证据应包括：功能/用例映射、版本与环境、运行命令、结果 JSON、失败说明、代表截图、存档/回退记录。帧时间和首次可操作时间先采基线再设预算；图片文件大小、模拟吞吐和 CSS 数量不是单独的品质门槛。

真人试玩（F29）建议 5～8 名新玩家、每人约 30 分钟，观察首攻、整备返回、升级理解和死亡归因。80% 无讲解完成等仅为试验门槛；记录实际人数和分母，当前尚未完成招募，仍如实标记 **`NOT_RUN`（0 / 5~8）**，不替用户虚构满意度。需要真实用户参与的验收完成前，功能可记自动化验证通过，版本主观体验验收不能记全部通过。

**9. 风险、回退与范围控制**

| 风险 | 处理方式 | 回退要求 |
|---|---|---|
| 延期奖励扩大丢失窗口 | F07 先于通知 UI，覆盖 active/queued/confirmed | 回退版本理解新权益字段，不直接删字段 |
| 静默调度死锁或提前恢复 | 多模式生命周期测试，实例化暂停所有权 | 保留兼容路径，但不能退回已知丢奖励行为 |
| 导航整理变成功能删除 | 稳定 ID、旧入口路由、必做/可选明确 | 可恢复旧布局，保留新进度与数据 |
| 强度调整损害旧玩家 | 决策记录、迁移预览、相同投入对比 | 保存原始配置/字段，不能强制清档回滚 |
| 分层素材遮挡或掉帧 | 首卷样板、遮挡避让和目标设备基准 | 可关闭新增视觉层，核心提示和碰撞不受影响 |
| 拆分产生不可离线运行版本 | 产物与源码双向核验，两个入口实测 | 保存上一兼容发行包及构建输入 |
| 测试转绿依靠删断言 | 用例映射与真实行为审查 | 还原被弱化的规则保护，保留失败证据 |
| **D06**：深拆 `main.js` 引发 TDZ、错漏交错事件监听（`L30896–30993`）或遗漏 `V18–V25` 测试调用方 | 严格按连续拓扑顺序切分 15+1 模块、先迁移 3 处交错 DOM 监听至 `input-handlers.js`、统一非变更 `getState()`、增加静态零残留守卫并核验 `docs/art-manifest.md` 零漂移 | 独立 `codex/d06-modular-debug-clean` PR 合并提交可整笔 `git revert` 回到 R3-M0 基线，不影响存档格式 |
| **D05**：主线境界动态缩放导致第 5 关化神偏难、非主线模式双倍缩放或经济套利 | 锚定 `REALM_COMBAT_BASELINE` 且加主线上下文守卫；保留 `realmPenalty` 低关修为衰减与 `legacyStones <= 240` 上限；强制重跑 84/84 战斗矩阵与 `audit-economy` | 独立 `codex/d05-scaling-economy-grade` PR；因 D05 明确不背旧档迁移包袱，回退时同步还原规则与测试基线至 D06 合并提交 |
| **D08**：免耗寿扫荡被无限白嫖、或长按养成因 `renderDrawerContent()` 替换 DOM 导致失控连扣/缺料误购 | 扫荡强制 3★/S 资格 + 显式确认 + 3 次/日上限 + 60 秒冷却 + 真实掉落 + 写失败原子回滚；长按状态独立于 DOM、380ms/220ms 节流、吞掉尾随 `click`、11 项立即停止矩阵（含缺料停机、大限保护、写失败回滚） | 独立 `codex/d08-sweep-hold-qol` PR；回退仅关闭扫荡/长按入口，`stageSweepState` 为可选字段不破坏其余存档 |

**10. Status Log 与更新方式**

- 2026-11-23：完成三份报告与根历史计划的阅读、交叉分析及定向源码核对；生成 overview.md 与本规划稿。游戏代码、历史报告、根 PROJECT.md 未修改；未新增游戏动态验证，未创建实施分支或发布 PR。
- 2026-11-23 / Q0-A（F01–F04）/ 稳定美术清单与 CI、隔离 continue-on-failure 回归 runner、11 项历史漂移修复、补齐 R3–R6 与 56 项 Tier 1–4 E2E / PR #20（`28d02e2`）/ GitHub Actions CI `45222529884` 100/100 PASS（44 回归 + 56 E2E）/ 无 / 可按合并提交回退 / `VERIFIED`
- 2026-11-23 / Q0-B（F05–F06）/ 战场焦点/Enter 恢复、`modalOpen` 压制过场优先级、`#hud-hp-txt` 同步与 `COMBAT_RULE_PARAMS` 文案对齐 / PR #21（`292b7b1`）/ GitHub Actions CI `45232356299` 102/102 PASS（46 回归 + 56 E2E）/ 无 / 可按合并提交回退 / `VERIFIED`
- 2026-11-23 / Q1（F07–F13）/ 持久化 `game.pendingRewards`、实例化 `pauseTokens` 与弹窗优先级、战斗静默调度、战前过场顺序、防误触与通知总线 / PR #22（`dfbbd38`）/ GitHub Actions CI `45263926151` 108/108 PASS（52 回归 + 56 E2E）/ 2 处低优先级存档提示微调结转 Q7 / 保留新权益字段兼容 / `VERIFIED`
- 2026-11-24 / Q2（F14–F18）/ UI 语义双编码规范、统一导航层级、抽屉收束、分级提醒/升级预览与显式数量批量 QoL / PR #23（`6946074`）/ GitHub Actions CI `45289881132` 113/113 PASS（57 回归 + 56 E2E）/ 2 处低优先级焦点微调结转 Q7 / 保留旧入口路由兼容 / `VERIFIED`
- 2026-11-24 / Q3（F19–F23）/ 收益账本与配置说明、双流派与演武练习、真实规则战斗矩阵与经济寿元闭环（融合外部 PR #25）/ PR #24（`fc9004f`）/ GitHub Actions CI `45331690603` 121/121 PASS（65 回归 + 56 E2E）+ `eval-combat-matrix` 84/84 + `audit-economy` PASS / 少许文案/清理微调结转 Q7 / D05 旧装备无损兼容 / `VERIFIED`
- 2026-11-24 / Q4（F24–F29）/ 首卷动作与景深精修、115 张 WebP 与 5 张 RGBA 二进制质检、音效/转场反馈、首卷闭环与 `playtest-protocol-v1.md` / PR #26（`4b86533`）/ GitHub Actions CI `45348220517` 126/126 PASS（70 回归 + 56 E2E）/ **F29 真人观察式试玩尚未招募（0 / 5~8，标记 `NOT_RUN`）** / 保留原图与视觉层降级开关 / `F24–F28 VERIFIED`；`F29 NOT_RUN`
- 2026-11-24 / Q5（F30–F33 · D06 保守基线）/ 提取 115 张运行 WebP、零依赖确定性构建 `scripts/build-playable.mjs`、拆分 9 个 ESM 模块、27 项纯 Node 单测与 `__CHENYUAN_DEBUG__` 兼容门面 / PR #27（`df5efda`）/ GitHub Actions CI `45363598891` 156/156 PASS（27 单元 + 73 回归 + 56 E2E + `build:check` + `art:manifest:check`）/ 无 / 产物与编辑源双向哈希核验 / `VERIFIED`
- 2026-11-24 / Q6（F34–F37 · D01/D04/D05/D07/D08 保守基线）/ 2–6 卷覆盖、第五卷法则共鸣桥接与 5 项终局修复、高阶模式三分组与 D07 解锁一致、`q6-decisions-and-boundary.md` / PR #28（`5115b8e`）/ GitHub Actions CI `45388426786` 165/165 PASS（32 单元 + 77 回归 + 56 E2E + `build:check` + `art:manifest:check`）/ **F37 按 D08 登记 `DEFERRED`** / 保守基线不回退旧进度 / `F34–F36 VERIFIED`；`F37 DEFERRED`
- 2026-11-24 / Q7（F38）/ 收口 7 项 Q1–Q5 遗留边界打磨，完成 1440×900 桌面 Chromium 阶段二全量测试环境验证（静态 HTTP 77/77 回归 + 56/56 E2E + 32/32 单测 + 直接 `file://` 启动与帧时间基线 + 84/84 战斗矩阵 + 经济审计，0 运行时错误）并沉淀 `docs/analysis/validation/q7-release/` 证据包 / PR #29（`fffcb72`）/ 见 [validation/q7-release/SUMMARY.md](validation/q7-release/SUMMARY.md) / **F29 真人试玩 `NOT_RUN`（0/5~8）；F37 当时按保守基线 `DEFERRED`（现由 Round 3 D08 决策接管）** / 可按合并提交回退至 `main @ 5115b8e` 且保持存档字段兼容 / `自动化 VERIFIED / 真人试玩 NOT_RUN`
- 2026-11-24 / R3-M0（R3-F01 · D01–D08 全部定稿与 Round 3 执行计划）/ 将用户拍板的 D01–D08 定稿（5 项 `LOCKED_BASELINE` + 3 项 `APPROVED_ROUND3`：D06/D05/D08）及 `R3-M0 → R3-M1 (D06) → R3-M2 (D05) → R3-M3 (D08)` 详细分步计划、接口合同（含 §5.8）与验收场景 `V14–V16` 写回 `docs/analysis/PROJECT.md`；不修改 `q6-decisions-and-boundary.md` 以保护 `Q6-4` CI 门禁 / `codex/r3-plan-update`（待 PR 与 CI 合并）/ 本地已跑 `build:check`、`test:unit`、`art:manifest:check`（纯文档变更，无代码改动）/ **F29 真人试玩仍 `NOT_RUN`（0/5~8）；R3-M1/M2/M3 待依序实施** / 可按 PR 合并提交整笔回退 / `IMPLEMENTED`（待 CI 验证与合入 `main`）

后续每项记录采用：`日期 / F或D编号 / 变更与选择 / commit或PR / 已执行验证及证据 / 未决问题 / 回退方式 / 状态`。允许状态为 PLANNED、IN_PROGRESS、IMPLEMENTED、VERIFIED、NEEDS_DECISION、DEFERRED；只有实际达到对应出口且证据齐全才使用 VERIFIED。DEFERRED 必须说明范围及责任，不能等同完成。
