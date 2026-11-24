// Pure alchemy cost breakdown, batch craft/enhance previews, and lifespan threshold rules.
import { num } from "./utils.mjs";
import { LIFESPAN_THRESHOLDS } from "../config/combat-params.mjs";
import { REALMS, ITEMS } from "../config/realms-items.mjs";
import { getSanctumLevel, getGearEnhanceCost } from "./gear-rules.mjs";
import { hasLaw, currentOmen, getCombatStats } from "./combat-stats.mjs";

export function computeRecipeCostBreakdown(g, rec) {
  const fairDisc = (g && currentOmen(g).id === "fair") ? 0.8 : 1.0;
  const baseStones = Math.max(0, Math.round(num(rec && rec.stones, 0) * fairDisc));
  const missingItems = [];
  let matBuyCost = 0;
  const inv = (g && g.inventory) || {};
  Object.entries((rec && rec.inputs) || {}).forEach(([k, req]) => {
    const reqAmt = Math.max(0, Math.floor(num(req, 0)));
    const haveAmt = Math.max(0, Math.floor(num(inv[k], 0)));
    const lack = Math.max(0, reqAmt - haveAmt);
    if (lack > 0) {
      const spec = ITEMS[k];
      const unitPrice = Math.round(num(spec && spec.buy, 20) * fairDisc);
      const subCost = lack * unitPrice;
      matBuyCost += subCost;
      missingItems.push({
        id: k,
        name: (spec && spec.name) || k,
        req: reqAmt,
        have: haveAmt,
        lack,
        unitPrice,
        subCost
      });
    }
  });
  return {
    fairDisc,
    baseStones,
    missingItems,
    matBuyCost,
    totalStoneCost: baseStones + matBuyCost,
    hasMissing: missingItems.length > 0 && matBuyCost > 0
  };
}

export function computeBatchRecipeCost(g, rec, qty = 1) {
  const safeQty = Math.max(1, Math.min(5, Math.floor(num(qty, 1))));
  const fairDisc = (g && currentOmen(g).id === "fair") ? 0.8 : 1.0;
  const baseStonesEach = Math.max(0, Math.round(num(rec && rec.stones, 0) * fairDisc));
  const baseStones = baseStonesEach * safeQty;
  const inv = (g && g.inventory) || {};
  const missingItems = [];
  const consumedMats = [];
  let matBuyCost = 0;
  Object.entries((rec && rec.inputs) || {}).forEach(([k, req]) => {
    const reqEach = Math.max(0, Math.floor(num(req, 0)));
    const reqTotal = reqEach * safeQty;
    const haveAmt = Math.max(0, Math.floor(num(inv[k], 0)));
    const useAmt = Math.min(haveAmt, reqTotal);
    const lack = Math.max(0, reqTotal - haveAmt);
    const spec = ITEMS[k];
    consumedMats.push({ id: k, name: (spec && spec.name) || k, req: reqTotal, have: haveAmt, use: useAmt, lack });
    if (lack > 0) {
      const unitPrice = Math.round(num(spec && spec.buy, 20) * fairDisc);
      const subCost = lack * unitPrice;
      matBuyCost += subCost;
      missingItems.push({
        id: k,
        name: (spec && spec.name) || k,
        req: reqTotal,
        have: haveAmt,
        lack,
        unitPrice,
        subCost
      });
    }
  });
  const perCraft = (g && (hasLaw(g, "nine_pill") || currentOmen(g).id === "alchemy_star")) ? 2 : 1;
  const bonusHealing = (g && getSanctumLevel(g, "cauldron") >= 4) ? safeQty : 0;
  const totalMonths = Math.max(1, Math.floor(num(rec && rec.months, 3))) * safeQty;
  return {
    qty: safeQty,
    fairDisc,
    baseStones,
    matBuyCost,
    totalStoneCost: baseStones + matBuyCost,
    totalMonths,
    perCraft,
    totalOutput: perCraft * safeQty,
    bonusHealing,
    consumedMats,
    missingItems,
    hasMissing: missingItems.length > 0 && matBuyCost > 0
  };
}

