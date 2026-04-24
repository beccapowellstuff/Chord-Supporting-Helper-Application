import { parseChordName, noteToMidi } from "./chordNotes.js";
import { buildVoicings, chooseVoicing } from "./chordVoicing.js";
import { DEFAULT_NOTE_VELOCITY, normalizeMidiVelocity } from "./progressionBuilder.js";

const MIDI_HEADER_CHUNK_ID = "MThd";
const MIDI_TRACK_CHUNK_ID = "MTrk";
const MIDI_FORMAT_TYPE = 1;
const TRACK_COUNT = 3;
const TICKS_PER_BEAT = 480;
const CHORD_CHANNEL = 0;
const BASS_CHANNEL = 1;
const CHORD_PROGRAM = 0;
const BASS_PROGRAM = 32;
const CHORD_TRACK_NAME = "Chords";
const BASS_TRACK_NAME = "Bass";
const META_TRACK_NAME = "Vibe Chording";
const SUSTAIN_PEDAL_CONTROLLER = 64;
const SUSTAIN_PEDAL_ON = 127;
const SUSTAIN_PEDAL_OFF = 0;
const PEDAL_RELEASE_OFFSET_TICKS = 12;
const PEDAL_REPEDAL_GAP_TICKS = 10;
const BASS_TRACK_MIN_MIDI = 24;
const BASS_TRACK_MAX_MIDI = 47;

function clampTempoBpm(tempoBpm) {
  const numericTempo = Number(tempoBpm);
  if (!Number.isFinite(numericTempo)) {
    return 120;
  }

  return Math.max(40, Math.min(240, Math.round(numericTempo)));
}

function getTimeSignatureParts(timeSignature = "4/4") {
  const [rawNumerator = "4", rawDenominator = "4"] = String(timeSignature || "4/4").split("/");
  const numerator = Math.max(1, Number.parseInt(rawNumerator, 10) || 4);
  const denominator = Math.max(1, Number.parseInt(rawDenominator, 10) || 4);
  return { numerator, denominator };
}

function numberToBytes(value, byteCount) {
  return Array.from({ length: byteCount }, (_, index) => {
    const shift = (byteCount - index - 1) * 8;
    return (value >> shift) & 0xff;
  });
}

function stringToBytes(value) {
  return Array.from(new TextEncoder().encode(String(value || "")));
}

function encodeVariableLengthQuantity(value) {
  let remaining = Math.max(0, Number(value) || 0);
  const bytes = [remaining & 0x7f];
  remaining >>= 7;

  while (remaining > 0) {
    bytes.unshift((remaining & 0x7f) | 0x80);
    remaining >>= 7;
  }

  return bytes;
}

function buildChunk(id, dataBytes) {
  return [
    ...stringToBytes(id),
    ...numberToBytes(dataBytes.length, 4),
    ...dataBytes
  ];
}

function buildMetaEvent(type, dataBytes) {
  return [0xff, type, ...encodeVariableLengthQuantity(dataBytes.length), ...dataBytes];
}

function buildTrackNameEvent(name) {
  return buildMetaEvent(0x03, stringToBytes(name));
}

function buildTempoEvent(tempoBpm) {
  const microsecondsPerQuarterNote = Math.round(60000000 / clampTempoBpm(tempoBpm));
  return buildMetaEvent(0x51, numberToBytes(microsecondsPerQuarterNote, 3));
}

function buildTimeSignatureEvent(timeSignature) {
  const { numerator, denominator } = getTimeSignatureParts(timeSignature);
  const denominatorPower = Math.max(0, Math.round(Math.log2(denominator)));
  return buildMetaEvent(0x58, [numerator & 0xff, denominatorPower & 0xff, 24, 8]);
}

function buildEndOfTrackEvent() {
  return buildMetaEvent(0x2f, []);
}

function buildProgramChangeEvent(channel, programNumber) {
  return [0xc0 | (channel & 0x0f), programNumber & 0x7f];
}

function buildControlChangeEvent(channel, controller, value) {
  return [0xb0 | (channel & 0x0f), controller & 0x7f, value & 0x7f];
}

function buildNoteOnEvent(channel, midi, velocity) {
  return [0x90 | (channel & 0x0f), midi & 0x7f, normalizeMidiVelocity(velocity) & 0x7f];
}

function buildNoteOffEvent(channel, midi) {
  return [0x80 | (channel & 0x0f), midi & 0x7f, 0];
}

