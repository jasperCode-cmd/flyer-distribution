"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ created: number; skippedRows: number[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setSubmitting(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/crm/import", { method: "POST", body: formData });
    const json = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(json.error ?? "Import failed.");
      return;
    }

    setResult(json);
    router.refresh();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-blue-900 mb-2">Import Leads</h1>
      <p className="text-sm text-gray-500 mb-4">
        One-time import from a CSV export (e.g. from Google Sheets). Expected columns
        (case-insensitive, any of these names work): <strong>name</strong>, phone, email,
        postcode, business/organisation, area/address, deal value, quantity, target areas,
        and notes (becomes an initial activity entry per lead).
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 space-y-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-700 file:text-white file:text-sm file:font-semibold hover:file:bg-blue-800"
        />

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {result && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            Imported {result.created} lead(s).
            {result.skippedRows.length > 0 &&
              ` Skipped ${result.skippedRows.length} row(s) with no name (rows: ${result.skippedRows.join(", ")}).`}
          </p>
        )}

        <button
          type="submit"
          disabled={!file || submitting}
          className="bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-md text-sm"
        >
          {submitting ? "Importing..." : "Import CSV"}
        </button>
      </form>
    </div>
  );
}
