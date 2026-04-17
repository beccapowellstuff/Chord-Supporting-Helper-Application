const APP_SETTINGS_STORAGE_KEY = "vibe-chording-settings";
const APP_SETTINGS_VERSION = 1;
const DEFAULT_TEMPO_BPM = 120;
const DEFAULT_AI_BASE_URL = "http://127.0.0.1:1234";

export const DEFAULT_APP_SETTINGS = Object.freeze({
  version: APP_SETTINGS_VERSION,
  preferences: Object.freeze({
    defaultTempoBpm: DEFAULT_TEMPO_BPM,
    ai: Object.freeze({
      baseUrl: DEFAULT_AI_BASE_URL,
      selectedModel: ""
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

function normalizeAiBaseUrl(value, fallback = DEFAULT_APP_SETTINGS.preferences.ai.baseUrl) {
  const normalizedValue = String(value || "").trim().replace(/\/+$/, "");
  return normalizedValue || fallback;
}

function normalizeSelectedModel(value) {
  return String(value || "").trim();
}

export function mergeWithDefaultSettings(raw) {
  const settings = isPlainObject(raw) ? raw : {};
  const preferences = isPlainObject(settings.preferences) ? settings.preferences : {};
  const ai = isPlainObject(preferences.ai) ? preferences.ai : {};

  return {
    version: APP_SETTINGS_VERSION,
    preferences: {
      defaultTempoBpm: normalizeTempoBpmValue(
        preferences.defaultTempoBpm,
        DEFAULT_APP_SETTINGS.preferences.defaultTempoBpm
      ),
      ai: {
        baseUrl: normalizeAiBaseUrl(
          ai.baseUrl,
          DEFAULT_APP_SETTINGS.preferences.ai.baseUrl
        ),
        selectedModel: normalizeSelectedModel(ai.selectedModel)
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
