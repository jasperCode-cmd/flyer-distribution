import type { AutoDraft } from "@/lib/rounds/auto";

// Automatic line-ups waiting for review, kept in this browser only (in
// IndexedDB, so a reload keeps them), never in the database until accepted.
// Where the browser won't keep them (a private window), they last only as
// long as the page. Browser only.

export type StoredDraft = {
  id: string;
  roundId: string;
  sha256: string | null;
  savedAt: string;
  draft: AutoDraft;
  thumb: Blob | null;
};

const DB_NAME = "fdh-rounds";
const STORE = "drafts";
const memory = new Map<string, StoredDraft>();
let opening: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("roundId", "roundId");
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
