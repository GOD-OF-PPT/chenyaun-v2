import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  META_KEY,
  createDefaultMetaState,
  sanitizeHallEntry,
  canonicalizeStepId,
  computeSaveChecksum,
  buildCanonicalSavePayload,
  parseAndValidateSaveRaw,
  parseAndValidateMetaRaw,
  mergeMetaStates
} from "../../src/state/save-rules.mjs";
import { normalizeGearItem } from "../../src/rules/gear-rules.mjs";
import { safeAssignPlain, num, escapeHtml, safeText, safeDiag } from "../../src/rules/utils.mjs";

test("envelope v2 FNV-1a checksum & parseAndValidateSaveRaw accept valid saves and reject tampered/corrupt/poisoned payloads", () => {
  const bundle = {
    envelopeVersion: 2,
    saveRev: 7,
    tabId: "tab-unit-1",
    updatedAt: 1700000000000,
    stageIdx: 2,
    stanceIdx: 1,
    towerMode: false,
    sanctumMode: true,
    game: { realm: "golden", name: "顾长青", stones: 500 }
  };
  bundle.checksum = computeSaveChecksum(buildCanonicalSavePayload(bundle));
  assert.match(bundle.checksum, /^[0-9A-F]{8}$/);

  const valid = parseAndValidateSaveRaw(JSON.stringify(bundle), STORAGE_KEY);
  assert.equal(valid.ok, true);
  assert.equal(valid.rev, 7);
  assert.equal(valid.legacy, false);

  // Tamper stones without updating checksum -> rejected
  const tampered = Object.assign({}, bundle, { game: Object.assign({}, bundle.game, { stones: 99999 }) });
  const tamperedRes = parseAndValidateSaveRaw(JSON.stringify(tampered), STORAGE_KEY);
  assert.equal(tamperedRes.ok, false);
  assert.match(tamperedRes.reason, /校验和不匹配/);

  // Corrupt JSON -> rejected
  const corruptRes = parseAndValidateSaveRaw("{broken json", STORAGE_KEY);
  assert.equal(corruptRes.ok, false);
  assert.equal(corruptRes.empty, false);

  // Invalid realm -> rejected
  const badRealm = parseAndValidateSaveRaw(JSON.stringify({ game: { realm: "hacker_tier" } }), STORAGE_KEY);
  assert.equal(badRealm.ok, false);

  // Legacy v10 save (no envelopeVersion/checksum) -> accepted and flagged legacy=true
  const legacySave = parseAndValidateSaveRaw(JSON.stringify({ game: { realm: "qi", name: "旧档" }, stageIdx: 1 }), STORAGE_KEY);
  assert.equal(legacySave.ok, true);
  assert.equal(legacySave.legacy, true);

  // Legacy step ID canonicalization
  assert.equal(canonicalizeStepId("s4_npc"), "s4_puppet");
  assert.equal(canonicalizeStepId("s1_xp"), "s1_wolf");
  assert.equal(canonicalizeStepId("s6_ascend"), "s6_ascend");
});

