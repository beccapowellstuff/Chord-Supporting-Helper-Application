function readVariableLengthQuantity(bytes, startIndex) {
  let value = 0;
  let index = startIndex;

  while (index < bytes.length) {
    const nextByte = bytes[index];
    value = (value << 7) | (nextByte & 0x7f);
    index += 1;

    if ((nextByte & 0x80) === 0) {
      return { value, nextIndex: index };
    }
  }

  throw new Error("Invalid variable-length quantity.");
}

function readAscii(bytes, start, length) {
  return Buffer.from(bytes.slice(start, start + length)).toString("ascii");
}

function readUInt16(bytes, start) {
  return (bytes[start] << 8) | bytes[start + 1];
}

function readUInt32(bytes, start) {
  return (
    (bytes[start] * 0x1000000) +
    (bytes[start + 1] << 16) +
    (bytes[start + 2] << 8) +
    bytes[start + 3]
  );
}

function parseTrackEvents(bytes) {
  const events = [];
  let index = 0;
  let absoluteTick = 0;
  let runningStatus = null;

  while (index < bytes.length) {
    const delta = readVariableLengthQuantity(bytes, index);
    absoluteTick += delta.value;
    index = delta.nextIndex;

    let status = bytes[index];
    if (status == null) {
      break;
    }

    if (status < 0x80) {
      if (runningStatus == null) {
        throw new Error("Running status encountered without a prior status byte.");
      }
      status = runningStatus;
    } else {
      index += 1;
      runningStatus = status < 0xf0 ? status : null;
    }

    if (status === 0xff) {
      const metaType = bytes[index];
      index += 1;
      const lengthInfo = readVariableLengthQuantity(bytes, index);
      index = lengthInfo.nextIndex;
      const data = bytes.slice(index, index + lengthInfo.value);
      index += lengthInfo.value;
      events.push({
        tick: absoluteTick,
        type: "meta",
        metaType,
        data
      });
      if (metaType === 0x2f) {
        break;
      }
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      const lengthInfo = readVariableLengthQuantity(bytes, index);
      index = lengthInfo.nextIndex + lengthInfo.value;
      events.push({
        tick: absoluteTick,
        type: "sysex"
      });
      continue;
    }

    const messageType = status & 0xf0;
    const channel = status & 0x0f;
    const firstDataByte = bytes[index];
    index += 1;
    let secondDataByte = null;

    if (![0xc0, 0xd0].includes(messageType)) {
      secondDataByte = bytes[index];
      index += 1;
    }

    if (messageType === 0x90) {
      events.push({
        tick: absoluteTick,
        type: secondDataByte === 0 ? "noteOff" : "noteOn",
        channel,
        noteNumber: firstDataByte,
        velocity: secondDataByte
      });
      continue;
    }

    if (messageType === 0x80) {
      events.push({
        tick: absoluteTick,
        type: "noteOff",
        channel,
        noteNumber: firstDataByte,
        velocity: secondDataByte
      });
      continue;
    }

    if (messageType === 0xb0) {
      events.push({
        tick: absoluteTick,
        type: "controlChange",
        channel,
        controller: firstDataByte,
        value: secondDataByte
      });
      continue;
    }

    if (messageType === 0xc0) {
      events.push({
        tick: absoluteTick,
        type: "programChange",
        channel,
        programNumber: firstDataByte
      });
    }
  }

  return events;
}

export function parseMidiFile(rawFile) {
  const bytes = rawFile instanceof Uint8Array ? rawFile : new Uint8Array(rawFile);
  if (readAscii(bytes, 0, 4) !== "MThd") {
    throw new Error("Invalid MIDI header chunk.");
  }

  const headerLength = readUInt32(bytes, 4);
  const formatType = readUInt16(bytes, 8);
  const trackCount = readUInt16(bytes, 10);
  const division = readUInt16(bytes, 12);
  const tracks = [];
  let index = 8 + headerLength;

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    if (readAscii(bytes, index, 4) !== "MTrk") {
      throw new Error("Invalid MIDI track chunk.");
    }

    const trackLength = readUInt32(bytes, index + 4);
    const trackDataStart = index + 8;
    const trackBytes = bytes.slice(trackDataStart, trackDataStart + trackLength);
    const events = parseTrackEvents(trackBytes);
    const trackNameEvent = events.find(event => event.type === "meta" && event.metaType === 0x03);

    tracks.push({
      name: trackNameEvent ? Buffer.from(trackNameEvent.data).toString("utf8") : "",
      events
    });

    index = trackDataStart + trackLength;
  }

  return {
    headerLength,
    formatType,
    trackCount,
    division,
    tracks
  };
}
