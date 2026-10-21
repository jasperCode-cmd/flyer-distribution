import { prisma } from "@/lib/prisma";
import { handleLdbApplicationIntake } from "@/lib/ldb-application-intake";
import { clearSharedCaches } from "@/lib/shared-cache";

export const runtime = "nodejs";

// Distributor applications from the Leaflet Distribution Bournemouth
// website's server. Like the LDB enquiry intake, it has no user session: it
// checks its shared secret instead (see lib/ldb-application-intake.ts).
export async function POST(req: Request) {
  const res = await handleLdbApplicationIntake(req, { db: prisma, secret: process.env.LDB_INTAKE_SECRET });
  // The bell's shared copy, so it shows at the next ask (lib/shared-cache.ts).
  if (res.ok) clearSharedCaches();
  return res;
}
