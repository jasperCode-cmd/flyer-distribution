import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  BULK_MOVE_MAX,
  bulkOrder,
  moveApplicationsToDistributors,
  planBulkMove,
  readBulkIds,
  type BulkOutcome,
} from "@/lib/application-bulk";

// "Move to distributors" for a selection on the Applications page.
//   { action: "preview", ids }                  sorts them into new, matched
//                                               and already linked; writes nothing
//   { action: "move", ids, confirmed: true }    does it, one at a time
// Only the second ever writes, and only with confirmed: true, which the page
// sends from the confirmation summary's button.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ids = readBulkIds(body?.ids);
  if (!ids) {
    return NextResponse.json({ error: `Select between 1 and ${BULK_MOVE_MAX} applications.` }, { status: 400 });
  }
  const action = body?.action;
  if (action !== "preview" && action !== "move") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (action === "move" && body?.confirmed !== true) {
    return NextResponse.json({ error: "Confirm the summary first." }, { status: 400 });
  }

  const apps = bulkOrder(
    await prisma.distributorApplication.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        receivedAt: true,
        distributor: { select: { id: true, name: true } },
      },
    })
  );
  const found = new Set(apps.map((a) => a.id));
  const missing = ids.filter((id) => !found.has(id));

  if (action === "preview") {
    const distributors = await prisma.distributor.findMany({
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { createdAt: "asc" },
    });
    const plan = planBulkMove(apps, distributors);
    for (const id of missing) {
      plan.cannot.push({ id, fullName: "Unknown application", reason: "Not found. It may have been deleted." });
    }
    return NextResponse.json({ plan });
  }

  const results: BulkOutcome[] = await moveApplicationsToDistributors(
    prisma,
    apps.map((a) => a.id),
    (id, err) => console.error(`Bulk move: application ${id} failed:`, err)
  );
  for (const id of missing) {
    results.push({ id, fullName: "", result: "failed", reason: "Not found. It may have been deleted." });
  }
  return NextResponse.json({ results });
}
