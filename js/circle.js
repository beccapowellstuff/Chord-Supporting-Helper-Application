const SVG_NS = "http://www.w3.org/2000/svg";

const CIRCLE_MAJOR_ORDER = ["C", "G", "D", "A", "E", "B", "F#/Gb", "Db/C#", "Ab", "Eb", "Bb", "F"];
const RELATIVE_MINORS = ["Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m/Ebm", "A#m/Bbm", "Fm", "Cm", "Gm", "Dm"];

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

    const minorAliases = parseAliases(RELATIVE_MINORS[i]).map(stripChordQuality);
    for (const alias of minorAliases) {
      if (noteToPitchClass(alias) === rootPc) {
        return i;
      }
    }
  }

  return -1;
}

export function renderCircleOfFifths(container, selectedKey, onSelectKey, musicData, onAddChord) {
  container.innerHTML = "";

  const alwaysShowAddButtons =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none)").matches;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 600 600");
  svg.setAttribute("class", "circle-svg");

  const cx = 300;
  const cy = 300;

  const majorOuterR = 250;
  const majorInnerR = 165;
  const minorOuterR = 165;
  const minorInnerR = 95;

  const diatonicLookup = getDiatonicLookup(musicData, selectedKey);
  const floatingDiminished = getFloatingDiminishedBadgeInfo(musicData, selectedKey);

  let selectedMajorIndex = -1;
  let selectedMinorIndex = -1;

  for (let i = 0; i < 12; i++) {
    if (keyMatchesLabel(selectedKey, CIRCLE_MAJOR_ORDER[i], "Major")) {
      selectedMajorIndex = i;
    }
    if (keyMatchesLabel(selectedKey, RELATIVE_MINORS[i], "Minor")) {
      selectedMinorIndex = i;
    }
  }

  for (let i = 0; i < 12; i++) {
    const midAngle = i * 30;
    const startAngle = midAngle - 15;
    const endAngle = midAngle + 15;

    const majorLabel = CIRCLE_MAJOR_ORDER[i];
    const minorLabel = RELATIVE_MINORS[i];

    const majorIsSelected = keyMatchesLabel(selectedKey, majorLabel, "Major");
    const majorIsNeighbour =
      selectedMajorIndex !== -1 && getMajorNeighbours(selectedMajorIndex).includes(i);
    const majorIsInKey = isChordInSelectedKey(diatonicLookup, majorLabel, "major");

    const minorIsSelected = keyMatchesLabel(selectedKey, minorLabel, "Minor");
    const minorIsNeighbour =
      selectedMinorIndex !== -1 && getMajorNeighbours(selectedMinorIndex).includes(i);
    const minorIsInKey = isChordInSelectedKey(diatonicLookup, minorLabel, "minor");

    let majorAddButton = null;
    let minorAddButton = null;

    const majorPath = document.createElementNS(SVG_NS, "path");
    majorPath.setAttribute(
      "d",
      createRingSegmentPath(cx, cy, majorInnerR, majorOuterR, startAngle, endAngle)
    );
    majorPath.setAttribute(
      "fill",
      getSegmentFill("major", majorIsSelected, majorIsNeighbour, majorIsInKey)
    );
    majorPath.setAttribute("stroke", "#ffffff");
    majorPath.setAttribute("stroke-width", "2");
    majorPath.style.cursor = "pointer";
    majorPath.setAttribute("data-tooltip", `Select ${majorLabel} major`);
    majorPath.addEventListener("click", () => {
      const aliases = parseAliases(majorLabel);
      const selected = aliases.find(alias => musicData[`${alias} Major`]) || aliases[0];
      onSelectKey(`${selected} Major`);
    });
    majorPath.addEventListener("mouseenter", () => {
      if (majorAddButton) majorAddButton.show();
    });
    majorPath.addEventListener("mouseleave", () => {
      if (majorAddButton) majorAddButton.hide(220);
    });
    svg.appendChild(majorPath);

    const minorPath = document.createElementNS(SVG_NS, "path");
    minorPath.setAttribute(
      "d",
      createRingSegmentPath(cx, cy, minorInnerR, minorOuterR, startAngle, endAngle)
    );
    minorPath.setAttribute(
      "fill",
      getSegmentFill("minor", minorIsSelected, minorIsNeighbour, minorIsInKey)
    );
    minorPath.setAttribute("stroke", "#ffffff");
    minorPath.setAttribute("stroke-width", "2");
    minorPath.style.cursor = "pointer";
    minorPath.setAttribute("data-tooltip", `Select ${minorLabel} minor`);
    minorPath.addEventListener("click", () => {
      const aliases = parseAliases(minorLabel);
      const selected = aliases.find(alias => musicData[`${stripChordQuality(alias)} Minor`]) || aliases[0];
      onSelectKey(`${stripChordQuality(selected)} Minor`);
    });
    minorPath.addEventListener("mouseenter", () => {
      if (minorAddButton) minorAddButton.show();
    });
    minorPath.addEventListener("mouseleave", () => {
      if (minorAddButton) minorAddButton.hide(220);
    });
    svg.appendChild(minorPath);

    const majorLabelPos = polarToCartesian(cx, cy, 207, midAngle);
    createText(svg, majorLabelPos.x, majorLabelPos.y, majorLabel, {
      fontSize: "15",
      fontWeight: "bold",
      fill: "#ffffff"
    });

    const minorLabelPos = polarToCartesian(cx, cy, 130, midAngle);
    createText(svg, minorLabelPos.x, minorLabelPos.y, minorLabel, {
      fontSize: "13",
      fill: minorIsSelected ? "#ffffff" : "#37474f"
    });

    const majorFn = getMatchingFunction(diatonicLookup, majorLabel, "major");
    if (majorFn) {
      const badgePos = polarToCartesian(cx, cy, 255, midAngle);
      createBadge(svg, badgePos.x, badgePos.y, majorFn);
    }

    const minorFn = getMatchingFunction(diatonicLookup, minorLabel, "minor");
    if (minorFn) {
      const badgePos = polarToCartesian(cx, cy, 100, midAngle);
      createBadge(svg, badgePos.x, badgePos.y, minorFn);
    }

    if (onAddChord) {
      // Place add button near the top-left side of each segment.
      const addAngle = startAngle + 6;

      const majorAddPos = polarToCartesian(cx, cy, 242, addAngle);
      majorAddButton = createAddButton(
        svg,
        majorAddPos.x,
        majorAddPos.y,
        () => {
          const aliases = parseAliases(majorLabel);
          const selected = aliases.find(alias => musicData[`${alias} Major`]) || aliases[0];
          onAddChord(selected);
        },
        alwaysShowAddButtons,
        `Add ${majorLabel} to progression`
      );

      const minorAddPos = polarToCartesian(cx, cy, 158, addAngle);
      minorAddButton = createAddButton(
        svg,
        minorAddPos.x,
        minorAddPos.y,
        () => {
          const aliases = parseAliases(minorLabel);
          const selected = aliases.find(alias => musicData[`${stripChordQuality(alias)} Minor`]) || aliases[0];
          onAddChord(selected);
        },
        alwaysShowAddButtons,
        `Add ${minorLabel} to progression`
      );
    }
  }

  if (floatingDiminished) {
    const badgeIndex = findCircleIndexForNote(floatingDiminished.rootNote);
    if (badgeIndex !== -1) {
      const badgePos = polarToCartesian(cx, cy, 165, badgeIndex * 30);
      createBadge(svg, badgePos.x, badgePos.y, floatingDiminished.label);
    }
  }

  container.appendChild(svg);
}