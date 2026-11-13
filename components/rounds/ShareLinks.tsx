"use client";

import { useState } from "react";
import type { ReportLinkView } from "@/lib/rounds/types";
import { api, send, ukDate } from "./rounds-api";

// "Share with client": a public, read-only report link for one round or for
// all of a lead's rounds. The link is shown once, when it is made (only a
// hash of it is kept); each link shows when it was made and last viewed,
// and can be revoked at once. An expiry date is optional.

type Props = { scope: { roundId: string } | { leadId: string }; links: ReportLinkView[]; onChanged: () => void };

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(new Date(iso)) : "Never";

const STATE_TEXT: Record<ReportLinkView["state"], string> = { active: "Live", revoked: "Revoked", expired: "Expired" };

export default function ShareLinks({ scope, links, onChanged }: Props) {
  const [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const what = "roundId" in scope ? "this round" : "all of this lead's rounds";

  async function make() {
    setBusy(true);
    setError(null);
    try {
      const reply = await api<{ path: string }>("/api/crm/route-reports", send("POST", { ...scope, expiresOn: expiresOn || null }));
      setMade(`${window.location.origin}${reply.path}`);
      setCopied(false);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this link? The client won't be able to open it any more.")) return;
    setError(null);
    try {
      await api(`/api/crm/route-reports/${id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">
        A public, read-only page showing {what}: the map with the start and end of each route left off, dates, postcode sectors and distance. No distributor names, notes or prices.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm text-gray-700">
          <span className="block text-xs font-semibold text-gray-600">Expires (optional)</span>
          <input type="date" min={ukDate()} value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <button type="button" onClick={make} disabled={busy} className="rounded-md bg-blue-900 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
          {busy ? "Making the link..." : "Share with client"}
        </button>
      </div>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      {made && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3 text-sm" role="status">
          <p className="font-semibold text-green-900">Link made. Copy it now: it won&apos;t be shown again.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input readOnly value={made} className="min-w-0 flex-1 rounded border border-green-300 bg-white px-2 py-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard?.writeText(made).catch(() => {});
                setCopied(true);
              }}
              className="rounded-md border border-green-400 bg-white px-2 py-1 text-xs font-semibold text-green-900"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
      {links.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 text-sm">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">
                  <span className={l.state === "active" ? "text-green-700" : "text-gray-500"}>{STATE_TEXT[l.state]}</span>
                  {l.scope === "lead" && "roundId" in scope ? " (all of the lead's rounds)" : ""}
                </p>
                <p className="text-xs text-gray-600">
                  Made {when(l.createdAt)} · Last viewed {when(l.lastViewedAt)}
                  {l.expiresAt ? ` · Expires ${when(new Date(new Date(l.expiresAt).getTime() - 1).toISOString()).split(",")[0]}` : ""}
                </p>
              </div>
              {l.state === "active" && (
                <button type="button" onClick={() => revoke(l.id)} className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
