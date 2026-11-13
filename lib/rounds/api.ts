import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { RoundsError } from "./service";

// What the Rounds API routes share: the login check, reading JSON, and the
// error reply. Logs carry only a fixed reason, never round or client data.

export async function signedIn(): Promise<boolean> {
  const session = await auth();
  return !!session?.user;
}

export const unauthorised = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}

export function roundsFailure(err: unknown, what: string) {
  if (err instanceof RoundsError) return NextResponse.json({ error: err.message }, { status: err.status });
  const code = (err as { code?: unknown } | null)?.code;
  console.error(`Rounds: failed to ${what}:`, err instanceof Error ? err.name : "unknown error", typeof code === "string" ? code : "");
  return NextResponse.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
}

// Never cached by a browser or anything in between.
export const NO_STORE = { "Cache-Control": "private, no-store" };
