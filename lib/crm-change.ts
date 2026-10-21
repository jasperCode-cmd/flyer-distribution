// Telling the server "I have just changed something", so the figures it
// keeps for a minute (shared-cache.ts) are worked out afresh for me. After
// any request that could change data (anything but GET or HEAD to
// /api/crm/), the page sets a short-lived cookie holding a new random id;
// the server reads it on Dashboard, Priorities and the navigation's status.
// No server imports: the browser and the server both use this file.

export const CRM_CHANGE_COOKIE = "fdh-crm-change";
// Long enough for the next few page loads; it has done its work by then.
const COOKIE_MAX_AGE_S = 5 * 60;
const ID_RE = /^[a-z0-9]{8,40}$/;

// The change id from the cookie's value, or null if it isn't one.
export function parseChangeId(value: string | null | undefined): string | null {
  return value && ID_RE.test(value) ? value : null;
}

// Whether a request the page made could have changed CRM data.
export function isCrmChangeRequest(input: RequestInfo | URL, init: RequestInit | undefined, origin: string): boolean {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method === "GET" || method === "HEAD") return false;
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return false;
  }
  return url.origin === origin && url.pathname.startsWith("/api/crm/");
}

export function newChangeId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
}

export function markCrmChanged(): void {
  document.cookie = `${CRM_CHANGE_COOKIE}=${newChangeId()}; Path=/; Max-Age=${COOKIE_MAX_AGE_S}; SameSite=Lax`;
}

const INSTALLED = Symbol.for("fdh.crmChangeMarker");

// Wraps the page's fetch once, so every change made from any CRM screen
// marks itself, whether it worked or not (a refused change costs only a
// fresh look). The response is passed back untouched.
export function installChangeMarker(): void {
  const w = window as unknown as Record<symbol, boolean>;
  if (w[INSTALLED]) return;
  w[INSTALLED] = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await original(input, init);
    try {
      if (isCrmChangeRequest(input, init, window.location.origin)) markCrmChanged();
    } catch {
      // Marking is a nicety; the request's own result is what matters.
    }
    return response;
  };
}
