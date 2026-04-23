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
 * Depends on: dataLoader, theoryEngine, ui, rootSelector, synth, chordNotes, playback
 */
import { loadAllData } from "./dataLoader.js";
import { getSuggestions } from "./theoryEngine.js";
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
import { buildMidiFileBytes } from "./midiExport.js";
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
import {
  DEFAULT_APP_SETTINGS,
  applySettingsToAppState,
  loadAppSettings,
  mergeWithDefaultSettings,
  saveAppSettings
} from "./settings.js";
import {
  connectAiModel,
  getActiveAiProviderConfig,
  getAiModelStatus,
  listAiModels,
  listAvailableAiProviders,
  sendAiPrompt
} from "./aiService.js";
import {
  buildAiExplorePromptRequest,
  buildAiSuggestionPromptRequest,
  buildAiSuggestionRenderItems,
  DEFAULT_AI_SUGGESTION_BEHAVIOR,
  normalizeAiSuggestionBehavior,
  parseAiSuggestionResponse,
  buildAiExploreProgressionInstructions,
  parseAiExploreSuggestions
} from "./aiPrompts/index.js";

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
const suggestAiBtn = document.getElementById("suggestAiBtn");
const toggleAiSuggestionBehaviorBtn = document.getElementById("toggleAiSuggestionBehaviorBtn");
const aiSuggestionBehaviorPanel = document.getElementById("aiSuggestionBehaviorPanel");
const aiSuggestionProfileSelect = document.getElementById("aiSuggestionProfile");
const aiSuggestionPhraseRoleSelect = document.getElementById("aiSuggestionPhraseRole");
const aiSuggestionBassBehaviourSelect = document.getElementById("aiSuggestionBassBehaviour");
const aiSuggestionTopNoteBehaviourSelect = document.getElementById("aiSuggestionTopNoteBehaviour");
const aiSuggestionColourSelect = document.getElementById("aiSuggestionColour");
const autoSuggestToggle = document.getElementById("autoSuggestToggle");
const playProgressionBtn = document.getElementById("playProgressionBtn");
const playFromSelectedBtn = document.getElementById("playFromSelectedBtn");
const undoProgressionBtn = document.getElementById("undoProgressionBtn");
const redoProgressionBtn = document.getElementById("redoProgressionBtn");
const newProgressionBtn = document.getElementById("newProgressionBtn");
const newProgressionConfirmPopover = document.getElementById("newProgressionConfirmPopover");
const confirmNewProgressionBtn = document.getElementById("confirmNewProgressionBtn");
const cancelNewProgressionBtn = document.getElementById("cancelNewProgressionBtn");
const loadDemoProgressionBtn = document.getElementById("loadDemoProgressionBtn");
const demoMenuPopover = document.getElementById("demoMenuPopover");
const demoMenuList = document.getElementById("demoMenuList");
const saveProgressionBtn = document.getElementById("saveProgressionBtn");
const exportMidiBtn = document.getElementById("exportMidiBtn");
const loadProgressionBtn = document.getElementById("loadProgressionBtn");
const loadProgressionInput = document.getElementById("loadProgressionInput");
const progressionBlocks = document.getElementById("progressionBlocks");
const progressionSequenceKeyBadge = document.getElementById("progressionSequenceKeyBadge");
const progressionEditor = document.getElementById("progressionEditor");
const sectionHelpModal = document.getElementById("sectionHelpModal");
const sectionHelpModalTitle = document.getElementById("sectionHelpModalTitle");
const sectionHelpModalBody = document.getElementById("sectionHelpModalBody");
const sectionHelpModalClose = document.getElementById("sectionHelpModalClose");
const openSettingsBtn = document.getElementById("openSettingsBtn");
const appSettingsModal = document.getElementById("appSettingsModal");
const appSettingsModalClose = document.getElementById("appSettingsModalClose");
const defaultTempoBpmSettingInput = document.getElementById("defaultTempoBpmSetting");
const aiProviderSettingSelect = document.getElementById("aiProviderSetting");
const aiLmStudioSettingsPanel = document.getElementById("aiLmStudioSettingsPanel");
const aiBaseUrlSettingInput = document.getElementById("aiBaseUrlSetting");
const loadAiModelsBtn = document.getElementById("loadAiModelsBtn");
const aiModelsStatus = document.getElementById("aiModelsStatus");
const aiModelSelectSetting = document.getElementById("aiModelSelectSetting");
const saveAppSettingsBtn = document.getElementById("saveAppSettingsBtn");
const cancelAppSettingsBtn = document.getElementById("cancelAppSettingsBtn");
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
const suggestionDebugPanel = document.getElementById("suggestionDebugPanel");
const suggestionTheoryDebugPanel = document.getElementById("suggestionTheoryDebugPanel");
const suggestionDebugOutput = document.getElementById("suggestionDebugOutput");
const suggestionAiDebugOutput = document.getElementById("suggestionAiDebugOutput");
const suggestionAiDebugPanel = document.getElementById("suggestionAiDebugPanel");
const suggestionAiStatus = document.getElementById("suggestionAiStatus");
const toggleSuggestionDebugBtn = document.getElementById("toggleSuggestionDebugBtn");
const copySuggestionTheoryDebugBtn = document.getElementById("copySuggestionTheoryDebugBtn");
const copySuggestionAiDebugBtn = document.getElementById("copySuggestionAiDebugBtn");
const rootContainer = document.getElementById("rootContainer");
const keyInfo = document.getElementById("keyInfo");
const chordButtons = document.getElementById("chordButtons");
const bassRootSelector = document.getElementById("bassRootSelector");
const chordRootSelector = document.getElementById("chordRootSelector");
const sequenceKeyboard = document.getElementById("sequenceKeyboard");
const sequenceKeyboardToolbarMount = document.getElementById("sequenceKeyboardToolbarMount");
const suggestionEngineStatusIcon = document.querySelector('[data-tool-panel="suggestionEnginePanel"] .tool-nav-status-icon');
const aiExploreStatusIcon = document.querySelector('[data-tool-panel="aiExplorePanel"] .tool-nav-status-icon');
const aiExploreStatus = document.getElementById("aiExploreStatus");
const aiExploreStatusMessage = document.getElementById("aiExploreStatusMessage");
const aiExploreConnectBtn = document.getElementById("aiExploreConnectBtn");
const aiExploreBaseUrl = document.getElementById("aiExploreBaseUrl");
const aiExploreSelectedModel = document.getElementById("aiExploreSelectedModel");
const aiExploreLoadedState = document.getElementById("aiExploreLoadedState");
const aiExploreReasoningEffortSelect = document.getElementById("aiExploreReasoningEffort");
const aiExplorePromptInput = document.getElementById("aiExplorePromptInput");
const aiExploreSubmitBtn = document.getElementById("aiExploreSubmitBtn");
const aiExploreResponseOutput = document.getElementById("aiExploreResponseOutput");
const aiExploreConversationList = document.getElementById("aiExploreConversationList");
const aiExploreDebugPanel = document.getElementById("aiExploreDebugPanel");
const aiExploreDebugOutput = document.getElementById("aiExploreDebugOutput");
const toggleAiExploreDebugBtn = document.getElementById("toggleAiExploreDebugBtn");
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
  appSettingsModalOpen: false,
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
  progressionInvalidTokens: [],
  suggestionDebugVisible: false,
  suggestionAiRequesting: false,
  suggestionAiStatus: {
    type: "idle",
    message: ""
  },
  suggestionAiResults: [],
  suggestionAiAttempted: false,
  suggestionAiMessage: "",
  suggestionAiWarning: "",
  suggestionAiDebugText: "No AI suggestion debug yet.",
  aiSuggestionBehavior: {
    ...DEFAULT_AI_SUGGESTION_BEHAVIOR
  },
  appSettings: mergeWithDefaultSettings(DEFAULT_APP_SETTINGS),
  appSettingsDraft: mergeWithDefaultSettings(DEFAULT_APP_SETTINGS),
  aiSettingsModels: [],
  aiSettingsStatus: {
    type: "idle",
    message: "Load models to choose which AI model to save."
  },
  aiExploreStatus: {
    type: "idle",
    message: "Choose an AI model in Settings, then connect to start exploring prompts."
  },
  aiExploreAvailableModels: [],
  aiExploreLoadedInstanceId: "",
  aiExploreSelectedModelLoaded: false,
  aiExploreCheckingConnection: false,
  aiExploreConnecting: false,
  aiExploreSubmitting: false,
  aiExploreReasoningEffort: "medium",
  aiExplorePrompt: "",
  aiExploreResponse: "No response yet.",
  aiExploreDebugVisible: false,
  aiExploreDebugText: "No AI Explore debug yet.",
  aiExploreConversation: []
};
window.appState = appState;
let sequenceKeyboardMidiNotes = [];
let suggestionDebugCopyResetTimer = null;
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
const MAX_PROGRESSION_UNDO_STEPS = 5;
let activeToolPanelId = "keyExplorerPanel";
let toolPanelTransitionTimeout = null;
let progressionPreviewToken = 0;
let activeProgressionPlaybackSession = null;
const MAX_CONVERSATION_TURNS = 20;
let activeProgressionPlaybackMode = null;
let removeAudioPrimingListeners = null;
let isPrimingAudio = false;
let musicDemoEntries = [];
let isLoadingMusicDemos = false;
let progressionUndoHistory = [];
let progressionRedoHistory = [];

const DEFAULT_MUSIC_DEMO_FILE = "Demo01-cIonian.json";
const MUSIC_DEMOS_DIR_PATH = "./Music%20Demos/";
const MUSIC_DEMOS_MANIFEST_PATH = "./Music%20Demos/index.json";
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

