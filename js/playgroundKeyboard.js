import { DISPLAY_CHROMATIC, NOTE_TO_PC, noteToMidi, pitchClassToDisplayNote } from "./chordNotes.js";

const KEYBOARD_OCTAVES = [3, 4, 5, 6];
const BASS_LANE_OCTAVES = [1, 2];
const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);
const BLACK_KEY_AFTER_WHITE_INDEXES = [0, 1, 3, 4, 5];

function formatAccidentalDisplay(value) {
  return String(value || "")
    .replace(/b/g, "\u266d")
    .replace(/#/g, "\u266f");
}

function formatKeyboardNoteWithOctave(noteLabel, midi) {
  const octave = Math.floor((Number(midi) / 12) - 1);
  return `${formatAccidentalDisplay(noteLabel)}(${octave})`;
}

function buildKeyboardLayout() {
  const whiteKeys = [];
  const blackKeys = [];
  let whiteIndexOffset = 0;

  KEYBOARD_OCTAVES.forEach((octave, octaveIndex) => {
    for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
      const noteLabel = pitchClassToDisplayNote(pitchClass);
      const midi = noteToMidi(noteLabel, octave);
      if (midi == null) continue;

      const key = {
        midi,
        noteLabel,
        octave,
        pitchClass
      };

      if (WHITE_PITCH_CLASSES.has(pitchClass)) {
        whiteKeys.push(key);
      } else {
        const localBlackIndex = BLACK_KEY_AFTER_WHITE_INDEXES[
          [1, 3, 6, 8, 10].indexOf(pitchClass)
        ];
        blackKeys.push({
          ...key,
          afterWhiteIndex: whiteIndexOffset + localBlackIndex
        });
      }
    }

    whiteIndexOffset += 7;
  });

  return { whiteKeys, blackKeys, whiteCount: KEYBOARD_OCTAVES.length * 7 };
}

const KEYBOARD_LAYOUT = buildKeyboardLayout();

function buildBassLaneLayout() {
  return BASS_LANE_OCTAVES.flatMap(octave =>
    DISPLAY_CHROMATIC.map(noteLabel => {
      const midi = noteToMidi(noteLabel, octave);
      if (midi == null) {
        return null;
      }

      return {
        midi,
        noteLabel,
        octave,
        pitchClass: NOTE_TO_PC[noteLabel]
      };
    }).filter(Boolean)
  );
}

const BASS_LANE_KEYS = buildBassLaneLayout();

function buildCompactRootButton(note, title, selectedNote, onSelect) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "compact-root-btn";
  button.textContent = formatAccidentalDisplay(note);
  button.title = `${title} ${formatAccidentalDisplay(note)}`;

  if (NOTE_TO_PC[note] === NOTE_TO_PC[selectedNote]) {
    button.classList.add("active");
  }

  button.addEventListener("click", () => {
    if (onSelect) onSelect(note);
  });

  return button;
}

export function renderCompactRootSelector(
  container,
  {
    title,
    selectedNote,
    onSelect
  }
) {
  if (!container) return;

  container.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "compact-root-selector";

  const label = document.createElement("div");
  label.className = "compact-root-title";
  label.textContent = title;
  shell.appendChild(label);

  const row = document.createElement("div");
  row.className = "compact-root-row";

  DISPLAY_CHROMATIC.forEach(note => {
    row.appendChild(buildCompactRootButton(note, `Set ${title} to`, selectedNote, onSelect));
  });

  shell.appendChild(row);
  container.appendChild(shell);
}

function buildSequenceKey(midi, noteLabel, className, activeMidiNotes, flashMidiNotes, onKeyToggle) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.midi = String(midi);
  button.dataset.note = noteLabel;
  button.title = formatKeyboardNoteWithOctave(noteLabel, midi);

  const label = document.createElement("span");
  label.className = "sequence-key-label";
  label.textContent = formatAccidentalDisplay(noteLabel);
  button.appendChild(label);

  if (activeMidiNotes.has(midi)) {
    button.classList.add("sequence-key-active");
  }

  if (flashMidiNotes.has(midi)) {
    button.classList.add("sequence-key-flash");
  }

  button.addEventListener("click", () => {
    if (onKeyToggle) onKeyToggle(midi);
  });

  return button;
}

function buildSequenceIconButton(label, icon, disabled, title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "sequence-keyboard-action app-icon-button";
  button.dataset.icon = icon;
  button.disabled = Boolean(disabled);
  button.title = title;
  button.setAttribute("aria-label", label);

  const hiddenLabel = document.createElement("span");
  hiddenLabel.className = "visually-hidden";
  hiddenLabel.textContent = label;
  button.appendChild(hiddenLabel);

  button.addEventListener("click", () => {
    if (!button.disabled && onClick) onClick();
  });

  return button;
}

