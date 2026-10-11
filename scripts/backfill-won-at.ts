// One-off: works out wonAt for leads already in Won or Completed, from their
// stage-change history, for the Profit calculator.
//
//   npx tsx scripts/backfill-won-at.ts            preview only: reads and prints, writes nothing
//   npx tsx scripts/backfill-won-at.ts --apply    writes the previewed dates
//
// The date used is the lead's first move into Won or Completed, matching the
// CRM's rule from now on (the first win sticks; a move straight to Completed
// counts as the win). --apply only ever fills leads whose wonAt is still
// empty, so it never overwrites a date set by hand or by the CRM. Leads with
// no stage history are listed and left empty; they show as "Won date
// unknown" on the Profit page, where the date can be set by hand.
//
// The database comes from DATABASE_URL in .env.local, .env or the
// environment. Nothing here ever prints it.
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { STAGE_LABELS } from "../lib/crm-constants";

config({ path: [".env.local", ".env"], quiet: true });

const apply = process.argv.includes("--apply");

// "Stage changed from <label> to Won", with " (bulk action)" on bulk moves.
const INTO_WON_OR_COMPLETED = new RegExp(
  ` to (${STAGE_LABELS.WON}|${STAGE_LABELS.COMPLETED})( \\(bulk action\\))?\\.?$`
);

type Proposal = {
  id: string;
  name: string;
  stage: string;
  wonAt: Date | null;
  source: string;
  otherStageChanges: number;
};

function londonDate(date: Date): string {
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function pad(text: string, width: number): string {
  const cut = text.length > width ? `${text.slice(0, width - 3)}...` : text;
  return cut.padEnd(width);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set (looked in .env.local, .env and the environment).");
    process.exitCode = 1;
    return;
  }
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    const [leads, alreadySet] = await Promise.all([
      prisma.lead.findMany({
        where: { stage: { in: ["WON", "COMPLETED"] }, wonAt: null },
        select: {
          id: true,
          name: true,
          stage: true,
          activities: {
            where: { type: "STAGE_CHANGE" },
            select: { detail: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.lead.count({ where: { stage: { in: ["WON", "COMPLETED"] }, wonAt: { not: null } } }),
    ]);

    const proposals: Proposal[] = leads.map((lead) => {
      const first = lead.activities.find((a) => INTO_WON_OR_COMPLETED.test(a.detail));
      const into = first ? INTO_WON_OR_COMPLETED.exec(first.detail)! : null;
      return {
        id: lead.id,
        name: lead.name,
        stage: STAGE_LABELS[lead.stage] ?? lead.stage,
        wonAt: first?.createdAt ?? null,
        source: into ? `first move to ${into[1]}${into[2] ? " (bulk action)" : ""}` : "",
        otherStageChanges: lead.activities.length,
      };
    });
    const dated = proposals.filter((p) => p.wonAt);
    const undated = proposals.filter((p) => !p.wonAt);

    console.log(apply ? "wonAt backfill: applying\n" : "wonAt backfill preview (nothing has been written)\n");
    if (dated.length) {
      console.log(`${pad("Lead", 34)} ${pad("Stage", 10)} ${pad("Proposed wonAt (UK time)", 25)} Source`);
      for (const p of dated) {
        console.log(`${pad(`${p.name} (${p.id})`, 34)} ${pad(p.stage, 10)} ${pad(londonDate(p.wonAt!), 25)} ${p.source}`);
      }
    }
    if (undated.length) {
      console.log('\nNo move into Won or Completed in their history (left empty, shown as "Won date unknown"):');
      for (const p of undated) {
        const note = p.otherStageChanges
          ? `${p.otherStageChanges} other stage change${p.otherStageChanges === 1 ? "" : "s"}, none into Won or Completed`
          : "no stage history at all";
        console.log(`  ${p.name} (${p.id}), ${p.stage}: ${note}`);
      }
    }
    console.log(
      `\nSummary: ${proposals.length} Won or Completed lead${proposals.length === 1 ? " has" : "s have"} no wonAt. ` +
        `${dated.length} would be set, ${undated.length} ${undated.length === 1 ? "has" : "have"} no history. ` +
        `${alreadySet} already ${alreadySet === 1 ? "has" : "have"} a wonAt and ${alreadySet === 1 ? "is" : "are"} left alone.`
    );

    if (!apply) {
      if (dated.length) console.log("\nTo write these dates: npx tsx scripts/backfill-won-at.ts --apply");
      return;
    }

    // Only leads still empty at the moment of writing, in one transaction.
    const results = await prisma.$transaction(
      dated.map((p) => prisma.lead.updateMany({ where: { id: p.id, wonAt: null }, data: { wonAt: p.wonAt } }))
    );
    const written = results.reduce((n, r) => n + r.count, 0);
    console.log(`\nWrote wonAt on ${written} lead${written === 1 ? "" : "s"}.` +
      (written < dated.length ? ` ${dated.length - written} had a date set in the meantime and were left alone.` : ""));
  } catch (err) {
    // Only the error's type: a connection error's message can include the
    // database host.
    const code = (err as { code?: unknown } | null)?.code;
    console.error("The backfill failed:", err instanceof Error ? err.name : "unknown error", typeof code === "string" ? code : "");
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
