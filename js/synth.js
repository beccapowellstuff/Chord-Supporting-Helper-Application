/**
 * synth.js — Tone.js synthesiser wrapper
 *
 * Responsibilities:
 *   - initSoundFont: builds the Tone.js signal chain (PolySynth → Filter →
 *     Reverb → Destination) on the first user interaction and caches it
 *   - playMidiNote: plays a single MIDI note number for a given duration
 *   - playMidiNotes: plays multiple MIDI note numbers simultaneously (chord)
 *   - ensureAudioContext: resumes the Tone.js audio context (needed before
 *     any playback call; satisfies browser autoplay policy)
 *
 * Exports: initSoundFont, playMidiNote, playMidiNotes, ensureAudioContext
 * Depends on: Tone.js (loaded globally via <script> in index.html)
 */
let synth = null;
let isInitialized = false;

export async function initSoundFont() {
  if (isInitialized && synth) {
    console.log("✓ Synth already initialized");
    return synth;
  }

  try {
    // Start audio context
    console.log("Starting Tone.js audio context...");
    await Tone.start();
    console.log("✓ Audio context started");

    // Create output chain - synth -> filter -> reverb -> destination
    const reverb = new Tone.Reverb({
      decay: 2.5,
      wet: 0.35
    }).toDestination();

    const filter = new Tone.Filter({
      frequency: 3200,
      type: "lowpass",
      rolloff: -24
    }).connect(reverb);

    // Create polyphonic synth
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "triangle"
      },
      envelope: {
        attack: 0.005,
        decay: 0.2,
        sustain: 0.35,
        release: 1.8
      }
    }).connect(filter);

    isInitialized = true;
    console.log("✓ Piano synth initialized successfully");
    return synth;
  } catch (error) {
    console.error("✗ Failed to initialize piano synth:", error);
    isInitialized = true;
    return null;
  }
}

export async function playMidiNote(midiNumber, duration = 1.0) {
  if (!synth) {
    await initSoundFont();
  }

  if (!synth) {
    console.error("✗ Synth still not available");
    return;
  }

  try {
    const noteName = midiToNoteName(midiNumber);
    console.log("🎹 Playing:", noteName);
    synth.triggerAttackRelease(noteName, duration, Tone.now());
  } catch (error) {
    console.error("✗ Failed to play note:", error);
  }
}

export async function playMidiNotes(midiNumbers, duration = 1.0) {
  if (!synth) {
    await initSoundFont();
  }

  if (!synth) {
    console.error("✗ Synth still not available");
    return;
  }

  try {
    const noteNames = midiNumbers.map(midi => midiToNoteName(midi));
    console.log("🎹 Playing chord:", noteNames.join(" "));
    synth.triggerAttackRelease(noteNames, duration, Tone.now());
  } catch (error) {
    console.error("✗ Failed to play notes:", error);
  }
}

export async function ensureAudioContext() {
  try {
    await Tone.start();
  } catch (error) {
    console.error("✗ Failed to start audio context:", error);
  }
}

function midiToNoteName(midiNumber) {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  return notes[noteIndex] + octave;
}
