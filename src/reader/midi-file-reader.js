import MIDI from '../midi-constants';
import FileReader from './file-reader';

// TODO: FileReader should be passed in to the constructor, so this can be adjusted to work outside of Node
export default class MIDIFileReader extends FileReader {

  read(filepath) {
    return this
      .open(filepath)
      .then(() => {
        const header = this.readHeader();

        if (header.division & 0x8000) throw 'SMPTE time division format not supported';
        this.ticksPerBeat = header.division;

        const tracks = [];
        for (let i=0; i<header.ntracks; i++) {
          this.trackNumber = i + 1;
          tracks.push(this.readTrack());
        }

        return {
          header,
          tracks,
        }
      });
  }

  readHeader() {
    if (this.readUInt32BE() !== MIDI.HEADER_CHUNK_ID) throw 'MIDI format error: Invalid header chuck ID';
    const headerSize = this.readUInt32BE();
    if (headerSize < 6) throw 'Invalid MIDI file: header must be at least 6 bytes';

    const format = this.readUInt16BE();
    const ntracks = this.readUInt16BE(); // number of tracks
    const division = this.readUInt16BE();

    // ignore extra header bytes
    for (let i=6; i<headerSize; i++) this.readUInt8();

    return {
      format,
      ntracks,
      division,
    }
  }

  readTrack() {
    if (this.readUInt32BE() !== MIDI.TRACK_CHUNK_ID) throw 'MIDI format error: Invalid track chuck ID';

    const trackSize = this.readUInt32BE();

    const track = {};
    this.timeInTicks = 0;
    this.notes = {};

    const endByte = this.byteOffset + trackSize;
    while (this.byteOffset < endByte) {
      this.timeInTicks += this.readVariableLengthQuantity();

      const event = this.readEvent();
      // console.log(`at ${timeInTicks}, got ${JSON.stringify(event)}`);
      if (event) {
        let timeInTicks;
        if (event.timeInTicks == null) {
          timeInTicks = this.timeInTicks;
        } else {
          // special case for note on / note off pairs
          timeInTicks = event.timeInTicks;
          delete event.timeInTicks;
        }
        const timeInBeats = timeInTicks / this.ticksPerBeat;
        if (!track[timeInBeats]) track[timeInBeats] = [];
        track[timeInBeats].push(event);
      }
    }

    // TODO: warn about held notes (if DEBUG for this lib is enabled?)

    return track;
  }

  readEvent() {
    const eventType = this.readUInt8();
    switch (eventType) {
      case MIDI.META_EVENT:
        return this.readMetaEvent();
      case MIDI.SYSEX_EVENT:
      case MIDI.SYSEX_CHUNK:
        throw 'Sysex not supported yet'; // TODO
      default:
        return this.readMessage(eventType);
    }
  }

  readMetaEvent() {
    const type = this.readUInt8();
    switch (type) {
      case MIDI.SEQ_NUMBER:
        return {
          type: 'sequence number',
          number: this.readMetaValue()
        };
      case MIDI.TEXT:
        return {
          type: 'text',
          text: this.readMetaText()
        };
      case MIDI.COPYRIGHT:
        return {
          type: 'copyright',
          text: this.readMetaText(),
        };
      case MIDI.SEQ_NAME:
        return {
          type: 'sequence name',
          text: this.readMetaText(),
        };
      case MIDI.INSTRUMENT_NAME:
        return {
          type: 'instrument name',
          text: this.readMetaText(),
        };
      case MIDI.LYRICS:
        return {
          type: 'lyrics',
          text: this.readMetaText(),
        };
      case MIDI.MARKER:
        return {
          type: 'marker',
          text: this.readMetaText(),
        };
      case MIDI.CUE_POINT:
        return {
          type: 'cue point',
          text: this.readMetaText(),
        };
      case MIDI.CHANNEL_PREFIX:
        return {
          type: 'channel prefix',
          channel: this.readMetaValue(),
        };
      case MIDI.END_OF_TRACK:
        this.readMetaData(); // should be empty
        return {
          type: 'end of track',
        };
      case MIDI.TEMPO:
        return {
          type: 'tempo',
          bpm: MIDI.MICROSECONDS_PER_MINUTE / this.readMetaValue(),
        };
      case MIDI.SMPTE_OFFSET:
        return {
          type: 'smpte offset',
          data: this.readMetaData(),
        };
      case MIDI.TIME_SIGNATURE:
        const [numerator, denominatorPower] = this.readMetaData();
        return {
          type: 'time signature',
          numerator: numerator,
          denominator: Math.pow(2, denominatorPower)
        };
      case MIDI.KEY_SIGNATURE:
        const [keyValue, scaleValue] = this.readMetaData();
        const key = MIDI.KEY_VALUE_TO_NAME[keyValue] || `unknown ${keyValue}`;
        const scale = scaleValue === 0 ? 'major' : scaleValue === 1 ? 'minor' : `unknown ${scaleValue}`;
        return {
          type: 'key signature',
          key: key,
          scale: scale,
        };
      case MIDI.SEQ_SPECIFIC:
        return {
          type: 'sequencer specific',
          data: this.readMetaData(),
        };
      default:
        return {
          type: `unknown meta event 0x${type.toString(16)}`,
          data: this.readMetaData(),
        };
    }
  }

