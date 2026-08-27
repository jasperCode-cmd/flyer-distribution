"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CalendarFilterBar from "./CalendarFilterBar";
import CalendarEventModal from "./CalendarEventModal";
import {
  ENTRY_LABELS,
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  applyCalendarFilters,
  dateKey,
  entriesForDay,
  entryColor,
  formatDayLong,
  formatEntryTime,
  formatMonthYear,
  isToday,
  monthGrid,
  startOfDay,
  startOfWeek,
  weekGrid,
  type CalendarEntry,
  type CalendarFilters,
} from "@/lib/calendar-constants";

type Option = { id: string; name: string };
type ViewMode = "month" | "week" | "agenda";

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "agenda", label: "Agenda" },
];

// One entry as it appears inside a day cell or agenda row. Stored events open
// the edit modal; derived Job/Task entries are read-only and link to source.
function EntryChip({
  entry,
  onEdit,
  compact,
}: {
  entry: CalendarEntry;
  onEdit: (entry: CalendarEntry) => void;
  compact?: boolean;
}) {
  const color = entryColor(entry.type);
  const label = compact ? entry.title : `${formatEntryTime(entry)} · ${entry.title}`;
  const className = `block w-full text-left truncate rounded border px-1.5 py-0.5 text-[11px] transition-shadow hover:shadow-md ${
    color.chip
  } ${entry.completed ? "line-through opacity-60" : ""}`;

  if (entry.kind === "EVENT") {
    return (
      <button type="button" onClick={() => onEdit(entry)} className={className} title={entry.title}>
        {label}
      </button>
    );
  }

  return (
    <Link href={entry.href ?? "#"} className={className} title={`${entry.title} (read-only)`}>
      {label}
    </Link>
  );
}

