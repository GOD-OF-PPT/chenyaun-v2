# E2E Acceptance Suite Ready (`TEST_READY.md`)

- **Restored In**: `codex/q0-infra-and-tests` (F04, extracted read-only from `origin/codex/e2e-suite` @ `34f6dd52` and statically audited against M2–M6 `web/public/playable-v2.html`)
- **Runner Command**: `npm ci && npm run test:e2e`
- **Scoped Runs**:
  - Single tier: `npm run test:e2e -- --tier 1` (supports `1`, `2`, `3`, `4`, comma-separated e.g. `1,2`, or `all`)
  - Filtered run: `npm run test:e2e -- --filter <substring|/regex/i>`
  - JSON report: `npm run test:e2e -- --report <file>`
- **Environment**: Built-in static HTTP server (`web/public`, `127.0.0.1` ephemeral port), `1440×900` desktop Chromium/Chrome (`CHROMIUM_PATH` fallback `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`), fresh isolated `BrowserContext` per test, strict `0` `console.error` / `pageerror` gate.
- **Current Verification Status (Phase 1)**: Static syntax & M2–M6 selector/flow audit completed (`node --check`, `--help`, art-manifest `--check`). Full post-M2–M6 Chromium execution is scheduled for Phase 2 once all Q0–Q6 code PRs merge to `main` (historical pre-M2 baseline from `29daf69` is preserved below).

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

## Baseline Execution Results (against `origin/main` @ `29daf69`, M0+M1 merged, M2–M6 not yet merged)

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
