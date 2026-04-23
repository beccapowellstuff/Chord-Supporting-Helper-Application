const PHRASE_ROLE_MAP = Object.freeze({
  continue: {
    phraseIntent: "continue",
    resolutionBias: "low",
    cadenceAllowance: "avoid_strong"
  },
  begin_resolving: {
    phraseIntent: "soft_resolve",
    resolutionBias: "medium",
    cadenceAllowance: "allow_soft"
  },
  delay: {
    phraseIntent: "defer_arrival",
    resolutionBias: "low",
    cadenceAllowance: "avoid_strong"
  },
  arrive: {
    phraseIntent: "arrive",
    resolutionBias: "high",
    cadenceAllowance: "allow_strong"
  }
});

const BASS_BEHAVIOUR_MAP = Object.freeze({
  hold: "hold",
  descend: "down_step_bias",
  ascend: "up_step_bias"
});

const TOP_NOTE_BEHAVIOUR_MAP = Object.freeze({
  descend_softly: "down_soft",
  stay_near: "hold_or_neighbor",
  ascend_gently: "up_soft"
});

const COLOUR_MAP = Object.freeze({
  plain: {
    colourBudget: "triad_bias",
    complexityBudget: "low"
  },
  moderate: {
    colourBudget: "diatonic_extension_ok",
    complexityBudget: "medium"
  },
  lush: {
    colourBudget: "chromatic_colour_ok",
    complexityBudget: "medium_high"
  }
});

const STYLE_PRESETS = Object.freeze({
  neutral: Object.freeze({
    key: "neutral",
    label: "Neutral",
    details: "Balanced default with no strong style bias.",
    harmonicComplexity: "medium",
    extensionTolerance: "medium",
    pedalTolerance: "medium",
    ambiguityTolerance: "medium",
    cadenceBias: "balanced",
    chromaticTolerance: "low_medium",
    modalMixtureTolerance: "low_medium",
    emotionalColourBias: "neutral",
    directionalDrive: "medium"
  }),
  pop: Object.freeze({
    key: "pop",
    label: "Pop",
    details: "Clean, direct harmony with familiar chord movement.",
    harmonicComplexity: "low_medium",
    extensionTolerance: "low_medium",
    pedalTolerance: "low_medium",
    ambiguityTolerance: "low",
    cadenceBias: "clear",
    chromaticTolerance: "low",
    modalMixtureTolerance: "low",
    emotionalColourBias: "balanced",
    directionalDrive: "medium"
  }),
  folk_acoustic: Object.freeze({
    key: "folk_acoustic",
    label: "Folk / Acoustic",
    details: "Grounded, simple harmony with a natural tonal centre.",
    harmonicComplexity: "low",
    extensionTolerance: "low",
    pedalTolerance: "low_medium",
    ambiguityTolerance: "low",
    cadenceBias: "clear",
    chromaticTolerance: "low",
    modalMixtureTolerance: "low",
    emotionalColourBias: "warm",
    directionalDrive: "medium"
  }),
  jazz_leaning: Object.freeze({
    key: "jazz_leaning",
    label: "Jazz-leaning",
    details: "Richer colour, denser chords, and more extension tolerance.",
    harmonicComplexity: "high",
    extensionTolerance: "high",
    pedalTolerance: "medium",
    ambiguityTolerance: "medium_high",
    cadenceBias: "soft",
    chromaticTolerance: "medium_high",
    modalMixtureTolerance: "medium",
    emotionalColourBias: "colourful",
    directionalDrive: "medium"
  }),
  classical_leaning: Object.freeze({
    key: "classical_leaning",
    label: "Classical-leaning",
    details: "Clearer function, stronger phrase logic, and directed motion.",
    harmonicComplexity: "medium",
    extensionTolerance: "low_medium",
    pedalTolerance: "low_medium",
    ambiguityTolerance: "low_medium",
    cadenceBias: "clear",
    chromaticTolerance: "medium",
    modalMixtureTolerance: "low_medium",
    emotionalColourBias: "balanced",
    directionalDrive: "medium_high"
  }),
  cinematic_soundtrack: Object.freeze({
    key: "cinematic_soundtrack",
    label: "Cinematic / Soundtrack",
    details: "Atmospheric harmony with pedal tones and expressive colour.",
    harmonicComplexity: "medium_high",
    extensionTolerance: "medium_high",
    pedalTolerance: "high",
    ambiguityTolerance: "high",
    cadenceBias: "soft",
    chromaticTolerance: "medium",
    modalMixtureTolerance: "medium_high",
    emotionalColourBias: "expressive",
    directionalDrive: "medium"
  }),
  jrpg_game_score: Object.freeze({
    key: "jrpg_game_score",
    label: "JRPG / Game Score",
    details: "Expressive tonal colour with pedal tones and dramatic shifts.",
    harmonicComplexity: "medium_high",
    extensionTolerance: "medium_high",
    pedalTolerance: "high",
    ambiguityTolerance: "high",
    cadenceBias: "soft",
    chromaticTolerance: "medium",
    modalMixtureTolerance: "high",
    emotionalColourBias: "expressive",
    directionalDrive: "medium_high"
  })
});

