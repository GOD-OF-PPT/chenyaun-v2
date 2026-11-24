  // ==================== Q1 (F07–F13): PAUSE TOKENS, MODAL PRIORITY, NOTICE BUS & PERSISTED PENDING REWARDS ====================
  const COMBAT_CALM_GRACE_SEC = 0.8;
  const RESOLVED_REWARD_ID_LIMIT = 128;
  const PENDING_REWARD_SOFT_WARN = 64;
  const COMBAT_INBOX_MAX = 60;
  const PENDING_REWARD_KINDS = new Set(["gear_overflow", "soul_unlock", "destiny_fruit", "iconic_draft", "lifespan_exhausted"]);
  const MODAL_PRIORITY = {
    save_conflict: 100,
    save_corrupt: 100,
    defeat: 100,
    volume_recap: 70,
    ending: 70,
    gear_overflow: 40,
    soul_unlock: 40,
    destiny_fruit: 40,
    iconic_draft: 40,
    lifespan_exhausted: 40,
    batch_craft: 40,
    batch_enhance: 40,
    stage_sweep: 40,
    default: 20
  };

  // ==================== Q2 (F15/F17/F18): TELEMETRY, REMINDER TIERS, UPGRADE PREVIEW, MAT SOURCE & NAV MODEL ====================
  function resetEncounterTelemetry() {
    arena.encounterTelemetry = createFreshEncounterTelemetry();
  }
  function recordEncounterHitTaken({ sourceName = "", moveName = "", rawDmg = 0, finalDmg = 0, isHeavy = false } = {}) {
    if (!arena.encounterTelemetry) resetEncounterTelemetry();
    const et = arena.encounterTelemetry;
    const entry = {
      sourceName: String(sourceName || "").trim(),
      moveName: String(moveName || "").trim(),
      rawDmg: Math.max(0, Math.round(num(rawDmg, 0))),
      finalDmg: Math.max(0, Math.round(num(finalDmg, 0))),
      isHeavy: !!isHeavy,
      ts: (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now()
    };
    et.hitsTaken += 1;
    et.totalDamageTaken += entry.finalDmg;
    et.lastHit = entry;
    et.recentHits.push(entry);
    if (et.recentHits.length > 5) et.recentHits.shift();
  }

  function getReminderTier(g) {
    if (!g) {
      return {
        tier1HudHigh: false,
        tier1Reasons: [],
        tier2TabLow: { cultivate: false, story: 0, explore: false, alchemy: false },
        tier3LockedCount: 0
      };
    }
    const r = REALMS[g.realm] || REALMS.mortal;
    const lf = getLifespanInfo(g);
    const bossGate = getBreakthroughBossGate(g);
    const tier1Reasons = [];
    if (hasAnyClaimableGoalReward(g)) tier1Reasons.push("claimable_goal");
    if (r.xpCap > 0 && g.xp >= r.xpCap && !(bossGate && bossGate.locked)) tier1Reasons.push("breakthrough_ready");
    if (lf.status === "critical" || lf.status === "exhausted") tier1Reasons.push("lifespan_critical");
    if (storageWriteError || saveConflictState || storageReadError) tier1Reasons.push("save_error");

    const availStories = STORIES.filter(s =>
      !g.choices[s.id] &&
      rankOf(g.realm) >= rankOf(s.min) &&
      (!s.requires || !!g.choices[s.requires])
    );
    const needPet = rankOf(g.realm) >= 1 && !(g.pet && g.pet.id);
    const canFeed = canAffordPetFeed(g) || getPendingPetSkillTier(g) !== null;
    const canRelic = !g.loadout.relic && g.stones >= 130 && rankOf(g.realm) >= 1;
    const exploreOptReady = isEcosystemSystemUnlocked(g, "demon_tower") && (g.towerBest || 0) < 1;

    let tier3LockedCount = 0;
    STAGES.forEach(s => { if (rankOf(g.realm) < rankOf(s.min)) tier3LockedCount++; });
    if (!isEcosystemSystemUnlocked(g, "vein_expedition")) tier3LockedCount++;
    if (!isEcosystemSystemUnlocked(g, "celestial_spire")) tier3LockedCount++;
    if (!isEcosystemSystemUnlocked(g, "sword_tomb_rush")) tier3LockedCount++;

    return {
      tier1HudHigh: tier1Reasons.length > 0,
      tier1Reasons,
      tier2TabLow: {
        cultivate: Boolean(needPet || canFeed),
        story: availStories.length,
        explore: Boolean(exploreOptReady),
        alchemy: Boolean(canRelic)
      },
      tier3LockedCount
    };
  }



  function computeUpgradePreview(g, kind, targetId, opts = {}) {
    if (!g) return { valid: false, canAfford: false, costText: "", deltaText: "", sceneText: "", missingMats: [] };
    if (kind === "gear_enhance") {
      const steps = Math.max(1, Math.floor(num(opts.steps, 1)));
      const bp = computeBatchEnhancePreview(g, targetId, steps);
      if (!bp.valid) {
        return { valid: false, canAfford: false, costText: "已满 +10", deltaText: "属性已达当前淬火上限", sceneText: "可改用定刻词条或鸿蒙紫气突破", missingMats: [] };
      }
      const parts = [];
      if (bp.dAtk > 0) parts.push(`攻击 ${bp.before.atk}→${bp.after.atk} (+${bp.dAtk}${bp.atkPct > 0 ? `, +${bp.atkPct}%` : ""})`);
      if (bp.dHp > 0) parts.push(`气血 ${bp.before.maxHp}→${bp.after.maxHp} (+${bp.dHp})`);
      if (bp.dDr > 0) parts.push(`减伤 ${bp.before.dmgReduce}→${bp.after.dmgReduce} (+${bp.dDr})`);
      if (!parts.length) parts.push(`淬火 +${bp.fromLvl}→+${bp.toLvl} (基础属性 +${bp.steps * 8}%)`);
      const sceneText = targetId === "weapon"
        ? "常规清怪与首领爆发"
        : targetId === "armor"
          ? "高压首领与雷劫容错"
          : "全能属性与暴击收益";
      return {
        valid: true,
        canAfford: bp.canAfford,
        costText: `${bp.totalCost} 灵石`,
        deltaText: parts.join(" · "),
        sceneText,
        dAtk: bp.dAtk,
        dHp: bp.dHp,
        dDr: bp.dDr,
        totalCost: bp.totalCost,
        missingMats: []
      };
    }
    if (kind === "relic_temper") {
      const rel = hasOwn(RELICS, targetId) ? RELICS[targetId] : null;
      if (!rel) return { valid: false, canAfford: false, costText: "", deltaText: "", sceneText: "", missingMats: [] };
      const owned = (g.ownedRelics || []).includes(targetId);
      const rawStars = (g.relicStars && g.relicStars[targetId] != null) ? g.relicStars[targetId] : (owned ? 1 : 0);
      const curStars = Math.max(0, Math.min(5, Math.floor(num(rawStars, owned ? 1 : 0))));
      if (!owned || curStars >= 5) {
        return { valid: false, canAfford: false, costText: owned ? "已满 ★5" : "未铸造", deltaText: owned ? "本命法宝已臻圆满" : "铸造后可升星淬炼", sceneText: rel.passive || "本命剑域加成", missingMats: [] };
      }
      const useCore = opts.useCore != null ? !!opts.useCore : !!temperUseCoreDiscount;
      const tc = getRelicTemperCost(g, curStars, useCore);
      const nextStars = curStars + 1;
      const before = getCombatStats(g);
      const simGame = Object.assign({}, g, {
        loadout: Object.assign({}, g.loadout, { relic: targetId }),
        relicStars: Object.assign({}, g.relicStars || {}, { [targetId]: nextStars })
      });
      const beforeEq = getCombatStats(Object.assign({}, g, { loadout: Object.assign({}, g.loadout, { relic: targetId }) }));
      const afterEq = getCombatStats(simGame);
      const dAtk = Math.round(afterEq.atk - beforeEq.atk);
      const dDr = Math.round(afterEq.dmgReduce - beforeEq.dmgReduce);
      const parts = [`星阶 ★${curStars}→★${nextStars}`];
      if (dAtk > 0) parts.push(`攻击 +${dAtk}`);
      if (dDr > 0) parts.push(`减伤 +${dDr}`);
      if (nextStars === 3 || nextStars === 5) parts.push("飞剑永久 +1");
      return {
        valid: true,
        canAfford: num(g.stones, 0) >= tc.finalStones,
        costText: tc.applyCore ? `${tc.finalStones} 灵石 + 1 妖核` : `${tc.finalStones} 灵石`,
        deltaText: parts.join(" · "),
        sceneText: "本命法宝被动与 E 键剑域爆发",
        dAtk,
        dDr,
        totalCost: tc.finalStones,
        before,
        missingMats: []
      };
    }
    if (kind === "pet_feed") {
      if (!g.pet || !g.pet.id) {
        return { valid: false, canAfford: false, costText: "先契约灵兽", deltaText: "炼气期可免费契约随行灵兽", sceneText: "随行助战与 G 键灵兽绝技", missingMats: [] };
      }
      const petLv = Math.max(1, Math.min(5, Math.floor(num(g.pet.level, 1))));
      const feedCost = getPetNextFeedCost(petLv);
      if (!feedCost) {
        return { valid: false, canAfford: false, costText: "已满阶 Lv.5", deltaText: "已解锁全部血脉灵技槽位", sceneText: "随行协战与本源绝技", missingMats: [] };
      }
      const missingMats = [];
      Object.entries(feedCost.mats || {}).forEach(([mk, req]) => {
        const have = Math.max(0, Math.floor(num(g.inventory && g.inventory[mk], 0)));
        if (have < req) missingMats.push({ id: mk, name: (ITEMS[mk] && ITEMS[mk].name) || mk, have, req, lack: req - have });
      });
      const milestoneNote = feedCost.nextLevel === 3 ? " · 解锁 Lv.3 化形灵技三选一" : feedCost.nextLevel === 5 ? " · 解锁 Lv.5 化境神通三选一" : "";
      return {
        valid: true,
        canAfford: missingMats.length === 0,
        costText: formatPetFeedCost(feedCost, g.inventory),
        deltaText: `灵兽 Lv.${petLv}→Lv.${feedCost.nextLevel} (助战伤害/冷却强化${milestoneNote})`,
        sceneText: "持续随行协战与 G 键本源绝技",
        missingMats
      };
    }
    if (kind === "sanctum_upgrade") {
      const spec = SANCTUM_BUILDINGS.find(b => b.id === targetId);
      const curLv = getSanctumLevel(g, targetId);
      const nextCost = getSanctumNextCost(targetId, curLv);
      if (!spec || !nextCost) {
        return { valid: false, canAfford: false, costText: "已圆满 Lv.5", deltaText: "该灵脉建筑已达最高阶", sceneText: spec ? spec.role : "洞府灵脉加成", missingMats: [] };
      }
      const missingMats = [];
      Object.entries(nextCost.mats || {}).forEach(([mk, req]) => {
        const have = Math.max(0, Math.floor(num(g.inventory && g.inventory[mk], 0)));
        if (have < req) missingMats.push({ id: mk, name: (ITEMS[mk] && ITEMS[mk].name) || mk, have, req, lack: req - have });
      });
      const costMatsTxt = Object.entries(nextCost.mats || {}).map(([mk, req]) => `${(ITEMS[mk] && ITEMS[mk].name) || mk}×${req}`).join(" · ");
      return {
        valid: true,
        canAfford: num(g.stones, 0) >= nextCost.stones && missingMats.length === 0,
        costText: `${nextCost.stones} 灵石${costMatsTxt ? ` + ${costMatsTxt}` : ""}`,
        deltaText: `Lv.${curLv}→Lv.${curLv + 1}：${nextCost.eff}`,
        sceneText: spec.role,
        missingMats
      };
    }
    if (kind === "alchemy_craft") {
      const rec = hasOwn(RECIPES, targetId) ? RECIPES[targetId] : null;
      if (!rec) return { valid: false, canAfford: false, costText: "", deltaText: "", sceneText: "", missingMats: [] };
      const qty = Math.max(1, Math.min(5, Math.floor(num(opts.qty, 1))));
      const bd = computeBatchRecipeCost(g, rec, qty);
      const out = ITEMS[rec.output];
      const caulLv = getSanctumLevel(g, "cauldron");
      const lockedByCaul = Boolean(rec.reqCauldronLv && caulLv < rec.reqCauldronLv);
      return {
        valid: !lockedByCaul,
        canAfford: !lockedByCaul && num(g.stones, 0) >= bd.totalStoneCost,
        costText: `${bd.totalStoneCost} 灵石 · ⏳${bd.totalMonths} 月${bd.hasMissing ? `（含补料 ${bd.matBuyCost}石）` : ""}`,
        deltaText: `产出【${out ? out.name : rec.output}】×${bd.totalOutput}${bd.bonusHealing > 0 ? ` + 丹鼎赠回春丹×${bd.bonusHealing}` : ""}`,
        sceneText: (out && out.desc) || "战斗续航或渡劫护脉",
        missingMats: bd.missingItems.map(m => ({ id: m.id, name: m.name, have: m.have, req: m.req, lack: m.lack })),
        breakdown: bd
      };
    }
    return { valid: false, canAfford: false, costText: "", deltaText: "", sceneText: "", missingMats: [] };
  }

  function renderMatSourceInlinePanel(jump, isModal = false) {
    if (!jump || !hasOwn(MATERIAL_SOURCE_CATALOG, jump.matId)) return "";
    const cat = MATERIAL_SOURCE_CATALOG[jump.matId];
    const owned = game && game.inventory ? Math.max(0, Math.floor(num(game.inventory[cat.id], 0))) : 0;
    const panelId = isModal ? "modal-mat-source-panel" : "drawer-mat-source-panel";
    return `
      <div id="${panelId}" role="region" aria-label="灵材获取指引">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            ${renderSemanticTag("econ", "灵材来源")}
            <strong style="font-family:var(--font-serif);font-size:var(--fs-lg);color:var(--gold-bright);">${escapeHtml(cat.name)}</strong>
            <span class="tag-chip num-tabular">当前持有 ×${owned}</span>
          </div>
          <button type="button" id="btn-mat-source-return" class="btn-secondary btn-jade" style="padding:4px 10px;font-size:var(--fs-xs);" data-action="close-mat-source">↩ 返回原强化项</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          ${cat.sources.map(src => {
            const btnAttr = src.route
              ? `data-route-goal="${escapeHtml(src.route)}"`
              : src.openGoals
                ? `data-open-goals="${escapeHtml(src.openGoals)}"`
                : `data-action="${escapeHtml(src.action || "open-world-map")}"`;
            return `
              <div class="visual-tile" style="justify-content:space-between;padding:6px 9px;">
                <div>
                  <div style="font-size:var(--fs-sm);font-weight:700;color:var(--text-main);">${escapeHtml(src.label)}</div>
                  <div style="font-size:var(--fs-xs);color:var(--text-sub);">${escapeHtml(src.hint)}</div>
                </div>
                <button type="button" class="btn-tertiary btn-ghost" style="padding:3px 9px;font-size:var(--fs-xs);white-space:nowrap;" ${btnAttr}>前往 ▸</button>
              </div>`;
          }).join("")}
        </div>
      </div>`;
  }

  function isWorldMapNodeUnlocked(g, nd) {
    if (!g || !nd) return false;
    if (nd.kind === "boss_rush") return isEcosystemSystemUnlocked(g, "sword_tomb_rush");
    if (nd.kind === "tower") return isEcosystemSystemUnlocked(g, "demon_tower");
    return rankOf(g.realm) >= rankOf(nd.min);
  }

  function buildNavigationSnapshot(g) {
    if (!g) return { tabs: NAV_MODEL_TABS, nextMainline: null, mapNodes: [], trials: [], companions: [], bounties: [] };
    const nextM = findNextMainlineStep(g);
    const nextRoute = nextM && nextM.step ? nextM.step.route : null;
    const nextChIdx = nextM && nextM.ch ? nextM.ch.index : null;
    const inBossRush = Boolean(arena.bossRush && arena.bossRush.active);
    const mapNodes = KYUSHU_MAP_NODES.map(nd => {
      const unlocked = isWorldMapNodeUnlocked(g, nd);
      const isCurrent = (nd.kind === "hub" && arena.sanctumMode)
        || (nd.kind === "tower" && !arena.sanctumMode && arena.towerMode)
        || (nd.kind === "boss_rush" && !arena.sanctumMode && !arena.towerMode && inBossRush)
        || (nd.kind === "stage" && !arena.sanctumMode && !arena.towerMode && !inBossRush && arena.stageIdx === nd.stageIdx);
      const isMainTarget = Boolean(
        !nextM?.allDone && nextM?.step && (
          (nd.kind === "chapter5_marker" && nextChIdx === 5) ||
          (nextChIdx !== 5 && nd.routeKey && nextRoute && nd.routeKey === nextRoute && nd.kind !== "chapter5_marker")
        )
      );
      const stars = nd.kind === "stage" ? ((g.stageStars && g.stageStars[nd.stageIdx]) || 0) : 0;
      const lockReason = unlocked ? "" : `需晋升【${REALMS[nd.min] ? REALMS[nd.min].name : nd.min}期】解锁`;
      return Object.assign({}, nd, { unlocked, isCurrent, isMainTarget, stars, lockReason });
    });

    const trialSpecs = [
      { id: "demon_tower", name: "太虚锁妖古塔", action: "challenge-tower", rewardSummary: "无尽冲层 · 鸿蒙光柱与妖核" },
      { id: "sect_defense", name: "护山大阵妖潮", action: "start-sect-defense", rewardSummary: "守卫灵脉 · 灵石与法阵灵材" },
      { id: "cloud_sea_trial", name: "九霄云海空战", action: "start-cloud-sea", rewardSummary: "御剑空战 · 破境修为与灵玉" },
      { id: "star_chart", name: "太虚周天星图", action: "open-star-chart", rewardSummary: "二十八星宿 · 永久星魂共鸣" },
      { id: "vein_expedition", name: "九州灵脉远征", action: "open-expedition", rewardSummary: "道侣驻防 · 星魄/灵玉/道蕴砂" },
      { id: "celestial_spire", name: "太虚登仙台", action: "open-celestial-spire", rewardSummary: "九重肉鸽奇物 · 极品神装" },
      { id: "sword_tomb_rush", name: "万剑冢七阵连战", action: "open-boss-rush", rewardSummary: "连战妖王烛龙 · 剑尊尊号" }
    ];
    const trials = trialSpecs.map(tr => {
      const eco = getEcosystemSystemSpec(tr.id);
      const minRealm = (eco && eco.min) || "qi";
      const unlocked = isEcosystemSystemUnlocked(g, tr.id);
      const minName = REALMS[minRealm] ? REALMS[minRealm].name : minRealm;
      return Object.assign({}, tr, {
        minRealm,
        unlocked,
        lockReason: unlocked ? "" : `${minName}期解封`
      });
    });

    const companions = STORIES.map(st => {
      const npc = NPC_META[st.npc] || { name: st.npc };
      const done = !!(g.choices && g.choices[st.id]);
      const reqOk = !st.requires || !!(g.choices && g.choices[st.requires]);
      const realmOk = rankOf(g.realm) >= rankOf(st.min);
      const status = done ? "done" : (reqOk && realmOk) ? "available" : "locked";
      const minName = REALMS[st.min] ? REALMS[st.min].name : st.min;
      return {
        id: st.id,
        npc: st.npc,
        npcName: npc.name,
        name: st.name,
        chapter: st.chapter,
        location: st.location,
        locLabel: getStoryLocationLabel(st.location),
        min: st.min,
        status,
        reqText: done ? "已结缘" : !realmOk ? `需 ${minName}期` : !reqOk ? "需先完成前置茶叙" : "可前往结缘"
      };
    });

    const bounties = SECT_BOUNTY_CHAINS.map(ch => getBountySpec(g, ch));
    return {
      tabs: NAV_MODEL_TABS,
      nextMainline: nextM ? {
        allDone: !!nextM.allDone,
        claimReady: !!nextM.claimReady,
        priority: nextM.priority || (nextM.step && nextM.step.priority) || "required",
        chapterVol: nextM.ch ? nextM.ch.vol : "",
        chapterTitle: nextM.ch ? nextM.ch.title : "",
        chapterIdx: nextM.ch ? nextM.ch.index : CHAPTERS.length,
        stepId: nextM.step ? nextM.step.id : null,
        stepText: nextM.step ? nextM.step.text : "",
        rewardTxt: nextM.step ? nextM.step.rewardTxt : "",
        routeKey: nextM.step ? nextM.step.route : "calamity_ng"
      } : null,
      mapNodes,
      trials,
      companions,
      bounties
    };
  }

  const pauseTokens = new Map();
  let pauseTokenSeq = 0;
  let modalPauseToken = null;
  let drawerPauseToken = null;
  let cutscenePauseToken = null;
  let photoPauseToken = null;
  let defeatPauseToken = null;
  let activeModalKind = "";
  let deferredVolumeRecapModal = null;
  let lastVolumeRecapArgs = null;

  function syncArenaPaused() {
    arena.paused = pauseTokens.size > 0;
  }
  function acquirePauseToken(owner, kind = "ui") {
    const id = `${owner}:${++pauseTokenSeq}`;
    pauseTokens.set(id, { owner, kind, createdAt: Date.now() });
    syncArenaPaused();
    return id;
  }
  function releasePauseToken(tokenId) {
    if (tokenId && pauseTokens.delete(tokenId)) {
      syncArenaPaused();
      return true;
    }
    return false;
  }
  function getPauseTokensSnapshot() {
    return Array.from(pauseTokens.entries()).map(([id, meta]) => Object.assign({ id }, meta));
  }

  const combatInbox = [];
  let combatInboxUnread = 0;
  const toastLastShownByKey = Object.create(null);
  const combatHotkeyArmMap = Object.create(null);
  let compareCardShownAt = 0;
  let compareCardClickGuardUntil = 0;
  let compareCardWasHiddenByCombat = false;
  let compareSmeltConfirm = null; // { key, expiresAt, timer }

  function pushCombatInbox(msg, category = "info", count = 1) {
    const cleanMsg = safeText(msg, "").trim();
    if (!cleanMsg) return;
    combatInbox.push({ msg: cleanMsg, category: category || "info", count: Math.max(1, Math.floor(num(count, 1))), ts: Date.now() });
    if (combatInbox.length > COMBAT_INBOX_MAX) {
      combatInbox.splice(0, combatInbox.length - COMBAT_INBOX_MAX);
    }
    combatInboxUnread = Math.min(COMBAT_INBOX_MAX, combatInboxUnread + 1);
  }

  function flushCombatInboxSummary() {
    if (combatInboxUnread <= 0) return false;
    const recent = combatInbox.slice(-combatInboxUnread);
    combatInboxUnread = 0;
    const counts = { gear: 0, mat: 0, ach: 0, soul: 0, other: 0 };
    for (const item of recent) {
      const cat = hasOwn(counts, item.category) ? item.category : "other";
      counts[cat] += Math.max(1, Math.floor(num(item.count, 1)));
    }
    const parts = [];
    if (counts.gear > 0) parts.push(`仙装×${counts.gear}`);
    if (counts.mat > 0) parts.push(`灵材×${counts.mat}`);
    if (counts.ach > 0) parts.push(`成就×${counts.ach}`);
    if (counts.soul > 0) parts.push(`魂印×${counts.soul}`);
    if (counts.other > 0) parts.push(`传闻×${counts.other}`);
    if (!parts.length) return false;
    showToast(`📜 本波战报：${parts.join(" · ")}`, { tier: 1, key: "combat_inbox_summary", throttleMs: 400 });
    return true;
  }

  function unlockAchievement(id) {
    if (!game || sandboxMode || isPracticeModeActive() || game.achievements.includes(id)) return;
    const spec = ACHIEVEMENTS.find(a => a.id === id);
    if (!spec) return;
    game.achievements.push(id);
    const level = (a11ySettings && a11ySettings.combatNoticeLevel) || "lite";
    if (isCombatCalm() || level === "full") Sound.fanfare();
    showToast(`★ 达成成就【${spec.name}】（可赴卷轴领灵石礼！）`, { tier: 2, category: "ach", key: `ach_${id}`, throttleMs: 4000 });
  }

  function showToast(msg, opts = {}) {
    const now = performance.now();
    const o = (opts && typeof opts === "object") ? opts : {};
    const critical = !!o.critical;
    const tier = Math.max(0, Math.floor(num(o.tier, critical ? 0 : 1)));
    const key = typeof o.key === "string" && o.key ? o.key : null;
    const throttleMs = Math.max(0, Math.floor(num(o.throttleMs, critical ? 6000 : 4000)));
    const ttl = Math.max(800, Math.floor(num(o.ttl, 1950)));
    const level = (a11ySettings && a11ySettings.combatNoticeLevel) || "lite";

    if (key && throttleMs > 0 && toastLastShownByKey[key] && (now - toastLastShownByKey[key]) < throttleMs) {
      return false;
    }
    if (!critical && typeof isCombatCalm === "function" && game && !isCombatCalm()) {
      if (tier >= 3 && level !== "full") return false;
      if (tier >= 2 && level !== "full") {
        pushCombatInbox(msg, o.category || "info", o.count || 1);
        return false;
      }
    }
    if (key) toastLastShownByKey[key] = now;
    const box = document.getElementById("toast-container");
    if (!box) return false;
    while (box.children.length >= 2) box.removeChild(box.firstChild);
    const el = document.createElement("div");
    el.className = "toast-pill";
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, ttl);
    return true;
  }

  let cutinTimer = null;
  function showBossCutIn(artKey, bossName, mechText, opts = {}) {
    const o = (opts && typeof opts === "object") ? opts : {};
    const level = (a11ySettings && a11ySettings.combatNoticeLevel) || "lite";
    if (o.isPlayerUlt) {
      if (level === "minimal") return false;
      if (level === "lite" && o.cutInKey && game) {
        if (!game.seenCutIns || typeof game.seenCutIns !== "object") game.seenCutIns = {};
        if (game.seenCutIns[o.cutInKey]) return false;
        game.seenCutIns[o.cutInKey] = true;
      }
    }
    const el = document.getElementById("boss-cutin-banner");
    if (!el) return false;
    document.getElementById("boss-cutin-img").src = ART[artKey] || ART.enemy_serpent;
    document.getElementById("boss-cutin-name").textContent = bossName;
    document.getElementById("boss-cutin-mech").textContent = mechText;
    el.classList.add("show");
    if (cutinTimer) clearTimeout(cutinTimer);
    cutinTimer = setTimeout(() => { el.classList.remove("show"); }, 2500);
    return true;
  }

  function addFloat(text, x, y, color = "#f8e3ac", size = 17, isCrit = false, opts = {}) {
    const o = (opts && typeof opts === "object") ? opts : {};
    const level = (a11ySettings && a11ySettings.combatNoticeLevel) || "lite";
    const isPerilous = !!o.perilous;
    if (!isPerilous && o.kind === "pickup" && level === "minimal") {
      return;
    }
    const isBannerFloat = typeof o.banner === "boolean"
      ? o.banner
      : (size >= 15 && text.length >= 5 && !/^[+-]?\d|^暴\s*-?\d/.test(text));
    const ttl = isBannerFloat ? 1.42 : isCrit ? 1.05 : 0.84;
    let fx = isBannerFloat ? (arena.player ? arena.player.x : x) : x;
    let fy = isBannerFloat ? ((arena.player ? arena.player.y : y) - 76) : y;

    if (isBannerFloat) {
      let activeBanners = 0;
      for (let fi = arena.floats.length - 1; fi >= 0; fi--) {
        const fl = arena.floats[fi];
        if (fl.isBannerFloat && fl.age < 1.1) {
          fl.y -= 28;
          activeBanners++;
          if (activeBanners >= 3) {
            fl.age = Math.max(fl.age, (fl.ttl || 1.2) - 0.14);
          }
        }
      }
    } else {
      floatRadialSeq = (floatRadialSeq + 1) % 6;
      const laneX = [-38, 38, -22, 22, -48, 48][floatRadialSeq];
      const laneY = [-4, -12, -22, -28, -16, -24][floatRadialSeq];
      fx += laneX;
      fy += laneY;
      // Local collision repulsion against recently spawned numbers
      for (let fi = arena.floats.length - 1; fi >= 0; fi--) {
        const fl = arena.floats[fi];
        if (!fl.isBannerFloat && fl.age < 0.35 && Math.abs(fl.x - fx) < 34 && Math.abs(fl.y - fy) < 18) {
          fy -= 20;
          fx += (floatRadialSeq % 2 === 0 ? -14 : 14);
        }
      }
    }
    if (arena.particles && arena.particles.length > 160) {
      arena.particles.splice(0, arena.particles.length - 160);
    }
    arena.floats.push({
      isBannerFloat,
      isPerilous,
      text, x: fx, y: fy,
      vx: isBannerFloat ? 0 : ((fx - x) * 0.015),
      vy: isBannerFloat ? -0.58 : (isCrit ? -1.42 : -1.05),
      alpha: 1.0, age: 0, ttl, color, size, isCrit
    });
    if (arena.floats.length > 26) arena.floats.shift();
  }

  function addDecal(x, y, ang, r, kind = "slash") {
    arena.decals.push({ x, y, ang, r, kind, alpha: kind === "spider_crack" ? 0.85 : 0.66 });
    if (arena.decals.length > 22) arena.decals.shift();
  }

  function spawnSparks(x, y, count = 8, baseAng = 0, spread = 1.6, color = "#ffe699") {
    const deg = getEffectivePerfDegradeLevel();
    const maxCap = deg >= 2 ? 48 : deg >= 1 ? 72 : 120;
    const effCount = deg >= 2 ? Math.max(2, Math.ceil(count * 0.45)) : deg >= 1 ? Math.max(3, Math.ceil(count * 0.7)) : count;
    for (let i = 0; i < effCount; i++) {
      const a = baseAng + (Math.random() - 0.5) * spread;
      const spd = 3.2 + Math.random() * 8.5;
      arena.sparks.push({
        x, y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd * 0.72,
        z: 8 + Math.random() * 14,
        vz: 2.2 + Math.random() * 4.5,
        life: 0.26 + Math.random() * 0.24,
        maxLife: 0.5,
        color: i % 3 === 0 ? "#ffffff" : color
      });
    }
    if (arena.sparks.length > maxCap) arena.sparks.splice(0, arena.sparks.length - maxCap);
  }

  function addRipple(x, y, maxR = 28, color = "rgba(130, 240, 225, 0.42)") {
    arena.ripples.push({ x, y, r: 4, maxR, alpha: 0.65, color });
    if (arena.ripples.length > 24) arena.ripples.shift();
  }

  function bumpCombo(n = 1) {
    arena.comboCount = Math.min(999, arena.comboCount + n);
    arena.maxStageCombo = Math.max(arena.maxStageCombo || 0, arena.comboCount);
    arena.comboTimer = 3.8;
    if (arena.comboCount >= 5 && !isPracticeModeActive() && !isSanctumDojoActive()) unlockAchievement("ach_orb5");
  }

  function gainRealmXp(amount, opts = {}) {
    if (!game || amount <= 0) return;
    const r = REALMS[game.realm];
    const omenMult = currentOmen(game).id === "tide" ? 1.45 : 1.0;
    const mindMult = (game.loadout.mind === "sword_still" || game.loadout.mind === "talisman_calm") ? COMBAT_RULE_PARAMS.skills.sword_still.xpMult : 1.0;
    const lf = getLifespanInfo(game);
    const lifeMult = (opts && opts.bypassLifespanPenalty) ? 1.0 : lf.xpEfficiencyMult;
    const finalAmt = Math.max(1, Math.round(amount * omenMult * mindMult * lifeMult));
    if (r.xpCap > 0) {
      const prevXp = game.xp;
      const total = game.xp + finalAmt;
      if (total > r.xpCap) {
        game.xp = r.xpCap;
        const nextCap = r.next && REALMS[r.next] ? (REALMS[r.next].xpCap || 600) : 600;
        game.overflowXp = Math.min(Math.round(nextCap * 0.45), (game.overflowXp || 0) + (total - r.xpCap));
      } else {
        game.xp = total;
      }
      if (prevXp < r.xpCap && game.xp >= r.xpCap) {
        Sound.fanfare();
        addRipple(arena.player.x, arena.player.y + 28, 78, "#ffe28a");
        const gate = getBreakthroughBossGate(game);
        showToast(gate && gate.locked
          ? `⚡ 修为圆满！需先击败【${gate.bossName}】方可引动天劫`
          : `⚡ 修为圆满！可点击下方【渡劫】冲关破境`, { tier: 2, category: "other", key: `xp_full_${game.realm}`, throttleMs: 6000 });
      }
    } else {
      game.stones += Math.max(4, Math.round(finalAmt * 0.35));
      const st = getCombatStats(game);
      game.hp = Math.min(st.maxHp, game.hp + 8);
      game.mp = Math.min(st.maxMp, game.mp + 6);
    }
  }

  function hasRunBoon(id) {
    return !!(arena && Array.isArray(arena.runBoons) && arena.runBoons.includes(id));
  }

  function getActiveDungeonClimate() {
    if (!arena || !arena.dungeonMap || !arena.dungeonMap.activeClimate) return null;
    return DUNGEON_CLIMATES[arena.dungeonMap.activeClimate] || null;
  }


  const GEAR_BAG_LIMIT = 24;
  const pendingGearOverflowQueue = []; // legacy compat mirror (formal source of truth is game.pendingRewards)
  let activeGearOverflowItem = null;
  const pendingSoulUnlockQueue = [];   // legacy compat mirror (formal source of truth is game.pendingRewards)
  let activeSoulUnlockId = null;
  let activePendingRewardId = null;
  let pendingRewardSeq = 0;
  let pendingAlchemyCraft = null;
  let pendingSoulRefineId = null;
  let pendingVolumeRecapOnDismiss = null;
  let temperUseCoreDiscount = false;
  const pendingUnlockCardQueue = [];
  let activeUnlockCardId = null;
  let lifespanExhaustedPromptDismissed = false;
  let pendingLifespanExhaustedPrompt = false;
  let activeLifespanModalOpen = false;

  function ensurePendingRewardArrays(g = game) {
    if (!g) return { pendingRewards: [], resolvedRewardIds: [] };
    if (!Array.isArray(g.pendingRewards)) g.pendingRewards = [];
    if (!Array.isArray(g.resolvedRewardIds)) g.resolvedRewardIds = [];
    return g;
  }

  function getCurrentRewardSourceMode() {
    if (sandboxMode) return "sandbox";
    if (isPracticeModeActive()) return "practice";
    if (arena.sanctumMode) return "sanctum";
    if (arena.towerMode) return "tower";
    if (arena.bossRush && arena.bossRush.active) return "boss_rush";
    if (arena.celestialSpire && arena.celestialSpire.active) return "spire";
    if (arena.cloudFlight && arena.cloudFlight.active) return "cloud_flight";
    if (arena.sectDefense && arena.sectDefense.active) return "sect_defense";
    if (arena.customSeedRun && arena.customSeedRun.active) return "custom_seed";
    return "campaign";
  }

  function getPendingRewardsByKind(kind = null) {
    if (!game || !Array.isArray(game.pendingRewards)) return [];
    return kind ? game.pendingRewards.filter(r => r && r.kind === kind) : game.pendingRewards.slice();
  }

  function syncPendingRewardsBadge() {
    const btn = document.getElementById("btn-pending-rewards");
    const cntEl = document.getElementById("pending-rewards-count");
    if (!btn || !cntEl) return;
    const ws = document.getElementById("welcome-screen");
    const onWelcome = Boolean(ws && ws.style.display !== "none");
    const total = (game && !onWelcome && Array.isArray(game.pendingRewards)) ? game.pendingRewards.length : 0;
    if (total > 0) {
      btn.style.display = "inline-flex";
      cntEl.textContent = String(total);
      btn.setAttribute("aria-label", `待处置奖励 ${total} 项`);
    } else {
      btn.style.display = "none";
      cntEl.textContent = "0";
      btn.setAttribute("aria-label", "待处置奖励");
    }
  }

  function enqueuePendingReward({ kind, payload = {}, noticeClass = "N1", eventId = null, persist = true, deferUi = false } = {}) {
    if (!game || !PENDING_REWARD_KINDS.has(kind)) return null;
    if (isPracticeModeActive()) return null; // Practice mode NEVER writes formal game.pendingRewards
    ensurePendingRewardArrays(game);
    const id = (typeof eventId === "string" && eventId.trim())
      ? eventId.trim().slice(0, 96)
      : `pr_${kind}_${Date.now().toString(36)}_${(++pendingRewardSeq).toString(36)}`;
    if (game.resolvedRewardIds.includes(id)) return null;
    const existingById = game.pendingRewards.find(r => r && r.eventId === id);
    if (existingById) return existingById;
    if (kind === "soul_unlock" && payload && payload.soulId) {
      const dupSoul = game.pendingRewards.find(r => r && r.kind === "soul_unlock" && r.payload && r.payload.soulId === payload.soulId);
      if (dupSoul) return dupSoul;
    }
    if (kind === "lifespan_exhausted") {
      const dupLife = game.pendingRewards.find(r => r && r.kind === "lifespan_exhausted");
      if (dupLife) return dupLife;
    }
    const cleanPayload = kind === "gear_overflow"
      ? { item: normalizeGearItem(payload.item) }
      : kind === "soul_unlock"
        ? { soulId: payload.soulId }
        : kind === "destiny_fruit"
          ? { isHeaven: !!payload.isHeaven }
          : kind === "iconic_draft"
            ? { titleText: safeText(payload.titleText, "大道顿悟 · 获赐神通").slice(0, 64), source: safeText(payload.source, "default").slice(0, 32) }
            : {};
    if (kind === "gear_overflow" && !cleanPayload.item) return null;
    if (kind === "soul_unlock" && (!cleanPayload.soulId || !hasOwn(SOUL_SPIRITS, cleanPayload.soulId))) return null;

    const rec = {
      eventId: id,
      kind,
      noticeClass: ["N0", "N1", "N2", "N3"].includes(noticeClass) ? noticeClass : "N1",
      sourceMode: getCurrentRewardSourceMode(),
      stageEpoch: Math.max(0, Math.floor(num(arena.stageEpoch, 0))),
      createdAt: Date.now(),
      payload: cleanPayload,
      status: "pending"
    };
    game.pendingRewards.push(rec);
    if (!deferUi) {
      if (game.pendingRewards.length > PENDING_REWARD_SOFT_WARN) {
        showToast(`⚠ 待处置奖励已达 ${game.pendingRewards.length} 项，请尽快点击顶部【待处置】处理！`, { tier: 1, key: "pending_soft_warn", throttleMs: 8000 });
      }
      syncPendingRewardsBadge();
      if (persist && !sandboxMode && !isPracticeModeActive()) {
        saveGame();
      }
      requestCalmReevaluation();
    }
    return rec;
  }

  function revertActivePendingRewardToPending() {
    if (!game || !Array.isArray(game.pendingRewards)) {
      activePendingRewardId = null;
      return;
    }
    if (activePendingRewardId) {
      const rec = game.pendingRewards.find(r => r && r.eventId === activePendingRewardId);
      if (rec) rec.status = "pending";
      activePendingRewardId = null;
    }
    for (const r of game.pendingRewards) {
      if (r && r.status === "active") r.status = "pending";
    }
    syncPendingRewardsBadge();
  }

  function commitPendingReward(eventId, mutateFn) {
    if (!game || !eventId) return { ok: false, reason: "missing" };
    ensurePendingRewardArrays(game);
    if (game.resolvedRewardIds.includes(eventId)) return { ok: false, reason: "already_resolved" };
    const idx = game.pendingRewards.findIndex(r => r && r.eventId === eventId);
    if (idx < 0) return { ok: false, reason: "not_found" };

    const rollbackSnap = JSON.parse(JSON.stringify(game));
    const rec = game.pendingRewards[idx];
    let mutateRes = true;
    try {
      mutateRes = typeof mutateFn === "function" ? mutateFn(rec) : true;
    } catch (e) {
      game = rollbackSnap;
      syncPendingRewardsBadge();
      return { ok: false, reason: "exception" };
    }
    if (mutateRes === false) {
      game = rollbackSnap;
      syncPendingRewardsBadge();
      return { ok: false, reason: "aborted" };
    }

    const rmIdx = game.pendingRewards.findIndex(r => r && r.eventId === eventId);
    if (rmIdx >= 0) game.pendingRewards.splice(rmIdx, 1);
    game.resolvedRewardIds.push(eventId);
    if (game.resolvedRewardIds.length > RESOLVED_REWARD_ID_LIMIT) {
      game.resolvedRewardIds.splice(0, game.resolvedRewardIds.length - RESOLVED_REWARD_ID_LIMIT);
    }
    if (activePendingRewardId === eventId) activePendingRewardId = null;

    if (!sandboxMode && !isPracticeModeActive()) {
      const saved = saveGame();
      if (!saved) {
        game = rollbackSnap;
        const retryRec = Array.isArray(game.pendingRewards) ? game.pendingRewards.find(r => r && r.eventId === eventId) : null;
        if (retryRec) retryRec.status = "pending";
        activePendingRewardId = null;
        activeGearOverflowItem = null;
        activeSoulUnlockId = null;
        activeLifespanModalOpen = false;
        renderHudSaveAlert();
        syncPendingRewardsBadge();
        updateHud();
        if (!saveConflictState) {
          showToast("⚠ 存档写入失败或只读保护，该项待处置奖励已回滚并保留，请清理空间或解除只读后重试！", { critical: true, key: "reward_commit_fail", throttleMs: 3000 });
        }
        return { ok: false, reason: "save_failed" };
      }
    }
    syncPendingRewardsBadge();
    return { ok: true, result: mutateRes };
  }

  function clearCompareSmeltConfirm() {
    if (compareSmeltConfirm && compareSmeltConfirm.timer) {
      clearTimeout(compareSmeltConfirm.timer);
    }
    compareSmeltConfirm = null;
  }

  function clearTransientChoiceQueues() {
    // F07: Clear ONLY transient UI pointers & transient inbox; NEVER wipe formal game.pendingRewards!
    pendingGearOverflowQueue.length = 0;
    activeGearOverflowItem = null;
    pendingSoulUnlockQueue.length = 0;
    activeSoulUnlockId = null;
    activePendingRewardId = null;
    pendingSandboxEntry = null;
    pendingAlchemyCraft = null;
    pendingSoulRefineId = null;
    pendingVolumeRecapOnDismiss = null;
    deferredVolumeRecapModal = null;
    lastVolumeRecapArgs = null;
    pendingUnlockCardQueue.length = 0;
    activeUnlockCardId = null;
    lifespanExhaustedPromptDismissed = false;
    pendingLifespanExhaustedPrompt = false;
    activeLifespanModalOpen = false;
    combatInbox.length = 0;
    combatInboxUnread = 0;
    clearCompareSmeltConfirm();
    arena.stageClearPending = false;
    arena.pickupAgg = {};
    pendingCompareGear = null;
    temperUseCoreDiscount = false;
    renderGearCompareCard();
    renderActiveUnlockCard();
    syncPendingRewardsBadge();
  }

  function resetStageTransitionState() {
    const wasCutscene = cutscene.active;
    cutscene.active = false;
    cutscene.onFinish = null;
    cutscene.triggerEl = null;
    const dlgBar = document.getElementById("story-dialogue-bar");
    if (dlgBar) {
      if (document.activeElement && dlgBar.contains(document.activeElement) && typeof document.activeElement.blur === "function") {
        try { document.activeElement.blur(); } catch (e) {}
      }
      dlgBar.classList.remove("open");
    }
    const chBox = document.getElementById("dlg-choices-box");
    if (chBox) {
      chBox.innerHTML = "";
      chBox.style.display = "none";
    }
    if (wasCutscene || cutscenePauseToken) {
      const prevCutTok = cutscenePauseToken;
      cutscenePauseToken = null;
      releasePauseToken(prevCutTok);
      if (typeof renderOnboardingCoach === "function") renderOnboardingCoach();
    }
    if (sceneTransitionTimer) {
      clearTimeout(sceneTransitionTimer);
      sceneTransitionTimer = null;
    }
    sceneTransitionState.active = false;
    const veil = document.getElementById("scene-transition-veil");
    if (veil) veil.classList.remove("active");
    if (regionCardTimer) {
      clearTimeout(regionCardTimer);
      regionCardTimer = null;
    }
    const rcc = document.getElementById("region-cinema-card");
    if (rcc) rcc.classList.remove("show");
    arena.stageClearHandledEpoch = -1;
    arena.stageClearPending = false;
    pendingVolumeRecapOnDismiss = null;
    deferredVolumeRecapModal = null;
    lastVolumeRecapArgs = null;
  }

  function openGearBagFullModal(newItem, recEventId = null) {
    if (!game || !newItem) {
      activeGearOverflowItem = null;
      return;
    }
    activeGearOverflowItem = { item: newItem, eventId: recEventId || activePendingRewardId || null };
    const nwRar = rarityNum(newItem.rarity);
    const nwLvl = Math.max(0, Math.floor(num(newItem.lvl, 0)));
    const smeltVal = Math.max(1, Math.floor(num(newItem.sell, 15)));
    const remQueue = Math.max(0, getPendingRewardsByKind("gear_overflow").length - 1);
    openModal(`
      <div class="drawer-mural-banner" style="height:82px;">
        <img src="${ART.banner_archive}" alt="行囊已满" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">显式处置 · 不自动熔炼</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:3px;">仙装行囊已满 (${game.gearBag.length}/${GEAR_BAG_LIMIT})</h2>
          </div>
          ${remQueue > 0 ? `<span class="tag-chip mythic">后续尚有 ${remQueue} 件待处理</span>` : `<span class="tag-chip">请择一处置新获仙装</span>`}
        </div>
      </div>

      <div class="jade-card" style="gap:7px;border-color:rgba(255,214,112,0.65);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:8px;min-width:0;">
            <img src="${ART[hasOwn(ART, newItem.art) ? newItem.art : "icon_blade"]}" alt="${escapeHtml(newItem.name)}" style="width:38px;height:38px;flex-shrink:0;" />
            <div style="min-width:0;">
              <div style="font-size:13px;font-weight:700;" class="txt-r${nwRar}">新获仙装：${escapeHtml(newItem.name)}${nwLvl > 0 ? ` +${nwLvl}` : ""}</div>
              <div style="font-size:11px;color:var(--jade);">${escapeHtml(formatGearStats(newItem))}</div>
            </div>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;">
            <button type="button" id="btn-overflow-smelt-new" class="btn-gold" data-action="overflow-smelt-new">熔炼新物 (+${smeltVal} 灵石)</button>
            <button type="button" id="btn-overflow-discard-new" class="btn-ghost" data-action="overflow-discard-new">放弃新物</button>
          </div>
        </div>
      </div>

      <div class="jade-card" style="gap:6px;">
        <div style="font-size:12px;color:#ffe89e;font-weight:700;">或择一件行囊旧物替换并熔炼：</div>
        <div style="max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:5px;padding-right:4px;">
          ${game.gearBag.map((old, idx) => {
            const oRar = rarityNum(old.rarity);
            const oLvl = Math.max(0, Math.floor(num(old.lvl, 0)));
            const oSell = Math.max(1, Math.floor(num(old.sell, 15)));
            return `
              <div class="visual-tile rarity-${oRar}" style="justify-content:space-between;padding:6px 8px;gap:8px;">
                <div style="display:flex;align-items:center;gap:7px;min-width:0;flex:1;">
                  <img src="${ART[hasOwn(ART, old.art) ? old.art : "icon_blade"]}" alt="${escapeHtml(old.name)}" style="width:30px;height:30px;flex-shrink:0;" />
                  <div style="min-width:0;">
                    <div style="font-size:11.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" class="txt-r${oRar}">${escapeHtml(old.name)}${oLvl > 0 ? ` +${oLvl}` : ""}</div>
                    <div style="font-size:10px;color:var(--text-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(formatGearStats(old))}</div>
                  </div>
                </div>
                <button type="button" class="btn-jade" style="padding:4px 9px;font-size:10.5px;white-space:nowrap;" data-overflow-replace-idx="${idx}">替换并熔炼旧物 (+${oSell}石)</button>
              </div>`;
          }).join("")}
        </div>
      </div>
    `, false, { kind: "gear_overflow" });
  }

  function syncUnlockCardStacking() {
    const cardEl = document.getElementById("new-unlock-card");
    if (!cardEl) return;
    const coach = document.getElementById("onboarding-coach-bar");
    cardEl.classList.toggle("stack-above-coach", Boolean(coach && coach.classList.contains("show")));
  }

  function markUnlockCardSeen(cardId) {
    if (!game || sandboxMode || !cardId) return;
    if (!Array.isArray(game.seenUnlockIds)) game.seenUnlockIds = [];
    if (!game.seenUnlockIds.includes(cardId)) {
      game.seenUnlockIds.push(cardId);
      saveGame();
    }
  }

  function renderActiveUnlockCard() {
    const el = document.getElementById("new-unlock-card");
    if (!el) return;
    const ws = document.getElementById("welcome-screen");
    const onWelcome = Boolean(ws && ws.style.display !== "none");
    const card = activeUnlockCardId ? UNLOCK_TUTORIAL_CATALOG.find(c => c.id === activeUnlockCardId) : null;
    if (!game || sandboxMode || onWelcome || !card || !isCombatCalm()) {
      const hadFocus = Boolean(document.activeElement && el.contains(document.activeElement));
      el.style.display = "none";
      el.innerHTML = "";
      el.dataset.renderedCardId = "";
      el.dataset.renderedRem = "";
      if (hadFocus) {
        const bd = document.getElementById("modal-backdrop");
        if (!(bd && bd.classList.contains("open")) && !drawerOpen) {
          restoreTriggerFocus(null);
        }
      }
      return;
    }
    const rem = pendingUnlockCardQueue.length;
    const remStr = String(rem);
    if (
      el.style.display === "flex" &&
      el.dataset.renderedCardId === card.id &&
      el.dataset.renderedRem === remStr &&
      el.querySelector("#btn-unlock-dismiss")
    ) {
      syncUnlockCardStacking();
      return;
    }
    const hadFocus = Boolean(document.activeElement && el.contains(document.activeElement));
    const prevFocusId = hadFocus ? (document.activeElement.id || "") : "";
    el.style.display = "flex";
    syncUnlockCardStacking();
    el.innerHTML = `
      <div class="unlock-card-top">
        <div style="display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap;">
          <span class="cinnabar-seal" style="font-size:9.5px;padding:1px 7px;">新神通 · ${escapeHtml(card.badge)}</span>
          <strong style="font-family:var(--font-serif);font-size:13.5px;color:#ffe89e;">${escapeHtml(card.title)}</strong>
          ${rem > 0 ? `<span class="tag-chip" style="font-size:9.5px;">+${rem}</span>` : ""}
        </div>
        <div class="unlock-card-actions">
          <button type="button" id="btn-unlock-try" class="btn-jade" style="padding:3px 10px;font-size:11px;white-space:nowrap;" data-action="unlock-card-try">${escapeHtml(card.tryLabel || "立即试用")}</button>
          <button type="button" id="btn-unlock-dismiss" class="btn-ghost" style="padding:3px 8px;font-size:11px;white-space:nowrap;" data-action="unlock-card-dismiss">知道了 ✕</button>
        </div>
      </div>
      <div class="unlock-card-body">
        <div>${escapeHtml(card.line1)}</div>
        <div style="color:var(--text-sub);">${escapeHtml(card.line2)}</div>
      </div>
    `;
    el.dataset.renderedCardId = card.id;
    el.dataset.renderedRem = remStr;
    if (hadFocus) {
      const target = (prevFocusId && document.getElementById(prevFocusId)) || document.getElementById("btn-unlock-dismiss");
      if (target && isElementFocusable(target)) {
        try { target.focus({ preventScroll: true }); } catch (e) {}
      } else {
        const bd = document.getElementById("modal-backdrop");
        if (!(bd && bd.classList.contains("open")) && !drawerOpen) {
          restoreTriggerFocus(null);
        }
      }
    }
  }

  function queueNewUnlockCardsForState(g) {
    if (!g || sandboxMode) return 0;
    if (!Array.isArray(g.seenUnlockIds)) g.seenUnlockIds = [];
    let added = 0;
    for (const card of UNLOCK_TUTORIAL_CATALOG) {
      if (isUnlockCardEarned(g, card) && !g.seenUnlockIds.includes(card.id) && activeUnlockCardId !== card.id && !pendingUnlockCardQueue.includes(card.id)) {
        pendingUnlockCardQueue.push(card.id);
        added += 1;
      }
    }
    if (added > 0) setTimeout(() => requestCalmReevaluation(), 0);
    return added;
  }

  function flushNewUnlockCard() {
    if (!game || sandboxMode) {
      activeUnlockCardId = null;
      renderActiveUnlockCard();
      return false;
    }
    const ws = document.getElementById("welcome-screen");
    if (ws && ws.style.display !== "none") return false;
    if (!isCombatCalm()) {
      renderActiveUnlockCard();
      return false;
    }
    if (cutscene.active || pendingVolumeRecapOnDismiss || deferredVolumeRecapModal || arena.stageClearPending || arena.tribulation || arena.defeatPending) return false;
    const bd = document.getElementById("modal-backdrop");
    if ((bd && bd.classList.contains("open")) || drawerOpen || photoMode.active) return false;
    if (activeUnlockCardId) {
      renderActiveUnlockCard();
      return true;
    }
    while (pendingUnlockCardQueue.length > 0) {
      const nextId = pendingUnlockCardQueue.shift();
      if (Array.isArray(game.seenUnlockIds) && game.seenUnlockIds.includes(nextId)) continue;
      activeUnlockCardId = nextId;
      renderActiveUnlockCard();
      return true;
    }
    renderActiveUnlockCard();
    return false;
  }

  function dismissActiveUnlockCard() {
    if (!activeUnlockCardId) return false;
    const doneId = activeUnlockCardId;
    activeUnlockCardId = null;
    markUnlockCardSeen(doneId);
    renderActiveUnlockCard();
    const bd = document.getElementById("modal-backdrop");
    if (!(bd && bd.classList.contains("open")) && !drawerOpen && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
      restoreTriggerFocus(null);
    }
    setTimeout(flushNewUnlockCard, 0);
    return true;
  }

  function tryActiveUnlockCard() {
    if (!game || !activeUnlockCardId) return false;
    const card = UNLOCK_TUTORIAL_CATALOG.find(c => c.id === activeUnlockCardId);
    const doneId = activeUnlockCardId;
    activeUnlockCardId = null;
    markUnlockCardSeen(doneId);
    renderActiveUnlockCard();
    if (!card) return false;
    const actStr = card.tryAction || "";
    if (actStr.startsWith("action:")) {
      const subAct = actStr.slice(7);
      if (subAct === "sanqing") triggerSanqingTriClones();
      else if (subAct === "shanhe") castShanheShejiDomain();
      else if (subAct === "warship") triggerWarshipOrbitalStrike();
      else triggerMappedAction(subAct);
    } else if (actStr.startsWith("weapon:")) {
      cycleWeaponArsenalForm(actStr.slice(7));
    } else if (actStr === "drawer:cultivate") {
      toggleDrawer("cultivate");
    } else if (actStr === "modal:star_chart") {
      openStarChartModal();
    } else if (actStr === "modal:expedition") {
      openExpeditionSandboxModal();
    } else if (actStr === "modal:workshop") {
      openCustomWorkshopModal();
    }
    const bd = document.getElementById("modal-backdrop");
    if (!(bd && bd.classList.contains("open")) && !drawerOpen && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
      restoreTriggerFocus(null);
    }
    showToast(`✦ 已试用【${card.title}】！`);
    setTimeout(flushNewUnlockCard, 0);
    return true;
  }

  function notifyUnlockCardTried(tryKey) {
    if (!game || sandboxMode || !activeUnlockCardId || !tryKey) return false;
    const card = UNLOCK_TUTORIAL_CATALOG.find(c => c.id === activeUnlockCardId);
    if (!card || !Array.isArray(card.tryKeys) || !card.tryKeys.includes(tryKey)) return false;
    const doneId = activeUnlockCardId;
    activeUnlockCardId = null;
    markUnlockCardSeen(doneId);
    renderActiveUnlockCard();
    showToast(`✦ 已试用【${card.title}】！`);
    setTimeout(flushNewUnlockCard, 0);
    return true;
  }

  function openNextPendingRewardRecord() {
    if (!game || !Array.isArray(game.pendingRewards) || game.pendingRewards.length === 0) return false;
    const kindOrder = ["gear_overflow", "soul_unlock", "destiny_fruit", "iconic_draft", "lifespan_exhausted"];
    let nextRec = null;
    for (const k of kindOrder) {
      nextRec = game.pendingRewards.find(r => r && r.kind === k && r.status !== "active");
      if (nextRec) break;
    }
    if (!nextRec) return false;

    if (nextRec.kind === "lifespan_exhausted") {
      if (lifespanExhaustedPromptDismissed || sandboxMode || isPracticeModeActive() || getLifespanInfo(game).status !== "exhausted") {
        const rm = game.pendingRewards.indexOf(nextRec);
        if (rm >= 0) game.pendingRewards.splice(rm, 1);
        syncPendingRewardsBadge();
        return openNextPendingRewardRecord();
      }
    }

    nextRec.status = "active";
    activePendingRewardId = nextRec.eventId;
    syncPendingRewardsBadge();

    if (nextRec.kind === "gear_overflow") {
      openGearBagFullModal(nextRec.payload.item, nextRec.eventId);
      return true;
    }
    if (nextRec.kind === "soul_unlock") {
      activeSoulUnlockId = nextRec.payload.soulId;
      openSoulSealUnlockChoiceModal(nextRec.payload.soulId, nextRec.eventId);
      return true;
    }
    if (nextRec.kind === "destiny_fruit") {
      openDestinyFruitModal(!!nextRec.payload.isHeaven, false, nextRec.eventId);
      return true;
    }
    if (nextRec.kind === "iconic_draft") {
      openIconicUpgradeDraft(nextRec.payload.titleText || "大道顿悟 · 获赐神通", false, {
        source: nextRec.payload.source || "default",
        eventId: nextRec.eventId
      });
      return true;
    }
    if (nextRec.kind === "lifespan_exhausted") {
      openLifespanExhaustedModal(false, nextRec.eventId);
      return true;
    }
    nextRec.status = "pending";
    activePendingRewardId = null;
    return false;
  }

  function flushCombatCalmQueue({ forceManual = false } = {}) {
    if (!game) return false;
    const ws = document.getElementById("welcome-screen");
    if (ws && ws.style.display !== "none") return false;
    if (saveConflictState || storageReadError || arena.defeatPending || cutscene.active || arena.tribulation) return false;
    if (pendingVolumeRecapOnDismiss || deferredVolumeRecapModal || arena.stageClearPending) return false;
    const bd = document.getElementById("modal-backdrop");
    if ((bd && bd.classList.contains("open")) || photoMode.active) return false;
    if (!forceManual && (drawerOpen || storageWriteError || saveReadOnlyMode)) return false;
    if (!forceManual && (!isCombatCalm() || (arena.calmT || 0) < COMBAT_CALM_GRACE_SEC)) return false;

    if (!forceManual) {
      flushCombatInboxSummary();
      renderGearCompareCard();
    }
    if (activePendingRewardId || activeGearOverflowItem || activeSoulUnlockId || activeLifespanModalOpen) {
      return false;
    }
    if (openNextPendingRewardRecord()) {
      arena.calmFlushed = true;
      return true;
    }
    if (!forceManual) {
      flushNewUnlockCard();
      arena.calmFlushed = true;
    }
    return false;
  }

  function flushDeferredChoiceModals(opts = {}) {
    return flushCombatCalmQueue({ forceManual: !!(opts && opts.force) });
  }

  function openPendingRewardsManually() {
    if (!game) return false;
    if (arena.defeatPending || saveConflictState || storageReadError) {
      showToast("⚠ 当前存在更高优先级的败北/存档保护弹窗，请先处理后再处置待领奖励！", { critical: true, key: "manual_pending_blocked_n0", throttleMs: 2500 });
      return false;
    }
    if (cutscene.active || arena.tribulation || pendingVolumeRecapOnDismiss || deferredVolumeRecapModal || arena.stageClearPending) {
      showToast("当前剧情/天劫进行中，结束后即可处置待领奖励。", { tier: 1, key: "manual_pending_blocked_story", throttleMs: 2000 });
      return false;
    }
    const bd = document.getElementById("modal-backdrop");
    if (bd && bd.classList.contains("open")) return false;
    if (drawerOpen) closeDrawer();
    if (!Array.isArray(game.pendingRewards) || game.pendingRewards.length === 0) {
      syncPendingRewardsBadge();
      return false;
    }
    return flushCombatCalmQueue({ forceManual: true });
  }

  function recordVol1PrepUpgradeDelta(beforeStats, label) {
    if (!game || !beforeStats) return;
    const afterStats = getCombatStats(game);
    const dAtk = Math.round((afterStats.atk || 0) - (beforeStats.atk || 0));
    const dHp = Math.round((afterStats.maxHp || 0) - (beforeStats.maxHp || 0));
    const dDr = Math.round((afterStats.dmgReduce || 0) - (beforeStats.dmgReduce || 0));
    const dCrit = Math.round(((afterStats.crit || 0) - (beforeStats.crit || 0)) * 100);
    const parts = [];
    if (dAtk !== 0) parts.push(`攻击 ${dAtk > 0 ? "+" : ""}${dAtk}`);
    if (dHp !== 0) parts.push(`气血 ${dHp > 0 ? "+" : ""}${dHp}`);
    if (dDr !== 0) parts.push(`减伤 ${dDr > 0 ? "+" : ""}${dDr}`);
    if (dCrit !== 0) parts.push(`暴击 ${dCrit > 0 ? "+" : ""}${dCrit}%`);
    if (arena.sanctumMode) {
      if (playtestTelemetry.sanctumFirstUpgradeSec === null) {
        playtestTelemetry.sanctumFirstUpgradeSec = Number(((Date.now() - playtestTelemetry.sessionStartedAt) / 1000).toFixed(2));
      }
      playtestTelemetry.sanctumUpgrades.push({ label, delta: parts.join(" · ") || "属性已更新", ts: Date.now() });
      const wasFirst = !(game.vol1Prep && game.vol1Prep.upgradeDone);
      game.vol1Prep = { upgradeDone: true, lastLabel: label };
      if (parts.length > 0 && (wasFirst || rankOf(game.realm) === 0)) {
        showToast(`✦ 洞府整备生效（${label}）：${parts.join(" · ")}！`, { tier: 2, key: "vol1_prep_delta", throttleMs: 1200 });
      }
      if (typeof renderOnboardingCoach === "function") renderOnboardingCoach();
    }
  }

  function equipGearWithOptionalTransfer(item, transferQuench = false) {
    if (!game || !item) return null;
    const beforeStats = getCombatStats(game);
    const bagIdx = game.gearBag.indexOf(item);
    if (bagIdx >= 0) game.gearBag.splice(bagIdx, 1);
    const prev = game.equippedGear[item.slot];
    let transferredLvl = 0;
    if (prev) {
      const prevLvl = prev.lvl || 0;
      const newLvl = item.lvl || 0;
      if (transferQuench && prevLvl > newLvl) {
        item.lvl = prevLvl;
        prev.lvl = 0;
        transferredLvl = prevLvl;
      }
      if (game.gearBag.length < GEAR_BAG_LIMIT) {
        game.gearBag.unshift(prev);
      } else {
        enqueuePendingReward({ kind: "gear_overflow", payload: { item: prev }, persist: false });
      }
    }
    game.equippedGear[item.slot] = item;
    if (pendingCompareGear === item) {
      pendingCompareGear = null;
      clearCompareSmeltConfirm();
    }
    syncFlyingSwords();
    recordVol1PrepUpgradeDelta(beforeStats, `换装 ${item.name}`);
    renderGearCompareCard();
    saveGame();
    updateHud();
    return { prev, transferredLvl };
  }

  function dismissGearCompareCard() {
    pendingCompareGear = null;
    clearCompareSmeltConfirm();
    renderGearCompareCard();
  }

  function renderGearCompareCard() {
    const el = document.getElementById("gear-compare-card");
    if (!el) return;
    const hideCompareCard = (clearHtml) => {
      const hadFocus = Boolean(document.activeElement && el.contains(document.activeElement));
      el.style.display = "none";
      if (clearHtml) el.innerHTML = "";
      el.dataset.renderedSig = "";
      clearCompareSmeltConfirm();
      if (hadFocus) {
        const bd = document.getElementById("modal-backdrop");
        if (!(bd && bd.classList.contains("open")) && !drawerOpen) {
          restoreTriggerFocus(null);
        }
      }
    };
    const onWelcome = document.getElementById("welcome-screen") && document.getElementById("welcome-screen").style.display !== "none";
    if (!game || !pendingCompareGear || onWelcome || !game.gearBag.includes(pendingCompareGear)) {
      hideCompareCard(true);
      return;
    }
    const calmNow = isCombatCalm();
    if (!calmNow || (document.body && document.body.classList.contains("combat-hot"))) {
      compareCardWasHiddenByCombat = true;
      hideCompareCard(false);
      return;
    }
    const nw = pendingCompareGear;
    const cur = game.equippedGear[nw.slot];
    if (!cur) {
      hideCompareCard(true);
      return;
    }
    const wasHidden = el.style.display === "none" || !el.innerHTML;
    const slotLabels = { weapon: "佩剑", armor: "仙衣", ring: "灵佩" };
    const curLvl = Math.max(0, Math.floor(num(cur.lvl, 0)));
    const nwLvl = Math.max(0, Math.floor(num(nw.lvl, 0)));
    const previewLvl = Math.max(curLvl, nwLvl);
    const nwRar = rarityNum(nw.rarity);
    const curRar = rarityNum(cur.rarity);
    const dAtk = effectiveGearVal(nw, "atk", previewLvl) - effectiveGearVal(cur, "atk");
    const dHp  = effectiveGearVal(nw, "hp", previewLvl) - effectiveGearVal(cur, "hp");
    const dDr  = effectiveGearVal(nw, "dr", previewLvl) - effectiveGearVal(cur, "dr");
    const dCrit = Math.round(((nw.crit || 0) - (cur.crit || 0)) * 100);
    const nwStatsStr = formatGearStats(nw);
    const curStatsStr = formatGearStats(cur);
    const deltas = [
      dAtk !== 0 ? `<span class="${dAtk > 0 ? "gear-delta-pos" : "gear-delta-neg"}">攻${dAtk > 0 ? "+" : ""}${dAtk}</span>` : "",
      dHp !== 0  ? `<span class="${dHp > 0 ? "gear-delta-pos" : "gear-delta-neg"}">血${dHp > 0 ? "+" : ""}${dHp}</span>` : "",
      dDr !== 0  ? `<span class="${dDr > 0 ? "gear-delta-pos" : "gear-delta-neg"}">防${dDr > 0 ? "+" : ""}${dDr}</span>` : "",
      dCrit !== 0 ? `<span class="${dCrit > 0 ? "gear-delta-pos" : "gear-delta-neg"}">暴${dCrit > 0 ? "+" : ""}${dCrit}%</span>` : ""
    ].filter(Boolean).join("") || `<span style="color:var(--text-sub);">基础属性相当</span>`;

    const smeltVal = Math.max(1, Math.floor(num(nw.sell, 15)));
    const itemConfirmKey = nw.uid || nw.name;
    const isConfirmingSmelt = Boolean(compareSmeltConfirm && compareSmeltConfirm.key === itemConfirmKey && performance.now() < compareSmeltConfirm.expiresAt);
    const renderSig = [
      nw.uid || "", nw.name, nw.slot, nwRar, nwLvl, nwStatsStr, smeltVal,
      cur.uid || "", cur.name, curRar, curLvl, curStatsStr,
      dAtk, dHp, dDr, dCrit,
      isConfirmingSmelt ? 1 : 0
    ].join("|");
    if (!wasHidden && el.style.display === "flex" && el.dataset.renderedSig === renderSig && el.querySelector('[data-action="compare-keep-bag"]')) {
      return;
    }
    if (wasHidden) {
      compareCardShownAt = performance.now();
      compareCardClickGuardUntil = (!arena.sanctumMode || compareCardWasHiddenByCombat) ? (compareCardShownAt + 250) : 0;
      compareCardWasHiddenByCombat = false;
    }

    const hadFocus = Boolean(document.activeElement && el.contains(document.activeElement));
    const prevFocusAct = hadFocus ? (document.activeElement.getAttribute("data-action") || "") : "";
    el.style.display = "flex";
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <strong style="font-size:12px;color:var(--gold-bright);">✦ 新获${slotLabels[nw.slot] || "仙装"}对比（已暂存行囊）</strong>
        <button type="button" class="btn-ghost" style="padding:1px 7px;font-size:10.5px;" data-action="compare-keep-bag">留袋 ✕</button>
      </div>
      <div class="gear-cmp-grid">
        <div class="gear-cmp-col new-item">
          <span style="font-size:9.5px;color:var(--jade);">新掉落 · ${RARITIES[nwRar].name}</span>
          <strong style="font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" class="txt-r${nwRar}">${escapeHtml(nw.name)}${nwLvl ? ` +${nwLvl}` : ""}</strong>
          <span style="font-size:10px;color:var(--text-sub);">${escapeHtml(nwStatsStr)}</span>
        </div>
        <div class="gear-cmp-col">
          <span style="font-size:9.5px;color:var(--text-sub);">当前穿戴${curLvl > 0 ? ` · 淬火+${curLvl}` : ""}</span>
          <strong style="font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" class="txt-r${curRar}">${escapeHtml(cur.name)}${curLvl ? ` +${curLvl}` : ""}</strong>
          <span style="font-size:10px;color:var(--text-sub);">${escapeHtml(curStatsStr)}</span>
        </div>
      </div>
      <div class="gear-delta-row">
        <span style="color:var(--text-sub);">${curLvl > 0 ? `继承+${previewLvl}差值：` : "换装差值："}</span>${deltas}
      </div>
      ${isConfirmingSmelt ? `<div class="gear-smelt-confirm-note">⚠ 即将永久熔炼【${escapeHtml(nw.name)}】（${escapeHtml(nwStatsStr)}）→ 获 <b>+${smeltVal} 灵石</b>，再次点击按钮确认</div>` : ""}
      <div class="gear-cmp-actions">
        ${curLvl > 0 ? `<button type="button" class="btn-jade" style="padding:4px 9px;font-size:11px;" data-action="compare-equip-transfer">换装并继承+${curLvl}</button>` : ""}
        <button type="button" class="${curLvl > 0 ? "btn-ghost" : "btn-jade"}" style="padding:4px 9px;font-size:11px;" data-action="compare-equip-direct">${curLvl > 0 ? "直接换装" : "一键换装"}</button>
        <button type="button" class="btn-ghost btn-smelt-danger ${isConfirmingSmelt ? "confirming" : ""}" style="padding:4px 9px;font-size:11px;" data-action="compare-smelt-new">${isConfirmingSmelt ? `确认熔炼【${escapeHtml(nw.name)}】(+${smeltVal}石)?` : `熔炼+${smeltVal}石`}</button>
      </div>
    `;
    el.dataset.renderedSig = renderSig;
    if (hadFocus) {
      const refocusBtn = (prevFocusAct && el.querySelector(`[data-action="${prevFocusAct}"]`))
        || el.querySelector('[data-action="compare-equip-direct"]')
        || el.querySelector('[data-action="compare-keep-bag"]');
      if (refocusBtn && isElementFocusable(refocusBtn)) {
        try { refocusBtn.focus({ preventScroll: true }); } catch (e) {}
      } else {
        const bd = document.getElementById("modal-backdrop");
        if (!(bd && bd.classList.contains("open")) && !drawerOpen) {
          restoreTriggerFocus(null);
        }
      }
    }
  }

  function acquireGearItem(item, opts = {}) {
    if (!game || !item) return { destination: null };
    if (game.goalStats) game.goalStats.craftOrLoot = (game.goalStats.craftOrLoot || 0) + 1;
    const cur = game.equippedGear[item.slot];
    let destination = "bag";
    if (!cur) {
      destination = "equipped";
      game.equippedGear[item.slot] = item;
      syncFlyingSwords();
      addFloat(`✦ ${item.name}↑`, arena.player.x, arena.player.y - 54, RARITIES[item.rarity].color, 14, true, { banner: false, kind: "gear" });
      if (!opts.silentToast) {
        showToast(`★ 穿戴仙装【${item.name}】（${formatGearStats(item)}）`, { tier: 2, category: "gear" });
      }
    } else if (game.gearBag.length < GEAR_BAG_LIMIT) {
      // Never silently overwrite an occupied or enhanced slot! Store safely & show non-blocking compare card when calm.
      destination = "bag";
      game.gearBag.unshift(item);
      pendingCompareGear = item;
      clearCompareSmeltConfirm();
      if (!opts.deferSave) renderGearCompareCard();
      addFloat(`✦ ${item.name}`, arena.player.x, arena.player.y - 48, RARITIES[item.rarity].color, 14, false, { banner: false, kind: "gear" });
      if (!opts.silentToast) {
        showToast(`✦ 拾获【${item.name}】已收入行囊（静默后可对比换装）`, { tier: 2, category: "gear" });
      }
    } else {
      // F07/F10/G9-1: Full bag (24/24) — NEVER auto-smelt! Persist in game.pendingRewards and defer modal until calm.
      destination = "overflow";
      enqueuePendingReward({ kind: "gear_overflow", payload: { item }, persist: false, deferUi: Boolean(opts.deferSave) });
      if (!opts.silentToast) {
        showToast(`行囊已满 (${GEAR_BAG_LIMIT}/${GEAR_BAG_LIMIT})，【${item.name}】已记入待处置！`, { tier: 2, category: "gear" });
      }
    }
    if (!opts.deferSave) {
      saveGame();
      updateHud();
      syncPendingRewardsBadge();
      requestCalmReevaluation();
    }
    return { destination };
  }
