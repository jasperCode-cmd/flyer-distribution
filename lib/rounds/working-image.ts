// The browser's working copy of a screenshot: decoded, scaled down to at
// most WORKING_MAX_HEIGHT tall (never up), which the crop, the alignment's
// points and the traced route are all measured in; its pixels for the
// tracing; the SHA-256 of the original file, so the same file picked again
// later can be recognised; and a compressed copy (WebP, or JPEG where a
// browser can't make WebP) for file storage once it is switched on. Browser
// only; nothing here leaves the browser by itself.

import { readImageTime, type ImageTime } from "./exif";

export const WORKING_MAX_HEIGHT = 1600;
export const WEBP_QUALITY = 0.9;
export const JPEG_QUALITY = 0.88;

export function workingSize(width: number, height: number): { width: number; height: number } {
  if (height <= WORKING_MAX_HEIGHT) return { width, height };
  const scale = WORKING_MAX_HEIGHT / height;
  return { width: Math.max(1, Math.round(width * scale)), height: WORKING_MAX_HEIGHT };
}

export type WorkingImage = {
  width: number;
  height: number;
  pixels: ImageData;
  // For showing it: an object URL of the working copy as a PNG.
  url: string;
  sha256: string;
};

export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// What a picked file is, without keeping it: its fingerprint, its working
// size and its own date where it has one. Read one file at a time (the
// bytes and the decoded picture are let go before the next), so choosing a
// hundred screenshots never holds a hundred in memory; the full working
// copy is made only for the one being worked on.
export type FileFacts = { sha256: string; width: number; height: number; time: ImageTime | null };

export async function readFileFacts(file: Blob): Promise<FileFacts> {
  const bytes = await file.arrayBuffer();
  const sha256 = await sha256Hex(bytes);
  const time = readImageTime(new Uint8Array(bytes));
  const bitmap = await createImageBitmap(file);
  const size = workingSize(bitmap.width, bitmap.height);
  bitmap.close();
  return { sha256, ...size, time };
}

// The facts of several files, strictly one after another, reporting how
// far it has got. A file that can't be read as an image is skipped and
// named in `unreadable`.
export async function readAllFacts(
  files: File[],
  onProgress: (done: number) => void
): Promise<{ read: { file: File; facts: FileFacts }[]; unreadable: string[] }> {
  const read: { file: File; facts: FileFacts }[] = [];
  const unreadable: string[] = [];
  for (const [i, file] of files.entries()) {
    try {
      read.push({ file, facts: await readFileFacts(file) });
    } catch {
      unreadable.push(file.name);
    }
    onProgress(i + 1);
  }
  return { read, unreadable };
}

export async function makeWorkingImage(file: Blob): Promise<WorkingImage> {
  const bytes = await file.arrayBuffer();
  const bitmap = await createImageBitmap(new Blob([bytes], { type: file.type || "image/png" }));
  const size = workingSize(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser can't read images.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const pixels = ctx.getImageData(0, 0, size.width, size.height);
  const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!png) throw new Error("This browser can't read images.");
  return { width: size.width, height: size.height, pixels, url: URL.createObjectURL(png), sha256: await sha256Hex(bytes) };
}

// The copy that would be stored: WebP where the browser can make it.
export async function compressForStorage(image: WorkingImage): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  canvas.getContext("2d")!.putImageData(image.pixels, 0, 0);
  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", WEBP_QUALITY));
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
  if (!jpeg) throw new Error("This browser can't compress images.");
  return jpeg;
}
