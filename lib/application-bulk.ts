import type { DistributorCreateData } from "./distributors";
import { distributorDataFromApplication, phonesMatch, type StoredApplication } from "./distributor-applications";

// "Move to distributors" for a selection of applications on the
// Applications page. A preview sorts the selection into three groups first,
// and nothing is written until staff confirm it:
//   - new: no distributor matches, so one is created with the same shared
//     rules as the single Approve button;
//   - matched: an existing distributor has the same phone number (in any
//     format) or the same email (ignoring case), so the application is
//     linked to it rather than creating a duplicate;
//   - already linked: skipped.
// On confirm each application is handled on its own, in its own
// transaction, so one failure never undoes the others, and an application
// that is already linked is never touched again, so a second run on the
// same selection creates nothing.

export const BULK_MOVE_MAX = 500;

export type MatchableDistributor = { id: string; name: string; phone: string | null; email: string | null };
export type MatchedBy = "phone" | "email";

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

// Phone first, then email. The list is oldest distributor first, so the
// same match is found every time.
export function matchDistributor<D extends MatchableDistributor>(
  app: { phone: string | null; email: string | null },
  distributors: D[]
): { distributor: D; by: MatchedBy } | null {
  const byPhone = distributors.find((d) => phonesMatch(app.phone, d.phone));
  if (byPhone) return { distributor: byPhone, by: "phone" };
  const email = normalizeEmail(app.email);
  if (email) {
    const byEmail = distributors.find((d) => normalizeEmail(d.email) === email);
    if (byEmail) return { distributor: byEmail, by: "email" };
  }
  return null;
}

export type BulkApplication = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  receivedAt: Date;
  distributor: { id: string; name: string } | null;
};

export type BulkPlan = {
  create: { id: string; fullName: string }[];
  // distributor.id is null when the match is with someone earlier in the
  // same selection, whose distributor this run is about to create.
  match: { id: string; fullName: string; distributor: { id: string | null; name: string }; by: MatchedBy }[];
  linked: { id: string; fullName: string; distributor: { id: string; name: string } }[];
  cannot: { id: string; fullName: string; reason: string }[];
};

// Oldest application first, the order the move itself works in, so two
// applications from the same person in one selection become one distributor
// (from the first) with the second linked to it.
export function bulkOrder<T extends { id: string; receivedAt: Date }>(apps: T[]): T[] {
  return [...apps].sort((a, b) => a.receivedAt.getTime() - b.receivedAt.getTime() || a.id.localeCompare(b.id));
}

export function planBulkMove(apps: BulkApplication[], distributors: MatchableDistributor[]): BulkPlan {
  const plan: BulkPlan = { create: [], match: [], linked: [], cannot: [] };
  const pool: (MatchableDistributor & { fromSelection: boolean })[] = distributors.map((d) => ({
    ...d,
    fromSelection: false,
  }));
  for (const app of bulkOrder(apps)) {
    if (app.distributor) {
      plan.linked.push({ id: app.id, fullName: app.fullName, distributor: app.distributor });
      continue;
    }
    const match = matchDistributor(app, pool);
    if (match) {
      plan.match.push({
        id: app.id,
        fullName: app.fullName,
        distributor: { id: match.distributor.fromSelection ? null : match.distributor.id, name: match.distributor.name },
        by: match.by,
      });
      continue;
    }
    if (!app.fullName.trim()) {
      plan.cannot.push({ id: app.id, fullName: app.fullName, reason: "No name to create a distributor from." });
      continue;
    }
    plan.create.push({ id: app.id, fullName: app.fullName });
    pool.push({ id: `selection:${app.id}`, name: app.fullName.trim(), phone: app.phone, email: app.email, fromSelection: true });
  }
  return plan;
}

// --- The move itself ------------------------------------------------------

export type BulkOutcome =
  | { id: string; fullName: string; result: "created"; distributor: { id: string; name: string } }
  | { id: string; fullName: string; result: "linked"; distributor: { id: string; name: string }; by: MatchedBy }
  | { id: string; fullName: string; result: "skipped"; distributor: { id: string; name: string } | null }
  | { id: string; fullName: string; result: "failed"; reason: string };

