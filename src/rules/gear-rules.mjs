// Pure gear math, affix budget, deterministic pity, slot balancing, sanctum helpers, and gear rolling rules.
import { safeText, num, rarityNum, hasOwn, safeAssignPlain } from "./utils.mjs";
import { GEAR_ENHANCE_STEP_PCT, GEAR_STAT_WEIGHTS, GEAR_BUDGET_BY_RARITY } from "../config/combat-params.mjs";
import { REALM_ORDER, RARITIES, GEAR_TEMPLATES, SACRED_AFFIXES } from "../config/realms-items.mjs";

export function getActivePactCount(g) {
  return (g && Array.isArray(g.pactSeals)) ? g.pactSeals.length : 0;
}

export function hasPact(g, pid) {
  return g && Array.isArray(g.pactSeals) && g.pactSeals.includes(pid);
}

export function hasGearAffix(g, affixId) {
  if (!g || !g.equippedGear) return false;
  return ["weapon", "armor", "ring"].some(sl => g.equippedGear[sl] && g.equippedGear[sl].affix === affixId);
}

export function hasDestinyFruit(g, fid) {
  return g && Array.isArray(g.destinyFruits) && g.destinyFruits.includes(fid);
}

export function getActiveSetBonus(g) {
  if (!g || !g.equippedGear) return null;
  const items = ["weapon", "armor", "ring"].map(sl => g.equippedGear[sl]);
  if (items.some(x => !x)) return null;
  const minR = Math.min(...items.map(x => x.rarity || 0));
  if (minR >= 5) return { minR: 5, name: "太初紫气三件套", desc: "剑道攻击+42% · 暴伤+38% · 飞剑+2 · 鸿蒙紫气圣环", atkMult: 0.42, critMult: 0.38, swords: 2, aura: "#ff9eff" };
  if (minR >= 4) return { minR: 4, name: "鸿蒙造化三件套", desc: "剑道攻击+32% · 暴伤+28% · 飞剑+2 · 鸿蒙圣环", atkMult: 0.32, critMult: 0.28, swords: 2, aura: "#ffe28a" };
  if (minR >= 3) return { minR: 3, name: "仙品诛仙三件套", desc: "剑道攻击+22% · 暴伤+18% · 飞剑+1 · 紫霞仙环", atkMult: 0.22, critMult: 0.18, swords: 1, aura: "#d69eff" };
  if (minR >= 2) return { minR: 2, name: "玄品太清三件套", desc: "剑道攻击+15% · 暴击+6% · 飞剑+1 · 太清灵环", atkMult: 0.15, crit: 0.06, swords: 1, aura: "#70ffe6" };
  if (minR >= 1) return { minR: 1, name: "灵品青锋三件套", desc: "剑道攻击+10% · 护体减伤+5", atkMult: 0.10, dr: 5, swords: 0, aura: "#4ad2b8" };
  return { minR: 0, name: "凡铁初鸣三件套", desc: "剑道攻击+5%", atkMult: 0.05, swords: 0, aura: null };
}

export function readSanctumLevelsPure(g) {
  const raw = (g && g.sanctumLevels && typeof g.sanctumLevels === "object") ? g.sanctumLevels : {};
  return {
    spirit_eye: Math.max(1, Math.min(5, Math.floor(Number(raw.spirit_eye) || 1))),
    cauldron: Math.max(1, Math.min(5, Math.floor(Number(raw.cauldron) || 1))),
    sword_forge: Math.max(1, Math.min(5, Math.floor(Number(raw.sword_forge) || 1))),
    scripture_hall: Math.max(1, Math.min(5, Math.floor(Number(raw.scripture_hall) || 1))),
    guard_array: Math.max(1, Math.min(5, Math.floor(Number(raw.guard_array) || 1)))
  };
}

export function getSanctumLevel(g, bId) {
  const lvMap = readSanctumLevelsPure(g);
  return lvMap[bId] || 1;
}

