# Test Infrastructure (`TEST_INFRA.md`)

## Overview
Opaque-box, requirement-driven E2E Acceptance Test Suite for **《尘缘问道 · 剑阵万象》** (`web/public/playable-v2.html`), derived from `ORIGINAL_REQUEST.md` and `PROJECT.md § Feature Inventory`.

## Entry Point & CLI
- **Runner**: `tests/e2e/run.mjs`
- **Invocation**:
  - `npm ci && npm run test:e2e` (runs `node tests/e2e/run.mjs`)
  - `npm run test:e2e -- --tier <1|2|3|4|all>` — run a specific tier or comma-separated tiers (default: `all`)
  - `npm run test:e2e -- --filter <substring|/regex/i>` — filter test cases by ID, title, or feature
  - `npm run test:e2e -- --report <file>` — write structured JSON report to `<file>`
  - `npm run test:e2e -- --url <url>` — target an external `http:`/`https:` static HTTP URL instead of the built-in server
  - `npm run test:e2e -- --timeout <ms>` — per-test timeout in milliseconds (`1..2147483647`, default: `25000`; dynamically scales per-test navigation/action timeouts)
  - `npm run test:e2e -- --fail-fast` — stop on first failure
- **Exit Code**: `0` when all selected tests pass with 0 console/page errors, 0 harness errors, and no signal abort (`SIGINT`/`SIGTERM`); `1` on any test failure or signal abort; `2` on CLI/bootstrap errors (including invalid or empty-value `--flag=` / missing-value flags, non-integer or out-of-range `--timeout`, empty `--tier` segments like `1,,2`, invalid `--url` protocol, empty `//` or unterminated `/regex` `--filter`, duplicate test IDs, nonexistent `CHROMIUM_PATH`, missing `playwright-core`, or 0 tests matched by `--filter`).

## Runtime Environment
- **Static HTTP Server**: Built-in Node `http` server bound to `127.0.0.1` on an ephemeral port (`0`), serving `web/public/` with entry `/playable-v2.html`, per-server in-memory `fileCache`, `Content-Length`, `HEAD` support, `Cache-Control: no-store`, and `server.closeAllConnections?.()` teardown.
- **Browser**: Desktop Chromium/Chrome via `playwright-core@1.65.1` (uses `process.env.CHROMIUM_PATH` when set—failing fast with exit code `2` if nonexistent—otherwise falls back to `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/usr/bin/google-chrome`, e.g., `/usr/bin/google-chrome` on Linux hosts).
- **Viewport**: `1440×900` desktop viewport.
- **Isolation**: Every test case runs in a fresh `browser.newContext({ viewport: { width: 1440, height: 900 } })` with clean `localStorage` and attached `console` (`error`) + `pageerror` listeners (0 errors required).
- **Dependency Resolution**: `loadChromium()` resolves `playwright-core` from `node_modules` (installed via `npm ci`), `web/node_modules`, or `NODE_PATH`.

## Directory Structure & Canonical Tier 1–4 Definitions
- `tests/e2e/run.mjs` — CLI runner, static server, browser lifecycle, reporting (`schemaVersion: 1`)
- `tests/e2e/lib/harness.mjs` — shared page helpers, error listeners, UI/DOM/focus helpers, static server & Playwright loader
- `tests/e2e/lib/fixtures.mjs` — dynamic save fixture builders (`eb0ea67` envelope v2 with FNV-1a checksum, corrupt saves, cloud codes, canonical M5 step IDs & 15 Dao Law IDs)
- `tests/e2e/tiers/tier1-features.mjs` — **Tier 1 (31 tests)**: Isolated feature acceptance across all `PROJECT.md § Feature Inventory` items (T1–T9, S1–S11, G1–G12)
- `tests/e2e/tiers/tier2-boundaries.mjs` — **Tier 2 (12 tests)**: Boundary & corner cases, including all 5 mandatory save scenarios (fresh start, legacy `eb0ea67` resume/migration, reload, `QuotaExceededError`, multi-tab contention)
- `tests/e2e/tiers/tier3-combinations.mjs` — **Tier 3 (10 tests)**: Cross-feature pairwise combinations
- `tests/e2e/tiers/tier4-journeys.mjs` — **Tier 4 (3 tests)**: Real-world end-user gameplay journeys

## Opaque-Box & Compliance Rules
1. Assertions inspect observable UI text, DOM state, focus/accessibility behavior, `localStorage`, and (for T8/T9) repo files/scripts.
2. `window.__CHENYUAN_V25__` (and legacy debug globals) are used **only** for setting up preconditions (e.g., reaching a late realm or spawning a boss), never for asserting internal implementation details.
3. All save fixtures (including `eb0ea67`-format legacy saves and corrupted saves) are generated dynamically in code; no real player saves are committed.
4. Executed unconditionally in `.github/workflows/e2e.yml` (`npm run test:e2e -- --report test-results/e2e-report.json`) alongside the 60-suite regression runner (`npm run test:regression`, covering M1–M4, P1–P5, R2–R7, and Q0–Q2; `schemaVersion: 2` report) and art provenance check (`npm run art:manifest:check`).
