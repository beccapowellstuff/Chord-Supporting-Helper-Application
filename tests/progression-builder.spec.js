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
  await expect(page.locator(".progression-block")).toHaveCount(1);
  await expect(page.locator(".progression-block").first()).toHaveAttribute("data-progression-chord", "C");
  await expect(page.locator("#progressionEditor")).toContainText("Selected item 1 of 1");

  await clearButton.click();
  await expect(keyboard.locator(".sequence-keyboard-chord-name")).toHaveText("No notes selected");
  await expect(playButton).toBeDisabled();
  await expect(saveButton).toBeDisabled();
});

test("renders text progressions as selectable visual blocks and updates the editor", async ({ page }) => {
  await gotoApp(page);

  await expect(page.locator(".progression-blocks-empty")).toBeVisible();

  await page.locator("#progression").fill("C | F | G/Bb");

  const blocks = page.locator(".progression-block");
  await expect(blocks).toHaveCount(3);
  await expect(page.locator(".progression-block-selected")).toHaveCount(1);
  await expect(blocks.nth(2)).toHaveAttribute("data-progression-chord", "G/Bb");
  await expect(blocks.nth(0)).not.toContainText("Bar 1");

  await blocks.nth(1).click();
  await expect(page.locator(".progression-block-selected")).toHaveCount(1);
  await expect(blocks.nth(1)).toHaveClass(/progression-block-selected/);
  await expect(blocks.nth(0)).not.toHaveClass(/progression-block-selected/);
  await expect(page.locator("#progressionEditor")).toContainText("Selected item 2 of 3");
  await expect(page.locator("#progressionEditor")).toContainText("F");

  await blocks.nth(2).click();
  await expect(page.locator(".progression-block-selected")).toHaveCount(1);
  await expect(page.locator("#progressionEditor")).toContainText("Selected item 3 of 3");
});

test("renders the progression as compact wrapped chord blocks with beat-based widths", async ({ page }) => {
  await gotoApp(page);
  await page.setViewportSize({ width: 1280, height: 900 });

  const savedProgression = {
    type: "chordcanvas-progression",
    version: 2,
    sequence: {
      tempoBpm: 120,
      timeSignature: "4/4"
    },
    items: [
      { position: 1, chord: "C", durationBeats: 1 },
      { position: 2, chord: "Am", durationBeats: 2 },
      { position: 3, chord: "F", durationBeats: 4 },
      { position: 4, chord: "G/Bb", durationBeats: 1 },
      { position: 5, chord: "Dm", durationBeats: 3 },
      { position: 6, chord: "Em", durationBeats: 2 },
      { position: 7, chord: "Bb", durationBeats: 4 },
      { position: 8, chord: "F", durationBeats: 1 },
      { position: 9, chord: "Am", durationBeats: 2 },
      { position: 10, chord: "G", durationBeats: 1 }
    ]
  };

  await page.locator("#loadProgressionInput").setInputFiles({
    name: "duration-progression.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(savedProgression), "utf8")
  });

  const timeline = page.locator("#progressionBlocks");
  const blocks = page.locator(".progression-block");

  await expect(blocks).toHaveCount(10);
  await expect(blocks.nth(2)).toHaveAttribute("data-duration", "4");
  await expect(page.locator("#progressionEditor")).toContainText("Beats");

  const timelineMetrics = await timeline.evaluate(element => {
    const style = window.getComputedStyle(element);
    return {
      overflowX: style.overflowX,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth
    };
  });

  expect(timelineMetrics.overflowX).not.toBe("scroll");

  const trackDisplay = await page.locator(".progression-blocks-track").evaluate(element => window.getComputedStyle(element).flexWrap);
  expect(trackDisplay).toBe("wrap");

  const topOffsets = await blocks.evaluateAll(nodes =>
    nodes.map(node => Math.round(node.getBoundingClientRect().top))
  );
  expect(new Set(topOffsets).size).toBeGreaterThan(1);

  const widths = await blocks.evaluateAll(nodes =>
    nodes.map(node => Math.round(node.getBoundingClientRect().width))
  );
  expect(widths[1]).toBeGreaterThan(widths[0]);
  expect(widths[2]).toBeGreaterThan(widths[1]);
  expect(widths[2]).toBeLessThan(260);

  const heights = await blocks.evaluateAll(nodes =>
    nodes.map(node => Math.round(node.getBoundingClientRect().height))
  );
  expect(Math.max(...heights)).toBeLessThan(74);

  const stripAndEditorMetrics = await page.evaluate(() => {
    const strip = document.getElementById("progressionBlocks");
    const editor = document.getElementById("progressionEditor");
    const textArea = document.getElementById("progression");
    const stripRect = strip?.getBoundingClientRect();
    const editorRect = editor?.getBoundingClientRect();

    return {
      stripHeight: Math.round(stripRect?.height || 0),
      editorTop: Math.round(editorRect?.top || 0),
      stripBottom: Math.round(stripRect?.bottom || 0),
      textAreaHeight: Math.round(textArea?.getBoundingClientRect().height || 0)
    };
  });

  expect(stripAndEditorMetrics.stripHeight).toBeGreaterThan(96);
  expect(stripAndEditorMetrics.editorTop).toBeGreaterThanOrEqual(stripAndEditorMetrics.stripBottom);
  expect(stripAndEditorMetrics.textAreaHeight).toBeLessThan(90);

  await blocks.nth(2).click();
  await expect(page.locator(".progression-block-selected")).toHaveCount(1);
  await expect(page.locator("#progressionEditor")).toContainText("Selected item 3 of 10");
  await expect(page.locator("#progressionEditor")).toContainText("4");
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

test("plays the progression from the structured chord blocks", async ({ page }) => {
  await gotoApp(page);

  await page.locator("#progression").fill("C");
  await page.getByRole("button", { name: "Play sequence" }).click();

  await expect(page.locator(".progression-block")).toHaveCount(1);
  await expect(page.locator("#sequenceKeyboard .sequence-keyboard-chord-name")).toHaveText("C");
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

test("saves and loads a progression file with sequence timing and beat lengths", async ({ page }) => {
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
  expect(savedProgression.version).toBe(2);
  expect(savedProgression.sequence).toEqual({
    tempoBpm: 120,
    timeSignature: "4/4"
  });
  expect(savedProgression.items).toEqual([
    { position: 1, chord: "C", durationBeats: 4 },
    { position: 2, chord: "F", durationBeats: 4 },
    { position: 3, chord: "G", durationBeats: 4 }
  ]);

  await page.locator("#progression").fill("");
  await page.locator("#loadProgressionInput").setInputFiles({
    name: "saved-progression.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(savedProgression), "utf8")
  });

  await expect(page.locator("#progression")).toHaveValue("C | F | G");
  await expect(page.locator(".progression-block")).toHaveCount(3);
  await expect(page.locator(".progression-block").nth(2)).toHaveAttribute("data-progression-chord", "G");
});
