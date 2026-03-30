import { parseProgression } from "./engine.js";
import { parseChordName } from "./chordNotes.js";
import { formatChordLabel } from "./ui.js";

let nextProgressionItemId = 1;
export const DEFAULT_TEMPO_BPM = 120;
export const DEFAULT_TIME_SIGNATURE = "4/4";
const DEFAULT_DURATION_BEATS = 4;
const MIN_DURATION_BEATS = 1;
const MAX_DURATION_BEATS = 8;
const SUPPORTED_TIME_SIGNATURES = new Set(["2/4", "3/4", "4/4"]);

function createProgressionItemId() {
  return `progression-item-${nextProgressionItemId++}`;
}

export function normalizeTempoBpm(tempoBpm, fallback = DEFAULT_TEMPO_BPM) {
  const numericTempo = Number(tempoBpm);
  if (!Number.isFinite(numericTempo)) {
    return fallback;
  }

  return Math.max(40, Math.min(240, Math.round(numericTempo)));
}

export function normalizeTimeSignature(timeSignature, fallback = DEFAULT_TIME_SIGNATURE) {
  const signature = String(timeSignature || "").trim();
  if (SUPPORTED_TIME_SIGNATURES.has(signature)) {
    return signature;
  }

  return fallback;
}

export function getBeatsPerBar(timeSignature = DEFAULT_TIME_SIGNATURE) {
  const normalizedSignature = normalizeTimeSignature(timeSignature);
  const numerator = Number.parseInt(normalizedSignature.split("/")[0], 10);
  return Number.isFinite(numerator) ? numerator : DEFAULT_DURATION_BEATS;
}

function normalizeDurationBeats(durationBeats, fallback = DEFAULT_DURATION_BEATS) {
  const numericDuration = Number(durationBeats);
  if (!Number.isFinite(numericDuration)) {
    return fallback;
  }

  return Math.max(MIN_DURATION_BEATS, Math.min(MAX_DURATION_BEATS, numericDuration));
}

function getDefaultDurationBeats(sequenceSettings = {}) {
  return getBeatsPerBar(sequenceSettings.timeSignature);
}

function normalizeSustain(sustain, fallback = false) {
  if (typeof sustain === "boolean") {
    return sustain;
  }

  if (sustain == null) {
    return fallback;
  }

  return sustain === "true" || sustain === 1 || sustain === "1";
}

function getExistingDurationBeats(existingItem, sequenceSettings = {}) {
  if (existingItem?.durationBeats != null) {
    return normalizeDurationBeats(existingItem.durationBeats, getDefaultDurationBeats(sequenceSettings));
  }

  if (existingItem?.duration != null) {
    return normalizeDurationBeats(
      Number(existingItem.duration) * getBeatsPerBar(sequenceSettings.timeSignature),
      getDefaultDurationBeats(sequenceSettings)
    );
  }

  return getDefaultDurationBeats(sequenceSettings);
}

function buildProgressionItem(chord, keyData, existingItem = null, overrides = {}, sequenceSettings = {}) {
  const itemChord = String(chord || "").trim();
  const chordAnalysis = keyData ? parseProgression(itemChord, keyData).parsed[0] : null;
  const canonicalChord = chordAnalysis?.original || itemChord;
  const parsedChord = parseChordName(canonicalChord);
  const durationBeats = normalizeDurationBeats(
    overrides.durationBeats,
    overrides.duration != null
      ? normalizeDurationBeats(
          Number(overrides.duration) * getBeatsPerBar(sequenceSettings.timeSignature),
          getExistingDurationBeats(existingItem, sequenceSettings)
        )
      : getExistingDurationBeats(existingItem, sequenceSettings)
  );

  return {
    id: existingItem?.id || createProgressionItemId(),
    chord: canonicalChord,
    label: formatChordLabel(canonicalChord),
    root: parsedChord?.root || "",
    bass: parsedChord?.bass || parsedChord?.root || "",
    suffix: parsedChord?.suffix || "",
    durationBeats,
    sustain: normalizeSustain(overrides.sustain, normalizeSustain(existingItem?.sustain, false)),
    inKey: Boolean(chordAnalysis?.inKey),
    function: chordAnalysis?.function || null,
    diatonicChord: chordAnalysis?.diatonicChord || null
  };
}

