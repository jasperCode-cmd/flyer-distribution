// How many of one page's database queries run at once. A page that starts
// them all together would otherwise want a connection for each, at the same
// moment as every other page and poll being served.
export const QUERY_CONCURRENCY = 2;

type Task = () => PromiseLike<unknown>;

// Like Promise.all over the tasks' results, in order, but with at most
// `limit` running at once. Each task is a function, so it only starts when
// its turn comes (a Prisma query does not run until it is awaited). After a
// failure no further tasks are started.
export async function runLimited<const T extends readonly Task[]>(
  limit: number,
  tasks: T
): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const results: unknown[] = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = await tasks[i]();
      } catch (error) {
        next = tasks.length;
        throw error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker));
  return results as { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> };
}
