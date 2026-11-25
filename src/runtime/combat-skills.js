  // ==================== 7. COMBAT SKILLS, SYNERGIES & TAIXU DOMAIN ====================
  function pushBladeArc(x, y, ang, r, color, dir = 1, heavy = false, form = "arc") {
    arena.bladeArcs.push({ x, y, ang, r, color, dir, heavy, form, t: 0 });
    if (arena.bladeArcs.length > 14) arena.bladeArcs.shift();
  }

  function fireManualSlash(fromClone = false, originX = null, originY = null, forcedStep = null) {
    if (!game) return;
    const p = arena.player;
    const st = getCombatStats(game);
    const zenMult = !fromClone ? consumeZenEmpowerment() : 1.0;

    if (!fromClone && arena.cloudFlight && arena.cloudFlight.active) {
      fireCloudSeaSwordBarrage();
      return;
    }
    if (!fromClone && arena.astralForm && arena.astralForm.active) {
      if (p.slashCd > 0) return;
      p.slashCd = 0.22 / st.atkHaste;
      let aAng = Math.atan2(pointer.y - p.y, pointer.x - p.x);
      const aLock = acquireSoftLockTarget(p.x, p.y, aAng);
      if (aLock) aAng = Math.atan2(aLock.y - p.y, aLock.x - p.x);
      p.facing = Math.cos(aAng) >= 0 ? 1 : -1;
      const af = arena.astralForm;
      // Check Titan-vs-Titan Clash against Colossal Zhulong OR Boss windup/lunge!
      const clashBoss = arena.enemies.find(e => e.hp > 0 && (e.isTitan || (e.isBoss && (e.state === "windup" || e.state === "lunge" || !af.clashTriggered))) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 240);
      if (clashBoss && !af.clashTriggered && !arena.titanDualClash) {
        triggerTitanVsTitanClash(clashBoss);
        return;
      }
      Sound.coreSeverBoom();
      Sound.slash(true, 3);
      pushBladeArc(p.x + Math.cos(aAng) * 48, p.y + Math.sin(aAng) * 28, aAng, 235, af.color, 1, true);
      pushBladeArc(p.x + Math.cos(aAng) * 48, p.y + Math.sin(aAng) * 28, aAng, 205, "#ffffff", -1, true);
      addDecal(p.x + Math.cos(aAng) * 110, p.y + Math.sin(aAng) * 68 + 14, aAng, 96, "spider_crack");
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - (p.x + Math.cos(aAng) * 95), e.y - (p.y + Math.sin(aAng) * 58)) < e.r + 225) {
          e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
          if (af.mode === "demonic") game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.05));
          damageEnemy(e, Math.round(st.atk * (af.mode === "demonic" ? 3.15 : 2.85)), true, 52, aAng, 14, true);
        }
      });
      addFloat(`🔱 法相裂穹巨剑斩！！`, p.x, p.y - 98, af.color, 19, true);
      return;
    }
    // V20 Instant Colossal Titan Climb Finisher (`御剑登天·踏躯逆鳞斩`) when Titan is collapsed!
    if (!fromClone) {
      const collapsedTitan = arena.enemies.find(e => e.isTitan && e.titanCollapsed && !e.climbExecuted && !e.climbInProgress && e.hp > 0);
      if (collapsedTitan && Math.hypot(collapsedTitan.x - p.x, collapsedTitan.y - p.y) < 340) {
        triggerTitanClimbFinisher(collapsedTitan);
        return;
      }
    }
    // V18 Mid-Air 3-Hit Rising Dragon Aerial Combo (`升龙滞空三连斩 -> 第四击自动陨星千钧坠地劈`)!
    if (!fromClone && (p.z || 0) > 14 && !p.plunging) {
      if (p.slashCd > 0) return;
      if ((p.airComboStep || 0) >= 3) {
        triggerMeteorPlunge();
        return;
      }
      const aStep = p.airComboStep || 0;
      p.airComboStep = aStep + 1;
      p.slashCd = 0.17 / st.atkHaste;
      p.vz = Math.max(p.vz || 0, 3.6); // Hover suspension in mid-air!
      let ang = Math.atan2(pointer.y - p.y, pointer.x - p.x);
      const lockTgt = acquireSoftLockTarget(p.x, p.y, ang);
      if (lockTgt) ang = Math.atan2(lockTgt.y - p.y, lockTgt.x - p.x);
      p.facing = Math.cos(ang) >= 0 ? 1 : -1;
      Sound.slash(true, aStep + 1);
      GamepadSystem.rumble(0.36, 0.24, 65);
      const airNames = ["凌霄一式 · 踏云斩!", "凌霄二式 · 追月旋!", "凌霄三式 · 摘星剑轮!"];
      const ks = getKarmaState(game);
      const arcCol = ks.mode === "demonic" ? "#ff4d5e" : "#80ecff";
      pushBladeArc(p.x + Math.cos(ang) * 24, p.y - p.z + Math.sin(ang) * 14, ang, 118 + aStep * 14, arcCol, aStep % 2 === 0 ? 1 : -1, true);
      addFloat(airNames[aStep], p.x, p.y - p.z - 52, "#80ecff", 17, true);
      registerStyleAction("aerial", 85);
      enqueueSanqingEchoAction("slash", { step: aStep, wForm: game.weaponForm || "sword", ang });
      stampNextShanheMantra(p.x, p.y - p.z);
      pushTelemetryInput(`🕊空连S${aStep + 1}`, false);
      const peiCritAmp = hasKeepsake(game, "pei") ? 1.35 : 1.0;
      arena.enemies.slice().forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 145) {
          e.airborneZ = Math.max(e.airborneZ || 0, Math.min(54, p.z * 0.78));
          e.airborneVz = Math.max(e.airborneVz || 0, 3.8);
          e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
          damageEnemy(e, Math.round(st.atk * (1.38 + aStep * 0.24) * zenMult * peiCritAmp), aStep === 2, 22, ang, 3.5, true);
        }
      });
      updateHud();
      return;
    }

    let step = 0;
    if (!fromClone) {
      if (p.slashCd > 0) return;
      step = p.comboWindow > 0 ? (p.comboStep + 1) % 4 : 0;
      p.comboStep = step;
      p.comboWindow = 1.20;
      if (playtestTelemetry.firstAttackMs === null) {
        playtestTelemetry.firstAttackMs = Math.max(0, Date.now() - playtestTelemetry.sessionStartedAt);
        playtestTelemetry.firstAttackSec = Number((playtestTelemetry.firstAttackMs / 1000).toFixed(2));
      }
      setPlayerAnimState(`light${step + 1}`, step === 3 ? 0.34 : 0.24);
      if (game && (game.tutorialStep || 0) === 0 && !game.tutorialDismissed) {
        arena.tutSlashes = (arena.tutSlashes || 0) + 1;
        if (arena.tutSlashes >= 3) advanceOnboardingStep(0);
      }
      if (step === 3 || arena.weaponPosture === "xuanzhong") {
        spawnSpatialSwordRift(p.x + p.facing * 82, p.y + 4, p.facing >= 0 ? 0 : Math.PI);
      }
      p.slashCd = (step === 3 ? 0.39 : step === 2 ? 0.31 : 0.25) / st.atkHaste;
      const baseMpGain = (game.loadout.mind === "talisman_calm" ? 6 : 3) + (step === 3 ? 3 : 0) + (game.loadout.relic === "cloud_mirror" ? 3 : 0);
      const mpGain = Math.max(1, Math.round(baseMpGain * (st.schoolSpec ? st.schoolSpec.mpRegenMult : 1.0)));
      game.mp = Math.min(st.maxMp, (game.mp || 0) + mpGain);
      if ((game.loadout.builder === "sword_guard" || game.loadout.builder === "talisman_build") && (p.guardShieldCd || 0) <= 0) {
        p.guardShieldCd = 1.1;
        const shMult = st.daoBonuses ? st.daoBonuses.shieldMult : 1.0;
        p.shieldHp = Math.min(Math.round(st.maxHp * 0.24 * shMult), (p.shieldHp || 0) + Math.max(3, Math.round(st.maxHp * 0.03 * shMult)));
      }
    } else {
      step = forcedStep !== null ? forcedStep : 0;
    }

    const sx = originX !== null ? originX : p.x;
    const sy = originY !== null ? originY : p.y;
    let ang = Math.atan2(pointer.y - sy, pointer.x - sx);
    let activeTarget = null;
    if (!fromClone) {
      const lockTgt = acquireSoftLockTarget(sx, sy, ang);
      activeTarget = lockTgt;
      if (lockTgt) {
        ang = Math.atan2(lockTgt.y - sy, lockTgt.x - sx);
        const gap = Math.hypot(lockTgt.x - p.x, lockTgt.y - p.y);
        if (gap > (lockTgt.r || 32) + 46 && gap < 215) {
          const snap = Math.min(18, (gap - 58) * 0.24);
          p.x += Math.cos(ang) * snap;
          p.y += Math.sin(ang) * snap * 0.65;
        }
      }
      // Active-driven Flying Sword Synergy: orbiting swords strike WITH player swings instead of AFK auto-clearing!
      if (SWORD_STANCES[arena.stanceIdx].id === "hunt" && arena.swords.length > 0) {
        const synTarget = activeTarget || arena.enemies.find(e => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 380) || arena.props.find(pr => pr.kind === "rough_jade" && pr.hp > 0 && Math.hypot(pr.x - p.x, pr.y - p.y) < 280);
        if (synTarget) {
          const swordSpecBonus = game.school === "sword" ? 1 : 0;
          const launchBudget = step === 3 ? Math.min(4 + swordSpecBonus, arena.swords.length) : Math.min(2, Math.max(1, Math.floor((arena.swords.length + 1) / 3)));
          let launched = 0;
          for (let si = 0; si < arena.swords.length && launched < launchBudget; si++) {
            const sw = arena.swords[si];
            if (sw.state === "orbit") {
              sw.state = "strike";
              sw.target = synTarget;
              sw.isActiveSynergy = true;
              sw.timer = 0.42;
              sw.maxStrikeT = 0.42;
              sw.curveSign = (si % 2 === 0 ? 1 : -1) * (0.65 + (si % 3) * 0.22);
              sw.zDepth = 1;
              launched += 1;
            }
          }
        }
      }
    }
    const wanJian = isWanJianBuild(game);
    const thunderB = isThunderBuild(game);

    if (!fromClone) {
      arena.currentDmgBucket = "combo_morph";
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + (step === 3 ? 8 : 3.5));
      GamepadSystem.rumble(step === 3 ? 0.48 : 0.20, step === 3 ? 0.34 : 0.06, step === 3 ? 95 : 42);
      p.facing = Math.cos(ang) >= 0 ? 1 : -1;
      const lungeDist = step === 3 ? 16 : step === 2 ? 10 : 5.5;
      p.x += Math.cos(ang) * lungeDist;
      p.y += Math.sin(ang) * lungeDist * 0.65;
      p.lean = p.facing * (step % 2 === 0 ? 0.12 : -0.10);
      registerStyleAction("light", step === 3 ? 52 : 34);
      Sound.slash(step >= 2, step);
      // Heavy Posture or 4th Finisher colliding with Boss Grab/Lunge triggers Blade Clash!
      if (arena.weaponPosture === "xuanzhong" || step === 3) {
        const clashTarget = arena.enemies.find(e => e.hp > 0 && (e.grabWindup || (e.isBoss && e.state === "lunge")) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 155);
        if (clashTarget && !arena.bladeClash) {
          startBladeClash(clashTarget, !!clashTarget.grabWindup);
          return;
        }
      }
      // Tier-5 Primordial Weapon Awakening: 【紫气东来·万剑齐鸣】
      if (step === 2 && hasPrimordialAwakening(game, "primordial_wave")) {
        arena.projectiles.push({
          friendly: true, kind: "crescent", x: sx + Math.cos(ang) * 32, y: sy + Math.sin(ang) * 20,
          vx: Math.cos(ang) * 18.0, vy: Math.sin(ang) * 18.0, ang, r: 96,
          dmg: Math.round(st.atk * 1.65), heavyPosture: true, postureDmg: 30, knock: 9, addMark: 2, life: 0.72,
          pierced: new Set(), color: "#ff9eff"
        });
        addFloat("🌌 紫气东来 · 鸿蒙剑罡！", p.x, p.y - 68, "#ffb3ff", 17, true);
      }
      if (step === 3) { Sound.clang(1.18, 0.11); Sound.drum(0.14); }
    }

    const isHeavyPos = !fromClone && arena.weaponPosture === "xuanzhong";
    if (isHeavyPos) p.hyperArmorTimer = 0.36;
    const baseWaveR = (hasLaw(game, "age_might") ? 72 : 52) + (isHeavyPos ? 24 : 0);
    const ksSlash = getKarmaState(game);
    let demonicAmp = 1.0;
    if (!fromClone && ksSlash.mode === "demonic" && game.hp > st.maxHp * 0.28) {
      game.hp = Math.max(Math.round(st.maxHp * 0.25), game.hp - Math.max(1, Math.round(game.hp * 0.015)));
      demonicAmp = 1.22;
    }
    const cosTrail = (game.cosmetics && game.cosmetics.trailSkin) || "ink_jade";
    const elemCol = isHeavyPos ? "#ffb84d"
      : (ksSlash.mode === "demonic" || cosTrail === "crimson_flame") ? "#ff4d5e"
      : cosTrail === "zixiao_thunder" ? "#d69eff"
      : cosTrail === "taixu_prismatic" ? "#ffe28a"
      : wanJian ? "#ffe28a"
      : (arena.stageElement === "frost" || game.loadout.builder === "talisman_frost") ? "#80ecff"
      : thunderB ? "#d69eff" : "#4ad2b8";

    const surgeMult = ((game.loadout.builder === "sword_surge" || game.loadout.builder === "talisman_ember") ? 1.24 : 1.0) * zenMult * demonicAmp;
    const shatterMult = ((game.loadout.finisher === "sword_shatter" || game.loadout.finisher === "talisman_rupture") ? 1.45 : 1.0) * zenMult;

    const curPlayable = getActivePlayableSpec();
    const charAtkAmp = curPlayable.atkMult * ((p.ravineBuffTimer || 0) > 0 ? 1.25 : 1.0) * (game.sectDefenseCleared ? 1.06 : 1.0);
    if (!fromClone && curPlayable.id === "shen" && step % 2 === 1) {
      game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.035));
    }
    if (!fromClone) {
      stampNextShanheMantra(sx + Math.cos(ang) * 42, sy + Math.sin(ang) * 24);
      const customSeq = ensureCustomComboSeq(game);
      if (customSeq.enabled) {
        const modId = customSeq.slots[step % 4] || "sword_crescent";
        executeComboSequencerModule(modId, sx, sy, ang, st, false, null);
        enqueueSanqingEchoAction("seq_module", { step, modId, ang });
        updateHud();
        return;
      }
      enqueueSanqingEchoAction("slash", { step, wForm: game.weaponForm || "sword", ang });
    }
    const wForm = (!fromClone && game && game.weaponForm) ? game.weaponForm : "sword";
    if (!fromClone && wForm === "chakram") {
      p.slashCd *= 0.76; // +30% Chakram high-speed cutting cadence!
    }

    if (!fromClone && wForm === "spear") {
      // 【龙胆裂空剑枪】: Steps 0/1/2 Piercing Dragon-Lance Thrust (`220px` armor-break) + Step 3 Coiling-Dragon 220° Sweep!
      registerStyleAction("spear", step === 3 ? 68 : 46);
      if (step < 3) {
        const reach = 225;
        pushBladeArc(sx, sy, ang, reach * 0.72, "#ffd166", step % 2 === 0 ? 1 : -1, true, "spear_thrust");
        arena.blinkStreaks.push({ x1: sx, y1: sy - 8, x2: sx + Math.cos(ang) * reach, y2: sy + Math.sin(ang) * reach * 0.65 - 8, t: 0, color: "#ffe28a" });
        // Linear piercing armor-shatter hit check along the 225px spear shaft!
        const ex = sx + Math.cos(ang) * reach, ey = sy + Math.sin(ang) * reach * 0.65;
        const vx = ex - sx, vy = ey - sy, vLen2 = vx * vx + vy * vy || 1;
        arena.props.slice().forEach(pr => {
          if (pr.destructible && pr.hp > 0) {
            const u = Math.max(0, Math.min(1, ((pr.x - sx) * vx + (pr.y - sy) * vy) / vLen2));
            if (Math.hypot(pr.x - (sx + vx * u), pr.y - (sy + vy * u)) < pr.r + 36) damageBattleProp(pr, st.atk * 1.85);
          }
        });
        arena.enemies.slice().forEach(e => {
          if (e.hp <= 0) return;
          const u = Math.max(0, Math.min(1, ((e.x - sx) * vx + (e.y - sy) * vy) / vLen2));
          if (Math.hypot(e.x - (sx + vx * u), e.y - (sy + vy * u)) < e.r + 44) {
            if ((e.frontShieldHp || 0) > 0) { e.frontShieldHp = 0; addFloat("🔱 龙胆破盾！", e.x, e.y - 44, "#ffd166", 17, true); }
            e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
            damageEnemy(e, Math.round(st.atk * 1.42 * surgeMult * charAtkAmp), true, 28, ang, 10, step === 2);
          }
        });
        if (step === 2) addFloat("🔱 龙胆贯虹刺！", p.x, p.y - 52, "#ffd166", 16, true);
      } else {
        // Step 3: 220-degree Coiling-Dragon Wide Sweep!
        pushBladeArc(sx + Math.cos(ang) * 26, sy + Math.sin(ang) * 16, ang, 162, "#ffd166", 1, true);
        pushBladeArc(sx + Math.cos(ang) * 26, sy + Math.sin(ang) * 16, ang, 142, "#70ffe6", -1, true);
        spawnDistortionRing(sx + Math.cos(ang) * 44, sy + Math.sin(ang) * 26, 175, "#ffd166");
        arena.props.slice().forEach(pr => {
          if (pr.destructible && pr.hp > 0 && Math.hypot(pr.x - sx, pr.y - sy) < pr.r + 185) damageBattleProp(pr, st.atk * 2.1);
        });
        arena.enemies.slice().forEach(e => {
          if (e.hp > 0 && Math.hypot(e.x - sx, e.y - sy) < e.r + 185) {
            e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
            damageEnemy(e, Math.round(st.atk * 1.95 * shatterMult * charAtkAmp), true, 38, Math.atan2(e.y - sy, e.x - sx), 15, true);
          }
        });
        addFloat("🔱 裂空盘龙大横扫！！", p.x, p.y - 56, "#ffe89e", 18, true);
      }
    } else if (!fromClone && wForm === "chakram") {
      // 【太虚回旋剑轮】: High-speed twin moon slashes + Off-Hand Hovering Saw Chakram (`hoverChakrams`)!
      registerStyleAction("chakram", step >= 2 ? 64 : 44);
      pushBladeArc(sx + Math.cos(ang) * 18, sy + Math.sin(ang) * 12, ang - 0.22, 98, "#80ffea", 1, false);
      pushBladeArc(sx + Math.cos(ang) * 18, sy + Math.sin(ang) * 12, ang + 0.22, 98, "#d69eff", -1, step >= 2);
      const hoverX = sx + Math.cos(ang) * (step >= 2 ? 135 : 92);
      const hoverY = sy + Math.sin(ang) * (step >= 2 ? 86 : 58);
      if (!arena.hoverChakrams) arena.hoverChakrams = [];
      arena.hoverChakrams.push({
        x: hoverX, y: hoverY, r: step >= 2 ? 84 : 64, rot: 0,
        life: step >= 2 ? 2.4 : 1.35, tickCd: 0.04,
        dmg: Math.round(st.atk * (step >= 2 ? 0.68 : 0.52) * charAtkAmp),
        color: step >= 2 ? "#d69eff" : "#80ffea"
      });
      if (arena.hoverChakrams.length > 5) arena.hoverChakrams.shift();
      if (step >= 2) addFloat("☸ 离手悬停锯杀轮！", hoverX, hoverY - 38, "#e2b8ff", 16, true);
    } else if (step === 0) {
      pushBladeArc(sx + Math.cos(ang) * 20, sy + Math.sin(ang) * 12, ang, 86, elemCol, 1, false);
      arena.projectiles.push({
        friendly: true, kind: "crescent",
        x: sx + Math.cos(ang) * 28, y: sy + Math.sin(ang) * 28,
        vx: Math.cos(ang) * 13.5, vy: Math.sin(ang) * 13.5,
        ang, r: baseWaveR, dmg: Math.round(st.atk * (fromClone ? 0.65 : 1.15) * surgeMult),
        heavyPosture: isHeavyPos, postureDmg: Math.round((isHeavyPos ? 20 : 9) * zenMult), knock: isHeavyPos ? 11.5 : 4.5, addMark: 1, life: 0.44, pierced: new Set(),
        color: fromClone ? "#f8e3ac" : elemCol
      });
    } else if (step === 1) {
      pushBladeArc(sx + Math.cos(ang) * 22, sy + Math.sin(ang) * 12, ang - 0.18, 92, elemCol, -1, false);
      pushBladeArc(sx + Math.cos(ang) * 22, sy + Math.sin(ang) * 12, ang + 0.18, 92, "#ffe28a", 1, false);
      [-0.14, 0.14].forEach((off, idx) => {
        const a = ang + off;
        arena.projectiles.push({
          friendly: true, kind: "twin_x",
          x: sx + Math.cos(a) * 30, y: sy + Math.sin(a) * 30,
          vx: Math.cos(a) * 14.0, vy: Math.sin(a) * 14.0,
          ang: a, r: baseWaveR + 8, dmg: Math.round(st.atk * (fromClone ? 0.55 : 0.90) * surgeMult),
          heavyPosture: isHeavyPos, postureDmg: Math.round((isHeavyPos ? 22 : 9) * zenMult), knock: isHeavyPos ? 12.5 : 5.5, addMark: 1, life: 0.46, pierced: new Set(),
          color: idx === 0 ? elemCol : "#ffe28a"
        });
      });
    } else if (step === 2) {
      pushBladeArc(sx + Math.cos(ang) * 24, sy + Math.sin(ang) * 14, ang, 108, "#ffe28a", 1, true);
      const fanAngles = (!fromClone && wanJian) ? [-0.26, 0, 0.26] : [0];
      fanAngles.forEach(off => {
        const a = ang + off;
        arena.projectiles.push({
          friendly: true, kind: "chakram",
          x: sx + Math.cos(a) * 34, y: sy + Math.sin(a) * 34,
          vx: Math.cos(a) * 11.8, vy: Math.sin(a) * 11.8,
          ang: a, spin: 0, r: baseWaveR + 14,
          dmg: Math.round(st.atk * (fromClone ? 0.45 : 0.76) * shatterMult),
          postureDmg: Math.round(12 * shatterMult), knock: 2.2, addMark: 1, life: 1.25, tickCd: 0,
          pierced: new Set(), color: "#ffe28a"
        });
      });
      // Build Mutation 1: 【万剑归宗流】 automatically launches Twin Spiral Sword Dragons on Step 2!
      if (!fromClone && wanJian) {
        [-0.32, 0.32].forEach(sOff => {
          arena.projectiles.push({
            friendly: true, kind: "twin_x", x: sx, y: sy - 8,
            vx: Math.cos(ang + sOff) * 16.5, vy: Math.sin(ang + sOff) * 16.5,
            ang: ang + sOff, r: 58, dmg: Math.round(st.atk * 0.95), postureDmg: 12, knock: 5, addMark: 1, life: 0.5,
            pierced: new Set(), color: "#ffe89e"
          });
        });
      }
    } else {
      // 4th Finisher: 【四式·青莲落星斩】 Ink-Dragon Ground Cleave + Spiderweb Fracture!
      if (!fromClone && (game.loadout.finisher === "sword_echo" || game.loadout.finisher === "talisman_return")) {
        game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.06));
        game.mp = Math.min(st.maxMp, game.mp + 8);
      }
      const impX = sx + Math.cos(ang) * 78;
      const impY = sy + Math.sin(ang) * 52;
      pushBladeArc(sx + Math.cos(ang) * 28, sy + Math.sin(ang) * 16, ang, 132, "#ffe89e", -1, true);
      addDecal(impX, impY + 14, ang, 58, "spider_crack");
      arena.lotusVortexes.push({ x: impX, y: impY, r: 108, life: 0.65, maxLife: 0.65, rot: ang, tickCd: 0, dmg: Math.round(st.atk * 1.45 * shatterMult) });
      if (!fromClone) {
        arena.camKickX = Math.cos(ang) * 7;
        arena.camKickY = Math.sin(ang) * 5;
        addFloat("四式 · 青莲落星斩！", p.x, p.y - 54, "#ffe89e", 17, true);
      }
    }

    // Build Mutation 2 & Talisman School Spec: 【紫霄雷符】 triggers 3-target Chain Lightning on finishers!
    if (!fromClone && thunderB && (step === 1 || step === 3)) {
      const talSkillAmp = st.schoolSpec ? st.schoolSpec.skillDmgMult : 1.0;
      triggerChainLightning(sx + Math.cos(ang) * 45, sy + Math.sin(ang) * 30, st.atk * 0.68 * talSkillAmp, 3);
      if (step === 3 && game.school === "talisman") {
        addFloat("⚡ 紫霄雷符 · 链雷贯阵！", p.x, p.y - 74, "#d69eff", 15, true);
      }
    }

    // M2 Run Boon 【剑影回响】: Every 3rd slash launches 3 piercing phantom sword blades!
    if (!fromClone && hasRunBoon("sword_echo")) {
      arena.slashEchoCounter = (arena.slashEchoCounter || 0) + 1;
      if (arena.slashEchoCounter >= 3) {
        arena.slashEchoCounter = 0;
        [-0.22, 0, 0.22].forEach(off => {
          const ea = ang + off;
          arena.projectiles.push({
            friendly: true, kind: "wave", x: sx + Math.cos(ea) * 18, y: sy + Math.sin(ea) * 12,
            vx: Math.cos(ea) * 15.5, vy: Math.sin(ea) * 15.5 * 0.72, ang: ea,
            r: 22, dmg: Math.round(st.atk * 0.92), life: 0.68, color: "#80ffea", pierce: true, hitSet: new Set()
          });
        });
        addFloat("✦ 剑影回响 · 三剑齐射！", p.x, p.y - 62, "#80ffea", 15, true);
      }
    }

    if (!fromClone && (hasLaw(game, "void_haste") || (step >= 2 && hasDestinyFruit(game, "void_phantom")))) {
      const cx = p.x - p.facing * 56, cy = p.y + 18;
      fireManualSlash(true, cx, cy, step);
    }
  }

  function releaseChargedSwordVolley() {
    if (!game) return;
    const p = arena.player;
    const st = getCombatStats(game);
    const zenMult = consumeZenEmpowerment();
    const baseAng = Math.atan2(pointer.y - p.y, pointer.x - p.x);
    p.facing = Math.cos(baseAng) >= 0 ? 1 : -1;
    setPlayerAnimState("heavy", 0.36);

    let mpEmpowered = false;
    if ((game.mp || 0) >= 10) {
      game.mp -= 10;
      mpEmpowered = true;
    }

    Sound.slash(true, 2);
    Sound.clang(1.05, 0.12);
    arena.shake = 9;
    addFloat(mpEmpowered ? "剑元灌注 · 万剑穿云！" : "万剑穿云齐射！", p.x, p.y - 54, mpEmpowered ? "#70ffe6" : "#f8e3ac", 20, true);

    const n = arena.swords.length;
    arena.swords.forEach((sw, i) => {
      const spread = n > 1 ? ((i / (n - 1)) - 0.5) * 0.42 : 0;
      const a = baseAng + spread;
      sw.state = "volley";
      sw.vx = Math.cos(a) * 23;
      sw.vy = Math.sin(a) * 23;
      sw.timer = 0.38;
    });

    const empMult = (mpEmpowered ? 1.35 : 1.0) * (hasDestinyFruit(game, "sword_twin") ? 1.28 : 1.0) * zenMult;
    arena.enemies.slice().forEach(e => {
      const dx = e.x - p.x, dy = e.y - p.y;
      const d = Math.hypot(dx, dy);
      const diff = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - baseAng), Math.cos(Math.atan2(dy, dx) - baseAng)));
      if (d < 450 && diff < 0.38) {
        e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
        damageEnemy(e, Math.round(st.atk * (1.25 + n * 0.15) * empMult), true, 32, baseAng, 9, true);
      }
    });
    updateHud();
  }

  function executeDerivedHeavyMorph(step, st, zenMult) {
    const p = arena.player;
    let ang = Math.atan2(pointer.y - p.y, pointer.x - p.x);
    const lockTgt = acquireSoftLockTarget(p.x, p.y, ang);
    if (lockTgt) ang = Math.atan2(lockTgt.y - p.y, lockTgt.x - p.x);
    p.facing = Math.cos(ang) >= 0 ? 1 : -1;
    p.comboWindow = 0;
    setPlayerAnimState("heavy", 0.36);
    arena.morphCd = 0.55;
    registerStyleAction("morph", 95);
    const morphClashFoe = arena.enemies.find(e => e.hp > 0 && (e.grabWindup || (e.isBoss && (e.perilous || e.state === "lunge"))) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 168);
    if (morphClashFoe && !arena.bladeClash && morphClashFoe.grabWindup) {
      startBladeClash(morphClashFoe, true);
      return;
    }
    arena.currentDmgBucket = "combo_morph";
    arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 12);
    GamepadSystem.rumble(0.56, 0.42, 110);
    arena.props.slice().forEach(pr => {
      if (pr.destructible && pr.hp > 0 && Math.hypot(pr.x - (p.x + Math.cos(ang) * 72), pr.y - (p.y + Math.sin(ang) * 48)) < pr.r + 125) {
        damageBattleProp(pr, st.atk * 2.1);
      }
    });

    // Check See-Through Deflect (`识破·剑反`) against any Golden Parryable Attack in range!
    let seeThrough = false;
    for (const e of arena.enemies.slice()) {
      if (!e.perilous && (e.state === "windup" || e.state === "lunge" || e.mirrorTimer > 0) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 165) {
        seeThrough = true;
        e.mirrorTimer = 0;
        e.state = "chase"; e.timer = 1.1;
        e.flinchTimer = 0.42;
        e.swordMarks = Math.min(6, (e.swordMarks || 0) + 3);
        damageEnemy(e, Math.round(st.atk * 3.4), true, 68, ang, 14, true);
      }
    }
    if (seeThrough) {
      arena.parryCount = (arena.parryCount || 0) + 1;
      if (arena.encounterTelemetry) arena.encounterTelemetry.parryCount += 1;
      const luIntent = hasKeepsake(game, "lu") ? 22 : 0;
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 28 + luIntent);
      onParryOrVaultSuccess();
      triggerImpactFrame(2, "#e62e2d", p.x + Math.cos(ang) * 42, p.y - 18);
      Sound.deflectClang();
      Sound.triggerDucking(420, 0.32, 750);
      GamepadSystem.rumble(0.88, 0.72, 155);
      p.invuln = Math.max(p.invuln, 0.55);
      arena.hitStop = 0.12;
      arena.camZoom = 1.09;
      arena.flash = 0.36; arena.flashColor = "#fff3be";
      addFloat("⚡ 识破 · 万钧剑反！！", p.x, p.y - 68, "#fff6cc", 23, true);
      if (isThunderBuild(game)) {
        arena.thunderOrbs.push({ x: p.x + Math.cos(ang) * 65, y: p.y + Math.sin(ang) * 45, life: 5.0, tickCd: 0.1 });
      }
    }

    const samadhiBonus = p.samadhiFireReady ? 1.55 : 1.0;
    if (p.samadhiFireReady) {
      p.samadhiFireReady = false;
      arena.fireZones.push({ x: p.x + Math.cos(ang) * 76, y: p.y + Math.sin(ang) * 48, r: 96, life: 4.5, tickCd: 0.1 });
      addFloat("🔥 三昧真火 · 炽刃爆燃！", p.x, p.y - 76, "#ff9f43", 20, true);
    }
    if (step === 0) {
      // L1 -> H: 【切手·挑月破军（挑飞浮空 + 升龙跃起追击）】
      Sound.clang(1.22, 0.14);
      Sound.skyLeapWhoosh();
      p.z = Math.max(p.z || 0, 28);
      p.vz = 9.8;
      p.airComboStep = 0;
      pushBladeArc(p.x + Math.cos(ang) * 34, p.y + Math.sin(ang) * 22, ang, 138, "#ffe28a", -1, true);
      addDecal(p.x + Math.cos(ang) * 72, p.y + Math.sin(ang) * 48 + 14, ang, 54, "spider_crack");
      addFloat("切手技 · 挑月升龙破！(接左键空连/右键坠劈)", p.x, p.y - 58, "#ffe28a", 18, true);
      arena.enemies.slice().forEach(e => {
        if (Math.hypot(e.x - (p.x + Math.cos(ang) * 68), e.y - (p.y + Math.sin(ang) * 46)) < e.r + 122) {
          e.flinchTimer = 0.42;
          e.airborneZ = 44;
          e.airborneVz = 5.6;
          e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
          damageEnemy(e, Math.round(st.atk * 2.15 * zenMult * samadhiBonus), true, 40, ang, 7, true);
        }
      });
    } else if (step === 1) {
      // L2 -> H: 【切手·十字裂空斩】
      Sound.clang(1.08, 0.15);
      Sound.drum(0.18);
      const tx = p.x + Math.cos(ang) * 88, ty = p.y + Math.sin(ang) * 58;
      pushBladeArc(tx, ty, ang - 0.65, 145, "#70ffe6", 1, true);
      pushBladeArc(tx, ty, ang + 0.65, 145, "#ffe89e", -1, true);
      addDecal(tx, ty + 14, ang, 68, "spider_crack");
      addFloat("切手技 · 十字裂空斩！", p.x, p.y - 52, "#70ffe6", 18, true);
      arena.enemies.slice().forEach(e => {
        if (Math.hypot(e.x - tx, e.y - ty) < e.r + 132) {
          e.flinchTimer = 0.32;
          e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
          damageEnemy(e, Math.round(st.atk * 2.35 * zenMult), true, 42, ang, 9, true);
        }
      });
    } else {
      // L3/L4 -> H: 【切手·太虚剑莲终式】
      Sound.bianzhong(587.33, 0.10);
      Sound.drum(0.22);
      const lx = arena.enemies[0] ? arena.enemies[0].x : (p.x + Math.cos(ang) * 105);
      const ly = arena.enemies[0] ? arena.enemies[0].y : (p.y + Math.sin(ang) * 68);
      addDecal(lx, ly + 14, 0, 76, "spider_crack");
      arena.lotusVortexes.push({ x: lx, y: ly, r: 142, life: 1.85, maxLife: 1.85, rot: 0, tickCd: 0, dmg: Math.round(st.atk * 1.15 * zenMult) });
      addFloat("切手终式 · 太虚水墨剑莲！", p.x, p.y - 56, "#fff3c4", 20, true);
    }
  }

  function recallAndDetonateSwords() {
    if (!game) return;
    if (arena.cloudFlight && arena.cloudFlight.active) {
      triggerSkyBarrelRollAndShield(true);
      return;
    }
    if (arena.astralForm && arena.astralForm.active && arena.player.comboWindow <= 0.15) {
      castAstralStarRiverBombardment();
      return;
    }
    if (arena.mountState && arena.mountState.active && arena.player.comboWindow <= 0.2) {
      triggerVaultDismountStrike();
      return;
    }
    const p = arena.player;
    if ((p.z || 0) > 14 && !p.plunging) {
      triggerMeteorPlunge();
      return;
    }
    const st = getCombatStats(game);
    const canMorph = p.comboWindow > 0.25 && (arena.morphCd || 0) <= 0;
    if (p.recallCd > 0 && !canMorph) return;
    advanceOnboardingStep(1);
    const zenMult = consumeZenEmpowerment();
    if (canMorph) {
      const samB = p.samadhiFireReady ? 1.55 : 1.0;
      p.samadhiFireReady = false;
      p.comboWindow = 0;
      arena.morphCd = 0.52;
      executeSixAspectAwakeningSkill(st, zenMult, samB);
      updateHud();
      return;
    }
    p.recallCd = arena.domain ? 0.85 : 1.55;
    setPlayerAnimState("heavy", 0.34);
    arena.currentDmgBucket = 'flying_swords';
    arena.props.slice().forEach(pr => { if (pr.destructible && pr.hp > 0 && Math.hypot(pr.x - p.x, pr.y - p.y) < 280) damageBattleProp(pr, st.atk * 1.45); });
    if (hasSynergy(game, 'thunder_emp') || isThunderBuild(game)) triggerElectroPoolReaction(p.x, p.y, st.atk);

    Sound.clang(0.95, 0.15);
    Sound.drum(0.18);
    arena.shake = 11;
    let totalExplosions = 0;
    const keepOneMark = game.loadout.relic === "frost_sword";
    const thunderSyn = hasSynergy(game, "thunder_emp");

    arena.swords.forEach(sw => {
      arena.lightnings.push({ x1: sw.x, y1: sw.y, x2: p.x, y2: p.y, t: 0, color: "#66ffe3" });
      sw.x = p.x + (Math.random() - 0.5) * 24;
      sw.y = p.y + (Math.random() - 0.5) * 24;
      sw.state = "orbit";
      sw.timer = 0.14;
    });

    for (const e of arena.enemies.slice()) {
      const marks = e.swordMarks || 0;
      const pullAng = Math.atan2(p.y - e.y, p.x - e.x);
      if (marks > 0) {
        totalExplosions += marks;
        arena.stageTechDone = true;
        if (!isPracticeModeActive() && !isSanctumDojoActive() && marks >= 2 && game && game.goalStats) game.goalStats.techBreaks = (game.goalStats.techBreaks || 0) + 1;
        if (isSanctumDojoActive()) recordDojoDrillEvent("detonate", marks);
        e.swordMarks = keepOneMark ? 1 : 0;
        addDecal(e.x, e.y + 18, Math.random() * 3, 52, marks >= 3 ? "spider_crack" : "scorch");
        if (isWanJianBuild(game) || getCurioStacks(game, "curio_mark_nova") > 0) {
          arena.skyBolts.push({ x: e.x, y: e.y, t: 0, color: "#ffe28a" });
        }
        spawnSparks(e.x, e.y, 12 + marks * 2, pullAng, 3.1, thunderSyn ? "#d69eff" : "#ffb347");
        arena.slashes.push({ x: e.x, y: e.y, r: 64 + marks * 11, ang: 0, t: 0, color: thunderSyn ? "#d69eff" : "#ff9f43", heavy: true, rain: thunderSyn });
        const synBonus = (thunderSyn ? 1.38 : 1.0) * (hasDestinyFruit(game, "zhuxian_edge") ? 1.55 : 1.0) * (st.schoolSpec ? st.schoolSpec.skillDmgMult : 1.0);
        if (marks >= 5 && hasDestinyFruit(game, "zhuxian_edge")) p.recallCd = Math.min(p.recallCd, 0.55);
        damageEnemy(e, Math.round(st.atk * (1.0 + marks * 0.72) * synBonus * zenMult), true, 22 + marks * 9, pullAng, 6, true);
      } else if (Math.hypot(e.x - p.x, e.y - p.y) < 320) {
        damageEnemy(e, Math.round(st.atk * 0.75 * zenMult), false, 10, pullAng, 3, true);
      }
    }

    if (totalExplosions > 0) {
      if (!isPracticeModeActive() && !isSanctumDojoActive()) unlockAchievement("ach_combo");
      arena.hitStop = 0.085;
      arena.flash = 0.26;
      arena.flashColor = thunderSyn ? "#ebd6ff" : "#ffe8a3";
      addFloat(thunderSyn ? `九天雷帝 · 轰雷 ×${totalExplosions}！` : `万剑归宗 · 爆印 ×${totalExplosions}！`, p.x, p.y - 56, thunderSyn ? "#e2b8ff" : "#ffe8a3", 22, true);
      game.mp = Math.min(st.maxMp, (game.mp || 0) + totalExplosions * 5);
      if (hasRunBoon("recall_nova")) {
        let clearedOrbs = 0;
        for (let pi = arena.projectiles.length - 1; pi >= 0; pi--) {
          const pr = arena.projectiles[pi];
          if (!pr.friendly && Math.hypot(pr.x - p.x, pr.y - p.y) < 240) {
            spawnSparks(pr.x, pr.y, 6, 0, 3.14, "#70ffe6");
            arena.projectiles.splice(pi, 1);
            clearedOrbs += 1;
          }
        }
        spawnDistortionRing(p.x, p.y, 215, "#70ffe6");
        arena.enemies.slice().forEach(ne => {
          if (ne.hp > 0 && Math.hypot(ne.x - p.x, ne.y - p.y) < 225) {
            damageEnemy(ne, Math.round(st.atk * 1.15), false, 18, Math.atan2(ne.y - p.y, ne.x - p.x), 8, true);
          }
        });
        addFloat(clearedOrbs > 0 ? `✦ 万剑归墟 · 震散妖丹×${clearedOrbs}！` : "✦ 万剑归墟 · 剑莲震爆！", p.x, p.y - 78, "#80ffea", 17, true);
      }
    } else {
      addFloat("收剑归鞘！", p.x, p.y - 46, "#66ffe3", 17);
    }
    updateHud();
  }

  function triggerDashParry() {
    if (!game) return;
    if (arena.cloudFlight && arena.cloudFlight.active) {
      triggerSkyBarrelRollAndShield(false);
      return;
    }
    if (arena.player.dashCd > 0) return;
    const p = arena.player;
    if (p.meditating) toggleMeditation(false);
    p.dashCd = 0.95;
    if (arena.enemies.length > 0) advanceOnboardingStep(1);
    p.dashTimer = 0.20;
    p.invuln = 0.46;
    pointer.moveTarget = null;

    let dx = (keysDown["KeyD"] || keysDown["ArrowRight"] ? 1 : 0) - (keysDown["KeyA"] || keysDown["ArrowLeft"] ? 1 : 0);
    let dy = (keysDown["KeyS"] || keysDown["ArrowDown"] ? 1 : 0) - (keysDown["KeyW"] || keysDown["ArrowUp"] ? 1 : 0);
    if (dx === 0 && dy === 0) {
      const ang = Math.atan2(pointer.y - p.y, pointer.x - p.x);
      dx = Math.cos(ang); dy = Math.sin(ang);
    } else {
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
    }
    p.vx = dx * 16.5;
    p.vy = dy * 16.5;
    p.facing = dx >= 0 ? 1 : -1;
    setPlayerAnimState("dodge", 0.24);
    addRipple(p.x, p.y + 30, 44, "rgba(138, 255, 234, 0.65)");
    // Spire Curio 1 (`惊鸿枪影佩`): Dash afterimage automatically fires a piercing Dragon-Lance thrust!
    const dashSpearLv = getCurioStacks(game, "curio_dash_spear");
    if (dashSpearLv > 0) {
      const sTgt = arena.enemies.find(e => e.hp > 0);
      const sAng = sTgt ? Math.atan2(sTgt.y - p.y, sTgt.x - p.x) : Math.atan2(dy, dx);
      pushBladeArc(p.x, p.y, sAng, 145, "#ffd166", 1, true, "spear_thrust");
      arena.blinkStreaks.push({ x1: p.x, y1: p.y - 10, x2: p.x + Math.cos(sAng) * 215, y2: p.y + Math.sin(sAng) * 140 - 10, t: 0, color: "#ffd166" });
      if (sTgt && Math.hypot(sTgt.x - p.x, sTgt.y - p.y) < 250) {
        damageEnemy(sTgt, Math.round(getCombatStats(game).atk * (1.15 + 0.45 * dashSpearLv)), true, 24, sAng, 7, false);
      }
    }
    Sound.pluck(587.33, 0.2, 0.09, "triangle");

    const st = getCombatStats(game);
    const startX = p.x, startY = p.y;
    let parried = false;
    let perfectDodge = false;

    for (const e of arena.enemies.slice()) {
      const nearThreat = Math.hypot(e.x - (p.x + dx * 55), e.y - (p.y + dy * 55)) < e.r + 135 || Math.hypot(e.x - startX, e.y - startY) < e.r + 135;
      if ((e.state === "windup" || e.state === "lunge" || e.mirrorTimer > 0 || (e.flankTelegraph || 0) > 0) && nearThreat) {
        if (e.perilous) {
          // Perilous Red Attack -> Triggers Perfect Dodge Time-Dilation (`极限闪避·太虚凝时`)!
          perfectDodge = true;
          playtestTelemetry.perfectDodgeCount += 1;
        } else {
          // Golden Attack / Assassin Flank Telegraph -> Triggers See-Through Sword Deflect (`识破·万钧剑反`)!
          parried = true;
          e.mirrorTimer = 0;
          e.flinchTimer = 0.38;
          if ((e.flankTelegraph || 0) > 0) {
            e.flankTelegraph = 0;
            e.state = "stun";
            e.timer = 2.5;
            addFloat("⚡ 识破影袭绕背 · 反杀失衡！", e.x, e.y - e.r - 32, "#70ffe6", 19, true);
          }
          e.swordMarks = Math.min(6, (e.swordMarks || 0) + 3);
          const bloodMoonAmp = hasPact(game, "blood_moon") ? 1.35 : 1.0;
          damageEnemy(e, Math.round(st.atk * 3.6 * bloodMoonAmp), true, 64, Math.atan2(dy, dx), 12, true);
        }
      }
    }
    if (hasRunBoon("dash_clone")) {
      arena.jadeDecoys.push({ x: startX, y: startY, facing: p.facing, life: 0.85, maxLife: 0.85, dmg: Math.round(st.atk * 1.65) });
    }
    // Dodging near an active Boss Beam or Shockwave Ring also triggers Perfect Dodge Witch-Time!
    if (!parried && !perfectDodge) {
      if (arena.shockRings.some(sr => Math.abs(Math.hypot(startX - sr.x, (startY - sr.y) / 0.56) - sr.r) < 48)
        || arena.bossBeams.some(bm => bm.t > -0.25 && Math.hypot(startX - bm.x, startY - bm.y) < bm.len)) {
        perfectDodge = true;
      }
    }
    for (let i = arena.projectiles.length - 1; i >= 0; i--) {
      const pr = arena.projectiles[i];
      if (!pr.friendly && Math.hypot(pr.x - p.x, pr.y - p.y) < 125) {
        parried = true;
        spawnSparks(pr.x, pr.y, 10, Math.atan2(dy, dx), 2.2, "#84ffea");
        arena.projectiles.splice(i, 1);
      }
    }
    if (arena.tribulation) {
      for (const strike of arena.tribulation.strikes) {
        if (strike.t > 0.42 && !strike.parried && Math.hypot(strike.x - p.x, strike.y - p.y) < strike.r + 50) {
          strike.parried = true;
          parried = true;
          arena.tribulation.parryCount = (arena.tribulation.parryCount || 0) + 1;
        }
      }
    }

    if (parried) {
      arena.parryCount = (arena.parryCount || 0) + 1;
      if (arena.encounterTelemetry) arena.encounterTelemetry.parryCount += 1;
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 30 + (hasKeepsake(game, "lu") ? 22 : 0));
      onParryOrVaultSuccess();
      triggerImpactFrame(3, "#e62e2d", p.x + dx * 32, p.y + dy * 18);
      Sound.triggerDucking(410, 0.30, 820);
      GamepadSystem.rumble(0.88, 0.70, 150);
      registerStyleAction("deflect", 155);
      pushTelemetryInput("✦识破剑反!", false);
      arena.stageTechDone = true;
      if (!isPracticeModeActive() && !isSanctumDojoActive() && game && game.goalStats) game.goalStats.techBreaks = (game.goalStats.techBreaks || 0) + 1;
      if (!isPracticeModeActive() && !isSanctumDojoActive()) {
        unlockAchievement("ach_break");
        unlockAchievement("ach_combo");
      }
      if (isSanctumDojoActive()) recordDojoDrillEvent("parry");
      bumpCombo(5);
      arena.hitStop = 0.125;
      arena.shake = 15;
      arena.flash = 0.45;
      arena.flashColor = "#fff3be";
      Sound.deflectClang();
      spawnSparks(p.x + dx * 45, p.y + dy * 20, 22, Math.atan2(dy, dx), 2.8, "#fff3be");
      addDecal(p.x + dx * 45, p.y + dy * 45, Math.atan2(dy, dx), 78, "spider_crack");
      pushBladeArc(p.x + dx * 36, p.y + dy * 24, Math.atan2(dy, dx), 156, "#fff3be", 1, true);
      addFloat("当！！识破 · 剑反碎势！", p.x, p.y - 58, "#fff3be", 23, true);
      if (!isPracticeModeActive() && !isSanctumDojoActive()) game.stones += 12;
      game.mp = Math.min(st.maxMp, (game.mp || 0) + 16);
      if (isThunderBuild(game)) {
        arena.thunderOrbs.push({ x: startX, y: startY, life: 5.0, tickCd: 0.1 });
      }
      updateHud();
    } else if (perfectDodge) {
      arena.witchCount = (arena.witchCount || 0) + 1;
      if (arena.encounterTelemetry) arena.encounterTelemetry.dodgeCount += 1;
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 26);
      Sound.triggerDucking(360, 0.25, 1500);
      GamepadSystem.rumble(0.75, 0.82, 190);
      pushTelemetryInput("☯太虚凝时!", false);
      arena.stageTechDone = true;
      if (!isPracticeModeActive() && !isSanctumDojoActive() && game && game.goalStats) game.goalStats.techBreaks = (game.goalStats.techBreaks || 0) + 1;
      if (isSanctumDojoActive()) recordDojoDrillEvent("dodge");
      arena.witchTime = 1.55 + (hasKeepsake(game, "yan") ? 0.45 : 0);
      arena.camZoom = 1.06;
      Sound.bianzhong(659.25, 0.10);
      arena.jadeDecoys.push({ x: startX, y: startY, facing: p.facing, life: 0.72, maxLife: 0.72, dmg: Math.round(st.atk * 2.2) });
      addFloat("☯ 极限闪避 · 太虚凝时！", p.x, p.y - 58, "#70ffe6", 21, true);
      game.mp = Math.min(st.maxMp, (game.mp || 0) + 18);
      if (isThunderBuild(game)) {
        arena.thunderOrbs.push({ x: startX, y: startY, life: 5.0, tickCd: 0.1 });
      }
      updateHud();
    }
    if ((parried || perfectDodge) && hasRunBoon("parry_reset")) {
      p.recallCd = 0;
      p.dashCd = Math.min(p.dashCd, 0.22);
      p.ultCd = Math.max(0, (p.ultCd || 0) - 4.0);
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 25);
      addFloat("✦ 镜花水月 · 冷却全清 +25%剑意！", p.x, p.y - 78, "#ffe28a", 16, true);
    }
    if (hasDestinyFruit(game, "thunder_soul")) {
      for (let k = 0; k < 3; k++) {
        const tx = p.x + (Math.random() - 0.5) * 150;
        const ty = p.y + (Math.random() - 0.5) * 95;
        arena.skyBolts.push({ x: tx, y: ty, t: 0, color: "#d69eff" });
        arena.slashes.push({ x: tx, y: ty, r: 78, ang: 0, t: 0, color: "#d69eff", rain: true });
      }
      arena.enemies.slice().forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < 210) {
          e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
          damageEnemy(e, Math.round(st.atk * 1.35), true, 20, 0, 4, true);
        }
      });
    }
  }

  function castSwordRainUlt() {
    if (!game || arena.player.ultCd > 0) return;
    if (!guardActionRealm("ult")) return;
    const relicMetaCheck = (game.loadout.relic && RELICS[game.loadout.relic]) ? RELICS[game.loadout.relic] : null;
    const mpCost = relicMetaCheck ? (relicMetaCheck.mp + 10) : 24;
    if (!consumePlayerMp(mpCost, relicMetaCheck ? relicMetaCheck.activeName : "太虚剑域")) return;
    const zenMult = consumeZenEmpowerment();
    const stars = getEquippedRelicStars(game);
    arena.player.ultCd = hasLaw(game, "relic_awake") ? 7.5 : 11.0;
    const st = getCombatStats(game);
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;
    const rawTx = arena.enemies.length > 0 ? arena.enemies[0].x : arena.player.x + arena.player.facing * 90;
    const rawTy = arena.enemies.length > 0 ? arena.enemies[0].y : arena.player.y;
    const dPos = clampToPlaza((arena.player.x + rawTx) * 0.5, (arena.player.y + rawTy) * 0.5, w, h);

    const relicId = game.loadout.relic;
    arena.domain = {
      x: dPos.x, y: dPos.y, r: 240 + Math.max(0, stars - 1) * 18,
      life: 6.0 + Math.max(0, stars - 1) * 0.5, maxLife: 6.0 + Math.max(0, stars - 1) * 0.5,
      rot: 0, tickCd: 0.35, relicId
    };

    if (relicId === "jade_seal") {
      arena.player.shieldHp = Math.min(Math.round(st.maxHp * 0.32), (arena.player.shieldHp || 0) + Math.round(st.maxHp * (0.24 + stars * 0.03)));
      arena.player.invuln = Math.max(arena.player.invuln, 1.0);
      addFloat(`玄玉印 ★${stars} · 金钟镇岳盾！`, arena.player.x, arena.player.y - 76, "#ffe28a", 20, true);
    } else if (relicId === "cloud_mirror") {
      game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.25));
      game.mp = Math.min(st.maxMp, game.mp + Math.round(st.maxMp * 0.25));
      arena.projectiles.forEach(pr => {
        if (!pr.friendly) { pr.friendly = true; pr.vx *= -1.6; pr.vy *= -1.6; pr.dmg = st.atk * 1.5; pr.pierced = new Set(); pr.color = "#80ecff"; }
      });
      addFloat(`流云镜 ★${stars} · 返照回春！`, arena.player.x, arena.player.y - 76, "#80ecff", 20, true);
    } else if (relicId === "soul_lamp") {
      arena.enemies.forEach(e => { e.burnTimer = 4.5 + stars; e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2); });
      addFloat(`照魂灯 ★${stars} · 九幽燃魂焰！`, arena.player.x, arena.player.y - 76, "#d69eff", 20, true);
    } else if (relicId === "frost_sword") {
      arena.enemies.forEach(e => { e.chillTimer = 4.0 + stars; e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2); });
      addFloat(`青霜剑 ★${stars} · 霜天封脉！`, arena.player.x, arena.player.y - 76, "#80ecff", 20, true);
    }

    Sound.fanfare();
    Sound.drum(0.26);
    arena.shake = 12;
    arena.flash = 0.30;
    arena.flashColor = "#ffe9a6";
    const relicMeta = relicId && RELICS[relicId] ? RELICS[relicId] : null;
    showRelicDharmaToast(relicMeta ? `☯ 法宝真形 · ${relicMeta.name} ★${stars} 降世` : "☯ 太虚法相 · 万剑归宗剑域");
    Sound.bianzhong(523.25, 0.11);
    arena.camZoom = 1.075;
    addFloat("☯ 太虚剑域 · 法宝真形降世！", arena.player.x, arena.player.y - 56, "#ffe9a6", 22, true);
    // Build Mutation 3: 【红尘同心剑阵流】 Active Companions simultaneously unleash Joint Sword-Array Novas!
    if (arena.activeAllies.length > 0) {
      arena.activeAllies.forEach(al => {
        pushBladeArc(al.x, al.y, 0, 135, al.color, 1, true);
        addRipple(al.x, al.y + 20, 125, al.color);
        arena.enemies.slice().forEach(e => {
          if (Math.hypot(e.x - al.x, e.y - al.y) < 220) {
            e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
            damageEnemy(e, Math.round(st.atk * 1.25), false, 20, 0, 6, true);
          }
        });
      });
      addFloat("★ 故人合璧 · 同心万花剑阵！", arena.player.x, arena.player.y - 82, "#70ffe6", 20, true);
    }

    const castEpoch = arena.stageEpoch;
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        if (!game || arena.stageEpoch !== castEpoch || arena.paused) return;
        const pos = clampToPlaza(dPos.x + (Math.random() - 0.5) * 260, dPos.y + (Math.random() - 0.5) * 170, canvas.width || 1440, canvas.height || 900);
        addDecal(pos.x, pos.y + 12, Math.random() * 3, 34, "slash");
        spawnSparks(pos.x, pos.y, 7, -Math.PI / 2, 2.5, i % 2 === 0 ? "#70ffe6" : "#ffe28a");
        arena.slashes.push({ x: pos.x, y: pos.y, r: 70, ang: Math.PI / 2, t: 0, color: i % 2 === 0 ? "#6be0ff" : "#f8e3ac", rain: true });
        Sound.slash(i % 4 === 0);
        arena.enemies.slice().forEach(e => {
          if (Math.hypot(e.x - pos.x, e.y - pos.y) < e.r + 76) {
            e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
            const domSkillAmp = st.schoolSpec ? st.schoolSpec.skillDmgMult : 1.0;
            damageEnemy(e, Math.round(st.atk * 0.72 * zenMult * domSkillAmp), i % 4 === 0, 10, 0, 2, true);
          }
        });
      }, i * 68);
    }
    updateHud();
  }

  function summonAllyCoop() {
    if (!game || arena.player.allyCd > 0) return;
    if (!guardActionRealm("ally")) return;
    if (!consumePlayerMp(20, "故人助阵")) return;
    arena.player.allyCd = hasLaw(game, "karma_resonance") ? 10.5 : 14.5;
    if (!isPracticeModeActive() && !isSanctumDojoActive()) unlockAchievement("ach_coop");
    const p = arena.player;
    const st = getCombatStats(game);
    const allyCount = Math.max(1, countBondedAllies(game));
    Sound.fanfare();
    Sound.drum(0.20);
    arena.camZoom = 1.045;

    const hasPei = game.aids.pei || Object.keys(game.choices).some(k => k.startsWith("pei"));
    const hasLu = game.aids.lu || Object.keys(game.choices).some(k => k.startsWith("lu"));
    const hasYan = game.aids.yan || Object.keys(game.choices).some(k => k.startsWith("yan"));

    arena.activeAllies = [];
    const roster = [{ id: "shen", name: "沈清禾", art: "actor_shen", color: "#70ffe6", style: "heal_frost" }];
    if (hasPei) roster.push({ id: "pei", name: "裴照", art: "actor_pei", color: "#80ecff", style: "sword_burst" });
    if (hasLu)  roster.push({ id: "lu",  name: "陆玄松", art: "actor_lu", color: "#ffe28a", style: "thunder_ward" });
    if (hasYan) roster.push({ id: "yan", name: "砚尘", art: "actor_yan", color: "#d69eff", style: "seal_domain" });

    roster.slice(0, 3).forEach((al, idx) => {
      const ang = -0.8 + idx * 0.85;
      const ax = p.x + Math.cos(ang) * 76;
      const ay = p.y + Math.sin(ang) * 44;
      addRipple(ax, ay + 22, 68, al.color);
      arena.activeAllies.push({
        id: al.id, name: al.name, art: al.art, color: al.color, style: al.style,
        x: ax, y: ay, facing: p.facing, life: 8.5, maxLife: 8.5, atkCd: 0.45 + idx * 0.25
      });
    });

    arena.zones.push({
      kind: "lotus_heal", x: p.x, y: p.y, r: 145, life: 5.0
    });
    if (hasLu) {
      p.shieldHp = Math.min(Math.round(st.maxHp * 0.30), (p.shieldHp || 0) + Math.round(st.maxHp * 0.24));
      game.mp = Math.min(st.maxMp, (game.mp || 0) + Math.round(st.maxMp * 0.35));
    }
    addFloat(`故人真身降临 ×${roster.slice(0, 3).length} · 协同御敌！`, p.x, p.y - 62, "#ffe89e", 21, true);
    arena.slashes.push({ x: p.x + p.facing * 85, y: p.y, r: 195, ang: p.facing > 0 ? 0 : Math.PI, t: 0, color: "#f8e3ac", heavy: true });

    const mult = 1.65 + allyCount * 0.30;
    arena.enemies.slice().forEach(e => {
      if (Math.hypot(e.x - p.x, e.y - p.y) < 320) {
        e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2 + (hasYan ? 1 : 0));
        damageEnemy(e, Math.round(st.atk * mult), false, 30 + (hasPei ? 18 : 0), Math.atan2(e.y - p.y, e.x - p.x), 8, true);
      }
    });
    updateHud();
  }

  function castPetUltimate() {
    if (!game) return;
    if (!guardActionRealm("pet")) return;
    if (!game.pet || !game.pet.id || !SPIRIT_PETS[game.pet.id]) {
      toggleDrawer("cultivate");
      showToast("请在【修行 → 本命灵兽】中缔结随行灵宠！");
      return;
    }
    if ((arena.petUltCd || 0) > 0) return;
    if (!consumePlayerMp(22, "灵宠觉醒技")) return;
    const sp = SPIRIT_PETS[game.pet.id];
    const p = arena.player;
    const st = getCombatStats(game);
    const swiftOn = hasPetSkill(game, "swift_bond");
    const furyOn = hasPetSkill(game, "fury_fang");
    const wrathOn = hasPetSkill(game, "celestial_wrath");
    const siphonOn = hasPetSkill(game, "soul_siphon");
    const twinOn = hasPetSkill(game, "twin_resonance");
    const lvScale = (1 + ((game.pet.level || 1) - 1) * 0.20) * (furyOn ? 1.35 : 1.0) * (wrathOn ? 1.55 : 1.0);
    const posMult = furyOn ? 1.5 : 1.0;
    const forceCrit = wrathOn;
    arena.petUltCd = Math.max(6.0, (hasLaw(game, "beast_soul") ? 11.0 : 15.5) - (swiftOn ? 2.5 : 0));
    arena.camZoom = 1.055;
    arena.shake = 10;
    Sound.fanfare();
    Sound.drum(0.22);

    if (sp.id === "fox") {
      addFloat("🦊 青丘火狐 · 九尾焚天火莲！", p.x, p.y - 64, "#ff9f68", 21, true);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI * 2) / 8;
        arena.projectiles.push({
          friendly: true, kind: "crescent", x: p.x, y: p.y,
          vx: Math.cos(a) * 12.5, vy: Math.sin(a) * 8.5, ang: a, r: 54,
          dmg: Math.round(st.atk * 1.25 * lvScale), postureDmg: Math.round(16 * posMult), knock: 6, addMark: 2, life: 0.68,
          forceCrit, pierced: new Set(), color: "#ff8a5b"
        });
      }
    } else if (sp.id === "turtle") {
      addFloat("🐢 玄水灵龟 · 玄武不动金钟！", p.x, p.y - 64, "#70ffe6", 21, true);
      game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.28));
      p.shieldHp = Math.min(Math.round(st.maxHp * 0.34), (p.shieldHp || 0) + Math.round(st.maxHp * 0.26 * lvScale));
      p.invuln = Math.max(p.invuln, 1.3);
      addRipple(p.x, p.y + 20, 190, "#70ffe6");
      arena.enemies.slice().forEach(e => {
        e.chillTimer = 4.0;
        damageEnemy(e, Math.round(st.atk * 1.35 * lvScale), forceCrit, Math.round(24 * posMult), Math.atan2(e.y - p.y, e.x - p.x), 10, true);
      });
    } else if (sp.id === "sword_spirit") {
      addFloat("🗡 太虚剑灵 · 百剑归元斩！", p.x, p.y - 64, "#ffe28a", 21, true);
      game.mp = Math.min(st.maxMp, (game.mp || 0) + Math.round(st.maxMp * 0.45));
      p.recallCd = 0;
      arena.enemies.slice().forEach(e => {
        e.swordMarks = 6;
        arena.skyBolts.push({ x: e.x, y: e.y, t: 0, color: "#ffe28a" });
        damageEnemy(e, Math.round(st.atk * 1.75 * lvScale), forceCrit, Math.round(32 * posMult), 0, 6, true);
      });
    } else {
      addFloat("🦅 九霄雷鹏 · 万雷劫狱破！", p.x, p.y - 64, "#d69eff", 21, true);
      arena.enemies.slice().forEach(e => {
        arena.skyBolts.push({ x: e.x, y: e.y, t: 0, color: "#d69eff" });
        e.swordMarks = Math.min(6, (e.swordMarks || 0) + 3);
        damageEnemy(e, Math.round(st.atk * 1.85 * lvScale), forceCrit, Math.round(36 * posMult), 0, 7, true);
      });
    }

    if (twinOn) {
      const liveFoes = arena.enemies.filter(e => e && e.hp > 0);
      for (let k = 0; k < 2 && liveFoes.length > 0; k++) {
        const tgt = liveFoes[k % liveFoes.length];
        if (tgt && tgt.hp > 0) {
          arena.skyBolts.push({ x: tgt.x + (k === 0 ? -18 : 18), y: tgt.y, t: 0, color: "#80ecff" });
          tgt.swordMarks = Math.min(6, (tgt.swordMarks || 0) + 1);
          damageEnemy(tgt, Math.round(st.atk * 0.65 * lvScale), forceCrit, Math.round(14 * posMult), 0, 4, true);
        }
      }
      addFloat("🐾 双灵连击 · 双雷追击！", p.x, p.y - 84, "#80ecff", 16, true);
    }
    if (siphonOn) {
      game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.25));
      game.mp = Math.min(st.maxMp, (game.mp || 0) + 30);
      p.invuln = Math.max(p.invuln, 1.2);
      addFloat("🐾 返璞归元 · 血+25% 灵+30 · 无敌1.2s！", p.x, p.y - 90, "#70ffe6", 16, true);
    }
    if (wrathOn) {
      p.petBuffTimer = 6.0;
      addFloat("🐾 兽魂沸腾 · 攻+16% 速+15% (6s)！", p.x, p.y - 96, "#ffd166", 17, true);
    }
    updateHud();
  }

  function useQuickHealingPill() {
    if (!game) return;
    if (!game.gourd) refillImmortalGourd();
    const hasGourdSip = (game.gourd.charges || 0) > 0;
    const hasReservePill = (game.inventory.healing_pill || 0) > 0;
    if (!hasGourdSip && !hasReservePill) {
      showToast("本命仙葫灵酿已尽 · 识破剑反可回酿，或按 H 回洞府满酿！", { tier: 1, key: "c12_gourd_empty", throttleMs: 4000 });
      return;
    }
    const p = arena.player;
    const st = getCombatStats(game);
    if (hasGourdSip) {
      game.gourd.charges -= 1;
      if (arena.encounterTelemetry) arena.encounterTelemetry.gourdUsed += 1;
    } else {
      game.inventory.healing_pill -= 1;
      if (arena.encounterTelemetry) arena.encounterTelemetry.healsUsed += 1;
    }
    if (!isPracticeModeActive() && !isSanctumDojoActive() && hasDestinyFruit(game, "glutton_pill")) {
      grantPermanentStatBonus(game, { atk: 6, hp: 18, source: "alchemy" });
    }
    const daoHealAmp = st.daoBonuses ? st.daoBonuses.healMult : 1.0;
    const daoShieldAmp = st.daoBonuses ? st.daoBonuses.shieldMult : 1.0;
    const shenAmp = (hasKeepsake(game, "shen") ? 1.25 : 1.0) * (getCurrentCelestialPhase().id === "dawn" ? COMBAT_RULE_PARAMS.celestialPhases.dawn.healAmp : 1.0) * daoHealAmp;
    const heal = Math.round(st.maxHp * (hasPact(game, "bitter_pill") ? 0.36 : 0.46) * shenAmp);
    game.hp = Math.min(st.maxHp, game.hp + heal);
    if (ensurePrimordialCrafts(game).goldenAcolyte) {
      arena.pillAcolyte = { active: true, x: p.x - p.facing * 52, y: p.y - 18, facing: p.facing, life: 14.0, atkCd: 0.25, fireCount: 0 };
      spawnDistortionRing(p.x, p.y, 145, "#ffd166");
      addFloat("👶 丹雷神引 ·【金甲丹童】显圣护法 (14s)！", p.x, p.y - 74, "#ffe28a", 19, true);
    }
    if (hasKeepsake(game, "shen")) {
      p.shieldHp = Math.max(p.shieldHp || 0, Math.round(st.maxHp * 0.18 * daoShieldAmp));
    }
    if (hasRunBoon("gourd_overload")) {
      const goP = COMBAT_RULE_PARAMS.runBoons.gourd_overload;
      p.boonOverloadTimer = goP.durationSec;
      p.gourdHasteTimer = Math.max(p.gourdHasteTimer || 0, goP.durationSec);
      p.hyperArmorTimer = Math.max(p.hyperArmorTimer || 0, goP.hyperArmorSec);
      addFloat(`✦ 仙酿剑狂 · 攻+${Math.round(goP.passiveAtkPct * 100)}% 速+${Math.round(goP.haste * 100)}% 霸体！`, p.x, p.y - 82, "#ffd166", 17, true);
    }

    Sound.gourdSipChime();
    GamepadSystem.rumble(0.35, 0.25, 85);
    const soaks = Array.isArray(game.gourd.soaks) ? game.gourd.soaks : [];
    const soakTags = [];
    if (soaks.includes("iron_lotus")) {
      p.hyperArmorTimer = Math.max(p.hyperArmorTimer || 0, 4.0);
      soakTags.push("金刚霸体");
    }
    if (soaks.includes("samadhi_fire")) {
      p.samadhiFireReady = true;
      soakTags.push("三昧真火附刃");
    }
    if (soaks.includes("wind_feather")) {
      p.gourdHasteTimer = 4.5;
      p.blinkCd = 0;
      soakTags.push("青鸾疾风");
    }
    if (soaks.includes("thunder_ginseng")) {
      soakTags.push("紫霄三雷");
      for (let k = 0; k < 3; k++) {
        const tgt = arena.enemies[k % Math.max(1, arena.enemies.length)];
        const tx = tgt ? tgt.x : (p.x + (k - 1) * 95);
        const ty = tgt ? tgt.y : (p.y + (k % 2 === 0 ? -45 : 45));
        arena.skyBolts.push({ x: tx, y: ty, t: 0, color: "#d69eff" });
        triggerElectroPoolReaction(tx, ty, st.atk * 1.15);
        if (tgt && tgt.hp > 0) damageEnemy(tgt, Math.round(st.atk * 1.35), true, 18, 0, 4, false);
      }
    }
    if (soaks.includes("crimson_vine")) {
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 35);
      p.gourdCritTimer = 5.0;
      soakTags.push("剑意+35%");
    }

    const ks = getKarmaState(game);
    if (ks.mode === "righteous") {
      p.shieldHp = Math.min(Math.round(st.maxHp * 0.50), (p.shieldHp || 0) + Math.round(st.maxHp * 0.22));
      spawnDistortionRing(p.x, p.y, 165, "#70ffe6");
      arena.enemies.slice().forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < 195) {
          damageEnemy(e, Math.round(st.atk * 1.65), false, 24, Math.atan2(e.y - p.y, e.x - p.x), 8, false);
        }
      });
    }

    const lotusSyn = hasSynergy(game, "immortal_lotus");
    if (lotusSyn) {
      p.invuln = Math.max(p.invuln, 2.5);
      addFloat("★ 青莲不灭体 · 仙酿净世！", p.x, p.y - 78, "#ffe28a", 21, true);
    }
    addRipple(p.x, p.y + 28, lotusSyn ? 160 : 95, "#4ad2b8");
    addFloat(`🍶 九转仙葫 +${heal}${soakTags.length ? " · " + soakTags.slice(0, 2).join("/") : ""}`, p.x, p.y - (p.z || 0) - 52, "#70ffe6", 18, true);
    arena.slashes.push({ x: p.x, y: p.y, r: lotusSyn ? 240 : 125, ang: 0, t: 0, color: "#4ad2b8", heavy: lotusSyn });
    if (hasLaw(game, "pill_fire") || lotusSyn) {
      const rad = lotusSyn ? 300 : 195;
      arena.enemies.slice().forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < rad) {
          damageEnemy(e, Math.round(st.atk * (lotusSyn ? 3.4 : 2.45)), true, 32, Math.atan2(e.y - p.y, e.x - p.x), 10, true);
        }
      });
    }
    if (!isPracticeModeActive()) saveGame();
    updateHud();
  }

  function consumeInventoryItem(itemId) {
    if (!game || (game.inventory[itemId] || 0) < 1) return;
    const it = ITEMS[itemId];
    if (!it) return;
    const st = getCombatStats(game);

    if (itemId === "healing_pill") {
      useQuickHealingPill();
      if (drawerOpen) renderDrawerContent();
      return;
    }
    if (itemId === "spirit_pill") {
      game.inventory.spirit_pill -= 1;
      game.mp = st.maxMp;
      arena.player.recallCd = 0;
      arena.player.dashCd = 0;
      arena.player.ultCd = 0;
      arena.player.allyCd = 0;
      Sound.qiOrb(6);
      showToast("服下回灵丹 · 剑元全满且全技能冷却刷新！");
      saveGame(); updateHud();
      if (drawerOpen) renderDrawerContent();
      return;
    }
    if (itemId === "longevity_pill") {
      if (!guardNotInTribulation("渡劫中服延寿丹")) return;
      if (!guardNotPracticeMode("正式服丹成长")) return;
      const prevLf = getLifespanInfo(game);
      game.inventory.longevity_pill -= 1;
      game.lifespanBonusMonths = (game.lifespanBonusMonths || 0) + 360;
      const hpRes = grantPermanentStatBonus(game, { hp: 15, source: "alchemy" });
      const stNew = getCombatStats(game);
      if (hpRes.grantedHp > 0) game.hp = Math.min(stNew.maxHp, game.hp + hpRes.grantedHp);
      const lf = getLifespanInfo(game);
      if (!lf.isExhausted) {
        lifespanExhaustedPromptDismissed = false;
        pendingLifespanExhaustedPrompt = false;
      }
      if (Array.isArray(game.journal)) game.journal.unshift(`服下【延寿青莲丹】，寿元延至 ${lf.maxYears} 载！`);
      Sound.fanfare();
      addRipple(arena.player.x, arena.player.y + 18, 120, "#70ffe6");
      addFloat("🌿 延寿青莲丹 · 寿元 +30 载！", arena.player.x, arena.player.y - 54, "#70ffe6", 18, true);
      const reliefNote = (lf.status !== prevLf.status || lf.xpEfficiencyMult > prevLf.xpEfficiencyMult)
        ? `（寿元警报已解，修炼效率恢复至 ${Math.round(lf.xpEfficiencyMult * 100)}%！）`
        : "";
      showToast(hpRes.grantedHp > 0
        ? `🌿 服下【延寿青莲丹】· 寿元永久 +30 载（${lf.curYears}/${lf.maxYears} 载）且气血上限 +${hpRes.grantedHp}${hpRes.hpCapped ? `（丹道气血已达上限 ${hpRes.pg.alchemyHp}/${hpRes.caps.alchemyHp}）` : ""}！${reliefNote}`
        : `🌿 服下【延寿青莲丹】· 寿元永久 +30 载（${lf.curYears}/${lf.maxYears} 载，本境丹道永久气血已达上限 ${hpRes.pg.alchemyHp}/${hpRes.caps.alchemyHp}）！${reliefNote}`);
      saveGame(); updateHud();
      if (drawerOpen) renderDrawerContent();
      if (activeLifespanModalOpen) {
        activeLifespanModalOpen = false;
        if (drawerOpen) {
          const panel = document.getElementById("jade-panel");
          if (panel && (!lastModalTriggerEl || !lastModalTriggerEl.isConnected || !isElementFocusable(lastModalTriggerEl))) {
            const refreshedTrigger =
              panel.querySelector('#panel-scroll-body [data-use-item="longevity_pill"]') ||
              panel.querySelector('#panel-scroll-body [data-action="open-lifespan-exhausted"]') ||
              panel.querySelector('[data-close-drawer]');
            if (refreshedTrigger && isElementFocusable(refreshedTrigger)) {
              lastModalTriggerEl = refreshedTrigger;
            }
          }
        } else if (lastModalTriggerEl && lastModalTriggerEl.id === "hud-lifespan-badge" && (lastModalTriggerEl.style.display === "none" || !isElementFocusable(lastModalTriggerEl))) {
          const fallbackBtn = document.getElementById("btn-open-profile") || document.getElementById("btn-open-settings");
          if (fallbackBtn && isElementFocusable(fallbackBtn)) {
            lastModalTriggerEl = fallbackBtn;
          }
        }
        closeModal();
      } else if (drawerOpen && !cutscene.active) {
        const panel = document.getElementById("jade-panel");
        const bd = document.getElementById("modal-backdrop");
        if (panel && !(bd && bd.classList.contains("open"))) {
          const refreshedPillBtn = panel.querySelector('#panel-scroll-body [data-use-item="longevity_pill"]');
          if (refreshedPillBtn && isElementFocusable(refreshedPillBtn)) {
            try { refreshedPillBtn.focus({ preventScroll: true }); } catch (e) {}
          } else if (!panel.contains(document.activeElement)) {
            focusDialogSafely(panel);
          }
        }
      }
      return;
    }
    if (itemId === "blood_fury_pill") {
      if (!guardNotInTribulation("渡劫中服嗜血煞丹")) return;
      if (!guardNotPracticeMode("正式服丹成长")) return;
      const caps = getPermGrowthCaps(game);
      if ((game.atkFlatBonus || 0) >= caps.atkFlatBonus) {
        showToast(`本境永久剑攻已达上限（${game.atkFlatBonus}/${caps.atkFlatBonus}），破境后再服【嗜血煞丹】以免白损寿元！`);
        return;
      }
      game.inventory.blood_fury_pill -= 1;
      const atkRes = grantPermanentStatBonus(game, { atk: 10, source: "general" });
      game.karmaScore = Math.max(-100, Math.min(100, (game.karmaScore || 0) - 15));
      advanceLifespanMonths(24, "blood_fury_pill");
      const lf = getLifespanInfo(game);
      if (Array.isArray(game.journal)) game.journal.unshift(`吞服黑市【嗜血煞丹】，剑攻永久+${atkRes.grantedAtk}，折损2载寿元。`);
      Sound.clang(0.95, 0.14);
      addRipple(arena.player.x, arena.player.y + 18, 120, "#ff5263");
      addFloat(`🔥 嗜血煞丹 · 剑攻+${atkRes.grantedAtk} / 魔心-15！`, arena.player.x, arena.player.y - 54, "#ff7888", 18, true);
      showToast(`🔥 吞服【嗜血煞丹】· 剑攻永久 +${atkRes.grantedAtk}${atkRes.atkCapped ? `（已达本境上限 ${game.atkFlatBonus}/${caps.atkFlatBonus}）` : ""}、魔心 -15、骨龄 +2 载（当前 ${lf.curYears}/${lf.maxYears} 载）！`);
      saveGame(); updateHud();
      if (drawerOpen) renderDrawerContent();
      return;
    }
    if (it.kind === "breakthrough") {
      if (!guardNotInTribulation("渡劫中服破境丹")) return;
      if (!guardNotPracticeMode("正式服丹成长")) return;
      game.inventory[itemId] -= 1;
      const r = REALMS[game.realm];
      game.tribShield = (game.tribShield || 0) + 2;
      if (r.xpCap > 0 && game.xp < r.xpCap) {
        gainRealmXp(Math.ceil(r.xpCap * 0.60));
        showToast(`服下【${it.name}】· 修为暴涨60%并凝2层护脉丹障！`);
      } else {
        const hpRes = grantPermanentStatBonus(game, { hp: 18, source: "alchemy" });
        showToast(hpRes.grantedHp > 0
          ? `服下【${it.name}】· 渡劫护脉丹障+2，气血上限+${hpRes.grantedHp}${hpRes.hpCapped ? `（丹道气血已达上限 ${hpRes.pg.alchemyHp}/${hpRes.caps.alchemyHp}）` : ""}！`
          : `服下【${it.name}】· 渡劫护脉丹障+2（本境丹道永久气血已达上限 ${hpRes.pg.alchemyHp}/${hpRes.caps.alchemyHp}）！`);
      }
      Sound.fanfare();
      saveGame(); updateHud();
      if (drawerOpen) renderDrawerContent();
    }
  }

  // ==================== 8. LIVE TRIBULATION, ASCENSION CHOICE & UPGRADE CARDS ====================
  let activeFruitRerolls = 1;
  let activeFruitMeta = { isHeaven: false, lastIds: [] };
  let activeDraftRerolls = 1;
  let activeDraftMeta = { titleText: "", lastIds: [] };

  const REALM_UNLOCK_NOTICES = {
    mortal: "凡胎启剑：核心六招已备——左键挥剑、右键爆印、空格一闪、Q 仙葫、B 吐纳渡劫、H 听雨洞府",
    qi: "炼气初开：解封【三才剑阵 (Y)】【御风腾跃 (Z)】【法宝剑域 (E)】【故人助阵 (R)】【本命灵宠 (G)】，并开启八卦丹剑与太虚锁妖古塔",
    foundation: "筑基铸道：解封【双剑意姿态 (`)】【镇妖魂印 (C)】【缩地瞬身 (F)】【流派奥义 (X)】【道侣瞬切 (V)】【太虚剑匣 (1/2/3)】与护山大阵守卫战",
    golden: "金丹启星：解封太虚秘匣初阶【山海灵骑 (J)】【奇门八门阵 (U)】【自创剑谱 (7)】，并开启【九霄云海空战】与【太虚周天星图 (N)】",
    nascent: "元婴破虚：解封元婴法身【一气化三清 (4)】【法天象地 (O)】，并开启【九州灵脉远征 (8)】【太虚登仙台 (L)】与【万剑冢七阵连战】",
    spirit: "化神凌霄：解封化神绝巅【山河社稷图 (5)】【凌霄仙舟 (6)】，并开启【天道劫印契约】与【造化种子工坊】，可直指九霄天门飞升！",
    ascended: "白日飞升：已证道真仙！历世道果已铭刻【九世轮回殿】，可携轮回命格与剑意幻化开启高难【劫火周目】与锁妖塔极限冲层！"
  };

  function openTribulationPrepModal() {
    if (!game || arena.tribulation) return;
    if (!guardNotPracticeMode("渡劫破境")) return;
    if (!guardNotInActiveTrialForTribulation()) return;
    const r = REALMS[game.realm];
    if (game.realm === "ascended") { openEndingModal(); return; }
    const bossGate = getBreakthroughBossGate(game);
    if (bossGate && bossGate.locked) {
      if (arena.player.meditating) toggleMeditation(false);
      const xpNote = (r.xpCap > 0 && game.xp < r.xpCap)
        ? `当前修为 ${Math.floor(num(game.xp, 0))}/${r.xpCap}（击败首领并攒满修为后方可启劫）`
        : `当前修为已圆满，击败首领后立即可引动天劫`;
      openModal(`
        <div class="drawer-mural-banner" style="height:92px;">
          <img src="${ART.banner_tribulation}" alt="九霄渡劫仪轨 · 首领门控" />
          <div class="drawer-mural-overlay">
            <div>
              <span class="cinnabar-seal">天劫受阻 · 首领门控</span>
              <h2 style="font-family:var(--font-serif);font-size:21px;color:#ffd89b;margin-top:4px;">${escapeHtml(r.name)} → 【${escapeHtml(bossGate.nextRealmName)}】尚未启封</h2>
            </div>
            <button type="button" class="btn-ghost" data-modal-close="1">暂缓 ✕</button>
          </div>
        </div>
        <div class="trib-path-card" style="gap:10px;border-color:rgba(255,196,112,0.58);">
          <div style="font-family:var(--font-serif);font-size:17px;font-weight:700;color:#ffd89b;">
            🔒 需先击败【${escapeHtml(bossGate.bossName)}】方可引动天劫
          </div>
          <p style="font-size:12px;color:var(--text-sub);line-height:1.55;">
            天道誓约：须先踏破【${escapeHtml(bossGate.stageName)}】，亲手斩落镇守首领【${escapeHtml(bossGate.bossTitle)}】，方可叩启【${escapeHtml(bossGate.nextRealmName)}】紫霄雷劫。
          </p>
          <div class="pity-bar-card">
            <span>目标秘境：<b>${escapeHtml(bossGate.stageName)}</b></span>
            <span style="color:#ffe28a;">${escapeHtml(xpNote)}</span>
          </div>
          <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
            <button type="button" class="btn-ghost" data-modal-close="1">暂缓整备</button>
            <button type="button" class="btn-gold" id="btn-trib-goto-boss" data-trib-goto-boss="${bossGate.stageIdx}">⚔ 前往挑战【${escapeHtml(bossGate.bossName)}】</button>
          </div>
        </div>
      `, true);
      return;
    }
    if (r.xpCap > 0 && game.xp < r.xpCap) {
      showToast("按 B 周天吐纳或斩妖攒满修为槽即可开启渡劫仪轨！");
      return;
    }
    const nextRealmId = r.next || "ascended";
    const nextR = REALMS[nextRealmId];
    const st = getCombatStats(game);
    const pillId = r.pill;
    const pillSpec = pillId ? ITEMS[pillId] : null;
    const pillCount = pillId ? Math.max(0, Math.floor(num(game.inventory[pillId], 0))) : 0;
    const pillRecipe = pillId ? Object.values(RECIPES).find(rc => rc.output === pillId) : null;
    const aidsTxt = [
      game.aids.shen ? "沈清禾·灵枢药阵(-25%雷伤)" : null,
      game.aids.pei ? "裴照·云台剑痕(-20%雷伤)" : null,
      game.aids.lu ? "陆玄松·满态入场" : null
    ].filter(Boolean).join(" · ") || "暂无故人护阵";

    if (arena.player.meditating) toggleMeditation(false);

    const pathBody = pillSpec ? `
      <div class="trib-prep-grid">
        <div class="trib-path-card">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
              <img src="${ART[pillSpec.art]}" alt="${pillSpec.name}" style="width:36px;height:36px;object-fit:contain;" />
              <div>
                <div style="font-family:var(--font-serif);font-size:16px;font-weight:700;color:#84ffea;">丹护渡劫 · 稳破重霄</div>
                <span class="tag-chip ${pillCount > 0 ? "done" : ""}">持有 ${pillSpec.name} ×${num(pillCount)}</span>
              </div>
            </div>
            <p style="font-size:11.5px;color:var(--text-sub);line-height:1.5;">
              消耗 <b>1 枚【${pillSpec.name}】</b>护持道基：立获 <b>+3 层护脉丹障</b>、标准 ${nextRealmId === "ascended" ? 4 : 3} 重雷劫；功成必获 <b>+10 载额外寿元、稳筑【天道一品】道基 (+16% 全属性) 与 55% 溢修承继</b>！
            </p>
          </div>
          ${pillCount > 0
            ? `<button type="button" class="btn-jade" style="width:100%;padding:8px 12px;" data-trib-start="pill">携【${pillSpec.name}】开启渡劫</button>`
            : `<div style="display:flex;flex-direction:column;gap:6px;">
                 <button type="button" class="btn-ghost" style="width:100%;padding:7px 10px;" disabled>缺少 ${pillSpec.name}（当前 0 枚）</button>
                 ${pillRecipe ? `<button type="button" class="btn-gold" style="width:100%;padding:7px 10px;font-size:11.5px;" data-trib-craft-pill="${pillRecipe.id}">🔥 前往紫微丹鼎炼制【${pillSpec.name}】</button>` : ""}
               </div>`}
        </div>
        <div class="trib-path-card defiant">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;">
              <div style="font-family:var(--font-serif);font-size:16px;font-weight:700;color:#ffb4ae;">无丹强渡 · 逆天傲骨</div>
              <span class="tag-chip" style="border-color:#ff7870;color:#ffb4ae;">极限试炼</span>
            </div>
            <p style="font-size:11.5px;color:#f3d2cf;line-height:1.5;">
              不借破境丹药硬撼高危天劫：雷劫 <b>+2 重</b>、落雷更密且单击 <b>46% 气血</b>、无丹障无延寿；须以【空格一闪】<b>弹反至少 2 道天雷</b>方成【天道一品】并赢取【逆天傲骨】荣誉与悬赏灵石！
            </p>
          </div>
          <button type="button" class="btn-gold" style="width:100%;padding:8px 12px;background:linear-gradient(135deg,#942b2b,#d86a3a);color:#fff6e2;" data-trib-start="defiant">⚡ 无丹逆天强渡</button>
        </div>
      </div>
    ` : `
      <div class="trib-path-card" style="gap:10px;">
        <div>
          <div style="font-family:var(--font-serif);font-size:17px;font-weight:700;color:#ffe89e;">引气入道 · 初劫洗髓（无需破境丹）</div>
          <p style="font-size:12px;color:var(--text-sub);line-height:1.55;margin-top:4px;">
            凡胎首渡 3 重紫霄雷劫：走位躲避紫电雷圈，或在落雷瞬间按 <b>【空格一闪】</b>迎雷弹反铸就【天道一品】！若天劫中气血归零可选择服丹续渡或保留 75% 修为退回整备。
          </p>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button type="button" class="btn-ghost" data-modal-close="1">暂缓整备</button>
          <button type="button" class="btn-gold" style="padding:8px 20px;" data-trib-start="normal">⚡ 引动初劫 · 晋升炼气</button>
        </div>
      </div>
    `;

    openModal(`
      <div class="drawer-mural-banner" style="height:92px;">
        <img src="${ART.banner_tribulation}" alt="九霄渡劫仪轨" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">九霄渡劫仪轨</span>
            <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:4px;">${r.name}圆满 → 冲击【${nextR.name}】</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">暂缓 ✕</button>
        </div>
      </div>
      <div class="pity-bar-card">
        <span>当前战力：<b>气血 ${Math.round(game.hp)}/${st.maxHp} · 攻击 ${st.atk} · 护脉丹障 ${Math.max(0, Math.floor(num(game.tribShield, 0)))} 层</b> · <span style="color:#ffd8a8;">⏳ 渡劫历时 1 载 / 受挫散功 1.5 载</span></span>
        <span style="color:var(--jade);">${aidsTxt}</span>
      </div>
      ${(() => {
        const prevWin = previewLifespanImpact(game, 12);
        const prevAbort = previewLifespanImpact(game, 18);
        const cls = prevAbort.willExhaust || prevAbort.after.status === "critical" ? "danger" : prevAbort.crossesAny ? "warn" : "";
        return `<div id="trib-prep-lifespan-preview" class="lifespan-preview-strip ${cls}">
          ⏳ 寿元预估：成劫消耗 <b>12 月</b>（${prevWin.before.curYears}→${prevWin.after.curYears}/${prevWin.after.maxYears} 载，破境后上限大增）｜受挫散功耗 <b>18 月（1.5 载）</b>（${prevAbort.before.curYears}→${prevAbort.after.curYears}/${prevAbort.after.maxYears} 载）${prevAbort.warningText ? ` · <b>${escapeHtml(prevAbort.warningText)}</b>` : ""}
        </div>`;
      })()}
      <div id="trib-rule-comparison" class="trib-rule-box">
        <strong style="color:#ffe89e;">📜 天劫评阶与路线对照：</strong>
        ${pillSpec
          ? `<span>① <b>破境丹稳渡</b>：3 重天雷 + 3 层护脉丹障 + 延寿 +10 载，弹反 ≥1 次或护脉丹障存留即成【天道一品】；② <b>无丹强渡</b>：5 重强化天雷，需 <b>空格一闪弹反 ≥2 次</b> 方成【天道一品】，功成另赐灵石。</span>`
          : `<span><b>凡人引气初劫（无需破境丹）</b>：3 重紫霄天雷；落雷瞬间按 <b>空格一闪弹反 ≥1 次</b> → 铸就【天道一品】（全属性倍率 +14%）；零弹反稳过 → 【地道上品】（全属性倍率 +9%）。炼气期后将开启「破境丹稳渡 vs 无丹强渡」双路线。</span>`}
      </div>
      ${game.realm === "nascent" ? `
        <div id="trib-vol5-bridge-note" class="trib-rule-box" style="border-color:rgba(112,255,230,0.48);color:#d6f9f2;">
          <strong style="color:#80ffea;">✦ 第五卷 → 第六卷过渡指引：</strong>
          <span>化神丹稳渡与无丹逆天强渡皆可破境化神（D01 不硬锁炼丹）；证道化神后将立即解封第六卷【山河社稷图 (5)】【凌霄仙舟 (6)】【天道劫印】【造化工坊】，直指【九霄天门】终极飞升！</span>
        </div>
      ` : ""}
      ${pathBody}
    `, true);
  }

  function startLiveTribulation(opts = {}) {
    if (!game || arena.tribulation) return;
    if (!guardNotPracticeMode("渡劫破境")) return;
    if (!guardNotInActiveTrialForTribulation()) return;
    const r = REALMS[game.realm];
    if (game.realm === "ascended") { openEndingModal(); return; }
    const bossGate = getBreakthroughBossGate(game);
    if (bossGate && bossGate.locked) {
      showToast(`🔒 需先击败【${bossGate.bossName}】方可引动天劫！`);
      openTribulationPrepModal();
      return;
    }
    if (r.xpCap > 0 && game.xp < r.xpCap) { showToast("斩妖探索或按 B 周天吐纳攒满修为槽即可开启渡劫仪轨！"); return; }
    if (!opts || !opts.confirmed) {
      openTribulationPrepModal();
      return;
    }

    const mode = opts.mode || "normal";
    const nextRealmId = r.next || "ascended";
    let usedPill = false;
    let hardcore = false;

    if (mode === "pill" && r.pill) {
      if ((game.inventory[r.pill] || 0) < 1) {
        showToast(`缺少【${ITEMS[r.pill].name}】，请先炼制或选择无丹逆天强渡！`);
        openTribulationPrepModal();
        return;
      }
      game.inventory[r.pill] -= 1;
      game.tribShield = (game.tribShield || 0) + 3;
      usedPill = true;
    } else if (mode === "defiant") {
      hardcore = true;
    }

    const wasSanctum = !!arena.sanctumMode;
    resetPhotoModeOverlay({ skipCalmReeval: true });
    closeModal();
    closeDrawer();
    arena.stageEpoch += 1;
    arena.waveTransitioning = false;
    arena.sanctumMode = false;
    arena.bladeClash = null;
    if (wasSanctum) resetSanctumDojoCombatGauges();
    else purgeTransientCombatEntities({ clearPlayerBuffs: true });
    hideDojoControlBar();
    arena.enemies = arena.enemies.filter(e => !e.isDummy);
    arena.props = arena.props.filter(pr => !pr.isDojoProp && !pr.isDummy && !(wasSanctum || (pr.id && (pr.id.startsWith("hub_") || pr.id.startsWith("sanctum_") || pr.id === "cauldron_main"))));
    if (arena.nearbyProp && !arena.props.includes(arena.nearbyProp)) {
      arena.nearbyProp = null;
    }
    renderPropInteractHud();
    arena.defeatRevivesUsed = 0;
    resetEncounterTelemetry();
    flushAndEndMeditation();

    if (game.aids.lu) {
      const st = getCombatStats(game);
      game.hp = st.maxHp; game.mp = st.maxMp;
    }

    Sound.fanfare();
    Sound.drum(0.28);
    const baseWaves = nextRealmId === "ascended" ? 4 : 3;
    const totalWaves = hardcore ? baseWaves + 2 : baseWaves;
    arena.camZoom = 1.06;
    arena.tribulation = {
      nextRealm: nextRealmId,
      totalBolts: totalWaves,
      boltsLeft: totalWaves,
      cooldown: 0.25,
      parryCount: 0,
      usedPill,
      hardcore,
      strikes: []
    };
    const cutTitle = hardcore
      ? `逆天强渡 · 强化紫霄劫【${REALMS[nextRealmId].name}】`
      : `九霄紫霄雷劫 · 冲击【${REALMS[nextRealmId].name}】`;
    const cutSub = hardcore
      ? "无丹硬撼强化天劫！精准【空格一闪】弹反 ≥2 次方成天道一品！"
      : usedPill
        ? "破境丹障护脉已成！稳渡天劫铸天道一品并延寿 +10 载！"
        : "走位躲避紫电雷圈，或按【空格一闪】迎雷弹反凝天道一品！";
    showBossCutIn("banner_tribulation", cutTitle, cutSub);
    addFloat(hardcore ? "⚡ 无丹强渡 · 强化雷劫降临！" : "九霄紫霄雷劫降临 · 逆天破境！", arena.player.x, arena.player.y - 64, hardcore ? "#ff9e98" : "#ffe89e", 22, true);
    saveGame();
    updateHud();
  }

  function completeLiveTribulation() {
    if (!game || !arena.tribulation) return;
    const tb = arena.tribulation;
    const parries = tb.parryCount || 0;
    const reqParries = tb.hardcore ? 2 : 1;
    const shieldBonus = !tb.hardcore && ((tb.usedPill && (game.tribShield || 0) >= 1) || (game.tribShield || 0) > 0);
    const isHeaven = tb.hardcore
      ? (parries >= 2)
      : (parries >= 1 || shieldBonus);
    arena.tribulation = null;

    game.realm = tb.nextRealm;
    const newR = REALMS[game.realm];
    const verdictReason = isHeaven
      ? (parries >= reqParries
        ? `本劫精准【空格一闪】迎雷弹反 ${parries} 次（达标 ≥${reqParries} 次），天雷淬骨铸就【天道一品】！`
        : `破境护脉丹障稳护灵脉（弹反 ${parries} 次），顺势凝成【天道一品】！`)
      : `本劫弹反 ${parries} 次（【天道一品】需 ≥${reqParries} 次），虽稳渡天劫但评定为【地道上品】。`;
    arena.lastTribulationSummary = {
      realm: game.realm,
      realmName: newR ? newR.name : game.realm,
      quality: isHeaven ? "heaven" : "earth",
      qualityLabel: isHeaven ? "天道一品" : "地道上品",
      parryCount: parries,
      requiredParries: reqParries,
      usedPill: Boolean(tb.usedPill),
      hardcore: Boolean(tb.hardcore),
      reason: verdictReason
    };
    playtestTelemetry.tribulationAttempts += 1;
    playtestTelemetry.tribulationResult = Object.assign({}, arena.lastTribulationSummary);
    const overflowRatio = (tb.usedPill ? 0.55 : tb.hardcore ? 0.45 : 0.40) + (getSanctumLevel(game, "spirit_eye") >= 4 ? 0.15 : 0) + (game.perk === "calamity_phoenix" ? 0.15 : 0);
    const carry = newR.xpCap > 0 ? Math.min(Math.floor(newR.xpCap * overflowRatio), (game.overflowXp || 0) + (tb.usedPill ? Math.round(newR.xpCap * 0.10) : 0)) : 0;
    game.xp = carry;
    game.overflowXp = 0;
    game.foundationQuality[game.realm] = isHeaven ? "heaven" : "earth";
    const multGain = tb.usedPill ? (isHeaven ? 0.16 : 0.13) : (tb.hardcore ? (isHeaven ? 0.16 : 0.10) : (isHeaven ? 0.14 : 0.09));
    game.statMultBonus = Number(((game.statMultBonus || 1) + multGain).toFixed(2));
    advanceOnboardingStep(3);
    if (tb.usedPill) {
      game.lifespanBonusMonths = (game.lifespanBonusMonths || 0) + 120;
      if (Array.isArray(game.journal)) game.journal.unshift(`【丹护渡劫】携破境丹稳晋${REALMS[game.realm].name}，延寿 +10 载并铸就${isHeaven ? "天道一品" : "地道上品"}根基！`);
    } else if (tb.hardcore) {
      game.defiantBreakthroughs = (game.defiantBreakthroughs || 0) + 1;
      const bonusStones = 100 + rankOf(game.realm) * 45;
      game.stones += bonusStones;
      if (Array.isArray(game.journal)) game.journal.unshift(`【逆天傲骨】无丹强渡${REALMS[game.realm].name}雷劫功成（弹反${tb.parryCount || 0}次），获赐 ${bonusStones} 灵石！`);
      showToast(`★ 逆天傲骨！无丹强渡【${REALMS[game.realm].name}】功成 · 赐 ${bonusStones} 灵石（${isHeaven ? "天道一品" : "地道上品 · 需弹反≥2次铸天道"}）！`);
    }
    refreshMarketStock();

    const st = getCombatStats(game);
    game.hp = st.maxHp; game.mp = st.maxMp;
    if (hasDestinyFruit(game, "lotus_body")) {
      arena.player.shieldHp = Math.round(st.maxHp * 0.35);
    }
    checkpoint = JSON.parse(JSON.stringify(game));

    syncFlyingSwords();
    arena.flash = 0.56; arena.flashColor = "#fff4c2"; arena.shake = 15; arena.camZoom = 1.07;
    for (let k = 0; k < 4; k++) {
      arena.skyBolts.push({ x: arena.player.x + (k - 1.5) * 55, y: arena.player.y, t: 0, color: "#ffe89e" });
    }
    Sound.fanfare();
    Sound.drum(0.28);

    if (game.realm === "ascended") {
      game.status = "ascended";
      if (!sandboxMode && !isPracticeModeActive()) {
        metaState.ascensions = (metaState.ascensions || 0) + 1;
        unlockAchievement("ach_ascend");
        saveMeta();
      }
      saveGame(); updateHud();
      openEndingModal();
      return;
    }
    if (game.realm === "qi") unlockAchievement("ach_qi");
    if (isHeaven) unlockAchievement("ach_heaven_core");

    if (game.realm !== "ascended") {
      advanceLifespanMonths(12, "tribulation_success", { silentToast: true });
      if (!getLifespanInfo(game).isExhausted) {
        lifespanExhaustedPromptDismissed = false;
        pendingLifespanExhaustedPrompt = false;
      }
    }

    const unlockMsg = REALM_UNLOCK_NOTICES[game.realm];
    const lfNew = getLifespanInfo(game);
    if (Array.isArray(game.journal)) game.journal.unshift(`破境晋升【${REALMS[game.realm].name}】，历劫一载，寿元增至 ${lfNew.maxYears} 载！`);
    if (unlockMsg) showToast(`★ ${unlockMsg}（寿元延至 ${lfNew.maxYears} 载！）`);
    else showToast(`★ 破境【${REALMS[game.realm].name}】功成 · 寿元延至 ${lfNew.maxYears} 载！`);

    addFloat(`${tb.hardcore ? "⚡ 逆天傲骨 · " : isHeaven ? "★ 天道一品 · " : ""}破境【${REALMS[game.realm].name}】· 寿元 ${lfNew.maxYears} 载！`, arena.player.x, arena.player.y - 64, "#fff4c2", 22, true);
    arena.enemies.slice().forEach(e => damageEnemy(e, Math.round(st.atk * 2.6), true, 48, 0, 9, true));
    queueNewUnlockCardsForState(game);
    // F07/F10 A5: Atomically persist destiny_fruit + chained iconic_draft into game.pendingRewards BEFORE saving, then let calm scheduler present them!
    const hasUnownedFruit = Object.values(DESTINY_FRUITS).some(f => !hasDestinyFruit(game, f.id));
    if (hasUnownedFruit) {
      enqueuePendingReward({ kind: "destiny_fruit", payload: { isHeaven }, persist: false });
    }
    enqueuePendingReward({
      kind: "iconic_draft",
      payload: { titleText: `${REALMS[game.realm].name}功成 · 参悟大道神通`, source: "tribulation" },
      persist: false
    });
    saveGame(); updateHud(true);
    activeFruitRerolls = 1;
    requestCalmReevaluation();
  }

  function openDestinyFruitModal(isHeaven, isReroll = false, recEventId = null) {
    if (!game) return;
    if (recEventId) activePendingRewardId = recEventId;
    if (!isReroll) { activeFruitRerolls = 1; activeFruitMeta = { isHeaven, lastIds: [] }; }
    const allUnowned = Object.values(DESTINY_FRUITS).filter(f => !hasDestinyFruit(game, f.id));
    if (!allUnowned.length) {
      if (activePendingRewardId) {
        const fruitEvId = activePendingRewardId;
        const res = commitPendingReward(fruitEvId, () => true);
        if (!res.ok) return;
        if (getPendingRewardsByKind("iconic_draft").length > 0) {
          requestCalmReevaluation({ immediate: isCombatCalm() });
          return;
        }
      }
      openIconicUpgradeDraft(`${REALMS[game.realm].name}功成 · 参悟大道神通`);
      return;
    }
    const freshPool = isReroll ? allUnowned.filter(f => !activeFruitMeta.lastIds.includes(f.id)) : allUnowned;
    const pool = freshPool.length >= 3 ? freshPool : allUnowned;
    const avail = shuffleFisherYates(pool).slice(0, 3);
    activeFruitMeta = { isHeaven, lastIds: avail.map(f => f.id) };
    const unlockBanner = REALM_UNLOCK_NOTICES[game.realm]
      ? `<div class="pity-bar-card" style="border-color:rgba(112,255,230,0.45);color:#9effec;"><span>★ ${REALM_UNLOCK_NOTICES[game.realm]}</span></div>`
      : "";
    const goldenCloudHint = (game.realm === "golden" && !game.cloudSeaCleared)
      ? `<div class="pity-bar-card" style="border-color:rgba(128,236,255,0.55);color:#c8f7ff;"><span>☁ 金丹高潮过渡关已启：择完道果后可由【舆图 / 仙阁·问道阶梯】起飞征战【九霄云海空战】，首破立得【破云证道印】(+12攻 · 为元婴期远征/登仙台提供+15%收益)！</span></div>`
      : "";

    const tribVerdictHtml = (() => {
      const sum = arena.lastTribulationSummary;
      const qLabel = sum ? sum.qualityLabel : (isHeaven ? "天道一品" : "地道上品");
      const reasonTxt = sum
        ? sum.reason
        : (isHeaven ? "本劫迎雷识破弹反达标，凝成【天道一品】根基！" : "本劫稳渡天雷，评定为【地道上品】根基（迎雷弹反可铸天道一品）。");
      return `<div id="trib-verdict-summary" class="trib-verdict-box">
        <strong>✦ 破境评定：【${escapeHtml(qLabel)}】</strong> · <span>${escapeHtml(reasonTxt)}</span>
      </div>`;
    })();

    openModal(`
      <div class="drawer-mural-banner" style="height:104px;">
        <img src="${ART.banner_tribulation}" alt="逆天改命" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">${isHeaven ? "天道一品破境" : "渡劫功成"}</span>
            <h2 style="font-family:var(--font-serif);font-size:22px;color:var(--gold-bright);margin-top:4px;">晋升【${REALMS[game.realm].name}】· 择一逆天改命道果</h2>
          </div>
          <span class="tag-chip mythic">本世永久先天神通</span>
        </div>
      </div>
      ${tribVerdictHtml}
      ${unlockBanner}
      ${goldenCloudHint}
      <div class="law-draft-grid">
        ${avail.map(f => `
          <button class="law-card-btn" data-destiny-fruit="${f.id}">
            <img src="${ART[f.art]}" alt="${f.name}" />
            <div style="font-family:var(--font-serif);font-size:19px;font-weight:700;color:#fff3c4;">${f.name}</div>
            <span class="tag-chip mythic" style="font-size:11.5px;padding:3px 10px;">★ ${f.badge}</span>
            <span style="font-size:11.5px;color:var(--text-sub);line-height:1.45;">${f.desc}</span>
          </button>
        `).join("")}
      </div>
      <div class="draft-reroll-bar">
        <span>天机推演：可自选定格本世流派核心道果</span>
        ${activeFruitRerolls > 0 && allUnowned.length > 3 ? `<button type="button" class="btn-jade" data-action="reroll-destiny-fruit">天机重演（免费剩余 ${activeFruitRerolls} 次）</button>` : `<span style="color:var(--gold);">本次天机已定</span>`}
      </div>
    `, false, { kind: "destiny_fruit" });
  }

  function openWorldMapModal(focusNodeId = null) {
    if (!game) return;
    if (!guardNotInTribulation("九州舆图传送")) return;
    closeDrawer();
    const navSnap = buildNavigationSnapshot(game);
    const nodes = navSnap.mapNodes;
    if (focusNodeId && nodes.some(n => n.id === focusNodeId)) {
      selectedWorldMapNodeId = focusNodeId;
    } else if (!selectedWorldMapNodeId || !nodes.some(n => n.id === selectedWorldMapNodeId)) {
      const mainTarget = nodes.find(n => n.isMainTarget);
      const curNode = nodes.find(n => n.isCurrent);
      selectedWorldMapNodeId = (mainTarget && mainTarget.id) || (curNode && curNode.id) || "hub";
    }
    const sel = nodes.find(n => n.id === selectedWorldMapNodeId) || nodes[0];
    const cloudOk = isEcosystemSystemUnlocked(game, "cloud_sea_trial");
    const spireOk = isEcosystemSystemUnlocked(game, "celestial_spire");
    const defOk = isEcosystemSystemUnlocked(game, "sect_defense");
    const rushOk = isEcosystemSystemUnlocked(game, "sword_tomb_rush");
    const ecoLockTag = (sysId, fallback) => {
      const sp = getEcosystemSystemSpec(sysId);
      return (sp && REALMS[sp.min]) ? `${REALMS[sp.min].name}启` : fallback;
    };

    const nodeById = new Map(nodes.map(n => [n.id, n]));
    const drawnPairs = new Set();
    const svgLines = [];
    nodes.forEach(a => {
      (a.links || []).forEach(tid => {
        const b = nodeById.get(tid);
        if (!b) return;
        const pairKey = a.id < b.id ? `${a.id}__${b.id}` : `${b.id}__${a.id}`;
        if (drawnPairs.has(pairKey)) return;
        drawnPairs.add(pairKey);
        const isSideLink = a.tier === "side" || b.tier === "side";
        svgLines.push(`<line x1="${a.x}%" y1="${a.y}%" x2="${b.x}%" y2="${b.y}%" stroke="${isSideLink ? "rgba(185,152,250,0.68)" : "rgba(216,179,106,0.72)"}" stroke-width="${isSideLink ? "1.6" : "2.2"}" ${isSideLink ? 'stroke-dasharray="5 4"' : ""} />`);
      });
    });

    const selSem = sel.tier === "main" ? "main" : sel.tier === "side" ? "side" : "system";
    const selTierLbl = sel.tier === "main"
      ? (sel.chapterIdx ? `第${sel.chapterIdx}卷 · 主线` : "主线")
      : sel.tier === "side"
        ? "支线 · 试炼"
        : "安全洞府";
    const enterBtnLabel = !sel.unlocked
      ? `🔒 ${sel.lockReason || "未解锁"}`
      : sel.kind === "hub"
        ? "御剑返回洞府 ▸"
        : sel.kind === "chapter5_marker"
          ? "前往第五卷推进 ▸"
          : "御剑前往 ▸";

    openModal(`
      <div class="modal-header">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${renderSemanticTag("main", "九州山海卷")}
          <span style="font-family:var(--font-serif);font-size:var(--fs-xl);font-weight:700;color:var(--gold-bright);">千里江山 · 预览选域舆图</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <button type="button" class="btn-tertiary btn-ghost" style="padding:3px 9px;font-size:var(--fs-xs);" data-open-goals="mainline">■ 主线·卷</button>
          <button type="button" class="btn-tertiary btn-ghost" style="padding:3px 9px;font-size:var(--fs-xs);" data-open-goals="trials">● 支线·试炼</button>
          <button type="button" class="btn-tertiary btn-ghost" style="padding:3px 9px;font-size:var(--fs-xs);" data-open-goals="companions">♥ 故人线</button>
          <button type="button" class="btn-tertiary btn-ghost" style="padding:3px 9px;font-size:var(--fs-xs);" data-open-goals="bounties">⬡ 悬赏</button>
          <button type="button" class="btn-tertiary btn-ghost" data-modal-close="1">收起舆图 ×</button>
        </div>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <button type="button" class="btn-tertiary btn-ghost is-side ${cloudOk ? "" : "eco-locked-btn is-locked"}" style="border-color:#80ecff;color:#b8f7ff;padding:4px 9px;font-size:var(--fs-xs);" data-action="start-cloud-sea" data-eco-lock-tag="${ecoLockTag("cloud_sea_trial", "金丹启")}">${cloudOk ? "☁ 九霄云海空战" : "🔒 九霄空战"}</button>
          <button type="button" class="btn-tertiary btn-ghost is-side ${spireOk ? "" : "eco-locked-btn is-locked"}" style="border-color:#ff9eff;color:#f5d0ff;padding:4px 9px;font-size:var(--fs-xs);" data-action="open-celestial-spire" data-eco-lock-tag="${ecoLockTag("celestial_spire", "元婴启")}">${spireOk ? "🏯 太虚登仙台(肉鸽)" : "🔒 登仙台"}</button>
          <button type="button" class="btn-tertiary btn-ghost is-side ${defOk ? "" : "eco-locked-btn is-locked"}" style="border-color:#70ffe6;color:#9effec;padding:4px 9px;font-size:var(--fs-xs);" data-action="start-sect-defense" data-eco-lock-tag="${ecoLockTag("sect_defense", "筑基启")}">${defOk ? "🛡 护山守卫战" : "🔒 护山战"}</button>
          <button type="button" class="btn-primary btn-gold is-side ${rushOk ? "" : "eco-locked-btn is-locked"}" style="padding:4px 10px;font-size:var(--fs-xs);" data-start-rush="7" data-eco-lock-tag="${ecoLockTag("sword_tomb_rush", "元婴启")}">${rushOk ? "🐉 太古烛龙(练习)" : "🔒 太古烛龙"}</button>
        </div>
        <div class="kyushu-map-stage">
          <img src="${ART.map_kyushu_scroll}" alt="九州山海舆图" />
          <svg class="kyushu-map-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            ${svgLines.join("")}
          </svg>
          ${nodes.map(nd => {
            const towerBestMap = Math.max(Math.floor(num(game.towerBest, 0)), Math.floor(num(metaState.bestTower, 0)));
            const starStr = nd.kind === "stage"
              ? `${stageStarsToGrade(nd.stars)} · ${"★".repeat(nd.stars)}${"☆".repeat(Math.max(0, 3 - nd.stars))}`
              : nd.kind === "tower"
                ? `最高 #${Math.max(1, towerBestMap)} 层${towerBestMap >= 1 ? ` (${computeModeGrade("demon_tower", { floor: towerBestMap })}级)` : ""}`
                : nd.kind === "chapter5_marker"
                  ? "第五卷叙事节点"
                  : nd.kind === "boss_rush"
                    ? (metaState.bestRushGrade ? `七阵连战 · ${escapeHtml(metaState.bestRushGrade)} 级` : "七阵踏天连战")
                    : "安全休整";
            const isSel = nd.id === sel.id;
            return `
              <button type="button"
                class="kyushu-node-btn map-tier-${nd.tier} ${nd.isCurrent ? "current-loc" : ""} ${nd.kind === "hub" ? "hub-loc" : ""} ${isSel ? "is-selected" : ""} ${nd.isMainTarget ? "is-main-target" : ""} ${nd.unlocked ? "" : "is-locked"}"
                style="left:${nd.x}%;top:${nd.y}%;"
                data-map-node="${nd.id}"
                data-node-tier="${nd.tier}"
                data-node-shape="${nd.shape}"
                aria-pressed="${isSel ? "true" : "false"}"
                data-tip="${escTip(nd.name + " · " + nd.sub, `特产：${nd.drop}（点击先预览详情，不立即传送）`)}">
                <span class="kyushu-node-title">${nd.name}</span>
                <span class="kyushu-node-sub">${nd.unlocked ? nd.sub : `🔒 ${REALMS[nd.min].name}开启`}</span>
                <span class="kyushu-node-stars">${starStr}</span>
              </button>
            `;
          }).join("")}
        </div>
        <div id="world-map-preview-strip" data-preview-node="${escapeHtml(sel.id)}">
          <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:220px;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              ${renderSemanticTag(selSem, selTierLbl)}
              <strong style="font-family:var(--font-serif);font-size:var(--fs-lg);color:var(--gold-bright);">${escapeHtml(sel.name)}</strong>
              <span class="tag-chip ${sel.unlocked ? "done" : "is-locked"}">${sel.unlocked ? "已解锁" : escapeHtml(sel.lockReason)}</span>
              ${sel.kind === "stage" ? `<span class="tag-chip ${sel.stars >= 3 ? "mythic" : sel.stars > 0 ? "done" : ""}">${stageStarsToGrade(sel.stars)} 级 (${"★".repeat(sel.stars)}${"☆".repeat(Math.max(0, 3 - sel.stars))})</span>` : ""}
            </div>
            <div style="font-size:var(--fs-sm);color:var(--text-main);">产出与机缘：${escapeHtml(sel.drop)}</div>
            <div style="font-size:var(--fs-xs);color:var(--text-sub);">解锁/路径：${escapeHtml(sel.reqText || sel.sub)}${sel.isMainTarget && navSnap.nextMainline && navSnap.nextMainline.stepText ? ` ｜ 当前主线：${escapeHtml(navSnap.nextMainline.stepText)}` : ""}</div>
            ${(() => {
              if (sel.kind !== "stage") return "";
              const rsPrev = computeMainlineRealmScaling(sel.stageIdx, game.realm, true);
              if (!rsPrev.active) return "";
              return `<div id="world-map-scaling-badge" style="font-size:var(--fs-xs);color:#ffd98a;line-height:1.4;">⚖ 敌群随【${escapeHtml(REALMS[game.realm].name)}期】动态同步 · 灵石 ×${rsPrev.stoneMult}</div>`;
            })()}
            ${(() => {
              const guide = sel.chapterIdx ? VOLUME_CAMPAIGN_GUIDE.find(v => v.volIndex === sel.chapterIdx) : null;
              if (!guide) return "";
              const vol5Extra = sel.id === "ch5_resonance"
                ? (() => {
                    const snap5 = buildVol5ResonanceSnapshot(game);
                    return ` ｜ 实时进度：法则 ${snap5.lawCount}/${snap5.lawNeed} · 法宝★${snap5.relicStars}/${snap5.relicNeed} · 诸天共鸣 ${snap5.resonance.activeCount}/6`;
                  })()
                : "";
              return `<div id="world-map-vol-brief" style="font-size:var(--fs-xs);color:#9effec;line-height:1.4;">⚔ 考题（${escapeHtml(guide.enemyExam.bossName)}）：${escapeHtml(guide.enemyExam.counter)} ｜ 收益：${escapeHtml(guide.growthPayoff)}${escapeHtml(vol5Extra)}</div>`;
            })()}
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end;">
            ${sel.kind === "stage" ? (() => {
              const sw = getStageSweepStatus(game, sel.stageIdx);
              const swLabel = sw.canSweep
                ? `⚡ 扫荡秘境 (免耗寿 · 余 ${sw.remaining}/${sw.maxPerDay})`
                : sw.reason === "on_cooldown"
                  ? `⏳ 扫荡冷却 (${sw.cooldownSec}s)`
                  : sw.reason === "quota_exhausted"
                    ? `今日已扫荡满 (0/${sw.maxPerDay})`
                    : sw.reason === "practice_mode"
                      ? "🔒 练习模式禁扫荡"
                      : sw.reason === "stage_locked"
                        ? "🔒 未解锁"
                        : "🔒 需三星(S级)扫荡";
              const hardDisabled = !sw.eligible;
              return `<button type="button" id="btn-map-sweep-stage" class="${sw.canSweep ? "btn-secondary btn-jade" : "btn-tertiary btn-ghost is-locked"}" data-open-stage-sweep="${sel.stageIdx}" data-sweep-origin="world_map" ${hardDisabled ? "disabled" : ""} aria-disabled="${sw.canSweep ? "false" : "true"}" title="${escapeHtml(sw.reasonText)}">${escapeHtml(swLabel)}</button>`;
            })() : ""}
            <button type="button" id="btn-map-enter-node" class="${sel.unlocked ? "btn-primary btn-gold" : "btn-tertiary btn-ghost is-locked"}" data-map-enter="${escapeHtml(sel.id)}" ${sel.unlocked ? "" : "disabled"}>${escapeHtml(enterBtnLabel)}</button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <span style="font-size:var(--fs-xs);color:var(--text-sub);">点击地图节点先预览条件与产出（不自动传送），再点击【御剑前往】出征；<b style="color:var(--gold-bright);">M</b> 舆图 · <b style="color:var(--gold-bright);">T</b> 问道录 · <b style="color:var(--gold-bright);">H</b> 洞府。</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="btn-tertiary btn-ghost" style="padding:2px 8px;font-size:var(--fs-xs);border-color:rgba(112,255,230,0.45);color:#9effec;" data-action="open-ascension-roadmap">📊 问道阶梯</button>
          <span style="color:var(--jade);font-size:var(--fs-xs);">当前境界：${REALMS[game.realm].name}</span>
        </div>
      </div>
    `, true, { tier: "info" });
  }

  function openEncounterModal(forcedSecretIdx = null) {
    if (!game) return;
    if (!guardNotInTribulation("上古奇遇")) return;
    if (forcedSecretIdx === null && getNextAvailableKarmaDilemma(game) && ((game.karmaEventsDone || 0) < 2 || Math.random() < 0.65)) {
      openKarmaDilemmaModal();
      return;
    }
    const evSpec = forcedSecretIdx !== null
      ? SECRET_ENCOUNTERS[forcedSecretIdx % SECRET_ENCOUNTERS.length]
      : SECRET_ENCOUNTERS[Math.floor(Math.random() * SECRET_ENCOUNTERS.length)];
    const ks = getKarmaState(game);
    const karmaExtra = (KARMA_ENCOUNTER_EXTRAS[evSpec.id] && ks.mode !== "neutral") ? KARMA_ENCOUNTER_EXTRAS[evSpec.id][ks.mode] : null;
    openModal(`
      <div class="drawer-mural-banner" style="height:96px;">
        <img src="${ART[evSpec.banner]}" alt="${evSpec.title}" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">${evSpec.seal}</span>
            <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:4px;">${evSpec.title}</h2>
          </div>
          <span class="tag-chip done">道心抉择 · ${ks.label}</span>
        </div>
      </div>
      <p style="font-size:13px;color:var(--text-main);line-height:1.65;padding:4px 6px;">${evSpec.desc}</p>
      <div style="display:flex;flex-direction:column;gap:9px;">
        ${evSpec.options.map(o => `
          <button type="button" class="encounter-opt-btn" data-enc-id="${evSpec.id}" data-enc-opt="${o.id}">
            <div>
              <div style="font-family:var(--font-serif);font-size:15px;font-weight:700;color:#fff2c2;">${o.label}</div>
              <div style="font-size:11.5px;color:var(--jade);margin-top:3px;">${o.detail}</div>
            </div>
            <span class="tag-chip mythic">抉择 ▸</span>
          </button>
        `).join("")}
        ${karmaExtra ? `
          <button type="button" class="encounter-opt-btn" style="border-color:${ks.mode === "demonic" ? "rgba(255,92,108,0.72)" : "rgba(112,255,230,0.72)"};background:${ks.mode === "demonic" ? "linear-gradient(155deg,rgba(54,12,24,0.95),rgba(22,7,14,0.97))" : "linear-gradient(155deg,rgba(10,44,48,0.95),rgba(6,20,26,0.97))"};" data-enc-id="${evSpec.id}" data-enc-opt="${karmaExtra.id}" data-enc-karma="${ks.mode}">
            <div>
              <div style="font-family:var(--font-serif);font-size:15px;font-weight:700;color:${ks.mode === "demonic" ? "#ffd2d8" : "#c4fff4"};">${karmaExtra.label}</div>
              <div style="font-size:11.5px;color:${ks.mode === "demonic" ? "#ff9eaa" : "#80ffea"};margin-top:3px;">${karmaExtra.detail}</div>
            </div>
            <span class="tag-chip ${ks.mode === "demonic" ? "mythic" : "done"}">${ks.mode === "demonic" ? "魔心专属 ▸" : "正道专属 ▸"}</span>
          </button>
        ` : ""}
      </div>
    `, false, { kind: "encounter" });
  }

  function isAllDaoLawsCollected(g) {
    if (!g || !Array.isArray(g.laws)) return false;
    return Object.keys(DAO_LAWS).every(id => g.laws.includes(id));
  }

  function openIconicUpgradeDraft(titleText, isReroll = false, opts = {}) {
    if (!game) return;
    if (opts && opts.eventId) activePendingRewardId = opts.eventId;
    const draftSource = (opts && opts.source) || (isReroll && activeDraftMeta && activeDraftMeta.source) || "default";
    if (!isReroll) { activeDraftRerolls = 1 + getSanctumBonuses(game).bonusLawRerolls; activeDraftMeta = { titleText, lastIds: [], source: draftSource }; }
    const petCandidates = [];
    if (!game.pet.id) {
      shuffleFisherYates(Object.values(SPIRIT_PETS)).slice(0, 2).forEach(sp => {
        petCandidates.push({
          pickType: "pet", id: sp.id, art: sp.art, name: sp.name,
          badge: sp.skill,
          sub: sp.desc,
          completesSyn: false
        });
      });
    }
    const unownedLaws = Object.values(DAO_LAWS).filter(l => !game.laws.includes(l.id));
    const freshLaws = isReroll ? unownedLaws.filter(l => !activeDraftMeta.lastIds.includes(l.id)) : unownedLaws;
    const lawPool = shuffleFisherYates(freshLaws.length >= 2 ? freshLaws : unownedLaws).map(l => {
      const completesSyn = SYNERGIES.find(syn => !syn.active(game) && syn.active(Object.assign({}, game, { laws: game.laws.concat(l.id) })));
      const liveNote = getLawLiveContributionText(game, l.id);
      return {
        pickType: "law", id: l.id, art: LAW_ICONS[l.id] || "icon_blade", name: l.name,
        badge: completesSyn ? `★ 必成羁绊【${completesSyn.name}】` : (LAW_SHORT_BADGE[l.id] || l.cat),
        sub: liveNote ? `${l.desc}（${liveNote}）` : l.desc,
        completesSyn: !!completesSyn
      };
    });

    // Deterministic Synergy Pity: if any unowned law completes a synergy, guarantee it in slot 1!
    const synLaws = lawPool.filter(c => c.completesSyn);
    const otherLaws = lawPool.filter(c => !c.completesSyn);
    const picks = [];
    if (synLaws.length > 0) picks.push(synLaws[0]);
    if (petCandidates.length > 0 && picks.length < 3) picks.push(petCandidates[0]);
    for (const c of [...synLaws.slice(1), ...otherLaws, ...petCandidates.slice(1)]) {
      if (picks.length >= 3) break;
      if (!picks.some(p => p.id === c.id)) picks.push(c);
    }
    activeDraftMeta = { titleText, lastIds: picks.map(c => c.id), source: draftSource };

    if (picks.length === 0) {
      const fallbackStones = (activeDraftMeta && activeDraftMeta.source === "jade_wager") ? 30 : 120;
      if (activePendingRewardId) {
        const res = commitPendingReward(activePendingRewardId, () => {
          game.stones += fallbackStones;
          return true;
        });
        if (res.ok) {
          showToast(`诸法皆通 · 获赐 ${fallbackStones} 灵石！`);
          updateHud();
        }
        return;
      }
      game.stones += fallbackStones;
      showToast(`诸法皆通 · 获赐 ${fallbackStones} 灵石！`);
      saveGame();
      updateHud();
      return;
    }

    const totalAvail = unownedLaws.length + petCandidates.length;
    openModal(`
      <div class="drawer-mural-banner" style="height:82px;">
        <img src="${ART.banner_sanctum}" alt="大道顿悟" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">大道顿悟</span>
            <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:4px;">${escapeHtml(titleText)}</h2>
          </div>
          <span class="tag-chip mythic">${synLaws.length > 0 ? "已定格双法则羁绊保底" : "集齐双法则激活共鸣羁绊"}</span>
        </div>
      </div>
      <div class="law-draft-grid">
        ${picks.map(c => `
          <button class="law-card-btn" data-draft-type="${c.pickType}" data-draft-id="${c.id}">
            <img src="${ART[c.art]}" alt="${c.name}" />
            <div style="font-family:var(--font-serif);font-size:18px;font-weight:700;color:var(--gold-bright);">${c.name}</div>
            <span class="tag-chip ${c.badge.startsWith("★") ? "mythic" : "done"}" style="font-size:11.5px;padding:3px 10px;">${c.badge}</span>
            <span style="font-size:11px;color:var(--text-sub);">${c.sub}</span>
          </button>
        `).join("")}
      </div>
      <div class="draft-reroll-bar">
        <span>${synLaws.length > 0 ? "★ 天机共鸣：已优先呈现可成羁绊之大道法则" : "择一法则塑成剑阵流派，后续升级将保底推送羁绊配对"}</span>
        ${activeDraftRerolls > 0 && totalAvail > 3 ? `<button type="button" class="btn-jade" data-action="reroll-law-draft">天机重演（免费剩余 ${activeDraftRerolls} 次）</button>` : `<span style="color:var(--gold);">本次天机已定</span>`}
      </div>
    `, false, { kind: "iconic_draft" });
  }
