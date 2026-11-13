"use client";

import { useRef, useState } from "react";
import type { Crop, Point } from "@/lib/rounds/extract/image";

// The screenshot side of lining up: the image with what isn't map shaded
// out (drag the edges to change the crop), the A and B points clicked on it,
// and the traced route over it. Everything is drawn in the image's own
// pixels, so it scales with the picture.

type Edge = "top" | "bottom" | "left" | "right";

type Props = {
  url: string;
  width: number;
  height: number;
  crop: Crop;
  onCrop?: (crop: Crop) => void;
  mode: "crop" | "pick" | "view";
  points: (Point | null)[];
  onPick?: (p: Point) => void;
  lines?: Point[][];
  dots?: { start: Point | null; end: Point | null };
};

export default function ScreenshotPane({ url, width, height, crop, onCrop, mode, points, onPick, lines = [], dots }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<Edge | null>(null);
  const handle = Math.max(6, Math.round(height / 120));

  const toImage = (clientX: number, clientY: number): Point => {
    const box = svg.current!.getBoundingClientRect();
    return [((clientX - box.left) / box.width) * width, ((clientY - box.top) / box.height) * height];
  };

  function move(clientX: number, clientY: number) {
    if (!dragging || !onCrop) return;
    const [x, y] = toImage(clientX, clientY);
    const next = { ...crop };
    const gap = 40;
    if (dragging === "top") next.top = Math.round(Math.max(0, Math.min(y, crop.bottom - gap)));
    if (dragging === "bottom") next.bottom = Math.round(Math.min(height, Math.max(y, crop.top + gap)));
    if (dragging === "left") next.left = Math.round(Math.max(0, Math.min(x, crop.right - gap)));
    if (dragging === "right") next.right = Math.round(Math.min(width, Math.max(x, crop.left + gap)));
    onCrop(next);
  }

  const shade = "rgba(15,23,42,0.55)";
  const stroke = Math.max(2, height / 500);
  const edgeLine = (edge: Edge) => {
    const horizontal = edge === "top" || edge === "bottom";
    const v = crop[edge];
    return (
      <g key={edge}>
        <line
          x1={horizontal ? crop.left : v}
          x2={horizontal ? crop.right : v}
          y1={horizontal ? v : crop.top}
          y2={horizontal ? v : crop.bottom}
          stroke="#FACC15"
          strokeWidth={stroke}
        />
        {mode === "crop" && (
          <rect
            x={horizontal ? crop.left : v - handle * 2}
            y={horizontal ? v - handle * 2 : crop.top}
            width={horizontal ? crop.right - crop.left : handle * 4}
            height={horizontal ? handle * 4 : crop.bottom - crop.top}
            fill="transparent"
            style={{ cursor: horizontal ? "ns-resize" : "ew-resize", touchAction: "none" }}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              setDragging(edge);
            }}
            aria-label={`Move the ${edge} edge of the map`}
          />
        )}
      </g>
    );
  };

  return (
    <div className="relative mx-auto w-fit max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="The screenshot" className="block max-h-[70vh] w-auto max-w-full select-none" draggable={false} />
      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 h-full w-full"
        style={{ cursor: mode === "pick" ? "crosshair" : undefined, touchAction: mode === "crop" ? "none" : undefined }}
        onPointerMove={(e) => move(e.clientX, e.clientY)}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
        onClick={(e) => {
          if (mode !== "pick" || !onPick) return;
          const [x, y] = toImage(e.clientX, e.clientY);
          if (x >= 0 && y >= 0 && x <= width && y <= height) onPick([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
        }}
      >
        <rect x={0} y={0} width={width} height={crop.top} fill={shade} />
        <rect x={0} y={crop.bottom} width={width} height={height - crop.bottom} fill={shade} />
        <rect x={0} y={crop.top} width={crop.left} height={crop.bottom - crop.top} fill={shade} />
        <rect x={crop.right} y={crop.top} width={width - crop.right} height={crop.bottom - crop.top} fill={shade} />
        {(["top", "bottom", "left", "right"] as Edge[]).map(edgeLine)}
        {lines.map((line, i) => (
          <polyline key={i} points={line.map((p) => p.join(",")).join(" ")} fill="none" stroke="#FF00D4" strokeWidth={stroke * 1.2} strokeLinejoin="round" />
        ))}
        {dots?.start && <circle cx={dots.start[0]} cy={dots.start[1]} r={handle * 2.2} fill="none" stroke="#DC2626" strokeWidth={stroke} />}
        {dots?.end && <circle cx={dots.end[0]} cy={dots.end[1]} r={handle * 2.2} fill="none" stroke="#16A34A" strokeWidth={stroke} />}
        {points.map(
          (p, i) =>
            p && (
              <g key={i}>
                <circle cx={p[0]} cy={p[1]} r={handle * 2.2} fill="#1C398E" stroke="#fff" strokeWidth={stroke} />
                <text x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={handle * 2.4} fontWeight={700} fontFamily="system-ui, sans-serif">
                  {i === 0 ? "A" : "B"}
                </text>
              </g>
            )
        )}
      </svg>
    </div>
  );
}
