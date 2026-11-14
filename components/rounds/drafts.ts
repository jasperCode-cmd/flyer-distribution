import type { LocateRecord } from "@/lib/rounds/alignment";
import type { AutoDraft } from "@/lib/rounds/auto";
import { addRecords } from "@/lib/rounds/locate/draft";

// Automatic line-ups waiting for review, kept in this browser only (in
// IndexedDB, so a reload keeps them), never in the database until accepted.
// Where the browser won't keep them (a private window), they last only as
// long as the page. Also a log of what Locate spent on each screenshot (added
// up if it is run again) and why it couldn't place one, so the running cost
// and the reasons survive a reload; the cost goes with the line-up into the
// database when it is saved. Browser only.

export type StoredDraft = {
  id: string;
  roundId: string;
  sha256: string | null;
  savedAt: string;
  draft: AutoDraft;
  thumb: Blob | null;
};

export type LocateLogEntry = { id: string; roundId: string; at: string; record: LocateRecord | null; placed: boolean; reason: string };

const DB_NAME = "fdh-rounds";
const STORE = "drafts";
const LOG = "locate";
const memory = new Map<string, StoredDraft>();
const logMemory = new Map<string, LocateLogEntry>();
let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" }).createIndex("roundId", "roundId");
        if (!db.objectStoreNames.contains(LOG)) db.createObjectStore(LOG, { keyPath: "id" }).createIndex("roundId", "roundId");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraft(d: StoredDraft): Promise<void> {
  memory.set(d.id, d);
  const db = await open();
  if (!db) return;
  try {
    await done(db.transaction(STORE, "readwrite").objectStore(STORE).put(d));
  } catch {
    // Kept in memory for this visit.
  }
}

export async function loadDrafts(roundId: string): Promise<StoredDraft[]> {
  const db = await open();
  if (db) {
    try {
      const rows = await done(db.transaction(STORE, "readonly").objectStore(STORE).index("roundId").getAll(roundId));
      for (const r of rows as StoredDraft[]) memory.set(r.id, r);
    } catch {
      // Memory only.
    }
  }
  return [...memory.values()].filter((d) => d.roundId === roundId);
}

export async function removeDrafts(ids: string[]): Promise<void> {
  for (const id of ids) memory.delete(id);
  const db = await open();
  if (!db) return;
  try {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    await Promise.all(ids.map((id) => done(store.delete(id))));
  } catch {
    // Gone from memory at least.
  }
}

// What Locate spent on a screenshot, added to anything spent on it before.
export async function logLocate(roundId: string, id: string, record: LocateRecord | null, placed: boolean, reason: string): Promise<LocateLogEntry> {
  const before = logMemory.get(id) ?? (await loadLocateLog(roundId)).find((e) => e.id === id);
  const entry: LocateLogEntry = { id, roundId, at: new Date().toISOString(), record: addRecords(before?.record, record), placed, reason };
  logMemory.set(id, entry);
  const db = await open();
  if (db) {
    try {
      await done(db.transaction(LOG, "readwrite").objectStore(LOG).put(entry));
    } catch {
      // Kept in memory for this visit.
    }
  }
  return entry;
}

export async function loadLocateLog(roundId: string): Promise<LocateLogEntry[]> {
  const db = await open();
  if (db) {
    try {
      const rows = await done(db.transaction(LOG, "readonly").objectStore(LOG).index("roundId").getAll(roundId));
      for (const r of rows as LocateLogEntry[]) if (!logMemory.has(r.id)) logMemory.set(r.id, r);
    } catch {
      // Memory only.
    }
  }
  return [...logMemory.values()].filter((e) => e.roundId === roundId);
}
