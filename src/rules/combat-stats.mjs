// Pure combat stat ledger, single-hit cap, school specialization, and Dao bonus rules.
import { num, hasOwn, softCapPct } from "./utils.mjs";
import { COMBAT_RULE_PARAMS, SINGLE_HIT_CAP_RATIO, PERM_GROWTH_CAPS } from "../config/combat-params.mjs";
import { REALM_ORDER, REALMS, CELESTIAL_OMENS } from "../config/realms-items.mjs";
import { RELICS } from "../config/progression-data.mjs";
import { getGearTotals, getActiveSetBonus, hasDestinyFruit, getSanctumBonuses } from "./gear-rules.mjs";

export function rankOf(r) {
  const idx = REALM_ORDER.indexOf(r);
  return idx >= 0 ? idx : 0;
}

export function hasLaw(g, id) {
  return g && Array.isArray(g.laws) && g.laws.includes(id);
}

export function currentOmen(g) {
  const idx = Math.floor(Math.max(0, num(g && g.omenIndex, 0))) % CELESTIAL_OMENS.length;
  return CELESTIAL_OMENS[idx] || CELESTIAL_OMENS[0];
}

export function hasPetSkill(g, skillId) {
  if (!g || !g.pet || !g.pet.id || !g.pet.skills || !skillId) return false;
  const lv = Math.max(1, Math.floor(num(g.pet.level, 1)));
  return Boolean(
    (lv >= 3 && g.pet.skills.tier3 === skillId) ||
    (lv >= 5 && g.pet.skills.tier5 === skillId)
  );
}

export function getEquippedRelicStars(g) {
  if (!g || !g.loadout || !g.loadout.relic || !hasOwn(RELICS, g.loadout.relic)) return 0;
  const rawStars = (g.relicStars && hasOwn(g.relicStars, g.loadout.relic)) ? g.relicStars[g.loadout.relic] : 1;
  return Math.max(0, Math.min(5, Math.floor(num(rawStars, 1))));
}

export function getPermGrowthCaps(g) {
  const r = (g && typeof g.realm === "string" && hasOwn(REALMS, g.realm)) ? g.realm : "mortal";
  return {
    realm: r,
    maxHpBonus: PERM_GROWTH_CAPS.totalMaxHpByRealm[r] || PERM_GROWTH_CAPS.totalMaxHpByRealm.mortal,
    atkFlatBonus: PERM_GROWTH_CAPS.totalAtkByRealm[r] || PERM_GROWTH_CAPS.totalAtkByRealm.mortal,
    alchemyHp: PERM_GROWTH_CAPS.alchemyHpByRealm[r] || PERM_GROWTH_CAPS.alchemyHpByRealm.mortal,
    alchemyAtk: PERM_GROWTH_CAPS.alchemyAtkByRealm[r] || PERM_GROWTH_CAPS.alchemyAtkByRealm.mortal,
    bloodFuryPerRealm: PERM_GROWTH_CAPS.bloodFuryPerRealm,
    spireCurioMaxStack: PERM_GROWTH_CAPS.spireCurioMaxStack
  };
}

export function getKarmaState(g) {
  const score = Math.max(-100, Math.min(100, (g && typeof g.karmaScore === "number") ? g.karmaScore : 0));
  if (score >= 25) return { mode: "righteous", score, label: `清虚正道 +${score}`, artName: "太清镇世诀", color: "#70ffe6" };
  if (score <= -25) return { mode: "demonic", score, label: `劫煞魔心 ${score}`, artName: "血煞狂剑诀", color: "#ff4d5e" };
  return { mode: "neutral", score, label: `本真中正 ${score >= 0 ? "+" + score : score}`, artName: "太初归元心", color: "#ffe28a" };
}

export function getComboTier(hits) {
  if (hits >= 30) return { label: "万剑入神", rank: "SSS", spdBonus: 0.30, critDmgBonus: 0.38, color: "#ff9f43" };
  if (hits >= 18) return { label: "剑仙临尘", rank: "S", spdBonus: 0.22, critDmgBonus: 0.26, color: "#ffe270" };
  if (hits >= 10) return { label: "剑罡破军", rank: "A", spdBonus: 0.15, critDmgBonus: 0.18, color: "#70ffe6" };
  if (hits >= 4) return { label: "灵剑初鸣", rank: "B", spdBonus: 0.08, critDmgBonus: 0.10, color: "#4ad2b8" };
  return { label: "凡剑试锋", rank: "C", spdBonus: 0, critDmgBonus: 0, color: "#9ab5b0" };
}

export function getStyleRankSpec(score = 0) {
  if (score >= 850) return { rank: "SSS", title: "太虚剑神", color: "#ff9eff", haste: 0.30, critDmg: 0.42, intentMult: 1.60, dropPct: 45 };
  if (score >= 580) return { rank: "S", title: "天人合一", color: "#ffe270", haste: 0.22, critDmg: 0.28, intentMult: 1.35, dropPct: 25 };
  if (score >= 380) return { rank: "A", title: "剑道无双", color: "#70ffe6", haste: 0.15, critDmg: 0.18, intentMult: 1.20, dropPct: 15 };
  if (score >= 210) return { rank: "B", title: "惊鸿掠影", color: "#4ad2b8", haste: 0.09, critDmg: 0.10, intentMult: 1.10, dropPct: 8 };
  if (score >= 85) return { rank: "C", title: "剑心通明", color: "#a8e6dc", haste: 0.04, critDmg: 0.05, intentMult: 1.0, dropPct: 0 };
  return { rank: "D", title: "凡铁试锋", color: "#9ab5b0", haste: 0, critDmg: 0, intentMult: 1.0, dropPct: 0 };
}

