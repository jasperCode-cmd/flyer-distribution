import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { NO_STORE, readJson, roundsFailure, signedIn, unauthorised } from "@/lib/rounds/api";
import { deleteRound, getRound, updateRound } from "@/lib/rounds/service";
import { screenshotStorage } from "@/lib/rounds/storage";
import { isId, validateRoundChanges } from "@/lib/rounds/validate";

// One round: its details, screenshots and client links; changing its
// details; deleting it (and any stored screenshot files).

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  if (!(await signedIn())) return unauthorised();
  const { id } = await params;
  if (!isId(id)) return NextResponse.json({ error: "That round no longer exists." }, { status: 404 });
  try {
    const round = await getRound(prisma, id);
    if (!round) return NextResponse.json({ error: "That round no longer exists." }, { status: 404 });
    return NextResponse.json(round, { headers: NO_STORE });
  } catch (err) {
    return roundsFailure(err, "load a round");
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!(await signedIn())) return unauthorised();
  const { id } = await params;
  if (!isId(id)) return NextResponse.json({ error: "That round no longer exists." }, { status: 404 });
  const checked = validateRoundChanges(await readJson(req));
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
  try {
    await updateRound(prisma, id, checked.value);
    return NextResponse.json(await getRound(prisma, id), { headers: NO_STORE });
  } catch (err) {
    return roundsFailure(err, "change a round");
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!(await signedIn())) return unauthorised();
  const { id } = await params;
  if (!isId(id)) return NextResponse.json({ error: "That round no longer exists." }, { status: 404 });
  try {
    await deleteRound(prisma, screenshotStorage(), id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return roundsFailure(err, "delete a round");
  }
}
