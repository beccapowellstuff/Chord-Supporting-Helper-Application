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
import {
  ensureAudioContext,
  playMidiNotes,
  releaseHeldMidiNotes,
  startHeldMidiNotes,
  stopAllPlayback
} from "./synth.js";

export async function ensureAudioReady() {
  await ensureAudioContext();
}

function resolveChordVoicing(chordName, useSmoothing = false, previousVoicing = null) {
  if (!chordName) return [];

  if (useSmoothing && previousVoicing) {
    const options = buildVoicings(chordName);
    if (!options.length) return [];

    let voicing = options[0];
    let bestScore = distance(previousVoicing, options[0]);

    for (const option of options.slice(1)) {
      const optionScore = distance(previousVoicing, option);
      if (optionScore < bestScore) {
        voicing = option;
        bestScore = optionScore;
      }
    }

    return voicing;
  }

  const options = buildVoicings(chordName);
  return options[0] || [];
}

export async function playSoundChord(chordName, duration = 1.0, useSmoothing = false, previousVoicing = null) {
  if (!chordName) return { voicing: [] };

  try {
    await ensureAudioReady();
    const voicing = resolveChordVoicing(chordName, useSmoothing, previousVoicing);

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

function waitForChordWindow(durationMs, shouldStop = null) {
  return new Promise(resolve => {
    const stepMs = 40;
    let elapsedMs = 0;

    function tick() {
      if (shouldStop?.()) {
        resolve(true);
        return;
      }

      if (elapsedMs >= durationMs) {
        resolve(false);
        return;
      }

      const remainingMs = durationMs - elapsedMs;
      const delayMs = Math.min(stepMs, remainingMs);
      elapsedMs += delayMs;
      setTimeout(tick, delayMs);
    }

    tick();
  });
}

function getPlaybackEntry(entry) {
  if (typeof entry === "string") {
    return {
      chord: entry,
      durationBeats: 4,
      sustain: false,
      voicingMidiNotes: []
    };
  }

  return {
    chord: entry?.chord || "",
    durationBeats: Math.max(1, Number(entry?.durationBeats) || 4),
    sustain: Boolean(entry?.sustain),
    voicingMidiNotes: Array.isArray(entry?.voicing?.midiNotes)
      ? entry.voicing.midiNotes.map(value => Number(value)).filter(Number.isFinite)
      : []
  };
}

export async function playProgression(chords, tempo = 120, onChordStart = null, shouldStop = null) {
  if (!chords.length) return;

  const normalizedTempo = Math.max(40, Number(tempo) || 120);
  const secondsPerBeat = 60 / normalizedTempo;
  let previousVoicing = null;
  let activeHeldNotes = [];

  for (const rawEntry of chords) {
    const entry = getPlaybackEntry(rawEntry);
    const chord = entry.chord;
    const chordDurationSeconds = entry.durationBeats * secondsPerBeat;
    const chordPlaybackSeconds = entry.sustain
      ? chordDurationSeconds
      : chordDurationSeconds * 0.9;
    const chordWindowMs = chordDurationSeconds * 1000;

    if (shouldStop?.()) {
      if (activeHeldNotes.length) {
        releaseHeldMidiNotes(activeHeldNotes);
      }
      stopAllPlayback();
      return;
    }

    if (activeHeldNotes.length) {
      releaseHeldMidiNotes(activeHeldNotes);
      activeHeldNotes = [];
    }

    if (onChordStart) {
      await onChordStart(chord, chordPlaybackSeconds);
    }

    if (shouldStop?.()) {
      if (activeHeldNotes.length) {
        releaseHeldMidiNotes(activeHeldNotes);
      }
      stopAllPlayback();
      return;
    }

    const voicing = entry.voicingMidiNotes.length
      ? [...entry.voicingMidiNotes]
      : resolveChordVoicing(chord, true, previousVoicing);
    previousVoicing = voicing;

    if (entry.sustain) {
      activeHeldNotes = await startHeldMidiNotes(voicing);
    } else if (voicing.length) {
      await playMidiNotes(voicing, chordPlaybackSeconds);
    }

    const wasStopped = await waitForChordWindow(chordWindowMs, shouldStop);
    if (wasStopped) {
      if (activeHeldNotes.length) {
        releaseHeldMidiNotes(activeHeldNotes);
      }
      stopAllPlayback();
      return;
    }
  }

  if (activeHeldNotes.length) {
    releaseHeldMidiNotes(activeHeldNotes);
  }
}
