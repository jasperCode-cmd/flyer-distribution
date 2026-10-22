import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { handleApplicationRequest } from "@/lib/application-endpoint";
import {
  APPLICANT_MAX_PER_HOUR,
  sendApplicantThankYou,
  type ApplicantThankYouOutcome,
  type ApplicantThankYouSend,
  type SavedApplication,
} from "@/lib/applicant-thank-you";
import { buildPriorities } from "@/lib/priorities";
import type { SendEmailParams } from "@/lib/gmail";

// The automatic thank-you email to an FDH distributor applicant, against a
// real database, but only a throwaway local one: it needs
// CRM_TEST_DATABASE_URL pointing at localhost and is skipped otherwise, so it
// can never touch the production database. Every send goes to a fake;
// nothing is emailed. Its applications are dated in 2031, so no other test's
// can fall in their windows, and it cleans up after itself.

const url = process.env.CRM_TEST_DATABASE_URL ?? "";
let host = "";
try {
  host = url ? new URL(url).hostname : "";
} catch {
  host = "";
}
const skip = !["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
  ? "set CRM_TEST_DATABASE_URL to a local throwaway database to run"
  : false;

const MARK = "Applicant Thanks Test";
const DOMAIN = "@applicant-thanks-test.example";
let prisma: PrismaClient;

async function cleanUp() {
  await prisma.distributorApplication.deleteMany({ where: { fullName: { startsWith: MARK } } });
}

before(async () => {
  if (skip) return;
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  await cleanUp();
});

after(async () => {
  if (skip) return;
  await cleanUp();
  await prisma.$disconnect();
});

function fakeSend(result: "ok" | "fail" | "throw" = "ok") {
  const calls: SendEmailParams[] = [];
  const send: ApplicantThankYouSend = async (params) => {
    calls.push(params);
    if (result === "throw") throw new Error(`Gmail fell over sending to ${params.to}`);
    if (result === "fail") return { ok: false, reason: "error", message: `rejected ${params.to}` };
    return { ok: true, data: { id: "fake" } };
  };
  return { calls, send };
}

let n = 0;
function body(overrides: Record<string, string | undefined> = {}) {
  n++;
  return {
    name: `${MARK} Jamie ${n}`,
    phone: `07700 9${String(n).padStart(5, "0")}`,
    email: `jamie${n}${DOMAIN}`,
    area: "Ferndown, BH22",
    age: "24",
    "has-car": "yes",
    "has-licence": "no",
    availability: "Weekday afternoons",
    ...overrides,
  };
}

// The real endpoint, as the route calls it, with a fake sender: the reply,
// and the thank-you's outcome for each application it saved.
async function apply(fields: Record<string, string | undefined>, now: Date, send: ApplicantThankYouSend, onSaved?: () => void) {
  const outcomes: Promise<ApplicantThankYouOutcome>[] = [];
  const saved: SavedApplication[] = [];
  const res = await handleApplicationRequest(
    new Request("http://localhost/api/distributor-application", { method: "POST", body: JSON.stringify(fields) }),
    {
      db: prisma,
      allow: () => true,
      now: () => now,
      onSaved: (application) => {
        onSaved?.();
        saved.push(application);
        outcomes.push(sendApplicantThankYou({ db: prisma, application, send }));
      },
    }
  );
  return { res, json: await res.json(), saved, outcomes: await Promise.all(outcomes) };
}

const at = (iso: string) => new Date(iso);

// Everything stored about an application, to compare before and after.
function row(id: string) {
  return prisma.distributorApplication.findUniqueOrThrow({ where: { id } });
}

test("real database: an FDH application with an email gets one email, with its own HTML and so no signature", { skip }, async () => {
  const fake = fakeSend();
  const fields = body({ name: `${MARK} jamie carter` });
  const { res, json, outcomes, saved } = await apply(fields, at("2031-03-02T09:00:00Z"), fake.send);
  assert.equal(res.status, 200);
  assert.deepEqual(json, { ok: true });
  assert.deepEqual(outcomes, ["sent"]);
  assert.equal(fake.calls.length, 1);
  const sent = fake.calls[0];
  assert.equal(sent.to, fields.email);
  assert.equal(sent.subject, "Thanks for applying, Applicant");
  assert.ok(sent.html?.includes("Your application at a glance"), "the designed HTML, which Gmail sends without the signature");
  assert.ok(sent.body.startsWith("Hi Applicant,\n"), "the plain-text version");
  assert.ok(!sent.html?.includes(">24<"), "never the age");
  // The application as saved, and as the email sees it.
  const stored = await row(saved[0].id);
  assert.equal(stored.business, "FDH");
  assert.equal(stored.source, "WEBSITE_FORM");
});

test("the route sends it from the business Gmail, and only the FDH form's route sends it", () => {
  const route = readFileSync("app/api/distributor-application/route.ts", "utf8");
  assert.match(route, /onSaved: \(application\) =>\s+waitUntil\(\s+sendApplicantThankYou\(\{ db: prisma, application, send: senderFor\("FDH"\) \}\)/);
  // Nothing else uses the send: not the Bournemouth intake, not either Gmail import.
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && !path.includes("__tests__")) files.push(path);
    }
  };
  walk("app");
  walk("lib");
  walk("components");
  const users = files.filter((f) => /from "(@\/lib|\.)\/applicant-thank-you"/.test(readFileSync(f, "utf8")));
  assert.deepEqual(users, ["app/api/distributor-application/route.ts"]);
  for (const f of ["lib/ldb-application-intake.ts", "lib/application-import.ts", "lib/ldb-application-import.ts"]) {
    assert.ok(!readFileSync(f, "utf8").includes("applicant-thank-you"), f);
  }
});

