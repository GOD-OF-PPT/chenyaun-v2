# 实时战斗打断源审计 + "战斗静默（Combat Calm）"优化设计

> 仓库 `GOD-OF-PPT/chenyaun-v2`，分支 `main` @ `b399c67`（工作树干净）。文件 `web/public/playable-v2.html`（32,235 行）。行号均以该提交为准。本次审计没有修改任何文件。

## 0. 结论速览

1. **没有中央打断管理器。** 现有唯一接近"弹窗队列"的是 `flushDeferredChoiceModals()`（L16890），由它统一调度 G9 背包满、魂印解锁、寿元耗尽和新神通卡。但它的门控只检查"有没有 cutscene/modal/drawer/stageClearPending/tribulation/defeatPending"，**不检查场上是否还有敌人**。所以背包满、魂印、寿元这几类阻塞弹窗会在**混战中立即弹出**。
2. **现成的"安全区"判定已经存在：** `isMeditationSafeZone()`（L18839）。它检查无存活敌对单位、非 waveTransitioning、非天劫、非空战/护山。可以直接改造成 `isCombatCalm()`，作为所有延迟提示的放行条件。
3. **高频打断前三名**（中期，1 分钟约 20–30 杀）：
   - (a) **头顶横幅飘字**：素材拾取约 56%/杀，+ 机制提示 + 处决文字。`addFloat` 的自动横幅判定把"+灵草×2"这类拾取也算成横幅，全部堆在玩家头顶。
   - (b) **仙装拾取**：约 24%/杀。每次触发横幅飘字 + 长 toast + 右下对比卡替换。**背包满时每件都会弹一次阻塞 modal**，并带"后续尚有 N 件"队列。
   - (c) **处决印章**：屏幕中央 36px 大字，持续 1.25s，带顿帧和镜头拉近。
4. **事件链式叠加：** 天劫成功后依次出现 toast、横幅、道果 modal、神通三选一 modal、2 张新神通卡、成就 toast。聚宝金灵在战斗中被击杀时，会**直接弹神通三选一 modal**，而此时场上敌人仍然存活。
5. **没有任何"静音提示/提示密度"设置。** `a11ySettings`（L7159）只有震屏、顿帧、色盲符文、自动连招和减弱动效。唯一能关的是新手教学（`tutorialDismissed`）。
6. **附带发现（与存档规约相关）：** `pendingGearOverflowQueue`（L16624）**不入存档**，刷新会丢失待处置仙装。把它延迟得更久会扩大这个窗口，所以必须一起修。另外，右下对比卡上的「熔炼+X石」按钮（L17008 → L30436）是**一键不可逆消费**。卡片覆盖在战场上并接收指针，混战连点时可能误触，这与"玩家主动选择才消费"的规约冲突。

---

## 1. 通知原语与调用计数