function buildTrackChunk(events) {
  const normalizedEvents = [...events].sort((a, b) => {
    if (a.tick !== b.tick) {
      return a.tick - b.tick;
    }

    return (a.order || 0) - (b.order || 0);
  });

  let previousTick = 0;
  const trackData = [];

  normalizedEvents.forEach(event => {
    const tick = Math.max(0, Number(event.tick) || 0);
    const deltaTicks = tick - previousTick;
    previousTick = tick;
    trackData.push(...encodeVariableLengthQuantity(deltaTicks), ...event.bytes);
  });

  return buildChunk(MIDI_TRACK_CHUNK_ID, trackData);
}

function normalizeDurationTicks(durationBeats) {
  const beats = Math.max(1, Number(durationBeats) || 1);
  return Math.max(1, Math.round(beats * TICKS_PER_BEAT));
}

function getReleasedDurationTicks(durationTicks, sustain = false) {
  if (sustain) {
    return Math.max(1, durationTicks);
  }

  return Math.max(1, Math.round(durationTicks * 0.9));
}

function getPedalReleaseTick(nextChordStartTick, hasNextItem) {
  if (!hasNextItem) {
    return nextChordStartTick;
  }

  return nextChordStartTick + PEDAL_RELEASE_OFFSET_TICKS;
}

function normalizeBassMidi(midi) {
  let normalizedMidi = Number(midi);
  if (!Number.isFinite(normalizedMidi)) {
    return null;
  }

  while (normalizedMidi > BASS_TRACK_MAX_MIDI) {
    normalizedMidi -= 12;
  }

  while (normalizedMidi < BASS_TRACK_MIN_MIDI) {
    normalizedMidi += 12;
  }

  return Math.max(0, Math.min(127, Math.round(normalizedMidi)));
}

function getExportChordVoicing(item, previousVoicing = null) {
  const voicingNotes = Array.isArray(item?.voicing?.notes)
    ? item.voicing.notes
      .map(note => ({
        midi: Number(note?.midi),
        velocity: normalizeMidiVelocity(note?.velocity, DEFAULT_NOTE_VELOCITY)
      }))
      .filter(note => Number.isFinite(note.midi))
      .sort((a, b) => a.midi - b.midi)
    : [];

  if (voicingNotes.length) {
    return {
      voicing: voicingNotes.map(note => note.midi),
      noteSpecs: voicingNotes
    };
  }

  const chordName = String(item?.chord || "").trim();
  if (!chordName) {
    return {
      voicing: [],
      noteSpecs: []
    };
  }

  const fallbackVoicing = previousVoicing?.length
    ? chooseVoicing(chordName, previousVoicing)
    : (buildVoicings(chordName)[0] || []);
  const voicing = Array.isArray(fallbackVoicing) ? fallbackVoicing : [];

  return {
    voicing,
    noteSpecs: voicing.map(midi => ({
      midi,
      velocity: DEFAULT_NOTE_VELOCITY
    }))
  };
}

function getBassMidiForItem(item) {
  const explicitVoicingNotes = Array.isArray(item?.voicing?.notes)
    ? item.voicing.notes
      .map(note => Number(note?.midi))
      .filter(midi => Number.isFinite(midi))
      .sort((a, b) => a - b)
    : [];

  if (explicitVoicingNotes.length) {
    return normalizeBassMidi(explicitVoicingNotes[0]);
  }

  const parsedChord = parseChordName(item?.chord);
  if (!parsedChord) {
    return null;
  }

  return normalizeBassMidi(noteToMidi(parsedChord.bass || parsedChord.root, 2));
}

function createMetaTrack({ tempoBpm, timeSignature }) {
  return buildTrackChunk([
    { tick: 0, order: 0, bytes: buildTrackNameEvent(META_TRACK_NAME) },
    { tick: 0, order: 1, bytes: buildTempoEvent(tempoBpm) },
    { tick: 0, order: 2, bytes: buildTimeSignatureEvent(timeSignature) },
    { tick: 0, order: 99, bytes: buildEndOfTrackEvent() }
  ]);
}

