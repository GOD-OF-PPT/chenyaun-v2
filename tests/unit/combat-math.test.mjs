import test from "node:test";
import assert from "node:assert/strict";
import {
  applySingleHitCap,
  computeCombatStatLedger,
  computeMainlineRealmScaling,
  getStyleRankSpec,
  getComboTier,
  getSchoolSpecBonus,
  getDaoBonuses
} from "../../src/rules/combat-stats.mjs";
import { COMBAT_RULE_PARAMS, SINGLE_HIT_CAP_RATIO, REALM_COMBAT_BASELINE } from "../../src/config/combat-params.mjs";

test("applySingleHitCap enforces 45% maxHp cap, uncapped override, DR floor 0.35, and min-4 damage floor", () => {
  assert.equal(SINGLE_HIT_CAP_RATIO, 0.45);
  assert.equal(applySingleHitCap(0, 200, 0), 0);
  assert.equal(applySingleHitCap(-50, 200, 0), 0);
  assert.equal(applySingleHitCap(Number.NaN, 200, 0), 0);

  // Huge hit is capped to 45% of maxHp (200 * 0.45 = 90)
  assert.equal(applySingleHitCap(9999, 200, 0), 90);
  // Uncapped override bypasses 45% cap
  assert.equal(applySingleHitCap(9999, 200, 0, { uncapped: true }), 9999);

  // Min-4 floor even with tiny hit and extreme DR
  assert.equal(applySingleHitCap(1, 200, 5000), 4);
  // DR floor: 100 / (100 + dmgReduce) never drops below 0.35
  const extremeDrDmg = applySingleHitCap(1000, 10000, 999999, { uncapped: true });
  assert.equal(extremeDrDmg, 350);
  const moderateDrDmg = applySingleHitCap(1000, 10000, 100, { uncapped: true });
  assert.equal(moderateDrDmg, 500);

  // Pact multiplier & ward multiplier combine cleanly before cap
  const warded = applySingleHitCap(100, 1000, 0, { pactEnemyMult: 1.25, wardMult: 0.86, uncapped: true });
  assert.equal(warded, Math.round(100 * 1.25 * 0.86));

  // Defensive non-finite / invalid coercion guards (Infinity, strings, NaN multipliers)
  assert.equal(applySingleHitCap(Number.POSITIVE_INFINITY, 200, 0, { uncapped: true }), 0);
  assert.equal(applySingleHitCap(Number.NEGATIVE_INFINITY, 200, 0, { uncapped: true }), 0);
  assert.equal(applySingleHitCap(50, 200, "abc", { uncapped: true }), 50);
  assert.equal(applySingleHitCap(50, 200, 0, { pactEnemyMult: Number.NaN, wardMult: "bad", uncapped: true }), 50);
});

