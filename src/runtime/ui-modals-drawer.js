  // ==================== 11. CHARACTER RADAR SHEET, 4-SLOT GEAR, CLOUD MARKET & COMPENDIUM ====================
  function buildDaoRadarSvg(g) {
    // 5-Axis SVG Pentagon Radar: 仁心 / 锋芒 / 本真 / 丹器 / 剑威
    const cx = 68, cy = 66, maxR = 46;
    const vals = [
      Math.min(1, (g.dao.benevolence || 6) / 40),
      Math.min(1, (g.dao.edge || 10) / 45),
      Math.min(1, (g.dao.serenity || 6) / 40),
      Math.min(1, (0.25 + (g.immortalPills || 0) * 0.15 + g.ownedRelics.length * 0.2)),
      Math.min(1, getSwordCount(g) / 14)
    ];
    const labels = ["仁心", "锋芒", "本真", "丹器", "剑威"];
    const ringPts = ratio => [0, 1, 2, 3, 4].map(i => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      return `${(cx + Math.cos(a) * maxR * ratio).toFixed(1)},${(cy + Math.sin(a) * maxR * ratio).toFixed(1)}`;
    }).join(" ");
    const valPts = vals.map((v, i) => {
      const r = 0.22 + v * 0.78;
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      return `${(cx + Math.cos(a) * maxR * r).toFixed(1)},${(cy + Math.sin(a) * maxR * r).toFixed(1)}`;
    }).join(" ");

    return `<svg width="136" height="132" viewBox="0 0 136 132" style="flex-shrink:0;">
      <polygon points="${ringPts(1.0)}" fill="rgba(12,28,34,0.8)" stroke="rgba(216,179,106,0.38)" stroke-width="1"/>
      <polygon points="${ringPts(0.55)}" fill="none" stroke="rgba(216,179,106,0.18)" stroke-width="1"/>
      <polygon points="${valPts}" fill="rgba(74,210,184,0.34)" stroke="#ffe28a" stroke-width="1.8"/>
      ${labels.map((lb, i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const lx = cx + Math.cos(a) * (maxR + 14);
        const ly = cy + Math.sin(a) * (maxR + 12) + 3;
        return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#f8e3ac" font-size="10" font-weight="bold" text-anchor="middle">${lb}</text>`;
      }).join("")}
    </svg>`;
  }

  function updateComboRankSeal() {
    const seal = document.getElementById("combo-rank-seal");
    if (!seal) return;
    if ((arena.comboCount < 2 && (arena.styleScore || 0) < 40) || drawerOpen) {
      seal.classList.remove("active", "rank-s");
      return;
    }
    seal.classList.add("active");
    const sp = getStyleRankSpec(arena.styleScore || 0);
    seal.classList.toggle("rank-s", sp.rank === "S");
    const tierEl = document.getElementById("combo-tier-txt");
    tierEl.textContent = `${sp.title} ${sp.rank}`;
    tierEl.style.color = sp.color;
    document.getElementById("combo-count-txt").textContent = `×${Math.max(1, arena.comboCount)}`;
    document.getElementById("combo-buff-txt").textContent = sp.haste > 0
      ? `攻速+${Math.round(sp.haste * 100)}% · 暴伤+${Math.round(sp.critDmg * 100)}%${sp.dropPct ? ` · 掉宝+${sp.dropPct}%` : ""}`
      : "多招式变招衔接可飙升剑道风华";
    const varRow = document.getElementById("combo-variety-row");
    if (varRow) {
      varRow.innerHTML = (arena.recentMoveHistory || []).slice(-4).map(m => `<span class="style-move-tag">${STYLE_MOVE_LABELS[m] || m}</span>`).join("");
    }
    document.getElementById("combo-decay-bar").style.width = `${Math.max(8, Math.min(100, ((arena.styleDecayTimer || 0) / 4.6) * 100))}%`;
  }

  function updateBossBannerAndRecallOrb() {
    const bossBanner = document.getElementById("boss-hud-banner");
    const titanHud = document.getElementById("titan-parts-hud");
    const climbBtn = document.getElementById("titan-climb-btn");
    if (arena.cloudFlight && arena.cloudFlight.active && bossBanner) {
      const cf = arena.cloudFlight;
      const skyBoss = arena.enemies.find(e => e.isBoss && e.hp > 0);
      bossBanner.style.display = "flex";
      const rcc = document.getElementById("region-cinema-card");
      if (rcc) rcc.classList.remove("show");
      if (regionCardTimer) { clearTimeout(regionCardTimer); regionCardTimer = null; }
      if (titanHud) titanHud.classList.remove("active");
      if (climbBtn) climbBtn.classList.remove("active");
      document.getElementById("boss-banner-name").textContent = skyBoss ? `☁ ${skyBoss.name}` : "☁ 九霄云海 · 高速御剑破阵航程";
      document.getElementById("boss-banner-state").textContent = `弹反×${cf.deflectedCount} · 滚筒×${cf.barrelRolls} · 破阵 ${Math.round(cf.progress)}%`;
      document.getElementById("boss-hp-fill").style.width = skyBoss ? `${Math.round((skyBoss.hp / skyBoss.maxHp) * 100)}%` : `${Math.round(cf.progress)}%`;
      document.getElementById("boss-posture-fill").style.width = "100%";
      return;
    }
    if (arena.celestialSpire && arena.celestialSpire.active && bossBanner) {
      const sp = arena.celestialSpire;
      const rMeta = SPIRE_ROOM_TYPES.find(x => x.id === sp.roomType) || SPIRE_ROOM_TYPES[0];
      const rem = arena.enemies.filter(e => e.hp > 0).length;
      bossBanner.style.display = "flex";
      const rcc = document.getElementById("region-cinema-card");
      if (rcc) rcc.classList.remove("show");
      if (regionCardTimer) { clearTimeout(regionCardTimer); regionCardTimer = null; }
      if (titanHud) titanHud.classList.remove("active");
      if (climbBtn) climbBtn.classList.remove("active");
      const spPractice = Boolean(sp.practiceMode || (sp.startFloor && sp.startFloor > 1));
      document.getElementById("boss-banner-name").textContent = `${spPractice ? "【练习模式】" : ""}🏯 太虚登仙台 · 第 ${sp.floor}/9 重天【${rMeta.name}】`;
      document.getElementById("boss-banner-state").textContent = spPractice
        ? `练习模式（无奖不记榜）· 镇守余 ${rem}`
        : `奇物×${Object.values(game.spireCurios || {}).reduce((a, b) => a + Math.min(PERM_GROWTH_CAPS.spireCurioMaxStack, num(b, 0)), 0)}层 · 镇守余 ${rem}`;
      document.getElementById("boss-hp-fill").style.width = `${Math.round((sp.floor / 9) * 100)}%`;
      document.getElementById("boss-posture-fill").style.width = "100%";
      return;
    }
    if (arena.sectDefense && arena.sectDefense.active && bossBanner) {
      const sd = arena.sectDefense;
      bossBanner.style.display = "flex";
      const rcc = document.getElementById("region-cinema-card");
      if (rcc) rcc.classList.remove("show");
      if (regionCardTimer) { clearTimeout(regionCardTimer); regionCardTimer = null; }
      if (titanHud) titanHud.classList.remove("active");
      if (climbBtn) climbBtn.classList.remove("active");
      document.getElementById("boss-banner-name").textContent = `🛡 护山大阵 · 第 ${sd.wave}/${sd.maxWaves} 波百鬼夜行`;
      document.getElementById("boss-banner-state").textContent = `灵脉 ${Math.ceil(sd.coreHp)}/${sd.maxCoreHp} · 双剑塔协防`;
      document.getElementById("boss-hp-fill").style.width = `${Math.max(0, Math.round((sd.coreHp / sd.maxCoreHp) * 100))}%`;
      document.getElementById("boss-posture-fill").style.width = "100%";
      return;
    }
    const boss = arena.enemies.find(e => e.isBoss);
    if (boss && bossBanner) {
      if (titanHud) {
        titanHud.classList.toggle("active", !!boss.isTitan);
        if (boss.isTitan && boss.titanParts) {
          const mapIds = [
            ["left_claw", "titan-pct-left", "titan-bar-left"],
            ["brow_eye", "titan-pct-eye", "titan-bar-eye"],
            ["right_halberd", "titan-pct-right", "titan-bar-right"]
          ];
          mapIds.forEach(([pk, pctId, barId]) => {
            const pt = boss.titanParts[pk];
            const pct = pt.broken ? 0 : Math.max(0, Math.ceil((pt.hp / Math.max(1, pt.maxHp)) * 100));
            const pEl = document.getElementById(pctId); if (pEl) pEl.textContent = pt.broken ? "已破" : `${pct}%`;
            const bEl = document.getElementById(barId); if (bEl) bEl.style.width = `${pct}%`;
            const chip = titanHud.querySelector(`[data-lock-titan-part="${pk}"]`);
            if (chip) {
              chip.classList.toggle("locked", arena.lockedTitanPart === pk && !pt.broken);
              chip.classList.toggle("broken", !!pt.broken);
            }
          });
        }
      }
      if (climbBtn) {
        climbBtn.classList.toggle("active", !!(boss.isTitan && boss.titanCollapsed && !boss.climbExecuted && !boss.climbInProgress));
      }
      bossBanner.style.display = "flex";
      const rcc = document.getElementById("region-cinema-card");
      if (rcc) rcc.classList.remove("show");
      if (regionCardTimer) { clearTimeout(regionCardTimer); regionCardTimer = null; }
      const brPracticePrefix = (arena.bossRush && arena.bossRush.active && (arena.bossRush.practiceMode || (arena.bossRush.startBout && arena.bossRush.startBout > 1))) ? "【练习·无奖】" : "";
      document.getElementById("boss-banner-name").textContent = `${brPracticePrefix}${boss.name}`;
      const hasPylon = arena.props.some(p => p.kind === "ward_pylon" && p.hp > 0);
      const wpSpecB = BOSS_WEAKPOINTS[boss.id];
      const stunMultTxt = hasLaw(game, "stagger_surge")
        ? `${COMBAT_RULE_PARAMS.laws.stagger_surge.enhancedStunMult}×易伤`
        : `${COMBAT_RULE_PARAMS.laws.stagger_surge.baseStunMult}×易伤`;
      document.getElementById("boss-banner-state").textContent = hasPylon ? "🛡 阵眼金身护体 (先斩镇妖阵眼柱!)" : (arena.reversedDomainTimer || 0) > 0 ? "☯ 天象已逆转 (剑威+20%·攻速+20%!)" : boss.partSevered ? "💥 妖脉已寸断 (危招废除!)" : boss.state === "stun" ? `★ 破势绞杀中 (${stunMultTxt})` : (wpSpecB && !boss.partSevered) ? `◎ 弱点:${wpSpecB.shortName} ${Math.ceil((boss.partHp / Math.max(1, boss.maxPartHp)) * 100)}%` : (boss.wardHp || 0) > 0
        ? "🛡 护山金阵 (重击/爆剑破盾)"
        : boss.enraged ? "🔥 血怒狂化 · 剑轮斩弹!" : "白金架势";
      document.getElementById("boss-hp-fill").style.width = `${Math.max(0, Math.round((boss.hp / boss.maxHp) * 100))}%`;
      document.getElementById("boss-posture-fill").style.width = `${Math.max(0, Math.round((boss.posture / boss.maxPosture) * 100))}%`;
    } else if (bossBanner) {
      bossBanner.style.display = "none";
      if (titanHud) titanHud.classList.remove("active");
      if (climbBtn) climbBtn.classList.remove("active");
    }

    const totalMarks = arena.enemies.reduce((s, e) => s + (e.swordMarks || 0), 0);
    const recallBtn = document.getElementById("orb-recall");
    if (recallBtn) {
      recallBtn.classList.toggle("glow-gold", totalMarks >= 3 && arena.player.recallCd <= 0);
    }

    const medBtn = document.getElementById("orb-meditate");
    const medLbl = document.getElementById("lbl-meditate");
    if (medBtn && medLbl) {
      medBtn.classList.toggle("meditate-active", !!arena.player.meditating);
      medLbl.textContent = arena.player.meditating
        ? "收功"
        : (arena.player.zenStacks || 0) > 0 ? `剑心×${arena.player.zenStacks}` : "吐纳";
    }
  }

  function updateNavNotificationBadges() {
    if (!game) return;
    const rem = getReminderTier(game);
    const t2 = rem.tier2TabLow;
    const bStory = document.getElementById("badge-story");
    if (bStory) {
      bStory.style.display = t2.story > 0 ? "flex" : "none";
      bStory.textContent = String(t2.story);
      bStory.classList.add("tier-low");
      bStory.setAttribute("data-reminder-tier", t2.story > 0 ? "2" : "0");
    }
    const bCult = document.getElementById("badge-cultivate");
    if (bCult) {
      bCult.style.display = t2.cultivate ? "flex" : "none";
      bCult.classList.add("tier-low");
      bCult.setAttribute("data-reminder-tier", t2.cultivate ? "2" : "0");
    }
    const bExp = document.getElementById("badge-explore");
    if (bExp) {
      bExp.style.display = t2.explore ? "flex" : "none";
      bExp.classList.add("tier-low");
      bExp.setAttribute("data-reminder-tier", t2.explore ? "2" : "0");
    }
    const bAlch = document.getElementById("badge-alchemy");
    if (bAlch) {
      bAlch.style.display = t2.alchemy ? "flex" : "none";
      bAlch.classList.add("tier-low");
      bAlch.setAttribute("data-reminder-tier", t2.alchemy ? "2" : "0");
    }
  }

  function updateHud(animateNewUnlocks = false) {
    if (!game) return;
    const r = REALMS[game.realm];
    const st = getCombatStats(game);
    const om = currentOmen(game);
    const curStance = SWORD_STANCES[arena.stanceIdx];

    const curHero = getActivePlayableSpec();
    document.getElementById("hud-avatar").src = ART[curHero.avatar] || ART.char_player;
    document.getElementById("hud-name").textContent = curHero.id === "player"
      ? (game.titleUnlocked ? `${game.name}·剑尊` : game.name)
      : `${curHero.name}·同心`;
    syncTagTeamHud();
    document.getElementById("hud-realm").textContent = r.name;
    const calBadge = document.getElementById("hud-calamity-badge");
    if (calBadge) {
      const cTier = Math.max(0, Math.floor(Number(game.calamityTier) || 0));
      if (cTier > 0) {
        const calSp = getCalamityCycleSpec(cTier);
        calBadge.style.display = "inline-flex";
        calBadge.textContent = `🔥 劫火×${cTier}`;
        calBadge.setAttribute("data-tip", `劫火周目 · ${calSp.name}|${calSp.desc}`);
      } else {
        calBadge.style.display = "none";
      }
    }
    const lf = getLifespanInfo(game);
    document.getElementById("hud-age-school").textContent = `寿 ${lf.curYears}/${lf.maxYears}载 · 飞剑×${getSwordCount(game)} · 攻${st.atk}`;
    const lifeBadge = document.getElementById("hud-lifespan-badge");
    if (lifeBadge) {
      if (lf.status === "normal") {
        lifeBadge.style.display = "none";
        lifeBadge.textContent = "";
        lifeBadge.className = "hud-lifespan-pill";
      } else {
        lifeBadge.style.display = "inline-flex";
        lifeBadge.className = `hud-lifespan-pill ${lf.status}${lf.status === "exhausted" ? " lifespan-pulse" : ""}`;
        if (lf.status === "exhausted") {
          lifeBadge.textContent = "💀 寿尽 · 兵解/延寿";
          lifeBadge.setAttribute("data-tip", escTip(`大限已至 (${lf.curYears}/${lf.maxYears}载)`, `修炼效率降至 ${Math.round(lf.xpEfficiencyMult * 100)}%（不删档）；点击可服延寿青莲丹、暂留延寿或兵解转世`));
        } else if (lf.status === "critical") {
          lifeBadge.textContent = `⏳ 修炼${Math.round(lf.xpEfficiencyMult * 100)}%`;
          lifeBadge.setAttribute("data-tip", escTip(`大限临近 (${lf.curYears}/${lf.maxYears}载)`, `修炼效率降至 ${Math.round(lf.xpEfficiencyMult * 100)}%（-${lf.penaltyPct}%）；点击前往修行抽屉服延寿丹或破境延寿`));
        } else {
          lifeBadge.textContent = `⚠ 寿元${Math.round(lf.ratio * 100)}%`;
          lifeBadge.setAttribute("data-tip", escTip(`寿元警报 (${lf.curYears}/${lf.maxYears}载)`, "寿元已过 75%，建议炼制【延寿青莲丹】或积满修为破境延寿"));
        }
      }
    }

    document.getElementById("hud-hp-bar").style.width = `${Math.min(100, Math.round((game.hp / st.maxHp) * 100))}%`;
    document.getElementById("hud-mp-bar").style.width = `${Math.min(100, Math.round(((game.mp || 0) / st.maxMp) * 100))}%`;
    const xpPct = r.xpCap ? Math.min(100, Math.round((game.xp / r.xpCap) * 100)) : 100;
    document.getElementById("hud-xp-bar").style.width = `${xpPct}%`;
    const hpTxtEl = document.getElementById("hud-hp-txt");
    if (hpTxtEl) hpTxtEl.textContent = `${Math.max(0, Math.round(num(game.hp, 0)))}/${Math.max(1, Math.round(num(st.maxHp, 1)))}`;
    const mpTxtEl = document.getElementById("hud-mp-txt");
    if (mpTxtEl) mpTxtEl.textContent = `${Math.max(0, Math.round(num(game.mp, 0)))}/${Math.max(1, Math.round(num(st.maxMp, 1)))}`;
    const xpTxtEl = document.getElementById("hud-xp-txt");
    if (xpTxtEl) xpTxtEl.textContent = r.xpCap ? `${Math.max(0, Math.round(num(game.xp, 0)))}/${Math.max(1, Math.round(num(r.xpCap, 1)))}` : "圆满";
    document.getElementById("hud-stones").textContent = String(game.stones);
    document.getElementById("omen-label-txt").textContent = om.name.slice(0, 2);
    const qm = document.getElementById("quick-map-lbl");
    if (qm) qm.textContent = game.status === "ascended" ? "仙榜" : "锁妖塔";

    const hubBtn = document.getElementById("btn-sanctum-hub");
    if (hubBtn) {
      hubBtn.innerHTML = arena.sanctumMode
        ? `<svg class="svg-ico" style="width:13px;height:13px;" aria-hidden="true" viewBox="0 0 24 24"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/></svg><span>出征</span>`
        : `<svg class="svg-ico" style="width:13px;height:13px;" aria-hidden="true" viewBox="0 0 24 24"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg><span>洞府</span>`;
    }

    const chInfo = getActiveChapterInfo(game);
    const cVol = document.getElementById("compass-vol-label");
    const cStep = document.getElementById("compass-step-label");
    if (cVol) cVol.textContent = chInfo.vol;
    if (cStep) cStep.textContent = chInfo.step;

    const strip = document.getElementById("hud-build-strip");
    if (strip) {
      const icons = [];
      SYNERGIES.filter(s => s.active(game)).forEach(syn => {
        icons.push(`<span class="synergy-crest-pill" data-tip="${escTip("共鸣羁绊 · " + syn.name, syn.desc)}">★ ${syn.name}</span>`);
      });
      (game.destinyFruits || []).forEach(fid => {
        const df = hasOwn(DESTINY_FRUITS, fid) ? DESTINY_FRUITS[fid] : null;
        if (df) icons.push(`<span class="destiny-fruit-pill" data-tip="${escTip("逆天改命 · " + df.name, df.desc)}">☯ ${df.name}</span>`);
      });
      ["weapon", "armor", "ring"].forEach(sl => {
        const gItem = game.equippedGear[sl];
        const gRar = gItem ? rarityNum(gItem.rarity) : 0;
        if (gItem && gRar >= 1) {
          icons.push(`<div class="build-mini-ico rarity-${gRar}" data-tip="${escTip(gItem.name, formatGearStats(gItem))}"><img src="${ART[hasOwn(ART, gItem.art) ? gItem.art : "icon_blade"]}" alt="" /></div>`);
        }
      });
      if (arena.stageElement) {
        const isF = arena.stageElement === "frost";
        icons.push(`<div class="build-mini-ico" data-tip="${escTip(isF ? "玄冥寒霜附刃" : "九霄紫电附刃", isF ? "剑气减速妖群35%" : "剑气高概率触发紫电链雷")}"><img src="${ART[isF ? "relic_frost_sword" : "relic_soul_lamp"]}" alt="" /></div>`);
      }
      if (game.pet.id && hasOwn(SPIRIT_PETS, game.pet.id)) {
        const sp = SPIRIT_PETS[game.pet.id];
        const chosenPetSkills = getPetChosenSkills(game);
        const petTipDesc = chosenPetSkills.length
          ? `${sp.desc}｜已习灵技：${chosenPetSkills.map(sk => `${sk.name}(${sk.badge})`).join(" · ")}`
          : sp.desc;
        icons.push(`<div class="build-mini-ico" data-tip="${escTip(sp.name + " Lv." + Math.max(1, Math.floor(num(game.pet.level, 1))), petTipDesc)}"><img src="${ART[sp.art]}" alt="" /></div>`);
      }
      if (game.loadout.relic && hasOwn(RELICS, game.loadout.relic)) {
        const rl = RELICS[game.loadout.relic];
        const stars = getEquippedRelicStars(game);
        icons.push(`<div class="build-mini-ico" data-tip="${escTip(`${rl.name} ★${stars}`, `${rl.passive}｜主动：${rl.activeDesc}`)}"><img src="${ART[rl.art]}" alt="" /></div>`);
      }
      game.laws.forEach(id => {
        const l = hasOwn(DAO_LAWS, id) ? DAO_LAWS[id] : null;
        if (l) {
          const liveNote = getLawLiveContributionText(game, id);
          icons.push(`<div class="build-mini-ico" data-tip="${escTip(l.name, LAW_SHORT_BADGE[id] + " · " + l.desc + (liveNote ? "｜" + liveNote : ""))}"><img src="${ART[LAW_ICONS[id] || "icon_blade"]}" alt="" /></div>`);
        }
      });
      strip.innerHTML = icons.join("");
    }

    const stg = arena.towerMode ? STAGES[3] : STAGES[arena.stageIdx];
    document.getElementById("stage-title").textContent = arena.sanctumMode
      ? "听雨洞府 · 仙门主城"
      : (arena.customSeedRun && arena.customSeedRun.active)
        ? `太虚造化试剑 · ${arena.customSeedRun.seed}`
      : (arena.cloudFlight && arena.cloudFlight.active)
        ? "九霄云海 · 破阵凌霄"
        : (arena.celestialSpire && arena.celestialSpire.active)
          ? `${(arena.celestialSpire.practiceMode || (arena.celestialSpire.startFloor && arena.celestialSpire.startFloor > 1)) ? "【练习模式】" : ""}太虚登仙台 · 第 ${arena.celestialSpire.floor}/9 重天`
          : (arena.bossRush && arena.bossRush.active)
            ? `${(arena.bossRush.practiceMode || (arena.bossRush.startBout && arena.bossRush.startBout > 1)) ? "【练习模式】" : ""}万剑冢连战 · 第 ${arena.bossRush.bout}/${arena.bossRush.maxBouts || 7} 阵`
        : arena.towerMode ? `太虚锁妖塔 · 第 ${game.towerFloor} 层` : stg.name;

    const subTag = document.getElementById("wave-sub-tag");
    const hostiles = arena.enemies.filter(e => !e.isTreasure).length;
    const dmHud = arena.dungeonMap;
    const curNodeHud = dmHud ? dmHud.nodes[dmHud.currentNodeId] : null;
    const curRoomSpec = curNodeHud ? DUNGEON_ROOM_TYPES[curNodeHud.type] : null;
    const selectableHud = getSelectableNextNodeIds();
    if (arena.cloudFlight && arena.cloudFlight.active) subTag.textContent = "御剑空战";
    else if (arena.celestialSpire && arena.celestialSpire.active) subTag.textContent = (arena.celestialSpire.practiceMode || (arena.celestialSpire.startFloor && arena.celestialSpire.startFloor > 1)) ? "练习模式（无奖不记榜）" : "奇物深渊";
    else if (arena.bossRush && arena.bossRush.active) subTag.textContent = (arena.bossRush.practiceMode || (arena.bossRush.startBout && arena.bossRush.startBout > 1)) ? `练习模式（无奖不计分）· ⏱ ${arena.bossRush.elapsed.toFixed(1)}s` : `⏱ ${arena.bossRush.elapsed.toFixed(1)}s · 碎核×${arena.bossRush.partBreaks}`;
    else if (arena.tribulation) subTag.textContent = `⚡ 天劫余 ${arena.tribulation.boltsLeft + arena.tribulation.strikes.length} 道`;
    else if (arena.sanctumMode) subTag.textContent = "安全休整 · 聚灵养剑";
    else if (arena.domain) subTag.textContent = `☯ 太虚剑域 ${arena.domain.life.toFixed(1)}s`;
    else if (arena.player.meditating) subTag.textContent = lf.xpEfficiencyMult < 1 ? `☯ 周天吐纳 (${xpPct}% · 效率${Math.round(lf.xpEfficiencyMult * 100)}% · 每3秒耗1月寿元)` : `☯ 周天吐纳 (${xpPct}% · 每3秒耗1月寿元)`;
    else if (arena.towerMode) subTag.textContent = hostiles > 0 ? `余妖 ×${hostiles}` : "点击/Enter 进下一层";
    else if (arena.stageIdx === 0 && !game.openingChoice) subTag.textContent = hostiles > 0 ? `救沈清禾 (${hostiles})` : "点击/Enter 择玉莲仙缘";
    else if (arena.props.some(x => x.kind === "ascend_gate")) subTag.textContent = game.realm === "spirit" ? "点击/Enter 叩九霄仙门" : "点击/Enter 登九霄化神台";
    else if (arena.props.some(x => x.kind === "portal")) subTag.textContent = "点击/Enter 启下卷传送阵";
    else if (selectableHud.length > 0) subTag.textContent = "本层已清 · 按 9 择路";
    else if (curRoomSpec) subTag.textContent = `${curRoomSpec.icon} ${curRoomSpec.name}`;
    else subTag.textContent = "秘境试剑";

    const routeBtn = document.getElementById("btn-dungeon-route");
    if (routeBtn) {
      const showRoute = Boolean(
        dmHud && !arena.sanctumMode && !arena.towerMode
        && !(arena.bossRush && arena.bossRush.active)
        && !(arena.cloudFlight && arena.cloudFlight.active)
        && !(arena.celestialSpire && arena.celestialSpire.active)
        && !(arena.stageIdx === 0 && !game.openingChoice)
      );
      if (showRoute && curNodeHud) {
        const climH = getActiveDungeonClimate();
        const climStr = climH ? ` · ${climH.icon}${climH.name}` : "";
        routeBtn.style.display = "inline-flex";
        routeBtn.classList.toggle("ready-pulse", selectableHud.length > 0);
        routeBtn.textContent = selectableHud.length > 0
          ? `🧭 星图择路 (第${curNodeHud.layer + 1}/5层已清 · 点选下层)${climStr}`
          : `🧭 秘境星图 (第${curNodeHud.layer + 1}/5层)${climStr}`;
      } else {
        routeBtn.style.display = "none";
      }
    }
    const sanctumLbl = document.getElementById("lbl-sanctum-lv");
    if (sanctumLbl && game) {
      const pros = getSanctumProsperity(game);
      sanctumLbl.textContent = `${pros.title} Lv.${pros.totalLv}/${pros.maxTotalLv}`;
    }
    renderRunBoonStrip();

    const dotsRow = document.getElementById("wave-dots-row");
    if (arena.sanctumMode || arena.towerMode) {
      dotsRow.innerHTML = `<span class="wave-dot cleared"></span>`;
    } else {
      const curL = curNodeHud ? curNodeHud.layer : Math.min(4, arena.waveIdx);
      const bossDone = arena.waveIdx > 4;
      dotsRow.innerHTML = [0, 1, 2, 3, 4].map(i => `<span class="wave-dot ${(bossDone || i < curL) ? "cleared" : i === curL ? "active" : ""}"></span>`).join("");
    }

    document.getElementById("orb-img-slash").src = ART.icon_blade;
    const soulImg = document.getElementById("orb-img-soul");
    const soulLbl = document.getElementById("lbl-soul-name");
    if (soulImg && soulLbl && game) {
      const curSoul = hasOwn(SOUL_SPIRITS, game.equippedSoul) ? SOUL_SPIRITS[game.equippedSoul] : SOUL_SPIRITS.blood_warden;
      soulImg.src = ART.spirit_seal_emblem;
      soulLbl.textContent = curSoul.shortLbl;
    }
    const stanceBtn = document.getElementById("orb-stance");
    const stanceImg = document.getElementById("orb-img-stance");
    const stanceLbl = document.getElementById("lbl-stance-mode");
    if (stanceBtn && stanceImg && stanceLbl) {
      stanceBtn.className = `skill-orb-btn ${curStance.cls}`;
      stanceImg.src = ART[curStance.icon];
      stanceLbl.textContent = curStance.name;
    }
    document.getElementById("orb-img-recall").src = ART.relic_frost_sword;
    document.getElementById("orb-img-dash").src = ART.icon_seal;
    const medImg = document.getElementById("orb-img-meditate");
    if (medImg) medImg.src = ART.char_player_seated;
    document.getElementById("orb-img-ult").src = game.loadout.relic ? ART[RELICS[game.loadout.relic].art] : ART.relic_soul_lamp;
    const finImg1 = document.getElementById("orb-img-finisher"); if (finImg1) finImg1.src = ART.item_ascension_seal;
    const hasPei = game.aids.pei || Object.keys(game.choices).some(k => k.startsWith("pei"));
    document.getElementById("orb-img-ally").src = hasPei ? ART.char_pei : ART.char_shen;
    const allyLbl = document.getElementById("lbl-ally-count");
    const allyN = countBondedAllies(game);
    if (allyLbl) allyLbl.textContent = allyN > 1 ? `助阵×${allyN}` : "助阵";
    const jmpImg = document.getElementById("orb-img-jump");
    if (jmpImg) jmpImg.src = ART.vfx_sky_meteor_plunge;
    const blkImg = document.getElementById("orb-img-blink");
    if (blkImg) blkImg.src = ART.relic_frost_sword;
    document.getElementById("orb-img-pill").src = ART.item_immortal_gourd;
    if (!game.gourd) refillImmortalGourd();
    document.getElementById("lbl-pill-count").textContent = `葫${game.gourd.charges}/${game.gourd.maxCharges}`;
    syncKarmaHudPill();

    const petOrbBtn = document.getElementById("orb-pet");
    const petImg = document.getElementById("orb-img-pet");
    const petLbl = document.getElementById("lbl-pet-orb");
    if (petImg && petLbl) {
      const sp = game.pet && game.pet.id ? SPIRIT_PETS[game.pet.id] : null;
      petImg.src = sp ? ART[sp.art] : ART.pet_fox;
      petLbl.textContent = sp ? `${sp.name.slice(2, 4)}Lv${game.pet.level || 1}` : "择灵兽";
      if (petOrbBtn) {
        if (sp) {
          const chosenSkills = getPetChosenSkills(game);
          const skillTxt = chosenSkills.length ? `｜已习灵技：${chosenSkills.map(sk => sk.name).join(" / ")}` : "";
          petOrbBtn.setAttribute("data-tip", escTip(`灵宠觉醒神通 · ${sp.name} Lv.${game.pet.level || 1} (G)`, `${sp.desc}${skillTxt}`));
        } else {
          petOrbBtn.setAttribute("data-tip", "灵宠觉醒神通 (G)|结契灵兽或炼气期解封：催动随行本命灵兽释放全屏本源绝技！");
        }
      }
    }

    const tribLive = document.getElementById("tribulation-live-banner");
    const tribLiveTxt = document.getElementById("trib-live-txt");
    if (tribLive && tribLiveTxt) {
      if (arena.tribulation) {
        tribLive.classList.add("active");
        const done = Math.max(1, (arena.tribulation.totalBolts || 3) - arena.tribulation.boltsLeft);
        tribLiveTxt.textContent = `九霄紫霄雷劫（第 ${Math.min(arena.tribulation.totalBolts || 3, done)}/${arena.tribulation.totalBolts || 3} 重）· 空格一闪迎雷弹反凝天道一品`;
      } else {
        tribLive.classList.remove("active");
      }
    }

    const tribBtn = document.getElementById("tribulation-trigger-btn");
    const xpReady = (r.next && game.xp >= r.xpCap && !arena.tribulation) || (!r.next && game.status === "active" && r.xpCap > 0 && game.xp >= r.xpCap && !arena.tribulation);
    tribBtn.style.display = xpReady ? "inline-flex" : "none";
    const tribGate = xpReady ? getBreakthroughBossGate(game) : null;
    if (xpReady && tribGate && tribGate.locked) {
      tribBtn.textContent = `🔒 需先击败【${tribGate.bossName}】`;
      tribBtn.classList.add("trib-boss-locked");
      tribBtn.setAttribute("data-tip", escTip("天劫受阻 · 首领门控", `需先击败【${tribGate.bossName}】方可引动天劫；点击查看引路入口`));
    } else {
      tribBtn.textContent = !r.next ? "渡劫飞升 (B)" : `渡劫入${REALMS[r.next].name} (B)`;
      tribBtn.classList.remove("trib-boss-locked");
      tribBtn.setAttribute("data-tip", escTip("修为圆满 · 引动天劫 (B)", "点击或按 B 展开渡劫仪轨突破至下一境界"));
    }

    const medBtn = document.getElementById("orb-meditate");
    if (medBtn) {
      const medPrev = previewLifespanImpact(game, 10);
      medBtn.setAttribute("data-tip", escTip(
        "周天吐纳 · 满修渡劫 (B)",
        `盘膝悬浮引天地灵气入体（每 3 秒耗 1 月寿元，静修 30 秒约耗 10 月：${medPrev.before.curYears}→${medPrev.after.curYears}/${medPrev.after.maxYears}载${medPrev.warningText ? "，" + medPrev.warningText : ""}）：安全区全屏吸纳掉落；修为圆满后按 B 引动天劫破境！`
      ));
    }

    syncProgressiveSkillVisibility(animateNewUnlocks);
    syncDojoTrainingHudVisibility();
    updateBossBannerAndRecallOrb();
    updateCooldownMasks();
    renderQuestTrackerHud();
    renderOnboardingCoach();
    updateNavNotificationBadges();
    syncPendingRewardsBadge();
  }

  function syncProgressiveSkillVisibility(animateNew = false) {
    if (!game) return;
    const curRank = rankOf(game.realm);
    const fullOpen = Boolean(sandboxMode || game.unlockAllArcana);
    const hasAlly = countBondedAllies(game) > 0;
    const hasPet = !!(game.pet && game.pet.id);
    const pastPrologue = !!game.openingChoice || curRank >= 1 || fullOpen;

    document.querySelectorAll("#action-skill-dock .skill-orb-btn[data-unlock-rank]").forEach(btn => {
      const rawSk = btn.getAttribute("data-arena-skill");
      const mappedAct = rawSk === "pet_ult" ? "pet" : rawSk;
      const req = (mappedAct && ACTION_REALM_REQ[mappedAct] !== undefined)
        ? ACTION_REALM_REQ[mappedAct]
        : Number(btn.getAttribute("data-unlock-rank") || 0);
      let unlocked = fullOpen || curRank >= req;
      if (btn.id === "orb-ally" && hasAlly) unlocked = true;
      if (btn.id === "orb-pet" && hasPet) unlocked = true;
      const wasLocked = btn.classList.contains("skill-locked-tier");
      btn.classList.toggle("skill-locked-tier", !unlocked);
      if (animateNew && wasLocked && unlocked) {
        btn.classList.remove("skill-newly-unlocked");
        void btn.offsetWidth;
        btn.classList.add("skill-newly-unlocked");
      }
    });

    ["posture-switch-badge", "karma-hud-pill", "tag-team-hud-pill"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const req = Number(el.getAttribute("data-unlock-rank") || 0);
      const unlocked = fullOpen || curRank >= req;
      el.classList.toggle("hud-tier-hidden", !unlocked);
    });

    const omenBtn = document.getElementById("btn-omen-banner");
    if (omenBtn) omenBtn.classList.toggle("hud-tier-hidden", !fullOpen && curRank < 1);
    const mapBtn = document.getElementById("btn-world-map");
    if (mapBtn) mapBtn.classList.toggle("hud-tier-hidden", !pastPrologue);
    ["nav-btn-story", "nav-btn-explore", "nav-btn-alchemy"].forEach(navId => {
      const nb = document.getElementById(navId);
      if (nb) nb.classList.toggle("hud-tier-hidden", !pastPrologue);
    });

    const arcBtn = document.getElementById("btn-toggle-arcana");
    const arcLbl = document.getElementById("lbl-arcana-toggle");
    const arcWrap = document.getElementById("arcana-vault-wrap");
    const arcanaUnlocked = fullOpen || curRank >= 3;
    if (arcWrap) {
      arcWrap.classList.toggle("hud-tier-hidden", !arcanaUnlocked);
      if (!arcanaUnlocked) arcWrap.classList.remove("open");
    }
    if (arcBtn && arcLbl) {
      arcBtn.classList.toggle("locked-hint", !arcanaUnlocked);
      const hasLive = !!(
        (arena.astralForm && arena.astralForm.active) ||
        (arena.mountState && arena.mountState.active) ||
        (arena.qimenArray && arena.qimenArray.active) ||
        (arena.sanqingState && arena.sanqingState.active) ||
        (arena.shanheDomain && arena.shanheDomain.active) ||
        (arena.coop2P && arena.coop2P.active)
      );
      arcBtn.classList.toggle("has-live-buff", arcanaUnlocked && hasLive);
      arcLbl.textContent = arcanaUnlocked
        ? (arcWrap && arcWrap.classList.contains("open") ? "收起秘匣" : "太虚秘匣")
        : "太虚秘匣 · 金丹启";
    }
    document.querySelectorAll("#arcana-vault-drawer [data-arcana-act], #dojo-control-bar [data-arcana-act]").forEach(btn => {
      const actKey = btn.getAttribute("data-arcana-act");
      const ok = isActionUnlockedByRealm(game, actKey);
      btn.classList.toggle("eco-locked-btn", !ok);
      if (!ok) {
        const reqRank = ACTION_REALM_REQ[actKey] || 3;
        const reqRealm = REALMS[REALM_ORDER[reqRank] || "golden"];
        btn.setAttribute("data-eco-lock-tag", `🔒${reqRealm ? reqRealm.name : "高阶"}`);
      } else {
        btn.removeAttribute("data-eco-lock-tag");
      }
    });

    const allToggleBtn = document.getElementById("btn-toggle-arcana-all");
    const allToggleLbl = document.getElementById("lbl-arcana-all-state");
    if (allToggleBtn && allToggleLbl) {
      allToggleBtn.classList.toggle("active-toggle", sandboxMode);
      allToggleLbl.textContent = sandboxMode ? "沙盒中·点此退出" : "开启演武沙盒";
    }
    const sandboxBadge = document.getElementById("hud-sandbox-badge");
    if (sandboxBadge) {
      sandboxBadge.style.display = sandboxMode ? "flex" : "none";
    }

    document.querySelectorAll("[data-eco-sys]").forEach(btn => {
      const sysId = btn.getAttribute("data-eco-sys");
      const spec = getEcosystemSystemSpec(sysId);
      const ok = isEcosystemSystemUnlocked(game, sysId);
      btn.classList.toggle("eco-locked-btn", !ok);
      if (!ok && spec && REALMS[spec.min]) {
        btn.setAttribute("data-eco-lock-tag", `🔒${REALMS[spec.min].name}`);
      } else {
        btn.removeAttribute("data-eco-lock-tag");
      }
    });
  }

  function updateCooldownMasks() {
    const p = arena.player;
    const setCd = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (val > 0.05) { el.style.display = "flex"; el.textContent = val.toFixed(1); }
      else el.style.display = "none";
    };
    setCd("cd-soul", arena.soulCd || 0);
    setCd("cd-recall", p.recallCd);
    setCd("cd-dash", p.dashCd);
    setCd("cd-ult", p.ultCd);
    setCd("cd-jump", p.jumpCd || 0);
    setCd("cd-blink", p.blinkCd || 0);
    setCd("cd-ally", p.allyCd);
    setCd("cd-pet", arena.petUltCd || 0);
    const jmpLbl = document.getElementById("lbl-jump-state");
    if (jmpLbl) jmpLbl.textContent = (p.z || 0) > 14 ? "坠劈!" : "御空";
    const recBtn = document.getElementById("orb-recall");
    const recLbl = document.getElementById("lbl-recall-marks");
    if (recBtn && recLbl && game) {
      const spec6 = getCurrentSixAspectSpec();
      const totalMarks = arena.enemies.reduce((s, e) => s + (e.swordMarks || 0), 0);
      const morphOn = p.comboWindow > 0.25 && (arena.morphCd || 0) <= 0;
      recBtn.classList.toggle("glow-gold", totalMarks >= 3 && p.recallCd <= 0);
      recBtn.classList.toggle("morph-ready", morphOn);
      recBtn.setAttribute("data-morph-state", morphOn ? "morph" : (totalMarks > 0 ? "detonate" : "idle"));
      const morphCue = morphOn
        ? `★ 切手窗激活 (${Math.max(0.1, p.comboWindow).toFixed(1)}s)：右键立即释放【${spec6.name}】！`
        : `[连招中右键] 释放当前六象特技【${spec6.name}】｜[常态右键] 收剑引爆剑印（当前场上 ${totalMarks} 层）！`;
      recBtn.setAttribute("data-tip", escTip("切手六象特技 · 爆剑引爆 (右键)", morphCue));
      if (morphOn) {
        recLbl.textContent = spec6.short;
      } else {
        recLbl.textContent = totalMarks > 0 ? `爆剑(${totalMarks})` : "爆剑";
      }
    }
    const finBtn = document.getElementById("orb-finisher");
    const finLbl = document.getElementById("lbl-finisher-intent");
    const finMask = document.getElementById("cd-finisher");
    if (finBtn && finLbl && game) {
      const pct = Math.min(100, Math.floor(arena.swordIntent || 0));
      const ready = pct >= 100;
      finBtn.classList.toggle("finisher-ready", ready);
      finLbl.textContent = ready ? "★奥义" : `剑意${pct}%`;
      if (finMask) finMask.style.height = ready ? "0%" : `${100 - pct}%`;
    }
  }

  const FOCUSABLE_SELECTOR = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "details > summary:first-of-type",
    "[tabindex]:not([tabindex='-1'])"
  ].join(", ");

  function isHiddenInsideClosedDetails(el) {
    if (!el) return false;
    let cur = el.parentElement;
    while (cur && typeof cur.closest === "function") {
      const closedDetails = cur.closest("details:not([open])");
      if (!closedDetails) return false;
      const isDirectSummary = el.tagName === "SUMMARY" && el.parentElement === closedDetails;
      if (isDirectSummary && cur === closedDetails) {
        cur = closedDetails.parentElement;
        continue;
      }
      return true;
    }
    return false;
  }

  function getFocusableElements(container) {
    if (!container) return [];
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => {
      if (el.disabled || el.getAttribute("aria-hidden") === "true") return false;
      if (isHiddenInsideClosedDetails(el)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return el.offsetParent !== null || style.position === "fixed";
    });
  }

  function trapFocusInContainer(ev, container) {
    if (!container) return;
    const list = getFocusableElements(container);
    if (!list.length) {
      ev.preventDefault();
      if (typeof container.focus === "function") container.focus({ preventScroll: true });
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    const ae = document.activeElement;
    const inside = container.contains(ae);
    const idx = list.indexOf(ae);
    if (ev.shiftKey) {
      if (!inside || ae === first || ae === container || idx <= 0) {
        ev.preventDefault();
        last.focus({ preventScroll: true });
      }
    } else {
      if (!inside || ae === last || idx === -1) {
        ev.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
  }

  function focusDialogSafely(containerEl) {
    if (!containerEl) return;
    try {
      const list = getFocusableElements(containerEl);
      const target = list[0] || containerEl;
      if (target && typeof target.focus === "function") target.focus({ preventScroll: true });
    } catch (e) {}
  }

  function isElementFocusable(cand) {
    if (!cand || !cand.isConnected || cand.disabled || typeof cand.focus !== "function") return false;
    try {
      const dlgBar = document.getElementById("story-dialogue-bar");
      if (dlgBar && dlgBar.contains(cand) && !dlgBar.classList.contains("open")) return false;
      if (isHiddenInsideClosedDetails(cand)) return false;
      const style = window.getComputedStyle(cand);
      if (style.display === "none" || style.visibility === "hidden") return false;
      return cand.offsetParent !== null || style.position === "fixed";
    } catch (e) {
      return false;
    }
  }

  function focusBattlefield() {
    try {
      const ws = document.getElementById("welcome-screen");
      if (ws && ws.style.display !== "none") return false;
      const bd = document.getElementById("modal-backdrop");
      const modalOpen = !!(bd && bd.classList.contains("open"));
      if (cutscene.active || modalOpen || drawerOpen) return false;
      const stageEl = document.getElementById("visual-stage");
      if (stageEl && typeof stageEl.focus === "function") {
        stageEl.focus({ preventScroll: true });
        return document.activeElement === stageEl;
      }
    } catch (e) {}
    return false;
  }

  function restoreTriggerFocus(el) {
    try {
      const dlgBar = document.getElementById("story-dialogue-bar");
      if (cutscene.active) {
        focusDialogSafely(dlgBar);
        return;
      }
      const safeEl = (el && !(dlgBar && dlgBar.contains(el) && !dlgBar.classList.contains("open"))) ? el : null;
      if (isElementFocusable(safeEl)) {
        safeEl.focus({ preventScroll: true });
        return;
      }
      const ws = document.getElementById("welcome-screen");
      if (ws && ws.style.display !== "none") {
        const fallbacks = [document.getElementById("btn-continue-save"), document.getElementById("btn-start-new")];
        for (const fb of fallbacks) {
          if (isElementFocusable(fb)) {
            fb.focus({ preventScroll: true });
            return;
          }
        }
        return;
      }
      focusBattlefield();
    } catch (e) {}
  }

  function openModal(html, closeable = true, opts = {}) {
    const modalKind = (opts && opts.kind) || "";
    const nextPri = hasOwn(MODAL_PRIORITY, modalKind) ? MODAL_PRIORITY[modalKind] : MODAL_PRIORITY.default;
    const bd = document.getElementById("modal-backdrop");
    const box = document.getElementById("modal-content");
    if (!bd || !box) return false;
    const curOpen = Boolean(bd.classList.contains("open"));
    const curPri = curOpen ? (hasOwn(MODAL_PRIORITY, activeModalKind) ? MODAL_PRIORITY[activeModalKind] : MODAL_PRIORITY.default) : 0;

    // F09 Priority Guard: Lower-priority modals MUST NEVER overwrite active N0 (100) or P0_STORY (70) overlays.
    if (curOpen && curPri >= 70 && nextPri < curPri && !(opts && opts.forcePreempt)) {
      if (["gear_overflow", "soul_unlock", "destiny_fruit", "iconic_draft", "lifespan_exhausted"].includes(modalKind)) {
        revertActivePendingRewardToPending();
        activeGearOverflowItem = null;
        activeSoulUnlockId = null;
        activeLifespanModalOpen = false;
      }
      return false;
    }

    if (pendingVolumeRecapOnDismiss && modalKind !== "volume_recap") {
      if (nextPri >= 100 && lastVolumeRecapArgs) {
        // F12 A8: N0 preemption preserves volume recap for clean resume instead of firing orphanRecapCb prematurely!
        deferredVolumeRecapModal = lastVolumeRecapArgs;
        pendingVolumeRecapOnDismiss = null;
      } else {
        const orphanRecapCb = pendingVolumeRecapOnDismiss;
        pendingVolumeRecapOnDismiss = null;
        lastVolumeRecapArgs = null;
        orphanRecapCb();
      }
    }

    // F07/F09 Preemption: Re-queue active N1 pending reward back to "pending" (NEVER silently dismiss lifespan_exhausted!).
    if (curOpen && activeModalKind && modalKind !== activeModalKind) {
      if (["gear_overflow", "soul_unlock", "destiny_fruit", "iconic_draft", "lifespan_exhausted"].includes(activeModalKind)) {
        revertActivePendingRewardToPending();
        activeGearOverflowItem = null;
        activeSoulUnlockId = null;
        activeLifespanModalOpen = false;
      }
    }

    clearTransientInputs();
    const tipEl = document.getElementById("ling-tooltip");
    if (tipEl) tipEl.style.display = "none";
    if (!curOpen) {
      const dlgBar = document.getElementById("story-dialogue-bar");
      const explicitTrig = opts && opts.triggerEl;
      const ae = document.activeElement;
      if (explicitTrig && isElementFocusable(explicitTrig) && !(dlgBar && dlgBar.contains(explicitTrig))) {
        lastModalTriggerEl = explicitTrig;
      } else if (ae && ae !== document.body && !bd.contains(ae) && !(dlgBar && dlgBar.contains(ae)) && isElementFocusable(ae)) {
        lastModalTriggerEl = ae;
      } else {
        lastModalTriggerEl = null;
      }
    }
    // Acquire new modal pause token BEFORE releasing previous token so pauseTokens.size NEVER dips to 0 mid-swap!
    const nextTok = acquirePauseToken("modal", modalKind || "modal");
    const prevTok = modalPauseToken;
    modalPauseToken = nextTok;
    if (prevTok) releasePauseToken(prevTok);

    modalCloseable = closeable;
    if (activeMatSourceJump && activeMatSourceJump.inModal === "sanctum" && modalKind !== "sanctum_upgrade") {
      activeMatSourceJump = null;
    }
    activeModalKind = modalKind;
    const modalTier = (opts && opts.tier) || (nextPri >= 100 ? "critical" : nextPri >= 40 ? "decision" : "info");
    box.setAttribute("data-tier", modalTier);
    box.innerHTML = html;
    bd.classList.add("open");
    notePlaytestMenuOpen();
    renderPropInteractHud();
    focusDialogSafely(box);
    return true;
  }
  function closeModal() {
    clearTransientInputs();
    rebindListeningAction = null;
    pendingCloudImport = null;
    pendingSandboxEntry = null;
    pendingAlchemyCraft = null;
    pendingBatchCraft = null;
    pendingBatchEnhance = null;
    pendingSoulRefineId = null;
    if (activeMatSourceJump && activeMatSourceJump.inModal) activeMatSourceJump = null;
    const closingKind = activeModalKind;
    activeModalKind = "";
    if (activePendingRewardId) {
      // If an N1 modal is closed without committing (e.g., Esc on closeable modal), keep it safely pending (except explicit lifespan dismiss via Esc/X)
      if (closingKind === "lifespan_exhausted" && activeLifespanModalOpen) {
        const res = commitPendingReward(activePendingRewardId, () => true);
        if (res.ok) {
          lifespanExhaustedPromptDismissed = true;
          pendingLifespanExhaustedPrompt = false;
        } else if (saveConflictState && activeModalKind === "save_conflict") {
          activeLifespanModalOpen = false;
          return;
        }
      } else {
        revertActivePendingRewardToPending();
      }
    } else if (activeLifespanModalOpen) {
      lifespanExhaustedPromptDismissed = true;
      pendingLifespanExhaustedPrompt = false;
    }
    activeLifespanModalOpen = false;
    activeGearOverflowItem = null;
    activeSoulUnlockId = null;
    const tipEl = document.getElementById("ling-tooltip");
    if (tipEl) tipEl.style.display = "none";
    const bd = document.getElementById("modal-backdrop");
    const wasOpen = !!(bd && bd.classList.contains("open"));
    if (bd) bd.classList.remove("open");
    notePlaytestMenuClose();
    const prevTok = modalPauseToken;
    modalPauseToken = null;
    releasePauseToken(prevTok);
    renderPropInteractHud();
    const recapCb = pendingVolumeRecapOnDismiss;
    pendingVolumeRecapOnDismiss = null;
    if (closingKind === "volume_recap") lastVolumeRecapArgs = null;
    const target = lastModalTriggerEl;
    lastModalTriggerEl = null;
    if (wasOpen && cutscene.active) {
      focusDialogSafely(document.getElementById("story-dialogue-bar"));
    } else if (wasOpen && drawerOpen) {
      const panel = document.getElementById("jade-panel");
      if (panel && target && panel.contains(target) && isElementFocusable(target)) {
        try { target.focus({ preventScroll: true }); } catch (e) {}
      } else {
        focusDialogSafely(panel);
      }
    } else if (wasOpen && !drawerOpen) {
      restoreTriggerFocus(target);
    }
    if (recapCb) recapCb();
    // F09: Resume active defeat decision modal if it was preempted by a peer N0 overlay (e.g., save_conflict) that has now cleared!
    const stillOpen = Boolean(bd && bd.classList.contains("open"));
    if (!stillOpen && arena.defeatPending && !saveConflictState && game && closingKind !== "defeat") {
      openDefeatDecisionModal(!!arena.defeatPending.isTribulation);
      return;
    }
    // Resume volume recap if it was preempted by an N0 modal that has now cleanly cleared!
    if (deferredVolumeRecapModal && !saveConflictState && !storageReadError && !arena.defeatPending) {
      const savedRecap = deferredVolumeRecapModal;
      deferredVolumeRecapModal = null;
      if (game && arena.stageEpoch === savedRecap.stageEpoch) {
        setTimeout(() => {
          if (!game || arena.stageEpoch !== savedRecap.stageEpoch) return;
          if (saveConflictState || storageReadError || arena.defeatPending) {
            if (!deferredVolumeRecapModal) deferredVolumeRecapModal = savedRecap;
            return;
          }
          openVolumeEndRecapModal(savedRecap.stageIdx, savedRecap.payload, savedRecap.onDismiss);
        }, 0);
        return;
      }
    }
    setTimeout(() => requestCalmReevaluation(), 0);
  }

  function toggleDrawer(tab) {
    const tipEl = document.getElementById("ling-tooltip");
    if (tipEl) tipEl.style.display = "none";
    if (drawerOpen && currentTab === tab) { closeDrawer(); return; }
    if (activeMatSourceJump && !activeMatSourceJump.inModal) activeMatSourceJump = null;
    clearTransientInputs();
    const panel = document.getElementById("jade-panel");
    if (!drawerOpen) {
      const ae = document.activeElement;
      if (ae && ae !== document.body && panel && !panel.contains(ae) && isElementFocusable(ae)) {
        lastDrawerTriggerEl = ae;
      }
    }
    currentTab = tab;
    drawerOpen = true;
    if (!drawerPauseToken) drawerPauseToken = acquirePauseToken("drawer", tab || "drawer");
    if (panel) panel.classList.add("drawer-open");
    notePlaytestMenuOpen();
    document.querySelectorAll(".nav-tab-btn").forEach(b => b.classList.toggle("active", b.getAttribute("data-tab") === tab));
    renderDrawerContent();
    renderPropInteractHud();
    focusDialogSafely(panel);
  }

  function closeDrawer() {
    clearTransientInputs();
    if (activeMatSourceJump && !activeMatSourceJump.inModal) {
      activeMatSourceJump = null;
      const staleDrawerRet = document.querySelector("#jade-panel #btn-mat-source-return");
      if (staleDrawerRet) staleDrawerRet.remove();
    }
    const wasOpen = drawerOpen;
    furnaceGame.active = false;
    drawerOpen = false;
    const prevDrawerTok = drawerPauseToken;
    drawerPauseToken = null;
    releasePauseToken(prevDrawerTok);
    const modalOpen = !!(document.getElementById("modal-backdrop") && document.getElementById("modal-backdrop").classList.contains("open"));
    const panel = document.getElementById("jade-panel");
    if (panel) panel.classList.remove("drawer-open");
    notePlaytestMenuClose();
    document.querySelectorAll(".nav-tab-btn").forEach(b => b.classList.remove("active"));
    renderPropInteractHud();
    if (wasOpen && !modalOpen) {
      const target = lastDrawerTriggerEl;
      lastDrawerTriggerEl = null;
      restoreTriggerFocus(target);
      if (!cutscene.active) setTimeout(() => requestCalmReevaluation(), 0);
    }
  }

  function openCompanionStoryDrawer(storyId = null) {
    if (!game) return false;
    const bd = document.getElementById("modal-backdrop");
    if (bd && bd.classList.contains("open")) closeModal();
    if (!drawerOpen || currentTab !== "story") {
      toggleDrawer("story");
    } else {
      renderDrawerContent();
    }
    if (storyId && typeof storyId === "string") {
      const safeSid = storyId.replace(/[^a-zA-Z0-9_-]/g, "");
      if (safeSid) {
        const panel = document.getElementById("jade-panel");
        const card = panel ? panel.querySelector(`[data-story-card="${safeSid}"]`) : null;
        if (card) {
          try { card.scrollIntoView({ behavior: "smooth", block: "nearest" }); } catch (e) {}
          const btn = card.querySelector(`[data-play-story-bar="${safeSid}"]`) || card.querySelector("button:not([disabled])");
          if (btn && typeof btn.focus === "function") {
            try { btn.focus({ preventScroll: true }); } catch (e) {}
          }
        }
      }
    }
    return true;
  }

  function muralHeader(artKey, sealTxt, titleTxt) {
    const safeSeal = escapeHtml(sealTxt);
    const safeTitle = escapeHtml(titleTxt);
    return `
      <div class="drawer-mural-banner">
        <img src="${ART[artKey]}" alt="${safeTitle}" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">${safeSeal}</span>
            <h2 class="panel-title" style="margin-top:4px;">${safeTitle}</h2>
          </div>
          <button class="btn-ghost" data-close-drawer="1">收卷 ✕</button>
        </div>
      </div>`;
  }

  function renderDrawerContent() {
    const body = document.getElementById("panel-scroll-body");
    if (!body || !game) return;
    const st = getCombatStats(game);

    if (currentTab === "cultivate") {
      const curRank = rankOf(game.realm);
      const fullOpen = Boolean(sandboxMode || game.unlockAllArcana);
      const showQiTier = fullOpen || curRank >= 1;
      const showFoundTier = fullOpen || curRank >= 2;
      const showGoldTier = fullOpen || curRank >= 3;
      const showNascentTier = fullOpen || curRank >= 4;
      const showSpiritTier = fullOpen || curRank >= 5;
      const showWardrobe = showFoundTier || (metaState.ascensions || 0) >= 1;
      const schoolSkills = Object.values(SKILLS).filter(s => s.school === game.school && (fullOpen || game.learned.includes(s.id) || rankOf(s.min) <= curRank + 1));
      const lf = getLifespanInfo(game);
      const ageYears = lf.curYears;
      const maxYears = lf.maxYears;
      const longPills = game.inventory.longevity_pill || 0;
      const lifeColor = lf.status === "exhausted" ? "#ff6b78" : lf.status === "critical" ? "#ff8080" : lf.status === "warning" ? "#ffe28a" : "var(--gold-bright)";
      const daoB = st.daoBonuses || getDaoBonuses(game);
      const schoolB = st.schoolSpec || getSchoolSpecBonus(game);

      const matSourceHtml = (activeMatSourceJump && !activeMatSourceJump.inModal && activeMatSourceJump.tab === "cultivate")
        ? renderMatSourceInlinePanel(activeMatSourceJump, false)
        : "";
      const petPreview = computeUpgradePreview(game, "pet_feed", "pet");

      body.innerHTML = `
        ${muralHeader("banner_sanctum", "修行命盘", `${game.name} · ${REALMS[game.realm].name}期命盘`)}
        ${matSourceHtml}

        <!-- F16 Group 1: Core Loadout (open by default) -->
        <details class="drawer-collapse-group" data-cultivate-group="core" ${cultivateGroupOpen.core ? "open" : ""}>
          <summary>
            <span>${renderSemanticTag("main", "核心配装")} 命盘 · 仙装 · 心法</span>
            <span style="font-size:var(--fs-xs);color:var(--text-sub);font-family:var(--font-sans);">攻 ${st.atk} · ${escapeHtml(schoolB.name)}</span>
          </summary>
          <div class="drawer-group-body">
            <!-- Complete RPG Character Attribute & 5D Dao Radar Sheet -->
            <div class="jade-card" style="gap:8px;">
              <div style="display:flex;flex-direction:row;align-items:center;gap:10px;">
                ${buildDaoRadarSvg(game)}
                <div class="stat-kv-grid" style="flex:1;">
                  <div class="stat-kv-row"><span>骨龄寿元</span><b style="color:${lifeColor};">${ageYears}/${maxYears}载</b></div>
                  <div class="stat-kv-row"><span>修炼效率</span><b style="color:${lifeColor};">${Math.round(lf.xpEfficiencyMult * 100)}%${lf.penaltyPct > 0 ? ` (-${lf.penaltyPct}%)` : ""}</b></div>
                  <div class="stat-kv-row"><span>环身飞剑</span><b>×${getSwordCount(game)} 柄</b></div>
                  <div class="stat-kv-row"><span>剑道攻击</span><b>${st.atk}</b></div>
                  <div class="stat-kv-row"><span>护体减伤</span><b>${st.dmgReduce} (${Math.round((1 - Math.max(0.35, 100 / (100 + Math.max(0, st.dmgReduce || 0)))) * 100)}%)</b></div>
                  <div class="stat-kv-row"><span>暴击概率</span><b>${Math.round(st.crit * 100)}%</b></div>
                  <div class="stat-kv-row"><span>暴击倍率</span><b>${Math.round(st.critMult * 100)}%</b></div>
                </div>
              </div>
              <div id="dao-bonuses-strip" style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;padding-top:6px;border-top:1px solid rgba(132,208,194,0.16);font-size:var(--fs-xs);">
                <span class="tag-chip" style="border-color:${daoB.dominantColor};color:${daoB.dominantColor};">☯ ${daoB.dominantTitle}</span>
                <span class="tag-chip" data-tip="仁心道果 (${daoB.benevolence})|剧情善念与结缘提升仁心，永久增强仙葫疗愈与护盾上限">仁心 疗+${Math.round((daoB.healMult - 1) * 100)}%</span>
                <span class="tag-chip" data-tip="锋芒道果 (${daoB.edge})|锐意进取提升锋芒，永久增强削韧、暴击率与处决伤害">锋芒 破+${Math.round((daoB.postureMult - 1) * 100)}%</span>
                <span class="tag-chip" data-tip="本真道果 (${daoB.serenity})|明心见性提升本真，永久增强回蓝速率与灵石收益">本真 灵+${Math.round((daoB.mpRegenMult - 1) * 100)}%</span>
              </div>
              ${(() => {
                const ledger = computeCombatStatLedger(game);
                const sb = ledger.totals.statBreakdown;
                const fmtVal = (e) => {
                  if (e.bucket === "flat_atk" || e.bucket === "dr") return `+${Math.round(e.rawContribution)}`;
                  if (e.bucket === "active_mult" || e.id === "base_crit_mult") return `${Number(e.rawContribution).toFixed(2)}×`;
                  const rawP = Math.round(e.rawContribution * 100);
                  const effP = Math.round(e.effectiveDelta * 100);
                  const sign = rawP >= 0 ? "+" : "";
                  if (e.bucket === "passive_pct" && e.active && Math.abs(rawP - effP) >= 1) {
                    return `${sign}${rawP}% → 折算 ${sign}${effP}%`;
                  }
                  return `${sign}${rawP}%`;
                };
                const rows = ledger.entries.filter(e => e.active).map(e => `
                  <div class="stat-ledger-row">
                    <span style="color:var(--text-main);">${escapeHtml(e.label)} <small style="color:var(--text-sub);">(${escapeHtml(e.conditionText)})</small></span>
                    <b style="color:#ffe28a;white-space:nowrap;">${fmtVal(e)}</b>
                  </div>
                `).join("");
                return `
                  <details id="stat-breakdown-details" class="stat-breakdown-details">
                    <summary><span>📊 收益账本明细（基础 ${sb.baseAtk} · 常驻 ${Math.round(sb.rawPassivePct * 100)}%→${Math.round(sb.cappedPassivePct * 100)}% · 主动 ${sb.activeMult}×）</span></summary>
                    <div class="stat-ledger-list">${rows}</div>
                    <div class="stat-ledger-caps">
                      上限规则：常驻池软上限拐点 ${Math.round(ledger.caps.passiveSoftCapKnee * 100)}% / 极值 ${Math.round(ledger.caps.passiveSoftCapMax * 100)}% · 主动倍率 ≤${ledger.caps.activeMultCap}× · 暴击 ≤${Math.round(ledger.caps.critCap * 100)}% · 暴伤 ≤${Math.round(ledger.caps.critMultCap * 100)}% · 攻速 ${Math.round(ledger.caps.atkHasteMin * 100)}%–${Math.round(ledger.caps.atkHasteMax * 100)}% · 减伤系数 ≥${Math.round(ledger.caps.drMultFloor * 100)}%
                    </div>
                  </details>`;
              })()}
            </div>

            ${lf.status !== "normal" ? `
              <div class="lifespan-alert-card ${lf.status === "exhausted" ? "critical exhausted" : lf.status}">
                <div>
                  <strong>${lf.status === "exhausted" ? "💀 大限已至" : lf.status === "critical" ? "⏳ 大限临近" : "⚠ 寿元将近"}（余 ${lf.remainYears} 载 · 修炼效率 ${Math.round(lf.xpEfficiencyMult * 100)}%）</strong>
                  <div style="font-size:var(--fs-xs);opacity:0.92;margin-top:2px;">${lf.status === "exhausted"
                    ? "寿元已尽（修炼效率 -75%，绝不强制删档）：可服【延寿青莲丹】增寿30载、破境延寿，或主动选择【兵解转世】！"
                    : lf.status === "critical"
                      ? `寿元已逾 ${(typeof lf.rawRatio === "number" ? lf.rawRatio : lf.ratio) >= 0.95 ? "95%" : "90%"}（修炼效率 -${lf.penaltyPct}%）：速服【延寿青莲丹】或渡劫破境大增寿元！`
                      : "寿元已过 75%：建议升级紫微丹鼎 Lv.2 炼制延寿青莲丹，或积满修为破境延寿！"}</div>
                </div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;">
                  ${longPills > 0
                    ? `<button type="button" class="btn-secondary btn-jade" style="padding:4px 9px;font-size:var(--fs-xs);white-space:nowrap;" data-use-item="longevity_pill">服延寿丹(${longPills})</button>`
                    : `<button type="button" class="btn-primary btn-gold" style="padding:4px 9px;font-size:var(--fs-xs);white-space:nowrap;" data-action="open-sanctum-upgrade">建丹鼎延寿</button>`}
                  ${lf.status === "exhausted"
                    ? `<button type="button" class="btn-tertiary btn-ghost" style="padding:4px 9px;font-size:var(--fs-xs);white-space:nowrap;border-color:rgba(255,118,110,0.62);color:#ffb4ae;" data-action="open-lifespan-exhausted">兵解转世…</button>`
                    : ""}
                </div>
              </div>
            ` : ""}

            ${(game.laws && game.laws.length > 0) ? `
              <div class="jade-card" id="cultivate-laws-card" style="gap:6px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                  <strong style="font-size:var(--fs-sm);color:var(--gold-bright);">✦ 已悟大道法则（${game.laws.length}/${Object.keys(DAO_LAWS).length}）</strong>
                  <span style="font-size:var(--fs-xs);color:var(--text-sub);">常驻池当前 ${Math.round((st.statBreakdown?.rawPassivePct || 0) * 100)}% → 折算 ${Math.round((st.statBreakdown?.cappedPassivePct || 0) * 100)}%</span>
                </div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                  ${game.laws.map(lid => {
                    const lw = hasOwn(DAO_LAWS, lid) ? DAO_LAWS[lid] : null;
                    if (!lw) return "";
                    const liveNote = getLawLiveContributionText(game, lid);
                    return `<span class="tag-chip done" data-law-inspect="${escapeHtml(lid)}" data-tip="${escTip(lw.name, lw.desc + (liveNote ? "｜" + liveNote : ""))}">${escapeHtml(lw.name)}${liveNote ? ` · ${escapeHtml(liveNote)}` : ""}</span>`;
                  }).join("")}
                </div>
              </div>
            ` : ""}

            <!-- 4-Slot Immortal Gear Loadout + Progressive Quench / Batch Enhance / Reforge / Primordial Awaken -->
            <div class="jade-card">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
                <strong style="font-size:var(--fs-sm);color:var(--gold-bright);">神兵仙装 · 淬火锻造</strong>
                <div style="display:flex;gap:5px;align-items:center;">
                  ${getActiveSetBonus(game) ? `<span class="tag-chip mythic" data-tip="${escTip(getActiveSetBonus(game).name, getActiveSetBonus(game).desc)}">✦ ${getActiveSetBonus(game).name}</span>` : `<span class="tag-chip">凑齐3件激活套装</span>`}
                  ${game.gearBag.length > 0 ? `<button class="btn-secondary btn-jade" style="padding:2px 8px;font-size:var(--fs-xs);" data-action="smelt-all-gear">熔炼(${game.gearBag.length})</button>` : ""}
                </div>
              </div>
              ${showQiTier ? (() => {
                const pt = ensureDeterministicPity(game);
                const epicPct = Math.min(100, Math.round((pt.epic / 4) * 100));
                const mythicPct = Math.min(100, Math.round((pt.mythic / 8) * 100));
                return `<div class="pity-bar-card" data-tip="天机掉落保底|每 4 件装备必出紫品以上，每 8 件必出仙品橙装；掉落自动倾向弱槽，紫/橙装 100% 附带词条">
                  <span>紫品保底 <b style="color:#d69eff;">${pt.epic}/4</b><span class="pity-meter-track"><span class="pity-meter-fill" style="width:${epicPct}%"></span></span></span>
                  <span>仙品保底 <b style="color:#ffe28a;">${pt.mythic}/8</b><span class="pity-meter-track"><span class="pity-meter-fill" style="width:${mythicPct}%"></span></span></span>
                </div>`;
              })() : ""}
              <div class="grid-2">
                ${[
                  { slot: "weapon", label: "本命佩剑", emptyArt: "icon_blade" },
                  { slot: "armor",  label: "护身仙衣", emptyArt: "icon_heart" },
                  { slot: "ring",   label: "乾坤灵佩", emptyArt: "item_jade" }
                ].map(meta => {
                  const eq = game.equippedGear[meta.slot];
                  const enhCost = getGearEnhanceCost(game, eq);
                  const eqRar = eq ? rarityNum(eq.rarity) : 0;
                  const eqLvl = eq ? Math.max(0, Math.floor(num(eq.lvl, 0))) : 0;
                  const up = eq ? computeUpgradePreview(game, "gear_enhance", meta.slot, { steps: 1 }) : null;
                  const showBatchBtn = Boolean(eq && eqLvl < 10 && (showQiTier || game.stones >= enhCost));
                  return `
                    <div class="visual-tile ${eq ? `rarity-${eqRar}` : ""}" style="flex-direction:column;align-items:stretch;gap:5px;padding:7px 8px;">
                      <div style="display:flex;align-items:center;gap:7px;">
                        <img src="${ART[eq && hasOwn(ART, eq.art) ? eq.art : meta.emptyArt]}" alt="${meta.label}" style="width:32px;height:32px;" />
                        <div style="min-width:0;flex:1;">
                          <div style="font-size:var(--fs-sm);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" class="${eq ? `txt-r${eqRar}` : ""}">${eq ? `${escapeHtml(eq.name)}${eqLvl > 0 ? ` +${eqLvl}` : ""}` : `${meta.label}·空`}</div>
                          <div style="font-size:var(--fs-xs);color:var(--text-sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${eq ? escapeHtml(formatGearStats(eq)) : "秘境斩妖掉落"}</div>
                        </div>
                      </div>
                      ${eq && up && up.valid ? `
                        <div class="upgrade-preview-strip" data-upgrade-preview="gear_${meta.slot}">
                          <span>${escapeHtml(up.costText)} → <b>${escapeHtml(up.deltaText)}</b></span>
                          <span style="color:var(--text-sub);">适用：${escapeHtml(up.sceneText)}</span>
                        </div>` : ""}
                      ${eq ? `
                        <div style="display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap;">
                          <button type="button" class="gear-action-mini ${game.stones < enhCost && eqLvl < 10 ? "is-locked" : ""}" data-enhance-slot="${meta.slot}" data-reminder-tier="${game.stones >= enhCost && eqLvl < 10 ? "2" : "3"}" data-tip="神兵淬火强化|消耗 ${enhCost} 灵石提升基础属性 +8%（最高+10）">${eqLvl >= 10 ? "已满+10" : `淬火+${eqLvl + 1}(${enhCost}石)`}</button>
                          ${showBatchBtn ? `<button type="button" class="gear-action-mini" data-open-batch-enhance="${meta.slot}" data-tip="显式多阶淬火|自选 +1/+3/+5 阶并预览总灵石与属性增幅，确认后一次性扣除">多阶…</button>` : ""}
                          ${showFoundTier ? `<button type="button" class="gear-action-mini" data-reforge-slot="${meta.slot}" data-tip="定向词条刻录|消耗 35 灵石 100% 确定自选心仪圣品神通词条">定刻(35石)</button>` : ""}
                          ${showGoldTier ? (eqRar >= 5 ? `<span class="tag-chip mythic" style="font-size:var(--fs-xs);">★紫气已醒</span>` : `<button type="button" class="gear-action-mini" style="border-color:#ff9eff;color:#ffd6ff;" data-awaken-primordial="${meta.slot}" data-tip="鸿蒙紫气突破 (圣品之上)|消耗 120 灵石将神兵晋升为【紫气鸿蒙】至高品阶并觉醒专属太初本源词条！">紫气突破(120石)</button>`) : ""}
                        </div>
                      ` : ""}
                    </div>`;
                }).join("")}
                ${showQiTier ? (() => {
                  const relicSpec = (game.loadout.relic && hasOwn(RELICS, game.loadout.relic)) ? RELICS[game.loadout.relic] : null;
                  return `
                <button class="visual-tile ${relicSpec ? "rarity-4" : ""}" data-tab="alchemy">
                  <img src="${ART[relicSpec ? relicSpec.art : "relic_soul_lamp"]}" alt="法宝" style="width:34px;height:34px;" />
                  <div>
                    <div style="font-size:var(--fs-sm);font-weight:700;color:#ffe07d;">${relicSpec ? `${relicSpec.name} ★${num(getEquippedRelicStars(game), 0)}` : "镇魂法宝·空"}</div>
                    <div style="font-size:var(--fs-xs);color:var(--text-sub);">${relicSpec ? "点击赴百工升星" : "点击赴百工铸造"}</div>
                  </div>
                </button>`;
                })() : `
                <div class="visual-tile is-locked">
                  <img src="${ART.relic_soul_lamp}" alt="法宝" style="width:32px;height:32px;" />
                  <div>
                    <div style="font-size:var(--fs-sm);font-weight:700;color:#ffe07d;">镇魂法宝</div>
                    <div style="font-size:var(--fs-xs);color:var(--text-sub);">炼气期百工铸造</div>
                  </div>
                </div>`}
              </div>
            </div>

            <div class="jade-card">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div style="display:flex;gap:6px;">
                  <button class="btn-tertiary btn-ghost ${game.school === "sword" ? "active-pill" : ""}" data-school="sword">青霜御剑</button>
                  <button class="btn-tertiary btn-ghost ${game.school === "talisman" ? "active-pill" : ""}" data-school="talisman">紫霄雷符</button>
                </div>
                <span style="font-size:var(--fs-xs);color:var(--text-sub);">${showQiTier ? "三才剑阵 (Y键)" : "流派心法"}</span>
              </div>
              <div id="school-spec-banner" style="font-size:var(--fs-xs);padding:5px 8px;border-radius:7px;background:rgba(12,26,32,0.72);border:1px solid ${schoolB.color}55;color:${schoolB.color};">
                ✦ ${schoolB.name}专精 · ${schoolB.badge}
              </div>
              ${(() => {
                const pos = getBuildPositioningSummary(game);
                return `
                  <details id="build-role-summary" class="stat-breakdown-details">
                    <summary><span>⚔ 流派定位与六象派生（${escapeHtml(pos.schoolName)} · ${escapeHtml(pos.sixAspect.short)}）</span></summary>
                    <div style="margin-top:5px;display:flex;flex-direction:column;gap:4px;color:var(--text-sub);line-height:1.45;">
                      <div><b style="color:#ffe28a;">核心定位：</b>${escapeHtml(pos.roleTitle)}</div>
                      <div><b style="color:#80ffea;">输出循环：</b>${escapeHtml(pos.coreLoop)}</div>
                      <div><b style="color:#70ffe6;">当前六象：</b>${escapeHtml(pos.weaponName)} × ${escapeHtml(pos.postureName)} → <b>【${escapeHtml(pos.sixAspect.name)}】</b></div>
                      <div><b style="color:#d69eff;">三才剑阵：</b>${pos.stances.map(s => `${s.name}(${s.role})`).join(" ｜ ")}</div>
                    </div>
                  </details>`;
              })()}
              ${showQiTier ? `
              <div class="grid-3">
                ${SWORD_STANCES.map((stItem, idx) => `
                  <button class="visual-tile ${arena.stanceIdx === idx ? "equipped" : ""}" style="flex-direction:column;text-align:center;padding:6px;" data-set-stance="${idx}">
                    <img src="${ART[stItem.icon]}" alt="${stItem.name}" style="width:28px;height:28px;" />
                    <strong style="font-size:var(--fs-sm);">${stItem.name}</strong>
                  </button>
                `).join("")}
              </div>` : ""}
              <div class="grid-3">
                ${schoolSkills.map(s => {
                  const eq = game.loadout[s.slot] === s.id;
                  const owned = game.learned.includes(s.id);
                  const realmOk = rankOf(game.realm) >= rankOf(s.min);
                  const lbl = eq ? "已佩" : owned ? "佩带" : !realmOk ? `${REALMS[s.min].name}悟` : `${s.price}石`;
                  return `
                    <button class="visual-tile ${eq ? "equipped" : ""} ${(!owned && !realmOk) ? "is-locked" : ""}" style="flex-direction:column;text-align:center;padding:6px;" data-skill="${s.id}" data-tip="${escTip(s.name, s.desc)}" ${(!owned && !realmOk) ? "disabled" : ""}>
                      <img src="${ART[s.art]}" alt="${s.name}" style="width:30px;height:30px;" />
                      <strong style="font-size:var(--fs-xs);">${s.name}</strong>
                      <span class="tag-chip ${eq ? "done" : ""}">${lbl}</span>
                    </button>`;
                }).join("")}
              </div>
            </div>
          </div>
        </details>

        <!-- F16 Group 2: Advanced Systems (rendered at Qi+, open by default & user-collapsible) -->
        ${showQiTier ? (() => {
          const petLv = Math.max(1, Math.min(5, Math.floor(num(game.pet.level, 1))));
          const feedCost = game.pet.id ? getPetNextFeedCost(petLv) : null;
          const canFeedNow = canAffordPetFeed(game);
          const feedCostCompact = feedCost ? formatPetFeedCost(feedCost, null) : "";
          const feedCostOwned = feedCost ? formatPetFeedCost(feedCost, game.inventory) : "";
          const petSkills = game.pet.skills || {};
          const sk3 = (petLv >= 3 && petSkills.tier3 && hasOwn(PET_SKILLS_BY_ID, petSkills.tier3)) ? PET_SKILLS_BY_ID[petSkills.tier3] : null;
          const sk5 = (petLv >= 5 && petSkills.tier5 && hasOwn(PET_SKILLS_BY_ID, petSkills.tier5)) ? PET_SKILLS_BY_ID[petSkills.tier5] : null;
          const feedTip = feedCost
            ? `${feedCost.tierLabel} · 升至 Lv.${feedCost.nextLevel}|所需灵材：${feedCostOwned}${feedCost.nextLevel === 3 ? "｜升至 Lv.3 解锁【化形灵技】三选一！" : feedCost.nextLevel === 5 ? "｜升至 Lv.5 解锁【化境神通】三选一！" : ""}`
            : "灵兽已臻化境 Lv.5|已解锁全部 Lv.3/Lv.5 血脉灵技槽位";
          const petMissChips = (petPreview.missingMats || []).map(m =>
            `<button type="button" class="mat-source-chip" data-mat-source="${escapeHtml(m.id)}" data-source-origin='[data-action="feed-pet"]'>📍 缺${escapeHtml(m.name)}×${m.lack} 来源</button>`
          ).join("");
          return `
        <details class="drawer-collapse-group" data-cultivate-group="advanced" ${cultivateGroupOpen.advanced ? "open" : ""}>
          <summary>
            <span>${renderSemanticTag("side", "进阶神通")} 灵宠 · 魂印 · 剑匣 · 灵骑</span>
            <span style="font-size:var(--fs-xs);color:var(--text-sub);font-family:var(--font-sans);">${game.pet.id ? `灵兽 Lv.${petLv}` : "待契灵兽"}</span>
          </summary>
          <div class="drawer-group-body">
            <div class="jade-card" style="gap:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
                <strong style="font-size:var(--fs-sm);color:var(--gold-bright);">🐾 随行本命灵兽（${game.pet.id ? `Lv.${petLv}/5` : "炼气期契约"}）</strong>
                ${game.pet.id ? `<button type="button" class="${canFeedNow ? "btn-primary btn-gold" : "btn-secondary btn-jade is-locked"}" style="padding:3px 9px;font-size:var(--fs-xs);white-space:nowrap;" data-action="feed-pet" data-reminder-tier="${canFeedNow ? "2" : "3"}" data-tip="${escTip(feedTip.split("|")[0], feedTip.split("|")[1] || "")}">${petLv >= 5 ? "已满阶 Lv.5" : `喂养升 Lv.${feedCost.nextLevel} (${feedCostCompact})`}</button>` : ""}
              </div>
              ${game.pet.id && feedCost ? `
                <div class="upgrade-preview-strip" data-upgrade-preview="pet_feed">
                  <span>消耗：<b>${escapeHtml(petPreview.costText)}</b></span>
                  <span>收益：<b>${escapeHtml(petPreview.deltaText)}</b></span>
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:5px;flex-wrap:wrap;">
                    <span style="color:${canFeedNow ? "#70ffe6" : "#ffd8a8"};">${canFeedNow ? "灵材齐备 ✓" : "缺少灵材可点右侧来源"}</span>
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">${petMissChips}</div>
                  </div>
                </div>
              ` : ""}
              <div class="grid-2">
                ${Object.values(SPIRIT_PETS).map(sp => `
                  <button class="visual-tile ${game.pet.id === sp.id ? "equipped" : ""}" data-pet="${sp.id}" data-tip="${escTip(sp.name, sp.desc)}">
                    <img src="${ART[sp.art]}" alt="${sp.name}" />
                    <div><div style="font-size:var(--fs-sm);font-weight:700;">${sp.name}</div><span class="tag-chip">${sp.skill}</span></div>
                  </button>
                `).join("")}
              </div>
              ${game.pet.id ? `
                <div class="pet-skill-row">
                  <span style="font-size:var(--fs-xs);color:var(--text-sub);">化形灵技：</span>
                  ${sk3
                    ? `<span class="tag-chip done" data-tip="${escTip("Lv.3 化形灵技 · " + sk3.name, sk3.desc)}">Lv.3 ${escapeHtml(sk3.name)}</span>`
                    : petLv >= 3
                      ? `<button type="button" class="btn-primary btn-gold" style="padding:2px 8px;font-size:var(--fs-xs);" data-open-pet-skill-tier="3">✨ 择 Lv.3 技能</button>`
                      : `<span class="tag-chip is-locked">🔒 Lv.3 解锁化形灵技</span>`}
                  ${sk5
                    ? `<span class="tag-chip mythic" data-tip="${escTip("Lv.5 化境神通 · " + sk5.name, sk5.desc)}">Lv.5 ${escapeHtml(sk5.name)}</span>`
                    : petLv >= 5
                      ? `<button type="button" class="btn-primary btn-gold" style="padding:2px 8px;font-size:var(--fs-xs);" data-open-pet-skill-tier="5">✨ 择 Lv.5 技能</button>`
                      : `<span class="tag-chip is-locked">🔒 Lv.5 解锁化境神通</span>`}
                </div>
              ` : ""}
            </div>

            ${showFoundTier ? `
            <!-- V19 Taixu Demon-Quelling Soul Seal Selector (Foundation+) -->
            <div class="jade-card" style="gap:7px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                <div style="display:flex;align-items:center;gap:7px;">
                  <img src="${ART.spirit_seal_emblem}" alt="太虚镇妖魂印" style="width:34px;height:34px;object-fit:contain;" />
                  <div>
                    <strong style="font-size:var(--fs-md);color:var(--gold-bright);">👹 太虚镇妖魂印 · 精魄化身技 (C键)</strong>
                    <div style="font-size:var(--fs-xs);color:var(--jade);">无缝取消后摇硬直 (Soul-Cancel) · 触发水火雷冰聚变</div>
                  </div>
                </div>
                ${showGoldTier ? `<button type="button" class="btn-primary btn-gold" style="padding:4px 10px;font-size:var(--fs-xs);white-space:nowrap;" data-action="open-star-chart">🌟 周天星图(${(game.litStars || []).length}/28)</button>` : ""}
              </div>
              <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;">
                ${Object.values(SOUL_SPIRITS).map(sp => {
                  const unlocked = (game.unlockedSouls || []).includes(sp.id);
                  const eq = game.equippedSoul === sp.id;
                  return `<button type="button" class="visual-tile ${eq ? "equipped" : ""} ${unlocked ? "" : "is-locked"}" style="flex-direction:column;text-align:center;padding:6px 4px;" data-equip-soul="${sp.id}" data-tip="${escTip(sp.name, unlocked ? sp.desc : "击败对应秘境首领或点此耗80灵石直接炼化精魄！")}">
                    <img src="${ART[sp.art]}" alt="${sp.shortLbl}" style="width:30px;height:30px;border-radius:50%;" />
                    <strong style="font-size:var(--fs-xs);color:${eq ? "#ffe89e" : "#dff7f2"};">${sp.shortLbl}</strong>
                    <span style="font-size:10px;color:${unlocked ? "var(--jade)" : "#ffbe76"};">${eq ? "已佩" : unlocked ? "切换" : "80石炼化"}</span>
                  </button>`;
                }).join("")}
              </div>
            </div>

            <!-- V20 Taixu Sword-Box Arsenal Trio (Foundation+) -->
            <div class="jade-card" style="gap:7px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <img src="${ART.weapon_arsenal_trio}" alt="太虚剑匣" style="width:36px;height:36px;object-fit:contain;" />
                  <div>
                    <strong style="font-size:var(--fs-md);color:var(--gold-bright);">⚔ 太虚剑匣 · 三器形态演化 (数字键 1/2/3)</strong>
                    <div style="font-size:var(--fs-xs);color:var(--jade);">与【青莲疾剑/玄重巨阙】双姿态自由正交组合</div>
                  </div>
                </div>
                <button type="button" class="btn-tertiary btn-ghost" style="padding:3px 9px;font-size:var(--fs-xs);" data-action="trigger-tag-switch">🤝 V键换人(${getActivePlayableSpec().name})</button>
              </div>
              <div class="arsenal-trio-grid">
                ${Object.values(WEAPON_ARSENAL_SPECS).map(wf => {
                  const eq = (game.weaponForm || "sword") === wf.id;
                  return `<button type="button" class="arsenal-card-btn ${eq ? "active" : ""}" data-weapon-form="${wf.id}" data-tip="${escTip(wf.name, wf.desc)}">
                    <strong style="font-size:var(--fs-sm);color:${eq ? "#80ffea" : "#ffe89e"};">${wf.short} · ${wf.name.slice(2)}</strong>
                    <span style="font-size:var(--fs-xs);color:#b8dcd5;">${wf.badge}</span>
                  </button>`;
                }).join("")}
              </div>
            </div>` : ""}

            ${showGoldTier ? `
            <!-- V24 Custom 4-Step Combo Sequencer (Golden+) -->
            <div class="jade-card" style="border-color:rgba(255,222,128,0.62);gap:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <img src="${ART.clone_yuqing_cyan}" alt="太虚创招谱" style="width:36px;height:36px;object-fit:contain;" />
                  <img src="${ART.scroll_shanhe_sheji}" alt="太虚秘匣" style="width:36px;height:36px;object-fit:contain;" />
                  <div>
                    <strong style="font-size:var(--fs-md);color:var(--gold-bright);">🎼 太虚创招谱 · 四段三器混编 (7键)</strong>
                    <div style="font-size:var(--fs-xs);color:var(--jade);">金丹期启 7 剑谱 / J 灵骑 / U 奇门阵（4/O 元婴启 · 5/6 化神启）</div>
                  </div>
                </div>
                <button type="button" class="btn-primary btn-gold" style="padding:4px 10px;font-size:var(--fs-xs);white-space:nowrap;" data-action="open-sequencer">🎼 编排四段剑谱</button>
              </div>
            </div>

            <!-- V22 Mythic Mount Selector (Golden+) -->
            <div class="jade-card" style="gap:7px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <img src="${ART.mount_ink_qilin}" alt="山海灵骑" style="width:36px;height:36px;object-fit:contain;" />
                  <div>
                    <strong style="font-size:var(--fs-md);color:var(--gold-bright);">🐎 山海灵骑 · 太古神兽骑战 (J键冲锋)</strong>
                    <div style="font-size:var(--fs-xs);color:var(--jade);">配合 U 键奇门八门阵纵横九州（元婴启 4 三清/O 法天 · 化神启 5 社稷/6 仙舟）</div>
                  </div>
                </div>
                ${isEcosystemSystemUnlocked(game, "seed_workshop") ? `<button type="button" class="btn-primary btn-gold" style="padding:3px 9px;font-size:var(--fs-xs);white-space:nowrap;" data-action="open-workshop">🛠 造化论剑码</button>` : ""}
              </div>
              <div class="arsenal-trio-grid">
                ${Object.values(MYTHIC_MOUNTS).map(m => {
                  const eq = (game.equippedMount || "qilin") === m.id;
                  return `<button type="button" class="arsenal-card-btn ${eq ? "active" : ""}" data-equip-mount="${m.id}" data-tip="${escTip(m.name, m.desc)}">
                    <div style="display:flex;align-items:center;gap:5px;">
                      <img src="${ART[m.art]}" alt="${m.name}" style="width:24px;height:24px;object-fit:contain;" />
                      <strong style="font-size:var(--fs-sm);color:${eq ? "#80ffea" : "#ffe89e"};">${m.name}</strong>
                    </div>
                    <span style="font-size:var(--fs-xs);color:#b8dcd5;">${m.badge}</span>
                  </button>`;
                }).join("")}
              </div>
            </div>` : ""}
          </div>
        </details>`;
        })() : ""}

        <!-- F16 Group 3: Collection & Cosmetics (collapsed by default) -->
        <details class="drawer-collapse-group" data-cultivate-group="collection" ${cultivateGroupOpen.collection ? "open" : ""}>
          <summary>
            <span>${renderSemanticTag("system", "收藏与外观")} 道果 · 万剑衣橱 · 阶梯预告</span>
            <span style="font-size:var(--fs-xs);color:var(--text-sub);font-family:var(--font-sans);">道果 ×${(game.destinyFruits || []).length}${showWardrobe ? " · 万剑衣橱" : ""}</span>
          </summary>
          <div class="drawer-group-body">
            ${(game.destinyFruits && game.destinyFruits.length > 0) ? `
              <div class="jade-card">
                <strong style="font-size:var(--fs-sm);color:#f3d9ff;">☯ 已觉醒【逆天改命】先天道果（渡劫破境获取）</strong>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  ${game.destinyFruits.map(fid => {
                    const df = hasOwn(DESTINY_FRUITS, fid) ? DESTINY_FRUITS[fid] : null;
                    return df ? `<span class="destiny-fruit-pill" data-tip="${escTip(df.name, df.desc)}">★ ${df.name} · ${df.badge}</span>` : "";
                  }).join("")}
                </div>
              </div>
            ` : ""}

            ${showWardrobe ? `
            <!-- V18 Myriad-Sword Wardrobe (Foundation+ or NG+) -->
            <div class="jade-card">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-size:var(--fs-md);color:var(--gold-bright);">✨ 万剑衣橱 · 法相幻化台</strong>
                <span class="tag-chip mythic">${getKarmaState(game).artName}</span>
              </div>
              <div style="display:flex;gap:10px;align-items:center;">
                <canvas id="wardrobe-preview-canvas" width="132" height="118" style="border-radius:10px;border:1px solid rgba(216,179,106,0.38);flex-shrink:0;"></canvas>
                <div style="display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;">
                  <div>
                    <div style="font-size:var(--fs-xs);color:var(--text-sub);margin-bottom:3px;">飞剑器型：</div>
                    <div class="wardrobe-pill-row">
                      ${WARDROBE_OPTIONS.bladeSkin.map(o => `<button type="button" class="wardrobe-opt-btn ${(game.cosmetics && game.cosmetics.bladeSkin) === o.id ? "active" : ""}" data-cos-cat="bladeSkin" data-cos-val="${o.id}" data-tip="${escTip(o.name, o.desc)}">${o.name}</button>`).join("")}
                    </div>
                  </div>
                  <div>
                    <div style="font-size:var(--fs-xs);color:var(--text-sub);margin-bottom:3px;">刀光与飞剑拖尾：</div>
                    <div class="wardrobe-pill-row">
                      ${WARDROBE_OPTIONS.trailSkin.map(o => `<button type="button" class="wardrobe-opt-btn ${(game.cosmetics && game.cosmetics.trailSkin) === o.id ? "active" : ""}" data-cos-cat="trailSkin" data-cos-val="${o.id}" data-tip="${escTip(o.name, o.desc)}">${o.name}</button>`).join("")}
                    </div>
                  </div>
                  <div>
                    <div style="font-size:var(--fs-xs);color:var(--text-sub);margin-bottom:3px;">足底法相光环：</div>
                    <div class="wardrobe-pill-row">
                      ${WARDROBE_OPTIONS.footAura.map(o => `<button type="button" class="wardrobe-opt-btn ${(game.cosmetics && game.cosmetics.footAura) === o.id ? "active" : ""}" data-cos-cat="footAura" data-cos-val="${o.id}" data-tip="${escTip(o.name, o.desc)}">${o.name}</button>`).join("")}
                    </div>
                  </div>
                  <div>
                    <div style="font-size:var(--fs-xs);color:#ffe28a;margin-bottom:3px;">外显剑意幻化（轮回专属）：</div>
                    <div class="wardrobe-pill-row">
                      ${WARDROBE_OPTIONS.swordAura.map(o => {
                        const ok = isSwordAuraUnlocked(o);
                        const eq = ((game.cosmetics && game.cosmetics.swordAura) || "azure_jade") === o.id;
                        return `<button type="button" class="wardrobe-opt-btn ${eq ? "active" : ""} ${ok ? "" : "is-locked"}" data-cos-cat="swordAura" data-cos-val="${o.id}" data-tip="${escTip(o.name + " · " + o.unlockText, o.desc)}" ${!ok ? "disabled" : ""}>${ok ? "" : "🔒"}${o.name}</button>`;
                      }).join("")}
                    </div>
                  </div>
                </div>
              </div>
            </div>` : ""}

            ${!showSpiritTier ? `
            <div class="jade-card is-locked" style="flex-direction:row;align-items:center;justify-content:space-between;gap:8px;">
              <div style="font-size:var(--fs-xs);color:var(--text-sub);line-height:1.45;">
                <strong style="color:var(--gold-bright);">🔒 高阶传承随境分批解封</strong><br/>
                ${!showQiTier
                  ? "炼气启【灵宠·三才剑阵·丹剑·锁妖塔】 · 筑基启【魂印·剑匣·护山战】 · 金丹启【云海空战·星图·灵骑/奇门/剑谱】"
                  : !showFoundTier
                    ? "筑基启【双姿态·镇妖魂印·剑匣三器·护山战】 · 金丹启【云海空战·星图·山海灵骑·奇门·剑谱】"
                    : !showGoldTier
                      ? "金丹启【云海空战·周天星图(N)·山海灵骑(J)·奇门阵(U)·剑谱(7)】 · 元婴启【一气三清(4)·法天象地(O)·远征/登仙台/万剑冢】"
                      : !showNascentTier
                        ? "元婴启【一气三清(4)·法天象地(O)·九州远征(8)·登仙台(L)·万剑冢七阵】 · 化神启【山河社稷图(5)·凌霄仙舟(6)·劫印/工坊】"
                        : "化神启【山河社稷图(5)·凌霄仙舟(6)·天道劫印契约·造化种子工坊】，直指九霄天门飞升！"}
              </div>
              <button type="button" class="btn-tertiary btn-ghost" style="padding:4px 10px;font-size:var(--fs-xs);white-space:nowrap;" data-action="open-ascension-roadmap">问道阶梯</button>
            </div>` : ""}
          </div>
        </details>
      `;
    } else if (currentTab === "story") {
      const avail = getAvailableCompanionStories(game);
      const nextLocked = STORIES.find(s => !game.choices[s.id] && (!s.requires || !!game.choices[s.requires]) && rankOf(game.realm) < rankOf(s.min));
      const kProg = getKarmaDilemmaProgress(game);
      const karmaBtnCls = kProg.eligibleCount > 0 ? "btn-gold" : "btn-ghost";
      const karmaBtnTxt = kProg.eligibleCount > 0
        ? `☯ 红尘问心 (${kProg.doneCount}/${kProg.totalCount})`
        : kProg.chapterExhausted
          ? `☯ 本卷因果已了 (第${kProg.nextChapterUnlock}卷新劫)`
          : `☯ 因果已尽 (${kProg.doneCount}/${kProg.totalCount})`;
      body.innerHTML = `
        ${muralHeader("banner_karma_duality", "正魔因果 · 红尘三阶羁绊", `${getKarmaState(game).label} · 合击 ×${countBondedAllies(game)}`)}
        <div class="jade-card" style="gap:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div>
              <strong style="font-size:12.5px;color:${getKarmaState(game).color};">☯ 道心谱系：【${escapeHtml(getKarmaState(game).artName)}】</strong>
              <div style="font-size:10.5px;color:var(--text-sub);">${getKarmaState(game).mode === "demonic" ? "常驻剑威 +18%，气血 >28% 时攻击燃血狂斩再享 +22% 剑威，斩妖/碎核噬血归元" : getKarmaState(game).mode === "righteous" ? "常驻剑威 +6%、常驻减伤 +12，周期凝结太清净世莲盾，仙葫震退群妖" : "抉择红尘奇遇偏向±25即可觉醒正宗仙法或燃血魔功！"}</div>
            </div>
            <button type="button" class="${karmaBtnCls}" style="padding:5px 11px;font-size:11px;white-space:nowrap;" data-action="open-karma-dilemma">${escapeHtml(karmaBtnTxt)}</button>
          </div>
          <div class="karma-spectrum-track"><div class="karma-spectrum-dot" style="left:${Math.round(((getKarmaState(game).score + 100) / 200) * 100)}%;"></div></div>
        </div>

        <div style="display:flex;flex-direction:column;gap:7px;">
          ${Object.values(NPC_META).map(npc => {
            const tier = getCompanionBondTier(game, npc.id);
            const kp = COMPANION_KEEPSAKES[npc.id];
            const quote = getCompanionDynamicGreeting(game, npc.id);
            return `
              <div class="visual-tile ${tier >= 3 ? "rarity-4" : tier >= 1 ? "equipped" : ""}" style="flex-direction:column;align-items:stretch;gap:5px;padding:8px 10px;">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                    <img src="${ART[npc.art]}" alt="${escapeHtml(npc.name)}" style="width:38px;height:38px;border-radius:50%;flex-shrink:0;" />
                    <div style="min-width:0;">
                      <div style="font-size:12.5px;font-weight:700;color:var(--gold-bright);">${escapeHtml(npc.name)} <span class="tag-chip ${tier >= 3 ? "mythic" : "done"}">${escapeHtml(kp.tierTitles[tier])}</span></div>
                      <div style="font-size:10px;color:var(--text-sub);">${escapeHtml(npc.role)}</div>
                      <div style="font-size:10.5px;color:#80ffea;">三阶信物【${escapeHtml(kp.keepsake)}】：${escapeHtml(kp.bonusDesc)}</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:4px;flex-shrink:0;">
                    <button type="button" class="btn-gold" style="padding:4px 8px;font-size:10.5px;white-space:nowrap;" data-open-comp-modal="${escapeHtml(npc.id)}">🍵 雅集叙话</button>
                    ${tier < 3
                      ? `<button type="button" class="btn-jade" style="padding:4px 8px;font-size:10.5px;white-space:nowrap;" data-gift-npc="${escapeHtml(npc.id)}">🎁 晋阶</button>`
                      : `<span class="tag-chip mythic">★ 信物</span>`}
                  </div>
                </div>
                <div style="font-size:10.5px;color:var(--text-sub);font-style:italic;">『${escapeHtml(quote)}』</div>
              </div>`;
          }).join("")}
        </div>
        ${avail.length > 0 ? avail.map(stItem => `
          <div class="jade-card" data-story-card="${escapeHtml(stItem.id)}">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;">
                <strong style="color:var(--gold-bright);">${escapeHtml(NPC_META[stItem.npc].name)} · 《${escapeHtml(stItem.name)}》</strong>
                <span class="tag-chip">第${stItem.chapter}卷 · 📍${escapeHtml(getStoryLocationLabel(stItem.location))}</span>
                ${game.location === stItem.location ? `<span class="tag-chip done">同处此境</span>` : ""}
              </div>
              <button type="button" class="btn-gold" style="padding:3px 10px;font-size:10.5px;white-space:nowrap;" data-play-story-bar="${escapeHtml(stItem.id)}">🎭 立绘演绎 ▸</button>
            </div>
            <p style="font-size:11.5px;color:var(--text-sub);line-height:1.45;">${escapeHtml(stItem.body)}</p>
            ${stItem.options.map(o => `
              <button class="visual-tile" style="flex-direction:column;align-items:flex-start;gap:3px;" data-story-id="${escapeHtml(stItem.id)}" data-opt-id="${escapeHtml(o.id)}">
                <div style="width:100%;display:flex;justify-content:space-between;align-items:center;">
                  <span style="font-size:12px;font-weight:700;color:var(--text-main);">${escapeHtml(o.label)}</span>
                  <span class="tag-chip done">抉择</span>
                </div>
                <span style="font-size:10.5px;color:var(--gold);">${escapeHtml(o.detail)}</span>
              </button>`).join("")}
          </div>
        `).join("") : `
          <div class="jade-card" style="text-align:center;color:var(--text-sub);padding:16px;">
            ${nextLocked ? `晋升至【${escapeHtml(REALMS[nextLocked.min].name)}】后解锁第${nextLocked.chapter}卷 · 📍${escapeHtml(getStoryLocationLabel(nextLocked.location))} 《${escapeHtml(nextLocked.name)}》（${escapeHtml(NPC_META[nextLocked.npc].name)}）` : "本世故人机缘皆已圆满缔结！"}
          </div>
        `}
      `;
    } else if (currentTab === "explore") {
      const towerUnlocked = isEcosystemSystemUnlocked(game, "demon_tower");
      const expOk = isEcosystemSystemUnlocked(game, "vein_expedition");
      const expSpec = getEcosystemSystemSpec("vein_expedition");
      const expMinName = (expSpec && REALMS[expSpec.min]) ? REALMS[expSpec.min].name : "元婴";
      const nextM = findNextMainlineStep(game);
      const activeStageRoute = (nextM && nextM.step && nextM.step.route && nextM.step.route.startsWith("stage_"))
        ? Number(nextM.step.route.split("_")[1])
        : -1;
      const upcomingCards = [];
      if (!towerUnlocked) {
        upcomingCards.push(`
          <div class="jade-card is-locked" style="align-items:center;text-align:center;">
            <strong style="font-size:var(--fs-md);color:var(--c-locked);font-family:var(--font-serif);">🔒 太虚锁妖内坛（炼气期解封）</strong>
            <button type="button" class="btn-tertiary btn-ghost is-locked" data-action="challenge-tower" disabled>${SVG.sword} 炼气期开启</button>
          </div>
        `);
      }
      if (!expOk) {
        upcomingCards.push(`
          <div class="jade-card is-locked" style="flex-direction:row;align-items:center;justify-content:space-between;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${ART.warship_lingxiao_ark}" alt="凌霄仙舟" style="width:36px;height:36px;object-fit:contain;" />
              <div>
                <strong style="font-size:var(--fs-md);color:var(--c-locked);font-family:var(--font-serif);">🔒 仙门远征 · 九州灵脉沙盘 (${expMinName}期解封)</strong>
                <div style="font-size:var(--fs-xs);color:var(--text-sub);">委派已结缘道侣驻守灵脉产出星魄灵石</div>
              </div>
            </div>
            <button type="button" class="btn-tertiary btn-ghost eco-locked-btn is-locked" style="padding:5px 10px;font-size:var(--fs-xs);white-space:nowrap;" data-action="open-expedition" data-eco-lock-tag="🔒${expMinName}">🔒 灵脉沙盘</button>
          </div>
        `);
      }

      body.innerHTML = `
        ${muralHeader("scene_secret", "山海历练", "当前主线优先 · 九州道场与试炼")}

        <!-- F16 Pinned Top Card: Current Mainline Progression -->
        <div id="explore-mainline-pin" class="jade-card" style="border-color:var(--c-main);gap:7px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:6px;">
              ${renderSemanticTag("main", "当前主线推进")}
              <strong style="font-family:var(--font-serif);font-size:var(--fs-lg);color:var(--gold-bright);">${nextM && nextM.ch ? `${escapeHtml(nextM.ch.vol)} · ${escapeHtml(nextM.ch.title)}` : "九州仙途"}</strong>
            </div>
            ${nextM && nextM.allDone ? `<span class="tag-chip done">全部圆满</span>` : `<span class="tag-chip">${nextM && nextM.claimReady ? "可领赏" : "推进中"}</span>`}
          </div>
          ${nextM && nextM.allDone ? `
            <div style="font-size:var(--fs-sm);color:var(--text-sub);">全部主线道标已圆满，可挑战劫火周目或刷新镇妖古塔纪录。</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="btn-primary btn-gold" style="padding:4px 11px;font-size:var(--fs-xs);" data-route-goal="calamity_ng">🔥 劫火周目 ▸</button>
              <button type="button" class="btn-secondary btn-jade" style="padding:4px 11px;font-size:var(--fs-xs);" data-route-goal="tower">🗼 锁妖塔 ▸</button>
            </div>
          ` : nextM && nextM.step ? `
            <div style="font-size:var(--fs-sm);color:var(--text-main);font-weight:700;">${escapeHtml(nextM.step.text)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-size:var(--fs-xs);color:var(--gold);">赏赐：${escapeHtml(nextM.step.rewardTxt)}</span>
              ${nextM.claimReady
                ? `<button type="button" class="btn-primary btn-gold" style="padding:4px 12px;font-size:var(--fs-xs);" data-claim-step="${escapeHtml(nextM.step.id)}">领取道赏 ▸</button>`
                : `<button type="button" class="btn-primary btn-gold" style="padding:4px 12px;font-size:var(--fs-xs);" data-route-goal="${escapeHtml(nextM.step.route)}">前往推进 ▸</button>`}
            </div>
          ` : ""}
        </div>

        <div class="jade-card" style="flex-direction:row;align-items:center;justify-content:space-between;gap:8px;">
          <div>
            <strong style="font-size:var(--fs-lg);color:var(--gold-bright);font-family:var(--font-serif);">🗺 千里江山 · 九州舆图 (M)</strong>
            <div style="font-size:var(--fs-xs);color:var(--text-sub);">预览各州条件产出后出征，或按 H 返听雨洞府</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn-primary btn-gold" data-action="open-world-map">展开舆图</button>
            <button class="btn-secondary btn-jade" data-action="enter-sanctum">${arena.sanctumMode ? "已在洞府" : "洞府(H)"}</button>
          </div>
        </div>

        <div class="grid-2">
          ${STAGES.map((s, idx) => {
            const ok = rankOf(game.realm) >= rankOf(s.min);
            const active = !arena.sanctumMode && ((!arena.towerMode && arena.stageIdx === idx) || (arena.towerMode && idx === 3));
            const isMainStg = idx === activeStageRoute;
            const act = CAMPAIGN_ACTS[idx];
            return `
              <button class="visual-tile ${active ? "equipped" : ""} ${ok ? "" : "is-locked"}" data-warp-stage="${idx}" ${!ok ? "disabled" : ""} data-tip="${escTip(`${act.actLabel} · ${s.name}`, `首领：${s.bossName} · 产出：${s.dropPreview}`)}">
                <img src="${ART[s.arenaArt]}" alt="${s.name}" style="object-fit:cover;" />
                <div>
                  <div style="font-size:var(--fs-sm);font-weight:700;">${act.actLabel}·${act.mapName.replace(/^⚡\s*/, "")}</div>
                  <div style="font-size:var(--fs-xs);color:#9ed4cb;">${s.bossName} · ${s.dropPreview.split(" · ").slice(0, 2).join("/")}</div>
                  <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:2px;">
                    ${isMainStg ? renderSemanticTag("main", "主线目标") : ""}
                    <span class="tag-chip ${ok ? (active ? "done" : "") : "is-locked"}">${ok ? (active ? "当前征战" : "可出征") : `${REALMS[s.min].name}解锁`}</span>
                  </div>
                </div>
              </button>`;
          }).join("")}
        </div>

        ${towerUnlocked ? (() => {
          const bestT = Math.max(Math.floor(num(game.towerBest, 0)), Math.floor(num(metaState.bestTower, 0)));
          const tGrade = bestT >= 1 ? ` · ${computeModeGrade("demon_tower", { floor: bestT })} 级` : "";
          return `
        <div class="jade-card is-side" style="align-items:center;text-align:center;">
          <strong style="font-size:var(--fs-lg);color:var(--gold-bright);font-family:var(--font-serif);">● 太虚锁妖内坛 · 第 ${Math.max(1, Math.floor(num(game.towerFloor, 1)))} 层（最高 ${bestT} 层${tGrade}）</strong>
          <div style="display:flex;gap:8px;">
            <button class="btn-primary btn-gold" data-action="challenge-tower">${SVG.sword} 立即入坛破阵</button>
            ${arena.towerMode ? `<button class="btn-tertiary btn-ghost" data-warp-stage="0">退出锁妖塔</button>` : ""}
          </div>
        </div>`;
        })() : ""}

        ${expOk ? `
        <div class="jade-card is-side" style="flex-direction:row;align-items:center;justify-content:space-between;gap:8px;border-color:rgba(128,255,234,0.58);">
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${ART.warship_lingxiao_ark}" alt="凌霄仙舟" style="width:40px;height:40px;object-fit:contain;" />
            <div>
              <strong style="font-size:var(--fs-md);color:var(--gold-bright);font-family:var(--font-serif);">⛵ 仙门远征 · 九州灵脉驻防沙盘 (8键)</strong>
              <div style="font-size:var(--fs-xs);color:var(--jade);">委派已结缘道侣驻守灵脉产出星魄灵石，战中享跨区护道雷援</div>
            </div>
          </div>
          <button type="button" class="btn-primary btn-gold" style="padding:5px 11px;font-size:var(--fs-xs);white-space:nowrap;" data-action="open-expedition">⛵ 灵脉沙盘</button>
        </div>` : ""}

        <div class="jade-card" style="gap:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:var(--fs-sm);color:var(--gold-bright);">📦 灵材产出闭环 · 宗门悬赏</strong>
            <span style="font-size:var(--fs-xs);color:var(--jade);">秘境实打掉落全七阶灵材</span>
          </div>
          <div style="font-size:var(--fs-xs);color:var(--text-sub);line-height:1.45;">
            第一卷产<b>凝气草/灵露</b> · 第二卷产<b>妖核/灵露</b> · 第三卷产<b>地脉灵玉</b> · 第四卷产<b>月华莲</b> · 第五至六卷产<b>凝魂晶/道蕴砂</b>。
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button type="button" class="btn-secondary btn-jade" style="padding:5px 10px;font-size:var(--fs-xs);" data-action="open-bounties">📜 宗门悬赏令 (T)</button>
            ${expOk ? `<button type="button" class="btn-primary btn-gold" style="padding:5px 10px;font-size:var(--fs-xs);" data-action="open-expedition-sandbox">⛵ 灵脉远征 (8)</button>` : ""}
          </div>
        </div>

        ${upcomingCards.length > 0 ? `
        <details class="drawer-collapse-group" data-explore-group="upcoming">
          <summary>
            <span>${renderSemanticTag("side", "后续境界解封预告")} 未解封试炼 (${upcomingCards.length})</span>
            <span style="font-size:var(--fs-xs);color:var(--text-sub);font-family:var(--font-sans);">点击展开</span>
          </summary>
          <div class="drawer-group-body">
            ${upcomingCards.join("")}
          </div>
        </details>` : ""}
      `;
    } else if (currentTab === "alchemy") {
      const curRank = rankOf(game.realm);
      const fullOpen = Boolean(sandboxMode || game.unlockAllArcana);
      const showQiCraft = fullOpen || curRank >= 1;
      const fairDisc = currentOmen(game).id === "fair" ? 0.8 : 1.0;
      const jadeCost = Math.round(60 * fairDisc);
      const allLawsDone = isAllDaoLawsCollected(game);
      const permCaps = getPermGrowthCaps(game);
      const pg = ensurePermGrowth(game);
      const coreCount = Math.max(0, Math.floor(num(game.inventory && game.inventory.core, 0)));
      if (coreCount <= 0 && temperUseCoreDiscount) temperUseCoreDiscount = false;
      const alchMatSourceHtml = (activeMatSourceJump && !activeMatSourceJump.inModal && activeMatSourceJump.tab === "alchemy")
        ? renderMatSourceInlinePanel(activeMatSourceJump, false)
        : "";
      body.innerHTML = `
        ${muralHeader("banner_alchemy", "紫微丹器百工台", "稳炼成丹 · 显式批量 · 本命法宝")}
        ${alchMatSourceHtml}
        <div class="jade-card" style="border-color:rgba(255,218,120,0.62);gap:7px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${ART.furnace_taixu_alchemy}" alt="八卦丹炉" style="width:36px;height:36px;object-fit:contain;" />
              <img src="${ART.anvil_tiangong_forge}" alt="天工剑炉" style="width:36px;height:36px;object-fit:contain;" />
              <div>
                <strong style="font-family:var(--font-serif);font-size:var(--fs-md);color:var(--gold-bright);">🔥 统一百工炉鼎 · 控火冲九转仙品 & 星火锻剑</strong>
                <div style="font-size:var(--fs-xs);color:var(--jade);">下方丹方支持【稳炼(×1)】、【批量(×1/×3/×5)】或开启【八卦控火】冲九转极品！</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn-primary btn-gold" style="padding:5px 10px;font-size:var(--fs-xs);" data-craft-open="alchemy">🔥 八卦炼丹</button>
              <button type="button" class="btn-secondary btn-jade" style="padding:5px 10px;font-size:var(--fs-xs);" data-craft-open="forge">🔨 星火锻剑</button>
            </div>
          </div>
          <div id="alchemy-perm-cap-row" style="display:flex;gap:6px;flex-wrap:wrap;padding-top:5px;border-top:1px solid rgba(132,208,194,0.18);font-size:var(--fs-xs);">
            <span class="tag-chip ${pg.alchemyHp >= permCaps.alchemyHp ? "done" : ""}">丹道气血 ${pg.alchemyHp}/${permCaps.alchemyHp}${pg.alchemyHp >= permCaps.alchemyHp ? " (已达上限)" : ""}</span>
            <span class="tag-chip ${pg.alchemyAtk >= permCaps.alchemyAtk ? "done" : ""}">百工剑攻 ${pg.alchemyAtk}/${permCaps.alchemyAtk}${pg.alchemyAtk >= permCaps.alchemyAtk ? " (已达上限)" : ""}</span>
            <span class="tag-chip ${(game.maxHpBonus >= permCaps.maxHpBonus && game.atkFlatBonus >= permCaps.atkFlatBonus) ? "done" : ""}">本境总加成 血${Math.floor(num(game.maxHpBonus, 0))}/${permCaps.maxHpBonus} · 攻${Math.floor(num(game.atkFlatBonus, 0))}/${permCaps.atkFlatBonus}</span>
          </div>
        </div>

        <div class="jade-card" style="gap:7px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="display:flex;align-items:center;gap:9px;">
              <img src="${ART.item_immortal_gourd}" alt="本命九转仙葫" style="width:40px;height:44px;object-fit:contain;" />
              <div>
                <strong style="font-family:var(--font-serif);font-size:var(--fs-md);color:var(--gold-bright);">🍶 本命九转仙葫（灵酿 ${Math.max(0, Math.floor(num(game.gourd.charges, 0)))}/${Math.max(1, Math.floor(num(game.gourd.maxCharges, 5)))} · 已镶 ${game.gourd.soaks.length}/${getMaxGourdSoaks(game)} 槽）</strong>
                <div style="font-size:var(--fs-xs);color:var(--jade);">紫微丹鼎 Lv.${getSanctumLevel(game, "cauldron")} 可镶 ${getMaxGourdSoaks(game)} 味泡酒物</div>
              </div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0;">
              <button type="button" class="btn-primary btn-gold" style="padding:4px 9px;font-size:var(--fs-xs);white-space:nowrap;" data-action="open-sanctum-upgrade">🏛 建丹鼎</button>
              <button type="button" class="btn-secondary btn-jade" style="padding:4px 9px;font-size:var(--fs-xs);white-space:nowrap;" data-action="refill-gourd-now">满酿仙葫</button>
            </div>
          </div>
          <div class="soak-grid">
            ${Object.values(GOURD_SOAKS).map(sk => {
              const on = game.gourd.soaks.includes(sk.id);
              return `<button type="button" class="soak-chip-btn ${on ? "active" : ""}" data-toggle-soak="${sk.id}" data-tip="${escTip(sk.name, sk.desc)}">
                <div>
                  <div style="font-size:var(--fs-sm);font-weight:700;color:${on ? "#84ffea" : "#ffe89e"};">${on ? "★ " : "○ "}${sk.name}</div>
                  <div style="font-size:var(--fs-xs);color:#a8cdc6;">${sk.badge}</div>
                </div>
                <span class="tag-chip ${on ? "done" : ""}">${on ? "已泡入" : "镶嵌"}</span>
              </button>`;
            }).join("")}
          </div>
        </div>

        <div class="jade-card" style="gap:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong style="font-size:var(--fs-sm);color:var(--gold-bright);">💊 丹方列表（稳炼成丹 / 显式批量 ×1·×3·×5）</strong>
            <span style="font-size:var(--fs-xs);color:var(--text-sub);">缺料明细公开展示，可点「📍来源」查看获取处</span>
          </div>
          <div class="grid-2">
            ${Object.values(RECIPES).map(rec => {
              const out = ITEMS[rec.output];
              const caulLv = getSanctumLevel(game, "cauldron");
              const lockedByCaul = Boolean(rec.reqCauldronLv && caulLv < rec.reqCauldronLv);
              const bd = computeRecipeCostBreakdown(game, rec);
              const ownedCount = Math.max(0, Math.floor(num(game.inventory[rec.output], 0)));
              const craftMonths = Math.max(1, Math.floor(num(rec.months, 3)));
              const lfPrev = previewLifespanImpact(game, craftMonths);
              const matSummary = Object.entries(rec.inputs).map(([k, n]) => `${ITEMS[k] ? ITEMS[k].name : k}×${n}(持${Math.max(0, Math.floor(num(game.inventory[k], 0)))})`).join(" · ");
              const missSummary = bd.missingItems.map(m => `${m.name}×${m.lack}`).join("、");
              const missChips = (!lockedByCaul && bd.missingItems.length > 0)
                ? bd.missingItems.map(m => `<button type="button" class="mat-source-chip" data-mat-source="${escapeHtml(m.id)}" data-source-origin='[data-quick-craft="${escapeHtml(rec.id)}"]'>📍 ${escapeHtml(m.name)}来源</button>`).join("")
                : "";
              return `
                <div class="visual-tile ${lockedByCaul ? "is-locked" : ""}" style="flex-direction:column;align-items:stretch;padding:7px;gap:6px;" data-tip="${escTip(rec.name, lockedByCaul ? `需先在洞府将【紫微丹鼎】升至 Lv.${rec.reqCauldronLv} 解封！` : `${out.desc}｜${lfPrev.summaryText}${lfPrev.warningText ? "（" + lfPrev.warningText + "）" : ""}｜所需：${matSummary}`)}">
                  <div style="display:flex;align-items:center;gap:7px;min-width:0;">
                    <img src="${ART[out.art]}" alt="${escapeHtml(out.name)}" style="width:32px;height:32px;flex-shrink:0;" />
                    <div style="min-width:0;flex:1;">
                      <div style="font-size:var(--fs-sm);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(out.name)} ${ownedCount > 0 ? `(${ownedCount})` : ""}</div>
                      ${lockedByCaul
                        ? `<span class="tag-chip is-locked">丹鼎Lv.${rec.reqCauldronLv}解封</span>`
                        : bd.hasMissing
                          ? `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px;">
                              <span class="tag-chip ${lfPrev.crossesAny ? "mythic" : ""}" style="font-size:10px;">⏳ ${craftMonths}月${lfPrev.crossesAny ? " ⚠" : ""}</span>
                              <span class="tag-chip" style="font-size:10px;">丹火 ${bd.baseStones}石</span>
                              <span class="tag-chip mythic" style="font-size:10px;">购入缺料 ${bd.matBuyCost} 灵石</span>
                              <span class="tag-chip" style="font-size:10px;">共 ${bd.totalStoneCost}石</span>
                            </div>
                            <div style="font-size:10px;color:#ffd8a8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;">缺 ${escapeHtml(missSummary)}</div>`
                          : `<div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:2px;">
                              <span class="tag-chip ${lfPrev.crossesAny ? "mythic" : ""}" style="font-size:10px;">⏳ ${craftMonths}月${lfPrev.crossesAny ? " ⚠" : ""}</span>
                              <span class="tag-chip done" style="font-size:10px;">灵材齐备 · 丹火 ${bd.baseStones}石</span>
                            </div>`}
                      ${(!lockedByCaul && lfPrev.crossesAny) ? `<div style="font-size:10px;color:#ffb4ae;margin-top:2px;">${escapeHtml(lfPrev.warningText)}</div>` : ""}
                    </div>
                  </div>
                  ${missChips ? `<div style="display:flex;gap:4px;flex-wrap:wrap;">${missChips}</div>` : ""}
                  <div style="display:flex;gap:5px;justify-content:flex-end;flex-wrap:wrap;">
                    <button type="button" class="btn-secondary btn-jade ${(lockedByCaul || game.stones < bd.totalStoneCost) ? "is-locked" : ""}" style="padding:4px 8px;font-size:var(--fs-xs);white-space:nowrap;" data-quick-craft="${rec.id}" ${(lockedByCaul || game.stones < bd.totalStoneCost) ? "disabled" : ""}>${lockedByCaul ? "未封" : bd.hasMissing ? "补料稳炼" : "稳炼"}</button>
                    ${!lockedByCaul ? `<button type="button" class="btn-tertiary btn-ghost" style="padding:4px 8px;font-size:var(--fs-xs);white-space:nowrap;" data-open-batch-craft="${rec.id}" data-tip="显式批量炼丹|自选 ×1/×3/×5 份，核对总灵石、灵材与寿元月数后确认炼制">批量…</button>` : ""}
                  </div>
                </div>`;
            }).join("")}
          </div>
        </div>

        ${showQiCraft ? `
        <div class="jade-card">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong style="font-size:var(--fs-sm);color:var(--gold-bright);">本命神兵铸造与升星淬炼（★3/★5 额外+1飞剑）</strong>
            <span style="font-size:var(--fs-xs);color:var(--jade);">妖核 ×${coreCount}</span>
          </div>
          <label class="temper-core-toggle" style="display:inline-flex;align-items:center;gap:6px;font-size:var(--fs-xs);color:${coreCount > 0 ? "var(--jade)" : "var(--text-sub)"};cursor:${coreCount > 0 ? "pointer" : "not-allowed"};">
            <input type="checkbox" id="chk-temper-use-core" data-temper-core-toggle="1" ${temperUseCoreDiscount && coreCount > 0 ? "checked" : ""} ${coreCount <= 0 ? "disabled" : ""} />
            <span>使用妖核抵扣（消耗 1 妖核，减免约 30 灵石 · 持有 ${coreCount}）</span>
          </label>
          <div class="grid-2">
            ${Object.values(RELICS).map(rel => {
              const owned = game.ownedRelics.includes(rel.id);
              const eq = game.loadout.relic === rel.id;
              const rawStars = (game.relicStars && game.relicStars[rel.id] != null) ? game.relicStars[rel.id] : (owned ? 1 : 0);
              const stars = Math.max(0, Math.min(5, Math.floor(num(rawStars, owned ? 1 : 0))));
              const rCost = Math.round(rel.stones * fairDisc);
              const tc = getRelicTemperCost(game, stars, temperUseCoreDiscount);
              const up = owned ? computeUpgradePreview(game, "relic_temper", rel.id, { useCore: temperUseCoreDiscount }) : null;
              return `
                <div class="visual-tile ${eq ? "equipped" : ""}" style="flex-direction:column;align-items:stretch;gap:6px;">
                  <button style="display:flex;align-items:center;gap:8px;text-align:left;" data-relic="${rel.id}" data-tip="${escTip(rel.name + " · " + rel.activeName, `${rel.passive}｜主动：${rel.activeDesc}`)}">
                    <img src="${ART[rel.art]}" alt="${rel.name}" />
                    <div>
                      <div style="font-size:var(--fs-sm);font-weight:700;">${rel.name} ${owned ? `<span style="color:#ffe28a;">${"★".repeat(stars)}</span>` : ""}</div>
                      <span class="tag-chip mythic">${eq ? "已佩本命" : owned ? "点击佩带" : `${rCost}石铸造`}</span>
                    </div>
                  </button>
                  ${owned && up && up.valid ? `
                    <div class="upgrade-preview-strip" data-upgrade-preview="relic_${rel.id}">
                      <span>${escapeHtml(up.costText)} → <b>${escapeHtml(up.deltaText)}</b></span>
                    </div>
                    <button type="button" class="btn-secondary btn-jade ${game.stones < tc.finalStones ? "is-locked" : ""}" style="padding:3px 8px;font-size:var(--fs-xs);" data-temper-relic="${rel.id}" ${game.stones < tc.finalStones ? "disabled" : ""}>${tc.applyCore ? `淬炼升 ★${stars + 1} (${tc.finalStones}石 + 1妖核)` : `淬炼升 ★${stars + 1} (${tc.finalStones}石)`}</button>` : ""}
                </div>`;
            }).join("")}
          </div>
        </div>

        <div class="jade-card" style="flex-direction:row;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${ART.item_rough_jade}" alt="原石" style="width:36px;height:36px;" />
            <div>
              <strong style="color:var(--gold-bright);font-size:var(--fs-md);">一剑切鸿蒙原石</strong>
              <div style="font-size:var(--fs-xs);color:${allLawsDone ? "var(--text-sub)" : "var(--jade)"};">${allLawsDone ? `全部 ${Object.keys(DAO_LAWS).length} 道神通法则已尽数参悟` : "直接抽取三选一神通法则"}</div>
            </div>
          </div>
          <button type="button" class="btn-primary btn-gold ${(allLawsDone || game.stones < jadeCost) ? "is-locked" : ""}" data-action="gamble-jade" ${(allLawsDone || game.stones < jadeCost) ? "disabled" : ""}>${allLawsDone ? "法则已尽数参悟" : `切玉(${jadeCost})`}</button>
        </div>` : `
        <div class="jade-card is-locked" style="font-size:var(--fs-xs);color:var(--text-sub);">
          🔒 <strong style="color:var(--gold-bright);">炼气期解封</strong>：本命法宝铸造升星与鸿蒙切玉法则参悟。
        </div>`}
      `;
    } else {
      // Tab 5: Cloud Market (`云岚百宝坊市` + Karma Exclusive Pavilion / Black Market) + Gear Satchel + Consumable Pills!
      if (!game.marketStock || !game.marketStock.length) refreshMarketStock();
      const ks = getKarmaState(game);
      const fairDisc = (currentOmen(game).id === "fair" ? 0.8 : 1.0) * (ks.mode === "righteous" ? 0.9 : 1.0);
      const karmaSpecials = getKarmaMarketSpecials(game);
      const marketTitle = ks.mode === "righteous"
        ? "☯ 太清仙珍阁（清虚正道享 9 折惠价与延寿珍品）"
        : ks.mode === "demonic"
          ? "🔥 赤渊魔道黑市（血煞神兵与禁丹交易）"
          : "🏮 云岚百宝阁（灵石选购高阶仙装）";
      const owned = Object.values(ITEMS).filter(it => (game.inventory[it.id] || 0) > 0);
      body.innerHTML = `
        ${muralHeader("banner_archive", "云岚百宝", `${ks.label} · 坊市采买 · 仙装行囊`)}

        <div class="karma-market-card ${ks.mode}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
            <strong style="font-size:12px;color:${ks.color};">${ks.mode === "righteous" ? "☯ 太清正道专属特供" : ks.mode === "demonic" ? "🔥 赤渊魔道黑市秘货" : "✦ 因果奇珍特供（正魔±25解封专属商阁）"}</strong>
            <span class="tag-chip ${ks.mode === "demonic" ? "mythic" : "done"}">${ks.label}</span>
          </div>
          ${karmaSpecials.map(sp => {
            const bought = !!(game.karmaMarketBought && game.karmaMarketBought[sp.id]);
            const bfQuota = sp.itemId === "blood_fury_pill" ? getBloodFuryQuota(game) : null;
            const quotaExhausted = Boolean(bfQuota && bfQuota.remaining <= 0);
            const btnLabel = quotaExhausted
              ? `本境已满 (${bfQuota.bought}/${bfQuota.max})`
              : bought
                ? "已购罄"
                : `${sp.cost}石购`;
            return `
              <div class="visual-tile" style="justify-content:space-between;padding:6px 8px;">
                <div style="display:flex;align-items:center;gap:8px;min-width:0;">
                  <img src="${ART[sp.art]}" alt="${sp.name}" style="width:32px;height:32px;flex-shrink:0;" />
                  <div style="min-width:0;">
                    <div style="font-size:11.5px;font-weight:700;color:#fff2c6;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                      <span>${sp.name}</span>
                      ${bfQuota ? `<span class="tag-chip ${quotaExhausted ? "done" : ""}" style="font-size:9.5px;">本境限购 ${bfQuota.bought}/${bfQuota.max}</span>` : ""}
                    </div>
                    <div style="font-size:10px;color:var(--text-sub);">${sp.desc}</div>
                  </div>
                </div>
                <button type="button" class="${ks.mode === "demonic" ? "btn-gold" : "btn-jade"}" style="padding:4px 10px;font-size:11px;white-space:nowrap;" data-buy-karma-item="${sp.id}" ${(quotaExhausted || bought || game.stones < sp.cost) ? "disabled" : ""}>${btnLabel}</button>
              </div>`;
          }).join("")}
        </div>

        <div class="jade-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:12.5px;color:var(--gold-bright);">${marketTitle}</strong>
            <button class="btn-ghost" style="padding:3px 9px;font-size:11px;" data-action="refresh-market">换一批 (15石)</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${game.marketStock.map((it, idx) => {
              const cost = Math.max(0, Math.round(num(it.price, 25) * fairDisc));
              const itRar = rarityNum(it.rarity);
              return `
                <div class="visual-tile rarity-${itRar}" style="justify-content:space-between;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <img src="${ART[hasOwn(ART, it.art) ? it.art : "item_jade"]}" alt="${escapeHtml(it.name)}" style="width:34px;height:34px;" />
                    <div>
                      <div style="font-size:12px;font-weight:700;" class="txt-r${itRar}">${escapeHtml(it.name)}</div>
                      <div style="font-size:10.5px;color:var(--text-sub);">${escapeHtml(formatGearStats(it))}</div>
                    </div>
                  </div>
                  <button class="btn-gold" style="padding:5px 11px;font-size:11.5px;" data-buy-gear="${idx}" ${game.stones < cost ? "disabled" : ""}>${cost}石购</button>
                </div>`;
            }).join("")}
          </div>
        </div>

        ${game.gearBag.length > 0 ? `
          <div class="jade-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:12px;color:var(--gold-bright);">闲置仙装袋 (${game.gearBag.length}/${GEAR_BAG_LIMIT})</strong>
              <button class="btn-jade" style="padding:3px 9px;font-size:11px;" data-action="smelt-all-gear">一键熔炼化灵石</button>
            </div>
            <div class="grid-2">
              ${game.gearBag.slice(0, 8).map((it, idx) => {
                const curEq = game.equippedGear[it.slot];
                const curEqLvl = Math.max(0, Math.floor(num(curEq && curEq.lvl, 0)));
                const itLvl = Math.max(0, Math.floor(num(it.lvl, 0)));
                const itRar = rarityNum(it.rarity);
                const canTransfer = Boolean(curEq && curEqLvl > itLvl);
                return `
                  <div class="visual-tile rarity-${itRar}" style="flex-direction:column;align-items:stretch;gap:5px;padding:7px 8px;">
                    <div style="display:flex;align-items:center;gap:7px;">
                      <img src="${ART[hasOwn(ART, it.art) ? it.art : "icon_blade"]}" alt="${escapeHtml(it.name)}" style="width:32px;height:32px;" />
                      <div style="min-width:0;flex:1;">
                        <div style="font-size:11px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" class="txt-r${itRar}">${escapeHtml(it.name)}${itLvl > 0 ? ` +${itLvl}` : ""}</div>
                        <div style="font-size:10px;color:var(--text-sub);">${escapeHtml(formatGearStats(it))}</div>
                      </div>
                    </div>
                    <div style="display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap;">
                      ${canTransfer ? `<button type="button" class="gear-action-mini" style="border-color:#70ffe6;color:#9effec;" data-equip-bag-transfer="${idx}">继承+${curEqLvl}换装</button>` : ""}
                      <button type="button" class="gear-action-mini" data-equip-bag="${idx}">换装</button>
                    </div>
                  </div>`;
              }).join("")}
            </div>
          </div>
        ` : ""}

        <div class="jade-card">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:12px;color:var(--gold-bright);">随身灵丹与天材地宝</strong>
            <button class="btn-gold" style="padding:4px 10px;font-size:11px;" data-action="show-verdict">${SVG.crown} 道果金榜</button>
          </div>
          <div class="grid-3">
            ${owned.length > 0 ? owned.map(it => {
              const usable = it.kind === "medicine" || it.kind === "breakthrough";
              const bfPrev = it.id === "blood_fury_pill" ? previewLifespanImpact(game, 24) : null;
              const tipDesc = bfPrev
                ? `${it.desc}｜${bfPrev.summaryText}${bfPrev.warningText ? " · " + bfPrev.warningText : ""}`
                : it.desc;
              return `
                <button class="visual-tile" style="flex-direction:column;text-align:center;" ${usable ? `data-use-item="${it.id}"` : ""} data-tip="${escTip(it.name, tipDesc)}" ${!usable ? "disabled" : ""}>
                  <img src="${ART[it.art]}" alt="${it.name}" />
                  <span style="font-size:11.5px;font-weight:700;">${it.name}×${Math.max(0, Math.floor(num(game.inventory[it.id], 0)))}</span>
                  ${bfPrev ? `<span class="tag-chip ${bfPrev.crossesAny ? "mythic" : ""}" style="font-size:10px;color:#ffb4ae;">⏳-2载${bfPrev.crossesAny ? " ⚠" : ""}</span>` : ""}
                  <span class="tag-chip ${usable ? "done" : ""}">${usable ? "点击服用" : "灵材"}</span>
                </button>`;
            }).join("") : `<div style="grid-column:1/-1;text-align:center;color:var(--text-sub);padding:10px;">行囊暂无灵丹</div>`}
          </div>
        </div>
      `;
    }
    if (currentTab === "cultivate") {
      requestAnimationFrame(renderWardrobePreviewCanvas);
    }
    const ws = document.getElementById("welcome-screen");
    if (drawerOpen && !cutscene.active && !(ws && ws.style.display !== "none")) {
      const bd = document.getElementById("modal-backdrop");
      const panel = document.getElementById("jade-panel");
      if (panel && !(bd && bd.classList.contains("open")) && !panel.contains(document.activeElement)) {
        focusDialogSafely(panel);
      }
    }
  }



  function executeAlchemyQuickCraft(recId) {
    if (!game) return false;
    const rec = RECIPES[recId];
    if (!rec) return false;
    const bd = computeRecipeCostBreakdown(game, rec);
    if (game.stones < bd.totalStoneCost) {
      showToast(`灵石不足（共需 ${bd.totalStoneCost} 灵石）`);
      return false;
    }
    game.stones -= bd.totalStoneCost;
    Object.entries(rec.inputs).forEach(([k, req]) => {
      game.inventory[k] = Math.max(0, (game.inventory[k] || 0) - req);
    });
    const count = (hasLaw(game, "nine_pill") || currentOmen(game).id === "alchemy_star") ? 2 : 1;
    game.inventory[rec.output] = (game.inventory[rec.output] || 0) + count;
    if (getSanctumLevel(game, "cauldron") >= 4) {
      game.inventory.healing_pill = (game.inventory.healing_pill || 0) + 1;
    }
    game.immortalPills = (game.immortalPills || 0) + 1;
    const craftMonths = Math.max(1, Math.floor(num(rec.months, 3)));
    const ageRes = advanceLifespanMonths(craftMonths, "alchemy");
    unlockAchievement("ach_pill");
    Sound.qiOrb(4);
    const outSpec = ITEMS[rec.output];
    const ageSuffix = ageRes && ageRes.aged > 0 ? ` · 耗寿 ${ageRes.aged} 月` : "";
    showToast(`速炼成丹 ×${count} · 【${outSpec.name}】${bd.hasMissing ? `（含购入缺料 ${bd.matBuyCost} 灵石，共耗 ${bd.totalStoneCost} 石${ageSuffix}）` : `（消耗 ${bd.baseStones} 石${ageSuffix}）`}`);
    saveGame(); updateHud();
    if (drawerOpen) renderDrawerContent();
    return true;
  }

  function openAlchemyBuyConfirmModal(recId, mode = "quick") {
    if (!game || !RECIPES[recId]) return;
    const rec = RECIPES[recId];
    const out = ITEMS[rec.output];
    const bd = computeRecipeCostBreakdown(game, rec);
    const craftMonths = Math.max(1, Math.floor(num(rec.months, 3)));
    pendingAlchemyCraft = { recId, mode };
    openModal(`
      <div class="drawer-mural-banner" style="height:84px;">
        <img src="${ART.banner_alchemy}" alt="炼丹补料确认" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">显式消费确认</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:3px;">确认以灵石补购缺料并炼制【${escapeHtml(out.name)}】？</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">取消 ✕</button>
        </div>
      </div>
      <div class="jade-card" style="gap:6px;">
        <div style="font-size:12px;color:#ffe89e;font-weight:700;">缺失灵材补购明细：</div>
        ${bd.missingItems.map(m => `
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;padding:4px 8px;border-radius:7px;background:rgba(10,24,30,0.68);">
            <span>${escapeHtml(m.name)}（需 ${m.req} / 持 ${m.have} / <b style="color:#ffb4ae;">缺 ${m.lack}</b>）</span>
            <span style="color:#ffe28a;">${m.unitPrice} 石/份 = <b>${m.subCost} 灵石</b></span>
          </div>
        `).join("")}
        <div style="border-top:1px solid var(--border-subtle);padding-top:6px;display:flex;flex-direction:column;gap:3px;font-size:12px;">
          <div style="display:flex;justify-content:space-between;"><span>炼丹耗时：</span><b>⏳ ${craftMonths} 月</b></div>
          ${(() => {
            const lfPrev = previewLifespanImpact(game, craftMonths);
            const cls = lfPrev.willExhaust || lfPrev.after.status === "critical" ? "danger" : lfPrev.crossesAny ? "warn" : "";
            return `<div id="alchemy-buy-lifespan-preview" class="lifespan-preview-strip ${cls}">${escapeHtml(lfPrev.summaryText)}${lfPrev.warningText ? ` · <b>${escapeHtml(lfPrev.warningText)}</b>` : ""}</div>`;
          })()}
          <div style="display:flex;justify-content:space-between;"><span>基础丹火费：</span><b>${bd.baseStones} 灵石</b></div>
          <div style="display:flex;justify-content:space-between;color:#ffd8a8;"><span>购入缺料：</span><b>购入缺料 ${bd.matBuyCost} 灵石</b></div>
          <div style="display:flex;justify-content:space-between;color:var(--gold-bright);font-size:13px;"><span>总计扣除：</span><b>${bd.totalStoneCost} 灵石（当前持有 ${Math.floor(num(game.stones, 0))}）</b></div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button type="button" class="btn-ghost" data-modal-close="1">取消</button>
        <button type="button" id="btn-confirm-alchemy-buy" class="btn-gold" data-action="confirm-alchemy-buy" ${game.stones < bd.totalStoneCost ? "disabled" : ""}>确认购入缺料 (${bd.totalStoneCost}石) 并炼制</button>
      </div>
    `, true, { tier: "decision" });
  }

  // ==================== F18 (D08): EXPLICIT-QUANTITY BATCH CRAFT & BATCH ENHANCE (ATOMIC ROLLBACK, ZERO HOLD-REPEAT) ====================
  function openBatchCraftModal(recId, qty = 3) {
    if (!game || !hasOwn(RECIPES, recId)) return false;
    const rec = RECIPES[recId];
    const caulLv = getSanctumLevel(game, "cauldron");
    if (rec.reqCauldronLv && caulLv < rec.reqCauldronLv) {
      showToast(`需先将【紫微丹鼎】升至 Lv.${rec.reqCauldronLv} 解封该丹方！`);
      return false;
    }
    const safeQty = Math.max(1, Math.min(5, Math.floor(num(qty, 3))));
    const bd = computeBatchRecipeCost(game, rec, safeQty);
    const out = ITEMS[rec.output];
    pendingBatchCraft = { recId, qty: safeQty };
    const canAfford = num(game.stones, 0) >= bd.totalStoneCost;
    openModal(`
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${renderSemanticTag("econ", "显式批量炼丹")}
          <h2 style="font-family:var(--font-serif);font-size:var(--fs-xl);color:var(--gold-bright);">批量稳炼 · 【${escapeHtml(out.name)}】</h2>
        </div>
        <button type="button" class="btn-tertiary btn-ghost" data-modal-close="1">取消 ✕</button>
      </div>
      <div class="modal-body">
        <div class="batch-qty-row" role="group" aria-label="选择批量炼丹份数">
          <span style="font-size:var(--fs-sm);color:var(--text-sub);">选择数量：</span>
          ${[1, 3, 5].map(q => `<button type="button" class="batch-qty-btn ${safeQty === q ? "active" : ""}" data-batch-craft-qty="${q}" aria-pressed="${safeQty === q ? "true" : "false"}">×${q} 炉</button>`).join("")}
        </div>
        <div class="jade-card batch-summary-table" style="gap:6px;">
          <div style="font-size:var(--fs-sm);color:var(--gold-bright);font-weight:700;">消耗与产出核对（确认前绝不扣除任何资源）</div>
          ${bd.consumedMats.map(m => `
            <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);padding:3px 6px;border-radius:6px;background:rgba(10,24,30,0.68);">
              <span>${escapeHtml(m.name)}（需 ${m.req} · 持 ${m.have}）</span>
              <span style="color:${m.lack > 0 ? "#ffb4ae" : "var(--jade)"};">${m.lack > 0 ? `消耗库存 ${m.use} + 补购缺料 ${m.lack}` : `灵材齐备（消耗 ${m.use}）`}</span>
            </div>
          `).join("")}
          <div style="border-top:1px solid var(--border-subtle);padding-top:6px;display:flex;flex-direction:column;gap:4px;font-size:var(--fs-sm);">
            <div style="display:flex;justify-content:space-between;"><span>总计耗时（寿元）：</span><b>⏳ ${bd.totalMonths} 月</b></div>
            ${(() => {
              const lfPrev = previewLifespanImpact(game, bd.totalMonths);
              const cls = lfPrev.willExhaust || lfPrev.after.status === "critical" ? "danger" : lfPrev.crossesAny ? "warn" : "";
              return `<div id="batch-craft-lifespan-preview" class="lifespan-preview-strip ${cls}">${escapeHtml(lfPrev.summaryText)}${lfPrev.warningText ? ` · <b>${escapeHtml(lfPrev.warningText)}</b>` : ""}</div>`;
            })()}
            <div style="display:flex;justify-content:space-between;"><span>基础丹火费：</span><b>${bd.baseStones} 灵石</b></div>
            ${bd.hasMissing ? `<div style="display:flex;justify-content:space-between;color:#ffd8a8;"><span>缺料灵石补购：</span><b>${bd.matBuyCost} 灵石</b></div>` : ""}
            <div style="display:flex;justify-content:space-between;color:var(--gold-bright);"><span>总计扣除灵石：</span><b>${bd.totalStoneCost} 灵石（当前持有 ${Math.floor(num(game.stones, 0))}）</b></div>
            <div style="display:flex;justify-content:space-between;color:var(--jade);"><span>预计产出：</span><b>${escapeHtml(out.name)} ×${bd.totalOutput}${bd.bonusHealing > 0 ? ` + 丹鼎赠回春丹 ×${bd.bonusHealing}` : ""}</b></div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-tertiary btn-ghost" data-modal-close="1">取消</button>
        <button type="button" id="btn-confirm-batch-craft" class="${canAfford ? "btn-primary btn-gold" : "btn-tertiary btn-ghost is-locked"}" data-action="confirm-batch-craft" ${canAfford ? "" : "disabled"}>确认批量炼制 ×${safeQty}（${bd.totalStoneCost}石 · ${bd.totalMonths}月）</button>
      </div>
    `, true, { kind: "batch_craft", tier: "decision" });
    return true;
  }

  function executeAlchemyBatchCraft(recId, qty) {
    if (!game || !hasOwn(RECIPES, recId)) return { ok: false, reason: "invalid_recipe" };
    if (typeof qty !== "number" || !Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1 || qty > 5) {
      return { ok: false, reason: "invalid_qty" };
    }
    const rec = RECIPES[recId];
    const caulLv = getSanctumLevel(game, "cauldron");
    if (rec.reqCauldronLv && caulLv < rec.reqCauldronLv) {
      showToast(`需先将【紫微丹鼎】升至 Lv.${rec.reqCauldronLv} 解封该丹方！`);
      return { ok: false, reason: "cauldron_locked" };
    }
    const safeQty = qty;
    const bd = computeBatchRecipeCost(game, rec, safeQty);
    if (num(game.stones, 0) < bd.totalStoneCost) {
      showToast(`灵石不足（批量 ×${safeQty} 共需 ${bd.totalStoneCost} 灵石）`);
      return { ok: false, reason: "insufficient_stones" };
    }

    // Atomic snapshot for rollback if persistence fails (e.g., QuotaExceededError / read-only / conflict)
    const snap = {
      stones: game.stones,
      inventory: Object.assign({}, game.inventory),
      immortalPills: game.immortalPills,
      elapsedMonths: game.elapsedMonths,
      hasPendingRewardsKey: Object.prototype.hasOwnProperty.call(game, "pendingRewards"),
      pendingRewards: Array.isArray(game.pendingRewards) ? JSON.parse(JSON.stringify(game.pendingRewards)) : [],
      hasResolvedRewardIdsKey: Object.prototype.hasOwnProperty.call(game, "resolvedRewardIds"),
      resolvedRewardIds: Array.isArray(game.resolvedRewardIds) ? game.resolvedRewardIds.slice() : [],
      pendingLifespanExhaustedPrompt,
      journalLen: Array.isArray(game.journal) ? game.journal.length : 0
    };

    const willAge = !sandboxMode && !isPracticeModeActive() && game.realm !== "ascended" && bd.totalMonths > 0;
    const prevLf = getLifespanInfo(game);
    const ageDelta = willAge ? Math.max(1, Math.round(bd.totalMonths)) : 0;

    game.stones -= bd.totalStoneCost;
    bd.consumedMats.forEach(m => {
      game.inventory[m.id] = Math.max(0, (game.inventory[m.id] || 0) - m.use);
    });
    game.inventory[rec.output] = (game.inventory[rec.output] || 0) + bd.totalOutput;
    if (bd.bonusHealing > 0) {
      game.inventory.healing_pill = (game.inventory.healing_pill || 0) + bd.bonusHealing;
    }
    game.immortalPills = (game.immortalPills || 0) + safeQty;
    let nextLf = prevLf;
    let queuedExhaustedReward = false;
    if (willAge) {
      game.elapsedMonths = Math.max(0, Math.floor(num(game.elapsedMonths, 0))) + ageDelta;
      nextLf = getLifespanInfo(game);
      if (nextLf.status === "exhausted" && !lifespanExhaustedPromptDismissed) {
        pendingLifespanExhaustedPrompt = true;
        const prevPrLen = Array.isArray(game.pendingRewards) ? game.pendingRewards.length : 0;
        enqueuePendingReward({ kind: "lifespan_exhausted", payload: {}, persist: false, deferUi: true });
        queuedExhaustedReward = Array.isArray(game.pendingRewards) && game.pendingRewards.length > prevPrLen;
      }
    }

    if (!sandboxMode && !isPracticeModeActive()) {
      const savedOk = saveGame();
      if (!savedOk) {
        game.stones = snap.stones;
        game.inventory = snap.inventory;
        game.immortalPills = snap.immortalPills;
        game.elapsedMonths = snap.elapsedMonths;
        if (snap.hasPendingRewardsKey) game.pendingRewards = snap.pendingRewards;
        else delete game.pendingRewards;
        if (snap.hasResolvedRewardIdsKey) game.resolvedRewardIds = snap.resolvedRewardIds;
        else delete game.resolvedRewardIds;
        pendingLifespanExhaustedPrompt = snap.pendingLifespanExhaustedPrompt;
        if (Array.isArray(game.journal) && game.journal.length > snap.journalLen) {
          game.journal.splice(0, game.journal.length - snap.journalLen);
        }
        syncPendingRewardsBadge();
        updateHud();
        if (drawerOpen) renderDrawerContent();
        showToast("⚠ 存档写入失败，已原子回滚本次批量炼丹（未扣除灵石/灵材/寿元）", { critical: true, key: "batch_craft_rollback", throttleMs: 2500 });
        return { ok: false, rolledBack: true, reason: "save_failed" };
      }
    }

    if (willAge) {
      applyLifespanPostAdvanceEffects(prevLf, nextLf, { skipEnqueue: true });
      if (queuedExhaustedReward) {
        if (game.pendingRewards.length > PENDING_REWARD_SOFT_WARN) {
          showToast(`⚠ 待处置奖励已达 ${game.pendingRewards.length} 项，请尽快点击顶部【待处置】处理！`, { tier: 1, key: "pending_soft_warn", throttleMs: 8000 });
        }
        syncPendingRewardsBadge();
        requestCalmReevaluation();
      }
    }

    unlockAchievement("ach_pill");
    Sound.qiOrb(Math.min(8, 3 + safeQty));
    const outSpec = ITEMS[rec.output];
    const ageSuffix = ageDelta > 0 ? ` · 耗寿 ${ageDelta} 月` : "";
    showToast(`批量成丹 ×${bd.totalOutput} · 【${outSpec.name}】（共耗 ${bd.totalStoneCost} 灵石${ageSuffix}）`);
    updateHud();
    if (drawerOpen) renderDrawerContent();
    return { ok: true, qty: safeQty, crafted: bd.totalOutput, totalStoneCost: bd.totalStoneCost, totalMonths: bd.totalMonths };
  }

  function openBatchEnhanceModal(slot, steps = 3) {
    if (!game || !game.equippedGear || !game.equippedGear[slot]) return false;
    const eq = game.equippedGear[slot];
    const eqLvl = Math.max(0, Math.floor(num(eq.lvl, 0)));
    const maxSteps = Math.max(0, 10 - eqLvl);
    if (maxSteps <= 0) {
      showToast("该仙装已淬火至圆满 +10！");
      return false;
    }
    const baseStepOptions = [1, 3, 5];
    const stepOptions = (maxSteps > 1 && maxSteps < 5 && !baseStepOptions.includes(maxSteps))
      ? [...baseStepOptions, maxSteps].sort((a, b) => a - b)
      : baseStepOptions;
    const clampedReq = Math.max(1, Math.min(5, maxSteps, Math.floor(num(steps, Math.min(3, maxSteps)))));
    const safeSteps = stepOptions.includes(clampedReq)
      ? clampedReq
      : stepOptions.filter(s => s <= maxSteps).slice(-1)[0] || 1;
    const preview = computeBatchEnhancePreview(game, slot, safeSteps);
    pendingBatchEnhance = { slot, steps: safeSteps };
    openModal(`
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${renderSemanticTag("econ", "显式多阶淬火")}
          <h2 style="font-family:var(--font-serif);font-size:var(--fs-xl);color:var(--gold-bright);">批量淬火 · 【${escapeHtml(eq.name)} +${eqLvl}】</h2>
        </div>
        <button type="button" class="btn-tertiary btn-ghost" data-modal-close="1">取消 ✕</button>
      </div>
      <div class="modal-body">
        <div class="batch-qty-row" role="group" aria-label="选择淬火阶数">
          <span style="font-size:var(--fs-sm);color:var(--text-sub);">选择阶数：</span>
          ${stepOptions.map(stVal => {
            const dis = stVal > maxSteps;
            const act = safeSteps === stVal;
            const lbl = (stVal === maxSteps && !baseStepOptions.includes(stVal)) ? `+${stVal} 阶(满)` : `+${stVal} 阶`;
            return `<button type="button" class="batch-qty-btn ${act ? "active" : ""} ${dis ? "is-locked" : ""}" data-batch-enh-steps="${stVal}" aria-pressed="${act ? "true" : "false"}" ${dis ? "disabled" : ""}>${lbl}</button>`;
          }).join("")}
        </div>
        <div class="jade-card batch-summary-table" style="gap:6px;">
          <div style="font-size:var(--fs-sm);color:var(--gold-bright);font-weight:700;">淬火前后属性对照（确认前绝不扣石）</div>
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);"><span>淬火阶数：</span><b>+${preview.fromLvl} → +${preview.toLvl}（+${preview.steps} 阶）</b></div>
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);"><span>剑道攻击：</span><b style="color:var(--jade);">${preview.before.atk} → ${preview.after.atk}${preview.dAtk > 0 ? ` (+${preview.dAtk})` : ""}</b></div>
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);"><span>最大气血：</span><b style="color:var(--jade);">${preview.before.maxHp} → ${preview.after.maxHp}${preview.dHp > 0 ? ` (+${preview.dHp})` : ""}</b></div>
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);"><span>护体减伤：</span><b style="color:var(--jade);">${preview.before.dmgReduce} → ${preview.after.dmgReduce}${preview.dDr > 0 ? ` (+${preview.dDr})` : ""}</b></div>
          <div style="border-top:1px solid var(--border-subtle);padding-top:6px;display:flex;justify-content:space-between;color:var(--gold-bright);font-size:var(--fs-md);">
            <span>总计灵石消耗：</span><b>${preview.totalCost} 灵石（当前持有 ${Math.floor(num(game.stones, 0))}）</b>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-tertiary btn-ghost" data-modal-close="1">取消</button>
        <button type="button" id="btn-confirm-batch-enhance" class="${preview.canAfford ? "btn-primary btn-gold" : "btn-tertiary btn-ghost is-locked"}" data-action="confirm-batch-enhance" ${preview.canAfford ? "" : "disabled"}>确认淬火 +${preview.steps} 阶（${preview.totalCost}石）</button>
      </div>
    `, true, { kind: "batch_enhance", tier: "decision" });
    return true;
  }

  function executeGearBatchEnhance(slot, steps) {
    if (!game || !game.equippedGear || !game.equippedGear[slot]) return { ok: false, reason: "missing_slot" };
    if (typeof steps !== "number" || !Number.isFinite(steps) || !Number.isInteger(steps) || steps < 1 || steps > 5) {
      return { ok: false, reason: "invalid_steps" };
    }
    const eq = game.equippedGear[slot];
    const eqLvl = Math.max(0, Math.floor(num(eq.lvl, 0)));
    const maxSteps = Math.max(0, 10 - eqLvl);
    if (maxSteps <= 0) {
      showToast("该仙装已淬火至圆满 +10！");
      return { ok: false, reason: "max_level" };
    }
    if (steps > maxSteps) {
      return { ok: false, reason: "invalid_steps" };
    }
    const preview = computeBatchEnhancePreview(game, slot, steps);
    if (!preview.valid) {
      return { ok: false, reason: "invalid_steps" };
    }
    if (!preview.canAfford) {
      showToast(`灵石不足（淬火 +${preview.steps} 阶共需 ${preview.totalCost} 灵石）`);
      return { ok: false, reason: "insufficient_stones" };
    }

    const beforeStats = getCombatStats(game);
    const snap = {
      stones: game.stones,
      lvl: eq.lvl,
      craftOrLoot: game.goalStats ? game.goalStats.craftOrLoot : 0
    };

    game.stones -= preview.totalCost;
    eq.lvl = preview.toLvl;
    if (game.goalStats) game.goalStats.craftOrLoot = (game.goalStats.craftOrLoot || 0) + preview.steps;

    if (!sandboxMode && !isPracticeModeActive()) {
      const savedOk = saveGame();
      if (!savedOk) {
        game.stones = snap.stones;
        eq.lvl = snap.lvl;
        if (game.goalStats) game.goalStats.craftOrLoot = snap.craftOrLoot;
        updateHud();
        if (drawerOpen) renderDrawerContent();
        showToast("⚠ 存档写入失败，已原子回滚本次批量淬火（未扣除任何灵石）", { critical: true, key: "batch_enh_rollback", throttleMs: 2500 });
        return { ok: false, rolledBack: true, reason: "save_failed" };
      }
    }

    Sound.clang(1.35, 0.14);
    Sound.fanfare();
    showToast(`批量淬火功成！【${eq.name} +${eq.lvl}】（共耗 ${preview.totalCost} 灵石）`);
    recordVol1PrepUpgradeDelta(beforeStats, `${eq.name} +${eq.lvl}`);
    updateHud();
    if (drawerOpen) renderDrawerContent();
    return { ok: true, slot, steps: preview.steps, toLvl: eq.lvl, totalCost: preview.totalCost };
  }

  function openSoulSealUnlockChoiceModal(newSoulId, recEventId = null) {
    if (!game || !hasOwn(SOUL_SPIRITS, newSoulId)) {
      activeSoulUnlockId = null;
      return;
    }
    activeSoulUnlockId = newSoulId;
    if (recEventId) activePendingRewardId = recEventId;
    const nw = SOUL_SPIRITS[newSoulId];
    const curId = hasOwn(SOUL_SPIRITS, game.equippedSoul) ? game.equippedSoul : "blood_warden";
    const cur = SOUL_SPIRITS[curId];
    openModal(`
      <div class="drawer-mural-banner" style="height:86px;">
        <img src="${ART.spirit_seal_emblem}" alt="镇妖魂印抉择" style="object-fit:contain;background:radial-gradient(circle,#18353f,#071319);" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">新魂印觉醒 · 自主择佩</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:3px;">解锁镇妖魂印【${escapeHtml(nw.name)}】</h2>
          </div>
          <button type="button" class="btn-ghost" data-soul-choice="keep" data-soul-id="${escapeHtml(newSoulId)}">保留当前 ✕</button>
        </div>
      </div>
      <div style="font-size:12px;color:#b8dcd5;">已将【${escapeHtml(nw.name)}】铭刻入魂印图谱；请选择是否立即替换当前佩带的镇妖魂印：</div>
      <div class="grid-2">
        <div class="jade-card" style="gap:6px;">
          <span class="tag-chip">当前佩带魂印</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${ART[hasOwn(ART, cur.art) ? cur.art : "spirit_seal_emblem"]}" alt="${escapeHtml(cur.name)}" style="width:40px;height:40px;border-radius:50%;" />
            <div>
              <strong style="font-size:13.5px;color:#e6f7f4;">${escapeHtml(cur.name)}</strong>
              <div style="font-size:10.5px;color:var(--jade);">冷却 ${num(cur.cd, 10)}s</div>
            </div>
          </div>
          <div style="font-size:11px;color:var(--text-sub);line-height:1.45;">${escapeHtml(cur.desc)}</div>
        </div>
        <div class="jade-card" style="gap:6px;border-color:rgba(255,214,112,0.72);">
          <span class="tag-chip mythic">新解锁魂印</span>
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${ART[hasOwn(ART, nw.art) ? nw.art : "spirit_seal_emblem"]}" alt="${escapeHtml(nw.name)}" style="width:40px;height:40px;border-radius:50%;" />
            <div>
              <strong style="font-size:13.5px;color:var(--gold-bright);">${escapeHtml(nw.name)}</strong>
              <div style="font-size:10.5px;color:#ffe28a;">冷却 ${num(nw.cd, 10)}s</div>
            </div>
          </div>
          <div style="font-size:11px;color:#d6eee8;line-height:1.45;">${escapeHtml(nw.desc)}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button type="button" id="btn-soul-keep-current" class="btn-ghost" data-soul-choice="keep" data-soul-id="${escapeHtml(newSoulId)}">保留当前</button>
        <button type="button" id="btn-soul-equip-new" class="btn-gold" data-soul-choice="equip" data-soul-id="${escapeHtml(newSoulId)}">装备新魂印</button>
      </div>
    `, true, { kind: "soul_unlock" });
  }

  function openSoulSealRefineConfirmModal(sid) {
    if (!game || !hasOwn(SOUL_SPIRITS, sid)) return;
    const nw = SOUL_SPIRITS[sid];
    const curId = hasOwn(SOUL_SPIRITS, game.equippedSoul) ? game.equippedSoul : "blood_warden";
    const cur = SOUL_SPIRITS[curId];
    pendingSoulRefineId = sid;
    openModal(`
      <div class="drawer-mural-banner" style="height:84px;">
        <img src="${ART.spirit_seal_emblem}" alt="魂印炼化确认" style="object-fit:contain;background:radial-gradient(circle,#18353f,#071319);" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">显式消费确认</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:3px;">消耗 80 灵石炼化【${escapeHtml(nw.name)}】？</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">取消 ✕</button>
        </div>
      </div>
      <div class="grid-2">
        <div class="jade-card" style="gap:5px;">
          <span class="tag-chip">当前佩带魂印</span>
          <strong style="font-size:13px;color:#e6f7f4;">${escapeHtml(cur.name)}（冷却 ${num(cur.cd, 10)}s）</strong>
          <div style="font-size:11px;color:var(--text-sub);">${escapeHtml(cur.desc)}</div>
        </div>
        <div class="jade-card" style="gap:5px;border-color:rgba(255,214,112,0.72);">
          <span class="tag-chip mythic">待炼化新魂印 · 80 灵石</span>
          <strong style="font-size:13px;color:var(--gold-bright);">${escapeHtml(nw.name)}（冷却 ${num(nw.cd, 10)}s）</strong>
          <div style="font-size:11px;color:#d6eee8;">${escapeHtml(nw.desc)}</div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn-ghost" data-modal-close="1">取消</button>
        <button type="button" id="btn-soul-refine-keep" class="btn-jade" data-soul-refine="keep" data-soul-id="${escapeHtml(sid)}">仅炼化保留当前 (80石)</button>
        <button type="button" id="btn-soul-refine-equip" class="btn-gold" data-soul-refine="equip" data-soul-id="${escapeHtml(sid)}">炼化并装备新魂印 (80石)</button>
      </div>
    `, true);
  }

  function startFurnaceMinigame(recId, opts = {}) {
    if (!game) return;
    const rec = RECIPES[recId];
    if (!rec) return;
    if (rec.reqCauldronLv && getSanctumLevel(game, "cauldron") < rec.reqCauldronLv) {
      showToast(`需先在洞府将【紫微丹鼎】升至 Lv.${rec.reqCauldronLv} 方可炼制【${ITEMS[rec.output].name}】！`);
      return;
    }
    const bd = computeRecipeCostBreakdown(game, rec);
    if (game.stones < bd.totalStoneCost) {
      showToast(`灵石不足（共需 ${bd.totalStoneCost} 灵石${bd.hasMissing ? `，含购入缺料 ${bd.matBuyCost} 灵石` : ""}）`);
      return;
    }
    if (bd.hasMissing && !(opts && opts.confirmedMissingBuy)) {
      openAlchemyBuyConfirmModal(recId, "furnace");
      return;
    }
    game.stones -= bd.totalStoneCost;
    Object.entries(rec.inputs).forEach(([k, req]) => {
      game.inventory[k] = Math.max(0, (game.inventory[k] || 0) - req);
    });

    const sb = getSanctumBonuses(game);
    const bonusWidth = (game.perk === "medicine_sage" ? 0.10 : 0) + (currentOmen(game).id === "alchemy_star" ? 0.08 : 0) + (hasLaw(game, "nine_pill") ? 0.08 : 0) + sb.alchemySweetBonus;
    const craftMonths = Math.max(1, Math.floor(num(rec.months, 3)));
    const lfPrev = previewLifespanImpact(game, craftMonths);
    furnaceGame.recipeId = recId;
    furnaceGame.lifespanPreview = lfPrev;
    furnaceGame.sweetWidth = Math.min(0.56, 0.22 + bonusWidth);
    furnaceGame.sweetStart = 0.50 - furnaceGame.sweetWidth / 2;
    furnaceGame.pos = 0.08;
    furnaceGame.dir = 1;
    furnaceGame.speed = 1.05;
    furnaceGame.active = true;
    Sound.drum(0.16);
    if (lfPrev.crossesAny && lfPrev.warningText) {
      showToast(`🔥 开炉炼丹（${lfPrev.summaryText} · ${lfPrev.warningText}）`);
    }
    updateHud();
    renderDrawerContent();
  }

  function strikeFurnaceNeedle() {
    if (!game || !furnaceGame.active) return;
    furnaceGame.active = false;
    const rec = RECIPES[furnaceGame.recipeId] || RECIPES.healing;
    const outSpec = ITEMS[rec.output];
    const inSweet = furnaceGame.pos >= furnaceGame.sweetStart && furnaceGame.pos <= (furnaceGame.sweetStart + furnaceGame.sweetWidth);
    const baseCount = hasLaw(game, "nine_pill") ? 2 : 1;
    const count = inSweet ? baseCount + 1 : baseCount;

    game.inventory[rec.output] = (game.inventory[rec.output] || 0) + count;
    if (getSanctumLevel(game, "cauldron") >= 4) {
      game.inventory.healing_pill = (game.inventory.healing_pill || 0) + 1;
    }
    game.immortalPills = (game.immortalPills || 0) + 1;
    const craftMonths = Math.max(1, Math.floor(num(rec.months, 3)));
    const ageRes = advanceLifespanMonths(craftMonths, "alchemy");
    const ageSuffix = ageRes && ageRes.aged > 0 ? ` · 耗寿 ${ageRes.aged} 月` : "";
    unlockAchievement("ach_pill");

    if (inSweet) {
      const bRes = grantPermanentStatBonus(game, { hp: 20, atk: 4, source: "alchemy" });
      Sound.fanfare();
      Sound.clang(1.2, 0.14);
      const capMsg = (bRes.hpCapped || bRes.atkCapped)
        ? `（本境丹道上限 血${bRes.pg.alchemyHp}/${bRes.caps.alchemyHp} · 攻${bRes.pg.alchemyAtk}/${bRes.caps.alchemyAtk}，破境后提升）`
        : "";
      furnaceGame.lastResult = `★ 九转仙品云纹丹 ×${count}！（气血+${bRes.grantedHp} · 攻击+${bRes.grantedAtk}${ageSuffix}）${capMsg}`;
      showToast(furnaceGame.lastResult);
    } else {
      Sound.qiOrb(4);
      const bRes = grantPermanentStatBonus(game, { hp: 6, source: "alchemy" });
      const capMsg = bRes.hpCapped
        ? `（本境丹道气血已达上限 ${bRes.pg.alchemyHp}/${bRes.caps.alchemyHp}，破境后提升上限）`
        : "";
      furnaceGame.lastResult = `成丹 ×${count} · ${outSpec.name}（气血+${bRes.grantedHp}${ageSuffix}）${capMsg}`;
      showToast(furnaceGame.lastResult);
    }
    saveGame();
    updateHud();
    renderDrawerContent();
  }

  function openEndingModal() {
    if (!game) return;
    const score = computeCompetitionScore(game);
    const gradeInfo = getScoreGrade(score, game);
    const chosenEnd = ASCENSION_ENDINGS.find(e => e.id === game.ending);
    const karmaEnd = getKarmaEndingEpilogue(game, game.ending);
    const ks = getKarmaState(game);

    if (game.status === "ascended" && !chosenEnd) {
      openModal(`
        <div class="drawer-mural-banner" style="height:98px;">
          <img src="${ART.heaven_gate}" alt="九霄天门" />
          <div class="drawer-mural-overlay">
            <div>
              <span class="cinnabar-seal">${escapeHtml(karmaEnd.seal)}</span>
              <h2 style="font-family:var(--font-serif);font-size:23px;color:var(--gold-bright);margin-top:4px;">九霄天门已开 · 抉择飞升道途</h2>
            </div>
            <span class="tag-chip done">${escapeHtml(ks.label)} · 仁${Math.floor(num(game.dao.benevolence, 6))} 锋${Math.floor(num(game.dao.edge, 10))} 真${Math.floor(num(game.dao.serenity, 6))}</span>
          </div>
        </div>
        <div class="ending-karma-poem" style="width:100%;max-width:none;text-align:center;">
          <strong style="font-size:12px;color:${karmaEnd.color};">道心证果印记：【${escapeHtml(karmaEnd.epithet)}】</strong>
          <div style="font-family:var(--font-serif);font-size:13px;color:#fff3d0;white-space:pre-line;line-height:1.6;">${escapeHtml(karmaEnd.poem)}</div>
        </div>
        <div class="law-draft-grid">
          ${ASCENSION_ENDINGS.map(ed => `
            <button type="button" class="law-card-btn" data-choose-ending="${escapeHtml(ed.id)}">
              <img src="${ART[ed.art]}" alt="${escapeHtml(ed.name)}" />
              <div style="font-family:var(--font-serif);font-size:17px;font-weight:700;color:var(--gold-bright);">${escapeHtml(ed.name)}</div>
              <span class="tag-chip mythic">${escapeHtml(ed.tag)}</span>
              <span style="font-size:11px;color:var(--text-sub);line-height:1.4;">${escapeHtml(ed.desc)}</span>
            </button>
          `).join("")}
        </div>
      `, false, { kind: "ending" });
      return;
    }

    openModal(`
      <div class="drawer-mural-banner" style="height:94px;">
        <img src="${ART.heaven_gate}" alt="道果金榜" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">${escapeHtml(gradeInfo.grade)} 级评定 · ${escapeHtml(karmaEnd.seal)}</span>
            <h2 style="font-family:var(--font-serif);font-size:24px;color:var(--gold-bright);margin-top:4px;">${escapeHtml(gradeInfo.title)} · 道果金榜 ${score} 分</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">收卷 ✕</button>
        </div>
      </div>
      <div style="text-align:center;display:flex;flex-direction:column;gap:10px;">
        ${chosenEnd ? `<div style="font-size:14px;color:${karmaEnd.color};font-weight:700;">证道尊号：【${escapeHtml(karmaEnd.epithet)}】</div><p style="font-size:12px;color:var(--text-sub);max-width:540px;margin:0 auto;">${escapeHtml(chosenEnd.desc)}</p>` : ""}
        <div class="ending-karma-poem">
          <strong style="font-size:11.5px;color:${karmaEnd.color};">☯ 正魔证道题诗 · ${escapeHtml(ks.label)}</strong>
          <div style="font-family:var(--font-serif);font-size:13.5px;color:#fff4d2;white-space:pre-line;line-height:1.65;">${escapeHtml(karmaEnd.poem)}</div>
          <p style="font-size:11.5px;color:#b8dcd5;line-height:1.5;">${escapeHtml(karmaEnd.epilogue)}</p>
        </div>
        <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
          <span class="tag-chip done">境界：${escapeHtml((REALMS[game.realm] && REALMS[game.realm].name) || "凡人")}</span>
          <span class="tag-chip ${karmaEnd.clearedStages === STAGES.length ? "done" : ""}">秘境 ${karmaEnd.clearedStages}/${STAGES.length} · ${karmaEnd.totalStars}/15 ★</span>
          ${game.calamityTier > 0 ? `<span class="hud-calamity-pill">🔥 劫火×${Math.floor(num(game.calamityTier, 0))}</span>` : ""}
          <span class="tag-chip">洞府灵阶 ${getSanctumTotalLevel(game)}/25</span>
          <span class="tag-chip">飞剑 ×${getSwordCount(game)}</span>
          <span class="tag-chip">大道法则 ×${(game.laws || []).length}</span>
          <span class="tag-chip mythic">共鸣羁绊 ×${SYNERGIES.filter(s => s.active(game)).length}</span>
          <span class="tag-chip">故人合击 ×${karmaEnd.bondedNames.length}</span>
          <span class="tag-chip mythic">锁妖塔 ${Math.max(0, Math.floor(num(game.towerBest, 0)))} 层</span>
          <span class="tag-chip">图鉴 ${getCodexCompletionPct()}%</span>
        </div>
        ${metaState.ascensions >= 1 ? `
          <div class="jade-card" style="text-align:left;gap:6px;padding:8px 11px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
              <strong style="font-size:11.5px;color:#ffb4a8;">🔥 下世预选【劫火周目】挑战难度（已解封轮回命格 ${PERKS.filter(p => (p.unlock || 0) > 0 && isPerkUnlocked(p)).length}/4）：</strong>
              <span style="font-size:10.5px;color:#ffe28a;">当前预选：${escapeHtml(getCalamityCycleSpec(selectedCalamityTier).name)}</span>
            </div>
            <div class="calamity-tier-grid">
              ${CALAMITY_CYCLES.map(c => {
                const ok = isCalamityTierUnlocked(c.tier);
                const sel = selectedCalamityTier === c.tier;
                return `<button type="button" class="calamity-tier-btn ${sel ? "active" : ""}" data-calamity-tier="${c.tier}" ${!ok ? "disabled" : ""}>
                  <strong style="color:${sel ? "#ffe28a" : "#e6f4f1"};">${ok ? (c.tier > 0 ? "🔥 " : "☯ ") : "🔒 "}${escapeHtml(c.short)} · ${escapeHtml(c.name.split("·")[0])}</strong>
                  <span style="font-size:9.3px;color:#b8d4ce;">${ok ? escapeHtml(c.desc) : `需累计飞升 ${c.reqAsc} 世`}</span>
                </button>`;
              }).join("")}
            </div>
          </div>
        ` : ""}
        <div style="display:flex;justify-content:center;gap:10px;margin-top:4px;flex-wrap:wrap;">
          <button type="button" class="btn-gold" data-action="reincarnate-now">再入轮回（第 ${(Number(metaState.ascensions) || 0) + 1} 世${selectedCalamityTier > 0 ? ` · 劫火×${selectedCalamityTier}` : ""}）</button>
          <button type="button" class="btn-jade" data-action="open-hall-of-lives">🏛 历世道果殿堂（${(metaState.hallOfLives || []).length} 卷）</button>
          <button type="button" class="btn-ghost" data-modal-close="1">继续演武</button>
        </div>
      </div>
    `, true, { kind: "ending" });
  }

  // Complete Game System Center: Compendium + Claimable Achievements + Controls/Save + Presets!
  function openSettingsModal() {
    const seenE = metaState.seenEnemies || [];
    const seenL = metaState.seenLaws || [];
    const totalColl = Object.keys(ENEMIES).length + Object.keys(DAO_LAWS).length;
    const curColl = seenE.length + seenL.length;

    let tabBody = "";
    if (currentSysTab === "compendium") {
      const selItem = CODEX_SHOWCASE_ITEMS.find(x => x.id === codexSelectedId) || CODEX_SHOWCASE_ITEMS[0];
      tabBody = `
        <div class="codex-showcase-wrap">
          <canvas id="codex-live-canvas" width="248" height="138"></canvas>
          <div style="display:flex;flex-direction:column;gap:5px;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
              <div>
                <span class="tag-chip mythic" style="font-size:9.5px;">${selItem.cat}鉴赏</span>
                <strong style="font-family:var(--font-serif);font-size:14.5px;color:var(--gold-bright);margin-left:5px;">${selItem.name}</strong>
              </div>
              <button type="button" id="btn-codex-play-demo" class="btn-gold" style="padding:4px 11px;font-size:11px;white-space:nowrap;" data-action="codex-play-demo">▶ 演武招式演示</button>
            </div>
            <div style="font-size:11px;color:#80ffea;font-weight:700;">招牌绝学：${selItem.moveName}</div>
            <div style="font-size:10.5px;color:#cde6e0;line-height:1.38;">${selItem.guide}</div>
            <div class="codex-pick-strip">
              ${CODEX_SHOWCASE_ITEMS.map(it => `<button type="button" class="codex-pick-chip ${it.id === selItem.id ? "active" : ""}" data-codex-pick="${it.id}">${it.name}</button>`).join("")}
            </div>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
          <strong style="font-size:12px;color:var(--gold-bright);">九州妖兽与大道法则收集录（已封装 ${Object.keys(ART).length} 项手绘典藏资产）</strong>
          <span class="tag-chip done">收集度 ${Math.round((curColl / totalColl) * 100)}% (${curColl}/${totalColl})</span>
        </div>
        <div class="compendium-grid">
          ${Object.values(ENEMIES).map(en => {
            const ok = seenE.includes(en.id);
            return `
              <div class="comp-cell ${ok ? "unlocked" : "locked"}" data-tip="${escTip(ok ? en.name : "未知妖兽", ok ? en.mechDesc : "深入九州秘境遭遇后解锁")}">
                <img src="${ART[en.art]}" alt="${en.name}" />
                <strong style="font-size:11px;color:${ok ? "var(--gold-bright)" : "var(--text-sub)"};">${ok ? en.name.replace(/第.劫 · /, "") : "？？？"}</strong>
                <span style="font-size:9.5px;color:var(--text-sub);">${REALMS[en.min].name}境</span>
              </div>`;
          }).join("")}
          ${Object.values(DAO_LAWS).map(lw => {
            const ok = seenL.includes(lw.id) || (game && game.laws.includes(lw.id));
            const liveNote = (ok && game) ? getLawLiveContributionText(game, lw.id) : "";
            return `
              <div class="comp-cell ${ok ? "unlocked" : "locked"}" data-tip="${escTip(ok ? lw.name : "未悟法则", ok ? (lw.desc + (liveNote ? "｜" + liveNote : "")) : "渡劫破境或切开鸿蒙原石参悟")}">
                <img src="${ART[LAW_ICONS[lw.id] || "icon_blade"]}" alt="${lw.name}" />
                <strong style="font-size:11px;color:${ok ? "#70ffe6" : "var(--text-sub)"};">${ok ? lw.name : "？？？"}</strong>
                <span style="font-size:9.5px;color:var(--text-sub);">${lw.rarity}法则</span>
              </div>`;
          }).join("")}
        </div>`;
    } else if (currentSysTab === "achievements") {
      tabBody = `
        <div style="display:flex;flex-direction:column;gap:6px;max-height:255px;overflow-y:auto;padding-right:4px;">
          ${ACHIEVEMENTS.map(ach => {
            const done = game && game.achievements.includes(ach.id);
            const claimed = game && game.claimedAchievements && game.claimedAchievements.includes(ach.id);
            const rewardStones = Math.round(ach.pts * 0.5);
            return `
              <div class="visual-tile ${done ? "equipped" : ""}" style="justify-content:space-between;">
                <div>
                  <strong style="font-size:12.5px;color:${done ? "var(--gold-bright)" : "var(--text-sub)"};">${done ? "★ " : ""}${ach.name}</strong>
                  <div style="font-size:11px;color:var(--text-sub);">${ach.desc}</div>
                </div>
                ${done && !claimed
                  ? `<button class="btn-gold" style="padding:4px 12px;font-size:11px;" data-claim-ach="${ach.id}">领 ${rewardStones} 石</button>`
                  : `<span class="tag-chip ${claimed ? "done" : ""}">${claimed ? "已领赏" : `+${rewardStones}石`}</span>`}
              </div>`;
          }).join("")}
        </div>`;
    } else if (currentSysTab === "accessibility") {
      const totalArtCount = Object.keys(ART).length;
      tabBody = `
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <strong style="font-size:12.5px;color:var(--gold-bright);">♿ 主机 3A 无障碍高对比定制与打击感精调台</strong>
          <span class="tag-chip mythic">🎨 已封装 ${totalArtCount} 项精洗去底 WebP 典藏资产</span>
        </div>
        <div class="a11y-panel-grid">
          <div class="a11y-row">
            <div>
              <strong style="font-size:12px;color:#e6f4f1;">镜头震屏幅度 (Screen Shake)</strong>
              <div style="font-size:10px;color:var(--text-sub);">调节受击、重劈、破势与雷劫的屏幕震动强度（0% 防眩晕 ~ 150% 狂暴体感）</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <input id="rng-a11y-shake" class="a11y-slider" type="range" min="0" max="150" step="5" value="${Math.round(a11ySettings.shakeScale * 100)}" />
              <strong id="lbl-a11y-shake" style="min-width:42px;text-align:right;color:#70ffe6;font-size:12px;">${Math.round(a11ySettings.shakeScale * 100)}%</strong>
            </div>
          </div>
          <div class="a11y-row">
            <div>
              <strong style="font-size:12px;color:#e6f4f1;">刀剑顿帧强度 (Hitstop Freeze)</strong>
              <div style="font-size:10px;color:var(--text-sub);">调节肉质命中、识破剑反与处决瞬间的卡肉顿帧时长（0% 丝滑无停顿 ~ 150% 重刀入骨）</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <input id="rng-a11y-hitstop" class="a11y-slider" type="range" min="0" max="150" step="5" value="${Math.round(a11ySettings.hitStopScale * 100)}" />
              <strong id="lbl-a11y-hitstop" style="min-width:42px;text-align:right;color:#ffe28a;font-size:12px;">${Math.round(a11ySettings.hitStopScale * 100)}%</strong>
            </div>
          </div>
          <div class="a11y-row">
            <div>
              <strong style="font-size:12px;color:#e6f4f1;">四色危招色盲高对比几何符文 (Colorblind Perilous Symbols)</strong>
              <div style="font-size:10px;color:var(--text-sub);">在敌方蓄力头顶附加高对比几何符文框：◆【金·反】 / ▲【红·闪】 / 〰【青·跃】 / ⬢【擒·拼】</div>
            </div>
            <button type="button" id="btn-a11y-cb" class="btn-jade" style="padding:5px 14px;font-size:11.5px;" data-action="toggle-a11y-cb">${a11ySettings.colorblindGlyphs ? "已开启 ✓" : "已关闭"}</button>
          </div>
          <div class="a11y-row">
            <div>
              <strong style="font-size:12px;color:#e6f4f1;">自动连招与切手派生辅助 (Auto-Combo Assist)</strong>
              <div style="font-size:10px;color:var(--text-sub);">开启后按住攻击即可自动衔接四段连舞与切手重击派生，降低高频连点负担</div>
            </div>
            <button type="button" id="btn-a11y-autocombo" class="btn-ghost ${a11ySettings.autoComboAssist ? "active-pill" : ""}" style="padding:5px 14px;font-size:11.5px;" data-action="toggle-a11y-autocombo">${a11ySettings.autoComboAssist ? "已开启 ✓" : "已关闭"}</button>
          </div>
          <div class="a11y-row">
            <div>
              <strong style="font-size:12px;color:#e6f4f1;">减弱动态效果 (Reduced Motion)</strong>
              <div style="font-size:10px;color:var(--text-sub);">遵循系统 prefers-reduced-motion 或手动开启：关闭震屏、顿帧、定格帧与视差动效</div>
            </div>
            <button type="button" id="btn-a11y-reduced-motion" class="btn-ghost ${a11ySettings.reducedMotion ? "active-pill" : ""}" style="padding:5px 14px;font-size:11.5px;" data-action="toggle-a11y-reduced-motion">${a11ySettings.reducedMotion ? "已开启 ✓" : "已关闭"}</button>
          </div>
          <div class="a11y-row">
            <div>
              <strong style="font-size:12px;color:#e6f4f1;">首卷分层景深与前景氛围 (Enhanced Visual Layers)</strong>
              <div style="font-size:10px;color:var(--text-sub);">开启破庙/洞府远中近三层景深光雾与边角竹影（绝不遮挡敌方危招，减弱动态下自动静止）</div>
            </div>
            <button type="button" id="btn-a11y-visual-layers" class="btn-ghost ${a11ySettings.enhancedVisualLayers ? "active-pill" : ""}" style="padding:5px 14px;font-size:11.5px;" data-action="toggle-a11y-visual-layers">${a11ySettings.enhancedVisualLayers ? "已开启 ✓" : "已关闭"}</button>
          </div>
          <div class="a11y-row">
            <div>
              <strong style="font-size:12px;color:#e6f4f1;">战斗提示密度 (Combat Notice Level)</strong>
              <div style="font-size:10px;color:var(--text-sub);">完整（战中保留战报提示，仍遵守安全弹窗门控）/ 精简（默认，次要战报清场汇总）/ 极简（隐藏处决文字与素材飘字，始终保留危招与存档警示）</div>
            </div>
            <div class="combat-notice-seg" role="group" aria-label="战斗提示密度">
              <button type="button" id="btn-notice-level-full" class="${a11ySettings.combatNoticeLevel === "full" ? "btn-jade" : "btn-ghost"}" data-set-notice-level="full">完整</button>
              <button type="button" id="btn-notice-level-lite" class="${a11ySettings.combatNoticeLevel === "lite" ? "btn-jade" : "btn-ghost"}" data-set-notice-level="lite">精简</button>
              <button type="button" id="btn-notice-level-minimal" class="${a11ySettings.combatNoticeLevel === "minimal" ? "btn-jade" : "btn-ghost"}" data-set-notice-level="minimal">极简</button>
            </div>
          </div>
        </div>
        <div style="margin-top:6px;border-top:1px solid rgba(216,179,106,0.22);padding-top:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:12px;color:var(--gold-bright);">🎵 九韶仙音 · 五轨分轨动态混音台 (0% ~ 150%)</strong>
            <button type="button" id="btn-test-stems" class="btn-ghost" style="padding:2px 9px;font-size:10.5px;" data-action="test-jiushao-stems">🔔 试听九韶合奏</button>
          </div>
          <div class="stem-mixer-grid">
            ${[
              ["guqin",  "古琴主奏", Sound.stems.guqin],
              ["chime",  "编钟金石", Sound.stems.chime],
              ["drum",   "战鼓低频", Sound.stems.drum],
              ["blade",  "刀剑打击", Sound.stems.blade],
              ["reverb", "峡谷混响干湿比", Sound.stems.reverb]
            ].map(([sk, slbl, sval]) => `
              <div class="stem-cell">
                <span style="font-size:11px;color:#dff7f2;">${slbl}</span>
                <div style="display:flex;align-items:center;gap:5px;">
                  <input id="rng-stem-${sk}" data-stem-key="${sk}" class="stem-slider" type="range" min="0" max="150" step="5" value="${Math.round(sval * 100)}" />
                  <strong id="lbl-stem-${sk}" style="min-width:34px;text-align:right;font-size:10.5px;color:#ffe28a;">${Math.round(sval * 100)}%</strong>
                </div>
              </div>
            `).join("")}
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:6px;border-top:1px dashed rgba(112,255,230,0.22);gap:8px;flex-wrap:wrap;">
            <span style="font-size:10.5px;color:var(--text-sub);">📋 试玩观察辅助（纯内存采样，绝不写入玩家存档）</span>
            <button type="button" id="btn-export-playtest-telemetry" class="btn-ghost" style="padding:3px 10px;font-size:10.5px;" data-action="export-playtest-telemetry">导出本次试玩观察数据 (JSON)</button>
          </div>
        </div>`;
    } else {
      const padStatus = GamepadSystem.connectedName ? `🎮 已连接手柄 (${escapeHtml(safeText(GamepadSystem.connectedName, "").slice(0, 20))})` : "🎮 支持 W3C 手柄即插即用与双马达震动";
      tabBody = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:11.5px;color:var(--jade);font-weight:700;">${padStatus} · 140ms 动作预输入已启用</span>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn-ghost" style="padding:3px 9px;font-size:11px;" data-action="toggle-rumble">手柄震动：${rumbleEnabled ? "开启" : "关闭"}</button>
            <button type="button" class="btn-ghost" style="padding:3px 9px;font-size:11px;" data-action="reset-keybinds">↺ 恢复默认键位</button>
          </div>
        </div>
        ${lastKeybindConflictMsg ? `<div class="kb-conflict-banner">${escapeHtml(lastKeybindConflictMsg)}</div>` : ""}
        ${(() => {
          const tiers = [
            { title: "一 · 核心动作（凡人起步 6 键）", sub: "WASD 移动 · 左/右键挥剑爆印 · 空格一闪 · Q 仙葫 · B 吐纳渡劫 · H 洞府", acts: ["slash", "recall", "dash", "pill", "meditate", "hub"] },
            { title: "二 · 进阶战技（炼气 / 筑基解封）", sub: "随境界逐步解封 · 剑阵/跃破/剑域/助阵/双姿态/魂印/奥义", acts: ["stance", "jump", "ult", "ally", "pet", "posture", "soul", "swordBlink", "finisher", "tagSwitch"] },
            { title: "三 · 高阶神通与系统快捷键（金丹+ / 绘卷）", sub: "J/U/7 金丹 · 4/O/8/L 元婴 · 5/6 化神 · M 舆图 · T 目标 · N 星图", acts: ["astral", "mount", "qimen", "photo", "telemetry"] }
          ];
          const renderRow = (act) => {
            const cfg = keybinds[act];
            if (!cfg) return "";
            const listening = rebindListeningAction === act;
            const kbTxt = cfg.mouseLabel && cfg.kb === DEFAULT_KEYBINDS[act].kb ? `${cfg.mouseLabel}/${formatKeyCodeShort(cfg.kb)}` : formatKeyCodeShort(cfg.kb);
            return `<div class="kb-row">
              <span style="font-size:11.5px;color:#e6f4f1;">${escapeHtml(cfg.label)}</span>
              <button type="button" class="kb-cap-btn ${listening ? "listening" : ""}" data-rebind-act="${act}">
                ${listening ? "请按键/手柄..." : `${escapeHtml(kbTxt)} · 🎮${escapeHtml(cfg.padGlyph || "未绑")}`}
              </button>
            </div>`;
          };
          return `<div style="max-height:215px;overflow-y:auto;padding-right:4px;">${tiers.map(tr => `
            <div class="kb-tier-hdr">${tr.title}<span>${tr.sub}</span></div>
            <div class="keybind-grid">${tr.acts.map(renderRow).join("")}</div>
          `).join("")}</div>`;
        })()}
        <div class="jade-card" style="padding:7px 10px;gap:5px;margin-top:4px;border-color:${sandboxMode ? "rgba(255,190,92,0.55)" : "rgba(128,255,234,0.45)"};">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong style="font-size:11.5px;color:${sandboxMode ? "#ffd8a8" : "#80ffea"};">☁ 太虚大道云码（全存档 Base64 一键导出备份与跨端导入恢复）：</strong>
            <span id="lbl-cloud-save-status" style="font-size:10px;color:${sandboxMode ? "#ffd8a8" : "var(--gold-bright)"};">${sandboxMode ? "🧪 演武沙盒模式已禁用云码导出与导入（请先退出沙盒）" : "校验就绪 ✓"}</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <input id="inp-cloud-save-code" class="cloud-code-box" type="text" value="${sandboxMode ? "" : exportFullCloudSaveCode()}" placeholder="${sandboxMode ? "演武沙盒模式已禁用云码导出与导入（请先退出沙盒）" : ""}" aria-label="太虚大道云码" ${sandboxMode ? "disabled" : ""} />
            <button type="button" id="btn-export-cloud-save" class="btn-ghost" style="padding:5px 10px;font-size:11px;white-space:nowrap;" data-action="copy-cloud-save" ${sandboxMode ? "disabled" : ""}>📋 复制云码</button>
            <button type="button" id="btn-import-cloud-save" class="btn-gold" style="padding:5px 12px;font-size:11px;white-space:nowrap;" data-action="import-cloud-save" ${sandboxMode ? "disabled" : ""}>📥 导入恢复</button>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding-top:4px;">
          <span style="font-size:11px;color:var(--text-sub);">改键自动冲突检测互换并持久化保存（第 ${(Number(metaState.ascensions) || 0) + 1} 世 · 最高 ${Number(metaState.bestScore) || 0} 分）</span>
          <div style="display:flex;gap:6px;align-items:center;">
            <button type="button" class="btn-ghost" data-action="return-title-safe">保存并返回标题主菜单</button>
            <button type="button" class="btn-ghost" style="border-color:rgba(255,118,110,0.55);color:#ffb4ae;" data-action="confirm-reset-save">清空当前存档</button>
          </div>
        </div>`;
    }

    openModal(`
      <div class="drawer-mural-banner" style="height:84px;">
        <img src="${ART.banner_relic}" alt="仙途宝鉴" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">仙途宝鉴</span>
            <h3 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:4px;">万象图鉴 · 仙途成就 · 御剑指南</h3>
          </div>
          <button class="btn-ghost" data-modal-close="1">返回道场 ✕</button>
        </div>
      </div>

      <div class="sys-tab-bar">
        <button class="btn-ghost ${currentSysTab === "compendium" ? "active-pill" : ""}" data-sys-tab="compendium">📖 万象图鉴</button>
        <button class="btn-ghost ${currentSysTab === "achievements" ? "active-pill" : ""}" data-sys-tab="achievements">🏆 仙途成就</button>
        <button class="btn-ghost ${currentSysTab === "controls" ? "active-pill" : ""}" data-sys-tab="controls">⌨ 键位与主菜单</button>
        <button class="btn-ghost ${currentSysTab === "accessibility" ? "active-pill" : ""}" data-sys-tab="accessibility">♿ 无障碍与手感</button>
      </div>

      ${tabBody}

      <div style="border-top:1px solid var(--border-subtle);padding-top:8px;">
        <div style="font-size:11px;color:var(--text-sub);margin-bottom:5px;">演武试剑台（点击后确认进入隔离【演武沙盒模式】，不污染正式存档）：</div>
        <div class="grid-3">
          <button class="visual-tile" style="padding:7px;" data-preset="judge_showcase">
            <img src="${ART.arena_secret}" alt="诛仙剑阵" style="object-fit:cover;width:36px;height:36px;" />
            <div><strong style="color:var(--gold-bright);font-size:11.5px;">诛仙双羁绊卷</strong><div style="font-size:10px;color:var(--jade);">金丹·11剑三轮</div></div>
          </button>
          <button class="visual-tile" style="padding:7px;" data-preset="golden">
            <img src="${ART.arena_sect}" alt="巨阙破阵" style="object-fit:cover;width:36px;height:36px;" />
            <div><strong style="color:var(--gold-bright);font-size:11.5px;">巨阙斩妖王卷</strong><div style="font-size:10px;color:var(--jade);">巨阙·一剑开天</div></div>
          </button>
          <button class="visual-tile" style="padding:7px;" data-preset="tribulation">
            <img src="${ART.arena_terrace}" alt="九霄终劫" style="object-fit:cover;width:36px;height:36px;" />
            <div><strong style="color:var(--gold-bright);font-size:11.5px;">九霄叩天门卷</strong><div style="font-size:10px;color:var(--jade);">化神·15剑渡劫</div></div>
          </button>
        </div>
      </div>
    `, true);
    if (currentSysTab === 'compendium') setTimeout(() => startCodexLiveLoop(), 30);
  }

  function applyStagePreset(preset, opts = {}) {
    if (!sandboxMode && !(opts && opts.insideSandbox)) {
      openSandboxConfirmModal("preset", preset);
      return;
    }
    if (!game) game = createFreshGame("顾长青", "sword_bone");
    game.unlockAllArcana = true;
    resetStageTransitionState();
    closeModal();
    closeDrawer();
    game.openingChoice = "help";
    game.aids.shen = true;
    game.seenCutscenes = { opening_scroll: true, prologue_rescue: true, enter_sect: true, enter_secret: true, enter_sword_mound: true, enter_terrace: true };
    game.choices = { shen_return: "warm", pei_meet: "cooperate", lu_intro: "listen" };
    if (preset === "judge_showcase") {
      game.realm = "golden";
      game.status = "active";
      game.ending = null;
      game.statMultBonus = 1.35;
      game.bonusSwords = 2;
      game.destinyFruits = ["sword_twin", "thunder_soul"];
      game.unlockedSouls = ["blood_warden", "frost_phoenix", "sword_fiend", "thunder_lord", "taixu_demon"];
      game.equippedSoul = "thunder_lord";
      game.bonusStarPts = 6;
      game.aids.pei = true;
      game.aids.lu = true;
      game.aids.yan = true;
      game.weaponForm = game.weaponForm || "sword";
      game.stageStars = { 0: 3, 1: 3, 2: 2 };
      game.defeatedStageBosses = { 0: true, 1: true, 2: true };
      game.goalStats = { kills: 14, techBreaks: 3, craftOrLoot: 3 };
      game.laws = ["wanjian", "void_haste", "yinyang", "thunder_body"];
      game.pet = { id: "sword_spirit", level: 4, skills: { tier3: "fury_fang", tier5: null } };
      game.loadout.relic = "frost_sword";
      game.ownedRelics = ["frost_sword"];
      game.relicStars = { frost_sword: 3 };
      game.equippedGear = {
        weapon: rollGearItem(2, 3, "weapon"),
        armor: rollGearItem(2, 3, "armor"),
        ring: rollGearItem(2, 2, "ring")
      };
      game.stones = 680;
      game.inventory.healing_pill = 6;
      game.towerFloor = 4; game.towerBest = 3;
      const st = getCombatStats(game); game.hp = st.maxHp; game.mp = st.maxMp;
      arena.stanceIdx = 0;
      initArenaStage(2, false);
      showToast("🧪 演武沙盒已载入【诛仙双羁绊卷】预设（不影响正式存档）！");
    } else if (preset === "golden") {
      game.realm = "foundation";
      game.status = "active";
      game.ending = null;
      game.defeatedStageBosses = { 0: true, 1: true };
      game.bonusSwords = 2;
      game.laws = ["crit_lotus", "stagger_surge", "wanjian"];
      game.pet = { id: "turtle", level: 3, skills: { tier3: "spirit_ward", tier5: null } };
      game.loadout.relic = "jade_seal";
      game.ownedRelics = ["jade_seal"];
      game.relicStars = { jade_seal: 2 };
      const st = getCombatStats(game); game.hp = st.maxHp; game.mp = st.maxMp;
      arena.stanceIdx = 2;
      initArenaStage(1, false);
      arena.enemies = [];
      arena.waveIdx = 3;
      spawnCurrentWave();
      showToast("🧪 演武沙盒已载入【巨阙斩妖王卷】预设（不影响正式存档）！");
    } else if (preset === "tribulation") {
      game.realm = "spirit";
      game.status = "active";
      game.ending = null;
      game.stageStars = { 0: 3, 1: 3, 2: 3, 3: 3 };
      game.defeatedStageBosses = { 0: true, 1: true, 2: true, 3: true };
      game.statMultBonus = 1.5;
      game.bonusSwords = 4;
      game.laws = ["wanjian", "yinyang", "void_haste", "crit_lotus", "thunder_body", "stagger_surge"];
      game.pet = { id: "roc", level: 5, skills: { tier3: "swift_bond", tier5: "celestial_wrath" } };
      game.loadout.relic = "frost_sword";
      game.ownedRelics = ["frost_sword"];
      game.relicStars = { frost_sword: 5 };
      game.equippedGear = {
        weapon: rollGearItem(4, 4, "weapon"),
        armor: rollGearItem(4, 4, "armor"),
        ring: rollGearItem(4, 4, "ring")
      };
      game.xp = REALMS.spirit.xpCap;
      const st = getCombatStats(game); game.hp = st.maxHp; game.mp = st.maxMp;
      arena.stanceIdx = 1;
      initArenaStage(4, false);
      showToast("🧪 演武沙盒已载入【九霄叩天门卷】预设（不影响正式存档）！");
    }
    updateHud(true);
    renderHudSaveAlert();
  }

  function renderWelcomeScreen() {
    const saveRes = inspectSavedBundle();
    inspectMetaState({ applyToMemory: true });
    loadedSaveRev = saveRes.ok ? saveRes.rev : 0;
    document.getElementById("btn-continue-save").style.display = saveRes.ok ? "inline-flex" : "none";
    renderWelcomeSaveStatusBanner();
    renderHudSaveAlert();
    renderPropInteractHud();
    document.getElementById("welcome-screen").style.backgroundImage = `url(${ART.hero_aaa_keyart})`;
    document.getElementById("hud-avatar").src = ART.char_player;
    document.getElementById("stage-bg-img").src = ART.arena_wilderness;
    document.getElementById("stage-pet-img").src = ART.pet_fox;
    document.getElementById("enemy-battle-sprite").src = ART.enemy_wolf;
    document.getElementById("orb-img-slash").src = ART.icon_blade;
    const slImg0 = document.getElementById("orb-img-soul"); if (slImg0) slImg0.src = ART.spirit_seal_emblem;
    const aIco0 = document.getElementById("img-astral-ico"); if (aIco0) aIco0.src = ART.avatar_taiqing_immortal;
    const mIco0 = document.getElementById("img-mount-ico"); if (mIco0) mIco0.src = ART.mount_ink_qilin;
    const qIco0 = document.getElementById("img-qimen-ico"); if (qIco0) qIco0.src = ART.vfx_qimen_bagua_dial;
    const stImg = document.getElementById("orb-img-stance");
    if (stImg) stImg.src = ART.icon_blade;
    document.getElementById("orb-img-recall").src = ART.relic_frost_sword;
    document.getElementById("orb-img-dash").src = ART.icon_seal;
    const medImg = document.getElementById("orb-img-meditate");
    if (medImg) medImg.src = ART.char_player_seated;
    document.getElementById("orb-img-ult").src = ART.relic_soul_lamp;
    const finImg0 = document.getElementById("orb-img-finisher"); if (finImg0) finImg0.src = ART.item_ascension_seal;
    const supImg0 = document.getElementById("style-ult-portrait"); if (supImg0) supImg0.src = ART.char_player;
    syncPostureBadgeHud();
    syncSkillOrbKeyCaps();
    document.getElementById("orb-img-ally").src = ART.char_shen;
    document.getElementById("orb-img-pill").src = ART.item_immortal_gourd;
    const jmpImg0 = document.getElementById("orb-img-jump"); if (jmpImg0) jmpImg0.src = ART.vfx_sky_meteor_plunge;
    const blkImg0 = document.getElementById("orb-img-blink"); if (blkImg0) blkImg0.src = ART.relic_frost_sword;

    ensureMetaState();
    const legEl = document.getElementById("legacy-summary-badge");
    const towEl = document.getElementById("best-tower-badge");
    const calBestEl = document.getElementById("best-calamity-badge");
    const hallBtn = document.getElementById("btn-welcome-hall");
    if (legEl) legEl.textContent = `第 ${(metaState.ascensions || 0) + 1} 世`;
    if (towEl) towEl.textContent = `镇妖塔 ${metaState.bestTower || 0}层`;
    if (calBestEl) calBestEl.textContent = metaState.bestCalamityTier > 0 ? `最高劫火 ×${metaState.bestCalamityTier}` : (metaState.ascensions >= 1 ? "劫火已解封" : "飞升启劫火");
    if (hallBtn) hallBtn.textContent = `🏛 历世道果殿堂${(metaState.hallOfLives || []).length > 0 ? ` (${metaState.hallOfLives.length} 世)` : ""}`;

    const curPerkSpec = PERKS.find(p => p.id === selectedPerkId);
    if (!curPerkSpec || !isPerkUnlocked(curPerkSpec)) {
      selectedPerkId = "sword_bone";
    }
    if (!isCalamityTierUnlocked(selectedCalamityTier)) {
      selectedCalamityTier = 0;
    }

    document.getElementById("welcome-perk-grid").innerHTML = PERKS.map(p => {
      const unlocked = isPerkUnlocked(p);
      return `
        <button type="button" class="perk-card ${selectedPerkId === p.id ? "selected" : ""}" data-perk="${p.id}" data-tip="${escTip(p.name, p.desc)}" ${!unlocked ? "disabled" : ""}>
          <strong>${unlocked ? "" : "🔒 "}${p.name}</strong>
          <div style="font-size:10px;margin-top:2px;opacity:0.82;">${unlocked ? p.badge : (p.unlockText || "飞升解锁")}</div>
        </button>`;
    }).join("");

    const calBox = document.getElementById("welcome-calamity-box");
    if (calBox) {
      const activeCal = getCalamityCycleSpec(selectedCalamityTier);
      calBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;flex-wrap:wrap;gap:6px;">
          <strong style="color:#ffb4a8;">🔥 高阶【劫火周目】难度选择（飞升 1 世开启）</strong>
          <span style="color:#ffe28a;">当前：${activeCal.name}</span>
        </div>
        <div class="calamity-tier-grid">
          ${CALAMITY_CYCLES.map(c => {
            const ok = isCalamityTierUnlocked(c.tier);
            const sel = selectedCalamityTier === c.tier;
            return `<button type="button" class="calamity-tier-btn ${sel ? "active" : ""}" data-calamity-tier="${c.tier}" data-tip="${escTip(c.name, c.desc)}" ${!ok ? "disabled" : ""}>
              <strong style="color:${sel ? "#ffe28a" : "#e6f4f1"};">${ok ? (c.tier > 0 ? "🔥 " : "☯ ") : "🔒 "}${c.short}</strong>
              <span style="font-size:9.3px;color:#b8d4ce;">${ok ? c.desc : `飞升 ${c.reqAsc} 世解锁`}</span>
            </button>`;
          }).join("")}
        </div>
      `;
    }
  }

  function isTypingTarget(target) {
    if (!target || target.nodeType !== 1) return false;
    const tag = target.tagName;
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag === "INPUT") {
      const type = (target.getAttribute("type") || "text").toLowerCase();
      return !["button", "submit", "reset", "checkbox", "radio", "image"].includes(type);
    }
    if (target.isContentEditable) return true;
    return !!(target.closest && target.closest("[contenteditable=''], [contenteditable='true']"));
  }
