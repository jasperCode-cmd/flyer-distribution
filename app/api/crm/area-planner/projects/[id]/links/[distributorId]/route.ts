import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createShareLink, projectLinks, revokeShareLinks } from "@/lib/area-planner/service";
import { deliveryPath } from "@/lib/area-planner/share-links";
import { DATABASE_LIMIT_MS, plannerFailure, timeLeft, timedJson, within } from "@/lib/area-planner/api";
import { ServerTiming } from "@/lib/area-planner/timing";

// A distributor's private link for one project. POST makes a new one
// (revoking any earlier link) and is the only time the link is ever shown;
// DELETE revokes it at once. Both reply with the project's links.

export async function POST(req: Request, { params }: { params: Promise<{ id: string; distributorId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  const { id, distributorId } = await params;
  try {
    const token = await timing.step("save", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "make a private link", createShareLink(prisma, id, distributorId)));
    const url = new URL(deliveryPath(token), new URL(req.url).origin).toString();
    const links = await timing.step("db-project", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "read the links", projectLinks(prisma, id)));
    return timedJson(timing, "make a link", { url, links }, { status: 201 });
  } catch (err) {
    return plannerFailure(err, "make a private link");
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; distributorId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  const { id, distributorId } = await params;
  try {
    await timing.step("save", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "revoke a private link", revokeShareLinks(prisma, id, distributorId)));
    const links = await timing.step("db-project", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "read the links", projectLinks(prisma, id)));
    return timedJson(timing, "revoke a link", { links });
  } catch (err) {
    return plannerFailure(err, "revoke a private link");
  }
}
