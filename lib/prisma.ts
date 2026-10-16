import { Pool } from "pg";
import { attachDatabasePool } from "@vercel/functions";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// One client, and so one small connection pool, per server instance. The
// database caps how many connections it accepts, and every instance running
// at once takes its share, so each keeps very few and lets idle ones go
// quickly. Queries beyond the pool's size wait their turn for a connection.
export const DB_POOL_MAX = 2;
const DB_IDLE_TIMEOUT_MS = 5_000;
// How long a query waits for a free connection (or a new one to open)
// before failing, rather than hanging the page.
const DB_CONNECTION_TIMEOUT_MS = 15_000;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: DB_POOL_MAX,
    idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
  });
  // On Vercel, keeps a suspended instance alive just long enough to close its
  // idle connections, so they aren't left open counting against the limit.
  // Does nothing anywhere else.
  attachDatabasePool(pool);
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

// Cached on globalThis in production too: the build bundles this file into
// more than one server chunk (pages and API routes), and each copy would
// otherwise open a pool of its own in the same instance.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
