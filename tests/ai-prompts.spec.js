import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers/appTestUtils.js";

test("AI prompt modules build normalized behaviour, structured prompts, and validated candidates", async ({ page }) => {
  await gotoApp(page);

  const result = await page.evaluate(async () => {
    const prompts = await import("/js/aiPrompts/index.js");

    const normalized = prompts.normalizeAiSuggestionBehavior({
      profile: "expressive",
      phraseRole: "flexible",
      bassBehaviour: "flexible",
      topNoteBehaviour: "flexible",
      colour: "flexible"
    }, {
      analysis: {
        phrasePosition: "cadence",
        cadenceExpectation: "return to center",
        latestCadence: "authentic",
        strongestCadence: "authentic",
        harmonicLanguage: "minor with borrowed colour",
        establishedBorrowedChords: [{ chord: "Fm" }]
      },
      pedalBassCue: "",
      recentVoicingLabels: [
        { bassMidi: 48, topMidi: 64 },
        { bassMidi: 50, topMidi: 65 }
      ]
    });

    const aiSuggestionRequest = prompts.buildAiSuggestionPromptRequest({
      context: {
        progressionText: "C | F | G",
        recentProgressionWindow: "C | F | G",
        recentProgressionWindowWithNotes: "C[C3 -> E4] | F[F3 -> A4] | G[G3 -> B4]",
        currentChord: "G",
        currentBassNote: "G3",
        currentTopNote: "B4",
        recentBassMotion: "C3 -> F3 -> G3",
        recentTopLineMotion: "E4 -> A4 -> B4",
        pedalBassCue: "",
        selectedKey: "C Ionian",
        feeling: "Happy",
        lastChord: "G [V]",
        harmonicRead: "mostly mode-led (mode confidence: high)",
        direction: "unstable -> return to center | Phrase: cadence",
        cadenceRead: "authentic",
        centreRead: "global C",
        establishedPalette: "in-key C, F, G, Am | borrowed Fm",
        preferredTargets: ["C", "Am", "F"],
        tensionCandidates: ["G", "Bb"],
        summaryNotes: ["The phrase wants to resolve.", "The top line is rising."],
        theoryCandidates: ["Am [vi]", "C [I]", "F [IV]"]
      },
      behavior: normalized.normalized,
      profileConfig: normalized.profileConfig
    });

    const parsedSuggestions = prompts.parseAiSuggestionResponse(`{
      "suggestions": [
        {
          "chord": "Am",
          "bass": "A3",
          "topNote": "C5",
          "resolutionType": "arrive",
          "confidence": 0.82,
          "reason": "Resolves back toward the tonic family with stepwise top-line motion."
        },
        {
          "chord": "C",
          "bass": "C3",
          "topNote": "E5",
          "resolutionType": "arrive",
          "confidence": 0.91,
          "reason": "Strong tonic return after dominant tension."
        }
      ]
    }`);

    const filtered = prompts.buildAiSuggestionRenderItems([
      {
        chord: "Am",
        bass: "A3",
        topNote: "C5",
        resolutionType: "arrive",
        confidence: 0.82,
        reason: "Fits the requested phrase role."
      },
      {
        chord: "Am",
        bass: "A3",
        topNote: "C5",
        resolutionType: "arrive",
        confidence: 0.8,
        reason: "Duplicate should be removed."
      },
      {
        chord: "BadChord",
        bass: "G3",
        topNote: "B4",
        resolutionType: "continue",
        confidence: 0.2,
        reason: "Invalid chord should be removed."
      }
    ], {
      analysis: {
        lastChord: "G",
        establishedPalette: "in-key C, F, G, Am"
      },
      theoryCandidates: ["Am [vi]", "C [I]", "F [IV]"],
      preferredTargets: ["C", "Am", "F"],
      behaviorParams: normalized.normalized,
      currentBassNote: "G3",
      currentTopNote: "B4"
    });

    return {
      normalized,
      aiSuggestionRequest,
      parsedSuggestions,
      filtered
    };
  });

  expect(result.normalized.resolved.profile).toBe("expressive");
  expect(result.normalized.resolved.phraseRole).toBe("arrive");
  expect(result.normalized.resolved.bassBehaviour).toBe("ascend");
  expect(result.normalized.resolved.topNoteBehaviour).toBe("ascend_gently");
  expect(result.normalized.resolved.colour).toBe("moderate");
  expect(result.normalized.normalized.allowBorrowedChords).toBe(true);

  expect(result.aiSuggestionRequest).toMatchObject({
    reasoningEffort: "on",
    temperature: 0.6
  });
  expect(result.aiSuggestionRequest.instructions).toContain("Return JSON only");
  expect(result.aiSuggestionRequest.instructions).toContain("\"resolutionType\"");
  expect(result.aiSuggestionRequest.input).toContain("Observed Context:");
  expect(result.aiSuggestionRequest.input).toContain("- progression: C | F | G");
  expect(result.aiSuggestionRequest.input).toContain("Requested Behaviour:");
  expect(result.aiSuggestionRequest.input).toContain("- phrase role: arrive");
  expect(result.aiSuggestionRequest.input).toContain("- bass behaviour: up_step_bias");
  expect(result.aiSuggestionRequest.input).toContain("- top-note behaviour: up_soft");
  expect(result.aiSuggestionRequest.input).toContain("- colour level: diatonic_extension_ok");
  expect(result.aiSuggestionRequest.input).toContain("Theory Guidance:");
  expect(result.aiSuggestionRequest.input).toContain("- current theory candidates: Am [vi], C [I], F [IV]");

  expect(result.parsedSuggestions).toEqual([
    {
      chord: "Am",
      bass: "A3",
      topNote: "C5",
      resolutionType: "arrive",
      confidence: 0.82,
      strength: 0.82,
      role: "arrive",
      reason: "Resolves back toward the tonic family with stepwise top-line motion."
    },
    {
      chord: "C",
      bass: "C3",
      topNote: "E5",
      resolutionType: "arrive",
      confidence: 0.91,
      strength: 0.91,
      role: "arrive",
      reason: "Strong tonic return after dominant tension."
    }
  ]);

  expect(result.filtered.items).toHaveLength(1);
  expect(result.filtered.items[0]).toMatchObject({
    chord: "Am",
    bass: "A3",
    topNote: "C5",
    resolutionType: "arrive"
  });
  expect(result.filtered.droppedCount).toBe(2);
});
