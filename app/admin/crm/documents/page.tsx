import { prisma } from "@/lib/prisma";
import { paymentDetailsStatus } from "@/lib/documents/bank";
import { ukToday } from "@/lib/documents/rules";
import { listDocuments } from "@/lib/documents/service";
import DocumentsView from "@/components/crm/DocumentsView";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const documents = await listDocuments(prisma);
  return <DocumentsView documents={documents} today={ukToday(new Date())} bank={paymentDetailsStatus()} />;
}
