import { prisma } from "@/lib/prisma";
import { handleApplicationRequest } from "@/lib/application-endpoint";
import { createRateLimiter } from "@/lib/rate-limit";
import { clearSharedCaches } from "@/lib/shared-cache";

// Called by the public Work With Us form after Web3Forms has accepted the
// application, alongside (never instead of) the email. Public by design, so
// it checks no session; the form ignores whatever this returns.
const allow = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

export async function POST(req: Request) {
  const res = await handleApplicationRequest(req, { db: prisma, allow });
  // The bell's shared copy, so it shows at the next ask (lib/shared-cache.ts).
  if (res.ok) clearSharedCaches();
  return res;
}
