// Pure save envelope v2 checksum, canonical payload validation, legacy step ID mapping, and CRDT meta-state merge rules.
import { safeText, safeDiag, num, hasOwn } from "../rules/utils.mjs";
import { REALMS } from "../config/realms-items.mjs";
import { LEGACY_STEP_ID_MAP } from "../config/progression-data.mjs";

export const STORAGE_KEY = "chenyuan_wendao_v11_save";
export const META_KEY = "chenyuan_wendao_v11_meta";
export const RUSH_GRADE_RANK = { "S+": 6, "SS": 5, "S": 4, "A": 3, "B": 2, "C": 1 };

export function canonicalizeStepId(id) {
  if (typeof id !== "string" || !id) return "";
  return hasOwn(LEGACY_STEP_ID_MAP, id) ? LEGACY_STEP_ID_MAP[id] : id;
}

export function createDefaultMetaState() {
  return {
    metaRev: 0,
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
    hallOfLives: []
  };
}

export function sanitizeHallEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const rawKarma = safeText(entry.karmaMode, "neutral");
  const safeKarma = ["righteous", "demonic", "neutral"].includes(rawKarma) ? rawKarma : "neutral";
  return {
    lifeNum: Math.max(1, Math.floor(num(entry.lifeNum, 1))),
    name: safeText(entry.name, "顾长青") || "顾长青",
    endingId: typeof entry.endingId === "string" ? entry.endingId : "",
    endingName: safeText(entry.endingName, ""),
    karmaMode: safeKarma,
    karmaLabel: safeText(entry.karmaLabel, "本真中正") || "本真中正",
    epithet: safeText(entry.epithet, ""),
    poem: safeText(entry.poem, ""),
    grade: safeText(entry.grade, "B") || "B",
    score: Math.max(0, num(entry.score, 0)),
    towerBest: Math.max(0, Math.floor(num(entry.towerBest, 0))),
    rushGrade: safeText(entry.rushGrade, "未挑战") || "未挑战",
    spireBest: Math.max(0, Math.floor(num(entry.spireBest, 0))),
    sanctumLv: Math.max(0, Math.floor(num(entry.sanctumLv, 5))),
    codexPct: Math.max(0, Math.min(100, Math.floor(num(entry.codexPct, 0)))),
    perkId: safeText(entry.perkId, "sword_bone") || "sword_bone",
    calamityTier: Math.max(0, Math.floor(num(entry.calamityTier, 0))),
    swordAura: typeof entry.swordAura === "string" ? entry.swordAura : "azure_jade",
    recordedAt: Math.max(0, num(entry.recordedAt, 0))
  };
}

export function parseAndValidateMetaRaw(raw, sourceKey) {
  if (!raw || typeof raw !== "string") {
    return { ok: false, empty: true, sourceKey };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, empty: false, sourceKey, reason: `JSON 解析失败（${safeText(e && e.message, "格式损坏") || "格式损坏"}）`, raw };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, empty: false, sourceKey, reason: "元存档根结构非法（非对象）", raw };
  }
  const isInvalidNonNegField = (v) => v !== undefined && (
    v === null || typeof v === "boolean" || typeof v === "object" ||
    (typeof v === "string" && v.trim() === "") ||
    !Number.isFinite(Number(v)) || Number(v) < 0
  );
  if (isInvalidNonNegField(parsed.metaRev)) {
    return { ok: false, empty: false, sourceKey, reason: "元存档版本号字段非法", raw };
  }
  if (isInvalidNonNegField(parsed.ascensions)) {
    return { ok: false, empty: false, sourceKey, reason: "元存档飞升世数字段非法", raw };
  }
  return {
    ok: true,
    empty: false,
    sourceKey,
    meta: parsed,
    metaRev: Math.max(0, Math.floor(num(parsed.metaRev, 0))),
    legacy: sourceKey !== META_KEY
  };
}

