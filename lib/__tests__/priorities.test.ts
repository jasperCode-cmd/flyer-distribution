import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { gmail_v1 } from "@googleapis/gmail";
import { isPersonLoggedContact, isSystemNote } from "@/lib/activity-origin";
import { formatPence } from "@/lib/money";
import { formatWonDate, monthLabel } from "@/lib/profit";
import {
  automaticItems,
  awaitingItem,
  buildPriorities,
  canMarkLost,
  filterRows,
  groupRows,
  primaryAction,
  planPriorityAction,
  removeItem,
  taskItems,
  urgentHighCount,
  waitingLabel,
  type DismissalFacts,
  type EmailFacts,
  type LeadFacts,
  type PriorityInputs,
  type PriorityItem,
  type TaskFacts,
} from "@/lib/priorities";
import { unansweredLeadEmails } from "@/lib/priorities-email";
import type { InboxLeadCandidate } from "@/lib/inbox-leads";

// 11:00 in the UK (BST) on Sunday 11 October 2026.
const NOW = new Date("2026-10-11T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function lead(o: Partial<LeadFacts> = {}): LeadFacts {
  return {
    id: "L1",
    name: "Alice Smith",
    businessName: null,
    email: "alice@example.com",
    phone: "07700 900123",
    stage: "UNCONTACTED",
    source: "WEBSITE_QUOTE_FORM",
    paymentStatus: "NOT_PAID",
    reviewStatus: "NOT_REQUESTED",
    createdAt: "2026-10-01T09:00:00.000Z",
    scrapped: false,
    activities: [],
    job: null,
    ...o,
  };
}

function job(o: Partial<NonNullable<LeadFacts["job"]>> = {}): NonNullable<LeadFacts["job"]> {
  return {
    campaignStartDate: null,
    completionDate: null,
    distributorId: null,
    distributorName: null,
    hasDistributorCost: false,
    ...o,
  };
}

function inputs(o: Partial<PriorityInputs> = {}): PriorityInputs {
  return { now: NOW, leads: [], applications: [], tasks: [], emails: [], dismissals: [], ...o };
}

function task(o: Partial<TaskFacts> = {}): TaskFacts {
  return { id: "T1", description: "Chase the printer", dueDate: "2026-10-11T12:00:00.000Z", priority: "NORMAL", lead: null, ...o };
}

function email(o: Partial<EmailFacts> = {}): EmailFacts {
  return {
    lead: { id: "L1", name: "Alice Smith", businessName: null, email: "alice@example.com", phone: null, stage: "AWAITING_RESPONSE" },
    threadId: "thread-1",
    messageId: "msg-1",
    receivedAt: "2026-10-10T08:00:00.000Z",
    subject: "Re: Your quote",
    messageIdHeader: "<msg-1@mail.example>",
    ...o,
  };
}

const keysOf = (i: PriorityInputs) => automaticItems(i).map((x) => x.key).sort();
const find = (i: PriorityInputs, key: string) => [...automaticItems(i), ...taskItems(i)].find((x) => x.key === key);
const visibleKeys = (i: PriorityInputs) => buildPriorities(i).flatMap((r) => [r.primary, ...r.others]).map((x) => x.key);

// A Done or Snooze, as the actions route would save it.
function saved(entry: PriorityItem, action: "done" | "snooze" | "still_in_talks", days: number | undefined, at: Date): DismissalFacts {
  const plan = planPriorityAction(entry, action, days, at);
  if ("error" in plan || plan.kind !== "dismiss") throw new Error("expected a dismissal");
  return {
    itemKey: plan.itemKey,
    fingerprint: plan.fingerprint,
    dismissed: plan.dismissed,
    snoozedUntil: plan.snoozedUntil?.toISOString() ?? null,
  };
}

const stageChange = (to: string, at: string, from = "Won") => ({
  type: "STAGE_CHANGE",
  detail: `Stage changed from ${from} to ${to}`,
  createdAt: at,
  userId: "u1",
});

// --- Rule 1: new website enquiry ------------------------------------------------

test("rule 1: a website enquiry in Uncontacted is Urgent, and clears once the lead moves on", () => {
  const i = inputs({ leads: [lead()] });
  const entry = find(i, "new_enquiry:L1");
  assert.equal(entry?.level, "URGENT");
  assert.equal(entry?.since, "2026-10-01T09:00:00.000Z");

  assert.deepEqual(keysOf(inputs({ leads: [lead({ stage: "AWAITING_RESPONSE" })] })), ["awaiting:L1"]);
  assert.deepEqual(keysOf(inputs({ leads: [lead({ source: "COLD_OUTREACH" })] })), []);
  assert.deepEqual(keysOf(inputs({ leads: [lead({ scrapped: true })] })), []);
});

// --- Rule 2: unanswered email -----------------------------------------------------

test("rule 2: an unanswered email from a lead is High, and clears once the scan no longer finds it", () => {
  const entry = find(inputs({ emails: [email()] }), "email:thread-1");
  assert.equal(entry?.level, "HIGH");
  assert.equal(entry?.type, "unanswered_email");
  assert.equal(entry?.detail, "Re: Your quote");
  assert.equal(entry?.fingerprint, "msg-1");
  // Email on it replies in that conversation.
  assert.deepEqual(entry?.reply, { subject: "Re: Your quote", threadId: "thread-1", lastMessageId: "<msg-1@mail.example>" });
  assert.equal(find(inputs({ emails: [] }), "email:thread-1"), undefined);
});

