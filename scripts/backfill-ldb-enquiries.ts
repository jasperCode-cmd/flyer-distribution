// One-off: brings past Leaflet Distribution Bournemouth website enquiries
// into the CRM from the shared Gmail, as LDB leads from the Website Quote
// Form, dated when each enquiry arrived.
//
//   npx tsx --conditions=react-server scripts/backfill-ldb-enquiries.ts
//
// That is a preview: it reads Gmail and the database, prints what it would
// import, and writes nothing. Add --apply to write the previewed rows.
//
//   --from=<address>         the notifications' sender
//                            (default team@leafletdistributionbournemouth.co.uk)
//   --since=YYYY-MM-DD       only enquiries from that UK day on
//   --stage=UNCONTACTED|AWAITING_RESPONSE|LOST   use this stage for every row
//   --include-duplicates     import enquiries matching an existing lead anyway,
//                            with the usual "Possible duplicate" note
//
// A notification is an email from the sender, to us, Reply-To the enquirer,
// whose subject starts "Leaflet Distribution enquiry from ", "Public Notice
// Leafleting enquiry from " or "Quote enquiry from ". Replies, forwards, sent
// mail, drafts and the CRM's own emails to Bournemouth leads never count.
// Each is read into the intake endpoint's fields from its table and checked
// by the same validation, and the lead is built and noted exactly as the
// endpoint does it (lib/ldb-intake.ts), plus "Imported from Gmail" and the
// Gmail message ID. The suggested stage is Awaiting Response when the thread
// has a later message to the enquirer from the Bournemouth address or the
// Hampshire Gmail (we replied), Lost (reason Other) when there is no reply and
// it is more than 30 days old, and Uncontacted otherwise. Skipped, and
// listed: anything matching an existing lead of either business by email or
// phone, anything that can't be read, and anything whose message ID is
// already in a lead's note, so running --apply twice creates nothing twice.
// Each lead and its note are written in one transaction.
//
// Gmail is only searched and read, under the CRM's existing scopes. The
// settings come from .env.local, .env or the environment (GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_ADDRESS,
// DATABASE_URL, and LDB_SENDER_ADDRESS if set). Nothing here ever prints them.
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { withGmailMessageReader } from "../lib/gmail";
import { getLdbSenderAddress } from "../lib/ldb-address";
import {
  applyBackfill,
  loadContacts,
  loadImportedIds,
  parseBackfillArgs,
  planBackfill,
  previewTable,
  summaryLine,
} from "../lib/ldb-backfill";

config({ path: [".env.local", ".env"], quiet: true });

const REQUIRED = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GMAIL_REFRESH_TOKEN", "GMAIL_SENDER_ADDRESS", "DATABASE_URL"];

// Only the error's type: a connection error's message can include the
// database host.
function errorType(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return [err instanceof Error ? err.name : "unknown error", typeof code === "string" ? code : ""].filter(Boolean).join(" ");
}

async function main() {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length) {
    console.error(`Not set (looked in .env.local, .env and the environment): ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  const args = parseBackfillArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(args.error);
    process.exitCode = 1;
    return;
  }
  const options = args.options;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    let imported: Set<string>;
    let contacts: Awaited<ReturnType<typeof loadContacts>>;
    try {
      [imported, contacts] = await Promise.all([loadImportedIds(prisma), loadContacts(prisma)]);
    } catch (err) {
      console.error("Could not read the database:", errorType(err));
      process.exitCode = 1;
      return;
    }

    const result = await withGmailMessageReader((reader, context) => {
      // The Hampshire Gmail and the Bournemouth address (the sender is added).
      const ours = [context.senderAddress, getLdbSenderAddress() ?? ""].filter(Boolean).map((a) => a.toLowerCase());
      return planBackfill({
        reader,
        imported,
        contacts,
        options,
        ours,
        // Our own addresses are what we're looking for, never a reason to leave a thread out.
        excluded: context.excluded.filter((a) => !ours.includes(a) && a !== options.from),
        now: new Date(),
      });
    });
    if (!result.ok) {
      console.error(result.message);
      process.exitCode = 1;
      return;
    }
    const { rows, truncated } = result.data;

    console.log(
      options.apply
        ? "Bournemouth enquiry backfill: applying\n"
        : "Bournemouth enquiry backfill preview (nothing has been written)\n"
    );
    if (rows.length === 0) {
      console.log(`No enquiry notifications found from ${options.from}.`);
    } else {
      for (const line of previewTable(rows)) console.log(line);
    }
    if (truncated) console.log("\nOnly the first notifications were read; run again with --since to read later ones.");
    console.log(`\n${summaryLine(rows)}`);

    const toImport = rows.filter((r) => !r.skip).length;
    if (!options.apply) {
      if (toImport) console.log("\nTo write these, run the same command again with --apply.");
      return;
    }
    if (!toImport) {
      console.log("\nNothing to write.");
      return;
    }
    try {
      const { created, alreadyImported } = await applyBackfill(prisma, rows);
      console.log(
        `\nCreated ${created} lead${created === 1 ? "" : "s"}.` +
          (alreadyImported ? ` ${alreadyImported} had been imported since the preview and were left alone.` : "")
      );
    } catch (err) {
      console.error("\nThe import stopped:", errorType(err), "(every lead written before this is complete; run again to carry on)");
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
