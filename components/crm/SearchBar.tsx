"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STAGE_LABELS } from "@/lib/crm-constants";

type Result = { id: string; name: string; businessName: string | null; stage: string };

export default function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`/admin/crm/leads/${id}`);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-[220px]">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search leads..."
        className="w-full bg-blue-800/60 text-white placeholder-blue-300 text-xs rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-400"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 mt-1 bg-white rounded-md shadow-lg border border-gray-200 overflow-hidden z-50">
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
    </div>
  );
}
