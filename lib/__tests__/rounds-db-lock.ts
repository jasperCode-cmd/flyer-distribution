import pg from "pg";

// The Rounds database tests share one setting row (the clients' privacy
// trim), and test files run at the same time in separate processes; holding
// this lock on the local throwaway database for a whole file makes them take
// turns instead of changing the trim under each other. Only ever given the
// local test database's address (each file checks it is localhost first).

export const ROUNDS_DB_LOCK = 734221;

export async function holdRoundsLock(url: string): Promise<() => Promise<void>> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("SELECT pg_advisory_lock($1)", [ROUNDS_DB_LOCK]);
  return async () => {
    await client.query("SELECT pg_advisory_unlock($1)", [ROUNDS_DB_LOCK]);
    await client.end();
  };
}
