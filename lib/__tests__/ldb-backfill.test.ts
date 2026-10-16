import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyBackfill,
  BACKFILL_STAGES,
  DEFAULT_FROM,
  gmailQuery,
  hasLaterReply,
  importNote,
  isNotification,
  isNotificationSubject,
  leadDataFor,
  LOST_NOTE,
  parseBackfillArgs,
  parseNotificationTable,
  planBackfill,
  serviceCode,
  previewTable,
  readNotification,
  suggestStage,
  summaryLine,
  type ApplyDb,
  type Contact,
  type PlanRow,
} from "@/lib/ldb-backfill";
import { enquiryNote, validateLdbEnquiry } from "@/lib/ldb-intake";
import { isPersonLoggedContact } from "@/lib/activity-origin";
import {
  crmCopy,
  daysAgo,
  FDH,
  fakeReader,
  JAMES,
  KIM,
  KIM_AT,
  mailto,
  msg,
  notification,
  notificationHtml,
  NOW,
  OPTIONS,
  OURS,
  OWEN,
  RULES,
  PRIYA,
  SARAH,
  SENDER,
  thread,
} from "./ldb-backfill-fixtures";

async function plan(
  threads: ReturnType<typeof thread>[],
  o: { contacts?: Contact[]; imported?: string[]; options?: Partial<typeof OPTIONS> } = {}
) {
  const reader = fakeReader(threads);
  const result = await planBackfill({
    reader,
    imported: new Set(o.imported ?? []),
    contacts: o.contacts ?? [],
    options: { ...OPTIONS, ...o.options },
    inbox: FDH,
    ours: [FDH],
    excluded: [],
    now: NOW,
  });
  return { ...result, reader };
}

const byName = (rows: PlanRow[], name: string) => rows.find((r) => r.name === name)!;
const read = (sample: { subject: string; html: string; replyTo?: string | null }, extra: { text?: string } = {}) =>
  readNotification(notification("m", daysAgo(3), { ...sample, ...extra }), OURS);

// --- Reading a notification ---------------------------------------------------

test("backfill: a Leaflet Distribution notification's rows map exactly onto the intake's fields", () => {
  const r = read(SARAH);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  assert.deepEqual(r.ok && r.enquiry, {
    name: "Sarah Mitchell",
    email: "sarah@example.com",
    phone: "07700900123",
    businessName: "Mitchell Interiors",
    postcode: null,
    areas: "Bournemouth, Poole, Westbourne",
    quantity: "5000",
    service: "leaflet-distribution",
    budget: "£500 - £1,000",
    startDate: "2026-11-01",
    message: "Looking to target residential areas only.\nIdeally before half term.",
    projectLocation: null,
    deadline: null,
    scale: null,
    printingIncluded: true,
    designIncluded: false,
  });
});

test("backfill: a Public Notice Leafleting notification's rows map exactly onto the intake's fields", () => {
  const r = read(JAMES);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  assert.deepEqual(r.ok && r.enquiry, {
    name: "James Hart",
    email: "james@example.com",
    phone: "01202 555000",
    businessName: null,
    postcode: null,
    areas: null,
    quantity: null,
    service: "public-notice-leafleting",
    budget: "£1,000 - £2,000",
    startDate: null,
    message: "Planning consultation for proposed development.",
    projectLocation: "Lansdowne Road, Bournemouth",
    deadline: "2026-12-15",
    scale: "2000 households",
    printingIncluded: false,
    designIncluded: false,
  });
});

