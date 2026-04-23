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

export const DEFAULT_AI_SUGGESTION_BEHAVIOR = Object.freeze({
  drawerOpen: false,
  profile: "precise",
  phraseRole: "flexible",
  bassBehaviour: "flexible",
  topNoteBehaviour: "flexible",
  colour: "flexible"
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

export function normalizeAiSuggestionBehavior(behavior = {}, context = {}) {
  const analysis = context?.analysis || {};
  const profile = String(behavior?.profile || DEFAULT_AI_SUGGESTION_BEHAVIOR.profile).trim().toLowerCase() || "precise";
  const profileConfig = getAiSuggestionProfileConfig(profile);

  const phraseRole = String(behavior?.phraseRole || DEFAULT_AI_SUGGESTION_BEHAVIOR.phraseRole).trim().toLowerCase() || "flexible";
  const bassBehaviour = String(behavior?.bassBehaviour || DEFAULT_AI_SUGGESTION_BEHAVIOR.bassBehaviour).trim().toLowerCase() || "flexible";
  const topNoteBehaviour = String(behavior?.topNoteBehaviour || DEFAULT_AI_SUGGESTION_BEHAVIOR.topNoteBehaviour).trim().toLowerCase() || "flexible";
  const colour = String(behavior?.colour || DEFAULT_AI_SUGGESTION_BEHAVIOR.colour).trim().toLowerCase() || "flexible";

  const resolvedPhraseRole = phraseRole === "flexible" ? resolveFlexiblePhraseRole(analysis) : phraseRole;
  const resolvedBassBehaviour = bassBehaviour === "flexible" ? resolveFlexibleBassBehaviour(context) : bassBehaviour;
  const resolvedTopNoteBehaviour = topNoteBehaviour === "flexible" ? resolveFlexibleTopNoteBehaviour(context) : topNoteBehaviour;
  const resolvedColour = colour === "flexible" ? resolveFlexibleColour(analysis) : colour;

  const phraseConfig = PHRASE_ROLE_MAP[resolvedPhraseRole] || PHRASE_ROLE_MAP.continue;
  const colourConfig = COLOUR_MAP[resolvedColour] || COLOUR_MAP.plain;
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
      colour
    },
    resolved: {
      profile,
      phraseRole: resolvedPhraseRole,
      bassBehaviour: resolvedBassBehaviour,
      topNoteBehaviour: resolvedTopNoteBehaviour,
      colour: resolvedColour
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
