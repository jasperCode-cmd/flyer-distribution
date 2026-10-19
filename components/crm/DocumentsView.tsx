"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPence } from "@/lib/money";
import type { BusinessFilter as Filter } from "@/lib/business";
import { DOCUMENT_TYPE_LABELS, STATUS_LABELS, formatLongDate, isUnpaidInvoice, type DocumentType } from "@/lib/documents/rules";
import BusinessBadge from "./BusinessBadge";
import BusinessFilter from "./BusinessFilter";
import { DocumentStatusPill, documentHref, pdfHref } from "./DocumentActions";

// Every quote and invoice, with filters for business, type and status, and
// an Unpaid invoices view: sent invoices not yet paid, with their totals.

export type DocumentListRow = {
  kind: "quote" | "invoice";
  id: string;
  number: string;
  type: DocumentType;
  status: string;
  business: "FDH" | "LDB";
  leadId: string;
  leadName: string;
  clientName: string;
  totalPence: number;
  amountPence: number;
  issueDate: string;
  dueDate: string | null;
  dueOnReceipt: boolean;
};

const TYPE_FILTERS: ("ALL" | DocumentType)[] = ["ALL", "QUOTE", "DEPOSIT", "BALANCE", "FULL"];
const STATUS_FILTERS = ["ALL", "DRAFT", "SENT", "ACCEPTED", "DECLINED", "PAID", "VOID"] as const;

const SELECT = "border border-gray-300 rounded-md px-2.5 py-1.5 text-xs bg-white";

