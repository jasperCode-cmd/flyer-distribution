import "server-only";
import { NextResponse } from "next/server";
import { AreaPlannerError } from "./service";

// The Area Planner routes' shared error reply. Only the error's type is
// logged: a database error can echo the values it was given.
export function plannerFailure(err: unknown, what: string) {
  if (err instanceof AreaPlannerError) return NextResponse.json({ error: err.message }, { status: err.status });
  const code = (err as { code?: unknown } | null)?.code;
  console.error(`Area Planner: failed to ${what}:`, err instanceof Error ? err.name : "unknown error", typeof code === "string" ? code : "");
  return NextResponse.json({ error: "Something went wrong. Try again in a moment." }, { status: 500 });
}

export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}
