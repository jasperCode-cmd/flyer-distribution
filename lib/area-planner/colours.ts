// Each distributor's one fixed colour on the Area Planner, its images and
// private links. Given in this order the first time a distributor is placed
// on any map, stored on the distributor and never changed. The hues are the
// dataviz reference palette's categorical slots (checked for colour-blind
// separation), less its red, which is kept for overlap warnings. Past seven
// distributors the colours repeat, so every area's label also names its
// distributor and identity never rests on colour alone.

export const DISTRIBUTOR_COLOURS = [
  "#2A78D6", // blue
  "#EB6834", // orange
  "#1BAF7A", // aqua
  "#EDA100", // yellow
  "#E87BA4", // magenta
  "#008300", // green
  "#6250D6", // violet
] as const;

// Areas with no distributor yet.
export const UNASSIGNED_COLOUR = "#8A8F98";

// Where two areas overlap.
export const OVERLAP_COLOUR = "#DC2626";

const HEX_RE = /^#[0-9A-F]{6}$/;

export function isMapColour(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value);
}

// The colour for a distributor placed for the first time: the first one no
// distributor has yet, or once all are taken, the one fewest have.
export function nextMapColour(taken: (string | null | undefined)[]): string {
  const counts = new Map<string, number>(DISTRIBUTOR_COLOURS.map((c) => [c, 0]));
  for (const colour of taken) {
    const key = colour?.toUpperCase();
    if (key && counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  let best: string = DISTRIBUTOR_COLOURS[0];
  for (const colour of DISTRIBUTOR_COLOURS) {
    if (counts.get(colour)! < counts.get(best)!) best = colour;
  }
  return best;
}

export function areaColour(distributorColour: string | null | undefined, assigned: boolean): string {
  return assigned && isMapColour(distributorColour) ? distributorColour : UNASSIGNED_COLOUR;
}
