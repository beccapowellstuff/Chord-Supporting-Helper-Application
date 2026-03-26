/**
 * synth.js - Tone.js synthesiser wrapper
 *
 * Responsibilities:
 *   - initSoundFont: builds the Tone.js signal chain on the first user
 *     interaction and caches it
 *   - playMidiNote: plays a single MIDI note number for a given duration
 *   - playMidiNotes: plays multiple MIDI note numbers simultaneously (chord)
 *   - ensureAudioContext: resumes the Tone.js audio context before playback
 *
 * Exports: initSoundFont, playMidiNote, playMidiNotes, ensureAudioContext
 * Depends on: Tone.js (loaded globally via <script> in index.html)
 */
let synth = null;
let isInitialized = false;
let limiter = null;
let compressor = null;
let filter = null;
let reverb = null;
let outputGain = null;

export async function initSoundFont() {
  if (isInitialized && synth) {
    console.log("Synth already initialized");
    return synth;
  }

  try {
    console.log("Starting Tone.js audio context...");
    await Tone.start();
    console.log("Audio context started");

    // Add headroom and dynamics control so stacked chords stop clipping.
    limiter = new Tone.Limiter(-2).toDestination();

    compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 3,
      attack: 0.01,
      release: 0.25
    }).connect(limiter);

    reverb = new Tone.Reverb({
      decay: 1.4,
      preDelay: 0.01,
      wet: 0.08
    }).connect(compressor);

    filter = new Tone.Filter({
      frequency: 2600,
      type: "lowpass",
      rolloff: -24
    }).connect(compressor);

    filter.connect(reverb);

    outputGain = new Tone.Gain(0.5).connect(filter);

    // A softer, shorter envelope feels less like a retro synth lead.
    synth = new Tone.PolySynth(Tone.Synth, {
      maxPolyphony: 8,
      volume: -10,
      oscillator: {
        type: "sine"
      },
      envelope: {
        attack: 0.01,
        decay: 0.28,
        sustain: 0.08,
        release: 0.9
      }
    }).connect(outputGain);

    isInitialized = true;
    console.log("Audio chain initialized");
    return synth;
  } catch (error) {
    console.error("Failed to initialize synth:", error);
    isInitialized = true;
    return null;
  }
}

export async function playMidiNote(midiNumber, duration = 1.0) {
  if (!synth) {
    await initSoundFont();
  }

  if (!synth) {
    console.error("Synth still not available");
    return;
  }

  try {
    const noteName = midiToNoteName(midiNumber);
    console.log("Playing:", noteName);
    synth.triggerAttackRelease(noteName, duration, Tone.now() + 0.01);
  } catch (error) {
    console.error("Failed to play note:", error);
  }
}

export async function playMidiNotes(midiNumbers, duration = 1.0) {
  if (!synth) {
    await initSoundFont();
  }

  if (!synth) {
    console.error("Synth still not available");
    return;
  }

  try {
    const noteNames = midiNumbers.map(midi => midiToNoteName(midi));
    console.log("Playing chord:", noteNames.join(" "));
    synth.triggerAttackRelease(noteNames, duration, Tone.now() + 0.01);
  } catch (error) {
    console.error("Failed to play notes:", error);
  }
}

export async function ensureAudioContext() {
  try {
    await Tone.start();
  } catch (error) {
    console.error("Failed to start audio context:", error);
  }
}

function midiToNoteName(midiNumber) {
  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  return notes[noteIndex] + octave;
}
