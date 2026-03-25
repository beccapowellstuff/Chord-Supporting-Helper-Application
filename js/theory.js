/**
 * theory.js — Music theory data and key generation
 *
 * Responsibilities:
 *   - Defines KEY_SCALES: the complete set of 24 keys (12 major + 12 minor)
 *     with root, mode, scale notes, and relative key for each
 *   - buildKeyData: derives the full key object (chords, functions map,
 *     transition table) from a KEY_SCALES entry — no hardcoded chord lists
 *   - generateAllKeys: builds and exports the complete musicData object
 *     keyed by key name (e.g. "C Major", "A Minor")
 *
 * Exports: generateAllKeys
 * Depends on: nothing
 */
const MAJOR_TRIAD_QUALITIES = ["", "m", "m", "", "", "m", "dim"];
const MINOR_TRIAD_QUALITIES = ["m", "dim", "", "m", "m", "", ""];

const MAJOR_ROMANS = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const MINOR_ROMANS = ["i", "ii°", "III", "iv", "v", "VI", "VII"];

const KEY_SCALES = {
  "C Major": {
    root: "C",
    mode: "major",
    scaleNotes: ["C", "D", "E", "F", "G", "A", "B"],
    relativeKey: "A Minor"
  },
  "G Major": {
    root: "G",
    mode: "major",
    scaleNotes: ["G", "A", "B", "C", "D", "E", "F#"],
    relativeKey: "E Minor"
  },
  "D Major": {
    root: "D",
    mode: "major",
    scaleNotes: ["D", "E", "F#", "G", "A", "B", "C#"],
    relativeKey: "B Minor"
  },
  "A Major": {
    root: "A",
    mode: "major",
    scaleNotes: ["A", "B", "C#", "D", "E", "F#", "G#"],
    relativeKey: "F# Minor"
  },
  "E Major": {
    root: "E",
    mode: "major",
    scaleNotes: ["E", "F#", "G#", "A", "B", "C#", "D#"],
    relativeKey: "C# Minor"
  },
  "B Major": {
    root: "B",
    mode: "major",
    scaleNotes: ["B", "C#", "D#", "E", "F#", "G#", "A#"],
    relativeKey: "G# Minor"
  },
  "F# Major": {
    root: "F#",
    mode: "major",
    scaleNotes: ["F#", "G#", "A#", "B", "C#", "D#", "E#"],
    relativeKey: "D# Minor"
  },
  "Db Major": {
    root: "Db",
    mode: "major",
    scaleNotes: ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"],
    relativeKey: "Bb Minor"
  },
  "Ab Major": {
    root: "Ab",
    mode: "major",
    scaleNotes: ["Ab", "Bb", "C", "Db", "Eb", "F", "G"],
    relativeKey: "F Minor"
  },
  "Eb Major": {
    root: "Eb",
    mode: "major",
    scaleNotes: ["Eb", "F", "G", "Ab", "Bb", "C", "D"],
    relativeKey: "C Minor"
  },
  "Bb Major": {
    root: "Bb",
    mode: "major",
    scaleNotes: ["Bb", "C", "D", "Eb", "F", "G", "A"],
    relativeKey: "G Minor"
  },
  "F Major": {
    root: "F",
    mode: "major",
    scaleNotes: ["F", "G", "A", "Bb", "C", "D", "E"],
    relativeKey: "D Minor"
  },

  "A Minor": {
    root: "A",
    mode: "minor",
    scaleNotes: ["A", "B", "C", "D", "E", "F", "G"],
    relativeKey: "C Major"
  },
  "E Minor": {
    root: "E",
    mode: "minor",
    scaleNotes: ["E", "F#", "G", "A", "B", "C", "D"],
    relativeKey: "G Major"
  },
  "B Minor": {
    root: "B",
    mode: "minor",
    scaleNotes: ["B", "C#", "D", "E", "F#", "G", "A"],
    relativeKey: "D Major"
  },
  "F# Minor": {
    root: "F#",
    mode: "minor",
    scaleNotes: ["F#", "G#", "A", "B", "C#", "D", "E"],
    relativeKey: "A Major"
  },
  "C# Minor": {
    root: "C#",
    mode: "minor",
    scaleNotes: ["C#", "D#", "E", "F#", "G#", "A", "B"],
    relativeKey: "E Major"
  },
  "G# Minor": {
    root: "G#",
    mode: "minor",
    scaleNotes: ["G#", "A#", "B", "C#", "D#", "E", "F#"],
    relativeKey: "B Major"
  },
  "D# Minor": {
    root: "D#",
    mode: "minor",
    scaleNotes: ["D#", "E#", "F#", "G#", "A#", "B", "C#"],
    relativeKey: "F# Major"
  },
  "Bb Minor": {
    root: "Bb",
    mode: "minor",
    scaleNotes: ["Bb", "C", "Db", "Eb", "F", "Gb", "Ab"],
    relativeKey: "Db Major"
  },
  "F Minor": {
    root: "F",
    mode: "minor",
    scaleNotes: ["F", "G", "Ab", "Bb", "C", "Db", "Eb"],
    relativeKey: "Ab Major"
  },
  "C Minor": {
    root: "C",
    mode: "minor",
    scaleNotes: ["C", "D", "Eb", "F", "G", "Ab", "Bb"],
    relativeKey: "Eb Major"
  },
  "G Minor": {
    root: "G",
    mode: "minor",
    scaleNotes: ["G", "A", "Bb", "C", "D", "Eb", "F"],
    relativeKey: "Bb Major"
  },
  "D Minor": {
    root: "D",
    mode: "minor",
    scaleNotes: ["D", "E", "F", "G", "A", "Bb", "C"],
    relativeKey: "F Major"
  }
};

