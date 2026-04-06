/**
 * app.js — Application entry point and orchestration
 *
 * Responsibilities:
 *   - Initialises the app and loads all data via dataLoader
 *   - Holds the shared application state for key/chord context
 *   - Wires all UI events (root selector, style select, suggest button,
 *     play button, auto-suggest toggle, chord loader add/play actions)
 *   - Delegates every concern to the appropriate module — no note math,
 *     no audio logic, and no DOM building lives here
 *
 * Depends on: dataLoader, engine, ui, rootSelector, synth, chordNotes, playback
 */
import { loadAllData } from "./dataLoader.js";
import { getSuggestions } from "./engine.js";
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
  AUDIO_STATUS_EVENT,
  playMidiNote,
  playMidiNotes,
  playMetronomeTick,
  playMidiNoteSpecs,
  ensureAudioContext,
  stopAllPlayback
} from "./synth.js";
import {
  noteToMidi,
  normaliseRoot,
  NOTE_TO_PC,
  parseChordName,
  identifyChordFromMidiNotes,
  pitchClassToDisplayNote
} from "./chordNotes.js";
import { getAscendingRootVoicing, getInversionOptions, getVoicingOptions } from "./chordVoicing.js";
import { ensureAudioReady, playChord, playProgression } from "./playback.js";
import {
  appendProgressionItem,
  BASIC_VOICING_MODE,
  buildProgressionSavePayload,
  DEFAULT_NOTE_VELOCITY,
  DEFAULT_TEMPO_BPM,
  DEFAULT_TIME_SIGNATURE,
  getBeatsPerBar,
  importProgressionFromSavedData,
  importProgressionFromText,
  normalizeMidiVelocity,
  normalizeTempoBpm,
  normalizeVoicingMode,
  normalizeTimeSignature,
  progressionItemsToChords,
  progressionItemsToText,
  rebuildProgressionItems,
  renderProgressionBlocks,
  renderProgressionEditor,
  velocityPresetToMidi
} from "./progressionBuilder.js";

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
const playFromSelectedBtn = document.getElementById("playFromSelectedBtn");
const newProgressionBtn = document.getElementById("newProgressionBtn");
const newProgressionConfirmPopover = document.getElementById("newProgressionConfirmPopover");
const confirmNewProgressionBtn = document.getElementById("confirmNewProgressionBtn");
const cancelNewProgressionBtn = document.getElementById("cancelNewProgressionBtn");
const loadDemoProgressionBtn = document.getElementById("loadDemoProgressionBtn");
const demoMenuPopover = document.getElementById("demoMenuPopover");
const demoMenuList = document.getElementById("demoMenuList");
const saveProgressionBtn = document.getElementById("saveProgressionBtn");
const loadProgressionBtn = document.getElementById("loadProgressionBtn");
const loadProgressionInput = document.getElementById("loadProgressionInput");
const progressionBlocks = document.getElementById("progressionBlocks");
const progressionSequenceKeyBadge = document.getElementById("progressionSequenceKeyBadge");
const progressionEditor = document.getElementById("progressionEditor");
const sectionHelpModal = document.getElementById("sectionHelpModal");
const sectionHelpModalTitle = document.getElementById("sectionHelpModalTitle");
const sectionHelpModalBody = document.getElementById("sectionHelpModalBody");
const sectionHelpModalClose = document.getElementById("sectionHelpModalClose");
const sequenceTempoBpmInput = document.getElementById("sequenceTempoBpm");
const metronomeToggleBtn = document.getElementById("metronomeToggleBtn");
const metronomePopover = document.getElementById("metronomePopover");
const metronomeVolumeInput = document.getElementById("metronomeVolume");
const metronomeVolumeValue = document.getElementById("metronomeVolumeValue");
const metronomeStartStopBtn = document.getElementById("metronomeStartStopBtn");
const audioStatus = document.getElementById("audioStatus");
const audioStatusMessage = document.getElementById("audioStatusMessage");
const sequenceTimeSignatureSelect = document.getElementById("sequenceTimeSignature");
const results = document.getElementById("results");
const rootContainer = document.getElementById("rootContainer");
const keyInfo = document.getElementById("keyInfo");
const chordButtons = document.getElementById("chordButtons");
const bassRootSelector = document.getElementById("bassRootSelector");
const chordRootSelector = document.getElementById("chordRootSelector");
const sequenceKeyboard = document.getElementById("sequenceKeyboard");
const sequenceKeyboardToolbarMount = document.getElementById("sequenceKeyboardToolbarMount");
const appVersion = document.getElementById("appVersion");
const toolNavButtons = document.querySelectorAll(".tool-nav-btn");
const toolPanels = document.querySelectorAll(".tool-panel");
const toolContextBlocks = document.querySelectorAll("[data-tool-context]");
const sectionHelpButtons = document.querySelectorAll("[data-help-topic]");

let appData = null;
const appState = {
  selectedKey: "C Ionian",
  selectedChordRoot: "C",
  selectedBassRoot: "C",
  keyExplorerSelectedChord: "",
  keyExplorerSelectedInversion: "0",
  keyExplorerSelectedVoicing: "close",
  chordExplorerSelectedChord: "",
  chordExplorerSelectedInversion: "0",
  chordExplorerSelectedVoicing: "close",
  suggestionEngineSelectedChord: "",
  suggestionEngineSelectedInversion: "0",
  suggestionEngineSelectedVoicing: "close",
  keyChordSet: null,
  sequenceTempoBpm: DEFAULT_TEMPO_BPM,
  metronomeArmed: false,
  metronomeVolume: 40,
  metronomePopoverOpen: false,
  newProgressionConfirmOpen: false,
  sectionHelpTopic: "",
  demoMenuOpen: false,
  audioStatusMessage: "",
  sequenceTimeSignature: DEFAULT_TIME_SIGNATURE,
  progressionItems: [],
  selectedProgressionItemId: null,
  insertChoiceOpen: false,
  editingProgressionItemId: null,
  editingProgressionAnchorRect: null,
  playingProgressionItemId: null,
  isPlayingProgression: false,
  progressionInvalidTokens: []
};
window.appState = appState;
let sequenceKeyboardMidiNotes = [];
let sequenceKeyboardFlashMidiNotes = [];
let sequenceKeyboardDisplayMidiNotes = [];
let identifiedSequenceChord = null;
let lockedSequenceChordName = "";
let lockedSequenceChordInversionLabel = "";
let lockedSequenceChordVoicingLabel = "";
let lockedSequenceChordInversionShortLabel = "";
let lockedSequenceChordVoicingShortLabel = "";
let sequenceKeyboardFlashTimeout = null;
const SEQUENCE_KEYBOARD_MIN_MIDI = 48; // C3
const SEQUENCE_KEYBOARD_MAX_MIDI = 95; // B6
const PLAYBACK_MIN_MIDI = 36; // C2
const TOOL_PANEL_TRANSITION_MS = 180;
const DEFAULT_METRONOME_VOLUME = 40;
let activeToolPanelId = "keyExplorerPanel";
let toolPanelTransitionTimeout = null;
let progressionPreviewToken = 0;
let activeProgressionPlaybackSession = null;
let activeProgressionPlaybackMode = null;
let removeAudioPrimingListeners = null;
let isPrimingAudio = false;
let musicDemoEntries = [];
let isLoadingMusicDemos = false;

const DEFAULT_MUSIC_DEMO_FILE = "Demo01-cIonian.json";
const MUSIC_DEMOS_DIR_PATH = "./Music%20Demos/";
const MUSIC_DEMOS_ENDPOINT_PATH = "./__music-demos";
const SECTION_HELP_CONTENT = {
  "progression-builder": {
    title: "Progression Builder",
    intro: "This is the main workspace for building, hearing, saving, and editing your progression.",
    sections: [
      {
        title: "What It Does",
        paragraphs: [
          "Progression Builder brings the Keyboard, Chord Sequence, playback controls, timing controls, demos, and file actions together in one place."
        ]
      },
      {
        title: "How To Use It",
        items: [
          "Build chords on the Keyboard, or add them from Key Explorer, Chord Explorer, and Suggestion Engine.",
          "Arrange and edit the progression in the Chord Sequence area.",
          "Use Play sequence or Play from selected to hear the progression, with optional metronome support.",
          "Use Demo, Save progression, Load progression, and Clear chord sequence to manage your work."
        ]
      }
    ]
  },
  keyboard: {
    title: "Keyboard",
    intro: "The Keyboard is your manual chord play area for trying notes, hearing them, and saving the exact shape you choose.",
    sections: [
      {
        title: "What It Does",
        paragraphs: [
          "It lets you click notes on the keyboard, hear them immediately, recognise the chord when possible, and store those exact notes in the progression."
        ]
      },
      {
        title: "How To Use It",
        items: [
          "Click keys to add or remove notes from the current chord.",
          "Use Play to hear the selected notes and Add to save them as a new progression block.",
          "Select a progression block first to use Update, Insert, Split, Duplicate, or Delete.",
          "Manual keyboard saves keep the exact notes you chose, instead of auto-generating a different bass note."
        ]
      }
    ]
  },
  "chord-sequence": {
    title: "Chord Sequence",
    intro: "The Chord Sequence is the visual timeline of your progression.",
    sections: [
      {
        title: "What It Does",
        paragraphs: [
          "Each block represents a chord item, with width based on beat length and markers showing where bars begin."
        ]
      },
      {
        title: "How To Use It",
        items: [
          "Single-click a block to select and audition it.",
          "Double-click a block to open the editor and adjust beats, sustain, and saved voicing notes.",
          "Use Tempo, Time Signature, and Metronome to shape how the sequence plays back.",
          "Use Demo to load an example progression and compare ideas quickly."
        ]
      }
    ]
  },
  "key-explorer": {
    title: "Key Explorer",
    intro: "Key Explorer helps you learn a key by showing the mode details and the seven diatonic chords that belong to it.",
    sections: [
      {
        title: "What It Does",
        paragraphs: [
          "Choose a scale root and mode, then see key details, scale notes, and the diatonic chord set for that key."
        ]
      },
      {
        title: "How To Use It",
        items: [
          "Pick the scale root on the left and the mode on the right.",
          "Read the Key Details card for the tonic chord, scale notes, characteristic note, and mode character.",
          "Click a chord card to hear it, then use the shared Inversion and Voicing bar to explore different shapes.",
          "Use the plus button to add the currently selected version of that chord to the progression."
        ]
      }
    ]
  },
  "chord-explorer": {
    title: "Chord Explorer",
    intro: "Chord Explorer is for trying any chord quality you want, whether it fits the current key or not.",
    sections: [
      {
        title: "What It Does",
        paragraphs: [
          "It lets you choose a bass root and chord root, browse chord families, and compare how those chords relate to the current key."
        ]
      },
      {
        title: "How To Use It",
        items: [
          "Choose the bass root and chord root at the top of the panel.",
          "Switch between Common Chords, Advanced Chords, and All Chords depending on how much you want to see.",
          "Use the color legend to spot whether a chord is in-key, related, or outside the current key.",
          "Click a chord to hear it, reshape it with the shared Inversion and Voicing bar, and use plus to add it to the progression."
        ]
      }
    ]
  },
  "suggestion-engine": {
    title: "Suggestion Engine",
    intro: "Suggestion Engine offers possible next chords based on your current key, progression, and chosen feeling.",
    sections: [
      {
        title: "What It Does",
        paragraphs: [
          "It tries to generate musically relevant ideas that you can audition and drop straight into the progression."
        ]
      },
      {
        title: "How To Use It",
        items: [
          "Choose a Feeling to guide the type of suggestions you want.",
          "Use Refresh to ask for a new pass, or turn on auto-refresh if you want updates as you add chords.",
          "Click a suggestion to hear it, then use the shared Inversion and Voicing bar to explore alternate shapes.",
          "Use the plus button to add a suggestion directly into the progression."
        ]
      },
      {
        title: "Current State",
        paragraphs: [
          "This section is still MVP, so it is best treated as a creative idea generator rather than a final musical authority."
        ]
      }
    ]
  }
};

