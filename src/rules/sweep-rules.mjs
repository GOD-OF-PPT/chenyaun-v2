// Pure D08 (R3-F07 / R3-F08) stage sweep eligibility, quota/cooldown, authentic drop calculation, and hold progression constants.
import { num, hasOwn } from "./utils.mjs";
import { COMBAT_RULE_PARAMS } from "../config/combat-params.mjs";
import { REALMS, ITEMS, RARITIES } from "../config/realms-items.mjs";
import { getActivePactCount, hasGearAffix, rollGearItem } from "./gear-rules.mjs";
import { rankOf, computeMainlineRealmScaling, currentOmen, getDaoBonuses } from "./combat-stats.mjs";
import { getLifespanInfo } from "./economy-rules.mjs";
import { getCalamityCycleSpec, stageStarsToGrade } from "./scoring-rules.mjs";

export const STAGE_SWEEP_MAX_PER_DAY = 3;
export const STAGE_SWEEP_COOLDOWN_MS = 60_000;
export const STAGE_SWEEP_LIFESPAN_MONTHS = 0;

export const HOLD_START_DELAY_MS = 380;
export const HOLD_REPEAT_INTERVAL_MS = 220;

export function formatLocalDayKey(nowMs = Date.now()) {
  const ts = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sanitizeStageSweepState(raw, maxStages = 5) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  const limit = Math.max(1, Math.floor(num(maxStages, 5)));
  for (let i = 0; i < limit; i++) {
    const k = String(i);
    if (!hasOwn(raw, k)) continue;
    const entry = raw[k];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const rawDay = typeof entry.dayKey === "string" ? entry.dayKey.trim() : "";
    const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(rawDay) ? rawDay : "";
    const usedToday = dayKey
      ? Math.max(0, Math.min(STAGE_SWEEP_MAX_PER_DAY, Math.floor(num(entry.usedToday, 0))))
      : 0;
    const rawLast = Number(entry.lastSweepAt);
    const lastSweepAt = (Number.isFinite(rawLast) && rawLast >= 0) ? Math.floor(rawLast) : 0;
    const totalSweeps = Math.max(0, Math.floor(num(entry.totalSweeps, 0)));
    out[k] = { dayKey, usedToday, lastSweepAt, totalSweeps };
  }
  return out;
}

