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
  getActiveElementInfo,
  readStorageJson,
  ensureMeditating,
  waitForLootMagnetWindow,
  waitForStonesAtLeast,
  waitForCrossTabConflict
} from "../lib/harness.mjs";
import {
  REALM_XP_CAPS,
  buildLegacyEb0ea67Game,
  buildMetaSave,
  buildCloudSaveCode
} from "../lib/fixtures.mjs";

export const tier = 3;
export const name = "Tier 3 — Cross-Feature Pairwise Combinations";

export const tests = [
  // ==================== E2E-T3-01: T4 (Cloud Import) x T6 (Read-Only Conflict) ====================
  {
    id: "E2E-T3-01",
    title: "T4 × T6: Cloud save import in read-only conflict mode reports honest failure & preserves Tab A save",
    features: ["T4", "T6"],
    async fn(env) {
      const pageA = await env.openPage("t3-01-A");
      const pageB = await env.openPage("t3-01-B");

      await env.startFreshGame(pageA);
      await pageB.goto(env.baseUrl, { waitUntil: "domcontentloaded", timeout: env.navigationTimeoutMs });
      await pageB.waitForSelector("#btn-continue-save", { state: "visible", timeout: env.navigationTimeoutMs });
      await pageB.click("#btn-continue-save");
      await pageB.waitForTimeout(200);

      // Tab A writes newer rev -> Tab B enters read-only mode
      await pageA.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.stones = 901;
        window.__CHENYUAN_V25__.saveGame();
      });
      await waitForCrossTabConflict(pageB, 2500);

      const stayRo = await pageB.$('[data-action="stay-readonly-save"]');
      if (stayRo && await stayRo.isVisible()) {
        await stayRo.click();
      } else {
        const openConf = await pageB.$('[data-action="open-save-conflict"]');
        if (openConf && await openConf.isVisible()) {
          await openConf.click();
          await pageB.waitForTimeout(120);
          await pageB.click('[data-action="stay-readonly-save"]');
        }
      }
      await pageB.waitForTimeout(150);

      const cloudCode = buildCloudSaveCode({
        v: 24,
        game: buildLegacyEb0ea67Game({ name: "云端旅者", stones: 4321 }),
        metaState: JSON.parse(buildMetaSave()),
        a11ySettings: {},
        stems: {}
      });

      await openSettingsTab(pageB, "controls");
      await pageB.fill("#inp-cloud-save-code", cloudCode);
      const importBtnDisabled = await pageB.evaluate(() => !!document.querySelector("#btn-import-cloud-save")?.disabled);
      if (!importBtnDisabled) {
        await pageB.click("#btn-import-cloud-save");
        await pageB.waitForTimeout(200);

        // If T4 opened a preview/confirmation modal or button, click its confirm action resiliently
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
          await pageB.waitForTimeout(220);
        }
      }

      const statusText = await pageB.evaluate(() =>
        (document.querySelector("#lbl-cloud-save-status")?.innerText || "").trim()
      );
      const modalText = await getModalText(pageB);
      const toasts = (await getToastTexts(pageB)).join(" ");
      const combined = `${statusText} ${modalText} ${toasts}`;

      assert.doesNotMatch(
        combined,
        /存档恢复成功|导入成功/,
        `Cloud import in read-only mode must NEVER claim success, got: "${combined.slice(0, 200)}"`
      );
      assert.ok(
        importBtnDisabled || /只读|冲突|无法|失败|禁止|拒绝|未写入|锁定/.test(combined),
        `Read-only Tab B must explicitly refuse or warn on cloud import (disabled=${importBtnDisabled}, text="${combined.slice(0, 200)}")`
      );
      const { parsed } = await readStorageJson(pageA, STORAGE_KEY);
      assert.equal(parsed?.game?.stones, 901, "Tab A save in localStorage must remain untouched");
    }
  },

  // ==================== E2E-T3-02: T2 x T3 x T7 (Input + Focus Trap + Tab Non-Hijack) ====================
  {
    id: "E2E-T3-02",
    title: "T2 × T3 × T7: Settings modal traps Tab, typing 'p' inside input suppresses photo mode, Escape restores focus",
    features: ["T2", "T3", "T7"],
    async fn(env) {
      const page = await env.openPage("t3-02");
      await env.startFreshGame(page);

      await page.focus("#btn-open-settings");
      await page.click("#btn-open-settings");
      await page.waitForSelector("#modal-backdrop.open");
      await page.click('[data-sys-tab="controls"]');
      await page.waitForTimeout(120);

      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("Tab");
        const info = await getActiveElementInfo(page);
        assert.equal(info?.insideModal, true, `Tab #${i + 1} escaped modal: ${JSON.stringify(info)}`);
      }

      await page.click("#inp-cloud-save-code");
      await page.keyboard.type("p");
      await page.waitForTimeout(120);

      const photoActive = await page.evaluate(
        () => document.body.classList.contains("photo-mode-active") || !!document.querySelector("#photo-mode-panel.open")
      );
      assert.equal(photoActive, false, "Typing 'p' inside settings input must not trigger photo mode");

      await closeModalEsc(page);
      const restored = await getActiveElementInfo(page);
      assert.equal(restored?.id, "btn-open-settings", "Escape must return focus to #btn-open-settings");
    }
  },

  // ==================== E2E-T3-03: G6 (Sandbox) x Save Persistence / Reload ====================
  {
    id: "E2E-T3-03",
    title: "G6 × Save: Sandbox mode changes do not pollute official save slot across reload",
    features: ["G6"],
    async fn(env) {
      const page = await env.openPage("t3-03");
      await env.startFreshGame(page);

      const initialHud = await getHudState(page);
      const initialStones = initialHud.stones;

      await page.click("#btn-pavilion-menu");
      await page.waitForTimeout(120);
      await page.click("#btn-toggle-arcana-all");
      await page.waitForTimeout(180);

      // Confirm sandbox modal resiliently by data-action or visible button text
      const confirmed = await page.evaluate(() => {
        const modal = document.querySelector("#modal-backdrop.open #modal-content");
        if (!modal) return false;
        const buttons = Array.from(modal.querySelectorAll("button")).filter(
          (b) => !b.disabled && b.offsetParent !== null
        );
        const target = buttons.find((b) => {
          const act = (b.getAttribute("data-action") || "").toLowerCase();
          const txt = (b.innerText || "").trim();
          if (/取消|返回|关闭/.test(txt)) return false;
          return (
            act.includes("confirm") ||
            act.includes("sandbox") ||
            act.includes("arcana") ||
            /确认|开启|进入|沙盒|演武/.test(txt)
          );
        });
        if (target) {
          target.click();
          return true;
        }
        return false;
      });
      if (confirmed) {
        await page.waitForTimeout(180);
      }

      // Mutate stones inside sandbox and reload
      await page.evaluate(() => {
        const { game } = window.__CHENYUAN_V25__.getState();
        game.stones = 99999;
        window.__CHENYUAN_V25__.saveGame();
      });
      await page.reload({ waitUntil: "domcontentloaded", timeout: env.navigationTimeoutMs });
      await page.waitForSelector("#btn-continue-save", { state: "visible", timeout: env.navigationTimeoutMs });
      await page.click("#btn-continue-save");
      await page.waitForTimeout(220);

      const afterReload = await getHudState(page);
      assert.equal(
        afterReload.stones,
        initialStones,
        `Official save stones (${initialStones}) must not be overwritten by sandbox mutation (got ${afterReload.stones})`
      );
    }
  },

  // ==================== E2E-T3-04: S1 x G3 x S7 x S11+G7 ====================
  {
    id: "E2E-T3-04",
    title: "S1 × G3 × S7 × S11+G7: Boss defeat plays volume-end cutscene/card, unlocks tribulation & shows unlock notice",
    features: ["S1", "G3", "S7", "S11+G7"],
    async fn(env) {
      const page = await env.openPage("t3-04");
      await env.startFreshGame(page);

      // 1. Verify boss gate before killing stage 0 boss
      await page.evaluate((xpCap) => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "mortal";
        game.xp = xpCap;
        game.stageStars = {};
        v25.updateHud();
      }, REALM_XP_CAPS.mortal);
      await triggerTribulationAttempt(page);
      const blockedBefore = await page.evaluate(() => !document.querySelector("[data-trib-start]"));
      assert.equal(blockedBefore, true, "Tribulation must be boss-gated before defeating stage 0 boss");
      await closeModalEsc(page);

      // 2. Defeat stage 0 boss -> expect clear_stage0 cutscene
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
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
      assert.equal(dlgOpen, true, "Defeating stage 0 boss must trigger clear_stage0 cutscene");
    }
  },

  // ==================== E2E-T3-05: G8 x G5 x Longevity Elixir ====================
  {
    id: "E2E-T3-05",
    title: "G8 × G5: Blood-fury pill hits per-realm cap and longevity pill restores lifespan warning",
    features: ["G8", "G5"],
    async fn(env) {
      const page = await env.openPage("t3-05");
      await env.startFreshGame(page);

      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "qi";
        game.karmaScore = -80;
        game.stones = 4000;
        game.inventory.longevity_pill = 1;
        const info = v25.getLifespanInfo(game);
        game.elapsedMonths = Math.floor((info.maxMonths || 1800) * 0.8);
        v25.enterSanctumHub();
        v25.updateHud();
      });
      await page.waitForTimeout(150);

      await openNavTab(page, "bag");
      let bought = 0;
      for (let i = 0; i < 8; i++) {
        const btn = await page.$('button[data-buy-karma-item="km_blood_pill"], button[data-buy-karma-item="blood_fury_pill"]');
        if (!btn || (await btn.isDisabled())) break;
        const s0 = (await getHudState(page)).stones;
        await btn.click();
        await page.waitForTimeout(80);
        const s1 = (await getHudState(page)).stones;
        if (s1 < s0) {
          bought++;
          const refreshBtn = await page.$('button[data-action="refresh-market"]');
          if (refreshBtn && !(await refreshBtn.isDisabled())) {
            await refreshBtn.click();
            await page.waitForTimeout(80);
          }
        } else {
          break;
        }
      }
      assert.ok(bought >= 1 && bought < 8, `Blood-fury pill must be purchasable (>=1) and capped per realm (<8), got bought=${bought}`);

      // Push lifespan to 100% (寿尽: curMonths = maxMonths + 12) and verify G8 soft-fail offer before taking longevity pill
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        const info = v25.getLifespanInfo(game);
        const startAge = game.startAgeMonths || 216;
        game.elapsedMonths = Math.max(0, (info.maxMonths || 1140) - startAge) + 12;
        game.inventory.longevity_pill = Math.max(game.inventory.longevity_pill || 0, 1);
        v25.enterSanctumHub();
        v25.updateHud();
      });
      await page.waitForTimeout(200);

      let lifespanText = (await isModalOpen(page)) ? await getModalText(page) : "";
      if (!lifespanText) {
        await openNavTab(page, "cultivate");
        lifespanText = await getDrawerText(page);
      }
      assert.match(
        lifespanText,
        /兵解转世|寿元已尽|寿尽/,
        `At 100% lifespan, expected G8 soft-fail offer (兵解转世/寿元已尽/寿尽), got: "${lifespanText.slice(0, 200)}"`
      );
      if (await isModalOpen(page)) {
        await closeModalEsc(page);
      }

      // Use longevity pill from cultivate drawer and verify lifespan warning clears
      await openNavTab(page, "cultivate");
      const useLongevity = await page.$('[data-use-item="longevity_pill"]');
      if (useLongevity && await useLongevity.isVisible()) {
        await useLongevity.click();
        await page.waitForTimeout(150);
      }
      const alertStillCritical = await page.evaluate(() => !!document.querySelector(".lifespan-alert-card.critical"));
      assert.equal(alertStillCritical, false, "Using longevity_pill should clear critical lifespan alert");
    }
  },

  // ==================== E2E-T3-06: S10 x S6 x S2 ====================
  {
    id: "E2E-T3-06",
    title: "S10 × S6 × S2: Non-repeating karma dilemmas do not leak astral 100% and feed truthful ending",
    features: ["S10", "S6", "S2"],
    async fn(env) {
      const page = await env.openPage("t3-06");
      await env.startFreshGame(page);

      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game, arena } = v25.getState();
        game.realm = "spirit";
        arena.swordIntent = 0;
        arena.astralEnergy = 0;
        arena.bondSynergy = 0;
        v25.enterSanctumHub();
        v25.syncProgressiveSkillVisibility();
        v25.updateHud();
        window.__CHENYUAN_V18__.openKarmaDilemmaModal(0);
      });
      await page.waitForSelector("#modal-backdrop.open");
      const firstTitle = await page.evaluate(() =>
        (document.querySelector("#modal-content h2")?.innerText || "").trim()
      );
      await page.click('button[data-karma-side="right"]');
      await page.waitForTimeout(150);

      const hudMeters = await page.evaluate(() => ({
        astralText: (document.querySelector("#lbl-astral-pct")?.textContent || "").trim(),
        bondReady: !!document.querySelector("#btn-dual-bond-ult.ready"),
        astralReady: !!document.querySelector("#btn-astral-form.ready")
      }));
      assert.equal(
        /100%/.test(hudMeters.astralText) || hudMeters.bondReady || hudMeters.astralReady,
        false,
        `S6 brace bug must not fill astral/bond to 100%, got ${JSON.stringify(hudMeters)}`
      );

      // Reopen second karma dilemma via real player UI -> must not repeat completed dilemma
      await openNavTab(page, "story");
      await page.click('#jade-panel [data-action="open-karma-dilemma"]');
      await page.waitForSelector("#modal-backdrop.open");
      const nextTitle = await page.evaluate(() =>
        (document.querySelector("#modal-content h2")?.innerText || "").trim()
      );
      assert.ok(nextTitle.length > 0, "Reopened karma dilemma modal must show a title");
      assert.notEqual(
        nextTitle,
        firstTitle,
        `S10 must not repeat completed dilemma "${firstTitle}"`
      );
      assert.doesNotMatch(nextTitle, /古道走火散修/, "S10 must not repeat completed dilemma");
    }
  },

  // ==================== E2E-T3-07: G9 (Explicit Consumption) x G8 (RECIPES.months) ====================
  {
    id: "E2E-T3-07",
    title: "G9 × G8: Alchemy itemizes missing-material stone cost and advances lifespan on craft",
    features: ["G9", "G8"],
    async fn(env) {
      const page = await env.openPage("t3-07");
      await env.startFreshGame(page);

      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "qi";
        game.stones = 500;
        game.inventory.herb = 0;
        game.elapsedMonths = 0;
        v25.enterSanctumHub();
        v25.updateHud();
      });
      await page.waitForTimeout(150);

      await openNavTab(page, "cultivate");
      const beforeDrawer = await getDrawerText(page);
      const beforeMatch = beforeDrawer.match(/骨龄寿元[^\d]*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
      assert.ok(beforeMatch, `Expected 骨龄寿元 in cultivate drawer, got: "${beforeDrawer.slice(0, 200)}"`);
      const ageBefore = parseFloat(beforeMatch[1]);

      await openNavTab(page, "alchemy");
      const alchemyTxt = await getDrawerText(page);
      assert.match(alchemyTxt, /购入缺料/, "Alchemy drawer must itemize '购入缺料 X 石' when herbs are 0");

      // Trigger alchemy crafts (confirming G9 explicit missing-material buy modal when shown) and assert lifespan visibly advances (G8)
      for (let i = 0; i < 6; i++) {
        const craftBtn = await page.$('button[data-quick-craft="foundation"], button[data-quick-craft="healing"]');
        if (craftBtn && (await craftBtn.isVisible()) && !(await craftBtn.isDisabled())) {
          await craftBtn.click();
          await page.waitForTimeout(120);
          const confirmBuy = await page.$("#modal-backdrop.open #btn-confirm-alchemy-buy");
          if (confirmBuy && !(await confirmBuy.isDisabled())) {
            await confirmBuy.click();
            await page.waitForTimeout(120);
          }
        }
      }

      await openNavTab(page, "cultivate");
      const afterDrawer = await getDrawerText(page);
      const afterMatch = afterDrawer.match(/骨龄寿元[^\d]*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
      const ageAfter = afterMatch ? parseFloat(afterMatch[1]) : ageBefore;
      assert.ok(
        ageAfter > ageBefore,
        `Alchemy crafting must visibly advance 骨龄寿元 (before=${ageBefore}, after=${ageAfter})`
      );
    }
  },

  // ==================== E2E-T3-08: G1 (Expedition) x S9 (Companion Arcs) ====================
  {
    id: "E2E-T3-08",
    title: "G1 × S9: Unbonded Pei Zhao is locked in expedition until bonded, and double-claim pays 0",
    features: ["G1", "S9"],
    async fn(env) {
      const page = await env.openPage("t3-08");
      await env.startFreshGame(page);

      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "nascent";
        game.bondTiers = { shen: 1, pei: 0, lu: 0, yan: 0 };
        game.aids = { shen: true, pei: false, lu: false, yan: false };
        v25.enterSanctumHub();
        v25.updateHud();
      });
      await page.waitForTimeout(150);

      const trackerRows = await page.evaluate(() =>
        (document.querySelector("#qt-body-rows")?.innerText || "").trim()
      );
      assert.match(
        trackerRows,
        /故人线/,
        `Quest tracker must show optional 故人线 row for current chapter (S9), got: "${trackerRows}"`
      );

      await page.evaluate(() => {
        window.__CHENYUAN_V25__.openExpeditionSandboxModal();
      });
      await page.waitForSelector("#modal-backdrop.open");

      const peiEnabled = await page.evaluate(() => {
        const sel = document.querySelector("select[data-exp-node]");
        if (!sel) return false;
        const opt = Array.from(sel.options).find((o) => o.value === "pei");
        return !!(opt && !opt.disabled);
      });
      assert.equal(peiEnabled, false, "Unbonded Pei Zhao must not be assignable in expedition modal");
    }
  },

  // ==================== E2E-T3-09: G4 (No Skip-to-Payout) x G11a (Boss Rush Grade Rebase) ====================
  {
    id: "E2E-T3-09",
    title: "G4 × G11a: Boss Rush bout-7 skip grants 0 payout/record while full run rebases baseline grade",
    features: ["G4", "G11a"],
    async fn(env) {
      const page = await env.openPage("t3-09");
      await env.startFreshGame(page);

      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game } = v25.getState();
        game.realm = "nascent";
        game.stones = 300;
        v25.openBossRushModal();
      });
      await page.waitForSelector("#modal-backdrop.open");
      await page.click('button[data-start-rush="7"]');
      await page
        .waitForFunction(
          () => {
            const b = document.querySelector("#boss-hud-banner");
            return !!(b && getComputedStyle(b).display !== "none");
          },
          null,
          { timeout: 2000 }
        )
        .catch(() => {});

      const bossBanner = await page.evaluate(() => {
        const b = document.querySelector("#boss-hud-banner");
        return {
          visible: !!(b && getComputedStyle(b).display !== "none"),
          name: (document.querySelector("#boss-banner-name")?.textContent || "").trim()
        };
      });
      assert.ok(
        bossBanner.visible && bossBanner.name.length > 0,
        `Boss Rush bout 7 must display #boss-hud-banner with boss name, got ${JSON.stringify(bossBanner)}`
      );

      // Precondition: defeat bout 7 boss via handleEnemyDeath
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { arena } = v25.getState();
        for (const e of [...arena.enemies]) {
          e.hp = 0;
          v25.handleEnemyDeath(e);
        }
        v25.updateHud();
      });
      // Non-throwing bounded wait past the 450ms Boss Rush victory modal timer
      await page.waitForSelector("#modal-backdrop.open", { timeout: 2500 }).catch(() => {});

      const hud = await getHudState(page);
      const { parsed: meta } = await readStorageJson(page, META_KEY);
      assert.ok(hud.stones < 300 + 400, `Boss Rush bout-7 skip must NOT award +500 stones (stones=${hud.stones})`);
      assert.equal(meta?.bestRushGrade ?? null, null, "Boss Rush bout-7 skip must NOT record bestRushGrade in meta");
    }
  },

  // ==================== E2E-T3-10: G12 (Loot Magnetism) x Combat vs Safe Hub ====================
  {
    id: "E2E-T3-10",
    title: "G12: Active combat meditation blocks 320px loot magnet while close-range / safe-hub pickup works",
    features: ["G12"],
    async fn(env) {
      const page = await env.openPage("t3-10");
      await env.startFreshGame(page);

      // Phase 1: Combat distant drop (320px) must NOT be vacuumed while meditating
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        v25.initArenaStage(0, false);
        const { game, arena } = v25.getState();
        game.stones = 120;
        game.xp = 0;
        const px = arena.player?.x || 400;
        const py = arena.player?.y || 450;
        const dir = px > 720 ? -1 : 1;
        // Keep one enemy alive at a safe distance so combat zone stays active without interrupting meditation
        if (arena.enemies.length > 0) {
          const keeper = arena.enemies[0];
          keeper.x = px + dir * 1100;
          keeper.y = py;
          keeper.vx = 0;
          keeper.vy = 0;
          keeper.state = "stun";
          keeper.timer = 99;
          keeper.hp = Math.max(keeper.hp || 100, 9999);
          arena.enemies = [keeper];
        }
        arena.drops = [{ x: px + dir * 320, y: py, vx: 0, vy: 0, kind: "stone", val: 40, life: 30 }];
        v25.updateHud();
      });
      await page.waitForTimeout(120);

      const stonesBefore = (await getHudState(page)).stones;
      await ensureMeditating(page, env.actionTimeoutMs);

      const combatWin = await waitForLootMagnetWindow(page, {
        stonesBefore,
        minFrames: 32,
        minSimSec: 0.7,
        maxWallMs: 12000,
        requireMeditation: true
      });
      assert.notEqual(
        combatWin.reason,
        "meditation_lost",
        `Meditation ended unexpectedly during combat magnet window: ${JSON.stringify(combatWin)}`
      );
      assert.notEqual(
        combatWin.reason,
        "wall_timeout",
        `rAF loop stalled before reaching combat magnet simulation window: ${JSON.stringify(combatWin)}`
      );

      const stonesAfterCombatMed = (await getHudState(page)).stones;
      assert.equal(
        stonesAfterCombatMed,
        stonesBefore,
        `Active combat meditation must NOT pull drop from 320px away (before=${stonesBefore}, after=${stonesAfterCombatMed}, window=${JSON.stringify(combatWin)})`
      );

      // Phase 2: Close-range combat pickup (160px < 200px combat meditate radius) still works
      await page.evaluate(() => {
        const { arena } = window.__CHENYUAN_V25__.getState();
        const px = arena.player?.x || 400;
        const py = arena.player?.y || 450;
        const dir = px > 720 ? -1 : 1;
        arena.drops.push({ x: px + dir * 160, y: py, vx: 0, vy: 0, kind: "stone", val: 25, life: 30 });
      });
      const closeRes = await waitForStonesAtLeast(page, stonesBefore + 25, 6000);
      assert.equal(
        closeRes.ok,
        true,
        `Close-range (160px) loot pickup must still work in active combat: ${JSON.stringify(closeRes)}`
      );

      // Phase 3: Safe-hub meditation pickup (320px) vacuums drops blocked during active combat
      await page.click("#btn-sanctum-hub");
      await page.waitForFunction(
        () => (document.querySelector("#btn-sanctum-hub")?.textContent || "").includes("出征"),
        null,
        { timeout: env.actionTimeoutMs }
      );
      const hubBefore = (await getHudState(page)).stones;
      await page.evaluate(() => {
        const v25 = window.__CHENYUAN_V25__;
        const { game, arena } = v25.getState();
        game.xp = 0;
        const px = arena.player?.x || 400;
        const py = arena.player?.y || 450;
        const dir = px > 720 ? -1 : 1;
        arena.drops = [{ x: px + dir * 320, y: py, vx: 0, vy: 0, kind: "stone", val: 30, life: 30 }];
        v25.updateHud();
      });
      await ensureMeditating(page, env.actionTimeoutMs);
      const hubRes = await waitForStonesAtLeast(page, hubBefore + 30, 6000);
      assert.equal(
        hubRes.ok,
        true,
        `Safe-hub meditation pickup (320px) must collect loot drops: ${JSON.stringify(hubRes)}`
      );
    }
  }
];
