// The bundled OS Open Roads cells (data/os-roads, written by
// scripts/os-roads/refresh.py), read back. Each cell file covers CELL_M by
// CELL_M Web Mercator metres (about 10 km on the ground here) and holds the
// road links that start in it: "OSR1", the names (each "name<TAB>road
// number", one per line), then each link as its name's index, its point
// count, and its points as whole-metre steps from the cell's corner (zigzag
// varints). Coordinates are Web Mercator metres with y running south, as in
// lib/rounds/alignment. Pure.

export type Road = { name: string; ref: string; pts: [number, number][] };
// [west, north, east, south] in Web Mercator metres (y runs south, so north < south).
export type MercatorBox = [number, number, number, number];

export type RoadsManifest = {
  format: number;
  source: string;
  release: string | null;
  licence: string;
  attribution: string;
  cellM: number;
  links: number;
  bytes: number;
  cells: Record<string, { links: number; bytes: number }>;
};

const MAGIC = [0x4f, 0x53, 0x52, 0x31]; // "OSR1"

export function cellKey(cx: number, cy: number): string {
  return `${cx}_${cy}`;
}

// The cells a box touches. Links are stored with the cell they start in, so
// the box is widened by `reachM` to catch links that start just outside it.
export function cellsMeeting(box: MercatorBox, cellM: number, reachM = 3000): string[] {
  const keys: string[] = [];
  for (let cx = Math.floor((box[0] - reachM) / cellM); cx <= Math.floor((box[2] + reachM) / cellM); cx++)
    for (let cy = Math.floor((box[1] - reachM) / cellM); cy <= Math.floor((box[3] + reachM) / cellM); cy++) keys.push(cellKey(cx, cy));
  return keys;
}

export function decodeCell(bytes: Uint8Array, key: string, cellM: number): Road[] {
  for (let i = 0; i < MAGIC.length; i++) if (bytes[i] !== MAGIC[i]) throw new Error(`Road cell ${key} isn't in the expected format.`);
  const [cx, cy] = key.split("_").map(Number);
  let at = MAGIC.length;
  const varint = () => {
    let v = 0;
    let mul = 1;
    for (;;) {
      if (at >= bytes.length) throw new Error(`Road cell ${key} is cut short.`);
      const b = bytes[at++];
      v += (b & 0x7f) * mul;
      if (b < 0x80) return v;
      mul *= 128;
    }
  };
  const signed = () => {
    const v = varint();
    return v % 2 === 0 ? v / 2 : -(v + 1) / 2;
  };
  const namesLength = varint();
  const names = new TextDecoder("utf-8")
    .decode(bytes.subarray(at, at + namesLength))
    .split("\n")
    .map((line) => {
      const tab = line.indexOf("\t");
      return tab < 0 ? { name: line, ref: "" } : { name: line.slice(0, tab), ref: line.slice(tab + 1) };
    });
  at += namesLength;
  const count = varint();
  const roads: Road[] = new Array(count);
  for (let i = 0; i < count; i++) {
    const n = names[varint()] ?? { name: "", ref: "" };
    const length = varint();
    const pts: [number, number][] = new Array(length);
    let x = cx * cellM;
    let y = cy * cellM;
    for (let k = 0; k < length; k++) {
      x += signed();
      y += signed();
      pts[k] = [x, y];
    }
    roads[i] = { name: n.name, ref: n.ref, pts };
  }
  return roads;
}

export function roadBox(road: Road): MercatorBox {
  let w = Infinity;
  let n = Infinity;
  let e = -Infinity;
  let s = -Infinity;
  for (const [x, y] of road.pts) {
    if (x < w) w = x;
    if (x > e) e = x;
    if (y < n) n = y;
    if (y > s) s = y;
  }
  return [w, n, e, s];
}

export const boxesMeet = (a: MercatorBox, b: MercatorBox) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