export function importProgressionFromText(text, keyData, existingItems = [], sequenceSettings = {}) {
  const { parsed, invalid } = parseProgression(text, keyData);

  return {
    items: parsed.map((entry, index) =>
      buildProgressionItem(entry.original, keyData, existingItems[index], {}, sequenceSettings)
    ),
    invalid
  };
}

export function rebuildProgressionItems(items, keyData, sequenceSettings = {}) {
  return (Array.isArray(items) ? items : [])
    .map(item => buildProgressionItem(item?.chord, keyData, item, {}, sequenceSettings))
    .filter(item => item.chord);
}

export function appendProgressionItem(items, chord, keyData, sequenceSettings = {}) {
  const nextItem = buildProgressionItem(chord, keyData, null, {}, sequenceSettings);
  return [...(Array.isArray(items) ? items : []), nextItem];
}

export function progressionItemsToText(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => item?.chord)
    .filter(Boolean)
    .join(" | ");
}

export function progressionItemsToChords(items) {
  return (Array.isArray(items) ? items : [])
    .map(item => item?.chord)
    .filter(Boolean);
}

export function buildProgressionSavePayload(items, selectedKey, sequenceSettings = {}) {
  const progressionItems = Array.isArray(items) ? items.filter(item => item?.chord) : [];
  if (!progressionItems.length) {
    return null;
  }

  const [root = "C", ...modeParts] = String(selectedKey || "").split(" ");
  const mode = modeParts.join(" ") || "Ionian";

  return {
    type: "chordcanvas-progression",
    version: 2,
    savedAt: new Date().toISOString(),
    key: {
      name: selectedKey,
      root,
      mode
    },
    sequence: {
      tempoBpm: normalizeTempoBpm(sequenceSettings.tempoBpm),
      timeSignature: normalizeTimeSignature(sequenceSettings.timeSignature)
    },
    items: progressionItems.map((item, index) => ({
      position: index + 1,
      chord: item.chord,
      durationBeats: normalizeDurationBeats(item.durationBeats, getDefaultDurationBeats(sequenceSettings)),
      sustain: normalizeSustain(item.sustain, false)
    }))
  };
}

export function importProgressionFromSavedData(data, keyData, existingItems = []) {
  if (!data || typeof data !== "object") {
    return {
      items: [],
      invalid: [],
      sequenceSettings: {
        tempoBpm: DEFAULT_TEMPO_BPM,
        timeSignature: DEFAULT_TIME_SIGNATURE
      }
    };
  }

  const sequenceSettings = {
    tempoBpm: normalizeTempoBpm(data.sequence?.tempoBpm ?? data.tempoBpm),
    timeSignature: normalizeTimeSignature(data.sequence?.timeSignature ?? data.timeSignature)
  };

  if (Array.isArray(data.items)) {
    const items = data.items
      .map((entry, index) => {
        const chord = typeof entry?.chord === "string" ? entry.chord.trim() : "";
        if (!chord) {
          return null;
        }

        return buildProgressionItem(chord, keyData, existingItems[index], {
          durationBeats: entry?.durationBeats,
          sustain: entry?.sustain
        }, sequenceSettings);
      })
      .filter(Boolean);

    return { items, invalid: [], sequenceSettings };
  }

  if (Array.isArray(data.bars)) {
    const items = data.bars
      .map((entry, index) => {
        const chord = typeof entry?.chord === "string" ? entry.chord.trim() : "";
        if (!chord) {
          return null;
        }

        return buildProgressionItem(chord, keyData, existingItems[index], {
          duration: entry?.duration,
          sustain: entry?.sustain
        }, sequenceSettings);
      })
      .filter(Boolean);

    return { items, invalid: [], sequenceSettings };
  }

  if (Array.isArray(data.chords)) {
    return {
      items: data.chords
        .map((chord, index) => {
          const chordText = String(chord || "").trim();
          if (!chordText) {
            return null;
          }

          return buildProgressionItem(chordText, keyData, existingItems[index], {}, sequenceSettings);
        })
        .filter(Boolean),
      invalid: [],
      sequenceSettings
    };
  }

  if (typeof data.progression === "string") {
    return {
      ...importProgressionFromText(data.progression, keyData, existingItems, sequenceSettings),
      sequenceSettings
    };
  }

  return {
    items: [],
    invalid: [],
    sequenceSettings
  };
}

