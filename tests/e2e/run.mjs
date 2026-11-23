#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  PUBLIC_DIR,
  loadChromium,
  resolveExecutablePath,
  startStaticServer,
  createTestEnv
} from "./lib/harness.mjs";
import * as tier1 from "./tiers/tier1-features.mjs";
import * as tier2 from "./tiers/tier2-boundaries.mjs";
import * as tier3 from "./tiers/tier3-combinations.mjs";
import * as tier4 from "./tiers/tier4-journeys.mjs";

const ALL_TIERS = [tier1, tier2, tier3, tier4];

function printHelp() {
  console.log(`Usage: node tests/e2e/run.mjs [options]

Options:
  --tier <1|2|3|4|all>   Run specific tier(s), comma-separated (default: all)
  --filter <pattern>     Filter tests by ID, title, or feature (substring or /regex/i)
  --report <file>        Write structured JSON report to <file>
  --url <url>            Use an external HTTP URL instead of built-in static server
  --timeout <ms>         Per-test timeout in ms (default: 25000)
  --fail-fast            Stop immediately on first failing test
  -h, --help             Show this help message
`);
}

function parseArgs(argv) {
  const opts = {
    tier: "all",
    filter: "",
    report: "",
    url: "",
    timeoutMs: 25000,
    failFast: false,
    help: false
  };

  function consumeFlagValue(index, flag) {
    if (index + 1 >= argv.length) {
      throw new Error(`Missing value for ${flag}`);
    }
    const next = argv[index + 1];
    if (next.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`);
    }
    return next;
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      opts.help = true;
    } else if (arg === "--fail-fast") {
      opts.failFast = true;
    } else if (arg === "--tier") {
      opts.tier = consumeFlagValue(i, arg);
      i += 1;
    } else if (arg.startsWith("--tier=")) {
      opts.tier = arg.slice("--tier=".length);
    } else if (arg === "--filter") {
      opts.filter = consumeFlagValue(i, arg);
      i += 1;
    } else if (arg.startsWith("--filter=")) {
      opts.filter = arg.slice("--filter=".length);
    } else if (arg === "--report") {
      opts.report = consumeFlagValue(i, arg);
      i += 1;
    } else if (arg.startsWith("--report=")) {
      opts.report = arg.slice("--report=".length);
    } else if (arg === "--url") {
      opts.url = consumeFlagValue(i, arg);
      i += 1;
    } else if (arg.startsWith("--url=")) {
      opts.url = arg.slice("--url=".length);
    } else if (arg === "--timeout") {
      opts.timeoutMs = Number(consumeFlagValue(i, arg));
      i += 1;
    } else if (arg.startsWith("--timeout=")) {
      opts.timeoutMs = Number(arg.slice("--timeout=".length));
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }

  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs <= 0) {
    throw new Error(`Invalid --timeout value: ${opts.timeoutMs}`);
  }
  return opts;
}

function parseTierSelection(tierArg) {
  if (!tierArg || tierArg.toLowerCase() === "all") {
    return new Set([1, 2, 3, 4]);
  }
  const parts = tierArg.split(",").map((s) => s.trim()).filter(Boolean);
  const selected = new Set();
  for (const p of parts) {
    const num = Number(p);
    if (![1, 2, 3, 4].includes(num)) {
      throw new Error(`Invalid tier '${p}'. Expected 1, 2, 3, 4, or all.`);
    }
    selected.add(num);
  }
  return selected;
}

function buildFilterMatcher(pattern) {
  if (!pattern) return () => true;
  const regexMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
  if (regexMatch) {
    const flags = (regexMatch[2] || "i").replace(/[gy]/g, "");
    const rx = new RegExp(regexMatch[1], flags);
    return (t) => rx.test(`${t.id} ${t.title} ${(t.features || []).join(" ")}`);
  }
  const needle = pattern.toLowerCase();
  return (t) => `${t.id} ${t.title} ${(t.features || []).join(" ")}`.toLowerCase().includes(needle);
}

async function runWithTimeout(promise, timeoutMs, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Test timed out after ${timeoutMs}ms (${label})`);
      err.code = "E2E_TIMEOUT";
      reject(err);
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`[E2E CLI ERROR] ${err.message}`);
    process.exit(2);
  }

  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  let selectedTiers;
  try {
    selectedTiers = parseTierSelection(opts.tier);
  } catch (err) {
    console.error(`[E2E CLI ERROR] ${err.message}`);
    process.exit(2);
  }

  let matcher;
  try {
    matcher = buildFilterMatcher(opts.filter);
  } catch (err) {
    console.error(`[E2E CLI ERROR] Invalid --filter regex: ${err.message}`);
    process.exit(2);
  }

  const plan = [];
  for (const mod of ALL_TIERS) {
    if (!selectedTiers.has(mod.tier)) continue;
    for (const t of mod.tests) {
      if (matcher(t)) {
        plan.push({ ...t, tier: mod.tier, tierName: mod.name });
      }
    }
  }

  if (plan.length === 0) {
    console.error(`[E2E CLI ERROR] No tests matched --tier "${opts.tier}" --filter "${opts.filter}".`);
    process.exit(2);
  }

  let chromium;
  let execPath;
  try {
    chromium = await loadChromium();
    execPath = resolveExecutablePath();
  } catch (err) {
    console.error(`[E2E BOOTSTRAP ERROR]\n${err.message}`);
    process.exit(2);
  }
  const suiteStart = Date.now();
  let staticServer = null;
  let browser = null;

  const results = [];
  const byTier = {};
  let totalRuntimeErrors = 0;

  try {
    let targetUrl = opts.url;
    if (!targetUrl) {
      staticServer = await startStaticServer(PUBLIC_DIR);
      targetUrl = staticServer.url;
    }

    browser = await chromium.launch({
      ...(execPath ? { executablePath: execPath } : {}),
      headless: true,
      args: ["--no-sandbox", "--disable-gpu"]
    });

    console.log(
      `[E2E] Running ${plan.length} test(s) | viewport=1440x900 | browser=${execPath || "playwright-default"} | url=${targetUrl}`
    );

    for (const testCase of plan) {
      const tStart = Date.now();
      const env = await createTestEnv(browser, targetUrl, { actionTimeoutMs: 5000 });
      let ok = false;
      let errMsg = "";
      let errKind = "";

      try {
        await runWithTimeout(
          Promise.resolve().then(() => testCase.fn(env)),
          opts.timeoutMs,
          testCase.id
        );
        env.assertZeroRuntimeErrors();
        ok = true;
      } catch (err) {
        ok = false;
        errMsg = (err?.message || String(err)).replace(/\s+/g, " ").trim();
        errKind = err?.code || err?.name || "Error";
      } finally {
        await env.cleanup();
      }

      const durationMs = Date.now() - tStart;
      const runtimeErrors = [...env.runtimeErrors];
      totalRuntimeErrors += runtimeErrors.length;

      const record = {
        id: testCase.id,
        tier: testCase.tier,
        title: testCase.title,
        features: testCase.features || [],
        ok,
        durationMs,
        error: ok ? null : errMsg,
        errorKind: ok ? null : errKind,
        runtimeErrors
      };
      results.push(record);

      const tierKey = String(testCase.tier);
      if (!byTier[tierKey]) {
        byTier[tierKey] = { total: 0, passed: 0, failed: 0, durationMs: 0 };
      }
      byTier[tierKey].total += 1;
      byTier[tierKey].durationMs += durationMs;
      if (ok) byTier[tierKey].passed += 1;
      else byTier[tierKey].failed += 1;

      const statusTag = ok ? "PASS" : "FAIL";
      const rtTag = runtimeErrors.length > 0 ? ` [runtimeErrors=${runtimeErrors.length}]` : "";
      const detail = ok ? "" : ` — ${errMsg.slice(0, 140)}`;
      console.log(`  [${statusTag}] ${testCase.id} (${durationMs}ms)${rtTag} ${testCase.title}${detail}`);

      if (!ok && opts.failFast) break;
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (staticServer) await staticServer.close().catch(() => {});
  }

  const totalDurationMs = Date.now() - suiteStart;
  const passedCount = results.filter((r) => r.ok).length;
  const failedCount = results.length - passedCount;

  console.log("\n=== E2E Summary ===");
  for (const tierKey of Object.keys(byTier).sort()) {
    const s = byTier[tierKey];
    console.log(
      `  Tier ${tierKey}: ${s.passed}/${s.total} PASS, ${s.failed} FAIL (${s.durationMs}ms)`
    );
  }
  console.log(
    `  TOTAL : ${passedCount}/${results.length} PASS, ${failedCount} FAIL | runtimeErrors=${totalRuntimeErrors} | elapsed=${totalDurationMs}ms`
  );

  if (opts.report) {
    const reportPath = path.resolve(opts.report);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    const payload = {
      schemaVersion: 1,
      passed: failedCount === 0 && results.length > 0,
      timestamp: new Date().toISOString(),
      durationMs: totalDurationMs,
      viewport: "1440x900",
      browser: execPath || "playwright-default",
      cli: {
        tier: opts.tier,
        filter: opts.filter,
        timeoutMs: opts.timeoutMs,
        failFast: opts.failFast
      },
      summary: {
        total: results.length,
        passed: passedCount,
        failed: failedCount,
        runtimeErrorCount: totalRuntimeErrors
      },
      byTier,
      results
    };
    fs.writeFileSync(reportPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    console.log(`[E2E] JSON report written to ${reportPath}`);
  }

  process.exit(failedCount === 0 && results.length > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(`[E2E FATAL] ${err?.stack || err}`);
  process.exit(2);
});