test("backfill: the service is stored as the website's code, so the note matches a lead from the intake endpoint", () => {
  assert.equal(serviceCode("Leaflet Distribution"), "leaflet-distribution");
  assert.equal(serviceCode("Public Notice Leafleting"), "public-notice-leafleting");
  assert.equal(serviceCode("  public notice  LEAFLETING "), "public-notice-leafleting");
  assert.equal(serviceCode("Door Drops"), "Door Drops", "any other service is kept as shown");
  // The same enquiry through the intake endpoint and through the backfill gives the same note.
  const imported = read(JAMES);
  assert.ok(imported.ok);
  const live = validateLdbEnquiry({
    name: "James Hart",
    email: "james@example.com",
    phone: "01202 555000",
    service: "public-notice-leafleting",
    budget: "£1,000 - £2,000",
    projectLocation: "Lansdowne Road, Bournemouth",
    deadline: "2026-12-15",
    scale: "2000 households",
    message: "Planning consultation for proposed development.",
  });
  assert.ok(live.ok);
  assert.equal(imported.ok && enquiryNote(imported.enquiry, []), live.ok && enquiryNote(live.enquiry, []));
});

test('backfill: Areas "None selected" means no areas, and left-out optional rows are empty', () => {
  const r = read(PRIYA);
  assert.ok(r.ok, r.ok ? "" : r.reason);
  assert.equal(r.ok && r.enquiry.areas, null);
  assert.equal(r.ok && r.enquiry.phone, null);
  assert.equal(r.ok && r.enquiry.businessName, null);
  assert.equal(r.ok && r.enquiry.quantity, "2000");
  assert.equal(r.ok && r.enquiry.printingIncluded, false);
  assert.equal(r.ok && r.enquiry.designIncluded, true);
  const lowercase = read({ ...PRIYA, html: PRIYA.html.replace("None selected", "none selected") });
  assert.equal(lowercase.ok && lowercase.enquiry.areas, null);
});

test("backfill: only the table is read; the heading, a layout table around it and lines inside a value never become fields", () => {
  const wrapped = `<table width="100%"><tr><td align="center">
    ${notificationHtml("Leaflet Distribution", [
      ["<strong>Name</strong>", "Sam Lee"],
      ["Email:", mailto("sam@example.com")],
      ["Additional details", "Email: not-this@example.com<br><br>Phone: 000<br>Thanks"],
      ["Something new", "ignored"],
    ])}
  </td></tr></table>`;
  assert.deepEqual(parseNotificationTable(wrapped), {
    name: "Sam Lee",
    email: "sam@example.com",
    message: "Email: not-this@example.com\n\nPhone: 000\nThanks",
  });
  assert.deepEqual(parseNotificationTable("<h2>New Quote Enquiry: Leaflet Distribution</h2>"), {});
  // A plain text version that reads worse than the table never wins.
  const r = read(SARAH, { text: "New Quote Enquiry: Leaflet Distribution\nName Sarah Mitchell" });
  assert.equal(r.ok && r.enquiry.businessName, "Mitchell Interiors");
});

test("backfill: a notification without a way to contact them can't be read; the Reply-To stands in for a missing Email row", () => {
  assert.deepEqual(read(OWEN), { ok: false, reason: "An email address or phone number is required", name: "Owen Hale", email: null, phone: null });
  const viaReplyTo = read({ ...OWEN, replyTo: '"Owen Hale" <owen@example.org>' });
  assert.equal(viaReplyTo.ok && viaReplyTo.enquiry.email, "owen@example.org");
  const ourReplyTo = read({ ...OWEN, replyTo: SENDER });
  assert.equal(ourReplyTo.ok, false, "never one of our own addresses");
  const noName = read({ ...OWEN, html: notificationHtml("Leaflet Distribution", [["Email", mailto("x@example.org")]]) });
  assert.equal(!noName.ok && noName.reason, "Name is required");
});

// --- Which emails are notifications ---------------------------------------------