export function getStageSweepStatus(g, stageIdx, nowMs = Date.now(), env = {}) {
  const stagesList = (env && Array.isArray(env.STAGES))
    ? env.STAGES
    : (typeof STAGES !== "undefined" ? STAGES : []);
  const ts = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
  const dayKey = formatLocalDayKey(ts);
  const isIntIdx = typeof stageIdx === "number" && Number.isInteger(stageIdx) && stageIdx >= 0 && stageIdx < stagesList.length;
  if (!g || !isIntIdx) {
    return {
      eligible: false,
      canSweep: false,
      reason: "invalid_stage",
      reasonText: "秘境编号无效",
      stars: 0,
      grade: "C",
      remaining: 0,
      maxPerDay: STAGE_SWEEP_MAX_PER_DAY,
      cooldownRemainMs: 0,
      cooldownSec: 0,
      lifespanMonths: STAGE_SWEEP_LIFESPAN_MONTHS,
      dayKey,
      usedToday: 0
    };
  }

  const stg = stagesList[stageIdx];
  const stars = Math.max(0, Math.min(3, Math.floor(num(g.stageStars && g.stageStars[stageIdx], 0))));
  const grade = stageStarsToGrade(stars);
  const practiceMode = (env && "practiceMode" in env)
    ? Boolean(env.practiceMode)
    : (typeof isPracticeModeActive === "function" ? Boolean(isPracticeModeActive()) : false);
  const realmUnlocked = rankOf(g.realm) >= rankOf(stg.min);

  const sweepState = sanitizeStageSweepState(g.stageSweepState, stagesList.length);
  const entry = sweepState[String(stageIdx)] || null;
  const usedToday = (entry && entry.dayKey === dayKey) ? entry.usedToday : 0;
  const remaining = Math.max(0, STAGE_SWEEP_MAX_PER_DAY - usedToday);
  const lastSweepAt = entry ? entry.lastSweepAt : 0;
  const cooldownRemainMs = lastSweepAt > 0 ? Math.max(0, (lastSweepAt + STAGE_SWEEP_COOLDOWN_MS) - ts) : 0;
  const cooldownSec = cooldownRemainMs > 0 ? Math.ceil(cooldownRemainMs / 1000) : 0;

  const base = {
    stars,
    grade,
    remaining,
    maxPerDay: STAGE_SWEEP_MAX_PER_DAY,
    cooldownRemainMs,
    cooldownSec,
    lifespanMonths: STAGE_SWEEP_LIFESPAN_MONTHS,
    dayKey,
    usedToday
  };

  if (practiceMode) {
    return Object.assign({ eligible: false, canSweep: false, reason: "practice_mode", reasonText: "练习模式不产出正式奖励，无法扫荡" }, base);
  }
  if (!realmUnlocked) {
    const reqName = (REALMS[stg.min] && REALMS[stg.min].name) || stg.min;
    return Object.assign({ eligible: false, canSweep: false, reason: "stage_locked", reasonText: `需先晋升【${reqName}】解锁该秘境` }, base);
  }
  if (stars < 3 || grade !== "S") {
    return Object.assign({ eligible: false, canSweep: false, reason: "requires_three_stars", reasonText: "需先达成三星（S 级）通关方可扫荡" }, base);
  }
  if (remaining <= 0) {
    return Object.assign({ eligible: true, canSweep: false, reason: "quota_exhausted", reasonText: `今日扫荡次数已用尽（0/${STAGE_SWEEP_MAX_PER_DAY}）` }, base);
  }
  if (cooldownRemainMs > 0) {
    return Object.assign({ eligible: true, canSweep: false, reason: "on_cooldown", reasonText: `该秘境扫荡冷却中（剩余 ${cooldownSec} 秒）` }, base);
  }
  return Object.assign({ eligible: true, canSweep: true, reason: "ok", reasonText: `可扫荡（免耗寿 · 今日余 ${remaining}/${STAGE_SWEEP_MAX_PER_DAY}）` }, base);
}

