// Pure Q6 (F34-F36) campaign guide, Vol 5 resonance, high-tier mode registry, and cross-system synergy rules.
import { num, hasOwn } from "./utils.mjs";
import { REALM_ORDER, REALMS } from "../config/realms-items.mjs";
import { RELICS } from "../config/progression-data.mjs";

export const VOLUME_CAMPAIGN_GUIDE = [
  {
    volIndex: 1,
    volLabel: "第一卷",
    title: "山雨初鸣 · 青岚破庙",
    stageIdx: 0,
    realmSpan: "凡人 → 炼气",
    goalSummary: "破庙拔剑救下沈清禾，整备丹药神兵，斩破【雾隐狼王】并完成首次紫霄雷劫引气入道。",
    enemyExam: {
      bossId: "wolf",
      bossName: "雾隐狼王",
      telegraph: "金光直线疾冲（可识破）与红光血月三连爪（不可硬拼）",
      counter: "金光临身按【空格一闪】识破弹反；红光扇爪侧闪触发凝时",
      punishWindow: "弹反破势或扑击收招僵直期接四段剑舞＋右键爆剑"
    },
    growthPayoff: "解锁听雨洞府、炼气境界、三才剑阵(Y)/御空(Z)/剑域(E)与灵宠契约。",
    companionIds: ["shen"],
    companionPrompt: "破庙初逢沈清禾，择青莲灵契或惊鸿剑诀并结下药庐之约。",
    optionalRouteNote: "D01 基线：洞府演武与灵草采炼为推荐整备，不设炼丹硬门槛。"
  },
  {
    volIndex: 2,
    volLabel: "第二卷",
    title: "洞府开炉 · 青云外门",
    stageIdx: 1,
    realmSpan: "炼气 → 筑基",
    goalSummary: "于青云外门五层分支星图择路推进，破除失控【守山石卫】护山金阵，筑基铸道。",
    enemyExam: {
      bossId: "warden",
      bossName: "守山石卫",
      telegraph: "琥珀蓄力重锤震地（椭圆危区）与下段地脉裂波",
      counter: "重劈/爆剑/一闪削碎护山金盾；下段裂波按【Z 键御空】踏剑跃破",
      punishWindow: "重锤砸地后的长收招窗口与破盾失衡期倾泻剑域爆发"
    },
    growthPayoff: "解封双剑意姿态(`)、镇妖魂印(C)、道侣瞬切(V)与护山大阵守卫战。",
    companionIds: ["lu"],
    companionPrompt: "拜会传功执事陆玄松《执事问道》，开启山门钟声助阵与后续传功线。",
    optionalRouteNote: "D01 基线：本命灵宠、八卦丹剑与锁妖古塔为推荐成长路线，筑基丹稳渡或无丹强渡皆可。"
  },
  {
    volIndex: 3,
    volLabel: "第三卷",
    title: "寒潭镜心 · 照影问剑",
    stageIdx: 2,
    realmSpan: "筑基 → 金丹",
    goalSummary: "踏破照影寒潭，破解【寒潭玄蛇】极寒冰域与连环霜弹，凝结金丹并启星海之门。",
    enemyExam: {
      bossId: "serpent",
      bossName: "寒潭玄蛇",
      telegraph: "幽蓝吐息扇形霜弹齐射与落点极寒霜池（半血狂化增频）",
      counter: "切【Y 键剑轮阵】斩碎霜弹弹幕；斜向疾闪脱离霜池减速区",
      punishWindow: "吐息收势回盘瞬间贴身叠印，配合【C 键魂印】或爆剑击空架势"
    },
    growthPayoff: "解封金丹期九霄云海空战、周天二十八星图(N)、山海灵骑(J)、奇门阵盘(U)与天时/双人同游。",
    companionIds: ["shen", "pei", "yan"],
    companionPrompt: "重逢沈清禾、山门论剑裴照、初识守碑人砚尘，三条故人线在此汇聚。",
    optionalRouteNote: "D01 基线：护山大阵与魂印收集可显著降低寒潭压力，不构成主线硬锁。"
  },
  {
    volIndex: 4,
    volLabel: "第四卷",
    title: "古冢剑魄 · 铸器启星",
    stageIdx: 3,
    realmSpan: "金丹 → 元婴",
    goalSummary: "深入古修剑冢铸炼本命法宝，识破【古境剑傀】铜镜反震并碎丹成婴。",
    enemyExam: {
      bossId: "puppet",
      bossName: "古境剑傀",
      telegraph: "铜镜反震架势（反弹直劈）与四向十字剑波危招",
      counter: "见铜镜浮空改用【空格一闪】或【右键爆剑】正面碎镜反噬；斜角躲十字剑波",
      punishWindow: "碎镜反震触发的长时间破防硬直，接六象特技与法宝剑域"
    },
    growthPayoff: "解封元婴期一气化三清(4)、法天象地(O)、灵脉远征(8)、太虚登仙台(L)与万剑冢七阵。",
    companionIds: ["pei", "lu"],
    companionPrompt: "与裴照古境重逢采月华莲、随陆玄松传功堂授业，厚积红尘道韵。",
    optionalRouteNote: "D01 基线：九霄云海空战首破可获【破云证道印】永久增益，属推荐进阶试炼。"
  },
  {
    volIndex: 5,
    volLabel: "第五卷",
    title: "法则共鸣 · 元神试剑",
    stageIdx: 4,
    realmSpan: "元婴 → 化神",
    goalSummary: "聚拢四门大道法则或将本命法宝淬炼至 ★3，借诸天试炼共鸣磨砺元神，破境化神（D01/D04 保守基线，不增硬锁）。",
    enemyExam: {
      bossId: "trial_gate",
      bossName: "天门道影 · 先遣试剑",
      telegraph: "九霄落雷锁点圈（精准圈定脚下）与护山金阵压制",
      counter: "落雷红圈缩紧瞬间一闪脱出并反击；联动三清/法天象地破除金阵",
      punishWindow: "天雷落空与金阵崩裂后的 3 秒元神破势窗口"
    },
    growthPayoff: "参悟法则羁绊、激活诸天六柱道果共鸣，化神后解封山河社稷图(5)、凌霄仙舟(6)与天道劫印。",
    companionIds: ["shen", "yan"],
    companionPrompt: "赴听雨洞府立《一诺千山》药阵盟约，于照影古镜完成《照见本心》本心之问。",
    optionalRouteNote: "D01/D04 保守基线：化神丹稳渡与无丹逆天强渡皆可晋升化神；不强迫清空全部侧边模式。"
  },
  {
    volIndex: 6,
    volLabel: "第六卷",
    title: "九霄天门 · 剑开天门",
    stageIdx: 4,
    realmSpan: "化神 → 白日飞升",
    goalSummary: "整备鸿蒙神装与故人同心盟契，于九霄星盘亲手斩碎【天门道影】，引动终极飞升天劫择定三大结局。",
    enemyExam: {
      bossId: "trial_gate",
      bossName: "天门道影",
      telegraph: "九霄天雷点名、暗金夺命投技（擒）与全屏旋空妖光",
      counter: "【擒】字亮起迎击拼刀/易剑/魂印反制；落雷与旋空光以一闪凝时穿波",
      punishWindow: "拼刀胜出与破阵失衡期，全开剑域＋道侣合璧＋化神神通终结"
    },
    growthPayoff: "白日飞升铭刻【九世轮回殿】，解锁劫火周目、轮回先天命格与外显剑意幻化。",
    companionIds: ["pei", "lu", "yan"],
    companionPrompt: "与裴照云台相约、陆玄松山门送别、砚尘天门赠砂，四位故人齐证终局。",
    optionalRouteNote: "D01/D04 保守基线：天道劫印与造化种子工坊为终局高难挑战，不阻挡正常飞升。"
  }
];

