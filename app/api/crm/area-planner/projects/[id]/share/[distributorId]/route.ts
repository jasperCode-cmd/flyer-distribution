import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { shareViewForDistributor } from "@/lib/area-planner/service";
import { plannerFailure } from "@/lib/area-planner/api";

// What goes on one distributor's "Download image" PNG: only their areas,
// labels and leaflet counts, the title for distributors and the date
// (lib/area-planner/share-view.ts). The browser draws the image from it.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; distributorId: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, distributorId } = await params;
  try {
    return NextResponse.json({ view: await shareViewForDistributor(prisma, id, distributorId) });
  } catch (err) {
    return plannerFailure(err, "prepare an image");
  }
}
