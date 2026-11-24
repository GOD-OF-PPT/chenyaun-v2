# 《尘缘问道 · 剑阵万象》事实变更日志（CHANGELOG）

> 本文件仅记录已合入仓库或本分支实际交付并验证的事实性里程碑变更；历史早期 V2 改造原文完整保留于 [docs/v2-overhaul-notes.md](v2-overhaul-notes.md)（不做删改）。

## 当前验收与范围诚实声明

| 条目 | 当前状态 | 事实说明 |
|---|---|---|
| **F29（观察式真人试玩）** | **`NOT_RUN`** | 实际完成真人试玩人数：`0 / 5~8` 名新玩家。仅完成遥测结构与导出自检，未以自动化代替真人验收。 |
| **F37（非核心扩展：扫荡/移动端/自动连升）** | **`SUPERSEDED_BY_R3_D08`** | Q6 阶段按保守基线记为 `DEFERRED`；2026-11-24 定稿 D08 由 Round 3 `R3-M3` 接管实施三星扫荡与长按连续养成（仍明确不做移动端适配，维持 1440×900 桌面键鼠）。 |

---

## Round 3 · R3-M2（D05）— 主线境界动态缩放、精简副货币与全模式统一 S / A / B / C 评级（R3-F04–R3-F06）

- **R3-F04 主线关卡敌群随玩家境界动态缩放**：
  - 在 `src/rules/combat-stats.mjs` 新增纯函数 `computeMainlineRealmScaling(stageIdx, realmId, isBoss)` 并挂入 `window.__CHENYUAN_DEBUG__.rules`：锚定 `REALM_COMBAT_BASELINE`，同境及低境（`delta <= 0`）严格返回 `1.0×`；第 5 关（兼承元婴/化神）化神期取 `hpEase = 1.0, atkEase = 1.0`（`1.407×` Boss HP / `1.414×` ATK）、飞升期取 `hpEase = 0.90, atkEase = 0.82`；回访前 4 关采用平滑阻尼与架势/灵石上限（`postureMult <= 1.65`, `stoneMult <= 2.20`）。
  - 在 `src/runtime/stage-expedition.js` `spawnSingleEnemy()` 仅对主线上下文应用动态缩放（显式排除无尽塔、万剑冢、登仙台、护山大阵、云海空战与自定义工坊，杜绝双倍缩放），并在 `src/runtime/combat-step.js` `handleEnemyDeath()` 仅按 `realmStoneMult` 放大灵石掉落、严格保留低关修为衰减（`spiritCh1WolfXp <= 15`）；在九州舆图预览条显示动态同步提示。
- **R3-F05 精简副货币并折合入核心资源（无旧档迁移垫片）**：
  - 彻底移除 `metaState.reincarnationPoints`（轮回道果点），引入单调计数 `metaState.bingjieCount`（CRDT `numMax` 合并）并折合至 `createFreshGame()` 开局传承灵石 `legacyStones = Math.min(240, ascensions * 45 + bingjieCount * 40)`，同步更新兵解弹窗、提示与历世殿堂文案。
  - 彻底移除 `game.sectMerits`（护宗功勋），新增明确初始化与清洗字段 `game.sectDefenseCleared` 与 `game.sectDefenseBestGrade`；护山大阵胜利奖励折合为 **320 灵石 + 妖核 ×2 + 地脉灵玉 ×(S?2:1)**（保留星魂点 +2 与永久剑攻 +16），`fireManualSlash()` 与第五卷【诸天道果共鸣】护山大阵柱改判 `sectDefenseCleared`/`sectDefenseBestGrade`。保留灵石、7 种核心材料与二十八星宿 `bonusStarPts`。
- **R3-F06 全模式统一 `S / A / B / C` 评级与 `stageStars` 纯对象兼容修复**：
  - 在 `src/rules/scoring-rules.mjs` 导出 `UNIFIED_GRADES`、`UNIFIED_GRADE_RANK`、`isValidUnifiedGrade`、`maxUnifiedGrade`、`stageStarsToGrade`（`3★↔S`、`2★↔A`、`1★↔B`、`0★↔C`）与 `computeModeGrade`，统一道果金榜、万剑冢、剑道风华评级仪与连击阶位（含 `#combo-rank-seal.rank-s` 与 `S` 级法天象地瞬发）、演武训练、主线双显评级以及护山大阵/云海空战/登仙台/锁妖塔/造化工坊 5 个侧边模式；全面清除 `D`/`SS`/`SSS`/`S+`。
  - 修复 `src/rules/campaign-q6.mjs` `getExpeditionNodeStageSynergy()` 误用 `Array.isArray(g.stageStars)` 导致实机纯对象存档漏算远征星级共鸣的潜在缺陷。
