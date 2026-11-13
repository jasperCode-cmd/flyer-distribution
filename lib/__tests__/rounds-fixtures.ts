import sharp from "sharp";
import type { Point, RgbaImage } from "@/lib/rounds/extract/image";

// Made-up MapMyRun screenshots for the route tracing tests, drawn to what
// was measured on the real ones: a north-up hybrid map (here a
// satellite-like texture with roads, roofs, a lake and a pool), the route as
// a bright blue line (rgb(7, 155, 229), anti-aliased by the renderer) with a
// thin white edge, a red start dot and a green end dot with white rings,
// street labels in white capitals in a continuous dark halo, drawn over the
// line and hiding it, blue map icons and a blue location dot. At the top, a plain dark
// band down to row 357 of 2048 holds the status bar, the back button and the
// NORMAL / HYBRID / SATELLITE tabs, with a blue underline under HYBRID and a
// blue location arrow. There is no band at the bottom: the map runs to the
// bottom edge, with the "Route Flyover" button (white with blue text, solid
// blue, or dark) and the Apple Maps logo and "Legal" floating over it, and
// the route can run under or past them to the edge. Drawn at the working
// size (740 by 1600) from a seed, so every run draws the same pixels, then
// scaled down to half, as the real fixtures are, with the true route, dots
// and map edges alongside.

export type Truth = {
  // In the scaled-down image's pixels.
  lines: Point[][];
  start: Point | null;
  end: Point | null;
  mapTop: number;
  mapBottom: number;
  // Blue things that are not route: nothing traced should be near these.
  decoys: Point[];
  // The floating Route Flyover button, as [x0, y0, x1, y1].
  pill: [number, number, number, number];
};

export type Fixture = { name: string; image: RgbaImage; png: Buffer; truth: Truth };

type Spec = {
  name: string;
  seed: number;
  dark: boolean;
  lines: Point[][];
  start: Point | null;
  end: Point | null;
  labels: { at: Point; text: string; angle: number }[];
  icons: Point[];
  locationDot: Point | null;
  pool: Point | null;
  lake: Point | null;
  pill: "white" | "blue" | "dark";
};

export const FULL = { width: 740, height: 1600 };
// The plain band at the top: row 357 of 2048 on the real screenshots.
export const TOP_BAND = Math.round((FULL.height * 357) / 2048);
// The Route Flyover button, floating over the bottom of the map.
const PILL = { x0: 260, y0: 1488, x1: 480, y1: 1552 };
const LINE_W = 10;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth noise in 0..1 at a given cell size.
function valueNoise(rand: () => number, width: number, height: number, cell: number): Float32Array {
  const gw = Math.ceil(width / cell) + 2;
  const gh = Math.ceil(height / cell) + 2;
  const grid = new Float32Array(gw * gh).map(() => rand());
  const out = new Float32Array(width * height);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < height; y++) {
    const gy = y / cell;
    const y0 = Math.floor(gy);
    const ty = smooth(gy - y0);
    for (let x = 0; x < width; x++) {
      const gx = x / cell;
      const x0 = Math.floor(gx);
      const tx = smooth(gx - x0);
      const v00 = grid[y0 * gw + x0];
      const v10 = grid[y0 * gw + x0 + 1];
      const v01 = grid[(y0 + 1) * gw + x0];
      const v11 = grid[(y0 + 1) * gw + x0 + 1];
      out[y * width + x] = (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
    }
  }
  return out;
}

// Greens, browns and greys with fine grain, like rooftops and gardens from above.
function satellite(seed: number): Buffer {
  const { width, height } = FULL;
  const rand = mulberry32(seed);
  const broad = valueNoise(rand, width, height, 90);
  const mid = valueNoise(rand, width, height, 22);
  const buf = Buffer.alloc(width * height * 4);
  const palette: [number, number, number][] = [
    [52, 74, 42],
    [78, 96, 58],
    [112, 104, 82],
    [128, 126, 120],
    [92, 84, 70],
  ];
  for (let i = 0; i < width * height; i++) {
    const v = broad[i] * 0.65 + mid[i] * 0.35;
    const f = Math.min(palette.length - 1.001, v * (palette.length - 1));
    const k = Math.floor(f);
    const t = f - k;
    const grain = (rand() - 0.5) * 34;
    for (let c = 0; c < 3; c++) {
      buf[i * 4 + c] = Math.max(0, Math.min(255, palette[k][c] * (1 - t) + palette[k + 1][c] * t + grain));
    }
    buf[i * 4 + 3] = 255;
  }
  return buf;
}

