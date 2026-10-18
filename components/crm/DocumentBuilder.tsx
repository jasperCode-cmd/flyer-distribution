"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPence, parsePoundsToPence } from "@/lib/money";
import {
  DESIGN_DEFAULT_PENCE,
  DOCUMENT_TYPE_LABELS,
  LIMITS,
  addDays,
  balancePence,
  canEdit,
  depositPence,
  formatLongDate,
  type ClientDetails,
  type DocumentType,
  type LineDraft,
} from "@/lib/documents/rules";
import BusinessBadge from "./BusinessBadge";
import DocumentActions, { DocumentStatusPill, pdfHref, type DocumentChange } from "./DocumentActions";

// The form for a quote or an invoice: client details, lines, dates and
// notes, with the total worked out as you type. New documents start from the
// lead (or its accepted quote); a draft can be edited until it is sent;
// anything else is shown read-only with its actions.

export type BuilderDocument = {
  // Null for a new document.
  id: string | null;
  kind: "quote" | "invoice";
  number: string | null;
  type: DocumentType;
  status: string;
  business: "FDH" | "LDB";
  lead: { id: string; name: string };
  quote: { id: string; number: string } | null;
  client: ClientDetails;
  lines: LineDraft[];
  issueDate: string;
  dueDate: string | null;
  notes: string;
  // Balance invoices: the paid deposits it deducts.
  deductions: { number: string; paidOn: string | null; amountPence: number }[];
  totalPence: number;
  amountDuePence: number;
};

const INPUT = "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-700";
const LABEL = "block text-xs font-medium text-gray-500 mb-1";
const CARD = "bg-white rounded-lg border border-gray-200 p-4 sm:p-5";

