/**
 * playback.js - Audio playback engine
 *
 * Responsibilities:
 *   - Ensures the Tone.js audio context is active before playback
 *   - playSoundChord: unified chord playback with optional voice-leading
 *     smoothing for progressions
 *   - playChord: convenience wrapper for one-shot chord playback
 *   - playProgression: steps through a chord array at a given tempo
 *
 * Exports: ensureAudioReady, playSoundChord, playChord, playProgression
 * Depends on: chordNotes, chordVoicing, synth
 */
import { buildVoicings, distance, getAscendingRootVoicing } from "./chordVoicing.js";
import { ensureAudioContext, playMidiNotes } from "./synth.js";

export async function ensureAudioReady() {
  await ensureAudioContext();
}

export async function playSoundChord(chordName, duration = 1.0, useSmoothing = false, previousVoicing = null) {
  if (!chordName) return { voicing: [] };

  try {
    await ensureAudioReady();

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
      const options = buildVoicings(chordName);
      if (!options.length) return { voicing: [] };
      voicing = options[0];
    }

    if (voicing.length) {
      await playMidiNotes(voicing, duration);
    }

    return { voicing };
  } catch (error) {
    console.error("Could not play chord:", error);
    return { voicing: [] };
  }
}

export async function playChord(chordName, duration = 1.0) {
  if (!chordName) return;

  try {
    await ensureAudioReady();
    const voicing = getAscendingRootVoicing(chordName);
    if (!voicing.length) return;
    await playMidiNotes(voicing, duration);
  } catch (error) {
    console.error("Could not play chord:", error);
  }
}

export async function playProgression(chords, tempo = 90, onChordStart = null) {
  if (!chords.length) return;

  const msPerChord = (60 / tempo) * 2 * 1000;
  let previousVoicing = null;

  for (const chord of chords) {
    if (onChordStart) {
      await onChordStart(chord, (msPerChord / 1000) * 0.9);
    }
    const { voicing } = await playSoundChord(chord, (msPerChord / 1000) * 0.9, true, previousVoicing);
    previousVoicing = voicing;
    await new Promise(resolve => setTimeout(resolve, msPerChord));
  }
}
