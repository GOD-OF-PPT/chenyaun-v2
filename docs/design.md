# 《尘缘问道 · 剑阵万象》设计基线（Q3 数值与循环收敛）

本文件记录 Q3（F19–F23）收敛后的核心战斗循环、收益账本、双流派职责、装备词条预算、经济与寿元闭环，以及 D01/D02/D05/D07 保守基线。所有公式与参数均以 `web/public/playable-v2.html` 实际运行逻辑为唯一事实来源。

## 1. 核心体验循环

1. **观察危险与走位**：识别普通招式（金芒可识破）、危招（红危触发太虚凝时）、下段横扫（`Z` 踏剑）与阵眼金身（先碎阵眼柱再逆转天象）。
2. **叠印、切手与破势**：左键四段剑舞叠印 → 连招窗口右键触发当前【六象特技】→ 常态右键【爆剑】引爆剑印破盾削势。
3. **可解释的成长与整备**：在洞府/修行面板核对收益账本、神兵淬火、词条定刻、丹方与寿元预估，主动确认后投入下一卷挑战。

## 2. 收益账本与数值口径（F19）

所有战斗属性统一由 `computeCombatStatLedger(g)` 计算，`getCombatStats(g)` 直接从账本 `totals` 派生，保证公式与修行界面 `<details id="stat-breakdown-details">` 明细同源：

- **三桶攻击管线**：
  1. `flat_atk`（基础剑攻）：境界根基 `14 + r.power × 1.25` + 装备（`GEAR_ENHANCE_STEP_PCT = 0.08` 每阶 +8%，`getGearTotals` / `formatGearStats` / `effectiveGearVal` 统一）+ 永久丹道/奇遇剑攻（受本境 `PERM_GROWTH_CAPS` 约束）+ 命格 + 心法槽 + 本命法宝 + 周天星图 + 天工剑炉。
  2. `passive_pct`（常驻增伤池）：合并道心、法则（聚宝乾坤/岁积道威/红尘共鸣）、套装、天时、奇物与秘境词条，经 `softCapPct(raw, 0.95, 1.65)` 软上限折算（拐点 +95%，极值 +165%）。
  3. `active_mult`（主动/姿态/爆发倍率）：剑势（玄重巨阙式 `1.28×`）、逆转天象（`1.20×`）、法天象地、血雾煞境与万剑冢词缀相乘后硬顶 `1.95×`。
- **生存与副属性边界**：
  - 减伤系数 `drMult = max(0.35, 100 / (100 + dmgReduce))`；单次受击上限 `SINGLE_HIT_CAP_RATIO = 0.45`（45% 最大气血）。
  - 暴击上限 `78%`（`0.78`）；暴伤上限 `235%`（`2.35×`）；攻速区间 `[0.70, 1.85]`。
- **已对齐的文案口径**：统一 `effectiveGearVal`（`0.14` → `0.08`）、`DESTINY_FRUITS`（剑心通明 +2 剑、青莲圣体吐纳 +35%、饕餮丹心 +6攻/+18血、万古长青 +10%暴击/+3%每80石上限+32%）、`SACRED_AFFIXES`（噬灵剑魄每3剑回1.5%血、御风剑意+10%、紫电惊雷42%剑攻）、`GOURD_SOAKS`（金刚玉莲子48%减伤、青鸾御风羽+22%攻速/+15%移速、赤渊龙血藤+18%暴击）、`PERKS`、`PRIMORDIAL_AWAKENINGS.armor`（25%盾/14%触发/11s冷却）、逆转天象（+20%攻/+20%速）、破势易伤（`1.45×`/`1.65×`）、道心谱系与剑势副标。

## 3. 双流派职责、六象提示与演武专项（F20）

