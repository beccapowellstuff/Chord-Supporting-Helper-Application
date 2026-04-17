import { DEFAULT_LM_STUDIO_BASE_URL } from "../settings.js";
import { sendOpenAiCompatibleChatCompletion } from "../aiChatClients/openAiCompatibleChatClient.js";

function normalizeBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "") || DEFAULT_LM_STUDIO_BASE_URL;
}

function normalizeSelectedModel(value) {
  return String(value || "").trim();
}

function getLoadedInstanceId(model) {
  const loadedInstances = Array.isArray(model?.loaded_instances) ? model.loaded_instances : [];
  const firstInstance = loadedInstances[0];
  if (typeof firstInstance === "string") {
    return firstInstance.trim();
  }

  return String(firstInstance?.instance_id || firstInstance?.id || "").trim();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`LM Studio returned ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`);
  }

  return response.json();
}

function normalizeModel(model) {
  const key = String(model?.key || "").trim();
  const displayName = String(model?.display_name || "").trim();
  const label = displayName && displayName !== key
    ? `${displayName} (${key})`
    : (displayName || key || "Unnamed model");

  return {
    key,
    displayName: displayName || key || "Unnamed model",
    label,
    loadedInstanceId: getLoadedInstanceId(model)
  };
}

const lmStudioProvider = {
  id: "lmStudio",
  label: "LM Studio",

  getConfig(rawConfig = {}) {
    return {
      baseUrl: normalizeBaseUrl(rawConfig.baseUrl),
      selectedModel: normalizeSelectedModel(rawConfig.selectedModel)
    };
  },

  async listModels(config) {
    const normalizedConfig = this.getConfig(config);
    const payload = await fetchJson(`${normalizedConfig.baseUrl}/api/v1/models`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!payload || !Array.isArray(payload.models)) {
      throw new Error("LM Studio response did not include a models array.");
    }

    return payload.models
      .filter(model => String(model?.type || "llm") === "llm")
      .map(normalizeModel)
      .filter(model => Boolean(model.key));
  },

  async getModelStatus(config) {
    const normalizedConfig = this.getConfig(config);
    const selectedModel = normalizedConfig.selectedModel;

    if (!selectedModel) {
      return {
        available: false,
        loaded: false,
        loadedInstanceId: "",
        selectedModel
      };
    }

    const models = await this.listModels(normalizedConfig);
    const matchingModel = models.find(model => model.key === selectedModel) || null;

    return {
      available: Boolean(matchingModel),
      loaded: Boolean(matchingModel?.loadedInstanceId),
      loadedInstanceId: matchingModel?.loadedInstanceId || "",
      selectedModel
    };
  },

  async connectModel(config) {
    const normalizedConfig = this.getConfig(config);
    if (!normalizedConfig.selectedModel) {
      throw new Error("No model is selected.");
    }

    await fetchJson(`${normalizedConfig.baseUrl}/api/v1/models/load`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: normalizedConfig.selectedModel
      })
    });
  },

  async sendPrompt(config, prompt) {
    const normalizedConfig = this.getConfig(config);
    return sendOpenAiCompatibleChatCompletion({
      baseUrl: normalizedConfig.baseUrl,
      model: normalizedConfig.selectedModel,
      prompt,
      errorLabel: "LM Studio"
    });
  }
};

export default lmStudioProvider;
