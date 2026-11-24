// Pure combat parameters, gear budget tables, growth caps, and stage/boss gates.
// Single source of truth shared by Node unit tests and assembled web/public/playable-v2.html.

export const COMBAT_RULE_PARAMS = Object.freeze({
  passiveSoftCapKnee: 0.95,
  passiveSoftCapMax: 1.65,
  activeMultCap: 1.95,
  critCap: 0.78,
  critMultCap: 2.35,
  skills: Object.freeze({
    sword_pierce:   Object.freeze({ mindAtk: 10 }),
    sword_still:    Object.freeze({ mindDr: 8, xpMult: 1.25 }),
    talisman_clear: Object.freeze({ mindDr: 12, mindAtk: 5 })
  }),
  laws: Object.freeze({
    wealth_power:    Object.freeze({ perStones: 100, pctPerStep: 0.04, maxPct: 0.36, pool: "passive" }),
    stagger_surge:   Object.freeze({ baseStunMult: 1.45, enhancedStunMult: 1.65, breakMp: 15, breakUltCdReduce: 1.5 }),
    crit_lotus:      Object.freeze({ crit: 0.18, critMult: 0.18 }),
    age_might:       Object.freeze({ baseAge: 18, yearsPerStep: 10, pctPerStep: 0.06, maxPct: 0.30, pool: "passive" }),
    karma_resonance: Object.freeze({ pctPerChoice: 0.05, maxPct: 0.28, pool: "passive" })
  }),
  omens: Object.freeze({
    wolf_star: Object.freeze({ crit: 0.12, stoneMult: 1.40 })
  }),
  celestialPhases: Object.freeze({
    dawn:       Object.freeze({ dr: 4, righteousShieldPct: 0.42, hpRegenPctPerSec: 0.04, mpRegenPctPerSec: 0.05, healAmp: 1.25 }),
    noon:       Object.freeze({ passiveAtkPct: 0.10, astralEnergyMult: 1.25 }),
    blood_dusk: Object.freeze({ demonicPassiveAtkPct: 0.22, otherPassiveAtkPct: 0.12, critMult: 0.16, heavyHealMaxHpPct: 0.02 }),
    star_night: Object.freeze({ starChartMult: 2.0 })
  }),
  climates: Object.freeze({
    sword_wind:   Object.freeze({ haste: 0.12, speedMult: 1.10 }),
    thunder_loom: Object.freeze({ critMult: 0.14 }),
    blood_haze:   Object.freeze({ playerActiveMult: 1.15, enemyAtkMult: 1.18 })
  }),
  runBoons: Object.freeze({
    blood_intent:    Object.freeze({ hpThreshold: 0.55, crit: 0.20, intentGainMult: 1.65 }),
    posture_shatter: Object.freeze({ postureMult: 1.45, mobTrueDmgRatio: 0.18, bossTrueDmgRatio: 0.08 }),
    gourd_overload:  Object.freeze({ durationSec: 7.0, hyperArmorSec: 5.0, passiveAtkPct: 0.28, haste: 0.22 }),
    vampiric_qi:     Object.freeze({ breakHealPct: 0.06, killHealPct: 0.08, mpGain: 12 }),
    aerial_reign:    Object.freeze({ dmgMult: 1.45 }),
    gold_alchemist:  Object.freeze({ stoneDropMult: 1.45, perStones: 100, pctPerStep: 0.03, maxPct: 0.28, pool: "passive" })
  })
});

export const GEAR_ENHANCE_STEP_PCT = 0.08;

export const LIFESPAN_THRESHOLDS = Object.freeze([0.75, 0.90, 0.95, 1.00]);

export const GEAR_STAT_WEIGHTS = Object.freeze({
  atk: 3.0,
  hp: 0.4,
  dr: 5.0,
  crit: 240,
  spd: 180,
  bonusSword: 85,
  affix: 45
});

export const GEAR_BUDGET_BY_RARITY = Object.freeze({
  0: Object.freeze({ maxBudget: 160,  statCaps: Object.freeze({ atk: 45,  hp: 150, dr: 12, crit: 0.06, spd: 0.06, bonusSword: 0 }) }),
  1: Object.freeze({ maxBudget: 260,  statCaps: Object.freeze({ atk: 75,  hp: 250, dr: 18, crit: 0.09, spd: 0.09, bonusSword: 0 }) }),
  2: Object.freeze({ maxBudget: 420,  statCaps: Object.freeze({ atk: 120, hp: 380, dr: 26, crit: 0.12, spd: 0.12, bonusSword: 0 }) }),
  3: Object.freeze({ maxBudget: 620,  statCaps: Object.freeze({ atk: 180, hp: 520, dr: 36, crit: 0.15, spd: 0.15, bonusSword: 1 }) }),
  4: Object.freeze({ maxBudget: 860,  statCaps: Object.freeze({ atk: 240, hp: 720, dr: 48, crit: 0.18, spd: 0.18, bonusSword: 1 }) }),
  5: Object.freeze({ maxBudget: 1180, statCaps: Object.freeze({ atk: 320, hp: 980, dr: 64, crit: 0.22, spd: 0.22, bonusSword: 2 }) })
});

export const STAGE_SCALING = [1.0, 1.65, 2.50, 3.60, 4.70];

export const SINGLE_HIT_CAP_RATIO = 0.45;

export const REALM_COMBAT_BASELINE = {
  mortal:     { bossHp: 3600,  mobHp: 300,   atk: 20,  heavy: 36  },
  qi:         { bossHp: 8000,  mobHp: 600,   atk: 34,  heavy: 60  },
  foundation: { bossHp: 18000, mobHp: 1600,  atk: 58,  heavy: 102 },
  golden:     { bossHp: 31000, mobHp: 3200,  atk: 98,  heavy: 174 },
  nascent:    { bossHp: 45500, mobHp: 6200,  atk: 152, heavy: 272 },
  spirit:     { bossHp: 64000, mobHp: 9000,  atk: 215, heavy: 385 },
  ascended:   { bossHp: 88000, mobHp: 13500, atk: 280, heavy: 510 }
};

export const PERM_GROWTH_CAPS = {
  totalMaxHpByRealm: { mortal: 100, qi: 180, foundation: 280, golden: 420, nascent: 580, spirit: 760, ascended: 900 },
  totalAtkByRealm:   { mortal: 20,  qi: 40,  foundation: 70,  golden: 110, nascent: 155, spirit: 200, ascended: 240 },
  alchemyHpByRealm:  { mortal: 40,  qi: 80,  foundation: 140, golden: 210, nascent: 290, spirit: 380, ascended: 450 },
  alchemyAtkByRealm: { mortal: 8,   qi: 18,  foundation: 32,  golden: 50,  nascent: 72,  spirit: 96,  ascended: 120 },
  bloodFuryPerRealm: 2,
  spireCurioMaxStack: 3,
  curioStoneAlchemyDmgCap: 0.40,
  curioStoneAlchemyFloorStonePerLv: 60,
  curioStoneAlchemyFloorStoneCap: 180,
  curioCritSilkDmgCap: 0.54
};

export const REALM_BOSS_GATE = {
  mortal:     0, // 雾隐狼王 -> qi
  qi:         1, // 守山石卫 -> foundation
  foundation: 2, // 寒潭玄蛇 -> golden
  golden:     3, // 古境剑傀 -> nascent
  nascent:    3, // 古境剑傀（第五卷防跳过） -> spirit
  spirit:     4  // 天门道影 -> ascended
};
