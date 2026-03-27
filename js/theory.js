/**
 * theory.js - Music theory helpers backed by JSON mode data
 *
 * Responsibilities:
 *   - Translates JSON mode definitions into reusable interval formulas
 *   - Generates every supported root/mode combination
 *   - Derives scale notes, characteristic chords, Roman numerals, and
 *     suggestion transitions from the selected mode definition
 *
 * Exports: generateAllKeys, getModeGroups
 * Depends on: chordNotes (NOTE_TO_PC)
 */
import { NOTE_TO_PC } from "./chordNotes.js";

const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_NOTE_TO_PC = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};
const SIMPLE_SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SIMPLE_FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const MAJOR_ROMANS = ["I", "ii", "iii", "IV", "V", "vi", "vii°"];
const MINOR_ROMANS = ["i", "ii°", "III", "iv", "v", "VI", "VII"];

const SHARED_DEGREE_NAMES = [
  "tonic",
  "supertonic",
  "mediant",
  "subdominant",
  "dominant",
  "submediant"
];

const MAJOR_BASELINE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const BASE_ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"];
const GENERIC_DEGREE_NAMES = [
  "tonic",
  "2nd degree",
  "3rd degree",
  "4th degree",
  "5th degree",
  "6th degree",
  "7th degree"
];

const MODE_BEHAVIOUR = {
  ionian: {
    romanMode: "major",
    relativeModeId: "aeolian",
    relativeDegreeIndex: 5,
    parallelModeId: "aeolian"
  },
  aeolian: {
    romanMode: "minor",
    relativeModeId: "ionian",
    relativeDegreeIndex: 2,
    parallelModeId: "ionian"
  }
};

function getRootPitchClass(root) {
  return NOTE_TO_PC[root] ?? null;
}

function getRootLetter(root) {
  return String(root || "").charAt(0).toUpperCase();
}

function getLetterForDegree(rootLetter, degreeIndex) {
  const rootLetterIndex = LETTERS.indexOf(rootLetter);
  if (rootLetterIndex === -1) return null;
  return LETTERS[(rootLetterIndex + degreeIndex) % LETTERS.length];
}

function getAccidentalForOffset(offset) {
  if (offset === -2) return "bb";
  if (offset === -1) return "b";
  if (offset === 1) return "#";
  if (offset === 2) return "##";
  return "";
}

function getSignedPitchOffset(targetPc, naturalPc) {
  let diff = ((targetPc - naturalPc) % 12 + 12) % 12;
  if (diff > 6) diff -= 12;
  if (diff > 2) diff -= 12;
  if (diff < -2) diff += 12;
  return diff;
}

function formatModeOptionLabel(mode) {
  if (!Array.isArray(mode.aliases) || !mode.aliases.length) {
    return mode.name;
  }

  return `${mode.name} (${mode.aliases.join(", ")})`;
}

