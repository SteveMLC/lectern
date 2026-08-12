/** Tiny, dependency-free ZIP writer for Cloudflare Workers. Files are stored
 * without compression: predictable memory, universally readable output. */

export interface ZipFile {
  name: string;
  data: Uint8Array;
  modifiedAt?: Date;
}

const encoder = new TextEncoder();

const crcTable = new Uint32Array(256).map((_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { date: number; time: number } {
  const year = Math.min(2107, Math.max(1980, date.getUTCFullYear()));
  return {
    date: ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate(),
    time: (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2),
  };
}

function join(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.byteLength; }
  return output;
}

export function buildStoreZip(files: ZipFile[]): Uint8Array {
  if (files.length > 0xffff) throw new RangeError("ZIP supports at most 65,535 files.");
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name.replace(/\\/g, "/"));
    if (name.byteLength > 0xffff) throw new RangeError("ZIP filename is too long.");
    const checksum = crc32(file.data);
    const stamp = dosDateTime(file.modifiedAt ?? new Date("1980-01-01T00:00:00Z"));
    const local = new Uint8Array(30 + name.byteLength);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true); lv.setUint16(10, stamp.time, true); lv.setUint16(12, stamp.date, true);
    lv.setUint32(14, checksum, true); lv.setUint32(18, file.data.byteLength, true); lv.setUint32(22, file.data.byteLength, true);
    lv.setUint16(26, name.byteLength, true); lv.setUint16(28, 0, true); local.set(name, 30);
    locals.push(local, file.data);

    const central = new Uint8Array(46 + name.byteLength);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, stamp.time, true); cv.setUint16(14, stamp.date, true);
    cv.setUint32(16, checksum, true); cv.setUint32(20, file.data.byteLength, true); cv.setUint32(24, file.data.byteLength, true);
    cv.setUint16(28, name.byteLength, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, localOffset, true);
    central.set(name, 46); centrals.push(central);
    localOffset += local.byteLength + file.data.byteLength;
  }

  const centralDirectory = join(centrals);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralDirectory.byteLength, true); ev.setUint32(16, localOffset, true); ev.setUint16(20, 0, true);
  return join([...locals, centralDirectory, end]);
}