test("real database: no email address, no email", { skip }, async () => {
  const fake = fakeSend();
  const { json, outcomes } = await apply(body({ email: undefined }), at("2031-03-04T09:00:00Z"), fake.send);
  assert.deepEqual(json, { ok: true });
  assert.deepEqual(outcomes, ["no_email"]);
  assert.equal(fake.calls.length, 0);
});

test("real database: never for a Bournemouth application or one brought in by the Gmail import", { skip }, async () => {
  const fake = fakeSend();
  const when = at("2031-03-06T09:00:00Z");
  for (const [business, source] of [["LDB", "WEBSITE_FORM"], ["FDH", "GMAIL_IMPORT"], ["LDB", "GMAIL_IMPORT"]] as const) {
    const created = await prisma.distributorApplication.create({
      data: { fullName: `${MARK} ${business} ${source}`, email: `other${business}${source}${DOMAIN}`, business, source, receivedAt: when, age: "16", area: "Poole" },
    });
    const outcome = await sendApplicantThankYou({ db: prisma, application: { ...created, business, source }, send: fake.send });
    assert.equal(outcome, "not_fdh_website", `${business} ${source}`);
  }
  assert.equal(fake.calls.length, 0);
  // Nor does one of those from the same address stop the FDH form's own email.
  const email = `shared${DOMAIN}`;
  await prisma.distributorApplication.create({ data: { fullName: `${MARK} LDB earlier`, email, business: "LDB", source: "WEBSITE_FORM", receivedAt: when } });
  await prisma.distributorApplication.create({ data: { fullName: `${MARK} import earlier`, email, business: "FDH", source: "GMAIL_IMPORT", receivedAt: when } });
  const { outcomes } = await apply(body({ email }), new Date(when.getTime() + 60_000), fake.send);
  assert.deepEqual(outcomes, ["sent"]);
});

test("real database: at most once per email address in 24 hours, whatever the case", { skip }, async () => {
  const fake = fakeSend();
  const email = `twice${DOMAIN}`;
  const t = at("2031-03-10T09:00:00Z").getTime();
  const hour = 60 * 60 * 1000;
  const run = async (offsetHours: number, address: string) => (await apply(body({ email: address }), new Date(t + offsetHours * hour), fake.send)).outcomes[0];
  assert.equal(await run(0, email), "sent");
  assert.equal(await run(2, email.toUpperCase()), "sent_recently", "two hours later, in capitals");
  assert.equal(await run(23.9, email), "sent_recently", "just inside 24 hours");
  assert.equal(await run(25, email), "sent", "25 hours after the first email, though only an hour after the last application");
  assert.equal(await run(30, email), "sent_recently");
  assert.equal(fake.calls.length, 2);
  assert.deepEqual(fake.calls.map((c) => c.to), [email, email]);
});

test("real database: two applications from one address at the same moment get one email between them", { skip }, async () => {
  const fake = fakeSend();
  const email = `together${DOMAIN}`;
  const when = at("2031-03-14T09:00:00Z");
  const saved: SavedApplication[] = [];
  for (let i = 0; i < 2; i++) {
    await handleApplicationRequest(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body({ email })) }), {
      db: prisma,
      allow: () => true,
      now: () => when,
      onSaved: (a) => saved.push(a),
    });
  }
  assert.equal(saved.length, 2);
  const outcomes = await Promise.all(saved.map((application) => sendApplicantThankYou({ db: prisma, application, send: fake.send })));
  assert.deepEqual([...outcomes].sort(), ["sent", "sent_recently"]);
  assert.equal(fake.calls.length, 1);
});

