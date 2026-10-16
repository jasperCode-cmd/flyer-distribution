"use client";

import { useEffect, useId, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { formatPence, penceToInput } from "@/lib/money";
import { ALL_TIME, monthLabel } from "@/lib/profit";
import { expenseMonths, expensesForPeriod } from "@/lib/profit-overview";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  MAX_EXPENSE_LABEL,
  MAX_EXPENSE_NOTE,
  ukToday,
  type ExpenseCategory,
  type ExpenseKind,
  type ExpenseRecord,
} from "@/lib/expenses";
import { trapTab } from "./profit-ui";
import { EXPENSE_BUSINESSES, EXPENSE_BUSINESS_LABELS } from "@/lib/business";

// Business expenses: not tied to any job. One-off on a date, or every month
// from a start month. Ending a monthly expense sets its end month, so the
// months before it stay counted; delete is for one added by mistake. Each is
// FDH's, LDB's or shared (the default), and a shared one counts under both.

function formatDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function describeWhen(e: ExpenseRecord): string {
  if (e.kind === "ONE_OFF") return e.date ? `On ${formatDay(e.date)}` : "-";
  if (!e.startMonth) return "-";
  return `Every month from ${monthLabel(e.startMonth)}${e.endMonth ? `, ending ${monthLabel(e.endMonth)}` : ", ongoing"}`;
}

type FormState = { mode: "add" } | { mode: "edit"; expense: ExpenseRecord; ending?: boolean };

