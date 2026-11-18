import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findDuplicateLeads } from "@/lib/crm-data";
import { clearSharedCaches } from "@/lib/shared-cache";
import { waitUntil } from "@vercel/functions";
import { senderFor } from "@/lib/email-channel";
import { sendQuoteThankYou } from "@/lib/quote-thank-you";
import { enquiryFromQuoteForm } from "@/lib/thank-you-email";
import { QUANTITY_MESSAGE, isQuantityRange } from "@/lib/quote-quantity";

// Called from the public /quote form alongside (not instead of) the
// existing Web3Forms email notification. Best-effort field mapping:
// budget is collected on the form as a range (e.g. "£300 - £500"), not
// a precise figure, so it is recorded in the note rather than invented
// as a single numeric dealValue.

// The leaflet campaign budgets the form offers, word for word. A leaflet
// enquiry with any other budget (such as one the form no longer offers)
// is refused.
const LEAFLET_BUDGETS = [
  "Under £300",
  "£300 - £500",
  "£500 - £1,000",
  "£1,000 - £2,000",
  "£2,000 - £4,000",
  "£4,000+",
];
const BUDGET_MESSAGE = "Please choose a campaign budget from the list";

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

  // The quantity: required for a leaflet enquiry, and only one of the form's
  // own ranges (lib/quote-quantity.ts), kept as it reads, such as "1,000 to 2,500".
  const validQuantity = isQuantityRange(data.quantity);
  if (data.service === "Leaflet Distribution" && !validQuantity) {
    return NextResponse.json({ error: QUANTITY_MESSAGE }, { status: 400 });
  }
  if (!validQuantity) data.quantity = "";
  // A printing enquiry sends its quantity as print-quantity, from the same
  // ranges and required the same way; it is saved as the lead's quantity too.
  const isPrinting = data.service === "Leaflet Printing";
  if (isPrinting && !isQuantityRange(data["print-quantity"])) {
    return NextResponse.json({ error: QUANTITY_MESSAGE }, { status: 400 });
  }
  const leadQuantity = isPrinting ? data["print-quantity"] : data.quantity;

  if (data.service === "Leaflet Distribution" && data.budget && !LEAFLET_BUDGETS.includes(data.budget)) {
    return NextResponse.json({ error: BUDGET_MESSAGE }, { status: 400 });
  }

  // A printing enquiry is printing by definition; its design and delivery
  // areas come from its own fields.
  const printingIncluded = data["printing-included"] === "yes" || isPrinting;
  const designIncluded = data["include-design"] === "yes" || data["print-design"] === "Yes";
  const targetAreas = data["areas-required"] || data["print-delivery-areas"] || null;

  const noteLines = [`Service type: ${data.service || "Unspecified"}`];
  if (data["distribution-type"]) noteLines.push(`Distribution type: ${data["distribution-type"]}`);
  // Printing: the print builder's choice as one line, then its parts (print-items
  // is what the form sent before the builder, still read in case a page from
  // before it is submitted).
  if (isPrinting && data["print-spec"]) noteLines.push(`Print spec: ${data["print-spec"]}`);
  if (isPrinting && data["print-item"]) noteLines.push(`Print item: ${data["print-item"]}`);
  if (data["print-items"]) noteLines.push(`Print items: ${data["print-items"]}`);
  if (data["print-size"]) noteLines.push(`Item size: ${data["print-size"]}`);
  if (isPrinting && data["print-fold"]) noteLines.push(`Fold: ${data["print-fold"]}`);
  if (isPrinting && data["print-sides"]) noteLines.push(`Print sides: ${data["print-sides"]}`);
  if (isPrinting && data["print-paper"]) noteLines.push(`Paper: ${data["print-paper"]}`);
  if (data["print-design"]) noteLines.push(`Design wanted: ${data["print-design"]}`);
  // Printing: the full delivery address as one line (the form sends it in
  // parts; the postcode is still print-send-to, on its own line as before).
  if (isPrinting && (data["print-address-1"] || data["print-town"])) {
    const address = [data["print-address-1"], data["print-address-2"], data["print-town"], data["print-send-to"]]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean)
      .join(", ");
    noteLines.push(`Delivery address: ${address}`);
  }
  if (data["print-send-to"]) noteLines.push(`Send printed leaflets to: ${data["print-send-to"]}`);
  if (data["also-deliver"]) noteLines.push(`Also deliver: ${data["also-deliver"]}`);
  if (data.budget) noteLines.push(`Budget range: ${data.budget}`);
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
        targetAreas,
        leafletQuantity: leadQuantity || null,
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

    // The bell's shared copy, so it shows at the next ask (lib/shared-cache.ts).
    clearSharedCaches();
    // The automatic thank-you email (FDH Leaflet Distribution enquiries only),
    // sent after this reply, best effort: it never changes what the form is
    // told (lib/quote-thank-you.ts).
    if (lead.business === "FDH") {
      waitUntil(
        sendQuoteThankYou({ db: prisma, lead, enquiry: enquiryFromQuoteForm(data), send: senderFor(lead.business) }).catch(() => {
          console.error("Quote thank-you email not sent: error");
        })
      );
    }
    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    // Never let a DB/lead-capture failure break the existing Web3Forms
    // email flow this is called alongside; the caller ignores this
    // response either way, but log it server-side for visibility.
    console.error("Failed to create lead from quote form submission:", err);
    return NextResponse.json({ error: "Failed to record lead" }, { status: 500 });
  }
}
