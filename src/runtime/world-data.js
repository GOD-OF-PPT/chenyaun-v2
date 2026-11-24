  // ==================== 2. CELESTIAL OMENS & CORE WORLD DATA ====================
  // Shared single source of truth for combat rule parameters referenced by BOTH live formulas and copy builders (F06)

  function getLawLiveContributionText(g, lawId) {
    if (!g) return "";
    const P = COMBAT_RULE_PARAMS;
    if (lawId === "wealth_power") {
      const wp = P.laws.wealth_power;
      const rawPct = Math.min(wp.maxPct, Math.floor(Math.max(0, num(g.stones, 0)) / wp.perStones) * wp.pctPerStep);
      return `当前常驻池 +${Math.round(rawPct * 100)}% / 上限 +${Math.round(wp.maxPct * 100)}%`;
    }
    if (lawId === "age_might") {
      const am = P.laws.age_might;
      const years = Math.floor(((g.startAgeMonths || 216) + (g.elapsedMonths || 0)) / 12);
      const rawPct = Math.min(am.maxPct, Math.floor(Math.max(0, years - am.baseAge) / am.yearsPerStep) * am.pctPerStep);
      return `当前常驻池 +${Math.round(rawPct * 100)}% / 上限 +${Math.round(am.maxPct * 100)}%`;
    }
    if (lawId === "karma_resonance") {
      const kr = P.laws.karma_resonance;
      const rawPct = Math.min(kr.maxPct, Object.keys(g.choices || {}).length * kr.pctPerChoice);
      return `当前常驻池 +${Math.round(rawPct * 100)}% / 上限 +${Math.round(kr.maxPct * 100)}%`;
    }
    return "";
  }







  // ==================== 3. DAO LAWS, PAINTED SPIRIT PETS & ACHIEVEMENTS ====================

  // Uses our newly generated painted xianxia illustrations!

  // G10: Tiered Spirit Pet Feeding Costs (herb → core → core → jade) & Lv.3 / Lv.5 Skill Trees



  function getPetNextFeedCost(level) {
    const lv = Math.max(1, Math.min(5, Math.floor(num(level, 1))));
    return lv >= 5 ? null : (PET_FEED_COSTS[lv] || null);
  }

  function formatPetFeedCost(cost, inv = null) {
    if (!cost || !cost.mats) return "";
    return Object.entries(cost.mats).map(([mk, req]) => {
      const mName = (ITEMS[mk] && ITEMS[mk].name) || mk;
      if (!inv) return `${mName}×${req}`;
      const have = Math.max(0, Math.floor(num(inv[mk], 0)));
      return `${mName}×${req}(持${have})`;
    }).join(" + ");
  }

  function canAffordPetFeed(g) {
    if (!g || !g.pet || !g.pet.id) return false;
    const cost = getPetNextFeedCost(g.pet.level);
    if (!cost) return false;
    const inv = g.inventory || {};
    return Object.entries(cost.mats).every(([mk, req]) => Math.max(0, Math.floor(num(inv[mk], 0))) >= req);
  }

  function getPetFeedMissingSummary(g) {
    if (!g || !g.pet || !g.pet.id) return "";
    const cost = getPetNextFeedCost(g.pet.level);
    if (!cost) return "";
    const inv = g.inventory || {};
    const lacks = [];
    Object.entries(cost.mats).forEach(([mk, req]) => {
      const have = Math.max(0, Math.floor(num(inv[mk], 0)));
      if (have < req) {
        const mName = (ITEMS[mk] && ITEMS[mk].name) || mk;
        lacks.push(`${mName}×${req - have}`);
      }
    });
    return lacks.join("、");
  }


  function getPendingPetSkillTier(g) {
    if (!g || !g.pet || !g.pet.id) return null;
    const lv = Math.max(1, Math.floor(num(g.pet.level, 1)));
    const skills = g.pet.skills || {};
    if (lv >= 3 && (!skills.tier3 || !hasOwn(PET_SKILLS_BY_ID, skills.tier3))) return 3;
    if (lv >= 5 && (!skills.tier5 || !hasOwn(PET_SKILLS_BY_ID, skills.tier5))) return 5;
    return null;
  }

  function getPetChosenSkills(g) {
    const out = [];
    if (!g || !g.pet || !g.pet.id || !g.pet.skills) return out;
    const lv = Math.max(1, Math.floor(num(g.pet.level, 1)));
    if (lv >= 3 && g.pet.skills.tier3 && hasOwn(PET_SKILLS_BY_ID, g.pet.skills.tier3)) out.push(PET_SKILLS_BY_ID[g.pet.skills.tier3]);
    if (lv >= 5 && g.pet.skills.tier5 && hasOwn(PET_SKILLS_BY_ID, g.pet.skills.tier5)) out.push(PET_SKILLS_BY_ID[g.pet.skills.tier5]);
    return out;
  }

  const ACHIEVEMENTS = [
    { id: "ach_qi", name: "引气入道", desc: "冲破凡胎踏入炼气期", pts: 60 },
    { id: "ach_heaven_core", name: "天道一品", desc: "在紫霄雷劫中迎雷弹反或携丹护脉铸就【天道一品道基】", pts: 150 },
    { id: "ach_orb5", name: "天人交感", desc: "战中达成 5 连击以上触发剑意共振", pts: 100 },
    { id: "ach_combo", name: "剑符连携", desc: "在斗法中打出切手重派生或识破剑反", pts: 140 },
    { id: "ach_break", name: "一剑破势", desc: "首次击空妖兽架势或达成金芒识破剑反", pts: 110 },
    { id: "ach_coop", name: "故人同心", desc: "在斗法中召唤故人同心助阵", pts: 120 },
    { id: "ach_pill", name: "九转丹圣", desc: "控火炼出九转仙品云纹丹", pts: 140 },
    { id: "ach_pet3", name: "灵兽化形", desc: "将本命灵兽培育至 Lv.3 以上", pts: 130 },
    { id: "ach_jade", name: "赌石天眼", desc: "一剑切开鸿蒙原石领悟大道法则", pts: 140 },
    { id: "ach_exp", name: "星盘夺宝", desc: "成功荡平一座九州秘境并击败镇守妖王", pts: 160 },
    { id: "ach_laws5", name: "万法归一", desc: "单局集齐 5 道以上大道法则", pts: 220 },
    { id: "ach_tower5", name: "镇妖锋芒", desc: "太虚锁妖塔突破第 5 层", pts: 250 },
    { id: "ach_tower10", name: "独断太虚", desc: "太虚锁妖塔突破第 10 层", pts: 450 },
    { id: "ach_ascend", name: "叩开九霄门", desc: "渡过飞升天劫成功叩开九霄仙门", pts: 500 }
  ];

  const ENEMIES = {
    wolf:          { id: "wolf", name: "雾隐妖狼", min: "qi", location: "wilderness", art: "enemy_wolf", hp: 290, attack: 15, heavy: 28, stones: 24, xp: 22, loot: { core: 1, herb: 1 }, mech: null, mechDesc: "凶猛突进扑击：金芒蓄力时按【空格一闪】可识破剑反，红光血月爪需极限闪避触发凝时！" },
    warden:        { id: "warden", name: "守山石卫", min: "qi", location: "wilderness", art: "enemy_warden", hp: 460, attack: 18, heavy: 36, stones: 38, xp: 36, loot: { core: 2, dew: 1 }, mech: null, mechDesc: "重锤震地与下段裂地波：按【Z键御风腾跃】可踏剑跃破地脉波，重劈/爆剑可速破其金阵！" },
    serpent:       { id: "serpent", name: "寒潭玄蛇", min: "foundation", location: "secret", art: "enemy_serpent", hp: 680, attack: 21, heavy: 44, stones: 56, xp: 75, loot: { jade: 2, core: 1 }, mech: null, mechDesc: "盘踞古境寒潭并喷吐冰池弹幕：按【Y键切剑轮阵】斩碎弹幕，切手重击快速破势。" },
    puppet:        { id: "puppet", name: "古境剑傀", min: "golden", location: "secret", art: "enemy_puppet", hp: 960, attack: 25, heavy: 54, stones: 90, xp: 155, loot: { lotus: 2, jade: 1 }, mech: "reflection", mechDesc: "【镜照反震】展开铜镜架势时反弹轻剑伤害，宜用【空格一闪】或【右键爆剑】强破镜阵！" },
    shadow:        { id: "shadow", name: "照影心魇", min: "nascent", location: "secret", art: "enemy_shadow", hp: 1240, attack: 28, heavy: 64, stones: 140, xp: 310, loot: { soul: 2, lotus: 1 }, mech: "drain", mechDesc: "【噬血魔影】瞬步绕后突袭并吸血，看准金芒识破剑反或开【Y键剑轮阵】压制。" },
    sentinel:      { id: "sentinel", name: "云台守灵", min: "spirit", location: "terrace", art: "enemy_sentinel", hp: 1520, attack: 32, heavy: 72, stones: 195, xp: 520, loot: { dao: 2, soul: 1 }, mech: "ward", mechDesc: "【护山灵阵】护阵期大幅减伤，切【`玄重巨阙式】重劈或右键爆剑崩碎其金盾！" },
    trial_heart:   { id: "trial_heart", name: "第一劫 · 往昔心魔", min: "spirit", location: "terrace", art: "enemy_trial_heart", hp: 1380, attack: 30, heavy: 66, stones: 0, xp: 0, loot: {}, mech: "drain", mechDesc: "九霄第一劫：幻化执念噬血攻心，识破其蓄势方见真我。" },
    trial_thunder: { id: "trial_thunder", name: "第二劫 · 九霄雷劫", min: "spirit", location: "terrace", art: "enemy_trial_thunder", hp: 1620, attack: 33, heavy: 76, stones: 0, xp: 0, loot: {}, mech: null, mechDesc: "九霄第二劫：沈清禾【灵枢药阵】与裴照【剑痕】将在此劫显化护持！" },
    trial_gate:    { id: "trial_gate", name: "天门道影", min: "spirit", location: "terrace", art: "enemy_trial_gate", hp: 1820, attack: 36, heavy: 84, stones: 0, xp: 0, loot: {}, mech: "ward", mechDesc: "九霄终劫：倾尽双姿态连携、法宝剑域、灵兽与故人合击斩开仙门！" },
    sky_roc:       { id: "sky_roc",    name: "巡天金甲雷鹏将",   min: "golden", location: "terrace", art: "enemy_roc_sky_general", hp: 1200, attack: 28, heavy: 64, stones: 180, xp: 340, loot: { soul: 2, core: 2 }, mech: "sky_barrage", mechDesc: "【九霄巡天】振翅布下天雷激光网并攒射漫天雷球：按空格【滚筒侧闪】穿激光，按右键【太虚剑盾】将漫天法球原路震回破其金甲！" }
  };

  // ==================== 4. SINGLE SOURCE OF TRUTH: CAMPAIGN VOLUMES PROGRESSION (CAMPAIGN_ACTS) ====================
  const CAMPAIGN_ACTS = [
    {
      stageIdx: 0, id: "wilderness", actLabel: "第一卷", seal: "第一秘境",
      min: "mortal", targetRealm: "qi", loc: "wilderness",
      arenaArt: "arena_wilderness", particleKind: "rain_mist",
      shape: "diamond", rx: 0.37, ry: 0.31, cy: 0.54,
      name: "青岚破庙石坪", mapName: "青岚破庙",
      mapX: 18, mapY: 74, mapSub: "凡人试剑 · 雾隐狼王",
      poem: "山雨欲来风满袖 · 一剑惊鸿救故人",
      waves: [["wolf", "wolf", "wolf"], ["wolf", "wolf", "wolf"], ["wolf", "wolf", "warden"]],
      boss: "wolf", bossName: "雾隐狼王", bossTitle: "青岚妖魁 · 雾隐狼王",
      matDrops: ["herb", "dew"], bossMats: ["core", "dew"], dropPreview: "凝气草 · 晨曦灵露 · 妖核"
    },
    {
      stageIdx: 1, id: "sect", actLabel: "第二卷", seal: "第二秘境",
      min: "qi", targetRealm: "foundation", loc: "sect",
      arenaArt: "arena_sect", particleKind: "cloud_leaf",
      shape: "diamond", rx: 0.36, ry: 0.30, cy: 0.52,
      name: "青云八卦仙台", mapName: "青云外门",
      mapX: 35, mapY: 61, mapSub: "炼气问道 · 守山石卫",
      poem: "云海石阶闻道钟 · 镇山金卫试青锋",
      waves: [["wolf", "warden", "warden"], ["warden", "warden", "wolf"], ["warden", "serpent", "warden"]],
      boss: "warden", bossName: "守山石卫", bossTitle: "镇山金卫 · 守山石卫",
      matDrops: ["core", "dew", "herb"], bossMats: ["core", "dew", "jade"], dropPreview: "妖核 · 晨曦灵露 · 凝气草"
    },
    {
      stageIdx: 2, id: "secret", actLabel: "第三卷", seal: "第三秘境",
      min: "foundation", targetRealm: "golden", loc: "secret",
      arenaArt: "arena_secret", particleKind: "lotus_glow",
      shape: "diamond", rx: 0.36, ry: 0.30, cy: 0.53,
      name: "照影寒潭剑台", mapName: "照影寒潭",
      mapX: 59, mapY: 80, mapSub: "筑基秘境 · 寒潭玄蛇",
      poem: "幽潭冷月映青莲 · 玄蛇吐雾锁寒烟",
      waves: [["serpent", "serpent", "warden"], ["serpent", "puppet", "serpent"], ["serpent", "serpent", "puppet"]],
      boss: "serpent", bossName: "寒潭玄蛇", bossTitle: "寒鳞妖尊 · 寒潭玄蛇",
      matDrops: ["jade", "core"], bossMats: ["jade", "lotus"], dropPreview: "地脉灵玉 · 妖核 · 寒霜神兵"
    },
    {
      stageIdx: 3, id: "sword_mound", actLabel: "第四卷", seal: "第四秘境",
      min: "golden", targetRealm: "nascent", loc: "secret",
      arenaArt: "arena_tower", particleKind: "ghost_ember",
      shape: "ellipse", rx: 0.34, ry: 0.28, cy: 0.54,
      name: "古修剑冢 · 剑墟遗阵", mapName: "古修剑冢",
      mapX: 78, mapY: 62, mapSub: "金丹凶域 · 古境剑傀",
      poem: "残碑断剑埋万骨 · 犹有剑意贯长虹",
      waves: [["puppet", "puppet", "serpent"], ["puppet", "shadow", "puppet"], ["shadow", "puppet", "sentinel"]],
      boss: "puppet", bossName: "古境剑傀", bossTitle: "镜阵剑祖 · 古境剑傀",
      matDrops: ["lotus", "jade"], bossMats: ["lotus", "soul"], dropPreview: "月华莲 · 地脉灵玉 · 仙品神兵"
    },
    {
      stageIdx: 4, id: "terrace", actLabel: "终卷", seal: "终局圣境",
      min: "nascent", targetRealm: "ascended", loc: "terrace",
      arenaArt: "arena_terrace", particleKind: "star_dust",
      shape: "ellipse", rx: 0.36, ry: 0.30, cy: 0.53,
      name: "九霄星盘仙台", mapName: "⚡ 九霄天门",
      mapX: 50, mapY: 15, mapSub: "元婴/化神 · 天门道影",
      poem: "雷龙绕柱开天门 · 今日仗剑问长生",
      waves: [["sentinel", "trial_heart", "puppet"], ["trial_thunder", "sentinel", "shadow"], ["trial_heart", "trial_thunder", "sentinel"]],
      boss: "trial_gate", bossName: "天门道影", bossTitle: "九霄守门者 · 天门道影",
      matDrops: ["soul", "dao"], bossMats: ["dao", "soul"], dropPreview: "凝魂晶 · 道蕴砂 · 鸿蒙造化"
    }
  ];

  const CHAPTERS = [
    {
      index: 1, realm: "mortal", vol: "第一卷", title: "山雨初鸣 · 青岚破庙",
      poem: "山雨欲来破庙寒，一剑退狼定前缘。",
      desc: "天门崩裂百年，道影残片坠入青岚。于破庙雨夜拔剑救下沈清禾、择定玉莲仙缘，斩灭受染的【雾隐狼王】粉碎第一枚残片，攒满修为渡劫晋升炼气期！",
      steps: [
        { id: "s1_open",  priority: "required", text: "破庙拔剑：退群狼救沈清禾并择定玉莲台仙缘", tab: "story", loc: "wilderness", route: "stage_0", reward: { stones: 35, pill: "healing_pill" }, rewardTxt: "35灵石 · 回春丹×1", check: g => !!g.openingChoice },
        { id: "s1_wolf",  priority: "required", text: "青岚追猎：扫荡青岚秘境击败【雾隐狼王】", tab: "explore", loc: "wilderness", route: "stage_0", reward: { stones: 45, herb: 2 }, rewardTxt: "45灵石 · 凝气草×2", check: g => isStageBossDefeated(g, 0) },
        { id: "s1_break", priority: "required", text: "引动天劫：修为圆满后按 B 开启渡劫仪轨晋升【炼气期】", tab: "cultivate", loc: "cave", route: "tribulate", reward: { stones: 65, gearMin: 1 }, rewardTxt: "65灵石 · 灵品仙装", check: g => rankOf(g.realm) >= 1 }
      ]
    },
    {
      index: 2, realm: "qi", vol: "第二卷", title: "洞府开炉 · 青云外门",
      poem: "钟鸣云海问仙途，镇山金卫试青锋。",
      desc: "循残片气机入青云山门：回听雨洞府开炉炼丹、契约灵宠，于【青云外门】斩破失控的【守山石卫】清除第二枚残片，集妖核炼筑基丹晋升筑基期！",
      steps: [
        { id: "s2_pet",    priority: "recommended", text: "缔结灵宠：在【修行】面板契约首只随行本命灵兽", tab: "cultivate", loc: "cave", route: "drawer_cultivate", reward: { stones: 60, herb: 3 }, rewardTxt: "60灵石 · 凝气草×3", check: g => !!g.pet.id },
        { id: "s2_lu",     priority: "recommended", text: "洞府整备：回听雨洞府炼丹1次或结交执事陆玄松", tab: "alchemy", loc: "cave", route: "hub", reward: { stones: 75, pill: "spirit_pill" }, rewardTxt: "75灵石 · 回灵丹×1", check: g => (g.immortalPills || 0) >= 1 || !!g.choices.lu_intro },
        { id: "s2_warden", priority: "required", text: "剑破外门：击败【青云外门 · 守山石卫】", tab: "explore", loc: "sect", route: "stage_1", reward: { stones: 85, core: 1 }, rewardTxt: "85灵石 · 妖核×1", check: g => isStageBossDefeated(g, 1) },
        { id: "s2_break",  priority: "required", text: "渡劫筑基：集妖核炼筑基丹，按 B 渡劫晋升【筑基期】", tab: "cultivate", loc: "cave", route: "tribulate", reward: { stones: 95, gearMin: 2 }, rewardTxt: "95灵石 · 玄品仙装", check: g => rankOf(g.realm) >= 2 }
      ]
    },
    {
      index: 3, realm: "foundation", vol: "第三卷", title: "寒潭镜心 · 照影问剑",
      poem: "幽潭冷月映青莲，玄蛇吐雾锁寒烟。",
      desc: "道影寒气沉入照影古境。在【故人】面板结交红尘同道，深入【照影寒潭】斩杀受染的【寒潭玄蛇】粉碎第三枚残片，采地脉灵玉凝结金丹！",
      steps: [
        { id: "s3_npc",     priority: "recommended", text: "红尘盟契：在【故人】面板完成任一段故人茶叙机缘", tab: "story", loc: "sect", route: "drawer_story", reward: { stones: 90, core: 1 }, rewardTxt: "90灵石 · 妖核×1", check: g => Object.keys(g.choices || {}).length >= 1 },
        { id: "s3_serpent", priority: "required", text: "寒潭斩蛇：击败【照影寒潭 · 寒潭玄蛇】", tab: "explore", loc: "secret", route: "stage_2", reward: { stones: 110, pill: "healing_pill", pillQty: 2 }, rewardTxt: "110灵石 · 回春丹×2", check: g => isStageBossDefeated(g, 2) },
        { id: "s3_break",   priority: "required", text: "凝结金丹：集地脉灵玉炼凝金丹，渡劫晋升【金丹期】", tab: "cultivate", loc: "cave", route: "tribulate", reward: { stones: 140, gearMin: 2 }, rewardTxt: "140灵石 · 玄品神兵", check: g => rankOf(g.realm) >= 3 }
      ]
    },
    {
      index: 4, realm: "golden", vol: "第四卷", title: "古冢剑魄 · 铸器启星",
      poem: "残碑断剑埋万骨，犹有剑意贯长虹。",
      desc: "残片余波直指古修剑冢。铸造本命法宝并启周天星图，随砚尘石碑线索破除镜阵、斩灭【古境剑傀】清除第四枚残片，采月华莲碎丹成婴！",
      steps: [
        { id: "s4_relic",  priority: "recommended", text: "本命神兵：在【百工】铸造并佩带一件镇魂本命法宝", tab: "alchemy", loc: "cave", route: "drawer_alchemy", reward: { stones: 130, core: 2 }, rewardTxt: "130灵石 · 妖核×2", check: g => !!g.loadout.relic },
        { id: "s4_puppet", priority: "required", text: "古冢斩傀：深入【古修剑冢】击败镇守首领【古境剑傀】", tab: "explore", loc: "secret", route: "stage_3", reward: { stones: 150, gearMin: 3 }, rewardTxt: "150灵石 · 仙品宝匣", check: g => isStageBossDefeated(g, 3) },
        { id: "s4_break",  priority: "required", text: "碎丹成婴：携结婴丹渡紫霄雷劫晋升【元婴期】真君", tab: "cultivate", loc: "cave", route: "tribulate", reward: { stones: 185, bonusSword: 1 }, rewardTxt: "185灵石 · 飞剑永久+1", check: g => rankOf(g.realm) >= 4 }
      ]
    },
    {
      index: 5, realm: "nascent", vol: "第五卷", title: "法则共鸣 · 元神化神",
      poem: "万法归宗凝道果，一念通天化元神。",
      desc: "四境残片已清，照影石碑指向九霄星盘。参悟大道法则激活万法共鸣，初探【九霄天门】采集凝魂晶与道蕴砂，渡劫突破化神尊者之境！",
      steps: [
        { id: "s5_laws",  priority: "required", text: "万法通明：累计领悟 4 门大道法则或法宝升至 ★3", tab: "cultivate", loc: "cave", route: "stage_4", reward: { stones: 210, core: 2 }, rewardTxt: "210灵石 · 妖核×2", check: g => (g.laws || []).length >= 4 || getEquippedRelicStars(g) >= 3 },
        { id: "s5_break", priority: "required", text: "元神化神：渡劫晋升【化神期】俯瞰九州山海", tab: "cultivate", loc: "terrace", route: "tribulate", reward: { stones: 260, gearMin: 3 }, rewardTxt: "260灵石 · 仙品圣装", check: g => rankOf(g.realm) >= 5 }
      ]
    },
    {
      index: 6, realm: "spirit", vol: "第六卷", title: "九霄天门 · 万古证道",
      poem: "雷龙绕柱开天门，今日仗剑问长生。",
      desc: "整备鸿蒙神装与故人同心盟契，登临【九霄天门】直面百年祸源【天门道影】，斩碎最后天障并渡终极飞升天劫，择定三大证道结局！",
      steps: [
        { id: "s6_pacts",  priority: "recommended", text: "故人同心：结契至少 2 位故人或闯锁妖塔第 4 层", tab: "story", loc: "sect", route: "drawer_story", reward: { stones: 280, pill: "spirit_pill", pillQty: 2 }, rewardTxt: "280灵石 · 回灵丹×2", check: g => countBondedAllies(g) >= 2 || (g.towerBest || 0) >= 4 },
        { id: "s6_gate",   priority: "required", text: "剑斩道影：击败【九霄天门 · 天门道影】贯通仙门", tab: "explore", loc: "terrace", route: "stage_4", reward: { stones: 400, bonusSword: 2 }, rewardTxt: "400灵石 · 飞剑永久+2", check: g => isStageBossDefeated(g, 4) },
        { id: "s6_ascend", priority: "required", text: "白日飞升：渡过最终飞升天劫择定三大证道结局", tab: "cultivate", loc: "terrace", route: "tribulate", reward: { stones: 600 }, rewardTxt: "600灵石 · 仙帝金榜", check: g => g.status === "ascended" }
      ]
    }
  ];



  const VOLUME_RECAP_META = [
    {
      stageIdx: 0,
      volEndLabel: "第一卷·终",
      title: "山雨初鸣 · 青岚破庙",
      chronicle: "山雨倾盆之夜，你于青岚破庙拔剑护下沈清禾，终在荒野深处斩灭受染的【雾隐狼王】，粉碎坠入九州的第一枚天门道影残片。残片余波已飘往青云山门方向。"
    },
    {
      stageIdx: 1,
      volEndLabel: "第二卷·终",
      title: "洞府开炉 · 青云外门",
      chronicle: "你立足听雨洞府、登临青云八卦仙台，一剑破除失控【守山石卫】心障，清除了第二枚天门道影残片。陆玄松观气机所指，第三道寒煞已沉入照影寒潭。"
    },
    {
      stageIdx: 2,
      volEndLabel: "第三卷·终",
      title: "寒潭镜心 · 照影问剑",
      chronicle: "踏破幽潭玄冰、斩碎霜弹剑阵，你亲手诛灭【寒潭玄蛇】并震散第三枚天门道影残片。裴照勘察残气去向，直指埋骨万剑的古修剑冢与守碑老人砚尘。"
    },
    {
      stageIdx: 3,
      volEndLabel: "第四卷·终",
      title: "古冢剑魄 · 铸器启星",
      chronicle: "剑墟遗阵之中，你破铜镜反震、斩灭【古境剑傀】，四方灵枢残片至此尽数清零。砚尘展卷对照照影残碑，石碑最后一行铭文已指向云海之巅的【九霄天门】。"
    },
    {
      stageIdx: 4,
      volEndLabel: "第六卷·终",
      title: "九霄天门 · 万古证道",
      chronicle: "历尽九州五境星图，你终在九霄星盘仙台斩破百年祸源【天门道影】，五境残片尽消、九霄仙门重开！照影石碑补全最后一笔，三界飞升之路就在眼前。"
    }
  ];

  const STAR_MILESTONE_CHESTS = [
    { id: "star_3",  need: 3,  name: "三星 · 初露锋芒匣", desc: "赏 100 灵石 · 必出【灵品】以上佩剑", art: "relic_frost_sword", stones: 100, gearRarity: 1, slot: "weapon" },
    { id: "star_6",  need: 6,  name: "六星 · 剑气纵横匣", desc: "赏 180 灵石 · 必出【玄品】护身仙衣", art: "relic_jade_seal",   stones: 180, gearRarity: 2, slot: "armor" },
    { id: "star_10", need: 10, name: "十星 · 金丹问道匣", desc: "赏 300 灵石 · 仙品灵佩 · 飞剑永久+1", art: "relic_soul_lamp",   stones: 300, gearRarity: 3, slot: "ring", bonusSword: 1 },
    { id: "star_15", need: 15, name: "满星 · 九州鸿蒙匣", desc: "赏 500 灵石 · 必出绝世【鸿蒙】神兵", art: "item_ascension_seal",stones: 500, gearRarity: 4, slot: "weapon" }
  ];

  const SECT_BOUNTY_CHAINS = [
    { slot: "slay",  title: "荡魔除妖令", icon: "icon_blade", statKey: "kills",       baseNeed: 8,  stepNeed: 10, descTpl: n => `累计斩灭九州妖兽 ${n} 只`, baseStones: 55, baseXp: 45 },
    { slot: "tech",  title: "剑心破势令", icon: "icon_seal",  statKey: "techBreaks",  baseNeed: 2,  stepNeed: 3,  descTpl: n => `触发一闪弹反或爆剑破势 ${n} 次`, baseStones: 65, baseXp: 55 },
    { slot: "craft", title: "百工寻宝令", icon: "furnace",    statKey: "craftOrLoot", baseNeed: 2,  stepNeed: 2,  descTpl: n => `炼丹、切玉或拾取仙装累计 ${n} 次`, baseStones: 70, baseXp: 50 }
  ];

  const STORY_LOCATIONS = {
    wilderness:  { id: "wilderness",  name: "青岚破庙", stageIdx: 0 },
    cave:        { id: "cave",        name: "听雨洞府", stageIdx: -1 },
    sect:        { id: "sect",        name: "青云外门", stageIdx: 1 },
    secret:      { id: "secret",      name: "照影古境", stageIdx: 2 },
    sword_mound: { id: "sword_mound", name: "古修剑冢", stageIdx: 3 },
    terrace:     { id: "terrace",     name: "九霄天门", stageIdx: 4 }
  };

  function getStoryLocationLabel(locKey) {
    return (locKey && hasOwn(STORY_LOCATIONS, locKey)) ? STORY_LOCATIONS[locKey].name : "九州尘缘";
  }

  const NPC_META = {
    shen: { id: "shen", name: "沈清禾", role: "青云药庐 · 悬壶医修", art: "char_shen", coopName: "青莲回春阵" },
    pei:  { id: "pei", name: "裴照", role: "青云剑阁 · 同辈剑首", art: "char_pei", coopName: "惊鸿裂天斩" },
    lu:   { id: "lu", name: "陆玄松", role: "青云山门 · 传功执事", art: "char_lu", coopName: "青云镇山钟" },
    yan:  { id: "yan", name: "砚尘", role: "照影古境 · 守碑老人", art: "char_yan", coopName: "古镜定魂光" }
  };

  const STORIES = [
    {
      id: "lu_intro", npc: "lu", name: "执事问道", min: "qi", chapter: 2, location: "sect",
      body: "青云宗执事陆玄松并未苛问你的灵根出身，只摊开山门舆图：『观天时星象而动，灵潮吐纳、丰年采药、破军试剑，善取舍者方能证道。』",
      options: [
        { id: "listen", label: "虚心请教天时筹备之道", detail: "获凝气草 ×4、晨曦灵露 ×2 · 解锁陆玄松合击 · 本真 +6", gain: { herb: 4, dew: 2 }, dao: { serenity: 6 }, result: "陆玄松欣然颔首，赠你灵草与一枚青云传讯符，斗法时可召山门钟声助阵！" },
        { id: "ambition", label: "直言欲赴太虚镇妖塔试剑", detail: "获灵石 +40 · 解锁陆玄松合击 · 锋芒 +6", stonesGain: 40, dao: { edge: 6 }, result: "陆玄松抚须大笑，赠你四十灵石与传讯符：『锐气可嘉，去镇妖塔扬威吧！』" }
      ]
    },
    {
      id: "shen_return", npc: "shen", name: "药香故人", min: "foundation", chapter: 3, location: "sect",
      body: "青云药庐竹影摇曳，沈清禾正守着药炉。重逢昔日破庙雨夜之人，她抬眸望向你，案上摆着新炼成的灵丹。",
      options: [
        { id: "warm", label: "坐下叙旧，共论丹道", detail: "获回春丹 ×2、回灵丹 ×1 · 解锁沈清禾合击 · 仁心 +8", gain: { healing_pill: 2, spirit_pill: 1 }, dao: { benevolence: 8 }, result: "药香袅袅，她将亲手精炼的灵丹与一枚药庐青莲令推到你面前。" },
        { id: "herb_aid", label: "赠予山野灵草助她试药", detail: "耗凝气草 ×2 → 获地脉灵玉 ×2 · 解锁沈清禾合击 · 仁心 +10", cost: { herb: 2 }, gain: { jade: 2 }, dao: { benevolence: 10 }, result: "沈清禾郑重收下灵草，回赠两枚温润灵玉与青莲护身令。" }
      ]
    },
    {
      id: "pei_meet", npc: "pei", name: "山门论剑", min: "foundation", chapter: 3, location: "sect",
      body: "演武场上剑气如虹，同辈俊杰裴照按剑相邀：『求仙问道，道友以为当相扶同行，还是各凭锋芒争渡？』",
      options: [
        { id: "cooperate", label: "相约同行，互通有无", detail: "付灵石 15 → 获地脉灵玉 ×2 · 解锁裴照裂天合击 · 仁心 +5", stonesCost: 15, gain: { jade: 2 }, dao: { benevolence: 5, serenity: 4 }, result: "裴照爽朗大笑，分你两块灵玉并留下一道剑符：遇强敌蓄势，捏碎剑符他必出剑断势！" },
        { id: "rival", label: "拔剑切磋，各凭锋芒", detail: "获灵石 +50、修为 +95 · 解锁裴照裂天合击 · 锋芒 +10", stonesGain: 50, xpGain: 95, dao: { edge: 10 }, result: "剑气交击三百合！裴照引你为平生知己，赠你同心剑符！" }
      ]
    },
    {
      id: "yan_stone", npc: "yan", name: "古境守碑人", min: "foundation", chapter: 3, location: "secret",
      body: "照影古境云雾深处，守碑老人砚尘拂去残碑积灰：『碑上尽是飞升大能的名讳，碑下却少有人记取凡尘来路。你要刻下什么？』",
      options: [
        { id: "story", label: "刻下山雨破庙与凡人烟火", detail: "获灵露 ×4、灵玉 ×1 · 解锁砚尘古镜合击 · 仁心 +7 / 本真 +6", gain: { dew: 4, jade: 1 }, dao: { benevolence: 7, serenity: 6 }, result: "砚尘眼中微光闪烁：『不忘来处者，心魔难侵。』赠你一面古境子镜。" },
        { id: "name", label: "刻下吾辈道号，誓叩天门", detail: "获修为 +135、灵石 +40 · 解锁砚尘古镜合击 · 锋芒 +9", stonesGain: 40, xpGain: 135, dao: { edge: 9 }, result: "剑指苍碑，字迹入石三分！古碑道韵化作一面护心子镜。" }
      ]
    },
    {
      id: "pei_echo", npc: "pei", name: "古境重逢", min: "golden", chapter: 4, location: "secret", requires: "pei_meet",
      body: "寒池断阶前剑傀虎视眈眈，裴照衣袂染霜，正勘察古阵破绽。见你踏云而至，他扬眉相询今日如何共进。",
      options: [
        { id: "share", label: "以灵露助他调息，并肩探池", detail: "耗晨曦灵露 ×2 → 获月华莲 ×3 · 仁心 +8 / 锋芒 +5", cost: { dew: 2 }, gain: { lotus: 3 }, dao: { benevolence: 8, edge: 5 }, result: "你们合力击退寒池禁制，采得三株晶莹月华莲！" },
        { id: "solo_lotus", label: "各自破阵，比试采莲快慢", detail: "获月华莲 ×2、灵石 +65 · 破妄锋芒 +9", gain: { lotus: 2 }, stonesGain: 65, dao: { edge: 9 }, result: "两人分路疾掠寒池，谈笑间各有所获。" }
      ]
    },
    {
      id: "lu_teach", npc: "lu", name: "薪火授业", min: "golden", chapter: 4, location: "sect", requires: "lu_intro",
      body: "青云宗新弟子齐聚传功堂，陆玄松请你这位金丹真人登台讲授一路走来的筹备与破境心得。",
      options: [
        { id: "teach", label: "倾囊相授，分灵玉作演武礼", detail: "耗地脉灵玉 ×1 → 获灵石 +135、修为 +250 · 仁心 +10", cost: { jade: 1 }, stonesGain: 135, xpGain: 250, dao: { benevolence: 10 }, result: "满堂后辈肃然长揖，你自己的金丹道果亦圆融数分！" },
        { id: "brief", label: "简述剑符连携要诀", detail: "获灵石 +75 · 逍遥本真 +6", stonesGain: 75, dao: { serenity: 6 }, result: "言简意赅，点透修行本质，陆玄松奉上山门谢仪。" }
      ]
    },
    {
      id: "shen_pact", npc: "shen", name: "一诺千山", min: "nascent", chapter: 5, location: "cave", requires: "shen_return",
      body: "山下百里村落瘴疫横行，沈清禾冒雨登临听雨洞府：『急缺两枚回春丹作药阵阵眼。若道友肯助，他日九霄雷劫，清禾必以灵枢药阵相护！』",
      options: [
        { id: "lend", label: "慷慨赠丹，立下千山护阵盟约", detail: "耗回春丹 ×2 → 解锁天劫【灵枢药阵】 · 仁心 +16", cost: { healing_pill: 2 }, aid: "shen", dao: { benevolence: 16 }, result: "百村炊烟重起之日，一道温润功德金光没入你的眉心！" },
        { id: "stone_aid", label: "资助百枚灵石请药庐采买", detail: "耗灵石 100 → 解锁天劫【灵枢药阵】 · 仁心 +12", stonesCost: 100, aid: "shen", dao: { benevolence: 12 }, result: "沈清禾立下药阵灵契，约于登仙台为你护法！" }
      ]
    },
    {
      id: "yan_mirror", npc: "yan", name: "照见本心", min: "nascent", chapter: 5, location: "secret", requires: "yan_stone",
      body: "照影古镜悬浮半空，镜中唯有十八岁那年攥着一枚回春丹站在破庙雨夜里的少年。砚尘轻声问：『修至元婴，你还认得镜中人么？』",
      options: [
        { id: "accept", label: "含笑颔首，接纳昔日弱小与赤诚", detail: "获凝魂晶 ×2 · 解锁天劫【古镜澄明】 · 本真 +15", gain: { soul: 2 }, aid: "yan", dao: { serenity: 15 }, result: "镜光化作两枚澄澈凝魂晶，往昔迷惘尽数化为今日道基！" }
      ]
    },
    {
      id: "pei_pact", npc: "pei", name: "云台相约", min: "spirit", chapter: 6, location: "sect", requires: "pei_echo",
      body: "闻听你将赴登仙台叩问天门，裴照负剑立于云海之巅：『留一粒道蕴砂作引，我在云台替你斩开第一道罡风！』",
      options: [
        { id: "ally", label: "留砂布阵，与挚友并肩迎劫", detail: "耗道蕴砂 ×1 → 解锁天劫【云台剑痕】 · 锋芒 +12", cost: { dao: 1 }, aid: "pei", dao: { edge: 12 }, result: "裴照长剑出鞘，一道凛冽剑意封入你的护身阵盘！" },
        { id: "free_ally", label: "共饮山门酒，以剑心共鸣立约", detail: "获修为 +420 · 解锁天劫【云台剑痕】 · 本真 +10", xpGain: 420, aid: "pei", dao: { serenity: 10 }, result: "酒尽剑鸣，两位绝世修士的剑意已在云台遥相呼应！" }
      ]
    },
    {
      id: "lu_farewell", npc: "lu", name: "山门送别", min: "spirit", chapter: 6, location: "sect", requires: "lu_teach",
      body: "白发苍苍的陆玄松站在山门石阶前，双手捧出珍藏百年的上品回灵丹：『去吧，青云宗永远记得你走过的路。』",
      options: [
        { id: "remember", label: "郑重长揖，收下山门送行丹", detail: "获回灵丹 ×3、回春丹 ×2 · 解锁【山门薪火】 · 仁心 +12", gain: { spirit_pill: 3, healing_pill: 2 }, aid: "lu", dao: { benevolence: 12 }, result: "山门钟声九响送行，满山弟子遥遥稽首。" }
      ]
    },
    {
      id: "yan_gate", npc: "yan", name: "天门之前", min: "spirit", chapter: 6, location: "terrace", requires: "yan_mirror",
      body: "九霄星盘石阶尽头，砚尘合上随身旧笔，将两粒道蕴砂推至你掌心：『石碑已为你记到天门之下，余下那一页，须由你亲手以剑作答。保重，道友。』",
      options: [
        { id: "resolve", label: "揖别守碑人，收下道蕴砂", detail: "获道蕴砂 ×2 · 本真 +12", gain: { dao: 2 }, dao: { serenity: 12 }, result: "长风吹散衣上尘霜，九霄天门已在眼前！" }
      ]
    }
  ];


  // ==================== M4-A. CALAMITY FIRE NG+ CYCLES & REALM-WOVEN ECOSYSTEM LADDER ====================


  // ==================== 5. V11 COMPLETE EDITION: SANCTUM HUB, BRANCHING ROOMS, LOOT & CUTSCENES ====================

  const IMG_CACHE = {};
  function preloadSprites() {
    Object.entries(ART).forEach(([k, src]) => {
      const im = new Image();
      im.src = src;
      IMG_CACHE[k] = im;
    });
  }

  let metaReadError = null;
  let metaWriteError = null;
  let metaState = createDefaultMetaState();
  function ensureMetaState() {
    metaState.seenEnemies = Array.isArray(metaState.seenEnemies)
      ? metaState.seenEnemies.filter(v => typeof v === "string" && v)
      : [];
    if (metaState.seenEnemies.length === 0) metaState.seenEnemies = ["wolf"];
    metaState.seenLaws = Array.isArray(metaState.seenLaws)
      ? metaState.seenLaws.filter(v => typeof v === "string" && v)
      : [];
    metaState.unlockedEndings = Array.isArray(metaState.unlockedEndings)
      ? metaState.unlockedEndings.filter(v => typeof v === "string" && v)
      : [];
    metaState.hallOfLives = Array.isArray(metaState.hallOfLives)
      ? metaState.hallOfLives.map(sanitizeHallEntry).filter(Boolean).slice(0, 18)
      : [];
    if (!metaState.karmaAscensions || typeof metaState.karmaAscensions !== "object" || Array.isArray(metaState.karmaAscensions)) {
      metaState.karmaAscensions = { righteous: 0, neutral: 0, demonic: 0 };
    } else {
      const ka = safeAssignPlain({ righteous: 0, neutral: 0, demonic: 0 }, metaState.karmaAscensions);
      ka.righteous = Math.max(0, Math.floor(num(ka.righteous, 0)));
      ka.neutral = Math.max(0, Math.floor(num(ka.neutral, 0)));
      ka.demonic = Math.max(0, Math.floor(num(ka.demonic, 0)));
      metaState.karmaAscensions = ka;
    }
    metaState.metaRev = Math.max(0, Math.floor(num(metaState.metaRev, 0)));
    metaState.ascensions = Math.max(0, Math.floor(num(metaState.ascensions, 0)));
    metaState.bestScore = Math.max(0, num(metaState.bestScore, 0));
    metaState.bestTower = Math.max(0, Math.floor(num(metaState.bestTower, 0)));
    metaState.bestRushGrade = hasOwn(RUSH_GRADE_RANK, metaState.bestRushGrade) ? metaState.bestRushGrade : null;
    metaState.bestRushTime = Math.max(0, num(metaState.bestRushTime, 0));
    metaState.bestSpireFloor = Math.max(0, Math.floor(num(metaState.bestSpireFloor, 0)));
    metaState.bestCalamityTier = Math.max(0, Math.floor(num(metaState.bestCalamityTier, 0)));
    metaState.cloudSeaClears = Math.max(0, Math.floor(num(metaState.cloudSeaClears, 0)));
    metaState.reincarnationPoints = Math.max(0, Math.floor(num(metaState.reincarnationPoints, 0)));
    metaState.taixuTrailUnlocked = Boolean(metaState.taixuTrailUnlocked);
    metaState.lastEnding = (typeof metaState.lastEnding === "string" && metaState.lastEnding) ? metaState.lastEnding : null;
    return metaState;
  }
  function hallEntryKey(rawEntry) {
    const entry = sanitizeHallEntry(rawEntry);
    if (!entry) return null;
    return `${entry.recordedAt || 0}|${entry.lifeNum || 0}|${entry.endingId || ""}|${entry.name || ""}|${entry.score || 0}`;
  }
  function isMetaBehind(candidate, target) {
    const cand = (candidate && typeof candidate === "object") ? candidate : {};
    const tgt = (target && typeof target === "object") ? target : {};
    if (Math.max(0, Math.floor(num(tgt.ascensions, 0))) > Math.max(0, Math.floor(num(cand.ascensions, 0)))) return true;
    if (Math.max(0, num(tgt.bestScore, 0)) > Math.max(0, num(cand.bestScore, 0))) return true;
    if (Math.max(0, Math.floor(num(tgt.bestTower, 0))) > Math.max(0, Math.floor(num(cand.bestTower, 0)))) return true;
    if (Math.max(0, Math.floor(num(tgt.bestSpireFloor, 0))) > Math.max(0, Math.floor(num(cand.bestSpireFloor, 0)))) return true;
    if (Math.max(0, Math.floor(num(tgt.bestCalamityTier, 0))) > Math.max(0, Math.floor(num(cand.bestCalamityTier, 0)))) return true;
    if (Math.max(0, Math.floor(num(tgt.cloudSeaClears, 0))) > Math.max(0, Math.floor(num(cand.cloudSeaClears, 0)))) return true;
    if (Math.max(0, Math.floor(num(tgt.reincarnationPoints, 0))) > Math.max(0, Math.floor(num(cand.reincarnationPoints, 0)))) return true;
    if (Boolean(tgt.taixuTrailUnlocked) && !Boolean(cand.taixuTrailUnlocked)) return true;
    const rTgt = hasOwn(RUSH_GRADE_RANK, tgt.bestRushGrade) ? RUSH_GRADE_RANK[tgt.bestRushGrade] : 0;
    const rCand = hasOwn(RUSH_GRADE_RANK, cand.bestRushGrade) ? RUSH_GRADE_RANK[cand.bestRushGrade] : 0;
    if (rTgt > rCand) return true;
    const tTgt = Math.max(0, num(tgt.bestRushTime, 0));
    const tCand = Math.max(0, num(cand.bestRushTime, 0));
    if (tTgt > 0 && (tCand <= 0 || tTgt < tCand)) return true;
    const karmaTgt = (tgt.karmaAscensions && typeof tgt.karmaAscensions === "object" && !Array.isArray(tgt.karmaAscensions)) ? tgt.karmaAscensions : {};
    const karmaCand = (cand.karmaAscensions && typeof cand.karmaAscensions === "object" && !Array.isArray(cand.karmaAscensions)) ? cand.karmaAscensions : {};
    for (const k of new Set(["righteous", "neutral", "demonic", ...Object.keys(karmaTgt)])) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      if (Math.max(0, Math.floor(num(karmaTgt[k], 0))) > Math.max(0, Math.floor(num(karmaCand[k], 0)))) return true;
    }
    const strSetBehind = (candArr, tgtArr) => {
      if (!Array.isArray(tgtArr) || tgtArr.length === 0) return false;
      const candSet = new Set();
      if (Array.isArray(candArr)) {
        for (const v of candArr) if (typeof v === "string" && v) candSet.add(v);
      }
      for (const v of tgtArr) {
        if (typeof v === "string" && v && !candSet.has(v)) return true;
      }
      return false;
    };
    if (strSetBehind(cand.seenEnemies, tgt.seenEnemies)) return true;
    if (strSetBehind(cand.seenLaws, tgt.seenLaws)) return true;
    if (strSetBehind(cand.unlockedEndings, tgt.unlockedEndings)) return true;
    if (Array.isArray(tgt.hallOfLives) && tgt.hallOfLives.length > 0) {
      const candHallKeys = new Set();
      if (Array.isArray(cand.hallOfLives)) {
        for (const e of cand.hallOfLives) {
          const hk = hallEntryKey(e);
          if (hk) candHallKeys.add(hk);
        }
      }
      for (const e of tgt.hallOfLives) {
        const hk = hallEntryKey(e);
        if (hk && !candHallKeys.has(hk)) return true;
      }
    }
    return false;
  }
  function inspectMetaState({ applyToMemory = true } = {}) {
    let primaryRaw = null;
    try {
      primaryRaw = localStorage.getItem(META_KEY);
    } catch (e) {
      metaReadError = {
        key: META_KEY,
        reason: `无法访问本地存储（${safeText(e && e.message, safeDiag(e)) || safeDiag(e)}）`,
        raw: null,
        at: Date.now()
      };
      return { ok: false, empty: false, error: metaReadError };
    }
    if (primaryRaw !== null && primaryRaw !== "") {
      const res = parseAndValidateMetaRaw(primaryRaw, META_KEY);
      if (res.ok) {
        metaReadError = null;
        if (applyToMemory) {
          safeAssignPlain(metaState, mergeMetaStates(metaState, res.meta));
          ensureMetaState();
        }
        return res;
      }
      metaReadError = {
        key: META_KEY,
        reason: res.reason || "元存档结构异常",
        raw: primaryRaw,
        rawLength: primaryRaw.length,
        at: Date.now()
      };
      return { ok: false, empty: false, error: metaReadError };
    }
    for (const legacyKey of ["chenyuan_wendao_v10_meta", "chenyuan_wendao_v9_meta"]) {
      let raw = null;
      try { raw = localStorage.getItem(legacyKey); } catch (e) { continue; }
      if (raw !== null && raw !== "") {
        const res = parseAndValidateMetaRaw(raw, legacyKey);
        if (res.ok) {
          metaReadError = null;
          if (applyToMemory) {
            safeAssignPlain(metaState, mergeMetaStates(metaState, res.meta));
            ensureMetaState();
          }
          return res;
        }
        metaReadError = {
          key: legacyKey,
          reason: `旧版元存档 ${legacyKey} 读取失败：${res.reason || "格式损坏"}`,
          raw,
          rawLength: raw.length,
          at: Date.now()
        };
        return { ok: false, empty: false, error: metaReadError };
      }
    }
    metaReadError = null;
    return { ok: false, empty: true, error: null };
  }
  inspectMetaState({ applyToMemory: true });
  ensureMetaState();

  let selectedPerkId = "sword_bone";
  let selectedCalamityTier = 0;
  let drawerOpen = false;
  let modalCloseable = true;
  let currentTab = "cultivate";
  let currentSysTab = "compendium"; // 'compendium' | 'achievements' | 'controls'
  let game = null;
  let checkpoint = null;

  // Active Story Cutscene Queue
  const cutscene = {
    active: false,
    lines: [],
    idx: 0,
    onFinish: null,
    triggerEl: null
  };

  // Live Flame-Control Alchemy Minigame State
  const furnaceGame = {
    active: false,
    recipeId: "healing",
    pos: 0.15,
    dir: 1,
    speed: 0.92,
    sweetStart: 0.38,
    sweetWidth: 0.24,
    lastResult: null
  };

  // 5 Chapter Regions (Derived from CAMPAIGN_ACTS single source of truth; decoupled from Endless Demon-Lock Tower!)
  const STAGES = CAMPAIGN_ACTS.map(act => ({
    id: act.id, min: act.min, loc: act.loc, arenaArt: act.arenaArt, particleKind: act.particleKind,
    shape: act.shape, rx: act.rx, ry: act.ry, cy: act.cy, name: act.name,
    waves: act.waves, boss: act.boss, bossName: act.bossName, bossTitle: act.bossTitle,
    matDrops: act.matDrops, bossMats: act.bossMats, dropPreview: act.dropPreview
  }));

  function getRealmCombatBaseline(realmId) {
    return REALM_COMBAT_BASELINE[realmId] || REALM_COMBAT_BASELINE.mortal;
  }

  // G5: Permanent Growth Caps (Total/Alchemy Stat Ceilings by Realm, Blood-Fury Quota, Spire Curio Caps)

  function ensurePermGrowth(g) {
    if (!g) return { alchemyHp: 0, alchemyAtk: 0, bloodFuryBought: {} };
    if (!g.permGrowth || typeof g.permGrowth !== "object" || Array.isArray(g.permGrowth)) {
      g.permGrowth = { alchemyHp: 0, alchemyAtk: 0, bloodFuryBought: {} };
    }
    const pg = g.permGrowth;
    pg.alchemyHp = Math.max(0, Math.floor(num(pg.alchemyHp, 0)));
    pg.alchemyAtk = Math.max(0, Math.floor(num(pg.alchemyAtk, 0)));
    if (!pg.bloodFuryBought || typeof pg.bloodFuryBought !== "object" || Array.isArray(pg.bloodFuryBought)) {
      pg.bloodFuryBought = {};
    }
    return pg;
  }


  function grantPermanentStatBonus(g, opts = {}) {
    const caps = getPermGrowthCaps(g);
    const pg = ensurePermGrowth(g);
    const reqHp = Math.max(0, Math.floor(num(opts && opts.hp, 0)));
    const reqAtk = Math.max(0, Math.floor(num(opts && opts.atk, 0)));
    const source = (opts && opts.source) || "general";
    if (!g) return { grantedHp: 0, grantedAtk: 0, hpCapped: reqHp > 0, atkCapped: reqAtk > 0, caps, pg };

    const curHpBonus = Math.max(0, Math.floor(num(g.maxHpBonus, 0)));
    const curAtkBonus = Math.max(0, Math.floor(num(g.atkFlatBonus, 0)));
    let hpRoom = Math.max(0, caps.maxHpBonus - curHpBonus);
    let atkRoom = Math.max(0, caps.atkFlatBonus - curAtkBonus);

    if (source === "alchemy") {
      hpRoom = Math.min(hpRoom, Math.max(0, caps.alchemyHp - pg.alchemyHp));
      atkRoom = Math.min(atkRoom, Math.max(0, caps.alchemyAtk - pg.alchemyAtk));
    }

    const grantedHp = Math.min(reqHp, hpRoom);
    const grantedAtk = Math.min(reqAtk, atkRoom);
    g.maxHpBonus = curHpBonus + grantedHp;
    g.atkFlatBonus = curAtkBonus + grantedAtk;
    if (source === "alchemy") {
      pg.alchemyHp += grantedHp;
      pg.alchemyAtk += grantedAtk;
    }

    const hpCapped = reqHp > 0 && (grantedHp < reqHp || g.maxHpBonus >= caps.maxHpBonus || (source === "alchemy" && pg.alchemyHp >= caps.alchemyHp));
    const atkCapped = reqAtk > 0 && (grantedAtk < reqAtk || g.atkFlatBonus >= caps.atkFlatBonus || (source === "alchemy" && pg.alchemyAtk >= caps.alchemyAtk));
    return { grantedHp, grantedAtk, hpCapped, atkCapped, caps, pg };
  }

  function getBloodFuryQuota(g) {
    const r = (g && typeof g.realm === "string" && hasOwn(REALMS, g.realm)) ? g.realm : "mortal";
    const pg = ensurePermGrowth(g);
    const max = PERM_GROWTH_CAPS.bloodFuryPerRealm;
    const bought = Math.max(0, Math.floor(num(pg.bloodFuryBought[r], 0)));
    return { realm: r, bought, max, remaining: Math.max(0, max - bought) };
  }


  function isStageBossDefeated(g, stageIdx) {
    if (!g) return false;
    const idx = Math.floor(num(stageIdx, -1));
    if (idx < 0 || idx >= STAGES.length) return false;
    if (g.stageStars && num(g.stageStars[idx], 0) >= 1) return true;
    if (g.defeatedStageBosses && g.defeatedStageBosses[idx] === true) return true;
    if (idx === 4 && g.trialCompleted === true) return true;
    return false;
  }

  function getBreakthroughBossGate(g) {
    if (!g || g.realm === "ascended") return null;
    if (!hasOwn(REALM_BOSS_GATE, g.realm)) return null;
    const stageIdx = REALM_BOSS_GATE[g.realm];
    const act = CAMPAIGN_ACTS[stageIdx] || CAMPAIGN_ACTS[0];
    const stg = STAGES[stageIdx] || STAGES[0];
    const cleared = isStageBossDefeated(g, stageIdx);
    const r = REALMS[g.realm];
    const nextRealmId = (r && r.next) || "ascended";
    return {
      locked: !cleared,
      stageIdx,
      stageId: act.id,
      stageName: stg.name,
      mapName: act.mapName || stg.name,
      bossId: act.boss,
      bossName: act.bossName,
      bossTitle: act.bossTitle || act.bossName,
      nextRealmId,
      nextRealmName: (REALMS[nextRealmId] && REALMS[nextRealmId].name) || "飞升真仙"
    };
  }

  // ==================== 5A-M2. 5-LAYER EXPEDITION STAR-MAP, CLIMATES & 12 RUN-SCOPED BOONS ====================
  const DUNGEON_CLIMATES = {
    sword_wind:   { id: "sword_wind",   name: "剑风呼啸", icon: "🌪", badge: `攻速+${Math.round(COMBAT_RULE_PARAMS.climates.sword_wind.haste * 100)}% · 移速+${Math.round((COMBAT_RULE_PARAMS.climates.sword_wind.speedMult - 1) * 100)}%`, desc: `剑风贯阵：挥剑攻速 +${Math.round(COMBAT_RULE_PARAMS.climates.sword_wind.haste * 100)}%、身法移速 +${Math.round((COMBAT_RULE_PARAMS.climates.sword_wind.speedMult - 1) * 100)}%` },
    spirit_mist:  { id: "spirit_mist",  name: "灵雾滋养", icon: "🌫", badge: "灵草翻倍 · 回灵+35%", desc: "灵雾充盈：灵气与灵草掉落翻倍，剑元恢复 +35%" },
    thunder_loom: { id: "thunder_loom", name: "雷云压境", icon: "⛈", badge: `暴伤+${Math.round(COMBAT_RULE_PARAMS.climates.thunder_loom.critMult * 100)}% · 易引链雷`, desc: `雷云低垂：暴击伤害 +${Math.round(COMBAT_RULE_PARAMS.climates.thunder_loom.critMult * 100)}%，每次暴击易引紫电链雷` },
    blood_haze:   { id: "blood_haze",   name: "煞气凝重", icon: "🩸", badge: `我方伤+${Math.round((COMBAT_RULE_PARAMS.climates.blood_haze.playerActiveMult - 1) * 100)}% · 敌攻+${Math.round((COMBAT_RULE_PARAMS.climates.blood_haze.enemyAtkMult - 1) * 100)}%`, desc: `凶煞翻涌：我方主动增伤 +${Math.round((COMBAT_RULE_PARAMS.climates.blood_haze.playerActiveMult - 1) * 100)}%（受主动倍率上限约束）、敌方攻击 +${Math.round((COMBAT_RULE_PARAMS.climates.blood_haze.enemyAtkMult - 1) * 100)}%，精英仙装爆率大增` }
  };

  const DUNGEON_ROOM_TYPES = {
    outpost:         { id: "outpost",         icon: "⚔", name: "前哨试剑",   short: "妖潮", reward: "灵石与妖材 · 探明秘境", peaceful: false, grantsBoon: false },
    elite_loot:      { id: "elite_loot",      icon: "🔥", name: "凶煞剑冢",   short: "精英", reward: "必爆高品仙装 + 秘境道韵", peaceful: false, grantsBoon: true },
    merchant_event:  { id: "merchant_event",  icon: "🏮", name: "奇遇仙商",   short: "商遇", reward: "云游仙商 · 丹鼎 · 机缘碑", peaceful: true,  grantsBoon: false },
    spirit_spring:   { id: "spirit_spring",   icon: "💧", name: "太初灵泉",   short: "灵泉", reward: "满态恢复 + 秘境道韵玉简", peaceful: true,  grantsBoon: true },
    elemental_vault: { id: "elemental_vault", icon: "⚡", name: "五行秘窟",   short: "秘窟", reward: "五行剑碑 · 双倍灵材 + 道韵", peaceful: false, grantsBoon: true },
    vanguard_clash:  { id: "vanguard_clash",  icon: "🛡", name: "妖卫剑阵",   short: "战阵", reward: "战术三兵种 · 高修为 + 道韵", peaceful: false, grantsBoon: true },
    mystery_shrine:  { id: "mystery_shrine",  icon: "🩸", name: "血坛机缘",   short: "血坛", reward: "心魔血剑坛 · 原石 · 奇遇碑", peaceful: true,  grantsBoon: false },
    boss:            { id: "boss",            icon: "👑", name: "镇守妖王",   short: "首领", reward: "三星秘宝 · 贯通下一卷", peaceful: false, grantsBoon: false }
  };

  const RUN_BOONS = [
    { id: "frost_splash",   name: "玄霜剑爆", badge: "寒霜溅射", art: "relic_frost_sword", desc: "本趟秘境：剑击命中 38% 迸发寒霜冲击波，冰缓并重创周围妖兽。" },
    { id: "parry_reset",    name: "镜花水月", badge: "识破刷冷", art: "icon_seal",         desc: "本趟秘境：空格完美一闪/识破剑反立即重置爆剑冷却、减 4s 大招冷却并 +25% 剑意。" },
    { id: "blood_intent",   name: "背水剑意", badge: "残血暴击", art: "icon_blade",        desc: `本趟秘境：气血低于 ${Math.round(COMBAT_RULE_PARAMS.runBoons.blood_intent.hpThreshold * 100)}% 时暴击率 +${Math.round(COMBAT_RULE_PARAMS.runBoons.blood_intent.crit * 100)}%，剑意获取速率提升至 ${COMBAT_RULE_PARAMS.runBoons.blood_intent.intentGainMult.toFixed(2)}×！` },
    { id: "lightning_chain",name: "九霄链雷", badge: "暴击链雷", art: "relic_soul_lamp",   desc: "本趟秘境：每次暴击引动 2 道九霄紫电跳跃连锁打击周围妖兽。" },
    { id: "sword_echo",     name: "剑影回响", badge: "三剑齐射", art: "icon_blade",        desc: "本趟秘境：每第 3 次挥剑额外激射 3 道贯穿敌阵的灵剑残影！" },
    { id: "posture_shatter",name: "崩岳破势", badge: "破势真伤", art: "relic_jade_seal",   desc: `本趟秘境：削势效率提升至 ${COMBAT_RULE_PARAMS.runBoons.posture_shatter.postureMult.toFixed(2)}×（+${Math.round((COMBAT_RULE_PARAMS.runBoons.posture_shatter.postureMult - 1) * 100)}%）；击破敌方架势瞬间引爆目标高额破势真伤（杂兵${Math.round(COMBAT_RULE_PARAMS.runBoons.posture_shatter.mobTrueDmgRatio * 100)}%/首领${Math.round(COMBAT_RULE_PARAMS.runBoons.posture_shatter.bossTrueDmgRatio * 100)}%）！` },
    { id: "gourd_overload", name: "仙酿剑狂", badge: "饮葫狂暴", art: "item_immortal_gourd", desc: `本趟秘境：饮用仙葫后 ${COMBAT_RULE_PARAMS.runBoons.gourd_overload.durationSec} 秒内常驻攻击池 +${Math.round(COMBAT_RULE_PARAMS.runBoons.gourd_overload.passiveAtkPct * 100)}%、攻速 +${Math.round(COMBAT_RULE_PARAMS.runBoons.gourd_overload.haste * 100)}%，并获 ${COMBAT_RULE_PARAMS.runBoons.gourd_overload.hyperArmorSec} 秒霸体护身！` },
    { id: "vampiric_qi",    name: "噬灵归元", badge: "斩妖回血", art: "item_lotus",        desc: `本趟秘境：破势回复 ${Math.round(COMBAT_RULE_PARAMS.runBoons.vampiric_qi.breakHealPct * 100)}% 最大气血、斩杀妖兽回复 ${Math.round(COMBAT_RULE_PARAMS.runBoons.vampiric_qi.killHealPct * 100)}% 最大气血，并均回复 ${COMBAT_RULE_PARAMS.runBoons.vampiric_qi.mpGain} 点真元。` },
    { id: "recall_nova",    name: "万剑归墟", badge: "爆剑清弹", art: "relic_frost_sword", desc: "本趟秘境：右键爆剑引爆印记时清散周身妖丹并绽放范围剑莲震爆！" },
    { id: "dash_clone",     name: "残影剑分身",badge: "闪避留影", art: "clone_yuqing_cyan", desc: "本趟秘境：空格闪避在原地留下剑影分身，0.85 秒后自动爆裂重创群妖！" },
    { id: "aerial_reign",   name: "御风凌霄", badge: "空战增伤", art: "vfx_sky_meteor_plunge", desc: `本趟秘境：腾空斩与下坠陨星劈伤害提升至 ${COMBAT_RULE_PARAMS.runBoons.aerial_reign.dmgMult.toFixed(2)}×（+${Math.round((COMBAT_RULE_PARAMS.runBoons.aerial_reign.dmgMult - 1) * 100)}%），命中令目标额外失衡眩晕！` },
    { id: "gold_alchemist", name: "点石成剑", badge: "灵石增威", art: "item_jade",         desc: `本趟秘境：灵石掉落 +${Math.round((COMBAT_RULE_PARAMS.runBoons.gold_alchemist.stoneDropMult - 1) * 100)}%，每持有 ${COMBAT_RULE_PARAMS.runBoons.gold_alchemist.perStones} 灵石额外提供 +${Math.round(COMBAT_RULE_PARAMS.runBoons.gold_alchemist.pctPerStep * 100)}% 常驻池攻击（上限 +${Math.round(COMBAT_RULE_PARAMS.runBoons.gold_alchemist.maxPct * 100)}%）。` }
  ];

  // ==================== 5B. IMMORTAL GEAR & MARKET SYSTEM (4-SLOT LOOT ENGINE) ====================




  // ==================== V12 DESTINY DAO FRUITS, KYUSHU MAP NODES & SECRET ENCOUNTERS ====================

  const KYUSHU_MAP_NODES = [
    {
      id: "hub", kind: "hub", tier: "hub", shape: "hex", chapterIdx: null,
      x: 40, y: 34, name: "🏠 听雨洞府", sub: "仙门主城 · 丹鼎坊市", min: "mortal",
      reqText: "随时可返安全休整（满酿仙葫 · 洞府建设 · 演武论剑）",
      drop: "聚气灵眼 · 故人茶叙", links: ["stg_0"], routeKey: "hub"
    },
    ...CAMPAIGN_ACTS.slice(0, 4).map((act, idx) => ({
      id: `stg_${act.stageIdx}`, kind: "stage", tier: "main", shape: "square",
      stageIdx: act.stageIdx, chapterIdx: idx + 1,
      x: act.mapX, y: act.mapY, name: act.mapName, sub: act.mapSub, min: act.min,
      reqText: `${REALMS[act.min] ? REALMS[act.min].name : act.min}期开启 · ${act.actLabel}主线秘境`,
      drop: act.dropPreview,
      links: idx === 0 ? ["hub", "stg_1"]
        : idx === 1 ? ["stg_0", "stg_2", "tower"]
        : idx === 2 ? ["stg_1", "stg_3"]
        : ["stg_2", "ch5_resonance", "boss_rush"],
      routeKey: `stage_${act.stageIdx}`
    })),
    {
      id: "ch5_resonance", kind: "chapter5_marker", tier: "main", shape: "square",
      chapterIdx: 5, x: 64, y: 44, name: "✦ 第五卷 · 法则共鸣",
      sub: "元婴化神 · 万法通明指引", min: "nascent",
      reqText: "元婴期解锁（参悟4门法则或法宝★3后渡劫化神）",
      drop: "法则共鸣 · 化神破境指引",
      links: ["stg_3", "stg_4"], routeKey: "stage_4"
    },
    {
      id: "tower", kind: "tower", tier: "side", shape: "circle", chapterIdx: null,
      x: 77, y: 24, name: "🗼 镇妖古塔", sub: "无尽冲层 · 群魔试炼", min: "qi",
      reqText: "炼气期解封（无尽镇妖塔冲层试炼）",
      drop: "鸿蒙光柱 · 海量灵石", links: ["stg_1"], routeKey: "tower"
    },
    {
      id: "stg_4", kind: "stage", tier: "main", shape: "square",
      stageIdx: 4, chapterIdx: 6,
      x: CAMPAIGN_ACTS[4].mapX, y: CAMPAIGN_ACTS[4].mapY,
      name: CAMPAIGN_ACTS[4].mapName, sub: CAMPAIGN_ACTS[4].mapSub, min: CAMPAIGN_ACTS[4].min,
      reqText: `${REALMS[CAMPAIGN_ACTS[4].min] ? REALMS[CAMPAIGN_ACTS[4].min].name : "元婴"}期开启 · 第五/六卷九霄天门终章`,
      drop: CAMPAIGN_ACTS[4].dropPreview,
      links: ["ch5_resonance"], routeKey: "stage_4"
    },
    {
      id: "boss_rush", kind: "boss_rush", tier: "side", shape: "circle", chapterIdx: null,
      x: 19, y: 24, name: "⚔ 万剑冢·连战", sub: "七阵踏天 · 烛龙心魔", min: "nascent",
      reqText: "元婴期解封（七阵强化妖王与太古烛龙连战）",
      drop: "太虚劫光 · 剑尊尊号", links: ["stg_3"], routeKey: "boss_rush"
    }
  ];

  // F14 Dual-Encoding Semantic Tag Helper (Color + Shape/Seal)
  const SEMANTIC_META = {
    main:      { glyph: "■", shape: "square" },
    companion: { glyph: "♥", shape: "heart" },
    side:      { glyph: "●", shape: "circle" },
    econ:      { glyph: "⬡", shape: "hex" },
    system:    { glyph: "◈", shape: "diamond" },
    danger:    { glyph: "▲", shape: "triangle" }
  };
  function renderSemanticTag(category, label) {
    const cat = hasOwn(SEMANTIC_META, category) ? category : "system";
    const meta = SEMANTIC_META[cat];
    return `<span class="sem-badge sem-${cat}" data-sem="${cat}" data-shape="${meta.shape}">${meta.glyph} ${escapeHtml(label)}</span>`;
  }

  // F15 Unified Navigation Taxonomy (shared across M World Map, T Objectives & Explore drawer)
  const NAV_MODEL_TABS = [
    { id: "mainline",   label: "主线·卷",   sem: "main" },
    { id: "trials",     label: "支线·试炼", sem: "side" },
    { id: "companions", label: "故人线",    sem: "companion" },
    { id: "bounties",   label: "悬赏·15星", sem: "econ" },
    { id: "endgame",    label: "飞升·天命", sem: "main" }
  ];

  // F17 Material Source Catalog (Single-layer inline jump)
  const MATERIAL_SOURCE_CATALOG = {
    herb: {
      id: "herb", name: "凝气草",
      sources: [
        { label: "第一卷 · 青岚破庙斩妖", route: "stage_0", hint: "常规小怪与雾隐狼王高频掉落" },
        { label: "第二卷 · 青云外门试炼", route: "stage_1", hint: "外门妖傀与精英掉落" },
        { label: "宗门悬赏金榜 (T)", openGoals: "bounties", hint: "完成悬赏与15星秘宝稳定获取" }
      ]
    },
    dew: {
      id: "dew", name: "灵露",
      sources: [
        { label: "第一卷 · 青岚破庙", route: "stage_0", hint: "破庙灵脉妖兽掉落" },
        { label: "第二卷 · 青云外门", route: "stage_1", hint: "外门道场高频产出" },
        { label: "故人茶叙结缘", route: "drawer_story", hint: "红尘故人互动赠礼" }
      ]
    },
    core: {
      id: "core", name: "妖核",
      sources: [
        { label: "第二卷 · 青云外门首领", route: "stage_1", hint: "守山石卫与精英妖兽掉落" },
        { label: "宗门悬赏金榜 (T)", openGoals: "bounties", hint: "每轮悬赏交割必得妖核×1" },
        { label: "镇妖古塔无尽试炼", route: "tower", hint: "炼气期启 · 逐层妖王掉落" }
      ]
    },
    jade: {
      id: "jade", name: "地脉灵玉",
      sources: [
        { label: "第三卷 · 照影寒潭", route: "stage_2", hint: "寒潭玄蛇与精英妖兽产出" },
        { label: "九州灵脉远征", action: "open-expedition", hint: "元婴期启 · 驻防灵脉定时产出" }
      ]
    },
    lotus: {
      id: "lotus", name: "月华莲",
      sources: [
        { label: "第三卷 · 照影寒潭首领", route: "stage_2", hint: "寒潭玄蛇概率产出" },
        { label: "第四卷 · 古修剑冢", route: "stage_3", hint: "古境剑傀与剑冢高频产出" }
      ]
    },
    soul: {
      id: "soul", name: "凝魂晶",
      sources: [
        { label: "第五/六卷 · 九霄天门", route: "stage_4", hint: "天门守卫与天门道影产出" },
        { label: "镇妖古塔高层", route: "tower", hint: "高层锁妖内坛掉落" }
      ]
    },
    dao: {
      id: "dao", name: "道蕴砂",
      sources: [
        { label: "第六卷 · 九霄天门", route: "stage_4", hint: "天门道影与九霄道场产出" },
        { label: "九州灵脉远征", action: "open-expedition", hint: "元婴期启 · 灵脉驻防稳定获取" }
      ]
    }
  };

  let selectedWorldMapNodeId = null;
  const cultivateGroupOpen = { core: true, advanced: true, collection: false };
  let activeMatSourceJump = null;
  let pendingBatchCraft = null;
  let pendingBatchEnhance = null;

  function createFreshEncounterTelemetry() {
    return {
      startedAt: (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now(),
      elapsedSec: 0,
      hitsTaken: 0,
      totalDamageTaken: 0,
      healsUsed: 0,
      gourdUsed: 0,
      parryCount: 0,
      dodgeCount: 0,
      recentHits: [],
      lastHit: null
    };
  }

  const SECRET_ENCOUNTERS = [
    {
      id: "ancient_sword_mound",
      seal: "剑冢奇遇",
      title: "古冢残剑 · 凶煞问心",
      banner: "banner_relic",
      desc: "荒草断碑间斜插一柄嗡鸣不止的古修凶剑，煞气冲霄。若强行拔剑恐伤经脉，若以剑意温养则可化为己用。",
      options: [
        { id: "force_pull", label: "以血祭剑 · 强拔凶兵", detail: "损耗20%当前气血 · 必得一件高品阶【佩剑】且锋芒道心+12", dao: { edge: 12 } },
        { id: "calm_temper", label: "盘膝抚剑 · 化煞为灵", detail: "本命环身飞剑永久 +1 柄 · 本真道心+10", dao: { serenity: 10 } },
        { id: "melt_essence", label: "抽取剑髓 · 凝练修为", detail: "修为大涨 +45% 当前境界上限 · 获灵石 +85", dao: { benevolence: 6 } }
      ]
    },
    {
      id: "cold_pond_spring",
      seal: "灵泉造化",
      title: "太清寒泉 · 洗髓易筋",
      banner: "banner_sanctum",
      desc: "石窟深处涌出一眼乳白灵泉，泉心浮沉三枚千年寒莲子，散发出涤荡丹毒的清冽药香。",
      options: [
        { id: "bathe_spring", label: "踏泉洗髓 · 脱胎换骨", detail: "气血与剑元全满 · 永久气血上限 +36", dao: { serenity: 12 } },
        { id: "gather_lotus", label: "采摘莲心 · 炼制金丹", detail: "获回春丹 ×3、凝气草 ×4 与灵石 +65", dao: { benevolence: 12 } },
        { id: "condense_frost", label: "引寒入刃 · 凝霜剑印", detail: "本局剑气附带【玄冥寒霜】且剑道攻击永久 +10", dao: { edge: 10 } }
      ]
    },
    {
      id: "alchemist_remnant",
      seal: "丹圣遗泽",
      title: "紫微残炉 · 试药问命",
      banner: "banner_alchemy",
      desc: "古修洞府遗留一尊尚有余温的紫金丹炉，炉内封存着两枚异香扑鼻却真假难辨的无名古丹。",
      options: [
        { id: "swallow_gold", label: "仰首吞服 · 搏取造化", detail: "修为暴涨 +60% 且剑道攻击永久 +14 · 凝2层渡劫护脉丹障", dao: { edge: 8, serenity: 8 } },
        { id: "inspect_furnace", label: "拆解丹方 · 参悟火候", detail: "获妖核 ×2、灵石 +95", dao: { benevolence: 8 } },
        { id: "gift_pill", label: "封存灵丹 · 留赠同门", detail: "获高品【护身仙衣】或【乾坤灵佩】一件 · 仁心道心 +15", dao: { benevolence: 15 } }
      ]
    }
  ];

  // ==================== M3 SANCTUM 5-TIER CONSTRUCTION, COMPANION PRESENCE & KARMA WORLD ====================
  const SANCTUM_BUILDINGS = [
    {
      id: "spirit_eye", name: "聚气灵眼", icon: "💠", art: "prop_bagua_secret_gate", color: "#70ffe6",
      role: "吐纳效率 · 仙葫容量 · 洞天灵纹",
      tiers: [
        null,
        { stones: 60,  mats: { herb: 3, dew: 1 },           eff: "吐纳效率 +22% · 灵眼双环光阵" },
        { stones: 130, mats: { herb: 4, jade: 2 },          eff: "吐纳效率 +44% · 仙葫上限永久 +1 缕" },
        { stones: 240, mats: { jade: 3, lotus: 2 },         eff: "吐纳效率 +66% · 破境溢流修为提升" },
        { stones: 400, mats: { lotus: 3, soul: 2, dao: 1 }, eff: "吐纳效率 +88% · 仙葫上限再 +1 · 太初灵眼满辉" }
      ],
      summaryFn: lv => `吐纳 ×${(1 + (lv - 1) * 0.22).toFixed(2)} · 仙葫上限 +${(lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0)}`
    },
    {
      id: "cauldron", name: "紫微丹鼎", icon: "🔥", art: "furnace", color: "#ffae66",
      role: "延寿丹方 · 仙葫泡酒槽 · 控火温区",
      tiers: [
        null,
        { stones: 70,  mats: { herb: 3, dew: 2 },           eff: "解锁【延寿青莲丹】丹方 · 控火黄金区 +3.5%" },
        { stones: 150, mats: { core: 2, jade: 2 },          eff: "仙葫泡酒槽扩容至 4 槽 · 控火黄金区 +7%" },
        { stones: 260, mats: { lotus: 3, core: 2 },         eff: "控火成丹必额外 +1 枚回春丹 · 黄金区 +10.5%" },
        { stones: 420, mats: { soul: 3, dao: 1 },           eff: "仙葫泡酒槽满扩容 5 槽 · 控火黄金区 +14%" }
      ],
      summaryFn: lv => `泡酒槽 ${lv >= 5 ? 5 : lv >= 3 ? 4 : 3} 槽 · ${lv >= 2 ? "已解封延寿青莲丹" : "Lv.2解封延寿丹"}`
    },
    {
      id: "sword_forge", name: "天工剑炉", icon: "⚒", art: "anvil_tiangong_forge", color: "#ffe28a",
      role: "常驻剑攻 · 淬火折价 · 剑谱共鸣",
      tiers: [
        null,
        { stones: 80,  mats: { core: 2, herb: 2 },          eff: "常驻剑攻 +8 · 仙装淬火费用 -10%" },
        { stones: 165, mats: { core: 2, jade: 3 },          eff: "常驻剑攻 +16 · 淬火 -20% · 自创剑谱伤害 +12%" },
        { stones: 280, mats: { jade: 3, lotus: 2 },         eff: "常驻剑攻 +24 · 淬火 -30% · 法宝升星折扣" },
        { stones: 450, mats: { soul: 3, dao: 2 },           eff: "常驻剑攻 +32 · 淬火 -40% · 自创剑谱伤害 +25%" }
      ],
      summaryFn: lv => `常驻剑攻 +${(lv - 1) * 8} · 淬火 -${(lv - 1) * 10}%`
    },
    {
      id: "scripture_hall", name: "藏经阁", icon: "📜", art: "scroll_shanhe_sheji", color: "#b998fa",
      role: "远征产出 · 采集收益 · 道韵换韵次数",
      tiers: [
        null,
        { stones: 75,  mats: { dew: 2, jade: 1 },           eff: "九州远征产出 +20% · 秘境道韵免费换韵 +1 次" },
        { stones: 160, mats: { jade: 3, lotus: 1 },         eff: "九州远征产出 +40% · 历练委托灵石修为 +30%" },
        { stones: 270, mats: { lotus: 3, soul: 2 },         eff: "远征产出 +60% · 大道法则三选一换韵 +1 次" },
        { stones: 440, mats: { soul: 3, dao: 2 },           eff: "远征产出 +80% · 历练委托双倍灵材概率" }
      ],
      summaryFn: lv => `远征 +${(lv - 1) * 20}% · 道韵换韵 ${1 + (lv >= 2 ? 1 : 0)} 次`
    },
    {
      id: "guard_array", name: "护山大阵", icon: "🛡", art: "prop_guardian_sword_pylon", color: "#58e6c8",
      role: "常驻减伤 · 守卫剑塔增幅 · 灵脉护盾",
      tiers: [
        null,
        { stones: 75,  mats: { core: 2, dew: 2 },           eff: "常驻护体减伤 +4 · 守卫核心气血 +350 · 剑塔增威" },
        { stones: 155, mats: { core: 3, jade: 2 },          eff: "常驻减伤 +8 · 守卫战增设第 3 座【北护山剑塔】！" },
        { stones: 275, mats: { jade: 3, soul: 2 },          eff: "常驻减伤 +12 · 剑塔连射提速 30% · 核心 +1050 血" },
        { stones: 430, mats: { soul: 3, dao: 2 },           eff: "常驻减伤 +16 · 三塔极速雷光阵 · 洞府大阵圆满" }
      ],
      summaryFn: lv => `常驻减伤 +${(lv - 1) * 4} · 护山灵塔 ${lv >= 3 ? "3座" : "2座"}`
    }
  ];

  const SANCTUM_PROSPERITY_TIERS = [
    { minLv: 5,  title: "初辟灵洞", col: "#9ab5b0" },
    { minLv: 9,  title: "清韵小筑", col: "#70ffe6" },
    { minLv: 14, title: "紫微仙庭", col: "#80c8ff" },
    { minLv: 19, title: "太虚洞天", col: "#d69eff" },
    { minLv: 23, title: "混元圣域", col: "#ffe28a" }
  ];

  const COMPANION_HUB_DIALOGUES = {
    shen: {
      favMat: "herb", favCount: 3, favLabel: "凝气草 ×3",
      sparReward: "气血回复并获药香护盾 +18%",
      greetings: {
        righteous: [
          "山雨初歇，清禾新煮了一壶青莲安神茶。道友守正清虚，灵脉澄澈了许多。",
          "近来山下村落太平，皆赖道友除妖卫道。若见寿元渐紧，紫微丹鼎升阶后可炼【延寿青莲丹】。"
        ],
        neutral: [
          "破庙一别至今，听雨洞府倒渐渐有了烟火气。出征前别忘了满酿九转仙葫。",
          "清禾替你晒好了几味新采灵草，若秘境险恶，宁可御剑遁走也莫硬撑伤了道基。"
        ],
        demonic: [
          "你袖间血煞又浓了几分……坐下喝口温药吧。纵使天下人畏你魔剑，清禾的药炉仍为你留火。",
          "以血炼煞虽能极速破境，切记不可妄服黑市煞丹折损过多寿元，清禾会担心的。"
        ]
      },
      teaLines: {
        righteous: "竹影摇窗，药香袅袅。沈清禾为你斟满青莲露：『能与心存仁善之人同行仙途，此生无憾。』",
        neutral:   "细雨打芭蕉，炉上茶沸。沈清禾轻笑：『忙于破境斩妖，也别忘了在洞府停下来喝盏热茶。』",
        demonic:   "药汤泛起微光，暂时压下你周身燥烈血气。沈清禾轻声道：『道心本在你手，勿让凶剑反噬本心。』"
      },
      postBattle: {
        righteous: "清禾浅笑收阵：『剑光澄澈、分毫不乱，此战既诛群妖又护住自身灵脉！』",
        neutral:   "清禾递来丝帕：『好一场酣畅剑舞，回洞府歇息片刻再整备下卷吧。』",
        demonic:   "清禾为你抹去眉角血渍：『这血煞剑意何等霸道……所幸你未失神智。』"
      }
    },
    pei: {
      favMat: "core", favCount: 2, favLabel: "妖核 ×2",
      sparReward: "切磋领悟剑意 +45% · 修为精进",
      greetings: {
        righteous: [
          "哈哈！刚才见你演武一剑浩然如青云破晓，裴某手痒得很，可敢切磋十招？",
          "秘境五层星图愈发凶险，盾卫前顶、妖师施法、影袭绕后——先斩妖师，方显剑修本色！"
        ],
        neutral: [
          "道友回洞府了？正好，天工剑炉若能升阶，你我二人的本命佩剑都能省下不少淬火灵石。",
          "剑修一途无他，唯快、唯准、唯敢于在妖王金芒刹那迎剑识破！"
        ],
        demonic: [
          "好一股骇人的血煞剑压！裴某握剑的手都在发颤——来来来，让我瞧瞧你的【血煞狂剑诀】！",
          "魔心虽烈，但只要你手中剑仍是自己握着，裴照便永远认你这个对手与挚友！"
        ]
      },
      teaLines: {
        righteous: "裴照举杯敬苍穹：『太清剑意配山泉清酿，痛快！他日九霄天门，我为你斩开第一重罡风！』",
        neutral:   "两人以剑代箸、对坐论招。裴照大笑：『这一记切手派生改得妙极！』",
        demonic:   "烈酒入喉如吞剑火！裴照目射精光：『纵入魔道又如何？剑斩万古，只需问心无愧！』"
      },
      postBattle: {
        righteous: "裴照拊掌大笑：『好一记浩然破势！这一战看得裴某热血沸腾！』",
        neutral:   "裴照抱剑颔首：『招式衔接愈发老辣，下一卷妖王怕也撑不过几合！』",
        demonic:   "裴照咧嘴一笑：『血煞漫天、一剑断魂！这等杀伐气魄，九州难逢敌手！』"
      }
    },
    lu: {
      favMat: "jade", favCount: 2, favLabel: "地脉灵玉 ×2",
      sparReward: "传功指点 · 修为与护脉悟性精进",
      greetings: {
        righteous: [
          "青云宗千年未见你这般清正剑心！云岚百宝阁已对你开放【太清仙珍】九折特供。",
          "洞府五座灵脉建筑相辅相成：藏经阁旺远征，护山大阵保平安，不可偏废。"
        ],
        neutral: [
          "修行讲究财侣法地。把秘境带回的灵玉、妖核投入洞府升阶，远比堆在行囊划算。",
          "记牢了：每次破境皆能大增寿元，切莫在低阶境界蹉跎光阴至大限将近。"
        ],
        demonic: [
          "老夫察觉你体内煞气翻涌……青云宗门规虽严，但你仍守听雨洞府未伤无辜，老夫便再信你一回。",
          "坊市暗处已有赤渊黑市商客寻你。黑市魔宝威猛却常折寿元，取舍之间好自为之！"
        ]
      },
      teaLines: {
        righteous: "陆玄松抚须品茗：『有你承继青云薪火，老夫纵然百年之后亦能含笑九泉。』",
        neutral:   "陆玄松摊开洞府灵脉图，细细指点各阶阵眼与破境丹火候要诀。",
        demonic:   "陆玄松一盏清茶推至案前：『以煞御剑，切忌反为剑奴。老夫这口山门古钟，随时为你镇心。』"
      },
      postBattle: {
        righteous: "陆玄松欣慰颔首：『稳扎稳打、攻守有度，颇有宗门真传大将之风！』",
        neutral:   "陆玄松轻捻胡须：『此战历练极佳，记得清点战利品并检视洞府建设。』",
        demonic:   "陆玄松微微一叹：『煞威滔天、速决敌阵，只是收剑后莫忘静坐吐纳平复心魔。』"
      }
    },
    yan: {
      favMat: "lotus", favCount: 2, favLabel: "月华莲 ×2",
      sparReward: "古镜照心 · 洞察破绽并获道心感悟",
      greetings: {
        righteous: [
          "古镜照你灵台，清如秋水无纤尘。如此道心，日后登仙台天门道影难以撼动。",
          "凡人寿不过甲子，唯有破境与灵丹可逆光阴。看淡荣辱，却不可轻抛岁寿。"
        ],
        neutral: [
          "残碑刻名易，铭记来路难。听雨洞府里这几位故人，才是你逆天问道时最稳的锚。",
          "我常在镜中窥见五层星图变幻——有时绕开血战、赴一趟太初灵泉，反是上策。"
        ],
        demonic: [
          "镜中映出滔天血焰，却未见迷失之眼。奇哉，你竟能执劫煞魔心而不忘故人。",
          "正道多护生，魔心重破障。天门之上只问真我，不问世俗褒贬。"
        ]
      },
      teaLines: {
        righteous: "砚尘拂镜微笑：『光阴似水，幸得青山故人犹在。这一盏照影清茶，敬你的初心。』",
        neutral:   "砚尘慢研墨汁：『今日听雨，明日登仙。把你的事迹记在生平卷里，莫叫岁月抹去。』",
        demonic:   "砚尘凝望镜中红莲：『能把魔焰炼作照夜灯火者，古往今来寥寥无几。』"
      },
      postBattle: {
        righteous: "砚尘抚镜微笑：『心如明镜，妖邪破绽自现于前，好剑法。』",
        neutral:   "砚尘提笔录卷：『又破一重关隘，离九霄天门更近一步。』",
        demonic:   "砚尘轻叹一声：『以杀止杀，以煞镇妖，镜中血光倒映出一番凌厉气象。』"
      }
    }
  };

  const BOSS_KARMA_MONOLOGUES = {
    wolf: {
      righteous: "雾隐狼王低吼：『好刺眼的太清正气……撕碎你这满身药香的伪君子！』",
      neutral:   "雾隐狼王龇牙咆哮：『闯我青岚荒野，便拿命来祭这山雨夜！』",
      demonic:   "雾隐狼王毛发倒竖：『你身上怎有比妖煞更凶戾的血气？！退后！』"
    },
    warden: {
      righteous: "守山石卫洪声如钟：『太清灵光纯正！且接老石卫三锤试道！』",
      neutral:   "守山石卫重锤砸地：『青云山门试剑，无破势之能者止步于此！』",
      demonic:   "守山石卫金阵暴涨：『竟携赤渊魔煞擅闯青云仙台？镇妖金阵，诛！』"
    },
    serpent: {
      righteous: "寒潭玄蛇嘶鸣：『区区正道剑修，也敢以清虚莲光净我千年寒潭？』",
      neutral:   "寒潭玄蛇破冰腾起：『凡闯照影寒潭者，皆化潭底冰雕！』",
      demonic:   "寒潭玄蛇竖瞳微缩：『好霸道的血煞魔意……吞了你，本座便可化蛟！』"
    },
    puppet: {
      righteous: "古境剑傀铜镜鸣响：『太清剑道传人？且看铜镜能否照破你之无垢剑心！』",
      neutral:   "古境剑傀缓缓拔剑：『千年剑冢无生人，唯有胜过旧影者方能前行。』",
      demonic:   "古境剑傀红芒骤盛：『检测到绝世劫煞剑意——启封古冢灭魔剑阵！』"
    },
    shadow: {
      righteous: "照影心魇阴笑：『满口仁义道德，让我剖开你伪善的清虚假面！』",
      neutral:   "照影心魇幽影重重：『照影成魔，你敢直面自己最怕的执念吗？』",
      demonic:   "照影心魇狂喜大笑：『同源魔血！来吧，让我看看谁才是真正的煞剑之主！』"
    },
    sentinel: {
      righteous: "云台守灵肃然拱手：『清虚正道，功德圆满——请以毕生剑道叩开天门！』",
      neutral:   "云台守灵金甲生辉：『历经五境星图至此，唯有斩破本座方可问仙！』",
      demonic:   "云台守灵雷戟直指：『身负滔天劫煞亦敢叩问九霄？天雷不容魔剑，受诛！』"
    },
    trial_gate: {
      righteous: "天门道影垂眸：『以仁心护苍生，以正剑开天门——今日证你太清真仙果！』",
      neutral:   "天门道影轰然回响：『凡尘百载皆为序卷，拔剑斩断最后一重天障！』",
      demonic:   "天门道影震怒雷鸣：『逆天魔胎竟踏碎云阶至此！既不跪天，便以血剑开天！』"
    }
  };

  const KARMA_ENCOUNTER_EXTRAS = {
    ancient_sword_mound: {
      righteous: { id: "karma_r_sword", label: "☯ [正道专属] 太清渡剑灵", detail: "清虚正道 +12 · 护体减伤永久 +5 · 获灵石 +110 · 仁心 +12", karma: 12, drBonus: 5, stones: 110, dao: { benevolence: 12 } },
      demonic:   { id: "karma_d_sword", label: "🔥 [魔心专属] 血煞吞剑魄", detail: "劫煞魔心 -15 · 剑道攻击永久 +18 · 环身飞剑 +1 · 锋芒 +14", karma: -15, atkBonus: 18, bonusSword: 1, dao: { edge: 14 } }
    },
    cold_pond_spring: {
      righteous: { id: "karma_r_spring", label: "☯ [正道专属] 净莲延寿露", detail: "清虚正道 +12 · 获【延寿青莲丹】×1 · 永久延寿 +15 载 · 状态全满", karma: 12, longevityPill: 1, lifespanMonths: 180, fullHeal: true, dao: { benevolence: 10, serenity: 8 } },
      demonic:   { id: "karma_d_spring", label: "🔥 [魔心专属] 魔焰沸寒煞", detail: "劫煞魔心 -15 · 剑道攻击永久 +16 · 获妖核 ×3 · 剑意 100%", karma: -15, atkBonus: 16, cores: 3, fillIntent: true, dao: { edge: 12 } }
    },
    alchemist_remnant: {
      righteous: { id: "karma_r_furnace", label: "☯ [正道专属] 紫微济世丹", detail: "清虚正道 +12 · 获回春丹 ×3、延寿青莲丹 ×1 · 沈清禾羁绊提升", karma: 12, healPills: 3, longevityPill: 1, bond: "shen", dao: { benevolence: 14 } },
      demonic:   { id: "karma_d_furnace", label: "🔥 [魔心专属] 掠夺血丹魂", detail: "劫煞魔心 -15 · 必获仙品杀伐佩剑 · 剑道攻击永久 +12", karma: -15, atkBonus: 12, gearSlot: "weapon", gearRarity: 3, dao: { edge: 12 } }
    }
  };

  const KARMA_ENDING_EPILOGUES = {
    righteous: {
      seal: "太清功德 · 正道证仙",
      epithet: "清虚护世真君",
      color: "#70ffe6",
      poem: "青莲映雨照尘寰，一剑澄明万古寒。\n莫道仙途无旧侣，长风共守百城安。",
      epilogue: "你以清虚正道叩开九霄仙门，太清功德化作甘霖泽被九州；听雨洞府灯火长明，沈清禾、裴照、陆玄松与砚尘皆立于云阶共证此段佳话。"
    },
    demonic: {
      seal: "劫煞逆天 · 魔剑开穹",
      epithet: "赤渊破劫魔尊",
      color: "#ff6b81",
      poem: "血刃惊雷裂九天，不向苍穹乞寸仙。\n纵背魔名三千载，一剑孤光照旧缘。",
      epilogue: "天雷难阻劫煞锋芒，你以无上魔剑硬生生斩裂天门禁制！诸天仙神为之震怖，唯听雨洞府一盏暖灯与故人剑影，铭记你未泯的赤诚。"
    },
    neutral: {
      seal: "太初本真 · 逍遥登仙",
      epithet: "听雨逍遥剑主",
      color: "#ffe28a",
      poem: "山雨破庙初执剑，星河万象入眸来。\n不拘正魔千秋论，自在乘风叩玉台。",
      epilogue: "不囿正统，不坠魔执，你循本心走过五境星图与九霄雷劫；携灵兽故友泛舟星海，听雨洞府之名自此流传万古。"
    }
  };



  // ==================== V14 AAA FORGE AFFIXES, SET RESONANCES, PACT OF CALAMITY & CINEMA CARDS ====================


  const REGION_POEMS = Object.assign({
    hub:       { seal: "青云仙苑", name: "听雨洞府", poem: "松风煮茗养剑魄 · 坐看云起炼金丹" },
    tower:     { seal: "无尽试炼", name: "太虚锁妖塔", poem: "九重妖氛封古塔 · 唯凭本心破万魔" },
    rush:      { seal: "踏天绝巅", name: "万剑冢论剑台", poem: "万古残剑埋忠骨 · 唯斩心魔见真吾" },
    cloud_sea: { seal: "九霄御剑", name: "九霄云海航道", poem: "御剑穿云万里风 · 紫电惊鹏破天关" },
    spire:     { seal: "九重天阶", name: "太虚登仙台", poem: "九重仙阶试道心 · 奇物加持斩天罡" },
    workshop:  { seal: "演武秘境", name: "天机论剑工坊", poem: "自定妖王炼剑锋 · 演武问道证真功" }
  }, Object.fromEntries(CAMPAIGN_ACTS.map(act => [
    `stg_${act.stageIdx}`,
    { seal: act.seal, name: act.mapName.replace(/^⚡\s*/, ""), poem: act.poem }
  ])));

  let regionCardTimer = null;
  let execStampTimer = null;
  let sceneTransitionTimer = null;
  const sceneTransitionState = {
    active: false,
    artKey: "",
    regionCardKey: null,
    startedAt: 0,
    durMs: 400,
    count: 0,
    lastWasInstant: false
  };

  function showRegionCinemaCard(key) {
    const spec = REGION_POEMS[key] || REGION_POEMS.stg_0;
    const card = document.getElementById("region-cinema-card");
    if (!card) return;
    document.getElementById("rc-seal").textContent = spec.seal;
    document.getElementById("rc-name").textContent = spec.name;
    document.getElementById("rc-poem").textContent = spec.poem;
    card.classList.add("show");
    if (regionCardTimer) clearTimeout(regionCardTimer);
    regionCardTimer = setTimeout(() => {
      card.classList.remove("show");
      regionCardTimer = null;
    }, 2300);
  }

  function transitionStageScene(artKey, regionCardKey = null, opts = {}) {
    const bgEl = document.getElementById("stage-bg-img");
    const veil = document.getElementById("scene-transition-veil");
    const nextSrc = (artKey && hasOwn(ART, artKey)) ? ART[artKey] : ART.arena_wilderness;
    const instant = !!(opts && opts.instant) || (typeof isReducedMotionActive === "function" && isReducedMotionActive());
    if (sceneTransitionTimer) {
      clearTimeout(sceneTransitionTimer);
      sceneTransitionTimer = null;
    }
    sceneTransitionState.artKey = artKey || "";
    sceneTransitionState.regionCardKey = regionCardKey || null;
    sceneTransitionState.startedAt = performance.now();
    sceneTransitionState.count += 1;
    sceneTransitionState.lastWasInstant = instant;

    if (instant || !veil) {
      if (bgEl) bgEl.src = nextSrc;
      if (veil) veil.classList.remove("active");
      sceneTransitionState.active = false;
      if (regionCardKey) showRegionCinemaCard(regionCardKey);
      return;
    }
    sceneTransitionState.active = true;
    veil.classList.add("active");
    if (bgEl) bgEl.src = nextSrc;
    sceneTransitionTimer = setTimeout(() => {
      veil.classList.remove("active");
      sceneTransitionState.active = false;
      sceneTransitionTimer = null;
      if (regionCardKey) showRegionCinemaCard(regionCardKey);
    }, 200);
  }

  let lastKillCamStampAt = 0;
  function triggerKillCamStamp(label = "一剑诛邪") {
    const now = performance.now();
    if (now - lastKillCamStampAt < 3000) return;
    lastKillCamStampAt = now;
    const level = (a11ySettings && a11ySettings.combatNoticeLevel) || "lite";
    if (!isReducedMotionActive()) {
      arena.camZoom = 1.11;
      arena.hitStop = 0.085;
    }
    Sound.bianzhong(523.25, 0.12);
    if (level === "minimal") return;
    const el = document.getElementById("execution-stamp-overlay");
    if (!el) return;
    el.textContent = label;
    el.classList.add("slam");
    if (execStampTimer) clearTimeout(execStampTimer);
    execStampTimer = setTimeout(() => el.classList.remove("slam"), 1250);
  }






  // ==================== V15 BESPOKE 5-BOSS MOVESETS & BUILD ARCHETYPE MUTATORS ====================
  const BOSS_SIGNATURE_MOVES = {
    wolf: {
      domainName: "腥风血雨界", skyTint: "rgba(95, 16, 26, 0.24)", weather: "blood_rain",
      goldName: "✦ 饿狼扑月", perilousName: "【危】血月三连撕裂爪"
    },
    warden: {
      domainName: "玄黄震岳界", skyTint: "rgba(92, 64, 18, 0.22)", weather: "amber_sand",
      goldName: "✦ 镇岳横扫", perilousName: "【危】九宫陨星裂地砸"
    },
    serpent: {
      domainName: "玄冥永冻界", skyTint: "rgba(14, 62, 86, 0.26)", weather: "blizzard",
      goldName: "✦ 玄冰摆尾", perilousName: "【危】玄冥冰封寒潮"
    },
    puppet: {
      domainName: "古冢剑煞界", skyTint: "rgba(88, 22, 48, 0.25)", weather: "sword_embers",
      goldName: "✦ 镜影疾刺", perilousName: "【危】四象封魔剑阵"
    },
    shadow: {
      domainName: "照影幽冥界", skyTint: "rgba(56, 18, 72, 0.28)", weather: "sword_embers",
      goldName: "✦ 噬影绝斩", perilousName: "【危】幽影噬心裂魂"
    },
    sentinel: {
      domainName: "九霄雷狱界", skyTint: "rgba(44, 18, 86, 0.28)", weather: "thunder_storm",
      goldName: "✦ 巡天断尘", perilousName: "【危】双龙神罚雷狱"
    },
    trial_gate: {
      domainName: "太虚天威界", skyTint: "rgba(52, 22, 96, 0.30)", weather: "thunder_storm",
      goldName: "✦ 天威断岳", perilousName: "【危】万劫天门神罚"
    }
  };

  // Phase 4: Chapter-Differentiated Enemy Variants (visual aura, combat trait & chapter lore without breaking base HP curves)
  const CHAPTER_ENEMY_VARIANTS = {
    0: {
      wolf:   { name: "雾隐疾狼", tag: "疾扑", auraColor: "#7ddcc4", trait: "swift", windupMult: 0.94 },
      warden: { name: "古庙石卫", tag: "镇石", auraColor: "#e6c278", trait: "stone" }
    },
    1: {
      warden:  { name: "护门金石卫", tag: "金盾", auraColor: "#f6cf6b", trait: "gold_ward", wardRatio: 0.32 },
      wolf:    { name: "青云妖狼",   tag: "迅爪", auraColor: "#7ee0c6", trait: "swift", windupMult: 0.92 },
      serpent: { name: "外门灵蛇",   tag: "青鳞", auraColor: "#76daf5", trait: "chill" }
    },
    2: {
      serpent: { name: "寒潭玄鳞", tag: "霜鳞", auraColor: "#72e6ff", trait: "chill" },
      warden:  { name: "寒玉石傀", tag: "冰甲", auraColor: "#9ee8ff", trait: "chill", wardRatio: 0.28 },
      puppet:  { name: "寒渊符傀", tag: "寒镜", auraColor: "#80d8ff", trait: "mirror_pulse" }
    },
    3: {
      puppet:   { name: "残剑古傀", tag: "镜反", auraColor: "#e89eff", trait: "mirror_pulse" },
      shadow:   { name: "古冢幽影", tag: "瞬影", auraColor: "#c985ff", trait: "blink_swift", windupMult: 0.90 },
      serpent:  { name: "冢渊玄蟒", tag: "煞鳞", auraColor: "#d294ff", trait: "chill" },
      sentinel: { name: "镇冢剑卫", tag: "剑阵", auraColor: "#f0b8ff", trait: "gold_ward", wardRatio: 0.34 }
    },
    4: {
      sentinel:      { name: "巡天金甲卫", tag: "天雷阵", auraColor: "#ffd278", trait: "thunder_ward", wardRatio: 0.40 },
      shadow:        { name: "劫雷心魇",   tag: "雷瞬",   auraColor: "#d69eff", trait: "blink_swift", windupMult: 0.88 },
      puppet:        { name: "天门剑卫",   tag: "天镜",   auraColor: "#ffe28a", trait: "mirror_pulse" },
      trial_heart:   { name: "天门心魇",   tag: "摄心",   auraColor: "#e89eff", trait: "blink_swift", windupMult: 0.90 },
      trial_thunder: { name: "九霄雷卫",   tag: "天雷",   auraColor: "#9ee8ff", trait: "thunder_ward", wardRatio: 0.30 }
    }
  };



  const BUILD_ROLE_GUIDE = Object.freeze({
    sword: Object.freeze({
      id: "sword",
      name: "青霜御剑",
      roleTitle: "高频叠印 · 单体破势与爆剑斩杀",
      coreLoop: "左键四段疾剑叠印 → 连招窗右键切手六象特技 → 常态右键爆剑碎盾破势",
      strengthText: "挥剑攻速 +10%、飞剑协同 +18%、暴伤 +8%，单体破势与连招爆发更锐利",
      weaknessText: "群怪覆盖与回蓝略逊雷符，依赖走位与识破控节奏",
      recommendedAffixes: ["posture_crush", "wind_rider", "vamp_blade"]
    }),
    talisman: Object.freeze({
      id: "talisman",
      name: "紫霄雷符",
      roleTitle: "回蓝续航 · 剑域/爆剑术法与链雷群压",
      coreLoop: "符印附着灼魂/寒霜 → 高频法宝剑域(E)与爆剑引爆 → 终结技触发紫霄链雷清场",
      strengthText: "回蓝速率 +25%、剑域/爆剑术法伤害 +16%、终结引紫霄链雷，群战续航更稳",
      weaknessText: "普攻挥剑攻速与单体暴伤低于御剑，更看重技能循环与剑元规划",
      recommendedAffixes: ["sky_thunder", "wind_rider", "xuanwu_ward"]
    })
  });

  function getBuildPositioningSummary(g) {
    const schoolSpec = getSchoolSpecBonus(g);
    const guide = BUILD_ROLE_GUIDE[schoolSpec.id] || BUILD_ROLE_GUIDE.sword;
    const wf = (g && g.weaponForm) || "sword";
    const weaponNames = { sword: "青霜飞剑", spear: "游龙长枪", chakram: "日月剑轮" };
    const postureId = (arena && arena.weaponPosture === "xuanzhong") ? "xuanzhong" : "qinglian";
    const postureName = postureId === "xuanzhong" ? "玄重巨阙式（剑威+28% · 减伤+16 · 霸体）" : "青莲疾剑式（攻速+14% · 移速+10% · 叠印）";
    const sixAspect = typeof getCurrentSixAspectSpec === "function"
      ? getCurrentSixAspectSpec()
      : { key: "sword_qinglian", short: "游龙七刺", name: "万剑游龙刺", desc: "" };
    return {
      schoolId: guide.id,
      schoolName: guide.name,
      roleTitle: guide.roleTitle,
      coreLoop: guide.coreLoop,
      strengthText: guide.strengthText,
      weaknessText: guide.weaknessText,
      recommendedAffixes: guide.recommendedAffixes.slice(),
      stances: [
        { name: "游龙阵", role: "追猎叠印 · 快速叠满剑印" },
        { name: "剑轮阵", role: "护体斩弹 · 稳健近身防弹幕" },
        { name: "巨阙阵", role: "重劈破势 · 集中削减首领架势" }
      ],
      weaponForm: wf,
      weaponName: weaponNames[wf] || "青霜飞剑",
      postureId,
      postureName,
      sixAspect: {
        key: sixAspect.key,
        short: sixAspect.short,
        name: sixAspect.name,
        desc: sixAspect.desc
      }
    };
  }

  let floatRadialSeq = 0;
  let relicToastTimer = null;

  function showRelicDharmaToast(txt) {
    const el = document.getElementById("relic-dharma-toast");
    if (!el) return;
    el.textContent = txt;
    el.classList.add("active");
    if (relicToastTimer) clearTimeout(relicToastTimer);
    relicToastTimer = setTimeout(() => el.classList.remove("active"), 2100);
  }

  function isWanJianBuild(g) {
    if (!g) return false;
    const sb = getActiveSetBonus(g);
    return hasDestinyFruit(g, "sword_twin") || hasSynergy(g, "zhuxian") || (sb && sb.minR >= 3);
  }

  function isThunderBuild(g) {
    if (!g) return false;
    return hasDestinyFruit(g, "thunder_soul") || hasSynergy(g, "thunder_emp") || g.school === "talisman" || hasGearAffix(g, "sky_thunder");
  }

  function triggerChainLightning(originX, originY, baseDmg, maxJumps = 3) {
    const prevLB = arena.currentDmgBucket; arena.currentDmgBucket = 'thunder_elem';
    triggerElectroPoolReaction(originX, originY, baseDmg);
    if (!game || arena.enemies.length === 0) return;
    let cx = originX, cy = originY;
    const hitSet = new Set();
    for (let j = 0; j < maxJumps; j++) {
      let best = null, bestD = 240;
      for (const e of arena.enemies) {
        if (e.hp > 0 && !hitSet.has(e.uid)) {
          const d = Math.hypot(e.x - cx, e.y - cy);
          if (d < bestD) { bestD = d; best = e; }
        }
      }
      if (!best) break;
      hitSet.add(best.uid);
      arena.lightnings.push({ x1: cx, y1: cy - 12, x2: best.x, y2: best.y - 12, t: 0, color: "#d69eff" });
      best.swordMarks = Math.min(6, (best.swordMarks || 0) + 1);
      damageEnemy(best, Math.max(4, Math.round(baseDmg * Math.pow(0.82, j))), false, 8, 0, 2, false);
      triggerElectroPoolReaction(best.x, best.y, baseDmg);
      cx = best.x; cy = best.y;
    }
    arena.currentDmgBucket = prevLB;
  }

  function shuffleFisherYates(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }





  function openAffixEngraveModal(slot) {
    if (!game || !game.equippedGear || !game.equippedGear[slot]) return;
    const eq = game.equippedGear[slot];
    const slotNames = { weapon: "本命佩剑", armor: "护身仙衣", ring: "乾坤灵佩" };
    const activeSchoolTag = game.school === "talisman" ? "雷符推荐" : "御剑推荐";
    openModal(`
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div>
          <span class="cinnabar-seal">定向铭刻</span>
          <strong style="font-family:var(--font-serif);font-size:19px;color:var(--gold-bright);margin-left:8px;">${slotNames[slot] || "神兵"} · 自选圣品词条</strong>
        </div>
        <button type="button" class="btn-ghost" data-modal-close="1">关闭 ×</button>
      </div>
      <div style="font-size:12px;color:var(--text-sub);display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
        <span>当前装备：<b class="txt-r${rarityNum(eq.rarity)}">${escapeHtml(eq.name)}</b>（${escapeHtml(formatGearStats(eq))}）</span>
        <span style="color:var(--gold-bright);">定向刻录消耗：35 灵石（100% 确定生效 · 当前流派优先：${activeSchoolTag}）</span>
      </div>
      <div class="affix-pick-grid">
        ${SACRED_AFFIXES.map(af => {
          const isCur = eq.affix === af.id;
          const tags = Array.isArray(af.buildTags) ? af.buildTags : [];
          return `
            <button type="button" class="affix-pick-card ${isCur ? "current-affix" : ""}" data-engrave-slot="${slot}" data-engrave-affix="${af.id}" ${isCur ? "disabled" : ""}>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                <strong style="font-family:var(--font-serif);font-size:14px;color:#ffe89e;">${af.name}</strong>
                <span class="tag-chip ${isCur ? "done" : ""}">${isCur ? "当前已刻" : "35石定刻"}</span>
              </div>
              <div class="affix-build-tags">
                ${tags.map(tg => `<span class="tag-chip ${tg === activeSchoolTag ? "mythic" : ""}" style="font-size:10px;">${escapeHtml(tg)}</span>`).join("")}
              </div>
              <span style="font-size:11.5px;color:var(--text-sub);line-height:1.45;">${af.desc}</span>
            </button>
          `;
        }).join("")}
      </div>
    `, true);
  }

  function formatGearStats(it) {
    if (!it) return "未佩带";
    const parts = [];
    if (it.atk) parts.push(`攻+${effectiveGearVal(it, "atk")}`);
    if (it.hp) parts.push(`血+${effectiveGearVal(it, "hp")}`);
    if (it.dr) parts.push(`减伤+${effectiveGearVal(it, "dr")}`);
    if (num(it.crit, 0)) parts.push(`暴+${Math.round(num(it.crit, 0) * 100)}%`);
    if (num(it.spd, 0)) parts.push(`速+${Math.round(num(it.spd, 0) * 100)}%`);
    if (num(it.bonusSword, 0)) parts.push(`飞剑+${Math.floor(num(it.bonusSword, 0))}`);
    if (it.affix) {
      const af = SACRED_AFFIXES.find(a => a.id === it.affix);
      if (af) parts.push(`【${af.name}】`);
    }
    if (it.awakenedAffix) {
      const aw = Object.values(PRIMORDIAL_AWAKENINGS).find(a => a.id === it.awakenedAffix);
      if (aw) parts.push(`★${aw.name}`);
    }
    return parts.join(" · ") || "基础灵器";
  }

  function refreshMarketStock() {
    if (!game) return;
    const tier = Math.max(arena.stageIdx, rankOf(game.realm));
    const ks = getKarmaState(game);
    const wpn = rollGearItem(tier, Math.min(3, 1 + Math.floor(tier / 2)), "weapon", { usePity: false });
    const arm = rollGearItem(tier, Math.min(3, 1 + Math.floor(tier / 2)), "armor", { usePity: false });
    const rng = rollGearItem(tier, Math.min(4, 2 + Math.floor(tier / 2)), "ring", { usePity: false });
    if (ks.mode === "demonic") {
      wpn.atk = Math.round(wpn.atk * 1.24);
      wpn.name = wpn.name.replace("·", "·血煞");
      wpn.affix = wpn.affix || "vamp_blade";
      wpn.price = Math.round(wpn.price * 1.05);
    } else if (ks.mode === "righteous") {
      arm.hp = Math.round(arm.hp * 1.24);
      arm.dr = Math.round(arm.dr * 1.25);
      arm.name = arm.name.replace("·", "·太清");
      arm.affix = arm.affix || "xuanwu_ward";
    }
    game.marketStock = [wpn, arm, rng];
    game.karmaMarketBought = {};
  }

  function getKarmaMarketSpecials(g) {
    if (!g) return [];
    const ks = getKarmaState(g);
    const fairDisc = currentOmen(g).id === "fair" ? 0.8 : 1.0;
    const rightDisc = ks.mode === "righteous" ? 0.9 : 1.0;
    if (ks.mode === "righteous") {
      return [
        {
          id: "km_longevity", name: "☯ 太清延寿青莲丹", art: "item_lotus",
          desc: "正道珍品：服用延寿 +30 载、气血上限 +15（破大限必备）",
          cost: Math.round(95 * fairDisc * rightDisc), kind: "item", itemId: "longevity_pill", count: 1
        },
        {
          id: "km_lotus_bundle", name: "☯ 悬壶灵丹礼匣", art: "item_healing_pill",
          desc: "清虚正道专供：回春丹 ×2 + 回灵丹 ×1 + 凝气草 ×3",
          cost: Math.round(52 * fairDisc * rightDisc), kind: "bundle_right"
        }
      ];
    }
    if (ks.mode === "demonic") {
      return [
        {
          id: "km_blood_pill", name: "🔥 黑市禁丹 · 嗜血煞丹", art: "item_core",
          desc: "赤渊黑市：服用永久剑攻 +10、魔心 -15，但折损 2 载寿元",
          cost: Math.round(110 * fairDisc), kind: "item", itemId: "blood_fury_pill", count: 1
        },
        {
          id: "km_demon_core", name: "🔥 赤渊魔煞妖核匣", art: "item_soul",
          desc: "赤渊黑市：妖核 ×3 + 仙品血煞佩剑 1 件（高攻低防）",
          cost: Math.round(220 * fairDisc), kind: "bundle_demon"
        }
      ];
    }
    const caulLv = typeof getSanctumLevel === "function" ? getSanctumLevel(g, "cauldron") : 1;
    return [
      {
        id: "km_neutral_tea", name: "✦ 云岚清茶灵材包", art: "item_dew",
        desc: "本真中正：凝气草 ×4 + 晨曦灵露 ×2（偏向正魔±25解封专属商阁）",
        cost: Math.round(45 * fairDisc), kind: "bundle_neutral"
      },
      ...(caulLv >= 2 ? [{
        id: "km_longevity_std", name: "✦ 延寿青莲丹", art: "item_lotus",
        desc: "紫微丹鼎 Lv.2 秘药：服用延寿 +30 载、气血上限 +15",
        cost: Math.round(120 * fairDisc), kind: "item", itemId: "longevity_pill", count: 1
      }] : [])
    ];
  }

  function buyKarmaSpecialItem(specialId) {
    if (!game) return false;
    if (!game.karmaMarketBought) game.karmaMarketBought = {};
    if (game.karmaMarketBought[specialId]) {
      showToast("本批特供珍品已购罄，可点击【换一批】刷新货架！");
      return false;
    }
    const spec = getKarmaMarketSpecials(game).find(x => x.id === specialId);
    if (!spec) return false;
    let bfQuota = null;
    if (spec.itemId === "blood_fury_pill") {
      bfQuota = getBloodFuryQuota(game);
      if (bfQuota.remaining <= 0) {
        const rName = (REALMS[game.realm] && REALMS[game.realm].name) || "当前";
        showToast(`🔒 【嗜血煞丹】于【${rName}期】限购 ${bfQuota.max} 枚（已购 ${bfQuota.bought}/${bfQuota.max}），破境后方可再购！`);
        return false;
      }
    }
    if (game.stones < spec.cost) {
      showToast(`灵石不足（需 ${spec.cost} 灵石）`);
      return false;
    }
    game.stones -= spec.cost;
    game.karmaMarketBought[specialId] = true;
    if (spec.itemId === "blood_fury_pill" && bfQuota) {
      ensurePermGrowth(game).bloodFuryBought[game.realm] = bfQuota.bought + 1;
    }
    if (spec.kind === "item") {
      game.inventory[spec.itemId] = (game.inventory[spec.itemId] || 0) + (spec.count || 1);
      showToast(bfQuota
        ? `已购得【${spec.name}】（本境限购 ${bfQuota.bought + 1}/${bfQuota.max}），可于下方随身灵丹服用！`
        : `已购得【${spec.name}】，可于下方随身灵丹服用！`);
    } else if (spec.kind === "bundle_right") {
      game.inventory.healing_pill = (game.inventory.healing_pill || 0) + 2;
      game.inventory.spirit_pill = (game.inventory.spirit_pill || 0) + 1;
      game.inventory.herb = (game.inventory.herb || 0) + 3;
      showToast("☯ 购得【悬壶灵丹礼匣】：回春丹×2 · 回灵丹×1 · 凝气草×3！");
    } else if (spec.kind === "bundle_demon") {
      game.inventory.core = (game.inventory.core || 0) + 3;
      const dWpn = rollGearItem(Math.max(2, arena.stageIdx + 1), 3, "weapon", { usePity: false });
      dWpn.atk = Math.round(dWpn.atk * 1.28);
      dWpn.name = "魔品·赤渊噬魂剑";
      dWpn.affix = "vamp_blade";
      // F23: Cap bundled weapon resale value strictly below purchase cost to eliminate buy->smelt arbitrage while preserving full combat stats
      dWpn.sell = Math.min(dWpn.sell, Math.floor(spec.cost * 0.45));
      acquireGearItem(dWpn);
      showToast("🔥 黑市成交：妖核×3 + 【魔品·赤渊噬魂剑】已暂存对比！");
    } else if (spec.kind === "bundle_neutral") {
      game.inventory.herb = (game.inventory.herb || 0) + 4;
      game.inventory.dew = (game.inventory.dew || 0) + 2;
      showToast("✦ 购得【云岚清茶灵材包】：凝气草×4 · 晨曦灵露×2！");
    }
    Sound.fanfare();
    saveGame();
    updateHud();
    if (drawerOpen) renderDrawerContent();
    return true;
  }
