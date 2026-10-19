import { createHash, randomBytes } from "node:crypto";

// Private links: one per distributor per project, read-only, with only that
// distributor's areas. The token is 32 random bytes (unguessable) and only
// its SHA-256 hash is stored, so the link is shown once when it is made;
// "Replace link" makes a new one and revokes the old. Revoking works at
// once. Closing the project sets every live link to expire 14 days later;
// reopening it in time keeps them, after that they stay expired. An LDB
// project's links only work while its switch is on.

export const SHARE_EXPIRY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isShareTokenShaped(token: unknown): token is string {
  return typeof token === "string" && TOKEN_RE.test(token);
}

export function shareExpiryFrom(closedAt: Date): Date {
  return new Date(closedAt.getTime() + SHARE_EXPIRY_DAYS * DAY_MS);
}

export type LinkState = "active" | "revoked" | "expired" | "switched-off";

export function linkState(
  link: { revokedAt: Date | null; expiresAt: Date | null },
  project: { business: "FDH" | "LDB"; ldbLinksEnabled: boolean },
  now: Date
): LinkState {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt && now.getTime() >= link.expiresAt.getTime()) return "expired";
  if (project.business === "LDB" && !project.ldbLinksEnabled) return "switched-off";
  return "active";
}

export function deliveryPath(token: string): string {
  return `/delivery/${token}`;
}
