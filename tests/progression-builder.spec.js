import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { gotoApp, openTool, setProgressionText } from "./helpers/appTestUtils.js";

async function loadStructuredProgression(page, progression, filename = "structured-progression.json") {
  await page.locator("#loadProgressionInput").setInputFiles({
    name: filename,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(progression), "utf8")
  });
}

async function getPlaybackSnapshot(page) {
  return page.evaluate(() => {
    const items = Array.isArray(window.appState?.progressionItems) ? window.appState.progressionItems : [];
    const activeItem = items.find(item => item.id === window.appState?.playingProgressionItemId) || null;

    return {
      isPlaying: Boolean(window.appState?.isPlayingProgression),
      playingChord: activeItem?.chord || null,
      triggerAttackReleaseCount: window.__toneTestState?.triggerAttackReleaseCount ?? 0,
      releaseAllCount: window.__toneTestState?.releaseAllCount ?? 0
    };
  });
}

test("lets you build, auto-recognise, add, and clear a chord from the sequence keyboard", async ({ page }) => {
  await gotoApp(page);

  const keyboard = page.locator("#sequenceKeyboard");
  const playButton = keyboard.getByRole("button", { name: "Play" });
  const saveButton = keyboard.getByRole("button", { name: "Add" });
  const clearButton = keyboard.getByRole("button", { name: "Clear" });

  await expect(keyboard.locator(".sequence-keyboard-chord-name")).toHaveText("No notes selected");
  await expect(playButton).toBeDisabled();
  await expect(saveButton).toBeDisabled();
  await expect(clearButton).toBeDisabled();

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
  await expect(page.locator(".progression-block-selected")).toHaveCount(1);
  await expect(page.locator("#progressionEditor .progression-editor-modal")).toHaveCount(0);

  await clearButton.click();
  await expect(keyboard.locator(".sequence-keyboard-chord-name")).toHaveText("No notes selected");
  await expect(playButton).toBeDisabled();
  await expect(saveButton).toBeDisabled();
  await expect(clearButton).toBeDisabled();
});

test("preserves manually entered keyboard notes without adding an extra bass note on save", async ({ page }) => {
  await gotoApp(page);

  const keyboard = page.locator("#sequenceKeyboard");
  await keyboard.locator('[data-midi="60"]').click();
  await keyboard.locator('[data-midi="64"]').click();
  await keyboard.locator('[data-midi="67"]').click();

  await expect(keyboard.locator(".sequence-keyboard-chord-name")).toHaveText("C");
  await keyboard.getByRole("button", { name: "Add" }).click();

  await expect.poll(() =>
    page.evaluate(() =>
      window.appState?.progressionItems?.[0]?.voicing?.notes?.map(note => note.midi) ?? []
    )
  ).toEqual([60, 64, 67]);

  await page.locator(".progression-block").first().dispatchEvent("dblclick");
  await expect(page.locator("#progressionEditor .progression-editor-modal")).toBeVisible();
  await expect(
    page.locator("#progressionEditor .progression-editor-voicing-note")
  ).toHaveText(["C4", "E4", "G4"]);
});

test("uses only the bass row for slash-bass recognition on the keyboard", async ({ page }) => {
  await gotoApp(page);

  const keyboard = page.locator("#sequenceKeyboard");
  await keyboard.locator('[data-midi="45"]').click();
  await keyboard.locator('[data-midi="64"]').click();
  await keyboard.locator('[data-midi="69"]').click();
  await keyboard.locator('[data-midi="72"]').click();

  await expect(keyboard.locator(".sequence-keyboard-chord-name")).toHaveText("Am");
  await keyboard.getByRole("button", { name: "Add" }).click();
  await expect(page.locator(".progression-block").first()).toHaveAttribute("data-progression-chord", "Am");
});

test("renders text progressions as selectable visual blocks and updates the editor", async ({ page }) => {
  await gotoApp(page);

  await expect(page.locator(".progression-blocks-empty")).toBeVisible();

  await setProgressionText(page, "C | F | G/Bb");

  const blocks = page.locator(".progression-block");
  await expect(blocks).toHaveCount(3);
  await expect(page.locator(".progression-block-selected")).toHaveCount(1);
  await expect(blocks.nth(2)).toHaveAttribute("data-progression-chord", "G/Bb");
  await expect(blocks.nth(0)).not.toContainText("Bar 1");
  await expect(blocks.nth(0)).toHaveAttribute("data-tooltip", /Chord: C/);
  await expect(blocks.nth(0)).toHaveAttribute("data-tooltip", /Length: 4 beats/);
  await expect(blocks.nth(0)).toHaveAttribute("data-tooltip", /Sustain: Off/);

  await blocks.nth(1).click();
  await expect(page.locator(".progression-block-selected")).toHaveCount(1);
  await expect(blocks.nth(1)).toHaveClass(/progression-block-selected/);
  await expect(blocks.nth(0)).not.toHaveClass(/progression-block-selected/);

  await blocks.nth(2).click();
  await expect(page.locator(".progression-block-selected")).toHaveCount(1);

  await blocks.nth(2).dispatchEvent("dblclick");
  await expect(page.locator("#progressionEditor .progression-editor-modal")).toBeVisible();
  await expect(page.locator("#progressionEditor")).toContainText("Selected item 3 of 3");
  await expect(page.locator("#progressionEditor")).toContainText("Beats");
});