export function getDaoBonuses(g) {
  const dao = (g && g.dao) || { benevolence: 6, edge: 10, serenity: 6 };
  const b = Math.max(0, Number(dao.benevolence) || 0);
  const e = Math.max(0, Number(dao.edge) || 0);
  const s = Math.max(0, Number(dao.serenity) || 0);
  const healMult = 1 + Math.min(0.28, b * 0.0045);
  const shieldMult = 1 + Math.min(0.25, b * 0.004);
  const postureMult = 1 + Math.min(0.25, e * 0.004);
  const critBonus = Math.min(0.08, e * 0.0012);
  const execMult = 1 + Math.min(0.18, e * 0.003);
  const mpRegenMult = 1 + Math.min(0.32, s * 0.005);
  const stoneMult = 1 + Math.min(0.24, s * 0.004);
  let dominant = "edge";
  if (b >= e && b >= s) dominant = "benevolence";
  else if (s >= e && s >= b) dominant = "serenity";
  const domMap = {
    benevolence: { title: "仁心济世", color: "#70ffe6" },
    edge: { title: "锋芒凌霄", color: "#ffd278" },
    serenity: { title: "本真通明", color: "#c792ff" }
  };
  return {
    benevolence: b, edge: e, serenity: s,
    healMult, shieldMult, postureMult, critBonus, execMult, mpRegenMult, stoneMult,
    dominant,
    dominantTitle: domMap[dominant].title,
    dominantColor: domMap[dominant].color
  };
}

export function getSchoolSpecBonus(g) {
  const isTalisman = !!(g && g.school === "talisman");
  if (isTalisman) {
    return {
      id: "talisman",
      name: "紫霄雷符",
      badge: "回蓝+25% · 剑域/爆发术法+16% · 终结引紫霄链雷",
      hasteBonus: 0,
      critMultBonus: 0,
      swordSynergyMult: 1.0,
      mpRegenMult: 1.25,
      skillDmgMult: 1.16,
      chainLightningOnFinisher: true,
      color: "#d69eff"
    };
  }
  return {
    id: "sword",
    name: "青霜御剑",
    badge: "挥剑攻速+10% · 飞剑协同+18% · 暴伤+8% · 四式增剑",
    hasteBonus: 0.10,
    critMultBonus: 0.08,
    swordSynergyMult: 1.18,
    mpRegenMult: 1.0,
    skillDmgMult: 1.0,
    chainLightningOnFinisher: false,
    color: "#70ffe6"
  };
}

export function applySingleHitCap(rawDmg, maxHp, dmgReduce = 0, opts = {}) {
  if (typeof rawDmg !== "number" || Number.isNaN(rawDmg) || rawDmg <= 0) return 0;
  const pactEnemyMult = (opts && opts.pactEnemyMult != null) ? opts.pactEnemyMult : 1.0;
  const wardMult = (opts && opts.wardMult != null) ? opts.wardMult : 1.0;
  const drMult = Math.max(0.35, 100 / (100 + Math.max(0, dmgReduce || 0)));
  let dmg = Math.max(4, Math.round(rawDmg * pactEnemyMult * drMult * wardMult));
  if (!(opts && opts.uncapped)) {
    const singleHitCap = Math.max(4, Math.round(Math.max(1, num(maxHp, 1)) * SINGLE_HIT_CAP_RATIO));
    dmg = Math.min(dmg, singleHitCap);
  }
  return dmg;
}

export function getMaxHp(g, env = null) {
  const gSafe = (g && typeof g === "object") ? g : { realm: "mortal" };
  const gt = getGearTotals(gSafe);
  const starFn = (env && typeof env.getStarChartBonuses === "function")
    ? env.getStarChartBonuses
    : (typeof getStarChartBonuses === "function" ? getStarChartBonuses : null);
  const sb = starFn ? starFn(gSafe) : { atk: 0, hp: 0, dr: 0, crit: 0, critMult: 0, spd: 0, mp: 0 };
  const starCoreFn = (env && typeof env.hasStarCore === "function")
    ? env.hasStarCore
    : (typeof hasStarCore === "function" ? hasStarCore : null);
  const tortoiseMult = (starCoreFn && starCoreFn(gSafe, "black_tortoise")) ? 1.18 : 1.0;
  const petHpMult = hasPetSkill(gSafe, "spirit_ward") ? 1.08 : 1.0;
  const realmHp = (REALMS[gSafe.realm] && REALMS[gSafe.realm].maxHp) || 80;
  const rawStatMult = Number(gSafe.statMultBonus);
  const safeStatMult = (Number.isFinite(rawStatMult) && rawStatMult >= 0.1) ? rawStatMult : 1;
  const rawHpBonus = Number(gSafe.maxHpBonus);
  const safeHpBonus = (Number.isFinite(rawHpBonus) && rawHpBonus >= 0) ? rawHpBonus : 0;
  const statCap = 1 + softCapPct(Math.max(0, safeStatMult - 1), 0.75, 1.40);
  return Math.round((realmHp + safeHpBonus + gt.hp + sb.hp) * statCap * tortoiseMult * petHpMult);
}

