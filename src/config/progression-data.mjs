// Pure skills, relics, Dao laws, spirit pets, destiny fruits, perks, calamity cycles, and progression tables.
import { COMBAT_RULE_PARAMS } from "./combat-params.mjs";

export const SKILLS = {
  sword_mind:    { id: "sword_mind", name: "青锋心诀", school: "sword", slot: "mind", min: "qi", price: 0, art: "icon_blade", desc: "基础剑道心法：左键四段剑舞叠剑印，右键切手派生与爆剑破除敌方架势。" },
  sword_still:   { id: "sword_still", name: "止水剑心", school: "sword", slot: "mind", min: "foundation", price: 95, art: "icon_heart", desc: `【稳守流】装备于心法槽时生效：周天吐纳与修为获取 +${Math.round((COMBAT_RULE_PARAMS.skills.sword_still.xpMult - 1) * 100)}%，护体减伤 +${COMBAT_RULE_PARAMS.skills.sword_still.mindDr}。` },
  sword_pierce:  { id: "sword_pierce", name: "破妄剑心", school: "sword", slot: "mind", min: "foundation", price: 95, art: "icon_blade", desc: `【锐攻流】装备于心法槽时生效：基础剑道攻击 +${COMBAT_RULE_PARAMS.skills.sword_pierce.mindAtk}，高爆发斩破妖王架势。` },
  sword_build:   { id: "sword_build", name: "青锋起势", school: "sword", slot: "builder", min: "qi", price: 0, art: "icon_blade", desc: "基础起手剑势：稳定挥出青锋剑气并为目标叠剑印。" },
  sword_guard:   { id: "sword_guard", name: "听雨剑势", school: "sword", slot: "builder", min: "foundation", price: 80, art: "icon_seal", desc: "【护体剑幕】出剑同步凝起短暂剑幕灵盾，稳健换血与防失误。" },
  sword_surge:   { id: "sword_surge", name: "惊涛剑势", school: "sword", slot: "builder", min: "foundation", price: 80, art: "icon_blade", desc: "【狂澜猛攻】四段剑舞与剑气威力大幅提升 +24%！" },
  sword_release: { id: "sword_release", name: "惊鸿斩", school: "sword", slot: "finisher", min: "qi", price: 0, art: "icon_blade", desc: "基础收势终结技：四段末招必定暴击并激发旋风剑莲破势。" },
  sword_echo:    { id: "sword_echo", name: "回风归一", school: "sword", slot: "finisher", min: "golden", price: 155, art: "icon_heart", desc: "【续战收势】打出四段终结斩时自动回补气血，攻守一体。" },
  sword_shatter: { id: "sword_shatter", name: "断岳斩", school: "sword", slot: "finisher", min: "golden", price: 155, art: "icon_blade", desc: "【裂地爆发】四段终结斩伤害暴涨 +45%，强力轰碎护盾与架势！" },

  talisman_mind:    { id: "talisman_mind", name: "镇灵心诀", school: "talisman", slot: "mind", min: "qi", price: 0, art: "icon_seal", desc: "基础雷符心法：出招附着灼魂符印与雷链共鸣，右键爆剑引爆高额符伤。" },
  talisman_calm:    { id: "talisman_calm", name: "太清符心", school: "talisman", slot: "mind", min: "foundation", price: 95, art: "icon_scroll", desc: "【回灵流】装备于心法槽时生效：周天吐纳与修为获取 +25%，持久释放法宝剑域更从容。" },
  talisman_clear:   { id: "talisman_clear", name: "清虚符心", school: "talisman", slot: "mind", min: "foundation", price: 95, art: "icon_heart", desc: `【御守流】装备于心法槽时生效：护体减伤 +${COMBAT_RULE_PARAMS.skills.talisman_clear.mindDr}、基础攻击 +${COMBAT_RULE_PARAMS.skills.talisman_clear.mindAtk}，稳扎稳打。` },
  talisman_build:   { id: "talisman_build", name: "镇灵符", school: "talisman", slot: "builder", min: "qi", price: 0, art: "icon_seal", desc: "基础镇灵起符：挥招附带符障护体并叠加剑印。" },
  talisman_frost:   { id: "talisman_frost", name: "寒霜符", school: "talisman", slot: "builder", min: "foundation", price: 80, art: "icon_seal", desc: "【寒霜附刃】剑气化作玄冥霜蓝，命中持续施加 2.6 秒寒霜减速！" },
  talisman_ember:   { id: "talisman_ember", name: "烬火符", school: "talisman", slot: "builder", min: "foundation", price: 80, art: "icon_seal", desc: "【烈焰余烬】剑招伤害 +24%，且敌方灼魂燃烧持续伤害暴涨 +45%！" },
  talisman_release: { id: "talisman_release", name: "燃符诀", school: "talisman", slot: "finisher", min: "qi", price: 0, art: "icon_scroll", desc: "基础燃符终式：四段终结与爆剑引爆符印，高效削减首领架势。" },
  talisman_return:  { id: "talisman_return", name: "归元符", school: "talisman", slot: "finisher", min: "golden", price: 155, art: "icon_heart", desc: "【归元回春】打出四段终结斩时自动回复气血与灵元，续航拉满。" },
  talisman_rupture: { id: "talisman_rupture", name: "裂阵符", school: "talisman", slot: "finisher", min: "golden", price: 155, art: "icon_seal", desc: "【超载裂阵】四段终结爆发威力提升 +45%，轻松击溃首领护阵！" }
};