export function getSanctumBonuses(g) {
  const eyeLv = getSanctumLevel(g, "spirit_eye");
  const caulLv = getSanctumLevel(g, "cauldron");
  const forgeLv = getSanctumLevel(g, "sword_forge");
  const scLv = getSanctumLevel(g, "scripture_hall");
  const grdLv = getSanctumLevel(g, "guard_array");
  return {
    medMult: Number((1 + (eyeLv - 1) * 0.22).toFixed(2)),
    bonusGourdCharges: (eyeLv >= 3 ? 1 : 0) + (eyeLv >= 5 ? 1 : 0),
    alchemySweetBonus: (caulLv - 1) * 0.035,
    maxSoaks: caulLv >= 5 ? 5 : caulLv >= 3 ? 4 : 3,
    longevityUnlocked: caulLv >= 2,
    forgeAtk: (forgeLv - 1) * 8,
    quenchDiscMult: Math.max(0.60, 1 - (forgeLv - 1) * 0.10),
    seqDmgBonus: forgeLv >= 5 ? 0.25 : forgeLv >= 3 ? 0.12 : 0,
    expMult: Number((1 + (scLv - 1) * 0.20).toFixed(2)),
    sourceMult: Number((1 + (scLv - 1) * 0.15).toFixed(2)),
    bonusBoonRerolls: scLv >= 2 ? 1 : 0,
    bonusLawRerolls: scLv >= 4 ? 1 : 0,
    guardDr: (grdLv - 1) * 4,
    coreHpBonus: (grdLv - 1) * 350,
    towerDmgMult: Number((0.92 + (grdLv - 1) * 0.22).toFixed(2)),
    towerCd: Number(Math.max(0.36, 0.68 - (grdLv - 1) * 0.07).toFixed(2)),
    hasThirdTower: grdLv >= 3
  };
}

export function effectiveGearVal(it, key, overrideLvl = null) {
  if (!it) return 0;
  const lvl = Math.max(0, Math.floor(num(overrideLvl !== null ? overrideLvl : (it.lvl || 0), 0)));
  if (key === "atk" || key === "hp" || key === "dr") {
    const base = Math.max(0, num(it[key], 0));
    if (base <= 0) return 0;
    const baseInt = Math.round(base);
    if (lvl <= 0) return baseInt;
    const scaled = Math.round(base * (1 + lvl * GEAR_ENHANCE_STEP_PCT));
    return base >= 1 ? Math.max(baseInt + lvl, scaled) : scaled;
  }
  return it[key] || 0;
}

export function getGearTotals(g) {
  const tot = { atk: 0, hp: 0, dr: 0, crit: 0, spd: 0, bonusSword: 0 };
  if (!g || !g.equippedGear) return tot;
  ["weapon", "armor", "ring"].forEach(sl => {
    const it = g.equippedGear[sl];
    if (it && typeof it === "object") {
      tot.atk += effectiveGearVal(it, "atk");
      tot.hp += effectiveGearVal(it, "hp");
      tot.dr += effectiveGearVal(it, "dr");
      tot.crit += Math.max(0, num(it.crit, 0));
      tot.spd += Math.max(0, num(it.spd, 0)) + (it.affix === "wind_rider" ? 0.10 : 0);
      tot.bonusSword += Math.max(0, num(it.bonusSword, 0));
    }
  });
  const setB = getActiveSetBonus(g);
  if (setB) {
    tot.dr += setB.dr || 0;
    tot.crit += setB.crit || 0;
    tot.bonusSword += setB.swords || 0;
  }
  return tot;
}

