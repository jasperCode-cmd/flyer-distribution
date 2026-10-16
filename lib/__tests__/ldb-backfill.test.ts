import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyBackfill,
  BACKFILL_STAGES,
  gmailQuery,
  hasLaterReply,
  importNote,
  leadDataFor,
  LOST_NOTE,
  parseBackfillArgs,
  parseNotificationText,
  planBackfill,
  previewTable,
  readNotification,
  suggestStage,
  summaryLine,
  type ApplyDb,
  type Contact,
  type PlanRow,
} from "@/lib/ldb-backfill";
import { enquiryNote } from "@/lib/ldb-intake";
import { isPersonLoggedContact } from "@/lib/activity-origin";
import {
  daysAgo,
  FDH,
  fakeReader,
  JAMES_HTML,
  LDB,
  msg,
  NO_CONTACT_TEXT,
  notification,
  NOW,
  OPTIONS,
  SARAH_TEXT,
  SENDER,
  SPARSE_TEXT,
  SUBJECT,
  thread,
} from "./ldb-backfill-fixtures";

const OWN = [FDH, LDB, SENDER];

async function plan(threads: ReturnType<typeof thread>[], o: { contacts?: Contact[]; imported?: string[]; options?: Partial<typeof OPTIONS> } = {}) {
  const reader = fakeReader(threads);
  const result = await planBackfill({
    reader,
    imported: new Set(o.imported ?? []),
    contacts: o.contacts ?? [],
    options: { ...OPTIONS, ...o.options },
    own: [FDH, LDB],
    excluded: [],
    now: NOW,
  });
  return { ...result, reader };
}

const byName = (rows: PlanRow[], name: string) => rows.find((r) => r.name === name)!;

// --- Reading a notification ---------------------------------------------------

test("backfill: a notification's labelled fields become the intake's fields, through the intake's own validation", () => {
  const read = readNotification(notification("m1", daysAgo(3), SARAH_TEXT), OWN);
  assert.ok(read.ok);
  assert.deepEqual(read.ok && read.enquiry, {
    name: "Sarah Mitchell",
    email: "sarah@example.com",
    phone: "07700900123",
    businessName: "Mitchell Interiors",
    postcode: null,
    areas: "Bournemouth, Poole, Westbourne",
    quantity: "5000",
    service: "leaflet-distribution",
    budget: "500-1000",
    startDate: "2026-11-01",
    message: "Looking to target residential areas only.\nThank you.",
    projectLocation: null,
    deadline: null,
    scale: null,
    printingIncluded: true,
    designIncluded: false,
  });
});

test("backfill: an HTML table notification reads the same way, a label then its value", () => {
  const read = readNotification(notification("m2", daysAgo(3), "", { html: JAMES_HTML }), OWN);
  assert.ok(read.ok, read.ok ? "" : read.reason);
  assert.equal(read.ok && read.enquiry.name, "James");
  assert.equal(read.ok && read.enquiry.phone, "01202 555000");
  assert.equal(read.ok && read.enquiry.projectLocation, "Lansdowne Road, Bournemouth");
  assert.equal(read.ok && read.enquiry.deadline, "2026-12-15");
  assert.equal(read.ok && read.enquiry.scale, "2000 households");
  assert.equal(read.ok && read.enquiry.message, "Planning consultation for proposed development.");
  // Areas over several lines are one list; labels are matched however they're written.
  assert.deepEqual(parseNotificationText("Target areas:\nPoole\nBoscombe\n\nFIRST-NAME: Ann"), { areas: "Poole, Boscombe", firstName: "Ann" });
});

