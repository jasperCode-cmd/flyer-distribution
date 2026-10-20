import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { estimateHouseholds } from "@/lib/area-planner/data";
import { circleGeometry } from "@/lib/area-planner/geometry";
import { validateNewArea } from "@/lib/area-planner/validate";
import { plannerFailure, readJson, timeLeft, timedJson, within } from "@/lib/area-planner/api";
import { ServerTiming } from "@/lib/area-planner/timing";

// A live household estimate while a shape is drawn or resized, before it is
// saved. Nothing is stored. Null when the household data isn't installed.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const timing = new ServerTiming();
  const checked = validateNewArea(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  const geometry = checked.area.kind === "CIRCLE" ? circleGeometry(checked.area.centre, checked.area.radiusM) : checked.area.geometry;
  try {
    const households = await within(timeLeft(timing), "estimate a shape's homes", estimateHouseholds(geometry, timing));
    return timedJson(timing, "estimate", { households });
  } catch (err) {
    return plannerFailure(err, "estimate a shape's homes");
  }
}
