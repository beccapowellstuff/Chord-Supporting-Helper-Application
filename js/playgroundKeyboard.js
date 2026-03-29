import { DISPLAY_CHROMATIC, NOTE_TO_PC, noteToMidi, pitchClassToDisplayNote } from "./chordNotes.js";

const KEYBOARD_OCTAVES = [3, 4, 5, 6];
const WHITE_PITCH_CLASSES = new Set([0, 2, 4, 5, 7, 9, 11]);
const BLACK_KEY_AFTER_WHITE_INDEXES = [0, 1, 3, 4, 5];

function formatAccidentalDisplay(value) {
  return String(value || "")
    .replace(/b/g, "\u266d")
    .replace(/#/g, "\u266f");
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
  button.title = formatAccidentalDisplay(noteLabel);

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

export function renderSequenceKeyboard(
  container,
  {
    activeMidiNotes = [],
    flashMidiNotes = [],
    chordLabel = "No notes selected",
    canSave = false,
    canPlay = false
  },
  {
    onKeyToggle,
    onPlay,
    onSave,
    onClear
  } = {}
) {
  if (!container) return;

  container.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "sequence-keyboard-shell";

  const header = document.createElement("div");
  header.className = "sequence-keyboard-header";

  const titleBlock = document.createElement("div");
  titleBlock.className = "sequence-keyboard-title-block";

  const label = document.createElement("div");
  label.className = "sequence-keyboard-label";
  label.textContent = "Keyboard";
  titleBlock.appendChild(label);

  const chordName = document.createElement("div");
  chordName.className = "sequence-keyboard-chord-name";
  chordName.textContent = chordLabel;
  titleBlock.appendChild(chordName);

  header.appendChild(titleBlock);

  const actions = document.createElement("div");
  actions.className = "sequence-keyboard-actions";

  const playButton = document.createElement("button");
  playButton.type = "button";
  playButton.className = "sequence-keyboard-action";
  playButton.textContent = "Play";
  playButton.disabled = !canPlay;
  playButton.title = canPlay ? "Play the selected notes" : "Select notes to play them";
  playButton.addEventListener("click", () => {
    if (canPlay && onPlay) onPlay();
  });
  actions.appendChild(playButton);

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "sequence-keyboard-action";
  saveButton.textContent = "Add";
  saveButton.disabled = !canSave;
  saveButton.title = canSave ? "Add the identified chord to the progression" : "Select a recognised chord to add it";
  saveButton.addEventListener("click", () => {
    if (canSave && onSave) onSave();
  });
  actions.appendChild(saveButton);

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "sequence-keyboard-action";
  clearButton.textContent = "Clear";
  clearButton.title = "Clear selected notes";
  clearButton.addEventListener("click", () => {
    if (onClear) onClear();
  });
  actions.appendChild(clearButton);

  header.appendChild(actions);
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
    blacks.appendChild(button);
  });

  pianoStage.appendChild(whites);
  pianoStage.appendChild(blacks);
  piano.appendChild(pianoStage);
  shell.appendChild(piano);

  container.appendChild(shell);

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