test("backfill: a notification with fields missing still reads, and one without a way to contact them is unreadable", () => {
  const sparse = readNotification(notification("m3", daysAgo(3), SPARSE_TEXT), OWN);
  assert.ok(sparse.ok);
  assert.equal(sparse.ok && sparse.enquiry.name, "Priya Shah");
  assert.equal(sparse.ok && sparse.enquiry.phone, null);
  assert.equal(sparse.ok && sparse.enquiry.areas, null);
  assert.equal(sparse.ok && sparse.enquiry.service, null);
  assert.equal(sparse.ok && sparse.enquiry.printingIncluded, false);

  const noContact = readNotification(notification("m4", daysAgo(3), NO_CONTACT_TEXT), OWN);
  assert.deepEqual(noContact, { ok: false, reason: "An email address or phone number is required", name: "Owen Hale", email: null, phone: null });
  // The email's own single Reply-To stands in for a missing email address, unless it's one of ours.
  const viaReplyTo = readNotification(notification("m5", daysAgo(3), NO_CONTACT_TEXT, { replyTo: "Owen <owen@example.org>" }), OWN);
  assert.equal(viaReplyTo.ok && viaReplyTo.enquiry.email, "owen@example.org");
  const ourReplyTo = readNotification(notification("m6", daysAgo(3), NO_CONTACT_TEXT, { replyTo: LDB }), OWN);
  assert.equal(ourReplyTo.ok, false);

  const noName = readNotification(notification("m7", daysAgo(3), "Email: someone@example.org"), OWN);
  assert.equal(!noName.ok && noName.reason, "Name is required");
  const tooLong = readNotification(notification("m8", daysAgo(3), `Name: ${"x".repeat(101)}\nEmail: a@example.org`), OWN);
  assert.equal(!tooLong.ok && tooLong.reason, "name is too long");
});

// --- Stage --------------------------------------------------------------------

test("backfill: the suggested stage is Awaiting Response after a reply, Lost when old with none, Uncontacted otherwise", () => {
  assert.equal(suggestStage({ replied: true, receivedAt: daysAgo(90), now: NOW }), "AWAITING_RESPONSE");
  assert.equal(suggestStage({ replied: false, receivedAt: daysAgo(31), now: NOW }), "LOST");
  assert.equal(suggestStage({ replied: false, receivedAt: daysAgo(30), now: NOW }), "UNCONTACTED", "30 days is not more than 30");
  assert.equal(suggestStage({ replied: false, receivedAt: daysAgo(2), now: NOW }), "UNCONTACTED");
});

test("backfill: a reply is a later message from the Bournemouth address to the enquirer, not another notification", () => {
  const note = notification("n1", daysAgo(40), SARAH_TEXT);
  const reply = (id: string, o: { at: Date; from?: string; to?: string; subject?: string; labels?: string[] }) =>
    msg(id, { from: o.from ?? LDB, to: o.to ?? "sarah@example.com", subject: o.subject ?? `Re: ${SUBJECT}`, at: o.at, labels: o.labels, text: "Hi" });
  const has = (...others: ReturnType<typeof msg>[]) => hasLaterReply(thread("t", [note, ...others]), note, "sarah@example.com", OPTIONS);

  assert.equal(has(reply("r1", { at: daysAgo(39) })), true);
  assert.equal(has(reply("r2", { at: daysAgo(39), labels: ["SENT"] })), true, "sent from the shared Gmail as the LDB address");
  assert.equal(has(reply("r3", { at: daysAgo(41) })), false, "before the enquiry");
  assert.equal(has(reply("r4", { at: daysAgo(39), from: "sarah@example.com", to: LDB })), false, "from them, not us");
  assert.equal(has(reply("r5", { at: daysAgo(39), to: "someone.else@example.com" })), false, "to another enquirer in the same thread");
  assert.equal(has(reply("r6", { at: daysAgo(39), labels: ["DRAFT"] })), false, "a draft is not a reply");
  // A later notification in the same thread (another enquiry) is not a reply,
  // even if the notifications come from the Bournemouth address itself.
  const fromLdb = { ...OPTIONS, from: LDB };
  const n2 = msg("n2", { from: LDB, at: daysAgo(40), text: SARAH_TEXT });
  const n3 = msg("n3", { from: LDB, at: daysAgo(10), to: "sarah@example.com", text: SARAH_TEXT });
  assert.equal(hasLaterReply(thread("t2", [n2, n3]), n2, "sarah@example.com", fromLdb), false);
  // With no email address on the enquiry, any later message from us counts.
  assert.equal(hasLaterReply(thread("t3", [note, reply("r7", { at: daysAgo(39), to: "x@example.com" })]), note, null, OPTIONS), true);
});

