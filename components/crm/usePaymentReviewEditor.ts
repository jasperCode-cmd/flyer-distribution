"use client";

import { useState } from "react";
import { PAYMENT_AUTOFILL_FRACTION } from "@/lib/crm-constants";

// Shared by the lead detail page and the Kanban card's inline editor, so
// "editable directly from the Kanban card" is genuinely the same behaviour
// as the detail page rather than a second reimplementation of it.
export function usePaymentReviewEditor({
  leadId,
  dealValue,
  initialReviewStatus,
  initialPaymentStatus,
  initialAmountPaid,
}: {
  leadId: string;
  dealValue: string | null;
  initialReviewStatus: string;
  initialPaymentStatus: string;
  initialAmountPaid: string | null;
}) {
  const [reviewStatus, setReviewStatusState] = useState(initialReviewStatus);
  const [paymentStatus, setPaymentStatusState] = useState(initialPaymentStatus);
  const [amountPaid, setAmountPaid] = useState(initialAmountPaid ?? "");

  function patchLead(body: Record<string, unknown>) {
    return fetch(`/api/crm/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function setReviewStatus(next: string) {
    setReviewStatusState(next);
    patchLead({ reviewStatus: next });
  }

  // Picking a status pre-fills the amount from the deal value where there is
  // a sensible share to take (50% deposit, 100% in full). Partial has no
  // default — the figure is arbitrary, so the user types it. With no deal
  // value there is nothing to derive from, so every status just leaves the
  // field open to type into. The pre-filled figure stays editable either way.
  function onPaymentStatusChange(next: string) {
    setPaymentStatusState(next);

    const dealValueNumber = dealValue ? Number(dealValue) : null;
    const fraction = PAYMENT_AUTOFILL_FRACTION[next];

    let nextAmount: string;
    if (next === "NOT_PAID") {
      // Leaving a figure against "Not Paid" would misreport the lead; it is
      // one click to restore by choosing a paid status again.
      nextAmount = "";
    } else if (fraction !== undefined && dealValueNumber !== null && !Number.isNaN(dealValueNumber)) {
      nextAmount = (dealValueNumber * fraction).toFixed(2);
    } else {
      nextAmount = amountPaid;
    }

    setAmountPaid(nextAmount);
    patchLead({ paymentStatus: next, amountPaid: nextAmount === "" ? null : nextAmount });
  }

  function commitAmountPaid() {
    patchLead({ amountPaid: amountPaid === "" ? null : amountPaid });
  }

  const dealValueNumber = dealValue ? Number(dealValue) : null;
  const amountPaidNumber = amountPaid === "" ? null : Number(amountPaid);
  // Flagged rather than blocked: revised quotes, fees and overpayments are
  // all real, so this warns without preventing the save.
  const overpaid =
    dealValueNumber !== null &&
    amountPaidNumber !== null &&
    !Number.isNaN(amountPaidNumber) &&
    amountPaidNumber > dealValueNumber;

  return {
    reviewStatus,
    setReviewStatus,
    paymentStatus,
    onPaymentStatusChange,
    amountPaid,
    setAmountPaid,
    commitAmountPaid,
    dealValueNumber,
    overpaid,
  };
}