const FEEL_PRESETS = Object.freeze({
  neutral: Object.freeze({
    key: "neutral",
    label: "Neutral",
    details: "No extra emotional push beyond the chosen behaviour.",
    emotionalColourBias: "neutral",
    directionalDrive: "medium",
    ambiguityShift: "none",
    cadenceShift: "none",
    brightnessBias: "neutral"
  }),
  gentle: Object.freeze({
    key: "gentle",
    label: "Gentle",
    details: "Soft, tender motion with light tension and smooth release.",
    emotionalColourBias: "tender",
    directionalDrive: "low",
    ambiguityShift: "slight_up",
    cadenceShift: "softer",
    brightnessBias: "soft"
  }),
  bittersweet: Object.freeze({
    key: "bittersweet",
    label: "Bittersweet",
    details: "Warm but aching colour with soft, shaded release.",
    emotionalColourBias: "bittersweet",
    directionalDrive: "medium",
    ambiguityShift: "up",
    cadenceShift: "softer",
    brightnessBias: "mixed"
  }),
  warm: Object.freeze({
    key: "warm",
    label: "Warm",
    details: "Consonant, welcoming colour with a supportive feel.",
    emotionalColourBias: "warm",
    directionalDrive: "medium_low",
    ambiguityShift: "slight_down",
    cadenceShift: "balanced",
    brightnessBias: "warm"
  }),
  bright: Object.freeze({
    key: "bright",
    label: "Bright",
    details: "Open, lifted colour with clearer harmonic light.",
    emotionalColourBias: "bright",
    directionalDrive: "medium",
    ambiguityShift: "down",
    cadenceShift: "clearer",
    brightnessBias: "bright"
  }),
  heroic: Object.freeze({
    key: "heroic",
    label: "Heroic",
    details: "Stronger uplift, purpose, and forward harmonic motion.",
    emotionalColourBias: "uplifted",
    directionalDrive: "high",
    ambiguityShift: "down",
    cadenceShift: "clearer",
    brightnessBias: "bright"
  }),
  mysterious: Object.freeze({
    key: "mysterious",
    label: "Mysterious",
    details: "Ambiguous, suspended colour with less immediate clarity.",
    emotionalColourBias: "enigmatic",
    directionalDrive: "medium_low",
    ambiguityShift: "up",
    cadenceShift: "softer",
    brightnessBias: "dark_mixed"
  }),
  tense: Object.freeze({
    key: "tense",
    label: "Tense",
    details: "Retained pressure, instability, and delayed release.",
    emotionalColourBias: "strained",
    directionalDrive: "high",
    ambiguityShift: "medium_up",
    cadenceShift: "delayed",
    brightnessBias: "neutral_dark"
  }),
  dark: Object.freeze({
    key: "dark",
    label: "Dark",
    details: "Heavier, shadowed colour with reduced brightness.",
    emotionalColourBias: "dark",
    directionalDrive: "medium",
    ambiguityShift: "slight_up",
    cadenceShift: "softer",
    brightnessBias: "dark"
  }),
  powerful: Object.freeze({
    key: "powerful",
    label: "Powerful",
    details: "Strong drive, bold movement, and forceful phrase energy.",
    emotionalColourBias: "forceful",
    directionalDrive: "high",
    ambiguityShift: "slight_down",
    cadenceShift: "clearer",
    brightnessBias: "bold"
  })
});

export const DEFAULT_AI_SUGGESTION_BEHAVIOR = Object.freeze({
  drawerOpen: false,
  profile: "precise",
  phraseRole: "flexible",
  bassBehaviour: "flexible",
  topNoteBehaviour: "flexible",
  colour: "flexible",
  style: "neutral",
  feel: "neutral"
});

function clampWindowSize(windowSize, fallback = 8) {
  return Math.max(6, Math.min(8, Number(windowSize) || fallback));
}

