import type { Transform } from "@/lib/rounds/alignment";
import { footprintOf, pairsFor, traceOnMap, type AutoDraft } from "@/lib/rounds/auto";
import { lineUp, type LinedUp } from "@/lib/rounds/auto-lineup";
import type { Compass } from "@/lib/rounds/compass";
import { extractRoute } from "@/lib/rounds/extract";
import { detectCrop } from "@/lib/rounds/extract/crop";
import type { Crop, RgbaImage } from "@/lib/rounds/extract/image";
import { linesLengthM } from "@/lib/rounds/geometry";
import { pack, prepareForMatch, unpack, type Packed } from "@/lib/rounds/match";
import { workingSize } from "@/lib/rounds/working-image";

// Auto-processing, off the page: each screenshot's file is read here, one at
// a time (decoded at working size, then let go before the next), lined up
// from the screenshots already lined up (lib/rounds/auto-lineup), traced,
// and sent back as a draft with a small preview. Of each lined-up
// screenshot only a compact grey copy is kept (about 0.3 MB) to match later
// ones against.

type Ref = { packed: Packed; compass: Compass | null; crop: Crop; transform: Transform; confidence: number; depth: number; width: number; height: number };
type Msg =
  | { type: "reference"; id: string; file: Blob; transform: Transform; crop: Crop | null; confidence: number; depth: number }
  | { type: "process"; id: string; file: Blob; tryRefs: string[] }
  | { type: "forget"; ids: string[] };

type WorkerScope = { onmessage: ((event: MessageEvent<Msg>) => void) | null; postMessage(message: unknown): void };
const scope = self as unknown as WorkerScope;
const refs = new Map<string, Ref>();
// The most compact copies kept at once (about 10 MB).
const MAX_REFS = 32;
const THUMB_WIDTH = 120;

const asLinedUp = (r: Ref): LinedUp => ({ prepared: () => ({ gray: unpack(r.packed), compass: r.compass, crop: r.crop }), transform: r.transform, confidence: r.confidence, depth: r.depth, width: r.width, height: r.height });

async function decode(file: Blob): Promise<{ img: RgbaImage; canvas: OffscreenCanvas }> {
  const bitmap = await createImageBitmap(file);
  const size = workingSize(bitmap.width, bitmap.height);
  const canvas = new OffscreenCanvas(size.width, size.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser can't read images off the page.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const data = ctx.getImageData(0, 0, size.width, size.height).data;
  return { img: { width: size.width, height: size.height, data }, canvas };
}

async function thumbnail(canvas: OffscreenCanvas): Promise<Blob | null> {
  const h = Math.round((canvas.height * THUMB_WIDTH) / canvas.width);
  const small = new OffscreenCanvas(THUMB_WIDTH, h);
  const ctx = small.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, THUMB_WIDTH, h);
  return small.convertToBlob({ type: "image/jpeg", quality: 0.7 }).catch(() => null);
}

function keep(id: string, ref: Ref) {
  refs.delete(id);
  refs.set(id, ref);
  // The longest unused go first.
  while (refs.size > MAX_REFS) refs.delete(refs.keys().next().value as string);
}

scope.onmessage = async (event) => {
  const msg = event.data;
  try {
    if (msg.type === "forget") {
      for (const id of msg.ids) refs.delete(id);
      return;
    }
    if (msg.type === "reference") {
      const { img } = await decode(msg.file);
      const prepared = prepareForMatch(img, msg.crop ?? detectCrop(img));
      keep(msg.id, { packed: pack(prepared.gray), compass: prepared.compass, crop: prepared.crop, transform: msg.transform, confidence: msg.confidence, depth: msg.depth, width: img.width, height: img.height });
      scope.postMessage({ type: "reference", id: msg.id, ok: true });
      return;
    }
    const started = performance.now();
    const { img, canvas } = await decode(msg.file);
    const prepared = prepareForMatch(img);
    const lined = new Map([...refs].map(([id, r]) => [id, asLinedUp(r)]));
    const found = lineUp(prepared, img.width, img.height, lined, msg.tryRefs);
    if (!found) {
      scope.postMessage({ type: "result", id: msg.id, ok: false, ms: Math.round(performance.now() - started) });
      return;
    }
    const { transform } = found;
    keep(found.from, refs.get(found.from)!);
    const traced = extractRoute(img, { crop: prepared.crop });
    const onMap = traceOnMap(transform, traced.lines, traced.start, traced.end);
    const footprint = footprintOf(transform, img.width, img.height);
    const midLat = (footprint[0][1] + footprint[2][1]) / 2;
    const draft: AutoDraft = {
      crop: prepared.crop,
      pairs: pairsFor(transform, img.width, prepared.crop),
      turnDeg: Math.round(transform.rotationDeg * 10000) / 10000,
      source: { kind: "auto", confidence: found.confidence, from: found.from },
      lines: onMap.lines,
      markers: onMap.markers,
      confidence: found.confidence,
      depth: found.depth,
      blocks: found.blocks,
      rmsPx: Math.round(found.rmsPx * 100) / 100,
      metresPerPixel: Math.round(transform.scale * Math.cos((midLat * Math.PI) / 180) * 1000) / 1000,
      footprint,
      lengthM: Math.round(linesLengthM(onMap.lines)),
    };
    keep(msg.id, { packed: pack(prepared.gray), compass: prepared.compass, crop: prepared.crop, transform, confidence: found.confidence, depth: found.depth, width: img.width, height: img.height });
    scope.postMessage({ type: "result", id: msg.id, ok: true, draft, thumb: await thumbnail(canvas), ms: Math.round(performance.now() - started), how: found.how, used: found.used });
  } catch (err) {
    scope.postMessage({ type: msg.type === "process" ? "result" : "reference", id: "id" in msg ? msg.id : "", ok: false, error: err instanceof Error ? err.message : "Auto line-up failed" });
  }
};
