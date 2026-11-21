#!/usr/bin/env node
/**
 * 《尘缘问道 · 剑阵万象》全量 1440×900 Chromium 自动化回归验收套件（M1–M4 · 共 19 项）
 *
 * 用法：
 *   node scripts/verify-playable-v2.mjs
 *   node scripts/verify-playable-v2.mjs --filter M4
 *   node scripts/verify-playable-v2.mjs --screenshots /tmp/cy_shots --report /tmp/cy_report.json
 *   node scripts/verify-playable-v2.mjs --url http://127.0.0.1:5174/playable-v2.html
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

// ==================== CLI ARGUMENTS ====================
const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null;
}
const FILTER = getArg("--filter") || "";
const SHOTS_DIR = getArg("--screenshots");
const REPORT_PATH = getArg("--report");
const EXPLICIT_URL = getArg("--url");

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
  if (process.env.CHROMIUM_PATH && fs.existsSync(process.env.CHROMIUM_PATH)) {
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
let targetUrl = EXPLICIT_URL;
let staticServer = null;

function attachErrorListeners(page, label) {
  page.on("pageerror", (err) => allErrors.push(`[${label} pageerror] ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") allErrors.push(`[${label} console.error] ${msg.text()}`);
  });
}

async function runSuite(id, title, fn) {
  const fullName = `${id}. ${title}`;
  if (FILTER && !fullName.toLowerCase().includes(FILTER.toLowerCase())) return;
  const started = Date.now();
  process.stdout.write(`▶ ${fullName} ... `);
  try {
    await fn();
    const durationMs = Date.now() - started;
    results.push({ id, title, ok: true, durationMs });
    console.log(`PASS (${durationMs}ms)`);
  } catch (err) {
    const durationMs = Date.now() - started;
    results.push({ id, title, ok: false, durationMs, error: err.message });
    console.log(`FAIL (${durationMs}ms):`, err.message);
    throw err;
  }
}

async function newIsolatedContext(browser) {
  return browser.newContext({ viewport: { width: 1440, height: 900 } });
}

async function startCleanGamePage(browser, tag, markPrologueDone = true) {
  const ctx = await newIsolatedContext(browser);
  const page = await ctx.newPage();
  attachErrorListeners(page, tag);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#btn-start-new");
  await page.click("#btn-start-new");
  await page.waitForTimeout(280);
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
const chromium = await loadChromium();
if (!targetUrl) {
  const srv = await startStaticServer(PUBLIC_DIR);
  staticServer = srv.server;
  targetUrl = srv.url;
}

const execPath = resolveExecutablePath();
const browser = await chromium.launch({
  ...(execPath ? { executablePath: execPath } : {}),
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});

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
    await page.evaluate(() => {
      const s = window.__CHENYUAN_V25__.getState();
      s.game.inventory.healing_pill = 1;
      s.game.stones = 333;
      s.arena.player.invuln = 0;
      window.__CHENYUAN_V25__.hurtPlayer(99999);
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
      window.__CHENYUAN_V25__.hurtPlayer(99999);
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
    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.game.realm = "qi";
      s.game.xp = api.getState().realmSpec.xpCap;
      s.game.inventory.foundation_pill = 1;
      s.game.inventory.healing_pill = 0;
      s.game.tribShield = 0;
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
      window.__CHENYUAN_V25__.hurtPlayer(99999);
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
    await tabA.waitForTimeout(250);
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
      s.arena.dungeonMap.currentNodeId = "n4_0";
      s.arena.waveIdx = 4;
      s.arena.enemies = [];
      api.spawnCurrentWave();
      for (const e of s.arena.enemies.slice()) api.handleEnemyDeath(e);
    });
    await page.waitForTimeout(700);
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
    assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.stageIdx), 3);

    await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const s = api.getState();
      s.arena.dungeonMap.currentNodeId = "n4_0";
      s.arena.waveIdx = 4;
      s.arena.enemies = [];
      api.spawnCurrentWave();
      for (const e of s.arena.enemies.slice()) api.handleEnemyDeath(e);
    });
    await page.waitForTimeout(700);
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

    // 3. Toggle 【全神通演武】 inside Roadmap -> all 14 systems immediately unlock!
    await page.click('[data-action="toggle-arcana-all-roadmap"]');
    await page.waitForTimeout(200);
    assert.equal(await page.locator(".roadmap-sys-btn.locked").count(), 0, "Sandbox toggle must unlock all 14 systems immediately");
    await maybeShot(page, "m4_02_ascension_roadmap_sandbox.png");

    // Verify sandbox toggle actually lets Mortal player open Seed Workshop, then restore gradual progression!
    await page.click('[data-roadmap-sys="seed_workshop"]');
    await page.waitForTimeout(180);
    assert.ok((await page.textContent("#modal-content")).includes("太虚造化工坊"));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(140);

    // 4. Turn off sandbox & step through realms (qi -> foundation -> golden -> nascent -> spirit)
    const ladderCheck = await page.evaluate(() => {
      const api = window.__CHENYUAN_V25__;
      const { game } = api.getState();
      game.unlockAllArcana = false;
      const out = {};
      for (const r of ["qi", "foundation", "golden", "nascent", "spirit"]) {
        game.realm = r;
        out[r] = {
          pet: api.isEcosystemSystemUnlocked(game, "spirit_pet"),
          defense: api.isEcosystemSystemUnlocked(game, "sect_defense"),
          tagTeam: api.isEcosystemSystemUnlocked(game, "tag_team"),
          cloudSea: api.isEcosystemSystemUnlocked(game, "cloud_sea_trial"),
          spire: api.isEcosystemSystemUnlocked(game, "celestial_spire"),
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
    assert.equal(ladderCheck.golden.spire, true);
    assert.equal(ladderCheck.golden.rush, false);
    assert.equal(ladderCheck.nascent.rush, true);
    assert.equal(ladderCheck.nascent.pacts, true);
    assert.equal(ladderCheck.nascent.workshop, false);
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
    await page.waitForTimeout(320);

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

  assert.equal(allErrors.length, 0, `Expected 0 console/page errors, got:\n${allErrors.join("\n")}`);
  console.log(`\n✅ ALL ${results.length} REGRESSION SUITES PASSED WITH 0 RUNTIME ERRORS!`);

  if (REPORT_PATH) {
    fs.mkdirSync(path.dirname(path.resolve(REPORT_PATH)), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify({
      passed: results.every(r => r.ok) && allErrors.length === 0,
      total: results.length,
      errors: allErrors,
      suites: results,
      viewport: "1440x900",
      timestamp: new Date().toISOString()
    }, null, 2), "utf-8");
  }
} finally {
  await browser.close();
  if (staticServer) staticServer.close();
}