test("real database: no more than the hourly limit across the site", { skip }, async () => {
  const fake = fakeSend();
  const t = at("2031-03-18T09:00:00Z").getTime();
  for (let i = 0; i < APPLICANT_MAX_PER_HOUR - 1; i++) {
    await prisma.distributorApplication.create({
      data: { fullName: `${MARK} hourly ${i}`, email: `hourly${i}${DOMAIN}`, business: "FDH", source: "WEBSITE_FORM", receivedAt: new Date(t + i * 60_000) },
    });
  }
  const last = await apply(body(), new Date(t + 40 * 60_000), fake.send);
  assert.deepEqual(last.outcomes, ["sent"], "the 20th in the hour");
  const over = await apply(body(), new Date(t + 41 * 60_000), fake.send);
  assert.deepEqual(over.outcomes, ["hourly_limit"], "the 21st");
  assert.equal(fake.calls.length, 1);
  const later = await apply(body(), new Date(t + 2 * 60 * 60_000), fake.send);
  assert.deepEqual(later.outcomes, ["sent"], "an hour on");
});

test("real database: a failed send changes nothing about the form or the application, and logs only a fixed reason", { skip }, async () => {
  for (const [mode, when] of [["fail", "2031-03-22T09:00:00Z"], ["throw", "2031-03-23T09:00:00Z"]] as const) {
    const fake = fakeSend(mode);
    const errors: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args.map(String).join(" "));
    let result;
    try {
      result = await apply(body(), at(when), fake.send);
    } finally {
      console.error = original;
    }
    assert.equal(result.res.status, 200, mode);
    assert.deepEqual(result.json, { ok: true });
    assert.deepEqual(result.outcomes, ["failed"]);
    assert.deepEqual(errors, ["Applicant thank-you email not sent: error"], mode);
    const stored = await row(result.saved[0].id);
    assert.equal(stored.status, "NEW");
    assert.equal(stored.notes, null);
  }
  // Even something going wrong as the email is started can't change the reply.
  const thrown = await apply(body(), at("2031-03-24T09:00:00Z"), fakeSend().send, () => {
    throw new Error("boom");
  });
  assert.equal(thrown.res.status, 200);
  assert.deepEqual(thrown.json, { ok: true });
  assert.equal(await prisma.distributorApplication.count({ where: { fullName: { startsWith: MARK }, receivedAt: at("2031-03-24T09:00:00Z") } }), 1);
});

test("real database: the application stays NEW, with its notes untouched and its Priorities item as it was", { skip }, async () => {
  const fake = fakeSend();
  const when = at("2031-03-26T09:00:00Z");
  const saved: SavedApplication[] = [];
  await handleApplicationRequest(new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body()) }), {
    db: prisma,
    allow: () => true,
    now: () => when,
    onSaved: (a) => saved.push(a),
  });
  const beforeSend = await row(saved[0].id);
  const priorities = async () => {
    const a = await row(saved[0].id);
    const rows = buildPriorities({
      now: new Date(when.getTime() + 60_000),
      leads: [],
      applications: [{ id: a.id, fullName: a.fullName, email: a.email, phone: a.phone, business: a.business, status: a.status, source: a.source, receivedAt: a.receivedAt.toISOString(), updatedAt: a.updatedAt.toISOString() }],
      tasks: [],
      emails: [],
      dismissals: [],
    });
    return rows.flatMap((r) => [r.primary, ...r.others]).map((i) => ({ key: i.key, type: i.type, title: i.title, fingerprint: i.fingerprint }));
  };
  const itemsBefore = await priorities();
  assert.equal(await sendApplicantThankYou({ db: prisma, application: saved[0], send: fake.send }), "sent");
  const afterSend = await row(saved[0].id);
  assert.deepEqual(afterSend, beforeSend, "not a single field changed, updatedAt included");
  assert.equal(afterSend.status, "NEW");
  assert.equal(afterSend.notes, null);
  const itemsAfter = await priorities();
  assert.deepEqual(itemsAfter, itemsBefore);
  assert.deepEqual(itemsAfter.map((i) => [i.type, i.title]), [["application", "New application"]]);
});

test("real database: a repeat from the same phone isn't a new application, so it gets no email", { skip }, async () => {
  const fake = fakeSend();
  const first = body();
  const when = at("2031-03-28T09:00:00Z");
  assert.deepEqual((await apply(first, when, fake.send)).outcomes, ["sent"]);
  const again = await apply({ ...first, email: `different${DOMAIN}` }, new Date(when.getTime() + 60_000), fake.send);
  assert.deepEqual(again.json, { ok: true });
  assert.deepEqual(again.saved, [], "noted on the first application instead");
  assert.equal(fake.calls.length, 1);
});
