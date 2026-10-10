import { NextResponse } from "next/server";

// Shared by the inbox routes. Messages are fixed strings from lib/gmail's
// classifyError, never Google's own error text.
export function gmailFailureResponse(reason: "not_configured" | "reconnect" | "error", message: string) {
  if (reason === "not_configured") {
    return NextResponse.json({ configured: false, error: message, reason }, { status: 503 });
  }
  const status = reason === "reconnect" ? 409 : 502;
  return NextResponse.json({ configured: true, error: message, reason }, { status });
}

// Gmail thread ids are short hex strings; page tokens are short opaque
// strings. Anything else is rejected before it reaches Google.
export function isValidThreadId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9]{1,64}$/.test(id);
}

export function isValidPageToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(token);
}
