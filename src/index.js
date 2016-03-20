import fs from 'fs';
import MIDIFileReader from './reader/midi-file-reader';

function readMIDIFile(filepath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filepath, (error, buffer) => {
      if (error) reject(error);
      const arrayBuffer = new Uint8Array(buffer).buffer;
      const reader = new MIDIFileReader(arrayBuffer);
      resolve(reader.toJSON());
    });
  });
}

function writeMIDIFile(filepath, data) {
  throw 'Not implemented';
}

export {
  readMIDIFile,
  writeMIDIFile,
}
