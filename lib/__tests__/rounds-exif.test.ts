import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { imageTimeInstant, readImageTime, readTiffTime } from "@/lib/rounds/exif";

// The screenshot's own time, to fill in a round's date: from a PNG's eXIf
// chunk (iPhone screenshots), a JPEG's EXIF, or XMP; nothing when a file has
// none (a forwarded JPEG). Files made up here.

// A minimal little- or big-endian TIFF block with IFD0 DateTime and an Exif
// IFD holding DateTimeOriginal and OffsetTimeOriginal.
function tiff(little: boolean, values: { dateTime?: string; original?: string; offset?: string }): Uint8Array {
  const entries0: [number, string][] = [];
  if (values.dateTime) entries0.push([0x0132, values.dateTime]);
  const exifEntries: [number, string][] = [];
  if (values.original) exifEntries.push([0x9003, values.original]);
  if (values.offset) exifEntries.push([0x9011, values.offset]);
  const buf = new Uint8Array(512);
  const view = new DataView(buf.buffer);
  const u16 = (o: number, v: number) => view.setUint16(o, v, little);
  const u32 = (o: number, v: number) => view.setUint32(o, v, little);
  buf[0] = buf[1] = little ? 0x49 : 0x4d;
  u16(2, 42);
  u32(4, 8);
  let data = 300;
  const writeIfd = (at: number, entries: [number, string][], exifPointer: number | null) => {
    const all = exifPointer === null ? entries : [...entries, [0x8769, ""] as [number, string]];
    u16(at, all.length);
    all.forEach(([tag, text], i) => {
      const e = at + 2 + i * 12;
      u16(e, tag);
      if (tag === 0x8769) {
        u16(e + 2, 4);
        u32(e + 4, 1);
        u32(e + 8, exifPointer!);
        return;
      }
      u16(e + 2, 2);
      u32(e + 4, text.length + 1);
      u32(e + 8, data);
      for (let k = 0; k < text.length; k++) buf[data + k] = text.charCodeAt(k);
      data += text.length + 1;
    });
    u32(at + 2 + all.length * 12, 0);
  };
  writeIfd(8, entries0, exifEntries.length ? 120 : null);
  if (exifEntries.length) writeIfd(120, exifEntries, null);
  return buf;
}

function crc32(bytes: Uint8Array): number {
  let c = ~0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

// A real PNG with one extra chunk spliced in before IDAT.
async function pngWith(type: string, body: Uint8Array): Promise<Uint8Array> {
  const png = new Uint8Array(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#079be5" } }).png().toBuffer());
  const chunk = new Uint8Array(12 + body.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, body.length);
  for (let k = 0; k < 4; k++) chunk[4 + k] = type.charCodeAt(k);
  chunk.set(body, 8);
  view.setUint32(8 + body.length, crc32(chunk.subarray(4, 8 + body.length)));
  // After the IHDR chunk (8 signature + 25 IHDR bytes).
  return new Uint8Array([...png.subarray(0, 33), ...chunk, ...png.subarray(33)]);
}

test("a TIFF block: DateTimeOriginal with its time zone first, either byte order", () => {
  for (const little of [true, false]) {
    assert.deepEqual(readTiffTime(tiff(little, { dateTime: "2026:11:10 18:00:00", original: "2026:11:10 14:32:05", offset: "+00:00" })), {
      date: "2026-11-10",
      time: "14:32:05",
      offset: "+00:00",
    });
    assert.deepEqual(readTiffTime(tiff(little, { dateTime: "2026:07:01 09:05:00" })), { date: "2026-07-01", time: "09:05:00", offset: null });
  }
  assert.equal(readTiffTime(tiff(true, {})), null);
  assert.equal(readTiffTime(tiff(true, { dateTime: "not a date at all" })), null);
  assert.equal(readTiffTime(new Uint8Array([1, 2, 3])), null);
});

test("an iPhone-style PNG screenshot with an eXIf chunk", async () => {
  const png = await pngWith("eXIf", tiff(false, { original: "2026:11:10 14:32:05", offset: "+00:00" }));
  assert.deepEqual(readImageTime(png), { date: "2026-11-10", time: "14:32:05", offset: "+00:00" });
});

test("a PNG with only an XMP packet", async () => {
  const xmp = new TextEncoder().encode('XML:com.adobe.xmp\0\0\0\0\0<x:xmpmeta><rdf:Description xmp:CreateDate="2026-10-03T08:15:42+01:00"/></x:xmpmeta>');
  const png = await pngWith("iTXt", xmp);
  assert.deepEqual(readImageTime(png), { date: "2026-10-03", time: "08:15:42", offset: "+01:00" });
});

test("a JPEG with EXIF, and a forwarded JPEG with none", async () => {
  const plain = new Uint8Array(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#079be5" } }).jpeg().toBuffer());
  assert.equal(readImageTime(plain), null);
  const exif = tiff(true, { dateTime: "2026:09:30 16:45:10" });
  const app1Body = new Uint8Array([...new TextEncoder().encode("Exif\0\0"), ...exif]);
  const app1 = new Uint8Array([0xff, 0xe1, (app1Body.length + 2) >> 8, (app1Body.length + 2) & 0xff, ...app1Body]);
  const jpeg = new Uint8Array([...plain.subarray(0, 2), ...app1, ...plain.subarray(2)]);
  assert.deepEqual(readImageTime(jpeg), { date: "2026-09-30", time: "16:45:10", offset: null });
});

test("a PNG without metadata, and anything that isn't a PNG or JPEG", async () => {
  const png = new Uint8Array(await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).png().toBuffer());
  assert.equal(readImageTime(png), null);
  assert.equal(readImageTime(new TextEncoder().encode("GIF89a....")), null);
  assert.equal(readImageTime(new Uint8Array()), null);
});

test("the moment stored: the file's own time zone, otherwise UK time (summer and winter)", () => {
  assert.equal(imageTimeInstant({ date: "2026-11-10", time: "14:32:05", offset: "+00:00" }).toISOString(), "2026-11-10T14:32:05.000Z");
  assert.equal(imageTimeInstant({ date: "2026-07-01", time: "09:05:00", offset: null }).toISOString(), "2026-07-01T08:05:00.000Z");
  assert.equal(imageTimeInstant({ date: "2026-12-01", time: "09:05:00", offset: null }).toISOString(), "2026-12-01T09:05:00.000Z");
});
