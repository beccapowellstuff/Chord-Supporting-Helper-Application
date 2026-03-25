import { normaliseRoot } from "./chordNotes.js";

function normaliseChordToken(token) {
  return String(token || "")
    .trim()
    .replace(/°/g, "dim")
    .replace(/\s+/g, "");
}

function getChordQuality(chord) {
  if (/maj13$/i.test(chord)) return "maj13";
  if (/maj11$/i.test(chord)) return "maj11";
  if (/maj9$/i.test(chord)) return "maj9";
  if (/maj7$/i.test(chord)) return "maj7";
  if (/m13$/i.test(chord)) return "m13";
  if (/m11$/i.test(chord)) return "m11";
  if (/m9$/i.test(chord)) return "m9";
  if (/m7$/i.test(chord)) return "m7";
  if (/dim$/i.test(chord)) return "dim";
  if (/aug$/i.test(chord)) return "aug";
  if (/sus4$/i.test(chord)) return "sus4";
  if (/sus2$/i.test(chord)) return "sus2";
  if (/sus$/i.test(chord)) return "sus4";
  if (/add13$/i.test(chord)) return "add13";
  if (/add11$/i.test(chord)) return "add11";
  if (/add9$/i.test(chord)) return "add9";
  if (/13$/i.test(chord)) return "13";
  if (/11$/i.test(chord)) return "11";
  if (/9$/i.test(chord)) return "9";
  if (/7$/i.test(chord)) return "dominant7";
  if (/5$/i.test(chord)) return "power";
  if (/m$/i.test(chord)) return "minor";
  return "major";
}

function getChordRoot(chord) {
  return chord
    .replace(/maj13$/i, "")
    .replace(/maj11$/i, "")
    .replace(/maj9$/i, "")
    .replace(/maj7$/i, "")
    .replace(/m13$/i, "")
    .replace(/m11$/i, "")
    .replace(/m9$/i, "")
    .replace(/m7$/i, "")
    .replace(/dim$/i, "")
    .replace(/aug$/i, "")
    .replace(/sus4$/i, "")
    .replace(/sus2$/i, "")
    .replace(/sus$/i, "")
    .replace(/add13$/i, "")
    .replace(/add11$/i, "")
    .replace(/add9$/i, "")
    .replace(/13$/i, "")
    .replace(/11$/i, "")
    .replace(/9$/i, "")
    .replace(/7$/i, "")
    .replace(/5$/i, "")
    .replace(/m$/i, "");
}


function canonicaliseTypedChord(token) {
  const cleaned = normaliseChordToken(token);
  if (!cleaned) return null;

  let quality = "";
  let root = cleaned;

  // Check for chord suffixes (order matters - check longer suffixes first)
  if (/maj13$/i.test(cleaned)) {
    quality = "maj13";
    root = cleaned.replace(/maj13$/i, "");
  } else if (/maj11$/i.test(cleaned)) {
    quality = "maj11";
    root = cleaned.replace(/maj11$/i, "");
  } else if (/maj9$/i.test(cleaned)) {
    quality = "maj9";
    root = cleaned.replace(/maj9$/i, "");
  } else if (/maj7$/i.test(cleaned)) {
    quality = "maj7";
    root = cleaned.replace(/maj7$/i, "");
  } else if (/m13$/i.test(cleaned)) {
    quality = "m13";
    root = cleaned.replace(/m13$/i, "");
  } else if (/m11$/i.test(cleaned)) {
    quality = "m11";
    root = cleaned.replace(/m11$/i, "");
  } else if (/m9$/i.test(cleaned)) {
    quality = "m9";
    root = cleaned.replace(/m9$/i, "");
  } else if (/m7$/i.test(cleaned)) {
    quality = "m7";
    root = cleaned.replace(/m7$/i, "");
  } else if (/dim$/i.test(cleaned)) {
    quality = "dim";
    root = cleaned.replace(/dim$/i, "");
  } else if (/m$/i.test(cleaned)) {
    quality = "m";
    root = cleaned.replace(/m$/i, "");
  } else if (/aug$/i.test(cleaned)) {
    quality = "aug";
    root = cleaned.replace(/aug$/i, "");
  } else if (/sus4$/i.test(cleaned)) {
    quality = "sus4";
    root = cleaned.replace(/sus4$/i, "");
  } else if (/sus2$/i.test(cleaned)) {
    quality = "sus2";
    root = cleaned.replace(/sus2$/i, "");
  } else if (/sus$/i.test(cleaned)) {
    quality = "sus4";  // Default sus to sus4
    root = cleaned.replace(/sus$/i, "");
  } else if (/add13$/i.test(cleaned)) {
    quality = "add13";
    root = cleaned.replace(/add13$/i, "");
  } else if (/add11$/i.test(cleaned)) {
    quality = "add11";
    root = cleaned.replace(/add11$/i, "");
  } else if (/add9$/i.test(cleaned)) {
    quality = "add9";
    root = cleaned.replace(/add9$/i, "");
  } else if (/13$/i.test(cleaned)) {
    quality = "13";
    root = cleaned.replace(/13$/i, "");
  } else if (/11$/i.test(cleaned)) {
    quality = "11";
    root = cleaned.replace(/11$/i, "");
  } else if (/9$/i.test(cleaned)) {
    quality = "9";
    root = cleaned.replace(/9$/i, "");
  } else if (/7$/i.test(cleaned)) {
    quality = "7";
    root = cleaned.replace(/7$/i, "");
  } else if (/5$/i.test(cleaned)) {
    quality = "5";
    root = cleaned.replace(/5$/i, "");
  }

  const rootMatch = /^([A-G](?:#|b)?)$/i.exec(root);
  if (!rootMatch) return null;

  const fixedRoot = rootMatch[1].charAt(0).toUpperCase() + rootMatch[1].slice(1);
  return `${fixedRoot}${quality}`;
}

function chordsEquivalent(chordA, chordB) {
  const qualityA = getChordQuality(chordA);
  const qualityB = getChordQuality(chordB);

  if (qualityA !== qualityB) return false;

  return normaliseRoot(getChordRoot(chordA)) === normaliseRoot(getChordRoot(chordB));
}

function findMatchingDiatonicChord(inputChord, keyData) {
  return keyData.chords.find(diatonicChord => chordsEquivalent(diatonicChord, inputChord)) || null;
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
      original: diatonicMatch || canonical,
      inKey: Boolean(diatonicMatch),
      function: diatonicMatch ? keyData.functions[diatonicMatch] : null
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
  const lastChord = lastParsedChord?.original || keyData.chords[0];

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
          lastChord,
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