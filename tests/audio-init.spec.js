import { expect, test } from "@playwright/test";
import { gotoApp } from "./helpers/appTestUtils.js";

test("retries synth init after a failed preload and clears the warning after recovery", async ({ page }) => {
  await gotoApp(page, {
    toneStubOptions: {
      samplerOutcomes: ["error", "load"]
    }
  });

  const audioStatus = page.locator("#audioStatus");
  const keyboard = page.locator("#sequenceKeyboard");

  await expect(audioStatus).toBeHidden();

  await page.locator(".sequence-panel-title").click();

  await expect(audioStatus).toBeVisible();
  await expect(audioStatus).toContainText("Try another click to retry.");
  await expect.poll(() => page.evaluate(() => window.__toneTestState?.samplerConstructCount ?? 0)).toBe(1);

  await keyboard.locator('[data-midi="60"]').click();

  await expect(audioStatus).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__toneTestState?.samplerConstructCount ?? 0)).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__toneTestState?.triggerAttackReleaseCount ?? 0)).toBe(1);
});
