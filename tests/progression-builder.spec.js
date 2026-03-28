import { expect, test } from "@playwright/test";
import { gotoApp, openTool } from "./helpers/appTestUtils.js";

test("lets you build, identify, save, and clear a chord from the sequence keyboard", async ({ page }) => {
  await gotoApp(page);

  const keyboard = page.locator("#sequenceKeyboard");
  const playButton = keyboard.getByRole("button", { name: "Play" });
  const saveButton = keyboard.getByRole("button", { name: "Save" });
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