export function computeBatchEnhancePreview(g, slot, steps, env = null) {
  const eq = g && g.equippedGear ? g.equippedGear[slot] : null;
  if (!g || !eq) return { valid: false, slot, steps: 0, maxSteps: 0, totalCost: 0, canAfford: false, before: null, after: null, dAtk: 0, dHp: 0, dDr: 0 };
  const eqLvl = Math.max(0, Math.floor(num(eq.lvl, 0)));
  const maxSteps = Math.max(0, 10 - eqLvl);
  if (typeof steps !== "number" || !Number.isFinite(steps) || !Number.isInteger(steps) || steps < 1 || steps > 5) {
    return { valid: false, slot, steps: 0, maxSteps, totalCost: 0, canAfford: false, before: null, after: null, dAtk: 0, dHp: 0, dDr: 0 };
  }
  const safeSteps = maxSteps > 0 ? Math.min(maxSteps, steps) : 0;
  let totalCost = 0;
  for (let i = 0; i < safeSteps; i++) {
    totalCost += getGearEnhanceCost(g, Object.assign({}, eq, { lvl: eqLvl + i }));
  }
  const before = getCombatStats(g, env);
  const simGame = Object.assign({}, g, {
    equippedGear: Object.assign({}, g.equippedGear, {
      [slot]: Object.assign({}, eq, { lvl: eqLvl + safeSteps })
    })
  });
  const after = getCombatStats(simGame, env);
  const dAtk = Math.round(after.atk - before.atk);
  const dHp = Math.round(after.maxHp - before.maxHp);
  const dDr = Math.round(after.dmgReduce - before.dmgReduce);
  const atkPct = before.atk > 0 ? Math.round((dAtk / before.atk) * 1000) / 10 : 0;
  return {
    valid: safeSteps > 0,
    slot,
    name: eq.name,
    fromLvl: eqLvl,
    toLvl: eqLvl + safeSteps,
    steps: safeSteps,
    maxSteps,
    totalCost,
    canAfford: safeSteps > 0 && num(g.stones, 0) >= totalCost,
    before,
    after,
    dAtk,
    dHp,
    dDr,
    atkPct
  };
}

export function getLifespanInfo(g) {
  if (!g) {
    const defaultRatio = 216 / 744;
    return {
      curMonths: 216, maxMonths: 744, remainMonths: 528, curYears: 18, maxYears: 62, remainYears: 44,
      rawRatio: defaultRatio,
      ratio: Number(defaultRatio.toFixed(3)),
      status: "normal", xpEfficiencyMult: 1.0, penaltyPct: 0, isExhausted: false, medPenaltyMult: 1.0
    };
  }
  const r = REALMS[g.realm] || REALMS.mortal;
  const curMonths = Math.max(12, Math.round((g.startAgeMonths || 216) + (g.elapsedMonths || 0)));
  const maxMonths = Math.max(240, (r.lifespanMonths || 744) + (g.perk === "immortal_echo" ? 480 : 0) + (g.lifespanBonusMonths || 0));
  const remainMonths = Math.max(0, maxMonths - curMonths);
  const curYears = Math.floor(curMonths / 12);
  const maxYears = Math.floor(maxMonths / 12);
  const remainYears = Math.max(0, maxYears - curYears);
  const ratio = g.realm === "ascended" ? 0.05 : curMonths / Math.max(1, maxMonths);
  let status = "normal";
  let xpEfficiencyMult = 1.0;
  let penaltyPct = 0;
  let isExhausted = false;
  if (g.realm !== "ascended" && ratio >= 1.0) {
    status = "exhausted";
    xpEfficiencyMult = 0.25;
    penaltyPct = 75;
    isExhausted = true;
  } else if (ratio >= 0.95) {
    status = "critical";
    xpEfficiencyMult = 0.50;
    penaltyPct = 50;
  } else if (ratio >= 0.90) {
    status = "critical";
    xpEfficiencyMult = 0.75;
    penaltyPct = 25;
  } else if (ratio >= 0.75) {
    status = "warning";
    xpEfficiencyMult = 1.0;
    penaltyPct = 0;
  }
  return {
    curMonths, maxMonths, remainMonths, curYears, maxYears, remainYears,
    rawRatio: ratio,
    ratio: Number(ratio.toFixed(3)),
    status,
    xpEfficiencyMult,
    penaltyPct,
    isExhausted,
    medPenaltyMult: xpEfficiencyMult
  };
}

