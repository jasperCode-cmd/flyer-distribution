import "server-only";
import { NextResponse } from "next/server";
import { waitForConnection } from "@/lib/prisma";
import { AreaPlannerError } from "./service";
import type { ServerTiming } from "./timing";

// What the Area Planner routes share: the error reply, the Server-Timing
// header on every reply, a line in the logs for any step that was slow, and
// time limits so no request runs much past ten seconds. Logs carry only a
// fixed reason and a time, never project data.

// How long the totals may hold up a reply before the areas go first.
export const TOTALS_WITH_AREAS_MS = 1200;
export const TOTALS_ON_THEIR_OWN_MS = 7000;
// The most a database step may take before the request gives up on it,
// and the most any request may take altogether.
export const DATABASE_LIMIT_MS = 8000;
export const REQUEST_LIMIT_MS = 9500;

// A step slower than this gets a log line (milliseconds; total for the lot).
const SLOW_MS: Record<string, number> = {
  "db-wait": 1000,
  "db-project": 2000,
  "db-areas": 2000,
  "db-lists": 2000,
  save: 3000,
  "data-files": 1500,
  overlaps: 3000,
  combine: 3000,
  households: 3000,
  "totals-wait": 3000,
  total: 5000,
};

export class TooSlow extends Error {
  constructor(
    readonly what: string,
    readonly limitMs: number
  ) {
    super(`${what} took over ${limitMs} ms`);
  }
}

export function plannerFailure(err: unknown, what: string) {
  if (err instanceof AreaPlannerError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof TooSlow) {
    console.warn(`Area Planner: gave up after ${err.limitMs} ms waiting to ${err.what}`);
    return NextResponse.json({ error: "That took too long, as the CRM is busy. Try again in a moment." }, { status: 503 });
  }
  const code = (err as { code?: unknown } | null)?.code;
  console.error(`Area Planner: failed to ${what}:`, err instanceof Error ? err.name : "unknown error", typeof code === "string" ? code : "");
  return NextResponse.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}

// What's left of the request's time, capped at `capMs`.
export function timeLeft(timing: ServerTiming, capMs = REQUEST_LIMIT_MS): number {
  return Math.max(0, Math.min(capMs, REQUEST_LIMIT_MS - timing.elapsed()));
}

// Rejects with TooSlow once `limitMs` passes. The work itself isn't
// stopped (a query can't be called back), only waited for no longer.
export async function within<T>(limitMs: number, what: string, run: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_resolve, reject) => (timer = setTimeout(() => reject(new TooSlow(what, limitMs)), limitMs)));
  try {
    return await Promise.race([run, late]);
  } finally {
    clearTimeout(timer);
  }
}

// How long it takes to get a database connection: with a pool of two, this
// is where waiting for a free one shows up. No statement is run for it.
export function timeDatabaseWait(timing: ServerTiming): Promise<unknown> {
  return timing.step("db-wait", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "get a database connection", waitForConnection()));
}

// A JSON reply with the Server-Timing header, logging any slow step.
export function timedJson(timing: ServerTiming, route: string, body: unknown, init: ResponseInit = {}) {
  const totals = timing.totals();
  totals.set("total", timing.elapsed());
  for (const [name, ms] of totals) {
    if (ms > (SLOW_MS[name] ?? 3000)) console.warn(`Area Planner: slow step "${name}" on ${route}: ${Math.round(ms)} ms`);
  }
  return NextResponse.json(body, { ...init, headers: { ...init.headers, ...timing.headers() } });
}
