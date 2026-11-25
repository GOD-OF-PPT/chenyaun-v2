// Probe 2: dialogue/click interplay, pending reward across hub/reload, float-text leak, held-LMB-only first fight.
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
const browser = await chromium.launch({ executablePath: harness.resolveExecutablePath(), headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
const log = { steps: [] };
const note = (k, v) => { log.steps.push({ k, v }); console.log(k, JSON.stringify(v).slice(0, 300)); };
const shot = (n) => page.screenshot({ path: path.join(OUT, n) });
const dlg = () => page.evaluate(() => {
  const b = document.querySelector("#story-dialogue-bar");
  return b && b.classList.contains("open") ? b.innerText.replace(/\s+/g, " ").slice(0, 120) : null;
});
const quest = () => page.evaluate(() => document.querySelector(".qt-desc-line")?.innerText || null);
const stage = () => page.evaluate(() => document.querySelector("#stage-title")?.innerText || null);
const hpText = () => page.evaluate(() => document.body.innerText.match(/(\d+)\/100/)?.[0] || null);
await page.goto(srv.url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#welcome-screen");
await page.waitForTimeout(800);
await page.click("#btn-start-new");
await page.waitForTimeout(600);
for (let i = 0; i < 20 && await dlg(); i++) { await page.click("#btn-dlg-next"); await page.waitForTimeout(300); }
note("afterPrologue", { dlg: await dlg(), quest: await quest(), hp: await hpText() });
// Held LMB only, cursor toward wolves, no movement / dodge
const t0 = Date.now();
await page.mouse.move(700, 480);
await page.mouse.down();
let firstDlg = null;
for (let i = 0; i < 150; i++) {
  await page.waitForTimeout(200);
  const d = await dlg();
  if (d) { firstDlg = d; break; }
}
await page.mouse.up();
note("heldLmbOnly", { ms: Date.now() - t0, firstDlg, hp: await hpText(), combo: await page.evaluate(() => document.querySelector("#combo-tier-txt")?.innerText || null) });
await shot("p2-01-dialogue-open.png");
// Single click on empty canvas area far from cards/dialogue
const before = await dlg();
await page.mouse.click(250, 620);
await page.waitForTimeout(400);
const after = await dlg();
note("canvasClickAdvancesDialogue", { changed: before !== after, before, after });
// Try leaving via hub button while dialogue / reward pending
const hubBtn = await page.$("#btn-sanctum-hub");
const hubVisible = hubBtn ? await hubBtn.isVisible() : false;
if (hubVisible) await hubBtn.click({ timeout: 2000 }).catch(e => note("hubClickErr", String(e).slice(0, 120)));
await page.waitForTimeout(1500);
note("afterHubClick", { stage: await stage(), dlg: await dlg(), quest: await quest() });
await shot("p2-02-after-hub-click.png");
// Reload and check state
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("#welcome-screen");
await page.waitForTimeout(800);
const cont = await page.$("#btn-continue-save");
note("reloadContinueVisible", cont ? await cont.isVisible() : false);
if (cont && await cont.isVisible()) { await cont.click(); await page.waitForTimeout(1500); }
note("afterReload", { stage: await stage(), dlg: await dlg(), quest: await quest() });
await shot("p2-03-after-reload.png");
log.errors = errors;
fs.writeFileSync(path.join(OUT, "probe2-log.json"), JSON.stringify(log, null, 2));
await browser.close();
await srv.close();
console.log("done errors", errors.length);
