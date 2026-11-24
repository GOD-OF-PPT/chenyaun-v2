import test from "node:test";
import assert from "node:assert/strict";
import {
  VOLUME_CAMPAIGN_GUIDE,
  VOL5_RESONANCE_PILLARS,
  HIGH_TIER_MODE_REGISTRY,
  EXPEDITION_NODE_STAGE_MAP,
  getExpeditionNodeStageSynergy,
  getSpireCloudSeaYieldMult,
  computeEndgameMasteryResonance,
  buildVol5ResonanceSnapshot
} from "../../src/rules/campaign-q6.mjs";
import { ACTION_REALM_REQ, SYSTEM_ECOSYSTEM_LADDER } from "../../src/config/progression-data.mjs";
import { computeCombatStatLedger, getCombatStats } from "../../src/rules/combat-stats.mjs";

function makeCleanGame(overrides = {}) {
  return Object.assign({
    realm: "nascent",
    school: "sword",
    perk: "mortal_grit",
    hp: 300,
    mp: 120,
    xp: 200,
    stones: 150,
    karmaScore: 0,
    karmaDrBonus: 0,
    statMultBonus: 1,
    maxHpBonus: 0,
    atkFlatBonus: 0,
    startAgeMonths: 216,
    elapsedMonths: 0,
    omenIndex: 0,
    laws: [],
    choices: {},
    aids: {},
    destinyFruits: [],
    loadout: { mind: "sword_mind", builder: "sword_build", finisher: "sword_release", relic: null },
    relicStars: {},
    equippedGear: { weapon: null, armor: null, ring: null, charm: null },
    pet: { id: null, level: 1, skills: {} },
    sanctumLevels: { cauldron: 1, sword_forge: 1, spirit_eye: 1, scripture_hall: 1, guard_array: 1 },
    inventory: { spirit_seal_pill: 0 },
    stageStars: [0, 0, 0, 0, 0],
    defeatedStageBosses: {},
    cloudSeaCleared: false,
    litStars: [],
    expeditions: { assignments: {}, bankedStones: 0, bankedStars: 0 },
    bestSpireFloor: 0,
    rushBestGrade: "",
    sectMerits: 0
  }, overrides);
}

test("VOLUME_CAMPAIGN_GUIDE covers all 6 volumes with complete boss exam, growth payoff, and D01 optional route notes", () => {
  assert.equal(VOLUME_CAMPAIGN_GUIDE.length, 6);
  const volIndices = VOLUME_CAMPAIGN_GUIDE.map(v => v.volIndex);
  assert.deepEqual(volIndices, [1, 2, 3, 4, 5, 6]);
  for (const v of VOLUME_CAMPAIGN_GUIDE) {
    assert.ok(v.title && v.realmSpan && v.goalSummary && v.growthPayoff && v.companionPrompt && v.optionalRouteNote);
    assert.ok(v.enemyExam && v.enemyExam.bossId && v.enemyExam.bossName && v.enemyExam.telegraph && v.enemyExam.counter && v.enemyExam.punishWindow);
    assert.ok(v.stageIdx >= 0 && v.stageIdx <= 4);
    assert.ok(Array.isArray(v.companionIds) && v.companionIds.length >= 1);
  }
});

test("HIGH_TIER_MODE_REGISTRY exposes 3 semantic groups and preserves 14 ecosystem ladder systems + D07 ACTION_REALM_REQ", () => {
  assert.equal(HIGH_TIER_MODE_REGISTRY.length, 3);
  assert.deepEqual(
    HIGH_TIER_MODE_REGISTRY.map(g => g.groupId),
    ["mainline_embedded", "endgame_trials", "dojo_tools"]
  );
  const ladderTotal = SYSTEM_ECOSYSTEM_LADDER.reduce((s, t) => s + t.systems.length, 0);
  assert.equal(ladderTotal, 14, "M4-1 requires exactly 14 systems in SYSTEM_ECOSYSTEM_LADDER");
  assert.equal(ACTION_REALM_REQ.coop_2p, 3, "D07: coop_2p must unlock at Golden Core (rank 3)");
  assert.equal(ACTION_REALM_REQ.celestial_time, 3, "D07: celestial_time must unlock at Golden Core (rank 3)");
  assert.equal(ACTION_REALM_REQ.sequencer, 3);
});

