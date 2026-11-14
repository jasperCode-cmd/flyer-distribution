import { scaleFor, type Crop, type Point, type RgbaImage } from "./extract/image";

// Apple's compass, which MapMyRun's map shows (top right, just under the
// band) only when the map has been turned away from north: a dark dial with
// tick marks, an upright white "N" in the middle and a red marker on the
// rim pointing north. Where it shows, the marker's angle round the "N" is the
// map's turn, to within a degree or two (a pixel at the marker is about two
// degrees): on a real screenshot turned about 8 degrees it read 8.5 to 9.6
// at different sizes. Enough to start a line-up from and to narrow the
// automatic search, which then measures the turn exactly. Pure.

export type Compass = {
  centre: Point;
  // The dial's radius, for leaving it out of matching.
  radius: number;
  // The map's turn, clockwise in degrees as alignment.ts's Transform has it
  // (the marker sitting 7 degrees clockwise of the top means -7).
  turnDeg: number;
};

// At full working size (1600 tall): the marker's distance from the centre
// (27 px measured), and the dial's radius.
const MARKER_RADIUS_PX = 27;
const DIAL_RADIUS_PX = 37;

const isMarker = (r: number, g: number, b: number) => r > 170 && g < 90 && b < 90 && r - g > 100;
const isLetter = (r: number, g: number, b: number) => {
  const lo = Math.min(r, g, b);
  return lo >= 190 && Math.max(r, g, b) - lo <= 35;
};

export function findCompass(img: RgbaImage, crop: Crop): Compass | null {
  const { width: w, height: h, data } = img;
  const k = scaleFor(img);
  const x0 = Math.floor(w * 0.7);
  const y0 = crop.top;
  const y1 = Math.min(h, crop.top + Math.round(h * 0.16));
  // The marker: a small cluster of strong red (the start dot is far bigger).
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isMarker(data[i], data[i + 1], data[i + 2])) {
        n++;
        sx += x;
        sy += y;
      }
    }
  }
  if (n < 8 * k * k || n > 140 * k * k) return null;
  const marker: Point = [sx / n, sy / n];
  // Every red pixel near the marker's middle: one small triangle, not scattered red.
  const spread = MARKER_RADIUS_PX * k * 0.5;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (isMarker(data[i], data[i + 1], data[i + 2]) && Math.hypot(x - marker[0], y - marker[1]) > spread) return null;
    }
  }
  // The "N": the most white within a letter's reach of a point the marker's
  // distance away, then the middle of that white.
  const reach = MARKER_RADIUS_PX * k;
  const letter = 11 * k;
  // The letter's middle: halfway across its white each way (an "N" is the
  // same turned half round, so this is its centre however it is blurred).
  const white = (cx: number, cy: number) => {
    let c = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let y = Math.floor(cy - letter); y <= cy + letter; y++) {
      for (let x = Math.floor(cx - letter); x <= cx + letter; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h || Math.hypot(x - cx, y - cy) > letter) continue;
        const i = (y * w + x) * 4;
        if (isLetter(data[i], data[i + 1], data[i + 2])) {
          c++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    return { c, at: c ? ([(minX + maxX) / 2, (minY + maxY) / 2] as Point) : null };
  };
  let best: { c: number; at: Point | null } = { c: 0, at: null };
  for (let deg = -40; deg <= 40; deg += 2) {
    const r = (deg * Math.PI) / 180;
    const found = white(marker[0] - Math.sin(r) * reach, marker[1] + Math.cos(r) * reach);
    if (found.c > best.c) best = found;
  }
  if (!best.at || best.c < 60 * k * k) return null;
  // Settle on the middle of the letter's white.
  let centre = best.at;
  for (let it = 0; it < 3; it++) {
    const again = white(centre[0], centre[1]);
    if (!again.at) break;
    centre = again.at;
  }
  const dist = Math.hypot(marker[0] - centre[0], marker[1] - centre[1]);
  if (dist < reach * 0.7 || dist > reach * 1.3) return null;
  const clockwise = (Math.atan2(marker[0] - centre[0], centre[1] - marker[1]) * 180) / Math.PI;
  if (Math.abs(clockwise) > 45) return null;
  return { centre, radius: DIAL_RADIUS_PX * k, turnDeg: Math.round(-clockwise * 100) / 100 };
}
