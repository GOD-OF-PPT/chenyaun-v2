import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { STORAGE_KEY, META_KEY, LEGACY_V10_KEY } from "./fixtures.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
export const PUBLIC_DIR = path.join(REPO_ROOT, "web", "public");
export { STORAGE_KEY, META_KEY, LEGACY_V10_KEY };

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg"
};

export async function loadChromium() {
  const nodePathDirs = (process.env.NODE_PATH || "")
    .split(path.delimiter)
    .map((d) => d.trim())
    .filter(Boolean);

  const searchRoots = [
    path.join(REPO_ROOT, "node_modules"),
    path.join(REPO_ROOT, "web", "node_modules"),
    ...nodePathDirs
  ];

  const pkgNames = ["playwright-core", "playwright"];
  const require = createRequire(import.meta.url);

  for (const pkg of pkgNames) {
    for (const root of searchRoots) {
      const mjsEntry = path.join(root, pkg, "index.mjs");
      const jsEntry = path.join(root, pkg, "index.js");
      if (fs.existsSync(mjsEntry)) {
        const mod = await import(pathToFileURL(mjsEntry).href);
        if (mod?.chromium) return mod.chromium;
        if (mod?.default?.chromium) return mod.default.chromium;
      }
      if (fs.existsSync(jsEntry)) {
        try {
          const mod = require(jsEntry);
          if (mod?.chromium) return mod.chromium;
          if (mod?.default?.chromium) return mod.default.chromium;
        } catch {
          const mod = await import(pathToFileURL(jsEntry).href);
          if (mod?.chromium) return mod.chromium;
          if (mod?.default?.chromium) return mod.default.chromium;
        }
      }
    }
  }

  for (const pkg of pkgNames) {
    try {
      const mod = await import(pkg);
      if (mod?.chromium) return mod.chromium;
      if (mod?.default?.chromium) return mod.default.chromium;
    } catch {
      // continue
    }
  }

  const err = new Error(
    [
      "playwright-core not found.",
      "- After M1 (package.json merged): run `npm ci` in the repo root.",
      "- Before M1: install into a temp dir and pass NODE_PATH:",
      "    TMP_PW=$(mktemp -d) && npm --prefix \"$TMP_PW\" install --no-save playwright-core@1.65.1",
      "    NODE_PATH=\"$TMP_PW/node_modules\" node tests/e2e/run.mjs"
    ].join("\n")
  );
  err.code = "PLAYWRIGHT_NOT_FOUND";
  throw err;
}

export function resolveExecutablePath() {
  if (process.env.CHROMIUM_PATH) {
    if (!fs.existsSync(process.env.CHROMIUM_PATH)) {
      const err = new Error(`CHROMIUM_PATH does not exist: ${process.env.CHROMIUM_PATH}`);
      err.code = "CHROMIUM_PATH_NOT_FOUND";
      throw err;
    }
    return process.env.CHROMIUM_PATH;
  }
  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome"
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

export function startStaticServer(rootDir = PUBLIC_DIR) {
  const resolvedRoot = path.resolve(rootDir);
  const fileCache = new Map();
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url || "/", "http://127.0.0.1");
        let relPath = decodeURIComponent(reqUrl.pathname || "/");
        if (relPath === "/" || relPath === "") relPath = "/playable-v2.html";
        const safeRel = relPath.replace(/^\/+/, "");
        const fullPath = path.resolve(resolvedRoot, safeRel);
        if (!fullPath.startsWith(resolvedRoot + path.sep) && fullPath !== resolvedRoot) {
          res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Forbidden");
          return;
        }
        let cached = fileCache.get(fullPath);
        if (!cached) {
          if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            res.end("Not Found");
            return;
          }
          const ext = path.extname(fullPath).toLowerCase();
          const mime = MIME_TYPES[ext] || "application/octet-stream";
          const buf = fs.readFileSync(fullPath);
          cached = { buf, mime };
          fileCache.set(fullPath, cached);
        }
        res.writeHead(200, {
          "Content-Type": cached.mime,
          "Content-Length": cached.buf.length,
          "Cache-Control": "no-store"
        });
        if (req.method === "HEAD") {
          res.end();
        } else {
          res.end(cached.buf);
        }
      } catch {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Bad Request");
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        server,
        url: `http://127.0.0.1:${port}/playable-v2.html`,
        origin: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((resClose) => {
            server.close(() => {
              fileCache.clear();
              resClose();
            });
            server.closeAllConnections?.();
          })
      });
    });
  });
}