export const RELICS = {
  frost_sword:  { id: "frost_sword", name: "青霜剑", art: "relic_frost_sword", stones: 130, passive: "剑道攻击 +9（随星级成长），环身飞剑额外 +1 柄", activeName: "霜天万剑引", mp: 14, activeDesc: "按 E 展开【太虚剑域】并降下霜天万剑雨，强力穿甲削韧！" },
  jade_seal:    { id: "jade_seal", name: "玄玉印", art: "relic_jade_seal", stones: 130, passive: "常驻护体减伤 +12（随星级成长），渡劫与硬拼更稳健", activeName: "玄武镇岳印", mp: 12, activeDesc: "按 E 展开【太虚剑域】并凝结厚重玄武灵盾、恢复气血！" },
  soul_lamp:    { id: "soul_lamp", name: "照魂灯", art: "relic_soul_lamp", stones: 150, passive: "剑道攻击 +8（随星级成长），灼魂燃烧持续伤害 +35%", activeName: "九幽燃魂焰", mp: 14, activeDesc: "按 E 展开【太虚剑域】并点燃全场灼魂真火，持续炙烤群妖！" },
  cloud_mirror: { id: "cloud_mirror", name: "流云镜", art: "relic_cloud_mirror", stones: 150, passive: "兼修攻防与恢复，法宝升星同步强化剑域续航", activeName: "流云返照诀", mp: 10, activeDesc: "按 E 展开【太虚剑域】并瞬间回复大量气血与剑元！" }
};

