#!/usr/bin/env node
/**
 * F21: Real Combat Evaluation Harness & Strength Matrix
 *
 * Loads and executes the ACTUAL game rules from web/public/playable-v2.html
 * inside a deterministic Node VM with a seeded PRNG and no-op timer stubs
 * (zero open handles). Evaluates 6 realms x gear tiers x schools x strategies
 * x encounter archetypes, outputting structured JSON metrics.
 *
 * Usage:
 *   node scripts/eval-combat-matrix.mjs [--seed 20261124] [--out path.json] [--pretty]
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PLAYABLE_PATH = path.join(ROOT, "web/public/playable-v2.html");

function parseArgs(argv) {
  const out = { seed: 20261124, outFile: null, pretty: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--seed" && argv[i + 1]) out.seed = Number(argv[++i]) || 20261124;
    else if (a === "--out" && argv[i + 1]) out.outFile = argv[++i];
    else if (a === "--pretty") out.pretty = true;
  }
  return out;
}

function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getCommitHash() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "unknown";
  }
}

function createMockElement(tagName = "div", id = "") {
  const attrs = new Map();
  const classes = new Set();
  const children = [];
  const style = new Proxy({}, {
    get(target, prop) { return prop in target ? target[prop] : ""; },
    set(target, prop, val) { target[prop] = String(val ?? ""); return true; }
  });
  const listeners = new Map();
  const el = {
    nodeType: 1,
    tagName: String(tagName || "div").toUpperCase(),
    id,
    className: "",
    textContent: "",
    innerHTML: "",
    value: "",
    src: "",
    disabled: false,
    open: false,
    checked: false,
    width: 1440,
    height: 900,
    style,
    dataset: {},
    children,
    parentElement: null,
    classList: {
      add: (...c) => c.forEach(x => x && classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, force) => {
        if (force === undefined) {
          if (classes.has(c)) { classes.delete(c); return false; }
          classes.add(c); return true;
        }
        if (force) classes.add(c); else classes.delete(c);
        return Boolean(force);
      },
      contains: (c) => classes.has(c)
    },
    setAttribute(k, v) { attrs.set(k, String(v)); if (k === "id") el.id = String(v); },
    getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
    hasAttribute(k) { return attrs.has(k); },
    removeAttribute(k) { attrs.delete(k); },
    appendChild(child) { if (child) { child.parentElement = el; children.push(child); } return child; },
    removeChild(child) { const idx = children.indexOf(child); if (idx >= 0) { children.splice(idx, 1); child.parentElement = null; } return child; },
    get firstChild() { return children[0] || null; },
    get lastChild() { return children[children.length - 1] || null; },
    remove() {
      if (el.parentElement) el.parentElement.removeChild(el);
    },
    focus() {},
    blur() {},
    click() {
      const fns = listeners.get("click") || [];
      fns.forEach(fn => fn({ target: el, currentTarget: el, preventDefault() {}, stopPropagation() {} }));
    },
    addEventListener(ev, fn) {
      if (!listeners.has(ev)) listeners.set(ev, []);
      listeners.get(ev).push(fn);
    },
    removeEventListener(ev, fn) {
      if (!listeners.has(ev)) return;
      listeners.set(ev, listeners.get(ev).filter(f => f !== fn));
    },
    dispatchEvent(e) {
      const fns = listeners.get(e && e.type) || [];
      fns.forEach(fn => fn(e));
      return true;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    contains(other) { return other === el || children.includes(other); },
    scrollIntoView() {},
    closest(sel) {
      const s = String(sel || "");
      if (id && (s.includes("#" + id) || s.includes("button"))) return el;
      return null;
    },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1440, height: 900, right: 1440, bottom: 900 }; },
    getContext() {
      const ctx = new Proxy({}, {
        get(target, prop) {
          if (prop === "measureText") return () => ({ width: 20 });
          if (prop === "createLinearGradient" || prop === "createRadialGradient") {
            return () => ({ addColorStop() {} });
          }
          if (prop === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
          return target[prop] ?? (() => {});
        },
        set(target, prop, val) { target[prop] = val; return true; }
      });
      return ctx;
    }
  };
  return el;
}

export function loadPlayableEngine(seed = 20261124) {
  const html = fs.readFileSync(PLAYABLE_PATH, "utf8");
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!scriptMatch) throw new Error("Failed to locate <script> in web/public/playable-v2.html");

  const rng = mulberry32(seed);
  const docListeners = new Map();
  const elementsById = new Map();
  const ensureEl = (id, tag = "div") => {
    if (!elementsById.has(id)) {
      const el = createMockElement(tag, id);
      if (id === "fx-canvas") { el.width = 1440; el.height = 900; }
      const origClick = el.click;
      el.click = () => {
        origClick();
        const fns = docListeners.get("click") || [];
        fns.forEach(fn => fn({ target: el, currentTarget: document, preventDefault() {}, stopPropagation() {} }));
      };
      elementsById.set(id, el);
    }
    return elementsById.get(id);
  };

  const storageMap = new Map();
  const localStorage = {
    getItem: (k) => (storageMap.has(String(k)) ? storageMap.get(String(k)) : null),
    setItem: (k, v) => { storageMap.set(String(k), String(v)); },
    removeItem: (k) => { storageMap.delete(String(k)); },
    clear: () => { storageMap.clear(); },
    key: (i) => Array.from(storageMap.keys())[i] ?? null,
    get length() { return storageMap.size; }
  };

  const documentElement = createMockElement("html", "");
  const body = createMockElement("body", "");
  const document = {
    documentElement,
    body,
    head: createMockElement("head", ""),
    visibilityState: "visible",
    activeElement: body,
    getElementById: (id) => ensureEl(id),
    createElement: (tag) => createMockElement(tag),
    createDocumentFragment: () => createMockElement("fragment"),
    querySelector: (sel) => {
      const m = /^#([A-Za-z0-9_-]+)$/.exec(String(sel || "").trim());
      return m ? ensureEl(m[1]) : null;
    },
    querySelectorAll: () => [],
    addEventListener(ev, fn) {
      if (!docListeners.has(ev)) docListeners.set(ev, []);
      docListeners.get(ev).push(fn);
    },
    removeEventListener(ev, fn) {
      if (!docListeners.has(ev)) return;
      docListeners.set(ev, docListeners.get(ev).filter(f => f !== fn));
    }
  };

  const MathProxy = Object.create(Math);
  MathProxy.random = rng;

  class MockImage {
    constructor() { this.complete = true; this.naturalWidth = 64; this.naturalHeight = 64; }
    set src(v) { this._src = v; }
    get src() { return this._src || ""; }
  }

  const sandbox = {
    console,
    Math: MathProxy,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    RegExp,
    Error,
    TypeError,
    RangeError,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    Uint8Array,
    Uint8ClampedArray,
    Int32Array,
    Float32Array,
    Float64Array,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    btoa: (s) => Buffer.from(String(s), "binary").toString("base64"),
    atob: (s) => Buffer.from(String(s), "base64").toString("binary"),
    document,
    localStorage,
    sessionStorage: localStorage,
    Image: MockImage,
    AudioContext: null,
    webkitAudioContext: null,
    navigator: { userAgent: "node-eval-harness", getGamepads: () => [], clipboard: { writeText: async () => {} } },
    location: { href: "http://127.0.0.1/playable-v2.html", protocol: "http:", search: "", hash: "" },
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 1,
    performance: { now: () => 0 },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    getComputedStyle: () => ({ display: "block", visibility: "visible", opacity: "1" }),
    setTimeout: () => 0,
    clearTimeout() {},
    setInterval: () => 0,
    clearInterval() {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame() {}
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(scriptMatch[1], ctx, { filename: "playable-v2.html" });
  const debug = sandbox.__CHENYUAN_DEBUG__;
  if (!debug) throw new Error("__CHENYUAN_DEBUG__ did not initialize in VM context");
  if (!debug.getState().game) {
    document.getElementById("btn-start-new").click();
    // Close opening cutscene & transition cleanly so cutscene.active === false and stepArena runs freely
    debug.enterSanctumHub({ skipSave: true });
    const tokens = debug.getPauseTokens ? debug.getPauseTokens() : [];
    tokens.forEach(tk => debug.releasePauseToken(tk.id));
    debug.getState().arena.paused = false;
  }
  const aimPointer = (x, y) => {
    const fns = docListeners.get("pointermove") || [];
    fns.forEach(fn => fn({ clientX: x, clientY: y, target: ensureEl("fx-canvas", "canvas") }));
  };
  return { sandbox, debug, rng, aimPointer };
}

function buildGearLoadout(debug, realmIdx, tier, rng) {
  const stageTier = Math.min(4, realmIdx);
  const cfg = tier === "entry"
    ? { minRarity: Math.min(1, Math.floor(realmIdx / 2)), lvl: 0 }
    : tier === "median"
      ? { minRarity: Math.min(3, Math.max(1, Math.floor(realmIdx * 0.6) + 1)), lvl: Math.min(4, Math.max(1, realmIdx)) }
      : { minRarity: Math.min(4, Math.max(2, Math.floor(realmIdx * 0.7) + 2)), lvl: Math.min(7, realmIdx + 2) };

  const slots = ["weapon", "armor", "ring"];
  const equipped = {};
  let allWithinBudget = true;
  for (const slot of slots) {
    const it = debug.rollGearItem(stageTier, cfg.minRarity, slot, { usePity: false, rng });
    const budgetCheck = debug.computeGearAffixBudget(it);
    if (!budgetCheck.withinBudget) allWithinBudget = false;
    it.lvl = cfg.lvl;
    equipped[slot] = it;
  }
  return { equipped, allWithinBudget };
}

function configureCharacter(debug, realmId, realmIdx, gearTier, school, petId, rng) {
  const stObj = debug.getState();
  const g = stObj.game;
  const fresh = debug.createFreshGame("评测修士", "sword_bone", 0);
  Object.keys(g).forEach(k => { delete g[k]; });
  Object.assign(g, fresh);

  g.realm = realmId;
  g.school = school;
  g.openingChoice = "help";
  g.stones = 60 + realmIdx * 120;
  g.inventory.healing_pill = 3;
  g.gourd.charges = g.gourd.maxCharges;
  g.pet = { id: realmIdx >= 1 ? petId : null, level: Math.min(5, Math.max(1, realmIdx)), skills: { tier3: null, tier5: null } };
  if (school === "sword") {
    g.loadout = { mind: realmIdx >= 1 ? "sword_pierce" : "sword_mind", builder: "sword_build", finisher: "sword_release", relic: realmIdx >= 1 ? "frost_sword" : null };
  } else {
    g.loadout = { mind: realmIdx >= 1 ? "talisman_clear" : "talisman_mind", builder: "talisman_build", finisher: "talisman_release", relic: realmIdx >= 1 ? "soul_lamp" : null };
  }
  if (g.loadout.relic) {
    g.ownedRelics = [g.loadout.relic];
    g.relicStars[g.loadout.relic] = Math.min(4, Math.max(1, Math.ceil(realmIdx * 0.7)));
  }

  const { equipped, allWithinBudget } = buildGearLoadout(debug, realmIdx, gearTier, rng);
  g.equippedGear = equipped;

  // Assign realm-appropriate Dao Laws only for median/strong mid-late builds
  g.laws = [];
  if (realmIdx >= 2 && gearTier !== "entry") g.laws.push("crit_lotus");
  if (realmIdx >= 3 && gearTier === "strong") g.laws.push("stagger_surge", "wealth_power");

  const stats = debug.getCombatStats(g);
  g.hp = stats.maxHp;
  g.mp = stats.maxMp;
  return { g, stats, allWithinBudget };
}

function setupEncounter(debug, realmIdx, archetype) {
  // Cleanly clear any cutscene/modal/pause tokens left over from the previous scenario
  debug.enterSanctumHub({ skipSave: true });
  debug.closeModal();
  (debug.getPauseTokens ? debug.getPauseTokens() : []).forEach(tk => debug.releasePauseToken(tk.id));

  const { arena, game } = debug.getState();
  const stageIdx = Math.min(4, realmIdx);
  const act = debug.CAMPAIGN_ACTS[stageIdx] || debug.CAMPAIGN_ACTS[0];
  const mult = debug.STAGE_SCALING[stageIdx] || 1.0;

  arena.stageIdx = stageIdx;
  arena.sanctumMode = false;
  arena.towerMode = false;
  arena.bossRush = null;
  arena.dungeonMap = null;
  arena.cloudFlight = null;
  arena.sectDefense = null;
  arena.celestialSpire = null;
  arena.tribulation = null;
  arena.defeatPending = null;
  arena.paused = false;
  arena.hitStop = 0;
  arena.enemies = [];
  arena.projectiles = [];
  arena.drops = [];
  arena.props = [];
  arena.zones = [];
  arena.slashes = [];
  arena.shockRings = [];
  arena.bossBeams = [];
  arena.groundSweeps = [];
  arena.comboCount = 0;
  arena.styleScore = 0;
  arena.swordIntent = 0;
  arena.weaponPosture = "qinglian";
  arena.reversedDomainTimer = 0;
  arena.domain = null;
  arena.dmgBreakdown = { combo_morph: 0, flying_swords: 0, thunder_elem: 0, ally_pet: 0, deflect_ult: 0 };
  arena.player.x = 640;
  arena.player.y = 480;
  arena.player.invuln = 0;
  arena.player.shieldHp = 0;
  arena.player.slashCd = 0;
  arena.player.dashCd = 0;
  arena.player.recallCd = 0;
  arena.player.ultCd = 0;
  arena.player.comboStep = 0;
  arena.player.comboWindow = 0;
  arena.morphCd = 0;
  debug.resetEncounterTelemetry();

  const cx = 740;
  const cy = 480;
  if (archetype === "mob_pack") {
    debug.spawnEnemyPack(act.waves[0], cx, cy, 40, mult, false);
  } else if (archetype === "mixed_squad") {
    debug.spawnEnemyPack(act.waves[2] || act.waves[0], cx, cy, 50, mult, true);
  } else if (archetype === "shielded_elite") {
    const eliteId = act.stageIdx >= 3 ? "sentinel" : "warden";
    debug.spawnSingleEnemy(eliteId, cx, cy, mult * 1.45, false, `护盾精英·${act.actLabel}`);
    if (arena.enemies[0]) {
      arena.enemies[0].wardHp = Math.max(arena.enemies[0].wardHp || 0, Math.round(arena.enemies[0].maxPosture * 0.8));
      arena.enemies[0].maxWardHp = arena.enemies[0].wardHp;
    }
  } else if (archetype === "stage_boss") {
    debug.spawnSingleEnemy(act.boss, cx, cy, mult, true, act.bossName);
  } else if (archetype === "tribulation_pressure") {
    const tribId = act.stageIdx >= 3 ? "trial_thunder" : "warden";
    debug.spawnSingleEnemy(tribId, cx, cy, mult * 1.6, false, `天劫心魔·${debug.REALMS[game.realm].name}`);
  }

  // Place enemies close enough for melee/skill engagement from tick 0
  arena.enemies.forEach((e, idx) => {
    e.x = arena.player.x + 88 + (idx % 3) * 26;
    e.y = arena.player.y + ((idx % 2) === 0 ? -18 : 18);
  });

  const initialEnemyHp = arena.enemies.reduce((s, e) => s + Math.max(0, e.hp), 0);
  const sampleHeavy = arena.enemies.reduce((m, e) => Math.max(m, e.heavy || e.atk || 16), 16);
  return { initialEnemyHp, enemyCount: arena.enemies.length, sampleHeavy };
}

function simulateScenario(debug, { realmId, realmIdx, gearTier, school, petId, strategy, archetype }, rng, aimPointer) {
  const { g, stats, allWithinBudget } = configureCharacter(debug, realmId, realmIdx, gearTier, school, petId, rng);
  const { initialEnemyHp, enemyCount, sampleHeavy } = setupEncounter(debug, realmIdx, archetype);
  const { arena } = debug.getState();

  // Compute exact heavy hits survivable using actual hurtPlayer DR/single-hit-cap rules
  const drMult = Math.max(0.35, 100 / (100 + Math.max(0, stats.dmgReduce || 0)));
  const rawHeavyDmg = Math.max(4, Math.round(sampleHeavy * drMult));
  const cappedHeavyDmg = Math.min(rawHeavyDmg, Math.max(4, Math.round(stats.maxHp * debug.SINGLE_HIT_CAP_RATIO)));
  const heavyHitsSurvivable = Number((stats.maxHp / Math.max(1, cappedHeavyDmg)).toFixed(2));

  const dt = 0.05; // 20 Hz fixed step
  const maxSimSec = strategy === "afk" ? 20 : (archetype === "stage_boss" ? 90 : 45);
  let elapsed = 0;
  let actionsTaken = 0;
  let dodgeAttempts = 0;
  let skillCasts = 0;

  while (elapsed < maxSimSec && arena.enemies.length > 0 && g.hp > 0 && !arena.defeatPending) {
    // Prioritize boss phase-2 ward pylons just like a real player, then nearest living enemy
    const target = (arena.props && arena.props.find(pr => pr.kind === "ward_pylon" && pr.hp > 0)) || arena.enemies[0];
    if (target) {
      aimPointer(target.x, target.y);
      const dx = target.x - arena.player.x;
      const dy = target.y - arena.player.y;
      const dist = Math.hypot(dx, dy);
      if (strategy !== "afk" && dist > 105) {
        const stepMove = Math.min(dist - 82, stats.speed * 58 * dt);
        arena.player.x += (dx / Math.max(1, dist)) * stepMove;
        arena.player.y += (dy / Math.max(1, dist)) * stepMove;
      }
      arena.player.facing = dx >= 0 ? 1 : -1;
    }

    // Strategy driver calling actual game actions
    if (strategy !== "afk") {
      // Heal when below 42% HP if strategy uses survival loop
      if (strategy === "full_school_loop" && g.hp > 0 && g.hp <= stats.maxHp * 0.42) {
        if ((g.gourd && g.gourd.charges > 0) || (g.inventory && g.inventory.healing_pill > 0)) {
          debug.useQuickHealingPill();
        }
      }

      // React to enemy windup in combo_detonate / full_school_loop
      const imminent = arena.enemies.some(e => e.state === "windup" && e.timer <= 0.24);
      if (imminent && (strategy === "combo_detonate" || strategy === "full_school_loop") && (arena.player.dashCd || 0) <= 0) {
        debug.triggerDashParry();
        dodgeAttempts += 1;
      }

      // Full school loop: cast pet ultimate when ready & MP/mark detonation rhythm
      if (strategy === "full_school_loop" && g.pet && g.pet.id && (arena.petUltCd || 0) <= 0) {
        debug.castPetUltimate();
        skillCasts += 1;
      }

      const totalMarks = arena.enemies.reduce((s, e) => s + (e.swordMarks || 0), 0);
      const wantDetonate = (strategy === "combo_detonate" || strategy === "full_school_loop")
        && (arena.player.recallCd || 0) <= 0
        && (totalMarks >= (school === "talisman" ? 2 : 3) || (arena.player.comboWindow > 0.3 && (arena.morphCd || 0) <= 0));

      if (wantDetonate) {
        debug.recallAndDetonateSwords();
        actionsTaken += 1;
      } else if ((arena.player.slashCd || 0) <= 0) {
        debug.fireManualSlash();
        actionsTaken += 1;
      }
    }

    debug.stepArena(dt);
    elapsed += dt;
  }

  const tel = debug.getEncounterTelemetry();
  const won = arena.enemies.length === 0 && g.hp > 0 && !arena.defeatPending;
  const remainingEnemyHp = arena.enemies.reduce((s, e) => s + Math.max(0, e.hp), 0);

  return {
    realm: realmId,
    gearTier,
    school,
    pet: g.pet.id || "none",
    strategy,
    archetype,
    enemyCount,
    initialEnemyHp,
    stats: {
      atk: stats.atk,
      maxHp: stats.maxHp,
      dmgReduce: stats.dmgReduce,
      crit: Number(stats.crit.toFixed(3)),
      critMult: Number(stats.critMult.toFixed(3)),
      atkHaste: Number(stats.atkHaste.toFixed(3)),
      statBreakdown: stats.statBreakdown
    },
    gearWithinBudget: allWithinBudget,
    won,
    ttkSec: Number(elapsed.toFixed(2)),
    playerHpPct: Number((Math.max(0, g.hp) / Math.max(1, stats.maxHp)).toFixed(3)),
    remainingEnemyHpPct: Number((remainingEnemyHp / Math.max(1, initialEnemyHp)).toFixed(3)),
    hitsTaken: tel ? tel.hitsTaken : 0,
    healsUsed: tel ? ((tel.healsUsed || 0) + (tel.gourdUsed || 0)) : 0,
    parries: tel ? (tel.parryCount || 0) : 0,
    actionsTaken,
    dodgeAttempts,
    skillCasts,
    heavyHitsSurvivable,
    dmgBreakdown: Object.assign({}, arena.dmgBreakdown)
  };
}

function median(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Number(((s[mid - 1] + s[mid]) / 2).toFixed(2));
}

function runMatrix(opts) {
  const { debug, rng, aimPointer } = loadPlayableEngine(opts.seed);
  const realms = ["mortal", "qi", "foundation", "golden", "nascent", "spirit"];
  const schools = ["sword", "talisman"];
  const results = [];

  // Core matrix: 6 realms x 2 schools x median gear x (mob_pack, shielded_elite, stage_boss) with full_school_loop
  // Plus entry & strong gear comparisons and strategy sensitivity (afk, basic_lmb, combo_detonate, full_school_loop)
  realms.forEach((realmId, realmIdx) => {
    const petCycle = ["fox", "turtle", "roc", "sword_spirit"];
    const petId = petCycle[realmIdx % petCycle.length];

    for (const school of schools) {
      // Standard median build across 3 key archetypes
      for (const archetype of ["mob_pack", "shielded_elite", "stage_boss"]) {
        results.push(simulateScenario(debug, {
          realmId, realmIdx, gearTier: "median", school, petId, strategy: "full_school_loop", archetype
        }, rng, aimPointer));
      }
      // Entry vs Strong gear on stage_boss
      for (const gearTier of ["entry", "strong"]) {
        results.push(simulateScenario(debug, {
          realmId, realmIdx, gearTier, school, petId, strategy: "full_school_loop", archetype: "stage_boss"
        }, rng, aimPointer));
      }
    }

    // Strategy sensitivity & extra encounter archetypes (mixed_squad, tribulation_pressure) on sword school
    for (const strategy of ["afk", "basic_lmb", "combo_detonate"]) {
      results.push(simulateScenario(debug, {
        realmId, realmIdx, gearTier: "median", school: "sword", petId, strategy, archetype: "mixed_squad"
      }, rng, aimPointer));
    }
    results.push(simulateScenario(debug, {
      realmId, realmIdx, gearTier: "median", school: "talisman", petId, strategy: "full_school_loop", archetype: "tribulation_pressure"
    }, rng, aimPointer));
  });

  // Compute aggregate summaries
  const activeBossRuns = results.filter(r => r.archetype === "stage_boss" && r.strategy === "full_school_loop");
  const activeMobRuns = results.filter(r => r.archetype === "mob_pack" && r.strategy === "full_school_loop");
  const afkRuns = results.filter(r => r.strategy === "afk");
  const swordMedianBoss = activeBossRuns.filter(r => r.school === "sword" && r.gearTier === "median");
  const talismanMedianBoss = activeBossRuns.filter(r => r.school === "talisman" && r.gearTier === "median");
  const allGearBudgetOk = results.every(r => r.gearWithinBudget);

  const report = {
    meta: {
      tool: "scripts/eval-combat-matrix.mjs",
      commit: getCommitHash(),
      seed: opts.seed,
      generatedAt: new Date().toISOString(),
      realmsEvaluated: realms,
      schoolsEvaluated: schools,
      totalScenarios: results.length,
      configSnapshot: {
        passiveSoftCapKnee: debug.COMBAT_RULE_PARAMS.passiveSoftCapKnee,
        passiveSoftCapMax: debug.COMBAT_RULE_PARAMS.passiveSoftCapMax,
        activeMultCap: debug.COMBAT_RULE_PARAMS.activeMultCap,
        singleHitCapRatio: debug.SINGLE_HIT_CAP_RATIO,
        stageScaling: debug.STAGE_SCALING,
        gearEnhanceStepPct: debug.GEAR_ENHANCE_STEP_PCT
      }
    },
    summary: {
      allGearBudgetOk,
      mobMedianTtkSec: median(activeMobRuns.map(r => r.ttkSec)),
      bossMedianTtkSec: median(activeBossRuns.map(r => r.ttkSec)),
      bossWinRate: Number((activeBossRuns.filter(r => r.won).length / Math.max(1, activeBossRuns.length)).toFixed(3)),
      swordMedianBossTtkSec: median(swordMedianBoss.map(r => r.ttkSec)),
      talismanMedianBossTtkSec: median(talismanMedianBoss.map(r => r.ttkSec)),
      minHeavyHitsSurvivable: Math.min(...activeBossRuns.map(r => r.heavyHitsSurvivable)),
      afkZeroWins: afkRuns.every(r => !r.won),
      outliers: results
        .filter(r => r.strategy === "full_school_loop" && (!r.won || r.ttkSec > 110 || r.heavyHitsSurvivable < 2.2))
        .map(r => ({ realm: r.realm, gearTier: r.gearTier, school: r.school, archetype: r.archetype, won: r.won, ttkSec: r.ttkSec, heavyHitsSurvivable: r.heavyHitsSurvivable }))
    },
    scenarios: results
  };
  return report;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const opts = parseArgs(process.argv.slice(2));
  const report = runMatrix(opts);
  const text = JSON.stringify(report, null, opts.pretty ? 2 : 0);
  if (opts.outFile) {
    fs.mkdirSync(path.dirname(path.resolve(opts.outFile)), { recursive: true });
    fs.writeFileSync(opts.outFile, text + "\n", "utf8");
    console.log(`Wrote combat matrix (${report.meta.totalScenarios} scenarios) to ${opts.outFile}`);
  } else {
    console.log(JSON.stringify({ meta: report.meta, summary: report.summary }, null, 2));
  }
  if (!report.summary.allGearBudgetOk) {
    console.error("FAIL: Generated gear violated GEAR_BUDGET_BY_RARITY");
    process.exit(1);
  }
}