// --- The plan --------------------------------------------------------------------

test("backfill: the plan finds only notifications, oldest first, with the right stage and skip reasons", async () => {
  const threads = [
    thread("t1", [
      notification("sarah", daysAgo(45), SARAH_TEXT),
      msg("sarah-reply", { from: LDB, to: "sarah@example.com", subject: `Re: ${SUBJECT}`, at: daysAgo(44), labels: ["SENT"], text: "Hi Sarah" }),
      msg("sarah-back", { from: "sarah@example.com", subject: `Re: ${SUBJECT}`, at: daysAgo(43), text: "Thanks" }),
    ]),
    thread("t2", [notification("james", daysAgo(60), "", { html: JAMES_HTML })]),
    thread("t3", [notification("priya", daysAgo(5), SPARSE_TEXT)]),
    thread("t4", [notification("owen", daysAgo(4), NO_CONTACT_TEXT)]),
    // Not notifications: a forward we sent, and the same subject from someone else.
    thread("t5", [msg("fwd", { from: LDB, subject: SUBJECT, at: daysAgo(3), labels: ["SENT"], text: SARAH_TEXT })]),
    thread("t6", [msg("other", { from: "spam@example.org", subject: SUBJECT, at: daysAgo(2), text: SARAH_TEXT })]),
  ];
  const { rows, reader } = await plan(threads);
  assert.deepEqual(reader.queries, [`from:${SENDER} subject:"${SUBJECT}"`]);
  assert.deepEqual(rows.map((r) => r.messageId), ["james", "sarah", "priya", "owen"]);
  assert.equal(byName(rows, "Sarah Mitchell").stage, "AWAITING_RESPONSE");
  assert.equal(byName(rows, "James").stage, "LOST");
  assert.equal(byName(rows, "Priya Shah").stage, "UNCONTACTED");
  assert.deepEqual(byName(rows, "Owen Hale").skip, { kind: "unreadable", reason: "Could not read: An email address or phone number is required" });
  assert.equal(byName(rows, "James").areas, "Lansdowne Road, Bournemouth", "the project location stands in for areas");
  assert.equal(
    summaryLine(rows),
    "Summary: 4 notifications found. 3 to import (1 Uncontacted, 1 Awaiting Response, 1 Lost). 1 skipped (0 duplicates, 1 unreadable, 0 already imported, 0 excluded)."
  );
  const table = previewTable(rows);
  assert.match(table[0], /^Date \(UK\)\s+Name\s+Email\s+Phone\s+Areas\s+Stage\s+Skip reason$/);
  assert.match(table[2], /^\d{4}-\d{2}-\d{2}  James /);
  assert.match(table.find((l) => l.includes("Owen Hale"))!, /Could not read: An email address or phone number is required$/);
});

test("backfill: an enquiry matching an existing lead of either business is skipped, unless duplicates are included", async () => {
  const threads = [
    thread("t1", [notification("sarah", daysAgo(10), SARAH_TEXT)]),
    thread("t2", [notification("james", daysAgo(9), "", { html: JAMES_HTML })]),
    thread("t3", [notification("priya", daysAgo(8), SPARSE_TEXT)]),
    // Priya again: a match with an earlier enquiry in the same import.
    thread("t4", [notification("priya-again", daysAgo(2), "Name: Priya S\nEmail: PRIYA.SHAH@example.net")]),
  ];
  const contacts: Contact[] = [
    { id: "fdh-lead", name: "Sarah M (FDH)", email: "Sarah@Example.com", phone: null },
    { id: "ldb-lead", name: "James H (LDB)", email: null, phone: "+44 1202 555000" },
  ];
  const { rows } = await plan(threads, { contacts });
  assert.deepEqual(byName(rows, "Sarah Mitchell").skip, { kind: "duplicate", reason: "Matches Sarah M (FDH) (fdh-lead)" });
  assert.deepEqual(byName(rows, "James").skip, { kind: "duplicate", reason: "Matches James H (LDB) (ldb-lead)" }, "phone in another format");
  assert.equal(byName(rows, "Priya Shah").skip, null);
  assert.match(byName(rows, "Priya S").skip!.reason, /^Matches Priya Shah, an earlier enquiry in this import \(\d{4}-\d{2}-\d{2}\)$/);

  const included = await plan(threads, { contacts, options: { includeDuplicates: true } });
  assert.equal(included.rows.filter((r) => r.skip).length, 0);
  const db = fakeApplyDb(contacts);
  await applyBackfill(db, included.rows);
  const sarahNote = db.created.find((c) => c.name === "Sarah Mitchell")!.activities.create.detail;
  assert.match(sarahNote, /^Possible duplicate of existing lead\(s\): Sarah M \(FDH\) \(fdh-lead\)$/m);
  const priyaAgainNote = db.created.find((c) => c.name === "Priya S")!.activities.create.detail;
  assert.match(priyaAgainNote, /^Possible duplicate of existing lead\(s\): Priya Shah \(new-3\)$/m, "the lead made earlier in this run");
});

