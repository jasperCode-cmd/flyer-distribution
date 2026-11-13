"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistance, shortDate } from "@/lib/rounds/format";
import type { ReportLinkView, RoundSummary } from "@/lib/rounds/types";
import ShareLinks from "./ShareLinks";

// A lead's page: its rounds (read with the page, no extra request), adding
// one for this lead, and sharing all of them with the client.

export default function LeadRounds({ leadId, rounds, links }: { leadId: string; rounds: RoundSummary[]; links: ReportLinkView[] }) {
  const router = useRouter();
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5" aria-label="Rounds">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-blue-900">Rounds</h2>
        <Link href={`/admin/crm/rounds/new?leadId=${leadId}`} className="rounded-md border border-blue-700 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">
          Add a round
        </Link>
      </div>
      {rounds.length === 0 ? (
        <p className="text-sm text-gray-600">No rounds recorded for this lead yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {rounds.map((r) => (
            <li key={r.id}>
              <Link href={`/admin/crm/rounds/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-blue-50">
                <span className="font-medium text-gray-900">{shortDate(r.date)}</span>
                <span className="flex items-center gap-1.5 text-gray-700">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.distributor?.colour ?? "#8A8F98" }} aria-hidden="true" />
                  {r.distributor?.name ?? "No distributor"}
                </span>
                <span className="tabular-nums text-gray-800">{r.distanceM !== null ? formatDistance(r.distanceM) : "Not traced yet"}</span>
                <span className="text-xs text-gray-600">{r.sectors.map((s) => s.code).join(", ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-gray-100 pt-4">
        <h3 className="mb-2 text-sm font-bold text-gray-900">Share all of this lead&apos;s rounds with the client</h3>
        <ShareLinks scope={{ leadId }} links={links} onChanged={() => router.refresh()} />
      </div>
    </div>
  );
}
