import "server-only";
import { cookies } from "next/headers";
import { CRM_CHANGE_COOKIE, parseChangeId } from "./crm-change";

// The change the person asking has just made, if any (see crm-change.ts).
export async function requestChangeId(): Promise<string | null> {
  return parseChangeId((await cookies()).get(CRM_CHANGE_COOKIE)?.value);
}
