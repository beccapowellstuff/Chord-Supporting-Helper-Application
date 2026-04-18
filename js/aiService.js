import {
  DEFAULT_AI_PROVIDER_ID,
  DEFAULT_LM_STUDIO_BASE_URL,
  mergeWithDefaultSettings
} from "./settings.js";

const AI_PROVIDER_MANIFEST = Object.freeze({
  lmStudio: Object.freeze({
    id: "lmStudio",
    label: "LM Studio",
    load: () => import("./aiProviders/lmStudioProvider.js")
  })
});

const loadedProviderCache = new Map();

function getMergedSettings(settings) {
  return mergeWithDefaultSettings(settings);
}

function getRequestedProviderId(settings) {
  const mergedSettings = getMergedSettings(settings);
  return String(mergedSettings.preferences?.ai?.provider || DEFAULT_AI_PROVIDER_ID).trim();
}

function getProviderManifestById(providerId) {
  return AI_PROVIDER_MANIFEST[providerId] || AI_PROVIDER_MANIFEST[DEFAULT_AI_PROVIDER_ID];
}

function getResolvedProviderManifest(settings) {
  return getProviderManifestById(getRequestedProviderId(settings));
}

function getProviderConfig(settings, provider) {
  const mergedSettings = getMergedSettings(settings);
  const rawConfig = mergedSettings.preferences?.ai?.providers?.[provider.id] || {};
  return provider.getConfig(rawConfig);
}

async function loadProviderById(providerId) {
  const manifest = getProviderManifestById(String(providerId || "").trim());

  if (!loadedProviderCache.has(manifest.id)) {
    loadedProviderCache.set(
      manifest.id,
      manifest.load().then(module => module.default || module[`${manifest.id}Provider`])
    );
  }

  const provider = await loadedProviderCache.get(manifest.id);
  if (!provider) {
    throw new Error(`AI provider "${manifest.id}" could not be loaded.`);
  }

  return provider;
}

async function loadProvider(settings) {
  const requestedProviderId = getRequestedProviderId(settings);
  return loadProviderById(requestedProviderId);
}

export function listAvailableAiProviders() {
  return Object.values(AI_PROVIDER_MANIFEST).map(provider => ({
    id: provider.id,
    label: provider.label
  }));
}

export function getActiveAiProviderConfig(settings) {
  const mergedSettings = getMergedSettings(settings);
  const manifest = getResolvedProviderManifest(settings);
  const rawConfig = mergedSettings.preferences?.ai?.providers?.[manifest.id] || {};
  const config = manifest.id === "lmStudio"
    ? {
      baseUrl: String(rawConfig.baseUrl || "").trim().replace(/\/+$/, "") || DEFAULT_LM_STUDIO_BASE_URL,
      selectedModel: String(rawConfig.selectedModel || "").trim()
    }
    : rawConfig;

  return {
    providerId: manifest.id,
    providerLabel: manifest.label,
    ...config
  };
}

export async function listAiModels(settings) {
  const provider = await loadProvider(settings);
  return provider.listModels(getProviderConfig(settings, provider));
}

export async function getAiModelStatus(settings) {
  const provider = await loadProvider(settings);
  return provider.getModelStatus(getProviderConfig(settings, provider));
}

export async function connectAiModel(settings) {
  const provider = await loadProvider(settings);
  return provider.connectModel(getProviderConfig(settings, provider));
}

export async function sendAiPrompt(settings, prompt, options = {}) {
  const provider = await loadProvider(settings);
  return provider.sendPrompt(getProviderConfig(settings, provider), prompt, options);
}
