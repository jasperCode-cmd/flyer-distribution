"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatPence } from "@/lib/money";
import { DOCUMENT_TYPE_LABELS, formatLongDate, type DocumentType } from "@/lib/documents/rules";
import DocumentActions, { DocumentStatusPill, type DocumentChange, type DocumentSummary } from "./DocumentActions";

// "Quotes and invoices" on a lead's page: its documents, newest first, with
// their actions, and buttons to make new ones.

type Row = DocumentSummary & { issueDate: string };
type State = { loaded: boolean; error: string | null; documents: Row[]; bank: { ready: boolean; message?: string } };

// A message to show after the page reloads (accepting, paying or sending
// changes the lead itself, so the page is reloaded to show it).
const FLASH_KEY = "fdh-lead-documents-flash";
type Flash = { message: string; link?: { href: string; label: string } };

function readFlash(): Flash | null {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(FLASH_KEY);
    return JSON.parse(raw) as Flash;
  } catch {
    return null;
  }
}

function saveFlash(flash: Flash) {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify(flash));
  } catch {
    // Without storage the page still reloads, just without the message.
  }
}

const CREATE = "text-xs font-bold px-3 py-1.5 rounded-md border";

export default function LeadDocuments({ leadId, scrapped }: { leadId: string; scrapped: boolean }) {
  const [state, setState] = useState<State>({ loaded: false, error: null, documents: [], bank: { ready: true } });
  const [flash, setFlash] = useState<Flash | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/documents?leadId=${encodeURIComponent(leadId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState({ loaded: true, error: null, documents: data.documents, bank: data.bank });
    } catch {
      setState((s) => ({ ...s, loaded: true, error: "Couldn't load quotes and invoices." }));
    }
  }, [leadId]);

  useEffect(() => {
    setFlash(readFlash());
    load();
  }, [load]);

  function changed({ message, link, leadChanged }: DocumentChange) {
    if (!leadChanged) {
      setFlash({ message, link });
      load();
      return;
    }
    saveFlash({ message, link });
    window.location.reload();
  }

  const newHref = (type: DocumentType) => `/admin/crm/documents/new?lead=${encodeURIComponent(leadId)}&type=${type}`;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5" id="quotes-and-invoices">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold text-blue-900">Quotes and invoices</h2>
        {!scrapped && (
          <div className="flex flex-wrap gap-1.5">
            <Link href={newHref("QUOTE")} className={`${CREATE} border-blue-700 bg-blue-700 text-white hover:bg-blue-800`}>
              Create quote
            </Link>
            <Link href={newHref("DEPOSIT")} className={`${CREATE} border-gray-300 text-gray-700 hover:bg-gray-50`}>
              Create deposit invoice
            </Link>
            <Link href={newHref("BALANCE")} className={`${CREATE} border-gray-300 text-gray-700 hover:bg-gray-50`}>
              Create balance invoice
            </Link>
            <Link href={newHref("FULL")} className={`${CREATE} border-gray-300 text-gray-700 hover:bg-gray-50`}>
              Create full invoice
            </Link>
          </div>
        )}
      </div>

      {!state.bank.ready && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-3">{state.bank.message}</p>
      )}
      {flash && (
        <p role="status" className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mb-3">
          {flash.message}{" "}
          {flash.link && (
            <Link href={flash.link.href} className="font-bold underline">
              {flash.link.label}
            </Link>
          )}
        </p>
      )}

      {!state.loaded ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : state.documents.length === 0 ? (
        <p className="text-sm text-gray-400">No quotes or invoices yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {state.documents.map((doc) => (
            <li key={`${doc.kind}-${doc.id}`} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-gray-900">{doc.number}</span>
                  <span className="text-xs text-gray-500">{DOCUMENT_TYPE_LABELS[doc.type]}</span>
                  <DocumentStatusPill status={doc.status} />
                </div>
                <div className="text-sm text-gray-900 tabular-nums">
                  <span className="font-semibold">{formatPence(doc.amountPence)}</span>
                  <span className="text-xs text-gray-500 ml-2">{formatLongDate(doc.issueDate)}</span>
                </div>
              </div>
              <DocumentActions doc={doc} bankReady={state.bank.ready} onChanged={changed} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
