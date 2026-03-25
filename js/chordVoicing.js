const TRIADS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6]
};

const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const ENHARMONIC = {
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

function normaliseRoot(root) {
  return ENHARMONIC[root] || root;
}

function transpose(root, semitones) {
  const normalised = normaliseRoot(root);
  const index = CHROMATIC.indexOf(normalised);
  if (index === -1) return null;
  return CHROMATIC[(index + semitones) % 12];
}

export function chordToNotes(chordName) {
  let quality = "major";
  let root = chordName;

  if (/dim$/i.test(chordName)) {
    quality = "diminished";
    root = chordName.replace(/dim$/i, "");
  } else if (/m$/i.test(chordName)) {
    quality = "minor";
    root = chordName.replace(/m$/i, "");
  }

  const intervals = TRIADS[quality];
  const baseOctave = quality === "minor" ? 3 : 4;

  const rootNote = `${normaliseRoot(root)}${baseOctave}`;
  const third = `${transpose(root, intervals[1])}${baseOctave}`;
  const fifth = `${transpose(root, intervals[2])}${baseOctave}`;

  return [rootNote, third, fifth];
}