export const VOL5_RESONANCE_PILLARS = [
  {
    id: "cloud_sea",
    name: "九霄云海",
    short: "破云印",
    sysId: "cloud_sea_trial",
    minRealm: "golden",
    actionId: "start_cloud_sea",
    summary: "破开巡天雷鹏防线，激活远征/登仙台 +15% 收益",
    check: (g) => {
      const active = Boolean(g && g.cloudSeaCleared);
      return { active, progressText: active ? "已破阵 ✓" : "待破阵" };
    }
  },
  {
    id: "star_chart",
    name: "周天星图",
    short: "四象星魂",
    sysId: "star_chart",
    minRealm: "golden",
    actionId: "open_star_chart",
    summary: "至少点亮 4 枚星宿激活首座四象星魂",
    check: (g) => {
      const cnt = Array.isArray(g && g.litStars) ? g.litStars.length : 0;
      return { active: cnt >= 4, progressText: `${cnt}/4 宿` };
    }
  },
  {
    id: "vein_expedition",
    name: "灵脉远征",
    short: "驻防雷援",
    sysId: "vein_expedition",
    minRealm: "nascent",
    actionId: "open_expedition",
    summary: "委派至少 1 位已结缘故人驻防九州灵脉",
    check: (g) => {
      const asgn = (g && g.expeditions && g.expeditions.assignments && typeof g.expeditions.assignments === "object")
        ? Object.values(g.expeditions.assignments).filter(Boolean).length
        : 0;
      return { active: asgn >= 1, progressText: `${asgn}/5 脉` };
    }
  },
  {
    id: "celestial_spire",
    name: "太虚登仙台",
    short: "九重奇物",
    sysId: "celestial_spire",
    minRealm: "nascent",
    actionId: "open_spire",
    summary: "于登仙台正式登临至少第 3 重天铭刻奇物",
    check: (g) => {
      const fl = Math.max(0, Math.floor(num(g && g.bestSpireFloor, 0)));
      return { active: fl >= 3, progressText: `${fl}/3 重` };
    }
  },
  {
    id: "sword_tomb_rush",
    name: "万剑冢七阵",
    short: "剑冢评级",
    sysId: "sword_tomb_rush",
    minRealm: "nascent",
    actionId: "open_boss_rush",
    summary: "完整通关万剑冢七阵取得正式评级",
    check: (g) => {
      const grade = (g && typeof g.rushBestGrade === "string") ? g.rushBestGrade.trim() : "";
      const active = Boolean((grade && grade !== "未挑战") || (g && g.taixuTrailUnlocked));
      return { active, progressText: active ? (grade || "已证剑尊") : "待通七阵" };
    }
  },
  {
    id: "sect_defense",
    name: "护山大阵",
    short: "护宗功勋",
    sysId: "sect_defense",
    minRealm: "foundation",
    actionId: "start_sect_defense",
    summary: "击退三波百鬼夜行取得护宗功勋",
    check: (g) => {
      const m = Math.max(0, Math.floor(num(g && g.sectMerits, 0)));
      return { active: m >= 1, progressText: m >= 1 ? `功勋 ×${m}` : "待守阵" };
    }
  }
];