test("computeCombatStatLedger enforces DR floor >= 0.35, crit <= 0.78, critMult <= 2.35, haste in [0.70, 1.85], activeMult <= 1.95", () => {
  const overloadedGame = {
    realm: "spirit",
    school: "sword",
    perk: "sword_sovereign",
    stones: 99999,
    hp: 10,
    maxHpBonus: 200,
    atkFlatBonus: 100,
    statMultBonus: 5.0,
    karmaScore: 100,
    karmaDrBonus: 999,
    omenIndex: 3, // wolf_star
    laws: ["crit_lotus", "wealth_power", "age_might", "karma_resonance", "void_haste"],
    destinyFruits: ["eternal_pine"],
    loadout: { mind: "sword_still", relic: "jade_seal" },
    relicStars: { jade_seal: 5 },
    pet: { id: "fox", level: 5, skills: { tier3: "fury_fang", tier5: "celestial_wrath" } },
    sanctumLevels: { spirit_eye: 5, cauldron: 5, sword_forge: 5, scripture_hall: 5, guard_array: 5 },
    dao: { benevolence: 200, edge: 200, serenity: 200 },
    equippedGear: {
      weapon: { slot: "weapon", rarity: 5, lvl: 10, atk: 200, hp: 0, dr: 0, crit: 0.22, spd: 0.22, bonusSword: 2, affix: "wind_rider" },
      armor: { slot: "armor", rarity: 5, lvl: 10, atk: 0, hp: 900, dr: 64, crit: 0.22, spd: 0.22, bonusSword: 0, affix: "wind_rider" },
      ring: { slot: "ring", rarity: 5, lvl: 10, atk: 120, hp: 0, dr: 0, crit: 0.22, spd: 0.22, bonusSword: 0, affix: "wind_rider" }
    }
  };
  const burstArena = {
    comboCount: 40,
    styleScore: 1000,
    reversedDomainTimer: 8,
    weaponPosture: "xuanzhong",
    domain: { active: true },
    bossRush: { active: true },
    rushAffixes: ["rush_glass"],
    astralForm: { active: true, mode: "demonic" },
    player: { shieldHp: 100, boonOverloadTimer: 5, gourdHasteTimer: 5, gourdCritTimer: 5, petBuffTimer: 5 }
  };

  const ledger = computeCombatStatLedger(overloadedGame, {
    arena: burstArena,
    getCurrentCelestialPhase: () => ({ id: "blood_dusk" }),
    getActiveDungeonClimate: () => ({ id: "blood_haze" }),
    hasRunBoon: () => true,
    getCurioStacks: () => 3,
    getStarChartBonuses: () => ({ atk: 50, hp: 200, dr: 50, crit: 0.30, critMult: 0.60, spd: 0.40, mp: 60 })
  });

  assert.ok(ledger.totals.drMult >= 0.35, `Expected drMult >= 0.35, got ${ledger.totals.drMult}`);
  assert.ok(ledger.totals.crit <= COMBAT_RULE_PARAMS.critCap + 1e-9);
  assert.ok(ledger.totals.critMult <= COMBAT_RULE_PARAMS.critMultCap + 1e-9);
  assert.ok(ledger.totals.atkHaste >= 0.70 && ledger.totals.atkHaste <= 1.85);
  assert.equal(ledger.totals.statBreakdown.activeMult, COMBAT_RULE_PARAMS.activeMultCap);

  // Heavy posture with zero haste bonuses still respects >= 0.70 floor
  const slowLedger = computeCombatStatLedger({ realm: "mortal", school: "talisman" }, {
    arena: { weaponPosture: "xuanzhong", comboCount: 0, styleScore: 0 }
  });
  assert.ok(slowLedger.totals.atkHaste >= 0.70);
});

test("getSchoolSpecBonus and getDaoBonuses return distinct, bounded profiles", () => {
  const sword = getSchoolSpecBonus({ school: "sword" });
  const talisman = getSchoolSpecBonus({ school: "talisman" });
  assert.equal(sword.id, "sword");
  assert.equal(sword.hasteBonus, 0.10);
  assert.equal(sword.swordSynergyMult, 1.18);
  assert.equal(sword.critMultBonus, 0.08);
  assert.equal(sword.chainLightningOnFinisher, false);

  assert.equal(talisman.id, "talisman");
  assert.equal(talisman.mpRegenMult, 1.25);
  assert.equal(talisman.skillDmgMult, 1.16);
  assert.equal(talisman.chainLightningOnFinisher, true);

  const dao = getDaoBonuses({ dao: { benevolence: 999, edge: 999, serenity: 999 } });
  assert.equal(dao.healMult, 1.28);
  assert.equal(dao.shieldMult, 1.25);
  assert.equal(dao.postureMult, 1.25);
  assert.equal(dao.critBonus, 0.08);
  assert.equal(dao.execMult, 1.18);
  assert.equal(dao.mpRegenMult, 1.32);
  assert.equal(dao.stoneMult, 1.24);
});

