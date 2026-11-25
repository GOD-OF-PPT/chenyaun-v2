  // ==================== 13. MAIN 60FPS RUNTIME LOOP SHELL ====================
  setInterval(() => {
    const onWelcome = !game || document.getElementById("welcome-screen").style.display !== "none";
    if (!onWelcome && !arena.paused) {
      Sound.tickBgm(arena.enemies.length > 0);
      if (typeof isClearSettling !== "function" || !isClearSettling()) {
        const stg = arena.sanctumMode ? STAGES[1] : arena.towerMode ? STAGES[3] : STAGES[arena.stageIdx];
        const domWeather = arena.bossDomain ? arena.bossDomain.weather : null;
        const isRainy = Boolean(!arena.sanctumMode && ((stg && stg.particleKind === "rain_mist") || domWeather === "blood_rain"));
        Sound.syncRainAmbience(isRainy ? (arena.enemies.length > 0 ? "combat" : "calm") : "off", 0.45);
      }
    } else if (!onWelcome && cutscene.active && !arena.sanctumMode) {
      const stg = arena.towerMode ? STAGES[3] : STAGES[arena.stageIdx];
      const domWeather = arena.bossDomain ? arena.bossDomain.weather : null;
      const isRainy = Boolean((stg && stg.particleKind === "rain_mist") || domWeather === "blood_rain");
      Sound.syncRainAmbience(isRainy ? "calm" : "off", 0.45);
    } else if (onWelcome) {
      Sound.syncRainAmbience("off", 0.25);
    }
  }, 620);

  let lastTs = performance.now();
  function mainLoop(now) {
    const rawFrameMs = Math.max(0, now - lastTs);
    recordPerfFrameSample(rawFrameMs);
    const dt = Math.min(0.05, rawFrameMs / 1000);
    lastTs = now;
    stepArena(dt);
    stepCombatCalmScheduler(dt);
    renderArenaCanvas();
    if (drawerOpen && currentTab === "cultivate") renderWardrobePreviewCanvas();
    if (craftMinigame.open) renderCraftMinigameCanvas(dt);
    requestAnimationFrame(mainLoop);
  }
