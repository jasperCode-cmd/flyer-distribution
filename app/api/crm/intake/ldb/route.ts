import { prisma } from "@/lib/prisma";
import { findDuplicateLeads } from "@/lib/crm-data";
import { handleLdbIntake } from "@/lib/ldb-intake";
import { clearSharedCaches } from "@/lib/shared-cache";

export const runtime = "nodejs";

// Enquiries from the Leaflet Distribution Bournemouth website's server. The
// one CRM API route without a user session: it checks its shared secret
// instead (see lib/ldb-intake.ts).
export async function POST(req: Request) {
  const res = await handleLdbIntake(req, {
    db: prisma,
    secret: process.env.LDB_INTAKE_SECRET,
    findDuplicates: (email, phone) => findDuplicateLeads(email, phone),
  });
  // The bell's shared copy, so it shows at the next ask (lib/shared-cache.ts).
  if (res.ok) clearSharedCaches();
  return res;
}
