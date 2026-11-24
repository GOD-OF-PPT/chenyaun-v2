// Pure stage star totals, calamity cycle lookup, competition scoring, and grade evaluation rules.
import { num, hasOwn } from "./utils.mjs";
import { CALAMITY_CYCLES } from "../config/progression-data.mjs";
import { getGearTotals, getActivePactCount } from "./gear-rules.mjs";
import { rankOf } from "./combat-stats.mjs";

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
  const rushMap = { "S+": 360, "SS": 300, "S": 220, "A": 140, "B": 80, "C": 40 };
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
  let tier = 0; // 0:C, 1:B, 2:A, 3:S, 4:SS, 5:SSS
  if (s >= 6400) tier = 5;
  else if (s >= 4800) tier = 4;
  else if (s >= 3400) tier = 3;
  else if (s >= 2000) tier = 2;
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
    else if (clearedStages < stageCount || totalStars < 8) tier = Math.min(tier, 2);
    else if (totalStars < 12) tier = Math.min(tier, 3);
    else if (totalStars < 14) tier = Math.min(tier, 4);
  }

  const GRADE_TABLE = [
    { grade: "C", title: "初窥门径" },
    { grade: "B", title: "问道修士" },
    { grade: "A", title: "青云真人" },
    { grade: "S", title: "太虚剑尊" },
    { grade: "SS", title: "九霄真仙" },
    { grade: "SSS", title: "万古剑帝" }
  ];
  return GRADE_TABLE[tier];
}
