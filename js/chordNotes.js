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
export const DISPLAY_CHROMATIC = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

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
  { suffix: "mMaj7add13", aliases: ["mMaj7add13", "mmaj7add13"], intervals: [0, 3, 7, 11, 21] },
  { suffix: "mMaj7", aliases: ["mMaj7", "mmaj7"], intervals: [0, 3, 7, 11] },
  { suffix: "m7b9b13", aliases: ["m7b9b13"], intervals: [0, 3, 7, 10, 13, 17, 20] },
  { suffix: "m7b5", aliases: ["m7b5"], intervals: [0, 3, 6, 10] },
  { suffix: "m7b5b9b13", aliases: ["m7b5b9b13"], intervals: [0, 3, 6, 10, 13, 17, 20] },
  { suffix: "m7b5b13", aliases: ["m7b5b13"], intervals: [0, 3, 6, 10, 14, 17, 20] },
  { suffix: "m13b9", aliases: ["m13b9"], intervals: [0, 3, 7, 10, 13, 17, 21] },
  { suffix: "m11b13", aliases: ["m11b13"], intervals: [0, 3, 7, 10, 14, 17, 20] },
  { suffix: "m13", aliases: ["m13"], intervals: [0, 3, 7, 10, 14, 17, 21] },
  { suffix: "m11", aliases: ["m11"], intervals: [0, 3, 7, 10, 14, 17] },
  { suffix: "m9", aliases: ["m9"], intervals: [0, 3, 7, 10, 14] },
  { suffix: "madd13", aliases: ["madd13", "m(add13)"], intervals: [0, 3, 7, 21] },
  { suffix: "madd11", aliases: ["madd11", "m(add11)"], intervals: [0, 3, 7, 17] },
  { suffix: "madd9", aliases: ["madd9", "m(add9)"], intervals: [0, 3, 7, 14] },
  { suffix: "m7", aliases: ["m7"], intervals: [0, 3, 7, 10] },
  { suffix: "9sus4b13", aliases: ["9sus4b13", "11b13"], intervals: [0, 5, 7, 10, 14, 20] },
  { suffix: "9sus4", aliases: ["9sus4", "11"], intervals: [0, 5, 7, 10, 14] },
  { suffix: "13#11", aliases: ["13#11"], intervals: [0, 4, 7, 10, 14, 18, 21] },
  { suffix: "7b5", aliases: ["7b5"], intervals: [0, 4, 6, 10] },
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

function sortUniqueNumbers(values) {
  return [...new Set(values.filter(value => Number.isFinite(value)))].sort((a, b) => a - b);
}

function setsMatch(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) {
      return false;
    }
  }
  return true;
}

function getDefinitionPitchClasses(rootPc, definition) {
  return new Set(definition.intervals.map(interval => (rootPc + interval + 120) % 12));
}

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

