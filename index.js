'use strict';
const midifs = require('./src');
const readMIDIFile = midifs.readMIDIFile;
const writeMIDIFile = midifs.writeMIDIFile;

readMIDIFile(process.argv[2])
  .then(data => console.log(JSON.stringify(data, null, 2)))
  .catch(err => {
    console.error(err.stack);
    console.error(err);
    process.exit(1);
  });