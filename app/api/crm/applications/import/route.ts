import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { withGmailMessageReader } from "@/lib/gmail";
import { gmailFailureResponse, isValidThreadId } from "@/lib/inbox-api";
import { DISTRIBUTOR_APPLICATION_SUBJECT } from "@/lib/distributor-application-form";
import {
  IMPORT_SCAN_MAX,
  findApplicationEmails,
  flagDuplicates,
  loadSelectedApplicationEmails,
  saveImportedApplications,
} from "@/lib/application-import";

async function alreadyImported(messageIds: string[]): Promise<Set<string>> {
  if (messageIds.length === 0) return new Set();
  const rows = await prisma.distributorApplication.findMany({
    where: { gmailMessageId: { in: messageIds } },
    select: { gmailMessageId: true },
  });
  return new Set(rows.map((r) => r.gmailMessageId).filter((id): id is string => !!id));
}

function existingWithPhones() {
  return prisma.distributorApplication.findMany({
    where: { phone: { not: null } },
    select: { fullName: true, phone: true, receivedAt: true },
    orderBy: { receivedAt: "asc" },
    take: 5000,
  });
}

// Preview: searches Gmail for application emails and reads them. Nothing is
// saved. Applicant details go only to the signed-in CRM user and are never
// logged.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await withGmailMessageReader((reader, context) =>
    findApplicationEmails(reader, { ...context, subject: DISTRIBUTOR_APPLICATION_SUBJECT }, { alreadyImported })
  );
  if (!result.ok) return gmailFailureResponse(result.reason, result.message);

  const { candidates, alreadyImported: skipped, truncated } = result.data;
  const flags = flagDuplicates(candidates, await existingWithPhones());
  return NextResponse.json({
    configured: true,
    alreadyImported: skipped,
    truncated,
    scanLimit: IMPORT_SCAN_MAX,
    items: candidates.map((c) => ({
      messageId: c.messageId,
      threadId: c.threadId,
      receivedAt: c.receivedAt,
      business: c.business,
      fields: c.parsed.fields,
      missing: c.parsed.missing,
      readable: c.parsed.readable,
      problem: c.parsed.problem ?? null,
      duplicate: flags.get(c.messageId) ?? null,
    })),
  });
}

// Confirm: imports the chosen emails, read again from Gmail, with source
// GMAIL_IMPORT, receivedAt set to each email's date, and the business of the
// website it came through.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { selections?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const raw = Array.isArray(body?.selections) ? body.selections : null;
  if (!raw || raw.length === 0 || raw.length > IMPORT_SCAN_MAX) {
    return NextResponse.json({ error: "Choose at least one application to import" }, { status: 400 });
  }
  const selections: { messageId: string; threadId: string }[] = [];
  for (const s of raw) {
    const messageId = (s as { messageId?: unknown })?.messageId;
    const threadId = (s as { threadId?: unknown })?.threadId;
    if (!isValidThreadId(messageId) || !isValidThreadId(threadId)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    selections.push({ messageId, threadId });
  }

  const result = await withGmailMessageReader((reader, context) =>
    loadSelectedApplicationEmails(
      reader,
      { ...context, subject: DISTRIBUTOR_APPLICATION_SUBJECT },
      selections,
      alreadyImported
    )
  );
  if (!result.ok) return gmailFailureResponse(result.reason, result.message);

  const flags = flagDuplicates(result.data, await existingWithPhones());
  const imported = await saveImportedApplications(prisma, result.data, flags);
  return NextResponse.json({ imported, skipped: selections.length - imported });
}
