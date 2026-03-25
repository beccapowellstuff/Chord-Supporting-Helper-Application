import { noteToMidi, getChordNotes } from "./chordNotes.js";
import { buildVoicings, distance } from "./chordVoicing.js";
import { ensureAudioContext, playMidiNotes } from "./synth.js";

let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

export async function ensureAudioReady() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

export async function playSoundChord(chordName, duration = 1.0, useSmoothing = false, previousVoicing = null) {
  if (!chordName) return { voicing: [] };

  try {
    await ensureAudioContext();

    let voicing;
    if (useSmoothing && previousVoicing) {
      const options = buildVoicings(chordName);
      if (!options.length) return { voicing: [] };

      voicing = options[0];
      let bestScore = distance(previousVoicing, options[0]);

      for (const option of options.slice(1)) {
        const optionScore = distance(previousVoicing, option);
        if (optionScore < bestScore) {
          voicing = option;
          bestScore = optionScore;
        }
      }
    } else {
      const notes = getChordNotes(chordName);
      if (!notes) return { voicing: [] };

      voicing = [];
      notes.forEach((note, idx) => {
        voicing.push(noteToMidi(note, idx === 0 ? 3 : 4));
      });
      voicing = voicing.sort((a, b) => a - b);
    }

    if (voicing.length) {
      await playMidiNotes(voicing, duration);
    }

    return { voicing };
  } catch (error) {
    console.error("✗ Could not play chord:", error);
    return { voicing: [] };
  }
}

export async function playChord(chordName, duration = 1.0) {
  await playSoundChord(chordName, duration, false, null);
}

export async function playProgression(chords, tempo = 90) {
  if (!chords.length) return;

  const msPerChord = (60 / tempo) * 2 * 1000;
  let previousVoicing = null;

  for (const chord of chords) {
    const { voicing } = await playSoundChord(chord, (msPerChord / 1000) * 0.9, true, previousVoicing);
    previousVoicing = voicing;
    await new Promise(resolve => setTimeout(resolve, msPerChord));
  }
}