export async function createTestEnv(browser, baseUrl, opts = {}) {
  const {
    actionTimeoutMs = 5000,
    navigationTimeoutMs = 10000,
    reducedMotion = "no-preference"
  } = opts;

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion
  });

  const runtimeErrors = [];

  async function openPage(label = "main", { reducedMotion: pageReducedMotion = null } = {}) {
    const page = await context.newPage();
    page.setDefaultTimeout(actionTimeoutMs);
    page.setDefaultNavigationTimeout(navigationTimeoutMs);
    if (pageReducedMotion) {
      await page.emulateMedia({ reducedMotion: pageReducedMotion });
    }
    page.on("pageerror", (err) => {
      runtimeErrors.push(`[${label} pageerror] ${err?.message || String(err)}`);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        runtimeErrors.push(`[${label} console.error] ${msg.text()}`);
      }
    });
    return page;
  }

  async function gotoWelcome(page, storageMap = null) {
    if (storageMap && Object.keys(storageMap).length > 0) {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
      await page.evaluate((entries) => {
        localStorage.clear();
        for (const [k, v] of Object.entries(entries)) {
          if (v === null || v === undefined) localStorage.removeItem(k);
          else localStorage.setItem(k, String(v));
        }
      }, storageMap);
      await page.reload({ waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
    } else {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeoutMs });
    }
    await page.waitForSelector("#welcome-screen", { timeout: navigationTimeoutMs });
    await page.waitForTimeout(120);
  }

  async function dismissOpeningIfAny(page) {
    // Handles M5 opening scroll/dialogue if shown after #btn-start-new
    for (let i = 0; i < 12; i++) {
      const state = await page.evaluate(() => {
        const dlg = document.querySelector("#story-dialogue-bar");
        const dlgOpen = !!(dlg && dlg.classList.contains("open"));
        const modal = document.querySelector("#modal-backdrop");
        const modalOpen = !!(modal && modal.classList.contains("open"));
        return { dlgOpen, modalOpen };
      });
      if (state.dlgOpen) {
        const skip = await page.$("#btn-dlg-skip");
        const next = await page.$("#btn-dlg-next");
        if (skip && await skip.isVisible()) {
          await skip.click();
        } else if (next && await next.isVisible()) {
          await next.click();
        } else {
          break;
        }
        await page.waitForTimeout(80);
        continue;
      }
      if (state.modalOpen) {
        const confirmBtn = await page.$("#modal-content button[data-action*='prologue'], #modal-content button[data-action*='opening'], #modal-content button[data-modal-close='1']");
        if (confirmBtn && await confirmBtn.isVisible()) {
          await confirmBtn.click();
          await page.waitForTimeout(80);
          continue;
        }
      }
      break;
    }
  }

  async function startFreshGame(page, { dismissOnboarding = true, dismissPrologue = true } = {}) {
    await gotoWelcome(page);
    await page.click("#btn-start-new");
    await page.waitForTimeout(220);
    if (dismissPrologue) {
      await dismissOpeningIfAny(page);
    }
    if (dismissOnboarding) {
      const skipOnb = await page.$("#btn-skip-onboarding");
      if (skipOnb && await skipOnb.isVisible()) {
        await skipOnb.click().catch(() => {});
        await page.waitForTimeout(80);
      }
    }
    await page.waitForSelector("#btn-sanctum-hub", { timeout: navigationTimeoutMs });
  }

  async function continueSavedGame(page, storageMap, { dismissOnboarding = true } = {}) {
    await gotoWelcome(page, storageMap);
    await page.waitForSelector("#btn-continue-save", { state: "visible", timeout: navigationTimeoutMs });
    await page.click("#btn-continue-save");
    await page.waitForTimeout(220);
    if (dismissOnboarding) {
      const skipOnb = await page.$("#btn-skip-onboarding");
      if (skipOnb && await skipOnb.isVisible()) {
        await skipOnb.click().catch(() => {});
        await page.waitForTimeout(80);
      }
    }
    await page.waitForSelector("#btn-sanctum-hub", { timeout: navigationTimeoutMs });
  }

  function assertZeroRuntimeErrors() {
    assert.equal(
      runtimeErrors.length,
      0,
      `Expected 0 console/page errors, got ${runtimeErrors.length}: ${runtimeErrors.slice(0, 3).join(" | ")}`
    );
  }

  async function cleanup() {
    await context.close().catch(() => {});
  }

  return {
    context,
    baseUrl,
    actionTimeoutMs,
    navigationTimeoutMs,
    runtimeErrors,
    openPage,
    gotoWelcome,
    startFreshGame,
    continueSavedGame,
    dismissOpeningIfAny,
    assertZeroRuntimeErrors,
    cleanup
  };
}

