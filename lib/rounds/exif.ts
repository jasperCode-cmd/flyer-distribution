// When a screenshot was taken, from the file's own metadata, to fill in the
// round's date: EXIF DateTimeOriginal (or DateTime) in a PNG's eXIf chunk or
// a JPEG's APP1 segment, or the XMP creation date either may carry. iPhone
// PNG screenshots have one; a forwarded JPEG often has none. Pure, so the
// browser reads the file it was given and the tests use made-up files.

export type ImageTime = {
  // The local date and time the phone showed, as written in the file.
  date: string; // "2026-11-10"
  time: string; // "14:32:05"
  // "+01:00" when the file says which time zone that was, otherwise null.
  offset: string | null;
};

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const EXIF_DATE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;
const XMP_DATE = /(?:exif:DateTimeOriginal|xmp:CreateDate|photoshop:DateCreated)\s*(?:=\s*"|>)\s*(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?/;
const OFFSET = /^[+-]\d{2}:\d{2}$/;

const TAG_DATE_TIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATE_TIME_ORIGINAL = 0x9003;
const TAG_OFFSET_TIME = 0x9010;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;

function validDate(y: number, m: number, d: number, h: number, min: number, s: number): boolean {
  return y >= 2000 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 && h <= 23 && min <= 59 && s <= 60;
}

function fromParts(parts: string[], offset: string | null): ImageTime | null {
  const [y, m, d, h, min, s] = parts.map((p) => Number(p ?? 0));
  if (!validDate(y, m, d, h, min, s)) return null;
  const two = (n: number) => String(n).padStart(2, "0");
  return { date: `${y}-${two(m)}-${two(d)}`, time: `${two(h)}:${two(min)}:${two(s)}`, offset };
}

// An EXIF block (the TIFF structure after "Exif\0\0"): the IFD0 and Exif IFD
// date tags.
export function readTiffTime(bytes: Uint8Array, start = 0): ImageTime | null {
  if (bytes.length < start + 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, bytes.length - start);
  const order = view.getUint16(0);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const little = order === 0x4949;
  const u16 = (o: number) => view.getUint16(o, little);
  const u32 = (o: number) => view.getUint32(o, little);
  if (u16(2) !== 42) return null;

  const ascii = (entry: number): string | null => {
    const type = u16(entry + 2);
    const count = u32(entry + 4);
    if (type !== 2 || count === 0 || count > 64) return null;
    const at = count <= 4 ? entry + 8 : u32(entry + 8);
    if (at + count > view.byteLength) return null;
    let text = "";
    for (let i = 0; i < count; i++) {
      const c = view.getUint8(at + i);
      if (c === 0) break;
      text += String.fromCharCode(c);
    }
    return text;
  };

  const tags = new Map<number, string>();
  let exifIfd: number | null = null;
  const readIfd = (offset: number, wantExifPointer: boolean) => {
    if (offset < 8 || offset + 2 > view.byteLength) return;
    const n = u16(offset);
    if (n > 500 || offset + 2 + n * 12 > view.byteLength) return;
    for (let i = 0; i < n; i++) {
      const entry = offset + 2 + i * 12;
      const tag = u16(entry);
      if (wantExifPointer && tag === TAG_EXIF_IFD) exifIfd = u32(entry + 8);
      else if ([TAG_DATE_TIME, TAG_DATE_TIME_ORIGINAL, TAG_OFFSET_TIME, TAG_OFFSET_TIME_ORIGINAL].includes(tag)) {
        const value = ascii(entry);
        if (value) tags.set(tag, value.trim());
      }
    }
  };
  readIfd(u32(4), true);
  if (exifIfd !== null) readIfd(exifIfd, false);

  for (const [dateTag, offsetTag] of [
    [TAG_DATE_TIME_ORIGINAL, TAG_OFFSET_TIME_ORIGINAL],
    [TAG_DATE_TIME, TAG_OFFSET_TIME],
  ]) {
    const match = EXIF_DATE.exec(tags.get(dateTag) ?? "");
    if (!match) continue;
    const offset = tags.get(offsetTag) ?? tags.get(TAG_OFFSET_TIME_ORIGINAL) ?? tags.get(TAG_OFFSET_TIME) ?? null;
    const time = fromParts(match.slice(1, 7), offset && OFFSET.test(offset) ? offset : null);
    if (time) return time;
  }
  return null;
}

function readXmpTime(text: string): ImageTime | null {
  const match = XMP_DATE.exec(text);
  if (!match) return null;
  const zone = match[7] ?? null;
  return fromParts(match.slice(1, 7), zone === "Z" ? "+00:00" : zone);
}

function latin1(bytes: Uint8Array, start: number, end: number): string {
  let text = "";
  for (let i = start; i < end; i++) text += String.fromCharCode(bytes[i]);
  return text;
}

function pngTime(bytes: Uint8Array): ImageTime | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let xmp: ImageTime | null = null;
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const type = latin1(bytes, at + 4, at + 8);
    const data = at + 8;
    if (data + length > bytes.length) break;
    if (type === "eXIf") {
      const time = readTiffTime(bytes.subarray(data, data + length));
      if (time) return time;
    } else if ((type === "iTXt" || type === "tEXt") && !xmp) {
      // Only the XMP packet; compressed iTXt is skipped.
      const keywordEnd = bytes.indexOf(0, data);
      if (keywordEnd > data && keywordEnd < data + length && latin1(bytes, data, keywordEnd) === "XML:com.adobe.xmp") {
        xmp = readXmpTime(latin1(bytes, keywordEnd + 1, data + length));
      }
    } else if (type === "IEND") break;
    at = data + length + 4;
  }
  return xmp;
}

function jpegTime(bytes: Uint8Array): ImageTime | null {
  let xmp: ImageTime | null = null;
  let at = 2;
  while (at + 4 <= bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break;
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    const data = at + 4;
    const end = at + 2 + length;
    if (length < 2 || end > bytes.length) break;
    if (marker === 0xe1) {
      if (latin1(bytes, data, data + 6) === "Exif\0\0") {
        const time = readTiffTime(bytes.subarray(data + 6, end));
        if (time) return time;
      } else if (!xmp && latin1(bytes, data, data + 28) === "http://ns.adobe.com/xap/1.0/") {
        xmp = readXmpTime(latin1(bytes, data, end));
      }
    }
    at = end;
  }
  return xmp;
}

export function readImageTime(bytes: Uint8Array): ImageTime | null {
  if (bytes.length > 8 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return pngTime(bytes);
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegTime(bytes);
  return null;
}

// The moment, for storing: with the file's own time zone where it gives one,
// otherwise as UK time, where the rounds are walked.
export function imageTimeInstant(time: ImageTime): Date {
  if (time.offset) return new Date(`${time.date}T${time.time}${time.offset}`);
  const asUtc = new Date(`${time.date}T${time.time}Z`);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "longOffset" }).formatToParts(asUtc);
  const zone = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(zone);
  const offsetMin = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(asUtc.getTime() - offsetMin * 60 * 1000);
}
