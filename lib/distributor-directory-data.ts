import type { PrismaClient } from "@/generated/prisma/client";
import { summarizeDistributors, type DistributorSummary, type JobLead } from "./distributor-directory";

// Everything the Distributors page shows, in one go. Takes the client as a
// parameter so a local-database test can run it too.

type DirectoryDb = Pick<PrismaClient, "distributor" | "job" | "jobCost" | "calendarEvent">;

const LEAD_FIELDS = { id: true, name: true, businessName: true, wonAt: true } as const;

function jobLead(
  lead: { id: string; name: string; businessName: string | null; wonAt: Date | null },
  campaignStartDate: Date | null | undefined
): JobLead {
  return {
    leadId: lead.id,
    leadName: lead.name,
    businessName: lead.businessName,
    wonAt: lead.wonAt?.toISOString() ?? null,
    campaignStartDate: campaignStartDate?.toISOString() ?? null,
  };
}

export async function loadDistributorDirectory(db: DirectoryDb, now: Date): Promise<DistributorSummary[]> {
  const [distributors, assigned, lines, shifts] = await Promise.all([
    db.distributor.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        notes: true,
        active: true,
        // Their most recent application, when they came from one.
        applications: {
          orderBy: { receivedAt: "desc" },
          take: 1,
          select: { id: true, area: true, hasCar: true, hasLicence: true, availability: true, receivedAt: true },
        },
      },
    }),
    db.job.findMany({
      where: { distributorId: { not: null } },
      select: { distributorId: true, campaignStartDate: true, lead: { select: LEAD_FIELDS } },
    }),
    db.jobCost.findMany({
      where: { category: "DISTRIBUTOR", distributorId: { not: null } },
      select: {
        id: true,
        distributorId: true,
        payType: true,
        ratePence: true,
        leafletCount: true,
        amountPence: true,
        lead: { select: { ...LEAD_FIELDS, job: { select: { campaignStartDate: true } } } },
      },
    }),
    db.calendarEvent.findMany({
      where: {
        type: "DISTRIBUTOR_SHIFT",
        distributorId: { not: null },
        completed: false,
        OR: [{ startDateTime: { gte: now } }, { endDateTime: { gte: now } }],
      },
      orderBy: { startDateTime: "asc" },
      select: { id: true, distributorId: true, title: true, startDateTime: true, endDateTime: true, completed: true },
    }),
  ]);

  return summarizeDistributors(
    distributors.map((d) => {
      const app = d.applications[0];
      return {
        id: d.id,
        name: d.name,
        phone: d.phone,
        email: d.email,
        notes: d.notes,
        active: d.active,
        application: app
          ? {
              id: app.id,
              area: app.area,
              hasCar: app.hasCar,
              hasLicence: app.hasLicence,
              availability: app.availability,
              receivedAt: app.receivedAt.toISOString(),
            }
          : null,
      };
    }),
    assigned.map((j) => ({ ...jobLead(j.lead, j.campaignStartDate), distributorId: j.distributorId as string })),
    lines.map((c) => ({
      ...jobLead(c.lead, c.lead.job?.campaignStartDate),
      id: c.id,
      distributorId: c.distributorId as string,
      payType: c.payType,
      ratePence: c.ratePence,
      leafletCount: c.leafletCount,
      amountPence: c.amountPence,
    })),
    shifts.map((s) => ({
      id: s.id,
      distributorId: s.distributorId as string,
      title: s.title,
      startDateTime: s.startDateTime.toISOString(),
      endDateTime: s.endDateTime?.toISOString() ?? null,
      completed: s.completed,
    })),
    now
  );
}
