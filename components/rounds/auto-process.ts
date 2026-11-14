import type { Transform } from "@/lib/rounds/alignment";
import { nearest, pickNext, type AutoDraft } from "@/lib/rounds/auto";
import type { Crop } from "@/lib/rounds/extract/image";

// "Auto-process the rest": the page's side. The screenshots already lined up
// are handed to a background worker as references, then the rest go one at
// a time, each the one nearest (in the round's order) to one lined up, tried
// against the nearest three. Every result comes back as it is done, so the
// page shows progress and can stop at any point. Browser only.

// A file chosen in this browser, or how to fetch the stored copy when its turn comes.
export type Source = Blob | (() => Promise<Blob>);
export type AutoRef = { id: string; position: number; file: Source; transform: Transform; crop: Crop | null; confidence: number; depth: number };
export type AutoItem = { id: string; position: number; file: Source; name: string };
const blobOf = (s: Source) => (typeof s === "function" ? s() : Promise.resolve(s));
export type AutoOutcome = { id: string; ok: true; draft: AutoDraft; thumb: Blob | null; ms: number } | { id: string; ok: false; error?: string; ms: number };

export type AutoHandlers = {
  onStart(item: AutoItem, done: number, total: number): void;
  onResult(outcome: AutoOutcome, done: number, total: number): void;
};

export function canAutoProcess(): boolean {
  return typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap !== "undefined";
}

export class AutoProcess {
  private worker: Worker | null = null;
  private stopped = false;
  private waiting: ((data: { type: string; id: string; ok: boolean; [k: string]: unknown }) => void) | null = null;

  get wasStopped() {
    return this.stopped;
  }

  stop() {
    this.stopped = true;
    this.worker?.terminate();
    this.worker = null;
    this.waiting?.({ type: "stopped", id: "", ok: false });
  }

  private ask(message: unknown): Promise<{ type: string; id: string; ok: boolean; [k: string]: unknown }> {
    return new Promise((resolve) => {
      this.waiting = resolve;
      this.worker!.postMessage(message);
    });
  }

  async run(refs: AutoRef[], items: AutoItem[], on: AutoHandlers): Promise<void> {
    this.worker = new Worker(new URL("./auto.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event) => {
      const resolve = this.waiting;
      this.waiting = null;
      resolve?.(event.data);
    };
    this.worker.onerror = () => {
      const resolve = this.waiting;
      this.waiting = null;
      resolve?.({ type: "error", id: "", ok: false, error: "The background worker stopped." });
    };
    const lined: { id: string; position: number }[] = [];
    for (const ref of refs) {
      if (this.stopped) return;
      const file = await blobOf(ref.file).catch(() => null);
      if (!file) continue;
      const answer = await this.ask({ type: "reference", id: ref.id, file, transform: ref.transform, crop: ref.crop, confidence: ref.confidence, depth: ref.depth });
      if (answer.ok) lined.push({ id: ref.id, position: ref.position });
    }
    const todo = [...items];
    const total = items.length;
    let done = 0;
    while (todo.length && !this.stopped) {
      const i = pickNext(
        todo.map((t) => t.position),
        lined.map((l) => l.position)
      );
      const [item] = todo.splice(i, 1);
      on.onStart(item, done, total);
      const tryRefs = nearest(item.position, lined).map((l) => l.id);
      const file = await blobOf(item.file).catch(() => null);
      const answer = tryRefs.length && file ? await this.ask({ type: "process", id: item.id, file, tryRefs }) : { type: "result", id: item.id, ok: false };
      if (this.stopped) return;
      done++;
      if (answer.ok && answer.draft) {
        lined.push({ id: item.id, position: item.position });
        on.onResult({ id: item.id, ok: true, draft: answer.draft as AutoDraft, thumb: (answer.thumb as Blob | null) ?? null, ms: Number(answer.ms ?? 0) }, done, total);
      } else {
        on.onResult({ id: item.id, ok: false, error: answer.error as string | undefined, ms: Number(answer.ms ?? 0) }, done, total);
      }
    }
    this.worker?.terminate();
    this.worker = null;
  }
}
