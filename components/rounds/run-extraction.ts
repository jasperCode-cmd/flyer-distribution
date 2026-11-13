import { extractRoute, type ExtractOptions, type ExtractResult } from "@/lib/rounds/extract";

// Runs the tracing in a Web Worker, or on the page if this browser can't
// start one. Browser only.

let worker: Worker | null | undefined;
let nextId = 1;
const waiting = new Map<number, { resolve: (r: ExtractResult) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./extract.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<{ id: number; ok: boolean; result?: ExtractResult; error?: string }>) => {
      const job = waiting.get(event.data.id);
      if (!job) return;
      waiting.delete(event.data.id);
      if (event.data.ok && event.data.result) job.resolve(event.data.result);
      else job.reject(new Error(event.data.error ?? "Tracing failed"));
    };
    worker.onerror = () => {
      for (const job of waiting.values()) job.reject(new Error("Tracing failed"));
      waiting.clear();
      worker = null;
    };
  } catch {
    worker = null;
  }
  return worker;
}

export function runExtraction(pixels: ImageData, options: ExtractOptions): Promise<ExtractResult> {
  const w = getWorker();
  if (!w) return Promise.resolve(extractRoute({ width: pixels.width, height: pixels.height, data: pixels.data }, options));
  const id = nextId++;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    // A copy goes to the worker, so the page keeps its own pixels.
    const data = new Uint8ClampedArray(pixels.data);
    w.postMessage({ id, width: pixels.width, height: pixels.height, data, options }, [data.buffer]);
  });
}
