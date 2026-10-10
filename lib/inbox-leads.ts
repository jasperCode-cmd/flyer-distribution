export type InboxLeadCandidate = {
  id: string;
  name: string;
  stage: string;
  email: string | null;
  scrapped: boolean;
  createdAt: Date;
};

export type InboxLeadMatch = {
  id: string;
  name: string;
  stage: string;
  email: string;
  scrapped: boolean;
};

export function normalizeEmail(address: string | null | undefined): string {
  return (address ?? "").trim().toLowerCase();
}

// Case-insensitive, exact-address match of each inbox address to a lead.
// When several leads share an address, a live lead wins over a scrapped one,
// then the most recently created. Pure, so it is unit tested without a DB.
export function matchLeadsByEmail(
  addresses: string[],
  leads: InboxLeadCandidate[]
): Map<string, InboxLeadMatch> {
  const best = new Map<string, InboxLeadCandidate>();
  for (const lead of leads) {
    const key = normalizeEmail(lead.email);
    if (!key) continue;
    const current = best.get(key);
    if (
      !current ||
      (current.scrapped && !lead.scrapped) ||
      (current.scrapped === lead.scrapped && lead.createdAt.getTime() > current.createdAt.getTime())
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
      select: { id: true; name: true; stage: true; email: true; scrapped: true; createdAt: true };
    }) => Promise<InboxLeadCandidate[]>;
  };
};

export async function findLeadsForAddresses(
  prismaClient: InboxLeadsPrisma,
  addresses: string[]
): Promise<Map<string, InboxLeadMatch>> {
  const unique = [...new Set(addresses.map(normalizeEmail).filter(Boolean))];
  if (unique.length === 0) return new Map();
  const leads = await prismaClient.lead.findMany({
    where: { OR: unique.map((email) => ({ email: { equals: email, mode: "insensitive" } })) },
    select: { id: true, name: true, stage: true, email: true, scrapped: true, createdAt: true },
  });
  return matchLeadsByEmail(unique, leads);
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
