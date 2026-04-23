const BASE_TASK_LINES = [
  "You are a music theory assistant choosing the next single chord in a progression.",
  "Suggest chords that match the requested musical behaviour, not just generally plausible harmony.",
  "Prioritise controllable musical behaviour over vague mood language.",
  "Be exact about chord label, bass note, top note, and phrase function."
];

const OUTPUT_CONTRACT_LINES = [
  "Return JSON only. Do not include markdown fences or commentary.",
  "Return exactly 6 ranked suggestions when possible, from strongest to weakest.",
  'Use this exact shape: {"suggestions":[{"chord":"Am/E","bass":"E3","topNote":"C5","resolutionType":"begin resolving","confidence":0.78,"reason":"Short explanation"}]}',
  "Each suggestion must contain chord, bass, topNote, resolutionType, confidence, and reason.",
  "Use common ASCII chord spellings.",
  "If the bass differs from the chord root, the chord field must use slash-chord notation that matches the bass field.",
  "Use note names with octave numbers for bass and topNote when you can infer them reliably."
];

const PROFILE_INSTRUCTION_MAP = Object.freeze({
  precise: [
    "Prefer literal voice-leading fit over adventurous colour.",
    "Prefer simpler chord qualities unless extra colour clearly improves the fit.",
    "Avoid wide melodic jumps unless the requested behaviour strongly supports them."
  ],
  expressive: [
    "Allow tasteful extra colour when it still respects bass movement, top-note behaviour, and phrase role.",
    "You may use more colour than precise mode, but do not ignore the requested behaviour.",
    "Keep the results bounded and musically coherent rather than random."
  ]
});

function stringifyArray(values = []) {
  return Array.isArray(values) && values.length ? values.join(", ") : "(none)";
}

function buildObservedContextLines(context = {}) {
  return [
    "Observed Context:",
    `- progression: ${context.progressionText || "(empty)"}`,
    `- recent progression window: ${context.recentProgressionWindow || "(none)"}`,
    `- recent progression with bass/top notes: ${context.recentProgressionWindowWithNotes || "(none)"}`,
    `- current chord: ${context.currentChord || "(none)"}`,
    `- current bass note: ${context.currentBassNote || "(none)"}`,
    `- current top note: ${context.currentTopNote || "(none)"}`,
    `- recent bass motion: ${context.recentBassMotion || "(none)"}`,
    `- recent top-line motion: ${context.recentTopLineMotion || "(none)"}`,
    `- pedal bass cue: ${context.pedalBassCue || "(none)"}`,
    `- key and mode: ${context.selectedKey || "(none)"}`,
    `- feeling: ${context.feeling || "(none)"}`,
    `- last chord: ${context.lastChord || "(none)"}`,
    `- harmonic read: ${context.harmonicRead || "(none)"}`,
    `- direction: ${context.direction || "(none)"}`,
    `- cadence read: ${context.cadenceRead || "(none)"}`,
    `- centre read: ${context.centreRead || "(none)"}`
  ];
}

function buildControlContractLines(behavior = {}, profileConfig = {}) {
  return [
    "Requested Behaviour:",
    `- profile: ${behavior.profile || "(none)"}`,
    `- thinking mode intent: ${profileConfig.thinkingMode || "off"}`,
    `- phrase role: ${behavior.phraseIntent || "(none)"}`,
    `- bass behaviour: ${behavior.bassMotionIntent || "(none)"}`,
    `- top-note behaviour: ${behavior.topLineIntent || "(none)"}`,
    `- colour level: ${behavior.colourBudget || "(none)"}`,
    `- resolution bias: ${behavior.resolutionBias || "(none)"}`,
    `- cadence allowance: ${behavior.cadenceAllowance || "(none)"}`,
    `- complexity budget: ${behavior.complexityBudget || "(none)"}`,
    `- allow borrowed chords: ${behavior.allowBorrowedChords ? "yes" : "no"}`,
    `- allow applied dominants: ${behavior.allowAppliedDominants ? "yes" : "no"}`,
    `- repetition allowance: ${behavior.allowRepetition || "(none)"}`,
    `- candidate count: ${behavior.candidateCount || 6}`
  ];
}