| 原语 | 定义 | 调用数 | 位置/样式 | 时长/堆叠 | 抢焦点 | 暂停 |
|---|---|---|---|---|---|---|
| `showToast(msg)` | L16467 | **279** | `#toast-container` 固定在底部中央，bottom 90px（有交互提示时 164px，对白条打开时 214/356px），z 95，胶囊 13px 粗体（CSS L365–374） | 1.95s；**最多同时 2 条**，超出时移除最旧一条；**无去重、无优先级、无限流** | 否（pointer-events none） | 否 |
| `addFloat(text,x,y,color,size,isCrit)` | L16490 | **195** | canvas 世界坐标。**自动横幅判定**：`size>=15 && text.length>=5 && 非数字开头` 时视为横幅，**强制放到玩家头顶 -76px**，最多 3 条叠加（每条把前一条上推 28px）。上限 26 条 | 横幅 1.42s / 暴击 1.05s / 普通 0.84s | 否 | 否 |
| `showBossCutIn(art,name,mech)` | L16479 | 15（含定义） | `#boss-cutin-banner` 固定在顶部中央，top 126px（有 titan HUD 时 164/230px），z 60，带头像和两行文案（CSS L525–534） | 2.5s，后一次覆盖前一次 | 否 | 否 |
| `triggerKillCamStamp(label)` | L6078 | 15 | `#execution-stamp-overlay` 位于 top 42% 屏幕正中，36px 字号、10px 字距的红色大印（CSS L888–902）。附带 `hitStop 0.085`、`camZoom 1.11` | 1.25s | 否 | 顿帧 |
| `showRegionCinemaCard(key)` | L6066 | 3 | `#region-cinema-card` 位于顶部 58px，24px 诗题 | 2.3s | 否 | 否 |
| `showRelicDharmaToast(txt)` | L6242 | 2 | `#relic-dharma-toast` 位于顶部 122px，18px | 2.1s | 否 | 否 |
| `openModal(html, closeable, {kind})` | L27570 | 48 + 约 25 个 `open*Modal` 包装 | `#modal-backdrop` 全屏遮罩 | 必须关闭 | **是**（`focusDialogSafely` + Tab 陷阱，L29406–29428，屏蔽全部全局快捷键） | **是**（L27611 `arena.paused=true`；同时 `clearTransientInputs()` 清空按住的 WASD/鼠标，关闭后需要重新按键） |
| `playCustomDialogueLines / playCutscene` | L6691 / L6713 | 7 / 9 | `#story-dialogue-bar` 底部 94px，宽 760px（CSS L557） | 必须点"继续/跳过"，或按 Space/Enter/Esc | **是**（L6893–6902 聚焦按钮，L29381 拦截全部按键） | **是**（L6709；`stepArena` 在 L22599 检查 `cutscene.active` 后直接 return） |
| 新神通卡 `renderActiveUnlockCard` | L16763 | 由队列驱动 | `#new-unlock-card` 底部中央，bottom 104/156px，宽 560px，z 58，**pointer-events auto**（CSS L2723–2768） | **常驻**，直到点「知道了」/「立即试用」或按 Esc（L29488） | 否 | 否 |
| 仙装对比卡 `renderGearCompareCard` | L16951 | 由拾取驱动 | `#gear-compare-card` 右下 right 76px、bottom 102px，宽 352px，z 60，**pointer-events auto**（CSS L2701–2721） | **常驻**，新拾取会替换内容 | 否 | 否 |
| 新手教练条 `renderOnboardingCoach` | L18747 | — | `#onboarding-coach-bar` 底部中央 102px，宽 640px | 常驻，直到 4 步完成或跳过 | 否 | 否 |
| 交互提示 `renderPropInteractHud` | L23997 | — | `#prop-interact-hud` 底部中央 100px | 靠近道具时出现 | 否 | 否 |
| `#combo-rank-seal` | L26920 | 每帧 | 右上 top 74px、right 74px | 连击≥2 时出现 | 否 | 否 |

> 注意**底部中央 90–160px 这一带**：toast、新神通卡、教练条、交互提示、对白条全部挤在这里，紧贴技能坞上方，而这正是玩家余光看技能 CD 的区域。

### `showToast` 调用的热点函数（按函数聚合）
- 第 29351 行之后的输入/点击总派发器（awk 统计时归到 `isTypingTarget` 名下）有 118 处，**基本都是玩家主动操作的反馈**，不算打断。
- **在战斗循环内自动触发的 toast**：`handleEnemyDeath` 4 处、`acquireGearItem` 3 处、`advanceLifespanMonths` 3 处、`completeLiveTribulation` 3 处、`startLiveTribulation` 3 处、`gainRealmXp` 1 处、`unlockAchievement` 1 处（22 个调用点）、`advanceOnboardingStep` 2 处、`spawnMapExitGateAndBoon` 1 处、`consumePlayerMp` 1 处（每次蓝不够都会弹）、`guardActionRealm` 1 处（每次按未解锁技能都会弹）、`saveGame` 2 处（写入失败）、`stepSectDefenseSiege` 2 处。

### `addFloat` 热点
`stepArena` 22 处、`damageEnemy` 19 处、`fireManualSlash` 10 处、`castPetUltimate` 7 处……其中**会被判定为头顶横幅**的战斗内高频项：
- L23850 素材拾取 `+灵草 ×2`（size 15，以"+汉字"开头，不匹配数字正则，所以**算横幅**），约 56%/杀
- L23865 灵气精魄、L23857 天工神髓
- L17020 / L17027 仙装拾取（size 16–18）
- L22049–22089 四种处决（size 24–25）
- L23581 / 23596 / 23625 / 23628 / 23632 / 23647 Boss 危招提示（size 14–17）
- L22226 Boss 二阶段、L22268 / 22273 破势
- L21931 / 21937 / 21961 / 22004 金阵与心魔
- L22328 星夜掉落、L22383 聚宝金灵

---

## 2. 战斗中打断源完整清单

分类：**A** = 阻塞 modal，暂停 arena；**B** = 不暂停，但抢焦点、吞键或遮挡战场/拦截点击；**C** = 非阻塞 toast/横幅/飘字。

