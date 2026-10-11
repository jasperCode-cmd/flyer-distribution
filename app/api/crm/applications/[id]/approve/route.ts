import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { approveApplicationAsDistributor } from "@/lib/distributor-applications";

// "Approve and add as distributor". Only ever runs when a member of staff
// presses that button; nothing creates a Distributor automatically.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result = await approveApplicationAsDistributor(prisma, id);
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }
    if (result.reason === "already_linked") {
      return NextResponse.json({ error: "This application has already been added as a distributor." }, { status: 409 });
    }
    return NextResponse.json({ error: "This application has no name to create a distributor from." }, { status: 400 });
  }
  return NextResponse.json({ distributor: result.distributor }, { status: 201 });
}
