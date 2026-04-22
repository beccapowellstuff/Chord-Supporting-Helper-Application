import { expect, test } from "@playwright/test";
import { gotoApp, openTool } from "./helpers/appTestUtils.js";

const SETTINGS_STORAGE_KEY = "vibe-chording-settings";

// Helper to set up AI Explore route mocks with counter-based model status
async function setupAiExploreRoutes(page, options = {}) {
  const { outputText = "Here is a chord suggestion.", includeLoadRoute = true } = options;

  let modelsRequestCount = 0;
  await page.route("http://127.0.0.1:1234/api/v1/models", route => {
    modelsRequestCount += 1;
    const isLoaded = modelsRequestCount >= 2;

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({
        models: [
          {
            type: "llm",
            key: "google/gemma-4-27b",
            display_name: "Gemma 4 27B",
            loaded_instances: isLoaded ? ["google/gemma-4-27b"] : []
          }
        ]
      })
    });
  });

  if (includeLoadRoute) {
    await page.route("http://127.0.0.1:1234/api/v1/models/load", route =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*"
        },
        body: JSON.stringify({
          type: "llm",
          instance_id: "google/gemma-4-27b",
          status: "loaded",
          load_time_seconds: 1.2
        })
      })
    );
  }

  await page.route("http://127.0.0.1:1234/v1/responses", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({
        id: `resp_test_${modelsRequestCount}`,
        object: "response",
        created_at: 1710000000,
        model: "google/gemma-4-27b",
        output_text: outputText
      })
    });
  });
}

// ── AI Explore prompt clearing tests ──────────────────────────────────────

test("AI Explore clears the prompt input after submission", async ({ page }) => {
  await page.addInitScript(storageKey => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      preferences: {
        defaultTempoBpm: 120,
        ai: {
          provider: "lmStudio",
          providers: {
            lmStudio: {
              baseUrl: "http://127.0.0.1:1234",
              selectedModel: "google/gemma-4-27b"
            }
          }
        }
      }
    }));
  }, SETTINGS_STORAGE_KEY);

  await gotoApp(page);

  // Set up settings and route mocks
  await setupAiExploreRoutes(page, { outputText: "Try a Dm7 with bass D3 and top note C5." });

  await openTool(page, "AI Explore");

  // Wait for the prompt input to be enabled (refreshAiExploreModelStatus runs on panel open)
  await expect(page.locator("#aiExplorePromptInput")).toBeEnabled();

  // Type a prompt
  await page.locator("#aiExplorePromptInput").fill("What chord should I try next? Suggest Dm7 with bass D3 and top note C5.");

  // Verify the input has text
  const beforeValue = await page.locator("#aiExplorePromptInput").inputValue();
  expect(beforeValue).toContain("Dm7");

  // Submit the prompt - button should be enabled after typing
  await expect(page.locator("#aiExploreSubmitBtn")).toBeEnabled();
  await page.locator("#aiExploreSubmitBtn").click();

  // After submission, the prompt should be cleared (wait for it to become empty)
  await expect(page.locator("#aiExplorePromptInput")).toHaveValue("");

  // Verify the conversation contains the user message
  await expect(page.locator(".ai-explore-conversation-list")).toContainText("What chord should I try next?");
});

// ── AI Explore suggestion parsing tests ───────────────────────────────────

test("AI Explore parses chord suggestions from AI responses and shows them in conversation", async ({ page }) => {
  await page.addInitScript(storageKey => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      preferences: {
        defaultTempoBpm: 120,
        ai: {
          provider: "lmStudio",
          providers: {
            lmStudio: {
              baseUrl: "http://127.0.0.1:1234",
              selectedModel: "google/gemma-4-27b"
            }
          }
        }
      }
    }));
  }, SETTINGS_STORAGE_KEY);

  await gotoApp(page);

  await setupAiExploreRoutes(page, {
    outputText: `Here are some chord suggestions for your progression:\n\nSuggestion: Dm7 (bass: D3, top note: C5)\nAlternative: Fmaj7 (bass: F3, top note: E5)`
  });

  await openTool(page, "AI Explore");

  // Wait for the prompt input to be enabled (refreshAiExploreModelStatus runs on panel open)
  await expect(page.locator("#aiExplorePromptInput")).toBeEnabled();

  // Send a prompt with structured suggestions
  await page.locator("#aiExplorePromptInput").fill("Give me chord suggestions for my progression.");
  await page.locator("#aiExploreSubmitBtn").click();

  // Wait for response output to appear in the conversation list
  await expect(page.locator(".ai-explore-conversation-list")).toContainText("Dm7");

  // Verify the prompt input was cleared after submission
  const inputValue = await page.locator("#aiExplorePromptInput").inputValue();
  expect(inputValue).toBe("");
});

