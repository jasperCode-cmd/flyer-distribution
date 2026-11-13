import "server-only";
import { mappablePostcodes } from "@/lib/area-planner/data";
import { AREA_PAGES } from "@/lib/area-pages";

// Finding a place to centre the alignment map on, from our own data only
// (no outside geocoder): a postcode district or sector ("BH24", "BH24 1"),
// or a town or neighbourhood the website's area pages list ("Ringwood",
// "Bitterne Park"), which stands for its postcode districts.

export type Place = { label: string; detail: string; bbox: [number, number, number, number] };

export const MAX_PLACES = 8;

const tidy = (s: string) => s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function union(boxes: [number, number, number, number][]): [number, number, number, number] {
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ];
}

// Each place name the area pages know, with the districts it sits in.
function placeNames(): Map<string, { name: string; codes: Set<string> }> {
  const names = new Map<string, { name: string; codes: Set<string> }>();
  const add = (name: string, codes: string[]) => {
    const key = tidy(name);
    if (!key) return;
    const entry = names.get(key) ?? { name, codes: new Set<string>() };
    for (const c of codes) entry.codes.add(c);
    names.set(key, entry);
  };
  for (const page of Object.values(AREA_PAGES)) {
    add(page.name, page.postcodes.map((p) => p.code));
    for (const p of page.postcodes) for (const place of p.places) add(place, [p.code]);
  }
  return names;
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const q = tidy(query);
  if (q.length < 2) return [];
  const postcodes = await mappablePostcodes();
  const byCode = new Map(postcodes.map((p) => [p.code, p]));
  const out: Place[] = [];

  const asCode = query.toUpperCase().replace(/\s+/g, " ").trim();
  const codes = postcodes
    .filter((p) => p.code.startsWith(asCode) || p.code.replace(" ", "") === asCode.replace(" ", ""))
    .sort((a, b) => (a.kind === b.kind ? a.code.localeCompare(b.code, "en", { numeric: true }) : a.kind === "district" ? -1 : 1));
  for (const p of codes.slice(0, MAX_PLACES)) {
    out.push({ label: p.code, detail: p.kind === "district" ? "Postcode district" : "Postcode sector", bbox: p.bbox });
  }

  for (const [key, entry] of placeNames()) {
    if (out.length >= MAX_PLACES) break;
    if (!key.split(" ").some((word, i, words) => words.slice(i).join(" ").startsWith(q))) continue;
    const boxes = [...entry.codes].map((c) => byCode.get(c)?.bbox).filter((b): b is [number, number, number, number] => !!b);
    if (boxes.length === 0) continue;
    out.push({ label: entry.name, detail: [...entry.codes].sort().join(", "), bbox: union(boxes) });
  }
  return out.slice(0, MAX_PLACES);
}
