"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_LABELS } from "@/lib/crm-constants";

type Result = { id: string; name: string; businessName: string | null; stage: string };

// In the top bar the search is "collapsible": below 1366px, where the
// navigation needs the room, it is a search button that opens the same box
// over the bar. From 1366px up it is the box itself, as elsewhere.
export default function SearchBar({ collapsible = false }: { collapsible?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Escape hands focus back to the search button once it is showing again.
  const refocusButton = useRef(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      fetch(`/api/crm/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          setResults(d.leads ?? []);
          setOpen(true);
        })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (expanded) {
      inputRef.current?.focus();
    } else if (refocusButton.current) {
      refocusButton.current = false;
      buttonRef.current?.focus();
    }
  }, [expanded]);

  function goTo(id: string) {
    setOpen(false);
    setExpanded(false);
    setQuery("");
    router.push(`/admin/crm/leads/${id}`);
  }

  const field = (
    <>
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && collapsible && expanded) {
            setOpen(false);
            refocusButton.current = true;
            setExpanded(false);
          }
        }}
        placeholder="Search leads..."
        aria-label="Search leads"
        className="w-full bg-blue-800/60 text-white placeholder-blue-300 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400"
      />
      {open && results.length > 0 && (
        <div
          // Keeps focus in the box while a result is clicked, so the
          // top bar's search doesn't close before the click lands.
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden z-50"
        >
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => goTo(r.id)}
              className="block w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <p className="text-sm font-medium text-blue-900 truncate">{r.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {r.businessName ? `${r.businessName} · ` : ""}
                {STAGE_LABELS[r.stage] ?? r.stage}
              </p>
            </button>
          ))}
        </div>
      )}
    </>
  );

  if (!collapsible) {
    return (
      <div ref={containerRef} className="relative w-full max-w-[220px]">
        {field}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onBlur={(e) => {
        if (expanded && !containerRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          setExpanded(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="Search leads"
        aria-expanded={expanded}
        onClick={() => setExpanded(true)}
        className={`min-[1366px]:hidden flex items-center justify-center w-9 h-9 rounded-md text-blue-100 hover:bg-blue-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 ${
          expanded ? "invisible" : ""
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4 4" />
        </svg>
      </button>
      <div
        className={`min-[1366px]:static min-[1366px]:block min-[1366px]:w-48 min-[1366px]:translate-y-0 min-[1366px]:bg-transparent min-[1366px]:p-0 ${
          expanded ? "absolute right-0 top-1/2 -translate-y-1/2 z-50 w-64 rounded-md bg-blue-900 p-1" : "hidden"
        }`}
      >
        <div className="relative">{field}</div>
      </div>
    </div>
  );
}