test("computeMainlineRealmScaling preserves 1.0x at-realm, scales Stage 4 Spirit/Ascended, and damps Stages 0-3 revisits", () => {
  // At-realm and under-realm (delta <= 0) => exact 1.0x inactive
  for (const [stg, realm] of [[0, "mortal"], [1, "qi"], [2, "foundation"], [3, "golden"], [4, "nascent"], [3, "qi"]]) {
    const r = computeMainlineRealmScaling(stg, realm, true);
    assert.deepEqual(r, { active: false, delta: 0, hpMult: 1, atkMult: 1, postureMult: 1, stoneMult: 1 });
  }

  // Stage 4 Spirit (delta = 1): full hpEase = 1.0, atkEase = 1.0
  const s4SpiritBoss = computeMainlineRealmScaling(4, "spirit", true);
  assert.equal(s4SpiritBoss.active, true);
  assert.equal(s4SpiritBoss.delta, 1);
  assert.equal(s4SpiritBoss.hpMult, 1.407);
  assert.equal(s4SpiritBoss.atkMult, 1.414);
  assert.equal(s4SpiritBoss.postureMult, 1.12);
  assert.equal(s4SpiritBoss.stoneMult, 1.22);

  const s4SpiritMob = computeMainlineRealmScaling(4, "spirit", false);
  assert.equal(s4SpiritMob.hpMult, 1.452);
  assert.equal(s4SpiritMob.atkMult, 1.414);

  // Stage 4 Ascended (delta = 2): hpEase = 0.90, atkEase = 0.82
  const s4AscBoss = computeMainlineRealmScaling(4, "ascended", true);
  const rawHpAsc = REALM_COMBAT_BASELINE.ascended.bossHp / REALM_COMBAT_BASELINE.nascent.bossHp;
  const rawAtkAsc = REALM_COMBAT_BASELINE.ascended.atk / REALM_COMBAT_BASELINE.nascent.atk;
  assert.equal(s4AscBoss.delta, 2);
  assert.equal(s4AscBoss.hpMult, Number((1 + (rawHpAsc - 1) * 0.90).toFixed(3)));
  assert.equal(s4AscBoss.atkMult, Number((1 + (rawAtkAsc - 1) * 0.82).toFixed(3)));
  assert.equal(s4AscBoss.postureMult, 1.24);
  assert.equal(s4AscBoss.stoneMult, 1.44);

  // Stage 0 revisit at Spirit (delta = 5) & Ascended (delta = 6): damped easing & caps
  const s0Spirit = computeMainlineRealmScaling(0, "spirit", true);
  assert.equal(s0Spirit.active, true);
  assert.equal(s0Spirit.delta, 5);
  assert.ok(s0Spirit.hpMult > 10 && s0Spirit.hpMult < REALM_COMBAT_BASELINE.spirit.bossHp / REALM_COMBAT_BASELINE.mortal.bossHp);
  assert.equal(s0Spirit.postureMult, 1.6);
  assert.equal(s0Spirit.stoneMult, 2.1);

  const s0Asc = computeMainlineRealmScaling(0, "ascended", true);
  assert.equal(s0Asc.delta, 6);
  assert.equal(s0Asc.postureMult, 1.65);
  assert.equal(s0Asc.stoneMult, 2.2);

  // Clamping & invalid input guards
  assert.deepEqual(computeMainlineRealmScaling(-5, "mortal", true), { active: false, delta: 0, hpMult: 1, atkMult: 1, postureMult: 1, stoneMult: 1 });
  assert.deepEqual(computeMainlineRealmScaling(99, "spirit", true), s4SpiritBoss);
  assert.deepEqual(computeMainlineRealmScaling(Number.NaN, "mortal", false), { active: false, delta: 0, hpMult: 1, atkMult: 1, postureMult: 1, stoneMult: 1 });
});

test("getStyleRankSpec and getComboTier emit strictly unified C/B/A/S ranks (zero D or SSS)", () => {
  const allowed = new Set(["C", "B", "A", "S"]);
  for (const sc of [-10, 0, 85, 179, 180, 399, 400, 699, 700, 1200]) {
    const sp = getStyleRankSpec(sc);
    assert.ok(allowed.has(sp.rank), `Unexpected style rank ${sp.rank} at score ${sc}`);
  }
  assert.equal(getStyleRankSpec(0).rank, "C");
  assert.equal(getStyleRankSpec(180).rank, "B");
  assert.equal(getStyleRankSpec(400).rank, "A");
  assert.equal(getStyleRankSpec(700).rank, "S");

  for (const h of [0, 3, 4, 9, 10, 21, 22, 50]) {
    const ct = getComboTier(h);
    assert.ok(allowed.has(ct.rank), `Unexpected combo rank ${ct.rank} at hits ${h}`);
  }
  assert.equal(getComboTier(0).rank, "C");
  assert.equal(getComboTier(4).rank, "B");
  assert.equal(getComboTier(10).rank, "A");
  assert.equal(getComboTier(22).rank, "S");
});
