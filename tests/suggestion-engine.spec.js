import { expect, test } from "@playwright/test";
import { gotoApp, selectMode, selectRoot, setProgressionText } from "./helpers/appTestUtils.js";

function normalizeSuggestionLabel(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/â™­|Ã¢â„¢Â­|♭/g, "b")
    .replace(/â™¯|Ã¢â„¢Â¯|♯/g, "#");
}

test("renders mood-aware suggestions and progression debug as soon as the suggestion engine opens", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "C, F, G");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();

  await expect.poll(() => page.locator("#results .suggestion-card").count()).toBeGreaterThan(9);
  await expect(page.locator("#results .suggestion-feedback-item")).toHaveCount(0);
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Progression: C | F | G");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Key and mode: C Ionian");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Feeling:");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Last chord: G");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Harmonic read:");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Direction:");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Preferred targets:");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Established palette:");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Overall ranking:");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Shown suggestions:");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("In Key:");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Related:");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Out of Key:");
  await expect(page.locator('[data-suggestion-section="best"] .suggestion-group-title')).toHaveText("Best Next Moves");

  const chordLabels = (await page.locator("#results .suggestion-card-chord .chord-btn-main").allTextContents())
    .map(normalizeSuggestionLabel);
  expect(chordLabels).not.toContain("[object Object]");
  expect(chordLabels).toEqual(expect.arrayContaining(["Am", "C", "F", "Fm", "Bb", "Eb", "E7", "A7"]));
  const buttonLabels = (await page.locator("#results .suggestion-card-chord .chord-btn-detail").allTextContents())
    .map(normalizeSuggestionLabel);
  expect(buttonLabels).toEqual(expect.arrayContaining(["Keep it moving", "Add colour", "Rebuild tension"]));
});

test("shows an empty-state message instead of suggestions when the progression is empty", async ({ page }) => {
  await gotoApp(page);

  await page.getByRole("button", { name: /Suggestion Engine/ }).click();

  await expect(page.locator("#results .suggestion-card")).toHaveCount(0);
  await expect(page.locator("#results .suggestions-empty")).toHaveText(
    "Add a chord to the sequence to get next-step suggestions."
  );
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Progression: (empty)");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Key and mode: C Ionian");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Last chord: (none)");
});

test("refresh button reruns suggestions and updates the progression debug", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "C, F, G");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();
  await expect(page.locator("#results .suggestion-feedback-item")).toHaveCount(0);

  await setProgressionText(page, "C, F, G, Am");
  await page.locator("#suggestBtn").click();

  await expect(page.locator("#results .suggestion-feedback-item")).toHaveCount(0);
  await expect.poll(() => page.locator("#results .suggestion-card").count()).toBeGreaterThan(9);
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Progression: C | F | G | Am");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Last chord: Am");
});

test("shows the shared inversion and voicing bar for suggestion playback", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "C, F, G");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();

  const selectionBar = page.locator("#results .key-mode-selection-bar");
  await expect(selectionBar).toBeVisible();
  await expect(selectionBar.locator(".key-mode-selection-current-name")).toHaveCount(0);
  await expect(selectionBar.locator(".key-mode-selection-current-placeholder")).toHaveText(
    "Play a chord to choose inversion and voicing"
  );
  await expect(selectionBar.locator(".key-mode-chord-inversion-select")).toBeDisabled();
  await expect(selectionBar.locator(".key-mode-chord-voicing-select")).toBeDisabled();

  await page.locator("#results .suggestion-card-chord").first().click();

  await expect(selectionBar.locator(".key-mode-selection-current-name")).not.toHaveCount(0);
  await expect(selectionBar.locator(".key-mode-chord-inversion-select")).toBeEnabled();
  await expect(selectionBar.locator(".key-mode-chord-voicing-select")).toBeEnabled();
});

test("shows the suggestion explanation panel when you click a suggestion", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "C, F, G");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();

  await page.locator("#results .suggestion-card-chord").first().click();

  const detail = page.locator("#results .suggestion-detail");
  await expect(detail).toBeVisible();
  await expect(detail.locator(".suggestion-detail-reason")).not.toHaveText("");
  await expect(detail.locator(".suggestion-detail-play-btn")).toBeVisible();
  await expect(detail.locator(".suggestion-detail-add-btn")).toBeVisible();
});

test("shows progression-state debug details for a repeated ending", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "C, G, G");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();

  await expect(page.locator("#suggestionDebugOutput")).toContainText("Progression: C | G | G");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Pattern cue: repeated ending");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Why:");
});