export function computeGearAffixBudget(item) {
  const r = Math.max(0, Math.min(5, Math.floor(num(item && item.rarity, 0))));
  const spec = GEAR_BUDGET_BY_RARITY[r] || GEAR_BUDGET_BY_RARITY[0];
  const W = GEAR_STAT_WEIGHTS;
  const atk = Math.max(0, num(item && item.atk, 0));
  const hp = Math.max(0, num(item && item.hp, 0));
  const dr = Math.max(0, num(item && item.dr, 0));
  const crit = Math.max(0, num(item && item.crit, 0));
  const spd = Math.max(0, num(item && item.spd, 0));
  const bonusSword = Math.max(0, Math.floor(num(item && item.bonusSword, 0)));
  const hasAffix = Boolean(item && item.affix);
  const statBreakdown = {
    atk: Number((atk * W.atk).toFixed(2)),
    hp: Number((hp * W.hp).toFixed(2)),
    dr: Number((dr * W.dr).toFixed(2)),
    crit: Number((crit * W.crit).toFixed(2)),
    spd: Number((spd * W.spd).toFixed(2)),
    bonusSword: Number((bonusSword * W.bonusSword).toFixed(2)),
    affix: hasAffix ? W.affix : 0
  };
  const totalBudget = Number(Object.values(statBreakdown).reduce((s, v) => s + v, 0).toFixed(2));
  const overCapStats = [];
  const caps = spec.statCaps;
  if (atk > caps.atk) overCapStats.push("atk");
  if (hp > caps.hp) overCapStats.push("hp");
  if (dr > caps.dr) overCapStats.push("dr");
  if (crit > caps.crit + 1e-6) overCapStats.push("crit");
  if (spd > caps.spd + 1e-6) overCapStats.push("spd");
  if (bonusSword > caps.bonusSword) overCapStats.push("bonusSword");
  return {
    rarity: r,
    totalBudget,
    maxBudget: spec.maxBudget,
    utilization: Number((totalBudget / Math.max(1, spec.maxBudget)).toFixed(3)),
    withinBudget: totalBudget <= spec.maxBudget + 0.01 && overCapStats.length === 0,
    statBreakdown,
    caps: Object.assign({}, caps),
    overCapStats
  };
}

export function getGearEnhanceCost(g, eq) {
  if (!eq) return 0;
  const base = 25 + (eq.lvl || 0) * 20;
  const fLv = getSanctumLevel(g, "sword_forge");
  const mult = Math.max(0.60, 1 - (fLv - 1) * 0.10);
  return Math.max(12, Math.round(base * mult));
}

export function getRelicTemperCost(g, stars, useCore = false) {
  const safeStars = Math.max(1, Math.min(5, Math.floor(num(stars, 1))));
  const forgeDisc = (g && getSanctumLevel(g, "sword_forge") >= 4) ? 0.85 : 1.0;
  const coreCount = g && g.inventory ? Math.max(0, Math.floor(num(g.inventory.core, 0))) : 0;
  const hasCore = coreCount > 0;
  const applyCore = Boolean(useCore && hasCore);
  const baseStones = Math.max(35, Math.round(safeStars * 75 * forgeDisc));
  const discStones = Math.max(35, Math.round((safeStars * 75 - 30) * forgeDisc));
  const finalStones = applyCore ? discStones : baseStones;
  return {
    baseStones,
    discStones,
    finalStones,
    savedStones: Math.max(0, baseStones - discStones),
    hasCore,
    applyCore
  };
}

export function normalizeGearItem(item, fallbackSlot, validArtKeys = null) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const slot = ["weapon", "armor", "ring"].includes(item.slot) ? item.slot : (fallbackSlot || "weapon");
  const defArt = slot === "armor" ? "icon_heart" : slot === "ring" ? "item_jade" : "icon_blade";
  const artRegistry = validArtKeys || (typeof ART !== "undefined" ? ART : null);
  const safeArt = artRegistry
    ? (hasOwn(artRegistry, item.art) ? item.art : defArt)
    : (typeof item.art === "string" && item.art ? item.art : defArt);
  const out = safeAssignPlain({}, item, {
    slot,
    name: safeText(item.name, "灵器") || "灵器",
    rarity: rarityNum(item.rarity),
    lvl: Math.max(0, Math.min(10, Math.floor(num(item.lvl, 0)))),
    atk: Math.max(0, num(item.atk, 0)),
    hp: Math.max(0, num(item.hp, 0)),
    dr: Math.max(0, num(item.dr, 0)),
    crit: Math.max(0, num(item.crit, 0)),
    spd: Math.max(0, num(item.spd, 0)),
    bonusSword: Math.max(0, Math.floor(num(item.bonusSword, 0))),
    sell: Math.max(0, Math.floor(num(item.sell, 15))),
    price: Math.max(0, Math.floor(num(item.price, 25))),
    art: safeArt
  });
  if (hasOwn(item, "power")) out.power = Math.max(0, num(item.power, 0));
  if (hasOwn(out, "uid") && typeof out.uid !== "string") out.uid = safeText(out.uid, "");
  if (hasOwn(out, "affix") && typeof out.affix !== "string") out.affix = null;
  if (hasOwn(out, "awakenedAffix") && typeof out.awakenedAffix !== "string") out.awakenedAffix = null;
  if (hasOwn(item, "taixuForged")) out.taixuForged = Boolean(item.taixuForged);
  return out;
}

