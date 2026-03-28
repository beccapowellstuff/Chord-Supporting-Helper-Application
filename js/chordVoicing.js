/**
 * chordVoicing.js — Chord voicing and voice-leading smoothing
 *
 * Responsibilities:
 *   - Builds root-position, first-inversion, and second-inversion MIDI
 *     voicings for any chord name via buildVoicings
 *   - Selects the voicing closest to the previous chord (chooseVoicing)
 *     so progressions are played with minimal hand movement
 *   - Provides a simple ascending root voicing (getAscendingRootVoicing)
 *     for preview/reference use
 *   - distance helper: sums absolute semitone distance between two
 *     MIDI note arrays (used by chooseVoicing and playback)
 *
 * Exports: getAscendingRootVoicing, distance, buildVoicings, chooseVoicing
 * Depends on: chordNotes
 */
import { noteToMidi, parseChordName } from "./chordNotes.js";

export function getAscendingRootVoicing(chordName) {
  const parsed = parseChordName(chordName);
  if (!parsed) return [];

  const lowBassMidi = noteToMidi(parsed.bass || parsed.root, 2);
  const upperBassMidi = noteToMidi(parsed.bass || parsed.root, 3);
  const rootMidi = noteToMidi(parsed.root, 4);
  if (lowBassMidi == null || upperBassMidi == null || rootMidi == null) return [];

  const upperVoicing = parsed.intervals.map(interval => rootMidi + interval);
  return [lowBassMidi, upperBassMidi, ...upperVoicing];
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
  const parsed = parseChordName(chordName);
  if (!parsed) return [];

  const lowBassMidi = noteToMidi(parsed.bass || parsed.root, 2);
  const upperBassMidi = noteToMidi(parsed.bass || parsed.root, 3);
  const upperRootMidi = noteToMidi(parsed.root, 4);
  if (lowBassMidi == null || upperBassMidi == null || upperRootMidi == null) return [];

  const upperStructure = parsed.intervals.map(interval => upperRootMidi + interval);
  const voicings = [];

  for (let inversionIndex = 0; inversionIndex < upperStructure.length; inversionIndex += 1) {
    const inversion = upperStructure.map((midi, index) =>
      index < inversionIndex ? midi + 12 : midi
    );

    voicings.push([lowBassMidi, upperBassMidi, ...inversion]);
  }

  return voicings;
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
