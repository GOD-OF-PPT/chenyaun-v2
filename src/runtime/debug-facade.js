  // ==================== Q5 (F31/F32): ADDITIVE COMPAT DEBUG FACADE ====================
  // Strictly additive facade delegating to preserved window.__CHENYUAN_V18__..__CHENYUAN_V25__.
  window.__CHENYUAN_DEBUG__ = {
    version: "q5-compat-1",
    namespaces: {
      v18: window.__CHENYUAN_V18__,
      v19: window.__CHENYUAN_V19__,
      v20: window.__CHENYUAN_V20__,
      v21: window.__CHENYUAN_V21__,
      v22: window.__CHENYUAN_V22__,
      v23: window.__CHENYUAN_V23__,
      v24: window.__CHENYUAN_V24__,
      v25: window.__CHENYUAN_V25__
    },
    getNamespace: (ver) => {
      const key = String(ver || "").toLowerCase();
      return window.__CHENYUAN_DEBUG__.namespaces[key] || null;
    },
    getState: () => window.__CHENYUAN_V25__.getState(),
    rules: {
      computeCombatStatLedger,
      getCombatStats,
      effectiveGearVal,
      computeGearAffixBudget,
      rollGearItem,
      getLifespanInfo,
      previewLifespanImpact,
      computeRecipeCostBreakdown,
      computeBatchRecipeCost,
      computeBatchEnhancePreview,
      computeCompetitionScore,
      getScoreGrade,
      applySingleHitCap
    },
    persistence: {
      STORAGE_KEY,
      META_KEY,
      computeSaveChecksum,
      buildCanonicalSavePayload,
      parseAndValidateSaveRaw,
      mergeMetaStates,
      normalizeGearItem,
      normalizeLoadedGame,
      exportFullCloudSaveCode: (...args) => window.__CHENYUAN_V24__.exportFullCloudSaveCode(...args),
      importFullCloudSaveCode: (...args) => window.__CHENYUAN_V24__.importFullCloudSaveCode(...args)
    },
    art: {
      getCount: () => Object.keys(ART).length,
      getKeys: () => Object.keys(ART),
      getDecodeSummary: () => window.__CHENYUAN_V25__.getArtDecodeSummary()
    },
    telemetry: {
      getNoticeState: () => window.__CHENYUAN_V25__.getNoticeState(),
      getPendingRewards: () => window.__CHENYUAN_V25__.getPendingRewards(),
      getPauseTokens: () => window.__CHENYUAN_V25__.getPauseTokens(),
      getEncounterTelemetry: () => window.__CHENYUAN_V25__.getEncounterTelemetry(),
      getFramePerfSnapshot: () => window.__CHENYUAN_V25__.getFramePerfSnapshot()
    }
  };