### 2.1 A 类：阻塞并暂停

| # | 来源（函数 @ 行） | 战斗内触发条件 | 门控现状 | 键鼠 | 叠加/排队 | 评估 |
|---|---|---|---|---|---|---|
| A1 | **G9 背包满** `openGearBagFullModal` @16686，由 `acquireGearItem` @17031–17037 → `flushDeferredChoiceModals` @16898 调用 | 背包 24/24 时**拾取任何仙装**（掉落约 24%/杀、Boss 必掉、精英必掉、原石必掉） | 只检查 modal/cutscene，**不检查敌人**，混战中立即弹出。modal `closeable=false`，Esc 无效 | 焦点进 modal，WASD/J/K/技能全部被吞，按住的方向键被清空 | 队列 `pendingGearOverflowQueue`，**一件一个 modal**，标题显示"后续尚有 N 件"。**队列不入存档** | **最严重** |
| A2 | **魂印解锁抉择** `openSoulSealUnlockChoiceModal` @28673，由 `handleEnemyDeath` @22339–22345 调用 | 首次击杀 warden/serpent/puppet/sentinel/trial_gate/shadow/心魔类 Boss | 主线最终 Boss 会先置 `stageClearPending=true`（@22336），所以已经延迟到卷末总结之后（正确）。但**锁妖塔、Boss 连战、非终局节点的 Boss**击杀后，场上仍有小怪也会立即弹出 | 同上，closeable，Esc 等于保留当前 | 队列 `pendingSoulUnlockQueue` | 高 |
| A3 | **聚宝金灵神通三选一** `openIconicUpgradeDraft("聚宝奇缘 · 获赐神通")`，由 `handleEnemyDeath` @22397 调用 | 击杀 `isTreasure` 金灵。`elemental_vault` 房间会**与敌群同时刷出**（@19951–19952），所以通常在战斗中被打死 | **无任何门控**，只有天劫/cutscene/modal 时才改为直接发放法则（@22384） | 同上 | 关闭后 → 新神通卡、羁绊 toast（@31292） | 高 |
| A4 | **寿元耗尽（大限）** `openLifespanExhaustedModal` @17208，由 `advanceLifespanMonths` @17201–17203 → flush 调用 | 战中吐纳（B 键）每 3s 消耗 1 个月（@22823–22828），寿元比例≥1 时触发 | flush 不检查敌人，**战中吐纳时会立即弹出** | 同上 | 单例标志 | 中（低频，但必须明确） |
| A5 | **天劫成功 → 道果 modal → 神通 modal** `completeLiveTribulation` @21583 → `openDestinyFruitModal` @21661 → 选择后 `openIconicUpgradeDraft` @31499 | 玩家主动渡劫（B 预备 modal → 确认）。`startLiveTribulation` @21510 **不要求清场**，劫雷结束时场上可能仍有敌人（@21657 只造成 2.6 倍攻击伤害，不保证击杀） | 无门控 | 同上 | 两个 modal 串联，之后还会排入 2 张新神通卡（@21658） | 中（玩家发起，但链条太长） |
| A6 | **剧情过场**：`enter_sect / enter_secret / enter_sword_mound / enter_terrace`，在 `initArenaStage` @19232–19237 中由 `playCutscene` 触发 | 首次进入第 2–5 卷时。**先 `spawnCurrentWave()` 刷出敌人，再播放对白** | 只播一次（`seenCutscenes`） | 对白条拦截全部按键（@29381） | `cutscene.active` 单例 | 低（开战前） |
| A7 | **Boss 前过场** `boss_pre_stage{n}`，在 `spawnCurrentWave` @19916–19921 | Boss 房：**先 `spawnSingleEnemy` 再播放对白** | 只播一次 | 同上 | — | 低（属于 P0 叙事节点） |
| A8 | **卷末过场 + 卷末总结卡** `clear_stage{n}`（@19827）→ `openVolumeEndRecapModal` @19587 | 卷 Boss 被击杀、waveIdx>4 | 此时已经清场，**是天然的结算时刻** | — | `pendingVolumeRecapOnDismiss` | 合理 |
| A9 | **序章救援过场** `prologue_rescue`（@22540） | 序章 3 狼被清空 | 已清场 | — | — | 合理 |
| A10 | **败北抉择** `openDefeatDecisionModal` @24185，来自 `hurtPlayer` @24421、天劫失败 @23449 | HP≤0 | — | — | — | **P0，必须保留** |
| A11 | **存档冲突** `openSaveConflictModal` @16099，由 `saveGame` @16188 → `triggerSaveConflict(res,true)` @16151 调用 | **`saveGame` 每次击杀都会调用**（@22576），其他标签页写入后，下一次击杀立即弹出（不可关闭） | 无门控 | 同上 | — | P0（数据安全，写入已暂停） |
| A12 | 塔/连战/登仙台的波次结算：`openSpireCurioDraftModal`（@22470）、`openBossRushVictoryModal`（@22481）、`completeSpirePracticeFloor`（@10866） | 本层敌人清空后 420–450ms | 已清场 | — | — | 合理 |
| A13 | **数字键/字母键直开 modal**：7 连招编排、8 远征、9 星图、N 周天星图、M 世界图、T 目标、L 登仙台（keydown @29516–29549） | 玩家按键。**1–6 是技能键，7/8 紧挨着**，容易误触 | 不检查战斗 | 同上 | — | 自伤型打断，建议在战斗中二次确认或屏蔽 |
| A14 | 玩家走到道具旁按 Enter：奇遇碑 `openEncounterModal`（可能转成因果抉择 `openKarmaDilemmaModal`，@24066/@21779）、道韵玉简 `openRunBoonDraftModal`（@24171）、商人、丹鼎、阵门等 | 玩家主动 | 道具只在清场后的事件房出现 | — | — | 合理（主动） |

