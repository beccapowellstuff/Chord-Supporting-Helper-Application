const AI_SUGGESTION_INSTRUCTIONS = [
  "You are helping a chord progression assistant suggest the next single chord.",
  "Return JSON only with no markdown, no prose outside the JSON, and no extra commentary.",
  'Use this exact shape: {"suggestions":[{"chord":"G","bass":"G","topNote":"G5","strength":0.8,"role":"continuation|resolution|colour-shift","reason":"Short explanation"}]}',
  "Return exactly 6 suggestions.",
  "Each suggestion must contain one single chord label, one bass note, one top note, one strength value, one role, and one short reason.",
  "If the bass differs from the chord root, the chord field must use slash-chord notation that matches the bass field, for example Am/E with bass E.",
  "Do not return a progression, multiple chords, alternatives, or slash explanations outside the required fields.",
  "Rank suggestions from strongest to weakest, with the first item being the most likely next chord.",
  "Focus primarily on the current chord and the most recent local movement, not the full progression as a whole.",
  "Use only the recent chord window provided in the prompt as your main context.",
  "Treat bass and top voice as separate melodic lines.",
  "If the prompt shows a repeated bass note or pedal tone, preserve it unless there is a strong reason to release it.",
  "When a pedal-bass cue is present, at least the first 3 suggestions should keep that bass or explicitly justify releasing it.",
  "Prioritise local voice-leading over vague mood language.",
  "Track bass movement from the current bass note exactly.",
  "Track top-line movement from the current top note exactly.",
  "Prefer suggestions that create believable motion in bass and soprano, including held notes, stepwise motion, or clearly justified leaps.",
  "When the current top note is moving by step, prefer the next top note to hold or continue by step before suggesting a leap.",
  "If you mention tension, release, continuation, or resolution, base it on the current chord and the immediately recent context only.",
  "Do not claim resolution from an earlier chord unless it is directly relevant to the current chord.",
  "Do not describe a leap as stepwise.",
  "Do not invent theory claims that are not supported by the current chord, bass note, top note, or recent harmonic movement.",
  "Use mood only as a secondary tiebreaker after harmonic fit, bass motion, and top-line motion.",
  "Prefer valid ASCII chord labels commonly used in pop, rock, and jazz notation.",
  "Avoid duplicates and near-duplicates.",
  "Offer a mix of strong expected choices and a small number of creative but still believable options.",
  "Keep each reason concise, specific, and grounded in bass movement, top-line movement, or harmonic role.",
].join(' ');

function stringifyArray(values = []) {
  return Array.isArray(values) && values.length ? values.join(", ") : "(none)";
}

export function buildAiSuggestionPromptRequest({ context = {}, reasoningEffort = "medium" } = {}) {
  const theoryCandidates = Array.isArray(context.theoryCandidates) ? context.theoryCandidates : [];

  const summaryLines = [
    context.recentProgressionWindow ? `Recent progression window: ${context.recentProgressionWindow}` : "",
    context.recentProgressionWindowWithNotes ? `Recent progression window with bass/top notes: ${context.recentProgressionWindowWithNotes}` : "",
    context.recentBassMotion ? `Bass motion cue: ${context.recentBassMotion}` : "",
    context.pedalBassCue ? `Pedal bass cue: ${context.pedalBassCue}` : "",
    context.currentBassNote ? `Current bass note: ${context.currentBassNote}` : "",
    context.pedalBassHint ? context.pedalBassHint : "",
    context.recentTopLineMotion ? `Top-line cue: ${context.recentTopLineMotion}` : "",
    context.currentTopNote ? `Current top note: ${context.currentTopNote}` : "",
    context.topLinePreference ? `Top-line preference: ${context.topLinePreference}` : "",
    `Key and mode: ${context.selectedKey || "(none)"}`,
    `Feeling: ${context.feeling || "(none)"}`,
    context.lastChord ? `Last chord: ${context.lastChord}` : "",
    context.harmonicRead ? `Harmonic read: ${context.harmonicRead}` : "",
    context.direction ? `Direction: ${context.direction}` : "",
    context.cadenceRead ? `Cadence read: ${context.cadenceRead}` : "",
    context.centreRead ? `Centre read: ${context.centreRead}` : "",
    context.establishedPalette ? `Established palette: ${context.establishedPalette}` : "",
    context.preferredTargets?.length ? `Preferred targets: ${stringifyArray(context.preferredTargets)}` : "",
    context.tensionCandidates?.length ? `Tension candidates: ${stringifyArray(context.tensionCandidates)}` : "",
    context.summaryNotes?.length ? `Progression read notes: ${stringifyArray(context.summaryNotes)}` : "",
    theoryCandidates.length ? `Current theory candidates: ${theoryCandidates.join(", ")}` : ""
  ].filter(Boolean);

  return {
    instructions: AI_SUGGESTION_INSTRUCTIONS,
    input: summaryLines.join("\n"),
    reasoningEffort: String(reasoningEffort || "medium").trim().toLowerCase() || "medium",
    temperature: 0.3,
    maxOutputTokens: 1200,
    debugMeta: {
      task: "suggestionEngine",
      summaryLines
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
      strength: null,
      role: "",
      reason: String(reasonParts.join(" - ") || "").trim()
    };
  }

  return {
    chord: String(entry?.chord || entry?.name || entry?.label || "").trim(),
    bass: String(entry?.bass || entry?.bassNote || entry?.bass_note || "").trim(),
    topNote: String(entry?.topNote || entry?.top_note || entry?.soprano || "").trim(),
    strength: Number.isFinite(Number(entry?.strength)) ? Number(entry.strength) : null,
    role: String(entry?.role || entry?.type || "").trim(),
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
    .map(line => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .map(line => {
      const [rawChord, ...reasonParts] = line.split(/\s*[:\-]\s*/);
      return {
        chord: String(rawChord || "").trim(),
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
