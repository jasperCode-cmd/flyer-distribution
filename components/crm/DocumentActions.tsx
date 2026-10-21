"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPence } from "@/lib/money";
import {
  DOCUMENT_TYPE_LABELS,
  RECORDED_OUTSIDE_LABEL,
  STATUS_LABELS,
  canAcceptOrDecline,
  canDelete,
  canEmail,
  canMarkPaid,
  canMarkSent,
  canVoid,
  depositPence,
  ukToday,
  type DocumentStatus,
  type DocumentType,
  type InvoiceStatus,
  type QuoteStatus,
} from "@/lib/documents/rules";

// The buttons for one quote or invoice, and the small windows they open:
// download, email to client, accept or decline (quotes), mark paid and void
// (invoices), and open or delete a draft. A deposit recorded from outside the
// CRM has only Open and Remove record. Used on the lead's section, the
// Documents page and the document's own page.

export type DocumentSummary = {
  kind: "quote" | "invoice";
  id: string;
  number: string;
  type: DocumentType;
  status: string;
  business: "FDH" | "LDB";
  totalPence: number;
  amountPence: number;
  // A deposit issued and paid outside the CRM, recorded here: no PDF, email
  // or void, only a way to remove a record made by mistake.
  issuedOutsideCrm?: boolean;
};

const PILL: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 border-gray-300",
  SENT: "bg-blue-50 text-blue-800 border-blue-200",
  ACCEPTED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  DECLINED: "bg-amber-50 text-amber-900 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-800 border-emerald-200",
  VOID: "bg-gray-50 text-gray-500 border-gray-200 line-through",
};

