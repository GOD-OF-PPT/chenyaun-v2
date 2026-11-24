# E2E Acceptance Suite Ready (`TEST_READY.md`)

- **Restored In**: `codex/q0-infra-and-tests` (F04, extracted read-only from `origin/codex/e2e-suite` @ `34f6dd52` and statically audited against M2–M6 `web/public/playable-v2.html`)
- **Latest Full-Pass Verification**: `codex/adversarial-hardening` (M7b Round 2, merged `origin/main` PR #24 Q3 F19–F23 @ `fc9004fa`, fixing all 19 Round 1 defects `A-1..A-11`/`B-1..B-8` + all 13 Round 2 gate defects `R2A-1..R2A-6`/`R2B-1..R2B-6`/`DEFECT-R1-2A/2B/2C`, and encoding permanent Tier 5 regression `T5-1..T5-7` & E2E `E2E-T5-01..10`)
- **Runner Command**: `npm ci && npm run test:e2e`
- **Scoped Runs**:
  - Single tier: `npm run test:e2e -- --tier 1` (supports `1`, `2`, `3`, `4`, `5`, comma-separated e.g. `1,2`, or `all`)
  - Filtered run: `npm run test:e2e -- --filter <substring|/regex/i>`
  - JSON report: `npm run test:e2e -- --report <file>`
- **Environment**: Built-in cached static HTTP server (`web/public`, `127.0.0.1` ephemeral port), `1440×900` desktop Chromium/Chrome (`CHROMIUM_PATH` fallback `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`), fresh isolated `BrowserContext` per test, strict `0` `console.error` / `pageerror` gate.
- **Current Verification Status (M7b Round 2 — 100% PASS)**: Full 1440×900 desktop Chrome/Chromium automated verification completed post-PR #24 (`fc9004fa`) merge and M7b Round 2 hardening: **66/66 E2E PASS (0 FAIL, 0 runtime errors)** across Tier 1→5, and **72/72 Regression PASS (0 FAIL, 0 runtime errors)** (`vm.Script` inline JS syntax check, single `arena.paused =` writer at L18778, `art:manifest:check`, 12 `.mjs` `node --check`, byte-for-byte immutability of all 65 `origin/main` regression suites & 56 Tier 1–4 E2E tests, and 7 CLI exit-code-`2` guards PASS). Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was run; static HTTP end-user verification is fulfilled by the automated 1440×900 isolated-context suites. Historical pre-M2 baseline (`29daf69`), M7a (`2b1ca3a`), and M7b Round 1 records are preserved below.

## Tier Breakdown (66 Tests Total)

| Tier | File | Test Count | Focus |
|---|---|---|---|
| Tier 1 | `tests/e2e/tiers/tier1-features.mjs` | 31 | Isolated feature coverage across all `PROJECT.md § Feature Inventory` items (T1–T9, S1–S11, G1–G12) |
| Tier 2 | `tests/e2e/tiers/tier2-boundaries.mjs` | 12 | Boundary & corner cases, including all 5 mandatory save scenarios (fresh start, legacy `eb0ea67` resume/migration, reload, `QuotaExceededError`, multi-tab contention) |
| Tier 3 | `tests/e2e/tiers/tier3-combinations.mjs` | 10 | Cross-feature pairwise combinations |
| Tier 4 | `tests/e2e/tiers/tier4-journeys.mjs` | 3 | Real-world end-user gameplay journeys |
| Tier 5 | `tests/e2e/tiers/tier5-adversarial.mjs` | 10 | White-box adversarial hardening (`E2E-T5-01..E2E-T5-10`) covering all 19 Round 1 (`A-1..A-11`, `B-1..B-8`) & 13 Round 2 (`R2A-1..R2A-6`, `R2B-1..R2B-6`, `DEFECT-R1-2A/2B/2C`) defects |

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

## Latest Post-M7b Round 2 Tier 5 Adversarial Hardening Verification Results (100% PASS)

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
