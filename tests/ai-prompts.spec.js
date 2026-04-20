import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers/appTestUtils.js";

test("AI prompt builders return structured request objects", async ({ page }) => {
  await gotoApp(page);

  const result = await page.evaluate(async () => {
    const prompts = await import("/js/aiPrompts/index.js");

    const aiExploreRequest = prompts.buildAiExplorePromptRequest({
      userPrompt: "Explain why Fm works after C in a pop progression.",
      reasoningEffort: "high"
    });

    const aiSuggestionRequest = prompts.buildAiSuggestionPromptRequest({
      context: {
        progressionText: "C | F | G",
        progressionWithTopNotes: "C[E4] | F[A4] | G[B4]",
        selectedKey: "C Ionian",
        feeling: "Happy",
        lastChord: "G [V]",
        harmonicRead: "mostly mode-led (mode confidence: high)",
        direction: "unstable -> return to center | Phrase: cadence",
        cadenceRead: "authentic",
        centreRead: "global C",
        establishedPalette: "in-key C, F, G, Am",
        preferredTargets: ["C", "Am", "F"],
        tensionCandidates: ["G", "Bb"],
        topLineSummary: "A4 -> B4 (rising by step)",
        summaryNotes: ["The phrase wants to resolve.", "The top line is rising."],
        theoryCandidates: ["Am [vi]", "C [I]", "F [IV]"]
      },
      reasoningEffort: "medium"
    });

    const parsedSuggestions = prompts.parseAiSuggestionResponse(`{
      "suggestions": [
        { "chord": "Am", "reason": "Keeps the phrase moving softly." },
        { "chord": "C", "reason": "Resolves back to the tonic." }
      ]
    }`);

    return {
      aiExploreRequest,
      aiSuggestionRequest,
      parsedSuggestions
    };
  });

  expect(result.aiExploreRequest).toMatchObject({
    instructions: "",
    input: "Explain why Fm works after C in a pop progression.",
    reasoningEffort: "high",
    temperature: 0.7,
    maxOutputTokens: 4096
  });

  expect(result.aiSuggestionRequest).toMatchObject({
    reasoningEffort: "medium",
    temperature: 0.3,
    maxOutputTokens: 1200
  });
  expect(result.aiSuggestionRequest.instructions).toContain("Return JSON only");
  expect(result.aiSuggestionRequest.input).toContain("Progression: C | F | G");
  expect(result.aiSuggestionRequest.input).toContain("Progression + top notes: C[E4] | F[A4] | G[B4]");
  expect(result.aiSuggestionRequest.input).toContain("Key and mode: C Ionian");
  expect(result.aiSuggestionRequest.input).toContain("Preferred targets: C, Am, F");
  expect(result.aiSuggestionRequest.input).toContain("Current theory candidates: Am [vi], C [I], F [IV]");

  expect(result.parsedSuggestions).toEqual([
    {
      chord: "Am",
      reason: "Keeps the phrase moving softly."
    },
    {
      chord: "C",
      reason: "Resolves back to the tonic."
    }
  ]);
});
