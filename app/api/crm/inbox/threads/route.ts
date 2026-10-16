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
import { parseBusinessFilter, type Business } from "@/lib/business";
import { replyBusiness } from "@/lib/email-channel";
import { isLdbThread, viewExcluded } from "@/lib/gmail";

export const runtime = "nodejs";

function addresses(threads: InboxThreadSummary[]): string[] {
  return threads.flatMap((t) => [t.replyToAddress ?? "", t.fromAddress]);
}

// A Bournemouth conversation (through the LDB address) only ever matches an
// LDB lead; one with an LDB lead counts as Bournemouth mail too.
function matchesOf(lookups: CrmLookups, t: InboxThreadSummary) {
  return crmMatchesFor(lookups, { replyTo: t.replyToAddress, from: t.fromAddress }, { ldbThread: !!t.ldbThread });
}

function businessOf(lookups: CrmLookups, t: InboxThreadSummary): Business {
  return replyBusiness(!!t.ldbThread, matchesOf(lookups, t).lead);
}

function withBadges(threads: InboxThreadSummary[], lookups: CrmLookups) {
  return threads.map((t) => ({ ...t, ...matchesOf(lookups, t), business: businessOf(lookups, t) }));
}

// The inbox list. category and unread pick the filter; q is the search box;
// business is All, FDH or LDB. A Gmail-query category is paged by Gmail
// (pageToken), except under LDB; a CRM-matcher category, and anything under
// LDB (which needs the CRM to recognise a conversation with an LDB lead), is
// scanned in batches and continued with cursor. FDH never shows Bournemouth
// mail.
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
  const view = parseBusinessFilter(url.searchParams.get("business"));

  if (!isGmailConfigured()) {
    return NextResponse.json({ configured: false, threads: [], nextPageToken: null });
  }

  if (category.kind === "gmail" && view !== "LDB") {
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
      view,
    });
    if (!result.ok) return gmailFailureResponse(result.reason, result.message);
    const lookups = await lookupCrm(prisma, addresses(result.data.threads));
    const shown = view === "FDH" ? result.data.threads.filter((t) => businessOf(lookups, t) === "FDH") : result.data.threads;
    return NextResponse.json({
      configured: true,
      mode: "pages",
      threads: withBadges(shown, lookups),
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
    const ldbAddress = context.ldbAddress ?? null;
    const scan = await scanInbox(reader, {
      ...inboxListParams({ q: search, unread, categoryQuery: category.kind === "gmail" ? category.query : undefined }),
      cursor,
      excluded: viewExcluded(view, context.excluded, ldbAddress),
      async accept(threads) {
        const batch = threads.map((t): InboxThreadSummary | null => {
          const summary = summarizeThread(t, context.own ?? context.senderAddress);
          return summary && { ...summary, ldbThread: isLdbThread(t.messages, ldbAddress) };
        });
        threads.forEach((t, i) => summaries.set(t, batch[i]));
        const lookups = await lookupCrm(prisma, addresses(batch.filter((s): s is InboxThreadSummary => s !== null)));
        return threads.map((t, i) => {
          const s = batch[i];
          if (!s) return false;
          if (view !== "ALL" && businessOf(lookups, s) !== view) return false;
          return category.kind === "gmail" ? !category.keep || category.keep(t) : category.matches(t, matchesOf(lookups, s));
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
