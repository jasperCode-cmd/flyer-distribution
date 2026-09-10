import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Creates a fresh Lead pre-filled with only the original's contact/identity
// details — everything pipeline-related (stage, priority, deal value,
// payment/review status, assignment) is left at its schema default rather
// than copied, since this is meant for a second, separate engagement with
// an existing client, not a clone of where the original left off. History
// (activities, tasks, the linked Job) is deliberately not carried over for
// the same reason; the one link back is a single Activity note on the copy.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const original = await prisma.lead.findUnique({
    where: { id },
    include: { tags: true },
  });

  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const duplicate = await prisma.lead.create({
    data: {
      name: original.name,
      phone: original.phone,
      email: original.email,
      postcode: original.postcode,
      businessName: original.businessName,
      addressArea: original.addressArea,
      tags: {
        create: original.tags.map((t) => ({ tagId: t.tagId })),
      },
      activities: {
        create: {
          type: "NOTE",
          detail: `Duplicated from ${original.name}`,
          userId: session.user.id,
        },
      },
    },
  });

  return NextResponse.json({ lead: duplicate });
}
