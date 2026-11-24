import test from "node:test";
import assert from "node:assert/strict";
import {
  getCalamityCycleSpec,
  getTotalStageStars,
  computeCompetitionScore,
  getScoreGrade
} from "../../src/rules/scoring-rules.mjs";
import { CALAMITY_CYCLES } from "../../src/config/progression-data.mjs";

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
    rushBestGrade: "SS", // 300
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

  // Prototype property names on rushBestGrade must contribute 0 rushPts
  const baseNoRush = computeCompetitionScore({ realm: "mortal", rushBestGrade: "" });
  assert.equal(computeCompetitionScore({ realm: "mortal", rushBestGrade: "constructor" }), baseNoRush);
  assert.equal(computeCompetitionScore({ realm: "mortal", rushBestGrade: "__proto__" }), baseNoRush);
  assert.equal(computeCompetitionScore({ realm: "mortal", rushBestGrade: "toString" }), baseNoRush);

  // Higher calamity tier increases score monotonically
  const scoreTier0 = computeCompetitionScore({ ...g, calamityTier: 0 }, env);
  const scoreTier5 = computeCompetitionScore({ ...g, calamityTier: 5 }, env);
  assert.ok(scoreTier0 < score && score < scoreTier5);
});

test("getScoreGrade enforces raw score thresholds and campaign star/stage gating rules", () => {
  // Raw thresholds (without game gating)
  assert.equal(getScoreGrade(0).grade, "C");
  assert.equal(getScoreGrade(999).grade, "C");
  assert.equal(getScoreGrade(1000).grade, "B");
  assert.equal(getScoreGrade(2000).grade, "A");
  assert.equal(getScoreGrade(3400).grade, "S");
  assert.equal(getScoreGrade(4800).grade, "SS");
  assert.equal(getScoreGrade(6400).grade, "SSS");
  assert.equal(getScoreGrade(-500).grade, "C");
  assert.equal(getScoreGrade(Number.NaN).grade, "C");

  // Gating with game state:
  // 0 stars / 0 cleared -> capped at B (>=1400) or C (<1400)
  assert.equal(getScoreGrade(9000, { stageStars: [0, 0, 0, 0, 0] }, { stageCount: 5 }).grade, "B");
  assert.equal(getScoreGrade(1200, { stageStars: [0, 0, 0, 0, 0] }, { stageCount: 5 }).grade, "C");
  // Fewer than all 5 stages cleared or <8 stars -> capped at A
  assert.equal(getScoreGrade(9000, { stageStars: [3, 3, 3, 3, 0] }, { stageCount: 5 }).grade, "A");
  assert.equal(getScoreGrade(9000, { stageStars: [1, 1, 1, 1, 1] }, { stageCount: 5 }).grade, "A");
  // All 5 stages cleared, 8..11 stars -> capped at S
  assert.equal(getScoreGrade(9000, { stageStars: [2, 2, 2, 2, 2] }, { stageCount: 5 }).grade, "S");
  // All 5 stages cleared, 12..13 stars -> capped at SS
  assert.equal(getScoreGrade(9000, { stageStars: [3, 3, 3, 2, 2] }, { stageCount: 5 }).grade, "SS");
  // All 5 stages cleared, >=14 stars -> unlocks SSS
  assert.equal(getScoreGrade(9000, { stageStars: [3, 3, 3, 3, 2] }, { stageCount: 5 }).grade, "SSS");
  assert.equal(getScoreGrade(9000, { stageStars: [3, 3, 3, 3, 3] }, { stageCount: 5 }).grade, "SSS");
});
