/**
 * app.js — Application entry point and orchestration
 *
 * Responsibilities:
 *   - Initialises the app and loads all data via dataLoader
 *   - Holds the single piece of shared state: selectedKey
 *   - Wires all UI events (root selector, style select, suggest button,
 *     play button, auto-suggest toggle, chord loader add/play actions)
 *   - Delegates every concern to the appropriate module — no note math,
 *     no audio logic, and no DOM building lives here
 *
 * Depends on: dataLoader, engine, ui, rootSelector, synth, chordNotes, playback
 */
import { loadAllData } from "./dataLoader.js";
import { getSuggestions, parseProgression } from "./engine.js";
import {
  populateFeelings,
  populateModeSelect,
  renderSuggestions,
  renderError,
  renderKeyInfo,
  renderChordLoader,
  initTooltips,
  getFriendlyChordName,
  formatChordLabel
} from "./ui.js";
import { renderRootSelector } from "./rootSelector.js";
import { renderCompactRootSelector, renderSequenceKeyboard } from "./playgroundKeyboard.js";
import {
  initSoundFont,
  playMidiNote,
  playMidiNotes,
  ensureAudioContext
} from "./synth.js";
import {
  noteToMidi,
  normaliseRoot,
  NOTE_TO_PC,
  parseChordName,
  identifyChordFromMidiNotes,
  pitchClassToDisplayNote
} from "./chordNotes.js";
import { ensureAudioReady, playChord, playProgression } from "./playback.js";

document.addEventListener(
  "pointerdown",
  () => {
    ensureAudioContext();
  },
  { once: true }
);

// Verify Tone.js loaded
console.log("🔍 Checking Tone.js...");
if (typeof Tone !== "undefined") {
  console.log("✓ Tone.js loaded, version:", Tone.version || "unknown");
} else {
  console.error("✗ Tone.js NOT loaded!");
}

const progressionInput = document.getElementById("progression");
const feelingSelect = document.getElementById("feeling");
const suggestBtn = document.getElementById("suggestBtn");
const autoSuggestToggle = document.getElementById("autoSuggestToggle");
const playProgressionBtn = document.getElementById("playProgressionBtn");
const results = document.getElementById("results");
const rootContainer = document.getElementById("rootContainer");
const keyInfo = document.getElementById("keyInfo");
const chordButtons = document.getElementById("chordButtons");
const bassRootSelector = document.getElementById("bassRootSelector");
const chordRootSelector = document.getElementById("chordRootSelector");
const sequenceKeyboard = document.getElementById("sequenceKeyboard");
const appVersion = document.getElementById("appVersion");

let appData = null;
let selectedKey = "C Ionian";
let selectedChordRoot = "C";
let selectedBassRoot = "C";
let sequenceKeyboardMidiNotes = [];
let sequenceKeyboardFlashMidiNotes = [];
let sequenceKeyboardDisplayMidiNotes = [];
let identifiedSequenceChord = null;
let lockedSequenceChordName = "";
let sequenceKeyboardFlashTimeout = null;
const SEQUENCE_KEYBOARD_MIN_MIDI = 48; // C3
const SEQUENCE_KEYBOARD_MAX_MIDI = 95; // B6

