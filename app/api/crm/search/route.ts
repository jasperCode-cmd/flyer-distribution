import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ leads: [] });
  }

  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { postcode: { contains: q, mode: "insensitive" } },
        { businessName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, businessName: true, stage: true },
    take: 8,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ leads });
}
