// Pure realm progression, item catalog, alchemy recipes, gear templates, and affix/pact tables.
import { COMBAT_RULE_PARAMS } from "./combat-params.mjs";

export const CELESTIAL_OMENS = [
  { id: "tide", name: "灵潮涌动", short: "吐纳+45%", desc: "天地灵脉潮汐暴涨，洞府吐纳与闭关修为收益 +45%！" },
  { id: "alchemy_star", name: "紫微临丹", short: "仙品丹率大增", desc: "紫微星垂照丹庐，控火黄金温区拓宽 +10%，成丹额外获丹香修为！" },
  { id: "harvest", name: "百草丰年", short: "采集产出+1", desc: "山川灵粹盎然，所有灵脉采集、宗门委托与秘境药谷材料产出 +1！" },
  {
    id: "wolf_star",
    name: "贪狼破军",
    short: `暴击+${Math.round(COMBAT_RULE_PARAMS.omens.wolf_star.crit * 100)}%·战利+${Math.round((COMBAT_RULE_PARAMS.omens.wolf_star.stoneMult - 1) * 100)}%`,
    desc: `杀伐星动，全招式暴击率 +${Math.round(COMBAT_RULE_PARAMS.omens.wolf_star.crit * 100)}%（总暴击上限 ${Math.round(COMBAT_RULE_PARAMS.critCap * 100)}%），除妖与镇妖塔灵石收益 +${Math.round((COMBAT_RULE_PARAMS.omens.wolf_star.stoneMult - 1) * 100)}%！`
  },
  { id: "fair", name: "万宝云集", short: "坊市8折·赌玉翻倍", desc: "九州商帮齐聚云岚坊市，采买 8 折优惠，古玉鉴宝切出仙髓率翻倍！" }
];

export const REALM_ORDER = ["mortal", "qi", "foundation", "golden", "nascent", "spirit", "ascended"];

export const REALMS = {
  mortal:     { id: "mortal", name: "凡人", xpCap: 60, maxHp: 65, maxMp: 28, lifespanMonths: 744, power: 0, next: "qi", pill: null },
  qi:         { id: "qi", name: "炼气", xpCap: 400, maxHp: 120, maxMp: 68, lifespanMonths: 1140, power: 6, next: "foundation", pill: "foundation_pill" },
  foundation: { id: "foundation", name: "筑基", xpCap: 1300, maxHp: 205, maxMp: 110, lifespanMonths: 1800, power: 15, next: "golden", pill: "golden_pill" },
  golden:     { id: "golden", name: "金丹", xpCap: 3300, maxHp: 325, maxMp: 160, lifespanMonths: 2880, power: 28, next: "nascent", pill: "nascent_pill" },
  nascent:    { id: "nascent", name: "元婴", xpCap: 7400, maxHp: 480, maxMp: 225, lifespanMonths: 4560, power: 45, next: "spirit", pill: "spirit_seed" },
  spirit:     { id: "spirit", name: "化神", xpCap: 14500, maxHp: 680, maxMp: 310, lifespanMonths: 6720, power: 66, next: null, pill: "ascension_seal" },
  ascended:   { id: "ascended", name: "飞升真仙", xpCap: 0, maxHp: 850, maxMp: 380, lifespanMonths: 99999, power: 95, next: null, pill: null }
};

