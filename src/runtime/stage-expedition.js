  // ==================== 6. SANCTUM HUB, CLEAN EXPEDITION ROOMS & 2-WAY BRANCHING PORTALS ====================
  function initScarfRibbon() {
    arena.player.scarfPts = [];
    for (let i = 0; i < 7; i++) {
      arena.player.scarfPts.push({ x: arena.player.x - i * 8, y: arena.player.y - 18 + i * 2 });
    }
  }

  function initAmbientEcosystem() {
    arena.ambientMotes = [];
    for (let i = 0; i < 28; i++) {
      arena.ambientMotes.push({
        x: Math.random(),
        y: Math.random(),
        r: 1.8 + Math.random() * 3.2,
        vx: (Math.random() - 0.5) * 0.0008,
        vy: -0.0005 - Math.random() * 0.0012,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  // G12: Safe-zone-scoped meditation drop magnet configuration
  const DROP_MAGNET_CONFIG = {
    normalRadius: 240,
    normalSpeed: 10.8,
    safeMeditateRadius: 1800,
    safeMeditateSpeed: 22.0,
    combatMeditateRadius: 200,
    combatMeditateSpeed: 10.8,
    gearRadius: 115
  };

  function isMeditationSafeZone() {
    if (!arena) return false;
    if (arena.tribulation) return false;
    if (arena.cloudFlight && arena.cloudFlight.active) return false;
    if (arena.sectDefense && arena.sectDefense.active) return false;
    if (arena.waveTransitioning) return false;
    const hasLiveHostiles = Array.isArray(arena.enemies) &&
      arena.enemies.some(e => e && e.hp > 0 && !e.isDummy && !e.isTreasure);
    if (hasLiveHostiles) return false;
    return true;
  }

  function hasHostileHazards() {
    if (!arena) return false;
    if (Array.isArray(arena.projectiles) && arena.projectiles.some(pr => pr && !pr.friendly && (pr.life === undefined || pr.life > 0))) return true;
    if (Array.isArray(arena.shockRings) && arena.shockRings.some(sr => sr && !sr.hitPlayer && (sr.r || 0) < (sr.maxR || 0))) return true;
    if (Array.isArray(arena.groundSweeps) && arena.groundSweeps.some(gs => gs && !gs.hitPlayer && !gs.vaulted && (gs.r || 0) < (gs.maxR || 0) && num(gs.dmg, 0) > 0)) return true;
    if (Array.isArray(arena.bossBeams) && arena.bossBeams.some(bm => bm && num(bm.t, 0) < num(bm.dur, 0))) return true;
    if (arena.bladeClash) return true;
    return false;
  }

  function isCombatCalm() {
    if (!game || !arena) return false;
    const ws = document.getElementById("welcome-screen");
    if (ws && ws.style.display !== "none") return false;
    if (arena.tribulation || arena.defeatPending || cutscene.active) return false;
    if (arena.stageClearPending || pendingVolumeRecapOnDismiss || deferredVolumeRecapModal || arena.waveTransitioning) return false;
    if (arena.cloudFlight && arena.cloudFlight.active) return false;
    if (arena.sectDefense && arena.sectDefense.active) return false;
    const hasAnyAliveEnemy = Array.isArray(arena.enemies) && arena.enemies.some(e => e && e.hp > 0);
    if (arena.bossRush && arena.bossRush.active && hasAnyAliveEnemy) return false;
    if (arena.celestialSpire && arena.celestialSpire.active && hasAnyAliveEnemy) return false;
    if (arena.customSeedRun && arena.customSeedRun.active && hasAnyAliveEnemy) return false;
    const hasLiveHostiles = Array.isArray(arena.enemies) &&
      arena.enemies.some(e => e && e.hp > 0 && !e.isDummy && !e.isTreasure);
    if (hasLiveHostiles || hasHostileHazards()) return false;
    return true;
  }

  function queueMaterialPickupFloat(matKey, matName, gainAmt, color) {
    if (!arena) return;
    if (!arena.pickupAgg || typeof arena.pickupAgg !== "object") arena.pickupAgg = {};
    if (!isCombatCalm()) {
      pushCombatInbox(`+${matName} ×${gainAmt}`, "mat", gainAmt);
    }
    const existing = arena.pickupAgg[matKey];
    if (existing) {
      existing.count += gainAmt;
      existing.timer = 1.5;
    } else {
      arena.pickupAgg[matKey] = { name: matName, count: gainAmt, color: color || "#ffe28a", timer: 1.5 };
    }
  }

  function stepPickupAggregator(dt, forceFlush = false) {
    if (!arena || !arena.pickupAgg) return;
    const keys = Object.keys(arena.pickupAgg);
    if (!keys.length) return;
    const px = arena.player ? arena.player.x : 720;
    const py = arena.player ? arena.player.y : 450;
    for (const k of keys) {
      const agg = arena.pickupAgg[k];
      if (!agg) { delete arena.pickupAgg[k]; continue; }
      agg.timer -= dt;
      if (forceFlush || agg.timer <= 0) {
        delete arena.pickupAgg[k];
        addFloat(`+${agg.name}${agg.count > 1 ? " ×" + agg.count : ""}`, px, py - 34, agg.color, 13, false, { banner: false, kind: "pickup" });
      }
    }
  }

  function hasPendingCalmWork() {
    if (!game) return false;
    if (combatInboxUnread > 0) return true;
    if (Array.isArray(game.pendingRewards) && game.pendingRewards.some(r => r && r.status !== "active")) return true;
    if (pendingCompareGear && game.gearBag && game.gearBag.includes(pendingCompareGear)) {
      const cmpEl = document.getElementById("gear-compare-card");
      if (cmpEl && cmpEl.style.display === "none") return true;
    }
    if (!sandboxMode && (activeUnlockCardId || pendingUnlockCardQueue.length > 0)) {
      const ulEl = document.getElementById("new-unlock-card");
      if (ulEl && ulEl.style.display === "none") return true;
    }
    return false;
  }

  function isCalmUiBlocked() {
    const ws = document.getElementById("welcome-screen");
    if (ws && ws.style.display !== "none") return true;
    const bd = document.getElementById("modal-backdrop");
    return Boolean(
      (bd && bd.classList.contains("open")) ||
      drawerOpen ||
      cutscene.active ||
      photoMode.active ||
      saveConflictState ||
      storageReadError ||
      storageWriteError ||
      saveReadOnlyMode ||
      arena.defeatPending ||
      arena.stageClearPending ||
      pendingVolumeRecapOnDismiss ||
      deferredVolumeRecapModal
    );
  }

  function requestCalmReevaluation({ immediate = false } = {}) {
    syncPendingRewardsBadge();
    if (!game) {
      if (document && document.body) document.body.classList.remove("combat-hot");
      return false;
    }
    const calm = isCombatCalm();
    if (document && document.body) {
      document.body.classList.toggle("combat-hot", !calm);
    }
    if (!calm) {
      arena.calmT = 0;
      arena.calmFlushed = false;
      renderGearCompareCard();
      renderActiveUnlockCard();
      return false;
    }
    if (immediate) {
      arena.calmT = Math.max(arena.calmT || 0, COMBAT_CALM_GRACE_SEC);
    }
    arena.calmFlushed = false;
    if (!isCalmUiBlocked() && (arena.calmT || 0) >= COMBAT_CALM_GRACE_SEC) {
      stepPickupAggregator(0, true);
      return flushCombatCalmQueue();
    }
    return false;
  }

  function stepCombatCalmScheduler(dt) {
    if (!game) {
      if (document && document.body) document.body.classList.remove("combat-hot");
      return;
    }
    stepPickupAggregator(dt, false);
    const calm = isCombatCalm();
    if (document && document.body) {
      document.body.classList.toggle("combat-hot", !calm);
    }
    if (!calm) {
      arena.calmT = 0;
      arena.calmFlushed = false;
      const cmpEl = document.getElementById("gear-compare-card");
      if ((cmpEl && cmpEl.style.display !== "none") || compareSmeltConfirm) {
        clearCompareSmeltConfirm();
        renderGearCompareCard();
      }
      const ulEl = document.getElementById("new-unlock-card");
      if (ulEl && ulEl.style.display !== "none") {
        renderActiveUnlockCard();
      }
      return;
    }
    if (!isCalmUiBlocked()) {
      arena.calmT = Math.min(10, (arena.calmT || 0) + dt);
      if (arena.calmT >= COMBAT_CALM_GRACE_SEC && (!arena.calmFlushed || hasPendingCalmWork())) {
        stepPickupAggregator(0, true);
        flushCombatCalmQueue();
      }
    }
  }

  function getDropMagnetParams() {
    const meditating = Boolean(arena && arena.player && arena.player.meditating);
    const safeZone = isMeditationSafeZone();
    if (!meditating) {
      return { radius: DROP_MAGNET_CONFIG.normalRadius, speed: DROP_MAGNET_CONFIG.normalSpeed, safeZone, meditating: false };
    }
    return {
      radius: safeZone ? DROP_MAGNET_CONFIG.safeMeditateRadius : DROP_MAGNET_CONFIG.combatMeditateRadius,
      speed: safeZone ? DROP_MAGNET_CONFIG.safeMeditateSpeed : DROP_MAGNET_CONFIG.combatMeditateSpeed,
      safeZone,
      meditating: true
    };
  }

  function toggleMeditation(forceState = null) {
    if (!game) return;
    const p = arena.player;
    const next = forceState !== null ? forceState : !p.meditating;
    if (p.meditating === next) return;
    p.meditating = next;
    p.meditateAgeTick = 0;
    if (next) {
      p.meditateAgedDirty = false;
      pointer.moveTarget = null;
      Sound.qiOrb(2);
      addRipple(p.x, p.y + 28, 72, "#ffe28a");
      const safeMed = isMeditationSafeZone();
      addFloat(
        arena.sanctumMode && safeMed ? "☯ 洞府聚灵 · 三倍吐纳/全屏吸纳" : safeMed ? "☯ 安全吐纳 · 全屏吸纳" : "☯ 战中吐纳 · 近身聚气",
        p.x, p.y - 54, "#ffe28a", 18, true
      );
    } else if (p.meditateAgedDirty) {
      p.meditateAgedDirty = false;
      if (!sandboxMode && !isPracticeModeActive()) saveGame();
    }
    updateHud();
  }

  function consumeZenEmpowerment() {
    const p = arena.player;
    if (p.meditating) {
      p.meditating = false;
      p.meditateAgeTick = 0;
      if (p.meditateAgedDirty) {
        p.meditateAgedDirty = false;
        if (!sandboxMode && !isPracticeModeActive()) saveGame();
      }
    }
    if ((p.zenStacks || 0) > 0) {
      const stacks = p.zenStacks;
      p.zenStacks = 0;
      Sound.clang(1.28, 0.12);
      addRipple(p.x, p.y + 24, 96, "#ffe28a");
      arena.slashes.push({ x: p.x, y: p.y, r: 135, ang: 0, t: 0, color: "#ffe28a", heavy: true });
      addFloat(`剑心出鞘 ×${stacks}！`, p.x, p.y - 62, "#ffe28a", 19, true);
      updateHud();
      return 1 + stacks * 0.40;
    }
    return 1.0;
  }

  function syncFlyingSwords() {
    if (!game) return;
    const targetCount = Math.max(0, Math.floor(num(getSwordCount(game), 2)));
    while (arena.swords.length < targetCount) {
      arena.swords.push({
        idx: arena.swords.length,
        x: arena.player.x, y: arena.player.y,
        vx: 0, vy: 0,
        state: "orbit",
        target: null, timer: Math.random() * 0.32,
        ringHitCd: 0,
        angle: (arena.swords.length * Math.PI * 2) / Math.max(1, targetCount),
        trail: []
      });
    }
    if (arena.swords.length > targetCount) arena.swords.length = targetCount;
  }

  function cycleSwordStance() {
    if (!game) return;
    arena.stanceIdx = (arena.stanceIdx + 1) % SWORD_STANCES.length;
    const st = SWORD_STANCES[arena.stanceIdx];
    Sound.clang(1.15, 0.11);
    arena.swords.forEach(sw => { sw.state = "orbit"; sw.timer = 0.08; });
    if (st.id === "giant") {
      arena.giantSword.x = arena.player.x;
      arena.giantSword.y = arena.player.y - 20;
      arena.giantSword.z = 65;
      arena.giantSword.state = "hover";
      arena.giantSword.timer = 0.35;
    }
    addRipple(arena.player.x, arena.player.y + 28, 64, st.color);
    addFloat(`剑阵 · 【${st.name}】`, arena.player.x, arena.player.y - 58, st.color, 20, true);
    showToast(`${st.name} · ${st.badge}`);
    saveGame();
    updateHud();
  }

  // Enter Peaceful Immortal Sanctuary Hub (`[H] 听雨洞府主城`)!
  function enterSanctumHub(opts = {}) {
    if (!game) return;
    const skipSave = !!(opts && opts.skipSave);
    if (!skipSave && game.openingChoice && (game.tutorialStep || 0) === 2) {
      advanceOnboardingStep(2);
      showToast("🏠 听雨洞府三大核心地标：紫微丹鼎（炼丹）、天工剑炉（锻剑）与九州出征阵门！");
    }
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;

    resetStageTransitionState();
    releasePauseToken(defeatPauseToken); defeatPauseToken = null;
    arena.stageEpoch += 1;
    arena.waveTransitioning = false;
    arena.sanctumMode = true;
    arena.towerMode = false;
    arena.bossRush = null;
    arena.dungeonMap = null;
    arena.cloudFlight = null;
    arena.sectDefense = null;
    arena.celestialSpire = null;
    restoreCustomSeedTempCurio();
    arena.customSeedRun = null;
    arena.bladeClash = null;
    arena.calmT = COMBAT_CALM_GRACE_SEC;
    arena.calmFlushed = false;
    arena.runBoons = [];
    arena.boonRerollsLeft = 1;
    arena.slashEchoCounter = 0;
    arena.player.boonOverloadTimer = 0;
    arena.defeatRevivesUsed = 0;
    arena.defeatPending = null;
    resetEncounterTelemetry();
    arena.nearbyProp = null;
    renderPropInteractHud();
    renderRunBoonStrip();
    renderGearCompareCard();
    arena.enemies = [];
    arena.projectiles = [];
    arena.drops = [];
    arena.props = [];
    arena.zones = [];
    arena.slashes = [];
    arena.lightnings = [];
    arena.decals = [];
    arena.sparks = [];
    arena.ripples = [];
    arena.qiStreams = [];
    arena.deathAnims = [];
    arena.tribulation = null;
    pointer.moveTarget = null;

    arena.activeAllies = [];
    arena.skyBolts = [];
    arena.shockRings = [];
    arena.bossBeams = [];
    arena.bladeArcs = [];
    arena.lotusVortexes = [];
    arena.thunderOrbs = [];
    arena.jadeDecoys = [];
    arena.frostPools = [];
    arena.witchTime = 0;
    arena.hitStop = 0;
    arena.bossDomain = null;
    arena.camFocusT = 0;
    if (game) game.location = "cave";
    playtestTelemetry.sanctumEnterCount += 1;
    transitionStageScene("arena_sanctum_hub", "hub");
    initAmbientEcosystem();
    if (!game.marketStock || !game.marketStock.length) refreshMarketStock();

    const st = getCombatStats(game);
    game.hp = st.maxHp;
    game.mp = st.maxMp;
    refillImmortalGourd();
    arena.groundSweeps = [];
    arena.meteorBursts = [];
    arena.blinkStreaks = [];
    arena.player.z = 0; arena.player.vz = 0; arena.player.plunging = false;
    arena.player.animState = "idle"; arena.player.animT = 0; arena.player.hitFlash = 0;
    if (hasDestinyFruit(game, "lotus_body")) {
      arena.player.shieldHp = Math.max(arena.player.shieldHp || 0, Math.round(st.maxHp * 0.35));
    }

    const startPos = clampToPlaza(w * 0.47, h * 0.54, w, h);
    arena.player.x = startPos.x;
    arena.player.y = startPos.y;
    initScarfRibbon();
    syncFlyingSwords();

    // Well-spaced symmetrical isometric courtyard layout (all 4 companions + 5-tier Sanctum landmarks!)
    const lvMap = ensureSanctumLevels(game);
    const hubKs = getKarmaState(game);
    const merchPos     = clampToPlaza(w * 0.50, h * 0.25, w, h);
    const luPos        = clampToPlaza(w * 0.40, h * 0.31, w, h);
    const scripturePos = clampToPlaza(w * 0.60, h * 0.31, w, h);
    const caulPos      = clampToPlaza(w * 0.31, h * 0.40, w, h);
    const boardPos     = clampToPlaza(w * 0.69, h * 0.40, w, h);
    const alchPos      = clampToPlaza(w * 0.22, h * 0.53, w, h);
    const gatePos      = clampToPlaza(w * 0.78, h * 0.52, w, h);
    const shenPos      = clampToPlaza(w * 0.28, h * 0.67, w, h);
    const yanPos       = clampToPlaza(w * 0.39, h * 0.76, w, h);
    const defPos       = clampToPlaza(w * 0.50, h * 0.78, w, h);
    const peiPos       = clampToPlaza(w * 0.61, h * 0.76, w, h);
    const forgePos     = clampToPlaza(w * 0.71, h * 0.66, w, h);
    const jadePos      = clampToPlaza(w * 0.38, h * 0.51, w, h);

    arena.props.push({
      id: "sanctum_taixu_furnace", kind: "taixu_craft_alchemy", destructible: false, art: "furnace_taixu_alchemy",
      name: "八卦太虚丹炉", badge: "点击控火炼九色丹雷 · 铸金甲丹童", x: alchPos.x, y: alchPos.y, r: 40
    });
    arena.props.push({
      id: "sanctum_tiangong_forge", kind: "taixu_craft_forge", destructible: false, art: "anvil_tiangong_forge",
      name: `天工星火剑炉 · Lv.${lvMap.sword_forge}`, badge: `常驻攻+${(lvMap.sword_forge - 1) * 8} · 点击落锤锻神兵`, x: forgePos.x, y: forgePos.y, r: 40, sanctumKey: "sword_forge"
    });
    arena.props.push({
      id: "cauldron_main", kind: "cauldron", art: "furnace", name: `紫微丹鼎 · Lv.${lvMap.cauldron}`, badge: "点击或按 Enter 控火炼丹",
      x: caulPos.x, y: caulPos.y, r: 40, progress: 0, sanctumKey: "cauldron"
    });
    arena.props.push({
      id: "hub_merchant", kind: "merchant_npc", art: "relic_cloud_mirror", onLotus: true,
      name: hubKs.mode === "demonic" ? "赤渊黑市 · 百宝坊" : hubKs.mode === "righteous" ? "太清仙珍 · 百宝坊" : "云岚百宝坊市",
      badge: "点击或按 Enter 选购仙装与正魔特供",
      x: merchPos.x, y: merchPos.y, r: 40, progress: 0
    });
    arena.props.push({
      id: "hub_scripture_hall", kind: "sanctum_upgrade", art: "scroll_shanhe_sheji", onLotus: true,
      name: `藏经阁 · Lv.${lvMap.scripture_hall}`, badge: "点击/Enter 升级洞府五大灵脉建筑",
      x: scripturePos.x, y: scripturePos.y, r: 40, progress: 0, sanctumKey: "scripture_hall"
    });
    arena.props.push({
      id: "hub_bounty_board", kind: "bounty_board", art: "bounty_jade_board", name: "青云天命悬赏榜", badge: "点击或按 T 领悬赏秘宝",
      x: boardPos.x, y: boardPos.y, r: 42, progress: 0
    });
    arena.props.push({
      id: "hub_jade_" + Date.now(), kind: "rough_jade", art: "item_rough_jade", name: "试剑鸿蒙石", badge: "飞剑自动切玉爆仙装",
      x: jadePos.x, y: jadePos.y, r: 30, hp: 3, maxHp: 3
    });
    arena.props.push({
      id: "hub_shen", kind: "companion_npc", npcId: "shen", art: "actor_shen",
      name: `沈清禾 · ${COMPANION_KEEPSAKES.shen.tierTitles[getCompanionBondTier(game, "shen")]}`,
      badge: hubKs.mode === "demonic" ? "纵染劫煞亦留暖汤 · 点击/Enter 雅集叙话" : "清虚守正药香护脉 · 点击/Enter 雅集叙话",
      x: shenPos.x, y: shenPos.y, r: 38, progress: 0
    });
    arena.props.push({
      id: "hub_lu", kind: "companion_npc", npcId: "lu", art: "actor_lu",
      name: `陆玄松 · ${COMPANION_KEEPSAKES.lu.tierTitles[getCompanionBondTier(game, "lu")]}`,
      badge: hubKs.mode === "righteous" ? "太清真传欣慰备至 · 点击/Enter 传功叙话" : hubKs.mode === "demonic" ? "镇山古钟为你稳心 · 点击/Enter 叙话" : "青云传功执事 · 点击/Enter 叙话切磋",
      x: luPos.x, y: luPos.y, r: 38, progress: 0
    });
    arena.props.push({
      id: "hub_pei", kind: "companion_npc", npcId: "pei", art: "actor_pei",
      name: `裴照 · ${COMPANION_KEEPSAKES.pei.tierTitles[getCompanionBondTier(game, "pei")]}`,
      badge: hubKs.mode === "demonic" ? "好烈血煞试剑十招 · 点击/Enter 切磋" : "青云剑首邀君论剑 · 点击/Enter 切磋叙话",
      x: peiPos.x, y: peiPos.y, r: 38, progress: 0
    });
    arena.props.push({
      id: "hub_yan", kind: "companion_npc", npcId: "yan", art: "actor_yan",
      name: `砚尘 · ${COMPANION_KEEPSAKES.yan.tierTitles[getCompanionBondTier(game, "yan")]}`,
      badge: hubKs.mode === "demonic" ? "执劫火而不迷本真 · 点击/Enter 照心叙话" : "古境守碑观世人 · 点击/Enter 茶叙照心",
      x: yanPos.x, y: yanPos.y, r: 38, progress: 0
    });
    arena.sectDefense = null;
    arena.cloudFlight = null;
    arena.celestialSpire = null;
    arena.customSeedRun = null;
    arena.props.push({
      id: "hub_sect_defense", kind: "sect_defense_trigger", art: "prop_guardian_sword_pylon",
      name: `护山大阵 · Lv.${lvMap.guard_array}`, badge: `常驻减伤+${(lvMap.guard_array - 1) * 4} · 点击开启守卫战`,
      x: defPos.x, y: defPos.y, r: 38, progress: 0, sanctumKey: "guard_array"
    });
    arena.props.push({
      id: "hub_depart", kind: "portal", portalArt: "portal_golden_lantern", name: `出征 · ${STAGES[arena.stageIdx].name}`, badge: "点击或按 M 选域出征",
      nextIdx: arena.stageIdx, toTower: false, x: gatePos.x, y: gatePos.y, r: 50, progress: 0
    });

    spawnDojoDummy(arena.dojoMode || "static");
    const dojoBar = document.getElementById("dojo-control-bar");
    if (dojoBar) {
      dojoBar.classList.add("active");
      dojoBar.classList.remove("expanded");
    }
    const recapCard = document.getElementById("stage-recap-card");
    if (recapCard) recapCard.classList.remove("open");
    Sound.qiOrb(3);
    showToast("已返【听雨洞府】· 可点击【藏经阁】升阶洞府建筑，或与四位故人茶叙切磋！");
    if (!skipSave) saveGame();
    focusBattlefield();
    updateHud();
    requestCalmReevaluation({ immediate: true });
  }

  function initArenaStage(stageIdx, towerMode = false) {
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;

    resetStageTransitionState();
    releasePauseToken(defeatPauseToken); defeatPauseToken = null;
    arena.stageEpoch += 1;
    arena.waveTransitioning = false;
    arena.sanctumMode = false;
    arena.bossRush = null;
    arena.sectDefense = null;
    arena.cloudFlight = null;
    arena.celestialSpire = null;
    restoreCustomSeedTempCurio();
    arena.customSeedRun = null;
    arena.bladeClash = null;
    arena.calmT = 0;
    arena.calmFlushed = false;
    arena.defeatRevivesUsed = 0;
    arena.defeatPending = null;
    resetEncounterTelemetry();
    arena.nearbyProp = null;
    arena.stageIdx = Math.max(0, Math.min(STAGES.length - 1, Math.floor(num(stageIdx, 0))));
    arena.stageTechDone = false;
    arena.maxStageCombo = 0;
    arena.waveIdx = 0;
    arena.roomBranch = "outpost";
    arena.towerMode = towerMode;
    arena.runBoons = [];
    arena.boonRerollsLeft = 1 + (game ? getSanctumBonuses(game).bonusBoonRerolls : 0);
    arena.slashEchoCounter = 0;
    arena.player.boonOverloadTimer = 0;
    arena.dungeonMap = towerMode ? null : generateDungeonMap(arena.stageIdx);
    renderPropInteractHud();
    renderRunBoonStrip();
    renderGearCompareCard();
    arena.midEventSpawned = false;
    arena.stageElement = null;
    arena.domain = null;
    arena.hitStop = 0;
    arena.player.meditating = false;
    arena.player.meditateAgeTick = 0;
    arena.player.meditateAgedDirty = false;
    arena.player.petBuffTimer = 0;
    arena.enemies = [];
    arena.projectiles = [];
    arena.drops = [];
    arena.props = [];
    arena.zones = [];
    arena.slashes = [];
    arena.lightnings = [];
    arena.decals = [];
    arena.sparks = [];
    arena.ripples = [];
    arena.qiStreams = [];
    arena.deathAnims = [];
    arena.activeAllies = [];
    arena.skyBolts = [];
    arena.shockRings = [];
    arena.bossBeams = [];
    arena.bladeArcs = [];
    arena.lotusVortexes = [];
    arena.thunderOrbs = [];
    arena.jadeDecoys = [];
    arena.frostPools = [];
    arena.witchTime = 0;
    arena.bossDomain = null;
    arena.reversedDomainTimer = 0;
    arena.waterPools = [];
    arena.fireZones = [];
    arena.softLockTarget = null;
    arena.groundSweeps = [];
    arena.meteorBursts = [];
    arena.blinkStreaks = [];
    arena.player.z = 0; arena.player.vz = 0; arena.player.plunging = false;
    arena.player.animState = "idle"; arena.player.animT = 0; arena.player.hitFlash = 0;
    if (game) refillImmortalGourd();
    arena.camFocusT = 0;
    arena.tribulation = null;
    const dojoBar = document.getElementById("dojo-control-bar");
    if (dojoBar) dojoBar.classList.remove("active");
    syncDojoTrainingHudVisibility();
    const recapCard = document.getElementById("stage-recap-card");
    if (recapCard) recapCard.classList.remove("open");
    pointer.moveTarget = null;
    if (game && (!game.marketStock || !game.marketStock.length)) refreshMarketStock();

    const stg = towerMode ? STAGES[3] : STAGES[arena.stageIdx];
    game.location = stg.loc;
    if (arena.stageIdx === 0 && !towerMode && playtestTelemetry.sanctumEnterCount > 0 && playtestTelemetry.returnToWildernessSec === null) {
      playtestTelemetry.returnToWildernessSec = Number(((Date.now() - playtestTelemetry.sessionStartedAt) / 1000).toFixed(2));
    }
    transitionStageScene(stg.arenaArt, towerMode ? "tower" : ("stg_" + arena.stageIdx));
    initAmbientEcosystem();

    const startPos = clampToPlaza(w * 0.34, h * 0.54, w, h);
    arena.player.x = startPos.x;
    arena.player.y = startPos.y;
    arena.giantSword.x = startPos.x;
    arena.giantSword.y = startPos.y - 24;
    initScarfRibbon();
    syncFlyingSwords();

    if (arena.stageIdx === 0 && !towerMode && !game.openingChoice) {
      // Prologue Rescue Scene: Clean rainy temple courtyard with Shen Qinghe & 3 wolves!
      const shenPos = clampToPlaza(w * 0.67, h * 0.54, w, h);
      arena.props.push({
        id: "shen_rescue", kind: "npc_ward", art: "actor_shen", name: "沈清禾",
        x: shenPos.x, y: shenPos.y, r: 48, rescued: false, bubble: "妖狼围困 · 道友拔剑助我！"
      });
      spawnEnemyPack(["wolf", "wolf", "wolf"], w * 0.52, h * 0.55, 85, 1.0);
      focusBattlefield();
    } else {
      // F12 A6: Play first-time stage-entry cutscene BEFORE spawning wave, guarded by stageEpoch + one-shot flag!
      const enterKey = !towerMode ? ({ 1: "enter_sect", 2: "enter_secret", 3: "enter_sword_mound", 4: "enter_terrace" }[arena.stageIdx] || null) : null;
      const spawnEpoch = arena.stageEpoch;
      let waveStarted = false;
      const startWaveOnce = () => {
        if (waveStarted || !game || arena.stageEpoch !== spawnEpoch || arena.sanctumMode) return;
        waveStarted = true;
        spawnCurrentWave();
        focusBattlefield();
        requestCalmReevaluation();
      };
      if (enterKey && CHAPTER_CUTSCENES[enterKey] && !(game.seenCutscenes && game.seenCutscenes[enterKey])) {
        playCutscene(enterKey, startWaveOnce);
      } else {
        startWaveOnce();
      }
    }
    updateHud();
    requestCalmReevaluation();
  }

  function getBossMechLabel(id) {
    if (id === "warden" || id === "sentinel" || id === "trial_gate") return "【护山金阵】金盾减伤45%，用重劈/爆剑/一闪破除金阵！";
    if (id === "puppet") return "【镜照剑反】展开铜镜架势时，用空格一闪或爆剑击碎反噬！";
    if (id === "shadow" || id === "trial_heart") return "【噬影瞬步】瞬移绕后突袭，开启Y键剑轮阵或一闪弹反！";
    return "【寒潮弹幕】半血狂化散射妖丹，切换Y键剑轮阵斩碎弹幕！";
  }

  // ==================== M2: 5-LAYER EXPEDITION STAR-MAP & RUN-SCOPED BOONS ====================
  function generateDungeonMap(stageIdx) {
    const climKeys = Object.keys(DUNGEON_CLIMATES);
    const pickClim = (offset) => climKeys[(stageIdx + offset + Math.floor(Math.random() * climKeys.length)) % climKeys.length];
    const nodes = {
      n0_0: { id: "n0_0", layer: 0, row: 0, type: "outpost",         climate: pickClim(0), next: ["n1_0", "n1_1"] },
      n1_0: { id: "n1_0", layer: 1, row: 0, type: "elite_loot",      climate: pickClim(1), next: ["n2_0", "n2_1"] },
      n1_1: { id: "n1_1", layer: 1, row: 1, type: "merchant_event",  climate: pickClim(2), next: ["n2_0", "n2_1"] },
      n2_0: { id: "n2_0", layer: 2, row: 0, type: "elemental_vault", climate: pickClim(3), next: ["n3_0", "n3_1"] },
      n2_1: { id: "n2_1", layer: 2, row: 1, type: "spirit_spring",   climate: "spirit_mist", next: ["n3_0", "n3_1"] },
      n3_0: { id: "n3_0", layer: 3, row: 0, type: "vanguard_clash",  climate: pickClim(1), next: ["n4_0"] },
      n3_1: { id: "n3_1", layer: 3, row: 1, type: "mystery_shrine",  climate: pickClim(2), next: ["n4_0"] },
      n4_0: { id: "n4_0", layer: 4, row: 0, type: "boss",            climate: stageIdx >= 3 ? "blood_haze" : "thunder_loom", next: [] }
    };
    // Ensure sibling branches in Layers 1-3 never share identical climate when rolled randomly
    if (nodes.n1_0.climate === nodes.n1_1.climate) nodes.n1_1.climate = climKeys[(climKeys.indexOf(nodes.n1_0.climate) + 1) % climKeys.length];
    if (nodes.n2_0.climate === nodes.n2_1.climate) nodes.n2_0.climate = climKeys[(climKeys.indexOf(nodes.n2_1.climate) + 2) % climKeys.length];
    if (nodes.n3_0.climate === nodes.n3_1.climate) nodes.n3_1.climate = climKeys[(climKeys.indexOf(nodes.n3_0.climate) + 1) % climKeys.length];
    return {
      stageIdx,
      layers: [["n0_0"], ["n1_0", "n1_1"], ["n2_0", "n2_1"], ["n3_0", "n3_1"], ["n4_0"]],
      nodes,
      currentNodeId: "n0_0",
      clearedIds: [],
      boonClaimedNodeIds: [],
      activeClimate: nodes.n0_0.climate
    };
  }

  function getCurrentDungeonNode() {
    if (!arena.dungeonMap) return null;
    return arena.dungeonMap.nodes[arena.dungeonMap.currentNodeId] || null;
  }

  function getSelectableNextNodeIds() {
    const dm = arena.dungeonMap;
    if (!dm) return [];
    const cur = dm.nodes[dm.currentNodeId];
    if (!cur || !cur.next || !cur.next.length) return [];
    const roomSpec = DUNGEON_ROOM_TYPES[cur.type];
    const hostiles = arena.enemies.filter(e => !e.isTreasure && e.hp > 0).length;
    const isCleared = dm.clearedIds.includes(cur.id) || (roomSpec && roomSpec.peaceful);
    if (!isCleared || hostiles > 0) return [];
    return cur.next.slice();
  }

  function renderRunBoonStrip() {
    const el = document.getElementById("run-boon-strip");
    if (!el) return;
    if (!game || arena.sanctumMode || !arena.runBoons || !arena.runBoons.length) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = arena.runBoons.map(bid => {
      const b = RUN_BOONS.find(x => x.id === bid);
      if (!b) return "";
      return `<span class="run-boon-chip" data-tip="${escTip("秘境道韵 · " + b.name, b.desc)}">✦ ${b.name}</span>`;
    }).join("");
  }

  function openRunBoonDraftModal(sourceNodeId = null, isReroll = false) {
    if (!game) return;
    const pool = RUN_BOONS.filter(b => !arena.runBoons.includes(b.id));
    if (!pool.length) {
      showToast("本趟秘境已悟全阶道韵！");
      return;
    }
    if (isReroll) {
      if ((arena.boonRerollsLeft || 0) <= 0) return;
      arena.boonRerollsLeft -= 1;
    }
    arena.pendingBoonNodeId = sourceNodeId || (arena.dungeonMap ? arena.dungeonMap.currentNodeId : null);
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    activeRunBoonChoices = shuffled.slice(0, Math.min(3, shuffled.length));
    openModal(`
      <div class="drawer-mural-banner" style="height:92px;">
        <img src="${ART.banner_relic}" alt="秘境道韵三选一" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">秘境临时道韵</span>
            <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:4px;">秘境悟道 · 择一局内机制变体</h2>
          </div>
          <span class="tag-chip mythic">本趟已悟 ${arena.runBoons.length} 道</span>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-sub);padding:2px 2px;">
        秘境道韵仅在本趟出征生效，可与你的剑阵、法宝、仙葫和大道法则产生强力联动构筑！
      </div>
      <div class="law-draft-grid">
        ${activeRunBoonChoices.map(b => `
          <button type="button" class="law-card-btn" data-pick-run-boon="${b.id}">
            <img src="${ART[b.art]}" alt="${b.name}" />
            <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;color:#fff3c4;">${b.name}</div>
            <span class="tag-chip done" style="font-size:11px;padding:2px 9px;">★ ${b.badge}</span>
            <span style="font-size:11.5px;color:var(--text-sub);line-height:1.45;">${b.desc}</span>
          </button>
        `).join("")}
      </div>
      <div class="draft-reroll-bar">
        <span>局内流派构筑：每趟秘境可借此演化不同打法</span>
        ${(arena.boonRerollsLeft || 0) > 0 && pool.length > 3
          ? `<button type="button" class="btn-jade" data-action="reroll-run-boon">天机换韵（免费剩余 ${arena.boonRerollsLeft} 次）</button>`
          : `<button type="button" class="btn-ghost" data-modal-close="1">暂缓稍后择取</button>`}
      </div>
    `, true);
  }

  function applyPickedRunBoon(boonId) {
    const spec = RUN_BOONS.find(b => b.id === boonId);
    if (!spec || !game) return;
    if (!arena.runBoons.includes(spec.id)) {
      arena.runBoons.push(spec.id);
    }
    if (arena.dungeonMap && arena.pendingBoonNodeId && !arena.dungeonMap.boonClaimedNodeIds.includes(arena.pendingBoonNodeId)) {
      arena.dungeonMap.boonClaimedNodeIds.push(arena.pendingBoonNodeId);
    }
    arena.props = arena.props.filter(pr => pr.kind !== "boon_stele");
    if (arena.nearbyProp && arena.nearbyProp.kind === "boon_stele") arena.nearbyProp = null;
    closeModal();
    Sound.fanfare();
    addRipple(arena.player.x, arena.player.y + 18, 120, "#ffe28a");
    addFloat(`✦ 悟得秘境道韵【${spec.name}】！`, arena.player.x, arena.player.y - 58, "#ffe28a", 20, true);
    showToast(`✦ 悟得局内道韵【${spec.name}】：${spec.desc}`);
    renderRunBoonStrip();
    renderPropInteractHud();
    updateHud();
  }

  function spawnMapExitGateAndBoon() {
    const dm = arena.dungeonMap;
    if (!dm || arena.towerMode || arena.sanctumMode) return;
    const cur = dm.nodes[dm.currentNodeId];
    if (!cur) return;
    if (!dm.clearedIds.includes(cur.id)) dm.clearedIds.push(cur.id);
    const roomSpec = DUNGEON_ROOM_TYPES[cur.type];
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;

    if (roomSpec && roomSpec.grantsBoon && !dm.boonClaimedNodeIds.includes(cur.id) && !arena.props.some(p => p.kind === "boon_stele")) {
      const bPos = clampToPlaza(w * 0.56, h * 0.52, w, h);
      arena.props.push({
        id: "boon_stele_" + cur.id, kind: "boon_stele", nodeId: cur.id, art: "relic_jade_seal", onLotus: true,
        name: "✦ 秘境道韵玉简", badge: "点击或按 Enter 悟道三选一（局内强力构筑）",
        x: bPos.x, y: bPos.y, r: 42, progress: 0
      });
    }
    if (cur.next && cur.next.length > 0 && !arena.props.some(p => p.kind === "map_node_gate")) {
      const gPos = clampToPlaza(w * 0.72, h * 0.53, w, h);
      const nextNames = cur.next.map(nid => DUNGEON_ROOM_TYPES[dm.nodes[nid].type].name).join(" / ");
      arena.props.push({
        id: "map_node_gate_" + cur.id, kind: "map_node_gate", portalArt: "portal_golden_lantern",
        name: `🧭 秘境星图阵门（第 ${cur.layer + 2}/5 层）`,
        badge: `点击/Enter 或按 9 择路：${nextNames}`,
        x: gPos.x, y: gPos.y, r: 48, progress: 0
      });
      showToast(`✦ 第 ${cur.layer + 1}/5 层已清！拾取道韵后点击/Enter【秘境星图阵门】或按 9 择路前行`);
    }
    updateHud();
  }

  function openDungeonMapModal() {
    if (!game || !arena.dungeonMap || arena.sanctumMode || arena.towerMode) {
      showToast("进入任意一卷秘境后可按 9 查看 5 层秘境分支星图！");
      return;
    }
    const dm = arena.dungeonMap;
    const stg = STAGES[dm.stageIdx] || STAGES[0];
    const selectable = getSelectableNextNodeIds();
    const curNode = dm.nodes[dm.currentNodeId];
    const clim = getActiveDungeonClimate();
    const layerNames = ["第一层 · 前哨", "第二层 · 分岔A", "第三层 · 异变", "第四层 · 分岔B", "第五层 · 妖王"];

    openModal(`
      <div class="drawer-mural-banner" style="height:86px;">
        <img src="${ART[stg.arenaArt]}" alt="${stg.name}" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">秘境星图 · ${(CAMPAIGN_ACTS[dm.stageIdx] || CAMPAIGN_ACTS[0]).actLabel}</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:4px;">${stg.name} · 五层探索星图</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">返回秘境 ✕</button>
        </div>
      </div>
      <div class="pity-bar-card">
        <span>当前节点：<b>${DUNGEON_ROOM_TYPES[curNode.type].icon} ${DUNGEON_ROOM_TYPES[curNode.type].name}</b>${clim ? ` · ${clim.icon} ${clim.name}（${clim.badge}）` : ""}</span>
        <span style="color:var(--gold-bright);">${selectable.length > 0 ? "★ 本层已清 · 请点选亮起节点前行" : "清扫本层妖潮后解锁前行分岔"}</span>
      </div>
      <div class="dmap-stage" id="dmap-stage">
        <svg class="dmap-svg-edges" id="dmap-svg-edges"></svg>
        <div class="dmap-layers-grid">
          ${dm.layers.map((col, cIdx) => `
            <div class="dmap-col">
              <div class="dmap-col-hdr">${layerNames[cIdx]}</div>
              ${col.map(nid => {
                const nd = dm.nodes[nid];
                const rSpec = DUNGEON_ROOM_TYPES[nd.type];
                const cSpec = DUNGEON_CLIMATES[nd.climate];
                const isCur = dm.currentNodeId === nid;
                const isCleared = dm.clearedIds.includes(nid);
                const canPick = selectable.includes(nid);
                const cls = isCur ? "current" : canPick ? "selectable" : isCleared ? "cleared" : "locked";
                const stateBadge = isCur ? "当前" : canPick ? "前往 ▸" : isCleared ? "✓ 已清" : "未达";
                return `
                  <button type="button" class="dmap-node-card ${cls}" data-dmap-node-id="${nid}" ${canPick ? `data-dungeon-node="${nid}"` : "disabled"} data-tip="${escTip(rSpec.name + " · " + cSpec.name, `${rSpec.reward}｜天候：${cSpec.desc}`)}">
                    <div class="dmap-node-head">
                      <strong class="dmap-node-title" style="color:${canPick ? "#fff3c4" : isCur ? "#80ffea" : "#dfece8"};">${rSpec.icon} ${rSpec.name}</strong>
                      <span class="dmap-node-status" style="color:${canPick ? "#ffe28a" : isCur ? "#70ffe6" : "var(--text-sub)"};">${stateBadge}</span>
                    </div>
                    <span class="dmap-climate-pill">${cSpec.icon} ${cSpec.name}</span>
                    <span style="font-size:10.5px;color:var(--text-sub);line-height:1.38;">${rSpec.reward}</span>
                  </button>`;
              }).join("")}
            </div>
          `).join("")}
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--text-sub);padding:2px 4px;">
        <span>本趟秘境已悟道韵：<b>${arena.runBoons.length} 道</b>${arena.runBoons.length ? "（" + arena.runBoons.map(id => (RUN_BOONS.find(b => b.id === id) || {}).name).join(" · ") + "）" : "（击败精英/秘窟/灵泉可三选一悟道）"}</span>
        <span>随时按 <b style="color:var(--gold-bright);">9</b> 检视路线</span>
      </div>
    `, true);

    const drawDungeonMapEdges = () => {
      const stageEl = document.getElementById("dmap-stage");
      const svgEl = document.getElementById("dmap-svg-edges");
      if (!stageEl || !svgEl) return;
      const sRect = stageEl.getBoundingClientRect();
      if (!sRect.width || !sRect.height) return;
      svgEl.setAttribute("viewBox", `0 0 ${sRect.width.toFixed(1)} ${sRect.height.toFixed(1)}`);
      const rects = {};
      stageEl.querySelectorAll("[data-dmap-node-id]").forEach(el => {
        rects[el.getAttribute("data-dmap-node-id")] = el.getBoundingClientRect();
      });
      const svgParts = [];
      Object.values(dm.nodes).forEach(nd => {
        const aR = rects[nd.id];
        if (!aR) return;
        const x1 = aR.right - sRect.left;
        const y1 = aR.top + aR.height * 0.5 - sRect.top;
        (nd.next || []).forEach(tid => {
          const bR = rects[tid];
          if (!bR) return;
          const x2 = bR.left - sRect.left;
          const y2 = bR.top + bR.height * 0.5 - sRect.top;
          const activeEdge = nd.id === dm.currentNodeId && selectable.includes(tid);
          const passedEdge = dm.clearedIds.includes(nd.id) && (dm.clearedIds.includes(tid) || dm.currentNodeId === tid);
          const col = activeEdge ? "#ffe28a" : passedEdge ? "#70ffe6" : "rgba(216,179,106,0.28)";
          const sw = activeEdge ? 2.6 : passedEdge ? 2.2 : 1.4;
          const dx = Math.max(12, (x2 - x1) * 0.52);
          svgParts.push(
            `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${(x1 + dx).toFixed(1)} ${y1.toFixed(1)}, ${(x2 - dx).toFixed(1)} ${y2.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round" ${activeEdge ? 'stroke-dasharray="5 4"' : ""} />`
          );
          if (activeEdge || passedEdge) {
            svgParts.push(`<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="3" fill="${col}" />`);
            svgParts.push(`<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="3" fill="${col}" />`);
          }
        });
      });
      svgEl.innerHTML = svgParts.join("");
    };
    drawDungeonMapEdges();
    requestAnimationFrame(drawDungeonMapEdges);
  }

  function enterDungeonNode(nodeId) {
    const dm = arena.dungeonMap;
    if (!dm || !dm.nodes[nodeId]) return false;
    const selectable = getSelectableNextNodeIds();
    if (!selectable.includes(nodeId)) {
      showToast("请先清扫当前节点妖潮，再选择相连的前行节点！");
      return false;
    }
    const nd = dm.nodes[nodeId];
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;
    closeModal();
    dm.currentNodeId = nodeId;
    dm.activeClimate = nd.climate;
    arena.waveIdx = nd.layer;
    arena.roomBranch = nd.type;
    arena.props = [];
    arena.projectiles = [];
    arena.waterPools = [];
    arena.fireZones = [];
    arena.frostPools = [];
    arena.nearbyProp = null;
    renderPropInteractHud();
    const startPos = clampToPlaza(w * 0.31, h * 0.54, w, h);
    arena.player.x = startPos.x;
    arena.player.y = startPos.y;
    addRipple(startPos.x, startPos.y + 24, 78, "#70ffe6");
    Sound.fanfare();
    const rSpec = DUNGEON_ROOM_TYPES[nd.type];
    const cSpec = DUNGEON_CLIMATES[nd.climate];
    showToast(`${rSpec.icon} 步入第 ${nd.layer + 1}/5 层【${rSpec.name}】· 天候：${cSpec.icon}${cSpec.name}（${cSpec.badge}）`);
    spawnCurrentWave();
    return true;
  }

  // Backward-compatible wrapper if any legacy portal invokes branching room portals
  function spawnBranchingRoomPortals() {
    spawnMapExitGateAndBoon();
  }

  function enterChosenBranchRoom(branchKind) {
    const dm = arena.dungeonMap;
    if (dm) {
      const selectable = getSelectableNextNodeIds();
      const target = selectable.find(nid => dm.nodes[nid].type === branchKind) || selectable[0];
      if (target) { enterDungeonNode(target); return; }
    }
    spawnCurrentWave();
  }

  function computeVolumeEndNextObjective(stageIdx, g) {
    if (!g) return "继续踏破九州秘境，问鼎九霄天门。";
    const nextM = findNextMainlineStep(g);
    const nextStepText = (nextM && !nextM.allDone && nextM.step) ? nextM.step.text : "";
    if (stageIdx < STAGES.length - 1) {
      const nextIdx = stageIdx + 1;
      const nextAct = CAMPAIGN_ACTS[nextIdx] || CAMPAIGN_ACTS[STAGES.length - 1];
      const nextStg = STAGES[nextIdx];
      const reqRealm = nextStg ? nextStg.min : "mortal";
      if (rankOf(g.realm) < rankOf(reqRealm)) {
        return `修为圆满后按 B 渡劫晋升【${REALMS[reqRealm].name}期】，开启${nextAct.actLabel} · ${nextStg.name}传送阵。${nextStepText ? `（当前道标：${nextStepText}）` : ""}`;
      }
      return `境界已足！合卷后踏入传送阵前往【${nextAct.actLabel} · ${nextStg.name}】，或先返听雨洞府整备丹器。${nextStepText ? `（当前道标：${nextStepText}）` : ""}`;
    }
    if (g.status === "ascended") {
      return "本世已白日飞升证道！可查阅【道果金榜】，或开启更高劫火周目、勇闯太虚锁妖内坛刷新纪录。";
    }
    if (g.realm !== "spirit") {
      return `修为圆满后踏入【九霄化神台】或按 B 渡劫晋升【化神期】，再启【九霄仙门】引动终极飞升天劫！${nextStepText ? `（当前道标：${nextStepText}）` : ""}`;
    }
    return "踏入眼前【九霄仙门】引动终极飞升天劫，择定三大证道结局！";
  }

  function openVolumeEndRecapModal(stageIdx, payload, onDismiss) {
    if (!game) {
      if (onDismiss) onDismiss();
      return;
    }
    const act = CAMPAIGN_ACTS[stageIdx] || CAMPAIGN_ACTS[0];
    const isVol5NascentTrial = stageIdx === 4 && game.realm === "nascent";
    const meta = isVol5NascentTrial
      ? {
          stageIdx: 4,
          volEndLabel: "第五卷 · 元神试剑",
          title: "法则共鸣 · 元神试剑圆满",
          chronicle: "你以元婴剑心先登九霄星盘，一剑震退【天门道影】试剑分神！万法共鸣渐趋圆满，只需修为圆融并渡过化神天劫，便可于第六卷真正叩开九霄天门、白日飞升。"
        }
      : (VOLUME_RECAP_META[stageIdx] || VOLUME_RECAP_META[0]);
    const earned = Math.max(1, Math.min(3, Math.floor(num(payload && payload.earned, 1))));
    const prevStars = Math.max(0, Math.min(3, Math.floor(num(payload && payload.prevStars, 0))));
    const bestStars = Math.max(prevStars, earned);
    const newRecord = !!(payload && payload.newRecord);
    const gotTech = !!(payload && payload.gotTech);
    const gotHp = !!(payload && payload.gotHp);
    const totalStars = getTotalStageStars(game);
    const starIcons = `${"★".repeat(earned)}${"☆".repeat(3 - earned)}`;
    const bestIcons = `${"★".repeat(bestStars)}${"☆".repeat(3 - bestStars)}`;
    const realmName = (REALMS[game.realm] && REALMS[game.realm].name) || "凡人";
    const nextObjective = computeVolumeEndNextObjective(stageIdx, game);
    const ksRecap = getKarmaState(game);
    const bondedRecapIds = getBondedCompanionIds(game);
    const bondedRecapNames = bondedRecapIds.map(id => NPC_META[id].name);
    const volEchoGuide = VOLUME_CAMPAIGN_GUIDE.find(v => v.volIndex === (isVol5NascentTrial ? 5 : (stageIdx === 4 ? 6 : stageIdx + 1))) || VOLUME_CAMPAIGN_GUIDE[0];
    const companionEchoText = bondedRecapNames.length > 0
      ? `同心故人（${bondedRecapNames.join("、")}）回应此战 · 当前道心【${ksRecap.label}】 · ${volEchoGuide.companionPrompt}`
      : `独行问道 · 当前道心【${ksRecap.label}】 · ${volEchoGuide.companionPrompt}`;

    const onDismissFn = typeof onDismiss === "function" ? onDismiss : null;
    const recapArgs = { stageIdx, payload, onDismiss: onDismissFn, stageEpoch: arena.stageEpoch };
    pendingVolumeRecapOnDismiss = onDismissFn;
    lastVolumeRecapArgs = recapArgs;
    const opened = openModal(`
      <div class="drawer-mural-banner" style="height:106px;">
        <img src="${ART[act.arenaArt] || ART.arena_wilderness}" alt="${escapeHtml(meta.title)}" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">${escapeHtml(meta.volEndLabel)}</span>
            <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:4px;">《${escapeHtml(meta.title)}》</h2>
            <div style="font-size:11.5px;color:#dffef8;margin-top:2px;">${escapeHtml(act.bossTitle)} · 已破</div>
          </div>
          <span class="tag-chip ${newRecord ? "mythic" : "done"}">${newRecord ? "★ 星级刷新！" : `历史最高 ${bestIcons}`}</span>
        </div>
      </div>

      <div class="jade-card" style="gap:6px;padding:10px 12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <strong style="font-family:var(--font-serif);font-size:14px;color:var(--gold-bright);">📜 本卷纪事</strong>
          <span style="font-size:11px;color:var(--jade);">${escapeHtml(game.name)} · ${escapeHtml(realmName)}期 · 九州星辉 ${totalStars}/15 ★</span>
        </div>
        <p style="font-size:12.5px;color:var(--text-main);line-height:1.6;margin:0;">${escapeHtml(meta.chronicle)}</p>
      </div>

      <div id="volume-recap-companion-echo" class="jade-card" style="gap:4px;padding:8px 12px;border-color:rgba(244,196,255,0.42);">
        <strong style="font-family:var(--font-serif);font-size:12.5px;color:#f4c4ff;">♥ 红尘故人与道心回响</strong>
        <p style="font-size:11.5px;color:#e6daf5;line-height:1.5;margin:0;">${escapeHtml(companionEchoText)}</p>
      </div>

      <div class="jade-card" style="gap:7px;padding:10px 12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <strong style="font-family:var(--font-serif);font-size:14px;color:var(--gold-bright);">★ 秘境星级评定</strong>
          <span style="font-size:14px;color:#ffd970;font-weight:700;">本次 ${starIcons}（${earned}/3）· 最高 ${bestIcons}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;font-size:11.5px;">
          <div class="visual-tile equipped" style="padding:6px 8px;justify-content:center;"><span style="color:#ffd970;font-weight:700;">✓ 斩破镇守首领</span></div>
          <div class="visual-tile ${gotTech ? "equipped" : ""}" style="padding:6px 8px;justify-content:center;"><span style="color:${gotTech ? "#ffd970" : "var(--text-sub)"};font-weight:700;">${gotTech ? "✓" : "○"} 识破/破势或12连击</span></div>
          <div class="visual-tile ${gotHp ? "equipped" : ""}" style="padding:6px 8px;justify-content:center;"><span style="color:${gotHp ? "#ffd970" : "var(--text-sub)"};font-weight:700;">${gotHp ? "✓" : "○"} 气血保留≥35%</span></div>
        </div>
      </div>

      <div class="jade-card" style="gap:5px;padding:10px 12px;border-color:rgba(112,255,230,0.48);">
        <strong style="font-family:var(--font-serif);font-size:13.5px;color:#80ffea;">🧭 下一步目标</strong>
        <p style="font-size:12px;color:var(--text-main);line-height:1.55;margin:0;">${escapeHtml(nextObjective)}</p>
      </div>

      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button type="button" id="btn-volume-recap-confirm" class="btn-gold" style="padding:8px 20px;font-size:13px;" data-action="confirm-volume-recap">合卷前行 · 开启传送阵 ▸</button>
      </div>
    `, true, { kind: "volume_recap" });
    if (!opened) {
      pendingVolumeRecapOnDismiss = null;
      lastVolumeRecapArgs = null;
      deferredVolumeRecapModal = recapArgs;
    }
    return opened;
  }

  function spawnStageClearPortals(stageIdx, payload = {}) {
    if (!game) return;
    const canvas = document.getElementById("fx-canvas");
    const w = (canvas && canvas.width) || window.innerWidth || 1440;
    const h = (canvas && canvas.height) || window.innerHeight || 900;
    const stg = STAGES[stageIdx] || STAGES[0];
    const earned = Math.max(1, Math.min(3, Math.floor(num(payload.earned, (game.stageStars && game.stageStars[stageIdx]) || 1))));
    const starStr = `${"★".repeat(earned)}${"☆".repeat(3 - earned)}`;

    if (stageIdx === STAGES.length - 1) {
      if (!arena.props.some(p => p.kind === "ascend_gate")) {
        const gatePos = clampToPlaza(w * 0.66, h * 0.48, w, h);
        const towPos = clampToPlaza(w * 0.64, h * 0.64, w, h);
        const isAscended = game.status === "ascended";
        const isSpirit = game.realm === "spirit";
        arena.props.push({
          id: "ascend_gate", kind: "ascend_gate", art: "item_ascension_seal",
          name: isAscended ? "道果金榜 · 仙途总览" : isSpirit ? "九霄仙门 · 叩天飞升" : "九霄化神台 · 破境化神",
          badge: isAscended ? "查看本世五维道果" : isSpirit ? "点击/Enter 引动终极飞升天劫!" : "元婴圆满后点击/Enter 引动化神劫（化神后再叩仙门）",
          x: gatePos.x, y: gatePos.y, r: 50, progress: 0
        });
        arena.props.push({
          id: "portal_tower_end", kind: "portal", name: "无尽试剑 · 太虚锁妖内坛", badge: "点击/Enter 挑战镇妖古塔",
          nextIdx: 3, toTower: true, x: towPos.x, y: towPos.y, r: 44, progress: 0
        });
        showToast(isSpirit
          ? `${starStr} 天门道影已破！点击/Enter【九霄仙门】飞升证道！`
          : `${starStr} 天门道影已破！元婴圆满后点击【九霄化神台】晋升化神，再登仙门飞升！`);
      }
      return;
    }

    if (!arena.props.some(p => p.kind === "portal")) {
      addFloat(`${"★".repeat(earned)} 秘境荡平！(${stg.name})`, arena.player.x, arena.player.y - 72, "#ffe28a", 21, true);
      showToast(`✦ 【${stg.name}】达成 ${starStr}！按 T 可开启星辉秘宝`);
      renderStageDamageRecap(true);
      const nextIdx = Math.min(STAGES.length - 1, stageIdx + 1);
      const nextAct = CAMPAIGN_ACTS[nextIdx] || CAMPAIGN_ACTS[STAGES.length - 1];
      const nextStg = STAGES[nextIdx];
      const nextReqRealm = nextStg ? nextStg.min : "mortal";
      const nextUnlocked = rankOf(game.realm) >= rankOf(nextReqRealm);
      const nextLabel = (nextAct && nextAct.actLabel) || `第 ${nextIdx + 1} 卷`;
      const pPos = clampToPlaza(w * 0.66, h * 0.46, w, h);
      const hPos = clampToPlaza(w * 0.66, h * 0.64, w, h);
      arena.props.push({
        id: "portal_next", kind: "portal",
        name: nextUnlocked
          ? `前往${nextLabel} · ${nextStg.name}`
          : `🔒 ${nextLabel} · ${nextStg.name}（需${REALMS[nextReqRealm].name}期）`,
        badge: nextUnlocked
          ? "点击/Enter 贯通下一卷秘境"
          : `境界结界封锁 · 需先渡劫晋升【${REALMS[nextReqRealm].name}期】`,
        nextIdx, toTower: false, x: pPos.x, y: pPos.y, r: 48, progress: 0
      });
      arena.props.push({
        id: "portal_sanctum", kind: "sanctum_portal", name: "返回 · 听雨洞府主城", badge: "点击/Enter 炼丹铸器休整",
        x: hPos.x, y: hPos.y, r: 42, progress: 0
      });
    }
  }

  function spawnCurrentWave() {
    if (!game || arena.sanctumMode) return;
    arena.waveTransitioning = false;
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;

    if (arena.towerMode) {
      arena.props = arena.props.filter(p => p.kind !== "tower_next");
      const fl = Math.max(1, Math.floor(num(game.towerFloor, 1)));
      const pool = ["wolf", "warden", "serpent", "puppet", "shadow", "sentinel"];
      const bossId = pool[(fl - 1) % pool.length];
      const minions = [pool[fl % pool.length], pool[(fl + 1) % pool.length]];
      const rb = getRealmCombatBaseline(game.realm);
      const calSpec = getCalamityCycleSpec(game);
      const pactHp = hasPact(game, "frenzy_hp") ? 1.25 : 1.0;
      const flHpMult = 0.50 * Math.pow(1.13, Math.min(25, fl - 1)) * (fl > 26 ? 1 + (fl - 26) * 0.12 : 1);
      const flAtkMult = Math.min(1.65, 0.72 + (fl - 1) * 0.055);

      const startIdx = arena.enemies.length;
      spawnEnemyPack(minions, w * 0.60, h * 0.52, 110, 1.0);
      const mobHp = Math.max(160, Math.round(rb.mobHp * flHpMult * 0.80 * pactHp * calSpec.hpMult));
      const mobAtk = Math.max(8, Math.round(rb.atk * flAtkMult * 0.72 * calSpec.atkMult));
      const mobHeavy = Math.max(14, Math.round(rb.heavy * flAtkMult * 0.70 * calSpec.atkMult));
      for (let mi = startIdx; mi < arena.enemies.length; mi++) {
        const m = arena.enemies[mi];
        m.hp = mobHp; m.maxHp = mobHp; m.atk = mobAtk; m.heavy = mobHeavy;
      }

      spawnSingleEnemy(bossId, w * 0.65, h * 0.54, 1.0, true, `锁妖塔#${fl} · ${ENEMIES[bossId].name}`);
      const tBoss = arena.enemies[arena.enemies.length - 1];
      if (tBoss) {
        const bossHp = Math.max(1600, Math.round(rb.bossHp * flHpMult * pactHp * calSpec.hpMult));
        tBoss.hp = bossHp;
        tBoss.maxHp = bossHp;
        tBoss.partHp = Math.max(160, Math.round(bossHp * 0.28));
        tBoss.maxPartHp = tBoss.partHp;
        tBoss.atk = Math.max(12, Math.round(rb.atk * flAtkMult * calSpec.atkMult));
        tBoss.heavy = Math.max(20, Math.round(rb.heavy * flAtkMult * calSpec.atkMult));
      }

      spawnStageInteractiveHazards();
      showBossCutIn(ENEMIES[bossId].art, `锁妖塔 #${fl} · ${ENEMIES[bossId].name}`, getBossMechLabel(bossId));
      updateHud();
      return;
    }

    const stg = STAGES[arena.stageIdx];
    const dm = arena.dungeonMap;
    const curNode = dm ? dm.nodes[dm.currentNodeId] : null;
    const roomType = curNode ? curNode.type : (arena.waveIdx >= 4 ? "boss" : "outpost");
    const stageScale = STAGE_SCALING[arena.stageIdx] || 1.0;

    // Volume Boss beaten (waveIdx > 4) -> Phase A (Immediate Persistence) -> Phase B (clear_stage* -> Volume-End Recap Card -> Portals!)
    if (arena.waveIdx > 4) {
      if (arena.stageClearHandledEpoch === arena.stageEpoch) {
        updateHud();
        return;
      }
      arena.stageClearHandledEpoch = arena.stageEpoch;
      const stageIdx = arena.stageIdx;
      const act = CAMPAIGN_ACTS[stageIdx] || CAMPAIGN_ACTS[0];
      const meta = VOLUME_RECAP_META[stageIdx] || VOLUME_RECAP_META[0];
      const wasAlreadyDefeated = isStageBossDefeated(game, stageIdx);
      const prevStars = Math.max(0, Math.min(3, Math.floor(num(game.stageStars && game.stageStars[stageIdx], 0))));
      const stClear = getCombatStats(game);
      const gotTech = Boolean(arena.stageTechDone || (arena.maxStageCombo || 0) >= 12);
      const gotHp = game.hp >= stClear.maxHp * 0.35;
      const earned = 1 + (gotTech ? 1 : 0) + (gotHp ? 1 : 0);
      const bestStars = Math.max(prevStars, earned);
      const newRecord = earned > prevStars;
      const starStr = `${"★".repeat(earned)}${"☆".repeat(3 - earned)}`;

      // Phase A: Immediate persistence BEFORE cutscene & recap modal so reload never loses Boss kill or soft-locks progression
      unlockAchievement("ach_exp");
      if (!game.defeatedStageBosses) game.defeatedStageBosses = {};
      game.defeatedStageBosses[stageIdx] = true;
      if (stageIdx === STAGES.length - 1) game.trialCompleted = true;
      if (!game.stageStars) game.stageStars = {};
      game.stageStars[stageIdx] = bestStars;
      advanceLifespanMonths(6, "stage_clear", { silentToast: true });
      if (Array.isArray(game.journal)) {
        game.journal.unshift(`【${meta.volEndLabel}】斩破【${act.bossName}】（${starStr}）`);
      }
      if (stageIdx === STAGES.length - 1) {
        spawnGearDrop(w * 0.56, h * 0.53, 4);
      } else {
        if (act && act.bossMats) {
          act.bossMats.forEach((mk, mi) => spawnDrop(mk, w * 0.53 + mi * 18, h * 0.52, 1));
        } else {
          spawnDrop("herb", w * 0.54, h * 0.52);
        }
        spawnDrop("stone", w * 0.57, h * 0.55, 48 + stageIdx * 16);
      }
      saveGame();

      const clearPayload = { stageIdx, earned, prevStars, bestStars, newRecord, gotTech, gotHp, wasAlreadyDefeated, starStr };

      // Non-campaign modes (e.g. sandboxMode) bypass volume-end cutscene & recap card
      if (!isNormalCampaignStage()) {
        arena.stageClearPending = false;
        spawnStageClearPortals(stageIdx, clearPayload);
        updateHud();
        return;
      }

      // Phase B: Normal campaign volume-end cutscene -> Volume-End Recap Card -> Portals ONLY AFTER dismissal
      arena.stageClearPending = true;
      const clearEpoch = arena.stageEpoch;
      const finalize = () => {
        arena.stageClearPending = false;
        if (!game || arena.stageEpoch !== clearEpoch || !isNormalCampaignStage()) return;
        spawnStageClearPortals(stageIdx, clearPayload);
        updateHud();
      };
      playCutscene(`clear_stage${stageIdx}`, () => {
        if (!game || arena.stageEpoch !== clearEpoch || !isNormalCampaignStage()) {
          arena.stageClearPending = false;
          return;
        }
        saveGame();
        openVolumeEndRecapModal(stageIdx, clearPayload, finalize);
      });
      updateHud();
      return;
    }

    if (roomType === "merchant_event") {
      refreshMarketStock();
      const mPos = clampToPlaza(w * 0.48, h * 0.37, w, h);
      const cPos = clampToPlaza(w * 0.38, h * 0.44, w, h);
      const encPos = clampToPlaza(w * 0.58, h * 0.42, w, h);
      const steleElem = (arena.stageIdx % 2 === 0) ? "frost" : "thunder";
      const sPos = clampToPlaza(w * 0.48, h * 0.69, w, h);
      arena.props.push({
        id: "field_merchant", kind: "merchant_npc", art: "actor_lu",
        name: "云游仙商 · 百宝囊", badge: "点击/Enter 选购神装灵丹", x: mPos.x, y: mPos.y, r: 40, progress: 0
      });
      arena.props.push({
        id: "field_cauldron", kind: "cauldron", art: "furnace",
        name: "灵脉丹鼎", badge: "点击/Enter 凝练回春仙丹", x: cPos.x, y: cPos.y, r: 38, progress: 0
      });
      arena.props.push({
        id: "field_encounter", kind: "encounter_stele", art: "relic_jade_seal", onLotus: true,
        name: "📜 太古机缘古碑", badge: "点击/Enter 展卷抉择大道奇遇！", x: encPos.x, y: encPos.y, r: 40, progress: 0
      });
      arena.props.push({
        id: "elem_stele", kind: "elem_stele", elem: steleElem,
        art: steleElem === "frost" ? "relic_frost_sword" : "relic_soul_lamp",
        name: steleElem === "frost" ? "玄冥寒霜剑碑" : "九霄紫电剑碑",
        badge: steleElem === "frost" ? "点击/Enter 剑气附寒霜减速35%" : "点击/Enter 剑气必引紫电链雷",
        x: sPos.x, y: sPos.y, r: 38, progress: 0
      });
      spawnMapExitGateAndBoon();
      return;
    }

    if (roomType === "spirit_spring") {
      const spPos = clampToPlaza(w * 0.45, h * 0.50, w, h);
      arena.props.push({
        id: "node_spring_" + Date.now(), kind: "immortal_spring", art: "prop_bagua_secret_gate",
        name: "太初满灵泉", badge: "点击/Enter 全满气血/仙葫/剑意 · 永久剑攻+8",
        x: spPos.x, y: spPos.y, r: 44, progress: 0
      });
      spawnMapExitGateAndBoon();
      return;
    }

    if (roomType === "mystery_shrine") {
      const altPos = clampToPlaza(w * 0.44, h * 0.41, w, h);
      const jPos = clampToPlaza(w * 0.52, h * 0.66, w, h);
      const encPos = clampToPlaza(w * 0.58, h * 0.43, w, h);
      arena.props.push({
        id: "blood_altar", kind: "blood_altar", art: "icon_blade",
        name: "心魔血剑坛", badge: "点击/Enter 主动献25%气血 → 飞剑+2",
        x: altPos.x, y: altPos.y, r: 38, progress: 0
      });
      arena.props.push({
        id: "jade_" + Date.now(), kind: "rough_jade", art: "item_rough_jade", name: "剑冢原石", badge: "击碎爆出高品仙装",
        x: jPos.x, y: jPos.y, r: 32, hp: 3, maxHp: 3
      });
      arena.props.push({
        id: "field_encounter", kind: "encounter_stele", art: "relic_jade_seal", onLotus: true,
        name: "📜 太古机缘古碑", badge: "点击/Enter 展卷抉择大道奇遇！",
        x: encPos.x, y: encPos.y, r: 40, progress: 0
      });
      spawnMapExitGateAndBoon();
      return;
    }

    if (roomType === "boss") {
      arena.props = arena.props.filter(p => p.kind === "elem_stele");
      const bId = stg.boss;
      const bMono = getBossKarmaMonologue(bId);
      const cutSub = bMono ? `${bMono} ｜ ${getBossMechLabel(bId)}` : getBossMechLabel(bId);
      const launchBossBanner = () => {
        showBossCutIn(ENEMIES[bId].art, stg.bossTitle || ENEMIES[bId].name, cutSub);
        if (bMono) {
          addFloat(bMono, w * 0.64, h * 0.43, getKarmaState(game).color, 15, true);
        }
      };
      // F12 A7: Play unseen boss_pre_stage* cutscene BEFORE spawning the Boss, guarded by stageEpoch + one-shot flag!
      const bossEpoch = arena.stageEpoch;
      let bossSpawned = false;
      const spawnBossOnce = () => {
        if (bossSpawned || !game || arena.stageEpoch !== bossEpoch || arena.sanctumMode) return;
        bossSpawned = true;
        spawnStageInteractiveHazards();
        spawnSingleEnemy(bId, w * 0.64, h * 0.53, stageScale, true, stg.bossTitle || `镇守妖王 · ${ENEMIES[bId].name}`);
        Sound.drum(0.24);
        launchBossBanner();
        updateHud();
        requestCalmReevaluation();
      };
      const preKey = `boss_pre_stage${arena.stageIdx}`;
      if (isNormalCampaignStage() && CHAPTER_CUTSCENES[preKey] && !(game.seenCutscenes && game.seenCutscenes[preKey])) {
        playCutscene(preKey, () => {
          saveGame();
          spawnBossOnce();
        });
      } else {
        spawnBossOnce();
      }
      updateHud();
      return;
    }

    // Combat rooms: outpost / elite_loot / elemental_vault / vanguard_clash
    spawnStageInteractiveHazards();
    if (roomType === "elite_loot") {
      const jPos = clampToPlaza(w * 0.45, h * 0.37, w, h);
      arena.props.push({
        id: "jade_" + Date.now(), kind: "rough_jade", art: "item_rough_jade", name: "剑冢原石", badge: "击碎爆出仙装",
        x: jPos.x, y: jPos.y, r: 32, hp: 3, maxHp: 3
      });
      spawnEnemyPack(stg.waves[1], w * 0.62, h * 0.54, 125, stageScale * 1.18, true);
      if (arena.enemies.length > 0) {
        arena.enemies[0].guaranteedGearRarity = Math.min(4, 2 + Math.floor(arena.stageIdx / 2) + (getActiveDungeonClimate() && getActiveDungeonClimate().id === "blood_haze" ? 1 : 0));
      }
    } else if (roomType === "elemental_vault") {
      const steleElem = (arena.stageIdx % 2 === 0) ? "thunder" : "frost";
      const sPos = clampToPlaza(w * 0.44, h * 0.68, w, h);
      arena.props.push({
        id: "elem_stele", kind: "elem_stele", elem: steleElem,
        art: steleElem === "frost" ? "relic_frost_sword" : "relic_soul_lamp",
        name: steleElem === "frost" ? "玄冥寒霜剑碑" : "九霄紫电剑碑",
        badge: steleElem === "frost" ? "点击/Enter 剑气附寒霜减速35%" : "点击/Enter 剑气必引紫电链雷",
        x: sPos.x, y: sPos.y, r: 38, progress: 0
      });
      spawnTreasureSpirit(w * 0.60, h * 0.64);
      spawnEnemyPack(stg.waves[1], w * 0.62, h * 0.50, 120, stageScale * 1.05, false);
    } else if (roomType === "vanguard_clash") {
      spawnEnemyPack(stg.waves[2], w * 0.63, h * 0.53, 130, stageScale * 1.24, true);
    } else {
      spawnEnemyPack(stg.waves[0], w * 0.62, h * 0.54, 120, stageScale, false);
    }
    // F28: One-shot non-blocking pedestal choice payoff cue on entering next fight!
    if (game && game.vol1PedestalMeta && !game.vol1PedestalMeta.payoffShown && arena.enemies.length > 0) {
      game.vol1PedestalMeta.payoffShown = true;
      const cueTxt = game.vol1PedestalMeta.choice === "help"
        ? "✨ 青莲灵契生效：青莲药师袍护脉，危急时按【R】唤沈清禾回春助阵！"
        : "✨ 惊鸿剑诀生效：本命飞剑已 +1，惊鸿剑气贯穿敌阵！";
      addFloat(cueTxt, arena.player.x, arena.player.y - 68, game.vol1PedestalMeta.choice === "help" ? "#4ad2b8" : "#ffe89e", 16, true);
      showToast(cueTxt, { tier: 2, key: "vol1_pedestal_payoff", throttleMs: 2500 });
      saveGame();
    }
    updateHud();
  }

  function spawnGearDrop(x, y, minRarity = 1) {
    if (isPracticeModeActive()) return;
    const canvas = document.getElementById("fx-canvas");
    const pos = clampToPlaza(x, y, canvas.width || 1440, canvas.height || 900);
    const gear = rollGearItem(arena.stageIdx, minRarity);
    arena.drops.push({
      kind: "gear", gear, x: pos.x, y: pos.y,
      vx: (Math.random() - 0.5) * 3.2,
      vy: (Math.random() - 0.5) * 2.8,
      val: 1
    });
  }

  function spawnTreasureSpirit(x, y) {
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;
    const pos = clampToPlaza(x, y, w, h);
    arena.enemies.push({
      uid: "treasure_" + Date.now(),
      id: "wolf", art: "item_jade",
      name: "聚宝金灵", isBoss: false, isTreasure: true, enraged: false,
      mech: null, wardHp: 0, maxWardHp: 0, mirrorTimer: 0, blinkCd: 99,
      x: pos.x, y: pos.y, vx: 2.6, vy: -2.2, kx: 0, ky: 0, sx: 1, sy: 1, facing: 1,
      r: 28, hp: 95, maxHp: 95, posture: 50, maxPosture: 50,
      atk: 0, heavy: 0, state: "flee", timer: 9.5, windupDur: 1,
      aimX: 0, aimY: 0, attackType: "none", hitFlash: 0, swordMarks: 0, chillTimer: 0, burnTimer: 0
    });
  }

  function spawnEnemyPack(ids, cx, cy, spread, mult = 1.0, forceTacticalSquad = false) {
    const startIdx = arena.enemies.length;
    ids.forEach((id, i) => {
      const ang = (i * Math.PI * 2) / ids.length + Math.random() * 0.4;
      const dist = 45 + Math.random() * spread;
      spawnSingleEnemy(id, cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist * 0.65, mult, false);
    });
    // M2 3-Role Tactical Squad Synergy: keep Stage 0 Layer 0 ("outpost") in Mortal realm as clean pack wolves (F28)
    const spawned = arena.enemies.slice(startIdx);
    const isMortalVol1Outpost = Boolean(game && rankOf(game.realm) === 0 && arena.stageIdx === 0 && !arena.towerMode && arena.roomBranch === "outpost");
    const allowTactical = forceTacticalSquad || (!isMortalVol1Outpost && game && (game.openingChoice || arena.stageIdx > 0 || arena.towerMode));
    if (spawned.length >= 2 && allowTactical) {
      const van = spawned.find(e => e.id === "warden" || e.id === "puppet" || e.id === "sentinel") || spawned[0];
      van.tacticalRole = "shield_vanguard";
      van.frontShieldHp = Math.max(40, Math.round(van.maxPosture * 0.90));
      van.maxFrontShieldHp = van.frontShieldHp;
      van.shieldFacing = Math.PI;
      const chanter = spawned.slice().reverse().find(e => e !== van);
      if (chanter) {
        chanter.tacticalRole = "hex_chanter";
        chanter.attackType = "shot";
      }
      const flanker = spawned.find(e => e !== van && e !== chanter);
      if (flanker) {
        flanker.tacticalRole = "flank_assassin";
        flanker.flankCd = 3.2 + Math.random() * 1.4;
        flanker.flankTelegraph = 0;
        flanker.flankTargetX = flanker.x;
        flanker.flankTargetY = flanker.y;
      }
    }
  }

  function spawnSingleEnemy(id, x, y, mult = 1.0, isBoss = false, customName = null) {
    const spec = ENEMIES[id] || ENEMIES.wolf;
    if (!sandboxMode && !isPracticeModeActive() && !metaState.seenEnemies.includes(id)) {
      metaState.seenEnemies.push(id);
      saveMeta();
    }
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;
    const pos = clampToPlaza(x, y, w, h);
    const pactHpMult = game && hasPact(game, "frenzy_hp") ? 1.25 : 1.0;
    const pactPosMult = (isBoss && game && hasPact(game, "iron_posture")) ? 1.35 : 1.0;
    const calSpec = game ? getCalamityCycleSpec(game) : CALAMITY_CYCLES[0];
    const clim = getActiveDungeonClimate();
    const climAtkMult = (clim && clim.id === "blood_haze") ? COMBAT_RULE_PARAMS.climates.blood_haze.enemyAtkMult : 1.0;
    const bossMultTable = [10.0, 10.5, 10.6, 9.0, 5.3];
    const effStage = arena.towerMode ? Math.min(4, Math.floor(Math.max(0, ((game && game.towerFloor) || 1) - 1) / 3)) : arena.stageIdx;
    const alphaWolfBonus = (isBoss && id === "wolf") ? 1.25 : 1.0;
    const bossHpMult = (bossMultTable[effStage] || 5.3) * alphaWolfBonus;
    const hp = Math.round(spec.hp * mult * (isBoss ? bossHpMult : 1.0) * pactHpMult * calSpec.hpMult);
    const maxPos = Math.round((isBoss ? (160 + effStage * 55) : (58 + effStage * 16)) * pactPosMult * calSpec.postureMult);
    const stageVariants = (!isBoss && !customName && !arena.towerMode) ? CHAPTER_ENEMY_VARIANTS[arena.stageIdx] : null;
    const vSpec = stageVariants ? (stageVariants[id] || null) : null;
    const hasWard = (id === "warden" && isBoss) || id === "sentinel" || id === "trial_gate" || !!(vSpec && vSpec.wardRatio && arena.stageIdx >= 1);
    const wardVal = hasWard ? Math.round(maxPos * (vSpec && vSpec.wardRatio && !isBoss ? vSpec.wardRatio : 0.65)) : 0;
    const atkScale = Math.max(0.75, 1 + (mult - 1) * 0.72) * ((isBoss && id === "wolf") ? 1.08 : 1.0);
    const bossHeavyAmp = isBoss ? 1.08 : 1.0;
    const resolvedName = customName || ((isBoss && id === "wolf") ? "雾隐狼王" : (vSpec ? vSpec.name : spec.name));

    arena.enemies.push({
      uid: "e_" + Math.random().toString(36).slice(2),
      id, art: spec.art,
      name: resolvedName,
      variantTag: vSpec ? vSpec.tag : null,
      variantColor: vSpec ? vSpec.auraColor : null,
      variantTrait: vSpec ? vSpec.trait : null,
      isBoss, isTreasure: false, enraged: !!(isBoss && game && hasPact(game, "blood_moon")), beamCd: 3.0,
      mech: hasWard ? "ward" : (vSpec && vSpec.trait === "mirror_pulse" ? "mirror" : spec.mech),
      wardHp: wardVal, maxWardHp: wardVal,
      mirrorTimer: 0,
      blinkCd: (id === "shadow" || id === "trial_heart" || (vSpec && vSpec.trait === "blink_swift")) ? 3.2 : 999,
      x: pos.x, y: pos.y, vx: 0, vy: 0, kx: 0, ky: 0, sx: 1, sy: 1,
      facing: pos.x > (arena.player ? arena.player.x : 520) ? -1 : 1,
      r: isBoss ? 48 : 31,
      hp, maxHp: hp,
      posture: maxPos, maxPosture: maxPos,
      atk: Math.max(8, Math.round(spec.attack * atkScale * climAtkMult * calSpec.atkMult)),
      heavy: Math.max(16, Math.round(spec.heavy * atkScale * bossHeavyAmp * climAtkMult * calSpec.atkMult)),
      state: "chase",
      timer: 0.65 + Math.random() * 0.65,
      windupDur: (isBoss ? 0.88 : 0.74) * (vSpec && vSpec.windupMult ? vSpec.windupMult : 1.0),
      aimX: 0, aimY: 0,
      attackType: (id === "warden" || id === "sentinel" || id === "trial_thunder") ? "slam" : (id === "serpent" || id === "shadow") ? "shot" : "charge",
      partHp: isBoss ? Math.max(120, Math.round(hp * 0.28)) : 0,
      maxPartHp: isBoss ? Math.max(120, Math.round(hp * 0.28)) : 0,
      weakpointExposed: isBoss,
      partSevered: false,
      flinchCount: 0,
      poiseArmorTimer: 0,
      airborneZ: 0,
      airborneVz: 0,
      wallSplatCd: 0,
      hitFlash: 0,
      swordMarks: 0,
      chillTimer: 0,
      burnTimer: 0
    });
  }

  function spawnDrop(kind, x, y, val = 1) {
    if (isPracticeModeActive() && kind !== "essence") return;
    const canvas = document.getElementById("fx-canvas");
    const pos = clampToPlaza(x, y, canvas.width || 1440, canvas.height || 900);
    arena.drops.push({
      kind, x: pos.x, y: pos.y,
      vx: (Math.random() - 0.5) * 4.4,
      vy: (Math.random() - 0.5) * 3.8,
      val
    });
  }