export function renderSequenceKeyboard(
  container,
  {
    activeMidiNotes = [],
    flashMidiNotes = [],
    chordLabel = "No notes selected",
    canSave = false,
    canUpdate = false,
    canInsert = false,
    insertChoiceActive = false,
    canSplit = false,
    canDuplicate = false,
    canDelete = false,
    canPlay = false
  },
  {
    onKeyToggle,
    onPlay,
    onSave,
    onUpdate,
    onInsert,
    onInsertBefore,
    onInsertAfter,
    onInsertCancel,
    onSplit,
    onDuplicate,
    onDelete,
    onClear
  } = {},
  toolbarContainer = null
) {
  if (!container) return;

  container.innerHTML = "";
  if (toolbarContainer) {
    toolbarContainer.innerHTML = "";
  }

  const shell = document.createElement("div");
  shell.className = "sequence-keyboard-shell";

  const header = document.createElement("div");
  header.className = "sequence-keyboard-header";

  const titleBlock = document.createElement("div");
  titleBlock.className = "sequence-keyboard-title-block";

  const titleRow = document.createElement("div");
  titleRow.className = "sequence-keyboard-title-row";

  const label = document.createElement("div");
  label.className = "sequence-keyboard-label";
  label.textContent = "Keyboard";
  titleRow.appendChild(label);

  const helpButton = document.createElement("button");
  helpButton.type = "button";
  helpButton.className = "section-help-btn section-help-btn-subtle sequence-keyboard-help-btn";
  helpButton.dataset.helpTopic = "keyboard";
  helpButton.dataset.tooltip = "How to use this section";
  helpButton.setAttribute("aria-label", "Open help");
  helpButton.textContent = "?";
  titleRow.appendChild(helpButton);

  const chordName = document.createElement("div");
  chordName.className = "sequence-keyboard-chord-name";
  chordName.textContent = chordLabel;
  titleRow.appendChild(chordName);

  titleBlock.appendChild(titleRow);
  header.appendChild(titleBlock);

  const headerTools = document.createElement("div");
  headerTools.className = "sequence-keyboard-header-tools";

  const clearButton = buildSequenceIconButton(
    "Clear",
    "clear",
    !canPlay,
    canPlay ? "Clear Keyboard Selected Notes" : "Select notes to clear them",
    onClear
  );
  headerTools.appendChild(clearButton);

  header.appendChild(headerTools);

  const actions = document.createElement("div");
  actions.className = "sequence-keyboard-actions sequence-keyboard-toolbar";

  const playButton = buildSequenceIconButton(
    "Play",
    "play",
    !canPlay,
    canPlay ? "Play the selected notes" : "Select notes to play them",
    onPlay
  );
  actions.appendChild(playButton);

  const saveButton = buildSequenceIconButton(
    "Add",
    "add",
    !canSave,
    canSave ? "Add the identified chord to the progression" : "Select a recognised chord to add it",
    onSave
  );
  actions.appendChild(saveButton);

  const updateButton = buildSequenceIconButton(
    "Update",
    "update",
    !canUpdate,
    canUpdate
      ? "Replace the selected progression chord with the recognised chord"
      : "Select a progression chord and a recognised keyboard chord to update it",
    onUpdate
  );
  actions.appendChild(updateButton);

  const insertControl = document.createElement("div");
  insertControl.className = "sequence-keyboard-insert-control";

  const insertButton = buildSequenceIconButton(
    "Insert",
    "insert",
    !canInsert,
    canInsert
      ? "Insert a duplicated chord before or after the selected progression chord"
      : "Select a progression chord to insert beside it",
    onInsert
  );
  insertControl.appendChild(insertButton);

  if (insertChoiceActive && canInsert) {
    const insertChoice = document.createElement("div");
    insertChoice.className = "sequence-keyboard-insert-popover";

    const beforeButton = document.createElement("button");
    beforeButton.type = "button";
    beforeButton.className = "sequence-keyboard-inline-choice-btn";
    beforeButton.textContent = "Before";
    beforeButton.title = "Insert a duplicated chord before the selected chord";
    beforeButton.addEventListener("click", () => {
      if (onInsertBefore) onInsertBefore();
    });
    insertChoice.appendChild(beforeButton);

    const afterButton = document.createElement("button");
    afterButton.type = "button";
    afterButton.className = "sequence-keyboard-inline-choice-btn";
    afterButton.textContent = "After";
    afterButton.title = "Insert a duplicated chord after the selected chord";
    afterButton.addEventListener("click", () => {
      if (onInsertAfter) onInsertAfter();
    });
    insertChoice.appendChild(afterButton);

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "sequence-keyboard-inline-choice-btn sequence-keyboard-inline-choice-btn-cancel";
    cancelButton.textContent = "\u00d7";
    cancelButton.title = "Cancel insert";
    cancelButton.setAttribute("aria-label", "Cancel insert");
    cancelButton.addEventListener("click", () => {
      if (onInsertCancel) onInsertCancel();
    });
    insertChoice.appendChild(cancelButton);

    insertControl.appendChild(insertChoice);
  }

  actions.appendChild(insertControl);

  const splitButton = buildSequenceIconButton(
    "Split",
    "split",
    !canSplit,
    canSplit
      ? "Split the selected progression chord into two shorter blocks"
      : "Select a progression chord longer than 1 beat to split it",
    onSplit
  );
  actions.appendChild(splitButton);

  const duplicateButton = buildSequenceIconButton(
    "Duplicate",
    "duplicate",
    !canDuplicate,
    canDuplicate
      ? "Duplicate the selected progression chord beside itself"
      : "Select a progression chord to duplicate it",
    onDuplicate
  );
  actions.appendChild(duplicateButton);

  const deleteButton = buildSequenceIconButton(
    "Delete",
    "delete",
    !canDelete,
    canDelete
      ? "Delete the selected progression chord"
      : "Select a progression chord to delete it",
    onDelete
  );
  actions.appendChild(deleteButton);

  shell.appendChild(header);

  const piano = document.createElement("div");
  piano.className = "sequence-piano";

  const pianoStage = document.createElement("div");
  pianoStage.className = "sequence-piano-stage";

  const activeSet = new Set(activeMidiNotes);
  const flashSet = new Set(flashMidiNotes);

  const whites = document.createElement("div");
  whites.className = "sequence-piano-whites";
  KEYBOARD_LAYOUT.whiteKeys.forEach(key => {
    whites.appendChild(
      buildSequenceKey(
        key.midi,
        key.noteLabel,
        "sequence-key sequence-key-white",
        activeSet,
        flashSet,
        onKeyToggle
      )
    );
  });

  const blacks = document.createElement("div");
  blacks.className = "sequence-piano-blacks";
  KEYBOARD_LAYOUT.blackKeys.forEach(key => {
    const button = buildSequenceKey(
      key.midi,
      key.noteLabel,
      "sequence-key sequence-key-black",
      activeSet,
      flashSet,
      onKeyToggle
    );
    button.style.left = `${((key.afterWhiteIndex + 1) * 100) / KEYBOARD_LAYOUT.whiteCount}%`;
    button.style.transform = "translateX(-50%)";
    blacks.appendChild(button);
  });

  pianoStage.appendChild(whites);
  pianoStage.appendChild(blacks);
  piano.appendChild(pianoStage);
  shell.appendChild(piano);

  const bassLane = document.createElement("div");
  bassLane.className = "sequence-bass-lane";

  const bassLaneLabel = document.createElement("div");
  bassLaneLabel.className = "sequence-bass-lane-label";
  bassLaneLabel.textContent = "Bass";
  bassLane.appendChild(bassLaneLabel);

  const bassLaneMidiSet = new Set(BASS_LANE_KEYS.map(key => key.midi));
  const bassActiveSet = new Set(
    activeMidiNotes.filter(midi => bassLaneMidiSet.has(midi))
  );
  const bassFlashSet = new Set(
    flashMidiNotes.filter(midi => bassLaneMidiSet.has(midi))
  );

  const bassKeys = document.createElement("div");
  bassKeys.className = "sequence-bass-keys";

  BASS_LANE_KEYS.forEach((key, index) => {
    const button = buildSequenceKey(
      key.midi,
      key.noteLabel,
      "sequence-bass-key",
      bassActiveSet,
      bassFlashSet,
      onKeyToggle
    );
    button.dataset.octave = String(key.octave);
    bassKeys.appendChild(button);
  });

  bassLane.appendChild(bassKeys);
  shell.appendChild(bassLane);

  container.appendChild(shell);
  if (toolbarContainer) {
    toolbarContainer.appendChild(actions);
  } else {
    container.appendChild(actions);
  }

  const targetMidiNotes = normalizeTargetMidiNotes(
    flashMidiNotes.length ? flashMidiNotes : activeMidiNotes
  );
  if (targetMidiNotes.length) {
    requestAnimationFrame(() => {
      scrollKeyboardToMidiRange(piano, targetMidiNotes);
    });
  }
}

function normalizeTargetMidiNotes(midiNotes) {
  return [...new Set((Array.isArray(midiNotes) ? midiNotes : []).filter(Number.isFinite))].sort((a, b) => a - b);
}

function scrollKeyboardToMidiRange(piano, midiNotes) {
  if (!piano || !midiNotes.length) return;

  const targetButtons = midiNotes
    .map(midi => piano.querySelector(`[data-midi="${midi}"]`))
    .filter(Boolean);

  if (!targetButtons.length) return;

  const firstButton = targetButtons[0];
  const lastButton = targetButtons[targetButtons.length - 1];
  const leftEdge = firstButton.offsetLeft;
  const rightEdge = lastButton.offsetLeft + lastButton.offsetWidth;
  const visibleLeft = piano.scrollLeft;
  const visibleRight = visibleLeft + piano.clientWidth;
  const padding = 32;

  if (leftEdge - padding < visibleLeft) {
    piano.scrollLeft = Math.max(0, leftEdge - padding);
    return;
  }

  if (rightEdge + padding > visibleRight) {
    piano.scrollLeft = Math.max(0, rightEdge - piano.clientWidth + padding);
  }
}