test("renders the progression as compact wrapped chord blocks with beat-based widths", async ({ page }) => {
  await gotoApp(page);
  await page.setViewportSize({ width: 820, height: 900 });

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
  await expect(page.locator("#progressionEditor .progression-editor-modal")).toHaveCount(0);

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

  const stripMetrics = await page.evaluate(() => {
    const strip = document.getElementById("progressionBlocks");
    const textArea = document.getElementById("progression");
    const stripRect = strip?.getBoundingClientRect();

    return {
      stripHeight: Math.round(stripRect?.height || 0),
      textAreaHeight: Math.round(textArea?.getBoundingClientRect().height || 0)
    };
  });

  expect(stripMetrics.stripHeight).toBeGreaterThan(90);
  expect(stripMetrics.textAreaHeight).toBeLessThan(90);

  await blocks.nth(2).click();
  await expect(page.locator(".progression-block-selected")).toHaveCount(1);
  await blocks.nth(2).dispatchEvent("dblclick");
  await expect(page.locator("#progressionEditor .progression-editor-modal")).toBeVisible();
  await expect(page.locator("#progressionEditor")).toContainText("Selected item 3 of 10");
  await expect(page.locator("#progressionEditor")).toContainText("4");
});

test("splits a selected progression chord into two shorter beat blocks", async ({ page }) => {
  await gotoApp(page);

  const splitButton = page.locator("#sequenceKeyboard").getByRole("button", { name: "Split" });
  await expect(splitButton).toBeDisabled();

  const savedProgression = {
    type: "vibe-chording-progression",
    version: 4,
    sequence: {
      tempoBpm: 120,
      timeSignature: "4/4"
    },
    items: [
      { position: 1, chord: "C", durationBeats: 5, sustain: false, voicing: null }
    ]
  };

  await page.locator("#loadProgressionInput").setInputFiles({
    name: "split-progression.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(savedProgression), "utf8")
  });

  const blocks = page.locator(".progression-block");
  await expect(blocks).toHaveCount(1);
  await expect(blocks.first()).toHaveAttribute("data-duration", "5");
  await expect(splitButton).toBeEnabled();

  await splitButton.click();

  await expect(blocks).toHaveCount(2);
  await expect(blocks.nth(0)).toHaveAttribute("data-progression-chord", "C");
  await expect(blocks.nth(0)).toHaveAttribute("data-duration", "3");
  await expect(blocks.nth(1)).toHaveAttribute("data-progression-chord", "C");
  await expect(blocks.nth(1)).toHaveAttribute("data-duration", "2");
  await expect(blocks.nth(1)).toHaveClass(/progression-block-selected/);
  await expect(page.locator("#progression")).toHaveValue("C | C");

  await blocks.nth(1).click();
  await splitButton.click();

  await expect(page.locator(".progression-block")).toHaveCount(3);
  await expect(page.locator(".progression-block").nth(1)).toHaveAttribute("data-duration", "1");
  await expect(page.locator(".progression-block").nth(2)).toHaveAttribute("data-duration", "1");
  await expect(splitButton).toBeDisabled();
});

test("places bar markers using cumulative beat position across the full sequence", async ({ page }) => {
  await gotoApp(page);

  const savedProgression = {
    type: "vibe-chording-progression",
    version: 4,
    sequence: {
      tempoBpm: 120,
      timeSignature: "4/4"
    },
    items: [
      { position: 1, chord: "C#", durationBeats: 1, sustain: false, voicing: null },
      { position: 2, chord: "C", durationBeats: 7, sustain: false, voicing: null }
    ]
  };

  await page.locator("#loadProgressionInput").setInputFiles({
    name: "cumulative-marker-progression.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(savedProgression), "utf8")
  });

  const secondBlock = page.locator(".progression-block").nth(1);
  const markers = secondBlock.locator(".progression-block-marker");
  const firstBlock = page.locator(".progression-block").nth(0);
  const firstBarLabel = firstBlock.locator(".progression-block-bar-start-label");
  const secondBarLabel = markers.nth(2).locator(".progression-block-marker-bar-label");
  const tooltip = page.locator(".app-tooltip");

  await expect(page.locator(".progression-block")).toHaveCount(2);
  await expect(firstBarLabel).toHaveText("1");
  await expect(markers).toHaveCount(6);
  await expect(markers.nth(2)).toHaveClass(/progression-block-marker-bar/);
  await expect(secondBarLabel).toHaveText("2");
  await expect(markers.nth(3)).not.toHaveClass(/progression-block-marker-bar/);

  await firstBarLabel.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText("Bar 1");

  await secondBarLabel.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText("Bar 2");
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
  await expect(keyboard.locator('[data-midi="60"]')).toHaveClass(/sequence-key-active/);
  await expect(keyboard.locator('[data-midi="64"]')).toHaveClass(/sequence-key-active/);
  await expect(keyboard.locator('[data-midi="67"]')).toHaveClass(/sequence-key-active/);
  await expect(keyboard.locator('[data-midi="48"]')).not.toHaveClass(/sequence-key-active/);
});

