import { findLeadsForAddresses, normalizeEmail, type InboxLeadMatch, type InboxLeadsPrisma } from "./inbox-leads";
import type { CrmRecordMatches } from "./inbox-categories";

// Matches inbox addresses to CRM records: leads (the existing rules),
// distributors and distributor applicants. Case-insensitive, exact addresses
// only, one query per record type for a whole batch of threads.

type EmailWhere = { OR: { email: { equals: string; mode: "insensitive" } }[] };

export type InboxCrmPrisma = InboxLeadsPrisma & {
  distributor: {
    findMany(args: {
      where: EmailWhere;
      select: { id: true; name: true; email: true; active: true };
    }): Promise<{ id: string; name: string; email: string | null; active: boolean }[]>;
  };
  distributorApplication: {
    findMany(args: {
      where: EmailWhere;
      select: { id: true; fullName: true; email: true; receivedAt: true };
      orderBy: { receivedAt: "desc" };
    }): Promise<{ id: string; fullName: string; email: string | null; receivedAt: Date }[]>;
  };
};

export type CrmLookups = {
  leads: Map<string, InboxLeadMatch>;
  distributors: Map<string, { id: string; name: string }>;
  applicants: Map<string, { id: string; fullName: string }>;
};

export async function lookupCrm(prismaClient: InboxCrmPrisma, addresses: string[]): Promise<CrmLookups> {
  const unique = [...new Set(addresses.map(normalizeEmail).filter(Boolean))];
  if (unique.length === 0) return { leads: new Map(), distributors: new Map(), applicants: new Map() };
  const where = { OR: unique.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })) };

  const [leads, distributorRows, applicationRows] = await Promise.all([
    findLeadsForAddresses(prismaClient, unique),
    prismaClient.distributor.findMany({ where, select: { id: true, name: true, email: true, active: true } }),
    prismaClient.distributorApplication.findMany({
      where,
      select: { id: true, fullName: true, email: true, receivedAt: true },
      orderBy: { receivedAt: "desc" },
    }),
  ]);

  // An active distributor wins over a retired one with the same address.
  const distributors = new Map<string, { id: string; name: string }>();
  for (const d of [...distributorRows].sort((a, b) => Number(b.active) - Number(a.active))) {
    const key = normalizeEmail(d.email);
    if (key && !distributors.has(key)) distributors.set(key, { id: d.id, name: d.name });
  }
  // The newest application for an address (rows arrive newest first).
  const applicants = new Map<string, { id: string; fullName: string }>();
  for (const a of applicationRows) {
    const key = normalizeEmail(a.email);
    if (key && !applicants.has(key)) applicants.set(key, { id: a.id, fullName: a.fullName });
  }
  return { leads, distributors, applicants };
}

// Reply-To first (a form notification's Reply-To is the person who filled
// the form in), then From, for each kind of record.
export function crmMatchesFor(
  lookups: CrmLookups,
  addresses: { replyTo: string | null | undefined; from: string | null | undefined }
): CrmRecordMatches {
  const keys = [normalizeEmail(addresses.replyTo), normalizeEmail(addresses.from)].filter(Boolean);
  const first = <T>(map: Map<string, T>) => keys.map((k) => map.get(k)).find((v) => v !== undefined) ?? null;
  return { lead: first(lookups.leads), distributor: first(lookups.distributors), applicant: first(lookups.applicants) };
}