> 宠物 3/5 级技能抉择 `openPetSkillChoiceModal`（@17359）只能通过修行抽屉里的喂养触发（@31754–31762），**不在战斗中弹出**。远征报告、宗门悬赏领取、主线奖励领取（`claimMainlineStepReward` @18322）也都是玩家在抽屉/modal 里主动点击，**不属于战斗打断**。

### 2.2 B 类：不暂停，但遮挡或拦截

| # | 来源 | 触发 | 位置/尺寸 | 问题 |
|---|---|---|---|---|
| B1 | **仙装对比卡** `renderGearCompareCard` @16951，由 `acquireGearItem` @17025 触发 | 背包未满时拾取仙装（约 24%/杀） | 右下 352px 宽，约 150px 高，**接收指针** | 常驻遮挡右下战场。按钮"一键换装 / 熔炼+X石"**一键不可逆**（@30436），连点攻击时可能误触 |
| B2 | **新神通卡** `renderActiveUnlockCard` @16763，经 `flushNewUnlockCard` @16810 | 每次破境排入 2 张（arts/eco，共 11 张）；**读档时** `queueNewUnlockCardsForState`（@30015）会补排未看过的卡；选完神通/宠物后也会排（@31284） | 底部中央 560px 宽，接收指针 | flush **不检查敌人**，开战即出现，并且常驻，遮挡技能坞上方 |
| B3 | 新手教练条 | 序章至炼气前 | 底部中央 640px | 带"跳过"按钮，属于教学性质，可以接受 |
| B4 | 交互提示条 | 靠近道具 | 底部中央 | 会把 toast 顶到 164px |
| B5 | 处决印章 / 顿帧 | 破势眩晕 + 重劈处决（@22014 起） | 屏幕正中 36px | 遮挡视线 1.25s。属于爽点反馈，但频率偏高 |

### 2.3 C 类：toast/横幅/飘字（战斗内自动触发）