const US = "flyerdistributionhampshire@gmail.com";

function msg(id: string, headers: Record<string, string>, at: number, labelIds = ["INBOX"]): gmail_v1.Schema$Message {
  return {
    id,
    labelIds,
    internalDate: String(at),
    payload: { headers: Object.entries(headers).map(([name, value]) => ({ name, value })) },
  };
}

function candidate(o: Partial<InboxLeadCandidate>): InboxLeadCandidate {
  return { id: "L1", name: "Alice Smith", stage: "AWAITING_RESPONSE", email: "alice@example.com", scrapped: false, createdAt: new Date(0), ...o };
}

test("rule 2: the Gmail scan keeps only unanswered threads from leads, honouring the exclusion list", async () => {
  const t0 = Date.parse("2026-10-09T09:00:00Z");
  const threads: (gmail_v1.Schema$Thread | null)[] = [
    // From a lead, nothing after it: included.
    { id: "t-open", messages: [msg("a1", { From: "Alice <alice@example.com>", Subject: "Leaflets" }, t0)] },
    // We replied after the lead: answered.
    {
      id: "t-answered",
      messages: [
        msg("b1", { From: "alice@example.com", Subject: "Quote" }, t0),
        msg("b2", { From: `FDH <${US}>`, To: "alice@example.com" }, t0 + 1000, ["SENT"]),
      ],
    },
    // The latest is labelled as sent by us (another alias): answered.
    { id: "t-sent", messages: [msg("c1", { From: "Alice <alice@example.com>" }, t0, ["SENT"])] },
    // Copies an excluded address: skipped, like everywhere else.
    { id: "t-excluded", messages: [msg("d1", { From: "alice@example.com", Cc: "accounts@internal.example" }, t0)] },
    // Not a lead.
    { id: "t-stranger", messages: [msg("e1", { From: "someone@else.example" }, t0)] },
    // A form notification whose Reply-To is the lead.
    { id: "t-form", messages: [msg("f1", { From: "forms@formservice.example", "Reply-To": "Alice@Example.com", Subject: "New quote", "Message-ID": "<f1@formservice.example>" }, t0 + 5000)] },
    // A scrapped lead.
    { id: "t-scrapped", messages: [msg("g1", { From: "bob@example.com" }, t0)] },
    null,
  ];
  const db = {
    lead: {
      findMany: async () => [candidate({}), candidate({ id: "L2", name: "Bob", email: "bob@example.com", scrapped: true })],
    },
  };
  const emails = await unansweredLeadEmails(threads, { senderAddress: US, excluded: ["accounts@internal.example"] }, db);
  assert.deepEqual(
    emails.map((e) => e.threadId),
    ["t-open", "t-form"]
  );
  assert.equal(emails[0].lead.id, "L1");
  assert.equal(emails[0].subject, "Leaflets");
  assert.equal(emails[1].messageId, "f1");
  assert.equal(emails[1].messageIdHeader, "<f1@formservice.example>");

  // With no exclusion list the excluded thread would have counted.
  const all = await unansweredLeadEmails(threads, { senderAddress: US, excluded: [] }, db);
  assert.ok(all.some((e) => e.threadId === "t-excluded"));
});

// --- Rule 3: awaiting response ----------------------------------------------------

test("rule 3: Awaiting Response is High from when it entered the stage, and clears when it leaves", () => {
  const awaiting = lead({
    stage: "AWAITING_RESPONSE",
    activities: [stageChange("Warm / Awaiting Response", "2026-10-05T10:00:00.000Z", "Uncontacted")],
  });
  const entry = find(inputs({ leads: [awaiting] }), "awaiting:L1");
  assert.equal(entry?.level, "HIGH");
  assert.equal(entry?.since, "2026-10-05T10:00:00.000Z");
  assert.equal(entry?.fingerprint, "AWAITING_RESPONSE:2026-10-05T10:00:00.000Z");

  // The Dialer's "Marked Warm" counts as entering the stage too.
  const warm = lead({
    stage: "AWAITING_RESPONSE",
    activities: [{ type: "CALL", detail: "Dialer: Marked Warm", createdAt: "2026-10-07T10:00:00.000Z", userId: "u1" }],
  });
  assert.equal(find(inputs({ leads: [warm] }), "awaiting:L1")?.since, "2026-10-07T10:00:00.000Z");

  // An email that moved it ("... because an email was sent.") is read too.
  const emailed = lead({
    stage: "AWAITING_RESPONSE",
    activities: [
      { type: "STAGE_CHANGE", detail: "Stage changed from Uncontacted to Warm / Awaiting Response because an email was sent.", createdAt: "2026-10-08T10:00:00.000Z", userId: "u1" },
    ],
  });
  assert.equal(find(inputs({ leads: [emailed] }), "awaiting:L1")?.since, "2026-10-08T10:00:00.000Z");

  assert.equal(find(inputs({ leads: [lead({ stage: "WON", source: "COLD_OUTREACH" })] }), "awaiting:L1"), undefined);
});

// --- Rules 4 and 5: completed jobs --------------------------------------------------