export const DAO_LAWS = {
  wanjian:         { id: "wanjian", name: "万剑归宗", rarity: "仙品", cat: "剑符神通", desc: "环身飞剑永久 +2，出剑额外激发追踪飞剑与剑雨弧光！" },
  yinyang:         { id: "yinyang", name: "阴阳剑符", rarity: "鸿蒙", cat: "跨派神通", desc: "打通剑符界限！剑招附带灼魂符印，爆剑与连携引动额外雷火爆发！" },
  pill_fire:       { id: "pill_fire", name: "丹火不息", rarity: "仙品", cat: "丹战神通", desc: "按 Q 饮仙葫或服回春丹时瞬间引爆大范围丹火震波，重创周围群妖！" },
  wealth_power:    { id: "wealth_power", name: "聚宝乾坤", rarity: "仙品", cat: "财道气运", desc: `每持有 ${COMBAT_RULE_PARAMS.laws.wealth_power.perStones} 灵石提供 +${Math.round(COMBAT_RULE_PARAMS.laws.wealth_power.pctPerStep * 100)}% 攻击加成（上限 +${Math.round(COMBAT_RULE_PARAMS.laws.wealth_power.maxPct * 100)}%，计入常驻增伤池并受 ${Math.round(COMBAT_RULE_PARAMS.passiveSoftCapKnee * 100)}%～${Math.round(COMBAT_RULE_PARAMS.passiveSoftCapMax * 100)}% 软上限约束）。` },
  thunder_body:    { id: "thunder_body", name: "紫霄雷体", rarity: "仙品", cat: "不灭雷体", desc: "周身雷罡环绕，周期引落紫霄神雷自动劈击近身妖兽并联动水洼感电！" },
  crit_lotus:      { id: "crit_lotus", name: "刹那芳华", rarity: "灵品", cat: "剑符神通", desc: `暴击率 +${Math.round(COMBAT_RULE_PARAMS.laws.crit_lotus.crit * 100)}%（总上限 ${Math.round(COMBAT_RULE_PARAMS.critCap * 100)}%）、暴击倍率 +${Math.round(COMBAT_RULE_PARAMS.laws.crit_lotus.critMult * 100)}%（总上限 ${COMBAT_RULE_PARAMS.critMultCap.toFixed(2)}×），破势处决与识破剑反必定暴击！` },
  nine_pill:       { id: "nine_pill", name: "九转丹香", rarity: "仙品", cat: "丹器造化", desc: "丹鼎控火黄金区大幅拓宽，每次成丹产出额外 +1 枚且永久增益气血！" },
  eternal_spring:  { id: "eternal_spring", name: "生生造化", rarity: "灵品", cat: "不灭雷体", desc: "战中持续缓缓回复气血与剑元，搭配【丹火不息】觉醒青莲不灭真身！" },
  stagger_surge:   { id: "stagger_surge", name: "破阵惊雷", rarity: "仙品", cat: "剑符神通", desc: `敌方破势易伤由 ${COMBAT_RULE_PARAMS.laws.stagger_surge.baseStunMult.toFixed(2)}×(+${Math.round((COMBAT_RULE_PARAMS.laws.stagger_surge.baseStunMult - 1) * 100)}%) 提升至 ${COMBAT_RULE_PARAMS.laws.stagger_surge.enhancedStunMult.toFixed(2)}×(+${Math.round((COMBAT_RULE_PARAMS.laws.stagger_surge.enhancedStunMult - 1) * 100)}%，并与处决倍率叠乘)；击空架势立即回复 ${COMBAT_RULE_PARAMS.laws.stagger_surge.breakMp} 剑元并缩短法宝冷却 ${COMBAT_RULE_PARAMS.laws.stagger_surge.breakUltCdReduce} 秒！` },
  void_haste:      { id: "void_haste", name: "太虚神速", rarity: "灵品", cat: "气运财道", desc: "身法移速与周天吐纳大幅提速，每次吸收灵韵光球额外获得灵石！" },
  relic_awake:     { id: "relic_awake", name: "百宝通灵", rarity: "仙品", cat: "丹器造化", desc: "本命法宝【太虚剑域】冷却大幅缩短，剑域爆发伤害与护盾 +40%！" },
  beast_soul:      { id: "beast_soul", name: "兽魂共鸣", rarity: "鸿蒙", cat: "御兽神通", desc: "本命灵兽主动协同出手频率大幅提升（1.95s → 1.15s），绝技威力 +60%！" },
  age_might:       { id: "age_might", name: "岁月长歌", rarity: "灵品", cat: "不灭雷体", desc: `骨龄超过 ${COMBAT_RULE_PARAMS.laws.age_might.baseAge} 岁后每增 ${COMBAT_RULE_PARAMS.laws.age_might.yearsPerStep} 载提供 +${Math.round(COMBAT_RULE_PARAMS.laws.age_might.pctPerStep * 100)}% 攻击加成（上限 +${Math.round(COMBAT_RULE_PARAMS.laws.age_might.maxPct * 100)}%，计入常驻增伤池），采集委托耗时减半！` },
  karma_resonance: { id: "karma_resonance", name: "红尘同心", rarity: "鸿蒙", cat: "因果神通", desc: `每段已结故人因果提供 +${Math.round(COMBAT_RULE_PARAMS.laws.karma_resonance.pctPerChoice * 100)}% 攻击加成（上限 +${Math.round(COMBAT_RULE_PARAMS.laws.karma_resonance.maxPct * 100)}%，计入常驻增伤池），大幅强化【故人助阵】合击频率与威能！` },
  destiny_eye:     { id: "destiny_eye", name: "天命慧眼", rarity: "灵品", cat: "气运财道", desc: "击杀掉落灵石与灵草翻倍，所有采集与宗门委托材料产出额外 +1！" }
};