| # | 函数 @ 行 | 触发 | 形式 | 频率估计（中期 1 分钟） |
|---|---|---|---|---|
| C1 | `stepArena` 拾取 @23850 | 素材掉落（约 56%/杀，Boss 全掉） | 头顶横幅（误判） | **约 12–18 次** |
| C2 | `acquireGearItem` @17020/17021、@17027/17029、@17035 | 仙装拾取 | **飘字 + 长 toast 双发**（文案重复，toast 长达约 40 字） | **约 5–7 次** |
| C3 | `damageEnemy` 处决 @22046–22089 | 眩晕 + 重击 | 横幅 + 印章 | 约 2–6 次 |
| C4 | Boss 危招提示 @23581/23596/23625/23628/23632 | 每次蓄力 | 横幅 | Boss 战每 3–5s 一次（**有教学价值，保留**） |
| C5 | `showBossCutIn` | Boss 登场 / 二阶段 @22223 / 塔层 @19754 / 天劫 @21577 / 大招（三清、山河、仙舟、法天象地 @13266/13340/13543/11273） | 顶部横幅 2.5s | Boss 战 2 次。**玩家每放一次大招也会弹一次**，偏多 |
| C6 | `unlockAchievement` @16458（22 个调用点） | 连击 5（`bumpCombo` @16569）、破势 @22245/20857、开石 @23000/23137、塔层、法则 5、卷首通关 @19786…… | fanfare 音效 + toast | 一次性，但**前期集中出现** |
| C7 | `advanceOnboardingStep` @18787/18790 | 挥 3 剑（@20201）、爆剑（@20665/20759）…… | toast（与教练条重复） | 前期 |
| C8 | `gainRealmXp` @16590–16596 | 修为满 | fanfare + 涟漪 + toast | 每个境界一次 |
| C9 | `advanceLifespanMonths` @17193–17198 | 寿元跨过 75/90/95% | toast | 罕见 |
| C10 | `handleEnemyDeath` @22341 | 魂印解锁 | toast（随后弹 A2） | 罕见 |
| C11 | `spawnMapExitGateAndBoon` @19405 | 房间清空 | toast "第 X/5 层已清……" | 每个房间一次（**结算时刻，合理**） |
| C12 | `consumePlayerMp` @14365 / `guardActionRealm` @14355 / 仙葫空 @21156 / 宠物未缔结 @21064 | 每次按键失败 | toast + 飘字 | **按键连发时刷屏**，无限流 |
| C13 | `saveGame` 写入失败 @16185/16246 | 每次击杀都会尝试保存 | toast | 出错时每杀一次（需要保留，但应去重） |
| C14 | `startLiveTribulation` / `completeLiveTribulation` | 渡劫 | toast + 横幅 + 切入横幅三重 | 每个境界一次 |
| C15 | `applyPickedRunBoon` @19371/19372 | 选道韵（已清场） | 飘字 + toast 重复 | 每个房间 |
| C16 | `showRegionCinemaCard` @19206 | 每次进入关卡 | 顶部诗卡 2.3s | 每关一次（可以接受） |
| C17 | 卷末/塔层 toast @22490/22511 | 波次清空 | toast | 结算时刻 |

**1 分钟典型战斗的打断量估算**（中期，约 25 杀，无 Boss）：头顶横幅约 20–30 条（素材 15 + 仙装 6 + 处决 4 + 杂项），toast 约 8–12 条（仙装 6 + 成就/失败提示），对比卡替换约 6 次。**背包满时额外约 6 个阻塞 modal**（每次 1–3s 操作，打断约 6 次）。如果此前刚破境或读档，开场还会额外出现 1–2 张常驻新神通卡。

---

## 3. 现有"排队/静默"相关机制

- **没有** interrupt manager、notice bus、inbox，也没有 combat calm 状态。
- **部分队列**（L16623–16657）：`pendingGearOverflowQueue`、`pendingSoulUnlockQueue`、`pendingLifespanExhaustedPrompt`、`pendingUnlockCardQueue`、`pendingVolumeRecapOnDismiss`，由 `flushDeferredChoiceModals()`（L16890）按 背包 → 魂印 → 寿元 → 神通卡 的顺序放行。`openModal`（L27577–27591）在别的 modal 抢占时会把 active 项塞回队首。
- flush 的调用点：`closeModal` @27656、`closeDrawer` @27696、过场结束 @6856、`queueNewUnlockCardsForState` @16806、以及即时调用 @16934 / 17037 / 17203 / 22345。**没有任何调用点挂在"清场"边沿上**。
- **现成的安全区判定**：`isMeditationSafeZone()` @18839，已被掉落磁吸 `getDropMagnetParams` @18851 使用。
- **现成的 journal**：`game.journal`（例如 @19794、@21652、@6806 的 `unshift`）可以作为收件箱的持久载体。
- **现成的红点**：`updateNavNotificationBadges()` @27050（badge-story/cultivate/alchemy）。
- **设置**：`a11ySettings` @7159（震屏、顿帧、色盲、自动连招、减弱动效），设置面板 @29005 起。**没有提示密度选项。**

### `arena.paused` 写入者（共 41 处）
- **置 true**：
  - openAffixEngraveModal 6397、playCustomDialogueLines 6709、openKarmaDilemmaModal 7883、togglePhotoMode 7994
  - openStarChartModal 8673、openBossRushModal 9172、openCelestialSpireModal 10670、completeSpirePracticeFloor 10866、openSpireCurioDraftModal 10907
  - openCustomWorkshopModal 11734、openTaixuCraftMinigameModal 12408、openComicBattleScrollModal 12880、openComboSequencerModal 13108、openExpeditionSandboxModal 13554、openBossRushVictoryModal 14151
  - openSanctumUpgradeModal 17476、openCompanionInteractModal 17568、openAscensionRoadmapModal 17972、openHallOfLivesModal 18038、openObjectivesModal 18407、openRunBoonDraftModal 19323
  - openTribulationPrepModal 21387/21439、openDestinyFruitModal 21683、openWorldMapModal 21717、openEncounterModal 21788、openIconicUpgradeDraft 21833
  - openDefeatDecisionModal 24187、**openModal 27611（总入口）**、toggleDrawer 27673