test("rule 4: a Completed job not paid in full is High, and clears once paid in full", () => {
  const completed = lead({ stage: "COMPLETED", paymentStatus: "DEPOSIT_PAID", reviewStatus: "RECEIVED", job: job({ completionDate: "2026-10-09T00:00:00.000Z" }) });
  const entry = find(inputs({ leads: [completed] }), "unpaid:L1");
  assert.equal(entry?.level, "HIGH");
  assert.equal(entry?.detail, "Deposit paid");
  assert.equal(find(inputs({ leads: [{ ...completed, paymentStatus: "PAID_IN_FULL" }] }), "unpaid:L1"), undefined);
  // Only Completed: a Won job that isn't paid yet isn't chased.
  assert.equal(find(inputs({ leads: [{ ...completed, stage: "WON" }] }), "unpaid:L1"), undefined);
});

test("rule 5: a Completed job with no review requested is High, and clears once requested", () => {
  const completed = lead({ stage: "COMPLETED", paymentStatus: "PAID_IN_FULL", reviewStatus: "NOT_REQUESTED" });
  assert.equal(find(inputs({ leads: [completed] }), "review:L1")?.level, "HIGH");
  assert.equal(find(inputs({ leads: [{ ...completed, reviewStatus: "REQUESTED" }] }), "review:L1"), undefined);
  assert.equal(find(inputs({ leads: [{ ...completed, reviewStatus: "RECEIVED" }] }), "review:L1"), undefined);
});

// --- Rule 6: campaign with no distributor -----------------------------------------------

test("rule 6: a campaign starting within 7 days with no distributor is Normal, and clears once one is assigned", () => {
  const won = (j: Partial<NonNullable<LeadFacts["job"]>>) =>
    inputs({ leads: [lead({ stage: "WON", job: job({ campaignStartDate: "2026-10-14T00:00:00.000Z", ...j }) })] });

  const entry = find(won({}), "campaign:L1");
  assert.equal(entry?.level, "NORMAL");
  assert.equal(waitingLabel(entry!, NOW), "Starts in 3 days");

  assert.equal(find(won({ distributorId: "D1" }), "campaign:L1"), undefined);
  assert.equal(find(won({ distributorName: "Sam" }), "campaign:L1"), undefined);
  assert.equal(find(won({ hasDistributorCost: true }), "campaign:L1"), undefined);
  // Today and 7 days out count; 8 days out and yesterday don't.
  assert.ok(find(won({ campaignStartDate: "2026-10-11T00:00:00.000Z" }), "campaign:L1"));
  assert.ok(find(won({ campaignStartDate: "2026-10-18T00:00:00.000Z" }), "campaign:L1"));
  assert.equal(find(won({ campaignStartDate: "2026-10-19T00:00:00.000Z" }), "campaign:L1"), undefined);
  assert.equal(find(won({ campaignStartDate: "2026-10-10T00:00:00.000Z" }), "campaign:L1"), undefined);
});

// --- Rule 7: applications ----------------------------------------------------------------

test("rule 7: a New distributor application is Low, and clears once it is dealt with", () => {
  const app = { id: "A1", fullName: "Dan Walker", email: "dan@example.com", phone: null, status: "NEW", receivedAt: "2026-10-09T08:00:00.000Z", updatedAt: "2026-10-09T08:00:00.000Z" };
  const entry = find(inputs({ applications: [app] }), "application:A1");
  assert.equal(entry?.level, "LOW");
  assert.equal(entry?.subject.kind, "application");
  assert.equal(find(inputs({ applications: [{ ...app, status: "APPROVED" }] }), "application:A1"), undefined);
});

// --- Rule 8: repeat work follow-up ----------------------------------------------------------

// Paid and reviewed, so the follow-up is the only thing it raises.
const completedLead = (o: Partial<LeadFacts> = {}) =>
  lead({
    stage: "COMPLETED",
    paymentStatus: "PAID_IN_FULL",
    reviewStatus: "RECEIVED",
    job: job({ completionDate: "2026-09-20T00:00:00.000Z" }),
    ...o,
  });

test("rule 8: the follow-up appears 21 days after completion and not before", () => {
  const appears = new Date("2026-10-11T00:00:00.000Z");
  assert.deepEqual(keysOf(inputs({ now: new Date(appears.getTime() - 60_000), leads: [completedLead()] })), []);
  assert.deepEqual(keysOf(inputs({ now: new Date(appears.getTime() - 1 * DAY), leads: [completedLead()] })), []);
  const entry = find(inputs({ now: appears, leads: [completedLead()] }), "repeat:L1");
  assert.equal(entry?.level, "LOW");
  assert.equal(entry?.title, "Follow up for more work");
  assert.equal(entry?.fingerprint, "COMPLETED:2026-09-20T00:00:00.000Z");
  assert.equal(waitingLabel(entry!, new Date(appears.getTime() + 2 * DAY)), "Completed 23 days ago");
});

test("rule 8: without a completion date it counts from the move to Completed, and needs one of the two", () => {
  const byStage = completedLead({ job: job(), activities: [stageChange("Completed", "2026-09-15T14:00:00.000Z")] });
  assert.equal(find(inputs({ now: new Date("2026-10-06T13:59:00.000Z"), leads: [byStage] }), "repeat:L1"), undefined);
  const entry = find(inputs({ now: new Date("2026-10-06T14:00:00.000Z"), leads: [byStage] }), "repeat:L1");
  assert.equal(entry?.fingerprint, "COMPLETED:2026-09-15T14:00:00.000Z");

  // The Job's own completion date wins over the stage change.
  const both = completedLead({ activities: [stageChange("Completed", "2026-09-15T14:00:00.000Z")] });
  assert.equal(find(inputs({ leads: [both] }), "repeat:L1")?.fingerprint, "COMPLETED:2026-09-20T00:00:00.000Z");

  assert.equal(find(inputs({ leads: [completedLead({ job: null })] }), "repeat:L1"), undefined);
});