export const SPIRIT_PETS = {
  fox:          { id: "fox", art: "pet_fox", name: "青丘火狐", skill: "狐火燎原", color: "#ff8a65", desc: "喷吐青丘真火灼伤敌方并挂1枚剑印，主人暴击率 +10%" },
  turtle:       { id: "turtle", art: "pet_turtle", name: "玄水灵龟", skill: "玄水灵障", color: "#4ad2b8", desc: "周期为主人回血并凝结玄水灵盾，常驻减伤 +10" },
  roc:          { id: "roc", art: "pet_roc", name: "九霄雷鹏", skill: "九天落雷", color: "#b998fa", desc: "召唤紫金天雷重轰（对破势目标双倍伤害），高效削韧" },
  sword_spirit: { id: "sword_spirit", art: "pet_sword", name: "太虚剑灵", skill: "游龙剑影", color: "#f5dc9b", desc: "激发穿云双剑气叠剑印，并持续为主人回复剑元" }
};

export const PET_FEED_COSTS = {
  1: { nextLevel: 2, mats: { herb: 3 }, tierLabel: "灵草初养" },
  2: { nextLevel: 3, mats: { core: 2 }, tierLabel: "妖核化形" },
  3: { nextLevel: 4, mats: { core: 4 }, tierLabel: "妖核淬骨" },
  4: { nextLevel: 5, mats: { jade: 3 }, tierLabel: "灵玉通玄" }
};

export const PET_SKILL_TIERS = {
  tier3: [
    { id: "swift_bond",  tier: 3, name: "灵息疾影", badge: "疾速协同", color: "#70ffe6", desc: "灵宠协同出手间隔 -25%，觉醒神通 (G) 冷却缩短 2.5s。" },
    { id: "fury_fang",   tier: 3, name: "破势利爪", badge: "锐攻破势", color: "#ff9f68", desc: "灵宠协同与觉醒技威力 +35%、削韧 +50%，主人暴击率永久 +5%。" },
    { id: "spirit_ward", tier: 3, name: "护主灵罡", badge: "护体续航", color: "#ffe28a", desc: "主人护体减伤 +12、最大气血 +8%，灵宠每次出手额外凝结 3% 气血灵盾并回 4 剑元。" }
  ],
  tier5: [
    { id: "twin_resonance",  tier: 5, name: "双灵连击", badge: "追击叠印", color: "#80ecff", desc: "灵宠协同出手追加第二道 65% 威力共鸣追击（额外叠 1 剑印），觉醒技 (G) 额外降下两道天雷追击。" },
    { id: "soul_siphon",     tier: 5, name: "返璞归元", badge: "回生护命", color: "#4ad2b8", desc: "灵宠协同出手为主人回复 4% 最大气血与 8 剑元；觉醒技 (G) 立即回 25% 气血、30 剑元并获 1.2s 无敌。" },
    { id: "celestial_wrath", tier: 5, name: "太虚天威", badge: "绝杀爆发", color: "#d69eff", desc: "灵宠觉醒技 (G) 伤害 +55% 且必定暴击，施放后赋予主人 6s【兽魂沸腾】（攻击 +16%、攻速 +15%）。" }
  ]
};

export const PET_SKILLS_BY_ID = Object.fromEntries(
  [...PET_SKILL_TIERS.tier3, ...PET_SKILL_TIERS.tier5].map(sk => [sk.id, sk])
);

