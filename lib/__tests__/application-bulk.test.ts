import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchDistributor,
  moveApplicationsToDistributors,
  planBulkMove,
  readBulkIds,
  type BulkApplication,
  type BulkDb,
  type BulkTx,
  type MatchableDistributor,
} from "@/lib/application-bulk";
import type { StoredApplication } from "@/lib/distributor-applications";

type App = StoredApplication & { distributorId: string | null; status: string };
type Dist = MatchableDistributor & { notes: string | null; createdAt: number };

function app(id: string, fullName: string, extra: Partial<App> = {}): App {
  return {
    id,
    fullName,
    phone: null,
    email: null,
    area: "Poole",
    age: "30",
    hasCar: true,
    hasLicence: true,
    availability: "Weekdays",
    notes: null,
    receivedAt: new Date(`2026-09-${String(10 + Number(id.replace(/\D/g, "") || 0)).padStart(2, "0")}T10:00:00Z`),
    distributorId: null,
    status: "NEW",
    ...extra,
  };
}

// An in-memory stand-in for the database whose $transaction behaves like
// the real one: if anything inside throws, everything that transaction did
// is undone. failOn makes one application's link step throw, after its new
// distributor has already been created.
function fakeDb(apps: App[], distributors: Dist[] = [], options: { failOn?: string } = {}) {
  let state = { apps: new Map(apps.map((a) => [a.id, { ...a }])), distributors: distributors.map((d) => ({ ...d })) };
  let nextId = 1;
  let clock = 1000;
  const counts = { creates: 0, rolledBack: 0 };
  const clone = () => ({
    apps: new Map([...state.apps].map(([k, v]) => [k, { ...v }])),
    distributors: state.distributors.map((d) => ({ ...d })),
  });
  const tx: BulkTx = {
    $executeRaw: async () => 1,
    distributorApplication: {
      findUnique: async ({ where }) => {
        const found = state.apps.get(where.id);
        return found ? { ...found } : null;
      },
      updateMany: async ({ where, data }) => {
        if (options.failOn === where.id) throw Object.assign(new Error("connection lost"), { code: "P1017" });
        const found = state.apps.get(where.id);
        if (!found || found.distributorId !== null) return { count: 0 };
        found.distributorId = data.distributorId;
        found.status = data.status;
        return { count: 1 };
      },
    },
    distributor: {
      findMany: async () =>
        [...state.distributors]
          .sort((a, b) => a.createdAt - b.createdAt)
          .map(({ id, name, phone, email }) => ({ id, name, phone, email })),
      findUnique: async ({ where }) => {
        const d = state.distributors.find((x) => x.id === where.id);
        return d ? { id: d.id, name: d.name } : null;
      },
      create: async ({ data }) => {
        counts.creates++;
        const d = { id: `new${nextId++}`, ...data, createdAt: clock++ };
        state.distributors.push(d);
        return { id: d.id, name: d.name };
      },
    },
  };
  const db: BulkDb = {
    async $transaction(fn) {
      const snapshot = clone();
      try {
        return await fn(tx);
      } catch (err) {
        state = snapshot;
        counts.rolledBack++;
        throw err;
      }
    },
  };
  return { db, counts, state: () => state };
}

const EXISTING: Dist[] = [
  { id: "d1", name: "Priya Shah", phone: "07700 900111", email: "priya@example.com", notes: null, createdAt: 1 },
  { id: "d2", name: "Sam Turner", phone: null, email: "sam.turner@example.com", notes: null, createdAt: 2 },
];

function asBulk(a: App, distributor: { id: string; name: string } | null = null): BulkApplication {
  return { id: a.id, fullName: a.fullName, phone: a.phone, email: a.email, receivedAt: a.receivedAt, distributor };
}

// --- Matching -------------------------------------------------------------

