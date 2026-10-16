import { prisma } from "@/lib/prisma";
import { findDuplicateLeads } from "@/lib/crm-data";
import { handleLdbIntake } from "@/lib/ldb-intake";

export const runtime = "nodejs";

// Enquiries from the Leaflet Distribution Bournemouth website's server. The
// one CRM API route without a user session: it checks its shared secret
// instead (see lib/ldb-intake.ts).
export async function POST(req: Request) {
  return handleLdbIntake(req, {
    db: prisma,
    secret: process.env.LDB_INTAKE_SECRET,
    findDuplicates: (email, phone) => findDuplicateLeads(email, phone),
  });
}
