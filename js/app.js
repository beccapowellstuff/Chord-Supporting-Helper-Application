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
  initSoundFont,
  playMidiNote,
  playMidiNotes,
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
import { ensureAudioReady, playChord, playProgression } from "./playback.js";
import {
  appendProgressionItem,
  buildProgressionSavePayload,
  DEFAULT_TEMPO_BPM,
  DEFAULT_TIME_SIGNATURE,
  getBeatsPerBar,
  importProgressionFromSavedData,
  importProgressionFromText,
  normalizeTempoBpm,
  normalizeTimeSignature,
  progressionItemsToChords,
  progressionItemsToText,
  rebuildProgressionItems,
  renderProgressionBlocks,
  renderProgressionEditor
} from "./progressionBuilder.js";

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
const saveProgressionBtn = document.getElementById("saveProgressionBtn");
const loadProgressionBtn = document.getElementById("loadProgressionBtn");
const loadProgressionInput = document.getElementById("loadProgressionInput");
const progressionBlocks = document.getElementById("progressionBlocks");
const progressionEditor = document.getElementById("progressionEditor");
const sequenceTempoBpmInput = document.getElementById("sequenceTempoBpm");
const sequenceTimeSignatureSelect = document.getElementById("sequenceTimeSignature");
const results = document.getElementById("results");
const rootContainer = document.getElementById("rootContainer");
const keyInfo = document.getElementById("keyInfo");
const chordButtons = document.getElementById("chordButtons");
const bassRootSelector = document.getElementById("bassRootSelector");
const chordRootSelector = document.getElementById("chordRootSelector");
const sequenceKeyboard = document.getElementById("sequenceKeyboard");
const appVersion = document.getElementById("appVersion");
const toolNavButtons = document.querySelectorAll(".tool-nav-btn");
const toolPanels = document.querySelectorAll(".tool-panel");
const toolContextBlocks = document.querySelectorAll("[data-tool-context]");