function formatAccidentalDisplay(value) {
  return String(value || "")
    .replace(/b/g, "\u266d")
    .replace(/#/g, "\u266f");
}

function detectSeparator(text) {
  if (!text) return ",";
  if (text.includes("|")) return "|";
  if (text.includes("\n")) return "\n";
  if (text.includes(",")) return ",";
  return ",";
}

function appendChordToProgression(chordName) {
  const friendlyChordName = getFriendlyChordName(chordName);
  const currentValue = progressionInput.value.trim();
  const separator = detectSeparator(currentValue);

  if (currentValue) {
    progressionInput.value = currentValue + " " + separator + " " + friendlyChordName;
  } else {
    progressionInput.value = friendlyChordName;
  }

  if (autoSuggestToggle?.checked && appData) {
    runSuggestions();
  }
}

function extractChordList(parsedProgression) {
  if (!Array.isArray(parsedProgression)) return [];

  return parsedProgression
    .map(item => {
      if (typeof item === "string") return item;
      if (item && typeof item.original === "string") return item.original;
      return null;
    })
    .filter(Boolean);
}

function normalizeMidiList(midiNotes) {
  return [...new Set(
    (Array.isArray(midiNotes) ? midiNotes : []).filter(midi => Number.isFinite(midi))
  )].sort((a, b) => a - b);
}

function getVisibleSequenceKeyboardNotes(midiNotes) {
  return normalizeMidiList(
    (Array.isArray(midiNotes) ? midiNotes : []).filter(
      midi => midi >= SEQUENCE_KEYBOARD_MIN_MIDI && midi <= SEQUENCE_KEYBOARD_MAX_MIDI
    )
  );
}

function getVisibleSequenceKeyboardChordDisplay(chordName) {
  const parsed = parseChordName(chordName);
  if (!parsed) {
    return [];
  }

  const rootMidi = noteToMidi(parsed.root, 4);
  if (rootMidi == null) {
    return [];
  }

  const upperStructure = parsed.intervals.map(interval => rootMidi + interval);
  const bassMidi = noteToMidi(parsed.bass || parsed.root, 3);

  return getVisibleSequenceKeyboardNotes([
    ...(bassMidi == null ? [] : [bassMidi]),
    ...upperStructure
  ]);
}

function identifySequenceKeyboardChord() {
  if (lockedSequenceChordName) {
    const parsed = parseChordName(lockedSequenceChordName);
    identifiedSequenceChord = parsed
      ? {
          root: parsed.root,
          bass: parsed.bass,
          suffix: parsed.suffix,
          canonicalName: parsed.canonicalName,
          playedMidiNotes: [...sequenceKeyboardMidiNotes],
          playedPitchClasses: []
        }
      : null;
    return;
  }

  const normalizedMidi = normalizeMidiList(sequenceKeyboardMidiNotes);
  const offscreenBassMidiNotes = normalizedMidi.filter(midi => midi < SEQUENCE_KEYBOARD_MIN_MIDI);
  const visibleMidiNotes = normalizedMidi.filter(midi => midi >= SEQUENCE_KEYBOARD_MIN_MIDI);
  const lowerLaneMidiNotes = visibleMidiNotes.filter(midi => midi < 60);
  const upperLaneMidiNotes = visibleMidiNotes.filter(midi => midi >= 60);

  if (!visibleMidiNotes.length) {
    identifiedSequenceChord = null;
    return;
  }

  const preferredRootPitchClass = ((visibleMidiNotes[0] % 12) + 12) % 12;
  const allNotesIdentifiedChord = identifyChordFromMidiNotes(visibleMidiNotes, {
    preferredRootPitchClass
  });
  const upperLaneIdentifiedChord =
    lowerLaneMidiNotes.length && upperLaneMidiNotes.length
      ? identifyChordFromMidiNotes(upperLaneMidiNotes, {
          preferredRootPitchClass: ((upperLaneMidiNotes[0] % 12) + 12) % 12
        })
      : null;
  const lowestVisiblePitchClass = ((visibleMidiNotes[0] % 12) + 12) % 12;
  const allNotesRootPitchClass = allNotesIdentifiedChord
    ? NOTE_TO_PC[normaliseRoot(allNotesIdentifiedChord.root)]
    : null;
  const useUpperLaneAsChord =
    Boolean(upperLaneIdentifiedChord) &&
    allNotesRootPitchClass !== lowestVisiblePitchClass;
  const chordMidiNotes = useUpperLaneAsChord ? upperLaneMidiNotes : visibleMidiNotes;
  const bassMidiNotes = normalizeMidiList([
    ...offscreenBassMidiNotes,
    ...(useUpperLaneAsChord ? lowerLaneMidiNotes : [])
  ]);
  const identifiedChord = useUpperLaneAsChord
    ? upperLaneIdentifiedChord
    : allNotesIdentifiedChord;

  if (!identifiedChord) {
    identifiedSequenceChord = null;
    return;
  }

  const lowestBassMidi = bassMidiNotes[0];
  const bassPitchClass = Number.isFinite(lowestBassMidi)
    ? ((lowestBassMidi % 12) + 12) % 12
    : null;
  const bassNote = Number.isFinite(bassPitchClass)
    ? pitchClassToDisplayNote(bassPitchClass)
    : null;
  const chordRootPitchClass = NOTE_TO_PC[normaliseRoot(identifiedChord.root)];
  const canonicalName = bassNote && chordRootPitchClass !== bassPitchClass
    ? `${identifiedChord.root}${identifiedChord.suffix}/${bassNote}`
    : identifiedChord.canonicalName;
  const parsedIdentified = parseChordName(canonicalName);

  identifiedSequenceChord = parsedIdentified
    ? {
        root: parsedIdentified.root,
        bass: parsedIdentified.bass,
        suffix: parsedIdentified.suffix,
        canonicalName: parsedIdentified.canonicalName,
        playedMidiNotes: [...normalizedMidi],
        playedPitchClasses: []
      }
    : null;
}

function getSequenceKeyboardLabel() {
  if (!sequenceKeyboardMidiNotes.length) {
    return "No notes selected";
  }

  if (!identifiedSequenceChord) {
    return "Chord not recognised";
  }

  return formatChordLabel(identifiedSequenceChord.canonicalName);
}

function setSequenceKeyboardFlash(midiNotes, durationSeconds = 1.0) {
  sequenceKeyboardFlashMidiNotes = normalizeMidiList(midiNotes);

  if (sequenceKeyboardFlashTimeout) {
    clearTimeout(sequenceKeyboardFlashTimeout);
  }

  sequenceKeyboardFlashTimeout = setTimeout(() => {
    sequenceKeyboardFlashMidiNotes = [];
    sequenceKeyboardDisplayMidiNotes = [];
    refreshSequenceKeyboard();
  }, Math.max(250, durationSeconds * 1000));
}

function refreshSequenceKeyboard() {
  renderSequenceKeyboard(
    sequenceKeyboard,
    {
      activeMidiNotes: sequenceKeyboardDisplayMidiNotes.length
        ? sequenceKeyboardDisplayMidiNotes
        : sequenceKeyboardMidiNotes,
      flashMidiNotes: sequenceKeyboardFlashMidiNotes,
      chordLabel: getSequenceKeyboardLabel(),
      canSave: Boolean(identifiedSequenceChord),
      canPlay: sequenceKeyboardMidiNotes.length > 0
    },
    {
      onKeyToggle: async midi => {
        lockedSequenceChordName = "";
        sequenceKeyboardDisplayMidiNotes = [];
        const midiSet = new Set(sequenceKeyboardMidiNotes);
        if (midiSet.has(midi)) {
          midiSet.delete(midi);
        } else {
          midiSet.add(midi);
        }

        sequenceKeyboardMidiNotes = normalizeMidiList([...midiSet]);
        identifySequenceKeyboardChord();
        setSequenceKeyboardFlash([midi], 0.4);
        refreshSequenceKeyboard();

        try {
          await ensureAudioReady();
          await playMidiNote(midi, 0.45);
        } catch (error) {
          console.warn("Could not play sequence keyboard note:", error);
        }
      },
      onPlay: async () => {
        if (!sequenceKeyboardMidiNotes.length) {
          return;
        }

        const isLockedPlaybackChord = Boolean(lockedSequenceChordName);
        const playbackNotes = isLockedPlaybackChord && identifiedSequenceChord?.canonicalName
          ? getVisibleSequenceKeyboardChordDisplay(identifiedSequenceChord.canonicalName)
          : normalizeMidiList(sequenceKeyboardMidiNotes);
        const displayNotes = isLockedPlaybackChord && identifiedSequenceChord?.canonicalName
          ? getVisibleSequenceKeyboardChordDisplay(identifiedSequenceChord.canonicalName)
          : normalizeMidiList(sequenceKeyboardMidiNotes);
        const flashNotes = displayNotes.length
          ? displayNotes
          : normalizeMidiList(sequenceKeyboardMidiNotes);

        sequenceKeyboardDisplayMidiNotes = displayNotes;
        setSequenceKeyboardFlash(flashNotes, 1.0);
        refreshSequenceKeyboard();

        try {
          await ensureAudioReady();
          await playMidiNotes(playbackNotes, 1.0);
        } catch (error) {
          console.warn("Could not play sequence keyboard notes:", error);
        }
      },
      onClear: () => {
        sequenceKeyboardMidiNotes = [];
        sequenceKeyboardFlashMidiNotes = [];
        sequenceKeyboardDisplayMidiNotes = [];
        identifiedSequenceChord = null;
        lockedSequenceChordName = "";
        if (sequenceKeyboardFlashTimeout) {
          clearTimeout(sequenceKeyboardFlashTimeout);
          sequenceKeyboardFlashTimeout = null;
        }
        refreshSequenceKeyboard();
      },
      onIdentify: () => {
        identifySequenceKeyboardChord();
        refreshSequenceKeyboard();
      },
      onSave: () => {
        if (identifiedSequenceChord?.canonicalName) {
          appendChordToProgression(identifiedSequenceChord.canonicalName);
        }
      }
    }
  );
}

function setSequenceKeyboardNotes(midiNotes, durationSeconds = 1.0, chordName = "") {
  sequenceKeyboardMidiNotes = normalizeMidiList(midiNotes);
  lockedSequenceChordName = chordName || "";
  sequenceKeyboardDisplayMidiNotes = [];
  identifySequenceKeyboardChord();
  setSequenceKeyboardFlash(sequenceKeyboardMidiNotes, durationSeconds);
  refreshSequenceKeyboard();
}

function getDisplayMidiForNoteNames(noteNames, octave = 3) {
  return normalizeMidiList(
    (Array.isArray(noteNames) ? noteNames : [])
      .map(note => noteToMidi(normaliseRoot(note), octave))
      .filter(midi => midi != null)
  );
}

function getDisplayMidiForChord(chordName) {
  const parsed = parseChordName(chordName);
  if (!parsed) return [];

  const rootMidi = noteToMidi(parsed.root, 4);
  if (rootMidi == null) {
    return [];
  }

  const bassMidi = noteToMidi(parsed.bass || parsed.root, 3);
  const upperStructure = parsed.intervals.map(interval => rootMidi + interval);

  return normalizeMidiList([
    ...(bassMidi == null ? [] : [bassMidi]),
    ...upperStructure
  ]);
}

function showSequenceKeyboardNotes(noteNames, durationSeconds = 1.0) {
  const midiNotes = getDisplayMidiForNoteNames(noteNames, 3);
  if (!midiNotes.length) return;
  setSequenceKeyboardNotes(midiNotes, durationSeconds);
}

function showSequenceKeyboardChord(chordName, durationSeconds = 1.0) {
  const midiNotes = getDisplayMidiForChord(chordName);
  if (!midiNotes.length) return;
  setSequenceKeyboardNotes(midiNotes, durationSeconds, chordName);
}

async function playChordWithSequenceKeyboard(chordName, duration = 1.0) {
  showSequenceKeyboardChord(chordName, duration);
  await playChord(chordName, duration);
}

function refreshChordPlaygroundUI() {
  renderCompactRootSelector(bassRootSelector, {
    title: "Bass Root",
    selectedNote: selectedBassRoot,
    onSelect: async note => {
      selectedBassRoot = note;
      refreshChordPlaygroundUI();

      try {
        await ensureAudioReady();
        showSequenceKeyboardNotes([note], 0.5);
        const midi = noteToMidi(note, 3);
        if (midi != null) {
          await playMidiNote(midi, 0.5);
        }
      } catch (error) {
        console.warn("Could not play bass root note:", error);
      }
    }
  });

  renderCompactRootSelector(chordRootSelector, {
    title: "Chord Root",
    selectedNote: selectedChordRoot,
    onSelect: async note => {
      const previousChordRoot = selectedChordRoot;
      selectedChordRoot = note;
      if (selectedBassRoot === previousChordRoot) {
        selectedBassRoot = note;
      }
      refreshChordPlaygroundUI();

      try {
        await ensureAudioReady();
        showSequenceKeyboardNotes([note], 0.5);
        const midi = noteToMidi(note, 3);
        if (midi != null) {
          await playMidiNote(midi, 0.5);
        }
      } catch (error) {
        console.warn("Could not play chord root note:", error);
      }
    }
  });

  renderChordLoader(
    chordButtons,
    selectedChordRoot,
    selectedBassRoot,
    async chordName => {
      try {
        await ensureAudioReady();
        await playChordWithSequenceKeyboard(chordName, 1.0);
      } catch (error) {
        console.error("✗ Could not play chord:", error);
      }
    },
    chordName => appendChordToProgression(chordName)
  );
}

async function loadVersionLabel() {
  if (!appVersion) return;

  try {
    const versionUrl = new URL("../package.json", import.meta.url);
    const response = await fetch(versionUrl);
    if (!response.ok) {
      throw new Error(`Failed to load version: ${response.status}`);
    }

    const packageData = await response.json();
    appVersion.textContent = packageData.version || "unknown";
  } catch (error) {
    console.warn("Could not load app version:", error);
    appVersion.textContent = "unknown";
  }
}

function refreshKeyUI() {
  const styleSelect = document.getElementById("styleSelect");
  if (styleSelect) {
    styleSelect.value = appData?.musicData?.[selectedKey]?.modeId || "ionian";
  }

  renderRootSelector(
    rootContainer,
    selectedKey,
    async newKey => {
      selectedKey = newKey;
      const rootNote = newKey.split(" ")[0] || "C";
      selectedChordRoot = rootNote;
      selectedBassRoot = rootNote;
      refreshChordPlaygroundUI();
      refreshKeyUI();

      try {
        await ensureAudioReady();
        const midi = noteToMidi(rootNote, 4);
        if (midi != null) {
          showSequenceKeyboardNotes([rootNote], 0.8);
          await playMidiNote(midi, 0.8);
        }
      } catch (error) {
        console.warn("Could not play clicked root note:", error);
      }
    },
    appData.musicData
  );

  renderKeyInfo(
    keyInfo,
    appData.musicData,
    selectedKey,
    async chord => {
      try {
        await ensureAudioReady();
        await playChordWithSequenceKeyboard(chord, 1.0);
      } catch (error) {
        console.error("✗ Could not play chord:", error);
      }
    },
    chord => {
      appendChordToProgression(chord);
    },
    async note => {
      try {
        await ensureAudioReady();
        const midi = noteToMidi(note, 4);
        if (midi != null) {
          showSequenceKeyboardNotes([note], 0.6);
          await playMidiNote(midi, 0.6);
        }
      } catch (error) {
        console.error("✗ Could not play note:", error);
      }
    },
    async notesArray => {
      try {
        await ensureAudioReady();

        if (!Array.isArray(notesArray) || !notesArray.length) {
          return;
        }

        const startOctave = 4;
        const fullScale = [...notesArray, notesArray[0]];
        const midiNotes = [];

        const firstMidi = noteToMidi(fullScale[0], startOctave);
        if (firstMidi == null) {
          return;
        }

        midiNotes.push(firstMidi);
        let previousMidi = firstMidi;

        for (let i = 1; i < fullScale.length; i++) {
          let octave = startOctave;
          let midi = noteToMidi(fullScale[i], octave);

          if (midi == null) {
            continue;
          }

          while (midi <= previousMidi) {
            octave += 1;
            midi = noteToMidi(fullScale[i], octave);
          }

          midiNotes.push(midi);
          previousMidi = midi;
        }

        for (let i = 0; i < midiNotes.length; i += 1) {
          const midi = midiNotes[i];
          const noteName = fullScale[i] || "";
          if (noteName) {
            showSequenceKeyboardNotes([noteName], 0.22);
          }
          await playMidiNote(midi, 0.45);
          await new Promise(resolve => setTimeout(resolve, 220));
        }
      } catch (error) {
        console.error("Could not play scale:", error);
      }
    }
  );
}

function runSuggestions() {
  const suggestionPayload = getSuggestions({
    musicData: appData.musicData,
    moodBoosts: appData.moodBoosts,
    functionDescriptions: appData.functionDescriptions,
    moodReasonText: appData.moodReasonText,
    selectedKey,
    progression: progressionInput.value,
    feeling: feelingSelect.value
  });

  const onSuggestedChordClick = async (chordName) => {
    try {
      await ensureAudioReady();
      await playChordWithSequenceKeyboard(chordName, 1.0);
    } catch (error) {
      console.error("✗ Could not play suggested chord:", error);
    }
  };

  const onSuggestedChordAdd = (chordName) => {
    appendChordToProgression(chordName);
  };

  renderSuggestions(results, suggestionPayload, appData.musicData, selectedKey, onSuggestedChordClick, onSuggestedChordAdd);
}

async function handlePlayProgression() {
  const keyData = appData?.musicData?.[selectedKey];
  if (!keyData) return;

  const { parsed } = parseProgression(progressionInput.value, keyData);
  const chordList = extractChordList(parsed);

  if (!chordList.length) return;

  try {
    await ensureAudioReady();
    await playProgression(chordList, 90, async (chord, durationSeconds) => {
      showSequenceKeyboardChord(chord, durationSeconds);
    });
  } catch (error) {
    console.error("Could not play progression:", error);
  }
}

async function init() {
  try {
    console.log("🚀 App initializing...");
    await loadVersionLabel();
    appData = await loadAllData();
    console.log("✓ Data loaded");

    populateFeelings(feelingSelect, appData.moodBoosts);
    selectedChordRoot = selectedKey.split(" ")[0];
    selectedBassRoot = selectedChordRoot;

    const styleSelect = document.getElementById("styleSelect");
    if (styleSelect) {
      populateModeSelect(styleSelect, appData.modeGroups);
      styleSelect.value = appData.musicData[selectedKey]?.modeId || "ionian";

      styleSelect.addEventListener("change", () => {
        const modeId = styleSelect.value;
        const root = selectedKey.split(" ")[0];
        const normalizedRoot = normaliseRoot(root);
        const pc = NOTE_TO_PC[normalizedRoot];

        if (pc != null) {
          const match = Object.keys(appData.musicData).find(keyName => {
            const keyData = appData.musicData[keyName];
            const keyRoot = normaliseRoot(keyData.root);
            return NOTE_TO_PC[keyRoot] === pc && keyData.modeId === modeId;
          });

          if (match) {
            selectedKey = match;
          }
        }

        refreshKeyUI();
      });
    }

    refreshKeyUI();
    refreshSequenceKeyboard();
    refreshChordPlaygroundUI();

    suggestBtn.dataset.tooltip = "Suggest the next best chords based on your progression and mood";
    if (playProgressionBtn) playProgressionBtn.dataset.tooltip = "Play all chords in the progression";
    feelingSelect.dataset.tooltip = "Choose a mood to guide the suggestions";
    if (autoSuggestToggle) autoSuggestToggle.closest(".suggest-toggle").dataset.tooltip = "Automatically refresh suggestions when you add a chord";

    initTooltips();

    suggestBtn.addEventListener("click", runSuggestions);

    if (playProgressionBtn) {
      playProgressionBtn.addEventListener("click", handlePlayProgression);
    }

    console.log("📍 Setting up first-click listener...");
    document.addEventListener(
      "click",
      async () => {
        console.log("🖱️ Document click detected - initializing audio...");
        try {
          await ensureAudioContext();
          console.log("▶ Calling initSoundFont...");
          await initSoundFont();
          console.log("✓ SoundFont initialized");
        } catch (error) {
          console.error("✗ Audio/SoundFont initialisation failed:", error);
        }
      },
      { once: true }
    );
    console.log("✓ App initialized successfully");
  } catch (error) {
    console.error("✗ Initialization failed:", error);
    renderError(results, "Failed to load app data.");
  }
}

init();
