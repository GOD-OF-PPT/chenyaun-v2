import test from "node:test";
import assert from "node:assert/strict";
import {
  UNIFIED_GRADES,
  UNIFIED_GRADE_RANK,
  isValidUnifiedGrade,
  maxUnifiedGrade,
  stageStarsToGrade,
  computeModeGrade,
  getCalamityCycleSpec,
  getTotalStageStars,
  computeCompetitionScore,
  getScoreGrade
} from "../../src/rules/scoring-rules.mjs";
import { CALAMITY_CYCLES } from "../../src/config/progression-data.mjs";

test("UNIFIED_GRADES, isValidUnifiedGrade, maxUnifiedGrade, and stageStarsToGrade enforce exact S/A/B/C bijection", () => {
  assert.deepEqual(UNIFIED_GRADES, ["C", "B", "A", "S"]);
  assert.deepEqual(UNIFIED_GRADE_RANK, { C: 1, B: 2, A: 3, S: 4 });

  for (const g of ["C", "B", "A", "S"]) {
    assert.equal(isValidUnifiedGrade(g), true);
  }
  for (const bad of ["D", "SS", "SSS", "S+", "", null, undefined, 123, "constructor", "__proto__"]) {
    assert.equal(isValidUnifiedGrade(bad), false);
  }

  assert.equal(maxUnifiedGrade("C", "B"), "B");
  assert.equal(maxUnifiedGrade("S", "A"), "S");
  assert.equal(maxUnifiedGrade(null, "A"), "A");
  assert.equal(maxUnifiedGrade("B", "SSS"), "B");
  assert.equal(maxUnifiedGrade("SS", "S+"), null);

  assert.equal(stageStarsToGrade(3), "S");
  assert.equal(stageStarsToGrade(5), "S");
  assert.equal(stageStarsToGrade(2), "A");
  assert.equal(stageStarsToGrade(1), "B");
  assert.equal(stageStarsToGrade(0), "C");
  assert.equal(stageStarsToGrade(-2), "C");
  assert.equal(stageStarsToGrade(null), "C");
});

test("computeModeGrade maps all side/dojo/mainline modes onto unified S/A/B/C", () => {
  assert.equal(computeModeGrade("mainline", { stars: 3 }), "S");
  assert.equal(computeModeGrade("mainline", { stars: 2 }), "A");
  assert.equal(computeModeGrade("mainline", { stars: 1 }), "B");
  assert.equal(computeModeGrade("mainline", { stars: 0 }), "C");

  assert.equal(computeModeGrade("sect_defense", { victory: true, coreHp: 900, maxCoreHp: 1000 }), "S");
  assert.equal(computeModeGrade("sect_defense", { victory: true, coreHp: 600, maxCoreHp: 1000 }), "A");
  assert.equal(computeModeGrade("sect_defense", { victory: true, coreHp: 350, maxCoreHp: 1000 }), "B");
  assert.equal(computeModeGrade("sect_defense", { victory: true, coreHp: 100, maxCoreHp: 1000 }), "C");
  assert.equal(computeModeGrade("sect_defense", { victory: false, coreHp: 0, maxCoreHp: 1000 }), "C");

  assert.equal(computeModeGrade("cloud_sea", { victory: true, deflectedCount: 5, hpPct: 0.6 }), "S");
  assert.equal(computeModeGrade("cloud_sea", { victory: true, deflectedCount: 2, hpPct: 0.3 }), "A");
  assert.equal(computeModeGrade("cloud_sea", { victory: true, deflectedCount: 0, hpPct: 0.3 }), "B");
  assert.equal(computeModeGrade("cloud_sea", { victory: false, deflectedCount: 9, hpPct: 0.9 }), "C");

  assert.equal(computeModeGrade("celestial_spire", { floor: 9, revivesUsed: 0, hpPct: 0.8 }), "S");
  assert.equal(computeModeGrade("celestial_spire", { floor: 9, revivesUsed: 1, hpPct: 0.8 }), "A");
  assert.equal(computeModeGrade("celestial_spire", { floor: 6 }), "A");
  assert.equal(computeModeGrade("celestial_spire", { floor: 3 }), "B");
  assert.equal(computeModeGrade("celestial_spire", { floor: 2 }), "C");

  assert.equal(computeModeGrade("demon_tower", { floor: 10 }), "S");
  assert.equal(computeModeGrade("demon_tower", { floor: 6 }), "A");
  assert.equal(computeModeGrade("demon_tower", { floor: 3 }), "B");
  assert.equal(computeModeGrade("demon_tower", { floor: 1 }), "C");

  assert.equal(computeModeGrade("custom_seed", { elapsedSec: 40, hitsTaken: 1 }), "S");
  assert.equal(computeModeGrade("custom_seed", { elapsedSec: 40, hitsTaken: 4 }), "A");
  assert.equal(computeModeGrade("custom_seed", { elapsedSec: 120, hitsTaken: 0 }), "B");
  assert.equal(computeModeGrade("custom_seed", { elapsedSec: 200, hitsTaken: 0 }), "C");

  assert.equal(computeModeGrade("dojo", { isDrill: false, hits: 18 }), "S");
  assert.equal(computeModeGrade("dojo", { isDrill: false, hits: 10 }), "A");
  assert.equal(computeModeGrade("dojo", { isDrill: false, hits: 4 }), "B");
  assert.equal(computeModeGrade("dojo", { isDrill: false, hits: 1 }), "C");
  assert.equal(computeModeGrade("dojo", { isDrill: true, completed: true, progress: 3 }), "S");
  assert.equal(computeModeGrade("dojo", { isDrill: true, completed: false, progress: 2 }), "A");
  assert.equal(computeModeGrade("dojo", { isDrill: true, completed: false, progress: 1 }), "B");
  assert.equal(computeModeGrade("dojo", { isDrill: true, completed: false, progress: 0 }), "C");
});