test("mergeMetaStates performs monotonic CRDT merge across local & remote tabs without losing progress or polluting prototypes", () => {
  const defMeta = createDefaultMetaState();
  assert.equal(defMeta.bingjieCount, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(defMeta, "reincarnationPoints"), false);

  const local = {
    metaRev: 2,
    ascensions: 1,
    bestScore: 3500,
    bestTower: 8,
    bestRushGrade: "A",
    bestRushTime: 145,
    bestSpireFloor: 4,
    bestCalamityTier: 1,
    cloudSeaClears: 1,
    taixuTrailUnlocked: false,
    lastEnding: "mortal_guardian",
    seenEnemies: ["wolf", "warden"],
    seenLaws: ["wanjian"],
    unlockedEndings: ["mortal_guardian"],
    karmaAscensions: { righteous: 1, neutral: 0, demonic: 0 },
    bingjieCount: 1,
    hallOfLives: [{ lifeNum: 1, name: "顾长青", endingId: "mortal_guardian", grade: "A", rushGrade: "A", score: 3500, recordedAt: 1000 }]
  };
  const remote = {
    metaRev: 5,
    ascensions: 2,
    bestScore: 2900,
    bestTower: 12,
    bestRushGrade: "S",
    bestRushTime: 112,
    bestSpireFloor: 7,
    bestCalamityTier: 2,
    cloudSeaClears: 0,
    taixuTrailUnlocked: true,
    lastEnding: "sword_sovereign",
    seenEnemies: ["serpent"],
    seenLaws: ["crit_lotus"],
    unlockedEndings: ["sword_sovereign"],
    karmaAscensions: JSON.parse('{"righteous":0,"demonic":2,"__proto__":{"pwned":1}}'),
    bingjieCount: 3,
    hallOfLives: [{ lifeNum: 2, name: "顾长青", endingId: "sword_sovereign", grade: "S", rushGrade: "S", score: 5200, recordedAt: 2000 }]
  };

  const merged = mergeMetaStates(local, remote);
  assert.equal(merged.metaRev, 5);
  assert.equal(merged.ascensions, 2);
  assert.equal(merged.bestScore, 3500);
  assert.equal(merged.bestTower, 12);
  assert.equal(merged.bestRushGrade, "S");
  assert.equal(merged.bestRushTime, 112);
  assert.equal(merged.taixuTrailUnlocked, true);
  assert.equal(merged.lastEnding, "sword_sovereign");
  assert.deepEqual(merged.seenEnemies, ["wolf", "warden", "serpent"]);
  assert.deepEqual(merged.seenLaws, ["wanjian", "crit_lotus"]);
  assert.deepEqual(merged.unlockedEndings, ["mortal_guardian", "sword_sovereign"]);
  assert.equal(merged.karmaAscensions.righteous, 1);
  assert.equal(merged.karmaAscensions.demonic, 2);
  assert.equal(merged.bingjieCount, 3);
  assert.equal(Object.prototype.hasOwnProperty.call(merged, "reincarnationPoints"), false);
  assert.equal(merged.hallOfLives.length, 2);
  assert.equal(({}).pwned, undefined);

  // Non-whitelisted legacy/corrupt grades sanitize cleanly without shims
  assert.equal(mergeMetaStates({ bestRushGrade: "SS" }, { bestRushGrade: "S+" }).bestRushGrade, null);
  const badHall = sanitizeHallEntry({ lifeNum: 1, name: "测", grade: "SSS", rushGrade: "S+", score: 100 });
  assert.equal(badHall.grade, "C");
  assert.equal(badHall.rushGrade, "未挑战");

  const metaCheck = parseAndValidateMetaRaw(JSON.stringify(merged), META_KEY);
  assert.equal(metaCheck.ok, true);
  assert.equal(metaCheck.metaRev, 5);
});

test("normalizeGearItem obeys D05 legacy gear non-mutation and sanitizes invalid art/fields", () => {
  const legacyOverBudget = {
    uid: "g_legacy_op",
    slot: "weapon",
    rarity: 0, // common rarity cap is atk=45, crit=0.06
    lvl: 3,
    name: "旧档神兵",
    atk: 999,
    hp: 500,
    dr: 80,
    crit: 0.45,
    spd: 0.35,
    bonusSword: 3,
    art: "nonexistent_sprite_key",
    taixuForged: true
  };
  const normalized = normalizeGearItem(legacyOverBudget, "weapon", { icon_blade: "ok" });
  // D05: NEVER retroactively clamps or weakens legacy gear stats!
  assert.equal(normalized.atk, 999);
  assert.equal(normalized.hp, 500);
  assert.equal(normalized.dr, 80);
  assert.equal(normalized.crit, 0.45);
  assert.equal(normalized.spd, 0.35);
  assert.equal(normalized.bonusSword, 3);
  assert.equal(normalized.taixuForged, true);
  assert.equal(normalized.art, "icon_blade");
});

test("safeAssignPlain, num, escapeHtml, safeText, and safeDiag block prototype pollution and coerce safely", () => {
  const target = { a: 1 };
  const payload = JSON.parse('{"b":2,"__proto__":{"polluted":true},"constructor":{"bad":1},"prototype":{"bad":2}}');
  safeAssignPlain(target, payload);
  assert.equal(target.b, 2);
  assert.equal(({}).polluted, undefined);

  assert.equal(num("42", 0), 42);
  assert.equal(num("", 9), 9);
  assert.equal(num(true, 9), 9);
  assert.equal(num(null, 9), 9);
  assert.equal(num(Number.POSITIVE_INFINITY, 9), 9);
  assert.equal(escapeHtml(`<img src="x" onerror='alert(1)'>&`), "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;");
  assert.equal(safeText(123, "fb"), "123");
  assert.equal(safeText(null, "fb"), "fb");
  assert.equal(safeDiag({ x: 1 }), "[object]");
});
