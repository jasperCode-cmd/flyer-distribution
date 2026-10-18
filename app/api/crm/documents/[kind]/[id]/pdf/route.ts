import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDocumentKind } from "@/lib/documents/rules";
import { renderStoredDocument } from "@/lib/documents/output";

export const runtime = "nodejs";

// The document's PDF. An invoice needs the bank details set up first.
// ?view=1 opens it in the browser instead of downloading it.
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { kind, id } = await params;
  if (!isDocumentKind(kind)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let rendered;
  try {
    rendered = await renderStoredDocument(prisma, kind, id);
  } catch (err) {
    console.error("Document PDF failed:", err instanceof Error ? err.name : "unknown error");
    return NextResponse.json({ error: "Could not make the PDF. Please try again." }, { status: 500 });
  }
  if (!rendered.ok) return NextResponse.json({ error: rendered.error }, { status: rendered.status });

  const view = new URL(req.url).searchParams.get("view") === "1";
  return new NextResponse(Buffer.from(rendered.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${view ? "inline" : "attachment"}; filename="${rendered.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
