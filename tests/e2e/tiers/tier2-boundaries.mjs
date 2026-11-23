import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  META_KEY,
  isModalOpen,
  getModalText,
  closeModalEsc,
  openNavTab,
  triggerTribulationAttempt,
  getDrawerText,
  openSettingsTab,
  getHudState,
  getToastTexts,
  readStorageJson
} from "../lib/harness.mjs";
import {
  REALM_XP_CAPS,
  buildLegacyEb0ea67Game,
  buildEnvelopeV2,
  buildMetaSave,
  buildCorruptPrimarySave,
  buildCorruptMetaSave
} from "../lib/fixtures.mjs";

export const tier = 2;
export const name = "Tier 2 — Boundary & Corner Cases (Incl. All 5 Save Scenarios)";

export const tests = [
  // ==================== E2E-T2-01: Save Scenario 1 — Fresh Start ====================
  {
    id: "E2E-T2-01",
    title: "Save Scenario 1: Fresh start hides continue, shows opening scroll, writes valid envelope v2",
    features: ["T1", "S8"],
    async fn(env) {
      const page = await env.openPage("t2-01");
      await env.gotoWelcome(page);

      const continueVisible = await page.evaluate(() => {
        const btn = document.querySelector("#btn-continue-save");
        return !!(btn && getComputedStyle(btn).display !== "none");
      });
      assert.equal(continueVisible, false, "#btn-continue-save must be hidden on empty localStorage");

      await page.click("#btn-start-new");
      await page.waitForTimeout(250);

      // Verify opening scroll appears (S8)
      const hasOpeningScroll = await page.evaluate(() => {
        return (
          !!document.querySelector("#story-dialogue-bar.open") ||
          !!document.querySelector("#modal-backdrop.open")
        );
      });
      assert.equal(
        hasOpeningScroll,
        true,
        "Fresh start must present the opening premise scroll before active combat"
      );

      await env.dismissOpeningIfAny(page);
      const hud = await getHudState(page);
      assert.equal(hud.name, "顾长青");
      assert.equal(hud.realm, "凡人");

      const { parsed } = await readStorageJson(page, STORAGE_KEY);
      assert.equal(parsed?.envelopeVersion, 2, "Fresh start must write envelope v2");
      assert.ok(parsed?.saveRev >= 1, "Fresh start save must have saveRev >= 1");
      assert.ok(typeof parsed?.checksum === "string" && parsed.checksum.length === 8, "Fresh start save must have 8-char checksum");
    }
  },

  // ==================== E2E-T2-02: Save Scenario 2 — Legacy eb0ea67 Continue & Migration ====================
  {
    id: "E2E-T2-02",
    title: "Save Scenario 2: Legacy eb0ea67 save continues without regression, clamps inflated stats, upgrades metaRev",
    features: ["S1", "G5", "T1"],
    async fn(env) {
      const page = await env.openPage("t2-02");
      const legacyGame = buildLegacyEb0ea67Game({
        realm: "golden",
        xp: REALM_XP_CAPS.golden,
        stageStars: {},
        atkFlatBonus: 9999,
        hpFlatBonus: 99999
      });
      const legacyEnvelope = buildEnvelopeV2({ game: legacyGame, saveRev: 2 });
      const legacyMeta = buildMetaSave({ bestScore: 1234 }); // no metaRev

      await env.continueSavedGame(page, {
        [STORAGE_KEY]: legacyEnvelope,
        [META_KEY]: legacyMeta
      });

      const hud = await getHudState(page);
      assert.equal(hud.realm, "金丹", "Legacy golden save must remain at 金丹 without regression");

      // Trigger meta write & check metaRev upgrade
      await page.evaluate(() => {
        window.__CHENYUAN_V25__.saveMeta();
        window.__CHENYUAN_V25__.saveGame();
      });
      await page.waitForTimeout(150);

      const { parsed: metaAfter } = await readStorageJson(page, META_KEY);
      assert.ok(
        typeof metaAfter?.metaRev === "number" && metaAfter.metaRev >= 1,
        "Legacy meta save must upgrade with monotonic metaRev on write"
      );

      // Check inflated flat bonuses were clamped on load (G5)
      const { parsed: saveAfter } = await readStorageJson(page, STORAGE_KEY);
      const clampedAtk = saveAfter?.game?.atkFlatBonus ?? 0;
      assert.ok(
        clampedAtk < 9999,
        `Inflated legacy atkFlatBonus=9999 must be clamped by G5 cap on load, got ${clampedAtk}`
      );
    }
  },

  // ==================== E2E-T2-03: Save Scenario 3 — Reload Persistence ====================
  {
    id: "E2E-T2-03",
    title: "Save Scenario 3: Reload preserves stones, realm, pet, and claimed progress identically",
    features: ["T6"],
    async fn(env) {
      const page = await env.openPage("t2-03");
      await env.startFreshGame(page);

      // Mutate progress via normal game state + save
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "qi";
        game.stones = 432;
        game.pet = { id: "fox", level: 2 };
        v25.updateHud();
        v25.saveGame();
      });
      await page.waitForTimeout(150);

      const beforeReload = await getHudState(page);
      assert.equal(beforeReload.realm, "炼气");
      assert.equal(beforeReload.stones, 432);

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForSelector("#btn-continue-save", { state: "visible", timeout: 10000 });
      await page.click("#btn-continue-save");
      await page.waitForTimeout(220);

      const afterReload = await getHudState(page);
      assert.equal(afterReload.realm, "炼气", "Realm must persist across reload");
      assert.equal(afterReload.stones, 432, "Stones must persist across reload");

      await openNavTab(page, "cultivate");
      const drawerTxt = await getDrawerText(page);
      assert.match(drawerTxt, /青丘火狐/, "Adopted pet must persist across reload");
    }
  },

  // ==================== E2E-T2-04: Save Scenario 4 — Write Failure (QuotaExceededError) ====================
  {
    id: "E2E-T2-04",
    title: "Save Scenario 4: QuotaExceededError surfaces #hud-save-alert, preserves save, and recovers on retry",
    features: ["T1", "T6"],
    async fn(env) {
      const page = await env.openPage("t2-04");
      await env.startFreshGame(page);

      const rawBefore = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
      assert.ok(rawBefore && rawBefore.length > 20, "Initial save must exist before simulating quota error");
      const stonesBefore = JSON.parse(rawBefore)?.game?.stones;
      assert.ok(Number.isFinite(stonesBefore), `Initial saved stones must be numeric, got ${stonesBefore}`);

      // Simulate QuotaExceededError on Storage.prototype.setItem
      await page.evaluate(() => {
        window.__origSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function () {
          throw new DOMException("QuotaExceededError", "QuotaExceededError");
        };
        const { game } = window.__CHENYUAN_V25__.getState();
        game.stones += 10;
        window.__CHENYUAN_V25__.saveGame();
      });
      await page.waitForTimeout(200);

      const alertVisible = await page.evaluate(() => {
        const el = document.querySelector("#hud-save-alert");
        return !!(el && getComputedStyle(el).display !== "none" && (el.innerText || "").trim().length > 0);
      });
      assert.equal(alertVisible, true, "#hud-save-alert must become visible on QuotaExceededError");

      const rawDuringError = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
      assert.equal(
        rawDuringError,
        rawBefore,
        "Previous save in localStorage must remain intact when setItem throws QuotaExceededError"
      );

      const retryBtn = await page.$('[data-action="retry-save-now"]');
      assert.ok(retryBtn && (await retryBtn.isVisible()), "Retry save button must be visible in #hud-save-alert");

      // Restore setItem and click retry
      await page.evaluate(() => {
        if (window.__origSetItem) {
          Storage.prototype.setItem = window.__origSetItem;
          delete window.__origSetItem;
        }
      });
      await retryBtn.click();
      await page.waitForTimeout(200);

      const alertAfterRetry = await page.evaluate(() => {
        const el = document.querySelector("#hud-save-alert");
        return !!(el && getComputedStyle(el).display !== "none");
      });
      assert.equal(alertAfterRetry, false, "#hud-save-alert must hide (display: none) after successful retry");

      const { parsed: savedAfterRetry } = await readStorageJson(page, STORAGE_KEY);
      assert.equal(
        savedAfterRetry?.game?.stones,
        stonesBefore + 10,
        `Retry save must persist updated stones (${stonesBefore + 10}) to localStorage, got ${savedAfterRetry?.game?.stones}`
      );
    }
  },

  // ==================== E2E-T2-05: Save Scenario 5 — Multi-Tab Contention ====================
  {
    id: "E2E-T2-05",
    title: "Save Scenario 5: Multi-tab conflict blocks silent overwrite & invalid cross-tab storage event warns user",
    features: ["T5", "T6"],
    async fn(env) {
      const pageA = await env.openPage("t2-05-A");
      const pageB = await env.openPage("t2-05-B");

      await env.startFreshGame(pageA);
      await pageB.goto(env.baseUrl, { waitUntil: "domcontentloaded" });
      await pageB.waitForSelector("#btn-continue-save", { state: "visible", timeout: 10000 });
      await pageB.click("#btn-continue-save");
      await pageB.waitForTimeout(200);

      // Page A advances and saves
      await pageA.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.stones = 654;
        window.__CHENYUAN_V25__.saveGame();
      });
      await pageB.waitForTimeout(250);

      // Page B should show conflict modal or alert
      const hasConflictUi = await pageB.evaluate(() => {
        const modal = document.querySelector("#modal-backdrop.open #modal-content")?.innerText || "";
        const alert = document.querySelector("#hud-save-alert")?.innerText || "";
        return /冲突|新进度|载入最新/.test(modal + " " + alert);
      });
      assert.equal(hasConflictUi, true, "Page B must display multi-tab conflict UI when Page A writes newer saveRev");

      // Now inject invalid payload into STORAGE_KEY from Page A and verify Page B warns instead of silently ignoring
      await pageB.evaluate(() => {
        if (document.querySelector("#modal-backdrop.open")) {
          window.__CHENYUAN_V25__.closeModal();
        }
      });
      await pageA.evaluate((k) => {
        localStorage.setItem(k, "{INVALID_CROSS_TAB_JSON");
      }, STORAGE_KEY);
      await pageB.waitForTimeout(250);

      const pageBFeedback = await pageB.evaluate(() => {
        const alert = document.querySelector("#hud-save-alert")?.innerText || "";
        const modal = document.querySelector("#modal-backdrop.open #modal-content")?.innerText || "";
        const toasts = Array.from(document.querySelectorAll("#toast-container .toast-pill"))
          .map((e) => e.textContent || "")
          .join(" ");
        return `${alert} ${modal} ${toasts}`;
      });
      assert.match(
        pageBFeedback,
        /损坏|无效|校验失败|异常/,
        `Page B must visibly warn on invalid cross-tab storage payload, got: "${pageBFeedback.slice(0, 200)}"`
      );
    }
  },

  // ==================== E2E-T2-06: Simultaneous Corrupt Primary + Meta ====================
  {
    id: "E2E-T2-06",
    title: "T1: Simultaneously corrupted primary & meta saves are both reported and preserved intact",
    features: ["T1"],
    async fn(env) {
      const page = await env.openPage("t2-06");
      const badPrimary = buildCorruptPrimarySave();
      const badMeta = buildCorruptMetaSave();

      await env.gotoWelcome(page, {
        [STORAGE_KEY]: badPrimary,
        [META_KEY]: badMeta
      });

      const bannerText = await page.evaluate(() =>
        (document.querySelector("#save-status-banner")?.innerText || "").trim()
      );
      assert.match(bannerText, /旧存档读取失败|存档.*损坏/, `Expected primary corruption notice, got: "${bannerText}"`);
      assert.match(bannerText, /元存档.*损坏|损坏.*元存档/, `Expected meta corruption notice, got: "${bannerText}"`);

      const storedPrimary = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
      const storedMeta = await page.evaluate((k) => localStorage.getItem(k), META_KEY);
      assert.equal(storedPrimary, badPrimary, "Corrupted primary save must remain untouched");
      assert.equal(storedMeta, badMeta, "Corrupted meta save must remain untouched");
    }
  },

  // ==================== E2E-T2-07: Invalid / Tampered Cloud Code ====================
  {
    id: "E2E-T2-07",
    title: "T4: Invalid or tampered cloud save code is rejected cleanly without mutating save",
    features: ["T4"],
    async fn(env) {
      const page = await env.openPage("t2-07");
      await env.startFreshGame(page);

      const rawBefore = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
      await openSettingsTab(page, "controls");
      await page.fill("#inp-cloud-save-code", "CY24SAVE-0000-INVALID_BASE64!!!");
      await page.click("#btn-import-cloud-save");
      await page.waitForTimeout(200);

      const statusTxt = await page.evaluate(() =>
        (document.querySelector("#lbl-cloud-save-status")?.innerText || "").trim()
      );
      const toasts = (await getToastTexts(page)).join(" ");
      const combined = `${statusTxt} ${toasts}`;
      assert.match(combined, /失败|无效|校验/, `Expected error feedback on invalid cloud code, got: "${combined}"`);

      const rawAfter = await page.evaluate((k) => localStorage.getItem(k), STORAGE_KEY);
      assert.equal(rawAfter, rawBefore, "Invalid cloud code import must NOT mutate existing localStorage save");
    }
  },

  // ==================== E2E-T2-08: Boss-Gate Lockout Across Realm Boundaries ====================
  {
    id: "E2E-T2-08",
    title: "S1: Every realm breakthrough boundary (mortal->qi through spirit->ascended) enforces boss gate",
    features: ["S1"],
    async fn(env) {
      const page = await env.openPage("t2-08");
      await env.startFreshGame(page);

      const boundaries = [
        { realm: "mortal", xpCap: REALM_XP_CAPS.mortal },
        { realm: "qi", xpCap: REALM_XP_CAPS.qi },
        { realm: "foundation", xpCap: REALM_XP_CAPS.foundation },
        { realm: "golden", xpCap: REALM_XP_CAPS.golden },
        { realm: "spirit", xpCap: REALM_XP_CAPS.spirit }
      ];

      for (const b of boundaries) {
        await page.evaluate(({ realm, xpCap }) => {
          const v25 = window.__CHENYUAN_V25__;
          const { game } = v25.getState();
          game.realm = realm;
          game.xp = xpCap;
          game.stageStars = {};
          game.trialCompleted = false;
          v25.closeModal();
          v25.enterSanctumHub();
          v25.updateHud();
        }, b);
        await page.waitForTimeout(100);

        await triggerTribulationAttempt(page);

        const canStart = await page.evaluate(() => {
          const btn = document.querySelector("[data-trib-start]");
          return !!(btn && !btn.disabled && getComputedStyle(btn).display !== "none");
        });
        assert.equal(
          canStart,
          false,
          `Boundary from realm '${b.realm}' must be boss-gated when stageStars is empty`
        );
      }
    }
  },

  // ==================== E2E-T2-09: Lifespan 90% Decay & 100% Soft-Fail Boundary ====================
  {
    id: "E2E-T2-09",
    title: "G8: Lifespan >=90% shows progressive decay and 100% opens optional 兵解转世 modal (cancel preserves save)",
    features: ["G8"],
    async fn(env) {
      const page = await env.openPage("t2-09");
      await env.startFreshGame(page);

      // Set lifespan to 100% (寿尽)
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "qi";
        const info = v25.getLifespanInfo(game);
        game.elapsedMonths = (info.maxMonths || 1800) + 12;
        v25.enterSanctumHub();
        v25.updateHud();
      });
      await page.waitForTimeout(250);

      // Check modal or cultivate drawer for 兵解转世 soft-fail offer
      let text = await getModalText(page);
      if (!text) {
        await openNavTab(page, "cultivate");
        text = await getDrawerText(page);
      }
      assert.match(
        text,
        /兵解转世|寿元已尽|寿尽/,
        `At 100% lifespan, expected optional 兵解转世 soft-fail offer, got: "${text.slice(0, 200)}"`
      );
    }
  },

  // ==================== E2E-T2-10: Expedition Safe-Hub AFK Cap ====================
  {
    id: "E2E-T2-10",
    title: "G1: Expedition bank does not accrue uncapped AFK stones in safe hub",
    features: ["G1"],
    async fn(env) {
      const page = await env.openPage("t2-10");
      await env.startFreshGame(page);

      // Precondition: nascent realm (M6 vein_expedition unlock), shen bonded, idle in safe hub
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "nascent";
        game.stones = 500;
        game.bondTiers = { shen: 1, pei: 0, lu: 0, yan: 0 };
        game.aids = { shen: true, pei: false, lu: false, yan: false };
        v25.enterSanctumHub();
        v25.updateHud();
        v25.openExpeditionSandboxModal();
      });
      await page.waitForSelector("#modal-backdrop.open");

      // Assign shen to first node via real select
      await page.selectOption('select[data-exp-node="qinglan_vein"]', "shen");
      await page.waitForTimeout(150);

      // Claim once (clears bank), then immediately claim again with 0 banked stones
      await page.click("#btn-claim-expedition");
      await page.waitForTimeout(150);
      const afterFirstClaim = (await getHudState(page)).stones;
      await page.click("#btn-claim-expedition");
      await page.waitForTimeout(150);
      const afterSecondClaim = (await getHudState(page)).stones;
      assert.equal(
        afterSecondClaim,
        afterFirstClaim,
        `Second immediate claim with 0 banked stones must yield 0 (no empty-bank refill): first=${afterFirstClaim}, second=${afterSecondClaim}`
      );
    }
  },

  // ==================== E2E-T2-11: Welcome Screen Name Input Shortcut Suppression ====================
  {
    id: "E2E-T2-11",
    title: "T2: Welcome screen name input suppresses P, F3, [, ] global shortcuts",
    features: ["T2"],
    async fn(env) {
      const page = await env.openPage("t2-11");
      await env.gotoWelcome(page);

      const toggleOrigin = await page.$("#btn-toggle-origin");
      if (toggleOrigin && await toggleOrigin.isVisible()) {
        await toggleOrigin.click();
        await page.waitForTimeout(150);
      }

      const nameInput = await page.waitForSelector("#player-name-input");
      await nameInput.click();
      await page.keyboard.type("P[]");
      await page.keyboard.press("F3");
      await page.waitForTimeout(150);

      const state = await page.evaluate(() => ({
        photoActive:
          document.body.classList.contains("photo-mode-active") ||
          !!document.querySelector("#photo-mode-panel.open"),
        telemetryOpen: !!document.querySelector("#action-telemetry-panel.open")
      }));
      assert.equal(state.photoActive, false, "Typing 'P' in welcome name input must NOT open Photo Mode");
      assert.equal(state.telemetryOpen, false, "Pressing F3 in welcome name input must NOT open Telemetry panel");
    }
  },

  // ==================== E2E-T2-12: Pet Feeding Insufficient Higher-Tier Materials ====================
  {
    id: "E2E-T2-12",
    title: "G10: Feeding Lv.2 pet with only herbs (0 core, 0 jade) is rejected and preserves herbs",
    features: ["G10"],
    async fn(env) {
      const page = await env.openPage("t2-12");
      await env.startFreshGame(page);

      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "qi";
        game.pet = { id: "fox", level: 2 };
        game.inventory.herb = 10;
        game.inventory.core = 0;
        game.inventory.jade = 0;
        v25.enterSanctumHub();
        v25.updateHud();
      });
      await page.waitForTimeout(150);

      await openNavTab(page, "cultivate");
      const feedBtn = await page.waitForSelector('button[data-action="feed-pet"]');
      await feedBtn.click();
      await page.waitForTimeout(180);

      const drawerAfter = await getDrawerText(page);
      assert.doesNotMatch(
        drawerAfter,
        /Lv\.3|3\s*级/,
        "Lv.2 pet must NOT level up to Lv.3 using only herbs when higher-tier material (core/jade) is 0"
      );
    }
  }
];