export const LEGACY_STEP_ID_MAP = {
  s1_xp: "s1_wolf",
  s2_school: "s2_pet",
  s3_skill: "s3_serpent",
  s4_npc: "s4_puppet",
  s5_shen: "s5_laws",
  s7_trial: "s6_gate",
  s7_end: "s6_ascend"
};

export const PERKS = [
  { id: "mortal_grit",      name: "山野坚心",   badge: "初始命格",   unlock: 0, unlockText: "初始可用", desc: "开局额外灵石 +45（总计 110 石）、额外回春丹 ×2（总计 ×4），凡境起步稳健。" },
  { id: "sword_bone",       name: "先天剑骨",   badge: "初始命格",   unlock: 0, unlockText: "初始可用", desc: "基础剑道攻击 +5、暴击率 +8%，初始锋芒达 20（高于常人 +10）。" },
  { id: "medicine_sage",    name: "药王遗泽",   badge: "初始命格",   unlock: 0, unlockText: "初始可用", desc: "丹炉控火黄金区拓宽 35%，极易炼出仙品丹，开局带凝气草 ×6、灵露 ×3。" },
  { id: "immortal_echo",    name: "九世道胎",   badge: "一世轮回",   unlock: 1, unlockText: "飞升 1 世解锁", desc: "【轮回命格】全境界寿元 +480 月（+40 载），开局自带【太虚神速】法则（移速 +18%）！" },
  { id: "sword_sovereign",  name: "轮回剑主",   badge: "剑冢/轮回",  unlock: 1, altUnlock: "rush_s", unlockText: "飞升 1 世或万剑冢 S 级解锁", desc: "【轮回命格】开局飞剑 +2、基础剑攻 +12、暴伤 +18%，洞府【天工剑炉】起步 Lv.2！" },
  { id: "calamity_phoenix", name: "劫火涅槃体", badge: "劫火/二世",  unlock: 2, altUnlock: "calamity_1", unlockText: "飞升 2 世或通关劫火周目解锁", desc: "【轮回命格】开局带长生寿元丹 ×1、灵石 +140，残血(≤45%)固定减伤 +18 且常驻剑威 +22%，破境额外溢出 +15%！" },
  { id: "primordial_sage",  name: "太初鸿蒙胎", badge: "图鉴/三世",  unlock: 3, altUnlock: "codex_65", unlockText: "飞升 3 世或图鉴达 65% 解锁", desc: "【轮回命格】洞府【聚气灵眼/紫微丹鼎】皆起步 Lv.2，开局获仙品佩剑、星魂点 +2，全攻速 +10%！" }
];

export const CALAMITY_CYCLES = [
  { tier: 0, name: "凡尘问道",     short: "标准",     hpMult: 1.00, atkMult: 1.00, postureMult: 1.00, rewardMult: 1.00, dropBonus: 0, scoreMult: 1.00, reqAsc: 0, desc: "常规修仙天道难度，均衡体验全流程。" },
  { tier: 1, name: "一重劫火·燃星", short: "劫火×1", hpMult: 1.35, atkMult: 1.22, postureMult: 1.20, rewardMult: 1.35, dropBonus: 0, scoreMult: 1.20, reqAsc: 1, desc: "敌血+35%·攻+22% | 灵石/修为+35%·仙榜×1.20" },
  { tier: 2, name: "二重劫火·焚岳", short: "劫火×2", hpMult: 1.75, atkMult: 1.45, postureMult: 1.40, rewardMult: 1.70, dropBonus: 1, scoreMult: 1.45, reqAsc: 1, desc: "敌血+75%·攻+45% | 灵石/修为+70%·神装品阶+1" },
  { tier: 3, name: "三重劫火·碎虚", short: "劫火×3", hpMult: 2.25, atkMult: 1.72, postureMult: 1.60, rewardMult: 2.15, dropBonus: 1, scoreMult: 1.75, reqAsc: 2, desc: "敌血+125%·攻+72% | 灵石/修为+115%·仙榜×1.75" },
  { tier: 4, name: "四重劫火·九幽", short: "劫火×4", hpMult: 2.85, atkMult: 2.00, postureMult: 1.85, rewardMult: 2.65, dropBonus: 2, scoreMult: 2.10, reqAsc: 2, desc: "敌血+185%·攻+100% | 灵石/修为+165%·鸿蒙高爆" },
  { tier: 5, name: "五重劫火·无间", short: "劫火×5", hpMult: 3.60, atkMult: 2.35, postureMult: 2.10, rewardMult: 3.30, dropBonus: 2, scoreMult: 2.60, reqAsc: 3, desc: "敌血+260%·攻+135% | 灵石/修为+230%·仙榜×2.60" }
];

