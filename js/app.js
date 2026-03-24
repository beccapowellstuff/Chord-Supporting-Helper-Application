import { loadAllData } from "./dataLoader.js";
import { getSuggestions, parseProgression } from "./engine.js";
import {
  populateFeelings,
  renderSuggestions,
  renderError,
  renderKeyInfo
} from "./ui.js";
import { renderCircleOfFifths } from "./circle.js";

const progressionInput = document.getElementById("progression");
const feelingSelect = document.getElementById("feeling");
const suggestBtn = document.getElementById("suggestBtn");
const playProgressionBtn = document.getElementById("playProgressionBtn");
const results = document.getElementById("results");
const circleContainer = document.getElementById("circleContainer");
const keyInfo = document.getElementById("keyInfo");

let appData = null;
let selectedKey = "C Major";
let audioContext = null;

const NOTE_TO_PC = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
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
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#"
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
  let intervals = [0, 4, 7];

  if (!root) return null;

  if (root.endsWith("dim")) {
    root = root.slice(0, -3);
    intervals = [0, 3, 6];
  } else if (root.endsWith("m")) {
    root = root.slice(0, -1);
    intervals = [0, 3, 7];
  }

  root = normaliseRoot(root);

  const third = transpose(root, intervals[1]);
  const fifth = transpose(root, intervals[2]);

  if (!root || !third || !fifth) return null;

  return [root, third, fifth];
}

function buildVoicings(chordName) {
  const notes = getChordNotes(chordName);
  if (!notes) return [];

  const rootPosition = [
    noteToMidi(notes[0], 4),
    noteToMidi(notes[1], 4),
    noteToMidi(notes[2], 4)
  ].sort((a, b) => a - b);

  const firstInversion = [
    noteToMidi(notes[0], 5),
    noteToMidi(notes[1], 4),
    noteToMidi(notes[2], 4)
  ].sort((a, b) => a - b);

  const secondInversion = [
    noteToMidi(notes[0], 5),
    noteToMidi(notes[1], 5),
    noteToMidi(notes[2], 4)
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
  if (!midiNotes.length) return;

  const ctx = await ensureAudioReady();
  const now = ctx.currentTime;

  midiNotes.forEach((midi, index) => {
    const frequency = midiToFrequency(midi);
    if (!frequency) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05 + index * 0.01, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  });
}

async function playChord(chordName, duration = 1.0) {
  let root = String(chordName || "").trim();
  let intervals = [0, 4, 7];

  if (!root) return;

  if (root.endsWith("dim")) {
    root = root.slice(0, -3);
    intervals = [0, 3, 6];
  } else if (root.endsWith("m")) {
    root = root.slice(0, -1);
    intervals = [0, 3, 7];
  }

  root = normaliseRoot(root);

  const rootMidiMap = {
    C: 60,
    "C#": 61,
    D: 62,
    "D#": 63,
    E: 64,
    F: 65,
    "F#": 66,
    G: 67,
    "G#": 68,
    A: 69,
    "A#": 70,
    B: 71
  };

  const baseMidi = rootMidiMap[root];
  if (baseMidi == null) return;

  const voicing = [
    baseMidi,
    baseMidi + intervals[1],
    baseMidi + intervals[2]
  ];

  await playChordVoicing(voicing, duration);
}

async function playProgression(chords, tempo = 90) {
  if (!chords.length) return;

  const msPerChord = (60 / tempo) * 2 * 1000;
  let previousVoicing = null;

  for (const chord of chords) {
    const voicing = chooseVoicing(chord, previousVoicing);
    await playChordVoicing(voicing, (msPerChord / 1000) * 0.9);
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
          await playChord(clickedChord, 1.1);
        } catch (error) {
          console.warn("Could not play clicked chord:", error);
        }
      }
    },
    appData.musicData
  );

  renderKeyInfo(keyInfo, appData.musicData, selectedKey);
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

  renderSuggestions(results, suggestionPayload, appData.musicData, selectedKey);
}

async function handlePlayProgression() {
  const keyData = appData?.musicData?.[selectedKey];
  if (!keyData) return;

  const { parsed } = parseProgression(progressionInput.value, keyData);
  const chordList = extractChordList(parsed);

  if (!chordList.length) return;

  try {
    await playProgression(chordList, 90);
  } catch (error) {
    console.error("Could not play progression:", error);
  }
}

async function init() {
  try {
    appData = await loadAllData();

    populateFeelings(feelingSelect, appData.moodBoosts);
    refreshKeyUI();

    suggestBtn.addEventListener("click", runSuggestions);

    if (playProgressionBtn) {
      playProgressionBtn.addEventListener("click", handlePlayProgression);
    }

    document.addEventListener(
      "click",
      async () => {
        try {
          await ensureAudioReady();
        } catch (error) {
          console.warn("Audio initialisation failed:", error);
        }
      },
      { once: true }
    );
  } catch (error) {
    console.error(error);
    renderError(results, "Failed to load app data.");
  }
}

init();