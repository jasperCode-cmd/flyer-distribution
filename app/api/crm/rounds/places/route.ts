import { NextResponse } from "next/server";
import { roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { searchPlaces } from "@/lib/rounds/places";

// Place search for the alignment map, from our own postcode and town data.
// No database.

export async function GET(req: Request) {
  if (!(await signedIn())) return unauthorised();
  const q = (new URL(req.url).searchParams.get("q") ?? "").slice(0, 60);
  try {
    return NextResponse.json({ places: await searchPlaces(q) }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch (err) {
    return roundsFailure(err, "search places");
  }
}
