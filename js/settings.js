const APP_SETTINGS_STORAGE_KEY = "vibe-chording-settings";
const APP_SETTINGS_VERSION = 1;
const DEFAULT_TEMPO_BPM = 120;

export const DEFAULT_AI_PROVIDER_ID = "lmStudio";
export const DEFAULT_LM_STUDIO_BASE_URL = "http://127.0.0.1:1234";

export const DEFAULT_APP_SETTINGS = Object.freeze({
  version: APP_SETTINGS_VERSION,
  preferences: Object.freeze({
    defaultTempoBpm: DEFAULT_TEMPO_BPM,
    ai: Object.freeze({
      provider: DEFAULT_AI_PROVIDER_ID,
      providers: Object.freeze({
        lmStudio: Object.freeze({
          baseUrl: DEFAULT_LM_STUDIO_BASE_URL,
          selectedModel: ""
        })
      })
    })
  })
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTempoBpmValue(value, fallback = DEFAULT_APP_SETTINGS.preferences.defaultTempoBpm) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(40, Math.min(240, Math.round(numericValue)));
}

function normalizeAiProvider(value, fallback = DEFAULT_APP_SETTINGS.preferences.ai.provider) {
  return String(value || "").trim() || fallback;
}

function normalizeAiBaseUrl(value, fallback = DEFAULT_APP_SETTINGS.preferences.ai.providers.lmStudio.baseUrl) {
  const normalizedValue = String(value || "").trim().replace(/\/+$/, "");
  return normalizedValue || fallback;
}

function normalizeSelectedModel(value) {
  return String(value || "").trim();
}

function normalizeLmStudioSettings(raw, legacyAi = {}) {
  const lmStudio = isPlainObject(raw) ? raw : {};

  return {
    baseUrl: normalizeAiBaseUrl(
      lmStudio.baseUrl ?? legacyAi.baseUrl,
      DEFAULT_APP_SETTINGS.preferences.ai.providers.lmStudio.baseUrl
    ),
    selectedModel: normalizeSelectedModel(
      lmStudio.selectedModel ?? legacyAi.selectedModel
    )
  };
}

export function mergeWithDefaultSettings(raw) {
  const settings = isPlainObject(raw) ? raw : {};
  const preferences = isPlainObject(settings.preferences) ? settings.preferences : {};
  const ai = isPlainObject(preferences.ai) ? preferences.ai : {};
  const providers = isPlainObject(ai.providers) ? ai.providers : {};

  return {
    version: APP_SETTINGS_VERSION,
    preferences: {
      defaultTempoBpm: normalizeTempoBpmValue(
        preferences.defaultTempoBpm,
        DEFAULT_APP_SETTINGS.preferences.defaultTempoBpm
      ),
      ai: {
        provider: normalizeAiProvider(
          ai.provider,
          DEFAULT_APP_SETTINGS.preferences.ai.provider
        ),
        providers: {
          lmStudio: normalizeLmStudioSettings(providers.lmStudio, ai)
        }
      }
    }
  };
}

export function loadAppSettings() {
  try {
    const rawValue = window.localStorage?.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!rawValue) {
      return mergeWithDefaultSettings();
    }

    return mergeWithDefaultSettings(JSON.parse(rawValue));
  } catch (error) {
    console.warn("Could not load app settings:", error);
    return mergeWithDefaultSettings();
  }
}

export function saveAppSettings(settings) {
  const mergedSettings = mergeWithDefaultSettings(settings);

  try {
    window.localStorage?.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(mergedSettings));
  } catch (error) {
    console.warn("Could not save app settings:", error);
  }

  return mergedSettings;
}

export function applySettingsToAppState(appState, settings) {
  const mergedSettings = mergeWithDefaultSettings(settings);
  appState.appSettings = mergedSettings;
  appState.sequenceTempoBpm = normalizeTempoBpmValue(
    mergedSettings.preferences.defaultTempoBpm,
    appState.sequenceTempoBpm
  );
}

export function getAppSettingsStorageKey() {
  return APP_SETTINGS_STORAGE_KEY;
}
