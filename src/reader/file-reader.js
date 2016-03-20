import fs from 'fs';

export default class FileReader {

  open(filepath) {
    this.filepath = filepath;
    return new Promise((resolve, reject) => {
      fs.readFile(filepath, (error, buffer) => {
        if (error) reject(error);
        this.buffer = buffer;
        this.byteOffset = 0;
        resolve();
      });
    });
  }

  // get the next 32 bits as an unsigned integer in big endian byte order
  readUInt32BE() {
    let int = this.buffer.readUInt32BE(this.byteOffset);
    this.byteOffset += 4;
    return int;
  }

  // get the next 16 bits as an unsigned integer in big endian byte order
  readUInt16BE() {
    let int = this.buffer.readUInt16BE(this.byteOffset);
    this.byteOffset += 2;
    return int;
  }

  // get the next 8 bits as an unsigned integer
  readUInt8() {
    let int;
    if (this.nextUInt8) {
      int = this.nextUInt8;
      this.nextUInt8 = null;
    } else {
      int = this.buffer.readUInt8(this.byteOffset);
      this.byteOffset += 1;
    }
    return int;
  }

  // Set the next byte to be returned by int8
  // Can be used for look-ahead purposes
  feedUInt8(nextUInt8) {
    this.nextUInt8 = nextUInt8;
  }

}