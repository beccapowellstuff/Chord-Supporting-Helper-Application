/**
 * engine.js — Chord suggestion and progression parsing engine
 *
 * Responsibilities:
 *   - parseProgression: tokenises a user-typed chord string, canonicalises
 *     each chord, and maps it to a diatonic function if it is in the key
 *   - getSuggestions: builds theory-driven in-key, related, and out-of-key
 *     suggestions, then ranks them against the current progression and mood
 *   - All scoring helpers (getCadenceBonus, getPatternBonus,
 *     getRepetitionPenalty, getBorrowedResolutionBonus, buildReasonParts)
 *     are internal to this module
 *
 * Exports: parseProgression, getSuggestions
 * Depends on: chordNotes (NOTE_TO_PC, normaliseRoot, parseChordName)
 */
import { NOTE_TO_PC, normaliseRoot, parseChordName, pitchClassToDisplayNote } from "./chordNotes.js";

const SHARP_PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_PITCH_CLASSES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const STABLE_ARRIVAL_SUFFIXES = new Set([
  "",
  "m",
  "add9",
  "add11",
  "add13",
  "Maj7",
  "Maj9",
  "Maj11",
  "Maj13",
  "m7",
  "m9",
  "m11",
  "m13",
  "sus2",
  "sus4",
  "madd9",
  "madd11",
  "madd13"
]);
const MAX_BUCKET_SUGGESTIONS = 5;
const SUGGESTION_BUCKETS = [
  {
    id: "inKey",
    title: "In Key",
    description: "Grounded choices from the current key and mode."
  },
  {
    id: "related",
    title: "Related",
    description: "Borrowed or parallel colours that still stay close to the centre."
  },
  {
    id: "outside",
    title: "Out of Key",
    description: "Bolder applied or chromatic moves with a clear theory reason."
  }
];

const MOOD_PROFILES = {
  Sad: {
    summary: "Pushes the harmony darker and more reflective.",
    functionWeights: {
      I: -3,
      ii: 5,
      iii: 4,
      IV: 1,
      V: -3,
      vi: 6,
      i: 4,
      "iiÂ°": 2,
      III: 2,
      iv: 5,
      v: 1,
      VI: 5,
      VII: 2
    },
    relatedRules: [
      { interval: 5, suffix: "m", label: "iv (parallel minor)", weight: 9, categories: ["major_feel", "dominant_feel"], reason: "Borrowed minor iv is a classic way to darken a major-feel progression." },
      { interval: 10, suffix: "", label: "bVII", weight: 8, categories: ["major_feel", "dominant_feel"], reason: "Borrowed bVII adds wistful weight and softens the bright major pull." },
      { interval: 3, suffix: "", label: "bIII", weight: 8, categories: ["major_feel", "dominant_feel"], reason: "Borrowed bIII shifts the colour toward a more introspective space." },
      { interval: 8, suffix: "", label: "bVI", weight: 7, categories: ["major_feel", "dominant_feel"], reason: "Borrowed bVI gives the progression a broader melancholy colour." },
      { interval: 0, suffix: "m", label: "i (parallel)", weight: 6, categories: ["major_feel", "dominant_feel"], reason: "The parallel minor tonic keeps the same home note but changes its emotional shade." }
    ],
    outsideRules: [
      { type: "secondaryDominants", targetFunctions: ["ii", "vi", "iii"], suffix: "7", weight: 7, reason: "Applied dominants can pivot toward more reflective in-key targets." },
      { interval: 1, suffix: "", label: "bII colour", weight: 5, categories: ["major_feel", "dominant_feel"], reason: "Flat-II colour adds ache before resolving back into the key." }
    ]
  },
  Somber: {
    summary: "Leans toward heavier, darker, and broader colours.",
    functionWeights: {
      I: -4,
      ii: 4,
      iii: 1,
      IV: 0,
      V: -2,
      vi: 4,
      i: 5,
      "iiÂ°": 4,
      III: 1,
      iv: 6,
      v: 2,
      VI: 6,
      VII: 4
    },
    relatedRules: [
      { interval: 5, suffix: "m", label: "iv (parallel minor)", weight: 8, categories: ["major_feel", "dominant_feel"], reason: "Borrowed minor iv pulls the progression into a darker, weightier place." },
      { interval: 8, suffix: "", label: "bVI", weight: 9, categories: ["major_feel", "dominant_feel"], reason: "Borrowed bVI gives a cinematic darkening effect." },
      { interval: 10, suffix: "", label: "bVII", weight: 8, categories: ["major_feel", "dominant_feel"], reason: "Borrowed bVII keeps the motion open while adding gravity." },
      { interval: 1, suffix: "", label: "bII", weight: 7, categories: ["major_feel", "dominant_feel"], reason: "Flat-II brings a sombre dramatic edge before any resolution." }
    ],
    outsideRules: [
      { type: "secondaryDominants", targetFunctions: ["iv", "VI", "VII", "ii"], suffix: "7", weight: 6, reason: "Applied dominants can intensify a darker target before the progression settles." },
      { interval: 6, suffix: "dim", label: "#ivÂ°", weight: 5, reason: "A chromatic diminished chord intensifies the tension without sounding bright." }
    ]
  },
  Dreamy: {
    summary: "Prefers floating, open movement over direct hard resolution.",
    functionWeights: {
      I: 3,
      ii: 1,
      iii: 6,
      IV: 5,
      V: -1,
      vi: 4,
      i: 3,
      "iiÂ°": -1,
      III: 4,
      iv: 2,
      v: 0,
      VI: 4,
      VII: 2
    },
    relatedRules: [
      { interval: 2, suffix: "", label: "II colour", weight: 8, reason: "A major II adds floating modal colour without immediately forcing a cadence." },
      { interval: 10, suffix: "", label: "bVII", weight: 8, reason: "bVII keeps the harmony open and suspended rather than tightly resolved." },
      { interval: 3, suffix: "", label: "bIII", weight: 7, categories: ["major_feel", "dominant_feel"], reason: "bIII adds a soft reflective colour that feels less direct than staying purely diatonic." },
      { interval: 5, suffix: "m", label: "iv (parallel minor)", weight: 6, categories: ["major_feel", "dominant_feel"], reason: "Borrowed minor iv softens a bright centre into something hazier." }
    ],
    outsideRules: [
      { type: "secondaryDominants", targetFunctions: ["iii", "vi"], suffix: "7", weight: 5, reason: "Applied dominants can gently pivot into softer in-key colours." },
      { interval: 6, suffix: "dim", label: "#ivÂ°", weight: 5, reason: "A light chromatic diminished colour can add shimmer before the next move." }
    ]
  },
  Tense: {
    summary: "Rewards unstable, dominant, and pressure-building movement.",
    functionWeights: {
      I: -4,
      ii: 3,
      iii: -1,
      IV: 1,
      V: 7,
      vi: -2,
      i: -4,
      "iiÂ°": 6,
      III: -1,
      iv: 2,
      v: 6,
      VI: 0,
      VII: 3,
      "viiÂ°": 7
    },
    relatedRules: [
      { interval: 1, suffix: "", label: "bII", weight: 9, reason: "Flat-II brings immediate pressure and a strong chromatic bite." },
      { interval: 6, suffix: "dim", label: "#ivÂ°", weight: 8, reason: "A chromatic diminished chord intensifies the pull into a dominant-style move." },
      { interval: 8, suffix: "", label: "bVI", weight: 5, categories: ["major_feel", "dominant_feel"], reason: "bVI adds darker tension before release." }
    ],
    outsideRules: [
      { type: "secondaryDominants", targetFunctions: ["V", "ii", "vi"], suffix: "7", weight: 9, reason: "Applied dominants are one of the clearest ways to intensify tension." },
      { interval: 1, suffix: "7", label: "bII7", weight: 7, reason: "A chromatic dominant-style bII chord adds sharp instability." }
    ]
  },
  Hopeful: {
    summary: "Aims for lift, openness, and forward-moving brightness.",
    functionWeights: {
      I: 5,
      ii: 4,
      iii: 1,
      IV: 6,
      V: 4,
      vi: 2,
      i: 1,
      "iiÂ°": -2,
      III: 4,
      iv: -1,
      v: 0,
      VI: 3,
      VII: 2
    },
    relatedRules: [
      { interval: 2, suffix: "", label: "II lift", weight: 8, reason: "A major II adds lift and a brighter push forward." },
      { interval: 9, suffix: "", label: "VI colour", weight: 6, categories: ["major_feel", "dominant_feel"], reason: "A bright VI chord can make the progression feel more open and optimistic." },
      { interval: 4, suffix: "", label: "III colour", weight: 6, categories: ["major_feel", "dominant_feel"], reason: "A bright III chord adds colour without sounding heavy." },
      { interval: 5, suffix: "", label: "IV (parallel major)", weight: 7, categories: ["minor_feel", "other_scales", "diminished_or_unstable"], reason: "Borrowing a major IV brightens a minor-feel centre." }
    ],
    outsideRules: [
      { type: "secondaryDominants", targetFunctions: ["IV", "V", "vi"], suffix: "7", weight: 6, reason: "Applied dominants can create confident forward motion into uplifting targets." }
    ]
  },
  Happy: {
    summary: "Prefers bright, direct, and energetic movement.",
    functionWeights: {
      I: 6,
      ii: 2,
      iii: 2,
      IV: 5,
      V: 5,
      vi: 1,
      i: -1,
      "iiÂ°": -3,
      III: 5,
      iv: -2,
      v: -1,
      VI: 4,
      VII: 1
    },
    relatedRules: [
      { interval: 2, suffix: "", label: "II lift", weight: 7, reason: "A major II adds a bright pop of lift." },
      { interval: 9, suffix: "", label: "VI colour", weight: 7, categories: ["major_feel", "dominant_feel"], reason: "A bright VI gives the progression an energetic glow." },
      { interval: 4, suffix: "", label: "III colour", weight: 6, categories: ["major_feel", "dominant_feel"], reason: "A bright III can make the harmony feel more upbeat and direct." }
    ],
    outsideRules: [
      { type: "secondaryDominants", targetFunctions: ["V", "IV", "vi"], suffix: "7", weight: 5, reason: "Applied dominants can add bright propulsion before the next chord lands." }
    ]
  }
};

function normaliseChordToken(token) {
  return String(token || "")
    .trim()
    .replace(/°/g, "dim")
    .replace(/\s+/g, "");
}

function getChordQuality(chord) {
  const parsed = parseChordName(chord);
  return parsed ? parsed.suffix || "major" : "major";
}

function getChordRoot(chord) {
  const parsed = parseChordName(chord);
  return parsed ? parsed.root : chord;
}


function canonicaliseTypedChord(token) {
  const cleaned = normaliseChordToken(token);
  if (!cleaned) return null;

  const parsed = parseChordName(cleaned);
  return parsed ? parsed.canonicalName : null;
}

function chordsEquivalent(chordA, chordB) {
  const qualityA = getChordQuality(chordA);
  const qualityB = getChordQuality(chordB);

  if (qualityA !== qualityB) return false;

  return normaliseRoot(getChordRoot(chordA)) === normaliseRoot(getChordRoot(chordB));
}

function getQualityFamily(quality) {
  const majorLike = new Set([
    "major",
    "Maj7",
    "Maj9",
    "Maj11",
    "Maj13",
    "Maj13#11",
    "Maj13#5#11",
    "add9",
    "add11",
    "add13",
    "7",
    "9",
    "11",
    "13",
    "13#11",
    "11b13",
    "7#5b9#11b13",
    "7b5b9#9b13"
  ]);
  const minorLike = new Set([
    "m",
    "m7",
    "m9",
    "m11",
    "m13",
    "mMaj7",
    "mMaj7b13",
    "m11b13",
    "m13b9"
  ]);
  const diminishedLike = new Set(["dim", "m7b5", "m7b5b13", "m7b5b9b13"]);
  const augmentedLike = new Set(["aug"]);

  if (majorLike.has(quality)) return "major";
  if (minorLike.has(quality)) return "minor";
  if (diminishedLike.has(quality)) return "dim";
  if (augmentedLike.has(quality)) return "aug";
  return quality;
}

