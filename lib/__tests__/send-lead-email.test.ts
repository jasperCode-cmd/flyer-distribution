import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { sendLeadEmailAndRecord } from "@/lib/send-lead-email";
import type { SendLeadEmailPrisma, SendEmailFn } from "@/lib/send-lead-email";

function makeFakePrisma(overrides?: { transactionShouldFail?: boolean }): {
  prisma: SendLeadEmailPrisma;
  activityCreate: ReturnType<typeof mock.fn>;
  leadUpdate: ReturnType<typeof mock.fn>;
  transaction: ReturnType<typeof mock.fn>;
} {
  const activityCreate = mock.fn((args: unknown) => ({ __op: "activity.create", args }));
  const leadUpdate = mock.fn((args: unknown) => ({ __op: "lead.update", args }));
  const transaction = mock.fn(async (ops: unknown[]) => {
    if (overrides?.transactionShouldFail) throw new Error("db unavailable");
    return ops;
  });
  const prisma: SendLeadEmailPrisma = {
    activity: { create: activityCreate },
    lead: { update: leadUpdate },
    $transaction: transaction,
  };
  return { prisma, activityCreate, leadUpdate, transaction };
}

function successfulSend(): SendEmailFn {
  return mock.fn(async () => ({ ok: true as const, data: { messageId: "msg1", threadId: "thread1" } }));
}

function failedSend(reason: "not_configured" | "reconnect" | "error"): SendEmailFn {
  return mock.fn(async () => ({ ok: false as const, reason, message: "fail" }));
}

test("Uncontacted lead: successful send moves it to Awaiting Response and clears dialer fields", async () => {
  const { prisma, activityCreate, leadUpdate, transaction } = makeFakePrisma();
  const sendEmailFn = successfulSend();

  const result = await sendLeadEmailAndRecord({
    lead: { id: "lead1", stage: "UNCONTACTED" },
    to: "lead@example.com",
    subject: "Hello",
    body: "Hi there",
    userId: "user1",
    sendEmailFn,
    prismaClient: prisma,
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.movedToAwaitingResponse, true);
    assert.equal(result.threadId, "thread1");
  }

  assert.equal(activityCreate.mock.callCount(), 2, "EMAIL activity and STAGE_CHANGE activity");
  assert.equal(leadUpdate.mock.callCount(), 1);
  const updateArgs = leadUpdate.mock.calls[0].arguments[0] as { data: unknown };
  assert.deepEqual(updateArgs.data, {
    stage: "AWAITING_RESPONSE",
    noAnswerStreak: 0,
    nextCallableAt: null,
  });
  assert.equal(transaction.mock.callCount(), 1);
});

for (const stage of ["AWAITING_RESPONSE", "WON", "COMPLETED", "LOST"]) {
  test(`${stage} lead: successful send is recorded but the lead is left alone`, async () => {
    const { prisma, activityCreate, leadUpdate, transaction } = makeFakePrisma();
    const sendEmailFn = successfulSend();

    const result = await sendLeadEmailAndRecord({
      lead: { id: "lead1", stage },
      to: "lead@example.com",
      subject: "Hello",
      body: "Hi there",
      userId: "user1",
      sendEmailFn,
      prismaClient: prisma,
    });

    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.movedToAwaitingResponse, false);

    assert.equal(activityCreate.mock.callCount(), 1, "only the EMAIL activity, no stage change");
    assert.equal(leadUpdate.mock.callCount(), 0, "the lead's stage is never touched");
    assert.equal(transaction.mock.callCount(), 1);
  });
}

for (const reason of ["not_configured", "reconnect", "error"] as const) {
  test(`a failed send (${reason}) changes nothing in the database`, async () => {
    const { prisma, activityCreate, leadUpdate, transaction } = makeFakePrisma();
    const sendEmailFn = failedSend(reason);

    const result = await sendLeadEmailAndRecord({
      lead: { id: "lead1", stage: "UNCONTACTED" },
      to: "lead@example.com",
      subject: "Hello",
      body: "Hi there",
      userId: "user1",
      sendEmailFn,
      prismaClient: prisma,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.sent, false);
      if (!result.sent) assert.equal(result.reason, reason);
    }

    assert.equal(activityCreate.mock.callCount(), 0);
    assert.equal(leadUpdate.mock.callCount(), 0);
    assert.equal(transaction.mock.callCount(), 0);
  });
}

test("Gmail succeeds but the database write fails: reported as sent but not recorded", async () => {
  const { prisma } = makeFakePrisma({ transactionShouldFail: true });
  const sendEmailFn = successfulSend();

  const result = await sendLeadEmailAndRecord({
    lead: { id: "lead1", stage: "UNCONTACTED" },
    to: "lead@example.com",
    subject: "Hello",
    body: "Hi there",
    userId: "user1",
    sendEmailFn,
    prismaClient: prisma,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.sent, true);
    assert.match(result.message, /sent but could not be recorded/);
  }
});

test("the Activity detail records the subject and only the first 200 characters of the body", async () => {
  const { prisma, activityCreate } = makeFakePrisma();
  const sendEmailFn = successfulSend();
  const longBody = "x".repeat(500);

  await sendLeadEmailAndRecord({
    lead: { id: "lead1", stage: "WON" },
    to: "lead@example.com",
    subject: "Quote follow-up",
    body: longBody,
    userId: "user1",
    sendEmailFn,
    prismaClient: prisma,
  });

  const createArgs = activityCreate.mock.calls[0].arguments[0] as { data: { detail: string } };
  const detail = createArgs.data.detail;
  assert.ok(detail.includes("Quote follow-up"));
  assert.ok(detail.includes("x".repeat(200)));
  assert.ok(!detail.includes("x".repeat(201)));
});