- **恢复**：
  - renderCutsceneStep 6846（drawer‖modal）、togglePhotoMode 8005、resetStageTransitionState 16678
  - startLiveTribulation 21545（=false）、openIconicUpgradeDraft 21870（=drawerOpen）
  - resolveDefeatChoice 24289/24316/24344/24361（=false）
  - **closeModal 27639**（=drawerOpen‖cutscene.active）、closeDrawer 27687（=cutscene‖modal）
- 读取方：`stepArena` @22599（paused 时整帧 return）、keydown @29493（paused 时屏蔽战斗键）、BGM interval @31788。
- 风险：`paused` 是单一布尔值，多处直接赋 `false`（例如 21545、24289…），**没有引用计数**，叠加 modal 时可能被提前解除。建议引入 `pauseReasons:Set` 并派生 `paused`（见 §5 第 9 项）。

---

## 4. 打断优先级模型

| 层级 | 定义 | 战斗中表现 | 放行时机 |
|---|---|---|---|
| **P0 立即阻塞** | 死亡/失败、数据安全、首次叙事锚点（Boss 前、卷末）、终局 | 立即暂停并抢焦点（保持现状） | 立即 |
| **P1 延迟到结算** | 需要玩家抉择或确认、但不影响当下生存的事项 | 战斗中**只记账**：HUD 角标"待处置 N"脉冲（不抢焦点、不暂停），不弹 modal/卡片 | `isCombatCalm()` 由 false 变 true 之后宽限约 0.8s；或进入洞府、交互阵门前；或玩家点击角标主动打开 |
| **P2 收纳到侧栏收件箱** | 信息性通知（获得、成就、阈值） | 战斗中不弹 toast：写入 `combatInbox` 并给角标 +1。如果只是"小数字"，最多保留一个非横幅小飘字 | 清场时弹**一条汇总 toast**（"本波：仙装×3 · 成就×1 · 灵草×7 ▸查看"），明细进 journal/收件箱面板 |
| **P3 丢弃或降级** | 与其他反馈重复的文案；按键失败连发 | 去重或限流（同 key 4s 内只出现一次），或直接删除 | — |

### 来源 → 层级映射

