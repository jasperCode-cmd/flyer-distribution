import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { applyLeadFilters, STAGE_LABELS, SOURCE_LABELS, PRIORITY_LABELS } from "@/lib/crm-constants";

// Column headers mirror the field aliases recognized by /api/crm/import,
// so an exported file can be re-imported without remapping columns.
const HEADERS = [
  "Name",
  "Phone",
  "Email",
  "Postcode",
  "Business Name",
  "Area",
  "Deal Value",
  "Quantity",
  "Target Areas",
  "Stage",
  "Source",
  "Priority",
  "Assigned To",
];

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const params = url.searchParams;

  const leads = await prisma.lead.findMany({
    include: { assignedTo: { select: { id: true, name: true } }, tags: { include: { tag: true } } },
    orderBy: { createdAt: "desc" },
  });

  const filtered = applyLeadFilters(
    leads.map((l) => ({ ...l, tags: l.tags.map((t) => t.tag) })),
    {
      stage: params.get("stage") || undefined,
      source: params.get("source") || undefined,
      assignedToId: params.get("assignedToId") || undefined,
      priority: params.get("priority") || undefined,
      tagId: params.get("tagId") || undefined,
      atRiskOnly: params.get("atRiskOnly") === "true",
    }
  );

  const rows = filtered.map((l) =>
    [
      l.name,
      l.phone ?? "",
      l.email ?? "",
      l.postcode ?? "",
      l.businessName ?? "",
      l.addressArea ?? "",
      l.dealValue ? l.dealValue.toString() : "",
      l.leafletQuantity ?? "",
      l.targetAreas ?? "",
      STAGE_LABELS[l.stage] ?? l.stage,
      SOURCE_LABELS[l.source] ?? l.source,
      PRIORITY_LABELS[l.priority] ?? l.priority,
      l.assignedTo?.name ?? "",
    ]
      .map((v) => csvEscape(String(v)))
      .join(",")
  );

  const csv = [HEADERS.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-export.csv"`,
    },
  });
}
