import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { decimalToPence } from "./money";
import { WON_STAGES } from "./lead-stage";
import type { CostCategory, PayType, ProfitJob } from "./profit";
import { dbDateToInput, dbMonthToInput, type ExpenseRecord } from "./expenses";

// The Profit page reads leads directly: whatever is in Won or Completed
// right now is a job, however it got there, with nothing copied or synced.
// A lead that leaves those stages drops off the page; its cost lines stay
// in the database and come back with it. Scrapped leads stay hidden, as
// they are everywhere else in the CRM.
export const PROFIT_LEAD_WHERE = {
  stage: { in: [...WON_STAGES] },
  scrapped: false,
} satisfies Prisma.LeadWhereInput;

export const PROFIT_LEAD_SELECT = {
  id: true,
  name: true,
  businessName: true,
  business: true,
  stage: true,
  wonAt: true,
  dealValue: true,
  amountPaid: true,
  leafletQuantity: true,
  printingIncluded: true,
  designIncluded: true,
  isRetainer: true,
  retainerMonthlyPence: true,
  retainerStart: true,
  retainerEnd: true,
  costs: {
    orderBy: { createdAt: "asc" },
    include: { distributor: { select: { name: true } } },
  },
} satisfies Prisma.LeadSelect;

// Newest win first; jobs with no known won date last.
export const PROFIT_LEAD_ORDER = [
  { wonAt: { sort: "desc", nulls: "last" } },
  { name: "asc" },
] satisfies Prisma.LeadOrderByWithRelationInput[];

export type ProfitLeadRow = Prisma.LeadGetPayload<{ select: typeof PROFIT_LEAD_SELECT }>;

export function toProfitJob(lead: ProfitLeadRow): ProfitJob {
  return {
    leadId: lead.id,
    name: lead.name,
    businessName: lead.businessName,
    business: lead.business,
    stage: lead.stage,
    wonAt: lead.wonAt ? lead.wonAt.toISOString() : null,
    dealPence: decimalToPence(lead.dealValue),
    paidPence: decimalToPence(lead.amountPaid),
    leafletQuantity: lead.leafletQuantity,
    printingIncluded: lead.printingIncluded,
    designIncluded: lead.designIncluded,
    isRetainer: lead.isRetainer,
    retainerMonthlyPence: lead.retainerMonthlyPence,
    retainerStart: dbMonthToInput(lead.retainerStart),
    retainerEnd: dbMonthToInput(lead.retainerEnd),
    costs: lead.costs.map((c) => ({
      id: c.id,
      category: c.category as CostCategory,
      distributorId: c.distributorId,
      distributorName: c.distributor?.name ?? null,
      payType: (c.payType as PayType | null) ?? null,
      ratePence: c.ratePence,
      leafletCount: c.leafletCount,
      amountPence: c.amountPence,
      label: c.label,
      note: c.note,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

type ProfitDb = Pick<PrismaClient, "lead">;

// One job as the Profit page shows it, or null if the lead is not
// currently on the page (not Won or Completed, scrapped, or gone).
export async function loadProfitJob(db: ProfitDb, leadId: string): Promise<ProfitJob | null> {
  const lead = await db.lead.findFirst({ where: { id: leadId, ...PROFIT_LEAD_WHERE }, select: PROFIT_LEAD_SELECT });
  return lead ? toProfitJob(lead) : null;
}

export const EXPENSE_ORDER = [{ createdAt: "desc" }] satisfies Prisma.ExpenseOrderByWithRelationInput[];

export function toExpenseRecord(row: Prisma.ExpenseGetPayload<object>): ExpenseRecord {
  return {
    id: row.id,
    label: row.label,
    category: row.category,
    amountPence: row.amountPence,
    kind: row.kind,
    date: dbDateToInput(row.date),
    startMonth: dbMonthToInput(row.startMonth),
    endMonth: dbMonthToInput(row.endMonth),
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    business: row.business,
  };
}
