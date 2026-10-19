import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createShareLink, loadProject, revokeShareLinks } from "@/lib/area-planner/service";
import { deliveryPath } from "@/lib/area-planner/share-links";
import { plannerFailure } from "@/lib/area-planner/api";

// A distributor's private link for one project. POST makes a new one
// (revoking any earlier link) and is the only time the link is ever shown;
// DELETE revokes it at once.

export async function POST(req: Request, { params }: { params: Promise<{ id: string; distributorId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, distributorId } = await params;
  try {
    const token = await createShareLink(prisma, id, distributorId);
    const url = new URL(deliveryPath(token), new URL(req.url).origin).toString();
    return NextResponse.json({ url, project: await loadProject(prisma, id) }, { status: 201 });
  } catch (err) {
    return plannerFailure(err, "make a private link");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; distributorId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, distributorId } = await params;
  try {
    await revokeShareLinks(prisma, id, distributorId);
    return NextResponse.json({ project: await loadProject(prisma, id) });
  } catch (err) {
    return plannerFailure(err, "revoke a private link");
  }
}