export default function DocumentBuilder({
  initial,
  validDays,
  balanceDays,
  bank,
  notice,
}: {
  initial: BuilderDocument;
  validDays: number;
  balanceDays: number;
  bank: { ready: boolean; message?: string };
  notice?: string;
}) {
  const router = useRouter();
  const editable = initial.id === null || canEdit(initial.status as "DRAFT");
  const [client, setClient] = useState<ClientDetails>(initial.client);
  const [lines, setLines] = useState<LineDraft[]>(initial.lines.length ? initial.lines : [{ label: "", quantity: "", amount: "" }]);
  const [issueDate, setIssueDate] = useState(initial.issueDate);
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [notes, setNotes] = useState(initial.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<DocumentChange | null>(notice ? { message: notice, leadChanged: false } : null);

  const isQuote = initial.type === "QUOTE";
  const amounts = lines.map((l) => (l.amount.trim() === "" ? 0 : parsePoundsToPence(l.amount)));
  const badAmount = amounts.some((a) => a === null);
  const total = amounts.reduce<number>((sum, a) => sum + (a ?? 0), 0);
  const deducted = initial.deductions.map((d) => d.amountPence);
  const due = useMemo(() => {
    if (initial.type === "DEPOSIT") return depositPence(total);
    if (initial.type === "BALANCE") return balancePence(total, deducted);
    return total;
  }, [initial.type, total, deducted]);
  const hasDesign = lines.some((l) => l.label.trim().toLowerCase() === "design");

  const title = initial.number
    ? `${DOCUMENT_TYPE_LABELS[initial.type]} ${initial.number}`
    : `New ${DOCUMENT_TYPE_LABELS[initial.type].toLowerCase()}`;

  function setLine(i: number, patch: Partial<LineDraft>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload = {
      leadId: initial.lead.id,
      type: initial.type,
      quoteId: initial.quote?.id ?? null,
      client,
      lines,
      issueDate,
      dueDate: initial.type === "FULL" ? dueDate : null,
      notes,
    };
    try {
      const res = await fetch(initial.id ? `/api/crm/documents/${initial.kind}/${initial.id}` : "/api/crm/documents", {
        method: initial.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't save. Please try again.");
        return;
      }
      if (!initial.id) {
        router.push(`/admin/crm/documents/${data.kind}/${data.id}?saved=1`);
      } else {
        setMessage({ message: "Draft saved.", leadChanged: false });
        router.refresh();
      }
    } catch {
      setError("Couldn't reach the CRM. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <Link href={`/admin/crm/leads/${initial.lead.id}#quotes-and-invoices`} className="text-xs text-blue-700 hover:underline">
          Back to {initial.lead.name}
        </Link>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="text-xl font-bold text-blue-900">{title}</h1>
          {initial.id && <DocumentStatusPill status={initial.status} />}
          <BusinessBadge business={initial.business} />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          For {initial.lead.name}
          {initial.quote ? `, from quote ${initial.quote.number}` : ""}. Sent as{" "}
          {initial.business === "LDB" ? "Leaflet Distribution Bournemouth" : "Flyer Distribution Hampshire"}.
        </p>
      </div>

      {!isQuote && !bank.ready && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">{bank.message}</p>
      )}
      {message && (
        <p role="status" className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
          {message.message}{" "}
          {message.link && (
            <Link href={message.link.href} className="font-bold underline">
              {message.link.label}
            </Link>
          )}
        </p>
      )}

      {initial.id && (
        <div className={CARD}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DocumentActions
              doc={{
                kind: initial.kind,
                id: initial.id,
                number: initial.number ?? "",
                type: initial.type,
                status: initial.status,
                business: initial.business,
                totalPence: initial.totalPence,
                amountPence: initial.amountDuePence,
              }}
              bankReady={bank.ready}
              showOpen={false}
              onChanged={(change) => {
                if (change.deleted) {
                  router.push(`/admin/crm/leads/${initial.lead.id}#quotes-and-invoices`);
                  return;
                }
                setMessage(change);
                router.refresh();
              }}
            />
            {(isQuote || bank.ready) && (
              <a href={pdfHref({ kind: initial.kind, id: initial.id }, true)} target="_blank" rel="noopener" className="text-xs font-medium text-blue-700 hover:underline">
                Preview PDF in a new tab
              </a>
            )}
          </div>
          {editable && <p className="text-xs text-gray-500 mt-2">Save any changes before downloading or emailing.</p>}
        </div>
      )}

      <div className={CARD}>
        <h2 className="text-sm font-bold text-blue-900 mb-3">Client details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              ["name", "Name", LIMITS.clientName],
              ["businessName", "Business / Organisation", LIMITS.clientBusinessName],
              ["email", "Email", LIMITS.clientEmail],
              ["address", "Address / Area", LIMITS.clientAddress],
              ["targetAreas", "Target area(s)", LIMITS.targetAreas],
            ] as const
          ).map(([key, label, max]) => (
            <div key={key} className={key === "targetAreas" ? "sm:col-span-2" : ""}>
              <label htmlFor={`client-${key}`} className={LABEL}>
                {label}
              </label>
              <input
                id={`client-${key}`}
                value={client[key]}
                maxLength={max}
                disabled={!editable}
                onChange={(e) => setClient((c) => ({ ...c, [key]: e.target.value }))}
                className={INPUT}
              />
            </div>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <h2 className="text-sm font-bold text-blue-900 mb-3">Lines</h2>
        <div className="hidden sm:grid grid-cols-[1fr_7rem_8rem_2rem] gap-2 text-xs font-medium text-gray-500 mb-1">
          <span>Description</span>
          <span>Quantity</span>
          <span>Amount (£)</span>
          <span />
        </div>
        <div className="space-y-3 sm:space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-[1fr_7rem_8rem_2rem] gap-2 items-start">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor={`line-${i}-label`} className="sr-only">
                  Line {i + 1} description
                </label>
                <input
                  id={`line-${i}-label`}
                  value={line.label}
                  maxLength={LIMITS.label}
                  disabled={!editable}
                  placeholder="Description"
                  onChange={(e) => setLine(i, { label: e.target.value })}
                  className={INPUT}
                />
              </div>
              <div>
                <label htmlFor={`line-${i}-qty`} className="sr-only">
                  Line {i + 1} quantity
                </label>
                <input
                  id={`line-${i}-qty`}
                  value={line.quantity}
                  inputMode="numeric"
                  disabled={!editable}
                  placeholder="Quantity"
                  onChange={(e) => setLine(i, { quantity: e.target.value })}
                  className={INPUT}
                />
              </div>
              <div className="flex gap-2 sm:contents">
                <div className="flex-1">
                  <label htmlFor={`line-${i}-amount`} className="sr-only">
                    Line {i + 1} amount in pounds
                  </label>
                  <input
                    id={`line-${i}-amount`}
                    value={line.amount}
                    inputMode="decimal"
                    disabled={!editable}
                    placeholder="0.00"
                    onChange={(e) => setLine(i, { amount: e.target.value })}
                    className={`${INPUT} tabular-nums ${amounts[i] === null ? "border-red-400" : ""}`}
                  />
                </div>
                {editable && lines.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove line ${i + 1}`}
                    onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                    className="w-8 h-9 shrink-0 text-gray-400 hover:text-red-600 text-lg leading-none"
                  >
                    ×
                  </button>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </div>
            </div>
          ))}
        </div>
        {editable && (
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              disabled={lines.length >= LIMITS.lines}
              onClick={() => setLines((ls) => [...ls, { label: "", quantity: "", amount: "" }])}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Add line
            </button>
            {!hasDesign && (
              <button
                type="button"
                disabled={lines.length >= LIMITS.lines}
                onClick={() => setLines((ls) => [...ls, { label: "Design", quantity: "", amount: (DESIGN_DEFAULT_PENCE / 100).toFixed(2) }])}
                className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Add design line ({formatPence(DESIGN_DEFAULT_PENCE)})
              </button>
            )}
          </div>
        )}

        <dl className="mt-4 border-t border-gray-100 pt-3 ml-auto max-w-sm text-sm space-y-1.5 tabular-nums">
          {isQuote ? (
            <Row label="Total" value={badAmount ? "-" : formatPence(total)} strong />
          ) : initial.type === "DEPOSIT" ? (
            <>
              <Row label="Campaign total" value={badAmount ? "-" : formatPence(total)} />
              <Row label="50% deposit (rounded up to the penny)" value={badAmount ? "-" : formatPence(due)} />
              <Row label="Amount due" value={badAmount ? "-" : formatPence(due)} strong />
            </>
          ) : initial.type === "BALANCE" ? (
            <>
              <Row label="Campaign total" value={badAmount ? "-" : formatPence(total)} />
              {initial.deductions.length === 0 && <p className="text-xs text-gray-500">No paid deposits to deduct.</p>}
              {initial.deductions.map((d) => (
                <Row
                  key={d.number}
                  label={`Less deposit received, ${d.number}${d.paidOn ? ` (paid ${formatLongDate(d.paidOn)})` : ""}`}
                  value={`-${formatPence(d.amountPence)}`}
                />
              ))}
              <Row label="Balance due" value={badAmount ? "-" : formatPence(due)} strong />
              {due < 0 && <p className="text-xs text-red-600">The paid deposits come to more than this total.</p>}
            </>
          ) : (
            <>
              <Row label="Total" value={badAmount ? "-" : formatPence(total)} />
              <Row label="Amount due" value={badAmount ? "-" : formatPence(due)} strong />
            </>
          )}
          <p className="text-xs text-gray-500 text-right">Not VAT registered</p>
        </dl>
      </div>

      <div className={CARD}>
        <h2 className="text-sm font-bold text-blue-900 mb-3">Dates</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="issue-date" className={LABEL}>
              Date of issue
            </label>
            <input id="issue-date" type="date" value={issueDate} disabled={!editable} onChange={(e) => setIssueDate(e.target.value)} className={INPUT} />
          </div>
          <div>
            {initial.type === "FULL" ? (
              <>
                <label htmlFor="due-date" className={LABEL}>
                  Due date
                </label>
                <input id="due-date" type="date" value={dueDate} min={issueDate} disabled={!editable} onChange={(e) => setDueDate(e.target.value)} className={INPUT} />
              </>
            ) : (
              <>
                <p className={LABEL}>{isQuote ? "Valid until" : "Due"}</p>
                <p className="text-sm text-gray-800 py-2">
                  {!issueDate
                    ? "-"
                    : isQuote
                      ? `${formatLongDate(addDays(issueDate, validDays))} (${validDays} days)`
                      : initial.type === "DEPOSIT"
                        ? "On receipt"
                        : `${formatLongDate(addDays(issueDate, balanceDays))} (within ${balanceDays} days)`}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={CARD}>
        <label htmlFor="notes" className="text-sm font-bold text-blue-900 mb-3 block">
          Notes
        </label>
        <textarea
          id="notes"
          value={notes}
          maxLength={LIMITS.notes}
          rows={4}
          disabled={!editable}
          placeholder="Optional, printed on the document"
          onChange={(e) => setNotes(e.target.value)}
          className={INPUT}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {editable && (
        <div className="flex flex-wrap gap-2 justify-end">
          <Link
            href={`/admin/crm/leads/${initial.lead.id}#quotes-and-invoices`}
            className="text-sm font-medium px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={saving || badAmount || total <= 0 || !client.name.trim() || due < 0}
            className="text-sm font-bold px-4 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : initial.id ? "Save changes" : "Save draft"}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "font-bold text-gray-900 text-base" : "text-gray-700"}`}>
      <dt>{label}</dt>
      <dd className="shrink-0">{value}</dd>
    </div>
  );
}