export function DocumentStatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-px text-[11px] font-semibold ${PILL[status] ?? PILL.DRAFT}`}>
      {STATUS_LABELS[status as DocumentStatus] ?? status}
    </span>
  );
}

// Shown beside a deposit recorded from outside the CRM, wherever it is listed.
export function RecordedOutsideLabel() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-gray-400 bg-white px-2 py-px text-[11px] font-medium text-gray-600">
      {RECORDED_OUTSIDE_LABEL}
    </span>
  );
}

export function documentHref(doc: { kind: string; id: string }) {
  return `/admin/crm/documents/${doc.kind}/${doc.id}`;
}

export function pdfHref(doc: { kind: string; id: string }, view = false) {
  return `/api/crm/documents/${doc.kind}/${doc.id}/pdf${view ? "?view=1" : ""}`;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-xl sm:rounded-xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <h3 className="text-sm font-bold text-blue-900 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

const BTN = "text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_PLAIN = `${BTN} border-gray-300 text-gray-700 hover:bg-gray-50`;
const BTN_PRIMARY = `${BTN} border-blue-700 bg-blue-700 text-white hover:bg-blue-800`;
const BTN_DANGER = `${BTN} border-red-300 text-red-700 hover:bg-red-50`;

export type DocumentChange = { message: string; link?: { href: string; label: string }; leadChanged: boolean; deleted?: boolean };

type Pending =
  | { kind: "email" }
  | { kind: "paid" }
  | { kind: "confirm"; title: string; text: string; action: string; label: string; danger?: boolean }
  | null;

export default function DocumentActions({
  doc,
  bankReady,
  onChanged,
  showOpen = true,
}: {
  doc: DocumentSummary;
  // Invoices can't be downloaded or emailed without the bank details.
  bankReady: boolean;
  // leadChanged: the action also changed the lead (its stage, deal value or
  // payment), so a page showing the lead needs reloading.
  onChanged: (change: DocumentChange) => void;
  showOpen?: boolean;
}) {
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isQuote = doc.kind === "quote";
  const blockedByBank = !isQuote && !bankReady;
  const status = doc.status as DocumentStatus;

  function close() {
    setPending(null);
    setError(null);
  }

  async function post(path: string, body: unknown, method = "POST") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return null;
      }
      return data;
    } catch {
      setError("Couldn't reach the CRM. Check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function runConfirmed(action: string) {
    if (action === "delete") {
      const data = await post(`/api/crm/documents/${doc.kind}/${doc.id}`, undefined, "DELETE");
      if (data) {
        close();
        onChanged({ message: `Draft ${doc.number} deleted. Its number is not reused.`, leadChanged: false, deleted: true });
      }
      return;
    }
    const data = await post(`/api/crm/documents/${doc.kind}/${doc.id}/action`, { action });
    if (!data) return;
    close();
    if (action === "accept") {
      onChanged({
        message: `${doc.number} accepted. Deposit invoice ${data.depositNumber} drafted for you to review and send.`,
        link: { href: documentHref({ kind: "invoice", id: data.depositInvoiceId }), label: `Open ${data.depositNumber}` },
        leadChanged: true,
      });
    } else if (action === "sent") {
      onChanged({
        message: `${doc.number} marked as sent. Nothing was emailed.${data.movedToAwaitingResponse ? " The lead moved to Awaiting Response." : ""}`,
        leadChanged: true,
      });
    }
    else if (action === "decline") onChanged({ message: `${doc.number} marked declined.`, leadChanged: false });
    else if (action === "void") onChanged({ message: `${doc.number} voided.`, leadChanged: doc.status === "PAID" });
    else if (action === "remove") {
      onChanged({
        message: `The record of ${doc.number} is removed. The lead's amount paid and payment status are updated.`,
        leadChanged: true,
        deleted: true,
      });
    }
  }

  if (doc.issuedOutsideCrm) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-1.5">
          {showOpen && (
            <Link href={documentHref(doc)} className={BTN_PLAIN}>
              Open
            </Link>
          )}
          <button
            type="button"
            className={BTN_DANGER}
            onClick={() =>
              setPending({
                kind: "confirm",
                title: `Remove the record of ${doc.number}?`,
                text: "For a deposit recorded by mistake. The record is removed and no longer counts as paid: the lead's amount paid and payment status are worked out again from its other paid invoices, its draft balance invoices stop deducting it, and a note is added to the lead. You can then record it again with the right details. A balance invoice that has gone out and deducts it has to be voided first.",
                action: "remove",
                label: "Remove record",
                danger: true,
              })
            }
          >
            Remove record
          </button>
        </div>
        {pending?.kind === "confirm" && (
          <Modal title={pending.title} onClose={close}>
            <p className="text-sm text-gray-700">{pending.text}</p>
            {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={close} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => runConfirmed(pending.action)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-2.5 rounded-md disabled:opacity-50"
              >
                {busy ? "Working..." : pending.label}
              </button>
            </div>
          </Modal>
        )}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {showOpen && (
          <Link href={documentHref(doc)} className={BTN_PLAIN}>
            {canDelete(status) ? "Edit" : "Open"}
          </Link>
        )}
        {blockedByBank ? (
          <button type="button" disabled className={BTN_PLAIN} title="Bank details are not set up">
            Download PDF
          </button>
        ) : (
          <a href={pdfHref(doc)} className={BTN_PLAIN}>
            Download PDF
          </a>
        )}
        {canEmail(status) && (
          <button
            type="button"
            className={BTN_PLAIN}
            disabled={blockedByBank}
            title={blockedByBank ? "Bank details are not set up" : undefined}
            onClick={() => setPending({ kind: "email" })}
          >
            Email to client
          </button>
        )}
        {canMarkSent(status) && (
          <button
            type="button"
            className={BTN_PLAIN}
            onClick={() =>
              setPending({
                kind: "confirm",
                title: `Mark ${doc.number} as sent?`,
                text: "For when you have sent it yourself, outside the CRM. Nothing is emailed: it is marked Sent from now and a note is added to the lead. An Uncontacted lead moves to Awaiting Response, as when the CRM sends it.",
                action: "sent",
                label: "Mark as sent",
              })
            }
          >
            Mark as sent
          </button>
        )}
        {isQuote && canAcceptOrDecline(status as QuoteStatus) && (
          <>
            <button
              type="button"
              className={BTN_PRIMARY}
              onClick={() =>
                setPending({
                  kind: "confirm",
                  title: `Mark ${doc.number} accepted?`,
                  text: `The lead moves to Won (unless it is already Won or Completed) and its deal value becomes ${formatPence(doc.totalPence)}. A draft deposit invoice for ${formatPence(depositPence(doc.totalPence))}, due on receipt, is made for you to review and send.`,
                  action: "accept",
                  label: "Mark accepted",
                })
              }
            >
              Mark accepted
            </button>
            <button
              type="button"
              className={BTN_PLAIN}
              onClick={() =>
                setPending({
                  kind: "confirm",
                  title: `Mark ${doc.number} declined?`,
                  text: "The quote is kept, marked declined. The lead's stage doesn't change.",
                  action: "decline",
                  label: "Mark declined",
                })
              }
            >
              Mark declined
            </button>
          </>
        )}
        {!isQuote && canMarkPaid(status as InvoiceStatus) && (
          <button type="button" className={BTN_PRIMARY} onClick={() => setPending({ kind: "paid" })}>
            Mark paid
          </button>
        )}
        {!isQuote && canVoid(status as InvoiceStatus) && (
          <button
            type="button"
            className={BTN_DANGER}
            onClick={() =>
              setPending({
                kind: "confirm",
                title: `Void ${doc.number}?`,
                text:
                  status === "PAID"
                    ? "It stays on record marked void and is no longer counted as paid, so the lead's amount paid and payment status are worked out again."
                    : "It stays on record marked void and is no longer payable. Its number is not reused.",
                action: "void",
                label: "Void invoice",
                danger: true,
              })
            }
          >
            Void
          </button>
        )}
        {canDelete(status) && (
          <button
            type="button"
            className={BTN_DANGER}
            onClick={() =>
              setPending({
                kind: "confirm",
                title: `Delete draft ${doc.number}?`,
                text: "The draft is removed. Its number is never given to another document.",
                action: "delete",
                label: "Delete draft",
                danger: true,
              })
            }
          >
            Delete
          </button>
        )}
      </div>

      {pending?.kind === "confirm" && (
        <Modal title={pending.title} onClose={close}>
          <p className="text-sm text-gray-700">{pending.text}</p>
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={close} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md">
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => runConfirmed(pending.action)}
              className={`flex-1 text-white text-sm font-bold py-2.5 rounded-md disabled:opacity-50 ${pending.danger ? "bg-red-600 hover:bg-red-700" : "bg-blue-700 hover:bg-blue-800"}`}
            >
              {busy ? "Working..." : pending.label}
            </button>
          </div>
        </Modal>
      )}

      {pending?.kind === "paid" && (
        <MarkPaidModal
          doc={doc}
          busy={busy}
          error={error}
          onCancel={close}
          onConfirm={async (paidOn) => {
            const data = await post(`/api/crm/documents/invoice/${doc.id}/action`, { action: "paid", paidOn });
            if (data) {
              close();
              onChanged({ message: `${doc.number} marked paid. The lead's amount paid and payment status are updated.`, leadChanged: true });
            }
          }}
        />
      )}

      {pending?.kind === "email" && (
        <DocumentEmailModal
          doc={doc}
          onClose={close}
          onSent={() => {
            close();
            onChanged({ message: `${doc.number} emailed to the client and marked sent.`, leadChanged: true });
          }}
        />
      )}
    </>
  );
}