| 流派 | 定位 | 专精数值（`getSchoolSpecBonus`） | 典型循环 |
|---|---|---|---|
| **青霜御剑 (`sword`)** | 高频叠印 · 单体破势与爆剑斩杀 | 挥剑攻速 `+10%`、飞剑协同 `+18%`、暴伤 `+8%` | 四段疾剑叠印 → 六象切手 → 高层爆剑破势 |
| **紫霄雷符 (`talisman`)** | 回蓝续航 · 术法剑域与链雷群压 | 回蓝速率 `+25%`、术法/爆剑伤害 `+16%`、终结引紫霄链雷 | 符印附着 → 高频法宝/剑域与爆剑 → 链雷清场 |

- **右键六象联动**：`updateCooldownMasks` 与 `updateTelemetryOverlay` 同步读取 `getCurrentSixAspectSpec()`，切手窗口内显示当前六象简称与 `data-morph-state="morph"` 及倒计时提示，常态回退为 `爆剑(N)` / `爆剑`。
- **演武专项练习（`#dojo-control-bar` + `#dojo-training-hud`）**：
  - `drill_mark_detonate`（叠印爆剑：≥3 层剑印爆剑碎盾 ×3）
  - `drill_dodge_counter`（危招识破：金芒/红危交替完成识破或凝时 ×3）
  - `drill_morph_combo`（连招派生：左键连招窗内右键六象派生 ×3）
- **演武零套利守卫**：通过共享判定 `isSanctumDojoActive()`（`arena.sanctumMode && !(arena.sectDefense && arena.sectDefense.active)`），在 `triggerDashParry`、`triggerSkyJump`、`recallAndDetonateSwords`、`bumpCombo`、`summonAllyCoop`、`useQuickHealingPill`、`damageEnemy`（含斩仙处决与破势成就段）与 `handleEnemyDeath` 中统一校验 `!isPracticeModeActive() && !isSanctumDojoActive()`（同时 `sky_cleave` 守卫 `!other.isDummy`），禁止在和平演武木桩刷取正式灵石、永久丹道属性、破招悬赏计数、击杀掉落或成就，同时保留正式【护山大阵】（`sectDefense.active`）的全部战斗收益。

## 4. 真实规则评测矩阵（F21）

- 评测脚本：`scripts/eval-combat-matrix.mjs`（Node VM 直接加载 `web/public/playable-v2.html` 实机脚本，固定种子 Mulberry32 PRNG，零常驻定时器）。
- 覆盖维度：6 境界（凡人→化神）× 3 档装等（`entry` / `median` / `strong`）× 2 流派（`sword` / `talisman`）× 4 策略（`afk` / `basic_lmb` / `combo_detonate` / `full_school_loop`）× 5 遭遇原型（`mob_pack` / `mixed_squad` / `shielded_elite` / `stage_boss` / `tribulation_pressure`），共 84 组可复现样本。
- 种子 `20261124` 实测摘要：
  - `allGearBudgetOk: true`（全部生成装备 100% 落在预算上限内）；
  - `afkZeroWins: true`（AFK 对照组零胜率，确认防挂机机制有效）；
  - 双流派中位首领战表现接近（完美贴身机器人输入下 `sword` 中位 `2.58s` vs `talisman` 中位 `2.53s`，重击可承受下限 `2.34` 次；注：无头评测驱动为 20Hz 零延迟理想输入，真人 1440×900 走位/读招实际耗时显著更长，需与浏览器实测交叉参考）。

## 5. 装备词条预算、保底与定向获取（F22）

- **加权词条预算（`GEAR_BUDGET_BY_RARITY` + `GEAR_STAT_WEIGHTS`）**：
  - 权重：`atk×3.0`、`hp×0.4`、`dr×5.0`、`crit×240`、`spd×180`、`bonusSword×85`、`affix×45`。
  - 品阶 0–5 分别限定 `maxBudget`（`160 / 260 / 420 / 620 / 860 / 1180`）与单项属性上限 `statCaps`，防止新生成神兵突破暴击/攻速极端阈值。