export function previewLifespanImpact(g, deltaMonths = 0, env = null) {
  const reqDelta = Math.max(0, Math.round(num(deltaMonths, 0)));
  const before = getLifespanInfo(g);
  const isAscended = Boolean(g && g.realm === "ascended");
  const isSandbox = (env && "sandboxMode" in env)
    ? Boolean(env.sandboxMode)
    : (typeof sandboxMode !== "undefined" && sandboxMode);
  const isPractice = (env && typeof env.isPracticeModeActive === "function")
    ? Boolean(env.isPracticeModeActive())
    : (typeof isPracticeModeActive === "function" && isPracticeModeActive());
  const sandboxExempt = Boolean(isSandbox || isPractice || isAscended);
  const effectiveDelta = sandboxExempt ? 0 : reqDelta;
  const virtualGame = g && typeof g === "object"
    ? Object.assign({}, g, { elapsedMonths: Math.max(0, Math.floor(num(g.elapsedMonths, 0))) + effectiveDelta })
    : { realm: "mortal", startAgeMonths: 216, elapsedMonths: effectiveDelta };
  const after = getLifespanInfo(virtualGame);
  const beforeRatio = typeof before.rawRatio === "number" ? before.rawRatio : before.ratio;
  const afterRatio = typeof after.rawRatio === "number" ? after.rawRatio : after.ratio;
  const crossedThresholds = [];
  if (!sandboxExempt && effectiveDelta > 0) {
    LIFESPAN_THRESHOLDS.forEach(t => {
      if (beforeRatio < t && afterRatio >= t) crossedThresholds.push(Math.round(t * 100));
    });
  }
  const willExhaust = Boolean(!before.isExhausted && after.isExhausted);
  let warningText = "";
  if (sandboxExempt) {
    warningText = isAscended ? "飞升真仙不受寿元所限" : "沙盒/练习模式免耗寿元";
  } else if (willExhaust || crossedThresholds.includes(100)) {
    warningText = "⚠ 将触及 100% 大限（修炼效率降至 25%，绝不删档）";
  } else if (crossedThresholds.includes(95)) {
    warningText = "⚠ 将跨过 95% 寿元危线（修炼效率降至 50%）";
  } else if (crossedThresholds.includes(90)) {
    warningText = "⚠ 将跨过 90% 大限预警（修炼效率降至 75%）";
  } else if (crossedThresholds.includes(75)) {
    warningText = "提示：将跨过 75% 寿元提醒线（建议预备延寿青莲丹或破境）";
  }
  const summaryText = sandboxExempt
    ? `⏳ 预计耗时 ${reqDelta} 月（${warningText}）`
    : `⏳ 耗寿 ${effectiveDelta} 月（${before.curYears}→${after.curYears}/${after.maxYears} 载 · ${Math.round(before.ratio * 100)}%→${Math.round(after.ratio * 100)}%）`;
  return {
    deltaMonths: reqDelta,
    effectiveDelta,
    sandboxExempt,
    before,
    after,
    crossedThresholds,
    crossesAny: crossedThresholds.length > 0,
    willExhaust,
    summaryText,
    warningText
  };
}
