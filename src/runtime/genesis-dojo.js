  // ==================== V24 GENESIS COLLECTOR'S EDITION MODULES ====================
  // 1. Custom 4-Step Cross-Weapon Combo Sequencer (`太虚创招谱 · 四段三器自由混编器`)
  const COMBO_SEQ_MODULES = {
    sword_crescent:    { id: "sword_crescent",    form: "sword",   short: "飞剑·斜月斩",   name: "飞剑 · 斜月青霜斩",   color: "#70ffe6", desc: "迅捷破空青霜剑气，叠印+1并瞬步贴近" },
    sword_twindragon:  { id: "sword_twindragon",  form: "sword",   short: "飞剑·双龙剪",   name: "飞剑 · 双龙剪影斩",   color: "#ffe28a", desc: "双道交叉虹光剑气，回复剑元与剑意" },
    spear_flurry:      { id: "spear_flurry",      form: "spear",   short: "龙枪·百鸟刺",   name: "龙胆枪 · 百鸟幻影刺", color: "#ffd166", desc: "230px 五道扇形破甲枪芒，瞬碎护盾" },
    spear_sweep:       { id: "spear_sweep",       form: "spear",   short: "龙枪·盘龙扫",   name: "龙胆枪 · 盘龙裂地扫", color: "#ffb84d", desc: "大范围盘龙横扫崩势，击退并叠2层剑印" },
    chakram_twin:      { id: "chakram_twin",      form: "chakram", short: "剑轮·双月切",   name: "回旋轮 · 双月疾风切", color: "#80ffea", desc: "攻速+35% 双月回旋切割，灵巧游身" },
    chakram_vortex:    { id: "chakram_vortex",    form: "chakram", short: "剑轮·引力旋",   name: "回旋轮 · 引力黑洞旋", color: "#d69eff", desc: "投出悬停引力锯杀剑轮，持续聚拢群妖" },
    sword_lotus:       { id: "sword_lotus",       form: "sword",   short: "飞剑·青莲星",   name: "飞剑 · 青莲落星剑舞", color: "#4ad2b8", desc: "八方青莲剑芒齐绽，直接引爆剑印" },
    spear_starfall:    { id: "spear_starfall",    form: "spear",   short: "龙枪·挑山贯",   name: "龙胆枪 · 破军挑山贯", color: "#ff9f43", desc: "挑飞敌群浮空并震裂地面，双倍削韧" },
    greatsword_cleave: { id: "greatsword_cleave", form: "sword",   short: "巨阙·开天斩",   name: "巨阙 · 开天裂穹重劈", color: "#ffe28a", desc: "霸体十丈鎏金巨剑重劈，撕裂3秒太初剑痕" }
  };

  const COMBO_SEQ_PRESETS = [
    { id: "hunyuan_master", name: "☯ 混元三器皇道谱", slots: ["sword_crescent", "spear_flurry", "chakram_vortex", "greatsword_cleave"], desc: "1段飞剑斜月 → 2段龙枪百鸟刺 → 3段剑轮引力聚怪 → 4段巨阙开天斩" },
    { id: "storm_breaker",  name: "⚡ 疾风碎甲破军谱", slots: ["chakram_twin", "spear_flurry", "spear_sweep", "sword_lotus"],           desc: "1段双月疾切 → 2段百鸟破盾 → 3段盘龙大扫 → 4段青莲八方剑舞" },
    { id: "sky_ascension",  name: "☄ 挑空引力绝杀谱", slots: ["sword_twindragon", "chakram_vortex", "spear_starfall", "greatsword_cleave"], desc: "1段双龙回元 → 2段剑轮黑洞聚拢 → 3段龙枪挑飞 → 4段巨阙坠天劈" }
  ];

  const DEFAULT_COMBO_SEQ_SLOTS = ["sword_crescent", "spear_flurry", "chakram_vortex", "greatsword_cleave"];
  function ensureCustomComboSeq(g) {
    if (!g) return { enabled: false, slots: DEFAULT_COMBO_SEQ_SLOTS.slice(), morphCount: 0 };
    const rawSeq = (g.customComboSeq && typeof g.customComboSeq === "object" && !Array.isArray(g.customComboSeq)) ? g.customComboSeq : null;
    const seqHasUnsafeKey = !!(rawSeq && (hasOwn(rawSeq, "__proto__") || hasOwn(rawSeq, "constructor") || hasOwn(rawSeq, "prototype")));
    const rawSlots = (rawSeq && Array.isArray(rawSeq.slots) && rawSeq.slots.length === 4) ? rawSeq.slots : DEFAULT_COMBO_SEQ_SLOTS;
    const safeSlots = rawSlots.map((modId, idx) => hasOwn(COMBO_SEQ_MODULES, modId) ? modId : DEFAULT_COMBO_SEQ_SLOTS[idx]);
    const enabled = !!(rawSeq && rawSeq.enabled);
    const morphCount = Math.max(0, Math.floor(num(rawSeq && rawSeq.morphCount, 0)));
    if (!rawSeq || Object.getPrototypeOf(rawSeq) !== Object.prototype || seqHasUnsafeKey ||
        rawSeq.enabled !== enabled || rawSeq.morphCount !== morphCount ||
        !Array.isArray(rawSeq.slots) || rawSeq.slots.length !== 4 ||
        rawSlots.some((m, i) => m !== safeSlots[i])) {
      g.customComboSeq = { enabled, slots: safeSlots, morphCount };
    }
    return g.customComboSeq;
  }

  function executeComboSequencerModule(modId, sx, sy, ang, st, isEcho = false, echoColor = null) {
    const mod = hasOwn(COMBO_SEQ_MODULES, modId) ? COMBO_SEQ_MODULES[modId] : COMBO_SEQ_MODULES.sword_crescent;
    const col = echoColor || mod.color;
    const dmgScale = (isEcho ? 0.55 : 1.0) * (1 + (game ? getSanctumBonuses(game).seqDmgBonus : 0));

    if (!isEcho && game) {
      const seq = ensureCustomComboSeq(game);
      if (game.weaponForm !== mod.form) {
        game.weaponForm = mod.form;
        seq.morphCount = (seq.morphCount || 0) + 1;
        syncTagTeamHud();
      }
      registerStyleAction("seq_mix", 58);
      pushTelemetryInput(`🎼${mod.short}`, false);
    }

    if (mod.id === "sword_crescent" || mod.id === "sword_twindragon") {
      const twin = mod.id === "sword_twindragon";
      pushBladeArc(sx + Math.cos(ang) * 22, sy + Math.sin(ang) * 14, ang - (twin ? 0.16 : 0), 108, col, 1, false);
      if (twin) pushBladeArc(sx + Math.cos(ang) * 22, sy + Math.sin(ang) * 14, ang + 0.16, 108, "#ffe28a", -1, false);
      (twin ? [-0.12, 0.12] : [0]).forEach(off => {
        const a = ang + off;
        arena.projectiles.push({
          friendly: true, kind: "crescent", x: sx + Math.cos(a) * 28, y: sy + Math.sin(a) * 22,
          vx: Math.cos(a) * 15.0, vy: Math.sin(a) * 15.0, ang: a, r: 62,
          dmg: Math.round(st.atk * 1.28 * dmgScale), postureDmg: 14, knock: 5, addMark: 1, life: 0.48, pierced: new Set(), color: col
        });
      });
    } else if (mod.id === "spear_flurry") {
      [-0.24, -0.12, 0, 0.12, 0.24].forEach((off, idx) => {
        const a = ang + off;
        const reach = 228;
        if (idx % 2 === 0) pushBladeArc(sx, sy, a, reach * 0.72, col, idx === 2 ? 1 : -1, true, "spear_thrust");
        arena.blinkStreaks.push({ x1: sx, y1: sy - 8, x2: sx + Math.cos(a) * reach, y2: sy + Math.sin(a) * reach * 0.65 - 8, t: 0, color: col });
      });
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - (sx + Math.cos(ang) * 105), e.y - (sy + Math.sin(ang) * 68)) < e.r + 138) {
          if ((e.frontShieldHp || 0) > 0) e.frontShieldHp = 0;
          e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
          damageEnemy(e, Math.round(st.atk * 1.72 * dmgScale), true, 32, ang, 8, true);
        }
      });
    } else if (mod.id === "spear_sweep" || mod.id === "spear_starfall") {
      const launch = mod.id === "spear_starfall";
      pushBladeArc(sx + Math.cos(ang) * 28, sy + Math.sin(ang) * 18, ang, 168, col, 1, true);
      pushBladeArc(sx + Math.cos(ang) * 28, sy + Math.sin(ang) * 18, ang, 146, "#ffffff", -1, true);
      spawnDistortionRing(sx + Math.cos(ang) * 44, sy + Math.sin(ang) * 26, 180, col);
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - sx, e.y - sy) < e.r + 188) {
          if (launch) { e.airborneZ = 46; e.airborneVz = 5.4; }
          e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
          damageEnemy(e, Math.round(st.atk * 1.95 * dmgScale), true, 38, ang, 12, true);
        }
      });
    } else if (mod.id === "chakram_twin" || mod.id === "chakram_vortex") {
      const vortex = mod.id === "chakram_vortex";
      pushBladeArc(sx + Math.cos(ang) * 20, sy + Math.sin(ang) * 12, ang - 0.24, 106, col, 1, vortex);
      pushBladeArc(sx + Math.cos(ang) * 20, sy + Math.sin(ang) * 12, ang + 0.24, 106, "#80ffea", -1, vortex);
      const hx = sx + Math.cos(ang) * 124, hy = sy + Math.sin(ang) * 78;
      if (!arena.hoverChakrams) arena.hoverChakrams = [];
      arena.hoverChakrams.push({
        x: hx, y: hy, r: vortex ? 96 : 68, rot: 0, life: vortex ? 2.5 : 1.3, tickCd: 0.05,
        dmg: Math.max(8, Math.round(st.atk * 0.68 * dmgScale)), color: col
      });
      if (arena.hoverChakrams.length > 6) arena.hoverChakrams.shift();
      if (vortex) {
        arena.enemies.forEach(e => {
          if (e.hp > 0 && Math.hypot(e.x - hx, e.y - hy) < 220) {
            e.x += (hx - e.x) * 0.26;
            e.y += (hy - e.y) * 0.26;
          }
        });
      }
    } else if (mod.id === "sword_lotus") {
      for (let k = 0; k < 8; k++) {
        const a = (Math.PI * 2 * k) / 8;
        pushBladeArc(sx, sy, a, 126, k % 2 === 0 ? col : "#ffe28a", k % 2 === 0 ? 1 : -1, true);
      }
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - sx, e.y - sy) < e.r + 178) {
          const bonus = (e.swordMarks || 0) * 0.25;
          e.swordMarks = 0;
          damageEnemy(e, Math.round(st.atk * (1.85 + bonus) * dmgScale), true, 30, Math.atan2(e.y - sy, e.x - sx), 9, true);
        }
      });
    } else if (mod.id === "greatsword_cleave") {
      if (!isEcho) arena.player.hyperArmorTimer = Math.max(arena.player.hyperArmorTimer || 0, 0.55);
      const cx = sx + Math.cos(ang) * 86, cy = sy + Math.sin(ang) * 52;
      pushBladeArc(sx + Math.cos(ang) * 34, sy + Math.sin(ang) * 20, ang, 198, col, 1, true);
      pushBladeArc(sx + Math.cos(ang) * 34, sy + Math.sin(ang) * 20, ang, 172, "#ffffff", -1, true);
      addDecal(cx, cy + 12, ang, 92, "spider_crack");
      spawnDistortionRing(cx, cy, 195, col);
      if (!isEcho) {
        if (!arena.spatialRifts) arena.spatialRifts = [];
        arena.spatialRifts.push({ x: cx, y: cy, ang, len: 180, life: 3.0, maxLife: 3.0, tickCd: 0.08, sliceHits: 0 });
      }
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - cx, e.y - cy) < e.r + 185) {
          e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
          damageEnemy(e, Math.round(st.atk * 2.45 * dmgScale), true, 48, ang, 14, true);
        }
      });
    }
    if (!isEcho) addFloat(`🎼 ${mod.short}！`, sx, sy - 58, col, 16, true);
  }

  function openComboSequencerModal() {
    if (!game) return;
    if (!guardActionRealm("sequencer")) return;
    notifyUnlockCardTried("sequencer");
    closeDrawer();
    const seq = ensureCustomComboSeq(game);
    const stepTitles = ["第壹段 · 起手破风", "第贰段 · 衔接承转", "第叁段 · 聚势控场", "第肆段 · 乾坤终结"];
    openModal(`
      <div class="drawer-mural-banner" style="height:84px;">
        <img src="${ART.weapon_arsenal_trio}" alt="太虚创招谱" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">三器混编 · 挥击瞬化</span>
            <h2 style="font-family:var(--font-serif);font-size:19.5px;color:var(--gold-bright);margin-top:2px;">🎼 太虚创招谱 · 四段三器自由混编剑诀台</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">返回道场 ✕</button>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <div style="font-size:11.5px;color:#9effec;">启用后每次左键挥砍将按 1→4 段顺序自动无缝幻化【飞剑 / 龙胆枪 / 回旋剑轮】并同步驱动三清法身复刻！</div>
        <button type="button" id="btn-toggle-seq-enable" class="btn-gold" style="padding:5px 14px;font-size:12px;" data-action="toggle-seq-enable">${seq.enabled ? "★ 混元自创剑谱：运行中 ✓" : "○ 点击启用混元自创剑谱"}</button>
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${COMBO_SEQ_PRESETS.map(pr => `<button type="button" class="btn-ghost" style="padding:4px 10px;font-size:11px;" data-seq-preset="${pr.id}" data-tip="${escTip(pr.name, pr.desc)}">${pr.name}</button>`).join("")}
      </div>

      <div class="seq-slot-grid">
        ${seq.slots.map((modId, idx) => {
          const curM = hasOwn(COMBO_SEQ_MODULES, modId) ? COMBO_SEQ_MODULES[modId] : COMBO_SEQ_MODULES.sword_crescent;
          const wfSpec = hasOwn(WEAPON_ARSENAL_SPECS, curM.form) ? WEAPON_ARSENAL_SPECS[curM.form] : WEAPON_ARSENAL_SPECS.sword;
          return `<div class="seq-slot-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="font-size:12px;color:${curM.color};">${stepTitles[idx]}</strong>
              <span class="tag-chip done">${wfSpec.short}</span>
            </div>
            <select class="workshop-select" data-seq-slot="${idx}">
              ${Object.values(COMBO_SEQ_MODULES).map(m => `<option value="${m.id}" ${m.id === curM.id ? "selected" : ""}>${m.name}</option>`).join("")}
            </select>
            <span style="font-size:10.5px;color:#b8dcd5;">${curM.desc}</span>
          </div>`;
        }).join("")}
      </div>
    `, true);
  }

  // 2. Pillar 1: Tri-Clone Phantom Resonance (`一气化三清 · 80ms/160ms 身外法身三影同击 + 移形归元合击`)
  function ensureSanqingState() {
    if (!arena.sanqingState) {
      arena.sanqingState = {
        active: false,
        life: 0,
        maxLife: 12.0,
        echoHitCount: 0,
        swapCount: 0,
        clones: [
          { id: "yuqing",    name: "玉清青莲法身", art: "clone_yuqing_cyan",      color: "#70ffe6", delay: 0.080, ox: -66, oy: 18, x: 600, y: 500, facing: 1, lungeT: 0 },
          { id: "shangqing", name: "上清紫电法身", art: "clone_shangqing_violet", color: "#d69eff", delay: 0.160, ox:  66, oy: 18, x: 740, y: 500, facing: 1, lungeT: 0 }
        ]
      };
    }
    if (!arena.sanqingEchoQueue) arena.sanqingEchoQueue = [];
    return arena.sanqingState;
  }

  function enqueueSanqingEchoAction(kind, payload = {}) {
    const sq = ensureSanqingState();
    if (!sq.active) return;
    sq.clones.forEach((cl, idx) => {
      arena.sanqingEchoQueue.push({
        ttl: cl.delay, // Exact 80ms (0.080s) for Yuqing & 160ms (0.160s) for Shangqing!
        cloneIdx: idx,
        kind,
        ...payload
      });
    });
  }

  function triggerSanqingTriClones() {
    if (!game) return false;
    if (!guardActionRealm("sanqing")) return false;
    notifyUnlockCardTried("sanqing");
    const sq = ensureSanqingState();
    const p = arena.player;
    const st = getCombatStats(game);

    // If ALREADY active -> Execute 2nd-Stage 【移形换位 · 三清归元十字穿心合击】 (once per activation)!
    if (sq.active && sq.life > 0.2) {
      if (sq.swapUsed) {
        showToast("本次一气化三清的【移形归元斩】已施放！");
        return false;
      }
      sq.swapUsed = true;
      const cv = document.getElementById("fx-canvas");
      const w = (cv && cv.width) || 1440, h = (cv && cv.height) || 900;
      const foe = arena.enemies.find(e => e.hp > 0 && !e.isTreasure) || arena.enemies[0];
      const ang = foe ? Math.atan2(foe.y - p.y, foe.x - p.x) : (p.facing >= 0 ? 0 : Math.PI);
      const leadClone = sq.clones[0];
      const forwardPos = foe
        ? clampToPlaza(foe.x + Math.cos(ang) * 76, foe.y + Math.sin(ang) * 44, w, h)
        : clampToPlaza(p.x + Math.cos(ang) * 150, p.y + Math.sin(ang) * 86, w, h);

      // Instant Position Swap between Player and Forward Yuqing Clone!
      const oldPx = p.x, oldPy = p.y;
      arena.blinkStreaks.push({ x1: oldPx, y1: oldPy, x2: forwardPos.x, y2: forwardPos.y, t: 0, color: "#70ffe6" });
      arena.blinkStreaks.push({ x1: sq.clones[1].x, y1: sq.clones[1].y, x2: forwardPos.x, y2: forwardPos.y, t: 0, color: "#d69eff" });
      leadClone.x = oldPx;
      leadClone.y = oldPy;
      p.x = forwardPos.x;
      p.y = forwardPos.y;
      p.invuln = Math.max(p.invuln || 0, 0.65);
      sq.swapCount = (sq.swapCount || 0) + 1;

      const cx = foe ? foe.x : p.x, cy = foe ? foe.y : p.y;
      [0, Math.PI / 3, (Math.PI * 2) / 3].forEach((ca, idx) => {
        pushBladeArc(cx, cy - 10, ca, 205, idx === 0 ? "#ffe28a" : idx === 1 ? "#70ffe6" : "#d69eff", idx % 2 === 0 ? 1 : -1, true);
      });
      spawnDistortionRing(cx, cy, 250, "#70ffe6");
      triggerRadialChromaticBurst(1.38, "#d69eff", cx, cy - 16);
      Sound.coreSeverBoom();
      Sound.switchStanceChime(true);
      registerStyleAction("sanqing_swap", 185);
      pushTelemetryInput("☯移形·三清归元斩!", false);

      const burstDmg = Math.round(st.atk * 2.45);
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - cx, e.y - cy) < e.r + 225) {
          e.swordMarks = 6;
          damageEnemy(e, burstDmg, true, 46, Math.atan2(e.y - cy, e.x - cx), 12, true);
        }
      });
      triggerKillCamStamp("三清归元");
      addFloat("☯ 移形换位 ·【三清归元十字穿心斩】！！", p.x, p.y - 76, "#80ffea", 22, true);
      captureBattleHighlightFrame("三清归元", "一气化三清·移形归元十字斩", burstDmg, 5);
      syncV24GenesisDock();
      updateHud();
      return true;
    }

    if ((arena.sanqingCd || 0) > 0) {
      showToast(`一气化三清调息中 (${arena.sanqingCd.toFixed(1)}s)`);
      return false;
    }
    if (!consumePlayerMp(32, "一气化三清")) return false;
    arena.sanqingCd = 24.0;

    // Activate 10s Tri-Clone Phantom Resonance!
    sq.active = true;
    sq.swapUsed = false;
    sq.life = 10.0;
    sq.maxLife = 10.0;
    sq.clones[0].x = p.x - 66; sq.clones[0].y = p.y + 18; sq.clones[0].facing = p.facing;
    sq.clones[1].x = p.x + 66; sq.clones[1].y = p.y + 18; sq.clones[1].facing = p.facing;
    arena.sanqingEchoQueue = [];

    Sound.fanfare();
    Sound.bianzhong(659.25, 0.12);
    spawnDistortionRing(p.x, p.y, 215, "#70ffe6");
    triggerRadialChromaticBurst(1.15, "#80ffea", p.x, p.y - 20);
    registerStyleAction("sanqing", 155);
    pushTelemetryInput("☯一气化三清·双法身降临!", false);
    showBossCutIn("clone_yuqing_cyan", "无上神通 ·【一气化三清】", "玉清青莲(80ms)与上清紫电(160ms)双法身同步复刻万般剑诀；再按 4 键瞬发【移形换位·三清归元斩】！", { isPlayerUlt: true, cutInKey: "ult_sanqing" });
    addFloat("☯ 一气化三清 · 玉清/上清法身同击 (12s)！", p.x, p.y - 72, "#80ffea", 20, true);
    syncV24GenesisDock();
    updateHud();
    return true;
  }

  function executeSingleSanqingEcho(ev, st) {
    const sq = ensureSanqingState();
    const cl = sq.clones[ev.cloneIdx];
    if (!cl || !game) return;
    cl.lungeT = 0.24;
    const ang = typeof ev.ang === "number" ? ev.ang : (arena.player.facing >= 0 ? 0 : Math.PI);
    cl.facing = Math.cos(ang) >= 0 ? 1 : -1;
    cl.x = arena.player.x + cl.ox + Math.cos(ang) * 26;
    cl.y = arena.player.y + cl.oy + Math.sin(ang) * 16 - (arena.player.z || 0) * 0.8;
    sq.echoHitCount = (sq.echoHitCount || 0) + 1;

    if (ev.kind === "seq_module" && ev.modId) {
      executeComboSequencerModule(ev.modId, cl.x, cl.y, ang, st, true, cl.color);
      return;
    }
    if (ev.kind === "six_aspect" || ev.kind === "switch_slash" || ev.kind === "meteor_plunge") {
      pushBladeArc(cl.x + Math.cos(ang) * 28, cl.y + Math.sin(ang) * 16, ang, 168, cl.color, ev.cloneIdx === 0 ? 1 : -1, true);
      spawnDistortionRing(cl.x + Math.cos(ang) * 42, cl.y + Math.sin(ang) * 24, 145, cl.color);
      arena.enemies.slice().forEach(e => {
        if (e.hp > 0 && Math.hypot(e.x - cl.x, e.y - cl.y) < e.r + 185) {
          e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
          damageEnemy(e, Math.round(st.atk * 1.35), true, 22, ang, 6, true);
        }
      });
      return;
    }
    // Standard Light / Spear / Chakram / Aerial Echo Slash -> weaves 3-Layer Overlapping Catmull-Rom Silk Ribbons!
    pushBladeArc(cl.x + Math.cos(ang) * 24, cl.y + Math.sin(ang) * 14, ang + (ev.cloneIdx === 0 ? -0.14 : 0.14), 124, cl.color, ev.cloneIdx === 0 ? 1 : -1, ev.step >= 2, ev.wForm === "spear" ? "spear_thrust" : "arc");
    arena.enemies.slice().forEach(e => {
      if (e.hp > 0 && Math.hypot(e.x - (cl.x + Math.cos(ang) * 64), e.y - (cl.y + Math.sin(ang) * 38)) < e.r + 142) {
        if (cl.id === "shangqing") arena.skyBolts.push({ x: e.x, y: e.y, t: 0, color: "#d69eff" });
        e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
        damageEnemy(e, Math.max(8, Math.round(st.atk * 0.72)), ev.step === 3, 14, ang, 3.5, false);
      }
    });
  }

  // 3. Pillar 2: Shanhe Sheji Scroll Ink-Dimension Domain (`山河社稷图 · 10秒青绿画中界 + 九字真言破画万钧斩`)
  const NINE_MANTRAS = ["临", "兵", "斗", "者", "皆", "阵", "列", "在", "前"];

  function castShanheShejiDomain() {
    if (!game) return false;
    if (!guardActionRealm("shanhe")) return false;
    notifyUnlockCardTried("shanhe");
    if (arena.shanheDomain && arena.shanheDomain.active && arena.shanheDomain.mantras.length >= 3) {
      detonateShanheScrollBreak();
      return true;
    }
    if ((arena.shanheCd || 0) > 0) {
      showToast(`山河社稷图调息中 (${arena.shanheCd.toFixed(1)}s)`);
      return false;
    }
    if (!consumePlayerMp(36, "山河社稷图")) return false;
    arena.shanheCd = 28.0;
    arena.shanheDomain = {
      active: true,
      life: 10.0,
      maxLife: 10.0,
      mantras: []
    };
    document.body.setAttribute("data-shanhe-domain", "1");
    arena.enemies.forEach(e => {
      if (e.hp > 0) e.chillTimer = Math.max(e.chillTimer || 0, 10.0);
    });
    Sound.fanfare();
    Sound.bianzhong(523.25, 0.14);
    spawnDistortionRing(arena.player.x, arena.player.y, 320, "#ffe28a");
    showBossCutIn("scroll_shanhe_sheji", "创世至宝 ·【山河社稷图】展开", "群妖已摄入太古青绿画中界（移速-42%·破防+30%）！挥剑烙印【临兵斗者皆阵列在前】九字破画！", { isPlayerUlt: true, cutInKey: "ult_shanhe" });
    addFloat("🏞 山河社稷图 ·【青绿山水画中界】展开 (10s)！", arena.player.x, arena.player.y - 78, "#ffe28a", 21, true);
    syncV24GenesisDock();
    updateHud();
    return true;
  }

  function stampNextShanheMantra(x, y) {
    const sd = arena.shanheDomain;
    if (!sd || !sd.active) return;
    const idx = sd.mantras.length;
    if (idx >= NINE_MANTRAS.length) {
      detonateShanheScrollBreak();
      return;
    }
    const ch = NINE_MANTRAS[idx];
    const ang = (idx / 9) * Math.PI * 2 - Math.PI / 2;
    sd.mantras.push({
      ch,
      x: x + Math.cos(ang) * 68,
      y: y - 36 + Math.sin(ang) * 42,
      t: 0
    });
    Sound.bianzhong(523.25 + idx * 42, 0.07);
    addFloat(`🖌 真言烙印 ·【${ch}】(${sd.mantras.length}/9)`, x, y - 64, "#ffd166", 17, true);
    syncV24GenesisDock();
    if (sd.mantras.length >= 9) {
      detonateShanheScrollBreak();
    }
  }

  function detonateShanheScrollBreak() {
    const sd = arena.shanheDomain;
    if (!sd || !sd.active || !game) return false;
    const count = Math.max(1, sd.mantras.length);
    sd.active = false;
    arena.shanheDomain = null;
    document.body.removeAttribute("data-shanhe-domain");

    const p = arena.player;
    const st = getCombatStats(game);
    const totalMult = 2.0 + count * 0.24; // Up to 4.16x ATK at 9/9 Mantras!
    const totalDmg = Math.round(st.atk * totalMult);

    Sound.coreSeverBoom();
    Sound.fanfare();
    GamepadSystem.rumble(1.0, 0.95, 320);
    triggerImpactFrame(4, "#ffe28a", p.x, p.y - 24);
    triggerRadialChromaticBurst(1.6, "#ffe28a", p.x, p.y - 20);
    spawnDistortionRing(p.x, p.y, 380, "#ffe28a");
    for (let k = 0; k < 9; k++) {
      const a = (Math.PI * 2 * k) / 9;
      pushBladeArc(p.x, p.y - 12, a, 240, k % 2 === 0 ? "#ffe28a" : "#70ffe6", k % 2 === 0 ? 1 : -1, true);
    }
    arena.enemies.slice().forEach(e => {
      if (e.hp > 0) {
        e.wardHp = 0;
        e.frontShieldHp = 0;
        e.swordMarks = 6;
        damageEnemy(e, totalDmg, true, 75, Math.atan2(e.y - p.y, e.x - p.x), 16, true);
      }
    });
    registerStyleAction("shanhe", 240);
    triggerKillCamStamp("笔落惊风");
    addFloat(`🖌 笔落惊风雨 ·【九字破画万钧斩】-${totalDmg}！！`, p.x, p.y - 92, "#fff2a8", 25, true);
    captureBattleHighlightFrame("笔落惊风", `山河社稷图·${count}字真言破画斩`, totalDmg, 5);
    syncV24GenesisDock();
    updateHud();
    return true;
  }

  // 4. Pillar 3: Lingxiao Celestial Warship Orbital Strike (`听雨凌霄仙舟·天基齐射`) & Jiuzhou Spirit-Vein Expedition Sandbox (`九州灵脉远征沙盘`)
  const EXPEDITION_NODES = [
    { id: "qinglan_vein",  name: "青岚灵泉矿脉", art: "arena_sanctum_hub",    stoneRate: 18, desc: "每轮产出灵石+18 · 宗门护道青雷支援" },
    { id: "qingyun_peak",  name: "青云古剑仙台", art: "arena_sect",    stoneRate: 26, desc: "每轮产出灵石+26 · 飞剑天基协同剑雨" },
    { id: "zhaoying_lake", name: "照影玄冰灵渊", art: "arena_secret",  stoneRate: 34, desc: "每轮产出灵石+34 · 寒魄护道冰雷震慑" },
    { id: "suoyao_altar",  name: "锁妖古塔灵枢", art: "arena_tower",   stoneRate: 42, desc: "每轮产出灵石+42 · 高概率凝结鸿蒙星魄" },
    { id: "jiuxiao_sky",   name: "九霄星河天脉", art: "arena_terrace", stoneRate: 56, desc: "每轮产出灵石+56 · 必凝鸿蒙星魄与紫霄神雷" }
  ];
  const EXPEDITION_BANKED_STONES_CAP = 600;
  const EXPEDITION_BANKED_STARS_CAP = 5;

  const GARRISON_ROSTER = [
    { id: "shen",    name: "沈清禾",   role: "青云药庐 · 悬壶医修" },
    { id: "pei",     name: "裴照",     role: "青云剑阁 · 同辈剑首" },
    { id: "lu",      name: "陆玄松",   role: "青云山门 · 传功执事" },
    { id: "yan",     name: "砚尘",     role: "照影古境 · 守碑老人" },
    { id: "acolyte", name: "金甲丹童", role: "护法仙童" }
  ];

  function isGarrisonHeroUnlocked(g, heroId) {
    if (!g || !heroId) return false;
    if (hasOwn(NPC_META, heroId)) return getCompanionBondTier(g, heroId) >= 1;
    if (heroId === "acolyte") return !!ensurePrimordialCrafts(g).goldenAcolyte;
    return false;
  }

  function getGarrisonHeroLockReason(g, heroId) {
    if (heroId === "acolyte") return "需先于【丹剑微操】炼成金甲丹童";
    return "尚未结缘（需羁绊 ≥ 1 阶）";
  }

  function ensureExpeditionState(g) {
    if (!g) return { assignments: {}, bankedStones: 0, bankedStars: 0, supportThunderCount: 0, tickTimer: 8.5 };
    const rawEx = (g.expeditions && typeof g.expeditions === "object" && !Array.isArray(g.expeditions)) ? g.expeditions : null;
    const exHasUnsafeKey = !!(rawEx && (hasOwn(rawEx, "__proto__") || hasOwn(rawEx, "constructor") || hasOwn(rawEx, "prototype")));
    let ex;
    if (!rawEx || Object.getPrototypeOf(rawEx) !== Object.prototype || exHasUnsafeKey) {
      ex = safeAssignPlain({ assignments: {}, bankedStones: 0, bankedStars: 0, supportThunderCount: 0, tickTimer: 8.5 }, rawEx);
      g.expeditions = ex;
    } else {
      ex = rawEx;
    }
    const rawAsgn = (ex.assignments && typeof ex.assignments === "object" && !Array.isArray(ex.assignments)) ? ex.assignments : {};
    const validHeroes = new Set(GARRISON_ROSTER.map(h => h.id));
    const cleanAsgn = {};
    const usedHeroes = new Set();
    EXPEDITION_NODES.forEach(nd => {
      const hid = hasOwn(rawAsgn, nd.id) && typeof rawAsgn[nd.id] === "string" ? rawAsgn[nd.id] : "";
      if (hid && validHeroes.has(hid) && isGarrisonHeroUnlocked(g, hid) && !usedHeroes.has(hid)) {
        cleanAsgn[nd.id] = hid;
        usedHeroes.add(hid);
      }
    });
    ex.assignments = cleanAsgn;
    ex.bankedStones = Math.min(EXPEDITION_BANKED_STONES_CAP, Math.max(0, Math.floor(num(ex.bankedStones, 0))));
    ex.bankedStars = Math.min(EXPEDITION_BANKED_STARS_CAP, Math.max(0, Math.floor(num(ex.bankedStars, 0))));
    ex.supportThunderCount = Math.max(0, Math.floor(num(ex.supportThunderCount, 0)));
    ex.tickTimer = Math.max(0, num(ex.tickTimer, 8.5));
    return ex;
  }

  function assignExpeditionNode(g, nodeId, heroId) {
    if (!g) return { ok: false, reason: "no_game" };
    const node = EXPEDITION_NODES.find(n => n.id === nodeId);
    if (!node) return { ok: false, reason: "invalid_node" };
    const ex = ensureExpeditionState(g);
    if (!heroId) {
      delete ex.assignments[nodeId];
      saveGame();
      showToast(`已撤回【${node.name}】驻防`);
      return { ok: true, action: "recalled" };
    }
    const hero = GARRISON_ROSTER.find(h => h.id === heroId);
    if (!hero) return { ok: false, reason: "invalid_hero" };
    if (!isGarrisonHeroUnlocked(g, heroId)) {
      showToast(`🔒 【${hero.name}】${getGarrisonHeroLockReason(g, heroId)}，无法派遣驻防！`);
      return { ok: false, reason: "unbonded" };
    }
    const conflictNode = EXPEDITION_NODES.find(n => n.id !== nodeId && ex.assignments[n.id] === heroId);
    if (conflictNode) {
      showToast(`⚠ 【${hero.name}】正驻防于【${conflictNode.name}】，每位故人限驻守 1 处灵脉，请先撤防再改派！`);
      return { ok: false, reason: "already_assigned", existingNodeId: conflictNode.id };
    }
    ex.assignments[nodeId] = heroId;
    saveGame();
    showToast(`⛵ 已委派【${hero.name}】驻防【${node.name}】！`);
    return { ok: true, action: "assigned" };
  }

  function triggerWarshipOrbitalStrike() {
    if (!game) return false;
    if (!guardActionRealm("warship")) return false;
    notifyUnlockCardTried("warship");
    if (arena.warshipStrike && arena.warshipStrike.active) {
      showToast("⛵ 听雨凌霄仙舟正在天际倾泻主炮齐射中！");
      return false;
    }
    if ((arena.warshipCd || 0) > 0) {
      showToast(`凌霄仙舟充能中 (${arena.warshipCd.toFixed(1)}s)`);
      return false;
    }
    if (!consumePlayerMp(42, "凌霄仙舟")) return false;
    arena.warshipCd = 35.0;
    const cv = document.getElementById("fx-canvas");
    const w = (cv && cv.width) || 1440, h = (cv && cv.height) || 900;
    const boss = arena.enemies.find(e => e.hp > 0 && e.isBoss) || arena.enemies.find(e => e.hp > 0 && !e.isTreasure);
    const tx = boss ? boss.x : w * 0.56;
    const ty = boss ? boss.y : h * 0.50;

    arena.warshipStrike = {
      active: true,
      t: 0,
      dur: 2.6,
      shipX: w * 0.14,
      shipY: h * 0.20,
      targetX: tx,
      targetY: ty,
      discipleVolleys: 0,
      cannonFired: false,
      chains: arena.enemies.filter(e => e.hp > 0 && !e.isTreasure).slice(0, 4)
    };
    // Phase 1: Demon-Binding Chains (`镇妖锁链锚定`)!
    arena.warshipStrike.chains.forEach(e => {
      e.chillTimer = Math.max(e.chillTimer || 0, 3.2);
      e.vx = 0; e.vy = 0;
    });

    Sound.soulManifestRoar();
    Sound.drum(0.30);
    GamepadSystem.rumble(0.88, 0.78, 260);
    registerStyleAction("warship", 215);
    pushTelemetryInput("⛵凌霄仙舟·天基齐射!", false);
    showBossCutIn("warship_lingxiao_ark", "宗门母舰 ·【听雨凌霄仙舟】降临", "镇妖金链锁敌 · 十二门徒御剑空降剑雨 + 太初灵晶主炮灭世轰击！", { isPlayerUlt: true, cutInKey: "ult_warship" });
    addFloat("⛵ 听雨凌霄仙舟掠空 ·【镇妖锁链 + 天基主炮】锁定！！", tx, ty - 84, "#80ffea", 21, true);
    syncV24GenesisDock();
    return true;
  }

  function openExpeditionSandboxModal() {
    if (!game) return;
    if (!guardEcosystemAccess("vein_expedition")) return;
    notifyUnlockCardTried("expedition");
    closeDrawer();
    const ex = ensureExpeditionState(game);
    const activeCnt = Object.values(ex.assignments || {}).filter(Boolean).length;
    const vaultEmpty = ex.bankedStones <= 0 && ex.bankedStars <= 0;
    const vaultFull = ex.bankedStones >= EXPEDITION_BANKED_STONES_CAP;

    openModal(`
      <div class="drawer-mural-banner" style="height:86px;">
        <img src="${ART.warship_lingxiao_ark}" alt="九州灵脉远征沙盘" style="object-fit:contain;background:radial-gradient(circle,#163844,#07131a);" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">仙门母舰 · 灵脉驻防</span>
            <h2 style="font-family:var(--font-serif);font-size:19.5px;color:var(--gold-bright);margin-top:2px;">⛵ 九州灵脉远征驻防沙盘 · 护道雷援</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">返回道场 ✕</button>
        </div>
      </div>

      <div class="jade-card" style="flex-direction:row;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <div>
          <strong style="font-size:13px;color:#80ffea;">驻防队伍：${activeCnt} / 5 处灵脉 · 待领军资：<span style="color:#ffe28a;">${num(ex.bankedStones)} / ${EXPEDITION_BANKED_STONES_CAP} 灵石</span> + <span style="color:#d69eff;">${num(ex.bankedStars)} / ${EXPEDITION_BANKED_STARS_CAP} 鸿蒙星魄</span>${vaultFull ? ` <span class="tag-chip done" style="font-size:9.5px;">已满仓</span>` : ""}${game.cloudSeaCleared ? ` <span class="tag-chip mythic" style="font-size:9.5px;">☁ 破云印 +15%</span>` : ""}</strong>
          <div style="font-size:10.5px;color:var(--text-sub);">仅在非洞府秘境战斗中累积产出（仓库上限 ${EXPEDITION_BANKED_STONES_CAP} 灵石 / ${EXPEDITION_BANKED_STARS_CAP} 星魄）；对应秘境通关 +15%、三星 +30% 灵脉共鸣（不锁节点），每 8.5 秒降下【仙门护道雷援】。</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" id="btn-claim-expedition" class="btn-gold" style="padding:6px 13px;font-size:11.5px;" data-action="claim-expedition" ${vaultEmpty ? "disabled" : ""}>🎁 一键征收远征军资</button>
          <button type="button" id="btn-exp-goto-starchart" class="btn-ghost" style="padding:6px 11px;font-size:11.5px;border-color:rgba(214,158,255,0.55);color:#e8c8ff;" data-action="open-star-chart">🌟 周天星图</button>
          <button type="button" class="btn-jade" style="padding:6px 12px;font-size:11.5px;" data-action="cast-warship-from-modal">⛵ 呼叫仙舟轰炸</button>
        </div>
      </div>

      <div class="expedition-grid">
        ${EXPEDITION_NODES.map(nd => {
          const curHero = (ex.assignments && ex.assignments[nd.id]) || "";
          const syn = getExpeditionNodeStageSynergy(game, nd.id);
          return `<div class="expedition-node-card">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <div style="display:flex;align-items:center;gap:7px;">
                <img src="${ART[nd.art]}" alt="${nd.name}" style="width:34px;height:34px;border-radius:7px;object-fit:cover;" />
                <div>
                  <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                    <strong style="font-size:12px;color:var(--gold-bright);">${nd.name}</strong>
                    <span class="tag-chip ${syn.tier === "full_star" ? "mythic" : syn.tier === "cleared" ? "done" : ""}" style="font-size:9px;" data-exp-synergy="${nd.id}">${escapeHtml(syn.label)}</span>
                  </div>
                  <div style="font-size:9.8px;color:#9effec;">${nd.desc}</div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:4px;">
                ${curHero ? `<button type="button" class="btn-ghost" style="padding:2px 8px;font-size:10.5px;" data-recall-exp-node="${nd.id}">撤防</button>` : ""}
                <span class="tag-chip ${curHero ? "done" : ""}">${curHero ? "驻防中" : "空闲"}</span>
              </div>
            </div>
            <select class="workshop-select" data-exp-node="${nd.id}">
              <option value="" ${!curHero ? "selected" : ""}>— 未委派驻守弟子 —</option>
              ${GARRISON_ROSTER.map(h => {
                const unlocked = isGarrisonHeroUnlocked(game, h.id);
                const stationedElsewhere = EXPEDITION_NODES.find(other => other.id !== nd.id && ex.assignments[other.id] === h.id);
                const optDisabled = (!unlocked || !!stationedElsewhere) && curHero !== h.id;
                const label = !unlocked
                  ? `🔒 ${h.name}（${getGarrisonHeroLockReason(game, h.id)}）`
                  : stationedElsewhere
                    ? `${h.name}（已驻防：${stationedElsewhere.name}）`
                    : `驻守：${h.name}（${h.role}）`;
                return `<option value="${h.id}" ${curHero === h.id ? "selected" : ""} ${optDisabled ? "disabled" : ""}>${label}</option>`;
              }).join("")}
            </select>
          </div>`;
        }).join("")}
      </div>
    `, true);
  }

  function claimExpeditionRewards() {
    if (!game) return null;
    const ex = ensureExpeditionState(game);
    const activeNodes = EXPEDITION_NODES.filter(nd => ex.assignments && ex.assignments[nd.id]);
    const bankedSt = Math.min(EXPEDITION_BANKED_STONES_CAP, Math.max(0, Math.floor(num(ex.bankedStones, 0))));
    const bankedSr = Math.min(EXPEDITION_BANKED_STARS_CAP, Math.max(0, Math.floor(num(ex.bankedStars, 0))));
    if (bankedSt <= 0 && bankedSr <= 0) {
      showToast(activeNodes.length > 0
        ? "远征军资库当前为空，请前往非洞府秘境战斗累积产出后再征收！"
        : "请先派遣已结缘故人驻防灵脉，并于秘境战斗中累积军资！");
      return { gainedStones: 0, gainedStars: 0 };
    }
    const sb = getSanctumBonuses(game);
    const cloudMult = game.cloudSeaCleared ? 1.15 : 1.0;
    const gainedStones = Math.round(bankedSt * sb.expMult * cloudMult);
    const gainedStars = Math.round(bankedSr * (sb.expMult >= 1.4 ? 1.5 : 1));
    game.stones = (game.stones || 0) + gainedStones;
    game.bonusStarPts = (game.bonusStarPts || 0) + gainedStars;
    ex.bankedStones = 0;
    ex.bankedStars = 0;
    Sound.fanfare();
    const scLv = getSanctumLevel(game, "scripture_hall");
    showToast(`🎁 远征军资入库${scLv > 1 ? `（藏经阁Lv.${scLv} ×${sb.expMult.toFixed(1)}）` : ""}${game.cloudSeaCleared ? "·破云印+15%" : ""}：灵石 +${gainedStones}、鸿蒙星魄 +${gainedStars}！`);
    saveGame();
    updateHud();
    if (document.getElementById("modal-backdrop").classList.contains("open")) openExpeditionSandboxModal();
    return { gainedStones, gainedStars };
  }

  // 5. Full Save Cloud Code Base64 Export / Import (`太虚大道云码 · 全存档 Base64 一键导出与导入恢复`)
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function base64ToUtf8(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function exportFullCloudSaveCode() {
    if (!game || sandboxMode) return "";
    const payload = {
      v: 24,
      game: getSanitizedGameForPersistence(game),
      metaState,
      a11ySettings,
      stems: Sound.stems
    };
    const jsonStr = JSON.stringify(payload);
    let sum = 0x24;
    for (let i = 0; i < jsonStr.length; i++) sum = (sum * 31 + jsonStr.charCodeAt(i)) & 0xFFFF;
    const chk = sum.toString(16).toUpperCase().padStart(4, "0");
    return `CY24SAVE-${chk}-${utf8ToBase64(jsonStr)}`;
  }


  let pendingCloudImport = null;

  function parseCloudSaveCode(codeStr) {
    if (!codeStr || typeof codeStr !== "string") {
      return { ok: false, reason: "请输入太虚大道云码" };
    }
    try {
      const trimmed = codeStr.trim();
      const m = trimmed.match(/^CY24SAVE-([0-9A-F]{4})-(.+)$/);
      if (!m) return { ok: false, reason: "云码格式无效（需以 CY24SAVE- 开头）" };
      const jsonStr = base64ToUtf8(m[2]);
      let sum = 0x24;
      for (let i = 0; i < jsonStr.length; i++) sum = (sum * 31 + jsonStr.charCodeAt(i)) & 0xFFFF;
      const chk = sum.toString(16).toUpperCase().padStart(4, "0");
      if (chk !== m[1]) return { ok: false, reason: "云码校验位不匹配，可能已截断或被篡改" };
      const parsed = JSON.parse(jsonStr);
      if (!parsed || typeof parsed !== "object" || !parsed.game || typeof parsed.game !== "object" || Array.isArray(parsed.game)) {
        return { ok: false, reason: "云码缺少核心存档数据" };
      }
      if (typeof parsed.game.realm !== "string" || !hasOwn(REALMS, parsed.game.realm)) {
        return { ok: false, reason: `云码境界字段非法（${safeDiag(parsed.game.realm)}）` };
      }
      const normalizedGame = normalizeLoadedGame(parsed.game);
      const impRealmSpec = REALMS[normalizedGame.realm];
      const curRealmSpec = (game && hasOwn(REALMS, game.realm)) ? REALMS[game.realm] : null;
      return {
        ok: true,
        parsed,
        normalizedGame,
        preview: {
          imported: {
            name: normalizedGame.name || "顾长青",
            realm: normalizedGame.realm,
            realmName: impRealmSpec ? impRealmSpec.name : normalizedGame.realm,
            stones: Math.floor(Number(normalizedGame.stones) || 0),
            calamityTier: Number(normalizedGame.calamityTier) || 0,
            towerBest: Number(normalizedGame.towerBest) || 0
          },
          current: game ? {
            name: game.name || "顾长青",
            realm: game.realm,
            realmName: curRealmSpec ? curRealmSpec.name : game.realm,
            stones: Math.floor(Number(game.stones) || 0),
            calamityTier: Number(game.calamityTier) || 0,
            towerBest: Number(game.towerBest) || 0
          } : null
        }
      };
    } catch (e) {
      return { ok: false, reason: "云码解码或 JSON 解析失败" };
    }
  }

  function openCloudImportConfirmModal(parsedRes) {
    if (sandboxMode) {
      showToast("🧪 演武沙盒模式已禁用云码导出与导入（请先退出沙盒）");
      return;
    }
    if (!parsedRes || !parsedRes.ok || !parsedRes.preview) return;
    pendingCloudImport = parsedRes;
    const imp = parsedRes.preview.imported;
    const cur = parsedRes.preview.current;
    const blockedReason = saveReadOnlyMode
      ? "当前处于只读保护态（禁止覆盖另一标签页进度），此时无法完成云码写入"
      : saveConflictState
        ? "当前存在未解决的多标签页存档冲突，请先处理冲突后再导入"
        : storageReadError
          ? "本地存在未处理的受损主存档，请先备份或确认覆盖后再导入"
          : null;
    openModal(`
      <div class="drawer-mural-banner" style="height:82px;">
        <img src="${ART.banner_archive}" alt="云码导入确认" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">云码导入确认</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:4px;">请核对云码进度并确认覆盖</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">取消 ✕</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px;">
        <div class="jade-card" style="padding:10px 12px;border-color:rgba(216,179,106,0.38);">
          <div style="font-size:11px;color:var(--text-sub);margin-bottom:4px;">当前本地进度</div>
          ${cur ? `
            <div style="font-size:13px;color:#e6f4f1;font-weight:700;">道号：${escapeHtml(cur.name)}</div>
            <div style="font-size:12px;color:#ffe28a;margin-top:3px;">境界：${escapeHtml(cur.realmName)}</div>
            <div style="font-size:12px;color:#80ffea;margin-top:2px;">灵石：${cur.stones}</div>
          ` : `<div style="font-size:12px;color:var(--text-sub);">暂无活跃对局</div>`}
        </div>
        <div class="jade-card" style="padding:10px 12px;border-color:rgba(128,255,234,0.58);">
          <div style="font-size:11px;color:#80ffea;margin-bottom:4px;">即将导入的云码进度</div>
          <div style="font-size:13px;color:#ffffff;font-weight:700;">道号：${escapeHtml(imp.name)}</div>
          <div style="font-size:12px;color:#ffe28a;margin-top:3px;">境界：${escapeHtml(imp.realmName)}</div>
          <div style="font-size:12px;color:#80ffea;margin-top:2px;">灵石：${imp.stones}</div>
        </div>
      </div>
      ${blockedReason ? `<div style="margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(92,22,22,0.75);border:1px solid rgba(255,120,112,0.65);color:#ffd5d0;font-size:11.5px;">⚠ ${escapeHtml(blockedReason)}</div>` : ""}
      <div id="cloud-import-error-msg" style="display:none;margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(92,22,22,0.85);border:1px solid rgba(255,120,112,0.75);color:#ffd5d0;font-size:11.5px;"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
        <button type="button" class="btn-ghost" data-action="cancel-cloud-import">取消返回</button>
        <button type="button" id="btn-confirm-cloud-import" class="btn-gold" data-action="confirm-cloud-import">确认覆盖并导入</button>
      </div>
    `, true);
  }

  function commitCloudSaveImport(parsedRes) {
    if (sandboxMode) {
      showToast("🧪 演武沙盒模式中不可导入正式存档，请先点击【退出沙盒】！");
      return { ok: false, reason: "演武沙盒模式中不可导入正式存档，请先退出沙盒" };
    }
    if (!parsedRes || !parsedRes.ok || !parsedRes.parsed || !parsedRes.parsed.game) {
      return { ok: false, reason: "待导入的云码数据无效" };
    }
    if (saveReadOnlyMode) {
      renderHudSaveAlert();
      showToast("⚠ 当前处于只读保护态，云码导入已中止（未修改本地存档）");
      return { ok: false, reason: "当前处于只读保护态，禁止写入存档" };
    }
    if (saveConflictState) {
      renderHudSaveAlert();
      showToast("⚠ 检测到多标签页存档冲突，请先处理冲突后再导入云码");
      return { ok: false, reason: "存在未解决的多标签页存档冲突" };
    }
    if (storageReadError) {
      renderWelcomeSaveStatusBanner();
      renderHudSaveAlert();
      showToast("⚠ 本地存在未处理的受损主存档，已中止云码导入");
      return { ok: false, reason: "本地存在未处理的受损主存档" };
    }
    const prevGame = game;
    const prevMeta = JSON.parse(JSON.stringify(metaState));
    const prevA11y = safeAssignPlain({}, a11ySettings);
    const prevStems = safeAssignPlain({}, Sound.stems);
    try {
      game = normalizeLoadedGame(parsedRes.parsed.game);
      if (parsedRes.parsed.metaState && typeof parsedRes.parsed.metaState === "object" && !Array.isArray(parsedRes.parsed.metaState)) {
        if (!metaReadError) {
          safeAssignPlain(metaState, mergeMetaStates(metaState, parsedRes.parsed.metaState));
          ensureMetaState();
        }
      }
      if (parsedRes.parsed.a11ySettings && typeof parsedRes.parsed.a11ySettings === "object" && !Array.isArray(parsedRes.parsed.a11ySettings)) {
        applySanitizedA11ySettings(parsedRes.parsed.a11ySettings, { fallbackToMedia: false });
      }
      if (parsedRes.parsed.stems && typeof parsedRes.parsed.stems === "object" && !Array.isArray(parsedRes.parsed.stems)) {
        applySanitizedAudioStems(parsedRes.parsed.stems);
      }
      const saved = saveGame();
      if (!saved) {
        game = prevGame;
        Object.keys(metaState).forEach(k => { if (!(k in prevMeta)) delete metaState[k]; });
        safeAssignPlain(metaState, prevMeta);
        safeAssignPlain(a11ySettings, prevA11y);
        applyReducedMotionClass();
        safeAssignPlain(Sound.stems, prevStems);
        if (game) updateHud();
        const reason = saveConflictState
          ? "检测到多标签页冲突，导入已回滚"
          : (storageWriteError ? storageWriteError.message : "存档写入失败，导入已回滚");
        showToast(`⚠ 云码导入失败：${reason}`);
        return { ok: false, reason };
      }
      activeCustomSeedTempCurio = null;
      clearTransientChoiceQueues();
      saveA11ySettings();
      try { localStorage.setItem(STEMS_STORAGE_KEY, JSON.stringify(Sound.stems)); } catch (e) {}
      syncFlyingSwords();
      syncTagTeamHud();
      syncV22TacticalDock();
      updateHud();
      lastSavedPayloadChecksum = computeCurrentPayloadChecksum();
      Sound.fanfare();
      showToast(`☁ 太虚大道云码导入成功！已恢复道号【${game.name}】（${REALMS[game.realm].name} · ${game.stones} 灵石）！`);
      return { ok: true };
    } catch (e) {
      game = prevGame;
      Object.keys(metaState).forEach(k => { if (!(k in prevMeta)) delete metaState[k]; });
      safeAssignPlain(metaState, prevMeta);
      safeAssignPlain(a11ySettings, prevA11y);
      applyReducedMotionClass();
      safeAssignPlain(Sound.stems, prevStems);
      if (game) updateHud();
      const reason = safeText(e && e.message, "导入过程异常，已回滚") || "导入过程异常，已回滚";
      showToast(`⚠ 云码导入失败：${reason}`);
      return { ok: false, reason };
    }
  }

  function importFullCloudSaveCode(codeStr) {
    const parsedRes = parseCloudSaveCode(codeStr);
    if (!parsedRes.ok) return false;
    return commitCloudSaveImport(parsedRes).ok;
  }

  function stepSanqingAndGenesisSystems(dt, st, w, h) {
    const p = arena.player;

    // A. Step Tri-Clone Phantom Resonance (`一气化三清` 80ms / 160ms Echo Queue)
    const sq = ensureSanqingState();
    if (sq.active) {
      sq.life -= dt;
      if (sq.life <= 0) {
        sq.active = false;
        arena.sanqingEchoQueue = [];
        syncV24GenesisDock();
      } else {
        sq.clones.forEach(cl => {
          cl.lungeT = Math.max(0, (cl.lungeT || 0) - dt);
          if (cl.lungeT <= 0) {
            const tx = p.x + cl.ox * p.facing;
            const ty = p.y + cl.oy - (p.z || 0) * 0.75;
            cl.x += (tx - cl.x) * Math.min(1, dt * 10.5);
            cl.y += (ty - cl.y) * Math.min(1, dt * 10.5);
            cl.facing = p.facing;
          }
        });
        for (let i = arena.sanqingEchoQueue.length - 1; i >= 0; i--) {
          const ev = arena.sanqingEchoQueue[i];
          ev.ttl -= dt;
          if (ev.ttl <= 0) {
            arena.sanqingEchoQueue.splice(i, 1);
            executeSingleSanqingEcho(ev, st);
          }
        }
      }
    }

    // B. Step Shanhe Sheji Scroll Ink-Dimension Domain (`山河社稷图` 10s Domain)
    if (arena.shanheDomain && arena.shanheDomain.active) {
      const sd = arena.shanheDomain;
      sd.life -= dt;
      sd.mantras.forEach(m => { m.t += dt; });
      // Slow enemies by 42% inside Ink-Scroll Dimension
      arena.enemies.forEach(e => {
        if (e.hp > 0) {
          e.chillTimer = Math.max(e.chillTimer || 0, 0.5);
        }
      });
      if (sd.life <= 0) {
        detonateShanheScrollBreak();
      }
    }

    // C. Step Lingxiao Celestial Warship Orbital Flyover (`听雨凌霄仙舟`)
    if (arena.warshipStrike && arena.warshipStrike.active) {
      const ws = arena.warshipStrike;
      ws.t += dt;
      const prog = Math.min(1, ws.t / ws.dur);
      ws.shipX = w * (0.12 + prog * 0.76);
      ws.shipY = h * 0.19 + Math.sin(prog * Math.PI) * -14;

      const boss = arena.enemies.find(e => e.hp > 0 && e.isBoss) || arena.enemies.find(e => e.hp > 0 && !e.isTreasure);
      if (boss) { ws.targetX = boss.x; ws.targetY = boss.y; }

      // 12 Sect Disciples Flying-Sword Rain Volleys (`十二门徒御剑空降剑雨`)!
      const expectedVolleys = Math.min(12, Math.floor(prog * 15));
      while (ws.discipleVolleys < expectedVolleys) {
        ws.discipleVolleys += 1;
        const rx = ws.targetX + (Math.random() - 0.5) * 240;
        const ry = ws.targetY + (Math.random() - 0.5) * 140;
        arena.blinkStreaks.push({ x1: ws.shipX, y1: ws.shipY + 30, x2: rx, y2: ry, t: 0, color: ws.discipleVolleys % 2 === 0 ? "#80ffea" : "#ffe28a" });
        spawnSparks(rx, ry, 7, -Math.PI / 2, 3.14, "#80ffea");
        arena.enemies.slice().forEach(e => {
          if (e.hp > 0 && Math.hypot(e.x - rx, e.y - ry) < e.r + 115) {
            damageEnemy(e, Math.max(10, Math.round(st.atk * 0.65)), false, 10, Math.PI / 2, 2, false);
          }
        });
      }

      // Primordial Spirit-Crystal Main Cannon (`太初灵晶主炮轰击`) at t >= 1.55s!
      if (!ws.cannonFired && ws.t >= 1.55) {
        ws.cannonFired = true;
        Sound.coreSeverBoom();
        Sound.fanfare();
        arena.shake = 24;
        triggerImpactFrame(4, "#80ffea", ws.targetX, ws.targetY - 20);
        triggerRadialChromaticBurst(1.55, "#80ffea", ws.targetX, ws.targetY - 16);
        spawnDistortionRing(ws.targetX, ws.targetY, 310, "#80ffea");
        addDecal(ws.targetX, ws.targetY + 12, 0, 105, "spider_crack");
        const cannonDmg = Math.round(st.atk * 3.0);
        arena.enemies.slice().forEach(e => {
          if (e.hp > 0 && Math.hypot(e.x - ws.targetX, e.y - ws.targetY) < e.r + 250) {
            e.wardHp = 0;
            e.frontShieldHp = 0;
            damageEnemy(e, cannonDmg, true, 54, Math.atan2(e.y - ws.targetY, e.x - ws.targetX), 14, true);
          }
        });
        triggerKillCamStamp("仙舟破界");
        addFloat(`⛵ 太初灵晶主炮轰击 -${cannonDmg}！！`, ws.targetX, ws.targetY - 92, "#9effec", 24, true);
        captureBattleHighlightFrame("仙舟破界", "听雨凌霄仙舟·太初主炮轰击", cannonDmg, 5);
      }

      if (ws.t >= ws.dur) {
        ws.active = false;
        arena.warshipStrike = null;
      }
    }

    // D. Step Jiuzhou Expedition Garrison Passive Yield & Cross-Region Sect Thunder Support (Active non-sanctum non-practice combat only, strictly capped!)
    const hasActiveExpeditionCombat = Boolean(
      game && !arena.paused && !arena.sanctumMode
      && !isPracticeModeActive()
      && isEcosystemSystemUnlocked(game, "vein_expedition")
      && arena.enemies.some(e => e.hp > 0 && !e.isDummy && !e.isTreasure)
    );
    if (hasActiveExpeditionCombat) {
      const ex = ensureExpeditionState(game);
      const activeNodes = EXPEDITION_NODES.filter(nd => ex.assignments && ex.assignments[nd.id] && isGarrisonHeroUnlocked(game, ex.assignments[nd.id]));
      if (activeNodes.length > 0) {
        const curTick = (typeof ex.tickTimer === "number" && Number.isFinite(ex.tickTimer)) ? ex.tickTimer : 8.5;
        ex.tickTimer = curTick - dt;
        if (ex.tickTimer <= 0) {
          ex.tickTimer = 8.5;
          const tickStones = activeNodes.reduce((s, n) => s + Math.round(n.stoneRate * 0.35 * getExpeditionNodeStageSynergy(game, n.id).mult), 0);
          ex.bankedStones = Math.min(EXPEDITION_BANKED_STONES_CAP, (ex.bankedStones || 0) + tickStones);
          if (Math.random() < 0.25) {
            ex.bankedStars = Math.min(EXPEDITION_BANKED_STARS_CAP, (ex.bankedStars || 0) + 1);
          }
          const foe = arena.enemies.find(e => e.hp > 0 && !e.isDummy && !e.isTreasure);
          if (foe) {
            ex.supportThunderCount = (ex.supportThunderCount || 0) + 1;
            arena.skyBolts.push({ x: foe.x, y: foe.y, t: 0, color: "#80ffea" });
            damageEnemy(foe, Math.round(st.atk * (0.52 + activeNodes.length * 0.12)), false, 10, 0, 2, false);
            addFloat(`⚡ 九州驻防 · 仙门护道雷援！`, foe.x, foe.y - 58, "#80ffea", 14, true);
          }
        }
      }
    }
    syncV24GenesisDock();
  }

  function syncV24GenesisDock() {
    if (!game) return;
    const sq = ensureSanqingState();
    const sqBtn = document.getElementById("btn-sanqing-clones");
    const sqImg = document.getElementById("img-sanqing-ico");
    const sqTit = document.getElementById("lbl-sanqing-title");
    const sqSub = document.getElementById("lbl-sanqing-sub");
    if (sqBtn && sqImg && sqTit && sqSub) {
      sqImg.src = ART.clone_yuqing_cyan;
      sqBtn.classList.toggle("active-gen", !!sq.active);
      if (sq.active) {
        sqTit.textContent = "移形归元!";
        sqSub.textContent = `双法身 ${sq.life.toFixed(1)}s`;
      } else {
        const seq = ensureCustomComboSeq(game);
        sqTit.textContent = "一气三清";
        sqSub.textContent = seq.enabled ? "混编三影斩" : "80/160ms复刻";
      }
    }

    const sd = arena.shanheDomain;
    const shBtn = document.getElementById("btn-shanhe-domain");
    const shImg = document.getElementById("img-shanhe-ico");
    const shTit = document.getElementById("lbl-shanhe-title");
    const shSub = document.getElementById("lbl-shanhe-sub");
    if (shBtn && shImg && shTit && shSub) {
      shImg.src = ART.scroll_shanhe_sheji;
      shBtn.classList.toggle("active-gen", !!(sd && sd.active));
      if (sd && sd.active) {
        shTit.textContent = `真言 ${sd.mantras.length}/9`;
        shSub.textContent = `破画 ${sd.life.toFixed(1)}s`;
      } else {
        shTit.textContent = "山河社稷";
        shSub.textContent = "画中界九字";
      }
    }

    const ws = arena.warshipStrike;
    const wsBtn = document.getElementById("btn-warship-strike");
    const wsImg = document.getElementById("img-warship-ico");
    const wsTit = document.getElementById("lbl-warship-title");
    const wsSub = document.getElementById("lbl-warship-sub");
    if (wsBtn && wsImg && wsTit && wsSub) {
      wsImg.src = ART.warship_lingxiao_ark;
      wsBtn.classList.toggle("active-gen", !!(ws && ws.active));
      wsTit.textContent = "凌霄仙舟";
      wsSub.textContent = (ws && ws.active) ? `主炮齐射中!` : "天基主炮齐射";
    }
  }

  function computeBossRushScoreAndGrade(br, affMult = 1.0, playerMaxHp = 325, revivesUsed = 0) {
    const elapsed = Math.max(0, num(br && br.elapsed, 210));
    const partBreaks = Math.max(0, Math.floor(num(br && br.partBreaks, 0)));
    const parries = Math.max(0, Math.floor(num(br && br.parries, 0)));
    const hitsTaken = Math.max(0, Math.floor(num(br && br.hitsTaken, 0)));
    const damageTaken = Math.max(0, num(br && br.damageTaken, 0));
    const mult = Math.max(1.0, num(affMult, 1.0));
    const maxHpSafe = Math.max(1, num(playerMaxHp, 325));
    const revives = Math.max(0, Math.floor(num(revivesUsed, 0)));

    const basePts = 1200;
    const timePts = Math.round(Math.max(-350, Math.min(450, (210 - elapsed) * 3.75)));
    const techPts = Math.min(450, partBreaks * 65) + Math.min(450, parries * 45);
    const hpRatioLost = damageTaken / maxHpSafe;
    const noHitBonus = hitsTaken === 0 ? 300 : (hitsTaken <= 2 ? 150 : 0);
    const hitPenalty = Math.min(500, hitsTaken * 30 + Math.round(hpRatioLost * 90) + revives * 200);
    const survivePts = noHitBonus - hitPenalty;

    const rawPts = Math.max(0, Math.round((basePts + timePts + techPts + survivePts) * mult));
    let shortGrade = "C", title = "初涉剑冢";
    if (rawPts >= 2000)      { shortGrade = "S"; title = "万古剑尊"; }
    else if (rawPts >= 1000) { shortGrade = "A"; title = "斩魔剑修"; }
    else if (rawPts >= 650)  { shortGrade = "B"; title = "问道剑客"; }

    return {
      rawPts, shortGrade, grade: `${shortGrade} ${title}`,
      breakdown: { basePts, timePts, techPts, survivePts, affMult: mult, elapsed, partBreaks, parries, hitsTaken, damageTaken, revives }
    };
  }

  function openBossRushVictoryModal() {
    const stNow = game ? getCombatStats(game) : { maxHp: 325 };
    const br = arena.bossRush || {
      elapsed: 210, partBreaks: 2, parries: 2, hitsTaken: 5,
      damageTaken: Math.round(stNow.maxHp || 325), startBout: 1, practiceMode: false
    };
    const isPractice = Boolean(isPracticeModeActive() || br.practiceMode || (br.startBout && br.startBout > 1));
    arena.bossRush = null;

    if (isPractice) {
      updateHud();
      openModal(`
        <div class="drawer-mural-banner" style="height:92px;">
          <img src="${ART.arena_wanjian_tomb}" alt="练习演武完成" />
          <div class="drawer-mural-overlay">
            <div>
              <span class="cinnabar-seal">练习模式 · 不计评级</span>
              <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:4px;">万剑冢跳关演武完成（自第 ${Math.max(2, Math.floor(num(br.startBout, 6)))} 阵起）</h2>
            </div>
            <button type="button" class="btn-ghost" data-modal-close="1">收卷 ✕</button>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;text-align:center;padding:4px 0;">
          <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
            <span class="tag-chip">练习模式（不计评级）</span>
            <span class="tag-chip done">演武耗时：${num(br.elapsed, 0).toFixed(1)}s</span>
            <span class="tag-chip">部位碎核：${Math.floor(num(br.partBreaks, 0))} 次</span>
            <span class="tag-chip">识破破招：${Math.floor(num(br.parries, 0))} 次</span>
            <span class="tag-chip">受击：${Math.floor(num(br.hitsTaken, 0))} 次</span>
          </div>
          <div class="jade-card" style="padding:10px 14px;text-align:left;gap:4px;">
            <strong style="color:#ffd8a8;font-size:13px;">🎯 练习模式说明：</strong>
            <div style="font-size:12px;color:#d6eee8;">本次从第 ${Math.max(2, Math.floor(num(br.startBout, 6)))} 阵跳关演武，未发放灵石、鸿蒙神兵、尊号与【太虚劫光】拖尾，亦未改写正式评级与历史最佳纪录。</div>
            <div style="font-size:11.5px;color:#80ffea;">若要领取全额封神奖励并冲击 S 级正式评级，请从【第一阵】完整挑战七阵连战！</div>
          </div>
          <div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
            <button type="button" class="btn-gold" data-start-rush="1">🔥 从第一阵完整挑战</button>
            <button type="button" class="btn-jade" data-start-rush="${Math.max(2, Math.min(7, Math.floor(num(br.startBout, 6))))}">再练第 ${Math.max(2, Math.min(7, Math.floor(num(br.startBout, 6))))} 阵</button>
            <button type="button" class="btn-ghost" data-action="return-hub-after-rush">返回听雨洞府</button>
          </div>
        </div>
      `, true);
      return;
    }

    const affMult = 1 + arena.rushAffixes.reduce((s, id) => {
      const sp = RUSH_AFFIX_SPECS.find(x => x.id === id);
      return s + (sp ? sp.mult : 0);
    }, 0);
    const evalRes = computeBossRushScoreAndGrade(br, affMult, stNow.maxHp, arena.defeatRevivesUsed || 0);
    const { rawPts, shortGrade, grade } = evalRes;

    game.taixuTrailUnlocked = true;
    game.taixuTrailActive = true;
    game.titleUnlocked = "踏天破妄剑尊";
    game.rushBestGrade = maxUnifiedGrade(game.rushBestGrade, shortGrade);
    if (!sandboxMode) {
      metaState.taixuTrailUnlocked = true;
      metaState.bestRushGrade = maxUnifiedGrade(metaState.bestRushGrade, shortGrade);
      if (!metaState.bestRushTime || br.elapsed < metaState.bestRushTime) metaState.bestRushTime = br.elapsed;
      saveMeta();
    }
    game.stones += 500;
    saveGame(); updateHud();

    openModal(`
      <div class="drawer-mural-banner" style="height:92px;">
        <img src="${ART.arena_wanjian_tomb}" alt="踏天证道" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">${shortGrade} 剑冢评定</span>
            <h2 style="font-family:var(--font-serif);font-size:22px;color:var(--gold-bright);margin-top:4px;">万剑冢七阵封神 · 斩破心魔与太古烛龙法相！</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">收卷 ✕</button>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;text-align:center;padding:4px 0;">
        <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;">
          <span class="tag-chip mythic">评定：${grade} (${rawPts}分)</span>
          <span class="tag-chip done">通关耗时：${num(br.elapsed, 0).toFixed(1)}s</span>
          <span class="tag-chip">部位碎核：${Math.floor(num(br.partBreaks, 0))} 次</span>
          <span class="tag-chip">识破破招：${Math.floor(num(br.parries, 0))} 次</span>
          <span class="tag-chip">受击：${Math.floor(num(br.hitsTaken, 0))} 次</span>
          <span class="tag-chip">劫律倍率：×${affMult.toFixed(2)}</span>
        </div>
        <div class="jade-card" style="padding:10px 14px;text-align:left;gap:4px;">
          <strong style="color:#ffe89e;font-size:13px;">★ 终局独占荣誉与飞剑幻化已永久解锁：</strong>
          <div style="font-size:12px;color:#80ffea;">1. 专属尊号【踏天破妄剑尊】已铭刻于道号金榜；</div>
          <div style="font-size:12px;color:#e2b8ff;">2. 专属飞剑拖尾幻化【太虚劫光】（紫金青三色裂空虹光）已自动佩带生效，并获赏 500 灵石与鸿蒙神兵！</div>
        </div>
        <div style="display:flex;justify-content:center;gap:10px;">
          <button type="button" class="btn-gold" data-action="open-comic-scroll">📜 生成四格水墨战报</button>
          <button type="button" class="btn-gold" data-action="return-hub-after-rush">凯旋听雨洞府</button>
          <button type="button" class="btn-ghost" data-start-rush="1">再战万剑冢</button>
        </div>
      </div>
    `, true);
    acquireGearItem(rollGearItem(4, 4, "weapon"));
  }

  const ACTION_DISPLAY_NAME = {
    stance: "三才剑阵 (Y)", jump: "御风腾跃 (Z)", ult: "法宝剑域 (E)", ally: "故人助阵 (R)", pet: "灵宠绝技 (G)",
    posture: "双剑意姿态 (`)", soul: "镇妖魂印 (C)", swordBlink: "缩地瞬身 (F)", finisher: "流派奥义 (X)",
    tagSwitch: "道侣瞬切 (V)", weapon_form: "太虚剑匣 (1/2/3)",
    astral: "法天象地 (O)", mount: "山海灵骑 (J)", qimen: "奇门八门阵 (U)",
    sanqing: "一气化三清 (4)", shanhe: "山河社稷图 (5)", warship: "凌霄仙舟 (6)", sequencer: "自创剑谱 (7)",
    coop_2p: "双人同游 (]/ [)", celestial_time: "太虚天时 (\\)"
  };

  // S11+G7: Once-per-unlock crisp 2-line "新神通" tutorial cards
  const UNLOCK_TUTORIAL_CATALOG = [
    {
      id: "unlock_ally_coop", min: "mortal", badge: "故人同心", title: "故人助阵 (R)",
      line1: "已结契故人真身降临战场，结成同心剑链协战并助阵渡劫。",
      line2: "按 R 键即可召唤助阵，点击下方【试用】立即体验。",
      tryLabel: "试用 (R)", tryAction: "action:ally", tryKeys: ["ally"]
    },
    {
      id: "unlock_qi_arts", min: "qi", badge: "炼气初开", title: "三才剑阵 (Y) / 御空 (Z) / 剑域 (E)",
      line1: "Y 键切换游龙/剑轮/巨阙三阵，Z 键御空躲地波，E 键展法宝剑域。",
      line2: "按 Y/Z/E 任一键即可施展，点击【试用】先变幻三才剑阵。",
      tryLabel: "试用变阵 (Y)", tryAction: "action:stance", tryKeys: ["stance", "jump", "ult"]
    },
    {
      id: "unlock_qi_eco", min: "qi", badge: "炼气生态", title: "本命灵宠 (G) / 八卦丹剑 / 锁妖古塔",
      line1: "修行抽屉现已开放灵宠契约（分级喂养、Lv.3/5择技），洞府启八卦丹剑。",
      line2: "可前往修行抽屉缔结随行灵宠，或按 G 键施放灵宠觉醒神通。",
      tryLabel: "前往契约灵宠", tryAction: "drawer:cultivate", tryKeys: ["pet"]
    },
    {
      id: "unlock_foundation_arts", min: "foundation", badge: "筑基战技", title: "双姿态 (`) / 魂印 (C) / 缩地 (F) / 奥义 (X)",
      line1: "` 键疾剑/巨阙双姿互切，C 键魂印消后摇，F 键瞬身，X 键满剑意放奥义。",
      line2: "按 `/C/F/X 即可施展，点击【试用】立即切换双剑意姿态。",
      tryLabel: "试用双姿态 (`)", tryAction: "action:posture", tryKeys: ["posture", "soul", "swordBlink", "finisher"]
    },
    {
      id: "unlock_foundation_eco", min: "foundation", badge: "筑基剑匣", title: "道侣瞬切 (V) / 剑匣三器 (1/2/3) / 护山守卫",
      line1: "1/2/3 键幻化飞剑/龙胆枪/剑轮，V 键换人操控道侣，洞府开护山守卫战。",
      line2: "按 1/2/3 或 V 即可体验，点击【试用】幻化龙胆长枪。",
      tryLabel: "试用龙胆枪 (2)", tryAction: "weapon:spear", tryKeys: ["tagSwitch", "weapon_form"]
    },
    {
      id: "unlock_golden_arts", min: "golden", badge: "金丹秘匣", title: "山海灵骑 (J) / 奇门八门阵 (U) / 自创剑谱 (7)",
      line1: "太虚秘匣初阶已开：J 键呼灵骑冲锋，U 键布奇门四门，7 键混编四段剑谱。",
      line2: "按 J/U/7 即可触发，点击【试用】立即脚下布设奇门风水阵。",
      tryLabel: "试用奇门阵 (U)", tryAction: "action:qimen", tryKeys: ["qimen", "mount", "sequencer"]
    },
    {
      id: "unlock_golden_eco", min: "golden", badge: "金丹启星", title: "九霄云海空战 / 周天星图 (N)",
      line1: "舆图开启云海空战过渡关，N 键点亮二十八星宿激活四象圣核加成。",
      line2: "按 N 键打开周天星图，或点击【试用】查看二十八星宿。",
      tryLabel: "打开星图 (N)", tryAction: "modal:star_chart", tryKeys: ["star_chart"]
    },
    {
      id: "unlock_nascent_arts", min: "nascent", badge: "元婴法身", title: "一气化三清 (4) / 法天象地 (O)",
      line1: "4 键召双法身同步复刻招式（二段归元斩），O 键化十丈元神真身霸体破甲。",
      line2: "按 4 或 O 键即可释放，点击【试用】凝练一气化三清法身。",
      tryLabel: "试用三清 (4)", tryAction: "action:sanqing", tryKeys: ["sanqing", "astral"]
    },
    {
      id: "unlock_nascent_eco", min: "nascent", badge: "元婴破虚", title: "九州灵脉远征 (8) / 登仙台 (L) / 万剑冢七阵",
      line1: "8 键委派已结缘故人驻防灵脉，L 键闯九重登仙台，仙阁启万剑冢七阵。",
      line2: "按 8 或 L 键即刻进入，点击【试用】展开灵脉远征沙盘。",
      tryLabel: "打开远征 (8)", tryAction: "modal:expedition", tryKeys: ["expedition", "spire"]
    },
    {
      id: "unlock_spirit_arts", min: "spirit", badge: "化神绝巅", title: "山河社稷图 (5) / 凌霄仙舟 (6)",
      line1: "5 键展开宣纸画中界烙九字破画斩，6 键召宗门仙舟锁链主炮天基轰炸。",
      line2: "按 5 或 6 键即可施放，点击【试用】展开山河社稷画中界。",
      tryLabel: "试用社稷图 (5)", tryAction: "action:shanhe", tryKeys: ["shanhe", "warship"]
    },
    {
      id: "unlock_spirit_eco", min: "spirit", badge: "化神造化", title: "天道劫印契约 / 造化种子工坊",
      line1: "问道录终局页启五道天道劫印飙升倍率，造化工坊可自定义双王 CY22 种子。",
      line2: "可赴目标终局页缔结劫印，或点击【试用】开启造化种子工坊。",
      tryLabel: "打开造化工坊", tryAction: "modal:workshop", tryKeys: ["workshop"]
    }
  ];

  function isUnlockCardEarned(g, card) {
    if (!g || !card) return false;
    if (card.id === "unlock_ally_coop") return countBondedAllies(g) > 0 || rankOf(g.realm) >= 1;
    if (card.id === "unlock_qi_eco") return rankOf(g.realm) >= 1 || !!(g.pet && g.pet.id);
    return rankOf(g.realm) >= rankOf(card.min || "mortal");
  }

  function isActionUnlockedByRealm(g, act) {
    if (!g) return false;
    if (sandboxMode || g.unlockAllArcana) return true;
    const req = ACTION_REALM_REQ[act] !== undefined ? ACTION_REALM_REQ[act] : 0;
    if (req <= 0) return true;
    if (act === "ally" && countBondedAllies(g) > 0) return true;
    if (act === "pet" && g.pet && g.pet.id) return true;
    return rankOf(g.realm) >= req;
  }

  function guardActionRealm(act) {
    if (!game) return false;
    if (isActionUnlockedByRealm(game, act)) return true;
    const reqRank = ACTION_REALM_REQ[act] || 1;
    const reqRealmId = REALM_ORDER[reqRank] || "qi";
    const reqName = (REALMS[reqRealmId] && REALMS[reqRealmId].name) || "高阶";
    const actName = ACTION_DISPLAY_NAME[act] || act;
    showToast(`🔒 【${actName}】将于【${reqName}期】解封（或在右上【仙阁】开启演武沙盒）`, { tier: 1, key: `c12_realm_${act}`, throttleMs: 4000 });
    return false;
  }

  function consumePlayerMp(baseCost, label = "神通") {
    if (!game || baseCost <= 0) return true;
    const discount = (game.loadout && game.loadout.mind === "talisman_calm" ? 0.78 : 1.0) * (hasLaw(game, "relic_awake") ? 0.85 : 1.0);
    const cost = Math.max(4, Math.round(baseCost * discount));
    const curMp = Math.floor(game.mp || 0);
    if (curMp < cost) {
      showToast(`💧 剑元不足！施展【${label}】需 ${cost} 点剑元（当前 ${curMp} · 普攻/识破/回灵丹恢复）`, { tier: 1, key: "c12_mp", throttleMs: 4000 });
      if (arena && arena.player) {
        addFloat(`剑元不足(${curMp}/${cost})`, arena.player.x, arena.player.y - 46, "#80c8ff", 14, false, { banner: false });
      }
      return false;
    }
    game.mp = Math.max(0, (game.mp || 0) - cost);
    return true;
  }

  function canExecuteActionImmediately(act) {
    if (!game || arena.paused) return false;
    if (!isActionUnlockedByRealm(game, act)) return false;
    if (act === "astral" || act === "mount" || act === "qimen") return true;
    if (act === "jump" && arena.mountState && arena.mountState.active) return true;
    if (arena.hitStop > 0.005) return false;
    const p = arena.player;
    if (act === "posture") return true;
    if (act === "tagSwitch") return (arena.tagSwitchCd || 0) <= 0; // Tag-Team Rescue ignores stun/hitstop/recovery!
    if (act === "soul") return (arena.soulCd || 0) <= 0; // Soul-Cancel ignores slash/dash recovery!
    if (act === "jump") return (p.z || 0) <= 18 && (p.jumpCd || 0) <= 0;
    if (act === "swordBlink") return (p.blinkCd || 0) <= 0;
    if (act === "slash") return p.slashCd <= 0 && p.dashTimer <= 0.06;
    if (act === "recall") {
      const canMorph = p.comboWindow > 0.25 && (arena.morphCd || 0) <= 0;
      return (canMorph || p.recallCd <= 0) && p.dashTimer <= 0.08;
    }
    if (act === "dash") return p.dashCd <= 0;
    if (act === "ult") return p.ultCd <= 0;
    if (act === "finisher") return (arena.swordIntent || 0) >= 100 && (arena.ultCineTimer || 0) <= 0;
    return true;
  }

  function executeActionImmediate(act, fromBuffer = false) {
    if (!guardActionRealm(act)) return;
    notifyUnlockCardTried(act);
    const labelMap = { posture: (arena.player.comboWindow > 0.12 || arena.player.dashTimer > 0) ? "☯易剑连携斩" : "易剑切姿", slash: `${arena.weaponPosture === "xuanzhong" ? "巨阙" : "疾剑"}S${((arena.player.comboWindow > 0 ? arena.player.comboStep + 1 : 0) % 4) + 1}`, recall: (arena.player.comboWindow > 0.25 && (arena.morphCd || 0) <= 0) ? "切手重技" : "收剑爆印", dash: "闪身/剑反", stance: "变阵", ult: "法宝剑域", finisher: "真传奥义", ally: "故人助阵", pet: "灵兽绝技", pill: "仙葫/回春丹", meditate: "吐纳/渡劫" };
    if (labelMap[act]) pushTelemetryInput((fromBuffer ? "⚡" : "") + labelMap[act], fromBuffer);
    if (arena.bladeClash && ["slash", "recall", "dash", "soul", "posture"].includes(act)) {
      pumpBladeClashInput();
      return;
    }
    if (act === "astral") { triggerAstralGiantForm(); return; }
    if (act === "mount") { triggerMythicMountAction(); return; }
    if (act === "qimen") { deployOrCycleQimenArray(); return; }
    if (act === "tagSwitch") { triggerTagTeamSwitch(); return; }
    if (act === "posture") triggerPostureSwitch();
    else if (act === "soul") castSoulSpiritSkill();
    else if (act === "slash") fireManualSlash();
    else if (act === "recall") recallAndDetonateSwords();
    else if (act === "dash") triggerDashParry();
    else if (act === "stance") cycleSwordStance();
    else if (act === "ult") castSwordRainUlt();
    else if (act === "finisher") castStyleUltimateCinematic();
    else if (act === "ally") summonAllyCoop();
    else if (act === "pet") castPetUltimate();
    else if (act === "jump") triggerSkyJump();
    else if (act === "swordBlink") triggerSwordBlink();
    else if (act === "meditate") {
      const rNow = game && REALMS[game.realm];
      const xpFull = rNow && rNow.xpCap > 0 && game.xp >= rNow.xpCap && !arena.tribulation && game.status === "active";
      if (xpFull) startLiveTribulation();
      else toggleMeditation();
    }
    else if (act === "pill") useQuickHealingPill();
  }

  function triggerMappedAction(act) {
    if (act === "hub") {
      closeDrawer();
      if (arena.sanctumMode) initArenaStage(arena.stageIdx, false);
      else enterSanctumHub();
      return;
    }
    if (act === "telemetry") {
      toggleTelemetryPanel();
      return;
    }
    if (act === "photo") {
      togglePhotoMode();
      return;
    }
    if (!game || arena.paused) return;
    if (!guardActionRealm(act)) return;
    if (act === "tagSwitch" && (arena.tagSwitchCd || 0) <= 0) {
      executeActionImmediate("tagSwitch", false);
      return;
    }
    if (canExecuteActionImmediately(act)) {
      executeActionImmediate(act, false);
    } else if (["posture", "soul", "jump", "swordBlink", "slash", "recall", "dash", "ult", "finisher"].includes(act)) {
      // Queue into 140ms Console Input Buffer!
      arena.inputBuffer = arena.inputBuffer.filter(it => it.act !== act);
      arena.inputBuffer.push({ act, ttl: 0.140 });
      if (arena.inputBuffer.length > 2) arena.inputBuffer.shift();
    }
  }

  function flushInputBuffer(dt) {
    if (!arena.inputBuffer || !arena.inputBuffer.length) return;
    for (let i = arena.inputBuffer.length - 1; i >= 0; i--) {
      arena.inputBuffer[i].ttl -= dt;
      if (arena.inputBuffer[i].ttl <= 0) {
        arena.inputBuffer.splice(i, 1);
      }
    }
    for (let i = 0; i < arena.inputBuffer.length; i++) {
      const item = arena.inputBuffer[i];
      if (canExecuteActionImmediately(item.act)) {
        arena.inputBuffer.splice(i, 1);
        executeActionImmediate(item.act, true);
        break;
      }
    }
  }

  // Interactive Destructible Battlefield Hazards & Five-Elements Reaction System
  function spawnStageInteractiveHazards() {
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;
    arena.waterPools = [];
    arena.fireZones = [];
    if (arena.sanctumMode || (arena.stageIdx === 0 && !game.openingChoice)) return;

    // 1. Conductive Spirit Spring Water Pools (`灵泉水洼`: Reacts with Lightning -> Electro-Paralysis, Frost -> Ice Field)
    const wp1 = clampToPlaza(w * 0.46, h * 0.61, w, h);
    const wp2 = clampToPlaza(w * 0.58, h * 0.45, w, h);
    arena.waterPools.push({ x: wp1.x, y: wp1.y, r: 78, electroTimer: 0, frozenTimer: 0, tickCd: 0 });
    if (arena.stageIdx === 2 || arena.waveIdx >= 1 || arena.towerMode) {
      arena.waterPools.push({ x: wp2.x, y: wp2.y, r: 72, electroTimer: 0, frozenTimer: 0, tickCd: 0 });
    }

    // 2. Destructible Elemental Terrain Props (`玄冰灵晶簇 / 古剑残碑 / 丹火赤铜炉`)
    const st = getCombatStats(game);
    const propHp = Math.max(45, Math.round(st.atk * 2.4));
    arena.props = arena.props.filter(p => !p.destructible || p.kind === "ward_pylon" || p.kind === "rough_jade");

    const pFrost = clampToPlaza(w * 0.45, h * 0.59, w, h);
    arena.props.push({
      id: "haz_frost_" + Math.random().toString(36).slice(2, 7),
      kind: "frost_crystal", destructible: true, art: "prop_frost_crystal",
      name: "玄冰灵晶簇", badge: "击碎冻结群妖 · 凝寒泉",
      x: pFrost.x, y: pFrost.y, r: 34, hp: propHp, maxHp: propHp, hitFlash: 0
    });

    const pSword = clampToPlaza(w * 0.56, h * 0.65, w, h);
    arena.props.push({
      id: "haz_sword_" + Math.random().toString(36).slice(2, 7),
      kind: "sword_remnant", destructible: true, art: "relic_frost_sword",
      name: "古剑残碑", badge: "击碎迸发八方剑罡 · 补剑意",
      x: pSword.x, y: pSword.y, r: 32, hp: propHp, maxHp: propHp, hitFlash: 0
    });

    if (arena.stageIdx !== 2) {
      const pFire = clampToPlaza(w * 0.55, h * 0.42, w, h);
      arena.props.push({
        id: "haz_fire_" + Math.random().toString(36).slice(2, 7),
        kind: "fire_brazier", destructible: true, art: "furnace",
        name: "丹火赤铜炉", badge: "击碎燃起丹炎火海",
        x: pFire.x, y: pFire.y, r: 34, hp: propHp, maxHp: propHp, hitFlash: 0
      });
    }

    // 3. V20 Cracked Five-Elements Bagua Secret Grotto Wall (`五行八卦破壁秘窟`) & Sword-Glide Ravine Zipline (`御剑流光索道`)!
    if (!arena.bossRush) {
      const pBagua = clampToPlaza(w * 0.64, h * 0.35, w, h);
      arena.props.push({
        id: "bagua_wall_" + Math.random().toString(36).slice(2, 7),
        kind: "bagua_secret_wall", destructible: true, art: "prop_bagua_secret_gate",
        name: "五行八卦秘窟封壁", badge: "击碎破壁 · 开启上古仙人藏宝室与满状态太初灵泉！",
        x: pBagua.x, y: pBagua.y, r: 44, hp: Math.round(propHp * 1.15), maxHp: Math.round(propHp * 1.15), hitFlash: 0
      });
      const pZip = clampToPlaza(w * 0.34, h * 0.63, w, h);
      arena.props.push({
        id: "ravine_zip_" + Math.random().toString(36).slice(2, 7),
        kind: "ravine_zipline", destructible: false, art: "prop_guardian_sword_pylon",
        name: "御剑流光索道台", badge: "点击/Enter 或按 F 御剑飞渡深渊 · 剑威+25%",
        x: pZip.x, y: pZip.y, r: 36, progress: 0
      });
    }
  }

  function spawnBossPhase2WardPylons(boss) {
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;
    const st = getCombatStats(game);
    const pylonHp = Math.max(70, Math.round(st.atk * 3.1));
    arena.props = arena.props.filter(p => p.kind !== "ward_pylon");
    const offsets = [[-155, -65], [135, 72]];
    offsets.forEach(([ox, oy], idx) => {
      const pos = clampToPlaza(boss.x + ox, boss.y + oy, w, h);
      arena.props.push({
        id: "ward_pylon_" + idx + "_" + Date.now(),
        kind: "ward_pylon", destructible: true, art: "prop_ward_pylon",
        name: "镇妖护法阵眼", badge: "击碎破首领金身 · 逆转天象!",
        x: pos.x, y: pos.y, r: 36, hp: pylonHp, maxHp: pylonHp, hitFlash: 0, bossUid: boss.uid
      });
    });
    addFloat("⚠ 阵眼升起！击碎【镇妖阵眼柱】破除金身逆转天象！", boss.x, boss.y - 96, "#ffd97d", 18, true);
  }

  function triggerElectroPoolReaction(lx, ly, baseDmg = 20) {
    if (!arena.waterPools || !arena.waterPools.length) return false;
    let reacted = false;
    for (const wp of arena.waterPools) {
      if (Math.hypot(lx - wp.x, (ly - wp.y) / 0.62) < wp.r + 74) {
        const wasIdle = wp.electroTimer <= 0.2;
        wp.electroTimer = 4.5;
        wp.frozenTimer = 0;
        reacted = true;
        if (wasIdle) {
          Sound.thunderCrack();
          GamepadSystem.rumble(0.52, 0.38, 120);
          addFloat("⚡ 五行反应 · 雷泽感电麻痹！", wp.x, wp.y - 26, "#d69eff", 18, true);
        }
      }
    }
    return reacted;
  }

  function damageBattleProp(pr, rawDmg, elemHint = null) {
    if (!pr || !pr.destructible || pr.hp <= 0 || !game) return;
    pr.hp = Math.max(0, pr.hp - Math.max(1, Math.round(rawDmg)));
    pr.hitFlash = 0.14;
    Sound.clang(pr.kind === "frost_crystal" ? 1.55 : 1.15, 0.08);
    spawnSparks(pr.x, pr.y - 10, 6, 0, 3.14, pr.kind === "frost_crystal" ? "#80ecff" : "#ffe28a");

    // Wind-Blade Chakram hitting Fire Brazier expands Fire Zone even before shatter!
    if (pr.kind === "fire_brazier" && elemHint === "wind") {
      arena.fireZones.push({ x: pr.x, y: pr.y, r: 138, life: 5.2, tickCd: 0.1 });
      addFloat("🌪🔥 风助火势 · 燎原炎狱！", pr.x, pr.y - 44, "#ff9f43", 17, true);
    }
    if (pr.hp <= 0) shatterBattleProp(pr);
  }

  function shatterBattleProp(pr) {
    const idx = arena.props.indexOf(pr);
    if (idx >= 0) arena.props.splice(idx, 1);
    const st = getCombatStats(game);
    arena.shake = Math.max(arena.shake, 11);
    arena.hitStop = Math.max(arena.hitStop, 0.055);
    GamepadSystem.rumble(0.65, 0.55, 150);
    arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 22);

    // Drop glowing Spirit Essence Orb (`灵气精魄`)
    arena.drops.push({ kind: "essence", x: pr.x, y: pr.y, vx: -1.8, vy: -1.5, val: 20 });

    const prevBucket = arena.currentDmgBucket;
    arena.currentDmgBucket = "thunder_elem";

    if (pr.kind === "bagua_secret_wall") {
      Sound.coreSeverBoom();
      Sound.fanfare();
      spawnDistortionRing(pr.x, pr.y, 210, "#ffe28a");
      addRipple(pr.x, pr.y + 14, 185, "#70ffe6");
      if (!isPracticeModeActive()) {
        spawnGearDrop(pr.x - 18, pr.y + 10, Math.min(4, 2 + Math.floor(arena.stageIdx / 2)));
        for (let k = 0; k < 4; k++) spawnDrop("stone", pr.x + (k - 1.5) * 20, pr.y + 8, 30);
      }
      arena.props.push({
        id: "immortal_spring_" + Date.now(),
        kind: "immortal_spring", destructible: false, art: "prop_bagua_secret_gate",
        name: "上古秘窟 · 太初满灵泉", badge: isPracticeModeActive() ? "点击/Enter 全满气血/仙葫/剑意（练习模式）" : "点击/Enter 全满气血/仙葫/剑意 · 永久剑攻+8！",
        x: pr.x, y: pr.y, r: 46, progress: 0
      });
      showToast(isPracticeModeActive()
        ? "☯ 八卦封壁击破！上古秘窟【太初满灵泉】现世（练习模式不掉落仙装与灵石）！"
        : "☯ 八卦封壁击破！上古仙人藏宝秘窟洞开，爆出仙装与【太初满灵泉】！");
      addFloat("☯ 八卦破壁 · 上古藏宝秘窟洞开！！", pr.x, pr.y - 52, "#ffe89e", 20, true);
    } else if (pr.kind === "frost_crystal") {
      Sound.bianzhong(783.99, 0.10);
      addRipple(pr.x, pr.y + 12, 168, "#80ecff");
      arena.frostPools.push({ x: pr.x, y: pr.y, r: 105, life: 5.5, friendlyFrost: true });
      arena.waterPools.forEach(wp => {
        if (Math.hypot(wp.x - pr.x, wp.y - pr.y) < wp.r + 125) {
          wp.frozenTimer = 6.5; wp.electroTimer = 0;
        }
      });
      addFloat("❄ 玄冰灵晶碎裂 · 冰封百里！", pr.x, pr.y - 46, "#80ecff", 19, true);
      arena.enemies.slice().forEach(e => {
        if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + 175) {
          e.chillTimer = 5.0;
          e.flinchTimer = Math.max(e.flinchTimer || 0, 1.35);
          damageEnemy(e, Math.round(st.atk * 2.25), true, 34, Math.atan2(e.y - pr.y, e.x - pr.x), 8, true);
        }
      });
    } else if (pr.kind === "sword_remnant") {
      Sound.deflectClang();
      addDecal(pr.x, pr.y + 12, 0, 62, "spider_crack");
      addFloat("🗡 古剑残碑共鸣 · 八方裂碑剑罡！", pr.x, pr.y - 46, "#ffe89e", 19, true);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI * 2) / 8;
        arena.projectiles.push({
          friendly: true, kind: "crescent", x: pr.x, y: pr.y,
          vx: Math.cos(a) * 14.2, vy: Math.sin(a) * 10.5, ang: a, r: 58,
          dmg: Math.round(st.atk * 1.95), postureDmg: 20, knock: 7, addMark: 2, life: 0.62,
          pierced: new Set(), color: "#ffe28a"
        });
      }
      if (!isPracticeModeActive()) spawnDrop("stone", pr.x + 12, pr.y, 28);
    } else if (pr.kind === "fire_brazier") {
      Sound.drum(0.26);
      addDecal(pr.x, pr.y + 12, 0, 68, "scorch");
      arena.fireZones.push({ x: pr.x, y: pr.y, r: 118, life: 6.0, tickCd: 0.1 });
      addFloat("🔥 丹火铜炉爆燃 · 焚世真炎！", pr.x, pr.y - 46, "#ff9f43", 19, true);
      arena.enemies.slice().forEach(e => {
        if (Math.hypot(e.x - pr.x, e.y - pr.y) < e.r + 155) {
          e.burnTimer = 5.5;
          damageEnemy(e, Math.round(st.atk * 2.4), true, 36, Math.atan2(e.y - pr.y, e.x - pr.x), 9, true);
        }
      });
    } else if (pr.kind === "ward_pylon") {
      Sound.deflectClang();
      Sound.thunderCrack();
      addDecal(pr.x, pr.y + 14, 0, 76, "spider_crack");
      const remainingPylons = arena.props.filter(p => p.kind === "ward_pylon" && p.hp > 0);
      if (remainingPylons.length === 0) {
        arena.reversedDomainTimer = 10.0;
        arena.bossDomain = { id: "reversed", name: "逆转天象 · 太虚佑世界", skyTint: "rgba(32, 118, 108, 0.14)", weather: "jade_motes" };
        Sound.triggerDucking(420, 0.30, 950);
        GamepadSystem.rumble(0.95, 0.90, 260);
        addFloat("☯ 阵眼全破！首领金身崩碎 · 逆转天象增伤+20% / 攻速+20%！！", pr.x, pr.y - 58, "#70ffe6", 22, true);
        arena.enemies.slice().forEach(e => {
          if (e.isBoss || e.isDummy) {
            e.wardHp = 0;
            damageEnemy(e, Math.round(st.atk * 3.4), true, Math.round(e.maxPosture * 0.62), 0, 10, true);
          }
        });
      } else {
        addFloat(`⚡ 击毁阵眼柱！（余 ${remainingPylons.length} 座破除金身）`, pr.x, pr.y - 48, "#ffe28a", 18, true);
      }
    }
    arena.currentDmgBucket = prevBucket;
    updateHud();
  }

  function stepElementalHazards(dt, st) {
    // Water Pools: Electro-Charged Paralysis ticks & Frost Brittle aura
    for (const wp of arena.waterPools) {
      if (wp.electroTimer > 0) {
        wp.electroTimer = Math.max(0, wp.electroTimer - dt);
        wp.tickCd = (wp.tickCd || 0) - dt;
        if (wp.tickCd <= 0) {
          wp.tickCd = 0.45;
          const prevB = arena.currentDmgBucket;
          arena.currentDmgBucket = "thunder_elem";
          arena.enemies.slice().forEach(e => {
            if (e.hp > 0 && Math.hypot(e.x - wp.x, (e.y - wp.y) / 0.60) < wp.r + e.r) {
              e.flinchTimer = Math.max(e.flinchTimer || 0, 0.34);
              e.swordMarks = Math.min(6, (e.swordMarks || 0) + 1);
              arena.lightnings.push({ x1: wp.x + (Math.random() - 0.5) * 40, y1: wp.y, x2: e.x, y2: e.y - 10, t: 0, color: "#9effec" });
              damageEnemy(e, Math.max(4, Math.round(st.atk * 0.68)), false, 9, 0, 1.0, false);
            }
          });
          arena.currentDmgBucket = prevB;
        }
      }
      if (wp.frozenTimer > 0) {
        wp.frozenTimer = Math.max(0, wp.frozenTimer - dt);
        arena.enemies.forEach(e => {
          if (Math.hypot(e.x - wp.x, (e.y - wp.y) / 0.60) < wp.r + e.r) {
            e.chillTimer = Math.max(e.chillTimer || 0, 0.8);
          }
        });
      }
    }
    // Fire Zones
    for (let fi = arena.fireZones.length - 1; fi >= 0; fi--) {
      const fz = arena.fireZones[fi];
      fz.life -= dt;
      fz.tickCd -= dt;
      if (fz.tickCd <= 0) {
        fz.tickCd = 0.48;
        const prevB = arena.currentDmgBucket;
        arena.currentDmgBucket = "thunder_elem";
        arena.enemies.slice().forEach(e => {
          if (e.hp > 0 && Math.hypot(e.x - fz.x, (e.y - fz.y) / 0.60) < fz.r + e.r) {
            e.burnTimer = Math.max(e.burnTimer || 0, 2.0);
            damageEnemy(e, Math.max(4, Math.round(st.atk * 0.62)), false, 6, 0, 0.8, false);
          }
        });
        arena.currentDmgBucket = prevB;
      }
      if (fz.life <= 0) arena.fireZones.splice(fi, 1);
    }
    if (arena.reversedDomainTimer > 0) {
      arena.reversedDomainTimer = Math.max(0, arena.reversedDomainTimer - dt);
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + dt * 5.5);
      if (arena.reversedDomainTimer <= 0 && arena.bossDomain && arena.bossDomain.id === "reversed") {
        arena.bossDomain = null;
      }
    }
  }

  // F20: Focused Dojo Practice Drills + Ephemeral Training Session + Sandbox-Only 2+1 Slot Prototype (D02/D07)
  const DOJO_MODE_META = Object.freeze({
    static:              { name: "定身测伤桩", isDrill: false, target: 0, hint: "自由测试连招伤害与 DPS，不产出正式灵石/成就" },
    gold_parry:          { name: "金芒识破",   isDrill: false, target: 0, hint: "在金芒亮起时按空格或切手右键触发剑反" },
    red_peril:           { name: "红危凝时",   isDrill: false, target: 0, hint: "在红光【危】闪现瞬间按空格触发太虚凝时" },
    low_sweep:           { name: "下段踏剑",   isDrill: false, target: 0, hint: "下段地裂横扫时按 Z 凌空踏剑借力" },
    blade_clash:         { name: "拼刀破擒",   isDrill: false, target: 0, hint: "【擒】字亮起时按右键/`/C 迎击拼刀" },
    mixed_ward:          { name: "五行阵眼",   isDrill: false, target: 0, hint: "击碎阵眼柱与玄冰晶演练破金身逆转天象" },
    drill_mark_detonate: { name: "专项 · 叠印爆剑", isDrill: true, target: 3, hint: "普攻叠满 ≥3 层剑印后按右键爆剑碎盾（完成 3 次通关）" },
    drill_dodge_counter: { name: "专项 · 危招识破", isDrill: true, target: 3, hint: "应对金芒/红危交替招式，按空格完成 3 次识破或极限凝时" },
    drill_morph_combo:   { name: "专项 · 连招派生", isDrill: true, target: 3, hint: "左键出招后在连招窗内按右键触发 3 次六象特技派生" }
  });

  let sandboxSlotPrototype = false;

  function syncSandboxSlotPrototypeButton() {
    const btn = document.getElementById("btn-sandbox-slot-proto");
    const dock = document.getElementById("action-skill-dock");
    if (!sandboxMode) {
      sandboxSlotPrototype = false;
      if (dock) dock.classList.remove("sandbox-slot-proto-active");
      if (btn) {
        btn.style.display = "none";
        btn.classList.remove("active");
        btn.textContent = "演武槽位试验 (2主动+1奥义): 关";
      }
      return;
    }
    if (dock) dock.classList.toggle("sandbox-slot-proto-active", sandboxSlotPrototype);
    if (btn) {
      btn.style.display = "";
      btn.classList.toggle("active", sandboxSlotPrototype);
      btn.textContent = sandboxSlotPrototype
        ? "演武槽位试验 (2主动+1奥义): 开"
        : "演武槽位试验 (2主动+1奥义): 关";
    }
  }

  function getSandboxSlotPrototype() {
    if (!sandboxMode) sandboxSlotPrototype = false;
    return {
      active: Boolean(sandboxMode && sandboxSlotPrototype),
      sandboxOnly: true,
      layout: (sandboxMode && sandboxSlotPrototype)
        ? { activeSlots: ["orb-ult", "orb-soul"], ultimateSlot: "orb-finisher", label: "2主动+1奥义试验槽位" }
        : null
    };
  }

  function setSandboxSlotPrototype(enabled) {
    if (!sandboxMode) {
      sandboxSlotPrototype = false;
      syncSandboxSlotPrototypeButton();
      return { active: false, reason: "sandbox_only", layout: null };
    }
    sandboxSlotPrototype = Boolean(enabled);
    syncSandboxSlotPrototypeButton();
    showToast(sandboxSlotPrototype
      ? "🧪 已启用沙盒【2主动+1奥义】槽位试验（仅限演武沙盒，退出沙盒自动还原）"
      : "🧪 已关闭沙盒槽位试验，恢复完整技能栏显示");
    return getSandboxSlotPrototype();
  }

  function createFreshDojoSession(mode = "static") {
    const spec = DOJO_MODE_META[mode] || DOJO_MODE_META.static;
    return {
      mode: hasOwn(DOJO_MODE_META, mode) ? mode : "static",
      modeName: spec.name,
      isDrill: spec.isDrill,
      startedAt: Date.now(),
      hits: 0,
      totalDmg: 0,
      peakHit: 0,
      parries: 0,
      dodges: 0,
      detonates: 0,
      morphStrikes: 0,
      progress: 0,
      target: spec.target,
      completed: false,
      grade: "—",
      lastFeedback: spec.hint
    };
  }

  function ensureDojoSession() {
    if (!arena.dojoSession || typeof arena.dojoSession !== "object") {
      arena.dojoSession = createFreshDojoSession(arena.dojoMode || "static");
    }
    return arena.dojoSession;
  }

  function isSanctumDojoActive() {
    return Boolean(arena.sanctumMode && !(arena.sectDefense && arena.sectDefense.active));
  }

  function syncDojoTrainingHudVisibility() {
    syncSandboxSlotPrototypeButton();
    const hud = document.getElementById("dojo-training-hud");
    if (!hud) return;
    const show = isSanctumDojoActive();
    hud.classList.toggle("active", show);
    if (show) renderDojoTrainingHud();
  }

  function renderDojoTrainingHud() {
    const hud = document.getElementById("dojo-training-hud");
    if (!hud || !hud.classList.contains("active")) return;
    const ds = ensureDojoSession();
    const elapsedSec = Math.max(1, (Date.now() - (ds.startedAt || Date.now())) / 1000);
    const liveDps = ds.hits > 0 ? Math.round(ds.totalDmg / Math.min(elapsedSec, 15)) : 0;
    const modeEl = document.getElementById("dojo-hud-mode-name");
    const gradeEl = document.getElementById("dojo-hud-grade");
    const dpsEl = document.getElementById("dojo-hud-dps");
    const hitsEl = document.getElementById("dojo-hud-hits");
    const peakEl = document.getElementById("dojo-hud-peak");
    const progEl = document.getElementById("dojo-hud-progress");
    const statEl = document.getElementById("dojo-hud-status");
    const fbEl = document.getElementById("dojo-hud-feedback");
    if (modeEl) modeEl.textContent = `演武训练 · ${ds.modeName}`;
    if (gradeEl) {
      gradeEl.textContent = `评级 ${ds.grade}`;
      gradeEl.className = `tag-chip ${ds.completed ? "mythic" : ds.progress > 0 ? "done" : ""}`;
    }
    if (dpsEl) dpsEl.textContent = liveDps.toLocaleString();
    if (hitsEl) hitsEl.textContent = String(ds.hits);
    if (peakEl) peakEl.textContent = ds.peakHit.toLocaleString();
    if (progEl) {
      progEl.textContent = ds.isDrill
        ? `专项进度：${ds.progress}/${ds.target}`
        : `练习进度：自由演武（爆印 ${ds.detonates} · 识破 ${ds.parries + ds.dodges} · 派生 ${ds.morphStrikes}）`;
    }
    if (statEl) {
      statEl.textContent = ds.isDrill ? (ds.completed ? "✓ 已达标" : "演练中") : "自由态";
      statEl.style.color = ds.completed ? "#ffe28a" : "#70ffe6";
    }
    if (fbEl) fbEl.textContent = ds.lastFeedback;
  }

  function recordDojoTrainingHit(dmg) {
    if (!isSanctumDojoActive()) return;
    const ds = ensureDojoSession();
    const d = Math.max(0, Math.round(num(dmg, 0)));
    if (ds.hits === 0) ds.startedAt = Date.now();
    ds.hits += 1;
    ds.totalDmg += d;
    if (d > ds.peakHit) ds.peakHit = d;
    if (!ds.isDrill) {
      ds.grade = computeModeGrade("dojo", { isDrill: false, hits: ds.hits });
    } else if (!ds.completed && ds.progress === 0) {
      ds.grade = "C";
    }
    renderDojoTrainingHud();
  }

  function recordDojoDrillEvent(kind, detail = "") {
    if (!isSanctumDojoActive()) return;
    const ds = ensureDojoSession();
    if (kind === "detonate") ds.detonates += 1;
    else if (kind === "parry") ds.parries += 1;
    else if (kind === "dodge") ds.dodges += 1;
    else if (kind === "morph") ds.morphStrikes += 1;

    let advance = false;
    if (ds.mode === "drill_mark_detonate" && kind === "detonate") {
      const marks = Number(detail) || 0;
      if (marks >= 3) {
        advance = true;
        ds.lastFeedback = `✓ 满印爆剑命中（引爆 ${marks} 层剑印）！`;
        const dummy = arena.enemies.find(e => e.isDummy);
        if (dummy) { dummy.wardHp = dummy.maxWardHp || 120; }
      } else {
        ds.lastFeedback = `剑印仅 ${marks} 层，请先左键叠满 ≥3 层再按右键爆剑！`;
      }
    } else if (ds.mode === "drill_dodge_counter" && (kind === "parry" || kind === "dodge")) {
      advance = true;
      ds.lastFeedback = kind === "parry" ? "✓ 金芒识破成功！" : "✓ 红危太虚凝时成功！";
    } else if (ds.mode === "drill_morph_combo" && kind === "morph") {
      advance = true;
      ds.lastFeedback = `✓ 六象切手派生【${detail || getCurrentSixAspectSpec().name}】成功！`;
    }

    if (advance && ds.isDrill) {
      ds.progress = Math.min(ds.target, ds.progress + 1);
      if (ds.progress >= ds.target) {
        ds.completed = true;
        ds.grade = computeModeGrade("dojo", { isDrill: true, completed: true, progress: ds.progress });
        ds.lastFeedback = `🏆 专项【${ds.modeName}】已达标（${ds.progress}/${ds.target}）！可重置继续打磨手感`;
      } else {
        ds.grade = computeModeGrade("dojo", { isDrill: true, completed: false, progress: ds.progress });
      }
    }
    renderDojoTrainingHud();
  }

  function resetDojoTrainingStats() {
    arena.dojoSession = createFreshDojoSession(arena.dojoMode || "static");
    renderDojoTrainingHud();
    return getDojoTrainingState();
  }

  function getDojoTrainingState() {
    const ds = ensureDojoSession();
    const elapsedSec = Math.max(1, (Date.now() - (ds.startedAt || Date.now())) / 1000);
    return Object.assign({}, ds, {
      dps: ds.hits > 0 ? Math.round(ds.totalDmg / Math.min(elapsedSec, 15)) : 0,
      hudVisible: isSanctumDojoActive()
    });
  }

  function setDojoMode(mode) {
    const nextMode = hasOwn(DOJO_MODE_META, mode) ? mode : "static";
    arena.dojoMode = nextMode;
    arena.dojoSession = createFreshDojoSession(nextMode);
    if (isSanctumDojoActive() && game) {
      spawnDojoDummy(nextMode);
    }
    const curLbl = document.getElementById("lbl-dojo-cur-mode");
    if (curLbl) curLbl.textContent = DOJO_MODE_META[nextMode].name;
    syncDojoTrainingHudVisibility();
    return getDojoTrainingState();
  }

  // Sanctum Sword-Trial Dojo (`演武论剑坪 · 机关试剑木人桩`)
  function spawnDojoDummy(mode = null) {
    if (mode) {
      arena.dojoMode = hasOwn(DOJO_MODE_META, mode) ? mode : "static";
      if (!arena.dojoSession || arena.dojoSession.mode !== arena.dojoMode) {
        arena.dojoSession = createFreshDojoSession(arena.dojoMode);
      }
    } else if (!arena.dojoSession) {
      arena.dojoSession = createFreshDojoSession(arena.dojoMode || "static");
    }
    if (!isSanctumDojoActive() || !game) return;
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;
    const dPos = clampToPlaza(w * 0.54, h * 0.54, w, h);

    arena.enemies = arena.enemies.filter(e => !e.isDummy);
    arena.props = arena.props.filter(p => !p.isDojoProp);
    arena.waterPools = [];
    arena.fireZones = [];

    const meta = DOJO_MODE_META[arena.dojoMode] || DOJO_MODE_META.static;
    const isMarkDrill = arena.dojoMode === "drill_mark_detonate";
    const dummy = {
      uid: "dojo_dummy_main",
      id: "puppet", art: "prop_puppet_dummy",
      name: `试剑木人 · ${meta.name}`,
      isBoss: false, isDummy: true, isTreasure: false, enraged: false,
      mech: null, wardHp: isMarkDrill ? 120 : 0, maxWardHp: isMarkDrill ? 120 : 0, mirrorTimer: 0, blinkCd: 999,
      x: dPos.x, y: dPos.y, vx: 0, vy: 0, kx: 0, ky: 0, sx: 1, sy: 1,
      facing: dPos.x > arena.player.x ? -1 : 1,
      r: 40, hp: 99999, maxHp: 99999, posture: 120, maxPosture: 120,
      atk: 8, heavy: 12, state: "chase", timer: (arena.dojoMode === "static" || arena.dojoMode === "drill_mark_detonate" || arena.dojoMode === "drill_morph_combo") ? 1.25 : 0.03, windupDur: 0.98,
      aimX: arena.player.x, aimY: arena.player.y, attackType: "slam",
      hitFlash: 0, swordMarks: 0, chillTimer: 0, burnTimer: 0, dojoCycle: 0
    };
    arena.enemies.push(dummy);

    if (arena.dojoMode === "mixed_ward") {
      const st = getCombatStats(game);
      const pHp = Math.max(50, Math.round(st.atk * 2.2));
      const wpPos = clampToPlaza(dPos.x - 42, dPos.y + 24, w, h);
      arena.waterPools.push({ x: wpPos.x, y: wpPos.y, r: 78, electroTimer: 0, frozenTimer: 0, tickCd: 0 });
      const pyPos = clampToPlaza(dPos.x + 88, dPos.y - 38, w, h);
      arena.props.push({
        id: "dojo_pylon", kind: "ward_pylon", destructible: true, isDojoProp: true, art: "prop_ward_pylon",
        name: "演武阵眼柱", badge: "击碎体验破金身逆转天象!",
        x: pyPos.x, y: pyPos.y, r: 34, hp: pHp, maxHp: pHp, hitFlash: 0, bossUid: dummy.uid
      });
      const crPos = clampToPlaza(dPos.x - 92, dPos.y - 34, w, h);
      arena.props.push({
        id: "dojo_frost", kind: "frost_crystal", destructible: true, isDojoProp: true, art: "prop_frost_crystal",
        name: "演武玄冰晶", badge: "击碎体验寒泉凝冰!",
        x: crPos.x, y: crPos.y, r: 32, hp: pHp, maxHp: pHp, hitFlash: 0
      });
    }

    document.querySelectorAll("[data-dojo-mode]").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-dojo-mode") === arena.dojoMode);
    });
    syncDojoTrainingHudVisibility();
  }

  function stepDojoDummyAI(e, dt) {
    // Keep Wooden Dummy anchored cleanly & immortal
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;
    const anchor = clampToPlaza(w * 0.54, h * 0.54, w, h);
    e.x += (anchor.x - e.x) * 0.18;
    e.y += (anchor.y - e.y) * 0.18;
    if (e.hp < e.maxHp * 0.35) e.hp = e.maxHp;

    if (e.state === "stun") {
      e.timer -= dt;
      if (e.timer <= 0) { e.state = "chase"; e.posture = e.maxPosture; e.timer = 1.1; }
      return;
    }
    if (arena.dojoMode === "static" || arena.dojoMode === "drill_mark_detonate" || arena.dojoMode === "drill_morph_combo") {
      e.state = "chase";
      e.perilous = false;
      return;
    }
    const witchMult = arena.witchTime > 0 ? 0.28 : 1.0;
    if (e.state === "chase") {
      e.timer -= dt * witchMult;
      if (e.timer <= 0) {
        e.state = "windup";
        e.dojoCycle = (e.dojoCycle || 0) + 1;
        const isLowMode = arena.dojoMode === "low_sweep";
        const isClashMode = arena.dojoMode === "blade_clash";
        e.lowSweepWindup = isLowMode;
        e.grabWindup = isClashMode;
        e.perilous = (isLowMode || isClashMode) ? false : (arena.dojoMode === "red_peril" ? true : arena.dojoMode === "gold_parry" ? false : (e.dojoCycle % 2 === 0));
        e.timer = isClashMode ? 1.35 : isLowMode ? 1.05 : (e.perilous ? 1.05 : 0.95);
        e.curWindupTotal = e.timer;
        e.aimX = arena.player.x; e.aimY = arena.player.y;
        if (isClashMode) {
          Sound.perilousGong();
          addFloat("🤜【擒】暗金夺命投 · 出重击/切剑/C魂印正面拼刀角力！", e.x, e.y - 74, "#ffae33", 15, true);
        } else if (isLowMode) {
          Sound.perilousGong();
          addFloat("🌊【下段危】地裂横扫 · 按 Z 凌空踏剑借力！", e.x, e.y - 74, "#38f9d7", 15, true);
        } else if (e.perilous) {
          Sound.perilousGong();
          addFloat("【危】木人横扫 · 练习空格太虚凝时！", e.x, e.y - 72, "#ff6b6b", 15, true);
        } else {
          addFloat("✦ 金芒喂招 · 按空格或切手右键剑反！", e.x, e.y - 72, "#ffe89e", 15, true);
        }
      }
    } else if (e.state === "windup") {
      e.timer -= dt * witchMult;
      if (e.timer <= 0) {
        Sound.drum(0.16);
        if (e.grabWindup) {
          e.grabWindup = false;
          addRipple(e.x, e.y + 12, 95, "#ffae33");
          if (Math.hypot(arena.player.x - e.x, arena.player.y - e.y) < e.r + 90) {
            addFloat("未拼刀！（试在【擒】字亮起时按右键/`/C迎击）", arena.player.x, arena.player.y - 46, "#ffae33", 13);
          }
        } else if (e.lowSweepWindup) {
          e.lowSweepWindup = false;
          arena.groundSweeps.push({ x: e.x, y: e.y + 14, r: 22, maxR: 255, spd: 165, dmg: 0, hitPlayer: false, vaulted: false, owner: e });
        } else if (e.perilous) {
          arena.shockRings.push({ x: e.x, y: e.y + 12, r: 20, maxR: 235, spd: 175, hitPlayer: false, color: "#ff5e57" });
        } else {
          arena.slashes.push({ x: e.x, y: e.y, r: e.r + 82, ang: 0, t: 0, color: "#ffe28a", heavy: false });
          // Harmless training tap in Sanctum (never kills player, triggers tiny spark if unparried)
          if (arena.player.invuln <= 0 && Math.hypot(arena.player.x - e.x, arena.player.y - e.y) < e.r + 75) {
            addFloat("未识破（试在金芒亮起时按空格!）", arena.player.x, arena.player.y - 44, "#ffbe76", 13);
          }
        }
        e.perilous = false;
        e.state = "chase";
        e.timer = 1.45;
      }
    }
  }

  // 3 Build-Specific Cinema Letterbox Ultimate Finishers (`万剑归宗 / 紫霄雷帝 / 道侣三才`)
  function detectPrimaryBuildArchetype(g) {
    if (!g) return "wanjian";
    if (arena.activeAllies.length >= 2 || (hasLaw(g, "karma_resonance") && countBondedAllies(g) >= 3)) return "companion";
    if (isThunderBuild(g) && !hasLaw(g, "wanjian")) return "thunder";
    if (hasLaw(g, "thunder_body") && hasDestinyFruit(g, "thunder_soul")) return "thunder";
    return isWanJianBuild(g) ? "wanjian" : (isThunderBuild(g) ? "thunder" : (countBondedAllies(g) >= 2 ? "companion" : "wanjian"));
  }

  let ultCineHideTimer = null;
  function castStyleUltimateCinematic() {
    if (!game) return;
    if ((arena.swordIntent || 0) < 100) {
      showToast(`无上剑意蓄积中 (${Math.floor(arena.swordIntent || 0)}/100%) · 识破剑反/碎机关极速充能！`);
      return;
    }
    arena.swordIntent = 0;
    arena.ultCineTimer = 1.55;
    const p = arena.player;
    const st = getCombatStats(game);
    p.invuln = Math.max(p.invuln, 1.9);

    const arch = detectPrimaryBuildArchetype(game);
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;

    // Engage 2.35:1 Cinema Letterbox + Low-Pass Sidechain Ducking + Camera Zoom + Max Dual-Rumble!
    document.body.classList.add("letterbox-active");
    const cutEl = document.getElementById("style-ult-cutin");
    const portEl = document.getElementById("style-ult-portrait");
    const schEl = document.getElementById("style-ult-school");
    const titEl = document.getElementById("style-ult-title");
    const subEl = document.getElementById("style-ult-sub");

    Sound.triggerDucking(340, 0.22, 1650);
    Sound.deflectClang();
    Sound.fanfare();
    GamepadSystem.rumble(1.0, 1.0, 340);
    arena.camZoom = 1.15;
    arena.hitStop = 0.11;
    arena.shake = 18;

    if (arch === "thunder") {
      if (portEl) portEl.src = ART.char_player;
      if (schEl) schEl.textContent = "紫霄雷体真传";
      if (titEl) titEl.textContent = "九霄紫雷神罚";
      if (subEl) subEl.textContent = "九柱紫金神雷轰顶 · 灵泉尽化雷池麻痹";
      arena.flash = 0.42; arena.flashColor = "#e5c8ff";
    } else if (arch === "companion") {
      if (portEl) portEl.src = ART.char_shen;
      if (schEl) schEl.textContent = "红尘同心真传";
      if (titEl) titEl.textContent = "三才诛仙合璧阵";
      if (subEl) subEl.textContent = "故人三角结阵 · 万花青莲剑芒贯天";
      arena.flash = 0.42; arena.flashColor = "#a8ffef";
      if (arena.activeAllies.length < 2) {
        arena.player.allyCd = 0;
        summonAllyCoop();
      }
    } else {
      if (portEl) portEl.src = ART.char_player;
      if (schEl) schEl.textContent = "万剑归宗真传";
      if (titEl) titEl.textContent = "太虚万剑朝宗";
      if (subEl) subEl.textContent = "三十六天罡剑雨破界 · 瞬碎万妖护阵";
      arena.flash = 0.42; arena.flashColor = "#fff2be";
    }
    if (cutEl) cutEl.classList.add("active");
    if (ultCineHideTimer) clearTimeout(ultCineHideTimer);
    ultCineHideTimer = setTimeout(() => {
      document.body.classList.remove("letterbox-active");
      if (cutEl) cutEl.classList.remove("active");
    }, 1580);

    const castEpoch = arena.stageEpoch;
    for (let wave = 0; wave < 6; wave++) {
      setTimeout(() => {
        if (!game || arena.stageEpoch !== castEpoch) return;
        const prevB = arena.currentDmgBucket;
        arena.currentDmgBucket = "deflect_ult";
        const center = getPlazaCenter(w, h);
        if (arch === "thunder") {
          Sound.thunderCrack();
          for (let b = 0; b < 3; b++) {
            const tgt = arena.enemies[b % Math.max(1, arena.enemies.length)];
            const bx = tgt ? tgt.x + (Math.random() - 0.5) * 50 : center.x + (Math.random() - 0.5) * 320;
            const by = tgt ? tgt.y + (Math.random() - 0.5) * 35 : center.y + (Math.random() - 0.5) * 180;
            arena.skyBolts.push({ x: bx, y: by, t: 0, color: "#d69eff" });
            triggerElectroPoolReaction(bx, by, st.atk);
            if (wave === 0 && b < 2) arena.thunderOrbs.push({ x: bx, y: by, life: 5.5, tickCd: 0.1 });
          }
          arena.enemies.slice().forEach(e => {
            e.flinchTimer = 0.45;
            e.swordMarks = 6;
            damageEnemy(e, Math.round(st.atk * 1.55), true, 18, 0, 4, true);
          });
        } else if (arch === "companion") {
          Sound.bianzhong(523.25 + wave * 45, 0.08);
          arena.activeAllies.forEach(al => {
            arena.lightnings.push({ x1: al.x, y1: al.y - 16, x2: center.x, y2: center.y, t: 0, color: al.color });
            pushBladeArc(al.x, al.y, Math.atan2(center.y - al.y, center.x - al.x), 125, al.color, 1, true);
          });
          arena.lotusVortexes.push({ x: center.x, y: center.y, r: 155, life: 0.55, maxLife: 0.55, rot: wave * 0.8, tickCd: 9, dmg: 0 });
          if (wave === 0) {
            game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.35));
            p.shieldHp = Math.max(p.shieldHp || 0, Math.round(st.maxHp * 0.45));
          }
          arena.enemies.slice().forEach(e => {
            e.swordMarks = 6;
            damageEnemy(e, Math.round(st.atk * 1.62), true, 19, 0, 5, true);
          });
        } else {
          Sound.slash(true, wave % 4);
          for (let s = 0; s < 5; s++) {
            const sx = center.x + (Math.random() - 0.5) * 420;
            const sy = center.y + (Math.random() - 0.5) * 230;
            arena.slashes.push({ x: sx, y: sy, r: 86, ang: Math.PI / 2, t: 0, color: s % 2 ? "#70ffe6" : "#ffe89e", rain: true, heavy: true });
            spawnSparks(sx, sy, 6, -Math.PI / 2, 2.0, "#ffe89e");
          }
          arena.enemies.slice().forEach(e => {
            e.swordMarks = 6;
            damageEnemy(e, Math.round(st.atk * 1.52), true, 18, 0, 4, true);
          });
        }
        arena.props.slice().forEach(pr => {
          if (pr.destructible && pr.hp > 0) damageBattleProp(pr, st.atk * 0.85);
        });
        arena.currentDmgBucket = prevB;
      }, wave * 185);
    }
    updateHud();
  }

  function renderStageDamageRecap(forceOpen = null) {
    const card = document.getElementById("stage-recap-card");
    if (!card) return;
    if (forceOpen === false) { card.classList.remove("open"); return; }
    if (forceOpen === true) card.classList.add("open");
    else card.classList.toggle("open");
    if (!card.classList.contains("open")) return;

    const arch = detectPrimaryBuildArchetype(game);
    const archName = arch === "thunder" ? "紫霄雷帝流" : arch === "companion" ? "三才同心流" : "万剑归宗流";
    document.getElementById("recap-style-seal").textContent = archName;

    const bd = arena.dmgBreakdown;
    const rows = [
      { key: "combo_morph",   name: "轻重剑舞与切手派生", col: "#ffe28a", val: bd.combo_morph || 0 },
      { key: "flying_swords", name: "本命飞剑与收剑爆印", col: "#70ffe6", val: bd.flying_swords || 0 },
      { key: "deflect_ult",   name: "识破处决与流派奥义", col: "#ff8780", val: bd.deflect_ult || 0 },
      { key: "thunder_elem",  name: "神雷与五行地形机关", col: "#d69eff", val: bd.thunder_elem || 0 },
      { key: "ally_pet",      name: "道侣合击与本命灵兽", col: "#4ad2b8", val: bd.ally_pet || 0 }
    ];
    const tot = Math.max(1, rows.reduce((s, r) => s + r.val, 0));
    const realTot = rows.reduce((s, r) => s + r.val, 0);
    document.getElementById("recap-summary-line").textContent =
      `累计总伤 ${realTot.toLocaleString()} · 最高单次 ${(arena.peakHit || 0).toLocaleString()} · 识破/凝时 ${(arena.parryCount || 0) + (arena.witchCount || 0)} 次`;

    document.getElementById("recap-bars-box").innerHTML = rows.map(r => {
      const pct = realTot > 0 ? Math.round((r.val / tot) * 100) : 0;
      return `<div class="dmg-bar-row">
        <div style="display:flex;justify-content:space-between;font-size:10.5px;">
          <span style="color:#d8ece8;">${r.name}</span>
          <strong style="color:${r.col};">${r.val.toLocaleString()} (${pct}%)</strong>
        </div>
        <div class="dmg-bar-track"><div class="dmg-bar-fill" style="width:${pct}%;background:${r.col};"></div></div>
      </div>`;
    }).join("");

    const comBox = document.getElementById("recap-companion-box");
    if (comBox && game) {
      const cmt = getCompanionPostBattleComment(game);
      if (cmt) {
        comBox.style.display = "flex";
        comBox.innerHTML = `
          <img src="${ART[cmt.art]}" alt="${cmt.name}" />
          <div style="font-size:10.5px;line-height:1.4;color:#e5f3ef;">
            <strong style="color:var(--gold-bright);">${cmt.name} · 战后评语：</strong>${cmt.text}
          </div>`;
      } else {
        comBox.style.display = "none";
      }
    }
  }

  function toggleTelemetryPanel(force = null) {
    arena.showTelemetry = force !== null ? force : !arena.showTelemetry;
    const panel = document.getElementById("action-telemetry-panel");
    const btn = document.getElementById("btn-toggle-telemetry");
    if (panel) panel.classList.toggle("open", arena.showTelemetry);
    if (btn) btn.classList.toggle("active", arena.showTelemetry);
  }

  let teleUiThrottle = 0;
  function updateTelemetryOverlay(dt) {
    const ms = dt * 1000;
    arena.frameTimes.push(ms);
    if (arena.frameTimes.length > 58) arena.frameTimes.shift();

    const panel = document.getElementById("action-telemetry-panel");
    if (!panel || !arena.showTelemetry) return;
    panel.style.top = questHudCollapsed ? "158px" : "326px";

    teleUiThrottle -= dt;
    if (teleUiThrottle > 0) return;
    teleUiThrottle = 0.08;

    const now = performance.now();
    while (arena.dmgRolling.length && now - arena.dmgRolling[0].t > 5000) arena.dmgRolling.shift();
    const sum5 = arena.dmgRolling.reduce((s, x) => s + x.d, 0);
    const dps = Math.round(sum5 / 5);

    document.getElementById("tele-dps-val").textContent = dps.toLocaleString();
    document.getElementById("tele-peak-val").textContent = (arena.peakHit || 0).toLocaleString();
    document.getElementById("tele-parry-val").textContent = `${arena.parryCount || 0} / ${arena.witchCount || 0}`;
    const devStr = GamepadSystem.inputMode === "pad" ? "🎮手柄" : "⌨键鼠";
    const hzStr = Sound.duckState.active ? `侧链${Sound.duckState.hz}Hz` : (Sound.bgmModeName || "18.5kHz");
    document.getElementById("tele-input-dev").textContent = `${devStr} · ${hzStr}`;

    const p = arena.player;
    const spec6 = getCurrentSixAspectSpec();
    const deriveEl = document.getElementById("tele-derive-hint");
    if (deriveEl) {
      if (p.comboWindow > 0.25 && (arena.morphCd || 0) <= 0) {
        deriveEl.innerHTML = `<strong style="color:#ffe89e;">★ 切手窗口激活：按右键派生【${escapeHtml(spec6.name)}】！</strong>`;
      } else if ((arena.swordIntent || 0) >= 100) {
        deriveEl.innerHTML = `<strong style="color:#ff9f68;">🔥 剑意已满100%：按 X 键释放【流派终极奥义】！</strong>`;
      } else {
        deriveEl.textContent = `剑意 ${Math.floor(arena.swordIntent || 0)}% · 左键四段剑舞 → 右键切手【${spec6.short}】`;
      }
    }

    const chainEl = document.getElementById("telemetry-input-chain");
    if (chainEl && arena.inputChain.length > 0) {
      chainEl.innerHTML = arena.inputChain.map(it => `<span class="tele-step-chip ${it.isBuffered ? "buffered" : ""}">${it.tag}</span>`).join("▸");
    }

    const avgMs = arena.frameTimes.reduce((s, v) => s + v, 0) / Math.max(1, arena.frameTimes.length);
    const fps = Math.min(60, Math.round(1000 / Math.max(16.66, avgMs)));
    document.getElementById("tele-fps-txt").textContent = `${fps} FPS · ${avgMs.toFixed(1)} ms`;
    document.getElementById("tele-buffer-txt").textContent = arena.inputBuffer.length > 0
      ? `⚡缓冲待发: ${arena.inputBuffer[0].act}`
      : "预输入队列(140ms): 就绪";

    const fc = document.getElementById("telemetry-fps-canvas");
    if (fc) {
      const fctx = fc.getContext("2d");
      fctx.clearRect(0, 0, fc.width, fc.height);
      // 16.7ms 60FPS target line
      fctx.strokeStyle = "rgba(112, 255, 230, 0.35)";
      fctx.beginPath(); fctx.moveTo(0, 18); fctx.lineTo(fc.width, 18); fctx.stroke();
      const bw = fc.width / 58;
      arena.frameTimes.forEach((ft, idx) => {
        const hBar = Math.min(28, Math.max(3, (ft / 33.3) * 24));
        fctx.fillStyle = ft <= 20 ? "#4ad2b8" : ft <= 34 ? "#ffe28a" : "#ff6b6b";
        fctx.fillRect(idx * bw, fc.height - hBar, Math.max(2, bw - 1), hBar);
      });
    }
  }

  loadKeybinds();

  function hasSynergy(g, synId) {
    if (!g) return false;
    const sp = SYNERGIES.find(s => s.id === synId);
    return sp ? sp.active(g) : false;
  }
  function escTip(t, d) { return `${escapeHtml(t)}|${escapeHtml(d)}`; }

  function countBondedAllies(g) {
    if (!g) return 0;
    let n = 0;
    if (g.openingChoice === "help" || (g.aids && g.aids.shen) || Object.keys(g.choices || {}).some(k => k.startsWith("shen"))) n++;
    if ((g.aids && g.aids.pei) || Object.keys(g.choices || {}).some(k => k.startsWith("pei"))) n++;
    if ((g.aids && g.aids.lu) || Object.keys(g.choices || {}).some(k => k.startsWith("lu"))) n++;
    if ((g.aids && g.aids.yan) || Object.keys(g.choices || {}).some(k => k.startsWith("yan"))) n++;
    return n;
  }



  function getSwordCount(g) {
    if (!g) return 2;
    const stars = getEquippedRelicStars(g);
    const starSwords = stars >= 4 ? 1 : 0;
    const gearSwords = Math.min(2, getGearTotals(g).bonusSword);
    const fruitSwords = hasDestinyFruit(g, "sword_twin") ? 2 : 0;
    const dragonSwords = hasStarCore(g, "azure_dragon") ? 1 : 0;
    const curioSw = Math.min(2, getCurioStacks(g, "curio_hongmeng_omni"));
    const realmSw = Math.min(3, Math.floor((rankOf(g.realm) + 1) / 2));
    const bonusSw = Math.min(3, Math.max(0, Math.floor(num(g.bonusSwords, 0))));
    const extraSw = Math.min(3, gearSwords + fruitSwords + dragonSwords + curioSw + (hasLaw(g, "wanjian") ? 1 : 0) + (g.loadout.relic === "frost_sword" ? 1 : 0) + starSwords);
    return Math.max(1, Math.min(10, Math.floor(2 + realmSw + bonusSw + extraSw)));
  }

  function createFreshGame(playerName, perkId, calamityTier = 0) {
    const requestedPerk = PERKS.find(p => p.id === perkId);
    const effectivePerk = (requestedPerk && isPerkUnlocked(requestedPerk)) ? requestedPerk.id : "sword_bone";
    const effCalamity = isCalamityTierUnlocked(calamityTier) ? Math.max(0, Math.min(CALAMITY_CYCLES.length - 1, Math.floor(num(calamityTier, 0)))) : 0;
    const inv = {};
    Object.keys(ITEMS).forEach(k => { inv[k] = 0; });
    inv.healing_pill = effectivePerk === "mortal_grit" ? 4 : 2;
    inv.spirit_pill = 1;
    inv.herb = effectivePerk === "medicine_sage" ? 6 : 3;
    inv.dew = effectivePerk === "medicine_sage" ? 3 : 1;
    if (effectivePerk === "calamity_phoenix") inv.longevity_pill = 1;
    const laws = effectivePerk === "immortal_echo" ? ["void_haste"] : [];
    const legacyStones = Math.min(240, (metaState.ascensions || 0) * 45 + (metaState.bingjieCount || 0) * 40);

    const starterSword = effectivePerk === "primordial_sage"
      ? {
          uid: "g_starter_primordial", slot: "weapon", rarity: 3, name: "仙品·太初鸿蒙剑", art: "relic_frost_sword",
          atk: 26, hp: 30, dr: 2, crit: 0.08, spd: 0.06, bonusSword: 1, price: 180, sell: 75, power: 115
        }
      : {
          uid: "g_starter_wpn", slot: "weapon", rarity: 0, name: "凡品·青竹灵剑", art: "icon_blade",
          atk: 6, hp: 0, dr: 0, crit: 0.03, spd: 0, bonusSword: 0, price: 25, sell: 10, power: 25
        };

    const startSanctum = {
      spirit_eye: effectivePerk === "primordial_sage" ? 2 : 1,
      cauldron: effectivePerk === "primordial_sage" ? 2 : 1,
      sword_forge: effectivePerk === "sword_sovereign" ? 2 : 1,
      scripture_hall: 1,
      guard_array: 1
    };
    const defaultAura = effCalamity >= 1
      ? "crimson_calamity"
      : ((metaState.ascensions || 0) >= 3 || metaState.bestRushGrade === "S")
        ? "primordial_chaos"
        : (metaState.ascensions || 0) >= 1
          ? "golden_lotus"
          : "azure_jade";
    const calSpec = getCalamityCycleSpec(effCalamity);

    const g = {
      version: 11,
      name: safeText(playerName, "").replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, "").trim().slice(0, 12) || "顾长青",
      perk: effectivePerk,
      calamityTier: effCalamity,
      realm: "mortal",
      foundationQuality: {},
      statMultBonus: 1.0 + Math.min(0.30, (metaState.ascensions || 0) * 0.05),
      bonusSwords: effectivePerk === "sword_sovereign" ? 2 : 0,
      atkFlatBonus: 0,
      xp: 0,
      overflowXp: 0,
      tribShield: 0,
      hp: 100,
      mp: 28,
      maxHpBonus: 35,
      stones: (effectivePerk === "mortal_grit" ? 110 : effectivePerk === "calamity_phoenix" ? 205 : 65) + legacyStones,
      omenIndex: 0,
      location: "wilderness",
      elapsedMonths: 0,
      startAgeMonths: 216,
      openingChoice: null,
      school: "sword",
      learned: ["sword_mind", "sword_build", "sword_release", "talisman_mind", "talisman_build", "talisman_release"],
      loadout: { mind: "sword_mind", builder: "sword_build", finisher: "sword_release", relic: null },
      equippedGear: { weapon: starterSword, armor: null, ring: null },
      gearBag: [],
      marketStock: [],
      ownedRelics: [],
      relicStars: {},
      laws,
      pet: { id: null, level: 1, skills: { tier3: null, tier5: null } },
      towerFloor: 1,
      towerBest: 0,
      bestSpireFloor: 0,
      rushBestGrade: null,
      jadeCuts: 0,
      achievements: [],
      claimedAchievements: [],
      seenCutscenes: {},
      inventory: inv,
      choices: {},
      aids: { shen: false, pei: false, lu: false, yan: false },
      dao: { benevolence: 6, edge: (effectivePerk === "sword_bone" || effectivePerk === "sword_sovereign") ? 20 : 10, serenity: 6 },
      wins: 0,
      immortalPills: 0,
      trialCompleted: false,
      cloudSeaCleared: false,
      cloudSeaBestGrade: null,
      sectDefenseCleared: false,
      sectDefenseBestGrade: null,
      lifeRecorded: false,
      status: "active",
      ending: null,
      destinyFruits: [],
      stageStars: {},
      defeatedStageBosses: {},
      claimedStepIds: [],
      claimedStarChests: [],
      bountyTiers: { slay: 1, tech: 1, craft: 1 },
      goalStats: { kills: 0, techBreaks: 0, craftOrLoot: 0 },
      pactSeals: [],
      taixuTrailUnlocked: !!metaState.taixuTrailUnlocked,
      taixuTrailActive: !!metaState.taixuTrailUnlocked,
      titleUnlocked: metaState.taixuTrailUnlocked ? "踏天破妄剑尊" : null,
      karmaScore: 0,
      karmaEventsDone: 0,
      completedKarmaIds: [],
      karmaDrBonus: 0,
      bondTiers: { shen: 1, pei: 0, lu: 0, yan: 0 },
      gourd: { charges: 5, maxCharges: 5, soaks: ["iron_lotus", "samadhi_fire", "parry_brew"], parryChargeProg: 0 },
      cosmetics: { bladeSkin: "celadon", trailSkin: metaState.taixuTrailUnlocked ? "taixu_prismatic" : "ink_jade", footAura: "lotus_step", swordAura: defaultAura },
      unlockedSouls: ["blood_warden"],
      equippedSoul: "blood_warden",
      litStars: [],
      bonusStarPts: effectivePerk === "primordial_sage" ? 2 : 0,
      pity: { epic: 0, mythic: 0, critAcc: 0, vampHits: 0, thunderHits: 0, gearDrops: 0 },
      unlockAllArcana: false,
      retreats: 0,
      tribulationFails: 0,
      defiantBreakthroughs: 0,
      sanctumLevels: startSanctum,
      lifespanBonusMonths: 0,
      tutorialStep: 0,
      tutorialDismissed: false,
      seenUnlockIds: [],
      sanctumChatStage: {},
      karmaMarketBought: {},
      weaponForm: "sword",
      customComboSeq: { enabled: false, slots: DEFAULT_COMBO_SEQ_SLOTS.slice(), morphCount: 0 },
      expeditions: { assignments: {}, bankedStones: 0, bankedStars: 0, supportThunderCount: 0, tickTimer: 8.5 },
      primordialCrafts: { goldenAcolyte: false, voidSwordRift: false, pillBatches: 0, forgedBlades: 0 },
      permGrowth: { alchemyHp: 0, alchemyAtk: 0, bloodFuryBought: {} },
      spireCurios: {},
      pendingRewards: [],
      resolvedRewardIds: [],
      seenCutIns: {},
      seenLifespan75Tip: false,
      vol1PedestalMeta: null,
      vol1Prep: null,
      journal: [effCalamity > 0 ? `第 ${(metaState.ascensions || 0) + 1} 世重入红尘，主动点燃【${calSpec.name}】劫火试炼！` : "十八岁山雨倾盆，仗剑踏入青岚破庙。"]
    };
    const st = getCombatStats(g);
    g.hp = st.maxHp;
    g.mp = st.maxMp;
    return g;
  }


  function normalizeLoadedGame(raw) {
    const rawCal = num(raw && raw.calamityTier, 0);
    const base = createFreshGame(safeText(raw && raw.name, "顾长青"), raw && typeof raw.perk === "string" ? raw.perk : "sword_bone", rawCal);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
    const g = safeAssignPlain({}, base, raw);
    g.name = safeText(raw.name, "顾长青").replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, "").trim() || "顾长青";
    if (typeof g.perk !== "string" || !PERKS.some(p => p.id === g.perk)) g.perk = base.perk;
    if (typeof g.titleUnlocked !== "string" && typeof g.titleUnlocked !== "boolean") g.titleUnlocked = null;
    if (typeof g.realm !== "string" || !hasOwn(REALMS, g.realm)) g.realm = "mortal";
    g.calamityTier = Math.max(0, Math.min(CALAMITY_CYCLES.length - 1, Math.floor(num(raw.calamityTier, 0))));
    g.cloudSeaCleared = !!raw.cloudSeaCleared;
    g.cloudSeaBestGrade = isValidUnifiedGrade(raw.cloudSeaBestGrade) ? raw.cloudSeaBestGrade : null;
    g.sectDefenseCleared = !!raw.sectDefenseCleared;
    g.sectDefenseBestGrade = isValidUnifiedGrade(raw.sectDefenseBestGrade) ? raw.sectDefenseBestGrade : null;
    g.lifeRecorded = !!raw.lifeRecorded;
    g.seenLifespan75Tip = !!raw.seenLifespan75Tip;
    g.rushBestGrade = isValidUnifiedGrade(raw.rushBestGrade) ? raw.rushBestGrade : null;
    ["stones", "xp", "overflowXp", "wins", "towerBest", "bestSpireFloor", "tribShield", "bonusStarPts", "bonusSwords", "omenIndex", "jadeCuts", "immortalPills", "karmaEventsDone", "atkFlatBonus", "maxHpBonus", "retreats", "tribulationFails", "defiantBreakthroughs", "lifespanBonusMonths"].forEach(k => {
      g[k] = Math.max(0, Math.floor(num(g[k], base[k] != null ? base[k] : 0)));
    });
    const permCaps = getPermGrowthCaps(g);
    g.maxHpBonus = Math.min(permCaps.maxHpBonus, g.maxHpBonus);
    g.atkFlatBonus = Math.min(permCaps.atkFlatBonus, g.atkFlatBonus);
    const rawPg = (raw.permGrowth && typeof raw.permGrowth === "object" && !Array.isArray(raw.permGrowth)) ? raw.permGrowth : {};
    const rawBf = safeAssignPlain({}, rawPg.bloodFuryBought);
    const cleanBf = {};
    Object.keys(rawBf).forEach(rk => {
      if (hasOwn(REALMS, rk)) {
        cleanBf[rk] = Math.max(0, Math.min(PERM_GROWTH_CAPS.bloodFuryPerRealm, Math.floor(num(rawBf[rk], 0))));
      }
    });
    g.permGrowth = {
      alchemyHp: Math.max(0, Math.min(permCaps.alchemyHp, Math.floor(num(rawPg.alchemyHp, 0)))),
      alchemyAtk: Math.max(0, Math.min(permCaps.alchemyAtk, Math.floor(num(rawPg.alchemyAtk, 0)))),
      bloodFuryBought: cleanBf
    };
    g.omenIndex = g.omenIndex % CELESTIAL_OMENS.length;
    g.towerFloor = Math.max(1, Math.floor(num(g.towerFloor, 1)));
    g.elapsedMonths = Math.max(0, Math.floor(num(g.elapsedMonths, 0)));
    g.startAgeMonths = Math.max(12, Math.floor(num(g.startAgeMonths, 216)));
    g.statMultBonus = Math.max(0.5, num(g.statMultBonus, base.statMultBonus));
    g.karmaScore = Math.max(-100, Math.min(100, num(g.karmaScore, 0)));
    g.karmaDrBonus = Math.max(0, num(g.karmaDrBonus, 0));
    const validKarmaIds = new Set(KARMA_DILEMMAS.map(d => d.id));
    if (Array.isArray(raw.completedKarmaIds)) {
      const seenKd = new Set();
      g.completedKarmaIds = [];
      for (const id of raw.completedKarmaIds) {
        if (typeof id === "string" && validKarmaIds.has(id) && !seenKd.has(id)) {
          seenKd.add(id);
          g.completedKarmaIds.push(id);
        }
      }
    } else {
      const legacyCount = Math.min(LEGACY_KARMA_DILEMMA_IDS.length, g.karmaEventsDone);
      g.completedKarmaIds = LEGACY_KARMA_DILEMMA_IDS.slice(0, legacyCount);
    }
    g.karmaEventsDone = Math.max(g.karmaEventsDone, g.completedKarmaIds.length);
    if (typeof g.location !== "string" || !hasOwn(STORY_LOCATIONS, g.location)) {
      g.location = "wilderness";
    }
    g.inventory = safeAssignPlain({}, base.inventory, raw.inventory);
    Object.keys(g.inventory).forEach(k => {
      g.inventory[k] = Math.max(0, Math.floor(num(g.inventory[k], 0)));
    });
    g.loadout = safeAssignPlain({}, base.loadout, raw.loadout);
    if (g.loadout.relic && !hasOwn(RELICS, g.loadout.relic)) g.loadout.relic = null;
    g.equippedGear = safeAssignPlain({ weapon: base.equippedGear.weapon, armor: null, ring: null }, raw.equippedGear);
    ["weapon", "armor", "ring"].forEach(sl => {
      g.equippedGear[sl] = g.equippedGear[sl] ? normalizeGearItem(g.equippedGear[sl], sl) : null;
    });
    if (!Array.isArray(g.gearBag)) g.gearBag = [];
    else g.gearBag = g.gearBag.map(it => normalizeGearItem(it)).filter(Boolean);
    if (!Array.isArray(g.marketStock)) g.marketStock = [];
    else g.marketStock = g.marketStock.map(it => normalizeGearItem(it)).filter(Boolean);
    const rawPet = (raw.pet && typeof raw.pet === "object" && !Array.isArray(raw.pet)) ? raw.pet : {};
    const rawPetSkills = (rawPet.skills && typeof rawPet.skills === "object" && !Array.isArray(rawPet.skills)) ? rawPet.skills : {};
    const safeTier3 = (typeof rawPetSkills.tier3 === "string" && hasOwn(PET_SKILLS_BY_ID, rawPetSkills.tier3) && PET_SKILLS_BY_ID[rawPetSkills.tier3].tier === 3) ? rawPetSkills.tier3 : null;
    const safeTier5 = (typeof rawPetSkills.tier5 === "string" && hasOwn(PET_SKILLS_BY_ID, rawPetSkills.tier5) && PET_SKILLS_BY_ID[rawPetSkills.tier5].tier === 5) ? rawPetSkills.tier5 : null;
    g.pet = {
      id: (typeof rawPet.id === "string" && hasOwn(SPIRIT_PETS, rawPet.id)) ? rawPet.id : null,
      level: Math.max(1, Math.min(5, Math.floor(num(rawPet.level, 1)))),
      skills: { tier3: safeTier3, tier5: safeTier5 }
    };
    g.aids = safeAssignPlain({ shen: false, pei: false, lu: false, yan: false }, raw.aids);
    g.dao = safeAssignPlain({ benevolence: 6, edge: 10, serenity: 6 }, raw.dao);
    ["benevolence", "edge", "serenity"].forEach(k => {
      g.dao[k] = Math.max(0, num(g.dao[k], base.dao[k]));
    });
    g.choices = safeAssignPlain({}, raw.choices);
    g.relicStars = safeAssignPlain({}, raw.relicStars);
    Object.keys(g.relicStars).forEach(k => {
      g.relicStars[k] = Math.max(0, Math.min(5, Math.floor(num(g.relicStars[k], 1))));
    });
    if (raw.spireCurios !== undefined) {
      g.spireCurios = safeAssignPlain({}, raw.spireCurios);
      Object.keys(g.spireCurios).forEach(k => {
        g.spireCurios[k] = Math.max(0, Math.min(PERM_GROWTH_CAPS.spireCurioMaxStack, Math.floor(num(g.spireCurios[k], 0))));
      });
    } else {
      g.spireCurios = {};
    }
    g.seenCutscenes = safeAssignPlain({}, raw.seenCutscenes);
    g.foundationQuality = safeAssignPlain({}, raw.foundationQuality);
    g.laws = Array.isArray(g.laws)
      ? Array.from(new Set(g.laws.filter(id => hasOwn(DAO_LAWS, id))))
      : [];
    if (!Array.isArray(g.learned)) g.learned = base.learned.slice();
    base.learned.forEach(sk => { if (!g.learned.includes(sk)) g.learned.push(sk); });
    if (!Array.isArray(g.ownedRelics)) g.ownedRelics = [];
    g.ownedRelics = Array.from(new Set(g.ownedRelics.filter(rid => hasOwn(RELICS, rid))));
    g.ownedRelics.forEach(rid => { if (!hasOwn(g.relicStars, rid)) g.relicStars[rid] = 1; });
    if (!Array.isArray(g.achievements)) g.achievements = [];
    if (!Array.isArray(g.claimedAchievements)) g.claimedAchievements = [];
    g.destinyFruits = Array.isArray(g.destinyFruits)
      ? Array.from(new Set(g.destinyFruits.filter(fid => hasOwn(DESTINY_FRUITS, fid))))
      : [];
    g.stageStars = safeAssignPlain({}, raw.stageStars);
    Object.keys(g.stageStars).forEach(k => { g.stageStars[k] = Math.max(0, Math.min(3, Math.floor(num(g.stageStars[k], 0)))); });
    g.defeatedStageBosses = {};
    if (raw.defeatedStageBosses && typeof raw.defeatedStageBosses === "object" && !Array.isArray(raw.defeatedStageBosses)) {
      [0, 1, 2, 3, 4].forEach(idx => {
        const k = String(idx);
        if (hasOwn(raw.defeatedStageBosses, k) && raw.defeatedStageBosses[k] === true) {
          g.defeatedStageBosses[idx] = true;
        }
      });
    }
    [0, 1, 2, 3, 4].forEach(idx => {
      if (num(g.stageStars[idx], 0) >= 1) g.defeatedStageBosses[idx] = true;
    });
    if (g.trialCompleted === true) g.defeatedStageBosses[4] = true;
    // Legacy save migration (S1): never regress a save whose realm already surpassed lower gates,
    // without minting fake stars in g.stageStars and without mutating g.trialCompleted.
    const migratedRank = rankOf(g.realm);
    if (migratedRank >= 1) g.defeatedStageBosses[0] = true;
    if (migratedRank >= 2) g.defeatedStageBosses[1] = true;
    if (migratedRank >= 3) g.defeatedStageBosses[2] = true;
    if (migratedRank >= 4) g.defeatedStageBosses[3] = true;
    if (migratedRank >= 6 || g.status === "ascended") g.defeatedStageBosses[4] = true;
    if (!Array.isArray(g.claimedStepIds)) {
      g.claimedStepIds = [];
    } else {
      g.claimedStepIds = Array.from(new Set(
        g.claimedStepIds
          .map(id => canonicalizeStepId(id))
          .filter(Boolean)
      ));
    }
    if (!Array.isArray(g.claimedStarChests)) g.claimedStarChests = [];
    g.bountyTiers = safeAssignPlain({ slay: 1, tech: 1, craft: 1 }, raw.bountyTiers);
    Object.keys(g.bountyTiers).forEach(k => { g.bountyTiers[k] = Math.max(1, Math.floor(num(g.bountyTiers[k], 1))); });
    g.goalStats = safeAssignPlain({ kills: 0, techBreaks: 0, craftOrLoot: 0 }, raw.goalStats);
    Object.keys(g.goalStats).forEach(k => { g.goalStats[k] = Math.max(0, Math.floor(num(g.goalStats[k], 0))); });
    if (!Array.isArray(g.pactSeals)) g.pactSeals = [];
    g.bondTiers = safeAssignPlain({ shen: 1, pei: 0, lu: 0, yan: 0 }, raw.bondTiers);
    Object.keys(g.bondTiers).forEach(k => { g.bondTiers[k] = Math.max(0, Math.floor(num(g.bondTiers[k], 0))); });
    g.gourd = safeAssignPlain({ charges: 5, maxCharges: 5, soaks: ["iron_lotus", "samadhi_fire", "parry_brew"], parryChargeProg: 0 }, raw.gourd);
    g.gourd.charges = Math.max(0, Math.floor(num(g.gourd.charges, 5)));
    g.gourd.maxCharges = Math.max(1, Math.floor(num(g.gourd.maxCharges, 5)));
    g.gourd.parryChargeProg = Math.max(0, num(g.gourd.parryChargeProg, 0));
    if (!Array.isArray(g.gourd.soaks)) g.gourd.soaks = ["iron_lotus", "samadhi_fire", "parry_brew"];
    g.cosmetics = safeAssignPlain({ bladeSkin: "celadon", trailSkin: g.taixuTrailActive ? "taixu_prismatic" : "ink_jade", footAura: "lotus_step", swordAura: "azure_jade" }, raw.cosmetics);
    if (!WARDROBE_OPTIONS.swordAura.some(x => x.id === g.cosmetics.swordAura)) g.cosmetics.swordAura = "azure_jade";
    const safeSouls = Array.isArray(g.unlockedSouls)
      ? Array.from(new Set(g.unlockedSouls.filter(id => hasOwn(SOUL_SPIRITS, id))))
      : [];
    g.unlockedSouls = safeSouls.length ? safeSouls : ["blood_warden"];
    if (!hasOwn(SOUL_SPIRITS, g.equippedSoul)) g.equippedSoul = g.unlockedSouls[0];
    if (g.equippedMount && !hasOwn(MYTHIC_MOUNTS, g.equippedMount)) g.equippedMount = "qilin";
    if (!hasOwn(WEAPON_ARSENAL_SPECS, g.weaponForm)) g.weaponForm = "sword";
    if (!Array.isArray(g.litStars)) g.litStars = [];
    g.pity = safeAssignPlain({ epic: 0, mythic: 0, critAcc: 0, vampHits: 0, thunderHits: 0, gearDrops: 0 }, raw.pity);
    ensureDeterministicPity(g);
    ensureCustomComboSeq(g);
    ensurePrimordialCrafts(g);
    // G1: Normalize expeditions AFTER bondTiers and primordialCrafts so bonded heroes & goldenAcolyte are preserved accurately!
    g.expeditions = safeAssignPlain({ assignments: {}, bankedStones: 0, bankedStars: 0, supportThunderCount: 0, tickTimer: 8.5 }, raw.expeditions);
    g.expeditions.assignments = safeAssignPlain({}, g.expeditions.assignments);
    ensureExpeditionState(g);
    g.unlockAllArcana = false; // G6: 全神通演武已沙盒化，正式存档一律随境渐进解封
    g.sanctumLevels = safeAssignPlain(
      { spirit_eye: 1, cauldron: 1, sword_forge: 1, scripture_hall: 1, guard_array: 1 },
      raw.sanctumLevels
    );
    Object.keys(g.sanctumLevels).forEach(k => {
      g.sanctumLevels[k] = Math.max(1, Math.min(5, Math.floor(num(g.sanctumLevels[k], 1))));
    });
    g.tutorialDismissed = !!raw.tutorialDismissed;
    if (typeof raw.tutorialStep === "number" && Number.isFinite(raw.tutorialStep)) {
      g.tutorialStep = Math.max(0, Math.min(4, Math.floor(raw.tutorialStep)));
    } else {
      g.tutorialStep = (rankOf(g.realm) >= 1 || !!g.openingChoice) ? 4 : 0;
    }
    const validUnlockIds = new Set(UNLOCK_TUTORIAL_CATALOG.map(c => c.id));
    if (raw.vol1PedestalMeta && typeof raw.vol1PedestalMeta === "object" && !Array.isArray(raw.vol1PedestalMeta)) {
      const ch = raw.vol1PedestalMeta.choice === "help" || raw.vol1PedestalMeta.choice === "trade" ? raw.vol1PedestalMeta.choice : null;
      g.vol1PedestalMeta = ch ? { choice: ch, payoffShown: raw.vol1PedestalMeta.payoffShown === true } : null;
    } else {
      g.vol1PedestalMeta = null;
    }
    if (raw.vol1Prep && typeof raw.vol1Prep === "object" && !Array.isArray(raw.vol1Prep)) {
      g.vol1Prep = {
        upgradeDone: raw.vol1Prep.upgradeDone === true,
        lastLabel: safeText(raw.vol1Prep.lastLabel, "").slice(0, 48)
      };
    } else {
      g.vol1Prep = null;
    }
    if (Array.isArray(raw.seenUnlockIds)) {
      const seenSet = new Set();
      g.seenUnlockIds = [];
      for (const uid of raw.seenUnlockIds) {
        if (typeof uid === "string" && validUnlockIds.has(uid) && !seenSet.has(uid)) {
          seenSet.add(uid);
          g.seenUnlockIds.push(uid);
        }
      }
    } else {
      g.seenUnlockIds = UNLOCK_TUTORIAL_CATALOG.filter(c => isUnlockCardEarned(g, c)).map(c => c.id);
    }
    g.sanctumChatStage = safeAssignPlain({}, raw.sanctumChatStage);
    g.karmaMarketBought = safeAssignPlain({}, raw.karmaMarketBought);
    if (!Array.isArray(g.journal)) g.journal = base.journal.slice();
    else g.journal = g.journal.filter(entry => typeof entry === "string");
    // F07: Validate persisted pendingRewards & bounded resolvedRewardIds (legacy saves default cleanly to [])
    const rawResolved = Array.isArray(raw.resolvedRewardIds) ? raw.resolvedRewardIds : [];
    const resolvedSet = new Set();
    const cleanResolved = [];
    for (const rid of rawResolved) {
      if (typeof rid === "string" && rid.length > 0 && rid.length <= 96 && !resolvedSet.has(rid)) {
        resolvedSet.add(rid);
        cleanResolved.push(rid);
      }
    }
    g.resolvedRewardIds = cleanResolved.slice(-128);
    const resolvedFinalSet = new Set(g.resolvedRewardIds);
    const rawPending = Array.isArray(raw.pendingRewards) ? raw.pendingRewards : [];
    const seenPendingIds = new Set();
    const cleanPending = [];
    for (const entry of rawPending) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const eid = typeof entry.eventId === "string" && entry.eventId.trim() ? entry.eventId.trim().slice(0, 96) : "";
      const kind = typeof entry.kind === "string" ? entry.kind : "";
      if (!eid || resolvedFinalSet.has(eid) || seenPendingIds.has(eid)) continue;
      if (!["gear_overflow", "soul_unlock", "destiny_fruit", "iconic_draft", "lifespan_exhausted"].includes(kind)) continue;
      const rawPay = (entry.payload && typeof entry.payload === "object" && !Array.isArray(entry.payload)) ? entry.payload : {};
      let cleanPayload = null;
      if (kind === "gear_overflow") {
        const normItem = normalizeGearItem(rawPay.item);
        if (!normItem) continue;
        cleanPayload = { item: normItem };
      } else if (kind === "soul_unlock") {
        const sid = typeof rawPay.soulId === "string" ? rawPay.soulId : "";
        if (!hasOwn(SOUL_SPIRITS, sid)) continue;
        cleanPayload = { soulId: sid };
      } else if (kind === "destiny_fruit") {
        cleanPayload = { isHeaven: !!rawPay.isHeaven };
      } else if (kind === "iconic_draft") {
        cleanPayload = {
          titleText: safeText(rawPay.titleText, "大道顿悟 · 获赐神通").slice(0, 64) || "大道顿悟 · 获赐神通",
          source: safeText(rawPay.source, "default").slice(0, 32) || "default"
        };
      } else if (kind === "lifespan_exhausted") {
        if (getLifespanInfo(g).status !== "exhausted") continue;
        cleanPayload = {};
      }
      seenPendingIds.add(eid);
      cleanPending.push({
        eventId: eid,
        kind,
        noticeClass: ["N0", "N1", "N2", "N3"].includes(entry.noticeClass) ? entry.noticeClass : "N1",
        sourceMode: safeText(entry.sourceMode, "campaign").slice(0, 32) || "campaign",
        stageEpoch: Math.max(0, Math.floor(num(entry.stageEpoch, 0))),
        createdAt: Math.max(0, Math.floor(num(entry.createdAt, Date.now()))),
        payload: cleanPayload,
        status: "pending" // Always reset "active" -> "pending" on load so it cleanly re-presents once calm
      });
    }
    g.pendingRewards = cleanPending;
    g.seenCutIns = {};
    if (raw.seenCutIns && typeof raw.seenCutIns === "object" && !Array.isArray(raw.seenCutIns)) {
      Object.keys(raw.seenCutIns).forEach(ck => {
        if (typeof ck === "string" && ck.length <= 48 && raw.seenCutIns[ck]) g.seenCutIns[ck] = true;
      });
    }
    const st = getCombatStats(g);
    g.hp = num(g.hp, st.maxHp);
    if (g.hp <= 0) g.hp = st.maxHp;
    else g.hp = Math.min(st.maxHp, g.hp);
    g.mp = num(g.mp, st.maxMp);
    if (g.mp < 0) g.mp = st.maxMp;
    else g.mp = Math.min(st.maxMp, g.mp);
    return g;
  }