const pts = (line: Point[]) => line.map(([x, y]) => `${x},${y}`).join(" ");

function svgFor(spec: Spec, rand: () => number): string {
  const { width, height } = FULL;
  const parts: string[] = [];
  // Roads: pale grey lines along and across the route's streets.
  const roads: string[] = [];
  for (const line of spec.lines) roads.push(`<polyline points="${pts(line)}" fill="none" stroke="rgb(176,172,160)" stroke-width="16" stroke-linejoin="round"/>`);
  for (let k = 0; k < 7; k++) {
    const y = 200 + rand() * 1200;
    roads.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y + (rand() - 0.5) * 200}" stroke="rgb(170,166,156)" stroke-width="${8 + rand() * 8}"/>`);
  }
  parts.push(...roads);
  // Roofs: small rectangles, a few slate blue-grey.
  for (let k = 0; k < 160; k++) {
    const x = rand() * width;
    const y = TOP_BAND + rand() * (height - TOP_BAND);
    const colour = rand() < 0.15 ? "rgb(72,88,112)" : rand() < 0.5 ? "rgb(150,92,74)" : "rgb(96,96,100)";
    parts.push(`<rect x="${x}" y="${y}" width="${10 + rand() * 18}" height="${10 + rand() * 14}" fill="${colour}" transform="rotate(${(rand() - 0.5) * 30} ${x} ${y})"/>`);
  }
  if (spec.lake) parts.push(`<ellipse cx="${spec.lake[0]}" cy="${spec.lake[1]}" rx="90" ry="55" fill="rgb(36,62,92)"/>`);
  if (spec.pool) parts.push(`<rect x="${spec.pool[0] - 14}" y="${spec.pool[1] - 9}" width="28" height="18" rx="4" fill="rgb(60,170,205)"/>`);
  // The route, with the thin white edge MapMyRun draws round it, then what
  // MapMyRun draws over it.
  for (const line of spec.lines) {
    parts.push(`<polyline points="${pts(line)}" fill="none" stroke="rgb(250,252,252)" stroke-width="${LINE_W + 4}" stroke-linejoin="round" stroke-linecap="round"/>`);
  }
  for (const line of spec.lines) {
    parts.push(`<polyline points="${pts(line)}" fill="none" stroke="rgb(7,155,229)" stroke-width="${LINE_W}" stroke-linejoin="round" stroke-linecap="round"/>`);
  }
  for (const label of spec.labels) {
    const [x, y] = label.at;
    parts.push(
      `<text x="${x}" y="${y}" transform="rotate(${label.angle} ${x} ${y})" text-anchor="middle" dominant-baseline="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" font-weight="bold" fill="white" stroke="rgb(30,30,30)" stroke-width="6" stroke-linejoin="round" paint-order="stroke">${label.text.toUpperCase()}</text>`
    );
  }
  for (const [x, y] of spec.icons) {
    parts.push(`<circle cx="${x}" cy="${y}" r="15" fill="rgb(10,132,255)" stroke="white" stroke-width="2"/>`);
    parts.push(`<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="white"/>`);
  }
  if (spec.locationDot) {
    const [x, y] = spec.locationDot;
    parts.push(`<circle cx="${x}" cy="${y}" r="26" fill="rgb(7,155,229)" fill-opacity="0.18"/>`);
    parts.push(`<circle cx="${x}" cy="${y}" r="11" fill="rgb(7,155,229)" stroke="white" stroke-width="4"/>`);
  }
  if (spec.start) parts.push(`<circle cx="${spec.start[0]}" cy="${spec.start[1]}" r="15" fill="rgb(228,38,38)" stroke="white" stroke-width="4"/>`);
  if (spec.end) parts.push(`<circle cx="${spec.end[0]}" cy="${spec.end[1]}" r="15" fill="rgb(42,186,72)" stroke="white" stroke-width="4"/>`);
  // Floating over the map at the bottom: the Route Flyover button and the
  // Apple Maps logo and "Legal".
  const pillFill = spec.pill === "white" ? "rgb(255,255,255)" : spec.pill === "blue" ? "rgb(7,155,229)" : "rgb(36,36,38)";
  const pillInk = spec.pill === "white" ? "rgb(7,155,229)" : "rgb(255,255,255)";
  parts.push(
    `<rect x="${PILL.x0}" y="${PILL.y0}" width="${PILL.x1 - PILL.x0}" height="${PILL.y1 - PILL.y0}" rx="${(PILL.y1 - PILL.y0) / 2}" fill="${pillFill}" fill-opacity="${spec.pill === "dark" ? 0.88 : 1}"/>`,
    `<text x="${(PILL.x0 + PILL.x1) / 2}" y="${(PILL.y0 + PILL.y1) / 2 + 9}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="24" font-weight="bold" fill="${pillInk}">Route Flyover</text>`,
    `<text x="22" y="${height - 26}" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="bold" fill="white" stroke="rgb(40,40,40)" stroke-width="2" paint-order="stroke">Maps</text>`,
    `<text x="96" y="${height - 26}" font-family="DejaVu Sans, Arial, sans-serif" font-size="15" fill="white" stroke="rgb(40,40,40)" stroke-width="1" paint-order="stroke">Legal</text>`
  );
  // The plain dark band at the top: status bar, back button, the map tabs
  // with a blue underline under HYBRID, and a blue location arrow.
  const tabY = TOP_BAND - 58;
  parts.push(
    `<rect x="0" y="0" width="${width}" height="${TOP_BAND}" fill="rgb(22,22,24)"/>`,
    `<text x="70" y="58" font-family="DejaVu Sans, Arial, sans-serif" font-size="28" font-weight="bold" fill="white">9:41</text>`,
    ...[0, 1, 2, 3].map((k) => `<rect x="${590 + k * 12}" y="${60 - k * 6}" width="8" height="${8 + k * 6}" fill="white"/>`),
    `<rect x="650" y="40" width="50" height="22" rx="6" fill="none" stroke="white" stroke-width="3"/>`,
    `<polyline points="44,118 28,136 44,154" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<polygon points="690,116 706,152 690,144 674,152" fill="rgb(7,155,229)"/>`,
    ...["NORMAL", "HYBRID", "SATELLITE"].map(
      (t, k) => `<text x="${(width / 3) * (k + 0.5)}" y="${tabY}" text-anchor="middle" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="bold" fill="white">${t}</text>`
    ),
    `<rect x="${width / 2 - 80}" y="${tabY + 18}" width="160" height="5" fill="rgb(7,155,229)"/>`
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join("")}</svg>`;
}

export const SPECS: Spec[] = [
  {
    // A loop round the block, back to near where it started.
    name: "loop",
    seed: 11,
    dark: false,
    lines: [
      [
        [180, 1180],
        [180, 900],
        [330, 760],
        [560, 760],
        [560, 1020],
        [420, 1180],
        [215, 1180],
      ],
      // Down past the right of the Route Flyover button to the bottom edge.
      [
        [560, 1020],
        [660, 1120],
        [660, FULL.height],
      ],
    ],
    start: [180, 1180],
    end: [215, 1180],
    labels: [
      { at: [440, 760], text: "Ringwood Road", angle: 0 },
      { at: [560, 900], text: "Oak Close", angle: 90 },
    ],
    icons: [
      [420, 640],
      [200, 1350],
    ],
    locationDot: [300, 1010],
    pool: [470, 900],
    lake: null,
    pill: "white",
  },
  {
    // Up a road with two cul-de-sacs walked there and back, ending elsewhere.
    name: "branches",
    seed: 23,
    dark: true,
    lines: [
      [
        [120, 1350],
        [300, 1180],
        [300, 820],
        [520, 600],
        [640, 600],
      ],
      [
        [300, 1000],
        [470, 1000],
      ],
      [
        [300, 1180],
        [150, 1040],
      ],
      // Under the (blue) Route Flyover button to the bottom edge.
      [
        [300, 1180],
        [420, 1300],
        [420, FULL.height],
      ],
    ],
    start: [120, 1350],
    end: [640, 600],
    labels: [{ at: [300, 900], text: "Church Lane", angle: 90 }],
    icons: [
      [150, 700],
      [600, 1100],
      [520, 1380],
    ],
    locationDot: null,
    pool: [430, 1150],
    lake: [560, 420],
    pill: "blue",
  },
  {
    // The middle of a longer round: in from the left, out at the top and the
    // right of the map, so neither dot is on screen.
    name: "middle",
    seed: 37,
    dark: false,
    lines: [
      [
        [0, 1100],
        [260, 1100],
        [260, 600],
        [480, 380],
        [480, TOP_BAND],
      ],
      [
        [260, 820],
        [520, 820],
        [520, 1240],
        [FULL.width, 1240],
      ],
      // Down beside the Route Flyover button to the bottom edge.
      [
        [520, 1240],
        [520, FULL.height],
      ],
    ],
    start: null,
    end: null,
    labels: [
      { at: [130, 1100], text: "High Street", angle: 0 },
      { at: [390, 820], text: "Mill Lane", angle: 0 },
    ],
    icons: [[620, 500]],
    locationDot: [120, 400],
    pool: [380, 1000],
    lake: [640, 1420],
    pill: "dark",
  },
];

const HALF = 0.5;

export async function makeFixture(spec: Spec): Promise<Fixture> {
  const rand = mulberry32(spec.seed * 7919);
  const full = await sharp(satellite(spec.seed), { raw: { width: FULL.width, height: FULL.height, channels: 4 } })
    .composite([{ input: Buffer.from(svgFor(spec, rand)) }])
    .png()
    .toBuffer();
  const png = await sharp(full).resize(Math.round(FULL.width * HALF), Math.round(FULL.height * HALF), { kernel: "lanczos3" }).png().toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const scale = (p: Point): Point => [p[0] * HALF, p[1] * HALF];
  const decoys: Point[] = [
    ...spec.icons,
    ...(spec.locationDot ? [spec.locationDot] : []),
    ...(spec.pool ? [spec.pool] : []),
    // The middle of the Route Flyover button, the HYBRID underline and the location arrow.
    [(PILL.x0 + PILL.x1) / 2 - 40, (PILL.y0 + PILL.y1) / 2] as Point,
    [FULL.width / 2, TOP_BAND - 38] as Point,
    [690, 140] as Point,
  ].map(scale);
  return {
    name: spec.name,
    png,
    image: { width: info.width, height: info.height, data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) },
    truth: {
      lines: spec.lines.map((l) => l.map(scale)),
      start: spec.start && scale(spec.start),
      end: spec.end && scale(spec.end),
      mapTop: TOP_BAND * HALF,
      mapBottom: FULL.height * HALF,
      decoys,
      pill: [PILL.x0 * HALF, PILL.y0 * HALF, PILL.x1 * HALF, PILL.y1 * HALF],
    },
  };
}

// Points every `step` pixels along lines, for comparing traced and true routes.
export function samplePoints(lines: Point[][], step = 1): Point[] {
  const out: Point[] = [];
  for (const line of lines) {
    for (let k = 1; k < line.length; k++) {
      const [x1, y1] = line[k - 1];
      const [x2, y2] = line[k];
      const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step));
      for (let s = 0; s < n; s++) out.push([x1 + ((x2 - x1) * s) / n, y1 + ((y2 - y1) * s) / n]);
    }
    if (line.length) out.push(line[line.length - 1]);
  }
  return out;
}

export function distanceToLines(p: Point, lines: Point[][]): number {
  let best = Infinity;
  for (const line of lines) {
    for (let k = 1; k < line.length; k++) {
      const [x1, y1] = line[k - 1];
      const [x2, y2] = line[k];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len2 = dx * dx + dy * dy;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - x1) * dx + (p[1] - y1) * dy) / len2));
      best = Math.min(best, Math.hypot(p[0] - (x1 + t * dx), p[1] - (y1 + t * dy)));
    }
    if (line.length === 1) best = Math.min(best, Math.hypot(p[0] - line[0][0], p[1] - line[0][1]));
  }
  return best;
}
