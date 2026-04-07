import { expect, test } from "@playwright/test";
import { gotoApp, openTool, setProgressionText } from "./helpers/appTestUtils.js";

test("loads the main app shell with builder and tool navigation", async ({ page }) => {
  await gotoApp(page);

  await expect(page).toHaveTitle("Vibe Chording");
  await expect(page.locator(".sequence-panel-title")).toHaveText("Progression Builder");
  await expect(page.getByRole("button", { name: "Play sequence" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Play from" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Redo" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save progression" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Key Explorer" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Chord Explorer" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: /Suggestion Engine/ })).toBeVisible();

  await expect(page.locator("#keyExplorerPanel")).toBeVisible();
  await expect(page.locator("#chordExplorerPanel")).toBeHidden();
  await expect(page.locator("#suggestionEnginePanel")).toBeHidden();
});

test("switches between tool panels without removing the builder", async ({ page }) => {
  await gotoApp(page);

  await openTool(page, "Chord Explorer");
  await expect(page.locator("#chordExplorerPanel")).toBeVisible();
  await expect(page.locator("#keyExplorerPanel")).toBeHidden();
  await expect(page.locator(".sequence-panel-title")).toBeVisible();

  await openTool(page, "Key Explorer");
  await expect(page.locator("#keyExplorerPanel")).toBeVisible();
  await expect(page.locator("#chordExplorerPanel")).toBeHidden();
});

test("opens metronome settings and lets you arm or stop playback clicks", async ({ page }) => {
  await gotoApp(page);

  const metronomeButton = page.getByRole("button", { name: "Metronome" });
  const popover = page.locator("#metronomePopover");
  const startStopButton = page.locator("#metronomeStartStopBtn");

  await expect(popover).toBeHidden();
  await metronomeButton.click();
  await expect(popover).toBeVisible();
  await expect(startStopButton).toHaveText("Arm");
  await expect(startStopButton).toHaveAttribute("aria-pressed", "false");

  await startStopButton.click();
  await expect(startStopButton).toHaveText("Stop");
  await expect(startStopButton).toHaveAttribute("aria-pressed", "true");

  await startStopButton.click();
  await expect(startStopButton).toHaveText("Arm");
  await expect(startStopButton).toHaveAttribute("aria-pressed", "false");

  await page.locator(".sequence-panel-title").click();
  await expect(popover).toBeHidden();
});

test("opens the demo menu and shows bundled music demos", async ({ page }) => {
  await gotoApp(page);

  const demoButton = page.locator("#loadDemoProgressionBtn");
  const demoPopover = page.locator("#demoMenuPopover");

  await expect(demoPopover).toBeHidden();
  await demoButton.click();
  await expect(demoPopover).toBeVisible();
  await expect(page.locator("#demoMenuList .progression-demo-menu-item").first()).toHaveText("Demo01-cIonian");
  await expect(page.locator("#demoMenuList .progression-demo-menu-item").nth(1)).toHaveText("Demo02-dDorian");
});

test("lets you clear the progression with the new action", async ({ page }) => {
  await gotoApp(page);

  const newButton = page.getByRole("button", { name: "Clear chord sequence" });
  const confirmPopover = page.locator("#newProgressionConfirmPopover");
  await expect(newButton).toBeDisabled();
  await expect(confirmPopover).toBeHidden();

  await setProgressionText(page, "C | F | G");
  await expect(page.locator(".progression-block")).toHaveCount(3);
  await expect(newButton).toBeEnabled();

  await newButton.click();
  await expect(confirmPopover).toBeVisible();
  await page.getByRole("button", { name: "Yes" }).click();

  await expect(page.locator(".progression-block")).toHaveCount(0);
  await expect.poll(() => page.locator("#progression").inputValue()).toBe("");
  await expect(newButton).toBeDisabled();
  await expect(confirmPopover).toBeHidden();
});

test("keeps the progression when new progression is cancelled", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "C | F | G");
  await expect(page.locator(".progression-block")).toHaveCount(3);

  await page.getByRole("button", { name: "Clear chord sequence" }).click();
  const confirmPopover = page.locator("#newProgressionConfirmPopover");
  await expect(confirmPopover).toBeVisible();
  await confirmPopover.getByRole("button", { name: "No" }).click();

  await expect(page.locator(".progression-block")).toHaveCount(3);
  await expect.poll(() => page.locator("#progression").inputValue()).toBe("C | F | G");
  await expect(confirmPopover).toBeHidden();
});

test("undo restores the previous chord sequence after clearing it", async ({ page }) => {
  await gotoApp(page);

  const undoButton = page.getByRole("button", { name: "Undo" });
  const redoButton = page.getByRole("button", { name: "Redo" });

  await setProgressionText(page, "C | F | G");
  await expect(undoButton).toBeEnabled();
  await expect(redoButton).toBeDisabled();

  await page.getByRole("button", { name: "Clear chord sequence" }).click();
  await page.getByRole("button", { name: "Yes" }).click();

  await expect(page.locator(".progression-block")).toHaveCount(0);
  await undoButton.click();

  await expect(page.locator(".progression-block")).toHaveCount(3);
  await expect.poll(() => page.locator("#progression").inputValue()).toBe("C | F | G");
  await expect(redoButton).toBeEnabled();

  await redoButton.click();
  await expect(page.locator(".progression-block")).toHaveCount(0);
  await expect.poll(() => page.locator("#progression").inputValue()).toBe("");
});

test("plays distinct notes across the top keyboard octave", async ({ page }) => {
  await gotoApp(page);

  await page.locator('#sequenceKeyboard [data-midi="84"]').click();
  await expect.poll(() => page.evaluate(() => window.__toneTestState?.lastTriggeredNotes ?? [])).toEqual(["C6"]);

  await page.locator('#sequenceKeyboard [data-midi="85"]').click();
  await expect.poll(() => page.evaluate(() => window.__toneTestState?.lastTriggeredNotes ?? [])).toEqual(["C#6"]);

  await page.locator('#sequenceKeyboard [data-midi="95"]').click();
  await expect.poll(() => page.evaluate(() => window.__toneTestState?.lastTriggeredNotes ?? [])).toEqual(["B6"]);
});
