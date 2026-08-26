import Link from "next/link";

export type KanbanLead = {
  id: string;
  name: string;
  businessName: string | null;
  dealValue: unknown;
  stage: string;
  atRisk: boolean;
  assignedTo: { id: string; name: string } | null;
  activities: { createdAt: string | Date }[];
  createdAt: string | Date;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n);
}

export default function LeadCard({ lead }: { lead: KanbanLead }) {
  return (
    <Link
      href={`/admin/crm/leads/${lead.id}`}
      className={`block bg-white rounded-md border p-3 shadow-sm hover:shadow-md transition-shadow ${
        lead.atRisk ? "border-l-4 border-l-red-500 border-y-gray-200 border-r-gray-200" : "border-gray-200"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-blue-900 truncate">{lead.name}</p>
        {lead.atRisk && (
          <span
            title="At risk"
            className="shrink-0 text-red-500 text-xs font-bold"
            aria-label="At risk"
          >
            ⚑
          </span>
        )}
      </div>
      {lead.businessName && (
        <p className="text-xs text-gray-500 truncate mt-0.5">{lead.businessName}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs font-medium text-gray-700">
          {lead.dealValue ? formatCurrency(Number(lead.dealValue)) : "—"}
        </span>
        {lead.assignedTo && (
          <span className="text-[11px] bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
            {lead.assignedTo.name.split(" ")[0]}
          </span>
        )}
      </div>
    </Link>
  );
}
