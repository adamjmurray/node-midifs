import MIDI from '../midi-constants';
import FileReader from './file-reader';

export default class MIDIFileReader extends FileReader {

  read(filepath) {
    return this
      .open(filepath)
      .then(() => {
        this.readHeader();

        console.log('format type', this.formatType);
        console.log('num tracks', this.numTracks);
        console.log('ticks per beat', this.ticksPerBeat);

        const tracks = [];
        for (let i=0; i<this.numTracks; i++) {
          this.trackNumber = i + 1;
          tracks.push(this.readTrack());
        }
      });
  }

  readHeader() {
    if (this.readUInt32BE() !== MIDI.HEADER_CHUNK_ID) throw 'MIDI format error: Invalid header chuck ID';

    const headerSize = this.readUInt32BE();
    if (headerSize < 6) throw 'Invalid MIDI file: header must be at least 6 bytes';

    this.formatType = this.readUInt16BE();
    this.numTracks = this.readUInt16BE();

    const timeDivision = this.readUInt16BE();
    if (timeDivision & 0x8000) throw 'SMPTE time division format not supported';
    this.ticksPerBeat = timeDivision;

    // ignore extra header bytes
    for (let i=6; i<headerSize; i++) this.readUInt8();
  }

  readTrack() {
    if (this.readUInt32BE() !== MIDI.TRACK_CHUNK_ID) throw 'MIDI format error: Invalid track chuck ID';

    const trackSize = this.readUInt32BE();
    let timeInTicks = 0;
    const track = {};
    this.notes = {};

    console.log('read track with track size', trackSize);

    const endByte = this.byteOffset + trackSize;
    while (this.byteOffset < endByte) {
      timeInTicks += this.readVariableLengthQuantity();
      this.currentTimeInTicks = timeInTicks;
      // events[time] = this.readEvent();
      const event = this.readEvent();
      if (event) {
        let eventTimeInTicks = timeInTicks;
        if (event.timeInTicks != null) {
          // special case for note on / note off pairs
          eventTimeInTicks = event.timeInTicks;
          delete event.timeInTicks;
        }
        console.log('event', event);
        const timeInBeats = timeInTicks / this.ticksPerBeat;
        if (!track[timeInBeats]) track[timeInBeats] = [];
        track[timeInBeats].push(event);

        // TODO: timeInBeats is wrong, some notes are missing
      }
    }

    // TODO: warn about held notes
    console.log(track);
    return track;
  }

  readEvent() {
    const eventType = this.readUInt8();
    switch (eventType) {
      case MIDI.META_EVENT:
        return this.readMetaEvent();
      case MIDI.SYSEX_EVENT:
      case MIDI.SYSEX_CHUNK:
        throw 'Sysex not supported yet';
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
    console.log('event type', eventType.toString(16));
    const type = eventType & 0xF0;
    const channel = (eventType & 0x0F) + 1;
    // TODO: check for running status by examing most signifcant bit
    console.log('type', type);
    console.log('channel', channel);
    switch(type) {
      case MIDI.NOTE_ON:
        return this.readNoteOn();
      case MIDI.NOTE_OFF:
        return this.readNoteOff();
      case MIDI.NOTE_AFTERTOUCH:
        return {
          type: 'note aftertouch',
          pitch: this.readUInt8(),
          value: this.readUInt8(),
        };
      case MIDI.CONTROLLER:
        return {
          type:'controller',
          number: this.readUInt8(),
          value: this.readUInt8(),
        };
      case MIDI.PROGRAM_CHANGE:
        return {
          type: 'program change',
          number: this.readUInt8(),
        };
      case MIDI.CHANNEL_AFTERTOUCH:
        return {
          type:'channel aftertouch',
          value: this.readUInt8(),
        };
      case MIDI.PITCH_BEND:
        return {
          type:'pitch bend',
          value: (this.readUInt8() << 7) + this.readUInt8(),
        };
      /* TODO: move this check up top
      default:
        // "running status" event using same type and channel of previous event
        runningStatus = true
      @stream.feedByte(eventChunkType) # this will be returned by the next @stream.uInt8() call
      @_readChannelEvent(@prevEventChunkType)
*/
      }
        /* TODO:
         unless runningStatus
         event.channel = channel if event
         @prevEventChunkType = eventChunkType
         event
         */

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
        this.notes[pitch] = [velocity, this.currentTimeInTicks];
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
        duration: (this.currentTimeInTicks - startTime) / this.ticksPerBeat,
      };
      if (release != null) event.release = release;
      event.time = startTime; // special case, readTrack() should use this instead of it's time offset
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


