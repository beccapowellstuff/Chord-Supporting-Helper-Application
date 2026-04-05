import { NOTE_TO_PC, parseChordName } from "./chordNotes.js";

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
 *          getFriendlyChordName, getComparisonChord, isComparisonChordInKey
 * Depends on: nothing (pure DOM, receives all data and callbacks as arguments)
 */
const FRIENDLY_ROOT_MAP = {
  "B#": "C",
  Cb: "B",
  "E#": "F",
  Fb: "E"
};
const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

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
  "madd13",
  "madd11",
  "madd9",
  "Maj13",
  "Maj11",
  "Maj9",
  "Maj7",
  "9sus4",
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

const DISPLAY_SUFFIX_ALIASES = {
  "11": "9sus4",
  "11b13": "9sus4b13"
};
const ENABLE_RELATED_KEY_MATCHES = true;

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
  const rawSuffix = DISPLAY_SUFFIX_ALIASES[String(suffix || "").trim()] || String(suffix || "").trim();

  if (!rawSuffix) {
    return "";
  }

  if (rawSuffix === "dim") {
    return "\u00b0";
  }

  if (rawSuffix === "mMaj7") {
    return "m(maj7)";
  }

  if (rawSuffix === "madd9") {
    return "m(add9)";
  }

  if (rawSuffix === "madd11") {
    return "m(add11)";
  }

  if (rawSuffix === "madd13") {
    return "m(add13)";
  }

  if (rawSuffix === "mMaj7add13") {
    return "m(maj7,13)";
  }

  if (rawSuffix.startsWith("mMaj7")) {
    const tail = rawSuffix.slice("mMaj7".length);
    if (/^(?:[b#](?:5|9|11|13))+$/i.test(tail)) {
      return `m(maj7,${formatAlterationList(tail)})`;
    }
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

export function formatChordLabel(chord) {
  const parsed = parseChordName(chord);
  if (parsed) {
    return `${formatNoteLabel(parsed.root)}${formatChordSuffixLabel(parsed.suffix)}${parsed.bass ? `/${formatNoteLabel(parsed.bass)}` : ""}`;
  }

  const match = /^([A-G](?:#{1,2}|b{1,2})?)(.*)$/.exec(String(chord || "").trim());
  if (!match) {
    return formatChordSuffixLabel(chord);
  }

  const [, root, suffix] = match;
  return `${formatNoteLabel(root)}${formatChordSuffixLabel(suffix)}`;
}

function getChordLoaderDisplayParts(chord) {
  const label = formatChordLabel(chord);
  const splitIndex = label.indexOf("(");

  if (splitIndex === -1 || !label.endsWith(")")) {
    const slashIndex = label.lastIndexOf("/");
    if (splitIndex !== -1 && slashIndex > splitIndex) {
      const detail = label.slice(splitIndex, slashIndex);
      if (detail.includes(",")) {
        return {
          main: `${label.slice(0, splitIndex)}${label.slice(slashIndex)}`,
          detail
        };
      }
    }

    return { main: label, detail: "" };
  }

  const detail = label.slice(splitIndex);
  if (!detail.includes(",")) {
    return { main: label, detail: "" };
  }

  return {
    main: label.slice(0, splitIndex),
    detail
  };
}

function getChordButtonLabelHtml(chord) {
  const displayParts = getChordLoaderDisplayParts(chord);
  return `
    <span class="chord-btn-main">${escapeHtml(displayParts.main)}</span>
    ${displayParts.detail ? `<span class="chord-btn-detail">${escapeHtml(displayParts.detail)}</span>` : ""}
  `;
}

function getIntervalLabel(interval) {
  const labels = {
    0: "1",
    1: "b2",
    2: "2",
    3: "b3",
    4: "3",
    5: "4",
    6: "b5",
    7: "5",
    8: "#5",
    9: "6",
    10: "b7",
    11: "7",
    13: "b9",
    14: "9",
    15: "#9",
    17: "11",
    18: "#11",
    20: "b13",
    21: "13"
  };

  return labels[interval] || String(interval);
}

function getTooltipNoteLabel(root, interval, intervalLabel) {
  const rootPc = NOTE_TO_PC[root];
  if (rootPc == null) {
    return root;
  }

  const preferFlats = root.includes("b") || intervalLabel.includes("b");
  const noteNames = preferFlats ? FLAT_NOTES : SHARP_NOTES;
  return noteNames[(rootPc + interval + 120) % 12];
}

function getChordTypeLabel(suffix) {
  const typeLabels = {
    "": "Major triad",
    "5": "Power chord",
    "7": "Dominant seventh",
    "7b5": "Dominant flat five",
    "9": "Dominant ninth",
    "13": "Dominant thirteenth",
    "9sus4": "Suspended dominant",
    "9sus4b13": "Suspended dominant",
    "Maj7": "Major seventh",
    "Maj9": "Major ninth",
    "Maj11": "Major eleventh",
    "Maj13": "Major thirteenth",
    "Maj13#11": "Lydian major",
    "Maj13#5#11": "Altered major",
    "m": "Minor triad",
    "m7": "Minor seventh",
    "m7b5": "Half-diminished seventh",
    "m9": "Minor ninth",
    "m11": "Minor eleventh",
    "m13": "Minor thirteenth",
    "madd13": "Minor added thirteenth",
    "madd11": "Minor added eleventh",
    "madd9": "Minor added ninth",
    "mMaj7": "Minor major seventh",
    "mMaj7add13": "Minor major seventh",
    "mMaj7b13": "Minor major seventh",
    "m11b13": "Minor colour chord",
    "m13b9": "Altered minor",
    "m7b9b13": "Altered minor",
    "m7b5b13": "Half-diminished colour chord",
    "m7b5b9b13": "Altered half-diminished",
    "13#11": "Lydian dominant",
    "11b13": "Suspended dominant",
    "7b5b9#9b13": "Altered dominant",
    "7#5b9#11b13": "Altered dominant",
    "add9": "Added ninth",
    "add11": "Added eleventh",
    "add13": "Added thirteenth",
    "sus2": "Suspended second",
    "sus4": "Suspended fourth",
    "dim": "Diminished triad",
    "aug": "Augmented triad",
    "alt": "Altered dominant",
    "7alt": "Altered dominant"
  };

  return typeLabels[suffix] || "Extended chord";
}

function getChordTooltipText(chord) {
  const parsed = parseChordName(chord);
  if (!parsed) {
    return `Play ${formatChordLabel(chord)}`;
  }

  const notes = [
    ...(parsed.bass ? [formatNoteLabel(parsed.bass)] : []),
    ...parsed.intervals
    .map(interval => {
      const intervalLabel = getIntervalLabel(interval);
      return formatNoteLabel(getTooltipNoteLabel(parsed.root, interval, intervalLabel));
    })
  ]
    .join(" ");

  const intervals = parsed.intervals
    .map(interval => formatAccidentalDisplay(getIntervalLabel(interval)))
    .join(" ");

  return [
    `Play ${formatChordLabel(chord)}`,
    `Notes: ${notes}`,
    `Intervals: ${intervals}`,
    getChordTypeLabel(parsed.suffix)
  ].join("\n");
}

function getChordFeelLabel(matchLevel) {
  if (matchLevel === "primary") {
    return "Safe";
  }

  if (matchLevel === "related") {
    return "Interesting";
  }

  return "Tension";
}

export function getComparisonChord(chordName) {
  const parsed = parseChordName(chordName);
  if (!parsed) {
    return String(chordName || "").trim();
  }

  const { root, suffix } = parsed;

  if (suffix.startsWith("m7b5") || suffix === "dim") {
    return `${root}dim`;
  }

  if (suffix === "aug") {
    return `${root}aug`;
  }

  if (suffix.startsWith("m")) {
    return `${root}m`;
  }

  return root;
}

export function isComparisonChordInKey(comparisonChord, keyChordSet) {
  if (!comparisonChord || !Array.isArray(keyChordSet) || !keyChordSet.length) {
    return false;
  }

  const keyComparisonSet = new Set(keyChordSet.map(chord => getComparisonChord(chord)));
  return keyComparisonSet.has(comparisonChord);
}

function getExactChordMatch(chordName, keyChordSet) {
  if (!Array.isArray(keyChordSet) || !keyChordSet.length) {
    return false;
  }

  const parsed = parseChordName(chordName);
  const baseChordName = parsed ? `${parsed.root}${parsed.suffix}` : String(chordName || "").trim();
  return keyChordSet.includes(baseChordName);
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

function formatSelectorOptionLabel(option) {
  const label = String(option?.label || "").trim();
  return label;
}

function formatSelectionSummaryCode(inversionOption, voicingOption) {
  const inversionCode = String(inversionOption?.shortLabel || "").trim().toLowerCase();
  const voicingCode = String(voicingOption?.shortLabel || "").trim().toLowerCase();
  const inversionLabel = String(inversionOption?.label || "").trim();
  const voicingLabel = String(voicingOption?.label || "").trim();
  const showInversion = inversionCode && inversionLabel && inversionLabel !== "Root";
  const showVoicing = voicingCode && voicingLabel && voicingLabel !== "Close";

  return `${showInversion ? inversionCode : ""}${showVoicing ? voicingCode : ""}`;
}

function getSelectionBarState(selectionController) {
  const selectedChord = typeof selectionController?.getSelectedChord === "function"
    ? selectionController.getSelectedChord()
    : "";
  const selectedInversionValue = typeof selectionController?.getSelectedInversionValue === "function"
    ? String(selectionController.getSelectedInversionValue() ?? "0")
    : "0";
  const selectedVoicingValue = typeof selectionController?.getSelectedVoicingValue === "function"
    ? String(selectionController.getSelectedVoicingValue() ?? "close")
    : "close";
  const selectedInversionOptions = selectedChord && typeof selectionController?.getInversionOptions === "function"
    ? selectionController.getInversionOptions(selectedChord)
    : [];
  const selectedVoicingOptions = selectedChord && typeof selectionController?.getVoicingOptions === "function"
    ? selectionController.getVoicingOptions(selectedChord)
    : [];
  const selectedInversionOption =
    selectedInversionOptions.find(option => option.value === selectedInversionValue) || null;
  const selectedVoicingOption =
    selectedVoicingOptions.find(option => option.value === selectedVoicingValue) || null;

  return {
    selectedChord,
    selectedInversionValue,
    selectedVoicingValue,
    selectedInversionOptions,
    selectedVoicingOptions,
    selectedInversionOption,
    selectedVoicingOption,
    selectedSummaryCode: selectedChord
      ? formatSelectionSummaryCode(selectedInversionOption, selectedVoicingOption)
      : ""
  };
}

function buildSelectionBarMarkup({
  selectedChord = "",
  selectedInversionValue = "0",
  selectedVoicingValue = "close",
  selectedInversionOptions = [],
  selectedVoicingOptions = [],
  selectedInversionOption = null,
  selectedVoicingOption = null,
  selectedSummaryCode = "",
  placeholderText = "Play a chord to choose inversion and voicing"
} = {}) {
  return `
    <div class="key-mode-selection-bar ${selectedChord ? "" : "key-mode-selection-bar-idle"}">
      <div class="key-mode-selection-current">
        <span class="key-mode-selection-current-label">Chord Playing:</span>
        ${selectedChord
          ? `<span class="key-mode-selection-current-name">${escapeHtml(formatChordLabel(selectedChord))}</span>`
          : `<span class="key-mode-selection-current-placeholder">${escapeHtml(placeholderText)}</span>`}
      </div>
      <div class="key-mode-selection-controls">
        <label class="key-mode-selection-field">
          <span class="key-mode-selection-field-label">Inversion</span>
          <select
            class="key-mode-chord-inversion-select"
            ${selectedChord ? `data-selected-chord="${escapeHtml(selectedChord)}"` : ""}
            aria-label="${selectedChord ? `Choose inversion for ${escapeHtml(formatChordLabel(selectedChord))}` : "Choose inversion"}"
            ${selectedChord && selectedInversionOptions.length ? "" : "disabled"}>
            ${selectedChord && selectedInversionOptions.length
              ? selectedInversionOptions.map(option => `
                  <option value="${escapeHtml(option.value)}" ${option.value === selectedInversionValue ? "selected" : ""}>${escapeHtml(formatSelectorOptionLabel(option))}</option>
                `).join("")
              : `<option value="">Select chord first</option>`}
          </select>
        </label>
        <label class="key-mode-selection-field">
          <span class="key-mode-selection-field-label">Voicing</span>
          <select
            class="key-mode-chord-voicing-select"
            ${selectedChord ? `data-selected-chord="${escapeHtml(selectedChord)}"` : ""}
            aria-label="${selectedChord ? `Choose voicing for ${escapeHtml(formatChordLabel(selectedChord))}` : "Choose voicing"}"
            ${selectedChord && selectedVoicingOptions.length ? "" : "disabled"}>
            ${selectedChord && selectedVoicingOptions.length
              ? selectedVoicingOptions.map(option => `
                  <option value="${escapeHtml(option.value)}" ${option.value === selectedVoicingValue ? "selected" : ""}>${escapeHtml(formatSelectorOptionLabel(option))}</option>
                `).join("")
              : `<option value="">Select chord first</option>`}
          </select>
        </label>
        ${selectedSummaryCode
          ? `<span class="key-mode-selection-summary-code" title="${escapeHtml(`${selectedInversionOption?.label || ""} • ${selectedVoicingOption?.label || ""}`)}">${escapeHtml(selectedSummaryCode)}</span>`
          : ""}
      </div>
    </div>
  `;
}

function appendSelectionBar(container, selectionController, placeholderText) {
  const barHost = document.createElement("div");
  barHost.innerHTML = buildSelectionBarMarkup({
    ...getSelectionBarState(selectionController),
    placeholderText
  });
  const selectionBar = barHost.firstElementChild;
  if (selectionBar) {
    container.appendChild(selectionBar);
  }
}

function bindSelectionBarInteractions(container, selectionController) {
  if (typeof selectionController?.playSelection !== "function") {
    return;
  }

  container.querySelectorAll(".key-mode-chord-inversion-select, .key-mode-chord-voicing-select").forEach(select => {
    select.addEventListener("change", () => {
      const selectionBar = select.closest(".key-mode-selection-bar");
      const chord = select.getAttribute("data-selected-chord");
      const inversionValue = selectionBar?.querySelector(".key-mode-chord-inversion-select")?.value || "0";
      const voicingValue = selectionBar?.querySelector(".key-mode-chord-voicing-select")?.value || "close";
      if (!selectionBar || !chord) {
        return;
      }

      selectionController.playSelection(chord, inversionValue, voicingValue);
    });
  });
}

export function getFriendlyChordName(chord) {
  const parsed = parseChordName(chord);
  if (parsed) {
    const friendlyRoot = FRIENDLY_ROOT_MAP[parsed.root] || parsed.root;
    const friendlyBass = parsed.bass ? (FRIENDLY_ROOT_MAP[parsed.bass] || parsed.bass) : "";
    return `${friendlyRoot}${parsed.suffix}${friendlyBass ? `/${friendlyBass}` : ""}`;
  }

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
    if (typeof onChordClick?.playSelection === "function") {
      if (typeof onChordClick.selectChord === "function") {
        onChordClick.selectChord(item.chord);
      }
      onChordClick.playSelection(item.chord, "0", "close");
      return;
    }

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

const SUGGESTION_BUCKET_ORDER = [
  {
    id: "inKey",
    title: "In Key",
    description: "Grounded moves from the current key and mode."
  },
  {
    id: "related",
    title: "Related",
    description: "Borrowed or parallel colours that still stay close."
  },
  {
    id: "outside",
    title: "Out of Key",
    description: "Bolder chromatic or applied moves."
  }
];

function createSuggestionCard(item, detailHost, onChordClick, onChordAdd, setActiveCard, getActiveCard) {
  const card = document.createElement("div");
  card.className = "suggestion-card";
  card.dataset.bucket = item.bucket || "inKey";

  const chordBtn = document.createElement("button");
  chordBtn.className = "suggestion-card-chord";
  chordBtn.dataset.tooltip = `Play ${formatChordLabel(item.chord)}`;
  chordBtn.type = "button";
  appendChordLabelContent(chordBtn, item.chord);

  const showDetail = () => {
    const activeCard = getActiveCard();
    if (activeCard) {
      activeCard.classList.remove("active");
    }
    setActiveCard(card);
    card.classList.add("active");
    detailHost.innerHTML = "";
    detailHost.appendChild(createSuggestionDetail(item, onChordClick, onChordAdd));
  };

  chordBtn.addEventListener("click", event => {
    event.stopPropagation();
    showDetail();
    if (typeof onChordClick?.playSelection === "function") {
      if (typeof onChordClick.selectChord === "function") {
        onChordClick.selectChord(item.chord);
      }
      onChordClick.playSelection(item.chord, "0", "close");
      return;
    }

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
  return card;
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

  SUGGESTION_BUCKET_ORDER.forEach(bucket => {
    const bucketSuggestions = suggestions.filter(item => (item.bucket || "inKey") === bucket.id);
    if (!bucketSuggestions.length) {
      return;
    }

    const section = document.createElement("section");
    section.className = "suggestion-bucket";
    section.dataset.suggestionBucket = bucket.id;

    const header = document.createElement("div");
    header.className = "suggestion-bucket-header";

    const title = document.createElement("div");
    title.className = "suggestion-bucket-title";
    title.textContent = bucket.title;

    const description = document.createElement("div");
    description.className = "suggestion-bucket-description";
    description.textContent = bucket.description;

    header.appendChild(title);
    header.appendChild(description);
    section.appendChild(header);

    const bucketGrid = grid.cloneNode(false);
    bucketSuggestions.forEach(item => {
      bucketGrid.appendChild(createSuggestionCard(
        item,
        detailHost,
        onChordClick,
        onChordAdd,
        card => {
          activeCard = card;
        },
        () => activeCard
      ));
    });

    section.appendChild(bucketGrid);
    wrapper.appendChild(section);
  });

  appendSelectionBar(wrapper, onChordClick, "Play a chord to choose inversion and voicing");
  wrapper.appendChild(detailHost);
  resultsElement.appendChild(wrapper);
  bindSelectionBarInteractions(wrapper, onChordClick);
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

  const {
    selectedChord,
    selectedInversionValue,
    selectedVoicingValue,
    selectedInversionOptions,
    selectedVoicingOptions,
    selectedInversionOption,
    selectedVoicingOption,
    selectedSummaryCode
  } = getSelectionBarState(onChordClick);
  const degreeLabels = (keyData.degreeLabels || []).map((roman, index) => [
    roman,
    keyData.degreeDescriptions?.[index] || ""
  ]);
  const chordCards = keyData.chords
    .map((chord, index) => {
      const [roman, functionName] = degreeLabels[index] || ["", ""];
      const displayParts = getChordLoaderDisplayParts(chord);
      const playTitle = escapeHtml(getChordTooltipText(chord));
      const addTitle = escapeHtml(`Add ${formatChordLabel(chord)} to progression`);
      const selectedClass = selectedChord && chord === selectedChord ? " key-mode-chord-card-selected" : "";

      return `
        <div class="key-mode-chord-card${selectedClass}">
          <div class="key-mode-chord-meta">
            <div class="key-mode-chord-roman">${formatRomanNumeralLabel(roman)}</div>
            <div class="key-mode-chord-degree">${escapeHtml(functionName)}</div>
          </div>
          <div class="key-mode-chord-actions">
            <button
              class="key-mode-chord-play ${displayParts.detail ? "chord-btn-two-line" : ""}"
              type="button"
              data-chord="${escapeHtml(chord)}"
              data-tooltip="${playTitle}">
              ${getChordButtonLabelHtml(chord)}
            </button>
            <button
              class="key-mode-chord-add-btn"
              type="button"
              data-chord="${escapeHtml(chord)}"
              data-tooltip="${addTitle}">
              +
            </button>
          </div>
        </div>
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
            <span class="key-label">Tonic chord:</span>
            <button
              class="key-summary-chord-btn"
              type="button"
              data-chord="${keyData.tonicChord}"
              title="Play ${formatChordLabel(keyData.tonicChord)}"
              aria-label="Play ${formatChordLabel(keyData.tonicChord)}">
              ${escapeHtml(formatChordLabel(keyData.tonicChord))}
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
          ${keyData.characteristicNote?.note ? `
            <span class="key-summary-sep">|</span>
            <div class="key-summary-characteristic">
              <span class="key-label">Characteristic note:</span>
              <span class="key-summary-characteristic-note">
                ${formatNoteLabel(keyData.characteristicNote.note)}
                <span class="key-summary-characteristic-degree">(${formatAccidentalDisplay(keyData.characteristicNote.degree)})</span>
              </span>
            </div>
          ` : ""}
        </div>
        <div class="key-summary-help">
          Tonic chord shows a common chord quality built on the mode's root. Characteristic note shows the scale tone that most helps define the mode's flavour.
        </div>
      </div>
      <div class="key-mode-details">
        <div class="key-mode-detail">
          <span class="key-mode-detail-label">Group</span>
          <span class="key-mode-detail-value">${escapeHtml(keyData.categoryLabel || keyData.category)}</span>
        </div>
        <div class="key-mode-detail">
          <span class="key-mode-detail-label">Character</span>
          <span class="key-mode-detail-value">${escapeHtml(keyData.character)}</span>
        </div>
        <div class="key-mode-detail">
          <span class="key-mode-detail-label">Parent family</span>
          <span class="key-mode-detail-value">${escapeHtml(keyData.parentFamilyLabel || keyData.parentFamily)}</span>
        </div>
        <div class="key-mode-detail">
          <span class="key-mode-detail-label">Derived from</span>
          <span class="key-mode-detail-value">${escapeHtml(keyData.derivedFrom || keyData.parentScaleExample)}</span>
        </div>
      </div>
    </div>

    <div class="key-chords-card">
      <div class="key-chords-title">Chords in ${formatKeyLabel(keyData.name)}</div>
      <div class="key-mode-chords-grid">
        ${chordCards}
      </div>
      <div class="key-mode-selection-bar ${selectedChord ? "" : "key-mode-selection-bar-idle"}">
        <div class="key-mode-selection-current">
          <span class="key-mode-selection-current-label">Chord Playing:</span>
          ${selectedChord
            ? `<span class="key-mode-selection-current-name">${escapeHtml(formatChordLabel(selectedChord))}</span>`
            : `<span class="key-mode-selection-current-placeholder">Play a chord to choose inversion and voicing</span>`}
        </div>
        <div class="key-mode-selection-controls">
          <label class="key-mode-selection-field">
            <span class="key-mode-selection-field-label">Inversion</span>
            <select
              class="key-mode-chord-inversion-select"
              ${selectedChord ? `data-selected-chord="${escapeHtml(selectedChord)}"` : ""}
              aria-label="${selectedChord ? `Choose inversion for ${escapeHtml(formatChordLabel(selectedChord))}` : "Choose inversion"}"
              ${selectedChord && selectedInversionOptions.length ? "" : "disabled"}>
              ${selectedChord && selectedInversionOptions.length
                ? selectedInversionOptions.map(option => `
                    <option value="${escapeHtml(option.value)}" ${option.value === selectedInversionValue ? "selected" : ""}>${escapeHtml(formatSelectorOptionLabel(option))}</option>
                  `).join("")
                : `<option value="">Select chord first</option>`}
            </select>
          </label>
          <label class="key-mode-selection-field">
            <span class="key-mode-selection-field-label">Voicing</span>
            <select
              class="key-mode-chord-voicing-select"
              ${selectedChord ? `data-selected-chord="${escapeHtml(selectedChord)}"` : ""}
              aria-label="${selectedChord ? `Choose voicing for ${escapeHtml(formatChordLabel(selectedChord))}` : "Choose voicing"}"
              ${selectedChord && selectedVoicingOptions.length ? "" : "disabled"}>
              ${selectedChord && selectedVoicingOptions.length
                ? selectedVoicingOptions.map(option => `
                    <option value="${escapeHtml(option.value)}" ${option.value === selectedVoicingValue ? "selected" : ""}>${escapeHtml(formatSelectorOptionLabel(option))}</option>
                  `).join("")
                : `<option value="">Select chord first</option>`}
            </select>
          </label>
          ${selectedSummaryCode
            ? `<span class="key-mode-selection-summary-code" title="${escapeHtml(`${selectedInversionOption?.label || ""} • ${selectedVoicingOption?.label || ""}`)}">${escapeHtml(selectedSummaryCode)}</span>`
            : ""}
        </div>
      </div>
    </div>
  `;

  if (onChordClick) {
    element.querySelectorAll(".key-mode-chord-play").forEach(button => {
      button.addEventListener("click", () => {
        const chord = button.getAttribute("data-chord");
        if (!chord) {
          return;
        }

        if (typeof onChordClick.playSelection === "function") {
          if (typeof onChordClick.selectChord === "function") {
            onChordClick.selectChord(chord);
          }
          onChordClick.playSelection(chord, "0", "close");
          return;
        }

        onChordClick(chord);
      });
    });

    element.querySelectorAll(".key-summary-chord-btn").forEach(button => {
      button.addEventListener("click", () => {
        const chord = button.getAttribute("data-chord");
        if (chord) {
          onChordClick(chord);
        }
      });
    });

    if (typeof onChordClick.playSelection === "function") {
      element.querySelectorAll(".key-mode-chord-inversion-select, .key-mode-chord-voicing-select").forEach(select => {
        select.addEventListener("change", () => {
          const selectionBar = select.closest(".key-mode-selection-bar");
          const chord = select.getAttribute("data-selected-chord");
          const inversionValue = selectionBar?.querySelector(".key-mode-chord-inversion-select")?.value || "0";
          const voicingValue = selectionBar?.querySelector(".key-mode-chord-voicing-select")?.value || "close";
          if (!selectionBar || !chord) {
            return;
          }

          onChordClick.playSelection(chord, inversionValue, voicingValue);
        });
      });
    }
  }

  if (onChordAdd) {
    element.querySelectorAll(".key-mode-chord-add-btn").forEach(button => {
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

const CHORD_LOADER_FILTERS = [
  { value: "common", label: "Common Chords", tooltip: "Show the most commonly used chords" },
  { value: "advanced", label: "Advanced Chords", tooltip: "Show richer and less common chords" },
  { value: "all", label: "All Chords", tooltip: "Browse every chord" }
];

let activeChordLoaderFilter = "common";

const CHORD_VARIATION_GROUPS = [
  {
    title: "Core",
    emphasis: "strong",
    filterModes: ["all", "common"],
    suffixes: ["", "m", "5", "sus2", "sus4", "dim", "aug"]
  },
  {
    title: "Sevenths",
    emphasis: "normal",
    filterModes: ["all", "common"],
    suffixes: ["7", "Maj7", "m7", "mMaj7"]
  },
  {
    title: "Extended",
    emphasis: "soft",
    filterModes: ["all", "common"],
    suffixes: [
      "add9",
      "add11",
      "add13",
      "madd9",
      "madd11",
      "madd13",
      "9",
      "9sus4",
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
    title: "Colour",
    emphasis: "softer",
    filterModes: ["all", "advanced"],
    suffixes: ["m11b13", "13#11", "9sus4b13", "Maj13#11"]
  },
  {
    title: "Altered",
    emphasis: "lowest",
    filterModes: ["all", "advanced"],
    suffixes: ["m7b9b13", "m13b9", "m7b5b13", "m7b5b9b13", "Maj13#5#11", "7b5b9#9b13", "7#5b9#11b13"]
  }
];

const CHORD_GROUP_LAYOUT_ROWS = [
  ["Core", "Sevenths"],
  ["Extended"],
  ["Colour", "Altered"]
];

function shouldShowChordGroup(group) {
  return group.filterModes.includes(activeChordLoaderFilter);
}

function slugifyChordGroupTitle(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function buildChordGroupSection(group, rootNote, bassRoot, keyChordSet, onPlay, onAdd) {
  const hasActiveKeyContext = Array.isArray(keyChordSet) && keyChordSet.length === 7;
  const section = document.createElement("section");
  const titleSlug = slugifyChordGroupTitle(group.title);
  section.className = `chord-group chord-group-${group.emphasis} chord-group-${titleSlug}`;

  const title = document.createElement("h3");
  title.className = "chord-group-title";
  title.textContent = group.title;
  section.appendChild(title);

  const grid = document.createElement("div");
  grid.className = `chord-group-grid chord-group-grid-${titleSlug}`;

  group.suffixes.forEach(suffix => {
    const slashBass = bassRoot && bassRoot !== rootNote ? `/${bassRoot}` : "";
    const chordName = `${rootNote}${suffix}${slashBass}`;
    const comparisonChord = getComparisonChord(chordName);
    const isInKey = hasActiveKeyContext && getExactChordMatch(chordName, keyChordSet);
    const isRelatedToKey =
      hasActiveKeyContext &&
      ENABLE_RELATED_KEY_MATCHES &&
      !isInKey &&
      isComparisonChordInKey(comparisonChord, keyChordSet);
    const matchLevel = isInKey ? "primary" : isRelatedToKey ? "related" : "none";
    const displayChordName = formatChordLabel(chordName);
    const displayParts = getChordLoaderDisplayParts(chordName);

    const wrapper = document.createElement("div");
    wrapper.className = "chord-button-wrapper";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "chord-btn";

    const mainLabel = document.createElement("span");
    mainLabel.className = "chord-btn-main";
    mainLabel.textContent = displayParts.main;
    button.appendChild(mainLabel);

    if (displayParts.detail) {
      button.classList.add("chord-btn-two-line");
      const detailLabel = document.createElement("span");
      detailLabel.className = "chord-btn-detail";
      detailLabel.textContent = displayParts.detail;
      button.appendChild(detailLabel);
    }

    button.addEventListener("click", async () => {
      document.querySelectorAll(".chord-btn").forEach(btn => btn.classList.remove("active"));
      button.classList.add("active");
      try {
        if (typeof onPlay?.playSelection === "function") {
          if (typeof onPlay.selectChord === "function") {
            onPlay.selectChord(chordName);
          }
          await onPlay.playSelection(chordName, "0", "close");
          return;
        }

        if (onPlay) await onPlay(chordName);
      } finally {
        button.classList.remove("active");
      }
    });
    button.dataset.tooltip = `${getChordTooltipText(chordName)}\nFeel: ${getChordFeelLabel(matchLevel)}`;
    button.dataset.comparisonChord = comparisonChord;
    button.dataset.isInKey = String(isInKey);
    button.dataset.isRelatedToKey = String(isRelatedToKey);
    button.dataset.matchLevel = matchLevel;
    button.dataset.scaleFeel = getChordFeelLabel(matchLevel);
    button.isInKey = isInKey;
    button.isRelatedToKey = isRelatedToKey;

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
  return section;
}

export function renderChordLoader(element, rootNote, bassRoot, keyChordSet, onPlay, onAdd) {
  element.innerHTML = "";
  const hasActiveKeyContext = Array.isArray(keyChordSet) && keyChordSet.length === 7;
  element.dataset.hasKeyContext = String(hasActiveKeyContext);

  if (!rootNote) {
    element.innerHTML = "<p style='color: var(--muted); margin: 0;'>Select a key to view chord options</p>";
    return;
  }

  const filterBar = document.createElement("div");
  filterBar.className = "chord-loader-filters";

  CHORD_LOADER_FILTERS.forEach(filter => {
    const filterButton = document.createElement("button");
    filterButton.type = "button";
    filterButton.className = "chord-loader-filter-btn";
    if (filter.value === activeChordLoaderFilter) {
      filterButton.classList.add("active");
    }
    filterButton.textContent = filter.label;
    filterButton.dataset.tooltip = filter.tooltip;
    filterButton.addEventListener("click", () => {
      if (activeChordLoaderFilter === filter.value) {
        return;
      }

      activeChordLoaderFilter = filter.value;
      renderChordLoader(element, rootNote, bassRoot, keyChordSet, onPlay, onAdd);
    });
    filterBar.appendChild(filterButton);
  });

  element.appendChild(filterBar);

  const visibleGroups = CHORD_VARIATION_GROUPS.filter(shouldShowChordGroup);
  const groupsByTitle = new Map(visibleGroups.map(group => [group.title, group]));

  CHORD_GROUP_LAYOUT_ROWS.forEach(rowTitles => {
    const rowGroups = rowTitles
      .map(title => groupsByTitle.get(title))
      .filter(Boolean);

    if (!rowGroups.length) {
      return;
    }

    const row = document.createElement("div");
    row.className = `chord-group-row ${rowGroups.length > 1 ? "chord-group-row-paired" : "chord-group-row-single"}`;

    rowGroups.forEach(group => {
      row.appendChild(buildChordGroupSection(group, rootNote, bassRoot, keyChordSet, onPlay, onAdd));
    });

    element.appendChild(row);
  });

  appendSelectionBar(element, onPlay, "Play a chord to choose inversion and voicing");
  bindSelectionBarInteractions(element, onPlay);
}

export function initTooltips() {
  const tip = document.createElement("div");
  tip.className = "app-tooltip";
  tip.setAttribute("aria-hidden", "true");
  document.body.appendChild(tip);
  let activeTooltipElement = null;

  function position(target, event = null) {
    if (!target) return;

    const margin = 12;
    const rect = target.getBoundingClientRect();
    let x = rect.left + (rect.width / 2) - (tip.offsetWidth / 2);
    let y = rect.top - tip.offsetHeight - margin;

    if (x < 8) {
      x = 8;
    }

    if (x + tip.offsetWidth > window.innerWidth - 8) {
      x = window.innerWidth - tip.offsetWidth - 8;
    }

    if (y < 8) {
      y = rect.bottom + margin;
    }

    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }

  document.addEventListener("mouseover", event => {
    const el = event.target.closest("[data-tooltip]");
    if (!el) {
      tip.style.display = "none";
      activeTooltipElement = null;
      return;
    }
    activeTooltipElement = el;
    tip.textContent = el.dataset.tooltip;
    tip.style.display = "block";
    position(el, event);
  });

  document.addEventListener("mousemove", event => {
    if (tip.style.display === "block" && activeTooltipElement) {
      position(activeTooltipElement, event);
    }
  });

  document.addEventListener("mouseout", event => {
    if (!event.relatedTarget || !event.relatedTarget.closest("[data-tooltip]")) {
      tip.style.display = "none";
      activeTooltipElement = null;
    }
  });
}