export function computeStageSweepPreview(g, stageIdx, env = {}) {
  const actsList = (env && Array.isArray(env.CAMPAIGN_ACTS))
    ? env.CAMPAIGN_ACTS
    : (typeof CAMPAIGN_ACTS !== "undefined" ? CAMPAIGN_ACTS : []);
  const enemiesMap = (env && env.ENEMIES && typeof env.ENEMIES === "object")
    ? env.ENEMIES
    : (typeof ENEMIES !== "undefined" ? ENEMIES : {});
  const isIntIdx = typeof stageIdx === "number" && Number.isInteger(stageIdx) && stageIdx >= 0 && stageIdx < actsList.length;
  if (!g || !isIntIdx) {
    return { valid: false, stageIdx, lifespanMonths: STAGE_SWEEP_LIFESPAN_MONTHS };
  }

  const act = actsList[stageIdx];
  const r = REALMS[g.realm] || REALMS.mortal;
  const calDrop = getCalamityCycleSpec(g);
  const daoDropB = getDaoBonuses(g);
  const wolfStarMult = (currentOmen(g).id === "wolf_star" ? COMBAT_RULE_PARAMS.omens.wolf_star.stoneMult : 1.0)
    * (calDrop.rewardMult || 1.0)
    * daoDropB.stoneMult;
  const playerRank = rankOf(g.realm);
  const stageDelta = playerRank - stageIdx;
  const realmPenalty = stageDelta <= 0 ? 1.0 : stageDelta === 1 ? 0.55 : stageDelta === 2 ? 0.28 : 0.12;
  const pactCount = getActivePactCount(g);
  const hasGreedOrPact = hasGearAffix(g, "greed_wolf") || pactCount > 0;
  const pactGreedMult = 1 + pactCount * 0.25;

  const mobScaling = computeMainlineRealmScaling(stageIdx, g.realm, false);
  const bossScaling = computeMainlineRealmScaling(stageIdx, g.realm, true);
  const waveMobs = Array.isArray(act.waves) ? act.waves.flat() : [];

  let rawXp = 0;
  let stones = 0;

  const accumulateEnemy = (enemyId, isBoss) => {
    const specD = enemiesMap[enemyId] || enemiesMap.wolf || { xp: 14, loot: {} };
    const baseEnemyXp = (specD.xp || 14) * (1 + stageIdx * 0.25);
    const roomXpMult = isBoss ? 3.2 : 1.0;
    const capShare = (r.xpCap || 60) * (isBoss ? 0.18 : 0.036) * realmPenalty;
    const rawXpOrb = stageDelta >= 2
      ? Math.max(2, Math.round(baseEnemyXp * roomXpMult * realmPenalty))
      : Math.max(Math.min(baseEnemyXp * roomXpMult, capShare * 1.45), capShare);
    const xpOrbVal = Math.max(2, Math.round(rawXpOrb * (calDrop.rewardMult || 1.0)));
    rawXp += xpOrbVal;

    const rs = isBoss ? bossScaling : mobScaling;
    const realmStoneMult = rs.active ? Math.max(1, num(rs.stoneMult, 1)) : 1.0;
    const baseStone = isBoss ? (48 + stageIdx * 24) : (10 + stageIdx * 5);
    stones += Math.round(baseStone * wolfStarMult * realmStoneMult);
    if (hasGreedOrPact) {
      stones += Math.round((isBoss ? 18 : 4) * pactGreedMult);
    }
  };

  for (let i = 0; i < waveMobs.length; i++) {
    accumulateEnemy(waveMobs[i], false);
  }
  accumulateEnemy(act.boss, true);

  // Stage clear bonus stones (matches spawnCurrentWave waveIdx > 4 for stages 0..3)
  const clearBonusStones = stageIdx < 4 ? (48 + stageIdx * 16) : 0;
  stones += clearBonusStones;

  // Effective XP after gainRealmXp multipliers
  const omenMult = currentOmen(g).id === "tide" ? 1.45 : 1.0;
  const mindMult = (g.loadout && (g.loadout.mind === "sword_still" || g.loadout.mind === "talisman_calm"))
    ? COMBAT_RULE_PARAMS.skills.sword_still.xpMult
    : 1.0;
  const lf = getLifespanInfo(g);
  const effectiveXp = rawXp > 0 ? Math.max(1, Math.round(rawXp * omenMult * mindMult * lf.xpEfficiencyMult)) : 0;
  const xpCap = Math.max(0, num(r.xpCap, 0));
  const curXp = Math.max(0, num(g.xp, 0));
  const willCapXp = xpCap > 0 && (curXp + effectiveXp) >= xpCap;
  const willOverflowXp = xpCap > 0 && (curXp + effectiveXp) > xpCap;
  const ascendedBonusStones = xpCap <= 0 && effectiveXp > 0 ? Math.max(4, Math.round(effectiveXp * 0.35)) : 0;

  // Guaranteed boss + stage clear materials
  const guaranteedMats = { core: 1 };
  const bossSpec = enemiesMap[act.boss] || enemiesMap.wolf || { loot: {} };
  const bossMatSet = new Set([...(act.bossMats || []), ...Object.keys(bossSpec.loot || {})]);
  bossMatSet.forEach(matKey => {
    if (ITEMS[matKey]) {
      guaranteedMats[matKey] = (guaranteedMats[matKey] || 0) + 1;
    }
  });
  if (stageIdx < 4) {
    (act.bossMats || []).forEach(matKey => {
      if (ITEMS[matKey]) {
        guaranteedMats[matKey] = (guaranteedMats[matKey] || 0) + 1;
      }
    });
  }

  // Wave mob material drop pool
  const wavePoolSet = new Set();
  (act.matDrops || []).forEach(k => { if (ITEMS[k]) wavePoolSet.add(k); });
  waveMobs.forEach(eid => {
    const ms = enemiesMap[eid];
    if (ms && ms.loot) {
      Object.keys(ms.loot).forEach(k => { if (ITEMS[k]) wavePoolSet.add(k); });
    }
  });
  const waveMatPool = Array.from(wavePoolSet);

  // Guaranteed boss gear tier range
  const minRarity = stageIdx === 4
    ? 4
    : Math.min(4, 2 + Math.floor(stageIdx / 2) + (calDrop.dropBonus || 0));
  const minRarityName = (RARITIES[minRarity] && RARITIES[minRarity].name) || "玄品";
  const maxRarityName = (RARITIES[4] && RARITIES[4].name) || "鸿蒙";
  const gearBagCount = Array.isArray(g.gearBag) ? g.gearBag.length : 0;
  const bagLimit = (env && Number.isFinite(Number(env.GEAR_BAG_LIMIT)))
    ? Math.max(1, Math.floor(Number(env.GEAR_BAG_LIMIT)))
    : (typeof GEAR_BAG_LIMIT !== "undefined" ? GEAR_BAG_LIMIT : 24);

  return {
    valid: true,
    stageIdx,
    stageName: act.name,
    mapName: act.mapName,
    actLabel: act.actLabel,
    bossName: act.bossName,
    waveMobCount: waveMobs.length,
    stones,
    clearBonusStones,
    rawXp,
    effectiveXp,
    omenMult,
    mindMult,
    lifeXpMult: lf.xpEfficiencyMult,
    willCapXp,
    willOverflowXp,
    ascendedBonusStones,
    lifespanMonths: STAGE_SWEEP_LIFESPAN_MONTHS,
    guaranteedMats,
    waveMatPool,
    minRarity,
    minRarityName,
    maxRarityName,
    realmScaled: bossScaling.active,
    realmStoneMult: bossScaling.stoneMult,
    gearBagCount,
    gearBagLimit: bagLimit,
    bagFull: gearBagCount >= bagLimit
  };
}

