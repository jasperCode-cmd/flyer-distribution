import { drawShareImage, IMAGE_HEIGHT, IMAGE_WIDTH } from "@/lib/area-planner/image";
import { shareFileName, type ShareView } from "@/lib/area-planner/share-view";

// Draws one distributor's image in the browser and saves it as a PNG. Map
// tiles are loaded with CORS so the canvas can be saved; one that won't
// load is left grey and counted, so the person can try again.

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    const timer = window.setTimeout(() => resolve(null), 10_000);
    image.onload = () => {
      window.clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    image.src = src;
  });
}

export async function renderShareImage(view: ShareView): Promise<{ blob: Blob; missingTiles: number }> {
  const canvas = document.createElement("canvas");
  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw images.");
  const { missingTiles } = await drawShareImage(ctx, view, loadImage);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The image couldn't be saved.");
  return { blob, missingTiles };
}

export async function downloadShareImage(view: ShareView): Promise<{ missingTiles: number }> {
  const { blob, missingTiles } = await renderShareImage(view);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = shareFileName(view, new Date());
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return { missingTiles };
}