function findMatchingDiatonicChord(inputChord, keyData) {
  const exactMatch = keyData.chords.find(diatonicChord => chordsEquivalent(diatonicChord, inputChord));
  if (exactMatch) {
    return {
      diatonicChord: exactMatch,
      function: keyData.functions[exactMatch]
    };
  }

  const inputRoot = normaliseRoot(getChordRoot(inputChord));
  const inputFamily = getQualityFamily(getChordQuality(inputChord));

  const compatibleMatch = keyData.chords.find(diatonicChord => {
    const diatonicRoot = normaliseRoot(getChordRoot(diatonicChord));
    const diatonicFamily = getQualityFamily(getChordQuality(diatonicChord));
    return diatonicRoot === inputRoot && diatonicFamily === inputFamily;
  });

  if (!compatibleMatch) {
    return null;
  }

  return {
    diatonicChord: compatibleMatch,
    function: keyData.functions[compatibleMatch]
  };
}

function getChordFamilySignature(chord) {
  const root = normaliseRoot(getChordRoot(chord || ""));
  const family = getQualityFamily(getChordQuality(chord || ""));
  return root && family ? `${root}:${family}` : "";
}

function chordsShareFamily(chordA, chordB) {
  const signatureA = getChordFamilySignature(chordA);
  const signatureB = getChordFamilySignature(chordB);
  return Boolean(signatureA && signatureA === signatureB);
}

function getBaseChordLabel(chord) {
  const parsed = parseChordName(chord);
  if (!parsed) {
    return chord;
  }

  return canonicaliseTypedChord(`${parsed.root}${parsed.suffix || ""}`) || parsed.canonicalName || chord;
}

function buildChromaticCandidatePool(keyData) {
  const pitchClasses = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const pool = [];

  pitchClasses.forEach(root => {
    pool.push(root);
    pool.push(`${root}m`);
    pool.push(`${root}dim`);
  });

  keyData.chords.forEach(chord => {
    if (!pool.some(candidate => chordsEquivalent(candidate, chord))) {
      pool.push(chord);
    }
  });

  return pool;
}

function getBucketMeta(bucketId) {
  return SUGGESTION_BUCKETS.find(bucket => bucket.id === bucketId) || SUGGESTION_BUCKETS[0];
}

function normaliseFunctionLabel(label) {
  return String(label || "")
    .replace(/Â°/g, "Â°")
    .trim();
}

function getMoodProfile(feeling) {
  return MOOD_PROFILES[feeling] || MOOD_PROFILES.Hopeful;
}

function appliesToCategory(rule, keyData) {
  if (!Array.isArray(rule?.categories) || !rule.categories.length) {
    return true;
  }

  return rule.categories.includes(keyData.category);
}

function getPitchClass(root) {
  return NOTE_TO_PC[normaliseRoot(root)] ?? null;
}

