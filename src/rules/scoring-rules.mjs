// Pure stage star totals, calamity cycle lookup, competition scoring, and grade evaluation rules.
import { num, hasOwn } from "./utils.mjs";
import { CALAMITY_CYCLES } from "../config/progression-data.mjs";
import { getGearTotals, getActivePactCount } from "./gear-rules.mjs";
import { rankOf } from "./combat-stats.mjs";

export const UNIFIED_GRADES = Object.freeze(["C", "B", "A", "S"]);
export const UNIFIED_GRADE_RANK = Object.freeze({ C: 1, B: 2, A: 3, S: 4 });

export function isValidUnifiedGrade(g) {
  return typeof g === "string" && hasOwn(UNIFIED_GRADE_RANK, g);
}

export function maxUnifiedGrade(a, b) {
  const ra = isValidUnifiedGrade(a) ? UNIFIED_GRADE_RANK[a] : 0;
  const rb = isValidUnifiedGrade(b) ? UNIFIED_GRADE_RANK[b] : 0;
  if (ra === 0 && rb === 0) return null;
  return rb > ra ? b : a;
}

export function stageStarsToGrade(stars) {
  const s = Math.max(0, Math.min(3, Math.floor(num(stars, 0))));
  return s >= 3 ? "S" : s === 2 ? "A" : s === 1 ? "B" : "C";
}

export function computeModeGrade(mode, metrics = {}) {
  const m = (metrics && typeof metrics === "object") ? metrics : {};
  if (mode === "mainline") {
    return stageStarsToGrade(m.stars);
  }
  if (mode === "sect_defense") {
    if (!m.victory) return "C";
    const maxHp = Math.max(1, num(m.maxCoreHp, 1));
    const pct = Math.max(0, num(m.coreHp, 0)) / maxHp;
    if (pct >= 0.80) return "S";
    if (pct >= 0.55) return "A";
    if (pct >= 0.30) return "B";
    return "C";
  }
  if (mode === "cloud_sea") {
    if (!m.victory) return "C";
    const deflected = Math.max(0, Math.floor(num(m.deflectedCount, 0)));
    const hpPct = Math.max(0, num(m.hpPct, 0));
    if (deflected >= 5 && hpPct >= 0.5) return "S";
    if (deflected >= 2 || hpPct >= 0.5) return "A";
    return "B";
  }
  if (mode === "celestial_spire") {
    const floor = Math.max(0, Math.floor(num(m.floor, 0)));
    const revives = Math.max(0, Math.floor(num(m.revivesUsed, 0)));
    const hpPct = Math.max(0, num(m.hpPct, 0));
    if (floor >= 9 && revives === 0 && hpPct >= 0.5) return "S";
    if (floor >= 6) return "A";
    if (floor >= 3) return "B";
    return "C";
  }
  if (mode === "demon_tower") {
    const floor = Math.max(0, Math.floor(num(m.floor, m.towerBest)));
    if (floor >= 10) return "S";
    if (floor >= 6) return "A";
    if (floor >= 3) return "B";
    return "C";
  }
  if (mode === "custom_seed") {
    const elapsedSec = Math.max(0, num(m.elapsedSec, 999));
    const hitsTaken = Math.max(0, Math.floor(num(m.hitsTaken, 0)));
    if (elapsedSec <= 45 && hitsTaken <= 2) return "S";
    if (elapsedSec <= 90) return "A";
    if (elapsedSec <= 150) return "B";
    return "C";
  }
  if (mode === "dojo") {
    if (m.isDrill) {
      if (m.completed) return "S";
      const prog = Math.max(0, Math.floor(num(m.progress, 0)));
      if (prog >= 2) return "A";
      if (prog >= 1) return "B";
      return "C";
    }
    const hits = Math.max(0, Math.floor(num(m.hits, 0)));
    if (hits >= 18) return "S";
    if (hits >= 10) return "A";
    if (hits >= 4) return "B";
    return "C";
  }
  return "C";
}

export function getCalamityCycleSpec(tierOrGame) {
  const rawTier = (typeof tierOrGame === "object" && tierOrGame !== null)
    ? num(tierOrGame.calamityTier, 0)
    : num(tierOrGame, 0);
  const clamped = Math.max(0, Math.min(CALAMITY_CYCLES.length - 1, Math.floor(rawTier) || 0));
  return CALAMITY_CYCLES[clamped] || CALAMITY_CYCLES[0];
}

export function getTotalStageStars(g) {
  if (!g || !g.stageStars) return 0;
  return [0, 1, 2, 3, 4].reduce((s, idx) => s + Math.min(3, g.stageStars[idx] || 0), 0);
}

