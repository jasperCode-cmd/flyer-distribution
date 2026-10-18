import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { paymentDetailsStatus } from "@/lib/documents/bank";
import { brandingFor } from "@/lib/documents/branding";
import { isDocumentKind } from "@/lib/documents/rules";
import { getInvoice, getQuote } from "@/lib/documents/service";
import { invoiceDetail, quoteDetail } from "@/lib/documents/views";
import DocumentBuilder from "@/components/crm/DocumentBuilder";

export const dynamic = "force-dynamic";

// One quote or invoice: editable while a draft, otherwise shown with its actions.
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { kind, id } = await params;
  const { saved } = await searchParams;
  if (!isDocumentKind(kind)) notFound();
  const record = kind === "quote" ? await getQuote(prisma, id) : await getInvoice(prisma, id);
  if (!record) notFound();
  const doc = kind === "quote" ? quoteDetail(record as NonNullable<Awaited<ReturnType<typeof getQuote>>>) : invoiceDetail(record as NonNullable<Awaited<ReturnType<typeof getInvoice>>>);
  const branding = brandingFor(doc.business);
  return (
    <DocumentBuilder
      key={doc.id}
      initial={{
        id: doc.id,
        kind: doc.kind,
        number: doc.number,
        type: doc.type,
        status: doc.status,
        business: doc.business,
        lead: { id: doc.lead.id, name: doc.lead.name },
        quote: doc.quote,
        client: doc.client,
        lines: doc.lines,
        issueDate: doc.issueDate,
        dueDate: doc.dueDate,
        notes: doc.notes,
        deductions: doc.deductions,
        totalPence: doc.totalPence,
        amountDuePence: doc.amountDuePence,
      }}
      validDays={branding.quoteValidDays}
      balanceDays={branding.balanceDueDays}
      bank={paymentDetailsStatus()}
      notice={saved === "1" ? `Draft ${doc.number} saved. Download it or email it to the client when it is ready.` : undefined}
    />
  );
}
