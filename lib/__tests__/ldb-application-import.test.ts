import { test } from "node:test";
import assert from "node:assert/strict";
import type { gmail_v1 } from "@googleapis/gmail";
import type { GmailMessageReader } from "@/lib/gmail";
import {
  candidateFromMessage,
  candidatesFromThread,
  findApplicationEmails,
  flagDuplicates,
  loadSelectedApplicationEmails,
  saveImportedApplications,
  type SaveImportDb,
} from "@/lib/application-import";
import {
  isLdbApplicationNotification,
  isLdbApplicationSubject,
  ldbApplicationSearchQuery,
  readLdbApplication,
} from "@/lib/ldb-application-import";
import { validateLdbApplication } from "@/lib/ldb-application-intake";
import { DISTRIBUTOR_APPLICATION_SUBJECT } from "@/lib/distributor-application-form";
import { FDH, OURS, RULES, SENDER, crmCopy, mailto, msg, thread } from "./ldb-backfill-fixtures";

// Past Bournemouth website distributor applications, imported from the shared
// Gmail. The notifications are built exactly in the LDB website's layout: sent
// by Brevo from "Leaflet Distribution Bournemouth" <team@...> to the Hampshire
// Gmail, Reply-To the applicant, subject "Distributor application from <full
// name>", an h2 "New Distributor Application" then a two-column table. The
// applicants are made up.

type Row = [label: string, valueHtml: string];

function applicationHtml(rows: Row[]): string {
  return [
    "<h2>New Distributor Application</h2>",
    '<table cellpadding="6" style="border-collapse:collapse">',
    ...rows.map(([label, value]) => `  <tr><td><strong>${label}</strong></td><td>${value}</td></tr>`),
    "</table>",
  ].join("\n");
}

// As Gmail holds it: the sender is a send-as address of the Gmail, so it is
// labelled SENT as well as INBOX.
function ldbApplication(
  id: string,
  at: Date,
  o: { name: string; rows: Row[]; replyTo?: string | null; labels?: string[] }
): gmail_v1.Schema$Message {
  return msg(id, {
    from: `"Leaflet Distribution Bournemouth" <${SENDER}>`,
    subject: `Distributor application from ${o.name}`,
    at,
    html: applicationHtml(o.rows),
    labels: o.labels ?? ["SENT", "INBOX"],
    ...(o.replyTo === null ? {} : { replyTo: o.replyTo ?? `"${o.name}" <${o.name.split(" ")[0].toLowerCase()}@example.com>` }),
  });
}

const SARAH_AT = new Date("2026-10-02T08:15:00.000Z");
const SARAH_ROWS: Row[] = [
  ["Name", "Sarah Jones"],
  ["Email", mailto("sarah@example.com")],
  ["Phone", "07700900123"],
  ["Postcode", "BH8 9AB"],
  ["Access to a car", "Yes"],
  ["Areas they could cover", "Bournemouth, Poole, Christchurch"],
  ["About themselves", "Retired, free most weekdays."],
];
const sarah = (id = "ldb-1", labels?: string[]) => ldbApplication(id, SARAH_AT, { name: "Sarah Jones", rows: SARAH_ROWS, labels });

// Without About themselves, and no areas chosen.
const TOM_AT = new Date("2026-10-05T17:40:00.000Z");
const tom = (id = "ldb-2") =>
  ldbApplication(id, TOM_AT, {
    name: "Tom Reed",
    rows: [
      ["Name", "Tom Reed"],
      ["Email", mailto("tom.reed@example.net")],
      ["Phone", "01202 555 019"],
      ["Postcode", "bh1 1aa"],
      ["Access to a car", "No"],
      ["Areas they could cover", "None selected"],
    ],
    replyTo: '"Tom Reed" <tom.reed@example.net>',
  });

const CONTEXT = {
  senderAddress: FDH,
  excluded: ["other-business.example"],
  own: OURS,
  ldbAddress: SENDER,
  subject: DISTRIBUTOR_APPLICATION_SUBJECT,
};

