import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// The number beside "Applications" in the CRM navigation.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await prisma.distributorApplication.count({ where: { status: "NEW" } });
  return NextResponse.json({ count });
}
