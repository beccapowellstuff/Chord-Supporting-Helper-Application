export function buildAiExplorePromptRequest({ userPrompt = "", reasoningEffort = "medium", instructions = "", conversationHistory = [] } = {}) {
  return {
    instructions: String(instructions || "").trim(),
    input: String(userPrompt || "").trim(),
    conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
    reasoningEffort: String(reasoningEffort || "medium").trim().toLowerCase() || "medium",
    temperature: 0.7,
    maxOutputTokens: 4096,
    debugMeta: {
      task: "aiExplore",
      summaryLines: [
        `User prompt: ${String(userPrompt || "").trim() || "(empty)"}`
      ]
    }
  };
}
