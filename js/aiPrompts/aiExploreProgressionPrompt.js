/**
 * aiExploreProgressionPrompt.js
 *
 * Builds system instructions for the AI Explore panel that include
 * current progression context so the AI can discuss and suggest chords
 * in relation to what the user is working on.
 */

/**
 * Build system instructions that embed the current progression context
 * for the AI Explore panel.
 *
 * @param {object} options
 * @param {string} options.selectedKey - Current key and mode (e.g. "C Ionian")
 * @param {string[]} options.progressionChords - Array of chord labels in the current progression
 * @param {string[]} [options.recentWindow] - Recent N chords for local context
 * @param {string} [options.lastChord] - The most recently added chord
 * @param {string} [options.currentFeeling] - Current feeling selection
 * @returns {string} System instructions string
 */
export function buildAiExploreProgressionInstructions({
  selectedKey = "",
  progressionChords = [],
  recentWindow = [],
  lastChord = "",
  currentFeeling = ""
} = {}) {
  const keyInfo = selectedKey ? `Key and mode: ${selectedKey}` : "No key selected.";
  const progressionText = progressionChords.length
    ? progressionChords.join(" → ")
    : "(empty progression)";
  const recentWindowText = recentWindow.length
    ? recentWindow.join(" → ")
    : "(none)";
  const feelingInfo = currentFeeling ? `Current feeling: ${currentFeeling}` : "";

  const contextLines = [
    "You are a musical assistant helping a user explore chord progressions. The user will share prompts and you should respond with helpful musical guidance. When the user is working on a progression, you may suggest specific chords they can add.",
    "",
    "--- Current Context ---",
    keyInfo,
    `Current progression: ${progressionText}`,
    `Recent window: ${recentWindowText}`,
    lastChord ? `Last added chord: ${lastChord}` : "",
    feelingInfo,
    "",
    "--- How to Respond ---",
    "1. Read the user's message carefully and respond helpfully.",
    "2. If the user is asking for chord suggestions or discussing progression, include your suggestions in a JSON block.",
    "3. Use this exact JSON shape for suggestions (put it inside a ```json code block):",
    "```json",
    "{",
    "  \"suggestions\": [",
    "    {",
    "      \"chord\": \"Am7\",",
    "      \"bass\": \"A\",",
    "      \"topNote\": \"A5\",",
    "      \"strength\": 0.9,",
    "      \"role\": \"continuation|resolution|colour-shift\",",
    "      \"reason\": \"Short explanation based on bass movement, top-line movement, or harmonic role.\"",
    "    }",
    "  ]",
    "}",
    "```",
    "4. Return exactly 3-6 suggestions ranked from strongest to weakest.",
    "5. Each suggestion must contain: chord (string), bass (string), topNote (string), strength (number 0-1), role (string), reason (string).",
    "6. If the bass differs from the chord root, use slash-chord notation (e.g., Am/E).",
    "7. Keep free-form musical discussion natural and conversational. Only include the JSON block when offering chord suggestions.",
    "8. Do NOT include the JSON block if the user is just chatting, asking a general question, or discussing theory without requesting suggestions.",
    "9. When suggesting chords, base your reasoning on the current context above."
  ].filter(Boolean);

  return contextLines.join("\n");
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

  // Try fenced JSON block first
  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return parseSuggestionsJson(fencedMatch[1].trim());
  }

  // Try raw JSON object
  return parseSuggestionsJson(trimmed);
}

/**
 * Parse a JSON string for suggestion arrays.
 *
 * @param {string} jsonStr - JSON string to parse
 * @returns {Array|null} Parsed suggestions or null
 */
function parseSuggestionsJson(jsonStr) {
  if (!jsonStr) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonStr);

    // Handle nested suggestions property
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

/**
 * Normalize a single suggestion entry to the standard shape.
 *
 * @param {object} entry - Raw suggestion entry
 * @returns {object} Normalized suggestion
 */
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
