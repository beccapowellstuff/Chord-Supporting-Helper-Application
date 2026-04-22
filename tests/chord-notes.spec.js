import { expect, test } from "@playwright/test";

async function initChordNotesTestApi(page) {
  await page.goto("/");
  await page.evaluate(async () => {
    if (window.__chordNotesTestApi) {
      return;
    }

    const chordNotes = await import("/js/chordNotes.js");

    window.__chordNotesTestApi = {
      parseChordName: chordName => chordNotes.parseChordName(chordName),
      getChordNotes: chordName => chordNotes.getChordNotes(chordName),
      noteToMidi: (note, octave) => chordNotes.noteToMidi(note, octave),
      midiToFrequency: midi => chordNotes.midiToFrequency(midi),
      normaliseRoot: root => chordNotes.normaliseRoot(root),
      transpose: (root, semitones) => chordNotes.transpose(root, semitones),
    };
  });
}

test.beforeEach(async ({ page }) => {
  await initChordNotesTestApi(page);
});

// ── dim7 chord parsing tests ──────────────────────────────────────────────

test("parses C#dim7 with correct intervals and bass note", async ({ page }) => {
  const result = await page.evaluate(() => window.__chordNotesTestApi.parseChordName("C#dim7"));

  expect(result).not.toBeNull();
  expect(result.root).toBe("C#");
  expect(result.suffix).toBe("dim7");
  expect(result.intervals).toEqual([0, 3, 6, 9]);
  expect(result.bass).toBeNull();
});

test("parses Cdim7 with bass note", async ({ page }) => {
  const result = await page.evaluate(() => window.__chordNotesTestApi.parseChordName("Cdim7/Eb"));

  expect(result).not.toBeNull();
  expect(result.root).toBe("C");
  expect(result.suffix).toBe("dim7");
  expect(result.bass).toBe("Eb");
});

test("recognises dim7 alias 'o'", async ({ page }) => {
  const result = await page.evaluate(() => window.__chordNotesTestApi.parseChordName("Co"));

  expect(result).not.toBeNull();
  expect(result.root).toBe("C");
  expect(result.suffix).toBe("dim7");
});

test("recognises dim7 alias 'ø7'", async ({ page }) => {
  const result = await page.evaluate(() => window.__chordNotesTestApi.parseChordName("Cø7"));

  expect(result).not.toBeNull();
  expect(result.root).toBe("C");
  expect(result.suffix).toBe("dim7");
});

test("returns four chord notes for dim7", async ({ page }) => {
  const result = await page.evaluate(() => window.__chordNotesTestApi.getChordNotes("Cdim7"));

  // getChordNotes uses CHROMATIC array which has C# style names
  expect(result).toEqual(["C", "D#", "F#", "A"]);
});

// ── dim triad vs dim7 distinction tests ───────────────────────────────────

test("parses Cdim as a triad with three intervals", async ({ page }) => {
  const result = await page.evaluate(() => window.__chordNotesTestApi.parseChordName("Cdim"));

  expect(result).not.toBeNull();
  expect(result.root).toBe("C");
  expect(result.suffix).toBe("dim");
  expect(result.intervals).toEqual([0, 3, 6]);
});

test("returns three chord notes for dim triad", async ({ page }) => {
  const result = await page.evaluate(() => window.__chordNotesTestApi.getChordNotes("Cdim"));

  // getChordNotes uses CHROMATIC array which has C# style names
  expect(result).toEqual(["C", "D#", "F#"]);
});

// ── noteToMidi tests ─────────────────────────────────────────────────────

test("converts C4 to MIDI 60", async ({ page }) => {
  const midi = await page.evaluate(() => window.__chordNotesTestApi.noteToMidi("C", 4));
  expect(midi).toBe(60);
});

test("converts C#2 to MIDI 37", async ({ page }) => {
  const midi = await page.evaluate(() => window.__chordNotesTestApi.noteToMidi("C#", 2));
  expect(midi).toBe(37);
});

test("returns null for invalid note name", async ({ page }) => {
  const midi = await page.evaluate(() => window.__chordNotesTestApi.noteToMidi("X", 4));
  expect(midi).toBeNull();
});

// ── transpose tests ──────────────────────────────────────────────────────

test("transposes C up by 7 semitones to G", async ({ page }) => {
  const result = await page.evaluate(() => window.__chordNotesTestApi.transpose("C", 7));
  expect(result).toBe("G");
});

test("transposes Db down by 1 semitone to C", async ({ page }) => {
  const result = await page.evaluate(() => window.__chordNotesTestApi.transpose("Db", -1));
  // Db (index 1) - 1 = index 0 which is C
  expect(result).toBe("C");
});

// ── normaliseRoot tests ──────────────────────────────────────────────────

test("normalises Db to C#", async ({ page }) => {
  const result = await page.evaluate(() => window.__chordNotesTestApi.normaliseRoot("Db"));
  expect(result).toBe("C#");
});

test("leaves C unchanged", async ({ page }) => {
  const result = await page.evaluate(() => window.__chordNotesTestApi.normaliseRoot("C"));
  expect(result).toBe("C");
});