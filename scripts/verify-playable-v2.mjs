#!/usr/bin/env node
/**
 * 《尘缘问道 · 剑阵万象》全量 1440×900 Chromium 自动化回归验收套件（M1–M4 + P1–P5 + R2–R6 · 共 44 项）
 *
 * 用法：
 *   node scripts/verify-playable-v2.mjs
 *   node scripts/verify-playable-v2.mjs --filter M4
 *   node scripts/verify-playable-v2.mjs --screenshots test-results/shots --report test-results/regression-report.json
 *   node scripts/verify-playable-v2.mjs --url http://127.0.0.1:5174/playable-v2.html
 *   node scripts/verify-playable-v2.mjs --fail-fast --timeout 45000
 */

import assert from "node:assert/strict";
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
  --timeout <ms>         Per-suite timeout in milliseconds (default: 45000)
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
const SUITE_TIMEOUT_MS = TIMEOUT_RAW !== null ? Number(TIMEOUT_RAW) : 45000;
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
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const rawPath = (req.url || "/").split("?")[0];
      const safeRel = path.normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, "");
      const fullPath = path.join(rootDir, safeRel === "/" ? "playable-v2.html" : safeRel);
      if (!fullPath.startsWith(rootDir) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      const ext = path.extname(fullPath).toLowerCase();
      res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
      fs.createReadStream(fullPath).pipe(res);
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
        ch4Variants: s.arena.enemies.map(e => ({ name: e.name, tag: e.variantTag, color: e.variantColor }))
      };
    });
    assert.equal(csCheck.secHasSerpent, true, "Ch3 enter_secret cutscene must reference 寒潭玄蛇");
    assert.equal(csCheck.moundHasPuppet, true, "Ch4 enter_sword_mound cutscene must reference 古修剑冢 & 古境剑傀");
    assert.equal(csCheck.ch4DlgOpen, true, "Entering Ch4 Sword Mound first time must open cutscene dialogue bar");
    assert.equal(csCheck.ch4Seen, true);
    assert.ok(csCheck.ch4Variants.length > 0 && csCheck.ch4Variants.every(v => v.tag && v.color), "Ch4 enemies must carry chapter variant metadata");
    await maybeShot(page, "p4_01_ch4_sword_mound_cutscene.png");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(120);

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

    // Tab B (stale ascensions=2) progresses bestScore=999, seenEnemies+=jade_serpent, bestRushGrade="SS"
    await tabB.evaluate(() => {
      const m = window.__CHENYUAN_V25__.getMetaState();
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

    // Queue & display non-blocking #new-unlock-card -> dismiss persists into seenUnlockIds across reload
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const g = api.getState().game;
      g.realm = "qi";
      g.seenUnlockIds = [];
      api.queueNewUnlockCardsForState(g);
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
