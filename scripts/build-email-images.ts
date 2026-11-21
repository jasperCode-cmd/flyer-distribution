// Makes the thank-you email's images (lib/thank-you-email.ts): PNG copies of
// the site's own files, since email clients don't all show WebP. Run it
// again whenever a brands bar logo changes:
//
//   npx tsx scripts/build-email-images.ts
//
// - public/email/fdh-logo-white.png: the white logo the site shows on dark
//   blue, trimmed to the artwork, at twice the size it is shown (190px).
// - public/email/brands-we-have-worked-with.png: the brands bar's logos on
//   white, at twice the size it is shown (520px): the featured one
//   (Partridge of Hampshire) on its own row at the top, centred and about
//   1.5 times the size of the others, then the rest in rows of four. Each
//   logo is scaled to a similar visual weight, never recoloured.
//
// The original files are only read. Uses the sharp that Next installs.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { EMAIL_BRANDS, EMAIL_FEATURED_BRAND, EMAIL_IMAGES } from "../lib/thank-you-email";

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

// How large the featured logo is against the size it would have among the others.
const FEATURED_SCALE = 1.5;

// Logos the brands bar shows smaller than their box suggests (40px against
// the others' 48px), and the same here: both files are cropped tight to the
// artwork, Angler Digital's lettering is under half its height, and My
// Invoice is a solid colour badge.
const SMALLER: Record<string, number> = {
  "images/logo-angler-digital.webp": 40 / 48,
  "images/logo-my-invoice.webp": 40 / 48,
};

async function brands() {
  const columns = 4;
  const featured = EMAIL_BRANDS.find((b) => b.file === EMAIL_FEATURED_BRAND);
  const rest = EMAIL_BRANDS.filter((b) => b !== featured);
  const rows = Math.ceil(rest.length / columns);
  const width = EMAIL_IMAGES.brands.width * SCALE;
  const cellWidth = Math.floor(width / columns);
  const cellHeight = 52 * SCALE;
  const topHeight = featured ? Math.round(cellHeight * FEATURED_SCALE) : 0;
  // Each logo gets about the same area, within a cell's box. The box is a
  // fifth of the width, as it was with rows of five, so the logos keep
  // their size.
  const boxWidth = Math.floor(width / 5) - 18 * SCALE;
  const boxHeight = cellHeight - 10 * SCALE;
  const area = boxWidth * boxHeight * 0.42;

  // A logo at the size it has among the others, times `scale`.
  async function sized(file: string, scale = 1) {
    const source = sharp(join(PUBLIC, file));
    const meta = await source.metadata();
    const ratio = (meta.width ?? 1) / (meta.height ?? 1);
    let h = Math.sqrt(area / ratio);
    let w = h * ratio;
    if (w > boxWidth) [w, h] = [boxWidth, boxWidth / ratio];
    if (h > boxHeight) [w, h] = [boxHeight * ratio, boxHeight];
    const input = await source.resize({ width: Math.round(w * scale), height: Math.round(h * scale), fit: "inside", kernel: "lanczos3" }).png().toBuffer();
    const size = await sharp(input).metadata();
    return { input, width: size.width ?? 0, height: size.height ?? 0 };
  }

  const pieces = await Promise.all(
    rest.map(async (brand, i) => {
      const logo = await sized(brand.file, SMALLER[brand.file] ?? 1);
      const col = i % columns;
      const rowIndex = Math.floor(i / columns);
      // The last row, if short, is centred.
      const inRow = Math.min(columns, rest.length - rowIndex * columns);
      const offset = Math.floor(((columns - inRow) * cellWidth) / 2);
      return {
        input: logo.input,
        left: offset + col * cellWidth + Math.round((cellWidth - logo.width) / 2),
        top: topHeight + rowIndex * cellHeight + Math.round((cellHeight - logo.height) / 2),
      };
    })
  );
  if (featured) {
    const logo = await sized(featured.file, FEATURED_SCALE);
    pieces.unshift({ input: logo.input, left: Math.round((width - logo.width) / 2), top: Math.round((topHeight - logo.height) / 2) });
  }

  await sharp({ create: { width, height: topHeight + rows * cellHeight, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
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
