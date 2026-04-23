function buildAiExploreInput({ userPrompt = "", progressionContext = "" } = {}) {
  const prompt = String(userPrompt || "").trim();
  const context = String(progressionContext || "").trim();

  if (!context) {
    return prompt;
  }

  return `${context}\n\nUser prompt:\n${prompt}`.trim();
}

export function buildAiExplorePromptRequest({
  userPrompt = "",
  reasoningEffort = "medium",
  instructions = "",
  progressionContext = "",
  conversationHistory = []
} = {}) {
  const context = String(progressionContext || "").trim();
  const input = buildAiExploreInput({ userPrompt, progressionContext });

  return {
    instructions: String(instructions || "").trim(),
    input,
    conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
    reasoningEffort: String(reasoningEffort || "medium").trim().toLowerCase() || "medium",
    temperature: 0.7,
    maxOutputTokens: 4096,
    debugMeta: {
      task: "aiExplore",
      summaryLines: [
        context ? "Included progression context: yes" : "Included progression context: no",
        `User prompt: ${String(userPrompt || "").trim() || "(empty)"}`
      ]
    }
  };
}
