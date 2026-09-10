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
// badge elsewhere) — every state needs its own small trigger so Not
// Requested is still clickable to set.
const REVIEW_ICON: Record<string, { icon: string; className: string; title: string }> = {
  NOT_REQUESTED: { icon: "☆", className: "text-gray-300", title: "Review not requested — click to update" },
  REQUESTED: { icon: "☆", className: "text-amber-500", title: "Review requested — click to update" },
  RECEIVED: { icon: "★", className: "text-emerald-600", title: "Review received — click to update" },
};

// Editable version of the payment/review pill+star shown on Won and
// Completed Kanban cards. Collapsed by default at the exact same size as
// the old read-only badges; only grows into the full control on click.
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
  const [expanded, setExpanded] = useState(false);
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

  useEffect(() => {
    if (!expanded) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  const paidAmount = amountPaid === "" ? null : Number(amountPaid);
  const review = REVIEW_ICON[reviewStatus] ?? REVIEW_ICON.NOT_REQUESTED;

  return (
    <div
      ref={containerRef}
      // The card is a Link, and on the Kanban board it also sits inside a
      // draggable wrapper — preventDefault/stopPropagation on click keeps
      // every interaction in here (trigger or expanded controls alike) from
      // firing the Link's navigation, and stopPropagation on pointerDown
      // keeps dnd-kit's drag sensors from ever seeing the gesture start.
      // Same pattern already proven for the one-click stage-advance button.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {!expanded ? (
        <div className="flex flex-wrap items-center gap-1 mt-1.5">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
              PAYMENT_PILL[paymentStatus] ?? PAYMENT_PILL.NOT_PAID
            }`}
            title={`Payment: ${PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus} — click to edit`}
          >
            {PAYMENT_STATUS_LABELS[paymentStatus] ?? paymentStatus}
            {PAYMENT_SHOWS_AMOUNT.has(paymentStatus) && paidAmount !== null && (
              <> · {formatCurrency(paidAmount)}</>
            )}
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={`text-xs leading-none ${review.className}`}
            title={review.title}
          >
            {review.icon}
          </button>
        </div>
      ) : (
        <div className="mt-1.5 bg-gray-50 border border-gray-200 rounded-md p-2 space-y-1.5">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Review</label>
            <select
              autoFocus
              value={reviewStatus}
              onChange={(e) => setReviewStatus(e.target.value)}
              className="w-full text-[11px] border border-gray-300 rounded px-1.5 py-1 bg-white"
            >
              {Object.entries(REVIEW_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Payment</label>
            <select
              value={paymentStatus}
              onChange={(e) => onPaymentStatusChange(e.target.value)}
              className="w-full text-[11px] border border-gray-300 rounded px-1.5 py-1 bg-white"
            >
              {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          {paymentStatus !== "NOT_PAID" && (
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Amount Paid</label>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                onBlur={commitAmountPaid}
                placeholder={dealValue ? "" : "Enter amount"}
                className="w-full text-[11px] border border-gray-300 rounded px-1.5 py-1"
              />
              {overpaid && (
                <p className="text-[10px] text-amber-700 mt-1">More than the quoted deal value.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
