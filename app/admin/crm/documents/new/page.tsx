import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { paymentDetailsStatus } from "@/lib/documents/bank";
import { brandingFor } from "@/lib/documents/branding";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents/rules";
import { newDocumentPrefill } from "@/lib/documents/service";
import DocumentBuilder from "@/components/crm/DocumentBuilder";

export const dynamic = "force-dynamic";

// A new quote or invoice for a lead, prefilled from it.
export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ lead?: string; type?: string }> }) {
  const { lead: leadId, type: rawType } = await searchParams;
  const type = (DOCUMENT_TYPES as readonly string[]).includes(rawType ?? "") ? (rawType as DocumentType) : null;
  if (!leadId || !type) notFound();
  const prefill = await newDocumentPrefill(prisma, leadId, type, new Date());
  if (!prefill) notFound();
  if (prefill.lead.scrapped) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <p className="text-sm text-gray-700">
          {prefill.lead.name} is scrapped, so no quotes or invoices can be made for them.{" "}
          <Link href={`/admin/crm/leads/${prefill.lead.id}`} className="text-blue-700 underline">
            Back to the lead
          </Link>
        </p>
      </div>
    );
  }
  const branding = brandingFor(prefill.lead.business);
  return (
    <DocumentBuilder
      initial={{
        id: null,
        kind: type === "QUOTE" ? "quote" : "invoice",
        number: null,
        type,
        status: "DRAFT",
        business: prefill.lead.business,
        lead: { id: prefill.lead.id, name: prefill.lead.name },
        quote: prefill.quote,
        client: prefill.client,
        lines: prefill.lines,
        issueDate: prefill.issueDate,
        dueDate: prefill.dueDate,
        notes: "",
        deductions: prefill.deposits,
        totalPence: 0,
        amountDuePence: 0,
      }}
      validDays={branding.quoteValidDays}
      balanceDays={branding.balanceDueDays}
      bank={paymentDetailsStatus()}
    />
  );
}