- **测试与审计更新**：单测 `34 → 39`（新增动态缩放、统一评级与 D05 零残留静态守卫）、`scripts/audit-economy.mjs` 更新为 `d05CurrencyAudit`、`scripts/verify-playable-v2.mjs` 新增 `R3-D05-1`（总 `78 → 79` 套件）并覆盖新口径五场景存档验证。

---

## Round 3 · R3-M1（D06）— 运行时深度子系统拆分与统一调试门面（R3-F02 / R3-F03）

- **R3-F02 `src/runtime/main.js` 深度拆分与确定性构建**：
  - 将原 31,458 行 `src/runtime/main.js` 按连续拓扑顺序拆分为 15 个有序子系统模块（`world-data`、`narrative-state`、`flagship-systems`、`endgame-modes`、`primordial-systems`、`genesis-dojo`、`persistence-sandbox`、`scheduler-rewards`、`sanctum-ecosystem`、`stage-expedition`、`combat-skills`、`combat-step`、`renderer`、`ui-modals-drawer`、`input-handlers`）加 20 行薄 `src/runtime/main.js` 主循环外壳，保持 2 空格顶层声明缩进，确保 `docs/art-manifest.md` 零漂移。
  - 将原交错于尾部历史调试导出块间的 3 处真实 DOM 监听（无障碍/分轨/工坊 `input`、修行抽屉 `#panel-scroll-body` `<details>` `toggle`、连招/淬炼妖核折扣/远征/工坊 `change`）完整迁移至 `src/runtime/input-handlers.js`。
  - 更新 `scripts/build-playable.mjs` 导出 `RUNTIME_MODULE_ORDER`（16 个运行时模块），逐个校验禁 BOM / LF / 禁 `</script` 后以 `// --- [runtime] <path> ---` 拼入单一 IIFE，继续产出字节级确定性的单文件离线 `web/public/playable-v2.html`（严格单 `<script>`、零外部 URL、115 张 WebP SHA-256 与 5 张 VP8X RGBA 校验不变）。
- **R3-F03 统一 `window.__CHENYUAN_DEBUG__` 与清除历史分版本钩子**：
  - 重写 `src/runtime/debug-facade.js` 为单一门面 `window.__CHENYUAN_DEBUG__`（`version: "d06-unified-1"`，顶层共 370 键）：无副作用统一 `getState()`（29 字段，纯读取不触发 `ensure*` 写副作用）、5 组结构化分组（`rules`/`q6`/`persistence`/`art`/`telemetry`，全部改为直接内部绑定）以及原 363 个去重子系统绑定（含 `startColossalTitanRaid` 与 `executeSixAspectAwakeningSkill` 包装器）；彻底删除历史 8 个分版本全局钩子及过渡性 `namespaces`/`getNamespace`。
  - 全量迁移 `scripts/eval-combat-matrix.mjs`、`scripts/audit-economy.mjs`、`scripts/verify-playable-v2.mjs`（更新 `Q5-1`/`Q5-2` 并新增 `R3-D06-1` 验证旧钩子清零、无副作用 `getState()` 与 3 处尾部 DOM 监听，总回归套件 `77 → 78`）、`tests/e2e/tiers/tier{1..4}-*.mjs`（56 项 E2E）以及 `tests/unit/build-parity.test.mjs`（单元测试 `32 → 34`，新增 `RUNTIME_MODULE_ORDER`/薄外壳校验、拆分模块外链守卫与跨源码/脚本/E2E/产物的零旧钩子静态扫描）。

---

## Q7 — 阶段二全量测试环境验证、遗留边界收口与发布证据包（F38）