function midiToDisplayNote(midi) {
  if (!Number.isFinite(midi)) {
    return null;
  }

  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${pitchClassToDisplayNote(pitchClass) || "?"}${octave}`;
}

function isStableArrivalChord(chord) {
  const parsed = parseChordName(chord);
  if (!parsed) {
    return false;
  }

  const family = getQualityFamily(parsed.suffix || "major");
  return family === "major" || family === "minor" || STABLE_ARRIVAL_SUFFIXES.has(parsed.suffix || "");
}

function isDominantToTarget(chord, targetRoot) {
  const targetPc = getPitchClass(targetRoot);
  const chordPc = getPitchClass(getChordRoot(chord));
  if (targetPc == null || chordPc == null) {
    return false;
  }

  const interval = (chordPc - targetPc + 12) % 12;
  const quality = getChordQuality(chord);
  const family = getQualityFamily(quality);
  return interval === 7 && (quality.includes("7") || family === "major" || family === "dim");
}

function isLeadingToneToTarget(chord, targetRoot) {
  const targetPc = getPitchClass(targetRoot);
  const chordPc = getPitchClass(getChordRoot(chord));
  if (targetPc == null || chordPc == null) {
    return false;
  }

  const interval = (chordPc - targetPc + 12) % 12;
  return interval === 11 && getQualityFamily(getChordQuality(chord)) === "dim";
}

function isPredominantToTarget(chord, targetRoot) {
  const targetPc = getPitchClass(targetRoot);
  const chordPc = getPitchClass(getChordRoot(chord));
  if (targetPc == null || chordPc == null) {
    return false;
  }

  const interval = (chordPc - targetPc + 12) % 12;
  const quality = getChordQuality(chord);
  const family = getQualityFamily(quality);
  return interval === 2 && (family === "minor" || family === "dim" || quality.includes("m7b5"));
}

function chordSupportsTargetCentre(chord, targetRoot) {
  if (!chord || !targetRoot) {
    return false;
  }

  const details = parseChordName(chord);
  if (!details) {
    return false;
  }

  const normalizedTarget = normaliseRoot(targetRoot);
  const root = normaliseRoot(details.root);
  const bass = details.bass ? normaliseRoot(details.bass) : null;
  return root === normalizedTarget || bass === normalizedTarget;
}

function getPitchClassDistance(fromPitchClass, toPitchClass) {
  if (!Number.isFinite(fromPitchClass) || !Number.isFinite(toPitchClass)) {
    return Infinity;
  }

  const forward = ((toPitchClass - fromPitchClass) + 12) % 12;
  const backward = ((fromPitchClass - toPitchClass) + 12) % 12;
  return Math.min(forward, backward);
}

function getChordPitchClasses(chord) {
  const parsed = parseChordName(chord);
  if (!parsed) {
    return [];
  }

  const rootPc = getPitchClass(parsed.root);
  if (rootPc == null) {
    return [];
  }

  const pitchClasses = parsed.intervals.map(interval => (rootPc + interval + 120) % 12);
  if (parsed.bass) {
    const bassPc = getPitchClass(parsed.bass);
    if (bassPc != null) {
      pitchClasses.push(bassPc);
    }
  }

  return [...new Set(pitchClasses)];
}

function evaluateTopNoteInfluence(progressionState, candidate) {
  if (!Number.isFinite(progressionState?.topNotePitchClass)) {
    return {
      bonus: 0,
      relation: "none",
      motionAssist: false,
      candidatePitchClasses: []
    };
  }

  const candidatePitchClasses = getChordPitchClasses(candidate);
  if (!candidatePitchClasses.length) {
    return {
      bonus: 0,
      relation: "none",
      motionAssist: false,
      candidatePitchClasses
    };
  }

  const closestTopNoteDistance = Math.min(
    ...candidatePitchClasses.map(pitchClass => getPitchClassDistance(progressionState.topNotePitchClass, pitchClass))
  );

  let bonus = 0;
  let relation = "far";
  if (candidatePitchClasses.includes(progressionState.topNotePitchClass)) {
    bonus += 5;
    relation = "contains top note";
  } else if (closestTopNoteDistance === 1) {
    bonus += 3;
    relation = "step from top note";
  } else if (closestTopNoteDistance === 2) {
    bonus += 2;
    relation = "near top note";
  } else if (closestTopNoteDistance <= 4) {
    bonus += 1;
    relation = "supports top note area";
  }

  let motionAssist = false;
  if (
    Number.isFinite(progressionState.topNoteMotion) &&
    Number.isFinite(progressionState.previousTopNotePitchClass) &&
    progressionState.topNoteMotion !== 0
  ) {
    const expectedPitchClasses = progressionState.topNoteMotion > 0
      ? [1, 2].map(step => (progressionState.topNotePitchClass + step) % 12)
      : [1, 2].map(step => (progressionState.topNotePitchClass - step + 12) % 12);
    if (candidatePitchClasses.some(pitchClass => expectedPitchClasses.includes(pitchClass))) {
      bonus += 1;
      motionAssist = true;
    }
  }

  if (bonus === 0) {
    if (progressionState.topNoteMotion === 0 && closestTopNoteDistance >= 3) {
      bonus -= 2;
      relation = "breaks held top note";
    } else if (closestTopNoteDistance >= 4) {
      bonus -= 1;
      relation = "pulls away from top note";
    }
  }

  return {
    bonus,
    relation,
    motionAssist,
    candidatePitchClasses
  };
}

function getTopVoicingContext(progressionItems, parsed) {
  const progressionEntries = Array.isArray(progressionItems)
    ? progressionItems.filter(item => item?.chord)
    : [];
  if (!progressionEntries.length || !parsed.length) {
    return null;
  }

  const lastItem = progressionEntries.at(-1);
  const lastVoicingNotes = Array.isArray(lastItem?.voicing?.notes) ? lastItem.voicing.notes : [];
  if (!lastVoicingNotes.length) {
    return null;
  }

  const lastTopMidi = Math.max(...lastVoicingNotes.map(note => Number(note?.midi)).filter(Number.isFinite));
  if (!Number.isFinite(lastTopMidi)) {
    return null;
  }

  let previousTopMidi = null;
  for (let index = progressionEntries.length - 2; index >= 0; index -= 1) {
    const notes = Array.isArray(progressionEntries[index]?.voicing?.notes) ? progressionEntries[index].voicing.notes : [];
    if (!notes.length) {
      continue;
    }

    const topMidi = Math.max(...notes.map(note => Number(note?.midi)).filter(Number.isFinite));
    if (Number.isFinite(topMidi)) {
      previousTopMidi = topMidi;
      break;
    }
  }

  const motion = Number.isFinite(previousTopMidi)
    ? lastTopMidi - previousTopMidi
    : null;
  const absMotion = Number.isFinite(motion) ? Math.abs(motion) : null;
  const motionLabel = !Number.isFinite(motion)
    ? "single voiced chord"
    : motion === 0
      ? "held"
      : absMotion <= 2
        ? `${motion > 0 ? "rising" : "falling"} by step`
        : `${motion > 0 ? "rising" : "falling"} by leap`;

  return {
    topNoteMidi: lastTopMidi,
    topNoteLabel: midiToDisplayNote(lastTopMidi),
    topNotePitchClass: ((lastTopMidi % 12) + 12) % 12,
    previousTopNoteMidi: Number.isFinite(previousTopMidi) ? previousTopMidi : null,
    previousTopNoteLabel: Number.isFinite(previousTopMidi) ? midiToDisplayNote(previousTopMidi) : null,
    previousTopNotePitchClass: Number.isFinite(previousTopMidi)
      ? ((previousTopMidi % 12) + 12) % 12
      : null,
    topNoteMotion: motion,
    topNoteMotionLabel: motionLabel
  };
}

function pitchClassToNote(pitchClass, preferFlats = false) {
  const noteNames = preferFlats ? FLAT_PITCH_CLASSES : SHARP_PITCH_CLASSES;
  return noteNames[((pitchClass % 12) + 12) % 12];
}

function buildRelativeChord(root, semitones, suffix = "", preferFlats = false) {
  const rootPc = getPitchClass(root);
  if (rootPc == null) {
    return null;
  }

  const targetRoot = pitchClassToNote(rootPc + semitones, preferFlats || semitones === 1 || semitones === 3 || semitones === 8 || semitones === 10);
  return canonicaliseTypedChord(`${targetRoot}${suffix}`);
}

function findChordByFunction(keyData, targetFunction) {
  return keyData.chords.find(chord => keyData.functions[chord] === targetFunction) || null;
}

function getSecondaryDominantChord(targetChord, suffix = "7") {
  const targetRoot = getChordRoot(targetChord);
  const targetPc = getPitchClass(targetRoot);
  if (targetPc == null) {
    return null;
  }

  const dominantRoot = pitchClassToNote(targetPc + 7, targetRoot.includes("b"));
  return canonicaliseTypedChord(`${dominantRoot}${suffix}`);
}

function pushUniqueSuggestionEntry(entries, entry) {
  if (!entry?.chord) {
    return;
  }

  const existingIndex = entries.findIndex(item => chordsEquivalent(item.chord, entry.chord));
  if (existingIndex === -1) {
    entries.push(entry);
    return;
  }

  if (
    entry.preferExact &&
    !entries[existingIndex].preferExact
  ) {
    entries[existingIndex] = entry;
    return;
  }

  if ((entry.score || 0) > (entries[existingIndex].score || 0)) {
    entries[existingIndex] = entry;
  }
}

function getChordSpecificityScore(chord) {
  const parsed = parseChordName(chord);
  if (!parsed) {
    return 0;
  }

  let score = 0;
  const suffix = String(parsed.suffix || "");

  if (suffix && suffix !== "major") {
    score += 1;
  }

  if (/\d/.test(suffix)) {
    score += 1;
  }

  if (/[#b]/.test(suffix) || /sus|add|Maj|dim|aug/.test(suffix)) {
    score += 1;
  }

  if (parsed.bass && parsed.bass !== parsed.root) {
    score += 2;
  }

  return score;
}

function isChordBlockedByBuckets(chord, buckets) {
  return buckets.some(bucket =>
    bucket.some(entry => chordsEquivalent(entry.chord, chord))
  );
}

function isInKeyCandidate(chord, keyData) {
  return Boolean(findMatchingDiatonicChord(chord, keyData));
}

function appendUniqueChords(list, chords, predicate = null) {
  (Array.isArray(chords) ? chords : []).forEach(chord => {
    if (!chord) {
      return;
    }

    if (typeof predicate === "function" && !predicate(chord)) {
      return;
    }

    if (!list.some(existing => chordsEquivalent(existing, chord))) {
      list.push(chord);
    }
  });
}

function getEntryChords(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map(entry => entry?.chord)
    .filter(Boolean);
}

function buildInKeyCandidates({ keyData, lastParsedChord, progressionState }) {
  const lastChord = lastParsedChord?.diatonicChord || lastParsedChord?.original || keyData.chords[0];
  const transitionCandidates = keyData.transitions[lastChord] || [];
  const ordered = [];
  const prioritizePreferredRoots = progressionState?.cadenceExpectation === "return to center";

  if (progressionState?.lastIsTonic && lastParsedChord?.original) {
    appendUniqueChords(ordered, [lastParsedChord.original], chord => isInKeyCandidate(chord, keyData));
  }
  if (prioritizePreferredRoots) {
    appendUniqueChords(ordered, progressionState?.preferredTargets, chord => isInKeyCandidate(chord, keyData));
    appendUniqueChords(ordered, getEntryChords(progressionState?.exactInKeyChords), chord => isInKeyCandidate(chord, keyData));
  } else {
    appendUniqueChords(ordered, getEntryChords(progressionState?.exactInKeyChords), chord => isInKeyCandidate(chord, keyData));
    appendUniqueChords(ordered, progressionState?.preferredTargets, chord => isInKeyCandidate(chord, keyData));
  }
  appendUniqueChords(ordered, getEntryChords(progressionState?.exactReopenCandidates), chord => isInKeyCandidate(chord, keyData));
  appendUniqueChords(ordered, getEntryChords(progressionState?.exactTensionCandidates), chord => isInKeyCandidate(chord, keyData));
  appendUniqueChords(ordered, getEntryChords(progressionState?.reopenCandidates), chord => isInKeyCandidate(chord, keyData));
  appendUniqueChords(ordered, getEntryChords(progressionState?.tensionCandidates), chord => isInKeyCandidate(chord, keyData));
  appendUniqueChords(ordered, getEntryChords(progressionState?.establishedInKeyChords), chord => isInKeyCandidate(chord, keyData));
  appendUniqueChords(ordered, transitionCandidates);
  appendUniqueChords(ordered, keyData.chords);

  return ordered;
}

function buildRelatedCandidates({ keyData, profile, progressionState }) {
  const candidates = [];

  profile.relatedRules.forEach(rule => {
    if (!appliesToCategory(rule, keyData)) {
      return;
    }

    const chord = buildRelativeChord(keyData.root, rule.interval, rule.suffix, true);
    if (!chord) {
      return;
    }

    pushUniqueSuggestionEntry(candidates, {
      chord,
      fn: rule.label,
      bucket: "related",
      ruleWeight: rule.weight || 0,
      ruleReason: rule.reason || ""
    });
  });

  (progressionState?.establishedBorrowedChords || []).forEach(entry => {
    const quality = getChordQuality(entry.chord);
    const family = getQualityFamily(quality);
    if (quality.includes("7") || family === "dim") {
      return;
    }

    pushUniqueSuggestionEntry(candidates, {
      chord: entry.chord,
      fn: "established colour",
      bucket: "related",
      ruleWeight: 6 + Math.min(3, Math.max(0, entry.count - 1)),
      ruleReason: "This colour already appears in the progression, so bringing it back reinforces the progression's own harmonic language."
    });
  });

  (progressionState?.exactBorrowedChords || []).forEach(entry => {
    const quality = getChordQuality(entry.chord);
    const family = getQualityFamily(quality);
    if (quality.includes("7") || family === "dim") {
      return;
    }

    pushUniqueSuggestionEntry(candidates, {
      chord: entry.chord,
      fn: "exact colour return",
      bucket: "related",
      preferExact: true,
      ruleWeight: 6 + Math.min(3, Math.max(0, entry.count - 1)),
      ruleReason: "This exact colour shape already appears in the progression, so bringing back the same spelling can sound more intentional than flattening it to a simpler chord."
    });
  });

  if (progressionState?.borrowedMinorGravity >= 4 && progressionState?.lastIsTonic) {
    const borrowedSubdominant = buildRelativeChord(keyData.root, 5, "m", true);
    if (borrowedSubdominant && !isInKeyCandidate(borrowedSubdominant, keyData)) {
      pushUniqueSuggestionEntry(candidates, {
        chord: borrowedSubdominant,
        fn: "iv return",
        bucket: "related",
        ruleWeight: 7,
        ruleReason: "After a minor-colour tonic landing, a borrowed minor iv can reopen the phrase without losing the darker harmonic language the progression has already established."
      });
    }
  }

  (progressionState?.preferredTargets || []).forEach(chord => {
    if (
      isInKeyCandidate(chord, keyData) ||
      String(getChordQuality(chord) || "").includes("7") ||
      getQualityFamily(getChordQuality(chord)) === "dim"
    ) {
      return;
    }

    pushUniqueSuggestionEntry(candidates, {
      chord,
      fn: "preferred colour",
      bucket: "related",
      ruleWeight: 5,
      ruleReason: "The progression analysis points toward this borrowed colour as a believable continuation."
    });
  });

  (progressionState?.reopenCandidates || []).forEach(entry => {
    if (isInKeyCandidate(entry.chord, keyData)) {
      return;
    }

    const quality = getChordQuality(entry.chord);
    if (quality.includes("7") || getQualityFamily(quality) === "dim") {
      return;
    }

    pushUniqueSuggestionEntry(candidates, {
      chord: entry.chord,
      fn: "reopen colour",
      bucket: "related",
      ruleWeight: 5 + Math.min(3, Math.max(0, (entry.count || 0) - 1)),
      ruleReason: "This borrowed colour has already reopened the loop in the progression, so bringing it back should feel connected rather than random."
    });
  });

  return candidates;
}

function buildOutsideCandidates({ keyData, profile, progressionState }) {
  const candidates = [];

  profile.outsideRules.forEach(rule => {
    if (rule.type === "secondaryDominants") {
      rule.targetFunctions.forEach(targetFunction => {
        const targetChord = findChordByFunction(keyData, targetFunction);
        if (!targetChord) {
          return;
        }

        const chord = getSecondaryDominantChord(targetChord, rule.suffix || "7");
        if (!chord) {
          return;
        }

        pushUniqueSuggestionEntry(candidates, {
          chord,
          fn: `V/${targetFunction}`,
          bucket: "outside",
          ruleWeight: rule.weight || 0,
          ruleReason: `${rule.reason || ""} Targets ${targetFunction}.`.trim(),
          targetFunction
        });
      });
      return;
    }

    if (!appliesToCategory(rule, keyData)) {
      return;
    }

    const chord = buildRelativeChord(keyData.root, rule.interval, rule.suffix, true);
    if (!chord) {
      return;
    }

    pushUniqueSuggestionEntry(candidates, {
      chord,
      fn: rule.label,
      bucket: "outside",
      ruleWeight: rule.weight || 0,
      ruleReason: rule.reason || ""
    });
  });

  (progressionState?.establishedBorrowedChords || []).forEach(entry => {
    const quality = getChordQuality(entry.chord);
    const family = getQualityFamily(quality);
    if (!quality.includes("7") && family !== "dim") {
      return;
    }

    pushUniqueSuggestionEntry(candidates, {
      chord: entry.chord,
      fn: "established tension",
      bucket: "outside",
      ruleWeight: 7 + Math.min(3, Math.max(0, entry.count - 1)),
      ruleReason: "This tension chord already appears in the progression, so reusing it can sound more convincing than introducing a brand-new chromatic move."
    });
  });

  (progressionState?.tensionCandidates || []).forEach(entry => {
    if (findMatchingDiatonicChord(entry.chord, keyData)) {
      return;
    }

    pushUniqueSuggestionEntry(candidates, {
      chord: entry.chord,
      fn: "cadence rebuild",
      bucket: "outside",
      ruleWeight: 6 + Math.min(2, Math.max(0, entry.count - 1)),
      ruleReason: "This chord has already helped build tension before a tonic landing in the current progression."
    });
  });

  (progressionState?.exactTensionCandidates || []).forEach(entry => {
    if (findMatchingDiatonicChord(entry.chord, keyData)) {
      return;
    }

    const quality = getChordQuality(entry.chord);
    if (!quality.includes("7") && getQualityFamily(quality) !== "dim") {
      return;
    }

    pushUniqueSuggestionEntry(candidates, {
      chord: entry.chord,
      fn: "exact cadence rebuild",
      bucket: "outside",
      preferExact: true,
      ruleWeight: 8 + Math.min(2, Math.max(0, (entry.count || 0) - 1)),
      ruleReason: "This exact tension shape has already led into a tonic landing in the progression, so reusing the same spelling preserves the progression's established cadence colour."
    });
  });

  (progressionState?.preferredTargets || []).forEach(chord => {
    if (isInKeyCandidate(chord, keyData)) {
      return;
    }

    const quality = getChordQuality(chord);
    if (!quality.includes("7") && getQualityFamily(quality) !== "dim") {
      return;
    }

    pushUniqueSuggestionEntry(candidates, {
      chord,
      fn: "preferred tension",
      bucket: "outside",
      ruleWeight: 7,
      ruleReason: "The progression analysis points toward this established tension colour as a believable next move."
    });
  });

  if (
    progressionState?.modeConfidence === "low" &&
    ((progressionState?.establishedBorrowedChords?.length || 0) > 0 || (progressionState?.tensionCandidates?.length || 0) > 0)
  ) {
    return candidates.filter(entry => {
      const isEstablishedBorrowed = (progressionState.establishedBorrowedChords || []).some(item =>
        chordsEquivalent(item?.chord, entry.chord) || chordsShareFamily(item?.chord, entry.chord)
      );
      const isEstablishedTension = (progressionState.tensionCandidates || []).some(item =>
        chordsEquivalent(item?.chord, entry.chord) || chordsShareFamily(item?.chord, entry.chord)
      );
      return isEstablishedBorrowed || isEstablishedTension || !String(entry?.fn || "").startsWith("V/");
    });
  }

  return candidates;
}

function getPhrasePositionLabel(chordCount, progressionContext = {}) {
  if (!chordCount) return "empty";
  if (progressionContext.lastIsTonic && progressionContext.recentCadence !== "none") {
    return "post-cadence";
  }
  if (progressionContext.lastIsTonic && chordCount >= 6) {
    return "loop restart point";
  }

  const cyclePosition = chordCount % 4;
  if (cyclePosition === 1) return "opening";
  if (cyclePosition === 2) return "development";
  if (cyclePosition === 3) return "turnaround";
  return "cadence point";
}

function buildWeightedChordEntries(map) {
  return [...map.values()].sort((a, b) => b.count - a.count || b.lastIndex - a.lastIndex);
}

function addWeightedChordEntry(map, chord, keyData, weight = 1, meta = {}) {
  const baseChord = getBaseChordLabel(chord);
  const signature = getChordFamilySignature(baseChord);
  if (!signature) {
    return;
  }

  const diatonicMatch = findMatchingDiatonicChord(baseChord, keyData);
  const existing = map.get(signature) || {
    chord: baseChord,
    count: 0,
    inKey: Boolean(diatonicMatch),
    function: normaliseFunctionLabel(diatonicMatch?.function || meta.function || ""),
    firstIndex: meta.index ?? 0,
    lastIndex: meta.index ?? 0
  };

  existing.count += weight;
  existing.inKey = existing.inKey || Boolean(diatonicMatch);
  if (!existing.function) {
    existing.function = normaliseFunctionLabel(diatonicMatch?.function || meta.function || "");
  }
  existing.firstIndex = Math.min(existing.firstIndex, meta.index ?? existing.firstIndex);
  existing.lastIndex = Math.max(existing.lastIndex, meta.index ?? existing.lastIndex);

  map.set(signature, existing);
}

function addExactChordEntry(map, chord, keyData, weight = 1, meta = {}) {
  const exactChord = canonicaliseTypedChord(chord);
  if (!exactChord) {
    return;
  }

  const diatonicMatch = findMatchingDiatonicChord(exactChord, keyData);
  const existing = map.get(exactChord) || {
    chord: exactChord,
    count: 0,
    inKey: Boolean(diatonicMatch),
    function: normaliseFunctionLabel(diatonicMatch?.function || meta.function || ""),
    firstIndex: meta.index ?? 0,
    lastIndex: meta.index ?? 0
  };

  existing.count += weight;
  existing.inKey = existing.inKey || Boolean(diatonicMatch);
  if (!existing.function) {
    existing.function = normaliseFunctionLabel(diatonicMatch?.function || meta.function || "");
  }
  existing.firstIndex = Math.min(existing.firstIndex, meta.index ?? existing.firstIndex);
  existing.lastIndex = Math.max(existing.lastIndex, meta.index ?? existing.lastIndex);

  map.set(exactChord, existing);
}

function collectProgressionVocabulary(parsed, keyData) {
  const entries = new Map();

  parsed.forEach((item, index) => {
    addWeightedChordEntry(entries, item?.original || item?.diatonicChord, keyData, 1, {
      index,
      function: item?.function
    });
  });

  return buildWeightedChordEntries(entries);
}

function collectExactProgressionVocabulary(parsed, keyData) {
  const entries = new Map();

  parsed.forEach((item, index) => {
    addExactChordEntry(entries, item?.original || item?.diatonicChord, keyData, 1, {
      index,
      function: item?.function
    });
  });

  return buildWeightedChordEntries(entries);
}

function isDominantToTonic(chord, keyData) {
  const tonicPc = getPitchClass(keyData?.root);
  const chordPc = getPitchClass(getChordRoot(chord));
  if (tonicPc == null || chordPc == null) {
    return false;
  }

  const interval = (chordPc - tonicPc + 12) % 12;
  const quality = getChordQuality(chord);
  const family = getQualityFamily(quality);
  return interval === 7 && (quality.includes("7") || family === "major" || family === "dim");
}

function isPredominantToTonic(chord, keyData) {
  const tonicPc = getPitchClass(keyData?.root);
  const chordPc = getPitchClass(getChordRoot(chord));
  if (tonicPc == null || chordPc == null) {
    return false;
  }

  const interval = (chordPc - tonicPc + 12) % 12;
  const quality = getChordQuality(chord);
  const family = getQualityFamily(quality);
  return interval === 2 && (family === "minor" || family === "dim" || quality.includes("m7b5"));
}

function detectCadenceSignals(parsed, keyData) {
  const tonicChord = keyData.chords[0];
  let cadenceCount = 0;
  let strongestCadence = "none";
  let latestCadence = "none";
  let strongestStrength = 0;

  for (let index = 1; index < parsed.length; index += 1) {
    const tonicLanding = parsed[index];
    if (!chordsShareFamily(tonicLanding?.original || tonicLanding?.diatonicChord, tonicChord)) {
      continue;
    }

    const dominantCandidate = parsed[index - 1];
    const predominantCandidate = parsed[index - 2];
    let cadenceType = "none";
    let cadenceStrength = 0;

    if (isDominantToTonic(dominantCandidate?.original, keyData)) {
      cadenceType = "dominant-tonic cadence";
      cadenceStrength = 2;

      if (isPredominantToTonic(predominantCandidate?.original, keyData)) {
        cadenceType = getQualityFamily(getChordQuality(tonicChord)) === "minor"
          ? "minor ii-V-i cadence"
          : "ii-V-I cadence";
        cadenceStrength = 3;
      }
    }

    if (cadenceType === "none") {
      continue;
    }

    cadenceCount += 1;
    if (cadenceStrength > strongestStrength) {
      strongestCadence = cadenceType;
      strongestStrength = cadenceStrength;
    }
    if (index === parsed.length - 1) {
      latestCadence = cadenceType;
    }
  }

  return {
    cadenceCount,
    strongestCadence,
    latestCadence,
    hasCadence: cadenceCount > 0
  };
}

function detectRecentArrival(parsed) {
  if (parsed.length < 2) {
    return {
      active: false,
      chord: null,
      exactChord: null,
      root: null,
      qualityFamily: null,
      confidence: "none",
      strength: 0,
      source: "none",
      targets: [],
      summary: ""
    };
  }

  const lastChord = parsed.at(-1)?.original || null;
  const lastDetails = parseChordName(lastChord);

  if (!lastDetails || !isStableArrivalChord(lastChord)) {
    return {
      active: false,
      chord: null,
      exactChord: null,
      root: null,
      qualityFamily: null,
      confidence: "none",
      strength: 0,
      source: "none",
      targets: [],
      summary: ""
    };
  }

  const qualityFamily = getQualityFamily(getChordQuality(lastChord));
  const lastRoot = lastDetails.root;
  const exactChord = getBaseChordLabel(lastChord);
  const simpleChord = canonicaliseTypedChord(`${lastRoot}${qualityFamily === "minor" ? "m" : ""}`);

  let strength = 0;
  let source = "none";
  let arrivalSourceIndex = -1;

  for (let index = parsed.length - 2; index >= Math.max(0, parsed.length - 5); index -= 1) {
    const sourceChord = parsed[index]?.original || null;
    if (!sourceChord) {
      continue;
    }

    if (isDominantToTarget(sourceChord, lastRoot)) {
      strength += 2;
      source = "dominant arrival";
      arrivalSourceIndex = index;
      break;
    }

    if (isLeadingToneToTarget(sourceChord, lastRoot)) {
      strength += 1;
      source = "leading-tone arrival";
      arrivalSourceIndex = index;
      break;
    }
  }

  if (strength <= 0 || arrivalSourceIndex < 0) {
    return {
      active: false,
      chord: null,
      exactChord: null,
      root: null,
      qualityFamily: null,
      confidence: "none",
      strength: 0,
      source: "none",
      targets: [],
      summary: ""
    };
  }

  const arrivalBridge = parsed
    .slice(arrivalSourceIndex + 1, parsed.length - 1)
    .map(item => item?.original || null)
    .filter(Boolean);
  const supportingBridgeCount = arrivalBridge.filter(chord => chordSupportsTargetCentre(chord, lastRoot)).length;

  if (arrivalBridge.length && supportingBridgeCount === 0) {
    return {
      active: false,
      chord: null,
      exactChord: null,
      root: null,
      qualityFamily: null,
      confidence: "none",
      strength: 0,
      source: "none",
      targets: [],
      summary: ""
    };
  }

  if (supportingBridgeCount > 0) {
    strength += Math.min(2, supportingBridgeCount);
    source = source === "dominant arrival" ? "sustained dominant arrival" : "sustained leading-tone arrival";
  }

  const preparationChord = parsed[arrivalSourceIndex - 1]?.original || null;
  if (preparationChord && isPredominantToTarget(preparationChord, lastRoot)) {
    strength += 1;
    source = source.includes("dominant") ? "predominant-dominant arrival" : "prepared arrival";
  }

  const targets = uniquePreferredTargets([
    exactChord,
    simpleChord,
    buildRelativeChord(lastRoot, 5, qualityFamily === "minor" ? "m" : ""),
    buildRelativeChord(lastRoot, 7, qualityFamily === "minor" ? "m" : ""),
    qualityFamily === "minor"
      ? buildRelativeChord(lastRoot, 8, "", true)
      : buildRelativeChord(lastRoot, 9, "m")
  ].filter(Boolean));
  const confidence = strength >= 4 ? "high" : "medium";

  return {
    active: true,
    chord: simpleChord || exactChord,
    exactChord,
    root: lastRoot,
    qualityFamily,
    confidence,
    strength,
    source,
    targets,
    summary: `${source} into ${exactChord || simpleChord || lastRoot}`
  };
}

function collectLoopAndTensionCandidates(parsed, keyData) {
  const tonicChord = keyData.chords[0];
  const reopenMap = new Map();
  const tensionMap = new Map();

  for (let index = 0; index < parsed.length - 1; index += 1) {
    const current = parsed[index];
    const next = parsed[index + 1];

    if (chordsShareFamily(current?.original || current?.diatonicChord, tonicChord) && next?.original) {
      addWeightedChordEntry(reopenMap, next.original, keyData, 2, {
        index: index + 1,
        function: next.function
      });
    }

    if (chordsShareFamily(next?.original || next?.diatonicChord, tonicChord) && current?.original) {
      addWeightedChordEntry(tensionMap, current.original, keyData, 2, {
        index,
        function: current.function
      });

      if (isDominantToTonic(current.original, keyData) && index > 0 && parsed[index - 1]?.original) {
        addWeightedChordEntry(tensionMap, parsed[index - 1].original, keyData, 1, {
          index: index - 1,
          function: parsed[index - 1].function
        });
      }
    }
  }

  return {
    reopenCandidates: buildWeightedChordEntries(reopenMap),
    tensionCandidates: buildWeightedChordEntries(tensionMap)
  };
}

function collectExactLoopAndTensionCandidates(parsed, keyData) {
  const reopenMap = new Map();
  const tensionMap = new Map();

  for (let index = 0; index < parsed.length - 1; index += 1) {
    const current = parsed[index];
    const next = parsed[index + 1];
    const currentBase = getBaseChordLabel(current?.original);
    const nextBase = getBaseChordLabel(next?.original);

    if (currentBase && next?.original && chordsShareFamily(currentBase, keyData.chords[0])) {
      addExactChordEntry(reopenMap, next.original, keyData, 2, {
        index: index + 1,
        function: next.function
      });
    }

    if (nextBase && current?.original && chordsShareFamily(nextBase, keyData.chords[0])) {
      addExactChordEntry(tensionMap, current.original, keyData, 2, {
        index,
        function: current.function
      });

      if (isDominantToTonic(current.original, keyData) && index > 0 && parsed[index - 1]?.original) {
        addExactChordEntry(tensionMap, parsed[index - 1].original, keyData, 1, {
          index: index - 1,
          function: parsed[index - 1].function
        });
      }
    }
  }

  return {
    exactReopenCandidates: buildWeightedChordEntries(reopenMap),
    exactTensionCandidates: buildWeightedChordEntries(tensionMap)
  };
}

function detectBorrowedMinorGravity(parsed, keyData) {
  const tonicPc = getPitchClass(keyData?.root);
  if (tonicPc == null) {
    return 0;
  }

  return parsed.reduce((total, item) => {
    if (item?.inKey) {
      return total;
    }

    const rootPc = getPitchClass(getChordRoot(item.original));
    if (rootPc == null) {
      return total + 1;
    }

    const interval = (rootPc - tonicPc + 12) % 12;
    const quality = getChordQuality(item.original);
    const family = getQualityFamily(quality);

    if (interval === 7 && (quality.includes("7") || family === "major")) {
      return total + 3;
    }
    if (interval === 8 || interval === 10) {
      return total + 2;
    }

    return total + 1;
  }, 0);
}

function getModeConfidenceLabel(parsedCount, inKeyCount, borrowedMinorGravity, establishedBorrowedCount) {
  if (!parsedCount) {
    return "high";
  }

  let confidence = inKeyCount / parsedCount;
  if (borrowedMinorGravity >= 4) {
    confidence -= 0.2;
  }
  if (establishedBorrowedCount >= 2) {
    confidence -= 0.15;
  }

  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

function uniquePreferredTargets(chords) {
  const targets = [];

  (Array.isArray(chords) ? chords : []).forEach(chord => {
    if (!chord || targets.some(existing => chordsEquivalent(existing, chord) || chordsShareFamily(existing, chord))) {
      return;
    }

    targets.push(chord);
  });

  return targets;
}

function getFunctionsFromEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map(entry => normaliseFunctionLabel(entry?.function || ""))
    .filter(Boolean);
}

function inferProgressionExpectation({
  lastParsedChord,
  normalizedLastFunction,
  keyData,
  modeConfidence,
  cadenceSignals,
  recentArrival,
  reopenCandidates,
  tensionCandidates,
  establishedBorrowedChords
}) {
  if (!lastParsedChord) {
    return {
      stability: "starting",
      cadenceExpectation: "establish",
      preferredFunctions: ["I", "i", "vi", "IV"],
      preferredTargets: [keyData.chords[0], keyData.chords[5], keyData.chords[3]].filter(Boolean),
      summaryNotes: [
        "No progression context yet, so the next suggestion should help establish a center."
      ]
    };
  }

  const tonicChord = keyData.chords[0];
  const lastIsTonic = chordsShareFamily(lastParsedChord.original || lastParsedChord.diatonicChord, tonicChord)
    || ["I", "i"].includes(normalizedLastFunction);
  const reopenTargets = reopenCandidates.map(entry => entry.chord);
  const tensionTargets = tensionCandidates.map(entry => entry.chord);
  const borrowedTargets = establishedBorrowedChords.map(entry => entry.chord);

  if (recentArrival?.active && !lastIsTonic) {
    return {
      stability: "recent arrival",
      cadenceExpectation: "expand around local centre",
      preferredFunctions: [],
      preferredTargets: uniquePreferredTargets(recentArrival.targets),
      summaryNotes: [
        `A recent arrival has just landed on ${recentArrival.exactChord || recentArrival.chord}.`,
        "The next move should usually confirm that arrival or expand away from it gently before resetting the wider key story."
      ]
    };
  }

  if (lastIsTonic && cadenceSignals.latestCadence !== "none") {
    return {
      stability: "cadential landing",
      cadenceExpectation: reopenTargets.length ? "reopen established loop" : "rebuild after cadence",
      preferredFunctions: getFunctionsFromEntries([...reopenCandidates, ...tensionCandidates]),
      preferredTargets: uniquePreferredTargets([
        ...reopenTargets,
        ...tensionTargets,
        ...borrowedTargets
      ]),
      summaryNotes: [
        `Latest cadence: ${cadenceSignals.latestCadence}.`,
        cadenceSignals.strongestCadence !== "none" && cadenceSignals.strongestCadence !== cadenceSignals.latestCadence
          ? `Strongest cadence family in memory: ${cadenceSignals.strongestCadence}.`
          : "The cadence memory and the latest landing agree.",
        reopenTargets.length
          ? "The next move will usually sound stronger if it reopens material the progression has already established."
          : "After the cadence, a loop restart or a tension rebuild is more convincing than a random new move."
      ].filter(Boolean)
    };
  }

  if (lastIsTonic && modeConfidence === "low") {
    return {
      stability: "mixed tonic",
      cadenceExpectation: "reopen established colours",
      preferredFunctions: getFunctionsFromEntries([...reopenCandidates, ...tensionCandidates]),
      preferredTargets: uniquePreferredTargets([
        ...reopenTargets,
        ...borrowedTargets,
        ...tensionTargets,
        keyData.chords[3],
        keyData.chords[6]
      ].filter(Boolean)),
      summaryNotes: [
        "The tonic is landing inside a mixed harmonic language rather than a pure mode-only loop.",
        "Reusing established colours is likely to sound stronger than abstract scale-only choices."
      ]
    };
  }

  if (!lastParsedChord.inKey) {
    return {
      stability: "borrowed",
      cadenceExpectation: "return to center",
      preferredFunctions: ["I", "i", "V", "v", "IV", "iv"],
      preferredTargets: [
        keyData.chords[0],
        keyData.chords.find(chord => ["V", "v"].includes(normaliseFunctionLabel(keyData.functions[chord]))),
        keyData.chords.find(chord => ["IV", "iv"].includes(normaliseFunctionLabel(keyData.functions[chord])))
      ].filter(Boolean),
      summaryNotes: [
        "The last chord sits outside the selected key.",
        "A stable return or a strong directional chord is likely to feel best next."
      ]
    };
  }

  if (["V", "v"].includes(normalizedLastFunction)) {
    return {
      stability: "tense",
      cadenceExpectation: "resolve",
      preferredFunctions: ["I", "i", "vi", "VI"],
      preferredTargets: [keyData.chords[0], keyData.chords[5]].filter(Boolean),
      summaryNotes: [
        "The progression is sitting on dominant tension.",
        "A release or deceptive landing is likely to sound convincing next."
      ]
    };
  }

  if (normalizedLastFunction.startsWith("ii")) {
    return {
      stability: "pre-dominant",
      cadenceExpectation: "push forward",
      preferredFunctions: ["V", "v", "VII"],
      preferredTargets: [
        keyData.chords.find(chord => ["V", "v"].includes(normaliseFunctionLabel(keyData.functions[chord]))),
        keyData.chords.find(chord => normaliseFunctionLabel(keyData.functions[chord]) === "VII")
      ].filter(Boolean),
      summaryNotes: [
        "The last chord feels like a setup chord rather than a destination.",
        "The next move should usually increase motion instead of resting."
      ]
    };
  }

  if (["IV", "iv"].includes(normalizedLastFunction)) {
    return {
      stability: "open",
      cadenceExpectation: "continue rising",
      preferredFunctions: ["V", "v", "I", "i"],
      preferredTargets: [
        keyData.chords.find(chord => ["V", "v"].includes(normaliseFunctionLabel(keyData.functions[chord]))),
        keyData.chords[0]
      ].filter(Boolean),
      summaryNotes: [
        "The progression is open and still moving.",
        "A dominant move or return to tonic should feel natural next."
      ]
    };
  }

  if (["I", "i"].includes(normalizedLastFunction)) {
    return {
      stability: "resolved",
      cadenceExpectation: "vary or reopen",
      preferredFunctions: getFunctionsFromEntries(reopenCandidates).length
        ? getFunctionsFromEntries(reopenCandidates)
        : ["vi", "VI", "ii", "IV", "iv"],
      preferredTargets: uniquePreferredTargets(
        reopenTargets.length
          ? [...reopenTargets, keyData.chords[3], keyData.chords[6]].filter(Boolean)
          : [keyData.chords[5], keyData.chords[1], keyData.chords[3]].filter(Boolean)
      ),
      summaryNotes: [
        "The progression currently feels settled.",
        "A reopening move is often more interesting than repeating the tonic."
      ]
    };
  }

  if (["vi", "VI"].includes(normalizedLastFunction)) {
    return {
      stability: "soft landing",
      cadenceExpectation: "expand",
      preferredFunctions: ["ii", "IV", "V", "v"],
      preferredTargets: [keyData.chords[1], keyData.chords[3], keyData.chords[4]].filter(Boolean),
      summaryNotes: [
        "The last chord feels like a softer landing than a full stop.",
        "The next move can either build onward or brighten the motion."
      ]
    };
  }

  return {
    stability: "moving",
    cadenceExpectation: "continue",
    preferredFunctions: ["IV", "V", "ii", "vi"],
    preferredTargets: [keyData.chords[3], keyData.chords[4], keyData.chords[1], keyData.chords[5]].filter(Boolean),
    summaryNotes: [
      "The progression is in motion without a strong cadence signal yet."
    ]
  };
}

function analyzeProgressionState(parsed, keyData, progression = "", progressionItems = []) {
  const recentParsed = parsed.slice(-4);
  const lastParsedChord = parsed.at(-1) || null;
  const lastChordDetails = lastParsedChord?.original ? parseChordName(lastParsedChord.original) : null;
  const slashBass = lastChordDetails?.bass ? normaliseRoot(lastChordDetails.bass) : null;
  const slashBassTarget = slashBass
    ? keyData.chords.find(chord => normaliseRoot(getChordRoot(chord)) === slashBass) || null
    : null;
  const recentFunctions = recentParsed
    .map(item => item.function)
    .filter(Boolean)
    .map(normaliseFunctionLabel);
  const normalizedLastFunction = normaliseFunctionLabel(lastParsedChord?.function || "");
  const vocabulary = collectProgressionVocabulary(parsed, keyData);
  const exactVocabulary = collectExactProgressionVocabulary(parsed, keyData);
  const establishedInKeyChords = vocabulary.filter(entry => entry.inKey && !chordsShareFamily(entry.chord, keyData.chords[0]));
  const establishedBorrowedChords = vocabulary.filter(entry => !entry.inKey);
  const exactInKeyChords = exactVocabulary.filter(entry => entry.inKey);
  const exactBorrowedChords = exactVocabulary.filter(entry => !entry.inKey);
  const { reopenCandidates, tensionCandidates } = collectLoopAndTensionCandidates(parsed, keyData);
  const { exactReopenCandidates, exactTensionCandidates } = collectExactLoopAndTensionCandidates(parsed, keyData);
  const topVoicingContext = getTopVoicingContext(progressionItems, parsed);
  const cadenceSignals = detectCadenceSignals(parsed, keyData);
  const recentArrival = detectRecentArrival(parsed);
  const inKeyCount = parsed.filter(item => item?.inKey).length;
  const borrowedMinorGravity = detectBorrowedMinorGravity(parsed, keyData);
  const modeConfidence = getModeConfidenceLabel(
    parsed.length,
    inKeyCount,
    borrowedMinorGravity,
    establishedBorrowedChords.length
  );
  const repeatedEnding =
    parsed.length >= 2 &&
    parsed.at(-1)?.original === parsed.at(-2)?.original;
  const expectation = inferProgressionExpectation({
    lastParsedChord,
    normalizedLastFunction,
    keyData,
    modeConfidence,
    cadenceSignals,
    recentArrival,
    reopenCandidates,
    tensionCandidates,
    establishedBorrowedChords
  });
  const summaryNotes = [...expectation.summaryNotes];
  const harmonicLanguage = borrowedMinorGravity >= 4
    ? "minor with borrowed colour"
    : modeConfidence === "high"
      ? "mostly mode-led"
      : "mixed modal language";

  if (repeatedEnding) {
    summaryNotes.push("The ending is currently repeating the same chord.");
  }

  if (cadenceSignals.hasCadence) {
    summaryNotes.push(
      `Cadence memory: latest ${cadenceSignals.latestCadence !== "none" ? cadenceSignals.latestCadence : "none"}, strongest ${cadenceSignals.strongestCadence}.`
    );
  }

  if (slashBass) {
    summaryNotes.push(
      slashBassTarget
        ? `Slash-bass cue ${slashBass} points toward ${slashBassTarget}.`
        : `Slash-bass cue ${slashBass} adds directional bass colour.`
    );
  }

  if (topVoicingContext?.topNoteLabel) {
    summaryNotes.push(
      topVoicingContext.previousTopNoteLabel
        ? `Top note memory: ${topVoicingContext.previousTopNoteLabel} to ${topVoicingContext.topNoteLabel} (${topVoicingContext.topNoteMotionLabel}).`
        : `Top note memory: ${topVoicingContext.topNoteLabel}.`
    );
  }

  if (recentArrival?.active) {
    summaryNotes.push(
      `Local-centre pull: ${recentArrival.exactChord || recentArrival.chord} (${recentArrival.confidence} confidence, ${recentArrival.source}).`
    );
  }

  return {
    progressionText: String(progression || "").trim(),
    parsedChordCount: parsed.length,
    lastChord: lastParsedChord?.original || null,
    lastFunction: normalizedLastFunction || null,
    lastIsTonic: Boolean(lastParsedChord && (
      chordsShareFamily(lastParsedChord.original || lastParsedChord.diatonicChord, keyData.chords[0]) ||
      ["I", "i"].includes(normalizedLastFunction)
    )),
    slashBass,
    slashBassTarget,
    topNoteLabel: topVoicingContext?.topNoteLabel || null,
    topNotePitchClass: topVoicingContext?.topNotePitchClass ?? null,
    previousTopNoteLabel: topVoicingContext?.previousTopNoteLabel || null,
    previousTopNotePitchClass: topVoicingContext?.previousTopNotePitchClass ?? null,
    topNoteMotion: topVoicingContext?.topNoteMotion ?? null,
    topNoteMotionLabel: topVoicingContext?.topNoteMotionLabel || "none",
    recentFunctions,
    repeatedEnding,
    uniqueRecentChordCount: getRecentUniqueCount(recentParsed),
    phrasePosition: getPhrasePositionLabel(parsed.length, {
      lastIsTonic: Boolean(lastParsedChord && (
        chordsShareFamily(lastParsedChord.original || lastParsedChord.diatonicChord, keyData.chords[0]) ||
        ["I", "i"].includes(normalizedLastFunction)
      )),
      recentCadence: cadenceSignals.latestCadence
    }),
    globalCenter: keyData.chords[0],
    modeConfidence,
    harmonicLanguage,
    borrowedChordCount: establishedBorrowedChords.reduce((total, entry) => total + entry.count, 0),
    borrowedMinorGravity,
    cadenceDetected: cadenceSignals.latestCadence !== "none" ? cadenceSignals.latestCadence : cadenceSignals.strongestCadence,
    latestCadence: cadenceSignals.latestCadence,
    strongestCadence: cadenceSignals.strongestCadence,
    establishedInKeyChords,
    establishedBorrowedChords,
    exactInKeyChords,
    exactBorrowedChords,
    reopenCandidates,
    tensionCandidates,
    exactReopenCandidates,
    exactTensionCandidates,
    localCenterActive: recentArrival.active,
    localCenterChord: recentArrival.chord,
    localCenterExactChord: recentArrival.exactChord,
    localCenterRoot: recentArrival.root,
    localCenterQualityFamily: recentArrival.qualityFamily,
    localCenterConfidence: recentArrival.confidence,
    localCenterSource: recentArrival.source,
    localCenterTargets: recentArrival.targets,
    stability: expectation.stability,
    cadenceExpectation: expectation.cadenceExpectation,
    preferredFunctions: expectation.preferredFunctions.map(normaliseFunctionLabel),
    preferredTargets: uniquePreferredTargets(expectation.preferredTargets),
    summaryNotes
  };
}

function getProgressionStateBonus({ progressionState, candidate, candidateFn, bucket }) {
  if (!progressionState) {
    return 0;
  }

  const normalizedCandidateFn = normaliseFunctionLabel(candidateFn || "");
  const candidateRoot = normaliseRoot(getChordRoot(candidate || ""));
  const candidateQualityFamily = getQualityFamily(getChordQuality(candidate || ""));
  const findMatchingEntry = entries =>
    (Array.isArray(entries) ? entries : []).find(entry =>
      chordsEquivalent(entry?.chord, candidate) || chordsShareFamily(entry?.chord, candidate)
    ) || null;
  const findExactEntry = entries =>
    (Array.isArray(entries) ? entries : []).find(entry => chordsEquivalent(entry?.chord, candidate)) || null;
  const findLiteralEntry = entries =>
    (Array.isArray(entries) ? entries : []).find(entry => entry?.chord === candidate) || null;
  const findSameRootEntry = entries =>
    (Array.isArray(entries) ? entries : []).find(entry =>
      normaliseRoot(getChordRoot(entry?.chord || "")) === candidateRoot
    ) || null;
  const preferredTargetEntry = findMatchingEntry(progressionState.preferredTargets.map(chord => ({ chord })));
  const establishedInKeyEntry = findMatchingEntry(progressionState.establishedInKeyChords);
  const establishedBorrowedEntry = findMatchingEntry(progressionState.establishedBorrowedChords);
  const exactInKeyEntry = findLiteralEntry(progressionState.exactInKeyChords);
  const exactBorrowedSpellEntry = findLiteralEntry(progressionState.exactBorrowedChords);
  const reopenEntry = findMatchingEntry(progressionState.reopenCandidates);
  const tensionEntry = findMatchingEntry(progressionState.tensionCandidates);
  const exactReopenEntry = findLiteralEntry(progressionState.exactReopenCandidates);
  const exactTensionSpellEntry = findLiteralEntry(progressionState.exactTensionCandidates);
  const exactBorrowedEntry = findExactEntry(progressionState.establishedBorrowedChords);
  const exactTensionEntry = findExactEntry(progressionState.tensionCandidates);
  const sameRootBorrowedEntry = findSameRootEntry(progressionState.establishedBorrowedChords);
  const sameRootTensionEntry = findSameRootEntry(progressionState.tensionCandidates);
  const sameAsLastChord = progressionState.lastChord && chordsEquivalent(progressionState.lastChord, candidate);
  const matchesLocalCenter = progressionState.localCenterActive
    && (progressionState.localCenterTargets || []).some(target =>
      chordsEquivalent(target, candidate) || chordsShareFamily(target, candidate)
    );
  const matchesGlobalCenter = progressionState.globalCenter
    && (chordsEquivalent(progressionState.globalCenter, candidate) || chordsShareFamily(progressionState.globalCenter, candidate));
  let bonus = 0;

  if (preferredTargetEntry) {
    bonus += progressionState.localCenterActive ? 6 : 4;
  }

  if (normalizedCandidateFn && progressionState.preferredFunctions.includes(normalizedCandidateFn)) {
    bonus += 3;
  }

  if (progressionState.repeatedEnding && progressionState.lastChord && candidate !== progressionState.lastChord) {
    bonus += 2;
  }

  if (sameAsLastChord) {
    const isHoldLandingCandidate = ["I", "i"].includes(normalizedCandidateFn)
      && ["resolved", "cadential landing"].includes(progressionState.stability);
    bonus -= isHoldLandingCandidate ? 4 : 10;
  }

  if (progressionState.stability === "resolved" && ["I", "i"].includes(normalizedCandidateFn)) {
    bonus -= 3;
  }

  if (progressionState.stability === "tense" && bucket === "outside" && !normalizedCandidateFn) {
    bonus -= 1;
  }

  if (progressionState.stability === "borrowed" && bucket === "inKey") {
    bonus += 2;
  }

  if (progressionState.localCenterActive) {
    if (matchesLocalCenter) {
      bonus += 8;
    }

    if (matchesGlobalCenter && !matchesLocalCenter) {
      bonus -= 5;
    }

    if (bucket === "outside" && !matchesLocalCenter) {
      bonus -= 4;
    } else if (bucket === "related" && matchesLocalCenter) {
      bonus += 3;
    }
  }

  if (progressionState.stability === "borrowed" && progressionState.cadenceExpectation === "return to center") {
    if (["I", "i"].includes(normalizedCandidateFn)) {
      bonus += 12;
    } else if (["V", "v"].includes(normalizedCandidateFn)) {
      bonus += 6;
    } else if (["IV", "iv"].includes(normalizedCandidateFn)) {
      bonus += 4;
    }

    if (bucket === "outside") {
      bonus -= 8;
    } else if (bucket === "related") {
      bonus -= 2;
    }
  }

  if (reopenEntry) {
    bonus += (progressionState.localCenterActive ? 2 : 4) + Math.min(2, Math.max(0, (reopenEntry.count || 0) - 1));
  }

  if (tensionEntry) {
    if (progressionState.stability === "borrowed" && progressionState.cadenceExpectation === "return to center") {
      bonus += bucket === "outside"
        ? 1
        : 1;
    } else if (progressionState.localCenterActive && !matchesLocalCenter) {
      bonus += bucket === "outside" ? 1 : 0;
    } else {
      bonus += bucket === "outside"
        ? 4 + Math.min(2, Math.max(0, (tensionEntry.count || 0) - 1))
        : 2;
    }
  }

  if (exactBorrowedEntry && bucket !== "inKey") {
    bonus += 4;
  }

  if (exactTensionEntry) {
    if (progressionState.stability === "borrowed" && progressionState.cadenceExpectation === "return to center") {
      bonus += bucket === "outside" ? 1 : 2;
    } else {
      bonus += bucket === "outside" ? 6 : 3;
    }
  }

  if (establishedInKeyEntry && bucket === "inKey") {
    bonus += (progressionState.localCenterActive && !matchesLocalCenter ? 1 : 2)
      + Math.min(2, Math.max(0, (establishedInKeyEntry.count || 0) - 1));
  }

  if (exactInKeyEntry && bucket === "inKey") {
    bonus += progressionState.localCenterActive && !matchesLocalCenter ? 1 : 3;
  }

  if (establishedBorrowedEntry && bucket !== "inKey") {
    bonus += (progressionState.localCenterActive && matchesLocalCenter ? 5 : 4)
      + Math.min(2, Math.max(0, (establishedBorrowedEntry.count || 0) - 1));
  }

  if (exactBorrowedSpellEntry && bucket !== "inKey") {
    bonus += 3;
  }

  if (exactReopenEntry) {
    bonus += 2;
  }

  if (exactTensionSpellEntry) {
    if (progressionState.stability === "borrowed" && progressionState.cadenceExpectation === "return to center") {
      bonus += bucket === "outside" ? 0 : 1;
    } else if (progressionState.localCenterActive && !matchesLocalCenter) {
      bonus += 0;
    } else {
      bonus += bucket === "outside" ? 4 : 2;
    }
  }

  if (progressionState.localCenterActive && progressionState.cadenceExpectation === "expand around local centre") {
    if (matchesLocalCenter) {
      bonus += 6;
    } else if (bucket === "outside") {
      bonus -= 4;
    }
  }

  if (progressionState.phrasePosition === "turnaround") {
    if (matchesLocalCenter || ["I", "i", "IV", "iv", "V", "v", "VI", "vi"].includes(normalizedCandidateFn)) {
      bonus += 2;
    } else if (bucket === "outside") {
      bonus -= 2;
    }
  }

  if (progressionState.modeConfidence === "low" && !establishedInKeyEntry && !establishedBorrowedEntry && !reopenEntry && !tensionEntry) {
    if (candidateQualityFamily === "dim") {
      bonus -= 4;
    } else if (bucket === "outside") {
      bonus -= 3;
    } else if (bucket === "inKey") {
      bonus -= 1;
    }
  }

  if (progressionState.borrowedMinorGravity >= 4 && candidateQualityFamily === "dim" && !establishedInKeyEntry) {
    bonus -= 2;
  }

  if (progressionState.modeConfidence === "low" && !exactBorrowedEntry && !exactTensionEntry) {
    if (sameRootTensionEntry && !tensionEntry) {
      bonus -= 3;
    }

    if (sameRootBorrowedEntry && !establishedBorrowedEntry) {
      bonus -= 2;
    }
  }

  if (progressionState.parsedChordCount <= 1) {
    if (bucket === "outside") {
      bonus -= 9;
    } else if (bucket === "related") {
      bonus -= 3;
    } else if (bucket === "inKey") {
      bonus += 2;
    }
  }

  if (progressionState.modeConfidence === "high" && !progressionState.borrowedChordCount) {
    if (bucket === "outside") {
      bonus -= 6;
    } else if (bucket === "related") {
      bonus -= 2;
    } else if (bucket === "inKey") {
      bonus += 1;
    }
  }

  if (
    progressionState.cadenceExpectation === "establish" ||
    progressionState.cadenceExpectation === "continue rising"
  ) {
    if (bucket === "outside") {
      bonus -= 3;
    } else if (bucket === "inKey" && normalizedCandidateFn) {
      bonus += 1;
    }
  }

  if (progressionState.slashBass && candidateRoot === progressionState.slashBass) {
    bonus += 6;

    if (progressionState.slashBassTarget && chordsEquivalent(progressionState.slashBassTarget, candidate)) {
      bonus += 8;
    }

    if (candidateQualityFamily === "minor") {
      bonus += 1;
    }
  }

  const topNoteInfluence = evaluateTopNoteInfluence(progressionState, candidate);
  bonus += topNoteInfluence.bonus;

  if (
    progressionState.localCenterActive &&
    !matchesLocalCenter &&
    !matchesGlobalCenter &&
    topNoteInfluence.bonus < 0
  ) {
    bonus += topNoteInfluence.bonus;
  }

  return bonus;
}

function getRecentUniqueCount(chords) {
  return new Set(chords.map(chord => chord.original)).size;
}

function getCadenceBonus(romanHistory, candidateFn) {
  const last = romanHistory.at(-1);
  const secondLast = romanHistory.at(-2);

  if (last === "V" && candidateFn === "I") return 5;
  if (last === "v" && candidateFn === "i") return 5;
  if (secondLast === "ii" && last === "V" && candidateFn === "I") return 7;
  if (secondLast === "ii°" && last === "v" && candidateFn === "i") return 7;
  if (secondLast === "IV" && last === "V" && candidateFn === "I") return 6;
  if (secondLast === "iv" && last === "v" && candidateFn === "i") return 6;
  if (last === "IV" && candidateFn === "V") return 2;
  if (last === "iv" && candidateFn === "v") return 2;
  if (last === "vi" && ["ii", "IV", "V"].includes(candidateFn)) return 2;
  if (last === "VI" && ["III", "iv", "VII"].includes(candidateFn)) return 2;

  return 0;
}

function getPatternBonus(parsedProgression, candidate, romanHistory, candidateFn) {
  const romanTwo = romanHistory.slice(-2).join("|");
  const romanThree = romanHistory.slice(-3).join("|");

  const chordPatterns = {
    "I|vi": new Set(["IV", "ii"]),
    "vi|IV": new Set(["V", "I"]),
    "IV|V": new Set(["I", "vi"]),
    "ii|V": new Set(["I", "vi"]),
    "i|VI": new Set(["III", "iv", "VII"]),
    "VI|III": new Set(["VII", "iv"]),
    "III|VII": new Set(["i", "VI"])
  };

  const longerPatterns = {
    "I|vi|IV": new Set(["V", "ii"]),
    "vi|IV|V": new Set(["I"]),
    "i|VI|III": new Set(["VII", "iv"]),
    "III|VII|i": new Set(["iv", "VI"])
  };

  let bonus = 0;

  if (chordPatterns[romanTwo]?.has(candidateFn)) {
    bonus += 2;
  }

  if (longerPatterns[romanThree]?.has(candidateFn)) {
    bonus += 3;
  }

  if (parsedProgression.length >= 2) {
    const repeatedEnding =
      parsedProgression[parsedProgression.length - 1].original ===
      parsedProgression[parsedProgression.length - 2].original;

    if (repeatedEnding && candidate !== parsedProgression[parsedProgression.length - 1].original) {
      bonus += 1;
    }
  }

  if (parsedProgression.length >= 3) {
    const lastThreeUnique = new Set(
      parsedProgression.slice(-3).map(item => item.original)
    ).size;

    if (lastThreeUnique === 1 && candidate !== parsedProgression[parsedProgression.length - 1].original) {
      bonus += 2;
    }
  }

  return bonus;
}

function getRepetitionPenalty(parsedProgression, candidate) {
  if (!parsedProgression.length) return 0;

  let penalty = 0;
  const originals = parsedProgression.map(item => item.original);
  const last = originals.at(-1);
  const lastTwo = originals.slice(-2);

  if (candidate === last) {
    penalty += 3;
  }

  if (lastTwo.length === 2 && lastTwo.every(chord => chord === candidate)) {
    penalty += 5;
  }

  const occurrences = originals.filter(chord => chord === candidate).length;
  if (occurrences >= 2) {
    penalty += 1;
  }

  const uniqueCount = getRecentUniqueCount(parsedProgression.slice(-4));
  if (uniqueCount <= 2 && candidate === last) {
    penalty += 2;
  }

  return penalty;
}

function getBorrowedResolutionBonus(lastParsedChord, candidate, keyData) {
  if (!lastParsedChord || lastParsedChord.inKey) return 0;

  const tonic = keyData.chords[0];
  const dominant = keyData.chords.find(chord => {
    const fn = keyData.functions[chord];
    return fn === "V" || fn === "v";
  });
  const subdominant = keyData.chords.find(chord => {
    const fn = keyData.functions[chord];
    return fn === "IV" || fn === "iv";
  });

  if (candidate === tonic) return 4;
  if (candidate === dominant) return 3;
  if (candidate === subdominant) return 2;

  return 0;
}

function isChordInversion(chord) {
  const parsed = parseChordName(chord || "");
  return Boolean(parsed?.bass && normaliseRoot(parsed.bass) !== normaliseRoot(parsed.root));
}

function getSuggestionPriorityScore(entry) {
  const parsed = parseChordName(entry?.chord || "");
  const normalizedFn = normaliseFunctionLabel(entry?.fn || "");
  const isInversion = Boolean(parsed?.bass && normaliseRoot(parsed.bass) !== normaliseRoot(parsed.root));
  let priority = (entry?.score || 0) + (getChordSpecificityScore(entry?.chord) * 0.75);

  if (entry?.progressionState?.localCenterActive) {
    const matchesLocalCenter = (entry.progressionState.localCenterTargets || []).some(target =>
      chordsEquivalent(target, entry.chord) || chordsShareFamily(target, entry.chord)
    );

    if (matchesLocalCenter) {
      priority += 4;
    }

    if (entry?.inKey && isInversion) {
      priority -= 2;
    }
  }

  if (entry?.progressionState?.stability === "borrowed" && entry?.progressionState?.cadenceExpectation === "return to center") {
    if (entry?.inKey && isInversion) {
      priority -= 5;
    }

    if (entry?.inKey && !isInversion && ["I", "i", "V", "v"].includes(normalizedFn)) {
      priority += 4;
    }
  }

  return priority;
}

function shouldPreferRootRepresentative(candidate, candidates) {
  const progressionState = candidate?.progressionState;
  if (!progressionState || progressionState.stability !== "borrowed" || progressionState.cadenceExpectation !== "return to center") {
    return false;
  }

  if (!candidate?.inKey || !isChordInversion(candidate.chord)) {
    return false;
  }

  const preferredTargetFamily = progressionState.preferredTargets?.some(target => chordsShareFamily(target, candidate.chord));
  if (!preferredTargetFamily) {
    return false;
  }

  return candidates.some(entry =>
    entry !== candidate &&
    !entry?.suppressed &&
    entry?.inKey &&
    chordsShareFamily(entry.chord, candidate.chord) &&
    !isChordInversion(entry.chord)
  );
}

function shouldSuppressRepeatedSuggestion({ progressionState, candidate, candidateFn }) {
  if (!progressionState?.lastChord || !candidate || !chordsEquivalent(progressionState.lastChord, candidate)) {
    return false;
  }

  const normalizedCandidateFn = normaliseFunctionLabel(candidateFn || "");
  const isHoldLandingCandidate = ["I", "i"].includes(normalizedCandidateFn)
    && ["resolved", "cadential landing"].includes(progressionState.stability);
  const isLocalArrivalHold = progressionState.localCenterActive
    && (progressionState.localCenterTargets || []).some(target =>
      chordsEquivalent(target, candidate) || chordsShareFamily(target, candidate)
    );

  return !isHoldLandingCandidate && !isLocalArrivalHold;
}

function getMoodFunctionWeight(profile, candidateFn, boostedFunctions) {
  if (!candidateFn) return 0;

  const normalized = normaliseFunctionLabel(candidateFn);
  const boosted = boostedFunctions.includes(candidateFn) || boostedFunctions.includes(normalized) ? 2 : 0;
  return (profile.functionWeights?.[candidateFn] || profile.functionWeights?.[normalized] || 0) + boosted;
}

function buildScoreBreakdown(parts) {
  return parts
    .map(part => `${part.value >= 0 ? "+" : ""}${part.value} ${part.label}`)
    .join(", ");
}

function buildReasonParts({
  lastChord,
  candidate,
  candidateFn,
  bucket,
  bucketTitle,
  profileSummary,
  theoryReason,
  cadenceBonus,
  patternBonus,
  moodMatched,
  moodWeight,
  borrowedResolutionBonus,
  functionDescriptions,
  moodReasonText,
  feeling,
  scoreBreakdown,
  cameAfterBorrowedChord,
  isOutsideKeyCandidate,
  progressionState
}) {
  const parts = [];

  if (lastChord) {
    parts.push(`Flows naturally from ${lastChord}.`);
  }

  if (bucketTitle) {
    parts.push(`${bucketTitle} suggestion.`);
  }

  if (cameAfterBorrowedChord) {
    parts.push("The previous chord sits outside the selected key, so this tries to steer the progression back into a stable path.");
  }

  if (theoryReason) {
    parts.push(theoryReason);
  }

  if (cadenceBonus >= 5) {
    parts.push("Strong cadence option that can complete the phrase.");
  } else if (cadenceBonus > 0) {
    parts.push("Helps move the progression forward.");
  }

  if (patternBonus >= 3) {
    parts.push("Fits a familiar progression shape.");
  } else if (patternBonus > 0) {
    parts.push("Adds a sensible bit of variation.");
  }

  if (borrowedResolutionBonus > 0) {
    parts.push("Works well as a return from borrowed harmony.");
  }

  if (candidateFn && functionDescriptions[candidateFn]) {
    parts.push(functionDescriptions[candidateFn]);
  } else if (isOutsideKeyCandidate) {
    parts.push("This sits outside the selected key, so it is treated as colour rather than a fixed diatonic function.");
  }

  if (moodMatched && moodReasonText[feeling]) {
    parts.push(moodReasonText[feeling]);
  }

  if (!moodMatched && moodWeight > 0 && profileSummary) {
    parts.push(profileSummary);
  }

  if (progressionState?.summaryNotes?.length) {
    parts.push(`Progression read: ${progressionState.summaryNotes[0]}`);
  }

  if (candidate === lastChord) {
    parts.push("This repeats the same chord, so it was marked down.");
  }

  return `${parts.join(" ")} [score ${scoreBreakdown}]`;
}

export function parseProgression(input, keyData) {
  const rawTokens = String(input || "")
    .split(/[,|\n]+/)
    .map(part => part.trim())
    .filter(Boolean);

  const parsed = [];
  const invalid = [];

  rawTokens.forEach(token => {
    const canonical = canonicaliseTypedChord(token);

    if (!canonical) {
      invalid.push(token);
      return;
    }

    const diatonicMatch = findMatchingDiatonicChord(canonical, keyData);

    parsed.push({
      typed: token,
      original: canonical,
      diatonicChord: diatonicMatch?.diatonicChord || null,
      inKey: Boolean(diatonicMatch),
      function: diatonicMatch ? diatonicMatch.function : null
    });
  });

  return { parsed, invalid };
}

function createInKeySuggestion({
  candidate,
  parsed,
  romanHistory,
  profile,
  boostedFunctions,
  lastParsedChord,
  lastDisplayChord,
  keyData,
  functionDescriptions,
  moodReasonText,
  feeling,
  progressionState
}) {
  const diatonicMatch = findMatchingDiatonicChord(candidate, keyData);
  const candidateDisplay = candidate;
  const candidateFn = diatonicMatch?.function || null;
  const cadenceBonus = candidateFn ? getCadenceBonus(romanHistory, candidateFn) : 0;
  const patternBonus = candidateFn ? getPatternBonus(parsed, candidateDisplay, romanHistory, candidateFn) : 0;
  const moodWeight = getMoodFunctionWeight(profile, candidateFn, boostedFunctions);
  const repetitionPenalty = getRepetitionPenalty(parsed, candidateDisplay);
  const borrowedResolutionBonus = getBorrowedResolutionBonus(lastParsedChord, candidateDisplay, keyData);
  const topNoteInfluence = evaluateTopNoteInfluence(progressionState, candidateDisplay);
  const progressionStateBonus = getProgressionStateBonus({
    progressionState,
    candidate: candidateDisplay,
    candidateFn,
    bucket: "inKey"
  });
  const score = 12 + moodWeight + cadenceBonus + patternBonus + borrowedResolutionBonus + progressionStateBonus - repetitionPenalty;
  const scoreBreakdown = buildScoreBreakdown([
    { value: 12, label: "base" },
    { value: moodWeight, label: "mood" },
    { value: cadenceBonus, label: "cadence" },
    { value: patternBonus, label: "pattern" },
    { value: borrowedResolutionBonus, label: "borrowed return" },
    { value: topNoteInfluence.bonus, label: "top note" },
    { value: progressionStateBonus, label: "progression" },
    { value: -repetitionPenalty, label: "repeat" }
  ]);

  return {
    chord: candidateDisplay,
    fn: candidateFn || "in key",
    score,
    suppressed: shouldSuppressRepeatedSuggestion({
      progressionState,
      candidate: candidateDisplay,
      candidateFn
    }),
    inKey: true,
    bucket: "inKey",
    topNoteBonus: topNoteInfluence.bonus,
    topNoteRelation: topNoteInfluence.relation,
    topNoteMotionAssist: topNoteInfluence.motionAssist,
    progressionState,
    reason: buildReasonParts({
      lastChord: lastDisplayChord,
      candidate: candidateDisplay,
      candidateFn,
      bucket: "inKey",
      bucketTitle: getBucketMeta("inKey").title,
      profileSummary: profile.summary,
      theoryReason: "",
      cadenceBonus,
      patternBonus,
      moodMatched: moodWeight > 0,
      moodWeight,
      borrowedResolutionBonus,
      functionDescriptions,
      moodReasonText,
      feeling,
      scoreBreakdown,
      cameAfterBorrowedChord: Boolean(lastParsedChord && !lastParsedChord.inKey),
      isOutsideKeyCandidate: false,
      progressionState
    })
  };
}

function createBucketSuggestion({
  entry,
  parsed,
  profile,
  lastParsedChord,
  lastDisplayChord,
  keyData,
  functionDescriptions,
  moodReasonText,
  feeling,
  progressionState
}) {
  const repetitionPenalty = getRepetitionPenalty(parsed, entry.chord);
  const diatonicMatch = findMatchingDiatonicChord(entry.chord, keyData);
  const candidateFn = diatonicMatch?.function || null;
  const targetWeight = entry.targetFunction
    ? (profile.functionWeights?.[entry.targetFunction] || 0)
    : 0;
  const topNoteInfluence = evaluateTopNoteInfluence(progressionState, entry.chord);
  const progressionStateBonus = getProgressionStateBonus({
    progressionState,
    candidate: entry.chord,
    candidateFn,
    bucket: entry.bucket
  });
  const score = 10 + (entry.ruleWeight || 0) + Math.max(0, targetWeight) + progressionStateBonus - repetitionPenalty;
  const scoreBreakdown = buildScoreBreakdown([
    { value: 10, label: "base" },
    { value: entry.ruleWeight || 0, label: "theory" },
    { value: Math.max(0, targetWeight), label: "target" },
    { value: topNoteInfluence.bonus, label: "top note" },
    { value: progressionStateBonus, label: "progression" },
    { value: -repetitionPenalty, label: "repeat" }
  ]);

  return {
    chord: entry.chord,
    fn: entry.fn,
    score,
    suppressed: shouldSuppressRepeatedSuggestion({
      progressionState,
      candidate: entry.chord,
      candidateFn
    }),
    inKey: Boolean(diatonicMatch),
    bucket: entry.bucket,
    topNoteBonus: topNoteInfluence.bonus,
    topNoteRelation: topNoteInfluence.relation,
    topNoteMotionAssist: topNoteInfluence.motionAssist,
    progressionState,
    reason: buildReasonParts({
      lastChord: lastDisplayChord,
      candidate: entry.chord,
      candidateFn,
      bucket: entry.bucket,
      bucketTitle: getBucketMeta(entry.bucket).title,
      profileSummary: profile.summary,
      theoryReason: entry.ruleReason,
      cadenceBonus: 0,
      patternBonus: 0,
      moodMatched: true,
      moodWeight: entry.ruleWeight || 0,
      borrowedResolutionBonus: 0,
      functionDescriptions,
      moodReasonText,
      feeling,
      scoreBreakdown,
      cameAfterBorrowedChord: Boolean(lastParsedChord && !lastParsedChord.inKey),
      isOutsideKeyCandidate: !diatonicMatch,
      progressionState
    })
  };
}

function selectTopBucketSuggestions(candidates, limit = 3) {
  const selected = [];
  const sorted = [...candidates]
    .filter(candidate => !candidate?.suppressed)
    .sort((a, b) => getSuggestionPriorityScore(b) - getSuggestionPriorityScore(a) || (b.score || 0) - (a.score || 0));

  sorted.forEach(candidate => {
    if (selected.length >= limit) {
      return;
    }

    if (shouldPreferRootRepresentative(candidate, sorted)) {
      return;
    }

    if (selected.some(entry => chordsShareFamily(entry.chord, candidate.chord))) {
      return;
    }

    selected.push(candidate);
  });

  return selected;
}

export function getSuggestions({
  musicData,
  moodBoosts,
  functionDescriptions,
  moodReasonText,
  selectedKey,
  progression,
  feeling,
  progressionItems = []
}) {
  const keyData = musicData[selectedKey];

  if (!keyData) {
    return {
      suggestions: [],
      parsedProgression: [],
      invalidChords: ["Unknown key"]
    };
  }

  const { parsed, invalid } = parseProgression(progression, keyData);
  const boostedFunctions = moodBoosts[feeling] || [];
  const profile = getMoodProfile(feeling);
  const lastParsedChord = parsed.at(-1);
  const lastDisplayChord = lastParsedChord?.original || keyData.chords[0];
  const romanHistory = parsed.map(item => item.function).filter(Boolean);
  const progressionState = analyzeProgressionState(parsed, keyData, progression, progressionItems);

  if (!parsed.length) {
    return {
      suggestions: [],
      parsedProgression: [],
      invalidChords: invalid,
      lastChord: null,
      progressionState
    };
  }

  const scoredInKeySuggestions = buildInKeyCandidates({ keyData, lastParsedChord, progressionState }).map(candidate =>
      createInKeySuggestion({
        candidate,
        parsed,
        romanHistory,
        profile,
        boostedFunctions,
        lastParsedChord,
        lastDisplayChord,
        keyData,
        functionDescriptions,
        moodReasonText,
        feeling,
        progressionState
      })
  );
  const inKeySuggestions = selectTopBucketSuggestions(scoredInKeySuggestions, MAX_BUCKET_SUGGESTIONS);

  const scoredRelatedSuggestions = buildRelatedCandidates({ keyData, profile, progressionState })
      .filter(entry => !isChordBlockedByBuckets(entry.chord, [inKeySuggestions]))
      .map(entry =>
        createBucketSuggestion({
          entry,
          parsed,
          profile,
          lastParsedChord,
          lastDisplayChord,
          keyData,
          functionDescriptions,
          moodReasonText,
          feeling,
          progressionState
        })
      );
  const relatedSuggestions = selectTopBucketSuggestions(scoredRelatedSuggestions, MAX_BUCKET_SUGGESTIONS);

  const scoredOutsideSuggestions = buildOutsideCandidates({ keyData, profile, progressionState })
      .filter(entry => !isChordBlockedByBuckets(entry.chord, [inKeySuggestions, relatedSuggestions]))
      .map(entry =>
        createBucketSuggestion({
          entry,
          parsed,
          profile,
          lastParsedChord,
          lastDisplayChord,
          keyData,
          functionDescriptions,
          moodReasonText,
          feeling,
          progressionState
        })
      );
  const outsideSuggestions = selectTopBucketSuggestions(scoredOutsideSuggestions, MAX_BUCKET_SUGGESTIONS);

  const suggestions = [
    ...inKeySuggestions,
    ...relatedSuggestions,
    ...outsideSuggestions
  ];

  return {
    suggestions,
    candidatePools: {
      inKey: selectTopBucketSuggestions(scoredInKeySuggestions, 8),
      related: selectTopBucketSuggestions(scoredRelatedSuggestions, 8),
      outside: selectTopBucketSuggestions(scoredOutsideSuggestions, 8)
    },
    parsedProgression: parsed,
    invalidChords: invalid,
    lastChord: lastParsedChord?.diatonicChord || lastParsedChord?.original || keyData.chords[0],
    progressionState
  };
}
