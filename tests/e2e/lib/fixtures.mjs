// Dynamic save and payload fixture builders for E2E tests.
// Never commit real player save files; all fixtures are generated at runtime.

export const STORAGE_KEY = "chenyuan_wendao_v11_save";
export const META_KEY = "chenyuan_wendao_v11_meta";
export const LEGACY_V10_KEY = "chenyuan_wendao_v10_save";

export const ALL_DAO_LAW_IDS = [
  "wanjian",
  "yinyang",
  "pill_fire",
  "wealth_power",
  "thunder_body",
  "crit_lotus",
  "nine_pill",
  "eternal_spring",
  "stagger_surge",
  "void_haste",
  "relic_awake",
  "beast_soul",
  "age_might",
  "karma_resonance",
  "destiny_eye"
];

export const ALL_CHAPTER_STEP_IDS = [
  "s1_open", "s1_wolf", "s1_break",
  "s2_pet", "s2_lu", "s2_warden", "s2_break",
  "s3_npc", "s3_serpent", "s3_break",
  "s4_relic", "s4_puppet", "s4_break",
  "s5_laws", "s5_break",
  "s6_pacts", "s6_gate", "s6_ascend"
];

export const REALM_XP_CAPS = {
  mortal: 60,
  qi: 400,
  foundation: 1300,
  golden: 3300,
  nascent: 7400,
  spirit: 14500,
  ascended: 14500
};

export function computeSaveChecksum(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).toUpperCase().padStart(8, "0");
}

export function buildCanonicalSavePayload(bundleObj) {
  return JSON.stringify({
    game: bundleObj.game,
    stageIdx: bundleObj.stageIdx,
    stanceIdx: bundleObj.stanceIdx,
    towerMode: !!bundleObj.towerMode,
    sanctumMode: !!bundleObj.sanctumMode
  });
}

export function buildLegacyEb0ea67Game(overrides = {}) {
  return {
    name: "顾长青",
    perk: "sword_bone",
    realm: "golden",
    xp: 1200,
    stones: 500,
    hp: 300,
    mp: 140,
    wins: 12,
    towerBest: 5,
    stageStars: { 0: 3, 1: 2 },
    laws: ["wanjian"],
    learned: ["slash_basic"],
    ownedRelics: [],
    relicStars: {},
    loadout: { relic: null },
    inventory: { herb: 6, core: 2, healing_pill: 2 },
    equippedGear: { weapon: null, armor: null, ring: null },
    gearBag: [],
    marketStock: [],
    pet: { id: null, level: 1 },
    aids: { shen: true, pei: false, lu: false, yan: false },
    bondTiers: { shen: 1, pei: 0, lu: 0, yan: 0 },
    dao: { benevolence: 10, edge: 10, serenity: 10 },
    choices: {},
    openingChoice: "help",
    achievements: [],
    claimedAchievements: [],
    claimedStepIds: ["s1_open"],
    claimedStarChests: [],
    unlockedSouls: ["blood_warden"],
    equippedSoul: "blood_warden",
    sanctumLevels: {
      spirit_eye: 2,
      cauldron: 2,
      sword_forge: 1,
      scripture_hall: 1,
      guard_array: 1
    },
    calamityTier: 0,
    unlockAllArcana: false,
    ...overrides
  };
}

export function buildEnvelopeV2({
  game = buildLegacyEb0ea67Game(),
  stageIdx = 0,
  stanceIdx = 0,
  towerMode = false,
  sanctumMode = false,
  saveRev = 1,
  tabId = "tab_e2e_fixture_01",
  updatedAt = Date.now(),
  corruptChecksum = false
} = {}) {
  const payloadObj = {
    game,
    stageIdx,
    stanceIdx,
    towerMode: !!towerMode,
    sanctumMode: !!sanctumMode
  };
  const checksum = corruptChecksum
    ? "DEADBEEF"
    : computeSaveChecksum(buildCanonicalSavePayload(payloadObj));
  return JSON.stringify({
    envelopeVersion: 2,
    saveRev,
    tabId,
    updatedAt,
    checksum,
    ...payloadObj
  });
}

export function buildLegacyV10Save(overrides = {}) {
  const game = buildLegacyEb0ea67Game(overrides);
  return JSON.stringify({
    game,
    stageIdx: 0,
    stanceIdx: 0,
    towerMode: false,
    sanctumMode: false
  });
}

export function buildMetaSave(overrides = {}) {
  return JSON.stringify({
    ascensions: 0,
    bestScore: 0,
    bestTower: 0,
    bestRushGrade: null,
    bestRushTime: 0,
    bestSpireFloor: 0,
    bestCalamityTier: 0,
    cloudSeaClears: 0,
    taixuTrailUnlocked: false,
    lastEnding: null,
    seenEnemies: ["wolf"],
    seenLaws: [],
    unlockedEndings: [],
    karmaAscensions: { righteous: 0, neutral: 0, demonic: 0 },
    reincarnationPoints: 0,
    hallOfLives: [],
    ...overrides
  });
}

export function buildCorruptPrimarySave() {
  return "{CORRUPT_PRIMARY_SAVE::not-json";
}

export function buildCorruptMetaSave() {
  return "{CORRUPT_META::ascensions=5";
}

export function buildCloudSaveCode(payloadObj) {
  const jsonStr = JSON.stringify(payloadObj);
  let sum = 0x24;
  for (let i = 0; i < jsonStr.length; i++) {
    sum = (sum * 31 + jsonStr.charCodeAt(i)) & 0xFFFF;
  }
  const chk = sum.toString(16).toUpperCase().padStart(4, "0");
  const b64 = Buffer.from(jsonStr, "utf8").toString("base64");
  return `CY24SAVE-${chk}-${b64}`;
}