export function computeCombatStatLedger(g, env = null) {
  const gSafe = (g && typeof g === "object") ? g : { realm: "mortal" };
  const refArena = (env && "arena" in env) ? env.arena : (typeof arena !== "undefined" ? arena : null);
  const starFn = (env && typeof env.getStarChartBonuses === "function")
    ? env.getStarChartBonuses
    : (typeof getStarChartBonuses === "function" ? getStarChartBonuses : null);
  const celFn = (env && typeof env.getCurrentCelestialPhase === "function")
    ? env.getCurrentCelestialPhase
    : (typeof getCurrentCelestialPhase === "function" ? getCurrentCelestialPhase : null);
  const curioFn = (env && typeof env.getCurioStacks === "function")
    ? env.getCurioStacks
    : (typeof getCurioStacks === "function" ? getCurioStacks : null);
  const boonFn = (env && typeof env.hasRunBoon === "function")
    ? env.hasRunBoon
    : (typeof hasRunBoon === "function" ? hasRunBoon : null);
  const climFn = (env && typeof env.getActiveDungeonClimate === "function")
    ? env.getActiveDungeonClimate
    : (typeof getActiveDungeonClimate === "function" ? getActiveDungeonClimate : null);

  const finiteNonNeg = (v, fb = 0) => {
    const n = Number(v);
    return (Number.isFinite(n) && n >= 0) ? n : fb;
  };
  const finiteStatMult = (v) => {
    const n = Number(v);
    return (Number.isFinite(n) && n >= 0.1) ? n : 1;
  };
  const P = COMBAT_RULE_PARAMS;
  const r = REALMS[gSafe.realm] || REALMS.mortal;
  const gt = getGearTotals(gSafe);
  const maxHp = getMaxHp(gSafe, env);
  const safeStatMult = finiteStatMult(gSafe.statMultBonus);
  const safeStones = finiteNonNeg(gSafe.stones, 0);
  const safeKarmaDrBonus = finiteNonNeg(gSafe.karmaDrBonus, 0);
  const safeStartAge = finiteNonNeg(gSafe.startAgeMonths, 216);
  const safeElapsedMonths = finiteNonNeg(gSafe.elapsedMonths, 0);
  const maxMpBase = Math.round(r.maxMp * (1 + Math.min(0.65, Math.max(0, safeStatMult - 1))));
  const stars = getEquippedRelicStars(gSafe);
  const starScale = 1 + Math.max(0, stars - 1) * 0.18;
  const lo = (gSafe.loadout && typeof gSafe.loadout === "object") ? gSafe.loadout : {};
  const pet = (gSafe.pet && typeof gSafe.pet === "object") ? gSafe.pet : {};
  const mindBonus = lo.mind === "sword_pierce" ? P.skills.sword_pierce.mindAtk : lo.mind === "talisman_clear" ? P.skills.talisman_clear.mindAtk : 0;
  const relicBonus = Math.round(((lo.relic === "frost_sword" ? 9 : lo.relic === "soul_lamp" ? 8 : 4) * (lo.relic ? starScale : 0)));
  const starB = starFn ? starFn(gSafe) : { atk: 0, hp: 0, dr: 0, crit: 0, critMult: 0, spd: 0, mp: 0 };
  const sanctumB = getSanctumBonuses(gSafe);
  const years = Math.floor((safeStartAge + safeElapsedMonths) / 12);
  const entries = [];
  const addEntry = (id, label, category, bucket, rawContribution, cap, conditionText, active) => {
    const rawVal = Number(rawContribution);
    const safeRaw = Number.isFinite(rawVal) ? rawVal : 0;
    entries.push({
      id,
      label,
      category,
      bucket,
      rawContribution: safeRaw,
      cap: cap == null ? null : cap,
      effectiveDelta: active ? safeRaw : 0,
      conditionText: conditionText || "常驻生效",
      active: Boolean(active)
    });
  };

  // Bucket 1: Flat Foundation ATK
  const realmBaseAtk = 14 + r.power * 1.25;
  const permAtk = finiteNonNeg(gSafe.atkFlatBonus, 0);
  const perkFlatAtk = gSafe.perk === "sword_sovereign" ? 12 : gSafe.perk === "sword_bone" ? 5 : 0;
  addEntry("base_realm_atk", `境界根基 (${r.name})`, "realm", "flat_atk", realmBaseAtk, null, "随境界提升", true);
  if (gt.atk > 0) addEntry("gear_atk", "神兵仙装攻击", "gear", "flat_atk", gt.atk, null, "装备及淬火 (+8%/阶)", true);
  if (permAtk > 0) addEntry("perm_atk", "永久丹道/奇遇剑攻", "permanent", "flat_atk", permAtk, getPermGrowthCaps(gSafe).atkFlatBonus, "受本境永久上限约束", true);
  if (perkFlatAtk > 0) addEntry("perk_atk", gSafe.perk === "sword_sovereign" ? "命格 · 轮回剑主" : "命格 · 先天剑骨", "perk", "flat_atk", perkFlatAtk, null, "先天命格常驻", true);
  if (mindBonus > 0) addEntry("mind_atk", lo.mind === "sword_pierce" ? "心法 · 破妄剑心" : "心法 · 清虚符心", "skill", "flat_atk", mindBonus, null, "装备于心法槽时生效", true);
  if (relicBonus > 0) addEntry("relic_atk", `本命法宝 ★${stars}`, "relic", "flat_atk", relicBonus, null, "佩带法宝及星级加成", true);
  if (starB.atk > 0) addEntry("star_atk", "周天星图剑攻", "star", "flat_atk", starB.atk, null, "已点亮星节点（星夜翻倍）", true);
  if (sanctumB.forgeAtk > 0) addEntry("sanctum_forge_atk", "洞府 · 天工剑炉", "sanctum", "flat_atk", sanctumB.forgeAtk, 32, "剑炉每级 +8 剑攻", true);
  const baseAtk = realmBaseAtk + gt.atk + permAtk + perkFlatAtk + mindBonus + relicBonus + starB.atk + sanctumB.forgeAtk;

  // Bucket 2: Passive Additive Bonus Pool (soft-capped at knee 0.95, max 1.65)
  const setB = getActiveSetBonus(gSafe);
  const ks = getKarmaState(gSafe);
  const celPh = celFn ? celFn() : { id: "dawn" };
  const stoneCurioLv = curioFn ? curioFn(gSafe, "curio_stone_alchemy") : 0;
  const shieldThornLv = curioFn ? curioFn(gSafe, "curio_shield_thorns") : 0;
  const curHp = (typeof gSafe.hp === "number" && Number.isFinite(gSafe.hp) && gSafe.hp >= 0) ? gSafe.hp : maxHp;
  const phoenixLowHp = gSafe.perk === "calamity_phoenix" && curHp <= maxHp * 0.45;

  const statMultPassive = Math.max(0, safeStatMult - 1) * 0.75;
  let rawPassivePct = statMultPassive;
  if (statMultPassive > 0) addEntry("stat_mult_passive", "先天/历练倍增", "permanent", "passive_pct", statMultPassive, null, "并入常驻增伤池", true);
  if (gSafe.perk === "calamity_phoenix") {
    addEntry("perk_phoenix_pct", "命格 · 劫火涅槃体", "perk", "passive_pct", 0.22, 0.22, "气血 ≤45% 时触发", phoenixLowHp);
    if (phoenixLowHp) rawPassivePct += 0.22;
  }
  if (hasLaw(gSafe, "age_might")) {
    const v = Math.min(P.laws.age_might.maxPct, Math.floor(Math.max(0, years - P.laws.age_might.baseAge) / P.laws.age_might.yearsPerStep) * P.laws.age_might.pctPerStep);
    rawPassivePct += v;
    addEntry("law_age_might", "法则 · 岁积道威", "law", "passive_pct", v, P.laws.age_might.maxPct, `当前骨龄 ${years} 载`, v > 0);
  }
  if (hasLaw(gSafe, "karma_resonance")) {
    const v = Math.min(P.laws.karma_resonance.maxPct, Object.keys(gSafe.choices || {}).length * P.laws.karma_resonance.pctPerChoice);
    rawPassivePct += v;
    addEntry("law_karma_res", "法则 · 红尘共鸣", "law", "passive_pct", v, P.laws.karma_resonance.maxPct, `已结尘缘 ${Object.keys(gSafe.choices || {}).length} 项`, v > 0);
  }
  if (hasLaw(gSafe, "wealth_power")) {
    const v = Math.min(P.laws.wealth_power.maxPct, Math.floor(safeStones / P.laws.wealth_power.perStones) * P.laws.wealth_power.pctPerStep);
    rawPassivePct += v;
    addEntry("law_wealth_power", "法则 · 聚宝乾坤", "law", "passive_pct", v, P.laws.wealth_power.maxPct, `当前持有 ${Math.floor(safeStones)} 灵石`, v > 0);
  }
  if (stoneCurioLv > 0) {
    const v = Math.min(PERM_GROWTH_CAPS.curioStoneAlchemyDmgCap, Math.floor(safeStones / 100) * 0.04 * stoneCurioLv);
    rawPassivePct += v;
    addEntry("curio_stone_alchemy", `奇物 · 聚灵炼金 ×${stoneCurioLv}`, "boon", "passive_pct", v, PERM_GROWTH_CAPS.curioStoneAlchemyDmgCap, "随持有灵石增伤", v > 0);
  }
  if (shieldThornLv > 0) {
    const hasSh = Boolean(refArena && refArena.player && (refArena.player.shieldHp || 0) > 0);
    const v = Math.min(0.45, 0.20 * shieldThornLv);
    if (hasSh) rawPassivePct += v;
    addEntry("curio_shield_thorns", `奇物 · 玄武反震甲 ×${shieldThornLv}`, "boon", "passive_pct", v, 0.45, "持护体灵盾时生效", hasSh);
  }
  if (setB && setB.atkMult) {
    rawPassivePct += setB.atkMult;
    addEntry("gear_set_atk", `套装 · ${setB.name}`, "gear", "passive_pct", setB.atkMult, null, "三件同品阶以上激活", true);
  }
  const karmaPassive = ks.mode === "demonic" ? 0.18 : ks.mode === "righteous" ? 0.06 : 0;
  if (karmaPassive > 0) {
    rawPassivePct += karmaPassive;
    addEntry("karma_passive", `道心 · ${ks.artName}`, "karma", "passive_pct", karmaPassive, null, ks.mode === "demonic" ? "魔心 ≤-25 常驻" : "正道 ≥+25 常驻", true);
  }
  const celPassive = celPh.id === "noon"
    ? P.celestialPhases.noon.passiveAtkPct
    : (celPh.id === "blood_dusk"
      ? (ks.mode === "demonic" ? P.celestialPhases.blood_dusk.demonicPassiveAtkPct : P.celestialPhases.blood_dusk.otherPassiveAtkPct)
      : 0);
  if (celPassive > 0) {
    rawPassivePct += celPassive;
    addEntry("celestial_passive", celPh.id === "noon" ? "天时 · 午时骄阳" : "天时 · 血月黄昏", "celestial", "passive_pct", celPassive, null, "当前天时常驻池加成", true);
  }
  if (boonFn && boonFn("gold_alchemist")) {
    const v = Math.min(P.runBoons.gold_alchemist.maxPct, Math.floor(safeStones / P.runBoons.gold_alchemist.perStones) * P.runBoons.gold_alchemist.pctPerStep);
    rawPassivePct += v;
    addEntry("boon_gold_alchemist", "秘境词条 · 点石成锋", "boon", "passive_pct", v, P.runBoons.gold_alchemist.maxPct, "本场秘境有效", v > 0);
  }
  if (refArena && refArena.player && (refArena.player.boonOverloadTimer || 0) > 0) {
    rawPassivePct += P.runBoons.gourd_overload.passiveAtkPct;
    addEntry("boon_gourd_overload", "秘境词条 · 仙酿剑狂", "boon", "passive_pct", P.runBoons.gourd_overload.passiveAtkPct, P.runBoons.gourd_overload.passiveAtkPct, "饮仙葫后限时触发", true);
  }
  const petWrathBuffActive = Boolean(refArena && refArena.player && (refArena.player.petBuffTimer || 0) > 0 && hasPetSkill(gSafe, "celestial_wrath"));
  if (petWrathBuffActive) {
    rawPassivePct += 0.16;
    addEntry("pet_wrath_passive", "灵宠技 · 天威狂怒", "pet", "passive_pct", 0.16, 0.16, "灵宠助战增益期间", true);
  }
  const cappedPassivePct = softCapPct(rawPassivePct, P.passiveSoftCapKnee, P.passiveSoftCapMax);
  const passiveRatio = rawPassivePct > 0 ? (cappedPassivePct / rawPassivePct) : 1;
  entries.forEach(ent => {
    if (ent.bucket === "passive_pct" && ent.active) {
      ent.effectiveDelta = Number((ent.rawContribution * passiveRatio).toFixed(4));
    }
  });

  // Bucket 3: Active Stance / Burst / Climate Multiplier (capped cleanly at 1.95x)
  const revMult = (refArena && (refArena.reversedDomainTimer || 0) > 0) ? 1.20 : 1.0;
  const isHeavyPosture = Boolean(refArena && refArena.weaponPosture === "xuanzhong");
  const postureAtkMult = isHeavyPosture ? 1.28 : 1.0;
  const rushGlass = Boolean(refArena && refArena.bossRush && refArena.bossRush.active && Array.isArray(refArena.rushAffixes) && refArena.rushAffixes.includes("rush_glass"));
  const rushAtkMult = rushGlass ? 1.38 : 1.0;
  const astralMult = (refArena && refArena.astralForm && refArena.astralForm.active) ? (refArena.astralForm.mode === "demonic" ? 1.45 : 1.35) : 1.0;
  const clim = climFn ? climFn() : null;
  const climateAtkMult = (clim && clim.id === "blood_haze") ? P.climates.blood_haze.playerActiveMult : 1.0;
  if (revMult > 1.0) addEntry("reversed_domain_mult", "逆转天象 · 破阵增伤", "domain", "active_mult", revMult, P.activeMultCap, "击毁阵眼柱后 10 秒", true);
  if (isHeavyPosture) addEntry("posture_heavy_mult", "剑势 · 玄重巨阙式", "posture", "active_mult", postureAtkMult, P.activeMultCap, "切换重剑姿态生效", true);
  if (rushGlass) addEntry("rush_glass_mult", "万剑冢词缀 · 脆锋狂威", "boon", "active_mult", rushAtkMult, P.activeMultCap, "血量减半换取高伤", true);
  if (astralMult > 1.0) addEntry("astral_form_mult", "法天象地法相", "domain", "active_mult", astralMult, P.activeMultCap, "法相持续期间", true);
  if (climateAtkMult > 1.0) addEntry("climate_blood_haze", "秘境气候 · 血雾煞境", "climate", "active_mult", climateAtkMult, P.activeMultCap, "敌我同步增伤", true);
  const activeMult = Math.min(P.activeMultCap, revMult * postureAtkMult * rushAtkMult * astralMult * climateAtkMult);

  // DR Pool
  const drGear = gt.dr;
  const drTurtle = pet.id === "turtle" ? 10 : 0;
  const drPetWard = hasPetSkill(gSafe, "spirit_ward") ? 12 : 0;
  const drMindStill = lo.mind === "sword_still" ? P.skills.sword_still.mindDr : 0;
  const drMindClear = lo.mind === "talisman_clear" ? P.skills.talisman_clear.mindDr : 0;
  const drRelicSeal = lo.relic === "jade_seal" ? Math.round(12 * starScale) : 0;
  const drGuardArray = sanctumB.guardDr;
  const drPhoenix = phoenixLowHp ? 18 : 0;
  const drPosture = isHeavyPosture ? 16 : 0;
  const karmaDr = safeKarmaDrBonus + (ks.mode === "righteous" ? 12 : 0);
  const celDrBonus = celPh.id === "dawn" ? P.celestialPhases.dawn.dr : 0;
  const dmgReduceBase = drGear + drTurtle + drPetWard + drMindStill + drMindClear + drRelicSeal + drGuardArray + drPhoenix;
  const finalDmgReduce = dmgReduceBase + drPosture + karmaDr + starB.dr + celDrBonus;
  if (drGear > 0) addEntry("gear_dr", "护身仙衣/套装减伤", "gear", "dr", drGear, null, "装备及淬火 (+8%/阶)", true);
  if (drTurtle + drPetWard > 0) addEntry("pet_dr", "灵宠护体减伤", "pet", "dr", drTurtle + drPetWard, null, "玄水灵龟/灵宠护盾技", true);
  if (drMindStill + drMindClear > 0) addEntry("mind_dr", lo.mind === "sword_still" ? "心法 · 止水剑心" : "心法 · 清虚符心", "skill", "dr", drMindStill + drMindClear, null, "装备于心法槽时生效", true);
  if (drRelicSeal > 0) addEntry("relic_dr", "法宝 · 镇海玉玺", "relic", "dr", drRelicSeal, null, "佩带法宝及星级加成", true);
  if (drGuardArray > 0) addEntry("sanctum_guard_dr", "洞府 · 护山大阵", "sanctum", "dr", drGuardArray, 16, "护山大阵每级 +4 减伤", true);
  if (drPhoenix > 0) addEntry("perk_phoenix_dr", "命格 · 劫火涅槃减伤", "perk", "dr", drPhoenix, 18, "气血 ≤45% 时触发", true);
  if (drPosture > 0) addEntry("posture_heavy_dr", "剑势 · 玄重巨阙减伤", "posture", "dr", drPosture, 16, "重剑姿态常驻", true);
  if (karmaDr > 0) addEntry("karma_dr", "道心/正道减伤", "karma", "dr", karmaDr, null, "正道 ≥+25 常驻 +12", true);
  if (starB.dr > 0) addEntry("star_dr", "周天星图减伤", "star", "dr", starB.dr, null, "星图节点加成", true);
  if (celDrBonus > 0) addEntry("cel_dawn_dr", "天时 · 晨曦清露", "celestial", "dr", celDrBonus, P.celestialPhases.dawn.dr, "晨曦天时常驻", true);
  const drMult = Math.max(0.35, 100 / (100 + Math.max(0, finalDmgReduce || 0)));

  // Crit / CritMult / Haste / Speed
  const tier = getComboTier(refArena ? (refArena.comboCount || 0) : 0);
  const lowHpBoonCrit = (boonFn && boonFn("blood_intent") && curHp <= maxHp * P.runBoons.blood_intent.hpThreshold) ? P.runBoons.blood_intent.crit : 0;
  const critCore = Math.min(P.critCap, 0.10 + gt.crit + (gSafe.perk === "sword_bone" ? 0.08 : 0) + (pet.id === "fox" ? 0.10 : 0) + (hasPetSkill(gSafe, "fury_fang") ? 0.05 : 0) + (hasLaw(gSafe, "crit_lotus") ? P.laws.crit_lotus.crit : 0) + (currentOmen(gSafe).id === "wolf_star" ? P.omens.wolf_star.crit : 0) + lowHpBoonCrit);
  const climSpdMult = (clim && clim.id === "sword_wind") ? P.climates.sword_wind.speedMult : 1.0;
  const climHaste = (clim && clim.id === "sword_wind") ? P.climates.sword_wind.haste : 0;
  const climCritMult = (clim && clim.id === "thunder_loom") ? P.climates.thunder_loom.critMult : 0;
  const speedBase = 3.85 * (1 + gt.spd) * (hasLaw(gSafe, "void_haste") ? 1.18 : 1.0) * (1 + tier.spdBonus * 0.30) * climSpdMult;
  const pineCrit = hasDestinyFruit(gSafe, "eternal_pine") ? 0.10 : 0;
  const pineMult = hasDestinyFruit(gSafe, "eternal_pine") ? Math.min(0.32, Math.floor(safeStones / 80) * 0.03) : 0;
  const postureHasteBonus = isHeavyPosture ? -0.14 : 0.14;
  const postureSpdMult = isHeavyPosture ? 0.92 : 1.10;
  const finalMaxHp = rushGlass ? Math.max(40, Math.round(maxHp * 0.5)) : maxHp;
  const gourdHaste = (refArena && refArena.player && (refArena.player.gourdHasteTimer || 0) > 0) ? P.runBoons.gourd_overload.haste : 0;
  const gourdCrit = (refArena && refArena.player && (refArena.player.gourdCritTimer || 0) > 0) ? 0.18 : 0;
  const styleSpec = getStyleRankSpec(refArena ? (refArena.styleScore || 0) : 0);
  const celCritMult = celPh.id === "blood_dusk" ? P.celestialPhases.blood_dusk.critMult : 0;
  const perkCritMult = gSafe.perk === "sword_sovereign" ? 0.18 : 0;
  const perkHaste = gSafe.perk === "primordial_sage" ? 0.10 : 0;
  const daoB = getDaoBonuses(gSafe);
  const schoolB = getSchoolSpecBonus(gSafe);
  const finalAtk = Math.max(8, Math.round(baseAtk * (1 + cappedPassivePct) * activeMult));
  const finalMaxMp = maxMpBase + starB.mp;
  const finalCrit = Math.min(P.critCap, critCore + pineCrit + gourdCrit + starB.crit + daoB.critBonus);
  const finalCritMult = Math.min(P.critMultCap, 1.48 + styleSpec.critDmg * 0.75 + starB.critMult + celCritMult + climCritMult + perkCritMult + (schoolB.critMultBonus || 0) + (hasLaw(gSafe, "crit_lotus") ? P.laws.crit_lotus.critMult : 0) + pineMult + ((setB && setB.critMult) || 0));
  const finalAtkHaste = Math.max(0.70, Math.min(1.85, 1 + gt.spd + starB.spd + styleSpec.haste * 0.7 + postureHasteBonus + gourdHaste + climHaste + perkHaste + (petWrathBuffActive ? 0.15 : 0) + (schoolB.hasteBonus || 0) + (refArena && refArena.domain ? 0.24 : 0) + ((refArena && (refArena.reversedDomainTimer || 0) > 0) ? 0.20 : 0)));
  const finalSpeed = speedBase * postureSpdMult * (1 + gourdHaste * 0.7 + starB.spd);

  addEntry("base_crit", "基础暴击率", "realm", "crit", 0.10, P.critCap, "角色基础 10%", true);
  if (gt.crit > 0) addEntry("gear_crit", "装备暴击率", "gear", "crit", gt.crit, P.critCap, "神兵词条与套装", true);
  if (gSafe.perk === "sword_bone") addEntry("perk_crit", "命格 · 先天剑骨暴击", "perk", "crit", 0.08, P.critCap, "常驻 +8%", true);
  if (pet.id === "fox" || hasPetSkill(gSafe, "fury_fang")) addEntry("pet_crit", "灵宠暴击加成", "pet", "crit", (pet.id === "fox" ? 0.10 : 0) + (hasPetSkill(gSafe, "fury_fang") ? 0.05 : 0), P.critCap, "火狐/狂牙灵技", true);
  if (hasLaw(gSafe, "crit_lotus")) addEntry("law_crit_lotus", "法则 · 暴击青莲", "law", "crit", P.laws.crit_lotus.crit, P.critCap, "暴击与暴伤各 +18%", true);
  if (currentOmen(gSafe).id === "wolf_star") addEntry("omen_wolf_star", "天象 · 贪狼破军", "celestial", "crit", P.omens.wolf_star.crit, P.critCap, "天象常驻 +12%", true);
  if (pineCrit > 0) addEntry("fruit_pine_crit", "道果 · 万古长青暴击", "fruit", "crit", pineCrit, P.critCap, "道果常驻 +10%", true);
  if (daoB.critBonus > 0) addEntry("dao_edge_crit", "道果 · 锋芒暴击", "dao", "crit", daoB.critBonus, 0.08, `锋芒 ${daoB.edge}`, true);
  if (starB.crit > 0) addEntry("star_crit", "周天星图暴击", "star", "crit", starB.crit, P.critCap, "已点亮星节点加成", true);
  if (lowHpBoonCrit > 0) addEntry("boon_blood_intent", "词条 · 血战剑心", "boon", "crit", lowHpBoonCrit, P.critCap, "气血 ≤55% 时触发", true);
  if (gourdCrit > 0) addEntry("gourd_crimson_vine", "仙葫 · 赤渊龙血藤", "boon", "crit", gourdCrit, P.critCap, "饮葫后 5 秒 +18%", true);

  addEntry("base_crit_mult", "基础暴击倍率", "realm", "crit_mult", 1.48, P.critMultCap, "角色基础 1.48×", true);
  if (styleSpec.critDmg > 0) addEntry("style_crit_mult", "评价 · 剑意评分暴伤", "style", "crit_mult", styleSpec.critDmg * 0.75, P.critMultCap, `当前评分 ${styleSpec.rank || ""}`, true);
  if (starB.critMult > 0) addEntry("star_crit_mult", "周天星图暴伤", "star", "crit_mult", starB.critMult, P.critMultCap, "已点亮星节点加成", true);
  if (celCritMult > 0) addEntry("cel_crit_mult", "天时 · 血月黄昏暴伤", "celestial", "crit_mult", celCritMult, P.critMultCap, "血月黄昏天时常驻", true);
  if (climCritMult > 0) addEntry("climate_crit_mult", "秘境气候 · 雷云暴伤", "climate", "crit_mult", climCritMult, P.critMultCap, "当前秘境气候加成", true);
  if (hasLaw(gSafe, "crit_lotus")) addEntry("law_crit_lotus_mult", "法则 · 暴击青莲暴伤", "law", "crit_mult", P.laws.crit_lotus.critMult, P.critMultCap, "暴击青莲常驻 +18%", true);
  if (setB && setB.critMult > 0) addEntry("gear_set_crit_mult", `套装 · ${setB.name}暴伤`, "gear", "crit_mult", setB.critMult, P.critMultCap, "三件同品阶以上激活", true);
  if (schoolB.critMultBonus > 0) addEntry("school_crit_mult", `流派 · ${schoolB.name}暴伤`, "school", "crit_mult", schoolB.critMultBonus, P.critMultCap, "御剑专精 +8%", true);
  if (pineMult > 0) addEntry("fruit_pine_mult", "道果 · 万古长青暴伤", "fruit", "crit_mult", pineMult, 0.32, "每 80 灵石 +3%（上限 +32%）", true);
  if (perkCritMult > 0) addEntry("perk_sovereign_mult", "命格 · 轮回剑主暴伤", "perk", "crit_mult", perkCritMult, P.critMultCap, "常驻暴伤 +18%", true);

  if (schoolB.hasteBonus > 0) addEntry("school_haste", `流派 · ${schoolB.name}攻速`, "school", "haste", schoolB.hasteBonus, 1.85, "御剑专精 +10%", true);
  addEntry("posture_haste", isHeavyPosture ? "剑势 · 玄重巨阙攻速" : "剑势 · 青莲疾剑攻速", "posture", "haste", postureHasteBonus, 1.85, isHeavyPosture ? "重剑姿态 -14%" : "疾剑姿态 +14%", true);
  if (gt.spd > 0) addEntry("gear_spd", "装备攻速/移速", "gear", "haste", gt.spd, 1.85, "含御风剑意 +10%", true);
  if (starB.spd > 0) addEntry("star_haste", "周天星图攻速", "star", "haste", starB.spd, 1.85, "已点亮星节点加成", true);
  if (styleSpec.haste > 0) addEntry("style_haste", "评价 · 剑意评分攻速", "style", "haste", styleSpec.haste * 0.7, 1.85, `当前评分 ${styleSpec.rank || ""}`, true);
  if (perkHaste > 0) addEntry("perk_haste", "命格 · 太初鸿蒙胎", "perk", "haste", perkHaste, 1.85, "常驻攻速 +10%", true);
  if (gourdHaste > 0) addEntry("gourd_haste", "仙葫/词条疾风攻速", "boon", "haste", gourdHaste, 1.85, "青鸾御风羽/仙酿剑狂 +22%", true);
  if (climHaste > 0) addEntry("climate_haste", "秘境气候 · 剑风攻速", "climate", "haste", climHaste, 1.85, "当前秘境气候加成", true);
  if (petWrathBuffActive) addEntry("pet_wrath_haste", "灵宠技 · 天威狂怒攻速", "pet", "haste", 0.15, 1.85, "灵宠助战增益期间 +15%", true);
  if (refArena && refArena.domain) addEntry("domain_haste", "剑域展开攻速", "domain", "haste", 0.24, 1.85, "剑域持续期间 +24%", true);
  if (refArena && (refArena.reversedDomainTimer || 0) > 0) addEntry("reversed_domain_haste", "逆转天象 · 破阵攻速", "domain", "haste", 0.20, 1.85, "击毁阵眼柱后 10 秒 +20%", true);

  return {
    entries,
    totals: {
      maxHp: finalMaxHp,
      maxMp: finalMaxMp,
      atk: finalAtk,
      dmgReduce: finalDmgReduce,
      crit: finalCrit,
      critMult: finalCritMult,
      atkHaste: finalAtkHaste,
      speed: finalSpeed,
      drMult: Number(drMult.toFixed(4)),
      daoBonuses: daoB,
      schoolSpec: schoolB,
      statBreakdown: {
        baseAtk: Math.round(baseAtk),
        rawPassivePct: Number(rawPassivePct.toFixed(3)),
        cappedPassivePct: Number(cappedPassivePct.toFixed(3)),
        activeMult: Number(activeMult.toFixed(3))
      }
    },
    caps: {
      passiveSoftCapKnee: P.passiveSoftCapKnee,
      passiveSoftCapMax: P.passiveSoftCapMax,
      activeMultCap: P.activeMultCap,
      critCap: P.critCap,
      critMultCap: P.critMultCap,
      atkHasteMin: 0.70,
      atkHasteMax: 1.85,
      drMultFloor: 0.35
    }
  };
}

export function getCombatStats(g, env = null) {
  const t = computeCombatStatLedger(g, env).totals;
  return {
    maxHp: t.maxHp,
    maxMp: t.maxMp,
    atk: t.atk,
    dmgReduce: t.dmgReduce,
    crit: t.crit,
    critMult: t.critMult,
    atkHaste: t.atkHaste,
    speed: t.speed,
    daoBonuses: t.daoBonuses,
    schoolSpec: t.schoolSpec,
    statBreakdown: t.statBreakdown
  };
}