- **确定性保底与定向刻录**：
  - 保留 4 件保底紫品 / 8 件保底仙品（`ensureDeterministicPity`）与弱槽倾向（`pickBalancedGearSlot`）。
  - `openAffixEngraveModal`（35 灵石 100% 确定刻录）展示流派推荐标签（`御剑推荐` / `雷符推荐` / `生存推荐`），并高亮当前流派优先词条。
- **D05 旧档资产保护**：预算钳位**仅**作用于 `rollGearItem` 新生成的装备；`normalizeLoadedGame` / `normalizeGearItem` 绝不回溯削弱或改写玩家已持有的旧装备。

## 6. 经济与寿元闭环（F23）

- **自动化审计**：`scripts/audit-economy.mjs` 核验全部 16 件 `ITEMS`、300 次跨阶装备滚落及全正魔天象黑市特供：
  - **封堵 `km_demon_core` 套利**：基础定价由 `145` 提至 `220`（丰年天象 `0.8×` 折后 `176`），捆绑武器【魔品·赤渊噬魂剑】保留完整攻击与 `vamp_blade` 词条，但熔炼售价封顶 `floor(spec.cost × 0.45) = 79 < 176`，彻底消除买拆套利。
  - **7 种灵材可达性**：凝气草/灵露/妖核/灵玉/月华莲/凝魂晶/道蕴砂全部具备明确关卡/首领掉落及补购途径；注：结金丹所需 `lotus×1` 可于第三卷首领【寒潭玄蛇】、第四卷小怪或显式补料购得，且按 D01 保持无丹强渡可选路线。
  - **轮回道果点（`metaState.reincarnationPoints`）**：记录于【历世道果殿堂】作为跨世累积指标，按 D05 保留该货币不做删除。
- **7 条耗寿路径操作前预览（`previewLifespanImpact`）**：
  1. 丹方稳炼（词条徽章、悬浮提示与补料确认弹窗 `#alchemy-buy-lifespan-preview`）
  2. 显式批量炼丹（`#batch-craft-lifespan-preview`，保留 `#btn-confirm-batch-craft` 的 `×5` / `15月` 契约）
  3. 八卦太虚丹炉/天工星火锻造（`#taixu-craft-lifespan-preview`，3 月预览）
  4. 传统丹炉控火（`startFurnaceMinigame` 记录 `lifespanPreview` 并于跨阈时预警）
  5. 周天吐纳（`#orb-meditate` 悬浮提示 + `#wave-sub-tag` 标明 `每3秒耗1月寿元`）
  6. 燃血禁丹（行囊格子标注 `⏳-2载` 与跨阈预警）
  7. 天劫筹备与散功避劫（`#trib-prep-lifespan-preview` 12月/18月预估 + `#trib-abort-lifespan-preview` `18月（1.5载）`）
- **寿元阶梯与首次 75% 说明**：首次跨过 75%（`seenLifespan75Tip`）清晰说明阶梯规则：75% 提醒 → 90% 效率 75% → 95% 效率 50% → 100% 大限效率 25% 且**绝不删档**（可通过延寿青莲丹、破境或主动二次确认兵解转世化解）。

## 7. 设计决策保守基线（D01 / D02 / D05 / D07）

| 决策 | Q3 执行基线 | 回退方式 |
|---|---|---|
| **D01** | 保留炼丹/灵宠/闭关可选路线与无丹强渡，不新增主线硬门槛，不削弱吐纳收益 | 无需数据迁移，纯文案/预览开关可逆 |
| **D02** | 正式模式保留全部已有技能槽与键位；2主动+1奥义槽位试验仅在 `sandboxMode` 内显式切换（退出沙盒自动还原） | 关闭 `sandboxSlotPrototype` 即恢复完整技能栏 |
| **D05** | 校准新装备预算与黑市防套利；保留全部旧资源、旧评级与旧存档已有装备属性不做回溯削弱 | 仅需还原 `GEAR_BUDGET_BY_RARITY` 或 `km_demon_core` 售价封顶 |
| **D07** | 修正已确认的演武套利与文案-实效漂移；保持玩家明确主动的菜单与战斗操作 | 独立函数/常量封装，逐项可回退 |

