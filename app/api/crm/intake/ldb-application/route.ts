import { prisma } from "@/lib/prisma";
import { handleLdbApplicationIntake } from "@/lib/ldb-application-intake";

export const runtime = "nodejs";

// Distributor applications from the Leaflet Distribution Bournemouth
// website's server. Like the LDB enquiry intake, it has no user session: it
// checks its shared secret instead (see lib/ldb-application-intake.ts).
export async function POST(req: Request) {
  return handleLdbApplicationIntake(req, { db: prisma, secret: process.env.LDB_INTAKE_SECRET });
}