- **7 项 Q1–Q5 遗留边界打磨收口**：
  - `startSectDefenseSiege()` 清理演武坪残留 `isDojoProp`（阵眼柱/玄冰晶）与 `waterPools`/`fireZones`；`spawnDojoDummy()` 非法模式回退 `"static"`。
  - 寒池正道延寿选项（`karma_r_spring`）脱离大限后同步重置 `lifespanExhaustedPromptDismissed` 与 `pendingLifespanExhaustedPrompt`。
  - `load-latest-save` 失败分支仅在 `save_conflict`/`save_corrupt` 弹窗打开时关闭，避免误关无关弹窗。
  - `closeDrawer()` 移除抽屉残留隐藏 `#btn-mat-source-return`，洞府多建筑材料来源返焦优先匹配 `data-source-origin`。
  - 对齐 `DAO_LAWS.wanjian` / `LAW_SHORT_BADGE.wanjian` 文案为 `+1`（与 `getSwordCount()` 一致）；`formatGearStats()` 增加 `num()` 守卫；`scripts/build-playable.mjs` 收紧 ESM `import` 正则并显式拒绝裸副作用 `import`（补入 `tests/unit/build-parity.test.mjs`）。
- **1440×900 桌面 Chromium 阶段二全量实测证据（[validation/q7-release/SUMMARY.md](analysis/validation/q7-release/SUMMARY.md)）**：
  - `npm run build:check` PASS、`npm run art:manifest:check` PASS、`npm run test:unit` **32/32 PASS**。
  - 静态 HTTP 全量回归 **77/77 PASS**（0 运行时错误）+ 全量 E2E Tier 1–4 **56/56 PASS**（0 运行时错误）。
  - 直接 `file://` 入口启动（`firstInteractiveMs = 1197ms`，0 运行时错误）与无头 `eval-combat-matrix`（84/84 PASS）/`audit-economy`（0 违规）全部通过。
  - 诚实边界保留：`F29 = NOT_RUN`（`0 / 5~8` 真人试玩）、`F37 = DEFERRED`（D08）。

---

## Q6 — 后续卷次品质、第五卷共鸣与高阶模式整合（F34–F36；F37=`DEFERRED`）

- **F34 后续卷次（2–6 卷）叙事、敌招读招、分层景深与故人回响**：
  - 新增纯 ESM 模块 `src/rules/campaign-q6.mjs`（构建模块 `9 → 10`），导出 6 卷 `VOLUME_CAMPAIGN_GUIDE`、`VOL5_RESONANCE_PILLARS`、`HIGH_TIER_MODE_REGISTRY`、`EXPEDITION_NODE_STAGE_MAP` 及纯共鸣计算函数。
  - 3 层视差景深扩展至全部 5 张主线秘境（`vol1`–`vol5` + `sanctum`），严格遵守 `fgMarginPct ≤ 0.11` 不遮危招与 `reducedMotion` 冻结。
  - 补齐 `serpent`（扇形霜弹+霜池）、`puppet`（十字剑波+铜镜）、`trial_gate`（九霄天雷 `r=76` 锁点环）及 `shadow`/`sentinel` 的读招、受击归因与动作反馈。
  - 在九霄问道录与九州舆图预览条展示逐卷敌招考题与成长收益；扩展 `clear_stage1..4` 故人羁绊过场分支、卷终回顾 `#volume-recap-companion-echo` 与结局 `companionEpilogues`（保持 `STORIES.length === 11`、`KARMA_DILEMMAS.length === 9`）。
- **F35 第五卷保守基线（D01/D04）与 5 项终局模式修复**：
  - 保持 `REALM_BOSS_GATE` 与既往 `CHAPTERS` 必做步骤不变；新增 `openVol5ResonanceModal()`（`ch5_resonance` 与问道录入口）、`enter_vol5_resonance`、`enter_terrace_vol5`、元婴期第五卷合卷回顾、渡劫窗第五卷→第六卷说明与元婴仙门修为提示修复。
  - 修复 5 项实机侧边模式缺陷：1) 造化工坊胜利结算弹窗、`resetEncounterTelemetry()` 与临时 Lv.2 奇物离场还原/`saveGame()` 隔离；2) 九霄云海首破 3 阶仙装移至 `initArenaStage` 后 `acquireGearItem` 发放；3) 护山大阵免费初援、波次 `stageEpoch` 隔离与战报结算窗；4) 万剑冢修正七阵文案；5) 破云证道印 `+15%` 灵石收益实装登仙台结算与实时徽章。
