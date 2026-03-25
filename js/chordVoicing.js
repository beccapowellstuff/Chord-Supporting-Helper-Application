import { NOTE_TO_PC, normaliseRoot, noteToMidi, getChordNotes } from "./chordNotes.js";

export function getAscendingRootVoicing(chordName) {
  let root = String(chordName || "").trim();
  let intervals = [0, 4, 7];

  if (!root) return [];

  if (root.endsWith("dim")) {
    root = root.slice(0, -3);
    intervals = [0, 3, 6];
  } else if (root.endsWith("m")) {
    root = root.slice(0, -1);
    intervals = [0, 3, 7];
  }

  root = normaliseRoot(root);

  const rootPc = NOTE_TO_PC[root];
  if (rootPc == null) return [];

  const baseMidi = rootPc < NOTE_TO_PC["C"]
    ? noteToMidi(root, 5)
    : noteToMidi(root, 4);

  const third = baseMidi + intervals[1];
  const fifth = baseMidi + intervals[2];

  return [baseMidi, third, fifth];
}

export function distance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;

  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += Math.abs(a[i] - b[i]);
  }
  return total;
}

export function buildVoicings(chordName) {
  const notes = getChordNotes(chordName);
  if (!notes) return [];

  const root = notes[0];
  const rootMidi = noteToMidi(root, 3);

  const chordMidis = notes.map((note, idx) => {
    const octave = idx === 0 ? 4 : (idx === notes.length - 1 && notes.length > 3 ? 4 : 4);
    return noteToMidi(note, octave);
  });

  const rootPosition = [rootMidi, ...chordMidis].sort((a, b) => a - b);

  const firstInversion = [
    rootMidi,
    ...chordMidis.map((midi, idx) => idx === 0 ? midi + 12 : midi)
  ].sort((a, b) => a - b);

  const secondInversion = [
    rootMidi,
    ...chordMidis.map((midi, idx) => idx <= 1 ? midi + 12 : midi)
  ].sort((a, b) => a - b);

  return [rootPosition, firstInversion, secondInversion];
}

export function chooseVoicing(chordName, previousVoicing) {
  const options = buildVoicings(chordName);
  if (!options.length) return [];

  if (!previousVoicing) {
    return options[0];
  }

  let best = options[0];
  let bestScore = distance(previousVoicing, best);

  for (const option of options.slice(1)) {
    const optionScore = distance(previousVoicing, option);
    if (optionScore < bestScore) {
      best = option;
      bestScore = optionScore;
    }
  }

  return best;
}