function createChordTrack(items) {
  const events = [
    { tick: 0, order: 0, bytes: buildTrackNameEvent(CHORD_TRACK_NAME) },
    { tick: 0, order: 1, bytes: buildProgramChangeEvent(CHORD_CHANNEL, CHORD_PROGRAM) }
  ];
  let absoluteTick = 0;
  let previousVoicing = null;

  items.forEach((item, itemIndex) => {
    const durationTicks = normalizeDurationTicks(item?.durationBeats);
    const releasedDurationTicks = getReleasedDurationTicks(durationTicks, item?.sustain);
    const { voicing, noteSpecs } = getExportChordVoicing(item, previousVoicing);
    const nextStartTick = absoluteTick + durationTicks;
    const nextItem = items[itemIndex + 1] || null;
    const isSustainActive = Boolean(item?.sustain);
    const isPreviousSustainActive = Boolean(items[itemIndex - 1]?.sustain);
    const isNextSustainActive = Boolean(nextItem?.sustain);

    if (voicing.length) {
      previousVoicing = voicing;
    }

    if (isSustainActive && !isPreviousSustainActive) {
      events.push({
        tick: absoluteTick,
        order: 2,
        bytes: buildControlChangeEvent(CHORD_CHANNEL, SUSTAIN_PEDAL_CONTROLLER, SUSTAIN_PEDAL_ON)
      });
    }

    noteSpecs.forEach((noteSpec, noteIndex) => {
      events.push({
        tick: absoluteTick,
        order: 10 + noteIndex,
        bytes: buildNoteOnEvent(CHORD_CHANNEL, noteSpec.midi, noteSpec.velocity)
      });
      events.push({
        tick: absoluteTick + releasedDurationTicks,
        order: 40 + noteIndex,
        bytes: buildNoteOffEvent(CHORD_CHANNEL, noteSpec.midi)
      });
    });

    if (isSustainActive) {
      const pedalReleaseTick = getPedalReleaseTick(nextStartTick, Boolean(nextItem));
      events.push({
        tick: pedalReleaseTick,
        order: 80,
        bytes: buildControlChangeEvent(CHORD_CHANNEL, SUSTAIN_PEDAL_CONTROLLER, SUSTAIN_PEDAL_OFF)
      });

      if (isNextSustainActive) {
        events.push({
          tick: pedalReleaseTick + PEDAL_REPEDAL_GAP_TICKS,
          order: 81,
          bytes: buildControlChangeEvent(CHORD_CHANNEL, SUSTAIN_PEDAL_CONTROLLER, SUSTAIN_PEDAL_ON)
        });
      }
    }

    absoluteTick = nextStartTick;
  });

  events.push({
    tick: absoluteTick,
    order: 99,
    bytes: buildEndOfTrackEvent()
  });

  return buildTrackChunk(events);
}

function createBassTrack(items) {
  const events = [
    { tick: 0, order: 0, bytes: buildTrackNameEvent(BASS_TRACK_NAME) },
    { tick: 0, order: 1, bytes: buildProgramChangeEvent(BASS_CHANNEL, BASS_PROGRAM) }
  ];
  let absoluteTick = 0;

  items.forEach(item => {
    const bassMidi = getBassMidiForItem(item);
    const durationTicks = normalizeDurationTicks(item?.durationBeats);
    const releasedDurationTicks = getReleasedDurationTicks(durationTicks, item?.sustain);

    if (Number.isFinite(bassMidi)) {
      events.push({
        tick: absoluteTick,
        order: 10,
        bytes: buildNoteOnEvent(BASS_CHANNEL, bassMidi, DEFAULT_NOTE_VELOCITY)
      });
      events.push({
        tick: absoluteTick + releasedDurationTicks,
        order: 40,
        bytes: buildNoteOffEvent(BASS_CHANNEL, bassMidi)
      });
    }

    absoluteTick += durationTicks;
  });

  events.push({
    tick: absoluteTick,
    order: 99,
    bytes: buildEndOfTrackEvent()
  });

  return buildTrackChunk(events);
}

export function buildMidiFileBytes({ items = [], tempoBpm = 120, timeSignature = "4/4" } = {}) {
  const progressionItems = Array.isArray(items)
    ? items.filter(item => String(item?.chord || "").trim())
    : [];

  const headerChunk = buildChunk(MIDI_HEADER_CHUNK_ID, [
    ...numberToBytes(MIDI_FORMAT_TYPE, 2),
    ...numberToBytes(TRACK_COUNT, 2),
    ...numberToBytes(TICKS_PER_BEAT, 2)
  ]);
  const metaTrack = createMetaTrack({ tempoBpm, timeSignature });
  const chordTrack = createChordTrack(progressionItems);
  const bassTrack = createBassTrack(progressionItems);

  return new Uint8Array([
    ...headerChunk,
    ...metaTrack,
    ...chordTrack,
    ...bassTrack
  ]);
}
