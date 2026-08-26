"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Tag = { id: string; name: string; color: string; _count?: { leads: number } };

const SWATCHES = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777"];

export default function TagManager({ tags: initialTags }: { tags: Tag[] }) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [name, setName] = useState("");
  const [color, setColor] = useState(SWATCHES[0]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function createTag(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/crm/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), color }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong.");
      return;
    }

    const { tag } = await res.json();
    setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)));
    setName("");
  }

  async function deleteTag(id: string) {
    setTags((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/crm/tags/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-4">
      <form onSubmit={createTag} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-blue-900 mb-3">Create Tag</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Color</label>
            <div className="flex gap-1.5">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  className={`w-7 h-7 rounded-full border-2 ${color === c ? "border-blue-900" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white text-sm font-bold px-4 py-2 rounded-md"
          >
            Create
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </form>

      <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-blue-900 mb-3">All Tags</h2>
        {tags.length === 0 ? (
          <p className="text-sm text-gray-400">No tags yet.</p>
        ) : (
          <ul className="space-y-2">
            {tags.map((t) => (
              <li key={t.id} className="flex items-center justify-between">
                <span
                  className="text-xs font-medium px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: t.color }}
                >
                  {t.name}
                </span>
                <div className="flex items-center gap-3">
                  {t._count && (
                    <span className="text-xs text-gray-400">{t._count.leads} lead(s)</span>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteTag(t.id)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
