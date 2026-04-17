import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers/appTestUtils.js";

const SETTINGS_STORAGE_KEY = "vibe-chording-settings";

async function reloadApp(page) {
  await page.reload();
  await page.waitForFunction(() => {
    return Boolean(window.appState && Array.isArray(window.appState.keyChordSet) && window.appState.keyChordSet.length === 7);
  });
}

async function loadStructuredProgression(page, progression, filename = "settings-progression.json") {
  await page.locator("#loadProgressionInput").setInputFiles({
    name: filename,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(progression), "utf8")
  });
}

test("saves settings to local storage and restores the default tempo on reload", async ({ page }) => {
  await gotoApp(page);

  const openSettingsButton = page.locator("#openSettingsBtn");
  const settingsModal = page.locator("#appSettingsModal");
  const defaultTempoInput = page.locator("#defaultTempoBpmSetting");
  const sequenceTempoInput = page.locator("#sequenceTempoBpm");

  await expect(sequenceTempoInput).toHaveValue("120");

  await openSettingsButton.click();
  await expect(settingsModal).toBeVisible();
  await expect(defaultTempoInput).toHaveValue("120");

  await defaultTempoInput.fill("132");
  await page.locator("#saveAppSettingsBtn").click();

  await expect(settingsModal).toBeHidden();
  await expect(sequenceTempoInput).toHaveValue("132");

  const storedSettings = await page.evaluate(storageKey => {
    return window.localStorage.getItem(storageKey);
  }, SETTINGS_STORAGE_KEY);
  expect(JSON.parse(storedSettings)).toEqual({
    version: 1,
    preferences: {
      defaultTempoBpm: 132
    }
  });

  await reloadApp(page);
  await expect(page.locator("#sequenceTempoBpm")).toHaveValue("132");

  await page.locator("#openSettingsBtn").click();
  await expect(page.locator("#defaultTempoBpmSetting")).toHaveValue("132");
});

test("falls back to defaults when stored settings are invalid", async ({ page }) => {
  await page.addInitScript(storageKey => {
    window.localStorage.setItem(storageKey, "{not-valid-json");
  }, SETTINGS_STORAGE_KEY);

  await gotoApp(page);

  await expect(page.locator("#sequenceTempoBpm")).toHaveValue("120");

  await page.locator("#openSettingsBtn").click();
  await expect(page.locator("#defaultTempoBpmSetting")).toHaveValue("120");
});

test("discards unsaved settings edits on cancel, overlay click, and Escape", async ({ page }) => {
  await gotoApp(page);

  const openSettingsButton = page.locator("#openSettingsBtn");
  const settingsModal = page.locator("#appSettingsModal");
  const defaultTempoInput = page.locator("#defaultTempoBpmSetting");

  await openSettingsButton.click();
  await expect(settingsModal).toBeVisible();
  await defaultTempoInput.fill("145");
  await page.locator("#cancelAppSettingsBtn").click();

  await expect(settingsModal).toBeHidden();
  await expect(page.locator("#sequenceTempoBpm")).toHaveValue("120");
  await expect(page.evaluate(storageKey => window.localStorage.getItem(storageKey), SETTINGS_STORAGE_KEY)).resolves.toBeNull();

  await openSettingsButton.click();
  await defaultTempoInput.fill("150");
  await page.mouse.click(8, 8);
  await expect(settingsModal).toBeHidden();

  await openSettingsButton.click();
  await expect(defaultTempoInput).toHaveValue("120");
  await defaultTempoInput.fill("155");
  await page.keyboard.press("Escape");
  await expect(settingsModal).toBeHidden();

  await openSettingsButton.click();
  await expect(defaultTempoInput).toHaveValue("120");
});

test("keeps imported progression tempo instead of overwriting it with the saved default", async ({ page }) => {
  await page.addInitScript(storageKey => {
    window.localStorage.setItem(storageKey, JSON.stringify({
      version: 1,
      preferences: {
        defaultTempoBpm: 150
      }
    }));
  }, SETTINGS_STORAGE_KEY);

  await gotoApp(page);

  const sequenceTempoInput = page.locator("#sequenceTempoBpm");
  await expect(sequenceTempoInput).toHaveValue("150");

  await loadStructuredProgression(page, {
    type: "chordcanvas-progression",
    version: 2,
    sequence: {
      tempoBpm: 98,
      timeSignature: "4/4"
    },
    items: [
      { position: 1, chord: "C", durationBeats: 4 },
      { position: 2, chord: "F", durationBeats: 4 }
    ]
  });

  await expect(sequenceTempoInput).toHaveValue("98");
});
