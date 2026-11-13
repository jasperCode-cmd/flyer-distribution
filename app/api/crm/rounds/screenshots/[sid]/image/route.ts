import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { attachScreenshotFile, openScreenshotFile } from "@/lib/rounds/service";
import { MAX_FILE_BYTES, screenshotStorage } from "@/lib/rounds/storage";
import { isId } from "@/lib/rounds/validate";

// A stored screenshot, for the CRM only (file storage is private), and
// attaching one once storage is switched on. Not found while storage is off.

type Ctx = { params: Promise<{ sid: string }> };
const missing = () => NextResponse.json({ error: "Screenshot not stored." }, { status: 404 });

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await signedIn())) return unauthorised();
  const { sid } = await params;
  if (!isId(sid)) return missing();
  try {
    const file = await openScreenshotFile(prisma, screenshotStorage(), sid);
    if (!file) return missing();
    return new Response(file.stream, {
      headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
    });
  } catch (err) {
    return roundsFailure(err, "open a screenshot");
  }
}

export async function PUT(req: Request, { params }: Ctx) {
  if (!(await signedIn())) return unauthorised();
  const { sid } = await params;
  if (!isId(sid)) return missing();
  const length = Number(req.headers.get("content-length") ?? "0");
  if (length > MAX_FILE_BYTES) return NextResponse.json({ error: "The image must be under 3 MB." }, { status: 413 });
  const sha = req.headers.get("x-source-sha256");
  try {
    const body = Buffer.from(await req.arrayBuffer());
    await attachScreenshotFile(prisma, screenshotStorage(), sid, { body, sha256: sha && /^[0-9a-f]{64}$/.test(sha) ? sha : null });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return roundsFailure(err, "attach a screenshot");
  }
}
