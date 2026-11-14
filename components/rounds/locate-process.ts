import type { LocateRecord } from "@/lib/rounds/alignment";
import type { AutoDraft } from "@/lib/rounds/auto";
import { locatedDraft, recordOf, type LocateReply, type PreparedShot } from "@/lib/rounds/locate/draft";
import type { Source } from "./auto-process";

// "Locate and trace all": the page's side. Each screenshot is read in the
// background worker (its crop, compass, traced route, and a working-size
// JPEG), then sent on its own to the Locate route, which reads its street
// names and places it. A few are asked at once; each answer comes back as it
// is done, so the page shows progress and the running cost, and can stop.
// One screenshot that fails (the API busy, an error) goes to "Needs line-up"
// with the reason, and the rest carry on; when the API asks for a pause the
// next ones wait for it. Stop starts no more; any already asked about finish
// (their cost is spent) and are kept. Browser only.

export type LocateItem = { id: string; position: number; file: Source; name: string };
export type LocateResult = { id: string; ok: true; draft: AutoDraft; thumb: Blob | null; record: LocateRecord | null } | { id: string; ok: false; reason: string; record: LocateRecord | null };
export type LocateHandlers = {
  onStart(item: LocateItem, active: number): void;
  onResult(result: LocateResult, done: number, total: number): void;
};

// Screenshots asked about at once.
export const LOCATE_AT_ONCE = 3;
const MAX_PAUSE_S = 30;

type Prepared = PreparedShot & { compassTurn: number | null; route: [number, number][]; jpeg: Blob; thumb: Blob | null };
type WorkerAnswer = { type: string; id: string; ok: boolean; error?: string } & Partial<Prepared>;

const blobOf = (s: Source) => (typeof s === "function" ? s() : Promise.resolve(s));

export class LocateProcess {
  private worker: Worker | null = null;
  private stopped = false;
  private notSetUp = false;
  private pending = new Map<string, (answer: WorkerAnswer) => void>();
  // The worker reads one screenshot at a time.
  private chain: Promise<unknown> = Promise.resolve();
  private pauseUntil = 0;

  get wasStopped() {
    return this.stopped;
  }

  // The server has no API key: the batch stops, and nothing else changes.
  get wasNotSetUp() {
    return this.notSetUp;
  }

  stop() {
    this.stopped = true;
  }

  private prepare(id: string, file: Blob): Promise<WorkerAnswer> {
    const next = this.chain.then(
      () =>
        new Promise<WorkerAnswer>((resolve) => {
          if (!this.worker || this.stopped) return resolve({ type: "stopped", id, ok: false });
          this.pending.set(id, resolve);
          this.worker.postMessage({ type: "prepare", id, file });
        })
    );
    this.chain = next.catch(() => null);
    return next;
  }

  // null: not asked about (stopped first, or Locate isn't set up), so left as it was.
  private async one(item: LocateItem): Promise<LocateResult | null> {
    const fail = (reason: string, record: LocateRecord | null = null): LocateResult => ({ id: item.id, ok: false, reason, record });
    const file = await blobOf(item.file).catch(() => null);
    if (!file) return fail("The screenshot's file couldn't be read here");
    const prep = await this.prepare(item.id, file);
    if (this.stopped) return null;
    if (!prep.ok || !prep.jpeg) return fail(prep.error ?? "The screenshot couldn't be read");
    // Wait out any pause the API asked for.
    while (!this.stopped && Date.now() < this.pauseUntil) await new Promise((r) => setTimeout(r, Math.min(1000, this.pauseUntil - Date.now())));
    if (this.stopped) return null;
    const form = new FormData();
    form.append("image", prep.jpeg, "screenshot.jpg");
    form.append("meta", JSON.stringify({ compassTurn: prep.compassTurn ?? null, route: prep.route ?? [] }));
    try {
      const res = await fetch(`/api/crm/rounds/screenshots/${item.id}/locate`, { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as (LocateReply & { error?: string; notSetUp?: boolean }) | null;
      if (res.status === 503 && body?.notSetUp) {
        this.notSetUp = true;
        this.stopped = true;
        return null;
      }
      if (!res.ok || !body) return fail(body?.error ?? `The server answered ${res.status}`);
      if (body.retryAfterS) this.pauseUntil = Math.max(this.pauseUntil, Date.now() + Math.min(MAX_PAUSE_S, body.retryAfterS) * 1000);
      const record = recordOf(body);
      if (!body.ok || !body.transform) return fail(body.reason, record);
      const shot: PreparedShot = { width: prep.width!, height: prep.height!, crop: prep.crop!, lines: prep.lines ?? [], start: prep.start ?? null, end: prep.end ?? null };
      return { id: item.id, ok: true, draft: locatedDraft(shot, body, record), thumb: prep.thumb ?? null, record };
    } catch {
      return fail("Couldn't reach the server");
    }
  }

  async run(items: LocateItem[], on: LocateHandlers, atOnce = LOCATE_AT_ONCE): Promise<void> {
    this.worker = new Worker(new URL("./auto.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WorkerAnswer>) => {
      const resolve = this.pending.get(event.data.id);
      this.pending.delete(event.data.id);
      resolve?.(event.data);
    };
    this.worker.onerror = () => {
      for (const resolve of this.pending.values()) resolve({ type: "error", id: "", ok: false, error: "The background worker stopped." });
      this.pending.clear();
    };
    const total = items.length;
    let next = 0;
    let done = 0;
    let active = 0;
    const lane = async () => {
      while (!this.stopped && next < items.length) {
        const item = items[next++];
        active++;
        on.onStart(item, active);
        const result = await this.one(item);
        active--;
        if (!result) return;
        done++;
        on.onResult(result, done, total);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, atOnce) }, lane));
    this.worker?.terminate();
    this.worker = null;
  }
}
