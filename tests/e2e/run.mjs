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
import * as tier5 from "./tiers/tier5-adversarial.mjs";

const ALL_TIERS = [tier1, tier2, tier3, tier4, tier5];
const DEFAULT_TIMEOUT_MS = 25000;
const MAX_TIMEOUT_MS = 2147483647;

function printHelp() {
  console.log(`Usage: node tests/e2e/run.mjs [options]

Options:
  --tier <1|2|3|4|5|all> Run specific tier(s), comma-separated (default: all)
  --filter <pattern>     Filter tests by ID, title, or feature (substring or /regex/i)
  --report <file>        Write structured JSON report to <file>
  --url <url>            Use an external HTTP/HTTPS URL instead of built-in static server
  --timeout <ms>         Per-test timeout in ms (1..${MAX_TIMEOUT_MS}, default: ${DEFAULT_TIMEOUT_MS})
  --fail-fast            Stop immediately on first failing test
  -h, --help             Show this help message
`);
}

function parsePositiveInt(raw, flag, maxValue = Number.MAX_SAFE_INTEGER) {
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
    throw new Error(`Invalid ${flag} value: ${raw} (expected positive integer)`);
  }
  const num = Number(raw);
  if (!Number.isSafeInteger(num) || num < 1) {
    throw new Error(`Invalid ${flag} value: ${raw} (expected positive integer)`);
  }
  if (num > maxValue) {
    throw new Error(`Invalid ${flag} value: ${raw} (must be <= ${maxValue})`);
  }
  return num;
}

function parseArgs(argv) {
  const opts = {
    tier: "all",
    filter: "",
    report: "",
    url: "",
    timeoutMs: DEFAULT_TIMEOUT_MS,
    failFast: false,
    help: false
  };

  function consumeFlagValue(index, flag) {
    if (index + 1 >= argv.length) {
      throw new Error(`Missing value for ${flag}`);
    }
    const next = argv[index + 1];
    if (next === "" || next.startsWith("--") || next === "-h") {
      throw new Error(`Missing value for ${flag}`);
    }
    return next;
  }

  function consumeEqualsValue(arg, flag) {
    const val = arg.slice(flag.length + 1);
    if (val === "") {
      throw new Error(`Missing value for ${flag}`);
    }
    return val;
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
      opts.tier = consumeEqualsValue(arg, "--tier");
    } else if (arg === "--filter") {
      opts.filter = consumeFlagValue(i, arg);
      i += 1;
    } else if (arg.startsWith("--filter=")) {
      opts.filter = consumeEqualsValue(arg, "--filter");
    } else if (arg === "--report") {
      opts.report = consumeFlagValue(i, arg);
      i += 1;
    } else if (arg.startsWith("--report=")) {
      opts.report = consumeEqualsValue(arg, "--report");
    } else if (arg === "--url") {
      opts.url = consumeFlagValue(i, arg);
      i += 1;
    } else if (arg.startsWith("--url=")) {
      opts.url = consumeEqualsValue(arg, "--url");
    } else if (arg === "--timeout") {
      opts.timeoutMs = parsePositiveInt(consumeFlagValue(i, arg), "--timeout", MAX_TIMEOUT_MS);
      i += 1;
    } else if (arg.startsWith("--timeout=")) {
      opts.timeoutMs = parsePositiveInt(consumeEqualsValue(arg, "--timeout"), "--timeout", MAX_TIMEOUT_MS);
    } else {
      throw new Error(`Unknown CLI argument: ${arg}`);
    }
  }

  if (opts.url) {
    let parsedUrl;
    try {
      parsedUrl = new URL(opts.url);
    } catch {
      throw new Error(`Invalid --url value: ${opts.url}`);
    }
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error(`Invalid --url protocol '${parsedUrl.protocol}' (expected http: or https:)`);
    }
  }

  return opts;
}