// ==================== Opaque-Box UI / DOM Helpers ====================

export async function isModalOpen(page) {
  return page.evaluate(() => {
    const el = document.querySelector("#modal-backdrop");
    return !!(el && el.classList.contains("open"));
  });
}

export async function getModalText(page) {
  return page.evaluate(() => {
    const el = document.querySelector("#modal-content");
    return el ? (el.innerText || "").trim() : "";
  });
}

export async function closeModalEsc(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(120);
}

export async function isDrawerOpen(page) {
  return page.evaluate(() => {
    const el = document.querySelector("#jade-panel");
    return !!(el && el.classList.contains("drawer-open"));
  });
}

export async function openNavTab(page, tabName) {
  const alreadyActive = await page.evaluate((tab) => {
    const panel = document.querySelector("#jade-panel");
    const btn = document.querySelector(`.nav-tab-btn[data-tab="${tab}"]`);
    return !!(panel && panel.classList.contains("drawer-open") && btn && btn.classList.contains("active"));
  }, tabName);
  if (alreadyActive) return;

  const selector = `.nav-tab-btn[data-tab="${tabName}"]`;
  const btn = await page.$(selector);
  if (btn && (await btn.isVisible())) {
    await btn.click({ force: true });
  } else {
    await page.click(selector, { force: true });
  }
  await page.waitForTimeout(160);
}

export async function triggerTribulationAttempt(page) {
  await page.keyboard.press("KeyB");
  await page.waitForTimeout(220);
}

export async function getDrawerText(page) {
  return page.evaluate(() => {
    const el = document.querySelector("#panel-scroll-body") || document.querySelector("#jade-panel");
    return el ? (el.innerText || "").trim() : "";
  });
}

export async function openSettingsTab(page, tabName = "controls") {
  await page.click("#btn-open-settings");
  await page.waitForSelector("#modal-backdrop.open");
  if (tabName) {
    const tabBtn = await page.$(`[data-sys-tab="${tabName}"]`);
    if (tabBtn) {
      await tabBtn.click();
      await page.waitForTimeout(120);
    }
  }
}

export async function getHudState(page) {
  return page.evaluate(() => {
    const text = (sel) => (document.querySelector(sel)?.textContent || "").trim();
    const stonesRaw = text("#hud-stones");
    const stonesNum = parseInt(stonesRaw.replace(/[^\d-]/g, ""), 10);
    const hpRaw = text("#hud-hp-txt");
    const hpMatch = hpRaw.match(/(\d+)\s*\/\s*(\d+)/);
    const hpBarWidth = document.querySelector("#hud-hp-bar")?.style.width || "";
    const hpBarPct = parseFloat(hpBarWidth);
    return {
      name: text("#hud-name"),
      realm: text("#hud-realm"),
      stonesRaw,
      stones: Number.isFinite(stonesNum) ? stonesNum : NaN,
      hpRaw,
      hpCur: hpMatch ? Number(hpMatch[1]) : NaN,
      hpMax: hpMatch ? Number(hpMatch[2]) : NaN,
      hpBarPct: Number.isFinite(hpBarPct) ? hpBarPct : NaN,
      astralText: text("#lbl-astral-pct"),
      soulName: text("#lbl-soul-name")
    };
  });
}

export async function getToastTexts(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll("#toast-container .toast-pill"))
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean);
  });
}

export async function getActiveElementInfo(page) {
  return page.evaluate(() => {
    const ae = document.activeElement;
    if (!ae) return null;
    const modal = document.querySelector("#modal-content");
    const drawer = document.querySelector("#jade-panel");
    return {
      id: ae.id || "",
      tag: ae.tagName,
      role: ae.getAttribute("role") || "",
      dataAction: ae.getAttribute("data-action") || "",
      insideModal: !!(modal && modal.contains(ae)),
      insideDrawer: !!(drawer && drawer.contains(ae))
    };
  });
}

export async function readStorageJson(page, key) {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    if (raw === null) return { raw: null, parsed: null };
    try {
      return { raw, parsed: JSON.parse(raw) };
    } catch {
      return { raw, parsed: null };
    }
  }, key);
}

// ==================== Opaque-Box Meditation, Loot-Magnet & Sync Helpers ====================

export async function ensureMeditating(page, timeoutMs = 5000) {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );
  const alreadyActive = await page.evaluate(
    () => !!document.querySelector("#orb-meditate.meditate-active")
  );
  if (!alreadyActive) {
    await page.keyboard.press("KeyB");
  }
  await page.waitForSelector("#orb-meditate.meditate-active", {
    timeout: timeoutMs
  });
  const lbl = await page.evaluate(
    () => (document.querySelector("#lbl-meditate")?.textContent || "").trim()
  );
  assert.equal(
    lbl,
    "收功",
    `Expected #lbl-meditate to display "收功" while meditating, got "${lbl}"`
  );
}

