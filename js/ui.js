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

const FRIENDLY_ROOT_MAP = {
  "B#": "C",
  Cb: "B",
  "E#": "F",
  Fb: "E"
};

function formatChordLabel(chord) {
  return chord.replace(/dim$/, "°");
}

function getFriendlyChordName(chord) {
  const match = /^([A-G](?:#|b)?)(.*)$/.exec(chord);
  if (!match) return chord;

  const [, root, suffix] = match;
  return `${FRIENDLY_ROOT_MAP[root] || root}${suffix}`;
}

function getChordDisplayInfo(chord) {
  const theoryLabel = formatChordLabel(chord);
  const friendlyLabel = formatChordLabel(getFriendlyChordName(chord));

  return {
    theoryLabel,
    friendlyLabel,
    hasTheoryVariant: theoryLabel !== friendlyLabel
  };
}

function formatDisplayedChordLabel(chord) {
  const { theoryLabel, friendlyLabel, hasTheoryVariant } = getChordDisplayInfo(chord);
  if (!hasTheoryVariant) {
    return friendlyLabel;
  }
  return `${friendlyLabel} (${theoryLabel})`;
}

function appendChordLabelContent(element, chord) {
  const { theoryLabel, friendlyLabel, hasTheoryVariant } = getChordDisplayInfo(chord);

  const friendly = document.createElement("span");
  friendly.className = "chord-label-friendly";
  friendly.textContent = friendlyLabel;
  element.appendChild(friendly);

  if (hasTheoryVariant) {
    const theory = document.createElement("span");
    theory.className = "chord-label-theory";
    theory.textContent = `formal: ${theoryLabel}`;
    element.appendChild(theory);
  }
}

function getChordLabelHtml(chord) {
  const { friendlyLabel } = getChordDisplayInfo(chord);
  return `<span class="chord-label-friendly">${friendlyLabel}</span>`;
}

function createSuggestionDetail(item, onChordClick, onChordAdd) {
  const detail = document.createElement("div");
  detail.className = "suggestion-detail";

  const meta = document.createElement("div");
  meta.className = "suggestion-detail-meta";
  appendChordLabelContent(meta, item.chord);

  const fn = document.createElement("span");
  fn.className = "suggestion-detail-function";
  fn.textContent = `(${item.fn})`;
  meta.appendChild(fn);

  const reason = document.createElement("div");
  reason.className = "suggestion-detail-reason";
  reason.textContent = item.reason;

  const actions = document.createElement("div");
  actions.className = "suggestion-detail-actions";

  const playBtn = document.createElement("button");
  playBtn.className = "suggestion-detail-play-btn";
  playBtn.type = "button";
  playBtn.textContent = "Play chord";
  playBtn.dataset.tooltip = "Play this chord";
  playBtn.addEventListener("click", () => {
    if (onChordClick) onChordClick(item.chord);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "suggestion-detail-add-btn";
  addBtn.type = "button";
  addBtn.textContent = "Add to progression";
  addBtn.dataset.tooltip = "Add this chord to your progression";
  addBtn.addEventListener("click", () => {
    if (onChordAdd) onChordAdd(item.chord);
  });

  actions.appendChild(playBtn);
  actions.appendChild(addBtn);
  detail.appendChild(meta);
  detail.appendChild(reason);
  detail.appendChild(actions);

  return detail;
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

export function renderSuggestions(resultsElement, payload, musicData, selectedKey, onChordClick, onChordAdd) {
  const { suggestions, parsedProgression = [], invalidChords = [] } = payload;

  resultsElement.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "suggestions-wrapper";

  const feedbackContainer = document.createElement("div");
  feedbackContainer.className = "suggestions-feedback";

  if (parsedProgression.length) {
    const progressionDiv = document.createElement("div");
    progressionDiv.className = "suggestion-feedback-item";

    const label = document.createElement("strong");
    label.textContent = "Progression";
    progressionDiv.appendChild(label);

    const text = document.createElement("div");
    text.className = "suggestion-feedback-text";
    text.textContent = parsedProgression
      .map(item => {
        const labelText = formatDisplayedChordLabel(item.original);
        if (item.inKey) {
          return `${labelText} (${item.function})`;
        }
        return labelText;
      })
      .join(" → ");
    progressionDiv.appendChild(text);
    feedbackContainer.appendChild(progressionDiv);
  }

  if (invalidChords.length) {
    const invalidDiv = document.createElement("div");
    invalidDiv.className = "suggestion-feedback-item invalid";

    const label = document.createElement("strong");
    label.textContent = "Not recognised";
    invalidDiv.appendChild(label);

    const text = document.createElement("div");
    text.className = "suggestion-feedback-text";
    text.textContent = invalidChords.join(", ");
    invalidDiv.appendChild(text);
    feedbackContainer.appendChild(invalidDiv);
  }

  if (feedbackContainer.children.length > 0) {
    wrapper.appendChild(feedbackContainer);
  }

  const legend = document.createElement("div");
  legend.className = "theory-legend";
  legend.textContent = "Smaller muted labels show the formal spelling when it differs from the friendlier name.";
  wrapper.appendChild(legend);

  if (!suggestions.length) {
    const empty = document.createElement("div");
    empty.className = "suggestions-empty";
    empty.textContent = "No suggestions found.";
    wrapper.appendChild(empty);
    resultsElement.appendChild(wrapper);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "suggestions-grid";

  const detailHost = document.createElement("div");
  detailHost.className = "suggestion-detail-host";

  let activeCard = null;

  suggestions.forEach(item => {
    const card = document.createElement("div");
    card.className = "suggestion-card";

    const chordBtn = document.createElement("button");
    chordBtn.className = "suggestion-card-chord";
    chordBtn.dataset.tooltip = `Play ${item.chord}`;
    chordBtn.type = "button";
    appendChordLabelContent(chordBtn, item.chord);

    const showDetail = () => {
      if (activeCard) {
        activeCard.classList.remove("active");
      }
      activeCard = card;
      card.classList.add("active");
      detailHost.innerHTML = "";
      detailHost.appendChild(createSuggestionDetail(item, onChordClick, onChordAdd));
    };

    chordBtn.addEventListener("click", event => {
      event.stopPropagation();
      showDetail();
      if (onChordClick) onChordClick(item.chord);
    });

    const fnLabel = document.createElement("div");
    fnLabel.className = "suggestion-card-fn";
    fnLabel.textContent = item.fn;

    const addBtn = document.createElement("button");
    addBtn.className = "suggestion-card-add-btn";
    addBtn.textContent = "+";
    addBtn.dataset.tooltip = `Add ${item.chord} to progression`;
    addBtn.type = "button";
    addBtn.addEventListener("click", event => {
      event.stopPropagation();
      showDetail();
      if (onChordAdd) onChordAdd(item.chord);
    });

    card.addEventListener("click", showDetail);

    card.appendChild(chordBtn);
    card.appendChild(fnLabel);
    card.appendChild(addBtn);
    grid.appendChild(card);
  });

  wrapper.appendChild(grid);
  wrapper.appendChild(detailHost);
  resultsElement.appendChild(wrapper);
}

export function renderError(resultsElement, message) {
  resultsElement.innerHTML = `<li>${message}</li>`;
}

export function renderKeyInfo(element, musicData, selectedKey, onChordClick, onChordAdd) {
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
    .map(chord => {
      const { theoryLabel, friendlyLabel, hasTheoryVariant } = getChordDisplayInfo(chord);
      const playTitle = hasTheoryVariant ? `Play ${friendlyLabel} (formal: ${theoryLabel})` : `Play ${friendlyLabel}`;
      const addTitle = hasTheoryVariant ? `Add ${friendlyLabel} (formal: ${theoryLabel}) to progression` : `Add ${friendlyLabel} to progression`;
      return `<td class="chord-cell"><div class="key-chord-item"><button type="button" class="key-chord-main" data-chord="${chord}" data-tooltip="${playTitle}">${getChordLabelHtml(chord)}</button><button type="button" class="key-chord-add-btn" data-chord="${chord}" data-tooltip="${addTitle}">+</button></div></td>`;
    })
    .join("");

  element.innerHTML = `
    <div class="key-summary-card">
      <div class="key-summary-title">Key: ${formatKeyLabel(keyData.name)}</div>
      <div class="key-summary-meta">
        Relative key: ${formatKeyLabel(keyData.relativeKey)}.
        Parallel key: ${parallelKey === "—" ? "—" : formatKeyLabel(parallelKey)}.
      </div>
      <div class="theory-legend theory-legend-inline">
        Smaller muted labels show the formal spelling when it differs from the friendlier name.
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

  if (onChordClick) {
    element.querySelectorAll(".key-chord-main").forEach(button => {
      button.addEventListener("click", () => {
        const chord = button.getAttribute("data-chord");
        if (chord) {
          onChordClick(chord);
        }
      });
    });
  }

  if (onChordAdd) {
    element.querySelectorAll(".key-chord-add-btn").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const chord = button.getAttribute("data-chord");
        if (chord) {
          onChordAdd(chord);
        }
      });
    });
  }
}