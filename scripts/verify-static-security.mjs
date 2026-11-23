#!/usr/bin/env node
// Focused integration checks for sanitization, packaging and save-status rendering.
// All gameplay mutations happen in disposable browser contexts, never user profiles.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const root = path.resolve(arg("--root", path.join(repo, "web/public")));
const reportPath = path.resolve(arg("--report", path.join(repo, "dist/security-smoke.json")));
const shotDir = path.dirname(reportPath);
fs.mkdirSync(shotDir, { recursive: true });
const entry = fs.existsSync(path.join(root, "playable-v2.html")) ? "playable-v2.html" : "index.html";
const executablePath = process.env.CHROMIUM_PATH || ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/usr/bin/chromium", "/usr/bin/google-chrome"].find(p => fs.existsSync(p));
if (!executablePath) throw new Error("Set CHROMIUM_PATH to an installed Chromium/Chrome binary.");
const prefix = "/nested/static-game/";
const server = http.createServer((req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (!pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
    const rel = pathname.slice(prefix.length) || "index.html";
    const target = path.resolve(root, rel);
    if (!target.startsWith(root + path.sep) || !fs.statSync(target).isFile()) { res.writeHead(404).end(); return; }
    res.setHeader("Content-Type", ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".webp": "image/webp", ".json": "application/json" })[path.extname(target)] || "application/octet-stream");
    fs.createReadStream(target).pipe(res);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}${prefix}`;
const errors = [], external = [], results = [];
const storageKey = "chenyuan_wendao_v11_save";
const browser = await chromium.launch({ executablePath, headless: true });
let savedRaw;

async function context() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  ctx.on("page", page => {
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("request", req => { if (/^https?:/.test(req.url()) && !req.url().startsWith(base)) external.push(req.url()); });
  });
  return ctx;
}
async function load(ctx, url = base + entry) {
  const page = await ctx.newPage();
  await page.goto(url);
  await page.locator("#btn-start-new").waitFor();
  return page;
}
async function enter(page, resume = false) {
  await page.locator(resume ? "#btn-continue-save" : "#btn-start-new").click();
  if (await page.locator("#btn-dlg-skip").isVisible()) await page.locator("#btn-dlg-skip").click();
  await page.evaluate(() => { window.__CHENYUAN_V25__.getState().arena.paused = true; });
}
async function check(name, fn) {
  const started = Date.now();
  try { await fn(); results.push({ name, ok: true, durationMs: Date.now() - started }); console.log(`PASS ${name}`); }
  catch (e) { results.push({ name, ok: false, error: e.message }); throw e; }
}

try {
  await check("nested-path boot, five drawers, modal focus, raster art, SVG edges and canvas", async () => {
    const ctx = await context();
    try {
      const page = await load(ctx);
      assert.equal(await page.evaluate(() => DOMPurify.version), "3.5.0");
      await page.screenshot({ path: path.join(shotDir, "welcome.png") });
      await enter(page);
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.openingChoice = "help";
        api.syncProgressiveSkillVisibility();
      });
      for (const id of ["cultivate", "story", "explore", "alchemy", "bag"]) {
        await page.locator(`#nav-btn-${id}`).click();
        assert.ok((await page.locator("#panel-scroll-body").innerText()).length > 10, id);
        assert.ok(await page.locator("#panel-scroll-body button").count(), `${id} buttons retained`);
        await page.locator("#panel-scroll-body [data-close-drawer]").click();
      }
      await page.locator("#btn-goals-modal").click();
      await page.locator("#modal-content").waitFor({ state: "visible" });
      await page.keyboard.press("Escape");
      assert.equal(await page.evaluate(() => document.activeElement.id), "btn-goals-modal");
      await page.evaluate(() => window.__CHENYUAN_V25__.openDungeonMapModal());
      await page.waitForFunction(() => document.querySelector("#modal-content svg path"));
      assert.ok(await page.locator("#modal-content svg path").count());
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.closeModal(); api.getState().game.realm = "qi";
        api.openTaixuCraftMinigameModal("alchemy");
      });
      assert.equal(await page.locator("#craft-minigame-canvas").count(), 1);
      assert.ok(await page.evaluate(() => Boolean(document.getElementById("craft-minigame-canvas").getContext("2d"))));
      await page.evaluate(() => { const api = window.__CHENYUAN_V25__; api.closeModal(); api.getState().arena.paused = true; });
      const art = await page.evaluate(() => [...document.querySelectorAll("#hud-avatar, #stage-bg-img")].map(img => img.complete && img.naturalWidth > 0));
      assert.ok(art.every(Boolean), "raster art retained");
      await page.screenshot({ path: path.join(shotDir, "game.png") });
    } finally { await ctx.close(); }
  });
  await check("malicious markup is removed at the real telemetry HTML sink", async () => {
    const ctx = await context();
    try {
      const page = await load(ctx);
      await enter(page);
      await page.evaluate(() => {
        window.securityProbe = 0;
        const payload = `SECURITY_PROBE<svg onload="window.securityProbe=1"><circle r="2"/></svg><img src="data:image/svg+xml,%3Csvg%20onload='window.securityProbe=2'%3E" onerror="window.securityProbe=3"><a href="javascript:window.securityProbe=4">unsafe</a><iframe srcdoc="attack"></iframe><form action="data:text/html,attack"></form><span class="security-style" style="background:url(https://example.invalid/attack)">style</span>`;
        const a = window.__CHENYUAN_V25__.getState().arena;
        a.showTelemetry = true;
        a.inputChain = [{ tag: payload, isBuffered: false }];
      });
      await page.waitForFunction(() => document.getElementById("telemetry-input-chain").textContent.includes("SECURITY_PROBE"));
      const state = await page.evaluate(() => {
        const el = document.getElementById("telemetry-input-chain");
        return { flag: window.securityProbe, bad: el.querySelectorAll("script,iframe,form,[onerror],[onload],[src],[href]").length, style: el.querySelector(".security-style")?.getAttribute("style"), svg: el.querySelectorAll("svg circle").length };
      });
      assert.equal(state.flag, 0);
      assert.equal(state.bad, 0);
      assert.equal(state.style, null);
      assert.equal(state.svg, 1, "safe SVG retained");
    } finally { await ctx.close(); }
  });
  await check("new save, refresh and old-save continuation", async () => {
    const ctx = await context();
    try {
      const page = await load(ctx); await enter(page);
      const saved = await page.evaluate(key => { const api = window.__CHENYUAN_V25__; const g = api.getState().game; g.name = "安全验收"; g.stones = 321; return { ok: api.saveGame(), raw: localStorage.getItem(key) }; }, storageKey);
      assert.equal(saved.ok, true); savedRaw = saved.raw;
      await page.reload(); await enter(page, true);
      assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.name), "安全验收");
    } finally { await ctx.close(); }
  });
  await check("corrupt save warning keeps the original bytes", async () => {
    const ctx = await context();
    try {
      const raw = '{"corrupt":"<img onerror=attack>"';
      await ctx.addInitScript(({ key, raw }) => {
        if (location.protocol === "http:" || location.protocol === "https:") localStorage.setItem(key, raw);
      }, { key: storageKey, raw });
      const page = await load(ctx);
      assert.match(await page.locator("#save-status-banner").innerText(), /读取失败/);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), raw);
    } finally { await ctx.close(); }
  });
  await check("write failure warning keeps the previous save", async () => {
    const ctx = await context();
    try {
      await ctx.addInitScript(({ key, raw }) => {
        if (location.protocol !== "http:" && location.protocol !== "https:") return;
        localStorage.setItem(key, raw);
        const original = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k, value) { if (k === key) throw new DOMException("test quota", "QuotaExceededError"); return original.call(this, k, value); };
      }, { key: storageKey, raw: savedRaw });
      const page = await load(ctx); await enter(page, true);
      assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.saveGame()), false);
      assert.match(await page.locator("#hud-save-alert").innerText(), /写入失败/);
      assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), savedRaw);
    } finally { await ctx.close(); }
  });
  await check("two tabs display conflict and refuse stale overwrites", async () => {
    const ctx = await context();
    try {
      const a = await load(ctx); await enter(a);
      const b = await load(ctx); await enter(b, true);
      const raw = await a.evaluate(key => { const api = window.__CHENYUAN_V25__; api.getState().game.stones += 100; api.saveGame(); return localStorage.getItem(key); }, storageKey);
      await b.waitForFunction(() => document.getElementById("hud-save-alert").textContent.includes("另一标签页"));
      assert.equal(await b.evaluate(() => window.__CHENYUAN_V25__.saveGame()), false);
      assert.equal(await b.evaluate(key => localStorage.getItem(key), storageKey), raw);
    } finally { await ctx.close(); }
  });
  await check("direct file entry loads without a server", async () => {
    const ctx = await context();
    try {
      const page = await load(ctx, pathToFileURL(path.join(root, entry)).href);
      assert.equal(await page.evaluate(() => DOMPurify.isSupported), true);
      await enter(page);
      assert.ok(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game));
    } finally { await ctx.close(); }
  });
  assert.deepEqual(external, [], "no external network requests");
  assert.deepEqual(errors, [], "no console/page errors");
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
  const ok = results.length === 7 && results.every(r => r.ok) && errors.length === 0 && external.length === 0;
  fs.writeFileSync(reportPath, JSON.stringify({ root, viewport: "1440x900", browser: executablePath, ok, results, errors, external }, null, 2) + "\n");
}