function MarkPaidModal({
  doc,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  doc: DocumentSummary;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (paidOn: string) => void;
}) {
  const today = ukToday(new Date());
  const [paidOn, setPaidOn] = useState(today);
  return (
    <Modal title={`Mark ${doc.number} paid`} onClose={onCancel}>
      <p className="text-sm text-gray-700 mb-3">
        {formatPence(doc.amountPence)} received. The lead&apos;s amount paid becomes the total of its paid invoices, and its
        payment status is updated.
      </p>
      <label htmlFor="paid-on" className="block text-xs font-medium text-gray-500 mb-1">
        Date received
      </label>
      <input
        id="paid-on"
        type="date"
        value={paidOn}
        max={today}
        onChange={(e) => setPaidOn(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || !paidOn}
          onClick={() => onConfirm(paidOn)}
          className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold py-2.5 rounded-md disabled:opacity-50"
        >
          {busy ? "Saving..." : "Mark paid"}
        </button>
      </div>
    </Modal>
  );
}

type EmailDraft = {
  to: string | null;
  subject: string;
  body: string;
  sender: { configured: boolean; label: string };
  attachment: string;
  blockers: string[];
};

function DocumentEmailModal({ doc, onClose, onSent }: { doc: DocumentSummary; onClose: () => void; onSent: () => void }) {
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crm/documents/${doc.kind}/${doc.id}/email`)
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(data.error ?? "Couldn't load the email.");
          return;
        }
        setDraft(data);
        setSubject(data.subject);
        setBody(data.body);
      })
      .catch(() => !cancelled && setLoadError("Couldn't reach the CRM."));
    return () => {
      cancelled = true;
    };
  }, [doc.kind, doc.id]);

  async function send() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/documents/${doc.kind}/${doc.id}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.sent ? `${data.error}` : data.error ?? "The email could not be sent.");
        return;
      }
      onSent();
    } catch {
      setError("Couldn't reach the CRM. The email may not have been sent.");
    } finally {
      setSending(false);
    }
  }

  const blocked = !draft || draft.blockers.length > 0;
  return (
    <Modal title={`Email ${DOCUMENT_TYPE_LABELS[doc.type].toLowerCase()} ${doc.number} to the client`} onClose={onClose}>
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {!draft && !loadError && <p className="text-sm text-gray-500">Loading...</p>}
      {draft && (
        <div className="space-y-3">
          <dl className="text-sm grid grid-cols-[5.5rem_1fr] gap-y-1">
            <dt className="text-gray-500">From</dt>
            <dd className={draft.sender.configured ? "text-gray-800" : "text-red-600"}>{draft.sender.label}</dd>
            <dt className="text-gray-500">To</dt>
            <dd className="text-gray-800 break-all">{draft.to ?? "No email address"}</dd>
            <dt className="text-gray-500">Attached</dt>
            <dd className="text-gray-800 break-all">{draft.attachment}</dd>
          </dl>
          {draft.blockers.length > 0 && (
            <ul className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 list-disc list-inside">
              {draft.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}
          <div>
            <label htmlFor="doc-email-subject" className="block text-xs font-medium text-gray-500 mb-1">
              Subject
            </label>
            <input
              id="doc-email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="doc-email-body" className="block text-xs font-medium text-gray-500 mb-1">
              Message
            </label>
            <textarea
              id="doc-email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">The signature is added when it is sent, as on every CRM email.</p>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md">
          Cancel
        </button>
        <button
          type="button"
          disabled={blocked || sending || !subject.trim() || !body.trim()}
          onClick={send}
          className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold py-2.5 rounded-md disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send with PDF"}
        </button>
      </div>
    </Modal>
  );
}
