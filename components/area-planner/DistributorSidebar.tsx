"use client";

import { useMemo, useRef, useState } from "react";
import type { PlannerDistributor } from "@/lib/area-planner/types";

// Active distributors with their colours. Drag one onto the map to assign
// them (onto an area, or onto empty map for a new 800m circle), or tap one
// and then tap the map, which also works without a mouse. On a phone the
// list is a row of chips above the map: swipe sideways to scroll it, drag
// down onto the map to place someone.

type Props = {
  distributors: PlannerDistributor[];
  areaCounts: Map<string, number>;
  assigningId: string | null;
  disabled: boolean;
  onTap: (id: string) => void;
  onDrop: (id: string, clientX: number, clientY: number) => void;
};

const DRAG_START_PX = 6;

function Swatch({ colour }: { colour: string | null }) {
  return colour ? (
    <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: colour }} aria-hidden="true" />
  ) : (
    <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-dashed border-gray-400" aria-hidden="true" title="Gets a colour when first placed" />
  );
}

export default function DistributorSidebar({ distributors, areaCounts, assigningId, disabled, onTap, onDrop }: Props) {
  const [query, setQuery] = useState("");
  const [ghost, setGhost] = useState<{ id: string; name: string; colour: string | null; x: number; y: number } | null>(null);
  const press = useRef<{ id: string; x: number; y: number; dragging: boolean } | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return distributors.filter((d) => d.active && (!q || d.name.toLowerCase().includes(q)));
  }, [distributors, query]);

  function pointerDown(e: React.PointerEvent<HTMLButtonElement>, d: PlannerDistributor) {
    if (disabled || (e.pointerType === "mouse" && e.button !== 0)) return;
    press.current = { id: d.id, x: e.clientX, y: e.clientY, dragging: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function pointerMove(e: React.PointerEvent<HTMLButtonElement>, d: PlannerDistributor) {
    const p = press.current;
    if (!p || p.id !== d.id) return;
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) >= DRAG_START_PX) p.dragging = true;
    if (p.dragging) setGhost({ id: d.id, name: d.name, colour: d.colour, x: e.clientX, y: e.clientY });
  }

  function pointerUp(e: React.PointerEvent<HTMLButtonElement>, d: PlannerDistributor) {
    const p = press.current;
    press.current = null;
    setGhost(null);
    if (!p || p.id !== d.id) return;
    if (p.dragging) onDrop(d.id, e.clientX, e.clientY);
    else onTap(d.id);
  }

  function cancel() {
    press.current = null;
    setGhost(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <label className="sr-only" htmlFor="ap-distributor-search">
        Search distributors
      </label>
      <input
        id="ap-distributor-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search distributors"
        className="mb-2 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm"
      />
      {disabled && <p className="mb-2 text-xs text-gray-500">Reopen the project to place distributors.</p>}
      {shown.length === 0 ? (
        <p className="text-xs text-gray-500">{distributors.some((d) => d.active) ? "No distributor matches." : "No active distributors."}</p>
      ) : (
        <ul className="flex min-h-0 flex-1 gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:overflow-x-hidden" aria-label="Active distributors">
          {shown.map((d) => {
            const count = areaCounts.get(d.id) ?? 0;
            const assigning = assigningId === d.id;
            return (
              <li key={d.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  disabled={disabled}
                  aria-pressed={assigning}
                  aria-label={`${d.name}${count ? `, ${count} area${count === 1 ? "" : "s"} on this project` : ""}. Drag onto the map, or press then click the map.`}
                  onPointerDown={(e) => pointerDown(e, d)}
                  onPointerMove={(e) => pointerMove(e, d)}
                  onPointerUp={(e) => pointerUp(e, d)}
                  onPointerCancel={cancel}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onTap(d.id);
                    }
                  }}
                  className={`flex w-full touch-pan-x select-none items-center gap-2 rounded-full border px-3 py-1.5 text-left text-sm lg:touch-pan-y lg:rounded-md ${
                    assigning ? "border-blue-600 bg-blue-50 ring-2 ring-blue-300" : "border-gray-200 bg-white hover:bg-gray-50"
                  } disabled:cursor-not-allowed disabled:opacity-60 ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
                >
                  <Swatch colour={d.colour} />
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-900">{d.name}</span>
                  {count > 0 && <span className="shrink-0 text-xs tabular-nums text-gray-500">{count}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {ghost && (
        <div
          className="pointer-events-none fixed z-[2000] flex -translate-x-1/2 -translate-y-full items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-sm font-medium shadow-lg"
          style={{ left: ghost.x, top: ghost.y - 8 }}
        >
          <Swatch colour={ghost.colour} />
          {ghost.name}
        </div>
      )}
    </div>
  );
}
