// The Rounds pages' calls to the CRM API: JSON in and out, with the
// server's plain error message when something is refused. Browser only.

export class ApiError extends Error {}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init.body && !(init.body instanceof Blob) ? { "Content-Type": "application/json", ...init.headers } : init.headers,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new ApiError(data?.error ?? "Something went wrong. Try again in a moment.");
  return data as T;
}

export const send = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export function filtersQuery(filters: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v);
  const q = params.toString();
  return q ? `?${q}` : "";
}

// "2026-11-13" for today, n days ago, in UK time.
export function ukDate(daysAgo = 0): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
}