export const HIGH_TIER_MODE_REGISTRY = [
  {
    groupId: "mainline_embedded",
    groupTitle: "主线内嵌 · 随境核心成长",
    badge: "主线常驻",
    desc: "直接嵌入六卷战斗与洞府循环的核心能力与养成支柱。",
    items: [
      { id: "spirit_pet",    name: "本命灵宠",     minRealm: "qi",         kind: "eco",    synergy: "随行协同＋Lv.3/5 择技化形" },
      { id: "bagua_alchemy", name: "八卦丹剑微操", minRealm: "qi",         kind: "eco",    synergy: "控火成丹与神兵淬火（D01 可选强化）" },
      { id: "dual_stance",   name: "双剑意姿态",   minRealm: "foundation", kind: "eco",    synergy: "` 键疾剑/玄重瞬切与易剑斩" },
      { id: "soul_seal",     name: "镇妖魂印",     minRealm: "foundation", kind: "eco",    synergy: "C 键化妖取消后摇＋五行联动" },
      { id: "tag_team",      name: "道侣瞬切换人", minRealm: "foundation", kind: "eco",    synergy: "V 键净厄换人＋双人同心合璧" },
      { id: "star_chart",    name: "太虚周天星图", minRealm: "golden",     kind: "eco",    synergy: "N 键二十八星宿（极夜星河 ×2.0）" }
    ]
  },
  {
    groupId: "endgame_trials",
    groupTitle: "终局试炼 · 跨系统共鸣挑战",
    badge: "试炼共鸣",
    desc: "驱动诸天六柱道果共鸣与高阶资源循环的专项试炼模式。",
    items: [
      { id: "demon_tower",     name: "太虚锁妖古塔",   minRealm: "qi",         kind: "eco", synergy: "无尽冲层检验构筑与灵石产出" },
      { id: "sect_defense",    name: "护山大阵守卫",   minRealm: "foundation", kind: "eco", synergy: "三波护宗战→星魂点与诸天共鸣" },
      { id: "cloud_sea_trial", name: "九霄云海空战",   minRealm: "golden",     kind: "eco", synergy: "破云证道印→远征与登仙台 +15%" },
      { id: "vein_expedition", name: "九州灵脉远征",   minRealm: "nascent",    kind: "eco", synergy: "8 键驻防（通关+15%/三星+30% 秘境共鸣）" },
      { id: "celestial_spire", name: "太虚登仙台",     minRealm: "nascent",    kind: "eco", synergy: "L 键九重肉鸽奇物（吃破云印 +15%）" },
      { id: "sword_tomb_rush", name: "万剑冢七阵连战", minRealm: "nascent",    kind: "eco", synergy: "七阵强化首领＋心魔镜像＋太古烛龙" },
      { id: "heavenly_pacts",  name: "天道劫印契约",   minRealm: "spirit",     kind: "eco", synergy: "五道巅峰劫印换取爆率与仙榜倍率" }
    ]
  },
  {
    groupId: "dojo_tools",
    groupTitle: "演武与工具 · 沙盒/同游/构筑",
    badge: "工具演武",
    desc: "不污染正式主线难度的自定义试剑、联机同游、天时调度与连招编排。",
    items: [
      { id: "celestial_time", name: "太虚四相天时 (\\)",  minRealm: "golden", kind: "action", synergy: "金丹解封手动切换，星夜令星图 ×2.0" },
      { id: "coop_2p",        name: "双人同屏同游 (]/[)", minRealm: "golden", kind: "action", synergy: "金丹解封 2P 协战（按故人结缘扩展名单）" },
      { id: "sequencer",      name: "自创剑谱连招 (7)",   minRealm: "golden", kind: "action", synergy: "金丹解封三器混编自定义连招序" },
      { id: "seed_workshop",  name: "造化种子工坊",       minRealm: "spirit", kind: "eco",    synergy: "CY22 双王种子码试剑（临时奇物离场还原）" }
    ]
  }
];

