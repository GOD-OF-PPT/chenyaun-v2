# Project: 《尘缘问道 · 剑阵万象》全方位完善（主线清晰度 + 玩法完整性）

> 用户诉求（`.agents/teamwork/ORIGINAL_REQUEST.md`）：检查游戏主线是否明确、玩法是否完整，并规划、分析、全方位完善游戏。
> 基线：`main` @ `eb0ea67`。实际入口：`web/public/playable-v2.html`（单文件约 8 MB，27,320 行；CSS L8–~3800，标记 L3176–3809，IIFE 脚本 L3810–27318，内联 base64 美术 `const ART` 在 L3811–3927）。
> 本文是改进计划的唯一事实来源，状态随里程碑闸门更新。

## 0. 审计结论（摘要）

| 维度 | 结论 | 证据来源 |
|---|---|---|
| 主线是否明确 | **操作层面明确，叙事层面薄弱，结构上可被跳过。** 任务追踪器 + 6 章 18 步一直告诉玩家"下一步做什么"。但游戏没有开场前提，没有反派，Boss 被击败后也没有任何剧情节点。多数主线步骤靠境界达标就算完成，Boss 不是必须击败的。实测一个 **0 关通关** 的角色也能渡劫飞升，拿到 SS 评级（3904 分），结局文本还写着"走过五境星图"。术语也不统一：幕、章、卷混用；"七卷"实际只有 6 章；右侧栏写着"主线"的按钮打开的其实是故人抽屉。 | survey_1 |
| 玩法是否完整 | **系统很多，都能跑起来，但经济和难度曲线没有收尾。** 15 个侧边模式全部可以打开和开局，0 报错。存在两条无限刷钱漏洞（远征领取会重新灌满、灵玉赌注在法则集齐后稳赚），挂机收益没有上限，永久属性可以无限叠加。Boss 血量涨 41 倍，而玩家攻击只涨约 4.7 倍，最终 Boss 的重击能一击秒杀。跳关按钮照样发全额奖励，"全神通演武"一键解锁正式存档里的所有内容。寿元、`RECIPES.months`、`RELICS.inputs` 都是死数据。 | survey_2_gen2 |
| 工程 / 规约合规 | 主存档的读取、写入、冲突处理都比较完善。**元存档损坏后会被静默覆盖**，违反 AGENTS.md 硬性规则。云码输入框里输入 "p" 会进入拍照模式。弹窗没有焦点陷阱。云码导入没有确认步骤，也不做规范化。美术素材没有来源、许可和校验值记录。测试需要手动安装 playwright：仓库没有 package.json，`.gitignore` 也没有忽略 node_modules 和 .agents。24 个回归套件全部通过。 | survey_3 |

详细审计报告（证据和行号均基于 eb0ea67）：
- 主线：`.agents/teamwork/teamwork_preview_explorer_survey_1/handoff.md`
- 玩法：`.agents/teamwork/teamwork_preview_explorer_survey_2_gen2/handoff.md`
- 技术、存档、测试、美术：`.agents/teamwork/teamwork_preview_explorer_survey_3/handoff.md`

## Architecture
- **单文件游戏**：所有玩法都是 `web/public/playable-v2.html` 中的内联 `<script>` 和 `<style>`。不引入外部 JS 或 CSS，双击打开和静态 HTTP 服务两种方式都必须能运行。
- **关键数据表**（行号以 eb0ea67 为准）：
  - `REALMS` 4439
  - `CAMPAIGN_ACTS`/`STAGES` 4567
  - `CHAPTERS` 4630
  - `NPC_META` 4706
  - `STORIES` 4713
  - `CHAPTER_CUTSCENES` 5883
  - `KARMA_DILEMMAS` 6554
  - `ASCENSION_ENDINGS` 6125
  - `KARMA_ENDING_EPILOGUES` 5332
  - `STAGE_SCALING` 4949
  - `RECIPES` 4469
  - `DAO_LAWS` 4510
  - `SPIRE_CURIOS` 8884
  - `BOSS_RUSH_ROSTER` 6327
  - `ACTION_REALM_REQ` 12544
  - `ONBOARDING_STEPS` 15600
- **进阶流程**：
  - 渡劫：`openTribulationPrepModal` 17916 → `startLiveTribulation` 18009 → `completeLiveTribulation` 18076。
  - 关卡：通关处理在 16411–16452，传送门受境界门控（16428）。
- **存档**：
  - 主存档 `chenyuan_wendao_v11_save` 使用外层结构（envelope v2，含 saveRev、tabId、FNV-1a 校验）。
  - 元存档 `chenyuan_wendao_v11_meta`。
  - 读取：`parseAndValidateSaveRaw` 13661，`inspectSavedBundle` 13695，`normalizeLoadedGame` ~13556。
  - 写入：`saveGame` 13914；多标签页冲突靠 `storage` 事件处理（13999）。
- **测试**：
  - `scripts/verify-playable-v2.mjs` 是回归套件（`eb0ea67` 基线 24 项，现已扩展至 79 项：M1–M4 + P1–P5 + R2–R7 + Q0–Q4 + T5），基于 Playwright。它自带静态服务器，视口 1440×900，每个套件使用独立的浏览器上下文，并要求 0 个 console 或页面错误。
  - `tests/e2e/` 是需求驱动的 E2E 验收与对抗加固套件（Tier 1–5 共 68 项：Tier 1–4 共 56 项黑盒验收 + Tier 5 共 12 项白盒对抗加固），由 `tests/e2e/run.mjs` 驱动，详细索引与实测记录见 `TEST_INFRA.md` 与 `TEST_READY.md`。
  - 调试钩子挂在 `window.__CHENYUAN_V18__…__V25__` 上。
- **数据流**：玩家输入 → `game` 状态 → `saveGame()`（事件触发）→ localStorage；`metaState` 由 `saveMeta()` 写入。

