import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { paymentDetailsStatus } from "@/lib/documents/bank";
import { DOCUMENT_TYPES, isInvoiceType, parseDocumentInput, type DocumentType } from "@/lib/documents/rules";
import { createInvoice, createQuote, listDocuments } from "@/lib/documents/service";
import { documentErrorResponse } from "@/lib/documents/views";

export const runtime = "nodejs";

// Quotes and invoices: every one (or one lead's), and making a new one.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const leadId = new URL(req.url).searchParams.get("leadId") ?? undefined;
  const documents = await listDocuments(prisma, leadId ? { leadId } : {});
  return NextResponse.json({ documents, bank: paymentDetailsStatus() });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  }
  const type = body?.type as DocumentType;
  if (!DOCUMENT_TYPES.includes(type)) {
    return NextResponse.json({ error: "Choose a quote or an invoice type" }, { status: 400 });
  }
  if (typeof body.leadId !== "string" || !body.leadId) {
    return NextResponse.json({ error: "Choose a lead" }, { status: 400 });
  }
  const parsed = parseDocumentInput(body, type);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    if (type === "QUOTE") {
      const quote = await createQuote(prisma, body.leadId, parsed.data);
      return NextResponse.json({ kind: "quote", ...quote }, { status: 201 });
    }
    if (!isInvoiceType(type)) throw new Error("unreachable");
    const invoice = await createInvoice(prisma, {
      leadId: body.leadId,
      type,
      data: parsed.data,
      quoteId: typeof body.quoteId === "string" ? body.quoteId : null,
    });
    return NextResponse.json({ kind: "invoice", ...invoice }, { status: 201 });
  } catch (err) {
    return documentErrorResponse(err, "save the document");
  }
}
