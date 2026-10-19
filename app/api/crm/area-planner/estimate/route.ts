import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { estimateHouseholds } from "@/lib/area-planner/data";
import { circleGeometry } from "@/lib/area-planner/geometry";
import { validateNewArea } from "@/lib/area-planner/validate";
import { readJson } from "@/lib/area-planner/api";

// A live household estimate while a shape is drawn or resized, before it is
// saved. Nothing is stored. Null when the household data isn't installed.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const checked = validateNewArea(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const geometry = checked.area.kind === "CIRCLE" ? circleGeometry(checked.area.centre, checked.area.radiusM) : checked.area.geometry;
  return NextResponse.json({ households: await estimateHouseholds(geometry) });
}