function parseTierSelection(tierArg) {
  if (!tierArg || tierArg.trim() === "") {
    throw new Error("Invalid --tier value: expected 1, 2, 3, 4, 5, or all.");
  }
  if (tierArg.trim().toLowerCase() === "all") {
    return new Set([1, 2, 3, 4, 5]);
  }
  const rawParts = tierArg.split(",");
  const selected = new Set();
  for (const rawPart of rawParts) {
    const p = rawPart.trim();
    if (!p) {
      throw new Error(`Invalid --tier value '${tierArg}': empty tier segment.`);
    }
    if (!/^[1-5]$/.test(p)) {
      throw new Error(`Invalid tier '${p}'. Expected 1, 2, 3, 4, 5, or all.`);
    }
    selected.add(Number(p));
  }
  return selected;
}

function buildFilterMatcher(pattern) {
  if (!pattern) return () => true;
  if (pattern === "//") {
    throw new Error("Empty regular expression //");
  }
  const regexMatch = pattern.match(/^\/(.+)\/([a-zA-Z]*)$/);
  if (regexMatch) {
    const flags = (regexMatch[2] || "i").replace(/[gy]/g, "");
    const rx = new RegExp(regexMatch[1], flags);
    return (t) => rx.test(`${t.id} ${t.title} ${(t.features || []).join(" ")}`);
  }
  if (pattern.startsWith("/") && pattern.length > 1) {
    throw new Error(`Unterminated regular expression: ${pattern}`);
  }
  const needle = pattern.toLowerCase();
  return (t) => `${t.id} ${t.title} ${(t.features || []).join(" ")}`.toLowerCase().includes(needle);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const seenIds = new Set();
  for (const mod of ALL_TIERS) {
    for (const t of mod.tests) {
      if (seenIds.has(t.id)) {
        console.error(`[E2E CLI ERROR] Duplicate test ID detected in manifest: ${t.id}`);
        process.exit(2);
      }
      seenIds.add(t.id);
      if (selectedTiers.has(mod.tier) && matcher(t)) {
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

  const navigationTimeoutMs = Math.max(5000, Math.min(20000, Math.floor(opts.timeoutMs * 0.75)));
  const actionTimeoutMs = Math.max(3000, Math.min(8000, Math.floor(opts.timeoutMs * 0.3)));

  const suiteStart = Date.now();
  let staticServer = null;
  let browser = null;

  const results = [];
  const byTier = {};
  let totalRuntimeErrors = 0;
  let stopRequested = false;
  let abortedBySignal = false;

  const onSignal = (sig) => {
    abortedBySignal = true;
    stopRequested = true;
    console.error(`\n[E2E] Received ${sig}; draining active test cleanly...`);
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

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
      `[E2E] Running ${plan.length} test(s) | timeout=${opts.timeoutMs}ms | viewport=1440x900 | browser=${execPath || "playwright-default"} | url=${targetUrl}`
    );

    for (const testCase of plan) {
      if (stopRequested) break;
      const tStart = Date.now();
      const env = await createTestEnv(browser, targetUrl, { actionTimeoutMs, navigationTimeoutMs });
      let ok = false;
      let errMsg = "";
      let errKind = "";
      let timedOut = false;
      let testPromise = null;

      try {
        testPromise = Promise.resolve().then(() => testCase.fn(env));
        testPromise.catch(() => {});
        await runWithTimeout(testPromise, opts.timeoutMs, testCase.id);
        env.assertZeroRuntimeErrors();
        ok = true;
      } catch (err) {
        ok = false;
        timedOut = err?.code === "E2E_TIMEOUT" || err?.name === "TimeoutError";
        errMsg = (err?.message || String(err)).replace(/\s+/g, " ").trim();
        errKind = err?.code || err?.name || "Error";
      } finally {
        await env.cleanup();
        if (timedOut && testPromise) {
          await Promise.race([testPromise.catch(() => {}), delay(1500)]);
        }
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
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
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
      passed: failedCount === 0 && results.length > 0 && !abortedBySignal,
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

  process.exit(failedCount === 0 && results.length > 0 && !abortedBySignal ? 0 : 1);
}

main().catch((err) => {
  console.error(`[E2E FATAL] ${err?.stack || err}`);
  process.exit(2);
});
