import { expect, test } from "@playwright/test";
import { gotoApp, setProgressionText } from "./helpers/appTestUtils.js";

test("renders mood-aware suggestions as soon as the suggestion engine opens", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "C, F, G");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();

  await expect(page.locator("#results .suggestion-card")).toHaveCount(9);
  await expect(page.locator("#results .suggestion-feedback-text").first()).toHaveText("C (I) -> F (IV) -> G (V)");
  await expect(page.locator('[data-suggestion-bucket="inKey"] .suggestion-bucket-title')).toHaveText("In Key");
  await expect(page.locator('[data-suggestion-bucket="related"] .suggestion-bucket-title')).toHaveText("Related");
  await expect(page.locator('[data-suggestion-bucket="outside"] .suggestion-bucket-title')).toHaveText("Out of Key");

  const chordLabels = await page.locator("#results .suggestion-card-chord").evaluateAll(buttons =>
    buttons.map(button => button.textContent.replace(/\s+/g, " ").trim().replace(/♭|â™­/g, "b").replace(/♯|â™¯/g, "#"))
  );
  expect(chordLabels).not.toContain("[object Object]");
  expect(chordLabels).toEqual(expect.arrayContaining(["Am", "Dm", "Fm", "Bb", "Eb", "E7", "A7"]));

  const inKeyLabels = await page.locator('[data-suggestion-bucket="inKey"] .suggestion-card-fn').evaluateAll(labels =>
    labels.map(label => label.textContent.replace(/\s+/g, " ").trim().replace(/♭|â™­/g, "b").replace(/♯|â™¯/g, "#"))
  );
  expect(inKeyLabels).toEqual(["vi", "ii", "I"]);

  const relatedLabels = await page.locator('[data-suggestion-bucket="related"] .suggestion-card-fn').evaluateAll(labels =>
    labels.map(label => label.textContent.replace(/\s+/g, " ").trim().replace(/♭|â™­/g, "b").replace(/♯|â™¯/g, "#"))
  );
  expect(relatedLabels).toEqual(["iv (parallel minor)", "bVII", "bIII"]);

  const outsideLabels = await page.locator('[data-suggestion-bucket="outside"] .suggestion-card-fn').evaluateAll(labels =>
    labels.map(label => label.textContent.replace(/\s+/g, " ").trim().replace(/♭|â™­/g, "b").replace(/♯|â™¯/g, "#"))
  );
  expect(outsideLabels).toEqual(["V/vi", "V/ii", "V/iii"]);
});

test("refresh button reruns suggestions without needing a mood change", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "C, F, G");
  await page.getByRole("button", { name: /Suggestion Engine/ }).click();
  await expect(page.locator("#results .suggestion-feedback-text").first()).toHaveText("C (I) -> F (IV) -> G (V)");

  await setProgressionText(page, "C, F, G, Am");
  await page.locator("#suggestBtn").click();

  await expect(page.locator("#results .suggestion-feedback-text").first()).toHaveText("C (I) -> F (IV) -> G (V) -> Am (vi)");
  await expect(page.locator("#results .suggestion-card")).toHaveCount(9);
});