export function ensureDeterministicPity(g) {
  if (!g) return { epic: 0, mythic: 0, critAcc: 0, vampHits: 0, thunderHits: 0, gearDrops: 0 };
  const rawPity = (g.pity && typeof g.pity === "object" && !Array.isArray(g.pity)) ? g.pity : null;
  const pityHasUnsafeKey = !!(rawPity && (hasOwn(rawPity, "__proto__") || hasOwn(rawPity, "constructor") || hasOwn(rawPity, "prototype")));
  const cleanPity = safeAssignPlain({ epic: 0, mythic: 0, critAcc: 0, vampHits: 0, thunderHits: 0, gearDrops: 0 }, rawPity);
  const keys = ["epic", "mythic", "critAcc", "vampHits", "thunderHits", "gearDrops"];
  keys.forEach(k => {
    cleanPity[k] = Math.max(0, num(cleanPity[k], 0));
  });
  if (!rawPity || Object.getPrototypeOf(rawPity) !== Object.prototype || pityHasUnsafeKey || keys.some(k => rawPity[k] !== cleanPity[k])) {
    g.pity = cleanPity;
  }
  return g.pity;
}

export function pickBalancedGearSlot(g, rng = Math.random) {
  const slots = ["weapon", "armor", "ring"];
  if (!g || !g.equippedGear) return slots[Math.floor(rng() * slots.length)];
  const emptySlots = slots.filter(s => !g.equippedGear[s]);
  if (emptySlots.length > 0) return emptySlots[0];
  const sorted = slots.slice().sort((a, b) => ((g.equippedGear[a] && g.equippedGear[a].power) || 0) - ((g.equippedGear[b] && g.equippedGear[b].power) || 0));
  return rng() < 0.72 ? sorted[0] : sorted[1 + Math.floor(rng() * 2)];
}

