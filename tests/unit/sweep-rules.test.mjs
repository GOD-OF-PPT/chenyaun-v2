import test from "node:test";
import assert from "node:assert/strict";
import {
  STAGE_SWEEP_MAX_PER_DAY,
  STAGE_SWEEP_COOLDOWN_MS,
  STAGE_SWEEP_LIFESPAN_MONTHS,
  HOLD_START_DELAY_MS,
  HOLD_REPEAT_INTERVAL_MS,
  formatLocalDayKey,
  sanitizeStageSweepState,
  getStageSweepStatus,
  computeStageSweepPreview,
  rollStageSweepRewards
} from "../../src/rules/sweep-rules.mjs";
import { computeMainlineRealmScaling } from "../../src/rules/combat-stats.mjs";
import { loadPlayableEngine } from "../../scripts/eval-combat-matrix.mjs";

function makeSeededRng(seed = 20261124) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const { debug } = loadPlayableEngine(20261124);
const ENV = {
  STAGES: debug.STAGES,
  CAMPAIGN_ACTS: debug.CAMPAIGN_ACTS,
  ENEMIES: debug.ENEMIES
};

function makeGame(overrides = {}) {
  return Object.assign({
    realm: "qi",
    stones: 200,
    xp: 0,
    overflowXp: 0,
    elapsedMonths: 24,
    startAgeMonths: 216,
    omenIndex: 0,
    calamityTier: 0,
    pactSeals: [],
    destinyFruits: [],
    loadout: { mind: "sword_mind", builder: "sword_build", finisher: "sword_release", relic: null },
    equippedGear: {
      weapon: { slot: "weapon", rarity: 1, lvl: 0, atk: 12, hp: 0, dr: 0, crit: 0.03, spd: 0, bonusSword: 0, power: 40 },
      armor: null,
      ring: null
    },
    gearBag: [],
    pity: { epic: 0, mythic: 0, critAcc: 0, vampHits: 0, thunderHits: 0, gearDrops: 0 },
    dao: { benevolence: 6, edge: 10, serenity: 6 },
    stageStars: { 0: 3 },
    stageSweepState: {}
  }, overrides);
}

test("D08 constants and sanitizeStageSweepState clamp & strip malformed/prototype keys", () => {
  assert.equal(STAGE_SWEEP_MAX_PER_DAY, 3);
  assert.equal(STAGE_SWEEP_COOLDOWN_MS, 60_000);
  assert.equal(STAGE_SWEEP_LIFESPAN_MONTHS, 0);
  assert.equal(HOLD_START_DELAY_MS, 380);
  assert.equal(HOLD_REPEAT_INTERVAL_MS, 220);

  const poisoned = JSON.parse('{"0":{"dayKey":"2026-11-24","usedToday":99,"lastSweepAt":1700000000000,"totalSweeps":5},"1":{"dayKey":"bad-date","usedToday":2,"lastSweepAt":-10,"totalSweeps":-3},"99":{"dayKey":"2026-11-24","usedToday":1},"__proto__":{"polluted":true}}');
  const clean = sanitizeStageSweepState(poisoned, 5);
  assert.deepEqual(Object.keys(clean).sort(), ["0", "1"]);
  assert.deepEqual(clean["0"], { dayKey: "2026-11-24", usedToday: 3, lastSweepAt: 1700000000000, totalSweeps: 5 });
  assert.deepEqual(clean["1"], { dayKey: "", usedToday: 0, lastSweepAt: 0, totalSweeps: 0 });
  assert.equal(({}).polluted, undefined);
});

test("getStageSweepStatus enforces 3★/S-rank, realm unlock, practice mode, 60s cooldown, 3/day cap & next-day reset", () => {
  const t0 = new Date(2026, 10, 24, 12, 0, 0).getTime();
  const day0 = formatLocalDayKey(t0);
  const nextDay = new Date(2026, 10, 25, 12, 0, 0).getTime();

  // Invalid stage
  assert.equal(getStageSweepStatus(makeGame(), -1, t0, ENV).reason, "invalid_stage");
  assert.equal(getStageSweepStatus(makeGame(), 5, t0, ENV).reason, "invalid_stage");

  // Practice mode blocked
  assert.equal(getStageSweepStatus(makeGame(), 0, t0, { ...ENV, practiceMode: true }).reason, "practice_mode");

  // Realm locked stage (stage 2 requires foundation)
  const lockedSt = getStageSweepStatus(makeGame({ realm: "qi", stageStars: { 2: 3 } }), 2, t0, ENV);
  assert.equal(lockedSt.eligible, false);
  assert.equal(lockedSt.canSweep, false);
  assert.equal(lockedSt.reason, "stage_locked");

  // 0★ / 1★ / 2★ rejected
  for (const stars of [0, 1, 2]) {
    const st = getStageSweepStatus(makeGame({ stageStars: { 0: stars } }), 0, t0, ENV);
    assert.equal(st.eligible, false);
    assert.equal(st.canSweep, false);
    assert.equal(st.reason, "requires_three_stars");
    assert.notEqual(st.grade, "S");
  }

  // 3★ (S) ready
  const okSt = getStageSweepStatus(makeGame({ stageStars: { 0: 3 } }), 0, t0, ENV);
  assert.equal(okSt.eligible, true);
  assert.equal(okSt.canSweep, true);
  assert.equal(okSt.reason, "ok");
  assert.equal(okSt.grade, "S");
  assert.equal(okSt.remaining, 3);
  assert.equal(okSt.lifespanMonths, 0);

  // Cooldown boundary: 59,999ms blocked, 60,000ms allowed
  const cdGame = makeGame({
    stageSweepState: { 0: { dayKey: day0, usedToday: 1, lastSweepAt: t0, totalSweeps: 1 } }
  });
  const cdBlocked = getStageSweepStatus(cdGame, 0, t0 + 59_999, ENV);
  assert.equal(cdBlocked.eligible, true);
  assert.equal(cdBlocked.canSweep, false);
  assert.equal(cdBlocked.reason, "on_cooldown");
  assert.equal(cdBlocked.cooldownSec, 1);
  assert.equal(cdBlocked.remaining, 2);

  const cdReady = getStageSweepStatus(cdGame, 0, t0 + 60_000, ENV);
  assert.equal(cdReady.canSweep, true);
  assert.equal(cdReady.reason, "ok");
  assert.equal(cdReady.cooldownRemainMs, 0);

  // Daily cap 3/3 exhausted & next-day reset
  const capGame = makeGame({
    stageSweepState: { 0: { dayKey: day0, usedToday: 3, lastSweepAt: t0, totalSweeps: 3 } }
  });
  const capBlocked = getStageSweepStatus(capGame, 0, t0 + 120_000, ENV);
  assert.equal(capBlocked.eligible, true);
  assert.equal(capBlocked.canSweep, false);
  assert.equal(capBlocked.reason, "quota_exhausted");
  assert.equal(capBlocked.remaining, 0);

  const nextDayReset = getStageSweepStatus(capGame, 0, nextDay, ENV);
  assert.equal(nextDayReset.canSweep, true);
  assert.equal(nextDayReset.reason, "ok");
  assert.equal(nextDayReset.remaining, 3);
  assert.equal(nextDayReset.usedToday, 0);
});

