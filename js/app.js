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
  renderSuggestions,
  renderError,
  renderKeyInfo,
  renderChordLoader,
  initTooltips,
  getFriendlyChordName
} from "./ui.js";
import { renderRootSelector } from "./rootSelector.js";
import {
  initSoundFont,
  playMidiNote,
  ensureAudioContext
} from "./synth.js";
import { noteToMidi, normaliseRoot, NOTE_TO_PC } from "./chordNotes.js";
import { ensureAudioReady, playChord, playProgression } from "./playback.js";

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

let appData = null;
let selectedKey = "C Major";

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

function refreshKeyUI() {
  renderRootSelector(
    rootContainer,
    selectedKey,
    async newKey => {
      selectedKey = newKey;
      refreshKeyUI();

      try {
        await ensureAudioReady();
        const rootNote = newKey.split(" ")[0];
        const midi = noteToMidi(rootNote, 4);
        if (midi != null) {
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
        await playChord(chord, 1.0);
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

        for (const midi of midiNotes) {
          await playMidiNote(midi, 0.45);
          await new Promise(resolve => setTimeout(resolve, 220));
        }
      } catch (error) {
        console.error("Could not play scale:", error);
      }
    }
  );

  const rootNote = selectedKey.split(" ")[0];
  renderChordLoader(
    chordButtons,
    rootNote,
    async chordName => {
      try {
        await ensureAudioReady();
        await playChord(chordName, 1.0);
      } catch (error) {
        console.error("✗ Could not play chord:", error);
      }
    },
    chordName => appendChordToProgression(chordName)
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
      await playChord(chordName, 1.0);
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
    await playProgression(chordList, 90);
  } catch (error) {
    console.error("Could not play progression:", error);
  }
}

async function init() {
  try {
    console.log("🚀 App initializing...");
    appData = await loadAllData();
    console.log("✓ Data loaded");

    populateFeelings(feelingSelect, appData.moodBoosts);

    const styleSelect = document.getElementById("styleSelect");
    if (styleSelect) {
      styleSelect.addEventListener("change", () => {
        const style = styleSelect.value;
        const root = selectedKey.split(" ")[0];
        const candidate = `${root} ${style}`;

        if (appData.musicData && appData.musicData[candidate]) {
          selectedKey = candidate;
        } else {
          const normalizedRoot = normaliseRoot(root);
          const pc = NOTE_TO_PC[normalizedRoot];
          if (pc != null) {
            const match = Object.keys(appData.musicData).find(k => {
              const parts = k.split(" ");
              const kRoot = normaliseRoot(parts[0]);
              const kMode = parts.slice(1).join(" ");
              return NOTE_TO_PC[kRoot] === pc && kMode.toLowerCase() === style.toLowerCase();
            });
            if (match) selectedKey = match;
          }
        }

        refreshKeyUI();
      });
    }

    refreshKeyUI();

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