test("backfill: --since, --stage and already-imported messages", async () => {
  const threads = [
    thread("t1", [notification("old", daysAgo(100), SARAH_TEXT)]),
    thread("t2", [notification("new", daysAgo(5), SPARSE_TEXT)]),
  ];
  const since = await plan(threads, { options: { since: daysAgo(10).toISOString().slice(0, 10) } });
  assert.deepEqual(since.rows.map((r) => r.messageId), ["new"]);
  assert.match(since.reader.queries[0], / after:\d{4}\/\d{2}\/\d{2}$/);
  const forced = await plan(threads, { options: { stage: "UNCONTACTED" } });
  assert.deepEqual(forced.rows.map((r) => [r.suggestedStage, r.stage]), [["LOST", "UNCONTACTED"], ["UNCONTACTED", "UNCONTACTED"]]);
  const again = await plan(threads, { imported: ["old"] });
  assert.deepEqual(again.rows.find((r) => r.messageId === "old")!.skip, { kind: "imported", reason: "Already imported" });
  assert.equal(gmailQuery({ from: SENDER, subject: 'Say "hi"', since: "2026-03-01" }), `from:${SENDER} subject:"Say hi" after:2026/02/28`);
});

// --- Writing -------------------------------------------------------------------------

type Created = { name: string; email: string | null; phone: string | null; createdAt: Date; stage: string; lostReason?: string; lostReasonNote?: string | null; activities: { create: { type: string; detail: string; createdAt: Date } } };

function fakeApplyDb(existing: Contact[] = []) {
  const created: Created[] = [];
  const notes: { detail: string }[] = [];
  const db: ApplyDb & { created: Created[] } = {
    created,
    lead: {
      async findMany() {
        return [...existing.map((c) => ({ id: c.id!, name: c.name, email: c.email, phone: c.phone })), ...created.map((c, i) => ({ id: `new-${i + 1}`, name: c.name, email: c.email, phone: c.phone }))];
      },
    },
    activity: {
      async findMany(args: { where: { detail: { contains: string } } }) {
        return notes.filter((n) => n.detail.includes(args.where.detail.contains));
      },
    },
    async $transaction(fn) {
      return fn({
        activity: db.activity,
        lead: {
          async create(args) {
            created.push(args.data);
            notes.push({ detail: args.data.activities.create.detail });
            return { id: `new-${created.length}` };
          },
        },
      });
    },
  };
  return db;
}

test("backfill: an imported lead is dated when the email arrived and noted like a new one, plus where it came from", async () => {
  const at = daysAgo(45);
  const { rows } = await plan([thread("t1", [notification("sarah-msg", at, SARAH_TEXT)])]);
  const data = leadDataFor(rows[0], []);
  assert.equal(data.createdAt?.toISOString(), at.toISOString());
  assert.equal(data.activities.create.createdAt?.toISOString(), at.toISOString());
  assert.equal(data.business, "LDB");
  assert.equal(data.source, "WEBSITE_QUOTE_FORM");
  assert.equal(data.stage, "LOST");
  assert.equal(data.lostReason, "OTHER");
  assert.equal(data.lostReasonNote, LOST_NOTE);
  const note = importNote(rows[0].enquiry!, [], "sarah-msg");
  assert.equal(note, `${enquiryNote(rows[0].enquiry!, [])}\nImported from Gmail\nGmail message ID: sarah-msg`);
  assert.equal(data.activities.create.detail, note);
  assert.equal(isPersonLoggedContact({ type: "NOTE", detail: note, userId: null }), false, "never counts as contact");
  assert.equal("userId" in data.activities.create, false);
});

