import { DEFAULT_LM_STUDIO_BASE_URL } from "../settings.js";
import { sendOpenAiCompatibleResponse } from "../aiChatClients/openAiCompatibleResponsesClient.js";

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
  const payload = await response.json();

  let requestBody = null;
  if (typeof options.body === "string") {
    try {
      requestBody = JSON.parse(options.body);
    } catch {
      requestBody = options.body;
    }
  }

  const debug = {
    method: options.method || "GET",
    url,
    status: response.status,
    statusText: response.statusText || "",
    requestBody,
    responseBody: payload,
    error: ""
  };

  if (!response.ok) {
    const error = new Error(`LM Studio returned ${response.status}${response.statusText ? ` ${response.statusText}` : ""}.`);
    error.debug = {
      ...debug,
      error: error.message
    };
    throw error;
  }

  return {
    payload,
    debug
  };
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

async function loadModels(config) {
  const normalizedConfig = lmStudioProvider.getConfig(config);
  const { payload, debug } = await fetchJson(`${normalizedConfig.baseUrl}/api/v1/models`, {
    method: "GET",
    headers: {
      Accept: "application/json"
    }
  });

  if (!payload || !Array.isArray(payload.models)) {
    throw new Error("LM Studio response did not include a models array.");
  }

  return {
    models: payload.models
      .filter(model => String(model?.type || "llm") === "llm")
      .map(normalizeModel)
      .filter(model => Boolean(model.key)),
    debug
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
    const { models } = await loadModels(config);
    return models;
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

    const { models, debug } = await loadModels(normalizedConfig);
    const matchingModel = models.find(model => model.key === selectedModel) || null;

    return {
      available: Boolean(matchingModel),
      loaded: Boolean(matchingModel?.loadedInstanceId),
      loadedInstanceId: matchingModel?.loadedInstanceId || "",
      selectedModel,
      debug
    };
  },

  async connectModel(config) {
    const normalizedConfig = this.getConfig(config);
    if (!normalizedConfig.selectedModel) {
      throw new Error("No model is selected.");
    }

    const { debug } = await fetchJson(`${normalizedConfig.baseUrl}/api/v1/models/load`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: normalizedConfig.selectedModel
      })
    });

    return {
      debug
    };
  },

  async sendPrompt(config, request) {
    const normalizedConfig = this.getConfig(config);
    return sendOpenAiCompatibleResponse({
      baseUrl: normalizedConfig.baseUrl,
      model: normalizedConfig.selectedModel,
      request,
      errorLabel: "LM Studio"
    });
  }
};

export default lmStudioProvider;
