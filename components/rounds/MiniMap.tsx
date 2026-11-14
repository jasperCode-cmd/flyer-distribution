"use client";

import { useEffect, useRef, useState } from "react";
import { MAP_TILES, tileUrl } from "@/lib/area-planner/tiles";
import type { LngLat, Lines } from "@/lib/rounds/geometry";

// A small still map for a review card: OpenStreetMap tiles round where a
// screenshot was lined up, its outline and its traced line. No map library:
// a handful of tile images and a drawing over them, loaded only once the
// card scrolls into view.

type Props = { footprint: LngLat[]; lines: Lines; width: number; height: number; label: string };

const TILE = MAP_TILES.tileSize;
const toWorld = ([lng, lat]: LngLat, z: number): [number, number] => {
  const n = TILE * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lng + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
};

export default function MiniMap({ footprint, lines, width, height, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  // The highest zoom at which the outline fits, with a margin.
  let z = 17;
  for (; z > 3; z--) {
    const pts = footprint.map((p) => toWorld(p, z));
    const w = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    const h = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
    if (w <= width * 0.92 && h <= height * 0.92) break;
  }
  const pts = footprint.map((p) => toWorld(p, z));
  const cx = (Math.max(...pts.map((p) => p[0])) + Math.min(...pts.map((p) => p[0]))) / 2;
  const cy = (Math.max(...pts.map((p) => p[1])) + Math.min(...pts.map((p) => p[1]))) / 2;
  const left = cx - width / 2;
  const top = cy - height / 2;
  const tiles: { x: number; y: number }[] = [];
  for (let x = Math.floor(left / TILE); x <= Math.floor((left + width) / TILE); x++) {
    for (let y = Math.floor(top / TILE); y <= Math.floor((top + height) / TILE); y++) tiles.push({ x, y });
  }
  const at = (p: LngLat) => {
    const [x, y] = toWorld(p, z);
    return `${(x - left).toFixed(1)},${(y - top).toFixed(1)}`;
  };

  return (
    <div ref={box} className="relative overflow-hidden rounded border border-gray-200 bg-gray-100" style={{ width, height }} role="img" aria-label={label}>
      {seen &&
        tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${t.x}-${t.y}`} src={tileUrl(z, t.x, t.y)} alt="" width={TILE} height={TILE} className="absolute max-w-none" style={{ left: t.x * TILE - left, top: t.y * TILE - top }} draggable={false} />
        ))}
      <svg className="absolute inset-0" width={width} height={height} aria-hidden="true">
        <polygon points={footprint.map(at).join(" ")} fill="rgba(28,57,142,0.06)" stroke="#1C398E" strokeWidth="1.5" strokeDasharray="4 3" />
        {lines.map((l, i) => (
          <polyline key={i} points={l.map(at).join(" ")} fill="none" stroke="#FF00D4" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        ))}
      </svg>
    </div>
  );
}
