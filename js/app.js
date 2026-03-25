import { loadAllData } from "./dataLoader.js";
import { getSuggestions, parseProgression } from "./engine.js";
import {
  populateFeelings,
  renderSuggestions,
  renderError,
  renderKeyInfo
} from "./ui.js";
import { renderCircleOfFifths } from "./circle.js";
import {
  initSoundFont,
  playMidiNote,
  playMidiNotes,
  ensureAudioContext
} from "./synth.js";

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
const circleContainer = document.getElementById("circleContainer");
const keyInfo = document.getElementById("keyInfo");
const chordButtons = document.getElementById("chordButtons");

let appData = null;
let selectedKey = "C Major";
let audioContext = null;

const NOTE_TO_PC = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11
};

const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const ENHARMONIC_TO_SHARP = {
  "B#": "C",
  Db: "C#",
  Eb: "D#",
  Fb: "E",
  "E#": "F",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
  Cb: "B"
};

const FRIENDLY_ROOT_MAP = {
  "B#": "C",
  Cb: "B",
  "E#": "F",
  Fb: "E"
};

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

async function ensureAudioReady() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

function normaliseRoot(root) {
  return ENHARMONIC_TO_SHARP[root] || root;
}

function getFriendlyChordName(chordName) {
  const match = /^([A-G](?:#|b)?)(.*)$/.exec(String(chordName || ""));
  if (!match) return chordName;

  const [, root, suffix] = match;
  return `${FRIENDLY_ROOT_MAP[root] || root}${suffix}`;
}

function transpose(root, semitones) {
  const normalised = normaliseRoot(root);
  const index = CHROMATIC.indexOf(normalised);
  if (index === -1) return null;
  return CHROMATIC[(index + semitones + 12) % 12];
}

function noteToMidi(noteName, octave) {
  const pitchClass = NOTE_TO_PC[noteName];
  if (pitchClass == null) return null;
  return (octave + 1) * 12 + pitchClass;
}

function midiToFrequency(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getAscendingRootVoicing(chordName) {
  let root = String(chordName || "").trim();
  let intervals = [0, 4, 7];

  if (!root) return [];

  if (root.endsWith("dim")) {
    root = root.slice(0, -3);
    intervals = [0, 3, 6];
  } else if (root.endsWith("m")) {
    root = root.slice(0, -1);
    intervals = [0, 3, 7];
  }

  root = normaliseRoot(root);

  const rootPc = NOTE_TO_PC[root];
  if (rootPc == null) return [];

  const baseMidi = rootPc < NOTE_TO_PC["C"]
    ? noteToMidi(root, 5)
    : noteToMidi(root, 4);

  const third = baseMidi + intervals[1];
  const fifth = baseMidi + intervals[2];

  return [baseMidi, third, fifth];
}

function getChordNotes(chordName) {
  let root = String(chordName || "").trim();
  let intervals = [0, 4, 7]; // Default: major triad

  if (!root) return null;

  // Check for chord suffixes (order matters - check longer suffixes first)
  // Extended chords (7th extensions + 9th/11th/13th)
  if (root.endsWith("maj13")) {
    root = root.slice(0, -5);
    intervals = [0, 4, 7, 11, 14, 17, 21];  // maj triad + maj7 + 9 + 11 + 13
  } else if (root.endsWith("maj11")) {
    root = root.slice(0, -5);
    intervals = [0, 4, 7, 11, 14, 17];      // maj triad + maj7 + 9 + 11
  } else if (root.endsWith("maj9")) {
    root = root.slice(0, -4);
    intervals = [0, 4, 7, 11, 14];          // maj triad + maj7 + 9
  } else if (root.endsWith("maj7")) {
    root = root.slice(0, -4);
    intervals = [0, 4, 7, 11];              // Major seventh
  } else if (root.endsWith("m13")) {
    root = root.slice(0, -3);
    intervals = [0, 3, 7, 10, 14, 17, 21]; // min triad + min7 + 9 + 11 + 13
  } else if (root.endsWith("m11")) {
    root = root.slice(0, -3);
    intervals = [0, 3, 7, 10, 14, 17];     // min triad + min7 + 9 + 11
  } else if (root.endsWith("m9")) {
    root = root.slice(0, -2);
    intervals = [0, 3, 7, 10, 14];         // min triad + min7 + 9
  } else if (root.endsWith("m7")) {
    root = root.slice(0, -2);
    intervals = [0, 3, 7, 10];             // Minor seventh
  } else if (root.endsWith("dim")) {
    root = root.slice(0, -3);
    intervals = [0, 3, 6];                 // Diminished triad
  } else if (root.endsWith("m")) {
    root = root.slice(0, -1);
    intervals = [0, 3, 7];                 // Minor triad
  } else if (root.endsWith("aug")) {
    root = root.slice(0, -3);
    intervals = [0, 4, 8];                 // Augmented
  } else if (root.endsWith("sus4")) {
    root = root.slice(0, -4);
    intervals = [0, 5, 7];                 // Sus4
  } else if (root.endsWith("sus2")) {
    root = root.slice(0, -4);
    intervals = [0, 2, 7];                 // Sus2
  } else if (root.endsWith("sus")) {
    root = root.slice(0, -3);
    intervals = [0, 5, 7];                 // Sus defaults to sus4
  } else if (root.endsWith("add13")) {
    root = root.slice(0, -5);
    intervals = [0, 4, 7, 21];             // Major triad + 13th
  } else if (root.endsWith("add11")) {
    root = root.slice(0, -5);
    intervals = [0, 4, 7, 17];             // Major triad + 11th
  } else if (root.endsWith("add9")) {
    root = root.slice(0, -4);
    intervals = [0, 4, 7, 14];             // Major triad + 9th
  } else if (root.endsWith("13")) {
    root = root.slice(0, -2);
    intervals = [0, 4, 7, 10, 14, 17, 21]; // Dominant 13: triad + min7 + 9 + 11 + 13
  } else if (root.endsWith("11")) {
    root = root.slice(0, -2);
    intervals = [0, 4, 7, 10, 14, 17];     // Dominant 11: triad + min7 + 9 + 11
  } else if (root.endsWith("9")) {
    root = root.slice(0, -1);
    intervals = [0, 4, 7, 10, 14];         // Dominant 9: triad + min7 + 9
  } else if (root.endsWith("7")) {
    root = root.slice(0, -1);
    intervals = [0, 4, 7, 10];             // Dominant seventh
  } else if (root.endsWith("5")) {
    root = root.slice(0, -1);
    intervals = [0, 7];                    // Power chord (root + fifth only)
  }

  root = normaliseRoot(root);

  // Build chord notes from intervals
  const chordNotes = [root];
  for (let i = 1; i < intervals.length; i++) {
    const note = transpose(root, intervals[i]);
    if (!note) return null;
    chordNotes.push(note);
  }

  if (chordNotes.some(n => !n)) return null;

  return chordNotes;
}

// Chord variations available for playback
const CHORD_VARIATIONS = [
  "",           // Major (root only)
  "m",          // Minor
  "m7",         // Minor 7
  "7",          // Dominant 7
  "maj7",       // Major 7
  "sus2",       // Suspended 2
  "sus4",       // Suspended 4
  "5",          // Power chord
  "dim",        // Diminished
  "aug",        // Augmented
  "add9",       // Add 9
  "add11",      // Add 11
  "add13",      // Add 13
  "9",          // Dominant 9
  "11",         // Dominant 11
  "13",         // Dominant 13
  "maj9",       // Major 9
  "maj11",      // Major 11
  "maj13",      // Major 13
  "m9",         // Minor 9
  "m11",        // Minor 11
  "m13"         // Minor 13
];

function detectSeparator(text) {
  // Detect which separator is being used in the progression
  if (!text) return ","; // Default
  
  if (text.includes("|")) return "|";
  if (text.includes("\n")) return "\n";
  if (text.includes(",")) return ",";
  
  return ","; // Default to comma
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

function renderChordLoader(rootNote) {
  // Clear existing buttons
  chordButtons.innerHTML = "";
  
  if (!rootNote) {
    chordButtons.innerHTML = "<p style='color: var(--muted); margin: 0;'>Select a key to view chord options</p>";
    return;
  }

  // Create buttons for each chord variation
  CHORD_VARIATIONS.forEach(suffix => {
    const chordName = rootNote + suffix;
    
    // Create wrapper div for button + add button
    const wrapper = document.createElement("div");
    wrapper.className = "chord-button-wrapper";
    
    // Main chord button (for playing)
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chord-btn";
    button.textContent = chordName;
    
    button.addEventListener("click", async () => {
      try {
        // Just play the chord, don't replace progression
        await ensureAudioReady();
        await playChord(chordName, 1.0);
        
        // Visual feedback - highlight this chord
        document.querySelectorAll(".chord-btn").forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
      } catch (error) {
        console.error("✗ Could not play chord:", error);
      }
    });
    button.dataset.tooltip = `Play ${chordName}`;
    
    // Add button (for appending to progression)
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "chord-add-btn";
    addBtn.textContent = "+";
    addBtn.dataset.tooltip = `Add ${chordName} to progression`;
    
    addBtn.addEventListener("click", async (e) => {
      e.stopPropagation(); // Prevent triggering the play button
      appendChordToProgression(chordName);
    });
    
    wrapper.appendChild(button);
    wrapper.appendChild(addBtn);
    chordButtons.appendChild(wrapper);
  });
}

function buildVoicings(chordName) {
  const notes = getChordNotes(chordName);
  if (!notes) return [];

  // Get the root note to use as bass
  const root = notes[0];
  const rootMidi = noteToMidi(root, 3);  // Bass octave

  // Build MIDI notes for all chord tones (including 7th, 9th, etc.)
  const chordMidis = notes.map((note, idx) => {
    const octave = idx === 0 ? 4 : (idx === notes.length - 1 && notes.length > 3 ? 4 : 4);
    return noteToMidi(note, octave);
  });

  // Build three voicings with bass note + all chord tones in different inversions
  const rootPosition = [rootMidi, ...chordMidis].sort((a, b) => a - b);

  const firstInversion = [
    rootMidi,
    ...chordMidis.map((midi, idx) => idx === 0 ? midi + 12 : midi)
  ].sort((a, b) => a - b);

  const secondInversion = [
    rootMidi,
    ...chordMidis.map((midi, idx) => idx <= 1 ? midi + 12 : midi)
  ].sort((a, b) => a - b);

  return [rootPosition, firstInversion, secondInversion];
}

function distance(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;

  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += Math.abs(a[i] - b[i]);
  }
  return total;
}

function chooseVoicing(chordName, previousVoicing) {
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

async function playChordVoicing(midiNotes, duration = 1.0) {
  if (!midiNotes.length) {
    console.warn("⚠ No MIDI notes provided");
    return;
  }

  try {
    console.log("▶ playChordVoicing called with notes:", midiNotes);
    await ensureAudioContext();
    console.log("▶ Audio context ready");
    await playMidiNotes(midiNotes, duration);
    console.log("✓ playMidiNotes completed");
  } catch (error) {
    console.error("✗ Could not play chord voicing:", error);
  }
}

async function playSoundChord(chordName, duration = 1.0, useSmoothing = false, previousVoicing = null) {
  // === UNIFIED CHORD PLAYBACK ENGINE ===
  // All chord playback goes through here: Circle clicks, Chord table clicks, Progression
  if (!chordName) return { voicing: [] };

  try {
    await ensureAudioContext();
    
    let voicing;
    if (useSmoothing && previousVoicing) {
      // Use voicing optimization for smooth progressions
      const options = buildVoicings(chordName);
      if (!options.length) return { voicing: [] };
      
      voicing = options[0];
      let bestScore = distance(previousVoicing, options[0]);
      
      for (const option of options.slice(1)) {
        const optionScore = distance(previousVoicing, option);
        if (optionScore < bestScore) {
          voicing = option;
          bestScore = optionScore;
        }
      }
    } else {
      // Simple voicing for single chord clicks
      const notes = getChordNotes(chordName);
      if (!notes) return { voicing: [] };
      
      voicing = [];
      notes.forEach((note, idx) => {
        voicing.push(noteToMidi(note, idx === 0 ? 3 : 4)); // Bass + chord tones
      });
      voicing = voicing.sort((a, b) => a - b);
    }
    
    if (voicing.length) {
      await playMidiNotes(voicing, duration);
    }
    
    return { voicing };
  } catch (error) {
    console.error("✗ Could not play chord:", error);
    return { voicing: [] };
  }
}

async function playChord(chordName, duration = 1.0) {
  // For direct chord clicks (Circle, chord table cells) - no voicing optimization
  await playSoundChord(chordName, duration, false, null);
}

// Previous old playChord kept for reference (now calls unified engine above):
async function playProgression(chords, tempo = 90) {
  if (!chords.length) return;

  const msPerChord = (60 / tempo) * 2 * 1000;
  let previousVoicing = null;

  for (const chord of chords) {
    // Use unified engine with voicing smoothing
    const { voicing } = await playSoundChord(chord, (msPerChord / 1000) * 0.9, true, previousVoicing);
    previousVoicing = voicing;
    await new Promise(resolve => setTimeout(resolve, msPerChord));
  }
}

function getChordForKey(keyName) {
  const keyData = appData?.musicData?.[keyName];
  if (!keyData?.chords?.length) return null;
  return keyData.chords[0];
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
  renderCircleOfFifths(
    circleContainer,
    selectedKey,
    async newKey => {
      selectedKey = newKey;
      refreshKeyUI();

      const clickedChord = getChordForKey(newKey);
      if (clickedChord) {
        try {
          await ensureAudioReady();
          await playChord(clickedChord, 1.1);
        } catch (error) {
          console.warn("Could not play clicked chord:", error);
        }
      }
    },
    appData.musicData,
    chordName => {
      appendChordToProgression(chordName);
    }
  );

  renderKeyInfo(
    keyInfo,
    appData.musicData,
    selectedKey,
    async chord => {
      console.log("⭕ Chord cell callback triggered for:", chord);
      try {
        await ensureAudioReady();
        console.log("▶ Audio ready, calling playChord");
        await playChord(chord, 1.0);
      } catch (error) {
        console.error("✗ Could not play chord:", error);
      }
    },
    chord => {
      appendChordToProgression(chord);
    }
  );

  // Extract root note from selected key and render chord loader
  const rootNote = selectedKey.split(" ")[0]; // Get first word (e.g., "C" from "C Major")
  renderChordLoader(rootNote);
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

  // Callback to play suggested chord
  const onSuggestedChordClick = async (chordName) => {
    try {
      await ensureAudioReady();
      await playChord(chordName, 1.0);
    } catch (error) {
      console.error("✗ Could not play suggested chord:", error);
    }
  };

  // Callback to add suggested chord to progression
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

function initTooltips() {
  const tip = document.createElement("div");
  tip.className = "app-tooltip";
  tip.setAttribute("aria-hidden", "true");
  document.body.appendChild(tip);

  function position(e) {
    const margin = 12;
    let x = e.clientX + margin;
    let y = e.clientY - 34;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = e.clientX - tip.offsetWidth - margin;
    if (y < 8) y = e.clientY + margin;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }

  document.addEventListener("mouseover", e => {
    const el = e.target.closest("[data-tooltip]");
    if (!el) { tip.style.display = "none"; return; }
    tip.textContent = el.dataset.tooltip;
    tip.style.display = "block";
    position(e);
  });

  document.addEventListener("mousemove", e => {
    if (tip.style.display === "block") position(e);
  });

  document.addEventListener("mouseout", e => {
    if (!e.relatedTarget || !e.relatedTarget.closest("[data-tooltip]")) {
      tip.style.display = "none";
    }
  });
}

async function init() {
  try {
    console.log("🚀 App initializing...");
    appData = await loadAllData();
    console.log("✓ Data loaded");

    populateFeelings(feelingSelect, appData.moodBoosts);
    // Wire styleSelect so changing the style updates the displayed key
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

    // Initialize SoundFont on first user interaction
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