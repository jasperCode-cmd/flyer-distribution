import { prisma } from "@/lib/prisma";
import { reportScreenshotFile } from "@/lib/rounds/service";
import { screenshotStorage } from "@/lib/rounds/storage";

// A stored screenshot on a client's report: only for a live link, and only
// one of the rounds that link covers. Anything else is not found.

export async function GET(_req: Request, { params }: { params: Promise<{ token: string; sid: string }> }) {
  const { token, sid } = await params;
  const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  if (!/^[a-z0-9]{10,40}$/i.test(sid)) return notFound();
  try {
    const file = await reportScreenshotFile(prisma, screenshotStorage(), token, sid);
    if (!file) return notFound();
    return new Response(file.stream, {
      headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=3600", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return notFound();
  }
}