test("backfill: the three subject forms are notifications; replies, forwards and other subjects are not", () => {
  for (const s of ["Leaflet Distribution enquiry from Sarah Mitchell", "Public Notice Leafleting enquiry from James", "Quote enquiry from Kim Ward", "  leaflet distribution ENQUIRY from  Ann "]) {
    assert.equal(isNotificationSubject(s), true, s);
  }
  for (const s of ["Re: Leaflet Distribution enquiry from Sarah", "Fwd: Quote enquiry from Kim", "Leaflet Distribution enquiry from ", "New quote request", null]) {
    assert.equal(isNotificationSubject(s), false, String(s));
  }
  const n = notification("n", daysAgo(3), SARAH);
  assert.deepEqual(n.labelIds, ["SENT", "INBOX"], "as Gmail labels a notification from its send-as address");
  assert.equal(isNotification(n, RULES), true);
  assert.equal(isNotification({ ...n, labelIds: ["INBOX"] }, RULES), true, "with INBOX alone too");
  assert.equal(isNotification({ ...n, labelIds: ["DRAFT"] }, RULES), false, "a draft");
  const withHeaders = (headers: Record<string, string>) => ({
    ...n,
    payload: { ...n.payload, headers: n.payload!.headers!.map((h) => (h.name! in headers ? { ...h, value: headers[h.name!] } : h)) },
  });
  assert.equal(isNotification(withHeaders({ To: "someone@example.org" }), RULES), false, "not to the Hampshire Gmail");
  assert.equal(isNotification(withHeaders({ To: `${FDH}, someone@example.org` }), RULES), false, "to someone else as well");
  assert.equal(isNotification(withHeaders({ To: SENDER }), RULES), false, "to the Bournemouth address, not the Hampshire Gmail");
  assert.equal(isNotification(withHeaders({ "Reply-To": SENDER }), RULES), false, "Reply-To one of ours");
  assert.equal(isNotification(withHeaders({ "Reply-To": FDH }), RULES), false, "Reply-To the Hampshire Gmail");
  assert.equal(
    isNotification(msg("x", { from: "someone@example.org", subject: SARAH.subject, at: daysAgo(3), replyTo: SARAH.replyTo, html: SARAH.html }), RULES),
    false,
    "another sender"
  );
});

test("backfill: a real-shaped notification labelled SENT and INBOX is still found and imported", async () => {
  const sent = notification("send-as", daysAgo(4), SARAH);
  assert.deepEqual(sent.labelIds, ["SENT", "INBOX"]);
  const { rows } = await plan([thread("t1", [sent])]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].skip, null);
  assert.equal(rows[0].name, "Sarah Mitchell");
  assert.equal(rows[0].stage, "UNCONTACTED", "a notification is not our reply to itself");
  const db = fakeApplyDb();
  assert.deepEqual(await applyBackfill(db, rows), { created: 1, alreadyImported: 0 });
  assert.equal(db.created[0].name, "Sarah Mitchell");
  assert.equal(db.created[0].createdAt.toISOString(), daysAgo(4).toISOString());
});

test("backfill: the CRM's own emails to a Bournemouth lead are never notifications, whatever their subject", () => {
  assert.equal(isNotification(crmCopy("c1", daysAgo(2), "sarah@example.com", `Re: ${SARAH.subject}`), RULES), false);
  assert.equal(isNotification(crmCopy("c2", daysAgo(2), "sarah@example.com", SARAH.subject), RULES), false, "to the lead, Reply-To us");
});

// --- Stage --------------------------------------------------------------------

test("backfill: the suggested stage is Awaiting Response after a reply, Lost when old with none, Uncontacted otherwise", () => {
  assert.equal(suggestStage({ replied: true, receivedAt: daysAgo(90), now: NOW }), "AWAITING_RESPONSE");
  assert.equal(suggestStage({ replied: false, receivedAt: daysAgo(31), now: NOW }), "LOST");
  assert.equal(suggestStage({ replied: false, receivedAt: daysAgo(30), now: NOW }), "UNCONTACTED", "30 days is not more than 30");
  assert.equal(suggestStage({ replied: false, receivedAt: daysAgo(2), now: NOW }), "UNCONTACTED");
});

