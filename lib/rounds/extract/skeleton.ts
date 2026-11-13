// Reducing the route mask to its centre line, one pixel wide: a small
// closing first (fill pinholes and nicks along the edges, which would
// otherwise sprout side branches), then Zhang-Suen thinning. Pure, no
// imports; works only within the mask's own bounding box.

type Box = { x0: number; y0: number; x1: number; y1: number };

function boxOf(mask: Uint8Array, width: number, height: number): Box | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (!mask[row + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

function dilate(mask: Uint8Array, width: number, height: number, box: Box): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = Math.max(0, box.y0 - 1); y <= Math.min(height - 1, box.y1 + 1); y++) {
    for (let x = Math.max(0, box.x0 - 1); x <= Math.min(width - 1, box.x1 + 1); x++) {
      let on = 0;
      for (let dy = -1; dy <= 1 && !on; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width && mask[ny * width + nx]) {
            on = 1;
            break;
          }
        }
      }
      out[y * width + x] = on;
    }
  }
  return out;
}

function erode(mask: Uint8Array, width: number, height: number, box: Box): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let y = Math.max(0, box.y0 - 1); y <= Math.min(height - 1, box.y1 + 1); y++) {
    for (let x = Math.max(0, box.x0 - 1); x <= Math.min(width - 1, box.x1 + 1); x++) {
      if (!mask[y * width + x]) continue;
      let on = 1;
      for (let dy = -1; dy <= 1 && on; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height || !mask[ny * width + nx]) {
            on = 0;
            break;
          }
        }
      }
      out[y * width + x] = on;
    }
  }
  return out;
}

// Dilate then erode: fills gaps one pixel wide without growing the shape.
export function close(mask: Uint8Array, width: number, height: number): Uint8Array {
  const box = boxOf(mask, width, height);
  if (!box) return new Uint8Array(mask.length);
  const grown = dilate(mask, width, height, box);
  return erode(grown, width, height, { x0: box.x0 - 1, y0: box.y0 - 1, x1: box.x1 + 1, y1: box.y1 + 1 });
}

// Zhang-Suen: peel boundary pixels in two alternating passes until only a
// one-pixel-wide line is left, keeping every piece connected.
export function thin(mask: Uint8Array, width: number, height: number): Uint8Array {
  const img = mask.slice();
  const box = boxOf(img, width, height);
  if (!box) return img;
  const x0 = Math.max(1, box.x0);
  const y0 = Math.max(1, box.y0);
  const x1 = Math.min(width - 2, box.x1);
  const y1 = Math.min(height - 2, box.y1);
  // Pixels on the image border can't be thinned with a full neighbourhood.
  for (let x = 0; x < width; x++) img[x] = img[(height - 1) * width + x] = 0;
  for (let y = 0; y < height; y++) img[y * width] = img[y * width + width - 1] = 0;
  const remove: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      remove.length = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const i = y * width + x;
          if (!img[i]) continue;
          const p2 = img[i - width];
          const p3 = img[i - width + 1];
          const p4 = img[i + 1];
          const p5 = img[i + width + 1];
          const p6 = img[i + width];
          const p7 = img[i + width - 1];
          const p8 = img[i - 1];
          const p9 = img[i - width - 1];
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const a =
            (!p2 && p3 ? 1 : 0) +
            (!p3 && p4 ? 1 : 0) +
            (!p4 && p5 ? 1 : 0) +
            (!p5 && p6 ? 1 : 0) +
            (!p6 && p7 ? 1 : 0) +
            (!p7 && p8 ? 1 : 0) +
            (!p8 && p9 ? 1 : 0) +
            (!p9 && p2 ? 1 : 0);
          if (a !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0 : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) remove.push(i);
        }
      }
      if (remove.length) {
        changed = true;
        for (const i of remove) img[i] = 0;
      }
    }
  }
  return img;
}