// Narrow structural types: the route passes the real Prisma client, a test a
// plain object.
export type BulkTx = {
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): PromiseLike<number>;
  distributorApplication: {
    findUnique(args: { where: { id: string } }): PromiseLike<(StoredApplication & { distributorId: string | null }) | null>;
    updateMany(args: {
      where: { id: string; distributorId: null };
      data: { distributorId: string; status: "APPROVED" };
    }): PromiseLike<{ count: number }>;
  };
  distributor: {
    findMany(args: {
      select: { id: true; name: true; phone: true; email: true };
      orderBy: { createdAt: "asc" };
    }): PromiseLike<MatchableDistributor[]>;
    findUnique(args: { where: { id: string }; select: { id: true; name: true } }): PromiseLike<{ id: string; name: string } | null>;
    create(args: { data: DistributorCreateData; select: { id: true; name: true } }): PromiseLike<{ id: string; name: string }>;
  };
};

export type BulkDb = {
  $transaction<T>(fn: (tx: BulkTx) => Promise<T>): Promise<T>;
};

// Any fixed number: every move takes this lock inside its transaction, so
// two people moving the same person at once can't both create them.
const BULK_MOVE_LOCK = 724_100;

class AlreadyLinkedError extends Error {}

function describeFailure(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string"
    ? `Database error (${code}). Nothing was saved for this application.`
    : "Unexpected error. Nothing was saved for this application.";
}

export async function moveApplicationToDistributors(
  db: BulkDb,
  id: string,
  onError?: (id: string, err: unknown) => void
): Promise<BulkOutcome> {
  let fullName = "";
  try {
    return await db.$transaction(async (tx): Promise<BulkOutcome> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${BULK_MOVE_LOCK})`;
      const app = await tx.distributorApplication.findUnique({ where: { id } });
      if (!app) return { id, fullName, result: "failed", reason: "Not found. It may have been deleted." };
      fullName = app.fullName;
      if (app.distributorId) {
        const distributor = await tx.distributor.findUnique({
          where: { id: app.distributorId },
          select: { id: true, name: true },
        });
        return { id, fullName, result: "skipped", distributor };
      }

      const existing = await tx.distributor.findMany({
        select: { id: true, name: true, phone: true, email: true },
        orderBy: { createdAt: "asc" },
      });
      const match = matchDistributor(app, existing);
      let distributor: { id: string; name: string };
      if (match) {
        distributor = { id: match.distributor.id, name: match.distributor.name };
      } else {
        const built = distributorDataFromApplication(app);
        if (!built.ok) return { id, fullName, result: "failed", reason: "No name to create a distributor from." };
        distributor = await tx.distributor.create({ data: built.data, select: { id: true, name: true } });
      }

      const linked = await tx.distributorApplication.updateMany({
        where: { id, distributorId: null },
        data: { distributorId: distributor.id, status: "APPROVED" },
      });
      if (linked.count !== 1) throw new AlreadyLinkedError();
      return match
        ? { id, fullName, result: "linked", distributor, by: match.by }
        : { id, fullName, result: "created", distributor };
    });
  } catch (err) {
    if (err instanceof AlreadyLinkedError) return { id, fullName, result: "skipped", distributor: null };
    onError?.(id, err);
    return { id, fullName, result: "failed", reason: describeFailure(err) };
  }
}

// One at a time, in the order given (oldest application first).
export async function moveApplicationsToDistributors(
  db: BulkDb,
  ids: string[],
  onError?: (id: string, err: unknown) => void
): Promise<BulkOutcome[]> {
  const results: BulkOutcome[] = [];
  for (const id of ids) results.push(await moveApplicationToDistributors(db, id, onError));
  return results;
}

// The request body: a list of distinct application ids, within the cap.
export function readBulkIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || !raw.every((v) => typeof v === "string" && v.length > 0 && v.length <= 64)) return null;
  const ids = [...new Set(raw as string[])];
  return ids.length === 0 || ids.length > BULK_MOVE_MAX ? null : ids;
}
