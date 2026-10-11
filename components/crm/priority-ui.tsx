import { LEVEL_LABELS, type PriorityLevel, type PrioritySubject } from "@/lib/priorities";

// Pieces shared by the Priorities page and the Dashboard's Top priorities.

const LEVEL_CHIP: Record<PriorityLevel, string> = {
  URGENT: "bg-red-100 text-red-800 ring-red-200",
  HIGH: "bg-amber-100 text-amber-900 ring-amber-200",
  NORMAL: "bg-blue-50 text-blue-800 ring-blue-200",
  LOW: "bg-gray-100 text-gray-700 ring-gray-200",
};

export function LevelChip({ level }: { level: PriorityLevel }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${LEVEL_CHIP[level]}`}
    >
      {LEVEL_LABELS[level]}
    </span>
  );
}

export function OverdueTag() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white">
      Overdue
    </span>
  );
}

export function subjectName(subject: PrioritySubject): string | null {
  return subject.kind === "none" ? null : subject.name;
}

// Where Open goes: the lead, or the application. A task with no lead has
// nowhere to open.
export function subjectHref(subject: PrioritySubject): string | null {
  if (subject.kind === "lead") return `/admin/crm/leads/${subject.id}`;
  if (subject.kind === "application") return `/admin/crm/applications/${subject.id}`;
  return null;
}

// The second line under a name: the business, or what an applicant is.
export function subjectNote(subject: PrioritySubject): string | null {
  if (subject.kind === "lead") {
    const business = subject.businessName?.trim();
    return business && business !== subject.name ? business : null;
  }
  if (subject.kind === "application") return "Distributor applicant";
  return null;
}
