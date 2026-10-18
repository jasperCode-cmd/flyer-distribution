import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isBusiness } from "@/lib/business";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      assignedTo: { select: { id: true, name: true } },
      job: true,
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ lead });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const allowedFields = [
    "name",
    "phone",
    "email",
    "postcode",
    "businessName",
    "addressArea",
    "dealValue",
    "leafletQuantity",
    "targetAreas",
    "printingIncluded",
    "designIncluded",
    "source",
    "priority",
    "atRisk",
    "assignedToId",
    "lostReason",
    "lostReasonNote",
    "reviewStatus",
    "paymentStatus",
    "amountPaid",
    "business",
  ] as const;

  // Both decimal columns arrive as strings from the form inputs and have to
  // be coerced; an empty or unparseable value clears the column rather than
  // writing NaN.
  const DECIMAL_FIELDS = new Set(["dealValue", "amountPaid"]);

  if ("business" in body && !isBusiness(body.business)) {
    return NextResponse.json({ error: "Choose FDH or Bournemouth" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (!(field in body)) continue;
    const value = body[field];
    if (DECIMAL_FIELDS.has(field)) {
      if (value === null || value === "") {
        data[field] = null;
      } else {
        const n = Number(value);
        data[field] = Number.isNaN(n) ? null : n;
      }
    } else {
      data[field] = value;
    }
  }

  const lead = await prisma.lead.update({
    where: { id },
    data,
  });

  return NextResponse.json({ lead });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      job: { select: { id: true } },
      _count: { select: { quotes: true, invoices: true } },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Quotes and invoices are financial records with numbers that are never
  // reused, so a lead that has any is kept.
  if (lead._count.quotes > 0 || lead._count.invoices > 0) {
    return NextResponse.json(
      { error: "This lead has quotes or invoices, so it can't be deleted. Scrap it instead." },
      { status: 409 }
    );
  }

  // A Job represents real completed work: deleting the lead would silently
  // cascade the Job away too (the FK is ON DELETE CASCADE), so that's
  // blocked here rather than left to the database to do quietly.
  if (lead.job) {
    return NextResponse.json(
      { error: "This lead has a Job on record and can't be deleted. Remove the Job first if you're sure." },
      { status: 409 }
    );
  }

  await prisma.lead.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
