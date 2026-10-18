import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDocumentKind } from "@/lib/documents/rules";
import { acceptQuote, declineQuote, markDocumentSent, markInvoicePaid, voidInvoice } from "@/lib/documents/service";
import { documentErrorResponse } from "@/lib/documents/views";

export const runtime = "nodejs";

// Mark as sent (drafts sent by hand), mark accepted or declined (quotes),
// mark paid or void (invoices).
export async function POST(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { kind, id } = await params;
  if (!isDocumentKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const opts = { userId: session.user.id ?? null, now: new Date() };
  const action = body?.action;

  try {
    // Records it as sent without sending anything.
    if (action === "sent") {
      const result = await markDocumentSent(prisma, kind, id, opts);
      return NextResponse.json({ ok: true, ...result });
    }
    if (kind === "quote" && action === "accept") {
      const result = await acceptQuote(prisma, id, opts);
      return NextResponse.json({ ok: true, ...result });
    }
    if (kind === "quote" && action === "decline") {
      await declineQuote(prisma, id, opts);
      return NextResponse.json({ ok: true });
    }
    if (kind === "invoice" && action === "paid") {
      await markInvoicePaid(prisma, id, { ...opts, paidOn: typeof body.paidOn === "string" ? body.paidOn : "" });
      return NextResponse.json({ ok: true });
    }
    if (kind === "invoice" && action === "void") {
      await voidInvoice(prisma, id, opts);
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    return documentErrorResponse(err, "update the document");
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
