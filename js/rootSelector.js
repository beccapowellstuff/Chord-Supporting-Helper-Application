/**
 * rootSelector.js — Chromatic root selector UI
 *
 * Responsibilities:
 *   - Renders a one-row table of 12 chromatic root buttons (C through B)
 *   - Highlights the button whose pitch class matches the currently selected key
 *   - On click, reads the current style from #styleSelect, resolves the
 *     root + style to a key name, and fires onSelectKey
 *   - findKeyForRoot: resolution logic that prefers an exact name match,
 *     falls back to mode match by pitch class, then any pitch-class match
 *
 * Exports: renderRootSelector
 * Depends on: chordNotes (NOTE_TO_PC)
 */
import { NOTE_TO_PC } from "./chordNotes.js";

const CHROMATIC = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

function formatNoteLabel(note) {
  return String(note || "")
    .replace(/b/g, "\u266d")
    .replace(/#/g, "\u266f");
}

function noteToPitchClass(note) {
  return NOTE_TO_PC[note] ?? null;
}

/**
 * Given a root label (e.g. "C#") and a mode id (e.g. "ionian"), find the best
 * matching key name in musicData.
 */
function findKeyForRoot(label, modeId, musicData) {
  if (!musicData) return null;

  const targetModeId = String(modeId || "").trim();
  const targetPc = noteToPitchClass(label);
  if (targetPc == null) return null;

  // Prefer keys whose mode id matches exactly
  for (const keyName of Object.keys(musicData)) {
    const root = keyName.split(" ")[0];
    const keyData = musicData[keyName];
    if (noteToPitchClass(root) === targetPc && keyData?.modeId === targetModeId) {
      return keyName;
    }
  }

  // Fallback: same pitch class, any mode
  for (const keyName of Object.keys(musicData)) {
    if (noteToPitchClass(keyName.split(" ")[0]) === targetPc) return keyName;
  }

  return null;
}

/**
 * Render a one-row table of chromatic root buttons into `container`.
 *
 * @param {HTMLElement} container   Target element (id="rootContainer")
 * @param {string}      selectedKey Currently active key name (e.g. "C Ionian")
 * @param {Function}    onSelectKey Called with the new key name when a root is clicked
 * @param {Object}      musicData   Full music data keyed by key name
 */
export function renderRootSelector(container, selectedKey, onSelectKey, musicData) {
  container.innerHTML = "";

  const table = document.createElement("table");
  table.className = "root-table";

  const tbody = document.createElement("tbody");
  const row = document.createElement("tr");

  CHROMATIC.forEach(label => {
    const td = document.createElement("td");

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "circle-root-btn";
    btn.textContent = formatNoteLabel(label);
    btn.dataset.root = label;

    // Highlight the button whose pitch class matches the current key root
    const selectedRoot = selectedKey ? selectedKey.split(" ")[0] : "";
    if (noteToPitchClass(label) === noteToPitchClass(selectedRoot)) {
      btn.classList.add("root-btn-active");
    }

    btn.addEventListener("click", () => {
      const styleEl = document.getElementById("styleSelect");
      const modeId = styleEl ? styleEl.value : "ionian";
      const keyName = findKeyForRoot(label, modeId, musicData);
      if (keyName && onSelectKey) onSelectKey(keyName);
    });

    td.appendChild(btn);
    row.appendChild(td);
  });

  tbody.appendChild(row);
  table.appendChild(tbody);
  container.appendChild(table);
}