export async function waitForLootMagnetWindow(
  page,
  {
    stonesBefore,
    minFrames = 32,
    minSimSec = 0.7,
    maxWallMs = 12000,
    requireMeditation = true
  }
) {
  return page.evaluate(
    ({ before, minF, minSim, maxWall, reqMed }) =>
      new Promise((resolve) => {
        const startWall = performance.now();
        let prevTs = null;
        let frames = 0;
        let simTime = 0;
        let done = false;

        function readStones() {
          const raw = (document.querySelector("#hud-stones")?.textContent || "").trim();
          const num = parseInt(raw.replace(/[^\d-]/g, ""), 10);
          return Number.isFinite(num) ? num : NaN;
        }

        function finish(reason) {
          if (done) return;
          done = true;
          clearTimeout(wallGuard);
          resolve({
            reason,
            frames,
            simTime: Number(simTime.toFixed(4)),
            wallMs: Math.round(performance.now() - startWall),
            stones: readStones(),
            meditating: !!document.querySelector("#orb-meditate.meditate-active")
          });
        }

        const wallGuard = setTimeout(() => finish("wall_timeout"), maxWall);

        function step(ts) {
          if (done) return;
          if (prevTs !== null) {
            simTime += Math.min(0.05, Math.max(0, (ts - prevTs) / 1000));
            frames += 1;
          }
          prevTs = ts;

          const curStones = readStones();
          if (Number.isFinite(curStones) && curStones > before) {
            finish("collected");
            return;
          }
          if (reqMed && !document.querySelector("#orb-meditate.meditate-active")) {
            finish("meditation_lost");
            return;
          }
          if (frames >= minF && simTime >= minSim) {
            finish("window_elapsed");
            return;
          }
          if (performance.now() - startWall >= maxWall) {
            finish("wall_timeout");
            return;
          }
          requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
      }),
    {
      before: stonesBefore,
      minF: minFrames,
      minSim: minSimSec,
      maxWall: maxWallMs,
      reqMed: requireMeditation
    }
  );
}

export async function waitForStonesAtLeast(page, targetStones, maxWallMs = 6000) {
  return page.evaluate(
    ({ target, maxWall }) =>
      new Promise((resolve) => {
        const startWall = performance.now();
        let frames = 0;
        let done = false;

        function readStones() {
          const raw = (document.querySelector("#hud-stones")?.textContent || "").trim();
          const num = parseInt(raw.replace(/[^\d-]/g, ""), 10);
          return Number.isFinite(num) ? num : NaN;
        }

        function finish(ok) {
          if (done) return;
          done = true;
          clearTimeout(wallGuard);
          resolve({
            ok,
            frames,
            wallMs: Math.round(performance.now() - startWall),
            stones: readStones()
          });
        }

        const wallGuard = setTimeout(() => finish(false), maxWall);

        function step() {
          if (done) return;
          const cur = readStones();
          if (Number.isFinite(cur) && cur >= target) {
            finish(true);
            return;
          }
          if (performance.now() - startWall >= maxWall) {
            finish(false);
            return;
          }
          frames += 1;
          requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
      }),
    { target: targetStones, maxWall: maxWallMs }
  );
}

export async function waitForCrossTabConflict(page, timeoutMs = 2500) {
  await page
    .waitForFunction(
      () =>
        !!document.querySelector(
          '[data-action="stay-readonly-save"], [data-action="open-save-conflict"]'
        ) ||
        /冲突|新进度|载入最新/.test(
          `${document.querySelector("#hud-save-alert")?.innerText || ""} ${
            document.querySelector("#modal-backdrop.open #modal-content")?.innerText || ""
          }`
        ),
      null,
      { timeout: timeoutMs }
    )
    .catch(() => {});
}

export async function waitForCrossTabInvalidNotice(page, timeoutMs = 2500) {
  await page
    .waitForFunction(
      () =>
        /损坏|无效|校验失败|异常/.test(
          `${document.querySelector("#hud-save-alert")?.innerText || ""} ${
            document.querySelector("#modal-backdrop.open #modal-content")?.innerText || ""
          } ${Array.from(document.querySelectorAll("#toast-container .toast-pill"))
            .map((e) => e.textContent || "")
            .join(" ")}`
        ),
      null,
      { timeout: timeoutMs }
    )
    .catch(() => {});
}