function syncKeyExplorerSelection() {
  const keyChords = appData?.musicData?.[appState.selectedKey]?.chords || [];

  if (!keyChords.length) {
    appState.keyExplorerSelectedChord = "";
    appState.keyExplorerSelectedInversion = "0";
    appState.keyExplorerSelectedVoicing = "close";
    return;
  }

  if (appState.keyExplorerSelectedChord && !keyChords.includes(appState.keyExplorerSelectedChord)) {
    appState.keyExplorerSelectedChord = "";
    appState.keyExplorerSelectedInversion = "0";
    appState.keyExplorerSelectedVoicing = "close";
  }
}

function resetToolSelection(toolKey) {
  appState[`${toolKey}SelectedChord`] = "";
  appState[`${toolKey}SelectedInversion`] = "0";
  appState[`${toolKey}SelectedVoicing`] = "close";
}

function setToolSelection(toolKey, chord = "", inversionValue = "0", voicingValue = "close") {
  appState[`${toolKey}SelectedChord`] = chord;
  appState[`${toolKey}SelectedInversion`] = String(inversionValue);
  appState[`${toolKey}SelectedVoicing`] = String(voicingValue);
}

function getToolSelection(toolKey) {
  return {
    chord: appState[`${toolKey}SelectedChord`] || "",
    inversionValue: String(appState[`${toolKey}SelectedInversion`] ?? "0"),
    voicingValue: String(appState[`${toolKey}SelectedVoicing`] ?? "close")
  };
}

function syncChordExplorerSelection() {
  const { chord } = getToolSelection("chordExplorer");
  if (!chord) {
    return;
  }

  const parsed = parseChordName(chord);
  const activeBassRoot = appState.selectedBassRoot || appState.selectedChordRoot;
  if (!parsed || parsed.root !== appState.selectedChordRoot || (parsed.bass || parsed.root) !== activeBassRoot) {
    resetToolSelection("chordExplorer");
  }
}

function syncSuggestionEngineSelection(suggestions = []) {
  const { chord } = getToolSelection("suggestionEngine");
  if (!chord) {
    return;
  }

  if (!suggestions.some(item => item?.chord === chord)) {
    resetToolSelection("suggestionEngine");
  }
}

function getSelectedVoicingPlayback(chord, inversionValue = "0", voicingValue = "close") {
  const selectedOption = getInversionOptions(chord, voicingValue)
    .find(option => option.value === String(inversionValue));
  if (!selectedOption?.voicing?.length) {
    return null;
  }

  const selectedVoicing = getVoicingOptions(chord)
    .find(option => option.value === String(voicingValue));

  return {
    notes: selectedOption.voicing,
    inversionLabel: selectedOption.label,
    inversionShortLabel: selectedOption.shortLabel || "",
    voicingLabel: selectedVoicing?.label || "Close",
    voicingShortLabel: selectedVoicing?.shortLabel || ""
  };
}

async function playToolSelection(toolKey, refreshUi, chord, inversionValue = "0", voicingValue = "close") {
  setToolSelection(toolKey, chord, inversionValue, voicingValue);
  if (typeof refreshUi === "function") {
    refreshUi();
  }

  const selectedPlayback = getSelectedVoicingPlayback(chord, inversionValue, voicingValue);
  if (!selectedPlayback) {
    return;
  }

  await ensureAudioReady();
  await playVoicingWithSequenceKeyboard(selectedPlayback.notes, chord, 1.0, {
    inversionLabel: selectedPlayback.inversionLabel,
    inversionShortLabel: selectedPlayback.inversionShortLabel,
    voicingLabel: selectedPlayback.voicingLabel,
    voicingShortLabel: selectedPlayback.voicingShortLabel
  });
}

function getToolSelectionProgressionOverrides(toolKey, chord, source) {
  const selection = getToolSelection(toolKey);
  if (!chord || chord !== selection.chord) {
    return {};
  }

  const selectedPlayback = getSelectedVoicingPlayback(chord, selection.inversionValue, selection.voicingValue);
  if (!selectedPlayback) {
    return {};
  }

  return {
    voicing: {
      source,
      inversionLabel: selectedPlayback.inversionLabel,
      inversionShortLabel: selectedPlayback.inversionShortLabel,
      voicingLabel: selectedPlayback.voicingLabel,
      voicingShortLabel: selectedPlayback.voicingShortLabel,
      notes: selectedPlayback.notes.map(midi => ({
        midi,
        velocity: DEFAULT_NOTE_VELOCITY
      }))
    }
  };
}

function formatSequenceKeyboardSelectionLabel(inversionLabel = "", voicingLabel = "") {
  const parts = [];
  const normalizedInversion = String(inversionLabel || "").trim();
  const normalizedVoicing = String(voicingLabel || "").trim();

  if (normalizedInversion && normalizedInversion !== "Root") {
    parts.push(normalizedInversion);
  }

  if (normalizedVoicing && normalizedVoicing !== "Close") {
    parts.push(normalizedVoicing);
  }

  return parts.join(", ");
}

function renderAudioStatus() {
  const message = String(appState.audioStatusMessage || "").trim();

  if (audioStatusMessage) {
    audioStatusMessage.textContent = message;
  }

  if (audioStatus) {
    audioStatus.hidden = !message;
  }
}

function buildSectionHelpModalContent(topic) {
  const helpContent = SECTION_HELP_CONTENT[topic];
  if (!helpContent || !sectionHelpModalTitle || !sectionHelpModalBody) {
    return;
  }

  sectionHelpModalTitle.textContent = helpContent.title;
  sectionHelpModalBody.replaceChildren();

  if (helpContent.intro) {
    const intro = document.createElement("p");
    intro.className = "section-help-modal-intro";
    intro.textContent = helpContent.intro;
    sectionHelpModalBody.appendChild(intro);
  }

  (helpContent.sections || []).forEach(section => {
    const sectionElement = document.createElement("section");
    sectionElement.className = "section-help-modal-section";

    const heading = document.createElement("h3");
    heading.className = "section-help-modal-section-title";
    heading.textContent = section.title;
    sectionElement.appendChild(heading);

    (section.paragraphs || []).forEach(text => {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      sectionElement.appendChild(paragraph);
    });

    if (Array.isArray(section.items) && section.items.length) {
      const list = document.createElement("ul");
      section.items.forEach(item => {
        const listItem = document.createElement("li");
        listItem.textContent = item;
        list.appendChild(listItem);
      });
      sectionElement.appendChild(list);
    }

    sectionHelpModalBody.appendChild(sectionElement);
  });
}

function renderSectionHelpModal() {
  if (!sectionHelpModal) {
    return;
  }

  const topic = String(appState.sectionHelpTopic || "").trim();
  sectionHelpModal.hidden = !topic;
  if (!topic) {
    return;
  }

  buildSectionHelpModalContent(topic);
}

function closeSectionHelpModal() {
  if (!appState.sectionHelpTopic) {
    return;
  }

  appState.sectionHelpTopic = "";
  renderSectionHelpModal();
}

function openSectionHelpModal(topic) {
  const normalizedTopic = String(topic || "").trim();
  if (!SECTION_HELP_CONTENT[normalizedTopic]) {
    return;
  }

  appState.sectionHelpTopic = normalizedTopic;
  renderSectionHelpModal();
  sectionHelpModalClose?.focus();
}

async function attemptAudioPriming() {
  if (isPrimingAudio) {
    return;
  }

  isPrimingAudio = true;
  try {
    await ensureAudioContext();
    if (removeAudioPrimingListeners) {
      removeAudioPrimingListeners();
    }
  } catch (error) {
    console.debug("Audio priming will retry on the next interaction.", error);
  } finally {
    isPrimingAudio = false;
  }
}

function installAudioPrimingListeners() {
  if (removeAudioPrimingListeners) {
    return;
  }

  const handleUserInteraction = () => {
    void attemptAudioPriming();
  };

  document.addEventListener("pointerdown", handleUserInteraction);
  document.addEventListener("keydown", handleUserInteraction);
  removeAudioPrimingListeners = () => {
    document.removeEventListener("pointerdown", handleUserInteraction);
    document.removeEventListener("keydown", handleUserInteraction);
    removeAudioPrimingListeners = null;
  };
}

window.addEventListener(AUDIO_STATUS_EVENT, event => {
  const { state = "idle", message = "" } = event.detail || {};

  appState.audioStatusMessage = state === "error" ? String(message || "").trim() : "";
  renderAudioStatus();
});

installAudioPrimingListeners();
renderAudioStatus();
renderSectionHelpModal();

function updateKeyChordSet() {
  if (!appData || !appState.selectedKey) {
    appState.keyChordSet = null;
    return;
  }

  const keyData = appData.musicData?.[appState.selectedKey];
  appState.keyChordSet = Array.isArray(keyData?.chords)
    ? [...keyData.chords]
    : null;
}

