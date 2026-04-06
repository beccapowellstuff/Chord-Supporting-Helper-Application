import { expect, test } from "@playwright/test";

async function initChordTestApi(page) {
  await page.goto("/");
  await page.evaluate(async () => {
    if (window.__chordTestApi) {
      return;
    }

    const chordNotes = await import("/js/chordNotes.js");
    const engine = await import("/js/engine.js");
    const theory = await import("/js/theory.js");
    const modesConfig = await fetch("/data/modes.json").then(response => response.json());
    const musicData = theory.generateAllKeys(modesConfig);

    window.__chordTestApi = {
      normaliseRoot: root => chordNotes.normaliseRoot(root),
      parseChordName: chordName => chordNotes.parseChordName(chordName),
      getChordNotes: chordName => chordNotes.getChordNotes(chordName),
      parseProgression: (progression, keyName) => engine.parseProgression(progression, musicData[keyName])
    };
  });
}

test.beforeEach(async ({ page }) => {
  await initChordTestApi(page);
});

test("normalises enharmonic roots and canonicalises supported chord aliases", async ({ page }) => {
  const payload = await page.evaluate(() => ({
    normalised: {
      db: window.__chordTestApi.normaliseRoot("Db"),
      cb: window.__chordTestApi.normaliseRoot("Cb"),
      plain: window.__chordTestApi.normaliseRoot("F")
    },
    maj7Slash: window.__chordTestApi.parseChordName("dbmaj7/ab"),
    susAlias: window.__chordTestApi.parseChordName("Gsus"),
    altAlias: window.__chordTestApi.parseChordName("Calt"),
    sameBass: window.__chordTestApi.parseChordName("C/C")
  }));

  expect(payload.normalised).toEqual({
    db: "C#",
    cb: "B",
    plain: "F"
  });

  expect(payload.maj7Slash).toEqual({
    root: "Db",
    bass: "Ab",
    suffix: "Maj7",
    intervals: [0, 4, 7, 11],
    canonicalName: "DbMaj7/Ab"
  });

  expect(payload.susAlias?.canonicalName).toBe("Gsus4");
  expect(payload.altAlias?.canonicalName).toBe("C7b5b9#9b13");
  expect(payload.sameBass?.bass).toBeNull();
});

test("builds playback note arrays from canonical chord spellings and slash basses", async ({ page }) => {
  const payload = await page.evaluate(() => ({
    dbMaj7: window.__chordTestApi.getChordNotes("DbMaj7"),
    cSlashE: window.__chordTestApi.getChordNotes("C/E")
  }));

  expect(payload.dbMaj7).toEqual(["C#", "F", "G#", "C"]);
  expect(payload.cSlashE).toEqual(["E", "C", "E", "G"]);
});

test("parses major-key progressions with compatible quality families and invalid token reporting", async ({ page }) => {
  const result = await page.evaluate(() =>
    window.__chordTestApi.parseProgression("Cmaj7 | Dm7 | G7 | Hm | Q7", "C Ionian")
  );

  expect(result.invalid).toEqual(["Hm", "Q7"]);
  expect(result.parsed).toEqual([
    {
      typed: "Cmaj7",
      original: "CMaj7",
      diatonicChord: "C",
      inKey: true,
      function: "I"
    },
    {
      typed: "Dm7",
      original: "Dm7",
      diatonicChord: "Dm",
      inKey: true,
      function: "ii"
    },
    {
      typed: "G7",
      original: "G7",
      diatonicChord: "G",
      inKey: true,
      function: "V"
    }
  ]);
});

test("matches enharmonic spellings against minor-key diatonic chords", async ({ page }) => {
  const result = await page.evaluate(() =>
    window.__chordTestApi.parseProgression("Dbm | Abm | B | Bbm", "C# Aeolian")
  );

  expect(result.invalid).toEqual([]);
  expect(result.parsed).toEqual([
    {
      typed: "Dbm",
      original: "Dbm",
      diatonicChord: "C#m",
      inKey: true,
      function: "i"
    },
    {
      typed: "Abm",
      original: "Abm",
      diatonicChord: "G#m",
      inKey: true,
      function: "v"
    },
    {
      typed: "B",
      original: "B",
      diatonicChord: "B",
      inKey: true,
      function: "VII"
    },
    {
      typed: "Bbm",
      original: "Bbm",
      diatonicChord: null,
      inKey: false,
      function: null
    }
  ]);
});
