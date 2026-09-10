import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Fully resets a scrapped lead back to a fresh Uncontacted state — no
// memory of the scrap. The ASKED_NOT_TO_CONTACT "don't do this casually"
// warning is enforced client-side (the bin shows an extra confirmation
// before ever calling this for such a lead individually, and Recover All
// excludes them from the request entirely) rather than here, since this
// route's job is just to do the reset once the caller has decided to.
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No leads selected" }, { status: 400 });
  }

  const { count } = await prisma.lead.updateMany({
    where: { id: { in: ids } },
    data: {
      scrapped: false,
      scrapReason: null,
      scrapNote: null,
      scrappedAt: null,
      noAnswerStreak: 0,
      nextCallableAt: null,
      stage: "UNCONTACTED",
    },
  });

  return NextResponse.json({ recovered: count });
}