function normalizeMetronomeVolume(volume, fallback = DEFAULT_METRONOME_VOLUME) {
  const numericVolume = Number(volume);
  if (!Number.isFinite(numericVolume)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numericVolume)));
}

function getMetronomeLevel() {
  return normalizeMetronomeVolume(appState.metronomeVolume, DEFAULT_METRONOME_VOLUME) / 100;
}

async function triggerMetronomeBeat(isBarAccent = false) {
  try {
    await playMetronomeTick(isBarAccent, getMetronomeLevel());
  } catch (error) {
    console.warn("Could not play metronome tick:", error);
  }
}

function renderMetronomeUI() {
  const metronomeVolume = normalizeMetronomeVolume(appState.metronomeVolume, DEFAULT_METRONOME_VOLUME);
  const isPlaybackMetronomeActive = appState.isPlayingProgression && appState.metronomeArmed;

  if (metronomeVolumeInput) {
    metronomeVolumeInput.value = String(metronomeVolume);
  }

  if (metronomeVolumeValue) {
    metronomeVolumeValue.textContent = `${metronomeVolume}%`;
  }

  if (metronomePopover) {
    metronomePopover.hidden = !appState.metronomePopoverOpen;
  }

  if (metronomeToggleBtn) {
    metronomeToggleBtn.setAttribute("aria-expanded", String(appState.metronomePopoverOpen));
    metronomeToggleBtn.classList.toggle(
      "progression-sequence-metronome-btn-active",
      appState.metronomePopoverOpen || appState.metronomeArmed
    );
    metronomeToggleBtn.classList.toggle(
      "progression-sequence-metronome-btn-running",
      isPlaybackMetronomeActive
    );
    metronomeToggleBtn.title =
      appState.metronomeArmed
        ? "Metronome is armed for playback"
        : "Metronome is off";
  }

  if (metronomeStartStopBtn) {
    metronomeStartStopBtn.textContent = appState.metronomeArmed ? "Stop" : "Arm";
    metronomeStartStopBtn.setAttribute("aria-pressed", String(appState.metronomeArmed));
    metronomeStartStopBtn.classList.toggle("progression-metronome-arm-btn-active", appState.metronomeArmed);
    metronomeStartStopBtn.title = appState.metronomeArmed
      ? "Turn the metronome off"
      : "Arm the metronome so it joins playback";
  }
}

function setIconButtonLabel(button, label) {
  if (!button) {
    return;
  }

  button.setAttribute("aria-label", label);
  const hiddenLabel = button.querySelector(".visually-hidden");
  if (hiddenLabel) {
    hiddenLabel.textContent = label;
  }
}

function setIconButtonState(button, { label, icon, active = false, disabled = false, pressed = null }) {
  if (!button) {
    return;
  }

  setIconButtonLabel(button, label);
  button.dataset.icon = icon;
  button.disabled = Boolean(disabled);
  button.classList.toggle("app-icon-button-active", Boolean(active));
  if (pressed == null) {
    button.removeAttribute("aria-pressed");
  } else {
    button.setAttribute("aria-pressed", String(Boolean(pressed)));
  }
}

function closeMetronomePopover() {
  if (!appState.metronomePopoverOpen) {
    return;
  }

  appState.metronomePopoverOpen = false;
  renderMetronomeUI();
}

