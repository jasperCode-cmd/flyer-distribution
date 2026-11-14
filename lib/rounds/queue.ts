import type { RoundScreenshotView } from "./types";

// Working through a round's screenshots one at a time: each one's state, the
// progress, which comes next, and matching files picked in the browser to
// the round's screenshots by their fingerprint (the SHA-256 of the file), so
// picking the same files again carries on where the work stopped. Pure.

// "review": lined up and traced automatically, waiting to be accepted;
// "needs": auto line-up couldn't place it, so it is to line up by hand.
export type QueueStatus = "todo" | "lined" | "traced" | "saved" | "skipped" | "review" | "needs";

export const STATUS_LABELS: Record<QueueStatus, string> = {
  todo: "To do",
  lined: "Lined up",
  traced: "Traced",
  saved: "Saved",
  skipped: "Skipped",
  review: "Ready for review",
  needs: "Needs line-up",
};

// What the database says about a screenshot: saved once its traced line is
// saved, lined up once its alignment is. ("Traced" is a line not yet saved,
// and "Skipped" is for this visit only; neither is kept.)
export function statusOf(shot: Pick<RoundScreenshotView, "routeLengthM" | "alignment">): QueueStatus {
  if (shot.routeLengthM !== null) return "saved";
  if (shot.alignment) return "lined";
  return "todo";
}

export type Progress = { total: number; saved: number; skipped: number; review: number; label: string };

export function progressOf(statuses: QueueStatus[]): Progress {
  const saved = statuses.filter((s) => s === "saved").length;
  const skipped = statuses.filter((s) => s === "skipped").length;
  const review = statuses.filter((s) => s === "review").length;
  const total = statuses.length;
  return { total, saved, skipped, review, label: `${saved} of ${total} done${review ? `, ${review} ready for review` : ""}${skipped ? `, ${skipped} skipped` : ""}` };
}

// The next one still to work on after `from`: the first later one neither
// saved nor skipped, else the first such from the start; -1 when none is
// left. `open` says which can be worked on here (its file is to hand).
export function nextToDo(statuses: QueueStatus[], from: number, open: (i: number) => boolean = () => true): number {
  // Ones waiting for review are reviewed, not worked through.
  const waiting = (i: number) => statuses[i] !== "saved" && statuses[i] !== "skipped" && statuses[i] !== "review" && open(i);
  for (let i = from + 1; i < statuses.length; i++) if (waiting(i)) return i;
  for (let i = 0; i <= Math.min(from, statuses.length - 1); i++) if (waiting(i)) return i;
  return -1;
}

export type PickedFacts = { sha256: string };

export type FilePlan = {
  // A picked file (by its index) that is already one of the round's screenshots.
  matched: { file: number; shotId: string }[];
  // Picked files that are new to the round, in the order picked.
  fresh: number[];
  // The same file picked more than once (left out after the first).
  repeats: number;
  // New files left out because the round would go over the limit.
  overLimit: number;
};

export function planFiles(files: PickedFacts[], shots: Pick<RoundScreenshotView, "id" | "sha256">[], limit: number): FilePlan {
  const known = new Map(shots.filter((s) => s.sha256).map((s) => [s.sha256!, s.id]));
  const seen = new Set<string>();
  const plan: FilePlan = { matched: [], fresh: [], repeats: 0, overLimit: 0 };
  let room = Math.max(0, limit - shots.length);
  files.forEach((f, i) => {
    if (seen.has(f.sha256)) {
      plan.repeats++;
      return;
    }
    seen.add(f.sha256);
    const shotId = known.get(f.sha256);
    if (shotId) plan.matched.push({ file: i, shotId });
    else if (room > 0) {
      plan.fresh.push(i);
      room--;
    } else plan.overLimit++;
  });
  return plan;
}
