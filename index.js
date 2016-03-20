import { readMIDIFile } from './src';

readMIDIFile(process.argv[2])
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => {
    console.error(err.stack);
    console.error(err);
    process.exit(1);
  });