test("computeStageSweepPreview & rollStageSweepRewards compute authentic 0-lifespan rewards, D05 stoneMult scaling, and preserved low-stage XP attenuation", () => {
  const mortalCh1 = makeGame({ realm: "mortal", stageStars: { 0: 3 } });
  const spiritCh1 = makeGame({ realm: "spirit", stageStars: { 0: 3 } });
  const spiritCh5 = makeGame({ realm: "spirit", stageStars: { 4: 3 } });

  const prevMortal0 = computeStageSweepPreview(mortalCh1, 0, ENV);
  const prevSpirit0 = computeStageSweepPreview(spiritCh1, 0, ENV);
  const prevSpirit4 = computeStageSweepPreview(spiritCh5, 4, ENV);

  assert.equal(prevMortal0.valid, true);
  assert.equal(prevMortal0.lifespanMonths, 0);
  assert.equal(prevMortal0.waveMobCount, 9);
  assert.equal(prevMortal0.realmScaled, false);
  assert.equal(prevMortal0.realmStoneMult, 1);

  // Spirit revisiting Stage 0 gets D05 stoneMult boost while preserving strict low-stage XP attenuation!
  const expectedScale0 = computeMainlineRealmScaling(0, "spirit", true);
  assert.equal(prevSpirit0.realmScaled, true);
  assert.equal(prevSpirit0.realmStoneMult, expectedScale0.stoneMult);
  assert.ok(prevSpirit0.stones > prevMortal0.stones, "Spirit sweep on Stage 0 must scale stones via D05 stoneMult");
  // Per-wolf XP in Spirit revisiting Ch1 must stay <= 15 (9 mobs + 1 boss = ~12.2 mobs equivalent, rawXp stays heavily attenuated vs Ch5)
  assert.ok(prevSpirit0.rawXp < prevSpirit4.rawXp * 0.15, `Expected low-stage XP attenuation on Ch1 sweep (${prevSpirit0.rawXp}) vs Ch5 (${prevSpirit4.rawXp})`);
  assert.ok(prevSpirit0.rawXp / 10 <= 15, `Average per-enemy XP on Spirit Ch1 sweep must stay <= 15, got ${prevSpirit0.rawXp / 10}`);

  // Guaranteed boss core + bossMats + stage clear bossMats (stages 0..3)
  assert.ok(prevMortal0.guaranteedMats.core >= 3, "Stage 0 guaranteed mats must include boss core + boss loot core + stage clear core");
  assert.ok(prevMortal0.guaranteedMats.dew >= 2, "Stage 0 guaranteed mats must include boss dew + stage clear dew");
  assert.equal(prevSpirit4.minRarity, 4, "Stage 4 boss gear must guarantee mythic rarity 4");
  assert.equal(prevSpirit4.clearBonusStones, 0, "Stage 4 has no extra clearBonusStones");

  // Deterministic seeded reward rolling
  const gA = makeGame({ realm: "golden", stageStars: { 2: 3 } });
  const gB = makeGame({ realm: "golden", stageStars: { 2: 3 } });
  const rollA = rollStageSweepRewards(gA, 2, { rng: makeSeededRng(123456), env: ENV });
  const rollB = rollStageSweepRewards(gB, 2, { rng: makeSeededRng(123456), env: ENV });
  assert.equal(rollA.valid, true);
  assert.equal(rollA.lifespanMonths, 0);
  assert.equal(rollA.stones, rollB.stones);
  assert.equal(rollA.rawXp, rollB.rawXp);
  assert.deepEqual(rollA.materials, rollB.materials);
  assert.equal(rollA.gear.name, rollB.gear.name);
  assert.equal(rollA.gear.rarity, rollB.gear.rarity);
  assert.ok(rollA.gear.rarity >= rollA.preview.minRarity);
});
