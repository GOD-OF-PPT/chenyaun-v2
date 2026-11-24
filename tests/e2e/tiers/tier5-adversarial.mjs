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
            defeatedStageBosses: { 0: true, 1: true, 2: true, 3: true, 4: true }
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
  }
];
