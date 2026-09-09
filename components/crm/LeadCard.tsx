import Link from "next/link";
import { PRIORITY_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/crm-constants";

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
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

const PRIORITY_DOT_COLOR: Record<string, string> = {
  HIGH: "bg-red-500",
  MEDIUM: "bg-yellow-500",
  LOW: "bg-gray-400",
};

// Not Requested renders nothing — it is the default on every lead, so showing
// it would put a badge on every Won card while saying nothing.
const REVIEW_BADGE: Record<string, { icon: string; className: string; title: string }> = {
  REQUESTED: { icon: "☆", className: "text-amber-500", title: "Review requested" },
  RECEIVED: { icon: "★", className: "text-emerald-600", title: "Review received" },
};

const PAYMENT_PILL: Record<string, string> = {
  NOT_PAID: "bg-gray-100 text-gray-500",
  DEPOSIT_PAID: "bg-amber-50 text-amber-700",
  PARTIAL_PAID: "bg-amber-50 text-amber-700",
  PAID_IN_FULL: "bg-emerald-50 text-emerald-700",
};

// Amount is worth showing only where it is not implied by the status itself:
// a part-payment is an arbitrary figure, whereas "Paid in Full" is the deal
// value and "Not Paid" is nothing.
const PAYMENT_SHOWS_AMOUNT = new Set(["DEPOSIT_PAID", "PARTIAL_PAID"]);

export default function LeadCard({
  lead,
  onAdvance,
}: {
  lead: KanbanLead;
  // Present only on the Kanban board, where a fresh lead genuinely sits in
  // an Uncontacted column to advance out of. Omitting it (e.g. anywhere
  // LeadCard might render outside that context) simply hides the button.
  onAdvance?: (leadId: string) => void;
}) {
  // Both fields exist on every lead, but only mean anything once it is Won,
  // so the badges are confined to that column.
  const isWon = lead.stage === "WON";
  const review = isWon ? REVIEW_BADGE[lead.reviewStatus ?? ""] : undefined;
  const paymentStatus = isWon ? lead.paymentStatus : undefined;
  const paidAmount =
    lead.amountPaid !== null && lead.amountPaid !== undefined ? Number(lead.amountPaid) : null;

  // A genuine live inbound enquiry, not yet actioned — distinct from the
  // cold-outreach/import leads it would otherwise sit among in that column.
  const isNewWebsiteEnquiry = lead.stage === "UNCONTACTED" && lead.source === "WEBSITE_QUOTE_FORM";
  const canAdvance = lead.stage === "UNCONTACTED" && !!onAdvance;

  return (
    <Link
      href={`/admin/crm/leads/${lead.id}`}
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
        </div>
        {lead.atRisk && (
          <span
            title="At risk"
            className="shrink-0 text-red-500 text-xs font-bold"
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
      {paymentStatus && (
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              PAYMENT_PILL[paymentStatus] ?? PAYMENT_PILL.NOT_PAID
            }`}
            title={`Payment: ${PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus}`}
          >
            {PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus}
            {PAYMENT_SHOWS_AMOUNT.has(paymentStatus) && paidAmount !== null && (
              <> · {formatCurrency(paidAmount)}</>
            )}
          </span>
          {review && (
            <span className={`text-xs leading-none ${review.className}`} title={review.title}>
              {review.icon}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mt-1.5 sm:mt-2">
        <span className="text-[11px] sm:text-xs font-medium text-gray-700">
          {lead.dealValue ? formatCurrency(Number(lead.dealValue)) : "—"}
        </span>
        {lead.assignedTo && (
          <span className="text-[11px] bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
            {lead.assignedTo.name.split(" ")[0]}
          </span>
        )}
      </div>
      {canAdvance && (
        <button
          type="button"
          title="Move to Awaiting Response"
          aria-label="Move to Awaiting Response"
          // The card itself is a Link, and this button sits inside a
          // draggable wrapper on the Kanban board — preventDefault/
          // stopPropagation on click stops the Link navigating, and
          // stopPropagation on pointerDown stops dnd-kit's drag sensors
          // (attached to an ancestor) from ever seeing the gesture start.
          onPointerDown={(e) => e.stopPropagation()}
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
