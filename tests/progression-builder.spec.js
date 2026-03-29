import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { gotoApp, openTool } from "./helpers/appTestUtils.js";

test("lets you build, auto-recognise, add, and clear a chord from the sequence keyboard", async ({ page }) => {
  await gotoApp(page);

  const keyboard = page.locator("#sequenceKeyboard");
  const playButton = keyboard.getByRole("button", { name: "Play" });
  const saveButton = keyboard.getByRole("button", { name: "Add" });
  const clearButton = keyboard.getByRole("button", { name: "Clear" });

  await expect(keyboard.locator(".sequence-keyboard-chord-name")).toHaveText("No notes selected");
  await expect(playButton).toBeDisabled();
  await expect(saveButton).toBeDisabled();

  await keyboard.locator('[data-midi="60"]').click();
  await keyboard.locator('[data-midi="64"]').click();
  await keyboard.locator('[data-midi="67"]').click();

  await expect(keyboard.locator(".sequence-keyboard-chord-name")).toHaveText("C");
  await expect(playButton).toBeEnabled();
  await expect(saveButton).toBeEnabled();

  await saveButton.click();
  await expect(page.locator("#progression")).toHaveValue("C");

  await clearButton.click();
  await expect(keyboard.locator(".sequence-keyboard-chord-name")).toHaveText("No notes selected");
  await expect(playButton).toBeDisabled();
  await expect(saveButton).toBeDisabled();
});

test("reflects chord explorer playback on the progression builder keyboard", async ({ page }) => {
  await gotoApp(page);
  await openTool(page, "Chord Explorer");

  const coreButtons = page.locator(".chord-group-core .chord-btn");
  await coreButtons.evaluateAll(buttons => {
    const target = buttons.find(button => button.textContent.replace(/\s+/g, " ").trim() === "C");
    target?.click();
  });

  const keyboard = page.locator("#sequenceKeyboard");
  await expect(keyboard.locator(".sequence-keyboard-chord-name")).toHaveText("C");
  await expect(keyboard.locator('[data-midi="48"]')).toHaveClass(/sequence-key-active/);
  await expect(keyboard.locator('[data-midi="60"]')).toHaveClass(/sequence-key-active/);
  await expect(keyboard.locator('[data-midi="64"]')).toHaveClass(/sequence-key-active/);
  await expect(keyboard.locator('[data-midi="67"]')).toHaveClass(/sequence-key-active/);
});

test("shows a popup when saving a progression without chords", async ({ page }) => {
  await gotoApp(page);

  let dialogMessage = "";
  page.once("dialog", async dialog => {
    dialogMessage = dialog.message();
    await dialog.accept();
  });

  await page.locator("#saveProgressionBtn").dispatchEvent("click");
  await expect.poll(() => dialogMessage).toBe("Add at least one chord before saving the progression.");
});

test("saves and loads a progression file with one chord per bar", async ({ page }) => {
  await gotoApp(page);

  await page.locator("#progression").fill("C | F | G");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save progression" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("c-ionian-progression.json");

  const downloadPath = await download.path();
  const raw = await readFile(downloadPath, "utf8");
  const savedProgression = JSON.parse(raw);

  expect(savedProgression.type).toBe("chordcanvas-progression");
  expect(savedProgression.version).toBe(1);
  expect(savedProgression.bars).toEqual([
    { bar: 1, chord: "C" },
    { bar: 2, chord: "F" },
    { bar: 3, chord: "G" }
  ]);

  await page.locator("#progression").fill("");
  await page.locator("#loadProgressionInput").setInputFiles({
    name: "saved-progression.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(savedProgression), "utf8")
  });

  await expect(page.locator("#progression")).toHaveValue("C | F | G");
});
