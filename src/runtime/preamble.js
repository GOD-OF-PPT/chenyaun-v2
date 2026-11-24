  const SVG = {
    sword: `<svg class="svg-ico" viewBox="0 0 24 24"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6M16 16l4 4"/></svg>`,
    spark: `<svg class="svg-ico" viewBox="0 0 24 24"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>`,
    crown: `<svg class="svg-ico" viewBox="0 0 24 24"><path d="M3 18h18M4 15l2-9 6 5 6-5 2 9H4z"/></svg>`
  };

  // ==================== 1. WEB AUDIO FOLEY, TAIKO DRUM, METALLIC CLANG & GUOFENG BGM ====================
  const Sound = {
    ctx: null, muted: false, bgmEnabled: true, bgmStep: 0, noiseBuf: null,
    bgmFilter: null, bgmDuckGain: null, reverbNode: null, reverbWet: null,
    duckState: { active: false, hz: 18500, gain: 1.0, restoreTimer: null },
    cueLog: [],
    lastCue: null,
    recordCue(cue, tier = "ui", meta = {}) {
      const stemKey = meta && meta.stem ? meta.stem : null;
      const stemVal = stemKey && this.stems && typeof this.stems[stemKey] === "number" ? this.stems[stemKey] : 1.0;
      const stemMuted = stemVal <= 0.0005;
      const rec = Object.assign({}, meta, {
        cue,
        tier,
        ts: Date.now(),
        audible: Boolean(this.ctx && !this.muted && !stemMuted),
        stemMuted,
        stemVal: Number(stemVal.toFixed(2))
      });
      this.lastCue = rec;
      this.cueLog.push(rec);
      if (this.cueLog.length > 40) this.cueLog.shift();
      return rec;
    },
    getCueLog() {
      return this.cueLog.slice();
    },
    clearCueLog() {
      this.cueLog.length = 0;
      this.lastCue = null;
    },
    ensure() {
      if (this.muted) return null;
      if (typeof navigator !== "undefined" && navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      if (this.ctx && !this.noiseBuf) {
        const sr = this.ctx.sampleRate;
        const len = Math.floor(sr * 0.25);
        const buf = this.ctx.createBuffer(1, len, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.32));
        this.noiseBuf = buf;

        // V16 BGM Dynamic Low-Pass Filter + Sidechain Ducking Bus
        this.bgmFilter = this.ctx.createBiquadFilter();
        this.bgmFilter.type = "lowpass";
        this.bgmFilter.frequency.value = 18500;
        this.bgmFilter.Q.value = 0.9;
        this.bgmDuckGain = this.ctx.createGain();
        this.bgmDuckGain.gain.value = 1.0;
        this.bgmFilter.connect(this.bgmDuckGain).connect(this.ctx.destination);

        // V16 Procedural Stereo Canyon-Shrine Spatial Convolver Reverb (1.25s tail)
        try {
          const irLen = Math.floor(sr * 1.25);
          const irBuf = this.ctx.createBuffer(2, irLen, sr);
          for (let ch = 0; ch < 2; ch++) {
            const cd = irBuf.getChannelData(ch);
            for (let i = 0; i < irLen; i++) {
              const t = i / irLen;
              const early = (i === Math.floor(sr * 0.028) || i === Math.floor(sr * 0.061)) ? 0.55 : 0;
              cd[i] = ((Math.random() * 2 - 1) * Math.pow(1 - t, 2.75) * 0.48) + early;
            }
          }
          this.reverbNode = this.ctx.createConvolver();
          this.reverbNode.buffer = irBuf;
          this.reverbWet = this.ctx.createGain();
          this.reverbWet.gain.value = 0.24;
          this.reverbNode.connect(this.reverbWet).connect(this.ctx.destination);
        } catch (e) {}
      }
      return this.ctx;
    },
    lastPanVal: 0,
    lastSurface: "stone",
    stems: { guqin: 1.0, chime: 1.0, drum: 1.0, blade: 1.0, reverb: 1.0 },
    connectSfxOut(node, wetSend = 0.28, worldX = null) {
      wetSend = wetSend * (this.stems ? this.stems.reverb : 1.0);
      if (!this.ctx) return;
      let outNode = node;
      if (worldX !== null && typeof this.ctx.createStereoPanner === "function") {
        try {
          const cv = document.getElementById("fx-canvas");
          const w = (cv && cv.width) ? cv.width : 1440;
          const refX = (arena && arena.player) ? arena.player.x : w * 0.5;
          const pan = Math.max(-0.92, Math.min(0.92, (worldX - refX) / (w * 0.45)));
          this.lastPanVal = Number(pan.toFixed(2));
          const panner = this.ctx.createStereoPanner();
          panner.pan.setValueAtTime(pan, this.ctx.currentTime);
          node.connect(panner);
          outNode = panner;
        } catch (e) {}
      }
      outNode.connect(this.ctx.destination);
      if (this.reverbNode && wetSend > 0) {
        const sg = this.ctx.createGain();
        sg.gain.value = wetSend;
        outNode.connect(sg).connect(this.reverbNode);
      }
    },
    footstep(surface = "stone", worldX = null) {
      this.lastSurface = surface;
      const ctx = this.ensure();
      if (!ctx || this.muted) return;
      const now = ctx.currentTime;
      if (surface === "water") {
        // Crisp shallow spirit-spring splash droplets
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(680 + Math.random() * 240, now);
        osc.frequency.exponentialRampToValueAtTime(1180, now + 0.065);
        g.gain.setValueAtTime(0.032, now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.075);
        osc.connect(g); this.connectSfxOut(g, 0.35, worldX);
        osc.start(now); osc.stop(now + 0.08);
      } else if (surface === "jade") {
        // Crystalline Sanctum white-jade step tap
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(1320 + Math.random() * 140, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.045);
        g.gain.setValueAtTime(0.026, now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.052);
        osc.connect(g); this.connectSfxOut(g, 0.32, worldX);
        osc.start(now); osc.stop(now + 0.06);
      } else if (surface === "scorch") {
        // Gritty sword-graveyard gravel & ember step
        if (this.noiseBuf) {
          const src = ctx.createBufferSource();
          src.buffer = this.noiseBuf;
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.frequency.setValueAtTime(980 + Math.random() * 220, now);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.035, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
          src.connect(bp).connect(g); this.connectSfxOut(g, 0.14, worldX);
          src.start(now);
        }
      } else {
        // Solid mossy bluestone tap
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(195 + Math.random() * 35, now);
        osc.frequency.exponentialRampToValueAtTime(72, now + 0.05);
        g.gain.setValueAtTime(0.034, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
        osc.connect(g); this.connectSfxOut(g, 0.18, worldX);
        osc.start(now); osc.stop(now + 0.06);
      }
    },
    airLandWhoosh(surface = "stone", worldX = null) {
      this.footstep(surface, worldX);
      const ctx = this.ensure();
      if (!ctx || this.muted || !this.noiseBuf) return;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(860, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.055, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      src.connect(lp).connect(g); this.connectSfxOut(g, 0.24, worldX);
      src.start(now);
    },
    spatialSwordHum(worldX) {
      const ctx = this.ensure();
      if (!ctx || this.muted) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(740 + Math.random() * 180, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.11);
      g.gain.setValueAtTime(0.022, now);
      g.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);
      osc.connect(g); this.connectSfxOut(g, 0.22, worldX);
      osc.start(now); osc.stop(now + 0.13);
    },
    soulManifestRoar() {
      this.triggerDucking(360, 0.26, 900);
      this.drum(0.30);
      this.bianzhong(329.63, 0.12);
      this.clang(0.72, 0.16);
    },
    bladeClashGrind() {
      this.clang(1.55, 0.14);
      setTimeout(() => this.clang(1.72, 0.11), 55);
    },
    triggerDucking(lowpassHz = 380, duckVol = 0.26, holdMs = 1250) {
      this.duckState.active = true;
      this.duckState.hz = lowpassHz;
      this.duckState.gain = duckVol;
      const ctx = this.ensure();
      if (ctx && this.bgmFilter && this.bgmDuckGain) {
        const now = ctx.currentTime;
        this.bgmFilter.frequency.cancelScheduledValues(now);
        this.bgmDuckGain.gain.cancelScheduledValues(now);
        this.bgmFilter.frequency.setTargetAtTime(lowpassHz, now, 0.035);
        this.bgmDuckGain.gain.setTargetAtTime(duckVol, now, 0.028);
      }
      if (this.duckState.restoreTimer) clearTimeout(this.duckState.restoreTimer);
      this.duckState.restoreTimer = setTimeout(() => {
        this.duckState.active = false;
        this.duckState.hz = 18500;
        this.duckState.gain = 1.0;
        if (this.ctx && this.bgmFilter && this.bgmDuckGain) {
          const t2 = this.ctx.currentTime;
          this.bgmFilter.frequency.setTargetAtTime(18500, t2, 0.18);
          this.bgmDuckGain.gain.setTargetAtTime(1.0, t2, 0.16);
        }
      }, holdMs);
    },
    pluck(freq = 392, dur = 0.36, vol = 0.085, type = "triangle", toBgmBus = false) {
      vol = vol * (this.stems ? this.stems.guqin : 1.0);
      if (vol <= 0.0005) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.996, now + dur);
      g.gain.setValueAtTime(0.0008, now);
      g.gain.linearRampToValueAtTime(vol, now + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0007, now + dur);
      osc.connect(g);
      if (toBgmBus && this.bgmFilter) g.connect(this.bgmFilter);
      else this.connectSfxOut(g, 0.22);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    },
    clang(pitch = 1.0, vol = 0.12) {
      vol = vol * (this.stems ? this.stems.blade : 1.0);
      if (vol <= 0.0005) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      // Metallic inharmonic bell partials
      [1180 * pitch, 1795 * pitch, 2640 * pitch].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx === 0 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(f * 0.94, now + 0.24);
        g.gain.setValueAtTime(vol / (idx + 1.2), now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.26);
        osc.connect(g); this.connectSfxOut(g, 0.36);
        osc.start(now);
        osc.stop(now + 0.28);
      });
      // Crisp steel air burst
      if (this.noiseBuf) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(3200 * pitch, now);
        bp.Q.setValueAtTime(3.2, now);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(vol * 0.85, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        src.connect(bp).connect(ng).connect(ctx.destination);
        src.start(now);
      }
    },
    drum(vol = 0.2) {
      vol = vol * (this.stems ? this.stems.drum : 1.0);
      if (vol <= 0.0005) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(142, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.34);
      g.gain.setValueAtTime(vol, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    },
    qiOrb(combo) {
      const scale = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
      const f = scale[combo % scale.length];
      this.pluck(f, 0.32, 0.095, "sine");
      setTimeout(() => this.pluck(f * 1.5, 0.22, 0.055, "triangle"), 44);
    },
    slash(heavy, step = 0) {
      const bScale = this.stems ? this.stems.blade : 1.0;
      const ctx = (bScale > 0.0005) ? this.ensure() : null;
      this.recordCue(heavy ? "slash_heavy" : "slash_light", heavy ? "heavy" : "light", { stem: "blade", step });
      if (bScale <= 0.0005 || !ctx || this.muted) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sawtooth";
      const startF = heavy ? 980 : (620 + step * 110);
      osc.frequency.setValueAtTime(startF, now);
      osc.frequency.exponentialRampToValueAtTime(heavy ? 110 : 175, now + (heavy ? 0.28 : 0.15));
      g.gain.setValueAtTime((heavy ? 0.13 : 0.085) * bScale, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.3 : 0.17));
      osc.connect(g); this.connectSfxOut(g, 0.18);
      osc.start(now);
      osc.stop(now + (heavy ? 0.32 : 0.19));
      if (this.noiseBuf) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(1800, now);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime((heavy ? 0.09 : 0.05) * bScale, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        src.connect(hp).connect(ng); this.connectSfxOut(ng, 0.14);
        src.start(now);
      }
    },
    fanfare() {
      const qScale = this.stems ? this.stems.guqin : 1.0;
      if (qScale > 0.0005) this.ensure();
      this.recordCue("fanfare", "ui", { stem: "guqin" });
      [261.63, 329.63, 392.0, 523.25, 659.25].forEach((n, i) => {
        setTimeout(() => this.pluck(n, 0.52, 0.105, "triangle"), i * 72);
      });
    },
    deflectClang() {
      // Sekiro / Black Myth style resonant bronze-steel parry ring!
      const bScale = this.stems ? this.stems.blade : 1.0;
      if (bScale > 0.0005) this.ensure();
      this.recordCue("deflect_clang", "deflect", { stem: "blade" });
      this.clang(1.42, 0.20);
      this.bianzhong(783.99, 0.11);
      this.drum(0.24);
    },
    shieldAbsorb(kind = "player") {
      const cScale = this.stems ? this.stems.chime : 1.0;
      const ctx = (cScale > 0.0005) ? this.ensure() : null;
      this.recordCue("shield_absorb", "block", { kind, stem: "chime" });
      if (cScale <= 0.0005 || !ctx || this.muted) return;
      const now = ctx.currentTime;
      const baseF = kind === "enemy" ? 460 : 620;
      [1.0, 1.498].forEach((ratio, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx === 0 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(baseF * ratio, now);
        osc.frequency.exponentialRampToValueAtTime(baseF * ratio * 0.78, now + 0.18);
        g.gain.setValueAtTime((idx === 0 ? 0.085 : 0.048) * cScale, now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.20);
        osc.connect(g); this.connectSfxOut(g, 0.30);
        osc.start(now); osc.stop(now + 0.22);
      });
    },
    postureBreak() {
      const dScale = this.stems ? this.stems.drum : 1.0;
      const ctx = (dScale > 0.0005) ? this.ensure() : null;
      this.recordCue("posture_break", "break", { stem: "drum" });
      this.drum(0.30);
      this.clang(0.84, 0.18);
      this.bianzhong(440.0, 0.10);
      if (dScale <= 0.0005 || !ctx || this.muted) return;
      const now = ctx.currentTime;
      const sub = ctx.createOscillator();
      const g = ctx.createGain();
      sub.type = "sine";
      sub.frequency.setValueAtTime(124, now);
      sub.frequency.exponentialRampToValueAtTime(34, now + 0.36);
      g.gain.setValueAtTime(0.22 * dScale, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.39);
      sub.connect(g); this.connectSfxOut(g, 0.28);
      sub.start(now); sub.stop(now + 0.42);
    },
    playerHurt(isHeavy = false) {
      const dScale = this.stems ? this.stems.drum : 1.0;
      const ctx = (dScale > 0.0005) ? this.ensure() : null;
      this.recordCue("player_hurt", "hurt", { isHeavy: !!isHeavy, stem: "drum" });
      if (dScale <= 0.0005 || !ctx || this.muted) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(isHeavy ? 156 : 188, now);
      osc.frequency.exponentialRampToValueAtTime(44, now + (isHeavy ? 0.24 : 0.16));
      g.gain.setValueAtTime((isHeavy ? 0.20 : 0.14) * dScale, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.26 : 0.18));
      osc.connect(g); this.connectSfxOut(g, 0.18);
      osc.start(now); osc.stop(now + 0.28);
      if (this.noiseBuf) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(640, now);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime((isHeavy ? 0.09 : 0.055) * dScale, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        src.connect(lp).connect(ng); this.connectSfxOut(ng, 0.12);
        src.start(now);
      }
    },
    dialogueCue() {
      const qScale = this.stems ? this.stems.guqin : 1.0;
      if (qScale > 0.0005) this.ensure();
      this.recordCue("dialogue_cue", "ui", { stem: "guqin" });
      if (qScale <= 0.0005) return;
      this.pluck(523.25, 0.18, 0.045, "sine");
    },
    noticeCue(tier = 2) {
      const cScale = this.stems ? this.stems.chime : 1.0;
      if (cScale > 0.0005) this.ensure();
      this.recordCue("notice_cue", "ui", { noticeTier: tier, stem: "chime" });
      if (cScale <= 0.0005) return;
      this.bianzhong(tier <= 1 ? 659.25 : 587.33, tier <= 1 ? 0.065 : 0.042);
    },
    perilousGong() {
      const cScale = this.stems ? this.stems.chime : 1.0;
      const ctx = (cScale > 0.0005) ? this.ensure() : null;
      this.recordCue("perilous_gong", "ui", { perilous: true, stem: "chime" });
      this.triggerDucking(460, 0.34, 900);
      if (cScale <= 0.0005 || !ctx || this.muted) return;
      // Unmistakable ominous 【危】 warning chime!
      const now = ctx.currentTime;
      [196.0, 207.65, 392.0].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx === 1 ? "sawtooth" : "triangle";
        osc.frequency.setValueAtTime(f * 1.08, now);
        osc.frequency.exponentialRampToValueAtTime(f * 0.92, now + 0.48);
        g.gain.setValueAtTime((idx === 1 ? 0.045 : 0.085) * cScale, now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 0.52);
        osc.connect(g); this.connectSfxOut(g, 0.32);
        osc.start(now);
        osc.stop(now + 0.55);
      });
    },
    thunderCrack() {
      const dScale = this.stems ? this.stems.drum : 1.0;
      const ctx = (dScale > 0.0005) ? this.ensure() : null;
      this.recordCue("thunder_crack", "heavy", { stem: "drum" });
      if (dScale <= 0.0005 || !ctx || this.muted) return;
      const now = ctx.currentTime;
      this.drum(0.20);
      if (this.noiseBuf) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.setValueAtTime(1450, now);
        bp.Q.setValueAtTime(1.4, now);
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.14 * dScale, now);
        ng.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        src.connect(bp).connect(ng); this.connectSfxOut(ng, 0.26);
        src.start(now);
      }
    },
    fleshHit(tier = 1) {
      const bScale = this.stems ? this.stems.blade : 1.0;
      const ctx = (bScale > 0.0005) ? this.ensure() : null;
      this.recordCue(tier >= 2 ? "flesh_heavy" : "flesh_light", tier >= 2 ? "heavy" : "light", { hitTier: tier, stem: "blade" });
      if (bScale <= 0.0005 || !ctx || this.muted) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(tier >= 2 ? 168 : 230, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + (tier >= 2 ? 0.16 : 0.09));
      g.gain.setValueAtTime((tier >= 2 ? 0.12 : 0.065) * bScale, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(g); this.connectSfxOut(g, tier >= 2 ? 0.24 : 0.16);
      osc.start(now);
      osc.stop(now + 0.18);
    },
    bianzhong(freq = 523.25, vol = 0.08) {
      vol = vol * (this.stems ? this.stems.chime : 1.0);
      if (vol <= 0.0005) return;
      const ctx = this.ensure();
      if (!ctx || this.muted) return;
      const now = ctx.currentTime;
      [1.0, 2.02, 2.98].forEach((harm, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq * harm, now);
        g.gain.setValueAtTime(vol / (idx * 1.6 + 1), now);
        g.gain.exponentialRampToValueAtTime(0.0008, now + 1.35);
        osc.connect(g); this.connectSfxOut(g, 0.42);
        osc.start(now);
        osc.stop(now + 1.4);
      });
    },
    switchStanceChime(toHeavy = false) {
      const stemKey = toHeavy ? "chime" : "guqin";
      const stScale = this.stems ? this.stems[stemKey] : 1.0;
      const ctx = (stScale > 0.0005) ? this.ensure() : null;
      this.recordCue(toHeavy ? "stance_heavy" : "stance_light", "ui", { stem: stemKey });
      if (stScale <= 0.0005 || !ctx || this.muted) return;
      if (toHeavy) {
        this.bianzhong(293.66, 0.11);
        this.drum(0.22);
      } else {
        this.pluck(587.33, 0.24, 0.095, "triangle");
        setTimeout(() => this.pluck(880.0, 0.22, 0.075, "sine"), 36);
      }
    },
    shieldBreakSub() {
      const dScale = this.stems ? this.stems.drum : 1.0;
      const ctx = (dScale > 0.0005) ? this.ensure() : null;
      this.recordCue("shield_break", "break", { stem: "drum" });
      if (dScale <= 0.0005 || !ctx || this.muted) return;
      const now = ctx.currentTime;
      const sub = ctx.createOscillator();
      const g = ctx.createGain();
      sub.type = "sine";
      sub.frequency.setValueAtTime(145, now);
      sub.frequency.exponentialRampToValueAtTime(30, now + 0.42);
      g.gain.setValueAtTime(0.26 * dScale, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      sub.connect(g); this.connectSfxOut(g, 0.35);
      sub.start(now); sub.stop(now + 0.46);
      this.clang(0.78, 0.18);
    },
    coreSeverBoom() {
      const ctx = this.ensure();
      this.triggerDucking(330, 0.22, 1300);
      if (!ctx || this.muted) return;
      const now = ctx.currentTime;
      [98.0, 146.83].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = idx === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(f, now);
        osc.frequency.exponentialRampToValueAtTime(26, now + 0.62);
        g.gain.setValueAtTime(idx === 0 ? 0.28 : 0.14, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.connect(g); this.connectSfxOut(g, 0.48);
        osc.start(now); osc.stop(now + 0.68);
      });
      this.bianzhong(587.33, 0.13);
    },
    wallSplatCrunch() {
      this.drum(0.24);
      this.clang(0.68, 0.13);
    },
    skyLeapWhoosh() {
      this.pluck(659.25, 0.18, 0.065, "sine");
      setTimeout(() => this.pluck(880.0, 0.16, 0.055, "triangle"), 35);
    },
    vaultStompClang() {
      this.triggerDucking(380, 0.26, 860);
      this.drum(0.28);
      this.clang(1.32, 0.18);
      this.bianzhong(783.99, 0.11);
    },
    meteorPlungeBoom() {
      this.drum(0.32);
      this.shieldBreakSub();
      this.bianzhong(392.0, 0.10);
    },
    gourdSipChime() {
      this.qiOrb(4);
      setTimeout(() => this.bianzhong(659.25, 0.08), 50);
    },
    bgmModeName: "清平宫调",
    tickBgm(inBattle) {
      const hasInnerDemon = !!(arena && arena.enemies && arena.enemies.some(e => e.isInnerDemon));
      const hasPartBrokenBoss = !!(arena && arena.enemies && arena.enemies.some(e => e.isBoss && e.partSevered));
      const isBossOrTrib = !!(arena && (arena.tribulation || (arena.enemies && arena.enemies.some(e => e.isBoss && e.enraged))));
      const isSanctum = !!(arena && arena.sanctumMode);

      // V17 5-Phase Dynamic Guofeng Music Theory Key Modulation!
      this.bgmModeName = hasInnerDemon ? "变徵心魔调" : hasPartBrokenBoss ? "太簇破阵宫调" : isBossOrTrib ? "太虚羽杀调" : inBattle ? "青锋商战调" : "清平古琴调";
      if (this.muted || !this.bgmEnabled || !this.ctx || this.ctx.state !== "running") return;

      const sanctumSeq     = [261.63, 329.63, 392.0, 523.25, 440.0, 392.0, 329.63, 293.66];
      const calmSeq        = [261.63, 329.63, 392.0, 440.0, 523.25, 440.0, 392.0, 293.66];
      const battleSeq      = [293.66, 392.0, 440.0, 587.33, 523.25, 659.25, 587.33, 440.0];
      const bossSeq        = [220.0, 293.66, 329.63, 440.0, 392.0, 523.25, 440.0, 329.63];
      // Bright Heroic G-Gong Modulation upon severing Boss Weakpoint Core!
      const partBreakSeq   = [392.0, 440.0, 493.88, 587.33, 659.25, 783.99, 659.25, 587.33];
      // Tense Bianzhi / Jue Fate Scale for Inner Demon Mirror Finale!
      const innerDemonSeq  = [246.94, 261.63, 329.63, 369.99, 440.0, 493.88, 369.99, 329.63];

      const seq = hasInnerDemon ? innerDemonSeq : hasPartBrokenBoss ? partBreakSeq : isBossOrTrib ? bossSeq : inBattle ? battleSeq : isSanctum ? sanctumSeq : calmSeq;
      const note = seq[this.bgmStep % seq.length];
      this.bgmStep += 1;

      this.pluck(note, inBattle ? 0.28 : 0.95, (hasInnerDemon || hasPartBrokenBoss || isBossOrTrib) ? 0.052 : inBattle ? 0.038 : 0.026, inBattle ? "triangle" : "sine", true);
      if (this.bgmStep % (hasInnerDemon ? 2 : 4) === 1) {
        this.pluck(note * 0.5, isSanctum ? 1.6 : 1.05, 0.028, "sine", true);
      }
      if (hasInnerDemon || hasPartBrokenBoss || isBossOrTrib) {
        if (this.bgmStep % 2 === 0) this.drum(hasInnerDemon ? 0.10 : 0.085);
        if (this.bgmStep % (hasInnerDemon ? 4 : 8) === 0) this.bianzhong(note, 0.06);
      } else if (inBattle && this.bgmStep % 4 === 0) {
        this.drum(0.06);
      }
      if (!inBattle && this.bgmStep % 6 === 0) {
        this.pluck(note * 2.0, 0.85, 0.014, "sine", true);
      }
    }
  };