export default function CalendarView({
  entries,
  users,
  distributors,
  leads,
  jobs,
}: {
  entries: CalendarEntry[];
  users: Option[];
  distributors: Option[];
  leads: Option[];
  jobs: Option[];
}) {
  const router = useRouter();
  const [view, setView] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState<Date>(() => startOfDay(new Date()));
  const [filters, setFilters] = useState<CalendarFilters>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEntry | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);

  const filtered = useMemo(() => applyCalendarFilters(entries, filters), [entries, filters]);

  function openNew(day: Date | null) {
    setEditing(null);
    setDefaultDate(day);
    setModalOpen(true);
  }

  function openEdit(entry: CalendarEntry) {
    setEditing(entry);
    setDefaultDate(null);
    setModalOpen(true);
  }

  function afterChange() {
    setModalOpen(false);
    router.refresh();
  }

  function shift(direction: number) {
    setAnchor((a) => (view === "week" ? addDays(a, 7 * direction) : addMonths(a, direction)));
  }

  const periodLabel =
    view === "week"
      ? `Week of ${startOfWeek(anchor).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      : formatMonthYear(anchor);

  return (
    <div>
      <CalendarFilterBar
        filters={filters}
        onChange={setFilters}
        users={users}
        distributors={distributors}
        onAddEvent={() => openNew(null)}
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            aria-label="Previous"
            className="border border-gray-300 bg-white rounded-md px-2 py-1.5 text-xs hover:bg-gray-50"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setAnchor(startOfDay(new Date()))}
            className="border border-gray-300 bg-white rounded-md px-2.5 py-1.5 text-xs hover:bg-gray-50"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shift(1)}
            aria-label="Next"
            className="border border-gray-300 bg-white rounded-md px-2 py-1.5 text-xs hover:bg-gray-50"
          >
            ›
          </button>
        </div>
        <p className="text-sm font-bold text-blue-900">{periodLabel}</p>

        <div className="ml-auto flex items-center gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                view === v.key
                  ? "bg-blue-700 text-white"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === "month" && (
        <MonthView entries={filtered} anchor={anchor} onEdit={openEdit} onAddOnDay={openNew} />
      )}
      {view === "week" && (
        <WeekView entries={filtered} anchor={anchor} onEdit={openEdit} onAddOnDay={openNew} />
      )}
      {view === "agenda" && <AgendaView entries={filtered} anchor={anchor} onEdit={openEdit} />}

      <Legend />

      <CalendarEventModal
        open={modalOpen}
        entry={editing}
        defaultDate={defaultDate}
        users={users}
        distributors={distributors}
        leads={leads}
        jobs={jobs}
        onClose={() => setModalOpen(false)}
        onSaved={afterChange}
        onDeleted={afterChange}
      />
    </div>
  );
}

function MonthView({
  entries,
  anchor,
  onEdit,
  onAddOnDay,
}: {
  entries: CalendarEntry[];
  anchor: Date;
  onEdit: (e: CalendarEntry) => void;
  onAddOnDay: (d: Date) => void;
}) {
  const days = useMemo(() => monthGrid(anchor), [anchor]);
  const month = anchor.getMonth();

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-[11px] font-medium text-gray-500 text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEntries = entriesForDay(entries, day);
          const outside = day.getMonth() !== month;
          return (
            <div
              key={dateKey(day)}
              onDoubleClick={() => onAddOnDay(day)}
              className={`min-h-[92px] border-b border-r border-gray-100 p-1 ${
                outside ? "bg-gray-50/60" : "bg-white"
              }`}
            >
              <div className="flex items-center justify-between px-0.5">
                <span
                  className={`text-[11px] ${
                    isToday(day)
                      ? "bg-blue-700 text-white rounded-full w-5 h-5 inline-flex items-center justify-center font-bold"
                      : outside
                        ? "text-gray-300"
                        : "text-gray-500"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-0.5 mt-0.5">
                {dayEntries.slice(0, 3).map((e) => (
                  <EntryChip key={e.id} entry={e} onEdit={onEdit} compact />
                ))}
                {dayEntries.length > 3 && (
                  <p className="text-[10px] text-gray-400 px-1">+{dayEntries.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  entries,
  anchor,
  onEdit,
  onAddOnDay,
}: {
  entries: CalendarEntry[];
  anchor: Date;
  onEdit: (e: CalendarEntry) => void;
  onAddOnDay: (d: Date) => void;
}) {
  const days = useMemo(() => weekGrid(anchor), [anchor]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
      <div className="grid grid-cols-7 min-w-[720px]">
        {days.map((day) => {
          const dayEntries = entriesForDay(entries, day);
          return (
            <div key={dateKey(day)} className="border-r border-gray-100 last:border-r-0">
              <div
                className={`px-2 py-1.5 border-b border-gray-200 text-center ${
                  isToday(day) ? "bg-blue-50" : "bg-gray-50"
                }`}
              >
                <p className="text-[11px] text-gray-500">
                  {day.toLocaleDateString("en-GB", { weekday: "short" })}
                </p>
                <p
                  className={`text-sm font-bold ${
                    isToday(day) ? "text-blue-700" : "text-blue-900"
                  }`}
                >
                  {day.getDate()}
                </p>
              </div>
              <div
                onDoubleClick={() => onAddOnDay(day)}
                className="p-1 space-y-1 min-h-[220px]"
              >
                {dayEntries.length === 0 ? (
                  <p className="text-[11px] text-gray-300 text-center pt-2">—</p>
                ) : (
                  dayEntries.map((e) => <EntryChip key={e.id} entry={e} onEdit={onEdit} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({
  entries,
  anchor,
  onEdit,
}: {
  entries: CalendarEntry[];
  anchor: Date;
  onEdit: (e: CalendarEntry) => void;
}) {
  // Everything from the anchor month onward, so with the anchor on today
  // this reads as "what's coming up".
  const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1).getTime();
  const upcoming = entries.filter((e) => new Date(e.start).getTime() >= from);

  const groups = useMemo(() => {
    const map = new Map<string, { day: Date; items: CalendarEntry[] }>();
    for (const e of upcoming) {
      const d = startOfDay(new Date(e.start));
      const key = dateKey(d);
      if (!map.has(key)) map.set(key, { day: d, items: [] });
      map.get(key)!.items.push(e);
    }
    return [...map.values()].sort((a, b) => a.day.getTime() - b.day.getTime());
  }, [upcoming]);

  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <p className="text-sm text-gray-400">Nothing scheduled from this month onward.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
      {groups.map((g) => (
        <div key={dateKey(g.day)} className="p-3 sm:p-4">
          <p
            className={`text-xs font-bold mb-2 ${
              isToday(g.day) ? "text-blue-700" : "text-blue-900"
            }`}
          >
            {formatDayLong(g.day)}
            {isToday(g.day) && <span className="ml-2 font-medium text-gray-400">Today</span>}
          </p>
          <div className="space-y-1.5">
            {g.items.map((e) => (
              <div key={e.id} className="flex items-start gap-2">
                <span
                  className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${entryColor(e.type).dot}`}
                  title={ENTRY_LABELS[e.type] ?? e.type}
                />
                <div className="min-w-0 flex-1">
                  <EntryChip entry={e} onEdit={onEdit} />
                  <p className="text-[11px] text-gray-400 mt-0.5 px-1.5">
                    {[
                      ENTRY_LABELS[e.type] ?? e.type,
                      e.assignedToName,
                      e.distributorName,
                      e.kind !== "EVENT" ? "read-only" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 px-1">
      {Object.entries(ENTRY_LABELS).map(([key, label]) => (
        <span key={key} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
          <span className={`w-2 h-2 rounded-full ${entryColor(key).dot}`} />
          {label}
        </span>
      ))}
    </div>
  );
}
