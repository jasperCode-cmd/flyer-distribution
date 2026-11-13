import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { createReportLink } from "@/lib/rounds/service";
import { validateNewLink } from "@/lib/rounds/validate";
import { reportPath } from "@/lib/rounds/report-links";

// A client's report link, for one round or one lead's rounds. The token is
// only ever sent here, once; only its hash is kept.

export async function POST(req: Request) {
  if (!(await signedIn())) return unauthorised();
  const today = new Date().toISOString().slice(0, 10);
  const checked = validateNewLink(await readJson(req), today);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    const { token, link } = await createReportLink(prisma, checked.value);
    return NextResponse.json({ path: reportPath(token), link }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return roundsFailure(err, "make a report link");
  }
}
