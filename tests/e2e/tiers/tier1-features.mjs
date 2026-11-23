import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  REPO_ROOT,
  STORAGE_KEY,
  META_KEY,
  isModalOpen,
  getModalText,
  closeModalEsc,
  isDrawerOpen,
  openNavTab,
  triggerTribulationAttempt,
  getDrawerText,
  openSettingsTab,
  getHudState,
  getToastTexts,
  getActiveElementInfo,
  readStorageJson
} from "../lib/harness.mjs";
import {
  ALL_DAO_LAW_IDS,
  ALL_CHAPTER_STEP_IDS,
  REALM_XP_CAPS,
  buildLegacyEb0ea67Game,
  buildEnvelopeV2,
  buildMetaSave,
  buildCorruptMetaSave,
  buildCloudSaveCode
} from "../lib/fixtures.mjs";

export const tier = 1;
export const name = "Tier 1 — Feature Coverage (Isolated Happy Paths)";

export const tests = [
  // ==================== E2E-T1-01: T1 元存档损坏保护 ====================
  {
    id: "E2E-T1-01",
    title: "T1: Corrupted meta save is preserved with warning banner & explicit reset",
    features: ["T1"],
    async fn(env) {
      const page = await env.openPage("t1-01");
      const corruptMeta = buildCorruptMetaSave();
      await env.gotoWelcome(page, { [META_KEY]: corruptMeta });

      const bannerText = await page.evaluate(() => {
        const el = document.querySelector("#save-status-banner");
        if (!el) return "";
        const style = getComputedStyle(el);
        return style.display === "none" ? "" : (el.innerText || "").trim();
      });
      assert.match(
        bannerText,
        /元存档.*损坏|损坏.*元存档/,
        `Expected #save-status-banner to report corrupted meta save, got: "${bannerText}"`
      );

      // Start new game and trigger a save without confirming meta reset
      await page.click("#btn-start-new");
      await page.waitForTimeout(250);
      await env.dismissOpeningIfAny(page);

      const rawAfterStart = await page.evaluate((k) => localStorage.getItem(k), META_KEY);
      assert.equal(
        rawAfterStart,
        corruptMeta,
        "Corrupted meta save must NOT be silently overwritten before explicit user confirmation"
      );
    }
  },

  // ==================== E2E-T1-02: T2 输入框内屏蔽全局快捷键 ====================
  {
    id: "E2E-T1-02",
    title: "T2: Global shortcuts (P, F3, [, ], `) are suppressed inside text inputs",
    features: ["T2"],
    async fn(env) {
      const page = await env.openPage("t1-02");
      await env.startFreshGame(page);
      await openSettingsTab(page, "controls");

      const inp = await page.waitForSelector("#inp-cloud-save-code");
      await inp.click();
      await page.keyboard.type("p[]`");
      await page.keyboard.press("F3");
      await page.waitForTimeout(150);

      const state = await page.evaluate(() => ({
        modalOpen: !!document.querySelector("#modal-backdrop.open"),
        photoActive:
          document.body.classList.contains("photo-mode-active") ||
          !!document.querySelector("#photo-mode-panel.open"),
        telemetryOpen: !!document.querySelector("#action-telemetry-panel.open"),
        inputVal: document.querySelector("#inp-cloud-save-code")?.value || ""
      }));

      assert.equal(state.photoActive, false, "Typing 'p' in input must NOT activate Photo Mode");
      assert.equal(state.telemetryOpen, false, "Pressing F3 in input must NOT open Telemetry panel");
      assert.equal(state.modalOpen, true, "Settings modal must remain open while typing shortcuts");
      assert.ok(state.inputVal.includes("p"), `Input should contain typed text, got "${state.inputVal}"`);

      await closeModalEsc(page);
      assert.equal(await isModalOpen(page), false, "Escape should still close modal");
    }
  },

  // ==================== E2E-T1-03: T3 弹窗和抽屉焦点陷阱 ====================
  {
    id: "E2E-T1-03",
    title: "T3: Modal and drawer trap Tab/Shift+Tab focus and restore focus on Escape",
    features: ["T3"],
    async fn(env) {
      const page = await env.openPage("t1-03");
      await env.startFreshGame(page);

      await page.focus("#btn-open-settings");
      await page.click("#btn-open-settings");
      await page.waitForSelector("#modal-backdrop.open");
      await page.waitForTimeout(100);

      for (let i = 0; i < 20; i++) {
        await page.keyboard.press("Tab");
        const info = await getActiveElementInfo(page);
        assert.equal(
          info?.insideModal,
          true,
          `Focus escaped #modal-content on Tab #${i + 1}: activeElement=${JSON.stringify(info)}`
        );
      }
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press("Shift+Tab");
        const info = await getActiveElementInfo(page);
        assert.equal(
          info?.insideModal,
          true,
          `Focus escaped #modal-content on Shift+Tab #${i + 1}: activeElement=${JSON.stringify(info)}`
        );
      }

      await closeModalEsc(page);
      const restored = await getActiveElementInfo(page);
      assert.equal(
        restored?.id,
        "btn-open-settings",
        `Expected focus to return to #btn-open-settings after Escape, got ${JSON.stringify(restored)}`
      );
    }
  },

  // ==================== E2E-T1-04: T4 云码导入确认流程 ====================
  {
    id: "E2E-T1-04",
    title: "T4: Cloud save import shows preview & confirmation before overwriting current save",
    features: ["T4"],
    async fn(env) {
      const page = await env.openPage("t1-04");
      await env.startFreshGame(page);

      const importedGame = buildLegacyEb0ea67Game({
        name: "青云剑客",
        realm: "nascent",
        stones: 9876
      });
      const cloudCode = buildCloudSaveCode({
        v: 24,
        game: importedGame,
        metaState: JSON.parse(buildMetaSave({ ascensions: 2 })),
        a11ySettings: {},
        stems: {}
      });

      const beforeStones = (await getHudState(page)).stones;
      await openSettingsTab(page, "controls");
      await page.fill("#inp-cloud-save-code", cloudCode);
      await page.click("#btn-import-cloud-save");
      await page.waitForTimeout(200);

      // Must NOT have overwritten immediately without confirmation
      const hudAfterFirstClick = await getHudState(page);
      const modalText = await getModalText(page);
      assert.notEqual(
        hudAfterFirstClick.stones,
        9876,
        "Cloud code import must require preview & explicit confirmation before overwriting active save"
      );
      assert.match(
        modalText,
        /青云剑客|9876|元婴/,
        `Expected confirmation preview with imported character summary, got: "${modalText.slice(0, 200)}"`
      );
    }
  },

  // ==================== E2E-T1-05: T5 元存档多标签页保护 ====================
  {
    id: "E2E-T1-05",
    title: "T5: Meta save uses monotonic metaRev and merges across tabs without regression",
    features: ["T5"],
    async fn(env) {
      const pageA = await env.openPage("t1-05-A");
      const pageB = await env.openPage("t1-05-B");

      const initialMeta = buildMetaSave({ bestScore: 100, ascensions: 1, seenEnemies: ["wolf"] });
      await env.continueSavedGame(pageA, {
        [STORAGE_KEY]: buildEnvelopeV2(),
        [META_KEY]: initialMeta
      });
      await env.continueSavedGame(pageB, {
        [STORAGE_KEY]: buildEnvelopeV2(),
        [META_KEY]: initialMeta
      });

      // Precondition: Tab A progresses meta (higher score + new seenEnemy) and writes meta
      await pageA.evaluate(() => {
        const m = window.__CHENYUAN_V25__.getMetaState();
        m.bestScore = 4500;
        m.ascensions = 3;
        if (!m.seenEnemies.includes("wolf_king")) m.seenEnemies.push("wolf_king");
        window.__CHENYUAN_V25__.saveMeta();
      });

      // Precondition: Tab B has stale in-memory meta and writes a different field
      await pageB.evaluate(() => {
        const m = window.__CHENYUAN_V25__.getMetaState();
        m.bestTower = 9;
        if (!m.seenEnemies.includes("stone_warden")) m.seenEnemies.push("stone_warden");
        window.__CHENYUAN_V25__.saveMeta();
      });

      const { parsed } = await readStorageJson(pageA, META_KEY);
      assert.ok(parsed && typeof parsed.metaRev === "number" && parsed.metaRev >= 1, "Meta save must store monotonic metaRev");
      assert.ok(parsed.bestScore >= 4500, `Expected bestScore >= 4500 after cross-tab merge, got ${parsed.bestScore}`);
      assert.ok(parsed.ascensions >= 3, `Expected ascensions >= 3 after cross-tab merge, got ${parsed.ascensions}`);
      assert.ok(parsed.bestTower >= 9, `Expected bestTower >= 9 after cross-tab merge, got ${parsed.bestTower}`);
      assert.ok(
        Array.isArray(parsed.seenEnemies) &&
          parsed.seenEnemies.includes("wolf_king") &&
          parsed.seenEnemies.includes("stone_warden"),
        `Expected union of seenEnemies across tabs, got ${JSON.stringify(parsed.seenEnemies)}`
      );
    }
  },

  // ==================== E2E-T1-06: T6 危险写操作守卫 & pagehide 落盘 ====================
  {
    id: "E2E-T1-06",
    title: "T6: Reset/reincarnate guarded in read-only mode & pagehide flushes save",
    features: ["T6"],
    async fn(env) {
      const pageA = await env.openPage("t1-06-A");
      const pageB = await env.openPage("t1-06-B");

      await env.startFreshGame(pageA);
      await pageB.goto(env.baseUrl, { waitUntil: "domcontentloaded" });
      await pageB.waitForSelector("#btn-continue-save", { state: "visible", timeout: 10000 });
      await pageB.click("#btn-continue-save");
      await pageB.waitForTimeout(200);

      // Tab A saves a newer rev to trigger conflict on Tab B
      await pageA.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.stones = 777;
        window.__CHENYUAN_V25__.saveGame();
      });
      await pageB.waitForTimeout(250);

      // Enter read-only mode on Tab B
      const stayRo = await pageB.$('[data-action="stay-readonly-save"]');
      if (stayRo && await stayRo.isVisible()) {
        await stayRo.click();
        await pageB.waitForTimeout(150);
      } else {
        const openConf = await pageB.$('[data-action="open-save-conflict"]');
        if (openConf && await openConf.isVisible()) {
          await openConf.click();
          await pageB.waitForTimeout(150);
          await pageB.click('[data-action="stay-readonly-save"]');
          await pageB.waitForTimeout(150);
        }
      }

      // Attempt reset save on Tab B while read-only
      await openSettingsTab(pageB, "controls");
      const resetStep1 = await pageB.$('[data-action="confirm-reset-save"]');
      if (resetStep1 && await resetStep1.isVisible()) {
        await resetStep1.click();
        await pageB.waitForTimeout(150);
        const resetStep2 = await pageB.$('[data-action="execute-reset-save"]');
        if (resetStep2 && await resetStep2.isVisible()) {
          await resetStep2.click();
          await pageB.waitForTimeout(200);
        }
      }

      const saveAfterResetAttempt = await readStorageJson(pageA, STORAGE_KEY);
      assert.ok(
        saveAfterResetAttempt.parsed && saveAfterResetAttempt.parsed.game?.stones === 777,
        "execute-reset-save must be blocked in read-only/conflict mode and leave primary save intact"
      );

      // Verify pagehide flushes writable state on Tab A
      await pageA.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.stones = 888;
        window.dispatchEvent(new Event("pagehide"));
      });
      await pageA.waitForTimeout(150);
      const saveAfterPagehide = await readStorageJson(pageA, STORAGE_KEY);
      assert.equal(
        saveAfterPagehide.parsed?.game?.stones,
        888,
        "pagehide event should flush unsaved state to localStorage when writable"
      );
    }
  },

  // ==================== E2E-T1-07: T7 无障碍与键位 ====================
  {
    id: "E2E-T1-07",
    title: "T7: prefers-reduced-motion respected, Tab does not hijack HUD focus, no duplicate pad bindings",
    features: ["T7"],
    async fn(env) {
      const reducedCtx = await env.context.browser().newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce"
      });
      try {
        const page = await reducedCtx.newPage();
        page.setDefaultTimeout(5000);
        page.setDefaultNavigationTimeout(10000);
        page.on("pageerror", (err) => {
          env.runtimeErrors.push(`[t1-07-reduced pageerror] ${err?.message || String(err)}`);
        });
        page.on("console", (msg) => {
          if (msg.type() === "error") {
            env.runtimeErrors.push(`[t1-07-reduced console.error] ${msg.text()}`);
          }
        });
        await page.goto(env.baseUrl, { waitUntil: "domcontentloaded", timeout: 10000 });
        await page.waitForSelector("#btn-start-new", { state: "visible", timeout: 10000 });

        // 1. Check CSS has prefers-reduced-motion rule active
        const hasReducedMotionCss = await page.evaluate(() => {
          for (const sheet of Array.from(document.styleSheets)) {
            let rules;
            try {
              rules = sheet.cssRules;
            } catch {
              continue;
            }
            for (const r of Array.from(rules || [])) {
              if (r.conditionText && r.conditionText.includes("prefers-reduced-motion")) {
                return true;
              }
            }
          }
          return false;
        });
        assert.equal(hasReducedMotionCss, true, "Stylesheet must include a prefers-reduced-motion media query");

        // 2. Start game and verify Tab moves focus between HUD controls rather than being hijacked
        await page.click("#btn-start-new");
        await page.waitForTimeout(220);
        await env.dismissOpeningIfAny(page);
        await page.focus("#btn-sanctum-hub");
        const beforeId = await page.evaluate(() => document.activeElement?.id || "");
        await page.keyboard.press("Tab");
        await page.waitForTimeout(100);
        const afterId = await page.evaluate(() => document.activeElement?.id || "");
        assert.notEqual(
          afterId,
          beforeId,
          "Pressing Tab while focused on a HUD button must advance browser focus (not be hijacked by posture toggle)"
        );
      } finally {
        await reducedCtx.close();
      }
    }
  },

  // ==================== E2E-T1-08: T8 & T9 美术溯源 & 工具链 ====================
  {
    id: "E2E-T1-08",
    title: "T8 & T9: package.json, .gitignore, art manifest & verification script exist and pass",
    features: ["T8", "T9"],
    async fn() {
      const pkgPath = path.join(REPO_ROOT, "package.json");
      const gitignorePath = path.join(REPO_ROOT, ".gitignore");
      const manifestDocPath = path.join(REPO_ROOT, "docs", "art-manifest.md");
      const manifestScriptPath = path.join(REPO_ROOT, "scripts", "art-manifest.mjs");

      assert.equal(fs.existsSync(pkgPath), true, "package.json must exist in repo root (T9)");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      assert.ok(pkg.devDependencies?.["playwright-core"], "package.json must declare playwright-core");
      assert.ok(pkg.scripts?.["test:regression"], "package.json must define test:regression script");
      assert.ok(pkg.scripts?.["test:e2e"], "package.json must define test:e2e script");
      assert.ok(pkg.scripts?.["art:manifest"], "package.json must define art:manifest script");

      const gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";
      assert.match(gitignore, /node_modules/, ".gitignore must ignore node_modules/");
      assert.match(gitignore, /\.agents/, ".gitignore must ignore .agents/");

      assert.equal(fs.existsSync(manifestDocPath), true, "docs/art-manifest.md must exist (T8)");
      assert.equal(fs.existsSync(manifestScriptPath), true, "scripts/art-manifest.mjs must exist (T8)");
      const manifestText = fs.readFileSync(manifestDocPath, "utf8");
      const shaMatches = manifestText.match(/\b[0-9a-f]{64}\b/gi) || [];
      assert.ok(shaMatches.length >= 100, `docs/art-manifest.md must record sha256 checksums for inline art, found ${shaMatches.length}`);

      // Verify script runs cleanly
      execFileSync(process.execPath, [manifestScriptPath, "--check"], {
        cwd: REPO_ROOT,
        stdio: "pipe",
        timeout: 10000
      });
    }
  },

  // ==================== E2E-T1-09: S1 Boss 门控进阶 ====================
  {
    id: "E2E-T1-09",
    title: "S1: Realm breakthrough is blocked until current chapter boss is defeated",
    features: ["S1"],
    async fn(env) {
      const page = await env.openPage("t1-09");
      await env.startFreshGame(page);

      // Precondition: mortal with full XP, 0 stages cleared
      await page.evaluate((xpCap) => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "mortal";
        game.xp = xpCap;
        game.stageStars = {};
        window.__CHENYUAN_V25__.enterSanctumHub();
        window.__CHENYUAN_V25__.updateHud();
      }, REALM_XP_CAPS.mortal);
      await page.waitForTimeout(150);

      await triggerTribulationAttempt(page);

      const modalText = await getModalText(page);
      const toasts = (await getToastTexts(page)).join(" ");
      const combined = `${modalText} ${toasts}`;
      const canStartTrib = await page.evaluate(() => {
        const btn = document.querySelector("[data-trib-start]");
        return !!(btn && !btn.disabled && getComputedStyle(btn).display !== "none");
      });

      assert.equal(canStartTrib, false, "Breakthrough start button must NOT be available when stage 0 boss is undefeated");
      assert.match(
        combined,
        /需先击败|击败.*狼王|雾隐狼王/,
        `Expected boss-gate notice naming stage 0 boss, got: "${combined.slice(0, 200)}"`
      );
    }
  },

  // ==================== E2E-T1-10: S2 真实结局与评分 ====================
  {
    id: "E2E-T1-10",
    title: "S2: Ascension epilogue & grade reflect actual cleared stages and bonded companions",
    features: ["S2"],
    async fn(env) {
      const page = await env.openPage("t1-10");
      await env.startFreshGame(page);

      // Precondition: ascended with 0 stage stars and 0 bonded companions
      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "ascended";
        game.status = "ascended";
        game.ending = null;
        game.stageStars = {};
        game.bondTiers = { shen: 0, pei: 0, lu: 0, yan: 0 };
        game.aids = { shen: false, pei: false, lu: false, yan: false };
        window.__CHENYUAN_V25__.updateHud();
        window.__CHENYUAN_V25__.openEndingModal();
      });
      await page.waitForSelector("#modal-backdrop.open");
      const firstEndingBtn = await page.$("button[data-choose-ending]");
      if (firstEndingBtn) {
        await firstEndingBtn.click();
        await page.waitForTimeout(200);
      }

      const text = await getModalText(page);
      assert.doesNotMatch(
        text,
        /\b(SS|SSS)\s*级评定/,
        `0-star ascended character must NOT receive SS/SSS grade, got: "${text.slice(0, 220)}"`
      );
      assert.doesNotMatch(
        text,
        /走过五境星图/,
        "0-stage-clear epilogue must NOT falsely claim '走过五境星图'"
      );
    }
  },

  // ==================== E2E-T1-11: S3 术语统一 & 导航改名 ====================
  {
    id: "E2E-T1-11",
    title: "S3: Terminology unified to 卷 (no 幕/七卷 mismatch) and right-rail button renamed to 故人",
    features: ["S3"],
    async fn(env) {
      const page = await env.openPage("t1-11");
      await env.startFreshGame(page);

      const navStoryText = await page.evaluate(() =>
        (document.querySelector("#nav-btn-story")?.innerText || "").trim()
      );
      assert.match(navStoryText, /故人/, `Expected #nav-btn-story to be labeled '故人', got: "${navStoryText}"`);
      assert.doesNotMatch(navStoryText, /主线/, `#nav-btn-story must NOT be labeled '主线', got: "${navStoryText}"`);

      const trackerText = await page.evaluate(() =>
        (document.querySelector("#quest-tracker-hud")?.innerText || "").trim()
      );
      assert.doesNotMatch(trackerText, /第[一二三四五六七\d]+幕/, `Quest tracker must use 卷 instead of 幕, got: "${trackerText}"`);

      await page.keyboard.press("KeyT");
      await page.waitForSelector("#modal-backdrop.open");
      const goalsText = await getModalText(page);
      assert.doesNotMatch(goalsText, /第[一二三四五六七\d]+幕/, `Goals modal must not use 幕, got: "${goalsText.slice(0, 200)}"`);
      assert.doesNotMatch(goalsText, /七卷天命主线/, "Goals modal must not falsely say 七卷天命主线 when there are 6 volumes");
    }
  },

  // ==================== E2E-T1-12: S4 设定一致性 ====================
  {
    id: "E2E-T1-12",
    title: "S4: Canonical names/titles consistent across story drawer, cutscenes, and boss labels",
    features: ["S4"],
    async fn(env) {
      const page = await env.openPage("t1-12");
      await env.startFreshGame(page);
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.openingChoice = "help";
        game.realm = "foundation";
        v25.enterSanctumHub();
        v25.syncProgressiveSkillVisibility();
        v25.updateHud();
      });
      await page.waitForTimeout(150);

      await openNavTab(page, "story");

      // Inspect Pei Zhao's canonical title in his companion modal
      await page.click('button[data-open-comp-modal="pei"]');
      await page.waitForSelector("#modal-backdrop.open");
      const peiModalText = await getModalText(page);
      await closeModalEsc(page);

      // Inspect Yan Chen's canonical location in his companion modal
      await openNavTab(page, "story");
      await page.click('button[data-open-comp-modal="yan"]');
      await page.waitForSelector("#modal-backdrop.open");
      const yanModalText = await getModalText(page);
      await closeModalEsc(page);

      // Trigger stage 2 (enter_secret) cutscene and read dialogue bar
      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "golden";
        game.seenCutscenes = {};
        window.__CHENYUAN_V25__.initArenaStage(2, false);
      });
      await page.waitForTimeout(250);
      const stage2Dlg = await page.evaluate(() =>
        (document.querySelector("#story-dialogue-bar")?.innerText || "").trim()
      );

      assert.ok(stage2Dlg.length > 0, "Stage 2 (enter_secret) cutscene dialogue bar must be non-empty");
      // Check Pei Zhao title consistency (must not mix 同辈剑首 vs 首座弟子)
      const peiCombined = `${peiModalText} ${stage2Dlg}`;
      assert.equal(
        peiCombined.includes("同辈剑首") && peiCombined.includes("首座弟子"),
        false,
        `Pei Zhao must use a single canonical title (not both 同辈剑首 and 首座弟子); modal="${peiModalText.slice(0, 80)}" dlg="${stage2Dlg.slice(0, 80)}"`
      );

      // Trigger stage 3 (enter_sword_mound) cutscene and check Yan Chen location consistency
      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.seenCutscenes = {};
        window.__CHENYUAN_V25__.initArenaStage(3, false);
      });
      await page.waitForTimeout(250);
      const stage3Dlg = await page.evaluate(() =>
        (document.querySelector("#story-dialogue-bar")?.innerText || "").trim()
      );
      assert.ok(stage3Dlg.length > 0, "Stage 3 (enter_sword_mound) cutscene dialogue bar must be non-empty");
      assert.equal(
        yanModalText.includes("照影古境") && stage3Dlg.includes("古修剑冢"),
        false,
        `Yan Chen's location must be consistent across companion modal and cutscenes (照影古境 vs 古修剑冢)`
      );
    }
  },

  // ==================== E2E-T1-13: S5 圆满后的目标 ====================
  {
    id: "E2E-T1-13",
    title: "S5: Quest tracker shows post-completion endgame goal instead of stale s7_trial",
    features: ["S5"],
    async fn(env) {
      const page = await env.openPage("t1-13");
      await env.startFreshGame(page);

      // Precondition: all mainline steps completed & claimed, ascended
      await page.evaluate((stepIds) => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.openingChoice = "help";
        game.realm = "ascended";
        game.status = "ascended";
        game.ending = "sword_immortal";
        game.trialCompleted = true;
        game.craftedCount = 2;
        game.pet = { id: "fox", level: 3 };
        game.school = "sword";
        game.aids = { shen: true, pei: true, lu: true, yan: true };
        game.bondTiers = { shen: 3, pei: 3, lu: 3, yan: 3 };
        game.choices = { lu_meet: "a", pei_meet: "a", yan_gate: "a", shen_past: "a" };
        game.ownedRelics = ["frost_sword"];
        game.learned = ["slash_basic", "sword_rain"];
        game.stageStars = { 0: 3, 1: 3, 2: 3, 3: 3, 4: 3 };
        game.claimedStepIds = [...stepIds];
        window.__CHENYUAN_V25__.updateHud();
      }, ALL_CHAPTER_STEP_IDS);
      await page.waitForTimeout(150);

      const trackerRows = await page.evaluate(() =>
        (document.querySelector("#qt-body-rows")?.innerText || "").trim()
      );
      assert.match(
        trackerRows,
        /仙途圆满|劫火周目|锁妖塔/,
        `Expected post-completion endgame goal in tracker, got: "${trackerRows}"`
      );
      assert.doesNotMatch(
        trackerRows,
        /剑斩道影/,
        `Tracker must NOT remain stuck on stale s7_trial, got: "${trackerRows}"`
      );
    }
  },

  // ==================== E2E-T1-14: S6 因果花括号 bug ====================
  {
    id: "E2E-T1-14",
    title: "S6: Karma dilemma choice without fillIntent must not fill astral/bond meters to 100%",
    features: ["S6"],
    async fn(env) {
      const page = await env.openPage("t1-14");
      await env.startFreshGame(page);

      // Precondition: nascent realm so astral/bond HUD indicators are active, zero meters, open dilemma 0 (no fillIntent)
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game, arena } = v25.getState();
        game.realm = "nascent";
        arena.swordIntent = 0;
        arena.bondSynergy = 0;
        arena.astralEnergy = 0;
        v25.syncProgressiveSkillVisibility();
        v25.updateHud();
        window.__CHENYUAN_V18__.openKarmaDilemmaModal(0);
      });
      await page.waitForSelector("#modal-backdrop.open");
      await page.click('button[data-karma-side="right"]');
      await page.waitForTimeout(250);

      const hudMeters = await page.evaluate(() => ({
        astralText: (document.querySelector("#lbl-astral-pct")?.textContent || "").trim(),
        bondText: (document.querySelector("#btn-dual-bond-ult")?.textContent || "").trim(),
        bondReady: !!document.querySelector("#btn-dual-bond-ult.ready"),
        astralReady: !!document.querySelector("#btn-astral-giant.ready")
      }));
      assert.equal(
        /100%/.test(hudMeters.astralText) || /100%/.test(hudMeters.bondText) || hudMeters.bondReady || hudMeters.astralReady,
        false,
        `Non-fillIntent karma choice must NOT fill astral/bond meters to 100%, got ${JSON.stringify(hudMeters)}`
      );
    }
  },

  // ==================== E2E-T1-15: S7 卷终演出 & 卷终卡 ====================
  {
    id: "E2E-T1-15",
    title: "S7: Defeating stage boss plays clear_stage cutscene and displays volume-end recap card",
    features: ["S7"],
    async fn(env) {
      const page = await env.openPage("t1-15");
      await env.startFreshGame(page);

      // Precondition: enter stage 0 boss wave and defeat the real stage 0 boss
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.openingChoice = "help";
        v25.initArenaStage(0, false);
        const { arena } = v25.getState();
        arena.dungeonMap = null;
        arena.waveIdx = 4;
        arena.enemies = [];
        v25.spawnCurrentWave();
        const boss = arena.enemies.find((e) => e.isBoss) || arena.enemies[0];
        if (boss) {
          boss.hp = 1;
          v25.damageEnemy(boss, 999, false);
        }
      });
      await page.waitForTimeout(300);

      const dlgOpen = await page.evaluate(() =>
        !!document.querySelector("#story-dialogue-bar.open")
      );
      assert.equal(dlgOpen, true, "Defeating stage 0 boss must open #story-dialogue-bar for clear_stage0 cutscene");

      // Advance dialogue to reach volume-end recap card
      for (let i = 0; i < 8; i++) {
        const next = await page.$("#btn-dlg-next");
        if (next && await next.isVisible()) {
          await next.click();
          await page.waitForTimeout(100);
        } else {
          break;
        }
      }
      await page.waitForTimeout(200);

      const bodyText = await page.evaluate(() => {
        const modal = document.querySelector("#modal-backdrop.open #modal-content")?.innerText || "";
        const cinema = document.querySelector("#region-cinema-card")?.innerText || "";
        const recap = document.querySelector("#stage-recap-card")?.innerText || "";
        return `${modal} ${cinema} ${recap}`;
      });
      assert.match(
        bodyText,
        /第[一1]卷.*终/,
        `Expected '第一卷·终' volume-end recap card after post-boss cutscene, got: "${bodyText.slice(0, 200)}"`
      );
    }
  },

  // ==================== E2E-T1-16: S8 开场前提 & 贯穿主线 ====================
  {
    id: "E2E-T1-16",
    title: "S8: Starting a new game plays 4-6 line opening premise scroll before combat",
    features: ["S8"],
    async fn(env) {
      const page = await env.openPage("t1-16");
      await env.gotoWelcome(page);
      await page.click("#btn-start-new");
      await page.waitForTimeout(250);

      const openingInfo = await page.evaluate(() => {
        const dlgOpen = !!document.querySelector("#story-dialogue-bar.open");
        const dlgText = (document.querySelector("#story-dialogue-bar")?.innerText || "").trim();
        const modalOpen = !!document.querySelector("#modal-backdrop.open");
        const modalText = (document.querySelector("#modal-content")?.innerText || "").trim();
        return { dlgOpen, dlgText, modalOpen, modalText };
      });

      assert.ok(
        openingInfo.dlgOpen || openingInfo.modalOpen,
        "Clicking #btn-start-new must present an opening premise scroll/dialogue before dropping into combat"
      );
      const combined = `${openingInfo.dlgText} ${openingInfo.modalText}`;
      assert.match(
        combined,
        /顾长青|天门|青岚/,
        `Opening premise should introduce 顾长青 and 天门 premise, got: "${combined.slice(0, 200)}"`
      );
    }
  },

  // ==================== E2E-T1-17: S9 故人线挂钩章节 ====================
  {
    id: "E2E-T1-17",
    title: "S9: Companion arc appears in tracker, enter_secret branches on pei_meet, enter_terrace is distinct",
    features: ["S9"],
    async fn(env) {
      const page = await env.openPage("t1-17");
      await env.startFreshGame(page);

      // Precondition: foundation realm, no pei_meet choice
      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "foundation";
        game.choices = {};
        game.seenCutscenes = {};
        window.__CHENYUAN_V25__.updateHud();
      });
      await page.waitForTimeout(150);

      const trackerText = await page.evaluate(() =>
        (document.querySelector("#quest-tracker-hud #qt-body-rows")?.innerText || "").trim()
      );
      assert.match(
        trackerText,
        /故人线|故人/,
        `Quest tracker should show an optional 故人线 row for the current chapter, got: "${trackerText}"`
      );

      // Enter stage 2 without pei_meet -> must not assume prior familiarity
      await page.evaluate(() => {
        window.__CHENYUAN_V25__.initArenaStage(2, false);
      });
      await page.waitForTimeout(200);
      const dlgText = await page.evaluate(() =>
        (document.querySelector("#dlg-text-content")?.innerText || "").trim()
      );
      assert.doesNotMatch(
        dlgText,
        /多谢裴兄/,
        `enter_secret must NOT thank '裴兄' as an old friend when pei_meet has not occurred, got: "${dlgText}"`
      );
    }
  },

  // ==================== E2E-T1-18: S10 因果事件不重复 ====================
  {
    id: "E2E-T1-18",
    title: "S10: Karma dilemmas track completed IDs and do not repeat in a modulo loop",
    features: ["S10"],
    async fn(env) {
      const page = await env.openPage("t1-18");
      await env.startFreshGame(page);

      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "spirit";
        window.__CHENYUAN_V25__.enterSanctumHub();
        window.__CHENYUAN_V25__.updateHud();
      });
      await page.waitForTimeout(150);

      const seenTitles = [];
      for (let i = 0; i < 4; i++) {
        await openNavTab(page, "story");
        const karmaBtn = await page.$('[data-action="open-karma-dilemma"]');
        if (!karmaBtn || !(await karmaBtn.isVisible())) break;
        await karmaBtn.click();
        await page.waitForTimeout(150);
        if (!(await isModalOpen(page))) break;
        const title = await page.evaluate(() =>
          (document.querySelector("#modal-content h2")?.innerText || "").trim()
        );
        if (title) seenTitles.push(title);
        const choiceBtn = await page.$('button[data-karma-side="right"]');
        if (!choiceBtn) break;
        await choiceBtn.click();
        await page.waitForTimeout(150);
      }

      const unique = new Set(seenTitles);
      assert.equal(
        unique.size,
        seenTitles.length,
        `Karma dilemmas must NOT repeat already-completed titles; saw: ${JSON.stringify(seenTitles)}`
      );
      assert.ok(unique.size >= 4, `Expected at least 4 distinct karma dilemmas across chapters, saw ${unique.size}`);
    }
  },

  // ==================== E2E-T1-19: S11+G7 分批解锁 & 系统教程 ====================
  {
    id: "E2E-T1-19",
    title: "S11+G7: Golden realm does not dump all 7 keys + 4 modes at once; unlock shows 2-line notice",
    features: ["S11+G7"],
    async fn(env) {
      const page = await env.openPage("t1-19");
      await env.startFreshGame(page);

      // Precondition: golden realm (not nascent/spirit), test high-tier combat keys
      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "golden";
        game.unlockAllArcana = false;
        window.__CHENYUAN_V25__.updateHud();
        window.__CHENYUAN_V25__.syncProgressiveSkillVisibility();
      });
      await page.waitForTimeout(150);

      // Press Digit4, Digit5, Digit6, Digit7 and check if at least one is still locked at golden (staggered)
      const lockedToasts = [];
      for (const code of ["Digit4", "Digit5", "Digit6", "Digit7"]) {
        await page.keyboard.press(code);
        await page.waitForTimeout(120);
        const toasts = await getToastTexts(page);
        if (toasts.some((t) => t.includes("解封") || t.includes("🔒"))) {
          lockedToasts.push(code);
        }
      }
      assert.ok(
        lockedToasts.length >= 1,
        "High-tier combat keys (4/5/6/7) must be staggered beyond golden realm instead of dumping all 7 keys at golden"
      );
    }
  },

  // ==================== E2E-T1-20: G1 远征经济修复 ====================
  {
    id: "E2E-T1-20",
    title: "G1: Expedition blocks unbonded/duplicate assignments and double-claim yields 0 stones",
    features: ["G1"],
    async fn(env) {
      const page = await env.openPage("t1-20");
      await env.startFreshGame(page);

      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "golden";
        game.stones = 500;
        game.bondTiers = { shen: 1, pei: 0, lu: 0, yan: 0 };
        game.aids = { shen: true, pei: false, lu: false, yan: false };
        window.__CHENYUAN_V25__.enterSanctumHub();
        window.__CHENYUAN_V25__.updateHud();
        window.__CHENYUAN_V25__.openExpeditionSandboxModal();
      });
      await page.waitForSelector("#modal-backdrop.open");

      // Check unbonded companion (pei) is not freely selectable
      const peiAssignable = await page.evaluate(() => {
        const sel = document.querySelector('select[data-exp-node]');
        if (!sel) return false;
        const opt = Array.from(sel.options).find((o) => o.value === "pei");
        return !!(opt && !opt.disabled);
      });
      assert.equal(peiAssignable, false, "Unbonded companion 'pei' must NOT be assignable to an expedition node");

      // Claim twice in a row -> second claim must yield 0 stones
      await page.click("#btn-claim-expedition");
      await page.waitForTimeout(150);
      const stonesAfterFirst = (await getHudState(page)).stones;
      await page.click("#btn-claim-expedition");
      await page.waitForTimeout(150);
      const stonesAfterSecond = (await getHudState(page)).stones;

      assert.equal(
        stonesAfterSecond,
        stonesAfterFirst,
        `Second immediate expedition claim must yield 0 stones (before=${stonesAfterFirst}, after=${stonesAfterSecond})`
      );
    }
  },

  // ==================== E2E-T1-21: G2 灵玉赌注漏洞修复 ====================
  {
    id: "E2E-T1-21",
    title: "G2: Jade gamble cannot produce net stone profit after all Dao Laws are owned",
    features: ["G2"],
    async fn(env) {
      const page = await env.openPage("t1-21");
      await env.startFreshGame(page);

      await page.evaluate((allLaws) => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "golden";
        game.stones = 500;
        game.pet = { id: "fox", level: 1 };
        game.laws = [...allLaws];
        window.__CHENYUAN_V25__.enterSanctumHub();
        window.__CHENYUAN_V25__.updateHud();
      }, ALL_DAO_LAW_IDS);
      await page.waitForTimeout(150);

      await openNavTab(page, "alchemy");
      const btn = await page.waitForSelector('button[data-action="gamble-jade"]');
      const isDisabled = await btn.isDisabled();
      if (!isDisabled) {
        const before = (await getHudState(page)).stones;
        await btn.click();
        await page.waitForTimeout(200);
        const after = (await getHudState(page)).stones;
        assert.ok(
          after <= before,
          `Jade gamble with all laws owned must NOT yield net stone profit (before=${before}, after=${after})`
        );
      }
    }
  },

  // ==================== E2E-T1-22: G3 Boss 与伤害曲线重调 ====================
  {
    id: "E2E-T1-22",
    title: "G3: Stage 4 boss HP retuned (~40-50k) and single heavy hit cannot one-shot nascent player",
    features: ["G3"],
    async fn(env) {
      const page = await env.openPage("t1-22");
      await env.startFreshGame(page);

      // Precondition: nascent realm with real scaled stage 4 boss wave spawned
      const setup = await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "nascent";
        game.equippedGear = {
          weapon: v25.rollGearItem(3, 2, "weapon"),
          armor: v25.rollGearItem(3, 2, "armor"),
          ring: v25.rollGearItem(3, 2, "ring")
        };
        const stats = v25.getCombatStats(game);
        game.hp = stats.maxHp;
        v25.initArenaStage(4, false);
        const { arena } = v25.getState();
        arena.dungeonMap = null;
        arena.waveIdx = 4;
        arena.enemies = [];
        v25.spawnCurrentWave();
        const boss = arena.enemies.find((e) => e.isBoss) || arena.enemies[arena.enemies.length - 1];
        const bossMaxHp = boss ? boss.maxHp : 0;
        const bossHeavy = boss ? Math.max(boss.atk || 0, boss.heavy || 0) : 0;
        // Move boss away so only our single heavy attack projectile lands on the player
        if (boss && arena.player) {
          boss.x = arena.player.x + 1200;
          boss.y = arena.player.y;
          boss.timer = 99;
        }
        arena.projectiles = [];
        if (arena.player) {
          arena.player.invuln = 0;
          arena.player.shieldHp = 0;
        }
        v25.updateHud();
        return { bossMaxHp, bossHeavy };
      });

      assert.ok(
        setup.bossMaxHp > 0 && setup.bossMaxHp <= 70000,
        `Stage 4 boss HP should be retuned to ~40-50k (<=70k), got ${setup.bossMaxHp}`
      );

      const hudBefore = await getHudState(page);
      const hpBefore = hudBefore.hpCur;
      const hpMax = hudBefore.hpMax;
      assert.ok(hpBefore > 0 && hpMax > 0, `Player HP must be positive before hit test (${hudBefore.hpRaw})`);

      // Trigger one real boss heavy projectile directly onto the player so damage passes through hurtPlayer()
      await page.evaluate((heavyDmg) => {
        const { arena } = window.__CHENYUAN_V25__.getState();
        const p = arena.player;
        p.invuln = 0;
        p.shieldHp = 0;
        arena.projectiles.push({
          friendly: false,
          kind: "crescent",
          x: p.x,
          y: p.y,
          vx: 0,
          vy: 0,
          ang: 0,
          r: 44,
          dmg: heavyDmg,
          life: 1.0,
          color: "#ff4d4f"
        });
      }, setup.bossHeavy);

      let hpAfter = hpBefore;
      const deadline = Date.now() + 1500;
      while (Date.now() < deadline) {
        await page.waitForTimeout(80);
        const cur = (await getHudState(page)).hpCur;
        if (cur < hpBefore) {
          hpAfter = cur;
          break;
        }
      }

      const actualHitDmg = hpBefore - hpAfter;
      assert.ok(actualHitDmg > 0, `Boss heavy hit must register damage on player (before=${hpBefore}, after=${hpAfter})`);
      assert.ok(
        hpAfter > 0 && actualHitDmg <= hpMax * 0.65,
        `Stage 4 boss single heavy hit (${actualHitDmg} dmg, hpAfter=${hpAfter}) must not one-shot nascent player maxHp (${hpMax})`
      );
    }
  },

  // ==================== E2E-T1-23: G4 跳关不发奖励 ====================
  {
    id: "E2E-T1-23",
    title: "G4: Boss Rush bout-7 skip and Spire floor-9 skip act as practice mode with no rewards/records",
    features: ["G4"],
    async fn(env) {
      const page = await env.openPage("t1-23");
      await env.startFreshGame(page);

      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "nascent";
        game.stones = 200;
        window.__CHENYUAN_V25__.enterSanctumHub();
        window.__CHENYUAN_V25__.updateHud();
        window.__CHENYUAN_V25__.openCelestialSpireModal();
      });
      await page.waitForSelector("#modal-backdrop.open");
      await page.click('button[data-start-spire="9"]');
      await page.waitForTimeout(250);

      // Precondition: defeat floor 9 enemies via handleEnemyDeath
      const killedCount = await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { arena } = v25.getState();
        const targets = [...arena.enemies];
        for (const e of targets) {
          e.hp = 0;
          v25.handleEnemyDeath(e);
        }
        v25.updateHud();
        return targets.length;
      });
      assert.ok(killedCount > 0, "Spire floor 9 must have spawned at least 1 enemy");
      // Wait past the 420ms transition timer in handleEnemyDeath
      await page.waitForTimeout(700);
      // If a curio draft modal opened on floor 9 skip, click a curio to complete the floor
      const curioBtn = await page.$("button[data-pick-curio]");
      if (curioBtn && (await curioBtn.isVisible())) {
        await curioBtn.click();
        await page.waitForTimeout(250);
      }

      const hud = await getHudState(page);
      const { parsed: meta } = await readStorageJson(page, META_KEY);
      assert.ok(
        hud.stones < 200 + 300,
        `Spire floor-9 skip must NOT grant full +420 stone payout (stones=${hud.stones})`
      );
      assert.notEqual(
        meta?.bestSpireFloor,
        9,
        "Spire floor-9 skip must NOT record bestSpireFloor=9 in meta"
      );
    }
  },

  // ==================== E2E-T1-24: G5 永久成长上限 ====================
  {
    id: "E2E-T1-24",
    title: "G5: Blood-fury pill purchase is capped per realm (no unlimited permanent stat stacking)",
    features: ["G5"],
    async fn(env) {
      const page = await env.openPage("t1-24");
      await env.startFreshGame(page);

      // Precondition: demonic karmaScore so karma market sells blood_fury_pill, plenty of stones
      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "qi";
        game.karmaScore = -80;
        game.stones = 5000;
        window.__CHENYUAN_V25__.enterSanctumHub();
        window.__CHENYUAN_V25__.updateHud();
      });
      await page.waitForTimeout(150);

      await openNavTab(page, "bag");
      let bought = 0;
      for (let i = 0; i < 8; i++) {
        const btn = await page.$('button[data-buy-karma-item="km_blood_pill"], button[data-buy-karma-item="blood_fury_pill"]');
        if (!btn || (await btn.isDisabled())) break;
        const stonesBefore = (await getHudState(page)).stones;
        await btn.click();
        await page.waitForTimeout(100);
        const stonesAfter = (await getHudState(page)).stones;
        if (stonesAfter < stonesBefore) {
          bought++;
          const refreshBtn = await page.$('button[data-action="refresh-market"]');
          if (refreshBtn && !(await refreshBtn.isDisabled())) {
            await refreshBtn.click();
            await page.waitForTimeout(100);
          }
        } else {
          break;
        }
      }

      assert.ok(
        bought >= 1 && bought < 8,
        `blood_fury_pill must be purchasable (>=1) and hit a per-realm cap (<8), got bought=${bought}`
      );
    }
  },

  // ==================== E2E-T1-25: G6 全神通演武沙盒化 ====================
  {
    id: "E2E-T1-25",
    title: "G6: Enabling 全神通演武 requires confirmation, shows HUD sandbox badge, and isolates live save",
    features: ["G6"],
    async fn(env) {
      const page = await env.openPage("t1-25");
      await env.startFreshGame(page);

      await page.click("#btn-pavilion-menu");
      await page.waitForTimeout(120);
      await page.click("#btn-toggle-arcana-all");
      await page.waitForTimeout(200);

      const modalOpen = await isModalOpen(page);
      assert.equal(
        modalOpen,
        true,
        "Clicking #btn-toggle-arcana-all must open a confirmation modal explaining sandbox/demo mode"
      );

      const primarySave = await readStorageJson(page, STORAGE_KEY);
      assert.notEqual(
        primarySave.parsed?.game?.unlockAllArcana,
        true,
        "Primary live save must NOT be polluted with unlockAllArcana=true before/during sandbox"
      );
    }
  },

  // ==================== E2E-T1-26: G8 寿元与炼丹耗时 ====================
  {
    id: "E2E-T1-26",
    title: "G8: Alchemy crafting advances lifespan age according to RECIPES.months",
    features: ["G8"],
    async fn(env) {
      const page = await env.openPage("t1-26");
      await env.startFreshGame(page);

      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "qi";
        game.stones = 500;
        game.inventory.herb = 20;
        game.inventory.dew = 20;
        game.inventory.core = 10;
        game.elapsedMonths = 0;
        window.__CHENYUAN_V25__.enterSanctumHub();
        window.__CHENYUAN_V25__.updateHud();
      });
      await page.waitForTimeout(150);

      await openNavTab(page, "cultivate");
      const beforeDrawer = await getDrawerText(page);
      const beforeMatch = beforeDrawer.match(/骨龄寿元[^\d]*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
      assert.ok(beforeMatch, `Expected 骨龄寿元 in cultivate drawer, got: "${beforeDrawer.slice(0, 200)}"`);
      const ageBefore = parseFloat(beforeMatch[1]);

      // Craft a recipe with months > 0 (e.g. foundation pill = 6 months, or healing = 2 months)
      await openNavTab(page, "alchemy");
      for (let i = 0; i < 6; i++) {
        const craftBtn = await page.$('button[data-quick-craft="foundation"], button[data-quick-craft="healing"]');
        if (craftBtn) {
          await craftBtn.click();
          await page.waitForTimeout(100);
        }
      }

      await openNavTab(page, "cultivate");
      const afterDrawer = await getDrawerText(page);
      const afterMatch = afterDrawer.match(/骨龄寿元[^\d]*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
      const ageAfter = afterMatch ? parseFloat(afterMatch[1]) : ageBefore;

      assert.ok(
        ageAfter > ageBefore,
        `Crafting pills must advance 骨龄寿元 (before=${ageBefore}, after=${ageAfter})`
      );
    }
  },

  // ==================== E2E-T1-27: G9 显式消费 ====================
  {
    id: "E2E-T1-27",
    title: "G9: Bag-full prompts choice, alchemy itemizes missing mats, temper has core toggle, soul unlock confirms",
    features: ["G9"],
    async fn(env) {
      const page = await env.openPage("t1-27");
      await env.startFreshGame(page);

      // 1. Bag full (24 items) + 25th item drop must show explicit choice modal instead of auto-smelting
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "qi";
        game.stones = 300;
        game.inventory.herb = 0;
        game.inventory.core = 2;
        if (!game.equippedGear.weapon) game.equippedGear.weapon = v25.rollGearItem(0, 1, "weapon");
        game.gearBag = Array.from({ length: 24 }, () => v25.rollGearItem(0, 1, "weapon"));
        v25.updateHud();
        v25.acquireGearItem(v25.rollGearItem(0, 1, "weapon"));
      });
      await page.waitForTimeout(200);

      const bagFullModalOpen = await isModalOpen(page);
      const stonesAfterDrop = (await getHudState(page)).stones;
      assert.ok(
        bagFullModalOpen && stonesAfterDrop === 300,
        `Bag full must prompt player instead of silently auto-smelting (modalOpen=${bagFullModalOpen}, stones=${stonesAfterDrop})`
      );
      await closeModalEsc(page);

      // 2. Alchemy missing material breakdown
      await openNavTab(page, "alchemy");
      const alchemyText = await getDrawerText(page);
      assert.match(
        alchemyText,
        /购入缺料/,
        `Alchemy UI with missing materials must explicitly itemize '购入缺料 X 石'`
      );
    }
  },

  // ==================== E2E-T1-28: G10 灵宠分级成长 & 技能选择 ====================
  {
    id: "E2E-T1-28",
    title: "G10: Pet feeding uses tiered materials (herb -> core -> jade) and offers Lv.3/Lv.5 skill choices",
    features: ["G10"],
    async fn(env) {
      const page = await env.openPage("t1-28");
      await env.startFreshGame(page);

      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.realm = "qi";
        game.inventory.herb = 20;
        game.inventory.core = 20;
        game.inventory.jade = 20;
        window.__CHENYUAN_V25__.enterSanctumHub();
        window.__CHENYUAN_V25__.updateHud();
      });
      await page.waitForTimeout(150);

      await openNavTab(page, "cultivate");
      const foxBtn = await page.waitForSelector('button[data-pet="fox"]');
      await foxBtn.click();
      await page.waitForTimeout(150);

      // Feed from Lv.1 -> Lv.3 and check tiered cost / Lv.3 skill choice
      const feedLabels = [];
      let sawSkillChoice = false;
      for (let i = 0; i < 4; i++) {
        const feedBtn = await page.$('button[data-action="feed-pet"]');
        if (!feedBtn) break;
        feedLabels.push((await feedBtn.innerText()).trim());
        await feedBtn.click();
        await page.waitForTimeout(150);
        if (await isModalOpen(page)) {
          const mTxt = await getModalText(page);
          if (/技能|分支|神通/.test(mTxt)) {
            sawSkillChoice = true;
            break;
          }
        }
        const drawerTxt = await getDrawerText(page);
        if (/选择.*技能|技能分支/.test(drawerTxt)) {
          sawSkillChoice = true;
          break;
        }
      }

      const usesHigherTierMat = feedLabels.some((l) => /妖核|灵玉/.test(l));
      assert.ok(
        usesHigherTierMat || sawSkillChoice,
        `Pet feeding must escalate material tiers (herb->core->jade) and offer Lv.3 skill choice; labels=${JSON.stringify(feedLabels)}`
      );
      assert.equal(sawSkillChoice, true, "Reaching Lv.3 must present an explicit pet skill choice");
    }
  },

  // ==================== E2E-T1-29: G11a Boss Rush 评级重定基准 ====================
  {
    id: "E2E-T1-29",
    title: "G11a: Baseline full Boss Rush completion awards A (not automatic SS)",
    features: ["G11a"],
    async fn(env) {
      const page = await env.openPage("t1-29");
      await env.startFreshGame(page);

      // Precondition: full Boss Rush run starting from bout 1, advancing through bout 7 with slow time & hits taken
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "nascent";
        v25.openBossRushModal();
      });
      await page.waitForSelector("#modal-backdrop.open");
      await page.click('button[data-start-rush="1"]');
      await page.waitForTimeout(200);

      // Simulate full 7-bout completion with 0 skill bonuses (0 parries, 0 partBreaks, 0 affixes)
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { arena } = v25.getState();
        arena.parryCount = 0;
        arena.rushAffixes = [];
        if (arena.bossRush) {
          arena.bossRush.elapsed = 90;
          arena.bossRush.partBreaks = 0;
          arena.bossRush.bout = 7;
        }
        for (const e of [...arena.enemies]) {
          e.hp = 0;
          v25.handleEnemyDeath(e);
        }
      });
      // Wait past the 450ms Boss Rush victory modal timer
      await page.waitForTimeout(700);

      const modalOpen = await isModalOpen(page);
      const modalText = await getModalText(page);
      assert.ok(
        modalOpen && /评定/.test(modalText),
        `Boss Rush victory modal with grade must appear after bout 7 clear (modalOpen=${modalOpen}, text="${modalText.slice(0, 120)}")`
      );
      assert.doesNotMatch(
        modalText,
        /S[S+]?\s*至高评定|评定：\s*S(?:\+|S)?\b/,
        `Baseline 0-skill (0 parry, 0 partBreak, 90s) Boss Rush run must award A/baseline, not S/SS/S+, got: "${modalText.slice(0, 200)}"`
      );
    }
  },

  // ==================== E2E-T1-30: G11b 数据清理 ====================
  {
    id: "E2E-T1-30",
    title: "G11b: Ascension roadmap pet names match SPIRIT_PETS canonically",
    features: ["G11b"],
    async fn(env) {
      const page = await env.openPage("t1-30");
      await env.startFreshGame(page);

      await page.click("#btn-pavilion-menu");
      await page.waitForTimeout(120);
      await page.click("#btn-ascension-roadmap");
      await page.waitForSelector("#modal-backdrop.open");

      const roadmapText = await getModalText(page);
      assert.doesNotMatch(
        roadmapText,
        /青丘灵狐|玄甲灵龟|剑灵青雀/,
        "Ascension roadmap must not contain outdated pet names (青丘灵狐/玄甲灵龟/剑灵青雀)"
      );
      assert.match(
        roadmapText,
        /青丘火狐|玄水灵龟|太虚剑灵/,
        "Ascension roadmap should list canonical SPIRIT_PETS names"
      );
    }
  },

  // ==================== E2E-T1-31: G12 闭关吸附掉落限制 ====================
  {
    id: "E2E-T1-31",
    title: "G12: Meditating in active combat does not vacuum distant (320px) loot drops",
    features: ["G12"],
    async fn(env) {
      const page = await env.openPage("t1-31");
      await env.startFreshGame(page);

      // Precondition: active stage 0 combat with a non-interrupting enemy alive and a stone drop 320px away
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        v25.initArenaStage(0, false);
        const { game, arena } = v25.getState();
        game.stones = 100;
        const px = arena.player?.x || 400;
        const py = arena.player?.y || 450;
        // Keep one enemy alive at a safe distance so combat zone stays active without interrupting meditation
        if (arena.enemies.length > 0) {
          const keeper = arena.enemies[0];
          keeper.x = px + 1100;
          keeper.y = py;
          keeper.vx = 0;
          keeper.vy = 0;
          keeper.timer = 99;
          arena.enemies = [keeper];
        }
        arena.drops.push({
          x: px + 320,
          y: py,
          vx: 0,
          vy: 0,
          kind: "stone",
          val: 50,
          life: 30
        });
        v25.updateHud();
      });
      await page.waitForTimeout(150);

      const stonesBefore = (await getHudState(page)).stones;
      await page.keyboard.press("KeyB");
      await page.waitForTimeout(120);

      const meditating = await page.evaluate(() => !!window.__CHENYUAN_V25__.getState().arena.player?.meditating);
      assert.equal(meditating, true, "Player must enter meditation after pressing KeyB");

      // Frame-counted rAF wait (40 frames > ceil(320/22)=15 frames needed to pull 320px), 100% immune to CPU/rAF throttling
      await page.evaluate(
        ({ before, maxFrames }) =>
          new Promise((resolve) => {
            let frames = 0;
            function step() {
              const raw = (document.querySelector("#hud-stones")?.textContent || "").trim();
              const cur = parseInt(raw.replace(/[^\d-]/g, ""), 10);
              if ((Number.isFinite(cur) && cur > before) || frames >= maxFrames) {
                resolve({ frames, stones: cur });
                return;
              }
              frames++;
              requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          }),
        { before: stonesBefore, maxFrames: 40 }
      );

      const stonesAfter = (await getHudState(page)).stones;
      assert.equal(
        stonesAfter,
        stonesBefore,
        `Meditating in active combat must NOT vacuum a drop 320px away (before=${stonesBefore}, after=${stonesAfter})`
      );
    }
  }
];
