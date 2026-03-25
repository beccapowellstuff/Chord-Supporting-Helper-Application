// rootSelector.js
// Renders the chromatic root-selection table and resolves a root + style to a key name.

const NOTE_TO_PC = {
  "C": 0,
  "B#": 0,
  "C#": 1,
  "Db": 1,
  "D": 2,
  "D#": 3,
  "Eb": 3,
  "E": 4,
  "Fb": 4,
  "E#": 5,
  "F": 5,
  "F#": 6,
  "Gb": 6,
  "G": 7,
  "G#": 8,
  "Ab": 8,
  "A": 9,
  "A#": 10,
  "Bb": 10,
  "B": 11,
  "Cb": 11
};

const CHROMATIC = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

function noteToPitchClass(note) {
  return NOTE_TO_PC[note] ?? null;
}

/**
 * Given a root label (e.g. "C#") and a style (e.g. "Major"), find the best
 * matching key name in musicData.
 */
function findKeyForRoot(label, style, musicData) {
  if (!musicData) return null;

  const direct = `${label} ${style}`;
  if (musicData[direct]) return direct;

  const styleLower = String(style || "").toLowerCase();
  const targetPc = noteToPitchClass(label);
  if (targetPc == null) return null;

  // Prefer keys whose mode matches exactly
  for (const keyName of Object.keys(musicData)) {
    const root = keyName.split(" ")[0];
    const keyData = musicData[keyName];
    if (noteToPitchClass(root) === targetPc && keyData?.mode === styleLower) {
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
 * @param {string}      selectedKey Currently active key name (e.g. "C Major")
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
    btn.className = "key-chord-main circle-root-btn";
    btn.textContent = label;
    btn.dataset.root = label;

    // Highlight the button whose pitch class matches the current key root
    const selectedRoot = selectedKey ? selectedKey.split(" ")[0] : "";
    if (noteToPitchClass(label) === noteToPitchClass(selectedRoot)) {
      btn.classList.add("root-btn-active");
    }

    btn.addEventListener("click", () => {
      const styleEl = document.getElementById("styleSelect");
      const style = styleEl ? styleEl.value : "Major";
      const keyName = findKeyForRoot(label, style, musicData) || `${label} ${style}`;
      if (onSelectKey) onSelectKey(keyName);
    });

    td.appendChild(btn);
    row.appendChild(td);
  });

  tbody.appendChild(row);
  table.appendChild(tbody);
  container.appendChild(table);
}
