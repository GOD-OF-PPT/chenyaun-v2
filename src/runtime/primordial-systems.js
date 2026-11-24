  // ==================== V22 PRIMORDIAL FINALE MODULES ====================
  const STEMS_STORAGE_KEY = "chenyuan_stems_v22";
  function applySanitizedAudioStems(p) {
    if (!p || typeof p !== "object" || Array.isArray(p)) return;
    ["guqin", "chime", "drum", "blade", "reverb"].forEach(k => {
      if (hasOwn(p, k) && typeof p[k] === "number" && Number.isFinite(p[k])) {
        Sound.stems[k] = Math.max(0, Math.min(1.5, p[k]));
      }
    });
  }
  function loadAudioStems() {
    try {
      const raw = localStorage.getItem(STEMS_STORAGE_KEY);
      if (raw) {
        applySanitizedAudioStems(JSON.parse(raw));
      }
    } catch (e) {}
  }
  function saveAudioStems() {
    try { localStorage.setItem(STEMS_STORAGE_KEY, JSON.stringify(Sound.stems)); } catch (e) {}
  }
  loadAudioStems();

  // 1. Mythic Mounts (`山海灵骑 · 三大太古神兽`)
  const MYTHIC_MOUNTS = {
    qilin: {
      id: "qilin", short: "踏云麒麟", name: "踏云墨麒麟", art: "mount_ink_qilin", color: "#ffb84d",
      spdMult: 1.48, badge: "烈焰践踏 · 冲锋碎盾",
      desc: "墨玉金鳞瑞兽：骑乘移速+48%，铁蹄踏出丹炎火径；【破阵冲锋】瞬碎敌方护盾并震飞群妖！"
    },
    qingluan: {
      id: "qingluan", short: "九天青鸾", name: "九天青鸾凤", art: "pet_roc", color: "#70ffe6",
      spdMult: 1.62, badge: "掠地疾翔 · 风火羽刃",
      desc: "九霄神禽青鸾：骑乘掠地移速+62%，冲锋时向两侧齐射八道风火破甲羽刃并引燃丹炎！"
    },
    baize: {
      id: "baize", short: "玄冥白泽", name: "玄冥白泽兽", art: "pet_fox", color: "#80ecff",
      spdMult: 1.42, badge: "寒霜灵环 · 净障护主",
      desc: "通晓万物瑞兽：骑乘凝结25%气血护主灵盾，周身寒霜灵环持续减速冰封近身群妖！"
    }
  };

  // 2. Qimen Eight-Gates Tactical Arrays (`奇门遁甲 · 八门随身风水阵盘`)
  const QIMEN_GATES = [
    { id: "sheng",        short: "奇门·生门", name: "生门 · 青木回春阵", color: "#4ad2b8", sub: "回血回元·攻速+38%", desc: "生生不息：阵内每秒恢复 8% 气血与 12% 剑元，出招攻速暴涨 +38%！" },
    { id: "jing_fire",    short: "奇门·景门", name: "景门 · 离火焚天阵", color: "#ff7b47", sub: "阵剑真火附魔+火海", desc: "阵剑附魔：一切穿过景门阵界的飞剑/枪芒/剑轮自动附魔【三昧真火】（伤害+42%并引爆火海）！" },
    { id: "jing_thunder", short: "奇门·惊门", name: "惊门 · 震雷重力阵", color: "#d69eff", sub: "黑洞聚怪·周期落雷", desc: "雷狱引力：强力牵引聚拢阵内妖群，每 0.65 秒降下紫霄神雷削韧并触发水洼感电！" },
    { id: "si",           short: "奇门·死门", name: "死门 · 归墟剑狱阵", color: "#ff4d6d", sub: "暴击+50%·双倍破甲", desc: "杀伐绝域：阵内暴击率暴涨 +50%，对护盾、阵核与巨神部位的破甲伤害翻倍（×2.0）！" }
  ];

  function syncV22TacticalDock() {
    if (typeof syncV23EpochDock === 'function') syncV23EpochDock();
    if (!game) return;
    const ks = getKarmaState(game);
    const isDemonic = ks.mode === "demonic";
    const aBtn = document.getElementById("btn-astral-form");
    const aImg = document.getElementById("img-astral-ico");
    const aTit = document.getElementById("lbl-astral-title");
    const aPct = document.getElementById("lbl-astral-pct");
    if (aBtn && aImg && aTit && aPct) {
      const af = arena.astralForm;
      const rankS = getStyleRankSpec(arena.styleScore || 0).rank === "S";
      const pct = Math.min(100, Math.floor(arena.astralEnergy || 0));
      aImg.src = ART[isDemonic ? "avatar_asura_demon" : "avatar_taiqing_immortal"];
      aTit.textContent = isDemonic ? "修罗真身" : "金阙真身";
      if (af && af.active) {
        aBtn.classList.add("active-state");
        aBtn.classList.remove("ready-glow");
        aPct.textContent = `降世 ${af.life.toFixed(1)}s`;
      } else {
        aBtn.classList.remove("active-state");
        const canCast = pct >= 100 || rankS;
        aBtn.classList.toggle("ready-glow", canCast);
        aPct.textContent = canCast ? "★可降世!" : `元神 ${pct}%`;
      }
    }

    const mSpec = MYTHIC_MOUNTS[game.equippedMount || "qilin"] || MYTHIC_MOUNTS.qilin;
    const mBtn = document.getElementById("btn-mount-call");
    const mImg = document.getElementById("img-mount-ico");
    const mName = document.getElementById("lbl-mount-name");
    const mSt = document.getElementById("lbl-mount-state");
    if (mBtn && mImg && mName && mSt) {
      mImg.src = ART[mSpec.art];
      mName.textContent = mSpec.short;
      const onMount = !!(arena.mountState && arena.mountState.active);
      mBtn.classList.toggle("active-state", onMount);
      mSt.textContent = onMount ? "Z/右键跃劈" : "呼哨冲锋";
    }

    const gIdx = arena.qimenGateIdx || 0;
    const gSpec = QIMEN_GATES[gIdx % QIMEN_GATES.length];
    const qBtn = document.getElementById("btn-qimen-array");
    const qImg = document.getElementById("img-qimen-ico");
    const qTit = document.getElementById("lbl-qimen-gate");
    const qSub = document.getElementById("lbl-qimen-sub");
    if (qBtn && qImg && qTit && qSub) {
      qImg.src = ART.vfx_qimen_bagua_dial;
      qTit.textContent = gSpec.short;
      qTit.style.color = gSpec.color;
      const qa = arena.qimenArray;
      qBtn.classList.toggle("active-state", !!(qa && qa.active));
      qSub.textContent = (qa && qa.active) ? `${qa.gate.short.slice(3)} ${qa.life.toFixed(1)}s` : gSpec.sub.slice(0, 7);
    }
  }

  // ==================== PILLAR 1: ASTRAL GIANT AVATAR (`法天象地·十丈元神真身`) & TITAN-VS-TITAN CLASH ====================
  function triggerAstralGiantForm() {
    if (!game) return false;
    if (!guardActionRealm("astral")) return false;
    if (arena.astralForm && arena.astralForm.active) {
      // Already in Astral Form -> unleash Star-River Sword-Finger Bombardment (`星河剑指轰击`)!
      if ((arena.astralBombCd || 0) > 0) return false;
      arena.astralBombCd = 2.6;
      castAstralStarRiverBombardment();
      return true;
    }
    if ((arena.astralCd || 0) > 0) {
      showToast(`法天象地调息中 (${arena.astralCd.toFixed(1)}s)`);
      return false;
    }
    const rankS = getStyleRankSpec(arena.styleScore || 0).rank === "S";
    if ((arena.astralEnergy || 0) < 100 && !rankS) {
      showToast(`元神灵力蓄积中 (${Math.floor(arena.astralEnergy || 0)}/100%) · 达成 S 评级或破势斩妖可立即激发【法天象地】！`);
      return false;
    }
    if (!consumePlayerMp(30, "法天象地")) return false;
    arena.astralEnergy = 0;
    arena.astralCd = 30.0;
    const ks = getKarmaState(game);
    const isDemonic = ks.mode === "demonic";
    const artKey = isDemonic ? "avatar_asura_demon" : "avatar_taiqing_immortal";
    const title = isDemonic ? "九幽修罗魔剑真身" : "太清金阙剑仙真身";
    const color = isDemonic ? "#ff4d5e" : "#ffe28a";

    arena.astralForm = {
      active: true,
      mode: isDemonic ? "demonic" : "righteous",
      art: artKey,
      title,
      color,
      life: 10.5,
      maxLife: 10.5,
      clashTriggered: false
    };
    const p = arena.player;
    const st = getCombatStats(game);
    p.hyperArmorTimer = 10.5;
    p.invuln = Math.max(p.invuln || 0, 1.2);
    p.shieldHp = Math.max(p.shieldHp || 0, Math.round(st.maxHp * 0.45));

    Sound.soulManifestRoar();
    Sound.fanfare();
    GamepadSystem.rumble(1.0, 0.92, 300);
    triggerImpactFrame(4, color, p.x, p.y - 48);
    triggerRadialChromaticBurst(1.45, color, p.x, p.y - 40);
    spawnDistortionRing(p.x, p.y, 285, color);
    registerStyleAction("astral", 210);
    pushTelemetryInput(`🔱法天·${isDemonic ? "修罗真身" : "金阙真身"}!`, false);
    showBossCutIn(artKey, `法天象地 · 【${title}】降世`, isDemonic ? "十丈四臂修罗魔神 · 裂穹魔剑噬血狂斩，正面对撞巨神触发【双巨神跨屏角力】！" : "十丈金阙剑仙元神 · 全程霸体免控与星河剑指，正面对撞巨神触发【双巨神跨屏角力】！", { isPlayerUlt: true, cutInKey: isDemonic ? "ult_astral_demon" : "ult_astral_immortal" });

    // If a Colossal Titan or Boss is nearby on cast, check immediate shockwave or clash!
    const nearTitan = arena.enemies.find(e => e.hp > 0 && (e.isTitan || e.isBoss) && Math.hypot(e.x - p.x, e.y - p.y) < 380);
    if (nearTitan && nearTitan.isTitan) {
      triggerTitanVsTitanClash(nearTitan);
    } else {
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 280) {
          damageEnemy(e, Math.round(st.atk * 3.2), true, 56, Math.atan2(e.y - p.y, e.x - p.x), 12, true);
        }
      });
    }
    syncV22TacticalDock();
    updateHud();
    return true;
  }

  function castAstralStarRiverBombardment() {
    const af = arena.astralForm;
    if (!af || !af.active || !game) return;
    const p = arena.player;
    const st = getCombatStats(game);
    Sound.thunderCrack();
    Sound.bianzhong(523.25, 0.14);
    triggerRadialChromaticBurst(1.15, af.color, p.x, p.y - 40);
    pushTelemetryInput("☄星河剑指轰击!", false);
    for (let k = 0; k < 7; k++) {
      const tgt = arena.enemies[k % Math.max(1, arena.enemies.length)];
      const bx = tgt ? tgt.x + (k - 3) * 26 : p.x + p.facing * (90 + k * 42);
      const by = tgt ? tgt.y + ((k % 3) - 1) * 24 : p.y + ((k % 3) - 1) * 45;
      arena.skyBolts.push({ x: bx, y: by, t: 0, color: af.color });
      arena.slashes.push({ x: bx, y: by, r: 95, ang: 0, t: 0, color: af.color, heavy: true, rain: true });
    }
    arena.enemies.slice().forEach(e => {
      if (e.hp > 0) {
        e.swordMarks = 6;
        damageEnemy(e, Math.round(st.atk * 3.4), true, 54, 0, 8, true);
      }
    });
    addFloat(`☄ 法天象地 · 【星河剑指轰击】！！`, p.x, p.y - 95, af.color, 21, true);
  }

  function triggerTitanVsTitanClash(boss) {
    if (!game || !boss || !arena.astralForm || !arena.astralForm.active) return false;
    const af = arena.astralForm;
    af.clashTriggered = true;
    const p = arena.player;
    const st = getCombatStats(game);
    p.invuln = 1.6;
    boss.grabWindup = false;
    boss.lowSweepWindup = false;

    // Position the two Colossal Giants face-to-face across the screen center!
    const midX = (p.x + boss.x) * 0.5;
    const midY = (p.y + boss.y) * 0.5;
    arena.camFocusX = midX;
    arena.camFocusY = midY - 28;
    arena.camFocusT = 1.25;
    arena.camZoom = 1.18;

    const lbt = document.getElementById("cinema-letterbox-top"), lbb = document.getElementById("cinema-letterbox-bot");
    if (lbt) lbt.classList.add("open");
    if (lbb) lbb.classList.add("open");

    arena.titanDualClash = {
      t: 0,
      dur: 1.15,
      boss,
      midX,
      midY,
      resolved: false
    };

    const clashHud = document.getElementById("blade-clash-hud");
    const clashTit = document.getElementById("blade-clash-title");
    const clashSub = document.getElementById("blade-clash-sub");
    const clashFill = document.getElementById("blade-clash-fill");
    if (clashTit) clashTit.textContent = `🔱 法相天地 · 【${af.title} VS ${boss.name.split(" · ")[0]}】跨屏角力！！`;
    if (clashSub) clashSub.textContent = "十丈法相神威碾压 · 即将一举轰碎敌酋全部护甲与双臂神兵！";
    if (clashFill) clashFill.style.width = "88%";
    if (clashHud) clashHud.classList.add("active");

    Sound.bladeClashGrind();
    Sound.soulManifestRoar();
    GamepadSystem.rumble(1.0, 1.0, 350);
    triggerRadialChromaticBurst(1.55, af.color, midX, midY - 24);
    registerStyleAction("titan_clash", 260);
    pushTelemetryInput("🔱双巨神跨屏角力!", false);
    addFloat("🔱 法相天地 · 双巨神跨屏角力！！", midX, midY - 92, "#fff5c0", 24, true);
    return true;
  }

  function stepTitanDualClash(dt) {
    const tc = arena.titanDualClash;
    if (!tc) return false;
    tc.t += dt / tc.dur;
    arena.camZoom = 1.18 + Math.sin(tc.t * Math.PI) * 0.06;
    if (Math.random() < 0.65) {
      arena.clashVfxList.push({ x: tc.midX + (Math.random() - 0.5) * 40, y: tc.midY - 24, r: 165, t: 0 });
    }
    if (tc.t >= 1 && !tc.resolved) {
      tc.resolved = true;
      arena.titanDualClash = null;
      const clashHud = document.getElementById("blade-clash-hud");
      if (clashHud) clashHud.classList.remove("active");
      const lbt = document.getElementById("cinema-letterbox-top"), lbb = document.getElementById("cinema-letterbox-bot");
      if (lbt) lbt.classList.remove("open");
      if (lbb) lbb.classList.remove("open");

      const b = tc.boss;
      const st = getCombatStats(game);
      if (b && b.hp > 0) {
        b.wardHp = 0;
        b.frontShieldHp = 0;
        b.posture = 0;
        b.state = "stun";
        b.timer = 6.5;
        if (b.isTitan && b.titanParts) {
          b.titanParts.left_claw.hp = 0; b.titanParts.left_claw.broken = true;
          b.titanParts.right_halberd.hp = 0; b.titanParts.right_halberd.broken = true;
          b.titanCollapsed = true;
        }
        const smashDmg = Math.round(st.atk * 6.8);
        triggerImpactFrame(4, "#ffe28a", b.x, b.y - 30);
        triggerRadialChromaticBurst(1.6, "#ffe28a", b.x, b.y - 24);
        spawnDistortionRing(tc.midX, tc.midY, 340, "#ffe28a");
        Sound.coreSeverBoom();
        arena.shake = 24;
        damageEnemy(b, smashDmg, true, 120, 0, 18, true);
        triggerKillCamStamp("法天破界");
        captureBattleHighlightFrame("法天破界", `${tc.boss.name.split(" · ")[0]}·双巨神角力崩甲`, smashDmg, 5);
        addFloat(`💥 双神角力胜出 · 护甲尽碎 -${smashDmg}！！`, b.x, b.y - 86, "#fff3b0", 25, true);
      }
      updateBossBannerAndRecallOrb();
      updateHud();
    }
    return true;
  }

  // ==================== PILLAR 2: MYTHIC MOUNT COMBAT (`山海神兽灵骑 · J键冲锋 & 跃马坠星劈`) ====================
  function triggerMythicMountAction() {
    if (!game) return false;
    if (!guardActionRealm("mount")) return false;
    if ((arena.mountCd || 0) > 0) {
      showToast(`灵骑冲锋调息中 (${arena.mountCd.toFixed(1)}s)`);
      return false;
    }
    if (!consumePlayerMp(18, "山海灵骑")) return false;
    arena.mountCd = 8.0;
    if (!game.equippedMount) game.equippedMount = "qilin";
    const mSpec = MYTHIC_MOUNTS[game.equippedMount] || MYTHIC_MOUNTS.qilin;
    const p = arena.player;
    const st = getCombatStats(game);

    if (!arena.mountState || !arena.mountState.active) {
      arena.mountState = { active: true, mountId: mSpec.id, chargeTimer: 0, frostTick: 0 };
      if (mSpec.id === "baize") {
        p.shieldHp = Math.max(p.shieldHp || 0, Math.round(st.maxHp * 0.28));
      }
      addFloat(`🐎 呼哨召灵骑 · 【${mSpec.name}】踏云来袭！`, p.x, p.y - 68, mSpec.color, 19, true);
    } else {
      arena.mountState.mountId = mSpec.id;
    }

    // Execute Mounted Breakthrough Charge (`神兽破阵冲锋`)!
    let ang = Math.atan2(pointer.y - p.y, pointer.x - p.x);
    const lockTgt = acquireSoftLockTarget(p.x, p.y, ang);
    if (lockTgt) ang = Math.atan2(lockTgt.y - p.y, lockTgt.x - p.x);
    p.facing = Math.cos(ang) >= 0 ? 1 : -1;
    p.invuln = Math.max(p.invuln || 0, 0.52);
    arena.mountState.chargeTimer = 0.36;
    arena.mountState.chargeVx = Math.cos(ang) * 19.5;
    arena.mountState.chargeVy = Math.sin(ang) * 13.5;

    Sound.drum(0.28);
    Sound.skyLeapWhoosh();
    GamepadSystem.rumble(0.68, 0.56, 140);
    registerStyleAction("mount_charge", 88);
    pushTelemetryInput(`🐎${mSpec.short}·破阵冲锋`, false);
    triggerRadialChromaticBurst(0.85, mSpec.color, p.x, p.y);

    if (mSpec.id === "qilin") {
      arena.fireZones.push({ x: p.x + Math.cos(ang) * 55, y: p.y + Math.sin(ang) * 35, r: 92, life: 4.5, tickCd: 0.1 });
    } else if (mSpec.id === "qingluan") {
      [-0.32, -0.16, 0.16, 0.32].forEach(off => {
        const a = ang + off;
        arena.projectiles.push({
          friendly: true, kind: "crescent", x: p.x, y: p.y - 12,
          vx: Math.cos(a) * 17.5, vy: Math.sin(a) * 17.5, ang: a, r: 46,
          dmg: Math.round(st.atk * 1.18), postureDmg: 15, knock: 6, addMark: 1, life: 0.55,
          pierced: new Set(), color: "#70ffe6"
        });
      });
    }

    const cv = document.getElementById("fx-canvas");
    const w = (cv && cv.width) || 1440, h = (cv && cv.height) || 900;
    const dest = clampToPlaza(p.x + Math.cos(ang) * 155, p.y + Math.sin(ang) * 98, w, h);
    arena.blinkStreaks.push({ x1: p.x, y1: p.y, x2: dest.x, y2: dest.y, t: 0, color: mSpec.color });
    p.x = dest.x; p.y = dest.y;

    arena.props.slice().forEach(pr => {
      if (pr.destructible && pr.hp > 0 && Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + 135) damageBattleProp(pr, st.atk * 2.2);
    });
    arena.enemies.slice().forEach(e => {
      if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 150) {
        if ((e.frontShieldHp || 0) > 0) {
          e.frontShieldHp = 0;
          addFloat("💥 麒麟踏碎灵盾！", e.x, e.y - 46, "#ffd166", 17, true);
        }
        if (mSpec.id === "baize") e.chillTimer = 4.5;
        damageEnemy(e, Math.round(st.atk * 2.35), true, 48, ang, 16, true);
      }
    });
    syncV22TacticalDock();
    updateHud();
    return true;
  }

  function triggerVaultDismountStrike() {
    if (!game || !arena.mountState || !arena.mountState.active) return false;
    const mSpec = MYTHIC_MOUNTS[arena.mountState.mountId || "qilin"] || MYTHIC_MOUNTS.qilin;
    arena.mountState.active = false;
    const p = arena.player;
    const st = getCombatStats(game);

    // Rider vaults skyward (`z = 76`) seamlessly entering Aerial Combo / Meteor Plunge state!
    p.z = 76;
    p.vz = 9.4;
    p.airComboStep = 0;
    p.plunging = false;
    p.invuln = Math.max(p.invuln || 0, 0.68);

    let ang = Math.atan2(pointer.y - p.y, pointer.x - p.x);
    const lockTgt = acquireSoftLockTarget(p.x, p.y, ang);
    if (lockTgt) ang = Math.atan2(lockTgt.y - p.y, lockTgt.x - p.x);
    const crashX = p.x + Math.cos(ang) * 95, crashY = p.y + Math.sin(ang) * 58;

    Sound.meteorPlungeBoom();
    Sound.skyLeapWhoosh();
    GamepadSystem.rumble(0.78, 0.68, 165);
    arena.meteorBursts.push({ x: crashX, y: crashY, r: 175, t: 0 });
    spawnDistortionRing(crashX, crashY, 210, mSpec.color);
    addDecal(crashX, crashY + 12, ang, 78, "spider_crack");
    registerStyleAction("vault_dismount", 125);
    pushTelemetryInput("☄飞身跃马·坠星劈!", false);

    arena.enemies.slice().forEach(e => {
      if (e.hp > 0 && Math.hypot(e.x - crashX, e.y - crashY) < e.r + 165) {
        e.airborneZ = 48;
        e.airborneVz = 5.8;
        e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
        damageEnemy(e, Math.round(st.atk * 2.95), true, 56, ang, 11, true);
      }
    });
    addFloat(`☄ 飞身跃马 · 【凌空坠星劈】！(接左键空连)`, p.x, p.y - 84, "#ffe89e", 20, true);
    syncV22TacticalDock();
    updateHud();
    return true;
  }

  // ==================== PILLAR 3: QIMEN EIGHT-GATES TACTICAL FIELD ARRAY (`奇门遁甲·U键四门阵盘 & 阵剑附魔`) ====================
  function deployOrCycleQimenArray() {
    if (!game) return false;
    if (!guardActionRealm("qimen")) return false;
    if ((arena.qimenCd || 0) > 0) {
      showToast(`奇门阵盘调息中 (${arena.qimenCd.toFixed(1)}s)`);
      return false;
    }
    if (!consumePlayerMp(22, "奇门八门阵")) return false;
    arena.qimenCd = 12.0;
    const p = arena.player;
    const nextIdx = arena.qimenArray && arena.qimenArray.active
      ? ((arena.qimenGateIdx || 0) + 1) % QIMEN_GATES.length
      : (arena.qimenGateIdx || 0) % QIMEN_GATES.length;
    arena.qimenGateIdx = nextIdx;
    const gate = QIMEN_GATES[nextIdx];

    arena.qimenArray = {
      active: true,
      gate,
      x: p.x,
      y: p.y + 12,
      r: 172,
      rot: 0,
      life: 10.0,
      maxLife: 10.0,
      tickCd: 0.15,
      enchantedCount: 0,
      resonated: false
    };

    Sound.bianzhong(587.33, 0.11);
    Sound.qiOrb(3);
    addRipple(p.x, p.y + 18, 172, gate.color);
    registerStyleAction("qimen", 72);
    pushTelemetryInput(`☯布阵·${gate.short.slice(3)}`, false);
    addFloat(`☯ 奇门布阵 · 【${gate.name}】(${gate.sub})！`, p.x, p.y - 62, gate.color, 19, true);
    syncV22TacticalDock();
    updateHud();
    return true;
  }

  function triggerQimenResonanceNova() {
    const qa = arena.qimenArray;
    if (!qa || !qa.active || !game) return false;
    const p = arena.player;
    if (Math.hypot(p.x - qa.x, (p.y - qa.y) / 0.62) > qa.r + 65) return false;
    const st = getCombatStats(game);
    qa.r = Math.min(260, qa.r + 64);
    qa.life = Math.min(12.0, qa.life + 3.5);
    qa.resonated = true;

    Sound.coreSeverBoom();
    triggerRadialChromaticBurst(1.15, qa.gate.color, qa.x, qa.y);
    spawnDistortionRing(qa.x, qa.y, qa.r + 35, qa.gate.color);
    if (qa.gate.id === "jing_fire") {
      arena.fireZones.push({ x: qa.x, y: qa.y, r: qa.r * 0.85, life: 5.0, tickCd: 0.1 });
    } else if (qa.gate.id === "jing_thunder") {
      arena.skyBolts.push({ x: qa.x, y: qa.y, t: 0, color: "#d69eff" });
      triggerElectroPoolReaction(qa.x, qa.y, st.atk * 1.5);
    }
    arena.enemies.slice().forEach(e => {
      if (e.hp > 0 && Math.hypot(e.x - qa.x, e.y - qa.y) < qa.r + e.r) {
        damageEnemy(e, Math.round(st.atk * 2.45), true, 48, Math.atan2(e.y - qa.y, e.x - qa.x), 10, true);
      }
    });
    addFloat(`☯ 奇门阵眼共鸣 · 【${qa.gate.short.slice(3)}扩域爆破】！！`, qa.x, qa.y - 54, qa.gate.color, 20, true);
    return true;
  }

  function stepQimenArrayAndMount(dt, st) {
    const p = arena.player;
    // Step Astral Giant Form timer & energy charge
    if (arena.astralForm && arena.astralForm.active) {
      arena.astralForm.life -= dt;
      p.hyperArmorTimer = Math.max(p.hyperArmorTimer || 0, 0.25);
      if (arena.astralForm.life <= 0) {
        arena.astralForm.active = false;
        arena.astralForm = null;
        addFloat("法天象地元神归窍！", p.x, p.y - 54, "#ffe28a", 16);
      }
    }

    // Step Mythic Mount passive effects (Baize frost aura / Qilin flame hooves)
    if (arena.mountState && arena.mountState.active) {
      const mId = arena.mountState.mountId || "qilin";
      arena.mountState.frostTick = (arena.mountState.frostTick || 0) - dt;
      if (arena.mountState.frostTick <= 0) {
        arena.mountState.frostTick = 0.55;
        if (mId === "baize") {
          arena.enemies.forEach(e => {
            if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 145) e.chillTimer = Math.max(e.chillTimer || 0, 2.2);
          });
        }
      }
    }

    // Step Active Qimen Eight-Gates Field Array
    const qa = arena.qimenArray;
    if (!qa || !qa.active) { syncV22TacticalDock(); return; }
    qa.life -= dt;
    qa.rot += dt * 1.35;
    if (qa.life <= 0) {
      qa.active = false;
      arena.qimenArray = null;
      syncV22TacticalDock();
      return;
    }

    const playerInside = Math.hypot(p.x - qa.x, (p.y - qa.y) / 0.62) < qa.r;
    if (qa.gate.id === "sheng" && playerInside) {
      game.hp = Math.min(st.maxHp, game.hp + st.maxHp * 0.08 * dt);
      game.mp = Math.min(st.maxMp, (game.mp || 0) + st.maxMp * 0.12 * dt);
    }

    // Gate 2 (`景门·离火焚天阵`): Enchant ALL friendly projectiles passing through the Qimen Array with Samadhi True Fire!
    if (qa.gate.id === "jing_fire") {
      for (const pr of arena.projectiles) {
        if (pr.friendly && !pr.qimenFire && Math.hypot(pr.x - qa.x, (pr.y - qa.y) / 0.62) < qa.r + 24) {
          pr.qimenFire = true;
          pr.dmg = Math.round(pr.dmg * 1.42);
          pr.color = "#ff7b38";
          pr.r = Math.round(pr.r * 1.18);
          qa.enchantedCount = (qa.enchantedCount || 0) + 1;
        }
      }
    }

    // Gate 3 (`惊门·震雷重力阵`): Gravity pull + periodic Zi-Xiao lightning!
    qa.tickCd -= dt;
    if (qa.tickCd <= 0) {
      qa.tickCd = 0.62;
      if (qa.gate.id === "jing_thunder") {
        let struck = false;
        arena.enemies.slice().forEach(e => {
          if (e.hp > 0 && Math.hypot(e.x - qa.x, e.y - qa.y) < qa.r + e.r + 35) {
            e.x += (qa.x - e.x) * 0.24;
            e.y += (qa.y - e.y) * 0.24;
            arena.skyBolts.push({ x: e.x, y: e.y, t: 0, color: "#d69eff" });
            damageEnemy(e, Math.round(st.atk * 0.78), false, 18, 0, 2, false);
            struck = true;
          }
        });
        if (struck) triggerElectroPoolReaction(qa.x, qa.y, st.atk);
      }
    }
    syncV22TacticalDock();
  }

  // ==================== PILLAR 4A: CUSTOM ENCOUNTER BUILDER & SEED CODE WORKSHOP (`太虚造化工坊 · 论剑种子码`) ====================
  const WORKSHOP_BOSS_LIST = [
    { idx: 0, id: "zhulong_titan", name: "太古烛龙·魔神法相 (跨屏巨神)" },
    { idx: 1, id: "sky_roc",       name: "巡天金甲雷鹏将 (空天妖帅)" },
    { idx: 2, id: "inner_demon",   name: "太虚心魔镜像 (双姿剑反)" },
    { idx: 3, id: "sentinel",      name: "云台守灵 (护阵天雷)" },
    { idx: 4, id: "puppet",        name: "古境剑傀 (镜反剑轮)" },
    { idx: 5, id: "serpent",       name: "寒潭玄蛇 (玄冰毒沼)" },
    { idx: 6, id: "warden",        name: "守山石卫 (裂地重锤)" }
  ];

  const workshopState = {
    boss1: 0,      // Default: 太古烛龙
    boss2: 2,      // Default Dual-Boss Co-Op: 太虚心魔镜像 (7 = None)
    hazards: 2,    // 0=净台, 1=标准, 2=万象满布
    affixes: 3,    // Bitmask of RUSH_AFFIX_SPECS (0..15)
    curioIdx: 1    // Index into SPIRE_CURIOS (0 = None, 1..16 = SPIRE_CURIOS[idx-1])
  };

  function encodeWorkshopSeed(cfg = workshopState) {
    const b1 = Math.max(0, Math.min(6, Number(cfg.boss1) || 0));
    const b2 = Math.max(0, Math.min(7, cfg.boss2 === undefined ? 7 : Number(cfg.boss2)));
    const hz = Math.max(0, Math.min(2, Number(cfg.hazards) || 0));
    const af = Math.max(0, Math.min(15, Number(cfg.affixes) || 0));
    const cu = Math.max(0, Math.min(16, Number(cfg.curioIdx) || 0));
    const chk = ((b1 * 31 + b2 * 17 + hz * 13 + af * 7 + cu * 5 + 0x5A) & 0xFF).toString(16).toUpperCase().padStart(2, "0");
    return `CY22-${b1}${b2}-${hz}${af.toString(16).toUpperCase()}-${cu.toString(16).toUpperCase().padStart(2, "0")}-${chk}`;
  }

  function decodeWorkshopSeed(rawStr) {
    if (!rawStr || typeof rawStr !== "string") return null;
    const clean = rawStr.trim().toUpperCase();
    const m = clean.match(/^CY22-([0-6])([0-7])-([0-2])([0-9A-F])-([0-9A-F]{2})-([0-9A-F]{2})$/);
    if (!m) return null;
    const b1 = parseInt(m[1], 10);
    const b2 = parseInt(m[2], 10);
    const hz = parseInt(m[3], 10);
    const af = parseInt(m[4], 16);
    const cu = parseInt(m[5], 16);
    if (cu > 16) return null;
    const expectedChk = ((b1 * 31 + b2 * 17 + hz * 13 + af * 7 + cu * 5 + 0x5A) & 0xFF).toString(16).toUpperCase().padStart(2, "0");
    if (m[6] !== expectedChk) return null;
    return { boss1: b1, boss2: b2, hazards: hz, affixes: af, curioIdx: cu };
  }

  function openCustomWorkshopModal() {
    if (!game) return;
    if (!guardEcosystemAccess("seed_workshop")) return;
    notifyUnlockCardTried("workshop");
    closeDrawer();
    const seedStr = encodeWorkshopSeed(workshopState);

    openModal(`
      <div class="drawer-mural-banner" style="height:88px;">
        <img src="${ART.arena_wanjian_tomb}" alt="太虚造化工坊" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">自定义双王共斗 · 种子分享</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:3px;">🛠 太虚造化工坊 · 自定义论剑令与种子码</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">返回道场 ✕</button>
        </div>
      </div>

      <div class="workshop-grid">
        <div class="workshop-box">
          <strong style="font-size:11.5px;color:var(--gold-bright);">① 主镇守妖王 (Primary Boss)</strong>
          <select id="sel-ws-boss1" class="workshop-select">
            ${WORKSHOP_BOSS_LIST.map(b => `<option value="${b.idx}" ${workshopState.boss1 === b.idx ? "selected" : ""}>${b.name}</option>`).join("")}
          </select>
        </div>
        <div class="workshop-box">
          <strong style="font-size:11.5px;color:#ff9eff;">② 同台共斗副首领 (Dual-Boss Co-Op)</strong>
          <select id="sel-ws-boss2" class="workshop-select">
            <option value="7" ${workshopState.boss2 === 7 ? "selected" : ""}>无（单首领孤峰论剑）</option>
            ${WORKSHOP_BOSS_LIST.map(b => `<option value="${b.idx}" ${workshopState.boss2 === b.idx ? "selected" : ""}>同台共斗：${b.name}</option>`).join("")}
          </select>
        </div>
        <div class="workshop-box">
          <strong style="font-size:11.5px;color:#80ffea;">③ 战场五行机关密度 (Terrain Hazards)</strong>
          <select id="sel-ws-hazards" class="workshop-select">
            <option value="0" ${workshopState.hazards === 0 ? "selected" : ""}>净台论剑（无场景机关干扰）</option>
            <option value="1" ${workshopState.hazards === 1 ? "selected" : ""}>标准秘境（玄冰+灵泉+古剑碑）</option>
            <option value="2" ${workshopState.hazards === 2 ? "selected" : ""}>万象满布（双灵泉+丹炉+玄冰+八卦秘壁）</option>
          </select>
        </div>
        <div class="workshop-box">
          <strong style="font-size:11.5px;color:#ffe28a;">④ 初始赐福天道奇物 (Lv.2 助阵测试)</strong>
          <select id="sel-ws-curio" class="workshop-select">
            <option value="0" ${workshopState.curioIdx === 0 ? "selected" : ""}>不额外携带测试奇物</option>
            ${SPIRE_CURIOS.map((c, idx) => `<option value="${idx + 1}" ${workshopState.curioIdx === idx + 1 ? "selected" : ""}>${c.name} Lv.2 (${c.badge})</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="workshop-box">
        <strong style="font-size:11.5px;color:var(--gold-bright);">⑤ 问道劫律试炼词缀组合：</strong>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${RUSH_AFFIX_SPECS.map((af, idx) => {
            const on = (workshopState.affixes & (1 << idx)) !== 0;
            return `<button type="button" class="btn-ghost ${on ? "active-pill" : ""}" style="padding:4px 10px;font-size:11px;" data-ws-affix="${idx}">${on ? "🔥 " : "○ "}${af.name}</button>`;
          }).join("")}
        </div>
      </div>

      <div class="jade-card" style="padding:8px 11px;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:11.5px;color:#80ffea;">🔑 太虚论剑种子码（支持复制分享或粘贴任意 CY22 种子码一键还原战局）：</strong>
          <span id="ws-seed-status" style="font-size:10.5px;color:var(--jade);">校验通过 ✓</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <input id="inp-workshop-seed" class="seed-code-input" type="text" value="${seedStr}" aria-label="太虚论剑码" />
          <button type="button" id="btn-copy-seed" class="btn-ghost" style="padding:6px 11px;font-size:11px;white-space:nowrap;" data-action="ws-copy-seed">📋 复制论剑码</button>
          <button type="button" id="btn-import-seed" class="btn-jade" style="padding:6px 11px;font-size:11px;white-space:nowrap;" data-action="ws-import-seed">📥 解析导入</button>
          <button type="button" id="btn-launch-workshop" class="btn-gold" style="padding:6px 16px;font-size:12px;white-space:nowrap;" data-action="ws-launch">⚔ 执令开阵</button>
        </div>
      </div>
    `, true);
  }

  function spawnWorkshopBossBySpecIdx(specIdx, x, y, scaleMult = 1.45) {
    const item = WORKSHOP_BOSS_LIST[specIdx];
    if (!item) return null;
    const cv = document.getElementById("fx-canvas");
    const w = (cv && cv.width) || 1440, h = (cv && cv.height) || 900;
    const st = getCombatStats(game);

    if (item.id === "zhulong_titan") {
      const titanHp = Math.max(2000, Math.round(st.atk * 38));
      const armHp = Math.max(300, Math.round(titanHp * 0.22));
      const eyeHp = Math.max(380, Math.round(titanHp * 0.28));
      const titan = {
        uid: "ws_titan_" + Math.random().toString(36).slice(2, 7),
        id: "zhulong_titan", art: "boss_zhulong_titan", name: "造化试剑 · 太古烛龙法相",
        isBoss: true, isTitan: true, isTreasure: false, enraged: false,
        titanCollapsed: false, climbExecuted: false, laserSweepTimer: 0, laserAng: Math.PI,
        titanParts: {
          left_claw:     { id: "left_claw",     name: "左覆海魔爪",   ox: -126, oy: 48,  r: 56, hp: armHp, maxHp: armHp, broken: false },
          brow_eye:      { id: "brow_eye",      name: "眉心天道竖眼", ox: -4,   oy: -96, r: 48, hp: eyeHp, maxHp: eyeHp, broken: false },
          right_halberd: { id: "right_halberd", name: "右裂天雷戟",   ox: 128,  oy: 34,  r: 56, hp: armHp, maxHp: armHp, broken: false }
        },
        mech: "colossal_titan", wardHp: 0, maxWardHp: 0, mirrorTimer: 0, blinkCd: 99, beamCd: 3.8,
        x, y, vx: 0, vy: 0, kx: 0, ky: 0, sx: 1, sy: 1, facing: -1,
        r: 108, hp: titanHp, maxHp: titanHp, posture: 170, maxPosture: 170,
        partHp: eyeHp, maxPartHp: eyeHp, weakpointExposed: true, partSevered: false,
        atk: Math.max(20, Math.round(st.maxHp * 0.13)), heavy: Math.max(32, Math.round(st.maxHp * 0.21)),
        state: "chase", timer: 1.1, windupDur: 0.95, aimX: arena.player.x, aimY: arena.player.y, attackType: "slam",
        hitFlash: 0, swordMarks: 0, chillTimer: 0, burnTimer: 0, airborneZ: 0, airborneVz: 0,
        realmScaledDelta: 0, realmStoneMult: 1
      };
      arena.lockedTitanPart = "left_claw";
      arena.enemies.push(titan);
      return titan;
    }
    if (item.id === "inner_demon") {
      const demonHp = Math.max(920, Math.round(st.atk * 22));
      const pos = clampToPlaza(x, y, w, h);
      const demon = {
        uid: "ws_demon_" + Math.random().toString(36).slice(2, 7),
        id: "trial_gate", art: "actor_inner_demon", name: `造化试剑 · 太虚心魔`,
        isBoss: true, isInnerDemon: true, isTreasure: false, enraged: false,
        demonPosture: "qinglian", postureSwapCd: 4.0, demonParryTimer: 0, swordOrbitAng: 0,
        mech: "mirror_demon", wardHp: 0, maxWardHp: 0, mirrorTimer: 0, blinkCd: 3.4, beamCd: 4.0,
        x: pos.x, y: pos.y, vx: 0, vy: 0, kx: 0, ky: 0, sx: 1, sy: 1, facing: -1,
        r: 46, hp: demonHp, maxHp: demonHp, posture: 130, maxPosture: 130,
        partHp: Math.round(demonHp * 0.28), maxPartHp: Math.round(demonHp * 0.28),
        weakpointExposed: true, partSevered: false,
        atk: Math.max(18, Math.round(st.maxHp * 0.12)), heavy: Math.max(28, Math.round(st.maxHp * 0.20)),
        state: "chase", timer: 0.95, windupDur: 0.88, aimX: arena.player.x, aimY: arena.player.y, attackType: "charge",
        hitFlash: 0, swordMarks: 0, chillTimer: 0, burnTimer: 0, airborneZ: 0, airborneVz: 0,
        realmScaledDelta: 0, realmStoneMult: 1
      };
      arena.enemies.push(demon);
      return demon;
    }
    spawnSingleEnemy(item.id, x, y, scaleMult * (0.9 + rankOf(game.realm) * 0.28), true, `造化试剑 · ${ENEMIES[item.id].name}`);
    return arena.enemies[arena.enemies.length - 1];
  }

  let activeCustomSeedTempCurio = null;

  function getActiveCustomSeedTempCurio() {
    if (!activeCustomSeedTempCurio) return null;
    return {
      cid: activeCustomSeedTempCurio.cid,
      hadKey: !!activeCustomSeedTempCurio.hadKey,
      prevLv: activeCustomSeedTempCurio.prevLv
    };
  }

  function getSanitizedGameForPersistence(g = game) {
    if (!g) return g;
    const rec = activeCustomSeedTempCurio;
    if (rec && rec.targetGame === g && g.spireCurios && rec.cid) {
      const cleanCurios = Object.assign({}, g.spireCurios);
      if (rec.hadKey) {
        cleanCurios[rec.cid] = rec.prevLv;
      } else {
        delete cleanCurios[rec.cid];
      }
      return Object.assign({}, g, { spireCurios: cleanCurios });
    }
    return g;
  }

  function restoreCustomSeedTempCurio() {
    const rec = activeCustomSeedTempCurio;
    activeCustomSeedTempCurio = null;
    if (!rec || !game || rec.targetGame !== game || !game.spireCurios || !rec.cid) return false;
    if (rec.hadKey) {
      game.spireCurios[rec.cid] = rec.prevLv;
    } else {
      delete game.spireCurios[rec.cid];
    }
    syncFlyingSwords();
    return true;
  }

  function openCustomSeedVictoryModal(summary) {
    if (!game || !summary) return;
    const bossList = Array.isArray(summary.bosses) && summary.bosses.length ? summary.bosses.join(" + ") : "造化双王";
    const elapsedTxt = `${num(summary.elapsedSec, 0).toFixed(1)}s`;
    const csGrade = isValidUnifiedGrade(summary.grade)
      ? summary.grade
      : computeModeGrade("custom_seed", { elapsedSec: summary.elapsedSec, hitsTaken: summary.hitsTaken || 0 });
    openModal(`
      <div class="drawer-mural-banner" style="height:88px;">
        <img src="${ART.arena_wanjian_tomb}" alt="造化试剑凯旋" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">造化工坊 · ${escapeHtml(csGrade)} 级试剑圆满</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:3px;">⚔ 太虚造化试剑大捷！</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">收卷 ✕</button>
        </div>
      </div>
      <div class="jade-card" style="gap:6px;padding:10px 12px;">
        <div style="display:flex;gap:7px;flex-wrap:wrap;font-size:11.5px;">
          <span class="tag-chip mythic">试剑评定：${escapeHtml(csGrade)} 级</span>
          <span class="tag-chip mythic">论剑码：${escapeHtml(summary.seed || "")}</span>
          <span class="tag-chip done">耗时：${escapeHtml(elapsedTxt)}</span>
          <span class="tag-chip">已破首领：${escapeHtml(bossList)}</span>
        </div>
        <div style="font-size:11.5px;color:#b8dcd5;line-height:1.5;">
          ${summary.tempCurioRestored ? "✓ 工坊测试奇物 Lv.2 已安全还原，绝不污染正式档奇物进度。" : "本次试剑为独立构筑演武，未改写正式主线与奇物进度。"}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
        <button type="button" id="btn-ws-victory-replay" class="btn-gold" data-action="ws-replay-seed" data-ws-seed="${escapeHtml(summary.seed || "")}">🔁 再战此种子</button>
        <button type="button" id="btn-ws-victory-workshop" class="btn-jade" data-action="open-workshop">🛠 返回造化工坊</button>
        <button type="button" id="btn-ws-victory-sanctum" class="btn-ghost" data-action="enter-sanctum">🏠 返回听雨洞府</button>
      </div>
    `, true, { kind: "custom_seed_victory", tier: "info" });
  }

  function launchCustomSeedEncounter(seedOverride = null) {
    if (!game) return false;
    restoreCustomSeedTempCurio();
    if (seedOverride) {
      const parsed = decodeWorkshopSeed(seedOverride);
      if (parsed) safeAssignPlain(workshopState, parsed);
    }
    const activeSeed = encodeWorkshopSeed(workshopState);
    resetStageTransitionState();
    closeModal();
    closeDrawer();

    const cv = document.getElementById("fx-canvas");
    const w = (cv && cv.width) || 1440, h = (cv && cv.height) || 900;
    arena.stageEpoch += 1;
    arena.sanctumMode = false;
    arena.towerMode = false;
    arena.bossRush = null;
    arena.sectDefense = null;
    arena.cloudFlight = null;
    arena.celestialSpire = null;
    arena.dungeonMap = null;
    arena.waveTransitioning = false;
    arena.defeatRevivesUsed = 0;
    arena.defeatPending = null;
    resetEncounterTelemetry();
    arena.nearbyProp = null;
    renderPropInteractHud();

    // Apply selected affixes
    arena.rushAffixes = [];
    RUSH_AFFIX_SPECS.forEach((af, idx) => {
      if ((workshopState.affixes & (1 << idx)) !== 0) arena.rushAffixes.push(af.id);
    });
    // Grant selected starter Curio Lv.2 strictly for this build-test encounter (restored on exit & omitted from formal saves!)
    let tempCurioRestore = null;
    if (workshopState.curioIdx > 0 && SPIRE_CURIOS[workshopState.curioIdx - 1]) {
      if (!game.spireCurios) game.spireCurios = {};
      const cid = SPIRE_CURIOS[workshopState.curioIdx - 1].id;
      const hadKey = hasOwn(game.spireCurios, cid);
      const prevLv = hadKey ? game.spireCurios[cid] : 0;
      const nextLv = Math.min(PERM_GROWTH_CAPS.spireCurioMaxStack, Math.max(getCurioStacks(game, cid), 2));
      if (!hadKey || nextLv !== prevLv) {
        tempCurioRestore = { cid, hadKey, prevLv, targetGame: game };
        activeCustomSeedTempCurio = tempCurioRestore;
        game.spireCurios[cid] = nextLv;
      }
    }

    arena.enemies = [];
    arena.projectiles = [];
    arena.props = [];
    arena.drops = [];
    arena.waterPools = [];
    arena.fireZones = [];
    arena.frostPools = [];
    arena.hoverChakrams = [];
    transitionStageScene("arena_wanjian_tomb", "workshop");

    const pPos = clampToPlaza(w * 0.30, h * 0.56, w, h);
    arena.player.x = pPos.x; arena.player.y = pPos.y; arena.player.z = 0;

    if (workshopState.hazards >= 1) {
      spawnStageInteractiveHazards();
      if (workshopState.hazards === 2) {
        const extraFire = clampToPlaza(w * 0.48, h * 0.42, w, h);
        arena.props.push({
          id: "ws_fire_" + Date.now(), kind: "fire_brazier", destructible: true, art: "furnace",
          name: "造化丹火炉", badge: "击碎燃起丹炎火海", x: extraFire.x, y: extraFire.y, r: 34, hp: 80, maxHp: 80, hitFlash: 0
        });
      }
    }

    arena.customSeedRun = {
      active: true,
      seed: activeSeed,
      startedAt: Date.now(),
      elapsedSec: 0,
      hitsTaken: 0,
      bosses: [],
      tempCurioRestore
    };

    const spawnedBossNames = [];
    const b1 = spawnWorkshopBossBySpecIdx(workshopState.boss1, w * 0.68, h * 0.46, 1.5);
    if (b1 && b1.name) spawnedBossNames.push(b1.name);
    if (workshopState.boss2 !== 7) {
      const b2 = spawnWorkshopBossBySpecIdx(workshopState.boss2, w * 0.58, h * 0.62, 1.35);
      if (b2 && b2.name) spawnedBossNames.push(b2.name);
    }
    arena.customSeedRun.bosses = spawnedBossNames;
    const dojoBar = document.getElementById("dojo-control-bar");
    if (dojoBar) dojoBar.classList.remove("active");

    const st = getCombatStats(game);
    game.hp = st.maxHp; game.mp = st.maxMp;
    arena.astralEnergy = 100; // Ready for Astral Giant vs Boss testing!
    syncFlyingSwords();
    syncV22TacticalDock();
    updateBossBannerAndRecallOrb();
    updateHud();
    showToast(`⚔ 已按太虚论剑码【${activeSeed}】开启自定义试剑（已充盈100%法天象地元神）！`);
    return true;
  }

  // ==================== V23 PRIMORDIAL EPOCH MODULES ====================
  // 1. Four-Phase Celestial Time-of-Day Law (`太虚天时 · 晨曦 / 烈阳 / 血暮 / 星河`)
  const CELESTIAL_TIME_PHASES = [
    {
      id: "dawn",
      name: "晨曦紫气",
      short: "🌅 晨曦紫气",
      sub: `正道护盾·减伤+${COMBAT_RULE_PARAMS.celestialPhases.dawn.dr}`,
      color: "#ffe29a",
      ambientTint: "rgba(255, 214, 150, 0.09)",
      waterCol: "rgba(255, 228, 172, 0.42)",
      desc: `紫气东来：正道切入时凝结 ${Math.round(COMBAT_RULE_PARAMS.celestialPhases.dawn.righteousShieldPct * 100)}% 气血莲盾，每秒回复 ${Math.round(COMBAT_RULE_PARAMS.celestialPhases.dawn.hpRegenPctPerSec * 100)}% 气血与 ${Math.round(COMBAT_RULE_PARAMS.celestialPhases.dawn.mpRegenPctPerSec * 100)}% 灵力，仙葫回春效果 +${Math.round((COMBAT_RULE_PARAMS.celestialPhases.dawn.healAmp - 1) * 100)}%，常驻护体减伤 +${COMBAT_RULE_PARAMS.celestialPhases.dawn.dr}！`
    },
    {
      id: "noon",
      name: "烈阳当空",
      short: "☀ 烈阳当空",
      sub: `攻击池+${Math.round(COMBAT_RULE_PARAMS.celestialPhases.noon.passiveAtkPct * 100)}%·元神+${Math.round((COMBAT_RULE_PARAMS.celestialPhases.noon.astralEnergyMult - 1) * 100)}%`,
      color: "#ffd166",
      ambientTint: "rgba(255, 238, 178, 0.07)",
      waterCol: "rgba(255, 245, 200, 0.36)",
      desc: `乾阳炽盛：常驻攻击池 +${Math.round(COMBAT_RULE_PARAMS.celestialPhases.noon.passiveAtkPct * 100)}%，法天元神积攒效率 +${Math.round((COMBAT_RULE_PARAMS.celestialPhases.noon.astralEnergyMult - 1) * 100)}%！`
    },
    {
      id: "blood_dusk",
      name: "残阳血暮",
      short: "🌇 残阳血暮",
      sub: `魔+${Math.round(COMBAT_RULE_PARAMS.celestialPhases.blood_dusk.demonicPassiveAtkPct * 100)}%/常+${Math.round(COMBAT_RULE_PARAMS.celestialPhases.blood_dusk.otherPassiveAtkPct * 100)}%·重击回血`,
      color: "#ff6b6b",
      ambientTint: "rgba(218, 56, 48, 0.16)",
      waterCol: "rgba(255, 98, 78, 0.46)",
      desc: `残阳如血：常驻攻击池提升（魔心 +${Math.round(COMBAT_RULE_PARAMS.celestialPhases.blood_dusk.demonicPassiveAtkPct * 100)}% / 其余 +${Math.round(COMBAT_RULE_PARAMS.celestialPhases.blood_dusk.otherPassiveAtkPct * 100)}%），暴击倍率 +${Math.round(COMBAT_RULE_PARAMS.celestialPhases.blood_dusk.critMult * 100)}%，重击命中回复 ${Math.round(COMBAT_RULE_PARAMS.celestialPhases.blood_dusk.heavyHealMaxHpPct * 100)}% 最大气血！`
    },
    {
      id: "star_night",
      name: "极夜星河",
      short: "🌌 极夜星河",
      sub: "星宿×2·月煞掉星魄",
      color: "#a8b8ff",
      ambientTint: "rgba(22, 36, 96, 0.24)",
      waterCol: "rgba(150, 195, 255, 0.52)",
      desc: `星河倒悬：【周天二十八星图】全部星宿被动翻倍（×${COMBAT_RULE_PARAMS.celestialPhases.star_night.starChartMult.toFixed(1)}）！激发首领【月华夜煞】弦月变招，斩杀首领额外必掉稀有【鸿蒙星魄+1】！`
    }
  ];

  const celestialState = {
    idx: 0,
    timer: 42.0,
    autoFlow: true,
    fireflies: Array.from({ length: 22 }, (_, i) => ({
      seed: i * 1.73,
      rx: ((i * 73) % 92) / 100 + 0.04,
      ry: ((i * 47) % 76) / 100 + 0.12
    }))
  };

  function getCurrentCelestialPhase() {
    return CELESTIAL_TIME_PHASES[celestialState.idx % CELESTIAL_TIME_PHASES.length] || CELESTIAL_TIME_PHASES[0];
  }

  function setCelestialTimePhase(nextIdx, silent = false) {
    celestialState.idx = ((nextIdx % CELESTIAL_TIME_PHASES.length) + CELESTIAL_TIME_PHASES.length) % CELESTIAL_TIME_PHASES.length;
    celestialState.timer = 42.0;
    const ph = getCurrentCelestialPhase();
    document.body.setAttribute("data-celestial-phase", ph.id);
    if (!silent && game) {
      Sound.bianzhong(ph.id === "star_night" ? 659.25 : ph.id === "blood_dusk" ? 440 : 523.25, 0.10);
      addFloat(`${ph.short} · ${ph.sub}`, arena.player.x, arena.player.y - 68, ph.color, 18, true);
      showToast(`☯ 天时流转至【${ph.name}】：${ph.desc}`);
      if (ph.id === "dawn" && getKarmaState(game).mode === "righteous") {
        const st = getCombatStats(game);
        arena.player.shieldHp = Math.max(arena.player.shieldHp || 0, Math.round(st.maxHp * COMBAT_RULE_PARAMS.celestialPhases.dawn.righteousShieldPct));
      }
    }
    syncV23EpochDock();
    if (game) updateHud();
    return ph;
  }

  function cycleCelestialTimePhase() {
    if (!game) return null;
    if (!guardActionRealm("celestial_time")) return null;
    return setCelestialTimePhase(celestialState.idx + 1, false);
  }

  // 2. Local 2-Player Same-Screen Co-Op (`太虚同游 · 1P+2P同屏双剑联机 + 同心剑网切割线 + 2.5x同步处决 + 渡气救援`)
  const COOP_PARTNER_ORDER = ["shen", "pei", "lu", "yan"];

  function getUnlockedCoop2PRoster(g = game) {
    if (!g) return ["shen"];
    if (sandboxMode || g.unlockAllArcana) return COOP_PARTNER_ORDER.slice();
    const bonded = COOP_PARTNER_ORDER.filter(id => getCompanionBondTier(g, id) >= 1 || Boolean(g.aids && g.aids[id]));
    return bonded.length > 0 ? bonded : ["shen"];
  }

  function ensureCoop2PState() {
    if (!arena.coop2P) {
      arena.coop2P = {
        active: false,
        partnerId: "shen",
        x: 640,
        y: 500,
        z: 0,
        facing: 1,
        hp: 420,
        maxHp: 420,
        shieldHp: 0,
        downed: false,
        slashCd: 0,
        skillCd: 0,
        tetherTickCd: 0,
        tetherOverchargeT: 0,
        tetherCutCount: 0,
        rescueCd: 0,
        manualIdleT: 1.0,
        bob: 0,
        afterimages: []
      };
    }
    return arena.coop2P;
  }

  function toggleLocalCoop2P(forceState = null, partnerOverride = null) {
    if (!game) return false;
    const c2 = ensureCoop2PState();
    const nextOn = forceState !== null ? !!forceState : !c2.active;
    if (nextOn && !guardActionRealm("coop_2p")) return false;
    const roster = getUnlockedCoop2PRoster(game);
    const st = getCombatStats(game);
    if (partnerOverride && PLAYABLE_COMPANIONS[partnerOverride] && partnerOverride !== "player" && roster.includes(partnerOverride)) {
      c2.partnerId = partnerOverride;
    } else if (!roster.includes(c2.partnerId) || c2.partnerId === (arena.playableCharId || "player")) {
      c2.partnerId = roster.find(id => id !== (arena.playableCharId || "player")) || roster[0] || "shen";
    }
    c2.active = nextOn;
    if (nextOn) {
      const sp = PLAYABLE_COMPANIONS[c2.partnerId] || PLAYABLE_COMPANIONS.shen;
      c2.maxHp = Math.max(220, Math.round(st.maxHp * 0.92));
      c2.hp = c2.maxHp;
      c2.shieldHp = Math.round(c2.maxHp * 0.25);
      c2.downed = false;
      c2.x = arena.player.x + 88;
      c2.y = arena.player.y + 24;
      c2.facing = arena.player.facing;
      c2.tetherOverchargeT = 4.0;
      Sound.fanfare();
      spawnDistortionRing(c2.x, c2.y, 170, sp.color);
      addFloat(`👥 太虚同游开启 · 2P【${sp.name}】同屏参战！`, c2.x, c2.y - 58, sp.color, 19, true);
      showToast(`👥 已开启【本地双人同屏共斗】！2P【${sp.name}】支持 IJKL/方向键/小键盘移动，P/;/小键盘0出招（松手自动智能拉剑网协战），按 [ 键切换已结缘 2P 伙伴（共 ${roster.length} 位）！`);
    } else {
      showToast("已切回单人操控模式（按 ] 键可随时重开 1P+2P 双人同屏共斗）");
    }
    syncV23EpochDock();
    updateHud();
    return c2.active;
  }

  function cycleCoop2PPartner() {
    if (!game) return false;
    if (!guardActionRealm("coop_2p")) return false;
    const c2 = ensureCoop2PState();
    const roster = getUnlockedCoop2PRoster(game);
    const eligible = roster.filter(id => id !== (arena.playableCharId || "player"));
    const pool = eligible.length > 0 ? eligible : roster;
    const curIdx = pool.indexOf(c2.partnerId);
    const nextId = pool[(curIdx + 1) % pool.length] || pool[0] || "shen";
    c2.partnerId = nextId;
    if (!c2.active) {
      return toggleLocalCoop2P(true, nextId);
    }
    if (pool.length <= 1) {
      showToast(`👥 当前 2P 可选已结缘伙伴仅【${(PLAYABLE_COMPANIONS[nextId] || PLAYABLE_COMPANIONS.shen).name}】1 位，结识更多红尘故人即可切换！`);
      syncV23EpochDock();
      return true;
    }
    const sp = PLAYABLE_COMPANIONS[nextId];
    c2.hp = c2.maxHp;
    c2.downed = false;
    Sound.switchStanceChime(true);
    spawnDistortionRing(c2.x, c2.y, 150, sp.color);
    addFloat(`👥 2P 换将 · 【${sp.name}】接剑入阵！`, c2.x, c2.y - 54, sp.color, 18, true);
    syncV23EpochDock();
    return true;
  }

  function triggerCoop2PAttack(isHeavy = false) {
    const c2 = ensureCoop2PState();
    if (!game || !c2.active || c2.downed || c2.slashCd > 0) return false;
    const sp = PLAYABLE_COMPANIONS[c2.partnerId] || PLAYABLE_COMPANIONS.shen;
    const st = getCombatStats(game);
    c2.slashCd = isHeavy ? 0.52 : 0.30;
    const tgt = arena.enemies.find(e => e.hp > 0 && !e.isTreasure) || arena.enemies[0];
    const ang = tgt ? Math.atan2(tgt.y - c2.y, tgt.x - c2.x) : (c2.facing >= 0 ? 0 : Math.PI);
    c2.facing = Math.cos(ang) >= 0 ? 1 : -1;
    c2.afterimages.push({ x: c2.x, y: c2.y, facing: c2.facing, a: 0.85 });
    if (c2.afterimages.length > 4) c2.afterimages.shift();

    pushBladeArc(c2.x + Math.cos(ang) * 24, c2.y - 10 + Math.sin(ang) * 14, ang, isHeavy ? 155 : 118, sp.color, 1, isHeavy);
    Sound.slash(isHeavy, 2);
    if (isHeavy) c2.tetherOverchargeT = Math.max(c2.tetherOverchargeT || 0, 3.2);

    arena.enemies.slice().forEach(e => {
      if (e.hp > 0 && Math.hypot(e.x - (c2.x + Math.cos(ang) * 52), e.y - (c2.y + Math.sin(ang) * 32)) < e.r + (isHeavy ? 148 : 112)) {
        e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
        if (c2.partnerId === "lu") arena.skyBolts.push({ x: e.x, y: e.y, t: 0, color: "#ffe28a" });
        if (c2.partnerId === "shen") game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.03));
        damageEnemy(e, Math.round(st.atk * (isHeavy ? 1.85 : 1.15) * (sp.atkMult || 1.0)), isHeavy, isHeavy ? 34 : 16, ang, 6, isHeavy);
      }
    });
    return true;
  }

  function triggerCoopQiTransferRescue(rescuer = "1p") {
    const c2 = ensureCoop2PState();
    if (!game || !c2.active) return false;
    const st = getCombatStats(game);
    const sp = PLAYABLE_COMPANIONS[c2.partnerId] || PLAYABLE_COMPANIONS.shen;
    if (rescuer === "1p" && c2.downed) {
      arena.blinkStreaks.push({ x1: arena.player.x, y1: arena.player.y, x2: c2.x, y2: c2.y, t: 0, color: "#70ffe6" });
      c2.downed = false;
      c2.hp = Math.round(c2.maxHp * 0.65);
      c2.shieldHp = Math.round(c2.maxHp * 0.35);
      Sound.fanfare();
      spawnDistortionRing(c2.x, c2.y, 185, "#70ffe6");
      addFloat(`☯ 渡气化劫 · 瞬身救起 2P【${sp.name}】！`, c2.x, c2.y - 62, "#80ffea", 20, true);
      captureBattleHighlightFrame("渡气救援", `渡气化劫·瞬救${sp.name}`, c2.hp, 3);
      syncV23EpochDock();
      return true;
    }
    if (rescuer === "2p" && !c2.downed && (c2.rescueCd || 0) <= 0) {
      c2.rescueCd = 10.0;
      arena.blinkStreaks.push({ x1: c2.x, y1: c2.y, x2: arena.player.x, y2: arena.player.y, t: 0, color: sp.color });
      c2.x = arena.player.x + 42;
      c2.y = arena.player.y + 12;
      game.hp = Math.round(st.maxHp * 0.65);
      arena.player.shieldHp = Math.max(arena.player.shieldHp || 0, Math.round(st.maxHp * 0.38));
      arena.player.invuln = 1.25;
      Sound.fanfare();
      spawnDistortionRing(arena.player.x, arena.player.y, 210, sp.color);
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - arena.player.x, e.y - arena.player.y) < e.r + 175) {
          damageEnemy(e, Math.round(st.atk * 1.95), true, 36, Math.atan2(e.y - arena.player.y, e.x - arena.player.x), 14, true);
        }
      });
      addFloat(`💞 渡气化劫 · 2P【${sp.name}】瞬身护主救场！！`, arena.player.x, arena.player.y - 68, "#ffe28a", 21, true);
      captureBattleHighlightFrame("渡气护主", `${sp.name}瞬身渡气救场`, game.hp, 4);
      syncV23EpochDock();
      return true;
    }
    return false;
  }

  function pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) return { dist: Math.hypot(px - x1, py - y1), cx: x1, cy: y1 };
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const cx = x1 + t * dx, cy = y1 + t * dy;
    return { dist: Math.hypot(px - cx, py - cy), cx, cy };
  }

  function stepLocalCoop2PAndWorldLaws(dt, st, w, h) {
    // A. Step 4-Phase Celestial Time auto-flow & passive combat laws
    if (celestialState.autoFlow && !arena.paused) {
      celestialState.timer -= dt;
      if (celestialState.timer <= 0) {
        setCelestialTimePhase(celestialState.idx + 1, true);
      }
    }
    const ph = getCurrentCelestialPhase();
    if (ph.id === "dawn" && game && !arena.paused) {
      game.hp = Math.min(st.maxHp, game.hp + st.maxHp * COMBAT_RULE_PARAMS.celestialPhases.dawn.hpRegenPctPerSec * dt);
      game.mp = Math.min(st.maxMp, (game.mp || 0) + st.maxMp * COMBAT_RULE_PARAMS.celestialPhases.dawn.mpRegenPctPerSec * dt);
    }
    if (ph.id === "star_night" && !arena.paused) {
      // Boss/Demon-King Lunar Night-Fiend (`月华夜煞`) crescent barrage mutation!
      for (const e of arena.enemies) {
        if (e.hp > 0 && e.isBoss) {
          e.lunarBarrageCd = (e.lunarBarrageCd || 2.8) - dt;
          if (e.lunarBarrageCd <= 0 && (e.state === "windup" || e.state === "lunge" || e.state === "chase")) {
            e.lunarBarrageCd = 4.2;
            const baseAng = Math.atan2(arena.player.y - e.y, arena.player.x - e.x);
            [-0.26, 0, 0.26].forEach(off => {
              const a = baseAng + off;
              arena.projectiles.push({
                friendly: false, kind: "crescent", x: e.x, y: e.y - 16,
                vx: Math.cos(a) * 8.6, vy: Math.sin(a) * 8.6, ang: a, r: 22,
                dmg: Math.max(8, Math.round(e.atk * 0.85)), life: 2.2, color: "#b8c8ff"
              });
            });
            addFloat("🌙 月华夜煞 · 弦月裂空！", e.x, e.y - e.r - 32, "#c2d0ff", 15, true);
          }
        }
      }
    }

    // B. Step Primordial Forge Spatial Rift Cracks (`太初裂空剑痕 · 留存3秒持续撕裂`)
    if (!arena.spatialRifts) arena.spatialRifts = [];
    for (let i = arena.spatialRifts.length - 1; i >= 0; i--) {
      const rf = arena.spatialRifts[i];
      rf.life -= dt;
      if (rf.life <= 0) { arena.spatialRifts.splice(i, 1); continue; }
      rf.tickCd -= dt;
      if (rf.tickCd <= 0) {
        rf.tickCd = 0.25;
        const x1 = rf.x - Math.cos(rf.ang) * (rf.len * 0.5), y1 = rf.y - Math.sin(rf.ang) * (rf.len * 0.5);
        const x2 = rf.x + Math.cos(rf.ang) * (rf.len * 0.5), y2 = rf.y + Math.sin(rf.ang) * (rf.len * 0.5);
        arena.enemies.slice().forEach(e => {
          if (e.hp > 0) {
            const seg = pointToSegmentDist(e.x, e.y, x1, y1, x2, y2);
            if (seg.dist <= e.r + 36) {
              rf.sliceHits = (rf.sliceHits || 0) + 1;
              damageEnemy(e, Math.max(6, Math.round(st.atk * 0.62)), false, 8, rf.ang, 1.5, false);
            }
          }
        });
      }
    }

    // C. Step Primordial Alchemy Golden-Armored Pill Acolyte (`金甲丹童护法`)
    if (arena.pillAcolyte && arena.pillAcolyte.active) {
      const ac = arena.pillAcolyte;
      ac.life -= dt;
      if (ac.life <= 0) {
        ac.active = false;
      } else {
        const tx = arena.player.x - arena.player.facing * 64;
        const ty = arena.player.y - 26;
        ac.x += (tx - ac.x) * Math.min(1, dt * 6.5);
        ac.y += (ty - ac.y) * Math.min(1, dt * 6.5);
        ac.facing = arena.player.facing;
        ac.atkCd -= dt;
        if (ac.atkCd <= 0) {
          ac.atkCd = 0.95;
          game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.03));
          const tgt = arena.enemies.find(e => e.hp > 0 && !e.isTreasure);
          if (tgt) {
            const a = Math.atan2(tgt.y - ac.y, tgt.x - ac.x);
            ac.facing = Math.cos(a) >= 0 ? 1 : -1;
            arena.fireZones.push({ x: tgt.x, y: tgt.y, r: 66, life: 2.4, tickCd: 0.15 });
            spawnSparks(tgt.x, tgt.y, 10, a, 3.14, "#ffd166");
            ac.fireCount = (ac.fireCount || 0) + 1;
            damageEnemy(tgt, Math.round(st.atk * 1.58), true, 20, a, 4, false);
            addFloat("👶 金甲丹童 · 三昧丹火轰！", ac.x, ac.y - 46, "#ffd166", 14);
          }
        }
      }
    }

    // D. Step Local 2P Same-Screen Co-Op Partner & Twin-Heart Tether Cutting Web!
    const c2 = ensureCoop2PState();
    if (!c2.active) return;
    c2.slashCd = Math.max(0, (c2.slashCd || 0) - dt);
    c2.rescueCd = Math.max(0, (c2.rescueCd || 0) - dt);
    c2.tetherOverchargeT = Math.max(0, (c2.tetherOverchargeT || 0) - dt);
    c2.bob = (c2.bob || 0) + dt * 9.5;
    for (let i = c2.afterimages.length - 1; i >= 0; i--) {
      c2.afterimages[i].a -= dt * 3.2;
      if (c2.afterimages[i].a <= 0) c2.afterimages.splice(i, 1);
    }

    if (c2.downed) {
      if (Math.hypot(arena.player.x - c2.x, arena.player.y - c2.y) < 135) {
        triggerCoopQiTransferRescue("1p");
      }
      syncV23EpochDock();
      return;
    }

    // 2P Manual Secondary Keyboard (`IJKL` / `ArrowKeys` / `Numpad 8456`)
    let mx2 = 0, my2 = 0;
    if (keysDown["KeyJ"] || keysDown["ArrowLeft"] || keysDown["Numpad4"]) mx2 -= 1;
    if (keysDown["KeyL"] || keysDown["ArrowRight"] || keysDown["Numpad6"]) mx2 += 1;
    if (keysDown["KeyI"] || keysDown["ArrowUp"] || keysDown["Numpad8"]) my2 -= 1;
    if (keysDown["KeyK"] || keysDown["ArrowDown"] || keysDown["Numpad5"]) my2 += 1;

    if (mx2 !== 0 || my2 !== 0) {
      c2.manualIdleT = 0;
      const len2 = Math.hypot(mx2, my2) || 1;
      const pos2 = clampToPlaza(c2.x + (mx2 / len2) * st.speed * 1.08, c2.y + (my2 / len2) * st.speed * 1.08, w, h);
      c2.x = pos2.x; c2.y = pos2.y;
      if (mx2 !== 0) c2.facing = mx2 > 0 ? 1 : -1;
    } else {
      c2.manualIdleT = (c2.manualIdleT || 0) + dt;
      // Smart Semi-Auto Co-Op AI Fallback: position on the opposite flank of nearest enemy so the 1P-2P Sword Tether slices straight through the enemy!
      if (c2.manualIdleT > 0.60) {
        const foe = arena.enemies.find(e => e.hp > 0 && !e.isTreasure);
        let goalX = arena.player.x + 110, goalY = arena.player.y + 28;
        if (foe) {
          const vx = foe.x - arena.player.x, vy = foe.y - arena.player.y;
          const d = Math.hypot(vx, vy) || 1;
          goalX = foe.x + (vx / d) * 105;
          goalY = foe.y + (vy / d) * 68;
          if (Math.hypot(foe.x - c2.x, foe.y - c2.y) < foe.r + 135 && c2.slashCd <= 0) {
            triggerCoop2PAttack(foe.state === "stun");
          }
        }
        const cl = clampToPlaza(goalX, goalY, w, h);
        c2.x += (cl.x - c2.x) * Math.min(1, dt * 4.4);
        c2.y += (cl.y - c2.y) * Math.min(1, dt * 4.4);
        c2.facing = (foe ? foe.x - c2.x : arena.player.x - c2.x) >= 0 ? 1 : -1;
      }
    }

    // Twin-Heart Sword-Tether Cutting Web (`同心剑网 · 灵力切割线`)
    const tetherLen = Math.hypot(c2.x - arena.player.x, c2.y - arena.player.y);
    if (tetherLen >= 28 && tetherLen <= 620) {
      c2.tetherTickCd = (c2.tetherTickCd || 0) - dt;
      if (c2.tetherTickCd <= 0) {
        c2.tetherTickCd = 0.22;
        const over = c2.tetherOverchargeT > 0;
        arena.enemies.slice().forEach(e => {
          if (e.hp > 0) {
            const seg = pointToSegmentDist(e.x, e.y, arena.player.x, arena.player.y - 12, c2.x, c2.y - 12);
            if (seg.dist <= e.r + 28) {
              c2.tetherCutCount = (c2.tetherCutCount || 0) + 1;
              e.burnTimer = Math.max(e.burnTimer || 0, 2.6);
              e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
              arena.bondSynergy = Math.min(100, (arena.bondSynergy || 0) + 3.5);
              spawnSparks(seg.cx, seg.cy, 6, 0, 6.28, over ? "#ffe28a" : "#70ffe6");
              triggerElectroPoolReaction(seg.cx, seg.cy, st.atk * 0.75);
              registerStyleAction("coop_net", 32);
              damageEnemy(e, Math.max(8, Math.round(st.atk * (over ? 1.38 : 0.86))), over, 14, 0, 2, false);
            }
          }
        });
      }
    }
    syncV23EpochDock();
  }

  // 3. Interactive Alchemy & Sword-Forging Minigame (`八卦丹炉·文武控火炼丹 & 天工剑炉·星火落锤锻打`)
  const craftMinigame = {
    open: false,
    mode: "alchemy", // "alchemy" | "forge"
    cursor: 0.18,
    dir: 1,
    speed: 0.92,
    sweetCenter: 0.54,
    sweetHalf: 0.12,
    strikes: 0,
    maxStrikes: 3,
    perfectCount: 0,
    flareT: 0,
    lastJudge: "盯准中央【鸿蒙金芒温区 / 星火靶心】按空格或点击凝练！",
    sparks: []
  };

  function ensurePrimordialCrafts(g) {
    if (!g) return { goldenAcolyte: false, voidSwordRift: false, pillBatches: 0, forgedBlades: 0 };
    const rawPc = (g.primordialCrafts && typeof g.primordialCrafts === "object" && !Array.isArray(g.primordialCrafts)) ? g.primordialCrafts : null;
    const pcHasUnsafeKey = !!(rawPc && (hasOwn(rawPc, "__proto__") || hasOwn(rawPc, "constructor") || hasOwn(rawPc, "prototype")));
    const cleanPc = {
      goldenAcolyte: !!(rawPc && rawPc.goldenAcolyte),
      voidSwordRift: !!(rawPc && rawPc.voidSwordRift),
      pillBatches: Math.max(0, Math.floor(num(rawPc && rawPc.pillBatches, 0))),
      forgedBlades: Math.max(0, Math.floor(num(rawPc && rawPc.forgedBlades, 0)))
    };
    if (!rawPc || Object.getPrototypeOf(rawPc) !== Object.prototype || pcHasUnsafeKey ||
        rawPc.goldenAcolyte !== cleanPc.goldenAcolyte || rawPc.voidSwordRift !== cleanPc.voidSwordRift ||
        rawPc.pillBatches !== cleanPc.pillBatches || rawPc.forgedBlades !== cleanPc.forgedBlades) {
      g.primordialCrafts = cleanPc;
    }
    return g.primordialCrafts;
  }

  function spawnSpatialSwordRift(x, y, ang) {
    if (!game) return false;
    const pc = ensurePrimordialCrafts(game);
    if (!pc.voidSwordRift) return false;
    if (!arena.spatialRifts) arena.spatialRifts = [];
    if (arena.spatialRifts.length >= 5) arena.spatialRifts.shift();
    arena.spatialRifts.push({ x, y, ang, len: 175, life: 3.0, maxLife: 3.0, tickCd: 0.08, sliceHits: 0 });
    registerStyleAction("rift_tear", 48);
    return true;
  }

  function openTaixuCraftMinigameModal(mode = "alchemy") {
    if (!game) return;
    if (!guardEcosystemAccess("bagua_alchemy")) return;
    closeDrawer();
    craftMinigame.open = true;
    craftMinigame.mode = mode === "forge" ? "forge" : "alchemy";
    craftMinigame.strikes = 0;
    craftMinigame.perfectCount = 0;
    craftMinigame.cursor = 0.15;
    craftMinigame.dir = 1;
    craftMinigame.sweetCenter = 0.50;
    craftMinigame.sweetHalf = 0.13;
    craftMinigame.flareT = 0;
    craftMinigame.sparks = [];
    craftMinigame.lastJudge = craftMinigame.mode === "alchemy"
      ? "文武控火：待游标掠过中央【鸿蒙紫金鼎盛温区】点击凝丹或按空格（3次收丹）！"
      : "星火淬剑：待外圈星环收缩重合【金芒星火靶心】点击落锤或按空格（3锤定剑魄）！";
    const pc = ensurePrimordialCrafts(game);
    const permCaps = getPermGrowthCaps(game);
    const pg = ensurePermGrowth(game);

    openModal(`
      <div class="drawer-mural-banner" style="height:84px;">
        <img src="${ART.banner_alchemy}" alt="太虚丹剑微操台" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">太初百工 · 丹雷神成</span>
            <h2 style="font-family:var(--font-serif);font-size:19.5px;color:var(--gold-bright);margin-top:2px;">🔥 太虚控火炼丹 · 天工星火锻剑微操台</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">返回道场 ✕</button>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <div style="display:flex;gap:6px;">
          <button type="button" id="tab-craft-alchemy" class="btn-ghost ${craftMinigame.mode === "alchemy" ? "active-pill" : ""}" data-craft-mode="alchemy">🔥 八卦丹炉 · 文武控火炼丹</button>
          <button type="button" id="tab-craft-forge" class="btn-ghost ${craftMinigame.mode === "forge" ? "active-pill" : ""}" data-craft-mode="forge">🔨 天工剑炉 · 星火落锤锻打</button>
        </div>
        <div style="display:flex;gap:6px;font-size:11px;flex-wrap:wrap;">
          <span class="tag-chip ${pc.goldenAcolyte ? "mythic" : ""}">${pc.goldenAcolyte ? "★ 已铸词缀：金甲丹童护法" : "待炼成：金甲丹童护法"}</span>
          <span class="tag-chip ${pc.voidSwordRift ? "mythic" : ""}">${pc.voidSwordRift ? "★ 已铸词缀：3秒太初裂空剑痕" : "待锻成：3秒太初裂空剑痕"}</span>
        </div>
      </div>

      <div id="craft-perm-cap-row" style="display:flex;gap:6px;flex-wrap:wrap;font-size:10.5px;">
        <span class="tag-chip ${pg.alchemyHp >= permCaps.alchemyHp ? "done" : ""}">丹道气血 ${pg.alchemyHp}/${permCaps.alchemyHp}${pg.alchemyHp >= permCaps.alchemyHp ? " (已达上限)" : ""}</span>
        <span class="tag-chip ${pg.alchemyAtk >= permCaps.alchemyAtk ? "done" : ""}">百工剑攻 ${pg.alchemyAtk}/${permCaps.alchemyAtk}${pg.alchemyAtk >= permCaps.alchemyAtk ? " (已达上限)" : ""}</span>
        <span class="tag-chip ${(game.maxHpBonus >= permCaps.maxHpBonus && game.atkFlatBonus >= permCaps.atkFlatBonus) ? "done" : ""}">本境总加成 血${Math.floor(num(game.maxHpBonus, 0))}/${permCaps.maxHpBonus} · 攻${Math.floor(num(game.atkFlatBonus, 0))}/${permCaps.atkFlatBonus}</span>
      </div>
      ${(() => {
        const lfPrev = previewLifespanImpact(game, 3);
        const cls = lfPrev.willExhaust || lfPrev.after.status === "critical" ? "danger" : lfPrev.crossesAny ? "warn" : "";
        return `<div id="taixu-craft-lifespan-preview" class="lifespan-preview-strip ${cls}">⏳ 本轮消耗 3 月（${lfPrev.before.curYears}→${lfPrev.after.curYears}/${lfPrev.after.maxYears} 载）${lfPrev.warningText ? ` · <b>${escapeHtml(lfPrev.warningText)}</b>` : ""}</div>`;
      })()}

      <div class="craft-stage-wrap">
        <canvas id="craft-minigame-canvas" width="580" height="196"></canvas>
      </div>

      <div class="jade-card" style="padding:9px 12px;gap:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div>
            <strong id="lbl-craft-progress" style="font-size:12.5px;color:#ffe28a;">进度：第 0 / 3 手 · 极品判定 0 次</strong>
            <div id="lbl-craft-judge" style="font-size:11px;color:#80ffea;margin-top:2px;">${craftMinigame.lastJudge}</div>
          </div>
          <div style="display:flex;gap:7px;align-items:center;">
            <button type="button" id="btn-craft-strike" class="btn-gold" style="padding:8px 18px;font-size:13px;white-space:nowrap;" data-action="craft-strike">${craftMinigame.mode === "alchemy" ? "🔥 凝丹控火 (空格)" : "🔨 星火落锤 (空格)"}</button>
          </div>
        </div>
      </div>
    `, true);
    renderCraftMinigameCanvas(0.016);
  }

  function strikeTaixuCraftMinigame(forcePerfect = false) {
    if (!game || !craftMinigame.open) return null;
    if (craftMinigame.strikes >= craftMinigame.maxStrikes) {
      craftMinigame.strikes = 0;
      craftMinigame.perfectCount = 0;
    }
    const dist = forcePerfect ? 0 : Math.abs(craftMinigame.cursor - craftMinigame.sweetCenter);
    const isPerfect = dist <= craftMinigame.sweetHalf;
    const isGreat = !isPerfect && dist <= craftMinigame.sweetHalf * 1.85;
    craftMinigame.strikes += 1;
    if (isPerfect || isGreat) craftMinigame.perfectCount += 1;
    craftMinigame.flareT = 1.0;

    for (let i = 0; i < 22; i++) {
      const a = (Math.PI * 2 * i) / 22 + Math.random() * 0.25;
      const spd = 2.4 + Math.random() * 4.8;
      craftMinigame.sparks.push({ x: 290, y: 98, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.65, col: isPerfect ? "#ffe28a" : "#70ffe6" });
    }

    if (craftMinigame.mode === "alchemy") {
      Sound.bianzhong(isPerfect ? 659.25 : 523.25, 0.12);
      Sound.qiOrb(4);
    } else {
      Sound.clang(isPerfect ? 1.48 : 1.15, 0.15);
      Sound.bianzhong(783.99, 0.10);
    }

    // Shift next sweet-spot slightly for authentic tactile skill!
    craftMinigame.sweetCenter = 0.36 + ((craftMinigame.strikes * 0.17) % 0.30);
    craftMinigame.speed = 0.96 + craftMinigame.strikes * 0.18;

    let climaxTriggered = false;
    const pc = ensurePrimordialCrafts(game);
    if (craftMinigame.strikes >= craftMinigame.maxStrikes) {
      climaxTriggered = craftMinigame.perfectCount >= 2;
      if (craftMinigame.mode === "alchemy") {
        pc.pillBatches += 1;
        const hpRes = grantPermanentStatBonus(game, { hp: climaxTriggered ? 45 : 20, source: "alchemy" });
        const capNote = hpRes.hpCapped
          ? `（本境丹道永久属性已达上限 ${hpRes.pg.alchemyHp}/${hpRes.caps.alchemyHp}，破境后提升上限）`
          : "";
        refillImmortalGourd();
        if (climaxTriggered) {
          pc.goldenAcolyte = true;
          Sound.fanfare();
          arena.skyBolts.push({ x: arena.player.x, y: arena.player.y, t: 0, color: "#ffe28a" });
          craftMinigame.lastJudge = `⚡【极品九色丹雷降世】！气血上限 +${hpRes.grantedHp}${capNote}，仙葫已永久铭刻太初神工词缀【金甲丹童护法】（按 Q 饮酒即召金甲丹童协战 14s）！`;
          showToast(`⚡ 极品丹雷异象！气血上限 +${hpRes.grantedHp}${capNote}，已永久觉醒【金甲丹童护法】！`);
          captureBattleHighlightFrame("九色丹雷", "八卦控火·极品金甲丹童", 45, 3);
        } else {
          craftMinigame.lastJudge = `丹成出炉：气血上限 +${hpRes.grantedHp}${capNote}，仙葫已满酿（达成 ≥2 次鼎盛判定可引动极品丹雷）！`;
        }
      } else {
        pc.forgedBlades += 1;
        const atkRes = grantPermanentStatBonus(game, { atk: climaxTriggered ? 26 : 12, source: "alchemy" });
        const capNote = atkRes.atkCapped
          ? `（本境百工剑攻已达上限 ${atkRes.pg.alchemyAtk}/${atkRes.caps.alchemyAtk}，破境后提升上限）`
          : "";
        if (climaxTriggered) {
          pc.voidSwordRift = true;
          let weaponBoosted = false;
          if (game.equippedGear && game.equippedGear.weapon) {
            game.equippedGear.weapon.rarity = Math.max(4, rarityNum(game.equippedGear.weapon.rarity));
            if (!game.equippedGear.weapon.taixuForged) {
              game.equippedGear.weapon.atk = (game.equippedGear.weapon.atk || 20) + 18;
              game.equippedGear.weapon.taixuForged = true;
              weaponBoosted = true;
            }
            if (!game.equippedGear.weapon.name.startsWith("鸿蒙·")) {
              game.equippedGear.weapon.name = "鸿蒙·" + game.equippedGear.weapon.name.replace(/^[^·]+·/, "");
            }
          }
          Sound.fanfare();
          craftMinigame.lastJudge = `🗡【神工天成·万剑铮鸣】！剑攻 +${atkRes.grantedAtk}${weaponBoosted ? "（本命佩剑首锻 +18 攻）" : ""}${capNote}，神兵已永久锻入【太初裂空剑痕】！`;
          showToast(`🗡 神工天成异象！剑攻 +${atkRes.grantedAtk}${capNote}，已永久锻入【太初裂空剑痕】！`);
          captureBattleHighlightFrame("神工天成", "天工星火·太初裂空剑痕", 26, 3);
        } else {
          craftMinigame.lastJudge = `淬火礼成：攻击力 +${atkRes.grantedAtk}${capNote}（达成 ≥2 次星火靶心判定可锻入太初裂空剑痕）！`;
        }
      }
      const craftAge = advanceLifespanMonths(3, craftMinigame.mode === "alchemy" ? "taixu_alchemy" : "taixu_forge");
      if (craftAge && craftAge.aged > 0 && craftMinigame.lastJudge) {
        craftMinigame.lastJudge += `（耗寿 ${craftAge.aged} 月）`;
      }
      saveGame();
      updateHud();
    } else {
      craftMinigame.lastJudge = isPerfect
        ? `★ 鸿蒙完美判定！炉火鼎盛（已成功 ${craftMinigame.perfectCount}/${craftMinigame.strikes} 手）`
        : isGreat
          ? `✦ 紫霞良佳判定！（已成功 ${craftMinigame.perfectCount}/${craftMinigame.strikes} 手）`
          : `○ 火候略偏，凝神再击！（进度 ${craftMinigame.strikes}/${craftMinigame.maxStrikes}）`;
    }

    const pEl = document.getElementById("lbl-craft-progress");
    const jEl = document.getElementById("lbl-craft-judge");
    const capRow = document.getElementById("craft-perm-cap-row");
    if (pEl) pEl.textContent = `进度：第 ${craftMinigame.strikes} / ${craftMinigame.maxStrikes} 手 · 鼎盛极品 ${craftMinigame.perfectCount} 次`;
    if (jEl) jEl.textContent = craftMinigame.lastJudge;
    if (capRow && game) {
      const capsNow = getPermGrowthCaps(game);
      const pgNow = ensurePermGrowth(game);
      capRow.innerHTML = `
        <span class="tag-chip ${pgNow.alchemyHp >= capsNow.alchemyHp ? "done" : ""}">丹道气血 ${pgNow.alchemyHp}/${capsNow.alchemyHp}${pgNow.alchemyHp >= capsNow.alchemyHp ? " (已达上限)" : ""}</span>
        <span class="tag-chip ${pgNow.alchemyAtk >= capsNow.alchemyAtk ? "done" : ""}">百工剑攻 ${pgNow.alchemyAtk}/${capsNow.alchemyAtk}${pgNow.alchemyAtk >= capsNow.alchemyAtk ? " (已达上限)" : ""}</span>
        <span class="tag-chip ${(game.maxHpBonus >= capsNow.maxHpBonus && game.atkFlatBonus >= capsNow.atkFlatBonus) ? "done" : ""}">本境总加成 血${Math.floor(num(game.maxHpBonus, 0))}/${capsNow.maxHpBonus} · 攻${Math.floor(num(game.atkFlatBonus, 0))}/${capsNow.atkFlatBonus}</span>
      `;
    }
    const lfPrevEl = document.getElementById("taixu-craft-lifespan-preview");
    if (lfPrevEl && game) {
      const lfPrevNow = previewLifespanImpact(game, 3);
      const lfCls = lfPrevNow.willExhaust || lfPrevNow.after.status === "critical" ? "danger" : lfPrevNow.crossesAny ? "warn" : "";
      lfPrevEl.className = `lifespan-preview-strip ${lfCls}`;
      lfPrevEl.innerHTML = `⏳ 本轮消耗 3 月（${lfPrevNow.before.curYears}→${lfPrevNow.after.curYears}/${lfPrevNow.after.maxYears} 载）${lfPrevNow.warningText ? ` · <b>${escapeHtml(lfPrevNow.warningText)}</b>` : ""}`;
    }
    renderCraftMinigameCanvas(0.016);
    return { isPerfect, strikes: craftMinigame.strikes, climaxTriggered, crafts: pc };
  }

  function renderCraftMinigameCanvas(dt) {
    const cv = document.getElementById("craft-minigame-canvas");
    if (!cv) { craftMinigame.open = false; return; }
    const c = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    craftMinigame.cursor += craftMinigame.dir * craftMinigame.speed * dt;
    if (craftMinigame.cursor >= 0.94) { craftMinigame.cursor = 0.94; craftMinigame.dir = -1; }
    if (craftMinigame.cursor <= 0.06) { craftMinigame.cursor = 0.06; craftMinigame.dir = 1; }
    craftMinigame.flareT = Math.max(0, craftMinigame.flareT - dt * 2.4);

    c.clearRect(0, 0, W, H);
    const bgGrad = c.createRadialGradient(W * 0.5, H * 0.45, 16, W * 0.5, H * 0.5, W * 0.6);
    bgGrad.addColorStop(0, craftMinigame.mode === "alchemy" ? "rgba(86, 42, 118, 0.55)" : "rgba(116, 56, 22, 0.58)");
    bgGrad.addColorStop(1, "rgba(6, 15, 22, 0.96)");
    c.fillStyle = bgGrad;
    c.fillRect(0, 0, W, H);

    // Draw bespoke V23 Furnace / Forge Anvil centerpiece
    const spKey = craftMinigame.mode === "alchemy" ? "furnace_taixu_alchemy" : "anvil_tiangong_forge";
    const img = IMG_CACHE[spKey];
    if (img && img.complete) {
      const sz = 128 + craftMinigame.flareT * 18;
      c.save();
      if (craftMinigame.flareT > 0.05) {
        c.shadowColor = "#ffe28a";
        c.shadowBlur = 24 * craftMinigame.flareT;
      }
      c.drawImage(img, 96 - sz * 0.5, H * 0.5 - sz * 0.5, sz, sz);
      c.restore();
    }

    // Interactive Precision Track on right (`x = 185 .. 548`)
    const tx0 = 185, tw = 360, ty = 98;
    c.fillStyle = "rgba(5, 14, 20, 0.92)";
    c.strokeStyle = "rgba(216, 179, 106, 0.55)";
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(tx0, ty - 16, tw, 32, 16);
    c.fill();
    c.stroke();

    // Sweet-spot golden core zone
    const swLeft = tx0 + (craftMinigame.sweetCenter - craftMinigame.sweetHalf) * tw;
    const swW = craftMinigame.sweetHalf * 2 * tw;
    const swGrad = c.createLinearGradient(swLeft, 0, swLeft + swW, 0);
    swGrad.addColorStop(0, "rgba(255, 168, 72, 0.38)");
    swGrad.addColorStop(0.5, "rgba(255, 232, 138, 0.92)");
    swGrad.addColorStop(1, "rgba(255, 168, 72, 0.38)");
    c.fillStyle = swGrad;
    c.fillRect(swLeft, ty - 14, swW, 28);

    c.fillStyle = "#fff5cc";
    c.font = "bold 11.5px sans-serif";
    c.textAlign = "center";
    c.fillText(craftMinigame.mode === "alchemy" ? "★ 鸿蒙鼎盛温区 ★" : "★ 金芒星火靶心 ★", swLeft + swW * 0.5, ty - 24);

    // Moving Wen-Wu Flame / Star-Hammer Cursor
    const cx = tx0 + craftMinigame.cursor * tw;
    c.save();
    c.fillStyle = "#70ffe6";
    c.shadowColor = "#70ffe6";
    c.shadowBlur = 14;
    c.beginPath();
    c.arc(cx, ty, 13, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#ffffff";
    c.beginPath();
    c.arc(cx, ty, 5.5, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // Step & draw molten sparks
    for (let i = craftMinigame.sparks.length - 1; i >= 0; i--) {
      const sp = craftMinigame.sparks[i];
      sp.x += sp.vx; sp.y += sp.vy; sp.life -= dt;
      if (sp.life <= 0) { craftMinigame.sparks.splice(i, 1); continue; }
      c.fillStyle = sp.col;
      c.globalAlpha = Math.max(0, sp.life / 0.65);
      c.beginPath(); c.arc(sp.x, sp.y, 3.2, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }

    c.fillStyle = "#bfe8e0";
    c.font = "12px sans-serif";
    c.textAlign = "left";
    c.fillText(craftMinigame.mode === "alchemy" ? "丹诀：文火养胎，武火凝丹 → 满2次鼎盛引九色丹雷" : "剑诀：千锤百炼，星火入魂 → 满2次靶心开裂空剑痕", tx0, ty + 42);
  }

  // 4. Auto Highlight Frame Capture & 4-Panel Ink-Wash Comic Battle Scroll (`太虚剑意录 · 四格水墨连环画战报`)
  const comicSnapBuf = document.createElement("canvas");
  comicSnapBuf.width = 480;
  comicSnapBuf.height = 270;

  function captureBattleHighlightFrame(sealTag = "剑破苍穹", moveDesc = "太虚剑意·破势一击", dmgVal = 0, priority = 2) {
    try {
      const fxCv = document.getElementById("fx-canvas");
      const bgImg = document.getElementById("stage-bg-img");
      if (!fxCv || !fxCv.width) return false;
      if (!arena.highlightFrames) arena.highlightFrames = [];

      const sctx = comicSnapBuf.getContext("2d");
      sctx.clearRect(0, 0, 480, 270);
      if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        sctx.drawImage(bgImg, 0, 0, 480, 270);
      } else {
        sctx.fillStyle = "#0a1922";
        sctx.fillRect(0, 0, 480, 270);
      }
      const ph = getCurrentCelestialPhase();
      sctx.fillStyle = ph.ambientTint;
      sctx.fillRect(0, 0, 480, 270);
      sctx.drawImage(fxCv, 0, 0, 480, 270);

      const dataUrl = comicSnapBuf.toDataURL("image/jpeg", 0.84);
      const entry = {
        sealTag: safeText(sealTag, "剑影").slice(0, 4),
        moveDesc,
        dmgVal: Math.max(0, Math.round(Number(dmgVal) || 0)),
        priority,
        phaseName: ph.name,
        dataUrl,
        ts: Date.now()
      };

      if (arena.highlightFrames.length < 4) {
        arena.highlightFrames.push(entry);
      } else {
        let minIdx = 0;
        for (let i = 1; i < arena.highlightFrames.length; i++) {
          if (arena.highlightFrames[i].priority <= arena.highlightFrames[minIdx].priority) minIdx = i;
        }
        if (priority >= arena.highlightFrames[minIdx].priority) {
          arena.highlightFrames[minIdx] = entry;
        }
      }
      syncV23EpochDock();
      return true;
    } catch (e) {
      return false;
    }
  }

  function ensureFourComicFrames() {
    if (!arena.highlightFrames) arena.highlightFrames = [];
    const fallbackSpecs = [
      ["起势问剑", "青霜四段连舞 · 御剑破阵", Math.round((getCombatStats(game).atk || 180) * 1.8)],
      ["奇门引火", "八卦阵眼共鸣 · 离火焚天", Math.round((getCombatStats(game).atk || 180) * 2.6)],
      ["双剑同游", "同心剑网交汇 · 灵力切割", Math.round((getCombatStats(game).atk || 180) * 3.4)],
      ["一剑诛仙", "太虚剑神极意 · 破界终结", Math.round((getCombatStats(game).atk || 180) * 5.2)]
    ];
    while (arena.highlightFrames.length < 4) {
      const sp = fallbackSpecs[arena.highlightFrames.length];
      if (!captureBattleHighlightFrame(sp[0], sp[1], sp[2], 1)) break;
    }
  }

  function renderFourPanelComicScrollCanvas() {
    const cv = document.getElementById("comic-scroll-canvas");
    if (!cv || !game) return false;
    ensureFourComicFrames();
    const c = cv.getContext("2d");
    const W = cv.width, H = cv.height;

    // 1. Aged Xuan-Paper Scroll Texture
    const pg = c.createLinearGradient(0, 0, W, H);
    pg.addColorStop(0, "#f5edd9");
    pg.addColorStop(0.5, "#ede1c6");
    pg.addColorStop(1, "#e2d2b2");
    c.fillStyle = pg;
    c.fillRect(0, 0, W, H);

    // Subtle Xuan-paper ink-wash clouds & double scroll border
    c.strokeStyle = "#5c4328";
    c.lineWidth = 4;
    c.strokeRect(14, 14, W - 28, H - 28);
    c.strokeStyle = "#9c7a4c";
    c.lineWidth = 1.5;
    c.strokeRect(22, 22, W - 44, H - 44);

    // 2. Top Calligraphic Header & Red Cinnabar Title Seal
    const ph = getCurrentCelestialPhase();
    const c2 = ensureCoop2PState();
    const partnerTxt = c2.active ? ` · 同游道侣：${PLAYABLE_COMPANIONS[c2.partnerId].name}` : "";
    c.fillStyle = "#241911";
    c.font = "bold 28px 'Noto Serif SC', 'STKaiti', serif";
    c.textAlign = "left";
    c.fillText(`《尘缘问道 · 太虚剑意四格水墨战报》`, 38, 62);

    c.fillStyle = "#5a4634";
    c.font = "bold 14px sans-serif";
    c.fillText(`道号：${game.name || "顾长青"}（${REALMS[game.realm].name}） · 四相天时：${ph.name}${partnerTxt}`, 42, 88);

    // Cinnabar Header Stamp
    c.fillStyle = "#b8251e";
    c.fillRect(W - 168, 34, 126, 44);
    c.strokeStyle = "#f5edd9";
    c.lineWidth = 1.5;
    c.strokeRect(W - 164, 38, 118, 36);
    c.fillStyle = "#fff6eb";
    c.font = "bold 18px serif";
    c.textAlign = "center";
    c.fillText("太初剑录", W - 105, 63);

    // 3. Render 4 Ink-Wash Comic Panels (`2x2` Asymmetric Martial Manga Layout)
    const chapterNumerals = ["壹", "贰", "叁", "肆"];
    const panelRects = [
      { x: 40,  y: 106, w: 508, h: 256 },
      { x: 572, y: 106, w: 508, h: 256 },
      { x: 40,  y: 382, w: 508, h: 256 },
      { x: 572, y: 382, w: 508, h: 256 }
    ];

    const frames = arena.highlightFrames.slice(0, 4);
    frames.forEach((fr, idx) => {
      const r = panelRects[idx];
      // Drop ink shadow
      c.fillStyle = "rgba(32, 22, 14, 0.22)";
      c.fillRect(r.x + 6, r.y + 6, r.w, r.h);

      c.save();
      c.beginPath();
      c.rect(r.x, r.y, r.w, r.h);
      c.clip();

      const im = new Image();
      im.src = fr.dataUrl;
      if (im.complete && im.naturalWidth > 0) {
        c.drawImage(im, r.x, r.y, r.w, r.h);
      } else {
        im.onload = () => {
          const liveCv = document.getElementById("comic-scroll-canvas");
          if (liveCv) renderFourPanelComicScrollCanvas();
        };
        c.fillStyle = "#122630";
        c.fillRect(r.x, r.y, r.w, r.h);
      }

      // Dynamic ink-wash comic speedlines along corners
      c.strokeStyle = "rgba(255, 245, 222, 0.26)";
      c.lineWidth = 1.4;
      for (let s = 0; s < 10; s++) {
        const ang = (s / 10) * Math.PI * 2;
        c.beginPath();
        c.moveTo(r.x + r.w * 0.5 + Math.cos(ang) * 145, r.y + r.h * 0.5 + Math.sin(ang) * 85);
        c.lineTo(r.x + r.w * 0.5 + Math.cos(ang) * 290, r.y + r.h * 0.5 + Math.sin(ang) * 175);
        c.stroke();
      }

      // Bottom ink-scroll caption ribbon inside each panel
      const capGrad = c.createLinearGradient(r.x, r.y + r.h - 58, r.x, r.y + r.h);
      capGrad.addColorStop(0, "rgba(10, 16, 20, 0)");
      capGrad.addColorStop(0.35, "rgba(10, 16, 20, 0.84)");
      capGrad.addColorStop(1, "rgba(10, 16, 20, 0.95)");
      c.fillStyle = capGrad;
      c.fillRect(r.x, r.y + r.h - 58, r.w, 58);

      c.fillStyle = "#ffe89e";
      c.font = "bold 15px serif";
      c.textAlign = "left";
      c.fillText(`【第${chapterNumerals[idx]}格】${fr.moveDesc}`, r.x + 12, r.y + r.h - 28);
      c.fillStyle = "#80ffea";
      c.font = "bold 12.5px sans-serif";
      c.fillText(`天时：${fr.phaseName}${fr.dmgVal > 0 ? ` · 威能批注：${fr.dmgVal.toLocaleString()}` : ""}`, r.x + 14, r.y + r.h - 9);

      // Cinnabar Corner Action Stamp
      c.fillStyle = "rgba(186, 36, 28, 0.94)";
      c.fillRect(r.x + r.w - 92, r.y + 10, 80, 28);
      c.strokeStyle = "#ffe8c2";
      c.lineWidth = 1.2;
      c.strokeRect(r.x + r.w - 89, r.y + 13, 74, 22);
      c.fillStyle = "#fff7eb";
      c.font = "bold 13.5px serif";
      c.textAlign = "center";
      c.fillText(fr.sealTag, r.x + r.w - 52, r.y + 29);
      c.restore();

      // Sumi-Ink Double Panel Frame
      c.strokeStyle = "#1d140e";
      c.lineWidth = 3.2;
      c.strokeRect(r.x, r.y, r.w, r.h);
    });

    // 4. Bottom Poetic Colophon (`水墨题跋`)
    c.fillStyle = "#3b2a1a";
    c.font = "italic bold 14px serif";
    c.textAlign = "center";
    c.fillText(`题跋：仗剑同游九州暮，星河倒悬照丹心 · 累计破敌 ${game.wins || 0} 阵 · 剑道风华最高评级 ${getStyleRankSpec(arena.styleScore || 0).rank}`, W * 0.5, H - 30);
    return true;
  }

  function openComicBattleScrollModal() {
    if (!game) return;
    closeDrawer();
    ensureFourComicFrames();
    openModal(`
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <div>
          <span class="cinnabar-seal">太虚剑意录 · 四格水墨战报</span>
          <h2 style="font-family:var(--font-serif);font-size:19.5px;color:var(--gold-bright);margin-top:2px;">📜 四格水墨连环画高光战报长卷</h2>
        </div>
        <div style="display:flex;gap:7px;align-items:center;">
          <button type="button" id="btn-snap-comic-now" class="btn-jade" style="padding:6px 12px;font-size:11.5px;" data-action="snap-comic-now">📸 抓拍当前战况入卷</button>
          <button type="button" id="btn-export-comic-png" class="btn-gold" style="padding:6px 14px;font-size:12px;" data-action="export-comic-png">💾 导出高清战报 PNG</button>
          <button type="button" class="btn-ghost" data-modal-close="1">返回道场 ✕</button>
        </div>
      </div>
      <div class="comic-scroll-frame">
        <canvas id="comic-scroll-canvas" width="1120" height="686"></canvas>
      </div>
    `, true);
    renderFourPanelComicScrollCanvas();
  }

  function exportComicBattleScrollPng() {
    const cv = document.getElementById("comic-scroll-canvas");
    if (!cv) return null;
    renderFourPanelComicScrollCanvas();
    const url = cv.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `chenyuan-wendao-v23-comic-scroll-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("💾 已导出高清宣纸朱砂【四格水墨连环画战报 PNG】！");
    return url;
  }

  function syncV23EpochDock() {
    if (typeof syncV24GenesisDock === 'function') syncV24GenesisDock();
    if (!game) return;
    const c2 = ensureCoop2PState();
    const coopBtn = document.getElementById("btn-coop-2p");
    const coopImg = document.getElementById("img-coop-2p-ico");
    const coopTit = document.getElementById("lbl-coop-2p-title");
    const coopSub = document.getElementById("lbl-coop-2p-sub");
    if (coopBtn && coopImg && coopTit && coopSub) {
      const sp = PLAYABLE_COMPANIONS[c2.partnerId] || PLAYABLE_COMPANIONS.shen;
      coopImg.src = ART[sp.avatar];
      coopBtn.classList.toggle("active-ep", !!c2.active);
      if (c2.active) {
        const hpPct = Math.max(0, Math.round((c2.hp / Math.max(1, c2.maxHp)) * 100));
        coopTit.textContent = `2P·${sp.name}`;
        coopSub.textContent = c2.downed ? "⚠待渡气救援!" : `剑网中·${hpPct}%`;
      } else {
        coopTit.textContent = "双人同游";
        coopSub.textContent = `召2P·${sp.name}`;
      }
    }

    const ph = getCurrentCelestialPhase();
    const celBtn = document.getElementById("btn-celestial-time");
    const celImg = document.getElementById("img-celestial-ico");
    const celTit = document.getElementById("lbl-celestial-title");
    const celSub = document.getElementById("lbl-celestial-sub");
    if (celBtn && celImg && celTit && celSub) {
      celImg.src = ART.vfx_celestial_time_dial;
      celTit.textContent = ph.name;
      celTit.style.color = ph.color;
      celSub.textContent = ph.sub;
      celBtn.classList.toggle("active-ep", ph.id === "star_night" || ph.id === "blood_dusk");
    }

    const comImg = document.getElementById("img-comic-ico");
    const comCnt = document.getElementById("lbl-comic-count");
    if (comImg) comImg.src = ART.banner_karma_duality;
    if (comCnt) {
      const n = (arena.highlightFrames || []).length;
      comCnt.textContent = `四格抓拍 ${Math.min(4, n)}/4`;
    }
  }