export function pitchClassToDisplayNote(pitchClass) {
  if (!Number.isFinite(pitchClass)) return null;
  return DISPLAY_CHROMATIC[((pitchClass % 12) + 12) % 12] || null;
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

  const match = /^([A-G](?:#{1,2}|b{1,2})?)(.*?)(?:\/([A-G](?:#{1,2}|b{1,2})?))?$/i.exec(cleaned);
  if (!match) return null;

  const root = canonicaliseRoot(match[1]);
  const suffixText = match[2] || "";
  const bass = canonicaliseRoot(match[3] || "");
  const definition = findChordDefinition(suffixText);

  if (!root || !definition) {
    return null;
  }

  const bassRoot = bass && NOTE_TO_PC[bass] != null && NOTE_TO_PC[bass] !== NOTE_TO_PC[root]
    ? bass
    : null;

  return {
    root,
    bass: bassRoot,
    suffix: definition.suffix,
    intervals: definition.intervals,
    canonicalName: `${root}${definition.suffix}${bassRoot ? `/${bassRoot}` : ""}`
  };
}

export function getChordNotes(chordName) {
  const parsed = parseChordName(chordName);
  if (!parsed) return null;

  const root = normaliseRoot(parsed.root);
  const chordNotes = [];

  if (parsed.bass) {
    chordNotes.push(normaliseRoot(parsed.bass));
  }

  chordNotes.push(root);

  for (let i = 1; i < parsed.intervals.length; i += 1) {
    const note = transpose(root, parsed.intervals[i]);
    if (!note) return null;
    chordNotes.push(note);
  }

  return chordNotes;
}

export function identifyChordFromMidiNotes(midiNotes, options = {}) {
  const orderedMidiNotes = sortUniqueNumbers(Array.isArray(midiNotes) ? midiNotes : []);
  if (!orderedMidiNotes.length) {
    return null;
  }

  const preferredRootPitchClass = Number.isFinite(options.preferredRootPitchClass)
    ? ((options.preferredRootPitchClass % 12) + 12) % 12
    : null;
  const bassPitchClass = ((orderedMidiNotes[0] % 12) + 12) % 12;
  const playedPitchClasses = new Set(
    orderedMidiNotes.map(midi => ((midi % 12) + 12) % 12)
  );
  let bestMatch = null;

  for (let rootPitchClass = 0; rootPitchClass < 12; rootPitchClass += 1) {
    const root = pitchClassToDisplayNote(rootPitchClass);
    if (!root) continue;

    for (const definition of CHORD_DEFINITIONS) {
      const chordPitchClasses = getDefinitionPitchClasses(rootPitchClass, definition);
      const slashPitchClasses = new Set(chordPitchClasses);
      slashPitchClasses.add(bassPitchClass);

      const directMatch = setsMatch(playedPitchClasses, chordPitchClasses);
      const slashMatch =
        bassPitchClass !== rootPitchClass &&
        setsMatch(playedPitchClasses, slashPitchClasses);

      if (!directMatch && !slashMatch) {
        continue;
      }

      const bass =
        bassPitchClass !== rootPitchClass
          ? pitchClassToDisplayNote(bassPitchClass)
          : null;
      const match = {
        root,
        bass,
        suffix: definition.suffix,
        canonicalName: `${root}${definition.suffix}${bass ? `/${bass}` : ""}`,
        playedMidiNotes: orderedMidiNotes,
        playedPitchClasses: [...playedPitchClasses],
        matchesPreferredRoot: preferredRootPitchClass != null && rootPitchClass === preferredRootPitchClass,
        rootMatchesBass: rootPitchClass === bassPitchClass,
        matchKind: directMatch ? "direct" : "slash",
        matchSize: chordPitchClasses.size
      };

      if (!bestMatch) {
        bestMatch = match;
        continue;
      }

      const bestKindScore = bestMatch.matchKind === "direct" ? 2 : 1;
      const matchKindScore = match.matchKind === "direct" ? 2 : 1;
      const bestPreferredScore = bestMatch.matchesPreferredRoot ? 1 : 0;
      const matchPreferredScore = match.matchesPreferredRoot ? 1 : 0;
      const bestRootScore = bestMatch.rootMatchesBass ? 1 : 0;
      const matchRootScore = match.rootMatchesBass ? 1 : 0;

      if (
        matchPreferredScore > bestPreferredScore ||
        (
          matchPreferredScore === bestPreferredScore &&
          (
            matchRootScore > bestRootScore ||
            (
              matchRootScore === bestRootScore &&
              (
                matchKindScore > bestKindScore ||
                (matchKindScore === bestKindScore && match.matchSize > bestMatch.matchSize)
              )
            )
          )
        )
      ) {
        bestMatch = match;
      }
    }
  }

  if (!bestMatch) {
    return null;
  }

  const { matchesPreferredRoot, rootMatchesBass, matchKind, matchSize, ...result } = bestMatch;
  return result;
}