// A Gmail reader that answers each search with its own results, like Gmail.
function reader(byQuery: Record<string, gmail_v1.Schema$Thread[]>) {
  const queries: string[] = [];
  const fetched: string[] = [];
  const all = Object.values(byQuery).flat();
  const r: GmailMessageReader = {
    async listMessageIds(q) {
      queries.push(q);
      const threads = byQuery[q] ?? [];
      return {
        messages: threads.flatMap((t) => (t.messages ?? []).map((m) => ({ id: m.id as string, threadId: t.id as string }))),
        nextPageToken: null,
      };
    },
    async getThread(id) {
      fetched.push(id);
      return all.find((t) => t.id === id) ?? null;
    },
  };
  return { reader: r, queries, fetched };
}

const FDH_QUERY = `subject:"${DISTRIBUTOR_APPLICATION_SUBJECT}"`;
const LDB_QUERY = ldbApplicationSearchQuery(SENDER);
const none = async () => new Set<string>();

// An FDH Work With Us notification, as the existing import reads it.
function fdhApplication(id: string, at: Date, name: string, phone: string): gmail_v1.Schema$Message {
  return msg(id, {
    from: "Notifications <notify@web3forms.com>",
    subject: DISTRIBUTOR_APPLICATION_SUBJECT,
    at,
    replyTo: `${name} <${name.split(" ")[0].toLowerCase()}@example.org>`,
    text: [
      `Name: ${name}`,
      `Phone: ${phone}`,
      "Where do you live?: Ringwood",
      "Age: 34",
      "Access to a car?: Yes",
      "Full UK licence?: No",
      "Availability: Weekends",
    ].join("\n"),
  });
}

// --- Reading the notification ----------------------------------------------------------

test("an LDB application notification is read exactly as the LDB intake would save the same application", () => {
  const read = readLdbApplication(sarah(), OURS);
  const intake = validateLdbApplication({
    fullName: "Sarah Jones",
    email: "sarah@example.com",
    phone: "07700900123",
    postcode: "bh8 9ab",
    hasCar: true,
    areas: ["Bournemouth", "Poole", "Christchurch"],
    about: "Retired, free most weekdays.",
  });
  assert.ok(intake.ok);
  assert.equal(read.readable, true);
  assert.deepEqual(read.fields, intake.fields);
  assert.deepEqual(read.fields, {
    fullName: "Sarah Jones",
    phone: "07700900123",
    email: "sarah@example.com",
    area: "BH8 9AB, areas: Bournemouth, Poole, Christchurch",
    age: null,
    hasCar: true,
    hasLicence: null,
    availability: "Retired, free most weekdays.",
  });
  assert.deepEqual(read.missing, [], "the LDB form never asks for an age, a licence or availability");
  assert.equal(read.problem, undefined);
});

test("without About themselves and with Areas None selected: no availability and no areas, the postcode alone", () => {
  const read = readLdbApplication(tom(), OURS);
  assert.equal(read.readable, true);
  assert.deepEqual(read.fields, {
    fullName: "Tom Reed",
    phone: "01202 555 019",
    email: "tom.reed@example.net",
    area: "BH1 1AA",
    age: null,
    hasCar: false,
    hasLicence: null,
    availability: null,
  });
  assert.deepEqual(read.missing, []);
});

test("None selected and no postcode leaves where they live unread; no Email row falls back to the applicant's Reply-To", () => {
  const m = ldbApplication("ldb-3", SARAH_AT, {
    name: "Ann Lee",
    rows: [
      ["Name", "Ann Lee"],
      ["Phone", "07700 900 456"],
      ["Access to a car", "Yes"],
      ["Areas they could cover", "None selected"],
    ],
    replyTo: '"Ann Lee" <ann.lee@example.com>',
  });
  const read = readLdbApplication(m, OURS);
  assert.equal(read.readable, true);
  assert.equal(read.fields.area, null);
  assert.equal(read.fields.email, "ann.lee@example.com");
  assert.deepEqual(read.missing, ["area"]);
});