test("plays the progression from the structured chord blocks", async ({ page }) => {
  await gotoApp(page);

  await setProgressionText(page, "C");
  await page.getByRole("button", { name: "Play sequence" }).click();

  await expect(page.locator(".progression-block")).toHaveCount(1);
  await expect(page.locator("#sequenceKeyboard .sequence-keyboard-chord-name")).toHaveText("C");
});

test("steps through each chord block while progression playback is running", async ({ page }) => {
  await gotoApp(page);

  await loadStructuredProgression(page, {
    type: "vibe-chording-progression",
    version: 4,
    sequence: {
      tempoBpm: 240,
      timeSignature: "4/4"
    },
    items: [
      { position: 1, chord: "C", durationBeats: 1, sustain: false, voicing: null },
      { position: 2, chord: "F", durationBeats: 1, sustain: false, voicing: null },
      { position: 3, chord: "G", durationBeats: 1, sustain: false, voicing: null }
    ]
  }, "playback-steps.json");

  const playButton = page.locator("#playProgressionBtn");

  await playButton.click();

  await expect(playButton).toHaveAttribute("aria-label", "Stop playback");
  await expect.poll(() => getPlaybackSnapshot(page)).toMatchObject({ isPlaying: true, playingChord: "C" });
  await expect.poll(() => getPlaybackSnapshot(page), { timeout: 5000 }).toMatchObject({ isPlaying: true, playingChord: "F" });
  await expect.poll(() => getPlaybackSnapshot(page), { timeout: 5000 }).toMatchObject({ isPlaying: true, playingChord: "G" });
  await expect.poll(() => getPlaybackSnapshot(page), { timeout: 5000 }).toMatchObject({
    isPlaying: false,
    playingChord: null,
    triggerAttackReleaseCount: 3
  });
  await expect(playButton).toHaveAttribute("aria-label", "Play sequence");
});

test("stops progression playback on a second click before the rest of the sequence runs", async ({ page }) => {
  await gotoApp(page);

  await loadStructuredProgression(page, {
    type: "vibe-chording-progression",
    version: 4,
    sequence: {
      tempoBpm: 240,
      timeSignature: "4/4"
    },
    items: [
      { position: 1, chord: "C", durationBeats: 4, sustain: false, voicing: null },
      { position: 2, chord: "F", durationBeats: 4, sustain: false, voicing: null },
      { position: 3, chord: "G", durationBeats: 4, sustain: false, voicing: null }
    ]
  }, "playback-stop.json");

  const playButton = page.locator("#playProgressionBtn");

  await playButton.click();
  await expect.poll(() => getPlaybackSnapshot(page)).toMatchObject({ isPlaying: true, playingChord: "C" });

  await playButton.click();

  await expect.poll(
    async () => {
      const snapshot = await getPlaybackSnapshot(page);
      return {
        isPlaying: snapshot.isPlaying,
        playingChord: snapshot.playingChord,
        hasReleasedPlayback: snapshot.releaseAllCount >= 1
      };
    },
    { timeout: 5000 }
  ).toMatchObject({
    isPlaying: false,
    playingChord: null,
    hasReleasedPlayback: true
  });

  await page.waitForTimeout(1200);

  const playbackSnapshot = await getPlaybackSnapshot(page);
  expect(playbackSnapshot.triggerAttackReleaseCount).toBe(1);
  expect(playbackSnapshot.releaseAllCount).toBeGreaterThanOrEqual(1);
  await expect(playButton).toHaveAttribute("aria-label", "Play sequence");
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

  await setProgressionText(page, "C | F | G");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save progression" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("c-ionian-progression.json");

  const downloadPath = await download.path();
  const raw = await readFile(downloadPath, "utf8");
  const savedProgression = JSON.parse(raw);

  expect(savedProgression.type).toBe("vibe-chording-progression");
  expect(savedProgression.version).toBe(4);
  expect(savedProgression.savedAt).toEqual(expect.any(String));
  expect(savedProgression.key).toMatchObject({
    name: "C Ionian",
    root: "C",
    mode: "Ionian"
  });
  expect(savedProgression.sequence).toEqual({
    tempoBpm: 120,
    timeSignature: "4/4"
  });
  expect(savedProgression.items).toEqual([
    expect.objectContaining({ position: 1, chord: "C", durationBeats: 4, sustain: false, voicing: null }),
    expect.objectContaining({ position: 2, chord: "F", durationBeats: 4, sustain: false, voicing: null }),
    expect.objectContaining({ position: 3, chord: "G", durationBeats: 4, sustain: false, voicing: null })
  ]);

  await setProgressionText(page, "");
  await page.locator("#loadProgressionInput").setInputFiles({
    name: "saved-progression.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(savedProgression), "utf8")
  });

  await expect(page.locator("#progression")).toHaveValue("C | F | G");
  await expect(page.locator(".progression-block")).toHaveCount(3);
  await expect(page.locator(".progression-block").nth(2)).toHaveAttribute("data-progression-chord", "G");
});