function getRecentMotionDirection(labels = [], key = "bassMidi") {
  const values = (Array.isArray(labels) ? labels : [])
    .map(item => Number(item?.[key]))
    .filter(Number.isFinite);
  if (values.length < 2) {
    return "hold";
  }

  const delta = values.at(-1) - values.at(-2);
  if (delta < 0) {
    return "descend";
  }
  if (delta > 0) {
    return "ascend";
  }
  return "hold";
}

function resolveFlexiblePhraseRole(analysis = {}) {
  const phrasePosition = String(analysis?.phrasePosition || "").toLowerCase();
  const cadenceExpectation = String(analysis?.cadenceExpectation || "").toLowerCase();
  const latestCadence = String(analysis?.latestCadence || "").toLowerCase();
  const strongestCadence = String(analysis?.strongestCadence || "").toLowerCase();

  const hasStrongCadence = ["authentic", "plagal", "deceptive"].includes(latestCadence)
    || ["authentic", "plagal", "deceptive"].includes(strongestCadence);

  if (hasStrongCadence || (phrasePosition.includes("cadence") && cadenceExpectation.includes("return"))) {
    return "arrive";
  }

  if (
    cadenceExpectation.includes("return")
    || cadenceExpectation.includes("resolve")
    || phrasePosition.includes("turnaround")
  ) {
    return "begin_resolving";
  }

  if (cadenceExpectation.includes("reopen")) {
    return "delay";
  }

  return "continue";
}

function resolveFlexibleBassBehaviour(context = {}) {
  if (context?.pedalBassCue) {
    return "hold";
  }

  return getRecentMotionDirection(context?.recentVoicingLabels, "bassMidi");
}

function resolveFlexibleTopNoteBehaviour(context = {}) {
  const motion = getRecentMotionDirection(context?.recentVoicingLabels, "topMidi");
  if (motion === "descend") {
    return "descend_softly";
  }
  if (motion === "ascend") {
    return "ascend_gently";
  }
  return "stay_near";
}

function resolveFlexibleColour(analysis = {}) {
  const establishedBorrowedCount = Array.isArray(analysis?.establishedBorrowedChords)
    ? analysis.establishedBorrowedChords.length
    : 0;
  const harmonicLanguage = String(analysis?.harmonicLanguage || "").toLowerCase();
  const cadenceExpectation = String(analysis?.cadenceExpectation || "").toLowerCase();

  if (establishedBorrowedCount > 0 || harmonicLanguage.includes("borrowed")) {
    return "moderate";
  }

  if (cadenceExpectation.includes("reopen")) {
    return "moderate";
  }

  return "plain";
}

function getAllowRepetition(phraseIntent, bassMotionIntent) {
  if (bassMotionIntent === "hold" && phraseIntent === "continue") {
    return "allow_same_bass_only";
  }

  if (phraseIntent === "continue" || phraseIntent === "defer_arrival") {
    return "limited";
  }

  return "none";
}

export function getAiSuggestionProfileConfig(profile = "precise") {
  const normalizedProfile = String(profile || "precise").trim().toLowerCase() || "precise";
  if (normalizedProfile === "expressive") {
    return {
      profile: "expressive",
      reasoningEffort: "on",
      temperature: 0.6,
      maxOutputTokens: 1400,
      thinkingMode: "on",
      recentWindowSize: 8
    };
  }

  return {
    profile: "precise",
    reasoningEffort: "off",
    temperature: 0.3,
    maxOutputTokens: 950,
    thinkingMode: "off",
    recentWindowSize: 6
  };
}

export function getAiSuggestionStylePreset(style = "neutral") {
  const normalizedStyle = String(style || "neutral").trim().toLowerCase() || "neutral";
  return STYLE_PRESETS[normalizedStyle] || STYLE_PRESETS.neutral;
}

export function getAiSuggestionFeelPreset(feel = "neutral") {
  const normalizedFeel = String(feel || "neutral").trim().toLowerCase() || "neutral";
  return FEEL_PRESETS[normalizedFeel] || FEEL_PRESETS.neutral;
}