test("backfill: a reply is a later message to the enquirer from the Bournemouth address or the Hampshire Gmail", () => {
  const n = notification("n1", daysAgo(40), SARAH);
  const reply = (id: string, o: { at: Date; from?: string; to?: string; labels?: string[] }) =>
    msg(id, { from: o.from ?? FDH, to: o.to ?? "sarah@example.com", subject: `Re: ${SARAH.subject}`, at: o.at, labels: o.labels ?? ["SENT"], text: "Hi" });
  const has = (...others: ReturnType<typeof msg>[]) => hasLaterReply(thread("t", [n, ...others]), n, "sarah@example.com", RULES);

  assert.equal(has(reply("r1", { at: daysAgo(39) })), true, "from the Hampshire Gmail");
  assert.equal(has(reply("r2", { at: daysAgo(39), from: `"Leaflet Distribution Bournemouth" <${SENDER}>`, labels: ["INBOX"] })), true, "from the Bournemouth address");
  assert.equal(has(crmCopy("r3", daysAgo(39), "sarah@example.com", `Re: ${SARAH.subject}`)), true, "the CRM's own email is a reply");
  assert.equal(has(reply("r4", { at: daysAgo(41) })), false, "before the enquiry");
  assert.equal(has(reply("r5", { at: daysAgo(39), from: "sarah@example.com", to: FDH, labels: ["INBOX"] })), false, "from them, not us");
  assert.equal(has(reply("r6", { at: daysAgo(39), to: "someone.else@example.com" })), false, "to someone else");
  assert.equal(has(reply("r7", { at: daysAgo(39), labels: ["DRAFT"] })), false, "a draft is not a reply");
  assert.equal(has(reply("r8", { at: daysAgo(39), from: "other@example.org" })), false, "not one of our addresses");
  // A later notification in the same thread is another enquiry, not a reply.
  const second = notification("n2", daysAgo(10), SARAH);
  assert.equal(hasLaterReply(thread("t2", [n, second]), n, "sarah@example.com", RULES), false);
});

// --- The plan --------------------------------------------------------------------

test("backfill: the plan finds every notification form, oldest first, and never the CRM's copies, replies or sent mail", async () => {
  const threads = [
    thread("t1", [
      notification("sarah", daysAgo(45), SARAH),
      // We replied from the Hampshire Gmail.
      msg("sarah-reply", { from: FDH, to: "sarah@example.com", subject: `Re: ${SARAH.subject}`, at: daysAgo(44), labels: ["SENT"], text: "Hi Sarah" }),
      msg("sarah-back", { from: "sarah@example.com", to: FDH, subject: `Re: ${SARAH.subject}`, at: daysAgo(43), text: "Thanks" }),
    ]),
    thread("t2", [notification("james", daysAgo(60), JAMES)]),
    thread("t3", [notification("priya", daysAgo(5), PRIYA)]),
    thread("t4", [notification("kim", KIM_AT, KIM)]),
    thread("t5", [notification("owen", daysAgo(4), OWEN)]),
    // Never notifications: the CRM's copies and a forward we sent.
    thread("t6", [
      crmCopy("crm-re", daysAgo(3), "james@example.com", `Re: ${JAMES.subject}`),
      crmCopy("crm-new", daysAgo(2), "priya.shah@example.net", PRIYA.subject),
    ]),
    thread("t7", [msg("fwd", { from: FDH, to: "someone@example.org", subject: `Fwd: ${SARAH.subject}`, at: daysAgo(2), labels: ["SENT"], html: SARAH.html })]),
  ];
  const { rows, reader } = await plan(threads);
  assert.deepEqual(reader.queries, [`from:${SENDER} subject:"enquiry from"`]);
  assert.deepEqual(rows.map((r) => r.messageId), ["kim", "james", "sarah", "priya", "owen"]);
  assert.equal(byName(rows, "Sarah Mitchell").stage, "AWAITING_RESPONSE", "we replied from the Hampshire Gmail");
  assert.equal(byName(rows, "James Hart").stage, "LOST");
  assert.equal(byName(rows, "James Hart").areas, "Lansdowne Road, Bournemouth", "the project location stands in for areas");
  assert.equal(byName(rows, "Priya Shah").stage, "UNCONTACTED");
  assert.equal(byName(rows, "Kim Ward").receivedAt.toISOString(), KIM_AT.toISOString(), "the old Quote enquiry form is found");
  assert.equal(byName(rows, "Kim Ward").stage, "LOST");
  assert.deepEqual(byName(rows, "Owen Hale").skip, { kind: "unreadable", reason: "Could not read: An email address or phone number is required" });
  assert.equal(
    summaryLine(rows),
    "Summary: 5 notifications found. 4 to import (1 Uncontacted, 1 Awaiting Response, 2 Lost). 1 skipped (0 duplicates, 1 unreadable, 0 already imported, 0 excluded)."
  );
  const table = previewTable(rows);
  assert.match(table[0], /^Date \(UK\)\s+Name\s+Email\s+Phone\s+Areas\s+Stage\s+Skip reason$/);
  assert.match(table[2], /^2026-07-29  Kim Ward /);
});