export const SYSTEM_ECOSYSTEM_LADDER = [
  {
    realm: "qi", title: "一重仙阶 · 炼气初开（第二卷）", subtitle: "山门问道 · 采炼御兽初试锋芒",
    systems: [
      { id: "spirit_pet",    min: "qi", name: "本命灵宠",     short: "灵宠",   keyHint: "修行抽屉", action: "open_drawer_cultivate", desc: "契约青丘火狐 / 玄水灵龟 / 九霄雷鹏 / 太虚剑灵随行助战，分级喂养并在 Lv.3/Lv.5 择技化形。" },
      { id: "bagua_alchemy", min: "qi", name: "八卦丹剑微操", short: "丹剑",   keyHint: "百工/洞府", action: "open_taixu_craft",      desc: "亲手控火炼制仙品丹药与鸿蒙神兵淬火。" },
      { id: "demon_tower",   min: "qi", name: "太虚锁妖古塔", short: "锁妖塔", keyHint: "仙阁/舆图", action: "start_tower",           desc: "开启无尽镇妖塔试炼，冲层赢取海量灵石与仙装。" }
    ]
  },
  {
    realm: "foundation", title: "二重仙阶 · 筑基铸道（第三卷）", subtitle: "双姿易剑 · 化妖破招与护宗守阵",
    systems: [
      { id: "dual_stance",  min: "foundation", name: "双剑意姿态",   short: "双姿态", keyHint: "` 键",     action: "cycle_posture",     desc: "青莲疾剑式与玄重巨阙式瞬切，触发太虚易剑斩。" },
      { id: "soul_seal",    min: "foundation", name: "镇妖魂印",     short: "魂印",   keyHint: "C 键",     action: "open_drawer_cultivate", desc: "炼化妖王精魄化妖破招，联动五行场地核爆。" },
      { id: "sect_defense", min: "foundation", name: "护山大阵守卫", short: "护山战", keyHint: "洞府/舆图", action: "start_sect_defense", desc: "御剑守护听雨洞府灵核与护山灵塔（Lv.3增北辰塔）。" },
      { id: "tag_team",     min: "foundation", name: "道侣瞬切换人", short: "换人",   keyHint: "V 键",     action: "trigger_tag_switch", desc: "无缝切换操控沈清禾/裴照等道侣并释放合璧奥义。" }
    ]
  },
  {
    realm: "golden", title: "三重仙阶 · 金丹启星（第四卷）", subtitle: "破云凌霄 · 御剑空战与周天星宿",
    systems: [
      { id: "cloud_sea_trial", min: "golden", name: "九霄云海空战", short: "云海空战", keyHint: "高潮过渡关", action: "start_cloud_sea", desc: "高速御剑斩破巡天雷鹏防线！首破获【破云证道印】(+12攻 · 为元婴期远征/登仙台提供+15%收益)。" },
      { id: "star_chart",      min: "golden", name: "太虚周天星图", short: "星图",     keyHint: "N 键",       action: "open_star_chart", desc: "点亮二十八星宿激活青龙/白虎/朱雀/玄武四象圣核。" }
    ]
  },
  {
    realm: "nascent", title: "四重仙阶 · 元婴破虚（第五卷）", subtitle: "分神远征 · 九重登仙与剑冢七阵",
    systems: [
      { id: "vein_expedition", min: "nascent", name: "九州灵脉远征",   short: "灵脉远征", keyHint: "8 键",       action: "open_expedition", desc: "委派已结缘故人驻防五大灵脉收缴灵石星魄，触发仙门护道雷援。" },
      { id: "celestial_spire", min: "nascent", name: "太虚登仙台",     short: "登仙台",   keyHint: "L 键",       action: "open_spire",      desc: "九重天宫肉鸽奇物深渊，叠铸太古天道奇物体系。" },
      { id: "sword_tomb_rush", min: "nascent", name: "万剑冢七阵连战", short: "万剑冢",   keyHint: "元婴期解封", action: "open_boss_rush",  desc: "连战七阵强化妖王、太虚心魔镜像与太古烛龙三部位讨伐！" }
    ]
  },
  {
    realm: "spirit", title: "五重仙阶 · 化神凌霄（第六卷）", subtitle: "劫印问道 · 太虚造化与直叩天门",
    systems: [
      { id: "heavenly_pacts", min: "spirit", name: "天道劫印契约", short: "天道劫印", keyHint: "化神期解封", action: "open_endgame_goals", desc: "缔结至多五道高难天道劫印，大幅飙升爆率与仙榜倍率。" },
      { id: "seed_workshop",  min: "spirit", name: "造化种子工坊", short: "造化工坊", keyHint: "化神期解封", action: "open_workshop",      desc: "自定义双首领共斗、机关密度与奇物组合，生成 CY22 种子码分享！" }
    ]
  }
];

