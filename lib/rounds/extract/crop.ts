import { fullCrop, scaleFor, type Crop, type RgbaImage } from "./image";

// Finding the map in a MapMyRun screenshot. At the top, the phone's status
// bar, the back button and the NORMAL / HYBRID / SATELLITE tabs sit on a
// plain dark band, down to about row 357 of 2048 on an iPhone screenshot. It
// also holds the blue underline under HYBRID and a blue location arrow, so
// it is always cropped off and never traced. There is no band at the
// bottom: the "Route Flyover" button and the Apple Maps logo and "Legal"
// float over the map, and the route can run under them to the bottom edge,
// so the bottom is never cropped; the tracing leaves those floating pieces
// out itself (see mask.ts).
//
// A row counts as plain when most of it barely changes from pixel to pixel
// (text, buttons and the underline only change a small part of a row). The
// map starts where the first run of textured rows begins. If the top rows
// are plain but no map is found below them in the top third (a smooth field
// or the sea just under the band), the top is cropped where the band usually
// ends. A screenshot that starts straight into map keeps everything. The
// crop can always be moved by hand.

// How much a row must change from pixel to pixel, at its median, to count as
// map rather than the plain band.
export const PLAIN_ROW_MAX_CHANGE = 3;
// Where the top band usually ends, as a share of the screenshot's height.
export const USUAL_TOP_BAND = 357 / 2048;
// The band's end is only looked for in this much of the top.
const SEARCH_FRACTION = 0.3;
// Rows of map in a row that mark where the map starts (at full working size).
const MAP_RUN_ROWS = 16;

// The median, across a row, of how much each pixel differs from its
// neighbour two along (red, green and blue together).
export function rowChange(img: RgbaImage, y: number): number {
  const { width, data } = img;
  const changes: number[] = [];
  const row = y * width * 4;
  for (let x = 0; x + 2 < width; x += 2) {
    const a = row + x * 4;
    const b = a + 8;
    changes.push(Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2]));
  }
  changes.sort((p, q) => p - q);
  return changes.length ? changes[Math.floor(changes.length / 2)] : 0;
}

export function detectCrop(img: RgbaImage): Crop {
  const crop = fullCrop(img);
  if (img.width < 8 || img.height < 40) return crop;
  const run = Math.max(4, Math.round(MAP_RUN_ROWS * scaleFor(img)));
  const limit = Math.floor(img.height * SEARCH_FRACTION);
  let streak = 0;
  for (let y = 0; y < Math.min(img.height, limit + run); y++) {
    streak = rowChange(img, y) > PLAIN_ROW_MAX_CHANGE ? streak + 1 : 0;
    if (streak === run) {
      // Map from the very first row: no band to crop.
      crop.top = y - run + 1;
      return crop;
    }
  }
  crop.top = Math.round(img.height * USUAL_TOP_BAND);
  return crop;
}