| 来源 | 层级 | 处理 |
|---|---|---|
| A10 败北抉择、天劫失败 | **P0** | 保持 |
| A11 存档冲突 | **P0** | 保持立即弹出（写入已暂停，继续战斗只会扩大损失）。为满足 AGENTS"读取失败须明确显示"，同时保留 HUD 警示 |
| A7 boss_pre_stage、A8 卷末过场与总结、A9 序章过场、结局 | **P0** | 保持。**A7 改为先播过场、`onFinish` 里再 `spawnSingleEnemy`** |
| A6 enter_* 过场 | **P0（调整顺序）** | 改为先播过场、onFinish 里再 `spawnCurrentWave()`，避免对白期间场上已有敌人 |
| A1 背包满 | **P1** | 战斗中只入队并显示角标"行囊满·待处置 N"，清场后再弹 modal。**队列必须持久化**到 `game.pendingLoot` |
| A2 魂印解锁 | **P1** | 统一走 calm 放行（主线终局已经正确，塔/连战补齐） |
| A3 聚宝金灵 | **P1** | 不立即弹出：改为在金灵位置生成一个可交互的"奇缘玉简"道具（复用 `boon_stele` 模式，点击/Enter 时再 `openIconicUpgradeDraft`），或者进入 `pendingDraftQueue` 等到清场后弹出 |
| A4 寿元耗尽 | **P1** | calm 放行。战斗中把寿元条标红闪烁（HUD 已有寿元显示） |
| A5 天劫后道果/神通 | **P1** | 劫雷结束时如果仍有敌人，入队等清场。另外可以考虑 `startLiveTribulation` 要求 `isMeditationSafeZone()` |
| B2 新神通卡 | **P1** | flush 时加 calm 门控。读档时排入的卡等到首次清场后再展示 |
| B1 仙装对比卡 | **P1** | 战斗中隐藏（`body.combat-hot #gear-compare-card{display:none}`），清场后显示。按钮"熔炼"加二次确认，或改为长按 |
| C2 仙装拾取 toast | **P2**（toast）/ 保留短飘字 | 删除长 toast，飘字缩短为"✦【名】"，size 改为 14（不触发横幅） |
| C1 素材拾取横幅 | **P2/P3** | size 15 改为 13（非横幅），或在 1.5s 窗口内合并为"+灵草×3"。明细进波次汇总 |
| C6 成就 | **P2** | 战斗中静音 fanfare 并入箱，清场时汇总 |
| C7 新手进阶 toast | **P3** | 删除（教练条已经显示）；第 4 步"教学圆满"保留到清场 |
| C8 修为圆满 | **P2** | 改为 HUD"渡劫"按钮金光脉冲；toast 推迟到清场 |
| C9 寿元阈值 | **P2** | HUD 寿元条变色 + 入箱 |
| C10 魂印 toast | **P2** | 入箱（随后由 P1 modal 告知） |
| C12 蓝不足/未解锁/仙葫空 | **P3 限流** | 同 key 4s 内只出现一次；蓝不足只保留飘字 |
| C13 存档写入失败 | P0 信息 + **P3 去重** | 只在第一次失败时 toast，后续靠 HUD 警示常驻 |
| C3 处决印章 | 保留（C） | 同一印章 3s 内最多一次。提供密度设置（极简档关闭印章文字，仅保留顿帧） |
| C4 Boss 危招横幅 | 保留（C） | 教学关键，保持 |
| C5 大招切入横幅 | P3 降级 | 玩家自己放的大招，**首次显示，之后不再显示**（或只显示 0.9s） |
| C11/C17 层清 toast | 保留 | 本身就是结算时刻 |
| C14 渡劫 toast+横幅+切入 | P3 去重 | 保留切入横幅 + 一条横幅，toast 推迟 |
| C15 道韵飘字+toast | P3 | 只保留一个 |
| A13 数字键直开 modal | P1 防误触 | 战斗中（`!isCombatCalm()`）按 7/8/9/N/M/T/L：第一次只 toast"再按一次打开 ××（战斗中）"，或改为屏蔽 |

---

## 5. 实施落点（按改动顺序）

1. **`isCombatCalm()`**：新增在 `isMeditationSafeZone` 旁（L18839）。
   ```js
   function isCombatCalm() {
     return !!game && isMeditationSafeZone() && !arena.defeatPending && !cutscene.active
       && !(arena.bossRush && arena.bossRush.active && arena.waveTransitioning);
   }
   ```
2. **静默边沿检测**：在 `stepArena`（L22593）敌人更新之后、浮字循环之前加入。
   ```js
   const calm = isCombatCalm();
   if (calm) { arena.calmT = (arena.calmT || 0) + dt; } else { arena.calmT = 0; }
   document.body.classList.toggle("combat-hot", !calm);
   if (calm && arena.calmT >= 0.8 && !arena.calmFlushed) { arena.calmFlushed = true; flushCombatCalmQueue(); }
   if (!calm) arena.calmFlushed = false;
   ```
   注意：`stepArena` 在 paused 时会 return（L22599），所以边沿检测要放在 return 之后。线性波次之间只有 650ms 的 `waveTransitioning`（@22565–22572），此时不算 calm，这是预期行为。dungeonMap 房间清空后会持续 calm，直到玩家走进阵门。
3. **`flushCombatCalmQueue()`**（新增，放在 L16890 附近）：依次执行 ① 弹出收件箱汇总 toast；② `flushDeferredChoiceModals()`；③ `renderGearCompareCard()`；④ 弹出 `pendingDraftQueue`。
4. **门控现有 flush**：在 `flushDeferredChoiceModals`（L16894 条件里）和 `flushNewUnlockCard`（L16818）中加入 `|| !isCombatCalm()` 时 return（沙盒和练习模式可以豁免）。玩家点击 HUD 角标时，用强制参数 `flushDeferredChoiceModals({force:true})` 放行。
5. **G9 背包满**：
   - `acquireGearItem` L17031–17037：把即时 flush 改为 `if (isCombatCalm()) flushDeferredChoiceModals(); else bumpPendingBadge();`。
   - `equipGearWithOptionalTransfer` L16933–16934 同样处理。
   - **持久化**：把队列写入 `game.pendingLoot`，在 `saveGame` 的 payload（L16206–16212，`game` 已包含其中）里保存，加载时恢复，避免刷新丢件。属于存档改动，需要覆盖开局、旧档、刷新、写入失败和多标签页的验证。
