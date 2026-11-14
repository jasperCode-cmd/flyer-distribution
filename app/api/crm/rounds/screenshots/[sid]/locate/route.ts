import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NO_STORE, roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { locateConfigured } from "@/lib/rounds/locate/read-labels";
import { locateScreenshot } from "@/lib/rounds/locate/service";
import { isId, MAX_LOCATE_IMAGE_BYTES, validateLocateMeta } from "@/lib/rounds/validate";

// Locate for one screenshot (POST, multipart): "image", the screenshot at
// its working size as a JPEG; "meta", JSON with the compass's turn and points
// along its traced route. Claude reads its street names and they are fitted
// to the streets in the job's area. One screenshot per request keeps each
// call well inside the time limit; the batch is run by the browser. The
// reply says where it goes, or why it needs lining up by hand, and what the
// call cost. Nothing is saved, and neither the image nor the answer is logged.

export const maxDuration = 60;

type Ctx = { params: Promise<{ sid: string }> };
const missing = () => NextResponse.json({ error: "That screenshot no longer exists." }, { status: 404 });

export async function POST(req: Request, { params }: Ctx) {
  if (!(await signedIn())) return unauthorised();
  const { sid } = await params;
  if (!isId(sid)) return missing();
  if (!locateConfigured()) return NextResponse.json({ error: "Locate isn't set up yet.", notSetUp: true }, { status: 503, headers: NO_STORE });
  if (Number(req.headers.get("content-length") ?? "0") > MAX_LOCATE_IMAGE_BYTES + 512 * 1024) return NextResponse.json({ error: "The screenshot is too large to locate." }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const image = form?.get("image");
  if (!(image instanceof Blob) || !["image/jpeg", "image/png"].includes(image.type) || image.size === 0 || image.size > MAX_LOCATE_IMAGE_BYTES) {
    return NextResponse.json({ error: "Send the screenshot as a JPEG or PNG under 3 MB." }, { status: 400 });
  }
  try {
    const shot = await prisma.roundScreenshot.findUnique({ where: { id: sid }, select: { width: true, height: true } });
    if (!shot) return missing();
    let meta: unknown = null;
    try {
      meta = JSON.parse(String(form?.get("meta") ?? ""));
    } catch {
      meta = null;
    }
    const checked = validateLocateMeta(meta, shot);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
    const outcome = await locateScreenshot(prisma, sid, { image: Buffer.from(await image.arrayBuffer()), ...checked.value });
    return NextResponse.json(outcome, { headers: NO_STORE });
  } catch (err) {
    return roundsFailure(err, "locate a screenshot");
  }
}
