import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  ] as const;

  // Both decimal columns arrive as strings from the form inputs and have to
  // be coerced; an empty or unparseable value clears the column rather than
  // writing NaN.
  const DECIMAL_FIELDS = new Set(["dealValue", "amountPaid"]);

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
