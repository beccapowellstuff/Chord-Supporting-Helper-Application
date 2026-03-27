/**
 * chordNotes.js - Shared note and chord mathematics
 *
 * Responsibilities:
 *   - Defines the canonical pitch-class lookup table (NOTE_TO_PC) and
 *     chromatic scale array (CHROMATIC) used by all other modules
 *   - Provides low-level helpers: normaliseRoot, transpose, noteToMidi,
 *     midiToFrequency
 *   - Provides parseChordName/getChordNotes so the rest of the app can work
 *     with simple triads and richer modal extension chords from one registry
 *
 * Exports: NOTE_TO_PC, CHROMATIC, normaliseRoot, transpose, noteToMidi,
 *          midiToFrequency, parseChordName, getChordNotes
 * Depends on: nothing
 */
export const NOTE_TO_PC = {
  C: 0,
  "B#": 0,
  Dbb: 0,
  "C#": 1,
  Db: 1,
  "B##": 1,
  D: 2,
  "C##": 2,
  Ebb: 2,
  "D#": 3,
  Eb: 3,
  Fbb: 3,
  E: 4,
  Fb: 4,
  "D##": 4,
  F: 5,
  "E#": 5,
  Gbb: 5,
  "F#": 6,
  Gb: 6,
  "E##": 6,
  G: 7,
  "F##": 7,
  Abb: 7,
  "G#": 8,
  Ab: 8,
  "G##": 9,
  A: 9,
  Bbb: 9,
  "A#": 10,
  Bb: 10,
  Cbb: 10,
  B: 11,
  Cb: 11,
  "A##": 11
};

export const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const ENHARMONIC_TO_SHARP = {
  "B#": "C",
  Dbb: "C",
  Db: "C#",
  "B##": "C#",
  Eb: "D#",
  Ebb: "D",
  Fb: "E",
  Fbb: "D#",
  "D##": "E",
  "E#": "F",
  Gbb: "F",
  Gb: "F#",
  "E##": "F#",
  Ab: "G#",
  Abb: "G",
  "F##": "G",
  Bb: "A#",
  Bbb: "A",
  "G##": "A",
  Cb: "B",
  Cbb: "A#",
  "A##": "B",
  "C##": "D"
};

