  // ==================== V18 FLAGSHIP SYSTEMS: IMPACT FRAMES, Z-AXIS AERIAL, KARMA DUALITY, IMMORTAL GOURD, WARDROBE & PHOTO MODE ====================
  const GOURD_SOAKS = {
    iron_lotus:      { id: "iron_lotus",      name: "金刚玉莲子", badge: "4秒霸体·48%减伤", desc: "饮用仙葫后凝结4秒金刚不坏霸体，霸体期间所受伤害降至 52%（减免 48%）并净化寒毒。" },
    samadhi_fire:    { id: "samadhi_fire",    name: "三昧真火枣", badge: "下记重劈真火爆燃", desc: "饮后为剑锋灌注三昧真火：下一记切手重击/六象特技伤害 ×1.55（+55%），或陨星坠地劈伤害 ×1.45（+45%）并灼烧地面！" },
    parry_brew:      { id: "parry_brew",      name: "剑魄寒梅酿", badge: "识破/踏剑自动回酿", desc: "每成功触发 2 次【识破剑反】或【踏剑借力】，自动在仙葫中凝回 1 缕灵酿！" },
    wind_feather:    { id: "wind_feather",    name: "青鸾御风羽", badge: "攻速+22%·刷缩地", desc: "饮后4.5秒身轻如燕（攻速 +22%、移速 +15%），并立即刷新【飞剑缩地瞬身】冷却！" },
    thunder_ginseng: { id: "thunder_ginseng", name: "紫霄雷灵参", badge: "瞬召三道紫雷感电", desc: "饮用瞬间引落 3 道九霄紫雷轰击周围妖群，并直接引爆灵泉水洼感电麻痹！" },
    crimson_vine:    { id: "crimson_vine",    name: "赤渊龙血藤", badge: "剑意+35%·暴击+18%", desc: "饮后沸腾剑元，立即暴涨 +35% 无上剑意并在5秒内提升 +18% 暴击率！" }
  };

  const WARDROBE_OPTIONS = {
    bladeSkin: [
      { id: "celadon",         name: "青霜古剑", desc: "清冽青玉剑脊 · 正统剑宗器型", col: "#4ad2b8" },
      { id: "gold_greatsword", name: "太阿金锋", desc: "皇道鎏金宽刃 · 煌煌天威", col: "#ffd166" },
      { id: "frost_crystal",   name: "玄冥冰魄", desc: "六棱寒晶透刃 · 凛冽霜芒", col: "#80ecff" },
      { id: "crimson_demon",   name: "赤渊血剑", desc: "劫煞暗红魔锋 · 凶戾破军", col: "#ff5263" }
    ],
    trailSkin: [
      { id: "ink_jade",        name: "青莲水墨", desc: "徽墨留白配青碧剑气", col: "#4ad2b8" },
      { id: "zixiao_thunder",  name: "紫霄雷纹", desc: "紫电银弧流光残影", col: "#d69eff" },
      { id: "taixu_prismatic", name: "太虚劫光", desc: "紫金青三色裂空虹彩", col: "#ffe28a" },
      { id: "crimson_flame",   name: "赤渊魔焰", desc: "黑红业火焚空刀光", col: "#ff4d5e" }
    ],
    footAura: [
      { id: "lotus_step",      name: "步步生莲", desc: "足底绽放青玉净世莲纹", col: "#70ffe6" },
      { id: "bagua_array",     name: "太极剑阵", desc: "足底流转鎏金八卦阵盘", col: "#ffe28a" },
      { id: "star_ring",       name: "周天星轨", desc: "足底环绕冰蓝星辰罗盘", col: "#80ecff" },
      { id: "crimson_eclipse", name: "血月劫环", desc: "足底萦绕赤渊劫煞魔环", col: "#ff5263" }
    ],
    swordAura: [
      { id: "azure_jade",       name: "青冥剑韵", req: "default",  unlockText: "初始可用",             desc: "青玉流云环身护剑，清冽灵动",               col: "#70ffe6", accent: "#c8fff5" },
      { id: "golden_lotus",     name: "九霄金莲", req: "asc_1",    unlockText: "飞升 1 世解锁",         desc: "【轮回幻化】九瓣鎏金莲光环身旋转，飞剑镀金流虹", col: "#ffe28a", accent: "#fff6cc" },
      { id: "crimson_calamity", name: "劫火赤渊", req: "calamity", unlockText: "劫火周目/魔心证道解锁", desc: "【轮回幻化】赤红劫焰缠绕剑脊与斩痕，煞气凌空", col: "#ff5768", accent: "#ffb399" },
      { id: "starlight_void",   name: "周天星河", req: "stars_8",  unlockText: "飞升 2 世/点亮 8 星宿", desc: "【轮回幻化】靛紫双环星轨曳动星尘，剑阵如银河", col: "#a892ff", accent: "#80ecff" },
      { id: "primordial_chaos", name: "混沌太初", req: "asc_3",    unlockText: "飞升 3 世/万剑冢 S 级", desc: "【至高幻化】紫金青三色太初道轮流转，裂空剑意", col: "#ff9eff", accent: "#ffe28a" }
    ]
  };

  const COMPANION_KEEPSAKES = {
    shen: { keepsake: "青莲药王佩", tierTitles: ["未识", "一阶·破庙萍水", "二阶·药庐同心", "三阶·生死道侣"], bonusDesc: "仙葫恢复量 +25%，饮酒额外张开清莲护盾", rightQuote: "清禾温声道：『道友澄心守正，这枚药王佩便系在君侧护脉吧。』", demonQuote: "清禾轻叹蹙眉：『纵你身染劫煞，清禾这一炉回春汤也永远为你留着。』" },
    pei:  { keepsake: "惊鸿断岳穗", tierTitles: ["未识", "一阶·山门论剑", "二阶·并肩斩蛟", "三阶·生死剑友"], bonusDesc: "升龙空连与陨星坠地劈暴击伤害 +38%", rightQuote: "裴照朗声拊掌：『好一派浩然太清剑意，当浮一大白！』", demonQuote: "裴照按剑凝眸：『好烈的血煞锋芒！若有一日入魔失控，裴某替你试剑醒神！』" },
    lu:   { keepsake: "紫微镇山印", tierTitles: ["未识", "一阶·山门引路", "二阶·薪火相传", "三阶·忘年护道"], bonusDesc: "踏剑借力与识破剑反额外恢复 +22% 无上剑意", rightQuote: "陆玄松抚须欣慰：『太清镇世，青云宗千年未有此气象！』", demonQuote: "陆玄松正色叮嘱：『以煞驭剑虽猛，切莫反为剑奴，老夫为你镇守灵台！』" },
    yan:  { keepsake: "照影太虚镜", tierTitles: ["未识", "一阶·残碑问名", "二阶·古镜照心", "三阶·忘机道友"], bonusDesc: "太虚凝时延长 +0.45秒，弱点碎核伤害 +30%", rightQuote: "砚尘拂碑含笑：『心如明镜无尘埃，天门道影亦奈何不得你。』", demonQuote: "砚尘静望古镜：『正邪一念间，能执劫火而不迷本真，亦是大自在。』" }
  };

  const LEGACY_KARMA_DILEMMA_IDS = ["kd_cultivator", "kd_demon_blade", "kd_spirit_spring"];

  const KARMA_DILEMMAS = [
    {
      id: "kd_rain_shrine",
      chapter: 1,
      title: "红尘问心 · 《山雨破庙孤灯》",
      desc: "山雨夜荒庙外，一名负伤药农怀抱灵草囊求你庇护，身后三名黑衣散修正提刀追至。你当如何决断？",
      rightOpt: { label: "☯ 拔剑护民 · 舍回春真气救下药农", detail: "清虚正道 +25 · 气血上限+16 · 获 45 灵石 · 沈清禾羁绊提升", karma: 25, hpBonus: 16, stones: 45, bond: "shen" },
      demonOpt: { label: "🔥 坐山观虎 · 待两败俱伤尽收灵囊", detail: "劫煞魔心 -25 · 剑道攻击+8 · 获 75 灵石 · 裴照羁绊提升", karma: -25, atkBonus: 8, stones: 75, bond: "pei" }
    },
    {
      id: "kd_outer_levy",
      chapter: 2,
      title: "红尘问心 · 《外门灵田苛税》",
      desc: "青云外门灵田畔，管事执役借宗门名义私扣新弟子凝气草，见你剑气不凡便欲分润半数封口。",
      rightOpt: { label: "☯ 秉公执剑 · 揭发私扣还草于同门", detail: "清虚正道 +25 · 常驻减伤+3 · 获 80 灵石 · 陆玄松羁绊提升", karma: 25, drBonus: 3, stones: 80, bond: "lu" },
      demonOpt: { label: "🔥 强夺灵税 · 威慑管事尽取私藏灵石", detail: "劫煞魔心 -25 · 剑道攻击+10 · 获 130 灵石 · 裴照羁绊提升", karma: -25, atkBonus: 10, stones: 130, bond: "pei" }
    },
    {
      id: "kd_spirit_spring",
      chapter: 3,
      title: "红尘问心 · 《灵泉怨魂阵眼》",
      desc: "寒潭古阵中困着百缕山民残魂与千年妖煞，破阵之法唯在净度与血炼之间。",
      rightOpt: { label: "☯ 九莲净度 · 布太清法阵超度残魂归乡", detail: "清虚正道 +40 · 气血全满且上限+38 · 获仙品护身宝衣", karma: 40, hpBonus: 38, gearSlot: "armor", bond: "shen" },
      demonOpt: { label: "🔥 万煞归炉 · 聚千年妖煞铸无双凶兵", detail: "劫煞魔心 -40 · 剑道攻击+20 · 获仙品杀伐佩剑", karma: -40, atkBonus: 20, gearSlot: "weapon", bond: "pei" }
    },
    {
      id: "kd_frost_merchant",
      chapter: 3,
      title: "红尘问心 · 《寒潭冻商遗玉》",
      desc: "照影寒潭冰崖下，一名采玉商旅被寒雾封脉、命悬一线，脚畔散落着数枚极品地脉灵玉与乾坤戒。",
      rightOpt: { label: "☯ 破冰救人 · 运剑气驱寒护其脱险", detail: "清虚正道 +30 · 气血上限+24 · 获 110 灵石 · 陆玄松羁绊提升", karma: 30, hpBonus: 24, stones: 110, bond: "lu" },
      demonOpt: { label: "🔥 截玉炼锋 · 取走灵戒任寒雾吞没残生", detail: "劫煞魔心 -30 · 剑道攻击+12 · 获仙品乾坤灵佩 · 砚尘羁绊提升", karma: -30, atkBonus: 12, gearSlot: "ring", bond: "yan" }
    },
    {
      id: "kd_cultivator",
      chapter: 4,
      title: "红尘问心 · 《古道走火散修》",
      desc: "秘境断崖边一名金丹散修经脉逆乱、元神将溃，身畔悬浮一枚狂暴血丹。你当如何决断？",
      rightOpt: { label: "☯ 太清渡厄 · 耗灵力为其抚平经脉", detail: "清虚正道 +35 · 气血上限+32 · 仙葫上限+1缕 · 沈清禾羁绊提升", karma: 35, hpBonus: 32, gourdMax: 1, bond: "shen" },
      demonOpt: { label: "🔥 吞魂炼煞 · 夺取血丹淬入本命飞剑", detail: "劫煞魔心 -35 · 剑道攻击+16 · 环身飞剑永久+1 · 激活血煞锋芒", karma: -35, atkBonus: 16, swordBonus: 1, bond: "pei" }
    },
    {
      id: "kd_demon_blade",
      chapter: 4,
      title: "红尘问心 · 《古冢泣血魔剑》",
      desc: "残碑之下镇压着一柄饮尽万妖精血的古魔残剑，剑灵哀鸣求你解封共赴杀劫。",
      rightOpt: { label: "☯ 净世镇封 · 化去戾气凝为护身莲华", detail: "清虚正道 +35 · 常驻减伤+6 · 获 120 灵石 · 陆玄松羁绊提升", karma: 35, drBonus: 6, stones: 120, bond: "lu" },
      demonOpt: { label: "🔥 炼煞入鞘 · 引滔天凶煞融于双剑架势", detail: "劫煞魔心 -35 · 剑道攻击+18 · 无上剑意蓄满100% · 砚尘羁绊提升", karma: -35, atkBonus: 18, fillIntent: true, bond: "yan" }
    },
    {
      id: "kd_mirror_echo",
      chapter: 5,
      title: "红尘问心 · 《心魔残碑问名》",
      desc: "元神初成之际，一块沾染天门残影的古碑映出你昔日最深的执念幻象，诱你吞噬残魂换取瞬息神通。",
      rightOpt: { label: "☯ 照见本真 · 斩碎虚妄守住清明元神", detail: "清虚正道 +35 · 气血上限+36 · 常驻减伤+5 · 砚尘羁绊提升", karma: 35, hpBonus: 36, drBonus: 5, bond: "yan" },
      demonOpt: { label: "🔥 吞噬心魔 · 将残碑执念炼为血煞剑意", detail: "劫煞魔心 -35 · 剑道攻击+18 · 无上剑意蓄满100% · 裴照羁绊提升", karma: -35, atkBonus: 18, fillIntent: true, bond: "pei" }
    },
    {
      id: "kd_plague_cauldron",
      chapter: 5,
      title: "红尘问心 · 《瘴岭血鼎济世》",
      desc: "荒岭古鼎正汲取百村毒瘴炼制血煞灵丹，若毁鼎散药可救苍生，若趁机封鼎炼化则煞威大涨。",
      rightOpt: { label: "☯ 倾炉散药 · 化毒瘴为清露润泽百村", detail: "清虚正道 +35 · 气血上限+40 · 仙葫上限+1缕 · 沈清禾羁绊提升", karma: 35, hpBonus: 40, gourdMax: 1, bond: "shen" },
      demonOpt: { label: "🔥 炼瘴凝煞 · 尽收血鼎毒火淬炼剑骨", detail: "劫煞魔心 -35 · 剑道攻击+20 · 获 180 灵石 · 陆玄松羁绊提升", karma: -35, atkBonus: 20, stones: 180, bond: "lu" }
    },
    {
      id: "kd_heaven_tribute",
      chapter: 6,
      title: "红尘问心 · 《天门香火断念》",
      desc: "临近九霄天门，云海浮现人间万家香火愿力。天门古音低语：焚断凡尘牵挂，可获无垢极道之力。",
      rightOpt: { label: "☯ 护持凡火 · 携红尘众念共叩九霄天门", detail: "清虚正道 +40 · 气血上限+44 · 常驻减伤+6 · 砚尘羁绊提升", karma: 40, hpBonus: 44, drBonus: 6, bond: "yan" },
      demonOpt: { label: "🔥 焚尽凡尘 · 断绝牵挂凝万古极道杀剑", detail: "劫煞魔心 -40 · 剑道攻击+22 · 无上剑意蓄满100% · 裴照羁绊提升", karma: -40, atkBonus: 22, fillIntent: true, bond: "pei" }
    }
  ];

  const photoMode = {
    active: false,
    zoom: 1.15,
    panX: 0,
    panY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    filter: "none",       // 'none' | 'ink' | 'thunder' | 'ember'
    showStamp: true,
    previewImpact: false,
    uiHidden: false,
    lastExportBytes: 0,
    exportCount: 0
  };


  function getCompanionBondTier(g, npcId) {
    if (!g) return 0;
    const raw = (g.bondTiers && g.bondTiers[npcId]) || 0;
    const aids = g.aids || {};
    const baseAid = (npcId === "shen" && (g.openingChoice === "help" || aids.shen)) || aids[npcId] || Object.keys(g.choices || {}).some(k => k.startsWith(npcId));
    return Math.min(3, Math.max(raw, baseAid ? 1 : 0));
  }

  function hasKeepsake(g, npcId) {
    return getCompanionBondTier(g, npcId) >= 3;
  }

  function triggerImpactFrame(frames = 3, accent = "#e62e2d", fx = null, fy = null) {
    if (isReducedMotionActive()) return;
    arena.impactFrames = Math.max(arena.impactFrames || 0, frames);
    arena.impactAccent = accent;
    arena.impactX = fx !== null ? fx : (arena.player ? arena.player.x : 720);
    arena.impactY = fy !== null ? fy : (arena.player ? arena.player.y - (arena.player.z || 0) : 450);
  }

  function syncKarmaHudPill() {
    const pill = document.getElementById("karma-hud-pill");
    const titleEl = document.getElementById("karma-hud-title");
    const icoEl = document.getElementById("karma-hud-icon");
    if (!pill || !titleEl || !game) return;
    const ks = getKarmaState(game);
    const kp = getKarmaDilemmaProgress(game);
    pill.classList.toggle("karma-righteous", ks.mode === "righteous");
    pill.classList.toggle("karma-demonic", ks.mode === "demonic");
    if (icoEl) icoEl.textContent = ks.mode === "demonic" ? "🔥" : ks.mode === "righteous" ? "☯" : "✦";
    titleEl.textContent = ks.mode === "neutral" ? ks.label : `${ks.label} · ${ks.artName}`;
    const tipSub = kp.allExhausted
      ? `六卷因果劫数已尽（${kp.doneCount}/${kp.totalCount}），道心已定！`
      : kp.chapterExhausted
        ? `本卷因果已了（${kp.doneCount}/${kp.totalCount}），突破至第${kp.nextChapterUnlock}卷后再遇新劫！`
        : `当前第${kp.currentChapter}卷尚余 ${kp.eligibleCount} 段红尘问心（总进度 ${kp.doneCount}/${kp.totalCount}），点击展开抉择！`;
    pill.setAttribute("data-tip", escTip(`清虚正道 ↔ 劫煞魔心 (${ks.artName})`, tipSub));
  }

  // Active Z-Axis Sky Jump (`御风腾跃`) + Vault Counter (`踏剑借力`)!
  function triggerSkyJump() {
    if (!game || arena.paused) return;
    if (arena.mountState && arena.mountState.active) {
      triggerVaultDismountStrike();
      return;
    }
    const p = arena.player;
    if ((p.z || 0) > 18 || (p.jumpCd || 0) > 0) return;
    if (p.meditating) toggleMeditation(false);
    p.jumpCd = 0.52;
    p.z = Math.max(p.z || 0, 8);
    p.vz = 12.6;
    p.airComboStep = 0;
    p.plunging = false;
    Sound.skyLeapWhoosh();
    addRipple(p.x, p.y + 30, 52, "#70ffe6");

    // Check if Vaulting over an active or imminent Cyan-Violet Low Ground Sweep (`踏剑借力 Vault Counter`)!
    const st = getCombatStats(game);
    let vaultedEnemy = null;
    for (const gs of arena.groundSweeps) {
      const ellDist = Math.hypot(p.x - gs.x, (p.y - gs.y) / 0.56);
      if (!gs.vaulted && Math.abs(ellDist - gs.r) < 74) {
        gs.vaulted = true;
        vaultedEnemy = gs.owner || arena.enemies[0] || null;
        break;
      }
    }
    if (!vaultedEnemy) {
      vaultedEnemy = arena.enemies.find(e => e.hp > 0 && e.lowSweepWindup && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 175) || null;
    }

    if (vaultedEnemy) {
      p.vz = 14.4;
      p.z = 36;
      p.invuln = Math.max(p.invuln, 0.68);
      p.vaultPrimed = true;
      arena.parryCount = (arena.parryCount || 0) + 1;
      if (arena.encounterTelemetry) arena.encounterTelemetry.parryCount += 1;
      arena.stageTechDone = true;
      if (!isPracticeModeActive() && !isSanctumDojoActive() && game.goalStats) game.goalStats.techBreaks = (game.goalStats.techBreaks || 0) + 1;
      const luBonus = hasKeepsake(game, "lu") ? 22 : 0;
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 28 + luBonus);
      if (hasKeepsake(game, "lu")) p.shieldHp = Math.max(p.shieldHp || 0, Math.round(st.maxHp * 0.15));
      onParryOrVaultSuccess();

      Sound.vaultStompClang();
      GamepadSystem.rumble(0.92, 0.78, 175);
      triggerImpactFrame(3, "#38f9d7", vaultedEnemy.x, vaultedEnemy.y - 28);
      spawnDistortionRing(vaultedEnemy.x, vaultedEnemy.y, 215, "#38f9d7");
      registerStyleAction("vault", 150);
      pushTelemetryInput("🌊踏剑借力!", false);
      addFloat("🌊 踏剑借力 · 凌霄踩头破势！！", p.x, p.y - 84, "#70ffe6", 23, true);

      vaultedEnemy.lowSweepWindup = false;
      vaultedEnemy.flinchTimer = 0.45;
      vaultedEnemy.swordMarks = Math.min(6, (vaultedEnemy.swordMarks || 0) + 3);
      damageEnemy(vaultedEnemy, Math.round(st.atk * 2.95), true, 66, Math.atan2(vaultedEnemy.y - p.y, vaultedEnemy.x - p.x), 8, true);
      if (getKarmaState(game).mode === "demonic") {
        game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.08));
      }
    } else {
      pushTelemetryInput("🕊御风腾跃", false);
      addFloat("🕊 御风腾跃 · 凌空剑势", p.x, p.y - 62, "#80ecff", 16, true);
    }
    updateHud();
  }

  // Spirit-Sword Grapple Blink (`飞剑索敌 · 缩地瞬身` via `F` / Middle-Click)!
  function triggerSwordBlink() {
    if (game) {
      const colT = arena.enemies.find(e => e.isTitan && e.titanCollapsed && !e.climbExecuted && e.hp > 0);
      if (colT) { triggerTitanClimbFinisher(colT); return; }
      const nearZip = arena.props.find(pr => pr.kind === "ravine_zipline" && Math.hypot(pr.x - arena.player.x, pr.y - arena.player.y) < 170);
      if (nearZip && !arena.ravineGlide) { triggerSwordGlideRavineDash(nearZip); return; }
    }
    if (!game || arena.paused) return;
    const p = arena.player;
    if ((p.blinkCd || 0) > 0) return;
    if (p.meditating) toggleMeditation(false);
    p.blinkCd = (p.gourdHasteTimer || 0) > 0 ? 0.9 : 2.1;
    const st = getCombatStats(game);
    const canvas = document.getElementById("fx-canvas");
    const w = canvas.width || 1440, h = canvas.height || 900;

    // Prioritize airborne enemy -> nearest hostile -> destructible pylon/crystal -> cursor direction
    let bestTgt = arena.enemies.find(e => e.hp > 0 && (e.airborneZ || 0) > 10 && Math.hypot(e.x - p.x, e.y - p.y) < 490);
    if (!bestTgt) {
      let bestD = 490;
      for (const e of arena.enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (e.hp > 0 && d < bestD) { bestD = d; bestTgt = e; }
      }
    }
    if (!bestTgt) {
      bestTgt = arena.props.find(pr => pr.destructible && pr.hp > 0 && Math.hypot(pr.x - p.x, pr.y - p.y) < 460) || null;
    }

    const startX = p.x, startY = p.y - (p.z || 0);
    let destX, destY, ang;
    if (bestTgt) {
      ang = Math.atan2(bestTgt.y - p.y, bestTgt.x - p.x);
      const land = clampToPlaza(bestTgt.x - Math.cos(ang) * 42, bestTgt.y - Math.sin(ang) * 26, w, h);
      destX = land.x; destY = land.y;
      if ((bestTgt.airborneZ || 0) > 8) {
        p.z = Math.max(p.z || 0, bestTgt.airborneZ + 8);
        p.vz = Math.max(p.vz || 0, 5.5);
      }
    } else {
      ang = Math.atan2(pointer.y - p.y, pointer.x - p.x);
      const land = clampToPlaza(p.x + Math.cos(ang) * 210, p.y + Math.sin(ang) * 135, w, h);
      destX = land.x; destY = land.y;
    }

    p.afterimages.push({ x: p.x, y: p.y - (p.z || 0), facing: p.facing, a: 0.92 });
    p.x = destX; p.y = destY;
    p.facing = Math.cos(ang) >= 0 ? 1 : -1;
    p.invuln = Math.max(p.invuln, 0.34);
    p.comboWindow = 1.25;
    arena.blinkStreaks.push({ x1: startX, y1: startY, x2: p.x, y2: p.y - (p.z || 0), t: 0, color: getKarmaState(game).mode === "demonic" ? "#ff5263" : "#70ffe6" });
    Sound.spatialSwordHum(destX);
    Sound.skyLeapWhoosh();
    Sound.slash(true, 1);
    GamepadSystem.rumble(0.45, 0.30, 75);
    registerStyleAction("blink", 75);
    pushTelemetryInput("⚡缩地剑步", false);

    if (bestTgt && bestTgt.uid) {
      bestTgt.swordMarks = Math.min(6, (bestTgt.swordMarks || 0) + 2);
      damageEnemy(bestTgt, Math.round(st.atk * 1.80), true, 26, ang, 4, false);
      addFloat("⚡ 飞剑缩地 · 瞬身追袭！", p.x, p.y - (p.z || 0) - 56, "#70ffe6", 18, true);
    } else if (bestTgt && bestTgt.destructible) {
      damageBattleProp(bestTgt, st.atk * 2.0);
      addFloat("⚡ 缩地破阵！", p.x, p.y - 52, "#ffd166", 17, true);
    } else {
      addFloat("⚡ 飞剑缩地瞬身！", p.x, p.y - 52, "#70ffe6", 16);
    }
    updateHud();
  }

  // Meteor Plunge Slam (`陨星千钧坠地劈` — Airborne Right-Click / 4th Air Hit)!
  function triggerMeteorPlunge() {
    if (!game) return;
    const p = arena.player;
    if ((p.z || 0) <= 10 || p.plunging) return;
    p.plunging = true;
    p.vz = -34.0;
    p.invuln = Math.max(p.invuln, 0.45);
    Sound.slash(true, 3);
    pushTelemetryInput("☄陨星坠劈!", false);
  }

  function resolveMeteorPlungeImpact() {
    if (!game) return;
    const p = arena.player;
    const st = getCombatStats(game);
    const vaultAmp = p.vaultPrimed ? 1.32 : 1.0;
    const peiAmp = hasKeepsake(game, "pei") ? 1.38 : 1.0;
    const samadhiAmp = p.samadhiFireReady ? 1.45 : 1.0;
    p.plunging = false;
    p.vaultPrimed = false;
    p.airComboStep = 0;

    Sound.meteorPlungeBoom();
    GamepadSystem.rumble(0.95, 0.90, 220);
    arena.shake = 16;
    arena.hitStop = 0.085;
    arena.camZoom = 1.08;
    arena.meteorBursts.push({ x: p.x, y: p.y + 8, r: 175, t: 0 });
    spawnDistortionRing(p.x, p.y, 225, p.samadhiFireReady ? "#ff7b47" : "#ffe28a");
    addDecal(p.x, p.y + 14, 0, 86, "spider_crack");
    spawnSparks(p.x, p.y, 26, 0, 6.28, p.samadhiFireReady ? "#ff9f43" : "#ffe28a");

    if (p.samadhiFireReady) {
      p.samadhiFireReady = false;
      arena.fireZones.push({ x: p.x, y: p.y, r: 105, life: 5.0, tickCd: 0.1 });
      addFloat("🔥 三昧真火 · 陨星焚天坠！！", p.x, p.y - 76, "#ff9f43", 23, true);
    } else {
      registerStyleAction("plunge", 130);
      addFloat("☄ 陨星千钧坠地劈！！", p.x, p.y - 72, "#ffe89e", 22, true);
    }

    const prevB = arena.currentDmgBucket;
    arena.currentDmgBucket = "combo_morph";
    arena.enemies.slice().forEach(e => {
      if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 168) {
        e.swordMarks = Math.min(6, (e.swordMarks || 0) + 3);
        e.airborneZ = 0; e.airborneVz = 0;
        damageEnemy(e, Math.round(st.atk * 3.65 * vaultAmp * peiAmp * samadhiAmp), true, 62, Math.atan2(e.y - p.y, e.x - p.x), 12, true);
      }
    });
    arena.props.slice().forEach(pr => {
      if (pr.destructible && pr.hp > 0 && Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + 150) {
        damageBattleProp(pr, st.atk * 2.8, "fire");
      }
    });
    arena.currentDmgBucket = prevB;
    updateHud();
  }

  function onParryOrVaultSuccess() {
    if (!game) return;
    playtestTelemetry.parrySuccessCount += 1;
    if (arena.bossRush && arena.bossRush.active) {
      arena.bossRush.parries = (arena.bossRush.parries || 0) + 1;
    }
    if (!game.gourd) return;
    if (Array.isArray(game.gourd.soaks) && game.gourd.soaks.includes("parry_brew")) {
      game.gourd.parryChargeProg = (game.gourd.parryChargeProg || 0) + 1;
      if (game.gourd.parryChargeProg >= 2) {
        game.gourd.parryChargeProg = 0;
        if (game.gourd.charges < game.gourd.maxCharges) {
          game.gourd.charges += 1;
          addFloat("🍶 剑魄寒梅 · 仙葫回酿 +1！", arena.player.x, arena.player.y - 88, "#9effec", 16, true);
          updateHud();
        }
      }
    }
    if (getKarmaState(game).mode === "righteous") {
      const st = getCombatStats(game);
      arena.player.shieldHp = Math.min(Math.round(st.maxHp * 0.45), (arena.player.shieldHp || 0) + Math.round(st.maxHp * 0.12));
    }
  }

  function refillImmortalGourd() {
    if (!game) return;
    if (!game.gourd) {
      game.gourd = { charges: 5, maxCharges: 5, soaks: ["iron_lotus", "samadhi_fire", "parry_brew"], parryChargeProg: 0 };
    }
    game.gourd.charges = game.gourd.maxCharges;
  }

  function ensureCompletedKarmaIds(g) {
    if (!g) return [];
    const valid = new Set(KARMA_DILEMMAS.map(d => d.id));
    const seen = new Set();
    const out = [];
    if (Array.isArray(g.completedKarmaIds)) {
      for (const id of g.completedKarmaIds) {
        if (typeof id === "string" && valid.has(id) && !seen.has(id)) {
          seen.add(id);
          out.push(id);
        }
      }
    }
    g.completedKarmaIds = out;
    return out;
  }

  function getEligibleKarmaDilemmas(g) {
    if (!g) return [];
    const doneSet = new Set(ensureCompletedKarmaIds(g));
    const curCh = getCurrentChapterIndex(g);
    return KARMA_DILEMMAS.filter(d => d.chapter <= curCh && !doneSet.has(d.id));
  }

  function getNextAvailableKarmaDilemma(g) {
    const list = getEligibleKarmaDilemmas(g);
    return list.length ? list[0] : null;
  }

  function getKarmaDilemmaProgress(g) {
    const totalCount = KARMA_DILEMMAS.length;
    if (!g) {
      return { doneCount: 0, totalCount, eligibleCount: 0, currentChapter: 1, allExhausted: false, chapterExhausted: false, nextChapterUnlock: 1, nextDilemma: null };
    }
    const done = ensureCompletedKarmaIds(g);
    const doneSet = new Set(done);
    const currentChapter = getCurrentChapterIndex(g);
    const eligible = KARMA_DILEMMAS.filter(d => d.chapter <= currentChapter && !doneSet.has(d.id));
    const future = KARMA_DILEMMAS.filter(d => d.chapter > currentChapter && !doneSet.has(d.id));
    const nextChapterUnlock = future.length ? Math.min(...future.map(d => d.chapter)) : null;
    const allExhausted = done.length >= totalCount || (!eligible.length && !future.length);
    const chapterExhausted = !allExhausted && eligible.length === 0;
    return {
      doneCount: done.length,
      totalCount,
      eligibleCount: eligible.length,
      currentChapter,
      allExhausted,
      chapterExhausted,
      nextChapterUnlock,
      nextDilemma: eligible[0] || null
    };
  }

  // Interactive Karma Duality Dilemma Modal (`红尘因果奇遇抉择`) — Non-Repeating & Chapter-Gated (S10)
  function openKarmaDilemmaModal(forcedIdx = null) {
    if (!game) return false;
    if (!guardNotInTribulation("红尘问心抉择")) return false;
    const done = ensureCompletedKarmaIds(game);
    const prog = getKarmaDilemmaProgress(game);
    let kd = null;
    if (forcedIdx !== null && forcedIdx !== undefined) {
      if (typeof forcedIdx === "string") {
        kd = KARMA_DILEMMAS.find(d => d.id === forcedIdx) || null;
      } else {
        const idx = ((Math.floor(num(forcedIdx, 0)) % KARMA_DILEMMAS.length) + KARMA_DILEMMAS.length) % KARMA_DILEMMAS.length;
        kd = KARMA_DILEMMAS[idx] || null;
      }
      if (!kd || done.includes(kd.id)) {
        showToast("☯ 此段红尘问心已了，因果不可重演");
        return false;
      }
    } else {
      if (!prog.nextDilemma) {
        if (prog.allExhausted) {
          showToast(`☯ 六卷因果劫数已尽（${prog.doneCount}/${prog.totalCount}），道心已定！`);
        } else {
          showToast(`☯ 本卷因果已了（${prog.doneCount}/${prog.totalCount}），突破至第${prog.nextChapterUnlock}卷后再遇新劫！`);
        }
        return false;
      }
      kd = prog.nextDilemma;
    }

    closeDrawer();
    const ks = getKarmaState(game);
    const dotPct = Math.round(((ks.score + 100) / 200) * 100);

    openModal(`
      <div class="drawer-mural-banner" style="height:106px;">
        <img src="${ART.banner_karma_duality}" alt="清虚正道与劫煞魔心" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">正魔一念 · 第${kd.chapter}卷因果（${prog.doneCount + 1}/${prog.totalCount}）</span>
            <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:4px;">${escapeHtml(kd.title)}</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">暂缓问心 ✕</button>
        </div>
      </div>

      <div class="jade-card" style="gap:6px;padding:9px 12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;">
          <span style="color:#ff6b81;font-weight:700;">🔥 劫煞魔心 (-100 · 血煞狂剑诀)</span>
          <strong style="color:${ks.color};font-family:var(--font-serif);">${escapeHtml(ks.label)} · 【${escapeHtml(ks.artName)}】</strong>
          <span style="color:#70ffe6;font-weight:700;">☯ 清虚正道 (+100 · 太清镇世诀)</span>
        </div>
        <div class="karma-spectrum-track"><div class="karma-spectrum-dot" style="left:${dotPct}%;"></div></div>
      </div>

      <p style="font-size:13px;color:var(--text-main);line-height:1.65;padding:2px 6px;">${escapeHtml(kd.desc)}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <button type="button" class="encounter-opt-btn" style="border-color:rgba(112,255,230,0.58);background:linear-gradient(155deg,rgba(10,36,42,0.94),rgba(6,18,24,0.96));flex-direction:column;align-items:flex-start;gap:6px;" data-karma-dilemma="${escapeHtml(kd.id)}" data-karma-side="right">
          <span class="tag-chip done">☯ 清虚正道之选</span>
          <strong style="font-family:var(--font-serif);font-size:15px;color:#dffef8;">${escapeHtml(kd.rightOpt.label)}</strong>
          <span style="font-size:11.5px;color:#80ffea;line-height:1.45;">${escapeHtml(kd.rightOpt.detail)}</span>
        </button>
        <button type="button" class="encounter-opt-btn" style="border-color:rgba(255,92,108,0.62);background:linear-gradient(155deg,rgba(48,12,22,0.94),rgba(22,8,16,0.96));flex-direction:column;align-items:flex-start;gap:6px;" data-karma-dilemma="${escapeHtml(kd.id)}" data-karma-side="demon">
          <span class="tag-chip mythic" style="border-color:#ff6b81;color:#ffd2d8;">🔥 劫煞魔心之选</span>
          <strong style="font-family:var(--font-serif);font-size:15px;color:#ffe0e4;">${escapeHtml(kd.demonOpt.label)}</strong>
          <span style="font-size:11.5px;color:#ff9eaa;line-height:1.45;">${escapeHtml(kd.demonOpt.detail)}</span>
        </button>
      </div>
    `, true);
    return true;
  }

  function resolveKarmaDilemmaChoice(kdId, side) {
    if (!game || typeof kdId !== "string") return false;
    if (!guardNotInTribulation("红尘问心抉择")) return false;
    if (!guardNotPracticeMode("红尘问心抉择")) return false;
    const kd = KARMA_DILEMMAS.find(x => x.id === kdId);
    if (!kd) return false;
    const done = ensureCompletedKarmaIds(game);
    if (done.includes(kd.id)) {
      showToast("☯ 此段红尘问心已了，因果不可重复抉择");
      closeModal();
      return false;
    }
    const opt = side === "demon" ? kd.demonOpt : kd.rightOpt;
    done.push(kd.id);
    game.completedKarmaIds = done;
    game.karmaScore = Math.max(-100, Math.min(100, (game.karmaScore || 0) + opt.karma));
    game.karmaEventsDone = Math.max(Math.floor(num(game.karmaEventsDone, 0)) + 1, done.length);
    if (opt.hpBonus || opt.atkBonus) {
      grantPermanentStatBonus(game, { hp: opt.hpBonus || 0, atk: opt.atkBonus || 0, source: "general" });
    }
    if (opt.drBonus) game.karmaDrBonus = (game.karmaDrBonus || 0) + opt.drBonus;
    if (opt.stones) game.stones += opt.stones;
    if (opt.swordBonus) { game.bonusSwords = (game.bonusSwords || 0) + opt.swordBonus; syncFlyingSwords(); }
    if (opt.gourdMax && game.gourd) { game.gourd.maxCharges += opt.gourdMax; game.gourd.charges = game.gourd.maxCharges; }
    if (opt.fillIntent) { arena.swordIntent = 100; arena.bondSynergy = 100; arena.astralEnergy = 100; }
    if (opt.gearSlot) acquireGearItem(rollGearItem(Math.max(2, arena.stageIdx + 1), 3, opt.gearSlot));
    if (opt.bond) {
      if (!game.bondTiers) game.bondTiers = { shen: 1, pei: 0, lu: 0, yan: 0 };
      game.bondTiers[opt.bond] = Math.min(3, getCompanionBondTier(game, opt.bond) + 1);
      game.aids[opt.bond] = true;
    }
    const ks = getKarmaState(game);
    const st = getCombatStats(game);
    if (side === "right") {
      game.hp = st.maxHp;
      arena.player.shieldHp = Math.round(st.maxHp * 0.25);
      game.dao.benevolence = (game.dao.benevolence || 6) + 10;
    } else {
      game.dao.edge = (game.dao.edge || 10) + 12;
    }
    // Auto-sync trail cosmetic when first crossing threshold if default
    if (ks.mode === "demonic" && game.cosmetics && game.cosmetics.trailSkin === "ink_jade") {
      game.cosmetics.trailSkin = "crimson_flame";
      game.cosmetics.footAura = "crimson_eclipse";
    } else if (ks.mode === "righteous" && game.cosmetics && game.cosmetics.trailSkin === "crimson_flame") {
      game.cosmetics.trailSkin = "ink_jade";
      game.cosmetics.footAura = "lotus_step";
    }
    if (Array.isArray(game.journal)) {
      game.journal.unshift(`【红尘因果 · 第${kd.chapter}卷】${kd.title}：${opt.label}`);
    }
    Sound.fanfare();
    spawnDistortionRing(arena.player.x, arena.player.y, 195, ks.color);
    showToast(`${ks.mode === "demonic" ? "🔥 劫煞魔心大成 · 激活【血煞狂剑诀】！" : ks.mode === "righteous" ? "☯ 清虚道心通明 · 激活【太清镇世诀】！" : "✦ 道心流转 · 因果已录"}`);
    closeModal();
    saveGame();
    updateHud();
    if (drawerOpen) renderDrawerContent();
    return true;
  }

  // Centralized photo-mode cleanup so session exits & mode switches never leak photoPauseToken or stale photoMode.active
  function resetPhotoModeOverlay({ resetCamera = false, skipCalmReeval = false } = {}) {
    const wasActive = Boolean(photoMode.active || photoPauseToken);
    photoMode.active = false;
    photoMode.uiHidden = false;
    photoMode.previewImpact = false;
    photoMode.dragging = false;
    if (resetCamera) {
      photoMode.zoom = 1.15;
      photoMode.panX = 0;
      photoMode.panY = 0;
    }
    if (document && document.body) {
      document.body.classList.remove("photo-mode-active", "photo-ui-hidden");
    }
    const panel = document.getElementById("photo-mode-panel");
    if (panel) panel.classList.remove("open");
    const prevPhotoTok = photoPauseToken;
    photoPauseToken = null;
    releasePauseToken(prevPhotoTok);
    if (wasActive) {
      syncPhotoStudioUi();
      if (!skipCalmReeval) setTimeout(() => requestCalmReevaluation(), 0);
    }
  }

  // `P` Key AAA Free Photo Mode (`太虚绘卷 · 自由摄影模式`)
  function togglePhotoMode(force = null) {
    if (!game || document.getElementById("welcome-screen").style.display !== "none") return false;
    const next = force !== null ? Boolean(force) : !photoMode.active;
    const panel = document.getElementById("photo-mode-panel");
    if (next) {
      const bd = document.getElementById("modal-backdrop");
      const modalOpen = Boolean(bd && bd.classList.contains("open"));
      const curPri = modalOpen ? (hasOwn(MODAL_PRIORITY, activeModalKind) ? MODAL_PRIORITY[activeModalKind] : MODAL_PRIORITY.default) : 0;
      if (saveConflictState || arena.defeatPending || storageReadError || (modalOpen && (!modalCloseable || curPri >= 100))) {
        showToast("当前有重要抉择或系统弹窗待处理，暂不可开启摄影模式。", { key: "photo_blocked_n0", throttleMs: 2000 });
        return false;
      }
      // Acquire photoPauseToken BEFORE closing drawer/modal so pauseTokens.size NEVER dips to 0 mid-swap!
      if (!photoPauseToken) photoPauseToken = acquirePauseToken("photo", "photo_mode");
      photoMode.active = true;
      closeDrawer();
      closeModal();
      photoMode.uiHidden = false;
      document.body.classList.add("photo-mode-active");
      document.body.classList.remove("photo-ui-hidden");
      if (panel) panel.classList.add("open");
      Sound.bianzhong(659.25, 0.08);
      syncPhotoStudioUi();
      return true;
    } else {
      resetPhotoModeOverlay();
      return false;
    }
  }

  function syncPhotoStudioUi() {
    const zl = document.getElementById("photo-zoom-lbl");
    const zr = document.getElementById("photo-zoom-range");
    if (zl) zl.textContent = `${photoMode.zoom.toFixed(2)}x`;
    if (zr) zr.value = String(Math.round(photoMode.zoom * 100));
    document.querySelectorAll("[data-photo-filter]").forEach(el => {
      el.classList.toggle("active", el.getAttribute("data-photo-filter") === photoMode.filter);
    });
    const stBtn = document.getElementById("btn-photo-stamp");
    if (stBtn) {
      stBtn.classList.toggle("active", photoMode.showStamp);
      stBtn.textContent = `印章题跋 ${photoMode.showStamp ? "ON" : "OFF"}`;
    }
    const impBtn = document.getElementById("btn-photo-impact");
    if (impBtn) {
      impBtn.classList.toggle("active", photoMode.previewImpact);
      impBtn.textContent = `朱砂一闪 ${photoMode.previewImpact ? "ON" : "OFF"}`;
    }
  }

  function exportPhotoModePng() {
    const cv = document.getElementById("fx-canvas");
    const bgImg = document.getElementById("stage-bg-img");
    if (!cv) return null;
    // Composite background scene image + live canvas effects/filters/calligraphy seal onto an offscreen HD export canvas!
    const out = document.createElement("canvas");
    out.width = cv.width || 1440;
    out.height = cv.height || 900;
    const octx = out.getContext("2d");
    octx.fillStyle = "#061015";
    octx.fillRect(0, 0, out.width, out.height);
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
      octx.save();
      octx.translate(out.width / 2 + photoMode.panX * 0.45, out.height / 2 + photoMode.panY * 0.45);
      octx.scale(photoMode.zoom, photoMode.zoom);
      octx.drawImage(bgImg, -out.width / 2, -out.height / 2, out.width, out.height);
      octx.restore();
    }
    renderArenaCanvas();
    octx.drawImage(cv, 0, 0);
    const dataUrl = out.toDataURL("image/png");
    photoMode.lastExportBytes = dataUrl.length;
    photoMode.exportCount += 1;
    try {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `chenyuan-wendao-scroll-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {}
    Sound.fanfare();
    showToast("📸 已导出高清《太虚绘卷》PNG 截图！");
    return dataUrl;
  }

  function renderWardrobePreviewCanvas() {
    const pv = document.getElementById("wardrobe-preview-canvas");
    if (!pv || !game) return;
    const pctx = pv.getContext("2d");
    const w = pv.width, h = pv.height;
    const nowSec = performance.now() * 0.001;
    pctx.clearRect(0, 0, w, h);
    const bg = pctx.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, w * 0.6);
    const ks = getKarmaState(game);
    bg.addColorStop(0, ks.mode === "demonic" ? "rgba(76, 18, 30, 0.95)" : "rgba(16, 48, 56, 0.95)");
    bg.addColorStop(1, "rgba(5, 13, 18, 0.98)");
    pctx.fillStyle = bg;
    pctx.fillRect(0, 0, w, h);

    const cos = game.cosmetics || { bladeSkin: "celadon", trailSkin: "ink_jade", footAura: "lotus_step", swordAura: "azure_jade" };
    const auraCol = (WARDROBE_OPTIONS.footAura.find(x => x.id === cos.footAura) || WARDROBE_OPTIONS.footAura[0]).col;
    const trailCol = (WARDROBE_OPTIONS.trailSkin.find(x => x.id === cos.trailSkin) || WARDROBE_OPTIONS.trailSkin[0]).col;
    const bladeCol = (WARDROBE_OPTIONS.bladeSkin.find(x => x.id === cos.bladeSkin) || WARDROBE_OPTIONS.bladeSkin[0]).col;
    const swAura = WARDROBE_OPTIONS.swordAura.find(x => x.id === cos.swordAura) || WARDROBE_OPTIONS.swordAura[0];

    // Reincarnation Sword Aura Halo (`外显剑意幻化`)
    if (swAura && swAura.id !== "azure_jade") {
      pctx.save();
      pctx.translate(w * 0.5, h * 0.5);
      pctx.strokeStyle = swAura.col;
      pctx.globalAlpha = 0.65;
      pctx.lineWidth = 1.8;
      pctx.setLineDash(swAura.id === "starlight_void" ? [4, 4] : []);
      pctx.beginPath(); pctx.arc(0, 0, 50, nowSec * 1.4, nowSec * 1.4 + Math.PI * 1.65); pctx.stroke();
      pctx.setLineDash([]);
      for (let m = 0; m < 6; m++) {
        const ma = nowSec * (swAura.id === "primordial_chaos" ? -2.6 : 2.1) + (m * Math.PI) / 3;
        pctx.fillStyle = m % 2 === 0 ? swAura.col : swAura.accent;
        pctx.beginPath();
        pctx.arc(Math.cos(ma) * 48, Math.sin(ma) * 28, swAura.id === "golden_lotus" ? 3.4 : 2.6, 0, Math.PI * 2);
        pctx.fill();
      }
      pctx.restore();
    }

    // Foot Aura Ring
    pctx.save();
    pctx.translate(w * 0.5, h * 0.76);
    pctx.scale(1, 0.48);
    pctx.strokeStyle = auraCol;
    pctx.lineWidth = 2.5;
    pctx.beginPath(); pctx.arc(0, 0, 44, 0, Math.PI * 2); pctx.stroke();
    for (let k = 0; k < 6; k++) {
      const ka = nowSec * 1.8 + (k * Math.PI) / 3;
      pctx.beginPath(); pctx.arc(Math.cos(ka) * 34, Math.sin(ka) * 34, 6, 0, Math.PI * 2); pctx.stroke();
    }
    pctx.restore();

    // Sweeping Trail Ribbon
    pctx.save();
    pctx.strokeStyle = trailCol;
    pctx.lineWidth = 7;
    pctx.globalAlpha = 0.72;
    pctx.beginPath();
    pctx.arc(w * 0.5, h * 0.52, 54, -0.8 + Math.sin(nowSec * 2) * 0.2, 1.3 + Math.sin(nowSec * 2) * 0.2);
    pctx.stroke();
    pctx.restore();

    const pImg = IMG_CACHE.actor_player_battle;
    if (pImg && pImg.complete) {
      pctx.drawImage(pImg, w * 0.5 - 42, h * 0.5 - 46, 84, 84);
    }
    // Orbiting Custom Blade Preview
    for (let b = 0; b < 3; b++) {
      const ba = nowSec * 2.4 + (b * Math.PI * 2) / 3;
      const bx = w * 0.5 + Math.cos(ba) * 58;
      const by = h * 0.48 + Math.sin(ba) * 24;
      pctx.save();
      pctx.translate(bx, by);
      pctx.rotate(ba + Math.PI / 2);
      pctx.fillStyle = bladeCol;
      pctx.beginPath();
      pctx.moveTo(18, 0);
      pctx.lineTo(-6, cos.bladeSkin === "gold_greatsword" ? -5.2 : -3.2);
      pctx.lineTo(-9, 0);
      pctx.lineTo(-6, cos.bladeSkin === "gold_greatsword" ? 5.2 : 3.2);
      pctx.closePath();
      pctx.fill();
      pctx.restore();
    }
  }

  // ==================== V19 HALL-OF-FAME SYSTEMS: SOUL AVATARS, BLADE CLASH, 3-STATE EXECUTIONS, S-RANK STYLE METER, GHOST DOJO & 28-STAR ASTROLABE ====================
  const SOUL_SPIRITS = {
    blood_warden: {
      id: "blood_warden", shortLbl: "石卫印", name: "守山石卫 · 裂地狂锤", art: "enemy_warden", elem: "fire", cd: 6.2,
      color: "#ff6b57", desc: "召唤守山石卫真身轰砸熔岩巨坑（340%范围重伤+64削韧+4秒霸体）；命中灵泉水洼触发【沸雾蒸云阵】，命中玄冰触发【融火晶爆】！"
    },
    frost_phoenix: {
      id: "frost_phoenix", shortLbl: "玄蛇印", name: "寒潭玄蛇 · 极寒吐息", art: "enemy_serpent", elem: "frost", cd: 5.8,
      color: "#80ecff", desc: "化现寒潭玄蛇法相喷吐极寒冰暴（315%范围冰伤+4.5秒深度冻结）；冻结灵泉水洼，命中火域触发【冰火蒸汽核爆(+180%真伤)】！"
    },
    sword_fiend: {
      id: "sword_fiend", shortLbl: "剑傀印", name: "古境剑傀 · 万刃破空", art: "enemy_puppet", elem: "metal", cd: 5.5,
      color: "#ffd166", desc: "召唤古境剑傀法相齐射八方裂空古剑（330%穿甲重伤+叠4枚剑印+瞬破盾卫正面玄盾）！"
    },
    thunder_lord: {
      id: "thunder_lord", shortLbl: "守灵印", name: "云台守灵 · 天罚剑罡", art: "enemy_sentinel", elem: "thunder", cd: 6.4,
      color: "#d69eff", desc: "融汇云台守灵法相劈落五重紫霄天罚雷柱（365%雷伤+58削韧）；直接引爆全场水洼【超导感电】与火域【雷火超载爆破】！"
    },
    taixu_demon: {
      id: "taixu_demon", shortLbl: "心魔印", name: "太虚心魔 · 破界双斩", art: "actor_inner_demon", elem: "void", cd: 6.8,
      color: "#ff9eff", desc: "召唤宿命太虚心魔同步施展阴阳破界十字斩（395%真伤+剑意+25%+开启1.2秒太虚凝时）！"
    }
  };

  const STAR_QUADRANTS = [
    {
      id: "azure_dragon", name: "东方苍龙七宿", coreTitle: "苍龙御剑星魂", color: "#70ffe6",
      coreDesc: "点亮≥4宿觉醒：本命环身飞剑永久 +2 柄，斩杀妖兽立即刷新【飞剑缩地瞬身】冷却！",
      mansions: [
        { id: "ad_1", name: "角木蛟", statTxt: "攻+6" }, { id: "ad_2", name: "亢金龙", statTxt: "暴+3%" },
        { id: "ad_3", name: "氐土貉", statTxt: "血+24" }, { id: "ad_4", name: "房日兔", statTxt: "速+4%" },
        { id: "ad_5", name: "心月狐", statTxt: "攻+8" }, { id: "ad_6", name: "尾火虎", statTxt: "暴伤+8%" },
        { id: "ad_7", name: "箕水豹", statTxt: "飞剑威+8%" }
      ]
    },
    {
      id: "white_tiger", name: "西方白虎七宿", coreTitle: "白虎破军星魂", color: "#ffd86b",
      coreDesc: "点亮≥4宿觉醒：【剑罡拼刀角力】压制效率 +45%，三态【斩仙处决】终结伤害 +35%！",
      mansions: [
        { id: "wt_1", name: "奎木狼", statTxt: "攻+7" }, { id: "wt_2", name: "娄金狗", statTxt: "削韧+8%" },
        { id: "wt_3", name: "胃土雉", statTxt: "血+26" }, { id: "wt_4", name: "昴日鸡", statTxt: "暴+3%" },
        { id: "wt_5", name: "毕月乌", statTxt: "减伤+3" }, { id: "wt_6", name: "觜火猴", statTxt: "暴伤+9%" },
        { id: "wt_7", name: "参水猿", statTxt: "攻+10" }
      ]
    },
    {
      id: "vermilion_bird", name: "南方朱雀七宿", coreTitle: "朱雀焚天星魂", color: "#ff7875",
      coreDesc: "点亮≥4宿觉醒：C键【太虚镇妖魂印】冷却缩短 28%，跨系五行元素聚变伤害 +40%！",
      mansions: [
        { id: "vb_1", name: "井木犴", statTxt: "灵力+16" }, { id: "vb_2", name: "鬼金羊", statTxt: "攻+7" },
        { id: "vb_3", name: "柳土獐", statTxt: "血+25" }, { id: "vb_4", name: "星日马", statTxt: "暴伤+8%" },
        { id: "vb_5", name: "张月鹿", statTxt: "速+4%" }, { id: "vb_6", name: "翼火蛇", statTxt: "魂印威+12%" },
        { id: "vb_7", name: "轸水蚓", statTxt: "攻+9" }
      ]
    },
    {
      id: "black_tortoise", name: "北方玄武七宿", coreTitle: "玄武镇世星魂", color: "#a6c8ff",
      coreDesc: "点亮≥4宿觉醒：最大气血额外 +18%，本命九转仙葫灵酿上限永久 +1 缕！",
      mansions: [
        { id: "bt_1", name: "斗木獬", statTxt: "血+30" }, { id: "bt_2", name: "牛金牛", statTxt: "减伤+4" },
        { id: "bt_3", name: "女土蝠", statTxt: "血+28" }, { id: "bt_4", name: "虚日鼠", statTxt: "闪避无敌+0.05s" },
        { id: "bt_5", name: "危月燕", statTxt: "暴+3%" }, { id: "bt_6", name: "室火猪", statTxt: "攻+8" },
        { id: "bt_7", name: "壁水貐", statTxt: "减伤+5" }
      ]
    }
  ];

  const STYLE_MOVE_LABELS = { sanqing: "一气三清", sanqing_swap: "三清归元", shanhe: "破画万钧", warship: "仙舟天基", seq_mix: "混元创招", coop_exec: "双剑诛仙", coop_net: "同心剑网", rift_tear: "太初剑痕", astral: "法天真身", titan_clash: "双神角力", mount_charge: "灵骑破阵", vault_dismount: "跃马坠星", qimen: "奇门扩域", sky_roll: "滚筒", sky_deflect: "回天盾", six_aspect: "六象", dual_bond: "双人合璧", tag_switch: "同心", spear: "龙枪", chakram: "剑轮", titan_climb: "逆鳞",
    light: "轻剑", morph: "切手", switch_slash: "易剑", aerial: "升龙",
    plunge: "陨星", deflect: "识破", vault: "踏剑", soul_cancel: "魂印",
    blade_clash: "拼刀", execution: "处决", blink: "缩地", gourd: "仙葫"
  };

  function hasStarCore(g, quadId) {
    if (!g || !Array.isArray(g.litStars)) return false;
    const q = STAR_QUADRANTS.find(x => x.id === quadId);
    if (!q) return false;
    return q.mansions.filter(m => g.litStars.includes(m.id)).length >= 4;
  }

  function getStarChartBonuses(g) {
    const res = { atk: 0, hp: 0, dr: 0, crit: 0, critMult: 0, spd: 0, mp: 0 };
    if (!g || !Array.isArray(g.litStars) || !g.litStars.length) return res;
    const lit = new Set(g.litStars);
    STAR_QUADRANTS.forEach(q => {
      q.mansions.forEach(m => {
        if (!lit.has(m.id)) return;
        if (m.statTxt.startsWith("攻+")) res.atk += Number(m.statTxt.slice(2)) || 0;
        else if (m.statTxt.startsWith("血+")) res.hp += Number(m.statTxt.slice(2)) || 0;
        else if (m.statTxt.startsWith("减伤+")) res.dr += Number(m.statTxt.slice(3)) || 0;
        else if (m.statTxt.startsWith("暴+")) res.crit += (Number(m.statTxt.replace(/[^0-9]/g, "")) || 0) / 100;
        else if (m.statTxt.startsWith("暴伤+")) res.critMult += (Number(m.statTxt.replace(/[^0-9]/g, "")) || 0) / 100;
        else if (m.statTxt.startsWith("速+")) res.spd += (Number(m.statTxt.replace(/[^0-9]/g, "")) || 0) / 100;
        else if (m.statTxt.startsWith("灵力+")) res.mp += Number(m.statTxt.slice(3)) || 0;
      });
    });
    // V23 Celestial Law (`极夜星河`): All 28-Constellation Star Chart passive bonuses are DOUBLED (×2.0)!
    if (typeof getCurrentCelestialPhase === "function" && getCurrentCelestialPhase().id === "star_night") {
      const snMult = COMBAT_RULE_PARAMS.celestialPhases.star_night.starChartMult;
      res.atk *= snMult;
      res.hp *= snMult;
      res.dr *= snMult;
      res.crit *= snMult;
      res.critMult *= snMult;
      res.spd *= snMult;
      res.mp *= snMult;
    }
    return res;
  }

  function getAvailableStarPoints(g) {
    if (!g) return 0;
    const earned = 2 + rankOf(g.realm) * 2 + Math.floor(getTotalStageStars(g) / 2) + (g.bonusStarPts || 0);
    const spent = Array.isArray(g.litStars) ? g.litStars.length : 0;
    return Math.max(0, earned - spent);
  }

  function hasPrimordialAwakening(g, awId) {
    if (!g || !g.equippedGear) return false;
    return ["weapon", "armor", "ring"].some(sl => g.equippedGear[sl] && g.equippedGear[sl].awakenedAffix === awId);
  }

  // Real-Time Sword Style & Variety Meter (`剑道风华评级仪 C -> B -> A -> S`)

  function registerStyleAction(moveType, basePts = 65) {
    const hist = arena.recentMoveHistory || [];
    const lastTwoSame = hist.length >= 2 && hist[hist.length - 1] === moveType && hist[hist.length - 2] === moveType;
    const isFresh = !hist.slice(-3).includes(moveType);
    const mult = lastTwoSame ? 0.28 : isFresh ? 1.65 : 1.0;
    const distinctCount = new Set(hist.concat(moveType)).size;
    const varietyBonus = distinctCount >= 4 ? 28 : 0;
    const gain = Math.round(basePts * mult + varietyBonus);
    arena.styleScore = Math.min(1150, (arena.styleScore || 0) + gain);
    arena.styleDecayTimer = 4.6;
    hist.push(moveType);
    if (hist.length > 5) hist.shift();
    arena.recentMoveHistory = hist;
    updateComboRankSeal();
  }

  // Pillar 1: 【太虚镇妖魂印 · 精魄化身技 (`Soul-Cancel` + Cross-Elemental Fusion)】
  function castSoulSpiritSkill() {
    if (!game || arena.paused) return;
    if (!guardActionRealm("soul")) return;
    if ((arena.soulCd || 0) > 0) return;
    if (!consumePlayerMp(18, "镇妖魂印")) return;
    const eqId = hasOwn(SOUL_SPIRITS, game.equippedSoul) ? game.equippedSoul : "blood_warden";
    const sp = SOUL_SPIRITS[eqId];
    const p = arena.player;
    const st = getCombatStats(game);

    // Seamless Soul-Cancel (`以妖破妖 · 强制取消一切普攻/重击/闪避后摇硬直`)!
    const cancelledRecovery = p.slashCd > 0.02 || p.dashTimer > 0 || (arena.morphCd || 0) > 0.05;
    p.slashCd = 0;
    p.dashTimer = 0;
    arena.morphCd = 0;
    if (p.meditating) toggleMeditation(false);
    p.comboWindow = 1.35;
    p.hyperArmorTimer = Math.max(p.hyperArmorTimer || 0, 1.55);
    p.invuln = Math.max(p.invuln, 0.48);

    const cdMult = hasStarCore(game, "vermilion_bird") ? 0.72 : 1.0;
    arena.soulCd = sp.cd * cdMult;
    const ringBonus = hasPrimordialAwakening(game, "primordial_soul") ? 1.38 : 1.0;
    const fusionBonus = hasStarCore(game, "vermilion_bird") ? 1.40 : 1.0;
    if (hasPrimordialAwakening(game, "primordial_soul")) {
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 22);
    }

    let ang = Math.atan2(pointer.y - p.y, pointer.x - p.x);
    const lockTgt = acquireSoftLockTarget(p.x, p.y, ang);
    if (lockTgt) ang = Math.atan2(lockTgt.y - p.y, lockTgt.x - p.x);
    p.facing = Math.cos(ang) >= 0 ? 1 : -1;

    const impX = p.x + Math.cos(ang) * 74;
    const impY = p.y + Math.sin(ang) * 46;
    Sound.soulManifestRoar();
    GamepadSystem.rumble(0.88, 0.80, 190);
    arena.shake = 15;
    arena.camZoom = 1.08;
    registerStyleAction("soul_cancel", cancelledRecovery ? 145 : 105);
    pushTelemetryInput(cancelledRecovery ? `👹魂印取消·${sp.shortLbl}` : `👹${sp.shortLbl}`, false);

    // Check if Soul Avatar directly collides with an enemy Grab/Lunge to initiate Blade Clash!
    const clashFoe = arena.enemies.find(e => e.hp > 0 && (e.grabWindup || (e.isBoss && (e.state === "windup" || e.state === "lunge"))) && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 168);
    if (clashFoe && !arena.bladeClash && clashFoe.grabWindup) {
      startBladeClash(clashFoe, true);
    }

    // Spawn Translucent Giant Boss Dharma Avatar (`妖王法相真身显化`)
    arena.soulAvatars.push({
      art: sp.art, color: sp.color, name: sp.name,
      x: p.x + Math.cos(ang) * 36, y: p.y - (p.z || 0) - 18 + Math.sin(ang) * 18,
      facing: p.facing, t: 0, maxT: 0.92
    });
    spawnDistortionRing(impX, impY, 215, sp.color);
    addDecal(impX, impY + 14, ang, 78, "spider_crack");
    addFloat(`${cancelledRecovery ? "⚡ 化妖断后摇 · " : "👹 "}【${sp.name}】！`, p.x, p.y - (p.z || 0) - 68, sp.color, 20, true);

    // Cross-Elemental Terrain Fusion (`跨系五行元素聚变`)!
    let fusionTriggered = null;
    if (sp.elem === "fire") {
      arena.fireZones.push({ x: impX, y: impY, r: 98, life: 5.0, tickCd: 0.1 });
      for (const wp of arena.waterPools) {
        if (Math.hypot(wp.x - impX, wp.y - impY) < wp.r + 125) {
          fusionTriggered = "♨ 五行聚变 · 【沸雾蒸云爆】(+170%灼魂)!";
          spawnDistortionRing(wp.x, wp.y, 220, "#ff9f43");
        }
      }
    } else if (sp.elem === "frost") {
      arena.frostPools.push({ x: impX, y: impY, r: 105, life: 5.5 });
      for (const wp of arena.waterPools) {
        if (Math.hypot(wp.x - impX, wp.y - impY) < wp.r + 130) {
          wp.frozenTimer = 6.0;
          fusionTriggered = "❄ 五行聚变 · 【玄冥寒泉封界】!";
        }
      }
      for (let fi = arena.fireZones.length - 1; fi >= 0; fi--) {
        const fz = arena.fireZones[fi];
        if (Math.hypot(fz.x - impX, fz.y - impY) < fz.r + 125) {
          arena.fireZones.splice(fi, 1);
          fusionTriggered = "💥 五行聚变 · 【冰火融晶核爆】(+185%真伤)!";
          triggerImpactFrame(2, "#80ecff", fz.x, fz.y);
          spawnDistortionRing(fz.x, fz.y, 240, "#80ecff");
        }
      }
    } else if (sp.elem === "thunder") {
      for (let k = 0; k < 5; k++) {
        const ka = ang + (k - 2) * 0.35;
        const bx = p.x + Math.cos(ka) * (75 + (k % 2) * 45);
        const by = p.y + Math.sin(ka) * (48 + (k % 2) * 30);
        arena.skyBolts.push({ x: bx, y: by, t: 0, color: "#d69eff" });
        triggerElectroPoolReaction(bx, by, st.atk * 1.45 * fusionBonus);
      }
      for (let fi = arena.fireZones.length - 1; fi >= 0; fi--) {
        const fz = arena.fireZones[fi];
        if (Math.hypot(fz.x - impX, fz.y - impY) < fz.r + 145) {
          arena.fireZones.splice(fi, 1);
          fusionTriggered = "⚡🔥 五行聚变 · 【紫雷业火超载爆破】!";
          spawnDistortionRing(fz.x, fz.y, 245, "#ff78c4");
        }
      }
    } else if (sp.elem === "metal") {
      for (let q = 0; q < 8; q++) {
        const qa = (q * Math.PI * 2) / 8;
        arena.projectiles.push({
          friendly: true, kind: "crescent", x: p.x, y: p.y - 8,
          vx: Math.cos(qa) * 14.5, vy: Math.sin(qa) * 10.5, ang: qa, r: 52,
          dmg: Math.round(st.atk * 1.35 * ringBonus), heavyPosture: true, postureDmg: 22, knock: 7, addMark: 2, life: 0.62,
          pierced: new Set(), color: "#ffd166"
        });
      }
    } else if (sp.elem === "void") {
      arena.witchTime = Math.max(arena.witchTime || 0, 1.25);
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 25);
      pushBladeArc(impX, impY, ang - 0.55, 165, "#ff9eff", 1, true);
      pushBladeArc(impX, impY, ang + 0.55, 165, "#70ffe6", -1, true);
    }

    if (fusionTriggered) {
      addFloat(fusionTriggered, impX, impY - 46, "#fff3b0", 20, true);
    }

    const elemFusionAmp = fusionTriggered ? (1.65 * fusionBonus) : 1.0;
    const baseMult = sp.elem === "void" ? 3.85 : sp.elem === "thunder" ? 3.55 : 3.30;
    const prevB = arena.currentDmgBucket;
    arena.currentDmgBucket = "thunder_elem";
    arena.enemies.slice().forEach(e => {
      if (Math.hypot(e.x - impX, e.y - impY) < e.r + 175) {
        if (e.state === "windup") { e.flinchTimer = 0.48; e.perilous = false; e.lowSweepWindup = false; e.grabWindup = false; }
        if (sp.elem === "frost") e.chillTimer = 4.5;
        if (sp.elem === "fire") e.burnTimer = 4.5;
        e.swordMarks = Math.min(6, (e.swordMarks || 0) + (sp.elem === "metal" ? 4 : 2));
        damageEnemy(e, Math.round(st.atk * baseMult * ringBonus * elemFusionAmp), true, 60, ang, 11, true);
      }
    });
    arena.props.slice().forEach(pr => {
      if (pr.destructible && pr.hp > 0 && Math.hypot(pr.x - impX, pr.y - impY) < pr.r + 155) {
        damageBattleProp(pr, st.atk * 3.0, sp.elem);
      }
    });
    arena.currentDmgBucket = prevB;
    updateHud();
  }

  // Pillar 2: 【剑罡相交 · 拼刀角力 (`Blade Clash` & `暗金【擒】字投技反制`)】
  function startBladeClash(foe, fromGrabCounter = false) {
    if (!game || !foe || arena.bladeClash) return;
    const p = arena.player;
    const midX = (p.x + foe.x) * 0.5;
    const midY = (p.y + foe.y) * 0.5;
    foe.state = "chase";
    foe.grabWindup = false;
    foe.perilous = false;
    foe.lowSweepWindup = false;
    foe.vx = 0; foe.vy = 0;
    p.invuln = 1.6;
    arena.bladeClash = {
      foe,
      midX, midY,
      timer: 1.18,
      maxTimer: 1.18,
      power: fromGrabCounter ? 66 : 56,
      taps: 0,
      sparkTick: 0,
      fromGrabCounter
    };
    document.body.classList.add("letterbox-active");
    const hud = document.getElementById("blade-clash-hud");
    if (hud) hud.classList.add("active");
    Sound.triggerDucking(400, 0.28, 1300);
    Sound.bladeClashGrind();
    GamepadSystem.rumble(0.85, 0.75, 220);
    arena.camFocusX = midX;
    arena.camFocusY = midY;
    arena.camFocusT = 1.25;
    arena.camZoom = 1.18;
    registerStyleAction("blade_clash", 160);
    pushTelemetryInput(fromGrabCounter ? "🤜破擒拼刀!" : "⚔剑罡拼刀!", false);
    addFloat(fromGrabCounter ? "🤜 破除暗金【擒】技 · 剑罡角力！！" : "⚔ 剑罡正面相交 · 拼刀角力！！", midX, midY - 68, "#ffd875", 21, true);
    syncBladeClashHud();
  }

  function pumpBladeClashInput() {
    if (!arena.bladeClash) return false;
    const bc = arena.bladeClash;
    const tigerAmp = hasStarCore(game, "white_tiger") ? 1.45 : 1.0;
    bc.power = Math.min(100, bc.power + 15 * tigerAmp);
    bc.taps += 1;
    Sound.clang(1.35 + bc.taps * 0.08, 0.12);
    GamepadSystem.rumble(0.65, 0.50, 60);
    spawnSparks(bc.midX, bc.midY - 14, 12, Math.random() * 6.28, 3.14, "#ffe28a");
    syncBladeClashHud();
    if (bc.power >= 100) {
      resolveBladeClashOutcome(true);
    }
    return true;
  }

  function syncBladeClashHud() {
    const bc = arena.bladeClash;
    const hud = document.getElementById("blade-clash-hud");
    if (!bc || !hud) return;
    const fill = document.getElementById("blade-clash-fill");
    const sub = document.getElementById("blade-clash-sub");
    if (fill) fill.style.width = `${Math.round(bc.power)}%`;
    if (sub) sub.textContent = `剑压优势 ${Math.round(bc.power)}%（余 ${bc.timer.toFixed(1)}s）· 连按左键/J/空格一剑破军！`;
  }

  function resolveBladeClashOutcome(won) {
    const bc = arena.bladeClash;
    if (!bc) return;
    arena.bladeClash = null;
    document.body.classList.remove("letterbox-active");
    const hud = document.getElementById("blade-clash-hud");
    if (hud) hud.classList.remove("active");
    const foe = bc.foe;
    const p = arena.player;
    const st = getCombatStats(game);

    if (won || bc.power >= 50) {
      arena.parryCount = (arena.parryCount || 0) + 1;
      if (arena.encounterTelemetry) arena.encounterTelemetry.parryCount += 1;
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 32);
      onParryOrVaultSuccess();
      Sound.coreSeverBoom();
      GamepadSystem.rumble(1.0, 0.95, 260);
      triggerImpactFrame(3, "#ffd86b", bc.midX, bc.midY - 18);
      spawnDistortionRing(bc.midX, bc.midY, 245, "#ffd86b");
      arena.clashVfxList.push({ x: bc.midX, y: bc.midY - 12, r: 175, t: 0 });
      triggerKillCamStamp("拼刀破军");
      if (foe && foe.hp > 0) {
        const ang = Math.atan2(foe.y - p.y, foe.x - p.x);
        foe.swordMarks = 6;
        foe.posture = 0;
        foe.state = "stun";
        foe.executedThisStun = false;
        foe.timer = 4.0;
        damageEnemy(foe, Math.round(st.atk * 3.85), true, 88, ang, 18, true);
      }
      addFloat("💥 拼刀大胜 · 【破军反制斩】崩碎架势！！", p.x, p.y - 78, "#fff4b8", 23, true);
    } else {
      addRipple(p.x, p.y + 20, 85, "#ff7875");
      p.vx = -p.facing * 8;
      addFloat("剑罡震退！", p.x, p.y - 48, "#ffbe76", 16);
    }
    updateHud();
  }

  // Pillar 3B: Sanctum Dojo 8-Second Ghost Recording & Playback (`剑道留影 Ghost 残影陪练`)
  function startGhostRecording() {
    if (!game) return;
    const gr = arena.ghostRecorder;
    gr.recording = true;
    gr.playing = false;
    gr.elapsed = 0;
    gr.frames = [];
    syncGhostButtonsUi();
    Sound.bianzhong(587.33, 0.09);
    showToast("⏺ 已开启 8 秒【剑道留影】录制：尽情施展连招、御空与魂印，录满自动同屏循环回放！");
  }

  function toggleGhostPlayback(force = null) {
    if (!game) return;
    const gr = arena.ghostRecorder;
    if (gr.recording && gr.frames.length >= 6) {
      gr.recording = false;
      gr.playing = true;
      gr.playTime = 0;
      syncGhostButtonsUi();
      showToast(`👻 剑道留影录制完成（${(gr.elapsed || 0).toFixed(1)}s）· 金色残影已开始同屏陪练回放！`);
      return;
    }
    if (!gr.frames || gr.frames.length < 6) {
      // Seed an 8-second Grandmaster Demonstration Ghost if player hasn't recorded one yet!
      const p = arena.player;
      gr.frames = [];
      for (let i = 0; i <= 160; i++) {
        const t = i * 0.05;
        const a = t * 1.6;
        const jumpArc = (t > 2.2 && t < 3.4) ? Math.sin(((t - 2.2) / 1.2) * Math.PI) * 64 : 0;
        gr.frames.push({
          t,
          x: p.x + Math.cos(a) * 85,
          y: p.y + Math.sin(a * 2) * 42,
          z: jumpArc,
          facing: Math.cos(a + 1.57) >= 0 ? 1 : -1,
          posture: t > 4.2 ? "xuanzhong" : "qinglian",
          slash: i % 12 === 0,
          soul: i === 65
        });
      }
      gr.elapsed = 8.0;
    }
    gr.recording = false;
    gr.playing = force !== null ? force : !gr.playing;
    gr.playTime = 0;
    syncGhostButtonsUi();
    if (gr.playing) showToast("👻 已唤出【剑道留影 · 金色演武残影】同屏循环回放！");
  }

  function syncGhostButtonsUi() {
    const gr = arena.ghostRecorder;
    const rBtn = document.getElementById("btn-ghost-record");
    const pBtn = document.getElementById("btn-ghost-play");
    if (rBtn) {
      rBtn.classList.toggle("active", !!gr.recording);
      rBtn.textContent = gr.recording ? `⏺ 录制中 ${(8 - gr.elapsed).toFixed(1)}s` : "⏺ 剑道留影(8s)";
    }
    if (pBtn) {
      pBtn.classList.toggle("active", !!gr.playing);
      pBtn.textContent = gr.playing ? "👻 残影回放 ON" : "👻 残影陪练";
    }
  }

  function stepGhostRecorder(dt) {
    const gr = arena.ghostRecorder;
    if (!gr || !game) return;
    const p = arena.player;
    if (gr.recording) {
      gr.elapsed += dt;
      if (gr.frames.length === 0 || gr.elapsed - gr.frames[gr.frames.length - 1].t >= 0.045) {
        gr.frames.push({
          t: gr.elapsed,
          x: p.x, y: p.y, z: p.z || 0,
          facing: p.facing,
          posture: arena.weaponPosture,
          slash: p.slashCd > 0.10,
          soul: (arena.soulAvatars && arena.soulAvatars.length > 0)
        });
      }
      syncGhostButtonsUi();
      if (gr.elapsed >= 8.0) {
        gr.recording = false;
        gr.playing = true;
        gr.playTime = 0;
        syncGhostButtonsUi();
        Sound.fanfare();
        showToast("👻 8秒【剑道留影】录制圆满！已自动开启金色演武残影循环陪练！");
      }
    } else if (gr.playing && gr.frames.length >= 2) {
      const dur = Math.max(0.5, gr.frames[gr.frames.length - 1].t);
      gr.playTime = (gr.playTime + dt) % dur;
    }
  }

  function getActiveGhostSample() {
    const gr = arena.ghostRecorder;
    if (!gr || !gr.playing || !gr.frames || gr.frames.length < 2) return null;
    const t = gr.playTime;
    for (let i = 0; i < gr.frames.length - 1; i++) {
      const f0 = gr.frames[i], f1 = gr.frames[i + 1];
      if (t >= f0.t && t <= f1.t) {
        const u = (f1.t > f0.t) ? (t - f0.t) / (f1.t - f0.t) : 0;
        return {
          x: f0.x + (f1.x - f0.x) * u,
          y: f0.y + (f1.y - f0.y) * u,
          z: f0.z + (f1.z - f0.z) * u,
          facing: f0.facing,
          posture: f0.posture,
          slash: f0.slash,
          soul: f0.soul
        };
      }
    }
    return gr.frames[0];
  }

  // Pillar 4A: Celestial 28-Constellation Astrolabe Modal (`太虚周天二十八星宿天命盘`)
  function openStarChartModal() {
    if (!game) return;
    if (!guardEcosystemAccess("star_chart")) return;
    notifyUnlockCardTried("star_chart");
    closeDrawer();
    if (!Array.isArray(game.litStars)) game.litStars = [];
    const freePts = getAvailableStarPoints(game);
    const sb = getStarChartBonuses(game);
    const celPh = getCurrentCelestialPhase();
    const isStarNight = celPh.id === "star_night";
    const celUnlocked = isActionUnlockedByRealm(game, "celestial_time");

    openModal(`
      <div class="drawer-mural-banner" style="height:104px;">
        <img src="${ART.banner_star_chart}" alt="太虚周天二十八星宿天命盘" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">周天星宿 · 四象共鸣</span>
            <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:4px;">太虚周天星图 · 二十八星宿天命盘（已耀 ${game.litStars.length}/28 宿）</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">收卷 ✕</button>
        </div>
      </div>

      <div class="jade-card" style="flex-direction:row;justify-content:space-between;align-items:center;padding:8px 12px;flex-wrap:wrap;gap:8px;">
        <div style="font-size:11.5px;color:#dff7f2;">
          可用星魂点：<strong style="color:#ffe28a;font-size:14px;">${freePts}</strong> 点
          <span style="color:var(--text-sub);margin-left:8px;">星盘总加成：攻+${sb.atk} · 血+${sb.hp} · 减伤+${sb.dr} · 暴+${Math.round(sb.crit * 100)}% · 暴伤+${Math.round(sb.critMult * 100)}%</span>
        </div>
        <button type="button" class="btn-gold" style="padding:4px 12px;font-size:11.5px;" data-action="buy-star-point">✨ 凝炼星魂 +1 (60灵石)</button>
      </div>

      <div id="star-chart-celestial-banner" class="jade-card" style="flex-direction:row;justify-content:space-between;align-items:center;padding:7px 11px;flex-wrap:wrap;gap:8px;border-color:${isStarNight ? "rgba(168,184,255,0.72)" : "rgba(216,179,106,0.34)"};">
        <div style="font-size:11px;color:#dff7f2;">
          当前太虚天时：<strong style="color:${celPh.color};">${escapeHtml(celPh.short)}</strong>
          <span class="tag-chip ${isStarNight ? "mythic" : ""}" style="margin-left:6px;">${isStarNight ? "★ 极夜星河联动生效 · 全部星宿被动 ×2.0！" : "切换至【极夜星河】可令全部星宿被动翻倍 (×2.0)"}</span>
        </div>
        <button type="button" id="btn-star-chart-cycle-celestial" class="${celUnlocked ? "btn-jade" : "btn-ghost eco-locked-btn"}" style="padding:3px 10px;font-size:11px;" data-action="cycle-celestial-time-in-modal">${celUnlocked ? "☯ 流转天时 (\\)" : "🔒 需金丹期解封天时"}</button>
      </div>

      <div class="star-quad-grid">
        ${STAR_QUADRANTS.map(q => {
          const litCnt = q.mansions.filter(m => game.litStars.includes(m.id)).length;
          const coreOn = litCnt >= 4;
          return `
            <div class="star-quad-card ${coreOn ? "awakened" : ""}">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="font-family:var(--font-serif);font-size:13.5px;color:${q.color};">${q.name} (${litCnt}/7)</strong>
                <span class="tag-chip ${coreOn ? "mythic" : ""}">${coreOn ? "★ 星魂已觉醒" : `差${4 - litCnt}宿醒星魂`}</span>
              </div>
              <div style="font-size:10.5px;color:${coreOn ? "#9effec" : "var(--text-sub)"};line-height:1.35;">${q.coreDesc}</div>
              <div class="mansion-node-row">
                ${q.mansions.map(m => {
                  const isLit = game.litStars.includes(m.id);
                  return `<button type="button" class="mansion-node-btn ${isLit ? "lit" : ""}" data-light-star="${m.id}" data-tip="${escTip(m.name, m.statTxt)}">${isLit ? "★ " : "○ "}${m.name}·${m.statTxt}</button>`;
                }).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `, true);
  }

  // ==================== V16+V17 CONSOLE INPUT BUFFER, GAMEPAD RUMBLE, KEYBINDS, ELEMENTAL PROPS, DOJO & ULTIMATES ====================
  const KEYBIND_STORAGE_KEY = "chenyuan_keybinds_v22";
  const DEFAULT_KEYBINDS = {
    posture:   { label: "双姿态易剑斩", kb: "Backquote", mouseLabel: null,   padBtn: 4,    padGlyph: "LB" },
    soul:      { label: "太虚镇妖魂印", kb: "KeyC",      mouseLabel: null,   padBtn: 5,    padGlyph: "RB" },
    slash:     { label: "四段轻剑连招", kb: "KeyI",      mouseLabel: "左键", padBtn: 2,    padGlyph: "X" },
    astral:    { label: "法天象地真身", kb: "KeyO",      mouseLabel: null,   padBtn: 11,   padGlyph: "R3" },
    mount:     { label: "山海神兽灵骑", kb: "KeyJ",      mouseLabel: null,   padBtn: 8,    padGlyph: "View" },
    qimen:     { label: "奇门八门阵盘", kb: "KeyU",      mouseLabel: null,   padBtn: null, padGlyph: "未绑" },
    recall:    { label: "切手重击/爆剑", kb: "KeyK",     mouseLabel: "右键", padBtn: 3,    padGlyph: "Y" },
    dash:      { label: "识破剑反/一闪", kb: "Space",    mouseLabel: null,   padBtn: 0,    padGlyph: "A" },
    stance:    { label: "三才剑阵切换", kb: "KeyY",      mouseLabel: null,   padBtn: 1,    padGlyph: "B" },
    ult:       { label: "本命法宝剑域", kb: "KeyE",      mouseLabel: null,   padBtn: 13,   padGlyph: "↓" },
    finisher:  { label: "流派终极奥义", kb: "KeyX",      mouseLabel: null,   padBtn: 7,    padGlyph: "RT" },
    tagSwitch: { label: "道侣同心瞬切", kb: "KeyV",      mouseLabel: null,   padBtn: 15,   padGlyph: "→" },
    ally:      { label: "故人真身助阵", kb: "KeyR",      mouseLabel: null,   padBtn: 16,   padGlyph: "Guide" },
    pet:       { label: "灵宠觉醒绝技", kb: "KeyG",      mouseLabel: null,   padBtn: 6,    padGlyph: "LT" },
    meditate:  { label: "周天吐纳 / 满修渡劫", kb: "KeyB",      mouseLabel: null,   padBtn: 9,    padGlyph: "Menu" },
    pill:      { label: "饮仙葫 / 空葫服回春丹", kb: "KeyQ",      mouseLabel: null,   padBtn: 12,   padGlyph: "↑" },
    jump:      { label: "御风腾跃/踏剑", kb: "KeyZ",     mouseLabel: null,   padBtn: 10,   padGlyph: "L3" },
    swordBlink:{ label: "飞剑缩地瞬身", kb: "KeyF",      mouseLabel: "中键", padBtn: 14,   padGlyph: "←" },
    photo:     { label: "太虚摄影模式", kb: "KeyP",      mouseLabel: null,   padBtn: null, padGlyph: "未绑" },
    hub:       { label: "往返听雨洞府", kb: "KeyH",      mouseLabel: null,   padBtn: null, padGlyph: "未绑" },
    telemetry: { label: "3A动作遥测窗", kb: "F3",        mouseLabel: null,   padBtn: null, padGlyph: "未绑" }
  };
  let keybinds = JSON.parse(JSON.stringify(DEFAULT_KEYBINDS));
  let rumbleEnabled = true;
  let rebindListeningAction = null;
  let lastKeybindConflictMsg = "";

  function loadKeybinds() {
    try {
      const raw = localStorage.getItem(KEYBIND_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.binds && typeof parsed.binds === "object" && !Array.isArray(parsed.binds)) {
          const acts = Object.keys(DEFAULT_KEYBINDS);
          acts.forEach(act => {
            const def = DEFAULT_KEYBINDS[act];
            const next = safeAssignPlain({}, def);
            const saved = hasOwn(parsed.binds, act) ? parsed.binds[act] : null;
            if (saved && typeof saved === "object" && !Array.isArray(saved)) {
              if (typeof saved.kb === "string" && /^[A-Za-z0-9]{1,24}$/.test(saved.kb)) {
                // Migrate legacy Tab bind so browser focus navigation is never hijacked
                next.kb = saved.kb === "Tab" ? def.kb : saved.kb;
              }
              if (saved.padBtn === null) {
                next.padBtn = null;
                next.padGlyph = "未绑";
              } else if (typeof saved.padBtn === "number" && Number.isInteger(saved.padBtn) && saved.padBtn >= 0 && saved.padBtn <= 31) {
                next.padBtn = saved.padBtn;
                next.padGlyph = PAD_GLYPH_MAP[saved.padBtn] || `B${saved.padBtn}`;
              }
            }
            keybinds[act] = next;
          });
          // Deduplicate gamepad buttons: prioritize actions whose DEFAULT_KEYBINDS padBtn matches (fixes legacy qimen/swordBlink padBtn=14 migration)
          const usedPadBtns = new Set();
          acts.forEach(act => {
            const pb = keybinds[act].padBtn;
            if (typeof pb === "number" && pb === DEFAULT_KEYBINDS[act].padBtn && !usedPadBtns.has(pb)) {
              usedPadBtns.add(pb);
            }
          });
          acts.forEach(act => {
            const pb = keybinds[act].padBtn;
            if (typeof pb === "number" && pb !== DEFAULT_KEYBINDS[act].padBtn) {
              if (usedPadBtns.has(pb)) {
                keybinds[act].padBtn = null;
                keybinds[act].padGlyph = "未绑";
              } else {
                usedPadBtns.add(pb);
              }
            }
          });
        }
        if (typeof parsed.rumbleEnabled === "boolean") rumbleEnabled = parsed.rumbleEnabled;
      }
    } catch (e) {}
  }
  function saveKeybinds() {
    try {
      localStorage.setItem(KEYBIND_STORAGE_KEY, JSON.stringify({ binds: keybinds, rumbleEnabled }));
    } catch (e) {}
  }
  function formatKeyCodeShort(code) {
    if (!code) return "-";
    if (code === "Space") return "空格";
    if (code === "Backquote") return "`";
    if (code === "Backslash") return "\\";
    if (code.startsWith("Key")) return code.slice(3);
    if (code.startsWith("Digit")) return code.slice(5);
    if (code.startsWith("Arrow")) return ({ ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" })[code] || code;
    return code;
  }
  function syncSkillOrbKeyCaps() {
    const isPad = GamepadSystem.inputMode === "pad";
    document.querySelectorAll("[data-bind-cap]").forEach(el => {
      const act = el.getAttribute("data-bind-cap");
      const cfg = keybinds[act];
      if (!cfg) return;
      if (isPad) {
        el.textContent = cfg.padGlyph || (cfg.padBtn != null ? `B${cfg.padBtn}` : "未绑");
      } else {
        el.textContent = (cfg.mouseLabel && cfg.kb === DEFAULT_KEYBINDS[act].kb) ? cfg.mouseLabel : formatKeyCodeShort(cfg.kb);
      }
    });
  }
  function applyKeybindRemap(targetAct, newCode) {
    const reserved = ["Escape", "Tab", "KeyW", "KeyA", "KeyS", "KeyD"];
    if (reserved.includes(newCode)) {
      lastKeybindConflictMsg = `⚠ 【${formatKeyCodeShort(newCode)}】为移动或系统保留键，请换用其他按键！`;
      showToast(lastKeybindConflictMsg);
      return false;
    }
    const prevCode = keybinds[targetAct].kb;
    let swappedWith = null;
    Object.keys(keybinds).forEach(otherAct => {
      if (otherAct !== targetAct && keybinds[otherAct].kb === newCode) {
        keybinds[otherAct].kb = prevCode;
        swappedWith = keybinds[otherAct].label;
      }
    });
    keybinds[targetAct].kb = newCode;
    if (swappedWith) {
      lastKeybindConflictMsg = `⚡ 检测到键位冲突：已自动无损互换【${keybinds[targetAct].label}】↔【${swappedWith}】！`;
      showToast(lastKeybindConflictMsg);
    } else {
      lastKeybindConflictMsg = `✓ 已将【${keybinds[targetAct].label}】绑定为 [${formatKeyCodeShort(newCode)}]`;
      showToast(lastKeybindConflictMsg);
    }
    saveKeybinds();
    syncSkillOrbKeyCaps();
    return true;
  }
  function resetAllKeybinds() {
    keybinds = JSON.parse(JSON.stringify(DEFAULT_KEYBINDS));
    lastKeybindConflictMsg = "↺ 已恢复全部默认键鼠与手柄键位配置";
    saveKeybinds();
    syncSkillOrbKeyCaps();
    showToast(lastKeybindConflictMsg);
  }

  // W3C Gamepad API + Dual-Rumble Haptic Feedback Engine
  const PAD_GLYPH_MAP = { 0: "A", 1: "B", 2: "X", 3: "Y", 4: "LB", 5: "RB", 6: "LT", 7: "RT", 8: "View", 9: "Menu", 10: "L3", 11: "R3", 12: "↑", 13: "↓", 14: "←", 15: "→", 16: "Guide" };
  const GamepadSystem = {
    inputMode: "kb",
    connectedName: null,
    prevBtns: {},
    moveX: 0,
    moveY: 0,
    lastRumble: { weak: 0, strong: 0, ms: 0, ts: 0 },
    setMode(mode) {
      if (this.inputMode !== mode) {
        this.inputMode = mode;
        syncSkillOrbKeyCaps();
      }
    },
    rumble(weak = 0.4, strong = 0.3, duration = 90) {
      if (!rumbleEnabled) return;
      this.lastRumble = { weak, strong, ms: duration, ts: performance.now() };
      try {
        if (!navigator.getGamepads) return;
        const pads = navigator.getGamepads() || [];
        for (const pad of pads) {
          if (!pad || !pad.connected) continue;
          if (pad.vibrationActuator && typeof pad.vibrationActuator.playEffect === "function") {
            pad.vibrationActuator.playEffect("dual-rumble", {
              startDelay: 0,
              duration,
              weakMagnitude: Math.min(1, Math.max(0, weak)),
              strongMagnitude: Math.min(1, Math.max(0, strong))
            }).catch(() => {});
          } else if (pad.hapticActuators && pad.hapticActuators[0] && pad.hapticActuators[0].pulse) {
            pad.hapticActuators[0].pulse(Math.min(1, Math.max(weak, strong)), duration).catch(() => {});
          }
        }
      } catch (e) {}
    },
    poll() {
      this.moveX = 0; this.moveY = 0;
      let pads = null;
      try { pads = navigator.getGamepads ? navigator.getGamepads() : null; } catch (e) { return; }
      if (!pads) return;
      const pad = Array.from(pads).find(p => p && p.connected);
      if (!pad) { this.connectedName = null; return; }
      this.connectedName = pad.id || "标准手柄";

      const ax0 = pad.axes[0] || 0, ax1 = pad.axes[1] || 0;
      const ax2 = pad.axes[2] || 0, ax3 = pad.axes[3] || 0;
      if (Math.hypot(ax0, ax1) > 0.18) {
        this.moveX = ax0; this.moveY = ax1;
        this.setMode("pad");
      }
      if (Math.hypot(ax2, ax3) > 0.25 && arena.player) {
        pointer.x = arena.player.x + ax2 * 220;
        pointer.y = arena.player.y + ax3 * 160;
        this.setMode("pad");
      }

      pad.buttons.forEach((btn, bIdx) => {
        const pressed = typeof btn === "object" ? (btn.pressed || btn.value > 0.55) : btn > 0.55;
        const was = !!this.prevBtns[bIdx];
        if (pressed && !was) {
          this.setMode("pad");
          if (rebindListeningAction) {
            const prevPadBtn = keybinds[rebindListeningAction].padBtn;
            const prevPadGlyph = keybinds[rebindListeningAction].padGlyph;
            Object.keys(keybinds).forEach(otherAct => {
              if (otherAct !== rebindListeningAction && keybinds[otherAct].padBtn === bIdx) {
                keybinds[otherAct].padBtn = prevPadBtn;
                keybinds[otherAct].padGlyph = prevPadBtn != null ? (PAD_GLYPH_MAP[prevPadBtn] || prevPadGlyph || `B${prevPadBtn}`) : "未绑";
              }
            });
            keybinds[rebindListeningAction].padBtn = bIdx;
            keybinds[rebindListeningAction].padGlyph = PAD_GLYPH_MAP[bIdx] || `B${bIdx}`;
            lastKeybindConflictMsg = `🎮 已将【${keybinds[rebindListeningAction].label}】手柄键设为 [${keybinds[rebindListeningAction].padGlyph}]`;
            rebindListeningAction = null;
            saveKeybinds(); syncSkillOrbKeyCaps(); openSettingsModal();
          } else if (game && !arena.paused) {
            Object.entries(keybinds).forEach(([act, cfg]) => {
              if (cfg.padBtn === bIdx) triggerMappedAction(act);
            });
          }
        }
        this.prevBtns[bIdx] = pressed;
      });
    }
  };
  window.addEventListener("gamepadconnected", (e) => {
    GamepadSystem.connectedName = (e.gamepad && e.gamepad.id) || "无线手柄";
    GamepadSystem.setMode("pad");
    showToast("🎮 手柄已即插即用连接 · 已启用高低频双马达震动与动态手柄键标！");
  });
  window.addEventListener("gamepaddisconnected", () => {
    GamepadSystem.connectedName = null;
    GamepadSystem.setMode("kb");
  });

  // 140ms Console Input Buffer Queue + Soft Target-Lock Micro-Magnetism
  function pushTelemetryInput(tag, isBuffered = false) {
    arena.inputChain.push({ tag, isBuffered, ts: performance.now() });
    if (arena.inputChain.length > 5) arena.inputChain.shift();
  }

  function recordDamageTelemetry(dmg, bucket = null) {
    if (!dmg || dmg <= 0) return;
    const b = bucket || arena.currentDmgBucket || "combo_morph";
    arena.dmgBreakdown[b] = (arena.dmgBreakdown[b] || 0) + dmg;
    if (dmg > (arena.peakHit || 0)) arena.peakHit = dmg;
    arena.dmgRolling.push({ t: performance.now(), d: dmg });
    if (arena.dmgRolling.length > 180) arena.dmgRolling.shift();
  }

  function resetDamageTelemetry() {
    arena.dmgBreakdown = { combo_morph: 0, flying_swords: 0, thunder_elem: 0, ally_pet: 0, deflect_ult: 0 };
    arena.dmgRolling = [];
    arena.peakHit = 0;
    arena.parryCount = 0;
    arena.witchCount = 0;
    arena.inputChain = [{ tag: "统计已清零", isBuffered: false, ts: performance.now() }];
  }

  function acquireSoftLockTarget(sx, sy, rawAng) {
    const candidates = [];
    arena.enemies.forEach(e => {
      if (e.hp > 0) candidates.push({ obj: e, isProp: false, prio: (e.state === "stun" ? 40 : 0) + (e.isBoss ? 20 : 0) });
    });
    arena.props.forEach(pr => {
      if (pr.destructible && pr.hp > 0) candidates.push({ obj: pr, isProp: true, prio: pr.kind === "ward_pylon" ? 35 : pr.kind === "bagua_secret_wall" ? 28 : 5 });
    });
    let best = null, bestScore = 999999;
    const coneLimit = GamepadSystem.inputMode === "pad" ? 1.45 : 1.08;
    for (const c of candidates) {
      const dx = c.obj.x - sx, dy = c.obj.y - sy;
      const d = Math.hypot(dx, dy);
      if (d > 255) continue;
      const tAng = Math.atan2(dy, dx);
      const aDiff = Math.abs(Math.atan2(Math.sin(tAng - rawAng), Math.cos(tAng - rawAng)));
      if (aDiff <= coneLimit || d < 95) {
        const score = d + aDiff * 95 - c.prio * 2.5;
        if (score < bestScore) { bestScore = score; best = c.obj; }
      }
    }
    arena.softLockTarget = best;
    return best;
  }

  function syncPostureBadgeHud() {
    const badge = document.getElementById("posture-switch-badge");
    const img = document.getElementById("posture-emblem-img");
    const nameEl = document.getElementById("posture-name-txt");
    const subEl = document.getElementById("posture-sub-txt");
    if (!badge || !nameEl || !subEl) return;
    const isHeavy = arena.weaponPosture === "xuanzhong";
    const p = arena.player;
    const inMorphWin = p && (p.comboWindow > 0.12 || p.dashTimer > 0 || arena.witchTime > 0) && (arena.switchMorphCd || 0) <= 0;
    badge.classList.toggle("posture-heavy", isHeavy);
    badge.classList.toggle("morph-window", !!inMorphWin);
    if (img) img.src = isHeavy ? ART.relic_jade_seal : ART.relic_frost_sword;
    nameEl.textContent = isHeavy ? "玄重巨阙式" : "青莲疾剑式";
    nameEl.style.color = isHeavy ? "#ffcc66" : "#70ffe6";
    subEl.innerHTML = inMorphWin
      ? `<strong style="color:#fff3b0;">⚡ 按\`/LB触发【太虚易剑斩】!</strong>`
      : (isHeavy ? "剑威+28% · 减伤+16 · 霸体破盾" : "攻速+14% · 移速+10% · 迅捷叠印");
  }

  function triggerPostureSwitch() {
    if (!game) return;
    const p = arena.player;
    const nextPosture = arena.weaponPosture === "qinglian" ? "xuanzhong" : "qinglian";
    const isHeavy = nextPosture === "xuanzhong";
    const canSwitchAttack = (p.comboWindow > 0.12 || p.dashTimer > 0 || arena.witchTime > 0 || p.invuln > 0.12) && (arena.switchMorphCd || 0) <= 0;

    arena.weaponPosture = nextPosture;
    if (p.meditating) toggleMeditation(false);
    Sound.switchStanceChime(isHeavy);

    if (canSwitchAttack) {
      // Seamless 【太虚易剑斩 (Switch-Stance Morph Attack)】!
      arena.switchMorphCd = 0.62;
      const st = getCombatStats(game);
      let ang = Math.atan2(pointer.y - p.y, pointer.x - p.x);
      const lockTgt = acquireSoftLockTarget(p.x, p.y, ang);
      if (lockTgt) ang = Math.atan2(lockTgt.y - p.y, lockTgt.x - p.x);
      p.facing = Math.cos(ang) >= 0 ? 1 : -1;

      // Leave glowing phantom & dash through!
      p.afterimages.push({ x: p.x, y: p.y, facing: p.facing, a: 0.92 });
      const canvas = document.getElementById("fx-canvas");
      const dashPos = clampToPlaza(p.x + Math.cos(ang) * 86, p.y + Math.sin(ang) * 56, canvas.width || 1440, canvas.height || 900);
      p.x = dashPos.x; p.y = dashPos.y;
      p.invuln = Math.max(p.invuln, 0.36);

      // Seamlessly chain into Step 2 of the new posture + restore Sword Intent & MP!
      p.comboStep = 1;
      p.comboWindow = 1.35;
      p.slashCd = 0.04;
      arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 18);
      game.mp = Math.min(st.maxMp, (game.mp || 0) + 14);

      arena.switchVfxList.push({ x: p.x, y: p.y, r: 128, t: 0, rot: ang });
      spawnDistortionRing(p.x, p.y, 195, isHeavy ? "#ffb84d" : "#70ffe6");
      pushBladeArc(p.x, p.y, ang, 152, isHeavy ? "#ffb84d" : "#70ffe6", 1, true);
      pushBladeArc(p.x, p.y, ang + Math.PI, 118, isHeavy ? "#70ffe6" : "#ffe28a", -1, true);
      addDecal(p.x, p.y + 14, ang, 66, "spider_crack");

      arena.hitStop = 0.075;
      arena.shake = 13;
      arena.camZoom = 1.07;
      GamepadSystem.rumble(0.78, 0.68, 145);
      registerStyleAction("switch_slash", 135);
      enqueueSanqingEchoAction("switch_slash", { ang });
      stampNextShanheMantra(p.x, p.y);
      addFloat(`☯ 太虚易剑斩 · 转【${isHeavy ? "玄重巨阙" : "青莲疾剑"}】！`, p.x, p.y - 62, isHeavy ? "#ffd278" : "#70ffe6", 20, true);

      const prevB = arena.currentDmgBucket;
      arena.currentDmgBucket = "combo_morph";
      arena.enemies.slice().forEach(e => {
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 148) {
          e.swordMarks = Math.min(6, (e.swordMarks || 0) + 2);
          e.switchBreakHit = true;
          damageEnemy(e, Math.round(st.atk * 2.85), true, 54, ang, 13.5, true);
          e.switchBreakHit = false;
        }
      });
      arena.props.slice().forEach(pr => {
        if (pr.destructible && pr.hp > 0 && Math.hypot(pr.x - p.x, pr.y - p.y) < pr.r + 135) {
          damageBattleProp(pr, st.atk * 2.4);
        }
      });
      arena.currentDmgBucket = prevB;
    } else {
      addRipple(p.x, p.y + 24, 58, isHeavy ? "#ffb84d" : "#70ffe6");
      addFloat(isHeavy ? "⚔ 易剑 · 【玄重巨阙式】(霸体崩盾)" : "🍃 易剑 · 【青莲疾剑式】(高频迅捷)", p.x, p.y - 52, isHeavy ? "#ffcc66" : "#70ffe6", 17, true);
    }
    syncPostureBadgeHud();
    updateHud();
  }

  function severBossWeakpoint(e, st) {
    if (!e || e.partSevered) return;
    e.partSevered = true;
    e.partHp = 0;
    e.weakpointExposed = false;
    const wpSpec = BOSS_WEAKPOINTS[e.id] || { partName: "护体妖核", severDesc: "重创本源妖脉" };

    Sound.coreSeverBoom();
    GamepadSystem.rumble(1.0, 1.0, 310);
    triggerImpactFrame(3, "#ff3b30", e.x, e.y - 24);
    spawnDistortionRing(e.x, e.y, 250, "#ff6b6b");
    triggerKillCamStamp("妖脉寸断");
    if (getKarmaState(game).mode === "demonic") {
      game.hp = Math.min(st.maxHp, game.hp + Math.round(st.maxHp * 0.12));
    }
    arena.shake = 18;
    arena.flash = 0.40;
    arena.flashColor = "#ffe2b8";
    addDecal(e.x, e.y + 14, 0, 84, "spider_crack");
    spawnSparks(e.x, e.y - 12, 28, 0, 6.28, "#ff9f43");

    // Instant full posture break + 16% maxHp true sever burst!
    const severDmg = Math.max(45, Math.round(e.maxHp * 0.16));
    e.hp = Math.max(1, e.hp - severDmg);
    recordDamageTelemetry(severDmg, "deflect_ult");
    e.state = "stun";
    e.executedThisStun = false;
    e.timer = 4.2;
    e.posture = e.maxPosture;
    e.mirrorTimer = 0;
    e.wardHp = 0;
    if (arena.bossRush && arena.bossRush.active) arena.bossRush.partBreaks += 1;

    // Guaranteed Sacred Heaven-Craft Material Drop (`天工神髓 · 鸿蒙妖丹`) — suppressed in Practice Mode!
    if (!isPracticeModeActive()) {
      arena.drops.push({ kind: "sacred_core", x: e.x + 18, y: e.y - 6, vx: 2.2, vy: -2.0, val: 1, partName: wpSpec.shortName || wpSpec.partName });
    }
    addFloat(`💥 部位击破【${wpSpec.partName}】· ${wpSpec.severDesc}！`, e.x, e.y - e.r - 48, "#ffbe76", 21, true);
    showToast(isPracticeModeActive()
      ? `★ 练习演武 · 妖脉寸断！已废除${e.name}危招（练习模式不掉落天工神髓）！`
      : `★ 妖脉寸断！已永久废除${e.name}危招，爆出【天工神髓】！`);
  }

  let practiceFormalSnapshot = null;

  function isPracticeModeActive() {
    if (!game) return false;
    const ws = document.getElementById("welcome-screen");
    if (ws && ws.style.display !== "none") return false;
    return Boolean(
      (arena.bossRush && arena.bossRush.active && (arena.bossRush.practiceMode || (arena.bossRush.startBout && arena.bossRush.startBout > 1))) ||
      (arena.celestialSpire && arena.celestialSpire.active && (arena.celestialSpire.practiceMode || (arena.celestialSpire.startFloor && arena.celestialSpire.startFloor > 1))) ||
      (arena.customSeedRun && arena.customSeedRun.active)
    );
  }

  function beginPracticeModeIsolation() {
    if (sandboxMode || !game) return false;
    if (!practiceFormalSnapshot) {
      practiceFormalSnapshot = {
        game: JSON.parse(JSON.stringify(game)),
        meta: JSON.parse(JSON.stringify(ensureMetaState())),
        stageIdx: arena.stageIdx,
        stanceIdx: arena.stanceIdx,
        towerMode: !!arena.towerMode,
        sanctumMode: !!arena.sanctumMode
      };
    }
    return true;
  }

  function endPracticeModeIsolation(opts = {}) {
    if (!practiceFormalSnapshot) return false;
    const snap = practiceFormalSnapshot;
    practiceFormalSnapshot = null;
    if (!sandboxMode && !(opts && opts.discardRestore)) {
      if (snap.game) {
        const restored = normalizeLoadedGame(JSON.parse(JSON.stringify(snap.game)));
        if (game && typeof game === "object") {
          Object.keys(game).forEach(k => { if (!(k in restored)) delete game[k]; });
          Object.assign(game, restored);
        } else {
          game = restored;
        }
      }
      if (snap.meta) {
        Object.keys(metaState).forEach(k => { if (!(k in snap.meta)) delete metaState[k]; });
        safeAssignPlain(metaState, JSON.parse(JSON.stringify(snap.meta)));
        ensureMetaState();
      }
      // DEFECT-R2-2C: Re-merge live disk META_KEY so cross-tab meta progress written during Practice Mode is never regressed!
      inspectMetaState({ applyToMemory: true });
      if (typeof computeCurrentPayloadChecksum === "function") {
        lastSavedPayloadChecksum = computeCurrentPayloadChecksum();
      }
    }
    // R3B-3: Purge any runtime combat overdrive (astralEnergy, astralForm, sanqingState, shanheDomain, soak timers) gained in Practice Mode!
    if (!sandboxMode && !(opts && opts.skipResetOverrides) && typeof resetRuntimeCombatOverrides === "function") {
      resetRuntimeCombatOverrides();
    }
    return true;
  }

  function purgeTransientCombatEntities(opts = {}) {
    const clearPlayerBuffs = Boolean(opts && opts.clearPlayerBuffs);
    const clearOverdriveCds = Boolean(opts && opts.clearOverdriveCds);
    // R6B-3: Purge ALL 7 active overdrive/genesis/tactical entities
    arena.astralForm = null;
    const sq = ensureSanqingState();
    sq.active = false;
    sq.life = 0;
    sq.swapUsed = false;
    if (Array.isArray(sq.clones)) {
      sq.clones.forEach(cl => { if (cl) cl.lungeT = 0; });
    }
    arena.sanqingEchoQueue = [];
    arena.shanheDomain = null;
    arena.warshipStrike = null;
    arena.mountState = null;
    arena.pillAcolyte = null;
    arena.spatialRifts = [];
    if (clearOverdriveCds) {
      arena.sanqingCd = 0;
      arena.shanheCd = 0;
      arena.warshipCd = 0;
    }
    // R5B-1 / R6B-3: Purge ALL 16 temporary active fields, domains, summoned allies, zones & projectiles
    arena.qimenArray = null;
    arena.qimenCd = 0;
    arena.domain = null;
    arena.activeAllies = [];
    arena.zones = [];
    arena.witchTime = 0;
    arena.lotusVortexes = [];
    arena.thunderOrbs = [];
    arena.jadeDecoys = [];
    arena.fireZones = [];
    arena.waterPools = [];
    arena.frostPools = [];
    arena.projectiles = [];
    arena.hoverChakrams = [];
    arena.groundSweeps = [];
    arena.meteorBursts = [];
    arena.bossDomain = null;
    arena.reversedDomainTimer = 0;
    if (clearPlayerBuffs && arena.player) {
      arena.player.invuln = 0;
      arena.player.shieldHp = 0;
      arena.player.hyperArmorTimer = 0;
      arena.player.samadhiFireReady = false;
      arena.player.gourdHasteTimer = 0;
      arena.player.gourdCritTimer = 0;
      arena.player.petBuffTimer = 0;
      arena.player.boonOverloadTimer = 0;
      arena.player.guardShieldCd = 0;
      arena.player.zenStacks = 0;
    }
    if (typeof syncV23EpochDock === "function") syncV23EpochDock();
    if (typeof syncV24GenesisDock === "function") syncV24GenesisDock();
    if (typeof syncV22TacticalDock === "function") syncV22TacticalDock();
    if (typeof updateCooldownMasks === "function") updateCooldownMasks();
  }

  function resetSanctumDojoCombatGauges() {
    // R4B-2 / R6B-3: Purge ALL temporary Sanctum Dojo gauges, overdrive & Gourd soak/shield/invuln buffs when leaving Sanctum Hub,
    // without altering legitimate persistent formal preferences (coop2P, playableCharId, weaponForm, weaponPosture).
    arena.swordIntent = 0;
    arena.bondSynergy = 0;
    arena.styleScore = 0;
    arena.comboCount = 0;
    arena.astralEnergy = 0;
    purgeTransientCombatEntities({ clearPlayerBuffs: true, clearOverdriveCds: true });
  }

  function flushAndEndMeditation() {
    if (!game || !arena || !arena.player) return;
    if (arena.player.meditating) {
      toggleMeditation(false);
    } else if (arena.player.meditateAgedDirty) {
      arena.player.meditateAgedDirty = false;
      if (!sandboxMode && !isPracticeModeActive()) {
        saveGame();
      }
    }
    arena.player.meditating = false;
    arena.player.meditateAgeTick = 0;
    arena.player.meditateAgedDirty = false;
  }

  function guardNotInTribulation(actionLabel = "切换场景或挑战模式") {
    if (!(arena && arena.tribulation)) return true;
    showToast(`⚡ 正在【九霄紫霄雷劫】渡劫中，无法进行【${actionLabel}】！请迎雷破境或于力竭后主动抉择中止渡劫。`, {
      critical: true,
      key: "tribulation_guard",
      throttleMs: 1200
    });
    return false;
  }

  function guardNotInActiveTrialForTribulation() {
    // R4B-1: Prevent concurrent Live Tribulation inside active trial modes (Sect Defense / Cloud Sea / Boss Rush / Spire / Workshop)
    if (arena.sectDefense && arena.sectDefense.active) {
      showToast("⚠ 正在进行【护山大阵守卫战】，无法中途引动天劫！请先完成或撤离守卫战。");
      return false;
    }
    if (arena.cloudFlight && arena.cloudFlight.active) {
      showToast("⚠ 正在进行【九霄云海空战】，无法中途引动天劫！请先完成或撤离空战。");
      return false;
    }
    if (arena.bossRush && arena.bossRush.active) {
      showToast("⚠ 正在进行【万剑冢连战】，无法中途引动天劫！请先完成或退出试炼。");
      return false;
    }
    if (arena.celestialSpire && arena.celestialSpire.active) {
      showToast("⚠ 正在进行【太虚登仙台】试炼，无法中途引动天劫！请先完成或退出试炼。");
      return false;
    }
    if (arena.customSeedRun && arena.customSeedRun.active) {
      showToast("⚠ 正在进行【造化种子工坊】演武，无法引动天劫！请先按 H 返回听雨洞府。");
      return false;
    }
    if (arena.towerMode) {
      showToast("⚠ 正在挑战【镇魔塔】，无法中途引动天劫！请先按 H 返回听雨洞府。");
      return false;
    }
    return true;
  }

  function guardNotPracticeMode(actionLabel = "此项正式养成") {
    if (!isPracticeModeActive()) return true;
    showToast(`⚔ 演武练习模式中禁止进行【${actionLabel}】（不计寿元与正式存档），请先按 H 返回听雨洞府！`);
    return false;
  }

  function isNormalCampaignStage() {
    return Boolean(
      game &&
      !arena.sanctumMode &&
      !arena.towerMode &&
      !(arena.bossRush && arena.bossRush.active) &&
      !(arena.celestialSpire && arena.celestialSpire.active) &&
      !(arena.cloudFlight && arena.cloudFlight.active) &&
      !(arena.sectDefense && arena.sectDefense.active) &&
      !(arena.customSeedRun && arena.customSeedRun.active) &&
      !isPracticeModeActive() &&
      !sandboxMode
    );
  }
