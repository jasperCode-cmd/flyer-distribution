import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/distributor-applications";

// Small pieces shared by the Applications list, an open application and the
// import preview.

export const STATUS_BADGE: Record<ApplicationStatus, string> = {
  NEW: "bg-blue-50 text-blue-700",
  CONTACTED: "bg-yellow-50 text-yellow-800",
  APPROVED: "bg-green-50 text-green-700",
  NOT_SUITABLE: "bg-gray-100 text-gray-600",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-block whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[status]}`}>
      {APPLICATION_STATUS_LABELS[status]}
    </span>
  );
}

export function yesNo(value: boolean | null): string {
  return value === null ? "-" : value ? "Yes" : "No";
}

export function formatReceived(iso: string, withTime = false): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Europe/London",
  });
}