test("rule 8 clears on Done, and stays cleared while the completion is the same", () => {
  const i = inputs({ leads: [completedLead()] });
  const entry = find(i, "repeat:L1")!;
  const dismissals = [saved(entry, "done", undefined, NOW)];
  assert.deepEqual(visibleKeys({ ...i, dismissals }), []);
  assert.deepEqual(visibleKeys({ ...i, now: new Date(NOW.getTime() + 60 * DAY), dismissals }), []);
});

// It appeared at midnight on 11 October; these are all logged after that.
const AFTER = "2026-10-11T09:00:00.000Z";
const activity = (type: string, detail: string, userId: string | null = "u1", createdAt = AFTER) => ({ type, detail, createdAt, userId });

test("rule 8 clears when someone logs a call, sends an email or writes a note after it appeared, but not before", () => {
  const byPerson = [
    activity("CALL", "Spoke about the spring drop"),
    activity("CALL", "Dialer: No Answer"),
    activity("EMAIL", "Email sent: Anything else we can help with?"),
    activity("NOTE", "Ruby wants a quote for the Christmas drop"),
    // A note that merely mentions a page is still a person's note.
    activity("NOTE", "Asked about the Profit page figures, will call back"),
  ];
  for (const a of byPerson) {
    assert.equal(isPersonLoggedContact(a), true, a.detail);
    assert.equal(find(inputs({ leads: [completedLead({ activities: [a] })] }), "repeat:L1"), undefined, `${a.type}: ${a.detail}`);
  }
  const earlier = completedLead({ activities: [activity("NOTE", "Thanks for the job", "u1", "2026-10-01T09:00:00.000Z")] });
  assert.ok(find(inputs({ leads: [earlier] }), "repeat:L1"), "a note before it appeared");
});

test("rule 8 doesn't clear for anything the CRM writes itself", () => {
  // The Still in talks note exactly as the Priorities page writes it.
  const awaiting = find(inputs({ leads: [lead({ stage: "AWAITING_RESPONSE" })] }), "awaiting:L1")!;
  const stillInTalks = planPriorityAction(awaiting, "still_in_talks", 5, NOW);
  assert.ok(!("error" in stillInTalks) && stillInTalks.kind === "dismiss" && stillInTalks.activity);

  // Each worded exactly as its route writes it.
  const bySystem = [
    activity("STAGE_CHANGE", "Stage changed from Won to Completed"),
    activity("NOTE", `Retainer set: ${formatPence(25000)} a month from ${monthLabel("2026-09")}, ongoing on the Profit page`),
    activity("NOTE", `Retainer set: ${formatPence(25000)} a month from ${monthLabel("2026-09")} to ${monthLabel("2027-02")} on the Profit page`),
    activity("NOTE", "Retainer turned off on the Profit page"),
    activity("NOTE", `Won date set to ${formatWonDate("2026-09-03T10:00:00.000Z")} (was ${formatWonDate("2026-09-01T10:00:00.000Z")}) on the Profit page`),
    activity("NOTE", stillInTalks.activity.detail),
    activity("NOTE", "Reassigned to Sam Turner (bulk action)"),
    activity("NOTE", "Unassigned (bulk action)"),
    activity("NOTE", "Source changed from Other to Referral (bulk action)"),
    activity("NOTE", "Duplicated from Ruby Lane"),
    activity("NOTE", "Imported note: Called twice in March"),
    activity("NOTE", "Service type: Leaflet Distribution\nMessage: Please quote for 5,000 leaflets.", null),
    // Any note with no one signed in behind it.
    activity("NOTE", "Something written automatically", null),
  ];
  for (const a of bySystem) {
    assert.equal(isPersonLoggedContact(a), false, a.detail);
    assert.ok(find(inputs({ leads: [completedLead({ activities: [a] })] }), "repeat:L1"), `${a.type}: ${a.detail}`);
  }
  assert.ok(find(inputs({ leads: [completedLead({ activities: bySystem })] }), "repeat:L1"), "all of them together");

  // A snooze writes nothing on the lead, and the follow-up is back after it.
  const entry = find(inputs({ leads: [completedLead()] }), "repeat:L1")!;
  const snooze = planPriorityAction(entry, "snooze", 3, NOW);
  assert.ok(!("error" in snooze) && snooze.kind === "dismiss" && snooze.activity === null);
  const dismissals = [saved(entry, "snooze", 3, NOW)];
  assert.deepEqual(visibleKeys(inputs({ now: new Date(NOW.getTime() + 3 * DAY + 60_000), leads: [completedLead()], dismissals })), ["repeat:L1"]);
});

// Every place that writes a note is either one a person types into or uses a
// wording the follow-up rule knows is the CRM's own. A new note-writing route
// fails here until it is added to one list or the other.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

