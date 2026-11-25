# E2E Acceptance Suite Ready (`TEST_READY.md`)

- **Restored In**: `codex/q0-infra-and-tests` (F04, extracted read-only from `origin/codex/e2e-suite` @ `34f6dd52` and statically audited against M2–M6 `web/public/playable-v2.html`)
- **Latest Full-Pass Verification**: `main` @ `1742ffcdcfef470aa5430d9510d86a568c8d8ef4` (M7b PR #34 `21602e58` + post-audit surgical hotfixes PR #35 `d4db3ba4` [`E2E-T5-09` Stage 0 wolf-combat setup stabilization, `+2/-0`] & PR #36 `1742ffcd` [`src/runtime/combat-step.js` `arena.enemies.slice()` snapshot iteration & callback membership guards preventing prop-shatter/companion-AoE splice-under-iteration crash + 12 permanent multi-kill assertions in `E2E-T5-08` raising `E2E_T5_ASSERTS` from `422` to `434`], deterministic rebuild `web/public/playable-v2.html` `8758135 bytes` / `sha256=0401b19cdfb1`, GitHub Actions post-merge `main` push CI Run `45521068688` **16/16 steps SUCCESS**: `build:check` PASS, `43/43` unit PASS, `art:manifest:check` PASS, `91/91` regression PASS, `70/70` Tier 1–5 E2E PASS, `0` runtime errors; independent Victory Audit #2 **`VICTORY CONFIRMED`**)
- **Runner Command**: `npm ci && npm run build:check && npm run test:unit && npm run test:e2e`
- **Scoped Runs**:
  - Single tier: `npm run test:e2e -- --tier 1` (supports `1`, `2`, `3`, `4`, `5`, comma-separated e.g. `1,2`, or `all`)
  - Filtered run: `npm run test:e2e -- --filter <substring|/regex/i>`
  - JSON report: `npm run test:e2e -- --report <file>`
- **Environment**: Built-in cached static HTTP server (`web/public`, `127.0.0.1` ephemeral port), `1440×900` desktop Chromium/Chrome (`CHROMIUM_PATH` fallback `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`), fresh isolated `BrowserContext` per test, strict `0` `console.error` / `pageerror` gate.
- **Current Verification Status (`main` @ `1742ffcd` — 100% PASS, Victory Audit #2 `VICTORY CONFIRMED`)**: Full 1440×900 Playwright Chromium automated verification completed on final merged `main` (`1742ffcdcfef470aa5430d9510d86a568c8d8ef4`, GitHub Actions Run `45521068688`, `16/16` steps `SUCCESS`): **`npm run build:check` PASS** (`8758135 bytes, 115 WebP assets, 11 ESM modules, 16 runtime modules, sha256=0401b19cdfb1`), **43/43 Pure Node Unit Tests PASS (0 FAIL)** across 9 files, **91/91 Regression Suites PASS (0 FAIL, 0 ERROR, 0 SKIPPED, 0 runtime errors, `364634ms`)**, and **70/70 Combined E2E PASS (0 FAIL, 0 runtime errors, `254624ms`)** across Tiers 1–5 (including `E2E-T5-08` `5337ms` & `E2E-T5-09` `9445ms`; `vm.Script` inline JS compile `scripts=1 chars=8423063`, single `arena.paused =` writer at `src/runtime/scheduler-rewards.js:372` / `web/public/playable-v2.html:21441`, `art:manifest:check`, `audit-economy.mjs --seed 20261124` 0 violations / `d05Compliant: true`, `eval-combat-matrix.mjs --seed 20261124` 84 scenarios / 0 outliers, 33 `.mjs` `node --check`, byte-for-byte immutability of all 81 upstream regression suites `L4..L12405` [`54b73be5...`] & tail [`a681001f...`] and all 56 Tier 1–4 E2E tests, `T5` assertion count `666`, `E2E-T5` assertion count `434`, and `15/15` CLI guards PASS). Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was run; static HTTP end-user verification is fulfilled by the automated 1440×900 isolated-context suites. Historical pre-M2 baseline (`29daf69`), M7a (`2b1ca3a`), and M7b Round 1–11 records are preserved below.

## Tier Breakdown (70 Tests Total)

| Tier | File | Test Count | Focus |
|---|---|---|---|
| Tier 1 | `tests/e2e/tiers/tier1-features.mjs` | 31 | Opaque-box isolated feature coverage across all `PROJECT.md § Feature Inventory` items (T1–T9, S1–S11, G1–G12) |
| Tier 2 | `tests/e2e/tiers/tier2-boundaries.mjs` | 12 | Opaque-box boundary & corner cases, including all 5 mandatory save scenarios (fresh start, legacy `eb0ea67` resume/migration, reload, `QuotaExceededError`, multi-tab contention) |
| Tier 3 | `tests/e2e/tiers/tier3-combinations.mjs` | 10 | Opaque-box cross-feature pairwise combinations |
| Tier 4 | `tests/e2e/tiers/tier4-journeys.mjs` | 3 | Opaque-box real-world end-user gameplay journeys |
| Tier 5 | `tests/e2e/tiers/tier5-adversarial.mjs` | 14 | White-box adversarial hardening (`E2E-T5-01..E2E-T5-14`, 434 assertions) covering all 19 Round 1 (`A-1..A-11`, `B-1..B-8`), 13 Round 2 (`R2A-1..R2A-6`, `R2B-1..R2B-6`, `DEFECT-R1-2A/2B/2C`), 12 Round 3 (`R3A-1..R3A-5`, `DEFECT-R2-2A/2B/2C`, `R3B-1..R3B-5` + PR #26 sandbox-exit guard), 6 Round 4 (`R4A-1`/`DEFECT-R3-2A`, `R4A-2`, `R4A-3`, `R4B-1`, `R4B-2`, `R4B-3`), 5 Round 5 (`R5A-1`, `R5A-2`, `R5B-1`, `R5B-2`, `R5B-3`), 9 Round 6 (`R6A-1..R6A-4`, `R6B-1..R6B-4`, `R6T-1`, plus `Minor-3`), 5 Round 8 (`DEFECT-R8-A1/A2`, `R8B-1..3`), 2 Round 9 (`R9B-1`, `R9B-2` + proactive mid-tribulation sibling guards), 3 Round 10 (`R10B-1`, `R10B-2`, `R10B-3` + Reviewer 1/2 findings + exhaustive `saveGame(` / `21/21 game.stones -=` mid-tribulation & practice guards, closed in Round 11 / PR #34), PR #35 `E2E-T5-09` Stage 0 wolf-combat setup stabilization, and PR #36 `combat-step.js` `arena.enemies` splice-under-iteration multi-kill safety (`+12` assertions in `E2E-T5-08`) + PR #33 D08 practice/tribulation/inline-sweep-error guards on unified `window.__CHENYUAN_DEBUG__` (`d06-unified-1`), PR #32 D05 schema (`bingjieCount`, unified `S/A/B/C`), and PR #33 D08 (`stageSweepState`, hold progression) |

## Feature Inventory Coverage Matrix (`PROJECT.md § Feature Inventory`)

| Feature | Milestone | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|---|
| **T1** 元存档损坏保护 | M2 | `E2E-T1-01` | `E2E-T2-01`, `E2E-T2-02`, `E2E-T2-04`, `E2E-T2-06` | — | `E2E-T4-02` |
| **T2** 输入框内屏蔽全局快捷键 | M2 | `E2E-T1-02` | `E2E-T2-11` | `E2E-T3-02` | `E2E-T4-02` |
| **T3** 弹窗和抽屉的焦点陷阱 | M2 | `E2E-T1-03` | — | `E2E-T3-02` | `E2E-T4-02` |
| **T4** 云码导入确认流程 | M2 | `E2E-T1-04` | `E2E-T2-07` | `E2E-T3-01` | `E2E-T4-02` |
| **T5** 元存档多标签页保护 | M2 | `E2E-T1-05` | `E2E-T2-05` | — | `E2E-T4-02` |
| **T6** 危险写操作守卫 & `pagehide` | M2 | `E2E-T1-06` | `E2E-T2-03`, `E2E-T2-04`, `E2E-T2-05` | `E2E-T3-01` | `E2E-T4-02` |
| **T7** 无障碍和键位 | M2 | `E2E-T1-07` | — | `E2E-T3-02` | `E2E-T4-01` |
| **T8** 美术溯源清单 | M1 | `E2E-T1-08` | — | — | — |
| **T9** 工具链 | M1 | `E2E-T1-08` | — | — | — |
| **S1** Boss 门控进阶 | M3 | `E2E-T1-09` | `E2E-T2-02`, `E2E-T2-08` | `E2E-T3-04` | `E2E-T4-01`, `E2E-T4-03` |
| **S2** 真实结局与评分 | M3 | `E2E-T1-10` | — | `E2E-T3-06` | `E2E-T4-03` |
| **S3** 术语统一和导航改名 | M5 | `E2E-T1-11` | — | — | `E2E-T4-01` |
| **S4** 设定一致性 | M5 | `E2E-T1-12` | — | — | — |
| **S5** 圆满后的目标 | M3 | `E2E-T1-13` | — | — | `E2E-T4-03` |
| **S6** 因果花括号 bug | M3 | `E2E-T1-14` | — | `E2E-T3-06` | `E2E-T4-03` |
| **S7** 卷终演出和卷终卡 | M5 | `E2E-T1-15` | — | `E2E-T3-04` | `E2E-T4-01` |
| **S8** 开场前提和贯穿主线 | M5 | `E2E-T1-16` | `E2E-T2-01` | — | `E2E-T4-01` |
| **S9** 故人线挂钩章节 | M5 | `E2E-T1-17` | — | `E2E-T3-08` | `E2E-T4-03` |
| **S10** 因果事件不重复 | M5 | `E2E-T1-18` | — | `E2E-T3-06` | `E2E-T4-03` |
| **S11+G7** 分批解锁和系统教程 | M6 | `E2E-T1-19` | — | `E2E-T3-04` | `E2E-T4-01` |
| **G1** 远征经济修复 | M4 | `E2E-T1-20` | `E2E-T2-10` | `E2E-T3-08` | `E2E-T4-03` |
| **G2** 灵玉赌注漏洞 | M4 | `E2E-T1-21` | — | — | `E2E-T4-03` |
| **G3** Boss 和伤害曲线重调 | M3 | `E2E-T1-22` | — | `E2E-T3-04` | `E2E-T4-01`, `E2E-T4-03` |
| **G4** 跳关不发奖励 | M4 | `E2E-T1-23` | — | `E2E-T3-09` | — |
| **G5** 永久成长上限 | M4 | `E2E-T1-24` | `E2E-T2-02` | `E2E-T3-05` | — |
| **G6** 全神通演武沙盒化 | M4 | `E2E-T1-25` | — | `E2E-T3-03` | — |
| **G8** 让寿元有意义 | M6 | `E2E-T1-26` | `E2E-T2-09` | `E2E-T3-05`, `E2E-T3-07` | `E2E-T4-03` |
| **G9** 显式消费 | M4 | `E2E-T1-27` | — | `E2E-T3-07` | `E2E-T4-03` |
| **G10** 灵宠成长 | M6 | `E2E-T1-28` | `E2E-T2-12` | — | `E2E-T4-03` |
| **G11a** Boss Rush 评级重定基准 | M4 | `E2E-T1-29` | — | `E2E-T3-09` | — |
| **G11b** 数据清理 | M6 | `E2E-T1-30` | — | — | `E2E-T4-03` |
| **G12** 闭关吸附掉落 | M6 | `E2E-T1-31` | — | `E2E-T3-10` | — |

## Latest Post-Merge `main` Verification Results (`1742ffcd` / PR #34–#36 — 100% PASS)

- **Branch / Commit**: `main` @ `1742ffcdcfef470aa5430d9510d86a568c8d8ef4` (PR #34 `21602e58` + PR #35 `d4db3ba4` + PR #36 `1742ffcd`; independent Victory Audit #2 **`VICTORY CONFIRMED`**)
- **Verified At (UTC)**: `2026-11-25T00:49:50Z`–`01:15Z` (GitHub Actions post-merge `main` push CI Run [`45521068688`](https://github.com/GOD-OF-PPT/chenyaun-v2/actions/runs/45521068688), `16/16` steps `SUCCESS`, plus independent local pure-Node suite & CI report artifact verification)
- **Browser & Toolchain (CI)**: Playwright Chromium `159.0.8154.6`, Node.js `v22`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across all 91 regression suites and all 70 E2E tests
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Build, Unit, Static, Economy, Combat Matrix, Immutability & Provenance Gates**:
  - `npm run build:check` → PASS (`8758135 bytes, 115 WebP assets, 11 ESM modules, 16 runtime modules, sha256=0401b19cdfb1`, full SHA-256 `0401b19cdfb16da0068a31df4afc340e956b1421e544bb77a22de76ee75495cf`, byte-for-byte parity, exit `0`)
  - `npm run test:unit` → **43/43 PASS, 0 FAIL** (9 test files, exit `0`)
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`scripts=1 chars=8423063`, single `arena.paused = pauseTokens.size > 0;` writer at `src/runtime/scheduler-rewards.js:372` & `web/public/playable-v2.html:21441`, exit `0`)
  - `node --check` across all 33 `.mjs` files under `scripts/`, `src/`, & `tests/` → PASS (`MJS_CHECK_OK count=33`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - `node scripts/audit-economy.mjs --seed 20261124` → PASS (`passed: true, violations: []`, `d05Compliant: true`, exit `0`)
  - `node scripts/eval-combat-matrix.mjs --seed 20261124` → PASS (`totalScenarios: 84, outliers: []`, exit `0`)
  - Immutability & Assertion Counts: `PRE81_MATCH: true` (`54b73be5...`), `TAIL_MATCH: true` (`a681001f...`), `T5_ASSERTS=666`, `E2E_T5_ASSERTS=434` (`+12` multi-kill assertions in `E2E-T5-08`), `15/15` CLI guards PASS
- **Regression Suite (CI Run `45521068688` `regression-report.json`)**:
  - **91/91 PASS**, `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `durationMs=364634` (`schemaVersion: 2`, `1440×900`, exit `0`)
- **E2E Combined Run (CI Run `45521068688` `e2e-report.json`)**:
  - **70/70 PASS** (Tier 1 `31/31`, Tier 2 `12/12`, Tier 3 `10/10`, Tier 4 `3/3`, Tier 5 `14/14` incl. `E2E-T5-08` `5337ms` & `E2E-T5-09` `9445ms`), `0 FAIL`, `runtimeErrors=0`, `elapsed=254624ms` (`schemaVersion: 1`, `1440×900`, exit `0`)

## Prior M7b Round 11 Final Convergence Verification Results (PR #34, 100% PASS)

- **Branch / Base**: `codex/adversarial-hardening` (M7b Round 11, built on Round 10 @ `1f0fc7fa0b9e63a4fe000dae188d5a26bef38acd` with `origin/main` @ `028928200370d74e265115f172c6bb4277c531de` [PR #33 R3-M3/D08]: closes all 3 Round 10 Surface B Challenger findings [`R10B-1` `triggerCompanionHubAction(..., "gift")` + `playStoryEventInPortraitBar` + `resolveStoryChoice`; `R10B-2` `buyKarmaSpecialItem` + `refresh-market` + locked `data-equip-soul`/`openSoulSealRefineConfirmModal`/`data-soul-refine` + unlearned `data-skill`; `R10B-3` `claimExpeditionRewards` + `claimMainlineStepReward` + `data-claim-bounty` + `data-claim-star-chest`], Reviewer 1/2 findings [`#btn-omen-banner` + `PROJECT.md:109/310/316` sync], and exhaustive programmatic audit across all 115 `saveGame(` call sites and 21/21 `game.stones -=` stone spenders [`assignExpeditionNode`, `executeReincarnation` with inline tribulation error, `openPetSkillChoiceModal`, `data-open-pet-skill-tier`, `data-pick-pet-skill`, `strikeFurnaceNeedle`, `openAffixEngraveModal` welcome/cutscene parity, `lifespan-use-pill`, `compare-smelt-new`, `data-toggle-pact`, `data-enc-id` practice parity, initial `data-pet` adoption], preserves 100% of PR #33 D08 [0 diff on `src/rules/sweep-rules.mjs` and all preserved PR #27–#33 files] across the exact 26-file diff, appends permanent zero-extra-page-load assertions in `T5-10` [`T5_ASSERTS=666`, `+44`] and `E2E-T5-14` [`E2E_T5_ASSERTS=422`, `+19`], regenerates `web/public/playable-v2.html` via `npm run build`, and keeps all 81 `origin/main` regression suites `L4..L12405` & runner tail, all 42 upstream unit tests + `campaign-q6.test.mjs` L1..L194, and all 56 Tier 1–4 E2E tests byte-for-byte untouched)
- **Verified At (UTC)**: `2026-11-24T22:28:25Z`–`23:05Z` (targeted `T5-10` & `E2E-T5-14` sanity, full single-command 91/91 regression `22:29:35Z`–`22:39:29Z`, independent full combined 70/70 E2E #1 `22:40:45Z`–`22:47:46Z`, independent full combined 70/70 E2E #2 `22:51:00Z`–`22:58:04Z`, and post-doc-edit full pure-Node build/unit/static/economy/combat-matrix/immutability/CLI gates; all 9 modified code/HTML/test files strictly older [`<= 22:28:25Z`] than all 3 persisted browser JSON reports)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across targeted sanity (`T5-10`, `E2E-T5-14`), all 91 regression suites, and both independent full 70/70 E2E runs
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Build, Unit, Static, Economy, Combat Matrix, Immutability & Provenance Gates**:
  - `npm run build:check` → PASS (`8757354 bytes, 115 WebP assets, 11 ESM modules, 16 runtime modules, sha256=7b4422b6b89a`, full SHA-256 `7b4422b6b89aba3056fed9731416a948f8b2d65cd9744499de246b47f6bd83c3`, byte-for-byte parity, exit `0`)
  - `npm run test:unit` → **43/43 PASS, 0 FAIL** (9 test files; includes PR #33 D08 `sweep-rules.test.mjs` & `ESM_MODULE_ORDER.length === 11` parity, PR #32 D05 mainline scaling/unified S/A/B/C/zero-deleted-currency static scan, 370-key `d06-unified-1` lock, zero-legacy hook scan, and `R6B-4` + `defeatedStageBosses` `hasOwn` parity 43rd unit test with `campaign-q6.test.mjs` L1..L194 verbatim untouched, exit `0`)
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`scripts=1 chars=8422282 utf8Bytes=8555666`, single `arena.paused = pauseTokens.size > 0;` writer at `src/runtime/scheduler-rewards.js:372` & `web/public/playable-v2.html:21441`, exit `0`)
  - `node --check` across all 33 `.mjs` files under `scripts/`, `src/`, & `tests/` → PASS (`MJS_CHECK_OK count=33`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - `node scripts/audit-economy.mjs --seed 20261124` → PASS (`passed: true, violations: []`, `itemsChecked: 16`, `gearRollsChecked: 300`, `gearBudgetFailures: 0`, `maxGearSellToFairPriceRatio: 0.583`, `d05CurrencyAudit: { reincarnationPointsAbsent: true, sectMeritsAbsent: true, bingjieCountPresent: true, sectDefenseClearedPresent: true, legacyStonesCapTested: 240, legacyStonesCapMax: 240, d05Compliant: true }`, exit `0`)
  - `node scripts/eval-combat-matrix.mjs --seed 20261124` → PASS (`totalScenarios: 84, allGearBudgetOk: true, mobMedianTtkSec: 0.15, bossMedianTtkSec: 2.63, bossWinRate: 1, swordMedianBossTtkSec: 2.58, talismanMedianBossTtkSec: 2.75, minHeavyHitsSurvivable: 2.22, afkZeroWins: true, outliers: []`, exit `0`)
  - Byte-for-byte immutability vs `origin/main` (`02892820`) → `PRE81_MATCH: true` (`54b73be5df07d1ee34631a09d0c69bd7ac9e13ecfff6d8ecd8aca3a60ae4f8f1`), `TAIL_MATCH: true` (`a681001f00882f2f85b3b81f658927bbceac32f54025498c25d1ccc87f710656`), `T5_ASSERTS=666`, `E2E_T5_ASSERTS=422`, `CAMPAIGN_Q6_UPSTREAM_L1_194_IDENTICAL=true`, `PRESERVED_ZERO_DIFF=true` across `.github/**`, `package*.json`, `scripts/{build-playable,art-manifest,audit-economy,eval-combat-matrix}.mjs`, `docs/**`, `src/{template.html,markup,assets,config,rules/(except campaign-q6.mjs),runtime/{preamble,renderer,main,debug-facade,boot}.js}`, `tests/unit/(except appended R6B-4/parity in campaign-q6.test.mjs)`, `tests/e2e/lib/**`, and `tests/e2e/tiers/tier[1-4]-*.mjs`; exhaustive runtime audit confirms `21/21 game.stones -=` guarded (`0` unguarded)
  - Real CLI exit-code-`2` guard checks (bad-arg invocations across `scripts/verify-playable-v2.mjs` & `tests/e2e/run.mjs`) → all exit `2`; both `--help` invocations exit `0`
- **Targeted Sanity**:
  - `--filter T5-10`: `1/1 PASS` (`16535ms`), `0 RuntimeErrors`
  - `npm run test:e2e -- --tier 5 --filter E2E-T5-14`: `1/1 PASS` (`21802ms`), `0 RuntimeErrors`
- **Regression Suite**:
  - **Full single-command 91-suite run (`reg-r11.json`, `22:29:35Z`–`22:39:29Z`, SHA-256 `9051c333...`)**: `91/91 PASS` (`Q5-1..Q5-3` `1744ms`/`5404ms`/`2620ms`; `Q6-1..Q6-4` `2828ms`/`11185ms`/`2946ms`/`2492ms`; `R3-D06-1` `3611ms`; `R3-D05-1` `6476ms`; `R3-D08-1` `8746ms`; `R3-D08-2` `12876ms`; `T5-1..T5-10` `4788ms`/`4013ms`/`6823ms`/`5033ms`/`5213ms`/`6067ms`/`5779ms`/`7187ms`/`2351ms`/`20169ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `durationMs=593818` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3) + `Q3-1..Q3-5` (5) + `Q4-1..Q4-5` (5) + `Q5-1..Q5-3` (3) + `Q6-1..Q6-4` (4) + `R3-D06-1` (1) + `R3-D05-1` (1) + `R3-D08-1..2` (2) + `T5-1..T5-10` (10)
- **E2E Combined Runs (2 Independent Full-Green Executions)**:
  - **Run #1 (`worker_m7b_r11/e2e-r11.json`, `22:40:45Z`–`22:47:46Z`, SHA-256 `8dda951c...`)**: `70/70 PASS`, `0 FAIL`, `runtimeErrors=0`, `elapsed=417826ms` (`schemaVersion: 1`, Tier 1 `31/31` `148361ms`, Tier 2 `12/12` `52560ms`, Tier 3 `10/10` `64965ms`, Tier 4 `3/3` `20883ms`, Tier 5 `14/14` `130574ms` with `E2E-T5-14` `19734ms`, exit code `0`)
  - **Run #2 (`worker_m7b_r11_tail/e2e-r11.json`, `22:51:00Z`–`22:58:04Z`, SHA-256 `94a707e7...`)**: `70/70 PASS`, `0 FAIL`, `runtimeErrors=0`, `elapsed=403964ms` (`schemaVersion: 1`, Tier 1 `31/31` `142163ms`, Tier 2 `12/12` `52207ms`, Tier 3 `10/10` `62602ms`, Tier 4 `3/3` `19530ms`, Tier 5 `14/14` `126979ms` with `E2E-T5-14` `20185ms`, exit code `0`)

## Prior M7b Round 10 Final Convergence Verification Results (100% PASS)

- **Branch / Base**: `codex/adversarial-hardening` (M7b Round 10, built on Round 9 @ `e86005ac69e9a9fed667c7dd3c7c2ece1e539310` with `origin/main` @ `028928200370d74e265115f172c6bb4277c531de` [PR #33 R3-M3/D08]: closes final 2 Round 9 Surface B Challenger findings [`R9B-1` `ravineGlide`/`z`/`vz`/`plunging` & `ravineBuffTimer` purge across all scene transitions and title/reset/reincarnation/sandbox exits + `triggerSwordGlideRavineDash` defense-in-depth + full `stepArena(dt)` early-return audit; `R9B-2` `openBatchEnhanceModal`/`executeGearBatchEnhance`/`confirm-batch-enhance` tribulation & practice guards] plus proactive sibling mid-tribulation parity across `data-temper-relic`, `data-reforge-slot`, `data-engrave-slot`, `openAffixEngraveModal`, `data-relic`, `data-awaken-primordial`, `buy-star-point`, `data-claim-ach`, `data-buy-gear`, `smelt-all-gear`, `data-gift-npc`, `feed-pet`, and `gamble-jade`, aligns the doc line-ref to `campaign-q6.mjs:272`, preserves 100% of PR #33 D08 [0 diff on `src/rules/sweep-rules.mjs` and all preserved PR #27–#33 files] across the exact 26-file diff, appends permanent zero-extra-page-load assertions in `T5-10` [`T5_ASSERTS=622`] and `E2E-T5-14` [`E2E_T5_ASSERTS=403`], regenerates `web/public/playable-v2.html` via `npm run build`, and keeps all 81 `origin/main` regression suites `L4..L12405` & runner tail, all 42 upstream unit tests + `campaign-q6.test.mjs` L1..L194, and all 56 Tier 1–4 E2E tests byte-for-byte untouched)
- **Verified At (UTC)**: `2026-11-24T21:08:42Z`–`21:29:51Z` (pure-Node build/unit/static/economy/combat-matrix/immutability/CLI gates, targeted `T5-10` & `E2E-T5-14` sanity, full single-command 91/91 regression, and full combined 70/70 E2E)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across targeted sanity (`T5-10`, `E2E-T5-14`), all 91 regression suites, and the full 70/70 E2E run
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Build, Unit, Static, Economy, Combat Matrix, Immutability & Provenance Gates (`21:08:42Z`–`21:09:20Z`)**:
  - `npm run build:check` → PASS (`8753994 bytes, 115 WebP assets, 11 ESM modules, 16 runtime modules, sha256=008b951c9a5a`, full SHA-256 `008b951c9a5adafbc25e536c1b38856e05a1b5c75b189f7d7b4b75ac57459b9d`, byte-for-byte parity, exit `0`)
  - `npm run test:unit` → **43/43 PASS, 0 FAIL** (`3374.5ms`, 9 test files; includes PR #33 D08 `sweep-rules.test.mjs` & `ESM_MODULE_ORDER.length === 11` parity, PR #32 D05 mainline scaling/unified S/A/B/C/zero-deleted-currency static scan, 370-key `d06-unified-1` lock, zero-legacy hook scan, and `R6B-4` + `defeatedStageBosses` `hasOwn` parity 43rd unit test with `campaign-q6.test.mjs` L1..L194 verbatim untouched, exit `0`)
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`scripts=1 chars=8419506 utf8Bytes=8552306`, single `arena.paused = pauseTokens.size > 0;` writer at `src/runtime/scheduler-rewards.js:372` & `web/public/playable-v2.html:21433`, exit `0`)
  - `node --check` across all 33 `.mjs` files under `scripts/`, `src/`, & `tests/` → PASS (`MJS_CHECK_OK count=33`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - `node scripts/audit-economy.mjs --seed 20261124` → PASS (`passed: true, violations: []`, `itemsChecked: 16`, `gearRollsChecked: 300`, `gearBudgetFailures: 0`, `maxGearSellToFairPriceRatio: 0.583`, `d05CurrencyAudit: { reincarnationPointsAbsent: true, sectMeritsAbsent: true, bingjieCountPresent: true, sectDefenseClearedPresent: true, legacyStonesCapTested: 240, legacyStonesCapMax: 240, d05Compliant: true }`, exit `0`)
  - `node scripts/eval-combat-matrix.mjs --seed 20261124` → PASS (`totalScenarios: 84, allGearBudgetOk: true, mobMedianTtkSec: 0.15, bossMedianTtkSec: 2.63, bossWinRate: 1, swordMedianBossTtkSec: 2.58, talismanMedianBossTtkSec: 2.75, minHeavyHitsSurvivable: 2.22, afkZeroWins: true, outliers: []`, exit `0`)
  - Byte-for-byte immutability vs `origin/main` (`02892820`) → `PRE81_MATCH: true` (`54b73be5df07d1ee34631a09d0c69bd7ac9e13ecfff6d8ecd8aca3a60ae4f8f1`), `TAIL_MATCH: true` (`a681001f00882f2f85b3b81f658927bbceac32f54025498c25d1ccc87f710656`), `T5_ASSERTS=622`, `E2E_T5_ASSERTS=403`, `CAMPAIGN_Q6_UPSTREAM_L1_194_IDENTICAL=true`, `PRESERVED_ZERO_DIFF=true` across `.github/**`, `package*.json`, `scripts/{build-playable,art-manifest,audit-economy,eval-combat-matrix}.mjs`, `docs/**`, `src/{template.html,markup,assets,config,rules/(except campaign-q6.mjs),runtime/{preamble,renderer,main,debug-facade,boot}.js}`, `tests/unit/(except appended R6B-4/parity in campaign-q6.test.mjs)`, `tests/e2e/lib/**`, and `tests/e2e/tiers/tier[1-4]-*.mjs`
  - Real CLI exit-code-`2` guard checks (10 bad-arg invocations across `scripts/verify-playable-v2.mjs` & `tests/e2e/run.mjs`) → all 10 exit `2`; both `--help` invocations exit `0`
- **Targeted Sanity (`21:10:50Z`–`21:11:31Z`)**:
  - `--filter T5-10`: `1/1 PASS` (`17678ms`, `18798ms` total), `0 RuntimeErrors`
  - `npm run test:e2e -- --tier 5 --filter E2E-T5-14`: `1/1 PASS` (`19981ms`, `20552ms` total), `0 RuntimeErrors`
- **Regression Suite**:
  - **Full single-command 91-suite run (`npm run test:regression -- --report <scratch>/reg-r10.json`, `21:11:53Z`–`21:21:56Z`)**: `91/91 PASS` (`Q5-1..Q5-3` `1783ms`/`5751ms`/`2387ms`; `Q6-1..Q6-4` `2852ms`/`11615ms`/`2854ms`/`2536ms`; `R3-D06-1` `3939ms`; `R3-D05-1` `6719ms`; `R3-D08-1` `8259ms`; `R3-D08-2` `12546ms`; `T5-1..T5-10` `5013ms`/`4120ms`/`7148ms`/`5185ms`/`7419ms`/`6798ms`/`6378ms`/`6310ms`/`2276ms`/`16038ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `durationMs=602421` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3) + `Q3-1..Q3-5` (5) + `Q4-1..Q4-5` (5) + `Q5-1..Q5-3` (3) + `Q6-1..Q6-4` (4) + `R3-D06-1` (1) + `R3-D05-1` (1) + `R3-D08-1..2` (2) + `T5-1..T5-10` (10)
- **E2E Combined Run (`npm run test:e2e -- --report <scratch>/e2e-r10.json`, `21:22:25Z`–`21:29:22Z`)**:
  - **Total**: `70/70 PASS`, `0 FAIL`, `runtimeErrors=0`, `elapsed=416901ms` (`schemaVersion: 1`, Tier 1 `31/31` `144544ms`, Tier 2 `12/12` `54810ms`, Tier 3 `10/10` `64010ms`, Tier 4 `3/3` `19281ms`, Tier 5 `14/14` `133752ms` with `E2E-T5-14` `21189ms`, exit code `0`)

## Prior M7b Round 9 PR #33 D08 Integration & Convergence Verification Results (100% PASS)

- **Branch / Base**: `codex/adversarial-hardening` (M7b Round 9, losslessly merges `origin/main` @ `028928200370d74e265115f172c6bb4277c531de` [PR #33 R3-M3/D08] onto Round 8 @ `319aef9fc421c16df96009d2f1142c63841fb584` + closes all 5 Round 8 Challenger findings [`DEFECT-R8-A1`, `DEFECT-R8-A2`, `R8B-1`, `R8B-2`, `R8B-3`] + `src/rules/campaign-q6.mjs:272` `hasOwn` parity: resolves all conflicts losslessly while enforcing `guardNotPracticeMode`/`guardNotInTribulation`/welcome/cutscene guards and visible inline `#stage-sweep-error-msg` `role="alert"` across PR #33's `executeSingleAlchemyCraft`, `executeSingleGearEnhance`, `startHoldProgression`, `keyup` alchemy short-tap, `openStageSweepConfirmModal`, and `executeStageSweep`, preserves 100% of PR #33 D08 AND 100% of M7b Rounds 1–8 hardening across the exact 26-file diff, appends permanent zero-extra-page-load assertions in `T5-10` [`T5_ASSERTS=588`] and `E2E-T5-14` [`E2E_T5_ASSERTS=373`], regenerates `web/public/playable-v2.html` via `npm run build`, and keeps all 81 `origin/main` regression suites `L4..L12405` [updated `Q6-4` + `R3-D08-1/2`] & runner tail, all 42 upstream unit tests + `campaign-q6.test.mjs` L1..L194, all 56 Tier 1–4 E2E tests, and all preserved PR #27–#33 files byte-for-byte untouched)
- **Verified At (UTC)**: `2026-11-24T19:40:06Z`–`20:15:42Z` (pure-Node build/unit/static/economy/combat-matrix/immutability/CLI gates, targeted sanity `Q6-4` + `R3-D08-1/2` + `T5-` + `E2E --tier 5`, full single-command 91/91 regression, and full combined 70/70 E2E)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across targeted sanity (`Q6-4`, `R3-D08-1/2`, `T5-`, `E2E --tier 5`), all 91 regression suites, and the full 70/70 E2E run
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Build, Unit, Static, Economy, Combat Matrix, Immutability & Provenance Gates (`19:40:06Z`–`19:40:18Z`)**:
  - `npm run build:check` → PASS (`8751996 bytes, 115 WebP assets, 11 ESM modules, 16 runtime modules, sha256=8ff530e2605b`, full SHA-256 `8ff530e2605b2132638d02c3606b8ea7e103cfb55c2568e33801870e0fc12ac0`, byte-for-byte parity, exit `0`)
  - `npm run test:unit` → **43/43 PASS, 0 FAIL** (`3803.2ms`, 9 test files; includes PR #33 D08 `sweep-rules.test.mjs` & `ESM_MODULE_ORDER.length === 11` parity, PR #32 D05 mainline scaling/unified S/A/B/C/zero-deleted-currency static scan, 370-key `d06-unified-1` lock, zero-legacy hook scan, and `R6B-4` + `defeatedStageBosses` `hasOwn` parity 43rd unit test with `campaign-q6.test.mjs` L1..L194 verbatim untouched, exit `0`)
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`scripts=1 chars=8417808 utf8Bytes=8550308`, single `arena.paused = pauseTokens.size > 0;` writer at `src/runtime/scheduler-rewards.js:372` & `web/public/playable-v2.html:21422`, exit `0`)
  - `node --check` across all 33 `.mjs` files under `scripts/`, `src/`, & `tests/` → PASS (`MJS_CHECK_OK count=33`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - `node scripts/audit-economy.mjs --seed 20261124` → PASS (`passed: true, violations: []`, `itemsChecked: 16`, `gearRollsChecked: 300`, `gearBudgetFailures: 0`, `maxGearSellToFairPriceRatio: 0.583`, `d05CurrencyAudit: { reincarnationPointsAbsent: true, sectMeritsAbsent: true, bingjieCountPresent: true, sectDefenseClearedPresent: true, legacyStonesCapTested: 240, legacyStonesCapMax: 240, d05Compliant: true }`, exit `0`)
  - `node scripts/eval-combat-matrix.mjs --seed 20261124` → PASS (`totalScenarios: 84, allGearBudgetOk: true, mobMedianTtkSec: 0.15, bossMedianTtkSec: 2.63, bossWinRate: 1, swordMedianBossTtkSec: 2.58, talismanMedianBossTtkSec: 2.75, minHeavyHitsSurvivable: 2.22, afkZeroWins: true, outliers: []`, exit `0`)
  - Byte-for-byte immutability vs `origin/main` (`02892820`) → `PRE81_MATCH: true` (`54b73be5df07d1ee34631a09d0c69bd7ac9e13ecfff6d8ecd8aca3a60ae4f8f1`), `TAIL_MATCH: true` (`a681001f00882f2f85b3b81f658927bbceac32f54025498c25d1ccc87f710656`), `T5_ASSERTS=588`, `E2E_T5_ASSERTS=373`, `ZERO_DIFF_PRESERVED_LINES=0` across `.github/**`, `package*.json`, `scripts/{build-playable,art-manifest,audit-economy,eval-combat-matrix}.mjs`, `docs/**`, `src/{template.html,markup,assets,config,rules/(except campaign-q6.mjs),runtime/{preamble,renderer,main,debug-facade,boot}.js}`, `tests/unit/(except appended R6B-4/parity in campaign-q6.test.mjs)`, `tests/e2e/lib/**`, and `tests/e2e/tiers/tier[1-4]-*.mjs`
  - Real CLI exit-code-`2` guard checks (`--tier 0`, `--tier 6`, `--tier foo`, `--tier 1,6`, `--timeout 0`, `--timeout abc`, `--unknown-flag`, `--filter`, `--report`, `--tier`) → all 10 exit `2`; `--help` exits `0`
- **Targeted Sanity (`19:40:51Z`–`19:46:06Z`)**:
  - `--filter Q6-4`: `1/1 PASS`, `0 RuntimeErrors`, `2892ms` (`4128ms` total)
  - `--filter R3-D08-`: `2/2 PASS` (`R3-D08-1` `9217ms`, `R3-D08-2` `12863ms`), `0 RuntimeErrors`, `23165ms` total
  - `--filter T5-` + `--filter T5-10` (post-fixture alignment): `10/10 PASS` (`T5-10` `15056ms`), `0 RuntimeErrors`
  - `npm run test:e2e -- --tier 5`: `14/14 PASS` (`E2E-T5-14` `19383ms`), `0 FAIL`, `0 RuntimeErrors`, `134562ms`
- **Regression Suite**:
  - **Full single-command 91-suite run (`npm run test:regression -- --report <scratch>/reg-r9.json`, `19:57:38Z`–`20:07:52Z`)**: `91/91 PASS` (`Q5-1..Q5-3` `1805ms`/`5567ms`/`2688ms`; `Q6-1..Q6-4` `2904ms`/`11188ms`/`2893ms`/`2932ms`; `R3-D06-1` `3970ms`; `R3-D05-1` `6569ms`; `R3-D08-1` `8546ms`; `R3-D08-2` `12577ms`; `T5-1..T5-10` `4630ms`/`3930ms`/`8244ms`/`5565ms`/`5917ms`/`6020ms`/`5655ms`/`6214ms`/`2405ms`/`13965ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `durationMs=614253` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3) + `Q3-1..Q3-5` (5) + `Q4-1..Q4-5` (5) + `Q5-1..Q5-3` (3) + `Q6-1..Q6-4` (4) + `R3-D06-1` (1) + `R3-D05-1` (1) + `R3-D08-1..2` (2) + `T5-1..T5-10` (10)
- **E2E Combined Run (`npm run test:e2e -- --report <scratch>/e2e-r9.json`, `20:08:44Z`–`20:15:42Z`)**:
  - **Total**: `70/70 PASS`, `0 FAIL`, `runtimeErrors=0`, `elapsed=416283ms` (`schemaVersion: 1`, Tier 1 `31/31` `145284ms`, Tier 2 `12/12` `53971ms`, Tier 3 `10/10` `65743ms`, Tier 4 `3/3` `20852ms`, Tier 5 `14/14` `129905ms` with `E2E-T5-14` `19734ms`, exit code `0`)

## Prior M7b Round 8 PR #32 D05 Integration Verification Results (100% PASS)

- **Branch / Base**: `codex/adversarial-hardening` (M7b Round 8, losslessly merges `origin/main` @ `f2f4050ab01b8d03af0969c7cb63c12fea443d00` [PR #32 R3-M2/D05] onto Round 7 @ `6876c05b2ac5b64f6b133a9355a297bd225d80c9`: resolves all 3 `src/` merge conflicts losslessly [`src/rules/campaign-q6.mjs` keeping `hasOwn(g.stageStars, String(idx))`, `src/runtime/primordial-systems.js` setting `arena.customSeedRun` with `practiceMode: true` + `hitsTaken: 0` pre-spawn and `hideDojoControlBar()` post-spawn, `src/runtime/sanctum-ecosystem.js` keeping `if (!(opts && opts.skipSave)) saveMeta()` while dropping removed `reincarnationPoints`], preserves 100% of PR #32 D05 contracts AND 100% of M7b Rounds 1–7 hardening across the exact 26-file diff, aligns all 7 stale `reincarnationPoints` assertions in `T5-1..T5-10` & `tier5-adversarial.mjs` to D05 `bingjieCount` with zero weakened assertions, regenerates `web/public/playable-v2.html` via `npm run build`, and keeps all 79 `origin/main` regression suites `L4..L11642` [incl. `R3-D05-1`] & runner tail, all 39 upstream unit tests + `campaign-q6.test.mjs` L1..L194, all 56 Tier 1–4 E2E tests, and all preserved PR #27–#32 files byte-for-byte untouched)
- **Verified At (UTC)**: `2026-11-24T18:22:55Z`–`18:45:17Z` (pure-Node build/unit/static/economy/combat-matrix/immutability/CLI gates, targeted sanity `R3-D05-1` + `T5-` + `E2E --tier 5`, full single-command 89/89 regression, and full combined 70/70 E2E)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across targeted sanity (`R3-D05-1`, `T5-`, `E2E --tier 5`), all 89 regression suites, and the full 70/70 E2E run
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Build, Unit, Static, Economy, Combat Matrix, Immutability & Provenance Gates (`18:22:55Z`–`18:23:36Z`)**:
  - `npm run build:check` → PASS (`8687365 bytes, 115 WebP assets, 10 ESM modules, 16 runtime modules, sha256=efdff22567d4`, full SHA-256 `efdff22567d4e7d5fdec3f672c01e69b978f65816df05cee6d8fc464557b18b1`, byte-for-byte parity, exit `0`)
  - `npm run test:unit` → **40/40 PASS, 0 FAIL** (`3302.6ms`, 8 test files; includes PR #32 D05 mainline scaling, unified S/A/B/C rating, static D05 zero-removed-sub-currency/super-S-grade scan, 370-key `d06-unified-1` lock, zero-legacy hook scan, and `R6B-4` 40th unit test with `campaign-q6.test.mjs` L1..L194 verbatim untouched, exit `0`)
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`scripts=1 chars=8357237 utf8Bytes=8487680`, single `arena.paused = pauseTokens.size > 0;` writer at `src/runtime/scheduler-rewards.js:371` & `web/public/playable-v2.html:21002`, exit `0`)
  - `node --check` across all 31 `.mjs` files under `scripts/`, `src/`, & `tests/` → PASS (`MJS_CHECK_OK count=31`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - `node scripts/audit-economy.mjs --seed 20261124` → PASS (`passed: true, violations: []`, `itemsChecked: 16`, `gearRollsChecked: 300`, `gearBudgetFailures: 0`, `maxGearSellToFairPriceRatio: 0.583`, `d05CurrencyAudit: { reincarnationPointsAbsent: true, sectMeritsAbsent: true, bingjieCountPresent: true, sectDefenseClearedPresent: true, legacyStonesCapTested: 240, legacyStonesCapMax: 240, d05Compliant: true }`, exit `0`)
  - `node scripts/eval-combat-matrix.mjs --seed 20261124` → PASS (`totalScenarios: 84, allGearBudgetOk: true, mobMedianTtkSec: 0.15, bossMedianTtkSec: 2.63, bossWinRate: 1, swordMedianBossTtkSec: 2.58, talismanMedianBossTtkSec: 2.75, minHeavyHitsSurvivable: 2.22, afkZeroWins: true, outliers: []`, exit `0`)
  - Byte-for-byte immutability vs `origin/main` (`f2f4050a`) → `PRE79_MATCH: true` (`03953dbe9c1ce8949d00ad6b67d037c2556f5822fcaef5346fd98217b72e30e0`), `TAIL_MATCH: true` (`a681001f00882f2f85b3b81f658927bbceac32f54025498c25d1ccc87f710656`), `T5_ASSERTS=539`, `E2E_T5_ASSERTS=335`, `ZERO_DIFF_PRESERVED_LINES=0` across `.github/**`, `package*.json`, `scripts/{build-playable,art-manifest,audit-economy,eval-combat-matrix}.mjs`, `docs/**`, `src/{template.html,markup,assets,config,rules/(except campaign-q6.mjs),runtime/{preamble,renderer,main,debug-facade,boot}.js}`, `tests/unit/(except appended R6B-4 in campaign-q6.test.mjs)`, `tests/e2e/lib/**`, and `tests/e2e/tiers/tier[1-4]-*.mjs`
  - Real CLI exit-code-`2` guard checks (`--tier 0`, `--tier 6`, `--tier foo`, `--tier 1,6`, `--timeout 0`, `--timeout abc`, `--unknown-flag`, `--filter`, `--report`, `--tier`) → all 10 exit `2`; `--help` exits `0`
- **Targeted Sanity (`18:24:16Z`–`18:27:42Z`)**:
  - `--filter R3-D05-1`: `1/1 PASS`, `0 RuntimeErrors`, `6738ms` (`7858ms` total)
  - `--filter T5-`: `10/10 PASS`, `0 RuntimeErrors`, `61237ms`
  - `npm run test:e2e -- --tier 5`: `14/14 PASS`, `0 FAIL`, `0 RuntimeErrors`, `134362ms`
- **Regression Suite**:
  - **Full single-command 89-suite run (`npm run test:regression -- --report <scratch>/reg-r8.json`, `18:28:23Z`–`18:38:00Z`)**: `89/89 PASS` (`Q5-1..Q5-3` `2301ms`/`5348ms`/`2410ms`; `Q6-1..Q6-4` `2623ms`/`11026ms`/`2939ms`/`2356ms`; `R3-D06-1` `4090ms`; `R3-D05-1` `5857ms`; `T5-1..T5-10` `4673ms`/`4120ms`/`6853ms`/`5150ms`/`5140ms`/`6886ms`/`5647ms`/`7183ms`/`2266ms`/`10411ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `durationMs=575905` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3) + `Q3-1..Q3-5` (5) + `Q4-1..Q4-5` (5) + `Q5-1..Q5-3` (3) + `Q6-1..Q6-4` (4) + `R3-D06-1` (1) + `R3-D05-1` (1) + `T5-1..T5-10` (10)
- **E2E Combined Run (`npm run test:e2e -- --report <scratch>/e2e-r8.json`, `18:38:27Z`–`18:45:17Z`)**:
  - **Total**: `70/70 PASS`, `0 FAIL`, `runtimeErrors=0`, `elapsed=408242ms` (`schemaVersion: 1`, Tier 1 `31/31` `148383ms`, Tier 2 `12/12` `51333ms`, Tier 3 `10/10` `63681ms`, Tier 4 `3/3` `19449ms`, Tier 5 `14/14` `124553ms` with `E2E-T5-14` `15996ms`, exit code `0`)

## Prior M7b Round 7 PR #30 / PR #31 D06 Integration Verification Results (100% PASS)

- **Branch / Base**: `codex/adversarial-hardening` (M7b Round 7, losslessly merges `origin/main` @ `1d64b3319f24500c100063c10f4b34d156c4ed3e` [PR #30 `e766ea77` + PR #31 D06 `1d64b331`] onto Round 6 @ `df1ffe98`: ports **224/224** M7b runtime hunks across **14** split `src/runtime/*.js` modules [drops only PR #30-superseded `H3` `isReducedMotionActive()` while keeping all 4 PR #30 sites, PR #31's 20-line `src/runtime/main.js` shell, 3 rescued tail DOM listeners in `src/runtime/input-handlers.js`, untouched `src/runtime/renderer.js`, and untouched 370-key `src/runtime/debug-facade.js` `d06-unified-1`], migrates all **387** legacy hook occurrences across `T5-1..T5-10` [209 refs + 14 null-safe `?.` guards] and `tests/e2e/tiers/tier5-adversarial.mjs` [178 refs + 9 null-safe `?.` guards] to `window.__CHENYUAN_DEBUG__`, regenerates `web/public/playable-v2.html` via `npm run build`, and keeps all 78 `origin/main` regression suites `L4..L11293` & runner tail, all 34 upstream unit tests + `campaign-q6.test.mjs` L1..L170, all 56 Tier 1–4 E2E tests, and all preserved PR #27–#31 files byte-for-byte untouched)
- **Verified At (UTC)**: `2026-11-24T17:14:18Z`–`17:57:19Z` (targeted sanity `R3-D06-1` + `T5-` + `E2E --tier 5`, full single-command 88/88 regression, full combined 70/70 E2E, 3× `E2E-T5-13` + 3× `T5-3` consecutive race stress, and final post-edit pure-Node/static/immutability/CLI gates)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across targeted sanity (`R3-D06-1`, `T5-`, `E2E --tier 5`), all 88 regression suites, the full 70/70 E2E run, and all 6 consecutive race stress runs (3× `E2E-T5-13` + 3× `T5-3`)
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Build, Unit, Static, Economy, Combat Matrix, Immutability & Provenance Gates (`17:14:18Z`–`17:14:23Z` & final post-edit re-run `17:57:09Z`–`17:57:19Z`)**:
  - `npm run build:check` → PASS (`8677034 bytes, 115 WebP assets, 10 ESM modules, 16 runtime modules, sha256=0715207ae91e`, full SHA-256 `0715207ae91ed2bb793df5d463242fe2920937780e422c8809b1d76e759d222a`, byte-for-byte parity, exit `0`)
  - `npm run test:unit` → **35/35 PASS, 0 FAIL** (`3056.3ms`, 8 test files; includes all 6 `build-parity.test.mjs` contracts [16 runtime modules, `<60L` `main.js`, exact 370-key `d06-unified-1` lock, static zero-legacy hook ban across `src/`/`scripts/`/`tests/`/`web/public/playable-v2.html`] + 35th unit test in `tests/unit/campaign-q6.test.mjs` with L1..L170 verbatim untouched, exit `0`)
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`scripts=1 chars=8347123 utf8Bytes=8477349`, single `arena.paused = pauseTokens.size > 0;` writer at `src/runtime/scheduler-rewards.js:371` & `web/public/playable-v2.html:20846`, exit `0`)
  - `node --check` across all 31 `.mjs` files under `scripts/`, `src/`, & `tests/` → PASS (`MJS_CHECK_OK count=31`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - `node scripts/audit-economy.mjs --seed 20261124` → PASS (`passed: true, violations: []`, `itemsChecked: 16`, `gearRollsChecked: 300`, `gearBudgetFailures: 0`, `maxGearSellToFairPriceRatio: 0.583`, `d05Compliant: true`, exit `0`)
  - `node scripts/eval-combat-matrix.mjs --seed 20261124` → PASS (`totalScenarios: 84, allGearBudgetOk: true, mobMedianTtkSec: 0.15, bossMedianTtkSec: 2.6, bossWinRate: 1, swordMedianBossTtkSec: 2.45, talismanMedianBossTtkSec: 2.58, minHeavyHitsSurvivable: 2.39, afkZeroWins: true, outliers: []`, exit `0`)
  - Byte-for-byte immutability vs `origin/main` (`1d64b331`) → `PRE78_MATCH: true` (`a13d6fa0ebcfbbdb133b347aec9351ab006257dc94daa645cb31cfa5794f75e9`), `TAIL_MATCH: true` (`a681001f00882f2f85b3b81f658927bbceac32f54025498c25d1ccc87f710656`), `T5_ASSERTS=539`, `E2E_T5_ASSERTS=335`, `ZERO_DIFF_PRESERVED_LINES=0` across `.github/**`, `package*.json`, `scripts/{build-playable,art-manifest,audit-economy,eval-combat-matrix}.mjs`, `docs/**`, `src/{template.html,markup,assets,config,rules/(except campaign-q6.mjs),runtime/{preamble,renderer,main,debug-facade,boot}.js}`, `tests/unit/build-parity.test.mjs`, `tests/e2e/lib/**`, and `tests/e2e/tiers/tier[1-4]-*.mjs`
  - Real CLI exit-code-`2` guard checks (`--tier 0`, `--tier 6`, `--tier foo`, `--tier 1,6`, `--timeout 0`, `--timeout abc`, `--unknown-flag`, `--filter`, `--report`, `--tier`) → all 10 exit `2`; `--help` exits `0`
- **Regression Suite**:
  - **Full single-command 88-suite run (`npm run test:regression -- --report <scratch>/reg-r7.json`, `17:38:44Z`–`17:48:25Z`)**: `88/88 PASS` (`Q5-1..Q5-3` `1867ms`/`5840ms`/`2394ms`; `Q6-1..Q6-4` `2890ms`/`14344ms`/`3094ms`/`2599ms`; `R3-D06-1` `3983ms`; `T5-1..T5-10` `4861ms`/`4238ms`/`6755ms`/`5417ms`/`5273ms`/`6138ms`/`6481ms`/`7419ms`/`2223ms`/`11563ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `durationMs=580495` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3) + `Q3-1..Q3-5` (5) + `Q4-1..Q4-5` (5) + `Q5-1..Q5-3` (3) + `Q6-1..Q6-4` (4) + `R3-D06-1` (1) + `T5-1..T5-10` (10)
- **E2E Combined Run (`npm run test:e2e -- --report <scratch>/e2e-r7.json`, `17:48:39Z`–`17:55:36Z`)**:
  - **Total**: `70/70 PASS`, `0 FAIL`, `runtimeErrors=0`, `elapsed=415227ms` (`schemaVersion: 1`, Tier 1 `31/31` `147361ms`, Tier 2 `12/12` `53355ms`, Tier 3 `10/10` `62908ms`, Tier 4 `3/3` `20827ms`, Tier 5 `14/14` `130188ms` with `E2E-T5-14` `17714ms`, exit code `0`)
- **Consecutive 3× Race Stress Verification (`17:55:49Z`–`17:56:50Z`)**:
  - **3× `E2E-T5-13` (`R6T-1`)**: `3/3 PASS`, `0 FAIL`, `runtimeErrors=0` (`10121ms`/`9487ms`/`10620ms`)
  - **3× `T5-3` (`R6A-4`)**: `3/3 PASS`, `0 FAIL`, `runtimeErrors=0` (`7727ms`/`7572ms`/`7361ms`)

## Prior M7b Round 6 Tier 5 Adversarial Hardening Verification Results (100% PASS)

- **Branch / Base**: `codex/adversarial-hardening` (M7b Round 6, built on Round 5 @ `ff6ddfb`; closes all 9 Round 5 Gate findings `R6A-1` [Option 1B], `R6A-2` [+ proactive batch-craft/batch-enhance/Settings inline alerts], `R6A-3`, `R6A-4`, `R6B-1` [+ `P4c`], `R6B-2`, `R6B-3`, `R6B-4`, `R6T-1`, plus Reviewer 2 `Minor-3` & proactive CI flake hardening in `E2E-T5-01`/`E2E-T5-06`/`E2E-T5-11` across `src/rules/campaign-q6.mjs`, `src/runtime/main.js`, regenerated `web/public/playable-v2.html`, `tests/unit/campaign-q6.test.mjs`, `scripts/verify-playable-v2.mjs` `T5-3`/`T5-10`, and `tests/e2e/tiers/tier5-adversarial.mjs`; keeps all 77 `origin/main` regression suites `L4..L11114` & runner tail, all 32 pre-existing unit tests, all 56 Tier 1–4 E2E tests, and all preserved PR #27–#29 files byte-for-byte untouched)
- **Verified At (UTC)**: `2026-11-24T16:21:08Z`–`16:40:49Z` (full single-command 87/87 regression, full combined 70/70 E2E, final 5× `E2E-T5-13` + 5× `T5-3` consecutive race stress, and final static/build:check/unit/economy/combat-matrix/immutability/CLI gates on final code)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across all 87 regression suites, the full 70/70 E2E run, and all 10 consecutive race stress runs (5× `E2E-T5-13` + 5× `T5-3`)
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Build, Unit, Static, Economy, Combat Matrix, Immutability & Provenance Gates (`16:40:35Z`–`16:40:49Z`)**:
  - `npm run build:check` → PASS (`8677626 bytes, 115 WebP assets, 10 ESM modules, sha256=84ef7e4ab099`, full SHA-256 `84ef7e4ab0995195288ce90e5928208d46907505d6f54662f1ef24a5f826cb0f`, byte-for-byte parity, exit `0`)
  - `npm run test:unit` → **33/33 PASS, 0 FAIL** (`2706.4ms`, 8 test files; appends 33rd test in `tests/unit/campaign-q6.test.mjs` covering plain-object/legacy-array/hostile `stageStars` in `getExpeditionNodeStageSynergy` leaving L1..L170 verbatim untouched, exit `0`)
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`scripts=1 chars=8347715 utf8Bytes=8477941`, single `arena.paused = pauseTokens.size > 0;` writer at `src/runtime/main.js:13236` & `web/public/playable-v2.html:20836`, exit `0`)
  - `node --check` across all 31 `.mjs` files under `scripts/`, `src/`, & `tests/` → PASS (`MJS_CHECK_OK count=31`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - `node scripts/audit-economy.mjs --seed 20261124` → PASS (`passed: true, violations: []`, `itemsChecked: 16`, `gearRollsChecked: 300`, `gearBudgetFailures: 0`, `maxGearSellToFairPriceRatio: 0.583`, `d05Compliant: true`, exit `0`)
  - `node scripts/eval-combat-matrix.mjs --seed 20261124` → PASS (`totalScenarios: 84, allGearBudgetOk: true, mobMedianTtkSec: 0.15, bossMedianTtkSec: 2.6, bossWinRate: 1, swordMedianBossTtkSec: 2.45, talismanMedianBossTtkSec: 2.58, minHeavyHitsSurvivable: 2.39, afkZeroWins: true, outliers: []`, exit `0`)
  - Byte-for-byte immutability vs `origin/main` (`fffcb721`) → `PRE77_MATCH: true` (`5a7b686e50c03192abd25f884ec86590da5839f2e62dd4f1a54fa2f58ef430cc`), `TAIL_MATCH: true` (`a681001f00882f2f85b3b81f658927bbceac32f54025498c25d1ccc87f710656`), `T5_ASSERTS=539` (`+133` over Round 5 baseline `406`), `E2E_T5_ASSERTS=335`, `ZERO_DIFF_PRESERVED_LINES=0` across `.github/**`, `package*.json`, `scripts/{build-playable,art-manifest,audit-economy,eval-combat-matrix}.mjs`, `docs/**`, `src/{template.html,markup,assets,config,rules/(except campaign-q6.mjs),runtime/{preamble,debug-facade,boot}.js}`, `tests/e2e/lib/**`, and `tests/e2e/tiers/tier[1-4]-*.mjs`
  - CLI exit-code-`2` guard checks (`--tier`, `--tier 99`, `--tier abc`, `--filter`, `--report`, `--timeout 0`, `--timeout abc`, `--unknown-flag`; note: Round 6 originally invoked unknown `--timeout-scale` which exited `2` as unknown flag, verified with real `--timeout 0`/`--timeout abc` in Round 7) → all 8 exit `2`; `--help` exits `0`
- **Regression Suite**:
  - **Full single-command 87-suite run (`npm run test:regression -- --report <scratch>/reg-r6.json`, `16:21:08Z`–`16:30:57Z`)**: `87/87 PASS` (`Q6-1..Q6-4` `2935ms`/`11208ms`/`3173ms`/`2427ms`; `T5-1..T5-10` `6098ms`/`4826ms`/`7764ms`/`6139ms`/`6273ms`/`9398ms`/`7029ms`/`7817ms`/`3209ms`/`12109ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `durationMs=585977` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3) + `Q3-1..Q3-5` (5) + `Q4-1..Q4-5` (5) + `Q5-1..Q5-3` (3) + `Q6-1..Q6-4` (4) + `T5-1..T5-10` (10)
- **E2E Combined Run (`npm run test:e2e -- --report <scratch>/e2e-r6.json`, `16:31:15Z`–`16:38:12Z`)**:
  - **Total**: `70/70 PASS`, `0 FAIL`, `runtimeErrors=0`, `elapsed=414401ms` (`schemaVersion: 1`, Tier 1 `31/31` `147714ms`, Tier 2 `12/12` `52951ms`, Tier 3 `10/10` `66781ms`, Tier 4 `3/3` `19495ms`, Tier 5 `14/14` `126925ms` with `E2E-T5-14` `15999ms`, exit code `0`)
- **Consecutive Race Stress Verification (`16:38:26Z`–`16:40:15Z`)**:
  - **5× `E2E-T5-13` (`R6T-1`)**: `5/5 PASS`, `0 FAIL`, `runtimeErrors=0` (`10126ms`/`10325ms`/`10267ms`/`10377ms`/`9989ms`)
  - **5× `T5-3` (`R6A-4`)**: `5/5 PASS`, `0 FAIL`, `runtimeErrors=0` (`8542ms`/`8161ms`/`9542ms`/`8642ms`/`8136ms`)

## Prior M7b Round 5 Tier 5 Adversarial Hardening Verification Results (100% PASS)

- **Branch / Base**: `codex/adversarial-hardening` (M7b Round 5, losslessly merged `origin/main` PR #28 Q6 F34–F37 @ `5115b8e8` + PR #29 Q7 F38 @ `fffcb721` via `6a501a66` resolving all 17 conflicts `C1–C17` + 7 semantic updates `S1–S7` including `Q6-1` `isReducedMotionActive()` CI flake fix; closes all 5 Round 4 Gate findings `R5A-1`, `R5A-2`, `R5B-1`, `R5B-2`, `R5B-3` + `NIT-DOC-1` in `src/runtime/main.js` + regenerated `web/public/playable-v2.html`; keeps all 77 pre-existing `origin/main` regression suites `M1-1..R7-3 + Q3-1..Q6-4`, runner tail, all 32 unit tests, all 56 Tier 1–4 E2E tests, and all PR #27–#29 build/config/rules/assets/docs/CI files byte-for-byte untouched, and permanently encodes `T5-1..T5-10` [406 asserts] & `E2E-T5-01..E2E-T5-14`)
- **Verified At (UTC)**: `2026-11-24T13:24:08Z`–`14:05:03Z` (post-final-edit static/build:check/unit/economy/combat-matrix/immutability/CLI gates, full single-command 87/87 regression, ordered Tier 1→5 E2E, and combined 70/70 E2E on final code)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across all 87 regression suites, all ordered Tier 1–5 E2E runs, and the combined 70/70 E2E run
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Build, Unit, Static, Economy, Combat Matrix, Immutability & Provenance Gates (`13:24:08Z`–`13:24:21Z`)**:
  - `npm run build:check` → PASS (`8660159 bytes, 115 WebP assets, 10 ESM modules, sha256=9ffcef16d4cb`, byte-for-byte parity, exit `0`)
  - `npm run test:unit` → **32/32 PASS, 0 FAIL** (`2642.9ms`, 8 test files including exact 382 `V18–V25` keys, `__CHENYUAN_DEBUG__`, `campaign-q6.test.mjs`, VM rule parity, `save-rules.test.mjs`, and negative build guards, exit `0`)
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`VM_SCRIPT_OK scripts=1 bytes=8331291`, single `arena.paused = pauseTokens.size > 0;` writer at `src/runtime/main.js:13214` & `web/public/playable-v2.html:20814`, exit `0`)
  - `node --check` across all 31 `.mjs` files under `scripts/`, `src/`, & `tests/` → PASS (`ALL_MJS_OK count=31`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - `node scripts/audit-economy.mjs --seed 20261124` → PASS (`passed: true, violations: []`, `itemsChecked: 16`, `gearRollsChecked: 300`, `gearBudgetFailures: 0`, `maxGearSellToFairPriceRatio: 0.583`, `d05Compliant: true`, exit `0`)
  - `node scripts/eval-combat-matrix.mjs --seed 20261124` → PASS (`totalScenarios: 84, allGearBudgetOk: true, mobMedianTtkSec: 0.15, bossMedianTtkSec: 2.6, bossWinRate: 1, swordMedianBossTtkSec: 2.45, talismanMedianBossTtkSec: 2.58, minHeavyHitsSurvivable: 2.39, afkZeroWins: true, outliers: []`, exit `0`)
  - Byte-for-byte immutability vs `origin/main` (`fffcb721`) → `PRE77_MATCH: true` (`5a7b686e50c03192abd25f884ec86590da5839f2e62dd4f1a54fa2f58ef430cc`), `TAIL_MATCH: true` (`a681001f00882f2f85b3b81f658927bbceac32f54025498c25d1ccc87f710656`), `T5_ASSERTS=406` (`+64` over Round 4 baseline `342`), `ZERO_DIFF_PRESERVED_LINES=0` across `.github/**`, `package*.json`, `scripts/{build-playable,art-manifest,audit-economy,eval-combat-matrix}.mjs`, `docs/**`, `src/{template.html,markup,assets,config,rules,runtime/{preamble,debug-facade,boot}.js}`, `tests/unit/**`, `tests/e2e/lib/**`, and `tests/e2e/tiers/tier[1-4]-*.mjs`
  - CLI exit-code-`2` guard checks (`--tier 0`, `--tier 6`, `--tier foo`, `--tier 1,6`, `--unknown-flag`, `--filter`, `--report`, `--tier`) → all 8 exit `2`; `--help` exits `0`
- **Regression Suite**:
  - **Full single-command 87-suite run (`npm run test:regression -- --report <scratch>/reg.json`, `13:41:21Z`–`13:51:09Z`)**: `87/87 PASS` (`Q6-1..Q6-4` `2809ms`/`11417ms`/`3138ms`/`2477ms`; `T5-1..T5-10` `7928ms`/`8374ms`/`10132ms`/`6393ms`/`6936ms`/`13112ms`/`7063ms`/`11645ms`/`3261ms`/`14796ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `durationMs=586742` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3) + `Q3-1..Q3-5` (5) + `Q4-1..Q4-5` (5) + `Q5-1..Q5-3` (3) + `Q6-1..Q6-4` (4) + `T5-1..T5-10` (10)
- **E2E Ordered Tier-by-Tier Verification (`npm run test:e2e -- --tier <1|2|3|4|5>`, `13:51:25Z`–`13:58:12Z`)**:
  - **Tier 1** (`--tier 1`): `31/31 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=144571ms`, tests `144068ms`, exit `0`)
  - **Tier 2** (`--tier 2`): `12/12 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=52347ms`, tests `51845ms`, exit `0`)
  - **Tier 3** (`--tier 3`): `10/10 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=63245ms`, tests `62782ms`, exit `0`)
  - **Tier 4** (`--tier 4`): `3/3 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=23312ms`, tests `22783ms`, exit `0`)
  - **Tier 5** (`--tier 5`): `14/14 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=119004ms`, tests `118441ms`, exit `0`)
- **E2E Combined Run (`npm run test:e2e -- --report <scratch>/e2e.json`, `13:58:21Z`–`14:05:03Z`)**:
  - **Total**: `70/70 PASS`, `0 FAIL`, `runtimeErrors=0`, `elapsed=399962ms` (`schemaVersion: 1`, Tier 1 `141846ms`, Tier 2 `50406ms`, Tier 3 `64430ms`, Tier 4 `20289ms`, Tier 5 `122454ms`, exit code `0`)

## Prior M7b Round 4 Tier 5 Adversarial Hardening Verification Results (100% PASS)

- **Branch / Base**: `codex/adversarial-hardening` (M7b Round 4, merged `origin/main` PR #27 Q5 F30–F33 modular source @ `df5efdab` via `e0c41814` with 100% lossless 170/170 hunk port onto `src/{styles/main.css,state/save-rules.mjs,runtime/main.js}` + deterministic `npm run build`; closes all 6 Round 3 Gate findings `R4A-1`/`DEFECT-R3-2A`, `R4A-2`, `R4A-3`, `R4B-1`, `R4B-2`, `R4B-3` in `src/runtime/main.js` + regenerated `web/public/playable-v2.html`; keeps all 73 pre-existing `origin/main` regression suites `M1-1..R7-3 + Q3-1..Q3-5 + Q4-1..Q4-5 + Q5-1..Q5-3`, runner tail, all 27 unit tests, all 56 Tier 1–4 E2E tests, and all PR #27 build/config/rules/assets/CI files byte-for-byte untouched, and permanently encodes `T5-1..T5-10` & `E2E-T5-01..E2E-T5-13`)
- **Verified At (UTC)**: `2026-11-24T11:52:24Z`–`12:15:57Z` (full 83/83 regression, ordered Tier 1→5 E2E, combined 69/69 E2E, and post-final-edit static/build:check/unit/economy/combat-matrix/immutability/CLI gates on final code)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across all 83 regression suites, all ordered Tier 1–5 E2E runs, and the combined 69/69 E2E run
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Build, Unit, Static, Economy, Combat Matrix, Immutability & Provenance Gates (`12:15:45Z`–`12:15:57Z`)**:
  - `npm run build:check` → PASS (`8590100 bytes, 115 WebP assets, 9 ESM modules, sha256=ad370b98d9d9`, byte-for-byte parity, exit `0`)
  - `npm run test:unit` → **27/27 PASS, 0 FAIL** (`2448ms`, 7 test files including exact 382 `V18–V25` keys, `__CHENYUAN_DEBUG__`, VM rule parity, `save-rules.test.mjs`, and negative build guards, exit `0`)
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`VM_SCRIPT_OK scripts=1`, single `arena.paused = pauseTokens.size > 0;` writer at `src/runtime/main.js:12927` & `web/public/playable-v2.html:20083`, exit `0`)
  - `node --check` across all 29 `.mjs` files under `scripts/`, `src/`, & `tests/` → PASS (`ALL_MJS_NODE_CHECK_OK count=29`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - `node scripts/audit-economy.mjs --seed 20261124` → PASS (`passed: true, violations: []`, exit `0`)
  - `node scripts/eval-combat-matrix.mjs --seed 20261124` → PASS (`totalScenarios: 84, allGearBudgetOk: true, bossWinRate: 1, outliers: []`, exit `0`)
  - Byte-for-byte immutability vs `origin/main` (`df5efdab`) → `PRE73_MATCH: true` (`5be3a02cc7b188ff4c3fb8889b6d08724241053b3e694a1a6b777cdf92152af1`), `TAIL_MATCH: true` (`a681001f00882f2f85b3b81f658927bbceac32f54025498c25d1ccc87f710656`), `PRESERVED_ZERO_DIFF_LINES=0` across `.github/**`, `package*.json`, `scripts/{build-playable,art-manifest,audit-economy,eval-combat-matrix}.mjs`, `docs/**`, `src/{template.html,markup,assets,config,rules,runtime/{preamble,debug-facade,boot}.js}`, `tests/unit/**`, `tests/e2e/lib/**`, and `tests/e2e/tiers/tier[1-4]-*.mjs`
  - CLI exit-code-`2` guard checks (`--tier 0`, `--tier 6`, `--tier foo`, `--tier 1,6`, `--unknown-flag`, `--filter`, `--report`, `--tier`) → all 8 exit `2`; `--help` exits `0`
- **Regression Suite**:
  - **Full 83-suite run (`npm run test:regression -- --report <scratch>/reg.json`, `11:52:24Z`–`12:02:06Z`)**: `83/83 PASS` (`Q5-1..Q5-3` `1800ms`/`5640ms`/`2357ms`; `T5-1..T5-10` `6389ms`/`8289ms`/`16259ms`/`6835ms`/`7668ms`/`15260ms`/`6650ms`/`19048ms`/`3150ms`/`8060ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `durationMs=581066` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3) + `Q3-1..Q3-5` (5) + `Q4-1..Q4-5` (5) + `Q5-1..Q5-3` (3) + `T5-1..T5-10` (10)
- **E2E Ordered Tier-by-Tier Verification (`npm run test:e2e -- --tier <1|2|3|4|5>`, `12:02:20Z`–`12:08:50Z`)**:
  - **Tier 1** (`--tier 1`, `12:02:20Z`–`12:04:43Z`): `31/31 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=141297ms`, tests `140790ms`, exit `0`)
  - **Tier 2** (`--tier 2`, `12:04:43Z`–`12:05:35Z`): `12/12 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=51693ms`, tests `51163ms`, exit `0`)
  - **Tier 3** (`--tier 3`, `12:05:35Z`–`12:06:41Z`): `10/10 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=64322ms`, tests `63770ms`, exit `0`)
  - **Tier 4** (`--tier 4`, `12:06:41Z`–`12:07:02Z`): `3/3 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=20395ms`, tests `19909ms`, exit `0`)
  - **Tier 5** (`--tier 5`, `12:07:02Z`–`12:08:50Z`): `13/13 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=107491ms`, tests `107006ms`, exit `0`)
- **E2E Combined Run (`npm run test:e2e -- --report <scratch>/e2e.json`, `12:09:01Z`–`12:15:28Z`)**:
  - **Total**: `69/69 PASS`, `0 FAIL`, `runtimeErrors=0`, `durationMs=385431` (`schemaVersion: 1`, Tier 1 `141763ms`, Tier 2 `51638ms`, Tier 3 `62850ms`, Tier 4 `19140ms`, Tier 5 `109484ms`, exit code `0`)

## Prior M7b Round 3 Tier 5 Adversarial Hardening Verification Results (100% PASS)

- **Branch / Base**: `codex/adversarial-hardening` (M7b Round 3, merged `origin/main` PR #24 Q3 F19–F23 @ `fc9004fa` & PR #26 Q4 F24–F29 @ `4b86533c` via `bc9689e`; closes all 12 Round 2 Gate findings `R3A-1..R3A-5`, `DEFECT-R2-2A/2B/2C`, `R3B-1..R3B-5`, PR #26 `initArenaStage({ skipSave: true })` sandbox-exit conflict guard, and `DOC-1`; keeps all 70 pre-existing `origin/main` regression suites `M1-1..R7-3 + Q3-1..Q3-5 + Q4-1..Q4-5` and all 56 pre-existing Tier 1–4 E2E tests byte-for-byte untouched, and permanently encodes `T5-1..T5-9` & `E2E-T5-01..E2E-T5-12`)
- **Verified At (UTC)**: `2026-11-24T09:24:48Z`–`09:51:48Z` (static/immutability/economy/CLI gates, full 79/79 regression, ordered Tier 1→5 E2E, and combined 68/68 E2E on final post-edit code)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across all 79 regression suites, all ordered Tier 1–5 E2E runs, and the combined 68/68 E2E run
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Static, Economy, Immutability & Provenance Gates (`09:24:48Z`–`09:24:51Z`)**:
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`VM_SCRIPT_OK scripts=1`, single `arena.paused = pauseTokens.size > 0;` writer at L19301, exit `0`)
  - `node --check` across all 12 `.mjs` files under `scripts/` & `tests/e2e/` → PASS (`ALL_MJS_NODE_CHECK_OK count=12`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - `node scripts/audit-economy.mjs` → PASS (`passed=true, violations=0`, exit `0`)
  - Byte-for-byte immutability vs `origin/main` (`4b86533c`) → `PRE_70_SUITES_MATCH: true` (`ca7a087aa06a5706bfa5d28593974dd66cc926d5becd2db3c39310302cb22dd8`), `RUNNER_TAIL_MATCH: true` (`a35aaf283aa37cace34a8daf721fab44d44871c3ad791ca307b2d876e151789e`), `TIER1_4_AND_LIB_DIFF_LINES: 0`
  - CLI exit-code-`2` guard checks (`--tier 0`, `--tier 6`, `--tier foo`, `--tier 1,6`, `--unknown-flag`, `--filter`, `--report`, `--tier`) → all 8 exit `2`; `--help` exits `0`
- **Regression Suite**:
  - **Full 79-suite run (`npm run test:regression -- --report <scratch>/reg.json`, `09:25:02Z`–`09:34:38Z`)**: `79/79 PASS` (`Q3-1..Q3-5` `2894ms`/`4836ms`/`2302ms`/`2498ms`/`2881ms`; `Q4-1..Q4-5` `2369ms`/`6136ms`/`4310ms`/`2863ms`/`3085ms`; `T5-1..T5-9` `5778ms`/`14670ms`/`23323ms`/`11208ms`/`8171ms`/`23898ms`/`6109ms`/`21856ms`/`2930ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `duration=574704ms` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3) + `Q3-1..Q3-5` (5) + `Q4-1..Q4-5` (5) + `T5-1..T5-9` (9)
- **E2E Ordered Tier-by-Tier Verification (`npm run test:e2e -- --tier <1|2|3|4|5>`, `09:35:23Z`–`09:41:34Z`)**:
  - **Tier 1** (`--tier 1`): `31/31 PASS`, `0 FAIL`, `runtimeErrors=0` (`durationMs=138117`, tests `137584ms`, exit `0`)
  - **Tier 2** (`--tier 2`): `12/12 PASS`, `0 FAIL`, `runtimeErrors=0` (`durationMs=49308`, tests `48861ms`, exit `0`)
  - **Tier 3** (`--tier 3`): `10/10 PASS`, `0 FAIL`, `runtimeErrors=0` (`durationMs=60717`, tests `60158ms`, exit `0`)
  - **Tier 4** (`--tier 4`): `3/3 PASS`, `0 FAIL`, `runtimeErrors=0` (`durationMs=20396`, tests `19873ms`, exit `0`)
  - **Tier 5** (`--tier 5`): `12/12 PASS`, `0 FAIL`, `runtimeErrors=0` (`durationMs=97815`, tests `97291ms`, exit `0`)
- **E2E Combined Run (`npm run test:e2e -- --report <scratch>/e2e.json`, `09:45:34Z`–`09:51:48Z`)**:
  - **Total**: `68/68 PASS`, `0 FAIL`, `runtimeErrors=0`, `durationMs=372349` (`schemaVersion: 1`, Tier 1 `141794ms`, Tier 2 `49555ms`, Tier 3 `61128ms`, Tier 4 `19291ms`, Tier 5 `99976ms`, exit code `0`)

## Prior M7b Round 2 Tier 5 Adversarial Hardening Verification Results (100% PASS)

- **Branch / Base**: `codex/adversarial-hardening` (M7b Round 2, merged `origin/main` PR #24 Q3 F19–F23 @ `fc9004fa`; closes all 13 Round 1 Gate findings `R2A-1..R2A-6`, `R2B-1..R2B-6`, `DEFECT-R1-2A/2B/2C` + PR #24 Dojo refill guard, keeps all 65 pre-existing `origin/main` regression suites `M1-1..R7-3 + Q3-1..Q3-5` and all 56 pre-existing Tier 1–4 E2E tests byte-for-byte untouched, and permanently encodes `T5-1..T5-7` & `E2E-T5-01..E2E-T5-10`)
- **Verified At (UTC)**: `2026-11-24T07:34:08Z`–`07:54:54Z` (static/immutability/CLI gates, full 72/72 regression, ordered Tier 1→5 E2E, and combined 66/66 E2E on final post-edit code)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across all 72 regression suites, all ordered Tier 1–5 E2E runs, and the combined 66/66 E2E run
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Static, Immutability & Provenance Gates (`07:34:08Z`–`07:34:11Z`)**:
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`VM_SCRIPT_OK scripts=1`, single `arena.paused = pauseTokens.size > 0;` writer at L18778, exit `0`)
  - `node --check` across all 12 `.mjs` files under `scripts/` & `tests/e2e/` → PASS (`ALL_MJS_NODE_CHECK_OK count=12`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - Byte-for-byte immutability vs `origin/main` (`fc9004fa`) → `PRE_65_SUITES_MATCH: true`, `RUNNER_TAIL_MATCH: true`, `TIER1_4_IMMUTABLE_OK`
  - CLI exit-code-`2` guard checks (`--tier 0`, `--tier 6`, `--tier foo`, `--tier 1,6`, `--unknown-flag`, `--filter`, `--report`) → all 7 exit `2`; `--help` exits `0`
- **Regression Suite**:
  - **Full 72-suite run (`npm run test:regression -- --report <scratch>/reg-72.json`, `07:34:11Z`–`07:42:04Z`)**: `72/72 PASS` (`Q3-1..Q3-5` `2603ms`/`4033ms`/`2006ms`/`1974ms`/`2301ms`; `T5-1..T5-7` `4989ms`/`13840ms`/`19015ms`/`10015ms`/`6957ms`/`19927ms`/`5120ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `duration=472132ms` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3) + `Q3-1..Q3-5` (5) + `T5-1..T5-7` (7)
- **E2E Ordered Tier-by-Tier Verification (`npm run test:e2e -- --tier <1|2|3|4|5>`)**:
  - **Tier 1** (`--tier 1`, `07:44:12Z`–`07:46:17Z`): `31/31 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=124098ms`, tests `123607ms`, exit `0`)
  - **Tier 2** (`--tier 2`, `07:46:17Z`–`07:47:05Z`): `12/12 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=46879ms`, tests `46311ms`, exit `0`)
  - **Tier 3** (`--tier 3`, `07:47:05Z`–`07:48:00Z`): `10/10 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=53339ms`, tests `52867ms`, exit `0`)
  - **Tier 4** (`--tier 4`, `07:48:00Z`–`07:48:18Z`): `3/3 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=17499ms`, tests `17034ms`, exit `0`)
  - **Tier 5** (`--tier 5`, `07:48:18Z`–`07:49:27Z`): `10/10 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=68149ms`, tests `67679ms`, exit `0`)
- **E2E Combined Run (`npm run test:e2e -- --report <scratch>/e2e-66.json`, `07:49:42Z`–`07:54:54Z`)**:
  - **Total**: `66/66 PASS`, `0 FAIL`, `runtimeErrors=0`, `elapsed=310324ms` (`schemaVersion: 1`, Tier 1 `126352ms`, Tier 2 `46497ms`, Tier 3 `51534ms`, Tier 4 `16732ms`, Tier 5 `68659ms`, exit code `0`)

## Prior M7b Round 1 Tier 5 Adversarial Hardening Verification Results (100% PASS)

- **Branch / Base**: `codex/adversarial-hardening` (M7b, based on `origin/main` @ `2b1ca3a` / M7a PR #25; fixes all 19 reproduced white-box defects `A-1..A-11` & `B-1..B-8`, keeps all 60 pre-existing regression suites `M1-1..R7-3` and all 56 pre-existing Tier 1–4 E2E tests byte-for-byte untouched, and permanently encodes `T5-1..T5-5` & `E2E-T5-01..E2E-T5-08`)
- **Verified At (UTC)**: `2026-11-24T05:54:11Z`–`06:11:47Z` (static/CLI gates, full 65/65 regression, ordered Tier 1→5 E2E, and combined 64/64 E2E on final post-edit code)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across all 65 regression suites, all ordered Tier 1–5 E2E runs, and the combined 64/64 E2E run
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Pre-Fix Red-Before-Green Proof**: Prior to editing `web/public/playable-v2.html`, running `--filter T5-` failed `0/5` (`T5-1..T5-5` all failed genuinely, including `[T5-4-B1 pageerror] Cannot access 'w' before initialization`) and `--tier 5` failed `0/8` (`E2E-T5-01..08` all failed genuinely).
- **Static & Provenance Gates (`05:54:11Z`–`05:54:14Z`)**:
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`VM_SCRIPT_OK scripts=1`, single `arena.paused = pauseTokens.size > 0;` writer at L18020, exit `0`)
  - `node --check` across all `scripts/*.mjs` & `tests/e2e/**/*.mjs` → PASS (`NODE_CHECK_ALL_MJS=OK`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - CLI exit-code-`2` guard checks (`--tier 0`, `--tier 6`, `--tier foo`, `--tier 1,6`, `--unknown-flag`, `--filter`, `--report`) → all 7 exit `2`; `--help` documents `--tier <1|2|3|4|5|all>`
- **Regression Suite**:
  - **Full 65-suite run (`npm run test:regression -- --report <scratch>/reg-65.json`, `05:54:24Z`–`06:01:42Z`)**: `65/65 PASS` (`T5-1` `6358ms`, `T5-2` `12423ms`, `T5-3` `18615ms`, `T5-4` `9856ms`, `T5-5` `8140ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `duration=437790ms` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3) + `T5-1..T5-5` (5)
- **E2E Ordered Tier-by-Tier Verification (`npm run test:e2e -- --tier <1|2|3|4|5>`)**:
  - **Tier 1** (`--tier 1`, `06:02:01Z`–`06:04:05Z`): `31/31 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=122846ms`, tests `122346ms`, exit `0`)
  - **Tier 2** (`--tier 2`, `06:04:05Z`–`06:04:52Z`): `12/12 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=45664ms`, tests `45202ms`, exit `0`)
  - **Tier 3** (`--tier 3`, `06:04:52Z`–`06:05:44Z`): `10/10 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=51212ms`, tests `50823ms`, exit `0`)
  - **Tier 4** (`--tier 4`, `06:05:44Z`–`06:06:02Z`): `3/3 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=17586ms`, tests `17057ms`, exit `0`)
  - **Tier 5** (`--tier 5`, `06:06:02Z`–`06:06:52Z`): `8/8 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=48557ms`, tests `48115ms`, exit `0`)
- **E2E Combined Run (`npm run test:e2e -- --report <scratch>/e2e-64.json`, `06:06:52Z`–`06:11:47Z`)**:
  - **Total**: `64/64 PASS`, `0 FAIL`, `runtimeErrors=0`, `elapsed=293654ms` (`schemaVersion: 1`, Tier 1 `125171ms`, Tier 2 `45319ms`, Tier 3 `54949ms`, Tier 4 `17891ms`, Tier 5 `49481ms`, exit code `0`)

## Prior M7a Verification Results (PR #25 @ `2b1ca3a`, 100% PASS)

- **Branch / Base**: `codex/e2e-pass` (based on `origin/main` @ `6946074`, preserving PR #23 Q2 F14–F18 & `P11`, with ported `7ca198c` runtime fixes P1–P10, Round 1 fixes `DEFECT-1` / `FINDING-2` / `CRDT D1–D4` covering all 15 monotonic fields of `META_KEY` with live re-read zero write amplification, Round 2 Challenger fixes `R2-D1` / `DEFECT-R2-1` / `DEFECT-R2-2` for live corrupt-meta validation before clearing `metaReadError`, immediate user-initiated write-failure toast + off-`BODY` focus preservation on `retry-save-now`/`overwrite-with-current-save`/`dismiss-save-alert`, and atomic failure handling for `save_conflict` / read-only overwrites, plus Round 3 test-only `BLOCKER-R3-1` Chromium Mojo `StorageArea` IPC convergence hardening in `E2E-T1-05` — polling both renderers for converged `metaRev >= 2` & merged union + verifying cross-tab equality without weakening any assertion — and `R7-2` Part E D1–D3 replication/healing `metaRev > staleRev` verification, leaving `web/public/playable-v2.html` byte-identical to `e25a660`)
- **Verified At (UTC)**: `2026-11-24T03:33:18Z`–`03:51:17Z` (post-Round-3-test-hardening static/CLI gates, 15x `E2E-T1-05` stress, 3x `R7-2` stress, full 60/60 regression, ordered Tier 1–4 E2E, and combined 56/56 E2E on final code)
- **Browser & Toolchain**: `/usr/bin/google-chrome` (`Google Chrome 158.0.8127.36`, Chromium-based; `CHROMIUM_PATH` unset → `/usr/bin/google-chrome` fallback; Chrome 158 vs upstream Chromium honestly noted per `PROJECT.md`), Node.js `v22.23.5`, `playwright-core@1.65.1`, viewport `1440×900`, fresh isolated `BrowserContext` per suite/test
- **Runtime errors (`console.error` / `pageerror`)**: **0** across the 15x `E2E-T1-05` stress run, 3x `R7-2` stress run, all 60 regression suites, all ordered Tier 1–4 E2E runs, and the combined 56/56 E2E run
- **Verification Scope Note**: Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was executed; all static HTTP player-interaction verification is performed via the automated 1440×900 Playwright regression & E2E suites.
- **Static & Provenance Gates (`03:33:18Z`–`03:33:20Z`)**:
  - `git merge-base --is-ancestor origin/main HEAD` → PASS (exit `0`), zero conflict markers, `web/public/playable-v2.html` byte-identical to `e25a660`, zero edits inside `origin/main` `L191–L7153` (`M1-1..Q2-5` byte-identical)
  - Inline `<script>` syntax validation (`vm.Script`) → PASS (`VM_SCRIPT_OK scripts=1`, single `arena.paused = pauseTokens.size > 0;` writer at L17776, exit `0`)
  - `npm run art:manifest:check` → PASS (`115 inline assets, 11 disk files, 1 other inline asset`, exit `0`)
  - `node --check` on `scripts/*.mjs` & `tests/e2e/**/*.mjs` + CLI exit-code-`2` guard checks → all exit `2`
- **Targeted Stress Verification (Round 3 `BLOCKER-R3-1` Mojo `StorageArea` IPC Fix)**:
  - **`E2E-T1-05` 15-iteration consecutive stress (`03:33:29Z`–`03:35:27Z`)**: `15/15 PASS`, `0 FAIL`, `runtimeErrors=0` (every run converged with `metaRev >= 2` and identical merged fields across `pageA` and `pageB`, exit code `0`)
  - **`R7-2` 3-iteration consecutive stress (`03:35:27Z`–`03:36:23Z`)**: `3/3 PASS` (`18479ms`, `17320ms`, `16389ms`; total durations `19462ms`, `18342ms`, `17502ms`), `0 FAIL`, `0 ERROR`, `runtimeErrors=0` (exit code `0`)
- **Regression Suite**:
  - **Full 60-suite run (`npm run test:regression -- --report <scratch>/reg.json`, `03:36:39Z`–`03:42:56Z`)**: `60/60 PASS` (`R7-1` `17305ms`, `R7-2` `16420ms`, `R7-3` `8066ms`), `0 FAIL`, `0 ERROR`, `0 SKIPPED`, `runtimeErrors=0`, `duration=376532ms` (`schemaVersion: 2`, Chrome `158.0.8127.36`, `1440×900`, exit code `0`)
  - **Coverage**: `M1-1..M4-4` (19) + `P1-1..P5-1` (5) + `R2-1..R2-7` (7) + `R3-1..R6-3` (13) + `Q0-1..Q2-5` (13) + `R7-1..R7-3` (3)
- **E2E Ordered Tier-by-Tier Verification (`npm run test:e2e -- --tier <1|2|3|4>`)**:
  - **Tier 1** (`--tier 1`, `03:43:05Z`–`03:45:13Z`): `31/31 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=127054ms`, tests `126642ms`, exit `0`)
  - **Tier 2** (`--tier 2`, `03:45:13Z`–`03:46:03Z`): `12/12 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=49175ms`, tests `48651ms`, exit `0`)
  - **Tier 3** (`--tier 3`, `03:46:03Z`–`03:46:56Z`): `10/10 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=51951ms`, tests `51303ms`, exit `0`)
  - **Tier 4** (`--tier 4`, `03:46:56Z`–`03:47:15Z`): `3/3 PASS`, `0 FAIL`, `runtimeErrors=0` (`elapsed=17927ms`, tests `17467ms`, exit `0`)
- **E2E Combined Run (`npm run test:e2e -- --report <scratch>/e2e.json`, `03:47:15Z`–`03:51:17Z`)**:
  - **Total**: `56/56 PASS`, `0 FAIL`, `runtimeErrors=0`, `elapsed=240648ms` (`schemaVersion: 1`, Tier 1 `127053ms`, Tier 2 `45039ms`, Tier 3 `50287ms`, Tier 4 `17768ms`, exit code `0`)

## Historical Baseline Execution Results (Pre-M2 @ `29daf69`, M0+M1 merged, M2–M6 not yet merged)

- **Browser**: `/usr/bin/google-chrome` (Chrome 158, Chromium-based), viewport `1440×900`
- **Runtime errors (`console.error` / `pageerror`)**: **0** across all 56 tests
- **Harness crashes / timeouts / unhandled rejections**: **0** (`TIMEOUTS: []`, `WITH_RUNTIME_ERRORS: []`)
- **Total**: `4/56 PASS`, `52 FAIL` (`elapsed=276710ms`, exit code `1`)
- **Passed Test IDs**: `["E2E-T1-08", "E2E-T2-03", "E2E-T2-04", "E2E-T2-07"]`
- **Tier Results**:
  - **Tier 1**: `1/31 PASS`, `30 FAIL` (`177686ms`; `E2E-T1-08` passes because M1 toolchain & art manifest are merged; all 30 M2–M6 feature tests genuinely fail at their requirement assertions)
  - **Tier 2**: `3/12 PASS`, `9 FAIL` (`49264ms`; `E2E-T2-03` reload persistence, `E2E-T2-04` primary `QuotaExceededError` preservation & retry recovery, and `E2E-T2-07` invalid cloud code rejection pass on baseline; 9 M2–M6 boundary tests genuinely fail)
  - **Tier 3**: `0/10 PASS`, `10 FAIL` (`40335ms`; all 10 cross-feature M2–M6 tests genuinely fail)
  - **Tier 4**: `0/3 PASS`, `3 FAIL` (`8587ms`; all 3 end-to-end journeys genuinely fail on unimplemented M2–M6 gates)
- **Determinism & CLI Verification**:
  - `npm run test:e2e -- --filter '/E2E-T1-07|E2E-T1-31|E2E-T3-10/'` (3 consecutive runs) → **3/3 deterministic FAIL** (`E2E-T1-07` fails on `prefers-reduced-motion` with 10s nav timeout; `E2E-T1-31` & `E2E-T3-10` use 320px + 40-frame rAF wait and deterministically fail `150 !== 100`, `160 !== 120`, `runtimeErrors=0`, exit code `1`).
  - `npm run test:e2e -- --report <tmp>/baseline.json` → exit code `1`, valid `schemaVersion: 1` JSON written.
  - `npm run test:e2e -- --tier 1 --filter E2E-T1-08` → `1/1 PASS`, exit code `0`.
  - `CHROMIUM_PATH=/nonexistent node tests/e2e/run.mjs --tier 1 --filter E2E-T1-08` → `[E2E BOOTSTRAP ERROR] CHROMIUM_PATH does not exist: /nonexistent`, exit code `2`.
  - `node tests/e2e/run.mjs --tier 1 --filter '/E2E-T1-0[1-4]/g' --timeout 1 --fail-fast` → matches all `4` tests (stateful `/g` flag stripped).
  - `node tests/e2e/run.mjs --filter '/[unterminated/'` → `[E2E CLI ERROR] Invalid --filter regex: ...`, exit code `2`.
  - `node tests/e2e/run.mjs --filter` and `--filter --tier 1` → `[E2E CLI ERROR] Missing value for --filter`, exit code `2`.
