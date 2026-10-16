import { test } from "node:test";
import assert from "node:assert/strict";
import { QUERY_CONCURRENCY, runLimited } from "@/lib/run-limited";
import { DB_POOL_MAX, prisma } from "@/lib/prisma";
import { loadDashboard } from "@/lib/dashboard-data";
import { ALL_PERIOD } from "@/lib/dashboard";

// The database accepts only so many connections, shared by every server
// instance, so each instance keeps one small pool and a page runs only a
// couple of its queries at once. No database is touched here.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("runLimited keeps order, returns each result, and never runs more than the limit at once", async () => {
  let inFlight = 0;
  let peak = 0;
  const task = <T>(value: T, ms: number) => async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await sleep(ms);
    inFlight--;
    return value;
  };
  const [a, b, c, d, e] = await runLimited(2, [task(1, 15), task("two", 1), task(true, 5), task([4], 1), task({ five: 5 }, 1)]);
  assert.deepEqual([a, b, c, d, e], [1, "two", true, [4], { five: 5 }]);
  assert.equal(peak, 2);
});

test("runLimited only starts a task when its turn comes", async () => {
  const started: number[] = [];
  const task = (n: number) => async () => {
    started.push(n);
    await sleep(5);
    return n;
  };
  const run = runLimited(1, [task(1), task(2), task(3)]);
  await sleep(1);
  assert.deepEqual(started, [1], "the second task waits for the first");
  assert.deepEqual(await run, [1, 2, 3]);
  assert.deepEqual(started, [1, 2, 3]);
});

test("runLimited fails like Promise.all, and starts nothing after a failure", async () => {
  const started: string[] = [];
  const ok = (name: string) => async () => {
    started.push(name);
    await sleep(2);
    return name;
  };
  const failing = async () => {
    started.push("failing");
    throw new Error("query failed");
  };
  await assert.rejects(runLimited(1, [ok("a"), failing, ok("b"), ok("c")]), /query failed/);
  await sleep(10);
  assert.deepEqual(started, ["a", "failing"]);
  assert.deepEqual(await runLimited(2, []), []);
});

test("the Dashboard runs at most QUERY_CONCURRENCY of its queries at once", async () => {
  let inFlight = 0;
  let peak = 0;
  let calls = 0;
  const findMany = async () => {
    calls++;
    inFlight++;
    peak = Math.max(peak, inFlight);
    await sleep(5);
    inFlight--;
    return [];
  };
  const model = { findMany } as never;
  const db = { lead: model, expense: model, activity: model, job: model, calendarEvent: model };
  await loadDashboard(db, ALL_PERIOD, new Date("2026-10-16T10:00:00.000Z"));
  assert.equal(calls, 6);
  assert.equal(peak, QUERY_CONCURRENCY);
  assert.ok(QUERY_CONCURRENCY <= DB_POOL_MAX, "a page never wants more connections than its instance's pool holds");
});

test("one Prisma client per server instance, with a small pool", () => {
  assert.ok(DB_POOL_MAX >= 1 && DB_POOL_MAX <= 3);
  // Cached on globalThis in every environment, production included, so each
  // bundled copy of lib/prisma.ts in an instance shares the one pool.
  assert.equal((globalThis as { prisma?: unknown }).prisma, prisma);
});
