import type { Business } from "./business";

export type InboxLeadCandidate = {
  id: string;
  name: string;
  stage: string;
  email: string | null;
  scrapped: boolean;
  createdAt: Date;
  // Missing means FDH, as every lead from before businesses existed is.
  business?: Business;
};

export type InboxLeadMatch = {
  id: string;
  name: string;
  stage: string;
  email: string;
  scrapped: boolean;
  business: Business;
  // Every business with a lead on this address, so a caller can tell when
  // one address belongs to both.
  businesses: Business[];
};

// Which leads may match: only one business's (a Bournemouth conversation
// only ever matches an LDB lead), or any, preferring one business's.
export type LeadMatchOptions = { only?: Business; prefer?: Business };

export function normalizeEmail(address: string | null | undefined): string {
  return (address ?? "").trim().toLowerCase();
}

// Case-insensitive, exact-address match of each inbox address to a lead.
// When several leads share an address, the preferred business wins, then a
// live lead over a scrapped one, then the most recently created. Pure, so it
// is unit tested without a DB.
export function matchLeadsByEmail(
  addresses: string[],
  leads: InboxLeadCandidate[],
  options: LeadMatchOptions = {}
): Map<string, InboxLeadMatch> {
  const businessOf = (lead: InboxLeadCandidate): Business => lead.business ?? "FDH";
  const best = new Map<string, InboxLeadCandidate>();
  const businesses = new Map<string, Set<Business>>();
  for (const lead of leads) {
    const key = normalizeEmail(lead.email);
    if (!key) continue;
    if (!businesses.has(key)) businesses.set(key, new Set());
    businesses.get(key)!.add(businessOf(lead));
    if (options.only && businessOf(lead) !== options.only) continue;
    const current = best.get(key);
    const preferred = (l: InboxLeadCandidate) => (options.prefer && businessOf(l) === options.prefer ? 1 : 0);
    if (
      !current ||
      preferred(lead) > preferred(current) ||
      (preferred(lead) === preferred(current) &&
        ((current.scrapped && !lead.scrapped) ||
          (current.scrapped === lead.scrapped && lead.createdAt.getTime() > current.createdAt.getTime())))
    ) {
      best.set(key, lead);
    }
  }

  const result = new Map<string, InboxLeadMatch>();
  for (const address of addresses) {
    const key = normalizeEmail(address);
    const lead = key ? best.get(key) : undefined;
    if (lead && lead.email) {
      result.set(key, {
        id: lead.id,
        name: lead.name,
        stage: lead.stage,
        email: lead.email.trim(),
        scrapped: lead.scrapped,
        business: businessOf(lead),
        businesses: [...(businesses.get(key) ?? [])].sort(),
      });
    }
  }
  return result;
}

// Narrow structural type so a route passes the real Prisma client and a test
// can pass a plain object.
export type InboxLeadsPrisma = {
  lead: {
    findMany: (args: {
      where: { OR: { email: { equals: string; mode: "insensitive" } }[] };
      select: { id: true; name: true; stage: true; email: true; scrapped: true; createdAt: true; business: true };
    }) => Promise<InboxLeadCandidate[]>;
  };
};

export async function findLeadCandidates(
  prismaClient: InboxLeadsPrisma,
  addresses: string[]
): Promise<{ unique: string[]; leads: InboxLeadCandidate[] }> {
  const unique = [...new Set(addresses.map(normalizeEmail).filter(Boolean))];
  if (unique.length === 0) return { unique, leads: [] };
  const leads = await prismaClient.lead.findMany({
    where: { OR: unique.map((email) => ({ email: { equals: email, mode: "insensitive" } })) },
    select: { id: true, name: true, stage: true, email: true, scrapped: true, createdAt: true, business: true },
  });
  return { unique, leads };
}

export async function findLeadsForAddresses(
  prismaClient: InboxLeadsPrisma,
  addresses: string[],
  options: LeadMatchOptions = {}
): Promise<Map<string, InboxLeadMatch>> {
  const { unique, leads } = await findLeadCandidates(prismaClient, addresses);
  return unique.length === 0 ? new Map() : matchLeadsByEmail(unique, leads, options);
}

// A thread can be matched by its Reply-To as well as its sender, so a form
// notification (From the form service, Reply-To the customer) finds the
// customer's lead. The Reply-To match wins, as that is who a reply goes to.
export function pickThreadLead(
  matches: Map<string, InboxLeadMatch>,
  addresses: { replyTo: string | null | undefined; from: string | null | undefined }
): InboxLeadMatch | null {
  return matches.get(normalizeEmail(addresses.replyTo)) ?? matches.get(normalizeEmail(addresses.from)) ?? null;
}
