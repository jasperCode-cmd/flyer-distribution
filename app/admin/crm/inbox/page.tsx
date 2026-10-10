import InboxView from "@/components/crm/InboxView";

// Everything on this page is fetched client-side from the inbox API routes,
// which check the session themselves; the CRM middleware guards the page.
export default function InboxPage() {
  return <InboxView />;
}