test("backfill: an enquiry matching an existing lead of either business is skipped, unless duplicates are included", async () => {
  const threads = [
    thread("t1", [notification("sarah", daysAgo(10), SARAH)]),
    thread("t2", [notification("james", daysAgo(9), JAMES)]),
    thread("t3", [notification("priya", daysAgo(8), PRIYA)]),
    // Priya again: a match with an earlier enquiry in the same import.
    thread("t4", [
      notification("priya-again", daysAgo(2), {
        subject: "Leaflet Distribution enquiry from Priya S",
        replyTo: "PRIYA.SHAH@example.net",
        html: notificationHtml("Leaflet Distribution", [["Name", "Priya S"], ["Email", mailto("PRIYA.SHAH@example.net")]]),
      }),
    ]),
  ];
  const contacts: Contact[] = [
    { id: "fdh-lead", name: "Sarah M (FDH)", email: "Sarah@Example.com", phone: null },
    { id: "ldb-lead", name: "James H (LDB)", email: null, phone: "+44 1202 555000" },
  ];
  const { rows } = await plan(threads, { contacts });
  assert.deepEqual(byName(rows, "Sarah Mitchell").skip, { kind: "duplicate", reason: "Matches Sarah M (FDH) (fdh-lead)" });
  assert.deepEqual(byName(rows, "James Hart").skip, { kind: "duplicate", reason: "Matches James H (LDB) (ldb-lead)" }, "phone in another format");
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
  const threads = [thread("t1", [notification("old", daysAgo(100), SARAH)]), thread("t2", [notification("new", daysAgo(5), PRIYA)])];
  const since = await plan(threads, { options: { since: daysAgo(10).toISOString().slice(0, 10) } });
  assert.deepEqual(since.rows.map((r) => r.messageId), ["new"]);
  assert.match(since.reader.queries[0], / after:\d{4}\/\d{2}\/\d{2}$/);
  const forced = await plan(threads, { options: { stage: "UNCONTACTED" } });
  assert.deepEqual(forced.rows.map((r) => [r.suggestedStage, r.stage]), [["LOST", "UNCONTACTED"], ["UNCONTACTED", "UNCONTACTED"]]);
  const again = await plan(threads, { imported: ["old"] });
  assert.deepEqual(again.rows.find((r) => r.messageId === "old")!.skip, { kind: "imported", reason: "Already imported" });
  assert.equal(gmailQuery({ from: SENDER, since: "2026-03-01" }), `from:${SENDER} subject:"enquiry from" after:2026/02/28`);
});

// --- Writing -------------------------------------------------------------------------

type Created = {
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  stage: string;
  activities: { create: { type: string; detail: string; createdAt: Date } };
};

