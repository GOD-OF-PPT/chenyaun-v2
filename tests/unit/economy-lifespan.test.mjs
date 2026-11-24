import test from "node:test";
import assert from "node:assert/strict";
import {
  computeRecipeCostBreakdown,
  computeBatchRecipeCost,
  computeBatchEnhancePreview,
  getLifespanInfo,
  previewLifespanImpact
} from "../../src/rules/economy-rules.mjs";
import { ITEMS, RECIPES } from "../../src/config/realms-items.mjs";

test("all catalog items satisfy strict buy > sell anti-arbitrage invariant (even under 0.8x Fair omen)", () => {
  for (const [id, item] of Object.entries(ITEMS)) {
    if (item.sell == null) continue;
    const fairBuy = Math.round(item.buy * 0.8);
    assert.ok(
      fairBuy > item.sell,
      `Item ${id} allows buy-sell arbitrage under fair omen: fairBuy=${fairBuy} <= sell=${item.sell}`
    );
  }
});

test("computeRecipeCostBreakdown and computeBatchRecipeCost compute missing mats, fair discount, and cauldron bonuses accurately", () => {
  const gNormal = { omenIndex: 0, inventory: { herb: 1, dew: 0 }, laws: [], sanctumLevels: { cauldron: 1 } };
  const bd = computeRecipeCostBreakdown(gNormal, RECIPES.healing);
  // healing: herb x2 (have 1, lack 1 @ buy=6), stones=2
  assert.equal(bd.fairDisc, 1.0);
  assert.equal(bd.baseStones, 2);
  assert.equal(bd.matBuyCost, 6);
  assert.equal(bd.totalStoneCost, 8);
  assert.equal(bd.hasMissing, true);

  const gFair = { omenIndex: 4, inventory: { herb: 2 }, laws: ["nine_pill"], sanctumLevels: { cauldron: 4 } };
  const batch5 = computeBatchRecipeCost(gFair, RECIPES.healing, 5);
  // fairDisc=0.8; baseStonesEach=round(2*0.8)=2 -> 10; herb req=10, have=2, lack=8, unitPrice=round(6*0.8)=5 -> matBuy=40
  assert.equal(batch5.qty, 5);
  assert.equal(batch5.fairDisc, 0.8);
  assert.equal(batch5.baseStones, 10);
  assert.equal(batch5.matBuyCost, 40);
  assert.equal(batch5.totalStoneCost, 50);
  assert.equal(batch5.totalMonths, 15);
  assert.equal(batch5.perCraft, 2);
  assert.equal(batch5.totalOutput, 10);
  assert.equal(batch5.bonusHealing, 5);
});

test("computeBatchEnhancePreview validates step bounds and computes exact stat deltas without mutating input game", () => {
  const g = {
    realm: "qi",
    stones: 500,
    sanctumLevels: { sword_forge: 3 },
    equippedGear: {
      weapon: { slot: "weapon", name: "灵剑", rarity: 2, lvl: 1, atk: 30, hp: 0, dr: 0, crit: 0.05, spd: 0, bonusSword: 0 }
    }
  };
  const invalid = computeBatchEnhancePreview(g, "weapon", 0);
  assert.equal(invalid.valid, false);
  const preview = computeBatchEnhancePreview(g, "weapon", 3);
  assert.equal(preview.valid, true);
  assert.equal(preview.fromLvl, 1);
  assert.equal(preview.toLvl, 4);
  assert.ok(preview.totalCost > 0);
  assert.equal(preview.canAfford, true);
  assert.ok(preview.dAtk > 0);
  assert.equal(g.equippedGear.weapon.lvl, 1, "Preview must not mutate original equipped gear");
});

test("getLifespanInfo and previewLifespanImpact accurately detect 75%/90%/95%/100% thresholds including Spirit 5036->5037->5040 and multi-band jumps", () => {
  // Spirit realm maxMonths = 6720; 75% is exactly 5040 months (216 startAge + 4824 elapsed)
  // Check subtle rounding boundary: 5036/6720 = 0.74940... (<0.75), 5037/6720 = 0.74955... (rounds to 0.750 but rawRatio < 0.75!), 5040/6720 = 0.75000 (>=0.75)
  const g5036 = { realm: "spirit", startAgeMonths: 216, elapsedMonths: 5036 - 216 };
  const p5037 = previewLifespanImpact(g5036, 1, { sandboxMode: false });
  assert.equal(p5037.after.curMonths, 5037);
  assert.deepEqual(p5037.crossedThresholds, [], "5036->5037 must NOT falsely cross 75% despite rounded ratio 0.750");

  const g5037 = { realm: "spirit", startAgeMonths: 216, elapsedMonths: 5037 - 216 };
  const p5040 = previewLifespanImpact(g5037, 3, { sandboxMode: false });
  assert.equal(p5040.after.curMonths, 5040);
  assert.deepEqual(p5040.crossedThresholds, [75]);
  assert.equal(p5040.crossesAny, true);

  // Multi-band jump across 75%, 90%, 95%, and 100% in a single action (mortal maxMonths = 744)
  const gYoung = { realm: "mortal", startAgeMonths: 216, elapsedMonths: 0 };
  const jumpAll = previewLifespanImpact(gYoung, 600, { sandboxMode: false });
  assert.deepEqual(jumpAll.crossedThresholds, [75, 90, 95, 100]);
  assert.equal(jumpAll.willExhaust, true);
  assert.equal(jumpAll.after.status, "exhausted");
  assert.equal(jumpAll.after.xpEfficiencyMult, 0.25);
  assert.match(jumpAll.warningText, /绝不删档/);

  // Sandbox / Ascended exemptions consume 0 effective months
  const sandboxPrev = previewLifespanImpact(gYoung, 600, { sandboxMode: true });
  assert.equal(sandboxPrev.sandboxExempt, true);
  assert.equal(sandboxPrev.effectiveDelta, 0);
  assert.deepEqual(sandboxPrev.crossedThresholds, []);

  const ascInfo = getLifespanInfo({ realm: "ascended", startAgeMonths: 216, elapsedMonths: 99999 });
  assert.equal(ascInfo.isExhausted, false);
  assert.equal(ascInfo.xpEfficiencyMult, 1.0);
});