export function computeCompetitionScore(g, env = null) {
  if (!g) return 0;
  const clearedFn = (env && typeof env.getClearedCampaignStageIndices === "function")
    ? env.getClearedCampaignStageIndices
    : (typeof getClearedCampaignStageIndices === "function"
      ? getClearedCampaignStageIndices
      : (st) => [0, 1, 2, 3, 4].filter(idx => (st.stageStars && num(st.stageStars[idx], 0) >= 1) || (st.defeatedStageBosses && st.defeatedStageBosses[idx] === true) || (idx === 4 && st.trialCompleted === true)));
  const endingsList = (env && Array.isArray(env.ASCENSION_ENDINGS))
    ? env.ASCENSION_ENDINGS
    : (typeof ASCENSION_ENDINGS !== "undefined" ? ASCENSION_ENDINGS : []);
  const achList = (env && Array.isArray(env.ACHIEVEMENTS))
    ? env.ACHIEVEMENTS
    : (typeof ACHIEVEMENTS !== "undefined" ? ACHIEVEMENTS : []);
  const bondedFn = (env && typeof env.getBondedCompanionIds === "function")
    ? env.getBondedCompanionIds
    : (typeof getBondedCompanionIds === "function" ? getBondedCompanionIds : () => []);
  const synList = (env && Array.isArray(env.SYNERGIES))
    ? env.SYNERGIES
    : (typeof SYNERGIES !== "undefined" ? SYNERGIES : []);

  const clearedStages = clearedFn(g).length;
  const totalStars = getTotalStageStars(g);
  const realmPts = rankOf(g.realm) * 100;
  const stagePts = clearedStages * 100 + totalStars * 110;
  const endSpec = endingsList.find(e => e.id === g.ending);
  const ascendPts = (g.status === "ascended" && clearedStages > 0) ? 250 : 0;
  const endBonus = (endSpec && clearedStages > 0) ? 150 : 0;
  const achPts = Math.round((g.achievements || []).reduce((s, id) => {
    const a = achList.find(x => x.id === id);
    return s + (a ? a.pts : 0);
  }, 0) * 0.4);
  const allyPts = bondedFn(g).length * 80 + Math.min(10, Object.keys(g.choices || {}).length) * 25;
  const lawPts = Math.min(15, (g.laws || []).length) * 80;
  const synPts = synList.filter(s => s.active(g)).length * 140;
  const gt = getGearTotals(g);
  const gearPts = Math.min(400, gt.atk * 2 + gt.dr * 4);
  const towerPts = Math.min(20, Math.max(0, Math.floor(num(g.towerBest, 0)))) * 65
                 + Math.min(9, Math.max(0, Math.floor(num(g.bestSpireFloor, 0)))) * 45;
  const winPts = Math.min(400, Math.max(0, Math.floor(num(g.wins, 0))) * 8);
  const rushMap = { S: 360, A: 200, B: 100, C: 40 };
  const rushPts = hasOwn(rushMap, g.rushBestGrade) ? rushMap[g.rushBestGrade] : 0;
  const defiantPts = Math.min(5, Math.max(0, Math.floor(num(g.defiantBreakthroughs, 0)))) * 60;
  const pactMult = 1 + getActivePactCount(g) * 0.12;
  const calMult = getCalamityCycleSpec(g).scoreMult || 1.0;
  return Math.round(pactMult * calMult * (
    realmPts + stagePts + ascendPts + endBonus + lawPts + synPts + gearPts + towerPts + winPts + allyPts + achPts + rushPts + defiantPts
  ));
}

export function getScoreGrade(score, g = null, env = null) {
  const s = Math.max(0, num(score, 0));
  let tier = 0; // 0:C, 1:B, 2:A, 3:S
  if (s >= 4200) tier = 3;
  else if (s >= 2200) tier = 2;
  else if (s >= 1000) tier = 1;
  else tier = 0;

  if (g) {
    const clearedFn = (env && typeof env.getClearedCampaignStageIndices === "function")
      ? env.getClearedCampaignStageIndices
      : (typeof getClearedCampaignStageIndices === "function"
        ? getClearedCampaignStageIndices
        : (st) => [0, 1, 2, 3, 4].filter(idx => (st.stageStars && num(st.stageStars[idx], 0) >= 1) || (st.defeatedStageBosses && st.defeatedStageBosses[idx] === true) || (idx === 4 && st.trialCompleted === true)));
    const stageCount = (env && typeof env.stageCount === "number")
      ? env.stageCount
      : (typeof STAGES !== "undefined" ? STAGES.length : 5);
    const clearedStages = clearedFn(g).length;
    const totalStars = getTotalStageStars(g);
    if (totalStars <= 0 || clearedStages <= 0) tier = Math.min(tier, s >= 1400 ? 1 : 0);
    else if (clearedStages < stageCount || totalStars < 10) tier = Math.min(tier, 2);
  }

  const GRADE_TABLE = [
    { grade: "C", title: "初窥门径" },
    { grade: "B", title: "问道修士" },
    { grade: "A", title: "青云真人" },
    { grade: "S", title: "万古剑帝" }
  ];
  return GRADE_TABLE[tier];
}
