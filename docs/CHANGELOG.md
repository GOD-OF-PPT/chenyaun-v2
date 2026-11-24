# 《尘缘问道 · 剑阵万象》事实变更日志（CHANGELOG）

> 本文件仅记录已合入仓库或本分支实际交付并验证的事实性里程碑变更；历史早期 V2 改造原文完整保留于 [docs/v2-overhaul-notes.md](v2-overhaul-notes.md)（不做删改）。

## 当前验收与范围诚实声明

| 条目 | 当前状态 | 事实说明 |
|---|---|---|
| **F29（观察式真人试玩）** | **`NOT_RUN`** | 实际完成真人试玩人数：`0 / 5~8` 名新玩家。仅完成遥测结构与导出自检，未以自动化代替真人验收。 |
| **F37（非核心扩展：扫荡/移动端/自动连升）** | **`DEFERRED`（D08）** | 按 D08 保守基线暂缓实施，维持桌面 1440×900 键鼠体验与显式确认消费。 |

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