export const EXPEDITION_NODE_STAGE_MAP = {
  qinglan_vein:  { stageIdx: 0, stageName: "青岚破庙" },
  qingyun_peak:  { stageIdx: 1, stageName: "青云外门" },
  zhaoying_lake: { stageIdx: 2, stageName: "照影寒潭" },
  suoyao_altar:  { stageIdx: 3, stageName: "古修剑冢" },
  jiuxiao_sky:   { stageIdx: 4, stageName: "九霄天门" }
};

export function getExpeditionNodeStageSynergy(g, nodeId) {
  const mapped = (nodeId && hasOwn(EXPEDITION_NODE_STAGE_MAP, nodeId))
    ? EXPEDITION_NODE_STAGE_MAP[nodeId]
    : null;
  if (!mapped) {
    return { mult: 1.0, tier: "base", label: "基础产出", stageIdx: -1, stageName: "", stars: 0 };
  }
  const idx = mapped.stageIdx;
  const rawStars = (g && g.stageStars && typeof g.stageStars === "object" && hasOwn(g.stageStars, String(idx))) ? num(g.stageStars[idx], 0) : 0;
  const stars = Math.max(0, Math.min(3, Math.floor(rawStars)));
  const bossDefeated = Boolean(g && g.defeatedStageBosses && g.defeatedStageBosses[idx]);
  if (stars >= 3) {
    return { mult: 1.30, tier: "full_star", label: `${mapped.stageName}三星共鸣 +30%`, stageIdx: idx, stageName: mapped.stageName, stars };
  }
  if (stars >= 1 || bossDefeated) {
    return { mult: 1.15, tier: "cleared", label: `${mapped.stageName}通关共鸣 +15%`, stageIdx: idx, stageName: mapped.stageName, stars };
  }
  return { mult: 1.0, tier: "base", label: `未破${mapped.stageName} · 基础产出`, stageIdx: idx, stageName: mapped.stageName, stars: 0 };
}

