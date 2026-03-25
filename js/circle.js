const SVG_NS = "http://www.w3.org/2000/svg";

const CIRCLE_MAJOR_ORDER = ["C", "G", "D", "A", "E", "B", "F#/Gb", "Db/C#", "Ab", "Eb", "Bb", "F"];

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

function polarToCartesian(cx, cy, r, angleDeg) {
  const angleRad = (angleDeg - 90) * Math.PI / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad)
  };
}

function createRingSegmentPath(cx, cy, innerR, outerR, startAngle, endAngle) {
  const p1 = polarToCartesian(cx, cy, outerR, startAngle);
  const p2 = polarToCartesian(cx, cy, outerR, endAngle);
  const p3 = polarToCartesian(cx, cy, innerR, endAngle);
  const p4 = polarToCartesian(cx, cy, innerR, startAngle);

  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z"
  ].join(" ");
}

function createText(svg, x, y, textValue, options = {}) {
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", x);
  text.setAttribute("y", y);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");
  text.setAttribute("pointer-events", "none");
  text.setAttribute("font-size", options.fontSize || "14");
  text.setAttribute("font-weight", options.fontWeight || "normal");
  text.setAttribute("fill", options.fill || "#000");
  text.textContent = textValue;
  svg.appendChild(text);
  return text;
}

function createBadge(svg, x, y, label) {
  const circle = document.createElementNS(SVG_NS, "circle");
  circle.setAttribute("cx", x);
  circle.setAttribute("cy", y);
  circle.setAttribute("r", "18");
  circle.setAttribute("fill", "#a2bbf3");
  circle.setAttribute("stroke", "none");
  svg.appendChild(circle);

  createText(svg, x, y + 1, label, {
    fontSize: "16",
    fill: "#5a4a1f"
  });
}

function createAddButton(svg, x, y, onClick, alwaysVisible = false, tooltip = null) {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", "circle-add-btn");
  group.style.transition = "opacity 0.16s ease";
  group.style.opacity = alwaysVisible ? "0.9" : "0";
  group.style.pointerEvents = alwaysVisible ? "auto" : "none";

  const buttonCircle = document.createElementNS(SVG_NS, "circle");
  buttonCircle.setAttribute("cx", x);
  buttonCircle.setAttribute("cy", y);
  buttonCircle.setAttribute("r", "9");
  buttonCircle.setAttribute("fill", "#b9e8bf");
  buttonCircle.setAttribute("stroke", "#ffffff");
  buttonCircle.setAttribute("stroke-width", "1.8");
  buttonCircle.style.cursor = "pointer";
  if (tooltip) buttonCircle.setAttribute("data-tooltip", tooltip);
  buttonCircle.addEventListener("click", event => {
    event.stopPropagation();
    onClick();
  });

  const plus = document.createElementNS(SVG_NS, "text");
  plus.setAttribute("x", x);
  plus.setAttribute("y", y + 1);
  plus.setAttribute("text-anchor", "middle");
  plus.setAttribute("dominant-baseline", "middle");
  plus.setAttribute("font-size", "13");
  plus.setAttribute("font-weight", "bold");
  plus.setAttribute("fill", "#1f5a2c");
  plus.style.pointerEvents = "none";
  plus.textContent = "+";

  group.appendChild(buttonCircle);
  group.appendChild(plus);
  svg.appendChild(group);

  let hideTimer = null;

  const show = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    group.style.opacity = "0.95";
    group.style.pointerEvents = "auto";
  };

  const hide = (delayMs = 0) => {
    if (alwaysVisible) return;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    const applyHide = () => {
      group.style.opacity = "0";
      group.style.pointerEvents = "none";
    };

    if (delayMs > 0) {
      hideTimer = setTimeout(applyHide, delayMs);
    } else {
      applyHide();
    }
  };

  group.addEventListener("mouseenter", show);
  group.addEventListener("mouseleave", () => hide(120));

  return { show, hide };
}

function getMajorNeighbours(index) {
  return [(index + 11) % 12, (index + 1) % 12];
}

function getSegmentFill(type, isSelected, isNeighbour, isInKey) {
  if (type === "major") {
    if (isSelected) return "#424242";
    if (isInKey) return "#e8a8c4";
    if (isNeighbour) return "#efbfd4";
    return "#c85f8f";
  }

  if (isSelected) return "#616161";
  if (isInKey) return "#dca8c3";
  if (isNeighbour) return "#ead0dd";
  return "#efd3e0";
}

function parseAliases(label) {
  return label.split("/");
}

function stripChordQuality(chord) {
  return chord.replace(/dim$/, "").replace(/m$/, "");
}

function getChordQuality(chord) {
  if (chord.endsWith("dim")) return "dim";
  if (chord.endsWith("m")) return "minor";
  return "major";
}

function noteToPitchClass(note) {
  return NOTE_TO_PC[note] ?? null;
}

