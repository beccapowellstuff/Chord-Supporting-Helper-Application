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
import { NOTE_TO_PC, normaliseRoot, parseChordName } from "./chordNotes.js";

const SHARP_PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_PITCH_CLASSES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
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
  const diminishedLike = new Set(["dim", "m7b5b13", "m7b5b9b13"]);
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

  if ((entry.score || 0) > (entries[existingIndex].score || 0)) {
    entries[existingIndex] = entry;
  }
}

function isChordBlockedByBuckets(chord, buckets) {
  return buckets.some(bucket =>
    bucket.some(entry => chordsEquivalent(entry.chord, chord))
  );
}

function buildInKeyCandidates({ keyData, lastParsedChord }) {
  const lastChord = lastParsedChord?.diatonicChord || lastParsedChord?.original || keyData.chords[0];
  const transitionCandidates = keyData.transitions[lastChord] || [];
  const ordered = [
    ...transitionCandidates,
    ...keyData.chords.filter(chord => !transitionCandidates.some(item => chordsEquivalent(item, chord)))
  ];

  return ordered.filter((candidate, index, array) =>
    array.findIndex(item => chordsEquivalent(item, candidate)) === index
  );
}

function buildRelatedCandidates({ keyData, profile }) {
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

  return candidates;
}

function buildOutsideCandidates({ keyData, profile }) {
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

  return candidates;
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
  isOutsideKeyCandidate
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
  feeling
}) {
  const diatonicMatch = findMatchingDiatonicChord(candidate, keyData);
  const candidateDisplay = diatonicMatch?.diatonicChord || candidate;
  const candidateFn = diatonicMatch?.function || null;
  const cadenceBonus = candidateFn ? getCadenceBonus(romanHistory, candidateFn) : 0;
  const patternBonus = candidateFn ? getPatternBonus(parsed, candidateDisplay, romanHistory, candidateFn) : 0;
  const moodWeight = getMoodFunctionWeight(profile, candidateFn, boostedFunctions);
  const repetitionPenalty = getRepetitionPenalty(parsed, candidateDisplay);
  const borrowedResolutionBonus = getBorrowedResolutionBonus(lastParsedChord, candidateDisplay, keyData);
  const score = 12 + moodWeight + cadenceBonus + patternBonus + borrowedResolutionBonus - repetitionPenalty;
  const scoreBreakdown = buildScoreBreakdown([
    { value: 12, label: "base" },
    { value: moodWeight, label: "mood" },
    { value: cadenceBonus, label: "cadence" },
    { value: patternBonus, label: "pattern" },
    { value: borrowedResolutionBonus, label: "borrowed return" },
    { value: -repetitionPenalty, label: "repeat" }
  ]);

  return {
    chord: candidateDisplay,
    fn: candidateFn || "in key",
    score,
    inKey: true,
    bucket: "inKey",
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
      isOutsideKeyCandidate: false
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
  feeling
}) {
  const repetitionPenalty = getRepetitionPenalty(parsed, entry.chord);
  const diatonicMatch = findMatchingDiatonicChord(entry.chord, keyData);
  const candidateFn = diatonicMatch?.function || null;
  const targetWeight = entry.targetFunction
    ? (profile.functionWeights?.[entry.targetFunction] || 0)
    : 0;
  const score = 10 + (entry.ruleWeight || 0) + Math.max(0, targetWeight) - repetitionPenalty;
  const scoreBreakdown = buildScoreBreakdown([
    { value: 10, label: "base" },
    { value: entry.ruleWeight || 0, label: "theory" },
    { value: Math.max(0, targetWeight), label: "target" },
    { value: -repetitionPenalty, label: "repeat" }
  ]);

  return {
    chord: entry.chord,
    fn: entry.fn,
    score,
    inKey: Boolean(diatonicMatch),
    bucket: entry.bucket,
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
      isOutsideKeyCandidate: !diatonicMatch
    })
  };
}

function selectTopBucketSuggestions(candidates, limit = 3) {
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getSuggestions({
  musicData,
  moodBoosts,
  functionDescriptions,
  moodReasonText,
  selectedKey,
  progression,
  feeling
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

  const inKeySuggestions = selectTopBucketSuggestions(
    buildInKeyCandidates({ keyData, lastParsedChord }).map(candidate =>
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
        feeling
      })
    ),
    3
  );

  const relatedSuggestions = selectTopBucketSuggestions(
    buildRelatedCandidates({ keyData, profile })
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
          feeling
        })
      ),
    3
  );

  const outsideSuggestions = selectTopBucketSuggestions(
    buildOutsideCandidates({ keyData, profile })
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
          feeling
        })
      ),
    3
  );

  const suggestions = [
    ...inKeySuggestions,
    ...relatedSuggestions,
    ...outsideSuggestions
  ];

  return {
    suggestions,
    parsedProgression: parsed,
    invalidChords: invalid,
    lastChord: lastParsedChord?.diatonicChord || lastParsedChord?.original || keyData.chords[0]
  };
}
