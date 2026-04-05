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

export const TRIAD_VOICING_STYLE_OPTIONS = [
  { value: "close", label: "Close", shortLabel: "C" },
  { value: "close-high", label: "Close High", shortLabel: "CH" },
  { value: "open", label: "Open", shortLabel: "O" },
  { value: "open-high", label: "Open High", shortLabel: "OH" },
  { value: "open-reordered", label: "Spread", shortLabel: "S" },
  { value: "wide", label: "Wide", shortLabel: "W" }
];

export const GENERIC_VOICING_STYLE_OPTIONS = [
  { value: "close", label: "Close", shortLabel: "C" },
  { value: "open", label: "Open", shortLabel: "O" },
  { value: "spread", label: "Spread", shortLabel: "S" },
  { value: "wide", label: "Wide", shortLabel: "W" }
];

function normalizeInterval(interval) {
  return ((Number(interval) % 12) + 12) % 12;
}

function buildTrueInversionUpperStructure(parsed, octave = 4) {
  const rootMidi = noteToMidi(parsed.root, octave);
  if (rootMidi == null) return [];

  return parsed.intervals.map(interval => rootMidi + interval);
}

function isTriad(parsed) {
  return Array.isArray(parsed?.intervals) && parsed.intervals.length === 3;
}

function getBassMidiForInversion(parsed, inversionIndex) {
  if (parsed.bass) {
    return noteToMidi(parsed.bass, 2);
  }

  const rootBassMidi = noteToMidi(parsed.root, 2);
  if (rootBassMidi == null) {
    return null;
  }

  return rootBassMidi + normalizeInterval(parsed.intervals[inversionIndex]);
}

function buildTriadUpperVoicing(parsed, inversionIndex = 0, voicingStyle = "close") {
  if (!isTriad(parsed) || inversionIndex < 0 || inversionIndex > 2) {
    return [];
  }

  const rootMidi = noteToMidi(parsed.root, 4);
  if (rootMidi == null) {
    return [];
  }

  const normalizedStyle = TRIAD_VOICING_STYLE_OPTIONS.some(option => option.value === voicingStyle)
    ? voicingStyle
    : "close";
  const templateByStyle = {
    close: [
      { degreeIndex: 0, octaveLift: 0 },
      { degreeIndex: 1, octaveLift: 0 },
      { degreeIndex: 2, octaveLift: 0 }
    ],
    "close-high": [
      { degreeIndex: 1, octaveLift: 0 },
      { degreeIndex: 2, octaveLift: 0 },
      { degreeIndex: 0, octaveLift: 1 }
    ],
    open: [
      { degreeIndex: 2, octaveLift: 0 },
      { degreeIndex: 0, octaveLift: 1 },
      { degreeIndex: 1, octaveLift: 1 }
    ],
    "open-high": [
      { degreeIndex: 0, octaveLift: 0 },
      { degreeIndex: 1, octaveLift: 0 },
      { degreeIndex: 2, octaveLift: 1 }
    ],
    "open-reordered": [
      { degreeIndex: 0, octaveLift: 0 },
      { degreeIndex: 2, octaveLift: 0 },
      { degreeIndex: 1, octaveLift: 1 }
    ],
    wide: [
      { degreeIndex: 0, octaveLift: 0 },
      { degreeIndex: 1, octaveLift: 1 },
      { degreeIndex: 2, octaveLift: 1 }
    ]
  };

  const template = templateByStyle[normalizedStyle] || templateByStyle.close;

  return template.map(({ degreeIndex, octaveLift }) => {
    const rotatedIndex = degreeIndex + inversionIndex;
    const intervalIndex = rotatedIndex % parsed.intervals.length;
    const inversionLift = Math.floor(rotatedIndex / parsed.intervals.length);
    return rootMidi + parsed.intervals[intervalIndex] + ((octaveLift + inversionLift) * 12);
  });
}

function applyGenericVoicingStyle(upperVoicing, voicingStyle = "close") {
  const notes = Array.isArray(upperVoicing) ? [...upperVoicing] : [];
  if (!notes.length) {
    return [];
  }

  const normalizedStyle = GENERIC_VOICING_STYLE_OPTIONS.some(option => option.value === voicingStyle)
    ? voicingStyle
    : "close";

  const highestIndex = notes.length - 1;
  const styledNotes = notes.map((midi, index) => {
    if (normalizedStyle === "open") {
      return index === highestIndex ? midi + 12 : midi;
    }

    if (normalizedStyle === "spread") {
      return index % 2 === 1 ? midi + 12 : midi;
    }

    if (normalizedStyle === "wide") {
      return index >= 1 ? midi + 12 : midi;
    }

    return midi;
  });

  return styledNotes.sort((a, b) => a - b);
}

function buildTrueInversionVoicing(parsed, inversionIndex, voicingStyle = "close") {
  if (inversionIndex < 0 || inversionIndex >= parsed.intervals.length) {
    return [];
  }

  const bassMidi = getBassMidiForInversion(parsed, inversionIndex);
  if (bassMidi == null) {
    return [];
  }

  if (isTriad(parsed)) {
    const upperVoicing = buildTriadUpperVoicing(parsed, inversionIndex, voicingStyle);
    return upperVoicing.length ? [bassMidi, ...upperVoicing] : [];
  }

  const upperStructure = buildTrueInversionUpperStructure(parsed, 4);
  if (!upperStructure.length) {
    return [];
  }

  const upperBassMidi = bassMidi + 12;
  const inversion = upperStructure
    .map((midi, index) => (index < inversionIndex ? midi + 12 : midi))
    .sort((a, b) => a - b);
  const styledInversion = applyGenericVoicingStyle(inversion, voicingStyle);

  return [bassMidi, upperBassMidi, ...styledInversion];
}

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

export function getInversionOptions(chordName, voicingStyle = "close") {
  const parsed = parseChordName(chordName);
  if (!parsed) return [];

  return parsed.intervals.map((_, inversionIndex) => ({
    value: String(inversionIndex),
    label: inversionIndex === 0
      ? "Root"
      : inversionIndex === 1
        ? "1st"
        : inversionIndex === 2
          ? "2nd"
          : inversionIndex === 3
            ? "3rd"
            : `${inversionIndex}th`,
    shortLabel: inversionIndex === 0
      ? "R"
      : inversionIndex === 1
        ? "1"
        : inversionIndex === 2
          ? "2"
          : inversionIndex === 3
            ? "3"
            : String(inversionIndex),
    voicing: buildTrueInversionVoicing(parsed, inversionIndex, voicingStyle)
  })).filter(option => option.voicing.length);
}

export function getVoicingOptions(chordName = "") {
  const parsed = parseChordName(chordName);
  if (isTriad(parsed)) {
    return [...TRIAD_VOICING_STYLE_OPTIONS];
  }

  return [...GENERIC_VOICING_STYLE_OPTIONS];
}