test("matching: the same phone number in any format, or the same email ignoring case and spaces", () => {
  const list = EXISTING.map(({ id, name, phone, email }) => ({ id, name, phone, email }));
  assert.equal(matchDistributor({ phone: "+44 7700 900111", email: null }, list)?.distributor.id, "d1");
  assert.equal(matchDistributor({ phone: "0044 (7700) 900-111", email: null }, list)?.by, "phone");
  assert.equal(matchDistributor({ phone: null, email: "  SAM.Turner@Example.COM " }, list)?.distributor.id, "d2");
  assert.equal(matchDistributor({ phone: null, email: "  SAM.Turner@Example.COM " }, list)?.by, "email");
  // Phone wins over email when both match different distributors.
  assert.equal(matchDistributor({ phone: "07700900111", email: "sam.turner@example.com" }, list)?.distributor.id, "d1");
  // No match: a different number, too few digits, empty values.
  assert.equal(matchDistributor({ phone: "07700 900112", email: "other@example.com" }, list), null);
  assert.equal(matchDistributor({ phone: "111", email: "" }, [{ id: "x", name: "X", phone: "111", email: null }]), null);
  assert.equal(matchDistributor({ phone: null, email: null }, [{ id: "x", name: "X", phone: null, email: null }]), null);
  assert.equal(matchDistributor({ phone: null, email: "" }, [{ id: "x", name: "X", phone: null, email: "" }]), null);
});

// --- The confirmation summary ---------------------------------------------

test("the summary sorts a selection into new, matched and already linked, listing the names", () => {
  const apps = [
    app("a1", "Alice New", { phone: "07123 456789" }),
    app("a2", "Bea Phone Match", { phone: "+44 7700 900111" }),
    app("a3", "Cal Email Match", { email: "SAM.TURNER@example.com" }),
    app("a4", "Dee Already Linked", { distributorId: "d1" }),
    // Same person as Alice, applied again later in the same selection.
    app("a5", "Alice Again", { phone: "07123456789" }),
    app("a6", "   "),
  ];
  const plan = planBulkMove(
    [...apps.slice(0, 3).map((a) => asBulk(a)), asBulk(apps[3], { id: "d1", name: "Priya Shah" }), asBulk(apps[4]), asBulk(apps[5])],
    EXISTING
  );
  assert.deepEqual(plan.create, [{ id: "a1", fullName: "Alice New" }]);
  assert.deepEqual(plan.match, [
    { id: "a2", fullName: "Bea Phone Match", distributor: { id: "d1", name: "Priya Shah" }, by: "phone" },
    { id: "a3", fullName: "Cal Email Match", distributor: { id: "d2", name: "Sam Turner" }, by: "email" },
    { id: "a5", fullName: "Alice Again", distributor: { id: null, name: "Alice New" }, by: "phone" },
  ]);
  assert.deepEqual(plan.linked, [{ id: "a4", fullName: "Dee Already Linked", distributor: { id: "d1", name: "Priya Shah" } }]);
  assert.deepEqual(plan.cannot.map((c) => c.id), ["a6"]);
});

// --- The move -------------------------------------------------------------

test("confirming creates the new ones with the shared rules, links matches, skips linked, and marks them Approved", async () => {
  const apps = [
    app("a1", "  Alice New ", { phone: "07123 456789", email: "alice@example.com" }),
    app("a2", "Bea Phone Match", { phone: "+44 7700 900111" }),
    app("a3", "Cal Email Match", { email: "SAM.TURNER@example.com" }),
    app("a4", "Dee Already Linked", { distributorId: "d1", status: "APPROVED" }),
  ];
  const { db, state } = fakeDb(apps, EXISTING);
  const results = await moveApplicationsToDistributors(db, ["a1", "a2", "a3", "a4"]);
  assert.deepEqual(
    results.map((r) => [r.id, r.result]),
    [
      ["a1", "created"],
      ["a2", "linked"],
      ["a3", "linked"],
      ["a4", "skipped"],
    ]
  );
  const created = state().distributors.find((d) => d.id === "new1")!;
  assert.equal(created.name, "Alice New", "trimmed, as the single Approve button does");
  assert.equal(created.email, "alice@example.com");
  assert.match(created.notes!, /^From their application received 11 Sept 2026\.\nLives in: Poole/);
  assert.equal(state().distributors.length, 3, "only one new distributor");
  assert.deepEqual(
    ["a1", "a2", "a3"].map((id) => [state().apps.get(id)!.distributorId, state().apps.get(id)!.status]),
    [
      ["new1", "APPROVED"],
      ["d1", "APPROVED"],
      ["d2", "APPROVED"],
    ]
  );
  const skipped = results[3];
  assert.equal(skipped.result === "skipped" && skipped.distributor?.name, "Priya Shah");
});

