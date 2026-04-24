import { expect, test } from "@playwright/test";
import { gotoApp, openTool } from "./helpers/appTestUtils.js";

const SETTINGS_STORAGE_KEY = "vibe-chording-settings";

test("AI Explore connects the saved model and shows a prompt response", async ({ page }) => {
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

  await page.route("http://127.0.0.1:1234/v1/responses", async route => {
    const request = route.request();
    const payload = request.postDataJSON();

    expect(payload).toMatchObject({
      model: "google/gemma-4-27b",
      input: "Say hello from the AI Explore MVP test.",
      reasoning: {
        effort: "high"
      },
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
        id: "resp_test_123",
        object: "response",
        created_at: 1710000000,
        model: "google/gemma-4-27b",
        output_text: "Hello from LM Studio. The AI Explore MVP test worked."
      })
    });
  });

  await gotoApp(page);
  await openTool(page, "AI Explore");

  // Wait for the prompt input to be enabled (model auto-connected)
  await expect(page.locator("#aiExplorePromptInput")).toBeEnabled();
  await expect(page.locator("#aiExploreSubmitBtn")).toBeDisabled();

  // Verify reasoning effort default
  await expect(page.locator("#aiExploreReasoningEffort")).toHaveValue("medium");
  await page.locator("#aiExploreReasoningEffort").selectOption("high");
  await expect(page.locator("#aiExploreReasoningEffort")).toHaveValue("high");
  await expect(page.locator("#aiExploreIncludeProgression")).not.toBeChecked();

  await page.locator("#aiExplorePromptInput").fill("Say hello from the AI Explore MVP test.");
  await expect(page.locator("#aiExploreSubmitBtn")).toBeEnabled();
  await page.locator("#aiExploreSubmitBtn").click();

  // Wait for response to appear in conversation list
  await expect(page.locator(".ai-explore-conversation-list")).toContainText("Hello from LM Studio. The AI Explore MVP test worked.");

  // Verify prompt was cleared after submission
  await expect(page.locator("#aiExplorePromptInput")).toHaveValue("");

  // Toggle debug panel
  await page.locator("#toggleAiExploreDebugBtn").click();

  await expect(page.locator("#aiExploreDebugPanel")).toBeVisible();
  await expect(page.locator("#aiExploreDebugOutput")).toContainText("Action: send-prompt");
  await expect(page.locator("#aiExploreDebugOutput")).toContainText("URL: http://127.0.0.1:1234/v1/responses");
  await expect(page.locator("#aiExploreDebugOutput")).toContainText("\"model\": \"google/gemma-4-27b\"");
  await expect(page.locator("#aiExploreDebugOutput")).toContainText("\"effort\": \"high\"");
  await expect(page.locator("#aiExploreDebugOutput")).toContainText("Hello from LM Studio. The AI Explore MVP test worked.");
});

test("AI Explore only includes progression context when the checkbox is ticked", async ({ page }) => {
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

  let requestCount = 0;
  await page.route("http://127.0.0.1:1234/v1/responses", async route => {
    requestCount += 1;
    const payload = route.request().postDataJSON();
    const serializedInput = JSON.stringify(payload.input);

    if (requestCount === 1) {
      expect(serializedInput).toContain("What do you think?");
      expect(serializedInput).not.toContain("Included progression context:");
    }

    if (requestCount === 2) {
      expect(serializedInput).toContain("Included progression context:");
      expect(serializedInput).toContain("Use the progression context now.");
      expect(serializedInput).toContain("Feeling:");
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({
        id: `resp_test_${requestCount}`,
        object: "response",
        created_at: 1710000000,
        model: "google/gemma-4-27b",
        output_text: "Freeform reply."
      })
    });
  });

  await gotoApp(page);
  await page.evaluate(() => {
    const progressionInput = document.getElementById("progression");
    if (!progressionInput) {
      throw new Error("Progression input not found.");
    }

    progressionInput.value = "C F G";
    progressionInput.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await openTool(page, "AI Explore");

  await expect(page.locator("#aiExplorePromptInput")).toBeEnabled();
  await expect(page.locator("#aiExploreIncludeProgression")).not.toBeChecked();

  await page.locator("#aiExplorePromptInput").fill("What do you think?");
  await page.locator("#aiExploreSubmitBtn").click();

  await expect(page.locator(".ai-explore-conversation-list")).toContainText("Freeform reply.");

  await page.locator("#aiExploreIncludeProgression").check();
  await page.locator("#aiExplorePromptInput").fill("Use the progression context now.");
  await expect(page.locator("#aiExploreSubmitBtn")).toBeEnabled();
  await page.locator("#aiExploreSubmitBtn").click();

  await expect.poll(() => requestCount).toBe(2);
});

test("AI Explore conversation cleans common LaTeX-style chord formatting", async ({ page }) => {
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

  await page.route("http://127.0.0.1:1234/v1/responses", async route => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({
        id: "resp_test_latex_cleanup",
        object: "response",
        created_at: 1710000000,
        model: "google/gemma-4-27b",
        output_text: "dominants ($A7 \\\\to Dm$), diminished chords ($G\\\\#dim$), and modal interchange ($Eb7$, $F\\\\#m7b5$)."
      })
    });
  });

  await gotoApp(page);
  await openTool(page, "AI Explore");

  await expect(page.locator("#aiExplorePromptInput")).toBeEnabled();
  await page.locator("#aiExplorePromptInput").fill("Talk about altered harmony.");
  await page.locator("#aiExploreSubmitBtn").click();

  await expect(page.locator(".ai-explore-conversation-list")).toContainText("dominants (A7 -> Dm), diminished chords (G#dim), and modal interchange (Eb7, F#m7b5).");
  await expect(page.locator(".ai-explore-conversation-list")).not.toContainText("$A7");
  await expect(page.locator(".ai-explore-conversation-list")).not.toContainText("\\to");
});