test("every note the CRM writes for itself is worded so the follow-up rule ignores it", () => {
  const writers = [...sourceFiles("app"), ...sourceFiles("lib")].filter((file) =>
    /type: "NOTE"/.test(readFileSync(file, "utf8"))
  );
  const typedByPerson = ["app/api/crm/dialer/leads/[id]/outcome/route.ts"];
  const systemWording: Record<string, string> = {
    "app/api/crm/leads/bulk/route.ts": "(bulk action)",
    "app/api/crm/leads/[id]/duplicate/route.ts": "Duplicated from ",
    "app/api/crm/import/route.ts": "Imported note: ",
    "app/api/quote-lead/route.ts": "Service type: ",
    "app/api/crm/profit/jobs/[leadId]/route.ts": "on the Profit page",
    "app/api/crm/profit/jobs/[leadId]/retainer/route.ts": "on the Profit page",
    // Writes planPriorityAction's Still in talks note, checked above; used
    // by the single-row actions route and the bulk route.
    "lib/priority-actions.ts": "plan.activity.detail",
  };
  assert.deepEqual(writers.sort(), [...typedByPerson, ...Object.keys(systemWording)].sort());
  for (const [file, wording] of Object.entries(systemWording)) {
    assert.ok(readFileSync(file, "utf8").includes(wording), `${file} writes "${wording}"`);
  }
  // The Dialer's notes are what the caller typed in the call form.
  assert.match(readFileSync(typedByPerson[0], "utf8"), /body\.notes/);
  // The website form's note is written with no user, which on its own marks it.
  assert.doesNotMatch(readFileSync("app/api/quote-lead/route.ts", "utf8"), /userId/);
  // The only other notes come through the lead page, typed by a person.
  assert.match(readFileSync("components/crm/LeadDetail.tsx", "utf8"), /logActivity\("NOTE", newNote\.trim\(\)\)/);

  // Calls and emails always count, so only a person's actions may write them.
  const callOrEmail = [...sourceFiles("app"), ...sourceFiles("lib")].filter((file) =>
    /type: "(CALL|EMAIL)"/.test(readFileSync(file, "utf8"))
  );
  assert.deepEqual(callOrEmail.sort(), [
    "app/api/crm/dialer/leads/[id]/outcome/route.ts",
    // Reads only: counting today's calls.
    "lib/crm-data.ts",
    // Reads only: cold leads called in the last 7 days, for the Dashboard.
    "lib/dashboard-data.ts",
    // Records an email someone sent.
    "lib/send-lead-email.ts",
  ]);
  assert.equal(isSystemNote("Retainer turned off on the Profit page"), true);
});

test("rule 8 clears when the lead moves back to Won", () => {
  assert.equal(find(inputs({ leads: [completedLead({ stage: "WON" })] }), "repeat:L1"), undefined);
});

test("rule 8: a second completed job brings a new follow-up, even after Done on the first", () => {
  const firstEntry = find(inputs({ leads: [completedLead()] }), "repeat:L1")!;
  const dismissals = [saved(firstEntry, "done", undefined, NOW)];

  // The second job completes on 20 November; 21 days on is 11 December. The
  // call made after the first follow-up doesn't count against the second.
  const second = completedLead({
    job: job({ completionDate: "2026-11-20T00:00:00.000Z" }),
    activities: [{ type: "CALL", detail: "Chatted", createdAt: "2026-10-12T09:00:00.000Z", userId: "u1" }],
  });
  assert.deepEqual(visibleKeys(inputs({ now: new Date("2026-12-10T12:00:00.000Z"), leads: [second], dismissals })), []);
  const later = inputs({ now: new Date("2026-12-11T00:00:00.000Z"), leads: [second], dismissals });
  assert.deepEqual(visibleKeys(later), ["repeat:L1"]);
  assert.equal(find(later, "repeat:L1")?.fingerprint, "COMPLETED:2026-11-20T00:00:00.000Z");

  // The same by stage change alone: a later "to Completed" is a new completion.
  const byStage = completedLead({
    job: job(),
    activities: [stageChange("Completed", "2026-09-01T10:00:00.000Z"), stageChange("Completed", "2026-11-02T10:00:00.000Z")],
  });
  const old = { itemKey: "repeat:L1", fingerprint: "COMPLETED:2026-09-01T10:00:00.000Z", dismissed: true, snoozedUntil: null };
  assert.deepEqual(visibleKeys(inputs({ now: new Date("2026-11-23T10:00:00.000Z"), leads: [byStage], dismissals: [old] })), ["repeat:L1"]);
});

// --- Ranking and grouping -----------------------------------------------------------------

test("ranking: level first, then overdue tasks, then whatever has waited longest", () => {
  const rows = buildPriorities(
    inputs({
      leads: [
        lead({ id: "Lnew", name: "New", createdAt: "2026-10-11T08:00:00.000Z" }),
        lead({ id: "Lold", name: "Old", stage: "AWAITING_RESPONSE", activities: [stageChange("Warm / Awaiting Response", "2026-09-01T08:00:00.000Z", "Uncontacted")] }),
        lead({ id: "Lrecent", name: "Recent", stage: "AWAITING_RESPONSE", activities: [stageChange("Warm / Awaiting Response", "2026-10-09T08:00:00.000Z", "Uncontacted")] }),
      ],
      applications: [{ id: "A1", fullName: "Applicant", email: null, phone: null, status: "NEW", receivedAt: "2026-08-01T08:00:00.000Z", updatedAt: "2026-08-01T08:00:00.000Z" }],
      tasks: [
        task({ id: "Thigh", description: "Overdue high task", priority: "HIGH", dueDate: "2026-10-05T12:00:00.000Z" }),
        task({ id: "Tnormal", description: "Normal task", priority: "NORMAL", dueDate: "2026-10-12T12:00:00.000Z" }),
      ],
    })
  );
  assert.deepEqual(
    rows.map((r) => r.primary.key),
    // Urgent; High with the overdue task ahead of a lead waiting since
    // September; Normal; Low (oldest of all, but Low).
    ["new_enquiry:Lnew", "task:Thigh", "awaiting:Lold", "awaiting:Lrecent", "task:Tnormal", "application:A1"]
  );
  assert.equal(urgentHighCount(rows), 4);
});