export default function DocumentsView({ documents, today, bank }: { documents: DocumentListRow[]; today: string; bank: { ready: boolean; message?: string } }) {
  const [view, setView] = useState<"all" | "unpaid">("all");
  const [business, setBusiness] = useState<Filter>("ALL");
  const [type, setType] = useState<(typeof TYPE_FILTERS)[number]>("ALL");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("ALL");

  const byBusiness = documents.filter((d) => business === "ALL" || d.business === business);
  const shown = useMemo(
    () =>
      view === "unpaid"
        ? byBusiness
            .filter(isUnpaidInvoice)
            .filter((d) => type === "ALL" || d.type === type)
            .sort((a, b) => (dueKey(a) < dueKey(b) ? -1 : 1))
        : byBusiness.filter((d) => (type === "ALL" || d.type === type) && (status === "ALL" || d.status === status)),
    [byBusiness, view, type, status]
  );

  const overdue = (d: DocumentListRow) => !d.dueOnReceipt && d.dueDate !== null && d.dueDate < today;
  const unpaidTotal = shown.reduce((sum, d) => sum + d.amountPence, 0);
  const overdueRows = shown.filter(overdue);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-blue-900">Documents</h1>
          <p className="text-xs text-gray-500 mt-1">Quotes and invoices for both businesses. Make new ones from a lead&apos;s page.</p>
        </div>
        <div role="tablist" aria-label="View" className="inline-flex rounded-md border border-gray-300 overflow-hidden bg-white">
          {(
            [
              ["all", "All documents"],
              ["unpaid", "Unpaid invoices"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={view === key}
              type="button"
              onClick={() => setView(key)}
              className={`px-3 py-1.5 text-xs font-medium border-l border-gray-300 first:border-l-0 ${
                view === key ? "bg-blue-700 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!bank.ready && <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">{bank.message}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <BusinessFilter value={business} onChange={setBusiness} />
        <label className="sr-only" htmlFor="doc-type">
          Type
        </label>
        <select id="doc-type" value={type} onChange={(e) => setType(e.target.value as typeof type)} className={SELECT}>
          {TYPE_FILTERS.filter((t) => view === "all" || t !== "QUOTE").map((t) => (
            <option key={t} value={t}>
              {t === "ALL" ? "All types" : DOCUMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {view === "all" && (
          <>
            <label className="sr-only" htmlFor="doc-status">
              Status
            </label>
            <select id="doc-status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={SELECT}>
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "ALL" ? "All statuses" : STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {view === "unpaid" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Tile label="Unpaid invoices" value={String(shown.length)} />
          <Tile label="Total outstanding" value={formatPence(unpaidTotal)} />
          <Tile
            label="Overdue"
            value={formatPence(overdueRows.reduce((sum, d) => sum + d.amountPence, 0))}
            note={`${overdueRows.length} invoice${overdueRows.length === 1 ? "" : "s"} past the due date`}
          />
        </div>
      )}

      {shown.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200">
          <p className="text-sm text-gray-400 p-5">{view === "unpaid" ? "No unpaid invoices." : "No documents match these filters."}</p>
        </div>
      ) : (
        <>
          {/* Relative, so the hidden Actions heading stays inside the scrolling box. */}
          <div className="hidden md:block relative bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Number</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Lead</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">{view === "unpaid" ? "Amount due" : "Amount"}</th>
                  <th className="px-3 py-2 font-medium">Issued</th>
                  <th className="px-3 py-2 font-medium">{view === "unpaid" ? "Due" : "Due / valid until"}</th>
                  <th className="px-3 py-2 font-medium sr-only">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((d) => (
                  <tr key={`${d.kind}-${d.id}`} className="align-top">
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">
                      <Link href={documentHref(d)} className="text-blue-800 hover:underline">
                        {d.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{DOCUMENT_TYPE_LABELS[d.type]}</td>
                    <td className="px-3 py-2 min-w-[10rem]">
                      <Link href={`/admin/crm/leads/${d.leadId}`} className="text-gray-900 hover:underline">
                        {d.leadName}
                      </Link>{" "}
                      <BusinessBadge business={d.business} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <DocumentStatusPill status={d.status} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatPence(d.amountPence)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatLongDate(d.issueDate)}</td>
                    <td className={`px-3 py-2 whitespace-nowrap ${view === "unpaid" && overdue(d) ? "text-red-700 font-semibold" : "text-gray-700"}`}>
                      {d.dueOnReceipt ? "On receipt" : d.dueDate ? formatLongDate(d.dueDate) : "-"}
                      {view === "unpaid" && overdue(d) ? " (overdue)" : ""}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">{pdfLink(d, bank.ready)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: one card per document. */}
          <ul className="space-y-2 md:hidden">
            {shown.map((d) => (
              <li key={`${d.kind}-${d.id}`} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={documentHref(d)} className="font-semibold text-blue-800 hover:underline">
                      {d.number}
                    </Link>
                    <p className="text-xs text-gray-500">{DOCUMENT_TYPE_LABELS[d.type]}</p>
                  </div>
                  <DocumentStatusPill status={d.status} />
                </div>
                <p className="mt-1 text-sm break-words">
                  <Link href={`/admin/crm/leads/${d.leadId}`} className="text-gray-900 hover:underline">
                    {d.leadName}
                  </Link>{" "}
                  <BusinessBadge business={d.business} />
                </p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <div className="min-w-0 text-xs text-gray-600">
                    <p>Issued {formatLongDate(d.issueDate)}</p>
                    {dueText(d) && (
                      <p className={view === "unpaid" && overdue(d) ? "text-red-700 font-semibold" : ""}>
                        {dueText(d)}
                        {view === "unpaid" && overdue(d) ? " (overdue)" : ""}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-right tabular-nums">
                    <span className="block text-[11px] text-gray-500">{view === "unpaid" ? "Amount due" : "Amount"}</span>
                    <span className="font-semibold text-gray-900">{formatPence(d.amountPence)}</span>
                  </p>
                </div>
                <div className="mt-2 border-t border-gray-100 pt-2">{pdfLink(d, bank.ready)}</div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function pdfLink(d: DocumentListRow, bankReady: boolean) {
  if (d.kind === "invoice" && !bankReady) return <span className="text-xs text-gray-400">PDF unavailable</span>;
  return (
    <a href={pdfHref(d)} className="text-xs font-medium text-blue-700 hover:underline">
      Download PDF
    </a>
  );
}

// "Valid until" for a quote, "Due" for an invoice; null when there's no date.
function dueText(d: DocumentListRow): string | null {
  if (d.dueOnReceipt) return "Due on receipt";
  if (!d.dueDate) return null;
  return `${d.kind === "quote" ? "Valid until" : "Due"} ${formatLongDate(d.dueDate)}`;
}

// Due on receipt first, then by due date.
function dueKey(d: DocumentListRow): string {
  return d.dueOnReceipt ? "0000-00-00" : d.dueDate ?? "9999-99-99";
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
      {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
    </div>
  );
}