6. **魂印**：`handleEnemyDeath` L22341–22345，toast 改为 `notify(...,{tier:2})`，删除即时 flush。
7. **聚宝金灵**：`handleEnemyDeath` L22384–22398，用 `arena.props.push({kind:"boon_stele"…})` 的变体 `kind:"fortune_slip"` 替换 `openIconicUpgradeDraft`，并在 `interactWithProp`（L24034）和 `INTERACTIVE_PROP_KINDS`（L23873）里注册。或者进入 `pendingDraftQueue`。
8. **天劫链**：`completeLiveTribulation` L21658–21661，如果 `!isCombatCalm()`，就 `pendingDraftQueue.push({type:"destiny_fruit", isHeaven})` 后 return。可选：`startLiveTribulation` L21510 在 `!isMeditationSafeZone()` 时提示"清场后方可引劫"。
9. **暂停引用计数**（可选，但能降低回归风险）：引入 `pauseReasons = new Set()`，`openModal` / `toggleDrawer` / `playCustomDialogueLines` / `openDefeatDecisionModal` / `togglePhotoMode` 中 add，对应关闭处 delete，然后令 `arena.paused = pauseReasons.size > 0`。替换 §3 列出的 41 处直接赋值。
10. **通知总线**：给 `showToast`（L16467）增加第二个参数 `opts={tier, key, ttl}`。
    - `tier>=2 && !isCombatCalm()` 时 → `combatInbox.push({msg, ts})`，更新角标后 return。
    - `key` 去重：`lastToastAt[key]` 在 4s 内则 return。
    - `tier===3` 时在战斗中直接 return。
    - 不传 opts 的旧调用（279 处）行为不变，**只需改 §2.3 列出的约 25 个战斗内调用点**。
11. **飘字横幅判定**：`addFloat` L16491 增加显式参数 `opts.banner`。自动判定保留，但对 L23850 素材拾取、L17027 仙装拾取改为传 size 13–14 或 `banner:false`；新增 1.5s 窗口内的拾取合并（`arena.pickupAgg[kind] += n`）。
12. **大招切入横幅**：在 `showBossCutIn` 的大招调用点（L13266/13340/13543/11273）加上 `if (game.seenCutIns?.[key]) return;`（首次后不再显示）。
13. **收件箱 UI**：在顶部右侧导航加一个"✉ 战报 N"角标，可复用 `updateNavNotificationBadges` L27050 的样式。点击后打开 modal，列出 `combatInbox` 加最近的 `game.journal`。清场汇总 toast 可点击跳转。
14. **设置**：`a11ySettings` L7159 增加 `combatNoticeLevel: "full"|"lite"|"minimal"`，沿用 `applySanitizedA11ySettings` 的持久化和校验，并在设置面板 L29005 后加一行。档位含义：
    - full：现状
    - lite：默认，即 P2 收箱、P3 丢弃
    - minimal：再关闭处决印章文字、大招切入和素材飘字
15. **防误触**：keydown L29531–29549 的 Digit7/8/9/N/M/T/L 分支加上 `if (!isCombatCalm() && !confirmArm(code)) { showToast("战斗中 · 再按一次打开…",{key:"arm"+code}); return; }`。对比卡的熔炼按钮（L17008）改为二次确认。

### 验证要点（按 AGENTS.md）
- 用 1440×900 Chromium，通过静态 HTTP 打开 `web/public/playable-v2.html`，每个用例使用独立的浏览器上下文。
- 背包 24/24 在混战中连续拾取 3 件：期望 arena 不暂停、角标显示 3，清场 0.8s 后才依次弹出 3 个 modal，焦点进入 modal，关闭后焦点返回。
- 背包满时刷新：待处置件不丢（持久化后）。另外覆盖旧档续玩、写入失败、多标签页竞争。
- `elemental_vault` 房间在战斗中击杀金灵：不弹 modal；玉简道具出现，按 Enter 后才弹出。
- 锁妖塔击杀魂印 Boss、小怪仍在：不弹出，清场后弹出。
- 破境后读档续玩：新神通卡在首次清场后才出现。
- 战中吐纳到寿元耗尽：清场后才弹大限 modal。
- 存档冲突：仍然立即弹出（P0）。
- 键鼠回归：WASD/J/K/Space/技能在战斗中不再被任何 P1/P2 项吞掉。Esc 仍可关闭神通卡。
