import MIDIFileReader from './reader/midi-file-reader';

function readMIDIFile(filepath) {
  return new MIDIFileReader().read(filepath);
}

function writeMIDIFile(filepath, data) {
  throw 'Not implemented';
}

export {
  readMIDIFile,
  writeMIDIFile,
}