test("overdue tasks sort ahead of other tasks at the same level, and carry the tag", () => {
  const i = inputs({
    tasks: [
      task({ id: "Ttoday", description: "Today", dueDate: "2026-10-11T12:00:00.000Z" }),
      task({ id: "Tlate", description: "Late", dueDate: "2026-10-10T12:00:00.000Z" }),
      task({ id: "Tsoon", description: "Soon", dueDate: "2026-10-20T12:00:00.000Z" }),
    ],
  });
  const rows = buildPriorities(i);
  assert.deepEqual(rows.map((r) => r.primary.key), ["task:Tlate", "task:Ttoday", "task:Tsoon"]);
  assert.deepEqual(rows.map((r) => r.primary.overdue), [true, false, false]);
  assert.equal(waitingLabel(rows[0].primary, NOW), "Due 10 Oct");
  assert.equal(waitingLabel(rows[1].primary, NOW), "Due today");
});

test("each lead appears once, under its most important reason, with the others underneath", () => {
  const rows = buildPriorities(
    inputs({
      leads: [lead()],
      emails: [email({ lead: { id: "L1", name: "Alice Smith", businessName: null, email: "alice@example.com", phone: null, stage: "UNCONTACTED" } })],
      tasks: [task({ id: "T9", description: "Send samples", priority: "LOW", lead: { id: "L1", name: "Alice Smith", businessName: null, email: null, phone: null, stage: "UNCONTACTED" } })],
    })
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "lead:L1");
  assert.equal(rows[0].level, "URGENT");
  assert.equal(rows[0].primary.key, "new_enquiry:L1");
  assert.deepEqual(rows[0].others.map((o) => o.key), ["email:thread-1", "task:T9"]);

  // Done on the top reason lets the next one take its place.
  const after = removeItem(rows, "new_enquiry:L1");
  assert.equal(after[0].primary.key, "email:thread-1");
  assert.equal(after[0].level, "HIGH");
  assert.deepEqual(after[0].others.map((o) => o.key), ["task:T9"]);
  assert.deepEqual(removeItem(removeItem(after, "email:thread-1"), "task:T9"), []);
});

test("a completed lead's three reasons share one row", () => {
  const rows = buildPriorities(inputs({ leads: [completedLead({ paymentStatus: "NOT_PAID", reviewStatus: "NOT_REQUESTED" })] }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].level, "HIGH");
  // Same level and date: money owed first, then the review, then the Low follow-up.
  assert.deepEqual([rows[0].primary, ...rows[0].others].map((x) => x.type), ["unpaid", "review", "repeat"]);
});

// --- Done, Snooze and Still in talks --------------------------------------------------------

test("Done hides an item until its fingerprint changes", () => {
  const entered = (at: string) =>
    lead({ stage: "AWAITING_RESPONSE", activities: [stageChange("Warm / Awaiting Response", at, "Uncontacted")] });
  const i = inputs({ leads: [entered("2026-10-05T10:00:00.000Z")] });
  const dismissals = [saved(find(i, "awaiting:L1")!, "done", undefined, NOW)];
  assert.deepEqual(visibleKeys({ ...i, dismissals }), []);
  assert.deepEqual(visibleKeys({ ...i, now: new Date(NOW.getTime() + 30 * DAY), dismissals }), []);
  // It left Awaiting Response and came back: a new stay, so it shows again.
  assert.deepEqual(visibleKeys(inputs({ leads: [entered("2026-10-10T10:00:00.000Z")], dismissals })), ["awaiting:L1"]);

  // An application edited back to New is a new fingerprint too.
  const app = { id: "A1", fullName: "Dan", email: null, phone: null, status: "NEW", receivedAt: "2026-10-01T08:00:00.000Z", updatedAt: "2026-10-01T08:00:00.000Z" };
  const ai = inputs({ applications: [app] });
  const appDone = [saved(find(ai, "application:A1")!, "done", undefined, NOW)];
  assert.deepEqual(visibleKeys({ ...ai, dismissals: appDone }), []);
  assert.deepEqual(visibleKeys(inputs({ applications: [{ ...app, updatedAt: "2026-10-11T09:00:00.000Z" }], dismissals: appDone })), ["application:A1"]);
});

test("Done on a task completes the task itself", () => {
  const entry = find(inputs({ tasks: [task()] }), "task:T1")!;
  assert.deepEqual(planPriorityAction(entry, "done", undefined, NOW), { kind: "complete_task", taskId: "T1" });
});

test("Snooze hides an item for 1, 3 or 7 days and it comes back after", () => {
  const i = inputs({ applications: [{ id: "A1", fullName: "Dan", email: null, phone: null, status: "NEW", receivedAt: "2026-10-01T08:00:00.000Z", updatedAt: "2026-10-01T08:00:00.000Z" }] });
  const entry = find(i, "application:A1")!;
  for (const days of [1, 3, 7]) {
    const dismissals = [saved(entry, "snooze", days, NOW)];
    assert.deepEqual(visibleKeys({ ...i, dismissals, now: new Date(NOW.getTime() + days * DAY - 60_000) }), [], `${days} days, just before`);
    assert.deepEqual(visibleKeys({ ...i, dismissals, now: new Date(NOW.getTime() + days * DAY + 60_000) }), ["application:A1"], `${days} days, after`);
  }
  const plan = planPriorityAction(entry, "snooze", 3, NOW);
  assert.ok(!("error" in plan) && plan.kind === "dismiss" && plan.activity === null, "a plain snooze logs nothing");
  assert.deepEqual(planPriorityAction(entry, "snooze", 2, NOW), { error: "Choose 1, 3, 7 days." });
});

