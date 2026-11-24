import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  REPO_ROOT,
  assemblePlayableHtml,
  parseWebpHeader
} from "../../scripts/build-playable.mjs";
import { loadPlayableEngine } from "../../scripts/eval-combat-matrix.mjs";
import { computeCombatStatLedger, getCombatStats, applySingleHitCap } from "../../src/rules/combat-stats.mjs";
import { effectiveGearVal, computeGearAffixBudget } from "../../src/rules/gear-rules.mjs";
import { computeRecipeCostBreakdown, previewLifespanImpact } from "../../src/rules/economy-rules.mjs";
import { RECIPES } from "../../src/config/realms-items.mjs";

const PLAYABLE_PATH = path.join(REPO_ROOT, "web/public/playable-v2.html");
const ART_INDEX_PATH = path.join(REPO_ROOT, "src/assets/art-index.json");

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

test("art-index.json validates all 115 extracted runtime WebP binaries and 5 protected VP8X RGBA sprites", () => {
  const index = JSON.parse(fs.readFileSync(ART_INDEX_PATH, "utf8"));
  assert.equal(index.schemaVersion, 1);
  assert.equal(index.assets.length, 115);
  assert.deepEqual(
    index.protectedRgbaKeys.slice().sort(),
    ["item_rough_jade", "pet_fox", "pet_roc", "pet_sword", "pet_turtle"]
  );

  const protectedSet = new Set(index.protectedRgbaKeys);
  for (const entry of index.assets) {
    const abs = path.join(REPO_ROOT, entry.file);
    assert.ok(fs.existsSync(abs), `Missing extracted WebP file: ${entry.file}`);
    const buf = fs.readFileSync(abs);
    assert.equal(buf.length, entry.bytes);
    assert.equal(sha256(buf), entry.sha256);
    const wp = parseWebpHeader(buf, entry.key);
    assert.ok(wp.width >= 16 && wp.height >= 16);
    if (protectedSet.has(entry.key)) {
      assert.equal(wp.format, "VP8X", `${entry.key} must remain VP8X`);
      assert.equal(wp.hasAlpha, true, `${entry.key} must retain alpha channel`);
    }
  }
});

test("deterministic build matches committed web/public/playable-v2.html byte-for-byte with single bare <script> and zero CDN", () => {
  const run1 = assemblePlayableHtml();
  const run2 = assemblePlayableHtml();
  assert.equal(run1.sha256, run2.sha256, "Two consecutive builds must be byte-identical");
  assert.equal(Buffer.compare(run1.buf, run2.buf), 0);

  const diskBuf = fs.readFileSync(PLAYABLE_PATH);
  assert.equal(Buffer.compare(run1.buf, diskBuf), 0, "Committed playable-v2.html drifted from src/");

  const scriptOpens = run1.html.match(/<script\b[^>]*>/gi) || [];
  assert.deepEqual(scriptOpens, ["<script>"]);

  // CLI --check exits 0
  const stdout = execFileSync(process.execPath, [path.join(REPO_ROOT, "scripts/build-playable.mjs"), "--check"], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });
  assert.match(stdout, /build-playable OK \(--check\)/);
});

test("pure ESM rule modules match live assembled playable-v2.html engine inside VM sandbox (parity & debug facade)", () => {
  const { sandbox, v25 } = loadPlayableEngine(20261124);
  const dbg = sandbox.__CHENYUAN_DEBUG__;
  assert.ok(dbg && dbg.version === "q5-compat-1");

  // Exact 382 keys preserved across V18-V25
  const expectedCounts = { V18: 5, V19: 8, V20: 8, V21: 11, V22: 12, V23: 14, V24: 11, V25: 313 };
  let totalKeys = 0;
  for (const [ver, count] of Object.entries(expectedCounts)) {
    const ns = sandbox[`__CHENYUAN_${ver}__`];
    assert.ok(ns && typeof ns === "object", `Missing window.__CHENYUAN_${ver}__`);
    assert.equal(Object.keys(ns).length, count, `Key count drift in __CHENYUAN_${ver}__`);
    assert.equal(dbg.getNamespace(ver.toLowerCase()), ns);
    totalKeys += Object.keys(ns).length;
  }
  assert.equal(totalKeys, 382);

  const plain = (v) => JSON.parse(JSON.stringify(v));

  // Rule parity: compare direct Node ESM outputs vs VM runtime outputs on the live game state
  const state = v25.getState();
  const g = state.game;
  const esmLedger = computeCombatStatLedger(g, { arena: state.arena });
  const vmLedger = v25.computeCombatStatLedger(g);
  assert.deepEqual(plain(esmLedger.totals), plain(vmLedger.totals));

  const esmStats = getCombatStats(g, { arena: state.arena });
  const vmStats = dbg.rules.getCombatStats(g);
  assert.deepEqual(plain(esmStats), plain(vmStats));

  const sampleGear = { slot: "weapon", rarity: 3, lvl: 4, atk: 42, hp: 0, dr: 0, crit: 0.08, spd: 0, bonusSword: 1, affix: "posture_crush" };
  assert.equal(effectiveGearVal(sampleGear, "atk"), dbg.rules.effectiveGearVal(sampleGear, "atk"));
  assert.deepEqual(plain(computeGearAffixBudget(sampleGear)), plain(v25.computeGearAffixBudget(sampleGear)));

  const esmLifespan = previewLifespanImpact(g, 18, { sandboxMode: false });
  const vmLifespan = v25.previewLifespanImpact(g, 18);
  assert.deepEqual(plain(esmLifespan), plain(vmLifespan));

  const esmRecipe = computeRecipeCostBreakdown(g, RECIPES.foundation);
  const vmRecipe = dbg.rules.computeRecipeCostBreakdown(g, RECIPES.foundation);
  assert.deepEqual(plain(esmRecipe), plain(vmRecipe));

  assert.equal(applySingleHitCap(500, 200, 20), dbg.rules.applySingleHitCap(500, 200, 20));
});
