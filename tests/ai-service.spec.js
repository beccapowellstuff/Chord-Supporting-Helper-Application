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

      if (url.endsWith("/v1/responses")) {
        const requestBody = typeof init?.body === "string"
          ? JSON.parse(init.body)
          : {};

        if (requestBody?.input === "Say hello with toggle reasoning.") {
          if (requestBody?.reasoning?.effort === "on") {
            return new Response(JSON.stringify({
              error: {
                message: "Invalid enum value. Expected 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh', received 'on'",
                type: "invalid_request_error",
                param: "reasoning.effort",
                code: "invalid_enum_value"
              }
            }), {
              status: 400,
              headers: {
                "Content-Type": "application/json"
              }
            });
          }

          if (requestBody?.reasoning?.effort === "medium") {
            return new Response(JSON.stringify({
              id: "resp_test_toggle_reasoning",
              object: "response",
              output_text: "Hello from the compatibility retry."
            }), {
              status: 200,
              headers: {
                "Content-Type": "application/json"
              }
            });
          }
        }

        return new Response(JSON.stringify({
          id: "resp_test_123",
          object: "response",
          output_text: "Hello from the lazy-loaded provider."
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
      const promptResponse = await service.sendAiPrompt(settings, {
        instructions: "",
        input: "Say hello.",
        reasoningEffort: "medium",
        temperature: 0.7,
        maxOutputTokens: 4096
      });
      const promptResponseNoReasoning = await service.sendAiPrompt(settings, {
        instructions: "",
        input: "Say hello with no reasoning.",
        reasoningEffort: "none",
        temperature: 0.7,
        maxOutputTokens: 4096
      });
      const promptResponseHighReasoning = await service.sendAiPrompt(settings, {
        instructions: "",
        input: "Say hello with high reasoning.",
        reasoningEffort: "high",
        temperature: 0.7,
        maxOutputTokens: 4096
      });
      const promptResponseToggleReasoning = await service.sendAiPrompt(settings, {
        instructions: "",
        input: "Say hello with toggle reasoning.",
        reasoningEffort: "on",
        temperature: 0.7,
        maxOutputTokens: 4096
      });
      const repeatedStatus = await service.getAiModelStatus(settings);

      return {
        providers,
        activeConfig,
        models,
        status,
        promptResponse,
        promptResponseNoReasoning,
        promptResponseHighReasoning,
        promptResponseToggleReasoning,
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

  expect(serviceResult.status).toMatchObject({
    available: true,
    loaded: true,
    loadedInstanceId: "google/gemma-4-27b",
    selectedModel: "google/gemma-4-27b"
  });
  expect(serviceResult.status.debug).toMatchObject({
    method: "GET",
    url: "http://127.0.0.1:1234/api/v1/models"
  });

  expect(serviceResult.promptResponse.text).toBe("Hello from the lazy-loaded provider.");
  expect(serviceResult.promptResponse.debug).toMatchObject({
    method: "POST",
    url: "http://127.0.0.1:1234/v1/responses",
    requestBody: {
      model: "google/gemma-4-27b",
      input: "Say hello.",
      reasoning: {
        effort: "medium"
      },
      temperature: 0.7,
      max_output_tokens: 4096,
      store: false
    }
  });

  expect(serviceResult.promptResponseNoReasoning.text).toBe("Hello from the lazy-loaded provider.");
  expect(serviceResult.promptResponseNoReasoning.debug).toMatchObject({
    method: "POST",
    url: "http://127.0.0.1:1234/v1/responses",
    requestBody: {
      model: "google/gemma-4-27b",
      input: "Say hello with no reasoning.",
      reasoning: {
        effort: "none"
      },
      temperature: 0.7,
      max_output_tokens: 4096,
      store: false
    }
  });

  expect(serviceResult.promptResponseHighReasoning.text).toBe("Hello from the lazy-loaded provider.");
  expect(serviceResult.promptResponseHighReasoning.debug).toMatchObject({
    method: "POST",
    url: "http://127.0.0.1:1234/v1/responses",
    requestBody: {
      model: "google/gemma-4-27b",
      input: "Say hello with high reasoning.",
      reasoning: {
        effort: "high"
      },
      temperature: 0.7,
      max_output_tokens: 4096,
      store: false
    }
  });

  expect(serviceResult.promptResponseToggleReasoning.text).toBe("Hello from the compatibility retry.");
  expect(serviceResult.promptResponseToggleReasoning.debug).toMatchObject({
    method: "POST",
    url: "http://127.0.0.1:1234/v1/responses",
    requestBody: {
      model: "google/gemma-4-27b",
      input: "Say hello with toggle reasoning.",
      reasoning: {
        effort: "medium"
      },
      temperature: 0.7,
      max_output_tokens: 4096,
      store: false
    },
    retry: {
      reason: "invalid-reasoning-enum",
      initialReasoningEffort: "on",
      fallbackReasoningEffort: "medium",
      supportedSettings: ["none", "minimal", "low", "medium", "high", "xhigh"]
    }
  });

  expect(serviceResult.repeatedStatus).toEqual(serviceResult.status);
  expect(serviceResult.fetchCalls.map(call => `${call.method} ${call.url}`)).toEqual([
    "GET http://127.0.0.1:1234/api/v1/models",
    "GET http://127.0.0.1:1234/api/v1/models",
    "POST http://127.0.0.1:1234/api/v1/models/load",
    "POST http://127.0.0.1:1234/v1/responses",
    "POST http://127.0.0.1:1234/v1/responses",
    "POST http://127.0.0.1:1234/v1/responses",
    "POST http://127.0.0.1:1234/v1/responses",
    "POST http://127.0.0.1:1234/v1/responses",
    "GET http://127.0.0.1:1234/api/v1/models"
  ]);
});
