  // ==================== 9. DAMAGE, LOOT BEAMS, BRANCHING ROOMS & 60FPS STEP ====================
  function damageEnemy(e, rawDmg, forceCrit = false, postureDmg = 10, hitAng = null, knockImpulse = 4.0, isHeavySkill = false) {
    if (!e || e.hp <= 0 || !game) return;
    const st = getCombatStats(game);
    const isHeavyBreak = isHeavySkill || arena.weaponPosture === "xuanzhong" || !!e.switchBreakHit;
    const activePylons = (e.isBoss || e.isDummy) ? arena.props.filter(pr => pr.kind === "ward_pylon" && pr.hp > 0) : [];
    if (activePylons.length > 0) {
      rawDmg = Math.round(rawDmg * 0.45);
      postureDmg = Math.round(postureDmg * 0.55);
    }

    // V17 Boss Rush Affix 【唯识破防】
    if (arena.bossRush && arena.bossRush.active && arena.rushAffixes.includes("rush_parry_only") && !isHeavyBreak && e.state !== "stun") {
      rawDmg = Math.max(1, Math.round(rawDmg * 0.25));
      postureDmg = Math.round(postureDmg * 0.30);
    }

    // V17 Inner Demon Parry Stance (`心魔识破架势`: deflects light spam unless broken by Heavy Posture / Switch-Slash!)
    if (e.isInnerDemon && (e.demonParryTimer || 0) > 0) {
      if (isHeavyBreak) {
        e.demonParryTimer = 0;
        Sound.shieldBreakSub();
        spawnDistortionRing(e.x, e.y, 145, "#ffd278");
        addFloat("💥 巨阙破除心魔剑反架势！", e.x, e.y - 78, "#ffd278", 18, true);
        postureDmg = Math.round(postureDmg * 1.8);
      } else {
        e.demonParryTimer = 0.2;
        Sound.deflectClang();
        spawnSparks(e.x, e.y - 12, 12, hitAng || 0, 2.4, "#d69eff");
        addFloat("⚡ 心魔识破弹反！切`玄重巨阙破架势！", e.x, e.y - 74, "#e2b8ff", 15, true);
        return;
      }
    }

    // V17 Tactical Frontline Shield-Vanguard Directional Block vs Heavy Shatter (`架盾妖卫`)
    if ((e.frontShieldHp || 0) > 0) {
      const atkFromAng = Math.atan2(arena.player.y - e.y, arena.player.x - e.x);
      const faceDiff = Math.abs(Math.atan2(Math.sin(atkFromAng - (e.shieldFacing || 0)), Math.cos(atkFromAng - (e.shieldFacing || 0))));
      const hitFront = faceDiff < 1.32; // ~75 deg frontal shield cone
      if (hitFront && !isHeavyBreak) {
        Sound.shieldAbsorb("enemy");
        spawnSparks(e.x + Math.cos(atkFromAng) * 24, e.y - 8, 8, atkFromAng, 1.8, "#ffe28a");
        const shieldHint = isActionUnlockedByRealm(game, "posture")
          ? "🛡 正面玄盾格挡! 按`切巨阙破盾或绕背!"
          : "🛡 正面玄盾格挡! 用【右键爆剑】或绕背破防!";
        addFloat(shieldHint, e.x, e.y - e.r - 22, "#ffe28a", 13.5, true);
        rawDmg = Math.max(1, Math.round(rawDmg * 0.22));
        postureDmg = 2;
        knockImpulse = 0.5;
      } else if (hitFront && isHeavyBreak) {
        e.frontShieldHp = Math.max(0, e.frontShieldHp - Math.max(18, Math.round(postureDmg * 1.65)));
        if (e.frontShieldHp <= 0) {
          Sound.shieldBreakSub();
          GamepadSystem.rumble(0.82, 0.72, 160);
          spawnDistortionRing(e.x, e.y, 155, "#ffb84d");
          e.state = "stun"; e.timer = 2.6; e.posture = e.maxPosture;
          addFloat("💥 崩甲破盾！！架势溃散！", e.x, e.y - e.r - 34, "#ffcc66", 20, true);
        }
      } else if (!hitFront) {
        addFloat("★ 绕背破防暴击！", e.x, e.y - e.r - 20, "#70ffe6", 14, true);
        forceCrit = true;
      }
    }

    // V17 Airborne / Wall-Splat Aerial Juggle Pursuit (`凌空追击`)
    if ((e.airborneZ || 0) > 6) {
      rawDmg = Math.round(rawDmg * 1.45);
      e.airborneVz = Math.max(e.airborneVz || 0, 2.3);
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 5);
      if (Math.random() < 0.45) addFloat("✦ 凌空追击 +45%!", e.x, e.y - e.r - 36 - e.airborneZ, "#70ffe6", 15, true);
    }

    // V17 Boss Weakpoint Core Part-Break (`本命妖丹 / 护法阵核部位破坏`)
    if (e.isBoss && !e.partSevered && (e.partHp || 0) > 0 && (e.weakpointExposed || e.state === "windup" || e.state === "stun" || e.enraged)) {
      const yanPartAmp = hasKeepsake(game, "yan") ? 1.30 : 1.0;
      const partChip = Math.round(((isHeavyBreak ? rawDmg * 1.15 : rawDmg * 0.42) + postureDmg * (isHeavyBreak ? 1.8 : 0.6)) * yanPartAmp);
      e.partHp = Math.max(0, e.partHp - partChip);
      if (e.partHp <= 0) {
        severBossWeakpoint(e, st);
      }
    }

    if (e.mirrorTimer > 0 && !isHeavySkill) {
      Sound.clang(1.5, 0.08);
      spawnSparks(e.x, e.y - 12, 6, hitAng || 0, 2.0, "#ffe28a");
      addFloat("镜反! 用空格一闪/爆剑破镜", e.x, e.y - e.r - 14, "#ffe28a", 13);
      rawDmg = Math.round(rawDmg * 0.35);
    }

    if ((e.wardHp || 0) > 0) {
      const wChip = isHeavySkill ? postureDmg * 1.5 : postureDmg * 0.55;
      e.wardHp = Math.max(0, e.wardHp - wChip);
      if (!isHeavySkill) {
        Sound.shieldAbsorb("enemy");
        rawDmg = Math.round(rawDmg * 0.55);
      }
      if (e.wardHp <= 0) {
        Sound.shieldBreakSub();
        arena.shake = 11;
        spawnSparks(e.x, e.y, 20, 0, 6.28, "#ffe28a");
        arena.slashes.push({ x: e.x, y: e.y, r: e.r + 75, ang: 0, t: 0, color: "#ffe28a", heavy: true });
        addFloat("★ 护山金阵击碎！", e.x, e.y - e.r - 28, "#ffe28a", 20, true);
        e.posture = 0;
      }
    }

    if (hasGearAffix(game, "posture_crush")) postureDmg = Math.round(postureDmg * 1.30);
    if (st.daoBonuses && st.daoBonuses.postureMult > 1.0) postureDmg = Math.round(postureDmg * st.daoBonuses.postureMult);
    // V19 3-State Differentiated Dynamic Execution Camera & Finishers (`万剑穿心` vs `开山断岳` vs `天外飞仙`)!
    let execBonus = 1.0;
    const coopReadyForExec = !!(arena.coop2P && arena.coop2P.active && !arena.coop2P.downed && Math.hypot(e.x - arena.coop2P.x, e.y - arena.coop2P.y) < 320);
    if (e.state === "stun" && !e.executedThisStun && (isHeavyBreak || coopReadyForExec) && Math.hypot(e.x - arena.player.x, e.y - arena.player.y) < 225) {
      e.executedThisStun = true;
      const pEx = arena.player;
      const tigerExecAmp = hasStarCore(game, "white_tiger") ? 1.35 : 1.0;
      const isAerialExec = (pEx.z || 0) > 12 || pEx.plunging;
      const isHeavyExec = !isAerialExec && arena.weaponPosture === "xuanzhong";
      arena.stageTechDone = true;
      if (!isPracticeModeActive() && !isSanctumDojoActive() && game.goalStats) game.goalStats.techBreaks = (game.goalStats.techBreaks || 0) + 1;
      game.mp = Math.min(st.maxMp, (game.mp || 0) + 22);
      Sound.triggerDucking(340, 0.22, 1250);
      GamepadSystem.rumble(1.0, 0.95, 290);
      arena.currentDmgBucket = "deflect_ult";
      registerStyleAction("execution", 180);
      arena.camFocusX = e.x;
      arena.camFocusY = e.y - 16;
      arena.camFocusT = 0.72;

      if (coopReadyForExec) {
        // V23 Co-Op Exclusive: 【双人同步斩仙处决 (双剑诛仙)】
        const c2 = arena.coop2P;
        const sp2 = PLAYABLE_COMPANIONS[c2.partnerId] || PLAYABLE_COMPANIONS.shen;
        execBonus = 2.05 * tigerExecAmp;
        arena.lastCoopExecMult = 2.05;
        arena.camZoom = 1.18;
        arena.shake = 22;
        pEx.x = e.x - 62; pEx.y = e.y + 8; pEx.facing = 1;
        c2.x = e.x + 62;  c2.y = e.y + 8; c2.facing = -1;
        triggerImpactFrame(4, "#ffe28a", e.x, e.y - 20);
        triggerRadialChromaticBurst(1.45, sp2.color, e.x, e.y - 14);
        pushBladeArc(e.x, e.y - 8, 0.45, 195, "#70ffe6", 1, true);
        pushBladeArc(e.x, e.y - 8, Math.PI - 0.45, 195, sp2.color, -1, true);
        spawnDistortionRing(e.x, e.y, 260, "#ffe28a");
        triggerKillCamStamp("双剑诛仙");
        registerStyleAction("coop_exec", 220);
        pushTelemetryInput(`👥双人同步处决·${sp2.name}!`, false);
        addFloat(`👥 双人同步斩仙处决 ·【双剑诛仙】！！`, e.x, e.y - e.r - 52, "#fff2a8", 25, true);
        captureBattleHighlightFrame("双剑诛仙", `1P×${sp2.name} 双人同步处决`, Math.round(rawDmg * 2.05), 5);
      } else if (isAerialExec) {
        // State 3 (Aerial): 【天外飞仙 · 落星贯日刺】
        execBonus = 1.80 * tigerExecAmp;
        arena.camZoom = 1.17;
        triggerImpactFrame(3, "#38f9d7", e.x, e.y - 26);
        arena.meteorBursts.push({ x: e.x, y: e.y + 8, r: 168, t: 0 });
        spawnDistortionRing(e.x, e.y, 235, "#80ecff");
        triggerKillCamStamp("天外飞仙");
        pushTelemetryInput("☄处决·天外飞仙!", false);
        addFloat("☄ 凌空处决 · 【天外飞仙落星刺】！！", e.x, e.y - e.r - 48, "#80ecff", 24, true);
      } else if (isHeavyExec) {
        // State 2 (Xuanzhong Greatsword): 【开山断岳 · 巨阙镇魔斩】
        execBonus = 1.85 * tigerExecAmp;
        arena.camZoom = 1.16;
        arena.shake = 20;
        triggerImpactFrame(3, "#ffb84d", e.x, e.y - 16);
        addDecal(e.x, e.y + 16, 0, 96, "spider_crack");
        spawnDistortionRing(e.x, e.y, 250, "#ffb84d");
        arena.slashes.push({ x: e.x, y: e.y, r: e.r + 165, ang: Math.PI / 2, t: 0, color: "#ffb84d", heavy: true, rain: true });
        triggerKillCamStamp("开山断岳");
        pushTelemetryInput("⛰处决·开山断岳!", false);
        addFloat("⛰ 巨阙处决 · 【开山断岳镇魔斩】！！", e.x, e.y - e.r - 48, "#ffd278", 24, true);
      } else {
        // State 1 (Qinglian Swift Sword): 【万剑穿心 · 青莲诛仙诀】
        execBonus = 1.70 * tigerExecAmp;
        arena.camZoom = 1.14;
        triggerImpactFrame(3, "#e62e2d", e.x, e.y - 18);
        for (let k = 0; k < 3; k++) {
          const ka = (k * Math.PI * 2) / 3;
          pEx.afterimages.push({ x: e.x + Math.cos(ka) * 58, y: e.y + Math.sin(ka) * 34, facing: Math.cos(ka) < 0 ? 1 : -1, a: 0.95 });
        }
        e.swordMarks = 6;
        for (let q = 0; q < 6; q++) {
          arena.slashes.push({ x: e.x, y: e.y, r: e.r + 135, ang: (q * Math.PI) / 3, t: 0, color: q % 2 === 0 ? "#70ffe6" : "#ffe89e", heavy: true });
        }
        spawnDistortionRing(e.x, e.y, 215, "#70ffe6");
        triggerKillCamStamp("万剑穿心");
        pushTelemetryInput("🗡处决·万剑穿心!", false);
        addFloat("🗡 疾剑处决 · 【万剑穿心诛仙诀】！！", e.x, e.y - e.r - 48, "#70ffe6", 24, true);
      }
    }

    if (execBonus > 1.0 && st.daoBonuses && st.daoBonuses.execMult > 1.0) {
      execBonus *= st.daoBonuses.execMult;
    }
    const P = COMBAT_RULE_PARAMS;
    const brokenMult = (e.state === "stun" ? (hasLaw(game, "stagger_surge") ? P.laws.stagger_surge.enhancedStunMult : P.laws.stagger_surge.baseStunMult) : 1.0) * execBonus;
    if (arena.shanheDomain && arena.shanheDomain.active) {
      rawDmg = Math.round(rawDmg * 1.30);
      postureDmg = Math.round(postureDmg * 1.45);
    }
    const inSiGate = !!(arena.qimenArray && arena.qimenArray.active && arena.qimenArray.gate.id === "si" && (Math.hypot(arena.player.x - arena.qimenArray.x, arena.player.y - arena.qimenArray.y) < arena.qimenArray.r + 30 || Math.hypot(e.x - arena.qimenArray.x, e.y - arena.qimenArray.y) < arena.qimenArray.r + 30));
    if (inSiGate) {
      postureDmg = Math.round(postureDmg * 1.65);
      if ((e.frontShieldHp || 0) > 0) e.frontShieldHp = 0;
      if ((e.wardHp || 0) > 0) e.wardHp = Math.max(0, e.wardHp - Math.round(rawDmg * 1.0));
    }
    const celNow = getCurrentCelestialPhase();
    const celEnergyAmp = celNow.id === "noon" ? P.celestialPhases.noon.astralEnergyMult : 1.0;
    arena.astralEnergy = Math.min(100, (arena.astralEnergy || 0) + (isHeavySkill ? 5.0 : 2.2) * celEnergyAmp);
    if (celNow.id === "blood_dusk" && isHeavySkill && game) {
      game.hp = Math.min(st.maxHp, game.hp + Math.max(2, Math.round(st.maxHp * P.celestialPhases.blood_dusk.heavyHealMaxHpPct)));
    }
    const ptCombat = ensureDeterministicPity(game);
    let isCrit = forceCrit || inSiGate || (execBonus > 1.0);
    if (!isCrit) {
      const effCritRate = Math.min(0.90, st.crit + ptCombat.critAcc);
      if (Math.random() < effCritRate) {
        isCrit = true;
        ptCombat.critAcc = 0;
      } else {
        ptCombat.critAcc = Math.min(0.45, ptCombat.critAcc + Math.max(0.03, st.crit * 0.22));
      }
    } else {
      ptCombat.critAcc = 0;
    }
    const omniLv = getCurioStacks(game, "curio_hongmeng_omni");
    const effCritMult = Math.min(2.65, st.critMult + omniLv * 0.22);
    let hexGuardMult = ((e.hexBuffTimer || 0) > 0 && e.state !== "stun") ? 0.75 : 1.0;
    const aerialBoonMult = (hasRunBoon("aerial_reign") && ((arena.player.z || 0) > 10 || arena.player.plunging)) ? P.runBoons.aerial_reign.dmgMult : 1.0;
    let dmg = Math.max(1, Math.round(rawDmg * hexGuardMult * aerialBoonMult * brokenMult * (isCrit ? effCritMult : 1.0)));
    if (isCrit && getCurioStacks(game, "curio_crit_silk") > 0) {
      const critSilkBonus = Math.min(PERM_GROWTH_CAPS.curioCritSilkDmgCap, 0.18 * getCurioStacks(game, "curio_crit_silk"));
      dmg = Math.round(dmg * (1 + critSilkBonus));
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 3);
      arena.bondSynergy = Math.min(100, (arena.bondSynergy || 0) + 3);
    }
    if (execBonus > 1.2 && getCurioStacks(game, "curio_exec_reset") > 0) {
      arena.player.dashCd = 0; arena.player.blinkCd = 0; arena.soulCd = 0;
      game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.12));
    }
    e.hp -= dmg;
    if (e.isTitan) {
      applyTitanPartDamage(e, Math.round(dmg * (isHeavySkill ? 0.62 : 0.42)), arena.player.x, arena.player.y);
      if (!e.climbExecuted) e.hp = Math.max(Math.round(e.maxHp * 0.28), e.hp); // Mythic Execution Gate: Must pierce Brow Eye via Titan Climb!
    }
    if (e.isDummy && e.hp < 5000) e.hp = e.maxHp;
    recordDamageTelemetry(dmg);
    if (isSanctumDojoActive() && e.isDummy) recordDojoTrainingHit(dmg);
    const intentAmp = (hasRunBoon("blood_intent") && game.hp <= st.maxHp * P.runBoons.blood_intent.hpThreshold) ? P.runBoons.blood_intent.intentGainMult : 1.0;
    arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + (isHeavySkill ? 2.8 : 1.3) * intentAmp);
    if (aerialBoonMult > 1.0 && !e.isBoss && e.state !== "stun" && (e.poiseArmorTimer || 0) <= 0) {
      e.state = "stun";
      e.timer = Math.max(e.timer || 0, 1.15);
    }

    if (hasGearAffix(game, "vamp_blade")) {
      ptCombat.vampHits += 1;
      if (ptCombat.vampHits >= 3) {
        ptCombat.vampHits = 0;
        game.hp = Math.min(st.maxHp, game.hp + Math.max(2, Math.round(st.maxHp * 0.015)));
      }
    }
    if (hasGearAffix(game, "sky_thunder") && !isHeavySkill) {
      ptCombat.thunderHits += 1;
      if (ptCombat.thunderHits >= 4) {
        ptCombat.thunderHits = 0;
        arena.skyBolts.push({ x: e.x, y: e.y, t: 0, color: "#d69eff" });
        e.hp -= Math.round(st.atk * 0.42);
      }
    }
    e.hitFlash = 0.14;
    bumpCombo(1);
    if (isHeavySkill || isCrit) Sound.fleshHit(isHeavySkill ? 2 : 1);
    if (isHeavySkill && !e.isBoss && e.state !== "stun" && (e.poiseArmorTimer || 0) <= 0) {
      e.flinchCount = (e.flinchCount || 0) + 1;
      e.flinchTimer = Math.max(e.flinchTimer || 0, 0.20);
      if (e.flinchCount >= 2) {
        e.flinchCount = 0;
        e.poiseArmorTimer = 2.2;
        addFloat("🛡 妖躯霸体!", e.x, e.y - e.r - 18, "#ffb86b", 12);
      }
    }

    const kAng = hitAng !== null ? hitAng : Math.atan2(e.y - arena.player.y, e.x - arena.player.x);
    const resist = e.isBoss ? 0.25 : ((e.poiseArmorTimer || 0) > 0 ? 0.35 : 0.85);
    e.kx = (e.kx || 0) + Math.cos(kAng) * knockImpulse * resist;
    e.ky = (e.ky || 0) + Math.sin(kAng) * knockImpulse * 0.65 * resist;
    e.sx = 1.18; e.sy = 0.85;
    if (isHeavySkill && isCrit) arena.hitStop = Math.max(arena.hitStop || 0, 0.026);

    spawnSparks(e.x, e.y - 8, isCrit ? 9 : 4, kAng, 1.4, isCrit ? "#ffe26a" : "#70ffe6");

    if (arena.stageElement === "frost" || game.loadout.builder === "talisman_frost") e.chillTimer = 2.6;
    if (game.school === "talisman" || hasLaw(game, "yinyang")) e.burnTimer = 2.5;

    // M2 Run Boon 【玄霜剑爆】: 38% chance on hit to unleash an icy splash nova!
    if (hasRunBoon("frost_splash") && Math.random() < 0.38) {
      e.chillTimer = Math.max(e.chillTimer || 0, 3.0);
      addRipple(e.x, e.y + 12, 118, "#80ecff");
      const splashDmg = Math.max(5, Math.round(st.atk * 0.42));
      arena.enemies.slice().forEach(o => {
        if (o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 125) {
          o.chillTimer = Math.max(o.chillTimer || 0, 2.8);
          o.hp -= splashDmg;
          o.hitFlash = 0.10;
          if (o.hp <= 0 && !o.isDummy) handleEnemyDeath(o, kAng);
        }
      });
    }

    if (e.isBoss && !e.enraged && e.hp > 0 && e.hp / e.maxHp < 0.55) {
      e.enraged = true;
      e.beamCd = 1.1;
      Sound.drum(0.30);
      Sound.bianzhong(293.66, 0.11);
      arena.shake = 16;
      arena.camZoom = 1.12;
      arena.camFocusX = e.x;
      arena.camFocusY = e.y;
      arena.camFocusT = 0.85;
      const bSig = BOSS_SIGNATURE_MOVES[e.id] || BOSS_SIGNATURE_MOVES.wolf;
      arena.bossDomain = { id: e.id, name: bSig.domainName, skyTint: bSig.skyTint, weather: bSig.weather };
      spawnBossPhase2WardPylons(e);
      showBossCutIn("boss_phase2_totem", `${e.name} · 二阶段【${bSig.domainName}】`, `先摧毁护法阵柱破减伤 · 金招${bSig.goldName}可剑反 · 红招${bSig.perilousName}空格闪避！`);
      arena.shockRings.push({ x: e.x, y: e.y + 14, r: 28, maxR: 340, spd: 210, hitPlayer: false, color: "#ff6b6b" });
      arena.slashes.push({ x: e.x, y: e.y, r: e.r + 110, ang: 0, t: 0, color: "#ff5252", heavy: true });
      addFloat(`🔥 ${e.name} · 二阶【${bSig.domainName}】展开！`, e.x, e.y - e.r - 40, "#ff9f7f", 22, true);
      for (let k = 0; k < 8; k++) {
        const oa = (k * Math.PI * 2) / 8;
        arena.projectiles.push({
          friendly: false, kind: "orb", x: e.x, y: e.y,
          vx: Math.cos(oa) * 4.8, vy: Math.sin(oa) * 4.8 * 0.72,
          ang: oa, r: 12, dmg: e.atk, life: 2.3, color: "#ff5e57"
        });
      }
    }

    if (hasRunBoon("posture_shatter")) postureDmg = Math.round(postureDmg * P.runBoons.posture_shatter.postureMult);
    if (e.state !== "stun" && e.posture >= 0) {
      e.posture = Math.max(0, e.posture - postureDmg);
      if (e.posture <= 0) {
        e.state = "stun";
        e.executedThisStun = false;
        e.timer = e.isBoss ? 2.4 : 2.1;
        e.posture = e.maxPosture;
        if (!isPracticeModeActive() && !isSanctumDojoActive()) unlockAchievement("ach_break");
        if (hasLaw(game, "stagger_surge")) {
          game.mp = Math.min(st.maxMp, (game.mp || 0) + P.laws.stagger_surge.breakMp);
          arena.player.ultCd = Math.max(0, arena.player.ultCd - P.laws.stagger_surge.breakUltCdReduce);
        }
        if (hasRunBoon("posture_shatter") && !e.isDummy) {
          const shatterRatio = e.isBoss ? P.runBoons.posture_shatter.bossTrueDmgRatio : P.runBoons.posture_shatter.mobTrueDmgRatio;
          const shatterTrue = Math.max(12, Math.round(e.maxHp * shatterRatio));
          e.hp -= shatterTrue;
          addFloat(`💥 崩岳破势真伤 -${shatterTrue}！`, e.x, e.y - e.r - 46, "#ffd166", 20, true);
        }
        if (hasRunBoon("vampiric_qi")) {
          const vHeal = Math.max(5, Math.round(st.maxHp * P.runBoons.vampiric_qi.breakHealPct));
          game.hp = Math.min(st.maxHp, game.hp + vHeal);
          game.mp = Math.min(st.maxMp, (game.mp || 0) + P.runBoons.vampiric_qi.mpGain);
          addFloat(`✦ 噬灵归元 +${vHeal}血`, arena.player.x, arena.player.y - 44, "#70ffe6", 14);
        }
        Sound.postureBreak();
        arena.hitStop = 0.095;
        arena.shake = 13;
        addDecal(e.x, e.y + 18, 0, 58, "scorch");
        spawnSparks(e.x, e.y, 18, 0, 6.28, "#fff3be");
        addFloat("★ 破势失衡！万剑绞杀！", e.x, e.y - e.r - 26, "#fff3be", 21, true);

        if (hasSynergy(game, "sky_cleave")) {
          arena.slashes.push({ x: e.x, y: e.y, r: 220, ang: 0.4, t: 0, color: "#ffe28a", heavy: true });
          arena.slashes.push({ x: e.x, y: e.y, r: 220, ang: -0.4, t: 0, color: "#70ffe6", heavy: true });
          addFloat("★ 一剑开天门！", e.x, e.y - e.r - 48, "#ffe28a", 22, true);
          arena.enemies.slice().forEach(other => {
            if (other !== e && other.hp > 0 && Math.hypot(other.x - e.x, other.y - e.y) < 250) {
              other.hp -= Math.round(st.atk * 2.2);
              if (other.hp <= 0 && !other.isDummy) handleEnemyDeath(other, 0.4);
            }
          });
        }
      }
    }

    const climNow = getActiveDungeonClimate();
    const critChainCount = (isCrit && hasRunBoon("lightning_chain")) ? 2 : (isCrit && climNow && climNow.id === "thunder_loom") ? 1 : 0;
    const baseChainChance = arena.stageElement === "thunder" ? 0.78 : (hasLaw(game, "yinyang") || game.school === "talisman") ? 0.44 : 0;
    const totalJumps = critChainCount > 0 ? critChainCount : ((baseChainChance > 0 && Math.random() < baseChainChance) ? 1 : 0);
    if (totalJumps > 0) {
      const candidates = arena.enemies.filter(o => o !== e && o.hp > 0 && Math.hypot(o.x - e.x, o.y - e.y) < 245).slice(0, totalJumps);
      candidates.forEach(other => {
        arena.lightnings.push({ x1: e.x, y1: e.y, x2: other.x, y2: other.y, t: 0, color: "#c792ff" });
        other.hp -= Math.round(dmg * 0.46);
        other.hitFlash = 0.1;
        if (other.hp <= 0 && !other.isDummy) handleEnemyDeath(other, kAng);
      });
    }

    addFloat(`${isCrit ? "暴 " : ""}-${dmg}`, e.x, e.y - e.r - 8, isCrit ? "#ffe26a" : "#ffffff", isCrit ? 20 : 15, isCrit);
    if (e.isTitan && !e.climbExecuted) e.hp = Math.max(Math.round(e.maxHp * 0.12), e.hp);
    if (e.hp <= 0 && !e.isDummy) handleEnemyDeath(e, kAng);
  }

  function handleEnemyDeath(e, cutAng = -0.35) {
    const idx = arena.enemies.indexOf(e);
    if (idx < 0) return;
    arena.enemies.splice(idx, 1);
    const inPractice = isPracticeModeActive() || isSanctumDojoActive();
    if (!inPractice) {
      game.wins += 1;
      if (game.goalStats) game.goalStats.kills = (game.goalStats.kills || 0) + 1;
    }
    if (getKarmaState(game).mode === "demonic") {
      const stKill = getCombatStats(game);
      const vamp = Math.max(4, Math.round(stKill.maxHp * (e.isBoss ? 0.16 : 0.06)));
      game.hp = Math.min(stKill.maxHp, game.hp + vamp);
      addFloat(`🩸 血煞噬魂 +${vamp}`, arena.player.x, arena.player.y - 42, "#ff6b81", 14);
    }
    if (hasStarCore(game, "azure_dragon")) {
      arena.player.blinkCd = 0;
    }
    if (e.isBoss) {
      triggerKillCamStamp((e.isTitan && e.climbExecuted) ? "踏躯逆鳞斩" : "一剑诛邪");
      captureBattleHighlightFrame("一剑诛邪", `斩灭首领·${e.name}`, e.maxHp, 4);
      if (!inPractice) {
        const isStarNight = getCurrentCelestialPhase().id === "star_night";
        game.bonusStarPts = (game.bonusStarPts || 0) + (isStarNight ? 2 : 1);
        if (isStarNight) {
          addFloat("🌌 极夜星河赐福 · 额外掉落稀有【鸿蒙星魄 +1】！", e.x, e.y - 68, "#b8c8ff", 20, true);
        }
        const isCampaignBossFinish = Boolean(
          e.isBoss && isNormalCampaignStage() && arena.dungeonMap &&
          arena.dungeonMap.nodes[arena.dungeonMap.currentNodeId] &&
          (!arena.dungeonMap.nodes[arena.dungeonMap.currentNodeId].next || arena.dungeonMap.nodes[arena.dungeonMap.currentNodeId].next.length === 0) &&
          arena.enemies.filter(x => !x.isTreasure).length === 0
        );
        if (isCampaignBossFinish) arena.stageClearPending = true;
        const unlockMap = { warden: "blood_warden", serpent: "frost_phoenix", puppet: "sword_fiend", sentinel: "thunder_lord", trial_gate: "taixu_demon", shadow: "taixu_demon" };
        const sKey = e.isInnerDemon ? "taixu_demon" : unlockMap[e.id];
        if (sKey && Array.isArray(game.unlockedSouls) && !game.unlockedSouls.includes(sKey)) {
          game.unlockedSouls.push(sKey);
          showToast(`👹 炼化妖王本源！已解锁镇妖魂印【${SOUL_SPIRITS[sKey].name}】！`, { tier: 2, category: "soul", key: `soul_unlock_${sKey}` });
          enqueuePendingReward({ kind: "soul_unlock", payload: { soulId: sKey }, persist: false });
        }
      }
    }
    if (!inPractice && (hasGearAffix(game, "greed_wolf") || getActivePactCount(game) > 0)) {
      game.stones += Math.round((e.isBoss ? 18 : 4) * (1 + getActivePactCount(game) * 0.25));
    }
    addDecal(e.x, e.y + 14, cutAng, e.isBoss ? 54 : 32, "slash");
    spawnSparks(e.x, e.y - 6, e.isBoss ? 24 : 10, cutAng, 3.14, "#ffe28a");

    arena.deathAnims.push({
      art: e.art, x: e.x, y: e.y - 8,
      size: e.isBoss ? 128 : e.isTreasure ? 58 : 88,
      flip: e.x > arena.player.x,
      ang: cutAng, t: 0, isBoss: e.isBoss
    });

    // Equipment Loot Drops with Sky-Piercing Beams! (Suppressed in Practice Mode!)
    const calDrop = getCalamityCycleSpec(game);
    if (e.isBoss) {
      Sound.drum(0.28);
      arena.hitStop = 0.08;
      arena.shake = 12;
      if (!inPractice) {
        spawnDrop("core", e.x - 10, e.y - 10, 1);
        spawnGearDrop(e.x + 16, e.y + 6, Math.min(4, 2 + Math.floor(arena.stageIdx / 2) + (calDrop.dropBonus || 0)));
      }
    } else if (!inPractice && e.guaranteedGearRarity !== undefined) {
      spawnGearDrop(e.x, e.y, Math.min(4, e.guaranteedGearRarity + (calDrop.dropBonus || 0)));
    } else if (!inPractice && !e.isTreasure && Math.random() < (0.24 + (calDrop.tier > 0 ? 0.08 : 0))) {
      spawnGearDrop(e.x, e.y, Math.min(3, calDrop.dropBonus || 0));
    }

    if (e.isTreasure) {
      if (inPractice) return;
      Sound.fanfare();
      for (let k = 0; k < 5; k++) spawnDrop("stone", e.x + (Math.random() - 0.5) * 32, e.y + (Math.random() - 0.5) * 32, 25);
      spawnGearDrop(e.x, e.y, 2);
      addFloat("✦ 聚宝金灵 · 神通抉择入待处置", e.x, e.y - 32, "#ffe26a", 16, true, { banner: false });
      // F07/F10 A3: NEVER silently auto-grant a law! Always persist iconic_draft into game.pendingRewards and let calm scheduler present it.
      enqueuePendingReward({
        kind: "iconic_draft",
        payload: { titleText: "聚宝奇缘 · 获赐神通", source: "golden_spirit" },
        persist: true
      });
      showToast("✦ 斩获聚宝金灵！神通三选一已记入【待处置】，静默后可自主择取！", { tier: 2, category: "other" });
      updateHud();
      return;
    }

    const r = REALMS[game.realm];
    const climD = getActiveDungeonClimate();
    const curNodeD = getCurrentDungeonNode();
    if (hasRunBoon("vampiric_qi")) {
      const stV = getCombatStats(game);
      const vHeal = Math.max(5, Math.round(stV.maxHp * COMBAT_RULE_PARAMS.runBoons.vampiric_qi.killHealPct));
      game.hp = Math.min(stV.maxHp, game.hp + vHeal);
      game.mp = Math.min(stV.maxMp, (game.mp || 0) + COMBAT_RULE_PARAMS.runBoons.vampiric_qi.mpGain);
      addFloat(`✦ 噬灵归元 +${vHeal}血`, arena.player.x, arena.player.y - 44, "#70ffe6", 14);
    }
    if (!inPractice) {
      const specD = ENEMIES[e.id] || ENEMIES.wolf;
      const playerRank = rankOf(game.realm);
      const stageDelta = playerRank - arena.stageIdx;
      const realmPenalty = stageDelta <= 0 ? 1.0 : stageDelta === 1 ? 0.55 : stageDelta === 2 ? 0.28 : 0.12;
      const isPrologueWave = arena.stageIdx === 0 && !arena.towerMode && !game.openingChoice;
      const baseEnemyXp = (specD.xp || 14) * (1 + arena.stageIdx * 0.25);
      const roomXpMult = e.isBoss ? 3.2 : (curNodeD && curNodeD.type === "vanguard_clash" ? 1.4 : (curNodeD && curNodeD.type === "elite_loot" ? 1.3 : 1.0));
      const capShare = (r.xpCap || 60) * (e.isBoss ? 0.18 : 0.036) * realmPenalty;
      const rawXpOrb = isPrologueWave
        ? 7
        : (stageDelta >= 2
            ? Math.max(2, Math.round(baseEnemyXp * roomXpMult * realmPenalty))
            : Math.max(Math.min(baseEnemyXp * roomXpMult, capShare * 1.45), capShare));
      const xpOrbVal = Math.max(2, Math.round(rawXpOrb * calDrop.rewardMult));
      const daoDropB = getDaoBonuses(game);
      const wolfStarMult = (currentOmen(game).id === "wolf_star" ? COMBAT_RULE_PARAMS.omens.wolf_star.stoneMult : 1.0) * (hasRunBoon("gold_alchemist") ? COMBAT_RULE_PARAMS.runBoons.gold_alchemist.stoneDropMult : 1.0) * calDrop.rewardMult * daoDropB.stoneMult;
      const realmStoneMult = (e && e.realmScaledDelta > 0)
        ? Math.max(1, num(e.realmStoneMult, computeMainlineRealmScaling(arena.stageIdx, game.realm, !!e.isBoss).stoneMult))
        : 1.0;
      spawnDrop("qi", e.x, e.y, xpOrbVal);
      spawnDrop("stone", e.x + 12, e.y - 8, Math.round((e.isBoss ? 48 + arena.stageIdx * 24 : 10 + arena.stageIdx * 5) * wolfStarMult * realmStoneMult));

      // Real 7-material combat drops wired from ENEMIES[id].loot + CAMPAIGN_ACTS[stageIdx]
      const matMult = ((climD && climD.id === "spirit_mist") || (curNodeD && curNodeD.type === "elemental_vault")) ? 2 : 1;
      const actSpec = CAMPAIGN_ACTS[arena.stageIdx] || CAMPAIGN_ACTS[0];
      const lootEntries = Object.entries(specD.loot || {});
      if (e.isBoss) {
        const bossMatSet = new Set([...(actSpec.bossMats || []), ...lootEntries.map(([k]) => k)]);
        let offsetIdx = 0;
        bossMatSet.forEach(matKey => {
          if (ITEMS[matKey]) {
            spawnDrop(matKey, e.x - 18 + offsetIdx * 16, e.y + 10, matMult);
            offsetIdx += 1;
          }
        });
      } else if (Math.random() < 0.56) {
        const matPool = [...(actSpec.matDrops || ["herb"]), ...lootEntries.map(([k]) => k)].filter(k => ITEMS[k]);
        const chosenMat = matPool.length ? matPool[Math.floor(Math.random() * matPool.length)] : "herb";
        for (let hb = 0; hb < matMult; hb++) spawnDrop(chosenMat, e.x - 14 + hb * 12, e.y + 8, 1);
      }
    }
    if (climD && climD.id === "spirit_mist") {
      const stM = getCombatStats(game);
      game.mp = Math.min(stM.maxMp, (game.mp || 0) + Math.round(stM.maxMp * 0.12));
    }

    const remainingHostiles = arena.enemies.filter(x => !x.isTreasure).length;
    if (remainingHostiles === 0 && !arena.waveTransitioning) {
      if (arena.cloudFlight && arena.cloudFlight.active) {
        // Handled seamlessly in stepCloudSeaFlight
      } else if (arena.celestialSpire && arena.celestialSpire.active) {
        arena.waveTransitioning = true;
        Sound.fanfare();
        const sEpoch = arena.stageEpoch;
        setTimeout(() => {
          if (!game || arena.stageEpoch !== sEpoch || !arena.celestialSpire || !arena.celestialSpire.active) return;
          arena.waveTransitioning = false;
          if (isPracticeModeActive() || arena.celestialSpire.practiceMode || (arena.celestialSpire.startFloor && arena.celestialSpire.startFloor > 1)) {
            completeSpirePracticeFloor();
          } else {
            openSpireCurioDraftModal();
          }
        }, 420);
      } else if (arena.bossRush && arena.bossRush.active) {
        arena.waveTransitioning = true;
        if (arena.bossRush.bout >= 7) {
          Sound.fanfare();
          const rEpoch = arena.stageEpoch;
          setTimeout(() => {
            if (!game || arena.stageEpoch !== rEpoch || !arena.bossRush || !arena.bossRush.active) return;
            arena.waveTransitioning = false;
            openBossRushVictoryModal();
          }, 450);
        } else {
          arena.bossRush.bout += 1;
          const stR = getCombatStats(game);
          game.hp = Math.min(stR.maxHp, game.hp + Math.round(stR.maxHp * 0.30));
          arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 30);
          Sound.fanfare();
          const nextSpec = BOSS_RUSH_ROSTER[arena.bossRush.bout - 1];
          showToast(`★ 连战破阵！气血回补30%，即将迎战【${nextSpec.title}】！`);
          const rEpoch = arena.stageEpoch;
          setTimeout(() => {
            if (!game || arena.stageEpoch !== rEpoch || !arena.bossRush || !arena.bossRush.active) return;
            arena.waveTransitioning = false;
            spawnBossRushBout();
          }, 750);
        }
      } else if (arena.sectDefense && arena.sectDefense.active) {
        // Handled by stepSectDefenseSiege
      } else if (arena.customSeedRun && arena.customSeedRun.active) {
        arena.waveTransitioning = true;
        Sound.fanfare();
        const csEpoch = arena.stageEpoch;
        const csSeed = arena.customSeedRun.seed || "";
        const csBosses = Array.isArray(arena.customSeedRun.bosses) ? arena.customSeedRun.bosses.slice() : [];
        const csStartedAt = arena.customSeedRun.startedAt || Date.now();
        const csHitsTaken = Math.max(0, Math.floor(num(arena.customSeedRun.hitsTaken, 0)));
        setTimeout(() => {
          if (!game || arena.stageEpoch !== csEpoch || !arena.customSeedRun || !arena.customSeedRun.active) return;
          arena.waveTransitioning = false;
          const elapsedSec = Math.max(0.1, (Date.now() - csStartedAt) / 1000);
          arena.customSeedRun.elapsedSec = elapsedSec;
          arena.customSeedRun.active = false;
          const tempCurioRestored = restoreCustomSeedTempCurio();
          if (practiceFormalSnapshot) endPracticeModeIsolation();
          updateHud();
          openCustomSeedVictoryModal({ seed: csSeed, elapsedSec, hitsTaken: csHitsTaken, bosses: csBosses, tempCurioRestored });
        }, 420);
      } else if (arena.towerMode) {
        arena.waveTransitioning = true;
        const fl = game.towerFloor;
        game.towerBest = Math.max(game.towerBest, fl);
        game.towerFloor += 1;
        if (fl >= 5) unlockAchievement("ach_tower5");
        if (fl >= 10) unlockAchievement("ach_tower10");
        const st = getCombatStats(game);
        game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.25));
        game.mp = Math.min(st.maxMp, game.mp + Math.round(st.maxMp * 0.30));
        const towerGrade = computeModeGrade("demon_tower", { floor: game.towerBest });
        Sound.fanfare();
        showToast(`★ 锁妖塔第 ${fl} 层破关（当前 ${towerGrade} 级）！气血恢复25%，点击/Enter 阵眼冲第 ${game.towerFloor} 层`);
        const canvas = document.getElementById("fx-canvas");
        const pPos = clampToPlaza((canvas.width || 1440) * 0.65, (canvas.height || 900) * 0.54, canvas.width || 1440, canvas.height || 900);
        arena.props = arena.props.filter(p => p.kind !== "tower_next");
        arena.props.push({
          id: "tower_next_" + game.towerFloor, kind: "tower_next",
          name: `冲关 · 锁妖塔第 ${game.towerFloor} 层`, badge: "点击或按 Enter 开启下一层",
          x: pPos.x, y: pPos.y, r: 48, progress: 0
        });
        arena.waveTransitioning = false;
      } else {
        const shenProp = arena.props.find(p => p.id === "shen_rescue" && !p.rescued);
        if (shenProp) {
          shenProp.rescued = true;
          shenProp.bubble = "多谢拔剑相救！点击或按 Enter 于玉莲台择一谢礼：";
          Sound.fanfare();
          const canvas = document.getElementById("fx-canvas");
          const w = canvas.width || 1440, h = canvas.height || 900;
          const p1 = clampToPlaza(w * 0.55, h * 0.62, w, h);
          const p2 = clampToPlaza(w * 0.69, h * 0.62, w, h);
          arena.props.push({
            id: "ped_shen", kind: "pedestal", choice: "help", art: "item_lotus", onLotus: true,
            name: "青莲灵契", badge: "点击/Enter 立得青莲药师袍(+34血+4减伤) · 下战按 R 唤沈清禾助阵", x: p1.x, y: p1.y, r: 42, progress: 0
          });
          arena.props.push({
            id: "ped_sword", kind: "pedestal", choice: "trade", art: "relic_frost_sword", onLotus: true,
            name: "惊鸿剑诀", badge: "点击/Enter 立得飞剑 +1 + 惊鸿青霜剑(+10攻+4%暴) · 对比换装", x: p2.x, y: p2.y, r: 42, progress: 0
          });
          // Trigger Prologue Portrait Cutscene!
          playCutscene("prologue_rescue");
        } else if (arena.dungeonMap) {
          const dm = arena.dungeonMap;
          const curNode = dm.nodes[dm.currentNodeId];
          if (curNode && curNode.next && curNode.next.length > 0) {
            arena.waveTransitioning = true;
            const curEpoch = arena.stageEpoch;
            setTimeout(() => {
              if (!game || arena.stageEpoch !== curEpoch) return;
              arena.waveTransitioning = false;
              spawnMapExitGateAndBoon();
            }, 460);
          } else {
            // Layer 4 Chapter Boss Cleared -> Chapter Victory & Continuous Next-Chapter Portal!
            if (curNode && !dm.clearedIds.includes(curNode.id)) dm.clearedIds.push(curNode.id);
            arena.waveTransitioning = true;
            arena.waveIdx = 5;
            const curEpoch = arena.stageEpoch;
            setTimeout(() => {
              if (!game || arena.stageEpoch !== curEpoch) return;
              if (arena.enemies.filter(x => !x.isTreasure).length === 0) spawnCurrentWave();
              else arena.waveTransitioning = false;
            }, 580);
          }
        } else {
          arena.waveTransitioning = true;
          arena.waveIdx += 1;
          const curEpoch = arena.stageEpoch;
          setTimeout(() => {
            if (!game || arena.stageEpoch !== curEpoch) return;
            if (arena.enemies.filter(x => !x.isTreasure).length === 0) spawnCurrentWave();
            else arena.waveTransitioning = false;
          }, 650);
        }
      }
    }
    saveGame();
    updateHud();
  }

  let petAssistTimer = 0;
  let thunderAuraTimer = 0;
  let burnTickTimer = 0;

  function stepFurnaceMinigame(dt) {
    if (!furnaceGame.active || !drawerOpen || currentTab !== "alchemy") return;
    furnaceGame.pos += furnaceGame.dir * furnaceGame.speed * dt;
    if (furnaceGame.pos >= 0.96) { furnaceGame.pos = 0.96; furnaceGame.dir = -1; }
    if (furnaceGame.pos <= 0.04) { furnaceGame.pos = 0.04; furnaceGame.dir = 1; }
    const needle = document.getElementById("furnace-live-needle");
    if (needle) needle.style.left = `${(furnaceGame.pos * 100).toFixed(1)}%`;
  }

  function stepArena(dt) {
    GamepadSystem.poll();
    updateTelemetryOverlay(dt);
    stepFurnaceMinigame(dt);
    if (arena.sourceCd > 0) arena.sourceCd = Math.max(0, arena.sourceCd - dt);
    if (arena.ultCineTimer > 0) arena.ultCineTimer = Math.max(0, arena.ultCineTimer - dt);
    if (!game || arena.paused || cutscene.active || document.getElementById("welcome-screen").style.display !== "none") return;
    const canvas = document.getElementById("fx-canvas");
    const w = (canvas && canvas.width) || window.innerWidth;
    const h = (canvas && canvas.height) || window.innerHeight;
    if (!arena.sanctumMode && arena.encounterTelemetry) arena.encounterTelemetry.elapsedSec += dt;
    if (arena.camFocusT > 0) {
      arena.camFocusT = Math.max(0, arena.camFocusT - dt);
      arena.camZoom = 1.11;
    } else {
      arena.camZoom = (arena.camZoom || 1) + (1.0 - (arena.camZoom || 1)) * Math.min(1, dt * 4.5);
    }
    arena.camKickX = (arena.camKickX || 0) * Math.max(0, 1 - dt * 14);
    arena.camKickY = (arena.camKickY || 0) * Math.max(0, 1 - dt * 14);
    if (arena.morphCd > 0) arena.morphCd = Math.max(0, arena.morphCd - dt);
    if (arena.switchMorphCd > 0) arena.switchMorphCd = Math.max(0, arena.switchMorphCd - dt);
    if (arena.player.hyperArmorTimer > 0) arena.player.hyperArmorTimer = Math.max(0, arena.player.hyperArmorTimer - dt);
    if (arena.bossRush && arena.bossRush.active) {
      arena.bossRush.elapsed += dt;
      if (arena.rushAffixes.includes('rush_thunder') && Math.random() < dt * 0.75) {
        const rx = w * (0.35 + Math.random() * 0.32), ry = h * (0.40 + Math.random() * 0.28);
        arena.skyBolts.push({ x: rx, y: ry, t: 0, color: '#d69eff' });
        triggerElectroPoolReaction(rx, ry, 24);
      }
    }
    syncPostureBadgeHud();
    syncTagTeamHud();
    if (arena.tagSwitchCd > 0) arena.tagSwitchCd = Math.max(0, arena.tagSwitchCd - dt);
    if (arena.player.ravineBuffTimer > 0) arena.player.ravineBuffTimer = Math.max(0, arena.player.ravineBuffTimer - dt);
    if (arena.witchTime > 0) arena.witchTime = Math.max(0, arena.witchTime - dt);
    if (arena.petUltCd > 0) arena.petUltCd = Math.max(0, arena.petUltCd - dt);
    if (stepTitanDualClash(dt)) { updateBossBannerAndRecallOrb(); updateComboRankSeal(); return; }
    if (stepTitanClimbCinematic(dt)) { updateBossBannerAndRecallOrb(); updateComboRankSeal(); return; }
    if (stepRavineGlide(dt)) { updateComboRankSeal(); return; }
    if (arena.hitStop > 0) {
      if (isReducedMotionActive() || a11ySettings.hitStopScale <= 0.02) arena.hitStop = 0;
      else { arena.hitStop -= dt / a11ySettings.hitStopScale; if (arena.hitStop > 0) return; }
    }

    const p = arena.player;
    const st = getCombatStats(game);

    if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt * (arena.domain ? 1.2 : 1));
    if (p.recallCd > 0) p.recallCd = Math.max(0, p.recallCd - dt);
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.slashCd > 0) p.slashCd = Math.max(0, p.slashCd - dt);
    if (p.comboWindow > 0) p.comboWindow = Math.max(0, p.comboWindow - dt);
    if (p.ultCd > 0) p.ultCd = Math.max(0, p.ultCd - dt);
    if (p.allyCd > 0) p.allyCd = Math.max(0, p.allyCd - dt);
    if (p.jumpCd > 0) p.jumpCd = Math.max(0, p.jumpCd - dt);
    if (p.blinkCd > 0) p.blinkCd = Math.max(0, p.blinkCd - dt);
    if (p.guardShieldCd > 0) p.guardShieldCd = Math.max(0, p.guardShieldCd - dt);
    if (p.gourdHasteTimer > 0) p.gourdHasteTimer = Math.max(0, p.gourdHasteTimer - dt);
    if (p.boonOverloadTimer > 0) p.boonOverloadTimer = Math.max(0, p.boonOverloadTimer - dt);
    if (p.gourdCritTimer > 0) p.gourdCritTimer = Math.max(0, p.gourdCritTimer - dt);
    if (p.petBuffTimer > 0) p.petBuffTimer = Math.max(0, p.petBuffTimer - dt);
    if (arena.soulCd > 0) arena.soulCd = Math.max(0, arena.soulCd - dt);
    if (arena.sanqingCd > 0) arena.sanqingCd = Math.max(0, arena.sanqingCd - dt);
    if (arena.shanheCd > 0) arena.shanheCd = Math.max(0, arena.shanheCd - dt);
    if (arena.warshipCd > 0) arena.warshipCd = Math.max(0, arena.warshipCd - dt);
    if (arena.mountCd > 0) arena.mountCd = Math.max(0, arena.mountCd - dt);
    if (arena.qimenCd > 0) arena.qimenCd = Math.max(0, arena.qimenCd - dt);
    if (arena.astralCd > 0) arena.astralCd = Math.max(0, arena.astralCd - dt);
    if (arena.astralBombCd > 0) arena.astralBombCd = Math.max(0, arena.astralBombCd - dt);
    if (arena.autoProbeCd > 0) arena.autoProbeCd = Math.max(0, arena.autoProbeCd - dt);
    if (arena.stunHaloCd > 0) arena.stunHaloCd = Math.max(0, arena.stunHaloCd - dt);
    if ((p.shieldHp || 0) > 0) {
      const shCap = Math.round(st.maxHp * 0.34);
      if (p.shieldHp > shCap) p.shieldHp = shCap;
      p.shieldDecayAcc = (p.shieldDecayAcc || 0) + dt;
      if (p.shieldDecayAcc >= 1.2) {
        p.shieldDecayAcc -= 1.2;
        p.shieldHp = Math.max(0, p.shieldHp - Math.max(1, Math.round(st.maxHp * 0.025)));
      }
    }
    stepGhostRecorder(dt);

    // Decay Sword Style Meter smoothly outside active exchanges
    if ((arena.styleScore || 0) > 0) {
      if ((arena.styleDecayTimer || 0) > 0) arena.styleDecayTimer -= dt;
      else arena.styleScore = Math.max(0, arena.styleScore - dt * 55);
    }

    // Active Blade Clash (`剑罡相交 · 拼刀角力`) 1.2s High-Tension Lock!
    if (arena.bladeClash) {
      const bc = arena.bladeClash;
      bc.timer -= dt;
      // Gentle enemy pushback vs passive sword-spirit aid so responsive players win thrillingly!
      bc.power = Math.max(8, Math.min(100, bc.power - dt * 12));
      bc.sparkTick -= dt;
      if (bc.sparkTick <= 0) {
        bc.sparkTick = 0.14;
        Sound.clang(1.25 + Math.random() * 0.4, 0.08);
        spawnSparks(bc.midX, bc.midY - 12, 8, Math.random() * 6.28, 3.14, "#ffd86b");
      }
      arena.camFocusX = bc.midX;
      arena.camFocusY = bc.midY;
      arena.camFocusT = 0.25;
      arena.camZoom = 1.18;
      syncBladeClashHud();
      if (bc.power >= 100 || bc.timer <= 0) {
        resolveBladeClashOutcome(bc.power >= 52);
      }
      updateCooldownMasks();
      return;
    }

    // V18 Player Z-Axis Vertical Physics (`御风腾跃 -> 滞空连斩 -> 陨星坠地劈`)
    if ((p.z || 0) > 0 || (p.vz || 0) !== 0) {
      p.z = (p.z || 0) + (p.vz || 0) * (dt * 60) * 0.42;
      const grav = p.plunging ? 58.0 : 25.5;
      p.vz = (p.vz || 0) - grav * dt;
      if (p.z <= 0) {
        const wasPlunging = p.plunging;
        p.z = 0; p.vz = 0; p.airComboStep = 0;
        const inWater = arena.waterPools.some(wp => Math.hypot(p.x - wp.x, (p.y - wp.y) / 0.56) < wp.r);
        const surf = inWater ? "water" : (arena.sanctumMode || arena.stageIdx === 4) ? "jade" : (arena.stageIdx === 3 || (arena.bossRush && arena.bossRush.active)) ? "scorch" : "stone";
        Sound.airLandWhoosh(surf, p.x);
        if (wasPlunging) resolveMeteorPlungeImpact();
        else { p.vaultPrimed = false; addRipple(p.x, p.y + 30, 36, "rgba(112, 255, 230, 0.45)"); }
      }
    }

    // V18 Righteous Karma Passive Immortal Art: 【太清镇世诀】 Periodic Lotus Barrier & Purifying Wave!
    if (getKarmaState(game).mode === "righteous" && arena.enemies.length > 0) {
      p.righteousPulseCd = (p.righteousPulseCd === undefined ? 7.0 : p.righteousPulseCd) - dt;
      if (p.righteousPulseCd <= 0) {
        p.righteousPulseCd = 11.0;
        p.shieldHp = Math.min(Math.round(st.maxHp * 0.28), (p.shieldHp || 0) + Math.round(st.maxHp * 0.10));
        addRipple(p.x, p.y + 26, 118, "#70ffe6");
        addFloat("☯ 太清镇世 · 净莲护体！", p.x, p.y - (p.z || 0) - 56, "#70ffe6", 16, true);
      }
    }
    flushInputBuffer(dt);
    stepElementalHazards(dt, st);
    stepSectDefenseSiege(dt);
    stepCloudSeaFlight(dt, w, h);
    stepQimenArrayAndMount(dt, st);
    stepLocalCoop2PAndWorldLaws(dt, st, w, h);
    stepSanqingAndGenesisSystems(dt, st, w, h);
    if (arena.radialBurst) {
      arena.radialBurst.t += dt / arena.radialBurst.dur;
      if (arena.radialBurst.t >= 1) arena.radialBurst = null;
    }
    if (a11ySettings.autoComboAssist && pointer.down && pointer.worldActive && p.slashCd <= 0 && !p.meditating) {
      if (p.comboWindow > 0.26 && p.comboStep === 2 && (arena.morphCd || 0) <= 0) recallAndDetonateSwords();
      else fireManualSlash();
    }
    if (arena.hoverChakrams && arena.hoverChakrams.length) {
      for (let hi = arena.hoverChakrams.length - 1; hi >= 0; hi--) {
        const hc = arena.hoverChakrams[hi];
        hc.life -= dt;
        hc.rot += dt * 14.0;
        hc.tickCd -= dt;
        if (hc.tickCd <= 0) {
          hc.tickCd = 0.22;
          arena.props.slice().forEach(pr => {
            if (pr.destructible && pr.hp > 0 && Math.hypot(pr.x - hc.x, pr.y - hc.y) < pr.r + hc.r) {
              damageBattleProp(pr, hc.dmg, "wind");
            }
          });
          arena.enemies.slice().forEach(e => {
            if (e.hp > 0 && Math.hypot(e.x - hc.x, e.y - hc.y) < e.r + hc.r) {
              const pullStrength = hc.gravityPull || 0.14;
              e.x += (hc.x - e.x) * pullStrength;
              e.y += (hc.y - e.y) * pullStrength;
              if (hc.heavySaw) { e.frontShieldHp = 0; e.wardHp = 0; }
              e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
              if (getCurioStacks(game, "curio_chakram_thunder") > 0) {
                triggerChainLightning(hc.x, hc.y, st.atk * 0.45, 2);
              }
              damageEnemy(e, hc.dmg, !!hc.heavySaw, hc.heavySaw ? 14 : 7, hc.rot, 1.5, false);
            }
          });
        }
        if (hc.life <= 0) arena.hoverChakrams.splice(hi, 1);
      }
    }
    if (arena.shake > 0) arena.shake = Math.max(0, arena.shake - dt * 32);
    if (arena.flash > 0) arena.flash = Math.max(0, arena.flash - dt * 1.9);

    if (arena.comboCount > 0) {
      arena.comboTimer -= dt;
      if (arena.comboTimer <= 0) arena.comboCount = 0;
    }

    if (pointer.down && pointer.worldActive) {
      pointer.holdTime += dt;
      if (pointer.holdTime > 0.18) pointer.moveTarget = null;
    }

    if (arena.frostPools.some(fp => Math.hypot(p.x - fp.x, (p.y - fp.y) / 0.56) < fp.r) && p.invuln <= 0) {
      p.vx *= 0.72; p.vy *= 0.72;
    }
    const center = getPlazaCenter(w, h);
    const inSpiritEye = Math.hypot(p.x - center.x, (p.y - center.y) / 0.58) < 76;

    if (p.meditating && arena.tribulation) {
      flushAndEndMeditation();
    } else if (p.meditating) {
      p.meditateTick += dt;
      p.meditateAgeTick = (p.meditateAgeTick || 0) + dt;
      const sanctumMed = getSanctumBonuses(game).medMult;
      const healEyeMult = arena.sanctumMode ? 2.4 * sanctumMed : (inSpiritEye ? 1.8 * sanctumMed : 1.0);
      const xpEyeMult = (arena.sanctumMode ? 1.85 * sanctumMed : (inSpiritEye ? 1.45 * sanctumMed : 1.0)) * (hasDestinyFruit(game, "lotus_body") ? 1.35 : 1.0);
      game.hp = Math.min(st.maxHp, game.hp + st.maxHp * 0.12 * healEyeMult * dt);
      game.mp = Math.min(st.maxMp, (game.mp || 0) + st.maxMp * 0.28 * healEyeMult * dt);
      if (Math.random() < 0.55) {
        const qa = Math.random() * Math.PI * 2;
        const qr = 95 + Math.random() * 55;
        arena.qiStreams.push({
          x: p.x + Math.cos(qa) * qr,
          y: p.y - 10 + Math.sin(qa) * qr * 0.6,
          life: 0.45
        });
      }
      if (p.meditateTick >= 0.60) {
        p.meditateTick = 0;
        if (!isPracticeModeActive()) {
          const r = REALMS[game.realm];
          const xpStep = Math.max(1, Math.round((r.xpCap || 60) * 0.0042 * xpEyeMult));
          gainRealmXp(xpStep);
        }
        if ((p.zenStacks || 0) < 3) {
          p.zenStacks = (p.zenStacks || 0) + 1;
          Sound.qiOrb(p.zenStacks + 2);
          addFloat(`剑心通明 ×${p.zenStacks}`, p.x, p.y - 52, "#ffe28a", 15);
        }
        updateHud();
      }
      while (p.meditateAgeTick >= 3.0) {
        p.meditateAgeTick -= 3.0;
        const ageRes = advanceLifespanMonths(1, "meditation");
        if (ageRes && ageRes.aged > 0) p.meditateAgedDirty = true;
        updateHud();
      }
    }

    if ((hasLaw(game, "eternal_spring") || game.loadout.mind === "sword_still" || game.loadout.relic === "cloud_mirror") && game.hp < st.maxHp) {
      game.hp = Math.min(st.maxHp, game.hp + st.maxHp * 0.012 * dt);
    }
    if (game.mp < st.maxMp) {
      const mpRegenAmp = (st.daoBonuses ? st.daoBonuses.mpRegenMult : 1.0) * (st.schoolSpec ? st.schoolSpec.mpRegenMult : 1.0);
      game.mp = Math.min(st.maxMp, (game.mp || 0) + (0.9 + st.maxMp * 0.014) * mpRegenAmp * dt);
    }

    burnTickTimer -= dt;
    if (burnTickTimer <= 0) {
      burnTickTimer = 0.65;
      const burnBonus = (game.loadout.builder === "talisman_ember" ? 1.45 : 1.0) * (game.loadout.relic === "soul_lamp" ? 1.35 : 1.0);
      arena.enemies.slice().forEach(e => {
        if ((e.burnTimer || 0) > 0 && e.hp > 0) {
          damageEnemy(e, Math.max(2, Math.round(st.atk * 0.30 * burnBonus)), false, 3, 0, 0.5, false);
        }
      });
    }

    if (arena.domain) {
      const dm = arena.domain;
      dm.life -= dt;
      dm.rot += dt * 0.85;
      dm.tickCd -= dt;
      if (dm.tickCd <= 0) {
        dm.tickCd = 0.52;
        const domAmp = st.schoolSpec ? st.schoolSpec.skillDmgMult : 1.0;
        arena.enemies.slice().forEach(e => {
          if (Math.hypot(e.x - dm.x, (e.y - dm.y) / 0.62) < dm.r + e.r) {
            e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
            damageEnemy(e, Math.round(st.atk * 0.34 * domAmp), false, 4, 0, 1.0, false);
          }
        });
      }
      if (dm.life <= 0) arena.domain = null;
    }

    let moving = false;
    let moveDirX = 0;
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.x += p.vx; p.y += p.vy;
      moveDirX = p.vx;
      moving = true;
      p.afterimages.push({ x: p.x, y: p.y, facing: p.facing, a: 0.58 });
    } else {
      let mx = (keysDown["KeyD"] || keysDown["ArrowRight"] ? 1 : 0) - (keysDown["KeyA"] || keysDown["ArrowLeft"] ? 1 : 0) + GamepadSystem.moveX;
      let my = (keysDown["KeyS"] || keysDown["ArrowDown"] ? 1 : 0) - (keysDown["KeyW"] || keysDown["ArrowUp"] ? 1 : 0) + GamepadSystem.moveY;
      if (mx !== 0 || my !== 0) {
        pointer.moveTarget = null;
        if (p.meditating) {
          p.meditating = false;
          p.meditateAgeTick = 0;
          if (p.meditateAgedDirty) {
            p.meditateAgedDirty = false;
            if (!sandboxMode && !isPracticeModeActive()) saveGame();
          }
          updateHud();
        }
      } else if (pointer.moveTarget) {
        const dx = pointer.moveTarget.x - p.x, dy = pointer.moveTarget.y - p.y;
        if (Math.hypot(dx, dy) > 16) { mx = dx; my = dy; }
        else pointer.moveTarget = null;
      }
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my) || 1;
        const mSpd = (arena.mountState && arena.mountState.active) ? (MYTHIC_MOUNTS[arena.mountState.mountId || "qilin"].spdMult || 1.45) : 1.0;
        p.x += (mx / len) * st.speed * mSpd;
        p.y += (my / len) * st.speed * mSpd;
        p.facing = mx >= 0 ? 1 : -1;
        moveDirX = mx / len;
        moving = true;
        p.bob += dt * 11.5;
      } else {
        p.bob += dt * 3.2;
      }
    }
    p.lean += ((moving ? moveDirX * 0.11 : 0) - p.lean) * 0.22;
    p.animT = (p.animT || 0) + dt;
    if ((p.hitFlash || 0) > 0) p.hitFlash = Math.max(0, p.hitFlash - dt);
    if (game && game.hp <= 0) {
      if (p.animState !== "knockdown") setPlayerAnimState("knockdown", 99);
    } else if (p.animState === "knockdown") {
      setPlayerAnimState("idle", 0.25);
    } else if (p.meditating) {
      if (p.animState !== "meditate") setPlayerAnimState("meditate", 99);
    } else if (p.dashTimer > 0) {
      if (p.animState !== "dodge") setPlayerAnimState("dodge", 0.24);
    } else {
      const timedActive = ["light1", "light2", "light3", "light4", "heavy", "dodge", "hit"].includes(p.animState) && p.animT < (p.animDur || 0.24);
      if (!timedActive) {
        const nextBase = moving ? "run" : "idle";
        if (p.animState !== nextBase) {
          p.animState = nextBase;
          p.animT = 0;
          p.animDur = 0.4;
        }
      }
    }
    const clampedP = clampToPlaza(p.x, p.y, w, h);
    p.x = clampedP.x; p.y = clampedP.y;

    if (moving && (p.z || 0) <= 4) {
      p.stepRippleCd -= dt;
      if (p.stepRippleCd <= 0) {
        p.stepRippleCd = 0.23;
        const inWater = arena.waterPools.some(wp => Math.hypot(p.x - wp.x, (p.y - wp.y) / 0.56) < wp.r);
        const inFire = arena.fireZones.some(fz => Math.hypot(p.x - fz.x, fz.y - p.y) < fz.r);
        const surf = inWater ? "water" : inFire ? "scorch" : (arena.sanctumMode || arena.stageIdx === 4) ? "jade" : (arena.stageIdx === 3 || (arena.bossRush && arena.bossRush.active)) ? "scorch" : "stone";
        Sound.footstep(surf, p.x);
        addRipple(p.x, p.y + 34, inWater ? 32 : 24, inWater ? "rgba(128, 236, 255, 0.48)" : (arena.stageIdx === 0 && !arena.sanctumMode ? "rgba(175, 230, 245, 0.36)" : "rgba(248, 227, 172, 0.28)"));
      }
    }

    if (p.scarfPts.length === 0) initScarfRibbon();
    p.scarfPts[0].x = p.x - p.facing * 8;
    p.scarfPts[0].y = p.y - 16 + Math.sin(p.bob) * 2.5;
    const windX = -p.facing * 6.5 + Math.sin(performance.now() * 0.006) * 2.2;
    for (let i = 1; i < p.scarfPts.length; i++) {
      const prev = p.scarfPts[i - 1];
      const cur = p.scarfPts[i];
      const tx = prev.x + windX;
      const ty = prev.y + 3.2 + Math.cos(performance.now() * 0.008 + i) * 1.8;
      cur.x += (tx - cur.x) * 0.36;
      cur.y += (ty - cur.y) * 0.36;
    }

    for (let i = p.afterimages.length - 1; i >= 0; i--) {
      p.afterimages[i].a -= dt * 2.3;
      if (p.afterimages[i].a <= 0) p.afterimages.splice(i, 1);
    }

    const stunnedBoss = arena.enemies.find(e => e.isBoss && e.state === "stun");
    const curStance = SWORD_STANCES[arena.stanceIdx].id;
    syncFlyingSwords();
    const totalSw = arena.swords.length;
    const chargingVolley = pointer.down && pointer.worldActive && pointer.holdTime > 0.22;

    if (curStance === "giant" && !chargingVolley && !stunnedBoss) {
      const gs = arena.giantSword;
      const tgt = arena.enemies.find(e => e.isBoss) || arena.enemies[0] || arena.props.find(pr => pr.kind === "rough_jade" && pr.hp > 0);
      if (gs.slamAlpha > 0) gs.slamAlpha = Math.max(0, gs.slamAlpha - dt * 2.4);

      if (gs.state === "hover") {
        const destX = tgt ? tgt.x : p.x + p.facing * 68;
        const destY = tgt ? tgt.y : p.y - 12;
        gs.x += (destX - gs.x) * 0.14;
        gs.y += (destY - gs.y) * 0.14;
        gs.z += (68 - gs.z) * 0.18;
        gs.timer -= dt * Math.min(1.4, st.atkHaste);
        if (tgt && gs.timer <= 0) {
          gs.state = "slam";
          gs.targetX = tgt.x;
          gs.targetY = tgt.y;
          gs.timer = 0.24;
        }
      } else if (gs.state === "slam") {
        gs.x += (gs.targetX - gs.x) * 0.45;
        gs.y += (gs.targetY - gs.y) * 0.45;
        gs.z = Math.max(0, gs.z - dt * 420);
        gs.timer -= dt;
        if (gs.z <= 2 || gs.timer <= 0) {
          Sound.drum(0.28);
          Sound.clang(0.76, 0.16);
          arena.shake = 12;
          gs.slamAlpha = 1.0;
          addDecal(gs.x, gs.y + 12, 0, 68, "scorch");
          addRipple(gs.x, gs.y + 12, 118, "#ffe28a");
          spawnSparks(gs.x, gs.y, 20, -Math.PI / 2, 3.14, "#ffe28a");
          arena.slashes.push({ x: gs.x, y: gs.y, r: 120, ang: 0, t: 0, color: "#ffe28a", heavy: true });

          const slamDmg = Math.round(st.atk * (1.15 + Math.min(6, totalSw) * 0.10));
          arena.enemies.slice().forEach(e => {
            if (Math.hypot(e.x - gs.x, e.y - gs.y) < e.r + 112) {
              e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
              damageEnemy(e, slamDmg, false, 24, Math.atan2(e.y - gs.y, e.x - gs.x), 8.0, true);
            }
          });
          arena.props.slice().forEach(pr => {
            if (pr.destructible && pr.hp > 0 && Math.hypot(pr.x - gs.x, pr.y - gs.y) < 120) { damageBattleProp(pr, slamDmg); }
            else if (pr.kind === "rough_jade" && pr.hp > 0 && Math.hypot(pr.x - gs.x, pr.y - gs.y) < 110) {
              pr.hp = 0;
              if (!isPracticeModeActive()) {
                unlockAchievement("ach_jade");
                spawnDrop("stone", pr.x, pr.y, 55 + arena.stageIdx * 22);
                spawnGearDrop(pr.x - 12, pr.y, 1);
                addFloat("巨阙开石 · 爆出灵器！", pr.x, pr.y - 34, "#ffe28a", 19, true);
              }
              arena.props = arena.props.filter(x => x !== pr);
            }
          });
          gs.state = "recover";
          gs.timer = 0.45;
        }
      } else {
        gs.z += (68 - gs.z) * 0.16;
        gs.timer -= dt;
        if (gs.timer <= 0) { gs.state = "hover"; gs.timer = 2.8; }
      }

      arena.swords.forEach((sw, idx) => {
        sw.angle += dt * 6.0;
        const fx = gs.x + Math.cos(sw.angle + idx) * 10;
        const fy = gs.y - gs.z - 28 + Math.sin(sw.angle + idx) * 16;
        sw.x += (fx - sw.x) * 0.45;
        sw.y += (fy - sw.y) * 0.45;
        sw.trail.push({ x: sw.x, y: sw.y });
        if (sw.trail.length > 6) sw.trail.shift();
      });
    } else {
      let probeDispatchedThisFrame = false;
      arena.swords.forEach((sw, idx) => {
        const spinSpd = curStance === "ring" ? 8.8 : (stunnedBoss ? 7.6 : 2.8 * Math.min(1.4, st.atkHaste));
        sw.angle += dt * spinSpd;
        if (sw.ringHitCd > 0) sw.ringHitCd -= dt;

        if (sw.state === "volley") {
          sw.x += sw.vx; sw.y += sw.vy;
          sw.timer -= dt;
          if (sw.timer <= 0) { sw.state = "orbit"; sw.timer = 0.24; }
        } else if (chargingVolley) {
          const aimAng = Math.atan2(pointer.y - p.y, pointer.x - p.x);
          const arcOff = totalSw > 1 ? ((idx / (totalSw - 1)) - 0.5) * 1.4 : 0;
          const hx = p.x - Math.cos(aimAng + arcOff) * 44;
          const hy = p.y - 16 - Math.sin(aimAng + arcOff) * 34;
          sw.x += (hx - sw.x) * 0.35;
          sw.y += (hy - sw.y) * 0.35;
        } else if (stunnedBoss) {
          // Visual golden sword-halo locking stunned boss; single shared slow pulse leaves execution burst to player input!
          const vx = stunnedBoss.x + Math.cos(sw.angle + (idx * Math.PI * 2) / totalSw) * 62;
          const vy = stunnedBoss.y + Math.sin(sw.angle + (idx * Math.PI * 2) / totalSw) * 42;
          sw.x += (vx - sw.x) * 0.36;
          sw.y += (vy - sw.y) * 0.36;
          if (idx === 0 && (arena.stunHaloCd || 0) <= 0) {
            arena.stunHaloCd = 0.95;
            damageEnemy(stunnedBoss, Math.round(st.atk * 0.32), false, 0, sw.angle, 1.0, false);
          }
        } else if (curStance === "ring") {
          const ringR = 82;
          const rx = p.x + Math.cos(sw.angle + (idx * Math.PI * 2) / totalSw) * ringR;
          const ry = p.y - 6 + Math.sin(sw.angle + (idx * Math.PI * 2) / totalSw) * (ringR * 0.62);
          sw.x += (rx - sw.x) * 0.48;
          sw.y += (ry - sw.y) * 0.48;

          for (let pi = arena.projectiles.length - 1; pi >= 0; pi--) {
            const pr = arena.projectiles[pi];
            if (!pr.friendly && Math.hypot(pr.x - sw.x, pr.y - sw.y) < pr.r + 24) {
              Sound.clang(1.45, 0.06);
              spawnSparks(pr.x, pr.y, 7, sw.angle, 2.0, "#70ffe6");
              addFloat("斩弹!", pr.x, pr.y - 10, "#70ffe6", 13);
              bumpCombo(1);
              arena.projectiles.splice(pi, 1);
            }
          }
          if (sw.ringHitCd <= 0) {
            for (const e of arena.enemies.slice()) {
              if (Math.hypot(e.x - sw.x, e.y - sw.y) < e.r + 22) {
                sw.ringHitCd = 0.55;
                e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
                damageEnemy(e, Math.round(st.atk * 0.26), false, 4, Math.atan2(e.y - p.y, e.x - p.x), 2.5, false);
                break;
              }
            }
          }
        } else if (sw.state === "orbit") {
          const phase = sw.angle + (idx * Math.PI * 2) / totalSw;
          sw.zDepth = Math.sin(phase);
          const orbitR = 56 + (idx % 2) * 13;
          const homeX = p.x + Math.cos(phase) * orbitR;
          const homeY = p.y - 6 + Math.sin(phase) * (orbitR * 0.52);
          sw.x += (homeX - sw.x) * 0.26;
          sw.y += (homeY - sw.y) * 0.26;
          // Single slow probing sword every ~2.2s to seed sword marks; bulk sword launches come from active player LMB/RMB!
          if (!probeDispatchedThisFrame && (arena.autoProbeCd || 0) <= 0) {
            let best = null, bestDist = 290;
            for (const e of arena.enemies) {
              const d = Math.hypot(e.x - p.x, e.y - p.y);
              if (d < bestDist) { bestDist = d; best = e; }
            }
            if (!best) {
              for (const pr of arena.props) {
                if (pr.kind === "rough_jade" && pr.hp > 0 && Math.hypot(pr.x - p.x, pr.y - p.y) < 250) { best = pr; break; }
              }
            }
            if (best) {
              probeDispatchedThisFrame = true;
              arena.autoProbeCd = (hasLaw(game, "void_haste") ? 1.85 : 2.25) / Math.min(1.35, st.atkHaste);
              sw.state = "strike";
              sw.target = best;
              sw.isActiveSynergy = false;
              sw.timer = 0.42;
              sw.maxStrikeT = 0.42;
              sw.curveSign = (idx % 2 === 0 ? 1 : -1) * (0.65 + (idx % 3) * 0.22);
              sw.zDepth = 1;
            } else {
              arena.autoProbeCd = 0.35;
            }
          }
        } else if (sw.state === "strike") {
          sw.zDepth = 1;
          const tgt = sw.target;
          if (!tgt || (tgt.hp !== undefined && tgt.hp <= 0)) {
            sw.state = "orbit"; sw.isActiveSynergy = false; sw.timer = 0.25;
          } else {
            const dx = tgt.x - sw.x, dy = tgt.y - sw.y;
            const d = Math.hypot(dx, dy) || 1;
            const nx = dx / d, ny = dy / d;
            const arcFade = Math.min(1, d / 190) * (sw.timer / (sw.maxStrikeT || 0.42));
            const perpX = -ny * (sw.curveSign || 1) * 11.5 * arcFade;
            const perpY =  nx * (sw.curveSign || 1) * 7.2 * arcFade;
            sw.x += nx * 21.0 + perpX;
            sw.y += ny * 21.0 + perpY;
            sw.timer -= dt;
            if (d < (tgt.r || 30) + 16) {
              if (tgt.kind === "rough_jade") {
                tgt.hp -= 1;
                Sound.clang(1.3, 0.05);
                spawnSparks(tgt.x, tgt.y, 6, 0, 3.14, "#70ffe6");
                if (tgt.hp <= 0) {
                  if (!isPracticeModeActive()) {
                    unlockAchievement("ach_jade");
                    spawnDrop("stone", tgt.x, tgt.y, 52 + arena.stageIdx * 22);
                    spawnGearDrop(tgt.x - 10, tgt.y, 1);
                    addFloat("原石爆裂 · 出灵器！", tgt.x, tgt.y - 34, "#4ad2b8", 18, true);
                  }
                  arena.props = arena.props.filter(x => x !== tgt);
                }
              } else {
                Sound.pluck(523.25 + (idx % 4) * 65, 0.11, 0.032, "triangle");
                tgt.swordMarks = Math.min(6, (tgt.swordMarks || 0) + 1);
                const synSchoolAmp = (sw.isActiveSynergy && st.schoolSpec) ? st.schoolSpec.swordSynergyMult : 1.0;
                const swMult = (sw.isActiveSynergy ? 0.28 : 0.20) * synSchoolAmp;
                const swPosture = sw.isActiveSynergy ? 4 : 2;
                damageEnemy(tgt, Math.max(2, Math.round(st.atk * swMult)), false, swPosture, Math.atan2(dy, dx), 1.6, false);
              }
              sw.state = "orbit";
              sw.isActiveSynergy = false;
              sw.timer = 0.45;
            } else if (sw.timer <= 0) {
              sw.state = "orbit"; sw.isActiveSynergy = false; sw.timer = 0.28;
            }
          }
        }
        sw.trail.push({ x: sw.x, y: sw.y });
        if (sw.trail.length > 9) sw.trail.shift();
      });
    }

    if (game.pet.id && arena.enemies.length > 0) {
      petAssistTimer -= dt;
      if (petAssistTimer <= 0) {
        petAssistTimer = (hasLaw(game, "beast_soul") ? 2.2 : 3.2) * (hasPetSkill(game, "swift_bond") ? 0.75 : 1.0);
        const sp = SPIRIT_PETS[game.pet.id];
        const tgt = arena.enemies[0];
        const furyOn = hasPetSkill(game, "fury_fang");
        const petScale = (1 + (game.pet.level - 1) * 0.22) * (furyOn ? 1.35 : 1.0);
        const posMult = furyOn ? 1.5 : 1.0;
        if (sp && sp.id === "fox") {
          const ang = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          arena.projectiles.push({
            friendly: true, kind: "fireball", x: p.x - p.facing * 28, y: p.y - 16,
            vx: Math.cos(ang) * 10.8, vy: Math.sin(ang) * 10.8, ang, r: 20,
            dmg: Math.round(st.atk * 0.48 * petScale), postureDmg: Math.round(6 * posMult), knock: 3.0, addMark: 1, life: 0.9, pierced: new Set(), color: "#ff8a65"
          });
        } else if (sp && sp.id === "turtle") {
          game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.03 * petScale));
          p.shieldHp = Math.min(Math.round(st.maxHp * 0.20), (p.shieldHp || 0) + Math.round(st.maxHp * 0.03 * petScale));
        } else if (sp && sp.id === "sword_spirit") {
          const ang = Math.atan2(tgt.y - p.y, tgt.x - p.x);
          game.mp = Math.min(st.maxMp, (game.mp || 0) + 5);
          arena.projectiles.push({
            friendly: true, kind: "twin_x", x: p.x - p.facing * 24, y: p.y - 18,
            vx: Math.cos(ang) * 15.0, vy: Math.sin(ang) * 15.0, ang, r: 52,
            dmg: Math.round(st.atk * 0.55 * petScale), postureDmg: Math.round(8 * posMult), knock: 3.5, addMark: 1, life: 0.55, pierced: new Set(), color: "#ffe28a"
          });
        } else {
          arena.lightnings.push({ x1: p.x, y1: p.y - 40, x2: tgt.x, y2: tgt.y, t: 0, color: "#c792ff" });
          damageEnemy(tgt, Math.round(st.atk * 0.55 * petScale), false, Math.round(8 * posMult), 0, 2.5, false);
        }
        if (hasPetSkill(game, "spirit_ward")) {
          p.shieldHp = Math.min(Math.round(st.maxHp * 0.25), (p.shieldHp || 0) + Math.round(st.maxHp * 0.03));
          game.mp = Math.min(st.maxMp, (game.mp || 0) + 4);
        }
        if (hasPetSkill(game, "soul_siphon")) {
          game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.04));
          game.mp = Math.min(st.maxMp, (game.mp || 0) + 8);
        }
        if (hasPetSkill(game, "twin_resonance") && tgt && tgt.hp > 0) {
          tgt.swordMarks = Math.min(6, (tgt.swordMarks || 0) + 1);
          arena.lightnings.push({ x1: p.x - p.facing * 20, y1: p.y - 26, x2: tgt.x, y2: tgt.y, t: 0, color: "#80ecff" });
          damageEnemy(tgt, Math.max(4, Math.round(st.atk * 0.36 * petScale)), false, Math.round(6 * posMult), 0, 2.0, false);
        }
      }
    }

    if (hasLaw(game, "thunder_body") && arena.enemies.length > 0) {
      thunderAuraTimer -= dt;
      if (thunderAuraTimer <= 0) {
        thunderAuraTimer = 2.6;
        const near = arena.enemies.find(e => Math.hypot(e.x - p.x, e.y - p.y) < 195);
        if (near) {
          arena.lightnings.push({ x1: p.x, y1: p.y - 20, x2: near.x, y2: near.y, t: 0, color: "#d69eff" });
          damageEnemy(near, Math.round(st.atk * 0.45), false, 6, 0, 1.5, false);
        }
      }
    }

    for (let ai = arena.activeAllies.length - 1; ai >= 0; ai--) {
      const al = arena.activeAllies[ai];
      al.life -= dt;
      if (al.life <= 0) {
        addRipple(al.x, al.y + 20, 48, al.color);
        arena.activeAllies.splice(ai, 1);
        continue;
      }
      const target = arena.enemies[0];
      const triOffX = [-82, 82, 0][ai % 3];
      const triOffY = [18, 18, 62][ai % 3];
      const destX = target ? target.x + (ai === 1 ? 78 : -78) : p.x + triOffX;
      const destY = target ? target.y + (ai - 1) * 44 : p.y + triOffY;
      const adx = destX - al.x, ady = destY - al.y;
      const adist = Math.hypot(adx, ady) || 1;
      if (adist > 18) {
        al.x += (adx / adist) * 4.2;
        al.y += (ady / adist) * 3.2;
        al.facing = adx >= 0 ? 1 : -1;
      }
      const cPos = clampToPlaza(al.x, al.y, w, h);
      al.x = cPos.x; al.y = cPos.y;

      al.atkCd -= dt;
      if (al.atkCd <= 0) {
        al.atkCd = 1.15;
        if (al.style === "heal_frost") {
          game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.05));
          addRipple(al.x, al.y + 22, 65, "#70ffe6");
        }
        if (target) {
          const ang = Math.atan2(target.y - al.y, target.x - al.x);
          al.facing = Math.cos(ang) >= 0 ? 1 : -1;
          arena.projectiles.push({
            friendly: true, kind: al.style === "sword_burst" ? "twin_x" : "crescent",
            x: al.x + Math.cos(ang) * 24, y: al.y - 8,
            vx: Math.cos(ang) * 14.0, vy: Math.sin(ang) * 14.0,
            ang, r: 46, dmg: Math.round(st.atk * 0.92), postureDmg: 12, knock: 3.5, addMark: 1, life: 0.48,
            pierced: new Set(), color: al.color
          });
        }
      }
    }

    for (let bi = arena.skyBolts.length - 1; bi >= 0; bi--) {
      arena.skyBolts[bi].t += dt * 2.8;
      if (arena.skyBolts[bi].t >= 1) arena.skyBolts.splice(bi, 1);
    }
    for (let ai = arena.bladeArcs.length - 1; ai >= 0; ai--) {
      arena.bladeArcs[ai].t += dt * 4.6;
      if (arena.bladeArcs[ai].t >= 1) arena.bladeArcs.splice(ai, 1);
    }
    for (let vi = arena.lotusVortexes.length - 1; vi >= 0; vi--) {
      const vx = arena.lotusVortexes[vi];
      vx.life -= dt;
      vx.rot += dt * 7.5;
      vx.tickCd -= dt;
      if (vx.tickCd <= 0) {
        vx.tickCd = 0.24;
        arena.enemies.slice().forEach(e => {
          if (Math.hypot(e.x - vx.x, e.y - vx.y) < vx.r + e.r) {
            e.x += (vx.x - e.x) * 0.12;
            e.y += (vx.y - e.y) * 0.12;
            e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
            damageEnemy(e, vx.dmg, true, 14, vx.rot, 2, true);
          }
        });
      }
      if (vx.life <= 0) arena.lotusVortexes.splice(vi, 1);
    }
    for (let ti = arena.thunderOrbs.length - 1; ti >= 0; ti--) {
      const to = arena.thunderOrbs[ti];
      to.life -= dt;
      to.tickCd -= dt;
      if (to.tickCd <= 0) {
        to.tickCd = 0.55;
        Sound.thunderCrack();
        triggerChainLightning(to.x, to.y, st.atk * 0.85, 3);
      }
      if (to.life <= 0) arena.thunderOrbs.splice(ti, 1);
    }
    for (let di = arena.jadeDecoys.length - 1; di >= 0; di--) {
      const dc = arena.jadeDecoys[di];
      dc.life -= dt;
      if (dc.life <= 0) {
        Sound.clang(1.25, 0.12);
        addRipple(dc.x, dc.y + 20, 110, "#70ffe6");
        pushBladeArc(dc.x, dc.y, 0, 120, "#70ffe6", 1, true);
        arena.enemies.slice().forEach(e => {
          if (Math.hypot(e.x - dc.x, e.y - dc.y) < 145) {
            e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
            damageEnemy(e, dc.dmg, true, 26, 0, 8, true);
          }
        });
        arena.jadeDecoys.splice(di, 1);
      }
    }
    for (let fi = arena.frostPools.length - 1; fi >= 0; fi--) {
      const fp = arena.frostPools[fi];
      fp.life -= dt;
      if (fp.life <= 0) arena.frostPools.splice(fi, 1);
    }
    // Companion Spirit-Link Sword Tether Searing Damage!
    if (arena.activeAllies.length > 0 && arena.enemies.length > 0 && Math.random() < dt * 5.0) {
      arena.activeAllies.forEach(al => {
        const mx = (p.x + al.x) * 0.5, my = (p.y + al.y) * 0.5;
        arena.enemies.slice().forEach(e => {
          if (Math.hypot(e.x - mx, e.y - my) < 62) {
            damageEnemy(e, Math.round(st.atk * 0.52), false, 6, 0, 1.5, false);
          }
        });
      });
    }

    // Step Expanding Isometric Boss Shockwave Rings (`Space` Dash or `Z` Jump leaps over!)
    for (let ri = arena.shockRings.length - 1; ri >= 0; ri--) {
      const sr = arena.shockRings[ri];
      sr.r += sr.spd * dt;
      const pEllDist = Math.hypot(p.x - sr.x, (p.y - sr.y) / 0.56);
      if (!sr.hitPlayer && Math.abs(pEllDist - sr.r) < 18) {
        if (p.invuln <= 0 && (p.z || 0) < 18) {
          sr.hitPlayer = true;
          hurtPlayer(16 + arena.stageIdx * 6, { sourceName: sr.sourceName || "秘境首领", moveName: "震地冲击波", isHeavy: true });
        }
      }
      if (sr.r >= sr.maxR) arena.shockRings.splice(ri, 1);
    }

    // V18 Step Cyan-Violet Low Perilous Ground-Fissure Sweeps (`青紫地裂危招`: Ground Dash CANNOT evade; Jump `p.z > 20` cleanly vaults over!)
    for (let gi = arena.groundSweeps.length - 1; gi >= 0; gi--) {
      const gs = arena.groundSweeps[gi];
      gs.r += gs.spd * dt;
      const pEllDist = Math.hypot(p.x - gs.x, (p.y - gs.y) / 0.56);
      if (!gs.hitPlayer && !gs.vaulted && Math.abs(pEllDist - gs.r) < 20) {
        if ((p.z || 0) >= 20) {
          gs.vaulted = true;
          addFloat("🕊 御空越过地脉裂波！", p.x, p.y - p.z - 42, "#70ffe6", 15, true);
        } else if (gs.dmg > 0) {
          gs.hitPlayer = true;
          const prevInv = p.invuln;
          p.invuln = 0; // Low seismic fissure catches ground rolls!
          hurtPlayer(gs.dmg, { sourceName: (gs.owner && gs.owner.name) || "镇守妖兽", moveName: "下段裂地危招", isHeavy: true });
          p.invuln = Math.max(prevInv, 0.35);
          addFloat("⚠ 下段裂地波！(按Z凌空踏剑可反制)", p.x, p.y - 58, "#38f9d7", 14, true);
        } else {
          gs.hitPlayer = true;
          addFloat("未跃起！（试在下段青紫波近身时按 Z 踏剑借力）", p.x, p.y - 46, "#38f9d7", 13.5);
        }
      }
      if (gs.r >= gs.maxR) arena.groundSweeps.splice(gi, 1);
    }

    // Step Phase-2 Sweeping Boss Laser Beams (`t < 0` warning line -> `t >= 0` sweeping active beam!)
    for (let bmi = arena.bossBeams.length - 1; bmi >= 0; bmi--) {
      const bm = arena.bossBeams[bmi];
      bm.t += dt;
      if (bm.hitCd > 0) bm.hitCd -= dt;
      if (bm.t >= 0) {
        const prog = Math.min(1, bm.t / bm.dur);
        bm.curAng = bm.startAng + bm.sweep * prog;
        const dxB = p.x - bm.x, dyB = p.y - bm.y;
        const distB = Math.hypot(dxB, dyB);
        if (distB < bm.len && bm.hitCd <= 0 && p.invuln <= 0) {
          const aDiff = Math.abs(Math.atan2(Math.sin(Math.atan2(dyB, dxB) - bm.curAng), Math.cos(Math.atan2(dyB, dxB) - bm.curAng)));
          if (aDiff < 0.11) {
            bm.hitCd = 0.45;
            hurtPlayer(bm.dmg, { sourceName: bm.sourceName || "狂暴首领", moveName: "旋空妖光", isHeavy: true });
          }
        }
      }
      if (bm.t >= bm.dur) arena.bossBeams.splice(bmi, 1);
    }

    for (let i = arena.zones.length - 1; i >= 0; i--) {
      const z = arena.zones[i];
      z.life -= dt;
      if (z.life <= 0) { arena.zones.splice(i, 1); continue; }
      if (z.kind === "lotus_heal" && Math.hypot(p.x - z.x, p.y - z.y) < z.r) {
        game.hp = Math.min(st.maxHp, game.hp + st.maxHp * 0.08 * dt);
      }
    }

    if (arena.tribulation) {
      const tb = arena.tribulation;
      tb.cooldown -= dt;
      if (tb.cooldown <= 0 && tb.boltsLeft > 0) {
        const waveIdx = (tb.totalBolts || 3) - tb.boltsLeft;
        tb.boltsLeft -= 1;
        tb.cooldown = tb.hardcore ? 0.84 : 1.25;
        const sp = clampToPlaza(p.x + (Math.random() - 0.5) * 40, p.y + (Math.random() - 0.5) * 35, w, h);
        tb.strikes.push({ x: sp.x, y: sp.y, r: tb.hardcore ? 84 : 74, t: 0, hit: false, parried: false });
        const extraMax = tb.hardcore ? 4 : 2;
        for (let extra = 0; extra < Math.min(extraMax, waveIdx + (tb.hardcore ? 1 : 0)); extra++) {
          const ea = Math.random() * Math.PI * 2;
          const ep = clampToPlaza(p.x + Math.cos(ea) * 125, p.y + Math.sin(ea) * 78, w, h);
          tb.strikes.push({ x: ep.x, y: ep.y, r: tb.hardcore ? 72 : 62, t: 0.12, hit: false, parried: false });
        }
      }
      for (let i = tb.strikes.length - 1; i >= 0; i--) {
        const s = tb.strikes[i];
        s.t += dt * (tb.hardcore ? 1.24 : 0.92);
        if (s.t >= 1.0 && !s.hit) {
          s.hit = true;
          Sound.drum(0.26);
          Sound.slash(true);
          arena.shake = 12;
          arena.skyBolts.push({ x: s.x, y: s.y, t: 0, color: s.parried ? "#70ffe6" : (tb.hardcore ? "#ff7875" : "#e2b8ff") });
          triggerElectroPoolReaction(s.x, s.y, st.atk);
          GamepadSystem.rumble(0.70, 0.78, 175);
          addDecal(s.x, s.y, 0, 52, "scorch");
          arena.slashes.push({ x: s.x, y: s.y, r: s.r, ang: 0, t: 0, color: "#d6b4ff", rain: true });
          if (!s.parried && p.invuln <= 0 && Math.hypot(p.x - s.x, p.y - s.y) < s.r - 8) {
            flushAndEndMeditation();
            if (!tb.hardcore && (game.tribShield || 0) > 0) {
              game.tribShield -= 1;
              addFloat(`护脉丹障抵御天雷！（余 ${game.tribShield} 层）`, p.x, p.y - 40, "#ffe28a", 18, true);
              updateHud();
            } else {
              const aidMit = (game.aids.shen ? 0.25 : 0) + (game.aids.pei ? 0.20 : 0);
              const basePct = tb.hardcore ? 0.46 : 0.22;
              const loss = Math.max(8, Math.round(st.maxHp * basePct * (1 - aidMit)));
              game.hp = Math.max(0, game.hp - loss);
              recordEncounterHitTaken({
                sourceName: "紫霄天劫",
                moveName: tb.hardcore ? "强化紫霄劫雷" : "紫霄天雷",
                rawDmg: loss,
                finalDmg: loss,
                isHeavy: true
              });
              p.invuln = 0.45;
              addFloat(`雷劫 -${loss}`, p.x, p.y - 36, "#ff7b7b", 18, true);
              updateHud();
              if (game.hp <= 0) {
                openDefeatDecisionModal(true);
                return;
              }
            }
          }
        }
        if (s.t >= 1.25) tb.strikes.splice(i, 1);
      }
      if (arena.tribulation && tb.boltsLeft <= 0 && tb.strikes.length === 0) completeLiveTribulation();
    }

    for (let ei = arena.enemies.length - 1; ei >= 0; ei--) {
      const e = arena.enemies[ei];
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.chillTimer > 0) e.chillTimer = Math.max(0, e.chillTimer - dt);
      if (e.burnTimer > 0) e.burnTimer = Math.max(0, e.burnTimer - dt);
      if (e.mirrorTimer > 0) e.mirrorTimer = Math.max(0, e.mirrorTimer - dt);
      if (e.poiseArmorTimer > 0) e.poiseArmorTimer = Math.max(0, e.poiseArmorTimer - dt);

      if (e.wallSplatCd > 0) e.wallSplatCd = Math.max(0, e.wallSplatCd - dt);
      if ((e.airborneZ || 0) > 0 || (e.airborneVz || 0) !== 0) {
        e.airborneZ = Math.max(0, (e.airborneZ || 0) + (e.airborneVz || 0));
        e.airborneVz = (e.airborneVz || 0) - 18.5 * dt;
        if (e.airborneZ <= 0) { e.airborneZ = 0; e.airborneVz = 0; }
      }
      if (Math.abs(e.kx) > 0.05 || Math.abs(e.ky) > 0.05) {
        const kSpd = Math.hypot(e.kx, e.ky);
        e.x += e.kx; e.y += e.ky;
        // V17 Check Knockback Collision against Arena Wall OR Battlefield Monuments (`破壁崩震 Wall-Splat`)!
        if (!e.isDummy && !e.isTreasure && kSpd > 4.2 && (e.wallSplatCd || 0) <= 0) {
          const testClamp = clampToPlaza(e.x, e.y, w, h);
          const hitWall = Math.hypot(testClamp.x - e.x, testClamp.y - e.y) > 2.2;
          const hitProp = arena.props.find(pr => (pr.destructible || pr.kind === "elem_stele") && Math.hypot(pr.x - e.x, pr.y - e.y) < e.r + pr.r + 6);
          if (hitWall || hitProp) {
            e.wallSplatCd = 3.0;
            e.kx *= -0.35; e.ky *= -0.35;
            e.state = "stun";
            e.timer = Math.max(e.timer || 0, 1.8);
            e.airborneZ = 34;
            e.airborneVz = 4.6;
            Sound.wallSplatCrunch();
            GamepadSystem.rumble(0.68, 0.58, 130);
            spawnDistortionRing(testClamp.x, testClamp.y, 135, "#ffe28a");
            addDecal(testClamp.x, testClamp.y + 12, 0, 56, "spider_crack");
            const splatDmg = Math.max(8, Math.round(st.atk * 1.05));
            e.hp = Math.max(1, e.hp - splatDmg);
            recordDamageTelemetry(splatDmg, "combo_morph");
            if (hitProp && hitProp.destructible) damageBattleProp(hitProp, st.atk * 1.2);
            addFloat("💥 破壁崩震 · 浮空追击！", testClamp.x, testClamp.y - e.r - 32, "#ffd97d", 19, true);
          }
        }
        e.kx *= 0.82; e.ky *= 0.82;
      }
      let targetSx = 1.0, targetSy = 1.0;
      if (e.state === "windup") {
        if (e.id === "warden") { targetSx = 0.90; targetSy = 1.16; }
        else if (e.id === "wolf") { targetSx = 1.15; targetSy = 0.82; }
        else { targetSx = 1.14; targetSy = 0.86; }
      } else if (e.state === "lunge") {
        if (e.id === "wolf") { targetSx = 1.24; targetSy = 0.80; }
        else { targetSx = 0.88; targetSy = 1.14; }
      } else if (e.state === "recover") {
        if (e.id === "warden") { targetSx = 1.10; targetSy = 0.88; }
        else { targetSx = 0.92; targetSy = 1.08; }
      }
      e.sx += (targetSx - e.sx) * 0.22;
      e.sy += (targetSy - e.sy) * 0.22;

      if (e.isDummy) { stepDojoDummyAI(e, dt); continue; }
      if (e.isTreasure) {
        e.timer -= dt;
        e.x += e.vx; e.y += e.vy;
        if (Math.abs(e.vx) > 0.05) e.facing = e.vx >= 0 ? 1 : -1;
        const cp = clampToPlaza(e.x, e.y, w, h);
        if (Math.abs(cp.x - e.x) > 0.5) e.vx *= -1;
        if (Math.abs(cp.y - e.y) > 0.5) e.vy *= -1;
        e.x = cp.x; e.y = cp.y;
        if (e.timer <= 0) arena.enemies.splice(ei, 1);
        continue;
      }

      const inDomain = arena.domain && Math.hypot(e.x - arena.domain.x, (e.y - arena.domain.y) / 0.62) < arena.domain.r + e.r;
      if (e.flinchTimer > 0) {
        e.flinchTimer = Math.max(0, e.flinchTimer - dt);
        const cf = clampToPlaza(e.x, e.y, w, h);
        e.x = cf.x; e.y = cf.y;
        continue;
      }
      const witchMult = arena.witchTime > 0 ? 0.28 : 1.0;
      if (e.isTitan) { stepColossalTitanAI(e, dt, w, h); }
      if (e.isInnerDemon) stepInnerDemonAI(e, dt, w, h);
      const rushSpdMult = (arena.bossRush && arena.bossRush.active && arena.rushAffixes.includes("rush_haste")) ? 1.25 : 1.0;
      const pactSpdMult = (hasPact(game, "swift_windup") ? 1.20 : 1.0) * rushSpdMult * ((e.hexBuffTimer || 0) > 0 ? 1.22 : 1.0);
      if (e.hexBuffTimer > 0) e.hexBuffTimer = Math.max(0, e.hexBuffTimer - dt);
      const slowMult = (inDomain ? 0.65 : 1.0) * (e.chillTimer > 0 ? 0.70 : 1.0) * (e.enraged ? 1.24 : 1.0) * witchMult * pactSpdMult;
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;

      if (e.state === "chase" && (e.id === "shadow" || e.id === "trial_heart")) {
        e.blinkCd -= dt;
        if (e.blinkCd <= 0 && dist > 110) {
          e.blinkCd = 4.0;
          addRipple(e.x, e.y + 12, 42, "#c792ff");
          const flankPos = clampToPlaza(p.x - p.facing * 95, p.y + (Math.random() - 0.5) * 60, w, h);
          e.x = flankPos.x; e.y = flankPos.y;
          addRipple(e.x, e.y + 12, 48, "#c792ff");
          addFloat("噬影瞬步!", e.x, e.y - 42, "#d69eff", 14);
        }
      }

      if (e.tacticalRole === "shield_vanguard" && (e.frontShieldHp || 0) > 0 && e.state !== "stun") {
        const targetAng = Math.atan2(p.y - e.y, p.x - e.x);
        e.shieldFacing = targetAng;
      }
      if (e.tacticalRole === "hex_chanter" && e.state !== "stun") {
        const frontAlly = arena.enemies.find(o => o !== e && o.hp > 0 && (o.tacticalRole === "shield_vanguard" || o.isBoss));
        if (frontAlly) {
          e.hexLinkTarget = frontAlly;
          frontAlly.hexBuffTimer = 0.6;
        } else e.hexLinkTarget = null;
      }
      if (e.tacticalRole === "flank_assassin" && e.state !== "stun") {
        if ((e.flankTelegraph || 0) > 0) {
          e.flankTelegraph = Math.max(0, e.flankTelegraph - dt * witchMult);
          if (e.flankTelegraph <= 0) {
            addRipple(e.x, e.y + 12, 36, "#ff6b81");
            e.x = e.flankTargetX;
            e.y = e.flankTargetY;
            addRipple(e.x, e.y + 12, 46, "#ff6b81");
            if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 56 && (p.z || 0) < 18) {
              hurtPlayer(Math.round(e.atk * 1.18), { sourceName: e.name || "影袭刺客", moveName: "影袭背刺", isHeavy: false });
              addFloat("🗡 影袭背刺!", p.x, p.y - 46, "#ff7875", 15, true);
            }
            e.flankCd = 4.2 + Math.random() * 1.2;
          }
        } else {
          e.flankCd = (e.flankCd === undefined ? 3.0 : e.flankCd) - dt * slowMult;
          if (e.flankCd <= 0 && dist > 80 && dist < 440 && e.state === "chase") {
            const behind = clampToPlaza(p.x - p.facing * 72, p.y + (Math.random() - 0.5) * 42, w, h);
            e.flankTargetX = behind.x;
            e.flankTargetY = behind.y;
            e.flankTelegraph = 0.68;
            addFloat("⚠ 影袭绕背 · 空格一闪反杀！", e.x, e.y - e.r - 26, "#ff8787", 14, true, { banner: true, perilous: true });
          }
        }
      }
      if (e.isBoss && e.enraged && e.state !== "stun" && !e.partSevered) {
        e.beamCd = (e.beamCd === undefined ? 2.8 : e.beamCd) - dt;
        if (e.beamCd <= 0) {
          e.beamCd = 4.2;
          const bAng = Math.atan2(p.y - e.y, p.x - e.x) - 0.52;
          arena.bossBeams.push({
            x: e.x, y: e.y - 6, startAng: bAng, curAng: bAng, sweep: 1.04,
            t: -0.55, dur: 0.95, len: 390, dmg: Math.round(e.atk * 1.15),
            color: arena.stageIdx === 2 ? "#70ffe6" : "#ff6b6b", hitCd: 0, sourceName: e.name || "狂暴首领"
          });
          arena.shockRings.push({ x: e.x, y: e.y + 14, r: 24, maxR: 290, spd: 185, hitPlayer: false, color: "#ffb142", sourceName: e.name || "秘境首领" });
          addFloat("⚠ 旋空妖光 · 空格一闪穿波！", e.x, e.y - e.r - 24, "#ffe28a", 15, true, { banner: true, perilous: true });
        }
      }
      const enterEnemyRecover = (en, durOverride = null) => {
        const recDur = durOverride !== null ? durOverride : (en.enraged ? 0.36 : (en.id === "warden" ? 0.54 : 0.40));
        en.state = "recover";
        en.recoverTotal = recDur;
        en.timer = recDur;
      };
      if (e.state === "stun") {
        e.timer -= dt;
        if (e.timer <= 0) { e.state = "chase"; e.timer = 0.55; }
      } else if (e.state === "recover") {
        // Explicit post-attack recovery window; facing stays LOCKED until returning to chase!
        if (e.id === "wolf" && (Math.abs(e.vx) > 0.15 || Math.abs(e.vy) > 0.15)) {
          e.x += e.vx * dt * 16;
          e.y += e.vy * dt * 16;
          e.vx *= 0.84;
          e.vy *= 0.84;
        }
        e.timer -= dt * slowMult;
        if (e.timer <= 0) {
          e.vx = 0; e.vy = 0;
          e.state = "chase";
          e.timer = e.enraged ? 0.36 : 0.48;
        }
      } else if (e.state === "chase") {
        if (Math.abs(dx) > 6) e.facing = dx >= 0 ? 1 : -1;
        const moveSpd = (e.isBoss ? 2.15 : 2.35) * slowMult;
        if (e.tacticalRole === "hex_chanter" && dist < 225) {
          e.x -= (dx / dist) * moveSpd * 0.85;
          e.y -= (dy / dist) * moveSpd * 0.85;
        } else if (dist > e.r + (e.tacticalRole === "hex_chanter" ? 265 : 34)) {
          e.x += (dx / dist) * moveSpd;
          e.y += (dy / dist) * moveSpd;
        }
        e.timer -= dt * slowMult;
        if (e.timer <= 0 && dist < (e.attackType === "shot" ? 420 : 285)) {
          e.state = "windup";
          e.atkSeq = (e.atkSeq || 0) + 1;
          // Lock facing once on windup entry; never snap backward mid-attack!
          e.aimX = p.x; e.aimY = p.y;
          if (Math.abs(e.aimX - e.x) > 4) e.facing = (e.aimX >= e.x) ? 1 : -1;
          const canUseJump = isActionUnlockedByRealm(game, "jump");
          const canUseClash = isActionUnlockedByRealm(game, "posture");
          const isMortalWolfKing = e.id === "wolf" && e.isBoss && (!canUseJump || !canUseClash);
          if (isMortalWolfKing) {
            // F28 Mortal-Playable 2-Telegraph Wolf King Rhythm: Gold parryable lunge + Crimson dodgeable 3-claw!
            e.grabWindup = false;
            e.lowSweepWindup = false;
            e.perilous = (e.atkSeq % 3 === 0);
          } else {
            // V19 4-Way Tactical Telegraph Rotation (respecting realm action unlocks!)
            e.grabWindup = canUseClash && e.isBoss && (e.atkSeq % 4 === 3);
            e.lowSweepWindup = canUseJump && !e.grabWindup && ((e.isBoss && e.atkSeq % 4 === 2) || (!e.isBoss && e.attackType === "slam" && e.atkSeq % 2 === 0));
            e.perilous = !e.grabWindup && !e.lowSweepWindup && (e.isBoss ? (e.atkSeq % 4 === 0) : (e.attackType === "slam" && e.atkSeq % 3 === 1));
          }
          e.timer = e.windupDur * ((e.perilous || e.lowSweepWindup || e.grabWindup) ? 1.12 : 0.92) * (e.enraged ? 0.84 : 1.0);
          e.curWindupTotal = e.timer;
          if ((e.id === "puppet" || e.variantTrait === "mirror_pulse") && !e.perilous && !e.lowSweepWindup && !e.grabWindup && !e.partSevered) e.mirrorTimer = e.timer;
          if (e.grabWindup) {
            Sound.perilousGong();
            addFloat("🤜【擒】暗金夺命投 · 出重击/易剑/C魂印正面拼刀反制！", e.x, e.y - e.r - 40, "#ffae33", 16.5, true, { banner: true, perilous: true });
          } else if (e.lowSweepWindup) {
            Sound.perilousGong();
            addFloat("🌊【下段危】地脉裂波 · 按 Z 踏剑跃破！", e.x, e.y - e.r - 38, "#38f9d7", 16.5, true, { banner: true, perilous: true });
          } else if (e.perilous) {
            Sound.perilousGong();
            const sig = BOSS_SIGNATURE_MOVES[e.id];
            if (e.isBoss && sig) addFloat(sig.perilousName, e.x, e.y - e.r - 36, "#ff5e57", 17, true, { banner: true, perilous: true });
          }
        }
      } else if (e.state === "windup") {
        e.timer -= dt * (inDomain ? 0.82 : 1.0) * witchMult;
        if (e.timer <= 0) {
          const atkSpec = getEnemyAttackSpec(e);
          if (e.grabWindup) {
            e.grabWindup = false;
            Sound.drum(0.28);
            const gAng = Math.atan2(e.aimY - e.y, e.aimX - e.x);
            e.x += Math.cos(gAng) * 62;
            e.y += Math.sin(gAng) * 40;
            addRipple(e.x, e.y + 14, 96, "#ffae33");
            if (Math.hypot(p.x - e.x, (p.y - (e.y + 14)) / 0.56) <= (e.r + 58) && (p.z || 0) < 20) {
              hurtPlayer(Math.round(e.heavy * 1.15), { sourceName: e.name || "镇守妖王", moveName: "暗金夺命投", isHeavy: true });
              addFloat("⚠ 被夺命投技擒中！(下次迎击触发拼刀)", p.x, p.y - 54, "#ffae33", 15, true);
            }
            enterEnemyRecover(e, e.enraged ? 0.40 : 0.50);
          } else if (e.lowSweepWindup) {
            e.lowSweepWindup = false;
            Sound.drum(0.24);
            addDecal(e.x, e.y + 14, 0, e.r + 52, "spider_crack");
            arena.groundSweeps.push({
              x: e.x, y: e.y + 14, r: 24, maxR: e.isBoss ? 310 : 230,
              spd: e.isBoss ? 190 : 165, dmg: Math.max(10, Math.round(e.heavy * 0.88)),
              hitPlayer: false, vaulted: false, owner: e
            });
            enterEnemyRecover(e, e.enraged ? 0.40 : 0.52);
          } else if (e.isBoss && e.perilous) {
            // Execute Differentiated Boss Perilous Signature Move!
            const bAng = Math.atan2(e.aimY - e.y, e.aimX - e.x);
            Sound.drum(0.24);
            if (e.id === "wolf") {
              // Wolf King: Triple Blood-Moon Fan Claws!
              (e.partSevered ? [0] : [-0.36, 0, 0.36]).forEach(off => {
                arena.projectiles.push({
                  friendly: false, kind: "crescent", x: e.x, y: e.y,
                  vx: Math.cos(bAng + off) * 9.5, vy: Math.sin(bAng + off) * 9.5,
                  ang: bAng + off, r: 44, dmg: e.heavy, life: 1.35, color: "#ff4d4f",
                  sourceName: e.name || "雾隐狼王", moveName: "血月三连爪"
                });
              });
            } else if (e.id === "warden") {
              // Mountain Colossus: Isometric Ellipse Slam matching visual telegraph!
              addDecal(e.x, e.y + atkSpec.originYOff, 0, 72, "spider_crack");
              arena.shockRings.push({ x: e.x, y: e.y + atkSpec.originYOff, r: 22, maxR: e.partSevered ? 135 : 310, spd: 205, hitPlayer: false, color: "#ffb142", sourceName: e.name || "守山石卫" });
              if (p.invuln <= 0 && Math.hypot(p.x - e.x, (p.y - (e.y + atkSpec.originYOff)) / atkSpec.ellY) <= atkSpec.r) {
                hurtPlayer(e.heavy, { sourceName: e.name || "守山石卫", moveName: "陨岳重击", isHeavy: true });
              }
            } else if (e.id === "serpent") {
              if (!e.partSevered) arena.frostPools.push({ x: e.aimX, y: e.aimY, r: 92, life: 5.5 });
              for (let k = -2; k <= 2; k++) {
                arena.projectiles.push({
                  friendly: false, kind: "orb", x: e.x, y: e.y,
                  vx: Math.cos(bAng + k * 0.22) * 6.8, vy: Math.sin(bAng + k * 0.22) * 6.8,
                  ang: bAng + k * 0.22, r: 13, dmg: e.atk, life: 2.0, color: "#80ecff",
                  sourceName: e.name || "寒潭玄蛇", moveName: "幽潭寒煞弹"
                });
              }
            } else if (e.id === "puppet") {
              for (let q = 0; q < (e.partSevered ? 2 : 4); q++) {
                const qa = bAng + (q * Math.PI) / 2;
                arena.projectiles.push({
                  friendly: false, kind: "crescent", x: e.x, y: e.y,
                  vx: Math.cos(qa) * 9.0, vy: Math.sin(qa) * 9.0,
                  ang: qa, r: 46, dmg: e.heavy, life: 1.5, color: "#ff7875",
                  sourceName: e.name || "古境剑傀", moveName: "十字剑波"
                });
              }
            } else {
              arena.skyBolts.push({ x: e.aimX, y: e.aimY, t: 0, color: "#ff7875" });
              arena.shockRings.push({ x: e.aimX, y: e.aimY, r: 18, maxR: 220, spd: 190, hitPlayer: false, color: "#d69eff", sourceName: e.name || "天门道影" });
              if (p.invuln <= 0 && Math.hypot(p.x - e.aimX, (p.y - e.aimY) / 0.56) <= 76) hurtPlayer(e.heavy, { sourceName: e.name || "天门道影", moveName: "九霄天雷", isHeavy: true });
            }
            e.perilous = false;
            enterEnemyRecover(e, e.enraged ? 0.42 : 0.54);
          } else if (e.attackType === "charge") {
            const cSpec = getEnemyAttackSpec(e);
            const lungeSpd = cSpec.len / cSpec.dur;
            e.lungeStartX = e.x;
            e.lungeStartY = e.y;
            e.lungeAng = cSpec.ang;
            e.lungeLen = cSpec.len;
            e.lungeHalfW = cSpec.halfW;
            e.lungeDur = cSpec.dur;
            e.lungeOriginYOff = cSpec.originYOff;
            e.lungeHitDone = false;
            e.vx = Math.cos(cSpec.ang) * (lungeSpd / 60);
            e.vy = Math.sin(cSpec.ang) * (lungeSpd / 60);
            e.state = "lunge";
            e.timer = cSpec.dur;
          } else if (e.attackType === "slam") {
            const sSpec = getEnemyAttackSpec(e);
            Sound.drum(0.18);
            Sound.slash(true);
            addDecal(e.x, e.y + sSpec.originYOff, 0, sSpec.r * 0.72, "scorch");
            arena.slashes.push({ x: e.x, y: e.y, r: sSpec.r, ang: 0, t: 0, color: "#ff6b6b", heavy: false });
            // Exact isometric ellipse hit check matching telegraph!
            const isoDist = Math.hypot(p.x - e.x, (p.y - (e.y + sSpec.originYOff)) / sSpec.ellY);
            if (p.invuln <= 0 && isoDist <= sSpec.r) {
              hurtPlayer(e.heavy, { sourceName: e.name || "妖兽", moveName: "重劈震地", isHeavy: true });
            }
            if (e.enraged) {
              for (let k = 0; k < 6; k++) {
                const oa = (k * Math.PI * 2) / 6 + 0.3;
                arena.projectiles.push({
                  friendly: false, kind: "orb", x: e.x, y: e.y,
                  vx: Math.cos(oa) * 5.6, vy: Math.sin(oa) * 5.6 * 0.75,
                  ang: oa, r: 12, dmg: e.atk, life: 2.0, color: "#ff6b81",
                  sourceName: e.name || "狂暴妖兽", moveName: "妖元散射"
                });
              }
            }
            enterEnemyRecover(e, e.enraged ? 0.40 : (e.id === "warden" ? 0.56 : 0.44));
          } else {
            const baseAng = Math.atan2(e.aimY - e.y, e.aimX - e.x);
            const angles = e.enraged ? [-0.44, -0.22, 0, 0.22, 0.44] : [-0.24, 0, 0.24];
            const orbCol = e.variantTrait === "chill" ? "#72e6ff" : (e.variantColor || "#ff6b81");
            angles.forEach(off => {
              arena.projectiles.push({
                friendly: false, kind: "orb", x: e.x, y: e.y,
                vx: Math.cos(baseAng + off) * 6.0, vy: Math.sin(baseAng + off) * 6.0,
                ang: baseAng + off, r: 12, dmg: e.atk, life: 2.2, color: orbCol,
                sourceName: e.name || "敌方妖修", moveName: "妖元灵弹"
              });
            });
            enterEnemyRecover(e, e.enraged ? 0.36 : 0.46);
          }
        }
      } else if (e.state === "lunge") {
        // Frame-rate-independent dt-scaled lunge matching shared telegraph corridor!
        const dur = e.lungeDur || 0.28;
        const len = e.lungeLen || 210;
        const ang = Number.isFinite(e.lungeAng) ? e.lungeAng : Math.atan2(e.vy || 0, e.vx || (e.facing || 1));
        const halfW = e.lungeHalfW || 18;
        const stepDist = (len / dur) * dt * witchMult;
        e.x += Math.cos(ang) * stepDist;
        e.y += Math.sin(ang) * stepDist;
        e.timer -= dt * witchMult;
        if (!e.lungeHitDone && p.invuln <= 0) {
          const ox = e.lungeStartX !== undefined ? e.lungeStartX : e.x;
          const oy = (e.lungeStartY !== undefined ? e.lungeStartY : e.y) + (e.lungeOriginYOff || 12);
          const relX = p.x - ox;
          const relY = (p.y + 12) - oy;
          const cosA = Math.cos(ang), sinA = Math.sin(ang);
          const along = relX * cosA + relY * sinA;
          const perp = -relX * sinA + relY * cosA;
          const inCorridor = along >= -16 && along <= len + 16 && Math.abs(perp) <= halfW + 14;
          const nearBody = Math.hypot(p.x - e.x, p.y - e.y) <= e.r + 28;
          if (inCorridor && nearBody) {
            e.lungeHitDone = true;
            hurtPlayer(e.heavy, { sourceName: e.name || "妖兽", moveName: "疾冲扑咬", isHeavy: true });
            e.timer = 0;
            if (e.mech === "drain") e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * 0.08));
          }
        }
        if (e.timer <= 0) {
          enterEnemyRecover(e, e.enraged ? 0.36 : 0.42);
        }
      }
      const ce = clampToPlaza(e.x, e.y, w, h);
      e.x = ce.x; e.y = ce.y;
    }

    for (let i = arena.projectiles.length - 1; i >= 0; i--) {
      const pr = arena.projectiles[i];
      pr.life -= dt;
      if (pr.life <= 0) { arena.projectiles.splice(i, 1); continue; }

      if (pr.kind === "chakram") {
        pr.vx *= 0.90; pr.vy *= 0.90;
        pr.x += pr.vx; pr.y += pr.vy;
        pr.spin = (pr.spin || 0) + dt * 16;
        pr.tickCd = (pr.tickCd || 0) - dt;
        if (pr.tickCd <= 0) {
          pr.tickCd = 0.20;
          for (const hpProp of arena.props.slice()) {
            if (hpProp.destructible && hpProp.hp > 0 && Math.hypot(hpProp.x - pr.x, hpProp.y - pr.y) < hpProp.r + pr.r) {
              damageBattleProp(hpProp, pr.dmg, "wind");
            }
          }
          for (const e of arena.enemies.slice()) {
            if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + pr.r) {
              e.x += (pr.x - e.x) * 0.08;
              e.y += (pr.y - e.y) * 0.08;
              e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
              damageEnemy(e, pr.dmg, false, pr.postureDmg || 11, pr.spin, 1.5, true);
            }
          }
        }
        continue;
      }

      pr.x += pr.vx; pr.y += pr.vy;
      if (pr.friendly) {
        for (const hpProp of arena.props.slice()) {
          if (hpProp.destructible && hpProp.hp > 0 && !pr.pierced.has(hpProp.id) && Math.hypot(hpProp.x - pr.x, hpProp.y - pr.y) < hpProp.r + pr.r * 0.75) {
            pr.pierced.add(hpProp.id);
            damageBattleProp(hpProp, pr.dmg * 0.9);
          }
        }
        for (const e of arena.enemies.slice()) {
          if (!pr.pierced.has(e.uid) && Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + pr.r) {
            pr.pierced.add(e.uid);
            if (pr.addMark) e.swordMarks = Math.min(6, (e.swordMarks || 0) + pr.addMark);
            if (pr.qimenFire) {
              e.burnTimer = 4.0;
              arena.fireZones.push({ x: e.x, y: e.y, r: 72, life: 3.2, tickCd: 0.15 });
            }
            damageEnemy(e, pr.dmg, !!pr.forceCrit, pr.postureDmg || 8, pr.ang, pr.knock || 4.0, !!pr.heavyPosture);
            if (pr.kind !== "crescent" && pr.kind !== "twin_x") { pr.life = 0; break; }
          }
        }
      } else {
        if (p.invuln <= 0 && Math.hypot(p.x - pr.x, p.y - pr.y) < pr.r + 20) {
          hurtPlayer(pr.dmg, {
            sourceName: pr.sourceName || "敌方弹幕",
            moveName: pr.moveName || (pr.kind === "crescent" ? "血月斩波" : "妖元灵弹"),
            isHeavy: pr.kind === "crescent"
          });
          arena.projectiles.splice(i, 1);
        }
      }
    }

    // Magnetic Drops (including Gear Loot Beams! G12: 1800px safe-zone only; 200px during active combat meditation)
    const magnetCfg = getDropMagnetParams();
    const pullRadius = magnetCfg.radius;
    const pullSpd = magnetCfg.speed;
    for (let i = arena.drops.length - 1; i >= 0; i--) {
      const d = arena.drops[i];
      d.vx *= 0.88; d.vy *= 0.88;
      const dx = p.x - d.x, dy = p.y - d.y;
      const dist = Math.hypot(dx, dy) || 1;
      const effectivePull = d.kind === "gear" ? Math.min(DROP_MAGNET_CONFIG.gearRadius, pullRadius) : pullRadius;
      if (dist < effectivePull) { d.x += (dx / dist) * pullSpd; d.y += (dy / dist) * pullSpd; }
      else { d.x += d.vx; d.y += d.vy; }
      if (dist < 36) {
        if (isPracticeModeActive() && d.kind !== "essence") {
          arena.drops.splice(i, 1);
          continue;
        }
        const mult = (hasLaw(game, "destiny_eye") || currentOmen(game).id === "harvest") ? 2 : 1;
        if (d.kind === "gear" && d.gear) {
          Sound.fanfare();
          acquireGearItem(d.gear);
        } else if (d.kind === "qi") {
          gainRealmXp(d.val);
          if (hasLaw(game, "void_haste")) game.stones += 3;
          Sound.qiOrb(Math.floor(Math.random() * 5));
        } else if (d.kind === "stone") {
          game.stones += d.val * (hasLaw(game, "destiny_eye") ? 2 : 1);
          Sound.pluck(587.33, 0.12, 0.04, "sine");
        } else if (["herb", "dew", "core", "jade", "lotus", "soul", "dao"].includes(d.kind)) {
          const gainAmt = (d.kind === "herb" || d.kind === "dew") ? d.val * mult : d.val;
          game.inventory[d.kind] = (game.inventory[d.kind] || 0) + gainAmt;
          const matSpec = ITEMS[d.kind];
          const matColors = { herb: "#4ad2b8", dew: "#80ecff", core: "#ffe28a", jade: "#70ffe6", lotus: "#ffb3e6", soul: "#c792ff", dao: "#ffd86b" };
          Sound.pluck(d.kind === "dao" || d.kind === "soul" ? 783.99 : 659.25, 0.12, 0.045, "triangle");
          queueMaterialPickupFloat(d.kind, matSpec ? matSpec.name : d.kind, gainAmt, matColors[d.kind] || "#ffe28a");
        } else if (d.kind === "sacred_core") {
          const atkRes = grantPermanentStatBonus(game, { atk: 14, source: "general" });
          game.stones += 85;
          game.inventory.core = (game.inventory.core || 0) + 1;
          arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 35);
          Sound.fanfare();
          addFloat(atkRes.grantedAtk > 0
            ? `★ 天工神髓 剑攻+${atkRes.grantedAtk}`
            : `★ 天工神髓 灵石+85`, p.x, p.y - 54, "#ffd86b", 15, true, { banner: false, kind: "pickup" });
        } else if (d.kind === "essence") {
          arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + d.val);
          game.mp = Math.min(st.maxMp, (game.mp || 0) + 18);
          game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.10));
          Sound.qiOrb(5);
          addFloat(`+灵气精魄 剑意+${d.val}%`, p.x, p.y - 42, "#70ffe6", 13, false, { banner: false, kind: "pickup" });
        }
        arena.drops.splice(i, 1);
        updateHud();
      }
    }

    // Interactive Props: Proximity highlights target & displays explicit confirm prompt (never auto-spends or auto-transitions!)
    const INTERACTIVE_PROP_KINDS = new Set([
      "immortal_spring", "ravine_zipline", "sect_defense_trigger", "pedestal",
      "branch_portal", "sanctum_portal", "merchant_npc", "companion_npc",
      "blood_altar", "spire_wager_altar", "bounty_board", "encounter_stele", "elem_stele",
      "cauldron", "taixu_craft_alchemy", "taixu_craft_forge", "portal",
      "tower_next", "ascend_gate", "boon_stele", "map_node_gate", "sanctum_upgrade"
    ]);
    let closestInteract = null;
    let closestInteractDist = Infinity;
    for (let i = 0; i < arena.props.length; i++) {
      const pr = arena.props[i];
      pr.nearby = false;
      pr.progress = 0;
      if (!INTERACTIVE_PROP_KINDS.has(pr.kind)) continue;
      const distP = Math.hypot(p.x - pr.x, p.y - pr.y);
      if (distP < pr.r + 36 && distP < closestInteractDist) {
        closestInteractDist = distP;
        closestInteract = pr;
      }
    }
    if (closestInteract) closestInteract.nearby = true;
    if (arena.nearbyProp !== closestInteract) {
      arena.nearbyProp = closestInteract;
      renderPropInteractHud();
    }

    for (let i = arena.qiStreams.length - 1; i >= 0; i--) {
      const qs = arena.qiStreams[i];
      qs.x += (p.x - qs.x) * 0.18;
      qs.y += (p.y - 14 - qs.y) * 0.18;
      qs.life -= dt;
      if (qs.life <= 0) arena.qiStreams.splice(i, 1);
    }
    for (let i = arena.sparks.length - 1; i >= 0; i--) {
      const sp = arena.sparks[i];
      sp.x += sp.vx; sp.y += sp.vy;
      sp.vz -= 16 * dt;
      sp.z += sp.vz;
      if (sp.z < 0) { sp.z = 0; sp.vz *= -0.45; sp.vx *= 0.72; sp.vy *= 0.72; }
      sp.life -= dt;
      if (sp.life <= 0) arena.sparks.splice(i, 1);
    }
    for (let i = arena.ripples.length - 1; i >= 0; i--) {
      const rp = arena.ripples[i];
      rp.r += (rp.maxR - rp.r) * 0.16 + dt * 32;
      rp.alpha -= dt * 1.15;
      if (rp.alpha <= 0) arena.ripples.splice(i, 1);
    }
    for (let i = arena.deathAnims.length - 1; i >= 0; i--) {
      arena.deathAnims[i].t += dt * 2.1;
      if (arena.deathAnims[i].t >= 1) arena.deathAnims.splice(i, 1);
    }
    for (let i = arena.switchVfxList.length - 1; i >= 0; i--) {
      arena.switchVfxList[i].t += dt * 2.2;
      if (arena.switchVfxList[i].t >= 1) arena.switchVfxList.splice(i, 1);
    }
    for (let i = arena.meteorBursts.length - 1; i >= 0; i--) {
      arena.meteorBursts[i].t += dt * 1.95;
      if (arena.meteorBursts[i].t >= 1) arena.meteorBursts.splice(i, 1);
    }
    for (let i = arena.blinkStreaks.length - 1; i >= 0; i--) {
      arena.blinkStreaks[i].t += dt * 3.8;
      if (arena.blinkStreaks[i].t >= 1) arena.blinkStreaks.splice(i, 1);
    }
    for (let i = arena.soulAvatars.length - 1; i >= 0; i--) {
      arena.soulAvatars[i].t += dt / arena.soulAvatars[i].maxT;
      if (arena.soulAvatars[i].t >= 1) arena.soulAvatars.splice(i, 1);
    }
    for (let i = arena.clashVfxList.length - 1; i >= 0; i--) {
      arena.clashVfxList[i].t += dt * 2.0;
      if (arena.clashVfxList[i].t >= 1) arena.clashVfxList.splice(i, 1);
    }
    for (let i = arena.distortionRings.length - 1; i >= 0; i--) {
      const dr = arena.distortionRings[i];
      dr.t += dt * 2.6;
      dr.r = 16 + (dr.maxR - 16) * (1 - Math.pow(1 - Math.min(1, dr.t), 2.2));
      if (dr.t >= 1) arena.distortionRings.splice(i, 1);
    }
    for (let i = arena.slashes.length - 1; i >= 0; i--) {
      arena.slashes[i].t += dt * 3.4;
      if (arena.slashes[i].t >= 1) arena.slashes.splice(i, 1);
    }
    for (let i = arena.lightnings.length - 1; i >= 0; i--) {
      arena.lightnings[i].t += dt * 5.0;
      if (arena.lightnings[i].t >= 1) arena.lightnings.splice(i, 1);
    }
    for (let i = arena.decals.length - 1; i >= 0; i--) {
      arena.decals[i].alpha -= dt * 0.045;
      if (arena.decals[i].alpha <= 0) arena.decals.splice(i, 1);
    }
    for (let i = arena.floats.length - 1; i >= 0; i--) {
      const f = arena.floats[i];
      const ttl = f.ttl || 1.0;
      f.age += dt;
      const damp = Math.max(0.22, 1 - (f.age / ttl) * 0.72);
      f.x += (f.vx || 0) * damp;
      f.y += f.vy * damp;
      const prog = f.age / ttl;
      f.alpha = prog < 0.62 ? 1.0 : Math.max(0, 1 - (prog - 0.62) / 0.38);
      if (f.age >= ttl || f.alpha <= 0) arena.floats.splice(i, 1);
    }

    updateBossBannerAndRecallOrb();
    updateComboRankSeal();
    updateCooldownMasks();
  }

  function triggerAscendGateAction() {
    if (!game) return;
    if (game.status === "ascended") {
      openEndingModal();
      return;
    }
    if (game.realm === "spirit" && game.xp < REALMS.spirit.xpCap) {
      game.xp = REALMS.spirit.xpCap;
      updateHud();
    }
    if (game.realm === "spirit" || (REALMS[game.realm].xpCap > 0 && game.xp >= REALMS[game.realm].xpCap)) {
      startLiveTribulation();
    } else if (game.realm === "nascent") {
      const cap = REALMS.nascent.xpCap;
      showToast(`元婴期修为尚未圆满（${Math.floor(num(game.xp, 0))}/${cap}），请先周天吐纳或历练攒满修为，再引动化神天劫晋升化神期！`);
    } else {
      showToast("需晋升化神期方可叩开九霄仙门！");
    }
  }

  function renderPropInteractHud() {
    const el = document.getElementById("prop-interact-hud");
    if (!el) return;
    const pr = arena.nearbyProp;
    const onWelcome = document.getElementById("welcome-screen") && document.getElementById("welcome-screen").style.display !== "none";
    if (!game || !pr || onWelcome || arena.paused || cutscene.active || !arena.props.includes(pr)) {
      const hadFocus = Boolean(document.activeElement && el.contains(document.activeElement));
      if (el.style.display !== "none" || el.dataset.propSig) {
        el.style.display = "none";
        el.innerHTML = "";
        el.dataset.propSig = "";
        el.classList.remove("danger-prop");
      }
      if (hadFocus && !onWelcome && !cutscene.active && !drawerOpen) {
        const bd = document.getElementById("modal-backdrop");
        if (!(bd && bd.classList.contains("open"))) {
          restoreTriggerFocus(null);
        }
      }
      return;
    }
    const isDanger = pr.kind === "blood_altar" || pr.kind === "spire_wager_altar" || pr.branch === "elite_loot" || pr.kind === "sect_defense_trigger";
    const subTxt = pr.kind === "blood_altar"
      ? "主动献祭 25% 当前气血 → 本命飞剑永久 +2"
      : pr.kind === "spire_wager_altar"
        ? "主动献祭 25% 当前气血 → 本层通关奇物直升 Lv.+2 & 双倍灵石"
        : pr.kind === "cauldron" && !arena.sanctumMode
          ? `消耗凝气草 ×2 凝练回春仙丹（当前持有 ${Math.max(0, Math.floor(num(game.inventory.herb, 0)))}）`
          : (pr.badge || "点击或按 Enter 确认交互");
    const sig = `${pr.id || pr.kind}|${pr.name}|${subTxt}|${isDanger ? 1 : 0}`;
    if (el.dataset.propSig === sig && el.style.display === "flex") return;
    const hadFocus = Boolean(document.activeElement && el.contains(document.activeElement));
    el.dataset.propSig = sig;
    el.classList.toggle("danger-prop", isDanger);
    el.style.display = "flex";
    el.innerHTML = `
      <span class="prop-interact-key">Enter / 点击</span>
      <div style="display:flex;flex-direction:column;gap:1px;min-width:0;">
        <strong style="font-size:12px;color:#fff2c4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(pr.name)}</strong>
        <span style="font-size:10.5px;color:${isDanger ? "#ffb4ae" : "var(--jade)"};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(subTxt)}</span>
      </div>
      <button type="button" id="btn-prop-interact" class="${isDanger ? "btn-gold" : "btn-jade"}" style="padding:4px 11px;font-size:11px;white-space:nowrap;" data-action="interact-nearby-prop">确认</button>
    `;
    if (hadFocus) {
      const btn = document.getElementById("btn-prop-interact");
      if (btn && isElementFocusable(btn)) {
        try { btn.focus({ preventScroll: true }); } catch (e) {}
      }
    }
  }

  function interactWithProp(pr) {
    if (!game || !pr) return false;
    const idx = arena.props.indexOf(pr);
    if (idx < 0) return false;
    const st = getCombatStats(game);
    const p = arena.player;

    if (pr.kind === "pedestal") {
      if (!guardNotInTribulation("古莲抉择")) return false;
      activatePedestalChoice(pr);
    } else if (pr.kind === "branch_portal") {
      if (!guardNotInTribulation("秘境分支传送")) return false;
      Sound.fanfare();
      enterChosenBranchRoom(pr.branch);
    } else if (pr.kind === "sanctum_portal") {
      if (!guardNotInTribulation("返回听雨洞府")) return false;
      enterSanctumHub();
    } else if (pr.kind === "merchant_npc") {
      toggleDrawer("bag");
    } else if (pr.kind === "sanctum_upgrade") {
      if (!guardNotInTribulation("洞府建筑升阶")) return false;
      openSanctumUpgradeModal();
    } else if (pr.kind === "companion_npc") {
      if (!guardNotInTribulation("故人交互")) return false;
      if (pr.npcId && NPC_META[pr.npcId]) openCompanionInteractModal(pr.npcId);
      else toggleDrawer("story");
    } else if (pr.kind === "bounty_board") {
      openObjectivesModal("bounties");
    } else if (pr.kind === "taixu_craft_alchemy") {
      openTaixuCraftMinigameModal("alchemy");
    } else if (pr.kind === "taixu_craft_forge") {
      openTaixuCraftMinigameModal("forge");
    } else if (pr.kind === "sect_defense_trigger") {
      if (!guardNotInTribulation("护山大阵守卫战")) return false;
      startSectDefenseSiege();
    } else if (pr.kind === "encounter_stele") {
      if (!guardNotInTribulation("上古奇遇碑")) return false;
      Sound.fanfare();
      arena.props.splice(idx, 1);
      openEncounterModal();
    } else if (pr.kind === "elem_stele") {
      arena.stageElement = pr.elem;
      Sound.fanfare();
      const col = pr.elem === "frost" ? "#80ecff" : "#d69eff";
      addRipple(pr.x, pr.y + 18, 95, col);
      addFloat(pr.elem === "frost" ? "剑碑赐福 · 玄冥寒霜附刃！" : "剑碑赐福 · 九霄紫电附刃！", pr.x, pr.y - 44, col, 20, true);
      arena.props.splice(idx, 1);
      saveGame();
      updateHud();
    } else if (pr.kind === "blood_altar") {
      const costHp = Math.max(1, Math.round(game.hp * 0.25));
      if (game.hp <= costHp + 5) {
        showToast("气血过低，强行血祭将危及道心，请先疗伤后再择血祭！");
        return false;
      }
      game.hp = Math.max(10, game.hp - costHp);
      game.bonusSwords = (game.bonusSwords || 0) + 2;
      syncFlyingSwords();
      Sound.fanfare();
      arena.flash = 0.30; arena.flashColor = "#ff6b6b";
      addFloat(`血祭成剑(-${costHp}血) · 飞剑永久 +2！`, pr.x, pr.y - 44, "#ff9e9b", 20, true);
      arena.props.splice(idx, 1);
      saveGame();
      updateHud();
    } else if (pr.kind === "spire_wager_altar") {
      const costHp = Math.max(1, Math.round(game.hp * 0.25));
      if (game.hp <= costHp + 5) {
        showToast("气血过低，强行燃血入局将危及道心，请先疗伤！");
        return false;
      }
      game.hp = Math.max(10, game.hp - costHp);
      if (arena.celestialSpire) arena.celestialSpire.wagerDouble = true;
      const inPractice = isPracticeModeActive();
      const bonusSt = 80 + ((arena.celestialSpire && arena.celestialSpire.floor) || 1) * 20;
      if (!inPractice) game.stones += bonusSt;
      Sound.fanfare();
      arena.flash = 0.28; arena.flashColor = "#ff78c4";
      addFloat(inPractice
        ? `🎲 练习模式燃血演武！-${costHp}血（不发灵石与奇物）`
        : `🎲 燃血赌约成！-${costHp}血 · 奇物双倍直升 & +${bonusSt}灵石！`, pr.x, pr.y - 46, "#ff9eff", 19, true);
      arena.props.splice(idx, 1);
      if (!inPractice) saveGame();
      updateHud();
    } else if (pr.kind === "immortal_spring") {
      if (!guardNotInTribulation("太初满灵泉")) return false;
      game.hp = st.maxHp; game.mp = st.maxMp;
      refillImmortalGourd();
      arena.swordIntent = 100;
      const inPractice = isPracticeModeActive();
      let springMsg = "✨ 沐浴太初满灵泉 · 状态全满、剑意100%！";
      if (!inPractice) {
        const atkRes = grantPermanentStatBonus(game, { atk: 8, source: "general" });
        springMsg = atkRes.grantedAtk > 0
          ? `✨ 沐浴太初满灵泉 · 状态全满、剑意100%且永久剑攻+${atkRes.grantedAtk}！`
          : `✨ 沐浴太初满灵泉 · 状态全满、剑意100%（本境永久剑攻已达上限）！`;
      }
      Sound.fanfare();
      addRipple(pr.x, pr.y + 16, 150, "#70ffe6");
      addFloat(springMsg, pr.x, pr.y - 48, "#80ffea", 19, true);
      arena.props.splice(idx, 1);
      if (!inPractice) saveGame();
      updateHud();
    } else if (pr.kind === "ravine_zipline") {
      if (!guardNotInTribulation("御剑渡渊")) return false;
      triggerSwordGlideRavineDash(pr);
    } else if (pr.kind === "cauldron") {
      if (arena.sanctumMode) {
        toggleDrawer("alchemy");
      } else if (!guardNotInTribulation("灵脉丹鼎炼丹")) {
        return false;
      } else if (!guardNotPracticeMode("丹道炼制")) {
        return false;
      } else if ((game.inventory.herb || 0) >= 2) {
        game.inventory.herb -= 2;
        const count = (hasLaw(game, "nine_pill") || currentOmen(game).id === "alchemy_star") ? 2 : 1;
        game.inventory.healing_pill = (game.inventory.healing_pill || 0) + count;
        const hpRes = grantPermanentStatBonus(game, { hp: 12, source: "alchemy" });
        game.immortalPills += 1;
        unlockAchievement("ach_pill");
        Sound.fanfare();
        addFloat(hpRes.grantedHp > 0
          ? `九转成丹！生命上限+${hpRes.grantedHp} · 丹+${count}`
          : `九转成丹！丹+${count}（本境丹道气血已达上限）`, pr.x, pr.y - 42, "#f8e3ac", 17, true);
        saveGame();
        updateHud();
      } else {
        showToast("灵脉丹鼎凝丹需消耗凝气草 ×2（当前灵草不足）");
        return false;
      }
    } else if (pr.kind === "portal") {
      if (!guardNotInTribulation("阵门传送")) return false;
      if (!pr.toTower && STAGES[pr.nextIdx]) {
        const reqRealm = STAGES[pr.nextIdx].min || "mortal";
        if (rankOf(game.realm) < rankOf(reqRealm)) {
          const rNow = REALMS[game.realm];
          const xpReady = rNow && rNow.xpCap > 0 && game.xp >= rNow.xpCap;
          showToast(`🔒 境界结界封锁：前往【${STAGES[pr.nextIdx].name}】需先晋升【${REALMS[reqRealm].name}期】！${xpReady ? "修为已满，已为你展开渡劫仪轨！" : "请先在当前秘境历练攒满修为后渡劫。"}`);
          addFloat(`🔒 需${REALMS[reqRealm].name}期方可踏入！`, pr.x, pr.y - 44, "#ffb4ae", 17, true);
          if (xpReady) openTribulationPrepModal();
          return false;
        }
      }
      Sound.fanfare();
      initArenaStage(pr.nextIdx, !!pr.toTower);
    } else if (pr.kind === "tower_next") {
      if (!guardNotInTribulation("锁妖塔冲关")) return false;
      Sound.fanfare();
      arena.props.splice(idx, 1);
      spawnCurrentWave();
    } else if (pr.kind === "ascend_gate") {
      if (!guardNotInTribulation("九霄仙门")) return false;
      triggerAscendGateAction();
    } else if (pr.kind === "boon_stele") {
      if (!guardNotInTribulation("秘境道韵碑")) return false;
      openRunBoonDraftModal(pr.nodeId || null, false);
    } else if (pr.kind === "map_node_gate") {
      if (!guardNotInTribulation("秘境星图")) return false;
      openDungeonMapModal();
    } else {
      return false;
    }

    if (!arena.props.includes(arena.nearbyProp)) {
      arena.nearbyProp = null;
    }
    renderPropInteractHud();
    return true;
  }

  function buildDefeatReviewHtml(isTribulation = false) {
    const et = arena.encounterTelemetry || createFreshEncounterTelemetry();
    const lh = et.lastHit;
    let lethalText = "暂无详细致死记录（未记录到敌招命中明细）";
    if (lh && (lh.sourceName || lh.moveName)) {
      const src = [lh.sourceName, lh.moveName].filter(Boolean).join(" · ");
      lethalText = `${escapeHtml(src)}（-${lh.finalDmg} 气血${lh.isHeavy ? " · 重击/危招" : ""}）`;
    } else if (lh) {
      lethalText = `末次受击 -${lh.finalDmg} 气血（暂无详细招式记录）`;
    }
    const factualHints = [];
    if (et.hitsTaken > 0 && et.gourdUsed === 0 && et.healsUsed === 0) {
      factualHints.push("本战未使用仙葫(Q)或回春丹");
    }
    if (lh && lh.isHeavy && et.parryCount === 0 && et.dodgeCount === 0) {
      factualHints.push("危招命中前未触发识破/凝时");
    }
    const hintLine = factualHints.length
      ? `<div style="font-size:var(--fs-xs);color:#ffe28a;">数据提示：${escapeHtml(factualHints.join(" · "))}</div>`
      : "";
    return `
      <div id="defeat-review-panel" class="num-tabular" role="region" aria-label="本战复盘">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
          ${renderSemanticTag("danger", "本战复盘")}
          <span style="font-size:var(--fs-xs);color:var(--text-sub);">依据本局实测数据记录 · 建议仅作导航不自动扣费</span>
        </div>
        <div style="font-size:var(--fs-sm);color:#ffd6d2;"><strong>致死来源：</strong>${lethalText}</div>
        <div style="font-size:var(--fs-xs);color:var(--text-sub);">
          受击 <b style="color:var(--text-main);">${et.hitsTaken}</b> 次（总承伤 <b style="color:var(--text-main);">${et.totalDamageTaken}</b>） ·
          仙葫/丹药 <b style="color:var(--text-main);">${et.gourdUsed}/${et.healsUsed}</b> 次 ·
          识破/凝时 <b style="color:var(--text-main);">${et.parryCount}/${et.dodgeCount}</b> 次 ·
          耗时 <b style="color:var(--text-main);">${num(et.elapsedSec, 0).toFixed(1)}s</b>
        </div>
        ${hintLine}
        <div id="defeat-nav-suggestions">
          <button type="button" class="btn-tertiary btn-ghost" style="padding:4px 10px;font-size:var(--fs-xs);" data-defeat-nav="alchemy" data-defeat-trib="${isTribulation ? "1" : "0"}">💊 撤回洞府 → 去百工炼丹</button>
          <button type="button" class="btn-tertiary btn-ghost" style="padding:4px 10px;font-size:var(--fs-xs);" data-defeat-nav="cultivate" data-defeat-trib="${isTribulation ? "1" : "0"}">⚔ 撤回洞府 → 去修行强化</button>
        </div>
      </div>`;
  }

  function openDefeatDecisionModal(isTribulation = false) {
    if (!game) return;
    if (!defeatPauseToken) defeatPauseToken = acquirePauseToken("defeat", isTribulation ? "tribulation_defeat" : "combat_defeat");
    arena.defeatPending = { isTribulation: !!isTribulation };
    renderPropInteractHud();
    const pills = Math.max(0, Math.floor(num(game.inventory.healing_pill, 0)));
    const gourdCh = Math.max(0, Math.floor(num(game.gourd && game.gourd.charges, 0)));
    const revivesLeft = Math.max(0, 1 - (arena.defeatRevivesUsed || 0));
    const canPillRevive = revivesLeft > 0 && pills >= 1;
    const canGourdRevive = !isTribulation && revivesLeft > 0 && gourdCh >= 2;
    const r = REALMS[game.realm];
    const keptXp = r && r.xpCap > 0 ? Math.round(r.xpCap * 0.75) : Math.max(0, Math.floor(num(game.xp, 0)));
    const reviewHtml = buildDefeatReviewHtml(isTribulation);
    playtestTelemetry.defeatCount += 1;
    const lastHit = arena.encounterTelemetry && arena.encounterTelemetry.recentHits && arena.encounterTelemetry.recentHits.length
      ? arena.encounterTelemetry.recentHits[arena.encounterTelemetry.recentHits.length - 1]
      : null;
    playtestTelemetry.defeatAttribution.push({
      isTribulation: !!isTribulation,
      source: lastHit ? `${lastHit.sourceName || ""}·${lastHit.moveName || ""}` : (isTribulation ? "九霄雷劫" : "未知"),
      ts: Date.now()
    });

    if (isTribulation) {
      const tbNow = arena.tribulation;
      const tribBreakdownLine = tbNow
        ? `⚡ 天劫复盘：余 ${Math.max(0, tbNow.boltsLeft || 0)}/${tbNow.totalBolts || 3} 道天雷 · 已弹反 ${tbNow.parryCount || 0} 次 · 建议雷圈缩至最紧瞬间按【空格一闪】或先炼回春/破境丹再冲关。`
        : "⚡ 天劫复盘：可在紫电雷圈落定瞬间按【空格一闪】弹反，或先返听雨洞府备足丹药与护脉属性后再冲关。";
      openModal(`
        <div class="modal-header">
          <div class="drawer-mural-banner" style="height:86px;width:100%;">
            <img src="${ART.banner_tribulation}" alt="渡劫受挫" />
            <div class="drawer-mural-overlay">
              <div>
                ${renderSemanticTag("danger", "道心垂危 · 天劫反噬")}
                <h2 style="font-family:var(--font-serif);font-size:var(--fs-xl);color:#ffb4ae;margin-top:4px;">紫霄雷劫力竭 · 请择退守或续渡</h2>
              </div>
              <span class="tag-chip" style="border-color:#ff7870;color:#ffb4ae;">本劫续命余 ${revivesLeft} 次</span>
            </div>
          </div>
        </div>
        <div class="modal-body">
          <p style="font-size:var(--fs-sm);color:var(--text-sub);line-height:1.55;">
            天雷贯脉、气血耗尽。系统不会自动扣丹或免费重聚气血——您可主动服丹强续本劫，或散功避劫安全退回整备（保留 75% 境界修为，绝不死档）。
          </p>
          <div id="trib-defeat-breakdown" class="trib-rule-box">${escapeHtml(tribBreakdownLine)}</div>
          ${reviewHtml}
          <div class="defeat-decision-grid">
            <button type="button" class="defeat-opt-btn" data-defeat-act="revive-trib-pill" ${canPillRevive ? "" : "disabled"}>
              <div>
                <div style="font-weight:700;color:#ffe28a;">💊 主动服回春丹 ×1 续渡天劫</div>
                <div style="font-size:var(--fs-xs);color:var(--text-sub);">${canPillRevive ? `消耗回春丹 ×1（当前持有 ${num(pills)}），恢复 50% 气血并获 1.6s 护体无敌` : revivesLeft <= 0 ? "本轮渡劫续命次数已用尽" : "行囊中无回春丹（当前 0 枚）"}</div>
              </div>
              <span class="tag-chip ${canPillRevive ? "mythic" : "is-locked"}">消耗 1 丹</span>
            </button>
            <button type="button" class="defeat-opt-btn retreat" data-defeat-act="abort-tribulation">
              <div>
                <div style="font-weight:700;color:#80ffea;">🕊 散功避劫 · 退回听雨洞府整备</div>
                <div style="font-size:var(--fs-xs);color:var(--text-sub);">中止本次天劫，保留 75% 修为（${num(keptXp)}/${num(r && r.xpCap, 0)}）并携全部装备灵材安全返城</div>
                ${(() => {
                  const abPrev = previewLifespanImpact(game, 18);
                  return `<div id="trib-abort-lifespan-preview" style="font-size:var(--fs-xs);color:${abPrev.crossesAny ? "#ffb4ae" : "#ffd8a8"};margin-top:2px;">⏳ 散功避劫将耗寿 18 月（1.5 载，${abPrev.before.curYears}→${abPrev.after.curYears}/${abPrev.after.maxYears} 载）${abPrev.warningText ? ` · ${escapeHtml(abPrev.warningText)}` : ""}</div>`;
                })()}
              </div>
              <span class="tag-chip done">安全撤离</span>
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <span style="font-size:var(--fs-xs);color:var(--text-sub);">所有战利品均已保全，须由您主动选择后方可继续。</span>
        </div>
      `, false, { kind: "defeat", tier: "critical" });
      return;
    }

    openModal(`
      <div class="modal-header">
        <div class="drawer-mural-banner" style="height:86px;width:100%;">
          <img src="${ART.banner_sanctum}" alt="道心垂危" />
          <div class="drawer-mural-overlay">
            <div>
              ${renderSemanticTag("danger", "道心垂危")}
              <h2 style="font-family:var(--font-serif);font-size:var(--fs-xl);color:#ffb4ae;margin-top:4px;">气血耗尽 · 生死抉择</h2>
            </div>
            <span class="tag-chip" style="border-color:#ff7870;color:#ffb4ae;">本战续命余 ${revivesLeft} 次</span>
          </div>
        </div>
      </div>
      <div class="modal-body">
        <p style="font-size:var(--fs-sm);color:var(--text-sub);line-height:1.55;">
          妖煞攻心、气血归零。请选择主动消耗丹药/仙葫强行重燃战意，或御剑遁走撤回听雨洞府整备炼丹、升级神兵后再战！
        </p>
        ${reviewHtml}
        <div class="defeat-decision-grid">
          <button type="button" class="defeat-opt-btn" data-defeat-act="revive-pill" ${canPillRevive ? "" : "disabled"}>
            <div>
              <div style="font-weight:700;color:#ffe28a;">💊 主动服回春丹 ×1 重燃战意</div>
              <div style="font-size:var(--fs-xs);color:var(--text-sub);">${canPillRevive ? `消耗回春丹 ×1（持有 ${num(pills)}），恢复 55% 气血、2.0s 无敌并震退近身妖兽` : revivesLeft <= 0 ? "本场战斗续命次数已用尽" : "行囊中无回春丹（持有 0 枚）"}</div>
            </div>
            <span class="tag-chip ${canPillRevive ? "mythic" : "is-locked"}">-1 回春丹</span>
          </button>
          <button type="button" class="defeat-opt-btn" data-defeat-act="revive-gourd" ${canGourdRevive ? "" : "disabled"}>
            <div>
              <div style="font-weight:700;color:#80ffea;">🍶 耗仙葫灵酿 ×2 强聚真元</div>
              <div style="font-size:var(--fs-xs);color:var(--text-sub);">${canGourdRevive ? `消耗仙葫灵酿 ×2（余 ${num(gourdCh)} 缕），恢复 45% 气血、1.8s 无敌并震退群妖` : revivesLeft <= 0 ? "本场战斗续命次数已用尽" : `仙葫灵酿不足 2 缕（当前 ${num(gourdCh)}）`}</div>
            </div>
            <span class="tag-chip ${canGourdRevive ? "done" : "is-locked"}">-2 灵酿</span>
          </button>
          <button type="button" class="defeat-opt-btn retreat" data-defeat-act="retreat-sanctum">
            <div>
              <div style="font-weight:700;color:#a8ffec;">🕊 御剑遁走 · 撤回听雨洞府休整</div>
              <div style="font-size:var(--fs-xs);color:var(--text-sub);">保留本趟已拾取的全部仙装、灵石与灵材，重置当前试炼并满状态返城整备</div>
            </div>
            <span class="tag-chip done">保物撤退</span>
          </button>
        </div>
      </div>
      <div class="modal-footer">
        <span style="font-size:var(--fs-xs);color:var(--text-sub);">所有战利品均已保全，须由您主动选择后方可继续。</span>
      </div>
    `, false, { kind: "defeat", tier: "critical" });
  }

  function resolveDefeatChoice(act) {
    if (!game) return;
    const st = getCombatStats(game);
    const p = arena.player;

    if (act === "revive-pill" || act === "revive-trib-pill") {
      if ((arena.defeatRevivesUsed || 0) >= 1 || (game.inventory.healing_pill || 0) < 1) {
        showToast("无法服丹续战，请选择其他抉择！");
        return;
      }
      game.inventory.healing_pill -= 1;
      arena.defeatRevivesUsed = (arena.defeatRevivesUsed || 0) + 1;
      game.hp = Math.round(st.maxHp * (act === "revive-trib-pill" ? 0.50 : 0.55));
      p.invuln = act === "revive-trib-pill" ? 1.6 : 2.0;
      setPlayerAnimState("idle", 0.25);
      arena.defeatPending = null;
      releasePauseToken(defeatPauseToken); defeatPauseToken = null;
      closeModal();
      Sound.fanfare();
      addRipple(p.x, p.y + 18, 155, "#ffe28a");
      arena.enemies.forEach(e => {
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        if (d < 220) {
          e.kx = ((e.x - p.x) / d) * 12;
          e.ky = ((e.y - p.y) / d) * 12;
        }
      });
      addFloat(act === "revive-trib-pill" ? "💊 回春丹续脉 · 重御天劫！" : "💊 丹元重燃 · 破境再战！", p.x, p.y - 54, "#ffe28a", 20, true);
      saveGame();
      updateHud();
      return;
    }

    if (act === "revive-gourd") {
      if ((arena.defeatRevivesUsed || 0) >= 1 || !game.gourd || (game.gourd.charges || 0) < 2) {
        showToast("仙葫灵酿不足或本战续命已用尽！");
        return;
      }
      game.gourd.charges -= 2;
      arena.defeatRevivesUsed = (arena.defeatRevivesUsed || 0) + 1;
      game.hp = Math.round(st.maxHp * 0.45);
      p.invuln = 1.8;
      setPlayerAnimState("idle", 0.25);
      arena.defeatPending = null;
      releasePauseToken(defeatPauseToken); defeatPauseToken = null;
      closeModal();
      Sound.fanfare();
      addRipple(p.x, p.y + 18, 150, "#70ffe6");
      arena.enemies.forEach(e => {
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1;
        if (d < 210) {
          e.kx = ((e.x - p.x) / d) * 11;
          e.ky = ((e.y - p.y) / d) * 11;
        }
      });
      addFloat("🍶 仙葫凝元 · 气血重聚！", p.x, p.y - 54, "#70ffe6", 20, true);
      saveGame();
      updateHud();
      return;
    }

    if (act === "abort-tribulation") {
      const r = REALMS[game.realm];
      arena.tribulation = null;
      arena.defeatPending = null;
      game.tribulationFails = (game.tribulationFails || 0) + 1;
      if (r && r.xpCap > 0) {
        game.xp = Math.min(game.xp, Math.round(r.xpCap * 0.75));
      }
      const failAge = advanceLifespanMonths(18, "tribulation_fail");
      const ageTxt = failAge && failAge.aged > 0 ? `（耗寿 ${failAge.aged} 月）` : "";
      if (Array.isArray(game.journal)) game.journal.unshift(`冲击【${REALMS[r.next || "ascended"].name}】渡劫受挫${ageTxt}，保留七成五修为退返听雨洞府重整道基。`);
      releasePauseToken(defeatPauseToken); defeatPauseToken = null;
      closeModal();
      enterSanctumHub();
      showToast(`⚡ 渡劫受挫${ageTxt} · 已保留 75% 修为安全返洞府，建议炼制破境丹或强化神兵后再冲关！`);
      return;
    }

    if (act === "retreat-sanctum") {
      const wasPractice = isPracticeModeActive();
      arena.defeatPending = null;
      arena.tribulation = null;
      arena.bossRush = null;
      arena.celestialSpire = null;
      arena.sectDefense = null;
      arena.cloudFlight = null;
      arena.customSeedRun = null;
      clearCinematicClashOverlays();
      if (wasPractice || practiceFormalSnapshot) {
        endPracticeModeIsolation();
      } else {
        game.retreats = (game.retreats || 0) + 1;
        if (Array.isArray(game.journal)) game.journal.unshift(`秘境历练力竭御剑遁走（第 ${game.retreats} 次），携战利品安返听雨洞府。`);
      }
      releasePauseToken(defeatPauseToken); defeatPauseToken = null;
      closeModal();
      enterSanctumHub({ skipSave: wasPractice });
      showToast(wasPractice
        ? "🎯 已结束演武练习并返回【听雨洞府】（正式存档与状态未受影响）！"
        : "🕊 已御剑遁回【听雨洞府】· 战利品尽数保全，整备炼丹后再行出征！");
    }
  }

  function hurtPlayer(rawDmg, opts = {}) {
    if (!game || arena.player.invuln > 0 || arena.defeatPending) return;
    if (typeof rawDmg !== "number" || Number.isNaN(rawDmg) || rawDmg <= 0) return;
    const p = arena.player;
    p.meditating = false;
    p.meditateAgeTick = 0;
    if (p.meditateAgedDirty) {
      p.meditateAgedDirty = false;
      if (!sandboxMode && !isPracticeModeActive()) saveGame();
    }
    const st = getCombatStats(game);
    const pactEnemyMult = hasPact(game, "frenzy_hp") ? 1.25 : 1.0;
    const hasLotusSoak = game && game.gourd && Array.isArray(game.gourd.soaks) && game.gourd.soaks.includes("iron_lotus");
    const hyperMult = (p.hyperArmorTimer || 0) > 0 ? (hasLotusSoak ? 0.52 : 0.65) : 1.0;
    const wardMult = (hasGearAffix(game, "xuanwu_ward") ? 0.86 : 1.0) * hyperMult;
    let dmg = applySingleHitCap(rawDmg, st.maxHp, st.dmgReduce, {
      pactEnemyMult,
      wardMult,
      uncapped: Boolean(opts && opts.uncapped)
    });

    if (hasPrimordialAwakening(game, "primordial_aegis") && (p.primordialShieldCd || 0) <= 0 && dmg >= st.maxHp * 0.14) {
      p.primordialShieldCd = 11.0;
      p.shieldHp = Math.max(p.shieldHp || 0, Math.round(st.maxHp * 0.25));
      addFloat("🌌 混元紫气 · 不灭护体激活！", p.x, p.y - 62, "#ffb3ff", 18, true);
    }
    if ((p.shieldHp || 0) > 0) {
      const absorbed = Math.min(p.shieldHp, dmg);
      p.shieldHp -= absorbed;
      dmg -= absorbed;
      Sound.shieldAbsorb("player");
      if (dmg <= 0) {
        p.invuln = 0.32;
        addFloat("灵盾抵御！", p.x, p.y - 44, "#70ffe6", 16);
        updateHud();
        return;
      }
    }

    game.hp = Math.max(0, game.hp - dmg);
    recordEncounterHitTaken({
      sourceName: opts && opts.sourceName ? opts.sourceName : "",
      moveName: opts && opts.moveName ? opts.moveName : "",
      rawDmg,
      finalDmg: dmg,
      isHeavy: !!(opts && opts.isHeavy)
    });
    if (arena.bossRush && arena.bossRush.active) {
      arena.bossRush.hitsTaken = (arena.bossRush.hitsTaken || 0) + 1;
      arena.bossRush.damageTaken = (arena.bossRush.damageTaken || 0) + dmg;
    }
    if (arena.customSeedRun && arena.customSeedRun.active) {
      arena.customSeedRun.hitsTaken = (arena.customSeedRun.hitsTaken || 0) + 1;
    }
    p.invuln = 0.42;
    p.hitFlash = 0.24;
    arena.comboCount = Math.floor(arena.comboCount * 0.5);
    arena.shake = 7;
    Sound.playerHurt(Boolean(opts && opts.isHeavy));
    addFloat(`-${dmg}`, p.x, p.y - 40, "#ff6b6b", 17);
    if (game.hp <= 0) {
      setPlayerAnimState("knockdown", 99);
      if (arena.coop2P && arena.coop2P.active && !arena.coop2P.downed && triggerCoopQiTransferRescue("2p")) {
        setPlayerAnimState("idle", 0.25);
        updateHud();
        return;
      }
      updateHud();
      openDefeatDecisionModal(!!arena.tribulation);
      return;
    }
    // Non-blocking visual recoil/stagger pose (never locks player input!)
    setPlayerAnimState("hit", (opts && opts.isHeavy) ? 0.28 : 0.20, { recoilDir: -p.facing });
    updateHud();
  }

  function activatePedestalChoice(pr) {
    if (!game || game.openingChoice) return;
    const choice = (typeof pr === "string") ? pr : (pr && pr.choice);
    if (choice !== "help" && choice !== "trade") return;
    game.openingChoice = choice;
    game.vol1PedestalMeta = { choice, payoffShown: false };
    playtestTelemetry.pedestalChoice = choice;
    if (playtestTelemetry.pedestalChoiceSec === null) {
      playtestTelemetry.pedestalChoiceSec = Number(((Date.now() - playtestTelemetry.sessionStartedAt) / 1000).toFixed(2));
    }
    if (choice === "help") {
      game.aids.shen = true;
      game.dao.benevolence += 10;
      acquireGearItem({
        uid: "g_shen_gift", slot: "armor", rarity: 1, name: "灵品·青莲药师袍", art: "icon_heart",
        atk: 0, hp: 34, dr: 4, crit: 0, spd: 0, bonusSword: 0, price: 65, sell: 26, power: 38
      });
      addFloat("结契【沈清禾】· 获赐青莲药师袍！", arena.player.x, arena.player.y - 54, "#4ad2b8", 20, true);
    } else {
      game.bonusSwords = (game.bonusSwords || 0) + 1;
      game.dao.edge += 10;
      acquireGearItem({
        uid: "g_sword_gift", slot: "weapon", rarity: 1, name: "灵品·惊鸿青霜剑", art: "relic_frost_sword",
        atk: 10, hp: 0, dr: 0, crit: 0.04, spd: 0, bonusSword: 0, price: 68, sell: 28, power: 44
      });
      syncFlyingSwords();
      addFloat("参透《惊鸿剑诀》· 飞剑+1 且获惊鸿剑！", arena.player.x, arena.player.y - 54, "#f8e3ac", 20, true);
    }
    Sound.fanfare();
    arena.props = arena.props.filter(x => x.kind !== "pedestal" && x.id !== "shen_rescue");
    const canvas = document.getElementById("fx-canvas");
    const w = (canvas && canvas.width) || window.innerWidth || 1440;
    const h = (canvas && canvas.height) || window.innerHeight || 900;
    const act1Pos = clampToPlaza(w * 0.66, h * 0.45, w, h);
    const hubPos = clampToPlaza(w * 0.66, h * 0.64, w, h);
    arena.props.push({
      id: "portal_act1_wilderness", kind: "portal",
      name: "踏入青岚荒野 · 追击雾隐狼王",
      badge: "点击/Enter 开启第一卷五层秘境",
      nextIdx: 0, toTower: false, x: act1Pos.x, y: act1Pos.y, r: 46, progress: 0
    });
    arena.props.push({
      id: "portal_sanctum_prep", kind: "sanctum_portal",
      name: "先返听雨洞府 · 休整炼丹",
      badge: "点击/Enter 熟悉洞府并满酿仙葫",
      x: hubPos.x, y: hubPos.y, r: 42, progress: 0
    });
    if (!game.tutorialDismissed && (game.tutorialStep || 0) < 2) {
      game.tutorialStep = 2;
    }
    if (choice === "help") {
      queueNewUnlockCardsForState(game);
    }
    showToast("✨ 破庙初缘已定！可择阵门【踏入青岚荒野】追击雾隐狼王，或【先返听雨洞府】整备炼丹！");
    saveGame(); updateHud();
  }