## Feature Inventory
所有调研发现都已分配到具体里程碑（没有遗漏）。来源：s1 = survey_1（主线），s2 = survey_2_gen2（玩法），s3 = survey_3（技术）。

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| T1 | 元存档损坏保护 | 读取 `*_meta` 失败时保留原文，在提示条中显示"元存档损坏"，并提供"复制原文"和"确认重置"两个操作。玩家确认之前，`saveMeta` 不得覆盖原数据 | M2 | s3 P0-1 |
| T2 | 输入框内屏蔽全局快捷键 | 焦点在 INPUT、TEXTAREA 或 contenteditable 中时，P、F3、`[`、`]`、`` ` `` 等快捷键不生效（Escape 除外）；弹窗打开时只放行 Escape 和弹窗内部的按键 | M2 | s3 P1-1 |
| T3 | 弹窗和抽屉的焦点陷阱 | `aria-modal` 弹窗及抽屉内 Tab/Shift+Tab 循环；关闭后焦点回到原触发元素 | M2 | s3 P1-2 |
| T4 | 云码导入确认流程 | 流程为：解析 → 预览（道号、境界、灵石，并与当前进度对比）→ 玩家确认 → `normalizeLoadedGame` → 检查 `saveGame()` 的返回值，失败时如实报错；只读或冲突状态下不得提示"成功" | M2 | s3 P1-3 |
| T5 | 元存档多标签页保护 | 元存档加 rev，写入前先读取并合并（数值取最大值，集合取并集），避免多个标签页之间互相回退 | M2 | s3 P1-4 |
| T6 | 危险写操作守卫 | `execute-reset-save` 和 `reincarnate-now` 在只读或冲突状态下必须拒绝执行并给出提示；在 `pagehide`/`visibilitychange` 时落盘（遵守只读和冲突规则）；收到其他标签页写入的无效值时显示提示 | M2 | s3 P2 |
| T7 | 无障碍和键位 | 支持 `prefers-reduced-motion`；默认的 Tab→posture 绑定不能抢占浏览器原生焦点导航（改用其他键，或只在战斗画布获得焦点时生效）；消除手柄按键的重复绑定 | M2 | s3 P2 |
| T8 | 美术溯源清单 | 新增 `docs/art-manifest.md` 和 `scripts/art-manifest.mjs`。脚本从 HTML 中解码 base64，计算 sha256，并记录 key、来源、许可、源文件、使用位置；同时记录 art/v4 中 5 个与内联版本不一致的文件 | M1 | s3 P1-5 |
| T9 | 工具链 | 新增 `package.json`（devDependencies 包含 playwright-core@1.65.1，scripts 包含 `test:regression`、`test:e2e`、`art:manifest`）；`.gitignore` 加入 `node_modules/` 和 `.agents/`；README 中的测试数量和运行方式改为实际情况；可选新增 `.github/workflows/e2e.yml` | M1 | s3 P1-6 |
| S1 | Boss 门控进阶 | 突破到下一境界前，必须先击败本境对应章节的 Boss（mortal→qi 对应 stage0 … spirit→ascended 对应 stage4/天门道影）；去掉步骤 check 中的 `rankOf` 替代条件；飞升不再自动设置 `trialCompleted=true`；被锁定时显示"需先击败【X】方可引动天劫"并提供引路按钮；旧存档迁移时不能让玩家进度倒退（已有境界视为已经击败过前面的 Boss） | M3 | s1 P0-1/2, F1 |
| S2 | 真实结局与评分 | 尾声文本按实际事实生成，包括已通关的关卡、已结缘（bond tier ≥1）的故人名字、因果倾向和结局选择；评分与实际表现挂钩，0 星不能得到 SS | M3 | s1 P0-3, F4 |
| S5 | 圆满后的目标 | 全部主线完成后，追踪器显示"仙途圆满 → 劫火周目 / 锁妖塔纪录"，不再停留在过时的 s7_trial | M3 | s1 P2-1, F9 |
| S6 | 因果花括号 bug | 修复 `resolveKarmaDilemmaChoice` 6918 处缺少花括号的问题（目前每次选择都会把 bond 和 astral 槽填满） | M3 | s1 P2-3, F10 |
| G3 | Boss 和伤害曲线重调 | 战役 Boss 血量以"在预期 DPS 下约 45–90 秒击杀"为目标（stage4 约 40–50k）；单次受击上限约为本阶段预期最大 HP 的 45%；Boss Rush 巨神、Spire 第九重和锁妖塔改为随境界缩放，使各模式量级一致；加入每关击杀所需攻击次数区间的回归测试 | M3 | s2 P1-1/2, G3 |
| G1 | 远征经济修复 | 去掉空仓自动灌满的逻辑（12231–12234）；`bankedStones` 设上限；只在非洞府的战斗中累积，或按真实时间累积且有上限；只有已结缘的故人才能派遣，且每位故人只能占一个节点 | M4 | s2 P0-1/3, G1 |
| G2 | 灵玉赌注漏洞 | 法则集齐后，赌注按钮禁用，或回报低于成本 | M4 | s2 P0-2, G2 |
| G4 | 跳关不发奖励 | Boss Rush 从第 6/7 轮起、Spire 从第九重起都视为练习模式：不发奖励，也不记录评级、称号、perk 和最佳纪录；只有完整挑战一轮才有奖励 | M4 | s2 P1-3, G4 |
| G5 | 永久成长上限 | 炼丹属性加成按配方和境界设上限（或设总上限）；血怒丹每个境界限购；Spire 奇物限制叠层，`curio_stone_alchemy` 的收益也设上限；旧存档读取时在 `normalizeLoadedGame` 中把数值钳制到上限，不删除数据 | M4 | s2 P1-4, G5 |
| G6 | 全神通演武沙盒化 | 改为沙盒或演示模式：使用独立存档 key（或禁止存档和奖励），开启前有确认弹窗，开启后 HUD 上有明显标识；不再污染正式存档 | M4 | s2 P1-5, G6 |
| G9 | 显式消费 | 行囊满时弹出选择（熔炼 / 放弃新物品），不再自动熔炼；炼丹时分项列出"购入缺料 X 石"；淬炼时提供"使用妖核抵扣"开关；解锁新魂印时先询问是否装备 | M4 | s2 P2-3, G9 |
| G11a | Boss Rush 评级重定基准 | 基础分对应 A 而不是 SS，评级要能反映技术水平 | M4 | s2 P2-5, G11 |
| S3 | 术语统一和导航改名 | 统一使用"卷"作为章节单位（不再用"幕"）；"七卷"改为与实际章数一致；右侧栏的"主线"按钮改名为"故人"；只有追踪器和 T 键是主线入口；同步更新 docs | M5 | s1 P1-3, F5 |
| S4 | 设定一致性 | 每个敌人和 NPC 的名称、头衔只保留一个规范写法（shadow、砚尘所在地、裴照的头衔）；步骤 id 与内容对应 | M5 | s1 P1-6/P2-2, F7 |
| S7 | 卷终演出和卷终卡 | 每个关卡 Boss 被击败后播放 `clear_stage0..4` 演出（2–4 行，故人作出反应，并引出下一卷），然后弹出"第N卷·终"回顾卡（纪事、星级、下一步目标），之后才出现传送门 | M5 | s1 P1-2, F2 |
| S8 | 开场前提和贯穿主线 | 选择"开启新卷"后播放 4–6 行开场卷轴（顾长青是谁、天门为什么重要）；用一条线索串起 5 个 Boss（例如天门道影的残片侵染了各地守关者，砚尘的石碑记录了这些事）；每个 Boss 有战前和战后台词；更新 `CHAPTERS[].desc` | M5 | s1 P1-1, F3 |
| S9 | 故人线挂钩章节 | 给 STORIES 加 `chapter` 字段，并在当前章节的追踪器里显示为可选的"故人线"；`enter_*` 演出根据 `game.choices` 决定是否播放初见台词（例如 pei_meet）；`enter_terrace` 不再和 yan_gate 重复；`location` 字段要么用起来，要么删除 | M5 | s1 P1-4, F6 |
| S10 | 因果事件不重复 | 新增 3–6 个困境事件并挂钩章节；按 id 记录已完成事件，不再按取模循环，因果值不能被刷 | M5 | s1 P1-5, F8 |
| S11+G7 | 分批解锁和系统教程 | 系统按卷或章的顺序分批解锁，不再在金丹期一次性解锁 7 个按键加 4 个模式；每次解锁时显示一次 2 行的"新神通"卡片并提示试用；补全 `REALM_UNLOCK_NOTICES` | M6 | s1 P2-5/F11, s2 P1-6/G7 |
| G8 | 让寿元有意义 | 采用温和后果：炼丹时长、渡劫和闭关都会让角色变老；寿元达到 75% 时警告，90% 后修炼效率逐级下降；寿尽时给出可选的"兵解转世"（需确认），不强制删除进度；延寿丹因此有实际用途。`RECIPES.months` 要真正读取，不再是死数据 | M6 | s2 P2-1, G8 |
| G10 | 灵宠成长 | 喂养成本分级（herb → core → jade）；Lv.3 和 Lv.5 时可选择技能 | M6 | s2 P2-2, G10 |
| G11b | 数据清理 | `RELICS.inputs` 要么用起来要么删除；修正生态阶梯中的灵宠名称（4825）；删除其他死字段 | M6 | s2 P2-4, G11 |
| G12 | 闭关吸附掉落 | 闭关时 1800 px 范围的掉落吸附只在安全区生效，或缩小范围 | M6 | s2 P2-6 |
| E1 | E2E 验收套件 | `tests/e2e/`：不看实现、以需求为准的 Tier 1–4 测试，覆盖本表所有可观测的特性 | E2E Track | pattern |
| E2 | 通过全部 E2E + 对抗加固 | 通过 100% 的 Tier 1–4，并完成 Tier 5 对抗加固 | M7 | pattern |

不改动的项目（有意保留）：
- `window.__CHENYUAN_V18..V25__` 调试全局对象：回归测试依赖它们。只允许扩展 V25，不新增 V26。
- 单文件结构：不拆分，因为 AGENTS.md 规定了实际入口。

## Milestones
| # | Name | Scope (features) | Branch | Dependencies | Status |
|---|------|------------------|--------|-------------|--------|
| M0 | 规划 PR | 提交 PROJECT.md | `codex/project-plan` | none | DONE (PR #11, `fd011c6`) |
| M1 | 工具链与美术溯源 | T8, T9 | `codex/tooling-art-provenance` | none（不改 playable-v2.html，可与 M2 并行） | DONE (PR #12, `29daf69`) |
| M2 | 存档与输入安全 | T1–T7 | `codex/save-input-safety` | none | DONE (PR #13, `4b1fc00`) |
| M3 | 主线进阶完整性与难度曲线 | S1, S2, S5, S6, G3 | `codex/mainline-progression` | M2 已合并 | DONE (PR #14, `eb112bd`) |
| M4 | 经济完整性与显式消费 | G1, G2, G4, G5, G6, G9, G11a | `codex/economy-integrity` | M3 已合并 | DONE (PR #15, `426c03a`) |
| M5 | 叙事内容：前提、卷终、故人线 | S3, S4, S7, S8, S9, S10 | `codex/narrative-content` | M4 已合并 | DONE (PR #16, `8d86761`) |
| M6 | 系统节奏与深度 | S11+G7, G8, G10, G11b, G12 | `codex/systems-pacing` | M5 已合并 | DONE (PR #17, `b399c67`) |
| E2E | E2E 测试轨道 | E1 → 发布 `TEST_READY.md` | `codex/q0-infra-and-tests` | M1（package.json），否则自带运行器 | DONE (PR #20, `28d02e2` — 恢复 56 项 Tier 1–4 E2E 与 `TEST_INFRA.md`/`TEST_READY.md`，并于 M7a 全量实测 56/56 PASS) |
| M7 | 最终里程碑：通过 E2E 并对抗加固 | E2：Tier 1→2→3→4 按顺序闸门，然后 Tier 5 | `codex/e2e-pass`、`codex/adversarial-hardening` | M1–M6 + TEST_READY.md | DONE (M7a PR #25, `2b1ca3a` — 60/60 回归 & Tier 1–4 E2E 56/56 PASS；M7b `codex/adversarial-hardening` 同步合入 PR #24 @ `fc9004fa` 与 PR #26 @ `4b86533c`，闭环第 1 轮 19 项 + 第 2 轮 13 项 + 第 3 轮 12 项对抗缺陷与 PR #26 沙盒退出守卫/`DOC-1`，永久编码 T5-1..T5-9 与 E2E-T5-01..12，全量 79/79 回归 & Tier 1–5 E2E 68/68 PASS) |

**顺序说明**：M2–M7 都要修改同一个文件 `web/public/playable-v2.html` 和 `scripts/verify-playable-v2.mjs`，按写入独占规则只能**串行**进行（每个 PR 合并后，下一个里程碑再从新的 `main` 开分支）。M1（不碰游戏文件）和 E2E 轨道（只写 `tests/e2e/**`）可以和 M2 并行。M3 把 Boss 门控和难度曲线放在同一个里程碑，因为强制击败 Boss 之后，原来 136k 血量、一击秒杀的最终 Boss 必须同时调低，否则主线会卡关。

## Interface Contracts

### 游戏文件 ↔ 测试（所有里程碑）
- 新增测试钩子只挂到 `window.__CHENYUAN_V25__` 上（追加函数或常量），不得删除或重命名已有钩子。
- 各里程碑的回归套件追加到 `scripts/verify-playable-v2.mjs`，用 `runSuite("R<里程碑号>-<n> …")` 命名（例如 `R2-1`）。沿用 `newIsolatedContext`（1440×900）和 `attachErrorListeners`（要求 0 个错误）。主要路径必须通过真实点击和按键驱动；状态注入只用于搭建前置条件。
- 已有的 24 个套件必须继续通过。如果确实因为设计变更需要修改旧套件，要在 PR 中说明理由。

### 存档兼容
- 外层结构（envelope v2）保持不变。新字段在 `normalizeLoadedGame` 中补默认值。上限钳制和迁移都不得删除原始数据，也不得让玩家进度倒退。
- 每项涉及存档的改动都要验证 5 种场景：开局、旧档续玩（用测试代码生成的 eb0ea67 格式存档）、刷新、写入失败（配额或只读）、多标签页竞争。每种场景使用独立的浏览器上下文。
- 元存档（T1/T5）采用 `{metaRev, …}`，并保持向后兼容：旧格式能正常读入。

### 显式选择规则
- 推进剧情、消费资源、领取奖励都必须由玩家点击或按键确认。新增的门控和锁定提示必须给出可辨认的反馈，并提供引路入口。

### 工具链（M1 → 所有人）
- `package.json` 的 scripts 定义为：
  - `"test:regression": "node scripts/verify-playable-v2.mjs"`
  - `"test:e2e": "node tests/e2e/run.mjs"`
  - `"art:manifest": "node scripts/art-manifest.mjs"`
- devDependencies 包含 `playwright-core@1.65.1`。
- 浏览器路径：优先读取 `CHROMIUM_PATH`，没有时回退到 `/usr/bin/google-chrome`（本机只有 Chrome 158；与 Chromium 同内核，这一差异在报告中如实记录）。
- M1 合并之前，验证方式为：在 `mktemp -d` 目录中复制 `scripts` 和 `web/public`，然后执行 `npm i playwright-core@1.65.1`。

### E2E 套件（E2E 轨道 → M7）
- 入口为 `tests/e2e/run.mjs`，自带静态服务器（`web/public`），视口 1440×900，每个用例使用独立的浏览器上下文，全部通过时 exit 0。支持 `--filter`、`--tier`、`--report <file>` 参数。
- Tier 1–4（56 项黑盒验收）不看实现，依据本文 Feature Inventory 中可观测的行为编写：用 UI 文本、DOM 状态和 localStorage 判断结果，`__CHENYUAN_V25__` 只用于搭建前置条件（例如把角色放到晚期境界），不用于断言内部实现；Tier 5（`tests/e2e/tiers/tier5-adversarial.mjs`，12 项白盒对抗加固）则刻意结合可观测 DOM/`localStorage` 断言与 `__CHENYUAN_V25__`/`__V24__`/`__V23__`/`__V22__`/`__V21__` 运行期不变量校验（详见 `TEST_INFRA.md`）。
- 测试中的存档数据由代码动态生成，不提交真实玩家存档。

## Code Layout
| Path | Owner（同一时间只有一个写入者） | Notes |
|---|---|---|
| `web/public/playable-v2.html` | 当前进行中的 M2…M7 之一（串行） | 唯一游戏入口；只用精确的行号编辑，不整文件重写（base64 行最长 21 万字符） |
| `web/public/art/<version>/` | 美术变更所在的里程碑 | 新美术源文件放这里，并在 `docs/art-manifest.md` 中登记 |
| `scripts/verify-playable-v2.mjs` | 当前进行中的 M2…M7 之一（串行） | 回归套件 |
| `scripts/art-manifest.mjs`、`docs/art-manifest.md` | M1（之后由涉及美术的里程碑维护） | 美术溯源 |
| `package.json`、`package-lock.json`、`.gitignore`、`README.md`、`.github/` | M1 | 工具链 |
| `tests/e2e/**` | E2E 轨道（之后由 M7 Tier 5 追加对抗测试） | E2E 套件 |
| `docs/v2-overhaul-notes.md` | M5（术语同步）；其他里程碑可追加变更记录 | 文档 |
| `PROJECT.md` | 根编排器 | 本计划 |
| `TEST_INFRA.md`、`TEST_READY.md` | E2E 轨道编排器 | 测试索引和完成信号 |
| `.agents/` | 元数据，**永不提交** | — |

## Git / PR Workflow
- 开始工作前核对仓库（`GOD-OF-PPT/chenyaun-v2`）、分支和工作树。
- 主检出目录 `/home/antigravity/GOD-OF-PPT/chenyaun-v2` 一直停在 `main`，只存放 `.agents/` 状态和根目录的 md 文件，不在这里提交功能代码。
- 每个里程碑使用独立的 git worktree：`git -C /home/antigravity/GOD-OF-PPT/chenyaun-v2 worktree add /home/antigravity/chenyaun-wt/<milestone> -b codex/<topic> origin/main`。所有编辑、构建和测试都在 worktree 中进行。
- 每个主题一个 PR，目标分支为 `main`。PR 描述附上真实的验证命令和结果。
- 闸门 PASS 后用 `gh pr merge --merge` 合并（保留历史；不 force-push，不改写已发布的历史），然后删除 worktree。
- 不提交 `.agents/`、`node_modules/`、玩家存档、凭据和字体文件。

## Verification Standard（每个里程碑闸门）
1. 运行回归测试：`npm ci && npm run test:regression`（M1 合并前用 mktemp 方式），结果为全部通过且 0 运行时错误。
2. 新增的 `R<n>-*` 套件覆盖本里程碑的所有特性。涉及存档的特性要覆盖 5 种存档场景。
3. 对静态 HTTP 入口做真实操作冒烟测试：`python3 -m http.server <port> --bind 127.0.0.1 --directory web/public`，1440×900 Chrome，按键鼠路径操作，检查焦点返回和反馈。
4. 闸门由 2 个 Reviewer、2 个 Challenger 和 1 个 Forensic Auditor 组成，Auditor 拥有一票否决权。

> **2026-11-23 用户指令调整（见 `.agents/teamwork/ORIGINAL_REQUEST.md`）**：
> - 不执行单独的手动冒烟测试（覆盖第 3 条）；真实入口操作验证由自动化 Playwright 套件（1440×900 独立浏览器上下文、静态 HTTP）统一满足。
> - M2–M6 阶段集中推进功能改动与交付，采用秒级静态语法校验（提取 `web/public/playable-v2.html` 内联 JS 执行 `vm.Script` / `node --check`）、静态代码审查与合规检查放行；全量 `npm run test:regression`、`npm run test:e2e` 与 5-Agent 动态对抗门禁统一后置至 **M7** 阶段集中补齐并执行，所有 PR 须如实记录验证范围。

## Status Log
- 2026-11-23T00:20Z — 调研（3/3）完成，PROJECT.md 初版完成，M0 规划 PR 进行中。
- 2026-11-23 — M0（PR #11，`PROJECT.md`）与 M1（PR #12，工具链、CI、`docs/art-manifest.md`）已合并至 `main`。
- 2026-11-23 — M2（PR #13，`4b1fc00`，`codex/save-input-safety`，T1–T7 + DOM XSS 加固）已合并至 `main`；E2E 轨道（`codex/e2e-suite`）按用户指令暂停保留 WIP，延后至 M7 接续。
- 2026-11-23 — M3（`codex/mainline-progression`）完成全部 5 项功能改动（S1 Boss 门控进阶与零倒退旧档迁移、S2 真实动态结局与诚实评分、S5 圆满后劫火周目/锁妖塔目标引导、S6 `resolveKarmaDilemmaChoice` 花括号修复、G3 战役 Boss/45% 单击伤害上限及 Boss Rush/登仙台/锁妖塔境界缩放统一）与静态校验；以下 4 项 `scripts/verify-playable-v2.mjs` 回归用例适配与 `R3-*` 新增套件按用户指令延后至 M7 统一更新执行：
  1. `M1-2`（L313、L344）两处瞬杀探针需改为 `hurtPlayer(99999, { uncapped: true })`（适配 G3 45% 单击上限）；
  2. `M1-3`（L398）渡劫瞬杀探针需改为 `hurtPlayer(99999, { uncapped: true })`（适配 G3 45% 单击上限）；
  3. `M1-3`（L372）炼气渡劫前置状态需补充 `s.game.stageStars[1] = 1`（或 `defeatedStageBosses[1] = true`）（适配 S1 守山石卫门控）；
  4. 新增 `R3-*` 回归套件（覆盖 S1 Boss 门控/旧档迁移 5 场景、S2 真实尾声/评分、S5 圆满追踪器、S6 因果槽、G3 每关击杀攻击次数区间与 45% 上限及三侧边模式单调缩放）。
- 2026-11-23 — M4（`codex/economy-integrity`）完成全部 7 项功能改动（G1 远征去空仓自充/600石5星上限/非洞府实战累积/已结缘且单人单节点校验与 `normalizeLoadedGame` 顺序修复、G2 灵玉赌注全法则集齐禁用与 30 石保底兜底、G4 Boss Rush 第6/7阵与登仙台第9重跳关练习模式零奖励零纪录零掉落、G5 分境永久成长上限/嗜血煞丹每境限购2枚/太虚锻剑单次 `taixuForged`/登仙台奇物上限Lv.3及旧档无损钳制、G6 全神通演武与试剑台预设隔离沙盒化含二次确认与顶部常驻退出条且零写正式存档/元存档、G9 行囊24/24队列式处置弹窗/炼丹缺料明示与确认/淬炼妖核抵扣勾选开关/魂印解锁自主择佩、G11a Boss Rush 按耗时/碎核/识破/受击/复活重定 A 基准评级与非降级最高评级）与静态校验；以下 `scripts/verify-playable-v2.mjs` 回归适配与 `R4-*` 新增套件按用户指令延后至 M7 统一更新执行：
  1. `R2-7d` Case 2（`G-T6a` L3406–3439）：洞府挂机下远征 `tickTimer` 按 G1 设计暂停（不再递减），需改为验证洞府内 `tickTimer === 8.5` 且 `saveRev` 不变，并将 `tickTimer < 8.5` 探针迁移至非洞府活敌战斗场景；
  2. `M4-1`（L910–927）：问道阶梯点击 `[data-action="toggle-arcana-all-roadmap"]` 后需点击 `#btn-confirm-enter-sandbox` 确认进入演武沙盒（验证 `#hud-sandbox-badge` 可见且正式存档未改动），并通过 `#btn-exit-sandbox` 退出沙盒；
  3. 新增 `R4-*` 回归套件（`R4-1` G1 远征与旧档5场景、`R4-2` G2 灵玉赌注、`R4-3` G4 练习模式零泄露、`R4-4` G5 永久成长上限与旧档5场景、`R4-5` G6 沙盒隔离与旧档迁移、`R4-6` G9 四项显式消费与焦点返回/XSS、`R4-7` G11a Boss Rush 评级校准）。
- 2026-11-23 — M5（`codex/narrative-content`）完成全部 6 项功能改动（S3 全界面章节单位统一为「卷」与「六卷」/右侧导航 `#nav-btn-story` 更名「故人」且主线唯一入口为目标追踪器与 `T` 键/同步 `docs/v2-overhaul-notes.md`、S4 四位故人与全部首领/妖兽规范名号头衔统一/7项主线步骤 ID 对齐并通过 `LEGACY_STEP_ID_MAP` 在 `normalizeLoadedGame` 无损迁移及修复 `claimMainlineStepReward` `pillQty`、S7 普通战役 Boss 战败后立即落盘→`clear_stage0..4` 演出→「第N卷·终」回顾卡→合卷后方启传送阵/非战役模式隔离与 `#story-dialogue-bar` 焦点陷阱安全返回及延迟弹窗防撞、S8 新开局 5 句 `opening_scroll` 开场前提与天门道影残片/砚尘石碑贯穿主线/`boss_pre_stage0..4` 战前战后台词/6 卷 `CHAPTERS[].desc` 渲染、S9 11 段 `STORIES` 挂钩 `chapter` 与规范 `STORY_LOCATIONS` 全四端及问道录展示/可选故人线不阻塞主线/`enter_*` 按 `game.choices` 切分初见重逢并消除 `enter_terrace` 与 `yan_gate` 重复、S10 `KARMA_DILEMMAS` 扩容至 9 段分卷不重复困境与 `completedKarmaIds` 迁移回填/幂等去重/`openEncounterModal` 回落与抽屉/HUD 状态反馈，以及 `window.__CHENYUAN_V25__` 增量导出）；已完成内联 `<script>` `node --check` + `vm.Script` 静态语法检查与全量只读静态合规核验（按 2026-11-23 用户指令，未运行任何浏览器/自动化回归或 E2E 测试，统一延后至 M7）；以下 `scripts/verify-playable-v2.mjs` 回归适配与 `R5-*` 新增套件延后至 M7 统一更新执行：
  1. S8 开场卷轴（`#btn-start-new` 现会开启 5 句 `opening_scroll` 并置 `arena.paused = true`）：共享辅助 `startCleanGamePage`（L153–155）以及直接点击 `#btn-start-new` 的 `M1-7`（L520）、`M4-2`（L1112）、`R2-1`（L1853）、`R2-5`（L2337）、`R2-6`（L2454）、`R2-7a`（L2629/L2643）、`R2-7c`（L3197）、`R2-7d`（L3267/L3377/L3413）在测试开场后实机操作或 `Escape` 关抽屉前需先通过 `#btn-dlg-skip` / `Escape` 结束开场卷轴；
  2. S4 步骤 ID 对齐：`P5-1`（L1693、L1711–1712）需将 `st.id === "s4_npc"` 更新为 `"s4_puppet"`；
  3. S7 卷终演出与回顾卡门控传送门：`M2-1`（L575–612）与 `P5-1`（L1737–1760）在击杀战役首领或触发 `waveIdx = 5; spawnCurrentWave()` 后需先完成/跳过 `boss_pre_stage*`、`clear_stage*` 演出并点击 `#btn-volume-recap-confirm`（同时可断言回顾卡开启期间传送门尚未生成），再校验 `portal_next` / `ascend_gate`；
  4. 保持兼容无破坏项：`#nav-btn-story` ID、`#btn-goals-modal`、`M3-2`、`M3-3`、`P2-1`（`STAGES[4]`）、`P4-1`（`CHAPTER_CUTSCENES.enter_secret` / `enter_sword_mound` 数组与关键词）、`R2-7d` N3（`karmaEventsDone: 1.5`）均保持兼容；
  5. 新增 `R5-*` 回归套件：`R5-1` S3 术语与导航改名、`R5-2` S4 规范设定名与 `LEGACY_STEP_ID_MAP` 5 场景旧档迁移、`R5-3` S7 卷终先落盘→演出→回顾卡→传送门与非战役模式隔离/焦点返回/XSS、`R5-4` S8 开场卷轴（逐句/跳过/焦点返回/续玩不重播）与战前战后首领台词及 `CHAPTERS[].desc` 渲染、`R5-5` S9 11 段故人线卷次/地点/追踪器可选行/不阻塞主线与 `enter_*` 动态台词及零重复、`R5-6` S10 9 段分卷因果不重复/幂等性/耗尽提示/古碑回落与 `completedKarmaIds` 5 场景存档迁移。
- 2026-11-23 — M6（`codex/systems-pacing`）完成全部 5 项功能改动（S11+G7 取消金丹期 7 键 + 4 模式一次性倾泻并按五境分批解封：`qi` 炼气启灵宠/丹剑/锁妖塔与 Y/Z/E/R/G、`foundation` 筑基启双姿态/魂印/护山战/换人/三器、`golden` 金丹启云海空战/星图/山海灵骑 J/奇门 U/剑谱 7、`nascent` 元婴启灵脉远征 8/登仙台 L/万剑冢与一气三清 4/法天象地 O、`spirit` 化神启天道劫印/造化工坊与山河社稷图 5/凌霄仙舟 6，补全 7 境 `REALM_UNLOCK_NOTICES`、旧档零倒退保护、11 张每解锁仅显一次的非阻塞 2 行 `#new-unlock-card`「新神通」试用卡及 `seenUnlockIds` 持久化与旧档预标防轰炸；G8 寿元真正生效：`RECIPES.months` 接入稳炼与控火炼丹、八卦丹剑 +3 月、破境 +12 月、渡劫受挫 +18 月、闭关每 3s +1 月且停闭关落盘、清关 +6 月、嗜血煞丹 +24 月，75% 预警 / 90% 修炼效率 -25% / 95% -50% / ≥100% -75%（单次惩罚无双乘，绝不死档），新增 `#hud-lifespan-badge` 与大限已至温和抉择弹窗（服延寿青莲丹 / 暂留延寿 / 二次确认「兵解转世」经 `executeReincarnation` 复用全部 M2/M4 写盘/损坏/冲突/回滚守卫并保留元存档 +40 轮回道果点）；G10 灵宠分级喂养成本 `PET_FEED_COSTS`（Lv.1→2 凝气草×3、Lv.2→3 妖核×2、Lv.3→4 妖核×4、Lv.4→5 地脉灵玉×3）与 Lv.3 化形灵技 / Lv.5 化境神通各 3 选 1 显式弹窗及 6 项实战数值生效与 `pet.skills` 持久化；G11b 清理 15 组确认无引用的死字段、修正 `SYSTEM_ECOSYSTEM_LADDER` 灵宠名与 `RELICS`/`SPIRIT_PETS`/劫印总分 +12% 数值漂移并将 `RELICS.passive` 接入提示；G12 闭关 1800px 全屏吸附仅限 `isMeditationSafeZone()` 安全区生效、活敌战中闭关收敛为 200px 近身拾取，以及 `window.__CHENYUAN_V25__` 增量导出）；已完成内联 `<script>` `node --check` + `vm.Script` 静态语法校验与全量只读静态合规核验（按 2026-11-23 用户指令，未运行任何浏览器/自动化回归或 E2E 测试，统一延后至 M7）；以下 `scripts/verify-playable-v2.mjs` 回归适配与 `R6-*` 新增套件延后至 M7 统一更新执行：
  1. `M4-1`（L950、L953）：因 S11+G7 将 `celestial_spire` 与 `vein_expedition` 移至 `nascent`、`heavenly_pacts` 移至 `spirit`，需将 `ladderCheck.golden.spire` 预期改为 `false`（新增 `ladderCheck.nascent.spire === true` 与 `vein_expedition` 金丹 `false`/元婴 `true` 校验），并将 `ladderCheck.nascent.pacts` 预期改为 `false`（新增 `ladderCheck.spirit.pacts === true` 校验）；
  2. `P1-1`（L1328–1353）：因 S11+G7 将 `Digit4`（`sanqing` 一气三清）由 `golden` 分批后移至 `nascent`，需将 L1334 `s.game.realm = "golden"` 更新为 `"nascent"` 以验证 `KeyE` + `Digit4` 真实灵力消耗与冷却（可选前置断言 `golden` 下 `Digit4` 仍受门控未触发）；
  3. `R2-7d` Case 2（L3406–3439）：与 M4 G1 迁移对齐——既有 `assignments.qinglan_vein` 旧档由 S11+G7 零倒退守卫保持兼容，在 M7 将 `tickTimer < 8.5` 探针迁往非洞府活敌战斗场景时可同步将 `g.realm` 对齐至 `"nascent"`（或分别覆盖旧档零倒退与元婴期常态解锁）；
  4. 保持兼容无破坏项：`M3-4`（`216 + 504 = 720/744 = 96.8%` → `.lifespan-alert-card.critical` 与 `[data-use-item="longevity_pill"]`）、`P3-1`（凡人开局可见按钮 `<= 14`、`#hud-lifespan-badge` 与 `#new-unlock-card` 默认隐藏、键位仍为 3 层 `.kb-tier-hdr`）均保持兼容；
  5. 新增 `R6-*` 回归套件：`R6-1` S11+G7 五境分批解封矩阵 + 旧档零倒退 + `#new-unlock-card` 试用/忽略/Escape/不抢焦点/`seenUnlockIds` 5 场景存档持久化与旧档预标零轰炸；`R6-2` G8 `RECIPES.months`/八卦丹剑/渡劫成败/闭关/清关老化 + 75%/90%/95%/100% 阶梯修炼效率单次扣减 + 延寿丹解警报与弹窗关闭焦点安全返回 + 大限已至「暂留延寿」与二次确认「兵解转世」（含只读/损坏/冲突/写元存档失败守卫）；`R6-3` G10 分级喂养扣料（`herb×3 → core×2 → core×4 → jade×3`）+ 缺料提示 + Lv.3/Lv.5 择技弹窗显式选择（关闭不代选、焦点安全返回）+ 6 项灵技实战生效与 5 场景存档兼容；`R6-4` G11b 死字段移除 + `SYSTEM_ECOSYSTEM_LADDER` 规范灵宠名 + `RELICS.passive`/劫印 +12% 显示一致；`R6-5` G12 洞府/清场安全区 1800px 闭关吸纳 vs 活敌战中闭关 200px 收敛校验；`R6-6` 沙盒模式隔离校验（沙盒不弹 `#new-unlock-card`、不老化、不触发大限弹窗）。
- 2026-11-23 — M3（PR #14，`eb112bd`）、M4（PR #15，`426c03a`）、M5（PR #16，`8d86761`）、M6（PR #17，`b399c67`）均已合并至 `main`；随后品质迭代轨道合入 PR #19（`b336fe8`，体验分析与品质计划）、PR #20（`28d02e2`，`codex/q0-infra-and-tests` 恢复 56 项 Tier 1–4 E2E 与 `R3..R6` 回归及 CI 门禁）、PR #21（`292b7b1`，`Q0-1/Q0-2` 战场焦点/过场优先级/规则文案对齐）、PR #22（`dfbbd38`，`Q1-1..Q1-6` 战中冷静/待领奖池/暂停令牌/通知总线），以及 **PR #23（`6946074`，`codex/navigation-hierarchy`，Q2 F14–F18、`Q2-1..Q2-5` 与目标弹窗刷新修复 P11，已由 `GOD-OF-PPT` 于 `2026-11-24T00:19:39Z` 外部合入 `origin/main`）**。注：当前远端仅剩 **PR #18** 保持 OPEN 未触碰。
- 2026-11-24 — **M7a（`codex/e2e-pass`，基于最新 `origin/main` @ `6946074`）**：
  1. 完整保留 PR #23（`6946074`）的全部 Q2 F14–F18 改动与 P11 修复，精准移植 `7ca198c` 仍缺失的 10 项运行期缺陷修复（P1 闭关 6 路打断 + 渡劫整备弹窗老化落盘 `toggleMeditation(false)` 及 `startLiveTribulation` 清理老化标记且保留 `resetEncounterTelemetry()`、P2 `startCelestialSpireRun` 元婴门控、P3 远征 `tickTimer === 0` 假值归零修复、P4 `openSandboxConfirmModal` 焦点返回 `#btn-pavilion-menu`、P5 `executeReincarnation` Q1 兼容回标题焦点落地 `#btn-start-new`、P6 `enterSanctumHub`/`initArenaStage` 清除残留 `arena.hitStop`、P7/P8 延寿丹/法宝淬炼/抽屉重绘保焦、P9 `#pavilion-popover` 提前收起并返焦、P10 移除 `startFreshGameSession` 提前清空 `storageReadError` 守卫），并闭环第 1 轮与第 2 轮门禁发现的全部缺陷：
     - **DEFECT-1（双误横幅与局内恢复）**：在 `renderHudSaveAlert()` 优先处理 `storageWriteError && storageReadError`（以及 `storageWriteError && saveReadOnlyMode`）双重异常，同时明确展示写入失败与原受损存档/只读态保留状态，暴露可工作的 `copy-corrupt-save-raw` / `load-latest-save` / `overwrite-with-current-save` / `open-cloud-backup` 并移除无效的 `retry-save-now` / `dismiss-save-alert`；为 `retry-save-now` 补齐 `storageReadError` 与 `saveReadOnlyMode` 防静默强提示守卫；为局内 `overwrite-with-current-save` / `retry-save-now` / `dismiss-save-alert` 补齐隐藏横幅后焦点安全返回（不落 `BODY`）；
     - **FINDING-2（过场期间浮层保焦）**：`#pavilion-popover` 项点击在 `cutscene.active` 时调用 `focusDialogSafely(#story-dialogue-bar)`，避免焦点短暂掉落 `BODY`；
     - **CRDT D1–D4（`META_KEY` 多标签并发自愈完整性与零冗余写放大）**：新增 `hallEntryKey()` 与覆盖全部 15 项单调字段（含 `ascensions`/`bestScore`/`bestTower`/`bestSpireFloor`/`bestCalamityTier`/`cloudSeaClears`/`reincarnationPoints`/`taixuTrailUnlocked`/`bestRushGrade`/`bestRushTime`/`karmaAscensions`、集合成员判定 `seenEnemies`/`seenLaws`/`unlockedEndings`、移除无效 `unlockedAchievements`、18 条上限下 `hallEntryKey` 成员判定）的 `isMetaBehind(candidate, target)`，并在写盘前实时重读 `localStorage.getItem(META_KEY)` 校验非损坏且仅当活盘确实落后于并集时方才调用 `saveMeta()`；
     - **Round 2 门禁缺陷闭环（`R2-D1`、`DEFECT-R2-1`、`DEFECT-R2-2`）**：
       - **`R2-D1`（局内活盘元存档损坏保警）**：`META_KEY` `storage` 事件处理器在合并与清除 `metaReadError` 前先实时读取并经 `parseAndValidateMetaRaw` 校验活盘 `localStorage.getItem(META_KEY)`；若活盘仍损坏则原样保留损坏字节（0 写盘）、保持 `metaReadError` 与 `#hud-save-alert` 显式可见（同时覆盖写入者与非写入者路径），并复用 `liveRes` 完成 CRDT 自愈判定；
       - **`DEFECT-R2-1`（主动写盘失败即时反馈与失焦修复）**：`saveGame()` 支持 `opts.userInitiated` 以在玩家主动点击 `retry-save-now` / `overwrite-with-current-save` 失败时绕过 6s 后台节流（`throttleMs: 0`）即时弹出写入失败提示，且在写入成功或失败重绘 `#hud-save-alert` 后均保持焦点脱离 `BODY`（失败回焦横幅对应按钮，成功回焦过场/抽屉/战场）；
       - **`DEFECT-R2-2`（多标签冲突/只读覆盖失败原子性）**：`overwrite-with-current-save` 先暂存 `saveReadOnlyMode`/`saveConflictState` 再调用 `saveGame({ forceOverwrite: true, userInitiated: true })`，仅在写入成功时关闭 `save_conflict`/`save_corrupt` 弹窗并清状态，失败时原样保留冲突弹窗、冲突/只读态与磁盘存档并保持弹窗/横幅焦点。
  2. 保留全部 **57 项**既有回归套件（`M1-1..Q2-5`，含 PR #23 更新的 `R2-4`/`Q0-1` 与 `Q2-1..Q2-5`）逐字节未修改未弱化，追加强化版 `R7-1`（含 DEFECT-1 双误横幅/防静默/局内恢复、`DEFECT-R2-1` 6s 内持续配额覆盖与纯 `retry-save-now` 失败/恢复即时提示与保焦、`DEFECT-R2-2` 冲突弹窗与只读态配额覆盖失败原子性）、`R7-2`（含 FINDING-2 过场点击保焦、CRDT D1–D4 2-tab 验收——并于第 3 轮门禁后加固 D1–D3 跨渲染器 `StorageArea` 复制同步与 `metaRev > staleRev` 真实自愈校验——及 `R2-D1` 局内活盘损坏元存档写入者/非写入者延迟有效 `StorageEvent` 保护）、`R7-3` 至 **60 项**回归套件（并为回归运行器补充内存静态缓存与 90s 默认单套件超时），同时将经核验的 E2E 运行器 CLI 校验/超时缩放/内存缓存/不透明箱轮询与用例增强（含修复 `E2E-T2-02` `maxHpBonus`、补全 `E2E-T1-07` 手柄重复键检查、`E2E-T3-10` 保持 320px 并补全近距与安全区阶段、`E2E-T4-02` 补全只读云码拒写断言，以及第 3 轮门禁仅改测试的 **`BLOCKER-R3-1` Chromium Mojo `StorageArea` IPC 竞态加固**：`E2E-T1-05` 双渲染器有限超时收敛轮询 `metaRev >= 2` 与合并并集并校验双标签页一致，不弱化任何断言且保持 `web/public/playable-v2.html` 与 `e25a660` 逐字节一致）移植至 `tests/e2e/**`；
  3. 1440×900 桌面 Chrome 158（`/usr/bin/google-chrome`，`Google Chrome 158.0.8127.36`，Chromium 内核，`CHROMIUM_PATH` 未设置回退，如实记录与上游 Chromium 差异；Node.js `v22.23.5`、`playwright-core@1.65.1`；按用户指令不跑单独手动冒烟）全量实测通过：静态与 CLI 门禁（`2026-11-24T03:33:18Z`–`03:33:20Z`，`playable-v2.html` 相对 `e25a660` 0 改动、内联 JS `vm.Script` PASS、单一 `arena.paused =` 写入点 L17776、`npm run art:manifest:check` PASS、CLI 退出码 `2` 校验 PASS）、定向压测（`E2E-T1-05` 连续 15 次压测 `03:33:29Z`–`03:35:27Z` **15/15 PASS，0 FAIL, 0 runtimeErrors**；`R7-2` 连续 3 次压测 `03:35:27Z`–`03:36:23Z` **3/3 PASS，0 FAIL, 0 runtimeErrors**，`18479ms`/`17320ms`/`16389ms`）、全量 `npm run test:regression`（`03:36:39Z`–`03:42:56Z`，**60/60 PASS，0 FAIL, 0 ERROR, 0 SKIPPED, 0 runtimeErrors, `376532ms`**）、`npm run test:e2e` 分阶验证 Tier 1 **31/31**（`03:43:05Z`–`03:45:13Z`，`127054ms`）→ Tier 2 **12/12**（`03:45:13Z`–`03:46:03Z`，`49175ms`）→ Tier 3 **10/10**（`03:46:03Z`–`03:46:56Z`，`51951ms`）→ Tier 4 **3/3**（`03:46:56Z`–`03:47:15Z`，`17927ms`）及全量 **56/56 PASS（`03:47:15Z`–`03:51:17Z`，0 FAIL, 0 runtimeErrors, `240648ms`）**；M7a 已于 **PR #25（`2b1ca3a`）** 合入 `main`。
- 2026-11-24 — **M7b（`codex/adversarial-hardening`，基于 M7a PR #25 @ `2b1ca3a`）**：
  1. 针对 Surface A（安全/存档/多标签/配额/焦点/弹窗与过场）与 Surface B（玩法/经济/上限/练习隔离/热键门控/生命周期）两路独立白盒对抗复现的全部 **19 项真实缺陷（`A-1..A-11`、`B-1..B-8`）** 完成先红后绿永久测试编码与根因修复：
     - **Surface A（11 项）**：`A-1` `openIconicUpgradeDraft` `titleText` `escapeHtml` 转义（防主档与 `CY24SAVE` 云码存储型 XSS）；`A-2` 主存档 envelope v2 增加向后兼容 `lineageId` 与多标签谱系/删档冲突检测（`isForeignSaveConflict`），封堵低版本号重置静默覆写；`A-3` `removePrimarySaveVerified()` 在 `execute-reset-save` 与 `executeReincarnation` 显式捕获 `SecurityError`/未删成功并原样保留状态、`bingjie` 原子回滚 `metaState` 与磁盘 `META_KEY` `+40` 轮回点；`A-4` `STORAGE_KEY` `storage` 事件先重读活盘校验损坏，杜绝延迟有效事件掩盖磁盘损坏弹出假冲突窗；`A-5` `load-latest-save` 失败与 `stay-readonly-save` 先 `renderHudSaveAlert()` 后 `closeModal()` 并保焦脱离 `BODY`；`A-6` `retry-meta-save` 补齐 `metaReadError`/`saveReadOnlyMode` 守卫、`saveMeta` 坏档强提示与失败/恢复保焦；`A-7` `startFreshGameSession` 传 `userInitiated: true` 消除 6s 内重开报错静默；`A-8` `closeModal()` 与 `openModal()` 抢占重置 `craftMinigame.open = false`；`A-9` `Escape` 关闭 `#pavilion-popover` 回焦 `#btn-pavilion-menu`、`F3` 禁在 `#welcome-screen` 弹出、焦点在原生 `<button>` 时 `Space`/`Enter` 不被一闪劫持；`A-10` 过场与抽屉严格互斥（过场中禁止 `toggleDrawer`，起过场前先关抽屉释放 `drawerPauseToken`）及 `#btn-skip-onboarding`/`#new-unlock-card`/`#gear-compare-card`（含熔炼一步上膛回焦）保焦脱离 `BODY`；`A-11` `normalizeLoadedGame` 过滤 `seenCutIns` 危险键（`__proto__`/`constructor`/`prototype`/`toString`/`valueOf`/`hasOwnProperty`）。
     - **Surface B（8 项）**：`B-1` `stepArena(dt)` 将 `canvas`/`w`/`h` 提升至 `rush_thunder` 分支之前根治 TDZ `ReferenceError` 主循环冻死；`B-2` 将 `arena.customSeedRun.active` 纳入 `isPracticeModeActive()` 并以运行时 `bonusCurios` 覆盖替代污染正式 `game.spireCurios`，杜绝奇物/胜场/星魂/掉落/魂印泄露；`B-3` 练习模式全面阻断 `saveGame`/`saveMeta`/正式炼丹（速炼/批量/控火/太虚百工）/永久属性丹药（`blood_fury_pill`/`longevity_pill`/破境丹）/打坐正式修为积累与实时渡劫（防 0 耗寿套利、防破境奖励被吞与 `metaState.ascensions` 泄露）；`B-4` 炼丹抽屉 `refill-gourd-now` 前后端双重门控至洞府静息态（`arena.sanctumMode && isCombatCalm() && !arena.tribulation`）；`B-5` 实时渡劫期间封禁 `H`、`#btn-sanctum-hub`、`M` 舆图与传送门零惩罚逃逸；`B-6` 星图 0 可用星魂点点击星宿不再静默扣 60 灵石，改为显式提示引导点击【凝炼星魂 +1 (60灵石)】；`B-7` `]`/`[`/`\` 移至 `photoMode` 与 `arena.paused` 守卫之后，2P 同游校验筑基境界与已结缘故人池，正道晨曦护盾增加 30s 冷却防 `\` 零成本刷盾；`B-8` `initArenaStage` / `enterSanctumHub` / `startLiveTribulation` 在清标记前先经 `toggleMeditation(false)` / `saveGame()` 落盘 `meditateAgedDirty`。
  2. 永久测试编码（全部 60 项既有回归 `M1-1..R7-3` 与 56 项既有 E2E `Tier 1–4` 逐字节未改动未弱化）：在 `scripts/verify-playable-v2.mjs` 末尾追加 `T5-1..T5-5`（总计 **65 项**回归套件），新增 `tests/e2e/tiers/tier5-adversarial.mjs`（`E2E-T5-01..E2E-T5-08` 共 8 项，接入 `tests/e2e/run.mjs` 支持 `--tier 1..5|all` 与非法参数 exit `2`，总计 **64 项** E2E）。修前实测 `T5-1..T5-5` 0/5 PASS、`E2E-T5-01..08` 0/8 PASS（复现含 `ReferenceError: Cannot access 'w' before initialization`）；修后于 1440×900 桌面 Chrome 158（`/usr/bin/google-chrome`，`Google Chrome 158.0.8127.36`，Chromium 内核，`CHROMIUM_PATH` 未设置回退，如实记录与上游 Chromium 差异；Node.js `v22.23.5`、`playwright-core@1.65.1`；按用户指令不跑单独手动冒烟）全量实测通过：
     - 静态与 CLI 门禁（`2026-11-24T05:54:11Z`–`05:54:14Z`）：`vm.Script` PASS（`scripts=1`）、单一 `arena.paused =` 写入点（L18020）、全量 `node --check` PASS、`npm run art:manifest:check` PASS、7 项 CLI 边界校验全返回退出码 `2`；
     - 全量 `npm run test:regression`（`05:54:24Z`–`06:01:42Z`）：**65/65 PASS，0 FAIL, 0 ERROR, 0 SKIPPED, 0 runtimeErrors，`437790ms`**（`T5-1` `6358ms`、`T5-2` `12423ms`、`T5-3` `18615ms`、`T5-4` `9856ms`、`T5-5` `8140ms`，exit `0`）；
     - `npm run test:e2e` 分阶验证：Tier 1 **31/31**（`06:02:01Z`–`06:04:05Z`，`122846ms`）→ Tier 2 **12/12**（`06:04:05Z`–`06:04:52Z`，`45664ms`）→ Tier 3 **10/10**（`06:04:52Z`–`06:05:44Z`，`51212ms`）→ Tier 4 **3/3**（`06:05:44Z`–`06:06:02Z`，`17586ms`）→ Tier 5 **8/8**（`06:06:02Z`–`06:06:52Z`，`48557ms`），合并全量 **64/64 PASS（`06:06:52Z`–`06:11:47Z`，0 FAIL, 0 runtimeErrors，`293654ms`，exit `0`）**。
- 2026-11-24 — **M7b Round 2（`codex/adversarial-hardening`，合并最新 `origin/main` PR #24 Q3 F19–F23 @ `fc9004fa` 并闭环第 1 轮门禁全部 13 项真实缺陷）**：
  1. 完整保留 PR #24（`fc9004fa`）全部 Q3 F19–F23 代码、工具与 `Q3-1..Q3-5` 回归套件（并为新增演武按钮 `refill-training`/`fill-intent` 补齐 `isSanctumDojoActive() && !arena.tribulation` 防战中满酿守卫），闭环全部 **13 项第 1 轮门禁缺陷**：
     - **Surface A（`R2A-1..R2A-6`、`DEFECT-R1-2B`、`DEFECT-R1-2C`）**：`R2A-1` 封堵跨标签删档复活（`saveGame()` 在 `loadedSaveRev > 0` 且磁盘为空时触发删档冲突、`storage` 监听不再跳过练习模式、`exitSandboxMode()` 重验活盘删档/损坏/异标签覆写）；`R2A-2` 重排 `executeReincarnation()` 为「元存档预检可写（不自增单调字段）→ 验证主档已删除 → 写单调 +40 轮回点/殿堂与 `saveMeta()`（失败时恢复 `prevSaveRaw` 并诚实报错）」，彻底根治 2 标签 CRDT 回弹无限刷 `+40` 点；`R2A-3`/`DEFECT-R1-2C` `STORAGE_KEY` `storage` 监听统一对账活盘（已删不弹假 `v99`、本页新档忽略陈旧异标签事件、全部坏档分支先 `renderHudSaveAlert()` 再关陈旧 `save_conflict` 并 `focusSaveAlertOrFallback` 脱离 `BODY`）；`R2A-4` `isElementFocusable()` 拒绝 `#welcome-screen` 后被遮挡元素且 `return-title-safe`/`execute-reset-save` 先显标题再关弹窗并落焦标题页；`R2A-5` `confirm-reset-corrupt-meta` 先重绘横幅再关弹窗保焦、`fallbackCopy` 临时 `<textarea>` 后还原焦点脱离 `BODY`；`R2A-6` `toggleDrawer()` 收起 `#pavilion-popover` 且 `keydown` 将 `#pavilion-popover.open` 的 `Tab`/`Escape` 置于 `drawerOpen` 之前；`DEFECT-R1-2B` `isPracticeModeActive()` 在 `!game` 或标题页返回 `false`，`return-title-safe`/`execute-reset-save`/`executeReincarnation` 清除侧模式与练习快照。
     - **Surface B（`R2B-1..R2B-6`、`DEFECT-R1-2A`）**：`R2B-1`/`DEFECT-R1-2A` 新增统一 `guardNotInTribulation()` 覆盖全部 19 处切图/锁妖塔/目标道标/生态玩法/剑冢/登仙台/工坊/护山/云海/沙盒/百工入口；`R2B-2` 引入 `practiceFormalSnapshot` 原地快照恢复（含 `resolveDefeatChoice("retreat-sanctum")` 战败撤回零污染与 `guardNotPracticeMode()` 覆盖百宝坊/正魔特供/淬火/刻录/紫气/星图/赠礼/洞府/灵宠/切玉/远征/问心/轮回）；`R2B-3` 战中与渡劫期间禁用炼丹抽屉 `[data-craft-open]` 与故人 `tea`/`spar` 且 `strikeTaixuCraftMinigame` 仅在洞府静息时满酿仙葫（保持 `Q3-5` 兼容）；`R2B-4` `resetRuntimeCombatOverrides()` 在 `exitSandboxMode()` 与会话切换清零 `coop2P`/`playableCharId`/`weaponForm`/`weaponPosture`/`swordIntent`/`astralEnergy`/`bondSynergy`/`astralForm`/`sanqingClones`/`shanheDomain`/`mountState`/`pillAcolyte`/`spatialRifts`；`R2B-5` `body.photo-mode-active` 隐藏并禁点 `#arcana-vault-wrap` 与 `#tag-team-hud-pill`，同时在 `toggleLocalCoop2P`/`cycleCoop2PPartner`/`cycleCelestialTimePhase` 及按钮处理层阻断暂停/拍照态点击；`R2B-6` 统一 `flushAndEndMeditation()` 在直进剑冢/登仙台/工坊/云海/护山/沙盒前先落盘闭关老化。
  2. 永久测试编码（全部 **65 项** `origin/main` 既有回归 `M1-1..R7-3 + Q3-1..Q3-5` 与 **56 项**既有 E2E `Tier 1–4` 逐字节未改动未弱化）：在 `scripts/verify-playable-v2.mjs` 末尾追加 `T5-6`、`T5-7`（总计 **72 项**回归套件），在 `tests/e2e/tiers/tier5-adversarial.mjs` 追加 `E2E-T5-09`、`E2E-T5-10`（Tier 5 共 10 项，总计 **66 项** E2E）。于 1440×900 桌面 Chrome 158（`/usr/bin/google-chrome`，`Google Chrome 158.0.8127.36`，Chromium 内核，`CHROMIUM_PATH` 未设置回退，如实记录与上游 Chromium 差异；Node.js `v22.23.5`、`playwright-core@1.65.1`；按用户指令不跑单独手动冒烟）全量实测通过：
     - 静态、不变性与 CLI 门禁（`2026-11-24T07:34:08Z`–`07:34:11Z`）：`vm.Script` PASS（`scripts=1`）、单一 `arena.paused =` 写入点（L18778）、全部 12 份 `.mjs` `node --check` PASS、`npm run art:manifest:check` PASS、65 项既有回归与 56 项既有 Tier 1–4 E2E SHA-256 逐字节一致、7 项 CLI 边界校验全返回退出码 `2`；
     - 全量 `npm run test:regression`（`07:34:11Z`–`07:42:04Z`）：**72/72 PASS，0 FAIL, 0 ERROR, 0 SKIPPED, 0 runtimeErrors，`472132ms`**（`Q3-1..Q3-5` 全通过，`T5-1..T5-7`：`4989ms`/`13840ms`/`19015ms`/`10015ms`/`6957ms`/`19927ms`/`5120ms`，`schemaVersion: 2`，exit `0`）；
     - `npm run test:e2e` 分阶验证：Tier 1 **31/31**（`07:44:12Z`–`07:46:17Z`，`124098ms`）→ Tier 2 **12/12**（`07:46:17Z`–`07:47:05Z`，`46879ms`）→ Tier 3 **10/10**（`07:47:05Z`–`07:48:00Z`，`53339ms`）→ Tier 4 **3/3**（`07:48:00Z`–`07:48:18Z`，`17499ms`）→ Tier 5 **10/10**（`07:48:18Z`–`07:49:27Z`，`68149ms`），合并全量 **66/66 PASS（`07:49:42Z`–`07:54:54Z`，0 FAIL, 0 runtimeErrors，`310324ms`，`schemaVersion: 1`，exit `0`）**；已同步更新 `TEST_READY.md`、`TEST_INFRA.md`、`README.md`，**M7 保持 `DONE`**。
- 2026-11-24 — **M7b Round 3（`codex/adversarial-hardening`，合并最新 `origin/main` PR #26 Q4 F24–F29 @ `4b86533c` 并闭环第 2 轮门禁全部 12 项代码/焦点/生命周期缺陷 + `DOC-1`）**：
  1. 无损合入外部 PR #26（`4b86533c`，`codex/first-volume-polish`，Q4 F24–F29 首卷动效/三层景深/WebP 质检/七层音效与性能基线/首卷体验闭环及试玩观察遥测，`bc9689e`），完整保留全部 PR #24 (`fc9004fa`) 与 PR #26 (`4b86533c`) 改动、`scripts/art-manifest.mjs`、`docs/art-manifest.md`、`docs/analysis/playtest-protocol-v1.md` 以及全部 **70 项** `origin/main` 既有回归套件（`M1-1..R7-3 + Q3-1..Q3-5 + Q4-1..Q4-5`）；审计 PR #26 新增 `spawnCurrentWave` 中 `vol1PedestalMeta` 首战提示 `saveGame()`，为 `initArenaStage`/`spawnCurrentWave` 新增 `opts.skipSave` 并由 `exitSandboxMode()` 传入 `{ skipSave: true }`，防止退出沙盒存在待处理冲突时误触发落盘。
  2. 闭环全部 **12 项第 2 轮门禁缺陷 + 阻断项 `DOC-1`**：
     - **Surface A（`R3A-1..R3A-5`）**：`R3A-1` `overwrite-with-current-save` 在练习模式触发时先清练习标记并通过 `endPracticeModeIsolation()` 还原原始正式快照后再执行强制覆盖落盘，成功关闭冲突弹窗、返回洞府更新 HUD、输出强提示（`{ critical: true }`）并保焦脱离 `BODY`（覆盖异标签新档与跨标签删档双场景）；`R3A-2` 新增 `closePavilionPopover()` 并在 `openModal()`、`return-title-safe`、`execute-reset-save`、`executeReincarnation()` 收起 `#pavilion-popover`，`keydown` 浮层分支增加 `!onWelcomeTop` 守卫，`getFocusableElements()` 复用 `isElementFocusable()` 拦截 `#welcome-screen` 后被遮挡按钮同时保持标题页弹窗可聚焦；`R3A-3` `STORAGE_KEY` `storage` 监听在活盘属本标签页时增加因果守卫（`res.rev <= livePrimaryRes.rev || res.updatedAt <= livePrimaryRes.updatedAt`），阻断延迟高版本旧 `StorageEvent` 假冲突且与既有 `R2-7` N1 兼容；`R3A-4` `exitSandboxMode()` 补齐旧版无 `tabId` 异源覆盖检测（`snapTabId` 曾设 / `res.rev !== snapRev` / 规范载荷校验和变更）；`R3A-5` 洞府演武栏 `[data-dojo-mode]` 与非弹窗 `[data-dojo-act]` 收起后回焦 `#btn-toggle-dojo-bar`（或 `#visual-stage`），并在 `keydown` 增加 `Escape` 收起 `#dojo-control-bar.expanded` 并回焦 `#btn-toggle-dojo-bar`。
     - **Surface B（`DEFECT-R2-2A/2B/2C`、`R3B-1..R3B-5`）**：`DEFECT-R2-2A` 在 `openBossRushVictoryModal()` 与 `completeSpirePracticeFloor()`（第 9 重天）演武通关处调用 `endPracticeModeIsolation()` 并于 `openCloudImportConfirmModal`/`commitCloudSaveImport` 增加 `guardNotPracticeMode("云码导入")` 与成功后清快照；`DEFECT-R2-2C` 在 `endPracticeModeIsolation()` 还原 `snap.meta` 后立即 `inspectMetaState({ applyToMemory: true })` 保留跨标签元存档进展；`R3B-1` 修复 `resetRuntimeCombatOverrides()` 中 `arena.sanqingClones` 拼写错位，正确重置 `ensureSanqingState()`、`sanqingEchoQueue`、`sanqingCd`/`shanheCd`/`warshipCd`/`warshipStrike` 及全部仙葫泡制计时（`hyperArmorTimer`/`samadhiFireReady`/`gourdHasteTimer`/`gourdCritTimer`/`petBuffTimer`/`boonOverloadTimer`/`guardShieldCd`/`zenStacks`）；`R3B-2`/`DEFECT-R2-2B` 在 `interactWithProp()` 为 `sanctum_portal`/`branch_portal`/`immortal_spring`/`ravine_zipline`/非洞府 `cauldron`/`tower_next`/`map_node_gate` 及 `openDungeonMapModal`/`enterDungeonNode`/`enterChosenBranchRoom`/`openCloudImportConfirmModal`/`commitCloudSaveImport` 补齐 `guardNotInTribulation()`，并在 `startLiveTribulation()` 清除 `arena.sanctumMode`、`arena.bladeClash`、演武栏 `.active`/`.expanded`、木桩敌与洞府道具；`R3B-3` 在 `endPracticeModeIsolation()` 末尾调用 `resetRuntimeCombatOverrides()` 阻断工坊 `astralEnergy`/`astralForm`/`sanqingState`/`shanheDomain` 泄露；`R3B-4` 新增 `resetSanctumDojoCombatGauges()` 于洞府出征进入常规关卡、剑冢、登仙台、云海、护山战与渡劫时清零 `swordIntent`/`bondSynergy`/`reversedDomainTimer`/`styleScore`/`comboCount`；`R3B-5` `startSectDefenseSiege()` 过滤 `!pr.isDojoProp && !pr.isDummy && pr.kind !== "ward_pylon" && pr.kind !== "frost_crystal"` 并清 `waterPools`/`fireZones`。
     - **文档阻断项 `DOC-1`**：更新 `TEST_INFRA.md`（Overview 与 Opaque-Box & Compliance Rules）明确区分 Tier 1–4 严格黑盒验收 vs Tier 5 白盒对抗加固，并同步 `scripts/verify-playable-v2.mjs` T5 区段横幅为 `T5-1 .. T5-9`。
  3. 永久测试编码（全部 **70 项** `origin/main` 既有回归 `M1-1..R7-3 + Q3-1..Q3-5 + Q4-1..Q4-5` 与 **56 项**既有 E2E `Tier 1–4` 逐字节未改动未弱化）：在 `scripts/verify-playable-v2.mjs` 末尾追加 `T5-8`、`T5-9`（总计 **79 项**回归套件），在 `tests/e2e/tiers/tier5-adversarial.mjs` 追加 `E2E-T5-11`、`E2E-T5-12`（Tier 5 共 12 项，总计 **68 项** E2E）。于 1440×900 桌面 Chrome 158（`/usr/bin/google-chrome`，`Google Chrome 158.0.8127.36`，Chromium 内核，`CHROMIUM_PATH` 未设置回退，如实记录与上游 Chromium 差异；Node.js `v22.23.5`、`playwright-core@1.65.1`；按用户指令不跑单独手动冒烟）全量实测通过：
     - 静态、经济、不变性与 CLI 门禁（`2026-11-24T09:24:48Z`–`09:24:51Z`）：`vm.Script` PASS（`scripts=1`）、单一 `arena.paused =` 写入点（L19301）、全部 12 份 `.mjs` `node --check` PASS、`npm run art:manifest:check` PASS（`115 inline assets, 11 disk files, 1 other inline asset`）、`node scripts/audit-economy.mjs` PASS（`violations=0`）、70 项既有回归与运行器尾段 SHA-256 逐字节一致（`ca7a087a...` / `a35aaf28...`）、56 项既有 Tier 1–4 E2E 与 `lib/` 0 改动、8 项 CLI 边界校验全返回退出码 `2`；
     - 全量 `npm run test:regression`（`09:25:02Z`–`09:34:38Z`）：**79/79 PASS，0 FAIL, 0 ERROR, 0 SKIPPED, 0 runtimeErrors，`574704ms`**（`Q3-1..Q3-5` 与 PR #26 `Q4-1..Q4-5` 全通过，`T5-1..T5-9`：`5778ms`/`14670ms`/`23323ms`/`11208ms`/`8171ms`/`23898ms`/`6109ms`/`21856ms`/`2930ms`，`schemaVersion: 2`，exit `0`）；
     - `npm run test:e2e` 分阶验证（`09:35:23Z`–`09:41:34Z`）：Tier 1 **31/31**（`138117ms`）→ Tier 2 **12/12**（`49308ms`）→ Tier 3 **10/10**（`60717ms`）→ Tier 4 **3/3**（`20396ms`）→ Tier 5 **12/12**（`97815ms`），合并全量 **68/68 PASS（`09:45:34Z`–`09:51:48Z`，0 FAIL, 0 runtimeErrors，`372349ms`，`schemaVersion: 1`，exit `0`）**；已同步更新 `TEST_READY.md`、`TEST_INFRA.md`、`README.md`，**M7 保持 `DONE`**。

