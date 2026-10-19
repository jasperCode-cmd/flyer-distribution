// Reading a typed or pasted list of postcode districts and sectors for the
// Area Planner: "BH6, PO14, SO14" or "BH6 3; BH7 6". Pure and client-safe.
// Each one found becomes its own shape; everything that can't be used is
// listed with the reason, never silently dropped. Whether a code really
// exists is checked afterwards against the postcode data.

// The postcode areas the planner has data for.
export const POSTCODE_AREAS = ["BH", "SO", "PO", "SP", "DT"] as const;
export const MAX_POSTCODES = 50;

export type PostcodeKind = "district" | "sector";
export type PostcodeRequest = { input: string; code: string; kind: PostcodeKind };
export type PostcodeProblem = { input: string; reason: string };

const OUTWARD = /^[A-Z]{1,2}\d[A-Z\d]?$/;
const FULL_NO_SPACE = /^([A-Z]{1,2}\d[A-Z\d]?)(\d)[A-Z]{2}$/;
const INWARD = /^(\d)[A-Z]{2}$/;
const AREA_ONLY = /^[A-Z]{1,2}$/;

const OUTSIDE = `outside the areas the planner has data for (${POSTCODE_AREAS.slice(0, -1).join(", ")} and ${POSTCODE_AREAS.at(-1)})`;

function areaOf(outward: string): string {
  return outward.match(/^[A-Z]+/)?.[0] ?? "";
}

function covered(outward: string): boolean {
  return (POSTCODE_AREAS as readonly string[]).includes(areaOf(outward));
}

export function parsePostcodeList(text: string): { requests: PostcodeRequest[]; problems: PostcodeProblem[] } {
  const requests: PostcodeRequest[] = [];
  const problems: PostcodeProblem[] = [];
  const seen = new Set<string>();

  function add(input: string, code: string, kind: PostcodeKind) {
    if (!covered(code)) {
      problems.push({ input, reason: OUTSIDE });
      return;
    }
    if (seen.has(code)) return;
    seen.add(code);
    requests.push({ input, code, kind });
  }

  const chunks = text
    .split(/[,;\n\r\t]+/)
    .map((c) => c.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const words = chunk.toUpperCase().split(" ");
    let i = 0;
    while (i < words.length) {
      const word = words[i];
      const next = words[i + 1];
      if (OUTWARD.test(word) && next !== undefined && /^\d$/.test(next)) {
        add(`${word} ${next}`, `${word} ${next}`, "sector");
        i += 2;
        continue;
      }
      if (OUTWARD.test(word) && next !== undefined && INWARD.test(next)) {
        const sector = `${word} ${next[0]}`;
        problems.push({ input: `${word} ${next}`, reason: `a full postcode: use its sector, ${sector}` });
        i += 2;
        continue;
      }
      const full = word.match(FULL_NO_SPACE);
      if (full) {
        problems.push({ input: word, reason: `a full postcode: use its sector, ${full[1]} ${full[2]}` });
      } else if (OUTWARD.test(word)) {
        add(word, word, "district");
      } else if (AREA_ONLY.test(word)) {
        problems.push({
          input: word,
          reason: covered(`${word}1`) ? `a whole postcode area is too big: list its districts, for example ${word}1, ${word}2` : OUTSIDE,
        });
      } else {
        problems.push({ input: word, reason: "not a postcode district or sector" });
      }
      i += 1;
    }
  }

  if (requests.length > MAX_POSTCODES) {
    for (const extra of requests.splice(MAX_POSTCODES)) {
      problems.push({ input: extra.input, reason: `more than ${MAX_POSTCODES} at once: add the rest separately` });
    }
  }
  return { requests, problems };
}

// For a district that doesn't exist but reads as one of its sectors run
// together ("BH63" for "BH6 3"): that sector, to suggest.
export function sectorReading(district: string): string | null {
  const m = district.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d)$/);
  return m && OUTWARD.test(m[1]) ? `${m[1]} ${m[2]}` : null;
}
