"use client";

import { useState } from "react";
import { formatPence, parsePoundsToPence } from "@/lib/money";
import { formatLongDate, parseRecordedDeposit, ukToday, type RecordedDepositData } from "@/lib/documents/rules";
import { Modal } from "./DocumentActions";

// "Record a deposit paid outside the CRM" on a lead: the invoice number as it
// was issued, the amount, and the dates it was issued and paid; then a
// confirm box saying what recording it does, the lead's amount paid included.

const INPUT = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
const LABEL = "block text-xs font-medium text-gray-500 mb-1";

export default function RecordDepositModal({
  leadId,
  paidInvoicesPence,
  leadAmountPaid,
  onCancel,
  onRecorded,
}: {
  leadId: string;
  // The total of the lead's paid invoices now.
  paidInvoicesPence: number;
  // The amount paid as the lead shows it now, typed in by hand or not.
  leadAmountPaid: string | null;
  onCancel: () => void;
  onRecorded: (number: string) => void;
}) {
  const today = ukToday(new Date());
  const [form, setForm] = useState({ number: "", amount: "", issueDate: "", paidOn: "" });
  const [checked, setChecked] = useState<RecordedDepositData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function review() {
    const result = parseRecordedDeposit(form, today);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setChecked(result.data);
  }

  async function record() {
    if (!checked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/documents/recorded-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't record the deposit. Please try again.");
        return;
      }
      onRecorded(data.number);
    } catch {
      setError("Couldn't reach the CRM. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const nowPence = leadAmountPaid ? parsePoundsToPence(leadAmountPaid) : null;
  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  if (checked) {
    const becomes = paidInvoicesPence + checked.amountPence;
    return (
      <Modal title={`Record ${checked.number} as a paid deposit?`} onClose={onCancel}>
        <dl className="text-sm grid grid-cols-[7.5rem_1fr] gap-y-1 mb-3">
          <dt className="text-gray-500">Invoice number</dt>
          <dd className="text-gray-900 font-semibold">{checked.number}</dd>
          <dt className="text-gray-500">Amount paid</dt>
          <dd className="text-gray-900 tabular-nums">{formatPence(checked.amountPence)}</dd>
          <dt className="text-gray-500">Date issued</dt>
          <dd className="text-gray-900">{formatLongDate(checked.issueDate)}</dd>
          <dt className="text-gray-500">Date paid</dt>
          <dd className="text-gray-900">{formatLongDate(checked.paidOn)}</dd>
        </dl>
        <p className="text-sm text-gray-700">
          It is saved as a paid deposit invoice, marked as issued outside the CRM: the CRM makes no PDF of it, never emails it and
          can&apos;t void it (a record made by mistake can be removed). Balance invoices for this lead deduct it like any paid
          deposit, and its draft balance invoices update now.
        </p>
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-3">
          This replaces the amount paid typed in on the lead, as marking any invoice paid does. The lead&apos;s amount paid becomes{" "}
          <strong>{formatPence(becomes)}</strong>, the total of its paid invoices
          {nowPence !== null ? `, instead of the ${formatPence(nowPence)} it shows now` : ""}, and its payment status is worked out
          again.
        </p>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={() => setChecked(null)} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md">
            Back
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={record}
            className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold py-2.5 rounded-md disabled:opacity-50"
          >
            {busy ? "Recording..." : "Record deposit"}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Record a deposit paid outside the CRM" onClose={onCancel}>
      <p className="text-sm text-gray-700 mb-3">
        For a deposit invoice you issued and were paid for outside the CRM, so balance invoices deduct it. Its number must be the one
        it was issued with, below INV-1106.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="recorded-number" className={LABEL}>
            Invoice number, as issued
          </label>
          <input id="recorded-number" placeholder="INV-1105" autoComplete="off" className={INPUT} {...field("number")} />
        </div>
        <div>
          <label htmlFor="recorded-amount" className={LABEL}>
            Amount paid (£)
          </label>
          <input id="recorded-amount" inputMode="decimal" placeholder="0.00" className={`${INPUT} tabular-nums`} {...field("amount")} />
        </div>
        <div>
          <label htmlFor="recorded-issued" className={LABEL}>
            Date issued
          </label>
          <input id="recorded-issued" type="date" max={today} className={INPUT} {...field("issueDate")} />
        </div>
        <div>
          <label htmlFor="recorded-paid" className={LABEL}>
            Date paid
          </label>
          <input id="recorded-paid" type="date" max={today} className={INPUT} {...field("paidOn")} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md">
          Cancel
        </button>
        <button type="button" onClick={review} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold py-2.5 rounded-md">
          Continue
        </button>
      </div>
    </Modal>
  );
}