function formatBeatLabel(durationBeats) {
  return `${durationBeats} beat${durationBeats === 1 ? "" : "s"}`;
}

export function renderProgressionBlocks(container, items, selectedId, playingId, beatsPerBar, onSelect, onEdit) {
  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(items) || !items.length) {
    const empty = document.createElement("div");
    empty.className = "progression-blocks-empty";
    empty.textContent = "No chord blocks yet. Add a chord or paste progression text below.";
    container.appendChild(empty);
    return;
  }

  const track = document.createElement("div");
  track.className = "progression-blocks-track";

  items.forEach(item => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "progression-block";
    button.dataset.progressionBlockId = item.id;
    button.dataset.progressionChord = item.chord;
    button.dataset.duration = String(item.durationBeats);
    button.setAttribute("aria-pressed", String(item.id === selectedId));
    button.setAttribute("aria-current", item.id === playingId ? "true" : "false");
    button.style.setProperty("--progression-duration-beats", String(item.durationBeats));

    if (item.id === selectedId) {
      button.classList.add("progression-block-selected");
    }

    if (item.id === playingId) {
      button.classList.add("progression-block-playing");
    }

    if (item.durationBeats > 1) {
      const beatMarkers = document.createElement("div");
      beatMarkers.className = "progression-block-markers";

      for (let beatIndex = 1; beatIndex < item.durationBeats; beatIndex += 1) {
        const marker = document.createElement("span");
        marker.className = "progression-block-marker";
        if (beatIndex % beatsPerBar === 0) {
          marker.classList.add("progression-block-marker-bar");
        }
        marker.style.left = `${(beatIndex / item.durationBeats) * 100}%`;
        beatMarkers.appendChild(marker);
      }

      button.appendChild(beatMarkers);
    }

    const chordLabel = document.createElement("span");
    chordLabel.className = "progression-block-chord";
    chordLabel.textContent = item.label;
    button.appendChild(chordLabel);

    const metaRow = document.createElement("div");
    metaRow.className = "progression-block-meta";

    button.appendChild(metaRow);

    button.addEventListener("click", () => {
      if (onSelect) onSelect(item.id);
    });

    button.addEventListener("dblclick", event => {
      if (onEdit) {
        const rect = event.currentTarget?.getBoundingClientRect?.();
        onEdit(
          item.id,
          rect
            ? {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
              }
            : null
        );
      }
    });

    track.appendChild(button);
  });

  container.appendChild(track);
}

function buildEditorField(label, value) {
  const field = document.createElement("div");
  field.className = "progression-editor-field";

  const fieldLabel = document.createElement("div");
  fieldLabel.className = "progression-editor-field-label";
  fieldLabel.textContent = label;
  field.appendChild(fieldLabel);

  const fieldValue = document.createElement("div");
  fieldValue.className = "progression-editor-field-value";
  fieldValue.textContent = value;
  field.appendChild(fieldValue);

  return field;
}

