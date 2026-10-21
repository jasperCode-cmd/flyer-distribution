// When a CRM tab asks the server for the navigation's status (the bell, the
// counts beside Inbox, Applications and Priorities): every two minutes, only
// while the tab is visible, and not at all once nobody has touched the page
// for 30 minutes, until someone does again. Showing the tab again counts as
// touching it. Plain logic with the clock and timers passed in, so it can be
// tested without a browser. No server imports.

export const STATUS_POLL_MS = 2 * 60 * 1000;
export const STATUS_IDLE_STOP_MS = 30 * 60 * 1000;
// A tab shown again asks at once unless it asked this recently (the server
// keeps the status for a minute anyway).
export const STATUS_SHOWN_AGAIN_MS = 60 * 1000;

export type PollClock = {
  now(): number;
  setTimeout(run: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  visible(): boolean;
};

export type StatusPoller = {
  // Asks now (unless the tab is hidden) and from then on every interval.
  start(): void;
  // Someone used the page: wakes a poller that had stopped for inactivity.
  activity(): void;
  // The tab was hidden or shown.
  visibilityChanged(): void;
  // Asks now, as after a navigation or a change on the page, and restarts the interval.
  refresh(): void;
  stop(): void;
  // For tests.
  state(): { waiting: boolean; asleep: boolean; asked: number };
};

export function createStatusPoller(
  ask: () => void,
  clock: PollClock,
  { intervalMs = STATUS_POLL_MS, idleMs = STATUS_IDLE_STOP_MS, shownAgainMs = STATUS_SHOWN_AGAIN_MS } = {}
): StatusPoller {
  let timer: unknown = null;
  let lastActivity = clock.now();
  let lastAsked = -Infinity;
  let asleep = false;
  let stopped = true;
  let asked = 0;

  function clear() {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  }

  function askNow() {
    lastAsked = clock.now();
    asked++;
    ask();
  }

  // The next ask, an interval after the last one.
  function schedule() {
    clear();
    if (stopped || asleep || !clock.visible()) return;
    const wait = Math.max(0, lastAsked + intervalMs - clock.now());
    timer = clock.setTimeout(tick, wait);
  }

  function tick() {
    timer = null;
    if (stopped || !clock.visible()) return;
    if (clock.now() - lastActivity >= idleMs) {
      asleep = true;
      return;
    }
    askNow();
    schedule();
  }

  return {
    start() {
      stopped = false;
      asleep = false;
      lastActivity = clock.now();
      if (clock.visible()) askNow();
      schedule();
    },
    activity() {
      lastActivity = clock.now();
      if (!asleep || stopped) return;
      asleep = false;
      if (clock.visible()) askNow();
      schedule();
    },
    visibilityChanged() {
      if (stopped) return;
      if (!clock.visible()) {
        clear();
        return;
      }
      lastActivity = clock.now();
      asleep = false;
      if (clock.now() - lastAsked >= shownAgainMs) askNow();
      schedule();
    },
    refresh() {
      if (stopped) return;
      lastActivity = clock.now();
      asleep = false;
      if (clock.visible()) askNow();
      schedule();
    },
    stop() {
      stopped = true;
      clear();
    },
    state() {
      return { waiting: timer !== null, asleep, asked };
    },
  };
}
