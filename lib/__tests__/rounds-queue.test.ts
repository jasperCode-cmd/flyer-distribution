import { test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_LABELS, nextToDo, planFiles, progressOf, statusOf, type QueueStatus } from "@/lib/rounds/queue";

// Working through a round's screenshots: each one's state, the progress,
// what comes next (Skip and Save and next), and picking the same files
// again to carry on, matched by their fingerprints.

const sha = (n: number) => n.toString(16).padStart(64, "0");

test("a screenshot's state: saved once its line is, lined up once its alignment is, else to do", () => {
  assert.equal(statusOf({ routeLengthM: 830, alignment: null }), "saved");
  assert.equal(statusOf({ routeLengthM: null, alignment: {} as never }), "lined");
  assert.equal(statusOf({ routeLengthM: null, alignment: null }), "todo");
  assert.deepEqual(Object.values(STATUS_LABELS), ["To do", "Lined up", "Traced", "Saved", "Skipped", "Ready for review", "Needs line-up"]);
});

test("progress reads as so many of so many done, with any skipped", () => {
  const statuses: QueueStatus[] = [...Array(14).fill("saved"), ...Array(46).fill("todo"), "lined", "traced", "skipped"];
  assert.equal(progressOf(statuses).label, "14 of 63 done, 1 skipped");
  assert.equal(progressOf(["saved", "todo"]).label, "1 of 2 done");
  assert.equal(progressOf(["saved", "review", "review", "needs", "skipped"]).label, "1 of 5 done, 2 ready for review, 1 skipped");
  assert.deepEqual(progressOf([]), { total: 0, saved: 0, skipped: 0, review: 0, label: "0 of 0 done" });
});

test("the next one: the first later one not saved or skipped, then from the start, then none", () => {
  const s: QueueStatus[] = ["saved", "todo", "skipped", "lined", "saved"];
  assert.equal(nextToDo(s, -1), 1);
  assert.equal(nextToDo(s, 1), 3, "skipped ones are passed over");
  assert.equal(nextToDo(s, 3), 1, "back round to the start");
  assert.equal(nextToDo(["saved", "skipped"], 0), -1);
  // Automatic line-ups waiting for review are reviewed, not worked through; ones it couldn't place are.
  assert.equal(nextToDo(["saved", "review", "needs"], 0), 2);
  // Only ones whose file is to hand.
  assert.equal(nextToDo(["todo", "todo", "todo"], -1, (i) => i === 2), 2);
  assert.equal(nextToDo(["todo"], 0, () => false), -1);
});

test("files picked again are matched to the round's screenshots by fingerprint; new ones are added up to the limit", () => {
  const shots = [
    { id: "s1", sha256: sha(1) },
    { id: "s2", sha256: sha(2) },
    { id: "s3", sha256: null },
  ];
  const plan = planFiles([{ sha256: sha(2) }, { sha256: sha(9) }, { sha256: sha(1) }, { sha256: sha(9) }, { sha256: sha(8) }], shots, 100);
  assert.deepEqual(plan.matched, [
    { file: 0, shotId: "s2" },
    { file: 2, shotId: "s1" },
  ]);
  assert.deepEqual(plan.fresh, [1, 4]);
  assert.equal(plan.repeats, 1);
  assert.equal(plan.overLimit, 0);
  // The limit counts what the round has already.
  const full = planFiles([{ sha256: sha(7) }, { sha256: sha(1) }, { sha256: sha(6) }], shots, 4);
  assert.deepEqual(full.fresh, [0]);
  assert.deepEqual(full.matched, [{ file: 1, shotId: "s1" }]);
  assert.equal(full.overLimit, 1);
  // Sixty new ones for an empty round.
  const sixty = planFiles(Array.from({ length: 60 }, (_, i) => ({ sha256: sha(100 + i) })), [], 100);
  assert.equal(sixty.fresh.length, 60);
});
