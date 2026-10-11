import { NextResponse } from "next/server";
import type { gmail_v1 } from "@googleapis/gmail";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  inboxListParams,
  isGmailConfigured,
  listInboxThreads,
  summarizeThread,
  withInboxReader,
  type InboxThreadSummary,
} from "@/lib/gmail";
import { findInboxCategory } from "@/lib/inbox-categories";
import { crmMatchesFor, lookupCrm, type CrmLookups } from "@/lib/inbox-crm";
import { decodeScanCursor, encodeScanCursor, scanInbox } from "@/lib/inbox-scan";
import { gmailFailureResponse, isValidPageToken } from "@/lib/inbox-api";

export const runtime = "nodejs";

function addresses(threads: InboxThreadSummary[]): string[] {
  return threads.flatMap((t) => [t.replyToAddress ?? "", t.fromAddress]);
}

function withBadges(threads: InboxThreadSummary[], lookups: CrmLookups) {
  return threads.map((t) => ({ ...t, ...crmMatchesFor(lookups, { replyTo: t.replyToAddress, from: t.fromAddress }) }));
}

// The inbox list. category and unread pick the filter; q is the search box.
// A Gmail-query category is paged by Gmail (pageToken); a CRM-matcher
// category is scanned in batches and continued with cursor.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const category = findInboxCategory(url.searchParams.get("category"));
  if (!category) {
    return NextResponse.json({ error: "Unknown filter" }, { status: 400 });
  }
  const unread = url.searchParams.get("unread") === "1";
  const search = url.searchParams.get("q") ?? "";

  if (!isGmailConfigured()) {
    return NextResponse.json({ configured: false, threads: [], nextPageToken: null });
  }

  if (category.kind === "gmail") {
    const pageToken = url.searchParams.get("pageToken");
    if (pageToken !== null && !isValidPageToken(pageToken)) {
      return NextResponse.json({ error: "Invalid page" }, { status: 400 });
    }
    const result = await listInboxThreads({
      pageToken: pageToken ?? undefined,
      q: search,
      unread,
      categoryQuery: category.query,
      keep: category.keep,
    });
    if (!result.ok) return gmailFailureResponse(result.reason, result.message);
    const lookups = await lookupCrm(prisma, addresses(result.data.threads));
    return NextResponse.json({
      configured: true,
      mode: "pages",
      threads: withBadges(result.data.threads, lookups),
      nextPageToken: result.data.nextPageToken,
    });
  }

  const rawCursor = url.searchParams.get("cursor");
  const cursor = rawCursor === null ? null : decodeScanCursor(rawCursor);
  if (rawCursor !== null && !cursor) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }

  const result = await withInboxReader(async (reader, context) => {
    const summaries = new Map<gmail_v1.Schema$Thread, InboxThreadSummary | null>();
    const scan = await scanInbox(reader, {
      ...inboxListParams({ q: search, unread }),
      cursor,
      excluded: context.excluded,
      async accept(threads) {
        const batch = threads.map((t) => summarizeThread(t, context.senderAddress));
        threads.forEach((t, i) => summaries.set(t, batch[i]));
        const lookups = await lookupCrm(prisma, addresses(batch.filter((s): s is InboxThreadSummary => s !== null)));
        return threads.map((t, i) => {
          const s = batch[i];
          return !!s && category.matches(t, crmMatchesFor(lookups, { replyTo: s.replyToAddress, from: s.fromAddress }));
        });
      },
    });
    const matched = scan.matches
      .map((t) => summaries.get(t))
      .filter((s): s is InboxThreadSummary => !!s);
    return { matched, next: scan.next, scanned: scan.scanned };
  });
  if (!result.ok) return gmailFailureResponse(result.reason, result.message);

  const lookups = await lookupCrm(prisma, addresses(result.data.matched));
  return NextResponse.json({
    configured: true,
    mode: "scan",
    threads: withBadges(result.data.matched, lookups),
    cursor: result.data.next ? encodeScanCursor(result.data.next) : null,
    scanned: result.data.scanned,
  });
}
