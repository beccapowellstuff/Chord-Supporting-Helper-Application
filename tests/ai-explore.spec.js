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

  await page.route("http://127.0.0.1:1234/v1/chat/completions", async route => {
    const request = route.request();
    const payload = request.postDataJSON();

    expect(payload).toMatchObject({
      model: "google/gemma-4-27b",
      messages: [
        {
          role: "user",
          content: "Say hello from the AI Explore MVP test."
        }
      ],
      max_tokens: 4096,
      stream: false
    });

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({
        id: "chatcmpl_test_123",
        object: "chat.completion",
        created: 1710000000,
        model: "google/gemma-4-27b",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "Hello from LM Studio. The AI Explore MVP test worked."
            },
            finish_reason: "stop"
          }
        ]
      })
    });
  });

  await gotoApp(page);
  await openTool(page, "AI Explore");

  await expect(page.locator("#aiExploreBaseUrl")).toHaveText("http://127.0.0.1:1234");
  await expect(page.locator("#aiExploreSelectedModel")).toHaveText("google/gemma-4-27b");
  await expect(page.locator("#aiExploreLoadedState")).toHaveText("Not loaded");
  await expect(page.locator("#aiExplorePromptInput")).toBeDisabled();
  await expect(page.locator("#aiExploreSubmitBtn")).toBeDisabled();
  await expect(page.locator("#aiExploreConnectBtn")).toBeEnabled();

  await page.locator("#aiExploreConnectBtn").click();

  await expect(page.locator("#aiExploreLoadedState")).toContainText("Loaded");
  await expect(page.locator("#aiExploreStatusMessage")).toContainText("ready for prompts");
  await expect(page.locator("#aiExplorePromptInput")).toBeEnabled();

  await page.locator("#aiExplorePromptInput").fill("Say hello from the AI Explore MVP test.");
  await expect(page.locator("#aiExploreSubmitBtn")).toBeEnabled();
  await page.locator("#aiExploreSubmitBtn").click();

  await expect(page.locator("#aiExploreResponseOutput")).toContainText("Hello from LM Studio. The AI Explore MVP test worked.");
  await expect(page.locator("#aiExploreStatusMessage")).toContainText("Prompt completed successfully.");
});
