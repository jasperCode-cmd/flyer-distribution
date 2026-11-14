import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NO_STORE, readJson, roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { addScreenshots, saveScreenshotsWork } from "@/lib/rounds/service";
import { isId, validateNewScreenshots, validateScreenshotWork, validateWorkBatch, type ScreenshotWork } from "@/lib/rounds/validate";

// More screenshots for a round: their details only (POST). Several
// screenshots' work saved together, as when accepting automatic line-ups
// (PATCH): every one checked, all saved at once, the round's figures worked
// out once.

type Ctx = { params: Promise<{ id: string }> };
const gone = () => NextResponse.json({ error: "That round no longer exists." }, { status: 404 });

export async function POST(req: Request, { params }: Ctx) {
  if (!(await signedIn())) return unauthorised();
  const { id } = await params;
  if (!isId(id)) return gone();
  const checked = validateNewScreenshots(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    return NextResponse.json({ screenshotIds: await addScreenshots(prisma, id, checked.value) }, { status: 201 });
  } catch (err) {
    return roundsFailure(err, "add screenshots");
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await signedIn())) return unauthorised();
  const { id } = await params;
  if (!isId(id)) return gone();
  const batch = validateWorkBatch(await readJson(req));
  if (!batch.ok) return NextResponse.json({ error: batch.error }, { status: 400 });
  try {
    const sizes = new Map(
      (await prisma.roundScreenshot.findMany({ where: { roundId: id, id: { in: batch.value.map((i) => i.id) } }, select: { id: true, width: true, height: true } })).map((s) => [s.id, s])
    );
    const items: { id: string; work: ScreenshotWork }[] = [];
    for (const item of batch.value) {
      const size = sizes.get(item.id);
      if (!size) return NextResponse.json({ error: "A screenshot in the list isn't in this round." }, { status: 404 });
      const checked = validateScreenshotWork(item.body, size);
      if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
      items.push({ id: item.id, work: checked.value });
    }
    return NextResponse.json({ shots: await saveScreenshotsWork(prisma, id, items) }, { headers: NO_STORE });
  } catch (err) {
    return roundsFailure(err, "save screenshots");
  }
}