test("Still in talks snoozes an awaiting lead for 2, 5 or 7 days and logs a note on it", () => {
  const i = inputs({ leads: [lead({ stage: "AWAITING_RESPONSE" })] });
  const entry = find(i, "awaiting:L1")!;
  const plan = planPriorityAction(entry, "still_in_talks", 5, NOW);
  assert.ok(!("error" in plan) && plan.kind === "dismiss");
  assert.deepEqual(plan.activity, {
    leadId: "L1",
    detail: "Still in talks. Snoozed on Priorities for 5 days, back on 16 Oct.",
  });
  assert.equal(plan.note, "Still in talks, snoozed for 5 days");

  for (const days of [2, 5, 7]) {
    const dismissals = [saved(entry, "still_in_talks", days, NOW)];
    assert.deepEqual(visibleKeys({ ...i, dismissals, now: new Date(NOW.getTime() + days * DAY - 60_000) }), []);
    assert.deepEqual(visibleKeys({ ...i, dismissals, now: new Date(NOW.getTime() + days * DAY + 60_000) }), ["awaiting:L1"]);
  }

  assert.deepEqual(planPriorityAction(entry, "still_in_talks", 3, NOW), { error: "Choose 2, 5, 7 days." });
  const unpaid = find(inputs({ leads: [completedLead({ paymentStatus: "NOT_PAID" })] }), "unpaid:L1")!;
  assert.deepEqual(planPriorityAction(unpaid, "still_in_talks", 2, NOW), {
    error: "Still in talks is only for leads awaiting a response.",
  });
});

// --- Manual tasks ----------------------------------------------------------------------------

test("a task sits at its own priority, with or without a lead", () => {
  const rows = buildPriorities(
    inputs({
      tasks: [
        task({ id: "Tu", description: "Call the council", priority: "URGENT", dueDate: "2026-10-20T12:00:00.000Z" }),
        task({ id: "Tl", description: "Tidy the van", priority: "LOW", dueDate: "2026-10-01T12:00:00.000Z" }),
        task({ id: "Tn", description: "Default", lead: { id: "L5", name: "Erin", businessName: "Erin's Bakery", email: null, phone: null, stage: "WON" } }),
      ],
    })
  );
  assert.deepEqual(rows.map((r) => [r.primary.key, r.level]), [
    ["task:Tu", "URGENT"],
    ["task:Tn", "NORMAL"],
    ["task:Tl", "LOW"],
  ]);
  assert.equal(rows[0].primary.title, "Call the council");
  assert.equal(rows[0].primary.subject.kind, "none");
  assert.equal(rows[1].id, "lead:L5");
  // Overdue is shown even on a Low task, but doesn't lift its level.
  assert.equal(rows[2].primary.overdue, true);
});

test("the level and type filters", () => {
  const rows = buildPriorities(
    inputs({
      leads: [lead({ id: "L1" }), lead({ id: "L2", stage: "AWAITING_RESPONSE" })],
      emails: [email({ lead: { id: "L1", name: "Alice Smith", businessName: null, email: "alice@example.com", phone: null, stage: "UNCONTACTED" } })],
      tasks: [task()],
    })
  );
  assert.deepEqual(filterRows(rows, "HIGH", "ALL").map((r) => r.id), ["lead:L2"]);
  // A type matches the headline, the same as the group a row sits in: the
  // email is underneath Alice's new enquiry, so she is under New enquiry.
  assert.deepEqual(filterRows(rows, "ALL", "new_enquiry").map((r) => r.id), ["lead:L1"]);
  assert.deepEqual(filterRows(rows, "ALL", "unanswered_email"), []);
  assert.deepEqual(filterRows(rows, "ALL", "task").map((r) => r.id), ["task:T1"]);
  assert.deepEqual(filterRows(rows, "LOW", "task"), []);
});

// --- The page: headline, groups and the main button ------------------------------------

const awaitingSince = (id: string, at: string, o: Partial<LeadFacts> = {}) =>
  lead({ id, name: `Lead ${id}`, stage: "AWAITING_RESPONSE", activities: [stageChange("Warm / Awaiting Response", at, "Uncontacted")], ...o });
const replyFrom = (id: string, receivedAt: string) =>
  email({
    lead: { id, name: `Lead ${id}`, businessName: null, email: `${id}@example.com`, phone: null, stage: "AWAITING_RESPONSE" },
    threadId: `thread-${id}`,
    messageId: `msg-${id}`,
    receivedAt,
  });