test("getExpeditionNodeStageSynergy & getSpireCloudSeaYieldMult compute exact non-locking multipliers", () => {
  assert.equal(Object.keys(EXPEDITION_NODE_STAGE_MAP).length, 5);
  const fresh = makeCleanGame();
  assert.equal(getSpireCloudSeaYieldMult(fresh), 1.0);
  assert.equal(getSpireCloudSeaYieldMult(makeCleanGame({ cloudSeaCleared: true })), 1.15);

  const baseSyn = getExpeditionNodeStageSynergy(fresh, "qinglan_vein");
  assert.equal(baseSyn.mult, 1.0);
  assert.equal(baseSyn.tier, "base");

  const clearedSyn = getExpeditionNodeStageSynergy(makeCleanGame({ defeatedStageBosses: { 1: true } }), "qingyun_peak");
  assert.equal(clearedSyn.mult, 1.15);
  assert.equal(clearedSyn.tier, "cleared");

  const fullStarSyn = getExpeditionNodeStageSynergy(makeCleanGame({ stageStars: [0, 0, 3, 0, 0] }), "zhaoying_lake");
  assert.equal(fullStarSyn.mult, 1.30);
  assert.equal(fullStarSyn.tier, "full_star");

  const unknownSyn = getExpeditionNodeStageSynergy(fresh, "unknown_node");
  assert.equal(unknownSyn.mult, 1.0);
});

test("computeEndgameMasteryResonance yields 0 bonus at 0 pillars and scales cleanly into computeCombatStatLedger at 4-6 pillars", () => {
  assert.equal(VOL5_RESONANCE_PILLARS.length, 6);
  const zeroGame = makeCleanGame();
  const r0 = computeEndgameMasteryResonance(zeroGame);
  assert.equal(r0.activeCount, 0);
  assert.equal(r0.passiveAtkPct, 0);
  assert.equal(r0.drBonus, 0);
  assert.equal(r0.critBonus, 0);

  const ledger0 = computeCombatStatLedger(zeroGame);
  assert.equal(ledger0.entries.some(e => e.category === "mastery"), false, "Zero active pillars must add zero mastery entries");

  const fourPillarGame = makeCleanGame({
    cloudSeaCleared: true,
    litStars: ["a1", "a2", "a3", "a4"],
    expeditions: { assignments: { qinglan_vein: "shen" }, bankedStones: 0, bankedStars: 0 },
    bestSpireFloor: 3
  });
  const r4 = computeEndgameMasteryResonance(fourPillarGame);
  assert.equal(r4.activeCount, 4);
  assert.equal(r4.passiveAtkPct, 0.10);
  assert.equal(r4.drBonus, 8);
  assert.equal(r4.critBonus, 0.03);

  const ledger4 = computeCombatStatLedger(fourPillarGame);
  const stats4 = getCombatStats(fourPillarGame);
  assert.equal(stats4.atk, ledger4.totals.atk);
  assert.equal(stats4.dmgReduce, ledger4.totals.dmgReduce);
  assert.equal(stats4.crit, ledger4.totals.crit);
  assert.equal(ledger4.totals.dmgReduce - ledger0.totals.dmgReduce, 8);
  assert.ok(ledger4.totals.atk > ledger0.totals.atk);
  assert.ok(Math.abs((ledger4.totals.crit - ledger0.totals.crit) - 0.03) < 1e-9);

  const sixPillarGame = makeCleanGame({
    cloudSeaCleared: true,
    litStars: ["a1", "a2", "a3", "a4"],
    expeditions: { assignments: { qinglan_vein: "shen" }, bankedStones: 0, bankedStars: 0 },
    bestSpireFloor: 9,
    rushBestGrade: "S",
    sectMerits: 2
  });
  const r6 = computeEndgameMasteryResonance(sixPillarGame);
  assert.equal(r6.activeCount, 6);
  assert.equal(r6.passiveAtkPct, 0.15);
  assert.equal(r6.drBonus, 12);
  assert.equal(r6.critBonus, 0.03);
});

test("buildVol5ResonanceSnapshot accurately evaluates D01/D04 conservative Vol 5 progress", () => {
  const gIncomplete = makeCleanGame({ realm: "nascent", xp: 100, laws: ["wanjian", "yinyang"] });
  const s0 = buildVol5ResonanceSnapshot(gIncomplete);
  assert.equal(s0.isNascent, true);
  assert.equal(s0.s5LawsDone, false);
  assert.equal(s0.readyForSpiritTribulation, false);
  assert.ok(s0.dualBreakthroughNote.includes("化神丹") && s0.dualBreakthroughNote.includes("无丹"));

  const gByRelic = makeCleanGame({
    realm: "nascent",
    xp: 99999,
    defeatedStageBosses: { 3: true },
    loadout: { mind: "sword_mind", builder: "sword_build", finisher: "sword_release", relic: "frost_sword" },
    relicStars: { frost_sword: 3 },
    choices: { shen_pact: "lend" }
  });
  const s1 = buildVol5ResonanceSnapshot(gByRelic);
  assert.equal(s1.s5LawsDone, true, "Relic ★3 satisfies s5_laws even with 0 Dao laws");
  assert.equal(s1.readyForSpiritTribulation, true);
  assert.equal(s1.companionStatus.find(c => c.id === "shen").done, true);
  assert.equal(s1.companionStatus.find(c => c.id === "yan").done, false);
});