function parseSuggestedNoteReference(noteLabel, fallbackOctave = null) {
  const cleaned = String(noteLabel || "").trim();
  if (!cleaned) {
    return null;
  }

  const match = /^([A-G](?:#{1,2}|b{1,2})?)(-?\d+)?$/i.exec(cleaned);
  if (!match) {
    return null;
  }

  const note = normaliseRoot(match[1].charAt(0).toUpperCase() + match[1].slice(1));
  const octave = match[2] != null ? Number(match[2]) : fallbackOctave;
  if (!note || !Number.isFinite(octave)) {
    return null;
  }

  const midi = noteToMidi(note, octave);
  return Number.isFinite(midi) ? { note, octave, midi } : null;
}

function buildAiSuggestedPlayback(item) {
  const parsed = parseChordName(item?.chord || "");
  if (!parsed) {
    return null;
  }

  const bassReference = parseSuggestedNoteReference(item?.bass || parsed.bass || parsed.root, 2)
    || parseSuggestedNoteReference(parsed.bass || parsed.root, 2);
  if (!bassReference) {
    return null;
  }

  const topReference = parseSuggestedNoteReference(item?.topNote || "", 5);
  const rootMidi = noteToMidi(parsed.root, 4);
  if (!Number.isFinite(rootMidi)) {
    return null;
  }

  const middleNotes = parsed.intervals
    .map(interval => rootMidi + interval)
    .filter(Number.isFinite)
    .map(midi => {
      let candidate = midi;
      while (candidate <= bassReference.midi + 5) {
        candidate += 12;
      }
      return candidate;
    });

  const voicing = [bassReference.midi, ...middleNotes];
  const highestBase = voicing.length ? Math.max(...voicing) : bassReference.midi;
  if (topReference?.midi != null) {
    let topMidi = topReference.midi;
    while (topMidi <= highestBase) {
      topMidi += 12;
    }
    voicing.push(topMidi);
  }

  return {
    notes: [...new Set(voicing)].sort((a, b) => a - b),
    inversionLabel: "AI shape",
    inversionShortLabel: "ai",
    voicingLabel: "Suggested bass/top note",
    voicingShortLabel: "ai"
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

function getAiSuggestionProgressionOverrides(item, source = "suggestion-engine-ai") {
  const playback = buildAiSuggestedPlayback(item);
  if (!playback) {
    return {};
  }

  return {
    voicing: {
      source,
      inversionLabel: playback.inversionLabel,
      inversionShortLabel: playback.inversionShortLabel,
      voicingLabel: playback.voicingLabel,
      voicingShortLabel: playback.voicingShortLabel,
      notes: playback.notes.map(midi => ({
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

  if (appState.appSettingsModalOpen) {
    closeAppSettingsModal();
  }

  appState.sectionHelpTopic = normalizedTopic;
  renderSectionHelpModal();
  sectionHelpModalClose?.focus();
}

function syncAppSettingsDraftFromSavedState() {
  appState.appSettingsDraft = mergeWithDefaultSettings(appState.appSettings);
}

function normalizeAiSettingsBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "") || DEFAULT_APP_SETTINGS.preferences.ai.providers.lmStudio.baseUrl;
}

function getDraftAiProviderConfig() {
  return getActiveAiProviderConfig(appState.appSettingsDraft);
}

function getSavedAiProviderConfig() {
  return getActiveAiProviderConfig(appState.appSettings);
}

function getAiSettingsModelLabel(model) {
  return String(model?.label || model?.displayName || model?.key || "Unnamed model");
}

function ensureDraftAiProviderSettings(providerId) {
  if (!appState.appSettingsDraft.preferences.ai.providers[providerId]) {
    appState.appSettingsDraft.preferences.ai.providers[providerId] = {};
  }

  return appState.appSettingsDraft.preferences.ai.providers[providerId];
}

function setDraftAiProvider(providerId) {
  appState.appSettingsDraft.preferences.ai.provider = providerId;
}

function setDraftLmStudioBaseUrl(value) {
  const lmStudioSettings = ensureDraftAiProviderSettings("lmStudio");
  lmStudioSettings.baseUrl = normalizeAiSettingsBaseUrl(value);
}

function setDraftActiveAiSelectedModel(value) {
  const { providerId } = getDraftAiProviderConfig();
  const providerSettings = ensureDraftAiProviderSettings(providerId);
  providerSettings.selectedModel = String(value || "").trim();
}

function renderAiProviderOptions() {
  if (!aiProviderSettingSelect) {
    return;
  }

  aiProviderSettingSelect.replaceChildren();

  listAvailableAiProviders().forEach(provider => {
    const option = document.createElement("option");
    option.value = provider.id;
    option.textContent = provider.label;
    aiProviderSettingSelect.appendChild(option);
  });

  aiProviderSettingSelect.value = getDraftAiProviderConfig().providerId;
}

function setAiSettingsStatus(type, message) {
  appState.aiSettingsStatus = {
    type,
    message: String(message || "").trim()
  };
}

function setAiExploreStatus(type, message) {
  appState.aiExploreStatus = {
    type,
    message: String(message || "").trim()
  };
}

function stringifyDebugValue(value) {
  if (value == null || value === "") {
    return "(none)";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function setAiExploreDebug(action, debug = {}, extra = {}) {
  const lines = [
    `Action: ${String(action || "").trim() || "(unknown)"}`,
    `When: ${new Date().toISOString()}`,
    `Method: ${String(debug?.method || extra.method || "(unknown)")}`,
    `URL: ${String(debug?.url || extra.url || "(unknown)")}`,
    `Status: ${debug?.status != null ? `${debug.status}${debug.statusText ? ` ${debug.statusText}` : ""}` : (extra.status || "(pending)")}`,
    "",
    "Payload:",
    stringifyDebugValue(debug?.requestBody ?? extra.requestBody),
    "",
    "Response:",
    stringifyDebugValue(debug?.responseBody ?? extra.responseBody),
    "",
    `Error: ${String(debug?.error || extra.error || "(none)")}`,
    `Hint: ${String(extra.hint || "(none)")}`
  ];

  appState.aiExploreDebugText = lines.join("\n");
}

function renderAiExploreDebugVisibility() {
  if (aiExploreDebugPanel) {
    aiExploreDebugPanel.hidden = !appState.aiExploreDebugVisible;
  }

  if (toggleAiExploreDebugBtn) {
    const label = appState.aiExploreDebugVisible ? "Hide AI Explore Debug" : "Show AI Explore Debug";
    toggleAiExploreDebugBtn.setAttribute("aria-pressed", String(appState.aiExploreDebugVisible));
    toggleAiExploreDebugBtn.setAttribute("aria-label", label);
    toggleAiExploreDebugBtn.dataset.tooltip = appState.aiExploreDebugVisible
      ? "Hide the AI Explore debug panel"
      : "Show the AI Explore debug panel";
  }
}

function setSuggestionAiStatus(type, message = "") {
  appState.suggestionAiStatus = {
    type,
    message: String(message || "").trim()
  };
}

function clearSuggestionAiState() {
  appState.suggestionAiRequesting = false;
  appState.suggestionAiResults = [];
  appState.suggestionAiAttempted = false;
  appState.suggestionAiMessage = "";
  appState.suggestionAiWarning = "";
  appState.suggestionAiDebugText = "No AI suggestion debug yet.";
  setSuggestionAiStatus("idle", "");
}

function renderSuggestionAiStatus() {
  if (!suggestionAiStatus) {
    return;
  }

  const hasMessage = Boolean(appState.suggestionAiStatus?.message);
  suggestionAiStatus.hidden = !hasMessage;
  suggestionAiStatus.className = `suggestion-ai-status suggestion-ai-status-${appState.suggestionAiStatus?.type || "idle"}`;
  suggestionAiStatus.textContent = appState.suggestionAiStatus?.message || "";
}

function setSuggestionAiDebug(action, debug = {}, extra = {}) {
  const lines = [
    `Action: ${String(action || "").trim() || "(unknown)"}`,
    `When: ${new Date().toISOString()}`,
    `Method: ${String(debug?.method || extra.method || "(unknown)")}`,
    `URL: ${String(debug?.url || extra.url || "(unknown)")}`,
    `Status: ${debug?.status != null ? `${debug.status}${debug.statusText ? ` ${debug.statusText}` : ""}` : (extra.status || "(pending)")}`,
    "",
    "Prompt Details:",
    stringifyDebugValue(extra.promptRequest || extra.requestBody || "(none)"),
    "",
    "Prompt Summary:",
    stringifyDebugValue(extra.promptSummary || "(none)"),
    "",
    "Normalized Parameters:",
    stringifyDebugValue(extra.normalizedParameters || "(none)"),
    "",
    "Payload:",
    stringifyDebugValue(debug?.requestBody ?? extra.requestBody),
    "",
    "Raw Response:",
    stringifyDebugValue(extra.rawResponse || debug?.responseBody),
    "",
    "Parsed Suggestions:",
    stringifyDebugValue(extra.parsedSuggestions || "(none)"),
    "",
    "Dropped Suggestions:",
    stringifyDebugValue(extra.droppedSuggestions || "(none)"),
    "",
    `Error: ${String(debug?.error || extra.error || "(none)")}`,
    `Hint: ${String(extra.hint || "(none)")}`
  ];

  appState.suggestionAiDebugText = lines.join("\n");
}

function getSuggestionAiContextToken() {
  return JSON.stringify({
    key: appState.selectedKey,
    feeling: feelingSelect?.value || "",
    progression: progressionItemsToText(appState.progressionItems),
    topNotes: formatProgressionWithTopNotes(appState.progressionItems),
    aiSuggestionBehavior: appState.aiSuggestionBehavior
  });
}

function renderAiSettingsModelOptions() {
  if (!aiModelSelectSetting) {
    return;
  }

  aiModelSelectSetting.replaceChildren();

  const models = Array.isArray(appState.aiSettingsModels) ? appState.aiSettingsModels : [];
  const { selectedModel } = getDraftAiProviderConfig();

  if (!models.length) {
    const option = document.createElement("option");
    option.value = selectedModel;
    option.textContent = selectedModel || "Load models first";
    aiModelSelectSetting.appendChild(option);
    aiModelSelectSetting.disabled = true;
    aiModelSelectSetting.value = selectedModel;
    return;
  }

  let nextSelectedModel = selectedModel;
  if (!models.some(model => String(model?.key || "").trim() === nextSelectedModel)) {
    nextSelectedModel = String(models[0]?.key || "").trim();
    setDraftActiveAiSelectedModel(nextSelectedModel);
  }

  models.forEach(model => {
    const option = document.createElement("option");
    option.value = String(model?.key || "").trim();
    option.textContent = getAiSettingsModelLabel(model);
    aiModelSelectSetting.appendChild(option);
  });

  aiModelSelectSetting.disabled = false;
  aiModelSelectSetting.value = nextSelectedModel;
}

function renderAppSettingsModal() {
  if (appSettingsModal) {
    appSettingsModal.hidden = !appState.appSettingsModalOpen;
  }

  if (defaultTempoBpmSettingInput) {
    const draftTempo = appState.appSettingsDraft?.preferences?.defaultTempoBpm;
    defaultTempoBpmSettingInput.value = String(draftTempo ?? DEFAULT_APP_SETTINGS.preferences.defaultTempoBpm);
  }

  renderAiProviderOptions();

  const draftAiProviderConfig = getDraftAiProviderConfig();

  if (aiProviderSettingSelect) {
    aiProviderSettingSelect.value = draftAiProviderConfig.providerId;
  }

  if (aiLmStudioSettingsPanel) {
    aiLmStudioSettingsPanel.hidden = draftAiProviderConfig.providerId !== "lmStudio";
  }

  if (aiBaseUrlSettingInput) {
    aiBaseUrlSettingInput.value = String(draftAiProviderConfig.baseUrl || DEFAULT_APP_SETTINGS.preferences.ai.providers.lmStudio.baseUrl);
  }

  renderAiSettingsModelOptions();

  if (aiModelsStatus) {
    aiModelsStatus.className = `app-settings-ai-status app-settings-ai-status-${appState.aiSettingsStatus?.type || "idle"}`;
    aiModelsStatus.textContent = appState.aiSettingsStatus?.message || "Load models to choose which AI model to save.";
  }
}

function closeAppSettingsModal() {
  if (!appState.appSettingsModalOpen) {
    return;
  }

  appState.appSettingsModalOpen = false;
  syncAppSettingsDraftFromSavedState();
  renderAppSettingsModal();
}

function openAppSettingsModal() {
  if (appState.sectionHelpTopic) {
    closeSectionHelpModal();
  }

  syncAppSettingsDraftFromSavedState();
  appState.aiSettingsModels = [];
  setAiSettingsStatus("idle", "Load models to choose which AI model to save.");
  appState.appSettingsModalOpen = true;
  renderAppSettingsModal();
  appSettingsModalClose?.focus();
}

function shouldApplyDefaultTempoToCurrentSequence(previousDefaultTempoBpm) {
  return appState.sequenceTempoBpm === previousDefaultTempoBpm;
}

function handleSaveAppSettings() {
  const previousDefaultTempoBpm = appState.appSettings?.preferences?.defaultTempoBpm
    ?? DEFAULT_APP_SETTINGS.preferences.defaultTempoBpm;
  const lmStudioDraftSettings = ensureDraftAiProviderSettings("lmStudio");
  const nextSettings = mergeWithDefaultSettings({
    ...appState.appSettingsDraft,
    preferences: {
      ...appState.appSettingsDraft?.preferences,
      defaultTempoBpm: defaultTempoBpmSettingInput?.value,
      ai: {
        ...appState.appSettingsDraft?.preferences?.ai,
        provider: aiProviderSettingSelect?.value || getDraftAiProviderConfig().providerId,
        providers: {
          ...appState.appSettingsDraft?.preferences?.ai?.providers,
          lmStudio: {
            ...lmStudioDraftSettings,
            baseUrl: normalizeAiSettingsBaseUrl(aiBaseUrlSettingInput?.value),
            selectedModel: aiModelSelectSetting?.value
          }
        }
      }
    }
  });

  appState.appSettings = saveAppSettings(nextSettings);
  appState.appSettingsModalOpen = false;
  syncAppSettingsDraftFromSavedState();
  appState.aiExploreAvailableModels = [];
  appState.aiExploreLoadedInstanceId = "";
  appState.aiExploreSelectedModelLoaded = false;
  setAiExploreStatus("idle", "Settings saved. Open AI Explore and connect to the selected model.");

  if (shouldApplyDefaultTempoToCurrentSequence(previousDefaultTempoBpm)) {
    appState.sequenceTempoBpm = appState.appSettings.preferences.defaultTempoBpm;
  }

  renderAppSettingsModal();
  renderProgressionBuilderUI();

  if (activeToolPanelId === "aiExplorePanel") {
    void refreshAiExploreModelStatus({ silent: true });
  }
}

async function handleLoadAiModels() {
  setDraftLmStudioBaseUrl(aiBaseUrlSettingInput?.value);
  appState.aiSettingsModels = [];
  const { providerLabel } = getDraftAiProviderConfig();
  setAiSettingsStatus("loading", `Loading models from ${providerLabel}...`);
  renderAppSettingsModal();

  try {
    appState.aiSettingsModels = await listAiModels(appState.appSettingsDraft);
    if (!appState.aiSettingsModels.length) {
      setAiSettingsStatus("error", `${providerLabel} did not return any LLM models.`);
      renderAppSettingsModal();
      return;
    }

    const { selectedModel } = getDraftAiProviderConfig();
    if (!appState.aiSettingsModels.some(model => String(model?.key || "").trim() === selectedModel)) {
      setDraftActiveAiSelectedModel(String(appState.aiSettingsModels[0]?.key || "").trim());
    }

    setAiSettingsStatus("success", `Loaded ${appState.aiSettingsModels.length} model${appState.aiSettingsModels.length === 1 ? "" : "s"} from ${providerLabel}.`);
  } catch (error) {
    appState.aiSettingsModels = [];
    setAiSettingsStatus(
      "error",
      error instanceof Error ? error.message : `Could not load models from ${providerLabel}.`
    );
  }

  renderAppSettingsModal();
}

function renderAiExploreUI() {
  const { baseUrl, selectedModel } = getSavedAiProviderConfig();
  const isModelConfigured = Boolean(selectedModel);
  const isLoaded = Boolean(appState.aiExploreSelectedModelLoaded && appState.aiExploreLoadedInstanceId);
  const isBusy = Boolean(appState.aiExploreCheckingConnection || appState.aiExploreConnecting || appState.aiExploreSubmitting);
  const hasPrompt = Boolean(String(appState.aiExplorePrompt || "").trim());

  if (aiExploreBaseUrl) {
    aiExploreBaseUrl.textContent = baseUrl || "-";
  }

  if (aiExploreSelectedModel) {
    aiExploreSelectedModel.textContent = selectedModel || "No model saved in Settings";
  }

  if (aiExploreLoadedState) {
    aiExploreLoadedState.textContent = isModelConfigured
      ? (isLoaded ? `Loaded (${appState.aiExploreLoadedInstanceId})` : "Not loaded")
      : "No model selected";
  }

  if (aiExploreStatus) {
    aiExploreStatus.className = `tool-status tool-status-${appState.aiExploreStatus?.type || "idle"}`;
  }

  if (aiExploreStatusMessage) {
    aiExploreStatusMessage.textContent = appState.aiExploreStatus?.message || "";
  }

  const statusIcon = aiExploreStatus?.querySelector(".tool-status-icon");
  if (statusIcon) {
    statusIcon.textContent = appState.aiExploreStatus?.type === "error"
      ? "!"
      : appState.aiExploreStatus?.type === "success"
        ? "+"
        : "i";
  }

  if (aiExploreConnectBtn) {
    aiExploreConnectBtn.disabled = !isModelConfigured || isLoaded || isBusy;
    aiExploreConnectBtn.textContent = appState.aiExploreConnecting
      ? "Connecting..."
      : appState.aiExploreCheckingConnection
        ? "Checking..."
        : "Connect";
  }

  if (aiExplorePromptInput) {
    aiExplorePromptInput.disabled = !isLoaded || isBusy;
    if (aiExplorePromptInput.value !== appState.aiExplorePrompt) {
      aiExplorePromptInput.value = appState.aiExplorePrompt;
    }
    aiExplorePromptInput.placeholder = isLoaded
      ? "Type a prompt to send to the connected AI model."
      : "Connect to the selected model first, then type a prompt here.";
  }

  if (aiExploreReasoningEffortSelect) {
    aiExploreReasoningEffortSelect.value = appState.aiExploreReasoningEffort || "medium";
    aiExploreReasoningEffortSelect.disabled = Boolean(appState.aiExploreSubmitting);
  }

  if (aiExploreSubmitBtn) {
    aiExploreSubmitBtn.disabled = !isLoaded || isBusy || !hasPrompt;
    aiExploreSubmitBtn.textContent = appState.aiExploreSubmitting ? "Submitting..." : "Submit";
  }

  if (aiExploreDebugOutput) {
    const nextDebugText = appState.aiExploreDebugText || "No AI Explore debug yet.";
    if (aiExploreDebugOutput.textContent !== nextDebugText) {
      aiExploreDebugOutput.textContent = nextDebugText;
    }
  }

  renderAiExploreConversationList();
  renderAiExploreDebugVisibility();
}

/**
 * Render the AI Explore conversation message list.
 */
function renderAiExploreConversationList() {
  if (!aiExploreConversationList) {
    return;
  }

  const conversation = Array.isArray(appState.aiExploreConversation) ? appState.aiExploreConversation : [];

  if (!conversation.length) {
    aiExploreConversationList.innerHTML = '<div class="ai-explore-conversation-empty">No messages yet. Type a prompt below to start the conversation.</div>';
    return;
  }

  aiExploreConversationList.innerHTML = "";

  conversation.forEach((message, index) => {
    const messageEl = document.createElement("div");
    messageEl.className = `ai-explore-message ai-explore-message-${message.role || "assistant"}`;

    const roleEl = document.createElement("div");
    roleEl.className = "ai-explore-message-role";
    roleEl.textContent = message.role === "user" ? "You" : "AI";
    messageEl.appendChild(roleEl);

    const bubbleEl = document.createElement("div");
    bubbleEl.className = "ai-explore-message-bubble";
    bubbleEl.textContent = message.content || "";
    messageEl.appendChild(bubbleEl);

    // Render suggestion cards if present
    if (message.suggestions?.length) {
      const suggestionCardsEl = document.createElement("div");
      suggestionCardsEl.className = "ai-explore-suggestion-cards";

      message.suggestions.forEach((suggestion, sIndex) => {
        const cardEl = document.createElement("div");
        cardEl.className = "ai-explore-suggestion-card";
        cardEl.dataset.suggestionIndex = sIndex;

        // Left column: chord name + role + play
        const leftCol = document.createElement("div");
        leftCol.className = "ai-explore-suggestion-left";

        // Chord row with play button
        const chordRow = document.createElement("div");
        chordRow.className = "ai-explore-suggestion-chord-row";

        const chordEl = document.createElement("div");
        chordEl.className = "ai-explore-suggestion-chord";
        chordEl.textContent = suggestion.chord || "?";
        chordEl.style.cursor = "pointer";
        chordEl.title = `Play ${suggestion.chord}`;
        chordEl.addEventListener("click", () => {
          void handleAiExplorePlaySuggestion(suggestion);
        });
        chordRow.appendChild(chordEl);

        // Play button
        const playBtn = document.createElement("button");
        playBtn.className = "ai-explore-suggestion-play-btn";
        playBtn.innerHTML = "&#9654;"; // play triangle
        playBtn.title = `Play ${suggestion.chord}`;
        playBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          void handleAiExplorePlaySuggestion(suggestion);
        });
        chordRow.appendChild(playBtn);

        leftCol.appendChild(chordRow);

        // Role label
        const roleEl2 = document.createElement("div");
        roleEl2.className = "ai-explore-suggestion-role";
        roleEl2.textContent = suggestion.role || "suggestion";
        leftCol.appendChild(roleEl2);

        cardEl.appendChild(leftCol);

        // Middle: reason
        const reasonEl = document.createElement("div");
        reasonEl.className = "ai-explore-suggestion-reason";
        reasonEl.textContent = suggestion.reason || "";
        cardEl.appendChild(reasonEl);

        // Bottom row: bass info + Add button
        const bottomRow = document.createElement("div");
        bottomRow.className = "ai-explore-suggestion-bottom";

        if (suggestion.bass) {
          const bassEl = document.createElement("div");
          bassEl.className = "ai-explore-suggestion-bass";
          bassEl.textContent = `Bass: ${suggestion.bass}`;
          bottomRow.appendChild(bassEl);
        }

        const addBtn = document.createElement("button");
        addBtn.className = "ai-explore-suggestion-add-btn";
        addBtn.textContent = "Add";
        addBtn.dataset.suggestionIndex = sIndex;
        addBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          void handleAiExploreAddSuggestion(message, sIndex, addBtn);
        });
        bottomRow.appendChild(addBtn);

        cardEl.appendChild(bottomRow);

        suggestionCardsEl.appendChild(cardEl);
      });

      messageEl.appendChild(suggestionCardsEl);
    }

    aiExploreConversationList.appendChild(messageEl);
  });

  // Scroll to bottom
  requestAnimationFrame(() => {
    aiExploreConversationList.scrollTop = aiExploreConversationList.scrollHeight;
  });
}

/**
 * Build a custom voicing for an AI-suggested chord using the suggested bass and top note.
 * Returns an array of MIDI notes, or null if building fails.
 */
function buildAiSuggestedVoicingNotes(chordName, suggestedBass, suggestedTopNote) {
  const bassMatch = String(suggestedBass || "").match(/^([A-G]#?b?)(\d+)$/);
  if (!bassMatch) return null;

  const bassRoot = bassMatch[1];
  const bassOctave = parseInt(bassMatch[2], 10);
  const bassMidi = noteToMidi(bassRoot, bassOctave);

  if (bassMidi == null || !Number.isFinite(bassMidi)) return null;

  const parsedChord = parseChordName(chordName);
  const chordRoot = parsedChord?.root || chordName.replace(/\/.*$/, "");
  const closeVoicing = getAscendingRootVoicing(chordRoot);

  if (!closeVoicing?.notes?.length) return null;

  const originalNotes = closeVoicing.notes
    .map(n => Number(n?.midi))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const originalRootMidi = originalNotes[0];
  const midiDelta = bassMidi - originalRootMidi;
  const bodyNotes = originalNotes
    .slice(1)
    .map(n => n + midiDelta)
    .filter(n => n > bassMidi);

  // Replace highest note with suggested top note if provided
  if (suggestedTopNote) {
    const topMatch = String(suggestedTopNote).match(/^([A-G]#?b?)(\d+)$/);
    if (topMatch) {
      const topRoot = topMatch[1];
      const topOctave = parseInt(topMatch[2], 10);
      const topMidi = noteToMidi(topRoot, topOctave);
      if (topMidi != null && Number.isFinite(topMidi) && topMidi > bassMidi) {
        if (bodyNotes.length > 0) {
          bodyNotes[bodyNotes.length - 1] = topMidi;
        } else {
          bodyNotes.push(topMidi);
        }
      }
    }
  }

  return [bassMidi, ...bodyNotes].sort((a, b) => a - b);
}

/**
 * Play a chord suggestion from the AI Explore conversation.
 * Uses the suggestion's bass and top note to build the correct voicing.
 */
async function handleAiExplorePlaySuggestion(suggestion) {
  if (!suggestion?.chord) return;

  try {
    await ensureAudioReady();

    const finalNotes = buildAiSuggestedVoicingNotes(
      suggestion.chord,
      suggestion.bass,
      suggestion.topNote
    );

    if (finalNotes?.length) {
      await playVoicingWithSequenceKeyboard(
        finalNotes.map(midi => ({ midi, velocity: DEFAULT_NOTE_VELOCITY })),
        suggestion.chord,
        1.2,
        {
          inversionLabel: "AI shape",
          inversionShortLabel: "ai",
          voicingLabel: "Suggested bass/top note",
          voicingShortLabel: "ai"
        }
      );
      return;
    }

    // Fallback: play with default voicing from chord name
    await playChordWithSequenceKeyboard(suggestion.chord, 1.2);
  } catch (error) {
    console.error("Could not play AI suggestion chord:", error);
  }
}

/**
 * Handle adding a chord suggestion from the AI Explore conversation.
 */
async function handleAiExploreAddSuggestion(message, suggestionIndex, buttonEl) {
  const suggestion = message?.suggestions?.[suggestionIndex];
  if (!suggestion?.chord) {
    return;
  }

  const chordName = suggestion.chord;
  const finalNotes = buildAiSuggestedVoicingNotes(
    chordName,
    suggestion.bass,
    suggestion.topNote
  );

  let voicingOverride = null;
  if (finalNotes?.length) {
    voicingOverride = {
      source: "ai-explore",
      inversionLabel: "AI shape",
      inversionShortLabel: "ai",
      voicingLabel: "Suggested bass/top note",
      voicingShortLabel: "ai",
      notes: finalNotes.map(midi => ({
        midi,
        velocity: DEFAULT_NOTE_VELOCITY
      }))
    };
  }

  appendChordToProgression(chordName, voicingOverride ? { voicing: voicingOverride } : {});

  // Update button to show "Added"
  buttonEl.textContent = "✓";
  buttonEl.classList.add("added");
  buttonEl.disabled = true;
}

/**
 * Build the conversation history array (last N turns) for inclusion in system instructions.
 */
function buildAiExploreConversationHistory() {
  const conversation = Array.isArray(appState.aiExploreConversation) ? appState.aiExploreConversation : [];
  return conversation.slice(-MAX_CONVERSATION_TURNS);
}

/**
 * Build the instructions string for the AI Explore prompt with progression context.
 */
function buildAiExplorePromptInstructions() {
  const progressionChords = progressionItemsToChords(appState.progressionItems);
  const recentWindow = progressionChords.slice(-8);
  const lastChord = progressionChords.length ? progressionChords.at(-1) : "";

  return buildAiExploreProgressionInstructions({
    selectedKey: appState.selectedKey || "",
    progressionChords,
    recentWindow,
    lastChord,
    currentFeeling: feelingSelect?.value || ""
  });
}

async function refreshAiExploreModelStatus(options = {}) {
  const { silent = false } = options;
  const { providerLabel, selectedModel } = getSavedAiProviderConfig();

  appState.aiExploreCheckingConnection = true;
  appState.aiExploreAvailableModels = [];
  appState.aiExploreLoadedInstanceId = "";
  appState.aiExploreSelectedModelLoaded = false;

  if (!selectedModel) {
    setAiExploreStatus("idle", "Pick an AI model in Settings before trying to connect.");
    appState.aiExploreCheckingConnection = false;
    renderAiExploreUI();
    return;
  }

  if (!silent) {
    setAiExploreStatus("loading", `Checking ${providerLabel} for the selected model...`);
  }
  renderAiExploreUI();

  try {
    const status = await getAiModelStatus(appState.appSettings);
    appState.aiExploreAvailableModels = [];
    setAiExploreDebug("check-model-status", status?.debug, {
      hint: "This checks whether the selected AI model is available and already loaded."
    });

    if (!status.available) {
      setAiExploreStatus("error", `The saved model was not returned by ${providerLabel}. Reload models in Settings and choose a valid model.`);
      return;
    }

    appState.aiExploreLoadedInstanceId = status.loadedInstanceId;
    appState.aiExploreSelectedModelLoaded = Boolean(status.loaded);

    if (status.loadedInstanceId) {
      setAiExploreStatus("success", "Selected model is already loaded and ready for prompts.");
    } else {
      appState.aiExploreConnecting = true;
      setAiExploreStatus("loading", `Loading ${selectedModel} in ${providerLabel}...`);
      renderAiExploreUI();

      await connectAiModel(appState.appSettings);

      const refreshedStatus = await getAiModelStatus(appState.appSettings);
      appState.aiExploreLoadedInstanceId = refreshedStatus.loadedInstanceId;
      appState.aiExploreSelectedModelLoaded = Boolean(refreshedStatus.loaded);

      if (refreshedStatus.loaded) {
        setAiExploreStatus("success", "Selected model is loaded and ready for prompts.");
      } else {
        setAiExploreStatus("error", `${providerLabel} did not report the selected model as loaded after connecting.`);
      }
    }
  } catch (error) {
    appState.aiExploreAvailableModels = [];
    appState.aiExploreLoadedInstanceId = "";
    appState.aiExploreSelectedModelLoaded = false;
    setAiExploreDebug("check-model-status", error?.debug, {
      error: error instanceof Error ? error.message : `Could not reach ${providerLabel} to check model status.`,
      hint: "Check the provider address and make sure the local AI server is running."
    });
    setAiExploreStatus(
      "error",
      error instanceof Error ? error.message : `Could not reach ${providerLabel} to check model status.`
    );
  } finally {
    appState.aiExploreConnecting = false;
    appState.aiExploreCheckingConnection = false;
    renderAiExploreUI();
  }
}

function syncAiExploreConnectionState(status) {
  appState.aiExploreLoadedInstanceId = status?.loadedInstanceId || "";
  appState.aiExploreSelectedModelLoaded = Boolean(status?.loaded);
}

async function ensureActiveAiModelLoaded(statusCallback = null) {
  const { providerLabel, selectedModel } = getSavedAiProviderConfig();
  if (!selectedModel) {
    throw new Error("No model is saved in Settings yet.");
  }

  if (typeof statusCallback === "function") {
    statusCallback("loading", `Checking ${providerLabel} for ${selectedModel}...`);
  }

  const status = await getAiModelStatus(appState.appSettings);
  if (!status.available) {
    throw new Error(`The saved model was not returned by ${providerLabel}. Reload models in Settings and choose a valid model.`);
  }

  syncAiExploreConnectionState(status);
  if (status.loaded) {
    return status;
  }

  if (typeof statusCallback === "function") {
    statusCallback("loading", `Loading ${selectedModel} in ${providerLabel}...`);
  }

  await connectAiModel(appState.appSettings);

  if (typeof statusCallback === "function") {
    statusCallback("loading", `Confirming ${selectedModel} is ready...`);
  }

  const refreshedStatus = await getAiModelStatus(appState.appSettings);
  if (!refreshedStatus.available || !refreshedStatus.loaded) {
    throw new Error(`${providerLabel} did not report the selected model as loaded after connecting.`);
  }

  syncAiExploreConnectionState(refreshedStatus);
  return refreshedStatus;
}

function renderSuggestionEngineControls() {
  if (suggestAiBtn) {
    const hasProgression = appState.progressionItems.length > 0;
    suggestAiBtn.disabled = !hasProgression || appState.suggestionAiRequesting;
    suggestAiBtn.textContent = appState.suggestionAiRequesting ? "ASKING AI..." : "ASK AI";
  }

  if (toggleAiSuggestionBehaviorBtn) {
    const isOpen = Boolean(appState.aiSuggestionBehavior?.drawerOpen);
    toggleAiSuggestionBehaviorBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    toggleAiSuggestionBehaviorBtn.textContent = isOpen ? "Hide AI Behaviour" : "AI Behaviour";
  }

  if (aiSuggestionBehaviorPanel) {
    aiSuggestionBehaviorPanel.hidden = !appState.aiSuggestionBehavior?.drawerOpen;
  }

  if (aiSuggestionProfileSelect) {
    aiSuggestionProfileSelect.value = appState.aiSuggestionBehavior?.profile || DEFAULT_AI_SUGGESTION_BEHAVIOR.profile;
    aiSuggestionProfileSelect.disabled = Boolean(appState.suggestionAiRequesting);
  }

  if (aiSuggestionPhraseRoleSelect) {
    aiSuggestionPhraseRoleSelect.value = appState.aiSuggestionBehavior?.phraseRole || DEFAULT_AI_SUGGESTION_BEHAVIOR.phraseRole;
    aiSuggestionPhraseRoleSelect.disabled = Boolean(appState.suggestionAiRequesting);
  }

  if (aiSuggestionBassBehaviourSelect) {
    aiSuggestionBassBehaviourSelect.value = appState.aiSuggestionBehavior?.bassBehaviour || DEFAULT_AI_SUGGESTION_BEHAVIOR.bassBehaviour;
    aiSuggestionBassBehaviourSelect.disabled = Boolean(appState.suggestionAiRequesting);
  }

  if (aiSuggestionTopNoteBehaviourSelect) {
    aiSuggestionTopNoteBehaviourSelect.value = appState.aiSuggestionBehavior?.topNoteBehaviour || DEFAULT_AI_SUGGESTION_BEHAVIOR.topNoteBehaviour;
    aiSuggestionTopNoteBehaviourSelect.disabled = Boolean(appState.suggestionAiRequesting);
  }

  if (aiSuggestionColourSelect) {
    aiSuggestionColourSelect.value = appState.aiSuggestionBehavior?.colour || DEFAULT_AI_SUGGESTION_BEHAVIOR.colour;
    aiSuggestionColourSelect.disabled = Boolean(appState.suggestionAiRequesting);
  }
}

function updateAiSuggestionBehavior(patch = {}) {
  appState.aiSuggestionBehavior = {
    ...DEFAULT_AI_SUGGESTION_BEHAVIOR,
    ...(appState.aiSuggestionBehavior || {}),
    ...patch
  };
}

async function handleSuggestionAiRequest() {
  const suggestionPayload = buildCurrentSuggestionPayload();
  const parsedProgression = Array.isArray(suggestionPayload?.parsedProgression) ? suggestionPayload.parsedProgression : [];
  const contextToken = getSuggestionAiContextToken();

  if (!parsedProgression.length) {
    appState.suggestionAiAttempted = true;
    appState.suggestionAiResults = [];
    appState.suggestionAiMessage = "Add a chord to the sequence before asking AI for next-step suggestions.";
    appState.suggestionAiWarning = "";
    setSuggestionAiStatus("error", appState.suggestionAiMessage);
    setSuggestionAiDebug("request-ai-suggestions", {}, {
      error: "No progression was available for AI suggestions.",
      hint: "Build at least one chord in the sequence before running AI suggestions."
    });
    renderSuggestionResults(suggestionPayload);
    return;
  }

  appState.suggestionAiRequesting = true;
  appState.suggestionAiAttempted = false;
  appState.suggestionAiResults = [];
  appState.suggestionAiMessage = "";
  appState.suggestionAiWarning = "";
  setSuggestionAiStatus("loading", "Preparing AI suggestion request...");
  renderSuggestionEngineControls();
  renderSuggestionResults(suggestionPayload);

  const baseAnalysis = suggestionPayload?.progressionState || {};
  const flexibleContext = {
    analysis: baseAnalysis,
    pedalBassCue: detectPedalBass(getRecentVoicingLabels(appState.progressionItems, 8)),
    recentVoicingLabels: getRecentVoicingLabels(appState.progressionItems, 8)
  };
  const normalizedBehavior = normalizeAiSuggestionBehavior(appState.aiSuggestionBehavior, flexibleContext);
  const promptContext = buildSuggestionAiPromptContext(suggestionPayload, normalizedBehavior.normalized);
  const promptRequest = buildAiSuggestionPromptRequest({
    context: promptContext,
    behavior: normalizedBehavior.normalized,
    profileConfig: normalizedBehavior.profileConfig
  });

  try {
    await ensureActiveAiModelLoaded((type, message) => {
      setSuggestionAiStatus(type, message);
      renderSuggestionAiStatus();
    });

    setSuggestionAiStatus("loading", "Asking AI for next-chord suggestions...");
    renderSuggestionAiStatus();

    const response = await sendAiPrompt(appState.appSettings, promptRequest);
    if (contextToken !== getSuggestionAiContextToken()) {
      setSuggestionAiStatus("idle", "");
      setSuggestionAiDebug("request-ai-suggestions", response?.debug, {
        promptRequest,
        promptSummary: promptRequest.debugMeta?.summaryLines || [],
        rawResponse: response.text || null,
        error: "Discarded stale AI suggestion response because the progression context changed.",
        hint: "Run AI suggestions again for the updated progression."
      });
      return;
    }

    const parsedItems = parseAiSuggestionResponse(response.text);
    const filtered = buildAiSuggestionRenderItems(
      parsedItems,
      {
        analysis: suggestionPayload?.progressionState || {},
        theoryCandidates: promptContext?.theoryCandidates || [],
        preferredTargets: promptContext?.preferredTargets || [],
        behaviorParams: normalizedBehavior.normalized,
        currentBassNote: promptContext?.currentBassNote || "",
        currentTopNote: promptContext?.currentTopNote || ""
      }
    );

    appState.suggestionAiAttempted = true;
    appState.suggestionAiResults = filtered.items;
    appState.suggestionAiMessage = filtered.items.length
      ? ""
      : "AI did not return any valid chord suggestions this time.";
    appState.suggestionAiWarning = filtered.droppedCount
      ? `Some AI suggestions were skipped because they were invalid or duplicates (${filtered.droppedCount}).`
      : "";

    setSuggestionAiDebug("request-ai-suggestions", response?.debug, {
      promptRequest,
      promptSummary: promptRequest.debugMeta?.summaryLines || [],
      normalizedParameters: normalizedBehavior,
      rawResponse: response.text || null,
      parsedSuggestions: filtered.items.map(item => ({
        chord: item.chord,
        bass: item.bass,
        topNote: item.topNote,
        resolutionType: item.resolutionType,
        confidence: item.confidence,
        role: item.role,
        reason: item.reason,
        aiScore: item.aiScore,
        aiMetrics: item.aiMetrics
      })),
      droppedSuggestions: filtered.dropped,
      hint: `This AI suggestion request used the OpenAI-compatible Responses API with the ${normalizedBehavior.resolved.profile} profile.`
    });

    setSuggestionAiStatus(
      "success",
      filtered.items.length
        ? `Loaded ${filtered.items.length} AI suggestion${filtered.items.length === 1 ? "" : "s"}.`
        : "AI responded, but no valid chord suggestions could be used."
    );
  } catch (error) {
    appState.suggestionAiAttempted = true;
    appState.suggestionAiResults = [];
    appState.suggestionAiWarning = "";
    appState.suggestionAiMessage = "AI suggestions could not be loaded.";
    setSuggestionAiStatus(
      "error",
      error instanceof Error ? error.message : "AI suggestions could not be loaded."
    );
    setSuggestionAiDebug("request-ai-suggestions", error?.debug, {
      promptRequest,
      promptSummary: promptRequest.debugMeta?.summaryLines || [],
      normalizedParameters: normalizedBehavior,
      error: error instanceof Error ? error.message : "AI suggestions could not be loaded.",
      hint: "Check the provider address, selected model, and AI response format."
    });
  } finally {
    appState.suggestionAiRequesting = false;
    renderSuggestionEngineControls();
    renderSuggestionResults(
      contextToken === getSuggestionAiContextToken()
        ? suggestionPayload
        : buildCurrentSuggestionPayload()
    );
  }
}

async function handleAiExploreConnect() {
  const { providerLabel, selectedModel } = getSavedAiProviderConfig();
  if (!selectedModel) {
    setAiExploreStatus("error", "No model is saved in Settings yet.");
    renderAiExploreUI();
    return;
  }

  appState.aiExploreConnecting = true;
  setAiExploreStatus("loading", `Loading ${selectedModel} in ${providerLabel}...`);
  renderAiExploreUI();

  try {
    const result = await connectAiModel(appState.appSettings);
    setAiExploreDebug("connect-model", result?.debug, {
      hint: "This asks the active AI backend to load the selected model."
    });
    setAiExploreStatus("success", "Model loaded. Checking connection state...");
  } catch (error) {
    appState.aiExploreConnecting = false;
    setAiExploreDebug("connect-model", error?.debug, {
      error: error instanceof Error ? error.message : `Could not load the selected model in ${providerLabel}.`,
      hint: "If loading fails, verify that the model exists and the backend is ready."
    });
    setAiExploreStatus(
      "error",
      error instanceof Error ? error.message : `Could not load the selected model in ${providerLabel}.`
    );
    renderAiExploreUI();
    return;
  }

  appState.aiExploreConnecting = false;
  await refreshAiExploreModelStatus({ silent: true });
}

async function handleAiExploreSubmit() {
  const { providerLabel, selectedModel } = getSavedAiProviderConfig();
  const prompt = String(appState.aiExplorePrompt || "").trim();
  const reasoningEffort = String(appState.aiExploreReasoningEffort || "medium").trim().toLowerCase() || "medium";

  if (!selectedModel) {
    setAiExploreStatus("error", "No model is saved in Settings yet.");
    renderAiExploreUI();
    return;
  }

  if (!prompt) {
    setAiExploreStatus("error", "Type a prompt before you submit.");
    renderAiExploreUI();
    return;
  }

  const conversationHistory = buildAiExploreConversationHistory();

  // Push user message to conversation
  appState.aiExploreConversation.push({
    role: "user",
    content: prompt,
    timestamp: new Date().toISOString()
  });

  // Clear the prompt input after saving the user message
  appState.aiExplorePrompt = "";
  if (aiExplorePromptInput) {
    aiExplorePromptInput.value = "";
  }

  appState.aiExploreSubmitting = true;
  appState.aiExploreResponse = `Waiting for ${providerLabel}...`;
  setAiExploreStatus("loading", `Sending prompt to ${providerLabel} with ${reasoningEffort} reasoning effort...`);
  renderAiExploreUI();

  try {
    await ensureActiveAiModelLoaded((type, message) => {
      setAiExploreStatus(type, message);
      renderAiExploreUI();
    });

    const instructions = buildAiExplorePromptInstructions();
    const promptRequest = buildAiExplorePromptRequest({
      userPrompt: prompt,
      reasoningEffort,
      instructions,
      conversationHistory
    });
    const response = await sendAiPrompt(appState.appSettings, promptRequest);
    const responseText = response.text || `${providerLabel} returned a response, but it did not include a message.`;

    // Parse suggestions from response
    const parsedSuggestions = parseAiExploreSuggestions(responseText);

    // Push assistant message to conversation
    appState.aiExploreConversation.push({
      role: "assistant",
      content: responseText,
      suggestions: parsedSuggestions || null,
      timestamp: new Date().toISOString()
    });

    appState.aiExploreResponse = responseText;
    setAiExploreDebug("send-prompt", response?.debug, {
      hint: `This is the OpenAI-compatible Responses API request used for AI Explore with reasoning effort set to ${reasoningEffort}.`
    });
    setAiExploreStatus("success", "Prompt completed successfully.");
  } catch (error) {
    appState.aiExploreResponse = "No response yet.";
    setAiExploreDebug("send-prompt", error?.debug, {
      error: error instanceof Error ? error.message : `Could not get a response from ${providerLabel}.`,
      hint: "If the request fails, check the backend logs and confirm the model is loaded."
    });
    setAiExploreStatus(
      "error",
      error instanceof Error ? error.message : `Could not get a response from ${providerLabel}.`
    );
  } finally {
    appState.aiExploreSubmitting = false;
    renderAiExploreUI();
  }
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
renderAppSettingsModal();

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
    if (panelId === "aiExplorePanel") {
      void refreshAiExploreModelStatus();
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
  if (panelId === "aiExplorePanel") {
    void refreshAiExploreModelStatus();
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
  renderAiExploreUI();

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

  if (exportMidiBtn) {
    const hasProgressionItems = appState.progressionItems.length > 0;
    setIconButtonState(exportMidiBtn, {
      label: "Export MIDI",
      icon: "export-midi",
      disabled: !hasProgressionItems
    });
    exportMidiBtn.dataset.tooltip = hasProgressionItems
      ? "Export the progression as a MIDI file"
      : "Add at least one chord before exporting MIDI";
  }

  if (undoProgressionBtn) {
    const canUndoProgression = progressionUndoHistory.length > 0;
    setIconButtonState(undoProgressionBtn, {
      label: "Undo",
      icon: "undo",
      disabled: !canUndoProgression
    });
    undoProgressionBtn.dataset.tooltip = canUndoProgression
      ? "Undo the last chord sequence change"
      : "Make a chord sequence change to undo";
  }

  if (redoProgressionBtn) {
    const canRedoProgression = progressionRedoHistory.length > 0;
    setIconButtonState(redoProgressionBtn, {
      label: "Redo",
      icon: "redo",
      disabled: !canRedoProgression
    });
    redoProgressionBtn.dataset.tooltip = canRedoProgression
      ? "Redo the last undone chord sequence change"
      : "Undo a chord sequence change to redo it";
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
    syncText = true,
    recordUndo = false
  } = options;

  const nextItems = Array.isArray(items) ? items : [];
  if (recordUndo && !progressionItemsMatch(nextItems, appState.progressionItems)) {
    pushProgressionUndoSnapshot();
    progressionRedoHistory = [];
  }
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
    preserveSelection: options.preserveSelection || false,
    recordUndo: options.recordUndo || false
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

  setProgressionItems(nextItems, { selectedId, recordUndo: true });

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
    preserveSelection: true,
    recordUndo: true
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
    preserveSelection: true,
    recordUndo: true
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
    preserveSelection: true,
    recordUndo: true
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
    preserveSelection: true,
    recordUndo: true
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
    preserveSelection: true,
    recordUndo: true
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
    preserveSelection: true,
    recordUndo: true
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

  setProgressionItems(nextItems, { selectedId: duplicateItem.id, recordUndo: true });

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
  setProgressionItems(nextItems, { selectedId: insertedItem.id, recordUndo: true });
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
  setProgressionItems(nextItems, { selectedId: splitItem.id, recordUndo: true });

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
  setProgressionItems(nextItems, { selectedId: fallbackSelection, recordUndo: true });

  if ((autoSuggestToggle?.checked || activeToolPanelId === "suggestionEnginePanel") && appData) {
    runSuggestions();
  }
}

function getProgressionChordList() {
  return progressionItemsToChords(appState.progressionItems);
}

function buildProgressionDownloadBasename() {
  const keySlug = String(appState.selectedKey || "progression")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9#-]/g, "")
    .toLowerCase();

  return `${keySlug || "progression"}-progression`;
}

function downloadFile(fileContents, contentType, filename) {
  const blob = new Blob([fileContents], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
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

function notifyMidiExportNeedsChords() {
  window.alert("Add at least one chord before exporting MIDI.");
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

  downloadFile(
    JSON.stringify(payload, null, 2),
    "application/json",
    `${buildProgressionDownloadBasename()}.json`
  );
}

function handleExportMidi() {
  if (!appState.progressionItems.length) {
    notifyMidiExportNeedsChords();
    return;
  }

  const fileBytes = buildMidiFileBytes({
    items: appState.progressionItems,
    ...getCurrentSequenceSettings()
  });

  downloadFile(
    fileBytes,
    "audio/midi",
    `${buildProgressionDownloadBasename()}.mid`
  );
}

function handleNewProgression() {
  closeNewProgressionConfirm();

  if (appState.progressionItems.length) {
    pushProgressionUndoSnapshot();
    progressionRedoHistory = [];
  }

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

function resolveSavedProgressionKey(data) {
  const musicData = appData?.musicData;
  if (!musicData || !data || typeof data !== "object") {
    return null;
  }

  const savedName = String(data.key?.name || "").trim();
  if (savedName && musicData[savedName]) {
    return savedName;
  }

  const savedRoot = normaliseRoot(
    String(data.key?.root || savedName.split(" ")[0] || "").trim()
  );
  const savedMode = String(
    data.key?.mode || savedName.split(" ").slice(1).join(" ")
  ).trim().toLowerCase();

  if (!savedRoot || !savedMode) {
    return null;
  }

  const savedPc = NOTE_TO_PC[savedRoot];
  if (savedPc == null) {
    return null;
  }

  return Object.keys(musicData).find(keyName => {
    const keyData = musicData[keyName];
    const keyRoot = normaliseRoot(keyData?.root);
    return NOTE_TO_PC[keyRoot] === savedPc && String(keyData?.mode || "").trim().toLowerCase() === savedMode;
  }) || null;
}

function applyLoadedProgressionData(data) {
  const resolvedSavedKey = resolveSavedProgressionKey(data);
  const importKeyData =
    (resolvedSavedKey ? appData?.musicData?.[resolvedSavedKey] : null) ||
    getCurrentKeyData();
  const {
    items,
    invalid,
    sequenceSettings
  } = importProgressionFromSavedData(data, importKeyData, appState.progressionItems);

  if (!items.length) {
    throw new Error("No chords found");
  }

  const keyChanged = Boolean(resolvedSavedKey && resolvedSavedKey !== appState.selectedKey);
  if (resolvedSavedKey) {
    appState.selectedKey = resolvedSavedKey;
    updateKeyChordSet();

    if (keyChanged) {
      const rootNote = resolvedSavedKey.split(" ")[0] || "C";
      appState.selectedChordRoot = rootNote;
      appState.selectedBassRoot = rootNote;
    }
  }

  appState.sequenceTempoBpm = normalizeTempoBpm(sequenceSettings?.tempoBpm);
  appState.sequenceTimeSignature = normalizeTimeSignature(sequenceSettings?.timeSignature);
  appState.progressionInvalidTokens = invalid;
  setProgressionItems(items, { selectedId: null, recordUndo: true });

  if (keyChanged) {
    refreshChordPlaygroundUI();
    refreshKeyUI();
  }

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
  const manifestUrl = new URL(MUSIC_DEMOS_MANIFEST_PATH, window.location.href);
  manifestUrl.searchParams.set("ts", String(Date.now()));

  try {
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      const demos = normalizeMusicDemoEntries(payload?.demos);
      if (demos.length) {
        return demos;
      }
    }
  } catch (error) {
    console.warn("Could not load demo manifest:", error);
  }

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
      fileName: "Demo01-cIonian.json",
      label: "Demo01-cIonian",
      path: `${MUSIC_DEMOS_DIR_PATH}${encodeURIComponent("Demo01-cIonian.json")}`
    },
    {
      fileName: "Demo02-dDorian.json",
      label: "Demo02-dDorian",
      path: `${MUSIC_DEMOS_DIR_PATH}${encodeURIComponent("Demo02-dDorian.json")}`
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

function cloneProgressionItems(items = []) {
  if (typeof structuredClone === "function") {
    return structuredClone(Array.isArray(items) ? items : []);
  }

  return JSON.parse(JSON.stringify(Array.isArray(items) ? items : []));
}

function buildProgressionUndoSnapshot() {
  return {
    items: cloneProgressionItems(appState.progressionItems),
    selectedId: appState.selectedProgressionItemId
  };
}

function progressionItemsMatch(leftItems = [], rightItems = []) {
  return JSON.stringify(Array.isArray(leftItems) ? leftItems : []) === JSON.stringify(Array.isArray(rightItems) ? rightItems : []);
}

function pushProgressionUndoSnapshot(snapshot = buildProgressionUndoSnapshot()) {
  progressionUndoHistory = [...progressionUndoHistory, snapshot].slice(-MAX_PROGRESSION_UNDO_STEPS);
}

function pushProgressionRedoSnapshot(snapshot = buildProgressionUndoSnapshot()) {
  progressionRedoHistory = [...progressionRedoHistory, snapshot].slice(-MAX_PROGRESSION_UNDO_STEPS);
}

function restoreProgressionUndoSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }

  closeNewProgressionConfirm();

  if (appState.isPlayingProgression) {
    stopActiveProgressionPlayback();
  }

  appState.progressionInvalidTokens = [];
  appState.insertChoiceOpen = false;
  appState.editingProgressionItemId = null;
  appState.editingProgressionAnchorRect = null;
  clearSequenceKeyboardState();
  setProgressionItems(cloneProgressionItems(snapshot.items), {
    selectedId: snapshot.selectedId || null
  });

  if ((autoSuggestToggle?.checked || activeToolPanelId === "suggestionEnginePanel") && appData) {
    runSuggestions();
  }
}

function handleUndoProgression() {
  const snapshot = progressionUndoHistory.pop();
  if (!snapshot) {
    renderProgressionBuilderUI();
    return;
  }

  pushProgressionRedoSnapshot();
  restoreProgressionUndoSnapshot(snapshot);
}

function handleRedoProgression() {
  const snapshot = progressionRedoHistory.pop();
  if (!snapshot) {
    renderProgressionBuilderUI();
    return;
  }

  pushProgressionUndoSnapshot();
  restoreProgressionUndoSnapshot(snapshot);
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

function renderSuggestionDebugVisibility() {
  if (suggestionDebugPanel) {
    suggestionDebugPanel.hidden = !appState.suggestionDebugVisible;
  }

  if (suggestionTheoryDebugPanel) {
    suggestionTheoryDebugPanel.hidden = !appState.suggestionDebugVisible;
  }

  if (suggestionAiDebugPanel) {
    suggestionAiDebugPanel.hidden = !appState.suggestionDebugVisible;
  }

  if (toggleSuggestionDebugBtn) {
    const label = appState.suggestionDebugVisible ? "Hide Suggestion Debug" : "Show Suggestion Debug";
    toggleSuggestionDebugBtn.setAttribute("aria-pressed", String(appState.suggestionDebugVisible));
    toggleSuggestionDebugBtn.setAttribute("aria-label", label);
    toggleSuggestionDebugBtn.dataset.tooltip = appState.suggestionDebugVisible
      ? "Hide the suggestion debug panel"
      : "Show the suggestion debug panel";
  }
}

function setSuggestionTheoryDebugCopyButtonState(copied = false) {
  if (!copySuggestionTheoryDebugBtn) {
    return;
  }

  copySuggestionTheoryDebugBtn.classList.toggle("suggestion-debug-copy-btn-copied", copied);
  copySuggestionTheoryDebugBtn.dataset.tooltip = copied ? "Copied Suggestion Debug" : "Copy Suggestion Debug";
  copySuggestionTheoryDebugBtn.setAttribute("aria-label", copied ? "Copied Suggestion Debug" : "Copy Suggestion Debug");
}

function setSuggestionAiDebugCopyButtonState(copied = false) {
  if (!copySuggestionAiDebugBtn) {
    return;
  }

  copySuggestionAiDebugBtn.classList.toggle("suggestion-debug-copy-btn-copied", copied);
  copySuggestionAiDebugBtn.dataset.tooltip = copied ? "Copied AI Suggestion Debug" : "Copy AI Suggestion Debug";
  copySuggestionAiDebugBtn.setAttribute("aria-label", copied ? "Copied AI Suggestion Debug" : "Copy AI Suggestion Debug");
}

async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value) {
    return false;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "readonly");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  textArea.setSelectionRange(0, textArea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    document.body.removeChild(textArea);
  }

  return copied;
}

async function handleCopySuggestionDebug() {
  if (!suggestionDebugOutput) {
    return;
  }

  const text = String(suggestionDebugOutput.textContent || "").trim();
  if (!text || text === "No suggestion debug yet.") {
    return;
  }

  try {
    const copied = await copyTextToClipboard(text);
    if (!copied) {
      return;
    }

    if (suggestionDebugCopyResetTimer) {
      clearTimeout(suggestionDebugCopyResetTimer);
    }

    setSuggestionTheoryDebugCopyButtonState(true);
    suggestionDebugCopyResetTimer = window.setTimeout(() => {
      setSuggestionTheoryDebugCopyButtonState(false);
      suggestionDebugCopyResetTimer = null;
    }, 1600);
  } catch (error) {
    console.error("✗ Could not copy suggestion debug:", error);
  }
}

async function handleCopySuggestionAiDebug() {
  if (!suggestionAiDebugOutput) {
    return;
  }

  const text = String(suggestionAiDebugOutput.textContent || "").trim();
  if (!text || text === "No AI suggestion debug yet.") {
    return;
  }

  try {
    const copied = await copyTextToClipboard(text);
    if (!copied) {
      return;
    }

    setSuggestionAiDebugCopyButtonState(true);
    window.setTimeout(() => {
      setSuggestionAiDebugCopyButtonState(false);
    }, 1600);
  } catch (error) {
    console.error("Could not copy AI suggestion debug:", error);
  }
}

function midiToDebugNoteLabel(midi) {
  const numericMidi = Number(midi);
  if (!Number.isFinite(numericMidi)) {
    return "";
  }

  const pitchClass = ((numericMidi % 12) + 12) % 12;
  const octave = Math.floor(numericMidi / 12) - 1;
  const noteName = pitchClassToDisplayNote(pitchClass);
  return noteName ? `${noteName}${octave}` : "";
}

function formatProgressionWithTopNotes(items) {
  const progressionItems = Array.isArray(items) ? items : [];
  if (!progressionItems.length) {
    return "";
  }

  const segments = progressionItems.map(item => {
    const chord = String(item?.chord || "").trim();
    if (!chord) {
      return "";
    }

    const notes = Array.isArray(item?.voicing?.notes)
      ? item.voicing.notes
          .map(note => Number(note?.midi))
          .filter(Number.isFinite)
          .sort((a, b) => a - b)
      : [];
    const topNote = notes.length ? midiToDebugNoteLabel(notes.at(-1)) : "";
    return topNote ? `${chord}[${topNote}]` : chord;
  }).filter(Boolean);

  return segments.some(segment => /\[[^\]]+\]$/.test(segment))
    ? segments.join(" | ")
    : "";
}

function formatRecentProgressionWindow(items, windowSize = 8) {
  const progressionItems = Array.isArray(items) ? items : [];
  if (!progressionItems.length) {
    return "";
  }

  const startIndex = Math.max(0, progressionItems.length - Math.max(6, Math.min(8, Number(windowSize) || 8)));
  return progressionItems.slice(startIndex).map(item => {
    const chord = String(item?.chord || "").trim();
    if (!chord) {
      return "";
    }

    const notes = Array.isArray(item?.voicing?.notes)
      ? item.voicing.notes
          .map(note => Number(note?.midi))
          .filter(Number.isFinite)
          .sort((a, b) => a - b)
      : [];

    const topNote = notes.length ? midiToDebugNoteLabel(notes.at(-1)) : "";
    const bassNote = notes.length ? midiToDebugNoteLabel(notes.at(0)) : "";
    const chordLabel = bassNote || topNote ? `${chord}[${bassNote || "?"} -> ${topNote || "?"}]` : chord;
    return chordLabel;
  }).filter(Boolean).join(" | ");
}

function getRecentVoicingLabels(items, windowSize = 8) {
  const progressionItems = Array.isArray(items) ? items : [];
  if (!progressionItems.length) {
    return [];
  }

  const startIndex = Math.max(0, progressionItems.length - Math.max(6, Math.min(8, Number(windowSize) || 8)));
  return progressionItems.slice(startIndex).map(item => {
    const chord = String(item?.chord || "").trim();
    if (!chord) {
      return null;
    }

    const parsed = parseChordName(chord);
    const notes = Array.isArray(item?.voicing?.notes)
      ? item.voicing.notes
          .map(note => Number(note?.midi))
          .filter(Number.isFinite)
          .sort((a, b) => a - b)
      : [];

    const bassNote = notes.length ? midiToDebugNoteLabel(notes[0]) : (parsed?.bass || parsed?.root || "");
    const topNote = notes.length ? midiToDebugNoteLabel(notes.at(-1)) : "";

    return {
      chord,
      bassMidi: notes.length ? notes[0] : null,
      topMidi: notes.length ? notes.at(-1) : null,
      bassNote: String(bassNote || "").trim(),
      topNote: String(topNote || "").trim()
    };
  }).filter(Boolean);
}

function formatVoiceMotion(labels = [], key = "bassNote") {
  const values = Array.isArray(labels)
    ? labels.map(item => String(item?.[key] || "").trim()).filter(Boolean)
    : [];
  if (!values.length) {
    return "";
  }

  return values.join(" -> ");
}

function detectPedalBass(labels = []) {
  const basses = Array.isArray(labels)
    ? labels.map(item => String(item?.bassNote || "").trim()).filter(Boolean)
    : [];
  if (basses.length < 2) {
    return "";
  }

  const lastBass = basses.at(-1);
  const repeatedCount = basses.filter(value => value === lastBass).length;
  if (repeatedCount >= Math.min(3, basses.length)) {
    return `${lastBass} pedal`;
  }

  return "";
}

function buildTopLinePreference(labels = []) {
  const entries = Array.isArray(labels) ? labels : [];
  const current = entries.at(-1);
  const previous = entries.at(-2);
  if (!current?.topNote) {
    return "";
  }

  if (!Number.isFinite(current?.topMidi) || !Number.isFinite(previous?.topMidi)) {
    return `Current top note is ${current.topNote}.`;
  }

  const delta = current.topMidi - previous.topMidi;
  if (delta === 0) {
    return `Current top note is ${current.topNote}; holding it or moving by step is preferred.`;
  }

  if (Math.abs(delta) <= 2) {
    const direction = delta < 0 ? "downward" : "upward";
    return `Current top note is ${current.topNote}; continue ${direction} by hold or step before any large leap.`;
  }

  return `Current top note is ${current.topNote}; stabilise it with a hold or stepwise recovery.`;
}

function buildPedalBassHint(analysis = {}, currentBassNote = "", theorySuggestions = []) {
  if (!currentBassNote) {
    return "";
  }

  const bassPitch = String(currentBassNote).replace(/\d+$/, "");
  const theoryChords = Array.isArray(theorySuggestions)
    ? theorySuggestions.map(item => String(item?.chord || "").trim()).filter(Boolean)
    : [];
  const establishedChords = Array.isArray(analysis.establishedInKeyChords)
    ? analysis.establishedInKeyChords.map(entry => String(entry?.chord || "").trim()).filter(Boolean)
    : [];
  const palette = [...new Set([...theoryChords, ...establishedChords])];

  const slashIdeas = palette
    .map(chord => {
      const parsed = parseChordName(chord);
      if (!parsed) {
        return "";
      }

      if ((parsed.bass || parsed.root) === bassPitch || parsed.root === bassPitch) {
        return chord;
      }

      return `${parsed.root}${parsed.suffix}/${bassPitch}`;
    })
    .filter(Boolean)
    .slice(0, 6);

  return slashIdeas.length
    ? `Pedal-bass friendly ideas over ${bassPitch}: ${slashIdeas.join(", ")}`
    : "";
}

function renderSuggestionDebug(suggestionPayload) {
  if (!suggestionDebugOutput) {
    return;
  }

  const analysis = suggestionPayload?.progressionState;
  const suggestions = Array.isArray(suggestionPayload?.suggestions) ? suggestionPayload.suggestions : [];
  if (!analysis) {
    suggestionDebugOutput.textContent = "No suggestion debug yet.";
    if (copySuggestionTheoryDebugBtn) {
      copySuggestionTheoryDebugBtn.disabled = true;
      setSuggestionTheoryDebugCopyButtonState(false);
    }
    return;
  }

  const formatSuggestionBucketLine = (bucketId, label) => {
    const bucketSuggestions = suggestions.filter(item => (item?.bucket || "inKey") === bucketId);
    if (!bucketSuggestions.length) {
      return `${label}: (none)`;
    }

    return `${label}: ${bucketSuggestions
      .map(item => `${item.chord} [${item.fn}] (${item.score})`)
      .join(", ")}`;
  };

  const formatTopNoteLine = entries => {
    const matches = (Array.isArray(entries) ? entries : [])
      .filter(item => Number(item?.topNoteBonus) > 0)
      .sort((a, b) => (b?.topNoteBonus || 0) - (a?.topNoteBonus || 0) || (b?.score || 0) - (a?.score || 0));
    if (!matches.length) {
      return "(none)";
    }

    return matches
      .map(item => `${item.chord} [+${item.topNoteBonus} ${item.topNoteRelation}${item.topNoteMotionAssist ? ", motion assist" : ""}]`)
      .join(", ");
  };

  const overallRanking = [...suggestions]
    .sort((a, b) => (b?.score || 0) - (a?.score || 0))
    .map(item => `${item.chord} [${item.fn}] (${item.score})`);
  const topLineSummary = analysis.topNoteLabel
    ? analysis.previousTopNoteLabel
      ? `${analysis.previousTopNoteLabel} -> ${analysis.topNoteLabel} (${analysis.topNoteMotionLabel || "none"})`
      : analysis.topNoteLabel
    : "";
  const lastChordSummary = analysis.lastChord
    ? `${analysis.lastChord}${analysis.lastFunction ? ` [${analysis.lastFunction}]` : ""}`
    : "(none)";
  const harmonicRead = `${analysis.harmonicLanguage || "(unknown)"} (mode confidence: ${analysis.modeConfidence || "(unknown)"})`;
  const cadenceRead = analysis.latestCadence && analysis.latestCadence !== "none"
    ? `${analysis.latestCadence}${analysis.strongestCadence && analysis.strongestCadence !== analysis.latestCadence ? ` | strongest: ${analysis.strongestCadence}` : ""}`
    : (analysis.strongestCadence && analysis.strongestCadence !== "none" ? analysis.strongestCadence : "none");
  const paletteSummary = [
    analysis.establishedInKeyChords?.length
      ? `in-key ${analysis.establishedInKeyChords.map(entry => entry.chord).join(", ")}`
      : "",
    analysis.establishedBorrowedChords?.length
      ? `borrowed ${analysis.establishedBorrowedChords.map(entry => entry.chord).join(", ")}`
      : ""
  ].filter(Boolean).join(" | ") || "(none)";
  const progressionWithTopNotes = formatProgressionWithTopNotes(appState.progressionItems);

    const centreRead = analysis.localCenterActive
      ? `Centre read: global ${analysis.globalCenter || "(none)"} | local pull ${analysis.localCenterExactChord || analysis.localCenterChord || "(none)"} (${analysis.localCenterConfidence || "unknown"}${analysis.localCenterSource ? `, ${analysis.localCenterSource}` : ""})`
      : `Centre read: global ${analysis.globalCenter || "(none)"}`;

    const lines = [
      `Progression: ${analysis.progressionText || "(empty)"}`,
      progressionWithTopNotes ? `Progression + top notes: ${progressionWithTopNotes}` : "",
      `Key and mode: ${appState.selectedKey || "(none)"} | Feeling: ${feelingSelect?.value || "(none)"}`,
      centreRead,
      `Last chord: ${lastChordSummary}`,
      `Harmonic read: ${harmonicRead}`,
    `Direction: ${analysis.stability} -> ${analysis.cadenceExpectation} | Phrase: ${analysis.phrasePosition || "(unknown)"}`,
    `Cadence read: ${cadenceRead}`,
    analysis.repeatedEnding ? "Pattern cue: repeated ending" : "",
    analysis.slashBass ? `Slash bass: ${analysis.slashBass}${analysis.slashBassTarget ? ` -> ${analysis.slashBassTarget}` : ""}` : "",
    topLineSummary ? `Top line: ${topLineSummary}` : "",
    `Established palette: ${paletteSummary}`,
    `Tension candidates: ${analysis.tensionCandidates?.length ? analysis.tensionCandidates.map(entry => entry.chord).join(", ") : "(none)"}`,
    `Preferred targets: ${analysis.preferredTargets.length ? analysis.preferredTargets.join(", ") : "(none)"}`,
    `Why: ${analysis.summaryNotes.length ? analysis.summaryNotes.join(" | ") : "(none)"}`,
    `Top-note influence: ${formatTopNoteLine(suggestions)}`,
    `Suggestion set: ${suggestions.length} shown`,
    `Overall ranking: ${overallRanking.length ? overallRanking.join(", ") : "(none)"}`,
    "Shown suggestions:",
    formatSuggestionBucketLine("inKey", "In Key"),
    formatSuggestionBucketLine("related", "Related"),
    formatSuggestionBucketLine("outside", "Out of Key")
  ].filter(Boolean);

  suggestionDebugOutput.textContent = lines.join("\n");
  if (copySuggestionTheoryDebugBtn) {
    copySuggestionTheoryDebugBtn.disabled = false;
    setSuggestionTheoryDebugCopyButtonState(false);
  }
}

function buildCurrentSuggestionPayload() {
  return getSuggestions({
    musicData: appData.musicData,
    moodBoosts: appData.moodBoosts,
    functionDescriptions: appData.functionDescriptions,
    moodReasonText: appData.moodReasonText,
    selectedKey: appState.selectedKey,
    progression: progressionItemsToText(appState.progressionItems),
    feeling: feelingSelect.value,
    progressionItems: appState.progressionItems
  });
}

function buildSuggestionAiPromptContext(suggestionPayload, behaviorParams = {}) {
  const analysis = suggestionPayload?.progressionState || {};
  const suggestions = Array.isArray(suggestionPayload?.suggestions) ? suggestionPayload.suggestions : [];
  const recentWindowSize = Number(behaviorParams?.recentWindowSize) || 8;
  const recentProgressionWindow = formatRecentProgressionWindow(appState.progressionItems, recentWindowSize);
  const recentVoicingLabels = getRecentVoicingLabels(appState.progressionItems, recentWindowSize);
  const recentBassMotion = formatVoiceMotion(recentVoicingLabels, "bassNote");
  const recentTopLineMotion = formatVoiceMotion(recentVoicingLabels, "topNote");
  const pedalBassCue = detectPedalBass(recentVoicingLabels);
  const currentChord = String(appState.progressionItems.at(-1)?.chord || analysis.lastChord || "").trim();
  const currentBassNote = String(recentVoicingLabels.at(-1)?.bassNote || "").trim();
  const currentTopNote = String(recentVoicingLabels.at(-1)?.topNote || "").trim();
  const topLinePreference = buildTopLinePreference(recentVoicingLabels);
  const pedalBassHint = buildPedalBassHint(analysis, currentBassNote, suggestions);
  const lastChordSummary = analysis.lastChord
    ? `${analysis.lastChord}${analysis.lastFunction ? ` [${analysis.lastFunction}]` : ""}`
    : "(none)";
  const harmonicRead = `${analysis.harmonicLanguage || "(unknown)"} (mode confidence: ${analysis.modeConfidence || "(unknown)"})`;
  const cadenceRead = analysis.latestCadence && analysis.latestCadence !== "none"
    ? `${analysis.latestCadence}${analysis.strongestCadence && analysis.strongestCadence !== analysis.latestCadence ? ` | strongest: ${analysis.strongestCadence}` : ""}`
    : (analysis.strongestCadence && analysis.strongestCadence !== "none" ? analysis.strongestCadence : "none");
  const paletteSummary = [
    analysis.establishedInKeyChords?.length
      ? `in-key ${analysis.establishedInKeyChords.map(entry => entry.chord).join(", ")}`
      : "",
    analysis.establishedBorrowedChords?.length
      ? `borrowed ${analysis.establishedBorrowedChords.map(entry => entry.chord).join(", ")}`
      : ""
  ].filter(Boolean).join(" | ") || "(none)";
  const topLineSummary = analysis.topNoteLabel
    ? analysis.previousTopNoteLabel
      ? `${analysis.previousTopNoteLabel} -> ${analysis.topNoteLabel} (${analysis.topNoteMotionLabel || "none"})`
      : analysis.topNoteLabel
    : "";
  const centreRead = analysis.localCenterActive
    ? `global ${analysis.globalCenter || "(none)"} | local pull ${analysis.localCenterExactChord || analysis.localCenterChord || "(none)"} (${analysis.localCenterConfidence || "unknown"}${analysis.localCenterSource ? `, ${analysis.localCenterSource}` : ""})`
    : `global ${analysis.globalCenter || "(none)"}`;

  return {
    progressionText: recentProgressionWindow || analysis.progressionText || "(empty)",
    recentProgressionWindow,
    recentProgressionWindowWithNotes: recentVoicingLabels.length
      ? recentVoicingLabels.map(entry => `${entry.chord}[${entry.bassNote || "?"} -> ${entry.topNote || "?"}]`).join(" | ")
      : recentProgressionWindow || "(empty)",
    currentChord: currentChord || "(none)",
    recentBassMotion: recentBassMotion || "(none)",
    recentTopLineMotion: recentTopLineMotion || "(none)",
    pedalBassCue: pedalBassCue || "",
    currentBassNote: currentBassNote || "",
    currentTopNote: currentTopNote || "",
    topLinePreference: topLinePreference || "",
    pedalBassHint: pedalBassHint || "",
    selectedKey: appState.selectedKey || "(none)",
    feeling: feelingSelect?.value || "(none)",
    lastChord: lastChordSummary,
    harmonicRead,
    direction: `${analysis.stability || "(unknown)"} -> ${analysis.cadenceExpectation || "(unknown)"} | Phrase: ${analysis.phrasePosition || "(unknown)"}`,
    cadenceRead,
    centreRead,
    establishedPalette: paletteSummary,
    preferredTargets: Array.isArray(analysis.preferredTargets) ? analysis.preferredTargets : [],
    tensionCandidates: Array.isArray(analysis.tensionCandidates) ? analysis.tensionCandidates.map(entry => entry.chord) : [],
    topLineSummary,
    summaryNotes: Array.isArray(analysis.summaryNotes) ? analysis.summaryNotes : [],
    recentVoicingLabels,
    theoryCandidates: [...suggestions]
      .sort((a, b) => (b?.score || 0) - (a?.score || 0))
      .slice(0, 6)
      .map(item => `${item.chord}${item.fn ? ` [${item.fn}]` : ""}`)
  };
}

function buildSuggestionAiRenderState() {
  if (!appState.suggestionAiAttempted) {
    return null;
  }

  return {
    attempted: true,
    items: appState.suggestionAiResults,
    warning: appState.suggestionAiWarning,
    message: appState.suggestionAiMessage
  };
}

function renderSuggestionResults(suggestionPayload) {
  if (suggestionAiDebugOutput) {
    const nextDebugText = appState.suggestionAiDebugText || "No AI suggestion debug yet.";
    if (suggestionAiDebugOutput.textContent !== nextDebugText) {
      suggestionAiDebugOutput.textContent = nextDebugText;
    }
    if (copySuggestionAiDebugBtn) {
      copySuggestionAiDebugBtn.disabled = !nextDebugText || nextDebugText === "No AI suggestion debug yet.";
      setSuggestionAiDebugCopyButtonState(false);
    }
  }

  renderSuggestionDebug(suggestionPayload);
  renderSuggestionDebugVisibility();
  renderSuggestionAiStatus();
  renderSuggestionEngineControls();
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
    playItemSelection: async (item, inversionValue = "0", voicingValue = "close") => {
      try {
        setToolSelection("suggestionEngine", item?.chord || "", inversionValue, voicingValue);
        runSuggestions({ preserveAiState: true });
        const aiPlayback = buildAiSuggestedPlayback(item);
        if (aiPlayback?.notes?.length) {
          await ensureAudioReady();
          await playVoicingWithSequenceKeyboard(aiPlayback.notes, item.chord, 1.0, {
            inversionLabel: aiPlayback.inversionLabel,
            inversionShortLabel: aiPlayback.inversionShortLabel,
            voicingLabel: aiPlayback.voicingLabel,
            voicingShortLabel: aiPlayback.voicingShortLabel
          });
          return;
        }

        await playToolSelection("suggestionEngine", () => runSuggestions({ preserveAiState: true }), item?.chord || "", inversionValue, voicingValue);
      } catch (error) {
        console.error("? Could not play AI suggestion voicing:", error);
      }
    },
    playSelection: async (chord, inversionValue = "0", voicingValue = "close") => {
      try {
        await playToolSelection("suggestionEngine", () => runSuggestions({ preserveAiState: true }), chord, inversionValue, voicingValue);
      } catch (error) {
        console.error("✗ Could not play selected suggestion voicing:", error);
      }
    }
  });

  const onSuggestedChordAdd = (suggestionOrChord) => {
    const suggestionItem = typeof suggestionOrChord === "object" && suggestionOrChord !== null
      ? suggestionOrChord
      : null;
    const chordName = suggestionItem?.chord || String(suggestionOrChord || "").trim();
    appendChordToProgression(
      chordName,
      suggestionItem?.presentation?.isAi
        ? getAiSuggestionProgressionOverrides(suggestionItem)
        : getToolSelectionProgressionOverrides("suggestionEngine", chordName, "suggestion-engine")
    );
  };

  renderSuggestions(
    results,
    suggestionPayload,
    appData.musicData,
    appState.selectedKey,
    onSuggestedChordClick,
    onSuggestedChordAdd,
    {
      aiSuggestions: buildSuggestionAiRenderState()
    }
  );
}

function runSuggestions(options = {}) {
  const { preserveAiState = false } = options;
  if (!preserveAiState) {
    clearSuggestionAiState();
  }

  const suggestionPayload = buildCurrentSuggestionPayload();
  renderSuggestionResults(suggestionPayload);
  return suggestionPayload;
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
    applySettingsToAppState(appState, loadAppSettings());
    syncAppSettingsDraftFromSavedState();
    console.log("✓ Data loaded");

    populateFeelings(feelingSelect, appData.moodBoosts);
    renderSuggestionDebugVisibility();
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
    renderSuggestionEngineControls();
    renderSuggestionAiStatus();

    if (suggestBtn) suggestBtn.dataset.tooltip = "Refresh the current suggestions";
    if (suggestAiBtn) suggestAiBtn.dataset.tooltip = "Ask the connected AI model for next-chord suggestions";
    if (playProgressionBtn) playProgressionBtn.dataset.tooltip = "Play all chords in the progression";
    if (playFromSelectedBtn) playFromSelectedBtn.dataset.tooltip = "Play the progression from the selected chord";
    if (undoProgressionBtn) undoProgressionBtn.dataset.tooltip = "Make a chord sequence change to undo";
    if (redoProgressionBtn) redoProgressionBtn.dataset.tooltip = "Undo a chord sequence change to redo it";
    if (newProgressionBtn) newProgressionBtn.dataset.tooltip = "Add at least one chord before clearing the sequence";
    if (loadDemoProgressionBtn) loadDemoProgressionBtn.dataset.tooltip = "Open the Music Demos menu";
    if (saveProgressionBtn) saveProgressionBtn.dataset.tooltip = "Save the progression with tempo, time signature, and beat lengths";
    if (exportMidiBtn) exportMidiBtn.dataset.tooltip = "Export the progression as a MIDI file";
    if (loadProgressionBtn) loadProgressionBtn.dataset.tooltip = "Load a saved progression file";
    if (openSettingsBtn) openSettingsBtn.dataset.tooltip = "Open app settings saved in this browser";
    if (metronomeToggleBtn) metronomeToggleBtn.dataset.tooltip = "Open metronome settings";
    if (metronomeStartStopBtn) metronomeStartStopBtn.dataset.tooltip = "Arm or stop the metronome for playback";
    if (sequenceTempoBpmInput) sequenceTempoBpmInput.dataset.tooltip = "Set the playback tempo for the chord sequence";
    if (sequenceTimeSignatureSelect) sequenceTimeSignatureSelect.dataset.tooltip = "Set the default beats per bar for new chord blocks";
    if (aiProviderSettingSelect) aiProviderSettingSelect.dataset.tooltip = "Choose the active AI provider for this browser";
    if (aiBaseUrlSettingInput) aiBaseUrlSettingInput.dataset.tooltip = "HTTP address for the active provider";
    if (loadAiModelsBtn) loadAiModelsBtn.dataset.tooltip = "Fetch models from the active AI provider";
    if (aiModelSelectSetting) aiModelSelectSetting.dataset.tooltip = "Choose the AI model to save in app settings";
    if (aiExploreConnectBtn) aiExploreConnectBtn.dataset.tooltip = "Load the saved AI model if it is not already loaded";
    if (aiExploreReasoningEffortSelect) aiExploreReasoningEffortSelect.dataset.tooltip = "Choose the OpenAI-compatible reasoning effort for AI Explore prompts";
    if (aiExplorePromptInput) aiExplorePromptInput.dataset.tooltip = "Type a prompt for the connected AI model";
    if (aiExploreSubmitBtn) aiExploreSubmitBtn.dataset.tooltip = "Send the current prompt to the active AI provider";
    if (aiExploreResponseOutput) aiExploreResponseOutput.dataset.tooltip = "Scrollable model response area";
    if (toggleAiExploreDebugBtn) toggleAiExploreDebugBtn.dataset.tooltip = "Show the AI Explore debug panel";
    feelingSelect.dataset.tooltip = "Choose a mood to guide the suggestions";
    if (autoSuggestToggle) autoSuggestToggle.closest(".suggest-toggle").dataset.tooltip = "Automatically refresh suggestions when you add a chord";
    if (toggleSuggestionDebugBtn) toggleSuggestionDebugBtn.dataset.tooltip = "Show the suggestion debug panel";
    if (copySuggestionTheoryDebugBtn) copySuggestionTheoryDebugBtn.dataset.tooltip = "Copy Suggestion Debug";
    if (copySuggestionAiDebugBtn) copySuggestionAiDebugBtn.dataset.tooltip = "Copy AI Suggestion Debug";
    if (suggestionEngineStatusIcon) {
      suggestionEngineStatusIcon.textContent = "!";
      suggestionEngineStatusIcon.dataset.tooltip = "ALPHA STAGE WIP";
    }
    if (aiExploreStatusIcon) {
      aiExploreStatusIcon.textContent = "!";
      aiExploreStatusIcon.dataset.tooltip = "ALPHA STAGE WIP";
    }
    sectionHelpButtons.forEach(button => {
      button.dataset.tooltip = "How to use this section";
    });

    initTooltips();

    feelingSelect.addEventListener("change", refreshSuggestionsIfReady);
    progressionInput.addEventListener("input", () => {
      importProgressionTextToState(progressionInput.value, { preserveSelection: false, recordUndo: true });
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

    if (suggestAiBtn) {
      suggestAiBtn.addEventListener("click", () => {
        void handleSuggestionAiRequest();
      });
    }

    if (toggleAiSuggestionBehaviorBtn) {
      toggleAiSuggestionBehaviorBtn.addEventListener("click", () => {
        updateAiSuggestionBehavior({
          drawerOpen: !appState.aiSuggestionBehavior?.drawerOpen
        });
        renderSuggestionEngineControls();
      });
    }

    if (aiSuggestionProfileSelect) {
      aiSuggestionProfileSelect.addEventListener("change", () => {
        updateAiSuggestionBehavior({ profile: String(aiSuggestionProfileSelect.value || "precise").trim().toLowerCase() || "precise" });
        runSuggestions();
      });
    }

    if (aiSuggestionPhraseRoleSelect) {
      aiSuggestionPhraseRoleSelect.addEventListener("change", () => {
        updateAiSuggestionBehavior({ phraseRole: String(aiSuggestionPhraseRoleSelect.value || "flexible").trim().toLowerCase() || "flexible" });
        runSuggestions();
      });
    }

    if (aiSuggestionBassBehaviourSelect) {
      aiSuggestionBassBehaviourSelect.addEventListener("change", () => {
        updateAiSuggestionBehavior({ bassBehaviour: String(aiSuggestionBassBehaviourSelect.value || "flexible").trim().toLowerCase() || "flexible" });
        runSuggestions();
      });
    }

    if (aiSuggestionTopNoteBehaviourSelect) {
      aiSuggestionTopNoteBehaviourSelect.addEventListener("change", () => {
        updateAiSuggestionBehavior({ topNoteBehaviour: String(aiSuggestionTopNoteBehaviourSelect.value || "flexible").trim().toLowerCase() || "flexible" });
        runSuggestions();
      });
    }

    if (aiSuggestionColourSelect) {
      aiSuggestionColourSelect.addEventListener("change", () => {
        updateAiSuggestionBehavior({ colour: String(aiSuggestionColourSelect.value || "flexible").trim().toLowerCase() || "flexible" });
        runSuggestions();
      });
    }

    if (toggleSuggestionDebugBtn) {
      toggleSuggestionDebugBtn.addEventListener("click", () => {
        appState.suggestionDebugVisible = !appState.suggestionDebugVisible;
        renderSuggestionDebugVisibility();
      });
    }

    if (copySuggestionTheoryDebugBtn) {
      copySuggestionTheoryDebugBtn.addEventListener("click", () => {
        void handleCopySuggestionDebug();
      });
    }

    if (copySuggestionAiDebugBtn) {
      copySuggestionAiDebugBtn.addEventListener("click", () => {
        void handleCopySuggestionAiDebug();
      });
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

    if (undoProgressionBtn) {
      undoProgressionBtn.addEventListener("click", () => {
        handleUndoProgression();
      });
    }

    if (redoProgressionBtn) {
      redoProgressionBtn.addEventListener("click", () => {
        handleRedoProgression();
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

    if (openSettingsBtn) {
      openSettingsBtn.addEventListener("click", event => {
        event.stopPropagation();
        if (appState.appSettingsModalOpen) {
          closeAppSettingsModal();
          return;
        }

        openAppSettingsModal();
      });
    }

    if (appSettingsModalClose) {
      appSettingsModalClose.addEventListener("click", event => {
        event.stopPropagation();
        closeAppSettingsModal();
      });
    }

    if (cancelAppSettingsBtn) {
      cancelAppSettingsBtn.addEventListener("click", event => {
        event.stopPropagation();
        closeAppSettingsModal();
      });
    }

    if (saveAppSettingsBtn) {
      saveAppSettingsBtn.addEventListener("click", event => {
        event.stopPropagation();
        handleSaveAppSettings();
      });
    }

    if (aiProviderSettingSelect) {
      aiProviderSettingSelect.addEventListener("change", () => {
        setDraftAiProvider(aiProviderSettingSelect.value);
        appState.aiSettingsModels = [];
        setAiSettingsStatus("idle", "Load models to choose which AI model to save.");
        renderAppSettingsModal();
      });
    }

    if (aiBaseUrlSettingInput) {
      aiBaseUrlSettingInput.addEventListener("change", () => {
        setDraftLmStudioBaseUrl(aiBaseUrlSettingInput.value);
        appState.aiSettingsModels = [];
        setAiSettingsStatus("idle", "Load models to choose which AI model to save.");
        renderAppSettingsModal();
      });
    }

    if (loadAiModelsBtn) {
      loadAiModelsBtn.addEventListener("click", event => {
        event.stopPropagation();
        void handleLoadAiModels();
      });
    }

    if (aiModelSelectSetting) {
      aiModelSelectSetting.addEventListener("change", () => {
        setDraftActiveAiSelectedModel(aiModelSelectSetting.value);
      });
    }

    if (aiExplorePromptInput) {
      aiExplorePromptInput.addEventListener("input", () => {
        appState.aiExplorePrompt = aiExplorePromptInput.value;
        renderAiExploreUI();
      });
    }

    if (aiExploreReasoningEffortSelect) {
      aiExploreReasoningEffortSelect.addEventListener("change", () => {
        appState.aiExploreReasoningEffort = String(aiExploreReasoningEffortSelect.value || "medium").trim().toLowerCase() || "medium";
        renderAiExploreUI();
      });
    }

    if (aiExploreConnectBtn) {
      aiExploreConnectBtn.addEventListener("click", () => {
        void handleAiExploreConnect();
      });
    }

    if (aiExploreSubmitBtn) {
      aiExploreSubmitBtn.addEventListener("click", () => {
        void handleAiExploreSubmit();
      });
    }

    if (toggleAiExploreDebugBtn) {
      toggleAiExploreDebugBtn.addEventListener("click", () => {
        appState.aiExploreDebugVisible = !appState.aiExploreDebugVisible;
        renderAiExploreDebugVisibility();
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

    if (exportMidiBtn) {
      exportMidiBtn.addEventListener("click", handleExportMidi);
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

      if (appState.appSettingsModalOpen) {
        const clickedInsideSettingsDialog = Boolean(target?.closest?.(".app-settings-modal"));
        if (!clickedInsideSettingsDialog && !openSettingsBtn?.contains(target)) {
          closeAppSettingsModal();
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
        if (appState.appSettingsModalOpen) {
          closeAppSettingsModal();
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