function formatAccidentalDisplay(value) {
  return String(value || "")
    .replace(/b/g, "\u266d")
    .replace(/#/g, "\u266f");
}

function updateToolContext() {
  const selectedKeyParts = String(appState.selectedKey || "").trim().split(" ");
  const root = selectedKeyParts[0] || "No key";
  const mode = selectedKeyParts.slice(1).join(" ") || "No mode";

  toolContextBlocks.forEach(block => {
    const rootEl = block.querySelector("[data-tool-context-root]");
    const modeEl = block.querySelector("[data-tool-context-mode]");

    if (rootEl) {
      rootEl.textContent = formatAccidentalDisplay(root);
    }

    if (modeEl) {
      modeEl.textContent = mode;
    }
  });
}

function updateActiveToolButtons(panelId) {
  toolNavButtons.forEach(button => {
    const isActive = button.getAttribute("data-tool-panel") === panelId;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function setActiveToolPanel(panelId, options = {}) {
  const { immediate = false } = options;
  const nextPanel = document.getElementById(panelId);

  if (!nextPanel || (!immediate && panelId === activeToolPanelId)) {
    return;
  }

  const currentPanel = document.getElementById(activeToolPanelId);
  activeToolPanelId = panelId;
  updateActiveToolButtons(panelId);

  if (toolPanelTransitionTimeout) {
    clearTimeout(toolPanelTransitionTimeout);
    toolPanelTransitionTimeout = null;
  }

  toolPanels.forEach(panel => {
    if (panel !== currentPanel && panel !== nextPanel) {
      panel.hidden = true;
      panel.classList.remove("tool-panel-active", "tool-panel-exiting");
    }
  });

  if (immediate || !currentPanel || currentPanel === nextPanel) {
    toolPanels.forEach(panel => {
      const isActive = panel === nextPanel;
      panel.hidden = !isActive;
      panel.classList.toggle("tool-panel-active", isActive);
      panel.classList.remove("tool-panel-exiting");
    });

    if (panelId === "suggestionEnginePanel" && appData) {
      runSuggestions();
    }
    return;
  }

  nextPanel.hidden = false;
  nextPanel.classList.remove("tool-panel-exiting");

  requestAnimationFrame(() => {
    nextPanel.classList.add("tool-panel-active");
    currentPanel.classList.remove("tool-panel-active");
    currentPanel.classList.add("tool-panel-exiting");
  });

  toolPanelTransitionTimeout = setTimeout(() => {
    currentPanel.hidden = true;
    currentPanel.classList.remove("tool-panel-exiting");
    toolPanelTransitionTimeout = null;
  }, TOOL_PANEL_TRANSITION_MS);

  if (panelId === "suggestionEnginePanel" && appData) {
    runSuggestions();
  }
}

function initToolNavigation() {
  toolNavButtons.forEach(button => {
    button.addEventListener("click", () => {
      const panelId = button.getAttribute("data-tool-panel");
      if (!panelId) return;
      setActiveToolPanel(panelId);
    });
  });

  setActiveToolPanel("keyExplorerPanel", { immediate: true });
}

function getCurrentKeyData() {
  return appData?.musicData?.[appState.selectedKey] || null;
}

function syncProgressionTextFromState() {
  const nextText = progressionItemsToText(appState.progressionItems);
  if (progressionInput.value !== nextText) {
    progressionInput.value = nextText;
  }
}

function getCurrentSequenceSettings() {
  return {
    tempoBpm: appState.sequenceTempoBpm,
    timeSignature: appState.sequenceTimeSignature
  };
}

function getProgressionBlockAnchorRect(itemId, fallbackRect = null) {
  const block = progressionBlocks?.querySelector(`[data-progression-block-id="${itemId}"]`);
  const rect = block?.getBoundingClientRect?.();
  if (rect && rect.width > 0 && rect.height > 0) {
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    };
  }

  if (fallbackRect?.width > 0 && fallbackRect?.height > 0) {
    return fallbackRect;
  }

  return null;
}

function renderProgressionBuilderUI() {
  if (sequenceTempoBpmInput) {
    sequenceTempoBpmInput.value = String(appState.sequenceTempoBpm);
  }

  renderMetronomeUI();
  renderNewProgressionConfirm();

  if (sequenceTimeSignatureSelect) {
    sequenceTimeSignatureSelect.value = appState.sequenceTimeSignature;
  }

  if (progressionSequenceKeyBadge) {
    const [root = "", ...modeParts] = String(appState.selectedKey || "").trim().split(" ");
    const mode = modeParts.join(" ").trim();
    progressionSequenceKeyBadge.textContent = [root, mode].filter(Boolean).join("-");
  }

  renderProgressionBlocks(
    progressionBlocks,
    appState.progressionItems,
    appState.selectedProgressionItemId,
    appState.playingProgressionItemId,
    getBeatsPerBar(appState.sequenceTimeSignature),
    selectedId => {
      appState.selectedProgressionItemId = selectedId;
      appState.insertChoiceOpen = false;
      renderProgressionBuilderUI();
      void previewProgressionItemSelection(selectedId);
    },
    (editingId, anchorRect) => {
      appState.selectedProgressionItemId = editingId;
      appState.insertChoiceOpen = false;
      appState.editingProgressionItemId = editingId;
      renderProgressionBuilderUI();
      appState.editingProgressionAnchorRect = getProgressionBlockAnchorRect(editingId, anchorRect);
      renderProgressionBuilderUI();
    },
    (draggedId, targetId, placement) => {
      moveProgressionItem(draggedId, targetId, placement);
    }
  );

  const selectedIndex = appState.progressionItems.findIndex(item => item.id === appState.selectedProgressionItemId);
  const selectedItem = selectedIndex >= 0 ? appState.progressionItems[selectedIndex] : null;
  const editingIndex = appState.progressionItems.findIndex(item => item.id === appState.editingProgressionItemId);
  const editingItem = editingIndex >= 0 ? appState.progressionItems[editingIndex] : null;

  renderProgressionEditor(
    progressionEditor,
    editingItem,
    editingIndex >= 0 ? editingIndex : 0,
    appState.progressionItems.length,
    {
      onDurationBeatsChange: nextDurationBeats => {
        updateSelectedProgressionDurationBeats(nextDurationBeats);
      },
      onSustainChange: nextSustain => {
        updateSelectedProgressionSustain(nextSustain);
      },
      onVoicingModeChange: nextMode => {
        updateSelectedProgressionVoicingMode(nextMode);
      },
      onVoicingNotePresetChange: (noteIndex, nextPreset) => {
        updateSelectedProgressionVoicingNotePreset(noteIndex, nextPreset);
      },
      onVoicingNoteVelocityChange: (noteIndex, nextVelocity) => {
        updateSelectedProgressionVoicingNoteVelocity(noteIndex, nextVelocity);
      },
      anchorRect: appState.editingProgressionAnchorRect,
      onClose: () => {
        appState.editingProgressionItemId = null;
        appState.editingProgressionAnchorRect = null;
        renderProgressionBuilderUI();
      }
    }
  );

  if (playProgressionBtn) {
    const isAllPlaybackActive = appState.isPlayingProgression && activeProgressionPlaybackMode === "all";
    const hasProgressionItems = appState.progressionItems.length > 0;
    setIconButtonState(playProgressionBtn, {
      label: isAllPlaybackActive ? "Stop playback" : "Play sequence",
      icon: isAllPlaybackActive ? "stop" : "play-sequence",
      active: isAllPlaybackActive,
      disabled: (appState.isPlayingProgression && !isAllPlaybackActive) || (!appState.isPlayingProgression && !hasProgressionItems),
      pressed: isAllPlaybackActive
    });
    playProgressionBtn.dataset.tooltip = isAllPlaybackActive
      ? "Stop progression playback"
      : "Play all chords in the progression";
  }

  if (playFromSelectedBtn) {
    const isFromPlaybackActive = appState.isPlayingProgression && activeProgressionPlaybackMode === "selected";
    setIconButtonState(playFromSelectedBtn, {
      label: isFromPlaybackActive ? "Stop playback from selected chord" : "Play from",
      icon: isFromPlaybackActive ? "stop" : "play-from",
      active: isFromPlaybackActive,
      disabled: (appState.isPlayingProgression && !isFromPlaybackActive) || (!appState.isPlayingProgression && !appState.selectedProgressionItemId),
      pressed: isFromPlaybackActive
    });
    playFromSelectedBtn.dataset.tooltip = isFromPlaybackActive
      ? "Stop progression playback"
      : "Play the progression from the selected chord";
  }

  if (saveProgressionBtn) {
    const hasProgressionItems = appState.progressionItems.length > 0;
    setIconButtonState(saveProgressionBtn, {
      label: "Save progression",
      icon: "save-progression",
      disabled: !hasProgressionItems
    });
    saveProgressionBtn.dataset.tooltip = hasProgressionItems
      ? "Save the progression with tempo, time signature, and beat lengths"
      : "Add at least one chord before saving the progression";
  }

  if (newProgressionBtn) {
    const hasProgressionContent = Boolean(appState.progressionItems.length || progressionInput?.value?.trim());
    setIconButtonState(newProgressionBtn, {
      label: "Clear chord sequence",
      icon: "reset-progression",
      disabled: !hasProgressionContent
    });
    if (!hasProgressionContent) {
      closeNewProgressionConfirm();
    }
    newProgressionBtn.dataset.tooltip = hasProgressionContent
      ? "Clear every chord from the current sequence"
      : "Add at least one chord before clearing the sequence";
  }

  refreshSequenceKeyboard();
}

function setProgressionItems(items, options = {}) {
  const {
    selectedId = null,
    preserveSelection = false,
    syncText = true
  } = options;

  const nextItems = Array.isArray(items) ? items : [];
  const availableIds = new Set(nextItems.map(item => item.id));

  let nextSelectedId = null;
  if (selectedId && availableIds.has(selectedId)) {
    nextSelectedId = selectedId;
  } else if (preserveSelection && availableIds.has(appState.selectedProgressionItemId)) {
    nextSelectedId = appState.selectedProgressionItemId;
  } else if (nextItems.length) {
    nextSelectedId = nextItems[0].id;
  }

  appState.progressionItems = nextItems;
  appState.selectedProgressionItemId = nextSelectedId;
  if (!nextSelectedId) {
    appState.insertChoiceOpen = false;
  }
  if (!availableIds.has(appState.editingProgressionItemId)) {
    appState.editingProgressionItemId = null;
    appState.editingProgressionAnchorRect = null;
  }

  if (syncText) {
    syncProgressionTextFromState();
  }

  renderProgressionBuilderUI();
}

function importProgressionTextToState(text, options = {}) {
  const keyData = getCurrentKeyData();
  if (!keyData) return;

  const { items, invalid } = importProgressionFromText(
    text,
    keyData,
    appState.progressionItems,
    getCurrentSequenceSettings()
  );
  appState.progressionInvalidTokens = invalid;
  setProgressionItems(items, {
    selectedId: options.selectedId || null,
    preserveSelection: options.preserveSelection || false
  });
}

function refreshProgressionItemsForSelectedKey() {
  if (!appState.progressionItems.length) {
    renderProgressionBuilderUI();
    return;
  }

  const refreshedItems = rebuildProgressionItems(
    appState.progressionItems,
    getCurrentKeyData(),
    getCurrentSequenceSettings()
  );
  setProgressionItems(refreshedItems, { preserveSelection: true });
}

function appendChordToProgression(chordName, overrides = {}) {
  const friendlyChordName = getFriendlyChordName(chordName);
  const nextItems = appendProgressionItem(
    appState.progressionItems,
    friendlyChordName,
    getCurrentKeyData(),
    getCurrentSequenceSettings(),
    overrides
  );
  const selectedId = nextItems.at(-1)?.id || null;

  setProgressionItems(nextItems, { selectedId });

  if (selectedId) {
    void previewProgressionItemSelection(selectedId);
  }

  if (autoSuggestToggle?.checked && appData) {
    runSuggestions();
  }
}

function getKeyExplorerSelectionProgressionOverrides(chord) {
  return getToolSelectionProgressionOverrides("keyExplorer", chord, "key-explorer");
}

function buildClonedProgressionItem(sourceItem, overrides = {}) {
  return appendProgressionItem(
    [],
    sourceItem.chord,
    getCurrentKeyData(),
    getCurrentSequenceSettings(),
    {
      durationBeats: overrides.durationBeats ?? sourceItem.durationBeats,
      sustain: overrides.sustain ?? sourceItem.sustain,
      voicing: overrides.voicing ?? sourceItem.voicing
    }
  )[0] || null;
}

function getSelectedProgressionItem() {
  if (!appState.selectedProgressionItemId) {
    return null;
  }

  return appState.progressionItems.find(item => item.id === appState.selectedProgressionItemId) || null;
}

function canSplitProgressionItem(item) {
  return Number(item?.durationBeats) > 1;
}

function moveProgressionItem(draggedId, targetId, placement = "before") {
  if (!draggedId || !targetId || draggedId === targetId) {
    return;
  }

  const currentItems = [...appState.progressionItems];
  const draggedIndex = currentItems.findIndex(item => item.id === draggedId);
  const targetIndex = currentItems.findIndex(item => item.id === targetId);

  if (draggedIndex < 0 || targetIndex < 0) {
    return;
  }

  const [movedItem] = currentItems.splice(draggedIndex, 1);
  const targetIndexAfterRemoval = currentItems.findIndex(item => item.id === targetId);
  const insertionIndex = placement === "after"
    ? targetIndexAfterRemoval + 1
    : targetIndexAfterRemoval;

  currentItems.splice(Math.max(0, insertionIndex), 0, movedItem);

  setProgressionItems(currentItems, {
    selectedId: movedItem.id,
    preserveSelection: true
  });

  if (appState.editingProgressionItemId === movedItem.id) {
    appState.editingProgressionAnchorRect = getProgressionBlockAnchorRect(movedItem.id, appState.editingProgressionAnchorRect);
    renderProgressionBuilderUI();
  }

  if ((autoSuggestToggle?.checked || activeToolPanelId === "suggestionEnginePanel") && appData) {
    runSuggestions();
  }
}

function updateSelectedProgressionChord(chordName, overrides = {}) {
  const selectedId = appState.selectedProgressionItemId;
  if (!selectedId) {
    return;
  }

  const friendlyChordName = getFriendlyChordName(chordName);
  const nextItems = appState.progressionItems.map(item =>
    item.id === selectedId
      ? {
          ...item,
          chord: friendlyChordName,
          ...overrides
        }
      : item
  );
  const rebuiltItems = rebuildProgressionItems(nextItems, getCurrentKeyData(), getCurrentSequenceSettings());

  setProgressionItems(rebuiltItems, {
    selectedId,
    preserveSelection: true
  });

  if (autoSuggestToggle?.checked && appData) {
    runSuggestions();
  }
}

function updateSelectedProgressionDurationBeats(durationBeats) {
  const selectedId = appState.selectedProgressionItemId;
  if (!selectedId) {
    return;
  }

  const nextItems = appState.progressionItems.map(item =>
    item.id === selectedId
      ? {
          ...item,
          durationBeats
        }
      : item
  );
  const rebuiltItems = rebuildProgressionItems(nextItems, getCurrentKeyData(), getCurrentSequenceSettings());

  setProgressionItems(rebuiltItems, {
    selectedId,
    preserveSelection: true
  });
}

function updateSelectedProgressionSustain(sustain) {
  const selectedId = appState.selectedProgressionItemId;
  if (!selectedId) {
    return;
  }

  const nextItems = appState.progressionItems.map(item =>
    item.id === selectedId
      ? {
          ...item,
          sustain
        }
      : item
  );
  const rebuiltItems = rebuildProgressionItems(nextItems, getCurrentKeyData(), getCurrentSequenceSettings());

  setProgressionItems(rebuiltItems, {
    selectedId,
    preserveSelection: true
  });
}

function updateSelectedProgressionVoicingMode(mode) {
  const selectedId = appState.selectedProgressionItemId;
  if (!selectedId) {
    return;
  }

  const nextMode = normalizeVoicingMode(mode, BASIC_VOICING_MODE);
  const nextItems = appState.progressionItems.map(item =>
    item.id !== selectedId
      ? item
      : {
          ...item,
          voicing: item.voicing?.notes?.length
            ? {
                ...item.voicing,
                velocityMode: nextMode
              }
            : item.voicing
        }
  );
  const rebuiltItems = rebuildProgressionItems(nextItems, getCurrentKeyData(), getCurrentSequenceSettings());

  setProgressionItems(rebuiltItems, {
    selectedId,
    preserveSelection: true
  });
}

function updateSelectedProgressionVoicingNotePreset(noteIndex, preset) {
  updateSelectedProgressionVoicingNoteVelocity(noteIndex, velocityPresetToMidi(preset));
}

function updateSelectedProgressionVoicingNoteVelocity(noteIndex, velocity) {
  const selectedId = appState.selectedProgressionItemId;
  if (!selectedId) {
    return;
  }

  const nextItems = appState.progressionItems.map(item =>
    item.id !== selectedId
      ? item
      : {
          ...item,
          voicing: item.voicing?.notes?.length
            ? {
                ...item.voicing,
                velocityMode: normalizeVoicingMode(item.voicing?.velocityMode, BASIC_VOICING_MODE),
                notes: item.voicing.notes.map((note, index) =>
                  index === noteIndex
                    ? {
                        ...note,
                        velocity: normalizeMidiVelocity(velocity, note?.velocity ?? DEFAULT_NOTE_VELOCITY)
                      }
                    : note
                )
              }
            : item.voicing
        }
  );
  const rebuiltItems = rebuildProgressionItems(nextItems, getCurrentKeyData(), getCurrentSequenceSettings());

  setProgressionItems(rebuiltItems, {
    selectedId,
    preserveSelection: true
  });
}

function duplicateSelectedProgressionChord() {
  const selectedId = appState.selectedProgressionItemId;
  if (!selectedId) {
    return;
  }

  const selectedIndex = appState.progressionItems.findIndex(item => item.id === selectedId);
  if (selectedIndex < 0) {
    return;
  }

  const selectedItem = appState.progressionItems[selectedIndex];
  const duplicateItem = buildClonedProgressionItem(selectedItem);

  if (!duplicateItem) {
    return;
  }

  const nextItems = [...appState.progressionItems];
  nextItems.splice(selectedIndex + 1, 0, duplicateItem);

  if (appState.editingProgressionItemId === selectedId) {
    appState.editingProgressionItemId = duplicateItem.id;
    appState.editingProgressionAnchorRect = null;
  }

  setProgressionItems(nextItems, { selectedId: duplicateItem.id });

  if (appState.editingProgressionItemId === duplicateItem.id) {
    appState.editingProgressionAnchorRect = getProgressionBlockAnchorRect(duplicateItem.id, null);
    renderProgressionBuilderUI();
  }

  if ((autoSuggestToggle?.checked || activeToolPanelId === "suggestionEnginePanel") && appData) {
    runSuggestions();
  }
}

function insertSelectedProgressionChord(placement = "after") {
  const selectedId = appState.selectedProgressionItemId;
  if (!selectedId) {
    return;
  }

  const selectedIndex = appState.progressionItems.findIndex(item => item.id === selectedId);
  if (selectedIndex < 0) {
    return;
  }

  const selectedItem = appState.progressionItems[selectedIndex];
  const insertedItem = buildClonedProgressionItem(selectedItem);

  if (!insertedItem) {
    return;
  }

  const insertionIndex = placement === "before" ? selectedIndex : selectedIndex + 1;
  const nextItems = [...appState.progressionItems];
  nextItems.splice(insertionIndex, 0, insertedItem);

  appState.insertChoiceOpen = false;
  setProgressionItems(nextItems, { selectedId: insertedItem.id });
  refreshSequenceKeyboard();

  if ((autoSuggestToggle?.checked || activeToolPanelId === "suggestionEnginePanel") && appData) {
    runSuggestions();
  }
}

function splitSelectedProgressionChord() {
  const selectedId = appState.selectedProgressionItemId;
  if (!selectedId) {
    return;
  }

  const selectedIndex = appState.progressionItems.findIndex(item => item.id === selectedId);
  if (selectedIndex < 0) {
    return;
  }

  const selectedItem = appState.progressionItems[selectedIndex];
  if (!canSplitProgressionItem(selectedItem)) {
    return;
  }

  const leftDurationBeats = Math.ceil(selectedItem.durationBeats / 2);
  const rightDurationBeats = Math.floor(selectedItem.durationBeats / 2);
  const splitItem = buildClonedProgressionItem(selectedItem, { durationBeats: rightDurationBeats });

  if (!splitItem) {
    return;
  }

  const nextItems = [...appState.progressionItems];
  nextItems.splice(selectedIndex, 1,
    {
      ...selectedItem,
      durationBeats: leftDurationBeats
    },
    splitItem
  );

  if (appState.editingProgressionItemId === selectedId) {
    appState.editingProgressionItemId = splitItem.id;
    appState.editingProgressionAnchorRect = null;
  }

  appState.insertChoiceOpen = false;
  setProgressionItems(nextItems, { selectedId: splitItem.id });

  if (appState.editingProgressionItemId === splitItem.id) {
    appState.editingProgressionAnchorRect = getProgressionBlockAnchorRect(splitItem.id, null);
    renderProgressionBuilderUI();
  }

  refreshSequenceKeyboard();

  if ((autoSuggestToggle?.checked || activeToolPanelId === "suggestionEnginePanel") && appData) {
    runSuggestions();
  }
}

function deleteSelectedProgressionChord() {
  const selectedId = appState.selectedProgressionItemId;
  if (!selectedId) {
    return;
  }

  const selectedIndex = appState.progressionItems.findIndex(item => item.id === selectedId);
  if (selectedIndex < 0) {
    return;
  }

  const nextItems = appState.progressionItems.filter(item => item.id !== selectedId);
  const fallbackSelection =
    nextItems[selectedIndex]?.id ||
    nextItems[selectedIndex - 1]?.id ||
    null;

  if (appState.editingProgressionItemId === selectedId) {
    appState.editingProgressionItemId = null;
    appState.editingProgressionAnchorRect = null;
  }
  setProgressionItems(nextItems, { selectedId: fallbackSelection });

  if ((autoSuggestToggle?.checked || activeToolPanelId === "suggestionEnginePanel") && appData) {
    runSuggestions();
  }
}

function getProgressionChordList() {
  return progressionItemsToChords(appState.progressionItems);
}

function buildProgressionFilename() {
  const keySlug = String(appState.selectedKey || "progression")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9#-]/g, "")
    .toLowerCase();

  return `${keySlug || "progression"}-progression.json`;
}

function downloadProgressionFile(payload) {
  const fileContents = JSON.stringify(payload, null, 2);
  const blob = new Blob([fileContents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = buildProgressionFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

function notifyProgressionSaveNeedsChords() {
  window.alert("Add at least one chord before saving the progression.");
}

function renderNewProgressionConfirm() {
  if (!newProgressionBtn || !newProgressionConfirmPopover) {
    return;
  }

  newProgressionBtn.setAttribute("aria-expanded", String(Boolean(appState.newProgressionConfirmOpen)));
  newProgressionConfirmPopover.hidden = !appState.newProgressionConfirmOpen;
}

function closeNewProgressionConfirm() {
  if (!appState.newProgressionConfirmOpen) {
    return;
  }

  appState.newProgressionConfirmOpen = false;
  renderNewProgressionConfirm();
}

function openNewProgressionConfirm() {
  const hasProgressionContent = Boolean(appState.progressionItems.length || progressionInput?.value?.trim());
  if (!hasProgressionContent) {
    return;
  }

  appState.newProgressionConfirmOpen = true;
  renderNewProgressionConfirm();
}

function handleSaveProgression() {
  const payload = buildProgressionSavePayload(
    appState.progressionItems,
    appState.selectedKey,
    getCurrentSequenceSettings()
  );
  if (!payload) {
    notifyProgressionSaveNeedsChords();
    return;
  }

  downloadProgressionFile(payload);
}

function handleNewProgression() {
  closeNewProgressionConfirm();

  if (appState.isPlayingProgression) {
    stopActiveProgressionPlayback();
  }

  appState.progressionInvalidTokens = [];
  appState.insertChoiceOpen = false;
  appState.editingProgressionItemId = null;
  appState.editingProgressionAnchorRect = null;
  appState.selectedProgressionItemId = null;
  clearSequenceKeyboardState();
  setProgressionItems([], { selectedId: null });
}

function applyLoadedProgressionData(data) {
  const {
    items,
    invalid,
    sequenceSettings
  } = importProgressionFromSavedData(data, getCurrentKeyData(), appState.progressionItems);

  if (!items.length) {
    throw new Error("No chords found");
  }

  appState.sequenceTempoBpm = normalizeTempoBpm(sequenceSettings?.tempoBpm);
  appState.sequenceTimeSignature = normalizeTimeSignature(sequenceSettings?.timeSignature);
  appState.progressionInvalidTokens = invalid;
  setProgressionItems(items, { selectedId: null });

  if (activeToolPanelId === "suggestionEnginePanel" && appData) {
    runSuggestions();
  }
}

async function handleLoadProgression(event) {
  const input = event?.target;
  const file = input?.files?.[0];

  if (!file) {
    return;
  }

  try {
    const raw = await file.text();
    const data = JSON.parse(raw);
    applyLoadedProgressionData(data);
  } catch (error) {
    console.error("Could not load progression file:", error);
    window.alert("Could not load that progression file.");
  } finally {
    input.value = "";
  }
}

function normalizeMusicDemoEntries(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .map(entry => {
      const fileName = String(entry?.fileName || entry?.name || "").trim();
      if (!fileName || !fileName.toLowerCase().endsWith(".json")) {
        return null;
      }

      return {
        fileName,
        label: String(entry?.label || fileName.replace(/\.json$/i, "")).trim(),
        path: String(entry?.path || `${MUSIC_DEMOS_DIR_PATH}${encodeURIComponent(fileName)}`).trim()
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

async function fetchMusicDemoEntries() {
  const endpointUrl = new URL(MUSIC_DEMOS_ENDPOINT_PATH, window.location.href);
  endpointUrl.searchParams.set("ts", String(Date.now()));

  try {
    const response = await fetch(endpointUrl, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      const demos = normalizeMusicDemoEntries(payload?.demos);
      if (demos.length) {
        return demos;
      }
    }
  } catch (error) {
    console.warn("Could not load demo list endpoint:", error);
  }

  try {
    const listingUrl = new URL(MUSIC_DEMOS_DIR_PATH, window.location.href);
    listingUrl.searchParams.set("ts", String(Date.now()));
    const response = await fetch(listingUrl, { cache: "no-store" });
    if (response.ok) {
      const html = await response.text();
      const parser = new DOMParser();
      const documentNode = parser.parseFromString(html, "text/html");
      const demos = normalizeMusicDemoEntries(
        [...documentNode.querySelectorAll("a[href]")]
          .map(link => {
            const href = link.getAttribute("href") || "";
            const resolvedUrl = new URL(href, listingUrl);
            return {
              fileName: decodeURIComponent(resolvedUrl.pathname.split("/").pop() || ""),
              path: resolvedUrl.pathname
            };
          })
      );

      if (demos.length) {
        return demos;
      }
    }
  } catch (error) {
    console.warn("Could not parse demo directory listing:", error);
  }

  return normalizeMusicDemoEntries([
    {
      fileName: DEFAULT_MUSIC_DEMO_FILE,
      label: DEFAULT_MUSIC_DEMO_FILE.replace(/\.json$/i, ""),
      path: `${MUSIC_DEMOS_DIR_PATH}${encodeURIComponent(DEFAULT_MUSIC_DEMO_FILE)}`
    }
  ]);
}

function renderDemoMenu() {
  if (!loadDemoProgressionBtn || !demoMenuPopover || !demoMenuList) {
    return;
  }

  loadDemoProgressionBtn.setAttribute("aria-expanded", String(Boolean(appState.demoMenuOpen)));
  demoMenuPopover.hidden = !appState.demoMenuOpen;
  demoMenuList.innerHTML = "";

  if (isLoadingMusicDemos) {
    const loading = document.createElement("div");
    loading.className = "progression-demo-menu-item-loading";
    loading.textContent = "Loading demos...";
    demoMenuList.appendChild(loading);
    return;
  }

  if (!musicDemoEntries.length) {
    const empty = document.createElement("div");
    empty.className = "progression-demo-menu-item-empty";
    empty.textContent = "No demo files found.";
    demoMenuList.appendChild(empty);
    return;
  }

  musicDemoEntries.forEach(entry => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "progression-demo-menu-item";
    button.setAttribute("role", "menuitem");
    button.dataset.tooltip = `Load ${entry.label}`;
    button.textContent = entry.label;
    button.addEventListener("click", () => {
      closeDemoMenu();
      void handleLoadDemoProgression(entry.path);
    });
    demoMenuList.appendChild(button);
  });
}

function closeDemoMenu() {
  if (!appState.demoMenuOpen) {
    return;
  }

  appState.demoMenuOpen = false;
  renderDemoMenu();
}

async function openDemoMenu() {
  appState.demoMenuOpen = true;
  isLoadingMusicDemos = true;
  renderDemoMenu();

  try {
    musicDemoEntries = await fetchMusicDemoEntries();
  } finally {
    isLoadingMusicDemos = false;
    renderDemoMenu();
  }
}

async function handleLoadDemoProgression(demoPath = `${MUSIC_DEMOS_DIR_PATH}${encodeURIComponent(DEFAULT_MUSIC_DEMO_FILE)}`) {
  try {
    const demoUrl = new URL(demoPath, window.location.href);
    demoUrl.searchParams.set("ts", String(Date.now()));
    const response = await fetch(demoUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load demo progression: ${response.status}`);
    }

    const data = await response.json();
    applyLoadedProgressionData(data);
  } catch (error) {
    console.error("Could not load demo progression:", error);
    window.alert("Could not load the demo progression.");
  }
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

function normalizeVoicingNotes(voicing) {
  if (!Array.isArray(voicing?.notes)) {
    return [];
  }

  return voicing.notes
    .map(note => ({
      midi: Number(note?.midi),
      velocity: normalizeMidiVelocity(
        note?.velocity ?? velocityPresetToMidi(note?.volume),
        DEFAULT_NOTE_VELOCITY
      )
    }))
    .filter(note => Number.isFinite(note.midi))
    .sort((a, b) => a.midi - b.midi);
}

function getIdentifiedSequenceVoicing() {
  const midiNotes = normalizeMidiList(identifiedSequenceChord?.playedMidiNotes);
  if (!midiNotes.length) {
    return null;
  }

  return {
    source: "keyboard",
    inversionLabel: String(identifiedSequenceChord?.inversionLabel || "").trim(),
    inversionShortLabel: String(identifiedSequenceChord?.inversionShortLabel || "").trim(),
    voicingLabel: String(identifiedSequenceChord?.voicingLabel || "").trim(),
    voicingShortLabel: String(identifiedSequenceChord?.voicingShortLabel || "").trim(),
    velocityMode: BASIC_VOICING_MODE,
    notes: midiNotes.map(midi => ({
      midi,
      velocity: DEFAULT_NOTE_VELOCITY
    }))
  };
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
          inversionLabel: lockedSequenceChordInversionLabel || "",
          inversionShortLabel: lockedSequenceChordInversionShortLabel || "",
          voicingLabel: lockedSequenceChordVoicingLabel || "",
          voicingShortLabel: lockedSequenceChordVoicingShortLabel || "",
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
  const bassMidiNotes = normalizeMidiList(offscreenBassMidiNotes);
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
  const baseCanonicalName = `${identifiedChord.root}${identifiedChord.suffix}`;
  const canonicalName = bassNote && chordRootPitchClass !== bassPitchClass
    ? `${baseCanonicalName}/${bassNote}`
    : baseCanonicalName;
  const parsedIdentified = parseChordName(canonicalName);

  identifiedSequenceChord = parsedIdentified
      ? {
          root: parsedIdentified.root,
          bass: parsedIdentified.bass,
          suffix: parsedIdentified.suffix,
          canonicalName: parsedIdentified.canonicalName,
          inversionLabel: "",
          voicingLabel: "",
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

  const chordLabel = formatChordLabel(identifiedSequenceChord.canonicalName);
  const selectionLabel = formatSequenceKeyboardSelectionLabel(
    identifiedSequenceChord.inversionLabel,
    identifiedSequenceChord.voicingLabel
  );
  return selectionLabel
    ? `${chordLabel} (${selectionLabel})`
    : chordLabel;
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

function clearSequenceKeyboardState() {
  sequenceKeyboardMidiNotes = [];
  sequenceKeyboardFlashMidiNotes = [];
  sequenceKeyboardDisplayMidiNotes = [];
  identifiedSequenceChord = null;
  lockedSequenceChordName = "";
  lockedSequenceChordInversionLabel = "";
  lockedSequenceChordVoicingLabel = "";
  lockedSequenceChordInversionShortLabel = "";
  lockedSequenceChordVoicingShortLabel = "";
  if (sequenceKeyboardFlashTimeout) {
    clearTimeout(sequenceKeyboardFlashTimeout);
    sequenceKeyboardFlashTimeout = null;
  }
}

function refreshSequenceKeyboard() {
  const selectedProgressionItem = getSelectedProgressionItem();

  renderSequenceKeyboard(
    sequenceKeyboard,
    {
      activeMidiNotes: sequenceKeyboardDisplayMidiNotes.length
        ? sequenceKeyboardDisplayMidiNotes
        : sequenceKeyboardMidiNotes,
      flashMidiNotes: sequenceKeyboardFlashMidiNotes,
      chordLabel: getSequenceKeyboardLabel(),
      canSave: Boolean(identifiedSequenceChord),
      canUpdate: Boolean(identifiedSequenceChord && appState.selectedProgressionItemId),
      canInsert: Boolean(appState.selectedProgressionItemId),
      insertChoiceActive: Boolean(appState.selectedProgressionItemId && appState.insertChoiceOpen),
      canSplit: canSplitProgressionItem(selectedProgressionItem),
      canDuplicate: Boolean(appState.selectedProgressionItemId),
      canDelete: Boolean(appState.selectedProgressionItemId),
      canPlay: sequenceKeyboardMidiNotes.length > 0
    },
    {
      onKeyToggle: async midi => {
        lockedSequenceChordName = "";
        lockedSequenceChordInversionLabel = "";
        lockedSequenceChordVoicingLabel = "";
        lockedSequenceChordInversionShortLabel = "";
        lockedSequenceChordVoicingShortLabel = "";
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

        const playbackNotes = normalizeMidiList(sequenceKeyboardMidiNotes);
        const displayNotes = normalizeMidiList(sequenceKeyboardMidiNotes);
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
        clearSequenceKeyboardState();
        refreshSequenceKeyboard();
      },
      onSave: () => {
        if (identifiedSequenceChord?.canonicalName) {
          appendChordToProgression(identifiedSequenceChord.canonicalName, {
            voicing: getIdentifiedSequenceVoicing()
          });
        }
      },
      onUpdate: () => {
        if (identifiedSequenceChord?.canonicalName && appState.selectedProgressionItemId) {
          updateSelectedProgressionChord(identifiedSequenceChord.canonicalName, {
            voicing: getIdentifiedSequenceVoicing()
          });
        }
      },
      onInsert: () => {
        if (appState.selectedProgressionItemId) {
          appState.insertChoiceOpen = !appState.insertChoiceOpen;
          refreshSequenceKeyboard();
        }
      },
      onInsertBefore: () => {
        if (appState.selectedProgressionItemId) {
          insertSelectedProgressionChord("before");
        }
      },
      onInsertAfter: () => {
        if (appState.selectedProgressionItemId) {
          insertSelectedProgressionChord("after");
        }
      },
      onInsertCancel: () => {
        appState.insertChoiceOpen = false;
        refreshSequenceKeyboard();
      },
      onSplit: () => {
        if (canSplitProgressionItem(getSelectedProgressionItem())) {
          splitSelectedProgressionChord();
        }
      },
      onDuplicate: () => {
        if (appState.selectedProgressionItemId) {
          duplicateSelectedProgressionChord();
        }
      },
      onDelete: () => {
        if (appState.selectedProgressionItemId) {
          deleteSelectedProgressionChord();
        }
      }
    },
    sequenceKeyboardToolbarMount
  );
}

function setSequenceKeyboardNotes(midiNotes, durationSeconds = 1.0, chordName = "", options = {}) {
  sequenceKeyboardMidiNotes = normalizeMidiList(midiNotes);
  lockedSequenceChordName = chordName || "";
  lockedSequenceChordInversionLabel = chordName ? String(options.inversionLabel || "").trim() : "";
  lockedSequenceChordVoicingLabel = chordName ? String(options.voicingLabel || "").trim() : "";
  lockedSequenceChordInversionShortLabel = chordName ? String(options.inversionShortLabel || "").trim() : "";
  lockedSequenceChordVoicingShortLabel = chordName ? String(options.voicingShortLabel || "").trim() : "";
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
  return normalizeMidiList(getAscendingRootVoicing(chordName));
}

function showSequenceKeyboardNotes(noteNames, durationSeconds = 1.0, octave = 3) {
  const midiNotes = getDisplayMidiForNoteNames(noteNames, octave);
  if (!midiNotes.length) return;
  setSequenceKeyboardNotes(midiNotes, durationSeconds);
}

function showSequenceKeyboardChord(chordName, durationSeconds = 1.0) {
  const midiNotes = getDisplayMidiForChord(chordName);
  if (!midiNotes.length) return;
  setSequenceKeyboardNotes(midiNotes, durationSeconds, chordName);
}

function showSequenceKeyboardVoicing(midiNotes, chordName = "", durationSeconds = 1.0, options = {}) {
  const normalizedMidi = Array.isArray(midiNotes)
    ? normalizeMidiList(
        midiNotes.map(note => (typeof note === "object" && note !== null ? note.midi : note))
      )
    : [];
  if (!normalizedMidi.length) {
    return;
  }

  setSequenceKeyboardNotes(normalizedMidi, durationSeconds, chordName, options);
}

async function playChordWithSequenceKeyboard(chordName, duration = 1.0) {
  showSequenceKeyboardChord(chordName, duration);
  await playChord(chordName, duration);
}

async function playVoicingWithSequenceKeyboard(voicingNotes, chordName = "", duration = 1.0, options = {}) {
  showSequenceKeyboardVoicing(voicingNotes, chordName, duration, options);
  const normalizedVoicing = Array.isArray(voicingNotes)
    ? voicingNotes.map(note => (
        typeof note === "object" && note !== null
          ? note
          : { midi: Number(note), velocity: DEFAULT_NOTE_VELOCITY }
      ))
    : [];

  await playMidiNoteSpecs(normalizeVoicingNotes({ notes: normalizedVoicing }), duration);
}

async function previewProgressionItemSelection(selectedId) {
  const selectedItem = appState.progressionItems.find(item => item.id === selectedId);
  if (!selectedItem?.chord) {
    return;
  }

  const previewToken = ++progressionPreviewToken;
  const fullPreviewDuration = (selectedItem.durationBeats || 1) * (60 / appState.sequenceTempoBpm);
  const previewDuration = selectedItem.sustain
    ? Math.max(0.45, Math.min(4.2, fullPreviewDuration))
    : Math.max(0.45, Math.min(2.4, fullPreviewDuration * 0.9));

  try {
    appState.playingProgressionItemId = selectedItem.id;
    renderProgressionBuilderUI();
    if (selectedItem.voicing?.notes?.length) {
      await playVoicingWithSequenceKeyboard(
        selectedItem.voicing.notes,
        selectedItem.chord,
        previewDuration
      );
    } else {
      await playChordWithSequenceKeyboard(selectedItem.chord, previewDuration);
    }
  } catch (error) {
    console.warn("Could not preview progression chord:", error);
  } finally {
    if (previewToken === progressionPreviewToken) {
      appState.playingProgressionItemId = null;
      renderProgressionBuilderUI();
    }
  }
}

function refreshChordPlaygroundUI() {
  syncChordExplorerSelection();

  renderCompactRootSelector(bassRootSelector, {
    title: "Bass Root",
    selectedNote: appState.selectedBassRoot,
    onSelect: async note => {
      appState.selectedBassRoot = note;
      refreshChordPlaygroundUI();

      try {
        await ensureAudioReady();
        showSequenceKeyboardNotes([note], 0.5, 2);
        const midi = noteToMidi(note, 2);
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
    selectedNote: appState.selectedChordRoot,
    onSelect: async note => {
      const previousChordRoot = appState.selectedChordRoot;
      appState.selectedChordRoot = note;
      if (appState.selectedBassRoot === previousChordRoot) {
        appState.selectedBassRoot = note;
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
    appState.selectedChordRoot,
    appState.selectedBassRoot,
    appState.keyChordSet,
    Object.assign(async chordName => {
      try {
        await ensureAudioReady();
        await playChordWithSequenceKeyboard(chordName, 1.0);
      } catch (error) {
        console.error("✗ Could not play chord:", error);
      }
    }, {
      getSelectedChord: () => appState.chordExplorerSelectedChord,
      getSelectedInversionValue: () => appState.chordExplorerSelectedInversion,
      getSelectedVoicingValue: () => appState.chordExplorerSelectedVoicing,
      getInversionOptions,
      getVoicingOptions,
      selectChord: chord => {
        setToolSelection("chordExplorer", chord, "0", "close");
      },
      playSelection: async (chord, inversionValue = "0", voicingValue = "close") => {
        try {
          await playToolSelection("chordExplorer", refreshChordPlaygroundUI, chord, inversionValue, voicingValue);
        } catch (error) {
          console.error("✗ Could not play selected chord voicing:", error);
        }
      }
    }),
    chordName => appendChordToProgression(
      chordName,
      getToolSelectionProgressionOverrides("chordExplorer", chordName, "chord-explorer")
    )
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
    const version = packageData.version || "unknown";
    appVersion.textContent = version;
    if (version !== "unknown") {
      const versionAnchor = `v${String(version).replace(/\./g, "-")}`;
      appVersion.href = `./project-documents/version-changes.html#${versionAnchor}`;
    } else {
      appVersion.href = "./project-documents/version-changes.html";
    }
  } catch (error) {
    console.warn("Could not load app version:", error);
    appVersion.textContent = "unknown";
    appVersion.href = "./project-documents/version-changes.html";
  }
}

function refreshKeyUI() {
  syncKeyExplorerSelection();
  updateToolContext();
  const styleSelect = document.getElementById("styleSelect");
  if (styleSelect) {
    styleSelect.value = appData?.musicData?.[appState.selectedKey]?.modeId || "ionian";
  }

  renderRootSelector(
    rootContainer,
    appState.selectedKey,
    async newKey => {
      appState.selectedKey = newKey;
      updateKeyChordSet();
      refreshProgressionItemsForSelectedKey();
      const rootNote = newKey.split(" ")[0] || "C";
      appState.selectedChordRoot = rootNote;
      appState.selectedBassRoot = rootNote;
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
    appState.selectedKey,
    Object.assign(async chord => {
      try {
        await ensureAudioReady();
        await playChordWithSequenceKeyboard(chord, 1.0);
      } catch (error) {
        console.error("✗ Could not play chord:", error);
      }
    }, {
      getSelectedChord: () => appState.keyExplorerSelectedChord,
      getSelectedInversionValue: () => appState.keyExplorerSelectedInversion,
      getSelectedVoicingValue: () => appState.keyExplorerSelectedVoicing,
      getInversionOptions,
      getVoicingOptions,
      selectChord: chord => {
        appState.keyExplorerSelectedChord = chord;
        appState.keyExplorerSelectedInversion = "0";
        appState.keyExplorerSelectedVoicing = "close";
      },
      playSelection: async (chord, inversionValue = "0", voicingValue = "close") => {
        try {
          appState.keyExplorerSelectedChord = chord;
          appState.keyExplorerSelectedInversion = String(inversionValue);
          appState.keyExplorerSelectedVoicing = String(voicingValue);
          refreshKeyUI();
          const options = getInversionOptions(chord, voicingValue);
          const selectedOption = options.find(option => option.value === String(inversionValue));
          if (!selectedOption?.voicing?.length) {
            return;
          }

          const selectedVoicing = getVoicingOptions(chord).find(option => option.value === String(voicingValue));
          await ensureAudioReady();
          await playVoicingWithSequenceKeyboard(selectedOption.voicing, chord, 1.0, {
            inversionLabel: selectedOption.label,
            inversionShortLabel: selectedOption.shortLabel || "",
            voicingLabel: selectedVoicing?.label || "Close",
            voicingShortLabel: selectedVoicing?.shortLabel || ""
          });
        } catch (error) {
          console.error("✗ Could not play selected chord voicing:", error);
        }
      }
    }),
    chord => {
      appendChordToProgression(chord, getKeyExplorerSelectionProgressionOverrides(chord));
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

function refreshSuggestionsIfReady() {
  if (appData) {
    runSuggestions();
  }
}

function runSuggestions() {
  const suggestionPayload = getSuggestions({
    musicData: appData.musicData,
    moodBoosts: appData.moodBoosts,
    functionDescriptions: appData.functionDescriptions,
    moodReasonText: appData.moodReasonText,
    selectedKey: appState.selectedKey,
    progression: progressionItemsToText(appState.progressionItems),
    feeling: feelingSelect.value
  });

  syncSuggestionEngineSelection(suggestionPayload.suggestions);

  const onSuggestedChordClick = Object.assign(async chordName => {
    try {
      await ensureAudioReady();
      await playChordWithSequenceKeyboard(chordName, 1.0);
    } catch (error) {
      console.error("✗ Could not play suggested chord:", error);
    }
  }, {
    getSelectedChord: () => appState.suggestionEngineSelectedChord,
    getSelectedInversionValue: () => appState.suggestionEngineSelectedInversion,
    getSelectedVoicingValue: () => appState.suggestionEngineSelectedVoicing,
    getInversionOptions,
    getVoicingOptions,
    selectChord: chord => {
      setToolSelection("suggestionEngine", chord, "0", "close");
    },
    playSelection: async (chord, inversionValue = "0", voicingValue = "close") => {
      try {
        await playToolSelection("suggestionEngine", runSuggestions, chord, inversionValue, voicingValue);
      } catch (error) {
        console.error("✗ Could not play selected suggestion voicing:", error);
      }
    }
  });

  const onSuggestedChordAdd = (chordName) => {
    appendChordToProgression(
      chordName,
      getToolSelectionProgressionOverrides("suggestionEngine", chordName, "suggestion-engine")
    );
  };

  renderSuggestions(results, suggestionPayload, appData.musicData, appState.selectedKey, onSuggestedChordClick, onSuggestedChordAdd);
}

function stopActiveProgressionPlayback() {
  if (activeProgressionPlaybackSession) {
    activeProgressionPlaybackSession.cancelled = true;
  }
  stopAllPlayback();
  appState.isPlayingProgression = false;
  appState.playingProgressionItemId = null;
  activeProgressionPlaybackMode = null;
  renderProgressionBuilderUI();
}

async function handlePlayProgression(startMode = "all") {
  if (appState.isPlayingProgression && activeProgressionPlaybackMode === startMode) {
    stopActiveProgressionPlayback();
    return;
  }

  if (appState.isPlayingProgression) {
    stopActiveProgressionPlayback();
    return;
  }

  const progressionItems = [...appState.progressionItems];
  if (!progressionItems.length) return;

  const startIndex = startMode === "selected"
    ? progressionItems.findIndex(item => item.id === appState.selectedProgressionItemId)
    : 0;

  if (startIndex < 0) {
    if (activeProgressionPlaybackSession) {
      activeProgressionPlaybackSession.cancelled = true;
    }
    return;
  }

  const playbackItems = progressionItems.slice(startIndex);
  const startBeatOffset = progressionItems
    .slice(0, startIndex)
    .reduce((totalBeats, item) => totalBeats + Math.max(1, Number(item?.durationBeats) || 0), 0);

  const playbackSession = { cancelled: false };
  activeProgressionPlaybackSession = playbackSession;
  activeProgressionPlaybackMode = startMode;
  appState.isPlayingProgression = true;
  renderProgressionBuilderUI();

  try {
    let playbackIndex = 0;
    const playbackBeatHandler = appState.metronomeArmed
      ? ({ isBarAccent }) => triggerMetronomeBeat(isBarAccent)
      : null;
    await ensureAudioReady();
    await playProgression(
      playbackItems,
      appState.sequenceTempoBpm,
      async (chord, durationSeconds) => {
        const activeItem = playbackItems[playbackIndex];
        appState.playingProgressionItemId = activeItem?.id || null;
        renderProgressionBuilderUI();
        if (activeItem?.voicing?.notes?.length) {
          showSequenceKeyboardVoicing(activeItem.voicing.notes, chord, durationSeconds);
        } else {
          showSequenceKeyboardChord(chord, durationSeconds);
        }
        playbackIndex += 1;
      },
      () => playbackSession.cancelled,
      playbackBeatHandler,
      getBeatsPerBar(appState.sequenceTimeSignature),
      startBeatOffset
    );
  } catch (error) {
    console.error("Could not play progression:", error);
  } finally {
    if (activeProgressionPlaybackSession === playbackSession) {
      activeProgressionPlaybackSession = null;
    }

    appState.isPlayingProgression = false;
    appState.playingProgressionItemId = null;
    activeProgressionPlaybackMode = null;
    renderProgressionBuilderUI();
  }
}

async function init() {
  try {
    console.log("🚀 App initializing...");
    initToolNavigation();
    await loadVersionLabel();
    appData = await loadAllData();
    console.log("✓ Data loaded");

    populateFeelings(feelingSelect, appData.moodBoosts);
    appState.selectedChordRoot = appState.selectedKey.split(" ")[0];
    appState.selectedBassRoot = appState.selectedChordRoot;
    updateKeyChordSet();

    const styleSelect = document.getElementById("styleSelect");
    if (styleSelect) {
      populateModeSelect(styleSelect, appData.modeGroups);
      styleSelect.value = appData.musicData[appState.selectedKey]?.modeId || "ionian";

      styleSelect.addEventListener("change", () => {
        const modeId = styleSelect.value;
        const root = appState.selectedKey.split(" ")[0];
        const normalizedRoot = normaliseRoot(root);
        const pc = NOTE_TO_PC[normalizedRoot];

        if (pc != null) {
          const match = Object.keys(appData.musicData).find(keyName => {
            const keyData = appData.musicData[keyName];
            const keyRoot = normaliseRoot(keyData.root);
            return NOTE_TO_PC[keyRoot] === pc && keyData.modeId === modeId;
          });

          if (match) {
            appState.selectedKey = match;
          }
        }

        updateKeyChordSet();
        refreshProgressionItemsForSelectedKey();
        refreshKeyUI();
        refreshChordPlaygroundUI();
      });
    }

    importProgressionTextToState(progressionInput.value);
    refreshKeyUI();
    renderProgressionBuilderUI();
    refreshSequenceKeyboard();
    refreshChordPlaygroundUI();
    updateToolContext();

    if (suggestBtn) suggestBtn.dataset.tooltip = "Refresh the current suggestions";
    if (playProgressionBtn) playProgressionBtn.dataset.tooltip = "Play all chords in the progression";
    if (playFromSelectedBtn) playFromSelectedBtn.dataset.tooltip = "Play the progression from the selected chord";
    if (newProgressionBtn) newProgressionBtn.dataset.tooltip = "Add at least one chord before clearing the sequence";
    if (loadDemoProgressionBtn) loadDemoProgressionBtn.dataset.tooltip = "Open the Music Demos menu";
    if (saveProgressionBtn) saveProgressionBtn.dataset.tooltip = "Save the progression with tempo, time signature, and beat lengths";
    if (loadProgressionBtn) loadProgressionBtn.dataset.tooltip = "Load a saved progression file";
    if (metronomeToggleBtn) metronomeToggleBtn.dataset.tooltip = "Open metronome settings";
    if (metronomeStartStopBtn) metronomeStartStopBtn.dataset.tooltip = "Arm or stop the metronome for playback";
    if (sequenceTempoBpmInput) sequenceTempoBpmInput.dataset.tooltip = "Set the playback tempo for the chord sequence";
    if (sequenceTimeSignatureSelect) sequenceTimeSignatureSelect.dataset.tooltip = "Set the default beats per bar for new chord blocks";
    feelingSelect.dataset.tooltip = "Choose a mood to guide the suggestions";
    if (autoSuggestToggle) autoSuggestToggle.closest(".suggest-toggle").dataset.tooltip = "Automatically refresh suggestions when you add a chord";
    sectionHelpButtons.forEach(button => {
      button.dataset.tooltip = "How to use this section";
    });

    initTooltips();

    feelingSelect.addEventListener("change", refreshSuggestionsIfReady);
    progressionInput.addEventListener("input", () => {
      importProgressionTextToState(progressionInput.value, { preserveSelection: false });
    });

    if (sequenceTempoBpmInput) {
      sequenceTempoBpmInput.addEventListener("change", () => {
        appState.sequenceTempoBpm = normalizeTempoBpm(sequenceTempoBpmInput.value);
        renderProgressionBuilderUI();
      });
    }

    if (metronomeToggleBtn) {
      metronomeToggleBtn.addEventListener("click", event => {
        event.stopPropagation();
        appState.metronomePopoverOpen = !appState.metronomePopoverOpen;
        renderMetronomeUI();
      });
    }

    if (metronomeVolumeInput) {
      metronomeVolumeInput.addEventListener("input", () => {
        appState.metronomeVolume = normalizeMetronomeVolume(metronomeVolumeInput.value, DEFAULT_METRONOME_VOLUME);
        renderMetronomeUI();
      });
    }

    if (metronomeStartStopBtn) {
      metronomeStartStopBtn.addEventListener("click", () => {
        appState.metronomeArmed = !appState.metronomeArmed;
        renderMetronomeUI();
      });
    }

    if (sequenceTimeSignatureSelect) {
      sequenceTimeSignatureSelect.addEventListener("change", () => {
        appState.sequenceTimeSignature = normalizeTimeSignature(sequenceTimeSignatureSelect.value);
        renderProgressionBuilderUI();
      });
    }

    if (suggestBtn) {
      suggestBtn.addEventListener("click", refreshSuggestionsIfReady);
    }

    if (playProgressionBtn) {
      playProgressionBtn.addEventListener("click", () => {
        void handlePlayProgression("all");
      });
    }

    if (playFromSelectedBtn) {
      playFromSelectedBtn.addEventListener("click", () => {
        void handlePlayProgression("selected");
      });
    }

    if (newProgressionBtn) {
      newProgressionBtn.addEventListener("click", event => {
        event.stopPropagation();
        if (appState.newProgressionConfirmOpen) {
          closeNewProgressionConfirm();
          return;
        }
        openNewProgressionConfirm();
      });
    }

    if (confirmNewProgressionBtn) {
      confirmNewProgressionBtn.addEventListener("click", event => {
        event.stopPropagation();
        handleNewProgression();
      });
    }

    if (cancelNewProgressionBtn) {
      cancelNewProgressionBtn.addEventListener("click", event => {
        event.stopPropagation();
        closeNewProgressionConfirm();
      });
    }

    if (sectionHelpModalClose) {
      sectionHelpModalClose.addEventListener("click", event => {
        event.stopPropagation();
        closeSectionHelpModal();
      });
    }

    sectionHelpButtons.forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const topic = button.getAttribute("data-help-topic");
        if (!topic) {
          return;
        }

        if (appState.sectionHelpTopic === topic) {
          closeSectionHelpModal();
          return;
        }

        openSectionHelpModal(topic);
      });
    });

    if (loadDemoProgressionBtn) {
      loadDemoProgressionBtn.addEventListener("click", event => {
        event.stopPropagation();
        if (appState.demoMenuOpen) {
          closeDemoMenu();
          return;
        }

        void openDemoMenu();
      });
    }

    if (saveProgressionBtn) {
      saveProgressionBtn.addEventListener("click", handleSaveProgression);
    }

    if (loadProgressionBtn && loadProgressionInput) {
      loadProgressionBtn.addEventListener("click", () => {
        loadProgressionInput.click();
      });

      loadProgressionInput.addEventListener("change", handleLoadProgression);
    }

    document.addEventListener("click", event => {
      const target = event.target;
      const helpTrigger = target?.closest?.("[data-help-topic]");
      if (helpTrigger) {
        event.stopPropagation();
        const topic = helpTrigger.getAttribute("data-help-topic");
        if (topic) {
          if (appState.sectionHelpTopic === topic) {
            closeSectionHelpModal();
          } else {
            openSectionHelpModal(topic);
          }
        }
        return;
      }

      if (appState.metronomePopoverOpen) {
        if (!(metronomePopover?.contains(target) || metronomeToggleBtn?.contains(target))) {
          closeMetronomePopover();
        }
      }

      if (appState.demoMenuOpen) {
        if (!(demoMenuPopover?.contains(target) || loadDemoProgressionBtn?.contains(target))) {
          closeDemoMenu();
        }
      }

      if (appState.newProgressionConfirmOpen) {
        const clickedInsideConfirmDialog = Boolean(target?.closest?.(".progression-confirm-modal"));
        if (!clickedInsideConfirmDialog && !newProgressionBtn?.contains(target)) {
          closeNewProgressionConfirm();
        }
      }

      if (appState.sectionHelpTopic) {
        const clickedInsideHelpDialog = Boolean(target?.closest?.(".section-help-modal"));
        const clickedHelpTrigger = Boolean(target?.closest?.("[data-help-topic]"));
        if (!clickedInsideHelpDialog && !clickedHelpTrigger) {
          closeSectionHelpModal();
        }
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (appState.metronomePopoverOpen) {
          closeMetronomePopover();
        }
        if (appState.demoMenuOpen) {
          closeDemoMenu();
        }
        if (appState.newProgressionConfirmOpen) {
          closeNewProgressionConfirm();
        }
        if (appState.sectionHelpTopic) {
          closeSectionHelpModal();
        }
      }
    });

    console.log("✓ App initialized successfully");
  } catch (error) {
    console.error("✗ Initialization failed:", error);
    renderError(results, "Failed to load app data.");
  }
}

init();
