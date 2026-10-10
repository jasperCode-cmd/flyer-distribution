import "server-only";
import { awaitingResponseStageData, shouldMoveToAwaitingResponse } from "./crm-data";
import { STAGE_LABELS } from "./crm-constants";
import type { GmailResult, ThreadContext } from "./gmail";

// Minimal shapes of the Prisma calls this needs, so a test can pass a plain
// mock object instead of a real PrismaClient. The real route passes the
// real `prisma` singleton, which satisfies this structurally.
// `any` for the data fields here is deliberate: this interface exists so a
// plain mock object can stand in for Prisma in tests, without having to
// match Prisma's generated, strict input types exactly.
export type SendLeadEmailPrisma = {
  activity: { create: (args: { data: any }) => unknown };
  lead: { update: (args: { where: { id: string }; data: any }) => unknown };
  $transaction: (ops: unknown[]) => Promise<unknown>;
};

export type SendEmailFn = (params: {
  to: string;
  subject: string;
  body: string;
  threadContext?: ThreadContext | null;
}) => Promise<GmailResult<{ messageId: string; threadId: string }>>;

export type SendLeadEmailResult =
  | { ok: true; movedToAwaitingResponse: boolean; threadId: string }
  | { ok: false; sent: false; reason: "not_configured" | "reconnect" | "error"; message: string }
  | { ok: false; sent: true; message: string };

// Sends the email, then (only on a successful send) records it as an
// Activity and, only from Uncontacted, moves the lead to Awaiting Response
// using the same shared stage data the Dialer's Warm outcome uses. If
// Gmail fails, nothing below this point runs and the database is never
// touched. If Gmail succeeds but the database write fails, that failure is
// reported distinctly so the caller knows the email went out regardless.
export async function sendLeadEmailAndRecord(params: {
  lead: { id: string; stage: string };
  to: string;
  subject: string;
  body: string;
  userId: string;
  threadContext?: ThreadContext | null;
  sendEmailFn: SendEmailFn;
  prismaClient: SendLeadEmailPrisma;
}): Promise<SendLeadEmailResult> {
  const result = await params.sendEmailFn({
    to: params.to,
    subject: params.subject,
    body: params.body,
    threadContext: params.threadContext,
  });

  if (!result.ok) {
    return { ok: false, sent: false, reason: result.reason, message: result.message };
  }

  const movedToAwaitingResponse = shouldMoveToAwaitingResponse(params.lead.stage);
  const activityDetail = `Email: "${params.subject}"\n\n${params.body.slice(0, 200)}${
    params.body.length > 200 ? "..." : ""
  }`;

  try {
    const ops: unknown[] = [
      params.prismaClient.activity.create({
        data: { leadId: params.lead.id, type: "EMAIL", detail: activityDetail, userId: params.userId },
      }),
    ];

    if (movedToAwaitingResponse) {
      ops.push(
        params.prismaClient.lead.update({
          where: { id: params.lead.id },
          data: awaitingResponseStageData(),
        }),
        params.prismaClient.activity.create({
          data: {
            leadId: params.lead.id,
            type: "STAGE_CHANGE",
            detail: `Stage changed from ${STAGE_LABELS.UNCONTACTED} to ${STAGE_LABELS.AWAITING_RESPONSE} because an email was sent.`,
            userId: params.userId,
          },
        })
      );
    }

    await params.prismaClient.$transaction(ops);
  } catch (err) {
    console.error(
      `Failed to record sent email for lead ${params.lead.id}:`,
      err instanceof Error ? err.message : "unknown error"
    );
    return {
      ok: false,
      sent: true,
      message: "The email was sent but could not be recorded in the CRM. Please note this manually.",
    };
  }

  return { ok: true, movedToAwaitingResponse, threadId: result.data.threadId };
}
