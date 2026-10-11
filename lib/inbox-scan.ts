import type { gmail_v1 } from "@googleapis/gmail";
import { mapWithConcurrency, shouldExcludeThread } from "./gmail";

// Scanning the inbox for a CRM-matcher filter. Gmail can't search the CRM,
// so threads are read newest first in batches and checked here. Each request
// reads at most SCAN_LIMIT threads and returns at most SCAN_MATCHES matches,
// with a cursor saying exactly where it stopped, so Load more carries on
// from the next thread without repeating any.

export const SCAN_BATCH = 20;
export const SCAN_LIMIT = 60;
export const SCAN_MATCHES = 20;
const METADATA_CONCURRENCY = 5;

export type InboxThreadReader = {
  listThreadIds(params: {
    labelIds: string[];
    q?: string;
    pageToken?: string;
    maxResults: number;
  }): Promise<{ ids: string[]; nextPageToken: string | null }>;
  // Header-only thread, or null if it has gone since it was listed.
  getThreadMetadata(id: string): Promise<gmail_v1.Schema$Thread | null>;
};

// Where the next scan starts: a Gmail page and how far into it.
export type ScanCursor = { pageToken: string | null; offset: number };

export function encodeScanCursor(cursor: ScanCursor): string {
  return Buffer.from(JSON.stringify([cursor.pageToken, cursor.offset]), "utf-8").toString("base64url");
}

export function decodeScanCursor(raw: unknown): ScanCursor | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 400 || !/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
    if (!Array.isArray(value) || value.length !== 2) return null;
    const [pageToken, offset] = value;
    const tokenOk = pageToken === null || (typeof pageToken === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(pageToken));
    const offsetOk = Number.isInteger(offset) && offset >= 0 && offset < SCAN_BATCH;
    return tokenOk && offsetOk ? { pageToken, offset } : null;
  } catch {
    return null;
  }
}

export async function scanInbox(
  reader: InboxThreadReader,
  options: {
    labelIds: string[];
    q?: string;
    cursor: ScanCursor | null;
    excluded: string[];
    // Verdicts for a batch of threads, in order. Excluded threads are never
    // passed in.
    accept: (threads: gmail_v1.Schema$Thread[]) => Promise<boolean[]>;
    limit?: number;
    maxMatches?: number;
  }
): Promise<{ matches: gmail_v1.Schema$Thread[]; next: ScanCursor | null; scanned: number }> {
  const limit = options.limit ?? SCAN_LIMIT;
  const maxMatches = options.maxMatches ?? SCAN_MATCHES;
  const matches: gmail_v1.Schema$Thread[] = [];
  let pageToken = options.cursor?.pageToken ?? null;
  let offset = options.cursor?.offset ?? 0;
  let scanned = 0;

  for (;;) {
    const page = await reader.listThreadIds({
      labelIds: options.labelIds,
      q: options.q || undefined,
      pageToken: pageToken ?? undefined,
      maxResults: SCAN_BATCH,
    });
    // The position just after index i of this page.
    const after = (i: number): ScanCursor | null =>
      i + 1 < page.ids.length
        ? { pageToken, offset: i + 1 }
        : page.nextPageToken
          ? { pageToken: page.nextPageToken, offset: 0 }
          : null;

    const chunk = page.ids.slice(offset, offset + (limit - scanned));
    const threads = await mapWithConcurrency(chunk, METADATA_CONCURRENCY, (id) => reader.getThreadMetadata(id));
    const kept = threads.map((t) => (t && !shouldExcludeThread(t.messages, options.excluded) ? t : null));
    const candidates = kept.filter((t): t is gmail_v1.Schema$Thread => t !== null);
    const verdicts = candidates.length ? await options.accept(candidates) : [];
    const accepted = new Set(candidates.filter((_, i) => verdicts[i]));

    for (let j = 0; j < chunk.length; j++) {
      scanned++;
      const thread = kept[j];
      if (thread && accepted.has(thread)) matches.push(thread);
      if (matches.length >= maxMatches) return { matches, next: after(offset + j), scanned };
    }

    const end = offset + chunk.length;
    if (end < page.ids.length) {
      // Stopped part way through this page because the scan cap was reached.
      return { matches, next: { pageToken, offset: end }, scanned };
    }
    if (!page.nextPageToken) return { matches, next: null, scanned };
    pageToken = page.nextPageToken;
    offset = 0;
    if (scanned >= limit) return { matches, next: { pageToken, offset: 0 }, scanned };
  }
}
