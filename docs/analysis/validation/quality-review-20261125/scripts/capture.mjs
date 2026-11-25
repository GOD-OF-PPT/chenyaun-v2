// Re-capture audit evidence on current main. Isolated browser context, static HTTP, 1440x900, real mouse/keyboard.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const require = createRequire(path.join(REPO, "package.json"));
const { chromium } = require("playwright-core");
const harness = await import(path.join(REPO, "tests/e2e/lib/harness.mjs"));
const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const srv = await harness.startStaticServer();
const server = { close: srv.close };
const url = srv.origin;
console.log("server", url);
const browser = await chromium.launch({ executablePath: harness.resolveExecutablePath(), headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
const log = {};
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, n) }); console.log("shot", n); };
const textOf = async (sel) => page.evaluate(s => [...document.querySelectorAll(s)].filter(e => e.offsetParent).map(e => e.innerText.trim()).filter(Boolean), sel);
const fontAudit = () => page.evaluate(() => {
  const res = {};
  for (const el of document.querySelectorAll("body *")) {
    if (!el.offsetParent || !el.childNodes) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (!own) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.bottom < 0 || r.top > 900) continue;
    const fs = Math.round(parseFloat(getComputedStyle(el).fontSize));
    (res[fs] ||= []).push((el.id ? "#" + el.id : el.className || el.tagName).toString().slice(0, 40) + ":" + el.textContent.trim().slice(0, 16));
  }
  return Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { n: v.length, sample: v.slice(0, 6) }]));
});
await page.goto(url.replace(/\/$/, "") + "/playable-v2.html", { waitUntil: "domcontentloaded" });
await page.waitForSelector("#welcome-screen");
await page.waitForTimeout(1200);
await shot("01-start.png");
log.welcomeFonts = await fontAudit();
await page.click("#btn-start-new");
await page.waitForTimeout(800);
await shot("02-opening-dialogue.png");
log.openingDialogue = [];
for (let i = 0; i < 30; i++) {
  const open = await page.evaluate(() => document.querySelector("#story-dialogue-bar")?.classList.contains("open"));
  if (!open) break;
  log.openingDialogue.push((await textOf("#story-dialogue-bar")).join(" | ").slice(0, 200));
  const next = await page.$("#btn-dlg-next");
  if (next && await next.isVisible()) await next.click(); else break;
  await page.waitForTimeout(350);
}
const modal = await page.evaluate(() => document.querySelector("#modal-backdrop")?.classList.contains("open") ? document.querySelector("#modal-content")?.innerText.slice(0, 400) : null);
log.modalAfterDialogue = modal;
await page.waitForTimeout(600);
await shot("03-opening-field.png");
log.fieldTexts = await page.evaluate(() => document.body.innerText.slice(0, 1500));
log.fieldFonts = await fontAudit();
// Combat: real input for ~10s
await page.mouse.move(900, 450);
const keys = ["KeyD", "KeyW", "KeyA", "KeyS"];
const toastSamples = [];
for (let t = 0; t < 10; t++) {
  await page.keyboard.down(keys[t % 4]);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.up();
  await page.keyboard.up(keys[t % 4]);
  if (t % 3 === 2) await page.keyboard.press("Space");
  if (t === 5) await page.mouse.click(900, 450, { button: "right" });
  toastSamples.push(await harness.getToastTexts(page).catch(() => []));
  if (t === 6) await shot("04-combat-action.png");
}
log.toastSamples = toastSamples;
log.hudAfterCombat = await harness.getHudState(page).catch(e => String(e));
log.onboardBefore = await textOf(".ob-step-pill, #onboarding-panel, [id*=onboard]");
await shot("05-combat-after.png");
// Return to hub via button (real click)
const hubBtn = await page.$("#btn-sanctum-hub");
if (hubBtn && await hubBtn.isVisible()) await hubBtn.click();
await page.waitForTimeout(1500);
log.modalAfterHub = await page.evaluate(() => document.querySelector("#modal-backdrop")?.classList.contains("open") ? document.querySelector("#modal-content")?.innerText.slice(0, 400) : null);
await shot("06-hub.png");
log.onboardInHub = await textOf(".ob-step-pill, #onboarding-panel, [id*=onboard]");
log.hubFonts = await fontAudit();
log.hubToasts = await harness.getToastTexts(page).catch(() => []);
// Settings audio/motion
log.settingsControls = await page.evaluate(() => [...document.querySelectorAll("input[type=range], input[type=checkbox], select")].map(e => (e.id || e.name) + ":" + (e.closest("label")?.innerText || e.getAttribute("aria-label") || "").slice(0, 30)));
log.localStorageKeys = await page.evaluate(() => Object.keys(localStorage));
log.errors = errors;
fs.writeFileSync(path.join(OUT, "capture-log.json"), JSON.stringify(log, null, 2));
await browser.close();
server.close?.();
console.log("done; errors:", errors.length);