  readMetaValue() {
    const length = this.readVariableLengthQuantity();
    let value = 0;
    for (let i=0; i<length; i++) {
      value = (value << 8) + this.readUInt8();
    }
    return value;
  }

  readMetaText() {
    return String.fromCharCode(...this.readMetaData());
  };

  readMetaData() {
    const length = this.readVariableLengthQuantity();
    const data = [];
    for (let i=0; i<length; i++) {
      data.push(this.readUInt8());
    }
    return data;
  };


  readMessage(eventType) {
    let type;
    let channel;
    if (eventType & 0x80) {
      this.messageType = type = eventType & 0xF0;
      this.channel = channel = (eventType & 0x0F) + 1;
    }
    else {
      // This is a running status byte, reuse type and channel from last message:
      type = this.messageType;
      channel = this.channel;
      // And the byte we thought was eventType is really the next data byte,
      // so feed it back into the file reader to get it from the next readUInt8() call below
      this.feedUInt8(eventType);
    }

    let event;
    switch(type) {
      case MIDI.NOTE_ON:
        this.readNoteOn();
        return null; // note event will be created via corresponding note off
      case MIDI.NOTE_OFF:
        event = this.readNoteOff();
        break;
      case MIDI.NOTE_AFTERTOUCH:
        event = {
          type: 'note aftertouch',
          pitch: this.readUInt8(),
          value: this.readUInt8(),
        };
        break;
      case MIDI.CONTROLLER:
        event = {
          type: 'controller',
          number: this.readUInt8(),
          value: this.readUInt8(),
        };
        break;
      case MIDI.PROGRAM_CHANGE:
        event = {
          type: 'program change',
          number: this.readUInt8(),
        };
        break;
      case MIDI.CHANNEL_AFTERTOUCH:
        event = {
          type: 'channel aftertouch',
          value: this.readUInt8(),
        };
        break;
      case MIDI.PITCH_BEND:
        event = {
          type: 'pitch bend',
          value: (this.readUInt8() << 7) + this.readUInt8(),
        };
        break;
      default:
        // TODO: handle "system realtime messages", etc
        // TODO: I think the correct thing to do here is to keep
        // reading bytes until we get to the next one where (byte & 0x80) is truthy, then feed it back to the reader
        throw `ERROR: unexpected message ${type}`;
    }
    event.channel = channel;
    return event;
  }

  readNoteOn() {
    const pitch = this.readUInt8();
    const velocity = this.readUInt8();
    if (velocity === 0) {
      // handle as a note off without an off velocity
      this.readNoteOff(pitch);
    }
    else {
      if (this.notes[pitch]) {
        // TODO, support this case?
        console.log(`Warning: ignoring overlapping note on track number ${this.trackNumber} for pitch ${pitch}`);
      }
      else {
        this.notes[pitch] = [velocity, this.timeInTicks];
      }
    }
    return null; /// we'll create a "note" event when we see the corresponding note_off
  }

  readNoteOff(pitch) {
    let release;
    if (pitch == null) {
      pitch = this.readUInt8();
      release = this.readUInt8(); // AKA off velocity
    } // else pitch was passed in from readNoteOn() when a velocity of 0 was encountered

    if (this.notes[pitch]) {
      const [velocity, startTime] = this.notes[pitch];
      delete this.notes[pitch];
      const event = {
        type: 'note',
        pitch: pitch,
        velocity: velocity,
        duration: (this.timeInTicks - startTime) / this.ticksPerBeat,
      };
      if (release != null) event.release = release;
      event.timeInTicks = startTime; // special case, readTrack() should use this instead of it's time offset
      return event;
    }
    else console.log(`Warning: ignoring unmatched note off event on track ${this.trackNumber} for pitch ${pitch}`);
  }

  readVariableLengthQuantity() {
    let data = 0;
    let byte = this.readUInt8();
    while (byte & 0x80) {
      data = (data << 7) + (byte & 0x7F);
      byte = this.readUInt8();
    }
    return (data << 7) + (byte & 0x7F);
  };
}