## 8. 首卷视听打磨与观察式试玩状态（Q4：F24–F29）

Q4 围绕「第一卷破庙→救援→择道→洞府整备→狼王→渡劫」建立完整体验样板（自动化回归 `Q4-1..Q4-5` 已覆盖）：

- **动作与读招对齐（F24）**：统一主角六向动作轮廓、受击/闪避反馈与狼王/石卫蓄势锚点，确保金芒可识破与红危可凝时判定与视觉朝向一致。
- **场景分层与资产质检（F25–F26）**：分层背景视差避让危招前景，支持 `reducedMotion` 冻结视差；`scripts/art-manifest.mjs --check` 强制校验 115 张内联 WebP 二进制尺寸与 5 张受保护 VP8X RGBA 精灵（`item_rough_jade`、`pet_fox`、`pet_roc`、`pet_sword`、`pet_turtle`）。
- **打击反馈、音频层次与首卷整备闭环（F27–F28）**：普通/重击/识破/终结四级声效与帧时间统计接入；破庙择道预览下战收益，洞府整备保留 D01 非强制炼丹指引，渡劫界面呈现天地人三品规则对比与弹反归因，且试玩遥测严格不污染主/元存档。
- **观察式真人试玩（F29）**：当前状态为 **`NOT_RUN`（`0 / 5~8` 名真人新玩家）**。自动化脚本与遥测导出格式已就绪，但不以机器人或脚本替代真人理解度/停顿/死亡归因验收。

## 9. 模块化编辑源与分层测试基线（Q5：F30–F33 · D06 保守基线）

依据 **D06 保守基线**，在严格保持单文件独立发行与历史调试钩子零破坏的前提下完成源产物分离与测试分层：

- **运行资产提取与确定性构建（F30）**：从 `web/public/playable-v2.html` 内联 `const ART` 原样提取全部 115 张 WebP 至 `src/assets/runtime/*.webp` 与无时间戳清单 `src/assets/art-index.json`（保留 5 张 VP8X RGBA 精灵，不改动 `web/public/art/v4/`）。纯 Node ESM 脚本 `scripts/build-playable.mjs` 支持默认构建、`--check` 逐字节校验与 `--out <path>`，并内置单 `<script>`、零外部 CDN、`vm.Script` 语法及 115 张 WebP SHA-256 双向核验。
- **纯配置与规则渐进抽离（F31）**：将无副作用配置与核心数值/经济/存档规则抽离为 9 个可被 Node 原生导入的 `.mjs` 模块（`src/config/*`、`src/rules/*`、`src/state/save-rules.mjs`），构建时剥离顶层 `import`/`export` 并按 2 空格缩进拼入单一运行时 IIFE，保持 `eval-combat-matrix.mjs`、`audit-economy.mjs` 与 `art-manifest.mjs` 结果零漂移。
- **测试分层与兼容门面（F32）**：新增纯 Node `node:test` 单元测试（`tests/unit/*.test.mjs`）、3 项 Q5 浏览器回归套件（`Q5-1..Q5-3`，总回归 `70 → 73`，含 `file://` 与 HTTP 一致性及 Node ESM 与 Chromium 实机交叉校验），并将 `npm run build:check` 与 `npm run test:unit` 接入 `.github/workflows/e2e.yml`。全量保留 `window.__CHENYUAN_V18__` 至 `__CHENYUAN_V25__` 全部 382 项既有接口，仅增补只读委托门面 `window.__CHENYUAN_DEBUG__`（`q5-compat-1`）。
- **非核心扩展边界（F37 · D08）**：按 D08 保守基线，扫荡、移动端适配与自动连升保持 **`DEFERRED`**，不在 Q5 重构中引入。

