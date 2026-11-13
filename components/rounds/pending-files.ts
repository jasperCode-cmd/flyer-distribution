// Files chosen on the new-round page, handed to the round's own page when it
// opens straight after (kept in this tab's memory only: never stored, never
// sent anywhere), so the work goes on there. Refreshing or reopening the
// round later starts without them: choosing the same files again picks up
// where the work stopped.

export type HandedFile = { file: File; sha256: string };

const handed = new Map<string, HandedFile[]>();

export function handOver(roundId: string, files: HandedFile[]): void {
  handed.set(roundId, files);
}

export function handedOver(roundId: string): HandedFile[] | null {
  return handed.get(roundId) ?? null;
}

export function clearHandedOver(roundId: string): void {
  handed.delete(roundId);
}