function buildEditorSelectField(label, value, options, onChange) {
  const field = document.createElement("label");
  field.className = "progression-editor-field progression-editor-field-select";

  const fieldLabel = document.createElement("div");
  fieldLabel.className = "progression-editor-field-label";
  fieldLabel.textContent = label;
  field.appendChild(fieldLabel);

  const select = document.createElement("select");
  select.className = "progression-editor-select";

  options.forEach(optionValue => {
    const option = document.createElement("option");
    option.value = String(optionValue);
    option.textContent = String(optionValue);
    if (Number(optionValue) === Number(value)) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  select.addEventListener("change", event => {
    if (onChange) {
      onChange(Number(event.target.value));
    }
  });

  field.appendChild(select);
  return field;
}

function buildEditorCheckboxField(label, checked, onChange) {
  const field = document.createElement("label");
  field.className = "progression-editor-field progression-editor-field-checkbox";

  const fieldLabel = document.createElement("div");
  fieldLabel.className = "progression-editor-field-label";
  fieldLabel.textContent = label;
  field.appendChild(fieldLabel);

  const checkboxRow = document.createElement("div");
  checkboxRow.className = "progression-editor-checkbox-row";

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "progression-editor-checkbox";
  checkbox.checked = Boolean(checked);
  checkbox.addEventListener("change", event => {
    if (onChange) {
      onChange(Boolean(event.target.checked));
    }
  });
  checkboxRow.appendChild(checkbox);

  const checkboxValue = document.createElement("span");
  checkboxValue.className = "progression-editor-checkbox-value";
  checkboxValue.textContent = checked ? "On" : "Off";
  checkboxRow.appendChild(checkboxValue);

  field.appendChild(checkboxRow);
  return field;
}

export function renderProgressionEditor(container, selectedItem, selectedIndex, totalItems, options = {}) {
  if (!container) return;

  container.innerHTML = "";
  container.classList.remove("progression-editor-modal-root-active");
  container.onclick = null;

  const shell = document.createElement("div");
  shell.className = "progression-editor-shell";

  if (!selectedItem) {
    return;
  }

  container.classList.add("progression-editor-modal-root-active");
  container.onclick = event => {
    if (event.target === container && options.onClose) {
      options.onClose();
    }
  };

  shell.classList.add("progression-editor-modal");
  shell.dataset.progressionEditorId = selectedItem.id;

  const header = document.createElement("div");
  header.className = "progression-editor-header";

  const title = document.createElement("div");
  title.className = "progression-editor-title";
  title.textContent = "Edit Chord";
  header.appendChild(title);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "progression-editor-close";
  closeButton.textContent = "\u00d7";
  closeButton.setAttribute("aria-label", "Close chord editor");
  closeButton.addEventListener("click", () => {
    if (options.onClose) {
      options.onClose();
    }
  });
  header.appendChild(closeButton);

  shell.appendChild(header);

  const summary = document.createElement("div");
  summary.className = "progression-editor-summary";

  const subtitle = document.createElement("span");
  subtitle.className = "progression-editor-subtitle";
  subtitle.textContent = `Selected item ${selectedIndex + 1} of ${totalItems}`;
  summary.appendChild(subtitle);

  const fields = document.createElement("div");
  fields.className = "progression-editor-fields";
  fields.appendChild(
    buildEditorSelectField("Beats", selectedItem.durationBeats, [1, 2, 3, 4, 5, 6, 7, 8], options.onDurationBeatsChange)
  );
  fields.appendChild(
    buildEditorCheckboxField("Sustain", selectedItem.sustain, options.onSustainChange)
  );
  summary.appendChild(fields);
  shell.appendChild(summary);

  container.appendChild(shell);

  const anchorRect = options.anchorRect;
  if (anchorRect) {
    const spacing = 10;
    const shellRect = shell.getBoundingClientRect();
    const viewportPadding = 12;
    const fitsRight = anchorRect.right + spacing + shellRect.width <= window.innerWidth - viewportPadding;
    const fitsLeft = anchorRect.left - spacing - shellRect.width >= viewportPadding;
    const preferredLeft = fitsRight
      ? anchorRect.right + spacing
      : fitsLeft
        ? anchorRect.left - shellRect.width - spacing
        : Math.min(
            Math.max(viewportPadding, anchorRect.left),
            window.innerWidth - shellRect.width - viewportPadding
          );
    const preferredTop = anchorRect.top + ((anchorRect.height - shellRect.height) / 2);
    const top = Math.min(
      Math.max(viewportPadding, preferredTop),
      window.innerHeight - shellRect.height - viewportPadding
    );
    const left = Math.min(
      Math.max(viewportPadding, preferredLeft),
      window.innerWidth - shellRect.width - viewportPadding
    );

    shell.style.left = `${left}px`;
    shell.style.top = `${top}px`;
  }

  if (!anchorRect) {
    shell.style.left = `${Math.max(12, (window.innerWidth - shell.getBoundingClientRect().width) / 2)}px`;
    shell.style.top = `${Math.max(12, (window.innerHeight - shell.getBoundingClientRect().height) / 2)}px`;
  }
}
