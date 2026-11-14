import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NO_STORE, roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { roundOptions } from "@/lib/rounds/service";
import { locateConfigured } from "@/lib/rounds/locate/read-labels";
import { storageEnabled } from "@/lib/rounds/storage";

// What a round can be for (projects and Won or Completed leads), the
// distributors, whether screenshot storage is on, whether Locate is set up
// (only whether its key is there, never the key), and the privacy trim.

export async function GET() {
  if (!(await signedIn())) return unauthorised();
  try {
    return NextResponse.json(await roundOptions(prisma, storageEnabled(), locateConfigured()), { headers: NO_STORE });
  } catch (err) {
    return roundsFailure(err, "load the round options");
  }
}
