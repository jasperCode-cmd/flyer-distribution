import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findDuplicateLeads } from "@/lib/crm-data";

// Called from the public /quote form alongside (not instead of) the
// existing Web3Forms email notification. Best-effort field mapping —
// budget is collected on the form as a range (e.g. "£300 - £500"), not
// a precise figure, so it is recorded in the note rather than invented
// as a single numeric dealValue.
export async function POST(req: Request) {
  let data: Record<string, string>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const firstName = data["first-name"]?.trim() ?? "";
  const lastName = data["last-name"]?.trim() ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!name || !data.email) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const printingIncluded = data["printing-included"] === "yes";
  const designIncluded = data["include-design"] === "yes";

  const noteLines = [`Service type: ${data.service || "Unspecified"}`];
  if (data.budget) noteLines.push(`Budget range: ${data.budget}`);
  if (data["campaign-start-date"]) noteLines.push(`Requested start date: ${data["campaign-start-date"]}`);
  if (data["business-type"]) noteLines.push(`Business type: ${data["business-type"]}`);
  if (data["event-date"]) noteLines.push(`Event date: ${data["event-date"]}`);
  if (data["event-location"]) noteLines.push(`Event location: ${data["event-location"]}`);
  if (data["event-duration"]) noteLines.push(`Event duration: ${data["event-duration"]}`);
  if (data.message) noteLines.push(`Message: ${data.message}`);

  try {
    // No live session/UI to show a duplicate warning to at this point (an
    // anonymous site visitor is submitting this), so a possible match is
    // recorded as an Activity note instead, for staff to see on the timeline.
    const duplicates = await findDuplicateLeads(data.email, data.phone);
    if (duplicates.length > 0) {
      const names = duplicates.map((d) => `${d.name} (${d.id})`).join(", ");
      noteLines.push(`Possible duplicate of existing lead(s): ${names}`);
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        email: data.email || null,
        phone: data.phone || null,
        businessName: data.company || null,
        targetAreas: data["areas-required"] || null,
        leafletQuantity: data.quantity || null,
        printingIncluded,
        designIncluded,
        source: "WEBSITE_QUOTE_FORM",
        activities: {
          create: {
            type: "NOTE",
            detail: noteLines.join("\n"),
          },
        },
      },
    });

    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    // Never let a DB/lead-capture failure break the existing Web3Forms
    // email flow this is called alongside — the caller ignores this
    // response either way, but log it server-side for visibility.
    console.error("Failed to create lead from quote form submission:", err);
    return NextResponse.json({ error: "Failed to record lead" }, { status: 500 });
  }
}
