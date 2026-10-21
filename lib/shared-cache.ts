// Figures worked out once and shared by every request, tab and user this
// server instance handles, for a short time, so a page several people (or
// tabs) open at once costs one set of database queries, not one each.
//
// - An entry is used until it is ttlMs old.
// - Requests that arrive while it is being worked out wait for that one
//   load instead of starting their own.
// - A failed load is not kept; the next request tries again.
// - A change someone makes in the CRM (see crm-change.ts) comes with an id.
//   The first time an instance sees that id, everything it had worked out
//   before then is out of date for that person: their next read loads
//   afresh (once per instance), so they see their own change straight away
//   on whichever instance serves them. Other people see it within ttlMs.
//
// Kept on globalThis by name, as the Prisma client is: the build puts a copy
// of this module (and of each file that makes a cache) in more than one
// server chunk, pages and API routes, and every copy in one instance must
// share the same entries.

type Entry<T> = { value: T; startedAt: number };
type Loading<T> = { promise: Promise<T>; startedAt: number };

export type SharedCache<T> = {
  get(key: string, load: () => Promise<T>, options?: { changeId?: string | null }): Promise<T>;
  clear(): void;
};

type Registry = {
  // By name, so every copy of this module asking for the same cache gets the same one.
  caches: Map<string, SharedCache<unknown>>;
  // When this instance first saw each change id.
  seen: Map<string, number>;
};

const globalForCache = globalThis as unknown as { fdhSharedCache?: Registry };
const registry: Registry = (globalForCache.fdhSharedCache ??= { caches: new Map(), seen: new Map() });

// A change id is forgotten after this long; it has done its work by then.
const SEEN_FOR_MS = 10 * 60 * 1000;
const MAX_SEEN = 500;

// When this instance first saw a change id (now, if this is the first time).
function firstSeen(changeId: string, now: number): number {
  const at = registry.seen.get(changeId);
  if (at !== undefined) return at;
  for (const [id, when] of registry.seen) {
    if (now - when > SEEN_FOR_MS || registry.seen.size >= MAX_SEEN) registry.seen.delete(id);
    else break;
  }
  registry.seen.set(changeId, now);
  return now;
}

export function sharedCache<T>(
  name: string,
  { ttlMs, maxEntries = 20, now = Date.now }: { ttlMs: number; maxEntries?: number; now?: () => number }
): SharedCache<T> {
  const existing = registry.caches.get(name);
  if (existing) return existing as SharedCache<T>;
  const entries = new Map<string, Entry<T>>();
  const loading = new Map<string, Loading<T>>();

  function remember(key: string, entry: Entry<T>) {
    const current = entries.get(key);
    // A slower load that started earlier never replaces a newer one.
    if (current && current.startedAt > entry.startedAt) return;
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value as string);
  }

  function start(key: string, load: () => Promise<T>): Loading<T> {
    const startedAt = now();
    const promise = load().then(
      (value) => {
        remember(key, { value, startedAt });
        if (loading.get(key)?.promise === promise) loading.delete(key);
        return value;
      },
      (err) => {
        if (loading.get(key)?.promise === promise) loading.delete(key);
        throw err;
      }
    );
    const pending = { promise, startedAt };
    loading.set(key, pending);
    return pending;
  }

  const cache: SharedCache<T> = {
    get(key, load, options = {}) {
      const at = now();
      // Anything started before this person's latest change is out of date for them.
      const notBefore = options.changeId ? firstSeen(options.changeId, at) : -Infinity;
      const entry = entries.get(key);
      if (entry && at - entry.startedAt < ttlMs && entry.startedAt >= notBefore) return Promise.resolve(entry.value);
      const pending = loading.get(key);
      if (pending && pending.startedAt >= notBefore) return pending.promise;
      return start(key, load).promise;
    },
    clear() {
      entries.clear();
      loading.clear();
    },
  };
  registry.caches.set(name, cache as SharedCache<unknown>);
  return cache;
}

// Forgets everything every shared cache in this instance has worked out:
// for a change made outside a person's own request (a website enquiry, say).
export function clearSharedCaches(): void {
  for (const cache of registry.caches.values()) cache.clear();
}
