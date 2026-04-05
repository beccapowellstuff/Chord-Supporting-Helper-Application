import { expect, test } from "@playwright/test";
import { gotoApp, selectMode, selectRoot } from "./helpers/appTestUtils.js";

test("keeps a 7-chord diatonic key set in shared app state", async ({ page }) => {
  await gotoApp(page);

  await expect.poll(async () => {
    return page.evaluate(() => window.appState.keyChordSet);
  }).toEqual(["C", "Dm", "Em", "F", "G", "Am", "Bdim"]);

  await selectMode(page, "dorian");
  await expect.poll(async () => {
    return page.evaluate(() => window.appState.keyChordSet);
  }).toHaveLength(7);

  await selectRoot(page, "F#");
  await expect.poll(async () => {
    return page.evaluate(() => ({
      selectedKey: window.appState.selectedKey,
      keyChordSet: window.appState.keyChordSet
    }));
  }).toMatchObject({
    selectedKey: "F# Dorian"
  });
});

test("renders the selected key details and exactly seven diatonic chord cards", async ({ page }) => {
  await gotoApp(page);

  await expect(page.locator(".key-summary-name")).toHaveText("C Ionian");
  await expect(page.locator(".key-mode-chord-card")).toHaveCount(7);
  await expect(page.locator(".key-mode-chord-card").first()).toContainText("I");
  await expect(page.locator(".key-mode-chord-card").first()).toContainText("tonic");
  await expect(page.locator(".key-mode-chord-card").first().locator(".key-mode-chord-play")).toContainText("C");
  await expect(page.locator(".key-mode-selection-bar")).toBeVisible();
  await expect(page.locator(".key-mode-selection-current-name")).toHaveCount(0);
  await expect(page.locator(".key-mode-selection-current-placeholder")).toHaveText("Play a chord to choose inversion and voicing");
  await expect(page.locator(".key-mode-chord-card .key-mode-chord-inversion-select")).toHaveCount(0);
  await expect(page.locator(".key-mode-chord-card .key-mode-chord-voicing-select")).toHaveCount(0);
  await expect(page.locator(".key-mode-selection-bar .key-mode-chord-inversion-select")).toBeVisible();
  await expect(page.locator(".key-mode-selection-bar .key-mode-chord-voicing-select")).toBeVisible();
  await expect(page.locator(".key-mode-selection-bar .key-mode-chord-inversion-select")).toBeDisabled();
  await expect(page.locator(".key-mode-selection-bar .key-mode-chord-voicing-select")).toBeDisabled();
});

test("shows the expanded triad voicing presets after a key explorer chord is played", async ({ page }) => {
  await gotoApp(page);

  await page.locator(".key-mode-chord-card").first().locator(".key-mode-chord-play").click();

  await expect(page.locator(".key-mode-selection-bar .key-mode-chord-voicing-select")).toHaveValue("close");
  await expect(page.locator(".key-mode-selection-summary-code")).toHaveCount(0);
  await expect(
    page.locator(".key-mode-selection-bar .key-mode-chord-voicing-select option")
  ).toHaveText(["Close", "Close High", "Open", "Open High", "Spread", "Wide"]);
});

test("lets you audition a selected inversion from the shared key explorer bar", async ({ page }) => {
  await gotoApp(page);

  const expectedVoicing = await page.evaluate(async () => {
    const chordVoicing = await import("/js/chordVoicing.js");
    return chordVoicing.getInversionOptions("C")[1].voicing;
  });

  await page.locator(".key-mode-chord-card").first().locator(".key-mode-chord-play").click();
  await page.locator(".key-mode-selection-bar .key-mode-chord-inversion-select").selectOption("1");

  await expect.poll(() =>
    page.locator("#sequenceKeyboard .sequence-key-active").evaluateAll(keys =>
      keys
        .map(key => Number(key.getAttribute("data-midi")))
        .filter(Number.isFinite)
        .sort((a, b) => a - b)
    )
  ).toEqual([...expectedVoicing].sort((a, b) => a - b));

  await expect(page.locator("#sequenceKeyboard .sequence-keyboard-chord-name")).toHaveText("C (1st)");
  await expect.poll(() => page.evaluate(() => window.__toneTestState?.triggerAttackReleaseCount ?? 0)).toBeGreaterThan(0);
});

test("lets you audition an explicit voicing style from the shared key explorer bar", async ({ page }) => {
  await gotoApp(page);

  const expectedVoicing = await page.evaluate(async () => {
    const chordVoicing = await import("/js/chordVoicing.js");
    return chordVoicing.getInversionOptions("C", "wide")[0].voicing;
  });

  await page.locator(".key-mode-chord-card").first().locator(".key-mode-chord-play").click();
  await page.locator(".key-mode-selection-bar .key-mode-chord-voicing-select").selectOption("wide");

  await expect.poll(() =>
    page.locator("#sequenceKeyboard .sequence-key-active").evaluateAll(keys =>
      keys
        .map(key => Number(key.getAttribute("data-midi")))
        .filter(Number.isFinite)
        .sort((a, b) => a - b)
    )
  ).toEqual([...expectedVoicing].sort((a, b) => a - b));

  await expect(page.locator("#sequenceKeyboard .sequence-keyboard-chord-name")).toHaveText("C (Wide)");
  await expect.poll(() => page.evaluate(() => window.__toneTestState?.triggerAttackReleaseCount ?? 0)).toBeGreaterThan(0);
});

test("updates the shared key explorer bar when a different chord card is played", async ({ page }) => {
  await gotoApp(page);

  await page.locator(".key-mode-chord-card").nth(1).locator(".key-mode-chord-play").click();

  await expect(page.locator(".key-mode-selection-current-name")).toHaveText("Dm");
  await expect(page.locator(".key-mode-selection-bar .key-mode-chord-inversion-select")).toHaveValue("0");
  await expect(page.locator(".key-mode-selection-bar .key-mode-chord-voicing-select")).toHaveValue("close");
  await expect(page.locator("#sequenceKeyboard .sequence-keyboard-chord-name")).toHaveText("Dm");
});

test("shows selected key explorer voicing details on the progression block", async ({ page }) => {
  await gotoApp(page);

  const firstChordCard = page.locator(".key-mode-chord-card").first();
  await firstChordCard.locator(".key-mode-chord-play").click();
  await page.locator(".key-mode-selection-bar .key-mode-chord-inversion-select").selectOption("2");
  await page.locator(".key-mode-selection-bar .key-mode-chord-voicing-select").selectOption("close-high");
  await firstChordCard.locator(".key-mode-chord-add-btn").click();

  const firstBlock = page.locator(".progression-block").first();
  await expect(firstBlock.locator(".progression-block-chord")).toHaveText("C");
  await expect(firstBlock.locator(".progression-block-meta .progression-block-voicing-badge")).toHaveText("2ch");
});
