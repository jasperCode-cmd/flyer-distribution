// How long each step of an Area Planner request took on the server, sent
// as a Server-Timing header so the browser's network panel (and the page's
// own timing) can show server time apart from network and drawing. Only
// step names and times go in it, never data. Pure.

export type StepTimer = {
  step<T>(name: string, run: () => Promise<T> | T): Promise<T>;
};

export const untimed: StepTimer = {
  step: async (_name, run) => run(),
};

export class ServerTiming implements StepTimer {
  private readonly started = performance.now();
  private readonly steps: { name: string; ms: number }[] = [];

  async step<T>(name: string, run: () => Promise<T> | T): Promise<T> {
    const t0 = performance.now();
    try {
      return await run();
    } finally {
      this.steps.push({ name, ms: performance.now() - t0 });
    }
  }

  // Steps of the same name (each part's households, say) are added up.
  totals(): Map<string, number> {
    const sums = new Map<string, number>();
    for (const s of this.steps) sums.set(s.name, (sums.get(s.name) ?? 0) + s.ms);
    return sums;
  }

  elapsed(): number {
    return performance.now() - this.started;
  }

  header(): string {
    const parts = [...this.totals()].map(([name, ms]) => `${name};dur=${ms.toFixed(1)}`);
    parts.push(`total;dur=${this.elapsed().toFixed(1)}`);
    return parts.join(", ");
  }

  headers(): HeadersInit {
    return { "Server-Timing": this.header() };
  }
}