export function rollGearItem(stageTier = 0, minRarity = 0, forcedSlot = null, opts = {}) {
  const rng = (opts && typeof opts.rng === "function") ? opts.rng : Math.random;
  const usePity = opts && opts.usePity !== false;
  const refGame = (opts && "game" in opts) ? opts.game : (typeof game !== "undefined" ? game : null);
  const refArena = (opts && "arena" in opts) ? opts.arena : (typeof arena !== "undefined" ? arena : null);
  const slot = (forcedSlot && hasOwn(GEAR_TEMPLATES, forcedSlot)) ? forcedSlot : pickBalancedGearSlot(refGame, rng);
  const pactBoost = refGame ? getActivePactCount(refGame) * 0.055 : 0;
  const styleBoost = (refArena && (refArena.styleScore || 0) >= 850) ? 0.22 : (refArena && (refArena.styleScore || 0) >= 580) ? 0.12 : 0;
  const luckBoost = ((refGame && hasDestinyFruit(refGame, "hongmeng_luck")) ? 0.16 : 0) + pactBoost + styleBoost;
  const rRoll = rng() + luckBoost;
  let rarity = minRarity;
  if (rRoll > 0.90) rarity = Math.max(rarity, 4);
  else if (rRoll > 0.70) rarity = Math.max(rarity, 3);
  else if (rRoll > 0.42) rarity = Math.max(rarity, 2);
  else if (rRoll > 0.16) rarity = Math.max(rarity, 1);
  rarity = Math.min(4, Math.max(minRarity, rarity + (stageTier >= 3 ? 1 : 0)));

  let pityTriggered = null;
  if (usePity && refGame) {
    const pt = ensureDeterministicPity(refGame);
    if (pt.mythic >= 7 && rarity < 4) {
      rarity = 4;
      pityTriggered = "mythic";
    } else if (pt.epic >= 3 && rarity < 3) {
      rarity = 3;
      pityTriggered = "epic";
    }
    if (rarity >= 4) { pt.mythic = 0; pt.epic = 0; }
    else if (rarity >= 3) { pt.epic = 0; pt.mythic += 1; }
    else { pt.epic += 1; pt.mythic += 1; }
    pt.gearDrops += 1;
  }

  const rSpec = RARITIES[rarity];
  const tmpl = GEAR_TEMPLATES[slot][Math.min(4, rarity)];
  const realmIdx = refGame ? REALM_ORDER.indexOf(refGame.realm) : -1;
  const lvlScale = 1 + stageTier * 0.32 + (realmIdx >= 0 ? realmIdx * 0.22 : 0);
  const qualityRoll = 0.94 + rng() * 0.12;

  const item = {
    uid: "g_" + Math.floor(rng() * 1e9).toString(36),
    slot,
    rarity,
    name: `${rSpec.name}·${tmpl.baseName}`,
    art: tmpl.art,
    atk: 0, hp: 0, dr: 0, crit: 0, spd: 0, bonusSword: 0,
    pityTriggered,
    price: Math.round(rSpec.sell * 2.4 * (1 + stageTier * 0.25)),
    sell: Math.round(rSpec.sell * (1 + stageTier * 0.2))
  };

  if (slot === "weapon") {
    item.atk = Math.max(4, Math.round(7 * rSpec.mult * lvlScale * qualityRoll));
    item.crit = Number((0.022 * (rarity + 1)).toFixed(2));
    if (rarity >= 3) item.bonusSword = 1;
  } else if (slot === "armor") {
    item.hp = Math.max(16, Math.round(24 * rSpec.mult * lvlScale * qualityRoll));
    item.dr = Math.max(2, Math.round(3.0 * rSpec.mult * (1 + stageTier * 0.25) * qualityRoll));
  } else {
    item.atk = Math.max(2, Math.round(4 * rSpec.mult * lvlScale * qualityRoll));
    item.spd = Number((0.03 * (rarity + 1)).toFixed(2));
    item.crit = Number((0.018 * (rarity + 1)).toFixed(2));
  }
  item.lvl = 0;
  if (rarity >= 2) {
    const ownedAffixes = refGame && refGame.equippedGear
      ? Object.values(refGame.equippedGear).map(g => g && g.affix).filter(Boolean)
      : [];
    const freshPool = SACRED_AFFIXES.filter(a => !ownedAffixes.includes(a.id));
    const pool = freshPool.length ? freshPool : SACRED_AFFIXES;
    item.affix = pool[Math.floor(rng() * pool.length)].id;
  } else {
    item.affix = null;
  }

  // F22 (D05): Enforce weighted affix budget & per-stat caps ONLY on newly generated items (never retroactively mutates legacy saves)
  const budgetSpec = GEAR_BUDGET_BY_RARITY[rarity] || GEAR_BUDGET_BY_RARITY[0];
  const caps = budgetSpec.statCaps;
  item.atk = Math.min(item.atk, caps.atk);
  item.hp = Math.min(item.hp, caps.hp);
  item.dr = Math.min(item.dr, caps.dr);
  item.crit = Number(Math.min(item.crit, caps.crit).toFixed(3));
  item.spd = Number(Math.min(item.spd, caps.spd).toFixed(3));
  item.bonusSword = Math.min(item.bonusSword, caps.bonusSword);
  const bCheck = computeGearAffixBudget(item);
  if (bCheck.totalBudget > bCheck.maxBudget) {
    const fixedCost = bCheck.statBreakdown.bonusSword + bCheck.statBreakdown.affix;
    const flexCost = Math.max(1, bCheck.totalBudget - fixedCost);
    const targetFlex = Math.max(1, bCheck.maxBudget - fixedCost);
    const scale = Math.min(1, targetFlex / flexCost);
    if (item.atk > 0) item.atk = Math.max(1, Math.floor(item.atk * scale));
    if (item.hp > 0) item.hp = Math.max(8, Math.floor(item.hp * scale));
    if (item.dr > 0) item.dr = Math.max(1, Math.floor(item.dr * scale));
    if (item.crit > 0) item.crit = Number(Math.max(0.01, Math.floor(item.crit * scale * 100) / 100).toFixed(2));
    if (item.spd > 0) item.spd = Number(Math.max(0.01, Math.floor(item.spd * scale * 100) / 100).toFixed(2));
  }

  item.power = item.atk * 3 + Math.round(item.hp * 0.4) + item.dr * 5 + Math.round(item.crit * 240) + Math.round(item.spd * 180) + item.bonusSword * 85 + (item.affix ? 45 : 0);
  return item;
}