test("keeps best next moves grounded for a simple single-chord progression", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "F");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();

  const debug = page.locator("#suggestionDebugOutput");
  await expect(debug).toContainText("Progression: F");
  await expect(debug).toContainText("Key and mode: C Ionian");
  await expect(debug).toContainText("Harmonic read: mostly mode-led (mode confidence: high)");

  const bestChords = (await page.locator('[data-suggestion-section="best"] .suggestion-card-chord .chord-btn-main').allTextContents())
    .map(normalizeSuggestionLabel);
  expect(bestChords).toEqual(expect.arrayContaining(["Am", "Dm", "G"]));
  expect(bestChords).not.toContain("E7");
  expect(bestChords).not.toContain("A7");
  expect(bestChords).not.toContain("B7");
});

test("lets you hide and show the suggestion debug panel", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "C, F, G");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();

  const toggle = page.getByRole("button", { name: "Hide Debug" });
  const panel = page.locator("#suggestionDebugPanel");

  await expect(panel).toBeVisible();
  await toggle.click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole("button", { name: "Show Debug" })).toBeVisible();

  await page.getByRole("button", { name: "Show Debug" }).click();
  await expect(panel).toBeVisible();
});

test("copies the current suggestion debug as an AI brief", async ({ page }) => {
  await page.addInitScript(() => {
    window.__copiedSuggestionDebug = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async text => {
          window.__copiedSuggestionDebug = String(text || "");
        }
      }
    });
  });

  await gotoApp(page);

  await setProgressionText(page, "C, F, G");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();

  const copyButton = page.getByRole("button", { name: "Copy AI Brief" });
  await expect(copyButton).toBeEnabled();
  await copyButton.click();

  await expect.poll(() => page.evaluate(() => window.__copiedSuggestionDebug)).toContain("Progression: C | F | G");
  await expect.poll(() => page.evaluate(() => window.__copiedSuggestionDebug)).toContain("Overall ranking:");
});

test("uses slash-bass context to promote bass-led continuation suggestions", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "Am/E");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();

  await expect(page.locator("#suggestionDebugOutput")).toContainText("Progression: Am/E");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Slash bass: E -> Em");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("In Key:");
  await expect(page.locator("#suggestionDebugOutput")).toContainText("Em [");

  const allChords = (await page.locator("#results .suggestion-card-chord .chord-btn-main").allTextContents())
    .map(normalizeSuggestionLabel);
  expect(allChords).toEqual(expect.arrayContaining(["Em"]));
});

test("includes saved top-note voicing context in the suggestion debug", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "Dm7 | G");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();

  await page.evaluate(() => {
    const items = window.appState?.progressionItems || [];
    if (items.length < 2) {
      throw new Error("Expected progression items to exist");
    }

    items[0].voicing = {
      notes: [
        { midi: 62, velocity: 84 },
        { midi: 65, velocity: 84 },
        { midi: 69, velocity: 84 },
        { midi: 72, velocity: 84 }
      ]
    };
    items[1].voicing = {
      notes: [
        { midi: 55, velocity: 84 },
        { midi: 59, velocity: 84 },
        { midi: 62, velocity: 84 },
        { midi: 71, velocity: 84 }
      ]
    };
  });

  await page.locator("#suggestBtn").click();

  const debug = page.locator("#suggestionDebugOutput");
  await expect(debug).toContainText("Progression + top notes: Dm7[C5] | G[B4]");
  await expect(debug).toContainText("Top line: C5 -> B4 (falling by step)");
  await expect(debug).toContainText("Top-note influence:");
});

