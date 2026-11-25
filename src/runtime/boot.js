  window.addEventListener("load", () => {
    preloadSprites();
    if (typeof syncAudioToggleUi === "function") syncAudioToggleUi();
    document.body.setAttribute('data-celestial-phase', getCurrentCelestialPhase().id);
    resizeCanvas();
    initAmbientEcosystem();
    renderWelcomeScreen();
    requestAnimationFrame(mainLoop);
  });
