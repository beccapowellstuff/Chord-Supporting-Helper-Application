export function buildAiExplorePromptRequest({ userPrompt = "", reasoningEffort = "medium" } = {}) {
  return {
    instructions: "",
    input: String(userPrompt || "").trim(),
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
