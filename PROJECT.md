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
  - `scripts/verify-playable-v2.mjs` 是回归套件，共 24 个，基于 Playwright。它自带静态服务器，视口 1440×900，每个套件使用独立的浏览器上下文，并要求 0 个 console 或页面错误。
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
| M0 | 规划 PR | 提交 PROJECT.md | `codex/project-plan` | none | DONE (PR #11) |
| M1 | 工具链与美术溯源 | T8, T9 | `codex/tooling-art-provenance` | none（不改 playable-v2.html，可与 M2 并行） | DONE (PR #12) |
| M2 | 存档与输入安全 | T1–T7 | `codex/save-input-safety` | none | DONE (PR #13, `4b1fc00`) |
| M3 | 主线进阶完整性与难度曲线 | S1, S2, S5, S6, G3 | `codex/mainline-progression` | M2 已合并 | DONE (`codex/mainline-progression`) |
| M4 | 经济完整性与显式消费 | G1, G2, G4, G5, G6, G9, G11a | `codex/economy-integrity` | M3 已合并 | DONE (`codex/economy-integrity`) |
| M5 | 叙事内容：前提、卷终、故人线 | S3, S4, S7, S8, S9, S10 | `codex/narrative-content` | M4 已合并 | PLANNED |
| M6 | 系统节奏与深度 | S11+G7, G8, G10, G11b, G12 | `codex/systems-pacing` | M5 已合并 | PLANNED |
| E2E | E2E 测试轨道 | E1 → 发布 `TEST_READY.md` | `codex/e2e-suite` | M1（package.json），否则自带运行器 | PAUSED (WIP on `codex/e2e-suite`; deferred to M7 per user directive) |
| M7 | 最终里程碑：通过 E2E 并对抗加固 | E2：Tier 1→2→3→4 按顺序闸门，然后 Tier 5 | `codex/e2e-pass`、`codex/adversarial-hardening` | M1–M6 + TEST_READY.md | PLANNED |

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
- 测试不看实现，依据本文 Feature Inventory 中可观测的行为编写：用 UI 文本、DOM 状态和 localStorage 判断结果。`__CHENYUAN_V25__` 只用于搭建前置条件（例如把角色放到晚期境界），不用于断言内部实现。
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
