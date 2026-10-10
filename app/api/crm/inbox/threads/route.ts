import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isGmailConfigured, listInboxThreads } from "@/lib/gmail";
import { findLeadsForAddresses, pickThreadLead } from "@/lib/inbox-leads";
import { gmailFailureResponse, isValidPageToken } from "@/lib/inbox-api";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isGmailConfigured()) {
    return NextResponse.json({ configured: false, threads: [], nextPageToken: null });
  }

  const url = new URL(req.url);
  const pageToken = url.searchParams.get("pageToken");
  if (pageToken !== null && !isValidPageToken(pageToken)) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }

  const result = await listInboxThreads({
    pageToken: pageToken ?? undefined,
    q: url.searchParams.get("q") ?? "",
  });
  if (!result.ok) return gmailFailureResponse(result.reason, result.message);

  const leads = await findLeadsForAddresses(
    prisma,
    result.data.threads.flatMap((t) => [t.replyToAddress ?? "", t.fromAddress])
  );

  return NextResponse.json({
    configured: true,
    threads: result.data.threads.map((t) => ({
      ...t,
      lead: pickThreadLead(leads, { replyTo: t.replyToAddress, from: t.fromAddress }),
    })),
    nextPageToken: result.data.nextPageToken,
  });
}
