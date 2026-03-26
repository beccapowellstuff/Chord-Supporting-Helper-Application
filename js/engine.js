/**
 * engine.js — Chord suggestion and progression parsing engine
 *
 * Responsibilities:
 *   - parseProgression: tokenises a user-typed chord string, canonicalises
 *     each chord, and maps it to a diatonic function if it is in the key
 *   - getSuggestions: scores every candidate chord against the current
 *     progression using cadence patterns, mood boosts, repetition penalties,
 *     and borrowed-chord resolution bonuses; returns the top 6 with reasons
 *   - All scoring helpers (getCadenceBonus, getPatternBonus,
 *     getRepetitionPenalty, getBorrowedResolutionBonus, buildReasonParts)
 *     are internal to this module
 *
 * Exports: parseProgression, getSuggestions
 * Depends on: chordNotes (normaliseRoot, parseChordName)
 */
import { normaliseRoot, parseChordName } from "./chordNotes.js";

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

function buildReasonParts({
  lastChord,
  candidate,
  candidateFn,
  cadenceBonus,
  patternBonus,
  moodMatched,
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

  if (cameAfterBorrowedChord) {
    parts.push("The previous chord sits outside the selected key, so this tries to steer the progression back into a stable path.");
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
  const lastParsedChord = parsed.at(-1);
  const lastDisplayChord = lastParsedChord?.original || keyData.chords[0];
  const lastChord = lastParsedChord?.diatonicChord || lastParsedChord?.original || keyData.chords[0];

  const romanHistory = parsed
    .map(item => item.function)
    .filter(Boolean);

  const baseCandidates = lastParsedChord?.inKey
    ? (keyData.transitions[lastChord] || keyData.chords)
    : keyData.chords;

  const chromaticPool = buildChromaticCandidatePool(keyData);

  const candidatePool = [
    ...baseCandidates,
    ...chromaticPool.filter(candidate => {
      const quality = getChordQuality(candidate);
      const sameQualityAsLast = lastParsedChord
        ? getChordQuality(lastParsedChord.original) === quality
        : true;

      const sameRootAsLast = lastParsedChord
        ? normaliseRoot(getChordRoot(candidate)) === normaliseRoot(getChordRoot(lastParsedChord.original))
        : false;

      return !sameRootAsLast && sameQualityAsLast;
    }).slice(0, 8)
  ].filter((candidate, index, array) =>
    array.findIndex(item => chordsEquivalent(item, candidate)) === index
  );

  const suggestions = candidatePool
    .map(candidate => {
      const diatonicMatch = findMatchingDiatonicChord(candidate, keyData);
      const candidateDisplay = diatonicMatch || candidate;
      const candidateFn = diatonicMatch ? keyData.functions[diatonicMatch] : null;
      const isOutsideKeyCandidate = !diatonicMatch;

      const baseScore = diatonicMatch ? 3 : 1;
      const moodBonus = candidateFn && boostedFunctions.includes(candidateFn) ? 3 : 0;
      const cadenceBonus = candidateFn ? getCadenceBonus(romanHistory, candidateFn) : 0;
      const patternBonus = candidateFn
        ? getPatternBonus(parsed, candidateDisplay, romanHistory, candidateFn)
        : 0;
      const repetitionPenalty = getRepetitionPenalty(parsed, candidateDisplay);
      const borrowedResolutionBonus = getBorrowedResolutionBonus(lastParsedChord, candidateDisplay, keyData);
      const outsideKeyPenalty = isOutsideKeyCandidate ? 1 : 0;

      const score =
        baseScore +
        moodBonus +
        cadenceBonus +
        patternBonus +
        borrowedResolutionBonus -
        repetitionPenalty -
        outsideKeyPenalty;

      const scoreBreakdown =
        `${baseScore}+${moodBonus}+${cadenceBonus}+${patternBonus}+${borrowedResolutionBonus}-${repetitionPenalty}-${outsideKeyPenalty}`;

      return {
        chord: candidateDisplay,
        fn: candidateFn || "outside key",
        score,
        inKey: !isOutsideKeyCandidate,
        reason: buildReasonParts({
          lastChord: lastDisplayChord,
          candidate: candidateDisplay,
          candidateFn,
          cadenceBonus,
          patternBonus,
          moodMatched: Boolean(candidateFn && boostedFunctions.includes(candidateFn)),
          borrowedResolutionBonus,
          functionDescriptions,
          moodReasonText,
          feeling,
          scoreBreakdown,
          cameAfterBorrowedChord: Boolean(lastParsedChord && !lastParsedChord.inKey),
          isOutsideKeyCandidate
        })
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  return {
    suggestions,
    parsedProgression: parsed,
    invalidChords: invalid,
    lastChord
  };
}
