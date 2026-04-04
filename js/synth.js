/**
 * synth.js - sample-based piano playback using Tone.Sampler
 */

export const AUDIO_STATUS_EVENT = "vibechording:audio-status";

let synth = null;
let initPromise = null;
let isReady = false;
let reverb = null;
let filter = null;
let limiter = null;
let metronomeContext = null;
let lastAudioStatus = {
  state: "idle",
  message: ""
};

function emitAudioStatus(state, message = "") {
  if (lastAudioStatus.state === state && lastAudioStatus.message === message) {
    return;
  }

  lastAudioStatus = { state, message };

  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function" || typeof CustomEvent !== "function") {
    return;
  }

  window.dispatchEvent(new CustomEvent(AUDIO_STATUS_EVENT, {
    detail: {
      state,
      message
    }
  }));
}

function disposeAudioNode(node) {
  if (!node || typeof node.dispose !== "function") {
    return;
  }

  try {
    node.dispose();
  } catch (error) {
    console.warn("Could not dispose audio node:", error);
  }
}

function resetSynthGraph() {
  disposeAudioNode(synth);
  disposeAudioNode(filter);
  disposeAudioNode(reverb);
  disposeAudioNode(limiter);

  synth = null;
  filter = null;
  reverb = null;
  limiter = null;
  isReady = false;
}

function getAudioRetryMessage() {
  return "Audio preview unavailable right now. Try another click to retry.";
}

function getNoteVelocity(velocity = 84) {
  const midiVelocity = Number(velocity);
  const normalizedVelocity = Number.isFinite(midiVelocity)
    ? Math.max(0, Math.min(127, Math.round(midiVelocity)))
    : 84;

  return normalizedVelocity / 127;
}

export async function initSoundFont() {
  if (synth && isReady) {
    return synth;
  }

  if (initPromise) {
    return initPromise;
  }

  emitAudioStatus("loading");
  initPromise = (async () => {
    if (typeof Tone === "undefined") {
      throw new Error("Tone.js is unavailable.");
    }

    await Tone.start();

    const nextLimiter = new Tone.Limiter(-3).toDestination();
    const nextReverb = new Tone.Reverb({
      decay: 2.8,
      wet: 0.18
    }).connect(nextLimiter);

    await nextReverb.generate();

    const nextFilter = new Tone.Filter({
      frequency: 2600,
      type: "lowpass",
      rolloff: -24
    }).connect(nextReverb);

    return new Promise((resolve, reject) => {
      let nextSynth = null;
      let didSettle = false;

      const settleFailure = (error) => {
        if (didSettle) {
          return;
        }

        didSettle = true;
        disposeAudioNode(nextSynth);
        disposeAudioNode(nextFilter);
        disposeAudioNode(nextReverb);
        disposeAudioNode(nextLimiter);
        reject(error);
      };

      const settleSuccess = () => {
        if (didSettle) {
          return;
        }

        didSettle = true;
        synth = nextSynth;
        filter = nextFilter;
        reverb = nextReverb;
        limiter = nextLimiter;
        isReady = true;
        console.log("Piano samples loaded");
        emitAudioStatus("ready");
        resolve(synth);
      };

      try {
        nextSynth = new Tone.Sampler({
          urls: {
            C3: "samples/C3.wav",
            "D#3": "samples/Ds3.wav",
            "F#3": "samples/Fs3.wav",
            A3: "samples/A3.wav"
          },
          release: 1.8,
          onload: settleSuccess,
          onerror: (error) => {
            console.error("Failed loading samples:", error);
            settleFailure(new Error("Failed to load piano samples."));
          }
        }).connect(nextFilter);

        nextSynth.volume.value = -12;
      } catch (error) {
        settleFailure(error);
      }
    });
  })().catch(error => {
    resetSynthGraph();
    emitAudioStatus("error", getAudioRetryMessage());
    console.error("Failed to initialize piano sampler:", error);
    throw error;
  }).finally(() => {
    initPromise = null;
  });

  return initPromise;
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
    console.error("Failed to play note:", error);
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
    console.error("Failed to play notes:", error);
  }
}

function getMetronomeContext() {
  if (metronomeContext) {
    return metronomeContext;
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  metronomeContext = new AudioContextCtor();
  return metronomeContext;
}

async function ensureMetronomeContext() {
  const context = getMetronomeContext();
  if (!context) {
    return null;
  }

  if (context.state === "suspended") {
    try {
      await context.resume();
    } catch (error) {
      console.warn("Could not resume metronome audio context:", error);
    }
  }

  return context;
}

function scheduleMetronomeBurst(context, config) {
  if (!context) {
    return;
  }

  const {
    type = "triangle",
    startFrequency = 880,
    endFrequency = startFrequency,
    peakGain = 0.08,
    durationSeconds = 0.05,
    attackSeconds = 0.0015
  } = config;

  const safePeakGain = Math.max(0.0001, peakGain);
  const safeDuration = Math.max(0.01, durationSeconds);
  const safeAttack = Math.min(Math.max(0.0008, attackSeconds), safeDuration * 0.4);
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(30, startFrequency), now);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + safeDuration);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(safePeakGain, now + safeAttack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + safeDuration);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + safeDuration + 0.02);
}

export async function playMetronomeTick(accent = false, level = 0.4) {
  const normalizedLevel = Number.isFinite(Number(level))
    ? Math.max(0, Math.min(1, Number(level)))
    : 0.4;

  if (normalizedLevel <= 0) {
    return;
  }

  const context = await ensureMetronomeContext();
  if (!context) {
    return;
  }

  if (accent) {
    scheduleMetronomeBurst(context, {
      type: "triangle",
      startFrequency: 180,
      endFrequency: 110,
      peakGain: 0.05 + (normalizedLevel * 0.11),
      durationSeconds: 0.11,
      attackSeconds: 0.002
    });
    scheduleMetronomeBurst(context, {
      type: "square",
      startFrequency: 1400,
      endFrequency: 900,
      peakGain: 0.015 + (normalizedLevel * 0.03),
      durationSeconds: 0.022,
      attackSeconds: 0.001
    });
    return;
  }

  scheduleMetronomeBurst(context, {
    type: "square",
    startFrequency: 1900,
    endFrequency: 1320,
    peakGain: 0.012 + (normalizedLevel * 0.04),
    durationSeconds: 0.028,
    attackSeconds: 0.001
  });
  scheduleMetronomeBurst(context, {
    type: "triangle",
    startFrequency: 980,
    endFrequency: 760,
    peakGain: 0.007 + (normalizedLevel * 0.018),
    durationSeconds: 0.04,
    attackSeconds: 0.0015
  });
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
    console.error("Failed to play note specs:", error);
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
    console.error("Failed to start held notes:", error);
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
    console.error("Failed to start held note specs:", error);
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
    console.error("Failed to release held notes:", error);
  }
}

export async function ensureAudioContext() {
  try {
    if (!synth || !isReady) {
      await initSoundFont();
    } else {
      await Tone.start();
    }

    if (metronomeContext?.state === "suspended") {
      await metronomeContext.resume();
    }

    emitAudioStatus("ready");
    return true;
  } catch (error) {
    emitAudioStatus("error", getAudioRetryMessage());
    console.error("Failed to start audio context:", error);
    throw error;
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