test("a failure in one application doesn't affect the others, and its own half-done work is undone", async () => {
  const apps = [
    app("a1", "Xena One", { phone: "07111 111111" }),
    app("a2", "Yuri Two", { phone: "07222 222222" }),
    app("a3", "Zoe Three", { phone: "07333 333333" }),
  ];
  const { db, state, counts } = fakeDb(apps, [], { failOn: "a2" });
  const errors: string[] = [];
  const results = await moveApplicationsToDistributors(db, ["a1", "a2", "a3"], (id) => errors.push(id));
  assert.deepEqual(
    results.map((r) => [r.fullName, r.result]),
    [
      ["Xena One", "created"],
      ["Yuri Two", "failed"],
      ["Zoe Three", "created"],
    ]
  );
  const failed = results[1];
  assert.equal(failed.result === "failed" && failed.reason, "Database error (P1017). Nothing was saved for this application.");
  assert.deepEqual(errors, ["a2"]);
  assert.equal(counts.creates, 3, "Yuri's distributor was created inside the transaction...");
  assert.equal(counts.rolledBack, 1);
  assert.deepEqual(
    state().distributors.map((d) => d.name),
    ["Xena One", "Zoe Three"],
    "...and undone with it"
  );
  assert.deepEqual(
    [...state().apps.values()].map((a) => [a.fullName, a.status, a.distributorId !== null]),
    [
      ["Xena One", "APPROVED", true],
      ["Yuri Two", "NEW", false],
      ["Zoe Three", "APPROVED", true],
    ]
  );
});

test("a second run on the same selection creates nothing new", async () => {
  const apps = [
    app("a1", "Alice New", { phone: "07123 456789" }),
    app("a2", "Bea Phone Match", { phone: "+44 7700 900111" }),
    app("a3", "Alice Again", { phone: "+447123456789" }),
  ];
  const { db, state, counts } = fakeDb(apps, EXISTING);
  const first = await moveApplicationsToDistributors(db, ["a1", "a2", "a3"]);
  assert.deepEqual(first.map((r) => r.result), ["created", "linked", "linked"]);
  assert.equal(counts.creates, 1, "Alice's second application links to the distributor her first one created");
  const before = state().distributors.length;

  const second = await moveApplicationsToDistributors(db, ["a1", "a2", "a3"]);
  assert.deepEqual(second.map((r) => r.result), ["skipped", "skipped", "skipped"]);
  assert.equal(counts.creates, 1);
  assert.equal(state().distributors.length, before);
});

test("an application deleted since the preview fails on its own with a reason", async () => {
  const { db } = fakeDb([app("a1", "Alice New")]);
  const results = await moveApplicationsToDistributors(db, ["gone", "a1"]);
  assert.deepEqual(results.map((r) => r.result), ["failed", "created"]);
  assert.equal(results[0].result === "failed" && results[0].reason, "Not found. It may have been deleted.");
});

test("the request's ids are checked: strings only, de-duplicated, at least one, at most 500", () => {
  assert.deepEqual(readBulkIds(["a", "b", "a"]), ["a", "b"]);
  assert.equal(readBulkIds([]), null);
  assert.equal(readBulkIds("a"), null);
  assert.equal(readBulkIds(["a", 5]), null);
  assert.equal(readBulkIds(["x".repeat(65)]), null);
  assert.equal(readBulkIds(Array.from({ length: 501 }, (_, i) => `id${i}`)), null);
  assert.equal(readBulkIds(Array.from({ length: 500 }, (_, i) => `id${i}`))?.length, 500);
});
