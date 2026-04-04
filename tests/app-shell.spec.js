import { expect, test } from "@playwright/test";
import { gotoApp, openTool } from "./helpers/appTestUtils.js";

test("loads the main app shell with builder and tool navigation", async ({ page }) => {
  await gotoApp(page);

  await expect(page).toHaveTitle("Vibe Chording");
  await expect(page.locator(".sequence-panel-title")).toHaveText("Progression Builder");
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
