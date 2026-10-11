"use client";

// A plain SVG ring: no chart library. Each segment has a 2px white edge so
// neighbours stay apart, a native tooltip, and hover that the legend table
// beside it mirrors. The legend carries the names, amounts and percentages,
// so nothing depends on telling the colours apart.

export type DonutSegment = { id: string; label: string; color: string; valuePence: number; detail: string };

const SIZE = 200;
const C = SIZE / 2;
const OUTER = 94;
const INNER = 60;

function point(radius: number, angle: number): string {
  return `${(C + radius * Math.cos(angle)).toFixed(3)} ${(C + radius * Math.sin(angle)).toFixed(3)}`;
}

function arcPath(start: number, end: number): string {
  const large = end - start > Math.PI ? 1 : 0;
  return [
    `M ${point(OUTER, start)}`,
    `A ${OUTER} ${OUTER} 0 ${large} 1 ${point(OUTER, end)}`,
    `L ${point(INNER, end)}`,
    `A ${INNER} ${INNER} 0 ${large} 0 ${point(INNER, start)}`,
    "Z",
  ].join(" ");
}

// A whole ring can't be one arc, so it is drawn as two halves.
function segmentPath(start: number, end: number): string {
  if (end - start >= Math.PI * 2 - 1e-6) {
    return `${arcPath(start, start + Math.PI)} ${arcPath(start + Math.PI, start + Math.PI * 2)}`;
  }
  return arcPath(start, end);
}

export default function ProfitDonut({
  segments,
  centre,
  hovered,
  onHover,
  label,
}: {
  segments: DonutSegment[];
  centre: { value: string; caption: string };
  hovered: string | null;
  onHover: (id: string | null) => void;
  label: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.valuePence, 0);
  let angle = -Math.PI / 2;
  const arcs = segments
    .filter((s) => s.valuePence > 0)
    .map((s) => {
      const start = angle;
      angle += (s.valuePence / total) * Math.PI * 2;
      return { ...s, d: segmentPath(start, angle) };
    });
  const active = arcs.find((a) => a.id === hovered);

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-44 h-44 sm:w-48 sm:h-48 shrink-0" role="img" aria-label={label}>
      {arcs.map((a) => (
        <path
          key={a.id}
          d={a.d}
          fill={a.color}
          stroke="#ffffff"
          strokeWidth={2}
          strokeLinejoin="round"
          opacity={hovered && hovered !== a.id ? 0.35 : 1}
          onMouseEnter={() => onHover(a.id)}
          onMouseLeave={() => onHover(null)}
          className="transition-opacity duration-150"
        >
          <title>{`${a.label}: ${a.detail}`}</title>
        </path>
      ))}
      <text x={C} y={C - 4} textAnchor="middle" className="fill-gray-900" style={{ fontSize: active ? 15 : 22, fontWeight: 700 }}>
        {active ? active.label : centre.value}
      </text>
      <text x={C} y={C + 16} textAnchor="middle" className="fill-gray-500" style={{ fontSize: 11 }}>
        {active ? active.detail : centre.caption}
      </text>
    </svg>
  );
}
