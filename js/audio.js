let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function noteToFrequency(note) {
  const noteMap = {
    C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
    "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11
  };

  const match = note.match(/^([A-G](?:#|b)?)(\d)$/);
  if (!match) return null;

  const [, pitchClass, octaveStr] = match;
  const octave = Number(octaveStr);

  const midi = 12 + (octave * 12) + noteMap[pitchClass];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function playChord(notes, duration = 1.2) {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  notes.forEach(note => {
    const frequency = noteToFrequency(note);
    if (!frequency) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  });
}

export async function playProgression(chords, chordToNotes, tempo = 90) {
  const beatLength = 60 / tempo;
  const chordDuration = beatLength * 2;

  for (const chord of chords) {
    const notes = chordToNotes(chord);
    if (notes?.length) {
      playChord(notes, chordDuration * 0.9);
    }
    await new Promise(resolve => setTimeout(resolve, chordDuration * 1000));
  }
}