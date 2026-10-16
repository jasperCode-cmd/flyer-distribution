// Small pieces of the inbox list that run in the browser.

import type { BusinessFilter } from "./business";

// Adds a Load more batch to the list, skipping any thread already shown: the
// inbox can shift between requests as new mail arrives.
export function appendUniqueThreads<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((t) => t.id));
  const added: T[] = [];
  for (const t of incoming) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    added.push(t);
  }
  return [...existing, ...added];
}

// The inbox address for a filter, so Refresh and the back button keep it.
// All, without Unread only, for both businesses, is the plain inbox address.
export function inboxFilterUrl(category: string, unread: boolean, business: BusinessFilter = "ALL"): string {
  const params = new URLSearchParams();
  if (category && category !== "all") params.set("category", category);
  if (unread) params.set("unread", "1");
  if (business !== "ALL") params.set("business", business);
  const query = params.toString();
  return `/admin/crm/inbox${query ? `?${query}` : ""}`;
}
