import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clearSharedCaches, sharedCache } from "@/lib/shared-cache";
import { STATUS_IDLE_STOP_MS, STATUS_POLL_MS, createStatusPoller, type PollClock } from "@/lib/status-poll";
import { pollTotals, totalsWait, type TotalsAnswer } from "@/lib/area-planner/totals-poll";
import { isCrmChangeRequest, newChangeId, parseChangeId } from "@/lib/crm-change";
import { notificationsFrom } from "@/lib/notifications";
import type { ApplicationFacts, LeadFacts, TaskFacts } from "@/lib/priorities";

// Fewer database operations: figures worked out once a minute and shared by
// every tab and user, worked out afresh for whoever has just changed
// something; the navigation's status asked for every two minutes, only in a
// visible tab and not once the page has been left alone for 30 minutes; the
// Area Planner's totals asked for only until they arrive and never while the
// tab is hidden. No database is touched here.

const MINUTE = 60 * 1000;
let names = 0;
const uniqueName = () => `test-cache-${++names}`;

function clockAt(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

// --- The shared cache ----------------------------------------------------------------

test("shared cache: everyone asking within the minute shares one load, then it is worked out again", async () => {
  const clock = clockAt();
  const cache = sharedCache<number>(uniqueName(), { ttlMs: MINUTE, now: clock.now });
  let loads = 0;
  const load = async () => ++loads;

  // Two tabs and a second user asking at the same moment: one load between them.
  assert.deepEqual(await Promise.all([cache.get("k", load), cache.get("k", load), cache.get("k", load)]), [1, 1, 1]);
  assert.equal(loads, 1);
  clock.advance(MINUTE - 1);
  assert.equal(await cache.get("k", load), 1, "still within the minute");
  assert.equal(loads, 1);
  clock.advance(1);
  assert.equal(await cache.get("k", load), 2, "a minute old: worked out again");
  assert.equal(loads, 2);
  // Different keys are kept apart.
  assert.equal(await cache.get("other", load), 3);
});

test("shared cache: every copy of the module asking for the same cache by name shares its entries", async () => {
  // As the page chunk and the API route chunk of one server instance do.
  const name = uniqueName();
  const pageCopy = sharedCache<string>(name, { ttlMs: MINUTE });
  const routeCopy = sharedCache<string>(name, { ttlMs: MINUTE });
  let loads = 0;
  assert.equal(await pageCopy.get("facts", async () => `load ${++loads}`), "load 1");
  assert.equal(await routeCopy.get("facts", async () => `load ${++loads}`), "load 1");
  assert.equal(loads, 1);
  assert.equal((globalThis as unknown as { fdhSharedCache: { caches: Map<string, unknown> } }).fdhSharedCache.caches.get(name), pageCopy);
});

test("shared cache: a failed load is not kept, so the next ask tries again", async () => {
  const cache = sharedCache<string>(uniqueName(), { ttlMs: MINUTE });
  let calls = 0;
  await assert.rejects(cache.get("k", async () => {
    calls++;
    throw new Error("database busy");
  }), /database busy/);
  assert.equal(await cache.get("k", async () => `ok after ${++calls}`), "ok after 2");
});

test("shared cache: whoever has just changed something gets it worked out afresh, once per change, and everyone shares that", async () => {
  const clock = clockAt();
  const cache = sharedCache<string>(uniqueName(), { ttlMs: MINUTE, now: clock.now });
  let version = 1;
  let loads = 0;
  const load = async () => {
    loads++;
    return `v${version}`;
  };
  assert.equal(await cache.get("k", load), "v1");

  // Someone saves a change, then their page asks with the change's id.
  version = 2;
  clock.advance(5000);
  const change = newChangeId();
  assert.equal(await cache.get("k", load, { changeId: change }), "v2", "their own change shows straight away");
  assert.equal(loads, 2);
  clock.advance(1000);
  assert.equal(await cache.get("k", load, { changeId: change }), "v2", "the same change doesn't load again");
  assert.equal(await cache.get("k", load), "v2", "and the other user shares the fresh copy");
  assert.equal(loads, 2);

  // Without a change of their own, someone else sees it within the minute.
  version = 3;
  clock.advance(1000);
  assert.equal(await cache.get("k", load), "v2");
  clock.advance(MINUTE);
  assert.equal(await cache.get("k", load), "v3");
});

test("shared cache: a load already under way when the change was seen is not trusted for it; one started after is joined", async () => {
  const clock = clockAt();
  const cache = sharedCache<string>(uniqueName(), { ttlMs: MINUTE, now: clock.now });
  let release: ((v: string) => void) | null = null;
  const slow = () => new Promise<string>((resolve) => (release = resolve));
  const before = cache.get("k", slow);
  const releaseBefore = release!;
  clock.advance(10);

  const change = newChangeId();
  let fresh = 0;
  const afterChange = cache.get("k", async () => `fresh ${++fresh}`, { changeId: change });
  assert.equal(await afterChange, "fresh 1", "the load from before the change is not joined");
  releaseBefore("stale");
  assert.equal(await before, "stale", "the earlier asker still gets their answer");
  assert.equal(await cache.get("k", async () => "never"), "fresh 1", "the older, slower load never replaces the newer one");

  // A load that starts after the change was first seen is joined by later askers with it.
  clock.advance(MINUTE);
  const second = newChangeId();
  let joined = 0;
  const first = cache.get("k", () => new Promise<string>((resolve) => setTimeout(() => resolve(`load ${++joined}`), 5)), { changeId: second });
  const sharer = cache.get("k", async () => "should not run", { changeId: second });
  assert.deepEqual(await Promise.all([first, sharer]), ["load 1", "load 1"]);
});

test("shared cache: keeps only so many entries, dropping the oldest, and every cache can be cleared at once", async () => {
  const cache = sharedCache<string>(uniqueName(), { ttlMs: MINUTE, maxEntries: 2 });
  let loads = 0;
  const load = (v: string) => async () => {
    loads++;
    return v;
  };
  await cache.get("a", load("a"));
  await cache.get("b", load("b"));
  await cache.get("c", load("c"));
  assert.equal(loads, 3);
  await cache.get("b", load("b"));
  assert.equal(loads, 3, "b is still kept");
  await cache.get("a", load("a2"));
  assert.equal(loads, 4, "a was dropped");

  clearSharedCaches();
  assert.equal(await cache.get("b", load("after clear")), "after clear");
});

test("the Dashboard, Priorities and the navigation's status share their figures for a minute", () => {
  const priorities = readFileSync("lib/priorities-data.ts", "utf8");
  assert.match(priorities, /sharedCache<.+>\("priority-facts", \{ ttlMs: PRIORITY_FIGURES_TTL_MS/);
  assert.match(priorities, /export const PRIORITY_FIGURES_TTL_MS = 60 \* 1000;/);
  // Actions read the facts fresh, never from the shared copy.
  for (const route of ["app/api/crm/priorities/actions/route.ts", "app/api/crm/priorities/bulk/route.ts"]) {
    assert.match(readFileSync(route, "utf8"), /await loadDatabaseFacts\(now\)/, route);
  }
  assert.match(readFileSync("lib/dashboard-data.ts", "utf8"), /export const DASHBOARD_FIGURES_TTL_MS = 60 \* 1000;/);
  assert.match(readFileSync("lib/crm-status.ts", "utf8"), /export const CRM_STATUS_TTL_MS = 60 \* 1000;/);
  // Each page passes on the change its viewer has just made.
  for (const file of ["app/admin/crm/page.tsx", "app/admin/crm/priorities/page.tsx", "app/api/crm/priorities/route.ts", "app/api/crm/status/route.ts"]) {
    assert.match(readFileSync(file, "utf8"), /requestChangeId\(\)/, file);
  }
});

// --- Marking a change ------------------------------------------------------------------

test("a change is any request but GET or HEAD to the CRM's own API, and its id is checked", () => {
  const origin = "https://flyerdistributionhampshire.co.uk";
  assert.equal(isCrmChangeRequest("/api/crm/leads/1", { method: "PATCH" }, origin), true);
  assert.equal(isCrmChangeRequest("/api/crm/priorities/actions", { method: "post" }, origin), true);
  assert.equal(isCrmChangeRequest(`${origin}/api/crm/tasks`, { method: "DELETE" }, origin), true);
  assert.equal(isCrmChangeRequest(new Request(`${origin}/api/crm/tasks`, { method: "POST" }), undefined, origin), true);
  assert.equal(isCrmChangeRequest("/api/crm/status", undefined, origin), false, "reading is not a change");
  assert.equal(isCrmChangeRequest("/api/crm/leads", { method: "HEAD" }, origin), false);
  assert.equal(isCrmChangeRequest("/api/auth/signout", { method: "POST" }, origin), false);
  assert.equal(isCrmChangeRequest("https://example.com/api/crm/leads", { method: "POST" }, origin), false);

  const id = newChangeId();
  assert.match(id, /^[a-z0-9]{24}$/);
  assert.notEqual(newChangeId(), id);
  assert.equal(parseChangeId(id), id);
  for (const bad of [undefined, null, "", "short", "has spaces in it", "x".repeat(41), "<script>alert(1)</script>"]) {
    assert.equal(parseChangeId(bad), null, String(bad));
  }
});

// --- The navigation's status poll ------------------------------------------------------------

function fakeTab() {
  let t = 0;
  let visible = true;
  let nextId = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  const clock: PollClock = {
    now: () => t,
    setTimeout: (run, ms) => {
      const id = nextId++;
      timers.set(id, { at: t + ms, run });
      return id;
    },
    clearTimeout: (id) => void timers.delete(id as number),
    visible: () => visible,
  };
  // Moves time on, running each timer when its moment comes.
  function advance(ms: number) {
    const end = t + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      t = due[1].at;
      due[1].run();
    }
    t = end;
  }
  return {
    clock,
    advance,
    pending: () => timers.size,
    setVisible: (v: boolean) => (visible = v),
    now: () => t,
  };
}

test("status poll: asks when the page opens, then every two minutes, not every 45 seconds", () => {
  assert.equal(STATUS_POLL_MS, 2 * MINUTE);
  const tab = fakeTab();
  const asks: number[] = [];
  const poller = createStatusPoller(() => asks.push(tab.now()), tab.clock);
  poller.start();
  // Well within the 30 minutes, so nobody needs to touch the page.
  tab.advance(10 * MINUTE - 1);
  assert.deepEqual(asks, [0, 2, 4, 6, 8].map((m) => m * MINUTE));
  poller.stop();
  tab.advance(10 * MINUTE);
  assert.equal(asks.length, 5, "nothing after stopping");
  assert.equal(tab.pending(), 0);
});

test("status poll: a hidden tab never asks; shown again it asks (if it hasn't in the last minute) and carries on", () => {
  const tab = fakeTab();
  const asks: number[] = [];
  const poller = createStatusPoller(() => asks.push(tab.now()), tab.clock);
  poller.start();
  tab.advance(1 * MINUTE);
  tab.setVisible(false);
  poller.visibilityChanged();
  assert.equal(tab.pending(), 0, "no timer runs in a hidden tab");
  tab.advance(20 * MINUTE);
  assert.deepEqual(asks, [0], "nothing while hidden");

  tab.setVisible(true);
  poller.visibilityChanged();
  assert.deepEqual(asks, [0, 21 * MINUTE], "asks as soon as it is shown again");
  tab.advance(2 * MINUTE);
  assert.deepEqual(asks, [0, 21 * MINUTE, 23 * MINUTE]);

  // Flicking away and back within the minute doesn't ask again at once.
  tab.advance(30 * 1000);
  tab.setVisible(false);
  poller.visibilityChanged();
  tab.setVisible(true);
  poller.visibilityChanged();
  assert.equal(asks.length, 3);
  tab.advance(90 * 1000);
  assert.deepEqual(asks.slice(3), [25 * MINUTE], "the two-minute rhythm carries on");

  // A tab opened in the background doesn't ask until it is shown.
  const background = fakeTab();
  background.setVisible(false);
  let backgroundAsks = 0;
  const hidden = createStatusPoller(() => backgroundAsks++, background.clock);
  hidden.start();
  background.advance(10 * MINUTE);
  assert.equal(backgroundAsks, 0);
  assert.equal(background.pending(), 0);
});

test("status poll: stops after 30 minutes with nobody using the page, until someone does", () => {
  assert.equal(STATUS_IDLE_STOP_MS, 30 * MINUTE);
  const tab = fakeTab();
  const asks: number[] = [];
  const poller = createStatusPoller(() => asks.push(tab.now()), tab.clock);
  poller.start();
  tab.advance(60 * MINUTE);
  // Asks at 0, 2, ... 28 minutes; at 30 nobody has touched the page for 30 minutes.
  assert.deepEqual(asks, Array.from({ length: 15 }, (_, i) => i * 2 * MINUTE));
  assert.equal(poller.state().asleep, true);
  assert.equal(tab.pending(), 0, "no timer left running");

  // A key press or the mouse brings it back at once.
  poller.activity();
  assert.equal(asks.at(-1), 60 * MINUTE);
  tab.advance(4 * MINUTE);
  assert.deepEqual(asks.slice(-3), [60, 62, 64].map((m) => m * MINUTE));

  // Using the page now and then keeps it going past 30 minutes.
  const busy = fakeTab();
  let busyAsks = 0;
  const kept = createStatusPoller(() => busyAsks++, busy.clock);
  kept.start();
  for (let i = 0; i < 6; i++) {
    busy.advance(10 * MINUTE);
    kept.activity();
  }
  assert.equal(busyAsks, 31, "every two minutes for an hour, and never asleep");
  assert.equal(kept.state().asleep, false);
});

test("status poll: a navigation or a change on the page asks at once and restarts the two minutes", () => {
  const tab = fakeTab();
  const asks: number[] = [];
  const poller = createStatusPoller(() => asks.push(tab.now()), tab.clock);
  poller.start();
  tab.advance(90 * 1000);
  poller.refresh();
  tab.advance(2 * MINUTE);
  assert.deepEqual(asks, [0, 90 * 1000, 210 * 1000]);
  // Hidden, a change elsewhere doesn't make it ask.
  tab.setVisible(false);
  poller.visibilityChanged();
  poller.refresh();
  assert.equal(asks.length, 3);
});

test("the CRM shell asks for the status in one request, through the poller, and the bell no longer polls", () => {
  const shell = readFileSync("components/crm/CrmShell.tsx", "utf8");
  assert.equal(shell.match(/fetch\("/g)?.length, 1, "one request");
  assert.match(shell, /fetch\("\/api\/crm\/status"/);
  assert.match(shell, /createStatusPoller\(ask,/);
  assert.match(shell, /installChangeMarker\(\)/);
  const bell = readFileSync("components/crm/NotificationBell.tsx", "utf8");
  assert.doesNotMatch(bell, /fetch\(|setInterval|setTimeout\(poll/);
  for (const gone of ["notifications", "applications/count", "priorities/count", "inbox/unread-count"]) {
    assert.throws(() => readFileSync(`app/api/crm/${gone}/route.ts`), `app/api/crm/${gone} is gone`);
  }
});

// --- Area Planner totals ------------------------------------------------------------------------

function totalsTab(answers: TotalsAnswer<string>[]) {
  let visible = true;
  let shown: (() => void) | null = null;
  const asked: number[] = [];
  const slept: number[] = [];
  let stop = false;
  const deps = {
    ask: async () => {
      asked.push(asked.length);
      return answers.shift() ?? { ok: true as const, totals: null };
    },
    sleep: async (ms: number) => void slept.push(ms),
    whenVisible: () => (visible || stop ? Promise.resolve() : new Promise<void>((resolve) => (shown = resolve))),
    stopped: () => stop,
  };
  return {
    deps,
    asked,
    slept,
    hide: () => (visible = false),
    show: () => {
      visible = true;
      shown?.();
    },
    stop: () => {
      stop = true;
      shown?.();
    },
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test("Area Planner totals: asked for until they arrive, then never again", async () => {
  const tab = totalsTab([{ ok: true, totals: null }, { ok: false, status: 503 }, { ok: false, status: 0 }, { ok: true, totals: "174,588 homes" }]);
  assert.equal(await pollTotals(tab.deps), "174,588 homes");
  assert.equal(tab.asked.length, 4, "still working, too busy, unreachable, then the totals");
  assert.deepEqual(tab.slept, [totalsWait(0), totalsWait(1), totalsWait(2)]);
  assert.deepEqual([totalsWait(0), totalsWait(8), totalsWait(50)], [1000, 5000, 5000]);
});

test("Area Planner totals: never asked for while the tab is hidden; shown again, asking carries on", async () => {
  const tab = totalsTab([{ ok: true, totals: null }, { ok: true, totals: "ready" }]);
  tab.hide();
  const result = pollTotals(tab.deps);
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(tab.asked.length, 0, "nothing while hidden");
  tab.show();
  assert.equal(await result, "ready");
  assert.equal(tab.asked.length, 2);

  // Closed while hidden: it ends without asking.
  const closed = totalsTab([]);
  closed.hide();
  const gone = pollTotals(closed.deps);
  await tick();
  closed.stop();
  assert.equal(await gone, null);
  assert.equal(closed.asked.length, 0);
});

test("Area Planner totals: a refusal (project gone, session ended) stops the asking", async () => {
  for (const status of [401, 404]) {
    const tab = totalsTab([{ ok: false, status }]);
    assert.equal(await pollTotals(tab.deps), null);
    assert.equal(tab.asked.length, 1, String(status));
  }
});

test("Area Planner requests time the wait for a connection without running a statement", () => {
  const api = readFileSync("lib/area-planner/api.ts", "utf8");
  assert.doesNotMatch(api, /SELECT 1|\$queryRaw/);
  assert.match(api, /waitForConnection\(\)/);
  assert.match(readFileSync("components/area-planner/use-planner.ts", "utf8"), /pollTotals<ProjectTotals>\(/);
});

// --- The bell, from the facts Priorities reads ------------------------------------------------

const NOW = new Date("2026-10-21T12:00:00.000Z");

function lead(id: string, extra: Partial<LeadFacts> = {}): LeadFacts {
  return {
    id,
    name: `Lead ${id}`,
    businessName: null,
    email: null,
    phone: null,
    stage: "UNCONTACTED",
    business: "FDH",
    source: "WEBSITE_QUOTE_FORM",
    paymentStatus: "NOT_PAID",
    reviewStatus: "NOT_REQUESTED",
    createdAt: "2026-10-20T09:00:00.000Z",
    scrapped: false,
    activities: [],
    job: null,
    ...extra,
  } as LeadFacts;
}

function application(id: string, extra: Partial<ApplicationFacts> = {}): ApplicationFacts {
  return { id, fullName: `Applicant ${id}`, email: null, phone: null, business: "FDH", status: "NEW", source: "WEBSITE_FORM", receivedAt: "2026-10-20T10:00:00.000Z", updatedAt: "2026-10-20T10:00:00.000Z", ...extra };
}

function task(id: string, dueDate: string, withLead = true): TaskFacts {
  return { id, description: `Task ${id}`, dueDate, priority: "NORMAL", lead: withLead ? { id: `L-${id}`, name: `Lead for ${id}`, businessName: null, email: null, phone: null, stage: "WON", business: "FDH" } : null };
}

test("the bell: uncontacted website enquiries, website applications, callbacks due and follow-ups due today or overdue", () => {
  const startOfToday = new Date(NOW);
  startOfToday.setHours(0, 0, 0, 0);
  const at = (hoursFromMidnight: number) => new Date(startOfToday.getTime() + hoursFromMidnight * 3600_000).toISOString();
  const bell = notificationsFrom(
    {
      leads: [
        lead("old", { createdAt: "2026-10-19T09:00:00.000Z" }),
        lead("new", { createdAt: "2026-10-21T09:00:00.000Z", business: "LDB" }),
        lead("called", { stage: "AWAITING_RESPONSE" }),
        lead("cold", { source: "COLD_OUTREACH" }),
      ],
      applications: [application("form"), application("imported", { source: "GMAIL_IMPORT" }), application("seen", { status: "REVIEWED" })],
      tasks: [task("tomorrow", at(30)), task("today", at(15)), task("overdue", at(-30)), task("no lead", at(-1), false)],
    },
    [{ id: "cb", name: "Call back", nextCallableAt: new Date("2026-10-21T11:00:00.000Z") }],
    NOW
  );
  assert.deepEqual(bell.websiteLeads.map((l) => [l.id, l.business]), [["new", "LDB"], ["old", "FDH"]], "newest first");
  assert.deepEqual(bell.newApplications.map((a) => a.id), ["form"], "website form only, New only");
  assert.deepEqual(bell.followUps.map((f) => [f.id, f.overdue, f.leadId]), [["overdue", true, "L-overdue"], ["today", false, "L-today"]]);
  assert.deepEqual(bell.dueCallbacks, [{ id: "cb", name: "Call back", nextCallableAt: "2026-10-21T11:00:00.000Z" }]);
  assert.equal(bell.count, 2 + 1 + 1 + 2);
});
