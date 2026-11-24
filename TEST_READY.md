# E2E Acceptance Suite Ready (`TEST_READY.md`)

- **Restored In**: `codex/q0-infra-and-tests` (F04, extracted read-only from `origin/codex/e2e-suite` @ `34f6dd52` and statically audited against M2–M6 `web/public/playable-v2.html`)
- **Latest Full-Pass Verification**: `codex/e2e-pass` (M7a, based on `origin/main` @ `6946074`, post-M2–M6 + Q0–Q2 + ported `7ca198c` runtime fixes P1–P10, PR #23 P11, Round 1 & Round 2 gate fixes: dual-error corrupt/read-only/quota HUD recovery with immediate user-initiated write-failure feedback & off-`BODY` focus preservation, atomic conflict overwrite under quota failure, cutscene popover focus retention, and 15-field `META_KEY` CRDT D1–D4 + live corrupt-meta `R2-D1` protection; plus Round 3 test-only `BLOCKER-R3-1` Chromium Mojo `StorageArea` IPC convergence hardening in `E2E-T1-05` & `R7-2` Part E)
- **Runner Command**: `npm ci && npm run test:e2e`
- **Scoped Runs**:
  - Single tier: `npm run test:e2e -- --tier 1` (supports `1`, `2`, `3`, `4`, comma-separated e.g. `1,2`, or `all`)
  - Filtered run: `npm run test:e2e -- --filter <substring|/regex/i>`
  - JSON report: `npm run test:e2e -- --report <file>`
- **Environment**: Built-in cached static HTTP server (`web/public`, `127.0.0.1` ephemeral port), `1440×900` desktop Chromium/Chrome (`CHROMIUM_PATH` fallback `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`), fresh isolated `BrowserContext` per test, strict `0` `console.error` / `pageerror` gate.
- **Current Verification Status (M7a — 100% PASS)**: Full 1440×900 desktop Chrome/Chromium automated verification completed post-M2–M6, Q0–Q2 (PR #20–#23), M7a runtime + Round 1 & Round 2 Challenger fixes, and Round 3 test-only Mojo `StorageArea` IPC hardening (`BLOCKER-R3-1`): **15/15 `E2E-T1-05` stress PASS**, **3/3 `R7-2` stress PASS**, **56/56 E2E PASS (0 FAIL, 0 runtime errors)** across Tier 1→4, and **60/60 Regression PASS (0 FAIL, 0 runtime errors)** (`vm.Script` inline JS syntax check & `art:manifest:check` PASS). Per user directive (`ORIGINAL_REQUEST.md`), no separate manual smoke test was run; static HTTP end-user verification is fulfilled by the automated 1440×900 isolated-context suites. Historical pre-M2 baseline (`29daf69`) is preserved at the bottom.

## Tier Breakdown (56 Tests Total)

| Tier | File | Test Count | Focus |
|---|---|---|---|
| Tier 1 | `tests/e2e/tiers/tier1-features.mjs` | 31 | Isolated feature coverage across all `PROJECT.md § Feature Inventory` items (T1–T9, S1–S11, G1–G12) |
| Tier 2 | `tests/e2e/tiers/tier2-boundaries.mjs` | 12 | Boundary & corner cases, including all 5 mandatory save scenarios (fresh start, legacy `eb0ea67` resume/migration, reload, `QuotaExceededError`, multi-tab contention) |
| Tier 3 | `tests/e2e/tiers/tier3-combinations.mjs` | 10 | Cross-feature pairwise combinations |
| Tier 4 | `tests/e2e/tiers/tier4-journeys.mjs` | 3 | Real-world end-user gameplay journeys |

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

## Latest Post-M2–M6 / Q0–Q2 / M7a Verification Results (100% PASS)

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