export function getSpireCloudSeaYieldMult(g) {
  return Boolean(g && g.cloudSeaCleared) ? 1.15 : 1.0;
}

export function computeEndgameMasteryResonance(g) {
  const gSafe = (g && typeof g === "object") ? g : {};
  const pillars = VOL5_RESONANCE_PILLARS.map((p) => {
    const res = p.check(gSafe);
    return {
      id: p.id,
      name: p.name,
      short: p.short,
      sysId: p.sysId,
      minRealm: p.minRealm,
      actionId: p.actionId,
      summary: p.summary,
      active: Boolean(res && res.active),
      progressText: (res && res.progressText) || ""
    };
  });
  const activeCount = pillars.filter(p => p.active).length;
  const passiveAtkPct = activeCount > 0 ? Number((activeCount * 0.025).toFixed(4)) : 0;
  const drBonus = activeCount > 0 ? activeCount * 2 : 0;
  const critBonus = activeCount >= 4 ? 0.03 : 0;
  const tierLabel = activeCount >= 6
    ? "六合圆满 · 诸天共鸣"
    : activeCount >= 4
      ? "四象贯通 · 道果初鸣"
      : activeCount >= 1
        ? `初启共鸣 (${activeCount}/6)`
        : "未启共鸣 (0/6)";
  return {
    activeCount,
    total: pillars.length,
    passiveAtkPct,
    drBonus,
    critBonus,
    tierLabel,
    pillars
  };
}

export function buildVol5ResonanceSnapshot(g) {
  const gSafe = (g && typeof g === "object") ? g : { realm: "mortal" };
  const realm = (typeof gSafe.realm === "string" && hasOwn(REALMS, gSafe.realm)) ? gSafe.realm : "mortal";
  const realmRank = Math.max(0, REALM_ORDER.indexOf(realm));
  const rSpec = REALMS[realm] || REALMS.mortal;
  const lawCount = Array.isArray(gSafe.laws) ? gSafe.laws.length : 0;
  const relicId = gSafe.loadout && gSafe.loadout.relic;
  const rawStars = (relicId && hasOwn(RELICS, relicId) && gSafe.relicStars && hasOwn(gSafe.relicStars, relicId))
    ? gSafe.relicStars[relicId]
    : (relicId && hasOwn(RELICS, relicId) ? 1 : 0);
  const relicStars = Math.max(0, Math.min(5, Math.floor(num(rawStars, 0))));
  const s5LawsDone = lawCount >= 4 || relicStars >= 3;
  const xp = Math.max(0, Math.floor(num(gSafe.xp, 0)));
  const xpCap = Math.max(0, Math.floor(num(rSpec.xpCap, 0)));
  const xpReady = xpCap > 0 ? xp >= xpCap : true;
  const bossGateCleared = Boolean(gSafe.defeatedStageBosses && gSafe.defeatedStageBosses[3]);
  const spiritPillCount = Math.max(0, Math.floor(num(gSafe.inventory && gSafe.inventory.spirit_seal_pill, 0)));
  const choices = (gSafe.choices && typeof gSafe.choices === "object") ? gSafe.choices : {};
  const resonance = computeEndgameMasteryResonance(gSafe);
  return {
    realm,
    realmName: rSpec.name,
    realmRank,
    isNascent: realm === "nascent",
    isSpiritOrAbove: realmRank >= 5,
    lawCount,
    lawNeed: 4,
    relicStars,
    relicNeed: 3,
    s5LawsDone,
    xp,
    xpCap,
    xpReady,
    bossGateStageIdx: 3,
    bossGateCleared,
    spiritPillCount,
    dualBreakthroughNote: "D01/D04 保守基线：化神丹稳渡（护脉丹障＋延寿）与无丹逆天强渡（一闪弹雷）皆为合法破境路线，绝不以炼丹或侧边试炼硬锁主线。",
    companionStatus: [
      { id: "shen", storyId: "shen_pact", name: "沈清禾 · 《一诺千山》", done: Boolean(choices.shen_pact) },
      { id: "yan", storyId: "yan_mirror", name: "砚尘 · 《照见本心》", done: Boolean(choices.yan_mirror) }
    ],
    resonance,
    readyForSpiritTribulation: realm === "nascent" && bossGateCleared && xpReady
  };
}
