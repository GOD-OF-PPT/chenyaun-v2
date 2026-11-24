  // ==================== 13. MAIN 60FPS RUNTIME LOOP SHELL ====================
  setInterval(() => {
    if (game && !arena.paused && document.getElementById("welcome-screen").style.display === "none") {
      Sound.tickBgm(arena.enemies.length > 0);
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