const CIRCLE_OF_FIFTHS_MAJOR = [
  "C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"
];

function buildChordName(note, quality) {
  if (quality === "m") return `${note}m`;
  if (quality === "dim") return `${note}dim`;
  return note;
}

function buildTransitions(chords, mode) {
  const isMajor = mode === "major";
  const [i, ii, iii, iv, v, vi, vii] = chords;

  if (isMajor) {
    return {
      [i]: [iv, v, vi, iii],
      [ii]: [v, vi, iv],
      [iii]: [vi, iv, v],
      [iv]: [v, i, ii, vi],
      [v]: [i, vi, iii],
      [vi]: [iv, v, ii, i],
      [vii]: [i, iii, v]
    };
  }

  return {
    [i]: [iv, vi, vii, iii],
    [ii]: [i, v, vii],
    [iii]: [vi, vii, i, iv],
    [iv]: [i, vii, vi],
    [v]: [i, vi, vii],
    [vi]: [vii, i, iv, iii],
    [vii]: [i, vi, iii]
  };
}

function buildKeyData(name, definition) {
  const isMajor = definition.mode === "major";
  const qualities = isMajor ? MAJOR_TRIAD_QUALITIES : MINOR_TRIAD_QUALITIES;
  const romans = isMajor ? MAJOR_ROMANS : MINOR_ROMANS;

  const chords = definition.scaleNotes.map((note, index) =>
    buildChordName(note, qualities[index])
  );

  const functions = {};
  chords.forEach((chord, index) => {
    functions[chord] = romans[index];
  });

  return {
    name,
    root: definition.root,
    mode: definition.mode,
    scaleNotes: definition.scaleNotes,
    chords,
    functions,
    transitions: buildTransitions(chords, definition.mode),
    relativeKey: definition.relativeKey
  };
}

export function generateAllKeys() {
  const musicData = {};

  Object.entries(KEY_SCALES).forEach(([name, definition]) => {
    musicData[name] = buildKeyData(name, definition);
  });

  return musicData;
}