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
    "atRisk",
    "assignedToId",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) {
      data[field] = field === "dealValue" && body[field] !== null ? Number(body[field]) : body[field];
    }
  }

  const lead = await prisma.lead.update({
    where: { id },
    data,
  });

  return NextResponse.json({ lead });
}