function formatFamilyLabel(parentFamily) {
  return String(parentFamily || "")
    .replace(/_modes?$/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function getModeBehaviour(modeId) {
  return MODE_BEHAVIOUR[modeId] || {};
}

function getIntervalsFromCNotes(notesInC) {
  return notesInC.map(note => {
    const pitchClass = getRootPitchClass(note);
    if (pitchClass == null) {
      throw new Error(`Unsupported note "${note}" in mode definition.`);
    }
    return pitchClass;
  });
}

function getEquivalentChordSuffix(chordSymbol) {
  const match = /^C(?:#{1,2}|b{1,2})?(.*)$/.exec(String(chordSymbol || "").trim());
  return match ? match[1] : "";
}

function transposePitchClassLabel(root, semitoneOffset, preferFlats = false) {
  const rootPc = getRootPitchClass(root);
  if (rootPc == null) return root;

  const noteNames = preferFlats ? SIMPLE_FLAT_NOTES : SIMPLE_SHARP_NOTES;
  return noteNames[(rootPc + semitoneOffset + 120) % 12];
}

function buildDerivedFrom(root, modeDefinition) {
  const example = String(modeDefinition.parentScaleExample || "").trim();

  if (!example) {
    return null;
  }

  const comesFromMatch = /^C\s+.+?\s+comes from\s+([A-G](?:#{1,2}|b{1,2})?)\s+(.+)$/i.exec(example);
  if (comesFromMatch) {
    const [, parentRoot, parentDescriptor] = comesFromMatch;
    const parentPc = getRootPitchClass(parentRoot);
    if (parentPc == null) {
      return `${parentRoot} ${parentDescriptor}`;
    }

    const preferFlats = parentRoot.includes("b");
    const transposedRoot = transposePitchClassLabel(root, parentPc, preferFlats);
    return `${transposedRoot} ${parentDescriptor}`;
  }

  const selfParentMatch = /^C\s+(.+?)\s+is(?:(?: its own)?|(?: the))\s+parent scale$/i.exec(example);
  if (selfParentMatch) {
    return `${root} ${modeDefinition.name}`;
  }

  return example;
}

function spellScaleNotes(root, intervals) {
  const rootPc = getRootPitchClass(root);
  const rootLetter = getRootLetter(root);

  if (rootPc == null || !rootLetter) {
    return [];
  }

  return intervals.map((interval, degreeIndex) => {
    const targetPc = (rootPc + interval) % 12;
    const letter = getLetterForDegree(rootLetter, degreeIndex);

    if (!letter) {
      return root;
    }

    const naturalPc = NATURAL_NOTE_TO_PC[letter];
    const offset = getSignedPitchOffset(targetPc, naturalPc);

    if (Math.abs(offset) > 1) {
      const simpleNotes = offset < 0 ? SIMPLE_FLAT_NOTES : SIMPLE_SHARP_NOTES;
      return simpleNotes[targetPc];
    }

    return `${letter}${getAccidentalForOffset(offset)}`;
  });
}

function rotateArray(values, startIndex) {
  return values.map((_, index) => values[(startIndex + index) % values.length]);
}

function getTriadQuality(rootPc, thirdPc, fifthPc) {
  const third = (thirdPc - rootPc + 12) % 12;
  const fifth = (fifthPc - rootPc + 12) % 12;

  if (third === 4 && fifth === 7) return "major";
  if (third === 3 && fifth === 7) return "minor";
  if (third === 3 && fifth === 6) return "dim";
  if (third === 4 && fifth === 8) return "aug";
  return "other";
}

function buildChordName(note, quality) {
  if (quality === "minor") return `${note}m`;
  if (quality === "dim") return `${note}dim`;
  if (quality === "aug") return `${note}aug`;
  return note;
}

function buildDiatonicChords(scaleNotes) {
  const pitchClasses = scaleNotes.map(note => getRootPitchClass(note));

  return scaleNotes.map((note, index) => {
    const rotatedPitchClasses = rotateArray(pitchClasses, index);
    const quality = getTriadQuality(
      rotatedPitchClasses[0],
      rotatedPitchClasses[2],
      rotatedPitchClasses[4]
    );

    return {
      chord: buildChordName(note, quality),
      quality
    };
  });
}

function buildGeneratedRomans(intervals, triadQualities) {
  return intervals.map((interval, index) => {
    const diff = interval - MAJOR_BASELINE_INTERVALS[index];
    const accidental = diff === -1 ? "b" : diff === 1 ? "#" : "";
    const baseRoman = BASE_ROMANS[index];
    const quality = triadQualities[index];

    let roman = quality === "minor" || quality === "dim"
      ? baseRoman.toLowerCase()
      : baseRoman;

    if (quality === "dim") {
      roman += "°";
    } else if (quality === "aug") {
      roman += "+";
    }

    return `${accidental}${roman}`;
  });
}

function getDegreeLabels(modeDefinition, triadQualities) {
  const behaviour = getModeBehaviour(modeDefinition.id);

  if (behaviour.romanMode === "major") {
    return MAJOR_ROMANS;
  }

  if (behaviour.romanMode === "minor") {
    return MINOR_ROMANS;
  }

  return buildGeneratedRomans(modeDefinition.intervals, triadQualities);
}

function getDegreeDescriptions(modeDefinition) {
  return modeDefinition.intervals.map((interval, index) => {
    if (index < SHARED_DEGREE_NAMES.length) {
      return SHARED_DEGREE_NAMES[index];
    }

    if (index === 6) {
      return interval === 11 ? "leading tone" : "subtonic";
    }

    return GENERIC_DEGREE_NAMES[index] || `${index + 1}th degree`;
  });
}

function buildTransitions(chords, tonicQuality) {
  const isMajorLike = tonicQuality === "major";
  const [i, ii, iii, iv, v, vi, vii] = chords;

  if (isMajorLike) {
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

function buildRelativeKey(root, modeDefinition, scaleNotes, modeDefinitionsById) {
  const behaviour = getModeBehaviour(modeDefinition.id);
  const relativeMode = modeDefinitionsById[behaviour.relativeModeId];

  if (!relativeMode) {
    return null;
  }

  const relativeRoot = scaleNotes[behaviour.relativeDegreeIndex];
  return `${relativeRoot} ${relativeMode.name}`;
}

function buildParallelKey(root, modeDefinition, modeDefinitionsById) {
  const behaviour = getModeBehaviour(modeDefinition.id);
  const parallelMode = modeDefinitionsById[behaviour.parallelModeId];

  if (!parallelMode) {
    return null;
  }

  return `${root} ${parallelMode.name}`;
}

function normaliseModeDefinition(mode, categoryLabels) {
  return {
    ...mode,
    intervals: getIntervalsFromCNotes(mode.notesInC || []),
    equivalentChordSuffix: getEquivalentChordSuffix(mode.chordSymbol),
    categoryLabel: categoryLabels?.[mode.category] || mode.category,
    optionLabel: formatModeOptionLabel(mode),
    parentFamilyLabel: formatFamilyLabel(mode.parentFamily)
  };
}

function buildKeyData(root, modeDefinition, modeDefinitionsById) {
  const scaleNotes = spellScaleNotes(root, modeDefinition.intervals);
  const diatonicChords = buildDiatonicChords(scaleNotes);
  const triadQualities = diatonicChords.map(item => item.quality);
  const degreeLabels = getDegreeLabels(modeDefinition, triadQualities);
  const degreeDescriptions = getDegreeDescriptions(modeDefinition);
  const chords = diatonicChords.map(item => item.chord);
  const functions = {};

  chords.forEach((chord, index) => {
    functions[chord] = degreeLabels[index];
  });

  return {
    name: `${root} ${modeDefinition.name}`,
    root,
    mode: modeDefinition.name,
    modeId: modeDefinition.id,
    category: modeDefinition.category,
    categoryLabel: modeDefinition.categoryLabel,
    aliases: modeDefinition.aliases || [],
    parentFamily: modeDefinition.parentFamily,
    parentFamilyLabel: modeDefinition.parentFamilyLabel,
    parentScaleExample: modeDefinition.parentScaleExample,
    derivedFrom: buildDerivedFrom(root, modeDefinition),
    character: modeDefinition.character,
    scaleNotes,
    chords,
    functions,
    degreeLabels,
    degreeDescriptions,
    transitions: buildTransitions(chords, triadQualities[0]),
    relativeKey: buildRelativeKey(root, modeDefinition, scaleNotes, modeDefinitionsById),
    parallelKey: buildParallelKey(root, modeDefinition, modeDefinitionsById),
    equivalentChord: `${root}${modeDefinition.equivalentChordSuffix}`
  };
}

export function getModeGroups(modesConfig) {
  const categoryLabels = modesConfig?.categoryLabels || {};
  const modes = Array.isArray(modesConfig?.modes) ? modesConfig.modes : [];
  const orderedCategories = Array.isArray(modesConfig?.groupOrder) ? modesConfig.groupOrder : [];

  return orderedCategories
    .map(category => ({
      category,
      label: categoryLabels[category] || category,
      modes: modes
        .filter(mode => mode.category === category)
        .map(mode => ({
          value: mode.id,
          label: formatModeOptionLabel(mode)
        }))
    }))
    .filter(group => group.modes.length > 0);
}

export function generateAllKeys(modesConfig) {
  const categoryLabels = modesConfig?.categoryLabels || {};
  const modes = Array.isArray(modesConfig?.modes) ? modesConfig.modes : [];
  const normalisedModes = modes.map(mode => normaliseModeDefinition(mode, categoryLabels));
  const modeDefinitionsById = Object.fromEntries(
    normalisedModes.map(mode => [mode.id, mode])
  );
  const musicData = {};

  ROOTS.forEach(root => {
    normalisedModes.forEach(modeDefinition => {
      const keyData = buildKeyData(root, modeDefinition, modeDefinitionsById);
      musicData[keyData.name] = keyData;
    });
  });

  return musicData;
}
