import { readMIDIFile, writeMIDIFile } from './src';

readMIDIFile(process.argv[2])
  .then(midiJSON => writeMIDIFile('write-test.mid', midiJSON))
  .then(() => console.log('Successfully wrote write-test.mid'))
  .then(() => readMIDIFile('write-test.mid'))
  .then(midiJSON => console.log('re-read from written file', JSON.stringify(midiJSON, null, 2)))
  .catch(err => {
    console.error(err.stack);
    console.error(err);
    process.exit(1);
  });