// Shared note and chord math utilities used across modules.

export const NOTE_TO_PC = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11
};

export const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const ENHARMONIC_TO_SHARP = {
  "B#": "C",
  Db: "C#",
  Eb: "D#",
  Fb: "E",
  "E#": "F",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
  Cb: "B"
};

export function normaliseRoot(root) {
  return ENHARMONIC_TO_SHARP[root] || root;
}

export function transpose(root, semitones) {
  const normalised = normaliseRoot(root);
  const index = CHROMATIC.indexOf(normalised);
  if (index === -1) return null;
  return CHROMATIC[(index + semitones + 12) % 12];
}

export function noteToMidi(noteName, octave) {
  const pitchClass = NOTE_TO_PC[noteName];
  if (pitchClass == null) return null;
  return (octave + 1) * 12 + pitchClass;
}

export function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getChordNotes(chordName) {
  let root = String(chordName || "").trim();
  let intervals = [0, 4, 7]; // Default: major triad

  if (!root) return null;

  // Check for chord suffixes (order matters - check longer suffixes first)
  if (root.endsWith("maj13")) {
    root = root.slice(0, -5);
    intervals = [0, 4, 7, 11, 14, 17, 21];  // maj triad + maj7 + 9 + 11 + 13
  } else if (root.endsWith("maj11")) {
    root = root.slice(0, -5);
    intervals = [0, 4, 7, 11, 14, 17];      // maj triad + maj7 + 9 + 11
  } else if (root.endsWith("maj9")) {
    root = root.slice(0, -4);
    intervals = [0, 4, 7, 11, 14];          // maj triad + maj7 + 9
  } else if (root.endsWith("maj7")) {
    root = root.slice(0, -4);
    intervals = [0, 4, 7, 11];              // Major seventh
  } else if (root.endsWith("m13")) {
    root = root.slice(0, -3);
    intervals = [0, 3, 7, 10, 14, 17, 21]; // min triad + min7 + 9 + 11 + 13
  } else if (root.endsWith("m11")) {
    root = root.slice(0, -3);
    intervals = [0, 3, 7, 10, 14, 17];     // min triad + min7 + 9 + 11
  } else if (root.endsWith("m9")) {
    root = root.slice(0, -2);
    intervals = [0, 3, 7, 10, 14];         // min triad + min7 + 9
  } else if (root.endsWith("m7")) {
    root = root.slice(0, -2);
    intervals = [0, 3, 7, 10];             // Minor seventh
  } else if (root.endsWith("dim")) {
    root = root.slice(0, -3);
    intervals = [0, 3, 6];                 // Diminished triad
  } else if (root.endsWith("m")) {
    root = root.slice(0, -1);
    intervals = [0, 3, 7];                 // Minor triad
  } else if (root.endsWith("aug")) {
    root = root.slice(0, -3);
    intervals = [0, 4, 8];                 // Augmented
  } else if (root.endsWith("sus4")) {
    root = root.slice(0, -4);
    intervals = [0, 5, 7];                 // Sus4
  } else if (root.endsWith("sus2")) {
    root = root.slice(0, -4);
    intervals = [0, 2, 7];                 // Sus2
  } else if (root.endsWith("sus")) {
    root = root.slice(0, -3);
    intervals = [0, 5, 7];                 // Sus defaults to sus4
  } else if (root.endsWith("add13")) {
    root = root.slice(0, -5);
    intervals = [0, 4, 7, 21];             // Major triad + 13th
  } else if (root.endsWith("add11")) {
    root = root.slice(0, -5);
    intervals = [0, 4, 7, 17];             // Major triad + 11th
  } else if (root.endsWith("add9")) {
    root = root.slice(0, -4);
    intervals = [0, 4, 7, 14];             // Major triad + 9th
  } else if (root.endsWith("13")) {
    root = root.slice(0, -2);
    intervals = [0, 4, 7, 10, 14, 17, 21]; // Dominant 13: triad + min7 + 9 + 11 + 13
  } else if (root.endsWith("11")) {
    root = root.slice(0, -2);
    intervals = [0, 4, 7, 10, 14, 17];     // Dominant 11: triad + min7 + 9 + 11
  } else if (root.endsWith("9")) {
    root = root.slice(0, -1);
    intervals = [0, 4, 7, 10, 14];         // Dominant 9: triad + min7 + 9
  } else if (root.endsWith("7")) {
    root = root.slice(0, -1);
    intervals = [0, 4, 7, 10];             // Dominant seventh
  } else if (root.endsWith("5")) {
    root = root.slice(0, -1);
    intervals = [0, 7];                    // Power chord (root + fifth only)
  }

  root = normaliseRoot(root);

  const chordNotes = [root];
  for (let i = 1; i < intervals.length; i++) {
    const note = transpose(root, intervals[i]);
    if (!note) return null;
    chordNotes.push(note);
  }

  if (chordNotes.some(n => !n)) return null;

  return chordNotes;
}
