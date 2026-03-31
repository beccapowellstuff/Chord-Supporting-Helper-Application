/**
 * synth.js — sample-based piano playback using Tone.Sampler
 */

let synth = null;
let isInitialized = false;
let isReady = false;
let reverb = null;
let filter = null;
let limiter = null;

function getNoteVelocity(velocity = 84) {
  const midiVelocity = Number(velocity);
  const normalizedVelocity = Number.isFinite(midiVelocity)
    ? Math.max(0, Math.min(127, Math.round(midiVelocity)))
    : 84;

  return normalizedVelocity / 127;
}

export async function initSoundFont() {
  if (isInitialized && synth) {
    return synth;
  }

  try {
    await Tone.start();

    limiter = new Tone.Limiter(-3).toDestination();

    reverb = new Tone.Reverb({
      decay: 2.8,
      wet: 0.18
    }).connect(limiter);

    await reverb.generate();

    filter = new Tone.Filter({
      frequency: 2600,
      type: "lowpass",
      rolloff: -24
    }).connect(reverb);

    synth = new Tone.Sampler({
      urls: {
        C3: "samples/C3.wav",
        "D#3": "samples/Ds3.wav",
        "F#3": "samples/Fs3.wav",
        A3: "samples/A3.wav"
      },
      release: 1.8,
      onload: () => {
        isReady = true;
        console.log("✓ Piano samples loaded");
      },
      onerror: (err) => {
        console.error("✗ Failed loading samples:", err);
      }
    }).connect(filter);

    synth.volume.value = -12;

    isInitialized = true;
    return synth;
  } catch (error) {
    console.error("Failed to initialize piano sampler:", error);
    return null;
  }
}

export async function playMidiNote(midiNumber, duration = 1.0, velocity = 0.45) {
  if (!synth) {
    await initSoundFont();
  }

  if (!synth || !isReady) {
    console.log("Sampler not ready yet");
    return;
  }

  try {
    const noteName = clampNoteToRange(midiToNoteName(midiNumber));
    synth.triggerAttackRelease(noteName, duration, Tone.now(), velocity);
  } catch (error) {
    console.error("✗ Failed to play note:", error);
  }
}

export async function playMidiNotes(midiNumbers, duration = 1.0, velocity = 0.45) {
  if (!synth) {
    await initSoundFont();
  }

  if (!synth || !isReady) {
    console.log("Sampler not ready yet");
    return;
  }

  try {
    const noteNames = midiNumbers.map((midi) =>
      clampNoteToRange(midiToNoteName(midi))
    );

    synth.triggerAttackRelease(noteNames, duration, Tone.now(), velocity);
  } catch (error) {
    console.error("✗ Failed to play notes:", error);
  }
}

export async function playMidiNoteSpecs(noteSpecs, duration = 1.0) {
  if (!synth) {
    await initSoundFont();
  }

  if (!synth || !isReady) {
    console.log("Sampler not ready yet");
    return;
  }

  try {
    const now = Tone.now();
    noteSpecs.forEach(noteSpec => {
      const midi = Number(noteSpec?.midi);
      if (!Number.isFinite(midi)) {
        return;
      }

      const noteName = clampNoteToRange(midiToNoteName(midi));
      synth.triggerAttackRelease(noteName, duration, now, getNoteVelocity(noteSpec?.velocity));
    });
  } catch (error) {
    console.error("âœ— Failed to play note specs:", error);
  }
}

export async function startHeldMidiNotes(midiNumbers, velocity = 0.45) {
  if (!synth) {
    await initSoundFont();
  }

  if (!synth || !isReady) {
    console.log("Sampler not ready yet");
    return [];
  }

  try {
    const noteNames = midiNumbers.map(midi =>
      clampNoteToRange(midiToNoteName(midi))
    );

    synth.triggerAttack(noteNames, Tone.now(), velocity);
    return noteNames;
  } catch (error) {
    console.error("âœ— Failed to start held notes:", error);
    return [];
  }
}

export async function startHeldMidiNoteSpecs(noteSpecs) {
  if (!synth) {
    await initSoundFont();
  }

  if (!synth || !isReady) {
    console.log("Sampler not ready yet");
    return [];
  }

  try {
    const now = Tone.now();
    const noteNames = [];

    noteSpecs.forEach(noteSpec => {
      const midi = Number(noteSpec?.midi);
      if (!Number.isFinite(midi)) {
        return;
      }

      const noteName = clampNoteToRange(midiToNoteName(midi));
      noteNames.push(noteName);
      synth.triggerAttack(noteName, now, getNoteVelocity(noteSpec?.velocity));
    });

    return noteNames;
  } catch (error) {
    console.error("Ã¢Å“â€” Failed to start held note specs:", error);
    return [];
  }
}

export function releaseHeldMidiNotes(noteNames) {
  if (!synth || !isReady || !Array.isArray(noteNames) || !noteNames.length) {
    return;
  }

  try {
    synth.triggerRelease(noteNames, Tone.now());
  } catch (error) {
    console.error("âœ— Failed to release held notes:", error);
  }
}

export async function ensureAudioContext() {
  try {
    if (!synth) {
      await initSoundFont();
    } else {
      await Tone.start();
    }
  } catch (error) {
    console.error("✗ Failed to start audio context:", error);
  }
}

export function stopAllPlayback() {
  try {
    if (synth && typeof synth.releaseAll === "function") {
      synth.releaseAll();
    }
  } catch (error) {
    console.warn("Could not stop sampler playback:", error);
  }
}

function midiToNoteName(midiNumber) {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  return notes[noteIndex] + octave;
}

function clampNoteToRange(noteName) {
  const midi = noteNameToMidi(noteName);

  // Keep playback in a sensible range so 4 samples do not get stretched too far.
  const minMidi = noteNameToMidi("C2");
  const maxMidi = noteNameToMidi("C6");

  const clampedMidi = Math.max(minMidi, Math.min(maxMidi, midi));
  return midiToNoteName(clampedMidi);
}

function noteNameToMidi(noteName) {
  const match = noteName.match(/^([A-G])(#?)(-?\d+)$/);

  if (!match) {
    throw new Error(`Invalid note name: ${noteName}`);
  }

  const [, note, sharp, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);

  const noteMap = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  };

  return (octave + 1) * 12 + noteMap[note] + (sharp ? 1 : 0);
}
