  // ==================== M1 INDUSTRIAL-GRADE SAVE, VALIDATION & MULTI-TAB CONFLICT ENGINE ====================
  const TAB_ID = "tab_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  let loadedSaveRev = 0;
  let loadedSaveTabId = null;
  let loadedSaveLineage = null;
  let loadedSaveUpdatedAt = 0;
  let lastSavedPayloadChecksum = null;
  let storageReadError = null;
  let storageWriteError = null;
  let saveConflictState = null;
  let saveReadOnlyMode = false;
  let saveAlertDismissed = false;

  function generateSaveLineageId() {
    return "lin_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function recordLoadedSaveMeta(res) {
    if (!res || !res.ok) {
      clearLoadedSaveMeta();
      return;
    }
    loadedSaveRev = Math.max(0, Math.floor(num(res.rev, 0)));
    loadedSaveTabId = typeof res.tabId === "string" && res.tabId ? res.tabId : null;
    loadedSaveLineage = typeof res.lineageId === "string" && res.lineageId ? res.lineageId : null;
    loadedSaveUpdatedAt = Math.max(0, Math.floor(num(res.updatedAt, 0)));
  }

  function clearLoadedSaveMeta() {
    loadedSaveRev = 0;
    loadedSaveTabId = null;
    loadedSaveLineage = null;
    loadedSaveUpdatedAt = 0;
  }

  function isForeignSaveConflict(curRes) {
    if (!curRes || !curRes.ok) return false;
    if (curRes.tabId && curRes.tabId === TAB_ID) return false;
    if (curRes.rev > loadedSaveRev) return true;
    if (curRes.lineageId && loadedSaveLineage && curRes.lineageId !== loadedSaveLineage) return true;
    if (curRes.tabId && curRes.tabId !== TAB_ID) {
      const matchesLoadedSnapshot = (
        curRes.rev === loadedSaveRev &&
        curRes.tabId === loadedSaveTabId &&
        (curRes.lineageId || null) === (loadedSaveLineage || null) &&
        (!curRes.updatedAt || !loadedSaveUpdatedAt || curRes.updatedAt === loadedSaveUpdatedAt)
      );
      if (!matchesLoadedSnapshot) return true;
    }
    return false;
  }

  function removePrimarySaveVerified() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      const msg = (e && e.name === "SecurityError")
        ? "存储只读或被安全策略阻止 (SecurityError)"
        : (safeText(e && e.message, safeDiag(e)) || safeDiag(e));
      return { ok: false, message: msg };
    }
    try {
      const stillThere = localStorage.getItem(STORAGE_KEY);
      if (stillThere !== null && stillThere !== "") {
        return { ok: false, message: "本地存档未能从存储中移除" };
      }
    } catch (e) {
      return { ok: false, message: safeText(e && e.message, safeDiag(e)) || safeDiag(e) };
    }
    return { ok: true, message: "" };
  }

  function focusSaveAlertOrFallback(preferredAction = null) {
    const bd = document.getElementById("modal-backdrop");
    if (bd && bd.classList.contains("open")) {
      if (document.activeElement === document.body) {
        focusDialogSafely(document.getElementById("modal-content") || bd);
      }
      return;
    }
    const alertEl = document.getElementById("hud-save-alert");
    if (alertEl && alertEl.style.display !== "none") {
      const pref = preferredAction ? alertEl.querySelector(`[data-action="${preferredAction}"]`) : null;
      if (pref && isElementFocusable(pref)) {
        try { pref.focus({ preventScroll: true }); } catch (e) {}
        return;
      }
      focusDialogSafely(alertEl);
      if (document.activeElement && document.activeElement !== document.body) return;
    }
    if (cutscene.active) focusDialogSafely(document.getElementById("story-dialogue-bar"));
    else if (drawerOpen) focusDialogSafely(document.getElementById("jade-panel"));
    else restoreTriggerFocus(null);
  }
  let lastModalTriggerEl = null;
  let lastDrawerTriggerEl = null;

  // G6: Sandbox Isolation Runtime State (NEVER persisted to STORAGE_KEY / META_KEY)
  let sandboxMode = false;
  let preSandboxSnapshot = null;
  let pendingSandboxEntry = null;

  function resetRuntimeCombatOverrides() {
    const c2 = ensureCoop2PState();
    c2.active = false;
    c2.partnerId = "shen";
    c2.downed = false;
    c2.hp = c2.maxHp || 420;
    c2.shieldHp = 0;
    c2.slashCd = 0;
    c2.skillCd = 0;
    c2.tetherTickCd = 0;
    c2.tetherOverchargeT = 0;
    c2.rescueCd = 0;
    c2.afterimages = [];
    arena.playableCharId = "player";
    arena.weaponForm = (game && game.weaponForm) || "sword";
    arena.weaponPosture = "qinglian";
    arena.swordIntent = 0;
    arena.astralEnergy = 0;
    arena.bondSynergy = 0;
    arena.styleScore = 0;
    arena.comboCount = 0;
    purgeTransientCombatEntities({ clearPlayerBuffs: true, clearOverdriveCds: true });
    if (typeof syncTagTeamHud === "function") syncTagTeamHud();
  }

  function openSandboxConfirmModal(source = "pavilion", preset = null, triggerEl = null) {
    if (!game && !preset) return;
    if (!guardNotInTribulation("演武沙盒模式")) return;
    pendingSandboxEntry = { source, preset };
    const presetLabels = {
      judge_showcase: "诛仙双羁绊卷（金丹·11剑三轮）",
      golden: "巨阙斩妖王卷（筑基·巨阙破阵）",
      tribulation: "九霄叩天门卷（化神·15剑渡劫）"
    };
    const presetSub = (preset && presetLabels[preset]) ? ` · 载入【${presetLabels[preset]}】` : "";
    openModal(`
      <div class="drawer-mural-banner" style="height:88px;">
        <img src="${ART.arena_cloud_sea_sky}" alt="演武沙盒模式" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">隔离演示沙盒</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:3px;">开启【演武沙盒模式】${escapeHtml(presetSub)}</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">取消 ✕</button>
        </div>
      </div>
      <div class="jade-card" style="gap:6px;border-color:rgba(255,214,112,0.55);">
        <div style="font-size:12px;color:#fff3cf;font-weight:700;">🧪 进入演武沙盒模式须知：</div>
        <div style="font-size:11.5px;color:#d6eee8;line-height:1.55;">
          1. 立即进入隔离沙盒，全神通、太虚秘匣与十四大终局玩法全面解封供自由演武；<br/>
          2. 沙盒期间<b>绝不写入正式存档</b>（<code>chenyuan_wendao_v11_save</code>）与<b>元存档</b>（<code>chenyuan_wendao_v11_meta</code>），<b>不解锁正式成就、不记录历世道果殿堂与轮回飞升</b>；<br/>
          3. 可随时点击顶部常驻标识中的【退出沙盒】按钮，无损恢复进入前的正式进度（刷新页面也会自动回到正式存档）。
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button type="button" class="btn-ghost" data-modal-close="1">取消返回</button>
        <button type="button" id="btn-confirm-enter-sandbox" class="btn-gold" data-action="confirm-enter-sandbox">确认进入演武沙盒</button>
      </div>
    `, true, triggerEl ? { triggerEl } : {});
  }

  function enterSandboxMode(opts = {}) {
    if (!game && !(opts && opts.preset)) return false;
    if (!guardNotInTribulation("演武沙盒模式")) return false;
    if (!sandboxMode) {
      flushAndEndMeditation();
      if (isPracticeModeActive() || practiceFormalSnapshot) {
        restoreCustomSeedTempCurio();
        arena.bossRush = null;
        arena.celestialSpire = null;
        arena.customSeedRun = null;
        endPracticeModeIsolation();
      }
      if (game && !saveReadOnlyMode && !saveConflictState && !storageReadError) {
        saveGame();
      }
      const sanitizedFormalGame = game ? getSanitizedGameForPersistence(game) : null;
      preSandboxSnapshot = {
        game: sanitizedFormalGame ? JSON.parse(JSON.stringify(sanitizedFormalGame)) : null,
        meta: JSON.parse(JSON.stringify(ensureMetaState())),
        arenaSnap: {
          stageIdx: arena.stageIdx,
          stanceIdx: arena.stanceIdx,
          towerMode: !!arena.towerMode,
          sanctumMode: !!arena.sanctumMode
        },
        loadedSaveRev,
        loadedSaveTabId,
        loadedSaveLineage,
        loadedSaveUpdatedAt,
        lastSavedPayloadChecksum
      };
      activeCustomSeedTempCurio = null;
      game = sanitizedFormalGame ? JSON.parse(JSON.stringify(sanitizedFormalGame)) : createFreshGame("顾长青", "sword_bone");
      sandboxMode = true;
      game.unlockAllArcana = true;
      game.pendingRewards = [];
      activePendingRewardId = null;
      pendingUnlockCardQueue.length = 0;
      activeUnlockCardId = null;
      pendingLifespanExhaustedPrompt = false;
      activeLifespanModalOpen = false;
      renderActiveUnlockCard();
      syncPendingRewardsBadge();
      syncSandboxSlotPrototypeButton();
    }
    resetEncounterTelemetry();
    closeModal();
    if (opts && opts.preset) {
      applyStagePreset(opts.preset, { insideSandbox: true });
    } else {
      Sound.clang(1.25, 0.10);
      updateHud(true);
      renderHudSaveAlert();
      if (drawerOpen) renderDrawerContent();
      showToast("🧪 已进入【演武沙盒模式】：全神通开放，不写入正式存档与元存档！");
      if (opts && opts.source === "roadmap") {
        openAscensionRoadmapModal();
      }
    }
    return true;
  }

  function exitSandboxMode() {
    if (!sandboxMode) return false;
    sandboxMode = false;
    setSandboxSlotPrototype(false);
    arena.stageEpoch += 1;
    arena.waveTransitioning = false;
    clearTransientChoiceQueues();
    resetStageTransitionState();
    resetPhotoModeOverlay({ resetCamera: true, skipCalmReeval: true });
    arena.defeatPending = null;
    releasePauseToken(defeatPauseToken); defeatPauseToken = null;
    closeModal();
    closeDrawer();
    arena.bossRush = null;
    arena.celestialSpire = null;
    arena.sectDefense = null;
    arena.cloudFlight = null;
    restoreCustomSeedTempCurio();
    arena.customSeedRun = null;
    clearCinematicClashOverlays();
    if (arena.coop2P) arena.coop2P.active = false;
    syncV23EpochDock();
    arena.tribulation = null;
    practiceFormalSnapshot = null;

    const prevSnap = preSandboxSnapshot;
    if (prevSnap && prevSnap.meta) {
      Object.keys(metaState).forEach(k => { if (!(k in prevSnap.meta)) delete metaState[k]; });
      safeAssignPlain(metaState, prevSnap.meta);
      ensureMetaState();
    }
    inspectMetaState({ applyToMemory: true });

    let restoredStageIdx = 0;
    let restoredStanceIdx = 0;
    let restoredTower = false;
    let restoredSanctum = false;
    let postExitConflictRes = null;

    const res = inspectSavedBundle();
    const snapRev = prevSnap ? Math.max(0, Math.floor(num(prevSnap.loadedSaveRev, 0))) : 0;
    let livePrimaryRaw = null;
    try { livePrimaryRaw = localStorage.getItem(STORAGE_KEY); } catch (e) {}

    const restoreFromPreSandbox = () => {
      if (prevSnap && prevSnap.game) {
        game = normalizeLoadedGame(prevSnap.game);
        loadedSaveRev = prevSnap.loadedSaveRev;
        loadedSaveTabId = prevSnap.loadedSaveTabId || null;
        loadedSaveLineage = prevSnap.loadedSaveLineage || null;
        loadedSaveUpdatedAt = prevSnap.loadedSaveUpdatedAt || 0;
        const snap = prevSnap.arenaSnap || {};
        restoredStageIdx = Math.max(0, Math.min(STAGES.length - 1, Math.floor(num(snap.stageIdx, 0))));
        restoredStanceIdx = ((Math.floor(num(snap.stanceIdx, 0)) % SWORD_STANCES.length) + SWORD_STANCES.length) % SWORD_STANCES.length;
        restoredTower = !!snap.towerMode;
        restoredSanctum = !!snap.sanctumMode;
      } else {
        game = null;
      }
    };

    if (storageReadError) {
      // Disk save was corrupted while in Sandbox: preserve storageReadError & restore memory from preSandboxSnapshot without overwriting disk!
      restoreFromPreSandbox();
    } else if (snapRev > 0 && (livePrimaryRaw === null || livePrimaryRaw === "")) {
      // R2A-1: Disk save was deleted by another tab while in Sandbox! Surface deletion conflict instead of silently resurrecting!
      restoreFromPreSandbox();
      postExitConflictRes = { ok: true, rev: 0, tabId: "另一标签页", updatedAt: Date.now(), deleted: true, bundle: { game: null } };
    } else if (res.ok && res.bundle && res.bundle.game && !saveReadOnlyMode && !saveConflictState && !storageWriteError) {
      const snapLineage = prevSnap ? (prevSnap.loadedSaveLineage || null) : null;
      const snapTabId = prevSnap ? (prevSnap.loadedSaveTabId || null) : null;
      const snapPayloadChecksum = prevSnap ? (prevSnap.lastSavedPayloadChecksum || null) : null;
      let diskNormalizedChecksum = null;
      if (snapPayloadChecksum && res.bundle && res.bundle.game) {
        try {
          const diskGameSnap = safeAssignPlain({}, normalizeLoadedGame(res.bundle.game));
          if (diskGameSnap.expeditions && typeof diskGameSnap.expeditions === "object" && !Array.isArray(diskGameSnap.expeditions)) {
            const exSnap = safeAssignPlain({}, diskGameSnap.expeditions);
            delete exSnap.tickTimer;
            diskGameSnap.expeditions = exSnap;
          }
          if (diskGameSnap.pity && typeof diskGameSnap.pity === "object" && !Array.isArray(diskGameSnap.pity)) {
            const pitySnap = safeAssignPlain({}, diskGameSnap.pity);
            delete pitySnap.critAcc;
            delete pitySnap.vampHits;
            delete pitySnap.thunderHits;
            diskGameSnap.pity = pitySnap;
          }
          diskNormalizedChecksum = computeSaveChecksum(buildCanonicalSavePayload({
            game: diskGameSnap,
            stageIdx: Math.max(0, Math.min(STAGES.length - 1, Math.floor(num(res.bundle.stageIdx, 0)))),
            stanceIdx: ((Math.floor(num(res.bundle.stanceIdx, 0)) % SWORD_STANCES.length) + SWORD_STANCES.length) % SWORD_STANCES.length,
            towerMode: !!res.bundle.towerMode,
            sanctumMode: !!res.bundle.sanctumMode
          }));
        } catch (e) {}
      }
      // R3A-4: Detect legacy/no-tabId foreign overwrites whenever snapTabId was set, rev differs, or canonical payload checksum changed!
      const foreignWhileInSandbox = snapRev > 0 && (
        (res.tabId && res.tabId !== TAB_ID && (res.rev !== snapRev || (snapLineage && res.lineageId && res.lineageId !== snapLineage) || (snapTabId && res.tabId !== snapTabId))) ||
        (!res.tabId && (Boolean(snapTabId) || res.rev !== snapRev || (snapPayloadChecksum && diskNormalizedChecksum && diskNormalizedChecksum !== snapPayloadChecksum)))
      );
      if (foreignWhileInSandbox) {
        restoreFromPreSandbox();
        postExitConflictRes = res;
      } else {
        const s = res.bundle;
        game = normalizeLoadedGame(s.game);
        recordLoadedSaveMeta(res);
        restoredStageIdx = Math.max(0, Math.min(STAGES.length - 1, Math.floor(num(s.stageIdx, 0))));
        restoredStanceIdx = ((Math.floor(num(s.stanceIdx, 0)) % SWORD_STANCES.length) + SWORD_STANCES.length) % SWORD_STANCES.length;
        restoredTower = !!s.towerMode;
        restoredSanctum = !!s.sanctumMode;
      }
    } else {
      restoreFromPreSandbox();
    }
    if (game) game.unlockAllArcana = false;
    preSandboxSnapshot = null;

    const sbBadge = document.getElementById("hud-sandbox-badge");
    if (sbBadge) sbBadge.style.display = "none";

    // R2B-4: Reset all runtime combat overrides (2P Co-Op, switched 1P char, posture, swordIntent, astralForm, mount, etc.)
    resetRuntimeCombatOverrides();

    if (game) {
      arena.stanceIdx = restoredStanceIdx;
      arena.stageIdx = restoredStageIdx;
      if (restoredSanctum) enterSanctumHub({ skipSave: true });
      else initArenaStage(restoredStageIdx, restoredTower, { skipSave: true });
      resetRuntimeCombatOverrides();
      lastSavedPayloadChecksum = computeCurrentPayloadChecksum();
      updateHud(true);
      renderHudSaveAlert();
      if (postExitConflictRes) {
        triggerSaveConflict(postExitConflictRes, true);
      }
    } else {
      arena.sanctumMode = false;
      document.getElementById("welcome-screen").style.display = "flex";
      renderWelcomeScreen();
      closePavilionPopover();
      hideDojoControlBar();
      syncDojoTrainingHudVisibility();
      restoreTriggerFocus(null);
    }
    showToast("已退出【演武沙盒模式】，已恢复正式存档进度！");
    return true;
  }



  function computeCurrentPayloadChecksum() {
    if (!game) return null;
    const gameSnap = safeAssignPlain({}, getSanitizedGameForPersistence(game));
    if (gameSnap.expeditions && typeof gameSnap.expeditions === "object" && !Array.isArray(gameSnap.expeditions)) {
      const exSnap = safeAssignPlain({}, gameSnap.expeditions);
      delete exSnap.tickTimer;
      gameSnap.expeditions = exSnap;
    }
    if (gameSnap.pity && typeof gameSnap.pity === "object" && !Array.isArray(gameSnap.pity)) {
      const pitySnap = safeAssignPlain({}, gameSnap.pity);
      delete pitySnap.critAcc;
      delete pitySnap.vampHits;
      delete pitySnap.thunderHits;
      gameSnap.pity = pitySnap;
    }
    return computeSaveChecksum(buildCanonicalSavePayload({
      game: gameSnap,
      stageIdx: arena.stageIdx,
      stanceIdx: arena.stanceIdx,
      towerMode: !!arena.towerMode,
      sanctumMode: !!arena.sanctumMode
    }));
  }


  function inspectSavedBundle() {
    let primaryRaw = null;
    try {
      primaryRaw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      storageReadError = {
        key: STORAGE_KEY,
        reason: `无法访问本地存储（${safeText(e && e.message, safeDiag(e)) || safeDiag(e)}）`,
        raw: null,
        at: Date.now()
      };
      return { ok: false, empty: false, error: storageReadError };
    }

    if (primaryRaw !== null && primaryRaw !== "") {
      const res = parseAndValidateSaveRaw(primaryRaw, STORAGE_KEY);
      if (res.ok) {
        storageReadError = null;
        return res;
      }
      // Preserve corrupted primary save intact! Never delete or silently fall back over it.
      storageReadError = {
        key: STORAGE_KEY,
        reason: res.reason || "存档结构异常",
        raw: primaryRaw,
        rawLength: primaryRaw.length,
        at: Date.now()
      };
      return { ok: false, empty: false, error: storageReadError };
    }

    // Primary slot absent: safely inspect legacy keys (v10/v9)
    for (const legacyKey of ["chenyuan_wendao_v10_save", "chenyuan_wendao_v9_save"]) {
      let raw = null;
      try { raw = localStorage.getItem(legacyKey); } catch (e) { continue; }
      if (raw !== null && raw !== "") {
        const res = parseAndValidateSaveRaw(raw, legacyKey);
        if (res.ok) {
          storageReadError = null;
          return res;
        }
        storageReadError = {
          key: legacyKey,
          reason: `旧版存档 ${legacyKey} 读取失败：${res.reason || "格式损坏"}`,
          raw,
          rawLength: raw.length,
          at: Date.now()
        };
        return { ok: false, empty: false, error: storageReadError };
      }
    }

    storageReadError = null;
    return { ok: false, empty: true, error: null };
  }

  function loadSavedBundle() {
    const res = inspectSavedBundle();
    return res.ok ? res.bundle : null;
  }

  function renderWelcomeSaveStatusBanner() {
    const el = document.getElementById("save-status-banner");
    if (!el) return;
    if (!storageReadError && !metaReadError) {
      const hadFocus = Boolean(document.activeElement && el.contains(document.activeElement));
      el.style.display = "none";
      el.innerHTML = "";
      el.dataset.bannerSig = "";
      if (hadFocus) {
        const bd = document.getElementById("modal-backdrop");
        if (!(bd && bd.classList.contains("open"))) {
          restoreTriggerFocus(null);
        }
      }
      return;
    }
    const sections = [];
    if (storageReadError) {
      sections.push(`
        <div>
          <strong style="color:#ff9e98;">⚠ 旧存档读取失败 · 已为您原样保留原数据</strong>
          <div style="font-size:11px;color:#ffd5d0;margin-top:2px;">原因：${escapeHtml(storageReadError.reason)}（原数据未删除、未覆盖）</div>
          <div class="save-banner-actions" style="margin-top:6px;">
            ${storageReadError.raw ? `<button type="button" class="btn-ghost" style="padding:4px 10px;font-size:11px;" data-action="copy-corrupt-save-raw">复制受损原文备份</button>` : ""}
            <button type="button" class="btn-ghost" style="padding:4px 10px;font-size:11px;border-color:rgba(255,130,118,0.65);color:#ffd0ca;" data-action="prompt-overwrite-corrupt">覆盖并开启新卷</button>
          </div>
        </div>
      `);
    }
    if (metaReadError) {
      sections.push(`
        <div${sections.length ? ' style="border-top:1px solid rgba(255,130,118,0.32);padding-top:7px;"' : ""}>
          <strong style="color:#ff9e98;">⚠ 元存档损坏 · 累世功德与纪录读取失败，已原样保留原数据</strong>
          <div style="font-size:11px;color:#ffd5d0;margin-top:2px;">原因：${escapeHtml(metaReadError.reason)}（原数据未删除、未覆盖，确认重置前不会覆写）</div>
          <div class="save-banner-actions" style="margin-top:6px;">
            ${metaReadError.raw ? `<button type="button" class="btn-ghost" style="padding:4px 10px;font-size:11px;" data-action="copy-corrupt-meta-raw">复制原文</button>` : ""}
            <button type="button" class="btn-ghost" style="padding:4px 10px;font-size:11px;border-color:rgba(255,130,118,0.65);color:#ffd0ca;" data-action="prompt-reset-corrupt-meta">确认重置</button>
          </div>
        </div>
      `);
    }
    const nextHtml = sections.join("");
    if (el.style.display === "flex" && el.dataset.bannerSig === nextHtml) return;
    const hadFocus = Boolean(document.activeElement && el.contains(document.activeElement));
    const prevAct = hadFocus ? (document.activeElement.getAttribute("data-action") || "") : "";
    el.style.display = "flex";
    el.innerHTML = nextHtml;
    el.dataset.bannerSig = nextHtml;
    if (hadFocus) {
      const bd = document.getElementById("modal-backdrop");
      if (!(bd && bd.classList.contains("open"))) {
        const target = (prevAct && el.querySelector(`[data-action="${prevAct}"]`)) || el.querySelector("button:not([disabled])");
        if (target && isElementFocusable(target)) {
          try { target.focus({ preventScroll: true }); } catch (e) {}
        } else {
          restoreTriggerFocus(null);
        }
      }
    }
  }

  function renderHudSaveAlert() {
    const el = document.getElementById("hud-save-alert");
    if (!el) return;
    const hideAlert = (clearHtml) => {
      const hadFocus = Boolean(document.activeElement && el.contains(document.activeElement));
      el.style.display = "none";
      if (clearHtml) el.innerHTML = "";
      el.dataset.alertSig = "";
      el.classList.remove("readonly-mode");
      if (hadFocus) {
        const bd = document.getElementById("modal-backdrop");
        if (!(bd && bd.classList.contains("open"))) {
          if (drawerOpen) {
            focusDialogSafely(document.getElementById("jade-panel"));
          } else {
            restoreTriggerFocus(null);
          }
        }
      }
    };
    const applyAlert = (nextHtml, isRo = false) => {
      if (el.style.display === "flex" && el.classList.contains("readonly-mode") === isRo && el.dataset.alertSig === nextHtml) {
        return;
      }
      const hadFocus = Boolean(document.activeElement && el.contains(document.activeElement));
      const prevAct = hadFocus ? (document.activeElement.getAttribute("data-action") || "") : "";
      el.classList.toggle("readonly-mode", isRo);
      el.style.display = "flex";
      el.innerHTML = nextHtml;
      el.dataset.alertSig = nextHtml;
      if (hadFocus) {
        const bd = document.getElementById("modal-backdrop");
        if (!(bd && bd.classList.contains("open"))) {
          const target = (prevAct && el.querySelector(`[data-action="${prevAct}"]`)) || el.querySelector("button:not([disabled])");
          if (target && isElementFocusable(target)) {
            try { target.focus({ preventScroll: true }); } catch (e) {}
          } else if (drawerOpen) {
            focusDialogSafely(document.getElementById("jade-panel"));
          } else {
            restoreTriggerFocus(null);
          }
        }
      }
    };
    const onWelcome = document.getElementById("welcome-screen") && document.getElementById("welcome-screen").style.display !== "none";
    if (onWelcome || (!storageWriteError && !saveReadOnlyMode && !saveConflictState && !storageReadError && !metaReadError && !metaWriteError)) {
      hideAlert(true);
      return;
    }
    if (saveAlertDismissed && !saveConflictState && !storageReadError && !metaReadError && !saveReadOnlyMode) {
      hideAlert(false);
      return;
    }
    if (saveConflictState) {
      applyAlert(`
        <span>⚠ <b>检测到另一标签页更新了存档</b>（${escapeHtml(saveConflictState.externalName)} · ${escapeHtml(saveConflictState.externalRealm)}，v${saveConflictState.externalRev}），已暂停自动覆盖。</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="btn-jade" style="padding:3px 9px;font-size:11px;" data-action="open-save-conflict">处理冲突</button>
        </div>
      `, false);
      return;
    }
    if (storageWriteError && storageReadError) {
      applyAlert(`
        <span>⚠ <b>本地存档写入失败</b>（${escapeHtml(storageWriteError.message)}）且<b>原受损存档仍保留</b>（${escapeHtml(storageReadError.reason)}）· 自动保存已暂停，请先备份或确认覆写。</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          ${storageReadError.raw ? `<button type="button" class="btn-ghost" style="padding:3px 9px;font-size:11px;" data-action="copy-corrupt-save-raw">复制受损原文</button>` : ""}
          <button type="button" class="btn-gold" style="padding:3px 9px;font-size:11px;" data-action="overwrite-with-current-save">以本页覆盖</button>
          <button type="button" class="btn-ghost" style="padding:3px 9px;font-size:11px;" data-action="open-cloud-backup">备份云码</button>
        </div>
      `, false);
      return;
    }
    if (storageWriteError && saveReadOnlyMode) {
      applyAlert(`
        <span>⚠ <b>本地存档写入失败</b>（${escapeHtml(storageWriteError.message)}）· 当前仍处于<b>只读观览态</b>，可载入最新档、重试覆盖或备份云码。</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="btn-jade" style="padding:3px 9px;font-size:11px;" data-action="load-latest-save">载入最新档</button>
          <button type="button" class="btn-gold" style="padding:3px 9px;font-size:11px;" data-action="overwrite-with-current-save">以本页覆盖</button>
          <button type="button" class="btn-ghost" style="padding:3px 9px;font-size:11px;" data-action="open-cloud-backup">备份云码</button>
        </div>
      `, true);
      return;
    }
    if (storageWriteError && metaReadError) {
      applyAlert(`
        <span>⚠ <b>本地存档写入失败</b>（${escapeHtml(storageWriteError.message)}）且<b>元存档损坏</b>（${escapeHtml(metaReadError.reason)}）· 已保留受损元存档，请重试保存、备份云码或处理元存档。</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="btn-gold" style="padding:3px 9px;font-size:11px;" data-action="retry-save-now">重试保存</button>
          <button type="button" class="btn-ghost" style="padding:3px 9px;font-size:11px;" data-action="open-cloud-backup">备份云码</button>
          ${metaReadError.raw ? `<button type="button" class="btn-ghost" style="padding:3px 9px;font-size:11px;" data-action="copy-corrupt-meta-raw">复制原文</button>` : ""}
          <button type="button" class="btn-ghost" style="padding:3px 9px;font-size:11px;border-color:rgba(255,130,118,0.65);color:#ffd0ca;" data-action="prompt-reset-corrupt-meta">确认重置</button>
        </div>
      `, false);
      return;
    }
    if (storageWriteError) {
      applyAlert(`
        <span>⚠ <b>本地存档写入失败</b>（${escapeHtml(storageWriteError.message)}）· 当前进度仅暂存内存，请备份云码。</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="btn-gold" style="padding:3px 9px;font-size:11px;" data-action="retry-save-now">重试保存</button>
          <button type="button" class="btn-ghost" style="padding:3px 9px;font-size:11px;" data-action="open-cloud-backup">备份云码</button>
          <button type="button" class="btn-ghost" style="padding:2px 7px;font-size:11px;" data-action="dismiss-save-alert">✕</button>
        </div>
      `, false);
      return;
    }
    if (storageReadError) {
      applyAlert(`
        <span>⚠ <b>检测到本地存档异常</b>（${escapeHtml(storageReadError.reason)}）· 已暂停自动保存并保留原数据。</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          ${storageReadError.raw ? `<button type="button" class="btn-ghost" style="padding:3px 9px;font-size:11px;" data-action="copy-corrupt-save-raw">复制受损原文</button>` : ""}
          <button type="button" class="btn-gold" style="padding:3px 9px;font-size:11px;" data-action="overwrite-with-current-save">以本页覆盖</button>
        </div>
      `, false);
      return;
    }
    if (saveReadOnlyMode) {
      applyAlert(`
        <span>📖 当前处于<b>只读观览态</b>（避免覆盖另一标签页的较新进度），自动存档已暂停。</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="btn-jade" style="padding:3px 9px;font-size:11px;" data-action="load-latest-save">载入最新档</button>
          <button type="button" class="btn-gold" style="padding:3px 9px;font-size:11px;" data-action="overwrite-with-current-save">以本页覆盖</button>
        </div>
      `, true);
      return;
    }
    if (metaReadError) {
      applyAlert(`
        <span>⚠ <b>元存档损坏</b>（${escapeHtml(metaReadError.reason)}）· 已保留原数据并暂停元存档覆写。</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          ${metaReadError.raw ? `<button type="button" class="btn-ghost" style="padding:3px 9px;font-size:11px;" data-action="copy-corrupt-meta-raw">复制原文</button>` : ""}
          <button type="button" class="btn-gold" style="padding:3px 9px;font-size:11px;" data-action="prompt-reset-corrupt-meta">确认重置</button>
        </div>
      `, false);
      return;
    }
    if (metaWriteError) {
      applyAlert(`
        <span>⚠ <b>元存档写入失败</b>（${escapeHtml(metaWriteError.message)}）· 累世功德暂存于内存，请清理存储空间后重试。</span>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button type="button" class="btn-gold" style="padding:3px 9px;font-size:11px;" data-action="retry-meta-save">重试写入</button>
          <button type="button" class="btn-ghost" style="padding:2px 7px;font-size:11px;" data-action="dismiss-save-alert">✕</button>
        </div>
      `, false);
    }
  }

  function openCorruptedOverwriteConfirmModal() {
    if (!storageReadError) return;
    openModal(`
      <div class="drawer-mural-banner" style="height:82px;">
        <img src="${ART.banner_archive}" alt="存档读取失败" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">存档保护</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:#ffd0ca;margin-top:4px;">旧存档损坏保护 · 请确认操作</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">取消 ✕</button>
        </div>
      </div>
      <div style="font-size:12.5px;color:#ffe6e2;line-height:1.6;padding:4px 2px;">
        检测到本地存档 <code style="color:#ffe28a;">${escapeHtml(storageReadError.key)}</code> 读取失败：<b>${escapeHtml(storageReadError.reason)}</b>。<br/>
        系统已原样保留受损存档数据，<b>不会静默删除或覆盖</b>。您可先复制受损原文留存，或显式确认覆盖并开启新卷。
      </div>
      <div class="defeat-decision-grid">
        ${storageReadError.raw ? `<button type="button" class="defeat-opt-btn retreat" data-action="copy-corrupt-save-raw">
          <div><div style="font-weight:700;color:#80ffea;">📋 复制受损存档原文（保留原档）</div><div style="font-size:11px;color:var(--text-sub);">将原始字符串复制到剪贴板，原本地存档保持不变</div></div>
          <span class="tag-chip done">备份</span>
        </button>` : ""}
        <button type="button" class="defeat-opt-btn" style="border-color:rgba(255,112,102,0.68);" data-action="confirm-overwrite-corrupt-new">
          <div><div style="font-weight:700;color:#ffb4ae;">⚠ 确认覆盖原损坏存档并开启新卷</div><div style="font-size:11px;color:var(--text-sub);">此操作会以新开局替换受损数据，仅在您主动确认后执行</div></div>
          <span class="tag-chip" style="border-color:#ff7870;color:#ffb4ae;">显式覆盖</span>
        </button>
      </div>
    `, true, { kind: "save_corrupt" });
  }

  function openCorruptedMetaResetConfirmModal() {
    if (!metaReadError) return;
    openModal(`
      <div class="drawer-mural-banner" style="height:82px;">
        <img src="${ART.banner_archive}" alt="元存档损坏保护" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">元存档保护</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:#ffd0ca;margin-top:4px;">元存档损坏 · 请确认重置操作</h2>
          </div>
          <button type="button" class="btn-ghost" data-modal-close="1">取消 ✕</button>
        </div>
      </div>
      <div style="font-size:12.5px;color:#ffe6e2;line-height:1.6;padding:4px 2px;">
        检测到元存档 <code style="color:#ffe28a;">${escapeHtml(metaReadError.key)}</code> 读取失败：<b>${escapeHtml(metaReadError.reason)}</b>。<br/>
        系统已原样保留受损元存档数据，在您显式确认重置之前<b>绝不会覆写</b>。建议先复制原文留存。
      </div>
      <div id="corrupt-meta-reset-error-msg" role="alert" aria-live="assertive" style="display:none;margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(92,22,22,0.88);border:1px solid rgba(255,120,112,0.8);color:#ffd5d0;font-size:12px;line-height:1.5;"></div>
      <div class="defeat-decision-grid">
        ${metaReadError.raw ? `<button type="button" class="defeat-opt-btn retreat" data-action="copy-corrupt-meta-raw">
          <div><div style="font-weight:700;color:#80ffea;">📋 复制原文（保留原档）</div><div style="font-size:11px;color:var(--text-sub);">将受损元存档原文复制到剪贴板，原本地数据保持不变</div></div>
          <span class="tag-chip done">备份</span>
        </button>` : ""}
        <button type="button" class="defeat-opt-btn" style="border-color:rgba(255,112,102,0.68);" data-action="confirm-reset-corrupt-meta">
          <div><div style="font-weight:700;color:#ffb4ae;">⚠ 确认重置元存档</div><div style="font-size:11px;color:var(--text-sub);">清空受损元存档并初始化新的累世功德记录</div></div>
          <span class="tag-chip" style="border-color:#ff7870;color:#ffb4ae;">确认重置</span>
        </button>
      </div>
    `, true, { kind: "save_corrupt" });
  }

  function openSaveConflictModal(info = saveConflictState) {
    if (!info) return;
    const tsStr = info.externalUpdatedAt ? new Date(info.externalUpdatedAt).toLocaleTimeString("zh-CN", { hour12: false }) : "刚刚";
    openModal(`
      <div class="drawer-mural-banner" style="height:82px;">
        <img src="${ART.banner_archive}" alt="多标签页存档冲突" />
        <div class="drawer-mural-overlay">
          <div>
            <span class="cinnabar-seal">多标签页竞争保护</span>
            <h2 style="font-family:var(--font-serif);font-size:20px;color:var(--gold-bright);margin-top:4px;">检测到另一标签页更新了存档</h2>
          </div>
          <span class="tag-chip mythic">版本 v${info.externalRev} · ${tsStr}</span>
        </div>
      </div>
      <div style="font-size:12.5px;color:var(--text-main);line-height:1.6;">
        另一标签页于 <b>${tsStr}</b> 保存了更新进度（道号 <b>${escapeHtml(info.externalName)}</b> · <b>${escapeHtml(info.externalRealm)}</b>，灵石 ${escapeHtml(safeText(info.externalStones, "0"))}，本页原为 v${loadedSaveRev}）。<br/>
        为防止误覆盖较新进度，本页已暂停自动写入，请选择处理方式：
      </div>
      <div id="save-conflict-error-msg" role="alert" aria-live="assertive" style="display:none;margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(92,22,22,0.88);border:1px solid rgba(255,120,112,0.8);color:#ffd5d0;font-size:12px;line-height:1.5;"></div>
      <div class="defeat-decision-grid">
        <button type="button" class="defeat-opt-btn retreat" data-action="load-latest-save">
          <div><div style="font-weight:700;color:#80ffea;">↻ 载入最新标签页进度（推荐）</div><div style="font-size:11px;color:var(--text-sub);">同步为 v${info.externalRev} 最新存档并恢复自动保存</div></div>
          <span class="tag-chip done">同步最新</span>
        </button>
        <button type="button" class="defeat-opt-btn" data-action="stay-readonly-save">
          <div><div style="font-weight:700;color:#ffe28a;">📖 保留本页画面（进入只读态，不写入存档）</div><div style="font-size:11px;color:var(--text-sub);">继续观览本页且绝不覆盖另一标签页的存档</div></div>
          <span class="tag-chip">安全只读</span>
        </button>
        <button type="button" class="defeat-opt-btn" style="border-color:rgba(255,118,110,0.6);" data-action="overwrite-with-current-save">
          <div><div style="font-weight:700;color:#ffb4ae;">⚡ 以本页当前状态强制覆盖存档</div><div style="font-size:11px;color:var(--text-sub);">将本页作为最新进度写入（版本号升至 v${Math.max(loadedSaveRev, info.externalRev) + 1}）</div></div>
          <span class="tag-chip" style="border-color:#ff7870;color:#ffb4ae;">显式覆盖</span>
        </button>
      </div>
    `, false, { kind: "save_conflict" });
  }

  function buildConflictInfoFromResult(res) {
    const g = res && res.bundle ? res.bundle.game : null;
    return {
      externalRev: Math.max(0, Math.floor(num(res && res.rev, 0))),
      externalTabId: safeText(res && res.tabId, "未知标签页") || "未知标签页",
      externalUpdatedAt: Math.max(0, Math.floor(num(res && res.updatedAt, 0))),
      externalName: safeText(g && g.name, res && res.deleted ? "已清空/重开" : "顾长青") || "顾长青",
      externalRealm: (res && res.deleted)
        ? "无本地存档"
        : ((g && hasOwn(REALMS, g.realm) && REALMS[g.realm].name) || safeText(g && g.realm, "练气期") || "练气期"),
      externalStones: Math.max(0, Math.floor(num(g && g.stones, 0))),
      deleted: Boolean(res && res.deleted)
    };
  }

  function triggerSaveConflict(res, openNow = true) {
    saveConflictState = buildConflictInfoFromResult(res);
    saveAlertDismissed = false;
    renderHudSaveAlert();
    if (openNow && game && document.getElementById("welcome-screen").style.display === "none") {
      openSaveConflictModal(saveConflictState);
    }
  }

  function saveGame(opts = {}) {
    if (!game || sandboxMode) return false;
    const inPractice = isPracticeModeActive();
    const force = !!(opts && opts.forceOverwrite);
    if (saveReadOnlyMode && !force) {
      renderHudSaveAlert();
      return false;
    }
    if (saveConflictState && !force) {
      renderHudSaveAlert();
      return false;
    }
    if (storageReadError && !force) {
      renderWelcomeSaveStatusBanner();
      return false;
    }

    // Synchronous multi-tab write-race guard: inspect live storage right before writing!
    let externalMaxRev = loadedSaveRev;
    if (!force) {
      try {
        const curRaw = localStorage.getItem(STORAGE_KEY);
        if (curRaw) {
          const curRes = parseAndValidateSaveRaw(curRaw, STORAGE_KEY);
          if (!curRes.ok) {
            storageReadError = {
              key: STORAGE_KEY,
              reason: curRes.reason || "本地存档结构异常",
              raw: curRaw,
              rawLength: curRaw.length,
              at: Date.now()
            };
            saveAlertDismissed = false;
            renderWelcomeSaveStatusBanner();
            renderHudSaveAlert();
            showToast("⚠ 本地存档已被异常修改，已暂停自动覆盖并保留原数据！", { critical: true, key: "save_corrupt_err", throttleMs: 6000 });
            return false;
          }
          if (isForeignSaveConflict(curRes)) {
            triggerSaveConflict(curRes, true);
            return false;
          }
          externalMaxRev = Math.max(externalMaxRev, curRes.rev);
        } else if (loadedSaveRev > 0) {
          // R2A-1: Save existed for this session (loadedSaveRev > 0) but was deleted on disk -> do NOT silently resurrect!
          triggerSaveConflict({ ok: true, rev: 0, tabId: "另一标签页", updatedAt: Date.now(), deleted: true, bundle: { game: null } }, true);
          return false;
        }
      } catch (e) {}
    } else {
      try {
        const curRaw = localStorage.getItem(STORAGE_KEY);
        if (curRaw) {
          const curRes = parseAndValidateSaveRaw(curRaw, STORAGE_KEY);
          if (curRes.ok) externalMaxRev = Math.max(externalMaxRev, curRes.rev);
        }
      } catch (e) {}
    }

    if (inPractice) return false;
    const nextRev = Math.max(Math.max(0, Math.floor(num(loadedSaveRev, 0))), Math.max(0, Math.floor(num(externalMaxRev, 0)))) + 1;
    const activeLineage = loadedSaveLineage || generateSaveLineageId();
    const gameForSave = getSanitizedGameForPersistence(game);
    const payloadObj = {
      game: gameForSave,
      stageIdx: arena.stageIdx,
      stanceIdx: arena.stanceIdx,
      towerMode: !!arena.towerMode,
      sanctumMode: !!arena.sanctumMode
    };
    const payloadChecksum = computeSaveChecksum(buildCanonicalSavePayload(payloadObj));
    const nowTs = Date.now();
    const envelope = Object.assign({
      envelopeVersion: 2,
      saveRev: nextRev,
      tabId: TAB_ID,
      lineageId: activeLineage,
      updatedAt: nowTs,
      checksum: payloadChecksum
    }, payloadObj);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      loadedSaveRev = nextRev;
      loadedSaveTabId = TAB_ID;
      loadedSaveLineage = activeLineage;
      loadedSaveUpdatedAt = nowTs;
      lastSavedPayloadChecksum = computeCurrentPayloadChecksum();
      storageWriteError = null;
      storageReadError = null;
      saveConflictState = null;
      if (force) saveReadOnlyMode = false;
      game.laws.forEach(lid => {
        if (!metaState.seenLaws.includes(lid)) metaState.seenLaws.push(lid);
      });
      const sc = computeCompetitionScore(game);
      if (sc > metaState.bestScore) metaState.bestScore = sc;
      if (game.towerBest > metaState.bestTower) metaState.bestTower = game.towerBest;
      saveMeta();
      renderHudSaveAlert();
      return true;
    } catch (e) {
      storageWriteError = {
        message: (e && e.name === "QuotaExceededError") ? "存储空间已满 (QuotaExceededError)" : (safeText(e && e.message, safeDiag(e)) || safeDiag(e)),
        at: Date.now()
      };
      saveAlertDismissed = false;
      renderHudSaveAlert();
      const writeToastThrottleMs = (opts && opts.userInitiated) ? 0 : 6000;
      showToast(`⚠ 本地存档写入失败：${storageWriteError.message}`, { critical: true, key: "save_write_err", throttleMs: writeToastThrottleMs });
      return false;
    }
  }

  function saveMeta(opts = {}) {
    if (sandboxMode || isPracticeModeActive()) return false;
    const force = !!(opts && opts.forceReset);
    const userInitiated = !!(opts && opts.userInitiated);
    if (metaReadError && !force) return false;
    if (saveReadOnlyMode && !force) return false;
    ensureMetaState();
    let nextMetaRev = (Number(metaState.metaRev) || 0) + 1;
    if (!force) {
      try {
        const curRaw = localStorage.getItem(META_KEY);
        if (curRaw !== null && curRaw !== "") {
          const curRes = parseAndValidateMetaRaw(curRaw, META_KEY);
          if (!curRes.ok) {
            metaReadError = {
              key: META_KEY,
              reason: curRes.reason || "元存档结构异常",
              raw: curRaw,
              rawLength: curRaw.length,
              at: Date.now()
            };
            saveAlertDismissed = false;
            renderWelcomeSaveStatusBanner();
            renderHudSaveAlert();
            showToast(`⚠ 检测到元存档已损坏（${metaReadError.reason}），已保留原数据并暂停写入！`, {
              critical: true,
              key: "meta_corrupt_err",
              throttleMs: userInitiated ? 0 : 6000
            });
            return false;
          }
          const merged = mergeMetaStates(metaState, curRes.meta);
          safeAssignPlain(metaState, merged);
          nextMetaRev = Math.max(Math.max(0, Math.floor(num(metaState.metaRev, 0))), Math.max(0, Math.floor(num(curRes.metaRev, 0)))) + 1;
        }
      } catch (e) {}
    } else {
      nextMetaRev = 1;
    }
    metaState.metaRev = nextMetaRev;
    metaState.metaUpdatedAt = Date.now();
    metaState.metaTabId = TAB_ID;
    try {
      localStorage.setItem(META_KEY, JSON.stringify(metaState));
      const hadWriteErr = !!metaWriteError;
      metaWriteError = null;
      if (hadWriteErr) renderHudSaveAlert();
      return true;
    } catch (e) {
      metaWriteError = {
        message: (e && e.name === "QuotaExceededError") ? "存储空间已满 (QuotaExceededError)" : (safeText(e && e.message, safeDiag(e)) || safeDiag(e)),
        at: Date.now()
      };
      saveAlertDismissed = false;
      renderHudSaveAlert();
      showToast(`⚠ 元存档写入失败：${metaWriteError.message}`, {
        critical: true,
        key: "meta_write_err",
        throttleMs: userInitiated ? 0 : 6000
      });
      return false;
    }
  }

  window.addEventListener("storage", (ev) => {
    if (sandboxMode) return;
    const wsEl = document.getElementById("welcome-screen");
    const onWelcome = !game || (wsEl && wsEl.style.display !== "none");
    const handleLivePrimaryCorruption = (reason, raw, toastMsg) => {
      const wasConflictModal = activeModalKind === "save_conflict" && Boolean(document.getElementById("modal-backdrop")?.classList.contains("open"));
      storageReadError = {
        key: STORAGE_KEY,
        reason: reason || "本地存档结构异常",
        raw,
        rawLength: typeof raw === "string" ? raw.length : 0,
        at: Date.now()
      };
      saveConflictState = null;
      saveAlertDismissed = false;
      renderWelcomeSaveStatusBanner();
      renderHudSaveAlert();
      if (wasConflictModal) {
        closeModal();
        focusSaveAlertOrFallback("overwrite-with-current-save");
      }
      showToast(toastMsg || "⚠ 检测到本地存档已损坏，已暂停自动保存并保留原数据！", { critical: true, key: "save_corrupt_err", throttleMs: 0 });
    };
    if (ev.key === null) {
      if (onWelcome) {
        clearLoadedSaveMeta();
        renderWelcomeScreen();
      } else if (loadedSaveRev > 0) {
        let liveRawAfterClear = null;
        try { liveRawAfterClear = localStorage.getItem(STORAGE_KEY); } catch (e) {}
        if (liveRawAfterClear === null || liveRawAfterClear === "") {
          triggerSaveConflict({ ok: true, rev: 0, tabId: "另一标签页", updatedAt: Date.now(), deleted: true, bundle: { game: null } }, true);
        }
      }
      return;
    }
    if (ev.key === META_KEY) {
      if (!ev.newValue) return;
      const res = parseAndValidateMetaRaw(ev.newValue, META_KEY);
      if (!res.ok) {
        metaReadError = {
          key: META_KEY,
          reason: res.reason || "另一标签页写入了异常元存档",
          raw: ev.newValue,
          rawLength: ev.newValue.length,
          at: Date.now()
        };
        saveAlertDismissed = false;
        renderWelcomeSaveStatusBanner();
        renderHudSaveAlert();
        showToast("⚠ 检测到另一标签页写入了异常元存档，已保留原数据并暂停覆写！");
        return;
      }
      if (res.meta.metaTabId && res.meta.metaTabId === TAB_ID) return;
      let liveRaw = null;
      let liveReadFailed = false;
      try { liveRaw = localStorage.getItem(META_KEY); } catch (e) { liveReadFailed = true; }
      let liveRes = null;
      if (liveRaw !== null && liveRaw !== "") {
        liveRes = parseAndValidateMetaRaw(liveRaw, META_KEY);
        if (!liveRes.ok) {
          metaReadError = {
            key: META_KEY,
            reason: liveRes.reason || "元存档结构异常",
            raw: liveRaw,
            rawLength: liveRaw.length,
            at: Date.now()
          };
          saveAlertDismissed = false;
          renderWelcomeSaveStatusBanner();
          renderHudSaveAlert();
          return;
        }
      }
      const localWasWriter = Boolean(metaState && metaState.metaTabId === TAB_ID);
      const merged = mergeMetaStates(metaState, res.meta);
      safeAssignPlain(metaState, merged);
      metaState.metaRev = Math.max(Math.max(0, Math.floor(num(metaState.metaRev, 0))), Math.max(0, Math.floor(num(res.metaRev, 0))));
      if (!liveReadFailed && liveRes && liveRes.ok) {
        metaReadError = null;
      }
      ensureMetaState();
      if (localWasWriter && isMetaBehind(res.meta, merged) && !saveReadOnlyMode && !sandboxMode && liveRes && liveRes.ok) {
        const targetMerged = mergeMetaStates(liveRes.meta, merged);
        safeAssignPlain(metaState, targetMerged);
        metaState.metaRev = Math.max(Math.max(0, Math.floor(num(metaState.metaRev, 0))), Math.max(0, Math.floor(num(liveRes.metaRev, 0))));
        ensureMetaState();
        if (isMetaBehind(liveRes.meta, targetMerged)) {
          saveMeta();
        }
      }
      if (onWelcome) {
        renderWelcomeScreen();
      } else {
        renderHudSaveAlert();
        updateHud();
      }
      return;
    }
    if (ev.key !== STORAGE_KEY) return;
    if (!ev.newValue) {
      if (onWelcome) {
        clearLoadedSaveMeta();
        renderWelcomeScreen();
        return;
      }
      let liveRawDel = null;
      try { liveRawDel = localStorage.getItem(STORAGE_KEY); } catch (e) {}
      if (liveRawDel !== null && liveRawDel !== "") {
        const liveDelRes = parseAndValidateSaveRaw(liveRawDel, STORAGE_KEY);
        if (!liveDelRes.ok) {
          handleLivePrimaryCorruption(liveDelRes.reason, liveRawDel, "⚠ 检测到本地存档已损坏，已暂停自动保存并保留原数据！");
          return;
        }
        if (liveDelRes.tabId && liveDelRes.tabId === TAB_ID) return;
        if (isForeignSaveConflict(liveDelRes)) {
          triggerSaveConflict(liveDelRes, true);
        }
        return;
      }
      if (loadedSaveRev > 0) {
        triggerSaveConflict({ ok: true, rev: 0, tabId: "另一标签页", updatedAt: Date.now(), deleted: true, bundle: { game: null } }, true);
      }
      return;
    }
    const res = parseAndValidateSaveRaw(ev.newValue, STORAGE_KEY);
    if (!res.ok) {
      handleLivePrimaryCorruption(res.reason || "另一标签页写入了异常存档数据", ev.newValue, "⚠ 检测到另一标签页写入了异常存档，已暂停自动保存并保留原数据！");
      return;
    }
    // A-4 & R2A-3: Always reconcile against live disk STORAGE_KEY before acting on a potentially delayed valid StorageEvent!
    let livePrimaryRaw = null;
    let livePrimaryReadFailed = false;
    try { livePrimaryRaw = localStorage.getItem(STORAGE_KEY); } catch (e) { livePrimaryReadFailed = true; }
    if (!livePrimaryReadFailed) {
      if (livePrimaryRaw === null || livePrimaryRaw === "") {
        if (onWelcome) {
          clearLoadedSaveMeta();
          renderWelcomeScreen();
          return;
        }
        if (loadedSaveRev > 0) {
          triggerSaveConflict({ ok: true, rev: 0, tabId: "另一标签页", updatedAt: Date.now(), deleted: true, bundle: { game: null } }, true);
        }
        return;
      }
      const livePrimaryRes = parseAndValidateSaveRaw(livePrimaryRaw, STORAGE_KEY);
      if (!livePrimaryRes.ok) {
        handleLivePrimaryCorruption(livePrimaryRes.reason, livePrimaryRaw, "⚠ 检测到本地存档已损坏，已暂停自动保存并保留原数据！");
        return;
      }
      if (livePrimaryRes.tabId && livePrimaryRes.tabId === TAB_ID) {
        // R3A-3: Live disk is synchronously owned by this tab; ignore any stale delayed foreign event with rev <= live rev OR updatedAt <= live disk updatedAt
        if (res.rev <= livePrimaryRes.rev || (livePrimaryRes.updatedAt > 0 && res.updatedAt > 0 && res.updatedAt <= livePrimaryRes.updatedAt)) {
          return;
        }
      } else {
        // Live disk belongs to a foreign/legacy tab: reconcile against live disk as source of truth
        if (onWelcome) {
          recordLoadedSaveMeta(livePrimaryRes);
          renderWelcomeScreen();
          return;
        }
        if (isForeignSaveConflict(livePrimaryRes)) {
          triggerSaveConflict(livePrimaryRes, true);
        }
        return;
      }
    }
    if (res.tabId && res.tabId === TAB_ID) return;
    if (onWelcome) {
      recordLoadedSaveMeta(res);
      renderWelcomeScreen();
      return;
    }
    if (isForeignSaveConflict(res)) {
      triggerSaveConflict(res, true);
    }
  });

  function flushSaveOnLifecycle() {
    if (!game || sandboxMode || isPracticeModeActive()) return;
    const ws = document.getElementById("welcome-screen");
    if (ws && ws.style.display !== "none") return;
    if (saveReadOnlyMode || saveConflictState || storageReadError) return;
    const curChecksum = computeCurrentPayloadChecksum();
    if (lastSavedPayloadChecksum && curChecksum === lastSavedPayloadChecksum) return;
    saveGame();
  }
  window.addEventListener("pagehide", flushSaveOnLifecycle);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      if (typeof stopHoldProgression === "function") stopHoldProgression("window_blur");
      flushSaveOnLifecycle();
    }
  });

  function getClearedCampaignStageIndices(g) {
    if (!g || !g.stageStars) return [];
    return [0, 1, 2, 3, 4].filter(idx => Math.floor(num(g.stageStars[idx], 0)) >= 1);
  }

  function getBondedCompanionIds(g) {
    if (!g) return [];
    return ["shen", "pei", "lu", "yan"].filter(id => getCompanionBondTier(g, id) >= 1);
  }
