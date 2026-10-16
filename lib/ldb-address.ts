// The Leaflet Distribution Bournemouth address (LDB_SENDER_ADDRESS), lower
// case, or null when it isn't set. It decides which mail in the shared inbox
// is Bournemouth mail, so it is read even when sending isn't set up: LDB mail
// must never show in FDH views either way. Never logged.

const ADDRESS_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

export function getLdbSenderAddress(): string | null {
  const address = process.env.LDB_SENDER_ADDRESS?.trim().toLowerCase();
  return address && ADDRESS_RE.test(address) ? address : null;
}
