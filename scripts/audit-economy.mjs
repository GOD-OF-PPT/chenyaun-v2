#!/usr/bin/env node
/**
 * F23: Economy & Lifespan Closed-Loop Audit
 *
 * Loads the actual game rules/tables from web/public/playable-v2.html via the
 * deterministic Node VM loader in eval-combat-matrix.mjs (zero open timers) and
 * audits:
 *   1. Per-volume income vs mandatory/recommended/optional stone costs
 *   2. Buy / Sell / Smelt arbitrage invariants (sell < buy everywhere, including
 *      km_demon_core under demonic karma + 0.8x fair omen discount)
 *   3. Material reachability across all 7 materials & all alchemy recipes
 *   4. Lifespan budget, threshold ladder (75%/90%/95%/100%), and 7-path preview
 *   5. D05 currency streamlining audit (reincarnationPoints/sectMerits removed, legacyStones <= 240 cap)
 *
 * Usage:
 *   node scripts/audit-economy.mjs [--seed 20261124] [--out path.json]
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadPlayableEngine } from "./eval-combat-matrix.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const out = { seed: 20261124, outFile: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--seed" && argv[i + 1]) out.seed = Number(argv[++i]) || 20261124;
    else if (a === "--out" && argv[i + 1]) out.outFile = argv[++i];
  }
  return out;
}

function getCommitHash() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

function runAudit(opts) {
  const { debug, rng } = loadPlayableEngine(opts.seed);
  const violations = [];
  const warnings = [];

  // 1. Per-volume income & cost ledger
  const volumes = debug.CHAPTERS.map((ch, idx) => {
    const act = debug.CAMPAIGN_ACTS[Math.min(idx, debug.CAMPAIGN_ACTS.length - 1)];
    const questStoneRewards = (ch.steps || []).reduce((s, st) => s + ((st.reward && st.reward.stones) || 0), 0);
    const requiredSteps = (ch.steps || []).filter(st => st.priority === "required").length;
    const optionalSteps = (ch.steps || []).length - requiredSteps;
    const realmSpec = debug.REALMS[ch.realm] || debug.REALMS.mortal;
    return {
      volume: ch.index,
      realm: ch.realm,
      realmName: realmSpec.name,
      lifespanYears: Math.floor((realmSpec.lifespanMonths || 744) / 12),
      requiredSteps,
      optionalSteps,
      firstClearQuestStones: questStoneRewards,
      stageDropMaterials: act ? act.matDrops.slice() : [],
      bossDropMaterials: act ? act.bossMats.slice() : []
    };
  });

  // 2. Buy / Sell / Smelt Arbitrage Checks
  // 2a. ITEMS direct price check (no sellable item sells for >= buy or worst-case discounted buy)
  const itemPriceChecks = [];
  let itemsWithBuy = 0;
  const totalItemsCount = Object.keys(debug.ITEMS).length;
  Object.values(debug.ITEMS).forEach(it => {
    const hasBuy = typeof it.buy === "number" && Number.isFinite(it.buy) && it.buy > 0;
    if (hasBuy) itemsWithBuy += 1;
    const buy = hasBuy ? Number(it.buy) : 0;
    const discountedBuy = Math.round(buy * 0.8 * 0.9); // worst-case fair omen (0.8) + righteous (0.9)
    const hasSell = it.sell != null && Number.isFinite(Number(it.sell));
    const sell = hasSell ? Number(it.sell) : null;
    const ok = hasBuy && (!hasSell || (sell < buy && sell < discountedBuy));
    itemPriceChecks.push({ id: it.id, name: it.name, buy, discountedBuy, sell, ok });
    if (!hasBuy) violations.push(`ITEM_BUY_SCHEMA_MISSING:${it.id}`);
    else if (hasSell && !(sell < buy && sell < discountedBuy)) {
      violations.push(`ITEM_ARBITRAGE:${it.id}:sell(${sell})>=discountedBuy(${discountedBuy})/buy(${buy})`);
    }
  });
  if (itemsWithBuy !== totalItemsCount) {
    violations.push(`ITEMS_BUY_SCHEMA_DRIFT:${itemsWithBuy}/${totalItemsCount}`);
  }

  // 2b. Generated gear market price vs smelt/sell across 300 seeded rolls (rarities 0..4, stages 0..4)
  let gearRollsChecked = 0;
  let maxGearSellToPriceRatio = 0;
  let gearBudgetFailures = 0;
  for (let stage = 0; stage <= 4; stage += 1) {
    for (let minR = 0; minR <= 4; minR += 1) {
      for (const slot of ["weapon", "armor", "ring"]) {
        for (let k = 0; k < 4; k += 1) {
          const it = debug.rollGearItem(stage, minR, slot, { usePity: false, rng });
          gearRollsChecked += 1;
          const b = debug.computeGearAffixBudget(it);
          if (!b.withinBudget) gearBudgetFailures += 1;
          const fairBuyPrice = Math.round(it.price * 0.8 * 0.9); // worst-case fair omen (0.8) + righteous (0.9)
          const ratio = it.sell / Math.max(1, fairBuyPrice);
          if (ratio > maxGearSellToPriceRatio) maxGearSellToPriceRatio = ratio;
          if (it.sell >= fairBuyPrice) {
            violations.push(`GEAR_ARBITRAGE:r${it.rarity}_${slot}:sell(${it.sell})>=fairBuy(${fairBuyPrice})`);
          }
        }
      }
    }
  }
  if (gearBudgetFailures > 0) {
    violations.push(`GEAR_BUDGET_FAILURES:${gearBudgetFailures}/${gearRollsChecked}`);
  }

  // 2c. Karma market specials arbitrage audit (specifically km_demon_core under demonic + fair omen 0.8x)
  const fairIdx = debug.CELESTIAL_OMENS.findIndex(o => o.id === "fair");
  const { game } = debug.getState();
  const karmaAudit = [];
  for (const [modeLabel, score] of [["neutral", 0], ["righteous", 40], ["demonic", -40]]) {
    game.karmaScore = score;
    game.omenIndex = fairIdx >= 0 ? fairIdx : 0;
    game.karmaMarketBought = {};
    const specials = debug.getKarmaMarketSpecials(game);
    for (const sp of specials) {
      const entry = { karmaMode: modeLabel, id: sp.id, costUnderFair: sp.cost, kind: sp.kind };
      if (sp.id === "km_demon_core") {
        // Check worst-case buy -> smelt weapon + nominal 3x core bundle resale under fair omen
        game.stones = 1000;
        game.realm = "spirit";
        game.equippedGear = { weapon: null, armor: null, ring: null };
        game.gearBag = [];
        const beforeStones = game.stones;
        const okBuy = debug.buyKarmaSpecialItem("km_demon_core");
        const paid = beforeStones - game.stones;
        const pendingWpn = debug.getPendingCompareGear() || game.equippedGear.weapon || game.gearBag[game.gearBag.length - 1];
        const wpnSell = pendingWpn ? Number(pendingWpn.sell || 0) : 0;
        const bundledCoresSell = 3 * Number((debug.ITEMS.core && debug.ITEMS.core.sell) || 0);
        const totalBundleResale = wpnSell + bundledCoresSell;
        const sellCap = Math.floor(sp.cost * 0.45);
        entry.paid = paid;
        entry.bundledWeaponSell = wpnSell;
        entry.bundledCoresSell = bundledCoresSell;
        entry.totalBundleResale = totalBundleResale;
        entry.sellCap = sellCap;
        entry.preservesVampBlade = Boolean(pendingWpn && pendingWpn.affix === "vamp_blade");
        entry.preservesAtk = Boolean(pendingWpn && pendingWpn.atk > 0);
        entry.noArbitrage = Boolean(okBuy && wpnSell <= sellCap && wpnSell < sp.cost && totalBundleResale < sp.cost && sp.cost >= Math.round(220 * 0.8));
        if (!entry.noArbitrage) {
          violations.push(`KM_DEMON_CORE_ARBITRAGE:cost=${sp.cost},wpnSell=${wpnSell},bundleResale=${totalBundleResale},cap=${sellCap}`);
        }
        if (!entry.preservesVampBlade || !entry.preservesAtk) {
          violations.push(`KM_DEMON_CORE_COMBAT_IDENTITY_BROKEN`);
        }
      }
      karmaAudit.push(entry);
    }
  }

  // 3. Material Reachability & Recipe Audit
  const materialSources = {};
  ["herb", "dew", "core", "jade", "lotus", "soul", "dao"].forEach(m => {
    materialSources[m] = { stageDrops: [], bossDrops: [], buyPrice: debug.ITEMS[m] ? Number(debug.ITEMS[m].buy || 0) : 0 };
  });
  debug.CAMPAIGN_ACTS.forEach(act => {
    (act.matDrops || []).forEach(m => { if (materialSources[m]) materialSources[m].stageDrops.push(act.actLabel); });
    (act.bossMats || []).forEach(m => { if (materialSources[m]) materialSources[m].bossDrops.push(`${act.actLabel}Boss(${act.bossName})`); });
  });

  const recipeAudit = Object.values(debug.RECIPES).map(rec => {
    const outItem = debug.ITEMS[rec.output];
    const inputs = Object.entries(rec.inputs || {}).map(([matId, qty]) => {
      const src = materialSources[matId];
      const reachable = Boolean(src && (src.stageDrops.length > 0 || src.bossDrops.length > 0 || src.buyPrice > 0));
      if (!reachable) violations.push(`UNREACHABLE_MATERIAL:${rec.id}:${matId}`);
      return { matId, qty, reachable, sources: src };
    });
    if (rec.id === "golden") {
      warnings.push("NOTE: golden pill (结金丹) requires lotus×1, reachable from Vol 3 Boss (寒潭玄蛇), Vol 4 mobs, or explicit buy-missing stones; optional per D01 (defiant tribulation preserved).");
    }
    return {
      id: rec.id,
      name: rec.name,
      output: rec.output,
      outputPrice: outItem ? Number(outItem.buy || 0) : 0,
      baseStones: rec.stones,
      months: rec.months,
      reqCauldronLv: rec.reqCauldronLv || 1,
      inputs
    };
  });

  // 4. Lifespan Closed-Loop & Threshold Verification
  const fresh = debug.createFreshGame("寿元审计", "sword_bone", 0);
  const lfBase = debug.getLifespanInfo(fresh);
  const cross75Months = Math.max(1, Math.ceil(lfBase.maxMonths * 0.75) - lfBase.curMonths);
  const prev75 = debug.previewLifespanImpact(fresh, cross75Months);
  const cross100Months = Math.max(1, lfBase.maxMonths - lfBase.curMonths);
  const prev100 = debug.previewLifespanImpact(fresh, cross100Months);
  if (!prev75.crossedThresholds.includes(75)) {
    violations.push("LIFESPAN_PREVIEW_75_MISSING");
  }
  if (!prev100.willExhaust || prev100.after.xpEfficiencyMult !== 0.25) {
    violations.push("LIFESPAN_PREVIEW_100_MISMATCH");
  }

  // 5. D05 Currency Streamlining & Legacy Carryover Cap Audit
  const meta = debug.getMetaState();
  const hasReincarnationPoints = Object.prototype.hasOwnProperty.call(meta, "reincarnationPoints");
  const hasSectMerits = Object.prototype.hasOwnProperty.call(fresh, "sectMerits");
  const prevAsc = meta.ascensions;
  const prevBingjie = meta.bingjieCount;
  meta.ascensions = 5;
  meta.bingjieCount = 10;
  const cappedFresh = debug.createFreshGame("传承上限审计", "sword_bone", 0);
  const cappedLegacyStones = cappedFresh.stones - 65; // sword_bone base starting stones = 65
  meta.ascensions = prevAsc;
  meta.bingjieCount = prevBingjie;
  if (hasReincarnationPoints) violations.push("D05_REMOVED_CURRENCY_PRESENT:metaState.reincarnationPoints");
  if (hasSectMerits) violations.push("D05_REMOVED_CURRENCY_PRESENT:game.sectMerits");
  if (cappedLegacyStones > 240) violations.push(`D05_LEGACY_STONES_CAP_BREACHED:${cappedLegacyStones}>240`);
  const d05CurrencyAudit = {
    reincarnationPointsAbsent: !hasReincarnationPoints,
    sectMeritsAbsent: !hasSectMerits,
    bingjieCountPresent: typeof meta.bingjieCount === "number",
    sectDefenseClearedPresent: typeof fresh.sectDefenseCleared === "boolean",
    legacyStonesCapTested: cappedLegacyStones,
    legacyStonesCapMax: 240,
    d05Compliant: !hasReincarnationPoints && !hasSectMerits && cappedLegacyStones <= 240
  };

  // 6. Sanctum & Relic Cost Ladder Summary
  const sanctumCosts = debug.SANCTUM_BUILDINGS.map(b => ({
    id: b.id,
    name: b.name,
    costs: b.costs || [],
    totalToMax: (b.costs || []).reduce((s, c) => s + Number(c || 0), 0)
  }));

  const report = {
    meta: {
      tool: "scripts/audit-economy.mjs",
      commit: getCommitHash(),
      seed: opts.seed,
      generatedAt: new Date().toISOString()
    },
    passed: violations.length === 0,
    violations,
    warnings,
    volumes,
    arbitrage: {
      itemsChecked: itemPriceChecks.length,
      itemsWithBuy,
      gearRollsChecked,
      gearBudgetFailures,
      maxGearSellToFairPriceRatio: Number(maxGearSellToPriceRatio.toFixed(3)),
      karmaSpecials: karmaAudit
    },
    materialSources,
    recipes: recipeAudit,
    sanctumCosts,
    lifespan: {
      thresholdsPct: debug.LIFESPAN_THRESHOLDS.map(t => Math.round(t * 100)),
      meditationMonthsPer3Sec: 1,
      mortalMaxYears: lfBase.maxYears,
      preview75Ok: prev75.crossedThresholds.includes(75),
      preview100NonLethalEfficiency: prev100.after.xpEfficiencyMult
    },
    d05CurrencyAudit
  };
  return report;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const opts = parseArgs(process.argv.slice(2));
  const report = runAudit(opts);
  if (opts.outFile) {
    fs.mkdirSync(path.dirname(path.resolve(opts.outFile)), { recursive: true });
    fs.writeFileSync(opts.outFile, JSON.stringify(report, null, 2) + "\n", "utf8");
    console.log(`Wrote economy audit report to ${opts.outFile}`);
  } else {
    console.log(JSON.stringify({
      meta: report.meta,
      passed: report.passed,
      violations: report.violations,
      warnings: report.warnings,
      arbitrage: report.arbitrage,
      lifespan: report.lifespan,
      d05CurrencyAudit: report.d05CurrencyAudit
    }, null, 2));
  }
  if (!report.passed) {
    console.error("ECONOMY AUDIT FAILED:", report.violations);
    process.exit(1);
  }
}
