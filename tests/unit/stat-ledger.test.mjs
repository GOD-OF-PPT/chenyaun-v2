import test from "node:test";
import assert from "node:assert/strict";
import { softCapPct } from "../../src/rules/utils.mjs";
import { effectiveGearVal, getGearTotals, getActiveSetBonus } from "../../src/rules/gear-rules.mjs";
import { computeCombatStatLedger, getCombatStats, rankOf, getMaxHp } from "../../src/rules/combat-stats.mjs";
import { REALM_ORDER, REALMS } from "../../src/config/realms-items.mjs";
import { COMBAT_RULE_PARAMS } from "../../src/config/combat-params.mjs";

function makeBaseGame(overrides = {}) {
  return Object.assign({
    realm: "foundation",
    school: "sword",
    perk: "sword_bone",
    stones: 400,
    hp: 250,
    maxHpBonus: 35,
    atkFlatBonus: 12,
    statMultBonus: 1.10,
    startAgeMonths: 216,
    elapsedMonths: 240,
    karmaScore: 0,
    karmaDrBonus: 0,
    omenIndex: 0,
    loadout: { mind: "sword_mind", builder: "sword_build", finisher: "sword_release", relic: null },
    relicStars: {},
    laws: [],
    choices: {},
    destinyFruits: [],
    pet: { id: null, level: 1, skills: { tier3: null, tier5: null } },
    sanctumLevels: { spirit_eye: 1, cauldron: 1, sword_forge: 1, scripture_hall: 1, guard_array: 1 },
    dao: { benevolence: 10, edge: 20, serenity: 10 },
    equippedGear: {
      weapon: { slot: "weapon", rarity: 2, lvl: 2, atk: 24, hp: 0, dr: 0, crit: 0.06, spd: 0, bonusSword: 0, affix: "posture_crush" },
      armor: { slot: "armor", rarity: 2, lvl: 2, atk: 0, hp: 70, dr: 10, crit: 0, spd: 0, bonusSword: 0, affix: "xuanwu_ward" },
      ring: { slot: "ring", rarity: 2, lvl: 2, atk: 12, hp: 0, dr: 0, crit: 0.05, spd: 0.08, bonusSword: 0, affix: "wind_rider" }
    }
  }, overrides);
}

test("softCapPct preserves values up to knee, clamps floor at -0.5, and approaches cap asymptotically", () => {
  assert.equal(softCapPct(-2.0, 0.95, 1.65), -0.5);
  assert.equal(softCapPct(0, 0.95, 1.65), 0);
  assert.equal(softCapPct(0.95, 0.95, 1.65), 0.95);
  const mid = softCapPct(1.5, 0.95, 1.65);
  const high = softCapPct(4.0, 0.95, 1.65);
  const extreme = softCapPct(50.0, 0.95, 1.65);
  assert.ok(mid > 0.95 && mid < 1.5);
  assert.ok(high > mid && high < 1.65);
  assert.ok(extreme <= 1.65 && extreme > 1.649);
});

test("effectiveGearVal enforces +1 per level floor and strict monotonicity across enhancement levels", () => {
  const tinyGear = { atk: 2, hp: 1, dr: 1, lvl: 0 };
  for (const key of ["atk", "hp", "dr"]) {
    let prev = effectiveGearVal(tinyGear, key, 0);
    for (let lvl = 1; lvl <= 10; lvl++) {
      const cur = effectiveGearVal(tinyGear, key, lvl);
      assert.ok(cur >= prev + 1, `Expected ${key} at +${lvl} (${cur}) >= prev + 1 (${prev + 1})`);
      prev = cur;
    }
  }
  const strongGear = { atk: 50, hp: 120, dr: 20, lvl: 5 };
  assert.equal(effectiveGearVal(strongGear, "atk"), Math.round(50 * (1 + 5 * 0.08)));
  assert.equal(effectiveGearVal(strongGear, "hp"), Math.round(120 * (1 + 5 * 0.08)));
  assert.equal(effectiveGearVal({ atk: 0, lvl: 5 }, "atk"), 0);
});

test("computeCombatStatLedger totals match getCombatStats across realms, schools, laws, sets, and karma", () => {
  for (const realm of REALM_ORDER) {
    for (const school of ["sword", "talisman"]) {
      const g = makeBaseGame({
        realm,
        school,
        stones: 900,
        karmaScore: school === "sword" ? -40 : 40,
        laws: ["wealth_power", "age_might", "karma_resonance", "crit_lotus"],
        choices: { lu_intro: "listen", shen_return: "warm", pei_meet: "rival" },
        destinyFruits: ["eternal_pine"],
        loadout: { mind: school === "sword" ? "sword_pierce" : "talisman_clear", builder: "sword_build", finisher: "sword_release", relic: "frost_sword" },
        relicStars: { frost_sword: 4 }
      });
      const ledger = computeCombatStatLedger(g);
      const stats = getCombatStats(g);
      assert.equal(stats.maxHp, ledger.totals.maxHp);
      assert.equal(stats.maxMp, ledger.totals.maxMp);
      assert.equal(stats.atk, ledger.totals.atk);
      assert.equal(stats.dmgReduce, ledger.totals.dmgReduce);
      assert.equal(stats.crit, ledger.totals.crit);
      assert.equal(stats.critMult, ledger.totals.critMult);
      assert.equal(stats.atkHaste, ledger.totals.atkHaste);
      assert.equal(stats.speed, ledger.totals.speed);
      assert.deepEqual(stats.statBreakdown, ledger.totals.statBreakdown);
      assert.ok(ledger.entries.length >= 10);
      assert.ok(ledger.totals.statBreakdown.cappedPassivePct <= COMBAT_RULE_PARAMS.passiveSoftCapMax + 1e-6);
      assert.ok(ledger.totals.statBreakdown.activeMult <= COMBAT_RULE_PARAMS.activeMultCap + 1e-6);
    }
  }
});

test("rankOf, getGearTotals, getActiveSetBonus, and getMaxHp behave deterministically across realms", () => {
  assert.equal(rankOf("mortal"), 0);
  assert.equal(rankOf("spirit"), 5);
  assert.equal(rankOf("ascended"), 6);
  assert.equal(rankOf("nonexistent"), 0);

  const g = makeBaseGame();
  const setB = getActiveSetBonus(g);
  assert.equal(setB.minR, 2);
  assert.equal(setB.crit, 0.06);
  const gt = getGearTotals(g);
  // wind_rider adds +0.10 to ring spd (0.08 + 0.10 = 0.18)
  assert.ok(Math.abs(gt.spd - 0.18) < 1e-9);
  assert.ok(gt.atk > 0 && gt.hp > 0 && gt.dr > 0);

  const mortalHp = getMaxHp({ realm: "mortal", maxHpBonus: 0 });
  const spiritHp = getMaxHp({ realm: "spirit", maxHpBonus: 0 });
  assert.equal(mortalHp, REALMS.mortal.maxHp);
  assert.equal(spiritHp, REALMS.spirit.maxHp);
  assert.ok(spiritHp > mortalHp);
});
