import { NextResponse } from "next/server";
import Papa from "papaparse";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Case-insensitive header aliases mapped to Lead fields. A real export
// from the person's Google Sheet may use different column names than
// these — adjust this map once that file is in hand.
const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "lead name", "full name"],
  phone: ["phone", "phone number", "contact number", "mobile"],
  email: ["email", "email address"],
  postcode: ["postcode", "post code", "zip"],
  businessName: ["business", "business name", "organisation", "organization", "company"],
  addressArea: ["area", "address", "address/area", "location"],
  dealValue: ["deal value", "value", "quote value", "price"],
  leafletQuantity: ["quantity", "leaflet quantity", "flyers"],
  targetAreas: ["target areas", "target area(s)", "areas"],
  notes: ["notes", "note", "comments", "details"],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function buildFieldLookup(headers: string[]): Record<string, string> {
  const lookup: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) }));

  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const match = normalizedHeaders.find((h) => aliases.includes(h.norm));
    if (match) lookup[field] = match.raw;
  }
  return lookup;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No CSV file provided" }, { status: 400 });
  }

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      { error: "CSV parse error", details: parsed.errors.slice(0, 5) },
      { status: 400 }
    );
  }

  const headers = parsed.meta.fields ?? [];
  const lookup = buildFieldLookup(headers);

  if (!lookup.name) {
    return NextResponse.json(
      { error: "Could not find a name column in the CSV. Expected one of: name, lead name, full name." },
      { status: 400 }
    );
  }

  let created = 0;
  const skipped: number[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const row = parsed.data[i];
    const name = lookup.name ? row[lookup.name]?.trim() : "";

    if (!name) {
      skipped.push(i + 2); // +2 = header row + 1-index
      continue;
    }

    const notes = lookup.notes ? row[lookup.notes]?.trim() : "";
    const dealValueRaw = lookup.dealValue ? row[lookup.dealValue] : undefined;
    const dealValueParsed = dealValueRaw
      ? Number(dealValueRaw.replace(/[^0-9.]/g, ""))
      : null;

    const lead = await prisma.lead.create({
      data: {
        name,
        phone: lookup.phone ? row[lookup.phone] || null : null,
        email: lookup.email ? row[lookup.email] || null : null,
        postcode: lookup.postcode ? row[lookup.postcode] || null : null,
        businessName: lookup.businessName ? row[lookup.businessName] || null : null,
        addressArea: lookup.addressArea ? row[lookup.addressArea] || null : null,
        dealValue: dealValueParsed && !Number.isNaN(dealValueParsed) ? dealValueParsed : null,
        leafletQuantity: lookup.leafletQuantity ? row[lookup.leafletQuantity] || null : null,
        targetAreas: lookup.targetAreas ? row[lookup.targetAreas] || null : null,
        source: "OTHER",
      },
    });

    if (notes) {
      await prisma.activity.create({
        data: {
          leadId: lead.id,
          type: "NOTE",
          detail: `Imported note: ${notes}`,
          userId: session.user.id,
        },
      });
    }

    created++;
  }

  return NextResponse.json({ created, skippedRows: skipped });
}
