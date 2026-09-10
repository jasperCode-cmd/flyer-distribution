"use client";

import { useEffect, useRef, useState } from "react";
import { REVIEW_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/crm-constants";
import { usePaymentReviewEditor } from "./usePaymentReviewEditor";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

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

// Review has no "nothing to show" state here (unlike the plain read-only
// badge elsewhere used before this was made editable) — every state needs
// its own visible pill so Not Requested is still clickable to set, same as
// the payment pill always showing even at its Not Paid default.
const REVIEW_PILL: Record<string, string> = {
  NOT_REQUESTED: "bg-gray-100 text-gray-500",
  REQUESTED: "bg-amber-50 text-amber-700",
  RECEIVED: "bg-emerald-50 text-emerald-700",
};

// A shared, tight class string so the select genuinely reads as "the pill,
// now editable" rather than a form control dropped onto the card.
const COMPACT_SELECT =
  "text-[10px] leading-none font-medium px-1.5 py-0.5 rounded-full border-0 bg-gray-100 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400";

// Editable version of the payment/review pills shown on Won and Completed
// Kanban cards — two independent pills, each collapsed by default at the
// same small footprint as the old read-only badges, only growing (and only
// its own pill, not both) on click.
export default function InlinePaymentReview({
  leadId,
  dealValue,
  reviewStatus: initialReviewStatus,
  paymentStatus: initialPaymentStatus,
  amountPaid: initialAmountPaid,
}: {
  leadId: string;
  dealValue: string | null;
  reviewStatus: string;
  paymentStatus: string;
  amountPaid: string | null;
}) {
  const [expandedField, setExpandedField] = useState<"payment" | "review" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    reviewStatus,
    setReviewStatus,
    paymentStatus,
    onPaymentStatusChange,
    amountPaid,
    setAmountPaid,
    commitAmountPaid,
    overpaid,
  } = usePaymentReviewEditor({
    leadId,
    dealValue,
    initialReviewStatus,
    initialPaymentStatus,
    initialAmountPaid,
  });

  // mousedown (which drives the outside-click collapse below) always fires
  // before the input's own blur, so without this ref the listener — set up
  // once per expandedField transition, not per keystroke — would close over
  // a stale commitAmountPaid from before the user finished typing and never
  // see the value actually save. The ref always holds the latest render's
  // closure regardless of when the listener itself was attached.
  const latestRef = useRef({ expandedField, commitAmountPaid });
  latestRef.current = { expandedField, commitAmountPaid };

  useEffect(() => {
    if (!expandedField) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (latestRef.current.expandedField === "payment") {
          latestRef.current.commitAmountPaid();
        }
        setExpandedField(null);
      }
    }
    // Attaching on the very next tick, not synchronously in this effect, is
    // deliberate: Firefox renders a native <select>'s open dropdown as an
    // OS-level popup rather than in-page like Chrome, and combined with
    // autoFocus firing the instant the select mounts, it can emit its own
    // focus/mousedown handling as a side effect of that same click that
    // opened this editor — observed in Firefox only (never Chrome) as the
    // editor flashing open and immediately collapsing again. Deferring the
    // listener past the current call stack means any such same-click,
    // browser-internal event has already happened before we start listening,
    // so it can no longer be mistaken for a genuine subsequent outside click.
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [expandedField]);

  const paidAmount = amountPaid === "" ? null : Number(amountPaid);
  const paymentNeedsAmount = PAYMENT_SHOWS_AMOUNT.has(paymentStatus);

  return (
    <div
      ref={containerRef}
      // The card is a Link, so preventDefault/stopPropagation on click keeps
      // a click on either pill (trigger or expanded controls alike) from
      // firing the Link's navigation.
      //
      // Deliberately NOT stopping mousedown/touchstart here (an earlier
      // version of this guard did, to protect against dnd-kit's own
      // click-swallowing after a real drag) — that unconditionally stopped
      // the gesture from ever reaching the board's draggable wrapper at
      // all, which also meant a card could never be picked up by grabbing
      // it on top of either pill: confirmed directly, dragging by the pill
      // left the card's stage unchanged while dragging by any other part of
      // the same card worked. The drag sensors (MouseSensor: 8px distance;
      // TouchSensor: 250ms delay) already make their own correct call on a
      // plain click that never crosses their threshold — they never
      // activate, so the click reaches this button's onClick normally — and
      // on a real drag that does cross it, dnd-kit's own capture-phase
      // click swallower (registered only once a drag actually activates)
      // stops the stray click from reopening the pill. The native-drag
      // issue this guard was originally layered onto (the card's own <a>
      // being draggable by default) is handled separately, via
      // draggable={false} on that Link.
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className="flex flex-wrap items-center gap-1 mt-1.5"
    >
      {/* Payment pill / compact editor */}
      {expandedField !== "payment" ? (
        <button
          type="button"
          onClick={() => setExpandedField("payment")}
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            PAYMENT_PILL[paymentStatus] ?? PAYMENT_PILL.NOT_PAID
          }`}
          title={`Payment: ${PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus} — click to edit`}
        >
          {PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus}
          {paymentNeedsAmount && paidAmount !== null && <> · {formatCurrency(paidAmount)}</>}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">
          <select
            autoFocus
            value={paymentStatus}
            onChange={(e) => {
              const next = e.target.value;
              onPaymentStatusChange(next);
              if (!PAYMENT_SHOWS_AMOUNT.has(next)) setExpandedField(null);
            }}
            className={COMPACT_SELECT}
          >
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {paymentNeedsAmount && (
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              // Commits on blur (e.g. tabbing away) but doesn't collapse —
              // that stays the outside-click handler's job, so clicking
              // over to the status select right beside this input doesn't
              // yank the editor closed mid-adjustment.
              onBlur={commitAmountPaid}
              placeholder={dealValue ? "" : "£"}
              title={overpaid ? "More than the quoted deal value" : undefined}
              className={`w-14 ${COMPACT_SELECT} ${overpaid ? "ring-1 ring-amber-400" : ""}`}
            />
          )}
        </span>
      )}

      {/* Review pill / compact editor */}
      {expandedField !== "review" ? (
        <button
          type="button"
          onClick={() => setExpandedField("review")}
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
            REVIEW_PILL[reviewStatus] ?? REVIEW_PILL.NOT_REQUESTED
          }`}
          title={`Review: ${REVIEW_STATUS_LABELS[reviewStatus] ?? reviewStatus} — click to edit`}
        >
          {REVIEW_STATUS_LABELS[reviewStatus] ?? reviewStatus}
        </button>
      ) : (
        // Wrapped the same way as the payment select above — even though
        // review never has a sibling input — for structural parity, on the
        // chance the difference itself (a bare <select> as a direct flex
        // child vs. one nested inside a span) is what's letting Firefox's
        // native-popup behaviour reach the outside-click check differently
        // than it does for payment's already-working, wrapped version.
        <span className="inline-flex items-center gap-1">
          <select
            autoFocus
            value={reviewStatus}
            onChange={(e) => {
              setReviewStatus(e.target.value);
              setExpandedField(null);
            }}
            className={COMPACT_SELECT}
          >
            {Object.entries(REVIEW_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </span>
      )}
    </div>
  );
}
