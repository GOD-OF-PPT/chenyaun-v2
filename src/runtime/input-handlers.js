  // ==================== 12. INPUTS & MAIN 60FPS LOOP ====================
  window.addEventListener("keydown", (ev) => {
    GamepadSystem.setMode("kb");

    // 1. Keybind rebind capture mode (must work inside Settings modal, Escape cancels capture without closing modal)
    if (rebindListeningAction) {
      ev.preventDefault();
      if (ev.code === "Escape") {
        rebindListeningAction = null;
      } else {
        applyKeybindRemap(rebindListeningAction, ev.code);
        rebindListeningAction = null;
      }
      openSettingsModal();
      return;
    }

    // 2. Modal open (MUST run before cutscene so a modal over a cutscene still traps Tab and closes on Escape)
    const bd = document.getElementById("modal-backdrop");
    const modalOpen = !!(bd && bd.classList.contains("open"));
    if (modalOpen) {
      if (ev.code === "Tab") {
        trapFocusInContainer(ev, document.getElementById("modal-content"));
        return;
      }
      if (ev.code === "Escape") {
        if (modalCloseable) {
          ev.preventDefault();
          if (activeModalKind === "stage_sweep" && pendingStageSweep && pendingStageSweep.origin === "world_map") {
            const mapNid = pendingStageSweep.mapNodeId;
            pendingStageSweep = null;
            openWorldMapModal(mapNid);
            const mapSweepBtn = document.getElementById("btn-map-sweep-stage") || document.getElementById("btn-map-enter-node");
            if (mapSweepBtn && isElementFocusable(mapSweepBtn)) {
              try { mapSweepBtn.focus({ preventScroll: true }); } catch (e) {}
            }
            return;
          }
          craftMinigame.open = false;
          closeModal();
        }
        return;
      }
      if (craftMinigame.open && ev.code === "Space" && !isTypingTarget(ev.target)) {
        ev.preventDefault();
        strikeTaixuCraftMinigame(false);
        return;
      }
      return;
    }

    // 2b. R4A-2: Trap Tab/Shift+Tab strictly inside #welcome-screen when visible (and no modal is open)
    const wsFocus = document.getElementById("welcome-screen");
    if (wsFocus && wsFocus.style.display !== "none") {
      if (ev.code === "Tab") {
        trapFocusInContainer(ev, wsFocus);
        return;
      }
    }

    // 3. Cutscene overlay
    if (cutscene.active) {
      if (ev.code === "Tab") {
        trapFocusInContainer(ev, document.getElementById("story-dialogue-bar"));
        return;
      }
      const curLine = cutscene.lines && cutscene.lines[cutscene.idx];
      const hasChoices = !!(curLine && curLine.choices && curLine.choices.length);
      if (!hasChoices && (ev.code === "Space" || ev.code === "Enter")) {
        ev.preventDefault();
        const ae = document.activeElement;
        if (ae && ae.id === "btn-dlg-skip") {
          advanceCutscene(true);
        } else {
          advanceCutscene(false);
        }
        return;
      }
      if (ev.code === "Escape") {
        ev.preventDefault();
        const pavPopCut = document.getElementById("pavilion-popover");
        if (pavPopCut && pavPopCut.classList.contains("open")) {
          pavPopCut.classList.remove("open");
          const pavBtnCut = document.getElementById("btn-pavilion-menu");
          if (pavBtnCut) pavBtnCut.classList.remove("open");
          focusDialogSafely(document.getElementById("story-dialogue-bar"));
          return;
        }
        advanceCutscene(true);
        return;
      }
      return;
    }

    // 3b. Pavilion Popover floats above drawer & HUD: handle Tab/Escape BEFORE drawerOpen (R2A-6, R3A-2 guarded off welcome-screen)
    const wsTop = document.getElementById("welcome-screen");
    const onWelcomeTop = !game || (wsTop && wsTop.style.display !== "none");
    const pavPopTop = document.getElementById("pavilion-popover");
    if (!onWelcomeTop && pavPopTop && pavPopTop.classList.contains("open")) {
      if (ev.code === "Tab") {
        trapFocusInContainer(ev, pavPopTop);
        return;
      }
      if (ev.code === "Escape") {
        ev.preventDefault();
        closePavilionPopover();
        const pavBtnTop = document.getElementById("btn-pavilion-menu");
        if (pavBtnTop && isElementFocusable(pavBtnTop)) {
          try { pavBtnTop.focus({ preventScroll: true }); } catch (e) {}
        }
        return;
      }
    }

    // 4. Drawer open: trap Tab/Shift+Tab, allow Escape & alchemy Space; block all background global shortcuts
    if (drawerOpen) {
      if (ev.code === "Tab") {
        if (holdProgression.active) stopHoldProgression("ui_closed");
        trapFocusInContainer(ev, document.getElementById("jade-panel"));
        return;
      }
      if (ev.code === "Escape") {
        ev.preventDefault();
        closeDrawer();
        return;
      }
      if (ev.code === "Space" && currentTab === "alchemy" && furnaceGame.active && !isTypingTarget(ev.target)) {
        ev.preventDefault();
        strikeFurnaceNeedle();
        return;
      }
      if ((ev.code === "Space" || ev.code === "Enter") && !furnaceGame.active && !isTypingTarget(ev.target)) {
        const aeHold = document.activeElement;
        if (aeHold && !aeHold.disabled && aeHold.closest && aeHold.closest("#jade-panel") &&
            (aeHold.hasAttribute("data-enhance-slot") || aeHold.hasAttribute("data-quick-craft"))) {
          ev.preventDefault();
          if (!ev.repeat) {
            const hKind = aeHold.hasAttribute("data-enhance-slot") ? "enhance" : "alchemy";
            const hKey = hKind === "enhance" ? aeHold.getAttribute("data-enhance-slot") : aeHold.getAttribute("data-quick-craft");
            startHoldProgression({ kind: hKind, key: hKey, inputType: "keyboard", keyCode: ev.code });
          }
          return;
        }
      }
      return;
    }

    // 5. Typing / form input guard outside modal & drawer (e.g. #player-name-input, #photo-zoom-range)
    if (isTypingTarget(ev.target)) {
      if (ev.code === "Escape") {
        if (photoMode.active) {
          ev.preventDefault();
          togglePhotoMode(false);
        } else if (ev.target && typeof ev.target.blur === "function") {
          ev.target.blur();
        }
      }
      return;
    }

    keysDown[ev.code] = true;
    const wsKeyEl = document.getElementById("welcome-screen");
    const onWelcomeKey = !game || (wsKeyEl && wsKeyEl.style.display !== "none");
    if (ev.code === keybinds.telemetry.kb) {
      if (onWelcomeKey) return;
      ev.preventDefault();
      toggleTelemetryPanel();
      return;
    }
    if (keybinds.photo && ev.code === keybinds.photo.kb) { ev.preventDefault(); togglePhotoMode(); return; }
    if (photoMode.active) {
      if (ev.code === "Escape") { ev.preventDefault(); togglePhotoMode(false); return; }
      if (ev.code === "KeyU") {
        ev.preventDefault();
        photoMode.uiHidden = !photoMode.uiHidden;
        document.body.classList.toggle("photo-ui-hidden", photoMode.uiHidden);
        return;
      }
      return;
    }
    const pavPop = document.getElementById("pavilion-popover");
    if (!onWelcomeKey && ev.code === "Escape" && pavPop && pavPop.classList.contains("open")) {
      ev.preventDefault();
      closePavilionPopover();
      const pavBtn = document.getElementById("btn-pavilion-menu");
      if (pavBtn && isElementFocusable(pavBtn)) {
        try { pavBtn.focus({ preventScroll: true }); } catch (e) {}
      }
      return;
    }
    // R3A-5 + R4A-3: Escape dismisses expanded & active Sanctum Dojo control bar and restores focus to #btn-toggle-dojo-bar
    const dojoBarEsc = document.getElementById("dojo-control-bar");
    if (!onWelcomeKey && ev.code === "Escape" && dojoBarEsc && dojoBarEsc.classList.contains("active") && dojoBarEsc.classList.contains("expanded")) {
      ev.preventDefault();
      dojoBarEsc.classList.remove("expanded");
      const caretEsc = document.getElementById("lbl-dojo-caret");
      if (caretEsc) caretEsc.textContent = "▾";
      const dojoBtnEsc = document.getElementById("btn-toggle-dojo-bar");
      if (isElementFocusable(dojoBtnEsc)) {
        try { dojoBtnEsc.focus({ preventScroll: true }); } catch (e) {}
      } else {
        focusBattlefield();
      }
      return;
    }
    if (ev.code === "Escape" && activeUnlockCardId) {
      ev.preventDefault();
      dismissActiveUnlockCard();
      return;
    }
    if (!game || arena.paused || onWelcomeKey) return;

    const ae = document.activeElement;
    const aeTag = ae && ae.tagName;
    const aeIsRoleButton = !!(ae && typeof ae.getAttribute === "function" && ae.getAttribute("role") === "button");
    const aeIsNativeInteractive = Boolean(aeTag && /^(BUTTON|A|SUMMARY)$/i.test(aeTag));
    if (aeIsRoleButton && (ev.code === "Enter" || ev.code === "Space")) {
      ev.preventDefault();
      if (typeof ae.click === "function") ae.click();
      return;
    }
    if (aeIsNativeInteractive && (ev.code === "Enter" || ev.code === "Space")) {
      return;
    }

    if (ev.code === "BracketRight") { ev.preventDefault(); toggleLocalCoop2P(); return; }
    if (ev.code === "BracketLeft") { ev.preventDefault(); cycleCoop2PPartner(); return; }
    if (ev.code === "Backslash") { ev.preventDefault(); cycleCelestialTimePhase(); return; }
    if (arena.coop2P && arena.coop2P.active && ["Semicolon", "Quote", "Numpad0", "Numpad1", "Numpad2"].includes(ev.code)) {
      ev.preventDefault();
      arena.coop2P.manualIdleT = 0;
      triggerCoop2PAttack(ev.code === "Quote" || ev.code === "Numpad2");
      return;
    }
    // When 2P Co-Op is active, IJKL drives 2P movement cleanly without colliding with 1P shortcuts!
    if (arena.coop2P && arena.coop2P.active && ["KeyI", "KeyJ", "KeyK", "KeyL"].includes(ev.code)) {
      return;
    }

    if (ev.code === "Enter" && arena.nearbyProp) {
      if (!aeIsRoleButton && (!aeTag || !/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/i.test(aeTag))) {
        ev.preventDefault();
        interactWithProp(arena.nearbyProp);
        return;
      }
    }

    let matchedBind = null;
    for (const [act, cfg] of Object.entries(keybinds)) {
      if (cfg.kb === ev.code) { matchedBind = act; break; }
    }
    if (!matchedBind && (ev.code === "ShiftLeft" || ev.code === "ShiftRight")) {
      matchedBind = "jump";
    }
    if (matchedBind) {
      if (ev.code === "Space") ev.preventDefault();
      triggerMappedAction(matchedBind);
    } else if (ev.code === "KeyB") {
      startLiveTribulation();
    } else if (ev.code === "KeyL") {
      if (document.getElementById("modal-backdrop").classList.contains("open")) closeModal();
      else openCelestialSpireModal();
    } else if (ev.code === "Digit1" && game && !arena.paused) {
      cycleWeaponArsenalForm("sword");
    } else if (ev.code === "Digit2" && game && !arena.paused) {
      cycleWeaponArsenalForm("spear");
    } else if (ev.code === "Digit3" && game && !arena.paused) {
      cycleWeaponArsenalForm("chakram");
    } else if (ev.code === "Digit4" && game && !arena.paused) {
      triggerSanqingTriClones();
    } else if (ev.code === "Digit5" && game && !arena.paused) {
      castShanheShejiDomain();
    } else if (ev.code === "Digit6" && game && !arena.paused) {
      triggerWarshipOrbitalStrike();
    } else if (ev.code === "Digit7" && game) {
      if (document.getElementById("modal-backdrop").classList.contains("open")) closeModal();
      else if (!isActionUnlockedByRealm(game, "sequencer")) guardActionRealm("sequencer");
      else if (confirmCombatHotkeyArm("Digit7", "连招编排")) openComboSequencerModal();
    } else if (ev.code === "Digit8" && game) {
      if (document.getElementById("modal-backdrop").classList.contains("open")) closeModal();
      else if (!isEcosystemSystemUnlocked(game, "vein_expedition")) guardEcosystemAccess("vein_expedition");
      else if (confirmCombatHotkeyArm("Digit8", "宗门远征")) openExpeditionSandboxModal();
    } else if (ev.code === "KeyN") {
      if (document.getElementById("modal-backdrop").classList.contains("open")) closeModal();
      else openStarChartModal();
    } else if (ev.code === "KeyM") {
      if (document.getElementById("modal-backdrop").classList.contains("open")) closeModal();
      else openWorldMapModal();
    } else if (ev.code === "Digit9") {
      if (document.getElementById("modal-backdrop").classList.contains("open")) closeModal();
      else if (confirmCombatHotkeyArm("Digit9", "星图路线")) openDungeonMapModal();
    } else if (ev.code === "KeyT") {
      if (document.getElementById("modal-backdrop").classList.contains("open")) closeModal();
      else openObjectivesModal();
    }
  });
  function confirmCombatHotkeyArm(code, label) {
    if (isCombatCalm()) return true;
    const now = performance.now();
    if (combatHotkeyArmMap[code] && now <= combatHotkeyArmMap[code]) {
      delete combatHotkeyArmMap[code];
      return true;
    }
    combatHotkeyArmMap[code] = now + 2500;
    showToast(`战斗中 · 再按一次打开【${label}】`, { tier: 1, key: `arm_${code}`, throttleMs: 1200 });
    return false;
  }
  window.addEventListener("keyup", (ev) => {
    keysDown[ev.code] = false;
    if (holdProgression.active && holdProgression.inputType === "keyboard" && ev.code === holdProgression.keyCode) {
      const wasRepeat = holdProgression.didRepeat;
      const hKind = holdProgression.kind;
      const hKey = holdProgression.key;
      stopHoldProgression("released");
      if (!wasRepeat) {
        if (hKind === "enhance") {
          executeSingleGearEnhance(hKey, { silentToast: false, fromHold: false });
          const refBtn = getHoldTargetButton("enhance", hKey);
          if (refBtn && isElementFocusable(refBtn)) {
            try { refBtn.focus({ preventScroll: true }); } catch (e) {}
          }
        } else if (hKind === "alchemy") {
          if (!guardNotInTribulation("丹道炼制") || !guardNotPracticeMode("丹道炼制")) return;
          const rec = RECIPES[hKey];
          if (rec) {
            if (rec.reqCauldronLv && getSanctumLevel(game, "cauldron") < rec.reqCauldronLv) {
              showToast(`需将洞府【紫微丹鼎】升至 Lv.${rec.reqCauldronLv} 方可炼制！`);
            } else {
              const bd = computeRecipeCostBreakdown(game, rec);
              if (game.stones < bd.totalStoneCost) {
                showToast(`灵石不足（共需 ${bd.totalStoneCost} 灵石${bd.hasMissing ? `，含购入缺料 ${bd.matBuyCost} 灵石` : ""}）`);
              } else if (bd.hasMissing) {
                openAlchemyBuyConfirmModal(rec.id, "quick");
              } else {
                executeAlchemyQuickCraft(rec.id);
                const refBtn = getHoldTargetButton("alchemy", hKey);
                if (refBtn && isElementFocusable(refBtn)) {
                  try { refBtn.focus({ preventScroll: true }); } catch (e) {}
                }
              }
            }
          }
        }
      }
    }
  });

  window.addEventListener("contextmenu", (ev) => {
    if (ev.target && ev.target.id === "fx-canvas") {
      ev.preventDefault();
      GamepadSystem.setMode("kb");
      triggerMappedAction("recall");
    }
  });

  document.addEventListener("pointermove", (ev) => {
    pointer.x = ev.clientX; pointer.y = ev.clientY;
    checkHoldPointerBounds(ev.clientX, ev.clientY);
    if (photoMode.active && photoMode.dragging) {
      photoMode.panX = Math.max(-460, Math.min(460, ev.clientX - photoMode.dragStartX));
      photoMode.panY = Math.max(-320, Math.min(320, ev.clientY - photoMode.dragStartY));
      return;
    }
    const pel = (ev.target && ev.target.nodeType === 1) ? ev.target : (ev.target && ev.target.parentElement ? ev.target.parentElement : null);
    const tipNode = pel ? pel.closest("[data-tip]") : null;
    const tipEl = document.getElementById("ling-tooltip");
    const suppressTip = !!(tipNode && (
      (tipNode.id === "btn-pavilion-menu" && tipNode.classList.contains("open")) ||
      (tipNode.id === "btn-toggle-dojo-bar" && tipNode.closest("#dojo-control-bar.expanded")) ||
      (tipNode.id === "btn-toggle-arcana" && tipNode.closest("#arcana-vault-wrap.open"))
    ));
    if (tipNode && tipEl && !suppressTip) {
      const [hd, bd] = (tipNode.getAttribute("data-tip") || "").split("|");
      document.getElementById("ling-tip-title").textContent = hd || "";
      document.getElementById("ling-tip-desc").textContent = bd || "";
      tipEl.style.display = "block";
      tipEl.style.left = Math.min(window.innerWidth - 260, ev.clientX + 14) + "px";
      tipEl.style.top = Math.min(window.innerHeight - 85, ev.clientY + 14) + "px";
    } else if (tipEl) {
      tipEl.style.display = "none";
    }
  });

  document.addEventListener("pointerdown", (ev) => {
    Sound.ensure();
    if (ev.button === 0) clearSuppressClick();
    pointer.x = ev.clientX; pointer.y = ev.clientY;
    if (cutscene.active) return;
    if (ev.button === 0 && drawerOpen) {
      const bdHold = document.getElementById("modal-backdrop");
      if (!(bdHold && bdHold.classList.contains("open"))) {
        const pelHold = (ev.target && ev.target.nodeType === 1) ? ev.target : (ev.target && ev.target.parentElement ? ev.target.parentElement : null);
        const holdBtn = pelHold ? pelHold.closest("#jade-panel [data-enhance-slot], #jade-panel [data-quick-craft]") : null;
        if (holdBtn && !holdBtn.disabled) {
          const hKind = holdBtn.hasAttribute("data-enhance-slot") ? "enhance" : "alchemy";
          const hKey = hKind === "enhance" ? holdBtn.getAttribute("data-enhance-slot") : holdBtn.getAttribute("data-quick-craft");
          startHoldProgression({ kind: hKind, key: hKey, inputType: "pointer", pointerId: ev.pointerId, pointerX: ev.clientX, pointerY: ev.clientY });
          return;
        }
      }
    }
    const isCanvas = ev.target && ev.target.id === "fx-canvas";
    if (isCanvas) {
      const pav = document.getElementById("pavilion-popover");
      const pavBtn = document.getElementById("btn-pavilion-menu");
      if (pav && pav.classList.contains("open")) {
        pav.classList.remove("open");
        if (pavBtn) pavBtn.classList.remove("open");
      }
      const dojoB = document.getElementById("dojo-control-bar");
      if (dojoB && dojoB.classList.contains("expanded")) {
        dojoB.classList.remove("expanded");
        const caret = document.getElementById("lbl-dojo-caret");
        if (caret) caret.textContent = "▾";
      }
      if (photoMode.active) {
        photoMode.dragging = true;
        photoMode.dragStartX = ev.clientX - photoMode.panX;
        photoMode.dragStartY = ev.clientY - photoMode.panY;
        return;
      }
      if (drawerOpen) { closeDrawer(); focusBattlefield(); return; }
      focusBattlefield();
      GamepadSystem.setMode("kb");
      if (ev.button === 1) {
        ev.preventDefault();
        triggerMappedAction("swordBlink");
        return;
      }
      if (ev.button === 2) {
        triggerMappedAction("recall");
        return;
      }
      pointer.down = true;
      pointer.holdTime = 0;
      pointer.worldActive = true;
      for (const pr of arena.props) {
        if (Math.hypot(ev.clientX - pr.x, ev.clientY - pr.y) < pr.r + 26) {
          if (interactWithProp(pr)) {
            pointer.down = false;
            pointer.worldActive = false;
            return;
          }
        }
      }
      const clickedEnemy = arena.enemies.some(e => Math.hypot(ev.clientX - e.x, ev.clientY - e.y) < e.r + 42) || arena.props.some(pr => pr.destructible && Math.hypot(ev.clientX - pr.x, ev.clientY - pr.y) < pr.r + 36);
      if (!clickedEnemy) {
        pointer.moveTarget = { x: ev.clientX, y: ev.clientY };
      } else {
        pointer.moveTarget = null;
      }
      triggerMappedAction("slash");
    }
  });

  window.addEventListener("wheel", (ev) => {
    if (photoMode.active) {
      ev.preventDefault();
      photoMode.zoom = Math.max(0.70, Math.min(2.40, photoMode.zoom - Math.sign(ev.deltaY) * 0.10));
      syncPhotoStudioUi();
    }
  }, { passive: false });

  document.addEventListener("input", (ev) => {
    if (ev.target && ev.target.id === "photo-zoom-range") {
      photoMode.zoom = Math.max(0.70, Math.min(2.40, Number(ev.target.value) / 100));
      syncPhotoStudioUi();
    }
  });

  window.addEventListener("pointerup", (ev) => {
    if (holdProgression.active && holdProgression.inputType === "pointer") {
      stopHoldProgression("released");
    }
    releaseSuppressClickForPointer(ev && ev.pointerId != null ? ev.pointerId : null, false);
    photoMode.dragging = false;
    if (pointer.down && pointer.worldActive && pointer.holdTime > 0.25) {
      releaseChargedSwordVolley();
    }
    pointer.down = false; pointer.holdTime = 0; pointer.worldActive = false;
  });

  window.addEventListener("pointercancel", (ev) => {
    if (holdProgression.active && holdProgression.inputType === "pointer") {
      stopHoldProgression("pointer_cancel");
    }
    releaseSuppressClickForPointer(ev && ev.pointerId != null ? ev.pointerId : null, true);
  });

  document.addEventListener("click", (ev) => {
    const cel = (ev.target && ev.target.nodeType === 1) ? ev.target : (ev.target && ev.target.parentElement ? ev.target.parentElement : null);
    const t = cel ? cel.closest('button, [role="button"]') : null;
    if (!t || t.disabled) return;
    if (t.closest && t.closest("#pavilion-popover")) {
      const pav = document.getElementById("pavilion-popover");
      const pavBtn = document.getElementById("btn-pavilion-menu");
      if (pav) pav.classList.remove("open");
      if (pavBtn) {
        pavBtn.classList.remove("open");
        if (cutscene.active) {
          focusDialogSafely(document.getElementById("story-dialogue-bar"));
        } else if (isElementFocusable(pavBtn)) {
          try { pavBtn.focus({ preventScroll: true }); } catch (e) {}
        }
      }
    }

    if (t.id === "btn-dlg-next") { advanceCutscene(false); return; }
    if (t.id === "btn-dlg-skip") { advanceCutscene(true); return; }

    if (t.id === "btn-toggle-origin") { document.getElementById("title-custom-drawer").classList.toggle("open"); return; }
    if (t.hasAttribute("data-perk")) { selectedPerkId = t.getAttribute("data-perk"); renderWelcomeScreen(); return; }
    if (t.hasAttribute("data-calamity-tier")) {
      const nextTier = Number(t.getAttribute("data-calamity-tier")) || 0;
      if (!isCalamityTierUnlocked(nextTier)) {
        showToast("需先完成对应累计飞升世数方可开启此重【劫火周目】！");
        return;
      }
      selectedCalamityTier = nextTier;
      Sound.clang(1.2, 0.08);
      if (document.getElementById("welcome-screen").style.display !== "none") {
        renderWelcomeScreen();
      } else if (game && document.getElementById("modal-backdrop").classList.contains("open")) {
        openEndingModal();
      }
      return;
    }
    const m4QuickAct = t.getAttribute("data-action");
    if (m4QuickAct === "open-hall-of-lives") {
      const pav = document.getElementById("pavilion-popover"); if (pav) pav.classList.remove("open");
      const pavBtn = document.getElementById("btn-pavilion-menu"); if (pavBtn) pavBtn.classList.remove("open");
      if (activeModalKind === "ending" && modalCloseable) closeModal();
      openHallOfLivesModal();
      return;
    }
    if (m4QuickAct === "open-ascension-roadmap") {
      const pav = document.getElementById("pavilion-popover"); if (pav) pav.classList.remove("open");
      const pavBtn = document.getElementById("btn-pavilion-menu"); if (pavBtn) pavBtn.classList.remove("open");
      openAscensionRoadmapModal();
      return;
    }
    if (m4QuickAct === "toggle-arcana-all-roadmap") {
      if (!game) return;
      if (sandboxMode) {
        exitSandboxMode();
      } else {
        openSandboxConfirmModal("roadmap", null);
      }
      return;
    }
    if (m4QuickAct === "confirm-enter-sandbox") {
      const entry = pendingSandboxEntry || { source: "pavilion", preset: null };
      pendingSandboxEntry = null;
      enterSandboxMode(entry);
      return;
    }
    if (m4QuickAct === "exit-sandbox") {
      exitSandboxMode();
      return;
    }
    if (m4QuickAct === "unlock-card-try") {
      tryActiveUnlockCard();
      return;
    }
    if (m4QuickAct === "unlock-card-dismiss") {
      dismissActiveUnlockCard();
      return;
    }
    if (m4QuickAct === "open-lifespan-status") {
      if (!game) return;
      if (getLifespanInfo(game).status === "exhausted") openLifespanExhaustedModal(false);
      else toggleDrawer("cultivate");
      return;
    }
    if (m4QuickAct === "open-lifespan-exhausted") {
      openLifespanExhaustedModal(false);
      return;
    }
    if (m4QuickAct === "open-bingjie-confirm") {
      openLifespanExhaustedModal(true);
      return;
    }
    if (m4QuickAct === "open-pending-rewards" || t.id === "btn-pending-rewards") {
      openPendingRewardsManually();
      return;
    }
    if (m4QuickAct === "lifespan-stay") {
      const evId = activePendingRewardId;
      activeLifespanModalOpen = false;
      if (evId) {
        const res = commitPendingReward(evId, () => true);
        if (!res.ok) {
          if (!saveConflictState) closeModal();
          return;
        }
      }
      lifespanExhaustedPromptDismissed = true;
      pendingLifespanExhaustedPrompt = false;
      closeModal();
      showToast("已暂留此世，进度完好保留；可炼制【延寿青莲丹】或破境延寿！");
      return;
    }
    if (m4QuickAct === "lifespan-use-pill") {
      if (!game || (game.inventory.longevity_pill || 0) < 1) {
        showToast("行囊中暂无【延寿青莲丹】！");
        return;
      }
      const evId = activePendingRewardId;
      if (evId) {
        let prevLf = null;
        let hpRes = null;
        let lf = null;
        const res = commitPendingReward(evId, () => {
          if ((game.inventory.longevity_pill || 0) < 1) return false;
          prevLf = getLifespanInfo(game);
          game.inventory.longevity_pill -= 1;
          game.lifespanBonusMonths = (game.lifespanBonusMonths || 0) + 360;
          hpRes = grantPermanentStatBonus(game, { hp: 15, source: "alchemy" });
          const stNew = getCombatStats(game);
          if (hpRes.grantedHp > 0) game.hp = Math.min(stNew.maxHp, game.hp + hpRes.grantedHp);
          lf = getLifespanInfo(game);
          if (Array.isArray(game.journal)) game.journal.unshift(`服下【延寿青莲丹】，寿元延至 ${lf.maxYears} 载！`);
          return true;
        });
        if (!res.ok) {
          if (!saveConflictState) closeModal();
          return;
        }
        if (lf && !lf.isExhausted) {
          lifespanExhaustedPromptDismissed = false;
          pendingLifespanExhaustedPrompt = false;
        }
        Sound.fanfare();
        addRipple(arena.player.x, arena.player.y + 18, 120, "#70ffe6");
        addFloat("🌿 延寿青莲丹 · 寿元 +30 载！", arena.player.x, arena.player.y - 54, "#70ffe6", 18, true);
        const reliefNote = (lf && prevLf && (lf.status !== prevLf.status || lf.xpEfficiencyMult > prevLf.xpEfficiencyMult))
          ? `（寿元警报已解，修炼效率恢复至 ${Math.round(lf.xpEfficiencyMult * 100)}%！）`
          : "";
        showToast(hpRes && hpRes.grantedHp > 0
          ? `🌿 服下【延寿青莲丹】· 寿元永久 +30 载（${lf.curYears}/${lf.maxYears} 载）且气血上限 +${hpRes.grantedHp}${hpRes.hpCapped ? `（丹道气血已达上限 ${hpRes.pg.alchemyHp}/${hpRes.caps.alchemyHp}）` : ""}！${reliefNote}`
          : `🌿 服下【延寿青莲丹】· 寿元永久 +30 载（${lf.curYears}/${lf.maxYears} 载，本境丹道永久气血已达上限 ${hpRes.pg.alchemyHp}/${hpRes.caps.alchemyHp}）！${reliefNote}`);
        updateHud();
        if (drawerOpen) renderDrawerContent();
        if (activeLifespanModalOpen) {
          activeLifespanModalOpen = false;
          if (drawerOpen) {
            const panel = document.getElementById("jade-panel");
            if (panel && (!lastModalTriggerEl || !lastModalTriggerEl.isConnected || !isElementFocusable(lastModalTriggerEl))) {
              const refreshedTrigger =
                panel.querySelector('#panel-scroll-body [data-use-item="longevity_pill"]') ||
                panel.querySelector('#panel-scroll-body [data-action="open-lifespan-exhausted"]') ||
                panel.querySelector('[data-close-drawer]');
              if (refreshedTrigger && isElementFocusable(refreshedTrigger)) {
                lastModalTriggerEl = refreshedTrigger;
              }
            }
          } else if (lastModalTriggerEl && lastModalTriggerEl.id === "hud-lifespan-badge" && (lastModalTriggerEl.style.display === "none" || !isElementFocusable(lastModalTriggerEl))) {
            const fallbackBtn = document.getElementById("btn-open-profile") || document.getElementById("btn-open-settings");
            if (fallbackBtn && isElementFocusable(fallbackBtn)) {
              lastModalTriggerEl = fallbackBtn;
            }
          }
          closeModal();
        }
        return;
      }
      consumeInventoryItem("longevity_pill");
      return;
    }
    if (m4QuickAct === "confirm-bingjie-reincarnate") {
      executeReincarnation({ source: "bingjie" });
      return;
    }
    if (t.hasAttribute("data-open-pet-skill-tier")) {
      const tier = Number(t.getAttribute("data-open-pet-skill-tier")) === 5 ? 5 : 3;
      openPetSkillChoiceModal(tier);
      return;
    }
    if (t.hasAttribute("data-pick-pet-skill")) {
      if (!game || !game.pet || !game.pet.id) return;
      const skId = t.getAttribute("data-pick-pet-skill");
      const tier = Number(t.getAttribute("data-pet-skill-tier")) === 5 ? 5 : 3;
      if (!hasOwn(PET_SKILLS_BY_ID, skId) || PET_SKILLS_BY_ID[skId].tier !== tier || (game.pet.level || 1) < tier) return;
      if (!game.pet.skills || typeof game.pet.skills !== "object") game.pet.skills = { tier3: null, tier5: null };
      game.pet.skills[tier === 5 ? "tier5" : "tier3"] = skId;
      const sk = PET_SKILLS_BY_ID[skId];
      Sound.fanfare();
      saveGame();
      updateHud();
      if (drawerOpen) renderDrawerContent();
      const panel = document.getElementById("jade-panel");
      if (drawerOpen && panel) {
        const refreshedTrigger = panel.querySelector(`[data-open-pet-skill-tier]`) || panel.querySelector(`[data-action="feed-pet"]`);
        if (refreshedTrigger && isElementFocusable(refreshedTrigger)) {
          lastModalTriggerEl = refreshedTrigger;
        }
      }
      closeModal();
      showToast(`✨ 本命灵宠习得 Lv.${tier} ${tier === 5 ? "化境神通" : "化形灵技"}【${sk.name}】！`);
      return;
    }
    if (m4QuickAct === "overflow-smelt-new") {
      if (!game || !activeGearOverflowItem) { closeModal(); return; }
      const item = activeGearOverflowItem.item;
      const evId = activeGearOverflowItem.eventId || activePendingRewardId;
      const smeltVal = Math.max(1, Math.floor(num(item && item.sell, 15)));
      if (evId) {
        const res = commitPendingReward(evId, () => {
          game.stones = (game.stones || 0) + smeltVal;
          return true;
        });
        if (!res.ok) {
          if (!saveConflictState) closeModal();
          return;
        }
      } else {
        game.stones = (game.stones || 0) + smeltVal;
        saveGame();
      }
      activeGearOverflowItem = null;
      Sound.qiOrb(3);
      showToast(`🔥 已熔炼新物【${item.name}】· 获灵石 +${smeltVal}！`);
      updateHud();
      if (drawerOpen) renderDrawerContent();
      closeModal();
      return;
    }
    if (m4QuickAct === "overflow-discard-new") {
      if (!game || !activeGearOverflowItem) { closeModal(); return; }
      const item = activeGearOverflowItem.item;
      const evId = activeGearOverflowItem.eventId || activePendingRewardId;
      if (evId) {
        const res = commitPendingReward(evId, () => true);
        if (!res.ok) {
          if (!saveConflictState) closeModal();
          return;
        }
      } else {
        saveGame();
      }
      activeGearOverflowItem = null;
      showToast(`已放弃新物【${item.name}】，行囊维持不变。`);
      updateHud();
      if (drawerOpen) renderDrawerContent();
      closeModal();
      return;
    }
    if (t.hasAttribute("data-overflow-replace-idx")) {
      if (!game || !activeGearOverflowItem) { closeModal(); return; }
      const idx = Math.floor(num(t.getAttribute("data-overflow-replace-idx"), -1));
      if (idx < 0 || idx >= game.gearBag.length) return;
      const newItem = activeGearOverflowItem.item;
      const oldItem = game.gearBag[idx];
      const oldSell = Math.max(1, Math.floor(num(oldItem && oldItem.sell, 15)));
      const evId = activeGearOverflowItem.eventId || activePendingRewardId;
      if (evId) {
        const res = commitPendingReward(evId, () => {
          if (idx < 0 || idx >= game.gearBag.length) return false;
          game.gearBag[idx] = newItem;
          game.stones = (game.stones || 0) + oldSell;
          return true;
        });
        if (!res.ok) {
          if (!saveConflictState) closeModal();
          return;
        }
      } else {
        game.gearBag[idx] = newItem;
        game.stones = (game.stones || 0) + oldSell;
        saveGame();
      }
      activeGearOverflowItem = null;
      pendingCompareGear = newItem;
      clearCompareSmeltConfirm();
      renderGearCompareCard();
      Sound.fanfare();
      showToast(`✦ 已将【${newItem.name}】替换入袋，熔炼旧物【${oldItem.name}】获 +${oldSell} 灵石！`);
      updateHud();
      if (drawerOpen) renderDrawerContent();
      closeModal();
      return;
    }
    if (m4QuickAct === "confirm-alchemy-buy") {
      const req = pendingAlchemyCraft;
      pendingAlchemyCraft = null;
      if (!game || !req || !RECIPES[req.recId]) { closeModal(); return; }
      const rec = RECIPES[req.recId];
      const bd = computeRecipeCostBreakdown(game, rec);
      if (game.stones < bd.totalStoneCost) {
        showToast(`灵石不足（共需 ${bd.totalStoneCost} 灵石）`);
        closeModal();
        return;
      }
      if (req.mode === "furnace") {
        closeModal();
        startFurnaceMinigame(req.recId, { confirmedMissingBuy: true });
      } else {
        executeAlchemyQuickCraft(req.recId);
        const panel = document.getElementById("jade-panel");
        if (drawerOpen && panel) {
          const refreshedTrigger = panel.querySelector(`[data-quick-craft="${req.recId}"]`);
          if (refreshedTrigger && isElementFocusable(refreshedTrigger)) {
            lastModalTriggerEl = refreshedTrigger;
          }
        }
        closeModal();
      }
      return;
    }
    if (t.hasAttribute("data-soul-choice")) {
      const choice = t.getAttribute("data-soul-choice");
      const sid = t.getAttribute("data-soul-id") || activeSoulUnlockId;
      const sp = (sid && hasOwn(SOUL_SPIRITS, sid)) ? SOUL_SPIRITS[sid] : null;
      const evId = activePendingRewardId;
      if (game && sp) {
        const applySoul = () => {
          if (choice === "equip") game.equippedSoul = sid;
          return true;
        };
        if (evId) {
          const res = commitPendingReward(evId, applySoul);
          if (!res.ok) {
            if (!saveConflictState) closeModal();
            return;
          }
        } else {
          applySoul();
          saveGame();
        }
        activeSoulUnlockId = null;
        if (choice === "equip") {
          Sound.soulManifestRoar();
          showToast(`👹 已装备新镇妖魂印【${sp.name}】（按 C / RB 施放）！`);
        } else {
          const curSp = hasOwn(SOUL_SPIRITS, game.equippedSoul) ? SOUL_SPIRITS[game.equippedSoul] : SOUL_SPIRITS.blood_warden;
          showToast(`已保留当前魂印【${curSp.name}】，新魂印【${sp.name}】可随时于修行抽屉切换。`);
        }
        updateHud();
        if (drawerOpen) renderDrawerContent();
      } else {
        activeSoulUnlockId = null;
      }
      closeModal();
      return;
    }
    if (t.hasAttribute("data-soul-refine")) {
      const mode = t.getAttribute("data-soul-refine");
      const sid = pendingSoulRefineId || t.getAttribute("data-soul-id");
      pendingSoulRefineId = null;
      const sp = (sid && hasOwn(SOUL_SPIRITS, sid)) ? SOUL_SPIRITS[sid] : null;
      if (!game || !sp) { closeModal(); return; }
      if (!Array.isArray(game.unlockedSouls)) game.unlockedSouls = ["blood_warden"];
      if (!game.unlockedSouls.includes(sid)) {
        if (game.stones < 80) {
          showToast(`灵石不足（炼化【${sp.shortLbl}】需 80 灵石）`);
          closeModal();
          return;
        }
        game.stones -= 80;
        game.unlockedSouls.push(sid);
      }
      if (mode === "equip") {
        game.equippedSoul = sid;
        Sound.soulManifestRoar();
        showToast(`👹 已耗 80 灵石炼化并装备镇妖魂印【${sp.name}】！`);
      } else {
        Sound.fanfare();
        showToast(`✦ 已耗 80 灵石炼化【${sp.name}】并保留当前佩带魂印！`);
      }
      saveGame();
      updateHud();
      if (drawerOpen) renderDrawerContent();
      const panel = document.getElementById("jade-panel");
      if (drawerOpen && panel) {
        const refreshedTrigger = panel.querySelector(`[data-equip-soul="${sid}"]`);
        if (refreshedTrigger && isElementFocusable(refreshedTrigger)) {
          lastModalTriggerEl = refreshedTrigger;
        }
      }
      closeModal();
      return;
    }
    if (t.hasAttribute("data-roadmap-sys")) {
      const sysId = t.getAttribute("data-roadmap-sys");
      const actId = t.getAttribute("data-roadmap-act");
      if (!guardEcosystemAccess(sysId)) return;
      launchEcosystemAction(actId);
      return;
    }
    if (t.hasAttribute("data-equip-sword-aura")) {
      const aId = t.getAttribute("data-equip-sword-aura");
      const spec = WARDROBE_OPTIONS.swordAura.find(x => x.id === aId);
      if (!spec || !isSwordAuraUnlocked(spec)) {
        showToast(`需满足【${spec ? spec.unlockText : "轮回条件"}】方可解锁此剑意幻化！`);
        return;
      }
      if (!game) {
        showToast(`✦ 【${spec.name}】已解锁，进入游戏后自动或于万剑衣橱实时切换！`);
        return;
      }
      if (!game.cosmetics) game.cosmetics = { bladeSkin: "celadon", trailSkin: "ink_jade", footAura: "lotus_step", swordAura: "azure_jade" };
      game.cosmetics.swordAura = aId;
      Sound.clang(1.3, 0.10);
      showToast(`✨ 已佩带外显剑意幻化【${spec.name}】！`);
      saveGame(); updateHud();
      openHallOfLivesModal();
      return;
    }

    function startFreshGameSession(forceOverwriteCorrupt = false) {
      clearTransientChoiceQueues();
      sandboxMode = false;
      preSandboxSnapshot = null;
      practiceFormalSnapshot = null;
      saveReadOnlyMode = false;
      saveConflictState = null;
      storageWriteError = null;
      saveAlertDismissed = false;
      clearLoadedSaveMeta();
      loadedSaveLineage = generateSaveLineageId();
      const inp = document.getElementById("player-name-input");
      game = createFreshGame(inp ? inp.value : "顾长青", selectedPerkId, selectedCalamityTier);
      arena.stanceIdx = 0;
      resetPhotoModeOverlay({ resetCamera: true, skipCalmReeval: true });
      resetRuntimeCombatOverrides();
      arena.defeatPending = null;
      releasePauseToken(defeatPauseToken); defeatPauseToken = null;
      closeModal();
      document.getElementById("welcome-screen").style.display = "none";
      Sound.fanfare();
      initArenaStage(0, false);
      playCutscene("opening_scroll");
      focusBattlefield();
      const saved = saveGame({ forceOverwrite: true, userInitiated: true });
      renderHudSaveAlert();
      return saved;
    }

    if (t.id === "btn-start-new") {
      inspectSavedBundle();
      if (storageReadError) {
        renderWelcomeSaveStatusBanner();
        openCorruptedOverwriteConfirmModal();
        return;
      }
      startFreshGameSession(false);
      return;
    }
    if (t.id === "btn-continue-save") {
      const res = inspectSavedBundle();
      if (!res.ok || !res.bundle || !res.bundle.game) {
        renderWelcomeScreen();
        showToast("存档读取失败，系统已保留原数据，请查看主界面提示！");
        return;
      }
      clearTransientChoiceQueues();
      resetPhotoModeOverlay({ resetCamera: true, skipCalmReeval: true });
      arena.defeatPending = null;
      releasePauseToken(defeatPauseToken); defeatPauseToken = null;
      sandboxMode = false;
      preSandboxSnapshot = null;
      practiceFormalSnapshot = null;
      const s = res.bundle;
      const hadLegacyUnlockAll = Boolean(s.game && s.game.unlockAllArcana === true);
      recordLoadedSaveMeta(res);
      saveReadOnlyMode = false;
      saveConflictState = null;
      storageWriteError = null;
      saveAlertDismissed = false;
      game = normalizeLoadedGame(s.game);
      resetRuntimeCombatOverrides();
      arena.stanceIdx = ((Math.floor(num(s.stanceIdx, 0)) % SWORD_STANCES.length) + SWORD_STANCES.length) % SWORD_STANCES.length;
      arena.stageIdx = Math.max(0, Math.min(STAGES.length - 1, Math.floor(num(s.stageIdx, 0))));
      document.getElementById("welcome-screen").style.display = "none";
      if (s.sanctumMode) enterSanctumHub({ skipSave: true });
      else initArenaStage(arena.stageIdx, !!s.towerMode);
      if (res.legacy) {
        if (saveGame({ forceOverwrite: true })) {
          showToast("已兼容载入旧版存档并自动升级校验封装！");
        } else {
          lastSavedPayloadChecksum = computeCurrentPayloadChecksum();
        }
      } else {
        lastSavedPayloadChecksum = computeCurrentPayloadChecksum();
      }
      if (hadLegacyUnlockAll) {
        showToast("旧档中的【全神通演武】已升级为独立沙盒模式，可在右上【仙阁】随时开启！");
      }
      queueNewUnlockCardsForState(game);
      updateHud();
      renderHudSaveAlert();
      syncPendingRewardsBadge();
      focusBattlefield();
      requestCalmReevaluation();
      return;
    }

    if (t.hasAttribute("data-trib-start")) {
      const mode = t.getAttribute("data-trib-start");
      startLiveTribulation({ confirmed: true, mode });
      return;
    }
    if (t.hasAttribute("data-trib-craft-pill")) {
      const rid = t.getAttribute("data-trib-craft-pill");
      if (RECIPES[rid]) furnaceGame.recipeId = rid;
      closeModal();
      toggleDrawer("alchemy");
      return;
    }
    if (t.hasAttribute("data-trib-goto-boss")) {
      if (!guardNotInTribulation("前往讨伐妖王")) return;
      const targetStage = Math.max(0, Math.min(STAGES.length - 1, Math.floor(num(t.getAttribute("data-trib-goto-boss"), 0))));
      const act = CAMPAIGN_ACTS[targetStage] || CAMPAIGN_ACTS[0];
      const stg = STAGES[targetStage] || STAGES[0];
      closeModal();
      closeDrawer();
      const needStageSwitch = arena.sanctumMode || arena.towerMode
        || arena.stageIdx !== targetStage
        || (arena.bossRush && arena.bossRush.active)
        || (arena.celestialSpire && arena.celestialSpire.active)
        || (arena.cloudFlight && arena.cloudFlight.active)
        || (arena.sectDefense && arena.sectDefense.active);
      if (needStageSwitch) {
        initArenaStage(targetStage, false);
        saveGame();
        showToast(`⚔ 已御剑前往【${stg.name}】，推进星图击败【${act.bossName}】后即可引动天劫！`);
      } else {
        showToast(`⚔ 当前已在【${stg.name}】，继续推进至终层击败【${act.bossName}】即可引动天劫！`);
      }
      updateHud();
      return;
    }
    if (t.hasAttribute("data-defeat-act")) {
      resolveDefeatChoice(t.getAttribute("data-defeat-act"));
      return;
    }
    if (t.hasAttribute("data-defeat-nav")) {
      const targetTab = t.getAttribute("data-defeat-nav");
      const isTrib = t.getAttribute("data-defeat-trib") === "1" || !!(arena.defeatPending && arena.defeatPending.isTribulation);
      resolveDefeatChoice(isTrib ? "abort-tribulation" : "retreat-sanctum");
      if (!saveConflictState && (targetTab === "alchemy" || targetTab === "cultivate")) {
        if (!drawerOpen || currentTab !== targetTab) {
          toggleDrawer(targetTab);
        } else {
          renderDrawerContent();
          const panel = document.getElementById("jade-panel");
          if (panel) {
            panel.classList.add("drawer-open");
            focusDialogSafely(panel);
          }
        }
      }
      return;
    }

    const m1Act = t.getAttribute("data-action");
    if (m1Act === "interact-nearby-prop") {
      if (game && arena.nearbyProp) interactWithProp(arena.nearbyProp);
      return;
    }
    if (m1Act === "copy-corrupt-save-raw") {
      const rawTxt = storageReadError && storageReadError.raw ? storageReadError.raw : "";
      if (!rawTxt) { showToast("当前无可复制的受损存档原文"); return; }
      const origFocusEl = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : t;
      const fallbackCopy = () => {
        const prevActive = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : origFocusEl;
        let ta = null;
        try {
          ta = document.createElement("textarea");
          ta.value = rawTxt;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          showToast("已复制受损存档原文（本地原数据未修改）");
        } catch (e) {
          showToast("请手动在浏览器开发者工具查看本地存档键值");
        } finally {
          if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
          if (isElementFocusable(prevActive)) {
            try { prevActive.focus({ preventScroll: true }); } catch (e) {}
          } else {
            focusSaveAlertOrFallback("copy-corrupt-save-raw");
          }
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(rawTxt)
          .then(() => showToast("已复制受损存档原文（本地原数据未修改）"))
          .catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
      return;
    }
    if (m1Act === "prompt-overwrite-corrupt") {
      openCorruptedOverwriteConfirmModal();
      return;
    }
    if (m1Act === "confirm-overwrite-corrupt-new") {
      if (startFreshGameSession(true)) {
        showToast("已确认覆盖旧损坏存档并开启全新道途！");
      }
      return;
    }
    if (m1Act === "copy-corrupt-meta-raw") {
      const rawTxt = metaReadError && metaReadError.raw ? metaReadError.raw : "";
      if (!rawTxt) { showToast("当前无可复制的受损元存档原文"); return; }
      const origFocusEl = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : t;
      const fallbackCopy = () => {
        const prevActive = (document.activeElement && document.activeElement !== document.body) ? document.activeElement : origFocusEl;
        let ta = null;
        try {
          ta = document.createElement("textarea");
          ta.value = rawTxt;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          showToast("已复制受损元存档原文（本地原数据未修改）");
        } catch (e) {
          showToast("请手动在浏览器开发者工具查看本地元存档键值");
        } finally {
          if (ta && ta.parentNode) ta.parentNode.removeChild(ta);
          if (isElementFocusable(prevActive)) {
            try { prevActive.focus({ preventScroll: true }); } catch (e) {}
          } else {
            focusSaveAlertOrFallback("copy-corrupt-meta-raw");
          }
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(rawTxt)
          .then(() => showToast("已复制受损元存档原文（本地原数据未修改）"))
          .catch(fallbackCopy);
      } else {
        fallbackCopy();
      }
      return;
    }
    if (m1Act === "prompt-reset-corrupt-meta") {
      openCorruptedMetaResetConfirmModal();
      return;
    }
    if (m1Act === "confirm-reset-corrupt-meta") {
      const prevMetaReadError = metaReadError;
      const prevMetaSnap = JSON.parse(JSON.stringify(metaState));
      metaReadError = null;
      metaWriteError = null;
      const freshMeta = createDefaultMetaState();
      Object.keys(metaState).forEach(k => { if (!(k in freshMeta)) delete metaState[k]; });
      Object.assign(metaState, freshMeta);
      const resetOk = saveMeta({ forceReset: true });
      if (!resetOk) {
        metaReadError = prevMetaReadError;
        Object.keys(metaState).forEach(k => { if (!(k in prevMetaSnap)) delete metaState[k]; });
        Object.assign(metaState, prevMetaSnap);
        saveAlertDismissed = false;
        const errMsg = (metaWriteError && metaWriteError.message) ? metaWriteError.message : "元存档写入失败";
        renderWelcomeSaveStatusBanner();
        renderHudSaveAlert();
        const metaErrEl = document.getElementById("corrupt-meta-reset-error-msg");
        if (metaErrEl) {
          metaErrEl.textContent = `⚠ 元存档重置写入失败：${errMsg}（受损元存档已原样保留，请清理存储空间后重试）`;
          metaErrEl.style.display = "block";
        }
        const modalBoxMeta = document.getElementById("modal-content");
        if (modalBoxMeta && document.getElementById("modal-backdrop")?.classList.contains("open") && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
          focusDialogSafely(modalBoxMeta);
        }
        showToast(`⚠ 元存档重置写入失败：${errMsg}`);
        return;
      }
      // R2A-5: Re-render welcome banner / HUD save alert BEFORE closeModal() so detached trigger never drops focus to BODY!
      const ws = document.getElementById("welcome-screen");
      const onWelcomeNow = !game || (ws && ws.style.display !== "none");
      if (onWelcomeNow) {
        renderWelcomeScreen();
      } else {
        renderHudSaveAlert();
        updateHud();
      }
      closeModal();
      if (onWelcomeNow) {
        if (document.activeElement === document.body || !isElementFocusable(document.activeElement)) {
          restoreTriggerFocus(null);
        }
      } else {
        if (document.activeElement === document.body || !isElementFocusable(document.activeElement)) {
          focusSaveAlertOrFallback();
        }
      }
      showToast("已确认重置元存档并恢复写入。");
      return;
    }
    if (m1Act === "open-save-conflict") {
      openSaveConflictModal();
      return;
    }
    if (m1Act === "retry-save-now") {
      const alertEl = document.getElementById("hud-save-alert");
      const modalBackdrop = document.getElementById("modal-backdrop");
      if (storageReadError) {
        renderHudSaveAlert();
        showToast("⚠ 原受损存档仍保留，请点击【以本页覆盖】确认覆写，或先【复制受损原文】备份。", { critical: true });
        if (alertEl && alertEl.style.display !== "none" && document.activeElement === document.body) {
          const ovBtn = alertEl.querySelector('[data-action="overwrite-with-current-save"]');
          if (ovBtn && typeof ovBtn.focus === "function") ovBtn.focus({ preventScroll: true });
          else focusDialogSafely(alertEl);
        }
        return;
      }
      if (saveReadOnlyMode) {
        renderHudSaveAlert();
        showToast("⚠ 当前处于只读观览态，请点击【以本页覆盖】或【载入最新档】。", { critical: true });
        if (alertEl && alertEl.style.display !== "none" && document.activeElement === document.body) {
          const ovBtn = alertEl.querySelector('[data-action="overwrite-with-current-save"]');
          if (ovBtn && typeof ovBtn.focus === "function") ovBtn.focus({ preventScroll: true });
          else focusDialogSafely(alertEl);
        }
        return;
      }
      const savedOk = saveGame({ userInitiated: true });
      const isModalOpen = Boolean(modalBackdrop && modalBackdrop.classList.contains("open"));
      if (savedOk) {
        showToast(`本地存档已恢复写入（v${loadedSaveRev}）！`);
        if (!isModalOpen) {
          if (alertEl && alertEl.style.display !== "none") {
            focusSaveAlertOrFallback();
          } else if (cutscene.active) focusDialogSafely(document.getElementById("story-dialogue-bar"));
          else if (drawerOpen) focusDialogSafely(document.getElementById("jade-panel"));
          else restoreTriggerFocus(null);
        }
      } else if (!isModalOpen && alertEl && alertEl.style.display !== "none") {
        const retryBtn = alertEl.querySelector('[data-action="retry-save-now"]');
        if (retryBtn && typeof retryBtn.focus === "function") retryBtn.focus({ preventScroll: true });
        else focusDialogSafely(alertEl);
      }
      return;
    }
    if (m1Act === "retry-meta-save") {
      if (metaReadError) {
        renderHudSaveAlert();
        showToast("⚠ 原受损元存档仍保留，请点击【确认重置】处理或先【复制原文】备份。", { critical: true });
        focusSaveAlertOrFallback("prompt-reset-corrupt-meta");
        return;
      }
      if (saveReadOnlyMode) {
        renderHudSaveAlert();
        showToast("⚠ 当前处于只读观览态，已暂停写入元存档，请先【载入最新档】或【以本页覆盖】。", { critical: true });
        focusSaveAlertOrFallback("load-latest-save");
        return;
      }
      const metaSavedOk = saveMeta({ userInitiated: true });
      if (metaSavedOk) {
        showToast(`元存档已恢复写入（v${Number(metaState.metaRev) || 1}）！`);
        focusSaveAlertOrFallback();
      } else {
        focusSaveAlertOrFallback(metaReadError ? "prompt-reset-corrupt-meta" : "retry-meta-save");
      }
      return;
    }
    if (m1Act === "open-cloud-backup") {
      currentSysTab = "controls";
      openSettingsModal();
      return;
    }
    if (m1Act === "dismiss-save-alert") {
      saveAlertDismissed = true;
      renderHudSaveAlert();
      const alertEl = document.getElementById("hud-save-alert");
      const modalBackdrop = document.getElementById("modal-backdrop");
      const isModalOpen = Boolean(modalBackdrop && modalBackdrop.classList.contains("open"));
      if (!isModalOpen) {
        if (alertEl && alertEl.style.display !== "none") {
          focusSaveAlertOrFallback();
        } else if (cutscene.active) {
          focusDialogSafely(document.getElementById("story-dialogue-bar"));
        } else if (drawerOpen) {
          focusDialogSafely(document.getElementById("jade-panel"));
        } else {
          restoreTriggerFocus(null);
        }
      }
      return;
    }
    if (m1Act === "load-latest-save") {
      const res = inspectSavedBundle();
      if (!res.ok || !res.bundle || !res.bundle.game) {
        showToast("最新存档读取异常，保留本页只读态！", { critical: true });
        saveReadOnlyMode = true;
        saveConflictState = null;
        saveAlertDismissed = false;
        const modalBd = document.getElementById("modal-backdrop");
        if (modalBd && modalBd.classList.contains("open") && (activeModalKind === "save_conflict" || activeModalKind === "save_corrupt")) {
          closeModal();
        }
        renderHudSaveAlert();
        const bdNow = document.getElementById("modal-backdrop");
        if (!(bdNow && bdNow.classList.contains("open"))) {
          focusSaveAlertOrFallback(storageReadError ? "overwrite-with-current-save" : "load-latest-save");
        } else {
          const conflictErrEl = document.getElementById("save-conflict-error-msg");
          if (conflictErrEl) {
            const readMsg = (storageReadError && storageReadError.reason) ? storageReadError.reason : "最新存档读取异常";
            conflictErrEl.textContent = `⚠ 载入最新存档失败：${readMsg}（已保留本页只读态）`;
            conflictErrEl.style.display = "block";
          }
        }
        return;
      }
      clearTransientChoiceQueues();
      activeCustomSeedTempCurio = null;
      sandboxMode = false;
      preSandboxSnapshot = null;
      practiceFormalSnapshot = null;
      const s = res.bundle;
      recordLoadedSaveMeta(res);
      saveReadOnlyMode = false;
      saveConflictState = null;
      storageWriteError = null;
      saveAlertDismissed = false;
      game = normalizeLoadedGame(s.game);
      resetRuntimeCombatOverrides();
      arena.stanceIdx = ((Math.floor(num(s.stanceIdx, 0)) % SWORD_STANCES.length) + SWORD_STANCES.length) % SWORD_STANCES.length;
      arena.stageIdx = Math.max(0, Math.min(STAGES.length - 1, Math.floor(num(s.stageIdx, 0))));
      resetPhotoModeOverlay({ resetCamera: true, skipCalmReeval: true });
      arena.defeatPending = null;
      releasePauseToken(defeatPauseToken); defeatPauseToken = null;
      closeModal();
      closeDrawer();
      if (s.sanctumMode) enterSanctumHub({ skipSave: true });
      else initArenaStage(arena.stageIdx, !!s.towerMode);
      lastSavedPayloadChecksum = computeCurrentPayloadChecksum();
      updateHud();
      renderHudSaveAlert();
      showToast(`已同步最新标签页存档（v${res.rev}）并恢复自动保存！`);
      return;
    }
    if (m1Act === "stay-readonly-save") {
      saveReadOnlyMode = true;
      saveConflictState = null;
      saveAlertDismissed = false;
      renderHudSaveAlert();
      closeModal();
      const bdNow = document.getElementById("modal-backdrop");
      if (!(bdNow && bdNow.classList.contains("open")) && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
        focusSaveAlertOrFallback("load-latest-save");
      }
      showToast("已切入只读观览态：本页绝不会覆盖另一标签页的存档。");
      return;
    }
    if (m1Act === "overwrite-with-current-save") {
      if (sandboxMode) {
        showToast("🧪 演武沙盒模式禁止覆盖正式存档，请先点击【退出沙盒】！");
        return;
      }
      const prevReadOnly = saveReadOnlyMode;
      const prevConflict = saveConflictState;
      const modalBackdrop = document.getElementById("modal-backdrop");
      const isModalOpen = Boolean(modalBackdrop && modalBackdrop.classList.contains("open"));
      const shouldCloseModal = isModalOpen && (activeModalKind === "save_conflict" || activeModalKind === "save_corrupt");
      // R3A-1 + R4A-1/DEFECT-R3-2A: If invoked while in Practice Mode, atomically restore formal snapshot for overwrite,
      // and roll back full Practice state if saveGame() fails (e.g., QuotaExceededError / SecurityError)!
      const wasPractice = isPracticeModeActive() || !!practiceFormalSnapshot;
      let prevPracticeRollback = null;
      if (wasPractice) {
        prevPracticeRollback = {
          bossRush: arena.bossRush,
          celestialSpire: arena.celestialSpire,
          customSeedRun: arena.customSeedRun,
          stageIdx: arena.stageIdx,
          stanceIdx: arena.stanceIdx,
          towerMode: arena.towerMode,
          sanctumMode: arena.sanctumMode,
          practiceSnap: practiceFormalSnapshot ? JSON.parse(JSON.stringify(practiceFormalSnapshot)) : null,
          practiceGame: game ? JSON.parse(JSON.stringify(game)) : null,
          practiceMeta: JSON.parse(JSON.stringify(ensureMetaState())),
          tempCurio: activeCustomSeedTempCurio ? Object.assign({}, activeCustomSeedTempCurio) : null,
          lastSavedPayloadChecksum
        };
        restoreCustomSeedTempCurio();
        const snapRef = practiceFormalSnapshot;
        arena.bossRush = null;
        arena.celestialSpire = null;
        arena.customSeedRun = null;
        if (snapRef) {
          arena.stageIdx = Math.max(0, Math.min(STAGES.length - 1, Math.floor(num(snapRef.stageIdx, arena.stageIdx))));
          arena.stanceIdx = ((Math.floor(num(snapRef.stanceIdx, arena.stanceIdx)) % SWORD_STANCES.length) + SWORD_STANCES.length) % SWORD_STANCES.length;
          arena.towerMode = !!snapRef.towerMode;
          arena.sanctumMode = !!snapRef.sanctumMode;
        }
        endPracticeModeIsolation({ skipResetOverrides: true });
      }
      const savedOk = saveGame({ forceOverwrite: true, userInitiated: true });
      if (savedOk) {
        saveAlertDismissed = false;
        if (wasPractice && !sandboxMode && typeof resetRuntimeCombatOverrides === "function") {
          resetRuntimeCombatOverrides();
        }
        if (shouldCloseModal) closeModal();
        if (wasPractice) {
          enterSanctumHub({ skipSave: true });
          showToast(`已退出演武练习并以正式存档进度强制覆盖存档（v${loadedSaveRev}）！`, { critical: true });
        } else {
          showToast(`已以本页进度强制覆盖存档（v${loadedSaveRev}）！`, { critical: true });
        }
        if (!(modalBackdrop && modalBackdrop.classList.contains("open"))) {
          if (cutscene.active) focusDialogSafely(document.getElementById("story-dialogue-bar"));
          else if (drawerOpen) focusDialogSafely(document.getElementById("jade-panel"));
          else if (!document.activeElement || document.activeElement === document.body || !isElementFocusable(document.activeElement)) {
            restoreTriggerFocus(null);
          }
        }
      } else {
        if (wasPractice && prevPracticeRollback) {
          arena.bossRush = prevPracticeRollback.bossRush;
          arena.celestialSpire = prevPracticeRollback.celestialSpire;
          arena.customSeedRun = prevPracticeRollback.customSeedRun;
          arena.stageIdx = prevPracticeRollback.stageIdx;
          arena.stanceIdx = prevPracticeRollback.stanceIdx;
          arena.towerMode = prevPracticeRollback.towerMode;
          arena.sanctumMode = prevPracticeRollback.sanctumMode;
          practiceFormalSnapshot = prevPracticeRollback.practiceSnap;
          if (prevPracticeRollback.practiceGame) {
            const restoredPractice = normalizeLoadedGame(prevPracticeRollback.practiceGame);
            if (game && typeof game === "object") {
              Object.keys(game).forEach(k => { if (!(k in restoredPractice)) delete game[k]; });
              Object.assign(game, restoredPractice);
            } else {
              game = restoredPractice;
            }
          }
          activeCustomSeedTempCurio = prevPracticeRollback.tempCurio
            ? Object.assign({}, prevPracticeRollback.tempCurio, { targetGame: game })
            : null;
          if (prevPracticeRollback.practiceMeta) {
            Object.keys(metaState).forEach(k => { if (!(k in prevPracticeRollback.practiceMeta)) delete metaState[k]; });
            safeAssignPlain(metaState, prevPracticeRollback.practiceMeta);
            ensureMetaState();
          }
          lastSavedPayloadChecksum = prevPracticeRollback.lastSavedPayloadChecksum;
        }
        saveReadOnlyMode = prevReadOnly;
        saveConflictState = prevConflict;
        saveAlertDismissed = false;
        if (wasPractice && game) updateHud();
        renderHudSaveAlert();
        const modalStillOpen = Boolean(modalBackdrop && modalBackdrop.classList.contains("open"));
        if (modalStillOpen) {
          const conflictErrEl = document.getElementById("save-conflict-error-msg");
          if (conflictErrEl) {
            const errReason = (storageWriteError && storageWriteError.message)
              ? storageWriteError.message
              : (storageReadError && storageReadError.reason)
                ? storageReadError.reason
                : "本地存档写入失败";
            conflictErrEl.textContent = `⚠ 强制覆盖存档失败：${errReason}（已保留当前状态与原存档，请清理存储空间或选择只读态）`;
            conflictErrEl.style.display = "block";
          }
          if (document.activeElement === document.body || !isElementFocusable(document.activeElement)) {
            focusDialogSafely(document.getElementById("modal-content") || modalBackdrop);
          }
        } else {
          const alertEl = document.getElementById("hud-save-alert");
          if (alertEl && alertEl.style.display !== "none") {
            const ovBtn = alertEl.querySelector('[data-action="overwrite-with-current-save"]');
            if (ovBtn && typeof ovBtn.focus === "function") ovBtn.focus({ preventScroll: true });
            else focusDialogSafely(alertEl);
          }
        }
      }
      return;
    }
    if (m1Act === "return-title-safe") {
      // F07: Flush formal game (including game.pendingRewards) BEFORE clearing transient UI pointers!
      const wasSandbox = sandboxMode;
      const wasPractice = isPracticeModeActive();
      if (wasSandbox) {
        if (preSandboxSnapshot && preSandboxSnapshot.meta) {
          Object.keys(metaState).forEach(k => { if (!(k in preSandboxSnapshot.meta)) delete metaState[k]; });
          safeAssignPlain(metaState, preSandboxSnapshot.meta);
          ensureMetaState();
        }
        sandboxMode = false;
        preSandboxSnapshot = null;
      } else if (wasPractice || practiceFormalSnapshot) {
        endPracticeModeIsolation();
      } else if (game && !saveReadOnlyMode && !saveConflictState) {
        revertActivePendingRewardToPending();
        saveGame();
      }
      clearTransientChoiceQueues();
      activeCustomSeedTempCurio = null;
      game = null;
      practiceFormalSnapshot = null;
      lastSavedPayloadChecksum = null;
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
      releasePauseToken(defeatPauseToken); defeatPauseToken = null;
      arena.nearbyProp = null;
      arena.defeatPending = null;
      lastModalTriggerEl = null;
      lastDrawerTriggerEl = null;
      const sbBadge = document.getElementById("hud-sandbox-badge");
      if (sbBadge) sbBadge.style.display = "none";
      const ws = document.getElementById("welcome-screen");
      if (ws) ws.style.display = "flex";
      renderWelcomeScreen();
      closePavilionPopover();
      hideDojoControlBar();
      syncDojoTrainingHudVisibility();
      closeModal();
      closeDrawer();
      syncPendingRewardsBadge();
      restoreTriggerFocus(null);
      showToast(wasSandbox ? "已退出演武沙盒并返回标题主菜单（正式存档未受影响）！" : wasPractice ? "已结束演武练习并返回标题主菜单（正式存档未受影响）！" : "已保全当前进度并返回标题主菜单！");
      return;
    }
    if (m1Act === "confirm-reset-save") {
      const showSettingsSaveError = (msg) => {
        const errEl = document.getElementById("settings-save-error-msg");
        if (errEl) {
          errEl.textContent = msg;
          errEl.style.display = "block";
        }
        const modalBox = document.getElementById("modal-content");
        if (modalBox && document.getElementById("modal-backdrop")?.classList.contains("open") && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
          focusDialogSafely(modalBox);
        }
      };
      if (sandboxMode) {
        const msg = "🧪 演武沙盒模式中不可清空正式存档，请先点击【退出沙盒】！";
        showSettingsSaveError(msg);
        showToast(msg);
        return;
      }
      if (storageReadError) {
        saveAlertDismissed = false;
        renderWelcomeSaveStatusBanner();
        renderHudSaveAlert();
        const msg = "⚠ 检测到本地受损主存档尚未处理，已拒绝清空存档并保留原数据！请先备份原文或通过受损存档流程处理。";
        showSettingsSaveError(msg);
        showToast(msg);
        return;
      }
      if (saveReadOnlyMode || saveConflictState) {
        renderHudSaveAlert();
        const msg = saveConflictState
          ? "⚠ 存在未处理的多标签页存档冲突，已拒绝清空存档！请先处理冲突。"
          : "⚠ 当前处于只读观览态，已拒绝清空存档以免误删另一标签页的进度！";
        showSettingsSaveError(msg);
        showToast(msg);
        return;
      }
      try {
        const curRaw = localStorage.getItem(STORAGE_KEY);
        if (curRaw !== null && curRaw !== "") {
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
            const msg = `⚠ 检测到本地主存档已损坏（${storageReadError.reason}），已中止清空操作并保留原数据！`;
            showSettingsSaveError(msg);
            showToast("⚠ 检测到本地主存档已损坏，已中止清空操作并保留原数据！");
            return;
          }
          if (isForeignSaveConflict(curRes)) {
            triggerSaveConflict(curRes, true);
            showToast("⚠ 检测到另一标签页更新了存档，已中止清空操作！");
            return;
          }
        }
      } catch (e) {}
      openModal(`
        <div class="drawer-mural-banner" style="height:80px;">
          <img src="${ART.banner_archive}" alt="清空存档确认" />
          <div class="drawer-mural-overlay">
            <div>
              <span class="cinnabar-seal">谨慎确认</span>
              <h2 style="font-family:var(--font-serif);font-size:20px;color:#ffb4ae;margin-top:4px;">确认清空当前本地存档？</h2>
            </div>
            <button type="button" class="btn-ghost" data-modal-close="1">取消 ✕</button>
          </div>
        </div>
        <p style="font-size:12.5px;color:var(--text-main);line-height:1.6;">
          清空后将删除当前修途进度并返回标题界面（轮回飞升累世功德与最高纪录仍保留）。若仅想返回标题，请点击“取消”并选择“保存并返回标题主菜单”。
        </p>
        <div id="reset-save-error-msg" role="alert" aria-live="assertive" style="display:none;margin-top:8px;padding:8px 10px;border-radius:8px;background:rgba(92,22,22,0.88);border:1px solid rgba(255,120,112,0.8);color:#ffd5d0;font-size:12px;line-height:1.5;"></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
          <button type="button" class="btn-ghost" data-modal-close="1">取消保留</button>
          <button type="button" class="btn-gold" style="background:linear-gradient(135deg,#8c2222,#cc483c);color:#fff;" data-action="execute-reset-save">确认清空存档</button>
        </div>
      `, true);
      return;
    }
    if (m1Act === "execute-reset-save") {
      if (sandboxMode) {
        closeModal();
        showToast("🧪 演武沙盒模式中不可清空正式存档，请先点击【退出沙盒】！");
        return;
      }
      if (storageReadError) {
        closeModal();
        saveAlertDismissed = false;
        renderWelcomeSaveStatusBanner();
        renderHudSaveAlert();
        showToast("⚠ 检测到本地受损主存档尚未处理，已拒绝清空存档并保留原数据！");
        return;
      }
      if (saveReadOnlyMode || saveConflictState) {
        closeModal();
        renderHudSaveAlert();
        showToast(saveConflictState
          ? "⚠ 存在未处理的多标签页存档冲突，已拒绝清空存档！请先处理冲突。"
          : "⚠ 当前处于只读观览态，已拒绝清空存档以免误删另一标签页的进度！");
        return;
      }
      try {
        const curRaw = localStorage.getItem(STORAGE_KEY);
        if (curRaw !== null && curRaw !== "") {
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
            closeModal();
            renderWelcomeSaveStatusBanner();
            renderHudSaveAlert();
            showToast("⚠ 检测到本地主存档已损坏，已中止清空操作并保留原数据！");
            return;
          }
          if (isForeignSaveConflict(curRes)) {
            closeModal();
            triggerSaveConflict(curRes, true);
            showToast("⚠ 检测到另一标签页更新了存档，已中止清空操作！");
            return;
          }
        }
      } catch (e) {}
      const rmRes = removePrimarySaveVerified();
      if (!rmRes.ok) {
        storageWriteError = { message: `清空存档失败：${rmRes.message}`, at: Date.now() };
        saveAlertDismissed = false;
        renderHudSaveAlert();
        const resetErrEl = document.getElementById("reset-save-error-msg");
        if (resetErrEl) {
          resetErrEl.textContent = `⚠ 无法清空本地存档：${rmRes.message}（原存档仍保留，未返回标题页）`;
          resetErrEl.style.display = "block";
        }
        showToast(`⚠ 无法清空本地存档：${rmRes.message}（原存档仍保留，未返回标题页）！`, { critical: true, key: "save_remove_err", throttleMs: 0 });
        const modalBox = document.getElementById("modal-content");
        if (modalBox && document.getElementById("modal-backdrop")?.classList.contains("open")) {
          focusDialogSafely(modalBox);
        }
        return;
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
      storageReadError = null;
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
      releasePauseToken(defeatPauseToken); defeatPauseToken = null;
      arena.nearbyProp = null;
      arena.defeatPending = null;
      lastModalTriggerEl = null;
      lastDrawerTriggerEl = null;
      const wsReset = document.getElementById("welcome-screen");
      if (wsReset) wsReset.style.display = "flex";
      renderWelcomeScreen();
      closePavilionPopover();
      hideDojoControlBar();
      syncDojoTrainingHudVisibility();
      closeModal();
      closeDrawer();
      syncPendingRewardsBadge();
      pendingCompareGear = null;
      renderGearCompareCard();
      restoreTriggerFocus(null);
      showToast("已清空当前本地存档。");
      return;
    }

    // ==================== M2 CLICK HANDLERS ====================
    if (m1Act === "open-dungeon-map") {
      openDungeonMapModal();
      return;
    }
    if (t.hasAttribute("data-dungeon-node")) {
      enterDungeonNode(t.getAttribute("data-dungeon-node"));
      return;
    }
    if (t.hasAttribute("data-pick-run-boon")) {
      applyPickedRunBoon(t.getAttribute("data-pick-run-boon"));
      return;
    }
    if (m1Act === "reroll-run-boon") {
      openRunBoonDraftModal(arena.pendingBoonNodeId || null, true);
      return;
    }
    if (["compare-equip-transfer", "compare-equip-direct", "compare-smelt-new", "compare-keep-bag"].includes(m1Act)) {
      if (compareCardClickGuardUntil && performance.now() < compareCardClickGuardUntil) {
        return; // F13: 250ms reveal click-guard blocks accidental combat click-through!
      }
    }
    if (m1Act === "compare-equip-transfer" && pendingCompareGear && game) {
      const targetItem = pendingCompareGear;
      const res = equipGearWithOptionalTransfer(targetItem, true);
      Sound.clang(1.3, 0.12);
      Sound.fanfare();
      showToast(res && res.transferredLvl > 0
        ? `★ 已换装【${targetItem.name} +${res.transferredLvl}】并无损继承淬火等级！`
        : `★ 已换装【${targetItem.name}】！`);
      const bdCmp = document.getElementById("modal-backdrop");
      if (!(bdCmp && bdCmp.classList.contains("open")) && !drawerOpen && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
        restoreTriggerFocus(null);
      }
      return;
    }
    if (m1Act === "compare-equip-direct" && pendingCompareGear && game) {
      const targetItem = pendingCompareGear;
      equipGearWithOptionalTransfer(targetItem, false);
      Sound.clang(1.2, 0.10);
      showToast(`★ 已直接换装【${targetItem.name}】，旧装备已移入行囊！`);
      const bdCmp = document.getElementById("modal-backdrop");
      if (!(bdCmp && bdCmp.classList.contains("open")) && !drawerOpen && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
        restoreTriggerFocus(null);
      }
      return;
    }
    if (m1Act === "compare-smelt-new" && pendingCompareGear && game) {
      const targetItem = pendingCompareGear;
      const itemKey = targetItem.uid || targetItem.name;
      const gain = Math.max(1, Math.floor(num(targetItem.sell, 15)));
      const now = performance.now();
      if (!compareSmeltConfirm || compareSmeltConfirm.key !== itemKey || now >= compareSmeltConfirm.expiresAt) {
        // F13 Step 1: Arm 2-step confirmation (4s auto-reset) showing exact item name, stats & stone yield.
        clearCompareSmeltConfirm();
        const timer = setTimeout(() => {
          const cardEl = document.getElementById("gear-compare-card");
          const hadFocusInCard = Boolean(cardEl && cardEl.contains(document.activeElement));
          compareSmeltConfirm = null;
          renderGearCompareCard();
          if (hadFocusInCard && (!cardEl || !cardEl.contains(document.activeElement))) {
            const resetBtn = document.querySelector('#gear-compare-card [data-action="compare-smelt-new"]');
            if (resetBtn && isElementFocusable(resetBtn)) {
              try { resetBtn.focus({ preventScroll: true }); } catch (e) {}
            } else {
              restoreTriggerFocus(null);
            }
          }
        }, 4000);
        compareSmeltConfirm = { key: itemKey, expiresAt: now + 4000, timer };
        renderGearCompareCard();
        const armedBtn = document.querySelector('#gear-compare-card [data-action="compare-smelt-new"]');
        if (armedBtn && isElementFocusable(armedBtn)) {
          try { armedBtn.focus({ preventScroll: true }); } catch (e) {}
        }
        showToast(`⚠ 请再次点击确认熔炼【${targetItem.name}】(+${gain} 灵石)`, { tier: 1, key: "smelt_confirm_arm", throttleMs: 800 });
        return;
      }
      clearCompareSmeltConfirm();
      const bIdx = game.gearBag.indexOf(targetItem);
      if (bIdx >= 0) game.gearBag.splice(bIdx, 1);
      game.stones += gain;
      pendingCompareGear = null;
      renderGearCompareCard();
      Sound.qiOrb(3);
      saveGame();
      updateHud();
      showToast(`已确认熔炼【${targetItem.name}】· 获灵石 +${gain}！`);
      const bdCmp = document.getElementById("modal-backdrop");
      if (!(bdCmp && bdCmp.classList.contains("open")) && !drawerOpen && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
        restoreTriggerFocus(null);
      }
      return;
    }
    if (m1Act === "compare-keep-bag") {
      dismissGearCompareCard();
      showToast("新仙装已妥善留存行囊，随时可在【行囊】中换装或熔炼。");
      const bdCmp = document.getElementById("modal-backdrop");
      if (!(bdCmp && bdCmp.classList.contains("open")) && !drawerOpen && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
        restoreTriggerFocus(null);
      }
      return;
    }
    if (t.hasAttribute("data-equip-bag-transfer") && game) {
      const idx = Number(t.getAttribute("data-equip-bag-transfer"));
      const it = game.gearBag[idx];
      if (!it) return;
      const res = equipGearWithOptionalTransfer(it, true);
      Sound.clang(1.3, 0.12);
      Sound.fanfare();
      showToast(res && res.transferredLvl > 0
        ? `★ 已换装【${it.name} +${res.transferredLvl}】并无损继承淬火！`
        : `★ 已换装【${it.name}】！`);
      renderDrawerContent();
      return;
    }

    // ==================== M3 CLICK HANDLERS ====================
    if (m1Act === "open-sanctum-upgrade") {
      openSanctumUpgradeModal();
      return;
    }
    if (t.hasAttribute("data-upgrade-sanctum")) {
      upgradeSanctumBuilding(t.getAttribute("data-upgrade-sanctum"));
      return;
    }
    if (t.hasAttribute("data-open-comp-modal")) {
      openCompanionInteractModal(t.getAttribute("data-open-comp-modal"));
      return;
    }
    if (t.hasAttribute("data-comp-act")) {
      triggerCompanionHubAction(t.getAttribute("data-comp-npc"), t.getAttribute("data-comp-act"));
      return;
    }
    if (t.hasAttribute("data-play-story-bar")) {
      playStoryEventInPortraitBar(t.getAttribute("data-play-story-bar"));
      return;
    }
    if (t.hasAttribute("data-story-bar-id")) {
      resolveStoryChoice(t.getAttribute("data-story-bar-id"), t.getAttribute("data-story-bar-opt"), true);
      return;
    }
    if (t.hasAttribute("data-buy-karma-item")) {
      buyKarmaSpecialItem(t.getAttribute("data-buy-karma-item"));
      return;
    }

    if (t.id === "btn-sanctum-hub" || t.getAttribute("data-action") === "enter-sanctum") {
      if (!game || isWelcomeScreenVisible()) return;
      if (!guardNotInTribulation("往返洞府与秘境")) return;
      closeModal();
      closeDrawer();
      if (arena.sanctumMode) initArenaStage(arena.stageIdx, false);
      else enterSanctumHub();
      return;
    }

    if (t.hasAttribute("data-sys-tab")) {
      currentSysTab = t.getAttribute("data-sys-tab");
      openSettingsModal();
      return;
    }
    if (t.hasAttribute("data-claim-ach")) {
      if (!guardNotInTribulation("领取成就赏赐")) return;
      if (!guardNotPracticeMode("领取成就赏赐")) return;
      const aid = t.getAttribute("data-claim-ach");
      const spec = ACHIEVEMENTS.find(a => a.id === aid);
      if (spec && game && game.achievements.includes(aid) && !game.claimedAchievements.includes(aid)) {
        const reward = Math.round(spec.pts * 0.5);
        game.claimedAchievements.push(aid);
        game.stones += reward;
        Sound.fanfare();
        showToast(`领取成就赏赐 +${reward} 灵石！`);
        saveGame(); updateHud(); openSettingsModal();
      }
      return;
    }

    if (t.hasAttribute("data-buy-gear")) {
      if (!guardNotInTribulation("百宝坊购装")) return;
      if (!guardNotPracticeMode("百宝坊购装")) return;
      const idx = Number(t.getAttribute("data-buy-gear"));
      const it = game.marketStock[idx];
      if (!it) return;
      const ksBuy = getKarmaState(game);
      const disc = (currentOmen(game).id === "fair" ? 0.8 : 1.0) * (ksBuy.mode === "righteous" ? 0.9 : 1.0);
      const cost = Math.round(it.price * disc);
      if (game.stones < cost) { showToast(`需 ${cost} 灵石`); return; }
      game.stones -= cost;
      game.marketStock.splice(idx, 1);
      Sound.fanfare();
      acquireGearItem(it);
      renderDrawerContent();
      return;
    }
    if (t.hasAttribute("data-equip-bag")) {
      const idx = Number(t.getAttribute("data-equip-bag"));
      const it = game.gearBag[idx];
      if (!it) return;
      const prev = game.equippedGear[it.slot];
      game.gearBag.splice(idx, 1);
      if (prev) game.gearBag.push(prev);
      game.equippedGear[it.slot] = it;
      syncFlyingSwords();
      Sound.clang(1.2, 0.1);
      saveGame(); updateHud(); renderDrawerContent();
      return;
    }
    if (t.getAttribute("data-action") === "smelt-all-gear") {
      if (!guardNotInTribulation("一键熔炼行囊")) return;
      if (!guardNotPracticeMode("一键熔炼行囊")) return;
      if (!game.gearBag.length) return;
      const gained = game.gearBag.reduce((s, x) => s + (x.sell || 15), 0);
      const count = game.gearBag.length;
      game.gearBag = [];
      game.stones += gained;
      const wantAtk = Math.max(1, Math.floor(count / 2));
      const bonusRes = grantPermanentStatBonus(game, { atk: wantAtk, source: "general" });
      Sound.fanfare();
      showToast(bonusRes.grantedAtk > 0
        ? `熔炼 ${count} 件闲置仙装 · 获 ${gained} 灵石，剑攻永久 +${bonusRes.grantedAtk}${bonusRes.atkCapped ? `（已达本境上限 ${game.atkFlatBonus}/${bonusRes.caps.atkFlatBonus}）` : ""}！`
        : `熔炼 ${count} 件闲置仙装 · 获 ${gained} 灵石（本境永久剑攻已达上限 ${game.atkFlatBonus}/${bonusRes.caps.atkFlatBonus}）！`);
      saveGame(); updateHud(); renderDrawerContent();
      return;
    }
    if (t.getAttribute("data-action") === "refresh-market") {
      if (game.stones < 15) { showToast("刷新百宝阁需 15 灵石"); return; }
      game.stones -= 15;
      refreshMarketStock();
      Sound.qiOrb(3);
      saveGame(); updateHud(); renderDrawerContent();
      return;
    }

    if (t.id === "btn-sanqing-clones" || t.getAttribute("data-action") === "cast-sanqing-clones") {
      triggerSanqingTriClones();
      return;
    }
    if (t.id === "btn-shanhe-domain" || t.getAttribute("data-action") === "cast-shanhe-domain") {
      castShanheShejiDomain();
      return;
    }
    if (t.id === "btn-warship-strike" || t.getAttribute("data-action") === "cast-warship-strike") {
      triggerWarshipOrbitalStrike();
      return;
    }
    if (t.getAttribute("data-action") === "cast-warship-from-modal") {
      closeModal();
      triggerWarshipOrbitalStrike();
      return;
    }
    if (t.getAttribute("data-action") === "open-sequencer") {
      openComboSequencerModal();
      return;
    }
    if (t.id === "btn-toggle-seq-enable" || t.getAttribute("data-action") === "toggle-seq-enable") {
      const seq = ensureCustomComboSeq(game);
      seq.enabled = !seq.enabled;
      Sound.switchStanceChime(seq.enabled);
      showToast(seq.enabled ? "🎼 已启用【太虚混元自创剑谱】！左键1~4段将实时无缝幻化三器出招！" : "已切回单一兵器标准四段连招");
      saveGame();
      syncV24GenesisDock();
      openComboSequencerModal();
      return;
    }
    if (t.hasAttribute("data-seq-preset")) {
      const pid = t.getAttribute("data-seq-preset");
      const pr = COMBO_SEQ_PRESETS.find(x => x.id === pid);
      if (pr && game) {
        const seq = ensureCustomComboSeq(game);
        seq.slots = pr.slots.slice();
        seq.enabled = true;
        Sound.fanfare();
        showToast(`🎼 已载入【${pr.name}】并启用实时三器幻化连段！`);
        saveGame();
        syncV24GenesisDock();
        openComboSequencerModal();
      }
      return;
    }
    if (t.getAttribute("data-action") === "open-expedition") {
      openExpeditionSandboxModal();
      return;
    }
    if (t.hasAttribute("data-recall-exp-node")) {
      if (game) {
        assignExpeditionNode(game, t.getAttribute("data-recall-exp-node"), "");
        openExpeditionSandboxModal();
      }
      return;
    }
    if (t.id === "btn-claim-expedition" || t.getAttribute("data-action") === "claim-expedition") {
      claimExpeditionRewards();
      return;
    }
    if (t.id === "btn-export-cloud-save" || t.getAttribute("data-action") === "copy-cloud-save") {
      if (sandboxMode) {
        showToast("🧪 演武沙盒模式已禁用云码导出与导入（请先退出沙盒）");
        return;
      }
      const inp = document.getElementById("inp-cloud-save-code");
      if (inp) {
        inp.value = exportFullCloudSaveCode();
        inp.select();
        try { document.execCommand("copy"); } catch (e) {}
        const stEl = document.getElementById("lbl-cloud-save-status");
        if (stEl) stEl.textContent = "已复制全存档云码 ✓";
        showToast("📋 已复制 Base64 太虚大道全存档云码！");
      }
      return;
    }
    if (t.id === "btn-import-cloud-save" || t.getAttribute("data-action") === "import-cloud-save") {
      const showImportRefusal = (msg) => {
        const stEl = document.getElementById("lbl-cloud-save-status");
        if (stEl) { stEl.textContent = `${msg} ✕`; stEl.style.color = "#ff6b6b"; }
        const errEl = document.getElementById("settings-save-error-msg");
        if (errEl) {
          errEl.textContent = msg;
          errEl.style.display = "block";
        }
        const modalBox = document.getElementById("modal-content");
        if (modalBox && document.getElementById("modal-backdrop")?.classList.contains("open") && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
          focusDialogSafely(modalBox);
        }
      };
      if (sandboxMode) {
        const msg = "🧪 演武沙盒模式已禁用云码导出与导入（请先退出沙盒）";
        showImportRefusal(msg);
        showToast(msg);
        return;
      }
      const inp = document.getElementById("inp-cloud-save-code");
      const parsedRes = parseCloudSaveCode(inp ? inp.value : "");
      const stEl = document.getElementById("lbl-cloud-save-status");
      if (!parsedRes.ok) {
        if (stEl) { stEl.textContent = `${parsedRes.reason} ✕`; stEl.style.color = "#ff6b6b"; }
        const errEl = document.getElementById("settings-save-error-msg");
        if (errEl) {
          errEl.textContent = `⚠ ${parsedRes.reason}`;
          errEl.style.display = "block";
        }
        showToast(`⚠ ${parsedRes.reason}`);
      } else {
        const opened = openCloudImportConfirmModal(parsedRes);
        if (opened === false) {
          const reason = arena && arena.tribulation
            ? "⚡ 正在九霄紫霄雷劫渡劫中，无法导入云码存档！"
            : isPracticeModeActive()
              ? "⚔ 演武练习模式中禁止导入云码存档，请先按 H 返回听雨洞府！"
              : "⚠ 当前状态暂不可导入云码存档";
          showImportRefusal(reason);
        }
      }
      return;
    }
    if (t.getAttribute("data-action") === "cancel-cloud-import") {
      pendingCloudImport = null;
      currentSysTab = "controls";
      openSettingsModal();
      return;
    }
    if (t.id === "btn-confirm-cloud-import" || t.getAttribute("data-action") === "confirm-cloud-import") {
      const req = pendingCloudImport;
      const res = commitCloudSaveImport(req);
      if (res.ok) {
        pendingCloudImport = null;
        closeModal();
      } else {
        const errEl = document.getElementById("cloud-import-error-msg");
        if (errEl) {
          errEl.textContent = `导入失败：${res.reason}`;
          errEl.style.display = "block";
        }
      }
      return;
    }
    if (t.id === "btn-coop-2p" || t.getAttribute("data-action") === "toggle-coop-2p") {
      if (photoMode.active || arena.paused) return;
      toggleLocalCoop2P();
      return;
    }
    if (t.id === "btn-celestial-time" || t.getAttribute("data-action") === "cycle-celestial-time") {
      if (photoMode.active || arena.paused) return;
      cycleCelestialTimePhase();
      return;
    }
    if (t.getAttribute("data-action") === "cycle-celestial-time-in-modal") {
      if (cycleCelestialTimePhase({ allowInModal: true })) openStarChartModal();
      return;
    }
    if (t.getAttribute("data-action") === "open-vol5-resonance") {
      openVol5ResonanceFlow();
      return;
    }
    if (t.getAttribute("data-action") === "ws-replay-seed") {
      launchCustomSeedEncounter(t.getAttribute("data-ws-seed") || null);
      return;
    }
    if (t.id === "btn-comic-scroll" || t.getAttribute("data-action") === "open-comic-scroll") {
      openComicBattleScrollModal();
      return;
    }
    if (t.id === "btn-snap-comic-now" || t.getAttribute("data-action") === "snap-comic-now") {
      closeModal();
      captureBattleHighlightFrame("太虚留影", "手绘瞬息·剑意定格帧", getCombatStats(game).atk * 3, 5);
      openComicBattleScrollModal();
      return;
    }
    if (t.id === "btn-export-comic-png" || t.getAttribute("data-action") === "export-comic-png") {
      exportComicBattleScrollPng();
      return;
    }
    if (t.hasAttribute("data-craft-open")) {
      if (!canRefillGourdInAlchemyDrawer()) {
        showToast(arena.tribulation
          ? "⚡ 正在渡劫中，无法开启【太虚百工炉鼎】！"
          : "🔥 请先按 H 返回【听雨洞府】静息状态，再开启八卦炼丹 / 星火锻剑！", { critical: true });
        return;
      }
      openTaixuCraftMinigameModal(t.getAttribute("data-craft-open"));
      return;
    }
    if (t.hasAttribute("data-craft-mode")) {
      openTaixuCraftMinigameModal(t.getAttribute("data-craft-mode"));
      return;
    }
    if (t.id === "btn-craft-strike" || t.getAttribute("data-action") === "craft-strike") {
      strikeTaixuCraftMinigame(false);
      return;
    }
    if (t.hasAttribute("data-equip-mount")) {
      game.equippedMount = t.getAttribute("data-equip-mount");
      if (arena.mountState && arena.mountState.active) arena.mountState.mountId = game.equippedMount;
      Sound.qiOrb(4);
      showToast(`🐎 已切换山海灵骑【${MYTHIC_MOUNTS[game.equippedMount].name}】（按 J 键呼哨冲锋）！`);
      syncV22TacticalDock(); saveGame(); updateHud();
      if (drawerOpen) renderDrawerContent();
      return;
    }
    if (t.getAttribute("data-action") === "open-workshop") {
      openCustomWorkshopModal();
      return;
    }
    if (t.hasAttribute("data-ws-affix")) {
      const bit = Number(t.getAttribute("data-ws-affix"));
      workshopState.affixes ^= (1 << bit);
      openCustomWorkshopModal();
      return;
    }
    if (t.id === "btn-copy-seed" || t.getAttribute("data-action") === "ws-copy-seed") {
      const inp = document.getElementById("inp-workshop-seed");
      if (inp) {
        inp.select();
        try { document.execCommand("copy"); } catch (e) {}
        const stEl = document.getElementById("ws-seed-status");
        if (stEl) stEl.textContent = "已复制论剑码 ✓";
        showToast(`📋 已复制太虚论剑码：${inp.value}`);
      }
      return;
    }
    if (t.id === "btn-import-seed" || t.getAttribute("data-action") === "ws-import-seed") {
      const inp = document.getElementById("inp-workshop-seed");
      const parsed = inp ? decodeWorkshopSeed(inp.value) : null;
      const stEl = document.getElementById("ws-seed-status");
      if (!parsed) {
        if (stEl) { stEl.textContent = "格式或校验码无效 ✕"; stEl.style.color = "#ff6b6b"; }
        showToast("⚠ 论剑码校验失败，请输入形如 CY22-02-23-01-XX 的有效太虚论剑码！");
        return;
      }
      safeAssignPlain(workshopState, parsed);
      Sound.fanfare();
      openCustomWorkshopModal();
      showToast(`📥 论剑码解析成功！已还原双王配置与劫律奇物！`);
      return;
    }
    if (t.id === "btn-launch-workshop" || t.getAttribute("data-action") === "ws-launch") {
      const inp = document.getElementById("inp-workshop-seed");
      launchCustomSeedEncounter(inp ? inp.value : null);
      return;
    }
    if (t.id === "btn-test-stems" || t.getAttribute("data-action") === "test-jiushao-stems") {
      Sound.pluck(523.25, 0.45, 0.11, "triangle");
      Sound.bianzhong(659.25, 0.09);
      Sound.drum(0.22);
      Sound.clang(1.25, 0.10);
      return;
    }
    if (t.id === "btn-dual-bond-ult" || t.getAttribute("data-action") === "cast-dual-bond-ult") {
      castDualHeroBondUltimate();
      return;
    }
    if (t.getAttribute("data-action") === "start-cloud-sea") {
      startCloudSeaAerialStage();
      return;
    }
    if (t.getAttribute("data-action") === "open-celestial-spire") {
      openCelestialSpireModal();
      return;
    }
    if (t.hasAttribute("data-start-spire")) {
      startCelestialSpireRun(Number(t.getAttribute("data-start-spire")) || 1);
      return;
    }
    if (t.hasAttribute("data-pick-curio")) {
      selectSpireCurioAndAdvance(t.getAttribute("data-pick-curio"), Number(t.getAttribute("data-curio-gain")) || 1);
      return;
    }
    if (t.hasAttribute("data-codex-pick")) {
      codexSelectedId = t.getAttribute("data-codex-pick");
      codexDemoAnimT = 0;
      openSettingsModal();
      return;
    }
    if (t.id === "btn-codex-play-demo" || t.getAttribute("data-action") === "codex-play-demo") {
      codexDemoAnimT = 0;
      Sound.slash(true, 2);
      return;
    }
    if (t.hasAttribute("data-lock-titan-part")) {
      arena.lockedTitanPart = t.getAttribute("data-lock-titan-part");
      updateBossBannerAndRecallOrb();
      return;
    }
    if (t.id === "titan-climb-btn" || t.getAttribute("data-action") === "titan-climb-finisher") {
      const colT = arena.enemies.find(e => e.isTitan && e.hp > 0);
      if (colT) triggerTitanClimbFinisher(colT);
      return;
    }
    if (t.hasAttribute("data-switch-char")) {
      triggerTagTeamSwitch(t.getAttribute("data-switch-char"));
      return;
    }
    if (t.getAttribute("data-action") === "trigger-tag-switch") {
      triggerTagTeamSwitch();
      if (drawerOpen) renderDrawerContent();
      return;
    }
    if (t.getAttribute("data-action") === "cycle-weapon-form") {
      cycleWeaponArsenalForm();
      return;
    }
    if (t.hasAttribute("data-weapon-form")) {
      cycleWeaponArsenalForm(t.getAttribute("data-weapon-form"));
      return;
    }
    if (t.getAttribute("data-action") === "start-sect-defense") {
      startSectDefenseSiege();
      return;
    }
    if (t.getAttribute("data-action") === "toggle-a11y-cb") {
      a11ySettings.colorblindGlyphs = !a11ySettings.colorblindGlyphs;
      saveA11ySettings(); openSettingsModal();
      return;
    }
    if (t.getAttribute("data-action") === "toggle-a11y-autocombo") {
      a11ySettings.autoComboAssist = !a11ySettings.autoComboAssist;
      saveA11ySettings(); openSettingsModal();
      return;
    }
    if (t.getAttribute("data-action") === "toggle-a11y-reduced-motion") {
      a11ySettings.reducedMotion = !a11ySettings.reducedMotion;
      if (a11ySettings.reducedMotion) {
        a11ySettings.shakeScale = 0;
        a11ySettings.hitStopScale = 0;
      }
      applyReducedMotionClass();
      saveA11ySettings(); openSettingsModal();
      return;
    }
    if (t.getAttribute("data-action") === "toggle-a11y-visual-layers") {
      a11ySettings.enhancedVisualLayers = !a11ySettings.enhancedVisualLayers;
      saveA11ySettings(); openSettingsModal();
      return;
    }
    if (t.getAttribute("data-action") === "export-playtest-telemetry") {
      const payload = exportPlaytestSessionJson();
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
          navigator.clipboard.writeText(payload).catch(() => {});
        }
      } catch (e) {}
      Sound.noticeCue(2);
      showToast(`📋 已生成本次试玩观察 JSON（${payload.length} 字节，纯内存采样）`, { tier: 2, key: "export_playtest", throttleMs: 1200 });
      return;
    }
    if (t.hasAttribute("data-set-notice-level")) {
      const nl = t.getAttribute("data-set-notice-level");
      if (["full", "lite", "minimal"].includes(nl)) {
        a11ySettings.combatNoticeLevel = nl;
        saveA11ySettings();
        openSettingsModal();
      }
      return;
    }
    if (t.id === "btn-star-chart" || t.getAttribute("data-action") === "open-star-chart") { openStarChartModal(); return; }
    if (t.getAttribute("data-action") === "buy-star-point") {
      if (!guardNotInTribulation("凝炼星魂点")) return;
      if (!guardNotPracticeMode("凝炼星魂点")) return;
      if (game.stones < 60) { showToast("凝炼星魂需 60 灵石"); return; }
      game.stones -= 60;
      game.bonusStarPts = (game.bonusStarPts || 0) + 1;
      Sound.qiOrb(4);
      saveGame(); updateHud(); openStarChartModal();
      return;
    }
    if (t.hasAttribute("data-light-star")) {
      if (!guardNotInTribulation("二十八星宿点星")) return;
      if (!guardNotPracticeMode("二十八星宿点星")) return;
      const mid = t.getAttribute("data-light-star");
      if (!Array.isArray(game.litStars)) game.litStars = [];
      if (game.litStars.includes(mid)) return;
      const pts = getAvailableStarPoints(game);
      if (pts <= 0) {
        showToast("星魂点不足！请点击上方【✨ 凝炼星魂 +1 (60灵石)】显式购买，或突破境界/斩获秘境星辉获取。");
        return;
      }
      const prevTortoise = hasStarCore(game, "black_tortoise");
      game.litStars.push(mid);
      if (!prevTortoise && hasStarCore(game, "black_tortoise") && game.gourd) {
        game.gourd.maxCharges += 1;
        game.gourd.charges = game.gourd.maxCharges;
      }
      syncFlyingSwords();
      Sound.fanfare();
      saveGame(); updateHud(); openStarChartModal();
      return;
    }
    if (t.hasAttribute("data-equip-soul")) {
      if (!guardEcosystemAccess("soul_seal")) return;
      const sid = t.getAttribute("data-equip-soul");
      const sp = hasOwn(SOUL_SPIRITS, sid) ? SOUL_SPIRITS[sid] : null;
      if (!sp) return;
      if (!Array.isArray(game.unlockedSouls)) game.unlockedSouls = ["blood_warden"];
      if (!game.unlockedSouls.includes(sid)) {
        if (game.stones < 80) { showToast(`需击败对应妖王或消耗 80 灵石炼化【${sp.shortLbl}】`); return; }
        openSoulSealRefineConfirmModal(sid);
        return;
      }
      game.equippedSoul = sid;
      Sound.soulManifestRoar();
      showToast(`👹 已佩带镇妖魂印【${sp.name}】（按 C / RB 无缝化妖破招）！`);
      saveGame(); updateHud(); renderDrawerContent();
      return;
    }
    if (t.hasAttribute("data-awaken-primordial")) {
      if (!guardNotInTribulation("鸿蒙紫气突破")) return;
      if (!guardNotPracticeMode("鸿蒙紫气突破")) return;
      const sl = t.getAttribute("data-awaken-primordial");
      const eq = game && game.equippedGear ? game.equippedGear[sl] : null;
      if (!eq || eq.rarity >= 5) return;
      if (game.stones < 120) { showToast("突破紫气鸿蒙需 120 灵石"); return; }
      game.stones -= 120;
      const baseTitle = eq.name.includes("·") ? eq.name.split("·")[1] : eq.name;
      eq.rarity = 5;
      eq.name = `紫气鸿蒙·${baseTitle}`;
      eq.atk = Math.round((eq.atk || 0) * 1.36 + (sl === "weapon" ? 18 : 6));
      eq.hp = Math.round((eq.hp || 0) * 1.36 + (sl === "armor" ? 65 : 0));
      eq.dr = Math.round((eq.dr || 0) * 1.32 + (sl === "armor" ? 6 : 0));
      if (sl === "weapon") eq.bonusSword = Math.max(2, (eq.bonusSword || 0) + 1);
      const awSpec = PRIMORDIAL_AWAKENINGS[sl];
      eq.awakenedAffix = awSpec.id;
      syncFlyingSwords();
      Sound.coreSeverBoom();
      Sound.fanfare();
      showToast(`🌌 鸿蒙紫气灌顶！【${eq.name}】觉醒太初词条【${awSpec.name}】！`);
      saveGame(); updateHud(); renderDrawerContent();
      return;
    }
    if (t.id === "btn-photo-mode") { togglePhotoMode(); return; }
    if (t.hasAttribute("data-photo-filter")) {
      photoMode.filter = t.getAttribute("data-photo-filter");
      syncPhotoStudioUi();
      return;
    }
    if (t.hasAttribute("data-photo-stamp")) {
      photoMode.showStamp = !photoMode.showStamp;
      syncPhotoStudioUi();
      return;
    }
    if (t.hasAttribute("data-photo-impact")) {
      photoMode.previewImpact = !photoMode.previewImpact;
      syncPhotoStudioUi();
      return;
    }
    if (t.hasAttribute("data-photo-act")) {
      const pa = t.getAttribute("data-photo-act");
      if (pa === "exit") togglePhotoMode(false);
      else if (pa === "hide-ui") { photoMode.uiHidden = true; document.body.classList.add("photo-ui-hidden"); }
      else if (pa === "show-ui") { photoMode.uiHidden = false; document.body.classList.remove("photo-ui-hidden"); }
      else if (pa === "zoom-in") { photoMode.zoom = Math.min(2.40, photoMode.zoom + 0.15); syncPhotoStudioUi(); }
      else if (pa === "zoom-out") { photoMode.zoom = Math.max(0.70, photoMode.zoom - 0.15); syncPhotoStudioUi(); }
      else if (pa === "reset-cam") { photoMode.zoom = 1.15; photoMode.panX = 0; photoMode.panY = 0; syncPhotoStudioUi(); }
      else if (pa === "export-png") { exportPhotoModePng(); }
      return;
    }
    if (t.getAttribute("data-action") === "open-karma-dilemma") {
      if (!guardNotInTribulation("红尘问心抉择")) return;
      openKarmaDilemmaModal();
      return;
    }
    if (t.hasAttribute("data-karma-dilemma")) {
      resolveKarmaDilemmaChoice(t.getAttribute("data-karma-dilemma"), t.getAttribute("data-karma-side"));
      return;
    }
    if (t.hasAttribute("data-gift-npc")) {
      if (!guardNotInTribulation("故人赠礼晋阶")) return;
      if (!guardNotPracticeMode("故人赠礼晋阶")) return;
      const nid = t.getAttribute("data-gift-npc");
      const curT = getCompanionBondTier(game, nid);
      if (curT >= 3) return;
      if (game.stones < 40) { showToast("论道赠礼需 40 灵石"); return; }
      game.stones -= 40;
      if (!game.bondTiers) game.bondTiers = { shen: 1, pei: 0, lu: 0, yan: 0 };
      game.bondTiers[nid] = curT + 1;
      game.aids[nid] = true;
      Sound.fanfare();
      const kp = COMPANION_KEEPSAKES[nid];
      showToast(game.bondTiers[nid] >= 3
        ? `★ 与【${NPC_META[nid].name}】缔结三阶生死羁绊！永久激活信物【${kp.keepsake}】（${kp.bonusDesc}）！`
        : `✦ 与【${NPC_META[nid].name}】羁绊晋升至【${kp.tierTitles[game.bondTiers[nid]]}】！`);
      saveGame(); updateHud(); renderDrawerContent();
      return;
    }
    if (t.hasAttribute("data-toggle-soak")) {
      const sid = t.getAttribute("data-toggle-soak");
      if (!game.gourd) refillImmortalGourd();
      const idx = game.gourd.soaks.indexOf(sid);
      const maxSoaks = getMaxGourdSoaks(game);
      if (idx >= 0) {
        game.gourd.soaks.splice(idx, 1);
      } else {
        while (game.gourd.soaks.length >= maxSoaks) game.gourd.soaks.shift();
        game.gourd.soaks.push(sid);
      }
      Sound.qiOrb(3);
      saveGame(); updateHud(); renderDrawerContent();
      return;
    }
    if (t.getAttribute("data-action") === "refill-gourd-now") {
      if (!canRefillGourdInAlchemyDrawer()) {
        showToast("⚠ 仅可在【听雨洞府】静息时免费满酿仙葫（战中请以识破剑反回酿，或按 H 返洞府）！");
        return;
      }
      refillImmortalGourd();
      Sound.gourdSipChime();
      showToast("🍶 本命九转仙葫已重新满酿！");
      saveGame(); updateHud(); renderDrawerContent();
      return;
    }
    if (t.hasAttribute("data-cos-cat")) {
      const cat = t.getAttribute("data-cos-cat");
      const val = t.getAttribute("data-cos-val");
      if (cat === "swordAura") {
        const spec = WARDROBE_OPTIONS.swordAura.find(x => x.id === val);
        if (!spec || !isSwordAuraUnlocked(spec)) {
          showToast(`🔒 【${spec ? spec.name : val}】需满足【${spec ? spec.unlockText : "轮回条件"}】解锁！`);
          return;
        }
      }
      if (!game.cosmetics) game.cosmetics = { bladeSkin: "celadon", trailSkin: "ink_jade", footAura: "lotus_step", swordAura: "azure_jade" };
      game.cosmetics[cat] = val;
      if (cat === "trailSkin") game.taixuTrailActive = (val === "taixu_prismatic");
      Sound.clang(1.25, 0.09);
      saveGame(); updateHud(); renderDrawerContent();
      return;
    }
    if (t.id === "btn-boss-rush") { openBossRushModal(); return; }
    if (t.hasAttribute("data-rush-affix")) {
      const afId = t.getAttribute("data-rush-affix");
      const idx = arena.rushAffixes.indexOf(afId);
      if (idx >= 0) arena.rushAffixes.splice(idx, 1);
      else arena.rushAffixes.push(afId);
      Sound.clang(1.2, 0.08);
      openBossRushModal();
      return;
    }
    if (t.hasAttribute("data-start-rush")) {
      const sb = Number(t.getAttribute("data-start-rush")) || 1;
      Sound.fanfare();
      startBossRushGauntlet(sb);
      return;
    }
    if (t.getAttribute("data-action") === "toggle-taixu-trail") {
      if (game) {
        game.taixuTrailActive = !game.taixuTrailActive;
        saveGame();
        openBossRushModal();
      }
      return;
    }
    if (t.getAttribute("data-action") === "return-hub-after-rush") {
      if (!guardNotInTribulation("返回洞府")) return;
      closeModal();
      enterSanctumHub();
      return;
    }
    const dActVal = t.getAttribute("data-action");
    if (dActVal === "toggle-pavilion") {
      if (!game || isWelcomeScreenVisible()) {
        closePavilionPopover();
        return;
      }
      const tipEl = document.getElementById("ling-tooltip");
      if (tipEl) tipEl.style.display = "none";
      const pav = document.getElementById("pavilion-popover");
      const pavBtn = document.getElementById("btn-pavilion-menu");
      if (pav) {
        const next = !pav.classList.contains("open");
        pav.classList.toggle("open", next);
        if (pavBtn) pavBtn.classList.toggle("open", next);
      }
      return;
    }
    if (dActVal === "toggle-arcana-vault") {
      const tipEl = document.getElementById("ling-tooltip");
      if (tipEl) tipEl.style.display = "none";
      if (!game) return;
      const unlocked = Boolean(sandboxMode || game.unlockAllArcana) || rankOf(game.realm) >= 3;
      if (!unlocked) {
        showToast("太虚秘匣将于【金丹期】解封；也可于右上【仙阁】开启演武沙盒提前体验！");
        return;
      }
      const wrap = document.getElementById("arcana-vault-wrap");
      if (wrap) {
        wrap.classList.toggle("open");
        syncProgressiveSkillVisibility(false);
      }
      return;
    }
    if (dActVal === "toggle-arcana-all") {
      const pav = document.getElementById("pavilion-popover"); if (pav) pav.classList.remove("open");
      const pavBtn = document.getElementById("btn-pavilion-menu"); if (pavBtn) pavBtn.classList.remove("open");
      if (!game) return;
      if (sandboxMode) {
        exitSandboxMode();
      } else {
        openSandboxConfirmModal("pavilion", null, pavBtn);
      }
      return;
    }
    if (dActVal === "toggle-dojo-drawer") {
      const tipEl = document.getElementById("ling-tooltip");
      if (tipEl) tipEl.style.display = "none";
      const db = document.getElementById("dojo-control-bar");
      if (db) {
        const exp = !db.classList.contains("expanded");
        db.classList.toggle("expanded", exp);
        const caret = document.getElementById("lbl-dojo-caret");
        if (caret) caret.textContent = exp ? "▴" : "▾";
      }
      return;
    }
    if (dActVal === "reroll-destiny-fruit") {
      if (activeFruitRerolls > 0) {
        activeFruitRerolls -= 1;
        Sound.clang(1.3, 0.09);
        openDestinyFruitModal(activeFruitMeta.isHeaven, true);
      }
      return;
    }
    if (dActVal === "reroll-law-draft") {
      if (activeDraftRerolls > 0) {
        activeDraftRerolls -= 1;
        Sound.clang(1.3, 0.09);
        openIconicUpgradeDraft(activeDraftMeta.titleText || "大道顿悟", true);
      }
      return;
    }
    if (t.id === "btn-toggle-telemetry") { toggleTelemetryPanel(); return; }
    if (t.id === "btn-toggle-hitbox") {
      arena.showHitboxes = !arena.showHitboxes;
      t.textContent = arena.showHitboxes ? "框线 ON" : "框线 OFF";
      t.classList.toggle("active", arena.showHitboxes);
      return;
    }
    if (t.id === "btn-reset-telemetry") { resetDamageTelemetry(); return; }
    if (t.id === "btn-close-recap") { renderStageDamageRecap(false); return; }
    if (t.hasAttribute("data-dojo-mode")) {
      const mId = t.getAttribute("data-dojo-mode");
      setDojoMode(mId);
      const db = document.getElementById("dojo-control-bar");
      if (db) db.classList.remove("expanded");
      const caret = document.getElementById("lbl-dojo-caret");
      if (caret) caret.textContent = "▾";
      const dojoBtn = document.getElementById("btn-toggle-dojo-bar");
      if (isElementFocusable(dojoBtn)) {
        try { dojoBtn.focus({ preventScroll: true }); } catch (e) {}
      } else {
        focusBattlefield();
      }
      Sound.clang(1.2, 0.09);
      return;
    }
    if (t.hasAttribute("data-dojo-act")) {
      const dAct = t.getAttribute("data-dojo-act");
      const db = document.getElementById("dojo-control-bar");
      if (db) db.classList.remove("expanded");
      const caret = document.getElementById("lbl-dojo-caret");
      if (caret) caret.textContent = "▾";
      const dojoBtn = document.getElementById("btn-toggle-dojo-bar");
      if (isElementFocusable(dojoBtn)) {
        try { dojoBtn.focus({ preventScroll: true }); } catch (e) {}
      }
      const ensureDojoFocusRestored = () => {
        const bdNow = document.getElementById("modal-backdrop");
        if ((bdNow && bdNow.classList.contains("open")) || drawerOpen || cutscene.active) return;
        if (isElementFocusable(dojoBtn)) {
          try { dojoBtn.focus({ preventScroll: true }); } catch (e) {}
        } else {
          focusBattlefield();
        }
      };
      if (dAct === "reset-training") {
        resetDojoTrainingStats();
        showToast("已重置演武训练计数！");
      } else if (dAct === "refill-training") {
        if (!isSanctumDojoActive() || arena.tribulation) {
          showToast("演武赐福仅可在听雨洞府试剑演武时使用！", { critical: true });
          ensureDojoFocusRestored();
          return;
        }
        if (game) {
          const st = getCombatStats(game);
          game.hp = st.maxHp;
          game.mp = st.maxMp;
          refillImmortalGourd();
          arena.player.ultCd = 0; arena.player.dashCd = 0; arena.player.recallCd = 0; arena.morphCd = 0;
          updateHud();
          updateCooldownMasks();
          showToast("演武赐福：气血、剑元、仙葫与技能冷却已补满！");
        }
      } else if (dAct === "toggle-sandbox-slots") {
        setSandboxSlotPrototype(!sandboxSlotPrototype);
      } else if (dAct === "fill-intent") {
        if (!isSanctumDojoActive() || arena.tribulation) {
          showToast("演武剑意赐福仅可在听雨洞府试剑演武时使用！", { critical: true });
          ensureDojoFocusRestored();
          return;
        }
        arena.swordIntent = 100;
        arena.player.ultCd = 0; arena.player.allyCd = 0; arena.player.dashCd = 0; arena.player.recallCd = 0;
        Sound.fanfare();
        showToast("演武赐福：无上剑意已蓄满 100%！按 X 键释放流派终极演出！");
        updateCooldownMasks();
      } else if (dAct === "toggle-recap") {
        renderStageDamageRecap();
      } else if (dAct === "start-cloud-sky") {
        startCloudSeaAerialStage();
      } else if (dAct === "open-spire") {
        openCelestialSpireModal();
      } else if (dAct === "open-workshop") {
        openCustomWorkshopModal();
      } else if (dAct === "open-taixu-craft") {
        openTaixuCraftMinigameModal("alchemy");
      } else if (dAct === "toggle-coop-2p") {
        toggleLocalCoop2P();
      } else if (dAct === "open-sequencer") {
        openComboSequencerModal();
      } else if (dAct === "open-expedition") {
        openExpeditionSandboxModal();
      } else if (dAct === "start-defense") {
        startSectDefenseSiege();
      } else if (dAct === "start-titan") {
        startBossRushGauntlet(7);
      } else if (dAct === "record-ghost") {
        startGhostRecording();
      } else if (dAct === "toggle-ghost") {
        toggleGhostPlayback();
      } else if (dAct === "open-rush") {
        openBossRushModal();
      }
      ensureDojoFocusRestored();
      return;
    }
    if (t.hasAttribute("data-rebind-act")) {
      rebindListeningAction = t.getAttribute("data-rebind-act");
      openSettingsModal();
      return;
    }
    if (t.getAttribute("data-action") === "reset-keybinds") {
      resetAllKeybinds();
      openSettingsModal();
      return;
    }
    if (t.getAttribute("data-action") === "toggle-rumble") {
      rumbleEnabled = !rumbleEnabled;
      saveKeybinds();
      if (rumbleEnabled) GamepadSystem.rumble(0.5, 0.5, 100);
      openSettingsModal();
      return;
    }

    if (t.hasAttribute("data-arena-skill")) {
      const sk = t.getAttribute("data-arena-skill");
      if (sk === "pet_ult") triggerMappedAction("pet");
      else if (sk === "tribulation") startLiveTribulation();
      else triggerMappedAction(sk);
      return;
    }

    if (t.hasAttribute("data-select-recipe")) {
      furnaceGame.recipeId = t.getAttribute("data-select-recipe");
      furnaceGame.active = false;
      renderDrawerContent();
      return;
    }
    if (t.hasAttribute("data-start-furnace")) {
      startFurnaceMinigame(t.getAttribute("data-start-furnace"));
      return;
    }
    if (t.getAttribute("data-action") === "strike-furnace") {
      strikeFurnaceNeedle();
      return;
    }
    if (t.hasAttribute("data-temper-relic")) {
      if (!guardNotInTribulation("法宝淬炼升星")) return;
      if (!guardNotPracticeMode("法宝淬炼升星")) return;
      const rid = t.getAttribute("data-temper-relic");
      const curStars = (game.relicStars && game.relicStars[rid]) || 1;
      if (curStars >= 5) return;
      const tc = getRelicTemperCost(game, curStars, temperUseCoreDiscount);
      if (game.stones < tc.finalStones) { showToast(`淬炼需 ${tc.finalStones} 灵石${tc.applyCore ? " + 1 妖核" : ""}`); return; }
      game.stones -= tc.finalStones;
      if (tc.applyCore) {
        game.inventory.core = Math.max(0, Math.floor(num(game.inventory.core, 0)) - 1);
        if (game.inventory.core <= 0) temperUseCoreDiscount = false;
      }
      game.relicStars[rid] = curStars + 1;
      syncFlyingSwords();
      Sound.clang(1.3, 0.14);
      Sound.fanfare();
      showToast(`★ 【${RELICS[rid].name}】淬炼晋升 ★${curStars + 1}（消耗 ${tc.finalStones} 灵石${tc.applyCore ? " + 1 妖核" : ""}）！`);
      saveGame(); updateHud(); renderDrawerContent();
      const panel = document.getElementById("jade-panel");
      const bd = document.getElementById("modal-backdrop");
      if (drawerOpen && panel && !cutscene.active && !(bd && bd.classList.contains("open"))) {
        const nextTrig = panel.querySelector(`[data-temper-relic="${rid}"]`) || panel.querySelector(`[data-relic="${rid}"]`);
        if (nextTrig && isElementFocusable(nextTrig)) {
          try { nextTrig.focus({ preventScroll: true }); } catch (e) {}
        } else {
          focusDialogSafely(panel);
        }
      }
      return;
    }

    if (t.hasAttribute("data-set-stance")) {
      arena.stanceIdx = Number(t.getAttribute("data-set-stance")) % SWORD_STANCES.length;
      Sound.clang(1.15, 0.1);
      saveGame(); updateHud(); renderDrawerContent();
      return;
    }

    if (t.hasAttribute("data-choose-ending")) {
      const endId = t.getAttribute("data-choose-ending");
      game.ending = endId;
      if (!sandboxMode) {
        metaState.lastEnding = endId;
        recordPastLifeInHall(game, endId);
        saveMeta();
      }
      Sound.fanfare();
      saveGame(); updateHud();
      openEndingModal();
      return;
    }

    if (t.hasAttribute("data-draft-type")) {
      const dt = t.getAttribute("data-draft-type");
      const did = t.getAttribute("data-draft-id");
      const evId = activePendingRewardId;
      let newSynName = null;
      let pickedPet = false;
      let pickedLawId = null;
      const applyDraft = () => {
        if (dt === "pet") {
          if (hasOwn(SPIRIT_PETS, did)) {
            game.pet.id = did;
            game.pet.level = Math.max(1, game.pet.level || 1);
            if (!game.pet.skills || typeof game.pet.skills !== "object") game.pet.skills = { tier3: null, tier5: null };
            pickedPet = true;
          }
        } else if (DAO_LAWS[did] && !game.laws.includes(did)) {
          const beforeSyn = SYNERGIES.filter(s => s.active(game)).map(s => s.id);
          game.laws.push(did);
          pickedLawId = did;
          const newSyn = SYNERGIES.find(s => !beforeSyn.includes(s.id) && s.active(game));
          if (newSyn) newSynName = newSyn.name;
        }
        return true;
      };
      if (evId) {
        const res = commitPendingReward(evId, applyDraft);
        if (!res.ok) {
          if (!saveConflictState) closeModal();
          return;
        }
      } else {
        applyDraft();
        saveGame();
      }
      if (pickedPet) {
        queueNewUnlockCardsForState(game);
      }
      if (pickedLawId) {
        if (!sandboxMode && !metaState.seenLaws.includes(pickedLawId)) {
          metaState.seenLaws.push(pickedLawId);
          saveMeta();
        }
        if (game.laws.length >= 5) unlockAchievement("ach_laws5");
      }
      if (newSynName) showToast(`★ 大道共鸣！激活神话羁绊【${newSynName}】！`);
      syncFlyingSwords(); Sound.fanfare();
      closeModal(); updateHud();
      return;
    }

    if (t.hasAttribute("data-use-item")) {
      consumeInventoryItem(t.getAttribute("data-use-item"));
      return;
    }

    if (t.hasAttribute("data-close-drawer")) { closeDrawer(); return; }
    if (t.hasAttribute("data-modal-close")) { closeModal(); return; }
    if (t.hasAttribute("data-tab")) { toggleDrawer(t.getAttribute("data-tab")); return; }
    if (t.hasAttribute("data-preset")) {
      const presetName = t.getAttribute("data-preset");
      if (sandboxMode) {
        applyStagePreset(presetName, { insideSandbox: true });
      } else {
        openSandboxConfirmModal("preset", presetName);
      }
      return;
    }

    if (t.hasAttribute("data-enhance-slot")) {
      if (!guardNotPracticeMode("神兵淬火强化")) return;
      const sl = t.getAttribute("data-enhance-slot");
      if (consumeSuppressedClick("enhance", sl)) return;
      executeSingleGearEnhance(sl, { silentToast: false, fromHold: false });
      return;
    }
    if (t.hasAttribute("data-reforge-slot")) {
      if (!guardNotInTribulation("定向词条刻录")) return;
      if (!guardNotPracticeMode("定向词条刻录")) return;
      const sl = t.getAttribute("data-reforge-slot");
      openAffixEngraveModal(sl);
      return;
    }
    if (t.hasAttribute("data-engrave-slot")) {
      if (!guardNotInTribulation("定向词条刻录")) return;
      if (!guardNotPracticeMode("定向词条刻录")) return;
      const sl = t.getAttribute("data-engrave-slot");
      const afId = t.getAttribute("data-engrave-affix");
      const eq = game && game.equippedGear ? game.equippedGear[sl] : null;
      const picked = SACRED_AFFIXES.find(a => a.id === afId);
      if (!eq || !picked) return;
      if (game.stones < 35) { showToast("定向刻录词条需 35 灵石"); return; }
      game.stones -= 35;
      eq.affix = picked.id;
      eq.power = eq.atk * 3 + Math.round(eq.hp * 0.4) + eq.dr * 5 + Math.round(eq.crit * 240) + eq.bonusSword * 85 + 45;
      if (game.goalStats) game.goalStats.craftOrLoot = (game.goalStats.craftOrLoot || 0) + 1;
      Sound.bianzhong(659.25, 0.09);
      Sound.fanfare();
      showToast(`✦ 定向铭刻！【${eq.name}】已刻录【${picked.name}】（${picked.desc}）！`);
      saveGame(); updateHud(); renderDrawerContent();
      const panel = document.getElementById("jade-panel");
      if (drawerOpen && panel) {
        const refreshedTrigger = panel.querySelector(`[data-reforge-slot="${sl}"]`);
        if (refreshedTrigger && isElementFocusable(refreshedTrigger)) {
          lastModalTriggerEl = refreshedTrigger;
        }
      }
      closeModal();
      return;
    }
    if (t.hasAttribute("data-toggle-pact")) {
      if (!guardEcosystemAccess("heavenly_pacts")) return;
      const pid = t.getAttribute("data-toggle-pact");
      if (!game.pactSeals) game.pactSeals = [];
      const idx = game.pactSeals.indexOf(pid);
      if (idx >= 0) game.pactSeals.splice(idx, 1);
      else game.pactSeals.push(pid);
      Sound.drum(0.18);
      Sound.bianzhong(392.0, 0.08);
      showToast(idx >= 0 ? "已收敛一道天道劫印" : `🔥 缔结天道劫印！当前共启 ${game.pactSeals.length} 劫（爆率与仙榜倍率飙升）`);
      saveGame(); updateHud();
      openObjectivesModal("endgame");
      return;
    }
    if (t.id === "btn-toggle-qt") {
      if (!game || isWelcomeScreenVisible()) return;
      questHudCollapsed = !questHudCollapsed;
      t.textContent = questHudCollapsed ? "▸" : "▾";
      renderQuestTrackerHud();
      return;
    }
    if (t.id === "btn-goals-modal" || t.id === "btn-open-goals-hdr") {
      if (!game || isWelcomeScreenVisible()) return;
      openObjectivesModal();
      return;
    }
    if (t.hasAttribute("data-open-goals")) {
      openObjectivesModal(t.getAttribute("data-open-goals"));
      return;
    }
    if (t.hasAttribute("data-goal-tab")) {
      openObjectivesModal(t.getAttribute("data-goal-tab"));
      return;
    }
    if (t.hasAttribute("data-claim-step")) {
      const sid = t.getAttribute("data-claim-step");
      claimMainlineStepReward(sid);
      const bdEl = document.getElementById("modal-backdrop");
      if (bdEl && bdEl.classList.contains("open")) openObjectivesModal("mainline");
      else if (drawerOpen) renderDrawerContent();
      return;
    }
    if (t.hasAttribute("data-route-goal")) {
      routeToGoalTarget(t.getAttribute("data-route-goal"));
      return;
    }
    if (t.hasAttribute("data-open-companion-story")) {
      openCompanionStoryDrawer(t.getAttribute("data-open-companion-story"));
      return;
    }
    if (t.getAttribute("data-action") === "confirm-volume-recap") {
      closeModal();
      return;
    }
    if (t.hasAttribute("data-claim-bounty")) {
      const bSlot = t.getAttribute("data-claim-bounty");
      const chain = SECT_BOUNTY_CHAINS.find(c => c.slot === bSlot);
      if (chain) {
        const b = getBountySpec(game, chain);
        if (b.ready) {
          game.bountyTiers[bSlot] = (game.bountyTiers[bSlot] || 1) + 1;
          game.stones += b.stones;
          game.inventory.core = (game.inventory.core || 0) + 1;
          gainRealmXp(b.xp);
          Sound.fanfare();
          showToast(`✦ 悬赏交割！获 ${b.stones} 灵石、${b.xp} 修为与妖核×1！`);
          saveGame(); updateHud();
          const bdEl = document.getElementById("modal-backdrop");
          if (bdEl && bdEl.classList.contains("open")) openObjectivesModal("bounties");
        }
      }
      return;
    }
    if (t.hasAttribute("data-claim-star-chest")) {
      const cid = t.getAttribute("data-claim-star-chest");
      const chest = STAR_MILESTONE_CHESTS.find(c => c.id === cid);
      if (chest && !game.claimedStarChests.includes(cid) && getTotalStageStars(game) >= chest.need) {
        game.claimedStarChests.push(cid);
        game.stones += chest.stones;
        if (chest.bonusSword) { game.bonusSwords = (game.bonusSwords || 0) + chest.bonusSword; syncFlyingSwords(); }
        acquireGearItem(rollGearItem(Math.max(1, rankOf(game.realm)), chest.gearRarity, chest.slot));
        Sound.fanfare();
        showToast(`★ 开启【${chest.name}】！获 ${chest.stones} 灵石与高品神装！`);
        saveGame(); updateHud();
        const bdEl = document.getElementById("modal-backdrop");
        if (bdEl && bdEl.classList.contains("open")) openObjectivesModal("bounties");
      }
      return;
    }
    if (t.id === "btn-world-map" || t.getAttribute("data-action") === "open-world-map") {
      if (!game || isWelcomeScreenVisible()) return;
      openWorldMapModal();
      return;
    }
    if (t.getAttribute("data-action") === "open-bounties") { openObjectivesModal("bounties"); return; }
    if (t.getAttribute("data-action") === "open-expedition-sandbox") { openExpeditionSandboxModal(); return; }
    if (t.getAttribute("data-action") === "open-boss-rush") { openBossRushModal(); return; }
    if (t.getAttribute("data-action") === "skip-onboarding") {
      if (game) {
        game.tutorialDismissed = true;
        game.tutorialStep = 4;
        renderOnboardingCoach();
        saveGame();
        showToast("已跳过入道指引（可随时在右上【卷轴 → 键位】查阅分层按键指南）");
        const bdOb = document.getElementById("modal-backdrop");
        if (!(bdOb && bdOb.classList.contains("open")) && !drawerOpen && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
          restoreTriggerFocus(null);
        }
      }
      return;
    }
    // F15: Clicking a World Map node PREVIEWS condition/drops/route without traveling!
    if (t.hasAttribute("data-map-node")) {
      const nid = t.getAttribute("data-map-node");
      const nd = KYUSHU_MAP_NODES.find(x => x.id === nid);
      if (!nd) return;
      selectedWorldMapNodeId = nid;
      openWorldMapModal(nid);
      return;
    }
    // F15: Explicit Enter CTA executes travel after preview
    if (t.hasAttribute("data-map-enter")) {
      if (!guardNotInTribulation("九州舆图传送")) return;
      const nid = t.getAttribute("data-map-enter");
      const nd = KYUSHU_MAP_NODES.find(x => x.id === nid);
      if (!nd) return;
      if (nd.kind === "boss_rush") {
        if (!guardEcosystemAccess("sword_tomb_rush")) return;
      } else if (nd.kind === "tower") {
        if (!guardEcosystemAccess("demon_tower")) return;
      } else if (rankOf(game.realm) < rankOf(nd.min)) {
        showToast(`需晋升【${REALMS[nd.min].name}】方可御剑前往`);
        return;
      }
      closeModal();
      Sound.fanfare();
      if (nd.kind === "hub") { focusBattlefield(); enterSanctumHub(); }
      else if (nd.kind === "boss_rush") openBossRushModal();
      else if (nd.kind === "tower") { focusBattlefield(); initArenaStage(3, true); }
      else if (nd.kind === "chapter5_marker") { openVol5ResonanceFlow(); }
      else { focusBattlefield(); initArenaStage(nd.stageIdx, false); }
      saveGame();
      return;
    }
    // F17: Single-Layer Material Source Jump & Return Focus
    if (t.hasAttribute("data-mat-source")) {
      const matId = t.getAttribute("data-mat-source");
      if (!matId || !hasOwn(MATERIAL_SOURCE_CATALOG, matId)) return;
      const inModal = t.getAttribute("data-source-modal") || "";
      const originSelector = t.getAttribute("data-source-origin") || "";
      if (inModal === "sanctum") {
        const box = document.getElementById("modal-content");
        activeMatSourceJump = {
          matId,
          inModal: "sanctum",
          originSelector,
          scrollTop: box ? box.scrollTop : 0,
          tab: currentTab
        };
        openSanctumUpgradeModal();
        if (box) box.scrollTop = 0;
        const retBtn = box ? box.querySelector("#btn-mat-source-return") : document.getElementById("btn-mat-source-return");
        if (retBtn && isElementFocusable(retBtn)) {
          try { retBtn.focus({ preventScroll: true }); } catch (e) {}
        }
      } else {
        const bodyEl = document.getElementById("panel-scroll-body");
        activeMatSourceJump = {
          matId,
          inModal: "",
          originSelector,
          scrollTop: bodyEl ? bodyEl.scrollTop : 0,
          tab: currentTab
        };
        renderDrawerContent();
        if (bodyEl) bodyEl.scrollTop = 0;
        const retBtn = bodyEl ? bodyEl.querySelector("#btn-mat-source-return") : document.getElementById("btn-mat-source-return");
        if (retBtn && isElementFocusable(retBtn)) {
          try { retBtn.focus({ preventScroll: true }); } catch (e) {}
        }
      }
      return;
    }
    if (t.getAttribute("data-action") === "close-mat-source") {
      const prev = activeMatSourceJump;
      activeMatSourceJump = null;
      if (prev && prev.inModal === "sanctum") {
        openSanctumUpgradeModal();
        const box = document.getElementById("modal-content");
        if (box) {
          box.scrollTop = prev.scrollTop || 0;
          let orig = prev.originSelector ? box.querySelector(prev.originSelector) : null;
          if (!orig || !isElementFocusable(orig)) {
            if (prev.matId && prev.originSelector) {
              const chips = box.querySelectorAll(`[data-mat-source="${prev.matId}"]`);
              for (const ch of chips) {
                if (ch.getAttribute("data-source-origin") === prev.originSelector && isElementFocusable(ch)) {
                  orig = ch;
                  break;
                }
              }
            }
          }
          if (!orig || !isElementFocusable(orig)) {
            orig = prev.matId ? box.querySelector(`[data-mat-source="${prev.matId}"]`) : null;
          }
          if (!orig || !isElementFocusable(orig)) {
            orig = box;
          }
          try { orig.focus({ preventScroll: true }); } catch (e) {}
        }
      } else {
        renderDrawerContent();
        const bodyEl = document.getElementById("panel-scroll-body");
        const panelEl = document.getElementById("jade-panel");
        if (bodyEl && prev) bodyEl.scrollTop = prev.scrollTop || 0;
        if (panelEl) {
          let targetEl = prev && prev.originSelector ? panelEl.querySelector(prev.originSelector) : null;
          if (!targetEl || !isElementFocusable(targetEl)) {
            targetEl = prev ? panelEl.querySelector(`[data-mat-source="${prev.matId}"]`) : null;
          }
          if (!targetEl || !isElementFocusable(targetEl)) {
            targetEl = panelEl;
          }
          try { targetEl.focus({ preventScroll: true }); } catch (e) {}
        }
      }
      return;
    }
    // F18 (D08): Explicit-Quantity Batch Craft & Batch Enhance Modal Handlers
    if (t.hasAttribute("data-open-batch-craft")) {
      openBatchCraftModal(t.getAttribute("data-open-batch-craft"), 3);
      return;
    }
    if (t.hasAttribute("data-batch-craft-qty")) {
      const q = Number(t.getAttribute("data-batch-craft-qty")) || 1;
      if (pendingBatchCraft && pendingBatchCraft.recId) {
        openBatchCraftModal(pendingBatchCraft.recId, q);
      }
      return;
    }
    if (t.getAttribute("data-action") === "confirm-batch-craft") {
      const req = pendingBatchCraft;
      if (!req || !req.recId) return;
      const res = executeAlchemyBatchCraft(req.recId, req.qty);
      if (res && res.ok) {
        pendingBatchCraft = null;
        const panel = document.getElementById("jade-panel");
        if (drawerOpen && panel) {
          const refreshed = panel.querySelector(`[data-open-batch-craft="${req.recId}"]`) || panel.querySelector(`[data-quick-craft="${req.recId}"]`);
          if (refreshed && isElementFocusable(refreshed)) lastModalTriggerEl = refreshed;
        }
        closeModal();
      } else {
        const errEl = document.getElementById("batch-craft-error-msg");
        if (errEl) {
          let errMsg = "⚠ 批量炼丹未能完成，未扣除任何资源";
          if (res && res.reason === "save_failed") {
            const detail = (storageWriteError && storageWriteError.message)
              ? storageWriteError.message
              : (storageReadError && storageReadError.reason)
                ? storageReadError.reason
                : saveReadOnlyMode
                  ? "当前处于只读观览态"
                  : saveConflictState
                    ? "存在未处理的多标签页存档冲突"
                    : "本地存档写入失败";
            errMsg = `⚠ 存档写入失败：${detail}（已原子回滚本次批量炼丹，未扣除灵石/灵材/寿元）`;
          } else if (res && res.reason === "tribulation") {
            errMsg = "⚡ 正在九霄紫霄雷劫渡劫中，无法进行批量炼丹！";
          } else if (res && res.reason === "practice_mode") {
            errMsg = "⚔ 演武练习模式禁止批量炼丹，请先按 H 返回听雨洞府！";
          } else if (res && res.reason === "insufficient_stones") {
            errMsg = "⚠ 灵石不足，无法完成本次批量炼丹！";
          } else if (res && res.reason === "cauldron_locked") {
            errMsg = "⚠ 紫微丹鼎等级不足，尚未解封该丹方！";
          }
          errEl.textContent = errMsg;
          errEl.style.display = "block";
        }
        const modalBox = document.getElementById("modal-content");
        if (modalBox && document.getElementById("modal-backdrop")?.classList.contains("open") && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
          focusDialogSafely(modalBox);
        }
      }
      return;
    }
    if (t.hasAttribute("data-open-batch-enhance")) {
      openBatchEnhanceModal(t.getAttribute("data-open-batch-enhance"), 3);
      return;
    }
    if (t.hasAttribute("data-batch-enh-steps")) {
      const stVal = Number(t.getAttribute("data-batch-enh-steps")) || 1;
      if (pendingBatchEnhance && pendingBatchEnhance.slot) {
        openBatchEnhanceModal(pendingBatchEnhance.slot, stVal);
      }
      return;
    }
    if (t.getAttribute("data-action") === "confirm-batch-enhance") {
      const req = pendingBatchEnhance;
      if (!req || !req.slot) return;
      const res = executeGearBatchEnhance(req.slot, req.steps);
      if (res && res.ok) {
        pendingBatchEnhance = null;
        const panel = document.getElementById("jade-panel");
        if (drawerOpen && panel) {
          const refreshed = panel.querySelector(`[data-enhance-slot="${req.slot}"]`) || panel.querySelector(`[data-open-batch-enhance="${req.slot}"]`);
          if (refreshed && isElementFocusable(refreshed)) lastModalTriggerEl = refreshed;
        }
        closeModal();
      } else {
        const errEl = document.getElementById("batch-enhance-error-msg");
        if (errEl) {
          let errMsg = "⚠ 批量淬火未能完成，未扣除任何灵石";
          if (res && res.reason === "save_failed") {
            const detail = (storageWriteError && storageWriteError.message)
              ? storageWriteError.message
              : (storageReadError && storageReadError.reason)
                ? storageReadError.reason
                : saveReadOnlyMode
                  ? "当前处于只读观览态"
                  : saveConflictState
                    ? "存在未处理的多标签页存档冲突"
                    : "本地存档写入失败";
            errMsg = `⚠ 存档写入失败：${detail}（已原子回滚本次批量淬火，未扣除任何灵石）`;
          } else if (res && res.reason === "tribulation") {
            errMsg = "⚡ 正在九霄紫霄雷劫渡劫中，无法进行批量淬火强化！";
          } else if (res && res.reason === "practice_mode") {
            errMsg = "⚔ 演武练习模式禁止批量淬火强化，请先按 H 返回听雨洞府！";
          } else if (res && res.reason === "insufficient_stones") {
            errMsg = "⚠ 灵石不足，无法完成本次批量淬火！";
          } else if (res && res.reason === "max_level") {
            errMsg = "⚠ 该仙装已淬火至圆满 +10！";
          }
          errEl.textContent = errMsg;
          errEl.style.display = "block";
        }
        const modalBox = document.getElementById("modal-content");
        if (modalBox && document.getElementById("modal-backdrop")?.classList.contains("open") && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
          focusDialogSafely(modalBox);
        }
      }
      return;
    }
    // D08 (R3-F07): Stage Sweep Entry & Explicit Confirmation Handlers
    if (t.hasAttribute("data-open-stage-sweep")) {
      const stgIdx = Number(t.getAttribute("data-open-stage-sweep"));
      const origin = t.getAttribute("data-sweep-origin") || (drawerOpen ? "drawer" : "other");
      openStageSweepConfirmModal(stgIdx, { origin, mapNodeId: selectedWorldMapNodeId });
      return;
    }
    if (t.getAttribute("data-action") === "cancel-stage-sweep") {
      const req = pendingStageSweep;
      pendingStageSweep = null;
      if (req && req.origin === "world_map") {
        openWorldMapModal(req.mapNodeId);
        const mapSweepBtn = document.getElementById("btn-map-sweep-stage") || document.getElementById("btn-map-enter-node");
        if (mapSweepBtn && isElementFocusable(mapSweepBtn)) {
          try { mapSweepBtn.focus({ preventScroll: true }); } catch (e) {}
        }
      } else {
        closeModal();
      }
      return;
    }
    if (t.getAttribute("data-action") === "confirm-stage-sweep") {
      const req = pendingStageSweep;
      if (!req || !Number.isInteger(req.stageIdx)) return;
      const res = executeStageSweep(req.stageIdx);
      if (res && res.ok) {
        pendingStageSweep = null;
        if (req.origin === "world_map") {
          openWorldMapModal(req.mapNodeId);
          const mapSweepBtn = document.getElementById("btn-map-sweep-stage") || document.getElementById("btn-map-enter-node");
          if (mapSweepBtn && isElementFocusable(mapSweepBtn)) {
            try { mapSweepBtn.focus({ preventScroll: true }); } catch (e) {}
          }
        } else {
          const panel = document.getElementById("jade-panel");
          if (drawerOpen && panel) {
            const refreshed = panel.querySelector(`[data-open-stage-sweep="${req.stageIdx}"]`) || panel.querySelector(`[data-warp-stage="${req.stageIdx}"]`);
            if (refreshed && isElementFocusable(refreshed)) lastModalTriggerEl = refreshed;
          }
          closeModal();
        }
      } else {
        const errEl = document.getElementById("stage-sweep-error-msg");
        if (errEl) {
          let errMsg = (res && res.reasonText) ? `⚠ ${res.reasonText}` : "⚠ 秘境扫荡未能完成，未扣除扫荡次数";
          if (res && res.reason === "save_failed") {
            const detail = (storageWriteError && storageWriteError.message)
              ? storageWriteError.message
              : (storageReadError && storageReadError.reason)
                ? storageReadError.reason
                : saveReadOnlyMode
                  ? "当前处于只读观览态"
                  : saveConflictState
                    ? "存在未处理的多标签页存档冲突"
                    : "本地存档写入失败";
            errMsg = `⚠ 存档写入失败：${detail}（已原子回滚本次扫荡，未扣除扫荡次数）`;
          } else if (res && res.reason === "tribulation") {
            errMsg = "⚡ 正在九霄紫霄雷劫渡劫中，无法进行秘境扫荡！";
          } else if (res && res.reason === "practice_mode") {
            errMsg = "⚔ 演武练习模式不产出正式奖励，禁止进行秘境扫荡！";
          }
          errEl.textContent = errMsg;
          errEl.style.display = "block";
        }
        const modalBox = document.getElementById("modal-content");
        if (modalBox && document.getElementById("modal-backdrop")?.classList.contains("open") && (document.activeElement === document.body || !isElementFocusable(document.activeElement))) {
          focusDialogSafely(modalBox);
        }
      }
      return;
    }
    if (t.hasAttribute("data-destiny-fruit")) {
      const fid = t.getAttribute("data-destiny-fruit");
      const df = hasOwn(DESTINY_FRUITS, fid) ? DESTINY_FRUITS[fid] : null;
      const evId = activePendingRewardId;
      let luckGear = null;
      const applyFruit = () => {
        if (df && !hasDestinyFruit(game, fid)) {
          game.destinyFruits.push(fid);
          if (fid === "glutton_pill") {
            game.inventory.healing_pill = (game.inventory.healing_pill || 0) + 2;
          } else if (fid === "hongmeng_luck") {
            luckGear = rollGearItem(Math.max(2, arena.stageIdx + 1), 3);
          } else if (fid === "eternal_pine") {
            game.stones += 120;
          }
        }
        return true;
      };
      if (evId) {
        const res = commitPendingReward(evId, applyFruit);
        if (!res.ok) {
          if (!saveConflictState) closeModal();
          return;
        }
      } else {
        applyFruit();
        saveGame();
      }
      if (luckGear) acquireGearItem(luckGear);
      if (df) {
        syncFlyingSwords();
        Sound.fanfare();
        showToast(`★ 逆天改命！觉醒先天道果【${df.name}】！`);
      }
      const hasChainedDraft = getPendingRewardsByKind("iconic_draft").length > 0;
      closeModal();
      updateHud();
      if (!hasChainedDraft) {
        openIconicUpgradeDraft(`${REALMS[game.realm].name}功成 · 参悟大道神通`);
      } else {
        requestCalmReevaluation({ immediate: isCombatCalm() });
      }
      return;
    }
    if (t.hasAttribute("data-enc-id")) {
      if (!guardNotInTribulation("上古奇遇抉择")) return;
      const eid = t.getAttribute("data-enc-id");
      const oid = t.getAttribute("data-enc-opt");
      const karmaMode = t.getAttribute("data-enc-karma");
      if (karmaMode && KARMA_ENCOUNTER_EXTRAS[eid] && KARMA_ENCOUNTER_EXTRAS[eid][karmaMode]) {
        const kOpt = KARMA_ENCOUNTER_EXTRAS[eid][karmaMode];
        if (kOpt.karma) game.karmaScore = Math.max(-100, Math.min(100, (game.karmaScore || 0) + kOpt.karma));
        if (kOpt.dao) Object.entries(kOpt.dao).forEach(([dk, dv]) => { game.dao[dk] = (game.dao[dk] || 0) + dv; });
        if (kOpt.drBonus) game.karmaDrBonus = (game.karmaDrBonus || 0) + kOpt.drBonus;
        let kCapNote = "";
        if (kOpt.atkBonus) {
          const atkRes = grantPermanentStatBonus(game, { atk: kOpt.atkBonus, source: "general" });
          if (atkRes.atkCapped) kCapNote = `（本境永久剑攻 ${game.atkFlatBonus}/${atkRes.caps.atkFlatBonus}）`;
        }
        if (kOpt.stones) game.stones += kOpt.stones;
        if (kOpt.bonusSword) { game.bonusSwords = (game.bonusSwords || 0) + kOpt.bonusSword; syncFlyingSwords(); }
        if (kOpt.longevityPill) game.inventory.longevity_pill = (game.inventory.longevity_pill || 0) + kOpt.longevityPill;
        if (kOpt.healPills) game.inventory.healing_pill = (game.inventory.healing_pill || 0) + kOpt.healPills;
        if (kOpt.cores) game.inventory.core = (game.inventory.core || 0) + kOpt.cores;
        if (kOpt.lifespanMonths) {
          game.lifespanBonusMonths = (game.lifespanBonusMonths || 0) + kOpt.lifespanMonths;
          if (!getLifespanInfo(game).isExhausted) {
            game.lifespanExhaustedPromptDismissed = false;
            pendingLifespanExhaustedPrompt = false;
          }
        }
        if (kOpt.fillIntent) arena.swordIntent = 100;
        if (kOpt.fullHeal) { const st2 = getCombatStats(game); game.hp = st2.maxHp; game.mp = st2.maxMp; }
        if (kOpt.bond) {
          if (!game.bondTiers) game.bondTiers = { shen: 1, pei: 0, lu: 0, yan: 0 };
          game.bondTiers[kOpt.bond] = Math.min(3, getCompanionBondTier(game, kOpt.bond) + 1);
          game.aids[kOpt.bond] = true;
        }
        if (kOpt.gearSlot) acquireGearItem(rollGearItem(Math.max(2, arena.stageIdx + 1), kOpt.gearRarity || 3, kOpt.gearSlot));
        Sound.fanfare();
        showToast(`✦ ${kOpt.label} 功成！${kCapNote}`);
        closeModal();
        saveGame();
        updateHud();
        return;
      }
      const evSpec = SECRET_ENCOUNTERS.find(x => x.id === eid);
      const opt = evSpec ? evSpec.options.find(x => x.id === oid) : null;
      if (opt) {
        if (opt.dao) {
          Object.entries(opt.dao).forEach(([dk, dv]) => { game.dao[dk] = (game.dao[dk] || 0) + dv; });
        }
        if (oid === "force_pull") {
          game.hp = Math.max(12, Math.round(game.hp * 0.8));
          acquireGearItem(rollGearItem(Math.max(1, arena.stageIdx + 1), 2, "weapon"));
        } else if (oid === "calm_temper") {
          game.bonusSwords = (game.bonusSwords || 0) + 1;
          syncFlyingSwords();
          showToast("★ 抚剑通灵！本命环身飞剑永久 +1 柄！");
        } else if (oid === "melt_essence") {
          gainRealmXp(Math.max(40, Math.round((REALMS[game.realm].xpCap || 180) * 0.45)));
          game.stones += 85;
          showToast("★ 剑髓入体！修为大涨且获 85 灵石！");
        } else if (oid === "bathe_spring") {
          const hpRes = grantPermanentStatBonus(game, { hp: 36, source: "general" });
          const st2 = getCombatStats(game);
          game.hp = st2.maxHp; game.mp = st2.maxMp;
          showToast(hpRes.grantedHp > 0
            ? `★ 太清洗髓！气血全满且气血上限永久 +${hpRes.grantedHp}${hpRes.hpCapped ? `（已达本境上限 ${game.maxHpBonus}/${hpRes.caps.maxHpBonus}）` : ""}！`
            : `★ 太清洗髓！气血全满（本境永久气血上限已满 ${game.maxHpBonus}/${hpRes.caps.maxHpBonus}）！`);
        } else if (oid === "gather_lotus") {
          game.inventory.healing_pill = (game.inventory.healing_pill || 0) + 3;
          game.inventory.herb = (game.inventory.herb || 0) + 4;
          game.stones += 65;
          showToast("★ 采得千年寒莲！回春丹+3 · 凝气草+4 · 灵石+65！");
        } else if (oid === "condense_frost") {
          arena.stageElement = "frost";
          const atkRes = grantPermanentStatBonus(game, { atk: 10, source: "general" });
          showToast(atkRes.grantedAtk > 0
            ? `★ 玄冥寒霜入刃！剑道攻击永久 +${atkRes.grantedAtk}${atkRes.atkCapped ? `（已达本境上限 ${game.atkFlatBonus}/${atkRes.caps.atkFlatBonus}）` : ""}！`
            : `★ 玄冥寒霜入刃！（本境永久剑攻已达上限 ${game.atkFlatBonus}/${atkRes.caps.atkFlatBonus}）`);
        } else if (oid === "swallow_gold") {
          gainRealmXp(Math.max(55, Math.round((REALMS[game.realm].xpCap || 200) * 0.60)));
          const atkRes = grantPermanentStatBonus(game, { atk: 14, source: "general" });
          game.tribShield = (game.tribShield || 0) + 2;
          showToast(`★ 古丹化境！修为+60% · 攻击+${atkRes.grantedAtk}${atkRes.atkCapped ? `（已达上限 ${game.atkFlatBonus}/${atkRes.caps.atkFlatBonus}）` : ""} · 护脉丹障+2！`);
        } else if (oid === "inspect_furnace") {
          game.inventory.core = (game.inventory.core || 0) + 2;
          game.stones += 95;
          showToast("★ 参透古炉残方！妖核+2 · 灵石+95！");
        } else if (oid === "gift_pill") {
          acquireGearItem(rollGearItem(Math.max(1, arena.stageIdx + 1), 2, Math.random() < 0.5 ? "armor" : "ring"));
        }
        Sound.fanfare();
      }
      closeModal();
      saveGame();
      updateHud();
      return;
    }
    if (t.id === "btn-open-settings") { if (!game || isWelcomeScreenVisible()) return; openSettingsModal(); return; }
    if (t.id === "btn-open-profile") { if (!game || isWelcomeScreenVisible()) return; toggleDrawer("cultivate"); return; }
    if (t.id === "btn-quick-map") {
      if (!game) return;
      if (!guardNotInTribulation("太虚锁妖古塔")) return;
      if (game.status === "ascended") {
        openEndingModal();
        return;
      }
      if (!guardEcosystemAccess("demon_tower")) return;
      closeDrawer();
      initArenaStage(3, true);
      showToast(`踏入太虚锁妖内坛 · 第 ${game.towerFloor} 层`);
      return;
    }
    if (t.id === "btn-mainline-compass") {
      if (document.getElementById("tribulation-trigger-btn").style.display !== "none") {
        startLiveTribulation();
      } else if (game) {
        const chInfo = getActiveChapterInfo(game);
        showToast(`${chInfo.vol}：${chInfo.step}`);
      }
      return;
    }
    if (t.id === "btn-omen-banner" && game) {
      if (game.stones < 20) { showToast("改换星象需 20 灵石"); return; }
      game.stones -= 20;
      game.omenIndex = ((game.omenIndex || 0) + 1) % CELESTIAL_OMENS.length;
      Sound.fanfare();
      showToast(`星移 · ${currentOmen(game).name}（${currentOmen(game).short}）`);
      saveGame(); updateHud();
      return;
    }
    if (t.id === "btn-toggle-bgm") {
      Sound.bgmEnabled = !Sound.bgmEnabled;
      t.classList.toggle("active", Sound.bgmEnabled);
      return;
    }
    if (t.id === "btn-mute-audio") {
      Sound.muted = !Sound.muted;
      t.classList.toggle("active", Sound.muted);
      return;
    }

    if (t.hasAttribute("data-warp-stage")) {
      if (!guardNotInTribulation("秘境传送")) return;
      const targetIdx = Number(t.getAttribute("data-warp-stage"));
      const stg = STAGES[targetIdx];
      if (stg && rankOf(game.realm) < rankOf(stg.min)) {
        showToast(`需晋升至【${REALMS[stg.min].name}】方可前往${stg.name}`);
        return;
      }
      const bd = document.getElementById("modal-backdrop");
      if (bd && bd.classList.contains("open")) closeModal();
      closeDrawer();
      focusBattlefield();
      initArenaStage(targetIdx, false);
      saveGame();
      return;
    }
    if (t.hasAttribute("data-school")) {
      const sch = t.getAttribute("data-school");
      game.school = sch;
      ["mind", "builder", "finisher"].forEach(slot => {
        const curSk = SKILLS[game.loadout[slot]];
        if (!curSk || curSk.school !== sch) {
          const fallback = Object.values(SKILLS).find(s => s.school === sch && s.slot === slot && game.learned.includes(s.id));
          if (fallback) game.loadout[slot] = fallback.id;
        }
      });
      Sound.clang(1.1, 0.08);
      saveGame(); updateHud(); renderDrawerContent();
      return;
    }
    if (t.hasAttribute("data-skill")) {
      const sk = SKILLS[t.getAttribute("data-skill")];
      if (!sk) return;
      if (rankOf(game.realm) < rankOf(sk.min)) {
        showToast(`需达【${REALMS[sk.min].name}】方可领悟`);
        return;
      }
      if (game.learned.includes(sk.id) || game.stones >= sk.price) {
        if (!game.learned.includes(sk.id)) { game.stones -= sk.price; game.learned.push(sk.id); }
        game.loadout[sk.slot] = sk.id;
        Sound.fanfare(); saveGame(); updateHud(); renderDrawerContent();
      } else {
        showToast(`需 ${sk.price} 灵石方可研习`);
      }
      return;
    }
    if (t.hasAttribute("data-pet")) {
      if (!guardEcosystemAccess("spirit_pet")) return;
      const pid = t.getAttribute("data-pet");
      if (!hasOwn(SPIRIT_PETS, pid)) return;
      game.pet.id = pid;
      if (!game.pet.level) game.pet.level = 1;
      if (!game.pet.skills || typeof game.pet.skills !== "object") game.pet.skills = { tier3: null, tier5: null };
      queueNewUnlockCardsForState(game);
      Sound.fanfare(); saveGame(); updateHud(); renderDrawerContent();
      return;
    }
    if (t.hasAttribute("data-story-id")) {
      resolveStoryChoice(t.getAttribute("data-story-id"), t.getAttribute("data-opt-id"), false);
      return;
    }
    if (t.hasAttribute("data-quick-craft")) {
      if (!guardNotInTribulation("丹道炼制")) return;
      if (!guardNotPracticeMode("丹道炼制")) return;
      const recId = t.getAttribute("data-quick-craft");
      if (consumeSuppressedClick("alchemy", recId)) return;
      const rec = RECIPES[recId];
      if (!rec) return;
      if (rec.reqCauldronLv && getSanctumLevel(game, "cauldron") < rec.reqCauldronLv) {
        showToast(`需将洞府【紫微丹鼎】升至 Lv.${rec.reqCauldronLv} 方可炼制！`);
        return;
      }
      const bd = computeRecipeCostBreakdown(game, rec);
      if (game.stones < bd.totalStoneCost) {
        showToast(`灵石不足（共需 ${bd.totalStoneCost} 灵石${bd.hasMissing ? `，含购入缺料 ${bd.matBuyCost} 灵石` : ""}）`);
        return;
      }
      if (bd.hasMissing) {
        openAlchemyBuyConfirmModal(rec.id, "quick");
        return;
      }
      executeAlchemyQuickCraft(rec.id);
      return;
    }
    if (t.hasAttribute("data-relic")) {
      if (!guardNotInTribulation("本命法宝铸造与佩带")) return;
      if (!guardNotPracticeMode("本命法宝铸造与佩带")) return;
      const rel = RELICS[t.getAttribute("data-relic")];
      if (!rel) return;
      const fairDisc = currentOmen(game).id === "fair" ? 0.8 : 1.0;
      const rCost = Math.round(rel.stones * fairDisc);
      if (game.ownedRelics.includes(rel.id) || game.stones >= rCost) {
        if (!game.ownedRelics.includes(rel.id)) {
          game.stones -= rCost;
          game.ownedRelics.push(rel.id);
          game.relicStars[rel.id] = 1;
        }
        game.loadout.relic = rel.id;
        syncFlyingSwords(); Sound.fanfare();
        showToast(`佩带本命法宝【${rel.name} ★${game.relicStars[rel.id] || 1}】！`);
        saveGame(); updateHud(); renderDrawerContent();
      } else showToast(`铸造需 ${rCost} 灵石`);
      return;
    }

    const act = t.getAttribute("data-action");
    if (act === "challenge-tower") {
      if (!guardNotInTribulation("太虚锁妖古塔")) return;
      if (!guardEcosystemAccess("demon_tower")) return;
      const bd = document.getElementById("modal-backdrop");
      if (bd && bd.classList.contains("open")) closeModal();
      closeDrawer();
      focusBattlefield();
      initArenaStage(3, true);
      saveGame();
    } else if (act === "feed-pet" && game.pet.id) {
      if (!guardNotInTribulation("灵宠喂养进阶")) return;
      if (!guardNotPracticeMode("灵宠喂养进阶")) return;
      const curLv = Math.max(1, Math.min(5, Math.floor(num(game.pet.level, 1))));
      if (curLv >= 5) { showToast("灵兽已臻化境 Lv.5"); return; }
      const cost = getPetNextFeedCost(curLv);
      if (!cost) return;
      if (!canAffordPetFeed(game)) {
        const missStr = getPetFeedMissingSummary(game);
        showToast(`喂养升至 Lv.${cost.nextLevel} 灵材不足：缺 ${missStr}（可赴秘境斩妖或宗门悬赏获取）`);
        return;
      }
      Object.entries(cost.mats).forEach(([mk, req]) => {
        game.inventory[mk] = Math.max(0, Math.floor(num(game.inventory[mk], 0)) - req);
      });
      game.pet.level = cost.nextLevel;
      if (!game.pet.skills || typeof game.pet.skills !== "object") game.pet.skills = { tier3: null, tier5: null };
      if (game.pet.level >= 3) unlockAchievement("ach_pet3");
      Sound.fanfare();
      saveGame(); updateHud(); renderDrawerContent();
      showToast(`🐾 本命灵宠晋升 Lv.${game.pet.level}（消耗 ${formatPetFeedCost(cost, null)}）！`);
      if (game.pet.level === 3 && !game.pet.skills.tier3) {
        const panel = document.getElementById("jade-panel");
        const trig = panel ? (panel.querySelector('[data-open-pet-skill-tier="3"]') || panel.querySelector('[data-action="feed-pet"]')) : null;
        openPetSkillChoiceModal(3);
        if (trig && isElementFocusable(trig)) lastModalTriggerEl = trig;
      } else if (game.pet.level === 5 && !game.pet.skills.tier5) {
        const panel = document.getElementById("jade-panel");
        const trig = panel ? (panel.querySelector('[data-open-pet-skill-tier="5"]') || panel.querySelector('[data-action="feed-pet"]')) : null;
        openPetSkillChoiceModal(5);
        if (trig && isElementFocusable(trig)) lastModalTriggerEl = trig;
      }
    } else if (act === "gamble-jade") {
      if (!guardNotInTribulation("原石切玉")) return;
      if (!guardNotPracticeMode("原石切玉")) return;
      if (isAllDaoLawsCollected(game)) {
        showToast("诸天大道法则已尽数参悟，无需再行切玉赌注！");
        if (drawerOpen) renderDrawerContent();
        return;
      }
      const cost = currentOmen(game).id === "fair" ? 48 : 60;
      if (game.stones >= cost) {
        game.stones -= cost; game.jadeCuts += 1;
        unlockAchievement("ach_jade");
        closeDrawer();
        saveGame(); updateHud();
        openIconicUpgradeDraft("一剑切出鸿蒙仙髓！", false, { source: "jade_wager" });
      } else {
        showToast(`灵石不足（切玉需 ${cost} 灵石）`);
      }
    } else if (act === "show-verdict") {
      closeDrawer(); openEndingModal();
    } else if (act === "reincarnate-now") {
      executeReincarnation({ source: "ascension" });
    }
  });

  // Rescued delegated DOM listeners (audio stems, workshop, a11y sliders, cultivate details toggle, combo/temper/expedition change)
  document.addEventListener("input", (ev) => {
    const t = ev.target;
    if (!t) return;
    if (t.hasAttribute && t.hasAttribute("data-stem-key")) {
      const sk = t.getAttribute("data-stem-key");
      Sound.stems[sk] = Number(t.value) / 100;
      const lbl = document.getElementById(`lbl-stem-${sk}`);
      if (lbl) lbl.textContent = `${t.value}%`;
      saveAudioStems();
      return;
    }
    if (t.id === "sel-ws-boss1" || t.id === "sel-ws-boss2" || t.id === "sel-ws-hazards" || t.id === "sel-ws-curio") {
      if (t.id === "sel-ws-boss1") workshopState.boss1 = Number(t.value);
      if (t.id === "sel-ws-boss2") workshopState.boss2 = Number(t.value);
      if (t.id === "sel-ws-hazards") workshopState.hazards = Number(t.value);
      if (t.id === "sel-ws-curio") workshopState.curioIdx = Number(t.value);
      const inp = document.getElementById("inp-workshop-seed");
      if (inp) inp.value = encodeWorkshopSeed(workshopState);
      return;
    }
    if (t.id === "rng-a11y-shake") {
      a11ySettings.shakeScale = Number(t.value) / 100;
      const lbl = document.getElementById("lbl-a11y-shake");
      if (lbl) lbl.textContent = `${t.value}%`;
      saveA11ySettings();
    } else if (t.id === "rng-a11y-hitstop") {
      a11ySettings.hitStopScale = Number(t.value) / 100;
      const lbl = document.getElementById("lbl-a11y-hitstop");
      if (lbl) lbl.textContent = `${t.value}%`;
      saveA11ySettings();
    }
  });

  const panelScrollBodyEl = document.getElementById("panel-scroll-body");
  if (panelScrollBodyEl) {
    panelScrollBodyEl.addEventListener("toggle", (ev) => {
      const det = ev.target;
      if (!det || det.tagName !== "DETAILS") return;
      const grp = det.getAttribute("data-cultivate-group");
      if (grp && hasOwn(cultivateGroupOpen, grp)) {
        cultivateGroupOpen[grp] = !!det.open;
        if (grp === "collection" && det.open) {
          requestAnimationFrame(renderWardrobePreviewCanvas);
        }
      }
    }, true);
  }

  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (!t) return;
    if (t.hasAttribute && t.hasAttribute("data-seq-slot") && game) {
      const idx = Number(t.getAttribute("data-seq-slot"));
      const seq = ensureCustomComboSeq(game);
      if (COMBO_SEQ_MODULES[t.value]) {
        seq.slots[idx] = t.value;
        seq.enabled = true;
        saveGame();
        syncV24GenesisDock();
        openComboSequencerModal();
      }
      return;
    }
    if (t.hasAttribute && t.hasAttribute("data-temper-core-toggle") && game) {
      temperUseCoreDiscount = !!t.checked && Math.max(0, Math.floor(num(game.inventory && game.inventory.core, 0))) > 0;
      if (drawerOpen) renderDrawerContent();
      const chk = document.getElementById("chk-temper-use-core");
      if (chk && !chk.disabled) {
        try { chk.focus({ preventScroll: true }); } catch (e) {}
      }
      return;
    }
    if (t.hasAttribute && t.hasAttribute("data-exp-node") && game) {
      const nid = t.getAttribute("data-exp-node");
      assignExpeditionNode(game, nid, t.value || "");
      openExpeditionSandboxModal();
      return;
    }

    if (t.id === "sel-ws-boss1" || t.id === "sel-ws-boss2" || t.id === "sel-ws-hazards" || t.id === "sel-ws-curio") {
      if (t.id === "sel-ws-boss1") workshopState.boss1 = Number(t.value);
      if (t.id === "sel-ws-boss2") workshopState.boss2 = Number(t.value);
      if (t.id === "sel-ws-hazards") workshopState.hazards = Number(t.value);
      if (t.id === "sel-ws-curio") workshopState.curioIdx = Number(t.value);
      const inp = document.getElementById("inp-workshop-seed");
      if (inp) inp.value = encodeWorkshopSeed(workshopState);
    }
  });
