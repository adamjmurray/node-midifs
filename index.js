import { readMIDIFile } from './src';

readMIDIFile(process.argv[2])
  .catch(err => {
    console.error(err.stack);
    console.error(err);
    process.exit(1);
  });