export const DESTINY_FRUITS = {
  sword_twin:   { id: "sword_twin",   name: "剑心通明", badge: "飞剑+2 · 贯虹", art: "relic_frost_sword", desc: "环身本命飞剑永久 +2 柄，且蓄力万剑穿云伤害额外提高 28%。" },
  thunder_soul: { id: "thunder_soul", name: "紫霄雷体", badge: "一闪落雷 · 麻痹", art: "relic_soul_lamp",   desc: "每次施展空格【一闪】，在起点与终点劈落三道紫霄神雷轰击群妖并削减架势。" },
  lotus_body:   { id: "lotus_body",   name: "青莲圣体", badge: "吐纳+35% · 护体", art: "item_lotus",        desc: "B键周天吐纳聚气效率 +35%，且每次破境与回城额外凝结 35% 最大气血青莲护盾。" },
  zhuxian_edge: { id: "zhuxian_edge", name: "诛仙残意", badge: "爆剑增伤 · 返冷", art: "icon_blade",        desc: "右键【爆剑】引爆剑印伤害提升 55%，若引爆满印妖兽立即返还 50% 冷却。" },
  void_phantom: { id: "void_phantom", name: "太虚幻剑", badge: "三式双影 · 剑轮", art: "relic_cloud_mirror",desc: "普攻第三式额外唤出一道太虚剑影协同投掷双倍旋风剑轮。" },
  glutton_pill: { id: "glutton_pill", name: "饕餮丹心", badge: "服丹永驻 · 强魄", art: "item_golden_pill",  desc: "每次服用回春丹或畅饮仙葫，永久增加 +6 剑道攻击与 +18 气血上限（受本境丹道上限约束），并立即获赐回春丹×2。" },
  hongmeng_luck:{ id: "hongmeng_luck",name: "鸿蒙紫气", badge: "神装爆率 · 赐宝", art: "item_ascension_seal",desc: "精英与首领掉落仙品/鸿蒙光柱概率翻倍，感悟瞬间立即获赐一件高品仙装！" },
  eternal_pine: { id: "eternal_pine", name: "万古长青", badge: "暴击暴伤 · 富贵", art: "relic_jade_seal",   desc: "暴击率提升 +10%，每持有 80 灵石额外转化 +3% 暴击伤害（最高+32%），立即获赐 120 灵石。" }
};

export const ACTION_REALM_REQ = {
  slash: 0, recall: 0, dash: 0, meditate: 0, pill: 0, hub: 0, photo: 0, telemetry: 0,
  stance: 1, jump: 1, ult: 1, ally: 1, pet: 1,
  posture: 2, soul: 2, swordBlink: 2, finisher: 2, tagSwitch: 2, weapon_form: 2,
  mount: 3, qimen: 3, sequencer: 3,
  sanqing: 4, astral: 4,
  shanhe: 5, warship: 5
};
