import { prisma } from "@/lib/prisma";
import { handleApplicationRequest } from "@/lib/application-endpoint";
import { createRateLimiter } from "@/lib/rate-limit";

// Called by the public Work With Us form after Web3Forms has accepted the
// application, alongside (never instead of) the email. Public by design, so
// it checks no session; the form ignores whatever this returns.
const allow = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

export async function POST(req: Request) {
  return handleApplicationRequest(req, { db: prisma, allow });
}