const CHORD_DEFINITIONS = [
  { suffix: "Maj13#5#11", aliases: ["Maj13#5#11", "maj13#5#11"], intervals: [0, 4, 8, 11, 14, 18, 21] },
  { suffix: "Maj13#11", aliases: ["Maj13#11", "maj13#11"], intervals: [0, 4, 7, 11, 14, 18, 21] },
  { suffix: "Maj13", aliases: ["Maj13", "maj13"], intervals: [0, 4, 7, 11, 14, 17, 21] },
  { suffix: "Maj11", aliases: ["Maj11", "maj11"], intervals: [0, 4, 7, 11, 14, 17] },
  { suffix: "Maj9", aliases: ["Maj9", "maj9"], intervals: [0, 4, 7, 11, 14] },
  { suffix: "Maj7", aliases: ["Maj7", "maj7"], intervals: [0, 4, 7, 11] },
  { suffix: "mMaj7b13", aliases: ["mMaj7b13", "mmaj7b13"], intervals: [0, 3, 7, 11, 14, 17, 20] },
  { suffix: "mMaj7", aliases: ["mMaj7", "mmaj7"], intervals: [0, 3, 7, 11] },
  { suffix: "m7b9b13", aliases: ["m7b9b13"], intervals: [0, 3, 7, 10, 13, 17, 20] },
  { suffix: "m7b5b9b13", aliases: ["m7b5b9b13"], intervals: [0, 3, 6, 10, 13, 17, 20] },
  { suffix: "m7b5b13", aliases: ["m7b5b13"], intervals: [0, 3, 6, 10, 14, 17, 20] },
  { suffix: "m13b9", aliases: ["m13b9"], intervals: [0, 3, 7, 10, 13, 17, 21] },
  { suffix: "m11b13", aliases: ["m11b13"], intervals: [0, 3, 7, 10, 14, 17, 20] },
  { suffix: "m13", aliases: ["m13"], intervals: [0, 3, 7, 10, 14, 17, 21] },
  { suffix: "m11", aliases: ["m11"], intervals: [0, 3, 7, 10, 14, 17] },
  { suffix: "m9", aliases: ["m9"], intervals: [0, 3, 7, 10, 14] },
  { suffix: "m7", aliases: ["m7"], intervals: [0, 3, 7, 10] },
  { suffix: "9sus4b13", aliases: ["9sus4b13", "11b13"], intervals: [0, 5, 7, 10, 14, 20] },
  { suffix: "9sus4", aliases: ["9sus4", "11"], intervals: [0, 5, 7, 10, 14] },
  { suffix: "13#11", aliases: ["13#11"], intervals: [0, 4, 7, 10, 14, 18, 21] },
  { suffix: "7#5b9#11b13", aliases: ["7#5b9#11b13"], intervals: [0, 4, 8, 10, 13, 18, 20] },
  { suffix: "7b5b9#9b13", aliases: ["7b5b9#9b13", "7alt", "alt"], intervals: [0, 4, 6, 10, 13, 15, 20] },
  { suffix: "add13", aliases: ["add13"], intervals: [0, 4, 7, 21] },
  { suffix: "add11", aliases: ["add11"], intervals: [0, 4, 7, 17] },
  { suffix: "add9", aliases: ["add9"], intervals: [0, 4, 7, 14] },
  { suffix: "13", aliases: ["13"], intervals: [0, 4, 7, 10, 14, 17, 21] },
  { suffix: "9", aliases: ["9"], intervals: [0, 4, 7, 10, 14] },
  { suffix: "7", aliases: ["7"], intervals: [0, 4, 7, 10] },
  { suffix: "sus4", aliases: ["sus4", "sus"], intervals: [0, 5, 7] },
  { suffix: "sus2", aliases: ["sus2"], intervals: [0, 2, 7] },
  { suffix: "dim", aliases: ["dim"], intervals: [0, 3, 6] },
  { suffix: "aug", aliases: ["aug"], intervals: [0, 4, 8] },
  { suffix: "m", aliases: ["m"], intervals: [0, 3, 7] },
  { suffix: "5", aliases: ["5"], intervals: [0, 7] },
  { suffix: "", aliases: [""], intervals: [0, 4, 7] }
];

export function normaliseRoot(root) {
  return ENHARMONIC_TO_SHARP[root] || root;
}

export function transpose(root, semitones) {
  const normalised = normaliseRoot(root);
  const index = CHROMATIC.indexOf(normalised);
  if (index === -1) return null;
  return CHROMATIC[(index + semitones + 120) % 12];
}

export function noteToMidi(noteName, octave) {
  const pitchClass = NOTE_TO_PC[noteName];
  if (pitchClass == null) return null;
  return (octave + 1) * 12 + pitchClass;
}

export function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function canonicaliseRoot(root) {
  if (!root) return null;
  return root.charAt(0).toUpperCase() + root.slice(1);
}

function findChordDefinition(suffixText) {
  const cleaned = String(suffixText || "").trim();
  return CHORD_DEFINITIONS.find(definition =>
    definition.aliases.some(alias => alias.toLowerCase() === cleaned.toLowerCase())
  ) || null;
}

export function parseChordName(chordName) {
  const cleaned = String(chordName || "").trim().replace(/\s+/g, "");
  if (!cleaned) return null;

  const match = /^([A-G](?:#{1,2}|b{1,2})?)(.*)$/i.exec(cleaned);
  if (!match) return null;

  const root = canonicaliseRoot(match[1]);
  const suffixText = match[2] || "";
  const definition = findChordDefinition(suffixText);

  if (!root || !definition) {
    return null;
  }

  return {
    root,
    suffix: definition.suffix,
    intervals: definition.intervals,
    canonicalName: `${root}${definition.suffix}`
  };
}

export function getChordNotes(chordName) {
  const parsed = parseChordName(chordName);
  if (!parsed) return null;

  const root = normaliseRoot(parsed.root);
  const chordNotes = [root];

  for (let i = 1; i < parsed.intervals.length; i += 1) {
    const note = transpose(root, parsed.intervals[i]);
    if (!note) return null;
    chordNotes.push(note);
  }

  return chordNotes;
}
