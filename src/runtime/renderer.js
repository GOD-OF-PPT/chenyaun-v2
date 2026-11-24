  // ==================== 10. SHADER-GRADE GUOFENG 2.5D CANVAS RENDERER (WITH SKY LOOT BEAMS!) ====================
  const canvas = document.getElementById("fx-canvas");
  const ctx = canvas.getContext("2d");
  const rainDrops = Array.from({ length: 38 }, () => ({ x: Math.random(), y: Math.random(), l: 10 + Math.random() * 13 }));

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);

  const GLOW_STAMPS = {};
  function getGlowStamp(rgbaCenter) {
    let st = GLOW_STAMPS[rgbaCenter];
    if (!st) {
      const c = document.createElement("canvas");
      c.width = 96; c.height = 96;
      const gctx = c.getContext("2d");
      const g = gctx.createRadialGradient(48, 48, 2, 48, 48, 48);
      g.addColorStop(0, rgbaCenter);
      g.addColorStop(1, "rgba(0,0,0,0)");
      gctx.fillStyle = g;
      gctx.fillRect(0, 0, 96, 96);
      st = c;
      GLOW_STAMPS[rgbaCenter] = st;
    }
    return st;
  }

  const SPRITE_ANCHORS = Object.freeze({
    actor_player_battle: { ax: 0.5, ay: 0.86 },
    char_player_seated:  { ax: 0.5, ay: 0.86 },
    actor_shen:          { ax: 0.5, ay: 0.88 },
    actor_lu:            { ax: 0.5, ay: 0.88 },
    actor_pei:           { ax: 0.5, ay: 0.88 },
    actor_yan:           { ax: 0.5, ay: 0.88 },
    enemy_wolf:          { ax: 0.5, ay: 0.82 },
    enemy_warden:        { ax: 0.5, ay: 0.88 },
    enemy_serpent:       { ax: 0.5, ay: 0.86 },
    enemy_puppet:        { ax: 0.5, ay: 0.86 },
    enemy_shadow:        { ax: 0.5, ay: 0.86 },
    enemy_sentinel:      { ax: 0.5, ay: 0.86 },
    lotus_pedestal_shrine: { ax: 0.5, ay: 0.78 },
    prop_puppet_dummy:   { ax: 0.5, ay: 0.88 }
  });

  function setPlayerAnimState(state, dur = 0.26, opts = {}) {
    if (!arena || !arena.player) return;
    const p = arena.player;
    p.animState = state || "idle";
    p.animT = 0;
    p.animDur = Math.max(0.08, Number(dur) || 0.26);
    if (opts && typeof opts.recoilDir === "number") p.recoilDir = opts.recoilDir;
  }

  function computePlayerVisualPose(p, nowSec = 0) {
    const st = (p && p.animState) || "idle";
    const t = Math.max(0, (p && p.animT) || 0);
    const dur = Math.max(0.08, (p && p.animDur) || 0.25);
    const prog = Math.min(1, t / dur);
    const f = (p && p.facing) ? (p.facing < 0 ? -1 : 1) : 1;
    const rm = isReducedMotionActive();
    let ox = 0, oy = 0, sx = 1.0, sy = 1.0, rot = (p && p.lean) || 0;
    if (st === "idle") {
      const br = rm ? 0 : Math.sin(nowSec * 2.8) * 0.024;
      sx = 1 - br * 0.55;
      sy = 1 + br;
      rot = 0;
    } else if (st === "run") {
      const stride = rm ? 0 : Math.sin((p && p.bob) || nowSec * 10);
      oy = rm ? 0 : -Math.abs(stride) * 4.2;
      sx = 1.03;
      sy = 0.97;
      rot = f * 0.095;
    } else if (st === "light1" || st === "light2" || st === "light3" || st === "light4") {
      const stepIdx = Number(st.slice(5)) || 1;
      const swing = Math.sin(prog * Math.PI);
      const reach = stepIdx === 4 ? 13 : (6 + stepIdx * 2);
      ox = f * reach * swing;
      oy = stepIdx === 4 ? -6 * swing : -2.5 * swing;
      sx = 1 + (stepIdx === 4 ? 0.14 : 0.08) * swing;
      sy = 1 - (stepIdx === 4 ? 0.10 : 0.06) * swing;
      rot = f * (stepIdx % 2 === 1 ? 0.16 : -0.11) * swing;
    } else if (st === "heavy") {
      const wave = prog < 0.35 ? -(prog / 0.35) : Math.sin(((prog - 0.35) / 0.65) * Math.PI);
      ox = f * 14 * wave;
      oy = -5 * Math.max(0, wave);
      sx = 1 + 0.15 * Math.max(0, wave) - 0.06 * Math.max(0, -wave);
      sy = 1 - 0.11 * Math.max(0, wave) + 0.08 * Math.max(0, -wave);
      rot = f * 0.21 * wave;
    } else if (st === "dodge") {
      const dashW = 1 - prog * 0.65;
      ox = f * 10 * dashW;
      oy = 4 * dashW;
      sx = 1 + 0.18 * dashW;
      sy = 1 - 0.16 * dashW;
      rot = f * 0.22 * dashW;
    } else if (st === "hit") {
      const rec = 1 - prog;
      const rDir = (p && p.recoilDir) ? (p.recoilDir < 0 ? -1 : 1) : -f;
      ox = rDir * 9 * rec;
      oy = -2 * rec;
      sx = 1 - 0.08 * rec;
      sy = 1 + 0.07 * rec;
      rot = -rDir * 0.16 * rec;
    } else if (st === "knockdown") {
      ox = -f * 8;
      oy = 18;
      sx = 1.12;
      sy = 0.78;
      rot = -f * 0.92;
    } else if (st === "meditate") {
      oy = rm ? -3 : (-4 + Math.sin(nowSec * 2.6) * 2.4);
      rot = 0;
    }
    return {
      state: st,
      ox: Number(ox.toFixed(2)),
      oy: Number(oy.toFixed(2)),
      sx: Number(sx.toFixed(3)),
      sy: Number(sy.toFixed(3)),
      rot: Number(rot.toFixed(3)),
      hitFlash: Boolean(p && (p.hitFlash || 0) > 0)
    };
  }

  function getEnemyAttackSpec(e) {
    if (!e) return { kind: "slam", shape: "ellipse", r: 90, ellY: 0.56, originYOff: 14 };
    const isPeril = !!e.perilous;
    const isGrab = !!e.grabWindup;
    const isLow = !!e.lowSweepWindup;
    const tx = Number.isFinite(e.aimX) && (e.aimX !== 0 || e.aimY !== 0) ? e.aimX : (e.x + (e.facing || 1) * 180);
    const ty = Number.isFinite(e.aimY) && (e.aimX !== 0 || e.aimY !== 0) ? e.aimY : e.y;
    const aimAng = Math.atan2(ty - e.y, tx - e.x);

    if (e.id === "serpent" && !isGrab && !isLow) {
      if (isPeril) {
        return {
          kind: "frost_barrage",
          shape: "cone",
          ang: aimAng,
          spread: 0.50,
          len: e.isBoss ? 250 : 210,
          originYOff: 10,
          frostPoolR: e.partSevered ? 0 : 92,
          aimX: tx,
          aimY: ty,
          moveName: "幽潭寒煞弹"
        };
      }
      if (e.attackType === "shot") {
        return {
          kind: "shot_fan",
          shape: "cone",
          ang: aimAng,
          spread: e.enraged ? 0.44 : 0.26,
          len: 225,
          originYOff: 10,
          frostPoolR: 0,
          aimX: tx,
          aimY: ty,
          moveName: "寒霜妖弹"
        };
      }
    }
    if (e.id === "puppet" && isPeril && !isGrab && !isLow) {
      return {
        kind: "cross_crescent",
        shape: "cross",
        ang: aimAng,
        len: e.isBoss ? 220 : 180,
        halfW: 18,
        arms: e.partSevered ? 2 : 4,
        originYOff: 10,
        moveName: "十字剑波"
      };
    }
    if (e.id === "trial_gate" && isPeril && !isGrab && !isLow) {
      return {
        kind: "sky_bolt",
        shape: "target_ellipse",
        x: tx,
        y: ty,
        r: 76,
        ellY: 0.56,
        originYOff: 0,
        moveName: "九霄天雷"
      };
    }
    if (e.attackType === "charge" && !isPeril && !isGrab && !isLow) {
      return {
        kind: "charge",
        shape: "rect",
        len: e.isBoss ? 236 : 210,
        halfW: e.isBoss ? 24 : 18,
        dur: e.enraged ? 0.26 : 0.30,
        originYOff: 12,
        ang: aimAng,
        moveName: e.id === "shadow" ? "噬影疾冲" : "疾冲扑咬"
      };
    }
    return {
      kind: isPeril ? "perilous_slam" : "slam",
      shape: "ellipse",
      r: isPeril ? (e.r + 92) : (e.r + 74),
      ellY: 0.56,
      originYOff: 14,
      moveName: e.id === "sentinel" ? "雷戟镇岳劈" : (isPeril ? "陨岳重击" : "重劈震地")
    };
  }

  function getEnemyStateSnapshot(e) {
    const target = e || (arena && arena.enemies && arena.enemies[0]) || null;
    if (!target) return null;
    return {
      uid: target.uid,
      id: target.id,
      name: target.name,
      state: target.state,
      facing: target.facing || 1,
      x: Number((target.x || 0).toFixed(1)),
      y: Number((target.y || 0).toFixed(1)),
      timer: Number((target.timer || 0).toFixed(3)),
      perilous: !!target.perilous,
      lowSweepWindup: !!target.lowSweepWindup,
      grabWindup: !!target.grabWindup,
      attackType: target.attackType,
      attackSpec: getEnemyAttackSpec(target)
    };
  }

  function drawSprite(key, x, y, size, flipX = false, hitWhite = false, alpha = 1.0, sx = 1.0, sy = 1.0, rot = 0, anchorFoot = false) {
    const im = IMG_CACHE[key];
    if (!im || !im.complete || im.naturalWidth === 0) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale((flipX ? -1 : 1) * sx, sy);
    const ratio = im.naturalWidth / im.naturalHeight;
    const dw = ratio >= 1 ? size : size * ratio;
    const dh = ratio >= 1 ? size / ratio : size;
    const anc = anchorFoot ? (SPRITE_ANCHORS[key] || { ax: 0.5, ay: 0.86 }) : { ax: 0.5, ay: 0.5 };
    const dx = -dw * anc.ax;
    const dy = -dh * anc.ay;
    ctx.drawImage(im, dx, dy, dw, dh);
    if (hitWhite) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha *= 0.72;
      ctx.drawImage(im, dx, dy, dw, dh);
    }
    ctx.restore();
  }

  function drawBaguaCircle(x, y, r, color, rot, alpha = 0.65, showGlyphs = true) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(1, 0.56);
    ctx.rotate(rot);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.0;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();

    ctx.lineWidth = 1.2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    if (showGlyphs && r >= 34) {
      ctx.font = `bold ${Math.max(9, Math.round(r * 0.22))}px serif`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        ctx.fillText(BAGUA_GLYPHS[i], Math.cos(a) * r * 0.89, Math.sin(a) * r * 0.89);
      }
    }
    ctx.restore();
  }

  function drawPointLight(x, y, r, rgbaCenter) {
    const stamp = getGlowStamp(rgbaCenter);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(stamp, x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawSlicedDeathAnim(da) {
    const im = IMG_CACHE[da.art];
    if (!im || !im.complete || im.naturalWidth === 0) return;
    const ratio = im.naturalWidth / im.naturalHeight;
    const dw = ratio >= 1 ? da.size : da.size * ratio;
    const dh = ratio >= 1 ? da.size / ratio : da.size;
    const alpha = Math.max(0, 1 - da.t);
    const slide = da.t * 26;

    [-1, 1].forEach(half => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(da.x + half * slide, da.y - da.t * 16 + half * 5);
      ctx.rotate(half * da.t * 0.18);
      if (da.flip) ctx.scale(-1, 1);
      ctx.beginPath();
      if (half < 0) ctx.rect(-dw, -dh / 2, dw * 2, dh * 0.52);
      else ctx.rect(-dw, 0, dw * 2, dh * 0.55);
      ctx.clip();
      ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh);
      // Fast zero-filter additive flash pass (replaces software ctx.filter stall)
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = alpha * Math.min(0.65, 0.25 + da.t * 0.45);
      ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    });

    if (da.t < 0.45) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (0.45 - da.t) * 2.1;
      ctx.translate(da.x, da.y);
      ctx.rotate(da.ang);
      ctx.strokeStyle = "#fff6cc";
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.moveTo(-dw * 0.65, 0); ctx.lineTo(dw * 0.65, 0); ctx.stroke();
      ctx.restore();
    }
  }

  function drawLuminousSword(x, y, ang, tint = "jade", scale = 1.0) {
    const bSkin = (game && game.cosmetics && game.cosmetics.bladeSkin) || "celadon";
    const sAura = (game && game.cosmetics && game.cosmetics.swordAura) || "azure_jade";
    const auraSpec = sAura !== "azure_jade" ? WARDROBE_OPTIONS.swordAura.find(o => o.id === sAura) : null;
    const glowCol = auraSpec ? auraSpec.col
      : (tint === "crimson" || bSkin === "crimson_demon") ? "#ff4d5e"
      : (tint === "gold" || bSkin === "gold_greatsword") ? "#ffe27a"
      : (tint === "frost" || bSkin === "frost_crystal") ? "#80ecff"
      : tint === "thunder" ? "#d69eff" : "#4ad2b8";
    const edgeCol = auraSpec ? auraSpec.accent : (bSkin === "crimson_demon" ? "#ffd6dc" : tint === "gold" ? "#fff6cc" : tint === "thunder" ? "#f2dcff" : "#e6fffb");
    const halfW = bSkin === "gold_greatsword" ? 5.6 : bSkin === "frost_crystal" ? 4.4 : 3.8;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(scale, scale);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const hg = ctx.createLinearGradient(-16, 0, 25, 0);
    hg.addColorStop(0, "rgba(0,0,0,0)");
    hg.addColorStop(0.5, glowCol);
    hg.addColorStop(1, "#ffffff");
    ctx.strokeStyle = hg;
    ctx.lineWidth = 5.0;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(23, 0); ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-7, -halfW);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = glowCol;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-7, halfW);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = edgeCol;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-7, -3.8);
    ctx.lineTo(-9, 0);
    ctx.lineTo(-7, 3.8);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = "#f8d878";
    ctx.strokeStyle = "#8a5612";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.lineTo(-9, -7.2);
    ctx.lineTo(-11.5, -4.5);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-11.5, 4.5);
    ctx.lineTo(-9, 7.2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#9e631b";
    ctx.fillRect(-16.5, -1.5, 6, 3);
    ctx.fillStyle = "#ffe89e";
    ctx.beginPath(); ctx.arc(-17.5, 0, 2.1, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawColossalGreatsword(gs) {
    const t = performance.now() * 0.0028;
    drawBaguaCircle(gs.x, gs.y + 12, 56, "#ffe28a", t, 0.78, true);
    drawPointLight(gs.x, gs.y - gs.z * 0.4, 115, "rgba(255, 220, 120, 0.30)");

    ctx.save();
    ctx.translate(gs.x, gs.y - gs.z);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const wingGrad = ctx.createLinearGradient(0, -148, 0, 18);
    wingGrad.addColorStop(0, "rgba(74, 210, 184, 0.25)");
    wingGrad.addColorStop(0.55, "rgba(255, 224, 130, 0.55)");
    wingGrad.addColorStop(1, "rgba(255, 255, 255, 0.92)");
    ctx.fillStyle = wingGrad;
    ctx.beginPath();
    ctx.moveTo(0, 20);
    ctx.lineTo(-24, -24);
    ctx.lineTo(-18, -112);
    ctx.lineTo(18, -112);
    ctx.lineTo(24, -24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const leftGrad = ctx.createLinearGradient(-14, -110, 0, 16);
    leftGrad.addColorStop(0, "#fff8dc");
    leftGrad.addColorStop(0.6, "#ffe494");
    leftGrad.addColorStop(1, "#ffffff");
    ctx.fillStyle = leftGrad;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(-15, -24);
    ctx.lineTo(-12, -110);
    ctx.lineTo(0, -110);
    ctx.closePath();
    ctx.fill();

    const rightGrad = ctx.createLinearGradient(0, -110, 14, 16);
    rightGrad.addColorStop(0, "#4ad2b8");
    rightGrad.addColorStop(0.55, "#d8a444");
    rightGrad.addColorStop(1, "#fff2bd");
    ctx.fillStyle = rightGrad;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(0, -110);
    ctx.lineTo(12, -110);
    ctx.lineTo(15, -24);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -108); ctx.stroke();
    ctx.fillStyle = "#7a490a";
    ctx.font = "bold 10px serif";
    ctx.textAlign = "center";
    ["乾", "坤", "震", "离"].forEach((ch, idx) => {
      ctx.fillText(ch, 0, -34 - idx * 18);
    });

    ctx.fillStyle = "#f5cf76";
    ctx.strokeStyle = "#fff8dc";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -98);
    ctx.lineTo(-34, -116);
    ctx.lineTo(-24, -124);
    ctx.lineTo(0, -112);
    ctx.lineTo(24, -124);
    ctx.lineTo(34, -116);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#4ad2b8";
    ctx.beginPath(); ctx.arc(0, -108, 5.2, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#9c6218";
    ctx.fillRect(-4.5, -142, 9, 28);
    ctx.fillStyle = "#ffe89e";
    ctx.beginPath(); ctx.arc(0, -146, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawTaixuSwordDomain(dm) {
    const fade = Math.min(1, dm.life * 1.5, (dm.maxLife - dm.life) * 4 + 0.2);
    drawPointLight(dm.x, dm.y, dm.r * 1.05, `rgba(248, 220, 140, ${(0.22 * fade).toFixed(2)})`);
    // Project Hand-Painted Celestial Dharma Wheel Mandala on the 2.5D Stone Floor!
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.translate(dm.x, dm.y);
    ctx.scale(1, 0.56);
    drawSprite("vfx_relic_dharma_wheel", 0, 0, dm.r * 2.15, false, false, 0.62 * fade, 1, 1, dm.rot * 0.45);
    ctx.restore();
    if (dm.relicId && RELICS[dm.relicId]) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawSprite(RELICS[dm.relicId].art, dm.x, dm.y - 78 + Math.sin(dm.rot * 3) * 6, 112, false, false, 0.48 * fade);
      ctx.restore();
    }
    drawBaguaCircle(dm.x, dm.y, dm.r, "#ffe596", dm.rot * 0.6, 0.72 * fade, true);

    ctx.save();
    ctx.translate(dm.x, dm.y);
    for (let i = 0; i < 8; i++) {
      const a = dm.rot * 0.5 + (i * Math.PI) / 4;
      const px = Math.cos(a) * dm.r;
      const py = Math.sin(a) * dm.r * 0.56;
      drawLuminousSword(px, py - 14, Math.PI / 2, i % 2 === 0 ? "gold" : "jade", 1.25);
    }
    ctx.restore();
  }

  const GROUND_SHADOW_STAMP = (() => {
    const c = document.createElement("canvas");
    c.width = 128; c.height = 64;
    const gctx = c.getContext("2d");
    const g = gctx.createRadialGradient(64, 32, 4, 64, 32, 60);
    g.addColorStop(0, "rgba(2, 7, 10, 0.74)");
    g.addColorStop(0.45, "rgba(3, 10, 14, 0.44)");
    g.addColorStop(0.78, "rgba(4, 12, 16, 0.14)");
    g.addColorStop(1, "rgba(4, 12, 16, 0)");
    gctx.fillStyle = g;
    gctx.fillRect(0, 0, 128, 64);
    return c;
  })();

  function drawGroundedShadow(x, y, rx, ry, alpha = 1.0) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(GROUND_SHADOW_STAMP, x - rx * 1.32, y - ry * 1.32, rx * 2.64, ry * 2.64);
    ctx.restore();
  }

  let frameNameplates = [];
  function drawNameplatePill(text, subText, x, y, accentCol = "#ffe89e", showSub = false) {
    frameNameplates.push({ text, subText, x, y, accentCol, showSub });
  }

  function flushNameplates() {
    if (!frameNameplates.length) return;
    const placed = [];
    // Measure all plates first
    const items = frameNameplates.map(np => {
      ctx.font = 'bold 12px "Noto Serif CJK SC", "Songti SC", serif';
      const wMain = ctx.measureText(np.text).width;
      let wSub = 0;
      if (np.showSub && np.subText) {
        ctx.font = "bold 10px sans-serif";
        wSub = ctx.measureText(np.subText).width;
      }
      const boxW = Math.max(wMain, wSub) + 26;
      const boxH = (np.showSub && np.subText) ? 35 : 22;
      return Object.assign({}, np, { boxW, boxH, drawX: np.x, drawY: np.y });
    });

    // Sort top-to-bottom and resolve vertical overlaps cleanly
    items.sort((a, b) => a.drawY - b.drawY);
    for (const it of items) {
      for (let pass = 0; pass < 4; pass++) {
        let shifted = false;
        for (const p of placed) {
          const ax1 = it.drawX - it.boxW / 2 - 4, ax2 = it.drawX + it.boxW / 2 + 4;
          const ay1 = it.drawY - it.boxH - 3, ay2 = it.drawY + 3;
          const bx1 = p.drawX - p.boxW / 2 - 4, bx2 = p.drawX + p.boxW / 2 + 4;
          const by1 = p.drawY - p.boxH - 3, by2 = p.drawY + 3;
          if (ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1) {
            it.drawY = by1 - 2;
            shifted = true;
          }
        }
        if (!shifted) break;
      }
      placed.push(it);
    }

    ctx.save();
    for (const it of placed) {
      const bx = it.drawX - it.boxW / 2;
      const by = it.drawY - it.boxH;
      ctx.fillStyle = "rgba(6, 17, 22, 0.92)";
      ctx.strokeStyle = it.accentCol;
      ctx.lineWidth = 1.05;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, it.boxW, it.boxH, 8);
      else ctx.rect(bx, by, it.boxW, it.boxH);
      ctx.fill();
      ctx.stroke();

      // Subtle diamond finial accents on left & right edges
      ctx.fillStyle = it.accentCol;
      const midY = by + it.boxH / 2;
      ctx.beginPath(); ctx.arc(bx + 6, midY, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bx + it.boxW - 6, midY, 1.8, 0, Math.PI * 2); ctx.fill();

      ctx.font = 'bold 12px "Noto Serif CJK SC", "Songti SC", serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff8e8";
      ctx.fillText(it.text, it.drawX, by + (it.showSub && it.subText ? 11.5 : it.boxH / 2 + 0.5));

      if (it.showSub && it.subText) {
        ctx.font = "bold 10px sans-serif";
        ctx.fillStyle = it.accentCol;
        ctx.fillText(it.subText, it.drawX, by + 25.5);
      }
    }
    ctx.restore();
    frameNameplates.length = 0;
  }

  function drawSkyLightningBolt(x, y, progress, color = "#e2b8ff") {
    const alpha = Math.max(0, 1 - progress);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = alpha;
    const pg = ctx.createLinearGradient(x, 0, x, y);
    pg.addColorStop(0, "rgba(214, 158, 255, 0.0)");
    pg.addColorStop(0.5, color);
    pg.addColorStop(1, "#ffffff");
    ctx.strokeStyle = pg;
    ctx.lineWidth = 18 * alpha;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.shadowColor = color;
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    let cx = x + (Math.sin(y * 0.1) * 18);
    ctx.moveTo(cx, 0);
    const segs = 7;
    for (let s = 1; s <= segs; s++) {
      const ny = (y * s) / segs;
      const nx = s === segs ? x : x + Math.sin(s * 2.7 + progress * 18) * 24;
      ctx.lineTo(nx, ny);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawSingleFlyingSwordWithTrail(sw, swordTint, isRing, alphaMult = 1.0, scaleMult = 1.0) {
    const tSkin = (game && game.cosmetics && game.cosmetics.trailSkin) || (game && game.taixuTrailActive ? "taixu_prismatic" : "ink_jade");
    const isHighStyle = (arena.styleScore || 0) >= 580;
    const taixuGlow = isHighStyle || tSkin === "taixu_prismatic" || !!(game && game.taixuTrailActive && tSkin === "ink_jade");
    if (sw.trail.length > 2) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 1; i < sw.trail.length; i++) {
        const ratio = i / sw.trail.length;
        ctx.strokeStyle = taixuGlow
          ? (i % 2 === 0 ? `rgba(218, 148, 255, ${(ratio * 0.86 * alphaMult).toFixed(3)})` : `rgba(112, 255, 230, ${(ratio * 0.86 * alphaMult).toFixed(3)})`)
          : tSkin === "crimson_flame"
            ? `rgba(255, 72, 92, ${(ratio * 0.82 * alphaMult).toFixed(3)})`
            : tSkin === "zixiao_thunder"
              ? `rgba(206, 148, 255, ${(ratio * 0.80 * alphaMult).toFixed(3)})`
              : (sw.state === "orbit" && !isRing && swordTint === "jade")
                ? `rgba(74, 210, 184, ${(ratio * 0.42 * alphaMult).toFixed(3)})`
                : `rgba(248, 227, 172, ${(ratio * 0.80 * alphaMult).toFixed(3)})`;
        ctx.lineWidth = (1.2 + ratio * (taixuGlow ? 7.2 : isRing ? 6.0 : sw.state === "orbit" ? 2.6 : 5.8)) * scaleMult;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sw.trail[i - 1].x, sw.trail[i - 1].y);
        ctx.lineTo(sw.trail[i].x, sw.trail[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }
    const prev = sw.trail[sw.trail.length - 2] || { x: sw.x - 1, y: sw.y };
    const bladeAng = Math.atan2(sw.y - prev.y, sw.x - prev.x);
    ctx.save();
    ctx.globalAlpha *= alphaMult;
    drawLuminousSword(sw.x, sw.y, bladeAng, swordTint, (isRing ? 1.18 : 1.0) * scaleMult);
    ctx.restore();
  }

  // ==================== Q4 (F25) VOL 1 & SANCTUM 3-LAYER ATMOSPHERIC DEPTH + UNIFIED PARALLAX ====================
  let _lastBgTransform = "";
  let _lastBgFilter = "";
  let _lastCanvasFilter = "";
  const _sceneLayerCache = { key: "", w: 0, h: 0, far: null, mid: null, fg: null };
  const visualLayersRuntime = {
    enabled: true,
    reducedMotion: false,
    stageMode: "vol1",
    bgParallaxX: 0,
    bgParallaxY: 0,
    fgOffsetX: 0,
    fgOffsetY: 0,
    fgMarginPct: 0.11,
    activeDrawn: false
  };
  function getVisualLayersState() {
    return Object.assign({}, visualLayersRuntime, {
      enabled: Boolean(a11ySettings && a11ySettings.enhancedVisualLayers),
      reducedMotion: isReducedMotionActive()
    });
  }
  function setVisualLayersEnabled(flag) {
    a11ySettings.enhancedVisualLayers = Boolean(flag);
    saveA11ySettings();
    return getVisualLayersState();
  }
  function getOrBuildSceneDepthLayers(modeKey, w, h) {
    if (_sceneLayerCache.key === modeKey && _sceneLayerCache.w === w && _sceneLayerCache.h === h && _sceneLayerCache.far) {
      return _sceneLayerCache;
    }
    const mk = () => {
      const c = document.createElement("canvas");
      c.width = Math.max(64, Math.floor(w));
      c.height = Math.max(64, Math.floor(h));
      return c;
    };
    const farC = mk(), midC = mk(), fgC = mk();
    const fCtx = farC.getContext("2d");
    const mCtx = midC.getContext("2d");
    const nCtx = fgC.getContext("2d");

    const BIOME_STYLES = {
      sanctum: {
        farTop: "rgba(18, 42, 46, 0.34)", farMid: "rgba(38, 86, 84, 0.12)", ridge: "rgba(14, 34, 38, 0.24)",
        spots: [[0.24, 0.44, 140, "rgba(255, 224, 146, 0.13)"], [0.76, 0.46, 140, "rgba(255, 224, 146, 0.13)"], [0.50, 0.32, 165, "rgba(112, 255, 230, 0.09)"]],
        fgFill: "rgba(8, 24, 26, 0.46)", fgStroke: "rgba(74, 168, 152, 0.24)", motif: "bamboo"
      },
      vol1: {
        farTop: "rgba(10, 24, 30, 0.42)", farMid: "rgba(32, 68, 76, 0.14)", ridge: "rgba(8, 20, 26, 0.30)",
        spots: [[0.20, 0.40, 145, "rgba(255, 198, 108, 0.11)"], [0.80, 0.42, 135, "rgba(128, 228, 240, 0.09)"], [0.52, 0.62, 220, "rgba(148, 224, 236, 0.07)"]],
        fgFill: "rgba(5, 14, 18, 0.56)", fgStroke: "rgba(92, 152, 162, 0.22)", motif: "bamboo"
      },
      vol2: {
        farTop: "rgba(14, 40, 36, 0.38)", farMid: "rgba(52, 114, 98, 0.14)", ridge: "rgba(10, 32, 28, 0.28)",
        spots: [[0.22, 0.36, 155, "rgba(160, 246, 212, 0.10)"], [0.78, 0.38, 150, "rgba(255, 226, 152, 0.11)"], [0.50, 0.58, 200, "rgba(112, 255, 224, 0.06)"]],
        fgFill: "rgba(7, 24, 20, 0.50)", fgStroke: "rgba(96, 188, 152, 0.26)", motif: "pine"
      },
      vol3: {
        farTop: "rgba(8, 28, 44, 0.44)", farMid: "rgba(58, 148, 182, 0.15)", ridge: "rgba(6, 22, 36, 0.30)",
        spots: [[0.26, 0.44, 160, "rgba(128, 236, 255, 0.12)"], [0.74, 0.48, 155, "rgba(148, 226, 255, 0.11)"], [0.50, 0.66, 230, "rgba(112, 255, 236, 0.08)"]],
        fgFill: "rgba(5, 18, 28, 0.52)", fgStroke: "rgba(136, 234, 255, 0.28)", motif: "frost"
      },
      vol4: {
        farTop: "rgba(28, 20, 34, 0.44)", farMid: "rgba(132, 96, 62, 0.14)", ridge: "rgba(22, 16, 28, 0.32)",
        spots: [[0.20, 0.42, 150, "rgba(224, 178, 108, 0.10)"], [0.80, 0.42, 150, "rgba(186, 134, 255, 0.10)"], [0.50, 0.60, 210, "rgba(255, 210, 138, 0.06)"]],
        fgFill: "rgba(14, 10, 18, 0.54)", fgStroke: "rgba(216, 179, 106, 0.26)", motif: "swords"
      },
      vol5: {
        farTop: "rgba(22, 18, 42, 0.40)", farMid: "rgba(246, 206, 118, 0.14)", ridge: "rgba(28, 24, 48, 0.26)",
        spots: [[0.24, 0.34, 170, "rgba(255, 232, 152, 0.13)"], [0.76, 0.34, 170, "rgba(196, 164, 255, 0.11)"], [0.50, 0.50, 240, "rgba(255, 242, 188, 0.08)"]],
        fgFill: "rgba(14, 12, 26, 0.48)", fgStroke: "rgba(255, 224, 136, 0.28)", motif: "eaves"
      }
    };
    const stBiome = BIOME_STYLES[modeKey] || BIOME_STYLES.vol1;

    // Far Layer: Atmospheric ink-wash mountain ridge & biome mist haze
    const farGrad = fCtx.createLinearGradient(0, 0, 0, h * 0.42);
    farGrad.addColorStop(0, stBiome.farTop);
    farGrad.addColorStop(0.65, stBiome.farMid);
    farGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    fCtx.fillStyle = farGrad;
    fCtx.fillRect(0, 0, w, h * 0.44);
    fCtx.fillStyle = stBiome.ridge;
    fCtx.beginPath();
    fCtx.moveTo(0, h * 0.24);
    fCtx.quadraticCurveTo(w * 0.18, h * (modeKey === "vol2" || modeKey === "vol5" ? 0.09 : 0.11), w * 0.38, h * 0.20);
    fCtx.quadraticCurveTo(w * 0.62, h * (modeKey === "vol4" ? 0.12 : 0.08), w * 0.84, h * 0.19);
    fCtx.lineTo(w, h * 0.14);
    fCtx.lineTo(w, 0);
    fCtx.lineTo(0, 0);
    fCtx.closePath();
    fCtx.fill();

    // Mid Layer: Biome atmospheric pools (rain sheen / jade mist / frost glow / bronze haze / celestial cloud gold)
    for (const [rx, ry, rad, col] of stBiome.spots) {
      const g = mCtx.createRadialGradient(w * rx, h * ry, 6, w * rx, h * ry, rad);
      g.addColorStop(0, col);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      mCtx.fillStyle = g;
      mCtx.beginPath();
      mCtx.ellipse(w * rx, h * ry, rad, rad * 0.54, 0, 0, Math.PI * 2);
      mCtx.fill();
    }

    // Near Foreground Layer: Biome silhouettes strictly clamped to outer 10-11% bottom corners (fgMarginPct <= 0.11, never occludes danger telegraphs!)
    const marginW = w * 0.108;
    const cornerTop = h * 0.77;
    nCtx.fillStyle = stBiome.fgFill;
    nCtx.beginPath();
    nCtx.moveTo(0, h);
    nCtx.lineTo(0, cornerTop);
    nCtx.quadraticCurveTo(marginW * 0.42, cornerTop + 26, marginW * 0.88, h - 18);
    nCtx.lineTo(marginW, h);
    nCtx.closePath();
    nCtx.fill();
    nCtx.beginPath();
    nCtx.moveTo(w, h);
    nCtx.lineTo(w, cornerTop + 8);
    nCtx.quadraticCurveTo(w - marginW * 0.45, cornerTop + 30, w - marginW * 0.90, h - 16);
    nCtx.lineTo(w - marginW, h);
    nCtx.closePath();
    nCtx.fill();

    nCtx.strokeStyle = stBiome.fgStroke;
    nCtx.lineWidth = 2.0;
    if (stBiome.motif === "swords") {
      // Vol 4 Ancient Sword Mound: slanted broken sword hilts inside outer 10.5% corners
      for (let b = 0; b < 3; b++) {
        const lx = 18 + b * 28;
        const rx = w - 18 - b * 28;
        nCtx.beginPath(); nCtx.moveTo(lx, h); nCtx.lineTo(lx + 18, h - 78 - b * 10); nCtx.stroke();
        nCtx.beginPath(); nCtx.moveTo(lx + 6, h - 54 - b * 8); nCtx.lineTo(lx + 24, h - 48 - b * 8); nCtx.stroke();
        nCtx.beginPath(); nCtx.moveTo(rx, h); nCtx.lineTo(rx - 18, h - 74 - b * 10); nCtx.stroke();
        nCtx.beginPath(); nCtx.moveTo(rx - 6, h - 52 - b * 8); nCtx.lineTo(rx - 24, h - 46 - b * 8); nCtx.stroke();
      }
    } else if (stBiome.motif === "frost") {
      // Vol 3 Cold Pond: crystalline frost spires in outer corners
      for (let b = 0; b < 3; b++) {
        const lx = 14 + b * 26;
        const rx = w - 14 - b * 26;
        nCtx.beginPath(); nCtx.moveTo(lx, h); nCtx.lineTo(lx + 12, h - 72 - b * 12); nCtx.lineTo(lx + 24, h); nCtx.stroke();
        nCtx.beginPath(); nCtx.moveTo(rx, h); nCtx.lineTo(rx - 12, h - 68 - b * 12); nCtx.lineTo(rx - 24, h); nCtx.stroke();
      }
    } else if (stBiome.motif === "eaves") {
      // Vol 5 Nine-Heavens Gate: upturned celestial pavilion eaves
      for (let b = 0; b < 2; b++) {
        const yOff = h - 34 - b * 28;
        nCtx.beginPath(); nCtx.moveTo(0, yOff + 14); nCtx.quadraticCurveTo(marginW * 0.55, yOff + 8, marginW * 0.92, yOff - 10); nCtx.stroke();
        nCtx.beginPath(); nCtx.moveTo(w, yOff + 14); nCtx.quadraticCurveTo(w - marginW * 0.55, yOff + 8, w - marginW * 0.92, yOff - 10); nCtx.stroke();
      }
    } else {
      // Sanctum / Vol 1 bamboo fronds / Vol 2 Qingyun pine boughs
      for (let b = 0; b < 3; b++) {
        nCtx.beginPath();
        nCtx.moveTo(10 + b * 24, h);
        nCtx.quadraticCurveTo(22 + b * 28, h - 54 - b * 14, 48 + b * 26, h - 88 - b * 10);
        nCtx.stroke();
        nCtx.beginPath();
        nCtx.moveTo(w - 10 - b * 24, h);
        nCtx.quadraticCurveTo(w - 22 - b * 28, h - 50 - b * 14, w - 48 - b * 26, h - 84 - b * 10);
        nCtx.stroke();
      }
    }

    _sceneLayerCache.key = modeKey;
    _sceneLayerCache.w = w;
    _sceneLayerCache.h = h;
    _sceneLayerCache.far = farC;
    _sceneLayerCache.mid = midC;
    _sceneLayerCache.fg = fgC;
    return _sceneLayerCache;
  }

  function renderArenaCanvas() {
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const nowSec = performance.now() * 0.001;
    const rm = isReducedMotionActive();
    const degLvl = getEffectivePerfDegradeLevel();
    const layersOn = Boolean(a11ySettings && a11ySettings.enhancedVisualLayers) && degLvl < 2;
    const isDepthScene = Boolean(arena.sanctumMode || (!arena.towerMode && arena.stageIdx >= 0 && arena.stageIdx < STAGES.length));
    const depthModeKey = arena.sanctumMode ? "sanctum" : `vol${Math.max(1, Math.min(STAGES.length, (arena.stageIdx || 0) + 1))}`;

    const bgEl = document.getElementById("stage-bg-img");
    const effZoom = photoMode.active ? photoMode.zoom : (rm ? 1.0 : (arena.camZoom || 1));
    const pNormX = (game && arena.player && w > 0) ? ((arena.player.x / w) - 0.5) : 0;
    const pNormY = (game && arena.player && h > 0) ? ((arena.player.y / h) - 0.5) : 0;
    const bgPx = photoMode.active ? (photoMode.panX * 0.45) : (rm ? 0 : (pNormX * -42 * 0.35));
    const bgPy = photoMode.active ? (photoMode.panY * 0.45) : (rm ? 0 : (pNormY * -28 * 0.35));
    visualLayersRuntime.enabled = Boolean(a11ySettings && a11ySettings.enhancedVisualLayers);
    visualLayersRuntime.reducedMotion = rm;
    visualLayersRuntime.stageMode = arena.sanctumMode ? "sanctum" : `stage_${arena.stageIdx}`;
    visualLayersRuntime.biomeKey = depthModeKey;
    visualLayersRuntime.bgParallaxX = Number(bgPx.toFixed(2));
    visualLayersRuntime.bgParallaxY = Number(bgPy.toFixed(2));
    visualLayersRuntime.fgOffsetX = rm ? 0 : Number(Math.max(-18, Math.min(18, bgPx * -1.25)).toFixed(2));
    visualLayersRuntime.fgOffsetY = rm ? 0 : Number(Math.max(-10, Math.min(10, bgPy * -1.25)).toFixed(2));
    visualLayersRuntime.activeDrawn = Boolean(layersOn && isDepthScene);

    const filterCss = photoMode.active
      ? (photoMode.filter === "ink" ? "grayscale(0.88) contrast(1.32) brightness(1.06)"
        : photoMode.filter === "thunder" ? "hue-rotate(28deg) saturate(1.38) contrast(1.14)"
        : photoMode.filter === "ember" ? "sepia(0.38) saturate(1.48) contrast(1.15)" : "none")
      : "none";
    if (bgEl) {
      if (_lastBgFilter !== filterCss) {
        bgEl.style.filter = filterCss === "none" ? "" : filterCss;
        _lastBgFilter = filterCss;
      }
      const nextTransform = (photoMode.active || Math.abs(effZoom - 1) > 0.002 || Math.abs(bgPx) > 0.05 || Math.abs(bgPy) > 0.05)
        ? `translate(${bgPx.toFixed(1)}px, ${bgPy.toFixed(1)}px) scale(${effZoom.toFixed(3)})`
        : "translate(0px, 0px) scale(1.000)";
      if (_lastBgTransform !== nextTransform) {
        bgEl.style.transform = nextTransform;
        _lastBgTransform = nextTransform;
      }
    }
    if (_lastCanvasFilter !== filterCss) {
      canvas.style.filter = filterCss;
      _lastCanvasFilter = filterCss;
    }

    ctx.save();
    const focX = arena.camFocusT > 0 ? (w / 2 + (arena.camFocusX - w / 2) * 0.28) : w / 2;
    const focY = arena.camFocusT > 0 ? (h / 2 + (arena.camFocusY - h / 2) * 0.28) : h / 2;
    if (photoMode.active) {
      ctx.translate(w / 2 + photoMode.panX, h / 2 + photoMode.panY);
      ctx.scale(photoMode.zoom, photoMode.zoom);
      ctx.translate(-w / 2, -h / 2);
    } else if (!rm && ((arena.camZoom || 1) > 1.002 || Math.abs(arena.camKickX || 0) > 0.2)) {
      const kScale = a11ySettings.shakeScale;
      ctx.translate(w / 2 + (arena.camKickX || 0) * kScale, h / 2 + (arena.camKickY || 0) * kScale);
      ctx.scale(arena.camZoom || 1, arena.camZoom || 1);
      ctx.translate(-focX, -focY);
    }
    const effShakeScale = rm ? 0 : a11ySettings.shakeScale;
    if (arena.shake > 0.2 && effShakeScale > 0.01) {
      const effShake = arena.shake * effShakeScale;
      ctx.translate((Math.random() - 0.5) * effShake, (Math.random() - 0.5) * effShake);
    }

    // F25 + F34 All 5 Campaign Biomes & Sanctum Offscreen-Cached Far & Mid Depth Layers
    let depthCache = null;
    if (layersOn && isDepthScene) {
      depthCache = getOrBuildSceneDepthLayers(depthModeKey, w, h);
      ctx.drawImage(depthCache.far, bgPx * 0.65, bgPy * 0.65);
      ctx.drawImage(depthCache.mid, bgPx * 0.25, bgPy * 0.25);
    }

    // 0a. Fast Stamp-Cached Drifting Cloud-Shadow Layer (degrades cleanly at Level 2 & freezes under reducedMotion)
    if (degLvl < 2) {
      const shadowStamp = getGlowStamp("rgba(2, 8, 12, 0.17)");
      for (let cs = 0; cs < 2; cs++) {
        const driftT = rm ? 0 : nowSec;
        const cx = ((driftT * 28 + cs * w * 0.55) % (w * 1.4)) - w * 0.2;
        const cy = h * (0.35 + cs * 0.28);
        const cr = w * 0.32;
        ctx.drawImage(shadowStamp, cx - cr, cy - cr * 0.65, cr * 2, cr * 1.3);
      }
    }

    // 0. Enhanced Volumetric Cloud God-Rays (`云隙体积神光`)
    if (degLvl < 2) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const ksRay = getKarmaState(game);
      const rayCol = ksRay.mode === "demonic" ? "rgba(255, 86, 108, 0.055)" : arena.sanctumMode ? "rgba(255, 234, 172, 0.085)" : arena.stageIdx === 2 ? "rgba(98, 238, 230, 0.06)" : arena.stageIdx === 3 ? "rgba(188, 130, 255, 0.05)" : "rgba(255, 234, 178, 0.068)";
      for (let r = 0; r < 4; r++) {
        const rx = w * (0.16 + r * 0.22) + (rm ? 0 : Math.sin(nowSec * 0.42 + r * 1.3) * 32);
        const rg = ctx.createLinearGradient(rx - 90, 0, rx + 165, h * 0.92);
        rg.addColorStop(0, rayCol);
        rg.addColorStop(0.55, rayCol.replace(/0\.0\d+/, "0.025"));
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.moveTo(rx - 72, 0);
        ctx.lineTo(rx + 84, 0);
        ctx.lineTo(rx + 275, h * 0.94);
        ctx.lineTo(rx + 55, h * 0.94);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 0b. V18 Real-Time Water & Polished White-Jade Planar Character Reflections (`水面/白玉台实时角色倒影`)
    if (game && degLvl < 1) {
      const reflAlpha = (arena.sanctumMode || arena.stageIdx === 0 || arena.stageIdx === 2 || arena.stageIdx === 4) ? 0.19 : 0.12;
      ctx.save();
      const reflSkew = rm ? 0 : Math.sin(nowSec * 3.2) * 0.05;
      const pRef = arena.player;
      const pPoseRef = computePlayerVisualPose(pRef, nowSec);
      const pImg = IMG_CACHE[pRef.meditating ? "char_player_seated" : "actor_player_battle"];
      if (pImg && pImg.complete) {
        ctx.save();
        ctx.globalAlpha = reflAlpha * Math.max(0.25, 1 - (pRef.z || 0) / 130);
        ctx.translate(pRef.x + pPoseRef.ox, pRef.y + 36 + (pRef.z || 0) * 0.22);
        ctx.transform((pRef.facing < 0 ? -1 : 1) * pPoseRef.sx, 0, reflSkew, -0.44 * pPoseRef.sy, 0, 0);
        ctx.drawImage(pImg, -52, -52, 104, 104);
        ctx.restore();
      }
      for (const e of arena.enemies) {
        const eImg = IMG_CACHE[e.art];
        if (!eImg || !eImg.complete) continue;
        const esz = e.isBoss ? 132 : e.isTreasure ? 58 : 90;
        const eFlip = (e.facing !== undefined ? e.facing < 0 : e.x > pRef.x);
        ctx.save();
        ctx.globalAlpha = reflAlpha * 0.85 * Math.max(0.25, 1 - (e.airborneZ || 0) / 110);
        ctx.translate(e.x, e.y + e.r * 0.68);
        ctx.transform(eFlip ? -1 : 1, 0, -reflSkew, -0.40, 0, 0);
        ctx.drawImage(eImg, -esz / 2, -esz / 2, esz, esz);
        ctx.restore();
      }
      ctx.restore();
    }

    // 1. Central Plaza Spirit Vein Eye
    const center = getPlazaCenter(w, h);
    const inEye = game && Math.hypot(arena.player.x - center.x, (arena.player.y - center.y) / 0.58) < 76;
    drawBaguaCircle(center.x, center.y, 68, (arena.sanctumMode || inEye) ? "#ffe28a" : "rgba(112, 235, 215, 0.38)", nowSec * 0.35, arena.sanctumMode ? 0.78 : (inEye ? 0.78 : 0.38), true);
    const nearCenterProp = arena.props.some(pr => Math.hypot(pr.x - center.x, pr.y - center.y) < 120);
    if (game && !cutscene.active && !nearCenterProp && (arena.sanctumMode || (arena.enemies.length === 0 && arena.drops.length === 0 && !arena.player.meditating))) {
      ctx.save();
      ctx.font = "bold 11px sans-serif";
      ctx.fillStyle = "rgba(248, 227, 172, 0.78)";
      ctx.textAlign = "center";
      ctx.fillText(arena.sanctumMode ? "☯ 聚灵阵眼 · 按 B 吐纳养剑" : "☯ 灵眼 · 按 B 吐纳聚气", center.x, center.y + 42);
      ctx.restore();
    }

    for (const d of arena.decals) {
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.translate(d.x, d.y);
      ctx.scale(1, 0.56);
      ctx.rotate(d.ang);
      if (d.kind === "spider_crack") {
        ctx.fillStyle = "rgba(5, 10, 12, 0.48)";
        ctx.beginPath(); ctx.arc(0, 0, d.r * 0.48, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(248, 216, 138, 0.62)";
        ctx.lineWidth = 1.8;
        for (let b = 0; b < 7; b++) {
          const ba = (b * Math.PI * 2) / 7 + 0.2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ba) * d.r * 0.52, Math.sin(ba) * d.r * 0.52);
          ctx.lineTo(Math.cos(ba + 0.16) * d.r, Math.sin(ba + 0.16) * d.r);
          ctx.stroke();
        }
        ctx.strokeStyle = "rgba(10, 22, 26, 0.85)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, d.r * 0.62, 0, Math.PI * 2); ctx.stroke();
      } else if (d.kind === "scorch") {
        ctx.fillStyle = "rgba(8, 5, 4, 0.52)";
        ctx.strokeStyle = "rgba(248, 205, 115, 0.48)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, d.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(8, 18, 22, 0.65)";
        ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.moveTo(-d.r, 0); ctx.lineTo(d.r, 0); ctx.stroke();
      }
      ctx.restore();
    }

    // V16 Conductive Spirit Spring Water Pools (`灵泉水洼` / `雷泽感电` / `寒泉凝冰`) & Alchemical Fire Zones!
    for (const wp of arena.waterPools) {
      ctx.save();
      ctx.translate(wp.x, wp.y);
      ctx.scale(1, 0.56);
      const isElectro = wp.electroTimer > 0;
      const isFrozen = wp.frozenTimer > 0;
      ctx.fillStyle = isElectro ? "rgba(116, 68, 220, 0.36)" : isFrozen ? "rgba(135, 238, 255, 0.42)" : "rgba(28, 128, 152, 0.34)";
      ctx.strokeStyle = isElectro ? "#e2b8ff" : isFrozen ? "#ffffff" : "rgba(112, 245, 235, 0.58)";
      ctx.lineWidth = isElectro ? 2.6 : 1.6;
      ctx.beginPath(); ctx.arc(0, 0, wp.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = isElectro ? "#70ffe6" : "rgba(180, 250, 255, 0.32)";
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, wp.r * (0.55 + Math.sin(nowSec * 3) * 0.08), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      if (isElectro) {
        drawPointLight(wp.x, wp.y, wp.r * 1.15, "rgba(195, 130, 255, 0.30)");
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "#9effec";
        ctx.lineWidth = 2.0;
        for (let a = 0; a < 3; a++) {
          const ang1 = nowSec * 5 + a * 2.1;
          ctx.beginPath();
          ctx.moveTo(wp.x + Math.cos(ang1) * wp.r * 0.7, wp.y + Math.sin(ang1) * wp.r * 0.35);
          ctx.lineTo(wp.x + Math.cos(ang1 + 1.5) * wp.r * 0.3, wp.y + Math.sin(ang1 + 1.5) * wp.r * 0.18);
          ctx.lineTo(wp.x + Math.cos(ang1 + 2.9) * wp.r * 0.75, wp.y + Math.sin(ang1 + 2.9) * wp.r * 0.38);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    for (const fz of arena.fireZones) {
      drawPointLight(fz.x, fz.y, fz.r * 1.1, "rgba(255, 128, 52, 0.32)");
      drawBaguaCircle(fz.x, fz.y, fz.r, "#ff9f43", nowSec * 1.6, 0.72, false);
    }
    for (const fp of arena.frostPools) {
      const fAlpha = Math.min(0.75, fp.life * 0.4);
      drawPointLight(fp.x, fp.y, fp.r, `rgba(90, 225, 255, ${(fAlpha * 0.35).toFixed(2)})`);
      drawBaguaCircle(fp.x, fp.y, fp.r, "#80ecff", -nowSec * 0.9, fAlpha, false);
    }

    for (const mb of arena.meteorBursts) {
      const mf = Math.max(0, 1 - mb.t);
      drawPointLight(mb.x, mb.y, mb.r * 1.25, `rgba(255, 224, 140, ${(0.45 * mf).toFixed(2)})`);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(mb.x, mb.y);
      ctx.scale(1, 0.62);
      drawSprite("vfx_sky_meteor_plunge", 0, 0, mb.r * (1.75 + mb.t * 0.85), false, false, 0.96 * mf, 1, 1, mb.t * 1.8);
      ctx.restore();
    }
    for (const sv of arena.switchVfxList) {
      const sf = Math.max(0, 1 - sv.t);
      drawPointLight(sv.x, sv.y, sv.r * 1.2, `rgba(255, 220, 130, ${(0.36 * sf).toFixed(2)})`);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(sv.x, sv.y);
      ctx.scale(1, 0.58);
      drawSprite("vfx_switch_yin_yang", 0, 0, sv.r * (1.8 + sv.t * 0.9), false, false, 0.95 * sf, 1, 1, sv.rot + sv.t * 3.8);
      ctx.restore();
    }
    for (const vx of arena.lotusVortexes) {
      const vf = Math.min(1, vx.life / Math.min(0.4, vx.maxLife));
      drawPointLight(vx.x, vx.y, vx.r * 1.15, `rgba(255, 226, 138, ${(0.32 * vf).toFixed(2)})`);
      ctx.save();
      ctx.translate(vx.x, vx.y);
      ctx.scale(1, 0.58);
      drawSprite("vfx_ink_dragon_slash", 0, 0, vx.r * 2.25, false, false, 0.92 * vf, 1, 1, vx.rot);
      ctx.restore();
    }

    for (const rp of arena.ripples) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, rp.alpha);
      ctx.translate(rp.x, rp.y);
      ctx.scale(1, 0.54);
      ctx.strokeStyle = rp.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, rp.r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    if (arena.domain) drawTaixuSwordDomain(arena.domain);

    if (game && SWORD_STANCES[arena.stanceIdx].id === "ring") {
      drawBaguaCircle(arena.player.x, arena.player.y - 4, 82, "#70ffe6", nowSec * 3.2, 0.52, false);
    }

    if (arena.tribulation) {
      ctx.fillStyle = "rgba(16, 6, 30, 0.38)";
      ctx.fillRect(0, 0, w, h);
    }

    if (game && pointer.down && pointer.worldActive && pointer.holdTime > 0.22) {
      const p = arena.player;
      const aimAng = Math.atan2(pointer.y - p.y, pointer.x - p.x);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(aimAng);
      const grad = ctx.createLinearGradient(0, 0, 350, 0);
      grad.addColorStop(0, "rgba(248, 227, 172, 0.38)");
      grad.addColorStop(1, "rgba(74, 210, 184, 0.0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 350, -0.22, 0.22);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    for (const z of arena.zones) {
      drawBaguaCircle(z.x, z.y + 18, z.r, "#78ffe2", -nowSec * 0.85, 0.68, true);
      drawBaguaCircle(z.x, z.y + 18, z.r * 0.64, "#ffe28a", nowSec * 1.1, 0.42, false);
      drawPointLight(z.x, z.y + 10, z.r * 0.9, "rgba(74, 210, 184, 0.14)");
    }

    if (arena.sanctumMode && game) {
      const eyeLv = getSanctumLevel(game, "spirit_eye");
      const ctr = getPlazaCenter(w, h);
      const eyeR = 52 + (eyeLv - 1) * 16;
      const eyeCol = eyeLv >= 5 ? "#ffe28a" : eyeLv >= 3 ? "#70ffe6" : "#4ad2b8";
      drawBaguaCircle(ctr.x, ctr.y + 12, eyeR, eyeCol, nowSec * (0.28 + eyeLv * 0.08), 0.28 + eyeLv * 0.11, eyeLv >= 2);
      if (eyeLv >= 3) {
        drawBaguaCircle(ctr.x, ctr.y + 12, eyeR * 0.62, "#ffe28a", -nowSec * 0.55, 0.34 + (eyeLv - 2) * 0.10, false);
      }
      drawPointLight(ctr.x, ctr.y + 6, eyeR * 1.4, eyeLv >= 4 ? "rgba(255, 226, 138, 0.18)" : "rgba(112, 255, 230, 0.14)");
    }

    for (const pr of arena.props) {
      const bLv = (pr.sanctumKey && game) ? getSanctumLevel(game, pr.sanctumKey) : 1;
      const isBloodProp = pr.kind === "blood_altar" || pr.kind === "spire_wager_altar";
      const ringCol = isBloodProp ? "#ff5e57"
        : pr.kind === "branch_portal" ? (pr.branch === "elite_loot" ? "#ff7870" : "#70ffe6")
        : pr.kind === "sanctum_portal" ? "#70ffe6"
        : pr.kind === "sanctum_upgrade" ? "#b998fa"
        : pr.kind === "encounter_stele" ? "#ffe28a"
        : pr.kind === "elem_stele" ? (pr.elem === "frost" ? "#80ecff" : "#d69eff")
        : pr.kind === "ascend_gate" ? "#ffe270"
        : (pr.kind === "portal" || pr.kind === "tower_next") ? "#ffe699"
        : bLv >= 4 ? "#ffe28a"
        : pr.choice === "help" ? "#4ad2b8" : "#d8b36a";

      drawBaguaCircle(pr.x, pr.y + 24, pr.r + 4 + (bLv - 1) * 3, ringCol, nowSec * (pr.kind.includes("portal") || pr.kind === "ascend_gate" ? 1.15 : 0.42 + (bLv - 1) * 0.1), Math.min(0.95, 0.72 + (bLv - 1) * 0.06), pr.r >= 38 || bLv >= 2);
      if (bLv >= 2) {
        drawBaguaCircle(pr.x, pr.y + 24, pr.r + 12 + (bLv - 2) * 4, "#ffe28a", -nowSec * 0.55, 0.25 + (bLv - 1) * 0.09, false);
      }
      drawPointLight(pr.x, pr.y + 8, pr.r * (1.45 + (bLv - 1) * 0.18), (isBloodProp || pr.branch === "elite_loot") ? "rgba(255, 82, 72, 0.18)" : bLv >= 3 ? "rgba(112, 255, 230, 0.22)" : "rgba(248, 215, 130, 0.15)");

      if (pr.nearby || pr.progress > 0) {
        const pulse = 0.72 + Math.sin(nowSec * 5.2) * 0.24;
        ctx.save();
        ctx.translate(pr.x, pr.y);
        ctx.strokeStyle = (isBloodProp || pr.branch === "elite_loot") ? "#ff6b6b" : "#70ffe6";
        ctx.globalAlpha = pr.nearby ? pulse : 1;
        ctx.lineWidth = pr.nearby ? 3.8 : 4.5;
        ctx.beginPath();
        const span = pr.progress > 0 ? pr.progress * Math.PI * 2 : Math.PI * 2;
        ctx.ellipse(0, 24, pr.r + 9, (pr.r + 9) * 0.54, 0, -Math.PI / 2, -Math.PI / 2 + span);
        ctx.stroke();
        ctx.restore();
      }
    }

    // 6. Magnetic Drops + Sky-Piercing Equipment Loot Beams!
    for (const d of arena.drops) {
      if (d.kind === "gear" && d.gear) {
        const rCol = RARITIES[d.gear.rarity].color;
        drawPointLight(d.x, d.y + 4, 42, rCol);
        // Tall Vertical Loot Beam!
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const bg = ctx.createLinearGradient(d.x, d.y, d.x, d.y - (75 + d.gear.rarity * 22));
        bg.addColorStop(0, rCol);
        bg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.strokeStyle = bg;
        ctx.lineWidth = 4 + d.gear.rarity * 1.4;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x, d.y - (75 + d.gear.rarity * 22)); ctx.stroke();
        ctx.restore();

        drawSprite(d.gear.art, d.x, d.y - 6 + Math.sin(nowSec * 4) * 3, 36);
        ctx.save();
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(4,10,13,0.92)";
        ctx.strokeText(d.gear.name, d.x, d.y - 28);
        ctx.fillStyle = rCol;
        ctx.fillText(d.gear.name, d.x, d.y - 28);
        ctx.restore();
        continue;
      }

      const dropLightCol = d.kind === "qi" ? "rgba(74, 210, 184, 0.35)"
        : d.kind === "dew" ? "rgba(128, 236, 255, 0.42)"
        : d.kind === "lotus" ? "rgba(255, 165, 224, 0.44)"
        : d.kind === "soul" ? "rgba(199, 146, 255, 0.46)"
        : d.kind === "dao" ? "rgba(255, 216, 107, 0.52)"
        : "rgba(248, 220, 130, 0.35)";
      drawPointLight(d.x, d.y + 4, 26, dropLightCol);
      ctx.save();
      ctx.translate(d.x, d.y);
      if (d.kind === "sacred_core") { drawPointLight(0, 0, 48, "rgba(255, 210, 95, 0.55)"); drawSprite("item_dao", 0, -6 + Math.sin(nowSec * 5) * 4, 38); }
      else if (d.kind === "herb") drawSprite("item_herb", 0, 0, 30);
      else if (d.kind === "dew") drawSprite("item_dew", 0, 0, 28);
      else if (d.kind === "core") drawSprite("item_core", 0, 0, 28);
      else if (d.kind === "jade") drawSprite("item_jade", 0, 0, 29);
      else if (d.kind === "lotus") drawSprite("item_lotus", 0, 0, 30);
      else if (d.kind === "soul") drawSprite("item_soul", 0, 0, 30);
      else if (d.kind === "dao") drawSprite("item_dao", 0, -2 + Math.sin(nowSec * 4) * 3, 32);
      else if (d.kind === "stone") drawSprite("item_jade", 0, 0, 22);
      else {
        ctx.shadowColor = "#4ad2b8";
        ctx.fillStyle = "#80ffea";
        ctx.beginPath(); ctx.arc(0, 0, 6.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath(); ctx.arc(0, 0, 3.0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // 7. AAA Differentiated Enemy Telegraphs: Golden Deflectable (`✦`) vs Crimson Perilous (`【危】`)
    for (const e of arena.enemies) {
      if (e.state === "windup") {
        const totW = e.curWindupTotal || e.windupDur || 0.8;
        const prog = 1 - Math.max(0, Math.min(1, e.timer / totW));
        const isGrab = !!e.grabWindup;
        const isLow = !!e.lowSweepWindup;
        const isPeril = !!e.perilous;
        const mainStroke = isGrab ? "#ffae33" : isLow ? "#38f9d7" : isPeril ? "#ff4d4f" : "#ffe27a";
        const mainFill   = isGrab ? `rgba(255, 174, 51, ${0.20 + prog * 0.30})` : isLow ? `rgba(56, 249, 215, ${0.16 + prog * 0.28})` : isPeril ? `rgba(235, 45, 55, ${0.18 + prog * 0.32})` : `rgba(255, 215, 90, ${0.14 + prog * 0.28})`;

        const atkSpec = getEnemyAttackSpec(e);
        ctx.save();
        if (atkSpec.shape === "rect") {
          ctx.translate(e.x, e.y + atkSpec.originYOff);
          ctx.rotate(atkSpec.ang);
          ctx.fillStyle = mainFill;
          ctx.strokeStyle = mainStroke;
          ctx.lineWidth = 2.2;
          ctx.fillRect(0, -atkSpec.halfW, atkSpec.len, atkSpec.halfW * 2);
          ctx.strokeRect(0, -atkSpec.halfW, atkSpec.len, atkSpec.halfW * 2);
          ctx.fillStyle = "rgba(255, 244, 180, 0.45)";
          ctx.fillRect(0, -atkSpec.halfW, atkSpec.len * prog, atkSpec.halfW * 2);
        } else if (atkSpec.shape === "cone") {
          ctx.translate(e.x, e.y + atkSpec.originYOff);
          ctx.fillStyle = isPeril ? `rgba(96, 224, 255, ${0.16 + prog * 0.24})` : mainFill;
          ctx.strokeStyle = isPeril ? "#80ecff" : mainStroke;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, atkSpec.len, atkSpec.ang - atkSpec.spread, atkSpec.ang + atkSpec.spread);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, atkSpec.len * prog, atkSpec.ang - atkSpec.spread, atkSpec.ang + atkSpec.spread);
          ctx.closePath();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.6;
          ctx.stroke();
          if (atkSpec.frostPoolR > 0 && Number.isFinite(atkSpec.aimX) && Number.isFinite(atkSpec.aimY)) {
            ctx.restore();
            ctx.save();
            ctx.translate(atkSpec.aimX, atkSpec.aimY);
            ctx.scale(1, 0.56);
            ctx.fillStyle = `rgba(112, 236, 255, ${0.14 + prog * 0.22})`;
            ctx.strokeStyle = "#80ecff";
            ctx.lineWidth = 2.6;
            ctx.beginPath(); ctx.arc(0, 0, atkSpec.frostPoolR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          }
        } else if (atkSpec.shape === "cross") {
          ctx.translate(e.x, e.y + atkSpec.originYOff);
          ctx.fillStyle = mainFill;
          ctx.strokeStyle = "#ff7875";
          ctx.lineWidth = 2.2;
          const armCount = atkSpec.arms || 4;
          for (let q = 0; q < armCount; q++) {
            ctx.save();
            ctx.rotate(atkSpec.ang + (q * Math.PI) / 2);
            ctx.fillRect(0, -atkSpec.halfW, atkSpec.len, atkSpec.halfW * 2);
            ctx.strokeRect(0, -atkSpec.halfW, atkSpec.len, atkSpec.halfW * 2);
            ctx.fillStyle = "rgba(255, 224, 210, 0.42)";
            ctx.fillRect(0, -atkSpec.halfW, atkSpec.len * prog, atkSpec.halfW * 2);
            ctx.restore();
          }
        } else if (atkSpec.shape === "target_ellipse") {
          ctx.translate(atkSpec.x, atkSpec.y);
          ctx.scale(1, atkSpec.ellY);
          ctx.fillStyle = `rgba(214, 158, 255, ${0.18 + prog * 0.30})`;
          ctx.strokeStyle = "#ff5e57";
          ctx.lineWidth = 3.2;
          ctx.beginPath(); ctx.arc(0, 0, atkSpec.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = "#ffe28a";
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.arc(0, 0, atkSpec.r * prog, 0, Math.PI * 2); ctx.stroke();
        } else {
          const maxR = atkSpec.r;
          ctx.translate(e.x, e.y + atkSpec.originYOff);
          ctx.scale(1, atkSpec.ellY);
          ctx.fillStyle = mainFill;
          ctx.strokeStyle = mainStroke;
          ctx.lineWidth = isPeril ? 3.4 : 2.6;
          ctx.beginPath(); ctx.arc(0, 0, maxR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.strokeStyle = isPeril ? "#ffb3ae" : "#ffffff";
          ctx.lineWidth = 2.0;
          ctx.beginPath(); ctx.arc(0, 0, maxR * prog, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();

        // Draw Unmistakable Overhead Star Glint (`✦`) or Calligraphic `【危】` Seal!
        ctx.save();
        if (isGrab) {
          const pulseS = 1.0 + Math.sin(nowSec * 18) * 0.14;
          ctx.translate(e.x, e.y - (e.isBoss ? 108 : 78));
          ctx.scale(pulseS, pulseS);
          ctx.font = '900 24px "Noto Serif CJK SC", serif';
          ctx.textAlign = "center";
          ctx.strokeStyle = "#261402";
          ctx.lineWidth = 4.2;
          ctx.strokeText("擒", 0, 0);
          ctx.fillStyle = "#ffbe42";
          ctx.fillText("擒", 0, 0);
        } else if (isLow) {
          const pulseS = 1.0 + Math.sin(nowSec * 18) * 0.12;
          ctx.translate(e.x, e.y - (e.isBoss ? 108 : 78));
          ctx.scale(pulseS, pulseS);
          ctx.font = '900 20px "Noto Serif CJK SC", serif';
          ctx.textAlign = "center";
          ctx.strokeStyle = "#041e24";
          ctx.lineWidth = 4;
          ctx.strokeText("下危·跃", 0, 0);
          ctx.fillStyle = "#38f9d7";
          ctx.fillText("下危·跃", 0, 0);
        } else if (isPeril) {
          const pulseS = 1.0 + Math.sin(nowSec * 18) * 0.12;
          ctx.translate(e.x, e.y - (e.isBoss ? 108 : 78));
          ctx.scale(pulseS, pulseS);
          ctx.font = '900 24px "Noto Serif CJK SC", serif';
          ctx.textAlign = "center";
          ctx.shadowColor = "#ff2a2a";
          ctx.strokeStyle = "#2b0404";
          ctx.lineWidth = 4;
          ctx.strokeText("危", 0, 0);
          ctx.fillStyle = "#ff5252";
          ctx.fillText("危", 0, 0);
        } else if (prog > 0.35) {
          ctx.globalCompositeOperation = "lighter";
          ctx.translate(e.x + ((e.facing !== undefined ? e.facing < 0 : e.x > arena.player.x) ? -22 : 22), e.y - 22);
          ctx.rotate(nowSec * 6);
          ctx.fillStyle = "#fff6cc";
          for (let g = 0; g < 2; g++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.ellipse(0, 0, 22 * prog, 3.2, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    // Companion Spirit-Link Formation Tethers (`三才同心剑链`) & Jade Decoys & Thunder Orbs!
    if (game && arena.activeAllies.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      arena.activeAllies.forEach(al => {
        const lg = ctx.createLinearGradient(arena.player.x, arena.player.y, al.x, al.y);
        lg.addColorStop(0, "rgba(255, 230, 150, 0.65)");
        lg.addColorStop(0.5, al.color);
        lg.addColorStop(1, "rgba(112, 255, 230, 0.65)");
        ctx.strokeStyle = lg;
        ctx.lineWidth = 2.8;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.moveTo(arena.player.x, arena.player.y + 6);
        ctx.lineTo(al.x, al.y + 6);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.restore();
    }

    for (const dc of arena.jadeDecoys) {
      drawPointLight(dc.x, dc.y, 68, "rgba(112, 255, 230, 0.32)");
      drawSprite("actor_player_battle", dc.x, dc.y - 12, 102, dc.facing < 0, true, 0.65);
    }

    // V19 Sanctum Dojo 8s Ghost Avatar Playback (`剑道留影 · 金色半透明演武残影`)
    const ghostSample = getActiveGhostSample();
    if (ghostSample) {
      ctx.save();
      drawBaguaCircle(ghostSample.x, ghostSample.y + 32, 38, "#ffe28a", -nowSec * 2.4, 0.62, false);
      drawPointLight(ghostSample.x, ghostSample.y - 10 - ghostSample.z, 76, "rgba(255, 224, 130, 0.32)");
      drawSprite("actor_player_battle", ghostSample.x, ghostSample.y - 12 - ghostSample.z, 102, ghostSample.facing < 0, true, 0.56);
      if (ghostSample.slash) {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(255, 230, 140, 0.78)";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(ghostSample.x + ghostSample.facing * 24, ghostSample.y - 12 - ghostSample.z, 68, -0.9, 0.9);
        ctx.stroke();
      }
      drawNameplatePill("👻 剑道留影残影", ghostSample.posture === "xuanzhong" ? "玄重巨阙式" : "青莲疾剑式", ghostSample.x, ghostSample.y - 76 - ghostSample.z, "#ffe28a", false);
      ctx.restore();
    }

    // V19 Giant Translucent Boss Soul Dharma Avatars (`太虚镇妖魂印 · 妖王法相真身`)
    for (const sa of arena.soulAvatars) {
      const sf = Math.sin(Math.min(1, sa.t) * Math.PI);
      drawPointLight(sa.x, sa.y, 145, "rgba(255, 195, 110, 0.38)");
      drawBaguaCircle(sa.x, sa.y + 42, 74, sa.color, nowSec * 3.5, 0.78 * sf, true);
      drawSprite(sa.art, sa.x, sa.y - 22 - sa.t * 14, 172 + sa.t * 24, sa.facing < 0, true, 0.78 * sf);
      drawSprite("spirit_seal_emblem", sa.x, sa.y - 98, 54, false, false, 0.92 * sf);
    }

    for (const to of arena.thunderOrbs) {
      drawPointLight(to.x, to.y, 76, "rgba(214, 158, 255, 0.35)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "#e2b8ff";
      ctx.shadowColor = "#d69eff";
      ctx.beginPath(); ctx.arc(to.x, to.y - 12 + Math.sin(nowSec * 8) * 4, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath(); ctx.arc(to.x, to.y - 12 + Math.sin(nowSec * 8) * 4, 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // V24 Shanhe Sheji Scroll Blue-Green Xuan-Paper Dimension Backdrop & Floating 9-Syllable Mantras!
    if (arena.shanheDomain && arena.shanheDomain.active) {
      const sd = arena.shanheDomain;
      ctx.save();
      ctx.fillStyle = "rgba(238, 226, 196, 0.24)";
      ctx.fillRect(0, 0, w, h);
      // Classical Double Ink-Scroll Frame inside Arena
      ctx.strokeStyle = "rgba(92, 66, 38, 0.62)";
      ctx.lineWidth = 4;
      ctx.strokeRect(26, 68, w - 52, h - 166);
      // Floating Shanhe Scroll Relic Top-Center Watermark
      drawSprite("scroll_shanhe_sheji", w * 0.5, h * 0.22 + Math.sin(nowSec * 2.2) * 6, 148, false, false, 0.78);
      // Render Stamped Golden-Cinnabar Nine-Syllable Mantras (`临·兵·斗·者·皆·阵·列·在·前`)
      sd.mantras.forEach((m, idx) => {
        const pulse = 1 + Math.sin(nowSec * 5 + idx) * 0.08;
        ctx.save();
        ctx.translate(m.x, m.y + Math.sin(nowSec * 3.2 + idx) * 5);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = "rgba(184, 38, 28, 0.88)";
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#ffe89e";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#fff6dc";
        ctx.font = "bold 22px 'Noto Serif SC', 'STKaiti', serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(m.ch, 0, 1);
        ctx.restore();
      });
      ctx.restore();
    }
    // V23 Celestial Phase Water Reflections (`星辉/血暮水面流光`) & Spatial Rift Cracks (`3秒太初裂空剑痕`)
    const celPhaseNow = getCurrentCelestialPhase();
    if ((celPhaseNow.id === "star_night" || celPhaseNow.id === "blood_dusk") && arena.waterPools && arena.waterPools.length) {
      for (const wp of arena.waterPools) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = celPhaseNow.waterCol;
        ctx.beginPath();
        ctx.ellipse(wp.x, wp.y, wp.r * 0.72, wp.r * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
        if (celPhaseNow.id === "star_night") {
          ctx.fillStyle = "#ffffff";
          for (let si = 0; si < 5; si++) {
            const sx = wp.x + Math.cos(nowSec * 1.3 + si * 1.4) * wp.r * 0.45;
            const sy = wp.y + Math.sin(nowSec * 1.7 + si * 2.1) * wp.r * 0.22;
            ctx.fillRect(sx, sy, 2.4, 2.4);
          }
        }
        ctx.restore();
      }
    }
    if (arena.spatialRifts && arena.spatialRifts.length) {
      for (const rf of arena.spatialRifts) {
        const x1 = rf.x - Math.cos(rf.ang) * (rf.len * 0.5), y1 = rf.y - Math.sin(rf.ang) * (rf.len * 0.5);
        const x2 = rf.x + Math.cos(rf.ang) * (rf.len * 0.5), y2 = rf.y + Math.sin(rf.ang) * (rf.len * 0.5);
        const alpha = Math.min(1, rf.life / 0.6);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(182, 118, 255, ${(0.85 * alpha).toFixed(2)})`;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo((x1 + x2) * 0.5 + Math.sin(nowSec * 24) * 7, (y1 + y2) * 0.5 - Math.cos(nowSec * 24) * 5);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.strokeStyle = `rgba(128, 255, 238, ${(0.95 * alpha).toFixed(2)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }
    }
    // V22 Qimen Dunjia Eight-Gates Fengshui Compass Array (`vfx_qimen_bagua_dial`)
    if (arena.qimenArray && arena.qimenArray.active) {
      const qa = arena.qimenArray;
      drawPointLight(qa.x, qa.y, qa.r * 1.15, "rgba(112, 255, 230, 0.24)");
      ctx.save();
      ctx.translate(qa.x, qa.y);
      ctx.scale(1, 0.58);
      ctx.globalCompositeOperation = "lighter";
      drawSprite("vfx_qimen_bagua_dial", 0, 0, qa.r * 2.08, false, false, 0.86, 1, 1, qa.rot);
      ctx.strokeStyle = qa.gate.color;
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.arc(0, 0, qa.r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      drawNameplatePill(qa.gate.name, qa.gate.sub, qa.x, qa.y + qa.r * 0.56 + 14, qa.gate.color, false);
    }
    // V21 Cloud-Sea High-Speed Parallax Streaks, Floating Ruin Pillars, Sky-Thunder Laser Nets & Giant Surf-Sword!
    if (arena.cloudFlight && arena.cloudFlight.active) {
      const cf = arena.cloudFlight;
      ctx.save();
      for (const cs of cf.cloudStreaks) {
        ctx.globalAlpha = cs.layer === 2 ? 0.58 : cs.layer === 1 ? 0.36 : 0.20;
        ctx.strokeStyle = cs.layer === 2 ? "#e2fff9" : cs.layer === 1 ? "#80ffea" : "#ffe28a";
        ctx.lineWidth = cs.layer === 2 ? 3.2 : 1.8;
        ctx.beginPath();
        ctx.moveTo(cs.x, cs.y);
        ctx.lineTo(cs.x + cs.len, cs.y);
        ctx.stroke();
      }
      // Sweeping Sky-Thunder Laser Nets (`天雷激光网`)
      ctx.globalCompositeOperation = "lighter";
      for (const ln of cf.laserNets) {
        ctx.strokeStyle = "#ff4d6d";
        ctx.lineWidth = 10;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(ln.x, ln.y - ln.hSpan * 0.5);
        ctx.lineTo(ln.x, ln.y + ln.hSpan * 0.5);
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ln.x, ln.y - ln.hSpan * 0.5);
        ctx.lineTo(ln.x, ln.y + ln.hSpan * 0.5);
        ctx.stroke();
      }
      // Giant Luminous Surf-Sword beneath Player (`御剑破云巨剑`) & Octagonal Taixu Deflect Shield!
      const p = arena.player;
      const sy = p.y - (p.z || 42) + 28;
      ctx.globalAlpha = 0.95;
      drawLuminousSword(p.x + 8, sy, 0, "jade", 2.55);
      if ((p.skyDeflectTimer || 0) > 0 || (p.barrelRollTimer || 0) > 0) {
        ctx.strokeStyle = "#80ffea";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(p.x + 12, p.y - (p.z || 42) - 6, 68, -1.25, 1.25);
        ctx.stroke();
        drawBaguaCircle(p.x, sy + 6, 62, "#70ffe6", nowSec * 8, 0.82, true);
      }
      ctx.restore();
    }
    // V20 Ravine Sword-Glide Golden-Jade Cable, Sect Defense Spirit Towers & Off-Hand Hovering Saw Chakrams!
    if (arena.ravineGlide) {
      const rg = arena.ravineGlide;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "#70ffe6";
      ctx.lineWidth = 4.5;
      ctx.setLineDash([12, 8]);
      ctx.beginPath();
      ctx.moveTo(rg.x0, rg.y0);
      ctx.quadraticCurveTo(rg.cx, rg.cy, rg.x1, rg.y1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    if (arena.sectDefense && arena.sectDefense.active) {
      const sd = arena.sectDefense;
      drawBaguaCircle(sd.coreX, sd.coreY + 26, 98, "#70ffe6", nowSec * 1.4, 0.75, true);
      for (const tw of sd.towers) {
        drawBaguaCircle(tw.x, tw.y + 22, 46, "#ffe28a", -nowSec * 2.2, 0.72, false);
        drawSprite("prop_guardian_sword_pylon", tw.x, tw.y - 18 + Math.sin(nowSec * 3.5) * 4, 112, false, false, 0.98);
        drawNameplatePill(tw.name, "自动诛妖剑雷", tw.x, tw.y - 84, "#80ffea", false);
      }
    }
    if (arena.hoverChakrams && arena.hoverChakrams.length) {
      for (const hc of arena.hoverChakrams) {
        drawPointLight(hc.x, hc.y, hc.r * 1.2, "rgba(185, 131, 255, 0.34)");
        ctx.save();
        ctx.translate(hc.x, hc.y);
        ctx.scale(1, 0.62);
        ctx.rotate(hc.rot);
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = hc.color;
        ctx.lineWidth = 6.5;
        ctx.beginPath(); ctx.arc(0, 0, hc.r * 0.78, 0, Math.PI * 2); ctx.stroke();
        for (let b = 0; b < 6; b++) {
          const ba = (b * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(Math.cos(ba) * hc.r * 0.55, Math.sin(ba) * hc.r * 0.55);
          ctx.lineTo(Math.cos(ba + 0.36) * hc.r * 1.04, Math.sin(ba + 0.36) * hc.r * 1.04);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    // 7b. AAA Boss Shockwave Rings, Cyan-Violet Low Ground Sweeps & Sweeping Laser Beams
    for (const gs of arena.groundSweeps) {
      const fade = Math.max(0, 1 - gs.r / gs.maxR);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(gs.x, gs.y);
      ctx.scale(1, 0.56);
      ctx.strokeStyle = "#38f9d7";
      ctx.globalAlpha = fade * 0.95;
      ctx.lineWidth = 7.5 * fade + 2.0;
      ctx.beginPath(); ctx.arc(0, 0, gs.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#b983ff";
      ctx.lineWidth = 3.2 * fade + 1.0;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(4, gs.r - 9), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    for (const bs of arena.blinkStreaks) {
      const bf = Math.max(0, 1 - bs.t);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = bs.color;
      ctx.globalAlpha = bf;
      ctx.lineWidth = 8 * bf + 1.5;
      ctx.beginPath(); ctx.moveTo(bs.x1, bs.y1); ctx.lineTo(bs.x2, bs.y2); ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.6 * bf;
      ctx.beginPath(); ctx.moveTo(bs.x1, bs.y1); ctx.lineTo(bs.x2, bs.y2); ctx.stroke();
      ctx.restore();
    }
    for (const sr of arena.shockRings) {
      const fade = Math.max(0, 1 - sr.r / sr.maxR);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = fade * 0.9;
      ctx.translate(sr.x, sr.y);
      ctx.scale(1, 0.56);
      ctx.strokeStyle = sr.color;
      ctx.shadowColor = sr.color;
      ctx.lineWidth = 5 * fade + 1.5;
      ctx.beginPath(); ctx.arc(0, 0, sr.r, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    for (const bm of arena.bossBeams) {
      ctx.save();
      ctx.translate(bm.x, bm.y);
      ctx.rotate(bm.t < 0 ? bm.startAng : bm.curAng);
      if (bm.t < 0) {
        ctx.strokeStyle = "rgba(255, 120, 110, 0.72)";
        ctx.setLineDash([10, 8]);
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bm.len, 0); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.globalCompositeOperation = "lighter";
        const lg = ctx.createLinearGradient(0, 0, bm.len, 0);
        lg.addColorStop(0, "#ffffff");
        lg.addColorStop(0.2, bm.color);
        lg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.strokeStyle = lg;
        ctx.shadowColor = bm.color;
        ctx.lineWidth = 14;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bm.len, 0); ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bm.len * 0.88, 0); ctx.stroke();
      }
      ctx.restore();
    }

    if (arena.tribulation) {
      for (const s of arena.tribulation.strikes) {
        drawBaguaCircle(s.x, s.y + 14, s.r, s.parried ? "#4ad2b8" : "#d69eff", nowSec * 3, 0.85, false);
        if (s.t < 1.0) {
          ctx.save();
          ctx.translate(s.x, s.y + 14);
          ctx.scale(1, 0.58);
          ctx.strokeStyle = "#fff5cc";
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(0, 0, s.r * (1 - s.t), 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
      }
    }

    for (const da of arena.deathAnims) drawSlicedDeathAnim(da);

    const curStance = SWORD_STANCES[arena.stanceIdx].id;
    const chargingVolley = pointer.down && pointer.worldActive && pointer.holdTime > 0.22;
    const stunnedBoss = arena.enemies.find(e => e.isBoss && e.state === "stun");
    const swordTint = (arena.comboCount >= 18 || (arena.player.zenStacks || 0) > 0) ? "gold" : arena.stageElement === "frost" ? "frost" : (arena.stageElement === "thunder" || hasLaw(game, "yinyang") || (game && game.school === "talisman")) ? "thunder" : "jade";

    const actors = [
      ...arena.props.map(pr => ({ kind: "prop", y: pr.y + 18, obj: pr })),
      ...arena.activeAllies.map(al => ({ kind: "ally", y: al.y, obj: al })),
      ...arena.enemies.map(e => ({ kind: "enemy", y: e.y, obj: e })),
      ...(game ? [{ kind: "player", y: arena.player.y, obj: arena.player }] : [])
    ].sort((a, b) => a.y - b.y);

    for (const ac of actors) {
      if (ac.kind === "prop") {
        const pr = ac.obj;
        const pDist = game ? Math.hypot(arena.player.x - pr.x, arena.player.y - pr.y) : 999;
        const showSub = pDist < 126 || pr.kind === "branch_portal" || pr.kind === "pedestal" || pr.kind === "map_node_gate" || pr.kind === "boon_stele";
        const accentCol = (pr.kind === "blood_altar" || pr.branch === "elite_loot") ? "#ff8780"
          : (pr.kind === "branch_portal" || pr.kind === "sanctum_portal" || pr.kind === "map_node_gate") ? "#70ffe6" : "#ffe89e";

        ctx.save();
        drawGroundedShadow(pr.x, pr.y + 24, pr.r * 0.96, pr.r * 0.44, 0.92);

        if (pr.kind === "branch_portal" || pr.kind === "portal" || pr.kind === "tower_next" || pr.kind === "sanctum_portal" || pr.kind === "map_node_gate") {
          const pArt = pr.portalArt || (pr.kind === "tower_next" ? "portal_crimson_sword" : "portal_golden_lantern");
          drawSprite(pArt, pr.x, pr.y - 26, 134);
          drawNameplatePill(pr.name, pr.badge, pr.x, pr.y - 96, accentCol, showSub);
        } else if (pr.kind === "ascend_gate") {
          drawSprite("heaven_gate", pr.x, pr.y - 34, 152);
          drawNameplatePill(pr.name, pr.badge || "点击/Enter 渡劫飞升", pr.x, pr.y - 112, "#ffe89e", true);
        } else if (pr.onLotus) {
          drawSprite("lotus_pedestal_shrine", pr.x, pr.y + 24, 82, false, false, 1.0, 1.0, 1.0, 0, true);
          const isFullActor = pr.art && pr.art.startsWith("actor_");
          const hover = rm ? 0 : (isFullActor ? Math.sin(nowSec * 2.4 + pr.x * 0.01) * 2.5 : Math.sin(nowSec * 3.2) * 4.5);
          drawSprite(pr.art, pr.x, pr.y - (isFullActor ? 26 : 14) + hover, isFullActor ? 108 : 54);
          drawNameplatePill(pr.bubble || pr.name, pr.badge, pr.x, pr.y - (isFullActor ? 84 : 58), accentCol, showSub || !!pr.bubble);
        } else if (pr.art && pr.art.startsWith("actor_")) {
          // F25 Grounded Living NPC: tight contact shadow, foot-anchored, subtle standing breath (oy = 0), gentle facing toward player within 260px
          const breath = rm ? 0 : Math.sin(nowSec * 2.2 + pr.x * 0.01) * 0.018;
          const npcFlip = game && pDist < 260 ? (arena.player.x < pr.x) : false;
          drawSprite(pr.art, pr.x, pr.y + 24, 108, npcFlip, false, 1.0, 1 - breath * 0.5, 1 + breath, 0, true);
          if (pr.kind === "npc_ward" && !pr.rescued) {
            ctx.strokeStyle = "rgba(112, 255, 230, 0.78)";
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.ellipse(pr.x, pr.y + 18, 48, 24, 0, 0, Math.PI * 2); ctx.stroke();
          }
          drawNameplatePill(pr.bubble || pr.name, pr.badge, pr.x, pr.y - 82, accentCol, showSub || !!pr.bubble);
        } else if (pr.destructible) {
          const pSize = pr.kind === "ward_pylon" ? 122 : pr.kind === "frost_crystal" ? 104 : 84;
          if (pr.kind === "ward_pylon") {
            const linkedBoss = arena.enemies.find(e => e.isBoss || e.isDummy);
            if (linkedBoss) {
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              ctx.strokeStyle = "rgba(255, 216, 110, 0.78)";
              ctx.lineWidth = 3.2;
              ctx.setLineDash([8, 6]);
              ctx.beginPath(); ctx.moveTo(pr.x, pr.y - 44); ctx.lineTo(linkedBoss.x, linkedBoss.y - 24); ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();
            }
          }
          drawSprite(pr.art, pr.x, pr.y - (pr.kind === "ward_pylon" ? 28 : 14), pSize, false, (pr.hitFlash || 0) > 0);
          if (pr.hitFlash > 0) pr.hitFlash = Math.max(0, pr.hitFlash - 0.016);
          // Destructible Prop HP Bar
          const pbw = 54, pbx = pr.x - pbw / 2, pby = pr.y - (pr.kind === "ward_pylon" ? 90 : 68);
          ctx.fillStyle = "rgba(4, 10, 14, 0.88)";
          ctx.fillRect(pbx - 1, pby - 1, pbw + 2, 6);
          ctx.fillStyle = pr.kind === "frost_crystal" ? "#80ecff" : pr.kind === "ward_pylon" ? "#ffd166" : "#ff9f43";
          ctx.fillRect(pbx, pby, pbw * Math.max(0, pr.hp / pr.maxHp), 4);
          drawNameplatePill(pr.name, pr.badge, pr.x, pby - 4, pr.kind === "ward_pylon" ? "#ffd166" : "#80ecff", pDist < 140 || pr.kind === "ward_pylon");
        } else {
          if (pr.art) drawSprite(pr.art, pr.x, pr.y - (pr.kind === "bounty_board" ? 20 : 6), pr.kind === "bounty_board" ? 116 : pr.kind === "cauldron" ? 86 : 66);
          const subTxt = (pr.kind === "cauldron" && game)
            ? ((game.inventory.herb || 0) >= 2 ? "灵草充足 · 点击或按 Enter 凝丹" : (pr.badge || `灵草 ${game.inventory.herb || 0}/2`))
            : pr.badge;
          drawNameplatePill(pr.bubble || pr.name, subTxt, pr.x, pr.y - 54, accentCol, showSub);
        }
        ctx.restore();
      } else if (ac.kind === "ally") {
        const al = ac.obj;
        ctx.save();
        drawGroundedShadow(al.x, al.y + 32, 30, 13, 0.90);
        drawBaguaCircle(al.x, al.y + 30, 36, al.color, -nowSec * 2.2, 0.72, false);
        drawPointLight(al.x, al.y - 6, 78, "rgba(112, 255, 230, 0.16)");
        drawSprite(al.art, al.x, al.y - 14 + Math.sin(nowSec * 5 + al.x) * 3, 102, al.facing < 0);
        drawNameplatePill(`${al.name} · 助阵`, `${Math.ceil(al.life)}s`, al.x, al.y - 72, al.color, false);
        ctx.restore();
      } else if (ac.kind === "enemy") {
        const e = ac.obj;
        ctx.save();
        drawGroundedShadow(e.x, e.y + e.r * 0.68, e.r * 0.96 * e.sx, e.r * 0.40, 0.95);

        if (e.enraged) {
          drawPointLight(e.x, e.y, e.r * 1.7, "rgba(255, 65, 55, 0.25)");
          drawBaguaCircle(e.x, e.y + e.r * 0.6, e.r * 1.08, "#ff5852", -nowSec * 2, 0.78, false);
        }
        if (e.chillTimer > 0) {
          ctx.strokeStyle = "rgba(128, 236, 255, 0.82)";
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.62, e.r * 0.92, e.r * 0.40, 0, 0, Math.PI * 2); ctx.stroke();
        }
        if (e.state === "stun") {
          drawBaguaCircle(e.x, e.y + 8, e.r + 16, "#ffe89e", nowSec * 4.5, 0.95, true);
          if (!e.executedThisStun) {
            ctx.save();
            ctx.translate(e.x, e.y - 12);
            ctx.rotate(nowSec * 3.2);
            ctx.strokeStyle = "#fff3b0";
            ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.stroke();
            for (let q = 0; q < 4; q++) {
              const qa = (q * Math.PI) / 2;
              ctx.beginPath();
              ctx.moveTo(Math.cos(qa) * 18, Math.sin(qa) * 18);
              ctx.lineTo(Math.cos(qa) * 32, Math.sin(qa) * 32);
              ctx.stroke();
            }
            ctx.restore();
          }
        }

        const liftZ = e.airborneZ || 0;
        // Hex-Chanter Violet-Crimson Buff Tether
        if (e.tacticalRole === "hex_chanter" && e.hexLinkTarget && arena.enemies.includes(e.hexLinkTarget)) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "rgba(226, 120, 255, 0.78)";
          ctx.lineWidth = 2.4;
          ctx.setLineDash([7, 5]);
          ctx.beginPath(); ctx.moveTo(e.x, e.y - 22); ctx.lineTo(e.hexLinkTarget.x, e.hexLinkTarget.y - 22); ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
        // M2 Flank Assassin Crimson Blink Telegraph Vector
        if (e.tacticalRole === "flank_assassin" && (e.flankTelegraph || 0) > 0) {
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = "rgba(255, 92, 108, 0.88)";
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 5]);
          ctx.beginPath(); ctx.moveTo(e.x, e.y - 14); ctx.lineTo(e.flankTargetX, e.flankTargetY - 14); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); ctx.ellipse(e.flankTargetX, e.flankTargetY + 12, 26, 12, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.restore();
        }
        if ((e.hexBuffTimer || 0) > 0) {
          drawBaguaCircle(e.x, e.y + e.r * 0.56, e.r * 0.98, "#d69eff", nowSec * 2.2, 0.52, false);
        }
        if (e.tacticalRole && !e.isBoss) {
          const rMap = { shield_vanguard: ["🛡 盾卫", "#ffe28a"], hex_chanter: ["🔮 妖师", "#e2b8ff"], flank_assassin: ["🗡 影袭", "#ff8787"] };
          const rm = rMap[e.tacticalRole];
          if (rm) {
            const roleLift = e.variantTag ? 17 : 0;
            ctx.save();
            ctx.font = "bold 10px sans-serif";
            ctx.textAlign = "center";
            ctx.fillStyle = "rgba(5, 13, 18, 0.84)";
            ctx.fillRect(e.x - 24, e.y - e.r - 44 - roleLift - liftZ, 48, 14);
            ctx.fillStyle = rm[1];
            ctx.fillText(rm[0], e.x, e.y - e.r - 33 - roleLift - liftZ);
            ctx.restore();
          }
        }

        if (e.isTitan) {
          // Colossal Half-Screen Dharma-Titan Aura & Sprite (`太古烛龙 · 魔神法相`)
          drawPointLight(e.x, e.y - 24, 290, "rgba(255, 168, 68, 0.38)");
          drawBaguaCircle(e.x, e.y + 56, 175, "#ffae33", nowSec * 0.9, 0.72, true);
          drawSprite("boss_zhulong_titan", e.x, e.y - 28 - liftZ, 385, false, e.hitFlash > 0, 1.0, e.sx, e.sy);
          // Render 3 Independently Lockable Body-Part Target Reticles!
          ["left_claw", "brow_eye", "right_halberd"].forEach(pk => {
            const pt = e.titanParts[pk];
            if (!pt || pt.broken) return;
            const wp = getTitanPartWorldPos(e, pk);
            const isLocked = arena.lockedTitanPart === pk;
            ctx.save();
            ctx.translate(wp.x, wp.y);
            ctx.strokeStyle = isLocked ? "#70ffe6" : (pk === "brow_eye" ? "#ffe28a" : "#ff9f43");
            ctx.lineWidth = isLocked ? 3.0 : 1.8;
            ctx.beginPath(); ctx.arc(0, 0, isLocked ? 26 : 20, 0, Math.PI * 2); ctx.stroke();
            if (isLocked) {
              ctx.font = "bold 10.5px sans-serif";
              ctx.fillStyle = "#70ffe6";
              ctx.textAlign = "center";
              ctx.fillText(`🎯 ${pt.name}`, 0, -30);
            }
            ctx.restore();
          });
          if ((e.laserSweepTimer || 0) > 0) {
            const eyePos = getTitanPartWorldPos(e, "brow_eye");
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.strokeStyle = "#ff5e57";
            ctx.lineWidth = 22;
            ctx.beginPath(); ctx.moveTo(eyePos.x, eyePos.y); ctx.lineTo(eyePos.x + Math.cos(e.laserAng) * 760, eyePos.y + Math.sin(e.laserAng) * 520); ctx.stroke();
            ctx.strokeStyle = "#fff6cc";
            ctx.lineWidth = 7;
            ctx.beginPath(); ctx.moveTo(eyePos.x, eyePos.y); ctx.lineTo(eyePos.x + Math.cos(e.laserAng) * 760, eyePos.y + Math.sin(e.laserAng) * 520); ctx.stroke();
            ctx.restore();
          }
        } else {
          if (e.variantColor && !e.isBoss && !e.isTreasure) {
            ctx.save();
            ctx.translate(e.x, e.y + 18);
            ctx.scale(1, 0.52);
            ctx.strokeStyle = e.variantColor;
            ctx.globalAlpha = 0.42 + Math.sin(nowSec * 4 + e.x * 0.02) * 0.14;
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(0, 0, e.r + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          const eFacing = e.facing !== undefined ? e.facing : (e.x > arena.player.x ? -1 : 1);
          const eFlip = eFacing < 0;
          const eSize = e.isBoss ? 132 : e.isTreasure ? 58 : 90;
          const eFootY = e.y + e.r * 0.68 - liftZ + ((e.id === "warden" || e.id === "sentinel" || e.id === "trial_gate") && e.state === "windup" ? -7 : 0);
          const eRot = (e.state === "recover" && (e.id === "warden" || e.id === "sentinel")) ? (eFacing * 0.08)
            : (e.state === "lunge" && (e.id === "wolf" || e.id === "shadow")) ? (eFacing * 0.10)
            : (e.state === "windup" && e.id === "serpent") ? (Math.sin(nowSec * 12) * 0.07)
            : (e.state === "windup" && e.id === "puppet") ? (-eFacing * 0.09) : 0;
          drawSprite(e.art, e.x, eFootY, eSize, eFlip, e.hitFlash > 0, 1.0, e.sx, e.sy, eRot, true);
          // Distinct readable windup & recovery cues across all Vol 1-6 archetypes
          if (e.state === "windup" && e.id === "wolf") {
            drawPointLight(e.x + eFacing * (e.isBoss ? 34 : 22), e.y - 16 - liftZ, e.isBoss ? 36 : 24, e.perilous ? "rgba(255, 82, 82, 0.72)" : "rgba(255, 226, 122, 0.68)");
          } else if (e.state === "windup" && (e.id === "warden" || e.id === "sentinel")) {
            drawPointLight(e.x, e.y - (e.isBoss ? 54 : 38) - liftZ, e.isBoss ? 52 : 34, e.id === "sentinel" ? "rgba(214, 158, 255, 0.62)" : "rgba(255, 184, 72, 0.58)");
          } else if (e.state === "windup" && e.id === "serpent") {
            drawPointLight(e.x + eFacing * 28, e.y - 24 - liftZ, e.isBoss ? 44 : 28, "rgba(112, 236, 255, 0.70)");
          } else if (e.state === "windup" && e.id === "puppet") {
            drawPointLight(e.x + eFacing * 20, e.y - 22 - liftZ, e.isBoss ? 42 : 28, e.mirrorTimer > 0 ? "rgba(255, 214, 102, 0.72)" : "rgba(255, 118, 118, 0.70)");
          } else if (e.state === "windup" && e.id === "trial_gate") {
            drawPointLight(e.x, e.y - 62 - liftZ, 58, "rgba(214, 158, 255, 0.74)");
          } else if (e.state === "windup" && e.id === "shadow") {
            drawPointLight(e.x + eFacing * 24, e.y - 18 - liftZ, 30, "rgba(186, 120, 255, 0.68)");
          } else if (e.state === "recover") {
            ctx.save();
            ctx.strokeStyle = "rgba(112, 255, 230, 0.68)";
            ctx.lineWidth = 1.6;
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.62, e.r * 0.85, e.r * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
          }
        }

        // Frontline Shield-Vanguard Directional Bronze-Jade Shield Arc
        if ((e.frontShieldHp || 0) > 0) {
          const sf = e.shieldFacing || 0;
          ctx.save();
          ctx.translate(e.x, e.y - 6 - liftZ);
          ctx.strokeStyle = "#ffcc66";
          ctx.lineWidth = 5.0;
          ctx.beginPath(); ctx.arc(0, 0, e.r + 10, sf - 1.15, sf + 1.15); ctx.stroke();
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.arc(0, 0, e.r + 13, sf - 0.85, sf + 0.85); ctx.stroke();
          ctx.restore();
        }

        // Inner Demon 8 Orbiting Mirror Flying Swords!
        if (e.isInnerDemon) {
          const dTint = e.demonPosture === "xuanzhong" ? "gold" : "thunder";
          for (let ms = 0; ms < 8; ms++) {
            const ma = (e.swordOrbitAng || 0) + (ms * Math.PI * 2) / 8;
            const mx = e.x + Math.cos(ma) * 74;
            const my = e.y - 14 + Math.sin(ma) * 42;
            drawLuminousSword(mx, my, ma + Math.PI / 2, dTint, 1.05);
          }
          if ((e.demonParryTimer || 0) > 0) {
            drawBaguaCircle(e.x, e.y + 8, e.r + 22, "#e2b8ff", -nowSec * 5, 0.9, false);
          }
        }

        // Boss Weakpoint Core Target Reticle (`◎ 本命妖丹 / 阵核弱点暴露`)
        if (e.isBoss && !e.partSevered && (e.partHp || 0) > 0 && (e.weakpointExposed || e.state === "windup" || e.state === "stun" || e.enraged)) {
          const wpCol = arena.weaponPosture === "xuanzhong" ? "#ff6b6b" : "#ffd166";
          ctx.save();
          ctx.translate(e.x, e.y - 26 - liftZ);
          ctx.rotate(-nowSec * 3.6);
          ctx.strokeStyle = wpCol;
          ctx.lineWidth = 2.2;
          ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-23, 0); ctx.lineTo(-11, 0);
          ctx.moveTo(11, 0);  ctx.lineTo(23, 0);
          ctx.moveTo(0, -23); ctx.lineTo(0, -11);
          ctx.moveTo(0, 11);  ctx.lineTo(0, 23);
          ctx.stroke();
          ctx.restore();
        }

        if ((e.wardHp || 0) > 0) {
          ctx.save();
          ctx.translate(e.x, e.y - 8);
          ctx.strokeStyle = "rgba(255, 224, 130, 0.88)";
          ctx.fillStyle = "rgba(255, 215, 100, 0.13)";
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          for (let hIdx = 0; hIdx < 6; hIdx++) {
            const ha = nowSec * 0.8 + (hIdx * Math.PI) / 3;
            const hx = Math.cos(ha) * (e.r + 12);
            const hy = Math.sin(ha) * (e.r + 6);
            if (hIdx === 0) ctx.moveTo(hx, hy);
            else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.fill(); ctx.stroke();
          ctx.restore();
        }

        if (e.mirrorTimer > 0) {
          const mFace = e.facing !== undefined ? e.facing : (e.x > arena.player.x ? -1 : 1);
          drawSprite("relic_cloud_mirror", e.x + (mFace < 0 ? -32 : 32), e.y - 12, 46, false, false, 0.92, 1, 1, nowSec * 5);
        }

        const marks = e.swordMarks || 0;
        for (let m = 0; m < marks; m++) {
          const ma = -0.9 + m * 0.36;
          drawLuminousSword(e.x + Math.cos(ma) * 20, e.y - 18 - m * 4, ma + Math.PI, "thunder", 0.85);
        }

        const bw = e.isBoss ? 98 : 60;
        const bx = e.x - bw / 2, by = e.y - (e.isBoss ? 84 : 58);
        const hasExtraBar = ((e.wardHp || 0) > 0 && e.maxWardHp > 0)
          || (e.isBoss && !e.partSevered && (e.maxPartHp || 0) > 0)
          || ((e.frontShieldHp || 0) > 0 && e.maxFrontShieldHp > 0);
        const bhTotal = hasExtraBar ? 15 : 11.5;
        ctx.fillStyle = "rgba(4, 11, 15, 0.86)";
        ctx.strokeStyle = e.isBoss ? "rgba(216, 179, 106, 0.65)" : "rgba(172, 208, 200, 0.34)";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(bx - 2, by - 2, bw + 4, bhTotal, 4);
        else ctx.rect(bx - 2, by - 2, bw + 4, bhTotal);
        ctx.fill();
        ctx.stroke();

        const hpRatio = Math.max(0, Math.min(1, e.hp / Math.max(1, e.maxHp)));
        ctx.fillStyle = e.isTreasure ? "#f0c858" : e.enraged ? "#e03e3e" : "#e55858";
        ctx.fillRect(bx, by, bw * hpRatio, 5);
        ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
        ctx.fillRect(bx, by, bw * hpRatio, 1.5);

        ctx.fillStyle = "#f2cf72";
        ctx.fillRect(bx, by + 6.5, bw * Math.max(0, Math.min(1, e.posture / Math.max(1, e.maxPosture))), 2.5);
        if ((e.wardHp || 0) > 0 && e.maxWardHp > 0) {
          ctx.fillStyle = "#80ecff";
          ctx.fillRect(bx, by + 10, bw * Math.max(0, e.wardHp / e.maxWardHp), 2.2);
        } else if (e.isBoss && !e.partSevered && (e.maxPartHp || 0) > 0) {
          ctx.fillStyle = "#ff78c4";
          ctx.fillRect(bx, by + 10, bw * Math.max(0, e.partHp / e.maxPartHp), 2.4);
        } else if ((e.frontShieldHp || 0) > 0 && e.maxFrontShieldHp > 0) {
          ctx.fillStyle = "#ffcc66";
          ctx.fillRect(bx, by + 10, bw * Math.max(0, e.frontShieldHp / e.maxFrontShieldHp), 2.4);
        }

        if (e.isTreasure) {
          ctx.font = "bold 11.5px sans-serif";
          ctx.fillStyle = "#ffe680";
          ctx.textAlign = "center";
          ctx.fillText(`聚宝金灵 (${Math.ceil(e.timer)}s)`, e.x, by - 6);
        } else if (e.mirrorTimer > 0) {
          ctx.font = "bold 11.5px sans-serif";
          ctx.fillStyle = "#ffe28a";
          ctx.textAlign = "center";
          ctx.fillText("镜反架势 · 一闪破镜", e.x, by - 6);
        } else if ((e.wardHp || 0) > 0) {
          ctx.font = "bold 11px sans-serif";
          ctx.fillStyle = "#ffe89e";
          ctx.textAlign = "center";
          ctx.fillText("护山金阵 · 重击破盾", e.x, by - 6);
        } else if (e.state === "windup") {
          const cb = a11ySettings.colorblindGlyphs;
          let wTxt = "✦ 金芒 · 空格识破", wCol = "#ffe680";
          if (e.grabWindup) { wTxt = cb ? "⬢【暗金·擒】重击拼刀" : "【擒】右键拼刀"; wCol = "#ffbe5c"; }
          else if (e.lowSweepWindup) { wTxt = cb ? "〰【青危·跃】按Z踏剑" : "【下危】Z 键踏剑"; wCol = "#38f9d7"; }
          else if (e.perilous) { wTxt = cb ? "▲【红危·闪】极限闪避" : "【危】空格闪避"; wCol = "#ff7890"; }
          else if (cb) { wTxt = "◆【金招·反】空格剑反"; wCol = "#fff3a8"; }
          ctx.font = "bold 11.5px sans-serif";
          ctx.textAlign = "center";
          const tw = ctx.measureText(wTxt).width + 14;
          ctx.fillStyle = "rgba(4, 10, 16, 0.88)";
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(e.x - tw / 2, by - 21, tw, 17, 5);
          else ctx.rect(e.x - tw / 2, by - 21, tw, 17);
          ctx.fill();
          ctx.strokeStyle = wCol;
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.fillStyle = wCol;
          ctx.fillText(wTxt, e.x, by - 8.5);
        } else if (e.state === "stun") {
          ctx.font = "bold 11.5px sans-serif";
          ctx.fillStyle = "#70ffe6";
          ctx.textAlign = "center";
          ctx.fillText("★ 破势绞杀！", e.x, by - 6);
        } else if (marks >= 3) {
          ctx.font = "bold 11px sans-serif";
          ctx.fillStyle = "#ffb86c";
          ctx.textAlign = "center";
          ctx.fillText(`剑印×${marks} 右键引爆`, e.x, by - 6);
        } else if (e.variantTag && !e.isBoss) {
          ctx.font = "600 10.5px sans-serif";
          ctx.fillStyle = e.variantColor || "#cdeae3";
          ctx.textAlign = "center";
          ctx.fillText(`${e.name} · ${e.variantTag}`, e.x, by - 6);
        }
        ctx.restore();
      } else {
        const p = ac.obj;
        if (!(curStance === "giant" && !chargingVolley && !stunnedBoss)) {
          for (const sw of arena.swords) {
            if (sw.state === "orbit" && (sw.zDepth ?? 1) < 0) {
              drawSingleFlyingSwordWithTrail(sw, swordTint, curStance === "ring", 0.74, 0.90);
            }
          }
        }
        drawPointLight(p.x, p.y - 6, p.meditating ? 125 : 85, p.meditating ? "rgba(255, 224, 130, 0.28)" : "rgba(74, 210, 184, 0.16)");

        if (hasLaw(game, "void_haste") && !p.meditating) {
          drawSprite("actor_player_battle", p.x - p.facing * 56, p.y + 6, 92, p.facing < 0, true, 0.45);
        }
        const activeHeroSpec = getActivePlayableSpec();
        for (const af of p.afterimages) {
          drawSprite(activeHeroSpec.sprite, af.x, af.y - 12, 98, af.facing < 0, true, af.a * 0.55);
        }

        const liftP = p.z || 0;
        const shadowScale = Math.max(0.45, 1 - liftP / 150);
        ctx.save();
        drawGroundedShadow(p.x, p.y + 34, 34 * shadowScale, 14 * shadowScale, 0.95 * shadowScale);
        if (liftP > 8) {
          ctx.strokeStyle = "rgba(128, 236, 255, 0.55)";
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(p.x, p.y + 30); ctx.lineTo(p.x, p.y - liftP + 16); ctx.stroke();
          ctx.setLineDash([]);
        }
        const fAura = (game.cosmetics && game.cosmetics.footAura) || "lotus_step";
        const ksAura = getKarmaState(game);
        const auraCol = ksAura.mode === "demonic" ? "#ff4d5e"
          : fAura === "bagua_array" ? "#ffe28a"
          : fAura === "star_ring" ? "#80ecff"
          : fAura === "crimson_eclipse" ? "#ff5263" : "#70ffe6";
        drawBaguaCircle(p.x, p.y + 34, 44, auraCol, nowSec * (fAura === "star_ring" ? -2.2 : 1.5), 0.66, fAura === "bagua_array");
        const swAuraId = (game.cosmetics && game.cosmetics.swordAura) || "azure_jade";
        if (swAuraId !== "azure_jade") {
          const swSpec = WARDROBE_OPTIONS.swordAura.find(o => o.id === swAuraId);
          if (swSpec) {
            drawBaguaCircle(p.x, p.y + 34, 58, swSpec.col, -nowSec * (swAuraId === "primordial_chaos" ? 2.4 : 1.6), 0.72, swAuraId === "primordial_chaos");
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            const moteCount = swAuraId === "golden_lotus" ? 8 : 6;
            for (let mk = 0; mk < moteCount; mk++) {
              const ma = nowSec * (swAuraId === "crimson_calamity" ? 2.8 : 1.9) + (mk * Math.PI * 2) / moteCount;
              const mx = p.x + Math.cos(ma) * 52;
              const my = p.y - 10 - liftP + Math.sin(ma) * 24;
              ctx.fillStyle = mk % 2 === 0 ? swSpec.col : swSpec.accent;
              ctx.globalAlpha = 0.78;
              ctx.beginPath();
              ctx.arc(mx, my, swAuraId === "primordial_chaos" ? 3.8 : 3.0, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }
        }
        const activeSet = getActiveSetBonus(game);
        if (activeSet && activeSet.aura && !p.meditating) {
          drawBaguaCircle(p.x, p.y + 34, 52, activeSet.aura, -nowSec * 1.2, 0.45, false);
        }

        if (p.meditating) {
          drawBaguaCircle(p.x, p.y + 28, 56, "#ffe28a", nowSec * 1.5, 0.88, true);
          ctx.save();
          ctx.translate(p.x, p.y + 24);
          ctx.scale(1, 0.56);
          drawSprite("ui_meditation_ink", 0, 0, 124, false, false, 0.72, 1, 1, -nowSec * 1.1);
          ctx.restore();

          for (const qs of arena.qiStreams) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.fillStyle = "#ffe694";
            ctx.beginPath(); ctx.arc(qs.x, qs.y, 3.6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          }
          const levY = rm ? 0 : Math.sin(nowSec * 4) * 5;
          drawSprite("char_player_seated", p.x, p.y - 20 + levY, 102, p.facing < 0, false);
        } else {
          ctx.strokeStyle = p.invuln > 0 ? "#8affea" : arena.weaponPosture === "xuanzhong" ? "#ffb84d" : SWORD_STANCES[arena.stanceIdx].color;
          ctx.lineWidth = p.invuln > 0 ? 3 : 1.9;
          ctx.beginPath(); ctx.ellipse(p.x, p.y + 34, 38, 16, 0, 0, Math.PI * 2); ctx.stroke();

          // V13 2.5D Isometric Destiny Compass Pointer (`脚底天命引路金针`)
          let navTarget = null;
          let navCol = "#ffe28a";
          const liveHostile = arena.enemies.find(e => !e.isTreasure);
          if (liveHostile) {
            navTarget = liveHostile;
            navCol = "#ffbe76";
          } else if (arena.sanctumMode) {
            const hasBounty = hasAnyClaimableGoalReward(game);
            navTarget = arena.props.find(pr => hasBounty ? pr.kind === "bounty_board" : pr.kind === "portal");
            navCol = hasBounty ? "#ffe28a" : "#70ffe6";
          } else {
            navTarget = arena.props.find(pr => ["pedestal", "branch_portal", "encounter_stele", "ascend_gate", "portal", "tower_next", "npc_ward"].includes(pr.kind));
            navCol = "#70ffe6";
          }
          if (navTarget && Math.hypot(navTarget.x - p.x, navTarget.y - p.y) > 78) {
            const navAng = Math.atan2((navTarget.y - (p.y + 30)) / 0.54, navTarget.x - p.x);
            const tipX = p.x + Math.cos(navAng) * 52;
            const tipY = p.y + 34 + Math.sin(navAng) * 26;
            const leftX = p.x + Math.cos(navAng - 0.24) * 40;
            const leftY = p.y + 34 + Math.sin(navAng - 0.24) * 20;
            const rightX = p.x + Math.cos(navAng + 0.24) * 40;
            const rightY = p.y + 34 + Math.sin(navAng + 0.24) * 20;
            ctx.save();
            ctx.fillStyle = navCol;
            ctx.shadowColor = navCol;
            ctx.beginPath();
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(leftX, leftY);
            ctx.lineTo(rightX, rightY);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }

          if (p.scarfPts.length > 2) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            for (let i = 1; i < p.scarfPts.length; i++) {
              const t = 1 - i / p.scarfPts.length;
              ctx.strokeStyle = (arena.comboCount >= 18 || (p.zenStacks || 0) > 0)
                ? `rgba(255, 218, 120, ${t * 0.72})`
                : `rgba(90, 235, 215, ${t * 0.58})`;
              ctx.lineWidth = 2 + t * 7.5;
              ctx.lineCap = "round";
              ctx.beginPath();
              ctx.moveTo(p.scarfPts[i - 1].x, p.scarfPts[i - 1].y);
              ctx.lineTo(p.scarfPts[i].x, p.scarfPts[i].y);
              ctx.stroke();
            }
            ctx.restore();
          }

          const bobY = Math.sin(p.bob) * 3.5;
          if (p.samadhiFireReady) drawPointLight(p.x, p.y - 14 - liftP, 78, "rgba(255, 132, 52, 0.36)");
          // V22 Mythic Mount (`踏云墨麒麟 / 九天青鸾凤 / 玄冥白泽兽`) beneath Rider!
          const onMount = !!(arena.mountState && arena.mountState.active);
          const mountOffset = onMount ? 22 : 0;
          if (onMount) {
            const mSpec = MYTHIC_MOUNTS[arena.mountState.mountId || "qilin"] || MYTHIC_MOUNTS.qilin;
            drawBaguaCircle(p.x, p.y + 34, 54, mSpec.color, nowSec * 3.2, 0.78, false);
            // mount_ink_qilin faces right natively; flip when p.facing < 0!
            drawSprite(mSpec.art, p.x, p.y + 6 - liftP + bobY * 0.6, 132, p.facing < 0, false, 0.98);
          }
          // V22 Ten-Zhang Astral Giant Dharma Avatar (`法天象地 · 十丈元神真身`) towering behind/around Hero!
          if (arena.astralForm && arena.astralForm.active) {
            const af = arena.astralForm;
            drawPointLight(p.x, p.y - 68 - liftP, 240, af.mode === "demonic" ? "rgba(255, 68, 92, 0.42)" : "rgba(255, 224, 130, 0.42)");
            drawBaguaCircle(p.x, p.y + 34, 96, af.color, -nowSec * 2.4, 0.88, true);
            drawSprite(af.art, p.x, p.y - 78 - liftP + bobY * 0.5, 256, p.facing < 0, false, 0.94);
          }
          const pPose = computePlayerVisualPose(p, nowSec);
          const pHitFlash = pPose.hitFlash || ((p.hyperArmorTimer || 0) > 0 && Math.floor(nowSec * 14) % 2 === 0);
          drawSprite(activeHeroSpec.sprite, p.x + pPose.ox, p.y + 34 - mountOffset - liftP + pPose.oy, 104, p.facing < 0, pHitFlash, 1.0, pPose.sx, pPose.sy, pPose.rot, true);

          // V24 Yuqing & Shangqing Tri-Clone Phantoms (`一气化三清 · 玉清青莲法身 & 上清紫电法身`)
          if (arena.sanqingState && arena.sanqingState.active) {
            const sq = arena.sanqingState;
            sq.clones.forEach((cl, idx) => {
              const cBob = Math.sin(nowSec * 5.8 + idx * 2.1) * 4;
              drawPointLight(cl.x, cl.y - 12, 86, idx === 0 ? "rgba(112, 255, 230, 0.34)" : "rgba(214, 158, 255, 0.36)");
              drawBaguaCircle(cl.x, cl.y + 30, 38, cl.color, nowSec * (idx === 0 ? 2.6 : -2.6), 0.72, false);
              // Radiant Qi tether linking Master & Dharma Clones
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              ctx.strokeStyle = idx === 0 ? "rgba(112, 255, 230, 0.45)" : "rgba(214, 158, 255, 0.45)";
              ctx.setLineDash([5, 5]);
              ctx.lineWidth = 1.8;
              ctx.beginPath(); ctx.moveTo(p.x, p.y - 16 - liftP); ctx.lineTo(cl.x, cl.y - 16); ctx.stroke();
              ctx.restore();
              drawSprite(cl.art, cl.x, cl.y - 14 + cBob, 102, cl.facing < 0, false, 0.88);
            });
          }

          // V24 Lingxiao Celestial Warship Orbital Flyover, Demon-Binding Chains & Main Crystal Beam (`听雨凌霄仙舟`)
          if (arena.warshipStrike && arena.warshipStrike.active) {
            const ws = arena.warshipStrike;
            // Golden Demon-Binding Chains (`镇妖锁链`) from Warship hull to targets!
            ctx.save();
            ctx.strokeStyle = "rgba(255, 222, 120, 0.86)";
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 5]);
            ws.chains.forEach(ce => {
              if (ce && ce.hp > 0) {
                ctx.beginPath();
                ctx.moveTo(ws.shipX + 20, ws.shipY + 42);
                ctx.lineTo(ce.x, ce.y - 12);
                ctx.stroke();
              }
            });
            ctx.setLineDash([]);
            // Primordial Crystal Orbital Beam (`太初灵晶主炮光柱`)
            if (ws.t >= 1.45 && ws.t <= 2.45) {
              const beamAlpha = Math.max(0, 1 - (ws.t - 1.45) / 1.0);
              ctx.globalCompositeOperation = "lighter";
              const bg = ctx.createLinearGradient(ws.targetX - 58, 0, ws.targetX + 58, 0);
              bg.addColorStop(0, "rgba(112, 255, 230, 0)");
              bg.addColorStop(0.5, `rgba(160, 255, 245, ${(0.92 * beamAlpha).toFixed(2)})`);
              bg.addColorStop(1, "rgba(112, 255, 230, 0)");
              ctx.fillStyle = bg;
              ctx.fillRect(ws.targetX - 58, 0, 116, ws.targetY + 24);
            }
            ctx.restore();
            drawPointLight(ws.shipX, ws.shipY, 210, "rgba(128, 255, 238, 0.38)");
            drawSprite("warship_lingxiao_ark", ws.shipX, ws.shipY, 245, false, false, 0.96);
          }

          // V23 Golden-Armored Pill Acolyte Guardian (`金甲丹童护法`)
          if (arena.pillAcolyte && arena.pillAcolyte.active) {
            const pa = arena.pillAcolyte;
            const paBob = Math.sin(nowSec * 6.2) * 5;
            drawPointLight(pa.x, pa.y, 68, "rgba(255, 212, 102, 0.34)");
            drawSprite("actor_golden_pill_acolyte", pa.x, pa.y + paBob, 78, pa.facing < 0, false, 0.98);
          }

          // V23 Local 2P Same-Screen Co-Op Partner + Twin-Heart Sword-Tether Cutting Beam (`同心剑网切割线`)
          if (arena.coop2P && arena.coop2P.active) {
            const c2 = arena.coop2P;
            const sp2 = PLAYABLE_COMPANIONS[c2.partnerId] || PLAYABLE_COMPANIONS.shen;
            const dist12 = Math.hypot(c2.x - p.x, c2.y - p.y);
            if (!c2.downed && dist12 >= 24 && dist12 <= 620) {
              const over = (c2.tetherOverchargeT || 0) > 0;
              ctx.save();
              ctx.globalCompositeOperation = "lighter";
              ctx.strokeStyle = over ? "rgba(255, 226, 138, 0.92)" : "rgba(112, 255, 230, 0.82)";
              ctx.lineWidth = over ? 5.5 : 3.4;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y - 18 - liftP);
              const mx = (p.x + c2.x) * 0.5 + Math.sin(nowSec * 18) * 8;
              const my = (p.y + c2.y) * 0.5 - 18 + Math.cos(nowSec * 18) * 6;
              ctx.quadraticCurveTo(mx, my, c2.x, c2.y - 18);
              ctx.stroke();
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 1.4;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y - 18 - liftP);
              ctx.lineTo(c2.x, c2.y - 18);
              ctx.stroke();
              ctx.restore();
            }
            for (const af2 of c2.afterimages) {
              drawSprite(sp2.sprite, af2.x, af2.y - 12, 94, af2.facing < 0, true, af2.a * 0.5);
            }
            drawBaguaCircle(c2.x, c2.y + 32, 40, sp2.color, -nowSec * 2.2, 0.72, false);
            drawSprite(sp2.sprite, c2.x, c2.y - 12 + Math.sin(c2.bob || 0) * 3.2, 98, c2.facing < 0, false, c2.downed ? 0.48 : 1.0);
            // 2P Overhead Player Badge & Independent HP Bar
            ctx.save();
            const bx2 = c2.x - 34, by2 = c2.y - 72;
            ctx.fillStyle = "rgba(6, 16, 22, 0.88)";
            ctx.fillRect(bx2, by2, 68, 7);
            ctx.fillStyle = c2.downed ? "#ff4d5e" : sp2.color;
            ctx.fillRect(bx2 + 1, by2 + 1, Math.max(0, 66 * (c2.hp / Math.max(1, c2.maxHp))), 5);
            ctx.font = "bold 11px sans-serif";
            ctx.fillStyle = "#ffe89e";
            ctx.textAlign = "center";
            ctx.fillText(c2.downed ? `2P·${sp2.name}(待救)` : `2P·${sp2.name}`, c2.x, by2 - 4);
            ctx.restore();
          }

          // V23 Celestial Ambient Overlay: Star-Night Fireflies & Warm Sanctuary Lanterns / Blood-Dusk Tint
          if (celPhaseNow.id === "star_night" || celPhaseNow.id === "blood_dusk") {
            ctx.save();
            ctx.fillStyle = celPhaseNow.ambientTint;
            ctx.fillRect(0, 0, w, h);
            // Sanctuary / Arena Ancient Warm Point-Light Lanterns (`古灯点光源`)
            drawPointLight(w * 0.22, h * 0.34, 155, "rgba(255, 184, 92, 0.26)");
            drawPointLight(w * 0.78, h * 0.34, 155, "rgba(255, 184, 92, 0.26)");
            ctx.globalCompositeOperation = "lighter";
            for (const ff of celestialState.fireflies) {
              const fx = w * ff.rx + Math.sin(nowSec * 1.4 + ff.seed) * 28;
              const fy = h * ff.ry + Math.cos(nowSec * 1.8 + ff.seed) * 18;
              const fa = 0.35 + 0.55 * Math.abs(Math.sin(nowSec * 2.6 + ff.seed));
              ctx.fillStyle = celPhaseNow.id === "star_night" ? `rgba(144, 255, 232, ${fa.toFixed(2)})` : `rgba(255, 148, 82, ${fa.toFixed(2)})`;
              ctx.beginPath(); ctx.arc(fx, fy, 2.6, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
          }
        }

        for (let z = 0; z < (p.zenStacks || 0); z++) {
          const za = nowSec * 3.5 + (z * Math.PI * 2) / 3;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.fillStyle = "#ffe694";
          ctx.shadowColor = "#ffe694";
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(za) * 28, p.y - 44 + Math.sin(za) * 8, 4.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        if ((p.shieldHp || 0) > 0 || game.pet.id === "turtle") {
          const shCol = (p.shieldHp || 0) > 0 ? "rgba(255, 226, 138, 0.82)" : "rgba(74, 210, 184, 0.68)";
          ctx.save();
          ctx.translate(p.x, p.y + 24);
          ctx.scale(1, 0.52);
          ctx.strokeStyle = shCol;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          for (let hi = 0; hi < 8; hi++) {
            const ha = nowSec * 1.1 + (hi * Math.PI) / 4;
            const hx = Math.cos(ha) * 48, hy = Math.sin(ha) * 48;
            if (hi === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        }

        if (game.pet.id && SPIRIT_PETS[game.pet.id]) {
          const sp = SPIRIT_PETS[game.pet.id];
          const pxPet = p.x - p.facing * 52;
          const pyPet = p.y - 16 + Math.cos(p.bob * 1.3) * 5;
          ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
          ctx.beginPath(); ctx.ellipse(pxPet, p.y + 28, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
          drawSprite(sp.art, pxPet, pyPet, 52, p.facing < 0, false);
        }
        ctx.restore();

        if (!(curStance === "giant" && !chargingVolley && !stunnedBoss)) {
          for (const sw of arena.swords) {
            if ((sw.zDepth ?? 1) >= 0 || sw.state !== "orbit") {
              drawSingleFlyingSwordWithTrail(sw, swordTint, curStance === "ring", 1.0, 1.04);
            }
          }
        }
      }
    }

    if (curStance === "giant" && !chargingVolley && !stunnedBoss && game) {
      drawColossalGreatsword(arena.giantSword);
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const ln of arena.lightnings) {
      ctx.globalAlpha = Math.max(0, 1 - ln.t);
      ctx.strokeStyle = ln.color;
      ctx.shadowColor = ln.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ln.x1, ln.y1);
      const mx = (ln.x1 + ln.x2) / 2 + (Math.random() - 0.5) * 26;
      const my = (ln.y1 + ln.y2) / 2 + (Math.random() - 0.5) * 26;
      ctx.lineTo(mx, my);
      ctx.lineTo(ln.x2, ln.y2);
      ctx.stroke();
    }
    ctx.restore();

    for (const pr of arena.projectiles) {
      // Dynamic Spell Floor Specular Point-Light Pool!
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = pr.color || "#70ffe6";
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y + 22, pr.r * 0.72, pr.r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(pr.x, pr.y);
      if (pr.kind === "chakram") {
        ctx.scale(1, 0.72);
        ctx.rotate(pr.spin || 0);
        ctx.globalCompositeOperation = "lighter";
        ctx.shadowColor = "#ffe28a";
        ctx.strokeStyle = "#ffe28a";
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.78, 0, Math.PI * 2); ctx.stroke();
        for (let b = 0; b < 4; b++) {
          ctx.save();
          ctx.rotate((b * Math.PI) / 2);
          ctx.fillStyle = b % 2 === 0 ? "#fff6cc" : "#70ffe6";
          ctx.beginPath();
          ctx.moveTo(pr.r * 0.25, -4);
          ctx.lineTo(pr.r * 0.96, 0);
          ctx.lineTo(pr.r * 0.25, 4);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      } else if (pr.kind === "crescent" || pr.kind === "twin_x") {
        ctx.rotate(pr.ang);
        ctx.shadowColor = pr.color;
        ctx.strokeStyle = pr.color;
        ctx.lineWidth = pr.kind === "twin_x" ? 6.5 : 5.5;
        ctx.beginPath(); ctx.arc(-12, 0, pr.r * 0.74, -0.88, 0.88); ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(-9, 0, pr.r * 0.74, -0.7, 0.7); ctx.stroke();
      } else {
        ctx.shadowColor = pr.color;
        ctx.fillStyle = pr.color;
        ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(0, 0, pr.r * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const sp of arena.sparks) {
      const a = Math.max(0, sp.life / sp.maxLife);
      ctx.globalAlpha = a;
      ctx.strokeStyle = sp.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y - sp.z);
      ctx.lineTo(sp.x - sp.vx * 1.4, sp.y - sp.z - sp.vy * 1.4 + sp.vz * 0.8);
      ctx.stroke();
    }
    ctx.restore();

    for (const sl of arena.slashes) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, 1 - sl.t);
      ctx.strokeStyle = sl.color;
      ctx.shadowColor = sl.color;
      if (sl.rain) {
        ctx.lineWidth = 5.2;
        ctx.beginPath();
        ctx.moveTo(sl.x - 10, sl.y - 195 * (1 - sl.t) - 60);
        ctx.lineTo(sl.x, sl.y);
        ctx.stroke();
        ctx.beginPath(); ctx.ellipse(sl.x, sl.y, sl.r * sl.t, sl.r * sl.t * 0.58, 0, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.translate(sl.x, sl.y);
        ctx.scale(1, 0.64);
        ctx.lineWidth = sl.heavy ? 7.5 : 4.2;
        ctx.beginPath();
        ctx.arc(0, 0, sl.r * (0.45 + sl.t * 0.65), sl.ang - 1.12, sl.ang + 1.12);
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = sl.heavy ? 2.6 : 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, sl.r * (0.45 + sl.t * 0.65), sl.ang - 0.85, sl.ang + 0.85);
        ctx.stroke();
      }
      ctx.restore();
    }

    // V20 Smooth Catmull-Rom Subdivided Ink-Silk Ribbon Slash Trails (`水墨丝绸流体刀光曲面细分`)
    for (const ba of arena.bladeArcs) {
      drawSmoothInkSilkRibbon(ctx, ba);
    }

    for (const sb of arena.skyBolts) {
      drawSkyLightningBolt(sb.x, sb.y, sb.t, sb.color);
    }
    // V19 Blade Clash Crossed Sword-Qi Sparks (`vfx_blade_clash_sparks`)
    if (arena.bladeClash) {
      const bc = arena.bladeClash;
      const pulse = 1.0 + Math.sin(nowSec * 32) * 0.12;
      drawPointLight(bc.midX, bc.midY - 12, 185, "rgba(255, 214, 112, 0.48)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawSprite("vfx_blade_clash_sparks", bc.midX, bc.midY - 14, 215 * pulse, false, false, 0.96, 1, 1, Math.sin(nowSec * 20) * 0.18);
      ctx.restore();
    }
    for (const cv of arena.clashVfxList) {
      const cf = Math.max(0, 1 - cv.t);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      drawSprite("vfx_blade_clash_sparks", cv.x, cv.y, cv.r * (1.4 + cv.t * 0.9), false, false, 0.92 * cf, 1, 1, cv.t * 2.2);
      ctx.restore();
    }
    // V17 Screen-Space Refractive Shockwave Distortion Rings (`刀光空间涟漪扭曲`)
    for (const dr of arena.distortionRings) {
      const fade = Math.max(0, 1 - dr.t);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(dr.x, dr.y);
      ctx.scale(1, 0.62);
      ctx.strokeStyle = dr.color;
      ctx.globalAlpha = fade * 0.78;
      ctx.lineWidth = 8.5 * fade + 1.5;
      ctx.beginPath(); ctx.arc(0, 0, dr.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.globalAlpha = fade * 0.65;
      ctx.lineWidth = 2.4 * fade + 0.6;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(4, dr.r - 7), 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    const stg = arena.sanctumMode ? STAGES[1] : arena.towerMode ? STAGES[3] : STAGES[arena.stageIdx];
    // AAA Multi-Biome Climate: Bamboo Rain + Puddle Ripples, Cold-Pond Blizzard, Cloud-Sea Plumes & Boss Domain Sky!
    const domWeather = arena.bossDomain ? arena.bossDomain.weather : null;
    if ((stg.particleKind === "rain_mist" || domWeather === "blood_rain") && !rm) {
      ctx.strokeStyle = domWeather === "blood_rain" ? "rgba(255, 110, 110, 0.30)" : "rgba(185, 230, 240, 0.26)";
      ctx.lineWidth = 1.15;
      const rainStep = degLvl >= 1 ? 2 : 1;
      for (let ri = 0; ri < rainDrops.length; ri += rainStep) {
        const r = rainDrops[ri];
        r.y += 0.014; r.x -= 0.0025;
        if (r.y > 1) {
          if (Math.random() < 0.08 && arena.ripples.length < 16) {
            addRipple(r.x * w, (0.35 + Math.random() * 0.45) * h, 16, domWeather === "blood_rain" ? "rgba(255,110,110,0.28)" : "rgba(165,235,245,0.24)");
          }
          r.y = 0; r.x = Math.random();
        }
        if (r.x < 0) r.x = 1;
        ctx.beginPath();
        ctx.moveTo(r.x * w, r.y * h);
        ctx.lineTo(r.x * w - 4, r.y * h + r.l);
        ctx.stroke();
      }
    } else if (((!arena.sanctumMode && arena.stageIdx === 2) || domWeather === "blizzard") && !rm) {
      ctx.fillStyle = "rgba(220, 250, 255, 0.55)";
      const snowCount = degLvl >= 1 ? 14 : 28;
      for (let sn = 0; sn < snowCount; sn++) {
        const sxN = ((sn * 0.137 + nowSec * (0.03 + (sn % 3) * 0.01)) % 1.0) * w;
        const syN = ((sn * 0.219 + nowSec * (0.055 + (sn % 4) * 0.012)) % 1.0) * h;
        ctx.beginPath();
        ctx.arc(sxN + Math.sin(nowSec * 2 + sn) * 12, syN, 1.6 + (sn % 3) * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Fast Stamp-Cached Parallax Cloud-Sea Mist Plumes (`云海流岚`)
    if (degLvl < 2) {
      const mistStamp = getGlowStamp(arena.sanctumMode ? "rgba(210, 245, 238, 0.10)" : "rgba(165, 220, 225, 0.075)");
      const mistT = rm ? 0 : nowSec;
      for (let cm = 0; cm < 3; cm++) {
        const mx = ((mistT * (18 + cm * 7) + cm * w * 0.42) % (w * 1.5)) - w * 0.25;
        const my = cm === 0 ? h * 0.90 : cm === 1 ? h * 0.12 : h * 0.84;
        const mr = w * 0.26;
        ctx.drawImage(mistStamp, mx - mr, my - mr * 0.5, mr * 2, mr);
      }
    }

    if (arena.bossDomain && arena.bossDomain.skyTint) {
      ctx.fillStyle = arena.bossDomain.skyTint;
      ctx.fillRect(0, 0, w, h);
    }
    if (arena.witchTime > 0) {
      ctx.fillStyle = "rgba(22, 85, 98, 0.18)";
      ctx.fillRect(0, 0, w, h);
    }
    if (!rm) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const moteStep = degLvl >= 2 ? 3 : degLvl >= 1 ? 2 : 1;
      for (let mi = 0; mi < arena.ambientMotes.length; mi += moteStep) {
        const m = arena.ambientMotes[mi];
        m.x += m.vx + Math.sin(nowSec + m.phase) * 0.0003;
        m.y += m.vy;
        if (m.y < 0) { m.y = 1; m.x = Math.random(); }
        if (m.x < 0) m.x = 1;
        if (m.x > 1) m.x = 0;
        const pulse = 0.35 + 0.35 * Math.sin(nowSec * 2.2 + m.phase);
        ctx.fillStyle = stg.particleKind === "lotus_glow"
          ? `rgba(110, 255, 230, ${pulse})`
          : stg.particleKind === "ghost_ember"
            ? `rgba(120, 255, 180, ${pulse})`
            : `rgba(255, 228, 150, ${pulse})`;
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // F25 Near Foreground Framing Silhouettes (drawn AFTER Y-sorted actors, strictly clamped to outer bottom 10-11% corners, BEFORE flushNameplates/floats so danger telegraphs & UI are NEVER occluded!)
    if (depthCache && depthCache.fg) {
      ctx.drawImage(depthCache.fg, visualLayersRuntime.fgOffsetX, visualLayersRuntime.fgOffsetY);
    }

    // Static vignette handled by zero-cost GPU #stage-vignette-css layer!

    if (game) {
      const stV = getCombatStats(game);
      if (game.hp > 0 && game.hp / stV.maxHp < 0.35) {
        const pulse = rm ? 0.18 : (0.16 + 0.10 * Math.sin(nowSec * 5.5));
        const lowG = ctx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.32, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
        lowG.addColorStop(0, "rgba(0,0,0,0)");
        lowG.addColorStop(1, `rgba(185, 24, 28, ${pulse.toFixed(3)})`);
        ctx.fillStyle = lowG;
        ctx.fillRect(0, 0, w, h);
      }
    }

    // V16 Soft-Lock Diamond Reticle & Optional 3A Hitbox/Hurtbox/I-Frame Wireframe Visualizer
    if (game && arena.softLockTarget && (arena.enemies.includes(arena.softLockTarget) || arena.props.includes(arena.softLockTarget))) {
      const lt = arena.softLockTarget;
      ctx.save();
      ctx.translate(lt.x, lt.y + 18);
      ctx.scale(1, 0.56);
      ctx.rotate(nowSec * 2.5);
      ctx.strokeStyle = "rgba(255, 230, 138, 0.85)";
      ctx.lineWidth = 2.0;
      const lr = (lt.r || 34) + 10;
      ctx.strokeRect(-lr * 0.72, -lr * 0.72, lr * 1.44, lr * 1.44);
      ctx.restore();
    }
    if (game && arena.showHitboxes) {
      const p = arena.player;
      ctx.save();
      // Player Hurtbox (Green) vs I-Frame Invulnerability Halo (Bright Cyan-White)
      ctx.strokeStyle = p.invuln > 0 ? "#70ffe6" : "#38ef7d";
      ctx.lineWidth = p.invuln > 0 ? 3.0 : 1.8;
      ctx.setLineDash(p.invuln > 0 ? [] : [5, 4]);
      ctx.beginPath(); ctx.arc(p.x, p.y - 6, 24, 0, Math.PI * 2); ctx.stroke();
      if (p.invuln > 0) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.arc(p.x, p.y - 6, 34, 0, Math.PI * 2); ctx.stroke();
        ctx.font = "bold 11px sans-serif";
        ctx.fillStyle = "#70ffe6";
        ctx.textAlign = "center";
        ctx.fillText(`I-FRAME 无敌帧 ${(p.invuln * 1000).toFixed(0)}ms`, p.x, p.y - 52);
      }
      // Enemy & Destructible Prop Hurtboxes
      ctx.setLineDash([4, 3]);
      arena.enemies.forEach(e => {
        ctx.strokeStyle = e.perilous ? "#ff4d4f" : "#52ffa8";
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(e.x, e.y - 6, e.r, 0, Math.PI * 2); ctx.stroke();
      });
      arena.props.forEach(pr => {
        if (pr.destructible) {
          ctx.strokeStyle = "#ffd166";
          ctx.beginPath(); ctx.arc(pr.x, pr.y - 10, pr.r, 0, Math.PI * 2); ctx.stroke();
        }
      });
      // Active Attack Hitboxes (Gold/Amber)
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(255, 190, 65, 0.9)";
      ctx.lineWidth = 1.8;
      arena.projectiles.forEach(pr => {
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r * 0.75, 0, Math.PI * 2); ctx.stroke();
      });
      arena.bladeArcs.forEach(ba => {
        ctx.beginPath(); ctx.arc(ba.x, ba.y, ba.r * 0.88, ba.ang - 1.05, ba.ang + 1.05); ctx.stroke();
      });
      ctx.restore();
    }

    flushNameplates();

    for (const f of arena.floats) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.alpha);
      const pop = f.isCrit && f.age < 0.14 ? (1.34 - (f.age / 0.14) * 0.34) : 1.0;
      ctx.translate(f.x, f.y);
      ctx.scale(pop, pop);
      ctx.font = `${f.isCrit || f.isBannerFloat ? "900" : "700"} ${f.size}px "Noto Serif CJK SC", "Songti SC", serif`;
      ctx.textAlign = "center";
      ctx.lineJoin = "round";
      if (f.isCrit || f.isBannerFloat) {
        ctx.shadowColor = f.isBannerFloat ? "rgba(0, 0, 0, 0.85)" : "rgba(255, 210, 90, 0.55)";
        ctx.shadowBlur = f.isBannerFloat ? 8 : 10;
      }
      ctx.lineWidth = f.isCrit ? 4.0 : 3.2;
      ctx.strokeStyle = "rgba(4, 10, 14, 0.94)";
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }

    if (!rm && arena.flash > 0.01) {
      ctx.fillStyle = arena.flashColor;
      ctx.globalAlpha = arena.flash;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();

    // V21 Zero-Overhead Radial Speed-Lines & Prismatic Chromatic Glint (`径向速度线冲击环与高光琉璃色散`)
    if (!rm && (arena.radialBurst || (arena.cloudFlight && arena.cloudFlight.active))) {
      const rb = arena.radialBurst;
      const fade = rb ? Math.max(0, 1 - rb.t) * rb.intensity : 0.34;
      const cx = rb ? rb.x : w * 0.35;
      const cy = rb ? rb.y : h * 0.50;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const lineCount = rb ? 32 : 16;
      const outerR = Math.max(w, h) * 0.78;
      for (let i = 0; i < lineCount; i++) {
        const a = (i * Math.PI * 2) / lineCount + nowSec * (rb ? 0.8 : 2.2);
        const inR = (rb ? 155 + (i % 4) * 38 + rb.t * 95 : 290 + (i % 3) * 55);
        // Chromatic RGB split needles (Cyan + Magenta + Accent)
        ctx.globalAlpha = fade * 0.55;
        ctx.strokeStyle = i % 3 === 0 ? "#ff3b7f" : i % 3 === 1 ? "#38f9d7" : (rb ? rb.accent : "#ffe28a");
        ctx.lineWidth = i % 4 === 0 ? 3.0 : 1.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * inR, cy + Math.sin(a) * inR);
        ctx.lineTo(cx + Math.cos(a) * outerR, cy + Math.sin(a) * outerR);
        ctx.stroke();
      }
      if (rb) {
        // Chromatic Glint Dispersion Twin Rings (Red-Cyan offset arcs)
        const ringR = 54 + rb.t * 285;
        ctx.lineWidth = 3.2 * fade;
        ctx.globalAlpha = fade * 0.72;
        ctx.strokeStyle = "#ff3b7f";
        ctx.beginPath(); ctx.arc(cx - 4, cy - 2, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = "#38f9d7";
        ctx.beginPath(); ctx.arc(cx + 4, cy + 2, ringR, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }

    // V18 2–3 Frame High-Contrast Black-White-Cinnabar Sumi-Ink Impact Frame (`朱砂水墨一闪定格帧`)!
    if ((!rm && (arena.impactFrames || 0) > 0) || (photoMode.active && photoMode.previewImpact)) {
      const ix = arena.impactX || (arena.player ? arena.player.x : w * 0.5);
      const iy = arena.impactY || (arena.player ? arena.player.y : h * 0.5);
      const invertPhase = !rm && (arena.impactFrames % 2 === 1) && !photoMode.previewImpact;
      ctx.save();
      ctx.fillStyle = invertPhase ? "rgba(248, 244, 234, 0.78)" : "rgba(6, 8, 12, 0.68)";
      ctx.fillRect(0, 0, w, h);

      // Authentic Tapered Sumi-Ink & Cinnabar Brush Wedges (`水墨飞白一闪`)
      ctx.translate(ix, iy);
      const maxSpan = Math.max(w, h) * 0.95;
      for (let s = 0; s < 36; s++) {
        const sa = (s * Math.PI * 2) / 36 + Math.sin(s * 3.7) * 0.035;
        const inner = 78 + (s % 5) * 26;
        const halfSpread = (s % 6 === 0 ? 0.032 : 0.014);
        ctx.fillStyle = s % 6 === 0 ? (arena.impactAccent || "#e62e2d") : (invertPhase ? "rgba(8, 10, 14, 0.92)" : "rgba(255, 249, 236, 0.88)");
        ctx.beginPath();
        ctx.moveTo(Math.cos(sa) * inner, Math.sin(sa) * inner);
        ctx.lineTo(Math.cos(sa - halfSpread) * maxSpan, Math.sin(sa - halfSpread) * maxSpan);
        ctx.lineTo(Math.cos(sa + halfSpread) * maxSpan, Math.sin(sa + halfSpread) * maxSpan);
        ctx.closePath();
        ctx.fill();
      }
      // Tapered Cinnabar-Crimson & Razor-White Brush Cleave (`朱砂断界一闪`)
      ctx.fillStyle = arena.impactAccent || "#e62e2d";
      ctx.beginPath();
      ctx.moveTo(-w * 0.52, h * 0.25);
      ctx.quadraticCurveTo(0, -14, w * 0.52, -h * 0.25);
      ctx.quadraticCurveTo(0, 14, -w * 0.52, h * 0.25);
      ctx.fill();
      ctx.fillStyle = "#fffdf5";
      ctx.beginPath();
      ctx.moveTo(-w * 0.46, h * 0.22);
      ctx.quadraticCurveTo(0, -4, w * 0.46, -h * 0.22);
      ctx.quadraticCurveTo(0, 4, -w * 0.46, h * 0.22);
      ctx.fill();
      ctx.restore();

      if (!arena.paused && arena.impactFrames > 0) arena.impactFrames -= 1;
    }

    // V18 Photo Studio Calligraphic Scroll Seal (`太虚绘卷印章题跋`, included in exported PNG!)
    if (photoMode.active && photoMode.showStamp && game) {
      ctx.save();
      ctx.fillStyle = "rgba(8, 18, 24, 0.72)";
      ctx.strokeStyle = "rgba(240, 206, 132, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.fillRect(w - 196, 24, 168, 64);
      ctx.strokeRect(w - 196, 24, 168, 64);
      ctx.fillStyle = "#b8292f";
      ctx.fillRect(w - 186, 34, 38, 44);
      ctx.fillStyle = "#fff6e5";
      ctx.font = 'bold 14px "Noto Serif CJK SC", serif';
      ctx.textAlign = "center";
      ctx.fillText("尘缘", w - 167, 53);
      ctx.fillText("绘卷", w - 167, 71);
      ctx.textAlign = "left";
      ctx.fillStyle = "#ffe89e";
      ctx.font = 'bold 14px "Noto Serif CJK SC", serif';
      ctx.fillText(`${game.name} · ${REALMS[game.realm].name}`, w - 140, 50);
      ctx.fillStyle = "#9ee8dc";
      ctx.font = "11px sans-serif";
      ctx.fillText(getKarmaState(game).label, w - 140, 70);
      ctx.restore();
    }
  }
