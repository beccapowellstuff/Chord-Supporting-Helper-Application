import { NOTE_TO_PC } from "./chordNotes.js";

const WHITE_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK_NOTES = [
  { note: "C#", label: "C#", afterIndex: 0 },
  { note: "Eb", label: "Eb", afterIndex: 1 },
  { note: "F#", label: "F#", afterIndex: 3 },
  { note: "G#", label: "G#", afterIndex: 4 },
  { note: "Bb", label: "Bb", afterIndex: 5 }
];

function formatNoteLabel(note) {
  return String(note || "")
    .replace(/b/g, "\u266d")
    .replace(/#/g, "\u266f");
}

function noteMatches(target, note) {
  return NOTE_TO_PC[target] != null && NOTE_TO_PC[target] === NOTE_TO_PC[note];
}

function setMarkerClasses(button, note, lastPlayedPitchClasses, currentPlayedPitchClasses) {
  const pitchClass = NOTE_TO_PC[note];
  if (lastPlayedPitchClasses.has(pitchClass)) {
    button.classList.add("playground-key-last-played");
  }
  if (currentPlayedPitchClasses.has(pitchClass)) {
    button.classList.add("playground-key-flash");
  }
}

function buildKeyButton(
  note,
  role,
  selectedNote,
  lastPlayedPitchClasses,
  currentPlayedPitchClasses,
  onSelect,
  className
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = formatNoteLabel(note);
  button.dataset.note = note;
  button.dataset.role = role;
  button.title = `${role === "bass" ? "Bass" : "Chord"} root ${formatNoteLabel(note)}`;

  if (noteMatches(selectedNote, note)) {
    button.classList.add(role === "bass" ? "playground-key-selected-bass" : "playground-key-selected-chord");
  }

  setMarkerClasses(button, note, lastPlayedPitchClasses, currentPlayedPitchClasses);

  button.addEventListener("click", () => {
    if (onSelect) onSelect(note);
  });

  return button;
}

function buildKeyboardHalf(
  title,
  role,
  selectedNote,
  lastPlayedPitchClasses,
  currentPlayedPitchClasses,
  onSelect,
  onClearLastPlayed,
  onSaveLastPlayed,
  canSaveLastPlayed
) {
  const section = document.createElement("section");
  section.className = "playground-keyboard-half";

  const heading = document.createElement("div");
  heading.className = "playground-keyboard-heading";

  const headingLabel = document.createElement("div");
  headingLabel.className = "playground-keyboard-label";
  headingLabel.textContent = title;
  heading.appendChild(headingLabel);

  const actionGroup = document.createElement("div");
  actionGroup.className = "playground-keyboard-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.className = "playground-keyboard-save";
  saveButton.textContent = "Save";
  saveButton.title = canSaveLastPlayed ? "Save last played chord to sequence" : "Play a chord to save it to the sequence";
  saveButton.setAttribute("aria-label", "Save last played to sequence");
  saveButton.disabled = !canSaveLastPlayed;
  saveButton.addEventListener("click", () => {
    if (onSaveLastPlayed && canSaveLastPlayed) onSaveLastPlayed();
  });
  actionGroup.appendChild(saveButton);

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "playground-keyboard-clear";
  clearButton.textContent = "🗑";
  clearButton.title = "Clear last played";
  clearButton.setAttribute("aria-label", "Clear last played");
  clearButton.addEventListener("click", () => {
    if (onClearLastPlayed) onClearLastPlayed();
  });
  actionGroup.appendChild(clearButton);

  heading.appendChild(actionGroup);

  section.appendChild(heading);

  const keyboard = document.createElement("div");
  keyboard.className = "playground-piano";

  const whites = document.createElement("div");
  whites.className = "playground-piano-whites";

  WHITE_NOTES.forEach(note => {
    whites.appendChild(
      buildKeyButton(
        note,
        role,
        selectedNote,
        lastPlayedPitchClasses,
        currentPlayedPitchClasses,
        onSelect,
        "playground-key playground-key-white"
      )
    );
  });

  const blacks = document.createElement("div");
  blacks.className = "playground-piano-blacks";

  BLACK_NOTES.forEach(({ note, label, afterIndex }) => {
    const blackKey = buildKeyButton(
      note,
      role,
      selectedNote,
      lastPlayedPitchClasses,
      currentPlayedPitchClasses,
      onSelect,
      "playground-key playground-key-black"
    );
    blackKey.textContent = formatNoteLabel(label);
    blackKey.style.left = `calc(${((afterIndex + 1) * 100) / 7}% - 12px)`;
    blacks.appendChild(blackKey);
  });

  keyboard.appendChild(whites);
  keyboard.appendChild(blacks);
  section.appendChild(keyboard);

  return section;
}

export function renderPlaygroundKeyboard(
  container,
  {
    selectedBassRoot,
    selectedChordRoot,
    currentPlayedBassRoot,
    currentPlayedChordPitchClasses = [],
    lastPlayedBassRoot,
    lastPlayedChordPitchClasses = [],
    canSaveLastPlayed = false
  },
  {
    onClearLastPlayed,
    onSaveLastPlayed,
    onBassSelect,
    onChordSelect
  } = {}
) {
  if (!container) return;

  container.innerHTML = "";

  const shell = document.createElement("div");
  shell.className = "playground-keyboard";

  const lastPlayedBass = new Set();
  if (lastPlayedBassRoot && NOTE_TO_PC[lastPlayedBassRoot] != null) {
    lastPlayedBass.add(NOTE_TO_PC[lastPlayedBassRoot]);
  }

  const currentPlayedBass = new Set();
  if (currentPlayedBassRoot && NOTE_TO_PC[currentPlayedBassRoot] != null) {
    currentPlayedBass.add(NOTE_TO_PC[currentPlayedBassRoot]);
  }

  shell.appendChild(
    buildKeyboardHalf(
      "Bass Root",
      "bass",
      selectedBassRoot,
      lastPlayedBass,
      currentPlayedBass,
      onBassSelect,
      onClearLastPlayed,
      onSaveLastPlayed,
      canSaveLastPlayed
    )
  );

  shell.appendChild(
    buildKeyboardHalf(
      "Chord Root",
      "chord",
      selectedChordRoot,
      new Set(lastPlayedChordPitchClasses),
      new Set(currentPlayedChordPitchClasses),
      onChordSelect,
      onClearLastPlayed,
      onSaveLastPlayed,
      canSaveLastPlayed
    )
  );

  container.appendChild(shell);
}
