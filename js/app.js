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
  getFriendlyChordName
} from "./ui.js";
import { renderRootSelector } from "./rootSelector.js";
import { renderPlaygroundKeyboard } from "./playgroundKeyboard.js";
import {
  initSoundFont,
  playMidiNote,
  ensureAudioContext
} from "./synth.js";
import { noteToMidi, normaliseRoot, NOTE_TO_PC, getChordNotes, parseChordName } from "./chordNotes.js";
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
const playgroundKeyboard = document.getElementById("playgroundKeyboard");
const appVersion = document.getElementById("appVersion");

let appData = null;
let selectedKey = "C Ionian";
let selectedChordRoot = "C";
let selectedBassRoot = "C";
let currentPlayedBassRoot = "";
let currentPlayedChordPitchClasses = [];
let lastPlayedBassRoot = "";
let lastPlayedChordPitchClasses = [];
let lastPlayedChordName = "";
let keyboardHighlightTimeout = null;

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

function clearPlaygroundLastPlayed(clearCurrent = false) {
  lastPlayedBassRoot = "";
  lastPlayedChordPitchClasses = [];
  lastPlayedChordName = "";

  if (clearCurrent) {
    currentPlayedBassRoot = "";
    currentPlayedChordPitchClasses = [];
  }

  if (keyboardHighlightTimeout) {
    clearTimeout(keyboardHighlightTimeout);
    keyboardHighlightTimeout = null;
  }
}

function refreshPlaygroundKeyboard() {
  renderPlaygroundKeyboard(
    playgroundKeyboard,
    {
      selectedBassRoot,
      selectedChordRoot,
      currentPlayedBassRoot,
      currentPlayedChordPitchClasses,
      lastPlayedBassRoot,
      lastPlayedChordPitchClasses,
      canSaveLastPlayed: Boolean(lastPlayedChordName)
    },
    {
      onClearLastPlayed: () => {
        clearPlaygroundLastPlayed(true);
        refreshPlaygroundKeyboard();
      },
      onSaveLastPlayed: () => {
        if (lastPlayedChordName) {
          appendChordToProgression(lastPlayedChordName);
        }
      },
      onBassSelect: async note => {
        selectedBassRoot = note;
        clearPlaygroundLastPlayed(true);
        currentPlayedBassRoot = note;
        refreshChordPlaygroundUI();
        keyboardHighlightTimeout = setTimeout(() => {
          currentPlayedBassRoot = "";
          refreshPlaygroundKeyboard();
        }, 500);
        try {
          await ensureAudioReady();
          const midi = noteToMidi(note, 3);
          if (midi != null) {
            await playMidiNote(midi, 0.5);
          }
        } catch (error) {
          console.warn("Could not play bass root key:", error);
        }
      },
      onChordSelect: async note => {
        const previousChordRoot = selectedChordRoot;
        selectedChordRoot = note;
        if (selectedBassRoot === previousChordRoot) {
          selectedBassRoot = note;
        }
        clearPlaygroundLastPlayed(true);
        const pitchClass = NOTE_TO_PC[normaliseRoot(note)];
        currentPlayedChordPitchClasses = pitchClass == null ? [] : [pitchClass];
        refreshChordPlaygroundUI();
        keyboardHighlightTimeout = setTimeout(() => {
          currentPlayedChordPitchClasses = [];
          refreshPlaygroundKeyboard();
        }, 500);
        try {
          await ensureAudioReady();
          const midi = noteToMidi(note, 4);
          if (midi != null) {
            await playMidiNote(midi, 0.5);
          }
        } catch (error) {
          console.warn("Could not play chord root key:", error);
        }
      }
    }
  );
}

function flashPlaygroundKeyboardNotes(noteNames, durationSeconds = 1.0, summary = "") {
  const resolvedNotes = (Array.isArray(noteNames) ? noteNames : [])
    .map(note => normaliseRoot(note))
    .filter(note => NOTE_TO_PC[note] != null);

  if (!resolvedNotes.length) {
    return;
  }

  currentPlayedBassRoot = "";
  currentPlayedChordPitchClasses = [...new Set(
    resolvedNotes
      .map(note => NOTE_TO_PC[note])
      .filter(pitchClass => pitchClass != null)
  )];
  lastPlayedBassRoot = "";
  lastPlayedChordPitchClasses = [...currentPlayedChordPitchClasses];
  lastPlayedChordName = "";

  refreshPlaygroundKeyboard();

  if (keyboardHighlightTimeout) {
    clearTimeout(keyboardHighlightTimeout);
  }

  keyboardHighlightTimeout = setTimeout(() => {
    currentPlayedBassRoot = "";
    currentPlayedChordPitchClasses = [];
    refreshPlaygroundKeyboard();
  }, Math.max(250, durationSeconds * 1000));
}

function flashPlaygroundKeyboard(chordName, durationSeconds = 1.0) {
  const parsed = parseChordName(chordName);
  const notes = getChordNotes(chordName);
  if (!parsed || !notes?.length) {
    return;
  }

  currentPlayedBassRoot = parsed.bass || parsed.root;
  const chordToneNotes = parsed.bass ? notes.slice(1) : notes;
  currentPlayedChordPitchClasses = [...new Set(
    chordToneNotes
      .map(note => NOTE_TO_PC[normaliseRoot(note)])
      .filter(pitchClass => pitchClass != null)
  )];
  lastPlayedBassRoot = currentPlayedBassRoot;
  lastPlayedChordPitchClasses = [...currentPlayedChordPitchClasses];
  lastPlayedChordName = chordName;

  refreshPlaygroundKeyboard();

  if (keyboardHighlightTimeout) {
    clearTimeout(keyboardHighlightTimeout);
  }

  keyboardHighlightTimeout = setTimeout(() => {
    currentPlayedBassRoot = "";
    currentPlayedChordPitchClasses = [];
    refreshPlaygroundKeyboard();
  }, Math.max(250, durationSeconds * 1000));
}

async function playChordWithPlaygroundHighlight(chordName, duration = 1.0) {
  flashPlaygroundKeyboard(chordName, duration);
  await playChord(chordName, duration);
}

function refreshChordPlaygroundUI() {
  refreshPlaygroundKeyboard();
  renderChordLoader(
    chordButtons,
    selectedChordRoot,
    selectedBassRoot,
    async chordName => {
      try {
        await ensureAudioReady();
        await playChordWithPlaygroundHighlight(chordName, 1.0);
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
          flashPlaygroundKeyboardNotes([rootNote], 0.8, formatAccidentalDisplay(rootNote));
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
        await playChordWithPlaygroundHighlight(chord, 1.0);
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
          flashPlaygroundKeyboardNotes([note], 0.6, formatAccidentalDisplay(note));
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
            flashPlaygroundKeyboardNotes([noteName], 0.22, formatAccidentalDisplay(noteName));
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
      await playChordWithPlaygroundHighlight(chordName, 1.0);
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
      flashPlaygroundKeyboard(chord, durationSeconds);
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
