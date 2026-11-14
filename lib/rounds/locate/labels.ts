import type { Label } from "./fit";

// What Locate asks Claude to read from a screenshot, and checking what comes
// back: every street-name label and road-number shield on the map, with its
// centre in the image's pixels and the way its text runs. Asked for as
// structured output (a JSON schema), so the answer is always this shape;
// it is still checked here, and anything odd is dropped. Pure.

export const LABEL_SCHEMA = {
  type: "object",
  properties: {
    labels: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["street", "road_number"] },
          name: { type: "string" },
          x: { type: "number" },
          y: { type: "number" },
          angle: { type: "number" },
        },
        required: ["kind", "name", "x", "y", "angle"],
        additionalProperties: false,
      },
    },
  },
  required: ["labels"],
  additionalProperties: false,
} as const;

export function labelPrompt(width: number, height: number): string {
  return [
    `This is a ${width} by ${height} pixel phone screenshot of a map (a satellite map with street names, from a running app), with a faint yellow grid every 100 pixels numbered at the edges.`,
    "List every street-name label and every road-number shield (such as A3024 or B3397) shown on the map.",
    "For each: kind (street or road_number); name, spelled as on a street sign in normal capitals (Upper Deacon Road, not UPPER DEACON ROAD); x and y, the centre of the label in this image's pixels (x from the left, y from the top); angle, the direction the text runs in degrees clockwise from left-to-right horizontal, between -90 and 90 (text rising to the right is negative, text reading downwards is near 90, upwards near -90). For a shield, angle 0.",
    "Leave out: names cut off at the edge of the map or hidden behind buttons; place and area names (towns, estates, districts); shops, schools, parks and other points of interest; the app's own buttons and text; the grid numbers.",
    "If a street's name appears in several places, list each one.",
  ].join("\n");
}

const MAX_LABELS = 80;

// The labels in an answer, kept only where they make sense for this image.
export function parseReading(json: unknown, width: number, height: number): Label[] {
  if (!json || typeof json !== "object" || !Array.isArray((json as { labels?: unknown }).labels)) throw new Error("The answer has no list of labels.");
  const out: Label[] = [];
  for (const item of (json as { labels: unknown[] }).labels.slice(0, MAX_LABELS)) {
    if (!item || typeof item !== "object") continue;
    const l = item as Record<string, unknown>;
    const name = typeof l.name === "string" ? l.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
    const kind = l.kind === "road_number" ? "ref" : l.kind === "street" ? "street" : null;
    const x = Number(l.x);
    const y = Number(l.y);
    let angle = Number(l.angle);
    if (!kind || !name || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > width || y > height) continue;
    if (!Number.isFinite(angle)) angle = 0;
    // Text runs the same way at a and a + 180.
    angle = ((((angle + 90) % 180) + 180) % 180) - 90;
    out.push({ kind, name, x, y, angle });
  }
  return out;
}
