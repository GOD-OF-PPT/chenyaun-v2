  window.addEventListener("load", () => {
    preloadSprites();
    document.body.setAttribute('data-celestial-phase', getCurrentCelestialPhase().id);
    resizeCanvas();
    initAmbientEcosystem();
    renderWelcomeScreen();
    requestAnimationFrame(mainLoop);
  });
