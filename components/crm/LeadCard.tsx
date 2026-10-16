import Link from "next/link";
import { PRIORITY_LABELS, CLOSED_WON_STAGES } from "@/lib/crm-constants";
import InlinePaymentReview from "./InlinePaymentReview";
import BusinessBadge from "./BusinessBadge";
import type { Business } from "@/lib/business";

export type KanbanLead = {
  id: string;
  name: string;
  businessName: string | null;
  dealValue: unknown;
  stage: string;
  source: string;
  priority: string;
  atRisk: boolean;
  assignedTo: { id: string; name: string } | null;
  activities: { createdAt: string | Date }[];
  createdAt: string | Date;
  tags?: { id: string; name: string; color: string }[];
  reviewStatus?: string;
  paymentStatus?: string;
  amountPaid?: unknown;
  email?: string | null;
  phone?: string | null;
  business?: Business;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

// Quick actions sit inside the card's Link and the board's draggable
// wrapper. Stopping pointer, mouse and touch down at the button means
// neither drag sensor (nor the touch long-press) ever sees the gesture
// start; preventDefault + stopPropagation on click stops the Link opening
// the lead. Same guard as the Awaiting Response button below.
function stopDragStart(e: React.SyntheticEvent) {
  e.stopPropagation();
}

// -my-0.5 keeps the 20px tap target from making the row taller than its
// 16px text line, so a card is the same height with or without icons.
const quickActionClass =
  "inline-flex h-5 w-5 -my-0.5 shrink-0 items-center justify-center rounded text-gray-400 hover:text-blue-700 hover:bg-blue-50 transition-colors";

function MailIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z" />
    </svg>
  );
}

const PRIORITY_DOT_COLOR: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-gray-400",
};

export default function LeadCard({
  lead,
  onAdvance,
  onEmail,
}: {
  lead: KanbanLead;
  // Present only on the Kanban board, where a fresh lead genuinely sits in
  // an Uncontacted column to advance out of. Omitting it (e.g. anywhere
  // LeadCard might render outside that context) simply hides the button.
  onAdvance?: (leadId: string) => void;
  // Opens the email compose modal over the board. No email icon without it.
  onEmail?: (lead: KanbanLead) => void;
}) {
  // Both fields exist on every lead, but only mean anything once it is Won
  // or Completed, so the editor is confined to those columns.
  const isClosedWon = (CLOSED_WON_STAGES as readonly string[]).includes(lead.stage);

  // A genuine live inbound enquiry, not yet actioned, distinct from the
  // cold-outreach/import leads it would otherwise sit among in that column.
  const isNewWebsiteEnquiry = lead.stage === "UNCONTACTED" && lead.source === "WEBSITE_QUOTE_FORM";
  const canAdvance = lead.stage === "UNCONTACTED" && !!onAdvance;
  const email = lead.email?.trim() || null;
  // A tel: <a> can't sit inside the card's own <a> (nested links are
  // invalid HTML), so the call icon is a button that opens the tel: URL.
  const telHref = lead.phone?.trim() ? `tel:${lead.phone.replace(/[^\d+]/g, "")}` : null;

  return (
    <Link
      href={`/admin/crm/leads/${lead.id}`}
      // Anchors are natively draggable by default in every browser, with
      // zero jitter tolerance, unlike dnd-kit's own 8px activation distance.
      // A real hand's mousedown-to-mouseup on a pill inside this card almost
      // always drifts a pixel or two, which is enough for the browser to
      // start its own native HTML5 drag gesture on the <a> itself, and that
      // native drag swallows the click before it ever reaches the pill's
      // onClick (confirmed via instrumented Playwright repro: a stray
      // "dragstart" fired with no accompanying "click" at all). This is a
      // separate mechanism from dnd-kit's sensors (already guarded against
      // above) and needs its own, native fix.
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className={`block bg-white rounded-md border p-2 sm:p-3 shadow-sm hover:shadow-md transition-shadow ${
        lead.atRisk
          ? "border-l-4 border-l-red-500 border-y-gray-200 border-r-gray-200"
          : isNewWebsiteEnquiry
          ? "border-l-4 border-l-blue-500 border-y-gray-200 border-r-gray-200"
          : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            title={`${PRIORITY_LABELS[lead.priority] ?? lead.priority} priority`}
            className={`shrink-0 w-2 h-2 rounded-full ${PRIORITY_DOT_COLOR[lead.priority] ?? "bg-gray-300"}`}
          />
          <p className="text-[13px] sm:text-sm font-semibold text-blue-900 truncate">{lead.name}</p>
          <BusinessBadge business={lead.business} />
        </div>
        {lead.atRisk && (
          <span
            title="At risk"
            className="shrink-0 text-red-500 text-xs font-bold"
            role="img"
            aria-label="At risk"
          >
            ⚑
          </span>
        )}
      </div>
      {lead.businessName && (
        <p className="text-[11px] sm:text-xs text-gray-500 truncate mt-0.5">{lead.businessName}</p>
      )}
      {isNewWebsiteEnquiry && (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 mt-1.5">
          ● New Enquiry
        </span>
      )}
      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {lead.tags.map((t) => (
            <span
              key={t.id}
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: t.color }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
      {isClosedWon && (
        <InlinePaymentReview
          leadId={lead.id}
          dealValue={typeof lead.dealValue === "string" ? lead.dealValue : null}
          reviewStatus={lead.reviewStatus ?? "NOT_REQUESTED"}
          paymentStatus={lead.paymentStatus ?? "NOT_PAID"}
          amountPaid={typeof lead.amountPaid === "string" ? lead.amountPaid : null}
        />
      )}
      <div className="flex items-center justify-between mt-1.5 sm:mt-2">
        <span className="text-[11px] sm:text-xs font-medium text-gray-700">
          {lead.dealValue ? formatCurrency(Number(lead.dealValue)) : "-"}
        </span>
        <div className="flex items-center gap-1">
          {email && onEmail && (
            <button
              type="button"
              aria-label={`Email ${lead.name}`}
              title={`Email ${email}`}
              onPointerDown={stopDragStart}
              onMouseDown={stopDragStart}
              onTouchStart={stopDragStart}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEmail(lead);
              }}
              className={quickActionClass}
            >
              <MailIcon />
            </button>
          )}
          {telHref && (
            <button
              type="button"
              aria-label={`Call ${lead.name}`}
              title={`Call ${lead.phone}`}
              onPointerDown={stopDragStart}
              onMouseDown={stopDragStart}
              onTouchStart={stopDragStart}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = telHref;
              }}
              className={quickActionClass}
            >
              <PhoneIcon />
            </button>
          )}
          {lead.assignedTo && (
            <span className="text-[11px] bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
              {lead.assignedTo.name.split(" ")[0]}
            </span>
          )}
        </div>
      </div>
      {canAdvance && (
        <button
          type="button"
          title="Move to Awaiting Response"
          aria-label="Move to Awaiting Response"
          // The card itself is a Link, and this button sits inside a
          // draggable wrapper on the Kanban board; preventDefault/
          // stopPropagation on click stops the Link navigating, and on
          // mousedown/touchstart keeps the board's drag sensors from ever
          // seeing the gesture start (see InlinePaymentReview.tsx for the
          // full reasoning: this guard was briefly removed to let a card
          // be dragged by grabbing a pill directly, which broke both pills
          // in Firefox, so it's reinstated here for the same reason).
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAdvance(lead.id);
          }}
          className="mt-1.5 sm:mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold py-1"
        >
          Awaiting Response
          <span aria-hidden="true">→</span>
        </button>
      )}
    </Link>
  );
}