test("a reply waiting for an answer is the headline over Awaiting Response", () => {
  // Waiting on them since 1 October; they replied on 10 October.
  const rows = buildPriorities(
    inputs({ leads: [awaitingSince("L1", "2026-10-01T10:00:00.000Z")], emails: [replyFrom("L1", "2026-10-10T08:00:00.000Z")] })
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].primary.type, "unanswered_email", "the reply leads, though Awaiting Response is older");
  assert.equal(rows[0].primary.title, "They replied, needs an answer");
  assert.deepEqual(rows[0].others.map((o) => o.type), ["awaiting"]);
  assert.equal(rows[0].level, "HIGH");
  assert.equal(primaryAction(rows[0]), "reply");
  // Still in talks still finds the Awaiting Response reason underneath.
  assert.equal(awaitingItem(rows[0])?.key, "awaiting:L1");
  // Once the reply is dealt with, Waiting on them is the headline again.
  const after = removeItem(rows, "email:thread-L1");
  assert.equal(after[0].primary.type, "awaiting");
  assert.equal(after[0].primary.title, "Waiting on them");

  // Only Awaiting Response is jumped: something more pressing on the same
  // lead, here an overdue High task, stays the headline.
  const withTask = buildPriorities(
    inputs({
      leads: [awaitingSince("L1", "2026-10-01T10:00:00.000Z")],
      emails: [replyFrom("L1", "2026-10-10T08:00:00.000Z")],
      tasks: [task({ id: "T1", priority: "HIGH", dueDate: "2026-10-05T12:00:00.000Z", lead: { id: "L1", name: "Lead L1", businessName: null, email: null, phone: null, stage: "AWAITING_RESPONSE" } })],
    })
  );
  assert.deepEqual([withTask[0].primary, ...withTask[0].others].map((i) => i.type), ["task", "unanswered_email", "awaiting"]);
});

test("rows group by level, then by reason, five at a time with Show all", () => {
  const leads = Array.from({ length: 12 }, (_, i) => awaitingSince(`A${i}`, `2026-09-${String(10 + i).padStart(2, "0")}T10:00:00.000Z`));
  const rows = buildPriorities(
    inputs({
      leads: [
        ...leads,
        lead({ id: "N1", createdAt: "2026-10-10T09:00:00.000Z" }),
        completedLead({ id: "P1", paymentStatus: "DEPOSIT_PAID", reviewStatus: "RECEIVED", job: job({ completionDate: "2026-09-01T00:00:00.000Z" }) }),
      ],
      tasks: [task({ id: "T1" }), task({ id: "T2", dueDate: "2026-10-12T12:00:00.000Z" })],
    })
  );
  const sections = groupRows(rows);
  // P1's follow-up for more work (Low) sits under its Not fully paid row,
  // so there is no Low section.
  assert.deepEqual(sections.map((s) => [s.level, s.count]), [["URGENT", 1], ["HIGH", 13], ["NORMAL", 2]]);
  const high = sections.find((s) => s.level === "HIGH")!;
  // Groups sit where their best row ranks: the unpaid job (since 1 Sep) first.
  assert.deepEqual(high.groups.map((g) => [g.label, g.rows.length, g.shown.length, g.hidden]), [
    ["Not fully paid", 1, 1, 0],
    ["Waiting on them", 12, 5, 7],
  ]);
  // The first five in ranking order: the longest waiting.
  assert.deepEqual(high.groups[1].shown.map((r) => r.id), ["lead:A0", "lead:A1", "lead:A2", "lead:A3", "lead:A4"]);
  assert.equal(sections.find((s) => s.level === "NORMAL")!.groups[0].label, "Tasks");
  // Show all opens just that group.
  const open = groupRows(rows, new Set(["HIGH:awaiting"]));
  const waiting = open.find((s) => s.level === "HIGH")!.groups[1];
  assert.deepEqual([waiting.shown.length, waiting.hidden], [12, 0]);
  assert.deepEqual(waiting.shown.map((r) => r.id), waiting.rows.map((r) => r.id));
  assert.deepEqual(high.groups[0].rows[0].others.map((o) => o.title), ["Follow up for more work"]);
});

test("each row's main button: Reply, Call, Email or Open", () => {
  const replyRow = buildPriorities(inputs({ leads: [awaitingSince("L1", "2026-10-01T10:00:00.000Z")], emails: [replyFrom("L1", "2026-10-10T08:00:00.000Z")] }))[0];
  assert.equal(primaryAction(replyRow), "reply");
  const withPhone = buildPriorities(inputs({ leads: [awaitingSince("L2", "2026-10-01T10:00:00.000Z")] }))[0];
  assert.equal(primaryAction(withPhone), "call");
  const noPhone = buildPriorities(inputs({ leads: [awaitingSince("L3", "2026-10-01T10:00:00.000Z", { phone: null })] }))[0];
  assert.equal(primaryAction(noPhone), "email");
  const nothing = buildPriorities(inputs({ leads: [awaitingSince("L4", "2026-10-01T10:00:00.000Z", { phone: null, email: null })] }))[0];
  assert.equal(primaryAction(nothing), "open");
  assert.equal(primaryAction(buildPriorities(inputs({ leads: [completedLead()] }))[0]), "open");
  const loneTask = buildPriorities(inputs({ tasks: [task()] }))[0];
  assert.equal(primaryAction(loneTask), null, "a task with no lead has nothing to open");
  assert.equal(canMarkLost(loneTask), false);
  assert.equal(canMarkLost(withPhone), true);
  assert.equal(canMarkLost(buildPriorities(inputs({ leads: [lead({ stage: "LOST", source: "WEBSITE_QUOTE_FORM" })], tasks: [task({ lead: { id: "L1", name: "Alice Smith", businessName: null, email: null, phone: null, stage: "LOST" } })] }))[0]), false);
});
