import test from "node:test";
import assert from "node:assert/strict";
import {
  rollGearItem,
  computeGearAffixBudget,
  ensureDeterministicPity,
  pickBalancedGearSlot
} from "../../src/rules/gear-rules.mjs";
import { GEAR_BUDGET_BY_RARITY } from "../../src/config/combat-params.mjs";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("rollGearItem is 100% deterministic under identical seeded PRNG", () => {
  const g1 = { realm: "golden", pity: { epic: 0, mythic: 0, critAcc: 0, vampHits: 0, thunderHits: 0, gearDrops: 0 }, equippedGear: {} };
  const g2 = { realm: "golden", pity: { epic: 0, mythic: 0, critAcc: 0, vampHits: 0, thunderHits: 0, gearDrops: 0 }, equippedGear: {} };
  const rng1 = mulberry32(20261124);
  const rng2 = mulberry32(20261124);
  for (let i = 0; i < 20; i++) {
    const a = rollGearItem(i % 5, 0, null, { rng: rng1, game: g1, arena: null });
    const b = rollGearItem(i % 5, 0, null, { rng: rng2, game: g2, arena: null });
    assert.deepEqual(a, b);
  }
});

test("1,000 seeded gear rolls respect GEAR_BUDGET_BY_RARITY, statCaps, affix guarantee at rarity >= 2, and healthy p90/p10 spread", () => {
  const rng = mulberry32(13372026);
  const powersByTierSlot = new Map();

  for (let i = 0; i < 1000; i++) {
    const stageTier = i % 5;
    const minRarity = i % 5;
    const slot = ["weapon", "armor", "ring"][i % 3];
    const item = rollGearItem(stageTier, minRarity, slot, {
      rng,
      game: { realm: ["mortal", "qi", "foundation", "golden", "nascent", "spirit"][i % 6] },
      arena: null,
      usePity: false
    });
    const budget = computeGearAffixBudget(item);
    const spec = GEAR_BUDGET_BY_RARITY[item.rarity];
    assert.equal(budget.withinBudget, true, `Roll #${i} exceeded budget: ${JSON.stringify(budget)}`);
    assert.ok(budget.totalBudget <= spec.maxBudget + 0.01);
    assert.equal(budget.overCapStats.length, 0);
    if (item.rarity >= 2) {
      assert.ok(typeof item.affix === "string" && item.affix.length > 0, `Expected affix for rarity ${item.rarity}`);
    } else {
      assert.equal(item.affix, null);
    }

    const key = `${stageTier}:${item.rarity}:${slot}`;
    if (!powersByTierSlot.has(key)) powersByTierSlot.set(key, []);
    powersByTierSlot.get(key).push(item.power);
  }

  // Verify non-degenerate, bounded p90/p10 power spread on populated buckets
  for (const [key, arr] of powersByTierSlot.entries()) {
    if (arr.length < 20) continue;
    arr.sort((a, b) => a - b);
    const p10 = arr[Math.floor(arr.length * 0.1)];
    const p90 = arr[Math.floor(arr.length * 0.9)];
    assert.ok(p10 > 0 && p90 / p10 <= 2.2, `Spread too extreme on ${key}: p10=${p10}, p90=${p90}`);
  }
});

test("ensureDeterministicPity guarantees Epic on 4th roll and Mythic on 8th roll under worst-case low RNG", () => {
  const g = { realm: "mortal", equippedGear: {} };
  const lowRng = () => 0.01; // would naturally roll rarity 0 every time

  const drops = [];
  for (let i = 0; i < 8; i++) {
    drops.push(rollGearItem(0, 0, "weapon", { rng: lowRng, game: g, arena: null, usePity: true }));
  }

  assert.equal(drops[0].rarity, 0);
  assert.equal(drops[1].rarity, 0);
  assert.equal(drops[2].rarity, 0);
  assert.equal(drops[3].rarity, 3);
  assert.equal(drops[3].pityTriggered, "epic");
  assert.equal(drops[7].rarity, 4);
  assert.equal(drops[7].pityTriggered, "mythic");
  assert.equal(g.pity.epic, 0);
  assert.equal(g.pity.mythic, 0);
  assert.equal(g.pity.gearDrops, 8);

  // Prototype-pollution resilience in ensureDeterministicPity
  const polluted = { pity: JSON.parse('{"epic":-5,"__proto__":{"hacked":1}}') };
  const cleaned = ensureDeterministicPity(polluted);
  assert.equal(cleaned.epic, 0);
  assert.equal(({}).hacked, undefined);
});

test("pickBalancedGearSlot fills empty slots first and biases toward the weakest slot (~72%)", () => {
  assert.equal(
    pickBalancedGearSlot({ equippedGear: { weapon: { power: 50 }, armor: null, ring: { power: 40 } } }, () => 0.99),
    "armor"
  );

  const fullGame = {
    equippedGear: {
      weapon: { power: 150 },
      armor: { power: 20 },
      ring: { power: 90 }
    }
  };
  const rng = mulberry32(424242);
  let armorCount = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) {
    if (pickBalancedGearSlot(fullGame, rng) === "armor") armorCount++;
  }
  assert.ok(armorCount > 660 && armorCount < 780, `Expected ~72% weak-slot bias, got ${armorCount}/${N}`);
});