function chordsEquivalent(chordA, chordB) {
  const rootA = stripChordQuality(chordA);
  const rootB = stripChordQuality(chordB);
  const qualityA = getChordQuality(chordA);
  const qualityB = getChordQuality(chordB);

  return (
    qualityA === qualityB &&
    noteToPitchClass(rootA) !== null &&
    noteToPitchClass(rootA) === noteToPitchClass(rootB)
  );
}

function keyMatchesLabel(keyName, label, suffix) {
  const aliases = parseAliases(label);

  return aliases.some(alias => {
    const base = suffix === "Minor" ? stripChordQuality(alias) : alias;
    return keyName === `${base} ${suffix}`;
  });
}

function getDiatonicLookup(musicData, selectedKey) {
  const keyData = musicData[selectedKey];
  if (!keyData) return {};

  const lookup = {};
  keyData.chords.forEach(chord => {
    lookup[chord] = keyData.functions[chord];
  });

  return lookup;
}

function getMatchingFunction(diatonicLookup, label, expectedQuality) {
  const aliases = parseAliases(label);
  const candidateLabels = aliases.map(alias => {
    if (expectedQuality === "major") return alias;
    if (expectedQuality === "minor") return alias.endsWith("m") ? alias : `${alias}m`;
    return alias;
  });

  for (const [diatonicChord, fn] of Object.entries(diatonicLookup)) {
    for (const candidate of candidateLabels) {
      if (chordsEquivalent(diatonicChord, candidate)) {
        return fn;
      }
    }
  }

  return null;
}

function isChordInSelectedKey(diatonicLookup, label, expectedQuality) {
  return Boolean(getMatchingFunction(diatonicLookup, label, expectedQuality));
}

function getFloatingDiminishedBadgeInfo(musicData, selectedKey) {
  const keyData = musicData[selectedKey];
  if (!keyData) return null;

  const targetFunction = keyData.mode === "major" ? "vii°" : "ii°";
  const diminishedChord = keyData.chords.find(chord => keyData.functions[chord] === targetFunction);

  if (!diminishedChord) return null;

  return {
    label: targetFunction,
    rootNote: stripChordQuality(diminishedChord)
  };
}

function findCircleIndexForNote(rootNote) {
  const rootPc = noteToPitchClass(rootNote);
  if (rootPc === null) return -1;

  for (let i = 0; i < CIRCLE_MAJOR_ORDER.length; i++) {
    const majorAliases = parseAliases(CIRCLE_MAJOR_ORDER[i]);
    for (const alias of majorAliases) {
      if (noteToPitchClass(alias) === rootPc) {
        return i;
      }
    }
  }

  return -1;
}

export function renderCircleOfFifths(container, selectedKey, onSelectKey, musicData, onAddChord) {
  // Render a simple chromatic grid of root buttons (replaces the SVG circle)
  container.innerHTML = "";

  const CHROMATIC = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

  // No chord-relationship lookup here — root view shows only root buttons

  // Helper to find a matching key name in musicData for a given root label
  function findKeyForRootLabel(label, style = "Major") {
    if (!musicData) return null;
    const desired = `${label} ${style}`;
    if (musicData[desired]) return desired;

    const styleLower = String(style || "").toLowerCase();
    const targetPc = noteToPitchClass(label);
    if (targetPc == null) return null;

    // Prefer keys with matching mode (major/minor)
    for (const keyName of Object.keys(musicData)) {
      const parts = keyName.split(" ");
      const root = parts[0];
      const keyData = musicData[keyName];
      if (noteToPitchClass(root) === targetPc) {
        if (keyData && keyData.mode === styleLower) return keyName;
      }
    }

    // Fallback to any key with the same root
    for (const keyName of Object.keys(musicData)) {
      const root = keyName.split(" ")[0];
      if (noteToPitchClass(root) === targetPc) return keyName;
    }

    return null;
  }

  // Render as a table to give a neat, compact root-selection layout
  const table = document.createElement("table");
  table.className = "root-table";
  const tbody = document.createElement("tbody");
  const row = document.createElement("tr");

  CHROMATIC.forEach(label => {
    const td = document.createElement("td");

    const mainBtn = document.createElement("button");
    mainBtn.type = "button";
    mainBtn.className = "key-chord-main circle-root-btn";
    mainBtn.textContent = label;
    mainBtn.dataset.root = label;

    mainBtn.addEventListener("click", () => {
      const styleEl = document.getElementById("styleSelect");
      const style = styleEl ? styleEl.value : "Major";
      const keyName = findKeyForRootLabel(label, style) || `${label} ${style}`;
      if (onSelectKey) onSelectKey(keyName);
    });

    td.appendChild(mainBtn);
    row.appendChild(td);
  });

  tbody.appendChild(row);
  table.appendChild(tbody);
  container.appendChild(table);
}