export const ITEMS = {
  herb:            { id: "herb", name: "凝气草", min: "qi", buy: 6, sell: 3, kind: "material", art: "item_herb", desc: "山野灵草，炼丹与培育本命灵兽的基础灵材。" },
  dew:             { id: "dew", name: "晨曦灵露", min: "qi", buy: 12, sell: 5, kind: "material", art: "item_dew", desc: "破晓松针凝露，调和丹火躁性。" },
  core:            { id: "core", name: "妖核", min: "qi", buy: 48, sell: 18, kind: "material", art: "item_core", desc: "斩杀妖兽所得，可炼制破境丹或淬炼法宝升星。" },
  jade:            { id: "jade", name: "地脉灵玉", min: "foundation", buy: 46, sell: 16, kind: "material", art: "item_jade", desc: "照影古境灵脉所产，凝金丹与铸造法宝核心灵材。" },
  lotus:           { id: "lotus", name: "月华莲", min: "golden", buy: 68, sell: 24, kind: "material", art: "item_lotus", desc: "古境寒池绽放，炼制结婴丹与照魂灯珍材。" },
  soul:            { id: "soul", name: "凝魂晶", min: "nascent", buy: 95, sell: 34, kind: "material", art: "item_soul", desc: "静潭凝结的魂力结晶，化神与渡劫引必备。" },
  dao:             { id: "dao", name: "道蕴砂", min: "spirit", buy: 135, sell: 46, kind: "material", art: "item_dao", desc: "登仙台法则碎砂，炼制渡劫引的至高材料。" },
  healing_pill:    { id: "healing_pill", name: "回春丹", min: "mortal", buy: 18, sell: 7, kind: "medicine", art: "item_healing_pill", desc: "立即恢复 46% 最大气血，道心垂危时可主动服丹重燃战意（悟【丹火不息】后额外引发丹火震爆）。" },
  spirit_pill:     { id: "spirit_pill", name: "回灵丹", min: "qi", buy: 18, sell: 7, kind: "medicine", art: "item_spirit_pill", desc: "立即回满剑元并刷新爆剑、一闪、法宝与助阵冷却。" },
  longevity_pill:  { id: "longevity_pill", name: "延寿青莲丹", min: "qi", buy: 120, sell: 42, kind: "medicine", art: "item_lotus", desc: "紫微丹鼎 Lv.2 解封延寿仙丹：服用永久延寿 +30 载（+360 月）并增加 +15 气血上限，可解大限之忧。" },
  blood_fury_pill: { id: "blood_fury_pill", name: "嗜血煞丹", min: "qi", buy: 135, sell: 45, kind: "medicine", art: "item_core", desc: "赤渊黑市禁丹：服用永久剑道攻击 +10、劫煞魔心 -15，但折损 2 载寿元（慎择）。" },
  foundation_pill: { id: "foundation_pill", name: "筑基丹", min: "qi", buy: 260, sell: null, kind: "breakthrough", art: "item_foundation_pill", desc: "炼气冲关筑基护劫灵丹：渡劫仪轨携丹可获3层护脉丹障稳渡雷劫；亦可直接服用涨60%修为。" },
  golden_pill:     { id: "golden_pill", name: "凝金丹", min: "foundation", buy: 680, sell: null, kind: "breakthrough", art: "item_golden_pill", desc: "筑基凝结金丹护劫灵丹：渡劫仪轨携丹可获3层护脉丹障稳渡雷劫；亦可直接服用涨60%修为。" },
  nascent_pill:    { id: "nascent_pill", name: "结婴丹", min: "golden", buy: 1120, sell: null, kind: "breakthrough", art: "item_nascent_pill", desc: "金丹碎丹成婴护劫至宝：渡劫仪轨携丹可获3层护脉丹障稳渡雷劫；亦可直接服用涨60%修为。" },
  spirit_seed:     { id: "spirit_seed", name: "化神丹", min: "nascent", buy: 1780, sell: null, kind: "breakthrough", art: "item_spirit_seed", desc: "元婴蜕凡化神护劫核心灵丹：渡劫仪轨携丹可获3层护脉丹障稳渡雷劫；亦可直接服用涨60%修为。" },
  ascension_seal:  { id: "ascension_seal", name: "渡劫引", min: "spirit", buy: 2680, sell: null, kind: "breakthrough", art: "item_ascension_seal", desc: "化神叩开九霄仙门护劫至宝：渡劫仪轨携引可获3层护脉丹障稳渡飞升天劫。" }
};

export const RECIPES = {
  healing:     { id: "healing", name: "炼制回春丹", min: "qi", inputs: { herb: 2 }, stones: 2, months: 3, output: "healing_pill" },
  spirit:      { id: "spirit", name: "炼制回灵丹", min: "qi", inputs: { herb: 1, dew: 1 }, stones: 3, months: 3, output: "spirit_pill" },
  longevity:   { id: "longevity", name: "炼制延寿青莲丹", min: "qi", reqCauldronLv: 2, inputs: { herb: 3, dew: 2, lotus: 1 }, stones: 65, months: 6, output: "longevity_pill" },
  foundation:  { id: "foundation", name: "炼制筑基丹", min: "qi", inputs: { herb: 2, dew: 3, core: 2 }, stones: 20, months: 6, output: "foundation_pill" },
  golden:      { id: "golden", name: "炼制凝金丹", min: "foundation", inputs: { core: 3, jade: 4, lotus: 1 }, stones: 55, months: 10, output: "golden_pill" },
  nascent:     { id: "nascent", name: "炼制结婴丹", min: "golden", inputs: { jade: 3, lotus: 4, soul: 1 }, stones: 105, months: 14, output: "nascent_pill" },
  spirit_seed: { id: "spirit_seed", name: "炼制化神丹", min: "nascent", inputs: { soul: 5, dao: 2 }, stones: 170, months: 18, output: "spirit_seed" },
  ascension:   { id: "ascension", name: "炼制渡劫引", min: "spirit", inputs: { soul: 4, dao: 5 }, stones: 240, months: 24, output: "ascension_seal" }
};

