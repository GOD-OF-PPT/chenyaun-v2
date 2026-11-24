import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  REPO_ROOT,
  RUNTIME_MODULE_ORDER,
  assemblePlayableHtml,
  parseWebpHeader,
  transformEsmForIife
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

function collectFilesRecursive(dirPath) {
  const out = [];
  for (const dirent of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const abs = path.join(dirPath, dirent.name);
    if (dirent.isDirectory()) {
      out.push(...collectFilesRecursive(abs));
    } else if (dirent.isFile()) {
      out.push(abs);
    }
  }
  return out;
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

test("RUNTIME_MODULE_ORDER lists all 16 ordered runtime modules and src/runtime/main.js is a thin loop shell", () => {
  assert.equal(RUNTIME_MODULE_ORDER.length, 16);
  assert.equal(RUNTIME_MODULE_ORDER[RUNTIME_MODULE_ORDER.length - 1], "src/runtime/main.js");
  for (const relPath of RUNTIME_MODULE_ORDER) {
    const abs = path.join(REPO_ROOT, relPath);
    assert.ok(fs.existsSync(abs), `Missing runtime module: ${relPath}`);
    const txt = fs.readFileSync(abs, "utf8");
    assert.ok(txt.length > 0, `Empty runtime module: ${relPath}`);
    assert.ok(!txt.includes("\r"), `CR character forbidden in ${relPath}`);
  }
  const mainLines = fs.readFileSync(path.join(REPO_ROOT, "src/runtime/main.js"), "utf8").split("\n").length;
  assert.ok(mainLines < 60, `Expected thin src/runtime/main.js shell (< 60 lines), got ${mainLines} lines`);
});

test("deterministic build matches committed web/public/playable-v2.html byte-for-byte with single bare <script> and zero CDN", () => {
  const run1 = assemblePlayableHtml();
  const run2 = assemblePlayableHtml();
  assert.equal(run1.sha256, run2.sha256, "Two consecutive builds must be byte-identical");
  assert.equal(Buffer.compare(run1.buf, run2.buf), 0);
  assert.equal(run1.runtimeModuleCount, RUNTIME_MODULE_ORDER.length);

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

test("pure ESM rule modules match live assembled playable-v2.html engine inside VM sandbox (parity & unified debug facade)", () => {
  const { sandbox, debug } = loadPlayableEngine(20261124);
  const dbg = sandbox.__CHENYUAN_DEBUG__;
  assert.equal(dbg, debug);
  assert.ok(dbg && dbg.version === "d06-unified-1");
  assert.equal(dbg.namespaces, undefined, "namespaces must be removed in d06-unified-1");
  assert.equal(dbg.getNamespace, undefined, "getNamespace must be removed in d06-unified-1");

  // All 8 legacy versioned globals must be strictly undefined
  for (const ver of ["V18", "V19", "V20", "V21", "V22", "V23", "V24", "V25"]) {
    const key = `__CHENYUAN_${ver}__`;
    assert.equal(sandbox[key], undefined, `Legacy global window.${key} must be deleted`);
  }

  // Exact 370 unified top-level keys (7 facade/group keys + 363 unique subsystem bindings)
  assert.equal(Object.keys(dbg).length, 370, `Expected 370 top-level keys on __CHENYUAN_DEBUG__, got ${Object.keys(dbg).length}`);
  for (const key of ["version", "getState", "rules", "q6", "persistence", "art", "telemetry", "startColossalTitanRaid", "executeSixAspectAwakeningSkill", "triggerImpactFrame", "getStyleRankSpec", "encodeWorkshopSeed", "toggleLocalCoop2P", "triggerSanqingTriClones", "importFullCloudSaveCode"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(dbg, key), `Missing expected top-level key: ${key}`);
  }

  const plain = (v) => JSON.parse(JSON.stringify(v));

  // Unified non-mutating getState() check
  const state = dbg.getState();
  assert.ok(state && state.game && state.arena);
  for (const reqField of ["game", "arena", "pity", "drawerOpen", "realmSpec", "persistence", "a11ySettings", "photoMode", "soundPan", "soundSurf", "artCount", "activeHero", "curioPoolCount", "sixAspect", "codexSelectedId", "codexDemoAnimT", "workshopState", "audioStems", "celestialPhase", "coop2P", "primordialCrafts", "craftMinigame", "highlightCount", "sanqing", "echoQueueLen", "shanhe", "warship", "customSeq", "expeditions"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(state, reqField), `Unified getState() missing field: ${reqField}`);
  }

  // Rule parity: compare direct Node ESM outputs vs VM runtime outputs on the live game state
  const g = state.game;
  const esmLedger = computeCombatStatLedger(g, { arena: state.arena });
  const vmLedger = debug.computeCombatStatLedger(g);
  assert.deepEqual(plain(esmLedger.totals), plain(vmLedger.totals));

  const esmStats = getCombatStats(g, { arena: state.arena });
  const vmStats = dbg.rules.getCombatStats(g);
  assert.deepEqual(plain(esmStats), plain(vmStats));

  const sampleGear = { slot: "weapon", rarity: 3, lvl: 4, atk: 42, hp: 0, dr: 0, crit: 0.08, spd: 0, bonusSword: 1, affix: "posture_crush" };
  assert.equal(effectiveGearVal(sampleGear, "atk"), dbg.rules.effectiveGearVal(sampleGear, "atk"));
  assert.deepEqual(plain(computeGearAffixBudget(sampleGear)), plain(debug.computeGearAffixBudget(sampleGear)));

  const esmLifespan = previewLifespanImpact(g, 18, { sandboxMode: false });
  const vmLifespan = debug.previewLifespanImpact(g, 18);
  assert.deepEqual(plain(esmLifespan), plain(vmLifespan));

  const esmRecipe = computeRecipeCostBreakdown(g, RECIPES.foundation);
  const vmRecipe = dbg.rules.computeRecipeCostBreakdown(g, RECIPES.foundation);
  assert.deepEqual(plain(esmRecipe), plain(vmRecipe));

  assert.equal(applySingleHitCap(500, 200, 20), dbg.rules.applySingleHitCap(500, 200, 20));

  // Exhaustively invoke every method across __CHENYUAN_DEBUG__.{rules, q6, persistence, art, telemetry}
  assert.ok(dbg.rules.computeCombatStatLedger(g).totals.atk > 0);
  assert.ok(dbg.rules.rollGearItem(1, 1, "weapon", { rng: () => 0.5 }).slot === "weapon");
  assert.ok(dbg.rules.getLifespanInfo(g).maxMonths > 0);
  const dbgLifePrev = dbg.rules.previewLifespanImpact(g, 12);
  assert.ok(dbgLifePrev && dbgLifePrev.after && dbgLifePrev.before && dbgLifePrev.after.curMonths >= dbgLifePrev.before.curMonths);
  const batchCost = dbg.rules.computeBatchRecipeCost(g, RECIPES.healing, 1);
  assert.ok(batchCost && batchCost.qty === 1 && batchCost.totalStoneCost >= 0);
  assert.ok(typeof dbg.rules.computeBatchEnhancePreview(g, "weapon", 1).valid === "boolean");
  const compScore = dbg.rules.computeCompetitionScore(g);
  assert.ok(Number.isFinite(compScore));
  assert.ok(typeof dbg.rules.getScoreGrade(compScore, g).grade === "string");
  assert.ok(dbg.q6 && Array.isArray(dbg.q6.VOLUME_CAMPAIGN_GUIDE) && typeof dbg.q6.buildVol5ResonanceSnapshot === "function");

  assert.equal(typeof dbg.persistence.STORAGE_KEY, "string");
  assert.equal(typeof dbg.persistence.META_KEY, "string");
  assert.match(dbg.persistence.computeSaveChecksum("probe"), /^[0-9A-F]{8}$/);
  const bundle = { game: g, stageIdx: 0, stanceIdx: 0, towerMode: false, sanctumMode: false };
  const canonical = dbg.persistence.buildCanonicalSavePayload(bundle);
  assert.ok(canonical && canonical.length > 10);
  const parsed = dbg.persistence.parseAndValidateSaveRaw(JSON.stringify({
    ...bundle,
    envelopeVersion: 2,
    checksum: dbg.persistence.computeSaveChecksum(canonical),
    saveRev: 1,
    updatedAt: 1
  }), dbg.persistence.STORAGE_KEY);
  assert.equal(parsed.ok, true);
  assert.ok(dbg.persistence.mergeMetaStates({}, { bestScore: 100 }).bestScore === 100);
  assert.equal(dbg.persistence.normalizeGearItem(sampleGear).slot, "weapon");
  assert.ok(dbg.persistence.normalizeLoadedGame(JSON.parse(JSON.stringify(g))).realm === g.realm);
  if (!sandbox.TextEncoder) sandbox.TextEncoder = TextEncoder;
  if (!sandbox.TextDecoder) sandbox.TextDecoder = TextDecoder;
  if (!sandbox.btoa) sandbox.btoa = btoa;
  if (!sandbox.atob) sandbox.atob = atob;
  const cloudCode = dbg.persistence.exportFullCloudSaveCode();
  assert.equal(typeof cloudCode, "string");
  assert.ok(cloudCode.startsWith("CY24SAVE-"), `Expected CY24SAVE- prefix, got ${cloudCode.slice(0, 20)}`);
  assert.equal(dbg.persistence.importFullCloudSaveCode("INVALID-CLOUD-CODE"), false);

  assert.equal(dbg.art.getCount(), 115);
  assert.equal(dbg.art.getKeys().length, 115);
  const decodeSummary = dbg.art.getDecodeSummary();
  assert.equal(decodeSummary.total, 115);

  const noticeState = dbg.telemetry.getNoticeState();
  assert.ok(noticeState && noticeState.inbox && Array.isArray(noticeState.inbox.items));
  assert.ok(Array.isArray(noticeState.pendingUnlockCards));
  assert.ok(Array.isArray(dbg.telemetry.getPendingRewards()));
  assert.ok(Array.isArray(dbg.telemetry.getPauseTokens()));
  const encTel = dbg.telemetry.getEncounterTelemetry();
  assert.ok(encTel === null || typeof encTel === "object");
  const perfSnap = dbg.telemetry.getFramePerfSnapshot();
  const perfStats = dbg.telemetry.getPerfStats();
  assert.ok(perfSnap && typeof perfSnap === "object" && Number.isFinite(perfSnap.p50Ms) && Number.isFinite(perfSnap.maxFrameMs) && Number.isFinite(perfSnap.totalFrames));
  assert.deepEqual(plain(perfSnap), plain(perfStats));
});

test("static repo guard asserts zero legacy versioned debug hook references in src/, scripts/, tests/e2e/, and built playable-v2.html", () => {
  const legacyHookRe = new RegExp("__CHENYUAN_" + "V(?:1[89]|2[0-5])__", "g");
  const targets = [
    ...collectFilesRecursive(path.join(REPO_ROOT, "src")),
    ...collectFilesRecursive(path.join(REPO_ROOT, "scripts")),
    ...collectFilesRecursive(path.join(REPO_ROOT, "tests/e2e")),
    PLAYABLE_PATH
  ];
  const violations = [];
  for (const abs of targets) {
    if (abs.endsWith(".webp") || abs.endsWith(".png") || abs.endsWith(".jpg")) continue;
    const text = fs.readFileSync(abs, "utf8");
    const matches = text.match(legacyHookRe);
    if (matches && matches.length > 0) {
      violations.push(`${path.relative(REPO_ROOT, abs)} (${matches.length} matches)`);
    }
  }
  assert.deepEqual(violations, [], `Found forbidden legacy debug hook references: ${violations.join(", ")}`);
});

test("build-playable negative guards reject orphan runtime assets, unquoted external HTML URLs, JS external URLs, and aliased ESM imports", () => {
  // Unit-level ESM stripper guards
  assert.throws(
    () => transformEsmForIife('import { num as n } from "./utils.mjs";\nexport const x = 1;\n', "probe.mjs"),
    /Unsupported aliased import/
  );
  assert.throws(
    () => transformEsmForIife('import * as u from "./utils.mjs";\nexport const x = 1;\n', "probe.mjs"),
    /Unsupported aliased import/
  );
  // Column-0 identifier starting with "import" must not be corrupted
  const kept = transformEsmForIife('importFoo();\nexport const ok = 1;\n', "probe.mjs");
  assert.ok(kept.includes("importFoo();"));

  // Isolated temp copy of src/ for end-to-end negative validation (cleaned up in finally)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "chenyuan-build-neg-"));
  try {
    fs.cpSync(path.join(REPO_ROOT, "src"), path.join(tmpDir, "src"), { recursive: true });

    // (a) Orphan .webp in src/assets/runtime/ must be rejected
    const orphanPath = path.join(tmpDir, "src/assets/runtime/zz_orphan_probe.webp");
    fs.copyFileSync(path.join(tmpDir, "src/assets/runtime/icon_blade.webp"), orphanPath);
    assert.throws(
      () => assemblePlayableHtml({ repoRoot: tmpDir }),
      /Unindexed\/orphan file\(s\) in src\/assets\/runtime\//
    );
    fs.rmSync(orphanPath);

    // Unexpected subdirectory in src/assets/runtime/ must also be rejected
    const rogueDir = path.join(tmpDir, "src/assets/runtime/nested_dir");
    fs.mkdirSync(rogueDir);
    assert.throws(
      () => assemblePlayableHtml({ repoRoot: tmpDir }),
      /Unexpected subdirectory in src\/assets\/runtime\//
    );
    fs.rmSync(rogueDir, { recursive: true, force: true });

    // (b) Unquoted external <img src=https://...> and <link href=https://...> must be rejected
    const bodyPath = path.join(tmpDir, "src/markup/body.html");
    const origBody = fs.readFileSync(bodyPath, "utf8");
    fs.writeFileSync(bodyPath, `${origBody}\n<img src=https://cdn.example.com/pixel.png>\n`, "utf8");
    assert.throws(
      () => assemblePlayableHtml({ repoRoot: tmpDir }),
      /Forbidden external media\/script src\/data URL/
    );
    fs.writeFileSync(bodyPath, `${origBody}\n<link rel=stylesheet href=https://cdn.example.com/x.css>\n`, "utf8");
    assert.throws(
      () => assemblePlayableHtml({ repoRoot: tmpDir }),
      /Forbidden external <link href>/
    );
    fs.writeFileSync(bodyPath, origBody, "utf8");

    // (c) External https:// URL inside JS runtime code must be rejected (both thin main.js and extracted subsystem module)
    for (const relTarget of ["src/runtime/main.js", "src/runtime/combat-step.js"]) {
      const targetPath = path.join(tmpDir, relTarget);
      const origContent = fs.readFileSync(targetPath, "utf8");
      fs.writeFileSync(targetPath, `${origContent}\n  const __extProbe = "https://cdn.example.com/x.js";\n`, "utf8");
      assert.throws(
        () => assemblePlayableHtml({ repoRoot: tmpDir }),
        /Forbidden external URL\(s\) in <script>/
      );
      fs.writeFileSync(targetPath, origContent, "utf8");
    }

    // (d) Bare side-effect ESM import must be rejected
    assert.throws(
      () => transformEsmForIife('import "./side-effect.mjs";\nexport const X = 1;\n', "test.mjs"),
      /Unsupported bare side-effect import/
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