test("a notification the LDB intake would refuse can't be imported, and says why", () => {
  const noPhone = ldbApplication("ldb-4", SARAH_AT, {
    name: "Max Cole",
    rows: [
      ["Name", "Max Cole"],
      ["Email", mailto("max@example.com")],
      ["Postcode", "BH2 5AA"],
      ["Access to a car", "No"],
      ["Areas they could cover", "Poole"],
    ],
  });
  const read = readLdbApplication(noPhone, OURS);
  assert.equal(read.readable, false);
  assert.equal(read.fields.fullName, "Max Cole");
  assert.equal(read.problem, "No phone number could be read from this email");

  const badPhone = ldbApplication("ldb-5", SARAH_AT, {
    name: "Max Cole",
    rows: [
      ["Name", "Max Cole"],
      ["Phone", "call me"],
    ],
  });
  assert.equal(readLdbApplication(badPhone, OURS).problem, "The phone number in this email isn't valid");
});

// --- Telling a notification apart ------------------------------------------------------

test("an LDB notification counts with SENT as well as INBOX, or INBOX alone", () => {
  assert.equal(isLdbApplicationNotification(sarah("a", ["SENT", "INBOX"]), RULES), true);
  assert.equal(isLdbApplicationNotification(sarah("b", ["INBOX"]), RULES), true);
  assert.equal(isLdbApplicationNotification(sarah("c", ["DRAFT"]), RULES), false, "never a draft");
});

test("only the exact subject with a name after it: not a reply, forward, an enquiry or the bare prefix", () => {
  assert.equal(isLdbApplicationSubject("Distributor application from Sarah Jones"), true);
  assert.equal(isLdbApplicationSubject("  distributor  application from   Sarah "), true);
  assert.equal(isLdbApplicationSubject("Re: Distributor application from Sarah Jones"), false);
  assert.equal(isLdbApplicationSubject("Fwd: Distributor application from Sarah Jones"), false);
  assert.equal(isLdbApplicationSubject("Distributor application from "), false);
  assert.equal(isLdbApplicationSubject("Leaflet Distribution enquiry from Sarah Jones"), false);
  assert.equal(isLdbApplicationSubject(null), false);
});

test("the CRM's own sent copies stay out, even with the notification's exact subject", () => {
  const subject = "Distributor application from Sarah Jones";
  // Its email to the applicant, as its copy arrives here: to them, Reply-To
  // the LDB address, labelled SENT and INBOX.
  assert.equal(isLdbApplicationNotification(crmCopy("c1", SARAH_AT, "sarah@example.com", subject), RULES), false);
  // Copied to the Hampshire Gmail, but still Reply-To one of ours.
  const toUs = msg("c2", {
    from: `"Leaflet Distribution Bournemouth" <${SENDER}>`,
    to: FDH,
    replyTo: SENDER,
    subject,
    at: SARAH_AT,
    labels: ["SENT", "INBOX"],
    html: applicationHtml(SARAH_ROWS),
  });
  assert.equal(isLdbApplicationNotification(toUs, RULES), false);
  // From someone else, with the same layout.
  const spoof = msg("c3", { from: "someone@example.com", subject, at: SARAH_AT, replyTo: "sarah@example.com", html: applicationHtml(SARAH_ROWS) });
  assert.equal(isLdbApplicationNotification(spoof, RULES), false);
});

// --- The import ------------------------------------------------------------------------

