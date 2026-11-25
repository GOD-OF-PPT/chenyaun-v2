  // ==================== 5C. CINEMATIC STORY DIALOGUE SCRIPTS ====================
  const CHAPTER_CUTSCENES = {
    opening_scroll: [
      { art: "item_ascension_seal", role: "太虚古卷 · 开篇", speaker: "九州纪事", text: "百年前九霄天门崩裂，一缕【天门道影】坠落九州；其残片四散浸染五境守关之灵，九州灵脉渐衰，仙途几近永闭。" },
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "照影古境的残碑记下了五处受染灵枢——青岚、青云、寒潭、古冢与九霄仙台；唯有循碑逐一斩碎残片，方能重叩九霄天门。" },
      { art: "char_player", role: "青岚山野 · 问道少年", speaker: "顾长青", text: "我本青岚山野无名少年，唯怀断玉剑匣与一枚回春丹。纵无显赫灵根，亦愿以三尺青锋踏遍六卷尘缘、问开天门！" },
      { art: "char_shen", role: "青云药庐 · 悬壶医修", speaker: "沈清禾", text: "破庙外骤雨倾盆，群狼瞳中竟泛起诡异暗金残光——『救命！青岚妖狼狂性大发，庙中可有道友相助？！』" },
      { art: "char_player", role: "青岚山野 · 问道少年", speaker: "顾长青", text: "天门道影的残片之祸已至眼前——山雨破庙，便是此生问道第一剑！", finalBtnLabel: "拔剑入雨 ▸" }
    ],
    prologue_rescue: [
      { art: "char_shen", role: "青云药庐 · 悬壶医修", speaker: "沈清禾", text: "山雨湿寒，多谢道友拔剑退狼！清禾携药囊自青云宗下山采药，不想在此破庙遇袭。" },
      { art: "char_player", role: "青岚山野 · 问道少年", speaker: "顾长青", text: "路见不平自当拔剑。姑娘伤势未愈，这枚随身回春丹且先服下稳住心脉。" },
      { art: "char_shen", role: "青云药庐 · 悬壶医修", speaker: "沈清禾", text: "一丹之恩，清禾铭记于心！庙前两道古碑灵光已现，择一机缘后，可随时按【H键】回听雨洞府整备修行。" }
    ],
    enter_sect: [
      { art: "char_lu", role: "青云山门 · 传功执事", speaker: "陆玄松", text: "老夫青云传功执事陆玄松。能凭一己剑气自青岚破庙闯入青云外门，足见道心坚韧。" },
      { art: "char_lu", role: "青云山门 · 传功执事", speaker: "陆玄松", text: "镇山石卫近来被天门残影侵染失控；秘境已启【五层分支星图】，随时按 9 键检视天候与奖励，善择前路者方得大道！" }
    ],
    enter_secret: [
      { art: "char_pei", role: "青云剑阁 · 同辈剑首", speaker: "裴照", text: "前面那位道友留步！在下青云剑阁裴照。这照影寒潭寒气刺骨，镇守妖王【寒潭玄蛇】半血便会布下玄冥冰域、散射连环霜弹——切记切换【Y键剑轮阵】斩碎弹幕，避开霜池！" },
      { art: "char_player", role: "问道剑修", speaker: "顾长青", text: "多谢阁下出言相告！在下顾长青，且看今日剑意破寒潭、斩玄蛇！" }
    ],
    enter_sword_mound: [
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "老朽乃照影古境守碑人砚尘。此处便是上古剑修埋骨之地【古修剑冢】，残剑古傀与镇守首领【古境剑傀】皆通铜镜反震之法，轻剑直劈必遭弹反。" },
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "见铜镜浮空时，以【空格一闪】或【右键爆剑】正面碎镜，方能破开剑傀金身、夺取月华莲与元婴机缘！" },
      { art: "char_player", role: "问道剑修", speaker: "顾长青", text: "多谢前辈指点！古剑未冷，道心不折——今日便在此剑冢问剑证婴！" }
    ],
    enter_terrace: [
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "行至九霄星盘，倒也无需再隐名讳——老朽照影古境守碑人砚尘。你一路斩破的四方异变，源头皆在此门之后的【天门道影】！" },
      { art: "char_player", role: "问道剑修", speaker: "顾长青", text: "自青岚山雨行至九霄云巅，凡尘百战只为今日——拔剑开天门！" }
    ],
    boss_pre_stage0: [
      { art: "enemy_wolf", role: "青岚妖魁 · 雾隐狼王", speaker: "雾隐狼王", text: "嗷呜——天上坠落的暗金残片赐我无尽凶威！闯入青岚山雨的蝼蚁，化作吾之血食吧！" },
      { art: "char_player", role: "青岚山野 · 问道少年", speaker: "顾长青", text: "它眉心果真嵌着天门道影的残片！拔剑吧，今日先斩青岚妖魁，护住山野安宁！", finalBtnLabel: "拔剑迎战 ▸" }
    ],
    boss_pre_stage1: [
      { art: "enemy_warden", role: "镇山金卫 · 守山石卫", speaker: "守山石卫", text: "嗡——外来剑修止步！天门余影已覆吾石心，金阵所向，凡俗皆须俯首试道！" },
      { art: "char_player", role: "炼气剑修", speaker: "顾长青", text: "连青云宗镇山石卫都被天门道影残片蒙蔽了灵智！前辈得罪了，且让晚辈以剑破阵、清此残影！", finalBtnLabel: "破阵迎战 ▸" }
    ],
    boss_pre_stage2: [
      { art: "enemy_serpent", role: "寒鳞妖尊 · 寒潭玄蛇", speaker: "寒潭玄蛇", text: "嘶——天门坠落之影融吾寒髓，千年冰潭终将冻绝九州！区区筑基小修，也敢来触逆鳞？！" },
      { art: "char_player", role: "筑基剑修", speaker: "顾长青", text: "寒潭灵脉岂容道影残片冻结！今日便借剑轮破霜，替这照影寒潭解封！", finalBtnLabel: "破霜迎战 ▸" }
    ],
    boss_pre_stage3: [
      { art: "enemy_puppet", role: "镜阵剑祖 · 古境剑傀", speaker: "古境剑傀", text: "铮——古冢万剑奉天门道影之诏而鸣！铜镜照影，汝之剑道可敢与百年前飞升旧影一较高下？" },
      { art: "char_player", role: "金丹剑修", speaker: "顾长青", text: "先贤遗剑不该沦为道影傀儡！待我碎镜破阵，还这古修剑冢一片清静！", finalBtnLabel: "碎镜迎战 ▸" }
    ],
    boss_pre_stage4: [
      { art: "enemy_trial_gate", role: "九霄守门者 · 天门道影", speaker: "天门道影", text: "凡尘执剑者，汝斩尽吾落于四境之残片，循守碑人所录踏上星盘——既欲重开百年天门，便以毕生道果接我万劫神罚！" },
      { art: "char_player", role: "问道剑主", speaker: "顾长青", text: "从青岚破庙到九霄仙台，一路故人相护、万剑同心——天门道影，今日便斩破这最后一道天障！", finalBtnLabel: "剑开天门 ▸" }
    ],
    clear_stage0: [
      { art: "enemy_wolf", role: "青岚妖魁 · 雾隐狼王", speaker: "雾隐狼王", text: "呜……那缕灼魂的暗金碎影……终于从脑海散去了……" },
      { art: "char_shen", role: "青云药庐 · 悬壶医修", speaker: "沈清禾", text: "好凌厉的一剑！你斩碎的暗金残片正飘向青云山门——外门镇山石卫近日亦有异动，待你渡劫炼气后，务必赴【青云外门】一探究竟。" },
      { art: "char_player", role: "青岚山野 · 问道少年", speaker: "顾长青", text: "第一枚残片已破。回听雨洞府整备渡劫，下一程便往青云外门问剑！", finalBtnLabel: "收剑合卷 ▸" }
    ],
    clear_stage1: [
      { art: "enemy_warden", role: "镇山金卫 · 守山石卫", speaker: "守山石卫", text: "轰……金阵浊影既散，青云石心重归清明……小友剑锋已足承筑基之重！" },
      { art: "char_lu", role: "青云山门 · 传功执事", speaker: "陆玄松", text: "多亏道友破除石卫心障！老夫观残片气机，第三道裂隙已沉入【照影寒潭】，寒潭玄蛇恐已失控。快集妖核炼筑基丹，与裴照共探寒潭！" },
      { art: "char_player", role: "炼气剑修", speaker: "顾长青", text: "青云山门已安。待我渡劫筑基，便赴照影寒潭斩蛇破影！", finalBtnLabel: "收剑合卷 ▸" }
    ],
    clear_stage2: [
      { art: "enemy_serpent", role: "寒鳞妖尊 · 寒潭玄蛇", speaker: "寒潭玄蛇", text: "嘶……寒髓中的天门残印竟被剑意碾碎……潭底千年冰封，散了……" },
      { art: "char_pei", role: "青云剑阁 · 同辈剑首", speaker: "裴照", text: "痛快！寒潭第三枚残片已毁，但残气顺地脉涌向了【古修剑冢】——照影古境的守碑人砚尘正在彼处查探，你凝结金丹后速往剑冢会合！" },
      { art: "char_player", role: "筑基剑修", speaker: "顾长青", text: "多谢裴兄相告！凝结金丹、铸成本命法宝，下一卷直入古修剑冢！", finalBtnLabel: "收剑合卷 ▸" }
    ],
    clear_stage3: [
      { art: "enemy_puppet", role: "镜阵剑祖 · 古境剑傀", speaker: "古境剑傀", text: "铮……残片既灭，旧剑归鞘……后世剑修，持此剑意去叩九霄吧……" },
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "四处灵枢残片俱已斩尽，照影石碑上只余最后一行铭文——【九霄天门】。碎丹成婴、参悟万法化神之后，真正的天门道影将在云巅候你。" },
      { art: "char_player", role: "金丹剑修", speaker: "顾长青", text: "四境已明，万古残碑终见终卷之门。碎丹成婴、化神登霄，我必斩开天门！", finalBtnLabel: "收剑合卷 ▸" }
    ],
    clear_stage4: [
      { art: "enemy_trial_gate", role: "九霄守门者 · 天门道影", speaker: "天门道影", text: "轰隆——百年残影尽散，九霄禁制已开！汝之剑心不染尘埃，确有资格登临仙门！" },
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "五境残片尽除，照影石碑终于补全最后一句。道友，你从山雨破庙走来，今日亲手替九州重开了天门。" },
      { art: "char_shen", role: "青云药庐 · 悬壶医修", speaker: "沈清禾", text: "天门既现，听雨洞府的灯火永远为你长明——无论你择定何种飞升道果，此番红尘故人皆在云海遥祝！" },
      { art: "char_player", role: "问道剑主", speaker: "顾长青", text: "尘缘未负，仙门在前。且去引动最终飞升天劫，证我万古大道！", finalBtnLabel: "合卷问仙 ▸" }
    ],
    enter_vol5_resonance: [
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "碎丹成婴之后，单靠蛮力已难撼九霄天障。第五卷【法则共鸣 · 元神试剑】重在以万法印心、淬炼本命法宝，亦可在云海、星图与登仙台试剑磨砺元神。" },
      { art: "char_shen", role: "青云药庐 · 悬壶医修", speaker: "沈清禾", text: "若备有【化神丹】可稳渡化神天劫，若欲效古剑修无丹逆天强渡，听雨洞府与我皆会为你护法——切莫被丹炉所困，只需守住本心剑意！" },
      { art: "char_player", role: "元婴剑修", speaker: "顾长青", text: "四法通明或器成三星，再破化神天劫、直登九霄天门——第五卷元神之道，便从今日启程！", finalBtnLabel: "观览共鸣 ▸" }
    ]
  };

  const CHAPTER_CUTSCENES_VARIANTS = {
    enter_sect_met: [
      { art: "char_lu", role: "青云山门 · 传功执事", speaker: "陆玄松", text: "道友果然如约踏入青云外门！前番舆图所载的守山石卫已被天门残影侵染，还须小心应对。" },
      { art: "char_lu", role: "青云山门 · 传功执事", speaker: "陆玄松", text: "秘境已启【五层分支星图】，随时按 9 键检视天候与奖励——老夫在山门候你捷音！" }
    ],
    enter_secret_met: [
      { art: "char_pei", role: "青云剑阁 · 同辈剑首", speaker: "裴照", text: "哈哈，果然又碰上了！自山门论剑一别，你剑意愈发凌厉。前面【寒潭玄蛇】半血会布玄冥冰域、散射霜弹，切【Y键剑轮阵】斩弹幕最省力！" },
      { art: "char_player", role: "问道剑修", speaker: "顾长青", text: "多谢裴兄提醒！正巧让你瞧瞧今日剑意破寒潭、斩玄蛇！" }
    ],
    enter_sword_mound_met: [
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "残碑前留字之人，竟已一路行至【古修剑冢】了。碑文所记不差，此间镇守【古境剑傀】亦遭天门残影侵染，铜镜反震愈发凌厉。" },
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "见铜镜浮空时，仍以【空格一闪】或【右键爆剑】正面碎镜，破其金身方可夺月华莲证婴！" },
      { art: "char_player", role: "问道剑修", speaker: "顾长青", text: "有劳砚尘前辈再度相告，今日便斩此剑傀以正古冢！" }
    ],
    enter_terrace_vol5: [
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "你以元婴之身先临九霄星盘，恰合第五卷【元神试剑】之旨！先探【天门道影】虚实、积攒修为与法则共鸣，待渡过化神天劫后再行最终飞升！" },
      { art: "char_player", role: "元婴剑修", speaker: "顾长青", text: "正合我意！先以元婴剑心试探天门道影，再破化神重开仙门！" }
    ],
    enter_terrace_met: [
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "从照影残碑走到九霄星盘，你一路清除四方残影，终于站到了【天门道影】正前。" },
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "此门之后再无借力之处，唯凭你这一路炼出的剑心破局——拔剑吧，道友！" },
      { art: "char_player", role: "问道剑修", speaker: "顾长青", text: "多谢前辈一路记碑相送，今日便以此剑叩开九霄天门！" }
    ],
    enter_terrace_after_gate: [
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "星盘已启，【天门道影】就在云海尽头。石阶前该叮嘱的话老朽已尽数言明——此去莫回头，亮剑吧！" },
      { art: "char_player", role: "问道剑修", speaker: "顾长青", text: "承前辈吉言，今日一剑斩道影，亲手写完碑卷最后一页！" }
    ],
    clear_stage1_bonded: [
      { art: "enemy_warden", role: "镇山金卫 · 守山石卫", speaker: "守山石卫", text: "轰……青云钟声与剑意同鸣，石心浊影尽散！小友道基已成！" },
      { art: "char_lu", role: "青云山门 · 传功执事", speaker: "陆玄松", text: "好一记破阵剑！你既已谙熟山门天时筹备之道，此去【照影寒潭】应对玄蛇寒煞必能从容周旋。老夫已修书予剑阁裴照在潭畔相迎！" },
      { art: "char_player", role: "炼气剑修", speaker: "顾长青", text: "多谢陆执事托付！渡劫筑基之后，便往照影寒潭与裴兄会合！", finalBtnLabel: "收剑合卷 ▸" }
    ],
    clear_stage2_bonded: [
      { art: "enemy_serpent", role: "寒鳞妖尊 · 寒潭玄蛇", speaker: "寒潭玄蛇", text: "嘶……剑阁双锋合流，千年寒髓竟也压不住你们的剑意……" },
      { art: "char_pei", role: "青云剑阁 · 同辈剑首", speaker: "裴照", text: "痛快！自山门论剑之后，我就知道寒潭困不住你！第三枚残片已破，地脉异动直指【古修剑冢】——凝结金丹后，我们剑冢寒池再见！" },
      { art: "char_player", role: "筑基剑修", speaker: "顾长青", text: "一言为定！凝结金丹、铸成法宝，剑冢再并肩破阵！", finalBtnLabel: "收剑合卷 ▸" }
    ],
    clear_stage3_bonded: [
      { art: "enemy_puppet", role: "镜阵剑祖 · 古境剑傀", speaker: "古境剑傀", text: "铮……碑前赤诚未改，铜镜残片既碎，旧剑甘愿归鞘……" },
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "好孩子，四方残片俱已斩尽。你当年留在照影碑上的初心，如今已足够支撑碎丹成婴、踏入第五卷【法则共鸣】与九霄天门之约。" },
      { art: "char_player", role: "金丹剑修", speaker: "顾长青", text: "不忘山雨来处，亦敢叩问九霄！碎丹成婴，下一程共赴天门！", finalBtnLabel: "收剑合卷 ▸" }
    ],
    clear_stage4_bonded: [
      { art: "enemy_trial_gate", role: "九霄守门者 · 天门道影", speaker: "天门道影", text: "轰隆——红尘同心之剑竟真能斩碎百年天障！九霄仙门，为汝敞开！" },
      { art: "char_shen", role: "青云药庐 · 悬壶医修", speaker: "沈清禾", text: "从破庙雨夜到九霄星盘，药阵灯火一路伴你至此——今日天门重开，清禾与裴兄、陆执事、砚尘前辈皆在云下为你贺道！" },
      { art: "char_yan", role: "照影古境 · 守碑老人", speaker: "砚尘", text: "照影碑终页已落墨。去吧，引动最终飞升天劫，亲手写下你的证道结局！" },
      { art: "char_player", role: "问道剑主", speaker: "顾长青", text: "幸得诸位故人同行，此剑不负尘缘！且去渡劫飞升！", finalBtnLabel: "合卷问仙 ▸" }
    ]
  };

  function resolveCutsceneLines(key, g) {
    const ch = (g && g.choices) ? g.choices : {};
    const aids = (g && g.aids) ? g.aids : {};
    if (key === "enter_sect" && ch.lu_intro) return CHAPTER_CUTSCENES_VARIANTS.enter_sect_met;
    if (key === "enter_secret" && ch.pei_meet) return CHAPTER_CUTSCENES_VARIANTS.enter_secret_met;
    if (key === "enter_sword_mound" && ch.yan_stone) return CHAPTER_CUTSCENES_VARIANTS.enter_sword_mound_met;
    if (key === "enter_terrace") {
      if (g && g.realm === "nascent" && !ch.yan_gate) return CHAPTER_CUTSCENES_VARIANTS.enter_terrace_vol5;
      if (ch.yan_gate) return CHAPTER_CUTSCENES_VARIANTS.enter_terrace_after_gate;
      if (ch.yan_stone || ch.yan_mirror) return CHAPTER_CUTSCENES_VARIANTS.enter_terrace_met;
    }
    if (key === "clear_stage1" && (ch.lu_intro || aids.lu)) return CHAPTER_CUTSCENES_VARIANTS.clear_stage1_bonded;
    if (key === "clear_stage2" && (ch.pei_meet || aids.pei)) return CHAPTER_CUTSCENES_VARIANTS.clear_stage2_bonded;
    if (key === "clear_stage3" && (ch.yan_stone || ch.yan_mirror || aids.yan)) return CHAPTER_CUTSCENES_VARIANTS.clear_stage3_bonded;
    if (key === "clear_stage4" && countBondedAllies(g) >= 2) return CHAPTER_CUTSCENES_VARIANTS.clear_stage4_bonded;
    return CHAPTER_CUTSCENES[key] || null;
  }

  function playCustomDialogueLines(lines, onFinish = null) {
    if (!lines || !lines.length) {
      if (onFinish) onFinish();
      return;
    }
    if (drawerOpen) closeDrawer();
    const bar = document.getElementById("story-dialogue-bar");
    if (!cutscene.active) {
      const ae = document.activeElement;
      if (ae && ae !== document.body && !(bar && bar.contains(ae)) && isElementFocusable(ae)) {
        cutscene.triggerEl = ae;
      } else {
        cutscene.triggerEl = null;
      }
    }
    if (typeof captureHeldKeysInto === "function") {
      captureHeldKeysInto(cutscene.heldKeysUntilRelease);
    }
    clearTransientInputs();
    cutscene.inputGuardUntil = performance.now() + DIALOGUE_INPUT_GUARD_MS;
    cutscene.active = true;
    cutscene.lines = lines;
    cutscene.idx = 0;
    let finishFired = false;
    cutscene.onFinish = typeof onFinish === "function" ? () => {
      if (finishFired) return;
      finishFired = true;
      onFinish();
    } : null;
    if (!cutscenePauseToken) cutscenePauseToken = acquirePauseToken("cutscene", "dialogue");
    if (typeof updateComboRankSeal === "function") updateComboRankSeal();
    if (typeof renderQuestTracker === "function") renderQuestTracker();
    renderCutsceneStep();
  }

  function playCutscene(key, onFinish = null) {
    if (!game) return;
    if (game.seenCutscenes && game.seenCutscenes[key]) {
      if (onFinish) onFinish();
      return;
    }
    const seq = resolveCutsceneLines(key, game);
    if (!seq || !seq.length) {
      if (onFinish) onFinish();
      return;
    }
    if (!game.seenCutscenes) game.seenCutscenes = {};
    game.seenCutscenes[key] = true;
    playCustomDialogueLines(seq, onFinish);
  }

  function canAffordStoryOpt(g, opt) {
    if (!g || !opt) return false;
    if (opt.stonesCost && (g.stones || 0) < opt.stonesCost) return false;
    if (opt.cost) {
      for (const [ik, req] of Object.entries(opt.cost)) {
        if ((g.inventory[ik] || 0) < req) return false;
      }
    }
    return true;
  }

  function playStoryEventInPortraitBar(storyId, onFinish = null) {
    if (!game) return false;
    if (!guardNotInTribulation("故人机缘演绎")) return false;
    if (!guardNotPracticeMode("故人机缘演绎")) return false;
    const stSpec = STORIES.find(s => s.id === storyId);
    if (!stSpec || game.choices[storyId]) return false;
    const npc = NPC_META[stSpec.npc];
    if (!npc) return false;
    closeModal();
    closeDrawer();
    const ks = getKarmaState(game);
    const karmaNote = ks.mode === "demonic"
      ? "（对方望向你周身血煞剑气，神色微凝却仍以礼相待）"
      : ks.mode === "righteous"
        ? "（对方感你太清正气，眼中露出欣然之意）"
        : "";
    playCustomDialogueLines([
      {
        art: npc.art,
        role: `${npc.role} · 第${stSpec.chapter}卷 · ${getStoryLocationLabel(stSpec.location)}`,
        speaker: npc.name,
        text: `${stSpec.body}${karmaNote ? " " + karmaNote : ""}`,
        storyId: stSpec.id,
        choices: stSpec.options
      }
    ], onFinish);
    return true;
  }

  function resolveStoryChoice(sid, oid, fromPortraitBar = false) {
    if (!game) return false;
    if (!guardNotInTribulation("故人机缘演绎")) return false;
    if (!guardNotPracticeMode("故人机缘演绎")) return false;
    const stSpec = STORIES.find(s => s.id === sid);
    const opt = stSpec ? stSpec.options.find(o => o.id === oid) : null;
    if (!stSpec || !opt || game.choices[sid]) return false;

    if (opt.stonesCost && game.stones < opt.stonesCost) {
      showToast(`需 ${opt.stonesCost} 灵石`);
      return false;
    }
    if (opt.cost) {
      for (const [ik, req] of Object.entries(opt.cost)) {
        if ((game.inventory[ik] || 0) < req) {
          showToast(`需 ${ITEMS[ik].name} ×${req}（可赴历练获取）`);
          return false;
        }
      }
    }
    if (opt.stonesCost) game.stones -= opt.stonesCost;
    if (opt.cost) {
      for (const [ik, req] of Object.entries(opt.cost)) game.inventory[ik] -= req;
    }
    if (opt.stonesGain) game.stones += opt.stonesGain;
    if (opt.gain) {
      for (const [ik, n] of Object.entries(opt.gain)) game.inventory[ik] = (game.inventory[ik] || 0) + n;
    }
    if (opt.xpGain) gainRealmXp(opt.xpGain);
    if (opt.aid) game.aids[opt.aid] = true;
    if (opt.dao) {
      Object.entries(opt.dao).forEach(([dk, dv]) => { game.dao[dk] = (game.dao[dk] || 0) + dv; });
    }
    // Completing a companion story also naturally advances their bond tier up to 3!
    if (!game.bondTiers) game.bondTiers = { shen: 1, pei: 0, lu: 0, yan: 0 };
    const prevTier = getCompanionBondTier(game, stSpec.npc);
    if (prevTier < 3) game.bondTiers[stSpec.npc] = Math.min(3, prevTier + 1);
    game.aids[stSpec.npc] = true;

    game.choices[sid] = oid;
    if (Array.isArray(game.journal)) {
      game.journal.unshift(`【故人机缘 · ${NPC_META[stSpec.npc].name}】《${stSpec.name}》：${opt.label}`);
    }
    Sound.fanfare();
    showToast(opt.result || "故人盟契已成！");
    queueNewUnlockCardsForState(game);
    saveGame();
    updateHud();

    const npc = NPC_META[stSpec.npc];
    if (fromPortraitBar && npc) {
      const kp = COMPANION_KEEPSAKES[stSpec.npc];
      const newTier = getCompanionBondTier(game, stSpec.npc);
      const tierLine = newTier > prevTier ? `（羁绊晋升：【${kp.tierTitles[newTier]}】${newTier >= 3 ? ` · 信物【${kp.keepsake}】已觉醒！` : ""}）` : "";
      playCustomDialogueLines([
        {
          art: npc.art,
          role: `${npc.role} · 盟契已成`,
          speaker: npc.name,
          text: `${opt.result || "故人盟契已成！"}${tierLine}`,
          finalBtnLabel: "礼成收卷 ▸"
        }
      ]);
    } else if (drawerOpen) {
      renderDrawerContent();
    }
    return true;
  }

  function renderCutsceneStep() {
    const bar = document.getElementById("story-dialogue-bar");
    if (!bar) return;
    if (!cutscene.active || cutscene.idx >= cutscene.lines.length) {
      cutscene.active = false;
      cutscene.inputGuardUntil = 0;
      if (cutscene.heldKeysUntilRelease) cutscene.heldKeysUntilRelease.clear();
      bar.classList.remove("open");
      if (document.activeElement && bar.contains(document.activeElement) && typeof document.activeElement.blur === "function") {
        try { document.activeElement.blur(); } catch (e) {}
      }
      const chBox = document.getElementById("dlg-choices-box");
      if (chBox) { chBox.innerHTML = ""; chBox.style.display = "none"; }
      const bd = document.getElementById("modal-backdrop");
      const prevCutTok = cutscenePauseToken;
      cutscenePauseToken = null;
      releasePauseToken(prevCutTok);
      const cb = cutscene.onFinish;
      const savedTrigger = cutscene.triggerEl;
      cutscene.onFinish = null;
      cutscene.triggerEl = null;
      if (cb) cb();
      renderOnboardingCoach();
      if (typeof renderQuestTracker === "function") renderQuestTracker();
      if (typeof updateComboRankSeal === "function") updateComboRankSeal();
      const modalNowOpen = !!(bd && bd.classList.contains("open"));
      if (!cutscene.active && !modalNowOpen && !drawerOpen) {
        restoreTriggerFocus(savedTrigger);
        setTimeout(() => requestCalmReevaluation(), 0);
      }
      return;
    }
    const line = cutscene.lines[cutscene.idx];
    Sound.dialogueCue();
    document.getElementById("dlg-portrait-img").src = ART[line.art] || ART.char_player;
    document.getElementById("dlg-role-seal").textContent = line.role;
    document.getElementById("dlg-speaker-name").textContent = line.speaker === "顾长青" ? (game ? game.name : "顾长青") : line.speaker;
    document.getElementById("dlg-text-content").textContent = line.text;

    const chBox = document.getElementById("dlg-choices-box");
    const nextBtn = document.getElementById("btn-dlg-next");
    const skipBtn = document.getElementById("btn-dlg-skip");
    if (line.choices && line.choices.length && chBox) {
      cutscene.inputGuardUntil = Math.max(cutscene.inputGuardUntil || 0, performance.now() + DIALOGUE_INPUT_GUARD_MS);
      if (typeof captureHeldKeysInto === "function") {
        captureHeldKeysInto(cutscene.heldKeysUntilRelease);
      }
      chBox.style.display = "flex";
      chBox.innerHTML = line.choices.map(o => {
        const ok = canAffordStoryOpt(game, o);
        return `<button type="button" class="dlg-choice-btn" data-story-bar-id="${escapeHtml(line.storyId)}" data-story-bar-opt="${escapeHtml(o.id)}" ${ok ? "" : "disabled"}>
          <div style="display:flex;flex-direction:column;gap:2px;">
            <strong style="font-size:12.5px;color:#fff3c4;">${escapeHtml(o.label)}</strong>
            <span style="font-size:10.5px;color:#80ffea;">${escapeHtml(o.detail)}</span>
          </div>
          <span class="tag-chip ${ok ? "done" : ""}">${ok ? "抉择 ▸" : "灵材不足"}</span>
        </button>`;
      }).join("");
      if (nextBtn) nextBtn.style.display = "none";
      if (skipBtn) skipBtn.textContent = "暂缓离开";
    } else {
      if (chBox) { chBox.innerHTML = ""; chBox.style.display = "none"; }
      if (nextBtn) {
        nextBtn.style.display = "inline-flex";
        const rawLabel = line.finalBtnLabel || (cutscene.idx >= cutscene.lines.length - 1 ? "拔剑启程 ▸" : "继续 ▸");
        nextBtn.textContent = `Enter ${rawLabel}`;
      }
      if (skipBtn) skipBtn.textContent = "跳过";
    }
    bar.classList.add("open");
    renderOnboardingCoach();
    const firstChoice = (line.choices && line.choices.length && chBox)
      ? chBox.querySelector(".dlg-choice-btn:not([disabled])")
      : null;
    if (firstChoice && typeof firstChoice.focus === "function") {
      try { firstChoice.focus({ preventScroll: true }); } catch (e) {}
    } else if (nextBtn && nextBtn.style.display !== "none" && !nextBtn.disabled) {
      try { nextBtn.focus({ preventScroll: true }); } catch (e) {}
    } else {
      focusDialogSafely(bar);
    }
  }

  function advanceCutscene(skipAll = false) {
    if (!cutscene.active) return;
    Sound.pluck(523.25, 0.14, 0.05, "sine");
    if (skipAll) cutscene.idx = cutscene.lines.length;
    else cutscene.idx += 1;
    renderCutsceneStep();
  }

  const SWORD_STANCES = [
    { id: "hunt",  name: "游龙阵", badge: "游龙追猎 · 自动叠剑印", color: "#4ad2b8", cls: "stance-hunt", icon: "icon_blade" },
    { id: "ring",  name: "剑轮阵", badge: "护体剑轮 · 绞杀斩弹幕", color: "#70ffe6", cls: "stance-ring", icon: "icon_seal" },
    { id: "giant", name: "巨阙阵", badge: "万剑归宗 · 玄天巨剑重劈", color: "#ffe28a", cls: "stance-giant", icon: "relic_frost_sword" }
  ];

  const SYNERGIES = [
    {
      id: "zhuxian", name: "诛仙剑阵", condText: "万剑归宗 + 太虚神速（或飞剑≥9）",
      desc: "左键第三式终结技进化为【三道扇形太极旋风剑轮】齐发绞杀！",
      active: g => hasLaw(g, "wanjian") && (hasLaw(g, "void_haste") || getSwordCount(g) >= 9)
    },
    {
      id: "thunder_emp", name: "九天雷帝", condText: "阴阳剑符 + 紫霄雷体（或紫霄雷符宗）",
      desc: "右键【爆剑】引动九霄紫金天雷柱轰击所有带剑印目标！",
      active: g => (hasLaw(g, "yinyang") && hasLaw(g, "thunder_body")) || (g && g.school === "talisman" && (hasLaw(g, "yinyang") || hasLaw(g, "thunder_body")))
    },
    {
      id: "sky_cleave", name: "一剑开天", condText: "刹那芳华 + 破阵惊雷",
      desc: "每次打空妖兽架势触发全屏金色十字【开天剑罡】重创群妖！",
      active: g => hasLaw(g, "crit_lotus") && hasLaw(g, "stagger_surge")
    },
    {
      id: "immortal_lotus", name: "青莲不灭", condText: "生生造化 + 丹火不息",
      desc: "服用灵丹瞬间展开2.5秒不灭金莲真身并震爆全屏丹火！",
      active: g => hasLaw(g, "eternal_spring") && hasLaw(g, "pill_fire")
    }
  ];

  const ASCENSION_ENDINGS = [
    { id: "sword_sovereign", art: "relic_frost_sword",   name: "独断九霄 · 太虚剑帝", tag: "锋芒证道", bonusPts: 360, desc: "以三尺青锋斩破天门万古禁制，于九霄云外开辟太虚剑界，护佑后世万千剑修。" },
    { id: "mortal_guardian", art: "relic_cloud_mirror",  name: "留道人间 · 悬壶真仙", tag: "仁心证道", bonusPts: 360, desc: "天门既开却回首青山，化仙元为九州甘霖药阵，与故人共守人间万家灯火。" },
    { id: "carefree_sage",   art: "item_ascension_seal", name: "踏歌沧海 · 逍遥散仙", tag: "本真证道", bonusPts: 360, desc: "不受天庭敕封，携灵兽故友泛舟星河云海，天地浩渺任吾往来。" }
  ];

  const BAGUA_GLYPHS = ["☰", "☱", "☲", "☳", "☴", "☵", "☶", "☷"];


  function getPlazaCenter(w, h) {
    const stg = arena.sanctumMode ? STAGES[1] : arena.towerMode ? STAGES[3] : STAGES[arena.stageIdx];
    return { x: w * 0.50, y: h * stg.cy };
  }

  function clampToPlaza(x, y, w, h) {
    const stg = arena.sanctumMode ? STAGES[1] : arena.towerMode ? STAGES[3] : STAGES[arena.stageIdx];
    const cx = w * 0.50;
    const cy = h * stg.cy;
    const rx = w * stg.rx;
    const ry = h * stg.ry;
    let dx = x - cx, dy = y - cy;
    if (stg.shape === "diamond") {
      const manhattan = Math.abs(dx) / rx + Math.abs(dy) / ry;
      if (manhattan > 1.0) { dx /= manhattan; dy /= manhattan; }
    } else {
      const ell = Math.hypot(dx / rx, dy / ry);
      if (ell > 1.0) { dx /= ell; dy /= ell; }
    }
    return { x: cx + dx, y: cy + dy };
  }

  const LAW_SHORT_BADGE = {
    wanjian: "飞剑 +1", yinyang: "雷火链电", crit_lotus: `暴击 +${Math.round(COMBAT_RULE_PARAMS.laws.crit_lotus.crit * 100)}%`,
    stagger_surge: "破势绞杀+", pill_fire: "服丹震爆", nine_pill: "双倍仙丹",
    wealth_power: "灵石增威", thunder_body: "周身落雷", eternal_spring: "常驻回血",
    void_haste: "幻影剑分身", beast_soul: "灵兽狂暴", relic_awake: "大招减CD",
    age_might: "巨型剑气", karma_resonance: "双倍助阵", destiny_eye: "双倍掉宝"
  };
  const LAW_ICONS = {
    wanjian: "relic_frost_sword", yinyang: "icon_seal", crit_lotus: "item_lotus",
    stagger_surge: "icon_blade", pill_fire: "item_healing_pill", nine_pill: "furnace",
    wealth_power: "item_jade", thunder_body: "relic_soul_lamp", eternal_spring: "item_dew",
    void_haste: "actor_player_battle", beast_soul: "pet_fox", relic_awake: "relic_jade_seal",
    age_might: "icon_scroll", karma_resonance: "char_shen", destiny_eye: "item_rough_jade"
  };

  const DIALOGUE_INPUT_GUARD_MS = 400;
  const physicalKeysDown = new Set();
  const keysDown = {};
  const pointer = { x: 720, y: 450, down: false, holdTime: 0, worldActive: false, moveTarget: null };
  let lastCanvasCombatClickAt = 0;

  function captureHeldKeysInto(targetSet) {
    if (!targetSet || typeof targetSet.add !== "function") return;
    targetSet.clear();
    physicalKeysDown.forEach(code => targetSet.add(code));
    Object.keys(keysDown).forEach(code => {
      if (keysDown[code]) targetSet.add(code);
    });
  }

  function isCutsceneInputGuarded(code = null, isRepeat = false) {
    if (isRepeat) return true;
    if (cutscene.inputGuardUntil && performance.now() < cutscene.inputGuardUntil) return true;
    if (code && cutscene.heldKeysUntilRelease && cutscene.heldKeysUntilRelease.has(code)) return true;
    return false;
  }

  function clearTransientInputs() {
    Object.keys(keysDown).forEach(k => { keysDown[k] = false; });
    pointer.down = false;
    pointer.holdTime = 0;
    pointer.worldActive = false;
    pointer.moveTarget = null;
  }
  window.addEventListener("blur", () => {
    clearTransientInputs();
    physicalKeysDown.clear();
    if (cutscene.heldKeysUntilRelease) cutscene.heldKeysUntilRelease.clear();
    if (typeof modalInputGuard !== "undefined" && modalInputGuard && modalInputGuard.heldKeysUntilRelease) {
      modalInputGuard.heldKeysUntilRelease.clear();
    }
    if (typeof stopHoldProgression === "function") stopHoldProgression("window_blur");
  });

  let pendingCompareGear = null;
  let activeRunBoonChoices = [];

  const arena = {
    paused: false,
    stageEpoch: 0,
    stageClearHandledEpoch: -1,
    stageClearPending: false,
    waveTransitioning: false,
    sourceCd: 0,
    hitStop: 0,
    shake: 0,
    flash: 0,
    flashColor: "#fff6d6",
    stageIdx: 0,
    waveIdx: 0,
    roomBranch: "combat",   // 'combat' | 'elite_loot' | 'merchant_event' | ...
    dungeonMap: null,       // M2 5-layer branching expedition star-map
    runBoons: [],           // M2 run-scoped roguelite boons
    boonRerollsLeft: 1,
    slashEchoCounter: 0,
    sanctumMode: false,     // True when inside Peaceful Sect/Cave Hub!
    towerMode: false,
    midEventSpawned: false,
    stanceIdx: 0,
    comboCount: 0,
    comboTimer: 0,
    stageElement: null,
    domain: null,
    giantSword: { x: 520, y: 420, z: 45, state: "hover", timer: 0.9, targetX: 520, targetY: 480, ang: -Math.PI / 2, slamAlpha: 0 },
    player: {
      x: 520, y: 480, z: 0, vz: 0, vx: 0, vy: 0, facing: 1, bob: 0, lean: 0,
      animState: "idle", animT: 0, animDur: 0.25, hitFlash: 0, recoilDir: 0,
      airComboStep: 0, plunging: false, vaultPrimed: false, jumpCd: 0, blinkCd: 0,
      samadhiFireReady: false, gourdHasteTimer: 0, gourdCritTimer: 0, boonOverloadTimer: 0, righteousPulseCd: 4.0,
      meditating: false, meditateTick: 0, meditateAgeTick: 0, meditateAgedDirty: false, zenStacks: 0, petBuffTimer: 0,
      comboStep: 0, comboWindow: 0, stepRippleCd: 0,
      dashTimer: 0, dashCd: 0, invuln: 0, shieldHp: 0,
      slashCd: 0, recallCd: 0, ultCd: 0, allyCd: 0,
      afterimages: [],
      scarfPts: []
    },
    swords: [],
    enemies: [],
    projectiles: [],
    drops: [],
    props: [],
    zones: [],
    slashes: [],
    lightnings: [],
    decals: [],
    sparks: [],
    ripples: [],
    qiStreams: [],
    ambientMotes: [],
    deathAnims: [],
    activeAllies: [],
    skyBolts: [],
    camZoom: 1.0,
    petUltCd: 0,
    stageTechDone: false,
    maxStageCombo: 0,
    shockRings: [],
    bossBeams: [],
    bladeArcs: [],
    lotusVortexes: [],
    thunderOrbs: [],
    jadeDecoys: [],
    frostPools: [],
    witchTime: 0,
    bossDomain: null,
    camFocusX: 0,
    camFocusY: 0,
    camFocusT: 0,
    camKickX: 0,
    camKickY: 0,
    morphCd: 0,
    swordIntent: 0,
    ultCineTimer: 0,
    reversedDomainTimer: 0,
    waterPools: [],
    fireZones: [],
    inputBuffer: [],
    softLockTarget: null,
    dojoMode: "static",
    dojoSession: null,
    showTelemetry: false,
    showHitboxes: false,
    currentDmgBucket: "combo_morph",
    dmgBreakdown: { combo_morph: 0, flying_swords: 0, thunder_elem: 0, ally_pet: 0, deflect_ult: 0 },
    dmgRolling: [],
    peakHit: 0,
    parryCount: 0,
    witchCount: 0,
    encounterTelemetry: createFreshEncounterTelemetry(),
    inputChain: [],
    weaponPosture: "qinglian", // 'qinglian' (青莲疾剑式) | 'xuanzhong' (玄重巨阙式)
    switchMorphCd: 0,
    switchVfxList: [],
    distortionRings: [],
    bossRush: null,
    rushAffixes: [],
    groundSweeps: [],
    meteorBursts: [],
    blinkStreaks: [],
    impactFrames: 0,
    impactAccent: "#e62e2d",
    impactX: 720,
    impactY: 450,
    soulCd: 0,
    soulAvatars: [],
    bladeClash: null,
    clashVfxList: [],
    styleScore: 0,
    styleDecayTimer: 0,
    recentMoveHistory: [],
    ghostRecorder: { recording: false, playing: false, elapsed: 0, playTime: 0, frames: [] },
    frameTimes: [],
    floats: [],
    tribulation: null,
    calmT: 0,
    calmFlushed: false,
    pickupAgg: {},
    clearSettle: null,
    pendingClearSummary: null,
    rainIntensity: 1.0
  };

  function isClearSettling() {
    return Boolean(arena && arena.clearSettle && arena.clearSettle.active);
  }

  // ==================== V17 BOSS WEAKPOINT CORES, TRIAL AFFIXES & DUAL-POSTURE SPECS ====================
  const BOSS_WEAKPOINTS = {
    wolf:          { partName: "本命血月妖丹", shortName: "血月妖丹", severDesc: "废除血月三连撕裂爪（退化为单爪）" },
    warden:        { partName: "玄黄护心阵核", shortName: "护心阵核", severDesc: "废除九宫裂地巨震（震波缩减60%）" },
    serpent:       { partName: "九幽寒髓逆鳞", shortName: "寒髓逆鳞", severDesc: "永久废除玄冥冰封寒潮" },
    puppet:        { partName: "古冢中枢剑印", shortName: "中枢剑印", severDesc: "永久废除铜镜反震与四象剑阵" },
    shadow:        { partName: "噬魂暗影魔核", shortName: "暗影魔核", severDesc: "废除噬影瞬步偷袭与吸血" },
    sentinel:      { partName: "紫霄雷罚天眼", shortName: "雷罚天眼", severDesc: "永久废除旋空妖光激光扫射" },
    trial_heart:   { partName: "往昔执念心核", shortName: "执念心核", severDesc: "废除心魔噬血与瞬步" },
    trial_thunder: { partName: "九霄劫雷法眼", shortName: "劫雷法眼", severDesc: "大幅削弱劫雷范围" },
    trial_gate:    { partName: "太虚天门阵枢", shortName: "天门阵枢", severDesc: "永久废除天门旋空神罚光束" }
  };

  const RUSH_AFFIX_SPECS = [
    { id: "rush_haste",      name: "极速凶煞", mult: 0.25, desc: "连战妖王移速与蓄势提速 +25%，积分倍率 +25%" },
    { id: "rush_parry_only", name: "唯识破防", mult: 0.35, desc: "妖王披玄罡重甲，唯【玄重巨阙/太虚易剑斩/识破剑反】贯入全伤，积分 +35%" },
    { id: "rush_thunder",    name: "狂暴雷狱", mult: 0.25, desc: "万剑冢天雷不息轰击灵泉水洼，双向高危感电，积分 +25%" },
    { id: "rush_glass",      name: "一剑生死", mult: 0.45, desc: "自身气血上限折半，但全流派剑威暴涨 +55%，积分 +45%" }
  ];

  const BOSS_RUSH_ROSTER = [
    { bout: 1, id: "wolf",          title: "第一阵 · 雾隐狼王",       art: "enemy_wolf",         mult: 0.48, atkMult: 0.76 },
    { bout: 2, id: "warden",        title: "第二阵 · 守山石卫",       art: "enemy_warden",       mult: 0.56, atkMult: 0.82 },
    { bout: 3, id: "serpent",       title: "第三阵 · 寒潭玄蛇",       art: "enemy_serpent",      mult: 0.65, atkMult: 0.88 },
    { bout: 4, id: "puppet",        title: "第四阵 · 古境剑傀",       art: "enemy_puppet",       mult: 0.74, atkMult: 0.94 },
    { bout: 5, id: "sentinel",      title: "第五阵 · 云台守灵",       art: "enemy_sentinel",     mult: 0.84, atkMult: 1.00 },
    { bout: 6, id: "inner_demon",   title: "第六阵 · 太虚心魔镜像",   art: "actor_inner_demon",  mult: 0.96, atkMult: 1.06, isDemon: true },
    { bout: 7, id: "zhulong_titan", title: "神话终阵 · 太古烛龙法相", art: "boss_zhulong_titan", mult: 1.24, atkMult: 1.15, isTitan: true }
  ];

  // ==================== V20 20TH-GENERATION GODHOOD MILESTONE DATA & ACCESSIBILITY STATE ====================
  const A11Y_STORAGE_KEY = "chenyuan_a11y_v20";
  const reducedMotionMq = (typeof window.matchMedia === "function") ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const a11ySettings = {
    shakeScale: 1.0,      // 0.0 (0%) ~ 1.5 (150%)
    hitStopScale: 1.0,    // 0.0 (0%) ~ 1.5 (150%)
    colorblindGlyphs: true,
    autoComboAssist: false,
    reducedMotion: false,
    enhancedVisualLayers: true,
    combatNoticeLevel: "lite" // "full" | "lite" | "minimal"
  };
  function isReducedMotionActive() {
    return Boolean(
      (a11ySettings && a11ySettings.reducedMotion) ||
      (reducedMotionMq && reducedMotionMq.matches)
    );
  }
  function clearTransientMotionEffects() {
    arena.shake = 0;
    arena.flash = 0;
    arena.impactFrames = 0;
    arena.radialBurst = null;
    arena.camZoom = 1.0;
    arena.camKickX = 0;
    arena.camKickY = 0;
    const veil = document.getElementById("scene-transition-veil");
    if (veil) veil.classList.remove("active");
    if (sceneTransitionTimer) {
      clearTimeout(sceneTransitionTimer);
      sceneTransitionTimer = null;
    }
    sceneTransitionState.active = false;
  }
  function applyReducedMotionClass() {
    const reduced = isReducedMotionActive();
    if (document && document.documentElement) {
      document.documentElement.classList.toggle("reduced-motion", reduced);
    }
    if (reduced) {
      clearTransientMotionEffects();
    }
  }
  function applySanitizedA11ySettings(p, { fallbackToMedia = false } = {}) {
    const prefersReduced = !!(reducedMotionMq && reducedMotionMq.matches);
    if (p && typeof p === "object" && !Array.isArray(p)) {
      if (hasOwn(p, "shakeScale") && typeof p.shakeScale === "number" && Number.isFinite(p.shakeScale)) {
        a11ySettings.shakeScale = Math.max(0, Math.min(1.5, p.shakeScale));
      }
      if (hasOwn(p, "hitStopScale") && typeof p.hitStopScale === "number" && Number.isFinite(p.hitStopScale)) {
        a11ySettings.hitStopScale = Math.max(0, Math.min(1.5, p.hitStopScale));
      }
      if (hasOwn(p, "colorblindGlyphs") && typeof p.colorblindGlyphs === "boolean") {
        a11ySettings.colorblindGlyphs = p.colorblindGlyphs;
      }
      if (hasOwn(p, "autoComboAssist") && typeof p.autoComboAssist === "boolean") {
        a11ySettings.autoComboAssist = p.autoComboAssist;
      }
      if (hasOwn(p, "enhancedVisualLayers") && typeof p.enhancedVisualLayers === "boolean") {
        a11ySettings.enhancedVisualLayers = p.enhancedVisualLayers;
      }
      if (hasOwn(p, "combatNoticeLevel") && ["full", "lite", "minimal"].includes(p.combatNoticeLevel)) {
        a11ySettings.combatNoticeLevel = p.combatNoticeLevel;
      }
      if (hasOwn(p, "reducedMotion") && typeof p.reducedMotion === "boolean") {
        a11ySettings.reducedMotion = p.reducedMotion;
      } else if (fallbackToMedia) {
        a11ySettings.reducedMotion = prefersReduced;
      }
      if (a11ySettings.reducedMotion && !(hasOwn(p, "shakeScale") && typeof p.shakeScale === "number" && Number.isFinite(p.shakeScale))) {
        a11ySettings.shakeScale = 0;
      }
      if (a11ySettings.reducedMotion && !(hasOwn(p, "hitStopScale") && typeof p.hitStopScale === "number" && Number.isFinite(p.hitStopScale))) {
        a11ySettings.hitStopScale = 0;
      }
    } else if (fallbackToMedia && prefersReduced) {
      a11ySettings.reducedMotion = true;
      a11ySettings.shakeScale = 0;
      a11ySettings.hitStopScale = 0;
    }
    if (!["full", "lite", "minimal"].includes(a11ySettings.combatNoticeLevel)) {
      a11ySettings.combatNoticeLevel = "lite";
    }
    applyReducedMotionClass();
  }
  function loadA11ySettings() {
    const prefersReduced = !!(reducedMotionMq && reducedMotionMq.matches);
    try {
      const raw = localStorage.getItem(A11Y_STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        applySanitizedA11ySettings(p, { fallbackToMedia: true });
      } else {
        applySanitizedA11ySettings(null, { fallbackToMedia: true });
      }
    } catch (e) {
      if (prefersReduced) {
        a11ySettings.reducedMotion = true;
        a11ySettings.shakeScale = 0;
        a11ySettings.hitStopScale = 0;
      }
      applyReducedMotionClass();
    }
  }
  function saveA11ySettings() {
    try { localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(a11ySettings)); } catch (e) {}
  }
  loadA11ySettings();
  if (reducedMotionMq && typeof reducedMotionMq.addEventListener === "function") {
    reducedMotionMq.addEventListener("change", (ev) => {
      if (ev.matches) {
        a11ySettings.reducedMotion = true;
        a11ySettings.shakeScale = 0;
        a11ySettings.hitStopScale = 0;
      }
      applyReducedMotionClass();
    });
  }

  // ==================== Q4 (F27/F29) IN-MEMORY PERF TELEMETRY & PLAYTEST TELEMETRY (NEVER PERSISTED TO SAVES!) ====================
  const PERF_RING_CAP = 600;
  const perfTelemetry = {
    bootTs: performance.now(),
    firstInteractiveMs: null,
    firstPlayableMs: null,
    ring: new Float64Array(PERF_RING_CAP),
    head: 0,
    count: 0,
    totalFrames: 0,
    longFrames33: 0,
    longFrames50: 0,
    maxFrameMs: 0,
    rollingAvgMs: 16.67,
    slowStreak1: 0,
    slowStreak2: 0,
    degradeLevel: 0,
    degradeOverride: null
  };
  function recordPerfFrameSample(rawFrameMs) {
    if (!Number.isFinite(rawFrameMs) || rawFrameMs < 0) return;
    if (perfTelemetry.firstInteractiveMs === null) {
      perfTelemetry.firstInteractiveMs = Number((performance.now() - perfTelemetry.bootTs).toFixed(1));
    }
    const ws = document.getElementById("welcome-screen");
    if (perfTelemetry.firstPlayableMs === null && game && (!ws || ws.style.display === "none")) {
      perfTelemetry.firstPlayableMs = Number((performance.now() - perfTelemetry.bootTs).toFixed(1));
    }
    perfTelemetry.ring[perfTelemetry.head] = rawFrameMs;
    perfTelemetry.head = (perfTelemetry.head + 1) % PERF_RING_CAP;
    if (perfTelemetry.count < PERF_RING_CAP) perfTelemetry.count += 1;
    perfTelemetry.totalFrames += 1;
    if (rawFrameMs > 33.33) perfTelemetry.longFrames33 += 1;
    if (rawFrameMs > 50.0) perfTelemetry.longFrames50 += 1;
    if (rawFrameMs > perfTelemetry.maxFrameMs) perfTelemetry.maxFrameMs = rawFrameMs;
    // Ignore initial boot/warm-up frames or tab-switch spikes for automatic degradation hysteresis
    if (perfTelemetry.totalFrames > 20 && rawFrameMs < 250) {
      perfTelemetry.rollingAvgMs = perfTelemetry.rollingAvgMs * 0.92 + Math.min(80, rawFrameMs) * 0.08;
      if (perfTelemetry.rollingAvgMs > 28) perfTelemetry.slowStreak1 += 1;
      else perfTelemetry.slowStreak1 = Math.max(0, perfTelemetry.slowStreak1 - 1);
      if (perfTelemetry.rollingAvgMs > 42) perfTelemetry.slowStreak2 += 1;
      else perfTelemetry.slowStreak2 = Math.max(0, perfTelemetry.slowStreak2 - 1);
    }
    if (perfTelemetry.degradeOverride === null) {
      if (perfTelemetry.slowStreak2 >= 18) perfTelemetry.degradeLevel = 2;
      else if (perfTelemetry.slowStreak1 >= 12) perfTelemetry.degradeLevel = 1;
      else if (perfTelemetry.rollingAvgMs < 22 && perfTelemetry.slowStreak1 === 0) perfTelemetry.degradeLevel = 0;
    } else {
      perfTelemetry.degradeLevel = perfTelemetry.degradeOverride;
    }
  }
  function getEffectivePerfDegradeLevel() {
    return perfTelemetry.degradeOverride !== null ? perfTelemetry.degradeOverride : perfTelemetry.degradeLevel;
  }
  function setPerfDegradeOverride(level) {
    if (level === null || level === undefined) {
      perfTelemetry.degradeOverride = null;
      perfTelemetry.degradeLevel = 0;
      perfTelemetry.slowStreak1 = 0;
      perfTelemetry.slowStreak2 = 0;
      return getEffectivePerfDegradeLevel();
    }
    const n = Math.max(0, Math.min(2, Math.floor(Number(level) || 0)));
    perfTelemetry.degradeOverride = n;
    perfTelemetry.degradeLevel = n;
    return n;
  }
  function resetPerfStats() {
    perfTelemetry.ring.fill(0);
    perfTelemetry.head = 0;
    perfTelemetry.count = 0;
    perfTelemetry.totalFrames = 0;
    perfTelemetry.longFrames33 = 0;
    perfTelemetry.longFrames50 = 0;
    perfTelemetry.maxFrameMs = 0;
    perfTelemetry.rollingAvgMs = 16.67;
    perfTelemetry.slowStreak1 = 0;
    perfTelemetry.slowStreak2 = 0;
    if (perfTelemetry.degradeOverride === null) perfTelemetry.degradeLevel = 0;
  }
  function getPerfStats() {
    const n = perfTelemetry.count;
    let p50Ms = 0, p95Ms = 0, p99Ms = 0;
    if (n > 0) {
      const sorted = Array.from(perfTelemetry.ring.subarray(0, n)).sort((a, b) => a - b);
      p50Ms = Number(sorted[Math.min(n - 1, Math.floor(n * 0.50))].toFixed(2));
      p95Ms = Number(sorted[Math.min(n - 1, Math.floor(n * 0.95))].toFixed(2));
      p99Ms = Number(sorted[Math.min(n - 1, Math.floor(n * 0.99))].toFixed(2));
    }
    return {
      sampleCount: n,
      totalFrames: perfTelemetry.totalFrames,
      firstInteractiveMs: perfTelemetry.firstInteractiveMs,
      firstPlayableMs: perfTelemetry.firstPlayableMs,
      p50Ms,
      p95Ms,
      p99Ms,
      maxFrameMs: Number(perfTelemetry.maxFrameMs.toFixed(2)),
      longFrames33: perfTelemetry.longFrames33,
      over33msCount: perfTelemetry.longFrames33,
      longFrames50: perfTelemetry.longFrames50,
      degradeLevel: getEffectivePerfDegradeLevel(),
      degradeOverride: perfTelemetry.degradeOverride,
      entityCounts: {
        enemies: arena.enemies.length,
        projectiles: arena.projectiles.length,
        sparks: arena.sparks.length,
        props: arena.props.length,
        floats: arena.floats.length
      }
    };
  }

  function createFreshPlaytestTelemetry() {
    return {
      protocolStatus: "NOT_RUN",
      sessionStartedAt: Date.now(),
      firstAttackMs: null,
      firstAttackSec: null,
      pedestalChoice: null,
      pedestalChoiceSec: null,
      sanctumEnterCount: 0,
      sanctumFirstUpgradeSec: null,
      sanctumUpgrades: [],
      returnToWildernessSec: null,
      menuOpenCount: 0,
      menuDwellMs: 0,
      menuDwellSec: 0,
      _menuOpenAt: null,
      defeatCount: 0,
      defeatAttribution: [],
      parrySuccessCount: 0,
      perfectDodgeCount: 0,
      schoolPreference: "unclassified",
      tribulationAttempts: 0,
      tribulationResult: null
    };
  }
  const playtestTelemetry = createFreshPlaytestTelemetry();
  function resetPlaytestTelemetry() {
    const fresh = createFreshPlaytestTelemetry();
    Object.keys(playtestTelemetry).forEach(k => delete playtestTelemetry[k]);
    Object.assign(playtestTelemetry, fresh);
  }
  function notePlaytestMenuOpen() {
    playtestTelemetry.menuOpenCount += 1;
    if (playtestTelemetry._menuOpenAt === null) playtestTelemetry._menuOpenAt = performance.now();
  }
  function notePlaytestMenuClose() {
    if (playtestTelemetry._menuOpenAt !== null) {
      const modalOpen = !!(document.getElementById("modal-backdrop") && document.getElementById("modal-backdrop").classList.contains("open"));
      if (!modalOpen && !drawerOpen) {
        playtestTelemetry.menuDwellMs += Math.max(0, performance.now() - playtestTelemetry._menuOpenAt);
        playtestTelemetry.menuDwellSec = Number((playtestTelemetry.menuDwellMs / 1000).toFixed(2));
        playtestTelemetry._menuOpenAt = null;
      }
    }
  }
  function getPlaytestTelemetry() {
    const school = game && game.loadout
      ? (isThunderBuild(game) ? "thunder_talisman" : "flying_sword")
      : "unclassified";
    return {
      protocolStatus: playtestTelemetry.protocolStatus,
      sessionStartedAt: playtestTelemetry.sessionStartedAt,
      elapsedSec: Number(((Date.now() - playtestTelemetry.sessionStartedAt) / 1000).toFixed(2)),
      firstAttackMs: playtestTelemetry.firstAttackMs,
      firstAttackSec: playtestTelemetry.firstAttackSec,
      pedestalChoice: playtestTelemetry.pedestalChoice,
      pedestalChoiceSec: playtestTelemetry.pedestalChoiceSec,
      sanctumEnterCount: playtestTelemetry.sanctumEnterCount,
      sanctumFirstUpgradeSec: playtestTelemetry.sanctumFirstUpgradeSec,
      sanctumUpgrades: playtestTelemetry.sanctumUpgrades.slice(),
      returnToWildernessSec: playtestTelemetry.returnToWildernessSec,
      menuOpenCount: playtestTelemetry.menuOpenCount,
      menuDwellSec: playtestTelemetry.menuDwellSec,
      defeatCount: playtestTelemetry.defeatCount,
      defeatAttribution: playtestTelemetry.defeatAttribution.slice(),
      parrySuccessCount: playtestTelemetry.parrySuccessCount,
      perfectDodgeCount: playtestTelemetry.perfectDodgeCount,
      schoolPreference: school,
      tribulationAttempts: playtestTelemetry.tribulationAttempts,
      tribulationResult: playtestTelemetry.tribulationResult
    };
  }
  function exportPlaytestSessionJson() {
    return JSON.stringify({
      schema: "chenyuan_playtest_telemetry_v1",
      exportedAt: new Date().toISOString(),
      viewport: { width: window.innerWidth || 1440, height: window.innerHeight || 900 },
      telemetry: getPlaytestTelemetry(),
      perf: getPerfStats()
    }, null, 2);
  }

  const WEAPON_ARSENAL_SPECS = {
    sword: {
      id: "sword", short: "🗡飞剑", name: "本命太虚飞剑",
      badge: "四段剑舞 · 万剑环身",
      desc: "均衡灵动：施展斜月→双龙→剑轮→青莲落星四段连舞，飞剑全自动索敌叠印。"
    },
    spear: {
      id: "spear", short: "🔱龙胆枪", name: "龙胆裂空剑枪",
      badge: "中远破甲突刺 · 盘龙大横扫",
      desc: "破甲霸道：化剑为 220px 龙胆神枪，中远距直线贯刺（破盾与巨神部位伤害 +65%）接盘龙大横扫！"
    },
    chakram: {
      id: "chakram", short: "☸剑轮", name: "太虚回旋剑轮",
      badge: "攻速+30% · 离手悬停锯杀",
      desc: "极速绞杀：双月回旋贴身连切（攻速+30%），并在目标处投出【离手悬停锯杀剑轮】持续聚怪切割 2.4 秒！"
    }
  };

  const PLAYABLE_COMPANIONS = {
    player: { id: "player", name: "顾长青", title: "太虚剑主", avatar: "char_player", sprite: "actor_player_battle", color: "#4ad2b8", tagMove: "万剑归宗入场斩", atkMult: 1.0, hasteMult: 1.0 },
    shen:   { id: "shen",   name: "沈清禾", title: "青莲灵剑", avatar: "actor_shen",  sprite: "actor_shen",          color: "#70ffe6", tagMove: "青莲净世剑澜",   atkMult: 1.06, hasteMult: 1.15 },
    pei:    { id: "pei",    name: "裴照",   title: "惊鸿重枪", avatar: "actor_pei",   sprite: "actor_pei",           color: "#80ecff", tagMove: "惊鸿破军龙枪",   atkMult: 1.24, hasteMult: 0.96 },
    lu:     { id: "lu",     name: "陆玄松", title: "紫微雷符", avatar: "actor_lu",    sprite: "actor_lu",            color: "#ffe28a", tagMove: "紫微天罡落雷阵", atkMult: 1.14, hasteMult: 1.05 },
    yan:    { id: "yan",    name: "砚尘",   title: "太虚影刃", avatar: "actor_yan",   sprite: "actor_yan",           color: "#d69eff", tagMove: "太虚暗影十字斩", atkMult: 1.18, hasteMult: 1.22 }
  };

  // Catmull-Rom 2D Spline Evaluator for Smooth Ink-Silk Ribbon Slash Trails (`水墨丝绸流体刀光曲面细分`)
  function evalCatmullRom2D(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }

  function buildBladeSplineSamples(ba, subdivisions = 24) {
    const ctrl = [];
    const span = ba.form === "spear_thrust" ? 0.28 : (ba.heavy ? 1.26 : 1.10);
    const dir = ba.dir || 1;
    const baseR = ba.r * (0.84 + ba.t * 0.20);
    if (ba.form === "spear_thrust") {
      // Smooth S-whip dragon-lance thrust spline
      for (let i = 0; i < 5; i++) {
        const u = i / 4;
        const dist = -28 + u * (ba.r * 1.48);
        const wave = Math.sin(u * Math.PI * 2) * 11 * (1 - u * 0.5) * dir;
        const ca = Math.cos(ba.ang), sa = Math.sin(ba.ang);
        ctrl.push({
          x: ba.x + ca * dist - sa * wave,
          y: ba.y + (sa * dist + ca * wave) * 0.64
        });
      }
    } else {
      for (let i = 0; i < 5; i++) {
        const u = (i / 4) * 2 - 1; // -1 .. +1
        const theta = ba.ang + u * span * dir;
        const rad = baseR * (1 + Math.sin((i / 4) * Math.PI) * 0.12 - Math.abs(u) * 0.08);
        ctrl.push({
          x: ba.x + Math.cos(theta) * rad,
          y: ba.y + Math.sin(theta) * rad * 0.62
        });
      }
    }
    const pts = [];
    const segs = ctrl.length - 1;
    const perSeg = Math.max(4, Math.floor(subdivisions / segs));
    for (let s = 0; s < segs; s++) {
      const p0 = ctrl[Math.max(0, s - 1)];
      const p1 = ctrl[s];
      const p2 = ctrl[s + 1];
      const p3 = ctrl[Math.min(ctrl.length - 1, s + 2)];
      for (let k = 0; k < perSeg; k++) {
        pts.push(evalCatmullRom2D(p0, p1, p2, p3, k / perSeg));
      }
    }
    pts.push(ctrl[ctrl.length - 1]);
    return pts;
  }

  function drawSmoothInkSilkRibbon(ctx, ba) {
    const lifeA = Math.max(0, 1 - ba.t);
    if (lifeA <= 0.02) return;
    const pts = buildBladeSplineSamples(ba, 24);
    if (pts.length < 4) return;
    const maxHalfW = (ba.heavy ? 18.5 : 11.5) * (0.45 + lifeA * 0.65);

    const leftOuter = [], rightOuter = [];
    const leftCore = [], rightCore = [];
    for (let i = 0; i < pts.length; i++) {
      const u = i / (pts.length - 1);
      // Smooth silk calligraphy taper: razor tip -> full belly -> brushed tail
      const profile = Math.pow(Math.sin(u * Math.PI), 0.72) * (0.35 + 0.65 * u);
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(pts.length - 1, i + 1)];
      let tx = next.x - prev.x, ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      const nx = -ty / len, ny = tx / len;
      const wOuter = maxHalfW * profile;
      const wCore = wOuter * 0.58;
      leftOuter.push({ x: pts[i].x + nx * wOuter, y: pts[i].y + ny * wOuter });
      rightOuter.push({ x: pts[i].x - nx * wOuter, y: pts[i].y - ny * wOuter });
      leftCore.push({ x: pts[i].x + nx * wCore, y: pts[i].y + ny * wCore });
      rightCore.push({ x: pts[i].x - nx * wCore, y: pts[i].y - ny * wCore });
    }

    ctx.save();
    // 1. Sumi-Ink Dark Feathered Silk Under-Wake
    ctx.globalAlpha = lifeA * 0.56;
    ctx.fillStyle = "rgba(5, 13, 18, 0.92)";
    ctx.beginPath();
    ctx.moveTo(leftOuter[0].x, leftOuter[0].y);
    for (let i = 1; i < leftOuter.length; i++) ctx.lineTo(leftOuter[i].x, leftOuter[i].y);
    for (let i = rightOuter.length - 1; i >= 0; i--) ctx.lineTo(rightOuter[i].x, rightOuter[i].y);
    ctx.closePath();
    ctx.fill();

    // 2. Luminous Mineral Silk Ribbon Body
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = lifeA * 0.94;
    const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
    grad.addColorStop(0, "rgba(255,255,255,0.08)");
    grad.addColorStop(0.55, ba.color || "#4ad2b8");
    grad.addColorStop(1, "#ffffff");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(leftCore[0].x, leftCore[0].y);
    for (let i = 1; i < leftCore.length; i++) ctx.lineTo(leftCore[i].x, leftCore[i].y);
    for (let i = rightCore.length - 1; i >= 0; i--) ctx.lineTo(rightCore[i].x, rightCore[i].y);
    ctx.closePath();
    ctx.fill();

    // 3. Razor Specular Core Spine
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = (ba.heavy ? 3.0 : 1.9) * lifeA;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pts[2].x, pts[2].y);
    for (let i = 3; i < pts.length - 1; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
  }

  function spawnDistortionRing(x, y, maxR = 175, color = "#70ffe6") {
    arena.distortionRings.push({ x, y, r: 14, maxR, t: 0, color });
    if (arena.distortionRings.length > 10) arena.distortionRings.shift();
  }
