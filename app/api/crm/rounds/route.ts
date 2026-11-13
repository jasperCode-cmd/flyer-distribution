import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NO_STORE, readJson, roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { createRound, listRounds } from "@/lib/rounds/service";
import { parseFilters, validateNewRound } from "@/lib/rounds/validate";

// The rounds list (one query, newest first, filtered), and making a round
// with its screenshots' details (never the images).

export async function GET(req: Request) {
  if (!(await signedIn())) return unauthorised();
  try {
    const result = await listRounds(prisma, parseFilters(new URL(req.url).searchParams));
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (err) {
    return roundsFailure(err, "list rounds");
  }
}

export async function POST(req: Request) {
  if (!(await signedIn())) return unauthorised();
  const checked = validateNewRound(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    return NextResponse.json(await createRound(prisma, checked.value), { status: 201 });
  } catch (err) {
    return roundsFailure(err, "add a round");
  }
}
