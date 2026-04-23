/**
 * aiExploreProgressionPrompt.js
 *
 * Helpers for the AI Explore panel:
 * - Build an optional progression context block for freeform prompts
 * - Parse optional chord suggestions from model responses
 */

/**
 * Build a plain-text context block for the current progression.
 *
 * @param {object} options
 * @param {string} options.selectedKey - Current key and mode
 * @param {string[]} options.progressionChords - Full progression
 * @param {string[]} [options.recentWindow] - Recent chord window
 * @param {string} [options.lastChord] - Last chord in the progression
 * @param {string} [options.currentFeeling] - Current feeling selection
 * @returns {string} Plain-text context block
 */
export function buildAiExploreProgressionContextBlock({
  selectedKey = "",
  progressionChords = [],
  recentWindow = [],
  lastChord = "",
  currentFeeling = ""
} = {}) {
  const keyInfo = selectedKey ? `Key and mode: ${selectedKey}` : "Key and mode: (none)";
  const progressionText = progressionChords.length
    ? progressionChords.join(" | ")
    : "(empty progression)";
  const recentWindowText = recentWindow.length
    ? recentWindow.join(" | ")
    : "(none)";
  const feelingInfo = currentFeeling ? `Feeling: ${currentFeeling}` : "Feeling: (none)";

  return [
    "Included progression context:",
    keyInfo,
    `Progression: ${progressionText}`,
    `Recent window: ${recentWindowText}`,
    lastChord ? `Last added chord: ${lastChord}` : "",
    feelingInfo,
    "",
    "Use this only if it helps answer the user's prompt."
  ].filter(Boolean).join("\n");
}

/**
 * Parse chord suggestions from an AI response text.
 * Looks for a ```json code block first, then falls back to raw JSON.
 *
 * @param {string} text - AI response text
 * @returns {Array|null} Parsed suggestions array or null if none found
 */
export function parseAiExploreSuggestions(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return parseSuggestionsJson(fencedMatch[1].trim());
  }

  return parseSuggestionsJson(trimmed);
}

function parseSuggestionsJson(jsonStr) {
  if (!jsonStr) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const items = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.suggestions)
        ? parsed.suggestions
        : null;

    if (!items || !items.length) {
      return null;
    }

    return items.map(normalizeExploreSuggestion).filter(item => item.chord);
  } catch {
    return null;
  }
}

function normalizeExploreSuggestion(entry) {
  return {
    chord: String(entry?.chord || entry?.name || entry?.label || "").trim(),
    bass: String(entry?.bass || entry?.bassNote || entry?.bass_note || "").trim(),
    topNote: String(entry?.topNote || entry?.top_note || entry?.soprano || "").trim(),
    strength: Number.isFinite(Number(entry?.strength)) ? Number(entry.strength) : null,
    role: String(entry?.role || entry?.type || "").trim(),
    reason: String(entry?.reason || entry?.why || entry?.note || "").trim()
  };
}
