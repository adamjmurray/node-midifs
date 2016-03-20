export default Object.freeze({

  HEADER_CHUNK_ID: 0x4D546864, // "MThd"
  TRACK_CHUNK_ID: 0x4D54726B, // "MTrk"

  MICROSECONDS_PER_MINUTE: 60000000,

  META_EVENT: 0xFF,
  SYSEX_EVENT: 0xF0,
  SYSEX_CHUNK: 0xF7, // a continuation of a normal SysEx event

  // Meta event types
  SEQ_NUMBER: 0x00,
  TEXT: 0x01,
  COPYRIGHT: 0x02,
  SEQ_NAME: 0x03,
  INSTRUMENT_NAME: 0x04,
  LYRICS: 0x05,
  MARKER: 0x06,
  CUE_POINT: 0x07,
  CHANNEL_PREFIX: 0x20,
  END_OF_TRACK: 0x2F,
  TEMPO: 0x51,
  SMPTE_OFFSET: 0x54,
  TIME_SIGNATURE: 0x58,
  KEY_SIGNATURE: 0x59,
  SEQ_SPECIFIC: 0x7F,

  // Channel event types
  NOTE_OFF: 0x80,
  NOTE_ON: 0x90,
  NOTE_AFTERTOUCH: 0xA0,
  CONTROLLER: 0xB0,
  PROGRAM_CHANGE: 0xC0,
  CHANNEL_AFTERTOUCH: 0xD0,
  PITCH_BEND: 0xE0,

  KEY_VALUE_TO_NAME: Object.freeze({
    0: 'C',
    1: 'G',
    2: 'D',
    3: 'A',
    4: 'E',
    5: 'B',
    6: 'F#',
    7: 'C#',
    '-1': 'F',
    '-2': 'Bb',
    '-3': 'Eb',
    '-4': 'Ab',
    '-5': 'Db',
    '-6': 'Gb',
    '-7': 'Cb'
  }),
});
