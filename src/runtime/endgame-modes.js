  // ==================== V17 MYRIAD SWORD GRAVEYARD BOSS RUSH & INNER DEMON MIRROR DUEL ====================
  function openBossRushModal() {
    if (!game) return;
    if (!guardNotInTribulation("万剑冢连战")) return;
    if (!guardEcosystemAccess("sword_tomb_rush")) return;
    closeDrawer();
    const affMult = 1 + arena.rushAffixes.reduce((s, id) => {
      const sp = RUSH_AFFIX_SPECS.find(x => x.id === id);
      return s + (sp ? sp.mult : 0);
    }, 0);
    const trailUnlocked = !!(game.taixuTrailUnlocked || metaState.taixuTrailUnlocked);
    const trailOn = !!game.taixuTrailActive;

    openModal(`
      <div class="drawer-mural-banner" style="height:88px;">
        <img src="${ART.arena_wanjian_tomb}" alt="万剑冢·踏天连战" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">终局巅峰试炼</span>
            <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:4px;">万剑冢 · 踏天七阵连战 & 心魔镜像论剑</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">返回道场 ✕</button>
        </div>
      </div>

      <div class="rush-ladder-strip">
        ${BOSS_RUSH_ROSTER.map(b => `
          <div class="rush-bout-card ${b.isDemon ? "demon-finale" : ""}">
            <img src="${ART[b.art]}" alt="${b.title}" />
            <strong style="font-size:10.5px;color:${b.isDemon ? "#e8c8ff" : "var(--gold-bright)"};">${b.title.split(" · ")[0]}</strong>
            <span style="font-size:10px;color:#bcd8d2;">${b.title.split(" · ")[1]}</span>
          </div>
        `).join("")}
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong style="font-size:12px;color:var(--gold-bright);">☯ 自选【问道劫律】试炼词缀（当前积分倍率 ×${affMult.toFixed(2)}）：</strong>
        <span style="font-size:11px;color:var(--jade);">${metaState.bestRushGrade ? `历史最高评级：${escapeHtml(metaState.bestRushGrade)} (${num(metaState.bestRushTime).toFixed(1)}s)` : "完整通关七阵解锁【太虚劫光】飞剑幻化"}</span>
      </div>

      <div class="rush-affix-grid">
        ${RUSH_AFFIX_SPECS.map(af => {
          const act = arena.rushAffixes.includes(af.id);
          return `<button type="button" class="rush-affix-btn ${act ? "active" : ""}" data-rush-affix="${af.id}">
            <div>
              <strong style="font-size:12px;color:${act ? "#ffd8a8" : "#e6f4f1"};">${act ? "🔥 " : "○ "}${af.name}</strong>
              <div style="font-size:10px;color:#9cc4bc;margin-top:2px;">${af.desc}</div>
            </div>
            <span class="tag-chip ${act ? "mythic" : ""}">+${Math.round(af.mult * 100)}%</span>
          </button>`;
        }).join("")}
      </div>

      <div style="font-size:11px;color:#ffd8a8;background:rgba(46,28,12,0.55);border:1px solid rgba(255,196,102,0.35);border-radius:8px;padding:6px 10px;">
        🎯 规则说明：仅从第一阵完整连战可获奖励、尊号、拖尾幻化并计入评级与最佳纪录；第六/七阵直战为【练习模式】（不发奖励、不计评级与纪录）。
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid var(--border-subtle);padding-top:9px;">
        <div>
          ${trailUnlocked
            ? `<button type="button" class="btn-jade" style="padding:5px 12px;font-size:11.5px;" data-action="toggle-taixu-trail">✨ 太虚劫光飞剑拖尾：${trailOn ? "已佩带" : "已关闭"}</button>`
            : `<span style="font-size:11px;color:var(--text-sub);">🏆 完整通关七阵连战永久解锁虹彩飞剑拖尾【太虚劫光】与【踏天剑尊】尊号</span>`}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn-ghost" style="border-color:#ffe28a;color:#fff3b0;padding:6px 11px;font-size:11.5px;" data-action="open-workshop">🛠 造化论剑码工坊</button>
          <button type="button" class="btn-ghost" style="border-color:#70ffe6;color:#9effec;padding:6px 11px;font-size:11.5px;" data-action="start-sect-defense">🛡 护山大阵·妖潮战</button>
          <button type="button" class="btn-ghost" style="border-color:#d69eff;color:#f0dcff;padding:6px 11px;font-size:11.5px;" data-start-rush="6">⚡ 第六阵：心魔镜像（练习·无奖）</button>
          <button type="button" class="btn-ghost" style="border-color:#ffbe5c;color:#fff0b8;padding:6px 12px;font-size:11.5px;font-weight:700;" data-start-rush="7">🐉 直讨巨神：太古烛龙（练习·无奖）</button>
          <button type="button" class="btn-gold" style="padding:6px 15px;font-size:12px;" data-start-rush="1">🔥 开启七阵封神连战</button>
        </div>
      </div>
    `, true);
  }

  function startBossRushGauntlet(startBout = 1) {
    if (!game) return;
    if (!guardNotInTribulation("万剑冢连战")) return;
    if (!guardEcosystemAccess("sword_tomb_rush")) return;
    restoreCustomSeedTempCurio();
    flushAndEndMeditation();
    const clampedStart = Math.max(1, Math.min(7, Math.floor(num(startBout, 1))));
    const isPractice = clampedStart > 1;
    if (isPractice) beginPracticeModeIsolation();
    else if (practiceFormalSnapshot) endPracticeModeIsolation();
    resetStageTransitionState();
    closeModal();
    closeDrawer();
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;

    const wasSanctum = !!arena.sanctumMode;
    arena.stageEpoch += 1;
    arena.sanctumMode = false;
    if (wasSanctum) resetSanctumDojoCombatGauges();
    else purgeTransientCombatEntities({ clearPlayerBuffs: true });
    arena.towerMode = false;
    arena.dungeonMap = null;
    arena.celestialSpire = null;
    arena.sectDefense = null;
    arena.cloudFlight = null;
    arena.customSeedRun = null;
    arena.waveTransitioning = false;
    resetEncounterTelemetry();
    arena.defeatRevivesUsed = 0;
    arena.defeatPending = null;
    arena.nearbyProp = null;
    renderPropInteractHud();
    arena.bossRush = {
      active: true,
      bout: clampedStart,
      maxBouts: 7,
      elapsed: 0,
      partBreaks: 0,
      parries: 0,
      hitsTaken: 0,
      damageTaken: 0,
      startBout: clampedStart,
      practiceMode: isPractice
    };
    if (isPractice) {
      showToast(`🎯 万剑冢练习模式（自第 ${clampedStart} 阵跳关）：本局不发奖励、不计评级与纪录！`);
    }
    hideDojoControlBar();
    const recapCard = document.getElementById("stage-recap-card");
    if (recapCard) recapCard.classList.remove("open");

    arena.enemies = [];
    arena.projectiles = [];
    arena.drops = [];
    arena.props = [];
    arena.zones = [];
    arena.qimenArray = null;
    arena.qimenCd = 0;
    arena.domain = null;
    arena.activeAllies = [];
    arena.witchTime = 0;
    arena.slashes = [];
    arena.lightnings = [];
    arena.decals = [];
    arena.sparks = [];
    arena.ripples = [];
    arena.shockRings = [];
    arena.bossBeams = [];
    arena.lotusVortexes = [];
    arena.thunderOrbs = [];
    arena.frostPools = [];
    arena.waterPools = [];
    arena.fireZones = [];
    arena.distortionRings = [];
    arena.witchTime = 0;
    arena.bossDomain = null;
    arena.reversedDomainTimer = 0;

    transitionStageScene("arena_wanjian_tomb", "rush");
    const pPos = clampToPlaza(w * 0.34, h * 0.56, w, h);
    arena.player.x = pPos.x; arena.player.y = pPos.y;
    const st = getCombatStats(game);
    game.hp = st.maxHp;
    game.mp = st.maxMp;
    refillImmortalGourd();
    arena.groundSweeps = [];
    arena.player.z = 0; arena.player.vz = 0; arena.player.plunging = false;
    syncFlyingSwords();
    spawnBossRushBout();
  }

  function spawnBossRushBout() {
    if (!arena.bossRush || !arena.bossRush.active || !game) return;
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;
    const spec = BOSS_RUSH_ROSTER[arena.bossRush.bout - 1] || BOSS_RUSH_ROSTER[5];

    arena.props = arena.props.filter(p => p.kind === "ward_pylon");
    spawnStageInteractiveHazards();

    const bx = w * 0.65, by = h * 0.53;
    const rb = getRealmCombatBaseline(game.realm);
    const calSpec = getCalamityCycleSpec(game);
    const pactHp = hasPact(game, "frenzy_hp") ? 1.25 : 1.0;
    const pactPos = hasPact(game, "iron_posture") ? 1.35 : 1.0;
    const boutHpMult = spec.mult || (0.48 + (spec.bout - 1) * 0.09);
    const boutAtkMult = spec.atkMult || (0.76 + (spec.bout - 1) * 0.06);
    const scaledAtk = Math.max(12, Math.round(rb.atk * boutAtkMult * calSpec.atkMult));
    const scaledHeavy = Math.max(20, Math.round(rb.heavy * boutAtkMult * calSpec.atkMult));

    if (spec.isTitan) {
      // Spawn Mythic 7th Finale: Colossal Half-Screen Dharma-Titan 【太古烛龙 · 魔神法相】 with 3 Independently Lockable Body Parts!
      const titanHp = Math.max(4000, Math.round(rb.bossHp * boutHpMult * pactHp * calSpec.hpMult));
      const armHp = Math.max(600, Math.round(titanHp * 0.22));
      const eyeHp = Math.max(800, Math.round(titanHp * 0.28));
      const titanPos = Math.round(260 * pactPos * calSpec.postureMult);
      const tx = w * 0.70, ty = h * 0.45;
      const titan = {
        uid: "zhulong_titan_" + Date.now(),
        id: "zhulong_titan", art: "boss_zhulong_titan",
        name: "太古烛龙 · 魔神法相",
        isBoss: true, isTitan: true, isTreasure: false, enraged: false,
        titanCollapsed: false, climbExecuted: false, laserSweepTimer: 0, laserAng: Math.PI,
        titanParts: {
          left_claw:     { id: "left_claw",     name: "左覆海魔爪",   ox: -126, oy: 48,  r: 56, hp: armHp, maxHp: armHp, broken: false },
          brow_eye:      { id: "brow_eye",      name: "眉心天道竖眼", ox: -4,   oy: -96, r: 48, hp: eyeHp, maxHp: eyeHp, broken: false },
          right_halberd: { id: "right_halberd", name: "右裂天雷戟",   ox: 128,  oy: 34,  r: 56, hp: armHp, maxHp: armHp, broken: false }
        },
        mech: "colossal_titan", wardHp: 0, maxWardHp: 0, mirrorTimer: 0, blinkCd: 99, beamCd: 4.2,
        x: tx, y: ty, vx: 0, vy: 0, kx: 0, ky: 0, sx: 1, sy: 1, facing: -1,
        r: 108, hp: titanHp, maxHp: titanHp,
        posture: titanPos, maxPosture: titanPos,
        partHp: eyeHp, maxPartHp: eyeHp,
        weakpointExposed: true, partSevered: false,
        atk: scaledAtk,
        heavy: scaledHeavy,
        state: "chase", timer: 1.15, windupDur: 1.0,
        aimX: arena.player.x, aimY: arena.player.y, attackType: "slam",
        hitFlash: 0, swordMarks: 0, chillTimer: 0, burnTimer: 0, airborneZ: 0, airborneVz: 0
      };
      arena.lockedTitanPart = "left_claw";
      arena.enemies.push(titan);
      arena.bossDomain = { id: "zhulong_eclipse", name: "烛龙开暝神域", skyTint: "rgba(56, 22, 12, 0.30)", weather: "thunder_storm" };
      Sound.coreSeverBoom();
      Sound.drum(0.32);
      showBossCutIn("boss_zhulong_titan", "法相天地 · 太古烛龙魔神", "击破【左覆海魔爪】与【右裂天雷戟】双臂护甲令巨神瘫痪伏地，触发【御剑登天·踏躯逆鳞斩】贯碎眉心天眼！");
    } else if (spec.isDemon) {
      // Spawn Climactic Boss 6: 【太虚心魔镜像】 (Wields Player's Dual Postures, Orbiting Mirror Swords & Parry Stance!)
      const demonHp = Math.max(3000, Math.round(rb.bossHp * boutHpMult * pactHp * calSpec.hpMult));
      const demonPos = Math.round(220 * pactPos * calSpec.postureMult);
      const pos = clampToPlaza(bx, by, w, h);
      const demon = {
        uid: "inner_demon_" + Date.now(),
        id: "trial_gate", art: "actor_inner_demon",
        name: `太虚心魔 · ${game.name}之影`,
        isBoss: true, isInnerDemon: true, isTreasure: false, enraged: false,
        demonPosture: "qinglian", postureSwapCd: 4.2, demonParryTimer: 0, swordOrbitAng: 0,
        mech: "mirror_demon", wardHp: 0, maxWardHp: 0, mirrorTimer: 0, blinkCd: 3.4, beamCd: 4.0,
        x: pos.x, y: pos.y, vx: 0, vy: 0, kx: 0, ky: 0, sx: 1, sy: 1, facing: -1,
        r: 46, hp: demonHp, maxHp: demonHp,
        posture: demonPos, maxPosture: demonPos,
        partHp: Math.round(demonHp * 0.28), maxPartHp: Math.round(demonHp * 0.28),
        weakpointExposed: true, partSevered: false,
        atk: scaledAtk,
        heavy: scaledHeavy,
        state: "chase", timer: 0.95, windupDur: 0.88,
        aimX: arena.player.x, aimY: arena.player.y, attackType: "charge",
        hitFlash: 0, swordMarks: 0, chillTimer: 0, burnTimer: 0, airborneZ: 0, airborneVz: 0
      };
      arena.enemies.push(demon);
      arena.bossDomain = { id: "inner_demon", name: "太虚心魔剑界", skyTint: "rgba(48, 16, 68, 0.26)", weather: "thunder_storm" };
      Sound.coreSeverBoom();
      showBossCutIn("actor_inner_demon", demon.name, "【宿命同源】实时切换疾剑/巨阙双式并具心魔剑反，以玄重巨阙或易剑斩破之！");
    } else {
      spawnSingleEnemy(spec.id, bx, by, 1.0, true, `万剑冢#${spec.bout} · ${ENEMIES[spec.id].name}`);
      const spawned = arena.enemies[arena.enemies.length - 1];
      if (spawned) {
        const rushHp = Math.max(1600, Math.round(rb.bossHp * boutHpMult * pactHp * calSpec.hpMult));
        spawned.hp = rushHp;
        spawned.maxHp = rushHp;
        spawned.partHp = Math.max(180, Math.round(rushHp * 0.28));
        spawned.maxPartHp = spawned.partHp;
        spawned.atk = scaledAtk;
        spawned.heavy = scaledHeavy;
        spawned.weakpointExposed = true;
      }
      showBossCutIn(spec.art, spec.title, `暴露【${(BOSS_WEAKPOINTS[spec.id] || {}).shortName || "本命妖丹"}】时切 \` 玄重巨阙式碎核破招！`);
    }
    updateHud();
  }

  function stepInnerDemonAI(e, dt, w, h) {
    const p = arena.player;
    e.swordOrbitAng = (e.swordOrbitAng || 0) + dt * (e.demonPosture === "qinglian" ? 5.8 : 2.8);
    if (e.demonParryTimer > 0) e.demonParryTimer = Math.max(0, e.demonParryTimer - dt);

    // Periodic Dual-Posture Switch Slash (`心魔·太虚易剑斩`)!
    e.postureSwapCd = (e.postureSwapCd || 4.0) - dt;
    if (e.postureSwapCd <= 0 && e.state !== "stun") {
      e.postureSwapCd = 4.6;
      e.demonPosture = e.demonPosture === "qinglian" ? "xuanzhong" : "qinglian";
      const isH = e.demonPosture === "xuanzhong";
      Sound.switchStanceChime(isH);
      spawnDistortionRing(e.x, e.y, 150, isH ? "#ffb84d" : "#d69eff");
      addFloat(isH ? "⚠ 心魔易剑 · 【玄重巨阙式】！" : "⚠ 心魔易剑 · 【青莲疾剑式 + 识破架势】！", e.x, e.y - 96, isH ? "#ffd278" : "#e2b8ff", 16, true);
      if (!isH) e.demonParryTimer = 1.35;
      // Launch 4 mirror flying sword projectiles!
      const baseA = Math.atan2(p.y - e.y, p.x - e.x);
      [-0.3, -0.1, 0.1, 0.3].forEach(off => {
        arena.projectiles.push({
          friendly: false, kind: "crescent", x: e.x, y: e.y,
          vx: Math.cos(baseA + off) * (isH ? 8.2 : 10.8), vy: Math.sin(baseA + off) * (isH ? 8.2 : 10.8),
          ang: baseA + off, r: isH ? 46 : 34, dmg: isH ? e.heavy : e.atk, life: 1.4,
          color: isH ? "#ffb84d" : "#d69eff"
        });
      });
    }
  }

  function getTitanPartWorldPos(titan, partKey) {
    const pt = titan && titan.titanParts ? titan.titanParts[partKey] : null;
    if (!pt) return { x: titan.x, y: titan.y };
    const collapseDrop = titan.titanCollapsed ? (partKey === "brow_eye" ? 74 : 26) : 0;
    return { x: titan.x + pt.ox, y: titan.y + pt.oy + collapseDrop };
  }

  function stepColossalTitanAI(e, dt, w, h) {
    if (!e || !e.isTitan) return;
    const p = arena.player;
    // Anchor Colossal Titan majestically in the upper-right chasm with gentle breathing sway
    const homeX = w * 0.70 + Math.sin(performance.now() * 0.0012) * 22;
    const homeY = h * (e.titanCollapsed ? 0.51 : 0.45) + Math.cos(performance.now() * 0.0016) * 12;
    e.x += (homeX - e.x) * Math.min(1, dt * 3.0);
    e.y += (homeY - e.y) * Math.min(1, dt * 3.0);
    e.kx = 0; e.ky = 0;

    if (e.titanCollapsed) {
      e.sx += (1.08 - e.sx) * 0.18;
      e.sy += (0.82 - e.sy) * 0.18;
      return;
    }

    // Sweeping Forehead Eye Primordial Laser (`眉心天道竖眼 · 灭世神光横扫`)
    if ((e.laserSweepTimer || 0) > 0) {
      e.laserSweepTimer = Math.max(0, e.laserSweepTimer - dt);
      e.laserAng += dt * 1.18;
      const eyePos = getTitanPartWorldPos(e, "brow_eye");
      const endX = eyePos.x + Math.cos(e.laserAng) * 760;
      const endY = eyePos.y + Math.sin(e.laserAng) * 520;
      // Point-to-segment distance check against player
      const vx = endX - eyePos.x, vy = endY - eyePos.y;
      const tProj = Math.max(0, Math.min(1, ((p.x - eyePos.x) * vx + (p.y - eyePos.y) * vy) / (vx * vx + vy * vy || 1)));
      const cx = eyePos.x + vx * tProj, cy = eyePos.y + vy * tProj;
      if (Math.hypot(p.x - cx, p.y - cy) < 28 && p.invuln <= 0 && (p.z || 0) < 28) {
        hurtPlayer(Math.round(e.heavy * 0.65), { sourceName: e.name || "太古烛龙", moveName: "天道竖眼射线", isHeavy: true });
      }
      if (Math.random() < dt * 14) addDecal(cx, cy, e.laserAng, 28, "scorch");
      return;
    }

    e.beamCd = (e.beamCd || 4.2) - dt;
    if (e.beamCd <= 0 && e.state !== "stun") {
      const hasLeft = !e.titanParts.left_claw.broken;
      const hasRight = !e.titanParts.right_halberd.broken;
      e.beamCd = 4.4;
      const roll = (e.atkSeq = (e.atkSeq || 0) + 1) % 3;
      if (roll === 0 && !e.titanParts.brow_eye.broken) {
        e.laserSweepTimer = 1.65;
        e.laserAng = Math.atan2(p.y - (e.y - 90), p.x - e.x) - 0.72;
        Sound.perilousGong();
        addFloat("👁【危】眉心天道竖眼 · 灭世神光横扫！闪避或御空跃避！", e.x - 40, e.y - 142, "#ff6b6b", 17.5, true);
      } else if (roll === 1 && hasLeft) {
        const cPos = getTitanPartWorldPos(e, "left_claw");
        Sound.drum(0.32);
        arena.shake = Math.max(arena.shake, 14);
        addDecal(cPos.x - 60, cPos.y + 18, 0, 86, "spider_crack");
        arena.groundSweeps.push({
          x: cPos.x - 40, y: cPos.y + 16, r: 28, maxR: 360, spd: 195,
          dmg: Math.max(14, Math.round(e.heavy * 0.9)), hitPlayer: false, vaulted: false, owner: e
        });
        addFloat("🦾【下段危】左覆海魔爪拍击 · 按 Z 御风踏剑破势！", cPos.x, cPos.y - 48, "#38f9d7", 16.5, true);
      } else if (hasRight) {
        const hPos = getTitanPartWorldPos(e, "right_halberd");
        Sound.thunderCrack();
        for (let k = 0; k < 4; k++) {
          const bx = p.x + (k - 1.5) * 78, by = p.y + ((k % 2) - 0.5) * 56;
          arena.skyBolts.push({ x: bx, y: by, t: 0, color: "#d69eff" });
          triggerElectroPoolReaction(bx, by, e.atk);
        }
        addFloat("⚡ 右裂天雷戟 · 九霄神雷落阵！", hPos.x - 30, hPos.y - 48, "#e2b8ff", 16.5, true);
      }
    }
  }

  function applyTitanPartDamage(titan, rawPartDmg, hitX, hitY) {
    if (!titan || !titan.isTitan || !titan.titanParts) return;
    const parts = titan.titanParts;
    // Choose locked part if unbroken, else nearest unbroken arm, else brow_eye
    let targetKey = arena.lockedTitanPart;
    if (!targetKey || !parts[targetKey] || (parts[targetKey].broken && (!parts.left_claw.broken || !parts.right_halberd.broken))) {
      let bestD = 999999;
      ["left_claw", "right_halberd", "brow_eye"].forEach(k => {
        const pt = parts[k];
        if (pt.broken && k !== "brow_eye") return;
        const wp = getTitanPartWorldPos(titan, k);
        const d = Math.hypot((hitX || arena.player.x) - wp.x, (hitY || arena.player.y) - wp.y);
        if (d < bestD) { bestD = d; targetKey = k; }
      });
    }
    const pt = parts[targetKey || "brow_eye"];
    if (!pt || pt.broken) return;
    const spearBonus = (game && game.weaponForm === "spear") ? 1.65 : (arena.weaponPosture === "xuanzhong" ? 1.45 : 1.0);
    pt.hp = Math.max(0, pt.hp - Math.round(rawPartDmg * spearBonus));
    titan.partHp = parts.brow_eye.hp;
    titan.maxPartHp = parts.brow_eye.maxHp;

    if (pt.hp <= 0 && !pt.broken) {
      pt.broken = true;
      if (arena.bossRush) arena.bossRush.partBreaks = (arena.bossRush.partBreaks || 0) + 1;
      Sound.coreSeverBoom();
      GamepadSystem.rumble(0.85, 0.78, 210);
      const wp = getTitanPartWorldPos(titan, pt.id);
      triggerImpactFrame(3, "#ffd166", wp.x, wp.y);
      spawnDistortionRing(wp.x, wp.y, 230, "#ffe28a");
      if (!isPracticeModeActive()) spawnDrop("sacred_core", wp.x, wp.y, 1);
      addFloat(`💥 巨神部位击破 · 【${pt.name}】崩解！！`, wp.x, wp.y - 36, "#fff2b2", 21, true);

      if (parts.left_claw.broken && parts.right_halberd.broken && !titan.titanCollapsed) {
        titan.titanCollapsed = true;
        titan.climbExecuted = false;
        titan.laserSweepTimer = 0;
        titan.state = "stun";
        titan.timer = 7.5;
        arena.shake = Math.max(arena.shake, 18);
        Sound.fanfare();
        showToast("🐉 双臂尽断 · 太古烛龙瘫痪伏地！速按 F / 左键 或点击顶部金钮施展【御剑登天·踏躯逆鳞斩】！");
        addFloat("⚡ 巨神瘫痪伏地！眉心竖眼暴露 · 速触发【踏躯逆鳞斩】！", titan.x - 40, titan.y - 60, "#70ffe6", 20, true);
      } else {
        // Auto-advance lock to the remaining unbroken arm or brow_eye!
        arena.lockedTitanPart = !parts.left_claw.broken ? "left_claw" : !parts.right_halberd.broken ? "right_halberd" : "brow_eye";
      }
    }
  }

  function triggerTitanClimbFinisher(titan) {
    if (!game || !titan || !titan.isTitan || titan.climbExecuted || titan.climbInProgress) return false;
    titan.climbInProgress = true;
    const p = arena.player;
    const st = getCombatStats(game);
    p.invuln = 1.65;
    arena.ultCineTimer = 1.35;
    const lbt = document.getElementById("cinema-letterbox-top"), lbb = document.getElementById("cinema-letterbox-bot");
    if (lbt) lbt.classList.add("open"); if (lbb) lbb.classList.add("open");
    Sound.soulManifestRoar();
    Sound.fanfare();
    GamepadSystem.rumble(0.95, 0.90, 320);
    registerStyleAction("titan_climb", 240);
    pushTelemetryInput("🐉御剑登躯·逆鳞斩!", false);

    const clawPos = getTitanPartWorldPos(titan, "left_claw");
    const eyePos = getTitanPartWorldPos(titan, "brow_eye");
    arena.titanClimbCine = {
      t: 0,
      dur: 0.95,
      titan,
      startX: p.x, startY: p.y,
      clawX: clawPos.x, clawY: clawPos.y,
      shoulderX: titan.x - 54, shoulderY: titan.y - 36,
      eyeX: eyePos.x, eyeY: eyePos.y,
      struck: false
    };
    addFloat("🐉 御剑登天 · 踏臂疾驰直取眉心竖眼！！", p.x, p.y - 64, "#ffe89e", 21, true);
    return true;
  }

  function stepTitanClimbCinematic(dt) {
    const tc = arena.titanClimbCine;
    if (!tc) return false;
    tc.t += dt / tc.dur;
    const p = arena.player;
    const u = Math.min(1, tc.t);
    if (u < 0.38) {
      const k = u / 0.38;
      p.x = tc.startX + (tc.clawX - tc.startX) * k;
      p.y = tc.startY + (tc.clawY - tc.startY) * k;
      p.z = Math.sin(k * Math.PI * 0.5) * 34;
      p.facing = 1;
      arena.camZoom = 1.12 + k * 0.06;
      arena.camFocusX = p.x; arena.camFocusY = p.y; arena.camFocusT = 0.25;
      if (Math.random() < 0.65) p.afterimages.push({ x: p.x, y: p.y, facing: 1, a: 0.85 });
    } else if (u < 0.76) {
      const k = (u - 0.38) / 0.38;
      p.x = tc.clawX + (tc.eyeX - 18 - tc.clawX) * k;
      p.y = tc.clawY + (tc.eyeY - tc.clawY) * k;
      p.z = 34 + Math.sin(k * Math.PI) * 86;
      p.facing = 1;
      arena.camZoom = 1.18 + k * 0.08;
      arena.camFocusX = tc.eyeX; arena.camFocusY = tc.eyeY; arena.camFocusT = 0.25;
      if (Math.random() < 0.75) p.afterimages.push({ x: p.x, y: p.y - p.z * 0.4, facing: 1, a: 0.92 });
    } else {
      p.x = tc.eyeX - 24;
      p.y = tc.eyeY + 22;
      p.z = Math.max(0, (1 - (u - 0.76) / 0.24) * 52);
      if (!tc.struck) {
        tc.struck = true;
        const st = getCombatStats(game);
        const burst = Math.min(Math.round(tc.titan.maxHp * 0.58), Math.max(Math.round(tc.titan.maxHp * 0.44), Math.round(st.atk * 16)));
        tc.titan.titanCollapsed = false;
        tc.titan.titanParts.brow_eye.hp = 0;
        tc.titan.titanParts.brow_eye.broken = true;
        const eyeEl = document.getElementById("titan-pct-eye"); if (eyeEl) eyeEl.textContent = "已破";
        const eyeBar = document.getElementById("titan-bar-eye"); if (eyeBar) eyeBar.style.width = "0%";
        triggerImpactFrame(4, "#e62e2d", tc.eyeX, tc.eyeY);
        arena.meteorBursts.push({ x: tc.eyeX, y: tc.eyeY + 12, r: 240, t: 0 });
        spawnDistortionRing(tc.eyeX, tc.eyeY, 310, "#ffe28a");
        for (let q = 0; q < 8; q++) {
          pushBladeArc(tc.eyeX, tc.eyeY, (q * Math.PI) / 4, 185, q % 2 === 0 ? "#ffe28a" : "#70ffe6", q % 2 === 0 ? 1 : -1, true);
        }
        triggerRadialChromaticBurst(1.5, "#ffe28a", tc.eyeX, tc.eyeY);
        triggerKillCamStamp("踏躯逆鳞斩");
        Sound.coreSeverBoom();
        Sound.thunderCrack();
        arena.shake = 24;
        tc.titan.hp = Math.max(Math.round(tc.titan.maxHp * 0.06), tc.titan.hp - burst);
        recordDamageTelemetry(burst, "deflect_ult");
        addFloat(`🐉 踏躯逆鳞斩 · 破界贯眼 -${burst}！！`, tc.eyeX, tc.eyeY - 46, "#fff3b0", 26, true);
        captureBattleHighlightFrame("踏躯逆鳞", "御剑登天·踏躯逆鳞贯眼斩", burst, 5);
        if (tc.titan.hp <= 0) handleEnemyDeath(tc.titan, -Math.PI / 2);
      }
    }
    if (tc.t >= 1) {
      tc.titan.climbInProgress = false;
      tc.titan.climbExecuted = true;
      arena.titanClimbCine = null;
      p.z = 0;
      const lbt = document.getElementById("cinema-letterbox-top"), lbb = document.getElementById("cinema-letterbox-bot");
      if (lbt) lbt.classList.remove("open"); if (lbb) lbb.classList.remove("open");
      updateHud();
    }
    return true;
  }

  // ==================== PILLAR 2: TAG-TEAM PLAYABLE COMPANION SWITCH (`V键 · 太虚同心瞬切`) & WEAPON ARSENAL TRIO ====================
  function getUnlockedPlayableRoster(g) {
    const list = ["player", "shen"];
    if (g && (g.aids.pei || rankOf(g.realm) >= 1 || Object.keys(g.choices || {}).some(k => k.startsWith("pei")))) list.push("pei");
    if (g && (g.aids.lu  || rankOf(g.realm) >= 2 || Object.keys(g.choices || {}).some(k => k.startsWith("lu"))))  list.push("lu");
    if (g && (g.aids.yan || rankOf(g.realm) >= 2 || Object.keys(g.choices || {}).some(k => k.startsWith("yan")))) list.push("yan");
    return list;
  }

  function getActivePlayableSpec() {
    const cur = (arena && arena.playableCharId) || "player";
    return PLAYABLE_COMPANIONS[cur] || PLAYABLE_COMPANIONS.player;
  }

  function syncTagTeamHud() {
    const wrap = document.getElementById("tag-roster-icons");
    const arsBtn = document.getElementById("btn-cycle-arsenal");
    const bondBtn = document.getElementById("btn-dual-bond-ult");
    if (bondBtn && game) {
      const bPct = Math.floor(arena.bondSynergy || 0);
      bondBtn.classList.toggle("ready", bPct >= 100);
      bondBtn.textContent = bPct >= 100 ? "💞合璧!" : `💞${bPct}%`;
      bondBtn.style.display = "inline-flex";
    }
    if (arsBtn && game) {
      const wf = hasOwn(WEAPON_ARSENAL_SPECS, game.weaponForm) ? WEAPON_ARSENAL_SPECS[game.weaponForm] : WEAPON_ARSENAL_SPECS.sword;
      arsBtn.textContent = wf.short;
    }
    if (!wrap || !game) return;
    const roster = getUnlockedPlayableRoster(game);
    const curId = arena.playableCharId || "player";
    const sig = roster.join(",") + "|" + curId;
    if (wrap.getAttribute("data-sig") === sig) return;
    wrap.setAttribute("data-sig", sig);
    wrap.innerHTML = roster.map(cid => {
      const sp = PLAYABLE_COMPANIONS[cid];
      return `<img src="${ART[sp.avatar]}" alt="${sp.name}" class="tag-avatar-mini ${cid === curId ? "active" : ""}" data-switch-char="${cid}" data-tip="${escTip(`${sp.name} · ${sp.title}`, `点击或按 V 键无缝切换操控【${sp.name}】并释放入场连携技【${sp.tagMove}】！`)}" />`;
    }).join("");
  }

  function triggerTagTeamSwitch(forcedCharId = null) {
    if (!game) return false;
    if (!guardEcosystemAccess("tag_team")) return false;
    if ((arena.tagSwitchCd || 0) > 0) {
      showToast(`同心换人调息中 (${arena.tagSwitchCd.toFixed(1)}s)`);
      return false;
    }
    const roster = getUnlockedPlayableRoster(game);
    if (roster.length < 2) return false;
    const prevId = arena.playableCharId || "player";
    const prevSpec = PLAYABLE_COMPANIONS[prevId] || PLAYABLE_COMPANIONS.player;
    let nextId = forcedCharId;
    if (!nextId || !roster.includes(nextId) || nextId === prevId) {
      const idx = roster.indexOf(prevId);
      nextId = roster[(idx + 1) % roster.length];
    }
    const nextSpec = PLAYABLE_COMPANIONS[nextId];
    arena.playableCharId = nextId;
    arena.tagSwitchCd = 1.35;

    const p = arena.player;
    const st = getCombatStats(game);
    // Cancel any recovery, hitstop, or crowd-control (`受控/残血紧急换人救场`)!
    arena.hitStop = 0;
    p.slashCd = 0;
    p.dashTimer = 0;
    if (p.meditating) toggleMeditation(false);
    p.invuln = Math.max(p.invuln || 0, 0.72);
    const emergency = game.hp < st.maxHp * 0.50;
    if (emergency || nextId === "lu" || nextId === "shen") {
      const shGain = Math.round(st.maxHp * (emergency ? 0.28 : 0.16));
      p.shieldHp = Math.min(Math.round(st.maxHp * 0.6), (p.shieldHp || 0) + shGain);
      if (nextId === "shen") game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.14));
    }

    // Leave outgoing character behind as an active phantom ally for 2.6s!
    arena.activeAllies = (arena.activeAllies || []).filter(a => a.id !== nextId);
    arena.activeAllies.push({
      id: prevId, name: prevSpec.name, art: prevSpec.sprite, color: prevSpec.color,
      style: prevId === "shen" ? "heal_frost" : prevId === "pei" ? "sword_burst" : "thunder_ward",
      x: p.x - p.facing * 42, y: p.y + 12, facing: p.facing, life: 2.8, maxLife: 2.8, atkCd: 0.15
    });

    // Snap near closest enemy & unleash Tag-In Assist Strike (`换人入场连携技`)!
    const nearE = arena.enemies.find(e => e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 310);
    if (nearE) {
      const ang = Math.atan2(nearE.y - p.y, nearE.x - p.x);
      arena.blinkStreaks.push({ x1: p.x, y1: p.y - 16, x2: nearE.x - Math.cos(ang) * 58, y2: nearE.y - Math.sin(ang) * 34, t: 0, color: nextSpec.color });
      const tp = clampToPlaza(nearE.x - Math.cos(ang) * 58, nearE.y - Math.sin(ang) * 34, 1440, 900);
      p.x = tp.x; p.y = tp.y;
      p.facing = Math.cos(ang) >= 0 ? 1 : -1;
    }

    Sound.switchStanceChime(true);
    Sound.fanfare();
    GamepadSystem.rumble(0.62, 0.48, 125);
    spawnDistortionRing(p.x, p.y, 175, nextSpec.color);
    pushBladeArc(p.x + p.facing * 26, p.y - 10, p.facing > 0 ? 0 : Math.PI, 138, nextSpec.color, 1, true);
    pushBladeArc(p.x + p.facing * 26, p.y - 10, p.facing > 0 ? 0.35 : Math.PI - 0.35, 118, "#ffe28a", -1, false);
    registerStyleAction("tag_switch", 95);
    pushTelemetryInput(`🤝瞬切·${nextSpec.name}`, false);

    arena.enemies.slice().forEach(e => {
      if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 225) {
        e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
        if (nextId === "lu") arena.skyBolts.push({ x: e.x, y: e.y, t: 0, color: "#ffe28a" });
        damageEnemy(e, Math.round(st.atk * 2.15 * nextSpec.atkMult), true, nextId === "pei" ? 42 : 26, Math.atan2(e.y - p.y, e.x - p.x), 8, true);
      }
    });

    arena.bondSynergy = Math.min(100, (arena.bondSynergy || 0) + (getCurioStacks(game, "curio_bond_surge") > 0 ? 60 : 35));
    // Spire Curio 2 (`万妖同心印`): Tag-Team Switch automatically casts equipped Boss Soul Avatar with zero cooldown!
    if (getCurioStacks(game, "curio_tag_soul") > 0) {
      const prevSoulCd = arena.soulCd || 0;
      arena.soulCd = 0;
      castSoulSpiritSkill();
      arena.soulCd = Math.min(prevSoulCd, 1.5);
    }
    addFloat(`${emergency ? "🛡 紧急救场 · " : "🤝 同心瞬切 · "}【${nextSpec.name}·${nextSpec.tagMove}】！`, p.x, p.y - 62, nextSpec.color, 19, true);
    syncTagTeamHud();
    updateHud();
    return true;
  }

  function cycleWeaponArsenalForm(targetForm = null) {
    if (!game) return;
    if (!guardActionRealm("weapon_form")) return;
    notifyUnlockCardTried("weapon_form");
    const order = ["sword", "spear", "chakram"];
    const cur = hasOwn(WEAPON_ARSENAL_SPECS, game.weaponForm) ? game.weaponForm : "sword";
    game.weaponForm = (targetForm && hasOwn(WEAPON_ARSENAL_SPECS, targetForm)) ? targetForm : order[(order.indexOf(cur) + 1) % order.length];
    const spec = WEAPON_ARSENAL_SPECS[game.weaponForm];
    Sound.switchStanceChime(game.weaponForm === "spear");
    spawnDistortionRing(arena.player.x, arena.player.y, 128, game.weaponForm === "spear" ? "#ffd166" : game.weaponForm === "chakram" ? "#d69eff" : "#70ffe6");
    addFloat(`⚔ 剑匣化形 · 【${spec.name}】！`, arena.player.x, arena.player.y - 54, "#ffe89e", 18, true);
    syncTagTeamHud();
    syncV22TacticalDock();
    saveGame();
    updateHud();
    if (drawerOpen) renderDrawerContent();
  }

  // ==================== PILLAR 3: SWORD-GLIDE RAVINE ZIPLINE & SANCTUM SECT DEFENSE SIEGE (`护山大阵·百鬼夜行`) ====================
  function triggerSwordGlideRavineDash(anchorProp = null) {
    if (!game || arena.ravineGlide) return false;
    const cv = document.getElementById("fx-canvas");
    const w = (cv && cv.width) || 1440, h = (cv && cv.height) || 900;
    const p = arena.player;
    const goRight = p.x < w * 0.52;
    const dest = clampToPlaza(goRight ? w * 0.72 : w * 0.28, goRight ? h * 0.44 : h * 0.60, w, h);
    arena.ravineGlide = {
      t: 0,
      dur: 0.78,
      x0: p.x, y0: p.y,
      cx: (p.x + dest.x) * 0.5, cy: Math.min(p.y, dest.y) - 115,
      x1: dest.x, y1: dest.y,
      slashTick: 0
    };
    p.invuln = 0.95;
    Sound.spatialSwordHum(dest.x); Sound.skyLeapWhoosh();
    Sound.fanfare();
    addFloat("🗡 御剑流光索道 · 凌虚渡渊！！", p.x, p.y - 58, "#80ffea", 19, true);
    return true;
  }

  function stepRavineGlide(dt) {
    const rg = arena.ravineGlide;
    if (!rg) return false;
    rg.t += dt / rg.dur;
    const u = Math.min(1, rg.t);
    const inv = 1 - u;
    const p = arena.player;
    const nx = inv * inv * rg.x0 + 2 * inv * u * rg.cx + u * u * rg.x1;
    const ny = inv * inv * rg.y0 + 2 * inv * u * rg.cy + u * u * rg.y1;
    p.facing = nx >= p.x ? 1 : -1;
    p.x = nx; p.y = ny;
    p.z = Math.sin(u * Math.PI) * 84;
    if (Math.random() < 0.8) p.afterimages.push({ x: p.x, y: p.y - p.z * 0.4, facing: p.facing, a: 0.88 });
    rg.slashTick -= dt;
    if (rg.slashTick <= 0) {
      rg.slashTick = 0.16;
      const st = getCombatStats(game);
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 185) {
          arena.lightnings.push({ x1: p.x, y1: p.y - p.z, x2: e.x, y2: e.y, t: 0, color: "#70ffe6" });
          damageEnemy(e, Math.round(st.atk * 1.25), false, 16, 0, 4, true);
        }
      });
    }
    if (rg.t >= 1) {
      arena.ravineGlide = null;
      p.z = 0;
      p.ravineBuffTimer = 6.0;
      Sound.airLandWhoosh(); Sound.drum(0.22);
      spawnDistortionRing(p.x, p.y, 175, "#70ffe6");
      addRipple(p.x, p.y + 24, 130, "#ffe28a");
      addFloat("✨ 渡渊落地 · 剑威暴涨 +25% (6s)！", p.x, p.y - 52, "#ffe89e", 17, true);
    }
    return true;
  }

  function startSectDefenseSiege() {
    if (!game) return;
    if (!guardNotInTribulation("护山大阵守卫战")) return;
    if (!guardEcosystemAccess("sect_defense")) return;
    restoreCustomSeedTempCurio();
    flushAndEndMeditation();
    if (practiceFormalSnapshot) endPracticeModeIsolation();
    resetStageTransitionState();
    closeModal();
    closeDrawer();
    const cv = document.getElementById("fx-canvas");
    const w = (cv && cv.width) || 1440, h = (cv && cv.height) || 900;
    enterSanctumHub();
    resetEncounterTelemetry();
    // Convert Sanctum into High-Stakes 3-Wave Night-Parade Defense Siege!
    arena.enemies = [];
    arena.props = arena.props.filter(pr => !pr.isDojoProp && !pr.isDummy && pr.kind !== "ward_pylon" && pr.kind !== "frost_crystal");
    arena.waterPools = [];
    arena.fireZones = [];
    resetSanctumDojoCombatGauges();
    hideDojoControlBar();

    const sb = getSanctumBonuses(game);
    const corePos = clampToPlaza(w * 0.50, h * 0.52, w, h);
    const tLeft = clampToPlaza(w * 0.38, h * 0.48, w, h);
    const tRight = clampToPlaza(w * 0.62, h * 0.48, w, h);
    const tNorth = clampToPlaza(w * 0.50, h * 0.36, w, h);
    const maxCoreHp = 1200 + sb.coreHpBonus;
    const towers = [
      { x: tLeft.x,  y: tLeft.y,  cd: 0.35, name: "西护山剑塔" },
      { x: tRight.x, y: tRight.y, cd: 0.65, name: "东护山剑塔" }
    ];
    if (sb.hasThirdTower) {
      towers.push({ x: tNorth.x, y: tNorth.y, cd: 0.50, name: "北护山剑塔" });
    }
    arena.sectDefense = {
      active: true,
      wave: 1,
      maxWaves: 3,
      coreHp: maxCoreHp,
      maxCoreHp,
      coreX: corePos.x,
      coreY: corePos.y,
      towers
    };
    arena.props.push({
      id: "sect_core_pylon", kind: "sect_core", art: "prop_guardian_sword_pylon",
      name: `听雨灵脉大阵中枢 · Lv.${getSanctumLevel(game, "guard_array")}`, badge: "守护灵脉免遭三波百鬼夜行攻破！",
      x: corePos.x, y: corePos.y, r: 46, progress: 0
    });
    // Summon companions automatically for free to defend the sect together!
    arena.player.allyCd = 0;
    const prevMp = game.mp;
    game.mp = Math.max(game.mp || 0, 24);
    summonAllyCoop();
    game.mp = prevMp;
    arena.player.allyCd = 0;
    spawnSectDefenseWave(1);
    showBossCutIn("prop_guardian_sword_pylon", "护山大阵 · 百鬼夜行守卫战", `协同 ${towers.length} 座【护山剑阵灵塔】与道侣抵御三波立体妖潮，赢取鸿蒙星魄与护宗功勋！`);
    updateBossBannerAndRecallOrb();
    updateHud();
  }

  function openSectDefenseResultModal(summary) {
    if (!game || !summary) return;
    const isWin = !!summary.victory;
    const corePct = summary.maxCoreHp > 0 ? Math.max(0, Math.round((summary.coreHp / summary.maxCoreHp) * 100)) : 0;
    openModal(`
      <div class="drawer-mural-banner" style="height:88px;">
        <img src="${ART.arena_sanctum_hub}" alt="护山大阵战报" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">${isWin ? "护宗大捷" : "结界重整"}</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:${isWin ? "var(--gold-bright)" : "#ffb4ae"};margin-top:3px;">${isWin ? "🛡 护山大阵守卫战 · 三波妖潮全歼！" : "⚠ 护山灵脉受创 · 洞府结界已重整"}</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">返回洞府 ✕</button>
        </div>
      </div>
      <div class="jade-card" style="gap:6px;padding:10px 12px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11.5px;">
          <span class="tag-chip ${isWin ? "mythic" : ""}">抵御波次：${summary.wavesCleared}/${summary.maxWaves}</span>
          <span class="tag-chip done">灵脉余量：${Math.max(0, Math.round(summary.coreHp))}/${Math.round(summary.maxCoreHp)} (${corePct}%)</span>
          ${isWin ? `<span class="tag-chip mythic">护宗功勋：×${num(game.sectMerits, 1)}</span>` : ""}
        </div>
        <div style="font-size:12px;color:#dff7f2;line-height:1.55;">
          ${isWin
            ? `已获赐 <b>鸿蒙星魄 +${summary.starPtsGained}</b>、<b>灵石 +${summary.stonesGained}</b>${summary.atkGranted > 0 ? `、<b>永久剑攻 +${summary.atkGranted}</b>` : "（本境永久剑攻已达上限）"}，并点亮【诸天道果共鸣 · 护山大阵】柱！`
            : "灵脉受损后听雨洞府已自动恢复安全休整状态，可升级【护山大阵】增筑北护山剑塔或整备丹药神兵后再战！"}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
        <button type="button" class="btn-jade" data-action="start-sect-defense">🛡 再启护山守卫战</button>
        <button type="button" class="btn-gold" data-modal-close="1">留守听雨洞府 ▸</button>
      </div>
    `, true, { kind: "sect_defense_result", tier: "info" });
  }

  function spawnSectDefenseWave(waveNum) {
    const sd = arena.sectDefense;
    if (!sd || !sd.active) return;
    const cv = document.getElementById("fx-canvas");
    const w = (cv && cv.width) || 1440, h = (cv && cv.height) || 900;
    const realmBase = STAGE_SCALING[Math.min(4, Math.max(1, rankOf(game.realm)))] || 3.1;
    const rScale = realmBase * (0.85 + (waveNum - 1) * 0.16);
    const edgeAngles = [0.15, 0.85, 2.25, 2.95, -0.55, -2.55];
    const pool = waveNum === 1 ? ["wolf", "warden", "wolf", "serpent"] : waveNum === 2 ? ["warden", "shadow", "serpent", "puppet", "wolf"] : ["sentinel", "warden", "serpent", "shadow", "puppet"];
    pool.forEach((eid, idx) => {
      const a = edgeAngles[idx % edgeAngles.length];
      const pos = clampToPlaza(sd.coreX + Math.cos(a) * (w * 0.30), sd.coreY + Math.sin(a) * (h * 0.26), w, h);
      const isWaveBoss = waveNum === 3 && idx === 0;
      const mult = isWaveBoss ? rScale * 0.48 : rScale;
      spawnSingleEnemy(eid, pos.x, pos.y, mult, isWaveBoss, isWaveBoss ? "百鬼夜行统帅 · 雷狱魔将" : `攻山凶妖 · ${ENEMIES[eid].name}`);
    });
    addFloat(`🛡 护山守卫战 · 第 ${waveNum}/3 波百鬼夜行来袭！`, sd.coreX, sd.coreY - 72, "#70ffe6", 20, true);
  }

  function stepSectDefenseSiege(dt) {
    const sd = arena.sectDefense;
    if (!sd || !sd.active || !game) return;
    const st = getCombatStats(game);
    const sb = getSanctumBonuses(game);

    // Autonomous Guardian Sword-Array Towers (`护山剑阵灵塔`) fire cyan-gold sword beams!
    for (const tw of sd.towers) {
      tw.cd -= dt;
      if (tw.cd <= 0 && arena.enemies.length > 0) {
        const tgt = arena.enemies.find(e => e.hp > 0);
        if (tgt) {
          tw.cd = sb.towerCd;
          const ang = Math.atan2(tgt.y - tw.y, tgt.x - tw.x);
          arena.lightnings.push({ x1: tw.x, y1: tw.y - 44, x2: tgt.x, y2: tgt.y - 10, t: 0, color: "#70ffe6" });
          Sound.pluck(659.25, 0.08, 0.025, "triangle", tw.x);
          damageEnemy(tgt, Math.round(st.atk * sb.towerDmgMult), false, 12, ang, 3.0, false);
        }
      }
    }

    // Monsters near the Spirit Vein Core chip Core HP
    for (const e of arena.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - sd.coreX, e.y - sd.coreY) < e.r + 54) {
        sd.coreHp = Math.max(0, sd.coreHp - dt * (e.isBoss ? 34 : 14));
      }
    }
    if (sd.coreHp <= 0) {
      const failSummary = { victory: false, wavesCleared: Math.max(0, sd.wave - 1), maxWaves: sd.maxWaves, coreHp: 0, maxCoreHp: sd.maxCoreHp, stonesGained: 0, starPtsGained: 0, atkGranted: 0 };
      sd.active = false;
      arena.sectDefense = null;
      showToast("⚠ 护山灵脉受损！已自动重整洞府结界，可随时再战！");
      enterSanctumHub();
      openSectDefenseResultModal(failSummary);
      return;
    }

    if (arena.enemies.filter(e => !e.isTreasure && e.hp > 0).length === 0 && !arena.waveTransitioning) {
      if (sd.wave < sd.maxWaves) {
        sd.wave += 1;
        arena.waveTransitioning = true;
        Sound.fanfare();
        const sdEpoch = arena.stageEpoch;
        setTimeout(() => {
          if (!game || arena.stageEpoch !== sdEpoch || !arena.sectDefense || !arena.sectDefense.active) return;
          arena.waveTransitioning = false;
          spawnSectDefenseWave(sd.wave);
        }, 520);
      } else {
        const winCoreHp = sd.coreHp;
        const winMaxCoreHp = sd.maxCoreHp;
        const winMaxWaves = sd.maxWaves;
        sd.active = false;
        arena.sectDefense = null;
        game.bonusStarPts = (game.bonusStarPts || 0) + 2;
        const sdAtkRes = grantPermanentStatBonus(game, { atk: 16, source: "general" });
        game.sectMerits = (game.sectMerits || 0) + 1;
        game.stones += 260;
        Sound.fanfare();
        Sound.drum(0.30);
        showToast(sdAtkRes.grantedAtk > 0
          ? `🏆 护山大阵大捷！获赐【鸿蒙星魄×2（星魂点+2）】、剑攻永久+${sdAtkRes.grantedAtk}${sdAtkRes.atkCapped ? `（已达本境上限 ${game.atkFlatBonus}/${sdAtkRes.caps.atkFlatBonus}）` : ""} 与 260 灵石！`
          : `🏆 护山大阵大捷！获赐【鸿蒙星魄×2（星魂点+2）】与 260 灵石（本境永久剑攻已达上限 ${game.atkFlatBonus}/${sdAtkRes.caps.atkFlatBonus}）！`);
        enterSanctumHub();
        openSectDefenseResultModal({
          victory: true,
          wavesCleared: winMaxWaves,
          maxWaves: winMaxWaves,
          coreHp: winCoreHp,
          maxCoreHp: winMaxCoreHp,
          stonesGained: 260,
          starPtsGained: 2,
          atkGranted: sdAtkRes.grantedAtk
        });
      }
    }
  }

  // ==================== V21 OVERDRIVE SYSTEMS: 6-ASPECT AWAKENINGS, DUAL-HERO BOND ULT, CLOUD-SEA AERIAL, 9-TIER CELESTIAL SPIRE (16 CURIOS), RADIAL CHROMATIC & LIVE CODEX ====================
  const SIX_ASPECT_SPECS = {
    sword_qinglian:    { key: "sword_qinglian",    short: "游龙七刺", name: "万剑游龙刺",         color: "#70ffe6", desc: "青莲飞剑觉醒：化七道青莲剑影疾刺穿心，瞬间叠满剑印并连携追踪剑流！" },
    sword_xuanzhong:   { key: "sword_xuanzhong",   short: "巨阙开天", name: "巨阙开天斩",         color: "#ffb84d", desc: "玄重飞剑觉醒：凝十丈鎏金巨阙劈裂大地，造成巨额架势崩碎与裂地剑渊！" },
    spear_qinglian:    { key: "spear_qinglian",    short: "百鸟朝凤", name: "百鸟朝凤·幻影疾刺", color: "#80ffea", desc: "青莲龙枪觉醒：瞬刺九道扇形金青枪芒幻影，高频破甲且暴击率大幅飙升！" },
    spear_xuanzhong:   { key: "spear_xuanzhong",   short: "破军挑山", name: "破军挑山·裂地贯星", color: "#ffd166", desc: "玄重龙枪觉醒：霸体挑山掀飞群妖至高空，随即轰出裂地贯星陨坑冲击波！" },
    chakram_qinglian:  { key: "chakram_qinglian",  short: "日月旋涡", name: "日月双轮·引力旋涡", color: "#d69eff", desc: "青莲剑轮觉醒：祭出日金月青双轮高速公转，形成强力黑洞引力聚怪绞杀！" },
    chakram_xuanzhong: { key: "chakram_xuanzhong", short: "乾坤重锯", name: "乾坤巨轮·重碾破甲", color: "#ff9f43", desc: "玄重剑轮觉醒：掷出百钧乾坤重碾巨锯悬停切割，瞬碎敌方护盾与巨神装甲！" }
  };

  function getCurrentSixAspectSpec() {
    const wf = (game && game.weaponForm) || "sword";
    const pos = (arena && arena.weaponPosture === "xuanzhong") ? "xuanzhong" : "qinglian";
    return SIX_ASPECT_SPECS[`${wf}_${pos}`] || SIX_ASPECT_SPECS.sword_qinglian;
  }

  // 16 Cross-System Primordial Dao Curios (`太虚登仙台 · 16种天道法则奇物`, Capped at Lv.3 per Curio!)
  const SPIRE_CURIOS = [
    { id: "curio_dash_spear",      name: "惊鸿枪影佩",   badge: "闪避残影自动龙枪刺", art: "weapon_arsenal_trio",   desc: "触发一闪或滚筒侧闪时，残影自动向最近敌方刺出一记高破甲【龙胆贯虹枪芒】（每层伤害+45%）！" },
    { id: "curio_tag_soul",        name: "万妖同心印",   badge: "V键切人瞬发镇妖魂印", art: "spirit_seal_emblem",   desc: "按 V 键同心换人入场时，无消耗零冷却自动召唤当前佩带的【太虚镇妖魂印】妖王法相协击！" },
    { id: "curio_chakram_thunder", name: "紫电乾坤轮",   badge: "剑轮聚怪引爆紫霄雷链", art: "relic_soul_lamp",      desc: "回旋剑轮切割吸附敌群时，每跳自动引爆【紫霄连锁闪电】并直接触发水洼感电麻痹！" },
    { id: "curio_parry_meteor",    name: "陨星剑反镜",   badge: "识破/弹反天降陨星劈", art: "vfx_sky_meteor_plunge", desc: "触发识破剑反或太虚剑盾弹反法球时，立即在目标头顶轰落一记【陨星千钧裂地劈】！" },
    { id: "curio_posture_twin",    name: "阴阳双生匣",   badge: "易剑斩附带日月引力轮", art: "vfx_switch_yin_yang",  desc: "按 ` 触发【太虚易剑斩】时，额外在落点生成【日月引力双轮】并充能 +30% 双人同心值！" },
    { id: "curio_air_lotus",       name: "踏云青莲履",   badge: "御风跃起绽放水墨剑莲", art: "relic_jade_seal",      desc: "施展御风腾跃或踏剑借力时，原地绽放一朵【太虚水墨剑莲】持续聚怪绞杀！" },
    { id: "curio_gourd_soul",      name: "壶天炼妖葫",   badge: "饮仙葫刷魂印+八方剑罡", art: "item_immortal_gourd",  desc: "畅饮 Q 键九转仙葫时，立即刷新 C 键镇妖魂印冷却并向八方迸射破甲剑罡！" },
    { id: "curio_mark_nova",       name: "诛仙叠印谱",   badge: "爆印召唤九霄天罚落雷", art: "relic_frost_sword",    desc: "引爆飞剑剑印时伤害倍率提升 +40%，且每层引爆额外降下一道九霄紫雷！" },
    { id: "curio_crit_silk",       name: "流光织锦刃",   badge: "暴击追射飞剑+回剑意", art: "icon_blade",           desc: "每次造成暴击伤害额外附带每层 +18% 剑气追伤（最高 +54%），并立即充能 +3% 无上剑意与同心值！" },
    { id: "curio_shield_thorns",   name: "玄武反震甲",   badge: "持盾常驻剑攻+20%/层(上限45%)", art: "relic_cloud_mirror",   desc: "拥有护体灵盾期间常驻增伤池每层提升 +20%（最高 +45%），助阵护盾期爆发更猛！" },
    { id: "curio_soul_double",     name: "法天双生相",   badge: "魂印伤害+55%·返还冷却", art: "spirit_seal_emblem",   desc: "施放太虚镇妖魂印时，妖王法相威能提升 +55%，并立即返还 35% 魂印冷却时间！" },
    { id: "curio_bond_surge",      name: "红尘连理枝",   badge: "同心充能翻倍·合璧留势", art: "icon_heart",           desc: "双人同心值获取效率提升 +80%，释放双人合体奥义后直接返还 35% 同心值与剑意！" },
    { id: "curio_spear_bleed",     name: "破军裂脉锋",   badge: "六象特技附最大生命真伤", art: "weapon_arsenal_trio",  desc: "六象神兵觉醒技命中首领或精英时，额外附加目标最大气血 4% 的破脉真实伤害！" },
    { id: "curio_exec_reset",      name: "斩仙嗜血令",   badge: "处决重置全机动冷却",   art: "vfx_blade_clash_sparks", desc: "触发斩仙处决或踏躯逆鳞斩瞬间，回复 18% 气血并重置一闪、缩地与魂印全部冷却！" },
    { id: "curio_stone_alchemy",   name: "聚宝点金盘",   badge: "灵石增幅剑威·层层生金", art: "item_rough_jade",      desc: "每持有 100 灵石每层提升 +4% 剑道伤害（最高 +40%），每通关一层登仙台额外获赏 +60 灵石（最高 +180 石，单项上限 Lv.3）！" },
    { id: "curio_hongmeng_omni",   name: "鸿蒙太初道盘", badge: "暴伤+22%/层·飞剑+1/层(上限+2)", art: "banner_star_chart",    desc: "太初道韵灌体：每层暴击伤害 +22%（暴伤上限拓至 265%），环身本命飞剑每层 +1 柄（上限 +2 柄）！" }
  ];

  function getCurioStacks(g, cid) {
    const base = (g && g.spireCurios)
      ? Math.max(0, Math.min(PERM_GROWTH_CAPS.spireCurioMaxStack, Math.floor(num(g.spireCurios[cid], 0))))
      : 0;
    const wsOverlay = (arena && arena.customSeedRun && arena.customSeedRun.active && arena.customSeedRun.bonusCurios && hasOwn(arena.customSeedRun.bonusCurios, cid))
      ? Math.max(0, Math.min(PERM_GROWTH_CAPS.spireCurioMaxStack, Math.floor(num(arena.customSeedRun.bonusCurios[cid], 0))))
      : 0;
    return Math.max(base, wsOverlay);
  }

  // Zero-Overhead Radial Speed-Lines & Chromatic Glint (`径向速度线冲击环与高光琉璃色散`)
  function triggerRadialChromaticBurst(intensity = 1.0, accent = "#70ffe6", cx = null, cy = null) {
    if (isReducedMotionActive()) return;
    arena.radialBurst = {
      t: 0,
      dur: 0.48,
      intensity: Math.min(1.6, intensity),
      accent,
      x: cx !== null ? cx : (arena.player ? arena.player.x : 720),
      y: cy !== null ? cy : (arena.player ? arena.player.y : 450)
    };
  }

  // ==================== PILLAR 2A: 6 ORTHOGONAL WEAPON × POSTURE AWAKENING SKILLS (`六象神兵专属觉醒特技`) ====================
  function executeSixAspectAwakeningSkill(st, zenMult, samadhiBonus = 1.0) {
    const p = arena.player;
    const wf = (game && game.weaponForm) || "sword";
    const isHeavy = arena.weaponPosture === "xuanzhong";
    const spec = getCurrentSixAspectSpec();
    let ang = Math.atan2(pointer.y - p.y, pointer.x - p.x);
    const lockTgt = acquireSoftLockTarget(p.x, p.y, ang);
    if (lockTgt) ang = Math.atan2(lockTgt.y - p.y, lockTgt.x - p.x);
    p.facing = Math.cos(ang) >= 0 ? 1 : -1;
    if (typeof setPlayerAnimState === "function") setPlayerAnimState("heavy", 0.36);

    registerStyleAction("six_aspect", 115);
    enqueueSanqingEchoAction("six_aspect", { ang: arena.player.facing >= 0 ? 0 : Math.PI });
    stampNextShanheMantra(arena.player.x, arena.player.y);
    arena.astralEnergy = Math.min(100, (arena.astralEnergy || 0) + 18);
    triggerQimenResonanceNova();
    spawnSpatialSwordRift(arena.player.x + arena.player.facing * 86, arena.player.y, arena.player.facing >= 0 ? 0 : Math.PI);
    arena.bondSynergy = Math.min(100, (arena.bondSynergy || 0) + (getCurioStacks(game, "curio_bond_surge") > 0 ? 32 : 18));
    pushTelemetryInput(`✦六象·${spec.short}`, false);
    if (isSanctumDojoActive()) recordDojoDrillEvent("morph", spec.name);
    triggerRadialChromaticBurst(0.95, spec.color, p.x + Math.cos(ang) * 48, p.y + Math.sin(ang) * 28);

    const bleedStacks = getCurioStacks(game, "curio_spear_bleed");
    const applyHitWithCurio = (e, rawD, postD, knockD) => {
      const pctBonus = bleedStacks > 0 ? Math.min(2600, Math.round(e.maxHp * 0.04 * bleedStacks)) : 0;
      e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
      damageEnemy(e, Math.round(rawD + pctBonus), true, postD, ang, knockD, true);
    };

    if (wf === "sword" && !isHeavy) {
      // 1. 飞剑 × 青莲疾剑式：【万剑游龙刺】 (7-stream rapid dragon-pierce darts + dash pierce)
      Sound.slash(true, 2);
      Sound.spatialSwordHum(p.x + Math.cos(ang) * 140);
      p.x += Math.cos(ang) * 38; p.y += Math.sin(ang) * 24;
      pushBladeArc(p.x, p.y, ang, 145, "#70ffe6", 1, true, "spear_thrust");
      for (let i = -3; i <= 3; i++) {
        const a = ang + i * 0.075;
        arena.projectiles.push({
          friendly: true, kind: "crescent", x: p.x + Math.cos(a) * 24, y: p.y + Math.sin(a) * 16,
          vx: Math.cos(a) * 18.5, vy: Math.sin(a) * 18.5, ang: a, r: 48,
          dmg: Math.round(st.atk * 0.72 * zenMult * samadhiBonus), postureDmg: 12, knock: 5, addMark: 1, life: 0.48,
          pierced: new Set(), color: i % 2 === 0 ? "#70ffe6" : "#ffe28a"
        });
      }
      addFloat("✦ 六象觉醒 · 【青莲·万剑游龙刺】！！", p.x, p.y - 62, "#70ffe6", 19, true);
    } else if (wf === "sword" && isHeavy) {
      // 2. 飞剑 × 玄重巨阙式：【巨阙开天斩】 (Colossal golden sky-cleaving greatsword slam)
      p.hyperArmorTimer = 0.65;
      Sound.coreSeverBoom();
      Sound.drum(0.28);
      arena.shake = Math.max(arena.shake, 16);
      const ix = p.x + Math.cos(ang) * 96, iy = p.y + Math.sin(ang) * 62;
      pushBladeArc(ix, iy, ang, 185, "#ffb84d", 1, true);
      pushBladeArc(ix, iy, ang, 165, "#ffffff", -1, true);
      addDecal(ix, iy + 14, ang, 94, "spider_crack");
      spawnDistortionRing(ix, iy, 225, "#ffb84d");
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - ix, e.y - iy) < e.r + 175) {
          applyHitWithCurio(e, st.atk * 3.15 * zenMult * samadhiBonus, 72, 16);
        }
      });
      addFloat("✦ 六象觉醒 · 【玄重·巨阙开天斩】！！", p.x, p.y - 64, "#ffd166", 20, true);
    } else if (wf === "spear" && !isHeavy) {
      // 3. 龙胆枪 × 青莲疾剑式：【百鸟朝凤·幻影疾刺】 (9 rapid fan-spread phoenix spear thrusts)
      Sound.clang(1.32, 0.14);
      Sound.slash(true, 1);
      for (let i = -4; i <= 4; i++) {
        const a = ang + i * 0.11;
        const reach = 235;
        arena.blinkStreaks.push({ x1: p.x, y1: p.y - 10, x2: p.x + Math.cos(a) * reach, y2: p.y + Math.sin(a) * reach * 0.64 - 10, t: 0, color: i % 2 === 0 ? "#80ffea" : "#ffe28a" });
      }
      pushBladeArc(p.x, p.y, ang, 168, "#80ffea", 1, true, "spear_thrust");
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - (p.x + Math.cos(ang) * 115), e.y - (p.y + Math.sin(ang) * 74)) < e.r + 165) {
          if ((e.frontShieldHp || 0) > 0) e.frontShieldHp = 0;
          applyHitWithCurio(e, st.atk * 2.85 * zenMult * samadhiBonus, 54, 9);
        }
      });
      addFloat("✦ 六象觉醒 · 【百鸟朝凤·幻影疾刺】！！", p.x, p.y - 62, "#80ffea", 19, true);
    } else if (wf === "spear" && isHeavy) {
      // 4. 龙胆枪 × 玄重巨阙式：【破军挑山·裂地贯星】 (Tectonic skyward launch + meteor crater slam)
      p.hyperArmorTimer = 0.70;
      p.z = 38; p.vz = 10.5;
      Sound.meteorPlungeBoom();
      const ix = p.x + Math.cos(ang) * 92, iy = p.y + Math.sin(ang) * 58;
      arena.meteorBursts.push({ x: ix, y: iy + 8, r: 195, t: 0 });
      addDecal(ix, iy + 16, 0, 92, "spider_crack");
      spawnDistortionRing(ix, iy, 235, "#ffd166");
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - ix, e.y - iy) < e.r + 180) {
          e.airborneZ = 54; e.airborneVz = 6.5;
          applyHitWithCurio(e, st.atk * 3.35 * zenMult * samadhiBonus, 78, 14);
        }
      });
      addFloat("✦ 六象觉醒 · 【破军挑山·裂地贯星】！！", p.x, p.y - 66, "#ffd166", 20, true);
    } else if (wf === "chakram" && !isHeavy) {
      // 5. 回旋剑轮 × 青莲疾剑式：【日月双轮·引力聚怪旋涡】 (Twin Sun-Moon gravity vortex chakrams)
      Sound.switchStanceChime(false);
      const vx = p.x + Math.cos(ang) * 125, vy = p.y + Math.sin(ang) * 78;
      if (!arena.hoverChakrams) arena.hoverChakrams = [];
      [-28, 28].forEach((off, idx) => {
        arena.hoverChakrams.push({
          x: vx + off, y: vy, r: 122, rot: idx * 1.5, life: 3.1, tickCd: 0.02,
          gravityPull: 0.34,
          dmg: Math.round(st.atk * 0.86 * zenMult * samadhiBonus),
          color: idx === 0 ? "#ffe28a" : "#70ffe6"
        });
      });
      spawnDistortionRing(vx, vy, 195, "#d69eff");
      addFloat("✦ 六象觉醒 · 【日月双轮·引力旋涡】！！", vx, vy - 52, "#e2b8ff", 19, true);
    } else {
      // 6. 回旋剑轮 × 玄重巨阙式：【乾坤巨轮·重碾破甲锯】 (Colossal armor-shredding Qiankun heavy saw)
      p.hyperArmorTimer = 0.65;
      Sound.shieldBreakSub();
      Sound.clang(0.85, 0.18);
      const vx = p.x + Math.cos(ang) * 112, vy = p.y + Math.sin(ang) * 70;
      if (!arena.hoverChakrams) arena.hoverChakrams = [];
      arena.hoverChakrams.push({
        x: vx, y: vy, r: 148, rot: 0, life: 3.4, tickCd: 0.02,
        heavySaw: true, gravityPull: 0.22,
        dmg: Math.round(st.atk * 1.28 * zenMult * samadhiBonus),
        color: "#ff9f43"
      });
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - vx, e.y - vy) < e.r + 160) {
          e.frontShieldHp = 0; e.wardHp = 0;
          applyHitWithCurio(e, st.atk * 2.45 * zenMult * samadhiBonus, 68, 6);
        }
      });
      addFloat("✦ 六象觉醒 · 【乾坤巨轮·重碾破甲锯】！！", vx, vy - 54, "#ffb347", 20, true);
    }
  }

  // ==================== PILLAR 2B: DUAL-HERO BOND ULTIMATE (`双人同框羁绊合体奥义`) ====================
  const DUAL_BOND_ULT_SPECS = {
    shen: { partner: "shen", portrait: "actor_shen", seal: "青莲同心合璧", title: "青莲万剑净世阵", sub: "顾长青 × 沈清禾 · 万朵青莲剑雨涤荡九州，气血灵盾双满！", color: "#70ffe6" },
    pei:  { partner: "pei",  portrait: "actor_pei",  seal: "龙枪双绝合璧", title: "惊鸿破界诛神枪", sub: "顾长青 × 裴照 · 剑枪十字裂天贯界，瞬崩万妖百丈架势！", color: "#80ecff" },
    lu:   { partner: "lu",   portrait: "actor_lu",   seal: "紫微雷剑合璧", title: "九霄紫微神雷狱", sub: "顾长青 × 陆玄松 · 十二天罡雷剑轰顶，化万里山河为雷泽！", color: "#ffe28a" },
    yan:  { partner: "yan",  portrait: "actor_yan",  seal: "太虚双影合璧", title: "太虚万劫归墟斩", sub: "顾长青 × 砚尘 · 阴阳残影十二连绝斩，时空凝滞破灭万法！", color: "#d69eff" }
  };

  function getCurrentBondPartnerId() {
    const cur = (arena && arena.playableCharId) || "player";
    if (cur !== "player" && DUAL_BOND_ULT_SPECS[cur]) return cur;
    const roster = getUnlockedPlayableRoster(game).filter(id => id !== "player");
    return roster[0] || "shen";
  }

  function castDualHeroBondUltimate() {
    if (!game) return false;
    if ((arena.bondSynergy || 0) < 100) {
      showToast(`同心羁绊蓄积中 (${Math.floor(arena.bondSynergy || 0)}/100%) · 按 V 换人连携或施展六象特技快速蓄满！`);
      return false;
    }
    const partnerId = getCurrentBondPartnerId();
    const spec = DUAL_BOND_ULT_SPECS[partnerId] || DUAL_BOND_ULT_SPECS.shen;
    const retain = getCurioStacks(game, "curio_bond_surge") > 0 ? 35 : 0;
    arena.bondSynergy = retain;
    if (retain > 0) arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 35);

    const p = arena.player;
    const st = getCombatStats(game);
    p.invuln = 2.1;
    arena.ultCineTimer = 1.65;

    // Show Dual-Hero Side-by-Side Portraits in 2.35:1 Letterbox Cut-In!
    document.body.classList.add("letterbox-active");
    const cutEl = document.getElementById("style-ult-cutin");
    const port1 = document.getElementById("style-ult-portrait");
    const port2 = document.getElementById("style-ult-portrait-pair");
    const schEl = document.getElementById("style-ult-school");
    const titEl = document.getElementById("style-ult-title");
    const subEl = document.getElementById("style-ult-sub");
    if (port1) port1.src = ART.char_player;
    if (port2) port2.src = ART[spec.portrait];
    if (schEl) schEl.textContent = spec.seal;
    if (titEl) titEl.textContent = spec.title;
    if (subEl) subEl.textContent = spec.sub;
    if (cutEl) cutEl.classList.add("active", "dual-bond");

    if (ultCineHideTimer) clearTimeout(ultCineHideTimer);
    ultCineHideTimer = setTimeout(() => {
      document.body.classList.remove("letterbox-active");
      if (cutEl) cutEl.classList.remove("active", "dual-bond");
    }, 1680);

    Sound.triggerDucking(320, 0.22, 1650);
    Sound.soulManifestRoar();
    Sound.fanfare();
    GamepadSystem.rumble(1.0, 1.0, 360);
    triggerImpactFrame(4, spec.color, p.x, p.y - 24);
    triggerRadialChromaticBurst(1.45, spec.color, p.x, p.y - 20);
    triggerKillCamStamp(spec.title.slice(0, 4));
    registerStyleAction("dual_bond", 260);
    triggerQimenResonanceNova();
    spawnSpatialSwordRift(arena.player.x + arena.player.facing * 86, arena.player.y, arena.player.facing >= 0 ? 0 : Math.PI);
    pushTelemetryInput(`💞合璧·${spec.title.slice(0, 4)}!`, false);

    // Summon Partner Co-Op Avatar right beside Protagonist!
    arena.activeAllies = (arena.activeAllies || []).filter(a => a.id !== partnerId);
    arena.activeAllies.push({
      id: partnerId, name: PLAYABLE_COMPANIONS[partnerId].name, art: spec.portrait, color: spec.color,
      style: "sword_burst", x: p.x + p.facing * 56, y: p.y - 8, facing: p.facing, life: 8.0, maxLife: 8.0, atkCd: 0.1
    });

    if (partnerId === "shen") {
      game.hp = st.maxHp;
      p.shieldHp = Math.round(st.maxHp * 0.55);
      arena.lotusVortexes.push({ x: p.x, y: p.y, r: 240, life: 3.2, maxLife: 3.2, rot: 0, tickCd: 0, dmg: Math.round(st.atk * 1.65) });
    } else if (partnerId === "lu") {
      for (let k = 0; k < 8; k++) {
        const ka = (k * Math.PI * 2) / 8;
        const bx = p.x + Math.cos(ka) * 165, by = p.y + Math.sin(ka) * 105;
        arena.skyBolts.push({ x: bx, y: by, t: 0, color: "#ffe28a" });
        triggerElectroPoolReaction(bx, by, st.atk * 1.5);
      }
    } else if (partnerId === "yan") {
      arena.witchTime = Math.max(arena.witchTime || 0, 2.6);
    }

    for (let q = 0; q < 8; q++) {
      pushBladeArc(p.x, p.y - 10, (q * Math.PI) / 4, 210, q % 2 === 0 ? spec.color : "#ffe28a", q % 2 === 0 ? 1 : -1, true);
    }
    spawnDistortionRing(p.x, p.y, 320, spec.color);
    arena.enemies.slice().forEach(e => {
      if (e.hp > 0) {
        e.swordMarks = 6;
        if (partnerId === "pei") e.posture = 0;
        damageEnemy(e, Math.round(st.atk * 5.2), true, 110, Math.atan2(e.y - p.y, e.x - p.x), 14, true);
      }
    });
    addFloat(`💞 双人合璧 · 【${spec.title}】！！`, p.x, p.y - 72, spec.color, 23, true);
    syncTagTeamHud();
    updateHud();
    return true;
  }

  // ==================== PILLAR 1: CLOUD-SEA HIGH-SPEED SWORD-SURFING AERIAL STAGE (`九霄云海 · 破阵凌霄`) ====================
  function startCloudSeaAerialStage() {
    if (!game) return;
    if (!guardNotInTribulation("九霄云海空战")) return;
    if (!guardEcosystemAccess("cloud_sea_trial")) return;
    restoreCustomSeedTempCurio();
    flushAndEndMeditation();
    if (practiceFormalSnapshot) endPracticeModeIsolation();
    resetStageTransitionState();
    closeModal();
    closeDrawer();
    const cv = document.getElementById("fx-canvas");
    const w = (cv && cv.width) || 1440, h = (cv && cv.height) || 900;

    const wasSanctum = !!arena.sanctumMode;
    arena.stageEpoch += 1;
    arena.sanctumMode = false;
    if (wasSanctum) resetSanctumDojoCombatGauges();
    else purgeTransientCombatEntities({ clearPlayerBuffs: true });
    arena.towerMode = false;
    arena.dungeonMap = null;
    arena.bossRush = null;
    arena.sectDefense = null;
    arena.celestialSpire = null;
    arena.customSeedRun = null;
    arena.waveTransitioning = false;
    arena.defeatRevivesUsed = 0;
    arena.defeatPending = null;
    resetEncounterTelemetry();
    arena.nearbyProp = null;
    renderPropInteractHud();
    hideDojoControlBar();

    arena.enemies = [];
    arena.projectiles = [];
    arena.props = [];
    arena.drops = [];
    arena.zones = [];
    arena.qimenArray = null;
    arena.qimenCd = 0;
    arena.domain = null;
    arena.activeAllies = [];
    arena.witchTime = 0;
    arena.lotusVortexes = [];
    arena.thunderOrbs = [];
    arena.jadeDecoys = [];
    arena.waterPools = [];
    arena.fireZones = [];
    arena.frostPools = [];
    arena.groundSweeps = [];
    arena.hoverChakrams = [];

    transitionStageScene("arena_cloud_sea_sky", "cloud_sea");
    const p = arena.player;
    p.x = w * 0.24;
    p.y = h * 0.52;
    p.z = 42;
    p.vz = 0;
    p.facing = 1;
    p.barrelRollTimer = 0;
    p.skyDeflectTimer = 0;

    const st = getCombatStats(game);
    game.hp = st.maxHp;
    game.mp = st.maxMp;
    syncFlyingSwords();

    arena.cloudFlight = {
      active: true,
      scrollX: 0,
      progress: 0,
      spawnCd: 0.5,
      laserCd: 2.2,
      bossSpawned: false,
      deflectedCount: 0,
      barrelRolls: 0,
      laserNets: [],
      cloudStreaks: Array.from({ length: 22 }, (_, i) => ({
        x: (i * 73) % w,
        y: 90 + ((i * 137) % (h - 180)),
        len: 95 + (i % 4) * 55,
        spd: 520 + (i % 5) * 145,
        layer: i % 3
      }))
    };

    // Spawn vanguard Sky-Patrol Thunder-Roc Escorts immediately!
    spawnCloudSeaAerialWave(false);
    showBossCutIn("enemy_roc_sky_general", "九霄云海 · 高速御剑破阵", "左键攒射万剑追踪齐射 · 空格【滚筒侧闪】穿天雷激光网 · 右键/E【太虚剑盾】原路震回漫天法球！");
    updateBossBannerAndRecallOrb();
    updateHud();
  }

  function spawnCloudSeaAerialWave(spawnCommander = false) {
    const cf = arena.cloudFlight;
    if (!cf || !cf.active || !game) return;
    const cv = document.getElementById("fx-canvas");
    const w = (cv && cv.width) || 1440, h = (cv && cv.height) || 900;
    const st = getCombatStats(game);
    const scale = (STAGE_SCALING[Math.min(4, Math.max(2, rankOf(game.realm)))] || 5.1) * 0.72;

    if (spawnCommander) {
      cf.bossSpawned = true;
      const bossHp = Math.max(4200, Math.round(st.atk * 56));
      const rocBoss = {
        uid: "sky_roc_boss_" + Date.now(),
        id: "sky_roc", art: "enemy_roc_sky_general",
        name: "巡天金甲神将 · 紫电雷鹏王",
        isBoss: true, isSkyUnit: true, isTreasure: false, enraged: false,
        x: w * 0.76, y: h * 0.48, vx: 0, vy: 0, kx: 0, ky: 0, sx: 1, sy: 1, facing: -1,
        r: 58, hp: bossHp, maxHp: bossHp, posture: 165, maxPosture: 165,
        partHp: Math.round(bossHp * 0.3), maxPartHp: Math.round(bossHp * 0.3),
        weakpointExposed: true, partSevered: false,
        atk: Math.max(22, Math.round(st.maxHp * 0.13)),
        heavy: Math.max(34, Math.round(st.maxHp * 0.22)),
        state: "chase", timer: 0.9, windupDur: 0.85, salvoCd: 1.35,
        aimX: arena.player.x, aimY: arena.player.y, attackType: "shot",
        hitFlash: 0, swordMarks: 0, chillTimer: 0, burnTimer: 0, airborneZ: 36, airborneVz: 0
      };
      arena.enemies.push(rocBoss);
      // Fire an immediate fan of 7 golden-violet thunder orbs so player can test Projectile Deflect right away!
      fireSkyGeneralOrbSalvo(rocBoss, 7);
      Sound.thunderCrack();
      addFloat("⚡ 巡天金甲雷鹏将拦路！开右键/空格【太虚剑盾】反弹漫天雷球！", rocBoss.x - 90, rocBoss.y - 78, "#ffe28a", 19, true);
    } else {
      for (let i = 0; i < 3; i++) {
        const ey = h * (0.32 + i * 0.18);
        spawnSingleEnemy(i === 1 ? "sky_roc" : "shadow", w * (0.72 + i * 0.06), ey, scale * 0.85, false, i === 1 ? "巡天金甲先锋" : "九霄雷鹏妖卫");
        const last = arena.enemies[arena.enemies.length - 1];
        if (last) {
          last.isSkyUnit = true;
          last.airborneZ = 32;
          last.salvoCd = 1.1 + i * 0.4;
        }
      }
      if (arena.enemies[0]) fireSkyGeneralOrbSalvo(arena.enemies[0], 5);
    }
  }

  function fireSkyGeneralOrbSalvo(srcEnemy, count = 5) {
    if (!srcEnemy || !arena.player) return;
    const baseAng = Math.atan2(arena.player.y - srcEnemy.y, arena.player.x - srcEnemy.x);
    for (let k = 0; k < count; k++) {
      const a = baseAng + (k - (count - 1) / 2) * 0.18;
      arena.projectiles.push({
        friendly: false, kind: "orb",
        x: srcEnemy.x - 24, y: srcEnemy.y - 12,
        vx: Math.cos(a) * 6.8, vy: Math.sin(a) * 6.8,
        ang: a, r: 15, dmg: srcEnemy.atk || 20, life: 3.2,
        color: k % 2 === 0 ? "#ffd166" : "#d69eff",
        skyOrb: true
      });
    }
  }

  function triggerSkyBarrelRollAndShield(isDeflectFocus = false) {
    const cf = arena.cloudFlight;
    if (!cf || !cf.active || !game) return false;
    const p = arena.player;
    const st = getCombatStats(game);
    p.barrelRollTimer = 0.46;
    p.skyDeflectTimer = 0.78;
    p.invuln = Math.max(p.invuln || 0, 0.65);
    cf.barrelRolls += 1;
    Sound.skyLeapWhoosh();
    Sound.spatialSwordHum(p.x);
    registerStyleAction(isDeflectFocus ? "sky_deflect" : "sky_roll", 78);
    pushTelemetryInput(isDeflectFocus ? "🛡太虚剑盾弹反" : "🌪御剑滚筒侧闪", false);
    triggerRadialChromaticBurst(0.85, "#80ffea", p.x, p.y - 30);

    // Reflect all nearby hostile projectiles straight back at 2.4x velocity (`太虚剑盾 · 弹幕原路震回`)!
    let reflected = 0;
    const bossTgt = arena.enemies.find(e => e.hp > 0 && e.isBoss) || arena.enemies.find(e => e.hp > 0);
    for (const pr of arena.projectiles) {
      if (!pr.friendly && Math.hypot(pr.x - p.x, pr.y - p.y) < 220) {
        pr.friendly = true;
        pr.deflected = true;
        pr.pierced = new Set();
        const rAng = bossTgt ? Math.atan2(bossTgt.y - pr.y, bossTgt.x - pr.x) : Math.PI * 0;
        const spd = Math.max(15.5, Math.hypot(pr.vx, pr.vy) * 2.4);
        pr.vx = Math.cos(rAng) * spd;
        pr.vy = Math.sin(rAng) * spd;
        pr.r = 24;
        pr.dmg = Math.round(st.atk * 3.2);
        pr.postureDmg = 36;
        pr.color = "#70ffe6";
        pr.life = 1.8;
        reflected += 1;
      }
    }
    if (reflected > 0) {
      cf.deflectedCount += reflected;
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + reflected * 12);
      arena.bondSynergy = Math.min(100, (arena.bondSynergy || 0) + reflected * 14);
      Sound.deflectClang();
      GamepadSystem.rumble(0.78, 0.62, 145);
      addFloat(`🛡 太虚剑盾 · 原路震回 ×${reflected} 枚雷球！！`, p.x, p.y - 68, "#80ffea", 20, true);
      if (bossTgt && getCurioStacks(game, "curio_parry_meteor") > 0) {
        arena.meteorBursts.push({ x: bossTgt.x, y: bossTgt.y, r: 165, t: 0 });
        damageEnemy(bossTgt, Math.round(st.atk * 2.6), true, 32, 0, 6, true);
      }
    } else {
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 10);
      addFloat("🌪 御剑滚筒机动 · 穿云避雷！", p.x, p.y - 58, "#b8f7ff", 17, true);
    }
    return true;
  }

  function fireCloudSeaSwordBarrage() {
    const cf = arena.cloudFlight;
    if (!cf || !cf.active || !game) return false;
    const p = arena.player;
    if (p.slashCd > 0) return true;
    const st = getCombatStats(game);
    p.slashCd = 0.14 / st.atkHaste;
    p.facing = 1;
    Sound.slash(false, 1);
    registerStyleAction("light", 38);

    // 1. 3-stream forward Sword-Qi Rapid Barrage (`万剑弹幕攒射`)
    [-18, 0, 18].forEach((oy, idx) => {
      arena.projectiles.push({
        friendly: true, kind: "crescent",
        x: p.x + 36, y: p.y + oy - 18,
        vx: 20.5, vy: oy * 0.06, ang: 0, r: 38,
        dmg: Math.round(st.atk * 0.85), postureDmg: 9, knock: 3, addMark: 1, life: 0.72,
        pierced: new Set(), color: idx === 1 ? "#ffe28a" : "#70ffe6"
      });
    });

    // 2. Homing Flying-Sword Salvo (`飞剑追踪齐射`) locking onto aerial foes!
    const targets = arena.enemies.filter(e => e.hp > 0);
    if (targets.length > 0) {
      for (let s = 0; s < 2; s++) {
        const tgt = targets[s % targets.length];
        const a = Math.atan2(tgt.y - p.y, tgt.x - p.x);
        arena.projectiles.push({
          friendly: true, kind: "twin_x", homingTarget: tgt,
          x: p.x + 12, y: p.y - 36 + s * 44,
          vx: Math.cos(a) * 16.5, vy: Math.sin(a) * 16.5, ang: a, r: 36,
          dmg: Math.round(st.atk * 0.92), postureDmg: 11, knock: 2, addMark: 1, life: 1.15,
          pierced: new Set(), color: "#80ffea"
        });
      }
    }
    return true;
  }

  function stepCloudSeaFlight(dt, w, h) {
    const cf = arena.cloudFlight;
    if (!cf || !cf.active || !game) return;
    const p = arena.player;
    const st = getCombatStats(game);

    cf.scrollX += dt * 680;
    cf.progress = Math.min(100, cf.progress + dt * 9.5);
    p.z = 42 + Math.sin(performance.now() * 0.006) * 7;
    if (p.barrelRollTimer > 0) {
      p.barrelRollTimer = Math.max(0, p.barrelRollTimer - dt);
      p.lean = (1 - p.barrelRollTimer / 0.46) * Math.PI * 2;
    }
    if (p.skyDeflectTimer > 0) {
      p.skyDeflectTimer = Math.max(0, p.skyDeflectTimer - dt);
      // Auto-deflect any orb entering active Taixu Sword Shield!
      const bossTgt = arena.enemies.find(e => e.hp > 0);
      for (const pr of arena.projectiles) {
        if (!pr.friendly && Math.hypot(pr.x - p.x, pr.y - p.y) < 115) {
          pr.friendly = true;
          pr.deflected = true;
          pr.pierced = new Set();
          const rAng = bossTgt ? Math.atan2(bossTgt.y - pr.y, bossTgt.x - pr.x) : 0;
          pr.vx = Math.cos(rAng) * 18.5;
          pr.vy = Math.sin(rAng) * 18.5;
          pr.dmg = Math.round(st.atk * 3.0);
          pr.color = "#70ffe6";
          cf.deflectedCount += 1;
          Sound.deflectClang();
        }
      }
    }

    // Homing steering on `homingTarget` sword projectiles!
    for (const pr of arena.projectiles) {
      if (pr.friendly && pr.homingTarget && pr.homingTarget.hp > 0) {
        const ta = Math.atan2(pr.homingTarget.y - pr.y, pr.homingTarget.x - pr.x);
        pr.vx += Math.cos(ta) * 2.4;
        pr.vy += Math.sin(ta) * 2.4;
        const sp = Math.hypot(pr.vx, pr.vy) || 1;
        pr.vx = (pr.vx / sp) * 18.5;
        pr.vy = (pr.vy / sp) * 18.5;
        pr.ang = Math.atan2(pr.vy, pr.vx);
      }
    }

    // Scroll Parallax Cloud Streaks
    for (const cs of cf.cloudStreaks) {
      cs.x -= cs.spd * dt;
      if (cs.x + cs.len < -40) {
        cs.x = w + 60 + Math.random() * 140;
        cs.y = 85 + Math.random() * (h - 170);
      }
    }

    // Sweeping Sky-Thunder Laser Nets (`天雷激光网`: dodge via Barrel-Roll!)
    cf.laserCd -= dt;
    if (cf.laserCd <= 0) {
      cf.laserCd = 3.2;
      cf.laserNets.push({ x: w + 40, y: p.y + (Math.random() - 0.5) * 90, hSpan: 175, spd: 460, hit: false });
    }
    for (let i = cf.laserNets.length - 1; i >= 0; i--) {
      const ln = cf.laserNets[i];
      ln.x -= ln.spd * dt;
      if (!ln.hit && Math.abs(ln.x - p.x) < 28 && Math.abs(ln.y - p.y) < ln.hSpan * 0.5) {
        if (p.invuln > 0 || p.barrelRollTimer > 0) {
          ln.hit = true;
          arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 18);
          addFloat("✨ 滚筒穿激光 · 剑意+18%！", p.x, p.y - 64, "#80ffea", 17, true);
        } else {
          ln.hit = true;
          hurtPlayer(18, { sourceName: "九霄云海雷网", moveName: "雷网拦截", isHeavy: false });
        }
      }
      if (ln.x < -80) cf.laserNets.splice(i, 1);
    }

    // Hover & Salvo AI for Sky Units
    arena.enemies.forEach((e, idx) => {
      if (!e.isSkyUnit || e.hp <= 0) return;
      const homeX = w * (e.isBoss ? 0.74 : 0.68 + (idx % 2) * 0.08) + Math.sin(performance.now() * 0.002 + idx) * 34;
      const homeY = h * (e.isBoss ? 0.48 : 0.30 + (idx % 3) * 0.19) + Math.cos(performance.now() * 0.0025 + idx) * 28;
      e.x += (homeX - e.x) * Math.min(1, dt * 3.5);
      e.y += (homeY - e.y) * Math.min(1, dt * 3.5);
      e.airborneZ = 36;
      e.salvoCd = (e.salvoCd || 1.6) - dt;
      if (e.salvoCd <= 0 && e.state !== "stun") {
        e.salvoCd = e.isBoss ? 1.85 : 2.5;
        fireSkyGeneralOrbSalvo(e, e.isBoss ? 6 : 3);
      }
    });

    const alive = arena.enemies.filter(e => e.hp > 0).length;
    if (alive === 0) {
      if (!cf.bossSpawned && cf.progress >= 38) {
        spawnCloudSeaAerialWave(true);
      } else if (!cf.bossSpawned) {
        cf.progress = Math.max(cf.progress, 42);
        spawnCloudSeaAerialWave(true);
      } else {
        // Sky-Patrol Boss defeated -> Award Cloud-Sea Climax Seal & descend onto upper realm!
        cf.active = false;
        arena.cloudFlight = null;
        p.z = 0; p.lean = 0;
        const firstClear = !game.cloudSeaCleared;
        game.cloudSeaCleared = true;
        ensureMetaState();
        if (!sandboxMode) {
          metaState.cloudSeaClears = (metaState.cloudSeaClears || 0) + 1;
        }
        game.stones += 180;
        let cloudAtkGranted = 0;
        if (firstClear) {
          const csAtkRes = grantPermanentStatBonus(game, { atk: 12, source: "general" });
          cloudAtkGranted = csAtkRes.grantedAtk;
          game.bonusStarPts = (game.bonusStarPts || 0) + 1;
          if (Array.isArray(game.journal)) game.journal.unshift(`金丹御剑破开九霄云海防线，获【破云证道印】(+${cloudAtkGranted}攻 · 远征/登仙台收益+15%)！`);
        }
        arena.swordIntent = 100; arena.bondSynergy = 100; arena.astralEnergy = 100;
        Sound.fanfare();
        triggerRadialChromaticBurst(1.35, "#ffe28a", w * 0.5, h * 0.5);
        if (!sandboxMode) saveMeta();
        const descendStage = rankOf(game.realm) >= 4 ? 4 : 3;
        initArenaStage(descendStage, false);
        const cloudGear = rollGearItem(descendStage, 3);
        acquireGearItem(cloudGear);
        saveGame();
        showToast(firstClear
          ? `☁ 九霄云海首破功成！获【破云证道印】(常驻攻+${cloudAtkGranted} · 星魂+1 · 远征/登仙台收益+15% · 灵石+180 · 仙品【${cloudGear.name}】)！`
          : `☁ 九霄云海破阵功成！已御剑俯冲降临【${STAGES[descendStage].name}】（剑意全满+180灵石 · 仙品【${cloudGear.name}】）！`);
      }
    }
  }

  // ==================== PILLAR 3: 9-TIER ROGUELIKE CELESTIAL SPIRE (`太虚登仙台 · 九重天宫肉鸽深渊`) ====================
  const SPIRE_ROOM_TYPES = [
    { id: "elite_trial",     icon: "⚔", name: "巡天妖王房", desc: "迎战巡天雷鹏与秘境妖王，通关必选太古天道奇物！" },
    { id: "spirit_blessing", icon: "🌸", name: "太初灵脉房", desc: "内蕴太初满灵泉与聚宝金灵，休整回满状态并选奇物！" },
    { id: "chaos_wager",     icon: "🎲", name: "混沌赌局房", desc: "可主动点击【混沌燃血赌坛】献祭25%气血，博取【奇物双层直升 Lv+2】与双倍灵石悬赏！" },
    { id: "curio_vault",     icon: "🏺", name: "天工秘宝房", desc: "镇守五行八卦藏宝壁，破壁爆神装并额外多领1件奇物！" }
  ];

  function openCelestialSpireModal() {
    if (!game) return;
    if (!guardNotInTribulation("太虚登仙台")) return;
    if (!guardEcosystemAccess("celestial_spire")) return;
    notifyUnlockCardTried("spire");
    closeDrawer();
    const curEntries = Object.entries(game.spireCurios || {}).filter(([, lv]) => lv > 0);
    const bestFl = Math.max(metaState.bestSpireFloor || 0, (game.bestSpireFloor || 0));

    openModal(`
      <div class="drawer-mural-banner" style="height:96px;">
        <img src="${ART.banner_celestial_spire}" alt="太虚登仙台" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">九重天宫 · 终局肉鸽深渊</span>
            <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:4px;">太虚登仙台 · 九重天宫奇物构筑试炼 (L键)</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">返回道场 ✕</button>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <span style="font-size:11.5px;color:#b8dcd5;">连续闯荡随机生成的九重天宫秘境（妖王房/灵脉房/混沌赌局/天工秘宝），每重天三选一叠加 <b style="color:#ffe28a;">16 种跨系统天道法则奇物</b>！</span>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          <span id="spire-cloud-sea-chip" class="tag-chip ${game.cloudSeaCleared ? "mythic" : ""}">${game.cloudSeaCleared ? "☁ 破云证道印 · 登仙台灵石 +15%" : "☁ 破云印未启（先破九霄云海 +15%）"}</span>
          <span class="tag-chip mythic">登仙榜最高：第 ${bestFl}/9 重天 · 已叠奇物 ${curEntries.reduce((s, [cid]) => s + getCurioStacks(game, cid), 0)} 层</span>
        </div>
      </div>

      <div class="spire-room-grid">
        ${SPIRE_ROOM_TYPES.map(rt => `
          <div class="jade-card" style="padding:8px 10px;gap:3px;">
            <strong style="font-size:12px;color:var(--gold-bright);">${rt.icon} ${rt.name}</strong>
            <span style="font-size:10.5px;color:var(--text-sub);">${rt.desc}</span>
          </div>
        `).join("")}
      </div>

      ${curEntries.length ? `
        <div class="jade-card" style="padding:8px 10px;gap:5px;">
          <strong style="font-size:11.5px;color:#80ffea;">☯ 当前已觉醒的太古天道奇物（跨模式常驻生效 · 单项上限 Lv.${PERM_GROWTH_CAPS.spireCurioMaxStack}）：</strong>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            ${curEntries.map(([cid]) => {
              const sp = SPIRE_CURIOS.find(x => x.id === cid);
              const clampedLv = getCurioStacks(game, cid);
              return (sp && clampedLv > 0) ? `<span class="tag-chip mythic" data-tip="${escTip(sp.name, sp.desc)}">${sp.name} Lv.${clampedLv}/${PERM_GROWTH_CAPS.spireCurioMaxStack}${clampedLv >= PERM_GROWTH_CAPS.spireCurioMaxStack ? " (满)" : ""}</span>` : "";
            }).join("")}
          </div>
        </div>
      ` : ""}

      <div style="font-size:11px;color:#ffd8a8;background:rgba(46,28,12,0.55);border:1px solid rgba(255,196,102,0.35);border-radius:8px;padding:6px 10px;">
        🎯 规则说明：仅从第一重天完整登仙可铭刻奇物、领取灵石/星魂点并记入登仙榜；直登第九重为【练习模式】（不发奖励、不记纪录）。
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border-subtle);padding-top:8px;">
        <button type="button" class="btn-ghost" style="border-color:#80ecff;color:#b8f7ff;padding:6px 12px;font-size:11.5px;" data-action="start-cloud-sea">☁ 先遣破阵：九霄云海高速空战</button>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn-ghost" style="border-color:#ff9eff;color:#f5d0ff;padding:6px 13px;font-size:11.5px;" data-start-spire="9">🌌 直登第九重：凌霄帝君殿（练习·无奖）</button>
          <button type="button" class="btn-gold" style="padding:7px 18px;font-size:12.5px;" data-start-spire="1">🏯 踏入第一重天 · 开启登仙肉鸽</button>
        </div>
      </div>
    `, true);
  }

  function startCelestialSpireRun(startFloor = 1) {
    if (!game) return;
    if (!guardNotInTribulation("太虚登仙台")) return;
    if (!guardEcosystemAccess("celestial_spire")) return;
    restoreCustomSeedTempCurio();
    flushAndEndMeditation();
    const clampedStart = Math.max(1, Math.min(9, Math.floor(num(startFloor, 1))));
    const isPractice = clampedStart > 1;
    if (isPractice) beginPracticeModeIsolation();
    else if (practiceFormalSnapshot) endPracticeModeIsolation();
    resetStageTransitionState();
    closeModal();
    closeDrawer();
    if (!game.spireCurios) game.spireCurios = {};
    const wasSanctum = !!arena.sanctumMode;
    arena.stageEpoch += 1;
    arena.sanctumMode = false;
    if (wasSanctum) resetSanctumDojoCombatGauges();
    else purgeTransientCombatEntities({ clearPlayerBuffs: true });
    arena.towerMode = false;
    arena.dungeonMap = null;
    arena.bossRush = null;
    arena.sectDefense = null;
    arena.cloudFlight = null;
    arena.customSeedRun = null;
    arena.waveTransitioning = false;
    arena.defeatRevivesUsed = 0;
    arena.defeatPending = null;
    resetEncounterTelemetry();
    arena.nearbyProp = null;
    renderPropInteractHud();
    hideDojoControlBar();

    arena.celestialSpire = {
      active: true,
      floor: clampedStart,
      startFloor: clampedStart,
      maxFloors: 9,
      roomType: "elite_trial",
      wagerDouble: false,
      practiceMode: isPractice
    };
    if (isPractice) {
      showToast(`🎯 登仙台练习模式（自第 ${clampedStart} 重天跳关）：本局不发奇物与奖励，不计入登仙榜纪录！`);
    }
    spawnCelestialSpireFloor();
  }

  function spawnCelestialSpireFloor() {
    const sp = arena.celestialSpire;
    if (!sp || !sp.active || !game) return;
    const cv = document.getElementById("fx-canvas");
    const w = (cv && cv.width) || 1440, h = (cv && cv.height) || 900;

    arena.enemies = [];
    arena.props = [];
    arena.drops = [];
    purgeTransientCombatEntities({ clearPlayerBuffs: false });
    const pPos = clampToPlaza(w * 0.34, h * 0.56, w, h);
    arena.player.x = pPos.x; arena.player.y = pPos.y; arena.player.z = 0;

    // Pick procedural room archetype based on floor!
    const roomOrder = ["elite_trial", "curio_vault", "chaos_wager", "spirit_blessing"];
    sp.roomType = sp.floor === 9 ? "elite_trial" : roomOrder[(sp.floor - 1) % roomOrder.length];
    sp.wagerDouble = false;

    transitionStageScene(sp.floor >= 7 ? "arena_terrace" : sp.floor >= 4 ? "arena_wanjian_tomb" : "arena_secret", "spire");
    spawnStageInteractiveHazards();

    const rb = getRealmCombatBaseline(game.realm);
    const calSpec = getCalamityCycleSpec(game);
    const pactHp = hasPact(game, "frenzy_hp") ? 1.25 : 1.0;
    const flFactor = 0.62 + (sp.floor - 1) * 0.065;
    const applySpireStats = (unit, hpTarget, atkFactor, heavyFactor) => {
      if (!unit) return;
      const finalHp = Math.max(unit.isBoss ? 1800 : 220, Math.round(hpTarget * pactHp * calSpec.hpMult));
      unit.hp = finalHp;
      unit.maxHp = finalHp;
      if (unit.isBoss) {
        unit.partHp = Math.max(180, Math.round(finalHp * 0.28));
        unit.maxPartHp = unit.partHp;
      }
      unit.atk = Math.max(10, Math.round(rb.atk * atkFactor * calSpec.atkMult));
      unit.heavy = Math.max(16, Math.round(rb.heavy * heavyFactor * calSpec.atkMult));
    };

    if (sp.roomType === "chaos_wager") {
      // Explicit player choice: spawn interactive Blood Wager Altar instead of auto-draining HP!
      const wgPos = clampToPlaza(w * 0.48, h * 0.44, w, h);
      arena.props.push({
        id: "spire_wager_altar_" + Date.now(), kind: "spire_wager_altar", destructible: false, art: "icon_blade",
        name: "混沌燃血赌坛", badge: "主动献祭 25% 气血 → 本层奇物直升 Lv.+2 & 双倍灵石",
        x: wgPos.x, y: wgPos.y, r: 44, progress: 0
      });
      addFloat("🎲 混沌天命赌局：可主动点击【混沌燃血赌坛】燃血博双倍奇物！", arena.player.x, arena.player.y - 66, "#ff9eff", 18, true);
    } else if (sp.roomType === "spirit_blessing") {
      const spPos = clampToPlaza(w * 0.50, h * 0.48, w, h);
      arena.props.push({
        id: "spire_spring_" + Date.now(), kind: "immortal_spring", destructible: false, art: "prop_bagua_secret_gate",
        name: "天宫赐福 · 太初满灵泉", badge: "点击/Enter 全满恢复 · 剑意100%", x: spPos.x, y: spPos.y, r: 44, progress: 0
      });
    }

    if (sp.floor === 9) {
      // Floor 9 Apex Boss: Sky-Patrol Thunder-Roc Sovereign + Escort!
      spawnSingleEnemy("sky_roc", w * 0.66, h * 0.48, 1.0, true, "登仙台九重帝君 · 巡天金甲雷鹏将");
      applySpireStats(arena.enemies[arena.enemies.length - 1], rb.bossHp * 1.10, 1.06, 1.08);
      spawnSingleEnemy("sentinel", w * 0.60, h * 0.60, 1.0, false, "凌霄护殿金甲卫");
      applySpireStats(arena.enemies[arena.enemies.length - 1], rb.mobHp * 1.25, 0.78, 0.74);
    } else {
      const bossPool = ["warden", "serpent", "puppet", "sky_roc", "sentinel"];
      const mainId = bossPool[(sp.floor - 1) % bossPool.length];
      const isSpireBoss = sp.floor % 3 === 0;
      spawnSingleEnemy(mainId, w * 0.65, h * 0.52, 1.0, isSpireBoss, `第${sp.floor}重天镇守 · ${ENEMIES[mainId].name}`);
      if (isSpireBoss) {
        const spireBossMult = sp.floor === 3 ? 0.62 : 0.80;
        const spireBossAtkF = 0.82 + sp.floor * 0.025;
        applySpireStats(arena.enemies[arena.enemies.length - 1], rb.bossHp * spireBossMult, spireBossAtkF, spireBossAtkF);
      } else {
        const mobAtkF = 0.68 + sp.floor * 0.025;
        const mobHeavyF = 0.62 + sp.floor * 0.025;
        applySpireStats(arena.enemies[arena.enemies.length - 1], rb.mobHp * flFactor * 1.45, mobAtkF, mobHeavyF);
      }
      spawnSingleEnemy("warden", w * 0.56, h * 0.44, 1.0, false, "天宫巡狩灵卫");
      applySpireStats(arena.enemies[arena.enemies.length - 1], rb.mobHp * flFactor * 0.95, 0.62 + sp.floor * 0.02, 0.58 + sp.floor * 0.02);
      if (sp.roomType === "spirit_blessing") {
        spawnSingleEnemy("serpent", w * 0.62, h * 0.62, 1.0, false, "聚宝天官幻影");
        const bonusMob = arena.enemies[arena.enemies.length - 1];
        applySpireStats(bonusMob, rb.mobHp * flFactor * 0.80, 0.58 + sp.floor * 0.02, 0.55 + sp.floor * 0.02);
        bonusMob.isTreasure = false;
      }
    }
    const rMeta = SPIRE_ROOM_TYPES.find(x => x.id === sp.roomType) || SPIRE_ROOM_TYPES[0];
    showBossCutIn("banner_celestial_spire", `太虚登仙台 · 第 ${sp.floor}/9 重天【${rMeta.name}】`, rMeta.desc);
    syncFlyingSwords();
    updateBossBannerAndRecallOrb();
    updateHud();
  }

  function completeSpirePracticeFloor() {
    const sp = arena.celestialSpire;
    if (!game || !sp) return;
    const startFl = Math.max(2, Math.min(9, Math.floor(num(sp.startFloor, sp.floor || 9))));
    if (sp.floor >= 9) {
      sp.active = false;
      arena.celestialSpire = null;
      if (practiceFormalSnapshot) endPracticeModeIsolation();
      updateHud();
      openModal(`
        <div class="drawer-mural-banner" style="height:94px;">
          <img src="${ART.banner_celestial_spire}" alt="练习演武完成" />
          <div class="drawer-mural-overlay">
            <div>
              <span class="cinnabar-seal">练习模式 · 演武完成</span>
              <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:4px;">登仙台跳关演武完成（自第 ${startFl} 重天起）</h2>
            </div>
            <button type="button" class="btn-ghost" data-modal-close="1">收卷 ✕</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;text-align:center;padding:6px 0;">
          <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
            <span class="tag-chip">练习模式（无奖不记榜）</span>
            <span class="tag-chip">未发放奇物 / 灵石 / 星魂点</span>
            <span class="tag-chip">未改动登仙榜纪录</span>
          </div>
          <div style="font-size:12px;color:#d6eee8;">若要铭刻天道奇物、领取灵石/星魂点并记入登仙榜纪录，请从【第一重天】开启完整登仙挑战！</div>
          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
            <button type="button" class="btn-gold" data-start-spire="1">🏯 从第一重天完整挑战</button>
            <button type="button" class="btn-jade" data-start-spire="${startFl}">再练第 ${startFl} 重天</button>
            <button type="button" class="btn-ghost" data-action="enter-sanctum">返回听雨洞府</button>
          </div>
        </div>
      `, true);
      return;
    }
    sp.floor += 1;
    showToast(`🎯 练习模式破阵 · 进入第 ${sp.floor}/9 重天（无奇物与奖励）`);
    spawnCelestialSpireFloor();
  }

  function openSpireCurioDraftModal() {
    const sp = arena.celestialSpire;
    if (!game || !sp) return;
    if (isPracticeModeActive() || sp.practiceMode || (sp.startFloor && sp.startFloor > 1)) {
      completeSpirePracticeFloor();
      return;
    }
    const maxLv = PERM_GROWTH_CAPS.spireCurioMaxStack;
    const uncapped = SPIRE_CURIOS.filter(c => getCurioStacks(game, c.id) < maxLv);
    const pool = uncapped.slice().sort(() => Math.random() - 0.5).slice(0, 3);
    const gainLv = (sp.wagerDouble || sp.roomType === "curio_vault") ? 2 : 1;

    openModal(`
      <div class="drawer-mural-banner" style="height:88px;">
        <img src="${ART.banner_celestial_spire}" alt="天道奇物" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">第 ${sp.floor}/9 重天破阵赐宝</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:4px;">三选一 · 参悟太古天道奇物（本次直叠 +${gainLv} 层）</h2>
          </div>
          <span class="tag-chip mythic">单项上限 Lv.${maxLv} · 跨系统共鸣</span>
        </div>
      </div>
      <div class="spire-curio-grid">
        ${pool.length > 0 ? pool.map(c => {
          const curLv = getCurioStacks(game, c.id);
          const nextLv = Math.min(maxLv, curLv + gainLv);
          return `
            <button type="button" class="spire-curio-card" data-pick-curio="${c.id}" data-curio-gain="${gainLv}">
              <div style="display:flex;align-items:center;gap:8px;">
                <img src="${ART[c.art] || ART.icon_blade}" alt="${c.name}" style="width:42px;height:42px;border-radius:10px;object-fit:contain;border:1px solid rgba(216,179,106,0.5);" />
                <div>
                  <strong style="font-family:var(--font-serif);font-size:15px;color:#fff3c4;">${c.name}</strong>
                  <div><span class="tag-chip mythic" style="font-size:10px;">${curLv > 0 ? `Lv.${curLv}/${maxLv} → Lv.${nextLv}/${maxLv}` : `新觉醒 Lv.${nextLv}/${maxLv}`}</span></div>
                </div>
              </div>
              <div style="font-size:11px;color:#70ffe6;font-weight:700;">★ ${c.badge}</div>
              <div style="font-size:10.5px;color:#c8e2dc;line-height:1.42;">${c.desc}</div>
            </button>
          `;
        }).join("") : `
          <button type="button" class="spire-curio-card" style="grid-column:1/-1;" data-pick-curio="__all_capped__" data-curio-gain="0">
            <strong style="font-family:var(--font-serif);font-size:16px;color:#fff3c4;">全部天道奇物已圆满 (Lv.${maxLv}/${maxLv})</strong>
            <div style="font-size:11.5px;color:#70ffe6;">全部 16 件太古奇物皆已叠满至上限 Lv.${maxLv}，点击领取 120 灵石并继续登仙！</div>
          </button>
        `}
      </div>
    `, false);
  }

  function selectSpireCurioAndAdvance(curioId, gainLv = 1) {
    if (!game) return;
    const spCheck = arena.celestialSpire;
    if (isPracticeModeActive() || (spCheck && (spCheck.practiceMode || (spCheck.startFloor && spCheck.startFloor > 1)))) {
      closeModal();
      completeSpirePracticeFloor();
      return;
    }
    if (!game.spireCurios) game.spireCurios = {};
    const maxLv = PERM_GROWTH_CAPS.spireCurioMaxStack;
    const cloudMult = getSpireCloudSeaYieldMult(game);
    const spec = SPIRE_CURIOS.find(x => x.id === curioId);
    const allCappedStones = Math.round(120 * cloudMult);
    if (curioId === "__all_capped__") {
      game.stones += allCappedStones;
    } else if (spec) {
      const prev = getCurioStacks(game, curioId);
      const step = Math.max(1, Math.floor(num(gainLv, 1)));
      game.spireCurios[curioId] = Math.min(maxLv, prev + step);
    }
    const stoneBonus = Math.min(
      PERM_GROWTH_CAPS.curioStoneAlchemyFloorStoneCap,
      getCurioStacks(game, "curio_stone_alchemy") * PERM_GROWTH_CAPS.curioStoneAlchemyFloorStonePerLv
    );
    const floorStones = Math.round((75 + stoneBonus) * cloudMult);
    game.stones += floorStones;
    syncFlyingSwords();
    Sound.fanfare();
    closeModal();

    const sp = arena.celestialSpire;
    if (!sp || !sp.active) {
      saveGame(); updateHud();
      return;
    }
    game.bestSpireFloor = Math.max(game.bestSpireFloor || 0, sp.floor);
    if (!sandboxMode) {
      metaState.bestSpireFloor = Math.max(metaState.bestSpireFloor || 0, sp.floor);
      saveMeta();
    }

    if (sp.floor >= 9) {
      sp.active = false;
      arena.celestialSpire = null;
      game.bonusStarPts = (game.bonusStarPts || 0) + 3;
      const clearStones = Math.round(420 * cloudMult);
      game.stones += clearStones;
      saveGame(); updateHud();
      openModal(`
        <div class="drawer-mural-banner" style="height:94px;">
          <img src="${ART.banner_celestial_spire}" alt="九重登仙" />
          <div class="drawer-mural-overlay">
            <div>
              <span class="cinnabar-seal">登仙金榜 · 九重天圆满</span>
              <h2 style="font-family:var(--font-serif);font-size:22px;color:var(--gold-bright);margin-top:4px;">踏破太虚登仙台九重天 · 证道混元仙尊！</h2>
            </div>
            <button type="button" class="btn-ghost" data-modal-close="1">凯旋收卷 ✕</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;text-align:center;padding:6px 0;">
          <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
            <span class="tag-chip mythic">制霸层数：9 / 9 重天</span>
            <span class="tag-chip done">奇物总层数：${Object.values(game.spireCurios || {}).reduce((a, b) => a + Math.min(maxLv, num(b, 0)), 0)} 层</span>
            <span class="tag-chip">赏赐：${clearStones} 灵石${cloudMult > 1 ? "（含破云印+15%）" : ""} + 周天星魂点 +3</span>
          </div>
          <div style="font-size:12px;color:#9effec;">本局参悟的全部【太古天道奇物】已永久铭刻入本世命盘（单项上限 Lv.${maxLv}），可携奇物神威继续征战太古烛龙与九霄云海！</div>
          <div style="display:flex;justify-content:center;gap:10px;">
            <button type="button" class="btn-gold" data-start-spire="1">🏯 再登九重天叠奇物</button>
            <button type="button" class="btn-ghost" data-action="enter-sanctum">返回听雨洞府</button>
          </div>
        </div>
      `, true);
      return;
    }

    sp.floor += 1;
    showToast(curioId === "__all_capped__"
      ? `☯ 奇物皆已圆满 · 获赐 ${allCappedStones + floorStones} 灵石${cloudMult > 1 ? "（破云印+15%）" : ""}，踏入第 ${sp.floor}/9 重天！`
      : `☯ 已铭刻奇物【${spec ? spec.name : curioId} Lv.${getCurioStacks(game, curioId)}/${maxLv}】· 灵石 +${floorStones}${cloudMult > 1 ? "（破云印+15%）" : ""} · 踏入第 ${sp.floor}/9 重天！`);
    spawnCelestialSpireFloor();
    saveGame();
  }

  // ==================== PILLAR 4B: INTERACTIVE CODEX MOVE & WEAKNESS SHOWCASE (`万象博物志 · 招式动态鉴赏台`) ====================
  const CODEX_SHOWCASE_ITEMS = [
    { id: "zhulong",  cat: "首领", name: "太古烛龙·法相", art: "boss_zhulong_titan",    color: "#ffae33", moveName: "眉心竖眼·灭世横扫 & 覆海拍击", guide: "破招拆解：切 2 键【龙胆裂空剑枪】或玄重巨阙先破左右双臂护甲，趁其瘫痪伏地触发【御剑登天·踏躯逆鳞斩】贯碎天眼！" },
    { id: "sky_roc",  cat: "首领", name: "巡天金甲雷鹏将", art: "enemy_roc_sky_general", color: "#80ecff", moveName: "天雷激光网 & 紫电七星弹幕",     guide: "破招拆解：九霄云海空战中按空格【滚筒侧闪】无伤穿过激光网，按右键开启【太虚剑盾】将漫天雷球 2.4 倍速原路震回！" },
    { id: "demon",    cat: "首领", name: "太虚心魔镜像", art: "actor_inner_demon",     color: "#d69eff", moveName: "双姿态易剑斩 & 暗金【擒】投技", guide: "破招拆解：见暗金【⬢擒】字蓄力时切勿后退，直接出重击/易剑斩正面触发 1.2s【剑罡拼刀角力】崩碎其百点架势！" },
    { id: "player",   cat: "可控", name: "顾长青·六象剑主", art: "actor_player_battle", color: "#4ad2b8", moveName: "三器×双姿·六象神兵觉醒技",     guide: "操控精要：1/2/3 秒切飞剑/龙胆枪/回旋轮，配合 ` 疾剑/巨阙双姿派生【游龙刺/巨阙开天/百鸟朝凤/破军挑山/日月旋涡/乾坤重锯】！" },
    { id: "shen",     cat: "可控", name: "沈清禾·青莲剑", art: "actor_shen",           color: "#70ffe6", moveName: "青莲净世剑澜 & 双人合璧阵",     guide: "操控精要：残血时按 V 瞬切沈清禾立即触发净厄护心盾，同心满 100% 点【💞合璧】释放双立绘全屏【青莲万剑净世阵】！" },
    { id: "pei",      cat: "可控", name: "裴照·惊鸿重枪", art: "actor_pei",            color: "#80ecff", moveName: "惊鸿破军龙枪 & 十字诛神合璧",   guide: "操控精要：裴照普攻与入场技自带超高削韧，双人合璧【惊鸿破界诛神枪】可直接清零全场妖王架势条进入处决态！" }
  ];
  let codexSelectedId = "zhulong";
  let codexDemoAnimT = 1.0;
  let codexRafId = null;
  const codexImgCache = {};

  function startCodexLiveLoop() {
    if (codexRafId) cancelAnimationFrame(codexRafId);
    const tick = () => {
      const cv = document.getElementById("codex-live-canvas");
      if (!cv || !document.getElementById("modal-backdrop").classList.contains("open") || currentSysTab !== "compendium") {
        codexRafId = null;
        return;
      }
      const cctx = cv.getContext("2d");
      const cw = cv.width, ch = cv.height;
      cctx.clearRect(0, 0, cw, ch);
      const now = performance.now() * 0.001;
      const spec = CODEX_SHOWCASE_ITEMS.find(x => x.id === codexSelectedId) || CODEX_SHOWCASE_ITEMS[0];

      // Subtle isometric grid + Bagua ring
      cctx.save();
      cctx.strokeStyle = "rgba(112, 255, 230, 0.22)";
      cctx.lineWidth = 1.2;
      cctx.beginPath(); cctx.ellipse(cw * 0.5, ch * 0.76, 68, 22, 0, 0, Math.PI * 2); cctx.stroke();
      cctx.restore();

      // Sprite preview
      const im = codexImgCache[spec.art];
      if (!im && ART[spec.art]) {
        const imgObj = new Image();
        imgObj.src = ART[spec.art];
        codexImgCache[spec.art] = imgObj;
      }
      const readyIm = codexImgCache[spec.art];
      const bob = Math.sin(now * 4.2) * 4;
      const lunge = codexDemoAnimT < 1 ? Math.sin(codexDemoAnimT * Math.PI) * 24 : 0;
      if (readyIm && readyIm.complete) {
        const sz = spec.id === "zhulong" ? 112 : 88;
        cctx.drawImage(readyIm, cw * 0.44 - sz / 2 + lunge * 0.4, ch * 0.50 - sz / 2 + bob, sz, sz);
      }

      // Live Demo Slash / Telegraph / Laser Animation!
      if (codexDemoAnimT < 1) {
        codexDemoAnimT = Math.min(1, codexDemoAnimT + 0.032);
        drawSmoothInkSilkRibbon(cctx, {
          x: cw * 0.50, y: ch * 0.54, ang: -0.25 + codexDemoAnimT * 0.5,
          r: 68, color: spec.color, dir: 1, heavy: true,
          form: spec.id === "pei" ? "spear_thrust" : "arc", t: codexDemoAnimT * 0.65
        });
        if (spec.cat === "首领") {
          cctx.save();
          cctx.globalCompositeOperation = "lighter";
          cctx.strokeStyle = spec.color;
          cctx.lineWidth = 5 * (1 - codexDemoAnimT);
          cctx.beginPath();
          cctx.moveTo(cw * 0.46, ch * 0.34);
          cctx.lineTo(cw * 0.94, ch * (0.25 + codexDemoAnimT * 0.5));
          cctx.stroke();
          cctx.restore();
        }
        cctx.font = "bold 11px sans-serif";
        cctx.fillStyle = "#fff5c0";
        cctx.textAlign = "center";
        cctx.fillText(`⚡ ${spec.moveName}`, cw * 0.5, 18);
      } else {
        cctx.font = "bold 10.5px sans-serif";
        cctx.fillStyle = spec.color;
        cctx.textAlign = "center";
        cctx.fillText(`◎ ${spec.name} · 点击右侧【演武演示】观摩`, cw * 0.5, 18);
      }
      codexRafId = requestAnimationFrame(tick);
    };
    codexRafId = requestAnimationFrame(tick);
  }