// ── dim7 chord suggestion tests ───────────────────────────────────────────

test("AI Explore handles dim7 chord suggestions correctly", async ({ page }) => {
  await page.addInitScript(storageKey => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      preferences: {
        defaultTempoBpm: 120,
        ai: {
          provider: "lmStudio",
          providers: {
            lmStudio: {
              baseUrl: "http://127.0.0.1:1234",
              selectedModel: "google/gemma-4-27b"
            }
          }
        }
      }
    }));
  }, SETTINGS_STORAGE_KEY);

  await gotoApp(page);

  await setupAiExploreRoutes(page, { outputText: "Try a C#dim7 with bass C#2 and top note B3." });

  await openTool(page, "AI Explore");

  // Wait for the prompt input to be enabled (refreshAiExploreModelStatus runs on panel open)
  await expect(page.locator("#aiExplorePromptInput")).toBeEnabled();

  // Send a prompt about dim7 chords
  await page.locator("#aiExplorePromptInput").fill("What dim7 chord should I use here? Suggest C#dim7 with bass C#2 and top note B3.");
  await page.locator("#aiExploreSubmitBtn").click();

  // Wait for response output to appear in the conversation list
  await expect(page.locator(".ai-explore-conversation-list")).toContainText("C#dim7");

  // Verify the prompt input was cleared after submission
  const inputValue = await page.locator("#aiExplorePromptInput").inputValue();
  expect(inputValue).toBe("");
});

// ── Multiple prompts in sequence tests ────────────────────────────────────

test("AI Explore can handle multiple sequential prompts with clearing between each", async ({ page }) => {
  await page.addInitScript(storageKey => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      preferences: {
        defaultTempoBpm: 120,
        ai: {
          provider: "lmStudio",
          providers: {
            lmStudio: {
              baseUrl: "http://127.0.0.1:1234",
              selectedModel: "google/gemma-4-27b"
            }
          }
        }
      }
    }));
  }, SETTINGS_STORAGE_KEY);

  await gotoApp(page);

  let modelsRequestCount = 0;
  await page.route("http://127.0.0.1:1234/api/v1/models", route => {
    modelsRequestCount += 1;
    const isLoaded = modelsRequestCount >= 2;

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({
        models: [
          {
            type: "llm",
            key: "google/gemma-4-27b",
            display_name: "Gemma 4 27B",
            loaded_instances: isLoaded ? ["google/gemma-4-27b"] : []
          }
        ]
      })
    });
  });

  await page.route("http://127.0.0.1:1234/api/v1/models/load", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({
        type: "llm",
        instance_id: "google/gemma-4-27b",
        status: "loaded",
        load_time_seconds: 1.2
      })
    })
  );

  let promptCount = 0;
  await page.route("http://127.0.0.1:1234/v1/responses", async route => {
    promptCount += 1;
    const request = route.request();
    const payload = request.postDataJSON();

    expect(payload).toMatchObject({
      model: "google/gemma-4-27b",
      max_output_tokens: 4096,
      store: false
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({
        id: `resp_test_${promptCount}`,
        object: "response",
        created_at: 1710000000,
        model: "google/gemma-4-27b",
        output_text: `Response ${promptCount}: Here is a chord suggestion.`
      })
    });
  });

  await openTool(page, "AI Explore");

  // Wait for the prompt input to be enabled (refreshAiExploreModelStatus runs on panel open)
  await expect(page.locator("#aiExplorePromptInput")).toBeEnabled();

  // First prompt
  await page.locator("#aiExplorePromptInput").fill("First chord suggestion request.");
  await page.locator("#aiExploreSubmitBtn").click();

  // Verify clearing after first submission
  await expect(page.locator("#aiExplorePromptInput")).toHaveValue("");

  // Second prompt
  await page.locator("#aiExplorePromptInput").fill("Second chord suggestion request.");
  await page.locator("#aiExploreSubmitBtn").click();

  // Verify clearing after second submission
  await expect(page.locator("#aiExplorePromptInput")).toHaveValue("");

  // Both messages should be in the conversation list
  const conversationContent = await page.locator(".ai-explore-conversation-list").textContent();
  expect(conversationContent).toContain("First chord suggestion request.");
  expect(conversationContent).toContain("Second chord suggestion request.");
});