test("getCalamityCycleSpec resolves numeric tiers and game objects with clamping and safe fallbacks", () => {
  assert.equal(getCalamityCycleSpec(0), CALAMITY_CYCLES[0]);
  assert.equal(getCalamityCycleSpec(3), CALAMITY_CYCLES[3]);
  assert.equal(getCalamityCycleSpec(5), CALAMITY_CYCLES[5]);
  assert.equal(getCalamityCycleSpec({ calamityTier: 4 }), CALAMITY_CYCLES[4]);

  // Clamping & invalid fallbacks
  assert.equal(getCalamityCycleSpec(-5), CALAMITY_CYCLES[0]);
  assert.equal(getCalamityCycleSpec(99), CALAMITY_CYCLES[CALAMITY_CYCLES.length - 1]);
  assert.equal(getCalamityCycleSpec(2.9), CALAMITY_CYCLES[2]);
  assert.equal(getCalamityCycleSpec(null), CALAMITY_CYCLES[0]);
  assert.equal(getCalamityCycleSpec(Number.NaN), CALAMITY_CYCLES[0]);
  assert.equal(getCalamityCycleSpec({ calamityTier: "bad" }), CALAMITY_CYCLES[0]);
});

test("getTotalStageStars sums campaign stages 0..4 and clamps each stage at 3 stars", () => {
  assert.equal(getTotalStageStars(null), 0);
  assert.equal(getTotalStageStars({}), 0);
  assert.equal(getTotalStageStars({ stageStars: [3, 2, 1, 0, 3] }), 9);
  assert.equal(getTotalStageStars({ stageStars: { 0: 3, 1: 2, 2: 1, 3: 0, 4: 3 } }), 9);
  assert.equal(getTotalStageStars({ stageStars: [5, 4, 3, 3, 9, 3] }), 15);
});