test("backfill: --apply twice creates nothing the second time", async () => {
  const threads = [
    thread("t1", [notification("a", daysAgo(45), SARAH_TEXT)]),
    thread("t2", [notification("b", daysAgo(3), SPARSE_TEXT)]),
  ];
  const db = fakeApplyDb();
  const first = await plan(threads);
  assert.deepEqual(await applyBackfill(db, first.rows), { created: 2, alreadyImported: 0 });
  // The same rows again (a second --apply from the same preview) are checked inside each transaction.
  assert.deepEqual(await applyBackfill(db, first.rows), { created: 0, alreadyImported: 2 });
  assert.equal(db.created.length, 2);
  // A fresh run reads the notes and skips both before writing anything.
  const imported = new Set((await db.activity.findMany({ where: { detail: { contains: "Gmail message ID: " } }, select: { detail: true } })).flatMap((n) => n.detail.match(/^Gmail message ID: (\S+)$/m)?.[1] ?? []));
  const second = await plan(threads, { imported: [...imported] });
  assert.deepEqual(second.rows.map((r) => r.skip?.kind), ["imported", "imported"]);
  assert.deepEqual(await applyBackfill(db, second.rows), { created: 0, alreadyImported: 0 });
  assert.equal(db.created.length, 2);
});

// --- The command line ------------------------------------------------------------------

test("backfill: options are checked, and the Bournemouth address can come from LDB_SENDER_ADDRESS", () => {
  const base = [`--from=${SENDER}`, `--subject=${SUBJECT}`];
  const ok = parseBackfillArgs([...base, "--since=2026-01-31", "--stage=LOST", "--include-duplicates", "--apply"], { ldbAddress: LDB });
  assert.deepEqual(ok, { ok: true, options: { ...OPTIONS, since: "2026-01-31", stage: "LOST", includeDuplicates: true, apply: true } });
  assert.deepEqual(parseBackfillArgs(base, { ldbAddress: LDB }), { ok: true, options: OPTIONS }, "preview by default");
  assert.equal(parseBackfillArgs([...base, `--ldb-address=${LDB}`], { ldbAddress: null }).ok, true);
  const errors: [string[], { ldbAddress: string | null }][] = [
    [[`--subject=${SUBJECT}`], { ldbAddress: LDB }],
    [[`--from=${SENDER}`], { ldbAddress: LDB }],
    [base, { ldbAddress: null }],
    [[...base, "--stage=WON"], { ldbAddress: LDB }],
    [[...base, "--since=2026-02-30"], { ldbAddress: LDB }],
    [[...base, "--aply"], { ldbAddress: LDB }],
    [[...base, "--apply=yes"], { ldbAddress: LDB }],
    [[...base, "extra"], { ldbAddress: LDB }],
  ];
  for (const [argv, env] of errors) assert.equal(parseBackfillArgs(argv, env).ok, false, argv.join(" "));
});

test("backfill: an imported lead never starts as Won or Completed, which need a won date and stage history", () => {
  assert.deepEqual([...BACKFILL_STAGES], ["UNCONTACTED", "AWAITING_RESPONSE", "LOST"]);
  assert.equal(parseBackfillArgs([`--from=${SENDER}`, `--subject=${SUBJECT}`, "--stage=COMPLETED"], { ldbAddress: LDB }).ok, false);
});

test("backfill: the script never prints its settings", () => {
  const source = readFileSync("scripts/backfill-ldb-enquiries.ts", "utf8");
  assert.doesNotMatch(source, /console\.\w+\([^)]*process\.env/);
  assert.match(source, /config\(\{ path: \[".env.local", ".env"\], quiet: true \}\)/, "loads settings like the wonAt backfill");
});
