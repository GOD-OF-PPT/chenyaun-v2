  // ==================== M3 ENGINE: SANCTUM CONSTRUCTION, LIFESPAN, COMPANION PRESENCE & KARMA WORLD ====================
  function ensureSanctumLevels(g) {
    if (!g) return { spirit_eye: 1, cauldron: 1, sword_forge: 1, scripture_hall: 1, guard_array: 1 };
    if (!g.sanctumLevels || typeof g.sanctumLevels !== "object") {
      g.sanctumLevels = { spirit_eye: 1, cauldron: 1, sword_forge: 1, scripture_hall: 1, guard_array: 1 };
    }
    ["spirit_eye", "cauldron", "sword_forge", "scripture_hall", "guard_array"].forEach(k => {
      g.sanctumLevels[k] = Math.max(1, Math.min(5, Math.floor(Number(g.sanctumLevels[k]) || 1)));
    });
    return g.sanctumLevels;
  }



  function getSanctumTotalLevel(g) {
    const lvMap = readSanctumLevelsPure(g);
    return Object.values(lvMap).reduce((s, v) => s + v, 0);
  }

  function getSanctumProsperity(g) {
    const tot = getSanctumTotalLevel(g);
    let best = SANCTUM_PROSPERITY_TIERS[0];
    for (const tier of SANCTUM_PROSPERITY_TIERS) {
      if (tot >= tier.minLv) best = tier;
    }
    return { totalLv: tot, maxTotalLv: 25, title: best.title, col: best.col };
  }

  function getSanctumNextCost(bId, curLv) {
    const spec = SANCTUM_BUILDINGS.find(b => b.id === bId);
    if (!spec || curLv >= 5) return null;
    return spec.tiers[curLv] || null;
  }

  function getMaxGourdSoaks(g) {
    const cLv = getSanctumLevel(g, "cauldron");
    return cLv >= 5 ? 5 : cLv >= 3 ? 4 : 3;
  }





  function applyLifespanPostAdvanceEffects(prevLf, nextLf, opts = {}) {
    const prevRatio = (prevLf && typeof prevLf.rawRatio === "number") ? prevLf.rawRatio : (prevLf ? prevLf.ratio : 0);
    const nextRatio = (nextLf && typeof nextLf.rawRatio === "number") ? nextLf.rawRatio : (nextLf ? nextLf.ratio : 0);
    const crossed75 = prevRatio < 0.75 && nextRatio >= 0.75;
    const crossed90 = prevRatio < 0.90 && nextRatio >= 0.90;
    const crossed95 = prevRatio < 0.95 && nextRatio >= 0.95;
    if (!(opts && opts.silentToast)) {
      const isFirst75 = Boolean(crossed75 && game && !game.seenLifespan75Tip);
      if (isFirst75) {
        if (game) game.seenLifespan75Tip = true;
        const extraEffNote = nextRatio >= 0.90
          ? `（当前已达 ${Math.floor(nextRatio * 100)}%，修炼效率已降至 ${Math.round(nextLf.xpEfficiencyMult * 100)}%）`
          : "";
        showToast(
          `⚠ 首次触及 75% 寿元提醒线（${nextLf.curYears}/${nextLf.maxYears}载）${extraEffNote}：满 90% 修炼效率降为 75%、95% 降为 50%、100% 大限降为 25% 且绝不删档；可炼制【延寿青莲丹】或渡劫破境延寿！`,
          { tier: 2, category: "other", key: "lifespan_warn_75", throttleMs: 6000 }
        );
      }
      if (crossed95 && nextLf.status === "critical") {
        showToast(`⏳ 寿元垂危（${nextLf.curYears}/${nextLf.maxYears}载），修炼效率降至 ${Math.round(nextLf.xpEfficiencyMult * 100)}%！速服延寿丹或破境！`, { tier: 2, category: "other", key: "lifespan_warn_95", throttleMs: 6000 });
      } else if (crossed90 && nextLf.status === "critical") {
        showToast(`⏳ 大限临近（${nextLf.curYears}/${nextLf.maxYears}载），修炼效率降至 ${Math.round(nextLf.xpEfficiencyMult * 100)}%！`, { tier: 2, category: "other", key: "lifespan_warn_90", throttleMs: 6000 });
      } else if (crossed75 && !isFirst75 && nextLf.status === "warning") {
        showToast(`⚠ 寿元已过 75%（${nextLf.curYears}/${nextLf.maxYears}载），宜炼制【延寿青莲丹】或破境延寿！`, { tier: 2, category: "other", key: "lifespan_warn_75", throttleMs: 6000 });
      }
    }
    const lifeBadge = document.getElementById("hud-lifespan-badge");
    if (lifeBadge) lifeBadge.classList.toggle("lifespan-pulse", nextLf.status === "exhausted");
    if (!(opts && opts.skipEnqueue) && nextLf.status === "exhausted" && !lifespanExhaustedPromptDismissed) {
      pendingLifespanExhaustedPrompt = true;
      enqueuePendingReward({ kind: "lifespan_exhausted", payload: {}, persist: true });
    }
  }

  function advanceLifespanMonths(months, reason = "", opts = {}) {
    if (!game || !(months > 0) || sandboxMode || isPracticeModeActive() || game.realm === "ascended") {
      return { aged: 0, skipped: true, info: getLifespanInfo(game) };
    }
    const prevLf = getLifespanInfo(game);
    const delta = Math.max(1, Math.round(months));
    game.elapsedMonths = Math.max(0, Math.floor(num(game.elapsedMonths, 0))) + delta;
    const nextLf = getLifespanInfo(game);
    applyLifespanPostAdvanceEffects(prevLf, nextLf, opts);
    return { aged: delta, skipped: false, reason, prev: prevLf, info: nextLf };
  }

  function openLifespanExhaustedModal(confirmStep = false, recEventId = null) {
    if (!game) return;
    if (recEventId) activePendingRewardId = recEventId;
    const lf = getLifespanInfo(game);
    const longPills = Math.max(0, Math.floor(num(game.inventory && game.inventory.longevity_pill, 0)));
    activeLifespanModalOpen = true;
    if (confirmStep) {
      ensureMetaState();
      const nextLegacyStones = Math.min(240, (metaState.ascensions || 0) * 45 + ((metaState.bingjieCount || 0) + 1) * 40);
      openModal(`
        <div class="drawer-mural-banner" style="height:86px;">
          <img src="${ART.heaven_gate}" alt="兵解转世确认" />
          <div class="drawer-mural-overlay">
            <div>
              <span class="cinnabar-seal">二次确认 · 兵解转世</span>
              <h2 style="font-family:var(--font-serif);font-size:20px;color:#ffd0cc;margin-top:3px;">确认舍去今世修为，兵解转世重入仙途？</h2>
            </div>
            <button type="button" class="btn-ghost" data-action="open-lifespan-exhausted">返回 ✕</button>
          </div>
        </div>
        <div class="jade-card" style="gap:6px;border-color:rgba(255,104,104,0.68);">
          <div style="font-size:12px;color:#ffd0cc;font-weight:700;">⚠ 兵解转世影响说明：</div>
          <div style="font-size:11.5px;color:#e6f4f1;line-height:1.58;">
            1. 将<b>清空当前主存档</b>（<code>${STORAGE_KEY}</code>），携【${escapeHtml(game.name)}】之执念重返标题页开启新一世；<br/>
            2. <b>完整保留元存档</b>（累世轮回功德、图鉴、历史飞升纪录与已解锁命格），并铭刻兵解轮回印记（下世启程灵石传承增至 <b>+${nextLegacyStones} 灵石</b>，单次 +40、上限 240，不计入白日飞升世数）；<br/>
            3. 若仍想留在此世服丹续命或冲关破境，可随时点击【返回】或【暂留延寿】，进度绝不丢失。
          </div>
        </div>
        <div id="reincarnation-error-msg" role="alert" aria-live="assertive" style="display:none;margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(92,22,22,0.88);border:1px solid rgba(255,120,112,0.8);color:#ffd5d0;font-size:12px;line-height:1.5;text-align:left;"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
          <button type="button" id="btn-bingjie-back" class="btn-ghost" data-action="open-lifespan-exhausted">返回上一步</button>
          <button type="button" id="btn-confirm-bingjie-reincarnate" class="btn-gold" style="background:linear-gradient(135deg,#9e2632,#d45542);color:#fff6e8;" data-action="confirm-bingjie-reincarnate">确认兵解转世</button>
        </div>
      `, true, { kind: "lifespan_exhausted" });
      return;
    }
    openModal(`
      <div class="drawer-mural-banner" style="height:88px;">
        <img src="${ART.banner_tribulation}" alt="大限已至" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">寿元已尽 · 温和抉择</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:#ffd89b;margin-top:3px;">大限已至（${lf.curYears}/${lf.maxYears} 载）</h2>
          </div>
          <button type="button" class="btn-ghost" data-action="lifespan-stay">暂留延寿 ✕</button>
        </div>
      </div>
      <div class="jade-card" style="gap:6px;border-color:rgba(255,112,108,0.62);">
        <div style="font-size:12px;color:#ffe0dc;line-height:1.58;">
          道友本世寿元已达大限，周身灵脉渐衰——<b>修炼效率降至 ${Math.round(lf.xpEfficiencyMult * 100)}%（-${lf.penaltyPct}%）</b>，但<b>绝不强制删档或中断历练</b>！<br/>
          你可立即服下【延寿青莲丹】增寿 30 载解厄、暂留此世破境延寿，或主动选择【兵解转世】保留累世功德重开新世。
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;">
        ${longPills > 0 ? `<button type="button" id="btn-lifespan-use-pill" class="btn-jade" data-action="lifespan-use-pill">🌿 服用延寿青莲丹 (${longPills})</button>` : ""}
        <button type="button" id="btn-lifespan-stay" class="btn-gold" data-action="lifespan-stay">暂留延寿（继续游玩）</button>
        <button type="button" id="btn-lifespan-bingjie" class="btn-ghost" style="border-color:rgba(255,118,110,0.62);color:#ffb4ae;" data-action="open-bingjie-confirm">☯ 兵解转世…</button>
      </div>
    `, true, { kind: "lifespan_exhausted" });
  }

  function executeReincarnation(opts = {}) {
    const source = (opts && opts.source) || "ascension";
    const showReincarnationInlineError = (msg) => {
      const errEl = document.getElementById("reincarnation-error-msg");
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = "block";
      }
      const modalBox = document.getElementById("modal-content");
      if (modalBox && document.getElementById("modal-backdrop")?.classList.contains("open")
          && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
        focusDialogSafely(modalBox);
      }
    };
    if (sandboxMode) {
      const msg = "🧪 演武沙盒模式不记录轮回飞升，请先点击【退出沙盒】！";
      showReincarnationInlineError(msg);
      showToast(msg);
      return false;
    }
    if (!guardNotPracticeMode("轮回转世")) {
      showReincarnationInlineError("⚔ 演武练习模式禁止【轮回转世】（不计寿元与正式存档），请先按 H 返回听雨洞府！");
      return false;
    }
    if (storageReadError) {
      saveAlertDismissed = false;
      renderWelcomeSaveStatusBanner();
      renderHudSaveAlert();
      const msg = "⚠ 检测到本地受损主存档尚未处理，已中止轮回清档并保留原数据！";
      showReincarnationInlineError(msg);
      showToast(msg);
      return false;
    }
    if (saveReadOnlyMode || saveConflictState) {
      renderHudSaveAlert();
      const msg = saveConflictState
        ? "⚠ 存在多标签页存档冲突，已拒绝轮回清档！请先处理冲突。"
        : "⚠ 当前处于只读观览态，已拒绝轮回清档以免误删另一标签页的进度！";
      showReincarnationInlineError(msg);
      showToast(msg);
      return false;
    }
    if (metaReadError) {
      saveAlertDismissed = false;
      renderHudSaveAlert();
      const msg = "⚠ 元存档损坏尚未处理，已中止轮回清档以免丢失累世功德！请先备份或重置元存档。";
      showReincarnationInlineError(msg);
      showToast(msg);
      return false;
    }
    let prevSaveRaw = null;
    try {
      prevSaveRaw = localStorage.getItem(STORAGE_KEY);
      if (prevSaveRaw !== null && prevSaveRaw !== "") {
        const curRes = parseAndValidateSaveRaw(prevSaveRaw, STORAGE_KEY);
        if (!curRes.ok) {
          storageReadError = {
            key: STORAGE_KEY,
            reason: curRes.reason || "本地存档结构异常",
            raw: prevSaveRaw,
            rawLength: prevSaveRaw.length,
            at: Date.now()
          };
          saveAlertDismissed = false;
          renderWelcomeSaveStatusBanner();
          renderHudSaveAlert();
          const msg = `⚠ 检测到本地主存档已损坏（${storageReadError.reason}），已中止轮回清档并保留原数据！`;
          showReincarnationInlineError(msg);
          showToast("⚠ 检测到本地主存档已损坏，已中止轮回清档并保留原数据！");
          return false;
        }
        if (isForeignSaveConflict(curRes)) {
          triggerSaveConflict(curRes, true);
          showToast("⚠ 检测到另一标签页更新了存档，已中止轮回清档！");
          return false;
        }
      } else if (loadedSaveRev > 0) {
        triggerSaveConflict({ ok: true, rev: 0, tabId: "另一标签页", updatedAt: Date.now(), deleted: true, bundle: { game: null } }, true);
        showToast("⚠ 检测到另一标签页已清空存档，已中止轮回清档！");
        return false;
      }
    } catch (e) {}

    // R2A-2 Step 1: Pre-flight META_KEY integrity & writability check WITHOUT mutating or broadcasting monotonic fields!
    ensureMetaState();
    const prevMetaSnap = JSON.parse(JSON.stringify(metaState));
    const prevLifeRecorded = !!(game && game.lifeRecorded);
    let curMetaRaw = null;
    try {
      curMetaRaw = localStorage.getItem(META_KEY);
    } catch (e) {
      metaWriteError = { message: safeText(e && e.message, safeDiag(e)) || safeDiag(e), at: Date.now() };
      saveAlertDismissed = false;
      renderHudSaveAlert();
      const msg = `⚠ 元存档读取失败（${metaWriteError.message}），已中止轮回并保留当前主存档！`;
      showReincarnationInlineError(msg);
      showToast(msg, { critical: true });
      return false;
    }
    if (curMetaRaw !== null && curMetaRaw !== "") {
      const curMetaRes = parseAndValidateMetaRaw(curMetaRaw, META_KEY);
      if (!curMetaRes.ok) {
        metaReadError = {
          key: META_KEY,
          reason: curMetaRes.reason || "元存档结构异常",
          raw: curMetaRaw,
          rawLength: curMetaRaw.length,
          at: Date.now()
        };
        saveAlertDismissed = false;
        renderWelcomeSaveStatusBanner();
        renderHudSaveAlert();
        const msg = `⚠ 元存档保存失败（${metaReadError.reason}），已中止轮回并保留当前主存档！`;
        showReincarnationInlineError(msg);
        showToast(msg, { critical: true });
        return false;
      }
    }
    try {
      // Write existing value (or un-incremented metaState) to verify quota/writability before removing STORAGE_KEY
      localStorage.setItem(META_KEY, (curMetaRaw !== null && curMetaRaw !== "") ? curMetaRaw : JSON.stringify(metaState));
    } catch (e) {
      metaWriteError = {
        message: (e && e.name === "QuotaExceededError") ? "存储空间已满 (QuotaExceededError)" : (safeText(e && e.message, safeDiag(e)) || safeDiag(e)),
        at: Date.now()
      };
      saveAlertDismissed = false;
      renderHudSaveAlert();
      const msg = `⚠ 元存档保存失败（${metaWriteError.message}），已中止轮回并保留当前主存档！`;
      showReincarnationInlineError(msg);
      showToast(msg, { critical: true });
      return false;
    }

    // R2A-2 Step 2: Verify primary save removal BEFORE incrementing monotonic META_KEY fields (prevents 2-tab CRDT bounce-back!)
    const rmRes = removePrimarySaveVerified();
    if (!rmRes.ok) {
      storageWriteError = { message: `清空主存档失败：${rmRes.message}`, at: Date.now() };
      saveAlertDismissed = false;
      renderHudSaveAlert();
      const msg = `⚠ 轮回清档失败：${rmRes.message}（未变动元存档并保留当前主存档）！`;
      showReincarnationInlineError(msg);
      showToast(msg, { critical: true, key: "reincarnate_remove_err", throttleMs: 0 });
      return false;
    }

    // R2A-2 Step 3: Primary save is verified gone -> commit monotonic +1 bingjieCount / Hall of Lives & saveMeta!
    if (source === "bingjie" && (!game || game.status !== "ascended")) {
      ensureMetaState();
      metaState.bingjieCount = Math.max(0, Math.floor(num(metaState.bingjieCount, 0))) + 1;
    } else if (game && game.status === "ascended" && game.ending && !game.lifeRecorded) {
      recordPastLifeInHall(game, game.ending, { skipSave: true });
    }
    const metaSaved = saveMeta({ userInitiated: true });
    if (!metaSaved) {
      Object.keys(metaState).forEach(k => { if (!(k in prevMetaSnap)) delete metaState[k]; });
      Object.assign(metaState, prevMetaSnap);
      if (game) game.lifeRecorded = prevLifeRecorded;
      let saveRestored = (prevSaveRaw === null || prevSaveRaw === "");
      if (!saveRestored) {
        try {
          localStorage.setItem(STORAGE_KEY, prevSaveRaw);
          saveRestored = (localStorage.getItem(STORAGE_KEY) === prevSaveRaw);
        } catch (restoreErr) {
          saveRestored = false;
        }
      }
      if (!saveRestored) {
        storageWriteError = { message: "元存档写入失败且恢复主存档失败，请立即导出云码备份", at: Date.now() };
      }
      saveAlertDismissed = false;
      renderHudSaveAlert();
      const errMsg = metaReadError
        ? metaReadError.reason
        : ((metaWriteError && metaWriteError.message) ? metaWriteError.message : "元存档写入失败");
      const msg = saveRestored
        ? `⚠ 元存档保存失败（${errMsg}），已中止轮回并恢复当前主存档！`
        : `⚠ 严重异常：元存档保存失败（${errMsg}）且恢复主存档失败，请立即导出云码备份！`;
      showReincarnationInlineError(msg);
      showToast(msg, { critical: true, key: "reincarnate_meta_err", throttleMs: 0 });
      return false;
    }

    clearTransientChoiceQueues();
    activeCustomSeedTempCurio = null;
    game = null;
    practiceFormalSnapshot = null;
    clearLoadedSaveMeta();
    lastSavedPayloadChecksum = null;
    saveReadOnlyMode = false;
    saveConflictState = null;
    storageWriteError = null;
    arena.stageEpoch += 1;
    arena.sanctumMode = false;
    arena.bossRush = null;
    arena.celestialSpire = null;
    arena.customSeedRun = null;
    arena.tribulation = null;
    arena.sectDefense = null;
    arena.cloudFlight = null;
    clearCinematicClashOverlays();
    if (arena.player) arena.player.ravineBuffTimer = 0;
    resetStageTransitionState();
    resetPhotoModeOverlay({ resetCamera: true, skipCalmReeval: true });
    resetRuntimeCombatOverrides();
    arena.defeatPending = null;
    releasePauseToken(defeatPauseToken); defeatPauseToken = null;
    lastModalTriggerEl = null;
    lastDrawerTriggerEl = null;
    if (metaState.ascensions >= 1) selectedPerkId = "immortal_echo";
    const ws = document.getElementById("welcome-screen");
    if (ws) ws.style.display = "flex";
    renderWelcomeScreen();
    const customDr = document.getElementById("title-custom-drawer");
    if (customDr) customDr.classList.add("open");
    closePavilionPopover();
    hideDojoControlBar();
    syncDojoTrainingHudVisibility();
    closeModal(); closeDrawer();
    syncPendingRewardsBadge();
    restoreTriggerFocus(null);
    if (source === "bingjie") {
      const nextLegacyStones = Math.min(240, (metaState.ascensions || 0) * 45 + (metaState.bingjieCount || 0) * 40);
      showToast(`☯ 兵解转世已成！已保留累世功德，下世启程灵石传承：+${nextLegacyStones} 灵石（兵解第 ${metaState.bingjieCount || 0} 次），可重开新一世！`);
    }
    return true;
  }

  function openPetSkillChoiceModal(tier) {
    if (!game || !game.pet || !game.pet.id || !hasOwn(SPIRIT_PETS, game.pet.id)) return false;
    const safeTier = tier === 5 ? 5 : 3;
    if ((game.pet.level || 1) < safeTier) {
      showToast(`灵宠达到 Lv.${safeTier} 后方可择定此阶灵技！`);
      return false;
    }
    const sp = SPIRIT_PETS[game.pet.id];
    const pool = safeTier === 5 ? PET_SKILL_TIERS.tier5 : PET_SKILL_TIERS.tier3;
    const curPicked = game.pet.skills ? game.pet.skills[safeTier === 5 ? "tier5" : "tier3"] : null;
    openModal(`
      <div class="drawer-mural-banner" style="height:86px;">
        <img src="${ART[sp.art]}" alt="${escapeHtml(sp.name)}" style="object-fit:contain;background:radial-gradient(circle,#193b44,#07131a);" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">灵宠化形 · 自主择技</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:3px;">${escapeHtml(sp.name)} · Lv.${safeTier} ${safeTier === 5 ? "化境神通" : "化形灵技"}三选一</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">暂缓选择 ✕</button>
        </div>
      </div>
      <div style="font-size:11.5px;color:#b8dcd5;">择定后永久铭刻于本命灵兽血脉（切换随行灵宠亦完全保留）；关闭弹窗不会自动代选，随时可于修行抽屉重新打开择技。</div>
      <div class="pet-skill-choice-grid">
        ${pool.map(sk => {
          const sel = curPicked === sk.id;
          return `
            <button type="button" class="pet-skill-card-btn ${sel ? "selected" : ""}" data-pick-pet-skill="${sk.id}" data-pet-skill-tier="${safeTier}">
              <div style="display:flex;justify-content:space-between;align-items:center;width:100%;gap:6px;">
                <strong style="font-family:var(--font-serif);font-size:15px;color:${sk.color};">${escapeHtml(sk.name)}</strong>
                <span class="tag-chip ${sel ? "mythic" : "done"}" style="font-size:9.5px;">${sel ? "已选" : escapeHtml(sk.badge)}</span>
              </div>
              <div style="font-size:11px;color:#d6eee8;line-height:1.5;">${escapeHtml(sk.desc)}</div>
              <span class="tag-chip" style="margin-top:auto;font-size:9.8px;">点击铭刻此技 ▸</span>
            </button>
          `;
        }).join("")}
      </div>
      <div style="display:flex;justify-content:flex-end;">
        <button type="button" class="btn-ghost" data-modal-close="1">暂缓选择</button>
      </div>
    `, true, { kind: "pet_skill_choice" });
    return true;
  }

  function canAffordSanctumUpgrade(g, bId) {
    if (!g) return false;
    const curLv = getSanctumLevel(g, bId);
    const cost = getSanctumNextCost(bId, curLv);
    if (!cost) return false;
    if ((g.stones || 0) < cost.stones) return false;
    for (const [mk, req] of Object.entries(cost.mats || {})) {
      if ((g.inventory[mk] || 0) < req) return false;
    }
    return true;
  }

  function upgradeSanctumBuilding(bId) {
    if (!game) return false;
    if (!guardNotInTribulation("洞府灵脉升阶")) return false;
    if (!guardNotPracticeMode("洞府灵脉升阶")) return false;
    const spec = SANCTUM_BUILDINGS.find(b => b.id === bId);
    const lvMap = ensureSanctumLevels(game);
    const curLv = lvMap[bId] || 1;
    if (!spec || curLv >= 5) {
      showToast("该灵脉建筑已修至 Lv.5 圆满之境！");
      return false;
    }
    const cost = getSanctumNextCost(bId, curLv);
    if (!cost) return false;
    if ((game.stones || 0) < cost.stones) {
      showToast(`灵石不足（升至 Lv.${curLv + 1} 需 ${cost.stones} 灵石）`);
      return false;
    }
    for (const [mk, req] of Object.entries(cost.mats || {})) {
      if ((game.inventory[mk] || 0) < req) {
        showToast(`缺少【${(ITEMS[mk] && ITEMS[mk].name) || mk}】×${req}（可赴秘境斩妖或宗门委托采集）`);
        return false;
      }
    }
    const beforeStats = getCombatStats(game);
    game.stones -= cost.stones;
    Object.entries(cost.mats || {}).forEach(([mk, req]) => {
      game.inventory[mk] = Math.max(0, (game.inventory[mk] || 0) - req);
    });
    lvMap[bId] = curLv + 1;
    const nextLv = lvMap[bId];
    if (bId === "spirit_eye" && (nextLv === 3 || nextLv === 5)) {
      if (!game.gourd) refillImmortalGourd();
      game.gourd.maxCharges = (game.gourd.maxCharges || 5) + 1;
      game.gourd.charges = game.gourd.maxCharges;
    }
    if (Array.isArray(game.journal)) {
      game.journal.unshift(`【洞府升阶】${spec.name}晋升 Lv.${nextLv}：${cost.eff}`);
    }
    Sound.fanfare();
    Sound.clang(1.25, 0.14);
    if (arena.sanctumMode) {
      // Refresh Sanctum prop labels immediately so Lv.N shows on courtyard landmarks!
      arena.props.forEach(pr => {
        if (pr.id === "cauldron_main") pr.name = `紫微丹鼎 · Lv.${lvMap.cauldron}`;
        if (pr.id === "sanctum_tiangong_forge") pr.name = `天工星火剑炉 · Lv.${lvMap.sword_forge}`;
        if (pr.id === "hub_sect_defense") pr.name = `护山大阵 · Lv.${lvMap.guard_array}`;
        if (pr.id === "hub_scripture_hall") pr.name = `藏经阁 · Lv.${lvMap.scripture_hall}`;
      });
      addRipple(arena.player.x, arena.player.y + 18, 150, spec.color);
      addFloat(`🏛 ${spec.name} 升阶 Lv.${nextLv}！`, arena.player.x, arena.player.y - 62, spec.color, 21, true);
    }
    showToast(`🏛 【${spec.name}】升至 Lv.${nextLv}！${cost.eff}`);
    recordVol1PrepUpgradeDelta(beforeStats, `${spec.name} Lv.${nextLv}`);
    saveGame();
    updateHud();
    if (drawerOpen) renderDrawerContent();
    if (document.getElementById("modal-backdrop").classList.contains("open")) {
      openSanctumUpgradeModal();
    }
    return true;
  }

  function openSanctumUpgradeModal() {
    if (!game) return;
    closeDrawer();
    const lvMap = ensureSanctumLevels(game);
    const pros = getSanctumProsperity(game);
    const matKeys = ["herb", "dew", "core", "jade", "lotus", "soul", "dao"];
    const matSourceHtml = (activeMatSourceJump && activeMatSourceJump.inModal === "sanctum")
      ? renderMatSourceInlinePanel(activeMatSourceJump, true)
      : "";

    openModal(`
      <div class="modal-header">
        <div class="drawer-mural-banner" style="height:84px;width:100%;">
          <img src="${ART.banner_sanctum}" alt="听雨洞府灵脉建设" />
          <div class="drawer-mural-overlay">
            <div>
              ${renderSemanticTag("econ", "洞府经营 · 五阶灵脉")}
              <h2 style="font-family:var(--font-serif);font-size:var(--fs-xl);color:var(--gold-bright);margin-top:4px;">听雨洞府 · ${pros.title}（灵阶 ${pros.totalLv}/${pros.maxTotalLv}）</h2>
            </div>
            <button type="button" class="btn-tertiary btn-ghost" data-modal-close="1">返回洞府 ✕</button>
          </div>
        </div>
      </div>

      <div class="modal-body">
        ${matSourceHtml}
        <div class="sanctum-mat-bar num-tabular">
          <span style="color:var(--gold-bright);font-weight:700;">行囊灵材库：</span>
          <span class="sanctum-mat-pill" style="border-color:rgba(255,226,138,0.55);color:#ffe89e;">◆ 灵石 ${Math.floor(num(game.stones))}</span>
          ${matKeys.map(mk => `<span class="sanctum-mat-pill">${ITEMS[mk].name} ×${Math.floor(num(game.inventory[mk]))}</span>`).join("")}
        </div>

        <div class="sanctum-grid">
          ${SANCTUM_BUILDINGS.map(b => {
            const lv = lvMap[b.id] || 1;
            const nextCost = getSanctumNextCost(b.id, lv);
            const ok = canAffordSanctumUpgrade(game, b.id);
            const up = computeUpgradePreview(game, "sanctum_upgrade", b.id);
            const missChips = (up.missingMats || []).map(m =>
              `<button type="button" class="mat-source-chip" data-mat-source="${escapeHtml(m.id)}" data-source-modal="sanctum" data-source-origin="[data-upgrade-sanctum='${escapeHtml(b.id)}']">📍 缺${escapeHtml(m.name)}×${m.lack} 来源</button>`
            ).join("");
            return `
              <div class="sanctum-bld-card ${lv >= 5 ? "maxed" : ""}">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <img src="${ART[b.art]}" alt="${b.name}" style="width:36px;height:36px;object-fit:contain;" />
                    <div>
                      <div style="font-family:var(--font-serif);font-size:var(--fs-lg);font-weight:700;color:${b.color};">${b.icon} ${b.name} · Lv.${lv}/5</div>
                      <div style="font-size:var(--fs-xs);color:var(--text-sub);">${b.role}</div>
                    </div>
                  </div>
                  <div class="sanctum-lv-pips">
                    ${[1, 2, 3, 4, 5].map(i => `<span class="sanctum-pip ${i <= lv ? "lit" : ""}"></span>`).join("")}
                  </div>
                </div>
                <div style="font-size:var(--fs-xs);color:#9effec;font-weight:700;">当前成效：${b.summaryFn(lv)}</div>
                ${nextCost ? `
                  <div class="upgrade-preview-strip">
                    <span>消耗：<b>${escapeHtml(up.costText)}</b></span>
                    <span>收益：<b>${escapeHtml(up.deltaText)}</b></span>
                    <span>场景：${escapeHtml(up.sceneText)}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-top:2px;">
                    <div style="display:flex;gap:4px;flex-wrap:wrap;">${missChips || `<span style="font-size:var(--fs-xs);color:var(--jade);">灵材齐备 ✓</span>`}</div>
                    <button type="button" class="${ok ? "btn-primary btn-gold" : "btn-tertiary btn-ghost is-locked"}" style="padding:4px 11px;font-size:var(--fs-xs);white-space:nowrap;" data-upgrade-sanctum="${b.id}" data-reminder-tier="${ok ? "2" : "3"}" ${ok ? "" : "disabled"}>升阶 Lv.${lv + 1}</button>
                  </div>
                ` : `<span class="tag-chip mythic" style="align-self:flex-end;">★ 五阶圆满</span>`}
              </div>`;
          }).join("")}
        </div>
      </div>
      <div class="modal-footer">
        <span style="font-size:var(--fs-xs);color:var(--text-sub);">提示：缺少灵材可点击「📍来源」查看获取路径并返回当前建筑。</span>
        <button type="button" class="btn-tertiary btn-ghost" data-modal-close="1">关闭</button>
      </div>
    `, true, { kind: "sanctum_upgrade", tier: "decision" });
  }

  function getCompanionDynamicGreeting(g, npcId) {
    const dlg = COMPANION_HUB_DIALOGUES[npcId];
    if (!dlg || !g) return "道友安好，仙途漫漫且共勉。";
    const mode = getKarmaState(g).mode;
    const pool = dlg.greetings[mode] || dlg.greetings.neutral;
    const idx = (rankOf(g.realm) + (arena.stageIdx || 0)) % pool.length;
    return pool[idx];
  }

  function getCompanionPostBattleComment(g) {
    if (!g) return null;
    const ids = ["shen", "pei", "lu", "yan"];
    let bestId = "shen";
    let bestScore = -1;
    ids.forEach(id => {
      const sc = getCompanionBondTier(g, id) * 10 + (g.aids && g.aids[id] ? 5 : 0);
      if (sc > bestScore) { bestScore = sc; bestId = id; }
    });
    const npc = NPC_META[bestId];
    const dlg = COMPANION_HUB_DIALOGUES[bestId];
    if (!npc || !dlg) return null;
    const mode = getKarmaState(g).mode;
    return {
      npcId: bestId,
      name: npc.name,
      art: npc.art,
      text: dlg.postBattle[mode] || dlg.postBattle.neutral
    };
  }

  function openCompanionInteractModal(npcId) {
    if (!game || !NPC_META[npcId]) return;
    closeDrawer();
    const npc = NPC_META[npcId];
    const kp = COMPANION_KEEPSAKES[npcId];
    const dlg = COMPANION_HUB_DIALOGUES[npcId];
    const tier = getCompanionBondTier(game, npcId);
    const ks = getKarmaState(game);
    const greet = getCompanionDynamicGreeting(game, npcId);
    const availStory = STORIES.find(s => s.npc === npcId && !game.choices[s.id] && rankOf(game.realm) >= rankOf(s.min) && (!s.requires || !!game.choices[s.requires]));
    const nextLockedStory = STORIES.find(s => s.npc === npcId && !game.choices[s.id] && (!s.requires || !!game.choices[s.requires]) && rankOf(game.realm) < rankOf(s.min));
    const doneStories = STORIES.filter(s => s.npc === npcId && !!game.choices[s.id]).length;
    const totalStories = STORIES.filter(s => s.npc === npcId).length;
    const chatKey = `${npcId}_${game.realm}`;
    const teaClaimed = !!(game.sanctumChatStage && game.sanctumChatStage["tea_" + chatKey]);
    const sparClaimed = !!(game.sanctumChatStage && game.sanctumChatStage["spar_" + chatKey]);
    const hasFavMat = (game.inventory[dlg.favMat] || 0) >= dlg.favCount;
    const canGiftStone = (game.stones || 0) >= 40;

    openModal(`
      <div class="companion-modal-head">
        <img src="${ART[npc.art]}" alt="${npc.name}" />
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:7px;">
              <span class="cinnabar-seal">${npc.role}</span>
              <strong style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);">${npc.name}</strong>
              <span class="tag-chip ${tier >= 3 ? "mythic" : "done"}">${kp.tierTitles[tier]}</span>
            </div>
            <button type="button" class="btn-ghost" data-modal-close="1">告辞 ✕</button>
          </div>
          <p style="font-size:12.5px;color:#edf7f4;line-height:1.5;font-family:var(--font-serif);">『${greet}』</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:10.5px;">
            <span style="color:#80ffea;">三阶信物【${kp.keepsake}】：${kp.bonusDesc}</span>
            <span style="color:var(--gold);">故人剧情：${doneStories}/${totalStories}</span>
          </div>
        </div>
      </div>

      ${availStory ? `
        <div class="jade-card" style="border-color:rgba(255,226,138,0.68);flex-direction:row;justify-content:space-between;align-items:center;gap:10px;">
          <div>
            <strong style="font-size:13.5px;color:var(--gold-bright);">🎭 第${availStory.chapter}卷故人线 · 《${escapeHtml(availStory.name)}》 · 📍${escapeHtml(getStoryLocationLabel(availStory.location))}</strong>
            <div style="font-size:11px;color:var(--text-sub);margin-top:2px;">进入半身立绘叙事舞台，亲手抉择故人机缘并推进三阶羁绊！</div>
          </div>
          <button type="button" class="btn-gold" style="white-space:nowrap;" data-play-story-bar="${escapeHtml(availStory.id)}">🎭 立绘演绎 ▸</button>
        </div>
      ` : nextLockedStory ? `
        <div class="pity-bar-card">
          <span>下一段故人线（第${nextLockedStory.chapter}卷 · 📍${escapeHtml(getStoryLocationLabel(nextLockedStory.location))}）：《${escapeHtml(nextLockedStory.name)}》</span>
          <span style="color:var(--gold-bright);">晋升【${REALMS[nextLockedStory.min].name}期】解锁</span>
        </div>
      ` : `
        <div class="pity-bar-card">
          <span>★ 与【${npc.name}】本世故人剧情已全部圆满！</span>
          <span style="color:#70ffe6;">合击技：${npc.coopName}</span>
        </div>
      `}

      <div class="companion-action-grid">
        <button type="button" class="companion-action-btn" data-comp-act="tea" data-comp-npc="${npcId}" ${canRefillGourdInAlchemyDrawer() ? "" : "disabled"}>
          <strong style="font-size:13px;color:#9effec;">🍵 洞府茶叙${canRefillGourdInAlchemyDrawer() ? "" : " (限洞府静息)"}</strong>
          <span style="font-size:10.5px;color:var(--text-sub);line-height:1.4;">${!canRefillGourdInAlchemyDrawer() ? "请先按 H 返回听雨洞府静息状态再品茗休整" : teaClaimed ? "重温立绘对谈（本境茶礼已领）" : "半身立绘茶叙 · 仁心/本真 +5 · 灵气全满"}</span>
        </button>
        <button type="button" class="companion-action-btn" data-comp-act="spar" data-comp-npc="${npcId}" ${canRefillGourdInAlchemyDrawer() ? "" : "disabled"}>
          <strong style="font-size:13px;color:#ffe28a;">⚔ 同门切磋${canRefillGourdInAlchemyDrawer() ? "" : " (限洞府静息)"}</strong>
          <span style="font-size:10.5px;color:var(--text-sub);line-height:1.4;">${!canRefillGourdInAlchemyDrawer() ? "请先按 H 返回听雨洞府静息状态再演武切磋" : sparClaimed ? "演武切磋感悟（本境修为已领）" : dlg.sparReward}</span>
        </button>
        <button type="button" class="companion-action-btn" data-comp-act="gift" data-comp-npc="${npcId}" ${tier >= 3 || (!hasFavMat && !canGiftStone) ? "disabled" : ""}>
          <strong style="font-size:13px;color:#f3c6ff;">🎁 赠礼晋阶信物</strong>
          <span style="font-size:10.5px;color:var(--text-sub);line-height:1.4;">${tier >= 3 ? `★ 【${kp.keepsake}】已满阶激活` : hasFavMat ? `赠心仪灵材 ${dlg.favLabel}（优先）晋升 ${kp.tierTitles[tier + 1]}` : `赠 40 灵石晋升 ${kp.tierTitles[tier + 1]}`}</span>
        </button>
      </div>
    `, true);
  }

  function triggerCompanionHubAction(npcId, act) {
    if (!game || !NPC_META[npcId]) return false;
    if (!guardNotPracticeMode("故人雅集")) return false;
    const npc = NPC_META[npcId];
    const kp = COMPANION_KEEPSAKES[npcId];
    const dlg = COMPANION_HUB_DIALOGUES[npcId];
    const ks = getKarmaState(game);
    if (!game.sanctumChatStage) game.sanctumChatStage = {};
    const chatKey = `${npcId}_${game.realm}`;

    if (act === "tea") {
      if (!guardNotInTribulation("洞府茶叙")) return false;
      if (!canRefillGourdInAlchemyDrawer()) {
        showToast("🍵 请先按 H 返回【听雨洞府】静息状态，再与故人茶叙休整！", { critical: true });
        return false;
      }
      closeModal();
      const firstTime = !game.sanctumChatStage["tea_" + chatKey];
      if (firstTime) {
        game.sanctumChatStage["tea_" + chatKey] = true;
        game.dao.serenity = (game.dao.serenity || 6) + 5;
        game.dao.benevolence = (game.dao.benevolence || 6) + 3;
        const st = getCombatStats(game);
        game.hp = st.maxHp;
        game.mp = st.maxMp;
        refillImmortalGourd();
        saveGame();
        updateHud();
      }
      const lineTxt = dlg.teaLines[ks.mode] || dlg.teaLines.neutral;
      playCustomDialogueLines([
        {
          art: npc.art,
          role: `${npc.role} · 听雨茶叙`,
          speaker: npc.name,
          text: lineTxt + (firstTime ? "（本真+5 · 仁心+3 · 气血仙葫满盈）" : ""),
          finalBtnLabel: "品茗收盏 ▸"
        }
      ]);
      return true;
    }

    if (act === "spar") {
      if (!guardNotInTribulation("同门切磋")) return false;
      if (!canRefillGourdInAlchemyDrawer()) {
        showToast("⚔ 请先按 H 返回【听雨洞府】静息状态，再与故人同门切磋！", { critical: true });
        return false;
      }
      closeModal();
      const firstTime = !game.sanctumChatStage["spar_" + chatKey];
      const st = getCombatStats(game);
      if (firstTime) {
        game.sanctumChatStage["spar_" + chatKey] = true;
        const xpAdd = Math.max(18, Math.round((REALMS[game.realm].xpCap || 120) * 0.14));
        gainRealmXp(xpAdd);
        arena.swordIntent = Math.min(100, (arena.swordIntent || 0) + 45);
        if (npcId === "shen") arena.player.shieldHp = Math.max(arena.player.shieldHp || 0, Math.round(st.maxHp * 0.18));
        game.dao.edge = (game.dao.edge || 10) + 5;
        Sound.clang(1.2, 0.12);
        saveGame();
        updateHud();
      }
      playCustomDialogueLines([
        {
          art: npc.art,
          role: `${npc.role} · 演武切磋`,
          speaker: npc.name,
          text: firstTime
            ? `剑光交错十余合！${npc.name}收势赞叹：『好精妙的破势剑意！』（修为精进 · 剑意+45% · 锋芒+5）`
            : `与${npc.name}再度演武十招，彼此剑意更见圆融。`,
          finalBtnLabel: "收剑致谢 ▸"
        }
      ]);
      return true;
    }

    if (act === "gift") {
      const curT = getCompanionBondTier(game, npcId);
      if (curT >= 3) return false;
      const useMat = (game.inventory[dlg.favMat] || 0) >= dlg.favCount;
      if (!useMat && (game.stones || 0) < 40) {
        showToast(`需 ${dlg.favLabel} 或 40 灵石方可赠礼晋阶`);
        return false;
      }
      if (useMat) game.inventory[dlg.favMat] -= dlg.favCount;
      else game.stones -= 40;
      if (!game.bondTiers) game.bondTiers = { shen: 1, pei: 0, lu: 0, yan: 0 };
      game.bondTiers[npcId] = curT + 1;
      game.aids[npcId] = true;
      const newT = game.bondTiers[npcId];
      closeModal();
      Sound.fanfare();
      saveGame();
      updateHud();
      const quote = ks.mode === "demonic" ? kp.demonQuote : kp.rightQuote;
      playCustomDialogueLines([
        {
          art: npc.art,
          role: `${npc.role} · ${kp.tierTitles[newT]}`,
          speaker: npc.name,
          text: `${quote}${newT >= 3 ? ` ★ 三阶生死信物【${kp.keepsake}】已永久觉醒（${kp.bonusDesc}）！` : `（羁绊晋升至【${kp.tierTitles[newT]}】）`}`,
          finalBtnLabel: "铭记于心 ▸"
        }
      ]);
      return true;
    }
    return false;
  }

  function getBossKarmaMonologue(bossId) {
    const entry = BOSS_KARMA_MONOLOGUES[bossId];
    if (!entry) return "";
    const mode = getKarmaState(game).mode;
    return entry[mode] || entry.neutral || "";
  }

  function getKarmaEndingEpilogue(g, endId) {
    const ks = getKarmaState(g);
    const base = KARMA_ENDING_EPILOGUES[ks.mode] || KARMA_ENDING_EPILOGUES.neutral;
    const ed = ASCENSION_ENDINGS.find(e => e.id === endId) || null;
    const daoInfo = getDaoBonuses(g);
    const clearedIdxs = getClearedCampaignStageIndices(g);
    const totalStars = getTotalStageStars(g);
    const bondedIds = getBondedCompanionIds(g);
    const bondedNames = bondedIds.map(id => NPC_META[id].name);
    const petSpec = (g && g.pet && g.pet.id && hasOwn(SPIRIT_PETS, g.pet.id)) ? SPIRIT_PETS[g.pet.id] : null;
    const petLv = petSpec ? Math.max(1, Math.min(5, Math.floor(num(g.pet.level, 1)))) : 0;

    const daoSuffix = daoInfo && daoInfo.dominantTitle ? `（道韵偏向【${daoInfo.dominantTitle}】）` : "";
    const karmaClause = ks.mode === "righteous"
      ? `你以清虚正道立心${daoSuffix}，太清功德澄明九州`
      : ks.mode === "demonic"
        ? `你以劫煞魔心破阵${daoSuffix}，赤渊锋芒震彻苍穹`
        : `你不囿正统、不坠魔执${daoSuffix}，循太初本真自在问道`;

    let journeyClause;
    if (clearedIdxs.length === STAGES.length) {
      journeyClause = `，踏遍五境星图（青岚破庙至九霄天门全通，共斩获 ${totalStars}/15 ★）`;
    } else if (clearedIdxs.length > 0) {
      const names = clearedIdxs
        .map(i => (CAMPAIGN_ACTS[i] && CAMPAIGN_ACTS[i].mapName) || STAGES[i].name)
        .map(n => n.replace(/^⚡\s*/, ""))
        .join("、");
      journeyClause = `，历战九州 ${clearedIdxs.length}/5 处秘境（已破${names}，累计 ${totalStars}/15 ★）`;
    } else {
      journeyClause = "，此世尚未荡平九州五境秘境（秘境通关 0/5 · 0/15 ★）";
    }

    const allyClause = bondedNames.length > 0
      ? `；红尘同行者有${bondedNames.join("、")}，共证此段剑缘`
      : "；此世独行仗剑，未与红尘故人缔结同心盟契";

    const petClause = petSpec ? `，本命灵兽${petSpec.name}（Lv.${petLv}）随行左右` : "";

    const endingMap = {
      sword_sovereign: "。终局择【独断九霄 · 太虚剑帝】之途，于九霄云外开辟太虚剑界，护佑后世剑修。",
      mortal_guardian: "。终局择【留道人间 · 悬壶真仙】之途，回首青山，化仙元为九州甘霖长守人间灯火。",
      carefree_sage:   "。终局择【踏歌沧海 · 逍遥散仙】之途，不受天庭敕封，自在乘风遨游星海云端。"
    };
    const endClause = (ed && endingMap[ed.id])
      ? endingMap[ed.id]
      : "。九霄天门既开，静候择定本世最终证道之途。";

    const companionEchoLines = {
      shen: "沈清禾悬壶青云药庐，听雨洞府檐下灯火岁岁长明。",
      pei:  "裴照执剑镇守青云剑阁，仍常于云海试剑忆及当年并肩破阵。",
      lu:   "陆玄松于传功堂立碑记你问道始末，青云后辈皆诵其名。",
      yan:  "砚尘阖卷收笔，将你自破庙至九霄的剑痕永铭照影古碑。"
    };
    const companionEpilogues = bondedIds.map(id => ({
      id,
      name: NPC_META[id].name,
      line: companionEchoLines[id] || `${NPC_META[id].name}与你共证红尘剑缘。`
    }));

    return {
      mode: ks.mode,
      seal: base.seal,
      epithet: ed ? `${base.epithet} · ${ed.name}` : base.epithet,
      color: base.color,
      poem: base.poem,
      epilogue: `${karmaClause}${journeyClause}${allyClause}${petClause}${endClause}`,
      clearedStages: clearedIdxs.length,
      totalStars,
      bondedNames,
      companionEpilogues
    };
  }

  // ==================== M4 ENGINE: ECOSYSTEM WEAVING, NINE-LIVES HALL & CALAMITY FIRE NG+ ====================
  function getCodexCompletionPct() {
    ensureMetaState();
    const total = Math.max(1, Object.keys(ENEMIES).length + Object.keys(DAO_LAWS).length);
    const seen = (metaState.seenEnemies || []).length + (metaState.seenLaws || []).length;
    return Math.min(100, Math.round((seen / total) * 100));
  }

  function isPerkUnlocked(perkSpec) {
    if (!perkSpec) return false;
    ensureMetaState();
    const asc = metaState.ascensions || 0;
    if ((perkSpec.unlock || 0) <= 0) return true;
    if (asc >= perkSpec.unlock) return true;
    if (perkSpec.altUnlock === "rush_s" && metaState.bestRushGrade === "S") return true;
    if (perkSpec.altUnlock === "calamity_1" && (metaState.bestCalamityTier || 0) >= 1) return true;
    if (perkSpec.altUnlock === "codex_65" && getCodexCompletionPct() >= 65) return true;
    return false;
  }

  function isSwordAuraUnlocked(auraSpec) {
    if (!auraSpec) return false;
    ensureMetaState();
    if (auraSpec.req === "default") return true;
    const asc = metaState.ascensions || 0;
    if (auraSpec.req === "asc_1") return asc >= 1;
    if (auraSpec.req === "calamity") {
      return (metaState.bestCalamityTier || 0) >= 1
        || (game && (game.calamityTier || 0) >= 1)
        || ((metaState.karmaAscensions && metaState.karmaAscensions.demonic) || 0) >= 1;
    }
    if (auraSpec.req === "stars_8") {
      return asc >= 2 || (game && Array.isArray(game.litStars) && game.litStars.length >= 8);
    }
    if (auraSpec.req === "asc_3") {
      return asc >= 3 || metaState.bestRushGrade === "S";
    }
    return false;
  }


  function isCalamityTierUnlocked(tier) {
    ensureMetaState();
    const spec = getCalamityCycleSpec(tier);
    if (spec.tier === 0) return true;
    const asc = metaState.ascensions || 0;
    if (asc >= spec.reqAsc) return true;
    if (asc >= 1 && (metaState.bestCalamityTier || 0) >= spec.tier - 1) return true;
    if (sandboxMode || (game && game.unlockAllArcana)) return true;
    return false;
  }

  function getEcosystemSystemSpec(sysId) {
    for (const tier of SYSTEM_ECOSYSTEM_LADDER) {
      const found = tier.systems.find(s => s.id === sysId);
      if (found) return found;
    }
    return null;
  }

  function isEcosystemSystemUnlocked(g, sysId) {
    if (!g) return false;
    if (sandboxMode || g.unlockAllArcana) return true;
    const spec = getEcosystemSystemSpec(sysId);
    if (!spec) return true;
    // S11+G7 legacy zero-regression guard: preserve existing investment on pre-M6 saves
    if (sysId === "vein_expedition" && g.expeditions && (
      Object.keys(g.expeditions.assignments || {}).length > 0 ||
      (g.expeditions.bankedStones || 0) > 0 ||
      (g.expeditions.bankedStars || 0) > 0
    )) return true;
    if (sysId === "celestial_spire" && (g.bestSpireFloor || 0) > 0) return true;
    if (sysId === "heavenly_pacts" && Array.isArray(g.pactSeals) && g.pactSeals.length > 0) return true;
    return rankOf(g.realm) >= rankOf(spec.min);
  }

  function guardEcosystemAccess(sysId) {
    if (!game) return false;
    if (isEcosystemSystemUnlocked(game, sysId)) return true;
    const spec = getEcosystemSystemSpec(sysId);
    const reqName = spec && REALMS[spec.min] ? REALMS[spec.min].name : "更高境界";
    const sysName = spec ? spec.name : "高阶试炼";
    showToast(`🔒 【${sysName}】将于【${reqName}期】随主线解封；亦可于右上【仙阁 → 开启演武沙盒】隔离体验！`);
    return false;
  }

  function recordPastLifeInHall(g, endId, opts = {}) {
    if (!g || g.lifeRecorded || sandboxMode) return null;
    ensureMetaState();
    const score = computeCompetitionScore(g);
    const gradeInfo = getScoreGrade(score, g);
    const endSpec = ASCENSION_ENDINGS.find(e => e.id === endId) || ASCENSION_ENDINGS[0];
    const ks = getKarmaState(g);
    const karmaEnd = getKarmaEndingEpilogue(g, endId);
    const calTier = Math.max(0, Math.floor(Number(g.calamityTier) || 0));

    const entry = {
      lifeNum: Math.max(1, metaState.ascensions || 1),
      name: g.name || "顾长青",
      endingId: endSpec.id,
      endingName: endSpec.name,
      karmaMode: ks.mode,
      karmaLabel: ks.label,
      epithet: karmaEnd.epithet,
      poem: karmaEnd.poem,
      score,
      grade: gradeInfo.grade,
      towerBest: Math.max(g.towerBest || 0, 0),
      rushGrade: g.rushBestGrade || metaState.bestRushGrade || "未挑战",
      spireBest: Math.max(g.bestSpireFloor || 0, 0),
      sanctumLv: getSanctumTotalLevel(g),
      codexPct: getCodexCompletionPct(),
      perkId: g.perk || "sword_bone",
      calamityTier: calTier,
      swordAura: (g.cosmetics && g.cosmetics.swordAura) || "azure_jade",
      recordedAt: Date.now()
    };

    g.lifeRecorded = true;
    metaState.hallOfLives.unshift(entry);
    if (metaState.hallOfLives.length > 18) metaState.hallOfLives.length = 18;
    if (!metaState.unlockedEndings.includes(endSpec.id)) metaState.unlockedEndings.push(endSpec.id);
    metaState.karmaAscensions[ks.mode] = (metaState.karmaAscensions[ks.mode] || 0) + 1;
    if (score > (metaState.bestScore || 0)) metaState.bestScore = score;
    if ((g.towerBest || 0) > (metaState.bestTower || 0)) metaState.bestTower = g.towerBest || 0;
    if ((g.bestSpireFloor || 0) > (metaState.bestSpireFloor || 0)) metaState.bestSpireFloor = g.bestSpireFloor || 0;
    if (calTier > (metaState.bestCalamityTier || 0)) metaState.bestCalamityTier = calTier;
    if (!(opts && opts.skipSave)) saveMeta();
    return entry;
  }

  function launchEcosystemAction(actionId) {
    if (!game) return;
    if (["start_tower", "start_sect_defense", "start_cloud_sea", "open_spire", "open_boss_rush", "open_workshop", "open_taixu_craft"].includes(actionId)) {
      if (!guardNotInTribulation("切换挑战模式")) return;
    }
    if (actionId === "open_drawer_cultivate") { closeModal(); toggleDrawer("cultivate"); }
    else if (actionId === "open_taixu_craft") openTaixuCraftMinigameModal("alchemy");
    else if (actionId === "start_tower") {
      if (!guardEcosystemAccess("demon_tower")) return;
      closeModal(); closeDrawer(); initArenaStage(3, true);
    } else if (actionId === "cycle_posture") {
      if (!guardEcosystemAccess("dual_stance")) return;
      closeModal(); toggleWeaponPosture();
    } else if (actionId === "start_sect_defense") startSectDefenseSiege();
    else if (actionId === "trigger_tag_switch") {
      if (!guardEcosystemAccess("tag_team")) return;
      closeModal(); triggerTagTeamSwitch();
    } else if (actionId === "start_cloud_sea") startCloudSeaAerialStage();
    else if (actionId === "open_star_chart") openStarChartModal();
    else if (actionId === "open_expedition") openExpeditionSandboxModal();
    else if (actionId === "open_spire") openCelestialSpireModal();
    else if (actionId === "open_boss_rush") openBossRushModal();
    else if (actionId === "open_endgame_goals") openObjectivesModal("endgame");
    else if (actionId === "open_workshop") openCustomWorkshopModal();
  }

  function renderMasteryResonanceCardHtml(g) {
    const mr = computeEndgameMasteryResonance(g);
    const atkPctTxt = mr.passiveAtkPct > 0 ? `+${(mr.passiveAtkPct * 100).toFixed(1)}% 常驻攻击池` : "+0%";
    const drTxt = mr.drBonus > 0 ? `+${mr.drBonus} 护体减伤` : "+0";
    const critTxt = mr.critBonus > 0 ? ` · +${Math.round(mr.critBonus * 100)}% 暴击` : "";
    return `
      <div class="q6-mastery-strip" data-mastery-active="${mr.activeCount}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
          <strong style="font-size:12px;color:#80ffea;">☯ 诸天道果共鸣 · ${escapeHtml(mr.tierLabel)}</strong>
          <span class="tag-chip ${mr.activeCount >= 4 ? "mythic" : mr.activeCount > 0 ? "done" : ""}" style="font-size:10px;">当前联动：${atkPctTxt} · ${drTxt}${critTxt}</span>
        </div>
        <div class="q6-mastery-grid">
          ${mr.pillars.map(p => `
            <div class="q6-mastery-pill ${p.active ? "lit" : ""}" data-mastery-pillar="${escapeHtml(p.id)}">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                <strong style="color:${p.active ? "#ffe28a" : "#9db8b2"};">${p.active ? "✦ " : "○ "}${escapeHtml(p.name)}</strong>
                <span style="font-size:9.2px;color:${p.active ? "#70ffe6" : "#8ea9a4"};">${escapeHtml(p.progressText)}</span>
              </div>
              <span style="font-size:9.2px;color:#9cc2ba;">${escapeHtml(p.short)}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderHighTierModeGroupStripHtml(g) {
    return `
      <div class="q6-mode-group-strip" data-high-tier-groups="3">
        ${HIGH_TIER_MODE_REGISTRY.map(grp => {
          const unlockedCnt = grp.items.filter(it => it.kind === "action"
            ? isActionUnlockedByRealm(g, it.id)
            : isEcosystemSystemUnlocked(g, it.id)).length;
          return `
            <div class="q6-mode-group-card" data-mode-group="${escapeHtml(grp.groupId)}">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
                <strong style="color:#ffe28a;font-size:11px;">${escapeHtml(grp.groupTitle.split(" · ")[0])}</strong>
                <span class="tag-chip ${unlockedCnt === grp.items.length ? "done" : ""}" style="font-size:9px;">${unlockedCnt}/${grp.items.length}</span>
              </div>
              <span style="font-size:9.5px;color:#a8cac3;line-height:1.3;">${escapeHtml(grp.desc)}</span>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  function openAscensionRoadmapModal() {
    if (!game) return;
    closeDrawer();
    const curRank = rankOf(game.realm);
    const fullOpen = Boolean(sandboxMode || game.unlockAllArcana);
    const totalSys = SYSTEM_ECOSYSTEM_LADDER.reduce((s, t) => s + t.systems.length, 0);
    const unlockedSys = SYSTEM_ECOSYSTEM_LADDER.reduce((s, t) => s + t.systems.filter(x => isEcosystemSystemUnlocked(game, x.id)).length, 0);

    openModal(`
      <div class="drawer-mural-banner" style="height:90px;">
        <img src="${ART.arena_cloud_sea_sky}" alt="问道阶梯" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">诸天玩法阶梯</span>
            <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:3px;">问道阶梯 · 高阶系统随境解封图谱（${unlockedSys}/${totalSys}）</h2>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <button type="button" class="btn-jade" style="padding:5px 11px;font-size:11px;" data-action="toggle-arcana-all-roadmap">${sandboxMode ? "🧪 退出演武沙盒" : "🧪 开启全神通演武沙盒"}</button>
            <button type="button" class="btn-ghost" data-modal-close="1">返回道场 ✕</button>
          </div>
        </div>
      </div>

      <div class="jade-card" style="flex-direction:row;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 12px;">
        <div style="font-size:11.5px;color:#d6eee8;">
          当前境界：<strong style="color:var(--gold-bright);">${REALMS[game.realm].name}</strong> ·
          云海空战过渡关：<strong style="color:${game.cloudSeaCleared ? "#70ffe6" : "#ffd98a"};">${game.cloudSeaCleared ? `✓ 已破阵${game.cloudSeaBestGrade ? ` (${escapeHtml(game.cloudSeaBestGrade)}级)` : ""}（远征/登仙台收益 +15%）` : "待金丹期御剑破阵"}</strong>
        </div>
        <button type="button" class="btn-ghost" style="padding:4px 10px;font-size:11px;border-color:rgba(248,220,144,0.52);color:#ffe8a3;" data-action="open-hall-of-lives">🏛 历世道果殿堂</button>
      </div>

      ${renderHighTierModeGroupStripHtml(game)}
      ${renderMasteryResonanceCardHtml(game)}

      <div style="display:flex;flex-direction:column;gap:7px;max-height:64vh;overflow-y:auto;padding-right:2px;">
        ${SYSTEM_ECOSYSTEM_LADDER.map(tier => {
          const tierOpen = fullOpen || curRank >= rankOf(tier.realm);
          return `
            <div class="roadmap-tier-card ${tierOpen ? "tier-unlocked" : ""}">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <div>
                  <strong style="font-family:var(--font-serif);font-size:14px;color:${tierOpen ? "#ffe28a" : "#b8d0cb"};">${tier.title}</strong>
                  <span style="font-size:10.5px;color:var(--text-sub);margin-left:8px;">${tier.subtitle}</span>
                </div>
                <span class="tag-chip ${tierOpen ? "done" : ""}">${tierOpen ? "已解封" : `需 ${REALMS[tier.realm].name}期`}</span>
              </div>
              <div class="roadmap-sys-grid">
                ${tier.systems.map(sys => {
                  const ok = isEcosystemSystemUnlocked(game, sys.id);
                  const isCloudDone = sys.id === "cloud_sea_trial" && game.cloudSeaCleared;
                  return `
                    <button type="button" class="roadmap-sys-btn ${ok ? "" : "locked"}" data-roadmap-sys="${sys.id}" data-roadmap-act="${sys.action}">
                      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
                        <strong style="font-size:12px;color:${ok ? "#80ffea" : "#d0d8d6"};">${ok ? "✦ " : "🔒 "}${sys.name}</strong>
                        <span class="tag-chip ${isCloudDone ? "mythic" : ok ? "done" : ""}" style="font-size:9.5px;">${isCloudDone ? "破云✓" : ok ? sys.keyHint : `${REALMS[sys.min].name}启`}</span>
                      </div>
                      <span style="font-size:10px;color:#b8d4ce;line-height:1.35;">${sys.desc}</span>
                    </button>
                  `;
                }).join("")}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `, true);
  }

  function openHallOfLivesModal() {
    ensureMetaState();
    if (game) closeDrawer();
    const codexPct = getCodexCompletionPct();
    const lives = metaState.hallOfLives || [];
    const activeAuraId = (game && game.cosmetics && game.cosmetics.swordAura) || "azure_jade";

    openModal(`
      <div class="drawer-mural-banner" style="height:92px;">
        <img src="${ART.heaven_gate}" alt="历世道果殿堂" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">九世轮回碑</span>
            <h2 style="font-family:var(--font-serif);font-size:21px;color:var(--gold-bright);margin-top:3px;">历世道果殿堂 · 多周目轮回档案馆</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">收卷 ✕</button>
        </div>
      </div>

      <div class="hall-stats-row">
        <div class="hall-stat-pill"><small>累计飞升世数</small><strong>第 ${(Number(metaState.ascensions) || 0) + 1} 世（已证 ${Number(metaState.ascensions) || 0} 世）</strong></div>
        <div class="hall-stat-pill"><small>最高锁妖塔 / 登仙台</small><strong>${Number(metaState.bestTower) || 0} 层 / ${Number(metaState.bestSpireFloor) || 0} 重</strong></div>
        <div class="hall-stat-pill"><small>万剑冢最高 / 图鉴完成</small><strong>${escapeHtml(metaState.bestRushGrade || "未定")} / ${codexPct}%</strong></div>
        <div class="hall-stat-pill"><small>最高劫火周目 / 仙榜</small><strong>劫火×${Number(metaState.bestCalamityTier) || 0} · ${Number(metaState.bestScore) || 0}</strong></div>
      </div>

      <div class="jade-card" style="gap:6px;padding:9px 11px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <strong style="font-size:12.5px;color:#ffe28a;">✨ 外显剑意幻化（跨世解锁 · 实时渲染于本命剑阵）</strong>
          <span style="font-size:10.5px;color:var(--text-sub);">${game ? "点击已解锁幻化立即佩带生效" : "开卷后可于万剑衣橱或此处实时切换"}</span>
        </div>
        <div class="wardrobe-pill-row" style="gap:6px;">
          ${WARDROBE_OPTIONS.swordAura.map(au => {
            const ok = isSwordAuraUnlocked(au);
            const eq = !!game && activeAuraId === au.id;
            return `<button type="button" class="wardrobe-opt-btn ${eq ? "active" : ""}" style="${ok ? `border-color:${au.col};` : "opacity:0.5;"}" data-equip-sword-aura="${au.id}" data-tip="${escTip(au.name + "（" + au.unlockText + "）", au.desc)}" ${!ok ? "disabled" : ""}>${ok ? "✦ " : "🔒 "}${au.name}${!ok ? ` (${au.unlockText})` : eq ? " · 佩带中" : ""}</button>`;
          }).join("")}
        </div>
      </div>

      <div class="jade-card" style="gap:6px;padding:9px 11px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
          <strong style="font-size:12.5px;color:#80ffea;">☯ 轮回先天命格解锁进度（${PERKS.filter(p => isPerkUnlocked(p)).length}/${PERKS.length}）</strong>
          <span style="font-size:10.5px;color:var(--text-sub);">下世启程灵石传承：+${Math.min(240, (Number(metaState.ascensions) || 0) * 45 + (Number(metaState.bingjieCount) || 0) * 40)} 灵石（兵解 ${Number(metaState.bingjieCount) || 0} 次 · 上限 240）</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;">
          ${PERKS.filter(p => (p.unlock || 0) > 0).map(p => {
            const ok = isPerkUnlocked(p);
            return `<div style="padding:6px 8px;border-radius:8px;background:rgba(8,22,28,0.88);border:1px solid ${ok ? "rgba(112,255,230,0.48)" : "rgba(216,179,106,0.22)"};opacity:${ok ? 1 : 0.65};">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:11px;"><strong style="color:${ok ? "#ffe28a" : "#b8d0cb"};white-space:nowrap;">${ok ? "✓ " : "🔒 "}${p.name}</strong><span style="color:${ok ? "#70ffe6" : "#d9b87a"};font-size:9.5px;white-space:nowrap;">${ok ? "已解封" : p.unlockText}</span></div>
              <div style="font-size:9.8px;color:var(--text-sub);margin-top:2px;line-height:1.3;">${p.desc}</div>
            </div>`;
          }).join("")}
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:7px;max-height:30vh;overflow-y:auto;padding-right:2px;">
        <strong style="font-size:12.5px;color:var(--gold-bright);">📜 历世证道名录（共 ${lives.length} 卷）</strong>
        ${lives.length === 0
          ? `<div class="hall-life-card" style="text-align:center;color:var(--text-sub);font-size:12px;padding:16px;">尚未有白日飞升之世记入玉碑。破开九霄天门完成首世飞升，即可永久铭刻道果并开启【劫火周目】与轮回先天命格！</div>`
          : lives.map(lf => {
              const pSpec = PERKS.find(x => x.id === lf.perkId);
              const safeKarmaMode = ["righteous", "demonic", "neutral"].includes(lf.karmaMode) ? lf.karmaMode : "neutral";
              const safeCalTier = Number(lf.calamityTier) || 0;
              return `
                <div class="hall-life-card ${safeKarmaMode}">
                  <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                    <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
                      <span class="cinnabar-seal" style="font-size:10px;">第 ${escapeHtml(lf.lifeNum)} 世</span>
                      <strong style="font-family:var(--font-serif);font-size:14px;color:var(--gold-bright);">${escapeHtml(lf.name)} · 【${escapeHtml(lf.epithet)}】</strong>
                      ${safeCalTier > 0 ? `<span class="hud-calamity-pill">🔥 劫火×${safeCalTier}</span>` : ""}
                    </div>
                    <span class="tag-chip mythic">${escapeHtml(lf.grade)} 级 · ${escapeHtml(lf.score)} 分</span>
                  </div>
                  <div style="font-family:var(--font-serif);font-size:11.5px;color:#f4e6c2;white-space:pre-line;line-height:1.45;">${escapeHtml(lf.poem || "")}</div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;font-size:10px;">
                    <span class="tag-chip done">${escapeHtml(lf.karmaLabel || "本真中正")}</span>
                    <span class="tag-chip">命格：${escapeHtml(pSpec ? pSpec.name : (lf.perkId || ""))}</span>
                    <span class="tag-chip">锁妖塔 ${escapeHtml(lf.towerBest || 0)}层</span>
                    <span class="tag-chip">万剑冢 ${escapeHtml(lf.rushGrade || "未挑战")}</span>
                    <span class="tag-chip">洞府 ${escapeHtml(lf.sanctumLv || 5)}/25</span>
                    <span class="tag-chip">图鉴 ${escapeHtml(lf.codexPct || 0)}%</span>
                  </div>
                </div>
              `;
            }).join("")}
      </div>
    `, true);
  }




  let questHudCollapsed = false;
  let currentGoalTab = "mainline";


  function getBountySpec(g, chain) {
    const tier = Math.max(1, (g.bountyTiers && g.bountyTiers[chain.slot]) || 1);
    const need = chain.baseNeed + (tier - 1) * chain.stepNeed;
    const cur = (g.goalStats && g.goalStats[chain.statKey]) || 0;
    const stones = chain.baseStones + (tier - 1) * 35;
    const xp = chain.baseXp + (tier - 1) * 45;
    return {
      slot: chain.slot, tier, title: `${chain.title} · 肆阶${tier}`.replace("肆阶", "第") + "重",
      icon: chain.icon, need, cur, ready: cur >= need,
      desc: chain.descTpl(need), stones, xp
    };
  }

  function computeOverallCompletionPct(g) {
    if (!g) return 0;
    const allSteps = CHAPTERS.reduce((acc, ch) => acc.concat(ch.steps), []);
    const doneSteps = allSteps.filter(s => s.check(g)).length;
    const stars = getTotalStageStars(g); // 0..15
    const laws = Math.min(6, (g.laws || []).length);
    const allies = countBondedAllies(g); // 0..4
    const realmPts = rankOf(g.realm); // 0..6
    const raw = (doneSteps / allSteps.length) * 52 + (stars / 15) * 20 + (realmPts / 6) * 16 + (laws / 6) * 6 + (allies / 4) * 6;
    return Math.min(100, Math.max(3, Math.round(raw)));
  }

  function findNextMainlineStep(g) {
    if (!g) return null;
    // 1. Prioritize any completed step whose reward is NOT yet claimed!
    for (const ch of CHAPTERS) {
      for (const s of ch.steps) {
        if (s.check(g) && !g.claimedStepIds.includes(s.id)) {
          return { ch, step: s, claimReady: true, priority: s.priority || "required" };
        }
      }
    }
    // 2. Prioritize uncompleted REQUIRED progression steps (F15 D01/D03)
    for (const ch of CHAPTERS) {
      for (const s of ch.steps) {
        if ((s.priority || "required") === "required" && !s.check(g)) {
          return { ch, step: s, claimReady: false, priority: "required" };
        }
      }
    }
    // 3. Fallback to uncompleted recommended/optional steps
    for (const ch of CHAPTERS) {
      for (const s of ch.steps) {
        if (!s.check(g)) {
          return { ch, step: s, claimReady: false, priority: s.priority || "optional" };
        }
      }
    }
    return { ch: CHAPTERS[CHAPTERS.length - 1], step: null, claimReady: false, allDone: true };
  }

  function getCurrentChapterIndex(g) {
    if (!g) return 1;
    const byRealm = Math.max(1, Math.min(CHAPTERS.length, rankOf(g.realm) + 1));
    const nextM = findNextMainlineStep(g);
    if (nextM && nextM.allDone) return CHAPTERS.length;
    const byMainline = (nextM && nextM.ch && nextM.ch.index) ? nextM.ch.index : byRealm;
    return Math.max(1, Math.min(CHAPTERS.length, Math.max(byRealm, byMainline)));
  }

  function getAvailableCompanionStories(g, opts = {}) {
    if (!g) return [];
    const allAvail = STORIES.filter(s =>
      !g.choices[s.id] &&
      rankOf(g.realm) >= rankOf(s.min) &&
      (!s.requires || !!g.choices[s.requires])
    );
    if (opts && opts.chapterOnly) {
      const chIdx = typeof opts.chapterIdx === "number" ? opts.chapterIdx : getCurrentChapterIndex(g);
      const exact = allAvail.filter(s => s.chapter === chIdx);
      if (exact.length) return exact;
      return allAvail.filter(s => s.chapter <= chIdx);
    }
    return allAvail;
  }

  function hasAnyClaimableGoalReward(g) {
    if (!g) return false;
    for (const ch of CHAPTERS) {
      for (const s of ch.steps) {
        if (s.check(g) && !g.claimedStepIds.includes(s.id)) return true;
      }
    }
    const stars = getTotalStageStars(g);
    if (STAR_MILESTONE_CHESTS.some(c => stars >= c.need && !g.claimedStarChests.includes(c.id))) return true;
    if (SECT_BOUNTY_CHAINS.some(ch => getBountySpec(g, ch).ready)) return true;
    return false;
  }

  function claimMainlineStepReward(stepId) {
    if (!game) return;
    const resolvedId = canonicalizeStepId(stepId);
    if (!resolvedId) return;
    let found = null;
    for (const ch of CHAPTERS) {
      for (const s of ch.steps) {
        if (s.id === resolvedId) { found = s; break; }
      }
    }
    if (!found || !found.check(game) || game.claimedStepIds.includes(resolvedId)) return;
    game.claimedStepIds.push(resolvedId);
    const rw = found.reward || {};
    if (rw.stones) game.stones += rw.stones;
    if (rw.herb) game.inventory.herb = (game.inventory.herb || 0) + rw.herb;
    if (rw.core) game.inventory.core = (game.inventory.core || 0) + rw.core;
    if (rw.pill) game.inventory[rw.pill] = (game.inventory[rw.pill] || 0) + (rw.pillQty || (resolvedId === "s3_serpent" || resolvedId === "s6_pacts" ? 2 : 1));
    if (rw.bonusSword) { game.bonusSwords = (game.bonusSwords || 0) + rw.bonusSword; syncFlyingSwords(); }
    if (rw.gearMin !== undefined) acquireGearItem(rollGearItem(Math.max(1, arena.stageIdx), rw.gearMin));
    Sound.fanfare();
    addRipple(arena.player.x, arena.player.y + 24, 92, "#ffe28a");
    showToast(`✦ 主线道标达成！领取赏赐【${found.rewardTxt}】`);
    saveGame();
    updateHud();
  }

  function routeToGoalTarget(routeKey) {
    if (!game) return;
    if (arena.tribulation && (routeKey === "hub" || routeKey === "tower" || routeKey === "calamity_ng" || routeKey === "meditate" || routeKey === "tribulate" || (routeKey && routeKey.startsWith("stage_")))) {
      guardNotInTribulation(routeKey === "meditate" ? "周天吐纳" : "道标传送");
      return;
    }
    activeMatSourceJump = null;
    closeModal();
    const r = REALMS[game.realm];
    if (routeKey === "tribulate") {
      const bossGate = getBreakthroughBossGate(game);
      if (bossGate && bossGate.locked) {
        openTribulationPrepModal();
        return;
      }
      if (r.xpCap > 0 && game.xp >= r.xpCap) {
        startLiveTribulation();
      } else {
        toggleMeditation(true);
        showToast("已开启【周天吐纳】加速凝聚渡劫修为！满槽后按 B 引动天劫");
      }
      return;
    }
    if (routeKey === "meditate") {
      toggleMeditation(true);
      showToast("盘膝引灵入体 · 攒满修为槽即可按 B 渡劫破境！");
      return;
    }
    if (routeKey === "hub") {
      if (!arena.sanctumMode) enterSanctumHub();
      else toggleDrawer("alchemy");
      return;
    }
    if (routeKey === "drawer_cultivate") { toggleDrawer("cultivate"); return; }
    if (routeKey === "drawer_story")     { toggleDrawer("story"); return; }
    if (routeKey === "drawer_alchemy")   { toggleDrawer("alchemy"); return; }
    if (routeKey === "calamity_ng") {
      closeDrawer();
      openEndingModal();
      return;
    }
    if (routeKey === "tower") {
      if (!isEcosystemSystemUnlocked(game, "demon_tower")) { showToast("晋升【炼气期】后开启镇妖古塔！"); return; }
      closeDrawer(); focusBattlefield(); initArenaStage(3, true);
      return;
    }
    if (routeKey && routeKey.startsWith("stage_")) {
      const idx = Number(routeKey.split("_")[1]) || 0;
      const stg = STAGES[idx];
      if (stg && rankOf(game.realm) < rankOf(stg.min)) {
        toggleMeditation(true);
        showToast(`需先晋升【${REALMS[stg.min].name}】方可前往${stg.name}，已为你开启吐纳聚气！`);
        return;
      }
      closeDrawer();
      if (arena.sanctumMode || arena.stageIdx !== idx || arena.towerMode) { focusBattlefield(); initArenaStage(idx, false); }
      else showToast(`已在【${stg.name}】· 跟随脚底金针斩妖推进！`);
    }
  }

  function openObjectivesModal(forceTab = null) {
    if (!game) return;
    activeMatSourceJump = null;
    if (forceTab) currentGoalTab = forceTab;
    closeDrawer();
    const pct = computeOverallCompletionPct(game);
    const totalStars = getTotalStageStars(game);
    const navSnap = buildNavigationSnapshot(game);
    const activeInfo = findNextMainlineStep(game);
    const activeChIdx = activeInfo && activeInfo.ch ? activeInfo.ch.index : CHAPTERS.length;
    const maxVisibleChIdx = Math.max(activeChIdx, getCurrentChapterIndex(game));

    let tabBody = "";
    if (currentGoalTab === "mainline") {
      const allDoneCard = (activeInfo && activeInfo.allDone) ? `
        <div class="jade-card" style="border-color:rgba(255,226,138,0.68);gap:7px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <strong style="font-family:var(--font-serif);font-size:var(--fs-lg);color:var(--gold-bright);">✦ 仙途圆满 → 劫火周目 / 锁妖塔纪录</strong>
            <span class="tag-chip done">全部主线已圆满</span>
          </div>
          <div style="font-size:var(--fs-sm);color:var(--text-sub);line-height:1.45;">
            全部主线道标皆已功成领赏！可开启更高劫火周目重入轮回，或挑战镇妖古塔刷新层数纪录。
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn-primary btn-gold" style="padding:5px 12px;font-size:var(--fs-sm);" data-route-goal="calamity_ng">🔥 劫火周目 ▸</button>
            <button type="button" class="btn-secondary btn-jade" style="padding:5px 12px;font-size:var(--fs-sm);" data-route-goal="tower">🗼 锁妖塔纪录 ▸</button>
          </div>
        </div>
      ` : "";
      tabBody = `
        ${allDoneCard}
        <div class="chapter-stepper">
          ${CHAPTERS.map(ch => {
            const done = ch.steps.every(s => s.check(game) && game.claimedStepIds.includes(s.id));
            const isAct = ch.index === activeChIdx;
            return `<div class="ch-node-pill ${done ? "done" : isAct ? "active" : ""}">${ch.vol}<br/>${ch.title.slice(0, 4)}</div>`;
          }).join("")}
        </div>
        <div style="max-height:330px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding-right:4px;">
          ${CHAPTERS.filter(ch => ch.index <= maxVisibleChIdx + 1).map(ch => {
            const volStories = navSnap.companions.filter(st => st.chapter === ch.index);
            const compFooter = volStories.length ? `
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding-top:4px;border-top:1px dashed rgba(244,196,255,0.22);font-size:var(--fs-xs);">
                ${renderSemanticTag("companion", "本卷可选故人线")}
                ${volStories.map(st => {
                  if (st.status === "done") {
                    return `<span class="tag-chip done">✓ ${escapeHtml(st.npcName)}·《${escapeHtml(st.name)}》</span>`;
                  }
                  if (st.status === "available") {
                    return `<button type="button" class="btn-tertiary btn-ghost" style="padding:2px 8px;font-size:var(--fs-xs);border-color:rgba(244,196,255,0.55);color:#f4c4ff;" data-open-companion-story="${escapeHtml(st.id)}">♥ ${escapeHtml(st.npcName)}·《${escapeHtml(st.name)}》·📍${escapeHtml(st.locLabel)} ▸</button>`;
                  }
                  return `<span class="tag-chip is-locked">○ ${escapeHtml(st.npcName)}·《${escapeHtml(st.name)}》·📍${escapeHtml(st.locLabel)}</span>`;
                }).join("")}
              </div>
            ` : "";
            const volGuide = VOLUME_CAMPAIGN_GUIDE.find(v => v.volIndex === ch.index) || null;
            const volBriefHtml = volGuide ? `
              <div class="q6-vol-brief-box" data-vol-brief="${ch.index}">
                <div><strong>⚔ 敌招考题（${escapeHtml(volGuide.enemyExam.bossName)}）：</strong>${escapeHtml(volGuide.enemyExam.telegraph)} → ${escapeHtml(volGuide.enemyExam.counter)}</div>
                <div><strong>✦ 成长收益：</strong>${escapeHtml(volGuide.growthPayoff)}</div>
                <div style="color:var(--text-sub);">${escapeHtml(volGuide.optionalRouteNote)}</div>
              </div>
            ` : "";
            const vol5Cta = ch.index === 5 ? `
              <div style="display:flex;justify-content:flex-end;">
                <button type="button" class="btn-secondary btn-jade" style="padding:3px 10px;font-size:var(--fs-xs);" data-action="open-vol5-resonance">✦ 展开第五卷 · 法则共鸣与元神试剑总览 ▸</button>
              </div>
            ` : "";
            return `
            <div class="jade-card" style="gap:6px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:6px;">
                  ${renderSemanticTag("main", ch.vol)}
                  <strong style="font-family:var(--font-serif);font-size:var(--fs-lg);color:var(--gold-bright);">《${escapeHtml(ch.title)}》</strong>
                </div>
                <span style="font-size:var(--fs-xs);color:var(--text-sub);">${ch.steps.filter(s => s.check(game)).length}/${ch.steps.length} 已达成</span>
              </div>
              <p style="font-size:var(--fs-xs);color:var(--text-sub);line-height:1.45;margin:0;">${escapeHtml(ch.desc)}</p>
              ${volBriefHtml}
              ${vol5Cta}
              ${ch.steps.map(s => {
                const ok = s.check(game);
                const claimed = game.claimedStepIds.includes(s.id);
                const pri = s.priority || "required";
                const priBadge = pri === "required"
                  ? renderSemanticTag("main", "必做")
                  : pri === "recommended"
                    ? renderSemanticTag("econ", "推荐")
                    : renderSemanticTag("side", "可选");
                return `
                  <div class="visual-tile ${ok && !claimed ? "rarity-4" : ""} ${pri !== "required" ? "is-side" : ""}" style="justify-content:space-between;padding:7px 10px;gap:8px;">
                    <div style="display:flex;flex-direction:column;gap:3px;">
                      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                        ${priBadge}
                        <span style="font-size:var(--fs-sm);font-weight:700;color:${claimed ? "var(--jade)" : "var(--text-main)"};">${claimed ? "✓ " : ok ? "★ " : "○ "}${escapeHtml(s.text)}</span>
                      </div>
                      <span style="font-size:var(--fs-xs);color:var(--gold);">道标赏赐：${escapeHtml(s.rewardTxt)}</span>
                    </div>
                    ${claimed
                      ? `<span class="tag-chip done">已领赏</span>`
                      : ok
                        ? `<button type="button" class="btn-primary btn-gold" style="padding:4px 12px;font-size:var(--fs-sm);" data-claim-step="${escapeHtml(s.id)}">领取道赏</button>`
                        : `<button type="button" class="btn-secondary btn-jade" style="padding:4px 11px;font-size:var(--fs-sm);" data-route-goal="${escapeHtml(s.route)}">前往推进 ▸</button>`}
                  </div>
                `;
              }).join("")}
              ${compFooter}
            </div>
          `;
          }).join("")}
        </div>
      `;
    } else if (currentGoalTab === "trials") {
      tabBody = `
        <div class="jade-card" style="gap:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:6px;">
              ${renderSemanticTag("side", "支线·诸天试炼")}
              <strong style="font-family:var(--font-serif);font-size:var(--fs-lg);color:var(--gold-bright);">与九州舆图统一的侧边试炼总览</strong>
            </div>
            <span style="font-size:var(--fs-xs);color:var(--text-sub);">按境界分批解封 · 与演武坪/仙阁共享入口</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:7px;max-height:360px;overflow-y:auto;">
            ${navSnap.trials.map(tr => `
              <div class="visual-tile is-side ${tr.unlocked ? "" : "is-locked"}" style="justify-content:space-between;padding:8px 11px;gap:8px;">
                <div>
                  <div style="font-size:var(--fs-md);font-weight:700;color:${tr.unlocked ? "var(--gold-bright)" : "var(--c-locked)"};">${escapeHtml(tr.name)}</div>
                  <div style="font-size:var(--fs-xs);color:var(--text-sub);margin-top:2px;">${escapeHtml(tr.rewardSummary)}${tr.unlocked ? "" : ` · 🔒 ${escapeHtml(tr.lockReason)}`}</div>
                </div>
                <button type="button" class="${tr.unlocked ? "btn-secondary btn-jade" : "btn-tertiary btn-ghost is-locked"}" style="padding:4px 11px;font-size:var(--fs-xs);white-space:nowrap;" data-action="${escapeHtml(tr.action)}" data-reminder-tier="${tr.unlocked ? "2" : "3"}" ${tr.unlocked ? "" : "disabled"}>${tr.unlocked ? "前往试炼 ▸" : `🔒 ${escapeHtml(tr.lockReason)}`}</button>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    } else if (currentGoalTab === "companions") {
      tabBody = `
        <div class="jade-card" style="gap:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:6px;">
              ${renderSemanticTag("companion", "红尘故人线")}
              <strong style="font-family:var(--font-serif);font-size:var(--fs-lg);color:var(--gold-bright);">四位故人结缘进度（同心 ×${countBondedAllies(game)}）</strong>
            </div>
            <button type="button" class="btn-secondary btn-jade" style="padding:3px 9px;font-size:var(--fs-xs);" data-route-goal="drawer_story">打开【故人】抽屉 ▸</button>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;max-height:360px;overflow-y:auto;">
            ${navSnap.companions.map(st => `
              <div class="visual-tile ${st.status === "available" ? "equipped" : st.status === "locked" ? "is-locked" : ""}" style="justify-content:space-between;padding:7px 10px;gap:8px;">
                <div>
                  <div style="font-size:var(--fs-sm);font-weight:700;color:${st.status === "done" ? "var(--jade)" : st.status === "available" ? "var(--c-companion)" : "var(--text-sub)"};">
                    第${st.chapter}卷 · ${escapeHtml(st.npcName)}《${escapeHtml(st.name)}》
                  </div>
                  <div style="font-size:var(--fs-xs);color:var(--text-sub);">📍 ${escapeHtml(st.locLabel)} · ${escapeHtml(st.reqText)}</div>
                </div>
                ${st.status === "done"
                  ? `<span class="tag-chip done">已结缘</span>`
                  : st.status === "available"
                    ? `<button type="button" class="btn-primary btn-gold" style="padding:4px 10px;font-size:var(--fs-xs);" data-open-companion-story="${escapeHtml(st.id)}">前往茶叙 ▸</button>`
                    : `<span class="tag-chip is-locked">${escapeHtml(st.reqText)}</span>`}
              </div>
            `).join("")}
          </div>
        </div>
      `;
    } else if (currentGoalTab === "bounties") {
      tabBody = `
        <div class="jade-card" style="gap:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
            <strong style="font-size:var(--fs-md);color:var(--gold-bright);font-family:var(--font-serif);">★ 九州秘境三星征途秘宝（当前累计 ${totalStars} / 15 ★）</strong>
            <span style="font-size:var(--fs-xs);color:var(--jade);">满三星诀窍：斩首领 + 连击≥12或破势 + 气血≥35%</span>
          </div>
          <div class="milestone-chest-grid">
            ${STAR_MILESTONE_CHESTS.map(ch => {
              const claimed = game.claimedStarChests.includes(ch.id);
              const canClaim = !claimed && totalStars >= ch.need;
              return `
                <div class="chest-card ${canClaim ? "claimable" : claimed ? "claimed" : ""}">
                  <img src="${ART[ch.art]}" alt="${ch.name}" style="width:34px;height:34px;" />
                  <strong style="font-size:var(--fs-sm);color:var(--gold-bright);">${ch.name}</strong>
                  <span style="font-size:var(--fs-xs);color:var(--text-sub);line-height:1.35;">${ch.desc}</span>
                  ${claimed
                    ? `<span class="tag-chip done">已开启</span>`
                    : canClaim
                      ? `<button type="button" class="btn-primary btn-gold" style="padding:3px 10px;font-size:var(--fs-xs);" data-claim-star-chest="${ch.id}">开启秘匣!</button>`
                      : `<span class="tag-chip is-locked">需 ${ch.need} ★</span>`}
                </div>
              `;
            }).join("")}
          </div>
          <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;">
            ${STAGES.map((stg, idx) => {
              const stCount = Math.min(3, (game.stageStars && game.stageStars[idx]) || 0);
              const stGrade = stageStarsToGrade(stCount);
              const unlocked = rankOf(game.realm) >= rankOf(stg.min);
              return `
                <button type="button" class="ch-node-pill ${stCount >= 3 ? "done" : stCount > 0 ? "active" : ""} ${unlocked ? "" : "is-locked"}" data-warp-stage="${idx}" ${!unlocked ? "disabled" : ""}>
                  <div>${stg.name.slice(0, 4)}</div>
                  <div style="color:#ffd970;">${stGrade}级 ${"★".repeat(stCount)}${"☆".repeat(3 - stCount)}</div>
                </button>
              `;
            }).join("")}
          </div>
        </div>

        <div class="jade-card" style="gap:7px;">
          <strong style="font-size:var(--fs-md);color:var(--gold-bright);font-family:var(--font-serif);">⚔ 青云天命悬赏金榜（循环晋阶试炼令）</strong>
          ${SECT_BOUNTY_CHAINS.map(chain => {
            const b = getBountySpec(game, chain);
            return `
              <div class="visual-tile ${b.ready ? "rarity-4" : ""}" style="justify-content:space-between;padding:8px 11px;">
                <div style="display:flex;align-items:center;gap:9px;">
                  <img src="${ART[b.icon]}" alt="${b.title}" style="width:32px;height:32px;" />
                  <div>
                    <div style="font-size:var(--fs-md);font-weight:700;color:var(--gold-bright);">${b.title} <span style="font-size:var(--fs-xs);color:var(--jade);">(${Math.min(b.cur, b.need)}/${b.need})</span></div>
                    <div style="font-size:var(--fs-xs);color:var(--text-sub);">${b.desc} · 赏 <b style="color:#ffe28a;">${b.stones}灵石 + ${b.xp}修为 + 妖核×1</b></div>
                  </div>
                </div>
                ${b.ready
                  ? `<button type="button" class="btn-primary btn-gold" style="padding:5px 12px;font-size:var(--fs-sm);" data-claim-bounty="${b.slot}">领赏晋阶</button>`
                  : `<span class="tag-chip">${Math.round((Math.min(b.cur, b.need) / b.need) * 100)}%</span>`}
              </div>
            `;
          }).join("")}
        </div>
      `;
    } else {
      const pillars = [
        { name: "一重天命 · 证道化神", desc: "由凡胎一步步渡劫突破至【化神期】尊者", cur: `${REALMS[game.realm].name} (${rankOf(game.realm)}/5)`, done: rankOf(game.realm) >= 5, route: "tribulate" },
        { name: "二重天命 · 逆天改命", desc: "在紫霄雷劫中觉醒至少 2 枚【先天道果】", cur: `${(game.destinyFruits || []).length}/2 枚`, done: (game.destinyFruits || []).length >= 2, route: "tribulate" },
        { name: "三重天命 · 红尘同心", desc: "与沈清禾、裴照、陆玄松、砚尘结契至少 3 人", cur: `${countBondedAllies(game)}/3 位`, done: countBondedAllies(game) >= 3, route: "drawer_story" },
        { name: "四重天命 · 神兵万法", desc: "激活任一双法则神话羁绊，或本命法宝淬炼至 ★3", cur: `${SYNERGIES.some(s => s.active(game)) ? "已激活神话羁绊" : `法宝★${num(getEquippedRelicStars(game), 0)}`}`, done: SYNERGIES.some(s => s.active(game)) || num(getEquippedRelicStars(game), 0) >= 3, route: "drawer_alchemy" },
        { name: "五重天命 · 剑开天门", desc: "踏破【九霄天门】击败天门道影，白日飞升证道仙帝！", cur: game.status === "ascended" ? "已飞升证道" : "待叩天门", done: game.status === "ascended", route: "stage_4" }
      ];
      const pactsOk = isEcosystemSystemUnlocked(game, "heavenly_pacts");
      const starOk = isEcosystemSystemUnlocked(game, "star_chart");
      const starSpec = getEcosystemSystemSpec("star_chart");
      const pactSpec = getEcosystemSystemSpec("heavenly_pacts");
      const starMinName = (starSpec && REALMS[starSpec.min]) ? REALMS[starSpec.min].name : "金丹";
      const pactMinName = (pactSpec && REALMS[pactSpec.min]) ? REALMS[pactSpec.min].name : "化神";
      tabBody = `
        <div class="jade-card" style="gap:8px;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
            <strong style="font-size:var(--fs-lg);color:var(--gold-bright);font-family:var(--font-serif);">🏆 九霄飞升 · 终极证道五重天命总览</strong>
            <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
              <button type="button" class="btn-secondary btn-jade" style="padding:3px 9px;font-size:var(--fs-xs);" data-action="open-ascension-roadmap">📊 问道阶梯</button>
              <button type="button" class="btn-tertiary btn-ghost" style="padding:3px 9px;font-size:var(--fs-xs);border-color:rgba(248,220,144,0.52);color:#ffe8a3;" data-action="open-hall-of-lives">🏛 九世轮回殿</button>
              <button type="button" class="btn-primary btn-gold ${starOk ? "" : "eco-locked-btn is-locked"}" style="padding:3px 10px;font-size:var(--fs-xs);" data-action="open-star-chart" data-eco-lock-tag="${starMinName}启">${starOk ? `🌟 周天星图 (${(game.litStars || []).length}/28)` : "🔒 周天星图"}</button>
              <span class="tag-chip mythic">完成度 ${pct}%</span>
            </div>
          </div>
          ${renderMasteryResonanceCardHtml(game)}
          ${renderHighTierModeGroupStripHtml(game)}
          <div style="padding:8px 10px;border-radius:10px;background:rgba(28,12,18,0.68);border:1px solid rgba(255,120,110,0.35);display:flex;flex-direction:column;gap:6px;${pactsOk ? "" : "opacity:0.78;"}">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;">
              <strong style="font-size:var(--fs-sm);color:#ffb3ae;">🔥 天道劫印 · 巅峰难度契约（已启 ${getActivePactCount(game)}/5 劫${pactsOk ? "" : ` · 🔒${pactMinName}期解封`}）</strong>
              <span style="font-size:var(--fs-xs);color:#ffe28a;">神装爆率 +${getActivePactCount(game) * 18}% · 仙榜总分 +${getActivePactCount(game) * 12}%</span>
            </div>
            <div class="pact-seal-grid">
              ${PACT_SEALS.map(ps => {
                const on = hasPact(game, ps.id);
                return `
                  <button type="button" class="pact-seal-btn ${on ? "active" : ""}" data-toggle-pact="${ps.id}">
                    <span style="font-size:var(--fs-xs);color:${on ? "#ff9e98" : "var(--text-sub)"};">${ps.badge}</span>
                    <strong style="font-size:var(--fs-sm);color:var(--gold-bright);">${ps.name}</strong>
                    <span style="font-size:var(--fs-xs);color:var(--text-sub);line-height:1.25;">${ps.desc}</span>
                  </button>
                `;
              }).join("")}
            </div>
          </div>
          ${pillars.map(p => `
            <div class="visual-tile ${p.done ? "equipped" : ""}" style="justify-content:space-between;padding:9px 12px;">
              <div>
                <div style="font-size:var(--fs-md);font-weight:700;color:${p.done ? "var(--jade)" : "var(--gold-bright)"};">${p.done ? "✓ " : "◎ "}${p.name}</div>
                <div style="font-size:var(--fs-xs);color:var(--text-sub);margin-top:2px;">${p.desc}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:var(--fs-sm);color:#ffe28a;font-weight:700;">${p.cur}</span>
                ${p.done ? `<span class="tag-chip done">已圆满</span>` : `<button type="button" class="btn-secondary btn-jade" style="padding:4px 10px;font-size:var(--fs-xs);" data-route-goal="${p.route}">前往 ▸</button>`}
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    openModal(`
      <div class="modal-header">
        <div class="drawer-mural-banner" style="height:88px;width:100%;">
          <img src="${ART.banner_archive}" alt="九霄问道录" />
          <div class="drawer-mural-overlay">
            <div>
              ${renderSemanticTag("main", "天命总纲 · 统一导航")}
              <h2 style="font-family:var(--font-serif);font-size:var(--fs-xl);color:var(--gold-bright);margin-top:3px;">九霄问道录 · 仙途目标总览（总进度 ${pct}%）</h2>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <button type="button" class="btn-secondary btn-jade" style="padding:4px 10px;font-size:var(--fs-xs);" data-action="open-world-map">🗺 九州舆图 (M)</button>
              <button type="button" class="btn-tertiary btn-ghost" data-modal-close="1">返回道场 ×</button>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-body">
        <div style="display:flex;gap:6px;flex-wrap:wrap;" role="tablist" aria-label="九霄问道录导航页签">
          ${NAV_MODEL_TABS.map(tb => {
            const sem = SEMANTIC_META[tb.sem] || SEMANTIC_META.main;
            const active = currentGoalTab === tb.id;
            return `<button type="button" role="tab" aria-selected="${active ? "true" : "false"}" class="btn-tertiary btn-ghost ${active ? "active-pill" : ""}" data-goal-tab="${tb.id}">${sem.glyph} ${escapeHtml(tb.label)}</button>`;
          }).join("")}
        </div>
        ${tabBody}
      </div>
      <div class="modal-footer">
        <span style="font-size:var(--fs-xs);color:var(--text-sub);">快捷键：<b style="color:var(--gold-bright);">T</b> 打开九霄问道录 · <b style="color:var(--gold-bright);">M</b> 展开九州舆图 · <b style="color:var(--gold-bright);">H</b> 返听雨洞府</span>
        <span style="font-size:var(--fs-xs);color:var(--jade);">当前境界：${REALMS[game.realm].name}</span>
      </div>
    `, true, { tier: "info" });
  }

  function openVol5ResonanceModal() {
    if (!game) return false;
    closeDrawer();
    const snap = buildVol5ResonanceSnapshot(game);
    const guide = VOLUME_CAMPAIGN_GUIDE.find(v => v.volIndex === 5) || VOLUME_CAMPAIGN_GUIDE[4];
    return openModal(`
      <div class="modal-header">
        <div class="drawer-mural-banner" style="height:94px;width:100%;">
          <img src="${ART.arena_terrace}" alt="第五卷 · 法则共鸣" />
          <div class="drawer-mural-overlay">
            <div>
              ${renderSemanticTag("main", "第五卷 · 元神试剑")}
              <h2 style="font-family:var(--font-serif);font-size:var(--fs-xl);color:var(--gold-bright);margin-top:3px;">法则共鸣 · 元婴破虚化神总览</h2>
            </div>
            <button type="button" class="btn-tertiary btn-ghost" data-modal-close="1">收卷 ✕</button>
          </div>
        </div>
      </div>
      <div class="modal-body" id="vol5-resonance-modal-body">
        <div class="jade-card" style="gap:6px;padding:9px 11px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <strong style="font-family:var(--font-serif);font-size:14px;color:var(--gold-bright);">📜 第五卷叙事与核心目标（D01/D04 保守基线）</strong>
            <span class="tag-chip ${snap.s5LawsDone ? "done" : "mythic"}">${snap.s5LawsDone ? "✓ 万法共鸣已达标" : "待聚四法或法宝★3"}</span>
          </div>
          <p style="font-size:12px;color:var(--text-main);line-height:1.55;margin:0;">${escapeHtml(guide.goalSummary)}</p>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;font-size:11.5px;">
            <div class="visual-tile ${snap.s5LawsDone ? "equipped" : ""}" style="padding:7px 9px;justify-content:space-between;">
              <span>大道法则 / 法宝淬星</span>
              <strong style="color:#ffe28a;">法则 ${snap.lawCount}/${snap.lawNeed} 或 法宝 ★${snap.relicStars}/${snap.relicNeed}</strong>
            </div>
            <div class="visual-tile ${snap.isSpiritOrAbove || snap.readyForSpiritTribulation ? "equipped" : ""}" style="padding:7px 9px;justify-content:space-between;">
              <span>化神天劫进度</span>
              <strong style="color:#70ffe6;">${snap.isSpiritOrAbove ? "已证化神+" : snap.xpReady ? `修为圆满 (${snap.xp}/${snap.xpCap})` : `修为 ${snap.xp}/${snap.xpCap}`}</strong>
            </div>
          </div>
          <div id="vol5-d01-dual-note" style="font-size:11px;color:#ffd8a8;background:rgba(44,26,12,0.52);border:1px solid rgba(255,196,102,0.34);border-radius:8px;padding:6px 9px;line-height:1.45;">
            ☯ <b>双轨破境说明（化神丹持有 ×${snap.spiritPillCount}）</b>：${escapeHtml(snap.dualBreakthroughNote)}
          </div>
        </div>

        ${renderMasteryResonanceCardHtml(game)}

        <div class="jade-card" style="gap:6px;padding:9px 11px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong style="font-size:12.5px;color:#f4c4ff;">♥ 第五卷故人终章前奏（可选加分，不硬锁主线）</strong>
            <button type="button" class="btn-ghost" style="padding:2px 8px;font-size:10.5px;" data-route-goal="drawer_story">前往【故人】抽屉 ▸</button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${snap.companionStatus.map(cs => `
              <span class="tag-chip ${cs.done ? "done" : ""}">${cs.done ? "✓ " : "○ "}${escapeHtml(cs.name)}</span>
            `).join("")}
          </div>
        </div>
      </div>
      <div class="modal-footer" style="flex-wrap:wrap;gap:6px;">
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn-primary btn-gold" style="padding:5px 12px;font-size:11.5px;" data-route-goal="stage_4">⚔ 前往九霄天门试剑</button>
          <button type="button" class="btn-secondary btn-jade" style="padding:5px 12px;font-size:11.5px;" data-route-goal="tribulate">⚡ 前往渡劫化神</button>
          <button type="button" class="btn-tertiary btn-ghost" style="padding:5px 10px;font-size:11px;" data-action="open-ascension-roadmap">📊 问道阶梯</button>
          <button type="button" class="btn-tertiary btn-ghost" style="padding:5px 10px;font-size:11px;" data-action="open-star-chart">🌟 周天星图</button>
          <button type="button" class="btn-tertiary btn-ghost" style="padding:5px 10px;font-size:11px;" data-action="open-world-map">🗺 九州舆图</button>
        </div>
      </div>
    `, true, { kind: "vol5_resonance", tier: "info" });
  }

  function openVol5ResonanceFlow() {
    if (!game) return false;
    const canPlayIntro = Boolean(
      rankOf(game.realm) >= 4
      && !(game.seenCutscenes && game.seenCutscenes.enter_vol5_resonance)
      && !arena.enemies.some(e => e.hp > 0 && !e.isDummy && !e.isTreasure)
      && !arena.tribulation
      && !arena.defeatPending
    );
    if (canPlayIntro) {
      closeModal();
      closeDrawer();
      playCutscene("enter_vol5_resonance", () => { openVol5ResonanceModal(); });
      return true;
    }
    return openVol5ResonanceModal();
  }

  function renderQuestTrackerHud() {
    const bodyEl = document.getElementById("qt-body-rows");
    const pctEl  = document.getElementById("qt-overall-pct");
    const dotEl  = document.getElementById("goal-hud-dot");
    const wrapEl = document.getElementById("quest-tracker-hud");
    if (!bodyEl || !game) return;

    const pct = computeOverallCompletionPct(game);
    const rem = getReminderTier(game);
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (dotEl) {
      dotEl.classList.toggle("show", rem.tier1HudHigh);
      dotEl.setAttribute("data-reminder-tier", rem.tier1HudHigh ? "1" : "0");
    }
    if (wrapEl) wrapEl.classList.toggle("collapsed", questHudCollapsed);

    const nextM = findNextMainlineStep(game);
    const rows = [];
    if (nextM && nextM.allDone) {
      const towerBest = Math.max(0, Math.floor(num(game.towerBest, 0)));
      const calTier = Math.max(0, Math.floor(num(game.calamityTier, 0)));
      rows.push(`
        <div class="qt-goal-row claim-ready" style="gap:5px;">
          <div class="qt-row-top">
            <span class="qt-tag-main">✦ 仙途圆满</span>
            <span class="qt-action-pill">${calTier > 0 ? `劫火×${calTier}` : `锁妖塔 #${towerBest}层`}</span>
          </div>
          <div class="qt-desc-line">仙途圆满 → 劫火周目 / 锁妖塔纪录</div>
          <div style="display:flex;gap:5px;margin-top:2px;">
            <button type="button" class="btn-gold" style="flex:1;padding:3px 6px;font-size:10.5px;" data-route-goal="calamity_ng">🔥 劫火周目</button>
            <button type="button" class="btn-jade" style="flex:1;padding:3px 6px;font-size:10.5px;" data-route-goal="tower">🗼 锁妖塔纪录</button>
          </div>
        </div>
      `);
    } else if (nextM && nextM.step) {
      if (nextM.claimReady) {
        rows.push(`
          <button type="button" class="qt-goal-row claim-ready" data-claim-step="${nextM.step.id}">
            <div class="qt-row-top">
              <span class="qt-tag-main">★ 主线达成 · ${nextM.ch.vol}</span>
              <span class="qt-action-pill">点击领赏!</span>
            </div>
            <div class="qt-desc-line">${nextM.step.text}（${nextM.step.rewardTxt}）</div>
          </button>
        `);
      } else {
        rows.push(`
          <button type="button" class="qt-goal-row" data-route-goal="${nextM.step.route || "stage_0"}">
            <div class="qt-row-top">
              <span class="qt-tag-main">📜 ${nextM.ch.vol} · 主线道标</span>
              <span class="qt-action-pill">引路 ▸</span>
            </div>
            <div class="qt-desc-line">${nextM.step.text}</div>
          </button>
        `);
      }
    }

    // Row 2: During prologue keep single-objective focus; after prologue show ready bounty, 3-Star strip, or top Sanctum bounty
    const isPrologueFocus = !game.openingChoice && rankOf(game.realm) < 1;
    const readyBounty = SECT_BOUNTY_CHAINS.map(c => getBountySpec(game, c)).find(b => b.ready);
    if (readyBounty) {
      rows.push(`
        <button type="button" class="qt-goal-row claim-ready" data-claim-bounty="${readyBounty.slot}">
          <div class="qt-row-top">
            <span class="qt-tag-sub">⚔ 悬赏功成</span>
            <span class="qt-action-pill">+${readyBounty.stones}石!</span>
          </div>
          <div class="qt-desc-line">${readyBounty.title}（点击领赏晋阶）</div>
        </button>
      `);
    } else if (!isPrologueFocus && !arena.sanctumMode && !arena.towerMode) {
      const st = getCombatStats(game);
      const s1 = (game.stageStars && game.stageStars[arena.stageIdx]) >= 1;
      const s2 = arena.stageTechDone || arena.maxStageCombo >= 12 || (game.stageStars && game.stageStars[arena.stageIdx]) >= 2;
      const s3 = game.hp >= st.maxHp * 0.35;
      rows.push(`
        <button type="button" class="qt-stars-inline" data-open-goals="bounties" data-tip="秘境三星挑战目标|集满九州秘境星辉可在【目标 → 15星秘宝】开启鸿蒙神兵宝匣！">
          <span class="qt-star-item ${s1 ? "done" : ""}">${s1 ? "★" : "☆"}斩首领</span>
          <span class="qt-star-item ${s2 ? "done" : ""}">${s2 ? "★" : "☆"}破势/12连</span>
          <span class="qt-star-item ${s3 ? "done" : ""}">${s3 ? "★" : "☆"}血≥35%</span>
        </button>
      `);
    } else if (!isPrologueFocus) {
      const topB = getBountySpec(game, SECT_BOUNTY_CHAINS[0]);
      rows.push(`
        <button type="button" class="qt-goal-row" data-open-goals="bounties">
          <div class="qt-row-top">
            <span class="qt-tag-sub">⚔ ${topB.title}</span>
            <span class="qt-action-pill">${Math.min(topB.cur, topB.need)}/${topB.need}</span>
          </div>
          <div class="qt-desc-line">${topB.desc}</div>
        </button>
      `);
    }

    const optCompStories = !isPrologueFocus ? getAvailableCompanionStories(game, { chapterOnly: true }) : [];
    if (optCompStories.length > 0) {
      const lead = optCompStories[0];
      const leadNpc = NPC_META[lead.npc];
      const locLbl = getStoryLocationLabel(lead.location);
      rows.push(`
        <button type="button" class="qt-goal-row qt-companion-row" data-open-companion-story="${escapeHtml(lead.id)}" data-tip="${escTip(`第${lead.chapter}卷 · 故人线（可选）`, `${leadNpc.name}《${lead.name}》 · ${locLbl}（可选支线，不阻塞主线；点击打开故人卷轴）`)}">
          <div class="qt-row-top">
            <span class="qt-tag-companion">♥ 故人线（可选）· 第${lead.chapter}卷</span>
            <span class="qt-action-pill">${optCompStories.length > 1 ? `共${optCompStories.length}段 ▸` : "赴约 ▸"}</span>
          </div>
          <div class="qt-desc-line">${escapeHtml(leadNpc.name)} · 《${escapeHtml(lead.name)}》 · 📍${escapeHtml(locLbl)}</div>
        </button>
      `);
    }

    const nextHtml = rows.join("");
    if (bodyEl.dataset.qtSig === nextHtml) return;
    const hadFocus = Boolean(document.activeElement && bodyEl.contains(document.activeElement));
    const prevSel = hadFocus ? (() => {
      const ae = document.activeElement;
      for (const attr of ["data-claim-step", "data-route-goal", "data-claim-bounty", "data-open-goals", "data-open-companion-story"]) {
        const val = ae.getAttribute(attr);
        if (val !== null) return `[${attr}="${val.replace(/"/g, '\\"')}"]`;
      }
      return "";
    })() : "";
    bodyEl.innerHTML = nextHtml;
    bodyEl.dataset.qtSig = nextHtml;
    if (hadFocus) {
      const refocus = (prevSel && bodyEl.querySelector(prevSel)) || bodyEl.querySelector("button:not([disabled])");
      if (refocus && isElementFocusable(refocus)) {
        try { refocus.focus({ preventScroll: true }); } catch (e) {}
      } else {
        const bd = document.getElementById("modal-backdrop");
        if (!(bd && bd.classList.contains("open")) && !drawerOpen) restoreTriggerFocus(null);
      }
    }
  }

  const ONBOARDING_STEPS = [
    { idx: 0, title: "执剑破敌", hint: "WASD 走位 · <b>左键连挥 3 剑</b>驱使本命飞剑协同斩妖" },
    { idx: 1, title: "识破爆剑", hint: "点 <b>右键爆剑</b> 引爆剑印，或见敌金芒蓄力按 <b>空格一闪</b> 识破剑反" },
    { idx: 2, title: "洞府整备", hint: "择定玉莲仙缘后，踏入 <b>听雨洞府</b> 熟悉丹鼎/剑炉，或进青岚荒野追击狼王" },
    { idx: 3, title: "满修渡劫", hint: "斩妖攒满凡人修为后，按 <b>B 键</b> 开启首次紫霄雷劫晋升炼气期" }
  ];

  function getVol1JourneyPhase(g = game, ar = arena) {
    if (!g) return "welcome";
    if (rankOf(g.realm) >= 1) return "qi_ascended";
    if (ar && ar.tribulation) return "tribulation_live";
    if (ar && ar.sanctumMode) return "sanctum_prep";
    if (isStageBossDefeated(g, 0)) {
      const r = REALMS[g.realm];
      return (r && r.xpCap > 0 && (g.xp || 0) >= r.xpCap) ? "ready_tribulation" : "wilderness_explore";
    }
    if (!g.openingChoice) {
      const hasPedestal = ar && Array.isArray(ar.props) && ar.props.some(pr => pr.kind === "pedestal");
      return hasPedestal ? "pedestal_choice" : "prologue_rescue";
    }
    const wolfKingActive = ar && Array.isArray(ar.enemies) && ar.enemies.some(e => e.isBoss && e.id === "wolf" && e.hp > 0);
    if (wolfKingActive || (ar && ar.roomBranch === "boss" && ar.stageIdx === 0)) return "wolf_king_boss";
    return "wilderness_explore";
  }

  function renderOnboardingCoach() {
    const bar = document.getElementById("onboarding-coach-bar");
    if (!bar) return;
    const hideOnboardingBar = () => {
      const hadFocus = Boolean(document.activeElement && bar.contains(document.activeElement));
      bar.classList.remove("show");
      syncUnlockCardStacking();
      if (hadFocus && !cutscene.active && !drawerOpen) {
        const bd = document.getElementById("modal-backdrop");
        if (!(bd && bd.classList.contains("open"))) {
          restoreTriggerFocus(null);
        }
      }
    };
    const onWelcome = document.getElementById("welcome-screen") && document.getElementById("welcome-screen").style.display !== "none";
    if (!game || onWelcome || cutscene.active || game.tutorialDismissed || rankOf(game.realm) >= 1) {
      hideOnboardingBar();
      return;
    }
    // F28 D01 Sanctum Shortest Prep Path: reuse #onboarding-coach-bar (0 extra HUD buttons!)
    if (arena.sanctumMode) {
      const prepDone = Boolean(game.vol1Prep && game.vol1Prep.upgradeDone);
      const sanctumHint = `✓ 仙葫已满酿 → ${prepDone ? "✓ 已完成1项整备强化" : "○ 选1项直觉强化（淬火+1或升阶洞府，绝不强制炼丹/灵宠）"} → ○ 踏阵门出征青岚荒野`;
      const sig = `sanctum_prep|${prepDone ? 1 : 0}`;
      if (bar.dataset.obSig !== sig) {
        const hadFocus = Boolean(document.activeElement && bar.contains(document.activeElement));
        bar.dataset.obSig = sig;
        bar.innerHTML = `
          <span class="ob-step-pill">洞府最短整备</span>
          <span style="line-height:1.35;">${sanctumHint}</span>
          <span id="btn-skip-onboarding" class="ob-skip-link" role="button" tabindex="0" data-action="skip-onboarding">跳过</span>
        `;
        if (hadFocus) {
          const skipEl = document.getElementById("btn-skip-onboarding");
          if (skipEl && isElementFocusable(skipEl)) {
            try { skipEl.focus({ preventScroll: true }); } catch (e) {}
          }
        }
      }
      bar.classList.add("show");
      syncUnlockCardStacking();
      return;
    }
    if ((game.tutorialStep || 0) >= 4) {
      hideOnboardingBar();
      return;
    }
    const step = ONBOARDING_STEPS[game.tutorialStep || 0];
    if (!step) { hideOnboardingBar(); return; }
    const pips = ONBOARDING_STEPS.map(s => `<span class="ob-pip ${s.idx < step.idx ? "done" : s.idx === step.idx ? "cur" : ""}"></span>`).join("");
    let dynamicHint = step.hint;
    if (step.idx === 3 && REALMS[game.realm] && game.xp >= REALMS[game.realm].xpCap) {
      const obGate = getBreakthroughBossGate(game);
      dynamicHint = (obGate && obGate.locked)
        ? `✨ 修为已圆满！请先击败【${escapeHtml(obGate.bossName)}】，随后按 <b>B 键</b> 引动紫霄初劫！`
        : "✨ 修为已圆满！立即按 <b>B 键</b> 引动紫霄初劫，晋升炼气期！";
    }
    const sig = `${step.idx}|${dynamicHint}`;
    if (bar.dataset.obSig !== sig) {
      const hadFocus = Boolean(document.activeElement && bar.contains(document.activeElement));
      bar.dataset.obSig = sig;
      bar.innerHTML = `
        <span class="ob-step-pill">入道 ${step.idx + 1}/4 · ${step.title}</span>
        <span class="ob-pips">${pips}</span>
        <span style="line-height:1.35;">${dynamicHint}</span>
        <span id="btn-skip-onboarding" class="ob-skip-link" role="button" tabindex="0" data-action="skip-onboarding">跳过</span>
      `;
      if (hadFocus) {
        const skipEl = document.getElementById("btn-skip-onboarding");
        if (skipEl && isElementFocusable(skipEl)) {
          try { skipEl.focus({ preventScroll: true }); } catch (e) {}
        }
      }
    }
    bar.classList.add("show");
    syncUnlockCardStacking();
  }

  function advanceOnboardingStep(completedIdx) {
    if (!game || game.tutorialDismissed) return;
    const cur = game.tutorialStep || 0;
    if (cur !== completedIdx) return;
    game.tutorialStep = Math.min(4, cur + 1);
    Sound.qiOrb(4 + cur);
    if (game.tutorialStep >= 4) {
      showToast("🎉 入道教学圆满！已掌握挥剑、爆印识破、洞府整备与渡劫，正式踏上六卷仙途！", { tier: 2, category: "other" });
    } else {
      const nextStep = ONBOARDING_STEPS[game.tutorialStep];
      if (nextStep) showToast(`✦ 入道进阶 (${game.tutorialStep + 1}/4 · ${nextStep.title})`, { tier: 3, key: `onboard_step_${game.tutorialStep}`, throttleMs: 2500 });
    }
    renderOnboardingCoach();
    saveGame();
  }

  function getActiveChapterInfo(g) {
    if (!g) return { vol: "第一卷", step: "拔剑救沈清禾", tab: "cultivate" };
    for (const ch of CHAPTERS) {
      for (const s of ch.steps) {
        if (!s.check(g)) return { vol: `${ch.vol} · ${ch.title.split(" · ")[0]}`, step: s.text, tab: s.tab };
      }
    }
    return { vol: "仙途圆满", step: "仙途圆满 → 劫火周目 / 锁妖塔纪录", tab: "explore" };
  }
