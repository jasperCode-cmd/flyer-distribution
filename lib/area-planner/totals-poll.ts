// Asking for a project's totals while the server is still working them out:
// until they arrive (then not again), only while the tab is visible (a
// hidden tab waits until it is shown again), and not after the server
// refuses (the project gone, or the session ended), since asking again
// wouldn't help. Plain logic with its waits passed in, so it can be tested
// without a browser. No server imports.

export type TotalsAnswer<T> = { ok: true; totals: T | null } | { ok: false; status: number };

export type TotalsPollDeps<T> = {
  ask(): Promise<TotalsAnswer<T>>;
  sleep(ms: number): Promise<void>;
  // Resolves at once while the tab is visible, otherwise once it is shown
  // again (or the poll is stopped).
  whenVisible(): Promise<void>;
  stopped(): boolean;
};

// A second, then a little longer each time, up to five seconds.
export function totalsWait(tries: number): number {
  return Math.min(5000, 1000 + tries * 500);
}

// The totals, or null if the poll was stopped or the server refused.
export async function pollTotals<T>(deps: TotalsPollDeps<T>): Promise<T | null> {
  for (let tries = 0; ; tries++) {
    await deps.whenVisible();
    if (deps.stopped()) return null;
    const answer = await deps.ask();
    if (deps.stopped()) return null;
    if (answer.ok && answer.totals) return answer.totals;
    if (!answer.ok && answer.status >= 400 && answer.status < 500) return null;
    await deps.sleep(totalsWait(tries));
  }
}
