import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NO_STORE, readJson, roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { clientTrimM, setClientTrimM } from "@/lib/rounds/service";
import { validateTrim } from "@/lib/rounds/validate";

// The privacy trim: how much of each route's start and end clients never see.

export async function GET() {
  if (!(await signedIn())) return unauthorised();
  try {
    return NextResponse.json({ trimM: await clientTrimM(prisma) }, { headers: NO_STORE });
  } catch (err) {
    return roundsFailure(err, "load the trim setting");
  }
}

export async function PUT(req: Request) {
  if (!(await signedIn())) return unauthorised();
  const checked = validateTrim(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    await setClientTrimM(prisma, checked.value);
    return NextResponse.json({ trimM: checked.value });
  } catch (err) {
    return roundsFailure(err, "save the trim setting");
  }
}