function buildTheoryGuidanceLines(context = {}) {
  return [
    "Theory Guidance:",
    `- preferred targets: ${stringifyArray(context.preferredTargets)}`,
    `- established palette: ${context.establishedPalette || "(none)"}`,
    `- tension candidates: ${stringifyArray(context.tensionCandidates)}`,
    `- current theory candidates: ${stringifyArray(context.theoryCandidates)}`,
    `- progression read notes: ${stringifyArray(context.summaryNotes)}`
  ];
}

export function buildAiSuggestionPromptRequest({ context = {}, behavior = {}, profileConfig = {} } = {}) {
  const normalizedProfile = String(behavior?.profile || profileConfig?.profile || "precise").trim().toLowerCase() || "precise";
  const profileLines = PROFILE_INSTRUCTION_MAP[normalizedProfile] || PROFILE_INSTRUCTION_MAP.precise;
  const inputLines = [
    ...buildObservedContextLines(context),
    "",
    ...buildControlContractLines(behavior, profileConfig),
    "",
    ...buildTheoryGuidanceLines(context)
  ];

  return {
    instructions: [
      ...BASE_TASK_LINES,
      ...OUTPUT_CONTRACT_LINES,
      ...profileLines
    ].join(" "),
    input: inputLines.join("\n"),
    reasoningEffort: String(profileConfig?.reasoningEffort || "off").trim().toLowerCase() || "off",
    temperature: Number.isFinite(Number(profileConfig?.temperature)) ? Number(profileConfig.temperature) : 0.3,
    maxOutputTokens: Number.isFinite(Number(profileConfig?.maxOutputTokens)) ? Number(profileConfig.maxOutputTokens) : 1200,
    debugMeta: {
      task: "suggestionEngine",
      summaryLines: inputLines,
      normalizedParameters: behavior,
      profileConfig
    }
  };
}

function extractJsonCandidate(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return "";
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    return objectMatch[0].trim();
  }

  const arrayMatch = trimmed.match(/\[[\s\S]*\]/);
  if (arrayMatch?.[0]) {
    return arrayMatch[0].trim();
  }

  return trimmed;
}

function normalizeParsedEntry(entry) {
  if (typeof entry === "string") {
    const [rawChord, ...reasonParts] = entry.split(/\s*[:\-]\s*/);
    return {
      chord: String(rawChord || "").trim(),
      bass: "",
      topNote: "",
      resolutionType: "",
      confidence: null,
      strength: null,
      role: "",
      reason: String(reasonParts.join(" - ") || "").trim()
    };
  }

  const confidence = Number.isFinite(Number(entry?.confidence))
    ? Number(entry.confidence)
    : (Number.isFinite(Number(entry?.strength)) ? Number(entry.strength) : null);

  const resolutionType = String(entry?.resolutionType || entry?.resolution_type || entry?.role || entry?.type || "").trim();

  return {
    chord: String(entry?.chord || entry?.name || entry?.label || "").trim(),
    bass: String(entry?.bass || entry?.bassNote || entry?.bass_note || "").trim(),
    topNote: String(entry?.topNote || entry?.top_note || entry?.soprano || "").trim(),
    resolutionType,
    confidence,
    strength: confidence,
    role: resolutionType,
    reason: String(entry?.reason || entry?.why || entry?.note || "").trim()
  };
}

function parseJsonSuggestions(text) {
  const candidate = extractJsonCandidate(text);
  if (!candidate) {
    return [];
  }

  try {
    const parsed = JSON.parse(candidate);
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.suggestions)
        ? parsed.suggestions
        : Array.isArray(parsed?.results)
          ? parsed.results
          : [];

    return items.map(normalizeParsedEntry).filter(item => item.chord);
  } catch {
    return [];
  }
}

function parseLineSuggestions(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => line.replace(/^[-*\d.)\s]+/, "").trim())
    .map(line => {
      const [rawChord, ...reasonParts] = line.split(/\s*[:\-]\s*/);
      return {
        chord: String(rawChord || "").trim(),
        bass: "",
        topNote: "",
        resolutionType: "",
        confidence: null,
        strength: null,
        role: "",
        reason: String(reasonParts.join(" - ") || "").trim()
      };
    })
    .filter(item => item.chord);
}

export function parseAiSuggestionResponse(text) {
  const parsedFromJson = parseJsonSuggestions(text);
  if (parsedFromJson.length) {
    return parsedFromJson;
  }

  return parseLineSuggestions(text);
}
