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
});
