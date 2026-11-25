// Probe 3: does Space (dodge key) / canvas click advance the post-rescue dialogue? Is the pending 玉莲台 choice preserved after leaving to hub?
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const require = createRequire(path.join(REPO, "package.json"));
const { chromium } = require("playwright-core");
const harness = await import(path.join(REPO, "tests/e2e/lib/harness.mjs"));
const OUT = process.argv[2];
const srv = await harness.startStaticServer();
const browser = await chromium.launch({ executablePath: harness.resolveExecutablePath(), headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
const log = [];
const note = (k, v) => { log.push({ k, v }); console.log(k, JSON.stringify(v).slice(0, 300)); };
const dlg = () => page.evaluate(() => {
  const b = document.querySelector("#story-dialogue-bar");
  return b && b.classList.contains("open") ? b.innerText.replace(/\s+/g, " ").slice(0, 90) : null;
});
const active = () => page.evaluate(() => { const a = document.activeElement; return a ? (a.id || a.tagName) + ":" + (a.innerText || "").slice(0, 10) : null; });
const stage = () => page.evaluate(() => document.querySelector("#stage-title")?.innerText || null);
const pill = () => page.evaluate(() => document.querySelector("#wave-sub-tag")?.innerText || null);
await page.goto(srv.url, { waitUntil: "domcontentloaded" });
await page.waitForSelector("#welcome-screen");
await page.waitForTimeout(800);
await page.click("#btn-start-new");
await page.waitForTimeout(600);
for (let i = 0; i < 20 && await dlg(); i++) { await page.click("#btn-dlg-next"); await page.waitForTimeout(300); }
// Fight with movement + clicks + right click + dodge, stop the moment dialogue opens
const keys = ["KeyD", "KeyW", "KeyA", "KeyS"];
let t = 0; const t0 = Date.now();
while (!(await dlg()) && t < 60) {
  await page.mouse.move(700 + (t % 3) * 40, 470);
  await page.keyboard.down(keys[t % 4]);
  for (let c = 0; c < 3; c++) { await page.mouse.click(700 + (t % 3) * 40, 470); await page.waitForTimeout(90); }
  await page.keyboard.up(keys[t % 4]);
  if (t % 4 === 3) await page.mouse.click(700, 470, { button: "right" });
  t++;
}
note("fightCleared", { ms: Date.now() - t0, dlg: await dlg(), focus: await active(), pill: await pill() });
await page.screenshot({ path: path.join(OUT, "p3-01-dialogue.png") });
let d0 = await dlg();
await page.keyboard.press("Space");
await page.waitForTimeout(400);
let d1 = await dlg();
note("spaceAdvancesDialogue", { changed: d0 !== d1, d0, d1, focus: await active() });
await page.mouse.click(250, 640);
await page.waitForTimeout(400);
let d2 = await dlg();
note("canvasClickAdvancesDialogue", { changed: d1 !== d2, d2 });
// Leave to hub with choice pending
const hubBtn = await page.$("#btn-sanctum-hub");
await hubBtn.click({ timeout: 2000 }).then(() => note("hubClicked", true)).catch(e => note("hubClickBlocked", String(e).slice(0, 80)));
await page.waitForTimeout(1500);
note("afterHub", { stage: await stage(), dlg: await dlg(), pill: await pill() });
await page.screenshot({ path: path.join(OUT, "p3-02-hub.png") });
log.push({ errors });
fs.writeFileSync(path.join(OUT, "probe3-log.json"), JSON.stringify(log, null, 2));
await browser.close();
await srv.close();
console.log("done errors", errors.length);
