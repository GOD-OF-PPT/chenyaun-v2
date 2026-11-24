#!/usr/bin/env node
/**
 * 《尘缘问道 · 剑阵万象》全量 1440×900 Chromium 自动化回归验收套件（M1–M4 + P1–P5 + R2–R7 + Q0–Q5 + T5 · 共 82 项）
 *
 * 用法：
 *   node scripts/verify-playable-v2.mjs
 *   node scripts/verify-playable-v2.mjs --filter M4
 *   node scripts/verify-playable-v2.mjs --screenshots test-results/shots --report test-results/regression-report.json
 *   node scripts/verify-playable-v2.mjs --url http://127.0.0.1:5174/playable-v2.html
 *   node scripts/verify-playable-v2.mjs --fail-fast --timeout 90000
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(REPO_ROOT, "web", "public");
const STORAGE_KEY = "chenyuan_wendao_v11_save";
const LEGACY_V10_KEY = "chenyuan_wendao_v10_save";
const META_KEY = "chenyuan_wendao_v11_meta";

// ==================== CLI ARGUMENTS ====================
const args = process.argv.slice(2);
function printHelp() {
  console.log(`Usage: node scripts/verify-playable-v2.mjs [options]
Options:
  --filter <substr>      Run only suites whose "<id>. <title>" matches <substr> (case-insensitive)
  --screenshots <dir>    Directory for milestone & failure screenshots (fail_<id>_<idx>.png)
  --report <path>        Write schemaVersion 2 JSON report unconditionally
  --url <url>            Test against an already-running playable-v2.html URL
  --fail-fast            Stop running remaining suites after the first failure (default: false)
  --timeout <ms>         Per-suite timeout in milliseconds (default: 90000)
  --help, -h             Show this help message`);
}

function parseCliArgs(argv) {
  const opts = {
    filter: "",
    screenshots: null,
    report: null,
    url: null,
    failFast: false,
    timeoutRaw: null,
    help: false
  };
  const valueFlags = new Set(["--filter", "--screenshots", "--report", "--url", "--timeout"]);
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      opts.help = true;
      continue;
    }
    if (token === "--fail-fast") {
      opts.failFast = true;
      continue;
    }
    let flag = token;
    let inlineVal = null;
    const eqIdx = token.indexOf("=");
    if (eqIdx > 0) {
      flag = token.slice(0, eqIdx);
      inlineVal = token.slice(eqIdx + 1);
    }
    if (valueFlags.has(flag)) {
      let val = inlineVal;
      if (val === null) {
        if (i + 1 >= argv.length || argv[i + 1].startsWith("--") || argv[i + 1] === "-h") {
          console.error(`Missing value for ${flag}`);
          process.exit(2);
        }
        val = argv[++i];
      }
      if (val === "") {
        console.error(`Empty value for ${flag}`);
        process.exit(2);
      }
      if (flag === "--filter") opts.filter = val;
      else if (flag === "--screenshots") opts.screenshots = val;
      else if (flag === "--report") opts.report = val;
      else if (flag === "--url") opts.url = val;
      else if (flag === "--timeout") opts.timeoutRaw = val;
      continue;
    }
    console.error(`Unknown argument: ${token}`);
    printHelp();
    process.exit(2);
  }
  return opts;
}

const CLI = parseCliArgs(args);
if (CLI.help) {
  printHelp();
  process.exit(0);
}
const FILTER = CLI.filter;
const SHOTS_DIR = CLI.screenshots;
const REPORT_PATH = CLI.report;
const EXPLICIT_URL = CLI.url;
const FAIL_FAST = CLI.failFast;
const TIMEOUT_RAW = CLI.timeoutRaw;
const SUITE_TIMEOUT_MS = TIMEOUT_RAW !== null ? Number(TIMEOUT_RAW) : 90000;
if (!Number.isFinite(SUITE_TIMEOUT_MS) || SUITE_TIMEOUT_MS <= 0) {
  console.error(`Invalid --timeout value: ${TIMEOUT_RAW}`);
  process.exit(2);
}

if (SHOTS_DIR) fs.mkdirSync(SHOTS_DIR, { recursive: true });

async function maybeShot(page, filename) {
  if (!SHOTS_DIR) return;
  await page.screenshot({ path: path.join(SHOTS_DIR, filename) });
}

// ==================== PLAYWRIGHT & STATIC SERVER BOOTSTRAP ====================
async function loadChromium() {
  const candidates = [
    path.join(REPO_ROOT, "web", "node_modules", "playwright-core", "index.mjs"),
    path.join(REPO_ROOT, "node_modules", "playwright-core", "index.mjs"),
    path.join(REPO_ROOT, "web", "node_modules", "playwright", "index.mjs"),
    path.join(REPO_ROOT, "node_modules", "playwright", "index.mjs")
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const mod = await import(pathToFileURL(p).href);
      if (mod && mod.chromium) return mod.chromium;
    }
  }
  for (const pkg of ["playwright-core", "playwright"]) {
    try {
      const mod = await import(pkg);
      if (mod && mod.chromium) return mod.chromium;
    } catch (_) {}
  }
  throw new Error("Playwright not found. Install playwright-core or playwright in web/node_modules or node_modules.");
}

function resolveExecutablePath() {
  if (process.env.CHROMIUM_PATH !== undefined && process.env.CHROMIUM_PATH !== "") {
    if (!fs.existsSync(process.env.CHROMIUM_PATH)) {
      console.error(`CHROMIUM_PATH does not exist: ${process.env.CHROMIUM_PATH}`);
      process.exit(2);
    }
    return process.env.CHROMIUM_PATH;
  }
  for (const p of ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"]) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg"
};

function startStaticServer(rootDir) {
  const fileCache = new Map();
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rawPath = (req.url || "/").split("?")[0];
      const safeRel = path.normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, "");
      const fullPath = path.join(rootDir, safeRel === "/" ? "playable-v2.html" : safeRel);
      if (!fullPath.startsWith(rootDir)) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      let cached = fileCache.get(fullPath);
      if (!cached) {
        if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
          res.writeHead(404);
          res.end("Not Found");
          return;
        }
        const ext = path.extname(fullPath).toLowerCase();
        cached = {
          buf: fs.readFileSync(fullPath),
          mime: MIME_TYPES[ext] || "application/octet-stream"
        };
        fileCache.set(fullPath, cached);
      }
      res.writeHead(200, {
        "Content-Type": cached.mime,
        "Content-Length": cached.buf.length,
        "Cache-Control": "no-store"
      });
      if (req.method === "HEAD") res.end();
      else res.end(cached.buf);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, url: `http://127.0.0.1:${addr.port}/playable-v2.html` });
    });
  });
}

// ==================== TEST HARNESS ====================
const results = [];
const allErrors = [];
const attachedErrorPages = new WeakSet();
let currentSuiteTracker = null;
let failFastTriggered = false;
let targetUrl = EXPLICIT_URL;
let staticServer = null;
const runStartedAt = Date.now();

function attachErrorListeners(page, label) {
  if (attachedErrorPages.has(page)) return;
  attachedErrorPages.add(page);
  const tracker = currentSuiteTracker;
  page.on("pageerror", (err) => {
    const msg = `[${label} pageerror] ${err.message}`;
    allErrors.push(msg);
    if (tracker) tracker.runtimeErrors.push(msg);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = `[${label} console.error] ${msg.text()}`;
      allErrors.push(text);
      if (tracker) tracker.runtimeErrors.push(text);
    }
  });
}

async function captureFailureScreenshots(suiteId, tracker) {
  if (!SHOTS_DIR || !tracker) return [];
  const safeId = String(suiteId).replace(/[^A-Za-z0-9_-]/g, "_");
  const saved = [];
  let idx = 0;
  for (const page of tracker.pages) {
    if (!page || page.isClosed()) continue;
    const filename = `fail_${safeId}_${idx}.png`;
    const outPath = path.join(SHOTS_DIR, filename);
    try {
      await page.screenshot({ path: outPath, fullPage: true, timeout: 5000 });
      saved.push(outPath);
      idx += 1;
    } catch (_) {}
  }
  return saved;
}

async function runSuite(id, title, fn) {
  const fullName = `${id}. ${title}`;
  if (FILTER && !fullName.toLowerCase().includes(FILTER.toLowerCase())) {
    results.push({
      id,
      title,
      status: "skipped",
      ok: null,
      durationMs: 0,
      error: null,
      errorKind: null,
      runtimeErrors: [],
      screenshots: []
    });
    return;
  }
  if (failFastTriggered) {
    results.push({
      id,
      title,
      status: "skipped",
      ok: null,
      durationMs: 0,
      error: "Skipped due to --fail-fast",
      errorKind: null,
      runtimeErrors: [],
      screenshots: []
    });
    return;
  }

  const started = Date.now();
  const tracker = {
    id,
    contexts: new Set(),
    pages: new Set(),
    runtimeErrors: [],
    runtimeErrorShots: [],
    aborted: false
  };
  currentSuiteTracker = tracker;
  process.stdout.write(`▶ ${fullName} ... `);
  let timer = null;

  try {
    await Promise.race([
      Promise.resolve().then(() => fn()),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const timeoutErr = new Error(`Suite ${id} timed out after ${SUITE_TIMEOUT_MS}ms`);
          timeoutErr.name = "TimeoutError";
          reject(timeoutErr);
        }, SUITE_TIMEOUT_MS);
      })
    ]);

    const durationMs = Date.now() - started;
    if (tracker.runtimeErrors.length > 0) {
      const screenshots = tracker.runtimeErrorShots.length > 0
        ? tracker.runtimeErrorShots.slice()
        : await captureFailureScreenshots(id, tracker);
      const errMsg = `Runtime console/page errors (${tracker.runtimeErrors.length}): ${tracker.runtimeErrors.join(" | ")}`;
      results.push({
        id,
        title,
        status: "failed",
        ok: false,
        durationMs,
        error: errMsg,
        errorKind: "runtime_error",
        runtimeErrors: tracker.runtimeErrors.slice(),
        screenshots
      });
      console.log(`FAIL (${durationMs}ms): ${errMsg}`);
      if (FAIL_FAST) failFastTriggered = true;
    } else {
      results.push({
        id,
        title,
        status: "passed",
        ok: true,
        durationMs,
        error: null,
        errorKind: null,
        runtimeErrors: [],
        screenshots: []
      });
      console.log(`PASS (${durationMs}ms)`);
    }
  } catch (err) {
    const durationMs = Date.now() - started;
    const isAssertion = Boolean(err && (err.code === "ERR_ASSERTION" || err.name === "AssertionError"));
    const status = isAssertion ? "failed" : "error";
    const errorKind = isAssertion ? "assertion" : (err && err.name === "TimeoutError" ? "timeout" : "error");
    const errMsg = err && err.message ? err.message : String(err);
    const liveShots = await captureFailureScreenshots(id, tracker);
    const screenshots = liveShots.length > 0 ? liveShots : tracker.runtimeErrorShots.slice();
    results.push({
      id,
      title,
      status,
      ok: false,
      durationMs,
      error: errMsg,
      errorKind,
      runtimeErrors: tracker.runtimeErrors.slice(),
      screenshots
    });
    console.log(`${status.toUpperCase()} (${durationMs}ms): ${errMsg}`);
    if (FAIL_FAST) failFastTriggered = true;
  } finally {
    if (timer) clearTimeout(timer);
    tracker.aborted = true;
    currentSuiteTracker = null;
    for (const ctx of Array.from(tracker.contexts)) {
      try {
        await ctx.close();
      } catch (_) {}
    }
    tracker.contexts.clear();
    tracker.pages.clear();
  }
}

async function newIsolatedContext(browser, extraOpts = {}) {
  const tracker = currentSuiteTracker;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...extraOpts });
  if (tracker && tracker.aborted) {
    try {
      await ctx.close();
    } catch (_) {}
    return ctx;
  }
  if (tracker) {
    tracker.contexts.add(ctx);
    const origNewPage = ctx.newPage.bind(ctx);
    ctx.newPage = async (...pageArgs) => {
      const page = await origNewPage(...pageArgs);
      if (!tracker.aborted) {
        tracker.pages.add(page);
        page.on("close", () => tracker.pages.delete(page));
      }
      return page;
    };
    const origClose = ctx.close.bind(ctx);
    ctx.close = async (...closeArgs) => {
      if (SHOTS_DIR && !tracker.aborted && tracker.runtimeErrors.length > 0 && tracker.runtimeErrorShots.length === 0) {
        const shots = await captureFailureScreenshots(tracker.id, tracker);
        tracker.runtimeErrorShots.push(...shots);
      }
      tracker.contexts.delete(ctx);
      return origClose(...closeArgs);
    };
  }
  return ctx;
}

async function dismissOpeningScroll(page, timeoutMs = 1500) {
  try {
    await page.waitForSelector("#story-dialogue-bar.open", { timeout: timeoutMs });
  } catch (_) {
    return false;
  }
  const skipBtn = await page.$("#story-dialogue-bar.open #btn-dlg-skip");
  if (skipBtn) {
    await skipBtn.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await page.waitForFunction(
    () => !document.getElementById("story-dialogue-bar")?.classList.contains("open"),
    { timeout: 3000 }
  );
  return true;
}

async function dismissActiveCutscene(page, timeoutMs = 900) {
  return dismissOpeningScroll(page, timeoutMs);
}

async function startCleanGamePage(browser, tag, markPrologueDone = true, { dismissOpening = true } = {}) {
  const ctx = await newIsolatedContext(browser);
  const page = await ctx.newPage();
  attachErrorListeners(page, tag);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#btn-start-new");
  await page.click("#btn-start-new");
  await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
  if (dismissOpening) {
    await dismissOpeningScroll(page);
  }
  await page.waitForTimeout(160);
  if (markPrologueDone) {
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.openingChoice = "help";
      api.saveGame();
    });
  }
  return { ctx, page };
}

// ==================== MAIN EXECUTION ====================
const execPath = resolveExecutablePath();
const chromium = await loadChromium();
if (!targetUrl) {
  const srv = await startStaticServer(PUBLIC_DIR);
  staticServer = srv.server;
  targetUrl = srv.url;
}

const browser = await chromium.launch({
  ...(execPath ? { executablePath: execPath } : {}),
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});
const browserVersion = browser.version();

try {
  // =========================================================================
  // MILESTONE 1 SUITES (M1-1 .. M1-7): Core Loop, Explicit Interaction & Save
  // =========================================================================
  await runSuite("M1-1", "Fresh Start, Pacing, Explicit Choice, Non-Auto Props, Focus Return & Safe Return-to-Title", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M1-1", false);

    const init = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return {
        realm: s.game.realm,
        xpCap: s.realmSpec.xpCap,
        openingChoice: s.game.openingChoice,
        rev: s.persistence.loadedSaveRev
      };
    });
    assert.equal(init.realm, "mortal");
    assert.equal(init.xpCap, 60);
    assert.equal(init.openingChoice, null);
    assert.ok(init.rev >= 1);

    await page.click("#btn-sanctum-hub");
    await page.waitForTimeout(280);
    const afterSanctum = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return {
        sanctumMode: s.arena.sanctumMode,
        openingChoice: s.game.openingChoice,
        props: s.arena.props.map(p => ({ id: p.id, kind: p.kind, x: p.x, y: p.y }))
      };
    });
    assert.equal(afterSanctum.sanctumMode, true);
    assert.equal(afterSanctum.openingChoice, null);

    const merch = afterSanctum.props.find(p => p.kind === "merchant_npc");
    assert.ok(merch, "Sanctum should have merchant_npc prop");
    await page.evaluate(({ x, y }) => {
      const s = window.__CHENYUAN_V25__.getState();
      s.arena.player.x = x;
      s.arena.player.y = y;
    }, merch);
    await page.waitForTimeout(320);

    const propHudState = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      const hud = document.getElementById("prop-interact-hud");
      return {
        drawerOpen: s.drawerOpen,
        hudDisplay: hud ? getComputedStyle(hud).display : "none",
        nearbyKind: s.arena.nearbyProp ? s.arena.nearbyProp.kind : null
      };
    });
    assert.equal(propHudState.drawerOpen, false);
    assert.equal(propHudState.nearbyKind, "merchant_npc");
    assert.equal(propHudState.hudDisplay, "flex");

    await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().drawerOpen), true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);

    // Blood altar must NOT auto-drain HP until explicitly confirmed
    const hpCheck = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      s.arena.props = [{
        id: "test_blood_altar", kind: "blood_altar", art: "prop_blood_altar",
        name: "血祭剑坛", badge: "献祭气血换飞剑", x: s.arena.player.x, y: s.arena.player.y, r: 40, progress: 0
      }];
      s.arena.nearbyProp = null;
      return { hpBefore: s.game.hp, bonusBefore: s.game.bonusSwords || 0 };
    });
    await page.waitForTimeout(380);
    const untouched = await page.evaluate(() => ({
      hp: window.__CHENYUAN_V25__.getState().game.hp,
      bonus: window.__CHENYUAN_V25__.getState().game.bonusSwords || 0,
      danger: document.getElementById("prop-interact-hud").classList.contains("danger-prop")
    }));
    assert.equal(untouched.hp, hpCheck.hpBefore);
    assert.equal(untouched.bonus, hpCheck.bonusBefore);
    assert.equal(untouched.danger, true);

    await page.click("#btn-prop-interact");
    await page.waitForTimeout(180);
    const afterSac = await page.evaluate(() => ({
      hp: window.__CHENYUAN_V25__.getState().game.hp,
      bonus: window.__CHENYUAN_V25__.getState().game.bonusSwords || 0
    }));
    assert.ok(afterSac.hp < hpCheck.hpBefore);
    assert.equal(afterSac.bonus, hpCheck.bonusBefore + 2);

    // Modal & Drawer keyboard focus capture + return
    await page.focus("#btn-open-settings");
    await page.click("#btn-open-settings");
    await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => document.getElementById("modal-content").contains(document.activeElement)), true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "btn-open-settings");

    await page.focus('.nav-tab-btn[data-tab="bag"]');
    await page.click('.nav-tab-btn[data-tab="bag"]');
    await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => document.getElementById("jade-panel").contains(document.activeElement)), true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("data-tab")), "bag");

    // Safe return-to-title + reload persistence
    await page.evaluate(() => { window.__CHENYUAN_V25__.getState().game.stones = 777; });
    await page.click("#btn-open-settings");
    await page.waitForTimeout(120);
    await page.click('[data-sys-tab="controls"]');
    await page.waitForTimeout(120);
    await page.click('[data-action="return-title-safe"]');
    await page.waitForTimeout(220);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save");
    await page.click("#btn-continue-save");
    await page.waitForTimeout(220);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones), 777);
    await ctx.close();
  });

  await runSuite("M1-2", "Real Defeat & Retreat Stakes (No Immortality / No Auto-Pill / 1x Revive Limit)", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M1-2", false);

    // M3 G3 single-hit cap guardrail: ordinary hurtPlayer(99999) MUST be capped at <= 45% maxHp
    const capCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const maxHp = api.getCombatStats(s.game).maxHp;
      s.game.hp = maxHp;
      s.arena.player.invuln = 0;
      s.arena.player.shieldHp = 0;
      api.hurtPlayer(99999);
      const dmgTaken = maxHp - s.game.hp;
      return { maxHp, hpAfter: s.game.hp, dmgTaken, capRatio: api.SINGLE_HIT_CAP_RATIO };
    });
    assert.ok(capCheck.hpAfter > 0, `Normal hurtPlayer(99999) must not one-shot full-HP player (hpAfter=${capCheck.hpAfter})`);
    assert.ok(
      capCheck.dmgTaken <= Math.ceil(capCheck.maxHp * (capCheck.capRatio || 0.45)) + 1,
      `Normal single hit (${capCheck.dmgTaken}) must respect 45% maxHp cap (maxHp=${capCheck.maxHp})`
    );

    await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      s.game.inventory.healing_pill = 1;
      s.game.stones = 333;
      s.arena.player.invuln = 0;
      window.__CHENYUAN_V25__.hurtPlayer(99999, { uncapped: true });
    });
    await page.waitForTimeout(180);

    const firstDefeat = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      const modal = document.getElementById("modal-backdrop");
      const pillBtn = document.querySelector('[data-defeat-act="revive-pill"]');
      return {
        hp: s.game.hp,
        pills: s.game.inventory.healing_pill,
        modalOpen: modal.classList.contains("open"),
        hasTitle: modal.textContent.includes("道心垂危"),
        pillEnabled: Boolean(pillBtn && !pillBtn.disabled)
      };
    });
    assert.equal(firstDefeat.hp, 0);
    assert.equal(firstDefeat.pills, 1);
    assert.equal(firstDefeat.modalOpen, true);
    assert.equal(firstDefeat.hasTitle, true);
    assert.equal(firstDefeat.pillEnabled, true);

    await page.click('[data-defeat-act="revive-pill"]');
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.defeatRevivesUsed), 1);

    await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      s.game.inventory.healing_pill = 5;
      s.game.gourd.charges = 5;
      s.arena.player.invuln = 0;
      window.__CHENYUAN_V25__.hurtPlayer(99999, { uncapped: true });
    });
    await page.waitForTimeout(180);
    const secondDefeat = await page.evaluate(() => ({
      pillDisabled: Boolean(document.querySelector('[data-defeat-act="revive-pill"]')?.disabled),
      gourdDisabled: Boolean(document.querySelector('[data-defeat-act="revive-gourd"]')?.disabled)
    }));
    assert.equal(secondDefeat.pillDisabled, true);
    assert.equal(secondDefeat.gourdDisabled, true);

    await page.click('[data-defeat-act="retreat-sanctum"]');
    await page.waitForTimeout(220);
    const afterRetreat = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return { sanctum: s.arena.sanctumMode, retreats: s.game.retreats, stones: s.game.stones, hp: s.game.hp };
    });
    assert.equal(afterRetreat.sanctum, true);
    assert.equal(afterRetreat.retreats, 1);
    assert.equal(afterRetreat.stones, 333);
    assert.ok(afterRetreat.hp > 0);
    await ctx.close();
  });

  await runSuite("M1-3", "Tribulation Preparation Ritual (Pill vs Defiant) & Lethal Tribulation Failure", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M1-3", false);

    // M3 S1 Boss-gate check: Qi -> Foundation tribulation must be blocked until Stage 1 Boss (守山石卫) is defeated
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "qi";
      s.game.xp = api.getState().realmSpec.xpCap;
      s.game.defeatedStageBosses = {};
      s.game.stageStars = {};
      s.game.inventory.foundation_pill = 1;
      s.game.inventory.healing_pill = 0;
      s.game.tribShield = 0;
      api.updateHud();
      api.startLiveTribulation();
    });
    await page.waitForTimeout(180);
    const bossGateBlocked = await page.evaluate(() => ({
      gotoBossVisible: Boolean(document.getElementById("btn-trib-goto-boss")),
      pillStartVisible: Boolean(document.querySelector('[data-trib-start="pill"]')),
      modalText: document.getElementById("modal-content")?.textContent || ""
    }));
    assert.equal(bossGateBlocked.gotoBossVisible, true, "Qi tribulation must show #btn-trib-goto-boss before Stage 1 Boss defeat");
    assert.equal(bossGateBlocked.pillStartVisible, false, "Qi tribulation must block [data-trib-start=pill] before Stage 1 Boss defeat");
    assert.ok(bossGateBlocked.modalText.includes("守山石卫"), `Boss-gate modal should name 守山石卫, got: ${bossGateBlocked.modalText}`);

    // Now record Stage 1 Boss defeat and open Tribulation Prep Ritual
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      api.closeModal();
      s.game.defeatedStageBosses[1] = true;
      s.game.stageStars[1] = 1;
      api.updateHud();
      api.startLiveTribulation();
    });
    await page.waitForTimeout(180);
    assert.equal(await page.isVisible('[data-trib-start="pill"]'), true);
    assert.equal(await page.isVisible('[data-trib-start="defiant"]'), true);

    await page.click('[data-trib-start="pill"]');
    await page.waitForTimeout(180);
    const pillTrib = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return { usedPill: s.arena.tribulation?.usedPill, totalBolts: s.arena.tribulation?.totalBolts, shield: s.game.tribShield };
    });
    assert.equal(pillTrib.usedPill, true);
    assert.equal(pillTrib.totalBolts, 3);
    assert.equal(pillTrib.shield, 3);

    await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      s.game.tribShield = 0;
      s.arena.player.invuln = 0;
      window.__CHENYUAN_V25__.hurtPlayer(99999, { uncapped: true });
    });
    await page.waitForTimeout(180);
    assert.equal(await page.isVisible('[data-defeat-act="abort-tribulation"]'), true);
    await page.click('[data-defeat-act="abort-tribulation"]');
    await page.waitForTimeout(220);
    const afterAbort = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return { fails: s.game.tribulationFails, xp: s.game.xp, expected: Math.round(s.realmSpec.xpCap * 0.75) };
    });
    assert.equal(afterAbort.fails, 1);
    assert.equal(afterAbort.xp, afterAbort.expected);

    await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      s.game.xp = s.realmSpec.xpCap;
      window.__CHENYUAN_V25__.startLiveTribulation();
    });
    await page.waitForTimeout(160);
    assert.equal(await page.isVisible("[data-trib-craft-pill]"), true);
    await page.click('[data-trib-start="defiant"]');
    await page.waitForTimeout(180);
    const defTrib = await page.evaluate(() => {
      const t = window.__CHENYUAN_V25__.getState().arena.tribulation;
      return { hardcore: t?.hardcore, totalBolts: t?.totalBolts };
    });
    assert.equal(defTrib.hardcore, true);
    assert.equal(defTrib.totalBolts, 5);
    await ctx.close();
  });

  await runSuite("M1-4", "Legacy v10 Save Load & Envelope v2 Checksum Upgrade", async () => {
    const ctx = await newIsolatedContext(browser);
    const page = await ctx.newPage();
    attachErrorListeners(page, "M1-4");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(({ legacyKey, primaryKey }) => {
      localStorage.removeItem(primaryKey);
      localStorage.setItem(legacyKey, JSON.stringify({
        game: { name: "旧卷剑修", realm: "qi", xp: 45, stones: 512, hp: 120, mp: 100, inventory: { herb: 4, healing_pill: 2 } },
        stageIdx: 0, stanceIdx: 0, towerMode: false, sanctumMode: true
      }));
    }, { legacyKey: LEGACY_V10_KEY, primaryKey: STORAGE_KEY });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save");
    await page.click("#btn-continue-save");
    await page.waitForTimeout(220);
    const upgraded = await page.evaluate((primaryKey) => {
      const s = window.__CHENYUAN_V25__.getState();
      const parsed = JSON.parse(localStorage.getItem(primaryKey));
      return { name: s.game.name, stones: s.game.stones, envVer: parsed.envelopeVersion, hasSum: Boolean(parsed.checksum) };
    }, STORAGE_KEY);
    assert.equal(upgraded.name, "旧卷剑修");
    assert.equal(upgraded.stones, 512);
    assert.equal(upgraded.envVer, 2);
    assert.equal(upgraded.hasSum, true);
    await ctx.close();
  });

  await runSuite("M1-5", "Corrupted Save Preservation & Checksum Tamper Detection Until Explicit Confirm", async () => {
    const ctx = await newIsolatedContext(browser);
    const page = await ctx.newPage();
    attachErrorListeners(page, "M1-5");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    const corruptPayload = "{BROKEN_SAVE_PAYLOAD_DO_NOT_DELETE::v11";
    await page.evaluate(({ key, val }) => localStorage.setItem(key, val), { key: STORAGE_KEY, val: corruptPayload });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#save-status-banner");

    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("save-status-banner")).display), "flex");
    await page.click("#btn-start-new");
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY), corruptPayload);
    await page.click('[data-modal-close="1"]');
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY), corruptPayload);

    await page.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify({
        envelopeVersion: 2, saveRev: 3, tabId: "other_tab", updatedAt: Date.now(), checksum: "00000000",
        game: { name: "篡改测试", realm: "mortal", stones: 99999 },
        stageIdx: 0, stanceIdx: 0, towerMode: false, sanctumMode: false
      }));
    }, STORAGE_KEY);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#save-status-banner");
    assert.ok((await page.textContent("#save-status-banner")).includes("校验和不匹配"));

    await page.click('[data-action="prompt-overwrite-corrupt"]');
    await page.waitForTimeout(140);
    await page.click('[data-action="confirm-overwrite-corrupt-new"]');
    await page.waitForTimeout(220);
    assert.equal(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).envelopeVersion, STORAGE_KEY), 2);
    await ctx.close();
  });

  await runSuite("M1-6", "Storage Write Failure (QuotaExceededError) Explicit HUD Alert & Recovery", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M1-6", false);
    const writeFail = await page.evaluate(() => {
      window.__origSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { throw new DOMException("Simulated quota full", "QuotaExceededError"); };
      const ok = window.__CHENYUAN_V25__.saveGame();
      const alertEl = document.getElementById("hud-save-alert");
      return { ok, display: getComputedStyle(alertEl).display, text: alertEl.textContent };
    });
    assert.equal(writeFail.ok, false);
    assert.equal(writeFail.display, "flex");
    assert.ok(writeFail.text.includes("QuotaExceededError"));

    await page.evaluate(() => { Storage.prototype.setItem = window.__origSetItem; });
    await page.click('[data-action="retry-save-now"]');
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("hud-save-alert")).display), "none");
    await ctx.close();
  });

  await runSuite("M1-7", "Multi-Tab Race Conflict Detection, Read-Only Protection & Latest Sync", async () => {
    const ctx = await newIsolatedContext(browser);
    const tabA = await ctx.newPage();
    attachErrorListeners(tabA, "M1-7A");
    await tabA.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabA.click("#btn-start-new");
    await tabA.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await dismissOpeningScroll(tabA);
    await tabA.evaluate(() => {
      window.__CHENYUAN_V25__.getState().game.stones = 100;
      window.__CHENYUAN_V25__.saveGame();
    });

    const tabB = await ctx.newPage();
    attachErrorListeners(tabB, "M1-7B");
    await tabB.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabB.waitForSelector("#btn-continue-save");
    await tabB.click("#btn-continue-save");
    await tabB.waitForTimeout(250);
    await tabB.click("#btn-sanctum-hub");
    await tabB.waitForTimeout(180);
    await tabB.evaluate(() => {
      window.__CHENYUAN_V25__.getState().game.stones = 999;
      window.__CHENYUAN_V25__.saveGame();
    });
    await tabA.waitForTimeout(300);

    const conflictA = await tabA.evaluate(() => ({
      hasConflict: Boolean(window.__CHENYUAN_V25__.getPersistenceState().saveConflictState),
      modalOpen: document.getElementById("modal-backdrop").classList.contains("open")
    }));
    assert.equal(conflictA.hasConflict, true);
    assert.equal(conflictA.modalOpen, true);

    await tabA.click('[data-action="stay-readonly-save"]');
    await tabA.waitForTimeout(180);
    const ro = await tabA.evaluate((k) => {
      window.__CHENYUAN_V25__.getState().game.stones = 55;
      return { saved: window.__CHENYUAN_V25__.saveGame(), storedStones: JSON.parse(localStorage.getItem(k)).game.stones };
    }, STORAGE_KEY);
    assert.equal(ro.saved, false);
    assert.equal(ro.storedStones, 999);

    await tabA.click('[data-action="load-latest-save"]');
    await tabA.waitForTimeout(220);
    assert.equal(await tabA.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones), 999);
    await ctx.close();
  });

  // =========================================================================
  // MILESTONE 2 SUITES (M2-1 .. M2-4): 5-Chapter Map, Boons, Gear & Rebalance
  // =========================================================================
  await runSuite("M2-1", "5-Chapter Continuous Progression (0->1->2->3 古修剑冢->4 九霄天门) & Tower Decoupling", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M2-1", true);
    const stgInfo = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      return { len: api.STAGES.length, s3Id: api.STAGES[3].id };
    });
    assert.equal(stgInfo.len, 5);
    assert.equal(stgInfo.s3Id, "sword_mound");

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "golden";
      api.initArenaStage(2, false);
    });
    await dismissActiveCutscene(page);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.dungeonMap.currentNodeId = "n4_0";
      s.arena.waveIdx = 4;
      s.arena.enemies = [];
      api.spawnCurrentWave();
    });
    await dismissActiveCutscene(page);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      for (const e of s.arena.enemies.slice()) api.handleEnemyDeath(e);
    });
    await page.waitForTimeout(700);
    for (let k = 0; k < 3; k++) {
      const keepSoulBtn = await page.$("#modal-backdrop.open #btn-soul-keep-current");
      if (!keepSoulBtn) break;
      await keepSoulBtn.click();
      await page.waitForTimeout(120);
    }
    await dismissActiveCutscene(page);
    await page.waitForSelector("#modal-backdrop.open #btn-volume-recap-confirm");
    const portalBeforeRecap2 = await page.evaluate(() =>
      window.__CHENYUAN_V25__.getState().arena.props.some(x => x.id === "portal_next")
    );
    assert.equal(portalBeforeRecap2, false, "portal_next must wait until Volume-End Recap modal is confirmed (Stage 2)");
    await page.click("#btn-volume-recap-confirm");
    await page.waitForFunction(() => !document.querySelector("#modal-backdrop.open #btn-volume-recap-confirm"));
    await page.waitForTimeout(80);
    for (let k = 0; k < 3; k++) {
      const keepSoulBtn = await page.$("#modal-backdrop.open #btn-soul-keep-current");
      if (!keepSoulBtn) break;
      await keepSoulBtn.click();
      await page.waitForTimeout(120);
    }
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const p2 = await page.evaluate(() => {
      const p = window.__CHENYUAN_V25__.getState().arena.props.find(x => x.id === "portal_next");
      return p ? { nextIdx: p.nextIdx, toTower: p.toTower } : null;
    });
    assert.equal(p2?.nextIdx, 3);
    assert.equal(p2?.toTower, false);

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.interactWithProp(api.getState().arena.props.find(x => x.id === "portal_next"));
    });
    await page.waitForTimeout(200);
    await dismissActiveCutscene(page);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.stageIdx), 3);

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.dungeonMap.currentNodeId = "n4_0";
      s.arena.waveIdx = 4;
      s.arena.enemies = [];
      api.spawnCurrentWave();
    });
    await dismissActiveCutscene(page);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      for (const e of s.arena.enemies.slice()) api.handleEnemyDeath(e);
    });
    await page.waitForTimeout(700);
    for (let k = 0; k < 3; k++) {
      const keepSoulBtn = await page.$("#modal-backdrop.open #btn-soul-keep-current");
      if (!keepSoulBtn) break;
      await keepSoulBtn.click();
      await page.waitForTimeout(120);
    }
    await dismissActiveCutscene(page);
    await page.waitForSelector("#modal-backdrop.open #btn-volume-recap-confirm");
    const portalBeforeRecap3 = await page.evaluate(() =>
      window.__CHENYUAN_V25__.getState().arena.props.some(x => x.id === "portal_next")
    );
    assert.equal(portalBeforeRecap3, false, "portal_next must wait until Volume-End Recap modal is confirmed (Stage 3)");
    await page.click("#btn-volume-recap-confirm");
    await page.waitForFunction(() => !document.querySelector("#modal-backdrop.open #btn-volume-recap-confirm"));
    await page.waitForTimeout(80);
    for (let k = 0; k < 3; k++) {
      const keepSoulBtn = await page.$("#modal-backdrop.open #btn-soul-keep-current");
      if (!keepSoulBtn) break;
      await keepSoulBtn.click();
      await page.waitForTimeout(120);
    }
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.props.find(x => x.id === "portal_next")?.nextIdx), 4);
    await ctx.close();
  });

  await runSuite("M2-2", "5-Layer Branching Expedition Star-Map, Run Boons Draft, Peaceful Spring & 3-Role Squad", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M2-2", true);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.realm = "foundation";
      api.initArenaStage(1, false);
    });
    await page.waitForTimeout(220);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      for (const e of api.getState().arena.enemies.slice()) api.handleEnemyDeath(e);
    });
    await page.waitForTimeout(650);
    await page.keyboard.press("Digit9");
    await page.waitForTimeout(180);
    await page.click('[data-dungeon-node="n1_0"]');
    await page.waitForTimeout(220);

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      for (const e of api.getState().arena.enemies.slice()) api.handleEnemyDeath(e);
    });
    await page.waitForTimeout(650);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.interactWithProp(api.getState().arena.props.find(p => p.kind === "boon_stele"));
    });
    await page.waitForTimeout(180);
    await page.click('[data-action="reroll-run-boon"]');
    await page.waitForTimeout(120);
    await page.click("[data-pick-run-boon]");
    await page.waitForTimeout(180);

    await page.click("#btn-dungeon-route");
    await page.waitForTimeout(140);
    await page.click('[data-dungeon-node="n2_1"]');
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.enemies.length), 0);

    await page.click("#btn-dungeon-route");
    await page.waitForTimeout(140);
    await page.click('[data-dungeon-node="n3_0"]');
    await page.waitForTimeout(250);
    const roles = await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.enemies.map(e => e.tacticalRole).filter(Boolean));
    assert.ok(roles.includes("shield_vanguard") && roles.includes("hex_chanter") && roles.includes("flank_assassin"));
    await ctx.close();
  });

  await runSuite("M2-3", "Non-Blocking Gear Pickup Compare Card & Lossless Quench Transfer", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M2-3", true);
    await page.click("#btn-sanctum-hub");
    await page.waitForTimeout(220);

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.equippedGear.weapon = {
        uid: "old_quenched_sw", slot: "weapon", rarity: 1, lvl: 5,
        name: "灵品·青竹灵剑", art: "icon_blade", atk: 14, hp: 0, dr: 0, crit: 0.04, spd: 0, bonusSword: 0, price: 60, sell: 24, power: 48
      };
      api.acquireGearItem({
        uid: "new_immortal_sw", slot: "weapon", rarity: 3, lvl: 0,
        name: "仙品·龙渊仙剑", art: "relic_frost_sword", atk: 26, hp: 0, dr: 0, crit: 0.09, spd: 0.04, bonusSword: 0, price: 180, sell: 95, power: 112
      });
    });
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.equippedGear.weapon.uid), "old_quenched_sw");
    await page.click('[data-action="compare-equip-transfer"]');
    await page.waitForTimeout(180);
    const after = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return { uid: s.game.equippedGear.weapon.uid, lvl: s.game.equippedGear.weapon.lvl };
    });
    assert.equal(after.uid, "new_immortal_sw");
    assert.equal(after.lvl, 5);
    await ctx.close();
  });

  await runSuite("M2-4", "Combat Rebalance Soft-Cap, Hex-Buff Mitigation & Posture-Shatter Boon", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M2-4", true);
    const bal = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "spirit";
      s.game.stones = 6000;
      s.game.statMultBonus = 2.4;
      s.game.laws = ["wealth_power", "age_might", "karma_resonance", "crit_lotus"];
      s.game.elapsedMonths = 1200;
      s.arena.runBoons = ["gold_alchemist", "posture_shatter", "vampiric_qi"];
      s.arena.player.boonOverloadTimer = 5.0;
      s.arena.weaponPosture = "xuanzhong";
      s.arena.reversedDomainTimer = 4.0;
      s.arena.astralForm = { active: true, mode: "demonic" };
      const st = api.getCombatStats(s.game);

      s.arena.enemies = [];
      api.spawnEnemyPack(["warden", "serpent", "wolf"], 820, 460, 40, 1.0, true);
      const e = s.arena.enemies[0];
      e.frontShieldHp = 0; e.wardHp = 0;
      e.hp = 5000; e.maxHp = 5000; e.posture = 500; e.maxPosture = 500;
      e.hexBuffTimer = 0;
      api.damageEnemy(e, 200, true, 10, 0, 0, false);
      const dmgUnbuffed = 5000 - e.hp;
      const hp1 = e.hp;
      e.hexBuffTimer = 2.0;
      api.damageEnemy(e, 200, true, 10, 0, 0, false);
      const dmgBuffed = hp1 - e.hp;
      e.hexBuffTimer = 0;
      e.posture = 5;
      const hpB = e.hp;
      api.damageEnemy(e, 50, false, 20, 0, 0, true);
      return { breakdown: st.statBreakdown, dmgUnbuffed, dmgBuffed, breakLoss: hpB - e.hp };
    });
    assert.ok(bal.breakdown.cappedPassivePct < bal.breakdown.rawPassivePct && bal.breakdown.cappedPassivePct < 3.20);
    assert.ok(bal.breakdown.activeMult <= 2.85);
    assert.ok(bal.dmgBuffed < bal.dmgUnbuffed * 0.82);
    assert.ok(bal.breakLoss >= Math.round(5000 * 0.18));
    await ctx.close();
  });

  // =========================================================================
  // MILESTONE 3 SUITES (M3-1 .. M3-4): Sanctum, Companions, Karma & Lifespan
  // =========================================================================
  await runSuite("M3-1", "Sanctum 5-Building Upgrades (Lv.1->Lv.5), 3rd Tower & Save Reload", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M3-1", true);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      game.realm = "golden";
      game.stones = 3000;
      Object.assign(game.inventory, { herb: 30, dew: 20, core: 20, jade: 20, lotus: 20, soul: 20, dao: 10 });
      api.enterSanctumHub();
    });
    await page.waitForTimeout(220);

    await page.click("#btn-sanctum-build");
    await page.waitForTimeout(160);
    for (const bId of ["cauldron", "cauldron", "sword_forge", "spirit_eye", "spirit_eye", "scripture_hall", "guard_array", "guard_array"]) {
      await page.click(`[data-upgrade-sanctum="${bId}"]`);
      await page.waitForTimeout(70);
    }
    await page.click('[data-modal-close="1"]');
    await page.waitForTimeout(160);

    const siegeTowers = await page.evaluate(() => {
      document.querySelector('[data-dojo-act="start-defense"]').click();
      return window.__CHENYUAN_V25__.getState().arena.sectDefense?.towers?.length || 0;
    });
    assert.equal(siegeTowers, 3);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save");
    await page.click("#btn-continue-save");
    await page.waitForTimeout(220);
    const lv = await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.sanctumLevels);
    assert.equal(lv.cauldron, 3);
    assert.equal(lv.guard_array, 3);
    assert.equal(lv.spirit_eye, 3);
    await ctx.close();
  });

  await runSuite("M3-2", "Companion Hub Modal, Portrait Story Choices, Tea/Spar & Post-Battle Commentary", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M3-2", true);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.realm = "qi";
      api.getState().game.stones = 200;
      api.enterSanctumHub();
      api.interactWithProp(api.getState().arena.props.find(p => p.id === "hub_lu"));
    });
    await page.waitForTimeout(180);
    await page.click('[data-play-story-bar="lu_intro"]');
    await page.waitForTimeout(180);
    assert.equal(await page.locator("#dlg-choices-box .dlg-choice-btn").count(), 2);
    await page.click('[data-story-bar-id="lu_intro"][data-story-bar-opt="ambition"]');
    await page.waitForTimeout(160);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones), 240);
    await page.click("#btn-dlg-next");
    await page.waitForTimeout(120);

    const comment = await page.evaluate(() => {
      window.__CHENYUAN_V25__.renderStageDamageRecap(true);
      return document.getElementById("recap-companion-box").textContent.trim();
    });
    assert.ok(comment.includes("战后评语"));
    await ctx.close();
  });

  await runSuite("M3-3", "Karma World Differentiation (Market, Encounters, Boss Monologues & Ending Poems)", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M3-3", true);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      game.realm = "golden"; game.stones = 600; game.karmaScore = 60;
      api.refreshMarketStock(); api.updateHud();
    });
    await page.click('.nav-tab-btn[data-tab="bag"]');
    await page.waitForTimeout(160);
    assert.ok((await page.textContent("#panel-scroll-body")).includes("太清正道专属特供"));
    await page.click('[data-buy-karma-item="km_longevity"]');
    await page.waitForTimeout(100);

    const rightMono = await page.evaluate(() => window.__CHENYUAN_V25__.getBossKarmaMonologue("warden"));
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      game.karmaScore = -60; game.stones = 600;
      api.closeDrawer(); api.refreshMarketStock(); api.updateHud();
    });
    const demonMono = await page.evaluate(() => window.__CHENYUAN_V25__.getBossKarmaMonologue("warden"));
    assert.notEqual(rightMono, demonMono);

    await page.evaluate(() => window.__CHENYUAN_V25__.openEncounterModal(0));
    await page.waitForTimeout(150);
    assert.equal(await page.locator('[data-enc-karma="demonic"]').count(), 1);
    await page.click('[data-enc-karma="demonic"]');
    await page.waitForTimeout(120);

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      game.realm = "ascended"; game.status = "ascended"; game.ending = null;
      api.openEndingModal();
    });
    await page.waitForTimeout(180);
    await page.click('[data-choose-ending="sword_sovereign"]');
    await page.waitForTimeout(180);
    const endTxt = await page.textContent("#modal-content");
    assert.ok(endTxt.includes("赤渊破劫魔尊") && endTxt.includes("血刃惊雷裂九天"));
    await ctx.close();
  });

  await runSuite("M3-4", "Lifespan Strategy (Critical Alert, Non-Lethal Penalty & Longevity Pill Extension)", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M3-4", true);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      game.realm = "mortal"; game.startAgeMonths = 216; game.elapsedMonths = 504;
      game.inventory.longevity_pill = 1;
      api.updateHud();
    });
    await page.click('.nav-tab-btn[data-tab="cultivate"]');
    await page.waitForTimeout(180);
    assert.equal(await page.locator(".lifespan-alert-card.critical").count(), 1);
    await page.click('.lifespan-alert-card [data-use-item="longevity_pill"]');
    await page.waitForTimeout(150);
    const lf = await page.evaluate(() => window.__CHENYUAN_V25__.getLifespanInfo(window.__CHENYUAN_V25__.getState().game));
    assert.equal(lf.maxYears, 92);
    assert.equal(lf.status, "normal");
    await ctx.close();
  });

  // =========================================================================
  // MILESTONE 4 SUITES (M4-1 .. M4-4): Ecosystem Weaving, Nine-Lives & NG+
  // =========================================================================
  await runSuite("M4-1", "Realm-Gated Ecosystem Ladder, Golden Core Cloud Sea Seal & Sandbox Override", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M4-1", true);

    // 1. In Mortal realm (rank 0): all 14 ecosystem systems must be locked
    const mortalGates = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      return {
        pet: api.isEcosystemSystemUnlocked(game, "spirit_pet"),
        tower: api.isEcosystemSystemUnlocked(game, "demon_tower"),
        defense: api.isEcosystemSystemUnlocked(game, "sect_defense"),
        tagTeam: api.isEcosystemSystemUnlocked(game, "tag_team"),
        cloudSea: api.isEcosystemSystemUnlocked(game, "cloud_sea_trial"),
        starChart: api.isEcosystemSystemUnlocked(game, "star_chart"),
        bossRush: api.isEcosystemSystemUnlocked(game, "sword_tomb_rush"),
        workshop: api.isEcosystemSystemUnlocked(game, "seed_workshop"),
        blockedModal: (() => { api.openStarChartModal(); return document.getElementById("modal-backdrop").classList.contains("open"); })()
      };
    });
    assert.equal(mortalGates.pet, false);
    assert.equal(mortalGates.tower, false);
    assert.equal(mortalGates.defense, false);
    assert.equal(mortalGates.tagTeam, false);
    assert.equal(mortalGates.cloudSea, false);
    assert.equal(mortalGates.starChart, false);
    assert.equal(mortalGates.bossRush, false);
    assert.equal(mortalGates.workshop, false);
    assert.equal(mortalGates.blockedModal, false, "Locked Star Chart must NOT open modal in Mortal realm");

    // 2. Open Ascension Roadmap from Pavilion menu & verify progressive tier locking visually
    await page.click("#btn-pavilion-menu");
    await page.waitForTimeout(140);
    await page.click("#btn-ascension-roadmap");
    await page.waitForTimeout(200);
    const lockedCount = await page.locator(".roadmap-sys-btn.locked").count();
    assert.equal(lockedCount, 14, "All 14 endgame systems should show locked in Mortal realm");
    await maybeShot(page, "m4_01_ascension_roadmap_locked.png");

    // 3. Toggle 【全神通演武】 inside Roadmap -> requires explicit confirmation modal (#btn-confirm-enter-sandbox) & isolates live save
    // Flush paused live state once before snapshotting so enterSandboxMode()'s pre-sandbox saveGame() matches the canonical checksum
    await page.evaluate(() => window.__CHENYUAN_V25__.saveGame());
    const beforeSandboxSnap = await page.evaluate((sk) => {
      const raw = localStorage.getItem(sk);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        raw,
        checksum: parsed?.checksum || null,
        stones: parsed?.game?.stones,
        realm: parsed?.game?.realm,
        unlockAllArcana: Boolean(parsed?.game?.unlockAllArcana)
      };
    }, STORAGE_KEY);
    assert.equal(beforeSandboxSnap.unlockAllArcana, false, "Live save before sandbox must have unlockAllArcana=false");
    await page.click('[data-action="toggle-arcana-all-roadmap"]');
    await page.waitForSelector("#modal-backdrop.open #btn-confirm-enter-sandbox");
    await page.click("#btn-confirm-enter-sandbox");
    // enterSandboxMode({ source: "roadmap" }) flushes pre-sandbox live save once and immediately reopens Ascension Roadmap
    await page.waitForSelector("#modal-backdrop.open .roadmap-sys-btn");
    const sandboxEntered = await page.evaluate((sk) => {
      const raw = localStorage.getItem(sk);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        isSandbox: window.__CHENYUAN_V25__.isSandboxMode(),
        badgeVisible: getComputedStyle(document.getElementById("hud-sandbox-badge")).display !== "none",
        rawSaveInsideSandbox: raw,
        persistedChecksum: parsed?.checksum || null,
        persistedStones: parsed?.game?.stones,
        persistedRealm: parsed?.game?.realm,
        persistedUnlockAllArcana: Boolean(parsed?.game?.unlockAllArcana)
      };
    }, STORAGE_KEY);
    assert.equal(sandboxEntered.isSandbox, true, "Confirming sandbox modal must enter isolated sandbox mode");
    assert.equal(sandboxEntered.badgeVisible, true, "#hud-sandbox-badge must be visible in sandbox mode");
    assert.equal(sandboxEntered.persistedUnlockAllArcana, false, "Entering sandbox must NOT persist unlockAllArcana=true to live save");
    assert.equal(sandboxEntered.persistedRealm, beforeSandboxSnap.realm, "Entering sandbox must preserve live save realm");
    assert.equal(sandboxEntered.persistedStones, beforeSandboxSnap.stones, "Entering sandbox must preserve live save stones");
    if (beforeSandboxSnap.checksum) {
      assert.equal(sandboxEntered.persistedChecksum, beforeSandboxSnap.checksum, "Entering sandbox must preserve live save canonical game checksum");
    }

    // Ascension Roadmap is reopened automatically in sandbox -> all 14 systems immediately unlocked
    assert.equal(await page.locator(".roadmap-sys-btn.locked").count(), 0, "Sandbox mode must unlock all 14 systems immediately");
    await maybeShot(page, "m4_02_ascension_roadmap_sandbox.png");

    // Verify sandbox mode lets Mortal player open Seed Workshop, mutate in-sandbox state without touching live save, then exit via #btn-exit-sandbox
    await page.click('[data-roadmap-sys="seed_workshop"]');
    await page.waitForTimeout(180);
    assert.ok((await page.textContent("#modal-content")).includes("太虚造化工坊"));
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.stones = 999999;
      api.getState().game.unlockAllArcana = true;
      api.saveGame();
    });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(140);
    await page.click("#btn-exit-sandbox");
    await page.waitForTimeout(180);
    const afterExitSandbox = await page.evaluate((sk) => ({
      isSandbox: window.__CHENYUAN_V25__.isSandboxMode(),
      liveSaveNow: localStorage.getItem(sk),
      stonesNow: window.__CHENYUAN_V25__.getState().game.stones
    }), STORAGE_KEY);
    assert.equal(afterExitSandbox.isSandbox, false, "#btn-exit-sandbox must cleanly exit sandbox mode");
    assert.equal(
      afterExitSandbox.liveSaveNow,
      sandboxEntered.rawSaveInsideSandbox,
      "In-sandbox mutations and exiting sandbox must leave live localStorage byte-for-byte identical"
    );
    assert.notEqual(afterExitSandbox.stonesNow, 999999, "In-sandbox stone mutation must not leak after exiting sandbox");

    // 4. Step through realms (qi -> foundation -> golden -> nascent -> spirit) matching M6 SYSTEM_ECOSYSTEM_LADDER
    const ladderCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      const out = {};
      for (const r of ["qi", "foundation", "golden", "nascent", "spirit"]) {
        game.realm = r;
        out[r] = {
          pet: api.isEcosystemSystemUnlocked(game, "spirit_pet"),
          defense: api.isEcosystemSystemUnlocked(game, "sect_defense"),
          tagTeam: api.isEcosystemSystemUnlocked(game, "tag_team"),
          cloudSea: api.isEcosystemSystemUnlocked(game, "cloud_sea_trial"),
          spire: api.isEcosystemSystemUnlocked(game, "celestial_spire"),
          expedition: api.isEcosystemSystemUnlocked(game, "vein_expedition"),
          rush: api.isEcosystemSystemUnlocked(game, "sword_tomb_rush"),
          pacts: api.isEcosystemSystemUnlocked(game, "heavenly_pacts"),
          workshop: api.isEcosystemSystemUnlocked(game, "seed_workshop")
        };
      }
      return out;
    });
    assert.equal(ladderCheck.qi.pet, true);
    assert.equal(ladderCheck.qi.defense, false);
    assert.equal(ladderCheck.foundation.defense, true);
    assert.equal(ladderCheck.foundation.tagTeam, true);
    assert.equal(ladderCheck.foundation.cloudSea, false);
    assert.equal(ladderCheck.golden.cloudSea, true);
    assert.equal(ladderCheck.golden.spire, false, "M6 ladder: celestial_spire unlocks at nascent, not golden");
    assert.equal(ladderCheck.golden.expedition, false, "M6 ladder: vein_expedition unlocks at nascent, not golden");
    assert.equal(ladderCheck.golden.rush, false);
    assert.equal(ladderCheck.nascent.spire, true);
    assert.equal(ladderCheck.nascent.expedition, true);
    assert.equal(ladderCheck.nascent.rush, true);
    assert.equal(ladderCheck.nascent.pacts, false, "M6 ladder: heavenly_pacts unlocks at spirit, not nascent");
    assert.equal(ladderCheck.nascent.workshop, false);
    assert.equal(ladderCheck.spirit.pacts, true);
    assert.equal(ladderCheck.spirit.workshop, true);

    // 5. Golden Core Cloud Sea Climax Trial -> defeat commander & verify permanent seal + +12 ATK + +15% Expedition bonus
    const cloudRes = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "golden";
      s.game.cloudSeaCleared = false;
      const atkBefore = s.game.atkFlatBonus || 0;
      api.startCloudSeaAerialStage();
      const active = Boolean(s.arena.cloudFlight && s.arena.cloudFlight.active);
      // Fast-forward boss spawn & defeat
      s.arena.cloudFlight.bossSpawned = true;
      s.arena.cloudFlight.progress = 99;
      s.arena.enemies = [];
      return { active, atkBefore };
    });
    assert.equal(cloudRes.active, true, "Golden Core player must be able to launch Cloud Sea Aerial Trial");
    await page.waitForTimeout(350);
    const afterCloud = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      return {
        cleared: s.game.cloudSeaCleared,
        atkFlat: s.game.atkFlatBonus,
        stageIdx: s.arena.stageIdx,
        metaClears: api.getMetaState().cloudSeaClears
      };
    });
    assert.equal(afterCloud.cleared, true, "Clearing Cloud Sea must award cloudSeaCleared seal");
    assert.equal(afterCloud.atkFlat, cloudRes.atkBefore + 12, "First Cloud Sea clear must grant permanent +12 ATK");
    assert.equal(afterCloud.stageIdx, 3, "Golden Core Cloud Sea descent should land cleanly on Chapter 3 古修剑冢");
    assert.ok(afterCloud.metaClears >= 1);
    await ctx.close();
  });

  await runSuite("M4-2", "Nine-Lives Hall of Past Lives, Reincarnation Natal Fates & Visible Sword Aura Transmogs", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M4-2", true);

    // Verify before ascension: Hall of Lives is empty, golden_lotus swordAura & immortal_echo are locked
    const preAsc = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const echoPerk = api.PERKS.find(p => p.id === "immortal_echo");
      const lotusAura = api.WARDROBE_OPTIONS.swordAura.find(a => a.id === "golden_lotus");
      return {
        lives: api.getMetaState().hallOfLives.length,
        echoUnlocked: api.isPerkUnlocked(echoPerk),
        lotusUnlocked: api.isSwordAuraUnlocked(lotusAura)
      };
    });
    assert.equal(preAsc.lives, 0);
    assert.equal(preAsc.echoUnlocked, false);
    assert.equal(preAsc.lotusUnlocked, false);

    // Ascend life 1 (Righteous Karma) and pick ending -> records chronicle entry ONCE & unlocks perks/transmog
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "ascended";
      s.game.status = "ascended";
      s.game.ending = null;
      s.game.karmaScore = 70;
      s.game.towerBest = 7;
      s.game.rushBestGrade = "S+";
      api.getMetaState().ascensions = 1;
      api.getMetaState().bestRushGrade = "S+";
      api.saveMeta();
      api.openEndingModal();
    });
    await page.waitForTimeout(180);
    await page.click('[data-choose-ending="mortal_guardian"]');
    await page.waitForTimeout(200);
    await maybeShot(page, "m4_04_ending_calamity_picker.png");

    // Re-calling recordPastLifeInHall must NOT duplicate entry
    const postAsc = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      api.recordPastLifeInHall(game, "mortal_guardian");
      const meta = api.getMetaState();
      const echoPerk = api.PERKS.find(p => p.id === "immortal_echo");
      const sovPerk = api.PERKS.find(p => p.id === "sword_sovereign");
      const lotusAura = api.WARDROBE_OPTIONS.swordAura.find(a => a.id === "golden_lotus");
      const chaosAura = api.WARDROBE_OPTIONS.swordAura.find(a => a.id === "primordial_chaos");
      return {
        livesCount: meta.hallOfLives.length,
        life0: meta.hallOfLives[0],
        echoUnlocked: api.isPerkUnlocked(echoPerk),
        sovUnlocked: api.isPerkUnlocked(sovPerk),
        lotusUnlocked: api.isSwordAuraUnlocked(lotusAura),
        chaosUnlocked: api.isSwordAuraUnlocked(chaosAura)
      };
    });
    assert.equal(postAsc.livesCount, 1, "Past life chronicle must record exactly once without duplication");
    assert.equal(postAsc.life0.endingId, "mortal_guardian");
    assert.equal(postAsc.life0.towerBest, 7);
    assert.equal(postAsc.life0.rushGrade, "S+");
    assert.equal(postAsc.echoUnlocked, true);
    assert.equal(postAsc.sovUnlocked, true);
    assert.equal(postAsc.lotusUnlocked, true);
    assert.equal(postAsc.chaosUnlocked, true, "S+ rush grade must unlock primordial_chaos transmog");

    // Open Hall of Past Lives modal & equip golden_lotus swordAura transmog
    await page.click('#modal-content [data-action="open-hall-of-lives"]');
    await page.waitForTimeout(200);
    assert.ok((await page.textContent("#modal-content")).includes("历世道果殿堂"));
    await page.click('#modal-content [data-equip-sword-aura="golden_lotus"]');
    await page.waitForTimeout(160);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.cosmetics.swordAura), "golden_lotus");
    await maybeShot(page, "m4_03_hall_of_past_lives.png");
    await ctx.close();
  });

  await runSuite("M4-3", "Calamity Fire NG+ Scaling, Reincarnation Transition & Reload Persistence", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M4-3", true);

    // Complete 1st life & select Calamity Fire Tier 2 before reincarnating
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "ascended";
      s.game.status = "ascended";
      s.game.ending = "sword_sovereign";
      s.game.karmaScore = -55;
      api.getMetaState().ascensions = 1;
      api.recordPastLifeInHall(s.game, "sword_sovereign");
      api.saveMeta();
      api.openEndingModal();
    });
    await page.waitForTimeout(180);

    // Pick Calamity Fire Tier 2 right inside Ending modal, then click Reincarnate
    await page.click('#modal-content [data-calamity-tier="2"]');
    await page.waitForTimeout(140);
    await page.click('#modal-content [data-action="reincarnate-now"]');
    await page.waitForTimeout(260);

    // Welcome screen must be visible, custom drawer auto-opened, Hall of Lives persisted, Calamity 2 selected!
    const welcomeState = await page.evaluate((key) => ({
      welcomeVisible: getComputedStyle(document.getElementById("welcome-screen")).display !== "none",
      runCleared: localStorage.getItem(key) === null,
      drawerOpen: document.getElementById("title-custom-drawer").classList.contains("open"),
      hallCount: window.__CHENYUAN_V25__.getMetaState().hallOfLives.length,
      selectedCal: window.__CHENYUAN_V25__.getSelectedCalamityTier()
    }), STORAGE_KEY);
    assert.equal(welcomeState.welcomeVisible, true);
    assert.equal(welcomeState.runCleared, true);
    assert.equal(welcomeState.drawerOpen, true);
    assert.equal(welcomeState.hallCount, 1);
    assert.equal(welcomeState.selectedCal, 2);

    // Choose sword_sovereign reincarnation natal fate on Welcome Screen
    await page.click('#welcome-perk-grid [data-perk="sword_sovereign"]');
    await page.waitForTimeout(160);
    await maybeShot(page, "m4_05_welcome_reincarnation_ngplus.png");

    // Start 2nd Life in Calamity Fire Tier 2!
    await page.click("#btn-start-new");
    await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await dismissOpeningScroll(page);
    await page.waitForTimeout(160);

    const ngPlusCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const calBadge = document.getElementById("hud-calamity-badge");
      const calSpec = api.getCalamityCycleSpec(s.game);
      // Compare wolf HP in Calamity Tier 2 vs standard Tier 0
      const enemyHpTier2 = s.arena.enemies[0] ? s.arena.enemies[0].maxHp : 0;
      const savedTier = s.game.calamityTier;
      s.game.calamityTier = 0;
      s.arena.enemies = [];
      api.spawnCurrentWave();
      const enemyHpTier0 = s.arena.enemies[0] ? s.arena.enemies[0].maxHp : 0;
      s.game.calamityTier = savedTier;
      s.arena.enemies = [];
      api.spawnCurrentWave();
      return {
        perk: s.game.perk,
        calamityTier: s.game.calamityTier,
        swordForgeLv: s.game.sanctumLevels.sword_forge,
        bonusSwords: s.game.bonusSwords,
        swordAura: s.game.cosmetics.swordAura,
        badgeVisible: getComputedStyle(calBadge).display !== "none",
        badgeText: calBadge.textContent.trim(),
        enemyHpTier2,
        enemyHpTier0,
        expectedMult: calSpec.hpMult
      };
    });
    assert.equal(ngPlusCheck.perk, "sword_sovereign");
    assert.equal(ngPlusCheck.calamityTier, 2);
    assert.equal(ngPlusCheck.swordForgeLv, 2, "sword_sovereign perk must start with Sword Forge Lv.2");
    assert.equal(ngPlusCheck.bonusSwords, 2, "sword_sovereign perk must grant +2 starting swords");
    assert.equal(ngPlusCheck.swordAura, "crimson_calamity", "Calamity Fire run should auto-equip crimson_calamity swordAura");
    assert.equal(ngPlusCheck.badgeVisible, true);
    assert.ok(ngPlusCheck.badgeText.includes("劫火×2"));
    assert.ok(ngPlusCheck.enemyHpTier2 >= Math.round(ngPlusCheck.enemyHpTier0 * 1.65), `Calamity Tier 2 HP (${ngPlusCheck.enemyHpTier2}) must scale ~1.75x vs standard (${ngPlusCheck.enemyHpTier0})`);
    await maybeShot(page, "m4_06_calamity_ngplus_sword_aura.png");

    // Reload and verify Calamity Tier 2, sword_sovereign perk, swordAura & Hall of Lives all persist cleanly
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save");
    await page.click("#btn-continue-save");
    await page.waitForTimeout(250);
    const reloaded = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      return {
        calTier: game.calamityTier,
        perk: game.perk,
        aura: game.cosmetics.swordAura,
        hallLen: api.getMetaState().hallOfLives.length
      };
    });
    assert.equal(reloaded.calTier, 2);
    assert.equal(reloaded.perk, "sword_sovereign");
    assert.equal(reloaded.aura, "crimson_calamity");
    assert.equal(reloaded.hallLen, 1);
    await ctx.close();
  });

  await runSuite("M4-4", "Keyboard Navigation, Escape Focus Restoration Across M4 Modals & Zero Runtime Errors", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "M4-4", true);

    // 1. Open World Map via M key, close via Escape -> modal cleanly closed
    await page.keyboard.press("KeyM");
    await page.waitForTimeout(160);
    assert.equal(await page.evaluate(() => document.getElementById("modal-backdrop").classList.contains("open")), true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => document.getElementById("modal-backdrop").classList.contains("open")), false);

    // 2. Trigger Pavilion -> Ascension Roadmap & verify Escape closes and restores focus cleanly
    await page.focus("#btn-pavilion-menu");
    await page.click("#btn-pavilion-menu");
    await page.waitForTimeout(120);
    await page.click("#btn-ascension-roadmap");
    await page.waitForTimeout(160);
    assert.equal(await page.evaluate(() => document.getElementById("modal-content").contains(document.activeElement)), true);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => document.getElementById("modal-backdrop").classList.contains("open")), false);

    // 3. Open Hall of Past Lives from Objectives -> Endgame tab & verify Escape closes cleanly
    await page.focus("#btn-goals-modal");
    await page.click("#btn-goals-modal");
    await page.waitForTimeout(160);
    await page.click('[data-goal-tab="endgame"]');
    await page.waitForTimeout(140);
    await page.click('#modal-content [data-action="open-hall-of-lives"]');
    await page.waitForTimeout(160);
    assert.ok((await page.textContent("#modal-content")).includes("历世道果殿堂"));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(140);
    assert.equal(await page.evaluate(() => document.getElementById("modal-backdrop").classList.contains("open")), false);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), "btn-goals-modal", "Closing chained modal should restore focus to original trigger #btn-goals-modal");

    await ctx.close();
  });

  // =========================================================================
  // OVERHAUL GUARDRAIL SUITES (P1-1 .. P4-1): Combat Balance, Mainflow, UI & Content
  // =========================================================================
  await runSuite("P1-1", "Phase 1 Guardrails: Anti-AFK Prologue, Ch1-Ch5 TTK & %HP Pressure, Real MP Loop & Mortal Locks", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "P1-1", false);

    // 1. 4.2s AFK test in prologue: wolves must stay alive & player must take real HP damage
    const startSnap = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return { hp: s.game.hp, enemies: s.arena.enemies.length };
    });
    await page.waitForTimeout(3600);
    const afkSnap = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const snap = {
        hp: s.game.hp,
        alive: s.arena.enemies.filter(e => e.hp > 0).length
      };
      api.closeModal();
      s.arena.paused = false;
      s.game.hp = api.getCombatStats(s.game).maxHp;
      return snap;
    });
    assert.ok(afkSnap.alive >= 2, `AFK 3.6s must NOT auto-clear prologue wolves (alive=${afkSnap.alive})`);
    assert.ok(afkSnap.hp < startSnap.hp, `AFK 3.6s must cause real HP damage (start=${startSnap.hp}, after=${afkSnap.hp})`);

    // 2. All Mortal realm locks enforced on API & keyboard (4/5/6/E blocked)
    const lockCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      const lockedActs = ["stance", "jump", "ult", "ally", "pet", "posture", "soul", "swordBlink", "finisher", "tagSwitch", "weapon_form", "astral", "mount", "qimen", "sanqing", "shanhe", "warship", "sequencer"];
      return lockedActs.filter(a => api.isActionUnlockedByRealm(game, a));
    });
    assert.equal(lockCheck.length, 0, `Mortal must have 0 high-realm actions unlocked, got: ${lockCheck.join(",")}`);

    const mpBeforeKeys = await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.mp);
    for (const key of ["Digit4", "Digit5", "Digit6", "KeyE"]) {
      await page.keyboard.press(key);
      await page.waitForTimeout(80);
    }
    const afterKeys = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      const s24 = window.__CHENYUAN_V24__.getState();
      return {
        mp: s.game.mp,
        domain: !!s.arena.domain,
        sanqing: !!(s24.sanqing && s24.sanqing.active),
        shanhe: !!(s24.shanhe && s24.shanhe.active),
        warship: !!(s24.warship && s24.warship.active)
      };
    });
    assert.equal(afterKeys.domain, false);
    assert.equal(afterKeys.sanqing, false);
    assert.equal(afterKeys.shanhe, false);
    assert.equal(afterKeys.warship, false);
    assert.ok(afterKeys.mp >= mpBeforeKeys, "Locked keys must not spend MP");

    // 3. Ch1-Ch5 combat calibration (%HP light hit pressure + healthy Boss TTK, deterministic representative loadouts)
    const curveRows = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const presets = [
        { realm: "mortal",     wpnAtk: 8,   armHp: 18,  armDr: 4,  rngCrit: 0.03, relic: null,          laws: [] },
        { realm: "qi",         wpnAtk: 24,  armHp: 45,  armDr: 10, rngCrit: 0.05, relic: "frost_sword", laws: ["wanjian"] },
        { realm: "foundation", wpnAtk: 56,  armHp: 95,  armDr: 18, rngCrit: 0.08, relic: "frost_sword", laws: ["wanjian", "void_haste"] },
        { realm: "golden",     wpnAtk: 112, armHp: 175, armDr: 28, rngCrit: 0.10, relic: "frost_sword", laws: ["wanjian", "void_haste", "crit_lotus"] },
        { realm: "nascent",    wpnAtk: 195, armHp: 280, armDr: 40, rngCrit: 0.12, relic: "frost_sword", laws: ["wanjian", "void_haste", "crit_lotus", "yinyang"] }
      ];
      const out = [];
      for (let i = 0; i < 5; i++) {
        const s = api.getState();
        const pr = presets[i];
        s.game.realm = pr.realm;
        s.game.openingChoice = "help";
        s.game.seenCutscenes = { prologue_rescue: true, enter_sect: true, enter_secret: true, enter_sword_mound: true, enter_terrace: true };
        s.game.laws = pr.laws.slice();
        s.game.loadout.relic = pr.relic;
        s.game.equippedGear = {
          weapon: { uid: "det_w_" + i, slot: "weapon", rarity: Math.min(3, i), name: "制式佩剑", art: "icon_blade", atk: pr.wpnAtk, hp: 0, dr: 0, crit: pr.rngCrit, spd: 0, bonusSword: 0, lvl: 0 },
          armor:  { uid: "det_a_" + i, slot: "armor",  rarity: Math.min(3, i), name: "制式仙衣", art: "icon_heart", atk: 0, hp: pr.armHp, dr: pr.armDr, crit: 0, spd: 0, bonusSword: 0, lvl: 0 },
          ring:   { uid: "det_r_" + i, slot: "ring",   rarity: Math.min(3, i), name: "制式灵佩", art: "item_jade",  atk: Math.round(pr.wpnAtk * 0.25), hp: 0, dr: 2, crit: pr.rngCrit, spd: 0, bonusSword: 0, lvl: 0 }
        };
        api.initArenaStage(i, false);
        if (s.arena.dungeonMap) s.arena.dungeonMap.activeClimate = "spirit_mist";
        const st = api.getCombatStats(s.game);
        s.game.hp = st.maxHp;
        s.arena.player.invuln = 0;
        s.arena.player.shieldHp = 0;
        s.arena.enemies = [];
        const mult = api.STAGE_SCALING[i];
        const act = api.CAMPAIGN_ACTS[i];
        api.spawnSingleEnemy(act.waves[0][0], 700, 460, mult, false);
        const mob = s.arena.enemies[0];
        const hpBefore = s.game.hp;
        api.hurtPlayer(mob.atk);
        const lightHit = hpBefore - s.game.hp;
        s.game.hp = st.maxHp;
        s.arena.enemies = [];
        api.spawnSingleEnemy(act.boss, 700, 460, mult, true, act.bossName);
        const boss = s.arena.enemies[0];
        const activeDpsEst = st.atk * (1 + st.crit * (st.critMult - 1)) * 2.15 * st.atkHaste;
        out.push({
          stage: i,
          lightPct: (lightHit / st.maxHp) * 100,
          bossTtk: boss.maxHp / Math.max(1, activeDpsEst)
        });
      }
      return out;
    });
    for (const row of curveRows) {
      assert.ok(row.lightPct >= 6.5 && row.lightPct <= 28, `Stage ${row.stage} light hit %HP (${row.lightPct.toFixed(1)}%) out of healthy [6.5%, 28%]`);
      assert.ok(row.bossTtk >= 20 && row.bossTtk <= 120, `Stage ${row.stage} boss TTK (${row.bossTtk.toFixed(1)}s) out of healthy [20s, 120s]`);
    }

    // 4. Real MP spend & cooldown on Golden Core E (Digit4 blocked until Nascent per M6), then Nascent E + Digit4
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      api.closeModal();
      s.arena.paused = false;
      s.game.realm = "golden";
      const st = api.getCombatStats(s.game);
      s.game.hp = st.maxHp;
      s.game.mp = st.maxMp;
      s.arena.player.ultCd = 0;
      s.arena.sanqingCd = 0;
      api.syncProgressiveSkillVisibility();
    });
    const mpStartGold = await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.mp);
    await page.keyboard.press("Digit4");
    await page.waitForTimeout(100);
    const goldBlockedDigit4 = await page.evaluate(() => ({
      mp: window.__CHENYUAN_V25__.getState().game.mp,
      sanqingCd: window.__CHENYUAN_V25__.getState().arena.sanqingCd || 0
    }));
    assert.equal(goldBlockedDigit4.sanqingCd, 0, "M6 gate: Digit4 (一气三清) must stay blocked in Golden Core realm");
    assert.ok(goldBlockedDigit4.mp >= mpStartGold, "Blocked Digit4 in Golden Core must not spend MP");

    await page.keyboard.press("KeyE");
    await page.waitForTimeout(120);
    const goldAfterE = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return { mp: s.game.mp, ultCd: s.arena.player.ultCd };
    });
    assert.ok(goldAfterE.mp < mpStartGold, `Expected Golden Core KeyE to spend real MP (before=${mpStartGold}, after=${goldAfterE.mp})`);
    assert.ok(goldAfterE.ultCd >= 5, `Expected real KeyE cooldown >= 5s in Golden Core, got ${goldAfterE.ultCd}`);

    // Now advance to Nascent Soul where both KeyE and Digit4 are unlocked
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "nascent";
      const st = api.getCombatStats(s.game);
      s.game.hp = st.maxHp;
      s.game.mp = st.maxMp;
      s.arena.player.ultCd = 0;
      s.arena.sanqingCd = 0;
      api.syncProgressiveSkillVisibility();
    });
    const mpStartNascent = await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.mp);
    await page.keyboard.press("KeyE");
    await page.waitForTimeout(120);
    await page.keyboard.press("Digit4");
    await page.waitForTimeout(120);
    const nascentAfter = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return { mp: s.game.mp, ultCd: s.arena.player.ultCd, sanqingCd: s.arena.sanqingCd || 0 };
    });
    assert.ok(nascentAfter.mp < mpStartNascent - 35, `Expected Nascent KeyE + Digit4 to spend real MP (before=${mpStartNascent}, after=${nascentAfter.mp})`);
    assert.ok(nascentAfter.ultCd >= 5, `Expected real KeyE cooldown >= 5s, got ${nascentAfter.ultCd}`);
    assert.ok(nascentAfter.sanqingCd >= 15, `Expected real Digit4 cooldown >= 15s in Nascent, got ${nascentAfter.sanqingCd}`);
    await ctx.close();
  });

  await runSuite("P2-1", "Phase 2 Guardrails: 5-Act Parity, Dual Prologue Portals, Portal Realm Gate, Pacing & 7-Material Drops", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "P2-1", false);

    // 1. 5-Act Single-Source-of-Truth parity
    const parity = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const expected = [
        { boss: "wolf", bossName: "雾隐狼王" },
        { boss: "warden", bossName: "守山石卫" },
        { boss: "serpent", bossName: "寒潭玄蛇" },
        { boss: "puppet", bossName: "古境剑傀" },
        { boss: "trial_gate", bossName: "天门道影" }
      ];
      return expected.every((ex, i) => {
        const mapNode = api.KYUSHU_MAP_NODES.find(n => n.kind === "stage" && n.stageIdx === i);
        return (
          api.CAMPAIGN_ACTS[i].boss === ex.boss &&
          api.CAMPAIGN_ACTS[i].bossName === ex.bossName &&
          api.STAGES[i].boss === ex.boss &&
          api.STAGES[i].bossName === ex.bossName &&
          Boolean(mapNode && mapNode.sub.includes(ex.bossName)) &&
          Boolean(api.REGION_POEMS["stg_" + i]) &&
          Boolean(api.BOSS_SIGNATURE_MOVES[ex.boss])
        );
      });
    });
    assert.equal(parity, true, "All 5 campaign acts must stay 100% aligned across CAMPAIGN_ACTS/STAGES/KYUSHU_MAP_NODES/REGION_POEMS/BOSS_SIGNATURE_MOVES");

    // 2. Prologue pedestal opens two player-chosen portals with 0 in-place wolf ambush
    const pedCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.enemies = [];
      api.activatePedestalChoice("help");
      return {
        enemiesAfter: s.arena.enemies.length,
        hasWildPortal: s.arena.props.some(p => p.id === "portal_act1_wilderness"),
        hasSanctumPortal: s.arena.props.some(p => p.id === "portal_sanctum_prep")
      };
    });
    assert.equal(pedCheck.enemiesAfter, 0, "Pedestal choice must NOT ambush with in-place wolves");
    assert.equal(pedCheck.hasWildPortal, true);
    assert.equal(pedCheck.hasSanctumPortal, true);

    // 3. portal_next (kind="portal") realm gate blocks Mortal and allows Qi
    const gateCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "mortal";
      api.initArenaStage(0, false);
      const fakePortal = { id: "portal_next", kind: "portal", nextIdx: 1, toTower: false, x: 700, y: 450, r: 50 };
      s.arena.props.push(fakePortal);
      const allowedMortal = api.interactWithProp(fakePortal);
      const stageWhenMortal = s.arena.stageIdx;
      api.closeModal();
      s.arena.paused = false;
      s.game.realm = "qi";
      s.game.seenCutscenes.enter_sect = true;
      const allowedQi = api.interactWithProp(fakePortal);
      const stageWhenQi = s.arena.stageIdx;
      return { allowedMortal, stageWhenMortal, allowedQi, stageWhenQi };
    });
    assert.equal(gateCheck.allowedMortal, false, "Mortal must be rejected by Stage 1 realm portal gate");
    assert.equal(gateCheck.stageWhenMortal, 0, "Mortal must remain in Stage 0");
    assert.equal(gateCheck.allowedQi, true, "Qi cultivator must pass Stage 1 realm portal gate");
    assert.equal(gateCheck.stageWhenQi, 1, "Qi cultivator must enter Stage 1");

    // 4. Golden Core Sanctum meditation pacing (<12% in 2.2s, never 100%)
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "golden";
      s.game.xp = 0;
      api.enterSanctumHub();
    });
    await page.keyboard.press("KeyB");
    await page.waitForTimeout(2200);
    const medCheck = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return { xp: s.game.xp, cap: s.realmSpec.xpCap, pct: (s.game.xp / s.realmSpec.xpCap) * 100 };
    });
    assert.ok(medCheck.pct > 0.5 && medCheck.pct < 12, `Golden Core 2.2s meditation XP (${medCheck.pct.toFixed(2)}%) must stay paced in (0.5%, 12%)`);

    // 5. High-realm low-stage XP attenuation & 7-material combat drops across Ch1-Ch5
    const dropCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "spirit";
      s.game.seenCutscenes = { prologue_rescue: true, enter_sect: true, enter_secret: true, enter_sword_mound: true, enter_terrace: true };
      api.initArenaStage(0, false);
      s.arena.enemies = [];
      s.arena.drops = [];
      api.spawnSingleEnemy("wolf", 720, 450, 1.0, false);
      api.handleEnemyDeath(s.arena.enemies[0]);
      const qiDrop = s.arena.drops.find(d => d.kind === "qi");
      const spiritCh1WolfXp = qiDrop ? qiDrop.val : 999;

      const matSet = new Set();
      for (let i = 0; i < 5; i++) {
        api.initArenaStage(i, false);
        s.arena.enemies = [];
        s.arena.drops = [];
        const act = api.CAMPAIGN_ACTS[i];
        api.spawnSingleEnemy(act.boss, 720, 450, api.STAGE_SCALING[i], true, act.bossName);
        api.handleEnemyDeath(s.arena.enemies[0]);
        s.arena.drops.forEach(d => {
          if (["herb", "dew", "core", "jade", "lotus", "soul", "dao"].includes(d.kind)) matSet.add(d.kind);
        });
      }
      return { spiritCh1WolfXp, droppedMats: Array.from(matSet).sort() };
    });
    assert.ok(dropCheck.spiritCh1WolfXp <= 15, `Spirit killing Ch1 wolf must yield attenuated XP <= 15, got ${dropCheck.spiritCh1WolfXp}`);
    assert.deepEqual(dropCheck.droppedMats, ["core", "dao", "dew", "herb", "jade", "lotus", "soul"], "All 7 crafting materials must drop across Ch1-Ch5 bosses");

    // 6. Explore drawer has 0 legacy [data-source] buttons
    await page.waitForTimeout(200);
    for (let k = 0; k < 6; k++) {
      const btn = await page.$("#modal-backdrop.open #btn-soul-keep-current, #modal-backdrop.open #btn-volume-recap-confirm, #modal-backdrop.open [data-modal-close='1']");
      if (!btn) break;
      await btn.click();
      await page.waitForTimeout(100);
    }
    await dismissActiveCutscene(page, 300);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.openingChoice = "help";
      api.closeModal();
      api.syncProgressiveSkillVisibility();
      api.updateHud();
    });
    await page.click('#nav-btn-explore');
    await page.waitForTimeout(160);
    assert.equal(await page.locator('#panel-scroll-body [data-source]').count(), 0, "Legacy SOURCES buttons must remain removed");
    await ctx.close();
  });

  await runSuite("P3-1", "Phase 3 Guardrails: Mortal HUD Declutter, 4-Step Onboarding Persistence, Progressive Drawer & Tiered Keybinds", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "P3-1", false);

    // 1. Mortal HUD visible button count <= 14 & onboarding bar active at step 0
    const hudSnap = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button")).filter(el => {
        if (el.closest("#welcome-screen, #side-panel, #modal-backdrop, #pavilion-popover, #story-dialogue-bar, #ending-overlay")) return false;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0 && r.width > 2 && r.height > 2;
      });
      const coach = document.getElementById("onboarding-coach-bar");
      return {
        visibleBtnCount: btns.length,
        coachVisible: !!(coach && coach.classList.contains("show")),
        step: window.__CHENYUAN_V25__.getState().game.tutorialStep
      };
    });
    assert.ok(hudSnap.visibleBtnCount <= 14, `Mortal start HUD must have <= 14 visible buttons, got ${hudSnap.visibleBtnCount}`);
    assert.equal(hudSnap.coachVisible, true, "Onboarding coach bar must appear on fresh Mortal start");
    assert.equal(hudSnap.step, 0);
    await maybeShot(page, "p3_01_mortal_hud_onboarding.png");

    // 2. Onboarding advances 0 -> 1 on 3 manual slashes, 1 -> 2 on Space dash parry
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      for (let i = 0; i < 3; i++) {
        s.arena.player.slashCd = 0;
        api.fireManualSlash();
      }
    });
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.tutorialStep), 1);
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.tutorialStep), 2);

    // 3. Skip onboarding & verify persistence across reload
    await page.click("#btn-skip-onboarding");
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.tutorialDismissed), true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save");
    await page.click("#btn-continue-save");
    await page.waitForTimeout(240);
    const postReloadTut = await page.evaluate(() => ({
      dismissed: window.__CHENYUAN_V25__.getState().game.tutorialDismissed,
      coachOpen: document.getElementById("onboarding-coach-bar").classList.contains("show")
    }));
    assert.equal(postReloadTut.dismissed, true);
    assert.equal(postReloadTut.coachOpen, false);

    // 4. Progressive disclosure in Mortal cultivate drawer (<= 14 buttons)
    await page.click('#nav-btn-cultivate');
    await page.waitForTimeout(180);
    const mortalCultBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#panel-scroll-body button')).filter(b => getComputedStyle(b).display !== "none").length
    );
    assert.ok(mortalCultBtns <= 14, `Mortal cultivate drawer must have <= 14 buttons, got ${mortalCultBtns}`);
    await maybeShot(page, "p3_02_mortal_cultivate_drawer.png");

    // 5. Unified alchemy drawer (0 duplicate horizontal furnace track)
    await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      s.game.openingChoice = "help";
      window.__CHENYUAN_V25__.updateHud();
    });
    await page.click('#nav-btn-alchemy');
    await page.waitForTimeout(160);
    assert.equal(await page.locator('#panel-scroll-body .furnace-minigame-box, #panel-scroll-body #furnace-track').count(), 0);

    // 6. Tiered Settings keybinds (3 tiers)
    await page.click("#btn-open-settings");
    await page.waitForTimeout(160);
    await page.click('[data-sys-tab="controls"]');
    await page.waitForTimeout(140);
    assert.equal(await page.locator('#modal-content .kb-tier-hdr').count(), 3, "Keybinds modal must group controls into 3 tiers");
    await page.keyboard.press("Escape");
    await ctx.close();
  });

  await runSuite("P4-1", "Phase 4 Guardrails: Ch4 Cutscene, Chapter Enemy Variants, 3D Dao Real Bonuses & School Specialization", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "P4-1", true);

    // 1. Cutscene alignment (Ch3 Frost Serpent + Ch4 Sword Mound) & live Ch4 trigger
    const csCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const secText = (api.CHAPTER_CUTSCENES.enter_secret || []).map(l => l.text).join("");
      const moundText = (api.CHAPTER_CUTSCENES.enter_sword_mound || []).map(l => l.text).join("");
      const s = api.getState();
      s.game.realm = "golden";
      s.game.openingChoice = "help";
      s.game.seenCutscenes = { prologue_rescue: true };
      api.initArenaStage(3, false);
      return {
        secHasSerpent: secText.includes("寒潭玄蛇") && !secText.includes("上古剑傀"),
        moundHasPuppet: moundText.includes("古修剑冢") && moundText.includes("古境剑傀"),
        ch4DlgOpen: document.getElementById("story-dialogue-bar").classList.contains("open"),
        ch4Seen: !!(s.game.seenCutscenes && s.game.seenCutscenes.enter_sword_mound),
        ch4EnemiesDuringCutscene: s.arena.enemies.length
      };
    });
    assert.equal(csCheck.secHasSerpent, true, "Ch3 enter_secret cutscene must reference 寒潭玄蛇");
    assert.equal(csCheck.moundHasPuppet, true, "Ch4 enter_sword_mound cutscene must reference 古修剑冢 & 古境剑傀");
    assert.equal(csCheck.ch4DlgOpen, true, "Entering Ch4 Sword Mound first time must open cutscene dialogue bar");
    assert.equal(csCheck.ch4Seen, true);
    assert.equal(csCheck.ch4EnemiesDuringCutscene, 0, "Q1 F12 A6: Ch4 enemies must wait until unseen enter_sword_mound cutscene closes");
    await maybeShot(page, "p4_01_ch4_sword_mound_cutscene.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);
    const ch4Variants = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return s.arena.enemies.map(e => ({ name: e.name, tag: e.variantTag, color: e.variantColor }));
    });
    assert.ok(ch4Variants.length > 0 && ch4Variants.every(v => v.tag && v.color), "Ch4 enemies must carry chapter variant metadata");

    // 2. All 5 Chapters spawn distinct chapter-flavored enemy variants
    const allStageVariants = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.seenCutscenes = { prologue_rescue: true, enter_sect: true, enter_secret: true, enter_sword_mound: true, enter_terrace: true };
      const namesByStage = [];
      for (let i = 0; i < 5; i++) {
        api.initArenaStage(i, false);
        const mobs = s.arena.enemies.filter(e => !e.isBoss);
        namesByStage.push({ stage: i, names: mobs.map(m => m.name), tags: mobs.map(m => m.variantTag) });
      }
      return namesByStage;
    });
    for (const sv of allStageVariants) {
      assert.ok(sv.tags.length > 0 && sv.tags.every(Boolean), `Stage ${sv.stage} must spawn chapter enemy variants with non-empty tags`);
    }
    const uniqueStageVariantNames = new Set(allStageVariants.flatMap(sv => sv.names));
    assert.ok(uniqueStageVariantNames.size >= 5, `Expected >= 5 unique chapter enemy variant names across 5 Acts, got ${uniqueStageVariantNames.size}`);

    // 3. 3D Dao Heart real gameplay impact (heal, crit, posture, MP regen, stone drops)
    const daoCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "foundation";
      s.game.dao = { benevolence: 6, edge: 10, serenity: 6 };
      const baseB = api.getDaoBonuses(s.game);
      const baseSt = api.getCombatStats(s.game);
      s.game.hp = 10;
      s.game.gourd.charges = 3;
      api.useQuickHealingPill();
      const baseHeal = s.game.hp - 10;

      s.game.dao = { benevolence: 55, edge: 55, serenity: 55 };
      const highB = api.getDaoBonuses(s.game);
      const highSt = api.getCombatStats(s.game);
      s.game.hp = 10;
      s.game.gourd.charges = 3;
      api.useQuickHealingPill();
      const highHeal = s.game.hp - 10;
      return { baseB, highB, baseCrit: baseSt.crit, highCrit: highSt.crit, baseHeal, highHeal };
    });
    assert.ok(daoCheck.highB.healMult > daoCheck.baseB.healMult);
    assert.ok(daoCheck.highB.postureMult > daoCheck.baseB.postureMult);
    assert.ok(daoCheck.highB.mpRegenMult > daoCheck.baseB.mpRegenMult);
    assert.ok(daoCheck.highB.stoneMult > daoCheck.baseB.stoneMult);
    assert.ok(daoCheck.highCrit > daoCheck.baseCrit, "High Dao edge must increase real combat crit");
    assert.ok(daoCheck.highHeal > daoCheck.baseHeal, `High Dao benevolence must heal more HP (base=${daoCheck.baseHeal}, high=${daoCheck.highHeal})`);

    // 4. Sword vs Talisman school specialization + UI strip verification
    await page.click('#nav-btn-cultivate');
    await page.waitForTimeout(160);
    await page.click('#panel-scroll-body [data-school="sword"]');
    await page.waitForTimeout(140);
    const swordSnap = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const st = api.getCombatStats(api.getState().game);
      return {
        haste: st.atkHaste,
        critMult: st.critMult,
        spec: st.schoolSpec,
        daoStrip: document.getElementById("dao-bonuses-strip")?.textContent || "",
        schoolBanner: document.getElementById("school-spec-banner")?.textContent || ""
      };
    });
    await page.click('#panel-scroll-body [data-school="talisman"]');
    await page.waitForTimeout(140);
    const talSnap = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const st = api.getCombatStats(api.getState().game);
      return {
        haste: st.atkHaste,
        critMult: st.critMult,
        spec: st.schoolSpec,
        schoolBanner: document.getElementById("school-spec-banner")?.textContent || ""
      };
    });
    assert.ok(swordSnap.daoStrip.includes("仁心") && swordSnap.daoStrip.includes("锋芒") && swordSnap.daoStrip.includes("本真"), "Character Sheet must render active 3D Dao bonuses");
    assert.ok(swordSnap.schoolBanner.includes("青霜御剑专精"));
    assert.ok(talSnap.schoolBanner.includes("紫霄雷符专精"));
    assert.ok(swordSnap.haste > talSnap.haste, `Sword school haste (${swordSnap.haste}) must exceed Talisman (${talSnap.haste})`);
    assert.ok(swordSnap.critMult > talSnap.critMult, `Sword school critMult (${swordSnap.critMult}) must exceed Talisman (${talSnap.critMult})`);
    assert.ok(swordSnap.spec.swordSynergyMult > talSnap.spec.swordSynergyMult);
    assert.ok(talSnap.spec.mpRegenMult > swordSnap.spec.mpRegenMult);
    assert.ok(talSnap.spec.skillDmgMult > swordSnap.spec.skillDmgMult);
    assert.equal(talSnap.spec.chainLightningOnFinisher, true);
    await maybeShot(page, "p4_02_cultivate_dao_school.png");

    await ctx.close();
  });

  await runSuite("P5-1", "Polish Guardrails: Quest Conditions, Native Pill Recipes, Explicit Spire Wager Altar, Act 5 Gate Copy & Monotonic Boss Rush", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "P5-1", false);

    // 1. Quest progression cannot skip Act 2 Foundation breakthrough or Act 4 Sword Mound boss
    const questCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const ch2 = api.CHAPTERS.find(c => c.index === 2);
      const ch4 = api.CHAPTERS.find(c => c.index === 4);
      const s2Break = ch2.steps.find(st => st.id === "s2_break");
      const s4Puppet = ch4.steps.find(st => st.id === "s4_puppet");

      s.game.realm = "qi";
      s.game.stageStars = { 0: 3, 1: 3, 2: 0, 3: 0, 4: 0 };
      const qiBreakDone = s2Break.check(s.game);

      s.game.realm = "golden";
      s.game.equippedGear = {
        weapon: api.rollGearItem(1, 1, "weapon"),
        armor: api.rollGearItem(1, 1, "armor"),
        ring: api.rollGearItem(1, 1, "ring")
      };
      const ch4SkippedByGear = s4Puppet.check(s.game);
      s.game.stageStars[3] = 1;
      const ch4DoneAfterBoss = s4Puppet.check(s.game);
      return {
        qiBreakDone,
        ch4SkippedByGear,
        ch4DoneAfterBoss,
        legacyMapTarget: api.LEGACY_STEP_ID_MAP && api.LEGACY_STEP_ID_MAP.s4_npc
      };
    });
    assert.equal(questCheck.qiBreakDone, false, "Act 2 s2_break must NOT complete while still Qi realm");
    assert.equal(questCheck.ch4SkippedByGear, false, "Act 4 s4_puppet must NOT complete solely from 3 equipped gear items");
    assert.equal(questCheck.ch4DoneAfterBoss, true, "Act 4 s4_puppet must complete after clearing Stage 3 boss");
    assert.equal(questCheck.legacyMapTarget, "s4_puppet", "LEGACY_STEP_ID_MAP must map legacy s4_npc -> s4_puppet");

    // 2. Every Act's breakthrough pill recipe uses ONLY materials natively dropped by that Act
    const recipeCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const pairs = [
        { actIdx: 1, recipeId: "foundation" },
        { actIdx: 2, recipeId: "golden" },
        { actIdx: 3, recipeId: "nascent" },
        { actIdx: 4, recipeId: "spirit_seed" },
        { actIdx: 4, recipeId: "ascension" }
      ];
      const bad = [];
      for (const { actIdx, recipeId } of pairs) {
        const act = api.CAMPAIGN_ACTS[actIdx];
        const rec = api.RECIPES[recipeId];
        const pool = new Set([...(act.matDrops || []), ...(act.bossMats || [])]);
        for (const mat of Object.keys(rec.inputs || {})) {
          if (!pool.has(mat)) bad.push(`${recipeId} needs ${mat} not in Act ${actIdx + 1}`);
        }
      }
      return bad;
    });
    assert.deepEqual(recipeCheck, [], `Breakthrough pill recipes must only require native Act materials, got: ${recipeCheck.join("; ")}`);

    // 3. Act 5 ascend_gate waits for Volume-End Recap confirm and differentiates Nascent (化神台) vs Spirit (九霄仙门)
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.openingChoice = "help";
      s.game.seenCutscenes = { prologue_rescue: true, enter_sect: true, enter_secret: true, enter_sword_mound: true, enter_terrace: true };
      s.game.realm = "nascent";
      api.initArenaStage(4, false);
      s.arena.waveIdx = 5;
      s.arena.props = [];
      api.spawnCurrentWave();
    });
    await dismissActiveCutscene(page);
    await page.waitForSelector("#modal-backdrop.open #btn-volume-recap-confirm");
    const nascentGateBeforeConfirm = await page.evaluate(() =>
      window.__CHENYUAN_V25__.getState().arena.props.some(p => p.kind === "ascend_gate")
    );
    assert.equal(nascentGateBeforeConfirm, false, "Stage 4 ascend_gate must wait until Volume-End Recap modal is confirmed");
    await page.click("#btn-volume-recap-confirm");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const nascentGate = await page.evaluate(() =>
      (window.__CHENYUAN_V25__.getState().arena.props.find(p => p.kind === "ascend_gate") || {}).name || ""
    );

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "spirit";
      api.initArenaStage(4, false);
      s.arena.waveIdx = 5;
      s.arena.props = [];
      api.spawnCurrentWave();
    });
    await dismissActiveCutscene(page);
    await page.waitForSelector("#modal-backdrop.open #btn-volume-recap-confirm");
    await page.click("#btn-volume-recap-confirm");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const spiritGate = await page.evaluate(() =>
      (window.__CHENYUAN_V25__.getState().arena.props.find(p => p.kind === "ascend_gate") || {}).name || ""
    );
    assert.ok(nascentGate.includes("化神"), `Nascent Stage 4 gate should mention 化神, got ${nascentGate}`);
    assert.ok(spiritGate.includes("飞升"), `Spirit Stage 4 gate should mention 飞升, got ${spiritGate}`);

    // 4. Celestial Spire Floor 3 (chaos_wager) must NOT auto-drain HP; interactive spire_wager_altar requires explicit click
    const spireWager = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "nascent";
      const st = api.getCombatStats(s.game);
      s.game.hp = st.maxHp;
      window.__CHENYUAN_V21__.startCelestialSpireRun(3);
      const hpAfterEnter = s.game.hp;
      const wagerBeforeClick = s.arena.celestialSpire.wagerDouble;
      const altar = s.arena.props.find(p => p.kind === "spire_wager_altar");
      let okClick = false;
      if (altar) okClick = api.interactWithProp(altar);
      return {
        maxHp: st.maxHp,
        hpAfterEnter,
        wagerBeforeClick,
        hasAltar: !!altar,
        okClick,
        hpAfterClick: s.game.hp,
        wagerAfterClick: s.arena.celestialSpire.wagerDouble
      };
    });
    assert.equal(spireWager.hpAfterEnter, spireWager.maxHp, "Entering Spire chaos_wager floor must NOT auto-drain player HP");
    assert.equal(spireWager.wagerBeforeClick, false, "wagerDouble must remain false until player explicitly activates wager altar");
    assert.equal(spireWager.hasAltar, true, "Spire chaos_wager floor must spawn interactive spire_wager_altar");
    assert.equal(spireWager.okClick, true);
    assert.ok(spireWager.hpAfterClick < spireWager.maxHp, "Explicitly activating spire_wager_altar must deduct 25% HP");
    assert.equal(spireWager.wagerAfterClick, true);

    // 5. Boss Rush 7-bout HP strictly increases from Bout 1 -> Bout 5 -> Bout 6 Inner Demon -> Bout 7 Colossal Titan
    const rushHps = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "nascent";
      s.game.calamityTier = 0;
      const out = {};
      for (const b of [1, 5, 6, 7]) {
        s.arena.bossRush = { active: true, bout: b, maxBouts: 7, timer: 0, noHit: true };
        s.arena.enemies = [];
        api.spawnBossRushBout();
        out["b" + b] = s.arena.enemies[0] ? s.arena.enemies[0].maxHp : 0;
      }
      return out;
    });
    assert.ok(rushHps.b1 > 0 && rushHps.b1 < rushHps.b5 && rushHps.b5 < rushHps.b6 && rushHps.b6 < rushHps.b7,
      `Boss Rush HP must climb monotonically b1 < b5 < b6 < b7, got ${JSON.stringify(rushHps)}`);

    await ctx.close();
  });

  // =========================================================================
  // R2-1: T1 — 元存档损坏保护（保留原文 + 横幅提示 + 复制原文 + 确认前绝不覆写 + 显式确认重置）
  // =========================================================================
  await runSuite("R2-1", "T1 元存档损坏保护（保留原文、提示条、复制原文、显式确认重置）", async () => {
    const ctx = await newIsolatedContext(browser);
    const page = await ctx.newPage();
    attachErrorListeners(page, "R2-1");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

    const corruptMeta = "{CORRUPT_META_EB0EA67::ascensions=5,broken";
    await page.evaluate(({ mk, raw }) => {
      localStorage.clear();
      localStorage.setItem(mk, raw);
    }, { mk: META_KEY, raw: corruptMeta });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#welcome-screen");

    const bannerInfo = await page.evaluate(() => {
      const el = document.getElementById("save-status-banner");
      return {
        visible: !!el && getComputedStyle(el).display !== "none",
        text: el ? el.textContent : "",
        hasCopyBtn: !!el?.querySelector('[data-action="copy-corrupt-meta-raw"]'),
        hasResetBtn: !!el?.querySelector('[data-action="prompt-reset-corrupt-meta"]'),
        metaReadError: window.__CHENYUAN_V25__.getPersistenceState().metaReadError
      };
    });
    assert.ok(bannerInfo.visible, "Welcome #save-status-banner must be visible when meta is corrupt");
    assert.ok(bannerInfo.text.includes("元存档损坏"), `Banner must mention 元存档损坏, got: ${bannerInfo.text}`);
    assert.ok(bannerInfo.hasCopyBtn && bannerInfo.hasResetBtn, "Banner must expose 复制原文 & 确认重置 buttons");
    assert.ok(bannerInfo.metaReadError && bannerInfo.metaReadError.raw === corruptMeta, "metaReadError must preserve raw corrupt string");

    // Click 复制原文 — must NOT mutate corrupt storage
    await page.click('#save-status-banner [data-action="copy-corrupt-meta-raw"]');
    await page.waitForTimeout(100);
    const afterCopyRaw = await page.evaluate((mk) => localStorage.getItem(mk), META_KEY);
    assert.equal(afterCopyRaw, corruptMeta, "Copying raw meta must preserve corrupt meta intact");

    // Start a fresh game and trigger saveGame() + saveMeta() — corrupt meta MUST NOT be overwritten!
    await page.click("#btn-start-new");
    await page.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
    await dismissOpeningScroll(page);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.stones += 55;
      api.saveGame();
      api.saveMeta();
    });
    const afterPlayRaw = await page.evaluate((mk) => localStorage.getItem(mk), META_KEY);
    assert.equal(afterPlayRaw, corruptMeta, "saveGame/saveMeta must NEVER overwrite corrupt meta before explicit confirmation");

    // In-game HUD alert must also warn about corrupt meta
    const hudAlertText = await page.evaluate(() => {
      const el = document.getElementById("hud-save-alert");
      return el && getComputedStyle(el).display !== "none" ? el.textContent : "";
    });
    assert.ok(hudAlertText.includes("元存档损坏"), `In-game #hud-save-alert must show 元存档损坏, got: ${hudAlertText}`);

    // Two-step explicit confirmation reset
    await page.click('#hud-save-alert [data-action="prompt-reset-corrupt-meta"]');
    await page.waitForSelector('#modal-backdrop.open [data-action="confirm-reset-corrupt-meta"]');
    // Still untouched before clicking confirm!
    assert.equal(await page.evaluate((mk) => localStorage.getItem(mk), META_KEY), corruptMeta);

    await page.click('[data-action="confirm-reset-corrupt-meta"]');
    await page.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));

    const afterReset = await page.evaluate((mk) => {
      const raw = localStorage.getItem(mk);
      const parsed = raw ? JSON.parse(raw) : null;
      const alertEl = document.getElementById("hud-save-alert");
      return {
        parsed,
        metaReadError: window.__CHENYUAN_V25__.getPersistenceState().metaReadError,
        alertHidden: !alertEl || getComputedStyle(alertEl).display === "none"
      };
    }, META_KEY);
    assert.ok(afterReset.parsed && afterReset.parsed.metaRev >= 1, `Reset meta must be valid JSON with metaRev >= 1, got ${JSON.stringify(afterReset.parsed)}`);
    assert.equal(afterReset.metaReadError, null, "metaReadError must clear after explicit reset");
    assert.ok(afterReset.alertHidden, "HUD meta alert must hide after explicit reset");

    await ctx.close();
  });

  // =========================================================================
  // R2-2: T2 & T3 — 输入框内屏蔽全局快捷键 + 弹窗/抽屉焦点陷阱与焦点返回
  // =========================================================================
  await runSuite("R2-2", "T2/T3 输入框屏蔽快捷键、弹窗门控按键、弹窗与抽屉焦点陷阱及焦点返回", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R2-2", true);

    // 1. Open Settings -> Controls, focus #inp-cloud-save-code, type P, [, ], `, F3
    await page.click("#btn-open-settings");
    await page.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await page.click('[data-sys-tab="controls"]');
    await page.waitForSelector("#inp-cloud-save-code");

    await page.click("#inp-cloud-save-code");
    await page.fill("#inp-cloud-save-code", "");
    await page.keyboard.type("p[]`");
    await page.keyboard.press("F3");
    await page.waitForTimeout(100);

    const inputCheck = await page.evaluate(() => ({
      modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
      photoActive: window.__CHENYUAN_V18__.getState().photoMode.active,
      telemetryVisible: document.getElementById("action-telemetry-panel") ? getComputedStyle(document.getElementById("action-telemetry-panel")).display !== "none" : false,
      inpVal: document.getElementById("inp-cloud-save-code")?.value || ""
    }));
    assert.ok(inputCheck.modalOpen, "Typing p[]` and F3 inside input must NOT close Settings modal");
    assert.equal(inputCheck.photoActive, false, "Typing 'p' inside input must NOT enter photo mode");
    assert.equal(inputCheck.telemetryVisible, false, "Pressing F3 inside input must NOT open telemetry");
    assert.equal(inputCheck.inpVal, "p[]`", `Expected typed chars in input, got: ${inputCheck.inpVal}`);

    // 2. Focus a non-input button inside modal; global shortcuts (P, F3, M, T, [) must be blocked
    await page.focus('#modal-content [data-action="reset-keybinds"]');
    for (const k of ["KeyP", "F3", "KeyM", "KeyT", "BracketLeft", "BracketRight"]) {
      await page.keyboard.press(k);
    }
    const modalGateCheck = await page.evaluate(() => ({
      modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
      photoActive: window.__CHENYUAN_V18__.getState().photoMode.active,
      telemetryVisible: document.getElementById("action-telemetry-panel") ? getComputedStyle(document.getElementById("action-telemetry-panel")).display !== "none" : false,
      stillControls: !!document.getElementById("inp-cloud-save-code")
    }));
    assert.ok(modalGateCheck.modalOpen && modalGateCheck.stillControls, "Global shortcuts must be blocked while modal is open");
    assert.equal(modalGateCheck.photoActive, false, "KeyP must not trigger photoMode while modal is open");
    assert.equal(modalGateCheck.telemetryVisible, false, "F3 must not open #action-telemetry-panel while modal is open");

    // 3. Keybind rebind capture: Escape cancels capture WITHOUT closing Settings modal
    await page.click('.kb-cap-btn[data-rebind-act="posture"]');
    await page.waitForSelector('.kb-cap-btn.listening[data-rebind-act="posture"]');
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    const afterRebindEsc = await page.evaluate(() => ({
      modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
      stillListening: !!document.querySelector(".kb-cap-btn.listening")
    }));
    assert.ok(afterRebindEsc.modalOpen, "Escape during keybind capture must keep Settings modal open");
    assert.equal(afterRebindEsc.stillListening, false, "Escape must cancel keybind listening state");

    // 4. T3 Modal focus trap: 25x Tab & 10x Shift+Tab must NEVER leave #modal-content
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => document.getElementById("modal-content").contains(document.activeElement));
      assert.ok(inside, `Modal Tab #${i + 1} escaped #modal-content!`);
    }
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Shift+Tab");
      const inside = await page.evaluate(() => document.getElementById("modal-content").contains(document.activeElement));
      assert.ok(inside, `Modal Shift+Tab #${i + 1} escaped #modal-content!`);
    }

    // 5. Escape closes modal and restores focus to #btn-open-settings
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));
    const restoredModalFocus = await page.evaluate(() => document.activeElement?.id || "");
    assert.equal(restoredModalFocus, "btn-open-settings", `Modal close must restore focus to #btn-open-settings, got: ${restoredModalFocus}`);

    // 6. T3 Drawer focus trap (#jade-panel) & focus restoration
    await page.click("#nav-btn-cultivate");
    await page.waitForSelector("#jade-panel.drawer-open");
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() => document.getElementById("jade-panel").contains(document.activeElement));
      assert.ok(inside, `Drawer Tab #${i + 1} escaped #jade-panel!`);
    }
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Shift+Tab");
      const inside = await page.evaluate(() => document.getElementById("jade-panel").contains(document.activeElement));
      assert.ok(inside, `Drawer Shift+Tab #${i + 1} escaped #jade-panel!`);
    }
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("jade-panel").classList.contains("drawer-open"));
    const restoredDrawerFocus = await page.evaluate(() => document.activeElement?.id || "");
    assert.equal(restoredDrawerFocus, "nav-btn-cultivate", `Drawer close must restore focus to #nav-btn-cultivate, got: ${restoredDrawerFocus}`);

    // 7. Positive controls outside inputs/modals/drawers: P enters photo mode & F3 toggles #action-telemetry-panel
    await page.keyboard.press("KeyP");
    await page.waitForTimeout(80);
    const photoOn = await page.evaluate(() => window.__CHENYUAN_V18__.getState().photoMode.active);
    assert.equal(photoOn, true, "Positive control: pressing P outside inputs/modals/drawers must enter photo mode");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    const photoOff = await page.evaluate(() => window.__CHENYUAN_V18__.getState().photoMode.active);
    assert.equal(photoOff, false, "Escape must exit photo mode");

    await page.keyboard.press("F3");
    await page.waitForTimeout(80);
    const teleOn = await page.evaluate(() => {
      const el = document.getElementById("action-telemetry-panel");
      return !!el && getComputedStyle(el).display !== "none";
    });
    assert.equal(teleOn, true, "Positive control: pressing F3 outside inputs/modals/drawers must open #action-telemetry-panel");
    await page.keyboard.press("F3");
    await page.waitForTimeout(80);
    const teleOff = await page.evaluate(() => {
      const el = document.getElementById("action-telemetry-panel");
      return !!el && getComputedStyle(el).display === "none";
    });
    assert.equal(teleOff, true, "Pressing F3 again must close #action-telemetry-panel");

    await ctx.close();
  });

  // =========================================================================
  // R2-3: T4 — 云码导入确认流程（校验 -> 预览对比 -> 取消 -> 写入失败回滚 -> 确认导入 + 刷新持久化）
  // =========================================================================
  await runSuite("R2-3", "T4 云码导入确认流程（预览对比、normalizeLoadedGame、写入失败回滚、刷新验证）", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R2-3", true);

    // Prepare current save A ("原道友", stones 123) and synthesize a valid cloud code B ("云端剑尊", qi, stones 888, omitting newer fields)
    const { codeB, badRealmCode } = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const st = api.getState();
      st.game.name = "原道友";
      st.game.stones = 123;
      api.getMetaState().bestScore = 9999;
      api.saveGame();

      function makeCode(payload) {
        const jsonStr = JSON.stringify(payload);
        let sum = 0x24;
        for (let i = 0; i < jsonStr.length; i++) sum = (sum * 31 + jsonStr.charCodeAt(i)) & 0xFFFF;
        const chk = sum.toString(16).toUpperCase().padStart(4, "0");
        const bytes = new TextEncoder().encode(jsonStr);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return `CY24SAVE-${chk}-${btoa(bin)}`;
      }
      return {
        codeB: makeCode({
          v: 24,
          game: { name: "云端剑尊", realm: "qi", stones: 888, openingChoice: "help" },
          metaState: { bestScore: 100, seenEnemies: ["wolf", "bandit"] }
        }),
        badRealmCode: makeCode({
          v: 24,
          game: { name: "非法境", realm: "nonexistent_realm", stones: 50 }
        })
      };
    });

    // Open Settings -> Controls
    await page.click("#btn-open-settings");
    await page.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await page.click('[data-sys-tab="controls"]');
    await page.waitForSelector("#inp-cloud-save-code");

    // 1. Invalid / unknown-realm code must fail cleanly without opening confirm modal
    await page.fill("#inp-cloud-save-code", badRealmCode);
    await page.click("#btn-import-cloud-save");
    await page.waitForTimeout(80);
    const badRes = await page.evaluate(() => ({
      hasConfirmBtn: !!document.getElementById("btn-confirm-cloud-import"),
      statusText: document.getElementById("lbl-cloud-save-status")?.textContent || "",
      stones: window.__CHENYUAN_V25__.getState().game.stones
    }));
    assert.equal(badRes.hasConfirmBtn, false, "Invalid realm cloud code must not open confirm modal");
    assert.ok(badRes.statusText.includes("非法") || badRes.statusText.includes("✕"), `Expected error status, got: ${badRes.statusText}`);
    assert.equal(badRes.stones, 123);

    // 2. Valid code B opens side-by-side confirmation preview WITHOUT mutating game yet
    await page.fill("#inp-cloud-save-code", codeB);
    await page.click("#btn-import-cloud-save");
    await page.waitForSelector("#btn-confirm-cloud-import");
    const previewState = await page.evaluate(() => ({
      modalText: document.getElementById("modal-content").textContent,
      curName: window.__CHENYUAN_V25__.getState().game.name,
      curStones: window.__CHENYUAN_V25__.getState().game.stones
    }));
    assert.ok(previewState.modalText.includes("原道友") && previewState.modalText.includes("云端剑尊"), "Preview modal must show current vs imported 道号");
    assert.ok(previewState.modalText.includes("炼气") && previewState.modalText.includes("888"), "Preview modal must show imported 境界 & 灵石");
    assert.equal(previewState.curStones, 123, "Game state must NOT change before explicit confirmation");

    // 3. Cancel returns to Settings without modifying game
    await page.click('[data-action="cancel-cloud-import"]');
    await page.waitForSelector("#inp-cloud-save-code");
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones), 123);

    // 4. Write failure (QuotaExceededError) on Confirm must roll back & report failure honestly (NEVER "成功")
    await page.fill("#inp-cloud-save-code", codeB);
    await page.click("#btn-import-cloud-save");
    await page.waitForSelector("#btn-confirm-cloud-import");
    await page.evaluate(() => {
      window.__origSetItemR23 = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        const err = new Error("Simulated Quota Exceeded");
        err.name = "QuotaExceededError";
        throw err;
      };
    });
    await page.click("#btn-confirm-cloud-import");
    await page.waitForTimeout(120);
    const failedImport = await page.evaluate(() => {
      Storage.prototype.setItem = window.__origSetItemR23;
      const errEl = document.getElementById("cloud-import-error-msg");
      return {
        errVisible: !!errEl && getComputedStyle(errEl).display !== "none",
        errText: errEl ? errEl.textContent : "",
        name: window.__CHENYUAN_V25__.getState().game.name,
        stones: window.__CHENYUAN_V25__.getState().game.stones
      };
    });
    assert.ok(failedImport.errVisible && failedImport.errText.includes("导入失败"), `Write failure must show honest error, got: ${failedImport.errText}`);
    assert.ok(!failedImport.errText.includes("成功"), "Write failure must NEVER report success");
    assert.equal(failedImport.name, "原道友", "Failed import must roll back game.name");
    assert.equal(failedImport.stones, 123, "Failed import must roll back game.stones");

    // 5. Now confirm with storage restored -> succeeds, normalizes missing fields, merges meta monotonically, persists across reload
    await page.click("#btn-confirm-cloud-import");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));
    const committed = await page.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      const m = window.__CHENYUAN_V25__.getMetaState();
      return {
        name: g.name,
        realm: g.realm,
        stones: g.stones,
        hasSanctumLevels: !!g.sanctumLevels && typeof g.sanctumLevels === "object",
        hasGourd: !!g.gourd && typeof g.gourd === "object",
        bestScore: m.bestScore,
        hasBandit: m.seenEnemies.includes("bandit")
      };
    });
    assert.equal(committed.name, "云端剑尊");
    assert.equal(committed.realm, "qi");
    assert.equal(committed.stones, 888);
    assert.ok(committed.hasSanctumLevels && committed.hasGourd, "normalizeLoadedGame must populate missing fields on cloud import");
    assert.equal(committed.bestScore, 9999, "Cloud import must NOT regress higher metaState.bestScore");
    assert.ok(committed.hasBandit, "Cloud import must merge seenEnemies union");

    // Refresh & continue verifies persistence
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save");
    await page.click("#btn-continue-save");
    await page.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
    const afterReload = await page.evaluate(() => ({
      name: window.__CHENYUAN_V25__.getState().game.name,
      stones: window.__CHENYUAN_V25__.getState().game.stones
    }));
    assert.equal(afterReload.name, "云端剑尊");
    assert.equal(afterReload.stones, 888);

    // 6. XSS safety: crafted cloud save with HTML/onerror payloads in game.name & metaState.hallOfLives
    //    must render escaped text without executing JS in muralHeader (#nav-btn-cultivate) or openHallOfLivesModal()
    const xssCode = await page.evaluate(() => {
      function makeCode(payload) {
        const jsonStr = JSON.stringify(payload);
        let sum = 0x24;
        for (let i = 0; i < jsonStr.length; i++) sum = (sum * 31 + jsonStr.charCodeAt(i)) & 0xFFFF;
        const chk = sum.toString(16).toUpperCase().padStart(4, "0");
        const bytes = new TextEncoder().encode(jsonStr);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return `CY24SAVE-${chk}-${btoa(bin)}`;
      }
      return makeCode({
        v: 24,
        game: { name: "<img src=x onerror=window.__XSS_MURAL=1>", realm: "qi", stones: 777, openingChoice: "help" },
        metaState: {
          bestRushGrade: "<img src=x onerror=window.__XSS_GRADE=1>",
          hallOfLives: [{
            lifeNum: 1,
            name: "<img src=x onerror=window.__XSS_HALL=1>",
            epithet: "<img src=x onerror=window.__XSS_EPITHET=1>",
            poem: "<img src=x onerror=window.__XSS_POEM=1>",
            grade: "S",
            score: 1234,
            karmaMode: "neutral\" onmouseover=\"window.__XSS_ATTR=1",
            karmaLabel: "本真中正",
            perkId: "sword_bone",
            recordedAt: 1700000000000
          }]
        }
      });
    });

    await page.click("#btn-open-settings");
    await page.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await page.click('[data-sys-tab="controls"]');
    await page.waitForSelector("#inp-cloud-save-code");
    await page.fill("#inp-cloud-save-code", xssCode);
    await page.click("#btn-import-cloud-save");
    await page.waitForSelector("#btn-confirm-cloud-import");
    await page.click("#btn-confirm-cloud-import");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));

    // Open cultivate drawer (triggers muralHeader with game.name)
    await page.click("#nav-btn-cultivate");
    await page.waitForSelector("#panel-scroll-body .drawer-mural-banner");
    const drawerXss = await page.evaluate(() => ({
      muralRan: window.__XSS_MURAL,
      injectedImgs: document.querySelectorAll("#panel-scroll-body img[onerror]").length,
      titleText: document.querySelector("#panel-scroll-body .panel-title")?.textContent || ""
    }));
    assert.equal(drawerXss.muralRan, undefined, "muralHeader() must NOT execute XSS from game.name");
    assert.equal(drawerXss.injectedImgs, 0, "muralHeader() must NOT inject <img onerror>");
    assert.ok(drawerXss.titleText.includes("<img src=x onerror=window.__XSS_MURAL=1>"), "muralHeader() must render literal escaped game.name");

    // Open Hall of Lives modal (renders metaState.bestRushGrade & metaState.hallOfLives)
    await page.evaluate(() => window.__CHENYUAN_V25__.openHallOfLivesModal());
    await page.waitForSelector("#modal-backdrop.open .hall-life-card");
    const hallXss = await page.evaluate(() => ({
      hallRan: window.__XSS_HALL,
      epithetRan: window.__XSS_EPITHET,
      poemRan: window.__XSS_POEM,
      gradeRan: window.__XSS_GRADE,
      attrRan: window.__XSS_ATTR,
      injectedImgs: document.querySelectorAll("#modal-content img[onerror]").length,
      modalText: document.getElementById("modal-content")?.textContent || ""
    }));
    assert.equal(hallXss.hallRan, undefined, "openHallOfLivesModal() must NOT execute XSS from lf.name");
    assert.equal(hallXss.epithetRan, undefined, "openHallOfLivesModal() must NOT execute XSS from lf.epithet");
    assert.equal(hallXss.poemRan, undefined, "openHallOfLivesModal() must NOT execute XSS from lf.poem");
    assert.equal(hallXss.gradeRan, undefined, "openHallOfLivesModal() must NOT execute XSS from metaState.bestRushGrade");
    assert.equal(hallXss.attrRan, undefined, "openHallOfLivesModal() must NOT allow karmaMode attribute breakout");
    assert.equal(hallXss.injectedImgs, 0, "openHallOfLivesModal() must NOT inject <img onerror>");
    assert.ok(hallXss.modalText.includes("<img src=x onerror=window.__XSS_HALL=1>"), "Hall of Lives must render literal escaped name");

    await ctx.close();
  });

  // =========================================================================
  // R2-4: T5 — 旧档续玩 (eb0ea67 无 metaRev 格式) + 元存档多标签页无损合并 + 刷新持久化
  // =========================================================================
  await runSuite("R2-4", "T5 旧档续玩(eb0ea67格式)与多标签页元存档无损合并", async () => {
    const ctx = await newIsolatedContext(browser);
    const tabA = await ctx.newPage();
    attachErrorListeners(tabA, "R2-4-TabA");
    await tabA.goto(targetUrl, { waitUntil: "domcontentloaded" });

    // Seed eb0ea67-format primary save + legacy meta save (without metaRev)
    await tabA.evaluate(({ sk, mk }) => {
      localStorage.clear();
      const legacyPrimary = {
        game: { name: "旧档剑修", realm: "qi", stones: 321, openingChoice: "help", hp: 180, mp: 90, laws: ["fire"] },
        stageIdx: 0,
        stanceIdx: 0,
        towerMode: false,
        sanctumMode: false
      };
      const legacyMeta = {
        ascensions: 2,
        bestScore: 500,
        bestTower: 3,
        bestRushGrade: "A",
        bestRushTime: 180,
        seenEnemies: ["wolf", "bandit"],
        seenLaws: ["fire"],
        unlockedEndings: ["sword_saint"],
        reincarnationPoints: 40,
        hallOfLives: [{ lifeNum: 1, name: "前世一", score: 500, endingId: "sword_saint", recordedAt: 1000 }]
      };
      localStorage.setItem(sk, JSON.stringify(legacyPrimary));
      localStorage.setItem(mk, JSON.stringify(legacyMeta));
    }, { sk: STORAGE_KEY, mk: META_KEY });

    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.waitForSelector("#btn-continue-save");
    await tabA.click("#btn-continue-save");
    await tabA.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");

    const tabB = await ctx.newPage();
    attachErrorListeners(tabB, "R2-4-TabB");
    await tabB.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabB.waitForSelector("#btn-continue-save");
    await tabB.click("#btn-continue-save");
    await tabB.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");

    // Tab A progresses ascensions=3, seenEnemies+=stone_golem, bestRushGrade="S", bestRushTime=120
    await tabA.evaluate(() => {
      const m = window.__CHENYUAN_V25__.getMetaState();
      m.ascensions = 3;
      m.reincarnationPoints += 120;
      m.bestRushGrade = "S";
      m.bestRushTime = 120;
      m.seenEnemies.push("stone_golem");
      window.__CHENYUAN_V25__.saveMeta();
    });

    // Wait for Chromium Mojo DOMStorage IPC to deliver Tab A's write to Tab B's localStorage cache
    await tabB.waitForFunction((mk) => {
      try {
        const cur = JSON.parse(localStorage.getItem(mk) || "{}");
        return cur.ascensions === 3;
      } catch (e) { return false; }
    }, META_KEY, { timeout: 5000 });

    // Tab B (explicitly keeping stale in-memory ascensions=2) progresses bestScore=999, seenEnemies+=jade_serpent, bestRushGrade="SS"
    await tabB.evaluate(() => {
      const m = window.__CHENYUAN_V25__.getMetaState();
      m.ascensions = 2;
      m.bestScore = 999;
      m.bestRushGrade = "SS";
      m.seenEnemies.push("jade_serpent");
      window.__CHENYUAN_V25__.saveMeta();
    });

    // Wait for Chromium cross-tab storage IPC + storage event sync on tabA
    await tabA.waitForFunction((mk) => {
      try {
        const cur = JSON.parse(localStorage.getItem(mk) || "{}");
        return cur.bestScore === 999 && window.__CHENYUAN_V25__.getMetaState().bestScore === 999;
      } catch (e) { return false; }
    }, META_KEY, { timeout: 5000 });

    const mergedRaw = await tabA.evaluate((mk) => JSON.parse(localStorage.getItem(mk) || "{}"), META_KEY);
    assert.ok(mergedRaw.metaRev >= 2, `Expected metaRev >= 2, got ${mergedRaw.metaRev}`);
    assert.equal(mergedRaw.ascensions, 3, `Tab B must NOT regress ascensions from 3 to ${mergedRaw.ascensions}`);
    assert.equal(mergedRaw.bestScore, 999, "Merged bestScore must take max (999)");
    assert.equal(mergedRaw.bestRushGrade, "SS", "Merged bestRushGrade must take highest rank (SS > S > A)");
    assert.equal(mergedRaw.bestRushTime, 120, "Merged bestRushTime must take min positive (120)");
    assert.ok(mergedRaw.seenEnemies.includes("stone_golem") && mergedRaw.seenEnemies.includes("jade_serpent"), "Merged seenEnemies must be union of both tabs");

    // Reload Tab A and verify merged meta persists
    await tabA.reload({ waitUntil: "domcontentloaded" });
    const afterReloadMeta = await tabA.evaluate(() => window.__CHENYUAN_V25__.getMetaState());
    assert.equal(afterReloadMeta.ascensions, 3);
    assert.equal(afterReloadMeta.bestScore, 999);

    await ctx.close();
  });

  // =========================================================================
  // R2-5: T6 — 危险写操作守卫（只读/冲突拒删）、pagehide/visibilitychange 落盘、非法外部 storage 提示
  // =========================================================================
  await runSuite("R2-5", "T6 危险写操作守卫、页面隐藏落盘与非法跨标签页 storage 提示", async () => {
    const ctx = await newIsolatedContext(browser);
    const tabA = await ctx.newPage();
    attachErrorListeners(tabA, "R2-5-TabA");
    await tabA.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabA.evaluate(() => localStorage.clear());
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.click("#btn-start-new");
    await tabA.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
    await dismissOpeningScroll(tabA);
    await tabA.evaluate(() => {
      window.__CHENYUAN_V25__.getState().game.openingChoice = "help";
      window.__CHENYUAN_V25__.saveGame();
    });

    const tabB = await ctx.newPage();
    attachErrorListeners(tabB, "R2-5-TabB");
    await tabB.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabB.waitForSelector("#btn-continue-save");
    await tabB.click("#btn-continue-save");
    await tabB.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");

    // Tab B saves newer stones=777 with an XSS payload in name -> Tab A receives conflict -> verify escaped HTML -> Tab A chooses read-only mode
    const conflictXssPayload = "<img src=x onerror=window.__XSS_CONFLICT=1>";
    await tabB.evaluate((payload) => {
      const g = window.__CHENYUAN_V25__.getState().game;
      g.name = payload;
      g.stones = 777;
      window.__CHENYUAN_V25__.saveGame();
    }, conflictXssPayload);
    await tabA.waitForSelector('#modal-backdrop.open [data-action="stay-readonly-save"]');
    const conflictXssCheck = await tabA.evaluate(() => ({
      xssExecuted: !!window.__XSS_CONFLICT,
      injectedImgs: document.querySelectorAll('#modal-content img[onerror]').length,
      modalText: document.getElementById("modal-content")?.textContent || ""
    }));
    assert.equal(conflictXssCheck.xssExecuted, false, "openSaveConflictModal must NOT execute XSS payload from externalName");
    assert.equal(conflictXssCheck.injectedImgs, 0, "openSaveConflictModal must escape externalName without injecting <img>");
    assert.ok(conflictXssCheck.modalText.includes(conflictXssPayload), "openSaveConflictModal must display escaped externalName text");
    await tabA.click('[data-action="stay-readonly-save"]');
    await tabA.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));

    // 1. In read-only Tab A, confirm-reset-save MUST be refused and STORAGE_KEY untouched
    await tabA.click("#btn-open-settings");
    await tabA.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await tabA.click('[data-sys-tab="controls"]');
    await tabA.waitForSelector('[data-action="confirm-reset-save"]');
    await tabA.click('[data-action="confirm-reset-save"]');
    await tabA.waitForTimeout(100);
    const afterResetAttempt = await tabA.evaluate((sk) => ({
      stonesInStorage: JSON.parse(localStorage.getItem(sk) || "{}")?.game?.stones,
      hasExecuteBtn: !!document.querySelector('[data-action="execute-reset-save"]')
    }), STORAGE_KEY);
    assert.equal(afterResetAttempt.hasExecuteBtn, false, "confirm-reset-save must be refused in read-only mode");
    assert.equal(afterResetAttempt.stonesInStorage, 777, "STORAGE_KEY must remain 777 after refused reset");

    // 2. Direct execute-reset-save & reincarnate-now clicks in read-only Tab A MUST also be refused
    await tabA.evaluate(() => {
      const btn1 = document.createElement("button");
      btn1.setAttribute("data-action", "execute-reset-save");
      document.body.appendChild(btn1);
      btn1.click();
      btn1.remove();
      const btn2 = document.createElement("button");
      btn2.setAttribute("data-action", "reincarnate-now");
      document.body.appendChild(btn2);
      btn2.click();
      btn2.remove();
    });
    const afterDangerClicks = await tabA.evaluate((sk) => JSON.parse(localStorage.getItem(sk) || "{}")?.game?.stones, STORAGE_KEY);
    assert.equal(afterDangerClicks, 777, "execute-reset-save and reincarnate-now must NOT delete storage in read-only mode");

    // 3. Cloud import in read-only Tab A MUST be refused and never report success
    const codeFromA = await tabA.evaluate(() => window.__CHENYUAN_V25__.exportFullCloudSaveCode());
    const importInReadOnly = await tabA.evaluate((code) => window.__CHENYUAN_V24__.importFullCloudSaveCode(code), codeFromA);
    assert.equal(importInReadOnly, false, "Cloud import must return false in read-only mode");
    assert.equal(await tabA.evaluate((sk) => JSON.parse(localStorage.getItem(sk) || "{}")?.game?.stones, STORAGE_KEY), 777);

    // 4. pagehide flush in read-only Tab A must NOT overwrite Tab B's 777
    await tabA.evaluate(() => {
      window.__CHENYUAN_V25__.getState().game.stones = 11;
      window.dispatchEvent(new Event("pagehide"));
    });
    assert.equal(await tabA.evaluate((sk) => JSON.parse(localStorage.getItem(sk) || "{}")?.game?.stones, STORAGE_KEY), 777);
    await ctx.close();

    // 5. Clean Tab C: mutate stones=456 without saveGame(), dispatch pagehide -> reload -> persists 456!
    const { ctx: ctxC, page: tabC } = await startCleanGamePage(browser, "R2-5-TabC", true);
    await tabC.evaluate(() => {
      window.__CHENYUAN_V25__.getState().game.stones = 456;
      window.dispatchEvent(new Event("pagehide"));
    });
    await tabC.reload({ waitUntil: "domcontentloaded" });
    await tabC.waitForSelector("#btn-continue-save");
    await tabC.click("#btn-continue-save");
    await tabC.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
    assert.equal(await tabC.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones), 456, "pagehide must flush active save to storage");

    // 6. Synthetic invalid cross-tab storage event must display visible HUD alert & block overwrite
    await tabC.evaluate((sk) => {
      window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: "{CORRUPT_EXTERNAL_JSON" }));
    }, STORAGE_KEY);
    await tabC.waitForTimeout(80);
    const extAlert = await tabC.evaluate(() => {
      const el = document.getElementById("hud-save-alert");
      return {
        visible: !!el && getComputedStyle(el).display !== "none",
        text: el ? el.textContent : "",
        hasReadErr: !!window.__CHENYUAN_V25__.getPersistenceState().storageReadError
      };
    });
    assert.ok(extAlert.visible && extAlert.hasReadErr, `Invalid external storage event must show HUD alert, got: ${JSON.stringify(extAlert)}`);
    await ctxC.close();
  });

  // =========================================================================
  // R2-6: T7 — 无障碍 (prefers-reduced-motion + 手动开关) + Tab 原生焦点导航不抢占 + 旧键位/手柄迁移去重
  // =========================================================================
  await runSuite("R2-6", "T7 无障碍(prefers-reduced-motion/手动开关)、Tab焦点导航与手柄/旧键位迁移", async () => {
    const ctx = await newIsolatedContext(browser, { reducedMotion: "reduce" });
    const page = await ctx.newPage();
    attachErrorListeners(page, "R2-6");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.click("#btn-start-new");
    await page.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
    await dismissOpeningScroll(page);

    const check = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const a11y = api.getState().a11ySettings;
      const defs = api.DEFAULT_KEYBINDS;
      const padBtns = Object.values(defs).map(v => v.padBtn).filter(v => v !== null && v !== undefined);
      const uniquePadBtns = new Set(padBtns);
      const btn = document.getElementById("btn-open-settings");
      const transDur = btn ? getComputedStyle(btn).transitionDuration : "";
      const animDur = btn ? getComputedStyle(btn).animationDuration : "";
      return {
        reducedMotion: a11y.reducedMotion,
        shakeScale: a11y.shakeScale,
        hitStopScale: a11y.hitStopScale,
        hasHtmlClass: document.documentElement.classList.contains("reduced-motion"),
        transDur,
        transSec: parseFloat(transDur),
        animSec: parseFloat(animDur),
        postureKb: defs.posture.kb,
        padBtnCount: padBtns.length,
        uniquePadBtnCount: uniquePadBtns.size,
        allPadInRange: padBtns.every(n => Number.isInteger(n) && n >= 0 && n <= 16)
      };
    });
    assert.equal(check.reducedMotion, true, "prefers-reduced-motion: reduce must set a11ySettings.reducedMotion = true");
    assert.equal(check.shakeScale, 0, "prefers-reduced-motion: reduce must default shakeScale = 0");
    assert.equal(check.hitStopScale, 0, "prefers-reduced-motion: reduce must default hitStopScale = 0");
    assert.equal(check.hasHtmlClass, true, "prefers-reduced-motion: reduce must add html.reduced-motion class");
    assert.ok(Number.isFinite(check.transSec) && check.transSec <= 0.001, `Reduced-motion CSS must shorten transitionDuration <= 1ms, got: ${check.transDur}`);
    assert.ok(Number.isFinite(check.animSec) && check.animSec <= 0.001, `Reduced-motion CSS must shorten animationDuration <= 1ms, got: ${check.animSec}`);
    assert.ok(check.postureKb !== "Tab", `Default posture keybind must NOT be Tab, got: ${check.postureKb}`);
    assert.equal(check.padBtnCount, check.uniquePadBtnCount, `Duplicate gamepad padBtn found! total=${check.padBtnCount}, unique=${check.uniquePadBtnCount}`);
    assert.ok(check.allPadInRange, "All default padBtn indices must be integers in 0..16");

    // Unlock posture (foundation realm) and verify Tab moves focus WITHOUT switching arena.weaponPosture,
    // while Backquote (`) DOES switch arena.weaponPosture (positive control)
    const postureBefore = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const st = api.getState();
      st.game.realm = "foundation";
      st.game.openingChoice = "help";
      api.syncProgressiveSkillVisibility();
      return st.arena.weaponPosture;
    });
    assert.ok(typeof postureBefore === "string" && postureBefore.length > 0, `Expected defined arena.weaponPosture, got: ${postureBefore}`);
    await page.focus("#btn-open-settings");
    const visitedIds = new Set();
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const activeDesc = await page.evaluate(() => {
        const ae = document.activeElement;
        return ae ? (ae.id || ae.tagName + ":" + (ae.textContent || "").trim().slice(0, 12)) : "";
      });
      if (activeDesc) visitedIds.add(activeDesc);
    }
    const postureAfterTab = await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.weaponPosture);
    assert.ok(visitedIds.size >= 3, `Native Tab focus navigation must cycle across HUD controls, visited: ${Array.from(visitedIds).join(", ")}`);
    assert.equal(postureAfterTab, postureBefore, `Pressing Tab must NOT hijack weaponPosture (before=${postureBefore}, after=${postureAfterTab})`);

    // Positive control: pressing Backquote (`) MUST switch weaponPosture!
    await page.keyboard.press("Backquote");
    await page.waitForTimeout(80);
    const postureAfterBackquote = await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.weaponPosture);
    assert.notEqual(postureAfterBackquote, postureBefore, `Positive control: pressing Backquote must switch arena.weaponPosture from ${postureBefore}`);
    await ctx.close();

    // 2. Normal-motion context: manual toggle in Settings -> Accessibility adds html.reduced-motion & shortens CSS transitionDuration
    const { ctx: ctxNormal, page: pageNormal } = await startCleanGamePage(browser, "R2-6-ManualRM", true);
    const beforeManual = await pageNormal.evaluate(() => {
      const btn = document.getElementById("btn-open-settings");
      return {
        hasClass: document.documentElement.classList.contains("reduced-motion"),
        transSec: btn ? parseFloat(getComputedStyle(btn).transitionDuration) : 0
      };
    });
    assert.equal(beforeManual.hasClass, false, "Normal motion context must start without html.reduced-motion");
    assert.ok(beforeManual.transSec > 0.01, `Normal motion transitionDuration should be >10ms, got: ${beforeManual.transSec}s`);

    await pageNormal.click("#btn-open-settings");
    await pageNormal.waitForSelector('#modal-backdrop.open [data-sys-tab="accessibility"]');
    await pageNormal.click('[data-sys-tab="accessibility"]');
    await pageNormal.waitForSelector("#btn-a11y-reduced-motion");
    await pageNormal.click("#btn-a11y-reduced-motion");
    await pageNormal.waitForTimeout(80);
    const afterManual = await pageNormal.evaluate(() => {
      const btn = document.getElementById("btn-open-settings");
      const a11y = window.__CHENYUAN_V25__.getState().a11ySettings;
      return {
        reducedMotion: a11y.reducedMotion,
        hasClass: document.documentElement.classList.contains("reduced-motion"),
        transDur: btn ? getComputedStyle(btn).transitionDuration : "",
        transSec: btn ? parseFloat(getComputedStyle(btn).transitionDuration) : 1
      };
    });
    assert.equal(afterManual.reducedMotion, true, "Manual toggle must set a11ySettings.reducedMotion = true");
    assert.equal(afterManual.hasClass, true, "Manual toggle must add html.reduced-motion class");
    assert.ok(afterManual.transSec <= 0.001, `Manual toggle must shorten CSS transitionDuration <= 1ms, got: ${afterManual.transDur}`);
    await ctxNormal.close();

    // 3. Legacy keybind migration: Tab -> Backquote AND duplicate padBtn=14 (qimen + swordBlink) keeps swordBlink=14 & unbinds qimen
    const ctxMig = await newIsolatedContext(browser);
    const pageMig = await ctxMig.newPage();
    attachErrorListeners(pageMig, "R2-6-KeybindMig");
    await pageMig.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await pageMig.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("chenyuan_keybinds_v22", JSON.stringify({
        binds: {
          posture: { kb: "Tab", padBtn: 4, padGlyph: "LB" },
          qimen: { kb: "KeyU", padBtn: 14, padGlyph: "←" },
          swordBlink: { kb: "KeyF", padBtn: 14, padGlyph: "←" }
        },
        rumbleEnabled: true
      }));
    });
    await pageMig.reload({ waitUntil: "domcontentloaded" });
    const migRes = await pageMig.evaluate(() => {
      const kb = window.__CHENYUAN_V25__.getKeybinds();
      const padBtns = Object.values(kb).map(v => v.padBtn).filter(v => v !== null && v !== undefined);
      return {
        postureKb: kb.posture.kb,
        swordBlinkPad: kb.swordBlink.padBtn,
        swordBlinkGlyph: kb.swordBlink.padGlyph,
        qimenPad: kb.qimen.padBtn,
        qimenGlyph: kb.qimen.padGlyph,
        padTotal: padBtns.length,
        padUnique: new Set(padBtns).size
      };
    });
    assert.equal(migRes.postureKb, "Backquote", `Legacy Tab posture bind must migrate to Backquote, got: ${migRes.postureKb}`);
    assert.equal(migRes.swordBlinkPad, 14, `G-T7a: swordBlink must retain default padBtn 14, got: ${migRes.swordBlinkPad}`);
    assert.equal(migRes.qimenPad, null, `G-T7a: legacy duplicate qimen padBtn 14 must be cleared to null, got: ${migRes.qimenPad}`);
    assert.equal(migRes.qimenGlyph, "未绑", `G-T7a: qimen padGlyph must be 未绑, got: ${migRes.qimenGlyph}`);
    assert.equal(migRes.padTotal, migRes.padUnique, "Migrated keybinds must have 0 duplicate padBtn values");
    await ctxMig.close();
  });

  // =========================================================================
  // R2-7: DOM XSS 全量收口 + 5 存档场景矩阵 + G-T1a/b · G-T3a · G-T6a 回归验收
  // =========================================================================
  await runSuite("R2-7", "DOM XSS全量转义(新开局/旧档续玩/云码)与存档5场景/焦点返回/无改动落盘验收", async () => {
    const P_FULL = '<img src=x onerror="window.__xss=1"><svg onload="window.__xss=2">"><script>window.__xss=3</script>';
    const P_TYPED = "<img src=x>";
    const probeXss = async (page, label) => {
      await page.waitForTimeout(320);
      const p = await page.evaluate(() => ({
        xss: window.__xss,
        injected: document.querySelectorAll('img[src="x"], img[onerror], svg[onload], [onmouseover]').length,
        scripts: document.querySelectorAll("script").length
      }));
      assert.equal(p.xss, undefined, `[${label}] window.__xss must stay undefined, got: ${p.xss}`);
      assert.equal(p.injected, 0, `[${label}] Found ${p.injected} injected DOM XSS nodes`);
      assert.equal(p.scripts, 1, `[${label}] Expected exactly 1 inline <script>, got: ${p.scripts}`);
    };

    // ---- (a) New game real typing XSS + maxlength=12 + reload/continue persistence ----
    {
      const ctx = await newIsolatedContext(browser);
      const page = await ctx.newPage();
      attachErrorListeners(page, "R2-7a");
      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => localStorage.clear());
      await page.reload({ waitUntil: "domcontentloaded" });

      await page.click("#btn-toggle-origin");
      await page.waitForSelector("#player-name-input");
      await page.fill("#player-name-input", "");
      await page.locator("#player-name-input").pressSequentially(P_FULL);
      const cappedVal = await page.inputValue("#player-name-input");
      assert.equal(cappedVal, "<img src=x o", `maxlength=12 must cap typed input, got: ${cappedVal}`);

      await page.fill("#player-name-input", "");
      await page.fill("#player-name-input", "\u202E" + P_TYPED);
      await page.click("#btn-start-new");
      await page.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await dismissOpeningScroll(page);

      const hudName1 = await page.textContent("#hud-name");
      assert.equal(hudName1, P_TYPED, `#hud-name must strip bidi controls on initial session and show literal typed name, got: ${hudName1}`);
      assert.equal(hudName1.includes("\u202E"), false, "createFreshGame must strip bidi control characters on first session");
      await probeXss(page, "R2-7a-hud");

      await page.click("#nav-btn-cultivate");
      await page.waitForSelector("#panel-scroll-body .drawer-mural-banner");
      const muralTitle1 = await page.textContent("#panel-scroll-body .panel-title");
      assert.ok(muralTitle1.includes(P_TYPED), `muralHeader must render literal name, got: ${muralTitle1}`);
      await probeXss(page, "R2-7a-drawer");

      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.getElementById("jade-panel").classList.contains("drawer-open"));
      const focusedAfterEsc = await page.evaluate(() => document.activeElement?.id || "");
      assert.equal(focusedAfterEsc, "nav-btn-cultivate", `Escape from drawer must restore focus to #nav-btn-cultivate, got: ${focusedAfterEsc}`);

      // Reload & continue preserves literal name with 0 injected DOM
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#btn-continue-save");
      await page.click("#btn-continue-save");
      await page.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      const persisted = await page.evaluate((sk) => ({
        hudName: document.getElementById("hud-name")?.textContent || "",
        savedName: JSON.parse(localStorage.getItem(sk) || "{}")?.game?.name || ""
      }), STORAGE_KEY);
      assert.equal(persisted.hudName, P_TYPED);
      assert.equal(persisted.savedName, P_TYPED);
      await page.click("#nav-btn-cultivate");
      await page.waitForSelector("#panel-scroll-body .drawer-mural-banner");
      await probeXss(page, "R2-7a-reload-drawer");
      await ctx.close();
    }

    // ---- (b1) Legacy eb0ea67 resume XSS across ALL 26+ sinks + meta + keybinds + stars DoS ----
    {
      const ctx = await newIsolatedContext(browser);
      const page = await ctx.newPage();
      attachErrorListeners(page, "R2-7b-XSS");
      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

      const P_IMG = '<img src=x onerror="window.__xss=11">';
      const P_ATTR = '1"><img src=x onerror="window.__xss=12">';
      await page.evaluate(({ sk, mk, pFull, pImg, pAttr }) => {
        localStorage.clear();
        const legacySave = {
          game: {
            name: pFull,
            realm: "nascent",
            unlockAllArcana: true,
            openingChoice: "help",
            tutorialDismissed: true,
            tutorialStep: 4,
            stones: pImg,
            statMultBonus: pImg,
            inventory: { herb: pImg, core: pImg, healing_pill: pImg },
            towerBest: pImg,
            towerFloor: pImg,
            tribShield: pImg,
            dao: { benevolence: pImg, edge: pImg, serenity: pImg },
            pet: { id: "fox", level: pImg },
            gourd: { charges: 5, maxCharges: pImg, soaks: [] },
            expeditions: { assignments: {}, bankedStones: pImg, bankedStars: pImg, supportThunderCount: 0, tickTimer: 8 },
            ownedRelics: ["frost_sword"],
            relicStars: { frost_sword: -999 },
            spireCurios: { curio_a: pImg },
            equippedGear: {
              weapon: { slot: "weapon", name: pImg, rarity: pAttr, lvl: "z" + pImg, atk: 12, sell: pImg, art: "icon_blade" },
              armor: null,
              ring: null
            },
            gearBag: [{ slot: "weapon", name: pImg, rarity: pAttr, lvl: pImg, atk: 8, sell: pImg, art: "icon_blade" }],
            marketStock: [{ slot: "ring", name: pImg, rarity: pAttr, price: 10, sell: 5, art: "item_jade" }]
          },
          stageIdx: 0,
          stanceIdx: 0,
          towerMode: false,
          sanctumMode: false
        };
        const legacyMeta = {
          ascensions: 1,
          bestRushGrade: pImg,
          bestRushTime: 42.5,
          hallOfLives: [
            null,
            {
              lifeNum: 1,
              name: pFull,
              epithet: pImg,
              poem: pImg,
              grade: "S",
              score: 999,
              karmaMode: 'neutral" onmouseover="window.__xss=13',
              perkId: "sword_bone",
              recordedAt: 1700000000001
            }
          ]
        };
        localStorage.setItem(sk, JSON.stringify(legacySave));
        localStorage.setItem(mk, JSON.stringify(legacyMeta));
        localStorage.setItem("chenyuan_keybinds_v22", JSON.stringify({
          binds: {
            slash: { label: pImg, kb: pImg, mouseLabel: pImg, padBtn: 2, padGlyph: pImg }
          }
        }));
      }, { sk: STORAGE_KEY, mk: META_KEY, pFull: P_FULL, pImg: P_IMG, pAttr: P_ATTR });

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#btn-continue-save");
      await page.click("#btn-continue-save");
      await page.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");

      const loadedCheck = await page.evaluate((pFull) => {
        const g = window.__CHENYUAN_V25__.getState().game;
        return {
          hudName: document.getElementById("hud-name")?.textContent || "",
          hudStones: (document.getElementById("hud-stones")?.textContent || "").trim(),
          hudAgeSchool: document.getElementById("hud-age-school")?.textContent || "",
          stones: g.stones,
          towerBest: g.towerBest,
          tribShield: g.tribShield,
          statMultBonus: g.statMultBonus,
          daoBen: g.dao?.benevolence,
          daoEdge: g.dao?.edge,
          daoSer: g.dao?.serenity,
          herb: g.inventory?.herb,
          bestRushGrade: window.__CHENYUAN_V25__.getMetaState().bestRushGrade,
          slashLabel: window.__CHENYUAN_V25__.getKeybinds().slash.label,
          slashKb: window.__CHENYUAN_V25__.getKeybinds().slash.kb,
          matchesFull: (document.getElementById("hud-name")?.textContent || "") === pFull
        };
      }, P_FULL);
      assert.equal(loadedCheck.matchesFull, true, "Legacy long name must be preserved verbatim (not truncated)");
      assert.ok(Number.isFinite(loadedCheck.stones) && loadedCheck.stones >= 0, `stones must be finite >= 0, got: ${loadedCheck.stones}`);
      assert.ok(Number.isFinite(loadedCheck.towerBest) && loadedCheck.towerBest >= 0, `towerBest must be finite >= 0, got: ${loadedCheck.towerBest}`);
      assert.ok(Number.isFinite(loadedCheck.tribShield) && loadedCheck.tribShield >= 0, `tribShield must be finite >= 0, got: ${loadedCheck.tribShield}`);
      assert.ok(Number.isFinite(loadedCheck.statMultBonus) && loadedCheck.statMultBonus >= 0.5, `statMultBonus must be finite >= 0.5, got: ${loadedCheck.statMultBonus}`);
      assert.ok(Number.isFinite(loadedCheck.daoBen) && loadedCheck.daoBen >= 0, `dao.benevolence must be finite >= 0, got: ${loadedCheck.daoBen}`);
      assert.ok(Number.isFinite(loadedCheck.daoEdge) && loadedCheck.daoEdge >= 0, `dao.edge must be finite >= 0, got: ${loadedCheck.daoEdge}`);
      assert.ok(Number.isFinite(loadedCheck.daoSer) && loadedCheck.daoSer >= 0, `dao.serenity must be finite >= 0, got: ${loadedCheck.daoSer}`);
      assert.ok(Number.isFinite(loadedCheck.herb) && loadedCheck.herb >= 0, `inventory.herb must be finite >= 0, got: ${loadedCheck.herb}`);
      assert.match(loadedCheck.hudStones, /^\d+$/, `#hud-stones must render finite integer string (not NaN), got: ${loadedCheck.hudStones}`);
      assert.ok(!loadedCheck.hudAgeSchool.includes("NaN"), `#hud-age-school must not render NaN, got: ${loadedCheck.hudAgeSchool}`);
      assert.equal(loadedCheck.bestRushGrade, null, "ensureMetaState must reject non-whitelisted bestRushGrade");
      assert.equal(loadedCheck.slashLabel, "四段轻剑连招", "loadKeybinds must ignore untrusted storage label");
      assert.equal(loadedCheck.slashKb, "KeyI", "loadKeybinds must reject malformed kb code");

      // Open BossRush (also verify render-sink escapeHtml even if bestRushGrade were tampered in memory)
      await page.evaluate((pImg) => {
        const api = window.__CHENYUAN_V25__;
        api.getMetaState().bestRushGrade = pImg;
        api.openBossRushModal();
      }, P_IMG);
      await page.waitForSelector("#modal-backdrop.open");
      await probeXss(page, "R2-7b-bossrush");
      await page.evaluate(() => { window.__CHENYUAN_V25__.getMetaState().bestRushGrade = null; window.__CHENYUAN_V25__.closeModal(); });

      // SanctumUpgrade modal
      await page.evaluate(() => window.__CHENYUAN_V25__.openSanctumUpgradeModal());
      await page.waitForSelector("#modal-backdrop.open");
      await probeXss(page, "R2-7b-sanctum");
      await page.keyboard.press("Escape");

      // TribulationPrep modal
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.xp = 1e9;
        api.openTribulationPrepModal();
      });
      await page.waitForSelector("#modal-backdrop.open");
      await probeXss(page, "R2-7b-tribulation");
      await page.keyboard.press("Escape");

      // Ending modal (verdict + ascended branch)
      await page.evaluate(() => window.__CHENYUAN_V25__.openEndingModal());
      await page.waitForSelector("#modal-backdrop.open");
      await probeXss(page, "R2-7b-ending-verdict");
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const g = api.getState().game;
        g.status = "ascended";
        g.ending = null;
        api.openEndingModal();
      });
      await page.waitForSelector("#modal-backdrop.open");
      await probeXss(page, "R2-7b-ending-ascended");
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.status = "active";
        api.closeModal();
      });

      // Expedition modal
      await page.evaluate(() => window.__CHENYUAN_V25__.openExpeditionSandboxModal());
      await page.waitForSelector("#modal-backdrop.open");
      await probeXss(page, "R2-7b-expedition");
      await page.keyboard.press("Escape");

      // Hall of Lives modal (also confirms null entry in hallOfLives did not crash)
      await page.evaluate(() => window.__CHENYUAN_V25__.openHallOfLivesModal());
      await page.waitForSelector("#modal-backdrop.open .hall-life-card");
      await probeXss(page, "R2-7b-hall");
      await page.keyboard.press("Escape");

      // Settings Controls tab
      await page.click("#btn-open-settings");
      await page.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
      await page.click('[data-sys-tab="controls"]');
      await page.waitForSelector("#inp-cloud-save-code");
      await probeXss(page, "R2-7b-settings-controls");
      await page.keyboard.press("Escape");

      // All 4 Drawer tabs (cultivate, explore, alchemy [tests stars=-999 clamp], bag)
      for (const tabBtn of ["#nav-btn-cultivate", "#nav-btn-explore", "#nav-btn-alchemy", "#nav-btn-bag"]) {
        await page.click(tabBtn);
        await page.waitForSelector("#jade-panel.drawer-open #panel-scroll-body .drawer-mural-banner");
        await probeXss(page, `R2-7b-drawer-${tabBtn}`);
      }
      await page.keyboard.press("Escape");
      await ctx.close();
    }

    // ---- (b2) Legacy save with numeric name: 12345 must NOT crash on continue ----
    {
      const ctx = await newIsolatedContext(browser);
      const page = await ctx.newPage();
      attachErrorListeners(page, "R2-7b-NumericName");
      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem("chenyuan_wendao_v10_save", JSON.stringify({
          game: { name: 12345, realm: "qi", stones: 88, openingChoice: "help" },
          stageIdx: 0,
          stanceIdx: 0,
          towerMode: false,
          sanctumMode: false
        }));
      });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#btn-continue-save");
      // Mock QuotaExceededError on STORAGE_KEY during legacy upgrade -> toast must NOT falsely claim upgrade succeeded
      await page.evaluate((sk) => {
        window.__origSetLeg = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === sk) {
            const err = new Error("Quota full during legacy upgrade");
            err.name = "QuotaExceededError";
            throw err;
          }
          return window.__origSetLeg.call(this, k, v);
        };
      }, STORAGE_KEY);
      await page.click("#btn-continue-save");
      await page.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      const legQuotaCheck = await page.evaluate(() => {
        Storage.prototype.setItem = window.__origSetLeg;
        return {
          hudName: document.getElementById("hud-name")?.textContent || "",
          toastTxt: document.getElementById("toast-container")?.textContent || "",
          hasWriteErr: !!window.__CHENYUAN_V25__.getPersistenceState().storageWriteError,
          v10Intact: !!localStorage.getItem("chenyuan_wendao_v10_save")
        };
      });
      assert.equal(legQuotaCheck.hudName, "12345", "Numeric legacy name must coerce to '12345' without crashing");
      assert.equal(legQuotaCheck.hasWriteErr, true, "Legacy upgrade quota failure must set storageWriteError");
      assert.equal(legQuotaCheck.v10Intact, true, "Legacy v10 save must stay intact on quota failure");
      assert.equal(legQuotaCheck.toastTxt.includes("自动升级校验封装"), false, `Legacy upgrade failure must not show false upgrade-success toast, got: ${legQuotaCheck.toastTxt}`);
      await ctx.close();
    }

    // ---- (b3) Prototype-pollution relicStars XSS (legacy) + malformed fields (null gear/learned, non-int indices, proto keys) + cross-tab saveRev:"Infinity" ----
    {
      // Part A: legacy save with __proto__ inside relicStars -> 0 XSS in Cultivate Drawer & Goals Endgame tab, finite HUD atk
      const ctxProto = await newIsolatedContext(browser);
      const pageProto = await ctxProto.newPage();
      attachErrorListeners(pageProto, "R2-7b-ProtoRelic");
      await pageProto.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await pageProto.evaluate((sk) => {
        localStorage.clear();
        const rawJson = '{"game":{"realm":"qi","name":"法宝原型测试","loadout":{"relic":"frost_sword"},"ownedRelics":["frost_sword"],"relicStars":{"__proto__":{"frost_sword":"<img src=x onerror=\\"window.__xss=99\\">"}}},"stageIdx":0,"stanceIdx":0,"towerMode":false,"sanctumMode":false}';
        localStorage.setItem(sk, rawJson);
      }, STORAGE_KEY);
      await pageProto.reload({ waitUntil: "domcontentloaded" });
      await pageProto.waitForSelector("#btn-continue-save");
      await pageProto.click("#btn-continue-save");
      await pageProto.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      const hudAtkText = await pageProto.textContent("#hud-age-school");
      assert.ok(hudAtkText && !hudAtkText.includes("NaN"), `relicStars __proto__ must not poison HUD attack with NaN, got: ${hudAtkText}`);
      await pageProto.click("#nav-btn-cultivate");
      await pageProto.waitForSelector("#jade-panel.drawer-open #panel-scroll-body .drawer-mural-banner");
      await probeXss(pageProto, "R2-7b-proto-relic-drawer");
      await pageProto.keyboard.press("Escape");
      await pageProto.waitForFunction(() => !document.getElementById("jade-panel").classList.contains("drawer-open"));
      await pageProto.click("#btn-goals-modal");
      await pageProto.waitForSelector('#modal-backdrop.open [data-goal-tab="endgame"]');
      await pageProto.click('[data-goal-tab="endgame"]');
      await probeXss(pageProto, "R2-7b-proto-relic-endgame");
      await pageProto.keyboard.press("Escape");
      await ctxProto.close();

      // Part B: malformed legacy save (null gear/learned, omenIndex 1.5, stanceIdx -1, stageIdx "constructor", proto keys in comboSeq/souls/fruits/weaponForm, __proto__:null)
      const ctxMal = await newIsolatedContext(browser);
      const pageMal = await ctxMal.newPage();
      attachErrorListeners(pageMal, "R2-7b-Malformed");
      await pageMal.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await pageMal.evaluate((sk) => {
        localStorage.clear();
        const rawJson = '{"game":{"__proto__":null,"realm":"golden","unlockAllArcana":true,"name":"畸形旧档测试","equippedGear":null,"learned":null,"omenIndex":1.5,"customComboSeq":{"enabled":true,"slots":["constructor","toString","__proto__","valueOf"],"morphCount":0},"unlockedSouls":["constructor"],"equippedSoul":"bad_soul","destinyFruits":["constructor","toString"],"weaponForm":"constructor"},"stageIdx":"constructor","stanceIdx":-1,"towerMode":false,"sanctumMode":false}';
        localStorage.setItem(sk, rawJson);
      }, STORAGE_KEY);
      await pageMal.reload({ waitUntil: "domcontentloaded" });
      await pageMal.waitForSelector("#btn-continue-save");
      await pageMal.click("#btn-continue-save");
      await pageMal.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      const malState = await pageMal.evaluate(() => {
        const st = window.__CHENYUAN_V25__.getState();
        const g = st.game;
        return {
          protoIsObject: Object.getPrototypeOf(g) === Object.prototype,
          hasWeapon: !!(g.equippedGear && g.equippedGear.weapon),
          learnedIsArr: Array.isArray(g.learned) && g.learned.length > 0,
          omenInt: Number.isInteger(g.omenIndex) && g.omenIndex >= 0,
          stanceIdx: st.arena.stanceIdx,
          stageIdx: st.arena.stageIdx,
          equippedSoul: g.equippedSoul,
          fruitsLen: Array.isArray(g.destinyFruits) ? g.destinyFruits.length : -1,
          weaponForm: g.weaponForm,
          soulLbl: (document.getElementById("lbl-soul-name")?.textContent || "").trim(),
          arsBtn: (document.getElementById("btn-cycle-arsenal")?.textContent || "").trim()
        };
      });
      assert.equal(malState.protoIsObject, true, "raw __proto__:null must not strip game prototype");
      assert.equal(malState.hasWeapon, true, "equippedGear:null must fall back to default starter weapon");
      assert.equal(malState.learnedIsArr, true, "learned:null must fall back to default learned skills");
      assert.equal(malState.omenInt, true, "omenIndex:1.5 must be normalized to a valid integer");
      assert.ok(Number.isInteger(malState.stanceIdx) && malState.stanceIdx >= 0 && malState.stanceIdx < 3, `stanceIdx:-1 must normalize to valid index, got: ${malState.stanceIdx}`);
      assert.equal(malState.stageIdx, 0, `stageIdx:"constructor" must normalize to 0, got: ${malState.stageIdx}`);
      assert.equal(malState.equippedSoul, "blood_warden", `prototype unlockedSouls must sanitize equippedSoul, got: ${malState.equippedSoul}`);
      assert.equal(malState.fruitsLen, 0, `prototype destinyFruits must be filtered out, got length: ${malState.fruitsLen}`);
      assert.equal(malState.weaponForm, "sword", `prototype weaponForm must default to sword, got: ${malState.weaponForm}`);
      assert.ok(malState.soulLbl.length > 0, "#lbl-soul-name must stay populated");
      assert.ok(malState.arsBtn.length > 0, "#btn-cycle-arsenal must stay populated");

      // Open Cultivate Drawer + Combo Sequencer modal cleanly with 0 errors
      await pageMal.click("#nav-btn-cultivate");
      await pageMal.waitForSelector("#jade-panel.drawer-open #panel-scroll-body .drawer-mural-banner");
      const drawerTxt = await pageMal.textContent("#panel-scroll-body");
      assert.ok(!drawerTxt.includes("★ Object · undefined"), "Cultivate drawer must not render prototype keys as destiny fruits");
      await pageMal.click('[data-action="open-sequencer"]');
      await pageMal.waitForSelector("#modal-backdrop.open .seq-slot-grid");
      await pageMal.keyboard.press("Escape");
      await pageMal.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));

      // Part C: cross-tab saveRev:"Infinity" must NEVER show vInfinity or write "saveRev": null
      const infCheck = await pageMal.evaluate((sk) => {
        const cur = JSON.parse(localStorage.getItem(sk));
        cur.saveRev = "Infinity";
        cur.tabId = "other_tab_inf";
        const evilRaw = JSON.stringify(cur);
        window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: evilRaw }));
        const modalTxt = document.getElementById("modal-backdrop")?.classList.contains("open")
          ? (document.getElementById("modal-content")?.textContent || "")
          : "";
        const pers = window.__CHENYUAN_V25__.getPersistenceState();
        // Force overwrite should still write a finite positive integer saveRev (never null)
        window.__CHENYUAN_V25__.saveGame({ forceOverwrite: true });
        const afterSave = JSON.parse(localStorage.getItem(sk) || "{}");
        return {
          modalShowsInfinity: modalTxt.includes("vInfinity") || modalTxt.includes("Infinity"),
          caughtReadErr: !!pers.storageReadError,
          writtenRev: afterSave.saveRev
        };
      }, STORAGE_KEY);
      assert.equal(infCheck.modalShowsInfinity, false, "saveRev:'Infinity' must NEVER render vInfinity");
      assert.equal(infCheck.caughtReadErr, true, "saveRev:'Infinity' must be flagged as invalid save envelope");
      assert.ok(Number.isInteger(infCheck.writtenRev) && infCheck.writtenRev >= 1, `saveRev after overwrite must be finite positive integer (never null), got: ${infCheck.writtenRev}`);
      await ctxMal.close();
    }

    // ---- (c) Cloud code preview + confirm + reload with malicious payloads ----
    {
      const { ctx, page } = await startCleanGamePage(browser, "R2-7c-CloudXSS", true);
      const cloudCode = await page.evaluate((pFull) => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.name = pFull;
        api.saveGame();
        const pImg = '<img src=x onerror="window.__xss=21">';
        const payload = {
          v: 24,
          game: {
            name: pFull,
            realm: "nascent",
            stones: pImg,
            statMultBonus: pImg,
            towerBest: pImg,
            tribShield: pImg,
            dao: { benevolence: pImg, edge: pImg, serenity: pImg },
            inventory: { herb: pImg, core: pImg },
            loadout: { relic: "frost_sword" },
            ownedRelics: ["frost_sword"],
            relicStars: JSON.parse('{"__proto__":{"frost_sword":"<img src=x onerror=\\"window.__xss=99\\">"}}'),
            openingChoice: "help"
          },
          metaState: {
            bestRushGrade: pImg,
            hallOfLives: [{ lifeNum: 1, name: pFull, epithet: pImg, poem: pImg, grade: "A", score: 500, recordedAt: 1700000000002 }]
          },
          a11ySettings: { shakeScale: "bad_str", reducedMotion: "yes" },
          stems: { guqin: "bad_str" }
        };
        const jsonStr = JSON.stringify(payload);
        if (!jsonStr.includes('"__proto__"')) throw new Error("Cloud XSS test payload missing __proto__ key");
        let sum = 0x24;
        for (let i = 0; i < jsonStr.length; i++) sum = (sum * 31 + jsonStr.charCodeAt(i)) & 0xFFFF;
        const chk = sum.toString(16).toUpperCase().padStart(4, "0");
        const bytes = new TextEncoder().encode(jsonStr);
        let bin = "";
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        return `CY24SAVE-${chk}-${btoa(bin)}`;
      }, P_FULL);

      await page.click("#btn-open-settings");
      await page.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
      await page.click('[data-sys-tab="controls"]');
      await page.waitForSelector("#inp-cloud-save-code");
      await page.fill("#inp-cloud-save-code", cloudCode);
      await page.click("#btn-import-cloud-save");
      await page.waitForSelector("#modal-backdrop.open #btn-confirm-cloud-import");

      // Preview modal must render escaped literal name TWICE (current + imported) with 0 injection
      const previewTxt = await page.textContent("#modal-backdrop.open #modal-content");
      const needle = `道号：${P_FULL}`;
      const firstIdx = previewTxt.indexOf(needle);
      const secondIdx = firstIdx >= 0 ? previewTxt.indexOf(needle, firstIdx + needle.length) : -1;
      assert.ok(firstIdx >= 0 && secondIdx > firstIdx, "Cloud preview modal must render escaped literal name for both current and imported saves");
      await probeXss(page, "R2-7c-preview");

      await page.click("#btn-confirm-cloud-import");
      await page.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));

      const afterImport = await page.evaluate(() => {
        const st = window.__CHENYUAN_V25__.getState();
        const m = window.__CHENYUAN_V25__.getMetaState();
        const v22 = window.__CHENYUAN_V22__.getState();
        return {
          name: st.game.name,
          hudStones: (document.getElementById("hud-stones")?.textContent || "").trim(),
          hudAgeSchool: document.getElementById("hud-age-school")?.textContent || "",
          stones: st.game.stones,
          towerBest: st.game.towerBest,
          tribShield: st.game.tribShield,
          statMultBonus: st.game.statMultBonus,
          daoBen: st.game.dao?.benevolence,
          daoEdge: st.game.dao?.edge,
          daoSer: st.game.dao?.serenity,
          herb: st.game.inventory.herb,
          bestRushGrade: m.bestRushGrade,
          shakeScale: st.a11ySettings.shakeScale,
          rmType: typeof st.a11ySettings.reducedMotion,
          guqin: v22.audioStems.guqin
        };
      });
      assert.equal(afterImport.name, P_FULL);
      assert.ok(Number.isFinite(afterImport.stones) && afterImport.stones >= 0, `Cloud import stones must be finite >= 0, got: ${afterImport.stones}`);
      assert.ok(Number.isFinite(afterImport.towerBest) && afterImport.towerBest >= 0, `Cloud import towerBest must be finite >= 0, got: ${afterImport.towerBest}`);
      assert.ok(Number.isFinite(afterImport.tribShield) && afterImport.tribShield >= 0, `Cloud import tribShield must be finite >= 0, got: ${afterImport.tribShield}`);
      assert.ok(Number.isFinite(afterImport.statMultBonus) && afterImport.statMultBonus >= 0.5, `Cloud import statMultBonus must be finite >= 0.5, got: ${afterImport.statMultBonus}`);
      assert.ok(Number.isFinite(afterImport.daoBen) && afterImport.daoBen >= 0, `Cloud import dao.benevolence must be finite >= 0, got: ${afterImport.daoBen}`);
      assert.ok(Number.isFinite(afterImport.daoEdge) && afterImport.daoEdge >= 0, `Cloud import dao.edge must be finite >= 0, got: ${afterImport.daoEdge}`);
      assert.ok(Number.isFinite(afterImport.daoSer) && afterImport.daoSer >= 0, `Cloud import dao.serenity must be finite >= 0, got: ${afterImport.daoSer}`);
      assert.ok(Number.isFinite(afterImport.herb) && afterImport.herb >= 0, `Cloud import inventory.herb must be finite >= 0, got: ${afterImport.herb}`);
      assert.match(afterImport.hudStones, /^\d+$/, `Cloud import #hud-stones must be finite numeric string, got: ${afterImport.hudStones}`);
      assert.ok(!afterImport.hudAgeSchool.includes("NaN"), `Cloud import #hud-age-school must not show NaN, got: ${afterImport.hudAgeSchool}`);
      assert.equal(afterImport.bestRushGrade, null, "Cloud import must whitelist bestRushGrade");
      assert.ok(Number.isFinite(afterImport.shakeScale), "Cloud import must sanitize a11ySettings.shakeScale");
      assert.equal(afterImport.rmType, "boolean", "Cloud import must sanitize a11ySettings.reducedMotion");
      assert.ok(Number.isFinite(afterImport.guqin), "Cloud import must sanitize audioStems");

      await page.click("#nav-btn-cultivate");
      await page.waitForSelector("#jade-panel.drawer-open #panel-scroll-body .drawer-mural-banner");
      await probeXss(page, "R2-7c-proto-relic-drawer");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.getElementById("jade-panel").classList.contains("drawer-open"));

      await page.click("#btn-goals-modal");
      await page.waitForSelector('#modal-backdrop.open [data-goal-tab="endgame"]');
      await page.click('[data-goal-tab="endgame"]');
      await probeXss(page, "R2-7c-proto-relic-endgame");
      await page.keyboard.press("Escape");

      await page.evaluate(() => window.__CHENYUAN_V25__.openBossRushModal());
      await page.waitForSelector("#modal-backdrop.open");
      await probeXss(page, "R2-7c-bossrush");
      await page.keyboard.press("Escape");

      await page.evaluate(() => window.__CHENYUAN_V25__.openSanctumUpgradeModal());
      await page.waitForSelector("#modal-backdrop.open");
      await probeXss(page, "R2-7c-sanctum");
      await page.keyboard.press("Escape");

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#btn-continue-save");
      await page.click("#btn-continue-save");
      await page.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      assert.equal(await page.textContent("#hud-name"), P_FULL);
      await page.click("#nav-btn-cultivate");
      await page.waitForSelector("#panel-scroll-body .drawer-mural-banner");
      await probeXss(page, "R2-7c-reload-drawer");
      await ctx.close();
    }

    // ---- (d1) T1 corrupted meta reset under quota failure + reload + cross-tab invalid META + T5/G-T1b metaWriteError alert ----
    {
      const ctx = await newIsolatedContext(browser);
      const page = await ctx.newPage();
      attachErrorListeners(page, "R2-7d-T1-T5");
      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      const badMeta = "{BROKEN_META_R27";
      await page.evaluate(({ mk, raw }) => {
        localStorage.clear();
        localStorage.setItem(mk, raw);
      }, { mk: META_KEY, raw: badMeta });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector('#save-status-banner [data-action="prompt-reset-corrupt-meta"]');

      // Reset under quota failure -> must preserve metaReadError, keep corrupt raw, roll back cleanly
      await page.click('#save-status-banner [data-action="prompt-reset-corrupt-meta"]');
      await page.waitForSelector('#modal-backdrop.open [data-action="confirm-reset-corrupt-meta"]');
      await page.evaluate((mk) => {
        window.__origSetMeta = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === mk) {
            const err = new Error("Meta Quota Full");
            err.name = "QuotaExceededError";
            throw err;
          }
          return window.__origSetMeta.call(this, k, v);
        };
      }, META_KEY);
      await page.click('[data-action="confirm-reset-corrupt-meta"]');
      await page.waitForTimeout(100);
      const failedReset = await page.evaluate((mk) => {
        Storage.prototype.setItem = window.__origSetMeta;
        const p = window.__CHENYUAN_V25__.getPersistenceState();
        return {
          rawStillIntact: localStorage.getItem(mk),
          hasMetaReadErr: !!p.metaReadError,
          hasMetaWriteErr: !!p.metaWriteError
        };
      }, META_KEY);
      assert.equal(failedReset.rawStillIntact, badMeta, "Quota failure during meta reset must keep corrupt raw intact");
      assert.equal(failedReset.hasMetaReadErr, true, "Quota failure during meta reset must roll back metaReadError");
      assert.equal(failedReset.hasMetaWriteErr, true, "Quota failure during meta reset must record metaWriteError");

      // Now confirm with storage restored -> succeeds and persists valid meta after reload
      await page.click('[data-action="confirm-reset-corrupt-meta"]');
      await page.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));
      await page.reload({ waitUntil: "domcontentloaded" });
      const afterMetaReload = await page.evaluate((mk) => ({
        metaReadError: window.__CHENYUAN_V25__.getPersistenceState().metaReadError,
        parsed: JSON.parse(localStorage.getItem(mk) || "null")
      }), META_KEY);
      assert.equal(afterMetaReload.metaReadError, null, "Reload after meta reset must have metaReadError === null");
      assert.ok(afterMetaReload.parsed && afterMetaReload.parsed.metaRev >= 1, "Reloaded reset meta must be valid with metaRev >= 1");

      // Start game -> T5/G-T1b meta write quota failure renders visible #hud-save-alert
      await page.click("#btn-start-new");
      await page.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await dismissOpeningScroll(page);
      const metaQuotaUi = await page.evaluate((mk) => {
        const orig = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === mk) {
            const err = new Error("Meta Quota Full");
            err.name = "QuotaExceededError";
            throw err;
          }
          return orig.call(this, k, v);
        };
        const ok = window.__CHENYUAN_V25__.saveMeta();
        Storage.prototype.setItem = orig;
        const alertEl = document.getElementById("hud-save-alert");
        return {
          ok,
          alertVisible: !!alertEl && getComputedStyle(alertEl).display !== "none",
          alertText: alertEl ? alertEl.textContent : "",
          hasRetryBtn: !!alertEl?.querySelector('[data-action="retry-meta-save"]')
        };
      }, META_KEY);
      assert.equal(metaQuotaUi.ok, false, "saveMeta must return false on quota failure");
      assert.equal(metaQuotaUi.alertVisible, true, "G-T1b: metaWriteError must show visible #hud-save-alert");
      assert.ok(metaQuotaUi.alertText.includes("元存档写入失败"), `G-T1b: HUD alert must explain meta write failure, got: ${metaQuotaUi.alertText}`);
      assert.equal(metaQuotaUi.hasRetryBtn, true, "G-T1b: HUD alert must expose retry-meta-save button");

      await page.click('#hud-save-alert [data-action="retry-meta-save"]');
      await page.waitForTimeout(80);
      const afterRetryMeta = await page.evaluate(() => {
        const alertEl = document.getElementById("hud-save-alert");
        return {
          metaWriteError: window.__CHENYUAN_V25__.getPersistenceState().metaWriteError,
          alertHidden: !alertEl || getComputedStyle(alertEl).display === "none"
        };
      });
      assert.equal(afterRetryMeta.metaWriteError, null, "Retry meta save must clear metaWriteError");
      assert.equal(afterRetryMeta.alertHidden, true, "HUD alert must hide once meta write succeeds");

      // Cross-tab invalid META_KEY storage event triggers meta corruption banner without overwriting
      const prevValidMeta = await page.evaluate((mk) => localStorage.getItem(mk), META_KEY);
      await page.evaluate((mk) => {
        window.dispatchEvent(new StorageEvent("storage", { key: mk, newValue: "{CORRUPT_REMOTE_META" }));
      }, META_KEY);
      await page.waitForTimeout(80);
      const remoteMetaAlert = await page.evaluate((mk) => {
        const alertEl = document.getElementById("hud-save-alert");
        return {
          visible: !!alertEl && getComputedStyle(alertEl).display !== "none",
          text: alertEl ? alertEl.textContent : "",
          hasMetaReadErr: !!window.__CHENYUAN_V25__.getPersistenceState().metaReadError,
          saveMetaRet: window.__CHENYUAN_V25__.saveMeta(),
          storageUnchanged: localStorage.getItem(mk)
        };
      }, META_KEY);
      assert.equal(remoteMetaAlert.hasMetaReadErr, true, "Invalid cross-tab META_KEY storage event must set metaReadError");
      assert.ok(remoteMetaAlert.visible && remoteMetaAlert.text.includes("元存档损坏"), `Invalid cross-tab META_KEY must show 元存档损坏 alert, got: ${remoteMetaAlert.text}`);
      assert.equal(remoteMetaAlert.saveMetaRet, false, "saveMeta must refuse write after invalid cross-tab META_KEY event");
      assert.equal(remoteMetaAlert.storageUnchanged, prevValidMeta, "Invalid cross-tab META_KEY must not trigger overwrite");
      await ctx.close();
    }

    // ---- (d2) G-T6a no-op flush + visibilitychange flush + Conflict state (non-readonly) rejects T4 UI import & T6 reset/reincarnate ----
    {
      const ctx = await newIsolatedContext(browser);
      const tabA = await ctx.newPage();
      attachErrorListeners(tabA, "R2-7d-TabA");
      await tabA.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await tabA.evaluate(() => localStorage.clear());
      await tabA.reload({ waitUntil: "domcontentloaded" });
      await tabA.click("#btn-start-new");
      await tabA.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await dismissOpeningScroll(tabA);

      // G-T6a: no-op flushSaveOnLifecycle MUST NOT increment saveRev; visibilitychange hidden flushes real mutation
      const lifecycleCheck = await tabA.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.openingChoice = "help";
        api.saveGame();
        const rev0 = api.getPersistenceState().loadedSaveRev;
        const storedRev0 = JSON.parse(localStorage.getItem(sk)).saveRev;
        api.flushSaveOnLifecycle();
        api.flushSaveOnLifecycle();
        const revAfterNoop = api.getPersistenceState().loadedSaveRev;
        const storedRevAfterNoop = JSON.parse(localStorage.getItem(sk)).saveRev;

        // Mutate state & dispatch visibilitychange(hidden)
        api.getState().game.stones = 654;
        const origDesc = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
        if (origDesc) Object.defineProperty(document, "visibilityState", origDesc);
        else delete document.visibilityState;

        const storedAfterVis = JSON.parse(localStorage.getItem(sk));
        return {
          rev0,
          storedRev0,
          revAfterNoop,
          storedRevAfterNoop,
          revAfterVis: api.getPersistenceState().loadedSaveRev,
          stonesAfterVis: storedAfterVis.game.stones
        };
      }, STORAGE_KEY);
      assert.equal(lifecycleCheck.revAfterNoop, lifecycleCheck.rev0, "G-T6a: no-op flushSaveOnLifecycle must NOT bump loadedSaveRev");
      assert.equal(lifecycleCheck.storedRevAfterNoop, lifecycleCheck.storedRev0, "G-T6a: no-op flushSaveOnLifecycle must NOT bump stored saveRev");
      assert.equal(lifecycleCheck.revAfterVis, lifecycleCheck.rev0 + 1, "visibilitychange(hidden) must flush genuine mutation and bump saveRev by 1");
      assert.equal(lifecycleCheck.stonesAfterVis, 654, "visibilitychange(hidden) must persist mutated stones=654");

      // Open Tab B, bump save -> Tab A enters unresolved conflict state (NOT read-only!)
      const tabB = await ctx.newPage();
      attachErrorListeners(tabB, "R2-7d-TabB");
      await tabB.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await tabB.waitForSelector("#btn-continue-save");
      await tabB.click("#btn-continue-save");
      await tabB.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");

      const validCodeForConflict = await tabB.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.stones = 999;
        api.saveGame();
        return api.exportFullCloudSaveCode();
      });
      await tabA.waitForSelector('#modal-backdrop.open [data-action="stay-readonly-save"]');

      // Dismiss conflict modal WITHOUT entering read-only (stay in saveConflictState !== null, saveReadOnlyMode === false)
      await tabA.evaluate(() => window.__CHENYUAN_V25__.closeModal());
      const conflictFlags = await tabA.evaluate(() => window.__CHENYUAN_V25__.getPersistenceState());
      assert.ok(conflictFlags.saveConflictState && !conflictFlags.saveReadOnlyMode, "Tab A must be in active non-readonly conflict state");

      // T4 UI cloud import while in conflict state MUST be rejected and NEVER show "成功"
      await tabA.click("#btn-open-settings");
      await tabA.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
      await tabA.click('[data-sys-tab="controls"]');
      await tabA.waitForSelector("#inp-cloud-save-code");
      await tabA.fill("#inp-cloud-save-code", validCodeForConflict);
      await tabA.click("#btn-import-cloud-save");
      await tabA.waitForSelector("#modal-backdrop.open #btn-confirm-cloud-import");
      await tabA.click("#btn-confirm-cloud-import");
      await tabA.waitForTimeout(100);
      const conflictCloudRes = await tabA.evaluate((sk) => {
        const errEl = document.getElementById("cloud-import-error-msg");
        return {
          errVisible: !!errEl && getComputedStyle(errEl).display !== "none",
          errText: errEl ? errEl.textContent : "",
          storedStones: JSON.parse(localStorage.getItem(sk) || "{}")?.game?.stones
        };
      }, STORAGE_KEY);
      assert.equal(conflictCloudRes.errVisible, true, "T4: UI cloud import in conflict state must show visible error");
      assert.ok(conflictCloudRes.errText.includes("导入失败") && !conflictCloudRes.errText.includes("成功"), `T4: conflict import error must be honest and never say 成功, got: ${conflictCloudRes.errText}`);
      assert.equal(conflictCloudRes.storedStones, 999, "T4: conflict import must not overwrite Tab B's save");
      await tabA.evaluate(() => window.__CHENYUAN_V25__.closeModal());

      // T6 conflict state (non-readonly) rejects reset & reincarnate
      await tabA.evaluate(() => {
        for (const act of ["confirm-reset-save", "execute-reset-save", "reincarnate-now"]) {
          const btn = document.createElement("button");
          btn.setAttribute("data-action", act);
          document.body.appendChild(btn);
          btn.click();
          btn.remove();
        }
      });
      const afterConflictDanger = await tabA.evaluate((sk) => ({
        storedStones: JSON.parse(localStorage.getItem(sk) || "{}")?.game?.stones,
        hasGame: !!window.__CHENYUAN_V25__.getState().game
      }), STORAGE_KEY);
      assert.equal(afterConflictDanger.storedStones, 999, "T6: conflict state must reject reset & reincarnate without deleting storage");
      assert.equal(afterConflictDanger.hasGame, true, "T6: conflict state must preserve active game");
      await ctx.close();
    }

    // ---- (d2b) G-T6a REAL idle animation-frame no-op flush (fresh start + Nascent Sanctum Hub paused expedition + live combat ticking expedition) ----
    {
      // Case 1: Fresh start + >=280ms real rAF frames -> hidden/pagehide MUST NOT bump saveRev or trigger false conflict in Tab B
      const ctxIdle1 = await newIsolatedContext(browser);
      const tabA = await ctxIdle1.newPage();
      attachErrorListeners(tabA, "R2-7d-IdleFreshA");
      await tabA.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await tabA.evaluate(() => localStorage.clear());
      await tabA.reload({ waitUntil: "domcontentloaded" });
      await tabA.click("#btn-start-new");
      await tabA.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await dismissOpeningScroll(tabA);

      const revFresh0 = await tabA.evaluate((sk) => JSON.parse(localStorage.getItem(sk)).saveRev, STORAGE_KEY);
      const tabB = await ctxIdle1.newPage();
      attachErrorListeners(tabB, "R2-7d-IdleFreshB");
      await tabB.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await tabB.waitForSelector("#btn-continue-save");
      await tabB.click("#btn-continue-save");
      await tabB.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");

      await tabA.waitForTimeout(300);
      await tabA.evaluate(() => {
        const origDesc = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
        window.dispatchEvent(new Event("pagehide"));
        if (origDesc) Object.defineProperty(document, "visibilityState", origDesc);
        else delete document.visibilityState;
      });
      await tabB.waitForTimeout(120);
      const idleFreshRes = await tabB.evaluate((sk) => ({
        revNow: JSON.parse(localStorage.getItem(sk)).saveRev,
        tabBConflict: window.__CHENYUAN_V25__.getPersistenceState().saveConflictState
      }), STORAGE_KEY);
      assert.equal(idleFreshRes.revNow, revFresh0, `G-T6a fresh idle rAF must NOT bump saveRev (${revFresh0} -> ${idleFreshRes.revNow})`);
      assert.equal(idleFreshRes.tabBConflict, null, "G-T6a fresh idle rAF must NOT trigger false conflict in Tab B");
      await ctxIdle1.close();

      // Case 2: Nascent player with active qinglan_vein expedition -> M4 G1 pauses in Sanctum Hub (tickTimer stays 8.5), while live combat ticks (< 8.5), and idle tab hide NEVER bumps saveRev
      const ctxIdle2 = await newIsolatedContext(browser);
      const tabS1 = await ctxIdle2.newPage();
      attachErrorListeners(tabS1, "R2-7d-IdleSanctumA");
      await tabS1.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await tabS1.evaluate(() => localStorage.clear());
      await tabS1.reload({ waitUntil: "domcontentloaded" });
      await tabS1.click("#btn-start-new");
      await tabS1.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await dismissOpeningScroll(tabS1);
      const revBeforeSanctumContinue = await tabS1.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const g = api.getState().game;
        g.realm = "nascent";
        g.openingChoice = "help";
        g.tutorialStep = 4;
        g.seenCutscenes.prologue = true;
        g.seenCutscenes.enter_sanctum = true;
        g.bondTiers = Object.assign({}, g.bondTiers, { shen: 1 });
        g.expeditions = { assignments: { qinglan_vein: "shen" }, bankedStones: 0, bankedStars: 0, supportThunderCount: 0, tickTimer: 8.5 };
        api.enterSanctumHub();
        return JSON.parse(localStorage.getItem(sk)).saveRev;
      }, STORAGE_KEY);
      // Reload Tab S1 cleanly and click #btn-continue-save (simulating real Sanctum resume)
      await tabS1.reload({ waitUntil: "domcontentloaded" });
      await tabS1.waitForSelector("#btn-continue-save");
      await tabS1.click("#btn-continue-save");
      await tabS1.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await tabS1.waitForTimeout(300);

      const tickCheck = await tabS1.evaluate((sk) => ({
        tickTimer: window.__CHENYUAN_V25__.getState().game.expeditions.tickTimer,
        sanctumMode: window.__CHENYUAN_V25__.getState().arena.sanctumMode,
        revAfterContinue: JSON.parse(localStorage.getItem(sk)).saveRev
      }), STORAGE_KEY);
      assert.equal(tickCheck.sanctumMode, true, "Resumed save should be in Sanctum Hub");
      assert.equal(tickCheck.tickTimer, 8.5, `M4 G1: expedition tickTimer must stay paused in Sanctum Hub (got: ${tickCheck.tickTimer})`);
      assert.equal(tickCheck.revAfterContinue, revBeforeSanctumContinue, "Continuing Sanctum Hub save must NOT bump saveRev");

      const tabS2 = await ctxIdle2.newPage();
      attachErrorListeners(tabS2, "R2-7d-IdleSanctumB");
      await tabS2.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await tabS2.waitForSelector("#btn-continue-save");
      await tabS2.click("#btn-continue-save");
      await tabS2.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await tabS2.waitForTimeout(300);

      // Simulate hiding both tabs after idle rAF ticks
      for (const pg of [tabS1, tabS2]) {
        await pg.evaluate(() => {
          const origDesc = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
          Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
          document.dispatchEvent(new Event("visibilitychange"));
          if (origDesc) Object.defineProperty(document, "visibilityState", origDesc);
          else delete document.visibilityState;
        });
      }
      await tabS1.waitForTimeout(120);
      const sanctumIdleRes = await tabS1.evaluate((sk) => ({
        revNow: JSON.parse(localStorage.getItem(sk)).saveRev,
        s1Conf: window.__CHENYUAN_V25__.getPersistenceState().saveConflictState
      }), STORAGE_KEY);
      const s2Conf = await tabS2.evaluate(() => window.__CHENYUAN_V25__.getPersistenceState().saveConflictState);
      assert.equal(sanctumIdleRes.revNow, revBeforeSanctumContinue, `G-T6a Sanctum active expedition idle rAF must NOT bump saveRev (${revBeforeSanctumContinue} -> ${sanctumIdleRes.revNow})`);
      assert.equal(sanctumIdleRes.s1Conf, null, "Tab S1 must NOT enter false conflict on idle tab switch");
      assert.equal(s2Conf, null, "Tab S2 must NOT enter false conflict on idle tab switch");

      // Genuine mutation (stones += 10) MUST flush on visibilitychange(hidden)
      await tabS1.evaluate(() => {
        window.__CHENYUAN_V25__.getState().game.stones += 10;
        const origDesc = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
        if (origDesc) Object.defineProperty(document, "visibilityState", origDesc);
        else delete document.visibilityState;
      });
      const revAfterRealMut = await tabS1.evaluate((sk) => JSON.parse(localStorage.getItem(sk)).saveRev, STORAGE_KEY);
      assert.equal(revAfterRealMut, revBeforeSanctumContinue + 1, "Genuine mutation in Sanctum Hub must still flush on visibilitychange(hidden)");

      // Sub-check 2b: In active non-Sanctum combat (Nascent + bonded shen + live enemy), expedition tickTimer MUST decrement (< 8.5), while idle tab hide still does NOT bump saveRev
      await tabS2.close();
      const revBeforeCombatTick = await tabS1.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.expeditions.tickTimer = 8.5;
        api.initArenaStage(0, false);
        s.arena.paused = false;
        if (!s.arena.enemies.some(e => e.hp > 0 && !e.isDummy && !e.isTreasure)) {
          api.spawnSingleEnemy("wolf", 920, 460, 1.0, false);
        }
        api.saveGame();
        return JSON.parse(localStorage.getItem(sk)).saveRev;
      }, STORAGE_KEY);
      await tabS1.waitForTimeout(320);
      const combatTickRes = await tabS1.evaluate((sk) => {
        const origDesc = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        document.dispatchEvent(new Event("visibilitychange"));
        if (origDesc) Object.defineProperty(document, "visibilityState", origDesc);
        else delete document.visibilityState;
        return {
          tickTimer: window.__CHENYUAN_V25__.getState().game.expeditions.tickTimer,
          revNow: JSON.parse(localStorage.getItem(sk)).saveRev
        };
      }, STORAGE_KEY);
      assert.ok(combatTickRes.tickTimer < 8.5, `M4 G1: expedition tickTimer must decrement during live combat rAF (got: ${combatTickRes.tickTimer})`);
      assert.equal(combatTickRes.revNow, revBeforeCombatTick, "G-T6a: expedition tickTimer-only decrement in live combat must NOT bump saveRev on idle tab hide");
      await ctxIdle2.close();
    }

    // ---- (d3) G-T1a reincarnate-now under metaReadError & meta quota failure + G-T3a modal opened inside #jade-panel focus return ----
    {
      const { ctx, page } = await startCleanGamePage(browser, "R2-7d-GT1a-GT3a", true);

      // G-T3a: open AffixEngrave modal from button inside #jade-panel -> Escape -> focus returns to exact trigger button inside #jade-panel
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const g = api.getState().game;
        g.realm = "foundation";
        g.stones = 333;
        api.saveGame();
      });
      await page.click("#nav-btn-cultivate");
      await page.waitForSelector('#jade-panel.drawer-open [data-reforge-slot="weapon"]');
      await page.click('#jade-panel [data-reforge-slot="weapon"]');
      await page.waitForSelector("#modal-backdrop.open");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));
      const gt3aFocus = await page.evaluate(() => {
        const panel = document.getElementById("jade-panel");
        const ae = document.activeElement;
        return {
          drawerStillOpen: !!panel && panel.classList.contains("drawer-open"),
          insidePanel: !!panel && panel.contains(ae),
          triggerAttr: ae ? ae.getAttribute("data-reforge-slot") : null
        };
      });
      assert.equal(gt3aFocus.drawerStillOpen, true, "G-T3a: drawer must stay open after closing nested modal");
      assert.equal(gt3aFocus.insidePanel, true, "G-T3a: focus must stay inside #jade-panel");
      assert.equal(gt3aFocus.triggerAttr, "weapon", `G-T3a: focus must return to exact trigger [data-reforge-slot="weapon"], got: ${gt3aFocus.triggerAttr}`);

      // Real [data-engrave-slot="weapon"] confirm re-renders drawer + closes modal: focus MUST stay inside #jade-panel (never BODY)
      await page.click('#jade-panel [data-reforge-slot="weapon"]');
      await page.waitForSelector('#modal-backdrop.open [data-engrave-slot="weapon"]:not([disabled])');
      await page.click('#modal-backdrop.open [data-engrave-slot="weapon"]:not([disabled])');
      await page.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));
      const afterEngraveFocus = await page.evaluate(() => {
        const panel = document.getElementById("jade-panel");
        const ae = document.activeElement;
        return {
          drawerOpen: !!panel && panel.classList.contains("drawer-open"),
          insidePanel: !!panel && panel.contains(ae),
          activeTag: ae ? ae.tagName : "",
          reforgeSlot: ae ? ae.getAttribute("data-reforge-slot") : null
        };
      });
      assert.equal(afterEngraveFocus.drawerOpen, true, "Drawer must stay open after affix engrave");
      assert.equal(afterEngraveFocus.insidePanel, true, `Focus must stay inside #jade-panel after affix engrave re-render, got activeTag=${afterEngraveFocus.activeTag}`);
      assert.notEqual(afterEngraveFocus.activeTag, "BODY", "Focus must never drop to BODY after affix engrave");
      assert.equal(afterEngraveFocus.reforgeSlot, "weapon", `Focus should land on refreshed [data-reforge-slot="weapon"], got: ${afterEngraveFocus.reforgeSlot}`);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.getElementById("jade-panel").classList.contains("drawer-open"));
      // Restore stones to 333 after engrave spent 35
      await page.evaluate(() => { window.__CHENYUAN_V25__.getState().game.stones = 333; window.__CHENYUAN_V25__.saveGame(); });

      // G-T1a Case 1: reincarnate-now under metaReadError aborts & preserves primary save
      await page.evaluate((mk) => {
        window.dispatchEvent(new StorageEvent("storage", { key: mk, newValue: "{CORRUPT_META_GT1A" }));
        const btn = document.createElement("button");
        btn.setAttribute("data-action", "reincarnate-now");
        document.body.appendChild(btn);
        btn.click();
        btn.remove();
      }, META_KEY);
      const gt1aCase1 = await page.evaluate((sk) => ({
        storedStones: JSON.parse(localStorage.getItem(sk) || "{}")?.game?.stones,
        hasGame: !!window.__CHENYUAN_V25__.getState().game,
        hasMetaReadErr: !!window.__CHENYUAN_V25__.getPersistenceState().metaReadError
      }), STORAGE_KEY);
      assert.equal(gt1aCase1.storedStones, 333, "G-T1a: reincarnate-now under metaReadError must NOT delete primary save");
      assert.equal(gt1aCase1.hasGame, true, "G-T1a: reincarnate-now under metaReadError must NOT null game");
      assert.equal(gt1aCase1.hasMetaReadErr, true);

      // Clear metaReadError cleanly via UI reset so we can test G-T1a Case 2 (meta write quota failure)
      await page.click('#hud-save-alert [data-action="prompt-reset-corrupt-meta"]');
      await page.waitForSelector('#modal-backdrop.open [data-action="confirm-reset-corrupt-meta"]');
      await page.click('[data-action="confirm-reset-corrupt-meta"]');
      await page.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));

      // G-T1a Case 2: reincarnate-now under meta write quota failure aborts, rolls back metaState & lifeRecorded, and preserves primary save
      const gt1aCase2 = await page.evaluate(({ sk, mk }) => {
        const api = window.__CHENYUAN_V25__;
        const g = api.getState().game;
        g.status = "ascended";
        g.ending = "sword_saint";
        g.lifeRecorded = false;
        const hallLenBefore = api.getMetaState().hallOfLives.length;
        const orig = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === mk) {
            const err = new Error("Meta Quota Full on Reincarnate");
            err.name = "QuotaExceededError";
            throw err;
          }
          return orig.call(this, k, v);
        };
        const btn = document.createElement("button");
        btn.setAttribute("data-action", "reincarnate-now");
        document.body.appendChild(btn);
        btn.click();
        btn.remove();
        Storage.prototype.setItem = orig;
        const alertEl = document.getElementById("hud-save-alert");
        return {
          storedStones: JSON.parse(localStorage.getItem(sk) || "{}")?.game?.stones,
          hasGame: !!api.getState().game,
          lifeRecorded: api.getState().game?.lifeRecorded,
          hallLenAfter: api.getMetaState().hallOfLives.length,
          hallLenBefore,
          alertVisible: !!alertEl && getComputedStyle(alertEl).display !== "none",
          alertText: alertEl ? alertEl.textContent : ""
        };
      }, { sk: STORAGE_KEY, mk: META_KEY });
      assert.equal(gt1aCase2.storedStones, 333, "G-T1a: reincarnate-now under meta quota failure must preserve primary save");
      assert.equal(gt1aCase2.hasGame, true, "G-T1a: reincarnate-now under meta quota failure must keep active game");
      assert.equal(gt1aCase2.lifeRecorded, false, "G-T1a: failed reincarnate must roll back game.lifeRecorded");
      assert.equal(gt1aCase2.hallLenAfter, gt1aCase2.hallLenBefore, "G-T1a: failed reincarnate must roll back metaState.hallOfLives");
      assert.ok(gt1aCase2.alertVisible && gt1aCase2.alertText.includes("元存档写入失败"), `G-T1a/b: failed reincarnate must show visible meta write alert, got: ${gt1aCase2.alertText}`);

      // AGENTS.md & T6: active storageReadError MUST block confirm-reset-save, execute-reset-save, and reincarnate-now and preserve corrupted STORAGE_KEY verbatim
      const corruptPrimaryRaw = "{CORRUPT_PRIMARY_SAVE_MUST_BE_PRESERVED_R27";
      const corruptGuardRes = await page.evaluate(({ sk, raw }) => {
        localStorage.setItem(sk, raw);
        window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: raw }));
        const hadReadErr = !!window.__CHENYUAN_V25__.getPersistenceState().storageReadError;
        for (const act of ["confirm-reset-save", "execute-reset-save", "reincarnate-now"]) {
          const btn = document.createElement("button");
          btn.setAttribute("data-action", act);
          document.body.appendChild(btn);
          btn.click();
          btn.remove();
        }
        return {
          hadReadErr,
          rawAfter: localStorage.getItem(sk),
          hasGameAfter: !!window.__CHENYUAN_V25__.getState().game
        };
      }, { sk: STORAGE_KEY, raw: corruptPrimaryRaw });
      assert.equal(corruptGuardRes.hadReadErr, true, "Corrupt primary storage event must activate storageReadError");
      assert.equal(corruptGuardRes.rawAfter, corruptPrimaryRaw, "reincarnate-now and execute-reset-save must preserve corrupted primary save verbatim");
      assert.equal(corruptGuardRes.hasGameAfter, true, "Blocked reset/reincarnate under storageReadError must keep active game");
      await ctx.close();
    }

    // ---- (e) N1–N5: {"toString":1,"valueOf":2} primitive conversion, float counters, v2 empty checksum, own __proto__ strip & quota overwrite toast ----
    {
      const ctx = await newIsolatedContext(browser);
      const page = await ctx.newPage();
      attachErrorListeners(page, "R2-7e-N1-N5");
      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

      // N1-meta + N1-realm: poisoned hallOfLives[0].name in META_KEY + poisoned realm in STORAGE_KEY must boot cleanly and show corrupt banner
      await page.evaluate(({ sk, mk }) => {
        localStorage.clear();
        localStorage.setItem(mk, '{"metaRev":1,"hallOfLives":[{"lifeNum":1,"name":{"toString":1,"valueOf":2}}]}');
        localStorage.setItem(sk, '{"game":{"realm":{"toString":1,"valueOf":2}}}');
      }, { sk: STORAGE_KEY, mk: META_KEY });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#save-status-banner", { state: "visible" });
      await page.waitForSelector("#welcome-perk-grid .perk-card", { state: "attached" });
      const n1BootRealm = await page.evaluate(() => ({
        v25: !!window.__CHENYUAN_V25__,
        perkCount: document.querySelectorAll("#welcome-perk-grid .perk-card").length,
        bannerVisible: getComputedStyle(document.getElementById("save-status-banner")).display === "flex",
        continueHidden: getComputedStyle(document.getElementById("btn-continue-save")).display === "none",
        hallName: window.__CHENYUAN_V25__?.getMetaState?.().hallOfLives?.[0]?.name || ""
      }));
      assert.equal(n1BootRealm.v25, true, "N1: META_KEY poisoned hallOfLives name must not kill page boot");
      assert.ok(n1BootRealm.perkCount > 0, "N1: welcome screen perk grid must render cleanly");
      assert.equal(n1BootRealm.bannerVisible, true, "N1: poisoned STORAGE_KEY realm must show corrupt-save banner");
      assert.equal(n1BootRealm.continueHidden, true, "N1: poisoned STORAGE_KEY realm must hide continue button");
      assert.equal(n1BootRealm.hallName, "顾长青", "N1: poisoned hallOfLives name must fall back to default");

      // N1-checksum + N1-envelopeVersion + N4 empty checksum on envelope v2 must ALL be rejected as corrupt
      const badEnvelopes = [
        { label: "poisoned-checksum", raw: '{"envelopeVersion":2,"checksum":{"toString":1,"valueOf":2},"game":{"realm":"mortal"}}' },
        { label: "poisoned-envVer", raw: '{"envelopeVersion":{"toString":1,"valueOf":2},"game":{"realm":"mortal"}}' },
        { label: "empty-checksum-v2", raw: JSON.stringify({ envelopeVersion: 2, saveRev: 5, tabId: "tab_tamper", updatedAt: Date.now(), checksum: "", game: { realm: "mortal", name: "篡改测试", stones: 999999 }, stageIdx: 0, stanceIdx: 0, towerMode: false, sanctumMode: false }) }
      ];
      for (const item of badEnvelopes) {
        await page.evaluate(({ sk, raw }) => { localStorage.setItem(sk, raw); }, { sk: STORAGE_KEY, raw: item.raw });
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.waitForSelector("#save-status-banner", { state: "visible" });
        await page.waitForSelector("#welcome-perk-grid .perk-card", { state: "attached" });
        const chk = await page.evaluate(() => ({
          bannerVisible: getComputedStyle(document.getElementById("save-status-banner")).display === "flex",
          continueHidden: getComputedStyle(document.getElementById("btn-continue-save")).display === "none"
        }));
        assert.equal(chk.bannerVisible, true, `N1/N4 (${item.label}): corrupt banner must be visible`);
        assert.equal(chk.continueHidden, true, `N1/N4 (${item.label}): continue button must be hidden`);
      }

      // Polish: confirm-overwrite-corrupt-new under QuotaExceededError must preserve corrupt raw & omit false overwrite-success toast
      const corruptRawBeforeOverwrite = badEnvelopes[2].raw;
      await page.click('[data-action="prompt-overwrite-corrupt"]');
      await page.waitForSelector('#modal-backdrop.open [data-action="confirm-overwrite-corrupt-new"]');
      await page.evaluate((sk) => {
        window.__origSetCorrupt = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === sk) {
            const err = new Error("Quota full on corrupt overwrite");
            err.name = "QuotaExceededError";
            throw err;
          }
          return window.__origSetCorrupt.call(this, k, v);
        };
      }, STORAGE_KEY);
      await page.click('[data-action="confirm-overwrite-corrupt-new"]');
      await page.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      const corruptOverwriteCheck = await page.evaluate((sk) => {
        Storage.prototype.setItem = window.__origSetCorrupt;
        return {
          rawAfter: localStorage.getItem(sk),
          toastTxt: document.getElementById("toast-container")?.textContent || "",
          hasWriteErr: !!window.__CHENYUAN_V25__.getPersistenceState().storageWriteError
        };
      }, STORAGE_KEY);
      assert.equal(corruptOverwriteCheck.rawAfter, corruptRawBeforeOverwrite, "Failed corrupt overwrite must preserve original raw payload");
      assert.equal(corruptOverwriteCheck.hasWriteErr, true, "Failed corrupt overwrite must set storageWriteError");
      assert.equal(corruptOverwriteCheck.toastTxt.includes("已确认覆盖旧损坏存档"), false, `Failed corrupt overwrite must not emit false success toast, got: ${corruptOverwriteCheck.toastTxt}`);
      await ctx.close();

      // N1-continue + N2 (bonusSwords: 1.5, stones: 42.7) + N3 (karmaEventsDone: 1.5) + N5 (own __proto__ in customComboSeq/primordialCrafts/pity)
      // Use a fresh context still on welcome screen (game === null) so pagehide cannot flush a v11 save over LEGACY_V10_KEY on reload.
      const ctxN235 = await newIsolatedContext(browser);
      const pageN235 = await ctxN235.newPage();
      attachErrorListeners(pageN235, "R2-7-N1-N5");
      await pageN235.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await pageN235.evaluate((sk) => {
        localStorage.clear();
        const rawLegacy = '{"game":{"realm":"qi","name":{"toString":1,"valueOf":2},"stones":42.7,"bonusSwords":1.5,"karmaEventsDone":1.5,"equippedGear":{"weapon":{"slot":"weapon","name":{"toString":1,"valueOf":2},"atk":10}},"customComboSeq":{"__proto__":{"polluted":1},"enabled":true,"slots":["sword_crescent","spear_flurry","chakram_vortex","greatsword_cleave"],"morphCount":0},"primordialCrafts":{"__proto__":{"polluted":1},"goldenAcolyte":false,"voidSwordRift":false,"pillBatches":0,"forgedBlades":0},"pity":{"__proto__":{"polluted":1},"epic":0,"mythic":0,"critAcc":0,"vampHits":0,"thunderHits":0,"gearDrops":0}},"stageIdx":0,"stanceIdx":0,"towerMode":false,"sanctumMode":false}';
        localStorage.setItem(sk, rawLegacy);
      }, LEGACY_V10_KEY);
      await pageN235.reload({ waitUntil: "domcontentloaded" });
      await pageN235.waitForSelector("#btn-continue-save");
      await pageN235.click("#btn-continue-save");
      await pageN235.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      const n235State = await pageN235.evaluate(() => {
        const g = window.__CHENYUAN_V25__.getState().game;
        return {
          hudName: (document.getElementById("hud-name")?.textContent || "").trim(),
          hudAge: (document.getElementById("hud-age-school")?.textContent || "").trim(),
          hudStones: (document.getElementById("hud-stones")?.textContent || "").trim(),
          weaponName: g.equippedGear?.weapon?.name || "",
          bonusSwords: g.bonusSwords,
          karmaEventsDone: g.karmaEventsDone,
          seqOwnProto: Object.prototype.hasOwnProperty.call(g.customComboSeq, "__proto__"),
          pcOwnProto: Object.prototype.hasOwnProperty.call(g.primordialCrafts, "__proto__"),
          pityOwnProto: Object.prototype.hasOwnProperty.call(g.pity, "__proto__")
        };
      });
      assert.equal(n235State.hudName, "顾长青", `N1: poisoned legacy game.name must fall back to 顾长青, got: ${n235State.hudName}`);
      assert.equal(n235State.weaponName, "灵器", `N1: poisoned gear.name must fall back to 灵器, got: ${n235State.weaponName}`);
      assert.ok(n235State.hudAge.includes("飞剑×"), `N2: HUD must update after continue with bonusSwords:1.5, got: ${n235State.hudAge}`);
      assert.equal(n235State.hudStones, "42", `N2: float stones:42.7 must floor to 42, got: ${n235State.hudStones}`);
      assert.equal(n235State.bonusSwords, 1, `N2: bonusSwords:1.5 must floor to 1, got: ${n235State.bonusSwords}`);
      assert.equal(n235State.karmaEventsDone, 1, `N3: karmaEventsDone:1.5 must floor to 1, got: ${n235State.karmaEventsDone}`);
      assert.equal(n235State.seqOwnProto, false, "N5: customComboSeq must not retain own __proto__ key");
      assert.equal(n235State.pcOwnProto, false, "N5: primordialCrafts must not retain own __proto__ key");
      assert.equal(n235State.pityOwnProto, false, "N5: pity must not retain own __proto__ key");

      // N3 UI check: open Karma Dilemma modal cleanly even if karmaEventsDone is mutated to 1.5 in memory
      await pageN235.evaluate(() => { window.__CHENYUAN_V25__.getState().game.karmaEventsDone = 1.5; });
      await pageN235.click("#nav-btn-story");
      await pageN235.waitForSelector('#jade-panel.drawer-open [data-action="open-karma-dilemma"]');
      await pageN235.click('#jade-panel [data-action="open-karma-dilemma"]');
      await pageN235.waitForSelector("#modal-backdrop.open [data-karma-dilemma]");
      await pageN235.keyboard.press("Escape");
      await pageN235.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));

      // N1-cross-tab: valid v2 envelope with poisoned game.name={"toString":1,"valueOf":2} must open conflict modal cleanly
      const crossTabRes = await pageN235.evaluate((sk) => {
        const payloadObj = {
          game: { realm: "mortal", name: { toString: 1, valueOf: 2 }, stones: 99 },
          stageIdx: 0, stanceIdx: 0, towerMode: false, sanctumMode: false
        };
        const canon = JSON.stringify(payloadObj);
        let h = 2166136261 >>> 0;
        for (let i = 0; i < canon.length; i++) { h ^= canon.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
        const checksum = h.toString(16).toUpperCase().padStart(8, "0");
        const env = Object.assign({ envelopeVersion: 2, saveRev: 50, tabId: "other_tab_n1", updatedAt: Date.now(), checksum }, payloadObj);
        window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: JSON.stringify(env) }));
        return {
          modalOpen: document.getElementById("modal-backdrop")?.classList.contains("open") || false,
          modalTxt: document.getElementById("modal-content")?.textContent || ""
        };
      }, STORAGE_KEY);
      assert.equal(crossTabRes.modalOpen, true, "N1: cross-tab conflict with poisoned game.name must open conflict modal cleanly");
      assert.ok(crossTabRes.modalTxt.includes("顾长青"), "N1: conflict modal must fall back poisoned externalName to 顾长青");
      await ctxN235.close();
    }
  });

  // =========================================================================
  // MILESTONE 3 REGRESSION SUITES (R3-1 .. R3-3): S1, S2, S5, S6, G3
  // =========================================================================
  await runSuite("R3-1", "M3 S1 境界突破妖王门控(6重边界+前往挑战指引)与旧档零回退5场景迁移", async () => {
    // 1. Fresh start: verify all 6 REALM_BOSS_GATE boundaries block until stage boss defeated, and #btn-trib-goto-boss navigates cleanly
    const { ctx, page } = await startCleanGamePage(browser, "R3-1", true);
    const gateMatrix = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const realms = ["mortal", "qi", "foundation", "golden", "nascent", "spirit"];
      const out = [];
      for (const r of realms) {
        s.game.realm = r;
        s.game.defeatedStageBosses = {};
        s.game.stageStars = {};
        const lockedGate = api.getBreakthroughBossGate(s.game);
        s.game.xp = api.getState().realmSpec.xpCap;
        api.openTribulationPrepModal();
        const modalTxt = document.getElementById("modal-content")?.textContent || "";
        const hasGotoBtn = Boolean(document.getElementById("btn-trib-goto-boss"));
        const hasPillBtn = Boolean(document.querySelector('[data-trib-start="pill"]'));
        api.closeModal();
        s.game.defeatedStageBosses[lockedGate.stageIdx] = true;
        const unlockedGate = api.getBreakthroughBossGate(s.game);
        out.push({
          realm: r,
          reqStage: lockedGate.stageIdx,
          locked: lockedGate.locked,
          unlocked: !unlockedGate.locked,
          hasGotoBtn,
          hasPillBtn,
          mentionsNeedBoss: modalTxt.includes("需先击败")
        });
      }
      return out;
    });
    for (const row of gateMatrix) {
      assert.equal(row.locked, true, `REALM_BOSS_GATE must lock ${row.realm} before stage ${row.reqStage} boss`);
      assert.equal(row.unlocked, true, `REALM_BOSS_GATE must unlock ${row.realm} once stage ${row.reqStage} boss defeated`);
      assert.equal(row.hasGotoBtn, true, `${row.realm} gate modal must expose #btn-trib-goto-boss`);
      assert.equal(row.hasPillBtn, false, `${row.realm} gate modal must block tribulation start`);
      assert.equal(row.mentionsNeedBoss, true, `${row.realm} gate modal must display 需先击败【X】`);
    }

    // Verify clicking #btn-trib-goto-boss actually enters the target stage cleanly
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "qi";
      s.game.xp = api.getState().realmSpec.xpCap;
      s.game.defeatedStageBosses = { 0: true };
      s.game.stageStars = { 0: 1 };
      s.game.seenCutscenes.enter_sect = true;
      api.openTribulationPrepModal();
    });
    await page.waitForSelector("#modal-backdrop.open #btn-trib-goto-boss");
    await page.click("#btn-trib-goto-boss");
    await page.waitForTimeout(200);
    await dismissActiveCutscene(page);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.stageIdx), 1, "#btn-trib-goto-boss for qi must navigate to Stage 1");
    await ctx.close();

    // 2. Legacy eb0ea67 high-realm save migration + reload + quota fail + multi-tab conflict (5-scenario matrix)
    const ctxMig = await newIsolatedContext(browser);
    const tabA = await ctxMig.newPage();
    attachErrorListeners(tabA, "R3-1-MigA");
    await tabA.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabA.evaluate((sk) => {
      localStorage.clear();
      // Legacy save at golden realm with stageStars but no defeatedStageBosses field
      localStorage.setItem(sk, JSON.stringify({
        game: { name: "旧档金丹", realm: "golden", xp: 100, stones: 400, stageStars: { 0: 3, 1: 2, 2: 1 } },
        stageIdx: 2, stanceIdx: 0, towerMode: false, sanctumMode: true
      }));
    }, STORAGE_KEY);
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.waitForSelector("#btn-continue-save");
    await tabA.click("#btn-continue-save");
    await tabA.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    const migState = await tabA.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      return {
        realm: g.realm,
        boss0: api.isStageBossDefeated(g, 0),
        boss1: api.isStageBossDefeated(g, 1),
        boss2: api.isStageBossDefeated(g, 2)
      };
    });
    assert.equal(migState.realm, "golden", "Legacy high-realm save must not regress realm");
    assert.equal(migState.boss0 && migState.boss1 && migState.boss2, true, "Legacy stageStars must preserve defeatedStageBosses with zero regression");

    // Reload persistence
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.waitForSelector("#btn-continue-save");
    await tabA.click("#btn-continue-save");
    await tabA.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    assert.equal(await tabA.evaluate(() => window.__CHENYUAN_V25__.getState().game.realm), "golden");

    // QuotaExceededError check
    const quotaFail = await tabA.evaluate(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { throw new DOMException("Quota full", "QuotaExceededError"); };
      const ok = window.__CHENYUAN_V25__.saveGame();
      Storage.prototype.setItem = orig;
      return { ok, alertVisible: getComputedStyle(document.getElementById("hud-save-alert")).display !== "none" };
    });
    assert.equal(quotaFail.ok, false);
    assert.equal(quotaFail.alertVisible, true);
    await tabA.click('#hud-save-alert [data-action="retry-save-now"]');
    await tabA.waitForTimeout(120);

    // Multi-tab contention check
    const tabB = await ctxMig.newPage();
    attachErrorListeners(tabB, "R3-1-MigB");
    await tabB.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabB.waitForSelector("#btn-continue-save");
    await tabB.click("#btn-continue-save");
    await tabB.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await tabB.evaluate(() => {
      window.__CHENYUAN_V25__.getState().game.stones = 888;
      window.__CHENYUAN_V25__.saveGame();
    });
    await tabA.waitForSelector('#modal-backdrop.open [data-action="load-latest-save"]');
    await tabA.click('[data-action="load-latest-save"]');
    await tabA.waitForTimeout(160);
    assert.equal(await tabA.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones), 888);
    await ctxMig.close();
  });

  await runSuite("R3-2", "M3 S2 如实飞升终章与诚实评分 + S5 全通后终局目标指引", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R3-2", true);
    const evalRes = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const g = s.game;
      // 0-star ascended character with no bonded companions
      g.realm = "ascended";
      g.status = "ascended";
      g.openingChoice = "loot";
      g.stageStars = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      g.defeatedStageBosses = {};
      g.bondTiers = {};
      g.aids = {};
      g.choices = {};
      g.karmaScore = 0;
      g.towerBest = 0;
      g.bestSpireFloor = 0;
      g.achievements = [];
      const zeroScore = api.computeCompetitionScore(g);
      const zeroGrade = api.getScoreGrade(zeroScore, g);
      const zeroEpi = api.getKarmaEndingEpilogue(g, "sword_sovereign");

      // Fully cleared & bonded character satisfying ALL 18 CHAPTERS step checks
      g.openingChoice = "help";
      g.pet = { id: "fox", level: 3, skills: { tier3: null, tier5: null } };
      g.immortalPills = 2;
      g.choices = { lu_intro: "listen", pei_spar: "a", shen_past: "a", yan_gate: "a" };
      g.ownedRelics = ["frost_sword"];
      g.loadout = Object.assign({}, g.loadout, { relic: "frost_sword" });
      g.laws = ["wanjian", "yinyang", "pill_fire", "void_haste"];
      g.stageStars = { 0: 3, 1: 3, 2: 3, 3: 3, 4: 3 };
      g.defeatedStageBosses = { 0: true, 1: true, 2: true, 3: true, 4: true };
      g.bondTiers = { shen: 2, lu: 2 };
      g.aids = { shen: true, lu: true };
      g.trialCompleted = true;
      const fullEpi = api.getKarmaEndingEpilogue(g, "mortal_guardian");

      // S5: mark all mainline steps claimed -> findNextMainlineStep returns { allDone: true, step: null } & tracker shows endgame goal, never stale s7_trial
      g.claimedStepIds = api.CHAPTERS.flatMap(ch => ch.steps.map(st => st.id));
      const nextStep = api.findNextMainlineStep(g);
      api.updateHud();
      const trackerText = (document.getElementById("qt-body-rows")?.innerText || document.getElementById("quest-tracker-hud")?.textContent || "").trim();
      return {
        zeroScore,
        zeroGrade: zeroGrade && (zeroGrade.grade || zeroGrade.short || String(zeroGrade)),
        zeroEpiStr: JSON.stringify(zeroEpi),
        fullEpiStr: JSON.stringify(fullEpi),
        nextStep: nextStep ? { allDone: Boolean(nextStep.allDone), step: nextStep.step, claimReady: Boolean(nextStep.claimReady) } : null,
        trackerText
      };
    });
    assert.ok(!String(evalRes.zeroGrade).startsWith("SS") && !String(evalRes.zeroGrade).startsWith("S+"),
      `0-star ascended character must NOT receive SS/S+ grade, got ${evalRes.zeroGrade} (score=${evalRes.zeroScore})`);
    assert.notEqual(evalRes.zeroEpiStr, evalRes.fullEpiStr, "Truthful epilogue must differentiate 0-star unbonded vs cleared & bonded run");
    assert.ok(evalRes.fullEpiStr.includes("沈清禾") || evalRes.fullEpiStr.includes("陆玄松"), "Cleared epilogue must mention actual bonded companions (沈清禾/陆玄松)");
    assert.equal(evalRes.nextStep?.allDone, true, `When all mainline steps are completed and claimed, findNextMainlineStep must return allDone=true, got: ${JSON.stringify(evalRes.nextStep)}`);
    assert.equal(evalRes.nextStep?.step, null, `When all mainline steps are completed and claimed, findNextMainlineStep.step must be null, got: ${JSON.stringify(evalRes.nextStep)}`);
    assert.match(evalRes.trackerText, /仙途圆满|劫火周目|锁妖塔/, `All-complete tracker must show endgame goal text, got: "${evalRes.trackerText}"`);
    assert.ok(!evalRes.trackerText.includes("s7_trial") && !evalRes.trackerText.includes("剑斩道影"), `All-complete tracker must not show stale s7_trial, got: "${evalRes.trackerText}"`);
    await ctx.close();
  });

  await runSuite("R3-3", "M3 S6 红尘问心不误满槽 + G3 单击45%上限、Boss压力带与三模式境界缩放", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R3-3", true);
    const res = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      // 1. S6 Karma choice without fillIntent must not fill bondSynergy, astralEnergy, or swordIntent to 100
      s.arena.bondSynergy = 12;
      s.arena.astralEnergy = 15;
      s.arena.swordIntent = 10;
      const kd = api.KARMA_DILEMMAS.find(d => d && d.rightOpt && !d.rightOpt.fillIntent) || api.KARMA_DILEMMAS[0];
      api.resolveKarmaDilemmaChoice(kd.id, "right");
      const bondAfter = s.arena.bondSynergy;
      const astralAfter = s.arena.astralEnergy;
      const intentAfter = s.arena.swordIntent;

      // 2. G3 Single-hit cap <= 45% maxHp
      s.game.realm = "foundation";
      const st = api.getCombatStats(s.game);
      s.game.hp = st.maxHp;
      s.arena.player.invuln = 0;
      s.arena.player.shieldHp = 0;
      api.hurtPlayer(999999);
      const cappedDmg = st.maxHp - s.game.hp;
      const capLimit = Math.ceil(st.maxHp * api.SINGLE_HIT_CAP_RATIO) + 1;

      // 3. Monotonic realm baseline & Boss Rush / Spire scaling across realms
      const baseQi = api.getRealmCombatBaseline("qi");
      const baseGold = api.getRealmCombatBaseline("golden");
      const baseSpirit = api.getRealmCombatBaseline("spirit");

      s.game.realm = "nascent";
      s.arena.bossRush = {
        active: true, bout: 1, maxBouts: 7, elapsed: 0,
        partBreaks: 0, parries: 0, hitsTaken: 0, damageTaken: 0,
        startBout: 1, practiceMode: false
      };
      s.arena.enemies = [];
      api.spawnBossRushBout();
      const rushNascentHp = s.arena.enemies[0]?.maxHp || 0;

      s.game.realm = "spirit";
      s.arena.bossRush = {
        active: true, bout: 1, maxBouts: 7, elapsed: 0,
        partBreaks: 0, parries: 0, hitsTaken: 0, damageTaken: 0,
        startBout: 1, practiceMode: false
      };
      s.arena.enemies = [];
      api.spawnBossRushBout();
      const rushSpiritHp = s.arena.enemies[0]?.maxHp || 0;

      return { bondAfter, astralAfter, intentAfter, cappedDmg, capLimit, baseQi, baseGold, baseSpirit, rushNascentHp, rushSpiritHp };
    });
    assert.ok(res.bondAfter < 100, `Karma choice without fillIntent must NOT fill bondSynergy to 100, got ${res.bondAfter}`);
    assert.ok(res.astralAfter < 100, `Karma choice without fillIntent must NOT fill astralEnergy to 100, got ${res.astralAfter}`);
    assert.ok(res.intentAfter < 100, `Karma choice without fillIntent must NOT fill swordIntent to 100, got ${res.intentAfter}`);
    assert.ok(res.cappedDmg <= res.capLimit, `Single-hit damage (${res.cappedDmg}) exceeded 45% cap (${res.capLimit})`);
    assert.ok(res.baseQi.atk < res.baseGold.atk && res.baseGold.atk < res.baseSpirit.atk, "Realm combat baseline ATK must scale monotonically");
    assert.ok(res.rushSpiritHp >= res.rushNascentHp && res.rushNascentHp > 0, `Boss Rush HP must scale monotonically with realm (${res.rushNascentHp} -> ${res.rushSpiritHp})`);
    await ctx.close();
  });

  // =========================================================================
  // MILESTONE 4 REGRESSION SUITES (R4-1 .. R4-4): G1, G2, G4, G5, G6, G9, G11a
  // =========================================================================
  await runSuite("R4-1", "M4 G1 九州远征经济闭环(空库禁刷/600上限/洞府停表/实战走表/羁绊校验)与5场景存档", async () => {
    // Scenario 1: Fresh start expedition mechanics
    const { ctx, page } = await startCleanGamePage(browser, "R4-1", true);
    const econCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const g = s.game;
      g.realm = "nascent";
      g.bondTiers = { shen: 1 };
      g.aids = {};
      g.choices = {};
      g.expeditions = { assignments: {}, bankedStones: 0, bankedStars: 0, supportThunderCount: 0, tickTimer: 8.5 };

      // Unbonded hero rejected
      const unbonded = api.assignExpeditionNode(g, "qinglan_vein", "yan");
      // Bonded hero accepted
      const bonded = api.assignExpeditionNode(g, "qinglan_vein", "shen");
      // Duplicate hero assignment on valid second node rejected
      const dup = api.assignExpeditionNode(g, "qingyun_peak", "shen");

      // Empty bank double-claim yields 0 stones & 0 stars
      const stonesBefore = g.stones;
      const claimEmpty1 = api.claimExpeditionRewards();
      const claimEmpty2 = api.claimExpeditionRewards();

      // Bank cap enforcement: even if inflated above cap, claim caps at 600 stones / 5 stars
      g.expeditions.bankedStones = 9999;
      g.expeditions.bankedStars = 99;
      const claimCapped = api.claimExpeditionRewards();
      const claimAfterCapped = api.claimExpeditionRewards();
      return {
        unbondedOk: unbonded.ok,
        unbondedReason: unbonded.reason,
        bondedOk: bonded.ok,
        dupOk: dup.ok,
        dupReason: dup.reason,
        claimEmpty1,
        claimEmpty2,
        stonesDeltaEmpty: (g.stones - (claimCapped?.gainedStones || 0)) - stonesBefore,
        claimCapped,
        claimAfterCapped,
        stonesCap: api.EXPEDITION_BANKED_STONES_CAP,
        starsCap: api.EXPEDITION_BANKED_STARS_CAP
      };
    });
    assert.equal(econCheck.unbondedOk, false, "Unbonded hero must be rejected for expedition garrison");
    assert.equal(econCheck.unbondedReason, "unbonded", `Unbonded hero rejection reason must be "unbonded", got "${econCheck.unbondedReason}"`);
    assert.equal(econCheck.bondedOk, true, "Bonded hero shen must be assignable");
    assert.equal(econCheck.dupOk, false, "Duplicate hero assignment across nodes must be rejected");
    assert.equal(econCheck.dupReason, "already_assigned", `Duplicate hero rejection reason must be "already_assigned", got "${econCheck.dupReason}"`);
    assert.equal(econCheck.claimEmpty1.gainedStones, 0);
    assert.equal(econCheck.claimEmpty2.gainedStones, 0);
    assert.ok(econCheck.claimCapped.gainedStones <= econCheck.stonesCap, `Claimed stones (${econCheck.claimCapped.gainedStones}) must respect cap ${econCheck.stonesCap}`);
    assert.ok(econCheck.claimCapped.gainedStars <= econCheck.starsCap, `Claimed stars (${econCheck.claimCapped.gainedStars}) must respect cap ${econCheck.starsCap}`);
    assert.equal(econCheck.claimAfterCapped.gainedStones, 0, "Second consecutive claim on empty bank must yield 0");

    // Sanctum pause vs live combat tick
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.expeditions.tickTimer = 8.5;
      api.enterSanctumHub();
    });
    await page.waitForTimeout(260);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.expeditions.tickTimer), 8.5, "Expedition must pause in Sanctum Hub");

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      api.initArenaStage(0, false);
      s.arena.paused = false;
      if (!s.arena.enemies.some(e => e.hp > 0 && !e.isDummy && !e.isTreasure)) api.spawnSingleEnemy("wolf", 920, 460, 1.0, false);
    });
    await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.expeditions.tickTimer < 8.5), "Expedition must tick during active non-Sanctum combat");
    await ctx.close();

    // Scenarios 2-5: Legacy expedition migration, reload persistence, QuotaExceededError alert+retry, multi-tab contention
    const ctxExp = await newIsolatedContext(browser);
    const tabA = await ctxExp.newPage();
    attachErrorListeners(tabA, "R4-1-SaveA");
    await tabA.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabA.evaluate((sk) => {
      localStorage.clear();
      localStorage.setItem(sk, JSON.stringify({
        game: {
          name: "远征旧档",
          realm: "nascent",
          stones: 300,
          bondTiers: { shen: 1, pei: 0, lu: 0, yan: 0 },
          expeditions: {
            assignments: { qinglan_vein: "shen", qingyun_peak: "yan" },
            bankedStones: 9999,
            bankedStars: 99,
            supportThunderCount: 0,
            tickTimer: 6.0
          }
        },
        stageIdx: 0, stanceIdx: 0, towerMode: false, sanctumMode: true
      }));
    }, STORAGE_KEY);
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.waitForSelector("#btn-continue-save");
    await tabA.click("#btn-continue-save");
    await tabA.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    const migExp = await tabA.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      return {
        qinglan: g.expeditions?.assignments?.qinglan_vein || null,
        qingyun: g.expeditions?.assignments?.qingyun_peak || null,
        bankedStones: g.expeditions?.bankedStones,
        bankedStars: g.expeditions?.bankedStars,
        stonesCap: api.EXPEDITION_BANKED_STONES_CAP,
        starsCap: api.EXPEDITION_BANKED_STARS_CAP
      };
    });
    assert.equal(migExp.qinglan, "shen", "Legacy save must preserve valid bonded expedition assignment");
    assert.equal(migExp.qingyun, null, "Legacy save migration must prune unbonded expedition hero");
    assert.ok(migExp.bankedStones <= migExp.stonesCap, `Migrated bankedStones (${migExp.bankedStones}) must clamp to <= ${migExp.stonesCap}`);
    assert.ok(migExp.bankedStars <= migExp.starsCap, `Migrated bankedStars (${migExp.bankedStars}) must clamp to <= ${migExp.starsCap}`);

    // Scenario 3: Reload persistence
    await tabA.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.expeditions.bankedStones = 145;
      api.saveGame();
    });
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.waitForSelector("#btn-continue-save");
    await tabA.click("#btn-continue-save");
    await tabA.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    const afterReloadExp = await tabA.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      return { qinglan: g.expeditions?.assignments?.qinglan_vein || null, bankedStones: g.expeditions?.bankedStones };
    });
    assert.equal(afterReloadExp.qinglan, "shen", "Expedition assignment must persist across reload");
    assert.equal(afterReloadExp.bankedStones, 145, "Expedition bankedStones must persist across reload");

    // Scenario 4: QuotaExceededError write-fail alert + preserve + retry recovery
    const rawBeforeQuota = await tabA.evaluate((sk) => localStorage.getItem(sk), STORAGE_KEY);
    const quotaRes = await tabA.evaluate((sk) => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === sk) throw new DOMException("Quota full", "QuotaExceededError");
        return orig.call(this, k, v);
      };
      window.__CHENYUAN_V25__.getState().game.expeditions.bankedStones = 210;
      const ok = window.__CHENYUAN_V25__.saveGame();
      Storage.prototype.setItem = orig;
      return {
        ok,
        rawAfterFail: localStorage.getItem(sk),
        alertVisible: getComputedStyle(document.getElementById("hud-save-alert")).display !== "none"
      };
    }, STORAGE_KEY);
    assert.equal(quotaRes.ok, false, "QuotaExceededError must return false from saveGame");
    assert.equal(quotaRes.rawAfterFail, rawBeforeQuota, "Failed write must preserve prior expedition save intact");
    assert.equal(quotaRes.alertVisible, true, "QuotaExceededError must surface #hud-save-alert");
    await tabA.click('#hud-save-alert [data-action="retry-save-now"]');
    await tabA.waitForTimeout(140);
    assert.equal(await tabA.evaluate((sk) => JSON.parse(localStorage.getItem(sk) || "{}").game?.expeditions?.bankedStones, STORAGE_KEY), 210, "Retry save must persist updated expedition bankedStones");

    // Scenario 5: Multi-tab contention & sync
    const tabB = await ctxExp.newPage();
    attachErrorListeners(tabB, "R4-1-SaveB");
    await tabB.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabB.waitForSelector("#btn-continue-save");
    await tabB.click("#btn-continue-save");
    await tabB.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await tabB.evaluate(() => {
      window.__CHENYUAN_V25__.getState().game.expeditions.bankedStones = 333;
      window.__CHENYUAN_V25__.saveGame();
    });
    await tabA.waitForSelector('#modal-backdrop.open [data-action="load-latest-save"]');
    await tabA.click('[data-action="load-latest-save"]');
    await tabA.waitForTimeout(160);
    assert.equal(await tabA.evaluate(() => window.__CHENYUAN_V25__.getState().game.expeditions?.bankedStones), 333, "Loading latest save in multi-tab conflict must sync Tab B expedition state");
    await ctxExp.close();
  });

  await runSuite("R4-2", "M4 G2 切玉赌注套利封口 + G4 剑冢/天阙跳关练手隔离(零奖励/零纪录)", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R4-2", true);
    // 1. G2: Collecting all 15 Dao Laws disables jade wager / prevents net stone profit
    const jadeRes = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const g = s.game;
      g.realm = "nascent";
      g.stones = 500;
      g.laws = [
        "wanjian", "yinyang", "pill_fire", "wealth_power", "thunder_body",
        "crit_lotus", "nine_pill", "eternal_spring", "stagger_surge", "void_haste",
        "relic_awake", "beast_soul", "age_might", "karma_resonance", "destiny_eye"
      ];
      return { allCollectedBefore: api.isAllDaoLawsCollected(g), stones: g.stones };
    });
    assert.equal(jadeRes.allCollectedBefore, true, "All 15 Dao Laws must satisfy isAllDaoLawsCollected");
    await page.click("#nav-btn-alchemy");
    await page.waitForTimeout(160);
    const gambleDisabled = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const btn = document.querySelector('#panel-scroll-body [data-action="gamble-jade"]');
      return {
        allDone: api.isAllDaoLawsCollected(api.getState().game),
        btnExists: Boolean(btn),
        btnDisabled: Boolean(btn && btn.disabled)
      };
    });
    assert.equal(gambleDisabled.allDone, true);
    assert.equal(gambleDisabled.btnExists, true, "Alchemy drawer must render gamble-jade control");
    assert.equal(gambleDisabled.btnDisabled, true, "Jade wager button must be disabled once all Dao Laws are collected");

    // 2. G4: Boss Rush Bout 6 skip & Celestial Spire Floor 9 skip run in practice mode with 0 rewards/records
    const practiceRes = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "nascent";
      s.game.rushBestGrade = "";
      s.game.bestSpireFloor = 0;
      api.startBossRushGauntlet(6);
      const rushPractice = api.isPracticeModeActive();
      const rushIsPracticeFlag = Boolean(s.arena.bossRush && s.arena.bossRush.practiceMode);

      api.startCelestialSpireRun(9);
      const spirePractice = api.isPracticeModeActive();
      const spireIsPracticeFlag = Boolean(s.arena.celestialSpire && s.arena.celestialSpire.practiceMode);
      return { rushPractice, rushIsPracticeFlag, spirePractice, spireIsPracticeFlag };
    });
    assert.equal(practiceRes.rushPractice, true, "Boss Rush Bout 6 skip must activate practice mode");
    assert.equal(practiceRes.rushIsPracticeFlag, true, "arena.bossRush.practiceMode must be true on skipped bout");
    assert.equal(practiceRes.spirePractice, true, "Celestial Spire Floor 9 skip must activate practice mode");
    assert.equal(practiceRes.spireIsPracticeFlag, true, "arena.celestialSpire.practiceMode must be true on skipped floor");
    await ctx.close();
  });

  await runSuite("R4-3", "M4 G5 永久成长上限与旧档无损钳位 + G6 沙盒硬隔离 + G11a 剑冢诚实评级", async () => {
    // 1. G5 Caps + G11a Boss Rush Grading
    const { ctx, page } = await startCleanGamePage(browser, "R4-3", true);
    const capsAndGrade = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "golden";
      const caps = api.getPermGrowthCaps(s.game);
      const bfQuota = api.getBloodFuryQuota(s.game);
      s.game.spireCurios = { dragon_scale: 99 };
      const clampedCurio = api.getCurioStacks(s.game, "dragon_scale");

      // Baseline Boss Rush run (210s elapsed, 0 partBreaks, 0 parries, 3 hits) should score A, NOT automatic SS
      const baseGrade = api.computeBossRushScoreAndGrade({ elapsed: 210, partBreaks: 0, parries: 0, hitsTaken: 3, damageTaken: 100 }, 1.0, 325, 0);
      // Elite fast no-hit technical run should reach SS / S+
      const eliteGrade = api.computeBossRushScoreAndGrade({ elapsed: 110, partBreaks: 6, parries: 6, hitsTaken: 0, damageTaken: 0 }, 1.2, 325, 0);
      return { caps, bfQuota, clampedCurio, baseGrade, eliteGrade };
    });
    assert.equal(capsAndGrade.bfQuota.max, 2, "Blood fury quota per realm must be capped at 2");
    assert.equal(capsAndGrade.clampedCurio, 3, "Spire curio stacks must be clamped to <= 3");
    assert.equal(capsAndGrade.caps.spireCurioMaxStack, 3);
    assert.equal(capsAndGrade.baseGrade.shortGrade, "A", `Baseline Boss Rush run should grade A (not automatic SS), got ${capsAndGrade.baseGrade.shortGrade}`);
    assert.ok(["SS", "S+"].includes(capsAndGrade.eliteGrade.shortGrade), `Elite technical no-hit Boss Rush should achieve SS/S+, got ${capsAndGrade.eliteGrade.shortGrade}`);

    // 2. G6 Sandbox hard isolation across reload
    const beforeSandbox = await page.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.stones = 321;
      api.saveGame();
      return { liveSave: localStorage.getItem(sk), metaRaw: localStorage.getItem("chenyuan_wendao_v11_meta") };
    }, STORAGE_KEY);
    await page.click("#btn-pavilion-menu");
    await page.waitForTimeout(120);
    await page.click("#btn-ascension-roadmap");
    await page.waitForSelector('#modal-backdrop.open [data-action="toggle-arcana-all-roadmap"]');
    await page.click('[data-action="toggle-arcana-all-roadmap"]');
    await page.waitForSelector("#modal-backdrop.open #btn-confirm-enter-sandbox");
    await page.click("#btn-confirm-enter-sandbox");
    await page.waitForTimeout(180);
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.stones = 999999;
      api.saveGame();
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save");
    await page.click("#btn-continue-save");
    await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    const afterReload = await page.evaluate(() => ({
      isSandbox: window.__CHENYUAN_V25__.isSandboxMode(),
      stones: window.__CHENYUAN_V25__.getState().game.stones
    }));
    assert.equal(afterReload.isSandbox, false, "Reload must exit sandbox back to real save");
    assert.equal(afterReload.stones, 321, "Sandbox mutations must NEVER leak into live save across reload");
    await ctx.close();
  });

  await runSuite("R4-4", "M4 G9 显式消费(行囊24/24处置、炼丹补料明细、法宝妖核折扣开关、魂印择佩)", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R4-4", true);
    // 1. Bag 24/24 queues explicit overflow modal without auto-smelting
    const overflowCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.stones = 200;
      s.game.gearBag = [];
      for (let i = 0; i < api.GEAR_BAG_LIMIT; i++) {
        s.game.gearBag.push(api.rollGearItem(1, 0, "weapon"));
      }
      const stonesBefore = s.game.stones;
      const extraItem = api.rollGearItem(2, 1, "weapon");
      api.acquireGearItem(extraItem);
      return {
        stonesBefore,
        stonesAfter: s.game.stones,
        bagLen: s.game.gearBag.length,
        pendingCount: api.getPendingOverflowCount()
      };
    });
    assert.equal(overflowCheck.stonesAfter, overflowCheck.stonesBefore, "Acquiring gear with full 24/24 bag must NOT silently auto-smelt");
    assert.equal(overflowCheck.bagLen, 24);
    assert.ok(overflowCheck.pendingCount >= 1, "Full bag must queue overflow item for explicit user disposition");
    // Q1 F10: With live prologue wolves on field, overflow modal MUST defer (not interrupt combat) and surface #btn-pending-rewards
    assert.equal(
      await page.evaluate(() => document.getElementById("modal-backdrop")?.classList.contains("open")),
      false,
      "Full bag overflow during live combat must NOT immediately open blocking modal"
    );
    await page.waitForSelector("#btn-pending-rewards", { state: "visible" });
    await page.click("#btn-pending-rewards");
    await page.waitForSelector("#modal-backdrop.open #btn-overflow-smelt-new");
    await page.click("#btn-overflow-smelt-new");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));

    // 2. Alchemy missing-material stone cost breakdown & real UI confirm modal (#btn-confirm-alchemy-buy)
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "qi";
      s.game.stones = 800;
      s.game.inventory = { herb: 0, dew: 0, core: 3 };
      api.updateHud();
    });
    const breakdown = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      return api.computeRecipeCostBreakdown(api.getState().game, api.RECIPES.foundation);
    });
    assert.ok(breakdown.missingItems.length > 0 && breakdown.matBuyCost > 0, "Missing alchemy materials must compute itemized matBuyCost");
    await page.click("#nav-btn-alchemy");
    await page.waitForSelector('#panel-scroll-body [data-quick-craft="foundation"]');
    const stonesBeforeCraft = await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones);
    await page.click('#panel-scroll-body [data-quick-craft="foundation"]');
    await page.waitForSelector("#modal-backdrop.open #btn-confirm-alchemy-buy");
    const modalTextAlchemy = await page.textContent("#modal-content");
    assert.ok(modalTextAlchemy.includes("购入缺料"), "Alchemy confirm modal must itemize 购入缺料 cost");
    assert.equal(
      await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones),
      stonesBeforeCraft,
      "Opening alchemy confirm modal must NOT deduct stones before user confirms"
    );
    await page.click('#modal-backdrop.open [data-modal-close="1"]');
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));

    // 3. Relic temper core-discount checkbox toggle in UI & cost diff
    await page.waitForSelector("#panel-scroll-body #chk-temper-use-core");
    const temperBeforeToggle = await page.evaluate(() => window.__CHENYUAN_V25__.getTemperUseCoreDiscount());
    await page.click("#panel-scroll-body #chk-temper-use-core");
    await page.waitForTimeout(100);
    const temperCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      const noCore = api.getRelicTemperCost(g, 2, false);
      const withCore = api.getRelicTemperCost(g, 2, true);
      return { toggled: api.getTemperUseCoreDiscount(), noCore, withCore };
    });
    assert.notEqual(temperCheck.toggled, temperBeforeToggle, "#chk-temper-use-core click must toggle temperUseCoreDiscount");
    assert.equal(temperCheck.withCore.applyCore, true, "Enabling core discount with cores available must set applyCore=true");
    assert.equal(temperCheck.noCore.applyCore, false, "Disabling core discount must set applyCore=false");
    assert.ok(temperCheck.withCore.finalStones < temperCheck.noCore.finalStones, `Enabling core discount must lower relic temper stone cost (${temperCheck.withCore.finalStones} < ${temperCheck.noCore.finalStones})`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("jade-panel")?.classList.contains("drawer-open"));

    // 4. Soul unlock prompts before equipping (kill serpent boss -> frost_phoenix queued -> keep current keeps blood_warden)
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "golden";
      s.game.equippedSoul = "blood_warden";
      s.game.unlockedSouls = ["blood_warden"];
      api.initArenaStage(0, false);
      s.arena.enemies = [];
      api.spawnSingleEnemy("serpent", 720, 450, 1.0, true, "寒潭玄蛇");
      api.spawnSingleEnemy("wolf", 920, 460, 1.0, false);
      const boss = s.arena.enemies.find(e => e.id === "serpent");
      if (boss) api.handleEnemyDeath(boss);
    });
    // Q1 F10: While wolf is still alive, soul unlock must defer (not auto-equip and not interrupt combat) and surface #btn-pending-rewards
    const soulDeferred = await page.evaluate(() => ({
      modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open")),
      equipped: window.__CHENYUAN_V25__.getState().game.equippedSoul,
      pendingSouls: window.__CHENYUAN_V25__.getPendingSoulUnlockCount()
    }));
    assert.equal(soulDeferred.modalOpen, false, "Soul unlock with live wolf remaining must NOT open modal mid-combat");
    assert.equal(soulDeferred.equipped, "blood_warden", "Soul unlock must NOT auto-equip before player chooses");
    assert.ok(soulDeferred.pendingSouls >= 1, "Soul unlock must be persisted in pendingRewards");
    await page.waitForSelector("#btn-pending-rewards", { state: "visible" });
    await page.click("#btn-pending-rewards");
    await page.waitForSelector("#modal-backdrop.open #btn-soul-keep-current");
    const soulBeforeClick = await page.evaluate(() => ({
      equipped: window.__CHENYUAN_V25__.getState().game.equippedSoul,
      hasEquipBtn: Boolean(document.getElementById("btn-soul-equip-new"))
    }));
    assert.equal(soulBeforeClick.equipped, "blood_warden", "Unlocking new soul must NOT auto-equip before player chooses");
    assert.equal(soulBeforeClick.hasEquipBtn, true, "Soul unlock modal must expose #btn-soul-equip-new");
    await page.click("#btn-soul-keep-current");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.equippedSoul), "blood_warden");
    await ctx.close();
  });

  // =========================================================================
  // MILESTONE 5 REGRESSION SUITES (R5-1 .. R5-3): S3, S4, S7, S8, S9, S10
  // =========================================================================
  await runSuite("R5-1", "M5 S3 六卷/故人导航术语统一 + S4 规范名与 s4_npc->s4_puppet 旧档5场景迁移", async () => {
    // Scenario 1: Fresh start navigation terminology & canonical step IDs
    const { ctx, page } = await startCleanGamePage(browser, "R5-1", true);
    const navCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const storyBtn = document.getElementById("nav-btn-story");
      const ch4 = api.CHAPTERS.find(c => c.index === 4);
      return {
        storyBtnText: storyBtn ? storyBtn.textContent.trim() : "",
        hasS4Puppet: Boolean(ch4 && ch4.steps.some(st => st.id === "s4_puppet")),
        legacyMap: api.LEGACY_STEP_ID_MAP && api.LEGACY_STEP_ID_MAP.s4_npc,
        volCount: Object.keys(api.VOLUME_RECAP_META || {}).length
      };
    });
    assert.ok(navCheck.storyBtnText.includes("故人"), `#nav-btn-story must be labeled 故人, got: ${navCheck.storyBtnText}`);
    assert.equal(navCheck.hasS4Puppet, true, "Chapter 4 must use canonical s4_puppet step ID");
    assert.equal(navCheck.legacyMap, "s4_puppet", "LEGACY_STEP_ID_MAP must map s4_npc -> s4_puppet");
    assert.ok(navCheck.volCount >= 5, `Expected >= 5 volumes in VOLUME_RECAP_META, got ${navCheck.volCount}`);
    await ctx.close();

    // Scenario 2: Legacy save with s4_npc claimed migrates losslessly to s4_puppet
    const ctxLeg = await newIsolatedContext(browser);
    const pageLeg = await ctxLeg.newPage();
    attachErrorListeners(pageLeg, "R5-1-LegacyA");
    await pageLeg.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await pageLeg.evaluate((sk) => {
      localStorage.clear();
      localStorage.setItem(sk, JSON.stringify({
        game: { name: "旧步剑修", realm: "golden", claimedStepIds: ["s4_npc"], stageStars: { 0: 1, 1: 1, 2: 1, 3: 1 } },
        stageIdx: 3, stanceIdx: 0, towerMode: false, sanctumMode: true
      }));
    }, STORAGE_KEY);
    await pageLeg.reload({ waitUntil: "domcontentloaded" });
    await pageLeg.waitForSelector("#btn-continue-save");
    await pageLeg.click("#btn-continue-save");
    await pageLeg.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    const migratedClaimed = await pageLeg.evaluate(() => window.__CHENYUAN_V25__.getState().game.claimedStepIds || []);
    assert.ok(migratedClaimed.includes("s4_puppet"), `Legacy s4_npc must migrate into claimedStepIds as s4_puppet, got: ${JSON.stringify(migratedClaimed)}`);
    assert.equal(migratedClaimed.includes("s4_npc"), false, `Migrated claimedStepIds must not retain legacy s4_npc, got: ${JSON.stringify(migratedClaimed)}`);

    // Scenario 3: Reload persistence of migrated s4_puppet
    await pageLeg.evaluate(() => window.__CHENYUAN_V25__.saveGame());
    await pageLeg.reload({ waitUntil: "domcontentloaded" });
    await pageLeg.waitForSelector("#btn-continue-save");
    await pageLeg.click("#btn-continue-save");
    await pageLeg.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    const reloadedClaimed = await pageLeg.evaluate(() => window.__CHENYUAN_V25__.getState().game.claimedStepIds || []);
    assert.ok(reloadedClaimed.includes("s4_puppet") && !reloadedClaimed.includes("s4_npc"), `Migrated s4_puppet must persist cleanly across reload, got: ${JSON.stringify(reloadedClaimed)}`);

    // Scenario 4: QuotaExceededError write-fail alert + preserve + retry recovery
    const rawBeforeQuota = await pageLeg.evaluate((sk) => localStorage.getItem(sk), STORAGE_KEY);
    const quotaFail = await pageLeg.evaluate((sk) => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === sk) throw new DOMException("Quota full", "QuotaExceededError");
        return orig.call(this, k, v);
      };
      const g = window.__CHENYUAN_V25__.getState().game;
      if (!g.claimedStepIds.includes("s4_relic")) g.claimedStepIds.push("s4_relic");
      const ok = window.__CHENYUAN_V25__.saveGame();
      Storage.prototype.setItem = orig;
      return {
        ok,
        rawAfterFail: localStorage.getItem(sk),
        alertVisible: getComputedStyle(document.getElementById("hud-save-alert")).display !== "none"
      };
    }, STORAGE_KEY);
    assert.equal(quotaFail.ok, false, "QuotaExceededError must fail saveGame cleanly");
    assert.equal(quotaFail.rawAfterFail, rawBeforeQuota, "Failed write must preserve migrated save intact");
    assert.equal(quotaFail.alertVisible, true, "QuotaExceededError must display #hud-save-alert");
    await pageLeg.click('#hud-save-alert [data-action="retry-save-now"]');
    await pageLeg.waitForTimeout(140);
    const afterRetryClaimed = await pageLeg.evaluate((sk) => JSON.parse(localStorage.getItem(sk) || "{}").game?.claimedStepIds || [], STORAGE_KEY);
    assert.ok(afterRetryClaimed.includes("s4_puppet") && afterRetryClaimed.includes("s4_relic"), "Retry save must persist both migrated s4_puppet and new s4_relic");

    // Scenario 5: Multi-tab contention & latest sync
    const pageLegB = await ctxLeg.newPage();
    attachErrorListeners(pageLegB, "R5-1-LegacyB");
    await pageLegB.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await pageLegB.waitForSelector("#btn-continue-save");
    await pageLegB.click("#btn-continue-save");
    await pageLegB.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await pageLegB.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      if (!g.claimedStepIds.includes("s4_break")) g.claimedStepIds.push("s4_break");
      window.__CHENYUAN_V25__.saveGame();
    });
    await pageLeg.waitForSelector('#modal-backdrop.open [data-action="load-latest-save"]');
    await pageLeg.click('[data-action="load-latest-save"]');
    await pageLeg.waitForTimeout(160);
    const syncedClaimed = await pageLeg.evaluate(() => window.__CHENYUAN_V25__.getState().game.claimedStepIds || []);
    assert.ok(syncedClaimed.includes("s4_puppet") && syncedClaimed.includes("s4_break"), `Multi-tab sync must preserve s4_puppet and pull s4_break, got: ${JSON.stringify(syncedClaimed)}`);
    await ctxLeg.close();
  });

  await runSuite("R5-2", "M5 S7 卷终先落盘->过场->合卷回顾->开传送阵(沙盒旁路) + S8 五句开场卷轴与首领战前独白", async () => {
    // 1. S8: Fresh start with { dismissOpening: false } plays 5-line opening_scroll; step-through & skip both work; continue does NOT replay
    const { ctx, page } = await startCleanGamePage(browser, "R5-2-S8", false, { dismissOpening: false });
    await page.waitForSelector("#story-dialogue-bar.open");
    const scrollInfo = await page.evaluate(() => ({
      linesCount: (window.__CHENYUAN_V25__.CHAPTER_CUTSCENES.opening_scroll || []).length,
      hasBossPre0: Boolean(window.__CHENYUAN_V25__.CHAPTER_CUTSCENES.boss_pre_stage0),
      allChaptersHaveDesc: window.__CHENYUAN_V25__.CHAPTERS.every(c => typeof c.desc === "string" && c.desc.length > 0)
    }));
    assert.equal(scrollInfo.linesCount, 5, "opening_scroll must have 5 narrative lines");
    assert.equal(scrollInfo.hasBossPre0, true, "boss_pre_stage0 cutscene must exist");
    assert.equal(scrollInfo.allChaptersHaveDesc, true, "Every chapter must define non-empty desc");

    // Advance one line via #btn-dlg-next, then skip rest via #btn-dlg-skip
    await page.click("#btn-dlg-next");
    await page.waitForTimeout(80);
    await page.click("#btn-dlg-skip");
    await page.waitForFunction(() => !document.getElementById("story-dialogue-bar")?.classList.contains("open"));

    // Reload & continue must NOT replay opening_scroll
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save");
    await page.click("#btn-continue-save");
    await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await page.waitForTimeout(220);
    assert.equal(await page.evaluate(() => document.getElementById("story-dialogue-bar")?.classList.contains("open")), false, "Continue save must NOT replay opening_scroll");

    // 2. S7: Normal campaign stage clear persists immediately BEFORE recap modal, and spawns portal ONLY after #btn-volume-recap-confirm
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "qi";
      s.game.defeatedStageBosses = {};
      s.game.seenCutscenes.enter_sect = true;
      api.initArenaStage(1, false);
      s.arena.waveIdx = 5;
      s.arena.props = [];
      api.spawnCurrentWave();
    });
    const phaseAPersisted = await page.evaluate((sk) => {
      const saved = JSON.parse(localStorage.getItem(sk) || "{}");
      return Boolean(saved.game && saved.game.defeatedStageBosses && saved.game.defeatedStageBosses[1]);
    }, STORAGE_KEY);
    assert.equal(phaseAPersisted, true, "S7 Phase A must persist Boss kill BEFORE cutscene & recap confirm");
    await dismissActiveCutscene(page);
    await page.waitForSelector("#modal-backdrop.open #btn-volume-recap-confirm");
    assert.equal(
      await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.props.some(p => p.id === "portal_next")),
      false,
      "portal_next must NOT spawn before #btn-volume-recap-confirm"
    );
    await page.click("#btn-volume-recap-confirm");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    assert.equal(
      await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.props.some(p => p.id === "portal_next")),
      true,
      "portal_next must spawn immediately after confirming #btn-volume-recap-confirm"
    );

    // Sandbox bypasses volume-end recap modal and spawns portal directly
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.enterSandboxMode();
      const s = api.getState();
      api.initArenaStage(1, false);
      s.arena.waveIdx = 5;
      s.arena.props = [];
      api.spawnCurrentWave();
    });
    await page.waitForTimeout(140);
    const sandboxBypass = await page.evaluate(() => ({
      modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open")),
      recapOpen: Boolean(document.querySelector("#modal-backdrop.open #btn-volume-recap-confirm")),
      portalSpawned: window.__CHENYUAN_V25__.getState().arena.props.some(p => p.id === "portal_next")
    }));
    assert.equal(sandboxBypass.modalOpen, false, "Sandbox mode must not open modal on stage clear");
    assert.equal(sandboxBypass.recapOpen, false, "Sandbox mode must bypass volume-end recap modal");
    assert.equal(sandboxBypass.portalSpawned, true, "Sandbox mode should spawn stage-clear portal directly");
    await ctx.close();
  });

  await runSuite("R5-3", "M5 S9 故人11段列传与动态过场分支 + S10 九段红尘问心去重与耗尽兜底", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R5-3", true);
    const res = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const g = s.game;
      g.realm = "spirit";
      g.choices = {};
      const storiesLen = api.STORIES.length;
      const enterSecretDefault = api.resolveCutsceneLines("enter_secret", g);
      g.choices.pei_meet = "a";
      const enterSecretMet = api.resolveCutsceneLines("enter_secret", g);

      const enterTerraceDefault = api.resolveCutsceneLines("enter_terrace", g);
      g.choices.yan_gate = "a";
      const enterTerraceAfterGate = api.resolveCutsceneLines("enter_terrace", g);

      // S10: Exhaust all 9 karma dilemmas without repetition
      g.completedKarmaIds = [];
      const seenIds = [];
      for (let i = 0; i < api.KARMA_DILEMMAS.length; i++) {
        const next = api.getNextAvailableKarmaDilemma(g);
        if (!next) break;
        seenIds.push(next.id);
        api.resolveKarmaDilemmaChoice(next.id, i % 2 === 0 ? "right" : "demon");
      }
      const progAfterAll = api.getKarmaDilemmaProgress(g);
      const duplicateRet = api.resolveKarmaDilemmaChoice(seenIds[0], "right");
      return {
        storiesLen,
        secretDiff: JSON.stringify(enterSecretDefault) !== JSON.stringify(enterSecretMet),
        terraceDiff: JSON.stringify(enterTerraceDefault) !== JSON.stringify(enterTerraceAfterGate),
        dilemmaTotal: api.KARMA_DILEMMAS.length,
        uniqueResolved: new Set(seenIds).size,
        allExhausted: progAfterAll.allExhausted,
        duplicateRet
      };
    });
    assert.equal(res.storiesLen, 11, `Expected 11 companion STORIES, got ${res.storiesLen}`);
    assert.equal(res.secretDiff, true, "enter_secret cutscene must branch when pei_meet is chosen");
    assert.equal(res.terraceDiff, true, "enter_terrace cutscene must branch when yan_gate is chosen");
    assert.equal(res.dilemmaTotal, 9, `Expected 9 KARMA_DILEMMAS, got ${res.dilemmaTotal}`);
    assert.equal(res.uniqueResolved, 9, `All 9 karma dilemmas must resolve uniquely without repeats, got ${res.uniqueResolved}`);
    assert.equal(res.allExhausted, true, "After completing all 9 dilemmas, getKarmaDilemmaProgress.allExhausted must be true");
    assert.equal(res.duplicateRet, false, "Re-resolving an already completed karma dilemma must return false");
    await ctx.close();
  });

  // =========================================================================
  // MILESTONE 6 REGRESSION SUITES (R6-1 .. R6-3): S11+G7, G8, G10, G11b, G12
  // =========================================================================
  await runSuite("R6-1", "M6 S11+G7 五境分阶解封矩阵、非阻塞 #new-unlock-card 与旧档防刷屏", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R6-1", true);
    const matrix = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      const checkRealm = (r) => {
        game.realm = r;
        return {
          sanqing: api.isActionUnlockedByRealm(game, "sanqing"),
          astral: api.isActionUnlockedByRealm(game, "astral"),
          spire: api.isEcosystemSystemUnlocked(game, "celestial_spire"),
          expedition: api.isEcosystemSystemUnlocked(game, "vein_expedition"),
          pacts: api.isEcosystemSystemUnlocked(game, "heavenly_pacts")
        };
      };
      return {
        qi: checkRealm("qi"),
        foundation: checkRealm("foundation"),
        golden: checkRealm("golden"),
        nascent: checkRealm("nascent"),
        spirit: checkRealm("spirit"),
        catalogLen: api.UNLOCK_TUTORIAL_CATALOG.length
      };
    });
    assert.equal(matrix.golden.sanqing, false);
    assert.equal(matrix.golden.astral, false);
    assert.equal(matrix.golden.spire, false);
    assert.equal(matrix.golden.expedition, false);
    assert.equal(matrix.nascent.sanqing, true);
    assert.equal(matrix.nascent.astral, true);
    assert.equal(matrix.nascent.spire, true);
    assert.equal(matrix.nascent.expedition, true);
    assert.equal(matrix.nascent.pacts, false);
    assert.equal(matrix.spirit.pacts, true);
    assert.ok(matrix.catalogLen >= 10, `Expected >= 10 unlock tutorial cards, got ${matrix.catalogLen}`);

    // Queue & display non-blocking #new-unlock-card -> Q1 F10 defers during hot combat, displays on calm, dismiss persists into seenUnlockIds across reload
    const unlockHotDeferred = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "qi";
      g.seenUnlockIds = [];
      api.queueNewUnlockCardsForState(g);
      const flushedHot = api.flushNewUnlockCard();
      return { flushedHot, calm: api.isCombatCalm(), pendingLen: api.getPendingUnlockCardQueue().length };
    });
    assert.equal(unlockHotDeferred.calm, false, "Prologue with live wolves must be combat-hot");
    assert.equal(unlockHotDeferred.flushedHot, false, "flushNewUnlockCard must defer while combat-hot");
    assert.ok(unlockHotDeferred.pendingLen >= 1, "Earned unlock cards must remain queued while combat-hot");
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.enterSanctumHub();
      api.flushNewUnlockCard();
    });
    await page.waitForSelector("#new-unlock-card #btn-unlock-dismiss");
    const activeIdBeforeDismiss = await page.evaluate(() => window.__CHENYUAN_V25__.getActiveUnlockCardId());
    assert.ok(activeIdBeforeDismiss, "Active unlock card ID must be set when #new-unlock-card is visible");
    await page.click("#btn-unlock-dismiss");
    await page.waitForTimeout(120);
    const seenNow = await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.seenUnlockIds || []);
    assert.ok(seenNow.includes(activeIdBeforeDismiss), "Dismissing #new-unlock-card must persist card ID into seenUnlockIds");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save");
    await page.click("#btn-continue-save");
    await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    const seenAfterReload = await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.seenUnlockIds || []);
    assert.ok(seenAfterReload.includes(activeIdBeforeDismiss), "seenUnlockIds must persist across page reload");
    await ctx.close();
  });

  await runSuite("R6-2", "M6 G8 寿元流逝、单阶效率衰减、延寿解厄与二次确认兵解转世守卫", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R6-2", true);
    const lifeCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "mortal"; // maxMonths = 744 (62y)
      g.startAgeMonths = 216;
      g.elapsedMonths = 0;
      const normalInfo = api.getLifespanInfo(g);
      const agedRes = api.advanceLifespanMonths(12, "test_step", { silentToast: true });

      // 75% warning band
      g.elapsedMonths = Math.round(744 * 0.78) - 216;
      const warnInfo = api.getLifespanInfo(g);

      // 92% critical decay band
      g.elapsedMonths = Math.round(744 * 0.92) - 216;
      const critInfo = api.getLifespanInfo(g);

      // 100% exhausted band: XP still progresses (never soft-locks), efficiency decayed
      g.elapsedMonths = 744 - 216;
      const exhInfo = api.getLifespanInfo(g);
      const xpBefore = g.xp;
      api.gainRealmXp(100);
      const xpGainExh = g.xp - xpBefore;

      // Verify RECIPES carry months metadata
      const allRecipesHaveMonths = Object.values(api.RECIPES).every(r => Number(r.months) > 0);
      return { normalInfo, agedRes, warnInfo, critInfo, exhInfo, xpGainExh, allRecipesHaveMonths };
    });
    assert.equal(lifeCheck.agedRes.aged, 12);
    assert.equal(lifeCheck.allRecipesHaveMonths, true, "All alchemy RECIPES must specify positive months cost");
    assert.ok(lifeCheck.warnInfo.status !== "normal", `78% lifespan must enter warn state, got ${lifeCheck.warnInfo.status}`);
    assert.ok(lifeCheck.critInfo.xpEfficiencyMult < lifeCheck.normalInfo.xpEfficiencyMult, "92% lifespan must decay XP efficiency");
    assert.equal(lifeCheck.exhInfo.status, "exhausted");
    assert.ok(lifeCheck.xpGainExh > 0 && lifeCheck.xpGainExh < 100, `100% exhausted lifespan must decay XP without soft-locking (gain=${lifeCheck.xpGainExh})`);

    // Open 100% Lifespan Exhausted modal -> verify stay option & 2-step 兵解转世 flow
    await page.evaluate(() => window.__CHENYUAN_V25__.openLifespanExhaustedModal(false));
    await page.waitForSelector("#modal-backdrop.open #btn-lifespan-stay");
    await page.waitForSelector("#modal-backdrop.open #btn-lifespan-bingjie");
    await page.click("#btn-lifespan-bingjie");
    await page.waitForSelector("#modal-backdrop.open #btn-confirm-bingjie-reincarnate");
    await page.click("#btn-bingjie-back");
    await page.waitForSelector("#modal-backdrop.open #btn-lifespan-stay");
    await page.click("#btn-lifespan-stay");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.isLifespanExhaustedDismissed()), true, "Clicking 暂留延寿 must dismiss exhausted prompt cleanly");
    await ctx.close();
  });

  await runSuite("R6-3", "M6 G10 分阶灵宠投喂与Lv3/Lv5技能择选 + G11b 名录统一 + G12 安全区打坐吸物 + 沙盒屏蔽", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R6-3", true);
    const petAndMagnet = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const g = s.game;
      g.realm = "qi";
      g.pet = { id: "fox", level: 1, skills: {} };
      const c1 = api.getPetNextFeedCost(1);
      const c2 = api.getPetNextFeedCost(2);
      const c3 = api.getPetNextFeedCost(3);
      const c4 = api.getPetNextFeedCost(4);
      const c5 = api.getPetNextFeedCost(5);
      g.inventory = { herb: 1, core: 0, jade: 0 };
      const canAffordShort = api.canAffordPetFeed(g);
      g.inventory.herb = 3;
      const canAffordOk = api.canAffordPetFeed(g);

      // Lv.3 pending skill tier
      g.pet.level = 3;
      const pending3 = api.getPendingPetSkillTier(g);

      // G12 Drop Magnet: safe zone meditation (1800px) vs active combat meditation (200px)
      api.enterSanctumHub();
      s.arena.player.meditating = true;
      const safeMagnet = api.getDropMagnetParams();

      api.initArenaStage(0, false);
      s.arena.paused = false;
      if (!s.arena.enemies.some(e => e.hp > 0 && !e.isDummy && !e.isTreasure)) api.spawnSingleEnemy("wolf", 900, 450, 1.0, false);
      s.arena.player.meditating = true;
      const combatMagnet = api.getDropMagnetParams();

      // Sandbox suppresses aging & unlock cards
      api.enterSandboxMode();
      const ageInSandbox = api.advanceLifespanMonths(24, "sandbox_probe", { silentToast: true });
      const cardsInSandbox = api.queueNewUnlockCardsForState(api.getState().game);
      api.exitSandboxMode();

      return {
        c1: c1?.mats,
        c2: c2?.mats,
        c3: c3?.mats,
        c4: c4?.mats,
        c5,
        canAffordShort,
        canAffordOk,
        pending3,
        safeMagnet,
        combatMagnet,
        ageInSandbox,
        cardsInSandbox,
        relicsDefined: Object.keys(api.RELICS || {}).length
      };
    });
    assert.deepEqual(petAndMagnet.c1, { herb: 3 });
    assert.deepEqual(petAndMagnet.c2, { core: 2 });
    assert.deepEqual(petAndMagnet.c3, { core: 4 });
    assert.deepEqual(petAndMagnet.c4, { jade: 3 });
    assert.equal(petAndMagnet.c5, null);
    assert.equal(petAndMagnet.canAffordShort, false);
    assert.equal(petAndMagnet.canAffordOk, true);
    assert.equal(petAndMagnet.pending3, 3);
    assert.equal(petAndMagnet.safeMagnet.safeZone, true);
    assert.equal(petAndMagnet.safeMagnet.radius, 1800);
    assert.equal(petAndMagnet.combatMagnet.safeZone, false);
    assert.equal(petAndMagnet.combatMagnet.radius, 200);
    assert.equal(petAndMagnet.ageInSandbox.skipped, true, "Sandbox mode must suppress lifespan aging");
    assert.equal(petAndMagnet.cardsInSandbox, 0, "Sandbox mode must suppress new unlock cards");
    assert.ok(petAndMagnet.relicsDefined >= 3);

    // Open Lv.3 pet skill choice modal and explicitly select a skill
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "qi";
      g.pet = { id: "fox", level: 3, skills: {} };
      api.openPetSkillChoiceModal(3);
    });
    await page.waitForSelector("#modal-backdrop.open [data-pick-pet-skill]");
    const chosenSkillId = await page.getAttribute("#modal-backdrop.open [data-pick-pet-skill]", "data-pick-pet-skill");
    await page.click(`#modal-backdrop.open [data-pick-pet-skill="${chosenSkillId}"]`);
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    assert.equal(
      await page.evaluate((sid) => window.__CHENYUAN_V25__.hasPetSkill(window.__CHENYUAN_V25__.getState().game, sid), chosenSkillId),
      true,
      `Picking Lv.3 pet skill ${chosenSkillId} must activate hasPetSkill`
    );
    await ctx.close();
  });

  // =========================================================================
  // MILESTONE Q0 REGRESSION SUITES (Q0-1 .. Q0-2): F05 Focus/Enter/HUD-Text & F06 Copy Parity
  // =========================================================================
  await runSuite("Q0-1", "F05 剧情结束回战场焦点、Enter道具交互不误开设置、HUD焦点返回、弹窗压过剧情及#hud-hp-txt同步", async () => {
    // 1. Fresh game -> dismiss opening_scroll via mouse click -> focus lands on #visual-stage (NOT #btn-open-settings)
    const ctx = await newIsolatedContext(browser);
    const page = await ctx.newPage();
    attachErrorListeners(page, "Q0-1");
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.click("#btn-start-new");
    await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await page.waitForSelector("#story-dialogue-bar.open #btn-dlg-skip");
    await page.click("#btn-dlg-skip");
    await page.waitForFunction(() => !document.getElementById("story-dialogue-bar")?.classList.contains("open"));
    const focusAfterMouseSkip = await page.evaluate(() => ({
      activeId: document.activeElement?.id || "",
      activeTag: document.activeElement?.tagName || "",
      tabindex: document.getElementById("visual-stage")?.getAttribute("tabindex")
    }));
    assert.equal(focusAfterMouseSkip.tabindex, "-1", "#visual-stage must have tabindex=-1");
    assert.equal(focusAfterMouseSkip.activeId, "visual-stage", `Mouse skip of opening_scroll must focus #visual-stage, got: ${focusAfterMouseSkip.activeId}`);

    // 2. Dismiss cutscene via keyboard Space -> focus also lands on #visual-stage
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      if (g && g.seenCutscenes) delete g.seenCutscenes.opening_scroll;
      api.playCutscene("opening_scroll");
    });
    await page.waitForSelector("#story-dialogue-bar.open");
    for (let i = 0; i < 12; i++) {
      const open = await page.evaluate(() => document.getElementById("story-dialogue-bar")?.classList.contains("open"));
      if (!open) break;
      await page.keyboard.press("Space");
      await page.waitForTimeout(40);
    }
    const focusAfterKbSpace = await page.evaluate(() => document.activeElement?.id || "");
    assert.equal(focusAfterKbSpace, "visual-stage", `Keyboard Space finish of cutscene must focus #visual-stage, got: ${focusAfterKbSpace}`);

    // 3. Enter near interactive prop interacts with prop instead of opening Settings
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const st = api.getState();
      st.arena.enemies = [];
      st.arena.paused = false;
      const prop = { id: "q0_test_merchant", kind: "merchant_npc", x: st.arena.player.x, y: st.arena.player.y, r: 44, name: "云游仙商", badge: "点击或按 Enter 交易" };
      st.arena.props.push(prop);
    });
    await page.waitForFunction(() => {
      const st = window.__CHENYUAN_V25__.getState();
      return !!(st.arena.nearbyProp && st.arena.nearbyProp.id === "q0_test_merchant");
    }, { timeout: 3000 });
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
    const afterEnterProp = await page.evaluate(() => ({
      drawerOpen: document.getElementById("jade-panel")?.classList.contains("drawer-open"),
      modalOpen: document.getElementById("modal-backdrop")?.classList.contains("open")
    }));
    assert.equal(afterEnterProp.drawerOpen, true, "Pressing Enter near merchant_npc prop while #visual-stage focused must interact with prop (open bag drawer)");
    assert.equal(afterEnterProp.modalOpen, false, "Pressing Enter near prop must NOT open Settings modal");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("jade-panel")?.classList.contains("drawer-open"));

    // 4. Focusing a HUD <button> (#btn-open-settings) or [role="button"] (#btn-open-goals-hdr) preserves Enter activation & focus return
    await page.focus("#btn-open-settings");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#modal-backdrop.open");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const restoredSettingsFocus = await page.evaluate(() => document.activeElement?.id || "");
    assert.equal(restoredSettingsFocus, "btn-open-settings", `Escape from Settings opened via #btn-open-settings must restore focus to #btn-open-settings, got: ${restoredSettingsFocus}`);

    await page.focus("#btn-open-goals-hdr");
    await page.keyboard.press("Enter");
    await page.waitForSelector("#modal-backdrop.open");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const restoredRoleBtnFocus = await page.evaluate(() => document.activeElement?.id || "");
    assert.equal(restoredRoleBtnFocus, "btn-open-goals-hdr", `Escape from Goals opened via [role="button"] #btn-open-goals-hdr must restore focus to #btn-open-goals-hdr, got: ${restoredRoleBtnFocus}`);

    // Remove test prop so canvas click hits empty battlefield and returns focus cleanly to #visual-stage
    await page.evaluate(() => {
      const st = window.__CHENYUAN_V25__.getState();
      st.arena.props = st.arena.props.filter(p => p && p.id !== "q0_test_merchant");
      st.arena.nearbyProp = null;
    });
    await page.mouse.click(240, 460);
    await page.waitForTimeout(60);
    const focusAfterCanvasClick = await page.evaluate(() => document.activeElement?.id || "");
    assert.equal(focusAfterCanvasClick, "visual-stage", `Clicking #fx-canvas must focus #visual-stage, got: ${focusAfterCanvasClick}`);

    // 5. Modal-over-Cutscene: Tab traps inside #modal-content and Escape closes modal FIRST without dismissing cutscene
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      if (g && g.seenCutscenes) delete g.seenCutscenes.opening_scroll;
      api.playCutscene("opening_scroll");
    });
    await page.waitForSelector("#story-dialogue-bar.open");
    await page.click("#btn-open-settings");
    await page.waitForSelector("#modal-backdrop.open");
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      const insideModal = await page.evaluate(() => document.getElementById("modal-content")?.contains(document.activeElement));
      assert.equal(insideModal, true, `Modal-over-Cutscene Tab #${i + 1} must stay inside #modal-content`);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    const afterFirstEsc = await page.evaluate(() => ({
      modalOpen: document.getElementById("modal-backdrop")?.classList.contains("open"),
      cutsceneOpen: document.getElementById("story-dialogue-bar")?.classList.contains("open"),
      focusInsideDialogue: !!document.getElementById("story-dialogue-bar")?.contains(document.activeElement),
      activeId: document.activeElement?.id || ""
    }));
    assert.equal(afterFirstEsc.modalOpen, false, "First Escape on Modal-over-Cutscene must close modal");
    assert.equal(afterFirstEsc.cutsceneOpen, true, "First Escape on Modal-over-Cutscene must keep cutscene open");
    assert.equal(
      afterFirstEsc.focusInsideDialogue,
      true,
      `First Escape on Modal-over-Cutscene must return focus inside #story-dialogue-bar, got activeElement=#${afterFirstEsc.activeId}`
    );
    assert.notEqual(
      afterFirstEsc.activeId,
      "btn-open-settings",
      "First Escape on Modal-over-Cutscene must NOT leak focus back to #btn-open-settings"
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("story-dialogue-bar")?.classList.contains("open"));

    // 5b. Stage-transition cutscene via World Map (#btn-world-map -> data-map-node="stg_1" -> enter_sect)
    //     must return focus cleanly to #visual-stage on dismissal instead of leaking back to #btn-world-map
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const st = api.getState();
      st.game.realm = "qi";
      if (st.game.seenCutscenes) delete st.game.seenCutscenes.enter_sect;
      api.updateHud();
    });
    await page.click("#btn-world-map");
    await page.waitForSelector('#modal-backdrop.open [data-map-node="stg_1"]');
    await page.click('#modal-backdrop.open [data-map-node="stg_1"]');
    await page.waitForSelector('#modal-backdrop.open [data-map-enter="stg_1"]');
    await page.click('#modal-backdrop.open [data-map-enter="stg_1"]');
    await page.waitForSelector("#story-dialogue-bar.open");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("story-dialogue-bar")?.classList.contains("open"));
    const focusAfterStageEntryCutscene = await page.evaluate(() => document.activeElement?.id || "");
    assert.equal(
      focusAfterStageEntryCutscene,
      "visual-stage",
      `Dismissing enter_sect cutscene after World Map travel must return focus to #visual-stage (not #btn-world-map), got: ${focusAfterStageEntryCutscene}`
    );

    // 6. #hud-hp-txt, #hud-mp-txt, #hud-xp-txt stay synchronized with live stats
    const hudSync = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const st = api.getState();
      st.game.realm = "foundation";
      const stats = api.getCombatStats(st.game);
      st.game.hp = stats.maxHp;
      st.game.mp = Math.round(stats.maxMp * 0.5);
      st.game.xp = 321;
      st.arena.player.invuln = 0;
      st.arena.player.shieldHp = 0;
      api.hurtPlayer(35);
      api.updateHud();
      return {
        expectedHp: `${Math.max(0, Math.round(st.game.hp))}/${Math.max(1, Math.round(stats.maxHp))}`,
        actualHp: (document.getElementById("hud-hp-txt")?.textContent || "").trim(),
        expectedMp: `${Math.max(0, Math.round(st.game.mp))}/${Math.max(1, Math.round(stats.maxMp))}`,
        actualMp: (document.getElementById("hud-mp-txt")?.textContent || "").trim(),
        actualXp: (document.getElementById("hud-xp-txt")?.textContent || "").trim(),
        expectedXp: `321/${api.getState().realmSpec.xpCap}`
      };
    });
    assert.notEqual(hudSync.actualHp, "65/65", "#hud-hp-txt must not remain stuck at initial 65/65");
    assert.equal(hudSync.actualHp, hudSync.expectedHp, `#hud-hp-txt mismatch: expected ${hudSync.expectedHp}, got ${hudSync.actualHp}`);
    assert.equal(hudSync.actualMp, hudSync.expectedMp, `#hud-mp-txt mismatch: expected ${hudSync.expectedMp}, got ${hudSync.actualMp}`);
    assert.equal(hudSync.actualXp, hudSync.expectedXp, `#hud-xp-txt mismatch: expected ${hudSync.expectedXp}, got ${hudSync.actualXp}`);
    await ctx.close();
  });

  await runSuite("Q0-2", "F06 共享 COMBAT_RULE_PARAMS 与技能/法则/天象/天时/气候/道韵/键位文案-实效一致性验证", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q0-2", true);
    const audit = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const v23 = window.__CHENYUAN_V23__;
      const P = api.getCombatRuleParams();
      const s = api.getState();
      const g = s.game;
      const a = s.arena;

      // Reset to clean deterministic baseline for live stat delta verification
      g.realm = "foundation";
      g.perk = "mortal_heart";
      g.pet = { id: null, level: 1, skills: {} };
      g.equippedGear = { weapon: null, armor: null, ring: null };
      g.loadout = { mind: "sword_mind", builder: "sword_build", finisher: "sword_release", relic: null };
      g.laws = [];
      g.destinyFruits = [];
      g.choices = {};
      g.litStars = [];
      g.spireCurios = {};
      g.sanctum = { buildings: {} };
      g.karmaScore = 0;
      g.karmaDrBonus = 0;
      g.statMultBonus = 1;
      g.atkFlatBonus = 0;
      g.omenIndex = 0; // tide
      g.stones = 0;
      g.startAgeMonths = 216; // 18 yrs
      g.elapsedMonths = 0;
      a.comboCount = 0;
      a.styleScore = 0;
      a.weaponPosture = "qinglian";
      a.reversedDomainTimer = 0;
      a.domain = null;
      a.bossRush = null;
      a.astralForm = null;
      a.dungeonMap = null;
      a.runBoons = [];
      a.player.boonOverloadTimer = 0;
      a.player.gourdHasteTimer = 0;
      a.player.gourdCritTimer = 0;
      a.player.petBuffTimer = 0;
      v23.setCelestialTimePhase(0, true); // dawn
      const baseDawn = api.getCombatStats(g);
      g.hp = baseDawn.maxHp;

      // 1. Mind skills delta (equip condition)
      g.loadout.mind = "sword_pierce";
      const withPierce = api.getCombatStats(g);
      g.loadout.mind = "sword_still";
      const withStill = api.getCombatStats(g);
      g.loadout.mind = "talisman_clear";
      const withClear = api.getCombatStats(g);
      g.loadout.mind = "sword_mind";

      // 2. Laws: wealth_power (500 stones -> +20%, 5000 stones -> cap +36%), crit_lotus (+18%/+18%), age_might, karma_resonance
      g.laws = ["wealth_power"];
      g.stones = 500;
      const wp500 = api.getCombatStats(g);
      const wp500Text = api.getLawLiveContributionText(g, "wealth_power");
      g.stones = 5000;
      const wp5000 = api.getCombatStats(g);
      const wp5000Text = api.getLawLiveContributionText(g, "wealth_power");
      g.stones = 0;

      g.laws = ["crit_lotus"];
      const withCritLotus = api.getCombatStats(g);

      g.laws = ["age_might"];
      g.elapsedMonths = 360; // +30 yrs -> 3*6% = 18%
      const am30 = api.getCombatStats(g);
      g.elapsedMonths = 1200; // +100 yrs -> cap 30%
      const amCap = api.getCombatStats(g);
      g.elapsedMonths = 0;

      g.laws = ["karma_resonance"];
      g.choices = { c1: "a", c2: "b", c3: "c" }; // 3*5% = 15%
      const kr3 = api.getCombatStats(g);
      g.choices = { c1: "a", c2: "b", c3: "c", c4: "d", c5: "e", c6: "f", c7: "g" }; // cap 28%
      const krCap = api.getCombatStats(g);
      g.choices = {};
      g.laws = [];

      // 3. Omen wolf_star (+12% crit)
      g.omenIndex = api.CELESTIAL_OMENS.findIndex(o => o.id === "wolf_star");
      const withWolfStar = api.getCombatStats(g);
      g.omenIndex = 0;

      // 4. Celestial phases: dawn (+4 DR), noon (+10% passive), blood_dusk (+12% neutral / +22% demonic, +16% critMult)
      v23.setCelestialTimePhase(1, true); // noon
      const atNoon = api.getCombatStats(g);
      v23.setCelestialTimePhase(2, true); // blood_dusk (neutral)
      const atBloodNeutral = api.getCombatStats(g);
      g.karmaScore = -60; // demonic (+18% karma + 22% blood_dusk = +40%)
      const atBloodDemonic = api.getCombatStats(g);
      v23.setCelestialTimePhase(1, true); // noon demonic (+18% karma + 10% noon = +28%)
      const atNoonDemonic = api.getCombatStats(g);
      g.karmaScore = 0;
      v23.setCelestialTimePhase(0, true); // back to dawn

      // 5. Dungeon climates: sword_wind (+12% haste), thunder_loom (+14% critMult), blood_haze (1.15x activeMult)
      a.dungeonMap = { activeClimate: "sword_wind", currentNodeId: "n0", nodes: { n0: { id: "n0", climate: "sword_wind" } } };
      const climWind = api.getCombatStats(g);
      a.dungeonMap.activeClimate = "thunder_loom";
      const climThunder = api.getCombatStats(g);
      a.dungeonMap.activeClimate = "blood_haze";
      const climBlood = api.getCombatStats(g);
      a.dungeonMap = null;

      // 6. Run boons: blood_intent (+20% crit at <=55% HP), gourd_overload (+28% passive, +22% haste), gold_alchemist (+3%/100 cap +28%)
      a.runBoons = ["blood_intent"];
      g.hp = Math.floor(baseDawn.maxHp * 0.4);
      const boonBloodIntent = api.getCombatStats(g);
      g.hp = baseDawn.maxHp;
      a.runBoons = ["gourd_overload"];
      a.player.boonOverloadTimer = 7;
      a.player.gourdHasteTimer = 7;
      const boonGourd = api.getCombatStats(g);
      a.player.boonOverloadTimer = 0;
      a.player.gourdHasteTimer = 0;
      a.runBoons = ["gold_alchemist"];
      g.stones = 500;
      const boonGold500 = api.getCombatStats(g);
      g.stones = 5000;
      const boonGoldCap = api.getCombatStats(g);
      a.runBoons = [];
      g.stones = 500;
      g.laws = ["wealth_power"];
      api.updateHud();

      // Open cultivate drawer to verify live law contribution UI rendering
      document.getElementById("nav-btn-cultivate").click();
      const lawCardText = (document.querySelector('#cultivate-laws-card [data-law-inspect="wealth_power"]')?.textContent || "").trim();
      api.closeDrawer();

      return {
        P,
        deltas: {
          pierceBaseAtk: withPierce.statBreakdown.baseAtk - baseDawn.statBreakdown.baseAtk,
          stillDr: withStill.dmgReduce - baseDawn.dmgReduce,
          clearDr: withClear.dmgReduce - baseDawn.dmgReduce,
          clearBaseAtk: withClear.statBreakdown.baseAtk - baseDawn.statBreakdown.baseAtk,
          wp500Pct: Number((wp500.statBreakdown.rawPassivePct - baseDawn.statBreakdown.rawPassivePct).toFixed(3)),
          wp5000Pct: Number((wp5000.statBreakdown.rawPassivePct - baseDawn.statBreakdown.rawPassivePct).toFixed(3)),
          critLotusCrit: Number((withCritLotus.crit - baseDawn.crit).toFixed(3)),
          critLotusMult: Number((withCritLotus.critMult - baseDawn.critMult).toFixed(3)),
          am30Pct: Number((am30.statBreakdown.rawPassivePct - baseDawn.statBreakdown.rawPassivePct).toFixed(3)),
          amCapPct: Number((amCap.statBreakdown.rawPassivePct - baseDawn.statBreakdown.rawPassivePct).toFixed(3)),
          kr3Pct: Number((kr3.statBreakdown.rawPassivePct - baseDawn.statBreakdown.rawPassivePct).toFixed(3)),
          krCapPct: Number((krCap.statBreakdown.rawPassivePct - baseDawn.statBreakdown.rawPassivePct).toFixed(3)),
          wolfStarCrit: Number((withWolfStar.crit - baseDawn.crit).toFixed(3)),
          dawnDrVsNoon: baseDawn.dmgReduce - atNoon.dmgReduce,
          noonPassive: Number((atNoon.statBreakdown.rawPassivePct - baseDawn.statBreakdown.rawPassivePct).toFixed(3)),
          bloodNeutralPassive: Number((atBloodNeutral.statBreakdown.rawPassivePct - baseDawn.statBreakdown.rawPassivePct).toFixed(3)),
          bloodDemonicDeltaVsNoon: Number((atBloodDemonic.statBreakdown.rawPassivePct - atNoonDemonic.statBreakdown.rawPassivePct).toFixed(3)),
          bloodCritMult: Number((atBloodNeutral.critMult - baseDawn.critMult).toFixed(3)),
          climWindHaste: Number((climWind.atkHaste - baseDawn.atkHaste).toFixed(3)),
          climThunderCritMult: Number((climThunder.critMult - baseDawn.critMult).toFixed(3)),
          climBloodActiveMult: climBlood.statBreakdown.activeMult,
          boonBloodCrit: Number((boonBloodIntent.crit - baseDawn.crit).toFixed(3)),
          boonGourdPassive: Number((boonGourd.statBreakdown.rawPassivePct - baseDawn.statBreakdown.rawPassivePct).toFixed(3)),
          boonGourdHaste: Number((boonGourd.atkHaste - baseDawn.atkHaste).toFixed(3)),
          boonGold500Pct: Number((boonGold500.statBreakdown.rawPassivePct - baseDawn.statBreakdown.rawPassivePct).toFixed(3)),
          boonGoldCapPct: Number((boonGoldCap.statBreakdown.rawPassivePct - baseDawn.statBreakdown.rawPassivePct).toFixed(3))
        },
        copy: {
          wp500Text,
          wp5000Text,
          lawCardText,
          wealthLaw: api.DAO_LAWS.wealth_power.desc,
          staggerLaw: api.DAO_LAWS.stagger_surge.desc,
          critLotusLaw: api.DAO_LAWS.crit_lotus.desc,
          critLotusBadge: api.LAW_SHORT_BADGE.crit_lotus,
          ageMightLaw: api.DAO_LAWS.age_might.desc,
          karmaResLaw: api.DAO_LAWS.karma_resonance.desc,
          swordPierce: api.SKILLS.sword_pierce.desc,
          swordStill: api.SKILLS.sword_still.desc,
          talismanClear: api.SKILLS.talisman_clear.desc,
          wolfOmen: api.CELESTIAL_OMENS.find(o => o.id === "wolf_star"),
          celPhases: api.CELESTIAL_TIME_PHASES,
          climates: api.DUNGEON_CLIMATES,
          boons: Object.fromEntries(api.RUN_BOONS.map(b => [b.id, b.desc])),
          kbMeditate: api.DEFAULT_KEYBINDS.meditate.label,
          kbPill: api.DEFAULT_KEYBINDS.pill.label,
          orbStanceTip: document.getElementById("orb-stance")?.getAttribute("data-tip") || "",
          orbPillTip: document.getElementById("orb-pill")?.getAttribute("data-tip") || "",
          celBtnTip: document.getElementById("btn-celestial-time")?.getAttribute("data-tip") || "",
          celBtnBadge: (document.querySelector("#btn-celestial-time .v22-key-badge")?.textContent || "").trim()
        }
      };
    });

    const { P, deltas, copy } = audit;
    assert.ok(P && P.laws && P.skills && P.celestialPhases && P.climates && P.runBoons, "COMBAT_RULE_PARAMS must be exposed via getCombatRuleParams()");

    // Verify live stat deltas strictly match COMBAT_RULE_PARAMS
    assert.equal(deltas.pierceBaseAtk, P.skills.sword_pierce.mindAtk);
    assert.equal(deltas.stillDr, P.skills.sword_still.mindDr);
    assert.equal(deltas.clearDr, P.skills.talisman_clear.mindDr);
    assert.equal(deltas.clearBaseAtk, P.skills.talisman_clear.mindAtk);
    assert.equal(deltas.wp500Pct, 0.20);
    assert.equal(deltas.wp5000Pct, P.laws.wealth_power.maxPct);
    assert.equal(deltas.critLotusCrit, P.laws.crit_lotus.crit);
    assert.equal(deltas.critLotusMult, P.laws.crit_lotus.critMult);
    assert.equal(deltas.am30Pct, 0.18);
    assert.equal(deltas.amCapPct, P.laws.age_might.maxPct);
    assert.equal(deltas.kr3Pct, 0.15);
    assert.equal(deltas.krCapPct, P.laws.karma_resonance.maxPct);
    assert.equal(deltas.wolfStarCrit, P.omens.wolf_star.crit);
    assert.equal(deltas.dawnDrVsNoon, P.celestialPhases.dawn.dr);
    assert.equal(deltas.noonPassive, P.celestialPhases.noon.passiveAtkPct);
    assert.equal(deltas.bloodNeutralPassive, P.celestialPhases.blood_dusk.otherPassiveAtkPct);
    assert.equal(deltas.bloodDemonicDeltaVsNoon, Number((P.celestialPhases.blood_dusk.demonicPassiveAtkPct - P.celestialPhases.noon.passiveAtkPct).toFixed(3)));
    assert.equal(deltas.bloodCritMult, P.celestialPhases.blood_dusk.critMult);
    assert.equal(deltas.climWindHaste, P.climates.sword_wind.haste);
    assert.equal(deltas.climThunderCritMult, P.climates.thunder_loom.critMult);
    assert.equal(deltas.climBloodActiveMult, P.climates.blood_haze.playerActiveMult);
    assert.equal(deltas.boonBloodCrit, P.runBoons.blood_intent.crit);
    assert.equal(deltas.boonGourdPassive, P.runBoons.gourd_overload.passiveAtkPct);
    assert.equal(deltas.boonGourdHaste, P.runBoons.gourd_overload.haste);
    assert.equal(deltas.boonGold500Pct, 0.15);
    assert.equal(deltas.boonGoldCapPct, P.runBoons.gold_alchemist.maxPct);

    // Verify all aligned copy strings match live formulas (and stale drifted numbers are gone)
    assert.ok(copy.wealthLaw.includes("+4%") && copy.wealthLaw.includes("+36%") && copy.wealthLaw.includes("常驻") && !copy.wealthLaw.includes("+6%") && !copy.wealthLaw.includes("+85%") && !copy.wealthLaw.includes("战利品"), `wealth_power copy drift: ${copy.wealthLaw}`);
    assert.ok(copy.wp500Text.includes("+20%") && copy.wp500Text.includes("+36%"), `wealth_power live text at 500 stones: ${copy.wp500Text}`);
    assert.ok(copy.wp5000Text.includes("+36%"), `wealth_power live text at cap: ${copy.wp5000Text}`);
    assert.ok(copy.lawCardText.includes("聚宝乾坤") && copy.lawCardText.includes("+20%") && copy.lawCardText.includes("+36%"), `Cultivate law inspection UI must show live contribution: ${copy.lawCardText}`);

    assert.ok(copy.staggerLaw.includes("1.45×") && copy.staggerLaw.includes("1.65×") && copy.staggerLaw.includes("+65%") && copy.staggerLaw.includes("15") && copy.staggerLaw.includes("1.5") && !copy.staggerLaw.includes("+75%"), `stagger_surge copy drift: ${copy.staggerLaw}`);
    assert.ok(copy.critLotusLaw.includes("+18%") && copy.critLotusLaw.includes("78%") && copy.critLotusLaw.includes("2.35×") && !copy.critLotusLaw.includes("+25%") && !copy.critLotusLaw.includes("+22%"), `crit_lotus copy drift: ${copy.critLotusLaw}`);
    assert.equal(copy.critLotusBadge, "暴击 +18%");
    assert.ok(copy.ageMightLaw.includes("+6%") && copy.ageMightLaw.includes("+30%") && !copy.ageMightLaw.includes("+40%"), `age_might copy drift: ${copy.ageMightLaw}`);
    assert.ok(copy.karmaResLaw.includes("+5%") && copy.karmaResLaw.includes("+28%") && !copy.karmaResLaw.includes("+6%"), `karma_resonance copy drift: ${copy.karmaResLaw}`);

    assert.ok(copy.swordPierce.includes("+10") && copy.swordPierce.includes("心法槽") && !copy.swordPierce.includes("+14") && !copy.swordPierce.includes("永久"), `sword_pierce copy drift: ${copy.swordPierce}`);
    assert.ok(copy.swordStill.includes("+8") && copy.swordStill.includes("心法槽") && !copy.swordStill.includes("+6"), `sword_still copy drift: ${copy.swordStill}`);
    assert.ok(copy.talismanClear.includes("+12") && copy.talismanClear.includes("+5") && copy.talismanClear.includes("心法槽") && !copy.talismanClear.includes("+10") && !copy.talismanClear.includes("+6"), `talisman_clear copy drift: ${copy.talismanClear}`);

    assert.ok(copy.wolfOmen.desc.includes("+12%") && copy.wolfOmen.short.includes("+12%") && !copy.wolfOmen.desc.includes("+18%"), `wolf_star copy drift: ${JSON.stringify(copy.wolfOmen)}`);
    const phDawn = copy.celPhases.find(p => p.id === "dawn");
    const phNoon = copy.celPhases.find(p => p.id === "noon");
    const phBlood = copy.celPhases.find(p => p.id === "blood_dusk");
    assert.ok(phDawn.desc.includes("+4") && !phDawn.desc.includes("+10"), `dawn copy drift: ${phDawn.desc}`);
    assert.ok(phNoon.desc.includes("+10%") && phNoon.desc.includes("+25%") && !phNoon.desc.includes("+16%") && !phNoon.desc.includes("+35%"), `noon copy drift: ${phNoon.desc}`);
    assert.ok(phBlood.desc.includes("+22%") && phBlood.desc.includes("+12%") && phBlood.desc.includes("+16%") && phBlood.desc.includes("2%") && !phBlood.desc.includes("+42%") && !phBlood.desc.includes("+28%"), `blood_dusk copy drift: ${phBlood.desc}`);

    assert.ok(copy.climates.sword_wind.desc.includes("+12%") && !copy.climates.sword_wind.desc.includes("+15%"), `sword_wind copy drift: ${copy.climates.sword_wind.desc}`);
    assert.ok(copy.climates.thunder_loom.desc.includes("+14%") && !copy.climates.thunder_loom.desc.includes("+18%"), `thunder_loom copy drift: ${copy.climates.thunder_loom.desc}`);
    assert.ok(copy.climates.blood_haze.desc.includes("+15%") && copy.climates.blood_haze.desc.includes("+18%"), `blood_haze copy drift: ${copy.climates.blood_haze.desc}`);

    assert.ok(copy.boons.blood_intent.includes("+20%") && copy.boons.blood_intent.includes("1.65×") && !copy.boons.blood_intent.includes("+25%"), `blood_intent copy drift: ${copy.boons.blood_intent}`);
    assert.ok(copy.boons.posture_shatter.includes("1.45×") && copy.boons.posture_shatter.includes("+45%") && !copy.boons.posture_shatter.includes("+55%"), `posture_shatter copy drift: ${copy.boons.posture_shatter}`);
    assert.ok(copy.boons.gourd_overload.includes("+28%") && copy.boons.gourd_overload.includes("+22%") && !copy.boons.gourd_overload.includes("+38%") && !copy.boons.gourd_overload.includes("+30%"), `gourd_overload copy drift: ${copy.boons.gourd_overload}`);
    assert.ok(copy.boons.vampiric_qi.includes("6%") && copy.boons.vampiric_qi.includes("8%"), `vampiric_qi copy drift: ${copy.boons.vampiric_qi}`);
    assert.ok(copy.boons.aerial_reign.includes("1.45×") && copy.boons.aerial_reign.includes("+45%") && !copy.boons.aerial_reign.includes("+65%"), `aerial_reign copy drift: ${copy.boons.aerial_reign}`);
    assert.ok(copy.boons.gold_alchemist.includes("+3%") && copy.boons.gold_alchemist.includes("+28%") && !copy.boons.gold_alchemist.includes("+36%"), `gold_alchemist copy drift: ${copy.boons.gold_alchemist}`);

    // Keybind & HUD tooltip checks
    assert.ok(copy.kbMeditate.includes("吐纳") && copy.kbMeditate.includes("渡劫"), `meditate keybind label drift: ${copy.kbMeditate}`);
    assert.ok(copy.kbPill.includes("仙葫") && copy.kbPill.includes("回春丹"), `pill keybind label drift: ${copy.kbPill}`);
    assert.ok(copy.orbStanceTip.includes("Y / 手柄B"), `#orb-stance tip drift: ${copy.orbStanceTip}`);
    assert.ok(copy.orbPillTip.includes("回春丹"), `#orb-pill tip must mention 回春丹 fallback: ${copy.orbPillTip}`);
    assert.ok(copy.celBtnTip.includes("\\键") && !copy.celBtnTip.includes("`键") && !copy.celBtnTip.includes("+42%"), `#btn-celestial-time tip drift: ${copy.celBtnTip}`);
    assert.equal(copy.celBtnBadge, "\\", `#btn-celestial-time key badge must be \\, got: ${copy.celBtnBadge}`);
    await ctx.close();
  });

  // ==================== Q1 (F07–F13) COMBAT CALM, PERSISTED PENDING REWARDS, PAUSE OWNERSHIP & NOTICE BUS ====================
  await runSuite("Q1-1", "Q1 F07+F10 混战背包满延迟、刷新/返标题持久化、清场宽限放行、写入失败回滚与沙盒隔离", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q1-1", true);

    // 1. Bag 24/24 with live wolves + hostile projectile -> acquire 3 gear items -> no pause, no modal, 3 persisted pendingRewards, badge shows 3
    const hotCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.stones = 200;
      s.game.gearBag = Array.from({ length: api.GEAR_BAG_LIMIT }, () => api.rollGearItem(1, 0, "weapon"));
      s.arena.projectiles.push({ x: 600, y: 400, vx: 1, vy: 0, r: 8, dmg: 10, friendly: false, life: 5 });
      for (let i = 0; i < 3; i++) {
        api.acquireGearItem(api.rollGearItem(2, 1, "weapon"));
      }
      return {
        paused: s.arena.paused,
        modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open")),
        pendingLen: api.getPendingRewards().length,
        overflowCount: api.getPendingOverflowCount(),
        badgeVisible: document.getElementById("btn-pending-rewards")?.style.display !== "none",
        badgeText: document.getElementById("pending-rewards-count")?.textContent,
        stones: s.game.stones,
        calm: api.isCombatCalm()
      };
    });
    assert.equal(hotCheck.paused, false, "Acquiring overflow gear during live combat must NOT pause arena");
    assert.equal(hotCheck.modalOpen, false, "Acquiring overflow gear during live combat must NOT open modal");
    assert.equal(hotCheck.pendingLen, 3, `Expected 3 persisted pendingRewards, got ${hotCheck.pendingLen}`);
    assert.equal(hotCheck.overflowCount, 3);
    assert.equal(hotCheck.badgeVisible, true, "#btn-pending-rewards must be visible when pendingRewards > 0");
    assert.equal(hotCheck.badgeText, "3");
    assert.equal(hotCheck.stones, 200, "Must NOT auto-smelt");
    assert.equal(hotCheck.calm, false);

    // 2. Survives page reload AND return-to-title -> continue
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save");
    await page.click("#btn-continue-save");
    await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    const afterReloadCount = await page.evaluate(() => window.__CHENYUAN_V25__.getPendingRewards().length);
    assert.equal(afterReloadCount, 3, "All 3 pendingRewards must survive page reload");

    await page.click("#btn-open-settings");
    await page.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await page.click('#modal-backdrop.open [data-sys-tab="controls"]');
    await page.waitForSelector('#modal-backdrop.open [data-action="return-title-safe"]');
    await page.click('[data-action="return-title-safe"]');
    await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display !== "none");
    await page.click("#btn-continue-save");
    await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    const afterTitleReturn = await page.evaluate(() => window.__CHENYUAN_V25__.getPendingRewards().length);
    assert.equal(afterTitleReturn, 3, "All 3 pendingRewards must survive return-title-safe without being wiped");

    // 3. Sandbox isolation: entering sandbox, acquiring overflow, exiting sandbox must preserve formal 3 pendingRewards intact
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.enterSandboxMode();
      const s = api.getState();
      s.game.gearBag = Array.from({ length: api.GEAR_BAG_LIMIT }, () => api.rollGearItem(1, 0, "weapon"));
      api.acquireGearItem(api.rollGearItem(3, 2, "weapon"));
      api.exitSandboxMode();
    });
    const afterSandbox = await page.evaluate(() => ({
      sandbox: window.__CHENYUAN_V25__.isSandboxMode(),
      pendingLen: window.__CHENYUAN_V25__.getPendingRewards().length,
      stones: window.__CHENYUAN_V25__.getState().game.stones
    }));
    assert.equal(afterSandbox.sandbox, false);
    assert.equal(afterSandbox.pendingLen, 3, "Sandbox mode must NEVER corrupt or leak into formal game.pendingRewards");
    assert.equal(afterSandbox.stones, 200);

    // 4. Clearing enemies while hostile projectile still exists keeps calm=false; once projectile clears + 0.8s grace, modal opens!
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.enemies = [];
      s.arena.projectiles = [{ x: 650, y: 420, vx: 0, vy: 0, r: 8, dmg: 12, friendly: false, life: 4 }];
      api.requestCalmReevaluation();
    });
    await page.waitForTimeout(300);
    const blockedByHazard = await page.evaluate(() => ({
      calm: window.__CHENYUAN_V25__.isCombatCalm(),
      hasHazards: window.__CHENYUAN_V25__.hasHostileHazards(),
      modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open"))
    }));
    assert.equal(blockedByHazard.hasHazards, true);
    assert.equal(blockedByHazard.calm, false);
    assert.equal(blockedByHazard.modalOpen, false, "Lingering hostile projectile must keep modal deferred");

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.projectiles = [];
      s.arena.calmT = 0;
      api.requestCalmReevaluation();
    });
    await page.waitForSelector("#modal-backdrop.open #btn-overflow-smelt-new", { timeout: 3000 });

    // 5. Write-failure rollback: mock localStorage.setItem throwing QuotaExceededError -> commit rolls back, keeps item retryable, shows #hud-save-alert
    await page.evaluate(() => {
      window.__origSetItemQ1 = Storage.prototype.setItem;
      Storage.prototype.setItem = function () {
        const err = new Error("QuotaExceeded");
        err.name = "QuotaExceededError";
        throw err;
      };
    });
    await page.click("#btn-overflow-smelt-new");
    await page.waitForTimeout(150);
    const afterWriteFail = await page.evaluate(() => ({
      stones: window.__CHENYUAN_V25__.getState().game.stones,
      pendingLen: window.__CHENYUAN_V25__.getPendingRewards().length,
      alertVisible: document.getElementById("hud-save-alert")?.style.display !== "none",
      writeErr: Boolean(window.__CHENYUAN_V25__.getPersistenceState().storageWriteError)
    }));
    assert.equal(afterWriteFail.stones, 200, "Failed save commit must roll back stone reward");
    assert.equal(afterWriteFail.pendingLen, 3, "Failed save commit must preserve all 3 pendingRewards for retry");
    assert.equal(afterWriteFail.alertVisible, true, "#hud-save-alert must remain visible on write failure");
    assert.equal(afterWriteFail.writeErr, true);

    // Restore storage -> retry via #btn-pending-rewards succeeds!
    await page.evaluate(() => {
      if (window.__origSetItemQ1) Storage.prototype.setItem = window.__origSetItemQ1;
    });
    await page.click("#btn-pending-rewards");
    await page.waitForSelector("#modal-backdrop.open #btn-overflow-smelt-new");
    await page.click("#btn-overflow-smelt-new");
    await page.waitForTimeout(150);
    const afterRetry = await page.evaluate(() => ({
      stones: window.__CHENYUAN_V25__.getState().game.stones,
      pendingLen: window.__CHENYUAN_V25__.getPendingRewards().length
    }));
    assert.ok(afterRetry.stones > 200, "Retrying after storage recovery must grant smelt stones");
    assert.equal(afterRetry.pendingLen, 2, "Retrying one item must decrement pendingRewards from 3 to 2");
    await ctx.close();
  });

  await runSuite("Q1-2", "Q1 F09 实例化暂停所有权(pauseTokens)与 N0/N1 弹窗优先级防覆盖", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q1-2", true);

    // 1. Nested overlays: drawer + modal + photo mode never prematurely unpause until ALL tokens release
    const tokenRes = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      // Open drawer -> 1 token
      document.getElementById("nav-btn-cultivate").click();
      const t1 = { paused: s.arena.paused, count: api.getPauseTokens().length };
      // Open modal over drawer -> 2 tokens
      api.openObjectivesModal();
      const t2 = { paused: s.arena.paused, count: api.getPauseTokens().length };
      // Replace modal with another modal (world map) -> swap never dips to 0!
      api.openWorldMapModal();
      const tSwap = { paused: s.arena.paused, count: api.getPauseTokens().length };
      // Close modal while acquiring custom pause token (simulating defeat/photo overlap) -> stays paused
      const extraTok = api.acquirePauseToken("test_overlay", "nested");
      api.closeModal();
      const tAfterModalClose = { paused: s.arena.paused, count: api.getPauseTokens().length };
      api.releasePauseToken(extraTok);
      api.closeDrawer();
      const tAllClear = { paused: s.arena.paused, count: api.getPauseTokens().length };
      return { t1, t2, tSwap, tAfterModalClose, tAllClear };
    });
    assert.equal(tokenRes.t1.paused, true);
    assert.ok(tokenRes.t1.count >= 1);
    assert.equal(tokenRes.t2.paused, true);
    assert.equal(tokenRes.tSwap.paused, true);
    assert.ok(tokenRes.tSwap.count >= 1);
    assert.equal(tokenRes.tAfterModalClose.paused, true, "Closing modal while another pause token is active must NOT unpause arena");
    assert.equal(tokenRes.tAllClear.paused, false, "Releasing all pause tokens must cleanly unpause arena");
    assert.equal(tokenRes.tAllClear.count, 0);

    // 2. N0 preemption of N1 (lifespan_exhausted) reverts status to "pending" WITHOUT setting lifespanExhaustedPromptDismissed,
    //    and lower-priority N1 cannot overwrite active N0 (defeat / save_conflict)!
    const priRes = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      api.enterSanctumHub();
      s.game.realm = "mortal";
      s.game.startAgeMonths = 216;
      s.game.elapsedMonths = 600; // exhausted
      const rec = api.enqueuePendingReward({ kind: "lifespan_exhausted", payload: {}, persist: true });
      api.openPendingRewardsManually();
      const beforePreempt = {
        modalKind: api.getActiveModalKind(),
        status: api.getPendingRewards().find(r => r.eventId === rec.eventId)?.status
      };
      // Preempt with N0 defeat modal
      api.openDefeatDecisionModal(false);
      const afterPreempt = {
        modalKind: api.getActiveModalKind(),
        dismissed: api.isLifespanExhaustedDismissed(),
        status: api.getPendingRewards().find(r => r.eventId === rec.eventId)?.status
      };
      // Attempt to overwrite N0 defeat with lower-priority N1 gear_overflow -> must be REJECTED!
      const extraGear = api.rollGearItem(2, 1, "weapon");
      const gearRec = api.enqueuePendingReward({ kind: "gear_overflow", payload: { item: extraGear }, persist: false });
      const manualAttempt = api.openPendingRewardsManually();
      const stillDefeatKind = api.getActiveModalKind();
      const gearRecStatus = api.getPendingRewards().find(r => r.eventId === gearRec.eventId)?.status;
      return { beforePreempt, afterPreempt, manualAttempt, stillDefeatKind, gearRecStatus };
    });
    assert.equal(priRes.beforePreempt.modalKind, "lifespan_exhausted");
    assert.equal(priRes.beforePreempt.status, "active");
    assert.equal(priRes.afterPreempt.modalKind, "defeat", "N0 defeat must preempt N1 lifespan_exhausted");
    assert.equal(priRes.afterPreempt.dismissed, false, "Preempting lifespan_exhausted by N0 must NEVER mark it dismissed");
    assert.equal(priRes.afterPreempt.status, "pending", "Preempted lifespan_exhausted must revert to status='pending'");
    assert.equal(priRes.manualAttempt, false, "Manual pending rewards open must be blocked during active N0");
    assert.equal(priRes.stillDefeatKind, "defeat", "N1 modal must NOT overwrite active N0 modal");
    assert.equal(priRes.gearRecStatus, "pending");
    await ctx.close();
  });

  await runSuite("Q1-3", "Q1 F08 洞府清理残留侧模式状态与五类敌方危险物静默判定", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q1-3", true);

    const res = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      // Dirty all side-mode flags + bladeClash, then enterSanctumHub -> all must clear and calm must become true!
      s.arena.cloudFlight = { active: true, progress: 30, deflectedCount: 0, barrelRolls: 0 };
      s.arena.sectDefense = { active: true };
      s.arena.celestialSpire = { active: true, floor: 1, roomType: "clash" };
      s.arena.customSeedRun = { active: true };
      s.arena.bladeClash = { foe: null, t: 0.2, dur: 1.5 };
      const calmDirty = api.isCombatCalm();
      api.enterSanctumHub();
      const afterHub = {
        cloudFlight: s.arena.cloudFlight,
        sectDefense: s.arena.sectDefense,
        celestialSpire: s.arena.celestialSpire,
        customSeedRun: s.arena.customSeedRun,
        bladeClash: s.arena.bladeClash,
        calm: api.isCombatCalm()
      };

      // Verify each of the 5 hostile hazards individually sets hasHostileHazards()=true & isCombatCalm()=false
      s.arena.projectiles = [{ x: 500, y: 400, vx: 1, vy: 0, friendly: false, life: 2 }];
      const hProj = { haz: api.hasHostileHazards(), calm: api.isCombatCalm() };
      s.arena.projectiles = [];

      s.arena.shockRings = [{ x: 500, y: 400, r: 40, maxR: 200, hitPlayer: false }];
      const hRing = { haz: api.hasHostileHazards(), calm: api.isCombatCalm() };
      s.arena.shockRings = [];

      s.arena.groundSweeps = [{ x: 500, y: 400, r: 30, maxR: 220, dmg: 18, hitPlayer: false, vaulted: false }];
      const hSweep = { haz: api.hasHostileHazards(), calm: api.isCombatCalm() };
      s.arena.groundSweeps = [];

      s.arena.bossBeams = [{ x: 500, y: 400, t: 0.1, dur: 1.0, dmg: 20 }];
      const hBeam = { haz: api.hasHostileHazards(), calm: api.isCombatCalm() };
      s.arena.bossBeams = [];

      s.arena.bladeClash = { t: 0.2, dur: 1.2 };
      const hClash = { haz: api.hasHostileHazards(), calm: api.isCombatCalm() };
      s.arena.bladeClash = null;

      const calmClean = api.isCombatCalm();
      return { calmDirty, afterHub, hProj, hRing, hSweep, hBeam, hClash, calmClean };
    });

    assert.equal(res.calmDirty, false);
    assert.equal(res.afterHub.cloudFlight, null);
    assert.equal(res.afterHub.sectDefense, null);
    assert.equal(res.afterHub.celestialSpire, null);
    assert.equal(res.afterHub.customSeedRun, null);
    assert.equal(res.afterHub.bladeClash, null);
    assert.equal(res.afterHub.calm, true, "enterSanctumHub must clear all stale mode flags so isCombatCalm() becomes true");

    for (const [label, sample] of [
      ["hostile projectile", res.hProj],
      ["shockRing", res.hRing],
      ["groundSweep", res.hSweep],
      ["bossBeam", res.hBeam],
      ["bladeClash", res.hClash]
    ]) {
      assert.equal(sample.haz, true, `${label} must set hasHostileHazards()=true`);
      assert.equal(sample.calm, false, `${label} must keep isCombatCalm()=false`);
    }
    assert.equal(res.calmClean, true, "Clearing all hostile hazards must restore isCombatCalm()=true");
    await ctx.close();
  });

  await runSuite("Q1-4", "Q1 F12 战前剧情(enter_sect / boss_pre_stage0)先播后刷怪与幂等防重刷", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q1-4", true);

    // 1. enter_sect: enemies MUST be 0 while cutscene is open; skipping spawns wave ONCE
    const enterSectDuring = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.openingChoice = "help";
      s.game.realm = "qi";
      if (s.game.seenCutscenes) delete s.game.seenCutscenes.enter_sect;
      api.initArenaStage(1, false);
      return {
        dlgOpen: Boolean(document.getElementById("story-dialogue-bar")?.classList.contains("open")),
        enemiesDuringCutscene: s.arena.enemies.length
      };
    });
    assert.equal(enterSectDuring.dlgOpen, true, "First-time enter_sect must open dialogue bar");
    assert.equal(enterSectDuring.enemiesDuringCutscene, 0, "A6: Enemies must NOT spawn until enter_sect cutscene finishes/skips");

    // Rapid double-skip click must spawn wave exactly ONCE
    await page.evaluate(() => {
      const btn = document.getElementById("btn-dlg-skip");
      if (btn) { btn.click(); btn.click(); }
    });
    await page.waitForTimeout(180);
    const enterSectAfter = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return {
        dlgOpen: Boolean(document.getElementById("story-dialogue-bar")?.classList.contains("open")),
        enemiesAfterSkip: s.arena.enemies.length
      };
    });
    assert.equal(enterSectAfter.dlgOpen, false);
    assert.ok(enterSectAfter.enemiesAfterSkip >= 1 && enterSectAfter.enemiesAfterSkip <= 6, `Wave must spawn once after skip, got ${enterSectAfter.enemiesAfterSkip}`);

    // 2. boss_pre_stage0: Boss MUST NOT spawn while boss_pre_stage0 cutscene is open; spawns ONCE after skip
    const bossPreDuring = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.openingChoice = "help";
      if (s.game.seenCutscenes) delete s.game.seenCutscenes.boss_pre_stage0;
      api.initArenaStage(0, false);
      s.arena.enemies = [];
      s.arena.waveIdx = 4;
      if (s.arena.dungeonMap) {
        const bossNode = Object.values(s.arena.dungeonMap.nodes).find(n => n.type === "boss");
        if (bossNode) s.arena.dungeonMap.currentNodeId = bossNode.id;
      }
      api.spawnCurrentWave();
      return {
        dlgOpen: Boolean(document.getElementById("story-dialogue-bar")?.classList.contains("open")),
        enemiesDuringBossPre: s.arena.enemies.length
      };
    });
    assert.equal(bossPreDuring.dlgOpen, true, "First-time boss_pre_stage0 must open dialogue bar");
    assert.equal(bossPreDuring.enemiesDuringBossPre, 0, "A7: Boss must NOT spawn until boss_pre_stage0 cutscene finishes/skips");

    await page.click("#btn-dlg-skip");
    await page.waitForTimeout(180);
    const bossPreAfter = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return {
        bossCount: s.arena.enemies.filter(e => e.isBoss).length,
        totalEnemies: s.arena.enemies.length
      };
    });
    assert.equal(bossPreAfter.bossCount, 1, `Boss must spawn exactly once after boss_pre_stage0 skip, got ${bossPreAfter.bossCount}`);

    // 3. Stage epoch guard: switching to Sanctum while an unseen enter_secret cutscene is open must cancel stale wave spawn!
    const staleGuard = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "foundation";
      if (s.game.seenCutscenes) delete s.game.seenCutscenes.enter_secret;
      api.initArenaStage(2, false);
      const opened = Boolean(document.getElementById("story-dialogue-bar")?.classList.contains("open"));
      api.enterSanctumHub();
      return {
        opened,
        sanctum: s.arena.sanctumMode,
        hostilesInSanctum: s.arena.enemies.filter(e => e && e.hp > 0 && !e.isDummy).length
      };
    });
    assert.equal(staleGuard.opened, true);
    assert.equal(staleGuard.sanctum, true);
    assert.equal(staleGuard.hostilesInSanctum, 0, "Stage transition must cancel stale pre-battle cutscene spawn via stageEpoch");
    await ctx.close();
  });

  await runSuite("Q1-5", "Q1 F13 对比卡战中隐藏、250ms防误点、熔炼二步确认与战中7/8/9双击确认", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q1-5", true);

    // 1. Compare card hidden during combat-hot, revealed on calm with 250ms reveal click-guard, and smelt requires 2-step confirmation
    const cmpHot = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.stones = 100;
      const item = api.rollGearItem(2, 2, "weapon");
      item.name = "玄品·测试赤霄剑";
      item.sell = 55;
      api.acquireGearItem(item);
      const card = document.getElementById("gear-compare-card");
      return {
        combatHot: document.body.classList.contains("combat-hot"),
        cardStyleDisplay: card ? getComputedStyle(card).display : "none"
      };
    });
    assert.equal(cmpHot.combatHot, true);
    assert.equal(cmpHot.cardStyleDisplay, "none", "#gear-compare-card must be hidden during combat-hot");

    // Clear combat & trigger calm reveal (non-sanctum so 250ms click-guard activates!)
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.enemies = [];
      s.arena.projectiles = [];
      api.requestCalmReevaluation({ immediate: true });
    });
    await page.waitForSelector('#gear-compare-card [data-action="compare-smelt-new"]', { state: "visible" });

    // Immediate click within 250ms click-guard must NOT arm or destroy item
    const immediateSmeltCheck = await page.evaluate(() => {
      const btn = document.querySelector('#gear-compare-card [data-action="compare-smelt-new"]');
      const guardBefore = window.__CHENYUAN_V25__.getCompareCardGuardState();
      if (btn) btn.click();
      const s = window.__CHENYUAN_V25__.getState();
      return {
        hadGuard: guardBefore.guardUntil > performance.now() - 50,
        stones: s.game.stones,
        bagHasItem: s.game.gearBag.some(i => i.name === "玄品·测试赤霄剑"),
        confirmArmed: Boolean(window.__CHENYUAN_V25__.getCompareCardGuardState().confirm)
      };
    });
    assert.equal(immediateSmeltCheck.stones, 100, "250ms click-guard must block premature click-through");
    assert.equal(immediateSmeltCheck.bagHasItem, true);
    assert.equal(immediateSmeltCheck.confirmArmed, false);

    // Wait past 250ms -> 1st click arms 2-step confirmation (shows item name & stone yield, does NOT smelt yet!)
    await page.waitForTimeout(300);
    await page.click('#gear-compare-card [data-action="compare-smelt-new"]');
    const afterFirstClick = await page.evaluate(() => {
      const btn = document.querySelector('#gear-compare-card [data-action="compare-smelt-new"]');
      const cardTxt = document.getElementById("gear-compare-card")?.textContent || "";
      const s = window.__CHENYUAN_V25__.getState();
      return {
        btnClass: btn ? btn.className : "",
        btnText: btn ? btn.textContent : "",
        cardTxt,
        stones: s.game.stones,
        bagHasItem: s.game.gearBag.some(i => i.name === "玄品·测试赤霄剑")
      };
    });
    assert.ok(afterFirstClick.btnClass.includes("btn-ghost") && afterFirstClick.btnClass.includes("confirming"), `Smelt button must use secondary confirming style, got: ${afterFirstClick.btnClass}`);
    assert.ok(afterFirstClick.btnText.includes("确认熔炼") && afterFirstClick.btnText.includes("玄品·测试赤霄剑") && afterFirstClick.btnText.includes("55"), `Confirm label must show item name and stone yield: ${afterFirstClick.btnText}`);
    assert.equal(afterFirstClick.stones, 100, "First click on smelt must NOT destroy item");
    assert.equal(afterFirstClick.bagHasItem, true);

    // 2nd click confirms and smelts!
    await page.click('#gear-compare-card [data-action="compare-smelt-new"]');
    const afterSecondClick = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return {
        stones: s.game.stones,
        bagHasItem: s.game.gearBag.some(i => i.name === "玄品·测试赤霄剑")
      };
    });
    assert.equal(afterSecondClick.stones, 155, "Second click must confirm smelt and grant +55 stones");
    assert.equal(afterSecondClick.bagHasItem, false);

    // 2. Digit7/8/9 require 2.5s double-tap arming during combat-hot, and open immediately when calm
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "spirit";
      api.spawnSingleEnemy("wolf", 920, 460, 1.0, false);
      api.focusBattlefield();
      api.requestCalmReevaluation();
    });
    await page.keyboard.press("Digit7");
    await page.waitForTimeout(80);
    const digit7First = await page.evaluate(() => ({
      modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open")),
      toast: Array.from(document.querySelectorAll("#toast-container .toast-pill")).map(x => x.textContent).join(" ")
    }));
    assert.equal(digit7First.modalOpen, false, "First press of Digit7 during combat-hot must arm, not open modal");
    assert.ok(digit7First.toast.includes("再按一次"), `Expected double-tap arm toast, got: ${digit7First.toast}`);
    await page.keyboard.press("Digit7");
    await page.waitForSelector("#modal-backdrop.open", { timeout: 2000 });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));

    // Clear enemies -> Digit7 opens immediately on single press when calm!
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.enemies = [];
      api.requestCalmReevaluation({ immediate: true });
      api.focusBattlefield();
    });
    await page.keyboard.press("Digit7");
    await page.waitForSelector("#modal-backdrop.open", { timeout: 2000 });
    await ctx.close();
  });

  await runSuite("Q1-6", "Q1 F11 提示密度三档持久化、限流汇总、危招/存档警示保留与金灵A3持久化不静默自领", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q1-6", true);

    // 1. Settings -> Accessibility -> switch combatNoticeLevel to "minimal" and verify persistence across reload
    await page.click("#btn-open-settings");
    await page.waitForSelector('#modal-backdrop.open [data-sys-tab="accessibility"]');
    await page.click('[data-sys-tab="accessibility"]');
    await page.waitForSelector("#btn-notice-level-minimal");
    await page.click("#btn-notice-level-minimal");
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().a11ySettings.combatNoticeLevel), "minimal");

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save");
    await page.click("#btn-continue-save");
    await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    assert.equal(
      await page.evaluate(() => window.__CHENYUAN_V25__.getState().a11ySettings.combatNoticeLevel),
      "minimal",
      "combatNoticeLevel='minimal' must persist across reload"
    );

    // 2. Minimal mode preserves critical N0 save alerts & Boss perilous banners, suppresses pickup floats, throttles C12, and summarizes combatInbox on calm
    const noticeRes = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.floats = [];
      // Material pickup float suppressed in minimal, Boss perilous preserved!
      api.addFloat("+灵草 ×2", 500, 400, "#4ad2b8", 13, false, { banner: false, kind: "pickup" });
      api.addFloat("⚠ 妖王危招", 500, 400, "#ff5e57", 17, true, { banner: true, perilous: true });
      const floatsSnap = s.arena.floats.map(f => ({ text: f.text, isPerilous: f.isPerilous }));

      // N0 critical toast NEVER suppressed in minimal
      const critShown = api.showToast("⚠ 测试关键存档告警", { critical: true, key: "q1_test_crit", throttleMs: 6000 });
      // C12 key throttle: 1st shows, 2nd within 4s throttled
      const c12First = api.showToast("💧 剑元不足测试", { tier: 1, key: "q1_c12_test", throttleMs: 4000 });
      const c12Second = api.showToast("💧 剑元不足测试", { tier: 1, key: "q1_c12_test", throttleMs: 4000 });

      // Tier 2 combat notice routed into combatInbox during combat-hot
      const t2Shown = api.showToast("✦ 仙装战报测试", { tier: 2, category: "gear" });
      const inboxHot = api.getCombatInbox();

      // Switch to "full" mode: N1 choice modals MUST STILL defer during hot combat!
      s.a11ySettings.combatNoticeLevel = "full";
      s.game.gearBag = Array.from({ length: api.GEAR_BAG_LIMIT }, () => api.rollGearItem(1, 0, "weapon"));
      api.acquireGearItem(api.rollGearItem(2, 1, "weapon"));
      const modalOpenInFullHot = Boolean(document.getElementById("modal-backdrop")?.classList.contains("open"));

      // 3. Golden Spirit A3: killing isTreasure while another modal/tribulation is active MUST NOT silently auto-grant a law; must persist iconic_draft in game.pendingRewards!
      const lawsBefore = s.game.laws.slice();
      s.arena.tribulation = { nextRealm: "qi", totalBolts: 3, boltsLeft: 1, cooldown: 1, parryCount: 0, strikes: [] };
      const goldSpirit = {
        uid: "test_treasure_1", id: "treasure_spirit", name: "聚宝金灵", art: "item_gold_spirit",
        x: 700, y: 450, hp: 10, maxHp: 10, isTreasure: true, isBoss: false
      };
      s.arena.enemies.push(goldSpirit);
      api.handleEnemyDeath(goldSpirit);
      s.arena.tribulation = null;
      const lawsAfter = s.game.laws.slice();
      const iconicPending = api.getPendingRewards().filter(r => r.kind === "iconic_draft" && r.payload.source === "golden_spirit");

      return {
        floatsSnap,
        critShown,
        c12First,
        c12Second,
        t2Shown,
        inboxHotUnread: inboxHot.unread,
        modalOpenInFullHot,
        lawsBeforeLen: lawsBefore.length,
        lawsAfterLen: lawsAfter.length,
        iconicPendingLen: iconicPending.length
      };
    });

    assert.equal(noticeRes.floatsSnap.length, 1, "Minimal mode must suppress pickup float while keeping Boss perilous float");
    assert.equal(noticeRes.floatsSnap[0].isPerilous, true);
    assert.equal(noticeRes.critShown, true, "Critical N0 alert must NEVER be suppressed in minimal mode");
    assert.equal(noticeRes.c12First, true);
    assert.equal(noticeRes.c12Second, false, "Repeated C12 toast within 4s must be throttled");
    assert.equal(noticeRes.t2Shown, false, "Tier 2 combat notice must route to combatInbox in minimal/lite");
    assert.ok(noticeRes.inboxHotUnread >= 1);
    assert.equal(noticeRes.modalOpenInFullHot, false, "'full' notice density must STILL enforce F08/F10 calm gating for N1 choice modals");
    assert.equal(noticeRes.lawsAfterLen, noticeRes.lawsBeforeLen, "A3 Golden Spirit must NEVER silently auto-grant a Dao Law");
    assert.equal(noticeRes.iconicPendingLen, 1, "A3 Golden Spirit must enqueue persisted iconic_draft in game.pendingRewards");

    // 4. Clearing combat triggers combatInbox concise calm summary toast and resets unread counter
    const calmSummary = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.enemies = [];
      s.arena.projectiles = [];
      api.requestCalmReevaluation({ immediate: true });
      return {
        unreadAfter: api.getCombatInbox().unread,
        toasts: Array.from(document.querySelectorAll("#toast-container .toast-pill")).map(x => x.textContent)
      };
    });
    assert.equal(calmSummary.unreadAfter, 0, "Calm flush must consume unread combatInbox summary");
    assert.ok(calmSummary.toasts.some(t => t.includes("本波战报")), `Expected concise calm summary toast, got: ${calmSummary.toasts.join(" | ")}`);
    await ctx.close();
  });

  // ============================================================================
  // Q2-1 (F14): UI SEMANTIC TOKENS, Z-INDEX LADDER, DUAL-ENCODING & MODAL SHELL
  // ============================================================================
  await runSuite("Q2-1", "F14 UI semantic tokens, z-index ladder, dual-encoding & standardized modal shell", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q2-1", true);
    try {
      const tokenAudit = await page.evaluate(() => {
        const rootStyle = getComputedStyle(document.documentElement);
        const getVar = (k) => rootStyle.getPropertyValue(k).trim();
        const getZ = (sel) => {
          const el = document.querySelector(sel);
          return el ? Number(getComputedStyle(el).zIndex) : NaN;
        };
        return {
          vars: {
            cMain: getVar("--c-main"),
            cSide: getVar("--c-side"),
            cCompanion: getVar("--c-companion"),
            cEcon: getVar("--c-econ"),
            cSystem: getVar("--c-system"),
            cDanger: getVar("--c-danger"),
            fsXs: getVar("--fs-xs"),
            fs2xl: getVar("--fs-2xl"),
            zModal: getVar("--z-modal"),
            zToast: getVar("--z-toast"),
            zDialogue: getVar("--z-dialogue"),
            zAlert: getVar("--z-alert")
          },
          z: {
            tooltip: getZ("#ling-tooltip"),
            toast: getZ("#toast-container"),
            modal: getZ("#modal-backdrop"),
            dialogue: getZ("#story-dialogue-bar"),
            alert: getZ("#hud-save-alert"),
            compare: getZ("#gear-compare-card"),
            unlock: getZ("#new-unlock-card"),
            drawer: getZ("#jade-panel"),
            nav: getZ("#bottom-nav"),
            hud: getZ("#top-hud")
          }
        };
      });

      for (const [k, v] of Object.entries(tokenAudit.vars)) {
        assert.ok(v && v.length > 0, `CSS custom property ${k} must be defined on :root`);
      }
      const z = tokenAudit.z;
      assert.ok(
        z.tooltip > z.toast &&
        z.toast > z.modal &&
        z.modal > z.dialogue &&
        z.dialogue > z.alert &&
        z.alert > z.compare &&
        z.compare > z.unlock &&
        z.unlock > z.drawer &&
        z.drawer > z.nav &&
        z.nav > z.hud,
        `Canonical z-index stacking ladder violated: ${JSON.stringify(z)}`
      );

      // Open World Map (info tier) and verify standardized shell + dual-encoded badges
      await page.click("#btn-world-map");
      await page.waitForSelector("#modal-backdrop.open .modal-header");
      const mapShell = await page.evaluate(() => {
        const box = document.getElementById("modal-content");
        const badges = Array.from(box.querySelectorAll(".sem-badge[data-sem][data-shape]")).map(el => ({
          sem: el.getAttribute("data-sem"),
          shape: el.getAttribute("data-shape"),
          txt: el.textContent.trim()
        }));
        return {
          tier: box.getAttribute("data-tier"),
          hasHeader: !!box.querySelector(".modal-header"),
          hasBody: !!box.querySelector(".modal-body"),
          hasFooter: !!box.querySelector(".modal-footer"),
          badgeCount: badges.length,
          badges
        };
      });
      assert.equal(mapShell.tier, "info");
      assert.equal(mapShell.hasHeader, true);
      assert.equal(mapShell.hasBody, true);
      assert.equal(mapShell.hasFooter, true);
      assert.ok(mapShell.badgeCount >= 2, "World Map modal must render dual-encoded .sem-badge tags");
      await page.keyboard.press("Escape");

      // Open Defeat modal (critical tier) + reduced-motion suppression check
      const defeatShell = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        document.documentElement.classList.add("reduced-motion");
        api.openDefeatDecisionModal(false);
        const box = document.getElementById("modal-content");
        const badge = box.querySelector('.sem-badge[data-sem="danger"][data-shape="triangle"]');
        const animDur = badge ? getComputedStyle(badge).animationDuration : "";
        return {
          tier: box.getAttribute("data-tier"),
          hasHeader: !!box.querySelector(".modal-header"),
          hasBody: !!box.querySelector(".modal-body"),
          hasFooter: !!box.querySelector(".modal-footer"),
          hasDangerTriangle: !!badge,
          animDur
        };
      });
      assert.equal(defeatShell.tier, "critical");
      assert.equal(defeatShell.hasHeader, true);
      assert.equal(defeatShell.hasBody, true);
      assert.equal(defeatShell.hasFooter, true);
      assert.equal(defeatShell.hasDangerTriangle, true);
      assert.ok(
        defeatShell.animDur && parseFloat(defeatShell.animDur) <= 0.001,
        `html.reduced-motion must suppress animationDuration on .sem-badge, got ${defeatShell.animDur}`
      );
    } finally {
      await ctx.close();
    }
  });

  // ============================================================================
  // Q2-2 (F15): UNIFIED NAV_MODEL, PREVIEW-VS-ENTER, CH5 MARKER & D03 ROUTES
  // ============================================================================
  await runSuite("Q2-2", "F15 unified NAV_MODEL, World Map preview-vs-enter, Ch5 marker & modal refresh fix", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q2-2", true);
    try {
      // Unlock Qi realm so stg_1 is unlocked while stg_4 stays locked
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "qi";
        if (s.game.seenCutscenes) s.game.seenCutscenes.enter_sect = true;
        api.updateHud();
      });

      // Open World Map via #btn-world-map (M)
      await page.click("#btn-world-map");
      await page.waitForSelector('#modal-backdrop.open [data-map-node="stg_1"]');
      const beforeStage = await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.stageIdx);

      // Click stg_1 node -> MUST preview ONLY without traveling or closing modal
      await page.click('#modal-backdrop.open [data-map-node="stg_1"]');
      const previewRes = await page.evaluate(() => {
        const strip = document.getElementById("world-map-preview-strip");
        const enterBtn = document.getElementById("btn-map-enter-node");
        return {
          modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
          stageIdx: window.__CHENYUAN_V25__.getState().arena.stageIdx,
          previewNode: strip?.getAttribute("data-preview-node"),
          enterTarget: enterBtn?.getAttribute("data-map-enter"),
          enterDisabled: !!enterBtn?.disabled
        };
      });
      assert.equal(previewRes.modalOpen, true, "Clicking [data-map-node] must keep World Map open for preview");
      assert.equal(previewRes.stageIdx, beforeStage, "Clicking [data-map-node] must NOT travel automatically");
      assert.equal(previewRes.previewNode, "stg_1");
      assert.equal(previewRes.enterTarget, "stg_1");
      assert.equal(previewRes.enterDisabled, false);

      // Click locked stg_4 node -> previews unlock requirements with enter disabled
      await page.click('#modal-backdrop.open [data-map-node="stg_4"]');
      const lockedPreview = await page.evaluate(() => {
        const strip = document.getElementById("world-map-preview-strip");
        const enterBtn = document.getElementById("btn-map-enter-node");
        return {
          previewNode: strip?.getAttribute("data-preview-node"),
          enterDisabled: !!enterBtn?.disabled,
          text: strip?.textContent || ""
        };
      });
      assert.equal(lockedPreview.previewNode, "stg_4");
      assert.equal(lockedPreview.enterDisabled, true, "Locked node preview must disable [data-map-enter]");

      // Now select stg_1 and click explicit Enter button -> travels cleanly
      await page.click('#modal-backdrop.open [data-map-node="stg_1"]');
      await page.click('#modal-backdrop.open [data-map-enter="stg_1"]');
      const afterEnter = await page.evaluate(() => ({
        modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
        stageIdx: window.__CHENYUAN_V25__.getState().arena.stageIdx
      }));
      assert.equal(afterEnter.modalOpen, false);
      assert.equal(afterEnter.stageIdx, 1, "Explicit [data-map-enter='stg_1'] must travel to stage 1");

      // Verify Ch5 narrative marker, priority ordering in findNextMainlineStep, and Objectives unified tabs + claim refresh bugfix
      const navCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        const ch5 = api.KYUSHU_MAP_NODES.find(n => n.id === "ch5_resonance");
        const allHaveMeta = api.KYUSHU_MAP_NODES.every(n => n.tier && n.shape && Array.isArray(n.links));

        // Mark Vol 1 done & claimed; Vol 2 pet (recommended) NOT done -> findNextMainlineStep must pick s2_warden (required) first!
        s.game.openingChoice = "help";
        s.game.defeatedStageBosses = { 0: true };
        s.game.realm = "qi";
        s.game.claimedStepIds = ["s1_open", "s1_wolf", "s1_break"];
        s.game.pet = { id: null, level: 1, skills: {} };
        const nextVol2 = api.findNextMainlineStep(s.game);

        // Prepare s1_open claimable to test Objectives modal DOM live refresh on claim
        s.game.claimedStepIds = ["s1_wolf", "s1_break"];
        api.openObjectivesModal("mainline");
        const tabs = Array.from(document.querySelectorAll("#modal-backdrop.open [data-goal-tab]")).map(el => el.getAttribute("data-goal-tab"));
        return {
          hasCh5: Boolean(ch5 && ch5.tier === "main" && ch5.chapterIdx === 5),
          allHaveMeta,
          nextVol2Id: nextVol2?.step?.id,
          nextVol2Priority: nextVol2?.priority,
          tabs
        };
      });
      assert.equal(navCheck.hasCh5, true, "KYUSHU_MAP_NODES must include Chapter 5 narrative marker node");
      assert.equal(navCheck.allHaveMeta, true, "All map nodes must carry tier, shape, and links");
      assert.equal(navCheck.nextVol2Id, "s2_warden", "findNextMainlineStep must prioritize required s2_warden over recommended s2_pet");
      assert.equal(navCheck.nextVol2Priority, "required");
      assert.deepEqual(navCheck.tabs, ["mainline", "trials", "companions", "bounties", "endgame"]);

      // Click claim inside Objectives modal -> modal DOM must refresh immediately (verifying L32668 bugfix)
      await page.click('#modal-backdrop.open [data-claim-step="s1_open"]');
      const claimRefreshed = await page.evaluate(() => ({
        modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
        stillHasClaimBtn: !!document.querySelector('#modal-backdrop.open [data-claim-step="s1_open"]')
      }));
      assert.equal(claimRefreshed.modalOpen, true);
      assert.equal(claimRefreshed.stillHasClaimBtn, false, "Claiming a step inside Objectives modal must refresh modal DOM immediately");

      // Launching Demon Tower from Objectives -> trials tab must close modal, unpause combat & enter tower
      await page.click('#modal-backdrop.open [data-goal-tab="trials"]');
      await page.waitForSelector('#modal-backdrop.open [data-action="challenge-tower"]');
      await page.click('#modal-backdrop.open [data-action="challenge-tower"]');
      const afterTowerLaunch = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        return {
          towerMode: !!s.arena.towerMode,
          modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
          paused: !!s.arena.paused,
          modalTokens: api.getPauseTokens().filter(t => t.owner === "modal").length
        };
      });
      assert.equal(afterTowerLaunch.towerMode, true, "Clicking challenge-tower in Objectives trials must enter Demon Tower");
      assert.equal(afterTowerLaunch.modalOpen, false, "Launching challenge-tower from Objectives must close #modal-backdrop");
      assert.equal(afterTowerLaunch.paused, false, "Launching challenge-tower from Objectives must unpause combat");
      assert.equal(afterTowerLaunch.modalTokens, 0, "Launching challenge-tower must release modalPauseToken");

      // Verify allDone contract still returns { allDone: true, step: null }
      const allDoneCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "ascended";
        s.game.status = "ascended";
        s.game.openingChoice = "help";
        s.game.defeatedStageBosses = { 0: true, 1: true, 2: true, 3: true, 4: true };
        s.game.pet = { id: "fox", level: 3, skills: {} };
        s.game.immortalPills = 2;
        s.game.choices = { lu_intro: "a" };
        s.game.loadout.relic = "soul_lamp";
        s.game.laws = ["sword_rain", "thunder_chain", "iron_will", "wealth_power"];
        s.game.towerBest = 5;
        s.game.claimedStepIds = api.CHAPTERS.flatMap(c => c.steps.map(st => st.id));
        const res = api.findNextMainlineStep(s.game);
        return { allDone: !!res.allDone, step: res.step };
      });
      assert.equal(allDoneCheck.allDone, true);
      assert.equal(allDoneCheck.step, null);
    } finally {
      await ctx.close();
    }
  });

  // ============================================================================
  // Q2-3 (F16): EXPLORE MAINLINE-FIRST, CULTIVATE 3-GROUP & PAVILION/DOJO HYGIENE
  // ============================================================================
  await runSuite("Q2-3", "F16 Explore mainline-first, Cultivate 3-group details & Pavilion/Dojo consolidation", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q2-3", true);
    try {
      // 1. Mortal Explore: #explore-mainline-pin is top card; locked vein_expedition is inside collapsed <details>
      await page.click("#nav-btn-explore");
      await page.waitForSelector("#jade-panel.drawer-open #explore-mainline-pin");
      const mortalExplore = await page.evaluate(() => {
        const body = document.getElementById("panel-scroll-body");
        const firstCard = body.querySelector(".jade-card");
        const upcoming = body.querySelector('details[data-explore-group="upcoming"]');
        const expInUpcoming = upcoming ? !!upcoming.querySelector('[data-action="open-expedition"]') : false;
        return {
          firstCardId: firstCard?.id || "",
          hasUpcoming: !!upcoming,
          upcomingOpen: !!upcoming?.open,
          expInUpcoming
        };
      });
      assert.equal(mortalExplore.firstCardId, "explore-mainline-pin", "Explore must pin #explore-mainline-pin as top card");
      assert.equal(mortalExplore.hasUpcoming, true);
      assert.equal(mortalExplore.upcomingOpen, false, "Locked upcoming preview in Explore must start collapsed");
      assert.equal(mortalExplore.expInUpcoming, true, "Locked vein_expedition must live inside upcoming <details>");

      // 2. Mortal Cultivate button budget <= 14 (P3-1 guardrail)
      await page.click("#nav-btn-cultivate");
      await page.waitForSelector('#jade-panel.drawer-open details[data-cultivate-group="core"]');
      const mortalCultBtns = await page.evaluate(() => {
        const body = document.getElementById("panel-scroll-body");
        return Array.from(body.querySelectorAll("button")).filter(b => b.offsetParent !== null && !b.closest("details:not([open])")).length;
      });
      assert.ok(mortalCultBtns <= 14, `Mortal cultivate visible button count must stay <= 14, got ${mortalCultBtns}`);

      // 3. Golden realm Cultivate: 3 <details> groups, collection collapsed by default, toggling advanced persists across re-render
      const goldenCult = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "golden";
        api.renderDrawerContent();
        const body = document.getElementById("panel-scroll-body");
        const core = body.querySelector('details[data-cultivate-group="core"]');
        const adv = body.querySelector('details[data-cultivate-group="advanced"]');
        const col = body.querySelector('details[data-cultivate-group="collection"]');
        return {
          hasAllThree: Boolean(core && adv && col),
          coreOpen: !!core?.open,
          advOpen: !!adv?.open,
          colOpen: !!col?.open
        };
      });
      assert.equal(goldenCult.hasAllThree, true);
      assert.equal(goldenCult.coreOpen, true);
      assert.equal(goldenCult.advOpen, true);
      assert.equal(goldenCult.colOpen, false);

      // Toggle advanced closed via summary click and wait for async <details> toggle persistence before re-render
      await page.click('details[data-cultivate-group="advanced"] > summary');
      await page.waitForFunction(() => window.__CHENYUAN_V25__.getCultivateGroupState().advanced === false);
      const advPersist = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.renderDrawerContent();
        return {
          stateOpen: api.getCultivateGroupState().advanced,
          domOpen: !!document.querySelector('details[data-cultivate-group="advanced"]')?.open
        };
      });
      assert.equal(advPersist.stateOpen, false);
      assert.equal(advPersist.domOpen, false);

      // Expand collection and verify wardrobe canvas renders
      await page.click('details[data-cultivate-group="collection"] > summary');
      await page.waitForFunction(() => !!document.querySelector('details[data-cultivate-group="collection"]')?.open);
      const colCanvas = await page.evaluate(() => {
        const c = document.getElementById("wardrobe-preview-canvas");
        return Boolean(c && c.getBoundingClientRect().height > 0);
      });
      assert.equal(colCanvas, true, "Expanding collection group must show #wardrobe-preview-canvas");

      // 4. Pavilion & Dojo preserve all legacy IDs/actions
      const legacyIdsOk = await page.evaluate(() => {
        const ids = [
          "btn-ascension-roadmap", "btn-hall-of-lives", "btn-boss-rush", "btn-quick-map",
          "btn-star-chart", "btn-photo-mode", "btn-toggle-telemetry", "btn-toggle-bgm",
          "btn-mute-audio", "btn-toggle-arcana-all"
        ];
        return {
          allPavIds: ids.every(id => !!document.getElementById(id)),
          hasDojoDefense: !!document.querySelector('#dojo-control-bar [data-dojo-act="start-defense"]')
        };
      });
      assert.equal(legacyIdsOk.allPavIds, true);
      assert.equal(legacyIdsOk.hasDojoDefense, true);
    } finally {
      await ctx.close();
    }
  });

  // ============================================================================
  // Q2-4 (F17): 3-TIER REMINDER BADGES, UPGRADE PREVIEW & MATERIAL SOURCE JUMP
  // ============================================================================
  await runSuite("Q2-4", "F17 3-tier reminder badges, upgrade preview & single-layer material source jump", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q2-4", true);
    try {
      const previewAndTier = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "qi";
        s.game.stones = 250;
        s.game.openingChoice = "help";
        s.game.claimedStepIds = [];
        if (s.game.equippedGear && s.game.equippedGear.weapon) s.game.equippedGear.weapon.atk = 20;
        s.game.ownedRelics = ["soul_lamp"];
        s.game.relicStars = { soul_lamp: 1 };
        s.game.loadout.relic = "soul_lamp";
        s.game.inventory.herb = 0;
        api.updateHud();
        const rem = api.getReminderTier(s.game);
        const gearPrev = api.computeUpgradePreview(s.game, "gear_enhance", "weapon", { steps: 1 });
        const relicPrev = api.computeUpgradePreview(s.game, "relic_temper", "soul_lamp");
        const dotEl = document.getElementById("goal-hud-dot");
        const cultBadge = document.getElementById("badge-cultivate");
        return {
          tier1HudHigh: rem.tier1HudHigh,
          dotShown: !!dotEl?.classList.contains("show"),
          dotTier: dotEl?.getAttribute("data-reminder-tier"),
          cultTierLow: !!cultBadge?.classList.contains("tier-low"),
          gearDeltaAtk: gearPrev.dAtk,
          gearDeltaTxt: gearPrev.deltaText,
          relicValid: relicPrev.valid,
          relicDeltaTxt: relicPrev.deltaText
        };
      });
      assert.equal(previewAndTier.tier1HudHigh, true);
      assert.equal(previewAndTier.dotShown, true);
      assert.equal(previewAndTier.dotTier, "1");
      assert.equal(previewAndTier.cultTierLow, true, "Drawer nav dots must use calm .tier-low styling");
      assert.ok(previewAndTier.gearDeltaAtk > 0, `Expected positive weapon enhance ATK delta, got ${previewAndTier.gearDeltaAtk}`);
      assert.equal(previewAndTier.relicValid, true);
      assert.ok(previewAndTier.relicDeltaTxt.includes("★2"));

      // Open Alchemy with 0 herb -> click material source chip -> verify single-layer inline panel (NO modal stacked!)
      await page.click("#nav-btn-alchemy");
      await page.waitForSelector('#jade-panel.drawer-open [data-mat-source="herb"]');
      await page.click('#jade-panel.drawer-open [data-mat-source="herb"]');
      const jumpState = await page.evaluate(() => ({
        panelVisible: !!document.getElementById("drawer-mat-source-panel"),
        modalStacked: document.getElementById("modal-backdrop").classList.contains("open"),
        activeJump: window.__CHENYUAN_V25__.getActiveMatSourceJump(),
        focusedId: document.activeElement?.id || ""
      }));
      assert.equal(jumpState.panelVisible, true, "Material source jump must open inline #drawer-mat-source-panel");
      assert.equal(jumpState.modalStacked, false, "Material source jump must remain single-layer without stacking a modal");
      assert.equal(jumpState.activeJump?.matId, "herb");
      assert.equal(jumpState.focusedId, "btn-mat-source-return");

      // Click Return to Original Upgrade -> panel closes and focus returns inside #jade-panel
      await page.click("#btn-mat-source-return");
      const afterReturn = await page.evaluate(() => {
        const panel = document.getElementById("jade-panel");
        return {
          panelClosed: !document.getElementById("drawer-mat-source-panel"),
          activeJump: window.__CHENYUAN_V25__.getActiveMatSourceJump(),
          focusInDrawer: Boolean(panel && panel.contains(document.activeElement))
        };
      });
      assert.equal(afterReturn.panelClosed, true);
      assert.equal(afterReturn.activeJump, null);
      assert.equal(afterReturn.focusInDrawer, true, "Returning from material source must restore focus inside #jade-panel");
    } finally {
      await ctx.close();
    }
  });

  // ============================================================================
  // Q2-5 (F18): EXPLICIT-QUANTITY BATCH ACTIONS (D08) & DATA-DRIVEN DEFEAT REVIEW
  // ============================================================================
  await runSuite("Q2-5", "F18 explicit-quantity batch craft/enhance (D08) & data-driven defeat review", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q2-5", true);
    try {
      // Setup Qi realm with stones & herbs for batch tests
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "qi";
        s.game.stones = 600;
        s.game.inventory.herb = 20;
        s.game.inventory.dew = 20;
        s.game.inventory.healing_pill = 1;
        s.game.elapsedMonths = 10;
        api.updateHud();
      });

      // 1. Explicit batch craft: ×1 -> ×3 -> ×5 preview, Cancel deducts 0, Confirm ×3 applies exact cost & 9 months
      await page.click("#nav-btn-alchemy");
      await page.waitForSelector('[data-open-batch-craft="healing"]');
      await page.click('[data-open-batch-craft="healing"]');
      await page.waitForSelector("#modal-backdrop.open #btn-confirm-batch-craft");
      await page.click('#modal-backdrop.open [data-batch-craft-qty="5"]');
      const q5Text = await page.textContent("#btn-confirm-batch-craft");
      assert.ok(q5Text.includes("×5") && q5Text.includes("15月"), `Expected ×5 batch preview with 15 months, got: ${q5Text}`);
      await page.click('#modal-backdrop.open [data-modal-close="1"]');

      const afterCancelCraft = await page.evaluate(() => {
        const s = window.__CHENYUAN_V25__.getState().game;
        return { stones: s.stones, months: s.elapsedMonths, pills: s.inventory.healing_pill };
      });
      assert.equal(afterCancelCraft.stones, 600, "Canceling batch craft must deduct 0 stones");
      assert.equal(afterCancelCraft.months, 10, "Canceling batch craft must consume 0 months");
      assert.equal(afterCancelCraft.pills, 1);

      await page.click('[data-open-batch-craft="healing"]');
      await page.waitForSelector("#btn-confirm-batch-craft");
      await page.click('#modal-backdrop.open [data-batch-craft-qty="3"]');
      const expectedBatchCost = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState().game;
        return api.computeUpgradePreview(s, "alchemy_craft", "healing", { qty: 3 }).breakdown;
      });
      await page.click("#btn-confirm-batch-craft");
      const afterConfirmCraft = await page.evaluate(() => {
        const s = window.__CHENYUAN_V25__.getState().game;
        return { stones: s.stones, months: s.elapsedMonths, pills: s.inventory.healing_pill, herb: s.inventory.herb };
      });
      assert.equal(afterConfirmCraft.stones, 600 - expectedBatchCost.totalStoneCost);
      assert.equal(afterConfirmCraft.months, 10 + 9);
      assert.equal(afterConfirmCraft.pills, 1 + expectedBatchCost.totalOutput);
      assert.equal(afterConfirmCraft.herb, 20 - 6);

      // 2. Explicit batch enhance: +3 preview, Cancel deducts 0, Confirm applies exact +3 levels & stone cost
      await page.click("#nav-btn-cultivate");
      await page.waitForSelector('[data-open-batch-enhance="weapon"]');
      const preEnh = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState().game;
        return {
          stones: s.stones,
          lvl: s.equippedGear.weapon.lvl || 0,
          preview: api.computeBatchEnhancePreview(s, "weapon", 3)
        };
      });
      await page.click('[data-open-batch-enhance="weapon"]');
      await page.waitForSelector("#btn-confirm-batch-enhance");
      await page.click('#modal-backdrop.open [data-modal-close="1"]');
      const afterCancelEnh = await page.evaluate(() => ({
        stones: window.__CHENYUAN_V25__.getState().game.stones,
        lvl: window.__CHENYUAN_V25__.getState().game.equippedGear.weapon.lvl || 0
      }));
      assert.equal(afterCancelEnh.stones, preEnh.stones);
      assert.equal(afterCancelEnh.lvl, preEnh.lvl);

      await page.click('[data-open-batch-enhance="weapon"]');
      await page.waitForSelector("#btn-confirm-batch-enhance");
      await page.click("#btn-confirm-batch-enhance");
      const afterConfirmEnh = await page.evaluate(() => ({
        stones: window.__CHENYUAN_V25__.getState().game.stones,
        lvl: window.__CHENYUAN_V25__.getState().game.equippedGear.weapon.lvl || 0
      }));
      assert.equal(afterConfirmEnh.lvl, preEnh.lvl + 3);
      assert.equal(afterConfirmEnh.stones, preEnh.stones - preEnh.preview.totalCost);

      // 3. Invalid quantity rejection & atomic rollback on QuotaExceededError (both batch craft crossing lifespan_exhausted AND batch enhance)
      const rollbackRes = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState().game;
        const stonesBeforeInvalid = s.stones;
        const lvlBeforeInvalid = s.equippedGear.weapon.lvl || 0;
        const invalidCraft = [0, -1, NaN, 999].map(q => api.executeAlchemyBatchCraft("healing", q));
        const invalidEnh = [0, -1, NaN, 999].map(st => api.executeGearBatchEnhance("weapon", st));
        const invalidZeroMutation = s.stones === stonesBeforeInvalid && (s.equippedGear.weapon.lvl || 0) === lvlBeforeInvalid;

        const savedOrigElapsed = s.elapsedMonths;
        const lfInfo = api.getLifespanInfo(s);
        s.elapsedMonths = Math.max(0, lfInfo.maxMonths - (s.startAgeMonths || 216) - 4);
        const beforeStones = s.stones;
        const beforeMonths = s.elapsedMonths;
        const beforeHerb = s.inventory.herb;
        const beforePills = s.inventory.healing_pill;
        const beforePendingLen = (s.pendingRewards || []).length;
        const beforeWeaponLvl = s.equippedGear.weapon.lvl || 0;
        const beforeCraftOrLoot = s.goalStats ? (s.goalStats.craftOrLoot || 0) : 0;

        const origSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function () {
          const err = new Error("quota");
          err.name = "QuotaExceededError";
          throw err;
        };
        let craftRes;
        let enhRes;
        try {
          craftRes = api.executeAlchemyBatchCraft("healing", 3);
          enhRes = api.executeGearBatchEnhance("weapon", 2);
        } finally {
          Storage.prototype.setItem = origSet;
        }
        const craftRolledClean = (
          s.stones === beforeStones &&
          s.elapsedMonths === beforeMonths &&
          s.inventory.herb === beforeHerb &&
          s.inventory.healing_pill === beforePills &&
          (s.pendingRewards || []).length === beforePendingLen &&
          !(s.pendingRewards || []).some(pr => pr.kind === "lifespan_exhausted")
        );
        const enhRolledClean = (
          s.stones === beforeStones &&
          (s.equippedGear.weapon.lvl || 0) === beforeWeaponLvl &&
          (s.goalStats ? (s.goalStats.craftOrLoot || 0) : 0) === beforeCraftOrLoot
        );
        s.elapsedMonths = savedOrigElapsed;
        api.saveGame();
        return {
          invalidCraftAllRejected: invalidCraft.every(r => r && r.ok === false && r.reason === "invalid_qty"),
          invalidEnhAllRejected: invalidEnh.every(r => r && r.ok === false && r.reason === "invalid_steps"),
          invalidZeroMutation,
          craftRes,
          enhRes,
          craftRolledClean,
          enhRolledClean
        };
      });
      assert.equal(rollbackRes.invalidCraftAllRejected, true, "Invalid batch craft quantities must return { ok: false, reason: 'invalid_qty' }");
      assert.equal(rollbackRes.invalidEnhAllRejected, true, "Invalid batch enhance steps must return { ok: false, reason: 'invalid_steps' }");
      assert.equal(rollbackRes.invalidZeroMutation, true, "Invalid batch quantities must never mutate stones or gear level");
      assert.equal(rollbackRes.craftRes.ok, false);
      assert.equal(rollbackRes.craftRes.rolledBack, true);
      assert.equal(rollbackRes.craftRolledClean, true, "QuotaExceededError during batch craft crossing lifespan_exhausted must atomically roll back stones, months, inventory, and pendingRewards");
      assert.equal(rollbackRes.enhRes.ok, false);
      assert.equal(rollbackRes.enhRes.rolledBack, true);
      assert.equal(rollbackRes.enhRolledClean, true, "QuotaExceededError during batch enhance must atomically roll back stones, weapon level, and goalStats");

      // 4. Data-driven Defeat Review Case A (real combat hit) + navigation-only suggestion
      const defeatCaseA = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        api.closeDrawer();
        api.resetEncounterTelemetry();
        s.arena.player.invuln = 0;
        s.arena.player.shieldHp = 0;
        s.arena.defeatPending = null;
        api.hurtPlayer(9999, { uncapped: true, sourceName: "雾隐狼王", moveName: "血月三连爪", isHeavy: true });
        const panel = document.getElementById("defeat-review-panel");
        return {
          text: panel?.textContent || "",
          telemetry: api.getEncounterTelemetry(),
          stonesBefore: s.game.stones,
          pillsBefore: s.game.inventory.healing_pill
        };
      });
      assert.ok(defeatCaseA.text.includes("雾隐狼王") && defeatCaseA.text.includes("血月三连爪"), `Expected lethal source in #defeat-review-panel, got: ${defeatCaseA.text}`);
      assert.ok(defeatCaseA.telemetry.hitsTaken >= 1);

      await page.click('#modal-backdrop.open [data-defeat-nav="alchemy"]');
      const afterDefeatNav = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        return {
          sanctumMode: !!s.arena.sanctumMode,
          defeatPending: s.arena.defeatPending,
          hasDefeatPause: api.getPauseTokens().some(t => t.owner === "defeat"),
          drawerOpen: document.getElementById("jade-panel").classList.contains("drawer-open"),
          stonesAfter: s.game.stones,
          pillsAfter: s.game.inventory.healing_pill
        };
      });
      assert.equal(afterDefeatNav.sanctumMode, true);
      assert.equal(afterDefeatNav.defeatPending, null);
      assert.equal(afterDefeatNav.hasDefeatPause, false, "Defeat navigation suggestion must release defeatPauseToken cleanly");
      assert.equal(afterDefeatNav.drawerOpen, true);
      assert.equal(afterDefeatNav.stonesAfter, defeatCaseA.stonesBefore, "Defeat navigation suggestion must NOT auto-spend stones");
      assert.equal(afterDefeatNav.pillsAfter, defeatCaseA.pillsBefore, "Defeat navigation suggestion must NOT auto-consume pills");

      // 5. Data-driven Defeat Review Case B (direct HP=0 injection / 0 hits -> neutral fallback)
      const defeatCaseB = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        api.closeDrawer();
        api.resetEncounterTelemetry();
        s.game.hp = 0;
        api.openDefeatDecisionModal(false);
        return document.getElementById("defeat-review-panel")?.textContent || "";
      });
      assert.ok(defeatCaseB.includes("暂无详细致死记录"), `Direct HP=0 must render neutral fallback, got: ${defeatCaseB}`);
    } finally {
      await ctx.close();
    }
  });

  // =========================================================================
  // M7a PORTED RUNTIME REGRESSION SUITES (R7-1 .. R7-3)
  // =========================================================================
  await runSuite("R7-1", "M7a 目标弹窗领赏即时刷新(主线/悬赏/星匣 开闭态) + 损坏存档覆盖写入失败双误横幅与局内恢复", async () => {
    // Part A: P11 — Objectives modal open-state immediate refresh & closed-state HUD claim safety
    const { ctx: ctxA, page: pageA } = await startCleanGamePage(browser, "R7-1-Objectives", true);
    await pageA.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "spirit";
      g.defeatedStageBosses = { 0: true, 1: true, 2: true, 3: true };
      g.stageStars = { 0: 3, 1: 3, 2: 1, 3: 1 };
      g.towerBest = 4;
      g.gearBag = [];
      g.claimedStepIds = ["s1_open", "s1_wolf", "s1_break", "s2_pet", "s2_lu", "s2_warden", "s2_break", "s3_npc"];
      g.claimedStarChests = [];
      g.inventory.healing_pill = 1;
      g.inventory.spirit_pill = 1;
      g.goalStats = { kills: 50, techBreaks: 50, craftOrLoot: 20 };
      g.bountyTiers = { slay: 1, tech: 1, craft: 1 };
      api.enterSanctumHub();
      api.saveGame();
      api.updateHud();
    });

    // Open modal -> data-claim-step (s3_serpent, pillQty: 2)
    await pageA.click("#btn-open-goals-hdr");
    await pageA.waitForSelector('#modal-backdrop.open [data-claim-step="s3_serpent"]');
    const beforeModalStyle = await pageA.evaluate(() => {
      const bd = document.getElementById("modal-backdrop");
      return { isOpenClass: bd.classList.contains("open"), inlineDisplay: bd.style.display };
    });
    assert.equal(beforeModalStyle.isOpenClass, true, "Objectives modal must use .open class");
    assert.notEqual(beforeModalStyle.inlineDisplay, "flex", "Objectives modal should not rely on inline style.display === 'flex'");

    await pageA.click('#modal-backdrop.open [data-claim-step="s3_serpent"]');
    await pageA.waitForTimeout(80);
    const afterS3 = await pageA.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      return {
        claimed: g.claimedStepIds.includes("s3_serpent"),
        healingPill: g.inventory.healing_pill,
        modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
        btnStillPresent: Boolean(document.querySelector('#modal-backdrop.open [data-claim-step="s3_serpent"]'))
      };
    });
    assert.equal(afterS3.claimed, true, "s3_serpent must be recorded in claimedStepIds");
    assert.equal(afterS3.healingPill, 3, "s3_serpent must grant pillQty: 2 healing_pill (1 -> 3)");
    assert.equal(afterS3.modalOpen, true, "Objectives modal must stay open after claiming s3_serpent");
    assert.equal(afterS3.btnStillPresent, false, "Claimed s3_serpent button must immediately disappear on modal refresh");

    // Open modal -> data-claim-step (s6_pacts, pillQty: 2)
    await pageA.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.claimedStepIds.push("s3_break", "s4_relic", "s4_puppet", "s4_break", "s5_laws", "s5_break");
      api.openObjectivesModal("mainline");
    });
    await pageA.waitForSelector('#modal-backdrop.open [data-claim-step="s6_pacts"]');
    await pageA.click('#modal-backdrop.open [data-claim-step="s6_pacts"]');
    await pageA.waitForTimeout(80);
    const afterS6 = await pageA.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      return {
        claimed: g.claimedStepIds.includes("s6_pacts"),
        spiritPill: g.inventory.spirit_pill,
        modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
        btnStillPresent: Boolean(document.querySelector('#modal-backdrop.open [data-claim-step="s6_pacts"]'))
      };
    });
    assert.equal(afterS6.claimed, true, "s6_pacts must be recorded in claimedStepIds");
    assert.equal(afterS6.spiritPill, 3, "s6_pacts must grant pillQty: 2 spirit_pill (1 -> 3)");
    assert.equal(afterS6.modalOpen, true, "Objectives modal must stay open after claiming s6_pacts");
    assert.equal(afterS6.btnStillPresent, false, "Claimed s6_pacts button must immediately disappear on modal refresh");

    // Open modal -> bounties tab -> data-claim-bounty (slay)
    await pageA.click('#modal-backdrop.open [data-goal-tab="bounties"]');
    await pageA.waitForSelector('#modal-backdrop.open [data-claim-bounty="slay"]');
    const beforeBounty = await pageA.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      return { stones: g.stones, core: g.inventory.core || 0 };
    });
    await pageA.click('#modal-backdrop.open [data-claim-bounty="slay"]');
    await pageA.waitForTimeout(80);
    const afterBounty = await pageA.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      return {
        tier: g.bountyTiers.slay,
        stones: g.stones,
        core: g.inventory.core || 0,
        modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
        modalText: document.getElementById("modal-content")?.textContent || ""
      };
    });
    assert.equal(afterBounty.tier, 2, "Claiming slay bounty must advance tier 1 -> 2");
    assert.ok(afterBounty.stones > beforeBounty.stones, "Claiming slay bounty must increase stones");
    assert.equal(afterBounty.core, beforeBounty.core + 1, "Claiming slay bounty must grant +1 core");
    assert.equal(afterBounty.modalOpen, true, "Objectives modal must stay open after claiming bounty");
    assert.ok(afterBounty.modalText.includes("荡魔除妖令 · 第2重"), `Expected refreshed tier-2 bounty title in modal, got: ${afterBounty.modalText.slice(0, 200)}`);

    // Open modal -> data-claim-star-chest (star_3)
    await pageA.waitForSelector('#modal-backdrop.open [data-claim-star-chest="star_3"]');
    const stonesBeforeChest = await pageA.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones);
    await pageA.click('#modal-backdrop.open [data-claim-star-chest="star_3"]');
    await pageA.waitForTimeout(80);
    const afterChest = await pageA.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      return {
        claimed: g.claimedStarChests.includes("star_3"),
        stones: g.stones,
        modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
        btnStillPresent: Boolean(document.querySelector('#modal-backdrop.open [data-claim-star-chest="star_3"]'))
      };
    });
    assert.equal(afterChest.claimed, true, "star_3 must be recorded in claimedStarChests");
    assert.equal(afterChest.stones, stonesBeforeChest + 100, "star_3 must award +100 stones");
    assert.equal(afterChest.modalOpen, true, "Objectives modal must stay open after claiming star_3 chest");
    assert.equal(afterChest.btnStillPresent, false, "Claimed star_3 button must immediately disappear on modal refresh");

    await pageA.keyboard.press("Escape");
    await pageA.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));

    // Closed modal: HUD quest-tracker claims MUST NOT open Objectives modal
    await pageA.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.claimedStepIds = ["s1_open", "s1_wolf", "s1_break", "s2_pet", "s2_lu", "s2_warden", "s2_break", "s3_npc", "s3_serpent"];
      g.goalStats = { kills: 0, techBreaks: 50, craftOrLoot: 0 };
      g.bountyTiers = { slay: 2, tech: 1, craft: 1 };
      api.updateHud();
    });
    await pageA.waitForSelector('#quest-tracker-hud [data-claim-step="s3_break"]');
    await pageA.click('#quest-tracker-hud [data-claim-step="s3_break"]');
    await pageA.waitForTimeout(80);
    const hudStepRes = await pageA.evaluate(() => ({
      claimed: window.__CHENYUAN_V25__.getState().game.claimedStepIds.includes("s3_break"),
      modalOpen: document.getElementById("modal-backdrop").classList.contains("open")
    }));
    assert.equal(hudStepRes.claimed, true, "HUD click on s3_break must claim reward");
    assert.equal(hudStepRes.modalOpen, false, "HUD data-claim-step click while modal closed MUST NOT open modal");

    await pageA.waitForSelector('#quest-tracker-hud [data-claim-bounty="tech"]');
    await pageA.click('#quest-tracker-hud [data-claim-bounty="tech"]');
    await pageA.waitForTimeout(80);
    const hudBountyRes = await pageA.evaluate(() => ({
      tier: window.__CHENYUAN_V25__.getState().game.bountyTiers.tech,
      modalOpen: document.getElementById("modal-backdrop").classList.contains("open")
    }));
    assert.equal(hudBountyRes.tier, 2, "HUD click on tech bounty must advance tier 1 -> 2");
    assert.equal(hudBountyRes.modalOpen, false, "HUD data-claim-bounty click while modal closed MUST NOT open modal");
    await ctxA.close();

    // Part B: P10 + DEFECT-1 — Corrupt-save overwrite under QuotaExceededError preserves storageReadError, surfaces dual-error HUD banner, blocks silent retry-save-now, and supports both welcome & in-game recovery
    const ctxB = await newIsolatedContext(browser);
    const pageB = await ctxB.newPage();
    attachErrorListeners(pageB, "R7-1-CorruptQuota");
    await pageB.goto(targetUrl, { waitUntil: "domcontentloaded" });
    const corruptRaw = JSON.stringify({
      envelopeVersion: 2,
      saveRev: 9,
      tabId: "tab_r7_corrupt",
      updatedAt: Date.now(),
      checksum: "deadbeef_tampered_r7",
      game: { realm: "mortal", name: "受损原档", stones: 888 },
      stageIdx: 0,
      stanceIdx: 0,
      towerMode: false,
      sanctumMode: false
    });
    const triggerCorruptQuotaFailure = async () => {
      await pageB.evaluate(({ sk, raw }) => {
        localStorage.clear();
        localStorage.setItem(sk, raw);
      }, { sk: STORAGE_KEY, raw: corruptRaw });
      await pageB.reload({ waitUntil: "domcontentloaded" });
      await pageB.waitForSelector("#save-status-banner", { state: "visible" });
      await pageB.click('[data-action="prompt-overwrite-corrupt"]');
      await pageB.waitForSelector('#modal-backdrop.open [data-action="confirm-overwrite-corrupt-new"]');
      await pageB.evaluate((sk) => {
        window.__r7OrigSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === sk) {
            const err = new Error("R7 QuotaExceededError");
            err.name = "QuotaExceededError";
            throw err;
          }
          return window.__r7OrigSetItem.call(this, k, v);
        };
      }, STORAGE_KEY);
      await pageB.click('[data-action="confirm-overwrite-corrupt-new"]');
      await pageB.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await dismissOpeningScroll(pageB);
    };

    await triggerCorruptQuotaFailure();

    const quotaFailedState = await pageB.evaluate((sk) => {
      const ps = window.__CHENYUAN_V25__.getPersistenceState();
      const alertEl = document.getElementById("hud-save-alert");
      const actions = Array.from(alertEl.querySelectorAll("[data-action]")).map(b => b.getAttribute("data-action"));
      return {
        raw: localStorage.getItem(sk),
        hasWriteErr: Boolean(ps.storageWriteError),
        hasReadErr: Boolean(ps.storageReadError),
        readErrRaw: ps.storageReadError ? ps.storageReadError.raw : null,
        toastTxt: document.getElementById("toast-container")?.textContent || "",
        alertVisible: getComputedStyle(alertEl).display !== "none",
        alertText: alertEl.textContent || "",
        actions
      };
    }, STORAGE_KEY);
    assert.equal(quotaFailedState.raw, corruptRaw, "Failed overwrite must preserve original corrupt raw payload");
    assert.equal(quotaFailedState.hasWriteErr, true, "Failed overwrite must set storageWriteError");
    assert.equal(quotaFailedState.hasReadErr, true, "P10: Failed overwrite MUST keep storageReadError active until saveGame succeeds");
    assert.equal(quotaFailedState.readErrRaw, corruptRaw, "P10: storageReadError.raw must retain original corrupt payload");
    assert.equal(quotaFailedState.toastTxt.includes("已确认覆盖旧损坏存档"), false, "Failed overwrite must not show false overwrite-success toast");
    assert.equal(quotaFailedState.alertVisible, true, "HUD save alert must be visible after failed corrupt overwrite");
    assert.ok(quotaFailedState.alertText.includes("写入失败") && quotaFailedState.alertText.includes("QuotaExceededError"), `DEFECT-1: Dual-error #hud-save-alert must show write failure, got: ${quotaFailedState.alertText}`);
    assert.ok(quotaFailedState.alertText.includes("原受损存档仍保留"), `DEFECT-1: Dual-error #hud-save-alert must show preserved corrupt save, got: ${quotaFailedState.alertText}`);
    assert.equal(quotaFailedState.actions.includes("copy-corrupt-save-raw"), true, `DEFECT-1: Dual-error banner must expose copy-corrupt-save-raw, got: ${quotaFailedState.actions}`);
    assert.equal(quotaFailedState.actions.includes("overwrite-with-current-save"), true, `DEFECT-1: Dual-error banner must expose overwrite-with-current-save, got: ${quotaFailedState.actions}`);
    assert.equal(quotaFailedState.actions.includes("open-cloud-backup"), true, `DEFECT-1: Dual-error banner must expose open-cloud-backup, got: ${quotaFailedState.actions}`);
    assert.equal(quotaFailedState.actions.includes("retry-save-now"), false, `DEFECT-1: Dual-error banner must omit dead retry-save-now button, got: ${quotaFailedState.actions}`);
    assert.equal(quotaFailedState.actions.includes("dismiss-save-alert"), false, `DEFECT-1: Dual-error banner must omit dead dismiss-save-alert button, got: ${quotaFailedState.actions}`);

    // DEFECT-R2-1: Persistent-quota within-6s click on #hud-save-alert [data-action="overwrite-with-current-save"] MUST emit immediate failure toast (not throttled) and preserve off-BODY focus
    await pageB.evaluate(() => {
      window.__CHENYUAN_V25__.enterSanctumHub({ skipSave: true });
      const tc = document.getElementById("toast-container");
      if (tc) tc.innerHTML = "";
    });
    await pageB.click('#hud-save-alert [data-action="overwrite-with-current-save"]');
    await pageB.waitForTimeout(60);
    const persistentQuotaOverwrite = await pageB.evaluate((sk) => {
      const ps = window.__CHENYUAN_V25__.getPersistenceState();
      const alertEl = document.getElementById("hud-save-alert");
      const ae = document.activeElement;
      return {
        raw: localStorage.getItem(sk),
        hasReadErr: Boolean(ps.storageReadError),
        hasWriteErr: Boolean(ps.storageWriteError),
        toastAfter: document.getElementById("toast-container")?.textContent || "",
        alertDisplay: getComputedStyle(alertEl).display,
        isBody: ae === document.body,
        inAlert: Boolean(alertEl && alertEl.contains(ae)),
        activeAction: ae ? (ae.getAttribute("data-action") || "") : ""
      };
    }, STORAGE_KEY);
    assert.equal(persistentQuotaOverwrite.raw, corruptRaw, "DEFECT-R2-1: Failed within-6s overwrite must keep corrupt raw intact");
    assert.equal(persistentQuotaOverwrite.hasReadErr, true, "DEFECT-R2-1: Failed within-6s overwrite must keep storageReadError active");
    assert.equal(persistentQuotaOverwrite.hasWriteErr, true, "DEFECT-R2-1: Failed within-6s overwrite must keep storageWriteError active");
    assert.ok(persistentQuotaOverwrite.toastAfter.includes("写入失败"), `DEFECT-R2-1: Within-6s user-initiated overwrite failure must emit immediate failure toast (not throttled), got: ${persistentQuotaOverwrite.toastAfter}`);
    assert.equal(persistentQuotaOverwrite.alertDisplay, "flex", "DEFECT-R2-1: #hud-save-alert must remain visible after failed overwrite");
    assert.equal(persistentQuotaOverwrite.isBody, false, "DEFECT-R2-1: Focus must never drop to BODY after failed overwrite");
    assert.equal(persistentQuotaOverwrite.inAlert, true, "DEFECT-R2-1: Focus must stay inside #hud-save-alert after failed overwrite");
    assert.equal(persistentQuotaOverwrite.activeAction, "overwrite-with-current-save", `DEFECT-R2-1: Focus must return to overwrite-with-current-save, got: ${persistentQuotaOverwrite.activeAction}`);

    // Restore storage writability and verify synthetic retry-save-now emits explicit critical toast while preserving corruptRaw + non-forced guards
    await pageB.evaluate(() => {
      Storage.prototype.setItem = window.__r7OrigSetItem;
    });
    const postRestoreGuards = await pageB.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      const tc = document.getElementById("toast-container");
      if (tc) tc.innerHTML = "";
      const synthRetry = document.createElement("button");
      synthRetry.type = "button";
      synthRetry.setAttribute("data-action", "retry-save-now");
      document.body.appendChild(synthRetry);
      synthRetry.click();
      synthRetry.remove();
      const retryToast = tc ? tc.textContent : "";
      const rawAfterRetry = localStorage.getItem(sk);
      const psAfterRetry = api.getPersistenceState();
      const alertStillVisible = getComputedStyle(document.getElementById("hud-save-alert")).display !== "none";
      const nonForcedSaved = api.saveGame();
      const rawAfterNonForced = localStorage.getItem(sk);
      api.flushSaveOnLifecycle();
      const rawAfterLifecycle = localStorage.getItem(sk);
      return {
        retryToast,
        rawAfterRetry,
        stillReadErr: Boolean(psAfterRetry.storageReadError),
        alertStillVisible,
        nonForcedSaved,
        rawAfterNonForced,
        rawAfterLifecycle
      };
    }, STORAGE_KEY);
    assert.ok(postRestoreGuards.retryToast.includes("原受损存档仍保留"), `DEFECT-1: Synthetic retry-save-now under storageReadError must emit explicit critical toast, got: ${postRestoreGuards.retryToast}`);
    assert.equal(postRestoreGuards.rawAfterRetry, corruptRaw, "DEFECT-1: Synthetic retry-save-now must keep corrupt raw byte-identical");
    assert.equal(postRestoreGuards.stillReadErr, true, "DEFECT-1: Synthetic retry-save-now must keep storageReadError active");
    assert.equal(postRestoreGuards.alertStillVisible, true, "P10: #hud-save-alert must remain visible while storageReadError is active");
    assert.equal(postRestoreGuards.nonForcedSaved, false, "P10: non-forced saveGame() must return false while storageReadError is active");
    assert.equal(postRestoreGuards.rawAfterNonForced, corruptRaw, "P10: non-forced saveGame() must not overwrite preserved corrupt raw");
    assert.equal(postRestoreGuards.rawAfterLifecycle, corruptRaw, "P10: flushSaveOnLifecycle() must not overwrite preserved corrupt raw");

    // Reload preserves corrupt raw and welcome-screen explicit recovery works
    await pageB.reload({ waitUntil: "domcontentloaded" });
    await pageB.waitForSelector("#save-status-banner", { state: "visible" });
    const afterReloadCorrupt = await pageB.evaluate((sk) => ({
      raw: localStorage.getItem(sk),
      hasReadErr: Boolean(window.__CHENYUAN_V25__.getPersistenceState().storageReadError)
    }), STORAGE_KEY);
    assert.equal(afterReloadCorrupt.raw, corruptRaw, "Reload after failed overwrite must still preserve corrupt raw");
    assert.equal(afterReloadCorrupt.hasReadErr, true, "Reload after failed overwrite must still report storageReadError");

    await pageB.click('[data-action="prompt-overwrite-corrupt"]');
    await pageB.waitForSelector('#modal-backdrop.open [data-action="confirm-overwrite-corrupt-new"]');
    await pageB.click('[data-action="confirm-overwrite-corrupt-new"]');
    await pageB.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await dismissOpeningScroll(pageB);
    const welcomeRecovered = await pageB.evaluate((sk) => {
      const ps = window.__CHENYUAN_V25__.getPersistenceState();
      const parsed = JSON.parse(localStorage.getItem(sk));
      return {
        readErr: ps.storageReadError,
        writeErr: ps.storageWriteError,
        envVer: parsed && parsed.envelopeVersion
      };
    }, STORAGE_KEY);
    assert.equal(welcomeRecovered.readErr, null, "Welcome explicit overwrite must clear storageReadError");
    assert.equal(welcomeRecovered.writeErr, null, "Welcome explicit overwrite must clear storageWriteError");
    assert.equal(welcomeRecovered.envVer, 2, "Welcome explicit overwrite must write envelopeVersion 2 save");

    // DEFECT-1 in-game recovery: re-trigger corrupt + QuotaExceededError -> restore setItem -> mutate stones=456 -> click #hud-save-alert [data-action="overwrite-with-current-save"]
    await triggerCorruptQuotaFailure();
    await pageB.evaluate(() => {
      Storage.prototype.setItem = window.__r7OrigSetItem;
      window.__CHENYUAN_V25__.getState().game.stones = 456;
    });
    await pageB.waitForSelector('#hud-save-alert [data-action="overwrite-with-current-save"]');
    await pageB.click('#hud-save-alert [data-action="overwrite-with-current-save"]');
    await pageB.waitForFunction(() => getComputedStyle(document.getElementById("hud-save-alert")).display === "none", null, { timeout: 3000 });
    const inGameRecovered = await pageB.evaluate((sk) => {
      const ps = window.__CHENYUAN_V25__.getPersistenceState();
      const parsed = JSON.parse(localStorage.getItem(sk));
      return {
        readErr: ps.storageReadError,
        writeErr: ps.storageWriteError,
        alertDisplay: getComputedStyle(document.getElementById("hud-save-alert")).display,
        envVer: parsed && parsed.envelopeVersion,
        stones: parsed && parsed.game && parsed.game.stones,
        activeTag: document.activeElement ? document.activeElement.tagName : "",
        isBody: document.activeElement === document.body
      };
    }, STORAGE_KEY);
    assert.equal(inGameRecovered.readErr, null, "DEFECT-1: In-game overwrite-with-current-save must clear storageReadError");
    assert.equal(inGameRecovered.writeErr, null, "DEFECT-1: In-game overwrite-with-current-save must clear storageWriteError");
    assert.equal(inGameRecovered.alertDisplay, "none", "DEFECT-1: In-game overwrite-with-current-save must hide #hud-save-alert");
    assert.equal(inGameRecovered.envVer, 2, "DEFECT-1: In-game overwrite-with-current-save must persist envelopeVersion 2");
    assert.equal(inGameRecovered.stones, 456, "DEFECT-1: In-game overwrite-with-current-save must save active session progress (stones === 456)");
    assert.equal(inGameRecovered.isBody, false, `DEFECT-1: In-game overwrite-with-current-save must restore focus off BODY, got tag=${inGameRecovered.activeTag}`);

    // DEFECT-R2-1: Pure storageWriteError within-6s retry-save-now failure (immediate toast + off-BODY focus) AND recovery focus restoration
    await pageB.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      api.enterSanctumHub({ skipSave: true });
      window.__r7OrigSetItemPure = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === sk) {
          const err = new Error("Pure Retry QuotaExceededError");
          err.name = "QuotaExceededError";
          throw err;
        }
        return window.__r7OrigSetItemPure.call(this, k, v);
      };
      api.saveGame();
      const tc = document.getElementById("toast-container");
      if (tc) tc.innerHTML = "";
    }, STORAGE_KEY);
    await pageB.waitForSelector('#hud-save-alert [data-action="retry-save-now"]');
    await pageB.click('#hud-save-alert [data-action="retry-save-now"]');
    await pageB.waitForTimeout(60);
    const pureRetryFail = await pageB.evaluate(() => {
      const ps = window.__CHENYUAN_V25__.getPersistenceState();
      const alertEl = document.getElementById("hud-save-alert");
      const ae = document.activeElement;
      return {
        hasWriteErr: Boolean(ps.storageWriteError),
        hasReadErr: Boolean(ps.storageReadError),
        toastAfter: document.getElementById("toast-container")?.textContent || "",
        alertDisplay: getComputedStyle(alertEl).display,
        isBody: ae === document.body,
        activeAction: ae ? (ae.getAttribute("data-action") || "") : ""
      };
    });
    assert.equal(pureRetryFail.hasWriteErr, true, "DEFECT-R2-1: Pure retry-save-now quota failure must keep storageWriteError");
    assert.equal(pureRetryFail.hasReadErr, false, "DEFECT-R2-1: Pure retry-save-now must not set storageReadError");
    assert.ok(pureRetryFail.toastAfter.includes("写入失败"), `DEFECT-R2-1: Pure within-6s retry-save-now failure must emit immediate failure toast, got: ${pureRetryFail.toastAfter}`);
    assert.equal(pureRetryFail.alertDisplay, "flex", "DEFECT-R2-1: #hud-save-alert must remain visible on retry failure");
    assert.equal(pureRetryFail.isBody, false, "DEFECT-R2-1: Pure retry-save-now failure must keep focus off BODY");
    assert.equal(pureRetryFail.activeAction, "retry-save-now", `DEFECT-R2-1: Pure retry-save-now failure must refocus retry-save-now, got: ${pureRetryFail.activeAction}`);

    await pageB.evaluate(() => {
      Storage.prototype.setItem = window.__r7OrigSetItemPure;
    });
    await pageB.click('#hud-save-alert [data-action="retry-save-now"]');
    await pageB.waitForFunction(() => getComputedStyle(document.getElementById("hud-save-alert")).display === "none", null, { timeout: 3000 });
    const pureRetryRecovered = await pageB.evaluate(() => {
      const ps = window.__CHENYUAN_V25__.getPersistenceState();
      const ae = document.activeElement;
      return {
        writeErr: ps.storageWriteError,
        alertDisplay: getComputedStyle(document.getElementById("hud-save-alert")).display,
        toastAfter: document.getElementById("toast-container")?.textContent || "",
        isBody: ae === document.body,
        activeId: ae ? (ae.id || ae.tagName) : ""
      };
    });
    assert.equal(pureRetryRecovered.writeErr, null, "DEFECT-R2-1: Successful retry-save-now must clear storageWriteError");
    assert.equal(pureRetryRecovered.alertDisplay, "none", "DEFECT-R2-1: Successful retry-save-now must hide #hud-save-alert");
    assert.ok(pureRetryRecovered.toastAfter.includes("已恢复写入"), `DEFECT-R2-1: Successful retry-save-now must show recovery toast, got: ${pureRetryRecovered.toastAfter}`);
    assert.equal(pureRetryRecovered.isBody, false, `DEFECT-R2-1: Successful retry-save-now must restore focus off BODY, got: ${pureRetryRecovered.activeId}`);

    // Multi-tab contention on recovered save + DEFECT-R2-2 save_conflict modal overwrite-with-current-save under QuotaExceededError atomicity
    const pageB2 = await ctxB.newPage();
    attachErrorListeners(pageB2, "R7-1-MultiTab");
    await pageB2.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await pageB2.waitForSelector("#btn-continue-save", { state: "visible" });
    await pageB2.click("#btn-continue-save");
    await pageB2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await dismissOpeningScroll(pageB2);
    await pageB2.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.stones = 777;
      api.saveGame();
    });
    await pageB.waitForFunction(() => {
      const ps = window.__CHENYUAN_V25__.getPersistenceState();
      return Boolean(ps.saveConflictState || ps.saveReadOnlyMode);
    }, { timeout: 3000 });
    await pageB.waitForSelector('#modal-backdrop.open [data-action="overwrite-with-current-save"]', { timeout: 3000 });
    await pageB.evaluate((sk) => {
      window.__r7OrigSetItemConflict = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === sk) {
          const err = new Error("Conflict Modal QuotaExceededError");
          err.name = "QuotaExceededError";
          throw err;
        }
        return window.__r7OrigSetItemConflict.call(this, k, v);
      };
      const tc = document.getElementById("toast-container");
      if (tc) tc.innerHTML = "";
    }, STORAGE_KEY);
    await pageB.click('#modal-backdrop.open [data-action="overwrite-with-current-save"]');
    await pageB.waitForTimeout(60);
    const conflictQuotaFail = await pageB.evaluate((sk) => {
      const ps = window.__CHENYUAN_V25__.getPersistenceState();
      const alertEl = document.getElementById("hud-save-alert");
      const alertActions = Array.from(alertEl.querySelectorAll("[data-action]")).map(b => b.getAttribute("data-action"));
      const modalBackdrop = document.getElementById("modal-backdrop");
      const ae = document.activeElement;
      return {
        modalStillOpen: Boolean(modalBackdrop && modalBackdrop.classList.contains("open")),
        hasConflictState: Boolean(ps.saveConflictState),
        saveReadOnlyMode: ps.saveReadOnlyMode,
        hasWriteErr: Boolean(ps.storageWriteError),
        diskStones: JSON.parse(localStorage.getItem(sk)).game.stones,
        toastAfter: document.getElementById("toast-container")?.textContent || "",
        alertActions,
        isBody: ae === document.body,
        inModal: Boolean(modalBackdrop && modalBackdrop.contains(ae))
      };
    }, STORAGE_KEY);
    assert.equal(conflictQuotaFail.modalStillOpen, true, "DEFECT-R2-2: Failed conflict overwrite under QuotaExceededError MUST keep save_conflict modal open");
    assert.equal(conflictQuotaFail.hasConflictState, true, "DEFECT-R2-2: Failed conflict overwrite MUST preserve saveConflictState");
    assert.equal(conflictQuotaFail.hasWriteErr, true, "DEFECT-R2-2: Failed conflict overwrite MUST set storageWriteError");
    assert.equal(conflictQuotaFail.diskStones, 777, "DEFECT-R2-2: Failed conflict overwrite MUST preserve cross-tab disk save (stones === 777)");
    assert.ok(conflictQuotaFail.toastAfter.includes("写入失败"), `DEFECT-R2-2: Failed conflict overwrite MUST emit immediate failure toast, got: ${conflictQuotaFail.toastAfter}`);
    assert.equal(conflictQuotaFail.alertActions.includes("open-save-conflict"), true, `DEFECT-R2-2: #hud-save-alert must stay on conflict state rather than downgrading, got: ${conflictQuotaFail.alertActions}`);
    assert.equal(conflictQuotaFail.isBody, false, "DEFECT-R2-2: Focus must stay off BODY after failed conflict modal overwrite");
    assert.equal(conflictQuotaFail.inModal, true, "DEFECT-R2-2: Focus must stay inside open save_conflict modal after failed overwrite");

    // Also verify stay-readonly-save -> overwrite-with-current-save under QuotaExceededError preserves saveReadOnlyMode + dual read-only banner + off-BODY focus
    await pageB.click('#modal-backdrop.open [data-action="stay-readonly-save"]');
    await pageB.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"), null, { timeout: 3000 });
    await pageB.evaluate(() => {
      const tc = document.getElementById("toast-container");
      if (tc) tc.innerHTML = "";
    });
    await pageB.waitForSelector('#hud-save-alert [data-action="overwrite-with-current-save"]', { timeout: 3000 });
    await pageB.click('#hud-save-alert [data-action="overwrite-with-current-save"]');
    await pageB.waitForTimeout(60);
    const readonlyQuotaFail = await pageB.evaluate((sk) => {
      const ps = window.__CHENYUAN_V25__.getPersistenceState();
      const alertEl = document.getElementById("hud-save-alert");
      const alertActions = Array.from(alertEl.querySelectorAll("[data-action]")).map(b => b.getAttribute("data-action"));
      const ae = document.activeElement;
      return {
        saveReadOnlyMode: ps.saveReadOnlyMode,
        hasWriteErr: Boolean(ps.storageWriteError),
        diskStones: JSON.parse(localStorage.getItem(sk)).game.stones,
        toastAfter: document.getElementById("toast-container")?.textContent || "",
        alertActions,
        isBody: ae === document.body,
        activeAction: ae ? (ae.getAttribute("data-action") || "") : ""
      };
    }, STORAGE_KEY);
    assert.equal(readonlyQuotaFail.saveReadOnlyMode, true, "DEFECT-R2-2: Failed read-only overwrite MUST preserve saveReadOnlyMode === true");
    assert.equal(readonlyQuotaFail.hasWriteErr, true, "DEFECT-R2-2: Failed read-only overwrite MUST set storageWriteError");
    assert.equal(readonlyQuotaFail.diskStones, 777, "DEFECT-R2-2: Failed read-only overwrite MUST preserve disk save (stones === 777)");
    assert.ok(readonlyQuotaFail.toastAfter.includes("写入失败"), `DEFECT-R2-2: Failed read-only overwrite MUST emit immediate failure toast, got: ${readonlyQuotaFail.toastAfter}`);
    assert.equal(readonlyQuotaFail.alertActions.includes("overwrite-with-current-save"), true, `DEFECT-R2-2: Read-only write-error banner must keep overwrite-with-current-save, got: ${readonlyQuotaFail.alertActions}`);
    assert.equal(readonlyQuotaFail.alertActions.includes("load-latest-save"), true, `DEFECT-R2-2: Read-only write-error banner must keep load-latest-save, got: ${readonlyQuotaFail.alertActions}`);
    assert.equal(readonlyQuotaFail.isBody, false, "DEFECT-R2-2: Failed read-only overwrite must keep focus off BODY");
    assert.equal(readonlyQuotaFail.activeAction, "overwrite-with-current-save", `DEFECT-R2-2: Failed read-only overwrite must refocus overwrite-with-current-save, got: ${readonlyQuotaFail.activeAction}`);

    await pageB.evaluate(() => {
      Storage.prototype.setItem = window.__r7OrigSetItemConflict;
    });
    const contention = await pageB.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      const savedFromStale = api.saveGame();
      const diskStones = JSON.parse(localStorage.getItem(sk)).game.stones;
      return { savedFromStale, diskStones };
    }, STORAGE_KEY);
    assert.equal(contention.savedFromStale, false, "Stale tab saveGame() must be blocked after cross-tab write");
    assert.equal(contention.diskStones, 777, "Cross-tab newer save stones (777) must be preserved");
    await ctxB.close();
  });

  await runSuite("R7-2", "M7a 交互与焦点返回：仙阁弹窗/过场保焦/沙盒返焦、法宝淬炼/延寿丹/抽屉保焦、兵解转世回标题及多标签元存档 CRDT 完整守卫", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R7-2-Focus", true);

    // Part A: P4 & P9 + FINDING-2 — Pavilion sandbox confirm modal (Escape + Cancel + Enter), early-return/toggle popover buttons, and active-cutscene focus preservation
    await page.click("#btn-pavilion-menu");
    await page.waitForSelector("#pavilion-popover.open #btn-toggle-arcana-all");
    await page.click("#btn-toggle-arcana-all");
    await page.waitForSelector("#modal-backdrop.open #btn-confirm-enter-sandbox");
    const sandboxOpenState = await page.evaluate(() => ({
      popoverOpen: document.getElementById("pavilion-popover").classList.contains("open"),
      focusInModal: document.getElementById("modal-content").contains(document.activeElement)
    }));
    assert.equal(sandboxOpenState.popoverOpen, false, "Opening sandbox confirm from pavilion must close #pavilion-popover");
    assert.equal(sandboxOpenState.focusInModal, true, "Focus must move into sandbox confirm modal");

    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const afterEscSandbox = await page.evaluate(() => ({
      sandbox: window.__CHENYUAN_V25__.isSandboxMode(),
      activeId: document.activeElement?.id || ""
    }));
    assert.equal(afterEscSandbox.sandbox, false, "Pressing Escape must not enter sandbox mode");
    assert.equal(afterEscSandbox.activeId, "btn-pavilion-menu", "P4: Escape from pavilion sandbox modal must return focus to #btn-pavilion-menu");

    // Mouse cancel returns focus to #btn-pavilion-menu
    await page.click("#btn-pavilion-menu");
    await page.waitForSelector("#pavilion-popover.open #btn-toggle-arcana-all");
    await page.click("#btn-toggle-arcana-all");
    await page.waitForSelector('#modal-backdrop.open [data-modal-close="1"]');
    await page.click('#modal-backdrop.open [data-modal-close="1"]');
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const afterCancelSandbox = await page.evaluate(() => ({
      sandbox: window.__CHENYUAN_V25__.isSandboxMode(),
      activeId: document.activeElement?.id || ""
    }));
    assert.equal(afterCancelSandbox.sandbox, false, "Clicking Cancel must not enter sandbox mode");
    assert.equal(afterCancelSandbox.activeId, "btn-pavilion-menu", "P4: Cancel from pavilion sandbox modal must return focus to #btn-pavilion-menu");

    // Keyboard Enter immediately re-opens #pavilion-popover
    await page.keyboard.press("Enter");
    await page.waitForSelector("#pavilion-popover.open");
    assert.equal(await page.evaluate(() => document.getElementById("pavilion-popover").classList.contains("open")), true, "Enter on focused #btn-pavilion-menu must re-open popover");

    // P9: Toggle button inside #pavilion-popover (#btn-toggle-bgm) closes popover & focuses #btn-pavilion-menu
    await page.click("#pavilion-popover.open #btn-toggle-bgm");
    await page.waitForTimeout(50);
    const afterBgmToggle = await page.evaluate(() => ({
      popoverOpen: document.getElementById("pavilion-popover").classList.contains("open"),
      activeId: document.activeElement?.id || ""
    }));
    assert.equal(afterBgmToggle.popoverOpen, false, "P9: Clicking #btn-toggle-bgm must close #pavilion-popover");
    assert.equal(afterBgmToggle.activeId, "btn-pavilion-menu", "P9: Clicking #btn-toggle-bgm must return focus to #btn-pavilion-menu");

    // FINDING-2: Real click on #btn-pavilion-menu -> #btn-toggle-bgm during active #story-dialogue-bar.open closes popover AND keeps focus inside #story-dialogue-bar (never BODY)
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      if (g.seenCutscenes) delete g.seenCutscenes.opening_scroll;
      api.playCutscene("opening_scroll");
    });
    await page.waitForSelector("#story-dialogue-bar.open");
    await page.click("#btn-pavilion-menu");
    await page.waitForSelector("#pavilion-popover.open #btn-toggle-bgm");
    await page.click("#pavilion-popover.open #btn-toggle-bgm");
    await page.waitForTimeout(50);
    const afterCutscenePavClick = await page.evaluate(() => {
      const dlg = document.getElementById("story-dialogue-bar");
      const ae = document.activeElement;
      return {
        popoverOpen: document.getElementById("pavilion-popover").classList.contains("open"),
        dlgOpen: Boolean(dlg && dlg.classList.contains("open")),
        insideDlg: Boolean(dlg && dlg.contains(ae)),
        isBody: ae === document.body,
        activeId: ae ? (ae.id || ae.tagName) : ""
      };
    });
    assert.equal(afterCutscenePavClick.popoverOpen, false, "FINDING-2: Clicking #btn-toggle-bgm during cutscene must close #pavilion-popover");
    assert.equal(afterCutscenePavClick.dlgOpen, true, "FINDING-2: Cutscene dialogue bar must remain open");
    assert.equal(afterCutscenePavClick.insideDlg, true, `FINDING-2: Focus must remain inside #story-dialogue-bar during cutscene, got: ${afterCutscenePavClick.activeId}`);
    assert.equal(afterCutscenePavClick.isBody, false, "FINDING-2: Focus must never drop to BODY during cutscene popover click");
    await dismissOpeningScroll(page);

    // P9: Early-return popover buttons ([data-action="open-celestial-spire"] & #btn-boss-rush) close popover immediately & Escape returns focus to #btn-pavilion-menu
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "nascent";
      api.enterSanctumHub();
      api.updateHud();
    });
    for (const sel of ['#pavilion-popover.open [data-action="open-celestial-spire"]', "#pavilion-popover.open #btn-boss-rush"]) {
      await page.click("#btn-pavilion-menu");
      await page.waitForSelector(sel);
      await page.click(sel);
      await page.waitForSelector("#modal-backdrop.open");
      const popClosed = await page.evaluate(() => !document.getElementById("pavilion-popover").classList.contains("open"));
      assert.equal(popClosed, true, `P9: Early-return popover button ${sel} must immediately close #pavilion-popover`);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
      const retId = await page.evaluate(() => document.activeElement?.id || "");
      assert.equal(retId, "btn-pavilion-menu", `P9: Escape after ${sel} must return focus to #btn-pavilion-menu`);
    }

    // Part B: P7 — [data-temper-relic="frost_sword"] preserves focus inside #jade-panel
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "foundation";
      g.stones = 500;
      g.inventory.core = 3;
      g.ownedRelics = ["frost_sword"];
      g.relicStars = { frost_sword: 1 };
      g.sanctumLevels.sword_forge = 1;
      api.enterSanctumHub();
      api.saveGame();
      api.updateHud();
    });
    await page.click("#nav-btn-alchemy");
    await page.waitForSelector('#jade-panel.drawer-open [data-temper-relic="frost_sword"]');
    await page.click('#jade-panel.drawer-open [data-temper-relic="frost_sword"]');
    await page.waitForTimeout(80);
    const afterTemper = await page.evaluate(() => {
      const panel = document.getElementById("jade-panel");
      const ae = document.activeElement;
      return {
        stars: window.__CHENYUAN_V25__.getState().game.relicStars.frost_sword,
        inPanel: Boolean(panel && panel.contains(ae)),
        temperAttr: ae ? ae.getAttribute("data-temper-relic") : null
      };
    });
    assert.equal(afterTemper.stars, 2, "Tempering frost_sword must raise relicStars 1 -> 2");
    assert.equal(afterTemper.inPanel, true, "P7: Focus must stay inside #jade-panel after relic tempering");
    assert.equal(afterTemper.temperAttr, "frost_sword", "P7: Focus must return to refreshed [data-temper-relic='frost_sword']");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("jade-panel")?.classList.contains("drawer-open"));

    // Part C: P7 & P8 — longevity_pill focus preservation (cultivate alert-clear + bag remaining/last pill) + general drawer re-render focus fallback
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "mortal";
      g.lifespanBonusMonths = 0;
      g.elapsedMonths = 528;
      g.inventory.longevity_pill = 3;
      g.inventory.healing_pill = 2;
      api.updateHud();
    });
    // C1: Cultivate tab — consuming longevity_pill clears lifespan alert card (button disappears), focus stays inside #jade-panel (not BODY)
    await page.click("#nav-btn-cultivate");
    await page.waitForSelector('#jade-panel.drawer-open [data-use-item="longevity_pill"]');
    await page.click('#jade-panel.drawer-open [data-use-item="longevity_pill"]');
    await page.waitForTimeout(80);
    const afterCultivatePill = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const panel = document.getElementById("jade-panel");
      const ae = document.activeElement;
      return {
        qty: api.getState().game.inventory.longevity_pill,
        lifeStatus: api.getLifespanInfo(api.getState().game).status,
        inPanel: Boolean(panel && panel.contains(ae)),
        activeTag: ae ? ae.tagName : ""
      };
    });
    assert.equal(afterCultivatePill.qty, 2, "Cultivate longevity_pill consumption must decrement 3 -> 2");
    assert.equal(afterCultivatePill.lifeStatus, "normal", "Consuming longevity_pill must restore normal lifespan status");
    assert.equal(afterCultivatePill.inPanel, true, "P7/P8: Focus must stay inside #jade-panel when cultivate alert card disappears");
    assert.notEqual(afterCultivatePill.activeTag, "BODY", "P7/P8: Focus must never drop to BODY on cultivate pill consume");

    // C2: Bag tab — remaining longevity_pill keeps exact button focus; last longevity_pill stays inside #jade-panel; healing_pill tests P8 general fallback
    await page.click("#nav-btn-bag");
    await page.waitForSelector('#jade-panel.drawer-open [data-use-item="longevity_pill"]');
    await page.click('#jade-panel.drawer-open [data-use-item="longevity_pill"]');
    await page.waitForTimeout(80);
    const afterBagFirstPill = await page.evaluate(() => {
      const panel = document.getElementById("jade-panel");
      const ae = document.activeElement;
      return {
        qty: window.__CHENYUAN_V25__.getState().game.inventory.longevity_pill,
        inPanel: Boolean(panel && panel.contains(ae)),
        useItemAttr: ae ? ae.getAttribute("data-use-item") : null
      };
    });
    assert.equal(afterBagFirstPill.qty, 1, "Bag longevity_pill consumption must decrement 2 -> 1");
    assert.equal(afterBagFirstPill.inPanel, true, "P7: Focus must stay inside #jade-panel after consuming 1st bag longevity_pill");
    assert.equal(afterBagFirstPill.useItemAttr, "longevity_pill", "P7: Focus must stay on refreshed [data-use-item='longevity_pill'] when pills remain");

    await page.click('#jade-panel.drawer-open [data-use-item="longevity_pill"]');
    await page.waitForTimeout(80);
    const afterBagLastPill = await page.evaluate(() => {
      const panel = document.getElementById("jade-panel");
      const ae = document.activeElement;
      return {
        qty: window.__CHENYUAN_V25__.getState().game.inventory.longevity_pill,
        inPanel: Boolean(panel && panel.contains(ae)),
        activeTag: ae ? ae.tagName : ""
      };
    });
    assert.equal(afterBagLastPill.qty, 0, "Final longevity_pill consumption must decrement 1 -> 0");
    assert.equal(afterBagLastPill.inPanel, true, "P7/P8: Focus must remain inside #jade-panel after consuming last longevity_pill");
    assert.notEqual(afterBagLastPill.activeTag, "BODY", "P7/P8: Focus must never drop to BODY after consuming last pill");

    // P8 general drawer re-render fallback via non-longevity item consumption inside bag drawer
    await page.click('#jade-panel.drawer-open [data-use-item="healing_pill"]');
    await page.waitForTimeout(80);
    const afterGeneralRerender = await page.evaluate(() => {
      const panel = document.getElementById("jade-panel");
      const ae = document.activeElement;
      return {
        inPanel: Boolean(panel && panel.contains(ae)),
        activeTag: ae ? ae.tagName : ""
      };
    });
    assert.equal(afterGeneralRerender.inPanel, true, "P8: General drawer re-render must recover focus inside #jade-panel");
    assert.notEqual(afterGeneralRerender.activeTag, "BODY", "P8: General drawer re-render must not drop focus to BODY");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("jade-panel")?.classList.contains("drawer-open"), null, { timeout: 3000 });

    // Part D: P5 — Confirmed 2-step 兵解转世 welcome CTA focus + 0 leaked pauseTokens + M2 meta guards
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "mortal";
      g.lifespanBonusMonths = 0;
      g.elapsedMonths = 528;
      g.inventory.longevity_pill = 0;
      api.saveGame();
      api.updateHud();
    });

    // M2 saveMeta QuotaExceededError rollback check
    const metaQuotaRes = await page.evaluate(({ sk, mk }) => {
      const api = window.__CHENYUAN_V25__;
      const ptsBefore = api.getMetaState().reincarnationPoints;
      const saveBefore = localStorage.getItem(sk);
      const origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === mk) {
          const err = new Error("Meta quota full");
          err.name = "QuotaExceededError";
          throw err;
        }
        return origSet.call(this, k, v);
      };
      let ok = true;
      try {
        ok = api.executeReincarnation({ source: "bingjie" });
      } finally {
        Storage.prototype.setItem = origSet;
      }
      return {
        ok,
        ptsAfter: api.getMetaState().reincarnationPoints,
        ptsBefore,
        savePreserved: localStorage.getItem(sk) === saveBefore,
        gameStillAlive: Boolean(api.getState().game)
      };
    }, { sk: STORAGE_KEY, mk: META_KEY });
    assert.equal(metaQuotaRes.ok, false, "executeReincarnation must abort when saveMeta hits QuotaExceededError");
    assert.equal(metaQuotaRes.ptsAfter, metaQuotaRes.ptsBefore, "Failed saveMeta must roll back reincarnationPoints");
    assert.equal(metaQuotaRes.savePreserved, true, "Failed saveMeta must preserve main save in STORAGE_KEY");
    assert.equal(metaQuotaRes.gameStillAlive, true, "Failed saveMeta must keep active game session intact");

    // M2 metaReadError abort check + explicit corrupt-meta reset
    const metaCorruptRes = await page.evaluate(({ sk, mk }) => {
      const api = window.__CHENYUAN_V25__;
      const saveBefore = localStorage.getItem(sk);
      const badMeta = "{CORRUPT_META_R72";
      localStorage.setItem(mk, badMeta);
      window.dispatchEvent(new StorageEvent("storage", { key: mk, newValue: badMeta, oldValue: null, storageArea: localStorage }));
      const ok = api.executeReincarnation({ source: "bingjie" });
      return {
        ok,
        hasMetaReadErr: Boolean(api.getPersistenceState().metaReadError),
        savePreserved: localStorage.getItem(sk) === saveBefore
      };
    }, { sk: STORAGE_KEY, mk: META_KEY });
    assert.equal(metaCorruptRes.hasMetaReadErr, true, "Corrupt cross-tab meta event must set metaReadError");
    assert.equal(metaCorruptRes.ok, false, "executeReincarnation must abort when metaReadError is active");
    assert.equal(metaCorruptRes.savePreserved, true, "Aborted reincarnation under metaReadError must preserve main save");

    await page.waitForSelector('#hud-save-alert [data-action="prompt-reset-corrupt-meta"]');
    await page.click('#hud-save-alert [data-action="prompt-reset-corrupt-meta"]');
    await page.waitForSelector('#modal-backdrop.open [data-action="confirm-reset-corrupt-meta"]');
    await page.click('#modal-backdrop.open [data-action="confirm-reset-corrupt-meta"]');
    await page.waitForFunction(() => !window.__CHENYUAN_V25__.getPersistenceState().metaReadError);

    // Real 2-step UI 兵解转世 -> welcome screen CTA focus + 0 leaked pauseTokens
    const beforeReinc = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const m = api.getMetaState();
      return { pts: m.reincarnationPoints, asc: m.ascensions };
    });
    await page.click("#hud-lifespan-badge");
    await page.waitForSelector("#modal-backdrop.open #btn-lifespan-bingjie");
    await page.click("#btn-lifespan-bingjie");
    await page.waitForSelector("#modal-backdrop.open #btn-confirm-bingjie-reincarnate");
    await page.click("#btn-confirm-bingjie-reincarnate");
    await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "flex");

    const afterReinc = await page.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      const m = api.getMetaState();
      return {
        saveRemoved: localStorage.getItem(sk) === null,
        pts: m.reincarnationPoints,
        asc: m.ascensions,
        pauseTokens: api.getPauseTokens().length,
        activeId: document.activeElement?.id || "",
        modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
        drawerOpen: document.getElementById("jade-panel").classList.contains("drawer-open")
      };
    }, STORAGE_KEY);
    assert.equal(afterReinc.saveRemoved, true, "Confirmed 兵解转世 must remove main STORAGE_KEY save");
    assert.equal(afterReinc.pts, beforeReinc.pts + 40, "Confirmed 兵解转世 must award +40 reincarnationPoints");
    assert.equal(afterReinc.asc, beforeReinc.asc, "兵解转世 must not increment ascensions count");
    assert.equal(afterReinc.pauseTokens, 0, "P5: executeReincarnation must leave 0 leaked pauseTokens");
    assert.equal(afterReinc.modalOpen, false, "P5: Modal must be closed after reincarnation");
    assert.equal(afterReinc.drawerOpen, false, "P5: Drawer must be closed after reincarnation");
    assert.equal(afterReinc.activeId, "btn-start-new", `P5: Focus must land on #btn-start-new after reincarnation, got: ${afterReinc.activeId}`);
    await ctx.close();

    // Part E: CRDT D1-D4 — Multi-tab META_KEY healing completeness & zero redundant writes
    const ctxE = await newIsolatedContext(browser);
    const tabA = await ctxE.newPage();
    const tabB = await ctxE.newPage();
    attachErrorListeners(tabA, "R7-2-CRDT-TabA");
    attachErrorListeners(tabB, "R7-2-CRDT-TabB");
    await tabA.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabA.waitForFunction(() => Boolean(window.__CHENYUAN_V25__));
    await tabA.evaluate(() => { localStorage.clear(); window.__CHENYUAN_V25__.saveMeta(); });
    await tabB.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabB.waitForFunction(() => Boolean(window.__CHENYUAN_V25__));

    // D1: bestCalamityTier / cloudSeaClears / taixuTrailUnlocked / karmaAscensions
    await tabB.waitForFunction((mk) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(mk) || "null");
        return Boolean(parsed && Number(parsed.metaRev) >= 1);
      } catch {
        return false;
      }
    }, META_KEY, { timeout: 4000 });
    const d1StaleRaw = await tabB.evaluate((mk) => localStorage.getItem(mk), META_KEY);
    const d1BaseRev = await tabA.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const m = api.getMetaState();
      m.bestCalamityTier = 2;
      m.cloudSeaClears = 3;
      m.taixuTrailUnlocked = true;
      m.karmaAscensions = { righteous: 1, neutral: 2, demonic: 3 };
      api.saveMeta();
      return Number(api.getMetaState().metaRev) || 1;
    });
    await tabB.waitForFunction(({ mk, minRev }) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(mk) || "null");
        return Boolean(parsed && Number(parsed.metaRev) >= minRev);
      } catch {
        return false;
      }
    }, { mk: META_KEY, minRev: d1BaseRev }, { timeout: 4000 });
    const d1StaleRev = d1BaseRev + 1;
    await tabB.evaluate(({ mk, raw, staleRev }) => {
      const stale = JSON.parse(raw);
      stale.bestCalamityTier = 0;
      stale.cloudSeaClears = 0;
      stale.taixuTrailUnlocked = false;
      stale.karmaAscensions = { righteous: 0, neutral: 0, demonic: 0 };
      stale.metaTabId = "tab_b_stale_d1";
      stale.metaRev = staleRev;
      localStorage.setItem(mk, JSON.stringify(stale));
    }, { mk: META_KEY, raw: d1StaleRaw, staleRev: d1StaleRev });
    await tabA.waitForFunction(({ mk, staleRev }) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(mk) || "{}");
        return Number(parsed.metaRev) > staleRev
          && parsed.metaTabId !== "tab_b_stale_d1"
          && parsed.bestCalamityTier === 2
          && parsed.cloudSeaClears === 3
          && parsed.taixuTrailUnlocked === true
          && parsed.karmaAscensions?.righteous === 1
          && parsed.karmaAscensions?.neutral === 2
          && parsed.karmaAscensions?.demonic === 3;
      } catch {
        return false;
      }
    }, { mk: META_KEY, staleRev: d1StaleRev }, { timeout: 4000 });
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.waitForFunction(() => Boolean(window.__CHENYUAN_V25__));
    const d1AfterReload = await tabA.evaluate(() => {
      const m = window.__CHENYUAN_V25__.getMetaState();
      return {
        bestCalamityTier: m.bestCalamityTier,
        cloudSeaClears: m.cloudSeaClears,
        taixuTrailUnlocked: m.taixuTrailUnlocked,
        karmaAscensions: m.karmaAscensions
      };
    });
    assert.equal(d1AfterReload.bestCalamityTier, 2, "CRDT D1: bestCalamityTier=2 must survive stale tab overwrite + reload");
    assert.equal(d1AfterReload.cloudSeaClears, 3, "CRDT D1: cloudSeaClears=3 must survive stale tab overwrite + reload");
    assert.equal(d1AfterReload.taixuTrailUnlocked, true, "CRDT D1: taixuTrailUnlocked=true must survive stale tab overwrite + reload");
    assert.deepEqual(
      { righteous: d1AfterReload.karmaAscensions.righteous, neutral: d1AfterReload.karmaAscensions.neutral, demonic: d1AfterReload.karmaAscensions.demonic },
      { righteous: 1, neutral: 2, demonic: 3 },
      "CRDT D1: karmaAscensions={1,2,3} must survive stale tab overwrite + reload"
    );

    // D2: hallOfLives 19th newer life preserved at 18-entry cap
    const d2InitRev = await tabA.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const m = api.getMetaState();
      m.hallOfLives = Array.from({ length: 18 }, (_, i) => ({
        lifeNum: 18 - i,
        name: `古修第${18 - i}世`,
        realmName: "化神",
        endingId: "sword_immortal",
        endingTitle: "剑道通玄",
        karmaMode: "righteous",
        score: 1000 + (18 - i),
        years: 200,
        recordedAt: 1018 - i
      }));
      api.saveMeta();
      return Number(api.getMetaState().metaRev) || 1;
    });
    await tabB.waitForFunction(({ mk, minRev }) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(mk) || "null");
        return Boolean(parsed && Number(parsed.metaRev) >= minRev && Array.isArray(parsed.hallOfLives) && parsed.hallOfLives.length === 18);
      } catch {
        return false;
      }
    }, { mk: META_KEY, minRev: d2InitRev }, { timeout: 4000 });
    const d2StaleRaw = await tabB.evaluate((mk) => localStorage.getItem(mk), META_KEY);
    const d2BaseRev = await tabA.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const m = api.getMetaState();
      m.hallOfLives = [
        {
          lifeNum: 19,
          name: "新晋飞升剑尊",
          realmName: "化神",
          endingId: "sword_immortal",
          endingTitle: "剑道通玄",
          karmaMode: "righteous",
          score: 9999,
          years: 320,
          recordedAt: 9999
        },
        ...m.hallOfLives
      ].slice(0, 18);
      api.saveMeta();
      return Number(api.getMetaState().metaRev) || 1;
    });
    await tabB.waitForFunction(({ mk, minRev }) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(mk) || "null");
        return Boolean(parsed && Number(parsed.metaRev) >= minRev && Array.isArray(parsed.hallOfLives) && parsed.hallOfLives[0]?.recordedAt === 9999);
      } catch {
        return false;
      }
    }, { mk: META_KEY, minRev: d2BaseRev }, { timeout: 4000 });
    const d2StaleRev = d2BaseRev + 1;
    await tabB.evaluate(({ mk, raw, staleRev }) => {
      const stale = JSON.parse(raw);
      stale.metaTabId = "tab_b_stale_d2";
      stale.metaRev = staleRev;
      localStorage.setItem(mk, JSON.stringify(stale));
    }, { mk: META_KEY, raw: d2StaleRaw, staleRev: d2StaleRev });
    await tabA.waitForFunction(({ mk, staleRev }) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(mk) || "{}");
        return Number(parsed.metaRev) > staleRev
          && parsed.metaTabId !== "tab_b_stale_d2"
          && Array.isArray(parsed.hallOfLives)
          && parsed.hallOfLives.length === 18
          && parsed.hallOfLives[0]?.recordedAt === 9999;
      } catch {
        return false;
      }
    }, { mk: META_KEY, staleRev: d2StaleRev }, { timeout: 4000 });
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.waitForFunction(() => Boolean(window.__CHENYUAN_V25__));
    const d2AfterReload = await tabA.evaluate(() => {
      const m = window.__CHENYUAN_V25__.getMetaState();
      return { len: m.hallOfLives.length, topRecordedAt: m.hallOfLives[0]?.recordedAt, topLifeNum: m.hallOfLives[0]?.lifeNum };
    });
    assert.equal(d2AfterReload.len, 18, "CRDT D2: hallOfLives must stay capped at 18 entries");
    assert.equal(d2AfterReload.topRecordedAt, 9999, "CRDT D2: 19th newer life (recordedAt=9999) must survive 18-entry cap race + reload");
    assert.equal(d2AfterReload.topLifeNum, 19, "CRDT D2: 19th newer life (lifeNum=19) must remain at index 0 after reload");

    // D3: seenEnemies duplicate-length set union (["wolf","wolf"] vs ["wolf","jade_serpent"])
    const d3BaseRev = await tabA.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const m = api.getMetaState();
      m.seenEnemies = ["wolf", "jade_serpent"];
      api.saveMeta();
      return Number(api.getMetaState().metaRev) || 1;
    });
    await tabB.waitForFunction(({ mk, minRev }) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(mk) || "null");
        return Boolean(parsed && Number(parsed.metaRev) >= minRev && Array.isArray(parsed.seenEnemies) && parsed.seenEnemies.includes("jade_serpent"));
      } catch {
        return false;
      }
    }, { mk: META_KEY, minRev: d3BaseRev }, { timeout: 4000 });
    const d3CurRaw = await tabB.evaluate((mk) => localStorage.getItem(mk), META_KEY);
    const d3StaleRev = d3BaseRev + 1;
    await tabB.evaluate(({ mk, raw, staleRev }) => {
      const stale = JSON.parse(raw);
      stale.seenEnemies = ["wolf", "wolf"];
      stale.metaTabId = "tab_b_stale_d3";
      stale.metaRev = staleRev;
      localStorage.setItem(mk, JSON.stringify(stale));
    }, { mk: META_KEY, raw: d3CurRaw, staleRev: d3StaleRev });
    await tabA.waitForFunction(({ mk, staleRev }) => {
      try {
        const parsed = JSON.parse(localStorage.getItem(mk) || "{}");
        return Number(parsed.metaRev) > staleRev
          && parsed.metaTabId !== "tab_b_stale_d3"
          && Array.isArray(parsed.seenEnemies)
          && parsed.seenEnemies.includes("jade_serpent");
      } catch {
        return false;
      }
    }, { mk: META_KEY, staleRev: d3StaleRev }, { timeout: 4000 });
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.waitForFunction(() => Boolean(window.__CHENYUAN_V25__));
    const d3AfterReload = await tabA.evaluate(() => window.__CHENYUAN_V25__.getMetaState().seenEnemies);
    assert.equal(d3AfterReload.includes("jade_serpent"), true, `CRDT D3: seenEnemies must preserve jade_serpent against duplicate-length remote write, got: ${JSON.stringify(d3AfterReload)}`);

    // D4: Zero redundant META_KEY writes on 3 stale behind StorageEvents when live storage already holds converged state
    const d4Res = await tabA.evaluate((mk) => {
      const api = window.__CHENYUAN_V25__;
      api.saveMeta();
      const liveConverged = JSON.parse(localStorage.getItem(mk));
      let metaWriteCount = 0;
      const origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === mk) metaWriteCount += 1;
        return origSet.call(this, k, v);
      };
      try {
        for (let i = 1; i <= 3; i += 1) {
          const staleEventPayload = JSON.stringify({
            ...liveConverged,
            bestCalamityTier: 0,
            cloudSeaClears: 0,
            taixuTrailUnlocked: false,
            seenEnemies: ["wolf"],
            metaTabId: `tab_b_stale_d4_${i}`,
            metaRev: Math.max(1, (Number(liveConverged.metaRev) || 1) - i)
          });
          window.dispatchEvent(new StorageEvent("storage", {
            key: mk,
            newValue: staleEventPayload,
            oldValue: null,
            storageArea: localStorage
          }));
        }
      } finally {
        Storage.prototype.setItem = origSet;
      }
      const liveAfter = JSON.parse(localStorage.getItem(mk));
      return {
        metaWriteCount,
        revUnchanged: liveAfter.metaRev === liveConverged.metaRev,
        stillHasSerpent: Array.isArray(liveAfter.seenEnemies) && liveAfter.seenEnemies.includes("jade_serpent")
      };
    }, META_KEY);
    assert.equal(d4Res.metaWriteCount, 0, `CRDT D4: 3 stale behind StorageEvents while live META_KEY is converged must trigger 0 extra writes, got: ${d4Res.metaWriteCount}`);
    assert.equal(d4Res.revUnchanged, true, "CRDT D4: live metaRev must remain unchanged when no redundant healing write occurs");
    assert.equal(d4Res.stillHasSerpent, true, "CRDT D4: live converged state must remain intact");

    // R2-D1: Corrupt live META_KEY in-game + delayed valid StorageEvent (BOTH active writer & non-writer) MUST preserve exact corrupt bytes (0 writes), keep metaReadError active, and keep #hud-save-alert visible (display === "flex")
    await tabB.close();
    await tabA.click("#btn-start-new");
    await tabA.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none", null, { timeout: 4000 });
    await dismissOpeningScroll(tabA);
    await tabA.evaluate(() => {
      window.__CHENYUAN_V25__.enterSanctumHub({ skipSave: true });
    });
    for (const writerCase of [
      { label: "active-writer", isWriter: true, corruptRaw: "{CORRUPT_LIVE_META_R2D1_WRITER###" },
      { label: "non-writer", isWriter: false, corruptRaw: "{CORRUPT_LIVE_META_R2D1_NONWRITER###" }
    ]) {
      const r2d1Res = await tabA.evaluate(({ mk, isWriter, corruptRaw }) => {
        const api = window.__CHENYUAN_V25__;
        const m = api.getMetaState();
        m.ascensions = 5;
        if (isWriter) {
          api.saveMeta({ forceReset: true });
          m.ascensions = 5;
          api.saveMeta();
        } else {
          api.saveMeta({ forceReset: true });
          m.metaTabId = "other_session_tab_r2d1";
        }
        // Corrupt live META_KEY on disk and notify tabA so metaReadError + #hud-save-alert are active
        localStorage.setItem(mk, corruptRaw);
        window.dispatchEvent(new StorageEvent("storage", {
          key: mk,
          newValue: corruptRaw,
          oldValue: null,
          storageArea: localStorage
        }));
        const beforeHasErr = Boolean(api.getPersistenceState().metaReadError);
        const beforeAlertDisplay = getComputedStyle(document.getElementById("hud-save-alert")).display;

        let metaWrites = 0;
        const origSet = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          if (k === mk) metaWrites += 1;
          return origSet.call(this, k, v);
        };
        try {
          const delayedValidPayload = JSON.stringify({
            ascensions: 1,
            bestScore: 100,
            bestTower: 1,
            metaRev: 1,
            metaTabId: "tab_delayed_stale_r2d1"
          });
          window.dispatchEvent(new StorageEvent("storage", {
            key: mk,
            newValue: delayedValidPayload,
            oldValue: null,
            storageArea: localStorage
          }));
        } finally {
          Storage.prototype.setItem = origSet;
        }
        const ps = api.getPersistenceState();
        return {
          beforeHasErr,
          beforeAlertDisplay,
          metaWrites,
          diskRaw: localStorage.getItem(mk),
          afterHasErr: Boolean(ps.metaReadError),
          afterErrRaw: ps.metaReadError ? ps.metaReadError.raw : null,
          afterAlertDisplay: getComputedStyle(document.getElementById("hud-save-alert")).display
        };
      }, { mk: META_KEY, isWriter: writerCase.isWriter, corruptRaw: writerCase.corruptRaw });

      assert.equal(r2d1Res.beforeHasErr, true, `R2-D1 (${writerCase.label}): pre-condition metaReadError must be active`);
      assert.equal(r2d1Res.beforeAlertDisplay, "flex", `R2-D1 (${writerCase.label}): pre-condition #hud-save-alert must be visible`);
      assert.equal(r2d1Res.metaWrites, 0, `R2-D1 (${writerCase.label}): delayed valid StorageEvent while live META_KEY is corrupt must perform 0 writes, got: ${r2d1Res.metaWrites}`);
      assert.equal(r2d1Res.diskRaw, writerCase.corruptRaw, `R2-D1 (${writerCase.label}): exact corrupt META_KEY bytes must be preserved`);
      assert.equal(r2d1Res.afterHasErr, true, `R2-D1 (${writerCase.label}): delayed valid StorageEvent MUST NOT clear metaReadError while live META_KEY is corrupt`);
      assert.equal(r2d1Res.afterErrRaw, writerCase.corruptRaw, `R2-D1 (${writerCase.label}): metaReadError.raw must retain live corrupt bytes`);
      assert.equal(r2d1Res.afterAlertDisplay, "flex", `R2-D1 (${writerCase.label}): #hud-save-alert MUST remain visible (display === 'flex') in-game, got: ${r2d1Res.afterAlertDisplay}`);
    }
    await ctxE.close();
  });

  await runSuite("R7-3", "M7a 闭关六路打断与满修渡劫老化落盘 + 登仙台元婴门控 + 远征零值计时修补 + 切景清除顿帧", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "R7-3-MedSpireExp", true);

    // Part A: P1 — All 6 meditation-interrupt keys + bonus openTribulationPrepModal flush meditateAgedDirty -> localStorage
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const g = s.game;
      g.realm = "foundation";
      g.xp = 0;
      g.mp = 200;
      g.bondTiers = { shen: 1, pei: 1 };
      g.aids = { shen: true, pei: true };
      g.seenUnlockIds = api.UNLOCK_TUTORIAL_CATALOG.map(c => c.id);
      g.elapsedMonths = 100;
      api.enterSanctumHub();
      s.arena.enemies = [];
      api.saveGame();
      api.updateHud(true);
      api.focusBattlefield();
    });

    // A1: Live 3s meditation tick -> KeyZ (triggerSkyJump) flushes elapsedMonths to localStorage
    await page.keyboard.press("KeyB");
    await page.waitForFunction(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return s.arena.player.meditating === true && s.game.elapsedMonths >= 101 && s.arena.player.meditateAgedDirty === true;
    }, null, { timeout: 6000 });
    await page.keyboard.press("KeyZ");
    await page.waitForTimeout(80);
    const afterKeyZ = await page.evaluate((sk) => {
      const s = window.__CHENYUAN_V25__.getState();
      const stored = JSON.parse(localStorage.getItem(sk));
      return {
        meditating: s.arena.player.meditating,
        ageTick: s.arena.player.meditateAgeTick,
        dirty: s.arena.player.meditateAgedDirty,
        memMonths: s.game.elapsedMonths,
        storedMonths: stored?.game?.elapsedMonths
      };
    }, STORAGE_KEY);
    assert.equal(afterKeyZ.meditating, false, "P1 (KeyZ): triggerSkyJump must end meditation");
    assert.equal(afterKeyZ.ageTick, 0, "P1 (KeyZ): triggerSkyJump must reset meditateAgeTick");
    assert.equal(afterKeyZ.dirty, false, "P1 (KeyZ): triggerSkyJump must clear meditateAgedDirty");
    assert.equal(afterKeyZ.storedMonths, afterKeyZ.memMonths, "P1 (KeyZ): triggerSkyJump must flush elapsedMonths to localStorage");

    // A2: Remaining 5 interrupt keys via real KeyB + mainLoop aging frame + real keypress
    const otherInterrupts = [
      ["Space", "triggerDashParry"],
      ["KeyF", "triggerSwordBlink"],
      ["Backquote", "triggerPostureSwitch"],
      ["KeyC", "castSoulSpiritSkill"],
      ["KeyV", "triggerTagTeamSwitch"]
    ];
    for (const [keyCode, fnLabel] of otherInterrupts) {
      const monthsBefore = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        const p = s.arena.player;
        p.z = 0; p.vz = 0; p.dashTimer = 0; p.slashCd = 0; p.jumpCd = 0; p.dashCd = 0; p.blinkCd = 0;
        s.arena.hitStop = 0;
        s.arena.fireZones = []; s.arena.frostPools = []; s.arena.soulAvatars = []; s.arena.activeAllies = []; s.arena.enemies = [];
        s.arena.soulCd = 0; s.arena.tagSwitchCd = 0; s.arena.switchMorphCd = 0; s.arena.morphCd = 0;
        s.game.mp = 200;
        s.game.xp = 0;
        api.focusBattlefield();
        return s.game.elapsedMonths;
      });
      await page.keyboard.press("KeyB");
      await page.waitForFunction(() => window.__CHENYUAN_V25__.getState().arena.player.meditating === true, null, { timeout: 2500 }).catch(async (e) => {
        const diag = await page.evaluate(() => {
          const api = window.__CHENYUAN_V25__;
          const s = api.getState();
          return { meditating: s.arena.player.meditating, paused: s.arena.paused, tokens: api.getPauseTokens(), hitStop: s.arena.hitStop, xp: s.game.xp, xpCap: s.realmSpec?.xpCap, modal: document.getElementById("modal-backdrop")?.classList.contains("open"), activeId: document.activeElement?.id, activeTag: document.activeElement?.tagName };
        });
        throw new Error(`R7-3 A2 [${keyCode}/${fnLabel}] wait meditating failed: ${e.message} diag=${JSON.stringify(diag)}`);
      });
      await page.evaluate(() => {
        window.__CHENYUAN_V25__.getState().arena.player.meditateAgeTick = 3.01;
      });
      await page.waitForFunction((mb) => {
        const s = window.__CHENYUAN_V25__.getState();
        return s.game.elapsedMonths >= mb + 1 && s.arena.player.meditateAgedDirty === true;
      }, monthsBefore, { timeout: 2500 }).catch(async (e) => {
        const diag = await page.evaluate(() => {
          const s = window.__CHENYUAN_V25__.getState();
          return { meditating: s.arena.player.meditating, ageTick: s.arena.player.meditateAgeTick, dirty: s.arena.player.meditateAgedDirty, months: s.game.elapsedMonths, paused: s.arena.paused };
        });
        throw new Error(`R7-3 A2 [${keyCode}/${fnLabel}] wait age failed: ${e.message} diag=${JSON.stringify(diag)}`);
      });
      const beforeInterrupt = await page.evaluate((sk) => {
        const s = window.__CHENYUAN_V25__.getState();
        const stored = JSON.parse(localStorage.getItem(sk));
        return { mem: s.game.elapsedMonths, stored: stored?.game?.elapsedMonths };
      }, STORAGE_KEY);
      assert.ok(beforeInterrupt.stored < beforeInterrupt.mem, `P1 (${keyCode}/${fnLabel}): aging must start unflushed before interrupt`);

      await page.keyboard.press(keyCode);
      await page.waitForTimeout(80);
      const afterInterrupt = await page.evaluate((sk) => {
        const s = window.__CHENYUAN_V25__.getState();
        const stored = JSON.parse(localStorage.getItem(sk));
        return {
          meditating: s.arena.player.meditating,
          ageTick: s.arena.player.meditateAgeTick,
          dirty: s.arena.player.meditateAgedDirty,
          mem: s.game.elapsedMonths,
          stored: stored?.game?.elapsedMonths
        };
      }, STORAGE_KEY);
      assert.equal(afterInterrupt.meditating, false, `P1 (${keyCode}/${fnLabel}): must end meditation`);
      assert.equal(afterInterrupt.ageTick, 0, `P1 (${keyCode}/${fnLabel}): must reset meditateAgeTick`);
      assert.equal(afterInterrupt.dirty, false, `P1 (${keyCode}/${fnLabel}): must clear meditateAgedDirty`);
      assert.equal(afterInterrupt.stored, afterInterrupt.mem, `P1 (${keyCode}/${fnLabel}): must flush elapsedMonths to localStorage`);
    }

    // A3: Bonus P1 — Pressing KeyB at full XP while meditating opens tribulation prep modal AND flushes meditateAgedDirty
    for (const bossDefeated of [false, true]) {
      const monthsBefore = await page.evaluate((defeated) => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "foundation";
        s.game.xp = 0;
        s.arena.hitStop = 0;
        s.arena.fireZones = []; s.arena.frostPools = []; s.arena.soulAvatars = []; s.arena.activeAllies = []; s.arena.enemies = [];
        s.game.defeatedStageBosses = defeated ? { 0: true, 1: true, 2: true } : {};
        api.focusBattlefield();
        return s.game.elapsedMonths;
      }, bossDefeated);
      await page.keyboard.press("KeyB");
      await page.waitForFunction(() => window.__CHENYUAN_V25__.getState().arena.player.meditating === true, null, { timeout: 2500 }).catch(async (e) => {
        const diag = await page.evaluate(() => {
          const api = window.__CHENYUAN_V25__;
          const s = api.getState();
          return { meditating: s.arena.player.meditating, paused: s.arena.paused, tokens: api.getPauseTokens(), hitStop: s.arena.hitStop, xp: s.game.xp, xpCap: s.realmSpec?.xpCap, modal: document.getElementById("modal-backdrop")?.classList.contains("open"), activeId: document.activeElement?.id, activeTag: document.activeElement?.tagName };
        });
        throw new Error(`R7-3 A3 [bossDefeated=${bossDefeated}] wait meditating failed: ${e.message} diag=${JSON.stringify(diag)}`);
      });
      await page.evaluate(() => {
        window.__CHENYUAN_V25__.getState().arena.player.meditateAgeTick = 3.01;
      });
      await page.waitForFunction((mb) => {
        const s = window.__CHENYUAN_V25__.getState();
        return s.game.elapsedMonths >= mb + 1 && s.arena.player.meditateAgedDirty === true;
      }, monthsBefore, { timeout: 2500 }).catch(async (e) => {
        const diag = await page.evaluate(() => {
          const s = window.__CHENYUAN_V25__.getState();
          return { meditating: s.arena.player.meditating, ageTick: s.arena.player.meditateAgeTick, dirty: s.arena.player.meditateAgedDirty, months: s.game.elapsedMonths, paused: s.arena.paused };
        });
        throw new Error(`R7-3 A3 [bossDefeated=${bossDefeated}] wait age failed: ${e.message} diag=${JSON.stringify(diag)}`);
      });
      // Fill XP while still meditating, then press KeyB -> openTribulationPrepModal
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.xp = s.realmSpec.xpCap;
      });
      await page.keyboard.press("KeyB");
      await page.waitForSelector("#modal-backdrop.open", { timeout: 3000 });
      const afterTribPrep = await page.evaluate((sk) => {
        const s = window.__CHENYUAN_V25__.getState();
        const stored = JSON.parse(localStorage.getItem(sk));
        return {
          meditating: s.arena.player.meditating,
          ageTick: s.arena.player.meditateAgeTick,
          dirty: s.arena.player.meditateAgedDirty,
          mem: s.game.elapsedMonths,
          stored: stored?.game?.elapsedMonths
        };
      }, STORAGE_KEY);
      assert.equal(afterTribPrep.meditating, false, `P1 bonus (tribPrep bossDefeated=${bossDefeated}): must end meditation`);
      assert.equal(afterTribPrep.ageTick, 0, `P1 bonus (tribPrep bossDefeated=${bossDefeated}): must reset meditateAgeTick`);
      assert.equal(afterTribPrep.dirty, false, `P1 bonus (tribPrep bossDefeated=${bossDefeated}): must clear meditateAgedDirty`);
      assert.equal(afterTribPrep.stored, afterTribPrep.mem, `P1 bonus (tribPrep bossDefeated=${bossDefeated}): must flush elapsedMonths to localStorage`);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"), null, { timeout: 3000 });
    }

    // Part B: P2 — startCelestialSpireRun enforces nascent realm gate
    const spireGateRes = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "golden";
      s.game.bestSpireFloor = 0;
      s.arena.celestialSpire = null;
      api.startCelestialSpireRun(1);
      const blockedInGolden = !s.arena.celestialSpire;
      s.game.realm = "nascent";
      api.startCelestialSpireRun(1);
      const allowedInNascent = Boolean(s.arena.celestialSpire && s.arena.celestialSpire.active);
      api.initArenaStage(0, false);
      return { blockedInGolden, allowedInNascent };
    });
    assert.equal(spireGateRes.blockedInGolden, true, "P2: startCelestialSpireRun(1) must be blocked in golden realm");
    assert.equal(spireGateRes.allowedInNascent, true, "P2: startCelestialSpireRun(1) must be allowed in nascent realm");

    // Part C: P3 — Expedition tickTimer === 0 immediately fires thunder support & respects 600 stones / 5 stars cap
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "nascent";
      s.game.bondTiers = { shen: 1 };
      s.game.expeditions = {
        assignments: { qinglan_vein: "shen" },
        bankedStones: 595,
        bankedStars: 5,
        supportThunderCount: 0,
        tickTimer: 0
      };
      api.initArenaStage(0, false);
      s.arena.paused = false;
      if (!s.arena.enemies.some(e => e.hp > 0 && !e.isDummy && !e.isTreasure)) {
        api.spawnSingleEnemy("wolf", 1260, 460, 1.0, false);
      }
      // Keep a durable enemy alive out of immediate nascent sword one-shot range so active combat stays true for the tick
      const liveFoe = s.arena.enemies.find(e => e.hp > 0 && !e.isDummy && !e.isTreasure);
      if (liveFoe) {
        liveFoe.x = Math.max(1220, (s.arena.player?.x || 400) + 760);
        liveFoe.hp = 99999;
        liveFoe.maxHp = 99999;
        liveFoe.state = "stun";
        liveFoe.timer = 99;
      }
    });
    await page.waitForFunction(() => (window.__CHENYUAN_V25__.getState().game.expeditions?.supportThunderCount || 0) >= 1, null, { timeout: 3000 });
    const expZeroRes = await page.evaluate(() => {
      const ex = window.__CHENYUAN_V25__.getState().game.expeditions;
      return {
        bankedStones: ex.bankedStones,
        bankedStars: ex.bankedStars,
        supportThunderCount: ex.supportThunderCount
      };
    });
    assert.equal(expZeroRes.bankedStones, 600, "P3: tickTimer === 0 must fire yield immediately and cap bankedStones at 600");
    assert.equal(expZeroRes.bankedStars, 5, "P3: tickTimer === 0 must cap bankedStars at 5");
    assert.ok(expZeroRes.supportThunderCount >= 1, "P3: tickTimer === 0 must immediately trigger thunder support");

    // Part D: P6 — arena.hitStop = 0 reset in enterSanctumHub & initArenaStage
    const hitStopRes = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.hitStop = 0.45;
      api.enterSanctumHub();
      const afterHub = s.arena.hitStop;
      s.arena.hitStop = 0.45;
      api.initArenaStage(0, false);
      const afterStage = s.arena.hitStop;
      return { afterHub, afterStage };
    });
    assert.equal(hitStopRes.afterHub, 0, "P6: enterSanctumHub() must reset arena.hitStop to 0");
    assert.equal(hitStopRes.afterStage, 0, "P6: initArenaStage() must reset arena.hitStop to 0");
    await ctx.close();
  });

  // ============================================================================
  // Q3-1 (F19): STAT/YIELD LEDGER, EFFECTIVE GEAR PARITY & COPY ALIGNMENT
  // ============================================================================
  await runSuite("Q3-1", "F19 computeCombatStatLedger parity, 0.08 gear step, aligned copy & <details> breakdown within Mortal <=14 button budget", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q3-1", true);
    try {
      const res = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        const g = s.game;
        const a = s.arena;

        // 1. Ledger totals === getCombatStats exact parity + soft-cap M2-4 invariant
        g.realm = "golden";
        g.stones = 2500;
        g.laws = ["wealth_power", "age_might", "karma_resonance"];
        g.elapsedMonths = 720;
        g.choices = { c1: "a", c2: "b", c3: "c", c4: "d", c5: "e", c6: "f" };
        g.karmaScore = -50;
        g.statMultBonus = 1.6;
        const ledger = api.computeCombatStatLedger(g);
        const stats = api.getCombatStats(g);
        const parity = (
          ledger.totals.atk === stats.atk &&
          ledger.totals.maxHp === stats.maxHp &&
          ledger.totals.maxMp === stats.maxMp &&
          ledger.totals.dmgReduce === stats.dmgReduce &&
          ledger.totals.crit === stats.crit &&
          ledger.totals.critMult === stats.critMult &&
          ledger.totals.atkHaste === stats.atkHaste &&
          ledger.totals.speed === stats.speed &&
          ledger.totals.statBreakdown.baseAtk === stats.statBreakdown.baseAtk &&
          ledger.totals.statBreakdown.rawPassivePct === stats.statBreakdown.rawPassivePct &&
          ledger.totals.statBreakdown.cappedPassivePct === stats.statBreakdown.cappedPassivePct &&
          ledger.totals.statBreakdown.activeMult === stats.statBreakdown.activeMult
        );

        // 2. Unified 0.08 gear enhancement step (effectiveGearVal vs getGearTotals vs formatGearStats)
        const testWpn = { slot: "weapon", rarity: 3, name: "测试剑", atk: 50, lvl: 5 };
        const effVal = api.effectiveGearVal(testWpn, "atk", 5);
        const expectedVal = Math.round(50 * (1 + 5 * api.GEAR_ENHANCE_STEP_PCT));
        g.equippedGear = { weapon: testWpn, armor: null, ring: null };
        const totals = api.getGearTotals(g);
        const fmtStr = api.formatGearStats(testWpn);

        // 3. Copy-vs-engine alignment checks (DESTINY_FRUITS, SACRED_AFFIXES, GOURD_SOAKS, PERKS, PRIMORDIAL_AWAKENINGS, posture, boss banner)
        const perksById = Object.fromEntries(api.PERKS.map(p => [p.id, p.desc]));
        const affixesById = Object.fromEntries(api.SACRED_AFFIXES.map(af => [af.id, af]));
        a.weaponPosture = "qinglian";
        api.updateHud();
        const postureSub = document.getElementById("posture-sub-txt")?.textContent || "";

        // Boss banner reversed domain & stun copy
        a.enemies = [];
        api.spawnSingleEnemy("wolf", 700, 480, 1.0, true, "雾隐狼王");
        a.reversedDomainTimer = 5;
        api.updateHud();
        const bossRevTxt = document.getElementById("boss-banner-state")?.textContent || "";
        a.reversedDomainTimer = 0;
        if (a.enemies[0]) a.enemies[0].state = "stun";
        g.laws = [];
        api.updateHud();
        const bossStunBaseTxt = document.getElementById("boss-banner-state")?.textContent || "";
        g.laws = ["stagger_surge"];
        api.updateHud();
        const bossStunLawTxt = document.getElementById("boss-banner-state")?.textContent || "";

        // Story tab Karma copy check
        g.karmaScore = -40;
        document.getElementById("nav-btn-story").click();
        const karmaDemonicHtml = document.getElementById("panel-scroll-body")?.textContent || "";
        g.karmaScore = 40;
        api.renderDrawerContent();
        const karmaRighteousHtml = document.getElementById("panel-scroll-body")?.textContent || "";

        return {
          parity,
          entryCount: ledger.entries.length,
          rawPassive: stats.statBreakdown.rawPassivePct,
          cappedPassive: stats.statBreakdown.cappedPassivePct,
          activeMult: stats.statBreakdown.activeMult,
          stepPct: api.GEAR_ENHANCE_STEP_PCT,
          effVal,
          expectedVal,
          totalsAtk: totals.atk,
          fmtStr,
          fruits: api.DESTINY_FRUITS,
          affixesById,
          soaks: api.GOURD_SOAKS,
          perksById,
          primArmor: api.PRIMORDIAL_AWAKENINGS.armor.desc,
          postureSub,
          bossRevTxt,
          bossStunBaseTxt,
          bossStunLawTxt,
          karmaDemonicHtml,
          karmaRighteousHtml
        };
      });

      assert.equal(res.parity, true, "computeCombatStatLedger().totals must strictly match getCombatStats()");
      assert.ok(res.entryCount >= 5, `Expected structured ledger entries, got ${res.entryCount}`);
      assert.ok(res.cappedPassive < res.rawPassive && res.cappedPassive < 1.66, "Soft-cap passive pool must stay strictly bounded");
      assert.ok(res.activeMult <= 1.95, `activeMult must stay <= 1.95, got ${res.activeMult}`);
      assert.equal(res.stepPct, 0.08);
      assert.equal(res.effVal, res.expectedVal, "effectiveGearVal must use 0.08 per level (not drifted 0.14)");
      assert.equal(res.totalsAtk, res.expectedVal, "getGearTotals must match effectiveGearVal");
      assert.ok(res.fmtStr.includes(`攻+${res.expectedVal}`), `formatGearStats must match unified 0.08 step: ${res.fmtStr}`);

      assert.ok(res.fruits.sword_twin.desc.includes("+2") && !res.fruits.sword_twin.desc.includes("+3"));
      assert.ok(res.fruits.lotus_body.desc.includes("+35%") && !res.fruits.lotus_body.desc.includes("+65%"));
      assert.ok(res.fruits.glutton_pill.desc.includes("+6") && res.fruits.glutton_pill.desc.includes("+18"));
      assert.ok(res.fruits.eternal_pine.desc.includes("+10%") && res.fruits.eternal_pine.desc.includes("+3%") && res.fruits.eternal_pine.desc.includes("+32%"));
      assert.ok(res.affixesById.wind_rider.desc.includes("+10%") && !res.affixesById.wind_rider.desc.includes("+12%"));
      assert.ok(res.affixesById.vamp_blade.desc.includes("3") && res.affixesById.vamp_blade.desc.includes("1.5%"));
      assert.ok(res.soaks.iron_lotus.desc.includes("48%"));
      assert.ok(res.soaks.wind_feather.desc.includes("+22%") && !res.soaks.wind_feather.desc.includes("+30%"));
      assert.ok(res.soaks.crimson_vine.desc.includes("+18%") && !res.soaks.crimson_vine.desc.includes("+25%"));
      assert.ok(res.perksById.sword_bone.includes("+5") && res.perksById.sword_bone.includes("+8%"));
      assert.ok(res.perksById.sword_sovereign.includes("+12") && res.perksById.sword_sovereign.includes("+18%"));
      assert.ok(res.perksById.calamity_phoenix.includes("+18") && res.perksById.calamity_phoenix.includes("+22%"));
      assert.ok(res.perksById.primordial_sage.includes("+10%"));
      assert.ok(res.primArmor.includes("25%") && !res.primArmor.includes("30%"));
      assert.ok(res.postureSub.includes("+14%") && !res.postureSub.includes("+28%"));
      assert.ok(res.bossRevTxt.includes("+20%") && !res.bossRevTxt.includes("+30%"));
      assert.ok(res.bossStunBaseTxt.includes("1.45×") && res.bossStunLawTxt.includes("1.65×") && !res.bossStunBaseTxt.includes("200%"));
      assert.ok(res.karmaDemonicHtml.includes("+18%") && res.karmaDemonicHtml.includes("+22%") && !res.karmaDemonicHtml.includes("+26%"));
      assert.ok(res.karmaRighteousHtml.includes("+6%") && res.karmaRighteousHtml.includes("+12"));

      // 4. Mortal Cultivate <details id="stat-breakdown-details"> renders with 0 extra <button> elements (<= 14 total)
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        const fresh = api.createFreshGame("凡境测试", "sword_bone", 0);
        Object.assign(s.game, fresh);
        api.updateHud();
      });
      await page.click("#nav-btn-cultivate");
      await page.waitForSelector("#stat-breakdown-details");
      const cultCheck = await page.evaluate(() => {
        const det = document.getElementById("stat-breakdown-details");
        const body = document.getElementById("panel-scroll-body");
        const visibleBtns = Array.from(body.querySelectorAll("button")).filter(b => getComputedStyle(b).display !== "none").length;
        const innerBtns = det ? det.querySelectorAll("button").length : -1;
        return { hasDetails: Boolean(det), innerBtns, visibleBtns };
      });
      assert.equal(cultCheck.hasDetails, true);
      assert.equal(cultCheck.innerBtns, 0, "Stat ledger <details> must add 0 <button> elements");
      assert.ok(cultCheck.visibleBtns <= 14, `Mortal Cultivate visible buttons must stay <= 14, got ${cultCheck.visibleBtns}`);
      await page.click("#stat-breakdown-details > summary");
      const openRows = await page.locator("#stat-breakdown-details[open] .stat-ledger-row").count();
      assert.ok(openRows >= 1, "Opening #stat-breakdown-details must display active stat ledger rows");
    } finally {
      await ctx.close();
    }
  });

  // ============================================================================
  // Q3-2 (F20): SCHOOL IDENTITY, 6-ASPECT HUD, DOJO DRILLS, NON-FARMING GUARD & D02 SANDBOX PROTOTYPE
  // ============================================================================
  await runSuite("Q3-2", "F20 6-aspect HUD sync, 3 Dojo drills, Sanctum non-farming guard & sandbox-only D02 slot prototype", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q3-2", true);
    try {
      // 1. Outside Sanctum/Sandbox: #dojo-training-hud hidden, D02 prototype rejected, Mortal HUD buttons <= 14
      const formalCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        const protoDeny = api.setSandboxSlotPrototype(true);
        const btnProto = document.getElementById("btn-sandbox-slot-proto");
        const dojoHud = document.getElementById("dojo-training-hud");
        const btns = Array.from(document.querySelectorAll("button")).filter(el => {
          if (el.closest("#welcome-screen, #side-panel, #modal-backdrop, #pavilion-popover, #story-dialogue-bar, #ending-overlay")) return false;
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0 && r.width > 2 && r.height > 2;
        });

        // Verify right-click label syncs dynamically to getCurrentSixAspectSpec() (never stale 挑月斩/十字斩)
        s.game.weaponForm = "spear";
        s.arena.weaponPosture = "xuanzhong";
        s.arena.player.comboWindow = 0.9;
        s.arena.morphCd = 0;
        api.updateHud();
        const specSpearHeavy = api.getCurrentSixAspectSpec();
        const lblMorph = document.getElementById("lbl-recall-marks")?.textContent || "";
        const morphAttr = document.getElementById("orb-recall")?.getAttribute("data-morph-state") || "";

        s.arena.player.comboWindow = 0;
        s.arena.enemies = [];
        api.updateHud();
        const lblIdle = document.getElementById("lbl-recall-marks")?.textContent || "";
        const idleAttr = document.getElementById("orb-recall")?.getAttribute("data-morph-state") || "";

        // Build positioning summary differs cleanly between sword and talisman
        s.game.school = "sword";
        const posSword = api.getBuildPositioningSummary(s.game);
        s.game.school = "talisman";
        const posTal = api.getBuildPositioningSummary(s.game);

        return {
          protoDeny,
          protoBtnHidden: !btnProto || getComputedStyle(btnProto).display === "none",
          dojoHudHidden: !dojoHud || getComputedStyle(dojoHud).display === "none",
          mortalHudBtnCount: btns.length,
          specSpearHeavyShort: specSpearHeavy.short,
          lblMorph,
          morphAttr,
          lblIdle,
          idleAttr,
          posSword,
          posTal
        };
      });
      assert.equal(formalCheck.protoDeny.active, false);
      assert.equal(formalCheck.protoDeny.reason, "sandbox_only");
      assert.equal(formalCheck.protoBtnHidden, true, "#btn-sandbox-slot-proto must remain hidden outside sandbox");
      assert.equal(formalCheck.dojoHudHidden, true, "#dojo-training-hud must remain hidden outside Sanctum");
      assert.ok(formalCheck.mortalHudBtnCount <= 14, `Mortal HUD visible buttons must stay <= 14, got ${formalCheck.mortalHudBtnCount}`);
      assert.equal(formalCheck.lblMorph, formalCheck.specSpearHeavyShort, "Right-click label must sync to active 6-aspect spec");
      assert.equal(formalCheck.morphAttr, "morph");
      assert.equal(formalCheck.lblIdle, "爆剑");
      assert.equal(formalCheck.idleAttr, "idle");
      assert.notEqual(formalCheck.posSword.roleTitle, formalCheck.posTal.roleTitle);

      // 2. Sanctum Dojo: 3 focused drills advance 0 -> 3/3 (grade S) & guard prevents formal stone/bounty farming
      const dojoCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.stones = 100;
        s.game.goalStats = { techBreaks: 0 };
        s.game.achievements = [];
        api.enterSanctumHub({ skipSave: true });
        const hudVisible = document.getElementById("dojo-training-hud")?.classList.contains("active");

        // Drill 1: drill_mark_detonate (needs >=3 marks per detonate; <3 should not advance)
        api.setDojoMode("drill_mark_detonate");
        api.recordDojoDrillEvent("detonate", 2);
        const d1Under = api.getDojoTrainingState().progress;
        api.recordDojoDrillEvent("detonate", 3);
        api.recordDojoDrillEvent("detonate", 4);
        api.recordDojoDrillEvent("detonate", 3);
        const d1Done = api.getDojoTrainingState();

        // Drill 2: drill_dodge_counter
        api.setDojoMode("drill_dodge_counter");
        api.recordDojoDrillEvent("parry");
        api.recordDojoDrillEvent("dodge");
        api.recordDojoDrillEvent("parry");
        const d2Done = api.getDojoTrainingState();

        // Drill 3: drill_morph_combo
        api.setDojoMode("drill_morph_combo");
        api.recordDojoDrillEvent("morph", "万剑游龙刺");
        api.recordDojoDrillEvent("morph", "万剑游龙刺");
        api.recordDojoDrillEvent("morph", "万剑游龙刺");
        const d3Done = api.getDojoTrainingState();

        // Trigger real parry & detonate in Sanctum to verify ZERO formal stones / techBreaks / ach_combo farmed
        const dummy = s.arena.enemies.find(e => e.isDummy);
        if (dummy) {
          dummy.swordMarks = 4;
          dummy.state = "windup";
          dummy.perilous = false;
          dummy.timer = 0.2;
          s.arena.player.x = dummy.x - 40;
          s.arena.player.y = dummy.y;
        }
        s.arena.player.dashCd = 0;
        api.triggerDashParry();
        s.arena.player.recallCd = 0;
        s.arena.player.comboWindow = 0;
        api.recallAndDetonateSwords();

        return {
          hudVisible,
          d1Under,
          d1Done,
          d2Done,
          d3Done,
          stonesAfter: s.game.stones,
          techBreaksAfter: s.game.goalStats.techBreaks,
          achievementsAfter: s.game.achievements.slice()
        };
      });
      assert.equal(dojoCheck.hudVisible, true);
      assert.equal(dojoCheck.d1Under, 0, "Detonating <3 marks must not advance drill_mark_detonate");
      assert.equal(dojoCheck.d1Done.completed, true);
      assert.equal(dojoCheck.d1Done.grade, "S");
      assert.equal(dojoCheck.d2Done.completed, true);
      assert.equal(dojoCheck.d3Done.completed, true);
      assert.equal(dojoCheck.stonesAfter, 100, "Sanctum Dojo parry/detonate must NOT farm formal stones");
      assert.equal(dojoCheck.techBreaksAfter, 0, "Sanctum Dojo must NOT farm formal techBreaks");
      assert.equal(dojoCheck.achievementsAfter.includes("ach_break"), false, "Sanctum Dojo must NOT unlock formal achievements");

      // 2b. Additive Q3-2 checks: live drill trigger wiring, standalone updateBossBannerAndRecallOrb consistency,
      //     Sanctum Dojo glutton_pill & KeyR ach_coop non-farming, and formal Sect Defense parry rewards
      const dojoExtra = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();

        // Live drill wiring: detonate -> drill_mark_detonate, parry -> drill_dodge_counter, morph -> drill_morph_combo
        api.enterSanctumHub({ skipSave: true });
        api.setDojoMode("drill_mark_detonate");
        const dm1 = s.arena.enemies.find(e => e.isDummy);
        if (dm1) dm1.swordMarks = 4;
        s.arena.player.recallCd = 0;
        s.arena.player.comboWindow = 0;
        api.recallAndDetonateSwords();
        const liveDetonateProg = api.getDojoTrainingState().progress;

        api.setDojoMode("drill_dodge_counter");
        const dm2 = s.arena.enemies.find(e => e.isDummy);
        if (dm2) {
          dm2.state = "windup";
          dm2.perilous = false;
          dm2.timer = 0.25;
          s.arena.player.x = dm2.x - 40;
          s.arena.player.y = dm2.y;
        }
        s.arena.player.dashCd = 0;
        api.triggerDashParry();
        const liveParryProg = api.getDojoTrainingState().progress;

        api.setDojoMode("drill_morph_combo");
        s.arena.player.comboWindow = 0.9;
        s.arena.morphCd = 0;
        s.arena.player.recallCd = 0;
        api.recallAndDetonateSwords();
        const liveMorphProg = api.getDojoTrainingState().progress;

        // Standalone updateBossBannerAndRecallOrb() must NOT overwrite #lbl-recall-marks when idle
        s.arena.player.comboWindow = 0;
        s.arena.enemies.forEach(e => { e.swordMarks = 0; });
        api.updateHud();
        api.updateBossBannerAndRecallOrb();
        const lblAfterStandaloneBanner = document.getElementById("lbl-recall-marks")?.textContent || "";

        // Sanctum Dojo glutton_pill + KeyR summonAllyCoop must NOT farm permanent stats or ach_coop
        s.game.realm = "golden";
        s.game.mp = 200;
        s.game.destinyFruits = ["glutton_pill"];
        s.game.atkFlatBonus = 0;
        s.game.maxHpBonus = 0;
        s.game.achievements = [];
        s.game.gourd = { charges: 5, maxCharges: 5, soaks: ["iron_lotus"], parryChargeProg: 0 };
        api.useQuickHealingPill();
        const dojoGluttonAtk = s.game.atkFlatBonus;
        const dojoGluttonHp = s.game.maxHpBonus;
        s.arena.player.allyCd = 0;
        api.summonAllyCoop();
        const dojoCoopAch = s.game.achievements.includes("ach_coop");

        // Formal Sect Defense (sectDefense.active === true) MUST keep formal parry stones, techBreaks & ach_break
        s.game.stones = 100;
        s.game.goalStats = { techBreaks: 0 };
        s.game.achievements = [];
        api.startSectDefenseSiege();
        const dojoActiveInSectDefense = api.isSanctumDojoActive();
        const siegeEnemy = s.arena.enemies.find(e => e.hp > 0 && !e.isDummy) || s.arena.enemies[0];
        if (siegeEnemy) {
          siegeEnemy.state = "windup";
          siegeEnemy.perilous = false;
          siegeEnemy.timer = 0.25;
          s.arena.player.x = siegeEnemy.x - 40;
          s.arena.player.y = siegeEnemy.y;
        }
        s.arena.player.dashCd = 0;
        api.triggerDashParry();
        const sdStones = s.game.stones;
        const sdTechBreaks = s.game.goalStats.techBreaks;
        const sdAchBreak = s.game.achievements.includes("ach_break");
        if (s.arena.sectDefense) s.arena.sectDefense.active = false;
        api.enterSanctumHub({ skipSave: true });

        return {
          liveDetonateProg,
          liveParryProg,
          liveMorphProg,
          lblAfterStandaloneBanner,
          dojoGluttonAtk,
          dojoGluttonHp,
          dojoCoopAch,
          dojoActiveInSectDefense,
          sdStones,
          sdTechBreaks,
          sdAchBreak
        };
      });
      assert.ok(dojoExtra.liveDetonateProg >= 1, `Live recallAndDetonateSwords must advance drill_mark_detonate, got ${dojoExtra.liveDetonateProg}`);
      assert.ok(dojoExtra.liveParryProg >= 1, `Live triggerDashParry must advance drill_dodge_counter, got ${dojoExtra.liveParryProg}`);
      assert.ok(dojoExtra.liveMorphProg >= 1, `Live morph strike must advance drill_morph_combo, got ${dojoExtra.liveMorphProg}`);
      assert.equal(dojoExtra.lblAfterStandaloneBanner, "爆剑", `Standalone updateBossBannerAndRecallOrb must not overwrite idle #lbl-recall-marks, got ${dojoExtra.lblAfterStandaloneBanner}`);
      assert.equal(dojoExtra.dojoGluttonAtk, 0, "Sanctum Dojo glutton_pill must NOT farm permanent ATK");
      assert.equal(dojoExtra.dojoGluttonHp, 0, "Sanctum Dojo glutton_pill must NOT farm permanent HP");
      assert.equal(dojoExtra.dojoCoopAch, false, "Sanctum Dojo summonAllyCoop must NOT unlock ach_coop");
      assert.equal(dojoExtra.dojoActiveInSectDefense, false, "isSanctumDojoActive() must be false during formal Sect Defense");
      assert.equal(dojoExtra.sdStones, 112, `Sect Defense parry must still award +12 stones, got ${dojoExtra.sdStones}`);
      assert.ok(dojoExtra.sdTechBreaks >= 1, `Sect Defense parry must still increment techBreaks, got ${dojoExtra.sdTechBreaks}`);
      assert.equal(dojoExtra.sdAchBreak, true, "Sect Defense parry must still unlock ach_break");

      // 3. Sandbox-only D02 slot prototype toggle & auto-reset on sandbox exit
      await page.click("#btn-pavilion-menu");
      await page.waitForSelector("#pavilion-popover.open #btn-toggle-arcana-all");
      await page.click("#btn-toggle-arcana-all");
      await page.waitForSelector("#modal-backdrop.open #btn-confirm-enter-sandbox");
      await page.click("#btn-confirm-enter-sandbox");
      await page.waitForFunction(() => Boolean(window.__CHENYUAN_V25__.getState().game?.unlockAllArcana) === true);

      const sbProto = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.enterSanctumHub({ skipSave: true });
        const btn = document.getElementById("btn-sandbox-slot-proto");
        const visibleInSandbox = Boolean(btn && btn.style.display !== "none");
        const onRes = api.setSandboxSlotPrototype(true);
        const dockHasClass = document.getElementById("action-skill-dock")?.classList.contains("sandbox-slot-proto-active");
        return { visibleInSandbox, onRes, dockHasClass };
      });
      assert.equal(sbProto.visibleInSandbox, true);
      assert.equal(sbProto.onRes.active, true);
      assert.equal(sbProto.dockHasClass, true);

      // Exit sandbox -> prototype must reset automatically
      await page.click("#btn-pavilion-menu");
      await page.waitForSelector("#pavilion-popover.open #btn-toggle-arcana-all");
      await page.click("#btn-toggle-arcana-all");
      await page.waitForFunction(() => Boolean(window.__CHENYUAN_V25__.getState().game?.unlockAllArcana) === false);
      const afterExit = await page.evaluate(() => ({
        proto: window.__CHENYUAN_V25__.getSandboxSlotPrototype(),
        dockHasClass: document.getElementById("action-skill-dock")?.classList.contains("sandbox-slot-proto-active"),
        btnHidden: document.getElementById("btn-sandbox-slot-proto")?.style.display === "none"
      }));
      assert.equal(afterExit.proto.active, false);
      assert.equal(afterExit.dockHasClass, false);
      assert.equal(afterExit.btnHidden, true);
    } finally {
      await ctx.close();
    }
  });

  // ============================================================================
  // Q3-3 (F21): REAL COMBAT CURVE, SCHOOL PARITY & EVALUATION HOOKS
  // ============================================================================
  await runSuite("Q3-3", "F21 real combat evaluation hooks, 6-realm monotonic curve & Sword vs Talisman identity", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q3-3", true);
    try {
      const matrixProbe = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const realms = ["mortal", "qi", "foundation", "golden", "nascent", "spirit"];
        const curve = realms.map(rid => {
          const gSw = api.createFreshGame("剑修", "sword_bone", 0);
          gSw.realm = rid; gSw.school = "sword";
          const gTl = api.createFreshGame("符修", "sword_bone", 0);
          gTl.realm = rid; gTl.school = "talisman";
          const stSw = api.getCombatStats(gSw);
          const stTl = api.getCombatStats(gTl);
          return {
            realm: rid,
            swAtk: stSw.atk,
            swHp: stSw.maxHp,
            swHaste: stSw.atkHaste,
            swCritMult: stSw.critMult,
            tlHaste: stTl.atkHaste,
            tlMpRegen: stTl.schoolSpec.mpRegenMult,
            tlSkillMult: stTl.schoolSpec.skillDmgMult,
            swMpRegen: stSw.schoolSpec.mpRegenMult,
            swSkillMult: stSw.schoolSpec.skillDmgMult
          };
        });

        // Verify live engine slash + stepArena deals real damage on a spawned enemy
        const s = api.getState();
        s.arena.sanctumMode = false;
        s.arena.paused = false;
        s.arena.enemies = [];
        api.spawnSingleEnemy("wolf", s.arena.player.x + 65, s.arena.player.y, 1.0, false);
        const startHp = s.arena.enemies[0].hp;
        document.dispatchEvent(new PointerEvent("pointermove", { clientX: s.arena.enemies[0].x, clientY: s.arena.enemies[0].y }));
        s.arena.player.slashCd = 0;
        api.fireManualSlash();
        api.stepArena(0.05);
        api.stepArena(0.05);
        const endHp = s.arena.enemies[0] ? s.arena.enemies[0].hp : 0;

        return {
          curve,
          singleHitCap: api.SINGLE_HIT_CAP_RATIO,
          stageScalingLen: api.STAGE_SCALING.length,
          dealtDamage: startHp - endHp
        };
      });

      assert.equal(matrixProbe.singleHitCap, 0.45);
      assert.equal(matrixProbe.stageScalingLen, 5);
      assert.ok(matrixProbe.dealtDamage > 0, `Live fireManualSlash + stepArena must deal real damage, got ${matrixProbe.dealtDamage}`);
      for (let i = 1; i < matrixProbe.curve.length; i++) {
        assert.ok(matrixProbe.curve[i].swAtk > matrixProbe.curve[i - 1].swAtk, `ATK must grow monotonically from ${matrixProbe.curve[i - 1].realm} to ${matrixProbe.curve[i].realm}`);
        assert.ok(matrixProbe.curve[i].swHp > matrixProbe.curve[i - 1].swHp, `MaxHP must grow monotonically`);
      }
      const mid = matrixProbe.curve[2];
      assert.ok(mid.swHaste > mid.tlHaste && mid.swCritMult > 1.48, "Sword school must retain higher haste/critMult");
      assert.ok(mid.tlMpRegen > mid.swMpRegen && mid.tlSkillMult > mid.swSkillMult, "Talisman school must retain higher MP regen & skillDmgMult");
    } finally {
      await ctx.close();
    }
  });

  // ============================================================================
  // Q3-4 (F22): AFFIX BUDGET, 1000-ROLL BOUNDS, D05 LEGACY GEAR PRESERVATION & ENGRAVE TAGS
  // ============================================================================
  await runSuite("Q3-4", "F22 GEAR_BUDGET_BY_RARITY 1000-roll bounds, deterministic pity, D05 legacy gear preservation & engrave build tags", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q3-4", true);
    try {
      const f22 = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        // Deterministic Mulberry32 PRNG for 1,000-roll outlier replay
        let seed = 20261124;
        const rng = () => {
          seed = (seed + 0x6D2B79F5) >>> 0;
          let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        let violations = 0;
        const r3Powers = [];
        const slots = ["weapon", "armor", "ring"];
        for (let i = 0; i < 1000; i++) {
          const stage = i % 5;
          const minR = Math.floor(i / 200); // 0..4
          const slot = slots[i % 3];
          const it = api.rollGearItem(stage, minR, slot, { usePity: false, rng });
          const check = api.computeGearAffixBudget(it);
          if (!check.withinBudget) violations += 1;
          if (it.rarity === 3 && stage === 2 && slot === "weapon") r3Powers.push(it.power);
        }
        r3Powers.sort((a, b) => a - b);
        const p10 = r3Powers[Math.floor(r3Powers.length * 0.1)] || 1;
        const p90 = r3Powers[Math.floor(r3Powers.length * 0.9)] || 1;

        // Deterministic pity verification (4th epic >=3, 8th mythic >=4)
        const pityGame = api.createFreshGame("保底测试", "sword_bone", 0);
        const lowRng = () => 0.01;
        const pityRarities = [];
        for (let k = 0; k < 8; k++) {
          const it = api.rollGearItem(0, 0, "weapon", { usePity: true, rng: lowRng, game: pityGame });
          pityRarities.push(it.rarity);
        }

        // D05 Legacy Gear Preservation: over-budget owned gear MUST NOT be clamped by normalizeLoadedGame
        const legacyWeapon = {
          uid: "legacy_god_sword",
          slot: "weapon",
          name: "旧档神剑",
          rarity: 2,
          lvl: 3,
          atk: 999,
          crit: 0.55,
          spd: 0.45,
          bonusSword: 3,
          affix: "vamp_blade",
          sell: 88,
          price: 200
        };
        const legacyRing = Object.assign({}, legacyWeapon, { uid: "legacy_bag_ring", slot: "ring", name: "旧档神佩" });
        const loaded = api.normalizeLoadedGame({
          name: "旧档老玩家",
          realm: "golden",
          equippedGear: { weapon: legacyWeapon, armor: null, ring: null },
          gearBag: [legacyRing]
        });

        // Open Affix Engrave modal and inspect build tags
        const s = api.getState();
        s.game.realm = "foundation";
        s.game.school = "talisman";
        s.game.stones = 200;
        if (!s.game.equippedGear.weapon) {
          s.game.equippedGear.weapon = api.rollGearItem(1, 2, "weapon", { usePity: false, rng });
        }
        api.openAffixEngraveModal("weapon");
        const modalTxt = document.getElementById("modal-content")?.textContent || "";
        api.closeModal();

        return {
          violations,
          p10,
          p90,
          pityRarities,
          loadedWpn: loaded.equippedGear.weapon,
          loadedBag0: loaded.gearBag[0],
          modalTxt
        };
      });

      assert.equal(f22.violations, 0, `1,000 seeded gear rolls must have 0 budget violations, got ${f22.violations}`);
      assert.ok(f22.p90 / Math.max(1, f22.p10) < 3.0, `Power spread p90/p10 must be tightly bounded (${f22.p10}..${f22.p90})`);
      assert.ok(f22.pityRarities[3] >= 3, `4th roll must trigger Epic pity (>=3), got ${JSON.stringify(f22.pityRarities)}`);
      assert.ok(f22.pityRarities[7] >= 4, `8th roll must trigger Mythic pity (>=4), got ${JSON.stringify(f22.pityRarities)}`);
      assert.equal(f22.loadedWpn.atk, 999, "D05: normalizeLoadedGame must NOT clamp legacy equipped weapon atk");
      assert.equal(f22.loadedWpn.crit, 0.55, "D05: normalizeLoadedGame must NOT clamp legacy equipped weapon crit");
      assert.equal(f22.loadedWpn.bonusSword, 3, "D05: normalizeLoadedGame must NOT clamp legacy equipped weapon bonusSword");
      assert.equal(f22.loadedBag0.atk, 999, "D05: normalizeLoadedGame must NOT clamp legacy gearBag item");
      assert.ok(f22.modalTxt.includes("御剑推荐") && f22.modalTxt.includes("雷符推荐") && f22.modalTxt.includes("生存推荐"), "Affix engrave modal must display build recommendation tags");
    } finally {
      await ctx.close();
    }
  });

  // ============================================================================
  // Q3-5 (F23): KM_DEMON_CORE ANTI-ARBITRAGE & 7-PATH PRE-ACTION LIFESPAN PREVIEW
  // ============================================================================
  await runSuite("Q3-5", "F23 km_demon_core anti-arbitrage, 7-path pre-action lifespan previews & first-time 75% warning explanation", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q3-5", true);
    try {
      const f23 = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const v23 = window.__CHENYUAN_V23__;
        const s = api.getState();
        const g = s.game;

        // 1. km_demon_core anti-arbitrage under demonic karma + 0.8x fair omen discount
        const fairIdx = api.CELESTIAL_OMENS.findIndex(o => o.id === "fair");
        g.realm = "spirit";
        g.karmaScore = -45;
        g.omenIndex = fairIdx >= 0 ? fairIdx : 0;
        g.karmaMarketBought = {};
        g.stones = 600;
        g.equippedGear = { weapon: null, armor: null, ring: null };
        g.gearBag = [];
        const specials = api.getKarmaMarketSpecials(g);
        const demonSpec = specials.find(sp => sp.id === "km_demon_core");
        const boughtOk = api.buyKarmaSpecialItem("km_demon_core");
        const wpn = api.getPendingCompareGear() || g.equippedGear.weapon || g.gearBag[g.gearBag.length - 1];

        // 2. Verify all 7 lifespan-consuming pre-action previews
        // Reset to Mortal near 75% threshold so previews show threshold crossing clearly
        const fresh = api.createFreshGame("寿元测试", "sword_bone", 0);
        Object.assign(g, fresh);
        g.realm = "qi";
        g.stones = 500;
        g.inventory.herb = 10;
        g.inventory.dew = 10;
        g.inventory.blood_fury_pill = 1;
        const lfBase = api.getLifespanInfo(g);
        // Set 2 months below 75% warning line
        g.elapsedMonths = Math.max(0, Math.floor(lfBase.maxMonths * 0.75) - (g.startAgeMonths || 216) - 2);
        api.updateHud();

        // Path 1: Alchemy Quick Craft tile + warning
        document.getElementById("nav-btn-alchemy").click();
        const alchemyDrawerTxt = document.getElementById("panel-scroll-body")?.textContent || "";

        // Path 2: Batch Craft modal (#batch-craft-lifespan-preview + keep ×5 / 15月 on #btn-confirm-batch-craft)
        api.openBatchCraftModal("healing", 5);
        const batchPrevTxt = document.getElementById("batch-craft-lifespan-preview")?.textContent || "";
        const batchBtnTxt = document.getElementById("btn-confirm-batch-craft")?.textContent || "";
        api.closeModal();

        // Path 3: Taixu Bagua Minigame (#taixu-craft-lifespan-preview showing 3 月)
        v23.openTaixuCraftMinigameModal("alchemy");
        const taixuPrevTxt = document.getElementById("taixu-craft-lifespan-preview")?.textContent || "";
        api.closeModal();

        // Path 4: Furnace Minigame (records lifespanPreview for rec.months)
        api.startFurnaceMinigame("healing");
        const furnacePrev = api.getFurnaceState().lifespanPreview;

        // Path 5: Meditation (#orb-meditate tip + #wave-sub-tag rate)
        s.arena.sanctumMode = false;
        s.arena.player.meditating = true;
        api.updateHud();
        const medTip = document.getElementById("orb-meditate")?.getAttribute("data-tip") || "";
        const waveSub = document.getElementById("wave-sub-tag")?.textContent || "";
        s.arena.player.meditating = false;

        // Path 6: Blood Fury Pill in Bag (⏳-2载)
        document.getElementById("nav-btn-bag").click();
        const bagTxt = document.getElementById("panel-scroll-body")?.textContent || "";
        api.closeDrawer();

        // Path 7: Tribulation Prep (12月/18月) & Tribulation Abort (18月 / 1.5载)
        g.defeatedStageBosses = { 0: true, 1: true };
        g.xp = api.REALMS[g.realm].xpCap;
        api.openTribulationPrepModal();
        const tribPrepTxt = document.getElementById("trib-prep-lifespan-preview")?.textContent || "";
        api.closeModal();
        api.openDefeatDecisionModal(true);
        const tribAbortTxt = document.getElementById("trib-abort-lifespan-preview")?.textContent || "";
        api.closeModal();

        // 3. First-time 75% crossing explanation sets seenLifespan75Tip === true
        const beforeTipFlag = g.seenLifespan75Tip;
        api.advanceLifespanMonths(6, "test_75");
        const afterTipFlag = g.seenLifespan75Tip;

        return {
          demonCost: demonSpec ? demonSpec.cost : 0,
          boughtOk,
          wpnSell: wpn ? wpn.sell : 9999,
          wpnAtk: wpn ? wpn.atk : 0,
          wpnAffix: wpn ? wpn.affix : null,
          alchemyDrawerTxt,
          batchPrevTxt,
          batchBtnTxt,
          taixuPrevTxt,
          furnaceMonths: furnacePrev ? furnacePrev.deltaMonths : 0,
          medTip,
          waveSub,
          bagTxt,
          tribPrepTxt,
          tribAbortTxt,
          beforeTipFlag,
          afterTipFlag
        };
      });

      assert.equal(f23.boughtOk, true);
      assert.ok(f23.demonCost >= Math.round(220 * 0.8), `km_demon_core cost under fair omen must be >= 176, got ${f23.demonCost}`);
      assert.ok(f23.wpnSell <= Math.floor(f23.demonCost * 0.45) && f23.wpnSell < f23.demonCost, `km_demon_core weapon sell (${f23.wpnSell}) must be <= 45% of cost (${f23.demonCost})`);
      assert.ok(f23.wpnAtk > 0 && f23.wpnAffix === "vamp_blade", "km_demon_core must preserve combat ATK and vamp_blade affix");

      assert.ok(f23.alchemyDrawerTxt.includes("⏳"), "Path 1: Alchemy drawer must show lifespan cost chip");
      assert.ok(f23.batchPrevTxt.includes("15 月") && f23.batchBtnTxt.includes("×5") && f23.batchBtnTxt.includes("15月"), "Path 2: Batch craft must show #batch-craft-lifespan-preview and preserve Q2-5 button copy");
      assert.ok(f23.taixuPrevTxt.includes("3 月"), `Path 3: Taixu minigame must show 3-month lifespan preview, got: ${f23.taixuPrevTxt}`);
      assert.equal(f23.furnaceMonths, 3, "Path 4: Furnace minigame must record rec.months lifespan preview");
      assert.ok(f23.medTip.includes("每 3 秒耗 1 月") && f23.waveSub.includes("每3秒耗1月寿元"), "Path 5: Meditation tooltip and #wave-sub-tag must show 1m/3s lifespan rate");
      assert.ok(f23.bagTxt.includes("⏳-2载"), "Path 6: Blood Fury Pill bag tile must show ⏳-2载");
      assert.ok(f23.tribPrepTxt.includes("12 月") && f23.tribPrepTxt.includes("18 月"), "Path 7a: Tribulation prep must preview 12m/18m lifespan");
      assert.ok(f23.tribAbortTxt.includes("18 月") && f23.tribAbortTxt.includes("1.5 载"), "Path 7b: Tribulation abort must preview 18m (1.5y) lifespan penalty");
      assert.equal(f23.beforeTipFlag, false);
      assert.equal(f23.afterTipFlag, true, "First-time 75% lifespan crossing must set game.seenLifespan75Tip");

      // 4. Additive Q3-5 checks: Spirit lifespan .toFixed(3) deadzone (5036->5037->5040), multi-band jump (73.9%->91.4%), and Taixu Round 2 preview refresh
      const f23Edge = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const v23 = window.__CHENYUAN_V23__;
        const s = api.getState();
        const g = s.game;

        // 4a. Spirit deadzone: 5036 -> 5037 (rawRatio < 0.75, rounded === 0.75) -> 5040 (exact 0.75)
        Object.assign(g, api.createFreshGame("化神寿元边界", "sword_bone", 0));
        g.realm = "spirit";
        g.seenLifespan75Tip = false;
        g.elapsedMonths = 5036 - (g.startAgeMonths || 216);
        const prev5036to5037 = api.previewLifespanImpact(g, 1);
        api.advanceLifespanMonths(1, "deadzone_step1");
        const tipAfter5037 = Boolean(g.seenLifespan75Tip);
        const prev5037to5040 = api.previewLifespanImpact(g, 3);
        api.advanceLifespanMonths(3, "deadzone_step2");
        const tipAfter5040 = Boolean(g.seenLifespan75Tip);

        // 4b. Multi-band jump: Mortal 73.9% -> 91.4% must still set seenLifespan75Tip === true
        Object.assign(g, api.createFreshGame("跨阈测试", "sword_bone", 0));
        g.realm = "mortal";
        g.seenLifespan75Tip = false;
        g.elapsedMonths = 550 - (g.startAgeMonths || 216); // 550/744 = 73.92%
        api.advanceLifespanMonths(130, "multi_band_jump"); // 680/744 = 91.40%
        const multiJumpInfo = api.getLifespanInfo(g);
        const multiJumpTip = Boolean(g.seenLifespan75Tip);

        // 4c. Taixu Round 2 #taixu-craft-lifespan-preview refresh (qi: 851 -> 854, Round 2 crosses 75% = 855)
        Object.assign(g, api.createFreshGame("太虚二轮测试", "sword_bone", 0));
        g.realm = "qi";
        g.elapsedMonths = 851 - (g.startAgeMonths || 216);
        v23.openTaixuCraftMinigameModal("alchemy");
        const r1PrevTxt = document.getElementById("taixu-craft-lifespan-preview")?.textContent || "";
        v23.strikeTaixuCraftMinigame(true);
        v23.strikeTaixuCraftMinigame(true);
        v23.strikeTaixuCraftMinigame(true);
        const r2PrevTxt = document.getElementById("taixu-craft-lifespan-preview")?.textContent || "";
        const r2PrevHasWarn = document.getElementById("taixu-craft-lifespan-preview")?.classList.contains("warn") || false;
        api.closeModal();

        return {
          prev5036to5037Crossed: prev5036to5037.crossedThresholds,
          tipAfter5037,
          prev5037to5040Crossed: prev5037to5040.crossedThresholds,
          tipAfter5040,
          multiJumpStatus: multiJumpInfo.status,
          multiJumpTip,
          r1PrevTxt,
          r2PrevTxt,
          r2PrevHasWarn
        };
      });
      assert.deepEqual(f23Edge.prev5036to5037Crossed, [], "Spirit 5036->5037 must NOT false-positive on 75% threshold");
      assert.equal(f23Edge.tipAfter5037, false, "Spirit 5036->5037 must NOT trigger seenLifespan75Tip prematurely");
      assert.ok(f23Edge.prev5037to5040Crossed.includes(75), "Spirit 5037->5040 preview must report crossing 75%");
      assert.equal(f23Edge.tipAfter5040, true, "Spirit 5037->5040 must trigger seenLifespan75Tip");
      assert.equal(f23Edge.multiJumpStatus, "critical");
      assert.equal(f23Edge.multiJumpTip, true, "Jumping 73.9%->91.4% in one step must still set seenLifespan75Tip");
      assert.equal(f23Edge.r1PrevTxt.includes("75%"), false, "Taixu Round 1 at 851/1140 should not warn 75% yet");
      assert.ok(f23Edge.r2PrevTxt.includes("75%") && f23Edge.r2PrevHasWarn, `Taixu Round 2 at 854/1140 must refresh #taixu-craft-lifespan-preview with 75% warning, got: ${f23Edge.r2PrevTxt}`);
    } finally {
      await ctx.close();
    }
  });

  // ==================== Q4 (F24–F29) FIRST-VOLUME POLISH, ACTION RIG, PARALLAX, WEBP QA, AUDIO/PERF & VERTICAL SLICE ====================
  await runSuite("Q4-1", "Q4 F24 主角动作状态机、足底锚点与妖狼/石卫朝向锁定及红金判定一致", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q4-1", true);
    try {
      const rigCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        const p = s.arena.player;
        const anchors = api.SPRITE_ANCHORS;

        // Verify all protagonist pose states produce distinct deterministic transforms
        const states = ["idle", "run", "light1", "light2", "light3", "light4", "heavy", "dodge", "hit", "knockdown", "meditate"];
        const poses = {};
        for (const stName of states) {
          api.setPlayerAnimState(stName, 0.30, { recoilDir: -1 });
          p.animT = 0.12;
          poses[stName] = api.computePlayerVisualPose(p, 0.75);
        }

        // Verify live combat hooks trigger expected states
        api.setPlayerAnimState("idle", 0.3);
        p.slashCd = 0; p.comboWindow = 0;
        api.fireManualSlash();
        const afterLight1 = p.animState;

        p.dashCd = 0;
        api.triggerDashParry();
        const afterDodge = p.animState;

        p.invuln = 0;
        api.hurtPlayer(12, { sourceName: "青岚妖狼", moveName: "扑咬", isHeavy: false });
        const afterHit = p.animState;
        const hitFlashActive = p.hitFlash > 0;

        // Verify non-lethal hit does NOT lock attack input
        p.slashCd = 0;
        api.fireManualSlash();
        const canAttackAfterHit = p.animState.startsWith("light");

        // Verify lethal hit sets knockdown and revive resets to idle
        p.invuln = 0;
        s.game.inventory.healing_pill = 2;
        api.hurtPlayer(9999, { uncapped: true, sourceName: "雾隐狼王", moveName: "重击", isHeavy: true });
        const afterKnockdown = p.animState;
        api.resolveDefeatChoice("revive-pill");
        const afterRevive = p.animState;

        return {
          anchorsOk: Boolean(anchors && anchors.actor_player_battle && anchors.enemy_wolf && anchors.enemy_warden && anchors.actor_shen),
          poses,
          afterLight1,
          afterDodge,
          afterHit,
          hitFlashActive,
          canAttackAfterHit,
          afterKnockdown,
          afterRevive
        };
      });

      assert.equal(rigCheck.anchorsOk, true, "SPRITE_ANCHORS must define foot anchors for player, wolf, warden, and living NPCs");
      assert.equal(rigCheck.afterLight1, "light1");
      assert.equal(rigCheck.afterDodge, "dodge");
      assert.equal(rigCheck.afterHit, "hit");
      assert.equal(rigCheck.hitFlashActive, true);
      assert.equal(rigCheck.canAttackAfterHit, true, "Non-lethal hit recoil must remain non-blocking");
      assert.equal(rigCheck.afterKnockdown, "knockdown");
      assert.equal(rigCheck.afterRevive, "idle");
      assert.notEqual(rigCheck.poses.light1.ox, rigCheck.poses.idle.ox, "light1 must lunge forward vs idle");
      assert.ok(Math.abs(rigCheck.poses.knockdown.rot) > 0.5, "knockdown must rotate into fallen posture");
      assert.ok(rigCheck.poses.dodge.sx > 1.05, "dodge must stretch horizontally");

      // Verify Wolf facing lock + shared rect telegraph/corridor hitbox + recover state
      const enemyCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        const p = s.arena.player;
        s.arena.enemies = [];
        s.arena.projectiles = [];
        p.x = 460; p.y = 480; p.invuln = 0; p.shieldHp = 0;
        api.spawnSingleEnemy("wolf", 640, 480, 1.0, false);
        const wolf = s.arena.enemies[0];
        wolf.timer = 0.01;
        api.stepArena(0.03); // chase -> windup facing left (-1)
        const windupState = wolf.state;
        const windupFacing = wolf.facing;
        const wolfSpec = api.getEnemyAttackSpec(wolf);

        // Move player behind wolf during windup -> facing MUST stay locked!
        p.x = 760; p.y = 480;
        api.stepArena(0.05);
        const facingDuringWindup = wolf.facing;

        // Place player clearly OUTSIDE lateral corridor (perp = 120 > halfW + 14) and complete lunge -> MUST NOT hit!
        const hitsBeforeMiss = (s.arena.encounterTelemetry && s.arena.encounterTelemetry.hitsTaken) || 0;
        const hpBeforeMiss = s.game.hp;
        p.x = 540; p.y = 620; p.invuln = 0;
        wolf.timer = 0.01;
        api.stepArena(0.03); // windup -> lunge
        const lungeState = wolf.state;
        const facingDuringLunge = wolf.facing;
        for (let i = 0; i < 16; i++) api.stepArena(0.03);
        const hitsAfterMiss = (s.arena.encounterTelemetry && s.arena.encounterTelemetry.hitsTaken) || 0;
        const hpAfterMiss = s.game.hp;
        const stateAfterLunge = wolf.state;

        // Verify Warden isometric ellipse parity: inside ellipse hits, outside y-axis (circular <= r but iso > r) misses!
        s.arena.enemies = [];
        api.spawnSingleEnemy("warden", 620, 480, 1.0, false);
        const warden = s.arena.enemies[0];
        warden.state = "windup";
        warden.perilous = false;
        warden.lowSweepWindup = false;
        warden.grabWindup = false;
        warden.timer = 0.01;
        const wardenSpec = api.getEnemyAttackSpec(warden);
        // Place player at dx=0, dy=wardenSpec.r * 0.72 from originYOff -> circular dist < r, but isometric ellipse dist = 0.72/0.56 > 1.0 -> MUST MISS!
        const hitsWardenBeforeMiss = (s.arena.encounterTelemetry && s.arena.encounterTelemetry.hitsTaken) || 0;
        const hpWardenBeforeMiss = s.game.hp;
        p.x = warden.x;
        p.y = warden.y + wardenSpec.originYOff + wardenSpec.r * 0.72;
        p.invuln = 0;
        api.stepArena(0.03);
        const hitsWardenAfterMiss = (s.arena.encounterTelemetry && s.arena.encounterTelemetry.hitsTaken) || 0;
        const hpWardenAfterMiss = s.game.hp;
        const wardenStateAfterSlam = warden.state;

        // Now place player inside isometric ellipse (dx=0, dy=wardenSpec.r * 0.40) -> MUST HIT!
        warden.state = "windup";
        warden.timer = 0.01;
        p.x = warden.x;
        p.y = warden.y + wardenSpec.originYOff + wardenSpec.r * 0.40;
        p.invuln = 0;
        const hpWardenBeforeHit = s.game.hp;
        api.stepArena(0.03);
        const hpWardenAfterHit = s.game.hp;

        return {
          windupState,
          windupFacing,
          facingDuringWindup,
          lungeState,
          facingDuringLunge,
          wolfSpec,
          hitsBeforeMiss,
          hitsAfterMiss,
          hpBeforeMiss,
          hpAfterMiss,
          stateAfterLunge,
          wardenSpec,
          hitsWardenBeforeMiss,
          hitsWardenAfterMiss,
          hpWardenBeforeMiss,
          hpWardenAfterMiss,
          wardenStateAfterSlam,
          hpWardenBeforeHit,
          hpWardenAfterHit,
          snap: api.getEnemyStateSnapshot(warden)
        };
      });

      assert.equal(enemyCheck.windupState, "windup");
      assert.equal(enemyCheck.windupFacing, -1);
      assert.equal(enemyCheck.facingDuringWindup, -1, "Wolf facing MUST stay locked during windup even if player moves behind");
      assert.equal(enemyCheck.lungeState, "lunge");
      assert.equal(enemyCheck.facingDuringLunge, -1, "Wolf facing MUST stay locked during lunge");
      assert.equal(enemyCheck.wolfSpec.shape, "rect");
      assert.equal(enemyCheck.hitsAfterMiss, enemyCheck.hitsBeforeMiss, "Player standing outside wolf charge corridor must take 0 hits");
      assert.ok(enemyCheck.hpAfterMiss >= enemyCheck.hpBeforeMiss, "Player standing outside wolf charge corridor must NOT lose HP");
      assert.equal(enemyCheck.stateAfterLunge, "recover", "Wolf must enter explicit recover state after lunge");
      assert.equal(enemyCheck.wardenSpec.shape, "ellipse");
      assert.equal(enemyCheck.hitsWardenAfterMiss, enemyCheck.hitsWardenBeforeMiss, "Player outside Warden isometric ellipse must take 0 hits");
      assert.ok(enemyCheck.hpWardenAfterMiss >= enemyCheck.hpWardenBeforeMiss, "Player outside Warden isometric ellipse must NOT lose HP");
      assert.equal(enemyCheck.wardenStateAfterSlam, "recover", "Warden must enter explicit recover state after slam");
      assert.ok(enemyCheck.hpWardenAfterHit < enemyCheck.hpWardenBeforeHit, "Player inside Warden isometric ellipse must take slam damage");
      assert.equal(enemyCheck.snap.id, "warden");
    } finally {
      await ctx.close();
    }
  });

  await runSuite("Q4-2", "Q4 F25 首卷三层景深视差修复、前景不遮危招、可视化开关持久化与活体NPC落地", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q4-2", true);
    try {
      // Move player off-center and wait for renderArenaCanvas to write unified #stage-bg-img transform
      const parallaxCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.arena.player.x = 1080;
        s.arena.player.y = 540;
        return api.getVisualLayersState();
      });
      await page.waitForTimeout(120);
      const afterFrame = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const bgEl = document.getElementById("stage-bg-img");
        const st = api.getVisualLayersState();
        const shenProp = api.getState().arena.props.find(pr => pr.id === "shen_rescue");
        return {
          bgTransform: bgEl ? bgEl.style.transform : "",
          st,
          shenHasLotus: Boolean(shenProp && shenProp.onLotus)
        };
      });
      assert.ok(afterFrame.bgTransform && afterFrame.bgTransform.includes("translate("), `Unified #stage-bg-img parallax transform must persist, got: ${afterFrame.bgTransform}`);
      assert.ok(Math.abs(afterFrame.st.bgParallaxX) > 0.5, `Expected non-zero far parallaxX when player is off-center, got ${afterFrame.st.bgParallaxX}`);
      assert.equal(afterFrame.st.activeDrawn, true, "Vol 1 enhanced visual layers must be active by default");
      assert.ok(afterFrame.st.fgMarginPct <= 0.12, `Foreground silhouettes must be clamped to outer <=12% corner margin, got ${afterFrame.st.fgMarginPct}`);
      assert.equal(afterFrame.shenHasLotus, false, "Living NPC shen_rescue must NOT hover on lotus pedestal");

      // Check Sanctum living NPCs vs ritual shrines
      const sanctumCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.enterSanctumHub();
        const props = api.getState().arena.props;
        const livingIds = ["hub_shen", "hub_lu", "hub_pei", "hub_yan"];
        const shrineIds = ["hub_merchant", "hub_scripture_hall"];
        return {
          livingAnyLotus: livingIds.some(id => Boolean(props.find(p => p.id === id)?.onLotus)),
          shrinesAllLotus: shrineIds.every(id => Boolean(props.find(p => p.id === id)?.onLotus)),
          visualState: api.getVisualLayersState()
        };
      });
      assert.equal(sanctumCheck.livingAnyLotus, false, "Sanctum living NPCs (shen/lu/pei/yan) must NOT carry onLotus: true");
      assert.equal(sanctumCheck.shrinesAllLotus, true, "Sanctum ritual shrines (hub_merchant/hub_scripture_hall) must retain onLotus: true");

      // Toggle #btn-a11y-visual-layers OFF via Settings -> Accessibility and verify reload persistence
      await page.click("#btn-open-settings");
      await page.waitForSelector('#modal-backdrop.open [data-sys-tab="accessibility"]');
      await page.click('#modal-backdrop.open [data-sys-tab="accessibility"]');
      await page.waitForSelector("#btn-a11y-visual-layers");
      await page.click("#btn-a11y-visual-layers");
      await page.waitForTimeout(80);
      const offState = await page.evaluate(() => window.__CHENYUAN_V25__.getVisualLayersState());
      assert.equal(offState.enabled, false, "Clicking #btn-a11y-visual-layers must disable enhancedVisualLayers");

      await page.reload({ waitUntil: "domcontentloaded" });
      const persistedOff = await page.evaluate(() => window.__CHENYUAN_V25__.getVisualLayersState().enabled);
      assert.equal(persistedOff, false, "enhancedVisualLayers toggle must persist across reload in A11Y_STORAGE_KEY");

      // Re-enable layers, enable reducedMotion -> parallax & foreground offset must freeze to 0
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.setVisualLayersEnabled(true);
      });
      await page.click("#btn-continue-save");
      await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await page.click("#btn-open-settings");
      await page.waitForSelector('#modal-backdrop.open [data-sys-tab="accessibility"]');
      await page.click('#modal-backdrop.open [data-sys-tab="accessibility"]');
      await page.click("#btn-a11y-reduced-motion");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(120);
      const rmFrozen = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.getState().arena.player.x = 1120;
        return api.getVisualLayersState();
      });
      await page.waitForTimeout(100);
      const rmFrozenAfter = await page.evaluate(() => window.__CHENYUAN_V25__.getVisualLayersState());
      assert.equal(rmFrozenAfter.reducedMotion, true);
      assert.equal(rmFrozenAfter.bgParallaxX, 0, "Parallax X must freeze to 0 under reducedMotion");
      assert.equal(rmFrozenAfter.fgOffsetX, 0, "Foreground parallax offset must freeze to 0 under reducedMotion");
    } finally {
      await ctx.close();
    }
  });

  await runSuite("Q4-3", "Q4 F26 115项内联WebP解码完整、5项RGBA资产保护与art-manifest二进制质检通过", async () => {
    // 1. Run scripts/art-manifest.mjs --check and --json directly in Node
    const checkOut = execFileSync(process.execPath, [path.join(REPO_ROOT, "scripts", "art-manifest.mjs"), "--check"], {
      cwd: REPO_ROOT,
      encoding: "utf8"
    });
    assert.ok(checkOut.includes("art-manifest OK"), `art-manifest --check failed: ${checkOut}`);

    const jsonOut = execFileSync(process.execPath, [path.join(REPO_ROOT, "scripts", "art-manifest.mjs"), "--json"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024
    });
    const manifest = JSON.parse(jsonOut);
    assert.equal(manifest.summary.inlineCount, 115, `Expected 115 inline ART entries, got ${manifest.summary.inlineCount}`);
    assert.equal(manifest.summary.protectedRgbaCount, 5, "All 5 divergent inline RGBA assets must be audited and protected");
    for (const p of manifest.protectedRgbaAudit) {
      assert.equal(p.inlineAlpha, true, `Protected inline asset ${p.key} must retain RGBA alpha`);
      assert.ok(p.inlineBytes > p.diskBytes, `Protected inline asset ${p.key} (${p.inlineBytes}B) must remain larger than RGB disk copy (${p.diskBytes}B)`);
    }
    assert.equal(manifest.preloadAudit.length, 13, `Expected 13 preload-only assets audited, got ${manifest.preloadAudit.length}`);

    // 2. Verify all 115 inline ART images genuinely decode with naturalWidth/naturalHeight matching RIFF/WEBP headers in 1440x900 Chromium
    const { ctx, page } = await startCleanGamePage(browser, "Q4-3", true);
    try {
      await page.waitForFunction(() => window.__CHENYUAN_V25__.getArtDecodeSummary().decodedCount === 115, { timeout: 10000 });
      const decodeCheck = await page.evaluate((expectedDims) => {
        const summary = window.__CHENYUAN_V25__.getArtDecodeSummary();
        const dimMismatches = [];
        for (const item of summary.decoded) {
          const exp = expectedDims[item.key];
          if (!exp || exp[0] !== item.w || exp[1] !== item.h) {
            dimMismatches.push(`${item.key}: got ${item.w}x${item.h}, expected ${exp ? exp.join("x") : "none"}`);
          }
        }
        const domImgs = Array.from(document.querySelectorAll("img[src^='data:image/webp']"));
        const brokenDomImgs = domImgs.filter(el => el.complete && el.naturalWidth === 0).map(el => el.id || el.alt || "img");
        return {
          total: summary.total,
          decodedCount: summary.decodedCount,
          failed: summary.failed,
          dimMismatches,
          domImgCount: domImgs.length,
          brokenDomImgs
        };
      }, Object.fromEntries(manifest.inlineAssets.map(a => [a.key, [a.webp.width, a.webp.height]])));
      assert.equal(decodeCheck.total, 115, "Runtime const ART must preserve all 115 entries");
      assert.equal(decodeCheck.decodedCount, 115, `All 115 inline WebP images must decode in Chromium, failed: ${JSON.stringify(decodeCheck.failed)}`);
      assert.equal(decodeCheck.dimMismatches.length, 0, `Chromium decoded dimensions must match RIFF/WEBP headers: ${decodeCheck.dimMismatches.join("; ")}`);
      assert.equal(decodeCheck.brokenDomImgs.length, 0, `Broken inline WebP <img> elements: ${decodeCheck.brokenDomImgs.join(", ")}`);
    } finally {
      await ctx.close();
    }
  });

  await runSuite("Q4-4", "Q4 F27 七层音效遥测、400ms水墨转场与横幅修复、完全减弱动效及无截断性能基线", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "Q4-4", true);
    try {
      // 1. Verify real Chromium user activation -> Sound.ctx creation, first-cue audible, 7-tier Sound cue layering, and GainNode suppression on stem=0 / muted=true
      await page.mouse.click(720, 450);
      const audioCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const hasBeenActive = Boolean(navigator.userActivation && navigator.userActivation.hasBeenActive);
        if (api.Sound.ctx && typeof api.Sound.ctx.close === "function") {
          try { api.Sound.ctx.close(); } catch (e) {}
        }
        api.Sound.ctx = null;
        api.Sound.noiseBuf = null;
        api.Sound.muted = false;
        api.clearAudioCueTelemetry();
        api.Sound.fleshHit(1);
        api.Sound.fleshHit(2);
        api.Sound.shieldAbsorb("player");
        api.Sound.deflectClang();
        api.Sound.postureBreak();
        api.Sound.playerHurt(true);
        api.Sound.dialogueCue();
        api.Sound.noticeCue(1);
        const logAll = api.getAudioCueTelemetry().cueLog;
        const tiers = Array.from(new Set(logAll.map(x => x.tier)));
        const soundCtxExists = Boolean(api.Sound.ctx);
        const firstCueAudible = Boolean(logAll[0] && logAll[0].audible === true);
        const allActiveAudible = logAll.length > 0 && logAll.every(x => x.audible === true);

        // Instrument AudioContext.createGain to prove real Web Audio synthesis vs suppression
        const prevBlade = api.Sound.stems.blade;
        const prevMuted = api.Sound.muted;
        let activeSlashGains = 0;
        let stemZeroGains = 0;
        let mutedGains = 0;
        let mutedRec = null;
        let stemZeroSlashRec = null;
        let globalMutedRec = null;
        const origCreateGain = api.Sound.ctx ? api.Sound.ctx.createGain.bind(api.Sound.ctx) : null;
        let gainCounter = 0;
        if (api.Sound.ctx && origCreateGain) {
          api.Sound.ctx.createGain = (...args) => {
            gainCounter += 1;
            return origCreateGain(...args);
          };
        }
        try {
          gainCounter = 0;
          api.Sound.stems.blade = 1.0;
          api.Sound.muted = false;
          api.Sound.slash(true);
          activeSlashGains = gainCounter;

          // Zero blade stem and verify stemMuted telemetry flag + 0 GainNodes
          gainCounter = 0;
          api.Sound.stems.blade = 0;
          api.Sound.fleshHit(1);
          mutedRec = api.getAudioCueTelemetry().lastCue;
          api.Sound.slash(true);
          stemZeroSlashRec = api.getAudioCueTelemetry().lastCue;
          stemZeroGains = gainCounter;

          // Global mute and verify 0 GainNodes + audible=false
          gainCounter = 0;
          api.Sound.stems.blade = 1.0;
          api.Sound.muted = true;
          api.Sound.slash(true);
          globalMutedRec = api.getAudioCueTelemetry().lastCue;
          mutedGains = gainCounter;
        } finally {
          if (api.Sound.ctx && origCreateGain) api.Sound.ctx.createGain = origCreateGain;
          api.Sound.stems.blade = prevBlade;
          api.Sound.muted = prevMuted;
        }
        return {
          hasBeenActive,
          soundCtxExists,
          firstCueAudible,
          allActiveAudible,
          activeSlashGains,
          stemZeroGains,
          mutedGains,
          stemZeroSlashRec,
          globalMutedRec,
          tiers,
          count: logAll.length,
          mutedRec
        };
      });
      assert.equal(audioCheck.hasBeenActive, true, "Real Chromium user click must activate navigator.userActivation.hasBeenActive");
      assert.equal(audioCheck.soundCtxExists, true, "Sound.ensure() must create real AudioContext after user activation in Chromium");
      assert.equal(audioCheck.firstCueAudible, true, "First post-gesture cue must initialize AudioContext before recordCue so audible=true");
      assert.equal(audioCheck.allActiveAudible, true, "All unmuted active cues across 7 tiers must log audible=true");
      assert.ok(audioCheck.activeSlashGains > 0, `Active unmuted Sound.slash(true) must synthesize Web Audio GainNodes, got ${audioCheck.activeSlashGains}`);
      for (const reqTier of ["light", "heavy", "block", "deflect", "break", "hurt", "ui"]) {
        assert.ok(audioCheck.tiers.includes(reqTier), `Missing audio tier "${reqTier}" in Sound telemetry: ${audioCheck.tiers.join(", ")}`);
      }
      assert.equal(audioCheck.mutedRec.stemMuted, true, "Zeroing blade stem must mark cue stemMuted=true");
      assert.equal(audioCheck.mutedRec.audible, false, "Zeroing blade stem must prevent audible output");
      assert.equal(audioCheck.stemZeroSlashRec.audible, false, "Zeroing blade stem must prevent slash audible output");
      assert.equal(audioCheck.stemZeroGains, 0, `Zeroing blade stem must create 0 GainNodes, got ${audioCheck.stemZeroGains}`);
      assert.equal(audioCheck.globalMutedRec.audible, false, "Global Sound.muted=true must mark cue audible=false");
      assert.equal(audioCheck.mutedGains, 0, `Global Sound.muted=true must create 0 GainNodes, got ${audioCheck.mutedGains}`);

      // 2. Verify 400ms semantic ink-wash scene transition & #region-cinema-card "show" dismissal when boss appears
      const transCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.transitionStageScene("arena_sanctum_hub", "hub");
        const stMid = api.getSceneTransitionState();
        const veilActive = document.getElementById("scene-transition-veil")?.classList.contains("active");
        return { stMid, veilActive };
      });
      assert.equal(transCheck.veilActive, true, "#scene-transition-veil must activate during non-reduced-motion transition");
      assert.equal(transCheck.stMid.durMs, 400);
      await page.waitForTimeout(260);
      const transDone = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const veilStill = document.getElementById("scene-transition-veil")?.classList.contains("active");
        const cardShowBefore = document.getElementById("region-cinema-card")?.classList.contains("show");
        // Spawn a boss and call updateBossBannerAndRecallOrb -> MUST remove "show" (fixing old "active" bug!)
        api.spawnSingleEnemy("wolf", 700, 480, 1.0, true, "雾隐狼王");
        api.updateBossBannerAndRecallOrb();
        const cardShowAfterBoss = document.getElementById("region-cinema-card")?.classList.contains("show");
        return { veilStill, cardShowBefore, cardShowAfterBoss };
      });
      assert.equal(transDone.veilStill, false, "#scene-transition-veil must fade back out cleanly");
      assert.equal(transDone.cardShowBefore, true, "#region-cinema-card must show after transition");
      assert.equal(transDone.cardShowAfterBoss, false, "updateBossBannerAndRecallOrb must clear #region-cinema-card.show when boss appears");

      // 3. Verify complete reducedMotion suppression (impactFrames, radialBurst, flash, camZoom, veil instant)
      const rmCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.arena.shake = 14;
        s.arena.flash = 0.5;
        s.arena.camZoom = 1.12;
        window.__CHENYUAN_V18__.triggerImpactFrame(3, "#e62e2d");
        // Enable reducedMotion via Accessibility UI
        s.a11ySettings.reducedMotion = true;
        api.clearTransientMotionEffects();
        window.__CHENYUAN_V18__.triggerImpactFrame(3, "#e62e2d");
        api.transitionStageScene("arena_wilderness", "stg_0");
        const ts = api.getSceneTransitionState();
        return {
          shake: s.arena.shake,
          flash: s.arena.flash,
          impactFrames: s.arena.impactFrames,
          radialBurst: s.arena.radialBurst,
          camZoom: s.arena.camZoom,
          lastWasInstant: ts.lastWasInstant,
          veilActive: document.getElementById("scene-transition-veil")?.classList.contains("active")
        };
      });
      assert.equal(rmCheck.shake, 0);
      assert.equal(rmCheck.flash, 0);
      assert.equal(rmCheck.impactFrames, 0, "triggerImpactFrame must be suppressed under reducedMotion");
      assert.equal(rmCheck.radialBurst, null);
      assert.equal(rmCheck.camZoom, 1);
      assert.equal(rmCheck.lastWasInstant, true, "transitionStageScene must collapse to instant swap under reducedMotion");
      assert.equal(rmCheck.veilActive, false);

      // 4. Verify unclamped perf telemetry & graceful degradation preserving combat telegraphs
      await page.waitForTimeout(180);
      const perfCheck = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const stats = api.getPerfStats();
        api.setPerfDegradeOverride(2);
        const degStats = api.getPerfStats();
        // Spawn windup wolf -> getEnemyAttackSpec & state remain intact at degradeLevel 2
        const s = api.getState();
        s.arena.enemies = [];
        api.spawnSingleEnemy("wolf", 680, 480, 1.0, false);
        s.arena.enemies[0].state = "windup";
        const specAtDeg2 = api.getEnemyAttackSpec(s.arena.enemies[0]);
        const clearedDegLevel = api.setPerfDegradeOverride(null);
        return { stats, degStats, specAtDeg2, clearedDegLevel };
      });
      assert.ok(perfCheck.stats.sampleCount >= 3, `Expected perf ring samples >= 3, got ${perfCheck.stats.sampleCount}`);
      assert.ok(perfCheck.stats.firstInteractiveMs !== null && perfCheck.stats.firstInteractiveMs >= 0);
      assert.ok(perfCheck.stats.firstPlayableMs !== null && perfCheck.stats.firstPlayableMs >= 0);
      assert.equal(perfCheck.degStats.degradeLevel, 2);
      assert.equal(perfCheck.clearedDegLevel, 0, "Clearing perf degrade override to null must immediately reset degradeLevel to 0");
      assert.equal(perfCheck.specAtDeg2.shape, "rect", "Graceful degradation level 2 must NEVER degrade combat telegraphs");
    } finally {
      await ctx.close();
    }
  });

  await runSuite("Q4-5", "Q4 F28+F29 首卷完整体验闭环、凡人禁锁提示清理、渡劫评定明晰与试玩遥测存档隔离", async () => {
    // 1. Verify F29 protocol doc exists & explicitly states NOT_RUN with zero fabricated tester results
    const protoPath = path.join(REPO_ROOT, "docs", "analysis", "playtest-protocol-v1.md");
    assert.equal(fs.existsSync(protoPath), true, "docs/analysis/playtest-protocol-v1.md must exist");
    const protoText = fs.readFileSync(protoPath, "utf8");
    assert.ok(protoText.includes("NOT_RUN"), "F29 playtest protocol must explicitly record Status: NOT_RUN");
    assert.ok(protoText.includes("0 / 5~8") || protoText.includes("`0` 名"), "F29 playtest protocol must explicitly record 0 human testers completed");

    const { ctx, page } = await startCleanGamePage(browser, "Q4-5", false);
    try {
      // 2. Prologue -> Pedestal choice ("trade" string signature) -> Layer 0 Mortal clean wolves (0 tactical squad, 0 locked-key hint)
      const vol1Flow = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        const phaseStart = api.getVol1JourneyPhase();
        const visibleHudBtns = Array.from(document.querySelectorAll("button")).filter(el => {
          if (el.closest("#welcome-screen, #side-panel, #modal-backdrop, #pavilion-popover, #story-dialogue-bar, #ending-overlay")) return false;
          const cs = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0 && rect.width > 2 && rect.height > 2;
        }).length;
        // Defeat the 3 prologue wolves to rescue Shen Qinghe & spawn both pedestals
        s.arena.enemies.slice().forEach(e => {
          e.hp = 1;
          api.damageEnemy(e, 500, true, 50, 0, 2, true);
        });
        const skipDlg = document.getElementById("btn-dlg-skip");
        if (skipDlg && document.getElementById("story-dialogue-bar")?.classList.contains("open")) skipDlg.click();
        const phaseAfterRescue = api.getVol1JourneyPhase();
        const pedBadges = s.arena.props.filter(pr => pr.kind === "pedestal").map(pr => pr.badge || "");
        // Accept string signature on activatePedestalChoice
        api.activatePedestalChoice("trade");
        const portalsAfterChoice = s.arena.props.map(p => p.id);
        const enemiesAfterChoice = s.arena.enemies.length;

        // Enter Stage 0 Layer 0 ("outpost") in Mortal realm -> clean wolves, NO shield_vanguard / hex_chanter / flank_assassin!
        api.initArenaStage(0, false);
        const layer0Roles = s.arena.enemies.map(e => e.tacticalRole || null);
        const payoffShown = Boolean(s.game.vol1PedestalMeta && s.game.vol1PedestalMeta.payoffShown);

        // Verify Mortal shield-block hint does NOT leak backquote (`切巨阙)
        const testShieldEnemy = s.arena.enemies[0];
        if (testShieldEnemy) {
          testShieldEnemy.frontShieldHp = 60;
          testShieldEnemy.maxFrontShieldHp = 60;
          testShieldEnemy.shieldFacing = Math.atan2(s.arena.player.y - testShieldEnemy.y, s.arena.player.x - testShieldEnemy.x);
          s.arena.floats = [];
          api.damageEnemy(testShieldEnemy, 15, false, 5, 0, 1, false);
        }
        const mortalFloats = s.arena.floats.map(f => f.text);
        const hasLockedBackquoteHint = mortalFloats.some(t => t.includes("按`切巨阙"));

        // Enter Sanctum -> check onboarding coach shortest prep path + stat delta upgrade + P3-1 HUD count <= 14!
        api.enterSanctumHub();
        const sanctumPhase = api.getVol1JourneyPhase();
        const coachTextBefore = document.getElementById("onboarding-coach-bar")?.textContent || "";
        s.game.stones = 200;
        const wpnName = s.game.equippedGear.weapon ? s.game.equippedGear.weapon.name : "";
        const beforeAtk = api.getCombatStats(s.game).atk;
        const enhPreview = api.computeBatchEnhancePreview(s.game, "weapon", 1);
        const enhRes = api.executeGearBatchEnhance("weapon", 1);
        const afterAtk = api.getCombatStats(s.game).atk;
        const sanctumToasts = Array.from(document.querySelectorAll("#toast-container .toast-pill")).map(el => el.textContent || "");
        const lastUpgradeRec = api.getPlaytestTelemetry().sanctumUpgrades.slice(-1)[0] || null;
        const prepDone = Boolean(s.game.vol1Prep && s.game.vol1Prep.upgradeDone);
        const coachTextAfter = document.getElementById("onboarding-coach-bar")?.textContent || "";
        const sanctumCoachBtnCount = document.querySelectorAll("#onboarding-coach-bar button").length;

        // Verify Mortal Wolf King Boss 2-phase telegraphs NEVER emit grabWindup or lowSweepWindup!
        api.initArenaStage(0, false);
        if (s.arena.dungeonMap) s.arena.dungeonMap.currentNodeId = "n4_0";
        s.arena.roomBranch = "boss";
        s.arena.enemies = [];
        api.spawnSingleEnemy("wolf", 660, 480, 1.0, true, "雾隐狼王");
        const boss = s.arena.enemies[0];
        const bossPhase = api.getVol1JourneyPhase();
        let sawGrab = false, sawLowSweep = false, sawGold = false, sawPeril = false;
        for (let seq = 0; seq < 6; seq++) {
          boss.state = "chase";
          boss.timer = 0.01;
          boss.x = s.arena.player.x + 140;
          boss.y = s.arena.player.y;
          api.stepArena(0.03);
          if (boss.grabWindup) sawGrab = true;
          if (boss.lowSweepWindup) sawLowSweep = true;
          if (boss.perilous) sawPeril = true;
          else sawGold = true;
        }

        // Defeat Wolf King -> trigger real 580ms stage clear persistence!
        boss.hp = 1;
        api.damageEnemy(boss, 500, true, 50, 0, 4, true);

        return {
          phaseStart,
          phaseAfterRescue,
          pedBadges,
          portalsAfterChoice,
          enemiesAfterChoice,
          layer0Roles,
          payoffShown,
          hasLockedBackquoteHint,
          sanctumPhase,
          coachTextBefore,
          wpnName,
          beforeAtk,
          afterAtk,
          enhPreviewDelta: enhPreview ? enhPreview.dAtk : 0,
          sanctumToasts,
          lastUpgradeRec,
          enhResOk: enhRes.ok,
          prepDone,
          coachTextAfter,
          sanctumCoachBtnCount,
          visibleHudBtns,
          bossPhase,
          sawGrab,
          sawLowSweep,
          sawGold,
          sawPeril
        };
      });

      // Wait for real 580ms boss clear timer (preserving E2E-T4-01 timing!)
      await page.waitForFunction(() => window.__CHENYUAN_V25__.isStageBossDefeated(window.__CHENYUAN_V25__.getState().game, 0), { timeout: 2500 });
      const tribFlow = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        // Skip clear_stage0 cutscene if open, close recap modal if open
        const skipBtn = document.getElementById("btn-dlg-skip");
        if (skipBtn && document.getElementById("story-dialogue-bar")?.classList.contains("open")) skipBtn.click();
        api.closeModal();

        const bossDefeated = api.isStageBossDefeated(s.game, 0);
        s.game.xp = api.REALMS.mortal.xpCap;
        api.openTribulationPrepModal();
        const ruleCompTxt = document.getElementById("trib-rule-comparison")?.textContent || "";
        const hasNormalBtn = Boolean(document.querySelector('[data-trib-start="normal"]'));
        api.startLiveTribulation({ confirmed: true, mode: "normal" });
        s.arena.tribulation.parryCount = 1;
        api.completeLiveTribulation();
        const tribSummary = api.getLastTribulationSummary();
        api.openDestinyFruitModal(true);
        const verdictTxt = document.getElementById("trib-verdict-summary")?.textContent || "";
        api.closeModal();

        // Verify playtest telemetry isolation: ZERO playtest keys written into STORAGE_KEY or META_KEY!
        const rawMain = localStorage.getItem("chenyuan_wendao_v11_save") || "";
        const rawMeta = localStorage.getItem("chenyuan_wendao_v11_meta") || "";
        const ptTele = api.getPlaytestTelemetry();
        const ptJson = api.exportPlaytestSessionJson();

        return {
          bossDefeated,
          ruleCompTxt,
          hasNormalBtn,
          tribSummary,
          verdictTxt,
          ptTele,
          ptJsonValid: JSON.parse(ptJson).schema === "chenyuan_playtest_telemetry_v1",
          leakedInMain: rawMain.includes("playtestTelemetry") || rawMain.includes("menuDwellMs") || rawMain.includes("firstAttackSec"),
          leakedInMeta: rawMeta.includes("playtestTelemetry") || rawMeta.includes("menuDwellMs") || rawMeta.includes("firstAttackSec")
        };
      });

      assert.equal(vol1Flow.phaseStart, "prologue_rescue");
      assert.equal(vol1Flow.phaseAfterRescue, "pedestal_choice");
      assert.ok(vol1Flow.pedBadges.some(b => b.includes("R 唤沈清禾")) && vol1Flow.pedBadges.some(b => b.includes("飞剑 +1")), `Pedestals must preview next-fight payoff: ${vol1Flow.pedBadges.join(" | ")}`);
      assert.ok(vol1Flow.portalsAfterChoice.includes("portal_act1_wilderness") && vol1Flow.portalsAfterChoice.includes("portal_sanctum_prep"));
      assert.equal(vol1Flow.enemiesAfterChoice, 0, "P2-1 invariant: pedestal choice must spawn 0 enemies");
      assert.equal(vol1Flow.layer0Roles.every(r => r === null), true, `Stage 0 Layer 0 Mortal must have clean wolves without tactical roles, got: ${vol1Flow.layer0Roles.join(",")}`);
      assert.equal(vol1Flow.payoffShown, true, "Pedestal choice payoff cue must fire on entering first Wilderness fight");
      assert.equal(vol1Flow.hasLockedBackquoteHint, false, "Mortal player must NEVER see locked backquote posture hint");
      assert.equal(vol1Flow.sanctumPhase, "sanctum_prep");
      assert.ok(vol1Flow.coachTextBefore.includes("仙葫已满酿") && vol1Flow.coachTextBefore.includes("绝不强制炼丹"), `Sanctum prep coach bar missing D01 guidance: ${vol1Flow.coachTextBefore}`);
      assert.equal(vol1Flow.enhResOk, true);
      assert.equal(vol1Flow.wpnName, "凡品·青竹灵剑", `Expected default starter sword equipped, got ${vol1Flow.wpnName}`);
      assert.ok(vol1Flow.enhPreviewDelta >= 1, `Starter sword +1 preview must show >= +1 ATK, got ${vol1Flow.enhPreviewDelta}`);
      assert.ok(vol1Flow.afterAtk > vol1Flow.beforeAtk, `Quenching starter sword +1 in Sanctum must increase ATK (${vol1Flow.beforeAtk} -> ${vol1Flow.afterAtk})`);
      assert.equal(vol1Flow.afterAtk - vol1Flow.beforeAtk, vol1Flow.enhPreviewDelta, "Starter sword +1 actual ATK delta must match upfront preview");
      assert.ok(vol1Flow.sanctumToasts.some(t => t.includes("✦ 洞府整备生效") && t.includes("攻击 +1")), `Expected visible Sanctum stat-delta toast with 攻击 +1, got: ${vol1Flow.sanctumToasts.join(" | ")}`);
      assert.ok(vol1Flow.lastUpgradeRec && vol1Flow.lastUpgradeRec.delta.includes("攻击 +1"), `Expected telemetry delta to record 攻击 +1, got: ${JSON.stringify(vol1Flow.lastUpgradeRec)}`);
      assert.equal(vol1Flow.prepDone, true);
      assert.ok(vol1Flow.coachTextAfter.includes("已完成1项整备强化"), `Sanctum prep coach bar must mark upgrade done: ${vol1Flow.coachTextAfter}`);
      assert.equal(vol1Flow.sanctumCoachBtnCount, 0, "Sanctum shortest prep coach bar must add 0 extra HUD <button> elements");
      assert.ok(vol1Flow.visibleHudBtns <= 14, `P3-1 guardrail: Mortal start HUD visible buttons must remain <= 14, got ${vol1Flow.visibleHudBtns}`);
      assert.equal(vol1Flow.bossPhase, "wolf_king_boss");
      assert.equal(vol1Flow.sawGrab, false, "Mortal Wolf King must NOT use Foundation-locked grabWindup");
      assert.equal(vol1Flow.sawLowSweep, false, "Mortal Wolf King must NOT use Qi-locked lowSweepWindup");
      assert.equal(vol1Flow.sawGold, true, "Mortal Wolf King must use Gold parryable attacks");
      assert.equal(vol1Flow.sawPeril, true, "Mortal Wolf King must use Crimson dodgeable perilous attacks");
      assert.equal(tribFlow.bossDefeated, true, "Killing Stage 0 Wolf King must persist defeatedStageBosses[0]");
      assert.ok(tribFlow.ruleCompTxt.includes("天道一品") && tribFlow.ruleCompTxt.includes("地道上品"), "Tribulation prep must render #trib-rule-comparison");
      assert.equal(tribFlow.hasNormalBtn, true);
      assert.equal(tribFlow.tribSummary.quality, "heaven");
      assert.equal(tribFlow.tribSummary.parryCount, 1);
      assert.ok(tribFlow.verdictTxt.includes("天道一品") && tribFlow.verdictTxt.includes("弹反 1 次"), `Destiny fruit modal must render #trib-verdict-summary with parry reason, got: ${tribFlow.verdictTxt}`);
      assert.equal(tribFlow.ptTele.protocolStatus, "NOT_RUN");
      assert.equal(tribFlow.ptTele.pedestalChoice, "trade");
      assert.equal(tribFlow.ptJsonValid, true);
      assert.equal(tribFlow.leakedInMain, false, "Playtest telemetry must NEVER leak into STORAGE_KEY");
      assert.equal(tribFlow.leakedInMeta, false, "Playtest telemetry must NEVER leak into META_KEY");
    } finally {
      await ctx.close();
    }
  });

  // ==================== Q5 (F30–F33): MODULAR SOURCE, STANDALONE BUILD, FILE:// PARITY & ESM CROSS-CHECK ====================
  await runSuite("Q5-1", "Q5 F30/F32 模块化构建校验、382项V18–V25全量契约、__CHENYUAN_DEBUG__兼容门面与零外链", async () => {
    const buildCheckOut = execFileSync(process.execPath, [path.join(REPO_ROOT, "scripts", "build-playable.mjs"), "--check"], {
      cwd: REPO_ROOT,
      encoding: "utf8"
    });
    assert.ok(buildCheckOut.includes("build-playable OK (--check)"), `build-playable --check failed: ${buildCheckOut}`);

    const ctx = await newIsolatedContext(browser);
    try {
      const page = await ctx.newPage();
      attachErrorListeners(page, "Q5-1");
      const externalRequests = [];
      page.on("request", (req) => {
        const u = req.url();
        if (!u.startsWith("http://127.0.0.1:") && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:")) {
          externalRequests.push(u);
        }
      });

      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#btn-start-new");
      await page.waitForFunction(() => window.__CHENYUAN_V25__.getArtDecodeSummary().decodedCount === 115, { timeout: 10000 });

      const contract = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll("script"));
        const scriptAttrs = scripts.map((s) => Array.from(s.attributes).map((a) => a.name));
        const nsNames = ["V18", "V19", "V20", "V21", "V22", "V23", "V24", "V25"];
        const nsCounts = {};
        let totalKeys = 0;
        for (const n of nsNames) {
          const obj = window[`__CHENYUAN_${n}__`];
          const count = obj && typeof obj === "object" ? Object.keys(obj).length : -1;
          nsCounts[n] = count;
          if (count > 0) totalKeys += count;
        }
        const dbg = window.__CHENYUAN_DEBUG__;
        const artSummary = window.__CHENYUAN_V25__.getArtDecodeSummary();
        const noticeState = dbg && dbg.telemetry ? dbg.telemetry.getNoticeState() : null;
        const framePerf = dbg && dbg.telemetry ? dbg.telemetry.getFramePerfSnapshot() : null;
        const perfStats = dbg && dbg.telemetry ? dbg.telemetry.getPerfStats() : null;
        const pendingRewards = dbg && dbg.telemetry ? dbg.telemetry.getPendingRewards() : null;
        const pauseTokens = dbg && dbg.telemetry ? dbg.telemetry.getPauseTokens() : null;
        const encounterTel = dbg && dbg.telemetry ? dbg.telemetry.getEncounterTelemetry() : undefined;
        return {
          scriptCount: scripts.length,
          scriptAttrs,
          nsCounts,
          totalKeys,
          debugVersion: dbg ? dbg.version : null,
          debugSameV25: Boolean(dbg && dbg.getNamespace("v25") === window.__CHENYUAN_V25__),
          debugSameV18: Boolean(dbg && dbg.getNamespace("v18") === window.__CHENYUAN_V18__),
          debugProtoNull: Boolean(dbg && dbg.getNamespace("constructor") === null && dbg.getNamespace("__proto__") === null && dbg.getNamespace("toString") === null),
          debugNoticeOk: Boolean(noticeState && noticeState.inbox && Array.isArray(noticeState.inbox.items) && Array.isArray(noticeState.pendingUnlockCards)),
          debugPerfOk: Boolean(framePerf && perfStats && Number.isFinite(framePerf.p50Ms) && Number.isFinite(framePerf.maxFrameMs) && Number.isFinite(framePerf.totalFrames) && framePerf.totalFrames === perfStats.totalFrames),
          debugTelemetryArraysOk: Boolean(Array.isArray(pendingRewards) && Array.isArray(pauseTokens) && (encounterTel === null || typeof encounterTel === "object")),
          debugRuleKeys: dbg && dbg.rules ? Object.keys(dbg.rules) : [],
          debugPersistKeys: dbg && dbg.persistence ? Object.keys(dbg.persistence) : [],
          debugArtCount: dbg && dbg.art ? dbg.art.getCount() : 0,
          artDecoded: artSummary.decodedCount,
          artFailed: artSummary.failed
        };
      });

      assert.equal(externalRequests.length, 0, `Expected 0 external network requests, got: ${externalRequests.join(", ")}`);
      assert.equal(contract.scriptCount, 1, `Expected strictly 1 <script> tag, got ${contract.scriptCount}`);
      assert.deepEqual(contract.scriptAttrs, [[]], `Expected bare <script> with 0 attributes, got ${JSON.stringify(contract.scriptAttrs)}`);
      assert.deepEqual(contract.nsCounts, { V18: 5, V19: 8, V20: 8, V21: 11, V22: 12, V23: 14, V24: 11, V25: 313 });
      assert.equal(contract.totalKeys, 382, `Expected 382 preserved V18-V25 keys, got ${contract.totalKeys}`);
      assert.equal(contract.debugVersion, "q5-compat-1");
      assert.equal(contract.debugSameV25, true);
      assert.equal(contract.debugSameV18, true);
      assert.equal(contract.debugProtoNull, true);
      assert.equal(contract.debugNoticeOk, true);
      assert.equal(contract.debugPerfOk, true);
      assert.equal(contract.debugTelemetryArraysOk, true);
      assert.ok(contract.debugRuleKeys.includes("computeCombatStatLedger") && contract.debugRuleKeys.includes("applySingleHitCap"));
      assert.ok(contract.debugPersistKeys.includes("parseAndValidateSaveRaw") && contract.debugPersistKeys.includes("mergeMetaStates"));
      assert.equal(contract.debugArtCount, 115);
      assert.equal(contract.artDecoded, 115);
      assert.deepEqual(contract.artFailed, []);
    } finally {
      await ctx.close();
    }
  });

  await runSuite("Q5-2", "Q5 V12 file://直接打开与HTTP一致性、旧档迁移(D05装备不削弱)、CY24云码与沙盒隔离", async () => {
    // 1. Direct file:// open in isolated 1440x900 Chromium context
    const fileUrl = pathToFileURL(path.join(PUBLIC_DIR, "playable-v2.html")).href;
    const fileCtx = await newIsolatedContext(browser);
    try {
      const filePage = await fileCtx.newPage();
      attachErrorListeners(filePage, "Q5-2-file");
      const fileExternalReqs = [];
      filePage.on("request", (req) => {
        const u = req.url();
        if (!u.startsWith("file://") && !u.startsWith("data:") && !u.startsWith("blob:") && !u.startsWith("about:")) {
          fileExternalReqs.push(u);
        }
      });

      await filePage.goto(fileUrl, { waitUntil: "domcontentloaded" });
      await filePage.waitForSelector("#btn-start-new");
      await filePage.waitForFunction(() => window.__CHENYUAN_V25__.getArtDecodeSummary().decodedCount === 115, { timeout: 10000 });
      await filePage.click("#btn-start-new");
      await filePage.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await dismissOpeningScroll(filePage);
      await filePage.waitForTimeout(160);

      const fileCheck = await filePage.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const st = v25.getState();
        const beforeX = st.arena.player.x;
        v25.stepArena(0.05);
        return {
          protocol: window.location.protocol,
          artDecoded: v25.getArtDecodeSummary().decodedCount,
          hasGame: Boolean(st.game),
          realm: st.game ? st.game.realm : null,
          debugVer: window.__CHENYUAN_DEBUG__ ? window.__CHENYUAN_DEBUG__.version : null,
          playerAlive: Boolean(st.arena && st.arena.player && st.game.hp > 0),
          beforeX
        };
      });

      assert.equal(fileExternalReqs.length, 0, `file:// made external requests: ${fileExternalReqs.join(", ")}`);
      assert.equal(fileCheck.protocol, "file:");
      assert.equal(fileCheck.artDecoded, 115);
      assert.equal(fileCheck.hasGame, true);
      assert.equal(fileCheck.realm, "mortal");
      assert.equal(fileCheck.debugVer, "q5-compat-1");
      assert.equal(fileCheck.playerAlive, true);
    } finally {
      await fileCtx.close();
    }

    // 2. HTTP context: legacy eb0ea67/s4_npc migration + D05 over-budget gear non-mutation + CY24SAVE cloud code + sandbox isolation
    const httpCtx = await newIsolatedContext(browser);
    try {
      const page = await httpCtx.newPage();
      attachErrorListeners(page, "Q5-2-http");
      await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#btn-start-new");

      // Inject legacy eb0ea67-style save with s4_npc step ID and D05 over-budget legacy common sword
      await page.evaluate((sKey) => {
        const legacyBundle = {
          stageIdx: 2,
          stanceIdx: 0,
          towerMode: false,
          sanctumMode: false,
          game: {
            version: 10,
            name: "旧档剑客",
            realm: "foundation",
            stones: 320,
            xp: 450,
            claimedStepIds: ["s1_xp", "s4_npc"],
            stageStars: { 0: 3, 1: 2 },
            equippedGear: {
              weapon: {
                uid: "g_legacy_d05_op",
                slot: "weapon",
                rarity: 0,
                lvl: 2,
                name: "凡品·传世旧剑",
                art: "icon_blade",
                atk: 500,
                hp: 0,
                dr: 0,
                crit: 0.35,
                spd: 0,
                bonusSword: 2,
                sell: 20,
                price: 50
              },
              armor: null,
              ring: null
            }
          }
        };
        localStorage.setItem(sKey, JSON.stringify(legacyBundle));
      }, STORAGE_KEY);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#btn-continue-save");
      await page.click("#btn-continue-save");
      await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await page.waitForTimeout(160);

      const httpCompat = await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const v24 = window.__CHENYUAN_V24__;
        const dbg = window.__CHENYUAN_DEBUG__;
        const g = v25.getState().game;
        const wpn = g.equippedGear.weapon;
        const migratedSteps = Array.isArray(g.claimedStepIds) ? g.claimedStepIds.slice() : [];
        const d05Preserved = Boolean(wpn && wpn.atk === 500 && wpn.crit === 0.35 && wpn.bonusSword === 2);

        // Cloud code export & round-trip import
        const code = v24.exportFullCloudSaveCode();
        const savedBeforeSandbox = { realm: g.realm, stones: g.stones, wpnAtk: wpn.atk };

        // Sandbox isolation check
        const enteredSandbox = v25.enterSandboxMode();
        const sbGame = v25.getState().game;
        sbGame.stones = 999999;
        const exitedSandbox = v25.exitSandboxMode();
        const afterSandboxStones = v25.getState().game.stones;

        // Cloud code round-trip import after mutating stones
        v25.getState().game.stones = 1;
        const importOk = v24.importFullCloudSaveCode(code);
        const afterImport = v25.getState().game;

        return {
          name: g.name,
          realm: g.realm,
          migratedSteps,
          d05Preserved,
          codePrefix: typeof code === "string" ? code.slice(0, 9) : "",
          enteredSandbox,
          exitedSandbox,
          savedBeforeSandbox,
          afterSandboxStones,
          importOk: Boolean(importOk),
          afterImportStones: afterImport.stones,
          afterImportWpnAtk: afterImport.equippedGear.weapon.atk,
          debugFacadeOk: Boolean(dbg && dbg.persistence && dbg.persistence.STORAGE_KEY === "chenyuan_wendao_v11_save")
        };
      });

      assert.equal(httpCompat.name, "旧档剑客");
      assert.equal(httpCompat.realm, "foundation");
      assert.ok(httpCompat.migratedSteps.includes("s1_wolf") && httpCompat.migratedSteps.includes("s4_puppet"), `Legacy step IDs must migrate: ${JSON.stringify(httpCompat.migratedSteps)}`);
      assert.equal(httpCompat.d05Preserved, true, "D05 invariant: legacy over-budget weapon stats must NOT be retroactively weakened");
      assert.equal(httpCompat.codePrefix, "CY24SAVE-");
      assert.equal(httpCompat.enteredSandbox, true);
      assert.equal(httpCompat.exitedSandbox, true);
      assert.equal(httpCompat.afterSandboxStones, httpCompat.savedBeforeSandbox.stones, "Sandbox mutations must NOT leak to formal save");
      assert.equal(httpCompat.importOk, true);
      assert.equal(httpCompat.afterImportStones, httpCompat.savedBeforeSandbox.stones);
      assert.equal(httpCompat.afterImportWpnAtk, 500);
      assert.equal(httpCompat.debugFacadeOk, true);
    } finally {
      await httpCtx.close();
    }
  });

  await runSuite("Q5-3", "Q5 F31/F32 Node导入src/rules/*.mjs与1440×900 Chromium实机输出完全一致", async () => {
    const [combatStatsMod, gearRulesMod, economyRulesMod, realmsItemsMod] = await Promise.all([
      import(pathToFileURL(path.join(REPO_ROOT, "src", "rules", "combat-stats.mjs")).href),
      import(pathToFileURL(path.join(REPO_ROOT, "src", "rules", "gear-rules.mjs")).href),
      import(pathToFileURL(path.join(REPO_ROOT, "src", "rules", "economy-rules.mjs")).href),
      import(pathToFileURL(path.join(REPO_ROOT, "src", "config", "realms-items.mjs")).href)
    ]);

    const { ctx, page } = await startCleanGamePage(browser, "Q5-3", true);
    try {
      const sampleGear = {
        slot: "weapon",
        rarity: 3,
        lvl: 4,
        atk: 46,
        hp: 0,
        dr: 0,
        crit: 0.09,
        spd: 0,
        bonusSword: 1,
        affix: "posture_crush"
      };

      const browserResult = await page.evaluate((gearArg) => {
        const v25 = window.__CHENYUAN_V25__;
        const dbg = window.__CHENYUAN_DEBUG__;
        v25.enterSanctumHub({ skipSave: true });
        const st = v25.getState();
        const g = st.game;
        g.realm = "foundation";
        g.school = "sword";
        g.stones = 640;
        g.omenIndex = 4; // fair
        g.laws = ["wealth_power", "crit_lotus"];
        g.choices = { lu_intro: "listen", shen_return: "warm" };
        g.inventory.herb = 1;
        g.inventory.dew = 1;
        g.inventory.core = 0;
        g.equippedGear.weapon = Object.assign({}, gearArg);

        const ledger = v25.computeCombatStatLedger(g);
        const effAtk = dbg.rules.effectiveGearVal(gearArg, "atk");
        const budget = v25.computeGearAffixBudget(gearArg);
        const lifespan = v25.previewLifespanImpact(g, 18);
        const recipeBd = dbg.rules.computeRecipeCostBreakdown(g, {
          id: "foundation",
          inputs: { herb: 2, dew: 3, core: 2 },
          stones: 20,
          months: 6
        });
        const celestialPhase = window.__CHENYUAN_V23__.getState().celestialPhase;
        return {
          gameSnap: JSON.parse(JSON.stringify(g)),
          arenaSnap: {
            comboCount: st.arena.comboCount || 0,
            styleScore: st.arena.styleScore || 0,
            reversedDomainTimer: st.arena.reversedDomainTimer || 0,
            weaponPosture: st.arena.weaponPosture || "qinglian",
            domain: Boolean(st.arena.domain),
            bossRush: { active: Boolean(st.arena.bossRush && st.arena.bossRush.active) },
            rushAffixes: [],
            astralForm: { active: Boolean(st.arena.astralForm && st.arena.astralForm.active) },
            player: {
              shieldHp: (st.arena.player && st.arena.player.shieldHp) || 0,
              boonOverloadTimer: (st.arena.player && st.arena.player.boonOverloadTimer) || 0,
              gourdHasteTimer: (st.arena.player && st.arena.player.gourdHasteTimer) || 0,
              gourdCritTimer: (st.arena.player && st.arena.player.gourdCritTimer) || 0,
              petBuffTimer: (st.arena.player && st.arena.player.petBuffTimer) || 0
            }
          },
          celestialPhaseId: celestialPhase ? celestialPhase.id : "dawn",
          ledgerTotals: ledger.totals,
          effAtk,
          budget,
          lifespan,
          recipeBd
        };
      }, sampleGear);

      const nodeLedger = combatStatsMod.computeCombatStatLedger(browserResult.gameSnap, {
        arena: browserResult.arenaSnap,
        getCurrentCelestialPhase: () => ({ id: browserResult.celestialPhaseId })
      });
      const nodeEffAtk = gearRulesMod.effectiveGearVal(sampleGear, "atk");
      const nodeBudget = gearRulesMod.computeGearAffixBudget(sampleGear);
      const nodeLifespan = economyRulesMod.previewLifespanImpact(browserResult.gameSnap, 18, { sandboxMode: false });
      const nodeRecipeBd = economyRulesMod.computeRecipeCostBreakdown(browserResult.gameSnap, realmsItemsMod.RECIPES.foundation);

      assert.deepEqual(nodeLedger.totals, browserResult.ledgerTotals, "Node ESM computeCombatStatLedger must match live Chromium V25 totals");
      assert.equal(nodeEffAtk, browserResult.effAtk, "Node ESM effectiveGearVal must match live Chromium");
      assert.deepEqual(nodeBudget, browserResult.budget, "Node ESM computeGearAffixBudget must match live Chromium");
      assert.deepEqual(nodeLifespan, browserResult.lifespan, "Node ESM previewLifespanImpact must match live Chromium");
      assert.deepEqual(nodeRecipeBd, browserResult.recipeBd, "Node ESM computeRecipeCostBreakdown must match live Chromium");
    } finally {
      await ctx.close();
    }
  });

  // =========================================================================
  // M7b TIER 5 WHITE-BOX ADVERSARIAL HARDENING SUITES (T5-1 .. T5-9)
  // =========================================================================
  await runSuite("T5-1", "M7b A-1 顿悟弹窗 pendingRewards.titleText 转义(主档+云码) + A-11 seenCutIns 危险键过滤", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "T5-1", true);

    // Part A (A-1 STORAGE_KEY path + A-11 seenCutIns prototype/own-key hygiene)
    const saveMarker = '<span data-unescaped-marker="t5_save">MARK_SAVE</span>';
    await page.evaluate(({ sk, marker }) => {
      const api = window.__CHENYUAN_V25__;
      const st = api.getState();
      st.game.pendingRewards = [{
        eventId: "pr_t5_save_xss_1",
        kind: "iconic_draft",
        noticeClass: "N1",
        payload: { titleText: marker, source: "default" }
      }];
      api.saveGame();
      const raw = JSON.parse(localStorage.getItem(sk));
      // Inject raw JSON string with __proto__ & unsafe keys into seenCutIns and recompute checksum via load->save or manual canonical checksum
      const injected = JSON.parse(
        JSON.stringify(raw).replace(
          '"seenCutIns":{}',
          '"seenCutIns":{"__proto__":{"polluted_t5":"BAD"},"constructor":true,"prototype":true,"toString":true,"valueOf":true,"hasOwnProperty":true,"valid_cutin_1":true}'
        )
      );
      // Recompute canonical FNV-1a checksum matching buildCanonicalSavePayload
      const payloadStr = JSON.stringify({
        game: injected.game,
        stageIdx: injected.stageIdx,
        stanceIdx: injected.stanceIdx,
        towerMode: !!injected.towerMode,
        sanctumMode: !!injected.sanctumMode
      });
      let h = 2166136261 >>> 0;
      for (let i = 0; i < payloadStr.length; i++) {
        h ^= payloadStr.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      injected.checksum = h.toString(16).toUpperCase().padStart(8, "0");
      localStorage.setItem(sk, JSON.stringify(injected));
    }, { sk: STORAGE_KEY, marker: saveMarker });

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#btn-continue-save", { state: "visible" });
    await page.click("#btn-continue-save");
    await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await page.waitForSelector("#btn-pending-rewards", { state: "visible" });

    // Verify A-11 immediately after normalizeLoadedGame
    const cutInCheck = await page.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      const sc = g.seenCutIns;
      const own = (k) => Object.prototype.hasOwnProperty.call(sc, k);
      let stringified = "";
      let stringThrew = false;
      try { stringified = String(sc); } catch { stringThrew = true; }
      return {
        polluted: Object.prototype.polluted_t5 !== undefined,
        ownCtor: own("constructor"),
        ownProto: own("prototype"),
        ownToString: own("toString"),
        ownValueOf: own("valueOf"),
        ownHasOwn: own("hasOwnProperty"),
        keptValid: sc.valid_cutin_1 === true,
        stringThrew,
        stringified
      };
    });
    assert.equal(cutInCheck.polluted, false, "A-11: Object.prototype must remain clean");
    assert.equal(cutInCheck.ownCtor, false, "A-11: seenCutIns must filter constructor");
    assert.equal(cutInCheck.ownProto, false, "A-11: seenCutIns must filter prototype");
    assert.equal(cutInCheck.ownToString, false, "A-11: seenCutIns must filter toString");
    assert.equal(cutInCheck.ownValueOf, false, "A-11: seenCutIns must filter valueOf");
    assert.equal(cutInCheck.ownHasOwn, false, "A-11: seenCutIns must filter hasOwnProperty");
    assert.equal(cutInCheck.keptValid, true, "A-11: Valid seenCutIns entries must be preserved");
    assert.equal(cutInCheck.stringThrew, false, "A-11: String(game.seenCutIns) must not throw");

    // Open iconic_draft via #btn-pending-rewards and verify A-1 STORAGE_KEY escaping
    await page.click("#btn-pending-rewards");
    await page.waitForSelector("#modal-backdrop.open #modal-content h2");
    const saveXssRes = await page.evaluate((marker) => ({
      injectedEl: Boolean(document.querySelector("[data-unescaped-marker]")),
      h2Text: document.querySelector("#modal-content h2")?.textContent || "",
      matchesLiteral: (document.querySelector("#modal-content h2")?.textContent || "").includes(marker)
    }), saveMarker);
    assert.equal(saveXssRes.injectedEl, false, "A-1 (STORAGE_KEY): openIconicUpgradeDraft must NOT inject live HTML from titleText");
    assert.equal(saveXssRes.matchesLiteral, true, `A-1 (STORAGE_KEY): escaped titleText must render literally, got: ${saveXssRes.h2Text}`);

    // Pick a draft card to clear the modal, then verify A-1 CY24SAVE cloud-code import path
    await page.click("#modal-content [data-draft-type]");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));

    const cloudMarker = '<span data-unescaped-marker="t5_cloud">MARK_CLOUD</span>';
    const craftedCloudCode = await page.evaluate((marker) => {
      const code = window.__CHENYUAN_V25__.exportFullCloudSaveCode();
      const parts = code.split("-");
      const b64 = parts.slice(2).join("-");
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      payload.game.pendingRewards = [{
        eventId: "pr_t5_cloud_xss_1",
        kind: "iconic_draft",
        noticeClass: "N1",
        payload: { titleText: marker, source: "default" }
      }];
      const jsonStr = JSON.stringify(payload);
      let sum = 0x24;
      for (let i = 0; i < jsonStr.length; i++) sum = (sum * 31 + jsonStr.charCodeAt(i)) & 0xFFFF;
      const chk = sum.toString(16).toUpperCase().padStart(4, "0");
      const encBytes = new TextEncoder().encode(jsonStr);
      let encBin = "";
      for (let i = 0; i < encBytes.length; i++) encBin += String.fromCharCode(encBytes[i]);
      return `CY24SAVE-${chk}-${btoa(encBin)}`;
    }, cloudMarker);

    await page.click("#btn-open-settings");
    await page.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await page.click('[data-sys-tab="controls"]');
    await page.waitForSelector("#inp-cloud-save-code");
    await page.fill("#inp-cloud-save-code", craftedCloudCode);
    await page.click("#btn-import-cloud-save");
    await page.waitForSelector("#btn-confirm-cloud-import");
    await page.click("#btn-confirm-cloud-import");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    await page.waitForSelector("#btn-pending-rewards", { state: "visible" });
    await page.click("#btn-pending-rewards");
    await page.waitForSelector("#modal-backdrop.open #modal-content h2");
    const cloudXssRes = await page.evaluate((marker) => ({
      injectedEl: Boolean(document.querySelector("[data-unescaped-marker]")),
      h2Text: document.querySelector("#modal-content h2")?.textContent || "",
      matchesLiteral: (document.querySelector("#modal-content h2")?.textContent || "").includes(marker)
    }), cloudMarker);
    assert.equal(cloudXssRes.injectedEl, false, "A-1 (CY24SAVE): openIconicUpgradeDraft must NOT inject live HTML from imported cloud titleText");
    assert.equal(cloudXssRes.matchesLiteral, true, `A-1 (CY24SAVE): escaped cloud titleText must render literally, got: ${cloudXssRes.h2Text}`);
    await ctx.close();
  });

  await runSuite("T5-2", "M7b A-2 双标签低版本号谱系重置冲突 + A-3 removeItem 失败诚实提示与兵解回滚 + A-4 延迟 storage 事件不掩盖磁盘损坏", async () => {
    // Part A (A-2): Tab 1 advances to saveRev >= 5, Tab 2 resets and starts fresh life (saveRev = 1) -> Tab 1 must trigger conflict & NOT clobber Tab 2
    const ctx = await newIsolatedContext(browser);
    const tab1 = await ctx.newPage();
    attachErrorListeners(tab1, "T5-2-Tab1");
    await tab1.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tab1.evaluate(() => localStorage.clear());
    await tab1.reload({ waitUntil: "domcontentloaded" });
    await tab1.click("#btn-toggle-origin");
    await tab1.waitForSelector("#player-name-input", { state: "visible" });
    await tab1.fill("#player-name-input", "旧世残影");
    await tab1.click("#btn-start-new");
    await tab1.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await dismissOpeningScroll(tab1);
    const rev1 = await tab1.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      for (let i = 0; i < 4; i++) {
        api.getState().game.stones += 10;
        api.saveGame();
      }
      return api.getPersistenceState().loadedSaveRev;
    });
    assert.ok(rev1 >= 5, `Expected Tab 1 loadedSaveRev >= 5, got ${rev1}`);

    const tab2 = await ctx.newPage();
    attachErrorListeners(tab2, "T5-2-Tab2");
    await tab2.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tab2.waitForSelector("#btn-continue-save", { state: "visible" });
    await tab2.click("#btn-continue-save");
    await tab2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await tab2.click("#btn-open-settings");
    await tab2.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await tab2.click('[data-sys-tab="controls"]');
    await tab2.waitForSelector('[data-action="confirm-reset-save"]');
    await tab2.click('[data-action="confirm-reset-save"]');
    await tab2.waitForSelector('[data-action="execute-reset-save"]');
    await tab2.click('[data-action="execute-reset-save"]');
    await tab2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display !== "none");
    await tab2.click("#btn-toggle-origin");
    await tab2.waitForSelector("#player-name-input", { state: "visible" });
    await tab2.fill("#player-name-input", "新世道友");
    await tab2.click("#btn-start-new");
    await tab2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await dismissOpeningScroll(tab2);
    await tab1.waitForTimeout(250);

    const tab1Conflict = await tab1.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      const conflictBefore = Boolean(api.getPersistenceState().saveConflictState);
      const saveOk = api.saveGame();
      const conflictAfter = Boolean(api.getPersistenceState().saveConflictState);
      const disk = JSON.parse(localStorage.getItem(sk));
      return {
        conflictBefore,
        saveOk,
        conflictAfter,
        diskName: disk?.game?.name,
        diskRev: disk?.saveRev
      };
    }, STORAGE_KEY);
    assert.equal(tab1Conflict.conflictBefore, true, "A-2: Tab 1 must detect cross-tab reset/new-lineage save conflict via storage event");
    assert.equal(tab1Conflict.saveOk, false, "A-2: Tab 1 saveGame() must refuse to clobber Tab 2's fresh lower-rev save");
    assert.equal(tab1Conflict.conflictAfter, true, "A-2: Tab 1 must retain saveConflictState");
    assert.equal(tab1Conflict.diskName, "新世道友", `A-2: Tab 2 fresh save must remain intact on disk, got ${tab1Conflict.diskName}`);
    assert.equal(tab1Conflict.diskRev, 1, `A-2: Tab 2 saveRev=1 must NOT be overwritten, got ${tab1Conflict.diskRev}`);
    await ctx.close();

    // Part B (A-3): localStorage.removeItem throws SecurityError in execute-reset-save & executeReincarnation
    const { ctx: ctxB, page: pageB } = await startCleanGamePage(browser, "T5-2-A3", true);
    await pageB.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.name = "不灭旧档";
      api.saveGame();
      window.__t5OrigRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (k) {
        if (k === sk) throw new DOMException("Read-only storage", "SecurityError");
        return window.__t5OrigRemoveItem.call(this, k);
      };
    }, STORAGE_KEY);

    await pageB.click("#btn-open-settings");
    await pageB.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await pageB.click('[data-sys-tab="controls"]');
    await pageB.click('[data-action="confirm-reset-save"]');
    await pageB.waitForSelector('[data-action="execute-reset-save"]');
    await pageB.evaluate(() => { const tc = document.getElementById("toast-container"); if (tc) tc.innerHTML = ""; });
    await pageB.click('[data-action="execute-reset-save"]');
    await pageB.waitForTimeout(100);
    const resetErrRes = await pageB.evaluate((sk) => ({
      welcomeVisible: document.getElementById("welcome-screen")?.style.display !== "none",
      hasGame: Boolean(window.__CHENYUAN_V25__.getState().game),
      diskStillHasSave: Boolean(localStorage.getItem(sk)),
      toasts: Array.from(document.querySelectorAll("#toast-container .toast-pill")).map(x => x.textContent || "").join(" | ")
    }), STORAGE_KEY);
    assert.equal(resetErrRes.welcomeVisible, false, "A-3 (reset): Must NOT falsely return to welcome screen when removeItem throws");
    assert.equal(resetErrRes.hasGame, true, "A-3 (reset): Must keep in-memory game intact when removeItem throws");
    assert.equal(resetErrRes.diskStillHasSave, true, "A-3 (reset): Save remains on disk");
    assert.ok(!resetErrRes.toasts.includes("已清空当前本地存档"), `A-3 (reset): Must NOT falsely claim save cleared, got: ${resetErrRes.toasts}`);
    assert.ok(/失败|阻止|SecurityError|无法清空/.test(resetErrRes.toasts), `A-3 (reset): Must show explicit error toast, got: ${resetErrRes.toasts}`);

    // Now test bingjie executeReincarnation rollback under SecurityError
    await pageB.keyboard.press("Escape");
    await pageB.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const ptsBeforeBingjie = await pageB.evaluate((mk) => {
      const api = window.__CHENYUAN_V25__;
      api.saveMeta();
      const memPts = Number(api.getMetaState().reincarnationPoints) || 0;
      const diskPts = Number(JSON.parse(localStorage.getItem(mk) || "{}").reincarnationPoints) || 0;
      api.openLifespanExhaustedModal(true);
      const tc = document.getElementById("toast-container");
      if (tc) tc.innerHTML = "";
      return { memPts, diskPts };
    }, META_KEY);
    await pageB.waitForSelector('#modal-backdrop.open [data-action="confirm-bingjie-reincarnate"]');
    await pageB.click('#modal-backdrop.open [data-action="confirm-bingjie-reincarnate"]');
    await pageB.waitForTimeout(100);
    const bingjieErrRes = await pageB.evaluate(({ sk, mk }) => {
      const api = window.__CHENYUAN_V25__;
      return {
        welcomeVisible: document.getElementById("welcome-screen")?.style.display !== "none",
        hasGame: Boolean(api.getState().game),
        diskStillHasSave: Boolean(localStorage.getItem(sk)),
        memPts: Number(api.getMetaState().reincarnationPoints) || 0,
        diskPts: Number(JSON.parse(localStorage.getItem(mk) || "{}").reincarnationPoints) || 0,
        toasts: Array.from(document.querySelectorAll("#toast-container .toast-pill")).map(x => x.textContent || "").join(" | ")
      };
    }, { sk: STORAGE_KEY, mk: META_KEY });
    assert.equal(bingjieErrRes.welcomeVisible, false, "A-3 (bingjie): Must NOT return to welcome screen on removeItem failure");
    assert.equal(bingjieErrRes.hasGame, true, "A-3 (bingjie): Must keep in-memory game intact");
    assert.equal(bingjieErrRes.memPts, ptsBeforeBingjie.memPts, "A-3 (bingjie): Must roll back +40 reincarnationPoints in memory");
    assert.equal(bingjieErrRes.diskPts, ptsBeforeBingjie.diskPts, "A-3 (bingjie): Must roll back +40 reincarnationPoints on disk META_KEY");
    assert.ok(!bingjieErrRes.toasts.includes("兵解转世已成"), `A-3 (bingjie): Must NOT falsely claim reincarnation succeeded, got: ${bingjieErrRes.toasts}`);

    await pageB.evaluate(() => { Storage.prototype.removeItem = window.__t5OrigRemoveItem; });
    await ctxB.close();

    // Part C (A-4): Delayed valid StorageEvent on STORAGE_KEY while live disk is corrupted must surface storageReadError, NOT save_conflict modal
    const { ctx: ctxC, page: pageC } = await startCleanGamePage(browser, "T5-2-A4", true);
    const a4Res = await pageC.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      const env = JSON.parse(localStorage.getItem(sk));
      env.saveRev = 9;
      env.tabId = "tab_delayed_other_999";
      const validDelayedRaw = JSON.stringify(env);
      const corruptLive = "{CORRUPT_LIVE_DISK_T5";
      localStorage.setItem(sk, corruptLive);
      window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: validDelayedRaw }));
      const ps = api.getPersistenceState();
      return {
        modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open")),
        modalKind: api.getActiveModalKind(),
        hasConflict: Boolean(ps.saveConflictState),
        hasReadErr: Boolean(ps.storageReadError),
        diskRaw: localStorage.getItem(sk),
        alertVisible: getComputedStyle(document.getElementById("hud-save-alert")).display !== "none"
      };
    }, STORAGE_KEY);
    assert.equal(a4Res.hasReadErr, true, "A-4: Live disk corruption must set storageReadError even on delayed valid StorageEvent");
    assert.equal(a4Res.hasConflict, false, "A-4: Must NOT set bogus saveConflictState when live disk is corrupted");
    assert.notEqual(a4Res.modalKind, "save_conflict", "A-4: Must NOT open bogus save_conflict modal over live disk corruption");
    assert.equal(a4Res.diskRaw, "{CORRUPT_LIVE_DISK_T5", "A-4: Corrupt raw save must remain untouched on disk");
    assert.equal(a4Res.alertVisible, true, "A-4: #hud-save-alert must surface corrupt save status");
    await ctxC.close();
  });

  await runSuite("T5-3", "M7b A-5/A-6 存档警报条保焦与元存档重试 + A-7 6秒内重开报错 + A-8 炼丹微操关闭清理 + A-9 键位边界 + A-10 过场抽屉互斥与浮卡保焦", async () => {
    // Part A (A-5): load-latest-save failures from alert & modal-from-alert stay-readonly-save / load-latest-save keep focus off BODY
    const ctxA = await newIsolatedContext(browser);
    const tabA = await ctxA.newPage();
    attachErrorListeners(tabA, "T5-3-A5A");
    await tabA.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabA.evaluate(() => localStorage.clear());
    await tabA.reload({ waitUntil: "domcontentloaded" });
    await tabA.click("#btn-start-new");
    await tabA.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await dismissOpeningScroll(tabA);

    const tabB = await ctxA.newPage();
    attachErrorListeners(tabB, "T5-3-A5B");
    await tabB.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tabB.waitForSelector("#btn-continue-save");
    await tabB.click("#btn-continue-save");
    await tabB.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await tabB.evaluate(() => { window.__CHENYUAN_V25__.getState().game.stones = 333; window.__CHENYUAN_V25__.saveGame(); });
    await tabA.waitForSelector('#modal-backdrop.open [data-action="stay-readonly-save"]');

    // Test modal-from-alert stay-readonly-save: first close/reopen conflict modal via #hud-save-alert trigger
    await tabA.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.closeModal();
    });
    await tabA.waitForSelector('#hud-save-alert [data-action="open-save-conflict"]');
    await tabA.focus('#hud-save-alert [data-action="open-save-conflict"]');
    await tabA.click('#hud-save-alert [data-action="open-save-conflict"]');
    await tabA.waitForSelector('#modal-backdrop.open [data-action="stay-readonly-save"]');
    await tabA.click('#modal-backdrop.open [data-action="stay-readonly-save"]');
    await tabA.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const stayFromAlertFocus = await tabA.evaluate(() => ({ isBody: document.activeElement === document.body, tag: document.activeElement?.tagName }));
    assert.equal(stayFromAlertFocus.isBody, false, `A-5: stay-readonly-save from alert-opened modal must NOT drop focus to BODY (got ${stayFromAlertFocus.tag})`);

    // Case A: corrupt disk + click load-latest-save from #hud-save-alert
    await tabA.evaluate((sk) => { localStorage.setItem(sk, "{CORRUPT_A5_JSON"); }, STORAGE_KEY);
    await tabA.focus('#hud-save-alert [data-action="load-latest-save"]');
    await tabA.click('#hud-save-alert [data-action="load-latest-save"]');
    await tabA.waitForTimeout(80);
    const corruptAlertFocus = await tabA.evaluate((sk) => ({
      isBody: document.activeElement === document.body,
      tag: document.activeElement?.tagName,
      diskRaw: localStorage.getItem(sk)
    }), STORAGE_KEY);
    assert.equal(corruptAlertFocus.isBody, false, `A-5: load-latest-save failure (corrupt disk) must keep focus off BODY (got ${corruptAlertFocus.tag})`);
    assert.equal(corruptAlertFocus.diskRaw, "{CORRUPT_A5_JSON", "A-5: corrupt disk raw string must be preserved");

    // Case B: deleted disk + click load-latest-save from #hud-save-alert
    await tabA.evaluate((sk) => { localStorage.removeItem(sk); }, STORAGE_KEY);
    await tabA.evaluate(() => {
      // Trigger another conflict->readonly so load-latest-save is visible with empty disk
      const api = window.__CHENYUAN_V25__;
      api.inspectSavedBundle(); // clears storageReadError because disk is now empty
      api.updateHud();
      window.dispatchEvent(new StorageEvent("storage", { key: "chenyuan_wendao_v11_save", newValue: null }));
    });
    await tabA.waitForSelector('#modal-backdrop.open [data-action="stay-readonly-save"]');
    await tabA.click('#modal-backdrop.open [data-action="stay-readonly-save"]');
    await tabA.waitForSelector('#hud-save-alert [data-action="load-latest-save"]');
    await tabA.focus('#hud-save-alert [data-action="load-latest-save"]');
    await tabA.click('#hud-save-alert [data-action="load-latest-save"]');
    await tabA.waitForTimeout(80);
    const deletedAlertFocus = await tabA.evaluate(() => ({ isBody: document.activeElement === document.body, tag: document.activeElement?.tagName }));
    assert.equal(deletedAlertFocus.isBody, false, `A-5: load-latest-save failure (deleted disk) must keep focus off BODY (got ${deletedAlertFocus.tag})`);
    await ctxA.close();

    // Part B (A-6): retry-meta-save failure, corrupt-disk toast, and recovery focus retention
    const { ctx: ctxM, page: pageM } = await startCleanGamePage(browser, "T5-3-A6", true);
    await pageM.evaluate((mk) => {
      window.__t5OrigSetItemMeta = Storage.prototype.setItem;
      window.__t5FailMeta = true;
      Storage.prototype.setItem = function (k, v) {
        if (window.__t5FailMeta && k === mk) throw new DOMException("Quota exceeded", "QuotaExceededError");
        return window.__t5OrigSetItemMeta.call(this, k, v);
      };
      window.__CHENYUAN_V25__.saveMeta();
    }, META_KEY);
    await pageM.waitForSelector('#hud-save-alert [data-action="retry-meta-save"]');
    await pageM.focus('#hud-save-alert [data-action="retry-meta-save"]');
    await pageM.click('#hud-save-alert [data-action="retry-meta-save"]');
    await pageM.waitForTimeout(60);
    const metaFailFocus = await pageM.evaluate(() => ({ isBody: document.activeElement === document.body, tag: document.activeElement?.tagName }));
    assert.equal(metaFailFocus.isBody, false, `A-6: retry-meta-save failure must keep focus off BODY (got ${metaFailFocus.tag})`);

    // Corrupt META_KEY on disk while retry-meta-save button is visible -> must emit toast & keep focus off BODY
    await pageM.evaluate((mk) => {
      window.__t5OrigSetItemMeta.call(localStorage, mk, "{CORRUPT_META_T5");
      const tc = document.getElementById("toast-container");
      if (tc) tc.innerHTML = "";
    }, META_KEY);
    await pageM.focus('#hud-save-alert [data-action="retry-meta-save"]');
    await pageM.click('#hud-save-alert [data-action="retry-meta-save"]');
    await pageM.waitForTimeout(60);
    const metaCorruptRes = await pageM.evaluate((mk) => ({
      isBody: document.activeElement === document.body,
      hasMetaReadErr: Boolean(window.__CHENYUAN_V25__.getPersistenceState().metaReadError),
      toasts: Array.from(document.querySelectorAll("#toast-container .toast-pill")).map(x => x.textContent || "").join(" | "),
      diskRaw: localStorage.getItem(mk)
    }), META_KEY);
    assert.equal(metaCorruptRes.hasMetaReadErr, true, "A-6: retry-meta-save must detect corrupt META_KEY");
    assert.ok(metaCorruptRes.toasts.length > 0, "A-6: retry-meta-save on corrupt META_KEY must NOT be silent");
    assert.equal(metaCorruptRes.diskRaw, "{CORRUPT_META_T5", "A-6: corrupt META_KEY raw string must be preserved");
    assert.equal(metaCorruptRes.isBody, false, "A-6: retry-meta-save on corrupt META_KEY must keep focus off BODY");

    // Restore valid META_KEY, trigger metaWriteError again, then unblock & recover -> focus must stay off BODY
    await pageM.evaluate((mk) => {
      window.__t5FailMeta = false;
      window.__t5OrigSetItemMeta.call(localStorage, mk, JSON.stringify({ metaRev: 1, ascensions: 0 }));
      window.__CHENYUAN_V25__.inspectMetaState({ applyToMemory: true });
      window.__t5FailMeta = true;
      window.__CHENYUAN_V25__.saveMeta();
      window.__t5FailMeta = false;
    }, META_KEY);
    await pageM.waitForSelector('#hud-save-alert [data-action="retry-meta-save"]');
    await pageM.focus('#hud-save-alert [data-action="retry-meta-save"]');
    await pageM.click('#hud-save-alert [data-action="retry-meta-save"]');
    await pageM.waitForTimeout(60);
    const metaRecoverRes = await pageM.evaluate(() => ({
      isBody: document.activeElement === document.body,
      activeId: document.activeElement?.id || "",
      alertDisplay: getComputedStyle(document.getElementById("hud-save-alert")).display
    }));
    assert.equal(metaRecoverRes.alertDisplay, "none", "A-6: alert must hide after meta write recovery");
    assert.equal(metaRecoverRes.isBody, false, `A-6: retry-meta-save recovery must restore focus off BODY (got id=${metaRecoverRes.activeId})`);
    await pageM.evaluate(() => { Storage.prototype.setItem = window.__t5OrigSetItemMeta; });
    await ctxM.close();

    // Part C (A-7 + A-9 F3 on welcome screen): startFreshGameSession repeat <6s write failure emits toast; F3 blocked on welcome screen
    const ctxW = await newIsolatedContext(browser);
    const pageW = await ctxW.newPage();
    attachErrorListeners(pageW, "T5-3-A7A9");
    await pageW.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await pageW.evaluate(() => localStorage.clear());
    await pageW.reload({ waitUntil: "domcontentloaded" });
    await pageW.waitForSelector("#welcome-screen", { state: "visible" });
    await pageW.keyboard.press("F3");
    await pageW.waitForTimeout(80);
    const f3WelcomeOpen = await pageW.evaluate(() => Boolean(document.getElementById("action-telemetry-panel")?.classList.contains("open")));
    assert.equal(f3WelcomeOpen, false, "A-9: F3 must NOT open #action-telemetry-panel over #welcome-screen");

    await pageW.evaluate((sk) => {
      window.__t5OrigSetItemW = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (k === sk) throw new DOMException("Quota exceeded", "QuotaExceededError");
        return window.__t5OrigSetItemW.call(this, k, v);
      };
    }, STORAGE_KEY);
    await pageW.click("#btn-start-new");
    await pageW.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await dismissOpeningScroll(pageW);
    await pageW.click("#btn-open-settings");
    await pageW.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await pageW.click('[data-sys-tab="controls"]');
    await pageW.click('[data-action="return-title-safe"]');
    await pageW.waitForFunction(() => document.getElementById("welcome-screen")?.style.display !== "none");
    await pageW.evaluate(() => { const tc = document.getElementById("toast-container"); if (tc) tc.innerHTML = ""; });
    await pageW.click("#btn-start-new");
    await pageW.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    const repeatToasts = await pageW.evaluate(() =>
      Array.from(document.querySelectorAll("#toast-container .toast-pill")).map(x => x.textContent || "").join(" | ")
    );
    assert.ok(repeatToasts.includes("写入失败"), `A-7: Repeat <6s startFreshGameSession QuotaExceededError MUST emit toast, got: ${repeatToasts}`);
    await pageW.evaluate(() => { Storage.prototype.setItem = window.__t5OrigSetItemW; });
    await ctxW.close();

    // Part D (A-8, A-9 popover/Space, A-10 cutscene+drawer & floating card focus)
    const { ctx: ctxK, page: pageK } = await startCleanGamePage(browser, "T5-3-A8A9A10", true, { dismissOpening: false });

    // A-10 Part 1: During active opening_scroll cutscene, clicking [data-tab="cultivate"] must NOT stack drawer
    await pageK.waitForSelector("#story-dialogue-bar.open");
    await pageK.click('.nav-tab-btn[data-tab="cultivate"]', { force: true });
    await pageK.waitForTimeout(80);
    const cutsceneDrawerCheck = await pageK.evaluate(() => ({
      drawerOpen: Boolean(document.getElementById("jade-panel")?.classList.contains("drawer-open")),
      cutsceneOpen: Boolean(document.getElementById("story-dialogue-bar")?.classList.contains("open")),
      focusInDialogue: Boolean(document.getElementById("story-dialogue-bar")?.contains(document.activeElement))
    }));
    assert.equal(cutsceneDrawerCheck.drawerOpen, false, "A-10: toggleDrawer must be blocked while cutscene is active");
    assert.equal(cutsceneDrawerCheck.cutsceneOpen, true, "A-10: cutscene must remain active");
    assert.equal(cutsceneDrawerCheck.focusInDialogue, true, "A-10: focus must remain inside #story-dialogue-bar");
    await dismissOpeningScroll(pageK);

    // A-10 reverse: Opening drawer first then starting cutscene must close drawer cleanly with no leaked drawer pauseToken
    await pageK.click('.nav-tab-btn[data-tab="cultivate"]');
    await pageK.waitForSelector("#jade-panel.drawer-open");
    await pageK.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      if (g.seenCutscenes) delete g.seenCutscenes.opening_scroll;
      api.playCutscene("opening_scroll");
    });
    await pageK.waitForSelector("#story-dialogue-bar.open");
    const reverseStack = await pageK.evaluate(() => ({
      drawerOpen: Boolean(document.getElementById("jade-panel")?.classList.contains("drawer-open")),
      pauseOwners: window.__CHENYUAN_V25__.getPauseTokens().map(t => t.owner)
    }));
    assert.equal(reverseStack.drawerOpen, false, "A-10: Starting cutscene while drawer open must cleanly close drawer");
    assert.equal(reverseStack.pauseOwners.includes("drawer"), false, "A-10: Closing drawer on cutscene start must release drawer pauseToken");
    await dismissOpeningScroll(pageK);

    // A-8: closeModal() clears craftMinigame.open so Space in Settings does NOT strike
    await pageK.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.realm = "spirit";
      api.openTaixuCraftMinigameModal("alchemy");
    });
    await pageK.waitForSelector('#modal-backdrop.open [data-modal-close="1"]');
    await pageK.click('#modal-backdrop.open [data-modal-close="1"]');
    await pageK.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    await pageK.waitForTimeout(120);
    const craftAfterClose = await pageK.evaluate(() => window.__CHENYUAN_V23__.getState().craftMinigame.open);
    assert.equal(craftAfterClose, false, "A-8: closeModal() via button must reset craftMinigame.open to false");
    await pageK.click("#btn-open-settings");
    await pageK.waitForSelector("#modal-backdrop.open");
    await pageK.keyboard.press("Space");
    await pageK.waitForTimeout(60);
    const craftStrikes = await pageK.evaluate(() => window.__CHENYUAN_V23__.getState().craftMinigame.strikes);
    assert.equal(craftStrikes, 0, "A-8: Space inside Settings must NOT fire ghost craftMinigame strikes");
    await pageK.keyboard.press("Escape");
    await pageK.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));

    // A-9: #pavilion-popover closes on Escape and returns focus to #btn-pavilion-menu
    await pageK.click("#btn-pavilion-menu");
    await pageK.waitForSelector("#pavilion-popover.open");
    await pageK.keyboard.press("Escape");
    await pageK.waitForTimeout(60);
    const pavEsc1 = await pageK.evaluate(() => ({
      open: Boolean(document.getElementById("pavilion-popover")?.classList.contains("open")),
      activeId: document.activeElement?.id || ""
    }));
    assert.equal(pavEsc1.open, false, "A-9: Escape must close #pavilion-popover");
    assert.equal(pavEsc1.activeId, "btn-pavilion-menu", `A-9: Escape from #pavilion-popover must return focus to #btn-pavilion-menu, got ${pavEsc1.activeId}`);

    // A-9: Space on focused HUD <button> (#btn-goals-modal) activates button instead of firing combat dash
    await pageK.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.enterSanctumHub();
      api.getState().arena.player.dashCd = 0;
    });
    await pageK.focus("#btn-goals-modal");
    await pageK.keyboard.press("Space");
    await pageK.waitForTimeout(100);
    const hudSpaceRes = await pageK.evaluate(() => ({
      modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open")),
      dashCd: window.__CHENYUAN_V25__.getState().arena.player.dashCd
    }));
    assert.equal(hudSpaceRes.modalOpen, true, "A-9: Pressing Space on focused #btn-goals-modal must open Goals modal");
    assert.equal(hudSpaceRes.dashCd, 0, `A-9: Pressing Space on focused HUD <button> must NOT fire dash (dashCd=${hudSpaceRes.dashCd})`);
    await pageK.keyboard.press("Escape");
    await pageK.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));

    // A-10 Part 2: Floating HUD cards never drop focus to BODY
    // 1) #btn-skip-onboarding
    await pageK.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "mortal";
      g.tutorialDismissed = false;
      g.tutorialStep = 0;
      api.renderOnboardingCoach();
    });
    await pageK.waitForSelector("#btn-skip-onboarding", { state: "visible" });
    await pageK.focus("#btn-skip-onboarding");
    await pageK.keyboard.press("Enter");
    await pageK.waitForTimeout(60);
    assert.equal(await pageK.evaluate(() => document.activeElement === document.body), false, "A-10: #btn-skip-onboarding must not drop focus to BODY");

    // 2) #btn-unlock-dismiss and #btn-unlock-try
    await pageK.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "qi";
      g.seenUnlockIds = [];
      api.queueNewUnlockCardsForState(g);
      api.flushNewUnlockCard();
    });
    await pageK.waitForSelector("#new-unlock-card #btn-unlock-dismiss", { state: "visible" });
    await pageK.focus("#btn-unlock-dismiss");
    await pageK.keyboard.press("Enter");
    await pageK.waitForTimeout(60);
    assert.equal(await pageK.evaluate(() => document.activeElement === document.body), false, "A-10: #btn-unlock-dismiss must not drop focus to BODY");

    await pageK.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "qi";
      g.seenUnlockIds = [];
      api.queueNewUnlockCardsForState(g);
      api.flushNewUnlockCard();
    });
    await pageK.waitForSelector("#new-unlock-card #btn-unlock-try", { state: "visible" });
    await pageK.focus("#btn-unlock-try");
    await pageK.keyboard.press("Enter");
    await pageK.waitForTimeout(60);
    assert.equal(await pageK.evaluate(() => document.activeElement === document.body), false, "A-10: #btn-unlock-try must not drop focus to BODY");

    // 3) #gear-compare-card Step 1 smelt-arm & compare-keep-bag
    await pageK.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const item = api.rollGearItem(2, 2, "weapon");
      item.name = "玄品·焦点试剑";
      item.sell = 40;
      api.acquireGearItem(item);
      api.requestCalmReevaluation({ immediate: true });
    });
    await pageK.waitForSelector('#gear-compare-card [data-action="compare-smelt-new"]', { state: "visible" });
    await pageK.waitForTimeout(300);
    await pageK.focus('#gear-compare-card [data-action="compare-smelt-new"]');
    await pageK.keyboard.press("Enter");
    await pageK.waitForTimeout(60);
    const smeltArmFocus = await pageK.evaluate(() => ({
      isBody: document.activeElement === document.body,
      activeAction: document.activeElement?.getAttribute?.("data-action") || ""
    }));
    assert.equal(smeltArmFocus.isBody, false, "A-10: compare-smelt-new Step 1 must NOT drop focus to BODY");
    assert.equal(smeltArmFocus.activeAction, "compare-smelt-new", `A-10: compare-smelt-new Step 1 must refocus armed smelt button, got ${smeltArmFocus.activeAction}`);

    await pageK.focus('#gear-compare-card [data-action="compare-keep-bag"]');
    await pageK.keyboard.press("Enter");
    await pageK.waitForTimeout(60);
    assert.equal(await pageK.evaluate(() => document.activeElement === document.body), false, "A-10: compare-keep-bag must NOT drop focus to BODY");
    await ctxK.close();
  });

  await runSuite("T5-4", "M7b B-1 万剑冢天雷劫 TDZ 修复与主循环存活 + B-2 造化工坊奇物/掉落硬隔离 + B-3 练习模式全链路正式养成/渡劫/存档隔离", async () => {
    // Part A (B-1): Boss Rush rush_thunder affix must NOT throw ReferenceError or freeze mainLoop
    const { ctx: ctx1, page: page1 } = await startCleanGamePage(browser, "T5-4-B1", true);
    await page1.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.realm = "nascent";
      api.openBossRushModal();
    });
    await page1.waitForSelector('#modal-backdrop.open [data-rush-affix="rush_thunder"]');
    await page1.click('#modal-backdrop.open [data-rush-affix="rush_thunder"]');
    await page1.waitForSelector('#modal-backdrop.open [data-start-rush="1"]');
    // Guarantee rush_thunder branch triggers promptly during the live animation loop
    await page1.evaluate(() => {
      window.__t5OrigRand = Math.random;
      let calls = 0;
      Math.random = () => (++calls <= 12 ? 0.001 : window.__t5OrigRand());
    });
    await page1.click('#modal-backdrop.open [data-start-rush="1"]');
    await page1.waitForTimeout(350);
    const t0 = await page1.evaluate(() => window.__CHENYUAN_V25__.getState().arena.bossRush?.elapsed || 0);
    await page1.waitForTimeout(350);
    const b1State = await page1.evaluate(() => {
      Math.random = window.__t5OrigRand;
      const a = window.__CHENYUAN_V25__.getState().arena;
      return {
        t1: a.bossRush?.elapsed || 0,
        bolts: (a.skyBolts || []).length,
        hasThunder: (a.rushAffixes || []).includes("rush_thunder")
      };
    });
    assert.equal(b1State.hasThunder, true, "B-1: rush_thunder affix must be active");
    assert.ok(b1State.t1 > t0 + 0.1, `B-1: mainLoop must stay alive under rush_thunder (t0=${t0}, t1=${b1State.t1})`);
    await ctx1.close();

    // Part B (B-2): Custom Workshop must NOT mutate formal game.spireCurios and must leak zero wins/starPts/loot/souls
    const { ctx: ctx2, page: page2 } = await startCleanGamePage(browser, "T5-4-B2", true);
    await page2.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "spirit";
      g.bestSpireFloor = 0;
      g.spireCurios = {};
      g.wins = 0;
      g.bonusStarPts = 0;
      g.unlockedSouls = ["blood_warden"];
      api.saveGame();
      api.openCustomWorkshopModal();
    });
    await page2.waitForSelector("#modal-backdrop.open #sel-ws-curio");
    await page2.selectOption("#sel-ws-curio", "16");
    await page2.click("#btn-launch-workshop");
    await page2.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const wsActiveRes = await page2.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const inPractice = api.isPracticeModeActive();
      const effectiveCurio = api.getCurioStacks(s.game, "curio_hongmeng_omni");
      const formalCurioKeys = Object.keys(s.game.spireCurios || {});
      // Kill spawned workshop boss
      const boss = s.arena.enemies.find(e => e.isBoss) || s.arena.enemies[0];
      if (boss) {
        boss.hp = 1;
        api.damageEnemy(boss, 999999, true);
      }
      return { inPractice, effectiveCurio, formalCurioKeys, winsAfterKill: s.game.wins, starPtsAfterKill: s.game.bonusStarPts };
    });
    assert.equal(wsActiveRes.inPractice, true, "B-2: Custom Workshop must activate isPracticeModeActive()");
    assert.equal(wsActiveRes.effectiveCurio, 2, "B-2: Custom Workshop runtime overlay must grant Lv.2 test curio during the run");
    assert.deepEqual(wsActiveRes.formalCurioKeys, [], `B-2: Formal game.spireCurios must remain empty, got: ${JSON.stringify(wsActiveRes.formalCurioKeys)}`);
    assert.equal(wsActiveRes.winsAfterKill, 0, "B-2: Killing workshop boss must NOT increment formal wins");
    assert.equal(wsActiveRes.starPtsAfterKill, 0, "B-2: Killing workshop boss must NOT grant formal bonusStarPts");

    await page2.keyboard.press("KeyH");
    await page2.waitForTimeout(180);
    await page2.reload({ waitUntil: "domcontentloaded" });
    await page2.waitForSelector("#btn-continue-save", { state: "visible" });
    await page2.click("#btn-continue-save");
    await page2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    const wsReloaded = await page2.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      return {
        spireCurios: g.spireCurios,
        effectiveCurioAfterExit: api.getCurioStacks(g, "curio_hongmeng_omni"),
        wins: g.wins,
        bonusStarPts: g.bonusStarPts,
        bestSpireFloor: g.bestSpireFloor,
        unlockedSouls: g.unlockedSouls
      };
    });
    assert.deepEqual(wsReloaded.spireCurios, {}, "B-2: Persisted formal spireCurios must remain empty across reload");
    assert.equal(wsReloaded.effectiveCurioAfterExit, 0, "B-2: Runtime workshop curio overlay must clear after leaving workshop");
    assert.equal(wsReloaded.wins, 0, "B-2: Persisted wins must remain 0");
    assert.equal(wsReloaded.bonusStarPts, 0, "B-2: Persisted bonusStarPts must remain 0");
    assert.equal(wsReloaded.unlockedSouls.length, 1, "B-2: Workshop boss must NOT leak soul unlocks");
    await ctx2.close();

    // Part C (B-3): Practice Mode blocks formal alchemy, batch craft, blood_fury_pill, meditation XP, live tribulation, saveGame & saveMeta
    const { ctx: ctx3, page: page3 } = await startCleanGamePage(browser, "T5-4-B3", true);
    await page3.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "spirit";
      g.xp = 0;
      g.stones = 1200;
      g.elapsedMonths = 12;
      g.atkFlatBonus = 0;
      g.inventory = { herb: 15, core: 6, healing_pill: 0, blood_fury_pill: 2, ascension_seal: 0 };
      g.defeatedStageBosses = { 0: true, 1: true, 2: true, 3: true, 4: true };
      api.saveGame();
      api.saveMeta();
      api.startBossRushGauntlet(7);
    });
    await page3.waitForTimeout(120);
    const b3Probe = await page3.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      const inPractice = api.isPracticeModeActive();
      const qCraftOk = api.executeAlchemyQuickCraft("healing");
      const batchRes = api.executeAlchemyBatchCraft("ascension", 5);
      api.consumeInventoryItem("blood_fury_pill");
      const saveOk = api.saveGame();
      const metaOk = api.saveMeta();
      // Attempt meditation XP & live tribulation
      s.game.xp = s.realmSpec.xpCap;
      api.openTribulationPrepModal();
      const tribModalOpen = Boolean(document.getElementById("modal-backdrop")?.classList.contains("open"));
      api.startLiveTribulation({ confirmed: true, mode: "defiant" });
      const tribStarted = Boolean(s.arena.tribulation);
      // Reset xp to 0 and meditate briefly
      s.game.xp = 0;
      s.arena.player.meditating = true;
      s.arena.player.meditateTick = 0.65;
      return {
        inPractice,
        qCraftOk,
        batchOk: Boolean(batchRes && batchRes.ok),
        saveOk,
        metaOk,
        tribModalOpen,
        tribStarted,
        stones: s.game.stones,
        healingPill: s.game.inventory.healing_pill || 0,
        ascensionSeal: s.game.inventory.ascension_seal || 0,
        bloodFury: s.game.inventory.blood_fury_pill || 0,
        atkFlatBonus: s.game.atkFlatBonus,
        elapsedMonths: s.game.elapsedMonths,
        realm: s.game.realm
      };
    });
    await page3.waitForTimeout(250);
    const xpAfterPracticeMed = await page3.evaluate(() => window.__CHENYUAN_V25__.getState().game.xp);
    assert.equal(b3Probe.inPractice, true, "B-3: Boss Rush Wave 7 must be in Practice Mode");
    assert.equal(b3Probe.qCraftOk, false, "B-3: Quick Craft must be blocked in Practice Mode");
    assert.equal(b3Probe.batchOk, false, "B-3: Batch Craft must be blocked in Practice Mode");
    assert.equal(b3Probe.saveOk, false, "B-3: saveGame() must return false in Practice Mode");
    assert.equal(b3Probe.metaOk, false, "B-3: saveMeta() must return false in Practice Mode");
    assert.equal(b3Probe.tribModalOpen, false, "B-3: openTribulationPrepModal must be blocked in Practice Mode");
    assert.equal(b3Probe.tribStarted, false, "B-3: startLiveTribulation must be blocked in Practice Mode");
    assert.equal(b3Probe.stones, 1200, "B-3: Practice Mode must not deduct formal stones");
    assert.equal(b3Probe.healingPill, 0, "B-3: Practice Mode must not craft formal healing_pill");
    assert.equal(b3Probe.ascensionSeal, 0, "B-3: Practice Mode must not batch-craft formal ascension_seal");
    assert.equal(b3Probe.bloodFury, 2, "B-3: Practice Mode must not consume formal blood_fury_pill");
    assert.equal(b3Probe.atkFlatBonus, 0, "B-3: Practice Mode must not grant 0-aging permanent atkFlatBonus");
    assert.equal(xpAfterPracticeMed, 0, `B-3: Practice Mode meditation must NOT grant formal 0-aging XP, got ${xpAfterPracticeMed}`);

    await page3.keyboard.press("KeyH");
    await page3.waitForTimeout(180);
    const b3Disk = await page3.evaluate(({ sk, mk }) => ({
      save: JSON.parse(localStorage.getItem(sk)),
      meta: JSON.parse(localStorage.getItem(mk) || "{}")
    }), { sk: STORAGE_KEY, mk: META_KEY });
    assert.equal(b3Disk.save.game.realm, "spirit", "B-3: Formal save realm must remain unchanged");
    assert.equal(b3Disk.save.game.elapsedMonths, 12, "B-3: Formal save elapsedMonths must remain 12");
    assert.equal(Number(b3Disk.meta.ascensions) || 0, 0, "B-3: META_KEY ascensions must remain 0");
    await ctx3.close();
  });

  await runSuite("T5-5", "M7b B-4 满酿仙葫限洞府 + B-5 渡劫禁H/舆图逃逸 + B-6 星图0点不静默扣60石 + B-7 2P/天时热键门控与冷却 + B-8 洞府出征闭关老化落盘", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "T5-5", true);

    // Part A (B-4): refill-gourd-now disabled & rejected outside calm Sanctum, works in calm Sanctum
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.seenCutscenes = Object.assign({}, s.game.seenCutscenes, { enter_sect: true });
      api.initArenaStage(1, false);
      if (!s.arena.enemies.some(e => e.hp > 0 && !e.isDummy && !e.isTreasure)) {
        api.spawnSingleEnemy("wolf", 950, 460, 1.0, false);
      }
      s.game.gourd.charges = 0;
      api.updateHud();
    });
    await page.click("#nav-btn-alchemy");
    await page.waitForSelector('#jade-panel.drawer-open [data-action="refill-gourd-now"]');
    const b4Combat = await page.evaluate(() => {
      const btn = document.querySelector('#jade-panel [data-action="refill-gourd-now"]');
      const disabled = Boolean(btn && btn.disabled);
      // Even bypassing disabled via synthetic click must be rejected by handler
      if (btn) {
        btn.disabled = false;
        btn.click();
      }
      return {
        disabled,
        chargesAfter: window.__CHENYUAN_V25__.getState().game.gourd.charges
      };
    });
    assert.equal(b4Combat.disabled, true, "B-4: refill-gourd-now button must be disabled outside calm Sanctum");
    assert.equal(b4Combat.chargesAfter, 0, "B-4: refill-gourd-now handler must reject mid-combat refill");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("jade-panel")?.classList.contains("drawer-open"));

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.enterSanctumHub();
      api.getState().game.gourd.charges = 0;
      api.updateHud();
    });
    await page.click("#nav-btn-alchemy");
    await page.waitForSelector('#jade-panel.drawer-open [data-action="refill-gourd-now"]');
    const b4SanctumDisabled = await page.evaluate(() => Boolean(document.querySelector('#jade-panel [data-action="refill-gourd-now"]')?.disabled));
    assert.equal(b4SanctumDisabled, false, "B-4: refill-gourd-now must be enabled in calm Sanctum");
    await page.click('#jade-panel [data-action="refill-gourd-now"]');
    const b4SanctumCharges = await page.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game.gourd;
      return { charges: g.charges, maxCharges: g.maxCharges };
    });
    assert.equal(b4SanctumCharges.charges, b4SanctumCharges.maxCharges, "B-4: refill-gourd-now in calm Sanctum must refill gourd to maxCharges");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("jade-panel")?.classList.contains("drawer-open"));

    // Part B (B-5): H, #btn-sanctum-hub, and World Map travel blocked during active Live Tribulation
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "qi";
      s.game.xp = api.getState().realmSpec.xpCap;
      s.game.defeatedStageBosses = { 0: true, 1: true };
      api.initArenaStage(1, false);
      api.startLiveTribulation({ confirmed: true, mode: "defiant" });
      s.game.hp = 15;
      api.focusBattlefield();
    });
    assert.equal(await page.evaluate(() => Boolean(window.__CHENYUAN_V25__.getState().arena.tribulation)), true, "B-5 precondition: Live Tribulation must be active");
    await page.keyboard.press("KeyH");
    await page.click("#btn-sanctum-hub");
    await page.keyboard.press("KeyM");
    await page.waitForTimeout(80);
    const b5Res = await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return {
        tribActive: Boolean(s.arena.tribulation),
        sanctumMode: Boolean(s.arena.sanctumMode),
        modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open")),
        hp: s.game.hp
      };
    });
    assert.equal(b5Res.tribActive, true, "B-5: Active Live Tribulation must NOT be cancelled by H / #btn-sanctum-hub / M");
    assert.equal(b5Res.sanctumMode, false, "B-5: Must NOT escape to Sanctum Hub during active Live Tribulation");
    assert.equal(b5Res.modalOpen, false, "B-5: World Map modal must NOT open during active Live Tribulation");
    assert.ok(b5Res.hp <= 20, "B-5: Player must NOT receive free hub full-heal escape during tribulation");
    // Clear tribulation cleanly for next subtests
    await page.evaluate(() => { window.__CHENYUAN_V25__.getState().arena.tribulation = null; });

    // Part C (B-6): Star Chart at 0 available Star Points must NOT silently deduct 60 stones on unlit node click
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "golden";
      g.stones = 200;
      g.litStars = [];
      api.openStarChartModal();
    });
    await page.waitForSelector("#modal-backdrop.open [data-light-star]");
    // Exhaust all free star points cleanly
    for (let i = 0; i < 20; i++) {
      const left = await page.evaluate(() => {
        const txt = document.querySelector("#modal-content")?.textContent || "";
        const m = txt.match(/可用星魂点：\s*(\d+)/);
        return m ? Number(m[1]) : 0;
      });
      if (left <= 0) break;
      await page.click('#modal-content [data-light-star]:not(.lit)');
      await page.waitForTimeout(30);
    }
    const b6Before = await page.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      const tc = document.getElementById("toast-container");
      if (tc) tc.innerHTML = "";
      return { stones: g.stones, litCount: g.litStars.length };
    });
    await page.click('#modal-content [data-light-star]:not(.lit)');
    await page.waitForTimeout(60);
    const b6After = await page.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      return {
        stones: g.stones,
        litCount: g.litStars.length,
        toasts: Array.from(document.querySelectorAll("#toast-container .toast-pill")).map(x => x.textContent || "").join(" | ")
      };
    });
    assert.equal(b6After.stones, b6Before.stones, "B-6: Clicking unlit star node at 0 Star Points must NOT silently deduct 60 stones");
    assert.equal(b6After.litCount, b6Before.litCount, "B-6: Clicking unlit star node at 0 Star Points must NOT light star");
    assert.ok(b6After.toasts.includes("凝炼星魂"), `B-6: Must show explicit guidance toast, got: ${b6After.toasts}`);
    // Explicit buy button still works
    await page.click('#modal-content [data-action="buy-star-point"]');
    await page.waitForTimeout(60);
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones), b6Before.stones - 60, "B-6: Explicit buy-star-point button must deduct 60 stones");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));

    // Part D (B-7): ]/[ /\ blocked in photoMode/paused, 2P Co-Op gated by realm & bonded companions, Righteous dawn shield cooldown
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "mortal";
      s.game.aids = { shen: false, pei: false, lu: false, yan: false };
      s.game.bondTiers = { shen: 0, pei: 0, lu: 0, yan: 0 };
      s.game.karmaScore = 60;
      s.arena.player.shieldHp = 0;
      window.__CHENYUAN_V23__.toggleLocalCoop2P(false);
      window.__CHENYUAN_V23__.setCelestialTimePhase(0, true);
      api.focusBattlefield();
    });
    await page.keyboard.press("KeyP");
    await page.waitForTimeout(80);
    await page.keyboard.press("BracketRight");
    await page.keyboard.press("BracketLeft");
    for (let i = 0; i < 4; i++) await page.keyboard.press("Backslash");
    await page.waitForTimeout(60);
    const b7Photo = await page.evaluate(() => ({
      paused: window.__CHENYUAN_V25__.getState().arena.paused,
      coopActive: window.__CHENYUAN_V23__.getState().coop2P.active,
      shieldHp: window.__CHENYUAN_V25__.getState().arena.player.shieldHp
    }));
    assert.equal(b7Photo.paused, true, "B-7: Photo Mode must pause arena");
    assert.equal(b7Photo.coopActive, false, "B-7: ]/[ must NOT activate 2P Co-Op during Photo Mode / paused");
    assert.equal(b7Photo.shieldHp, 0, "B-7: \\ must NOT grant dawn shield during Photo Mode / paused");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);

    // Unpaused Mortal with 0 bonded companions -> ]/[ still blocked
    await page.keyboard.press("BracketRight");
    await page.keyboard.press("BracketLeft");
    const b7MortalBlocked = await page.evaluate(() => window.__CHENYUAN_V23__.getState().coop2P.active);
    assert.equal(b7MortalBlocked, false, "B-7: Mortal realm with 0 bonded companions must NOT activate 2P Co-Op");

    // Foundation with ONLY shen bonded -> activates shen, [ does NOT summon unbonded pei/lu/yan
    await page.evaluate(() => {
      const g = window.__CHENYUAN_V25__.getState().game;
      g.realm = "foundation";
      g.aids = { shen: true, pei: false, lu: false, yan: false };
      g.bondTiers = { shen: 1, pei: 0, lu: 0, yan: 0 };
      window.__CHENYUAN_V25__.focusBattlefield();
    });
    await page.keyboard.press("BracketRight");
    await page.keyboard.press("BracketLeft");
    const b7Bonded = await page.evaluate(() => ({
      active: window.__CHENYUAN_V23__.getState().coop2P.active,
      partnerId: window.__CHENYUAN_V23__.getState().coop2P.partnerId
    }));
    assert.equal(b7Bonded.active, true, "B-7: Foundation realm with bonded shen must allow 2P Co-Op");
    assert.equal(b7Bonded.partnerId, "shen", `B-7: [ must only cycle among bonded companions, got ${b7Bonded.partnerId}`);

    // Righteous dawn shield spam cooldown via \
    await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      s.game.karmaScore = 60;
      s.arena.player.shieldHp = 0;
      window.__CHENYUAN_V23__.setCelestialTimePhase(3, true); // star_night
      window.__CHENYUAN_V25__.focusBattlefield();
    });
    // 1st transition to dawn -> grants shield
    await page.keyboard.press("Backslash");
    const shield1 = await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.player.shieldHp);
    assert.ok(shield1 > 0, "B-7: First Righteous dawn transition must grant shield");
    // Zero shield and immediately spam 4x \ back to dawn -> must NOT refresh shield (cooldown active)
    await page.evaluate(() => { window.__CHENYUAN_V25__.getState().arena.player.shieldHp = 0; });
    for (let i = 0; i < 4; i++) await page.keyboard.press("Backslash");
    const shield2 = await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.player.shieldHp);
    assert.equal(shield2, 0, `B-7: Spamming \\ within cooldown must NOT refresh Righteous dawn shield (got ${shield2})`);

    // Part E (B-8): initArenaStage flushes meditateAgedDirty to STORAGE_KEY on Hub -> Stage departure
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.elapsedMonths = 10;
      s.game.xp = 0;
      api.enterSanctumHub();
      api.saveGame();
      api.focusBattlefield();
    });
    await page.keyboard.press("KeyB");
    await page.waitForFunction(() => window.__CHENYUAN_V25__.getState().arena.player.meditating === true, null, { timeout: 2500 });
    await page.evaluate(() => {
      window.__CHENYUAN_V25__.getState().arena.player.meditateAgeTick = 3.01;
    });
    await page.waitForFunction(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return s.game.elapsedMonths >= 11 && s.arena.player.meditateAgedDirty === true;
    }, null, { timeout: 2500 });
    // Depart Hub -> Stage 0 via KeyH
    await page.keyboard.press("KeyH");
    await page.waitForFunction(() => window.__CHENYUAN_V25__.getState().arena.sanctumMode === false, null, { timeout: 3000 });
    const b8AfterDepart = await page.evaluate((sk) => {
      const s = window.__CHENYUAN_V25__.getState();
      const disk = JSON.parse(localStorage.getItem(sk));
      return {
        sanctumMode: s.arena.sanctumMode,
        meditating: s.arena.player.meditating,
        dirty: s.arena.player.meditateAgedDirty,
        memMonths: s.game.elapsedMonths,
        diskMonths: disk?.game?.elapsedMonths
      };
    }, STORAGE_KEY);
    assert.equal(b8AfterDepart.sanctumMode, false, "B-8: KeyH from Hub must depart to Stage");
    assert.equal(b8AfterDepart.meditating, false, "B-8: Departure must stop meditation");
    assert.equal(b8AfterDepart.dirty, false, "B-8: Departure must clear meditateAgedDirty");
    assert.equal(b8AfterDepart.diskMonths, b8AfterDepart.memMonths, `B-8: Departure must flush meditateAgedDirty to STORAGE_KEY (mem=${b8AfterDepart.memMonths}, disk=${b8AfterDepart.diskMonths})`);
    await ctx.close();
  });

  await runSuite("T5-6", "M7b R2 Surface A: R2A-1 跨标签删档防复活 + R2A-2 双标签兵解防CRDT回弹刷点 + R2A-3/2C 磁盘对账与焦点 + R2A-4/5 焦点归位 + R2A-6 仙阁叠层 + 2B 练习返回标题清态", async () => {
    // Part A (R2A-1): Cross-tab deletion during Practice Mode, Sandbox Mode, and synchronous saveGame() race must NOT resurrect deleted save
    const ctx1 = await newIsolatedContext(browser);
    const tab1 = await ctx1.newPage();
    attachErrorListeners(tab1, "T5-6-R2A1-T1");
    await tab1.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tab1.evaluate(() => localStorage.clear());
    await tab1.reload({ waitUntil: "domcontentloaded" });
    await tab1.click("#btn-start-new");
    await tab1.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await dismissOpeningScroll(tab1);
    await tab1.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "spirit";
      api.saveGame();
      api.startBossRushGauntlet(7);
    });
    const tab2 = await ctx1.newPage();
    attachErrorListeners(tab2, "T5-6-R2A1-T2");
    await tab2.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await tab2.waitForSelector("#btn-continue-save");
    await tab2.click("#btn-continue-save");
    await tab2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await tab2.click("#btn-open-settings");
    await tab2.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await tab2.click('#modal-backdrop.open [data-sys-tab="controls"]');
    await tab2.waitForSelector('#modal-backdrop.open [data-action="confirm-reset-save"]');
    await tab2.click('#modal-backdrop.open [data-action="confirm-reset-save"]');
    await tab2.waitForSelector('#modal-backdrop.open [data-action="execute-reset-save"]');
    await tab2.click('#modal-backdrop.open [data-action="execute-reset-save"]');
    await tab2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "flex");
    await tab1.waitForFunction((sk) => localStorage.getItem(sk) === null && Boolean(window.__CHENYUAN_V25__.getPersistenceState().saveConflictState?.deleted), STORAGE_KEY, { timeout: 3000 });
    const r2a1Practice = await tab1.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      const ps = api.getPersistenceState();
      const saveOk = api.saveGame();
      return {
        conflictDeleted: Boolean(ps.saveConflictState && ps.saveConflictState.deleted),
        saveOk,
        diskRaw: localStorage.getItem(sk)
      };
    }, STORAGE_KEY);
    assert.equal(r2a1Practice.conflictDeleted, true, "R2A-1 (Practice): Cross-tab deletion must trigger deleted saveConflictState even in Practice Mode");
    assert.equal(r2a1Practice.saveOk, false, "R2A-1 (Practice): saveGame() must refuse resurrecting deleted save");
    assert.equal(r2a1Practice.diskRaw, null, "R2A-1 (Practice): Deleted STORAGE_KEY must remain null on disk");

    // Sandbox Mode cross-tab deletion -> exitSandboxMode surfaces deletion conflict & blocks resurrection
    await tab1.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      api.closeModal();
      api.enterSanctumHub({ skipSave: true });
      api.saveGame({ forceOverwrite: true });
      api.enterSandboxMode();
    });
    await tab2.waitForFunction((sk) => Boolean(localStorage.getItem(sk)), STORAGE_KEY, { timeout: 3000 });
    await tab2.evaluate((sk) => { localStorage.removeItem(sk); }, STORAGE_KEY);
    await tab1.waitForFunction((sk) => localStorage.getItem(sk) === null, STORAGE_KEY, { timeout: 3000 });
    const r2a1Sandbox = await tab1.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      api.exitSandboxMode();
      const ps = api.getPersistenceState();
      const saveOk = api.saveGame();
      return {
        conflictDeleted: Boolean(ps.saveConflictState && ps.saveConflictState.deleted),
        saveOk,
        diskRaw: localStorage.getItem(sk)
      };
    }, STORAGE_KEY);
    assert.equal(r2a1Sandbox.conflictDeleted, true, "R2A-1 (Sandbox): exitSandboxMode must detect cross-tab save deletion");
    assert.equal(r2a1Sandbox.saveOk, false, "R2A-1 (Sandbox): saveGame() after exitSandboxMode must NOT resurrect deleted save");
    assert.equal(r2a1Sandbox.diskRaw, null, "R2A-1 (Sandbox): STORAGE_KEY must stay null");

    // Synchronous delete race in saveGame()
    const r2a1Sync = await tab1.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      api.closeModal();
      api.saveGame({ forceOverwrite: true });
      localStorage.removeItem(sk);
      const saveOk = api.saveGame();
      const ps = api.getPersistenceState();
      return {
        saveOk,
        conflictDeleted: Boolean(ps.saveConflictState && ps.saveConflictState.deleted),
        diskRaw: localStorage.getItem(sk)
      };
    }, STORAGE_KEY);
    assert.equal(r2a1Sync.saveOk, false, "R2A-1 (Sync): saveGame() must return false when loadedSaveRev > 0 and disk is missing");
    assert.equal(r2a1Sync.conflictDeleted, true, "R2A-1 (Sync): saveGame() must trigger deleted conflict state");
    assert.equal(r2a1Sync.diskRaw, null, "R2A-1 (Sync): STORAGE_KEY must remain null");
    await ctx1.close();

    // Part B (R2A-2): 2-tab bingjie executeReincarnation under removeItem SecurityError -> ZERO monotonic +40 CRDT bounce-back farming!
    const ctx2 = await newIsolatedContext(browser);
    const p1 = await ctx2.newPage();
    attachErrorListeners(p1, "T5-6-R2A2-P1");
    await p1.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await p1.evaluate(() => localStorage.clear());
    await p1.reload({ waitUntil: "domcontentloaded" });
    await p1.click("#btn-start-new");
    await p1.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await dismissOpeningScroll(p1);

    const p2 = await ctx2.newPage();
    attachErrorListeners(p2, "T5-6-R2A2-P2");
    await p2.goto(targetUrl, { waitUntil: "domcontentloaded" });
    await p2.waitForSelector("#btn-continue-save");
    await p2.click("#btn-continue-save");
    await p2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await p2.evaluate(() => { window.__CHENYUAN_V25__.saveMeta(); });
    await p1.waitForTimeout(100);

    await p1.evaluate((sk) => {
      window.__r2a2OrigRm = Storage.prototype.removeItem;
      Storage.prototype.removeItem = function (k) {
        if (k === sk) throw new DOMException("Read-only storage", "SecurityError");
        return window.__r2a2OrigRm.call(this, k);
      };
      window.__CHENYUAN_V25__.openLifespanExhaustedModal(true);
    }, STORAGE_KEY);
    for (let i = 0; i < 2; i++) {
      await p1.waitForSelector('#modal-backdrop.open [data-action="confirm-bingjie-reincarnate"]');
      await p1.click('#modal-backdrop.open [data-action="confirm-bingjie-reincarnate"]');
      await p1.waitForTimeout(220);
    }
    const r2a2Res = await p1.evaluate(({ sk, mk }) => {
      Storage.prototype.removeItem = window.__r2a2OrigRm;
      return {
        memPts: Number(window.__CHENYUAN_V25__.getMetaState().reincarnationPoints) || 0,
        diskPts: Number(JSON.parse(localStorage.getItem(mk) || "{}").reincarnationPoints) || 0,
        saveExists: Boolean(localStorage.getItem(sk))
      };
    }, { sk: STORAGE_KEY, mk: META_KEY });
    assert.equal(r2a2Res.memPts, 0, `R2A-2: 2-tab bingjie removeItem SecurityError must NOT farm +40 pts in memory, got ${r2a2Res.memPts}`);
    assert.equal(r2a2Res.diskPts, 0, `R2A-2: 2-tab bingjie removeItem SecurityError must NOT bounce-back +40 pts onto META_KEY, got ${r2a2Res.diskPts}`);
    assert.equal(r2a2Res.saveExists, true, "R2A-2: Primary save must remain intact");
    await ctx2.close();

    // Part C (R2A-3 / DEFECT-R1-2C): Live-disk reconciliation, stale modal closure, and alert-opened A-4 off-BODY focus
    const { ctx: ctx3, page: page3 } = await startCleanGamePage(browser, "T5-6-R2A3", true);
    const r2a3Checks = await page3.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      for (let i = 0; i < 4; i++) api.saveGame();
      const liveEnv = JSON.parse(localStorage.getItem(sk));
      // 1. Stale lower-rev foreign event while live disk is owned by this tab -> ignored!
      const staleEnv = Object.assign({}, liveEnv, { saveRev: Math.max(1, liveEnv.saveRev - 1), tabId: "tab_stale_r2a3" });
      window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: JSON.stringify(staleEnv) }));
      const staleConflict = Boolean(api.getPersistenceState().saveConflictState);

      // 2. Live disk deleted + delayed valid v99 event -> deleted:true (rev 0), NOT bogus v99!
      const futureEnv = Object.assign({}, liveEnv, { saveRev: 99, tabId: "tab_future_r2a3" });
      localStorage.removeItem(sk);
      window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: JSON.stringify(futureEnv) }));
      const delConf = api.getPersistenceState().saveConflictState;

      // 3. Corrupt StorageEvent over open save_conflict modal -> closes save_conflict modal & sets storageReadError
      localStorage.setItem(sk, "{CORRUPT_R2A3_4D");
      window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: "{CORRUPT_R2A3_4D" }));
      const afterCorruptEvt = {
        modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open")),
        hasReadErr: Boolean(api.getPersistenceState().storageReadError),
        hasConflict: Boolean(api.getPersistenceState().saveConflictState)
      };

      // Restore clean save for 4th check (DEFECT-R1-2C / p4e)
      api.saveGame({ forceOverwrite: true });
      const cleanEnv = JSON.parse(localStorage.getItem(sk));
      const foreignEnv = Object.assign({}, cleanEnv, { saveRev: cleanEnv.saveRev + 5, tabId: "tab_foreign_4e" });
      localStorage.setItem(sk, JSON.stringify(foreignEnv));
      window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: JSON.stringify(foreignEnv) }));
      api.closeModal();
      return { staleConflict, delConf, afterCorruptEvt, validDelayedRaw: JSON.stringify(foreignEnv) };
    }, STORAGE_KEY);
    assert.equal(r2a3Checks.staleConflict, false, "R2A-3 (p4c): Stale foreign StorageEvent older than locally-owned disk must be ignored");
    assert.equal(Boolean(r2a3Checks.delConf && r2a3Checks.delConf.deleted === true && r2a3Checks.delConf.externalRev === 0), true, "R2A-3 (p4b): Deleted live disk + delayed v99 event must report deleted:true (rev 0)");
    assert.equal(r2a3Checks.afterCorruptEvt.modalOpen, false, "R2A-3 (p4d): Corrupt StorageEvent must close stale save_conflict modal");
    assert.equal(r2a3Checks.afterCorruptEvt.hasReadErr, true, "R2A-3 (p4d): Corrupt StorageEvent must set storageReadError");
    assert.equal(r2a3Checks.afterCorruptEvt.hasConflict, false, "R2A-3 (p4d): Corrupt StorageEvent must clear saveConflictState");

    // DEFECT-R1-2C / p4e: open save_conflict from #hud-save-alert, corrupt live disk, dispatch delayed valid StorageEvent -> focus MUST stay off BODY
    await page3.waitForSelector('#hud-save-alert [data-action="open-save-conflict"]');
    await page3.focus('#hud-save-alert [data-action="open-save-conflict"]');
    await page3.click('#hud-save-alert [data-action="open-save-conflict"]');
    await page3.waitForSelector('#modal-backdrop.open [data-action="stay-readonly-save"]');
    const p4eFocus = await page3.evaluate(({ sk, raw }) => {
      localStorage.setItem(sk, "{CORRUPT_R2A3_4E");
      window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: raw }));
      return {
        modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open")),
        isBody: document.activeElement === document.body,
        activeTag: document.activeElement?.tagName,
        activeAction: document.activeElement?.getAttribute?.("data-action") || null
      };
    }, { sk: STORAGE_KEY, raw: r2a3Checks.validDelayedRaw });
    assert.equal(p4eFocus.modalOpen, false, "DEFECT-R1-2C: Live disk corruption must close open save_conflict modal");
    assert.equal(p4eFocus.isBody, false, `DEFECT-R1-2C: Closing alert-opened save_conflict on live corruption must NOT drop focus to BODY (got ${p4eFocus.activeTag})`);
    await ctx3.close();

    // Part D (R2A-4, R2A-5, R2A-6, DEFECT-R1-2B): Pavilion-over-drawer layering, fallbackCopy focus, confirm-reset-corrupt-meta focus, Practice return-title-safe cleanup & welcome focus
    const { ctx: ctx4, page: page4 } = await startCleanGamePage(browser, "T5-6-Focus", true);
    // R2A-6: Pavilion popover over open drawer -> Tab stays in popover, 1st Escape closes popover & leaves drawer open
    await page4.click('.nav-tab-btn[data-tab="cultivate"]');
    await page4.waitForSelector("#jade-panel.drawer-open");
    await page4.click("#btn-pavilion-menu");
    await page4.waitForSelector("#pavilion-popover.open");
    await page4.focus("#btn-ascension-roadmap");
    await page4.keyboard.press("Tab");
    const r2a6Tab = await page4.evaluate(() => {
      const pop = document.getElementById("pavilion-popover");
      const panel = document.getElementById("jade-panel");
      return {
        inPopover: Boolean(pop && pop.contains(document.activeElement)),
        inDrawer: Boolean(panel && panel.contains(document.activeElement))
      };
    });
    assert.equal(r2a6Tab.inPopover, true, "R2A-6: Tab inside open #pavilion-popover over drawer must stay inside popover");
    assert.equal(r2a6Tab.inDrawer, false, "R2A-6: Tab must NOT rip focus into underlying #jade-panel");
    await page4.keyboard.press("Escape");
    const r2a6Esc = await page4.evaluate(() => ({
      popOpen: Boolean(document.getElementById("pavilion-popover")?.classList.contains("open")),
      drawerOpen: Boolean(document.getElementById("jade-panel")?.classList.contains("drawer-open")),
      activeId: document.activeElement?.id || ""
    }));
    assert.equal(r2a6Esc.popOpen, false, "R2A-6: 1st Escape must close #pavilion-popover");
    assert.equal(r2a6Esc.drawerOpen, true, "R2A-6: 1st Escape must leave underlying drawer open");
    assert.equal(r2a6Esc.activeId, "btn-pavilion-menu", "R2A-6: Closing #pavilion-popover must return focus to #btn-pavilion-menu");
    await page4.keyboard.press("Escape");
    await page4.waitForFunction(() => !document.getElementById("jade-panel")?.classList.contains("drawer-open"));

    // R2A-5: fallbackCopy + in-game confirm-reset-corrupt-meta keep focus off BODY
    await page4.evaluate((mk) => {
      Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
      localStorage.setItem(mk, "{CORRUPT_META_R2A5");
      window.__CHENYUAN_V25__.saveMeta();
    }, META_KEY);
    await page4.waitForSelector('#hud-save-alert [data-action="copy-corrupt-meta-raw"]');
    await page4.focus('#hud-save-alert [data-action="copy-corrupt-meta-raw"]');
    await page4.click('#hud-save-alert [data-action="copy-corrupt-meta-raw"]');
    const fallbackCopyFocus = await page4.evaluate(() => ({ isBody: document.activeElement === document.body, tag: document.activeElement?.tagName }));
    assert.equal(fallbackCopyFocus.isBody, false, `R2A-5: fallbackCopy must restore focus off BODY (got ${fallbackCopyFocus.tag})`);

    await page4.focus('#hud-save-alert [data-action="prompt-reset-corrupt-meta"]');
    await page4.click('#hud-save-alert [data-action="prompt-reset-corrupt-meta"]');
    await page4.waitForSelector('#modal-backdrop.open [data-action="confirm-reset-corrupt-meta"]');
    await page4.click('#modal-backdrop.open [data-action="confirm-reset-corrupt-meta"]');
    await page4.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const inGameMetaResetFocus = await page4.evaluate(() => ({ isBody: document.activeElement === document.body, tag: document.activeElement?.tagName }));
    assert.equal(inGameMetaResetFocus.isBody, false, `R2A-5: In-game confirm-reset-corrupt-meta must keep focus off BODY (got ${inGameMetaResetFocus.tag})`);

    // DEFECT-R1-2B + R2A-4 + R2A-5 (welcome): Enter Boss Rush Wave 7 Practice Mode, corrupt META_KEY, return-title-safe -> focus inside welcome screen, Enter does NOT open Settings, isPracticeModeActive === false, and welcome confirm-reset-corrupt-meta succeeds with off-BODY focus!
    await page4.evaluate((mk) => {
      const api = window.__CHENYUAN_V25__;
      api.getState().game.realm = "spirit";
      api.startBossRushGauntlet(7);
      localStorage.setItem(mk, "{CORRUPT_META_WELCOME_2B");
    }, META_KEY);
    await page4.focus("#btn-open-settings");
    await page4.click("#btn-open-settings");
    await page4.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await page4.click('#modal-backdrop.open [data-sys-tab="controls"]');
    await page4.waitForSelector('#modal-backdrop.open [data-action="return-title-safe"]');
    await page4.click('#modal-backdrop.open [data-action="return-title-safe"]');
    await page4.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "flex");
    const afterReturnTitle = await page4.evaluate(() => {
      const ws = document.getElementById("welcome-screen");
      const ae = document.activeElement;
      return {
        inWelcome: Boolean(ws && ws.contains(ae)),
        activeId: ae?.id || "",
        isPractice: window.__CHENYUAN_V25__.isPracticeModeActive(),
        hasMetaResetBtn: Boolean(document.querySelector('#save-status-banner [data-action="prompt-reset-corrupt-meta"]'))
      };
    });
    assert.equal(afterReturnTitle.inWelcome, true, `R2A-4: return-title-safe must land focus inside #welcome-screen (got #${afterReturnTitle.activeId})`);
    assert.equal(afterReturnTitle.isPractice, false, "DEFECT-R1-2B: return-title-safe from Practice Mode must clear isPracticeModeActive()");
    assert.equal(afterReturnTitle.hasMetaResetBtn, true, "DEFECT-R1-2B: Welcome screen must display corrupt-meta reset button");

    await page4.focus('#save-status-banner [data-action="prompt-reset-corrupt-meta"]');
    await page4.click('#save-status-banner [data-action="prompt-reset-corrupt-meta"]');
    await page4.waitForSelector('#modal-backdrop.open [data-action="confirm-reset-corrupt-meta"]');
    await page4.click('#modal-backdrop.open [data-action="confirm-reset-corrupt-meta"]');
    await page4.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const afterWelcomeMetaReset = await page4.evaluate((mk) => ({
      metaReadErr: Boolean(window.__CHENYUAN_V25__.getPersistenceState().metaReadError),
      diskRawValid: (() => { try { JSON.parse(localStorage.getItem(mk)); return true; } catch { return false; } })(),
      isBody: document.activeElement === document.body,
      inWelcome: Boolean(document.getElementById("welcome-screen")?.contains(document.activeElement))
    }), META_KEY);
    assert.equal(afterWelcomeMetaReset.metaReadErr, false, "DEFECT-R1-2B: Welcome corrupt-meta reset must clear metaReadError after returning from Practice Mode");
    assert.equal(afterWelcomeMetaReset.diskRawValid, true, "DEFECT-R1-2B: Welcome corrupt-meta reset must write valid META_KEY");
    assert.equal(afterWelcomeMetaReset.isBody, false, "R2A-5: Welcome confirm-reset-corrupt-meta must keep focus off BODY");
    assert.equal(afterWelcomeMetaReset.inWelcome, true, "R2A-5: Welcome confirm-reset-corrupt-meta must keep focus inside #welcome-screen");

    // R2A-4: execute-reset-save also lands focus inside #welcome-screen (never occluded #btn-open-settings)
    await page4.click("#btn-continue-save");
    await page4.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
    await page4.focus("#btn-open-settings");
    await page4.click("#btn-open-settings");
    await page4.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
    await page4.click('#modal-backdrop.open [data-sys-tab="controls"]');
    await page4.waitForSelector('#modal-backdrop.open [data-action="confirm-reset-save"]');
    await page4.click('#modal-backdrop.open [data-action="confirm-reset-save"]');
    await page4.waitForSelector('#modal-backdrop.open [data-action="execute-reset-save"]');
    await page4.click('#modal-backdrop.open [data-action="execute-reset-save"]');
    await page4.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "flex");
    const afterResetFocus = await page4.evaluate(() => ({
      inWelcome: Boolean(document.getElementById("welcome-screen")?.contains(document.activeElement)),
      activeId: document.activeElement?.id || ""
    }));
    assert.equal(afterResetFocus.inWelcome, true, `R2A-4: execute-reset-save must focus inside #welcome-screen (got #${afterResetFocus.activeId})`);
    await ctx4.close();
  });

  await runSuite("T5-7", "M7b R2 Surface B: R2B-1/2A 渡劫全域切换守卫 + R2B-2 练习快照隔离与战败撤回 + R2B-3 战中炼丹/茶叙禁满酿 + R2B-4 沙盒战斗残留清零 + R2B-5 拍照按钮拦截 + R2B-6 直进模式闭关落盘", async () => {
    // Part A (R2B-1 / DEFECT-R1-2A): Active Hardcore Defiant Live Tribulation blocks ALL travel/mode/sandbox launchers
    const { ctx, page } = await startCleanGamePage(browser, "T5-7", true);
    const tribRes = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "spirit";
      s.game.xp = 99999;
      s.game.elapsedMonths = 24;
      s.game.tribulationFails = 0;
      s.game.defeatedStageBosses = { 0: true, 1: true, 2: true, 3: true, 4: true };
      s.game.seenCutscenes = Object.assign({}, s.game.seenCutscenes, { enter_sect: true, enter_secret: true });
      api.initArenaStage(1, false);
      api.startLiveTribulation({ confirmed: true, mode: "defiant" });
      s.game.hp = 16;
      s.game.gourd.charges = 0;

      // Attempt every previously unguarded escape/overlap vector
      api.openBossRushModal();
      api.startBossRushGauntlet(7);
      api.openCelestialSpireModal();
      api.startCelestialSpireRun(9);
      api.openCustomWorkshopModal();
      window.__CHENYUAN_V22__.launchCustomSeedEncounter();
      api.startSectDefenseSiege();
      api.startCloudSeaAerialStage();
      api.enterSandboxMode();
      window.__CHENYUAN_V23__.openTaixuCraftMinigameModal("alchemy");
      const teaBlocked = api.triggerCompanionHubAction("shen", "tea");

      return {
        tribActive: Boolean(s.arena.tribulation),
        sanctumMode: s.arena.sanctumMode,
        towerMode: s.arena.towerMode,
        bossRush: Boolean(s.arena.bossRush && s.arena.bossRush.active),
        spire: Boolean(s.arena.celestialSpire && s.arena.celestialSpire.active),
        custom: Boolean(s.arena.customSeedRun && s.arena.customSeedRun.active),
        cloud: Boolean(s.arena.cloudFlight && s.arena.cloudFlight.active),
        defense: Boolean(s.arena.sectDefense && s.arena.sectDefense.active),
        sandbox: api.isSandboxMode(),
        isPractice: api.isPracticeModeActive(),
        hp: s.game.hp,
        gourd: s.game.gourd.charges,
        teaBlocked
      };
    });
    assert.equal(tribRes.tribActive, true, "R2B-1: Live Tribulation must remain active after all blocked escape/mode launchers");
    assert.equal(tribRes.sanctumMode, false, "R2B-1: Must not escape to Sanctum during Live Tribulation");
    assert.equal(tribRes.towerMode, false, "R2B-1: Must not escape to Tower during Live Tribulation");
    assert.equal(tribRes.bossRush, false, "R2B-1: Must not launch Boss Rush during Live Tribulation");
    assert.equal(tribRes.spire, false, "R2B-1: Must not launch Celestial Spire during Live Tribulation");
    assert.equal(tribRes.custom, false, "R2B-1: Must not launch Custom Workshop during Live Tribulation");
    assert.equal(tribRes.cloud, false, "R2B-1: Must not launch Cloud Sea during Live Tribulation");
    assert.equal(tribRes.defense, false, "R2B-1: Must not launch Sect Defense during Live Tribulation");
    assert.equal(tribRes.sandbox, false, "R2B-1: Must not enter Sandbox Mode during Live Tribulation");
    assert.equal(tribRes.isPractice, false, "DEFECT-R1-2A: Must never carry active tribulation into Practice Mode");
    assert.equal(tribRes.gourd, 0, "R2B-1/R2B-3: Must not refill gourd mid-tribulation");
    assert.equal(tribRes.teaBlocked, false, "R2B-3: Companion tea must be rejected during Live Tribulation");

    // Also test real UI clicks during active Live Tribulation: Explore [data-warp-stage="0"], Pavilion #btn-quick-map, #btn-toggle-arcana-all & Goals [data-route-goal="hub"]
    await page.click("#nav-btn-explore");
    await page.waitForSelector('#jade-panel.drawer-open [data-warp-stage="0"]');
    await page.click('#jade-panel.drawer-open [data-warp-stage="0"]');
    await page.keyboard.press("Escape");
    await page.click("#btn-pavilion-menu");
    await page.waitForSelector("#pavilion-popover.open #btn-quick-map");
    await page.click("#btn-quick-map");
    await page.click("#btn-pavilion-menu");
    await page.waitForSelector("#pavilion-popover.open #btn-toggle-arcana-all");
    await page.click("#btn-toggle-arcana-all");
    await page.click("#btn-goals-modal");
    await page.waitForSelector("#modal-backdrop.open");
    await page.evaluate(() => {
      const btn = document.querySelector('#modal-backdrop.open [data-route-goal="hub"]') || document.querySelector('#modal-backdrop.open [data-route-goal]');
      if (btn) btn.click();
    });
    await page.evaluate(() => { window.__CHENYUAN_V25__.closeModal(); });
    const afterUiEscapes = await page.evaluate(() => ({
      tribActive: Boolean(window.__CHENYUAN_V25__.getState().arena.tribulation),
      towerMode: window.__CHENYUAN_V25__.getState().arena.towerMode,
      stageIdx: window.__CHENYUAN_V25__.getState().arena.stageIdx
    }));
    assert.equal(afterUiEscapes.tribActive, true, "DEFECT-R1-2A: [data-warp-stage] and #btn-quick-map must NOT abort Live Tribulation");
    assert.equal(afterUiEscapes.towerMode, false, "R2B-1: #btn-quick-map must NOT warp to Tower during Live Tribulation");
    assert.equal(afterUiEscapes.stageIdx, 1, "DEFECT-R1-2A: [data-warp-stage=0] must NOT warp out of Stage 1 during Live Tribulation");

    // Part B (R2B-3): Active combat disables [data-craft-open="alchemy"] & [data-comp-act="tea"] and prevents mid-combat gourd refill
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.tribulation = null;
      api.initArenaStage(2, false);
      s.game.hp = 40;
      s.game.mp = 0;
      s.game.gourd.charges = 0;
    });
    await page.click("#nav-btn-alchemy");
    await page.waitForSelector('#jade-panel.drawer-open [data-craft-open="alchemy"]');
    const r2b3Combat = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const v23 = window.__CHENYUAN_V23__;
      const btn = document.querySelector('#jade-panel [data-craft-open="alchemy"]');
      const disabledInCombat = Boolean(btn && btn.disabled);
      v23.openTaixuCraftMinigameModal("alchemy");
      v23.strikeTaixuCraftMinigame(true);
      v23.strikeTaixuCraftMinigame(true);
      v23.strikeTaixuCraftMinigame(true);
      api.closeModal();
      const s = api.getState();
      const hpBeforeTea = s.game.hp;
      const teaOk = api.triggerCompanionHubAction("shen", "tea");
      return {
        disabledInCombat,
        gourdAfterCraft: s.game.gourd.charges,
        hpBeforeTea,
        hpAfterTea: s.game.hp,
        teaOk
      };
    });
    assert.equal(r2b3Combat.disabledInCombat, true, "R2B-3: [data-craft-open=alchemy] must be disabled during active combat");
    assert.equal(r2b3Combat.gourdAfterCraft, 0, "R2B-3: strikeTaixuCraftMinigame must NOT refill gourd outside calm Sanctum");
    assert.equal(r2b3Combat.teaOk, false, "R2B-3: Companion tea must be blocked outside calm Sanctum");
    assert.equal(r2b3Combat.hpAfterTea, r2b3Combat.hpBeforeTea, "R2B-3: Companion tea must NOT full-heal during active combat");

    // Part C (R2B-2): Practice Mode snapshot/restore isolation + full-bag purchase guard + batch enhance guard + defeat retreat-sanctum fix
    const r2b2Before = await page.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      api.closeDrawer();
      api.enterSanctumHub();
      s.game.realm = "spirit";
      s.game.stones = 2500;
      s.game.retreats = 0;
      s.game.inventory.healing_pill = 3;
      s.game.inventory.spirit_pill = 3;
      s.game.equippedGear.weapon.lvl = 0;
      s.game.gearBag = Array.from({ length: api.GEAR_BAG_LIMIT }, () => api.rollGearItem(1, 0, "weapon"));
      api.saveGame();
      const rawBefore = localStorage.getItem(sk);
      api.startBossRushGauntlet(7);
      // Try blocked economy & batch enhance inside Practice Mode
      const batchRes = api.executeGearBatchEnhance("weapon", 3);
      const karmaOk = api.buyKarmaSpecialItem("km_demon_core");
      // Consume combat pill inside Practice Mode, then die and retreat-sanctum
      api.consumeInventoryItem("spirit_pill");
      api.openDefeatDecisionModal(false);
      return {
        rawBefore,
        batchOk: Boolean(batchRes && batchRes.ok),
        karmaOk,
        stonesInPractice: s.game.stones,
        wpnLvlInPractice: s.game.equippedGear.weapon.lvl
      };
    }, STORAGE_KEY);
    assert.equal(r2b2Before.batchOk, false, "R2B-2: executeGearBatchEnhance must be blocked in Practice Mode");
    assert.equal(r2b2Before.karmaOk, false, "R2B-2: buyKarmaSpecialItem must be blocked in Practice Mode");
    assert.equal(r2b2Before.stonesInPractice, 2500, "R2B-2: Stones must not change in Practice Mode");
    assert.equal(r2b2Before.wpnLvlInPractice, 0, "R2B-2: Weapon lvl must not change in Practice Mode");

    await page.waitForSelector('#modal-backdrop.open [data-defeat-act="retreat-sanctum"]');
    await page.click('#modal-backdrop.open [data-defeat-act="retreat-sanctum"]');
    await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
    const r2b2After = await page.evaluate((sk) => {
      const s = window.__CHENYUAN_V25__.getState();
      return {
        retreats: s.game.retreats,
        stones: s.game.stones,
        spiritPill: s.game.inventory.spirit_pill,
        healingPill: s.game.inventory.healing_pill,
        wpnLvl: s.game.equippedGear.weapon.lvl,
        rawAfter: localStorage.getItem(sk)
      };
    }, STORAGE_KEY);
    assert.equal(r2b2After.retreats, 0, "R2B-2: Defeat retreat-sanctum from Practice Mode must NOT increment formal retreats");
    assert.equal(r2b2After.spiritPill, 3, "R2B-2: Practice Mode snapshot restore must restore consumed spirit_pill");
    assert.equal(r2b2After.stones, 2500, "R2B-2: Formal stones must remain intact after Practice Mode retreat");
    assert.equal(r2b2After.rawAfter, r2b2Before.rawBefore, "R2B-2: STORAGE_KEY must remain byte-identical after Practice Mode defeat retreat-sanctum");

    // Part D (R2B-4 & R2B-5): exitSandboxMode resets runtime combat overrides + Photo Mode hides & blocks #btn-coop-2p / #btn-celestial-time
    const r2b4Res = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const v23 = window.__CHENYUAN_V23__;
      const s = api.getState();
      s.game.realm = "mortal";
      s.game.aids = { shen: false, pei: false, lu: false, yan: false };
      s.game.bondTiers = { shen: 0, pei: 0, lu: 0, yan: 0 };
      api.initArenaStage(0, false);
      api.saveGame();
      api.enterSandboxMode();
      v23.toggleLocalCoop2P(true, "pei");
      s.arena.playableCharId = "shen";
      s.arena.swordIntent = 100;
      const inSandboxCoop = v23.getState().coop2P.active;
      api.exitSandboxMode();
      return {
        inSandboxCoop,
        coopAfter: v23.getState().coop2P.active,
        playableAfter: api.getState().arena.playableCharId,
        swordIntentAfter: api.getState().arena.swordIntent
      };
    });
    assert.equal(r2b4Res.inSandboxCoop, true, "R2B-4 precondition: 2P Co-Op active in Sandbox");
    assert.equal(r2b4Res.coopAfter, false, "R2B-4: exitSandboxMode must reset arena.coop2P.active to false");
    assert.equal(r2b4Res.playableAfter, "player", "R2B-4: exitSandboxMode must reset arena.playableCharId to player");
    assert.equal(r2b4Res.swordIntentAfter, 0, "R2B-4: exitSandboxMode must reset arena.swordIntent to 0");

    // R2B-5: Photo Mode hides #arcana-vault-wrap & #tag-team-hud-pill and blocks #btn-coop-2p / #btn-celestial-time clicks
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "golden";
      s.game.aids = { shen: true, pei: true, lu: true, yan: true };
      s.game.bondTiers = { shen: 2, pei: 2, lu: 2, yan: 2 };
      s.game.karmaScore = 60;
      s.arena.player.shieldHp = 0;
      window.__CHENYUAN_V23__.setCelestialTimePhase(0, true);
      api.focusBattlefield();
    });
    await page.keyboard.press("KeyP");
    await page.waitForTimeout(80);
    const r2b5Photo = await page.evaluate(() => {
      const vault = document.getElementById("arcana-vault-wrap");
      const tagPill = document.getElementById("tag-team-hud-pill");
      const vaultPe = vault ? getComputedStyle(vault).pointerEvents : "";
      const tagPe = tagPill ? getComputedStyle(tagPill).pointerEvents : "";
      document.getElementById("btn-coop-2p")?.click();
      for (let i = 0; i < 4; i++) document.getElementById("btn-celestial-time")?.click();
      return {
        vaultPe,
        tagPe,
        coopActive: window.__CHENYUAN_V23__.getState().coop2P.active,
        shieldHp: window.__CHENYUAN_V25__.getState().arena.player.shieldHp
      };
    });
    assert.equal(r2b5Photo.vaultPe, "none", "R2B-5: #arcana-vault-wrap must have pointer-events: none in Photo Mode");
    assert.equal(r2b5Photo.tagPe, "none", "R2B-5: #tag-team-hud-pill must have pointer-events: none in Photo Mode");
    assert.equal(r2b5Photo.coopActive, false, "R2B-5: Clicking #btn-coop-2p in Photo Mode must NOT activate 2P Co-Op");
    assert.equal(r2b5Photo.shieldHp, 0, "R2B-5: Clicking #btn-celestial-time in Photo Mode must NOT grant dawn shield");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);

    // Part E (R2B-6): Direct transition from Sanctum meditation into Boss Rush Wave 7 flushes meditation aging BEFORE entering practice
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "spirit";
      s.game.xp = 0;
      s.game.elapsedMonths = 11;
      api.enterSanctumHub();
      api.saveGame();
      api.focusBattlefield();
    });
    await page.keyboard.press("KeyB");
    await page.waitForFunction(() => window.__CHENYUAN_V25__.getState().arena.player.meditating === true);
    await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      s.arena.player.meditateAgeTick = 2.95;
    });
    await page.waitForFunction(() => {
      const s = window.__CHENYUAN_V25__.getState();
      return s.game.elapsedMonths >= 12 && s.arena.player.meditateAgedDirty === true;
    }, null, { timeout: 2500 });
    const r2b6After = await page.evaluate((sk) => {
      const api = window.__CHENYUAN_V25__;
      api.startBossRushGauntlet(7);
      const s = api.getState();
      const disk = JSON.parse(localStorage.getItem(sk));
      return {
        isPractice: api.isPracticeModeActive(),
        meditating: s.arena.player.meditating,
        dirty: s.arena.player.meditateAgedDirty,
        diskMonths: disk?.game?.elapsedMonths
      };
    }, STORAGE_KEY);
    assert.equal(r2b6After.isPractice, true, "R2B-6: Must enter Boss Rush Wave 7 Practice Mode");
    assert.equal(r2b6After.meditating, false, "R2B-6: Direct entry to Boss Rush must stop meditation");
    assert.equal(r2b6After.dirty, false, "R2B-6: Direct entry to Boss Rush must clear meditateAgedDirty");
    assert.ok(r2b6After.diskMonths >= 12, `R2B-6: Pre-practice meditation aging must flush to STORAGE_KEY (diskMonths=${r2b6After.diskMonths})`);
    await ctx.close();
  });

  await runSuite("T5-8", "M7b R3A-1..R3A-5 + PR#26 演武冲突强制覆盖恢复、仙阁浮层焦点隔离、高版本过期StorageEvent、沙盒旧档覆写检测与道场栏Escape焦点", async () => {
    // Part A (R3A-1): overwrite-with-current-save inside Practice Mode save_conflict recovers cleanly for BOTH Case A (foreign v3) and Case B (cross-tab delete) without persisting practice consumption
    const ctxA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const p1 = await ctxA.newPage();
      attachErrorListeners(p1, "T5-8A-tab1");
      await p1.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await p1.evaluate(() => localStorage.clear());
      await p1.reload({ waitUntil: "domcontentloaded" });
      await p1.waitForSelector("#btn-start-new", { state: "visible" });
      await p1.click("#btn-toggle-origin");
      await p1.waitForSelector("#player-name-input", { state: "visible" });
      await p1.fill("#player-name-input", "演武冲突");
      await p1.click("#btn-start-new");
      await p1.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await dismissOpeningScroll(p1);
      await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "nascent";
        s.game.stones = 2500;
        s.game.inventory.spirit_pill = 3;
        api.enterSanctumHub();
        api.saveGame();
        api.startBossRushGauntlet(6);
        // Mutate state in Practice Mode: consume 1 spirit_pill (3 -> 2)
        s.game.inventory.spirit_pill = 2;
      });

      const p2 = await ctxA.newPage();
      attachErrorListeners(p2, "T5-8A-tab2");
      await p2.goto(targetUrl, { waitUntil: "domcontentloaded" });
      await p2.waitForSelector("#btn-continue-save", { state: "visible" });
      await p2.click("#btn-continue-save");
      await p2.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      // Case A: Tab 2 updates stones & saves foreign rev
      const tab2Rev = await p2.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.stones = 9999;
        api.saveGame();
        return api.getPersistenceState().loadedSaveRev;
      });
      await p1.waitForFunction(() => window.__CHENYUAN_V25__.getActiveModalKind() === "save_conflict", null, { timeout: 3000 });
      await p1.evaluate(() => { const tc = document.getElementById("toast-container"); if (tc) tc.innerHTML = ""; });
      await p1.click('[data-action="overwrite-with-current-save"]');
      await p1.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"), null, { timeout: 3000 });
      const caseARes = await p1.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const disk = JSON.parse(localStorage.getItem(sk) || "null");
        const toasts = Array.from(document.querySelectorAll("#toast-container .toast-pill")).map(el => el.textContent.trim());
        return {
          modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
          isPractice: api.isPracticeModeActive(),
          conflict: api.getPersistenceState().saveConflictState,
          diskRev: disk?.saveRev || 0,
          diskStones: disk?.game?.stones,
          diskSpiritPill: disk?.game?.inventory?.spirit_pill,
          activeTag: document.activeElement?.tagName,
          toasts
        };
      }, STORAGE_KEY);
      assert.equal(caseARes.modalOpen, false, "R3A-1 Case A: save_conflict modal must close after forced overwrite in Practice Mode");
      assert.equal(caseARes.isPractice, false, "R3A-1 Case A: Practice Mode must cleanly exit before overwrite");
      assert.equal(caseARes.conflict, null, "R3A-1 Case A: saveConflictState must clear");
      assert.ok(caseARes.diskRev > tab2Rev, `R3A-1 Case A: diskRev (${caseARes.diskRev}) must advance beyond Tab 2 rev (${tab2Rev})`);
      assert.equal(caseARes.diskStones, 2500, "R3A-1 Case A: Formal snapshot stones (2500) must be saved");
      assert.equal(caseARes.diskSpiritPill, 3, "R3A-1 Case A: Pristine formal spirit_pill (3) must be saved, NOT practice-mutated 2");
      assert.notEqual(caseARes.activeTag, "BODY", "R3A-1 Case A: Focus must remain off BODY");
      assert.ok(caseARes.toasts.some(t => t.includes("强制覆盖存档")), `R3A-1 Case A: Clear toast feedback must be emitted (got: ${JSON.stringify(caseARes.toasts)})`);

      // Case B: Re-enter Practice Mode, consume pill, Tab 2 deletes STORAGE_KEY -> Tab 1 overwrites cleanly
      await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.startBossRushGauntlet(6);
        api.getState().game.inventory.spirit_pill = 1;
      });
      await p2.reload({ waitUntil: "domcontentloaded" });
      await p2.waitForSelector("#btn-continue-save", { state: "visible" });
      await p2.click("#btn-continue-save");
      await p2.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await p2.click("#btn-open-settings");
      await p2.click('[data-sys-tab="controls"]');
      await p2.click('[data-action="confirm-reset-save"]');
      await p2.click('[data-action="execute-reset-save"]');
      await p1.waitForFunction(() => {
        const ps = window.__CHENYUAN_V25__.getPersistenceState();
        return ps.saveConflictState && ps.saveConflictState.deleted === true && window.__CHENYUAN_V25__.getActiveModalKind() === "save_conflict";
      }, null, { timeout: 3000 });
      await p1.evaluate(() => { const tc = document.getElementById("toast-container"); if (tc) tc.innerHTML = ""; });
      await p1.click('[data-action="overwrite-with-current-save"]');
      await p1.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"), null, { timeout: 3000 });
      const caseBRes = await p1.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const disk = JSON.parse(localStorage.getItem(sk) || "null");
        const toasts = Array.from(document.querySelectorAll("#toast-container .toast-pill")).map(el => el.textContent.trim());
        return {
          modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
          isPractice: api.isPracticeModeActive(),
          diskExists: Boolean(disk && disk.game),
          diskSpiritPill: disk?.game?.inventory?.spirit_pill,
          activeTag: document.activeElement?.tagName,
          toasts
        };
      }, STORAGE_KEY);
      assert.equal(caseBRes.modalOpen, false, "R3A-1 Case B: save_conflict modal must close after cross-tab delete overwrite");
      assert.equal(caseBRes.isPractice, false, "R3A-1 Case B: Practice Mode must exit");
      assert.equal(caseBRes.diskExists, true, "R3A-1 Case B: STORAGE_KEY must be cleanly recreated");
      assert.equal(caseBRes.diskSpiritPill, 3, "R3A-1 Case B: Recreated save must hold pristine spirit_pill (3), NOT practice-mutated 1");
      assert.notEqual(caseBRes.activeTag, "BODY", "R3A-1 Case B: Focus must stay off BODY");
      assert.ok(caseBRes.toasts.some(t => t.includes("强制覆盖存档")), `R3A-1 Case B: Toast feedback must be emitted (got: ${JSON.stringify(caseBRes.toasts)})`);

      // Part C (R3A-3): Delayed foreign StorageEvent with higher saveRev over locally-owned lower-rev disk save must be ignored
      await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        for (let i = 0; i < 4; i++) {
          api.getState().game.stones += 10;
          api.saveGame();
        }
      });
      await p2.reload({ waitUntil: "domcontentloaded" });
      await p2.waitForSelector("#btn-continue-save", { state: "visible" });
      await p2.click("#btn-continue-save");
      await p2.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      const tab2HighRaw = await p2.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.stones += 55;
        api.saveGame();
        return localStorage.getItem(sk);
      }, STORAGE_KEY);
      await p2.click("#btn-open-settings");
      await p2.click('[data-sys-tab="controls"]');
      await p2.click('[data-action="confirm-reset-save"]');
      await p2.click('[data-action="execute-reset-save"]');
      await p2.close();
      await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.closeModal();
      });
      await p1.click("#btn-open-settings");
      await p1.click('[data-sys-tab="controls"]');
      await p1.click('[data-action="return-title-safe"]');
      await p1.waitForSelector("#btn-start-new", { state: "visible" });
      if (!(await p1.isVisible("#player-name-input"))) {
        await p1.click("#btn-toggle-origin");
        await p1.waitForSelector("#player-name-input", { state: "visible" });
      }
      await p1.fill("#player-name-input", "新世初卷");
      await p1.click("#btn-start-new");
      await p1.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await dismissOpeningScroll(p1);
      const r3a3Res = await p1.evaluate(({ sk, raw }) => {
        const api = window.__CHENYUAN_V25__;
        const liveBefore = JSON.parse(localStorage.getItem(sk));
        const ev = new StorageEvent("storage", { key: sk, newValue: raw, oldValue: null, storageArea: localStorage });
        window.dispatchEvent(ev);
        return {
          liveRev: liveBefore.saveRev,
          foreignRev: JSON.parse(raw).saveRev,
          conflict: api.getPersistenceState().saveConflictState,
          modalOpen: document.getElementById("modal-backdrop").classList.contains("open")
        };
      }, { sk: STORAGE_KEY, raw: tab2HighRaw });
      assert.ok(r3a3Res.foreignRev > r3a3Res.liveRev, `R3A-3 precondition: foreign rev (${r3a3Res.foreignRev}) > live local rev (${r3a3Res.liveRev})`);
      assert.equal(r3a3Res.conflict, null, "R3A-3: Delayed higher-rev foreign StorageEvent must NOT trigger saveConflictState over locally owned disk save");
      assert.equal(r3a3Res.modalOpen, false, "R3A-3: Delayed higher-rev foreign StorageEvent must NOT open save_conflict modal");
    } finally {
      await ctxA.close();
    }

    // Parts B, D, E (R3A-2, R3A-4 + PR #26 vol1PedestalMeta, R3A-5)
    const { ctx, page } = await startCleanGamePage(browser, "T5-8B", true);
    try {
      // Part B (R3A-2): #pavilion-popover dismissed on openModal / return-title-safe; Tab stays inside #welcome-screen; welcome-screen modals STILL focusable
      await page.click("#btn-pavilion-menu");
      await page.waitForFunction(() => document.getElementById("pavilion-popover").classList.contains("open"));
      await page.click("#btn-open-settings");
      await page.waitForFunction(() => document.getElementById("modal-backdrop").classList.contains("open"));
      const popAfterModal = await page.evaluate(() => ({
        popOpen: document.getElementById("pavilion-popover").classList.contains("open"),
        btnOpen: document.getElementById("btn-pavilion-menu").classList.contains("open")
      }));
      assert.equal(popAfterModal.popOpen, false, "R3A-2: openModal() must dismiss #pavilion-popover");
      assert.equal(popAfterModal.btnOpen, false, "R3A-2: openModal() must remove .open from #btn-pavilion-menu");
      // Force-open popover behind modal to also verify return-title-safe & welcome occlusion guard
      await page.evaluate(() => document.getElementById("pavilion-popover").classList.add("open"));
      await page.click('[data-sys-tab="controls"]');
      await page.click('[data-action="return-title-safe"]');
      await page.waitForSelector("#welcome-screen", { state: "visible" });
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      const r3a2Welcome = await page.evaluate(() => {
        const ws = document.getElementById("welcome-screen");
        const pop = document.getElementById("pavilion-popover");
        return {
          popOpen: pop.classList.contains("open"),
          inWelcome: ws.contains(document.activeElement),
          inPopover: pop.contains(document.activeElement),
          activeId: document.activeElement?.id || ""
        };
      });
      assert.equal(r3a2Welcome.popOpen, false, "R3A-2: return-title-safe must dismiss #pavilion-popover");
      assert.equal(r3a2Welcome.inWelcome, true, `R3A-2: Tab on #welcome-screen must keep focus inside #welcome-screen (got id=${r3a2Welcome.activeId})`);
      assert.equal(r3a2Welcome.inPopover, false, "R3A-2: Focus must never escape into occluded #pavilion-popover");

      // Verify modal opened OVER #welcome-screen (corrupt save confirmation) still focuses a button inside #modal-content
      await page.evaluate((sk) => { localStorage.setItem(sk, "{CORRUPT_JSON"); }, STORAGE_KEY);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#save-status-banner", { state: "visible" });
      await page.click("#btn-start-new");
      await page.waitForFunction(() => document.getElementById("modal-backdrop").classList.contains("open"));
      const welcomeModalFocus = await page.evaluate(() => {
        const mc = document.getElementById("modal-content");
        return {
          inModal: mc.contains(document.activeElement),
          activeTag: document.activeElement?.tagName
        };
      });
      assert.equal(welcomeModalFocus.inModal, true, "R3A-2: Modals opened over #welcome-screen must still focus elements inside #modal-content");
      assert.equal(welcomeModalFocus.activeTag, "BUTTON", "R3A-2: Welcome-screen modal must focus a real button");

      // Start fresh session for Parts D & E
      await page.click('[data-action="confirm-overwrite-corrupt-new"]');
      await page.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await dismissOpeningScroll(page);

      // Part D (R3A-4 + PR #26 vol1PedestalMeta sandbox-exit guard): Legacy/no-tabId overwrite during Sandbox Mode triggers conflict & does NOT fire premature payoff save
      const r3a4Res = await page.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.name = "沙盒验真";
        s.game.openingChoice = "help";
        s.game.vol1PedestalMeta = { choice: "help", payoffShown: false };
        api.saveGame();
        api.enterSandboxMode();
        const legacyRaw = JSON.stringify({
          game: Object.assign(api.createFreshGame("旧版外来档", "sword_bone"), { stones: 777 }),
          stageIdx: 0, stanceIdx: 0, towerMode: false, sanctumMode: false
        });
        localStorage.setItem(sk, legacyRaw);
        api.exitSandboxMode();
        return {
          nameAfter: api.getState().game.name,
          payoffShownAfter: api.getState().game.vol1PedestalMeta?.payoffShown,
          conflict: api.getPersistenceState().saveConflictState,
          modalKind: api.getActiveModalKind(),
          diskName: JSON.parse(localStorage.getItem(sk))?.game?.name
        };
      }, STORAGE_KEY);
      assert.equal(r3a4Res.nameAfter, "沙盒验真", "R3A-4: exitSandboxMode must restore preSandboxSnapshot instead of silently replacing with legacy overwrite");
      assert.equal(r3a4Res.payoffShownAfter, false, "PR #26 guard: exitSandboxMode initArenaStage({ skipSave: true }) must NOT mutate vol1PedestalMeta.payoffShown before conflict resolution");
      assert.ok(r3a4Res.conflict, "R3A-4: Legacy/no-tabId overwrite during Sandbox must surface saveConflictState");
      assert.equal(r3a4Res.modalKind, "save_conflict", "R3A-4: save_conflict modal must open on legacy overwrite");
      assert.equal(r3a4Res.diskName, "旧版外来档", "PR #26 guard: Foreign disk save must NOT be prematurely overwritten by initArenaStage");

      // Resolve conflict by forcing our save so Part E runs cleanly in Sanctum
      await page.click('[data-action="overwrite-with-current-save"]');
      await page.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));

      // Part E (R3A-5): Sanctum Dojo .dojo-drawer-panel Escape dismissal & focus return on mode/act selection
      await page.evaluate(() => window.__CHENYUAN_V25__.enterSanctumHub());
      await page.waitForSelector("#btn-toggle-dojo-bar", { state: "visible" });
      await page.focus("#btn-toggle-dojo-bar");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.getElementById("dojo-control-bar").classList.contains("expanded"));
      await page.keyboard.press("Escape");
      const escRes = await page.evaluate(() => ({
        expanded: document.getElementById("dojo-control-bar").classList.contains("expanded"),
        activeId: document.activeElement?.id || "",
        activeTag: document.activeElement?.tagName
      }));
      assert.equal(escRes.expanded, false, "R3A-5: Escape must collapse #dojo-control-bar.expanded");
      assert.equal(escRes.activeId, "btn-toggle-dojo-bar", `R3A-5: Escape must return focus to #btn-toggle-dojo-bar (got ${escRes.activeId}/${escRes.activeTag})`);

      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.getElementById("dojo-control-bar").classList.contains("expanded"));
      await page.focus('[data-dojo-mode="drill_mark_detonate"]');
      await page.keyboard.press("Enter");
      const modeFocusRes = await page.evaluate(() => ({
        expanded: document.getElementById("dojo-control-bar").classList.contains("expanded"),
        activeId: document.activeElement?.id || "",
        activeTag: document.activeElement?.tagName
      }));
      assert.equal(modeFocusRes.expanded, false, "R3A-5: Selecting drill mode must collapse Dojo bar");
      assert.equal(modeFocusRes.activeId, "btn-toggle-dojo-bar", `R3A-5: Selecting drill mode must restore focus to #btn-toggle-dojo-bar (got ${modeFocusRes.activeId}/${modeFocusRes.activeTag})`);

      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.getElementById("dojo-control-bar").classList.contains("expanded"));
      await page.focus('[data-dojo-act="reset-training"]');
      await page.keyboard.press("Enter");
      const actFocusRes = await page.evaluate(() => ({
        expanded: document.getElementById("dojo-control-bar").classList.contains("expanded"),
        activeId: document.activeElement?.id || "",
        activeTag: document.activeElement?.tagName
      }));
      assert.equal(actFocusRes.expanded, false, "R3A-5: Activating reset-training must collapse Dojo bar");
      assert.equal(actFocusRes.activeId, "btn-toggle-dojo-bar", `R3A-5: Activating non-modal Dojo action must restore focus to #btn-toggle-dojo-bar (got ${actFocusRes.activeId}/${actFocusRes.activeTag})`);
    } finally {
      await ctx.close();
    }
  });

  await runSuite("T5-9", "M7b DEFECT-R2-2A/2B/2C + R3B-1..R3B-5 演武通关隔离与跨页元存档、三清/仙葫残留清零、渡劫全路径封禁、洞府剑意与演武阵眼清场", async () => {
    const { ctx, page } = await startCleanGamePage(browser, "T5-9", true);
    try {
      // Part A (DEFECT-R2-2A + DEFECT-R2-2C): Boss Rush Wave 7 & Spire Floor 9 Practice Victory isolate formal state, retain cross-tab META_KEY, and block Cloud Import in Practice Mode
      const partABossRush = await page.evaluate(({ sk, mk }) => {
        const api = window.__CHENYUAN_V25__;
        const v24 = window.__CHENYUAN_V24__;
        const s = api.getState();
        s.game.realm = "nascent";
        s.game.stones = 2500;
        s.game.bonusStarPts = 0;
        s.game.inventory.spirit_pill = 3;
        api.enterSanctumHub();
        api.saveGame();
        const cloudCode = api.exportFullCloudSaveCode();

        // Enter Boss Rush Wave 7 Practice, consume pill, try Cloud Import, simulate cross-tab META_KEY write
        api.startBossRushGauntlet(7);
        s.game.inventory.spirit_pill = 2;
        const cloudBlockedInPractice = v24.importFullCloudSaveCode(cloudCode);
        const curMeta = JSON.parse(localStorage.getItem(mk) || "{}");
        curMeta.reincarnationPoints = Math.max(40, (curMeta.reincarnationPoints || 0) + 40);
        localStorage.setItem(mk, JSON.stringify(curMeta));

        // Trigger Practice Victory
        api.openBossRushVictoryModal();
        const afterVictory = {
          isPractice: api.isPracticeModeActive(),
          memSpiritPill: api.getState().game.inventory.spirit_pill,
          memMetaPts: api.getMetaState().reincarnationPoints
        };
        api.closeModal();
        window.dispatchEvent(new Event("pagehide"));
        const diskAfterPagehide = JSON.parse(localStorage.getItem(sk));

        // Perform genuine formal progression after closing victory modal, then press KeyH (enterSanctumHub) -> must NOT rewind!
        api.getState().game.stones = 2440;
        api.getState().game.bonusStarPts = 1;
        api.saveGame();
        api.enterSanctumHub();
        const diskAfterHub = JSON.parse(localStorage.getItem(sk));
        return {
          cloudBlockedInPractice,
          afterVictory,
          diskSpiritPillAfterPagehide: diskAfterPagehide?.game?.inventory?.spirit_pill,
          memStonesAfterHub: api.getState().game.stones,
          memStarPtsAfterHub: api.getState().game.bonusStarPts,
          diskStonesAfterHub: diskAfterHub?.game?.stones,
          diskStarPtsAfterHub: diskAfterHub?.game?.bonusStarPts
        };
      }, { sk: STORAGE_KEY, mk: META_KEY });
      assert.equal(partABossRush.cloudBlockedInPractice, false, "DEFECT-R2-2A: Cloud import must be blocked in Practice Mode");
      assert.equal(partABossRush.afterVictory.isPractice, false, "DEFECT-R2-2A: Practice mode inactive on victory");
      assert.equal(partABossRush.afterVictory.memSpiritPill, 3, "DEFECT-R2-2A: openBossRushVictoryModal must restore formal spirit_pill (3)");
      assert.ok(partABossRush.afterVictory.memMetaPts >= 40, `DEFECT-R2-2C: endPracticeModeIsolation must retain cross-tab META_KEY points (got ${partABossRush.afterVictory.memMetaPts})`);
      assert.equal(partABossRush.diskSpiritPillAfterPagehide, 3, "DEFECT-R2-2A: pagehide after victory close must NOT persist practice pill consumption");
      assert.equal(partABossRush.memStonesAfterHub, 2440, "DEFECT-R2-2A: Subsequent formal stones must NOT be rewound on enterSanctumHub");
      assert.equal(partABossRush.memStarPtsAfterHub, 1, "DEFECT-R2-2A: Subsequent formal bonusStarPts must NOT be rewound on enterSanctumHub");
      assert.equal(partABossRush.diskStonesAfterHub, 2440, "DEFECT-R2-2A: Disk stones must NOT be rewound on enterSanctumHub");
      assert.equal(partABossRush.diskStarPtsAfterHub, 1, "DEFECT-R2-2A: Disk bonusStarPts must NOT be rewound on enterSanctumHub");

      // Spire Floor 9 Practice Victory isolation
      const partASpire = await page.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const v21 = window.__CHENYUAN_V21__;
        api.startCelestialSpireRun(9);
        api.getState().game.inventory.spirit_pill = 1;
        v21.openSpireCurioDraftModal(); // routes to completeSpirePracticeFloor(floor=9)
        const memSpiritPill = api.getState().game.inventory.spirit_pill;
        api.closeModal();
        window.dispatchEvent(new Event("pagehide"));
        return {
          isPractice: api.isPracticeModeActive(),
          memSpiritPill,
          diskSpiritPill: JSON.parse(localStorage.getItem(sk))?.game?.inventory?.spirit_pill
        };
      }, STORAGE_KEY);
      assert.equal(partASpire.isPractice, false, "DEFECT-R2-2A Spire: Practice mode inactive on Spire 9 victory");
      assert.equal(partASpire.memSpiritPill, 3, "DEFECT-R2-2A Spire: completeSpirePracticeFloor must restore formal spirit_pill (3)");
      assert.equal(partASpire.diskSpiritPill, 3, "DEFECT-R2-2A Spire: pagehide after Spire 9 victory must preserve disk spirit_pill (3)");

      // Part B (R3B-1): exitSandboxMode clears arena.sanqingState, sanqingEchoQueue, and Gourd soak combat buff timers
      const partBRes = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const v24 = window.__CHENYUAN_V24__;
        const s = api.getState();
        s.game.realm = "mortal";
        s.game.gourd.soaks = ["iron_lotus", "samadhi_fire", "wind_feather", "crimson_vine"];
        api.initArenaStage(0, false);
        api.saveGame();
        api.enterSandboxMode();
        const sIn = api.getState();
        sIn.game.mp = 999;
        sIn.game.hp = 10;
        sIn.game.gourd.charges = 5;
        sIn.game.gourd.soaks = ["iron_lotus", "samadhi_fire", "wind_feather", "crimson_vine"];
        v24.triggerSanqingTriClones();
        api.useQuickHealingPill();
        const beforeExit = {
          sanqingActive: v24.getState().sanqing.active,
          hyperArmor: sIn.arena.player.hyperArmorTimer,
          samadhi: sIn.arena.player.samadhiFireReady,
          haste: sIn.arena.player.gourdHasteTimer,
          crit: sIn.arena.player.gourdCritTimer
        };
        api.exitSandboxMode();
        const sOut = api.getState();
        return {
          beforeExit,
          afterExit: {
            sanqingActive: v24.getState().sanqing.active,
            sanqingLife: v24.getState().sanqing.life,
            echoQueueLen: v24.getState().echoQueueLen,
            hyperArmor: sOut.arena.player.hyperArmorTimer,
            samadhi: sOut.arena.player.samadhiFireReady,
            haste: sOut.arena.player.gourdHasteTimer,
            crit: sOut.arena.player.gourdCritTimer,
            petBuff: sOut.arena.player.petBuffTimer,
            boonOverload: sOut.arena.player.boonOverloadTimer
          }
        };
      });
      assert.equal(partBRes.beforeExit.sanqingActive, true, "R3B-1 precondition: Tri-Clones active in Sandbox");
      assert.ok(partBRes.beforeExit.hyperArmor > 0 && partBRes.beforeExit.samadhi === true, "R3B-1 precondition: Sandbox Gourd soak buffs active");
      assert.equal(partBRes.afterExit.sanqingActive, false, "R3B-1: exitSandboxMode must deactivate arena.sanqingState");
      assert.equal(partBRes.afterExit.sanqingLife, 0, "R3B-1: exitSandboxMode must zero sanqingState.life");
      assert.equal(partBRes.afterExit.echoQueueLen, 0, "R3B-1: exitSandboxMode must empty sanqingEchoQueue");
      assert.equal(partBRes.afterExit.hyperArmor, 0, "R3B-1: exitSandboxMode must zero hyperArmorTimer");
      assert.equal(partBRes.afterExit.samadhi, false, "R3B-1: exitSandboxMode must clear samadhiFireReady");
      assert.equal(partBRes.afterExit.haste, 0, "R3B-1: exitSandboxMode must zero gourdHasteTimer");
      assert.equal(partBRes.afterExit.crit, 0, "R3B-1: exitSandboxMode must zero gourdCritTimer");
      assert.equal(partBRes.afterExit.petBuff, 0, "R3B-1: exitSandboxMode must zero petBuffTimer");
      assert.equal(partBRes.afterExit.boonOverload, 0, "R3B-1: exitSandboxMode must zero boonOverloadTimer");

      // Part C (R3B-2 + DEFECT-R2-2B + R3B-4 Tribulation): startLiveTribulation cleans Sanctum Dojo & swordIntent; sanctum_portal / Digit9 dungeon map / immortal_spring / cloud import all blocked during Live Tribulation
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "nascent";
        s.game.xp = api.REALMS.nascent.xpCap;
        s.game.defeatedStageBosses = { 0: true, 1: true, 2: true, 3: true };
        s.game.gourd.charges = 0;
        api.enterSanctumHub();
        api.setDojoMode("blade_clash");
        s.arena.swordIntent = 100;
        api.saveGame();
      });
      const partCTrib = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const v24 = window.__CHENYUAN_V24__;
        const cloudCode = api.exportFullCloudSaveCode();
        api.startLiveTribulation({ confirmed: true, mode: "defiant" });
        const s = api.getState();
        s.game.hp = 25;
        s.game.gourd.charges = 0;
        const onStart = {
          tribActive: Boolean(s.arena.tribulation),
          sanctumMode: s.arena.sanctumMode,
          swordIntent: s.arena.swordIntent,
          dojoActive: document.getElementById("dojo-control-bar").classList.contains("active"),
          dummyCount: s.arena.enemies.filter(e => e.isDummy).length,
          bladeClash: s.arena.bladeClash
        };
        // Inject floor sanctum_portal & immortal_spring and click #btn-prop-interact on each
        const p = s.arena.player;
        const testProps = [
          { id: "test_sanctum_portal", kind: "sanctum_portal", name: "返洞府阵门", x: p.x, y: p.y, r: 60 },
          { id: "test_spring", kind: "immortal_spring", name: "太初满灵泉", x: p.x, y: p.y, r: 60 },
          { id: "test_map_gate", kind: "map_node_gate", name: "星图阵门", x: p.x, y: p.y, r: 60 }
        ];
        testProps.forEach(pr => {
          s.arena.props.push(pr);
          s.arena.nearbyProp = pr;
          const btn = document.getElementById("btn-prop-interact");
          if (btn) { btn.style.display = "inline-flex"; btn.click(); }
        });
        // Try Digit9 dungeon map & cloud import
        const cloudDuringTrib = v24.importFullCloudSaveCode(cloudCode);
        return {
          onStart,
          cloudDuringTrib,
          afterAttempts: {
            tribActive: Boolean(s.arena.tribulation),
            sanctumMode: s.arena.sanctumMode,
            hp: s.game.hp,
            gourd: s.game.gourd.charges,
            modalOpen: document.getElementById("modal-backdrop").classList.contains("open")
          }
        };
      });
      await page.keyboard.press("Digit9");
      const digit9ModalOpen = await page.evaluate(() => document.getElementById("modal-backdrop").classList.contains("open"));
      assert.equal(partCTrib.onStart.tribActive, true, "R3B-2: Hardcore Live Tribulation active");
      assert.equal(partCTrib.onStart.sanctumMode, false, "R3B-2: startLiveTribulation must clear arena.sanctumMode");
      assert.equal(partCTrib.onStart.swordIntent, 0, "R3B-4: startLiveTribulation from Sanctum must reset Dojo swordIntent to 0");
      assert.equal(partCTrib.onStart.dojoActive, false, "R3B-2: startLiveTribulation must hide #dojo-control-bar");
      assert.equal(partCTrib.onStart.dummyCount, 0, "R3B-2: startLiveTribulation must clear immortal Dojo dummy");
      assert.equal(partCTrib.cloudDuringTrib, false, "R3B-2: Cloud import must be blocked during Live Tribulation");
      assert.equal(partCTrib.afterAttempts.tribActive, true, "DEFECT-R2-2B: sanctum_portal/immortal_spring/map_node_gate must NOT abort Live Tribulation");
      assert.equal(partCTrib.afterAttempts.sanctumMode, false, "DEFECT-R2-2B: sanctum_portal must NOT return to Sanctum during Live Tribulation");
      assert.equal(partCTrib.afterAttempts.hp, 25, "R3B-2: immortal_spring & cloud import must NOT heal during Live Tribulation");
      assert.equal(partCTrib.afterAttempts.gourd, 0, "R3B-2: immortal_spring must NOT refill gourd during Live Tribulation");
      assert.equal(digit9ModalOpen, false, "R3B-2: Digit9 dungeon map must be blocked during Live Tribulation");

      // Clear tribulation cleanly for Part D
      await page.evaluate(() => { window.__CHENYUAN_V25__.getState().arena.tribulation = null; });

      // Part D (R3B-3 + R3B-4 + R3B-5): Workshop Practice overdrive cleanup, Dojo fill-intent reset on formal transitions, Sect Defense mixed_ward prop cleanup
      const partDRes = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const v22 = window.__CHENYUAN_V22__;
        const v24 = window.__CHENYUAN_V24__;
        const s = api.getState();
        s.game.realm = "spirit";
        api.enterSanctumHub();
        v22.launchCustomSeedEncounter();
        s.game.mp = 999;
        v22.triggerAstralGiantForm();
        v24.triggerSanqingTriClones();
        v24.castShanheShejiDomain();
        const inWorkshop = {
          isPractice: api.isPracticeModeActive(),
          astralActive: Boolean(s.arena.astralForm),
          sanqingActive: v24.getState().sanqing.active,
          shanheActive: Boolean(s.arena.shanheDomain)
        };
        // Jump straight into formal Boss Rush Wave 1
        api.startBossRushGauntlet(1);
        const inFormalRush = {
          isPractice: api.isPracticeModeActive(),
          astralActive: Boolean(s.arena.astralForm),
          astralEnergy: s.arena.astralEnergy,
          sanqingActive: v24.getState().sanqing.active,
          shanheActive: Boolean(s.arena.shanheDomain)
        };

        // R3B-4: Sanctum Dojo fill-intent must reset to 0 on formal Stage 0, Boss Rush 1, Spire 1
        api.enterSanctumHub();
        s.arena.swordIntent = 100;
        api.initArenaStage(0, false);
        const intentStage0 = s.arena.swordIntent;

        api.enterSanctumHub();
        s.arena.swordIntent = 100;
        api.startBossRushGauntlet(1);
        const intentRush1 = s.arena.swordIntent;

        api.enterSanctumHub();
        s.arena.swordIntent = 100;
        api.startCelestialSpireRun(1);
        const intentSpire1 = s.arena.swordIntent;

        // R3B-5: Sanctum Dojo mixed_ward props must be purged on startSectDefenseSiege
        api.enterSanctumHub();
        api.setDojoMode("mixed_ward");
        s.arena.swordIntent = 100;
        const mixedWardBefore = s.arena.props.filter(pr => pr.kind === "ward_pylon" || pr.kind === "frost_crystal").length;
        api.startSectDefenseSiege();
        const leakedPropsAfterDefense = s.arena.props.filter(pr => pr.isDojoProp || pr.kind === "ward_pylon" || pr.kind === "frost_crystal").length;
        const intentDefense = s.arena.swordIntent;

        return {
          inWorkshop,
          inFormalRush,
          intentStage0,
          intentRush1,
          intentSpire1,
          mixedWardBefore,
          leakedPropsAfterDefense,
          intentDefense
        };
      });
      assert.equal(partDRes.inWorkshop.isPractice, true, "R3B-3 precondition: Workshop is Practice Mode");
      assert.equal(partDRes.inWorkshop.astralActive, true, "R3B-3 precondition: astralForm active in Workshop");
      assert.equal(partDRes.inFormalRush.isPractice, false, "R3B-3: Formal Boss Rush Wave 1 is non-practice");
      assert.equal(partDRes.inFormalRush.astralActive, false, "R3B-3: Workshop astralForm must NOT leak into formal Boss Rush Wave 1");
      assert.equal(partDRes.inFormalRush.astralEnergy, 0, "R3B-3: Workshop astralEnergy must reset to 0");
      assert.equal(partDRes.inFormalRush.sanqingActive, false, "R3B-3: Workshop sanqingState must NOT leak into formal Boss Rush Wave 1");
      assert.equal(partDRes.inFormalRush.shanheActive, false, "R3B-3: Workshop shanheDomain must NOT leak into formal Boss Rush Wave 1");
      assert.equal(partDRes.intentStage0, 0, "R3B-4: Sanctum Dojo swordIntent must reset to 0 on initArenaStage");
      assert.equal(partDRes.intentRush1, 0, "R3B-4: Sanctum Dojo swordIntent must reset to 0 on formal Boss Rush 1");
      assert.equal(partDRes.intentSpire1, 0, "R3B-4: Sanctum Dojo swordIntent must reset to 0 on formal Spire 1");
      assert.ok(partDRes.mixedWardBefore >= 2, "R3B-5 precondition: mixed_ward spawned ward_pylon & frost_crystal");
      assert.equal(partDRes.leakedPropsAfterDefense, 0, "R3B-5: startSectDefenseSiege must purge all Dojo ward_pylon/frost_crystal props");
      assert.equal(partDRes.intentDefense, 0, "R3B-4: startSectDefenseSiege must reset Dojo swordIntent to 0");
    } finally {
      await ctx.close();
    }
  });
} finally {
  await browser.close();
  if (staticServer) staticServer.close();
}

// ==================== UNCONDITIONAL SUMMARY, JSON REPORT & EXIT CODE ====================
const totalDurationMs = Date.now() - runStartedAt;
const summary = {
  total: results.length,
  executed: results.filter(r => r.status !== "skipped").length,
  passed: results.filter(r => r.status === "passed").length,
  failed: results.filter(r => r.status === "failed").length,
  error: results.filter(r => r.status === "error").length,
  skipped: results.filter(r => r.status === "skipped").length,
  runtimeErrors: allErrors.length,
  durationMs: totalDurationMs
};
const allPassed = summary.failed === 0 && summary.error === 0 && summary.runtimeErrors === 0 && summary.executed > 0;

if (REPORT_PATH) {
  fs.mkdirSync(path.dirname(path.resolve(REPORT_PATH)), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify({
    schemaVersion: 2,
    passed: allPassed,
    summary,
    errors: allErrors,
    suites: results,
    viewport: "1440x900",
    browser: browserVersion,
    timestamp: new Date().toISOString()
  }, null, 2), "utf-8");
}

console.log("\n==================== REGRESSION SUMMARY ====================");
console.log(
  `Total: ${summary.total} | Executed: ${summary.executed} | Passed: ${summary.passed} | Failed: ${summary.failed} | Error: ${summary.error} | Skipped: ${summary.skipped} | RuntimeErrors: ${summary.runtimeErrors} | Duration: ${summary.durationMs}ms`
);
const nonPassing = results.filter(r => r.status === "failed" || r.status === "error");
if (nonPassing.length > 0) {
  console.log("Failed/Errored Suites:");
  for (const r of nonPassing) {
    console.log(`  - [${r.status.toUpperCase()}] ${r.id} (${r.title}): ${r.error}`);
  }
}
if (allErrors.length > 0) {
  console.log("Runtime Console/Page Errors:");
  for (const e of allErrors) {
    console.log(`  - ${e}`);
  }
}
if (allPassed) {
  console.log(`\n✅ ALL ${summary.executed}/${summary.total} EXECUTED REGRESSION SUITES PASSED WITH 0 RUNTIME ERRORS!`);
  process.exitCode = 0;
} else {
  console.error(`\n❌ REGRESSION RUN FAILED (${summary.failed} failed, ${summary.error} error, ${summary.runtimeErrors} runtime errors, ${summary.executed} executed).`);
  process.exitCode = 1;
}
