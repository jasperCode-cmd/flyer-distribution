import InboxView from "@/components/crm/InboxView";
import { DEFAULT_INBOX_CATEGORY, INBOX_CATEGORIES } from "@/lib/inbox-categories";

// Everything on this page is fetched client-side from the inbox API routes,
// which check the session themselves; the CRM middleware guards the page.
// The filter and Unread only come from the address, so Refresh and the back
// button keep them.
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[]; unread?: string | string[] }>;
}) {
  const params = await searchParams;
  const requested = typeof params.category === "string" ? params.category : "";
  const category = INBOX_CATEGORIES.some((c) => c.id === requested) ? requested : DEFAULT_INBOX_CATEGORY;

  return (
    <InboxView
      categories={INBOX_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
      initialCategory={category}
      initialUnread={params.unread === "1"}
    />
  );
}