test("the import also searches for LDB notifications, and saves them as LDB with the email's date", async () => {
  const ldbThread = thread("t-ldb", [sarah("ldb-1"), crmCopy("ldb-1r", new Date("2026-10-02T10:00:00.000Z"), "sarah@example.com", "Re: Distributor application from Sarah Jones")]);
  const { reader: r, queries } = reader({ [LDB_QUERY]: [ldbThread, thread("t-tom", [tom("ldb-2")])] });
  const result = await findApplicationEmails(r, CONTEXT, { alreadyImported: none });
  assert.deepEqual(queries, [FDH_QUERY, `from:${SENDER} subject:"Distributor application from"`]);
  assert.deepEqual(
    result.candidates.map((c) => [c.messageId, c.business, c.parsed.fields.fullName, c.receivedAt]),
    [
      ["ldb-2", "LDB", "Tom Reed", TOM_AT.toISOString()],
      ["ldb-1", "LDB", "Sarah Jones", SARAH_AT.toISOString()],
    ],
    "the CRM's reply in the same thread stays out; newest first"
  );

  let saved: Parameters<SaveImportDb["distributorApplication"]["createMany"]>[0]["data"] = [];
  const db: SaveImportDb = {
    distributorApplication: {
      async createMany(args) {
        saved = args.data;
        return { count: args.data.length };
      },
    },
  };
  assert.equal(await saveImportedApplications(db, result.candidates, new Map()), 2);
  assert.deepEqual(saved[1], {
    fullName: "Sarah Jones",
    phone: "07700900123",
    email: "sarah@example.com",
    area: "BH8 9AB, areas: Bournemouth, Poole, Christchurch",
    age: null,
    hasCar: true,
    hasLicence: null,
    availability: "Retired, free most weekdays.",
    source: "GMAIL_IMPORT",
    business: "LDB",
    gmailMessageId: "ldb-1",
    receivedAt: SARAH_AT,
    notes: null,
  });
  assert.equal(saved[0].business, "LDB");
});

test("LDB notifications already imported are skipped by Gmail message ID before they are fetched", async () => {
  const { reader: r, fetched } = reader({ [LDB_QUERY]: [thread("t-ldb", [sarah("ldb-1")]), thread("t-tom", [tom("ldb-2")])] });
  const result = await findApplicationEmails(r, CONTEXT, { alreadyImported: async () => new Set(["ldb-1"]) });
  assert.equal(result.alreadyImported, 1);
  assert.deepEqual(result.candidates.map((c) => c.messageId), ["ldb-2"]);
  assert.deepEqual(fetched, ["t-tom"]);
});

test("an LDB application with the same phone as an FDH one is flagged as a likely duplicate, so it starts unticked", async () => {
  const fdh = candidateFromMessage(fdhApplication("f1", new Date("2026-10-01T09:00:00.000Z"), "Sarah Jones", "07700 900 123"), FDH);
  const [ldb] = candidatesFromThread(thread("t-ldb", [sarah("ldb-1")]), new Set(["ldb-1"]), CONTEXT);
  const inBatch = flagDuplicates([fdh, ldb], []);
  assert.deepEqual(inBatch.get("ldb-1"), { kind: "batch", name: "Sarah Jones" });
  const existing = flagDuplicates([ldb], [{ fullName: "Sarah Jones", phone: "+44 7700 900123", receivedAt: new Date("2026-09-01T00:00:00.000Z") }]);
  assert.deepEqual(existing.get("ldb-1"), { kind: "existing", name: "Sarah Jones", receivedAt: "2026-09-01T00:00:00.000Z" });
});

test("an LDB notification thread that touches a hidden address is left out, like any other", () => {
  const forwarded = thread("t-x", [
    sarah("ldb-1"),
    msg("fw", { from: FDH, to: "office@other-business.example", subject: "Fwd: Distributor application from Sarah Jones", at: TOM_AT, text: "FYI" }),
  ]);
  assert.deepEqual(candidatesFromThread(forwarded, new Set(["ldb-1"]), CONTEXT), []);
});

