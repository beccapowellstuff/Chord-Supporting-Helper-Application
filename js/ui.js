function getParallelKeyName(keyData, musicData) {
  if (!keyData) return "—";

  const targetMode = keyData.mode === "major" ? "Minor" : "Major";
  const directCandidate = `${keyData.root} ${targetMode}`;

  if (musicData[directCandidate]) {
    return directCandidate;
  }

  const fallbackParallelNames = {
    "Eb Major": "Eb Minor",
    "Ab Major": "Ab Minor",
    "Db Major": "C# Major",
    "C# Minor": "C# Major",
    "D# Minor": "D# Major",
    "G# Minor": "G# Major",
    "C# Major": "C# Minor",
    "Eb Minor": "Eb Major",
    "Ab Minor": "Ab Major"
  };

  return fallbackParallelNames[keyData.name] || "—";
}

function getDegreeLabels(mode) {
  if (mode === "major") {
    return [
      ["I", "tonic"],
      ["ii", "supertonic"],
      ["iii", "mediant"],
      ["IV", "subdominant"],
      ["V", "dominant"],
      ["vi", "submediant"],
      ["vii°", "leading tone"]
    ];
  }

  return [
    ["i", "tonic"],
    ["ii°", "supertonic"],
    ["III", "mediant"],
    ["iv", "subdominant"],
    ["v", "dominant"],
    ["VI", "submediant"],
    ["VII", "subtonic"]
  ];
}

function formatKeyLabel(name) {
  return name
    .replace(" Major", " major")
    .replace(" Minor", " minor");
}

function formatChordLabel(chord) {
  return chord.replace(/dim$/, "°");
}

export function populateFeelings(feelingSelect, moodBoosts) {
  feelingSelect.innerHTML = "";

  Object.keys(moodBoosts).forEach(feeling => {
    const option = document.createElement("option");
    option.value = feeling;
    option.textContent = feeling;
    feelingSelect.appendChild(option);
  });
}

export function renderSuggestions(resultsElement, payload, musicData, selectedKey) {
  const { suggestions, parsedProgression = [], invalidChords = [] } = payload;
  const keyData = musicData[selectedKey];

  resultsElement.innerHTML = "";

  if (parsedProgression.length) {
    const summary = document.createElement("li");
    summary.innerHTML = `
      <strong>Progression understood</strong><br>
      ${parsedProgression
        .map(item => {
          const label = formatChordLabel(item.original);

          if (item.inKey) {
            return `${label} (${item.function})`;
          }

          return `${label} (outside ${formatKeyLabel(selectedKey)})`;
        })
        .join(" → ")}
    `;
    resultsElement.appendChild(summary);
  }

  if (invalidChords.length) {
    const invalid = document.createElement("li");
    invalid.innerHTML = `
      <strong>Not recognised</strong><br>
      ${invalidChords.join(", ")}
    `;
    resultsElement.appendChild(invalid);
  }

  if (!suggestions.length) {
    const li = document.createElement("li");
    li.textContent = "No suggestions found.";
    resultsElement.appendChild(li);
    return;
  }

  suggestions.forEach(item => {
    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${formatChordLabel(item.chord)} (${item.fn})</strong><br>
      ${item.reason}
    `;
    resultsElement.appendChild(li);
  });
}

export function renderError(resultsElement, message) {
  resultsElement.innerHTML = `<li>${message}</li>`;
}

export function renderKeyInfo(element, musicData, selectedKey) {
  const keyData = musicData[selectedKey];
  if (!keyData) {
    element.textContent = "No key selected.";
    return;
  }

  const parallelKey = getParallelKeyName(keyData, musicData);
  const degreeLabels = getDegreeLabels(keyData.mode);

  const headingRow = degreeLabels
    .map(([roman]) => `<th scope="col">${roman}</th>`)
    .join("");

  const functionRow = degreeLabels
    .map(([, functionName]) => `<td>${functionName}</td>`)
    .join("");

  const chordRow = keyData.chords
    .map(chord => `<td>${formatChordLabel(chord)}</td>`)
    .join("");

  element.innerHTML = `
    <div class="key-summary-card">
      <div class="key-summary-title">Key: ${formatKeyLabel(keyData.name)}</div>
      <div class="key-summary-meta">
        Relative key: ${formatKeyLabel(keyData.relativeKey)}.
        Parallel key: ${parallelKey === "—" ? "—" : formatKeyLabel(parallelKey)}.
      </div>
    </div>

    <div class="key-chords-card">
      <div class="key-chords-title">Chords in ${formatKeyLabel(keyData.name)}</div>
      <div class="table-wrap">
        <table class="key-chords-table">
          <thead>
            <tr>${headingRow}</tr>
          </thead>
          <tbody>
            <tr>${functionRow}</tr>
            <tr>${chordRow}</tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}