function fakeApplyDb(existing: Contact[] = []) {
  const created: Created[] = [];
  const notes: { detail: string }[] = [];
  const db: ApplyDb & { created: Created[] } = {
    created,
    lead: {
      async findMany() {
        return [
          ...existing.map((c) => ({ id: c.id!, name: c.name, email: c.email, phone: c.phone })),
          ...created.map((c, i) => ({ id: `new-${i + 1}`, name: c.name, email: c.email, phone: c.phone })),
        ];
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
  const { rows } = await plan([thread("t1", [notification("kim-msg", KIM_AT, KIM)])]);
  const data = leadDataFor(rows[0], []);
  assert.equal(data.createdAt?.toISOString(), KIM_AT.toISOString());
  assert.equal(data.activities.create.createdAt?.toISOString(), KIM_AT.toISOString());
  assert.equal(data.business, "LDB");
  assert.equal(data.source, "WEBSITE_QUOTE_FORM");
  assert.equal(data.stage, "LOST");
  assert.equal(data.lostReason, "OTHER");
  assert.equal(data.lostReasonNote, LOST_NOTE);
  assert.equal(data.targetAreas, "Christchurch");
  const note = importNote(rows[0].enquiry!, [], "kim-msg");
  assert.equal(note, `${enquiryNote(rows[0].enquiry!, [])}\nImported from Gmail\nGmail message ID: kim-msg`);
  assert.match(note, /^Service type: leaflet-distribution\nFrom the Leaflet Distribution Bournemouth website\n/);
  assert.equal(data.activities.create.detail, note);
  assert.equal(isPersonLoggedContact({ type: "NOTE", detail: note, userId: null }), false, "never counts as contact");
  assert.equal("userId" in data.activities.create, false);
});

test("backfill: --apply twice creates nothing the second time", async () => {
  const threads = [thread("t1", [notification("a", daysAgo(45), SARAH)]), thread("t2", [notification("b", daysAgo(3), PRIYA)])];
  const db = fakeApplyDb();
  const first = await plan(threads);
  assert.deepEqual(await applyBackfill(db, first.rows), { created: 2, alreadyImported: 0 });
  // The same rows again (a second --apply from the same preview) are checked inside each transaction.
  assert.deepEqual(await applyBackfill(db, first.rows), { created: 0, alreadyImported: 2 });
  assert.equal(db.created.length, 2);
  // A fresh run reads the notes and skips both before writing anything.
  const notes = await db.activity.findMany({ where: { detail: { contains: "Gmail message ID: " } }, select: { detail: true } });
  const imported = notes.flatMap((n) => n.detail.match(/^Gmail message ID: (\S+)$/m)?.[1] ?? []);
  const second = await plan(threads, { imported });
  assert.deepEqual(second.rows.map((r) => r.skip?.kind), ["imported", "imported"]);
  assert.deepEqual(await applyBackfill(db, second.rows), { created: 0, alreadyImported: 0 });
  assert.equal(db.created.length, 2);
});

// --- The command line ------------------------------------------------------------------

test("backfill: --from defaults to the Bournemouth address, --subject is gone, and options are checked", () => {
  assert.equal(DEFAULT_FROM, "team@leafletdistributionbournemouth.co.uk");
  assert.deepEqual(parseBackfillArgs([]), { ok: true, options: OPTIONS }, "a preview by default");
  const all = parseBackfillArgs(["--from=Other@Example.com", "--since=2026-01-31", "--stage=LOST", "--include-duplicates", "--apply"]);
  assert.deepEqual(all, { ok: true, options: { from: "other@example.com", since: "2026-01-31", stage: "LOST", includeDuplicates: true, apply: true } });
  assert.deepEqual(parseBackfillArgs(["--subject=Quote enquiry from"]), {
    ok: false,
    error: "--subject is no longer needed: the notification subjects are built in",
  });
  for (const argv of [["--from=not-an-address"], ["--stage=WON"], ["--since=2026-02-30"], ["--aply"], ["--apply=yes"], ["--ldb-address=x@example.com"], ["extra"]]) {
    assert.equal(parseBackfillArgs(argv).ok, false, argv.join(" "));
  }
});

test("backfill: an imported lead never starts as Won or Completed, which need a won date and stage history", () => {
  assert.deepEqual([...BACKFILL_STAGES], ["UNCONTACTED", "AWAITING_RESPONSE", "LOST"]);
  assert.equal(parseBackfillArgs(["--stage=COMPLETED"]).ok, false);
});

test("backfill: the script never prints its settings", () => {
  const source = readFileSync("scripts/backfill-ldb-enquiries.ts", "utf8");
  assert.doesNotMatch(source, /console\.\w+\([^)]*process\.env/);
  assert.match(source, /config\(\{ path: \[".env.local", ".env"\], quiet: true \}\)/, "loads settings like the wonAt backfill");
});
