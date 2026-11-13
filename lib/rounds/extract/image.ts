// The pixels the route tracing works on: RGBA, four bytes a pixel, rows top
// to bottom, as a browser canvas's getImageData gives them (and as the tests
// decode their fixtures). Pure, no imports.

export type RgbaImage = { width: number; height: number; data: Uint8ClampedArray | Uint8Array };

// The part of the screenshot that is map, in pixels: rows from top up to
// (not including) bottom, columns from left up to (not including) right.
export type Crop = { top: number; bottom: number; left: number; right: number };

export type Point = [x: number, y: number];

// The tracing's thresholds are tuned for a screenshot about this tall (the
// working size the browser makes); other sizes scale them.
export const WORKING_HEIGHT = 1600;

export function scaleFor(img: Pick<RgbaImage, "height">): number {
  return img.height / WORKING_HEIGHT;
}

export function fullCrop(img: Pick<RgbaImage, "width" | "height">): Crop {
  return { top: 0, bottom: img.height, left: 0, right: img.width };
}

// A crop kept inside the image and at least a little of it.
export function clampCrop(img: Pick<RgbaImage, "width" | "height">, crop: Crop): Crop {
  const top = Math.max(0, Math.min(img.height - 1, Math.round(crop.top)));
  const left = Math.max(0, Math.min(img.width - 1, Math.round(crop.left)));
  const bottom = Math.max(top + 1, Math.min(img.height, Math.round(crop.bottom)));
  const right = Math.max(left + 1, Math.min(img.width, Math.round(crop.right)));
  return { top, bottom, left, right };
}

export function insideCrop(crop: Crop, x: number, y: number): boolean {
  return y >= crop.top && y < crop.bottom && x >= crop.left && x < crop.right;
}
