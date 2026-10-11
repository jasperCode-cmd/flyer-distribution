"use client";

import { useEffect, useRef, useState } from "react";
import type { BulkOutcome, BulkPlan } from "@/lib/application-bulk";
import { trapTab } from "./profit-ui";

// The confirmation summary for "Move to distributors", then the result.
// Opening it only previews; nothing is written until "Move" is pressed.

type Stage =
  | { name: "loading" }
  | { name: "preview"; plan: BulkPlan }
  | { name: "moving"; plan: BulkPlan }
  | { name: "result"; results: BulkOutcome[] }
  | { name: "error"; message: string };

function Group({
  title,
  tone = "default",
  items,
}: {
  title: string;
  tone?: "default" | "muted" | "bad" | "good";
  items: { key: string; text: React.ReactNode }[];
}) {
  if (items.length === 0) return null;
  const heading =
    tone === "bad" ? "text-red-800" : tone === "muted" ? "text-gray-600" : tone === "good" ? "text-green-800" : "text-blue-900";
  return (
    <section className="mt-4 first:mt-0">
      <h4 className={`text-xs font-bold uppercase tracking-wide ${heading}`}>
        {title} ({items.length})
      </h4>
      <ul className="mt-1.5 divide-y divide-gray-100 rounded-md border border-gray-200">
        {items.map((item) => (
          <li key={item.key} className="px-3 py-2 text-sm text-gray-800 break-words">
            {item.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

const BY: Record<string, string> = { phone: "same phone number", email: "same email" };

export default function ApplicationBulkMove({
  ids,
  onMoved,
  onClose,
}: {
  ids: string[];
  onMoved: (results: BulkOutcome[]) => void;
  onClose: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ name: "loading" });
  // Names from the summary, for a result whose application has since gone.
  const [names, setNames] = useState<Record<string, string>>({});
  const dialogRef = useRef<HTMLDivElement>(null);
  const busy = stage.name === "loading" || stage.name === "moving";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/crm/applications/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "preview", ids }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setStage({ name: "error", message: data.error || `Something went wrong (${res.status}).` });
        else {
          const plan: BulkPlan = data.plan;
          setNames(
            Object.fromEntries(
              [...plan.create, ...plan.match, ...plan.linked, ...plan.cannot].map((a) => [a.id, a.fullName])
            )
          );
          setStage({ name: "preview", plan });
        }
      } catch {
        if (!cancelled) setStage({ name: "error", message: "Couldn't reach the server. Check your connection and try again." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  useEffect(() => {
    if (stage.name === "loading" || stage.name === "moving") return;
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, [stage.name]);

  async function move(plan: BulkPlan) {
    setStage({ name: "moving", plan });
    try {
      const res = await fetch("/api/crm/applications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "move", ids, confirmed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStage({ name: "error", message: data.error || `Something went wrong (${res.status}).` });
        return;
      }
      setStage({ name: "result", results: data.results });
      onMoved(data.results);
    } catch {
      setStage({
        name: "error",
        message: "Couldn't reach the server, so it isn't known how many were moved. Close this and check the list.",
      });
    }
  }

  const plan = stage.name === "preview" || stage.name === "moving" ? stage.plan : null;
  const toMove = plan ? plan.create.length + plan.match.length : 0;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-move-title"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          trapTab(e, dialogRef.current);
        }}
        className="bg-white w-full sm:max-w-lg rounded-t-xl sm:rounded-xl flex flex-col max-h-[92dvh] sm:max-h-[85vh]"
      >
        <div className="px-5 pt-5 pb-3 border-b border-gray-100">
          <h3 id="bulk-move-title" className="text-sm font-bold text-blue-900">
            {stage.name === "result" ? "Moved to distributors" : "Move to distributors"}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {stage.name === "result"
              ? "Each application was handled on its own."
              : `${ids.length} selected. Check the summary before anything is created.`}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4" aria-live="polite">
          {stage.name === "loading" && <p className="text-sm text-gray-500">Checking the selection against your distributors...</p>}
          {stage.name === "error" && (
            <p role="alert" className="text-sm text-red-700">
              {stage.message}
            </p>
          )}
          {plan && (
            <>
              <Group
                title="New distributors to create"
                items={plan.create.map((a) => ({ key: a.id, text: a.fullName }))}
              />
              <Group
                title="Match an existing distributor, linked instead of duplicated"
                items={plan.match.map((a) => ({
                  key: a.id,
                  text: (
                    <>
                      {a.fullName}{" "}
                      <span className="text-gray-500">
                        {a.distributor.id
                          ? `links to ${a.distributor.name} (${BY[a.by]})`
                          : `links to ${a.distributor.name}, created from an earlier application in this selection (${BY[a.by]})`}
                      </span>
                    </>
                  ),
                }))}
              />
              <Group
                title="Already linked, will be skipped"
                tone="muted"
                items={plan.linked.map((a) => ({
                  key: a.id,
                  text: (
                    <>
                      {a.fullName} <span className="text-gray-500">already linked to {a.distributor.name}</span>
                    </>
                  ),
                }))}
              />
              <Group
                title="Can't be moved"
                tone="bad"
                items={plan.cannot.map((a) => ({ key: a.id, text: `${a.fullName}: ${a.reason}` }))}
              />
              <p className="mt-4 text-xs text-gray-500">
                New and matched applications are marked Approved. Each one is saved on its own, so if one fails the
                others still go through.
              </p>
            </>
          )}
          {stage.name === "result" && (
            <Result
              results={stage.results.map((r) => ({ ...r, fullName: r.fullName || names[r.id] || "Unknown application" }))}
            />
          )}
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {stage.name === "result" || stage.name === "error" ? (
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold py-2.5 rounded-md"
            >
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-md disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                data-autofocus
                onClick={() => plan && move(plan)}
                disabled={busy || toMove === 0}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold py-2.5 rounded-md"
              >
                {stage.name === "moving"
                  ? "Moving..."
                  : stage.name === "loading"
                    ? "Checking..."
                    : toMove === 0
                      ? "Nothing to move"
                      : `Move ${toMove} to distributors`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Result({ results }: { results: BulkOutcome[] }) {
  const created = results.filter((r) => r.result === "created");
  const linked = results.filter((r) => r.result === "linked");
  const skipped = results.filter((r) => r.result === "skipped");
  const failed = results.filter((r) => r.result === "failed");
  return (
    <>
      <p className="text-sm text-gray-800">
        {created.length} created, {linked.length} linked to an existing distributor, {skipped.length} skipped,{" "}
        <span className={failed.length ? "font-semibold text-red-700" : ""}>{failed.length} failed</span>.
      </p>
      <div className="mt-3">
        <Group
          title="Failed"
          tone="bad"
          items={failed.map((r) => ({
            key: r.id,
            text: `${r.fullName}: ${r.result === "failed" ? r.reason : ""}`,
          }))}
        />
        <Group
          title="Created as new distributors"
          tone="good"
          items={created.map((r) => ({ key: r.id, text: r.fullName }))}
        />
        <Group
          title="Linked to an existing distributor"
          tone="good"
          items={linked.map((r) => ({
            key: r.id,
            text: (
              <>
                {r.fullName}{" "}
                <span className="text-gray-500">
                  linked to {r.result === "linked" ? `${r.distributor.name} (${BY[r.by]})` : ""}
                </span>
              </>
            ),
          }))}
        />
        <Group
          title="Skipped, already linked"
          tone="muted"
          items={skipped.map((r) => ({
            key: r.id,
            text: (
              <>
                {r.fullName}
                {r.result === "skipped" && r.distributor && (
                  <span className="text-gray-500"> already linked to {r.distributor.name}</span>
                )}
              </>
            ),
          }))}
        />
      </div>
    </>
  );
}
