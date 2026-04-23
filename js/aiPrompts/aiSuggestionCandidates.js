import {
  getChordNotes,
  NOTE_TO_PC,
  noteToMidi,
  normaliseRoot,
  parseChordName
} from "../chordNotes.js";

function extractPitchClass(noteLabel) {
  const cleaned = String(noteLabel || "").trim();
  if (!cleaned) {
    return "";
  }

  const match = /^([A-G](?:#{1,2}|b{1,2})?)/i.exec(cleaned);
  if (!match) {
    return "";
  }

  return normaliseRoot(match[1].charAt(0).toUpperCase() + match[1].slice(1));
}

function parseNoteReference(noteLabel) {
  const cleaned = String(noteLabel || "").trim();
  if (!cleaned) {
    return null;
  }

  const match = /^([A-G](?:#{1,2}|b{1,2})?)(-?\d+)?$/i.exec(cleaned);
  if (!match) {
    return null;
  }

  const note = normaliseRoot(match[1].charAt(0).toUpperCase() + match[1].slice(1));
  const octave = match[2] != null ? Number(match[2]) : null;
  return {
    note,
    octave,
    midi: note && Number.isFinite(octave) ? noteToMidi(note, octave) : null
  };
}

function clampConfidence(value) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  return Math.max(0, Math.min(1, Number(value)));
}

function normalizeResolutionType(value, fallbackRole = "") {
  const normalized = String(value || fallbackRole || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized.includes("arrive")) {
    return "arrive";
  }
  if (normalized.includes("delay") || normalized.includes("defer")) {
    return "delay";
  }
  if (normalized.includes("resolve")) {
    return "begin resolving";
  }
  if (normalized.includes("continue")) {
    return "continue";
  }
  if (normalized.includes("colour")) {
    return "colour shift";
  }

  return normalized;
}

function getNormalizedChordIdentity(chord) {
  const parsed = parseChordName(chord);
  if (!parsed) {
    return String(chord || "").trim();
  }

  return `${parsed.root}|${parsed.suffix}|${parsed.bass || ""}`;
}

function getNormalizedSuggestedBassPitchClass(bass) {
  const rawBass = String(bass || "").trim();
  if (!rawBass) {
    return "";
  }

  const pitchOnly = rawBass.replace(/-?\d+$/, "").trim();
  return normaliseRoot(pitchOnly);
}

function buildChordWithSuggestedBass(chord, bass) {
  const normalizedChord = String(chord || "").trim();
  const normalizedBass = getNormalizedSuggestedBassPitchClass(bass);
  if (!normalizedChord) {
    return "";
  }

  const parsed = parseChordName(normalizedChord);
  if (!parsed || !normalizedBass) {
    return normalizedChord;
  }

  const root = normaliseRoot(parsed.root);
  const existingBass = normaliseRoot(parsed.bass || parsed.root);
  if (!normalizedBass || normalizedBass === existingBass || normalizedBass === root) {
    return normalizedChord;
  }

  return `${parsed.root}${parsed.suffix}/${normalizedBass}`;
}

function getParsedChordInfo(chord) {
  const normalizedChord = String(chord || "")
    .replace(/\s*\[[^\]]*\]\s*$/, "")
    .trim();
  const parsed = parseChordName(normalizedChord);
  return parsed ? {
    root: String(parsed.root || "").trim(),
    bass: String(parsed.bass || parsed.root || "").trim(),
    suffix: String(parsed.suffix || "").trim(),
    intervals: Array.isArray(parsed.intervals) ? parsed.intervals : []
  } : null;
}

function getComplexityLevel(chord) {
  const parsed = getParsedChordInfo(chord);
  if (!parsed) {
    return "medium_high";
  }

  const suffix = String(parsed.suffix || "").toLowerCase();
  const isSlash = parsed.bass && parsed.bass !== parsed.root;
  if (/(13|11|9|#|b5|b9|#9|#11|b13|alt|dim7|m7b5)/i.test(suffix) || isSlash) {
    return "medium_high";
  }
  if (/(7|maj7|m7|6|add9|add11|add13|sus2|sus4)/i.test(suffix)) {
    return "medium";
  }
  return "low";
}

function isTopNotePlausible(topNote, chord, colourBudget) {
  const reference = parseNoteReference(topNote);
  if (!reference?.note) {
    return false;
  }

  if (colourBudget === "chromatic_colour_ok") {
    return true;
  }

  const chordNotes = getChordNotes(chord);
  if (!Array.isArray(chordNotes) || !chordNotes.length) {
    return false;
  }

  const normalizedNote = normaliseRoot(reference.note);
  if (chordNotes.includes(normalizedNote)) {
    return true;
  }

  if (colourBudget === "triad_bias") {
    return false;
  }

  const parsed = parseChordName(chord);
  const rootPc = NOTE_TO_PC[normaliseRoot(parsed?.root || "")];
  const topPc = NOTE_TO_PC[normalizedNote];
  if (rootPc == null || topPc == null) {
    return false;
  }

  const interval = (topPc - rootPc + 12) % 12;
  return [2, 5, 9].includes(interval);
}

function scoreBassMotionFit(bass, behaviorParams, currentBassNote) {
  const current = parseNoteReference(currentBassNote);
  const candidate = parseNoteReference(bass);
  if (!candidate?.note) {
    return 0;
  }

  if (!current?.note || current.midi == null || candidate.midi == null) {
    if (behaviorParams.bassMotionIntent === "hold" && extractPitchClass(currentBassNote) === extractPitchClass(bass)) {
      return 14;
    }
    return 0;
  }

  const delta = candidate.midi - current.midi;
  if (behaviorParams.bassMotionIntent === "hold") {
    return delta === 0 ? 18 : Math.abs(delta) <= 2 ? 6 : -8;
  }
  if (behaviorParams.bassMotionIntent === "down_step_bias") {
    return delta < 0 && Math.abs(delta) <= 2 ? 18 : delta < 0 ? 10 : -8;
  }
  if (behaviorParams.bassMotionIntent === "up_step_bias") {
    return delta > 0 && Math.abs(delta) <= 2 ? 18 : delta > 0 ? 10 : -8;
  }
  return 0;
}

function scoreTopLineFit(topNote, behaviorParams, currentTopNote) {
  const current = parseNoteReference(currentTopNote);
  const candidate = parseNoteReference(topNote);
  if (!candidate?.note) {
    return 0;
  }

  if (!current?.note || current.midi == null || candidate.midi == null) {
    return 0;
  }

  const delta = candidate.midi - current.midi;
  const absDelta = Math.abs(delta);
  if (behaviorParams.topLineIntent === "hold_or_neighbor") {
    return absDelta <= 2 ? 16 : absDelta <= 5 ? 4 : -8;
  }
  if (behaviorParams.topLineIntent === "down_soft") {
    return delta < 0 && absDelta <= 2 ? 16 : delta < 0 ? 8 : -8;
  }
  if (behaviorParams.topLineIntent === "up_soft") {
    return delta > 0 && absDelta <= 2 ? 16 : delta > 0 ? 8 : -8;
  }
  return 0;
}

function scorePhraseIntentFit(resolutionType, behaviorParams) {
  const normalized = normalizeResolutionType(resolutionType);
  if (!normalized) {
    return 0;
  }

  if (behaviorParams.phraseIntent === "continue") {
    return normalized === "continue" ? 16 : normalized === "delay" ? 6 : -6;
  }
  if (behaviorParams.phraseIntent === "soft_resolve") {
    return normalized === "begin resolving" ? 16 : normalized === "arrive" ? 8 : -4;
  }
  if (behaviorParams.phraseIntent === "defer_arrival") {
    return normalized === "delay" ? 16 : normalized === "continue" ? 8 : -6;
  }
  if (behaviorParams.phraseIntent === "arrive") {
    return normalized === "arrive" ? 18 : normalized === "begin resolving" ? 6 : -8;
  }
  return 0;
}

function scoreColourFit(chord, behaviorParams) {
  const complexity = getComplexityLevel(chord);
  if (behaviorParams.complexityBudget === "low") {
    return complexity === "low" ? 14 : complexity === "medium" ? 2 : -12;
  }
  if (behaviorParams.complexityBudget === "medium") {
    return complexity === "medium_high" ? -2 : 10;
  }
  if (behaviorParams.complexityBudget === "medium_high") {
    return complexity === "medium_high" ? 12 : complexity === "medium" ? 8 : 2;
  }
  return 0;
}

function scoreTheoryFit(chord, preferredTargets = [], theoryCandidates = []) {
  const parsed = getParsedChordInfo(chord);
  if (!parsed?.root) {
    return -Infinity;
  }

  const preferred = new Set((Array.isArray(preferredTargets) ? preferredTargets : []).map(value => String(value || "").trim()).filter(Boolean));
  const normalizedTheoryCandidates = Array.isArray(theoryCandidates)
    ? theoryCandidates.map(candidate => getParsedChordInfo(candidate)).filter(Boolean)
    : [];

  let score = 0;
  if (preferred.has(parsed.root) || preferred.has(parsed.bass)) {
    score += 18;
  }
  if (normalizedTheoryCandidates.some(candidate => candidate.root === parsed.root)) {
    score += 14;
  }
  if (normalizedTheoryCandidates.some(candidate => candidate.bass === parsed.bass)) {
    score += 6;
  }
  return score;
}

function scorePaletteFit(chord, analysis = {}, behaviorParams = {}) {
  const parsed = getParsedChordInfo(chord);
  if (!parsed?.root) {
    return 0;
  }

  const establishedPaletteText = String(analysis?.establishedPalette || "").toLowerCase();
  const harmonicLanguage = String(analysis?.harmonicLanguage || "").toLowerCase();
  const chordLabel = String(chord || "").toLowerCase();

  let score = 0;
  if (establishedPaletteText.includes(parsed.root.toLowerCase()) || establishedPaletteText.includes(chordLabel)) {
    score += 12;
  }

  if (!behaviorParams.allowBorrowedChords && harmonicLanguage.includes("mode-led") && !establishedPaletteText.includes(chordLabel)) {
    score -= 6;
  }

  return score;
}

function scoreRepetitionPenalty(chord, analysis = {}, behaviorParams = {}) {
  const lastChord = getParsedChordInfo(analysis?.lastChord || "");
  const candidate = getParsedChordInfo(chord);
  if (!lastChord?.root || !candidate?.root) {
    return 0;
  }

  if (candidate.root !== lastChord.root) {
    return 0;
  }

  if (behaviorParams.allowRepetition === "allow_same_bass_only") {
    return candidate.bass === lastChord.bass ? -4 : -10;
  }

  if (behaviorParams.allowRepetition === "limited") {
    return -8;
  }

  return -18;
}

function buildPresentation(item, behaviorParams) {
  const resolutionType = normalizeResolutionType(item?.resolutionType, item?.role);
  const intentLabel = resolutionType
    ? ({
        "arrive": "Arrive",
        "begin resolving": "Begin resolving",
        "delay": "Delay arrival",
        "continue": "Continue line",
        "colour shift": "Colour shift"
      }[resolutionType] || "AI idea")
    : "AI idea";

  const summaryLabel = behaviorParams?.profile === "expressive"
    ? "Expressive AI continuation"
    : "Precise AI continuation";

  return {
    isAi: true,
    intentLabel,
    summaryLabel,
    tone: resolutionType === "arrive" ? "hold" : resolutionType === "begin resolving" ? "tension" : "colour"
  };
}

function normalizeCandidate(entry, behaviorParams) {
  const rawChord = String(entry?.chord || "").trim();
  const bass = String(entry?.bass || "").trim();
  const topNote = String(entry?.topNote || "").trim();
  const normalizedChord = buildChordWithSuggestedBass(rawChord, bass);
  const confidence = clampConfidence(entry?.confidence ?? entry?.strength);
  const resolutionType = normalizeResolutionType(entry?.resolutionType, entry?.role || entry?.type);
  const reason = String(entry?.reason || "").trim();

  if (!normalizedChord || !parseChordName(normalizedChord)) {
    return {
      valid: false,
      reason: "invalid chord label"
    };
  }

  if (topNote && !isTopNotePlausible(topNote, normalizedChord, behaviorParams?.colourBudget)) {
    return {
      valid: false,
      reason: "top note did not fit the requested colour budget"
    };
  }

  return {
    valid: true,
    chord: normalizedChord,
    rawChord,
    bass,
    topNote,
    confidence,
    strength: confidence,
    resolutionType,
    role: resolutionType,
    reason: reason || "AI suggested this as a useful continuation."
  };
}

export function buildAiSuggestionRenderItems(items = [], options = {}) {
  const {
    analysis = {},
    theoryCandidates = [],
    preferredTargets = [],
    behaviorParams = {},
    currentBassNote = "",
    currentTopNote = ""
  } = options;

  const seen = new Set();
  const validItems = [];
  const dropped = [];

  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const normalized = normalizeCandidate(item, behaviorParams);
    if (!normalized.valid) {
      dropped.push({
        index,
        chord: String(item?.chord || "").trim() || "(unknown)",
        reason: normalized.reason
      });
      return;
    }

    const identity = `${getNormalizedChordIdentity(normalized.chord)}|${String(normalized.topNote || "").trim()}|${String(normalized.bass || "").trim()}`;
    if (!identity || seen.has(identity)) {
      dropped.push({
        index,
        chord: normalized.chord,
        reason: "duplicate chord, bass, and top-note identity"
      });
      return;
    }

    seen.add(identity);

    const metrics = {
      confidence: normalized.confidence != null ? normalized.confidence * 28 : 0,
      bassFit: scoreBassMotionFit(normalized.bass, behaviorParams, currentBassNote),
      topLineFit: scoreTopLineFit(normalized.topNote, behaviorParams, currentTopNote),
      phraseFit: scorePhraseIntentFit(normalized.resolutionType, behaviorParams),
      colourFit: scoreColourFit(normalized.chord, behaviorParams),
      theoryFit: scoreTheoryFit(normalized.chord, preferredTargets, theoryCandidates),
      paletteFit: scorePaletteFit(normalized.chord, analysis, behaviorParams),
      repetitionPenalty: scoreRepetitionPenalty(normalized.chord, analysis, behaviorParams)
    };

    const aiScore = Object.values(metrics).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);

    validItems.push({
      ...normalized,
      aiScore,
      aiMetrics: metrics,
      aiSourceIndex: index,
      fn: "AI",
      presentation: buildPresentation(normalized, behaviorParams)
    });
  });

  validItems.sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0) || (b.confidence || 0) - (a.confidence || 0) || (a.aiSourceIndex || 0) - (b.aiSourceIndex || 0));

  return {
    items: validItems.slice(0, Number(behaviorParams?.candidateCount) || 6),
    droppedCount: dropped.length,
    dropped
  };
}
