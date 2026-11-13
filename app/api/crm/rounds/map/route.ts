import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NO_STORE, roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { mapRounds } from "@/lib/rounds/service";
import { parseFilters } from "@/lib/rounds/validate";

// The Area Planner's Rounds layer: traced rounds for the filters, read only
// when the layer is switched on or its filters change (one query).

export async function GET(req: Request) {
  if (!(await signedIn())) return unauthorised();
  try {
    return NextResponse.json(await mapRounds(prisma, parseFilters(new URL(req.url).searchParams)), { headers: NO_STORE });
  } catch (err) {
    return roundsFailure(err, "load the rounds layer");
  }
}