let appData = null;
const appState = {
  selectedKey: "C Ionian",
  selectedChordRoot: "C",
  selectedBassRoot: "C",
  keyChordSet: null,
  sequenceTempoBpm: DEFAULT_TEMPO_BPM,
  sequenceTimeSignature: DEFAULT_TIME_SIGNATURE,
  progressionItems: [],
  selectedProgressionItemId: null,
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
let sequenceKeyboardFlashTimeout = null;
const SEQUENCE_KEYBOARD_MIN_MIDI = 48; // C3
const SEQUENCE_KEYBOARD_MAX_MIDI = 95; // B6
const PLAYBACK_MIN_MIDI = 36; // C2
const TOOL_PANEL_TRANSITION_MS = 180;
let activeToolPanelId = "keyExplorerPanel";
let toolPanelTransitionTimeout = null;
let progressionPreviewToken = 0;
let activeProgressionPlaybackSession = null;

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

  if (sequenceTimeSignatureSelect) {
    sequenceTimeSignatureSelect.value = appState.sequenceTimeSignature;
  }

  renderProgressionBlocks(
    progressionBlocks,
    appState.progressionItems,
    appState.selectedProgressionItemId,
    appState.playingProgressionItemId,
    getBeatsPerBar(appState.sequenceTimeSignature),
    selectedId => {
      appState.selectedProgressionItemId = selectedId;
      renderProgressionBuilderUI();
      void previewProgressionItemSelection(selectedId);
    },
    (editingId, anchorRect) => {
      appState.selectedProgressionItemId = editingId;
      appState.editingProgressionItemId = editingId;
      renderProgressionBuilderUI();
      appState.editingProgressionAnchorRect = getProgressionBlockAnchorRect(editingId, anchorRect);
      renderProgressionBuilderUI();
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
      anchorRect: appState.editingProgressionAnchorRect,
      onClose: () => {
        appState.editingProgressionItemId = null;
        appState.editingProgressionAnchorRect = null;
        renderProgressionBuilderUI();
      }
    }
  );

  if (playProgressionBtn) {
    playProgressionBtn.textContent = appState.isPlayingProgression ? "Stop" : "Play sequence";
    playProgressionBtn.dataset.tooltip = appState.isPlayingProgression
      ? "Stop progression playback"
      : "Play all chords in the progression";
  }
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

  if (autoSuggestToggle?.checked && appData) {
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

async function handleLoadProgression(event) {
  const input = event?.target;
  const file = input?.files?.[0];

  if (!file) {
    return;
  }

  try {
    const raw = await file.text();
    const data = JSON.parse(raw);
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
  } catch (error) {
    console.error("Could not load progression file:", error);
    window.alert("Could not load that progression file.");
  } finally {
    input.value = "";
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

function getIdentifiedSequenceVoicing() {
  const midiNotes = normalizeMidiList(identifiedSequenceChord?.playedMidiNotes);
  if (!midiNotes.length) {
    return null;
  }

  const bassMidi = midiNotes[0];
  const doubledBassMidi = Number.isFinite(bassMidi) ? bassMidi - 12 : null;
  const voicingMidiNotes = normalizeMidiList([
    ...(Number.isFinite(doubledBassMidi) && doubledBassMidi >= PLAYBACK_MIN_MIDI ? [doubledBassMidi] : []),
    ...midiNotes
  ]);

  return {
    source: "keyboard",
    midiNotes: voicingMidiNotes
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
      canUpdate: Boolean(identifiedSequenceChord && appState.selectedProgressionItemId),
      canDelete: Boolean(appState.selectedProgressionItemId),
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
      onDelete: () => {
        if (appState.selectedProgressionItemId) {
          deleteSelectedProgressionChord();
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

function showSequenceKeyboardVoicing(midiNotes, chordName = "", durationSeconds = 1.0) {
  const normalizedMidi = normalizeMidiList(midiNotes);
  if (!normalizedMidi.length) {
    return;
  }

  setSequenceKeyboardNotes(normalizedMidi, durationSeconds, chordName);
}

async function playChordWithSequenceKeyboard(chordName, duration = 1.0) {
  showSequenceKeyboardChord(chordName, duration);
  await playChord(chordName, duration);
}

async function playVoicingWithSequenceKeyboard(midiNotes, chordName = "", duration = 1.0) {
  showSequenceKeyboardVoicing(midiNotes, chordName, duration);
  await playMidiNotes(midiNotes, duration);
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
    if (selectedItem.voicing?.midiNotes?.length) {
      await playVoicingWithSequenceKeyboard(selectedItem.voicing.midiNotes, selectedItem.chord, previewDuration);
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
  renderCompactRootSelector(bassRootSelector, {
    title: "Bass Root",
    selectedNote: appState.selectedBassRoot,
    onSelect: async note => {
      appState.selectedBassRoot = note;
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

  renderSuggestions(results, suggestionPayload, appData.musicData, appState.selectedKey, onSuggestedChordClick, onSuggestedChordAdd);
}

async function handlePlayProgression() {
  if (appState.isPlayingProgression) {
    if (activeProgressionPlaybackSession) {
      activeProgressionPlaybackSession.cancelled = true;
    }
    stopAllPlayback();
    appState.isPlayingProgression = false;
    appState.playingProgressionItemId = null;
    renderProgressionBuilderUI();
    return;
  }

  const progressionItems = [...appState.progressionItems];
  if (!progressionItems.length) return;

  const playbackSession = { cancelled: false };
  activeProgressionPlaybackSession = playbackSession;
  appState.isPlayingProgression = true;
  renderProgressionBuilderUI();

  try {
    let playbackIndex = 0;
    await ensureAudioReady();
    await playProgression(progressionItems, appState.sequenceTempoBpm, async (chord, durationSeconds) => {
      const activeItem = progressionItems[playbackIndex];
      appState.playingProgressionItemId = activeItem?.id || null;
      renderProgressionBuilderUI();
      showSequenceKeyboardChord(chord, durationSeconds);
      playbackIndex += 1;
    }, () => playbackSession.cancelled);
  } catch (error) {
    console.error("Could not play progression:", error);
  } finally {
    if (activeProgressionPlaybackSession === playbackSession) {
      activeProgressionPlaybackSession = null;
    }

    appState.isPlayingProgression = false;
    appState.playingProgressionItemId = null;
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
    if (saveProgressionBtn) saveProgressionBtn.dataset.tooltip = "Save the progression with tempo, time signature, and beat lengths";
    if (loadProgressionBtn) loadProgressionBtn.dataset.tooltip = "Load a saved progression file";
    if (sequenceTempoBpmInput) sequenceTempoBpmInput.dataset.tooltip = "Set the playback tempo for the chord sequence";
    if (sequenceTimeSignatureSelect) sequenceTimeSignatureSelect.dataset.tooltip = "Set the default beats per bar for new chord blocks";
    feelingSelect.dataset.tooltip = "Choose a mood to guide the suggestions";
    if (autoSuggestToggle) autoSuggestToggle.closest(".suggest-toggle").dataset.tooltip = "Automatically refresh suggestions when you add a chord";

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
      playProgressionBtn.addEventListener("click", handlePlayProgression);
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