export function normalizeAiSuggestionBehavior(behavior = {}, context = {}) {
  const analysis = context?.analysis || {};
  const profile = String(behavior?.profile || DEFAULT_AI_SUGGESTION_BEHAVIOR.profile).trim().toLowerCase() || "precise";
  const profileConfig = getAiSuggestionProfileConfig(profile);

  const phraseRole = String(behavior?.phraseRole || DEFAULT_AI_SUGGESTION_BEHAVIOR.phraseRole).trim().toLowerCase() || "flexible";
  const bassBehaviour = String(behavior?.bassBehaviour || DEFAULT_AI_SUGGESTION_BEHAVIOR.bassBehaviour).trim().toLowerCase() || "flexible";
  const topNoteBehaviour = String(behavior?.topNoteBehaviour || DEFAULT_AI_SUGGESTION_BEHAVIOR.topNoteBehaviour).trim().toLowerCase() || "flexible";
  const colour = String(behavior?.colour || DEFAULT_AI_SUGGESTION_BEHAVIOR.colour).trim().toLowerCase() || "flexible";
  const style = String(behavior?.style || DEFAULT_AI_SUGGESTION_BEHAVIOR.style).trim().toLowerCase() || "neutral";
  const feel = String(behavior?.feel || DEFAULT_AI_SUGGESTION_BEHAVIOR.feel).trim().toLowerCase() || "neutral";

  const resolvedPhraseRole = phraseRole === "flexible" ? resolveFlexiblePhraseRole(analysis) : phraseRole;
  const resolvedBassBehaviour = bassBehaviour === "flexible" ? resolveFlexibleBassBehaviour(context) : bassBehaviour;
  const resolvedTopNoteBehaviour = topNoteBehaviour === "flexible" ? resolveFlexibleTopNoteBehaviour(context) : topNoteBehaviour;
  const resolvedColour = colour === "flexible" ? resolveFlexibleColour(analysis) : colour;

  const phraseConfig = PHRASE_ROLE_MAP[resolvedPhraseRole] || PHRASE_ROLE_MAP.continue;
  const colourConfig = COLOUR_MAP[resolvedColour] || COLOUR_MAP.plain;
  const styleConfig = getAiSuggestionStylePreset(style);
  const feelConfig = getAiSuggestionFeelPreset(feel);
  const phraseIntent = phraseConfig.phraseIntent;
  const bassMotionIntent = BASS_BEHAVIOUR_MAP[resolvedBassBehaviour] || "hold";
  const topLineIntent = TOP_NOTE_BEHAVIOUR_MAP[resolvedTopNoteBehaviour] || "hold_or_neighbor";
  const allowBorrowedChords = resolvedColour !== "plain" || (Array.isArray(analysis?.establishedBorrowedChords) && analysis.establishedBorrowedChords.length > 0);
  const allowAppliedDominants = resolvedColour === "lush" || phraseIntent === "soft_resolve" || phraseIntent === "arrive";

  return {
    requested: {
      profile,
      phraseRole,
      bassBehaviour,
      topNoteBehaviour,
      colour,
      style,
      feel
    },
    resolved: {
      profile,
      phraseRole: resolvedPhraseRole,
      bassBehaviour: resolvedBassBehaviour,
      topNoteBehaviour: resolvedTopNoteBehaviour,
      colour: resolvedColour,
      style: styleConfig.key,
      styleLabel: styleConfig.label,
      feel: feelConfig.key,
      feelLabel: feelConfig.label
    },
    normalized: {
      profile,
      phraseIntent,
      bassMotionIntent,
      topLineIntent,
      colourBudget: colourConfig.colourBudget,
      resolutionBias: phraseConfig.resolutionBias,
      cadenceAllowance: phraseConfig.cadenceAllowance,
      complexityBudget: colourConfig.complexityBudget,
      stylePreset: styleConfig.label,
      styleDetails: styleConfig.details,
      styleGuidance: {
        harmonicComplexity: styleConfig.harmonicComplexity,
        extensionTolerance: styleConfig.extensionTolerance,
        pedalTolerance: styleConfig.pedalTolerance,
        ambiguityTolerance: styleConfig.ambiguityTolerance,
        cadenceBias: styleConfig.cadenceBias,
        chromaticTolerance: styleConfig.chromaticTolerance,
        modalMixtureTolerance: styleConfig.modalMixtureTolerance,
        emotionalColourBias: styleConfig.emotionalColourBias,
        directionalDrive: styleConfig.directionalDrive
      },
      feelPreset: feelConfig.label,
      feelDetails: feelConfig.details,
      feelGuidance: {
        emotionalColourBias: feelConfig.emotionalColourBias,
        directionalDrive: feelConfig.directionalDrive,
        ambiguityShift: feelConfig.ambiguityShift,
        cadenceShift: feelConfig.cadenceShift,
        brightnessBias: feelConfig.brightnessBias
      },
      candidateCount: 6,
      recentWindowSize: clampWindowSize(profileConfig.recentWindowSize, 8),
      mustRespectBassTopContext: true,
      allowBorrowedChords,
      allowAppliedDominants,
      allowRepetition: getAllowRepetition(phraseIntent, bassMotionIntent)
    },
    profileConfig
  };
}