export function rollStageSweepRewards(g, stageIdx, opts = {}) {
  const rng = (opts && typeof opts.rng === "function") ? opts.rng : Math.random;
  const env = (opts && opts.env && typeof opts.env === "object") ? opts.env : opts;
  const preview = computeStageSweepPreview(g, stageIdx, env);
  if (!preview || !preview.valid) {
    return { valid: false, stageIdx, lifespanMonths: STAGE_SWEEP_LIFESPAN_MONTHS };
  }

  const actsList = (env && Array.isArray(env.CAMPAIGN_ACTS))
    ? env.CAMPAIGN_ACTS
    : (typeof CAMPAIGN_ACTS !== "undefined" ? CAMPAIGN_ACTS : []);
  const enemiesMap = (env && env.ENEMIES && typeof env.ENEMIES === "object")
    ? env.ENEMIES
    : (typeof ENEMIES !== "undefined" ? ENEMIES : {});
  const act = actsList[stageIdx];
  const waveMobs = Array.isArray(act.waves) ? act.waves.flat() : [];

  const materials = Object.assign({}, preview.guaranteedMats);
  for (let i = 0; i < waveMobs.length; i++) {
    if (rng() < 0.56) {
      const mobSpec = enemiesMap[waveMobs[i]] || enemiesMap.wolf || { loot: {} };
      const matPool = [...(act.matDrops || ["herb"]), ...Object.keys(mobSpec.loot || {})].filter(k => ITEMS[k]);
      const chosen = matPool.length ? matPool[Math.floor(rng() * matPool.length)] : "herb";
      materials[chosen] = (materials[chosen] || 0) + 1;
    }
  }

  const gear = rollGearItem(stageIdx, preview.minRarity, null, {
    usePity: true,
    rng,
    game: g,
    arena: null
  });

  return {
    valid: true,
    stageIdx,
    stones: preview.stones,
    rawXp: preview.rawXp,
    effectiveXp: preview.effectiveXp,
    lifespanMonths: STAGE_SWEEP_LIFESPAN_MONTHS,
    materials,
    gear,
    preview
  };
}