export function mergeMetaStates(local, remote) {
  const a = (local && typeof local === "object") ? local : createDefaultMetaState();
  const b = (remote && typeof remote === "object") ? remote : {};
  const localRev = Math.max(0, Math.floor(num(a.metaRev, 0)));
  const remoteRev = Math.max(0, Math.floor(num(b.metaRev, 0)));
  const numMax = (k) => Math.max(0, num(a[k], 0), num(b[k], 0));
  const strUnion = (arrA, arrB) => {
    const out = [];
    const seen = new Set();
    [...(Array.isArray(arrA) ? arrA : []), ...(Array.isArray(arrB) ? arrB : [])].forEach(v => {
      if (typeof v === "string" && v && !seen.has(v)) { seen.add(v); out.push(v); }
    });
    return out;
  };
  const seenEnemies = strUnion(a.seenEnemies, b.seenEnemies);
  if (seenEnemies.length === 0) seenEnemies.push("wolf");
  const rA = hasOwn(RUSH_GRADE_RANK, a.bestRushGrade) ? RUSH_GRADE_RANK[a.bestRushGrade] : 0;
  const rB = hasOwn(RUSH_GRADE_RANK, b.bestRushGrade) ? RUSH_GRADE_RANK[b.bestRushGrade] : 0;
  const bestRushGrade = rB > rA ? b.bestRushGrade : (rA > 0 ? a.bestRushGrade : (rB > 0 ? b.bestRushGrade : null));
  const tA = Math.max(0, num(a.bestRushTime, 0));
  const tB = Math.max(0, num(b.bestRushTime, 0));
  const bestRushTime = (tA > 0 && tB > 0) ? Math.min(tA, tB) : Math.max(tA, tB);
  const karmaA = (a.karmaAscensions && typeof a.karmaAscensions === "object" && !Array.isArray(a.karmaAscensions)) ? a.karmaAscensions : {};
  const karmaB = (b.karmaAscensions && typeof b.karmaAscensions === "object" && !Array.isArray(b.karmaAscensions)) ? b.karmaAscensions : {};
  const karmaAscensions = { righteous: 0, neutral: 0, demonic: 0 };
  new Set(["righteous", "neutral", "demonic", ...Object.keys(karmaA), ...Object.keys(karmaB)]).forEach(k => {
    if (k === "__proto__" || k === "constructor" || k === "prototype") return;
    karmaAscensions[k] = Math.max(0, Math.floor(num(karmaA[k], 0)), Math.floor(num(karmaB[k], 0)));
  });
  const hallMap = new Map();
  [...(Array.isArray(a.hallOfLives) ? a.hallOfLives : []), ...(Array.isArray(b.hallOfLives) ? b.hallOfLives : [])].forEach(rawEntry => {
    const entry = sanitizeHallEntry(rawEntry);
    if (!entry) return;
    const key = `${entry.recordedAt || 0}|${entry.lifeNum || 0}|${entry.endingId || ""}|${entry.name || ""}|${entry.score || 0}`;
    if (!hallMap.has(key)) hallMap.set(key, entry);
  });
  const hallOfLives = Array.from(hallMap.values())
    .sort((x, y) => ((num(y.recordedAt, 0)) - (num(x.recordedAt, 0))) || ((num(y.lifeNum, 0)) - (num(x.lifeNum, 0))))
    .slice(0, 18);
  const lastA = (typeof a.lastEnding === "string" && a.lastEnding) ? a.lastEnding : null;
  const lastB = (typeof b.lastEnding === "string" && b.lastEnding) ? b.lastEnding : null;
  return {
    metaRev: Math.max(localRev, remoteRev),
    ascensions: Math.floor(numMax("ascensions")),
    bestScore: numMax("bestScore"),
    bestTower: Math.floor(numMax("bestTower")),
    bestRushGrade,
    bestRushTime,
    bestSpireFloor: Math.floor(numMax("bestSpireFloor")),
    bestCalamityTier: Math.floor(numMax("bestCalamityTier")),
    cloudSeaClears: Math.floor(numMax("cloudSeaClears")),
    taixuTrailUnlocked: Boolean(a.taixuTrailUnlocked) || Boolean(b.taixuTrailUnlocked),
    lastEnding: (remoteRev > localRev && lastB) ? lastB : (lastA || lastB || null),
    seenEnemies,
    seenLaws: strUnion(a.seenLaws, b.seenLaws),
    unlockedEndings: strUnion(a.unlockedEndings, b.unlockedEndings),
    karmaAscensions,
    reincarnationPoints: Math.floor(numMax("reincarnationPoints")),
    hallOfLives
  };
}

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

export function parseAndValidateSaveRaw(raw, sourceKey) {
  if (!raw || typeof raw !== "string") {
    return { ok: false, empty: true, sourceKey };
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, empty: false, sourceKey, reason: `JSON 解析失败（${safeText(e && e.message, "格式损坏") || "格式损坏"}）`, raw };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !parsed.game || typeof parsed.game !== "object" || Array.isArray(parsed.game)) {
    return { ok: false, empty: false, sourceKey, reason: "存档缺少核心 game 数据结构", raw };
  }
  if (typeof parsed.game.realm !== "string" || !hasOwn(REALMS, parsed.game.realm)) {
    return { ok: false, empty: false, sourceKey, reason: `存档境界字段非法（${safeDiag(parsed.game.realm)}）`, raw };
  }
  if (parsed.saveRev !== undefined && (
    parsed.saveRev === null || typeof parsed.saveRev === "boolean" || typeof parsed.saveRev === "object" ||
    (typeof parsed.saveRev === "string" && parsed.saveRev.trim() === "") ||
    !Number.isFinite(Number(parsed.saveRev)) || Number(parsed.saveRev) < 0
  )) {
    return { ok: false, empty: false, sourceKey, reason: "存档版本号字段非法", raw };
  }
  if (parsed.envelopeVersion !== undefined && (
    parsed.envelopeVersion === null || typeof parsed.envelopeVersion === "boolean" || typeof parsed.envelopeVersion === "object" ||
    (typeof parsed.envelopeVersion === "string" && parsed.envelopeVersion.trim() === "") ||
    !Number.isFinite(Number(parsed.envelopeVersion)) || Number(parsed.envelopeVersion) < 1
  )) {
    return { ok: false, empty: false, sourceKey, reason: "存档封装版本字段非法", raw };
  }
  const envVer = parsed.envelopeVersion !== undefined ? Number(parsed.envelopeVersion) : 0;
  if (envVer >= 2) {
    if (typeof parsed.checksum !== "string" || !parsed.checksum.trim()) {
      return { ok: false, empty: false, sourceKey, reason: "存档校验和字段缺失或非法", raw };
    }
    const expected = computeSaveChecksum(buildCanonicalSavePayload(parsed));
    if (expected !== parsed.checksum) {
      return { ok: false, empty: false, sourceKey, reason: `存档校验和不匹配（期望 ${expected}，实得 ${safeDiag(parsed.checksum)}）`, raw };
    }
  }
  return {
    ok: true,
    empty: false,
    sourceKey,
    bundle: parsed,
    rev: Math.max(0, Math.floor(num(parsed.saveRev, 0))),
    tabId: typeof parsed.tabId === "string" ? parsed.tabId : null,
    updatedAt: Math.max(0, Math.floor(num(parsed.updatedAt, 0))),
    legacy: sourceKey !== STORAGE_KEY || !envVer
  };
}
