import { expect, test } from "@playwright/test";
import { getChordButtonStates, gotoApp, openTool, selectMode } from "./helpers/appTestUtils.js";

function getState(states, label) {
  return states.find(state => state.label === label);
}

test("classifies chord explorer buttons against the selected key", async ({ page }) => {
  await gotoApp(page);
  await openTool(page, "Chord Explorer");

  const coreStates = await getChordButtonStates(page, "core");
  const seventhStates = await getChordButtonStates(page, "sevenths");
  const extendedStates = await getChordButtonStates(page, "extended");

  await expect(getState(coreStates, "C")?.matchLevel).toBe("primary");
  await expect(getState(coreStates, "Cm")?.matchLevel).toBe("none");
  await expect(getState(coreStates, "C5")?.matchLevel).toBe("related");
  await expect(getState(seventhStates, "Cmaj7")?.matchLevel).toBe("related");
  await expect(getState(seventhStates, "Cm7")?.matchLevel).toBe("none");
  await expect(getState(extendedStates, "C9")?.matchLevel).toBe("related");
});

test("updates chord explorer match states when the mode changes", async ({ page }) => {
  await gotoApp(page);
  await openTool(page, "Chord Explorer");

  await selectMode(page, "dorian");

  await expect.poll(async () => {
    const states = await getChordButtonStates(page, "core");
    return {
      c: getState(states, "C")?.matchLevel,
      cm: getState(states, "Cm")?.matchLevel
    };
  }).toEqual({
    c: "none",
    cm: "primary"
  });
});

test("keeps the selected key context visible in the chord explorer header", async ({ page }) => {
  await gotoApp(page);
  await openTool(page, "Chord Explorer");
  await selectMode(page, "lydian");

  const headerContext = page.locator("#chordExplorerPanel .tool-context-inline");
  await expect(headerContext.locator("[data-tool-context-root]")).toHaveText("C");
  await expect(headerContext.locator("[data-tool-context-mode]")).toHaveText("Lydian");
});

test("shows the shared inversion and voicing bar for the chord explorer", async ({ page }) => {
  await gotoApp(page);
  await openTool(page, "Chord Explorer");

  const selectionBar = page.locator("#chordButtons .key-mode-selection-bar");
  await expect(selectionBar).toBeVisible();
  await expect(selectionBar.locator(".key-mode-selection-current-name")).toHaveCount(0);
  await expect(selectionBar.locator(".key-mode-selection-current-placeholder")).toHaveText(
    "Play a chord to choose inversion and voicing"
  );
  await expect(selectionBar.locator(".key-mode-chord-inversion-select")).toBeDisabled();
  await expect(selectionBar.locator(".key-mode-chord-voicing-select")).toBeDisabled();

  await page.locator("#chordButtons .chord-group-core .chord-btn").first().click();

  await expect(selectionBar.locator(".key-mode-selection-current-name")).toHaveText("C");
  await expect(selectionBar.locator(".key-mode-chord-inversion-select")).toBeEnabled();
  await expect(selectionBar.locator(".key-mode-chord-voicing-select")).toBeEnabled();
});
