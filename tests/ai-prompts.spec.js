import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers/appTestUtils.js";

test("AI prompt modules build normalized behaviour, structured prompts, and validated candidates", async ({ page }) => {
  await gotoApp(page);

  const result = await page.evaluate(async () => {
    const prompts = await import("/js/aiPrompts/index.js");

    const normalized = prompts.normalizeAiSuggestionBehavior({
      profile: "expressive",
      style: "jrpg_game_score",
      feel: "heroic",
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

    const salvagedSuggestions = prompts.parseAiSuggestionResponse(`{
      "suggestions": [
        {
          "chord": "Dm",
          "bass": "D2",
          "topNote": "A6",
          "resolutionType": "continue",
          "confidence": 0.95,
          "reason": "Follows the requested down-step bass motion and maintains diatonic stability."
        },
        {
          "chord": "F",
          "bass": "F2",
          "topNote": "A6",
          "resolutionType": "continue",
          "confidence": 0.9,
          "reason": "Provides a smooth downward bass step and stays within the established diatonic palette."
        },
        {
          "chord": "G",
          "bass": "G1",
          "topNote": "B6",
          "resolutionType": "expand",
          "confidence": 0.85,
          "reason": "Moves the bass down while allowing the top note to rise softly."
        },
        "im_chord": "Dm/F",
          "bass": "F2",
          "topNote": "A6",
          "resolutionType": "continue",
          "confidence": 0.82,
          "reason": "Uses a first inversion to create smooth bass descent while keeping the top note stable."
        },
        {
          "chord": "Em",
          "bass": "E2",
          "topNote": "G6",
          "resolutionType": "continue",
          "confidence": 0.75,
          "reason": "Returns to a previously used chord with a downward bass step and soft top-line descent."
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
      salvagedSuggestions,
      filtered
    };
  });

  expect(result.normalized.resolved.profile).toBe("expressive");
  expect(result.normalized.resolved.phraseRole).toBe("arrive");
  expect(result.normalized.resolved.bassBehaviour).toBe("ascend");
  expect(result.normalized.resolved.topNoteBehaviour).toBe("ascend_gently");
  expect(result.normalized.resolved.colour).toBe("moderate");
  expect(result.normalized.resolved.styleLabel).toBe("JRPG / Game Score");
  expect(result.normalized.resolved.feelLabel).toBe("Heroic");
  expect(result.normalized.normalized.allowBorrowedChords).toBe(true);
  expect(result.normalized.normalized.styleGuidance.modalMixtureTolerance).toBe("high");
  expect(result.normalized.normalized.feelGuidance.cadenceShift).toBe("clearer");

  expect(result.aiSuggestionRequest).toMatchObject({
    reasoningEffort: "on",
    temperature: 0.6
  });
  expect(result.aiSuggestionRequest.instructions).toContain("Return JSON only");
  expect(result.aiSuggestionRequest.instructions).toContain("\"resolutionType\"");
  expect(result.aiSuggestionRequest.input).toContain("Observed Context:");
  expect(result.aiSuggestionRequest.input).toContain("- progression: C | F | G");
  expect(result.aiSuggestionRequest.input).toContain("Requested Behaviour:");
  expect(result.aiSuggestionRequest.input).toContain("- style preset: JRPG / Game Score");
  expect(result.aiSuggestionRequest.input).toContain("- style details: Expressive tonal colour with pedal tones and dramatic shifts.");
  expect(result.aiSuggestionRequest.input).toContain("- style modal mixture tolerance: high");
  expect(result.aiSuggestionRequest.input).toContain("- feel preset: Heroic");
  expect(result.aiSuggestionRequest.input).toContain("- feel details: Stronger uplift, purpose, and forward harmonic motion.");
  expect(result.aiSuggestionRequest.input).toContain("- feel cadence shift: clearer");
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

  expect(result.salvagedSuggestions).toEqual([
    {
      chord: "Dm",
      bass: "D2",
      topNote: "A6",
      resolutionType: "continue",
      confidence: 0.95,
      strength: 0.95,
      role: "continue",
      reason: "Follows the requested down-step bass motion and maintains diatonic stability."
    },
    {
      chord: "F",
      bass: "F2",
      topNote: "A6",
      resolutionType: "continue",
      confidence: 0.9,
      strength: 0.9,
      role: "continue",
      reason: "Provides a smooth downward bass step and stays within the established diatonic palette."
    },
    {
      chord: "G",
      bass: "G1",
      topNote: "B6",
      resolutionType: "expand",
      confidence: 0.85,
      strength: 0.85,
      role: "expand",
      reason: "Moves the bass down while allowing the top note to rise softly."
    },
    {
      chord: "Dm/F",
      bass: "F2",
      topNote: "A6",
      resolutionType: "continue",
      confidence: 0.82,
      strength: 0.82,
      role: "continue",
      reason: "Uses a first inversion to create smooth bass descent while keeping the top note stable."
    },
    {
      chord: "Em",
      bass: "E2",
      topNote: "G6",
      resolutionType: "continue",
      confidence: 0.75,
      strength: 0.75,
      role: "continue",
      reason: "Returns to a previously used chord with a downward bass step and soft top-line descent."
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
