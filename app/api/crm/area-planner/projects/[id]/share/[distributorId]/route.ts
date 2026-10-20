import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { shareViewForDistributor } from "@/lib/area-planner/service";
import { DATABASE_LIMIT_MS, plannerFailure, timeLeft, timedJson, within } from "@/lib/area-planner/api";
import { ServerTiming } from "@/lib/area-planner/timing";

// What goes on one distributor's "Download image" PNG: only their areas,
// labels and leaflet counts, the title for distributors and the date
// (lib/area-planner/share-view.ts). The browser draws the image from it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; distributorId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  const { id, distributorId } = await params;
  try {
    const view = await timing.step("db-project", () => within(timeLeft(timing, DATABASE_LIMIT_MS), "prepare an image", shareViewForDistributor(prisma, id, distributorId)));
    return timedJson(timing, "prepare an image", { view });
  } catch (err) {
    return plannerFailure(err, "prepare an image");
  }
}