test("computeCompetitionScore aggregates all scoring components, multipliers, and ignores prototype keys", () => {
  assert.equal(computeCompetitionScore(null), 0);

  const g = {
    realm: "spirit", // rank 5 -> 500
    status: "ascended", // +250 (clearedStages > 0)
    ending: "sword_immortal", // +150 via env.ASCENSION_ENDINGS
    stageStars: [3, 3, 3, 3, 3], // 5 cleared * 100 + 15 * 110 = 2150
    achievements: ["a1", "a2"], // (100 + 50) * 0.4 = 60
    choices: { c1: "a", c2: "b" }, // 2 * 25 = 50
    laws: ["crit_lotus", "wealth_power"], // 2 * 80 = 160
    equippedGear: {
      weapon: { slot: "weapon", rarity: 3, lvl: 2, atk: 50, hp: 0, dr: 10, crit: 0, spd: 0, bonusSword: 0 }
    },
    towerBest: 10, // 10 * 65 = 650
    bestSpireFloor: 4, // 4 * 45 = 180
    wins: 25, // 25 * 8 = 200
    rushBestGrade: "S", // 360
    defiantBreakthroughs: 2, // 2 * 60 = 120
    pactSeals: ["frenzy_hp", "blood_oath"], // active pacts -> pactMult = 1 + 2 * 0.12 = 1.24
    calamityTier: 2 // calMult = 1.45
  };

  const env = {
    getClearedCampaignStageIndices: () => [0, 1, 2, 3, 4],
    ASCENSION_ENDINGS: [{ id: "sword_immortal" }],
    ACHIEVEMENTS: [{ id: "a1", pts: 100 }, { id: "a2", pts: 50 }],
    getBondedCompanionIds: () => ["npc_a", "npc_b"], // 2 * 80 = 160
    SYNERGIES: [{ active: () => true }, { active: () => false }] // 1 * 140 = 140
  };

  const score = computeCompetitionScore(g, env);
  assert.ok(Number.isFinite(score) && score > 9000, `Expected high valid score with pactSeals & calamityTier=2, got ${score}`);
  // Pact multiplier strictly increases score
  const scoreNoPacts = computeCompetitionScore({ ...g, pactSeals: [] }, env);
  assert.ok(score > scoreNoPacts, `Expected pactSeals to boost score (${score} > ${scoreNoPacts})`);

  // Prototype property names and non-unified grades on rushBestGrade must contribute 0 rushPts
  const baseNoRush = computeCompetitionScore({ realm: "mortal", rushBestGrade: "" });
  assert.equal(computeCompetitionScore({ realm: "mortal", rushBestGrade: "constructor" }), baseNoRush);
  assert.equal(computeCompetitionScore({ realm: "mortal", rushBestGrade: "__proto__" }), baseNoRush);
  assert.equal(computeCompetitionScore({ realm: "mortal", rushBestGrade: "toString" }), baseNoRush);
  assert.equal(computeCompetitionScore({ realm: "mortal", rushBestGrade: "SSS" }), baseNoRush);

  // Higher calamity tier increases score monotonically
  const scoreTier0 = computeCompetitionScore({ ...g, calamityTier: 0 }, env);
  const scoreTier5 = computeCompetitionScore({ ...g, calamityTier: 5 }, env);
  assert.ok(scoreTier0 < score && score < scoreTier5);
});

test("getScoreGrade enforces unified 4-tier S/A/B/C score thresholds and campaign star/stage gating rules", () => {
  // Raw thresholds (without game gating)
  assert.equal(getScoreGrade(0).grade, "C");
  assert.equal(getScoreGrade(999).grade, "C");
  assert.equal(getScoreGrade(1000).grade, "B");
  assert.equal(getScoreGrade(2200).grade, "A");
  assert.equal(getScoreGrade(4200).grade, "S");
  assert.equal(getScoreGrade(9999).grade, "S");
  assert.equal(getScoreGrade(-500).grade, "C");
  assert.equal(getScoreGrade(Number.NaN).grade, "C");

  // Gating with game state:
  // 0 stars / 0 cleared -> capped at B (>=1400) or C (<1400)
  assert.equal(getScoreGrade(9000, { stageStars: [0, 0, 0, 0, 0] }, { stageCount: 5 }).grade, "B");
  assert.equal(getScoreGrade(1200, { stageStars: [0, 0, 0, 0, 0] }, { stageCount: 5 }).grade, "C");
  // Fewer than all 5 stages cleared or <10 stars -> capped at A
  assert.equal(getScoreGrade(9000, { stageStars: [3, 3, 3, 3, 0] }, { stageCount: 5 }).grade, "A");
  assert.equal(getScoreGrade(9000, { stageStars: [2, 2, 2, 2, 1] }, { stageCount: 5 }).grade, "A");
  // All 5 stages cleared & >=10 stars -> unlocks S
  assert.equal(getScoreGrade(9000, { stageStars: [2, 2, 2, 2, 2] }, { stageCount: 5 }).grade, "S");
  assert.equal(getScoreGrade(9000, { stageStars: { 0: 3, 1: 3, 2: 3, 3: 3, 4: 3 } }, { stageCount: 5 }).grade, "S");
});
