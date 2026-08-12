import { describe, expect, it } from "vitest";
import { buildStoreZip, crc32 } from "./zip";

describe("buildStoreZip", () => {
  it("writes standard local, central, and end signatures", () => {
    const archive = buildStoreZip([{ name: "hello.txt", data: new TextEncoder().encode("hello") }]);
    const view = new DataView(archive.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(archive.includes(0x50)).toBe(true);
    expect(view.getUint32(archive.byteLength - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(archive.byteLength - 12, true)).toBe(1);
  });

  it("uses the canonical CRC-32 value", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });
});
