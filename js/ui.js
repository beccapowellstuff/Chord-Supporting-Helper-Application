/**
 * ui.js - All DOM rendering and UI helpers
 *
 * Responsibilities:
 *   - populateFeelings: fills the mood/feeling <select> from data
 *   - populateModeSelect: fills the style/mode <select> with grouped options
 *   - renderSuggestions: builds the suggestion card grid with detail panel
 *   - renderError: shows an error message in the results area
 *   - renderKeyInfo: renders the key summary card for the selected mode/key
 *   - renderChordLoader: renders the chord variation buttons for the selected
 *     root note (play and add-to-progression actions injected as callbacks)
 *   - initTooltips: attaches the floating tooltip to the document
 *   - getFriendlyChordName: converts theoretical root names to common display
 *     equivalents where useful
 *
 * Exports: populateFeelings, populateModeSelect, renderSuggestions,
 *          renderError, renderKeyInfo, renderChordLoader, initTooltips,
 *          getFriendlyChordName
 * Depends on: nothing (pure DOM, receives all data and callbacks as arguments)
 */
const FRIENDLY_ROOT_MAP = {
  "B#": "C",
  Cb: "B",
  "E#": "F",
  Fb: "E"
};

function formatAccidentalDisplay(value) {
  return String(value || "")
    .replace(/b/g, "\u266d")
    .replace(/#/g, "\u266f");
}

function formatKeyLabel(name) {
  return formatAccidentalDisplay(String(name || "").trim());
}

function formatNoteLabel(note) {
  return formatAccidentalDisplay(note);
}

const CHORD_SUFFIX_BASES = [
  "mMaj7",
  "Maj13",
  "Maj11",
  "Maj9",
  "Maj7",
  "m13",
  "m11",
  "m9",
  "m7",
  "7alt",
  "add13",
  "add11",
  "add9",
  "sus4",
  "sus2",
  "13",
  "11",
  "9",
  "7",
  "aug",
  "dim",
  "m",
  "5",
  "alt"
];

function formatChordBaseLabel(base) {
  if (base === "Maj7") return "maj7";
  if (base === "Maj9") return "maj9";
  if (base === "Maj11") return "maj11";
  if (base === "Maj13") return "maj13";
  return formatAccidentalDisplay(base);
}

function formatAlterationList(tail) {
  const alterations = String(tail || "").match(/[b#](?:5|9|11|13)/gi);
  if (!alterations?.length) {
    return formatAccidentalDisplay(tail);
  }

  return alterations
    .map(alteration => formatAccidentalDisplay(alteration))
    .join(",");
}

function formatChordSuffixLabel(suffix) {
  const rawSuffix = String(suffix || "").trim();

  if (!rawSuffix) {
    return "";
  }

  if (rawSuffix === "dim") {
    return "\u00b0";
  }

  for (const base of CHORD_SUFFIX_BASES) {
    if (!rawSuffix.startsWith(base)) {
      continue;
    }

    const tail = rawSuffix.slice(base.length);
    if (!tail) {
      return formatChordBaseLabel(base);
    }

    if (/^(?:[b#](?:5|9|11|13))+$/i.test(tail)) {
      return `${formatChordBaseLabel(base)}(${formatAlterationList(tail)})`;
    }
  }

  return formatAccidentalDisplay(rawSuffix);
}

function formatChordLabel(chord) {
  const match = /^([A-G](?:#{1,2}|b{1,2})?)(.*)$/.exec(String(chord || "").trim());
  if (!match) {
    return formatChordSuffixLabel(chord);
  }

  const [, root, suffix] = match;
  return `${formatNoteLabel(root)}${formatChordSuffixLabel(suffix)}`;
}

function formatRomanNumeralLabel(label) {
  return String(label || "")
    .replace(/b/g, "\u266d")
    .replace(/#/g, "\u266f")
    .replace(/Â°|Ã‚Â°/g, "\u00b0");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getFriendlyChordName(chord) {
  const match = /^([A-G](?:#{1,2}|b{1,2})?)(.*)$/.exec(chord);
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
  fn.textContent = `(${formatRomanNumeralLabel(item.fn)})`;
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

export function populateModeSelect(styleSelect, modeGroups) {
  if (!styleSelect) return;

  styleSelect.innerHTML = "";

  modeGroups.forEach(group => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label || group.category;

    group.modes.forEach(mode => {
      const option = document.createElement("option");
      option.value = mode.value;
      option.textContent = mode.label;
      optgroup.appendChild(option);
    });

    styleSelect.appendChild(optgroup);
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
          return `${labelText} (${formatRomanNumeralLabel(item.function)})`;
        }
        return labelText;
      })
      .join(" -> ");
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
    chordBtn.dataset.tooltip = `Play ${formatChordLabel(item.chord)}`;
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
    fnLabel.textContent = formatRomanNumeralLabel(item.fn);

    const addBtn = document.createElement("button");
    addBtn.className = "suggestion-card-add-btn";
    addBtn.textContent = "+";
    addBtn.dataset.tooltip = `Add ${formatChordLabel(item.chord)} to progression`;
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

export function renderKeyInfo(element, musicData, selectedKey, onChordClick, onChordAdd, onPlayNote, onPlayScale) {
  const keyData = musicData[selectedKey];
  if (!keyData) {
    element.textContent = "No key selected.";
    return;
  }

  const degreeLabels = (keyData.degreeLabels || []).map((roman, index) => [
    roman,
    keyData.degreeDescriptions?.[index] || ""
  ]);

  const headingRow = degreeLabels
    .map(([roman]) => `<td>${formatRomanNumeralLabel(roman)}</td>`)
    .join("");

  const functionRow = degreeLabels
    .map(([, functionName]) => `<td>${functionName}</td>`)
    .join("");

  const chordRow = keyData.chords
    .map(chord => {
      const { theoryLabel, friendlyLabel, hasTheoryVariant } = getChordDisplayInfo(chord);
      const playTitle = hasTheoryVariant
        ? `Play ${friendlyLabel} (formal: ${theoryLabel})`
        : `Play ${friendlyLabel}`;
      const addTitle = hasTheoryVariant
        ? `Add ${friendlyLabel} (formal: ${theoryLabel}) to progression`
        : `Add ${friendlyLabel} to progression`;

      return `
        <td class="chord-cell">
          <div class="key-chord-item">
            <button
              class="key-chord-main"
              type="button"
              data-chord="${chord}"
              title="${playTitle}">
              ${getChordLabelHtml(chord)}
            </button>
            <button
              class="key-chord-add-btn"
              type="button"
              data-chord="${chord}"
              title="${addTitle}">
              +
            </button>
          </div>
        </td>
      `;
    })
    .join("");

  element.innerHTML = `
    <div class="key-summary-card">
      <div class="key-summary-title">Key Details</div>
      <div class="key-summary-overview">
        <div class="key-summary-line">
          <strong class="key-summary-name">${formatKeyLabel(keyData.name)}</strong>
          <span class="key-summary-sep">|</span>
          <div class="key-summary-chord">
            <span class="key-summary-chord-name">${escapeHtml(formatChordLabel(keyData.equivalentChord))}</span>
            <button
              class="key-summary-play-btn"
              type="button"
              data-chord="${keyData.equivalentChord}"
              title="Play ${formatChordLabel(keyData.equivalentChord)}">
              Play
            </button>
          </div>
          <span class="key-summary-sep">|</span>
          <div class="key-summary-scale">
            <span class="key-label">Scale:</span>
            <span class="key-scale-notes">${keyData.scaleNotes.map(note => formatNoteLabel(note)).join(", ")}</span>
            <span
              class="key-scale-play"
              title="Play scale"
              aria-label="Play scale"
              role="button"
              tabindex="0"
            >
              🎶
            </span>
          </div>
        </div>
      </div>
      <div class="key-mode-details">
        <div class="key-mode-detail">
          <span class="key-label">Group:</span> ${escapeHtml(keyData.categoryLabel || keyData.category)}
        </div>
        <div class="key-mode-detail">
          <span class="key-label">Character:</span> ${escapeHtml(keyData.character)}
        </div>
        <div class="key-mode-detail">
          <span class="key-label">Parent family:</span> ${escapeHtml(keyData.parentFamilyLabel || keyData.parentFamily)}
        </div>
        <div class="key-mode-detail">
          <span class="key-label">Derived from:</span> ${escapeHtml(keyData.derivedFrom || keyData.parentScaleExample)}
        </div>
      </div>
    </div>

    <div class="key-chords-card">
      <div class="key-chords-title">Chords in ${formatKeyLabel(keyData.name)}</div>
      <div class="table-wrap">
        <table class="key-chords-table">
          <tbody>
            <tr>${headingRow}</tr>
            <tr>${functionRow}</tr>
            <tr>${chordRow}</tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (onChordClick) {
    element.querySelectorAll(".key-chord-main, .key-summary-play-btn").forEach(button => {
      button.addEventListener("click", () => {
        const chord = button.getAttribute("data-chord");
        if (chord) onChordClick(chord);
      });
    });
  }

  if (onChordAdd) {
    element.querySelectorAll(".key-chord-add-btn").forEach(button => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        const chord = button.getAttribute("data-chord");
        if (chord) onChordAdd(chord);
      });
    });
  }

  const scalePlay = element.querySelector(".key-scale-play");

  if (scalePlay && onPlayScale) {
    const triggerScalePlay = event => {
      event.preventDefault();
      event.stopPropagation();
      onPlayScale(keyData.scaleNotes);
    };

    scalePlay.addEventListener("click", triggerScalePlay);

    scalePlay.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        triggerScalePlay(event);
      }
    });
  }
}

const CHORD_VARIATION_GROUPS = [
  {
    title: "Core",
    suffixes: ["", "m", "5", "sus2", "sus4", "dim", "aug"]
  },
  {
    title: "Sevenths",
    suffixes: ["7", "Maj7", "m7", "mMaj7"]
  },
  {
    title: "Extended",
    suffixes: [
      "add9",
      "add11",
      "add13",
      "9",
      "11",
      "13",
      "Maj9",
      "Maj11",
      "Maj13",
      "m9",
      "m11",
      "m13"
    ]
  },
  {
    title: "Color",
    suffixes: ["m11b13", "13#11", "11b13", "Maj13#11"]
  },
  {
    title: "Altered",
    suffixes: ["m7b9b13", "m13b9", "m7b5b13", "m7b5b9b13", "Maj13#5#11", "7b5b9#9b13", "7#5b9#11b13"]
  }
];

export function renderChordLoader(element, rootNote, onPlay, onAdd) {
  element.innerHTML = "";

  if (!rootNote) {
    element.innerHTML = "<p style='color: var(--muted); margin: 0;'>Select a key to view chord options</p>";
    return;
  }

  CHORD_VARIATION_GROUPS.forEach(group => {
    const section = document.createElement("section");
    section.className = "chord-group";

    const title = document.createElement("h3");
    title.className = "chord-group-title";
    title.textContent = group.title;
    section.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "chord-group-grid";

    group.suffixes.forEach(suffix => {
      const chordName = rootNote + suffix;
      const displayChordName = formatChordLabel(chordName);

      const wrapper = document.createElement("div");
      wrapper.className = "chord-button-wrapper";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "chord-btn";
      button.textContent = displayChordName;

      button.addEventListener("click", async () => {
        element.querySelectorAll(".chord-btn").forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        if (onPlay) await onPlay(chordName);
      });
      button.dataset.tooltip = `Play ${displayChordName}`;

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "chord-add-btn";
      addBtn.textContent = "+";
      addBtn.dataset.tooltip = `Add ${displayChordName} to progression`;

      addBtn.addEventListener("click", event => {
        event.stopPropagation();
        if (onAdd) onAdd(chordName);
      });

      wrapper.appendChild(button);
      wrapper.appendChild(addBtn);
      grid.appendChild(wrapper);
    });

    section.appendChild(grid);
    element.appendChild(section);
  });
}

export function initTooltips() {
  const tip = document.createElement("div");
  tip.className = "app-tooltip";
  tip.setAttribute("aria-hidden", "true");
  document.body.appendChild(tip);

  function position(event) {
    const margin = 12;
    let x = event.clientX + margin;
    let y = event.clientY - 34;
    if (x + tip.offsetWidth > window.innerWidth - 8) x = event.clientX - tip.offsetWidth - margin;
    if (y < 8) y = event.clientY + margin;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  document.addEventListener("mouseover", event => {
    const el = event.target.closest("[data-tooltip]");
    if (!el) {
      tip.style.display = "none";
      return;
    }
    tip.textContent = el.dataset.tooltip;
    tip.style.display = "block";
    position(event);
  });

  document.addEventListener("mousemove", event => {
    if (tip.style.display === "block") position(event);
  });

  document.addEventListener("mouseout", event => {
    if (!event.relatedTarget || !event.relatedTarget.closest("[data-tooltip]")) {
      tip.style.display = "none";
    }
  });
}