test("confirm reads the chosen LDB emails again and never takes one that can't be read", async () => {
  const unreadable = ldbApplication("ldb-9", TOM_AT, { name: "No Phone", rows: [["Name", "No Phone"]] });
  const { reader: r } = reader({ [LDB_QUERY]: [thread("t-ldb", [sarah("ldb-1")]), thread("t-9", [unreadable])] });
  const chosen = await loadSelectedApplicationEmails(
    r,
    CONTEXT,
    [
      { messageId: "ldb-1", threadId: "t-ldb" },
      { messageId: "ldb-9", threadId: "t-9" },
    ],
    none
  );
  assert.deepEqual(chosen.map((c) => [c.messageId, c.business]), [["ldb-1", "LDB"]]);
});

test("FDH imports are unchanged: the same FDH candidates with or without the LDB address, and saved as FDH", async () => {
  const fdhThreads = [
    thread("t-f1", [fdhApplication("f1", new Date("2026-09-20T09:00:00.000Z"), "Dee Hart", "07700 900 301")]),
    thread("t-f2", [fdhApplication("f2", new Date("2026-09-21T09:00:00.000Z"), "Ray Cole", "07700 900 302")]),
  ];
  const withLdb = reader({ [FDH_QUERY]: fdhThreads, [LDB_QUERY]: [thread("t-ldb", [sarah("ldb-1")])] });
  const both = await findApplicationEmails(withLdb.reader, CONTEXT, { alreadyImported: none });
  const fdhOnly = reader({ [FDH_QUERY]: fdhThreads });
  const before = await findApplicationEmails(fdhOnly.reader, { ...CONTEXT, ldbAddress: null }, { alreadyImported: none });
  assert.deepEqual(fdhOnly.queries, [FDH_QUERY], "no LDB search without the LDB address");

  const fdhFound = both.candidates.filter((c) => c.business === "FDH");
  assert.deepEqual(fdhFound, before.candidates);
  assert.deepEqual(
    fdhFound.map((c) => [c.messageId, c.parsed.fields.fullName, c.parsed.fields.area, c.parsed.fields.hasLicence, c.parsed.missing]),
    [
      ["f2", "Ray Cole", "Ringwood", false, []],
      ["f1", "Dee Hart", "Ringwood", false, []],
    ]
  );
  assert.deepEqual(both.candidates.map((c) => c.business), ["LDB", "FDH", "FDH"]);

  let saved: { business: string; gmailMessageId: string }[] = [];
  await saveImportedApplications(
    {
      distributorApplication: {
        async createMany(args) {
          saved = args.data;
          return { count: args.data.length };
        },
      },
    },
    both.candidates,
    new Map()
  );
  assert.deepEqual(saved.map((s) => [s.gmailMessageId, s.business]), [
    ["ldb-1", "LDB"],
    ["f2", "FDH"],
    ["f1", "FDH"],
  ]);
});

test("an FDH-subject email in Bournemouth mail is still never an FDH application", () => {
  const m = fdhApplication("f9", SARAH_AT, "Mixed Up", "07700 900 309");
  const ldbMixed = thread("t-mixed", [{ ...m, payload: { ...m.payload, headers: [...(m.payload?.headers ?? []), { name: "Cc", value: SENDER }] } }]);
  assert.deepEqual(candidatesFromThread(ldbMixed, new Set(["f9"]), CONTEXT), []);
});

test("with more than the scan limit, both websites' notifications get a turn and the preview says it was cut short", async () => {
  const fdhThreads = ["1", "2", "3"].map((n) => thread(`t-f${n}`, [fdhApplication(`f${n}`, new Date(`2026-09-2${n}T09:00:00.000Z`), `F Person${n}`, `07700 900 31${n}`)]));
  const ldbThreads = ["1", "2", "3"].map((n) => thread(`t-l${n}`, [sarah(`l${n}`)]));
  const { reader: r } = reader({ [FDH_QUERY]: fdhThreads, [LDB_QUERY]: ldbThreads });
  const result = await findApplicationEmails(r, CONTEXT, { alreadyImported: none, max: 4 });
  assert.equal(result.truncated, true);
  assert.deepEqual(result.candidates.map((c) => c.messageId).sort(), ["f1", "f2", "l1", "l2"]);
});
