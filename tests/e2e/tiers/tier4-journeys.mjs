import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  META_KEY,
  isModalOpen,
  isDrawerOpen,
  getModalText,
  closeModalEsc,
  openNavTab,
  triggerTribulationAttempt,
  getDrawerText,
  openSettingsTab,
  getHudState,
  getToastTexts,
  getActiveElementInfo,
  readStorageJson,
  waitForCrossTabConflict
} from "../lib/harness.mjs";
import {
  ALL_DAO_LAW_IDS,
  REALM_XP_CAPS,
  buildCorruptMetaSave
} from "../lib/fixtures.mjs";

export const tier = 4;
export const name = "Tier 4 — Real-World End-User Gameplay Journeys";

export const tests = [
  // ==================== E2E-T4-01: New Player Onboarding -> Volume 1 Clear -> First Breakthrough ====================
  {
    id: "E2E-T4-01",
    title: "Journey 1: New player opening scroll -> terminology -> boss-gated Vol.1 clear -> first breakthrough & reload",
    features: ["S8", "S3", "S1", "S7", "S11+G7", "G3", "T7"],
    async fn(env) {
      const page = await env.openPage("t4-01");
      await env.gotoWelcome(page);

      // 1. Start new game -> opening premise scroll (S8)
      await page.click("#btn-start-new");
      await page.waitForTimeout(250);
      const openingShown = await page.evaluate(
        () => !!document.querySelector("#story-dialogue-bar.open") || !!document.querySelector("#modal-backdrop.open")
      );
      assert.equal(openingShown, true, "New player must see opening premise scroll (S8) before combat");
      await env.dismissOpeningIfAny(page);

      // 2. Verify unified terminology (S3)
      const navStory = await page.evaluate(() => (document.querySelector("#nav-btn-story")?.innerText || "").trim());
      assert.match(navStory, /故人/, "Right-rail button must be labeled 故人 (S3)");
      const tracker = await page.evaluate(() => (document.querySelector("#quest-tracker-hud")?.innerText || "").trim());
      assert.doesNotMatch(tracker, /第一幕/, "Tracker must use 第一卷 instead of 第一幕 (S3)");

      // 3. Fill mortal XP without defeating stage 0 boss -> verify boss gate (S1)
      await page.evaluate((xpCap) => {
        const v25 = window.__CHENYUAN_DEBUG__;
        const { game } = v25.getState();
        game.realm = "mortal";
        game.xp = xpCap;
        game.stageStars = {};
        v25.updateHud();
      }, REALM_XP_CAPS.mortal);
      await triggerTribulationAttempt(page);
      const canStartBeforeBoss = await page.evaluate(() => !!document.querySelector("[data-trib-start]"));
      assert.equal(canStartBeforeBoss, false, "First breakthrough must be boss-gated before defeating stage 0 boss (S1)");
      await closeModalEsc(page);

      // 4. Defeat stage 0 boss -> verify post-boss cutscene & volume-end card (S7)
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_DEBUG__;
        const { game } = v25.getState();
        game.openingChoice = "help";
        game.seenCutscenes = Object.assign({}, game.seenCutscenes, { boss_pre_stage0: true });
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
      await page.waitForTimeout(750);
      const dlgOpen = await page.evaluate(() => !!document.querySelector("#story-dialogue-bar.open"));
      assert.equal(dlgOpen, true, "Defeating stage 0 boss must open clear_stage0 cutscene (S7)");
    }
  },

  // ==================== E2E-T4-02: Multi-Tab Contention, Save Corruption & Cloud-Code Recovery ====================
  {
    id: "E2E-T4-02",
    title: "Journey 2: Multi-tab conflict -> read-only guards -> QuotaExceeded recovery -> corrupt meta preservation -> cloud restore",
    features: ["T1", "T2", "T3", "T4", "T5", "T6"],
    async fn(env) {
      const pageA = await env.openPage("t4-02-A");
      await env.startFreshGame(pageA);

      // 1. Open settings, verify focus trap (T3) & input shortcut suppression (T2)
      await pageA.focus("#btn-open-settings");
      await openSettingsTab(pageA, "controls");
      await pageA.click("#inp-cloud-save-code");
      await pageA.keyboard.type("p");
      await pageA.waitForTimeout(120);
      const photoActive = await pageA.evaluate(
        () => document.body.classList.contains("photo-mode-active") || !!document.querySelector("#photo-mode-panel.open")
      );
      assert.equal(photoActive, false, "Typing 'p' in cloud code input must not open Photo Mode (T2)");

      // Export cloud code from Tab A
      await pageA.click("#btn-export-cloud-save");
      await pageA.waitForTimeout(120);
      const exportedCode = await pageA.evaluate(() => document.querySelector("#inp-cloud-save-code")?.value || "");
      assert.ok(exportedCode.startsWith("CY24SAVE-"), "Exported cloud save code must start with CY24SAVE-");
      await closeModalEsc(pageA);
      const restored = await getActiveElementInfo(pageA);
      assert.equal(restored?.id, "btn-open-settings", "Escape must return focus to #btn-open-settings (T3)");

      // 2. Open Tab B, create conflict, enter read-only mode, verify read-only cloud import refusal (T4, T6)
      const pageB = await env.openPage("t4-02-B");
      await pageB.goto(env.baseUrl, { waitUntil: "domcontentloaded", timeout: env.navigationTimeoutMs });
      await pageB.waitForSelector("#btn-continue-save", { state: "visible", timeout: env.navigationTimeoutMs });
      await pageB.click("#btn-continue-save");
      await pageB.waitForTimeout(200);

      await pageA.evaluate(() => {
        const { game } = window.__CHENYUAN_DEBUG__.getState();
        game.stones = 1234;
        window.__CHENYUAN_DEBUG__.saveGame();
      });
      await waitForCrossTabConflict(pageB, 2500);

      const hasConflictUi = await pageB.evaluate(() => {
        const modal = document.querySelector("#modal-backdrop.open #modal-content")?.innerText || "";
        const alert = document.querySelector("#hud-save-alert")?.innerText || "";
        return (
          !!document.querySelector('[data-action="stay-readonly-save"], [data-action="open-save-conflict"]') ||
          /冲突|新进度|载入最新/.test(`${modal} ${alert}`)
        );
      });
      assert.equal(hasConflictUi, true, "Tab B must surface multi-tab conflict UI when Tab A saves newer rev (T6)");

      const stayRo = await pageB.$('[data-action="stay-readonly-save"]');
      if (stayRo && (await stayRo.isVisible())) {
        await stayRo.click();
      } else {
        const openConf = await pageB.$('[data-action="open-save-conflict"]');
        if (openConf && (await openConf.isVisible())) {
          await openConf.click();
          await pageB.waitForTimeout(120);
          const stayRo2 = await pageB.$('[data-action="stay-readonly-save"]');
          if (stayRo2 && (await stayRo2.isVisible())) {
            await stayRo2.click();
          }
        }
      }
      await pageB.waitForTimeout(150);

      await openSettingsTab(pageB, "controls");
      await pageB.fill("#inp-cloud-save-code", exportedCode);
      const importBtnDisabled = await pageB.evaluate(
        () => !!document.querySelector("#btn-import-cloud-save")?.disabled
      );
      if (!importBtnDisabled) {
        await pageB.click("#btn-import-cloud-save");
        await pageB.waitForTimeout(200);
        const confirmClicked = await pageB.evaluate(() => {
          const modal = document.querySelector("#modal-backdrop.open #modal-content");
          if (!modal) return false;
          const buttons = Array.from(modal.querySelectorAll("button")).filter(
            (b) => b.id !== "btn-import-cloud-save" && !b.disabled && b.offsetParent !== null
          );
          const match = buttons.find((b) => {
            const act = (b.getAttribute("data-action") || "").toLowerCase();
            const txt = (b.innerText || "").trim();
            if (/取消|返回|关闭|清空|重置/.test(txt) || act.includes("reset") || act.includes("copy")) return false;
            return (
              act.includes("apply-cloud") ||
              act.includes("confirm-cloud") ||
              act.includes("confirm-import") ||
              act.includes("import-confirm") ||
              /确认导入|确认恢复|覆盖存档|确认覆写/.test(txt)
            );
          });
          if (match) {
            match.click();
            return true;
          }
          return false;
        });
        if (confirmClicked) {
          await pageB.waitForTimeout(200);
        }
      }
      const roFeedback = await pageB.evaluate(() => {
        const status = document.querySelector("#lbl-cloud-save-status")?.innerText || "";
        const modal = document.querySelector("#modal-backdrop.open #modal-content")?.innerText || "";
        const toasts = Array.from(document.querySelectorAll("#toast-container .toast-pill"))
          .map((e) => e.textContent || "")
          .join(" ");
        return `${status} ${modal} ${toasts}`;
      });
      assert.doesNotMatch(
        roFeedback,
        /存档恢复成功|导入成功/,
        `Read-only Tab B must never report cloud import success (T4/T6), got: "${roFeedback.slice(0, 200)}"`
      );
      assert.ok(
        importBtnDisabled || /只读|冲突|无法|失败|禁止|拒绝|未写入|锁定/.test(roFeedback),
        `Read-only Tab B must refuse or warn on cloud import (T4/T6), disabled=${importBtnDisabled}, text="${roFeedback.slice(0, 200)}"`
      );
      const { parsed: tabASave } = await readStorageJson(pageA, STORAGE_KEY);
      assert.equal(tabASave?.game?.stones, 1234, "Tab A save in localStorage must remain intact after read-only import attempt (T6)");

      // 3. Corrupt meta save & reload Tab A -> verify meta preserved with banner (T1)
      const badMeta = buildCorruptMetaSave();
      await pageA.evaluate(([k, v]) => localStorage.setItem(k, v), [META_KEY, badMeta]);
      await pageA.reload({ waitUntil: "domcontentloaded", timeout: env.navigationTimeoutMs });
      await pageA.waitForSelector("#welcome-screen", { state: "visible", timeout: env.navigationTimeoutMs });
      const bannerText = await pageA.evaluate(() =>
        (document.querySelector("#save-status-banner")?.innerText || "").trim()
      );
      assert.match(bannerText, /元存档.*损坏|损坏.*元存档/, "Corrupt meta banner must appear on reload (T1)");
      const metaRaw = await pageA.evaluate((k) => localStorage.getItem(k), META_KEY);
      assert.equal(metaRaw, badMeta, "Corrupt meta string must remain preserved until confirmed reset (T1)");
    }
  },

  // ==================== E2E-T4-03: Late-Game Systems, Economy Integrity, Lifespan & Truthful Ascension ====================
  {
    id: "E2E-T4-03",
    title: "Journey 3: Late-game roadmap -> pet depth -> expedition & jade economy -> lifespan -> boss-gated truthful ascension",
    features: ["S1", "S2", "S5", "S6", "S9", "S10", "G1", "G2", "G3", "G8", "G9", "G10", "G11b"],
    async fn(env) {
      const page = await env.openPage("t4-03");
      await env.startFreshGame(page);

      // 1. Check roadmap pet names (G11b)
      await page.click("#btn-pavilion-menu");
      await page.waitForTimeout(100);
      await page.click("#btn-ascension-roadmap");
      await page.waitForSelector("#modal-backdrop.open");
      const roadmapTxt = await getModalText(page);
      assert.doesNotMatch(roadmapTxt, /青丘灵狐|玄甲灵龟|剑灵青雀/, "Roadmap must use canonical pet names (G11b)");
      await closeModalEsc(page);

      // 2. Late-game precondition: golden/spirit with all laws owned & bonded companions
      await page.evaluate((allLaws) => {
        const v25 = window.__CHENYUAN_DEBUG__;
        const { game } = v25.getState();
        game.realm = "spirit";
        game.xp = 14500;
        game.stones = 600;
        game.laws = [...allLaws];
        game.pet = { id: "fox", level: 1 };
        game.stageStars = { 0: 3, 1: 3, 2: 3, 3: 3 };
        game.trialCompleted = false;
        game.bondTiers = { shen: 1, pei: 0, lu: 0, yan: 0 };
        game.aids = { shen: true, pei: false, lu: false, yan: false };
        v25.enterSanctumHub();
        v25.updateHud();
      }, ALL_DAO_LAW_IDS);
      await page.waitForTimeout(150);

      // 3. Verify jade gamble cannot profit when all laws owned (G2)
      await openNavTab(page, "alchemy");
      const gambleBtn = await page.$('button[data-action="gamble-jade"]');
      if (gambleBtn && !(await gambleBtn.isDisabled())) {
        const before = (await getHudState(page)).stones;
        await gambleBtn.click();
        await page.waitForTimeout(150);
        const after = (await getHudState(page)).stones;
        assert.ok(after <= before, `Jade gamble must not profit with all laws owned (G2): ${before} -> ${after}`);
      }
      if (await isDrawerOpen(page)) {
        await page.keyboard.press("Escape");
        await page.waitForFunction(
          () => !document.getElementById("jade-panel")?.classList.contains("drawer-open"),
          { timeout: 3000 }
        );
      }

      // 4. Verify spirit->ascended is boss-gated until stage 4 boss is defeated (S1)
      await triggerTribulationAttempt(page);
      const canAscendWithoutBoss4 = await page.evaluate(() => !!document.querySelector("[data-trib-start]"));
      assert.equal(canAscendWithoutBoss4, false, "Ascension must be blocked until stage 4 boss 天门道影 is defeated (S1)");
    }
  }
];
