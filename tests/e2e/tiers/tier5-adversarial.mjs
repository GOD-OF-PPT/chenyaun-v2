import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  META_KEY,
  isModalOpen,
  isDrawerOpen,
  closeModalEsc,
  openNavTab,
  openSettingsTab,
  getToastTexts,
  getActiveElementInfo,
  readStorageJson,
  waitForCrossTabConflict
} from "../lib/harness.mjs";
import {
  buildLegacyEb0ea67Game,
  buildEnvelopeV2,
  buildCloudSaveCode,
  buildMetaSave
} from "../lib/fixtures.mjs";

export const tier = 5;
export const name = "Tier 5 — White-Box Adversarial Hardening";

export const tests = [
  // ==================== E2E-T5-01: A-1 Stored HTML Escaping + A-11 seenCutIns Key Hygiene ====================
  {
    id: "E2E-T5-01",
    title: "A-1/A-11: Iconic draft titleText escapes HTML (save + CY24SAVE) and seenCutIns filters unsafe keys",
    features: ["A-1", "A-11", "T1", "T4"],
    async fn(env) {
      const page = await env.openPage("t5-01");
      const saveMarker = '<span data-unescaped-marker="e2e_save">E2E_SAVE</span>';
      const cloudMarker = '<span data-unescaped-marker="e2e_cloud">E2E_CLOUD</span>';

      // Build primary save with injected pendingRewards.titleText & raw unsafe seenCutIns keys
      const baseGame = buildLegacyEb0ea67Game({
        realm: "qi",
        pendingRewards: [{
          eventId: "e2e_t5_pr_save",
          kind: "iconic_draft",
          noticeClass: "N1",
          payload: { titleText: saveMarker, source: "default" }
        }],
        seenCutIns: { valid_e2e_cutin: true }
      });
      const seededRaw = buildEnvelopeV2({ game: baseGame, sanctumMode: true, saveRev: 2 });
      const rawWithUnsafe = seededRaw.replace(
        '"seenCutIns":{"valid_e2e_cutin":true}',
        '"seenCutIns":{"__proto__":{"polluted_e2e":"BAD"},"constructor":true,"prototype":true,"toString":true,"valid_e2e_cutin":true}'
      );
      // Recompute checksum over rawWithUnsafe payload so it passes envelope v2 validation cleanly
      const parsedUnsafe = JSON.parse(rawWithUnsafe);
      const canonical = JSON.stringify({
        game: parsedUnsafe.game,
        stageIdx: parsedUnsafe.stageIdx,
        stanceIdx: parsedUnsafe.stanceIdx,
        towerMode: !!parsedUnsafe.towerMode,
        sanctumMode: !!parsedUnsafe.sanctumMode
      });
      let h = 2166136261 >>> 0;
      for (let i = 0; i < canonical.length; i++) {
        h ^= canonical.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      parsedUnsafe.checksum = h.toString(16).toUpperCase().padStart(8, "0");

      await env.continueSavedGame(page, { [STORAGE_KEY]: JSON.stringify(parsedUnsafe) });

      // A-11 check
      const hygiene = await page.evaluate(() => {
        const sc = window.__CHENYUAN_V25__.getState().game.seenCutIns;
        const own = (k) => Object.prototype.hasOwnProperty.call(sc, k);
        let strOk = true;
        try { String(sc); } catch { strOk = false; }
        return {
          polluted: Object.prototype.polluted_e2e !== undefined,
          ownCtor: own("constructor"),
          ownProto: own("prototype"),
          ownToString: own("toString"),
          keptValid: sc.valid_e2e_cutin === true,
          strOk
        };
      });
      assert.equal(hygiene.polluted, false, "Object.prototype must not be polluted (A-11)");
      assert.equal(hygiene.ownCtor, false, "seenCutIns must not own constructor (A-11)");
      assert.equal(hygiene.ownProto, false, "seenCutIns must not own prototype (A-11)");
      assert.equal(hygiene.ownToString, false, "seenCutIns must not own toString (A-11)");
      assert.equal(hygiene.keptValid, true, "seenCutIns must keep valid entries (A-11)");
      assert.equal(hygiene.strOk, true, "String(game.seenCutIns) must not throw (A-11)");

      // A-1 Save path check: in calm Sanctum the pending iconic_draft may auto-present or wait on #btn-pending-rewards
      const alreadyOpen1 = await isModalOpen(page);
      if (!alreadyOpen1) {
        await page.waitForSelector("#btn-pending-rewards", { state: "visible" });
        await page.click("#btn-pending-rewards");
      }
      await page.waitForSelector("#modal-backdrop.open #modal-content h2");
      const saveXss = await page.evaluate((m) => ({
        liveNode: !!document.querySelector("[data-unescaped-marker]"),
        text: document.querySelector("#modal-content h2")?.textContent || "",
        hasLiteral: (document.querySelector("#modal-content h2")?.textContent || "").includes(m)
      }), saveMarker);
      assert.equal(saveXss.liveNode, false, "STORAGE_KEY iconic_draft titleText must be HTML-escaped (A-1)");
      assert.equal(saveXss.hasLiteral, true, `Escaped titleText must be visible as literal text (A-1), got: ${saveXss.text}`);
      await page.click("#modal-content [data-draft-type]");
      await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));

      // A-1 CY24SAVE cloud import path
      const cloudCode = buildCloudSaveCode({
        game: buildLegacyEb0ea67Game({
          realm: "qi",
          pendingRewards: [{
            eventId: "e2e_t5_pr_cloud",
            kind: "iconic_draft",
            noticeClass: "N1",
            payload: { titleText: cloudMarker, source: "default" }
          }]
        })
      });
      await openSettingsTab(page, "controls");
      await page.fill("#inp-cloud-save-code", cloudCode);
      await page.click("#btn-import-cloud-save");
      await page.waitForSelector("#btn-confirm-cloud-import");
      await page.click("#btn-confirm-cloud-import");
      await page.waitForTimeout(160);
      const alreadyOpen2 = await page.evaluate(() => {
        const bd = document.getElementById("modal-backdrop");
        const h2 = document.querySelector("#modal-content h2")?.textContent || "";
        return Boolean(bd && bd.classList.contains("open") && (h2.includes("MARK_CLOUD") || h2.includes("E2E_CLOUD")));
      });
      if (!alreadyOpen2) {
        await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
        await page.waitForSelector("#btn-pending-rewards", { state: "visible" });
        await page.click("#btn-pending-rewards");
      }
      await page.waitForSelector("#modal-backdrop.open #modal-content h2");
      const cloudXss = await page.evaluate((m) => ({
        liveNode: !!document.querySelector("[data-unescaped-marker]"),
        text: document.querySelector("#modal-content h2")?.textContent || "",
        hasLiteral: (document.querySelector("#modal-content h2")?.textContent || "").includes(m)
      }), cloudMarker);
      assert.equal(cloudXss.liveNode, false, "CY24SAVE iconic_draft titleText must be HTML-escaped (A-1)");
      assert.equal(cloudXss.hasLiteral, true, `Escaped cloud titleText must render literally (A-1), got: ${cloudXss.text}`);
    }
  },

  // ==================== E2E-T5-02: A-2 Multi-Tab Lower-Rev Lineage Reset + A-4 Live Disk Corruption Precedence ====================
  {
    id: "E2E-T5-02",
    title: "A-2/A-4: Multi-tab lower-rev lineage reset triggers conflict; delayed valid storage event respects live disk corruption",
    features: ["A-2", "A-4", "T6"],
    async fn(env) {
      const tab1 = await env.openPage("t5-02-tab1");
      await env.gotoWelcome(tab1);
      await tab1.click("#btn-toggle-origin");
      await tab1.waitForSelector("#player-name-input", { state: "visible" });
      await tab1.fill("#player-name-input", "旧世残影");
      await tab1.click("#btn-start-new");
      await tab1.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await env.dismissOpeningIfAny(tab1);
      await tab1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        for (let i = 0; i < 4; i++) {
          api.getState().game.stones += 10;
          api.saveGame();
        }
      });

      const tab2 = await env.openPage("t5-02-tab2");
      await env.gotoWelcome(tab2);
      await tab2.click("#btn-continue-save");
      await tab2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await openSettingsTab(tab2, "controls");
      await tab2.click('[data-action="confirm-reset-save"]');
      await tab2.waitForSelector('[data-action="execute-reset-save"]');
      await tab2.click('[data-action="execute-reset-save"]');
      await tab2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display !== "none");
      await tab2.click("#btn-toggle-origin");
      await tab2.waitForSelector("#player-name-input", { state: "visible" });
      await tab2.fill("#player-name-input", "新世道友");
      await tab2.click("#btn-start-new");
      await tab2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await env.dismissOpeningIfAny(tab2);

      await waitForCrossTabConflict(tab1, 2500);
      const a2Check = await tab1.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const before = Boolean(api.getPersistenceState().saveConflictState);
        const saved = api.saveGame();
        const disk = JSON.parse(localStorage.getItem(sk));
        return { before, saved, diskName: disk?.game?.name, diskRev: disk?.saveRev };
      }, STORAGE_KEY);
      assert.equal(a2Check.before, true, "Tab 1 must detect lower-rev lineage reset conflict (A-2)");
      assert.equal(a2Check.saved, false, "Tab 1 saveGame() must not clobber Tab 2's fresh save (A-2)");
      assert.equal(a2Check.diskName, "新世道友", "Tab 2's fresh save must remain intact on disk (A-2)");
      assert.equal(a2Check.diskRev, 1, "Tab 2's saveRev=1 must be preserved (A-2)");

      // A-4: On Tab 2, corrupt live STORAGE_KEY and dispatch delayed valid StorageEvent
      const a4Check = await tab2.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const envObj = JSON.parse(localStorage.getItem(sk));
        envObj.saveRev = 9;
        envObj.tabId = "tab_delayed_e2e_999";
        const validDelayed = JSON.stringify(envObj);
        localStorage.setItem(sk, "{CORRUPT_E2E_LIVE_DISK");
        window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: validDelayed }));
        const ps = api.getPersistenceState();
        return {
          hasReadErr: Boolean(ps.storageReadError),
          hasConflict: Boolean(ps.saveConflictState),
          modalKind: api.getActiveModalKind(),
          diskRaw: localStorage.getItem(sk)
        };
      }, STORAGE_KEY);
      assert.equal(a4Check.hasReadErr, true, "Delayed valid StorageEvent must detect live disk corruption (A-4)");
      assert.equal(a4Check.hasConflict, false, "Live disk corruption must not enter saveConflictState (A-4)");
      assert.notEqual(a4Check.modalKind, "save_conflict", "Must not show bogus conflict modal over corrupt disk (A-4)");
      assert.equal(a4Check.diskRaw, "{CORRUPT_E2E_LIVE_DISK", "Corrupt raw disk payload must be preserved (A-4)");
    }
  },

  // ==================== E2E-T5-03: A-3 removeItem Failure Rollback + A-7 Repeat Write-Failure Toast ====================
  {
    id: "E2E-T5-03",
    title: "A-3/A-7: removeItem SecurityError preserves state and rolls back bingjie +40 pts; <6s repeat startFreshGameSession emits toast",
    features: ["A-3", "A-7", "G8"],
    async fn(env) {
      const page = await env.openPage("t5-03");
      await env.startFreshGame(page);
      await page.evaluate((sk) => {
        window.__e2eOrigRm = Storage.prototype.removeItem;
        Storage.prototype.removeItem = function (k) {
          if (k === sk) throw new DOMException("Read-only storage", "SecurityError");
          return window.__e2eOrigRm.call(this, k);
        };
        window.__CHENYUAN_V25__.saveMeta();
      }, STORAGE_KEY);

      await openSettingsTab(page, "controls");
      await page.click('[data-action="confirm-reset-save"]');
      await page.waitForSelector('[data-action="execute-reset-save"]');
      await page.evaluate(() => { const tc = document.getElementById("toast-container"); if (tc) tc.innerHTML = ""; });
      await page.click('[data-action="execute-reset-save"]');
      await page.waitForTimeout(100);
      const afterReset = await page.evaluate((sk) => ({
        welcomeVisible: document.getElementById("welcome-screen")?.style.display !== "none",
        diskExists: Boolean(localStorage.getItem(sk)),
        hasGame: Boolean(window.__CHENYUAN_V25__.getState().game)
      }), STORAGE_KEY);
      const resetToasts = (await getToastTexts(page)).join(" | ");
      assert.equal(afterReset.welcomeVisible, false, "Reset failure must stay in-game (A-3)");
      assert.equal(afterReset.hasGame, true, "Reset failure must preserve game state (A-3)");
      assert.equal(afterReset.diskExists, true, "Disk save must remain present (A-3)");
      assert.ok(!resetToasts.includes("已清空当前本地存档"), `Must not claim save cleared (A-3): ${resetToasts}`);

      await closeModalEsc(page);
      const ptsBefore = await page.evaluate((mk) => {
        const api = window.__CHENYUAN_V25__;
        const p = Number(api.getMetaState().reincarnationPoints) || 0;
        const d = Number(JSON.parse(localStorage.getItem(mk) || "{}").reincarnationPoints) || 0;
        api.openLifespanExhaustedModal(true);
        return { p, d };
      }, META_KEY);
      await page.waitForSelector('[data-action="confirm-bingjie-reincarnate"]');
      await page.click('[data-action="confirm-bingjie-reincarnate"]');
      await page.waitForTimeout(100);
      const afterBingjie = await page.evaluate((mk) => ({
        welcomeVisible: document.getElementById("welcome-screen")?.style.display !== "none",
        memPts: Number(window.__CHENYUAN_V25__.getMetaState().reincarnationPoints) || 0,
        diskPts: Number(JSON.parse(localStorage.getItem(mk) || "{}").reincarnationPoints) || 0
      }), META_KEY);
      assert.equal(afterBingjie.welcomeVisible, false, "Bingjie removeItem failure must not return to welcome screen (A-3)");
      assert.equal(afterBingjie.memPts, ptsBefore.p, "Bingjie failure must roll back +40 memory reincarnationPoints (A-3)");
      assert.equal(afterBingjie.diskPts, ptsBefore.d, "Bingjie failure must roll back +40 disk reincarnationPoints (A-3)");

      // Restore removeItem, then test A-7 (<6s repeat startFreshGameSession QuotaExceededError toast)
      await page.evaluate((sk) => {
        Storage.prototype.removeItem = window.__e2eOrigRm;
        window.__e2eOrigSet = Storage.prototype.setItem;
      }, STORAGE_KEY);
      await closeModalEsc(page);
      await openSettingsTab(page, "controls");
      await page.click('[data-action="return-title-safe"]');
      await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display !== "none");

      await page.evaluate((sk) => {
        Storage.prototype.setItem = function (k, v) {
          if (k === sk) throw new DOMException("Quota exceeded", "QuotaExceededError");
          return window.__e2eOrigSet.call(this, k, v);
        };
      }, STORAGE_KEY);
      await page.click("#btn-start-new");
      await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await env.dismissOpeningIfAny(page);
      await openSettingsTab(page, "controls");
      await page.click('[data-action="return-title-safe"]');
      await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display !== "none");
      await page.evaluate(() => { const tc = document.getElementById("toast-container"); if (tc) tc.innerHTML = ""; });
      await page.click("#btn-start-new");
      await page.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      const toasts2 = (await getToastTexts(page)).join(" | ");
      assert.ok(toasts2.includes("写入失败"), `Repeat <6s startFreshGameSession QuotaExceededError must emit toast (A-7), got: ${toasts2}`);
      await page.evaluate(() => { Storage.prototype.setItem = window.__e2eOrigSet; });
    }
  },

  // ==================== E2E-T5-04: A-5/A-6 Alert Bar Focus Retention & Meta Retry Hardening ====================
  {
    id: "E2E-T5-04",
    title: "A-5/A-6: Alert-bar load-latest-save, stay-readonly-save, and retry-meta-save keep focus off BODY with honest feedback",
    features: ["A-5", "A-6", "T1", "T3"],
    async fn(env) {
      const pageA = await env.openPage("t5-04-A");
      await env.startFreshGame(pageA);
      const pageB = await env.openPage("t5-04-B");
      await env.gotoWelcome(pageB);
      await pageB.click("#btn-continue-save");
      await pageB.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await pageB.evaluate(() => { window.__CHENYUAN_V25__.getState().game.stones = 444; window.__CHENYUAN_V25__.saveGame(); });
      await waitForCrossTabConflict(pageA, 2500);

      // Reopen conflict modal from #hud-save-alert -> stay-readonly-save -> focus off BODY
      await pageA.evaluate(() => window.__CHENYUAN_V25__.closeModal());
      await pageA.waitForSelector('#hud-save-alert [data-action="open-save-conflict"]');
      await pageA.focus('#hud-save-alert [data-action="open-save-conflict"]');
      await pageA.click('#hud-save-alert [data-action="open-save-conflict"]');
      await pageA.waitForSelector('#modal-backdrop.open [data-action="stay-readonly-save"]');
      await pageA.click('#modal-backdrop.open [data-action="stay-readonly-save"]');
      await pageA.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
      assert.notEqual((await getActiveElementInfo(pageA))?.tag, "BODY", "stay-readonly-save from alert modal must keep focus off BODY (A-5)");

      // Corrupt disk -> click load-latest-save from alert -> focus off BODY & raw preserved
      await pageA.evaluate((sk) => localStorage.setItem(sk, "{CORRUPT_E2E_A5"), STORAGE_KEY);
      await pageA.focus('#hud-save-alert [data-action="load-latest-save"]');
      await pageA.click('#hud-save-alert [data-action="load-latest-save"]');
      await pageA.waitForTimeout(80);
      assert.notEqual((await getActiveElementInfo(pageA))?.tag, "BODY", "load-latest-save failure on corrupt disk must keep focus off BODY (A-5)");
      assert.equal((await readStorageJson(pageA, STORAGE_KEY)).raw, "{CORRUPT_E2E_A5", "Corrupt save must remain untouched (A-5)");

      // A-6: Start a clean session on pageB (so A-5's corrupt STORAGE_KEY does not mask metaWriteError)
      await pageA.close();
      await pageB.evaluate(() => localStorage.clear());
      await env.startFreshGame(pageB);
      await pageB.evaluate((mk) => {
        window.__e2eOrigSetM = Storage.prototype.setItem;
        window.__e2eBlockM = true;
        Storage.prototype.setItem = function (k, v) {
          if (window.__e2eBlockM && k === mk) throw new DOMException("Quota exceeded", "QuotaExceededError");
          return window.__e2eOrigSetM.call(this, k, v);
        };
        window.__CHENYUAN_V25__.saveMeta();
      }, META_KEY);
      await pageB.waitForSelector('#hud-save-alert [data-action="retry-meta-save"]');
      await pageB.focus('#hud-save-alert [data-action="retry-meta-save"]');
      await pageB.click('#hud-save-alert [data-action="retry-meta-save"]');
      await pageB.waitForTimeout(60);
      assert.notEqual((await getActiveElementInfo(pageB))?.tag, "BODY", "retry-meta-save failure must keep focus off BODY (A-6)");

      await pageB.evaluate((mk) => {
        window.__e2eOrigSetM.call(localStorage, mk, "{CORRUPT_E2E_META");
        const tc = document.getElementById("toast-container");
        if (tc) tc.innerHTML = "";
      }, META_KEY);
      await pageB.focus('#hud-save-alert [data-action="retry-meta-save"]');
      await pageB.click('#hud-save-alert [data-action="retry-meta-save"]');
      await pageB.waitForTimeout(60);
      const corruptMetaToasts = await getToastTexts(pageB);
      assert.ok(corruptMetaToasts.length > 0, "retry-meta-save on corrupt disk must emit non-silent toast (A-6)");
      assert.notEqual((await getActiveElementInfo(pageB))?.tag, "BODY", "retry-meta-save on corrupt disk must keep focus off BODY (A-6)");

      // Recovery
      await pageB.evaluate(({ mk, freshMeta }) => {
        window.__e2eBlockM = false;
        window.__e2eOrigSetM.call(localStorage, mk, freshMeta);
        window.__CHENYUAN_V25__.inspectMetaState({ applyToMemory: true });
        window.__e2eBlockM = true;
        window.__CHENYUAN_V25__.saveMeta();
        window.__e2eBlockM = false;
      }, { mk: META_KEY, freshMeta: buildMetaSave() });
      await pageB.waitForSelector('#hud-save-alert [data-action="retry-meta-save"]');
      await pageB.focus('#hud-save-alert [data-action="retry-meta-save"]');
      await pageB.click('#hud-save-alert [data-action="retry-meta-save"]');
      await pageB.waitForTimeout(60);
      assert.notEqual((await getActiveElementInfo(pageB))?.tag, "BODY", "retry-meta-save recovery must keep focus off BODY (A-6)");
      await pageB.evaluate(() => { Storage.prototype.setItem = window.__e2eOrigSetM; });
    }
  },

  // ==================== E2E-T5-05: A-8 Craft Cleanup + A-9 Keyboard Contracts + A-10 Stacking & Floating Cards ====================
  {
    id: "E2E-T5-05",
    title: "A-8/A-9/A-10: Craft modal cleanup, popover Esc, welcome F3 guard, HUD button Space, cutscene-drawer exclusion & floating card focus",
    features: ["A-8", "A-9", "A-10", "T2", "T3"],
    async fn(env) {
      const page = await env.openPage("t5-05");
      await env.gotoWelcome(page);

      // A-9: F3 blocked on welcome screen
      await page.keyboard.press("F3");
      await page.waitForTimeout(80);
      assert.equal(await page.evaluate(() => !!document.querySelector("#action-telemetry-panel.open")), false, "F3 must not open telemetry on welcome screen (A-9)");

      // A-10: Cutscene blocks drawer stacking
      await page.click("#btn-start-new");
      await page.waitForSelector("#story-dialogue-bar.open");
      await page.click('.nav-tab-btn[data-tab="cultivate"]', { force: true });
      await page.waitForTimeout(80);
      assert.equal(await isDrawerOpen(page), false, "Drawer must not open over active cutscene (A-10)");
      await env.dismissOpeningIfAny(page);

      // A-8: closeModal() clears craftMinigame.open
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.realm = "spirit";
        api.openTaixuCraftMinigameModal("alchemy");
      });
      await page.waitForSelector('#modal-backdrop.open [data-modal-close="1"]');
      await page.click('#modal-backdrop.open [data-modal-close="1"]');
      await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
      await page.click("#btn-open-settings");
      await page.waitForSelector("#modal-backdrop.open");
      await page.keyboard.press("Space");
      await page.waitForTimeout(60);
      const craftState = await page.evaluate(() => {
        const cm = window.__CHENYUAN_V23__.getState().craftMinigame;
        return { open: cm.open, strikes: cm.strikes };
      });
      assert.equal(craftState.open, false, "closeModal() must reset craftMinigame.open (A-8)");
      assert.equal(craftState.strikes, 0, "Space in Settings must not fire craftMinigame strikes (A-8)");
      await closeModalEsc(page);

      // A-9: #pavilion-popover Escape + focus return & Space on focused HUD button
      await page.click("#btn-pavilion-menu");
      await page.waitForSelector("#pavilion-popover.open");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(60);
      assert.equal(await page.evaluate(() => !!document.querySelector("#pavilion-popover.open")), false, "Escape must close #pavilion-popover (A-9)");
      assert.equal((await getActiveElementInfo(page))?.id, "btn-pavilion-menu", "Escape must return focus to #btn-pavilion-menu (A-9)");

      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.enterSanctumHub();
        api.getState().arena.player.dashCd = 0;
      });
      await page.focus("#btn-goals-modal");
      await page.keyboard.press("Space");
      await page.waitForTimeout(100);
      assert.equal(await isModalOpen(page), true, "Space on focused #btn-goals-modal must open Goals modal (A-9)");
      assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.player.dashCd), 0, "Space on focused HUD button must not fire dash (A-9)");
      await closeModalEsc(page);

      // A-10: Floating HUD cards keep focus off BODY
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const item = api.rollGearItem(2, 2, "weapon");
        item.name = "玄品·E2E试剑";
        item.sell = 30;
        api.acquireGearItem(item);
        api.requestCalmReevaluation({ immediate: true });
      });
      await page.waitForSelector('#gear-compare-card [data-action="compare-smelt-new"]', { state: "visible" });
      await page.waitForTimeout(300);
      await page.focus('#gear-compare-card [data-action="compare-smelt-new"]');
      await page.keyboard.press("Enter");
      await page.waitForTimeout(60);
      assert.equal((await getActiveElementInfo(page))?.dataAction, "compare-smelt-new", "Step 1 smelt arm must keep focus on smelt button (A-10)");
      await page.focus('#gear-compare-card [data-action="compare-keep-bag"]');
      await page.keyboard.press("Enter");
      await page.waitForTimeout(60);
      assert.notEqual((await getActiveElementInfo(page))?.tag, "BODY", "compare-keep-bag must not drop focus to BODY (A-10)");
    }
  },

  // ==================== E2E-T5-06: B-1 Boss Rush rush_thunder + B-2 Custom Workshop Isolation ====================
  {
    id: "E2E-T5-06",
    title: "B-1/B-2: Boss Rush rush_thunder survives live loop without TDZ crash; Custom Workshop leaks zero curios/loot/wins",
    features: ["B-1", "B-2", "G4"],
    async fn(env) {
      const page = await env.openPage("t5-06");
      await env.continueSavedGame(page, {
        [STORAGE_KEY]: buildEnvelopeV2({
          game: buildLegacyEb0ea67Game({
            realm: "spirit",
            bestSpireFloor: 0,
            spireCurios: {},
            wins: 0,
            bonusStarPts: 0,
            unlockedSouls: ["blood_warden"]
          }),
          sanctumMode: true
        })
      });

      // B-1: rush_thunder affix runs cleanly with live mainLoop
      await page.evaluate(() => window.__CHENYUAN_V25__.openBossRushModal());
      await page.waitForSelector('#modal-backdrop.open [data-rush-affix="rush_thunder"]');
      await page.click('#modal-backdrop.open [data-rush-affix="rush_thunder"]');
      await page.evaluate(() => {
        window.__e2eOrigRand = Math.random;
        let n = 0;
        Math.random = () => (++n <= 12 ? 0.001 : window.__e2eOrigRand());
      });
      await page.click('#modal-backdrop.open [data-start-rush="1"]');
      await page.waitForTimeout(300);
      const t0 = await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.bossRush?.elapsed || 0);
      await page.waitForTimeout(300);
      const t1 = await page.evaluate(() => {
        Math.random = window.__e2eOrigRand;
        return window.__CHENYUAN_V25__.getState().arena.bossRush?.elapsed || 0;
      });
      assert.ok(t1 > t0 + 0.08, `Boss Rush rush_thunder must not freeze mainLoop (B-1: t0=${t0}, t1=${t1})`);

      // B-2: Custom Workshop uses runtime overlay & leaks nothing into STORAGE_KEY
      await page.keyboard.press("KeyH");
      await page.waitForTimeout(160);
      await page.evaluate(() => window.__CHENYUAN_V25__.openCustomWorkshopModal());
      await page.waitForSelector("#modal-backdrop.open #sel-ws-curio");
      await page.selectOption("#sel-ws-curio", "16");
      await page.click("#btn-launch-workshop");
      await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
      const wsMid = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        const boss = s.arena.enemies.find((e) => e.isBoss) || s.arena.enemies[0];
        if (boss) {
          boss.hp = 1;
          api.damageEnemy(boss, 999999, true);
        }
        return {
          isPractice: api.isPracticeModeActive(),
          effective: api.getCurioStacks(s.game, "curio_hongmeng_omni"),
          formalKeys: Object.keys(s.game.spireCurios || {}),
          wins: s.game.wins,
          starPts: s.game.bonusStarPts
        };
      });
      assert.equal(wsMid.isPractice, true, "Custom Workshop must run in practice isolation (B-2)");
      assert.equal(wsMid.effective, 2, "Workshop must provide Lv.2 test curio via overlay (B-2)");
      assert.deepEqual(wsMid.formalKeys, [], "Formal game.spireCurios must not be mutated (B-2)");
      assert.equal(wsMid.wins, 0, "Workshop boss kill must not leak formal wins (B-2)");
      assert.equal(wsMid.starPts, 0, "Workshop boss kill must not leak formal starPts (B-2)");

      await page.keyboard.press("KeyH");
      await page.waitForTimeout(160);
      const disk = (await readStorageJson(page, STORAGE_KEY)).parsed;
      assert.deepEqual(disk?.game?.spireCurios || {}, {}, "Disk spireCurios must remain empty (B-2)");
      assert.equal(disk?.game?.wins, 0, "Disk wins must remain 0 (B-2)");
    }
  },

  // ==================== E2E-T5-07: B-3 Practice Mode Isolation + B-4 Gourd Refill Gate + B-8 Hub->Stage Meditation Flush ====================
  {
    id: "E2E-T5-07",
    title: "B-3/B-4/B-8: Practice Mode blocks formal mutations; refill-gourd-now gated to calm Sanctum; Hub->Stage flushes meditation aging",
    features: ["B-3", "B-4", "B-8", "G4", "G8"],
    async fn(env) {
      const page = await env.openPage("t5-07");
      await env.continueSavedGame(page, {
        [STORAGE_KEY]: buildEnvelopeV2({
          game: buildLegacyEb0ea67Game({
            realm: "spirit",
            xp: 0,
            stones: 900,
            elapsedMonths: 10,
            atkFlatBonus: 0,
            inventory: { herb: 12, core: 4, healing_pill: 0, blood_fury_pill: 2, ascension_seal: 0 },
            defeatedStageBosses: { 0: true, 1: true, 2: true, 3: true, 4: true },
            seenCutscenes: { opening_scroll: true, enter_sect: true }
          }),
          sanctumMode: true
        }),
        [META_KEY]: buildMetaSave({ ascensions: 0 })
      });

      // B-3: Enter Boss Rush Wave 7 Practice Mode
      await page.evaluate(() => window.__CHENYUAN_V25__.startBossRushGauntlet(7));
      await page.waitForTimeout(120);
      const pracRes = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        const qOk = api.executeAlchemyQuickCraft("healing");
        const bRes = api.executeAlchemyBatchCraft("ascension", 5);
        api.consumeInventoryItem("blood_fury_pill");
        s.game.xp = s.realmSpec.xpCap;
        api.startLiveTribulation({ confirmed: true, mode: "defiant" });
        const trib = Boolean(s.arena.tribulation);
        const sv = api.saveGame();
        const sm = api.saveMeta();
        return {
          qOk,
          bOk: Boolean(bRes && bRes.ok),
          trib,
          sv,
          sm,
          stones: s.game.stones,
          atkFlatBonus: s.game.atkFlatBonus,
          bloodFury: s.game.inventory.blood_fury_pill
        };
      });
      assert.equal(pracRes.qOk, false, "Quick Craft blocked in Practice Mode (B-3)");
      assert.equal(pracRes.bOk, false, "Batch Craft blocked in Practice Mode (B-3)");
      assert.equal(pracRes.trib, false, "Live Tribulation blocked in Practice Mode (B-3)");
      assert.equal(pracRes.sv, false, "saveGame blocked in Practice Mode (B-3)");
      assert.equal(pracRes.sm, false, "saveMeta blocked in Practice Mode (B-3)");
      assert.equal(pracRes.atkFlatBonus, 0, "blood_fury_pill blocked in Practice Mode (B-3)");
      assert.equal(pracRes.bloodFury, 2, "blood_fury_pill not consumed in Practice Mode (B-3)");

      // B-4: refill-gourd-now disabled in combat, works in calm Sanctum
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.seenCutscenes = Object.assign({}, s.game.seenCutscenes, { enter_sect: true });
        api.initArenaStage(1, false);
        if (!s.arena.enemies.some((e) => e.hp > 0 && !e.isDummy && !e.isTreasure)) {
          api.spawnSingleEnemy("wolf", 950, 460, 1.0, false);
        }
        s.game.gourd.charges = 0;
        api.updateHud();
      });
      await openNavTab(page, "alchemy");
      const combatRefillDisabled = await page.evaluate(
        () => Boolean(document.querySelector('#jade-panel [data-action="refill-gourd-now"]')?.disabled)
      );
      assert.equal(combatRefillDisabled, true, "refill-gourd-now must be disabled outside calm Sanctum (B-4)");
      await closeModalEsc(page);

      // Return to calm Sanctum -> refill works -> then B-8 Hub->Stage meditation flush
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.enterSanctumHub();
        api.getState().game.gourd.charges = 0;
        api.updateHud();
      });
      await openNavTab(page, "alchemy");
      await page.click('#jade-panel [data-action="refill-gourd-now"]');
      const refilled = await page.evaluate(() => {
        const g = window.__CHENYUAN_V25__.getState().game.gourd;
        return g.charges === g.maxCharges;
      });
      assert.equal(refilled, true, "refill-gourd-now must refill gourd in calm Sanctum (B-4)");
      await closeModalEsc(page);

      // B-8: Meditate in Sanctum -> age 1 month -> depart via KeyH -> verify flushed to disk
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.elapsedMonths = 10;
        s.game.xp = 0;
        api.saveGame();
        api.focusBattlefield();
      });
      await page.keyboard.press("KeyB");
      await page.waitForFunction(() => window.__CHENYUAN_V25__.getState().arena.player.meditating === true);
      await page.evaluate(() => { window.__CHENYUAN_V25__.getState().arena.player.meditateAgeTick = 3.01; });
      await page.waitForFunction(() => {
        const s = window.__CHENYUAN_V25__.getState();
        return s.game.elapsedMonths >= 11 && s.arena.player.meditateAgedDirty === true;
      });
      await page.keyboard.press("KeyH");
      await page.waitForFunction(() => window.__CHENYUAN_V25__.getState().arena.sanctumMode === false);
      const afterDepart = await page.evaluate((sk) => ({
        dirty: window.__CHENYUAN_V25__.getState().arena.player.meditateAgedDirty,
        mem: window.__CHENYUAN_V25__.getState().game.elapsedMonths,
        disk: JSON.parse(localStorage.getItem(sk))?.game?.elapsedMonths
      }), STORAGE_KEY);
      assert.equal(afterDepart.dirty, false, "meditateAgedDirty cleared on departure (B-8)");
      assert.equal(afterDepart.disk, afterDepart.mem, "Hub->Stage departure must flush elapsedMonths to STORAGE_KEY (B-8)");
    }
  },

  // ==================== E2E-T5-08: B-5 Tribulation Escape Block + B-6 Star Chart G9 + B-7 Hotkey/Co-Op/Dawn Shield ====================
  {
    id: "E2E-T5-08",
    title: "B-5/B-6/B-7: Active tribulation blocks H/World Map; Star Chart avoids silent 60-stone buy; ]/[ /\\ respect pause, gates & shield cooldown",
    features: ["B-5", "B-6", "B-7", "G9", "S11+G7"],
    async fn(env) {
      const page = await env.openPage("t5-08");
      await env.startFreshGame(page);

      // B-5: Active Live Tribulation blocks KeyH, #btn-sanctum-hub & KeyM
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "qi";
        s.game.xp = api.getState().realmSpec.xpCap;
        s.game.defeatedStageBosses = { 0: true, 1: true };
        s.game.seenCutscenes = Object.assign({}, s.game.seenCutscenes, { enter_sect: true });
        api.initArenaStage(1, false);
        api.startLiveTribulation({ confirmed: true, mode: "defiant" });
        s.game.hp = 15;
        api.focusBattlefield();
      });
      assert.equal(await page.evaluate(() => Boolean(window.__CHENYUAN_V25__.getState().arena.tribulation)), true, "Live Tribulation precondition must be active (B-5)");
      await page.keyboard.press("KeyH");
      await page.click("#btn-sanctum-hub");
      await page.keyboard.press("KeyM");
      await page.waitForTimeout(80);
      const b5 = await page.evaluate(() => ({
        tribActive: Boolean(window.__CHENYUAN_V25__.getState().arena.tribulation),
        sanctum: window.__CHENYUAN_V25__.getState().arena.sanctumMode,
        modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open"))
      }));
      assert.equal(b5.tribActive, true, "KeyH/#btn-sanctum-hub/KeyM must not cancel active Live Tribulation (B-5)");
      assert.equal(b5.sanctum, false, "Must not escape to Sanctum during active tribulation (B-5)");
      assert.equal(b5.modalOpen, false, "Must not open World Map during active tribulation (B-5)");
      await page.evaluate(() => { window.__CHENYUAN_V25__.getState().arena.tribulation = null; });

      // B-6: Star Chart at 0 Star Points must not silently deduct 60 stones
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const g = api.getState().game;
        g.realm = "golden";
        g.stones = 200;
        g.litStars = [];
        api.openStarChartModal();
      });
      await page.waitForSelector("#modal-backdrop.open [data-light-star]");
      for (let i = 0; i < 20; i++) {
        const left = await page.evaluate(() => {
          const m = (document.querySelector("#modal-content")?.textContent || "").match(/可用星魂点：\s*(\d+)/);
          return m ? Number(m[1]) : 0;
        });
        if (left <= 0) break;
        await page.click('#modal-content [data-light-star]:not(.lit)');
        await page.waitForTimeout(30);
      }
      const stonesBefore = await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones);
      const litBefore = await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.litStars.length);
      await page.click('#modal-content [data-light-star]:not(.lit)');
      await page.waitForTimeout(60);
      assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.stones), stonesBefore, "Star node click at 0 points must NOT silently deduct 60 stones (B-6)");
      assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().game.litStars.length), litBefore, "Star node must NOT light at 0 points (B-6)");
      await closeModalEsc(page);

      // B-7: ]/[ /\ blocked in Photo Mode, 2P gated by realm+bonds, Righteous dawn shield has cooldown
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "mortal";
        s.game.aids = { shen: false, pei: false, lu: false, yan: false };
        s.game.bondTiers = { shen: 0, pei: 0, lu: 0, yan: 0 };
        s.game.karmaScore = 60;
        s.arena.player.shieldHp = 0;
        window.__CHENYUAN_V23__.toggleLocalCoop2P(false);
        window.__CHENYUAN_V23__.setCelestialTimePhase(0, true);
        api.focusBattlefield();
      });
      await page.keyboard.press("KeyP");
      await page.waitForTimeout(80);
      await page.keyboard.press("BracketRight");
      await page.keyboard.press("BracketLeft");
      for (let i = 0; i < 4; i++) await page.keyboard.press("Backslash");
      const inPhoto = await page.evaluate(() => ({
        coop: window.__CHENYUAN_V23__.getState().coop2P.active,
        shield: window.__CHENYUAN_V25__.getState().arena.player.shieldHp
      }));
      assert.equal(inPhoto.coop, false, "]/[ blocked in Photo Mode (B-7)");
      assert.equal(inPhoto.shield, 0, "\\ blocked in Photo Mode (B-7)");
      await closeModalEsc(page);

      // Unpaused Mortal + unbonded blocked; Foundation + shen bonded allowed
      await page.keyboard.press("BracketRight");
      assert.equal(await page.evaluate(() => window.__CHENYUAN_V23__.getState().coop2P.active), false, "Mortal unbonded 2P Co-Op blocked (B-7)");
      await page.evaluate(() => {
        const s = window.__CHENYUAN_V25__.getState();
        s.game.realm = "foundation";
        s.game.aids = { shen: true, pei: false, lu: false, yan: false };
        s.game.bondTiers = { shen: 1, pei: 0, lu: 0, yan: 0 };
        s.arena.player.shieldHp = 0;
        window.__CHENYUAN_V23__.setCelestialTimePhase(3, true);
        window.__CHENYUAN_V25__.focusBattlefield();
      });
      await page.keyboard.press("BracketRight");
      await page.keyboard.press("BracketLeft");
      const coopBonded = await page.evaluate(() => window.__CHENYUAN_V23__.getState().coop2P);
      assert.equal(coopBonded.active, true, "Bonded Foundation 2P Co-Op allowed (B-7)");
      assert.equal(coopBonded.partnerId, "shen", "Only bonded companions cycled by [ (B-7)");

      // Righteous dawn shield spam cooldown
      await page.keyboard.press("Backslash");
      assert.ok(await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.player.shieldHp) > 0, "First dawn transition grants Righteous shield (B-7)");
      await page.evaluate(() => { window.__CHENYUAN_V25__.getState().arena.player.shieldHp = 0; });
      for (let i = 0; i < 4; i++) await page.keyboard.press("Backslash");
      assert.equal(await page.evaluate(() => window.__CHENYUAN_V25__.getState().arena.player.shieldHp), 0, "Spamming \\ cannot refresh Righteous dawn shield during cooldown (B-7)");
    }
  },

  // ==================== E2E-T5-09: R2 Surface A (R2A-1..R2A-6, DEFECT-R1-2B/2C) ====================
  {
    id: "E2E-T5-09",
    title: "R2A-1..6 & 2B/2C: Cross-tab delete protection, 2-tab bingjie CRDT safety, live-disk storage reconciliation, welcome/meta focus & popover layering",
    features: ["T1", "T2", "T3", "T5", "T6", "T7"],
    async fn(env) {
      // 1. R2A-1 + R2A-2: 2-tab cross-tab deletion & 2-tab bingjie CRDT bounce-back protection
      const page1 = await env.openPage("t5-09-p1");
      await env.startFreshGame(page1, "二轮对抗一");
      await page1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.realm = "spirit";
        api.saveGame();
      });

      const page2 = await env.openPage("t5-09-p2");
      await env.gotoWelcome(page2);
      await page2.waitForSelector("#btn-continue-save");
      await page2.click("#btn-continue-save");
      await page2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await page2.evaluate(() => { window.__CHENYUAN_V25__.saveMeta(); });
      await page1.waitForTimeout(100);

      // R2A-2: 2-tab bingjie under removeItem SecurityError must NOT bounce-back +40 pts
      await page1.evaluate((sk) => {
        window.__e2eR2OrigRm = Storage.prototype.removeItem;
        Storage.prototype.removeItem = function (k) {
          if (k === sk) throw new DOMException("Read-only storage", "SecurityError");
          return window.__e2eR2OrigRm.call(this, k);
        };
        window.__CHENYUAN_V25__.openLifespanExhaustedModal(true);
      }, STORAGE_KEY);
      for (let i = 0; i < 2; i++) {
        await page1.waitForSelector('#modal-backdrop.open [data-action="confirm-bingjie-reincarnate"]');
        await page1.click('#modal-backdrop.open [data-action="confirm-bingjie-reincarnate"]');
        await page1.waitForTimeout(200);
      }
      const r2a2 = await page1.evaluate(({ sk, mk }) => {
        Storage.prototype.removeItem = window.__e2eR2OrigRm;
        window.__CHENYUAN_V25__.closeModal();
        return {
          memPts: Number(window.__CHENYUAN_V25__.getMetaState().reincarnationPoints) || 0,
          diskPts: Number(JSON.parse(localStorage.getItem(mk) || "{}").reincarnationPoints) || 0,
          saveExists: Boolean(localStorage.getItem(sk))
        };
      }, { sk: STORAGE_KEY, mk: META_KEY });
      assert.equal(r2a2.memPts, 0, "R2A-2: 2-tab bingjie SecurityError must NOT farm +40 in memory");
      assert.equal(r2a2.diskPts, 0, "R2A-2: 2-tab bingjie SecurityError must NOT CRDT bounce-back +40 on META_KEY");
      assert.equal(r2a2.saveExists, true, "R2A-2: Primary save preserved");

      // R2A-1: Cross-tab deletion during Practice Mode + Sandbox Mode must NOT resurrect save
      await page1.evaluate(() => { window.__CHENYUAN_V25__.startBossRushGauntlet(7); });
      await openSettingsTab(page2, "controls");
      await page2.click('[data-action="confirm-reset-save"]');
      await page2.waitForSelector('[data-action="execute-reset-save"]');
      await page2.click('[data-action="execute-reset-save"]');
      await page2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "flex");
      await page1.waitForFunction((sk) => localStorage.getItem(sk) === null && Boolean(window.__CHENYUAN_V25__.getPersistenceState().saveConflictState?.deleted), STORAGE_KEY, { timeout: 3000 });
      const r2a1 = await page1.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const conf = api.getPersistenceState().saveConflictState;
        const ok = api.saveGame();
        return { deletedConf: Boolean(conf && conf.deleted), ok, diskRaw: localStorage.getItem(sk) };
      }, STORAGE_KEY);
      assert.equal(r2a1.deletedConf, true, "R2A-1: Practice Mode must detect cross-tab save deletion");
      assert.equal(r2a1.ok, false, "R2A-1: saveGame() must not resurrect deleted save");
      assert.equal(r2a1.diskRaw, null, "R2A-1: Deleted save must stay null");
      await page1.close();
      await page2.close();

      // 2. R2A-3 / DEFECT-R1-2C + R2A-4 + R2A-5 + R2A-6 + DEFECT-R1-2B
      const page3 = await env.openPage("t5-09-p3");
      await page3.goto(env.baseUrl, { waitUntil: "domcontentloaded" });
      await page3.evaluate(() => localStorage.clear());
      await env.startFreshGame(page3, "焦点叠层");
      // R2A-6: Pavilion popover over open drawer -> Tab stays inside popover, Escape closes popover first
      await openNavTab(page3, "cultivate");
      await page3.click("#btn-pavilion-menu");
      await page3.waitForSelector("#pavilion-popover.open");
      await page3.focus("#btn-ascension-roadmap");
      await page3.keyboard.press("Tab");
      const tabInPop = await page3.evaluate(() => Boolean(document.getElementById("pavilion-popover")?.contains(document.activeElement)));
      assert.equal(tabInPop, true, "R2A-6: Tab must stay inside #pavilion-popover over open drawer");
      await page3.keyboard.press("Escape");
      const afterPopEsc = await page3.evaluate(() => ({
        popOpen: Boolean(document.getElementById("pavilion-popover")?.classList.contains("open")),
        drawerOpen: Boolean(document.getElementById("jade-panel")?.classList.contains("drawer-open")),
        activeId: document.activeElement?.id || ""
      }));
      assert.equal(afterPopEsc.popOpen, false, "R2A-6: 1st Escape closes popover");
      assert.equal(afterPopEsc.drawerOpen, true, "R2A-6: Drawer stays open on 1st Escape");
      assert.equal(afterPopEsc.activeId, "btn-pavilion-menu", "R2A-6: Focus returns to #btn-pavilion-menu");
      await page3.keyboard.press("Escape");

      // R2A-3 / DEFECT-R1-2C: Alert-opened save_conflict closed by live corruption keeps focus off BODY
      const delayedForeign = await page3.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        api.saveGame();
        const envObj = JSON.parse(localStorage.getItem(sk));
        const foreign = Object.assign({}, envObj, { saveRev: envObj.saveRev + 4, tabId: "tab_e2e_r2a3" });
        const raw = JSON.stringify(foreign);
        localStorage.setItem(sk, raw);
        window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: raw }));
        api.closeModal();
        return raw;
      }, STORAGE_KEY);
      await page3.waitForSelector('#hud-save-alert [data-action="open-save-conflict"]');
      await page3.focus('#hud-save-alert [data-action="open-save-conflict"]');
      await page3.click('#hud-save-alert [data-action="open-save-conflict"]');
      await page3.waitForSelector('#modal-backdrop.open [data-action="stay-readonly-save"]');
      const r2cFocus = await page3.evaluate(({ sk, raw }) => {
        localStorage.setItem(sk, "{CORRUPT_E2E_2C");
        window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: raw }));
        return {
          modalOpen: Boolean(document.getElementById("modal-backdrop")?.classList.contains("open")),
          isBody: document.activeElement === document.body
        };
      }, { sk: STORAGE_KEY, raw: delayedForeign });
      assert.equal(r2cFocus.modalOpen, false, "DEFECT-R1-2C: Live corruption closes stale save_conflict modal");
      assert.equal(r2cFocus.isBody, false, "DEFECT-R1-2C: Focus remains off BODY after live corruption closes alert-opened modal");

      // DEFECT-R1-2B + R2A-4 + R2A-5: Practice Mode return-title-safe clears practice state, focuses welcome screen, and allows corrupt-meta reset with off-BODY focus
      await page3.evaluate((mk) => {
        const api = window.__CHENYUAN_V25__;
        api.saveGame({ forceOverwrite: true });
        api.getState().game.realm = "spirit";
        api.startBossRushGauntlet(7);
        localStorage.setItem(mk, "{CORRUPT_E2E_META_2B");
      }, META_KEY);
      await page3.focus("#btn-open-settings");
      await page3.click("#btn-open-settings");
      await page3.waitForSelector('#modal-backdrop.open [data-sys-tab="controls"]');
      await page3.click('#modal-backdrop.open [data-sys-tab="controls"]');
      await page3.waitForSelector('#modal-backdrop.open [data-action="return-title-safe"]');
      await page3.click('#modal-backdrop.open [data-action="return-title-safe"]');
      await page3.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "flex");
      const welcomeCheck = await page3.evaluate(() => ({
        inWelcome: Boolean(document.getElementById("welcome-screen")?.contains(document.activeElement)),
        isPractice: window.__CHENYUAN_V25__.isPracticeModeActive()
      }));
      assert.equal(welcomeCheck.inWelcome, true, "R2A-4: return-title-safe lands focus inside #welcome-screen");
      assert.equal(welcomeCheck.isPractice, false, "DEFECT-R1-2B: return-title-safe clears isPracticeModeActive()");

      await page3.focus('#save-status-banner [data-action="prompt-reset-corrupt-meta"]');
      await page3.click('#save-status-banner [data-action="prompt-reset-corrupt-meta"]');
      await page3.waitForSelector('#modal-backdrop.open [data-action="confirm-reset-corrupt-meta"]');
      await page3.click('#modal-backdrop.open [data-action="confirm-reset-corrupt-meta"]');
      await page3.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
      const metaResetCheck = await page3.evaluate(() => ({
        metaErr: Boolean(window.__CHENYUAN_V25__.getPersistenceState().metaReadError),
        isBody: document.activeElement === document.body,
        inWelcome: Boolean(document.getElementById("welcome-screen")?.contains(document.activeElement))
      }));
      assert.equal(metaResetCheck.metaErr, false, "DEFECT-R1-2B: Welcome corrupt-meta reset succeeds after leaving Practice Mode");
      assert.equal(metaResetCheck.isBody, false, "R2A-5: Welcome confirm-reset-corrupt-meta keeps focus off BODY");
      assert.equal(metaResetCheck.inWelcome, true, "R2A-5: Focus lands inside #welcome-screen");
    }
  },

  // ==================== E2E-T5-10: R2 Surface B (R2B-1..R2B-6, DEFECT-R1-2A) ====================
  {
    id: "E2E-T5-10",
    title: "R2B-1..6 & 2A: Full tribulation travel/mode guard, Practice snapshot & defeat retreat isolation, mid-combat alchemy/tea block, sandbox override cleanup, photo buttons & meditation flush",
    features: ["G4", "G6", "G8", "G9", "G11a"],
    async fn(env) {
      const page = await env.openPage("t5-10");
      await env.startFreshGame(page, "二轮对抗二");

      // R2B-1 / DEFECT-R1-2A: Active Hardcore Defiant Tribulation blocks Explore warp, quick-map, side modes & sandbox
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "spirit";
        s.game.xp = 99999;
        s.game.defeatedStageBosses = { 0: true, 1: true, 2: true, 3: true, 4: true };
        s.game.seenCutscenes = Object.assign({}, s.game.seenCutscenes, { enter_sect: true, enter_secret: true });
        api.initArenaStage(1, false);
        api.startLiveTribulation({ confirmed: true, mode: "defiant" });
        s.game.hp = 16;
        s.game.gourd.charges = 0;
        api.startBossRushGauntlet(7);
        api.startCelestialSpireRun(9);
        window.__CHENYUAN_V22__.launchCustomSeedEncounter();
        api.enterSandboxMode();
      });
      await openNavTab(page, "explore");
      await page.click('#jade-panel.drawer-open [data-warp-stage="0"]');
      await page.keyboard.press("Escape");
      await page.click("#btn-pavilion-menu");
      await page.waitForSelector("#pavilion-popover.open #btn-quick-map");
      await page.click("#btn-quick-map");
      await page.click("#btn-pavilion-menu");
      await page.waitForSelector("#pavilion-popover.open #btn-toggle-arcana-all");
      await page.click("#btn-toggle-arcana-all");
      const tribGuard = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        return {
          trib: Boolean(s.arena.tribulation),
          isPractice: api.isPracticeModeActive(),
          sandbox: api.isSandboxMode(),
          stageIdx: s.arena.stageIdx,
          gourd: s.game.gourd.charges
        };
      });
      assert.equal(tribGuard.trib, true, "R2B-1/2A: Live Tribulation survives blocked side modes, sandbox, and warp-stage");
      assert.equal(tribGuard.isPractice, false, "DEFECT-R1-2A: Active tribulation cannot enter Practice Mode");
      assert.equal(tribGuard.sandbox, false, "R2B-1: Active tribulation cannot enter Sandbox Mode");
      assert.equal(tribGuard.stageIdx, 1, "DEFECT-R1-2A: [data-warp-stage] blocked during Live Tribulation");
      assert.equal(tribGuard.gourd, 0, "R2B-1/3: Gourd stays at 0 during Live Tribulation");

      // R2B-3: Mid-combat [data-craft-open=alchemy] disabled & strikeTaixuCraftMinigame + companion tea cannot refill/heal
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.arena.tribulation = null;
        api.initArenaStage(2, false);
        s.game.hp = 35;
        s.game.gourd.charges = 0;
      });
      await openNavTab(page, "alchemy");
      const combatBlock = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const v23 = window.__CHENYUAN_V23__;
        const craftDisabled = Boolean(document.querySelector('#jade-panel [data-craft-open="alchemy"]')?.disabled);
        v23.openTaixuCraftMinigameModal("alchemy");
        v23.strikeTaixuCraftMinigame(true);
        v23.strikeTaixuCraftMinigame(true);
        v23.strikeTaixuCraftMinigame(true);
        api.closeModal();
        const s = api.getState();
        const hpBeforeTea = s.game.hp;
        const teaOk = api.triggerCompanionHubAction("shen", "tea");
        return { craftDisabled, gourd: s.game.gourd.charges, hpBeforeTea, hp: s.game.hp, teaOk };
      });
      assert.equal(combatBlock.craftDisabled, true, "R2B-3: [data-craft-open=alchemy] disabled in combat");
      assert.equal(combatBlock.gourd, 0, "R2B-3: Alchemy minigame must not refill gourd outside calm Sanctum");
      assert.equal(combatBlock.teaOk, false, "R2B-3: Companion tea blocked outside calm Sanctum");
      assert.equal(combatBlock.hp, combatBlock.hpBeforeTea, "R2B-3: Companion tea must not heal outside calm Sanctum");

      // R2B-2: Practice Mode snapshot isolation + retreat-sanctum defeat fix
      const beforePrac = await page.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        api.closeDrawer();
        api.enterSanctumHub();
        s.game.stones = 2000;
        s.game.retreats = 0;
        s.game.inventory.spirit_pill = 3;
        s.game.equippedGear.weapon.lvl = 0;
        api.saveGame();
        const rawBefore = localStorage.getItem(sk);
        api.startBossRushGauntlet(7);
        const enhRes = api.executeGearBatchEnhance("weapon", 2);
        api.consumeInventoryItem("spirit_pill");
        api.openDefeatDecisionModal(false);
        return { rawBefore, enhOk: Boolean(enhRes && enhRes.ok) };
      }, STORAGE_KEY);
      assert.equal(beforePrac.enhOk, false, "R2B-2: Batch enhance blocked in Practice Mode");
      await page.waitForSelector('#modal-backdrop.open [data-defeat-act="retreat-sanctum"]');
      await page.click('#modal-backdrop.open [data-defeat-act="retreat-sanctum"]');
      await page.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));
      const afterPrac = await page.evaluate((sk) => {
        const s = window.__CHENYUAN_V25__.getState();
        return { retreats: s.game.retreats, spiritPill: s.game.inventory.spirit_pill, rawAfter: localStorage.getItem(sk) };
      }, STORAGE_KEY);
      assert.equal(afterPrac.retreats, 0, "R2B-2: Practice retreat-sanctum must not increment formal retreats");
      assert.equal(afterPrac.spiritPill, 3, "R2B-2: Practice snapshot restores consumed spirit_pill");
      assert.equal(afterPrac.rawAfter, beforePrac.rawBefore, "R2B-2: STORAGE_KEY untouched across Practice defeat retreat");

      // R2B-4 + R2B-5 + R2B-6: Sandbox combat override cleanup, Photo Mode HUD button block, direct Boss Rush meditation flush
      const r2b4 = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const v23 = window.__CHENYUAN_V23__;
        const s = api.getState();
        s.game.realm = "mortal";
        s.game.aids = { shen: false, pei: false, lu: false, yan: false };
        s.game.bondTiers = { shen: 0, pei: 0, lu: 0, yan: 0 };
        api.initArenaStage(0, false);
        api.saveGame();
        api.enterSandboxMode();
        v23.toggleLocalCoop2P(true, "pei");
        s.arena.playableCharId = "shen";
        s.arena.swordIntent = 100;
        api.exitSandboxMode();
        return {
          coop: v23.getState().coop2P.active,
          playable: api.getState().arena.playableCharId,
          intent: api.getState().arena.swordIntent
        };
      });
      assert.equal(r2b4.coop, false, "R2B-4: exitSandboxMode resets 2P Co-Op");
      assert.equal(r2b4.playable, "player", "R2B-4: exitSandboxMode resets playableCharId");
      assert.equal(r2b4.intent, 0, "R2B-4: exitSandboxMode resets swordIntent");

      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "golden";
        s.game.aids = { shen: true, pei: true, lu: true, yan: true };
        s.game.bondTiers = { shen: 2, pei: 2, lu: 2, yan: 2 };
        s.game.karmaScore = 60;
        s.arena.player.shieldHp = 0;
        window.__CHENYUAN_V23__.setCelestialTimePhase(0, true);
        api.focusBattlefield();
      });
      await page.keyboard.press("KeyP");
      await page.waitForTimeout(80);
      const r2b5 = await page.evaluate(() => {
        const pe = getComputedStyle(document.getElementById("arcana-vault-wrap")).pointerEvents;
        document.getElementById("btn-coop-2p")?.click();
        for (let i = 0; i < 4; i++) document.getElementById("btn-celestial-time")?.click();
        return {
          pe,
          coop: window.__CHENYUAN_V23__.getState().coop2P.active,
          shield: window.__CHENYUAN_V25__.getState().arena.player.shieldHp
        };
      });
      assert.equal(r2b5.pe, "none", "R2B-5: #arcana-vault-wrap pointer-events: none in Photo Mode");
      assert.equal(r2b5.coop, false, "R2B-5: #btn-coop-2p blocked in Photo Mode");
      assert.equal(r2b5.shield, 0, "R2B-5: #btn-celestial-time blocked in Photo Mode");
      await page.keyboard.press("Escape");

      // R2B-6: Meditation flush on direct Boss Rush Wave 7 entry
      await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "spirit";
        s.game.xp = 0;
        s.game.elapsedMonths = 11;
        api.enterSanctumHub();
        api.saveGame();
        api.focusBattlefield();
      });
      await page.keyboard.press("KeyB");
      await page.waitForFunction(() => window.__CHENYUAN_V25__.getState().arena.player.meditating === true);
      await page.evaluate(() => { window.__CHENYUAN_V25__.getState().arena.player.meditateAgeTick = 2.95; });
      await page.waitForFunction(() => {
        const s = window.__CHENYUAN_V25__.getState();
        return s.game.elapsedMonths >= 12 && s.arena.player.meditateAgedDirty === true;
      }, null, { timeout: 2500 });
      const r2b6 = await page.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        api.startBossRushGauntlet(7);
        const s = api.getState();
        return {
          meditating: s.arena.player.meditating,
          dirty: s.arena.player.meditateAgedDirty,
          diskMonths: JSON.parse(localStorage.getItem(sk))?.game?.elapsedMonths
        };
      }, STORAGE_KEY);
      assert.equal(r2b6.meditating, false, "R2B-6: Meditation stopped on direct Boss Rush entry");
      assert.equal(r2b6.dirty, false, "R2B-6: meditateAgedDirty cleared on direct Boss Rush entry");
      assert.ok(r2b6.diskMonths >= 12, `R2B-6: Meditation aging flushed to disk (got ${r2b6.diskMonths})`);
    }
  },

  // ==================== E2E-T5-11: Round 3 Surface A (R3A-1..R3A-5 + PR #26 Sandbox-Exit Guard) ====================
  {
    id: "E2E-T5-11",
    title: "R3A-1..R3A-5 + PR#26: Practice conflict overwrite, popover occlusion, delayed high-rev event, legacy sandbox overwrite & Dojo bar Escape/focus",
    features: ["R3A-1", "R3A-2", "R3A-3", "R3A-4", "R3A-5", "T2", "T6"],
    async fn(env) {
      // 1. R3A-1 (Case A foreign rev + Case B cross-tab delete) & R3A-3 (delayed higher-rev foreign StorageEvent)
      const p1 = await env.openPage("t5-11-p1");
      await env.startFreshGame(p1, "三轮演武冲突");
      await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "nascent";
        s.game.stones = 2500;
        s.game.inventory.spirit_pill = 3;
        api.enterSanctumHub();
        api.saveGame();
        api.startBossRushGauntlet(6);
        s.game.inventory.spirit_pill = 2; // mutated in Practice Mode
      });

      const p2 = await env.openPage("t5-11-p2");
      await env.gotoWelcome(p2);
      await p2.waitForSelector("#btn-continue-save");
      await p2.click("#btn-continue-save");
      await p2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      const tab2Rev = await p2.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.stones = 8888;
        api.saveGame();
        return api.getPersistenceState().loadedSaveRev;
      });
      await p1.waitForFunction(() => window.__CHENYUAN_V25__.getActiveModalKind() === "save_conflict", null, { timeout: 3000 });
      await p1.evaluate(() => { const tc = document.getElementById("toast-container"); if (tc) tc.innerHTML = ""; });
      await p1.click('[data-action="overwrite-with-current-save"]');
      await p1.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"), null, { timeout: 3000 });
      const r3a1A = await p1.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const disk = JSON.parse(localStorage.getItem(sk) || "null");
        return {
          isPractice: api.isPracticeModeActive(),
          diskRev: disk?.saveRev || 0,
          diskStones: disk?.game?.stones,
          diskPill: disk?.game?.inventory?.spirit_pill,
          activeTag: document.activeElement?.tagName,
          toasts: Array.from(document.querySelectorAll("#toast-container .toast-pill")).map(el => el.textContent.trim())
        };
      }, STORAGE_KEY);
      assert.equal(r3a1A.isPractice, false, "R3A-1A: Practice mode cleanly exited before overwrite");
      assert.ok(r3a1A.diskRev > tab2Rev, `R3A-1A: diskRev (${r3a1A.diskRev}) > tab2Rev (${tab2Rev})`);
      assert.equal(r3a1A.diskStones, 2500, "R3A-1A: Formal stones saved");
      assert.equal(r3a1A.diskPill, 3, "R3A-1A: Pristine formal spirit_pill (3) saved, not practice-mutated 2");
      assert.notEqual(r3a1A.activeTag, "BODY", "R3A-1A: Focus remains off BODY");
      assert.ok(r3a1A.toasts.some(t => t.includes("强制覆盖存档")), `R3A-1A: Toast feedback emitted (got: ${JSON.stringify(r3a1A.toasts)})`);

      // Case B: Cross-tab delete during Practice Mode -> overwrite recovers cleanly
      await p1.evaluate(() => {
        window.__CHENYUAN_V25__.startBossRushGauntlet(6);
        window.__CHENYUAN_V25__.getState().game.inventory.spirit_pill = 1;
      });
      await p2.reload({ waitUntil: "domcontentloaded" });
      await p2.waitForSelector("#btn-continue-save");
      await p2.click("#btn-continue-save");
      await p2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await openSettingsTab(p2, "controls");
      await p2.click('[data-action="confirm-reset-save"]');
      await p2.click('[data-action="execute-reset-save"]');
      await p1.waitForFunction(() => window.__CHENYUAN_V25__.getPersistenceState().saveConflictState?.deleted === true, null, { timeout: 3000 });
      await p1.click('[data-action="overwrite-with-current-save"]');
      await p1.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"), null, { timeout: 3000 });
      const r3a1B = await p1.evaluate((sk) => {
        const disk = JSON.parse(localStorage.getItem(sk) || "null");
        return {
          diskExists: Boolean(disk && disk.game),
          diskPill: disk?.game?.inventory?.spirit_pill,
          activeTag: document.activeElement?.tagName
        };
      }, STORAGE_KEY);
      assert.equal(r3a1B.diskExists, true, "R3A-1B: Cross-tab deleted save cleanly recreated");
      assert.equal(r3a1B.diskPill, 3, "R3A-1B: Recreated save holds pristine formal spirit_pill (3)");
      assert.notEqual(r3a1B.activeTag, "BODY", "R3A-1B: Focus off BODY");

      // R3A-3: Delayed foreign StorageEvent with higher saveRev over locally-owned v1 disk save
      await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        for (let i = 0; i < 4; i++) { api.getState().game.stones += 10; api.saveGame(); }
      });
      await p2.reload({ waitUntil: "domcontentloaded" });
      await p2.waitForSelector("#btn-continue-save");
      await p2.click("#btn-continue-save");
      await p2.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      const tab2HighRaw = await p2.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.stones += 55;
        api.saveGame();
        return localStorage.getItem(sk);
      }, STORAGE_KEY);
      await openSettingsTab(p2, "controls");
      await p2.click('[data-action="confirm-reset-save"]');
      await p2.click('[data-action="execute-reset-save"]');
      await p2.close();
      await p1.evaluate(() => window.__CHENYUAN_V25__.closeModal());
      await openSettingsTab(p1, "controls");
      await p1.click('[data-action="return-title-safe"]');
      await p1.waitForSelector("#btn-start-new");
      if (!(await p1.isVisible("#player-name-input"))) {
        await p1.click("#btn-toggle-origin");
        await p1.waitForSelector("#player-name-input", { state: "visible" });
      }
      await p1.fill("#player-name-input", "新世初卷");
      await p1.click("#btn-start-new");
      await p1.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      await p1.evaluate(() => { const b = document.getElementById("btn-dlg-skip"); if (b && b.offsetParent !== null) b.click(); });
      const r3a3 = await p1.evaluate(({ sk, raw }) => {
        const api = window.__CHENYUAN_V25__;
        const liveRev = JSON.parse(localStorage.getItem(sk)).saveRev;
        window.dispatchEvent(new StorageEvent("storage", { key: sk, newValue: raw, oldValue: null, storageArea: localStorage }));
        return {
          liveRev,
          foreignRev: JSON.parse(raw).saveRev,
          conflict: api.getPersistenceState().saveConflictState,
          modalOpen: document.getElementById("modal-backdrop").classList.contains("open")
        };
      }, { sk: STORAGE_KEY, raw: tab2HighRaw });
      assert.ok(r3a3.foreignRev > r3a3.liveRev, "R3A-3 precondition: foreign rev > local rev");
      assert.equal(r3a3.conflict, null, "R3A-3: Delayed higher-rev foreign StorageEvent ignored over locally owned disk save");
      assert.equal(r3a3.modalOpen, false, "R3A-3: No bogus conflict modal");

      // 2. R3A-2 (#pavilion-popover dismissal & welcome occlusion), R3A-4 (legacy sandbox overwrite + PR #26), R3A-5 (Dojo bar Escape & focus)
      await p1.click("#btn-pavilion-menu");
      await p1.waitForFunction(() => document.getElementById("pavilion-popover").classList.contains("open"));
      await p1.click("#btn-open-settings");
      await p1.waitForFunction(() => document.getElementById("modal-backdrop").classList.contains("open"));
      const popOpenAfterModal = await p1.evaluate(() => document.getElementById("pavilion-popover").classList.contains("open"));
      assert.equal(popOpenAfterModal, false, "R3A-2: openModal() dismisses #pavilion-popover");
      await p1.evaluate(() => document.getElementById("pavilion-popover").classList.add("open"));
      await p1.click('[data-sys-tab="controls"]');
      await p1.click('[data-action="return-title-safe"]');
      await p1.waitForSelector("#welcome-screen", { state: "visible" });
      await p1.keyboard.press("Tab");
      await p1.keyboard.press("Tab");
      const r3a2 = await p1.evaluate(() => ({
        popOpen: document.getElementById("pavilion-popover").classList.contains("open"),
        inWelcome: document.getElementById("welcome-screen").contains(document.activeElement)
      }));
      assert.equal(r3a2.popOpen, false, "R3A-2: return-title-safe closes #pavilion-popover");
      assert.equal(r3a2.inWelcome, true, "R3A-2: Tab on #welcome-screen stays inside #welcome-screen");

      // Continue game -> test R3A-4 (legacy no-tabId overwrite during Sandbox + PR #26 vol1PedestalMeta guard)
      await p1.click("#btn-continue-save");
      await p1.waitForFunction(() => document.getElementById("welcome-screen")?.style.display === "none");
      const r3a4 = await p1.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.name = "沙盒验真";
        s.game.openingChoice = "help";
        s.game.vol1PedestalMeta = { choice: "help", payoffShown: false };
        api.saveGame();
        api.enterSandboxMode();
        localStorage.setItem(sk, JSON.stringify({
          game: Object.assign(api.createFreshGame("旧版外来档", "sword_bone"), { stones: 777 }),
          stageIdx: 0, stanceIdx: 0, towerMode: false, sanctumMode: false
        }));
        api.exitSandboxMode();
        return {
          nameAfter: api.getState().game.name,
          payoffShownAfter: api.getState().game.vol1PedestalMeta?.payoffShown,
          modalKind: api.getActiveModalKind(),
          conflict: Boolean(api.getPersistenceState().saveConflictState)
        };
      }, STORAGE_KEY);
      assert.equal(r3a4.nameAfter, "沙盒验真", "R3A-4: exitSandboxMode restores preSandboxSnapshot on legacy overwrite");
      assert.equal(r3a4.payoffShownAfter, false, "PR #26: exitSandboxMode does not prematurely trigger vol1PedestalMeta payoff save");
      assert.equal(r3a4.conflict, true, "R3A-4: Legacy/no-tabId overwrite surfaces saveConflictState");
      assert.equal(r3a4.modalKind, "save_conflict", "R3A-4: save_conflict modal opens");
      await p1.click('[data-action="overwrite-with-current-save"]');
      await p1.waitForFunction(() => !document.getElementById("modal-backdrop")?.classList.contains("open"));

      // R3A-5: Dojo bar Escape & drill/action focus return
      await p1.evaluate(() => window.__CHENYUAN_V25__.enterSanctumHub());
      await p1.focus("#btn-toggle-dojo-bar");
      await p1.keyboard.press("Enter");
      await p1.waitForFunction(() => document.getElementById("dojo-control-bar").classList.contains("expanded"));
      await p1.keyboard.press("Escape");
      const r3a5Esc = await p1.evaluate(() => ({
        expanded: document.getElementById("dojo-control-bar").classList.contains("expanded"),
        activeId: document.activeElement?.id || ""
      }));
      assert.equal(r3a5Esc.expanded, false, "R3A-5: Escape collapses #dojo-control-bar");
      assert.equal(r3a5Esc.activeId, "btn-toggle-dojo-bar", "R3A-5: Escape restores focus to #btn-toggle-dojo-bar");

      await p1.keyboard.press("Enter");
      await p1.waitForFunction(() => document.getElementById("dojo-control-bar").classList.contains("expanded"));
      await p1.focus('[data-dojo-mode="drill_mark_detonate"]');
      await p1.keyboard.press("Enter");
      const r3a5Drill = await p1.evaluate(() => ({
        expanded: document.getElementById("dojo-control-bar").classList.contains("expanded"),
        activeId: document.activeElement?.id || ""
      }));
      assert.equal(r3a5Drill.expanded, false, "R3A-5: Drill selection collapses Dojo bar");
      assert.equal(r3a5Drill.activeId, "btn-toggle-dojo-bar", "R3A-5: Drill selection restores focus to #btn-toggle-dojo-bar");
    }
  },

  // ==================== E2E-T5-12: Round 3 Surface B (DEFECT-R2-2A/2B/2C + R3B-1..R3B-5) ====================
  {
    id: "E2E-T5-12",
    title: "DEFECT-R2-2A/2B/2C + R3B-1..R3B-5: Practice victory isolation & meta sync, Sanqing/gourd cleanup, tribulation bypass guards, Dojo intent & Sect Defense props",
    features: ["DEFECT-R2-2A", "DEFECT-R2-2B", "DEFECT-R2-2C", "R3B-1", "R3B-2", "R3B-3", "R3B-4", "R3B-5", "G4", "S1"],
    async fn(env) {
      const page = await env.openPage("t5-12");
      await env.startFreshGame(page, "三轮状态机隔离");

      // 1. DEFECT-R2-2A + DEFECT-R2-2C: Boss Rush 7 & Spire 9 Practice Victory isolate formal state, retain cross-tab META_KEY, block Cloud Import
      const r22ac = await page.evaluate(({ sk, mk }) => {
        const api = window.__CHENYUAN_V25__;
        const v21 = window.__CHENYUAN_V21__;
        const v24 = window.__CHENYUAN_V24__;
        const s = api.getState();
        s.game.realm = "nascent";
        s.game.stones = 2500;
        s.game.bonusStarPts = 0;
        s.game.inventory.spirit_pill = 3;
        api.enterSanctumHub();
        api.saveGame();
        const code = api.exportFullCloudSaveCode();

        api.startBossRushGauntlet(7);
        s.game.inventory.spirit_pill = 2;
        const cloudInPractice = v24.importFullCloudSaveCode(code);
        const curMeta = JSON.parse(localStorage.getItem(mk) || "{}");
        curMeta.reincarnationPoints = Math.max(40, (curMeta.reincarnationPoints || 0) + 40);
        localStorage.setItem(mk, JSON.stringify(curMeta));
        api.openBossRushVictoryModal();
        const rushWinMemPill = api.getState().game.inventory.spirit_pill;
        const rushWinMetaPts = api.getMetaState().reincarnationPoints;
        api.closeModal();
        window.dispatchEvent(new Event("pagehide"));
        const diskPillAfterRush = JSON.parse(localStorage.getItem(sk))?.game?.inventory?.spirit_pill;

        // Post-victory formal progression must not rewind on enterSanctumHub
        api.getState().game.stones = 2440;
        api.getState().game.bonusStarPts = 1;
        api.saveGame();
        api.enterSanctumHub();
        const stonesAfterHub = api.getState().game.stones;
        const starPtsAfterHub = api.getState().game.bonusStarPts;

        // Spire 9 Practice Victory
        api.startCelestialSpireRun(9);
        api.getState().game.inventory.spirit_pill = 1;
        v21.openSpireCurioDraftModal();
        const spireWinMemPill = api.getState().game.inventory.spirit_pill;
        api.closeModal();
        window.dispatchEvent(new Event("pagehide"));
        const diskPillAfterSpire = JSON.parse(localStorage.getItem(sk))?.game?.inventory?.spirit_pill;

        return {
          cloudInPractice,
          rushWinMemPill,
          rushWinMetaPts,
          diskPillAfterRush,
          stonesAfterHub,
          starPtsAfterHub,
          spireWinMemPill,
          diskPillAfterSpire
        };
      }, { sk: STORAGE_KEY, mk: META_KEY });
      assert.equal(r22ac.cloudInPractice, false, "DEFECT-R2-2A: Cloud import blocked in Practice Mode");
      assert.equal(r22ac.rushWinMemPill, 3, "DEFECT-R2-2A: Boss Rush 7 victory restores formal pill count");
      assert.ok(r22ac.rushWinMetaPts >= 40, "DEFECT-R2-2C: Cross-tab META_KEY points preserved on Practice exit");
      assert.equal(r22ac.diskPillAfterRush, 3, "DEFECT-R2-2A: pagehide after Boss Rush 7 victory does not persist practice pill loss");
      assert.equal(r22ac.stonesAfterHub, 2440, "DEFECT-R2-2A: Post-victory formal stones never rewound");
      assert.equal(r22ac.starPtsAfterHub, 1, "DEFECT-R2-2A: Post-victory formal bonusStarPts never rewound");
      assert.equal(r22ac.spireWinMemPill, 3, "DEFECT-R2-2A: Spire 9 victory restores formal pill count");
      assert.equal(r22ac.diskPillAfterSpire, 3, "DEFECT-R2-2A: pagehide after Spire 9 victory preserves formal pill count");

      // 2. R3B-1: Sandbox exit clears arena.sanqingState & Gourd soak timers
      const r3b1 = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const v24 = window.__CHENYUAN_V24__;
        const s = api.getState();
        s.game.realm = "mortal";
        s.game.gourd.soaks = ["iron_lotus", "samadhi_fire", "wind_feather", "crimson_vine"];
        api.initArenaStage(0, false);
        api.saveGame();
        api.enterSandboxMode();
        const sIn = api.getState();
        sIn.game.mp = 999; sIn.game.hp = 10; sIn.game.gourd.charges = 5;
        sIn.game.gourd.soaks = ["iron_lotus", "samadhi_fire", "wind_feather", "crimson_vine"];
        v24.triggerSanqingTriClones();
        api.useQuickHealingPill();
        api.exitSandboxMode();
        const sOut = api.getState();
        return {
          sanqingActive: v24.getState().sanqing.active,
          echoQueueLen: v24.getState().echoQueueLen,
          hyperArmor: sOut.arena.player.hyperArmorTimer,
          samadhi: sOut.arena.player.samadhiFireReady,
          haste: sOut.arena.player.gourdHasteTimer,
          crit: sOut.arena.player.gourdCritTimer
        };
      });
      assert.equal(r3b1.sanqingActive, false, "R3B-1: sanqingState deactivated on exitSandboxMode");
      assert.equal(r3b1.echoQueueLen, 0, "R3B-1: sanqingEchoQueue emptied on exitSandboxMode");
      assert.equal(r3b1.hyperArmor, 0, "R3B-1: hyperArmorTimer zeroed on exitSandboxMode");
      assert.equal(r3b1.samadhi, false, "R3B-1: samadhiFireReady cleared on exitSandboxMode");
      assert.equal(r3b1.haste, 0, "R3B-1: gourdHasteTimer zeroed on exitSandboxMode");
      assert.equal(r3b1.crit, 0, "R3B-1: gourdCritTimer zeroed on exitSandboxMode");

      // 3. R3B-2 + DEFECT-R2-2B + R3B-4: Live Tribulation from Sanctum clears Dojo/intent and blocks sanctum_portal, spring, Digit9 map, cloud import
      const r3b2 = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const v24 = window.__CHENYUAN_V24__;
        const s = api.getState();
        s.game.realm = "nascent";
        s.game.xp = api.REALMS.nascent.xpCap;
        s.game.defeatedStageBosses = { 0: true, 1: true, 2: true, 3: true };
        api.enterSanctumHub();
        api.setDojoMode("blade_clash");
        s.arena.swordIntent = 100;
        api.saveGame();
        const code = api.exportFullCloudSaveCode();
        api.startLiveTribulation({ confirmed: true, mode: "defiant" });
        s.game.hp = 20;
        s.game.gourd.charges = 0;
        const p = s.arena.player;
        [
          { id: "e2e_sp", kind: "sanctum_portal", name: "返洞府", x: p.x, y: p.y, r: 60 },
          { id: "e2e_spr", kind: "immortal_spring", name: "灵泉", x: p.x, y: p.y, r: 60 },
          { id: "e2e_mg", kind: "map_node_gate", name: "星图", x: p.x, y: p.y, r: 60 }
        ].forEach(pr => {
          s.arena.props.push(pr);
          s.arena.nearbyProp = pr;
          const btn = document.getElementById("btn-prop-interact");
          if (btn) { btn.style.display = "inline-flex"; btn.click(); }
        });
        const cloudOk = v24.importFullCloudSaveCode(code);
        return {
          tribActive: Boolean(s.arena.tribulation),
          sanctumMode: s.arena.sanctumMode,
          swordIntent: s.arena.swordIntent,
          dojoActive: document.getElementById("dojo-control-bar").classList.contains("active"),
          dummyCount: s.arena.enemies.filter(e => e.isDummy).length,
          hp: s.game.hp,
          gourd: s.game.gourd.charges,
          cloudOk
        };
      });
      await page.keyboard.press("Digit9");
      const mapOpenedDuringTrib = await isModalOpen(page);
      assert.equal(r3b2.tribActive, true, "DEFECT-R2-2B/R3B-2: Tribulation stays active against all bypass props");
      assert.equal(r3b2.sanctumMode, false, "R3B-2: sanctumMode cleared on startLiveTribulation");
      assert.equal(r3b2.swordIntent, 0, "R3B-4: Dojo swordIntent reset on startLiveTribulation");
      assert.equal(r3b2.dojoActive, false, "R3B-2: Dojo bar hidden during Live Tribulation");
      assert.equal(r3b2.dummyCount, 0, "R3B-2: Dojo dummy removed during Live Tribulation");
      assert.equal(r3b2.hp, 20, "R3B-2: HP unhealed during Live Tribulation");
      assert.equal(r3b2.gourd, 0, "R3B-2: Gourd unrefilled during Live Tribulation");
      assert.equal(r3b2.cloudOk, false, "R3B-2: Cloud import blocked during Live Tribulation");
      assert.equal(mapOpenedDuringTrib, false, "R3B-2: Digit9 dungeon map blocked during Live Tribulation");

      // 4. R3B-3 + R3B-4 + R3B-5: Workshop overdrive purge, Dojo fill-intent reset, Sect Defense mixed_ward purge
      const r3b345 = await page.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const v22 = window.__CHENYUAN_V22__;
        const v24 = window.__CHENYUAN_V24__;
        const s = api.getState();
        s.arena.tribulation = null;
        s.game.realm = "spirit";
        api.enterSanctumHub();
        v22.launchCustomSeedEncounter();
        s.game.mp = 999;
        v22.triggerAstralGiantForm();
        v24.triggerSanqingTriClones();
        v24.castShanheShejiDomain();
        api.startBossRushGauntlet(1);
        const rushAfterWorkshop = {
          astral: Boolean(s.arena.astralForm),
          astralEnergy: s.arena.astralEnergy,
          sanqing: v24.getState().sanqing.active,
          shanhe: Boolean(s.arena.shanheDomain)
        };
        api.enterSanctumHub();
        s.arena.swordIntent = 100;
        api.initArenaStage(0, false);
        const intentStage0 = s.arena.swordIntent;
        api.enterSanctumHub();
        api.setDojoMode("mixed_ward");
        s.arena.swordIntent = 100;
        api.startSectDefenseSiege();
        const leakedProps = s.arena.props.filter(pr => pr.isDojoProp || pr.kind === "ward_pylon" || pr.kind === "frost_crystal").length;
        const intentDefense = s.arena.swordIntent;
        return { rushAfterWorkshop, intentStage0, leakedProps, intentDefense };
      });
      assert.equal(r3b345.rushAfterWorkshop.astral, false, "R3B-3: Workshop astralForm purged on formal Boss Rush 1");
      assert.equal(r3b345.rushAfterWorkshop.astralEnergy, 0, "R3B-3: Workshop astralEnergy zeroed");
      assert.equal(r3b345.rushAfterWorkshop.sanqing, false, "R3B-3: Workshop sanqingState purged");
      assert.equal(r3b345.rushAfterWorkshop.shanhe, false, "R3B-3: Workshop shanheDomain purged");
      assert.equal(r3b345.intentStage0, 0, "R3B-4: Sanctum Dojo swordIntent reset on initArenaStage");
      assert.equal(r3b345.leakedProps, 0, "R3B-5: Sect Defense purges mixed_ward Dojo props");
      assert.equal(r3b345.intentDefense, 0, "R3B-4: Sect Defense resets Dojo swordIntent");
    }
  },

  // ==================== E2E-T5-13: Round 4 Convergence Gate (R4A-1/DEFECT-R3-2A + R4A-2/3 + R4B-1/2/3) ====================
  {
    id: "E2E-T5-13",
    title: "R4A-1..R4A-3 & R4B-1..R4B-3: Atomic Practice Quota overwrite, #welcome-screen Tab trap, Dojo .expanded cleanup, trial/stele tribulation guards, Dojo overdrive purge & Hardcore tribShield bypass",
    features: ["DEFECT-R3-2A", "R4A-1", "R4A-2", "R4A-3", "R4B-1", "R4B-2", "R4B-3", "T2", "T6", "G4"],
    async fn(env) {
      // 1. R4A-2: #welcome-screen Tab / Shift+Tab focus trap & occluded HUD click guards
      const p1 = await env.openPage("t5-13-p1");
      await env.gotoWelcome(p1);
      await p1.waitForSelector("#btn-start-new", { state: "visible" });
      await p1.focus("#btn-start-new");
      const welcomeTabs = [];
      for (let i = 0; i < 8; i++) {
        await p1.keyboard.press("Tab");
        welcomeTabs.push(await p1.evaluate(() => {
          const ws = document.getElementById("welcome-screen");
          return Boolean(ws && document.activeElement && ws.contains(document.activeElement));
        }));
      }
      assert.equal(welcomeTabs.every(Boolean), true, "R4A-2: Tab must remain strictly trapped inside #welcome-screen");
      await p1.focus("#btn-start-new");
      await p1.keyboard.press("Shift+Tab");
      const shiftWrappedInWelcome = await p1.evaluate(() => {
        const ws = document.getElementById("welcome-screen");
        return Boolean(ws && document.activeElement && ws.contains(document.activeElement));
      });
      assert.equal(shiftWrappedInWelcome, true, "R4A-2: Shift+Tab must wrap strictly inside #welcome-screen");

      const occludedRes = await p1.evaluate(() => {
        ["#btn-open-profile", "#btn-open-settings", "#btn-pavilion-menu", "#btn-goals-modal", "#btn-world-map", "#btn-sanctum-hub"].forEach(sel => {
          const el = document.querySelector(sel);
          if (el) el.click();
        });
        return {
          drawerOpen: document.getElementById("jade-panel").classList.contains("drawer-open"),
          modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
          pavOpen: document.getElementById("pavilion-popover").classList.contains("open"),
          pauseLen: window.__CHENYUAN_V25__.getPauseTokens().length
        };
      });
      assert.equal(occludedRes.drawerOpen, false, "R4A-2: Occluded #btn-open-profile blocked on #welcome-screen");
      assert.equal(occludedRes.modalOpen, false, "R4A-2: Occluded #btn-open-settings blocked on #welcome-screen");
      assert.equal(occludedRes.pavOpen, false, "R4A-2: Occluded #btn-pavilion-menu blocked on #welcome-screen");
      assert.equal(occludedRes.pauseLen, 0, "R4A-2: 0 pauseTokens leaked on #welcome-screen");

      // Start fresh game on p1
      await env.startFreshGame(p1, "四轮收敛终测");

      // 2. R4A-1 / DEFECT-R3-2A: Atomic Practice overwrite-with-current-save under QuotaExceededError (retry + stay-readonly-save)
      await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        s.game.realm = "nascent";
        s.game.stones = 2500;
        s.game.inventory.spirit_pill = 3;
        api.enterSanctumHub();
        api.saveGame();
        api.startBossRushGauntlet(7);
        s.game.inventory.spirit_pill = 2;
      });
      const p2 = await env.openPage("t5-13-p2");
      await env.gotoWelcome(p2);
      await p2.waitForSelector("#btn-continue-save", { state: "visible" });
      await p2.click("#btn-continue-save");
      await p2.waitForFunction(() => document.getElementById("welcome-screen").style.display === "none");
      await p2.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.stones = 9999;
        api.saveGame();
      });
      await waitForCrossTabConflict(p1);

      await p1.evaluate((sk) => {
        window.__e2eOrigSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k, v) {
          if (k === sk) throw new DOMException("Quota exceeded", "QuotaExceededError");
          return window.__e2eOrigSetItem.call(this, k, v);
        };
      }, STORAGE_KEY);
      await p1.click('[data-action="overwrite-with-current-save"]');
      const quotaRollback = await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        return {
          modalOpen: document.getElementById("modal-backdrop").classList.contains("open"),
          isPractice: api.isPracticeModeActive(),
          sanctumMode: s.arena.sanctumMode,
          bossRushActive: Boolean(s.arena.bossRush && s.arena.bossRush.active),
          writeErr: api.getPersistenceState().storageWriteError?.message || "",
          focusIsBody: document.activeElement === document.body
        };
      });
      assert.equal(quotaRollback.modalOpen, true, "R4A-1: Modal stays open on QuotaExceededError");
      assert.equal(quotaRollback.isPractice, true, "R4A-1: Practice Mode atomically rolled back");
      assert.equal(quotaRollback.sanctumMode, false, "R4A-1: sanctumMode stays false on QuotaExceededError");
      assert.equal(quotaRollback.bossRushActive, true, "R4A-1: Boss Rush Practice stays intact");
      assert.ok(quotaRollback.writeErr.includes("QuotaExceededError"), "R4A-1: Explicit QuotaExceededError message recorded");
      assert.equal(quotaRollback.focusIsBody, false, "R4A-1: Focus stays off BODY");

      // Retry after quota clears -> pristine formal snapshot written & clean Sanctum Hub
      await p1.evaluate(() => {
        if (window.__e2eOrigSetItem) {
          Storage.prototype.setItem = window.__e2eOrigSetItem;
          delete window.__e2eOrigSetItem;
        }
      });
      await p1.click('[data-action="overwrite-with-current-save"]');
      await p1.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));
      const retryOk = await p1.evaluate((sk) => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        const disk = JSON.parse(localStorage.getItem(sk) || "null");
        return {
          isPractice: api.isPracticeModeActive(),
          sanctumMode: s.arena.sanctumMode,
          nonDummyEnemies: s.arena.enemies.filter(e => !e.isDummy).length,
          propsCount: s.arena.props.length,
          dojoActive: document.getElementById("dojo-control-bar").classList.contains("active"),
          diskStones: disk?.game?.stones,
          diskPill: disk?.game?.inventory?.spirit_pill
        };
      }, STORAGE_KEY);
      assert.equal(retryOk.isPractice, false, "R4A-1 Retry: Exited Practice Mode");
      assert.equal(retryOk.sanctumMode, true, "R4A-1 Retry: Landed cleanly in Sanctum Hub");
      assert.equal(retryOk.nonDummyEnemies, 0, "R4A-1 Retry: 0 stranded Practice bosses in Sanctum Hub");
      assert.ok(retryOk.propsCount >= 4, "R4A-1 Retry: Full Sanctum props present");
      assert.equal(retryOk.dojoActive, true, "R4A-1 Retry: Dojo control bar active");
      assert.equal(retryOk.diskStones, 2500, "R4A-1 Retry: Formal stones restored on disk");
      assert.equal(retryOk.diskPill, 3, "R4A-1 Retry: Formal pills restored on disk");

      // Second QuotaExceededError -> stay-readonly-save -> Practice coherent & KeyH exits cleanly
      await p1.evaluate(() => { window.__CHENYUAN_V25__.startBossRushGauntlet(7); });
      await p2.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.getState().game.stones = 7777;
        api.saveGame({ forceOverwrite: true });
      });
      await waitForCrossTabConflict(p1);
      await p1.evaluate((sk) => {
        window.__e2eOrigSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function(k, v) {
          if (k === sk) throw new DOMException("Quota exceeded", "QuotaExceededError");
          return window.__e2eOrigSetItem.call(this, k, v);
        };
      }, STORAGE_KEY);
      await p1.click('[data-action="overwrite-with-current-save"]');
      await p1.click('[data-action="stay-readonly-save"]');
      await p1.waitForFunction(() => !document.getElementById("modal-backdrop").classList.contains("open"));
      const roState = await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        if (window.__e2eOrigSetItem) {
          Storage.prototype.setItem = window.__e2eOrigSetItem;
          delete window.__e2eOrigSetItem;
        }
        return {
          isPractice: api.isPracticeModeActive(),
          sanctumMode: s.arena.sanctumMode,
          bossRushActive: Boolean(s.arena.bossRush && s.arena.bossRush.active)
        };
      });
      assert.equal(roState.isPractice, true, "R4A-1 ReadOnly: Practice Mode stays intact");
      assert.equal(roState.sanctumMode, false, "R4A-1 ReadOnly: No stranded boss in Sanctum");
      assert.equal(roState.bossRushActive, true, "R4A-1 ReadOnly: Boss Rush stays coherent");
      await p1.evaluate(() => { window.__CHENYUAN_V25__.focusBattlefield(); });
      await p1.keyboard.press("KeyH");
      const keyHExit = await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const s = api.getState();
        api.saveGame({ forceOverwrite: true, userInitiated: true });
        return {
          isPractice: api.isPracticeModeActive(),
          sanctumMode: s.arena.sanctumMode,
          nonDummyEnemies: s.arena.enemies.filter(e => !e.isDummy).length,
          dojoActive: document.getElementById("dojo-control-bar").classList.contains("active")
        };
      });
      assert.equal(keyHExit.isPractice, false, "R4A-1 KeyH: Exited Practice cleanly");
      assert.equal(keyHExit.sanctumMode, true, "R4A-1 KeyH: Entered Sanctum cleanly");
      assert.equal(keyHExit.nonDummyEnemies, 0, "R4A-1 KeyH: 0 stranded bosses");
      assert.equal(keyHExit.dojoActive, true, "R4A-1 KeyH: Dojo bar active");
      await p2.close();

      // 3. R4A-3: Leaving Sanctum via initArenaStage & Custom Seed clears #dojo-control-bar.expanded; Unlock Card Escape unaffected
      await p1.focus("#btn-toggle-dojo-bar");
      await p1.keyboard.press("Enter");
      await p1.waitForFunction(() => document.getElementById("dojo-control-bar").classList.contains("expanded"));
      const r4a3 = await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        api.initArenaStage(0, false);
        const db = document.getElementById("dojo-control-bar");
        const afterStage = { active: db.classList.contains("active"), expanded: db.classList.contains("expanded") };
        api.enterSanctumHub();
        db.classList.add("expanded");
        window.__CHENYUAN_V22__.launchCustomSeedEncounter();
        const afterWorkshop = { active: db.classList.contains("active"), expanded: db.classList.contains("expanded") };
        api.initArenaStage(0, false);
        const s = api.getState();
        s.arena.enemies = [];
        s.game.realm = "qi";
        s.game.seenUnlockIds = [];
        api.queueNewUnlockCardsForState(s.game);
        api.flushNewUnlockCard();
        db.classList.add("expanded");
        api.focusBattlefield();
        return { afterStage, afterWorkshop };
      });
      assert.equal(r4a3.afterStage.active, false, "R4A-3: initArenaStage clears .active");
      assert.equal(r4a3.afterStage.expanded, false, "R4A-3: initArenaStage clears .expanded");
      assert.equal(r4a3.afterWorkshop.active, false, "R4A-3: Custom Workshop clears .active");
      assert.equal(r4a3.afterWorkshop.expanded, false, "R4A-3: Custom Workshop clears .expanded");
      await p1.keyboard.press("Escape");
      const cardAfterEsc = await p1.evaluate(() => {
        document.getElementById("dojo-control-bar").classList.remove("expanded");
        return window.__CHENYUAN_V25__.getActiveUnlockCardId();
      });
      assert.equal(cardAfterEsc, null, "R4A-3: 1st Escape dismisses visible Unlock Card without being stolen by hidden Dojo bar");

      // 4. R4B-1 + R4B-2 + R4B-3: Trial-mode tribulation block, stele guards, Sanctum overdrive purge & Hardcore tribShield bypass
      const r4bAll = await p1.evaluate(() => {
        const api = window.__CHENYUAN_V25__;
        const v22 = window.__CHENYUAN_V22__;
        const v24 = window.__CHENYUAN_V24__;
        const s = api.getState();
        s.game.realm = "nascent";
        s.game.xp = api.REALMS.nascent.xpCap;
        s.game.defeatedStageBosses = { 0: true, 1: true, 2: true, 3: true };
        s.game.inventory.foundation_pill = 2;
        s.game.tribShield = 2;
        s.game.gourd.soaks = ["iron_lotus", "samadhi_fire", "wind_feather", "crimson_vine"];

        // R4B-1: Trials block Live Tribulation
        api.startSectDefenseSiege();
        api.startLiveTribulation({ confirmed: true, mode: "defiant" });
        const tribInSect = Boolean(s.arena.tribulation);
        api.startCloudSeaAerialStage();
        api.startLiveTribulation({ confirmed: true, mode: "defiant" });
        const tribInCloud = Boolean(s.arena.tribulation);
        api.startBossRushGauntlet(1);
        api.startLiveTribulation({ confirmed: true, mode: "defiant" });
        const tribInRush = Boolean(s.arena.tribulation);
        api.startCelestialSpireRun(1);
        api.startLiveTribulation({ confirmed: true, mode: "defiant" });
        const tribInSpire = Boolean(s.arena.tribulation);

        // R4B-2: Buff up in Sanctum Dojo -> transition to Boss Rush 1 & Hardcore Tribulation
        const buffSanctum = () => {
          api.enterSanctumHub();
          s.arena.astralEnergy = 100;
          s.game.mp = 999;
          s.game.hp = 50;
          s.game.gourd.charges = 5;
          api.useQuickHealingPill();
          const refillDojoBtn = document.querySelector('[data-dojo-act="refill-training"]');
          if (refillDojoBtn) refillDojoBtn.click();
          v24.triggerSanqingTriClones();
          v24.castShanheShejiDomain();
          v22.triggerAstralGiantForm();
          s.arena.player.invuln = 1.2;
          s.arena.player.shieldHp = 220;
          s.arena.pillAcolyte = { x: s.arena.player.x, y: s.arena.player.y, life: 10 };
        };
        buffSanctum();
        api.startBossRushGauntlet(1);
        const rushPurged = {
          astralEnergy: s.arena.astralEnergy,
          astralForm: Boolean(s.arena.astralForm),
          sanqing: v24.getState().sanqing.active,
          shanhe: Boolean(s.arena.shanheDomain),
          invuln: s.arena.player.invuln,
          shieldHp: s.arena.player.shieldHp,
          hyperArmor: s.arena.player.hyperArmorTimer,
          samadhi: s.arena.player.samadhiFireReady
        };

        buffSanctum();
        api.startLiveTribulation({ confirmed: true, mode: "defiant" });
        const tribPurgedInvuln = s.arena.player.invuln;
        const tribPurgedShield = s.arena.player.shieldHp;

        // R4B-1 mid-tribulation encounter_stele & boon_stele guards
        const p = s.arena.player;
        const encProp = { id: "e2e_enc", kind: "encounter_stele", name: "奇遇碑", x: p.x, y: p.y, r: 60 };
        const boonProp = { id: "e2e_boon", kind: "boon_stele", nodeId: "n0_0", name: "道韵碑", x: p.x, y: p.y, r: 60 };
        s.arena.props.push(encProp, boonProp);
        [encProp, boonProp].forEach(pr => {
          s.arena.nearbyProp = pr;
          const btn = document.getElementById("btn-prop-interact");
          if (btn) { btn.style.display = "inline-flex"; btn.click(); }
        });
        api.openEncounterModal(0);
        api.openRunBoonDraftModal("n0_0", false);
        const modalAfterSteles = document.getElementById("modal-backdrop").classList.contains("open");

        // R4B-3: Breakthrough pill blocked mid-tribulation & Hardcore bolt bypasses pre-existing tribShield
        api.consumeInventoryItem("foundation_pill");
        const pillsAfterBlocked = s.game.inventory.foundation_pill;
        s.game.hp = 500;
        const hpBeforeBolt = s.game.hp;
        s.arena.tribulation.strikes = [{ x: p.x, y: p.y, r: 72, t: 0.99, hit: false, parried: false }];
        api.stepArena(0.05);
        const hpAfterBolt = s.game.hp;
        const shieldAfterBolt = s.game.tribShield;
        s.arena.tribulation = null;
        return {
          tribInSect, tribInCloud, tribInRush, tribInSpire,
          rushPurged, tribPurgedInvuln, tribPurgedShield,
          modalAfterSteles, pillsAfterBlocked, hpBeforeBolt, hpAfterBolt, shieldAfterBolt
        };
      });
      assert.equal(r4bAll.tribInSect, false, "R4B-1: Sect Defense blocks tribulation");
      assert.equal(r4bAll.tribInCloud, false, "R4B-1: Cloud Sea blocks tribulation");
      assert.equal(r4bAll.tribInRush, false, "R4B-1: Boss Rush blocks tribulation");
      assert.equal(r4bAll.tribInSpire, false, "R4B-1: Celestial Spire blocks tribulation");
      assert.equal(r4bAll.rushPurged.astralEnergy, 0, "R4B-2: Boss Rush 1 purges astralEnergy");
      assert.equal(r4bAll.rushPurged.astralForm, false, "R4B-2: Boss Rush 1 purges astralForm");
      assert.equal(r4bAll.rushPurged.sanqing, false, "R4B-2: Boss Rush 1 purges sanqingState");
      assert.equal(r4bAll.rushPurged.shanhe, false, "R4B-2: Boss Rush 1 purges shanheDomain");
      assert.equal(r4bAll.rushPurged.invuln, 0, "R4B-2: Boss Rush 1 purges invuln");
      assert.equal(r4bAll.rushPurged.shieldHp, 0, "R4B-2: Boss Rush 1 purges shieldHp");
      assert.equal(r4bAll.rushPurged.hyperArmor, 0, "R4B-2: Boss Rush 1 purges hyperArmorTimer");
      assert.equal(r4bAll.rushPurged.samadhi, false, "R4B-2: Boss Rush 1 purges samadhiFireReady");
      assert.equal(r4bAll.tribPurgedInvuln, 0, "R4B-2: Hardcore Tribulation purges Sanctum invuln");
      assert.equal(r4bAll.tribPurgedShield, 0, "R4B-2: Hardcore Tribulation purges Sanctum shieldHp");
      assert.equal(r4bAll.modalAfterSteles, false, "R4B-1: encounter_stele & boon_stele blocked mid-tribulation");
      assert.equal(r4bAll.pillsAfterBlocked, 2, "R4B-3: Breakthrough pill consumption blocked mid-tribulation");
      assert.ok(r4bAll.hpAfterBolt < r4bAll.hpBeforeBolt, "R4B-3: Hardcore Defiant bolt bypasses game.tribShield");
      assert.equal(r4bAll.shieldAfterBolt, 2, "R4B-3: Pre-existing game.tribShield preserved untouched in Hardcore mode");
    }
  }
];
