// A small in-memory sliding-window limiter for public endpoints. On Vercel
// each server instance keeps its own window, so it slows a single client
// down rather than being an exact global cap; routes that need a hard
// ceiling add a database check on top. Nothing here is stored anywhere.
export function createRateLimiter(options: { max: number; windowMs: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>();
  const maxKeys = options.maxKeys ?? 5000;

  return function allow(key: string, now: number = Date.now()): boolean {
    const windowStart = now - options.windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);
    if (recent.length >= options.max) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now);
    hits.delete(key);
    hits.set(key, recent);
    // Oldest keys go first, so memory stays bounded however many clients call.
    while (hits.size > maxKeys) {
      const oldest = hits.keys().next().value;
      if (oldest === undefined) break;
      hits.delete(oldest);
    }
    return true;
  };
}

// The caller's address as Vercel reports it. Only used as a key for the
// limiter above; never logged or saved.
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}
