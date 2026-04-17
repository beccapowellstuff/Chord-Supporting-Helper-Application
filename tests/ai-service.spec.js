import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers/appTestUtils.js";

test("AI service lazy-loads the selected provider and falls back to LM Studio for unknown ids", async ({ page }) => {
  await gotoApp(page);

  const serviceResult = await page.evaluate(async () => {
    const originalFetch = window.fetch.bind(window);
    const fetchCalls = [];

    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.url;
      fetchCalls.push({
        url,
        method: init?.method || "GET"
      });

      if (url.endsWith("/api/v1/models")) {
        return new Response(JSON.stringify({
          models: [
            {
              type: "llm",
              key: "google/gemma-4-27b",
              display_name: "Gemma 4 27B",
              loaded_instances: ["google/gemma-4-27b"]
            }
          ]
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }

      if (url.endsWith("/api/v1/models/load")) {
        return new Response(JSON.stringify({ status: "loaded" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }

      if (url.endsWith("/v1/chat/completions")) {
        return new Response(JSON.stringify({
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello from the lazy-loaded provider."
              },
              finish_reason: "stop"
            }
          ]
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        });
      }

      return originalFetch(input, init);
    };

    try {
      const service = await import("/js/aiService.js");
      const settings = {
        version: 1,
        preferences: {
          defaultTempoBpm: 120,
          ai: {
            provider: "notImplementedYet",
            providers: {
              lmStudio: {
                baseUrl: "http://127.0.0.1:1234",
                selectedModel: "google/gemma-4-27b"
              }
            }
          }
        }
      };

      const providers = service.listAvailableAiProviders();
      const activeConfig = service.getActiveAiProviderConfig(settings);
      const models = await service.listAiModels(settings);
      const status = await service.getAiModelStatus(settings);
      await service.connectAiModel(settings);
      const promptResponse = await service.sendAiPrompt(settings, "Say hello.");
      const repeatedStatus = await service.getAiModelStatus(settings);

      return {
        providers,
        activeConfig,
        models,
        status,
        promptResponse,
        repeatedStatus,
        fetchCalls
      };
    } finally {
      window.fetch = originalFetch;
    }
  });

  expect(serviceResult.providers).toEqual([
    {
      id: "lmStudio",
      label: "LM Studio"
    }
  ]);

  expect(serviceResult.activeConfig).toEqual({
    providerId: "lmStudio",
    providerLabel: "LM Studio",
    baseUrl: "http://127.0.0.1:1234",
    selectedModel: "google/gemma-4-27b"
  });

  expect(serviceResult.models).toHaveLength(1);
  expect(serviceResult.models[0]).toMatchObject({
    key: "google/gemma-4-27b",
    loadedInstanceId: "google/gemma-4-27b"
  });

  expect(serviceResult.status).toEqual({
    available: true,
    loaded: true,
    loadedInstanceId: "google/gemma-4-27b",
    selectedModel: "google/gemma-4-27b"
  });

  expect(serviceResult.promptResponse).toEqual({
    text: "Hello from the lazy-loaded provider."
  });

  expect(serviceResult.repeatedStatus).toEqual(serviceResult.status);
  expect(serviceResult.fetchCalls.map(call => `${call.method} ${call.url}`)).toEqual([
    "GET http://127.0.0.1:1234/api/v1/models",
    "GET http://127.0.0.1:1234/api/v1/models",
    "POST http://127.0.0.1:1234/api/v1/models/load",
    "POST http://127.0.0.1:1234/v1/chat/completions",
    "GET http://127.0.0.1:1234/api/v1/models"
  ]);
});
