import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJson, roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { deleteScreenshot, saveScreenshotWork } from "@/lib/rounds/service";
import { screenshotStorage } from "@/lib/rounds/storage";
import { isId, validateScreenshotWork } from "@/lib/rounds/validate";

// A screenshot's crop, alignment points, traced route and start and end;
// or removing it from its round.

type Ctx = { params: Promise<{ sid: string }> };
const gone = () => NextResponse.json({ error: "That screenshot no longer exists." }, { status: 404 });

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await signedIn())) return unauthorised();
  const { sid } = await params;
  if (!isId(sid)) return gone();
  try {
    const size = await prisma.roundScreenshot.findUnique({ where: { id: sid }, select: { width: true, height: true } });
    if (!size) return gone();
    const checked = validateScreenshotWork(await readJson(req), size);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    return NextResponse.json(await saveScreenshotWork(prisma, sid, checked.value));
  } catch (err) {
    return roundsFailure(err, "save a screenshot");
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await signedIn())) return unauthorised();
  const { sid } = await params;
  if (!isId(sid)) return gone();
  try {
    await deleteScreenshot(prisma, screenshotStorage(), sid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return roundsFailure(err, "remove a screenshot");
  }
}
