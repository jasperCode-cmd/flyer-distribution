// Makes the thank-you email's images (lib/thank-you-email.ts): PNG copies of
// the site's own files, since email clients don't all show WebP. Run it
// again whenever a brands bar logo changes:
//
//   npx tsx scripts/build-email-images.ts
//
// - public/email/fdh-logo-white.png: the white logo the site shows on dark
//   blue, trimmed to the artwork, at twice the size it is shown (190px).
// - public/email/brands-we-have-worked-with.png: the brands bar's logos on
//   white, two rows of five, at twice the size it is shown (520px). Each
//   logo is scaled to a similar visual weight, never recoloured.
//
// The original files are only read. Uses the sharp that Next installs.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { EMAIL_BRANDS, EMAIL_IMAGES } from "../lib/thank-you-email";

const PUBLIC = join(__dirname, "..", "public");
const SCALE = 2;

async function logo() {
  const width = EMAIL_IMAGES.logo.width * SCALE;
  const trimmed = await sharp(join(PUBLIC, "Flyer Distribution Logo White Cropped.webp")).trim().png().toBuffer();
  await sharp(trimmed)
    .resize({ width, kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC, EMAIL_IMAGES.logo.path));
}

async function brands() {
  const columns = 5;
  const rows = Math.ceil(EMAIL_BRANDS.length / columns);
  const width = EMAIL_IMAGES.brands.width * SCALE;
  const cellWidth = Math.floor(width / columns);
  const cellHeight = 52 * SCALE;
  // Each logo gets about the same area, within its cell's box.
  const boxWidth = cellWidth - 18 * SCALE;
  const boxHeight = cellHeight - 10 * SCALE;
  const area = boxWidth * boxHeight * 0.42;

  const pieces = await Promise.all(
    EMAIL_BRANDS.map(async (brand, i) => {
      const source = sharp(join(PUBLIC, brand.file));
      const meta = await source.metadata();
      const ratio = (meta.width ?? 1) / (meta.height ?? 1);
      let h = Math.sqrt(area / ratio);
      let w = h * ratio;
      if (w > boxWidth) [w, h] = [boxWidth, boxWidth / ratio];
      if (h > boxHeight) [w, h] = [boxHeight * ratio, boxHeight];
      const input = await source.resize({ width: Math.round(w), height: Math.round(h), fit: "inside", kernel: "lanczos3" }).png().toBuffer();
      const size = await sharp(input).metadata();
      const col = i % columns;
      const rowIndex = Math.floor(i / columns);
      // The last row, if short, is centred.
      const inRow = Math.min(columns, EMAIL_BRANDS.length - rowIndex * columns);
      const offset = Math.floor(((columns - inRow) * cellWidth) / 2);
      return {
        input,
        left: offset + col * cellWidth + Math.round((cellWidth - (size.width ?? 0)) / 2),
        top: rowIndex * cellHeight + Math.round((cellHeight - (size.height ?? 0)) / 2),
      };
    })
  );

  await sharp({ create: { width, height: rows * cellHeight, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite(pieces)
    .flatten({ background: "#ffffff" })
    .png({ compressionLevel: 9 })
    .toFile(join(PUBLIC, EMAIL_IMAGES.brands.path));
}

(async () => {
  await mkdir(join(PUBLIC, "email"), { recursive: true });
  await logo();
  await brands();
  for (const file of [EMAIL_IMAGES.logo.path, EMAIL_IMAGES.brands.path]) {
    const meta = await sharp(join(PUBLIC, file)).metadata();
    console.log(`${file}: ${meta.format} ${meta.width}x${meta.height}`);
  }
})().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
