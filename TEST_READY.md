# E2E Acceptance Suite Ready (`TEST_READY.md`)

- **Restored In**: `codex/q0-infra-and-tests` (F04, extracted read-only from `origin/codex/e2e-suite` @ `34f6dd52` and statically audited against M2–M6 `web/public/playable-v2.html`)
- **Latest Full-Pass Verification**: `codex/adversarial-hardening` (M7b Round 5, merged `origin/main` PR #24 Q3 F19–F23 @ `fc9004fa`, PR #26 Q4 F24–F29 @ `4b86533c`, PR #27 Q5 F30–F33 modular source @ `df5efdab`, PR #28 Q6 F34–F37 @ `5115b8e8`, & PR #29 Q7 F38 @ `fffcb721` via `6a501a66`, fixing `Q6-1` `isReducedMotionActive()` CI flake plus all 19 Round 1 `A-1..A-11`/`B-1..B-8`, 13 Round 2 `R2A-1..R2A-6`/`R2B-1..R2B-6`/`DEFECT-R1-2A/2B/2C`, 12 Round 3 `R3A-1..R3A-5`/`DEFECT-R2-2A/2B/2C`/`R3B-1..R3B-5` + PR #26 sandbox-exit guard & `DOC-1`, 6 Round 4 `R4A-1`/`DEFECT-R3-2A`/`R4A-2`/`R4A-3`/`R4B-1`/`R4B-2`/`R4B-3`, and 5 Round 5 `R5A-1`/`R5A-2`/`R5B-1`/`R5B-2`/`R5B-3` + `NIT-DOC-1` defects, and permanently encoding `T5-1..T5-10` & `E2E-T5-01..14`)
- **Runner Command**: `npm ci && npm run build:check && npm run test:unit && npm run test:e2e`
- **Scoped Runs**:
  - Single tier: `npm run test:e2e -- --tier 1` (supports `1`, `2`, `3`, `4`, `5`, comma-separated e.g. `1,2`, or `all`)
  - Filtered run: `npm run test:e2e -- --filter <substring|/regex/i>`
  - JSON report: `npm run test:e2e -- --report <file>`
- **Environment**: Built-in cached static HTTP server (`web/public`, `127.0.0.1` ephemeral port), `1440×900` desktop Chromium/Chrome (`CHROMIUM_PATH` fallback `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`), fresh isolated `BrowserContext` per test, strict `0` `console.error` / `pageerror` gate.
- **Current Verification Status (M7b Round 5 — 100% PASS)**: Full 1440×900 desktop Chrome 158 automated verification completed post-PR #28 (`5115b8e8`) + PR #29 (`fffcb721`) lossless merge and M7b Round 5 hardening: **`npm run build:check` PASS** (`8660159 bytes, 115 WebP assets, 10 ESM modules, sha256=9ffcef16d4cb`), **32/32 Pure Node Unit Tests PASS (0 FAIL)** across 8 files, **70/70 E2E PASS (0 FAIL, 0 runtime errors)** across Tier 1→5, and **87/87 Regression PASS (0 FAIL, 0 runtime errors)** (`vm.Script` inline JS syntax check, single `arena.paused =` writer at `src/runtime/main.js:13214` / `web/public/playable-v2.html:20814`, `art:manifest:check`, `audit-economy.mjs --seed 20261124` 0 violations, `eval-combat-matrix.mjs --seed 20261124` 84 scenarios / 0 outliers, 31 `.mjs` `node --check`, byte-for-byte immutability of all 77 `origin/main` regression suites `L4..L11114` & tail and all 56 Tier 1–4 E2E tests, `T5` assertion count `406` [+64 vs Round 4 baseline `342`], and 8 CLI exit-code-`2` guards PASS). Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was run; static HTTP end-user verification is fulfilled by the automated 1440×900 isolated-context suites. Historical pre-M2 baseline (`29daf69`), M7a (`2b1ca3a`), and M7b Round 1–4 records are preserved below.

## Tier Breakdown (70 Tests Total)

| Tier | File | Test Count | Focus |
|---|---|---|---|
| Tier 1 | `tests/e2e/tiers/tier1-features.mjs` | 31 | Opaque-box isolated feature coverage across all `PROJECT.md § Feature Inventory` items (T1–T9, S1–S11, G1–G12) |
| Tier 2 | `tests/e2e/tiers/tier2-boundaries.mjs` | 12 | Opaque-box boundary & corner cases, including all 5 mandatory save scenarios (fresh start, legacy `eb0ea67` resume/migration, reload, `QuotaExceededError`, multi-tab contention) |
| Tier 3 | `tests/e2e/tiers/tier3-combinations.mjs` | 10 | Opaque-box cross-feature pairwise combinations |
| Tier 4 | `tests/e2e/tiers/tier4-journeys.mjs` | 3 | Opaque-box real-world end-user gameplay journeys |
| Tier 5 | `tests/e2e/tiers/tier5-adversarial.mjs` | 14 | White-box adversarial hardening (`E2E-T5-01..E2E-T5-14`) covering all 19 Round 1 (`A-1..A-11`, `B-1..B-8`), 13 Round 2 (`R2A-1..R2A-6`, `R2B-1..R2B-6`, `DEFECT-R1-2A/2B/2C`), 12 Round 3 (`R3A-1..R3A-5`, `DEFECT-R2-2A/2B/2C`, `R3B-1..R3B-5` + PR #26 sandbox-exit guard), 6 Round 4 (`R4A-1`/`DEFECT-R3-2A`, `R4A-2`, `R4A-3`, `R4B-1`, `R4B-2`, `R4B-3`), and 5 Round 5 (`R5A-1`, `R5A-2`, `R5B-1`, `R5B-2`, `R5B-3`) defects |

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

## Latest Post-M7b Round 5 Tier 5 Adversarial Hardening Verification Results (100% PASS)

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