export const RARITIES = [
  { tier: 0, name: "凡品", color: "#d0ddd8", mult: 1.00, sell: 12 },
  { tier: 1, name: "灵品", color: "#4ad2b8", mult: 1.25, sell: 28 },
  { tier: 2, name: "玄品", color: "#63c5ff", mult: 1.55, sell: 55 },
  { tier: 3, name: "仙品", color: "#d09eff", mult: 1.90, sell: 95 },
  { tier: 4, name: "鸿蒙", color: "#ffd86b", mult: 2.35, sell: 160 },
  { tier: 5, name: "紫气鸿蒙", color: "#ff9eff", mult: 2.85, sell: 320 }
];

export const PRIMORDIAL_AWAKENINGS = {
  weapon: { id: "primordial_wave",  name: "紫气东来·万剑齐鸣", desc: "每第3剑额外迸发一道贯穿全屏的鸿蒙紫气剑罡（165%真伤）" },
  armor:  { id: "primordial_aegis", name: "混元紫气·不灭道体", desc: "受重击(≥14%最大气血)时自动凝结 25% 气血混元紫气护盾（11秒冷却）" },
  ring:   { id: "primordial_soul",  name: "周天紫微·魂印双生", desc: "C键精魄化身伤害提升 +38%，施放立即回充 +22% 无上剑意" }
};

export const GEAR_TEMPLATES = {
  weapon: [
    { baseName: "青竹灵剑", art: "icon_blade" },
    { baseName: "秋水长剑", art: "relic_frost_sword" },
    { baseName: "惊鲵古剑", art: "icon_blade" },
    { baseName: "龙渊仙剑", art: "relic_frost_sword" },
    { baseName: "太虚诛仙剑", art: "relic_frost_sword" }
  ],
  armor: [
    { baseName: "青云布衣", art: "icon_scroll" },
    { baseName: "流云法袍", art: "icon_heart" },
    { baseName: "玄武鹤氅", art: "icon_seal" },
    { baseName: "紫霞仙衣", art: "icon_heart" },
    { baseName: "混元不灭袍", art: "relic_jade_seal" }
  ],
  ring: [
    { baseName: "温玉灵佩", art: "item_jade" },
    { baseName: "凝神剑玦", art: "item_soul" },
    { baseName: "贪狼星戒", art: "relic_cloud_mirror" },
    { baseName: "阴阳太极佩", art: "relic_soul_lamp" },
    { baseName: "鸿蒙造化环", art: "item_ascension_seal" }
  ]
};

export const SACRED_AFFIXES = [
  { id: "vamp_blade",   name: "噬灵剑魄", buildTags: ["御剑推荐", "生存推荐"], desc: "每第 3 次剑气命中回复 1.5% 最大气血（至少 2 点）" },
  { id: "posture_crush",name: "破岳重锋", buildTags: ["御剑推荐"],             desc: "削减妖兽白金架势效率 +30%" },
  { id: "sky_thunder",  name: "紫电惊雷", buildTags: ["雷符推荐"],             desc: "每第 4 次轻剑攻击必定引落九霄紫雷（42% 剑攻）" },
  { id: "wind_rider",   name: "御风剑意", buildTags: ["御剑推荐", "雷符推荐"], desc: "移动与飞剑攻速额外 +10%" },
  { id: "greed_wolf",   name: "贪狼聚宝", buildTags: ["生存推荐"],             desc: "斩妖灵石收益额外 +35%" },
  { id: "xuanwu_ward",  name: "玄武护心", buildTags: ["生存推荐"],             desc: "所受妖兽伤害额外减免 14%" }
];

export const PACT_SEALS = [
  { id: "frenzy_hp",   name: "凶煞狂血", badge: "劫印·壹", desc: "群妖气血与攻击 +25%" },
  { id: "swift_windup",name: "疾影破阵", badge: "劫印·贰", desc: "妖兽蓄势提速 +20%" },
  { id: "iron_posture",name: "镇岳金身", badge: "劫印·叁", desc: "首领架势上限 +35%" },
  { id: "bitter_pill", name: "丹火受限", badge: "劫印·肆", desc: "灵丹回血效果 -20%" },
  { id: "blood_moon",  name: "九幽血月", badge: "劫印·伍", desc: "首领直接觉醒二阶狂暴" }
];
