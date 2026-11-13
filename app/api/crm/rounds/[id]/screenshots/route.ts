import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { addScreenshots } from "@/lib/rounds/service";
import { isId, validateNewScreenshots } from "@/lib/rounds/validate";

// More screenshots for a round: their details only.

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await signedIn())) return unauthorised();
  const { id } = await params;
  if (!isId(id)) return NextResponse.json({ error: "That round no longer exists." }, { status: 404 });
  const checked = validateNewScreenshots(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    return NextResponse.json({ screenshotIds: await addScreenshots(prisma, id, checked.value) }, { status: 201 });
  } catch (err) {
    return roundsFailure(err, "add screenshots");
  }
}
