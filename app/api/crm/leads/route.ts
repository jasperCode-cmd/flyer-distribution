import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { leadWithLastActivityArgs, findDuplicateLeads } from "@/lib/crm-data";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leads = await prisma.lead.findMany({
    include: leadWithLastActivityArgs(),
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ leads });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const {
    name,
    phone,
    email,
    postcode,
    businessName,
    addressArea,
    dealValue,
    leafletQuantity,
    targetAreas,
    printingIncluded,
    designIncluded,
    source,
    priority,
    assignedToId,
  } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Don't block creation — just surface what's already on file so staff
  // can decide whether this is really a new lead.
  const duplicates = await findDuplicateLeads(email, phone);

  const lead = await prisma.lead.create({
    data: {
      name,
      phone: phone || null,
      email: email || null,
      postcode: postcode || null,
      businessName: businessName || null,
      addressArea: addressArea || null,
      dealValue: dealValue ? Number(dealValue) : null,
      leafletQuantity: leafletQuantity || null,
      targetAreas: targetAreas || null,
      printingIncluded: Boolean(printingIncluded),
      designIncluded: Boolean(designIncluded),
      source: source || "OTHER",
      priority: priority || "MEDIUM",
      assignedToId: assignedToId || null,
    },
  });

  return NextResponse.json({ lead, duplicates }, { status: 201 });
}