export default function ProfitExpenses({
  expenses,
  setExpenses,
  month,
  currentMonth,
}: {
  expenses: ExpenseRecord[];
  setExpenses: Dispatch<SetStateAction<ExpenseRecord[]>>;
  month: string;
  currentMonth: string;
}) {
  const [category, setCategory] = useState<ExpenseCategory | "">("");
  const [kind, setKind] = useState<ExpenseKind | "">("");
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; kind: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const inPeriod = useMemo(() => expensesForPeriod(expenses, month, currentMonth), [expenses, month, currentMonth]);
  const shown = inPeriod.filter((e) => (!category || e.category === category) && (!kind || e.kind === kind));
  const counted = (e: ExpenseRecord) => {
    const months = expenseMonths(e, currentMonth);
    return e.amountPence * (month === ALL_TIME ? months.length : months.includes(month) ? 1 : 0);
  };
  const totalPence = shown.reduce((sum, e) => sum + counted(e), 0);
  const period = month === ALL_TIME ? "All time" : monthLabel(month);

  async function send(url: string, method: string, body?: unknown) {
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      return res.ok ? { data } : { error: (data.error as string) || `Something went wrong (${res.status}).` };
    } catch {
      return { error: "Couldn't reach the server. Check your connection and try again." };
    }
  }

  async function save(state: FormState, payload: Record<string, string>): Promise<string | null> {
    const result =
      state.mode === "add"
        ? await send("/api/crm/profit/expenses", "POST", payload)
        : await send(`/api/crm/profit/expenses/${state.expense.id}`, "PATCH", payload);
    if (result.error) return result.error;
    const saved: ExpenseRecord = result.data.expense;
    setExpenses((prev) => (state.mode === "add" ? [saved, ...prev] : prev.map((e) => (e.id === saved.id ? saved : e))));
    setForm(null);
    setToast({ text: state.mode === "add" ? "Expense added." : state.ending ? "Expense ended." : "Expense saved.", kind: "success" });
    return null;
  }

  async function remove(expense: ExpenseRecord) {
    const result = await send(`/api/crm/profit/expenses/${expense.id}`, "DELETE");
    setConfirmDelete(null);
    if (result.error) {
      setToast({ text: result.error, kind: "error" });
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
    setToast({ text: "Expense deleted.", kind: "success" });
  }

  const selectCls = "rounded-md border border-gray-300 bg-white px-3 py-2 text-sm";
  const future = (e: ExpenseRecord) => expenseMonths(e, currentMonth).length === 0;

  function actions(e: ExpenseRecord) {
    if (confirmDelete === e.id) {
      return (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="text-xs text-gray-600">
            {e.kind === "MONTHLY" ? "Delete it from every month? To stop it from now on, use End." : "Delete this expense?"}
          </span>
          <button type="button" onClick={() => remove(e)} className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white">
            Yes, delete
          </button>
          <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700">
            Keep
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap justify-end gap-1">
        <button type="button" onClick={() => setForm({ mode: "edit", expense: e })} aria-label={`Edit ${e.label}`} className="rounded-md px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">
          Edit
        </button>
        {e.kind === "MONTHLY" && !e.endMonth && (
          <button
            type="button"
            onClick={() => setForm({ mode: "edit", expense: e, ending: true })}
            aria-label={`End ${e.label}`}
            className="rounded-md px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50"
          >
            End
          </button>
        )}
        <button type="button" onClick={() => setConfirmDelete(e.id)} aria-label={`Delete ${e.label}`} className="rounded-md px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">
          Delete
        </button>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-gray-500">
        Business expenses, not tied to a job. {period}: {shown.length} {shown.length === 1 ? "expense" : "expenses"} counting{" "}
        <span className="font-semibold tabular-nums text-gray-900">{formatPence(totalPence)}</span>.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="expense-filter-category" className="mb-1 block text-xs font-medium text-gray-600">
            Category
          </label>
          <select id="expense-filter-category" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory | "")} className={selectCls}>
            <option value="">All categories</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {EXPENSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="expense-filter-kind" className="mb-1 block text-xs font-medium text-gray-600">
            Kind
          </label>
          <select id="expense-filter-kind" value={kind} onChange={(e) => setKind(e.target.value as ExpenseKind | "")} className={selectCls}>
            <option value="">One-off and monthly</option>
            <option value="ONE_OFF">One-off</option>
            <option value="MONTHLY">Every month</option>
          </select>
        </div>
        <button
          type="button"
          onClick={() => setForm({ mode: "add" })}
          className="w-full rounded-md bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 sm:ml-auto sm:w-auto"
        >
          Add expense
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
          {expenses.length === 0 ? "No expenses yet. Add rent, software, fuel cards and the like here." : `No expenses match, ${period}.`}
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b border-gray-200 text-xs text-gray-500">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Expense</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Category and business</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">When</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Counts, {period}</th>
                  <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {shown.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-gray-900">{e.label}</p>
                      {e.note && <p className="text-xs text-gray-500">{e.note}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">
                      {EXPENSE_CATEGORY_LABELS[e.category]}
                      <p className="text-xs text-gray-500">{EXPENSE_BUSINESS_LABELS[e.business ?? "SHARED"]}</p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700">
                      {describeWhen(e)}
                      {future(e) && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">Not counted yet</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-gray-900">
                      {formatPence(e.amountPence)}
                      {e.kind === "MONTHLY" && <span className="text-xs text-gray-500"> a month</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-gray-900">{formatPence(counted(e))}</td>
                    <td className="px-3 py-2.5">
                      {actions(e)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-2 md:hidden">
            {shown.map((e) => (
              <li key={e.id} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 break-words">{e.label}</p>
                    <p className="text-xs text-gray-500">
                      {EXPENSE_CATEGORY_LABELS[e.category]}, {EXPENSE_BUSINESS_LABELS[e.business ?? "SHARED"]}
                    </p>
                  </div>
                  <p className="shrink-0 text-right tabular-nums">
                    <span className="font-semibold text-gray-900">{formatPence(e.amountPence)}</span>
                    {e.kind === "MONTHLY" && <span className="block text-[11px] text-gray-500">a month</span>}
                  </p>
                </div>
                <p className="mt-1 text-sm text-gray-700">
                  {describeWhen(e)}
                  {future(e) && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">Not counted yet</span>}
                </p>
                {e.note && <p className="mt-0.5 text-xs text-gray-500 break-words">{e.note}</p>}
                <p className="mt-1 text-xs text-gray-600">
                  Counts, {period}: <span className="font-semibold tabular-nums text-gray-900">{formatPence(counted(e))}</span>
                </p>
                <div className="mt-2 border-t border-gray-100 pt-2">
                  {actions(e)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {form && (
        <ExpenseForm
          key={form.mode === "add" ? "add" : `${form.expense.id}-${form.ending ? "end" : "edit"}`}
          state={form}
          currentMonth={currentMonth}
          onCancel={() => setForm(null)}
          onSave={(payload) => save(form, payload)}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 z-[80] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${
            toast.kind === "success" ? "bg-gray-900" : "bg-red-600"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function ExpenseForm({
  state,
  currentMonth,
  onCancel,
  onSave,
}: {
  state: FormState;
  currentMonth: string;
  onCancel: () => void;
  onSave: (payload: Record<string, string>) => Promise<string | null>;
}) {
  const id = useId();
  const existing = state.mode === "edit" ? state.expense : null;
  const ending = state.mode === "edit" && !!state.ending;
  const [f, setF] = useState(() => ({
    label: existing?.label ?? "",
    category: existing?.category ?? "OFFICE",
    amount: existing ? penceToInput(existing.amountPence) : "",
    kind: existing?.kind ?? "ONE_OFF",
    date: existing?.date ?? ukToday(new Date()),
    startMonth: existing?.startMonth ?? currentMonth,
    endMonth: ending ? currentMonth : existing?.endMonth ?? "",
    note: existing?.note ?? "",
    business: existing?.business ?? "SHARED",
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null;
    const target = ending
      ? dialogRef.current?.querySelector<HTMLElement>(`#${CSS.escape(`${id}-end`)}`)
      : dialogRef.current?.querySelector<HTMLElement>("input, select, textarea");
    target?.focus();
    return () => returnTo?.focus?.();
  }, [ending, id]);

  const set = (key: keyof typeof f, value: string) => setF((prev) => ({ ...prev, [key]: value }));
  const inputCls = "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const problem = await onSave(f);
    setSaving(false);
    if (problem) setError(problem);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          trapTab(e, dialogRef.current);
        }}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-xl"
      >
        <h3 id={`${id}-title`} className="text-sm font-bold text-blue-900">
          {state.mode === "add" ? "Add expense" : ending ? `End ${existing?.label}` : "Edit expense"}
        </h3>
        {ending && (
          <p className="mt-1 text-xs text-gray-500">
            Choose the last month it counts. Every month up to then stays in the figures.
          </p>
        )}
        <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
          <div>
            <label htmlFor={`${id}-label`} className="mb-1 block text-xs font-medium text-gray-700">Label</label>
            <input id={`${id}-label`} value={f.label} maxLength={MAX_EXPENSE_LABEL} onChange={(e) => set("label", e.target.value)} placeholder="Office rent" className={inputCls} />
          </div>
          <div>
            <label htmlFor={`${id}-business`} className="mb-1 block text-xs font-medium text-gray-700">Business</label>
            <select id={`${id}-business`} value={f.business} onChange={(e) => set("business", e.target.value)} className={inputCls}>
              {EXPENSE_BUSINESSES.map((b) => (
                <option key={b} value={b}>
                  {b === "SHARED" ? "Shared (counts under both)" : EXPENSE_BUSINESS_LABELS[b]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${id}-category`} className="mb-1 block text-xs font-medium text-gray-700">Category</label>
              <select id={`${id}-category`} value={f.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{EXPENSE_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-amount`} className="mb-1 block text-xs font-medium text-gray-700">
                Amount (£){f.kind === "MONTHLY" ? " a month" : ""}
              </label>
              <input id={`${id}-amount`} inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="45.00" className={inputCls} />
            </div>
          </div>
          <fieldset>
            <legend className="mb-1 block text-xs font-medium text-gray-700">How often</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["ONE_OFF", "One-off"],
                  ["MONTHLY", "Every month"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    f.kind === value ? "border-blue-600 bg-blue-50 text-blue-900" : "border-gray-300 text-gray-700"
                  }`}
                >
                  <input type="radio" name={`${id}-kind`} value={value} checked={f.kind === value} onChange={() => set("kind", value)} className="accent-blue-700" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {f.kind === "ONE_OFF" ? (
            <div>
              <label htmlFor={`${id}-date`} className="mb-1 block text-xs font-medium text-gray-700">Date</label>
              <input id={`${id}-date`} type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={inputCls} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor={`${id}-start`} className="mb-1 block text-xs font-medium text-gray-700">From</label>
                <input id={`${id}-start`} type="month" value={f.startMonth} onChange={(e) => set("startMonth", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor={`${id}-end`} className="mb-1 block text-xs font-medium text-gray-700">Last month (optional)</label>
                <input id={`${id}-end`} type="month" value={f.endMonth} min={f.startMonth || undefined} onChange={(e) => set("endMonth", e.target.value)} className={inputCls} />
              </div>
              <p className="col-span-2 text-xs text-gray-500">Leave the last month empty while it is ongoing.</p>
            </div>
          )}
          <div>
            <label htmlFor={`${id}-note`} className="mb-1 block text-xs font-medium text-gray-700">Note (optional)</label>
            <textarea id={`${id}-note`} rows={2} value={f.note} maxLength={MAX_EXPENSE_NOTE} onChange={(e) => set("note", e.target.value)} className={`${inputCls} resize-none`} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel} className="flex-1 rounded-md border border-gray-300 py-2.5 text-sm font-medium text-gray-700">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-md bg-blue-700 py-2.5 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-60">
              {saving ? "Saving..." : state.mode === "add" ? "Add expense" : ending ? "End expense" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
