"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPence } from "@/lib/money";
import { STATUS_LABELS, formatLongDate, type DocumentStatus } from "@/lib/documents/rules";
import type { DocumentDetail } from "@/lib/documents/views";
import BusinessBadge from "./BusinessBadge";
import DocumentActions, { DocumentStatusPill, RecordedOutsideLabel, documentHref } from "./DocumentActions";

// The page of a deposit invoice issued and paid outside the CRM: what was
// recorded, the balance invoices that deduct it, and Remove record. There is
// nothing to edit, download or send.

export default function RecordedDepositView({ doc }: { doc: DocumentDetail }) {
  const router = useRouter();
  const leadHref = `/admin/crm/leads/${doc.lead.id}#quotes-and-invoices`;
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <Link href={leadHref} className="text-xs text-blue-700 hover:underline">
          Back to {doc.lead.name}
        </Link>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="text-xl font-bold text-blue-900">Deposit invoice {doc.number}</h1>
          <DocumentStatusPill status={doc.status} />
          <RecordedOutsideLabel />
          <BusinessBadge business={doc.business} />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          For {doc.lead.name}. Issued and paid outside the CRM and recorded here so balance invoices deduct it. The CRM has no PDF of it
          and doesn&apos;t email it.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
        <dl className="text-sm grid grid-cols-[8rem_1fr] gap-y-1.5">
          <dt className="text-gray-500">Amount paid</dt>
          <dd className="text-gray-900 font-semibold tabular-nums">{formatPence(doc.amountDuePence)}</dd>
          <dt className="text-gray-500">Date issued</dt>
          <dd className="text-gray-900">{formatLongDate(doc.issueDate)}</dd>
          <dt className="text-gray-500">Date paid</dt>
          <dd className="text-gray-900">{doc.paidAt ? formatLongDate(doc.paidAt) : "-"}</dd>
          <dt className="text-gray-500">Deducted on</dt>
          <dd className="text-gray-900">
            {doc.deductedBy.length === 0
              ? "No balance invoice yet"
              : doc.deductedBy.map((b, i) => (
                  <span key={b.id}>
                    {i > 0 && ", "}
                    <Link href={documentHref({ kind: "invoice", id: b.id })} className="text-blue-700 hover:underline">
                      {b.number}
                    </Link>{" "}
                    <span className="text-gray-500">({STATUS_LABELS[b.status as DocumentStatus] ?? b.status})</span>
                  </span>
                ))}
          </dd>
        </dl>
        <div className="mt-4 border-t border-gray-100 pt-3">
          <DocumentActions
            doc={{
              kind: "invoice",
              id: doc.id,
              number: doc.number,
              type: doc.type,
              status: doc.status,
              business: doc.business,
              totalPence: doc.totalPence,
              amountPence: doc.amountDuePence,
              issuedOutsideCrm: true,
            }}
            bankReady
            showOpen={false}
            onChanged={(change) => {
              if (change.deleted) router.push(leadHref);
              else router.refresh();
            }}
          />
        </div>
      </div>
    </div>
  );
}