test("reads mixed minor cadence progressions using established harmonic language", async ({ page }) => {
  await gotoApp(page);

  await selectRoot(page, "D");
  await selectMode(page, "dorian");
  await setProgressionText(page, "Dm7 | G | C | F | Em7b5 | A7/C# | Dm | Bb | C | Dm/A | G | A7 | Dm7");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();
  await page.selectOption("#feeling", "Sad");
  await page.locator("#suggestBtn").click();

  const debug = page.locator("#suggestionDebugOutput");
  await expect(debug).toContainText("Key and mode: D Dorian");
  await expect(debug).toContainText("Harmonic read:");
  await expect(debug).toContainText("Cadence read:");
  await expect(debug).toContainText("Established palette:");
  await expect(debug).toContainText("Tension candidates:");
  await expect(debug).toContainText("Overall ranking:");

  const chordLabels = (await page.locator("#results .suggestion-card-chord .chord-btn-main").allTextContents())
    .map(normalizeSuggestionLabel);
  expect(chordLabels).toEqual(expect.arrayContaining(["G", "C", "Bb", "Gm"]));
  expect(chordLabels.some(label => label === "Dm7" || label === "Dm/A")).toBe(true);
  expect(chordLabels.some(label => label === "Dm/A" || label === "A7/C#")).toBe(true);
  expect(chordLabels.length).toBeGreaterThan(8);
  expect(chordLabels).not.toContain("B7");
  expect(chordLabels).not.toContain("Bdim");
  const sectionTitles = (await page.locator("#results .suggestion-group-title").allTextContents())
    .map(normalizeSuggestionLabel);
  expect(sectionTitles).toEqual(expect.arrayContaining(["Best Next Moves", "Other Good Paths"]));
  await expect(debug).toContainText("exact cadence rebuild");
  await expect(debug).toContainText("Dm7 [i]");
});

test("avoids wasted repeats and duplicate tonic-family suggestions after an open continuation", async ({ page }) => {
  await gotoApp(page);

  await selectRoot(page, "D");
  await selectMode(page, "dorian");
  await setProgressionText(page, "Dm7 | G | C | F | Em7b5 | A7/C# | Dm | Bb | C | Dm/A | G | A7 | Dm7 | Em7b5 | A7/C# | Dm | G");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();
  await page.selectOption("#feeling", "Sad");
  await page.locator("#suggestBtn").click();

  const chordLabels = (await page.locator("#results .suggestion-card-chord .chord-btn-main").allTextContents())
    .map(normalizeSuggestionLabel);

  expect(chordLabels).not.toContain("G");
  expect(chordLabels.includes("Dm7") && chordLabels.includes("Dm")).toBe(false);
  expect(chordLabels).toEqual(expect.arrayContaining(["Em7(b5)", "A7/C#", "Bb"]));
  expect(chordLabels.some(label => label === "Dm7" || label === "Dm/A")).toBe(true);
});

test("promotes a real resolution option when a borrowed turnaround wants to return to center", async ({ page }) => {
  await gotoApp(page);

  await selectRoot(page, "D");
  await selectMode(page, "dorian");
  await setProgressionText(page, "Dm7 | G | C | F | Em7b5 | A7/C# | Dm | Bb | C | Dm/A | G | A7 | Dm7 | Em7b5 | A7/C# | Dm | Abdim | Am | Am/C | Bb | Bb/F | E | Eadd9/B");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();
  await page.selectOption("#feeling", "Happy");
  await page.locator("#suggestBtn").click();

  const debug = page.locator("#suggestionDebugOutput");
  await expect(debug).toContainText("Direction: borrowed -> return to center");
  await expect(debug).toContainText("Preferred targets: Dm, Am, G");

  const bestChords = (await page.locator('[data-suggestion-section="best"] .suggestion-card-chord .chord-btn-main').allTextContents())
    .map(normalizeSuggestionLabel);
  const bestIntentLabels = (await page.locator('[data-suggestion-section="best"] .suggestion-card-chord .chord-btn-detail').allTextContents())
    .map(normalizeSuggestionLabel);

  expect(bestChords.some(label => label === "Dm" || label === "Dm7" || label === "Dm/A")).toBe(true);
  expect(bestIntentLabels).toContain("Return to key centre");
  expect(bestIntentLabels).toContain("Shift to new centre");
});

test("prefers a root-position resolution over an inversion colour in return-to-center suggestions", async ({ page }) => {
  await gotoApp(page);

  await selectRoot(page, "D");
  await selectMode(page, "dorian");
  await setProgressionText(page, "Dm7 | G | C | F | Em7b5 | A7/C# | Dm | Bb | C | Dm/A | G | A7 | Dm7 | Em7b5 | A7/C# | Dm | G#dim/B | Am | Am/C | Bb | Bb/F | E/B | E");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();
  await page.selectOption("#feeling", "Sad");
  await page.locator("#suggestBtn").click();

  const chordLabels = (await page.locator("#results .suggestion-card-chord .chord-btn-main").allTextContents())
    .map(normalizeSuggestionLabel);

  expect(chordLabels).toContain("Am");
  expect(chordLabels).not.toContain("Am/C");
});
