import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDocumentKind, parseDocumentInput } from "@/lib/documents/rules";
import { deleteInvoice, deleteQuote, getInvoice, getQuote, updateInvoice, updateQuote } from "@/lib/documents/service";
import { documentErrorResponse, invoiceDetail, quoteDetail } from "@/lib/documents/views";

export const runtime = "nodejs";

type Params = { params: Promise<{ kind: string; id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { kind, id } = await params;
  if (!isDocumentKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (kind === "quote") {
    const quote = await getQuote(prisma, id);
    return quote ? NextResponse.json({ document: quoteDetail(quote) }) : NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const invoice = await getInvoice(prisma, id);
  return invoice ? NextResponse.json({ document: invoiceDetail(invoice) }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

// Editing a draft.
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { kind, id } = await params;
  if (!isDocumentKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid document" }, { status: 400 });
  }
  try {
    if (kind === "quote") {
      const parsed = parseDocumentInput(body, "QUOTE");
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      await updateQuote(prisma, id, parsed.data);
    } else {
      const existing = await prisma.invoice.findUnique({ where: { id }, select: { type: true } });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const parsed = parseDocumentInput(body, existing.type);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      await updateInvoice(prisma, id, parsed.data);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return documentErrorResponse(err, "save the document");
  }
}

// Deleting a draft. Sent documents are voided or declined instead, and a
// deleted draft's number is never given out again.
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { kind, id } = await params;
  if (!isDocumentKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    if (kind === "quote") await deleteQuote(prisma, id);
    else await deleteInvoice(prisma, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return documentErrorResponse(err, "delete the draft");
  }
}
