import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_FIELDS = [
  "printStatus",
  "designStatus",
  "distributorName",
  "campaignStartDate",
  "completionDate",
  "deliveryConfirmed",
  "deliveryProofNote",
  "status",
] as const;

const DATE_FIELDS = new Set(["campaignStartDate", "completionDate"]);

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

  const data: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      const value = body[field];
      data[field] = DATE_FIELDS.has(field) && value ? new Date(value) : value;
    }
  }

  const job = await prisma.job.update({ where: { id }, data });
  return NextResponse.json({ job });
}