- **F36 高阶系统三分组、跨系统共鸣与 D07 解锁一致**：
  - `ACTION_REALM_REQ` 新增 `coop_2p: 3`、`celestial_time: 3`（金丹期解封，`setCelestialTimePhase` 保持开放供自动流转与 `Q0-2`）；`]`/`[`/`\` 增加暂停与欢迎页屏蔽；退出沙盒重置 `arena.coop2P.active = false`；2P 名单按故人结缘扩展；`Digit8` 先校验 `vein_expedition` 解锁再战中双击确认；同步太虚秘匣分组与演武坪锁标。
  - 问道阶梯与终局页新增三分组总览（`主线内嵌`/`终局试炼`/`演武与工具`）与 6 柱【诸天道果共鸣】（保持 `SYSTEM_ECOSYSTEM_LADDER` 14 项 `.roadmap-sys-btn` 不变，0 柱对既往数值零漂移）；远征节点接入秘境通关 `+15%` / 三星 `+30%` 共鸣与周天星图直达入口；周天星图新增实时天时横幅与受控流转按钮。
  - 在 `window.__CHENYUAN_DEBUG__.q6` 暴露增量调试接口，保持 `version: "q5-compat-1"` 与 `V18–V25` 全部 382 项契约零改动。
- **F37 非核心扩展边界（D08）**：新建 [docs/analysis/q6-decisions-and-boundary.md](analysis/q6-decisions-and-boundary.md)，明确登记扫荡、9:16 移动端适配、长按自动连升为 **`DEFERRED`**，保留显式批量确认；F29 真人试玩维持 **`NOT_RUN`**。
- **测试覆盖**：新增 `tests/unit/campaign-q6.test.mjs`（单元测试 `27 → 32`，8 个测试文件）与 `Q6-1..Q6-4` 回归套件（总回归套件 `73 → 77`，原有 73 项断言零删改）。

---

## Q5 — 模块化编辑源、确定性独立构建与分层测试（F30–F33 · D06 保守基线）

- **F30 运行资产提取与确定性构建**：
  - 从实机内联 `const ART` 原样无损提取全部 115 张 WebP 至 `src/assets/runtime/*.webp`，生成无时间戳清单 `src/assets/art-index.json`（保留 5 张 VP8X RGBA 受保护精灵，未触动 `web/public/art/v4/`）。
  - 拆分 `src/template.html`、`src/styles/main.css`、`src/markup/body.html`、`src/runtime/{preamble,main,debug-facade,boot}.js`。
  - 新增纯 Node ESM 构建脚本 `scripts/build-playable.mjs`（零外部依赖，提供 `npm run build`、`npm run build:check`、`--out <path>`），内置单 `<script>`、零外部 CDN、`vm.Script` 语法及 115 张 WebP SHA-256 双向校验。
- **F31 配置与纯规则渐进模块化**：
  - 抽离 9 个原生 ESM 模块：`src/rules/utils.mjs`、`src/config/combat-params.mjs`、`src/config/realms-items.mjs`、`src/config/progression-data.mjs`、`src/rules/gear-rules.mjs`、`src/rules/combat-stats.mjs`、`src/rules/economy-rules.mjs`、`src/rules/scoring-rules.mjs`、`src/state/save-rules.mjs`。
  - 纯重构零数值/行为漂移：`eval-combat-matrix.mjs` 与 `audit-economy.mjs` 在相同种子下输出与重构前一致。
- **F32 分层测试、兼容调试门面与 CI 接入**：
  - 新增 `npm run test:unit`（`tests/unit/*.test.mjs`，7 个纯 Node `node:test` 文件覆盖属性账本、战斗数学、装备滚落/保底、经济/寿元、评分与评级、存档封装/CRDT 与构建/VM 一致性及负向构建校验）。
  - 增补 `window.__CHENYUAN_DEBUG__`（`version: "q5-compat-1"`）兼容门面，完整保留 `window.__CHENYUAN_V18__`–`__CHENYUAN_V25__` 全部 382 项既有契约。
  - 在 `scripts/verify-playable-v2.mjs` 末尾增补 `Q5-1..Q5-3`（总回归套件 `70 → 73`，原有 70 项断言零删改），覆盖 382 键契约、`file://` 与 HTTP 一致性、旧档 D05 装备保护、`CY24SAVE` 云码、沙盒隔离以及 Node ESM 与 Chromium 实机规则交叉验证。
  - 在 `.github/workflows/e2e.yml` 增补 `npm run build:check` 与 `npm run test:unit`。
- **F33 文档同步**：同步更新 `README.md`、`docs/design.md`、`TEST_INFRA.md` 并新增本 `docs/CHANGELOG.md`；保持 `docs/v2-overhaul-notes.md` 原样未改动。

---

## Q4 — 首卷动作/场景/资产质检/视听反馈与体验闭环（F24–F28；F29=`NOT_RUN`）

- 完成主角与首卷敌人（狼王/石卫）动作轮廓、锚点及金芒/红危读招一致性精修（F24）。
- 落地首卷分层视差与 `reducedMotion` 兼容，完成 115 张内联 WebP 解码及 5 张受保护 RGBA 精灵二进制质检（F25–F26）。
- 实现分级打击声效与帧时间采样，贯通第一卷「救援→择道→洞府整备→狼王→渡劫」完整闭环与独立遥测导出（F27–F28），回归套件增至 `70` 项（新增 `Q4-1..Q4-5`）。
- 观察式真人试玩（F29）如实保持 `NOT_RUN`。

---

## Q3 — 收益账本、双流派样板、战斗评测矩阵与经济寿元闭环（F19–F23）

- 统一 `computeCombatStatLedger` 与修行明细面板同源输出，校准技能/道果/词条/仙葫文案与实效一致（F19）。
- 明确青霜御剑/紫霄雷符双流派职责、六象切手提示与三项演武专项练习，封堵演武木桩收益套利（F20）。
- 新增无头 Node VM 评测矩阵 `scripts/eval-combat-matrix.mjs`（84 组可复现场景）与经济审计 `scripts/audit-economy.mjs`（F21、F23）。
- 实施 `GEAR_BUDGET_BY_RARITY` 装备预算与流派推荐词条定刻，严格遵循 D05 不回溯削弱旧档装备；封堵 `km_demon_core` 买拆套利并为全部 7 条耗寿路径增加操作前 `previewLifespanImpact` 预览（F22–F23）；回归套件增至 `65` 项（新增 `Q3-1..Q3-5`）。

---

## Q2 — UI 语义层级、主线/故人导航与升级预览（F14–F18）

- 建立主线/故人/试炼/经济/系统颜色与形状双编码语义规范与统一层级焦点（F14）。
- 收敛历练与修行页面入口，保留既有路由与键位可达性，分级提醒与批量养成显式确认/取消及失败复盘导航（F15–F18）；回归套件增至 `60` 项（新增 `Q2-1..Q2-5` 与 `R7-1..R7-3`）。

---

## Q1 — 战斗连续性、待处理权益持久化与暂停/焦点所有权（F07–F13）

- 落地 `game.pendingRewards` 持久化与幂等结算，覆盖排队/激活/写失败/多标签冲突与沙盒隔离（F07）。
- 实现战斗静默安全窗口调度、实例化暂停所有权 token 与模态优先级，避免混战背包满/魂印/渡劫连环选择打断实时战斗（F08–F13）；回归套件增至 `52` 项（新增 `Q1-1..Q1-6`）。

---

## Q0 — 测试设施、美术溯源清单、焦点修复与文案校准（F01–F06）

- 恢复稳定资源键与 SHA-256 驱动的 `scripts/art-manifest.mjs` / `docs/art-manifest.md` 与 GitHub Actions CI 验收流水线（F01）。
- 升级回归运行器至失败继续执行、独立 1440×900 上下文隔离与 `schemaVersion: 2` 报告，补齐 `R3–R6` 与 56 项 Tier 1–4 黑盒 E2E 套件（F02–F04）。
- 修复对白结束焦点回战场、HUD 按钮 Enter 激活与技能/法则文案口径一致（F05–F06）。

---

## 早期基线（M1–M7a）

- 2.5D 动作修仙单文件 V2 基线与早期版本改造记录见 [docs/v2-overhaul-notes.md](v2-overhaul-notes.md)。
