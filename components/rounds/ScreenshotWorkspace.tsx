"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { imageToLngLat, solveAlignment, type ImagePoint, type PointPair } from "@/lib/rounds/alignment";
import { detectCrop } from "@/lib/rounds/extract/crop";
import { fullCrop, type Crop, type Point } from "@/lib/rounds/extract/image";
import { DEFAULT_TOLERANCE, MAX_TOLERANCE, MIN_TOLERANCE } from "@/lib/rounds/extract/mask";
import { eraseCircle, linesLengthM, roundCoords, type LngLat, type Lines } from "@/lib/rounds/geometry";
import { formatDistance } from "@/lib/rounds/format";
import type { Markers, RoundScreenshotView } from "@/lib/rounds/types";
import type { AlignMapHandle, AlignMode } from "./AlignMap";
import ScreenshotPane from "./ScreenshotPane";
import { runExtraction } from "./run-extraction";
import { api, send } from "./rounds-api";

const AlignMap = dynamic(() => import("./AlignMap"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-gray-100" /> });

// Lining up one screenshot and tracing its route, in three steps:
// 1. Crop: the band at the top is left out (found automatically; drag to
//    change). The bottom isn't cropped: the buttons floating there are
//    skipped by the tracing instead.
// 2. Line up: click a point on the screenshot and the same place on the map,
//    twice. The screenshot then lies over the map, see-through, to check.
// 3. Trace: the route's blue is picked out and traced into a line on the
//    map, with an eraser for stray bits and the start and end dots marked.
// Saving keeps the crop, the points, the line and the dots; the image itself
// stays in the browser.

export type WorkImage = { url: string; width: number; height: number; pixels: ImageData | null };

type Props = {
  shot: RoundScreenshotView;
  image: WorkImage;
  index: number;
  total: number;
  focus: [number, number, number, number] | null;
  onSaved: (shot: RoundScreenshotView) => void;
  onSkip: () => void;
  skipLabel?: string;
};

type Pick = { image: ImagePoint | null; map: LngLat | null };
type Step = "crop" | "align" | "trace";
type Place = { label: string; detail: string; bbox: [number, number, number, number] };

const STEPS: { id: Step; label: string }[] = [
  { id: "crop", label: "1. Crop" },
  { id: "align", label: "2. Line up" },
  { id: "trace", label: "3. Trace" },
];

export default function ScreenshotWorkspace({ shot, image, index, total, focus, onSaved, onSkip, skipLabel = "Skip for now" }: Props) {
  const saved = shot.alignment?.pairs;
  const [step, setStep] = useState<Step>(shot.alignment ? (shot.route ? "trace" : "align") : "crop");
  const [crop, setCrop] = useState<Crop>(() => shot.crop ?? (image.pixels ? detectCrop({ width: image.width, height: image.height, data: image.pixels.data }) : fullCrop(image)));
  const [a, setA] = useState<Pick>({ image: saved?.[0]?.image ?? null, map: saved?.[0]?.map ?? null });
  const [b, setB] = useState<Pick>({ image: saved?.[1]?.image ?? null, map: saved?.[1]?.map ?? null });
  const [opacity, setOpacity] = useState(0.5);
  const [showOverlay, setShowOverlay] = useState(true);
  const [tolerance, setTolerance] = useState(DEFAULT_TOLERANCE);
  const [tracing, setTracing] = useState(false);
  const [pixelLines, setPixelLines] = useState<Point[][]>([]);
  const [dots, setDots] = useState<{ start: Point | null; end: Point | null }>({ start: null, end: null });
  const [lines, setLines] = useState<Lines>(shot.route ?? []);
  const [markers, setMarkers] = useState<Markers>(shot.markers ?? {});
  const [undo, setUndo] = useState<Lines[]>([]);
  // The trace step's own tool (eraser, start, end); the other steps' map
  // mode follows from what is to be clicked next, worked out as the page
  // draws so a quick click is never missed.
  const [traceMode, setTraceMode] = useState<AlignMode>("view");
  const [brushPx, setBrushPx] = useState(24);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const mapHandle = useRef<AlignMapHandle | null>(null);
  const stroke = useRef(false);

  const pairs: PointPair[] | null = a.image && a.map && b.image && b.map ? [{ image: a.image, map: a.map }, { image: b.image, map: b.map }] : null;
  const solved = useMemo(() => (pairs ? solveAlignment(pairs) : null), [pairs?.flatMap((p) => [...p.image, ...p.map]).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps
  const transform = solved?.ok ? solved.alignment.transform : null;
  const next: "a-image" | "a-map" | "b-image" | "b-map" | null = !a.image ? "a-image" : !a.map ? "a-map" : !b.image ? "b-image" : !b.map ? "b-map" : null;
  const mode: AlignMode = step === "align" ? (next === "a-map" || next === "b-map" ? "pick" : "view") : step === "trace" ? traceMode : "view";
  const setMode = setTraceMode;

  // Place search, from our own postcode and town data.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setPlaces([]);
      return;
    }
    const timer = setTimeout(() => {
      api<{ places: Place[] }>(`/api/crm/rounds/places?q=${encodeURIComponent(q)}`)
        .then((r) => setPlaces(r.places))
        .catch(() => setPlaces([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function pickImage(p: Point) {
    if (next === "a-image") setA({ image: p, map: null });
    else if (next === "b-image") setB({ image: p, map: null });
  }

  function pickMap(p: LngLat) {
    if (next === "a-map") setA((x) => ({ ...x, map: p }));
    else if (next === "b-map") setB((x) => ({ ...x, map: p }));
  }

  async function trace() {
    if (!image.pixels || !transform) return;
    setTracing(true);
    setError(null);
    try {
      const result = await runExtraction(image.pixels, { crop, tolerance });
      setPixelLines(result.lines);
      setDots({ start: result.start, end: result.end });
      setUndo((u) => [...u, lines]);
      setLines(roundCoords(result.lines.map((l) => l.map((p) => imageToLngLat(transform, p)))));
      setMarkers({
        ...(result.start ? { start: imageToLngLat(transform, result.start) } : {}),
        ...(result.end ? { end: imageToLngLat(transform, result.end) } : {}),
      });
      if (result.lines.length === 0) setError("No route found. Check the crop, or widen the colour tolerance.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTracing(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { crop };
      if (pairs) body.pairs = pairs;
      if (step === "trace") {
        body.route = lines.length ? lines : null;
        body.markers = markers.start || markers.end ? markers : null;
      }
      const updated = await api<RoundScreenshotView>(`/api/crm/rounds/screenshots/${shot.id}`, send("PATCH", body));
      onSaved(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const instruction =
    step === "crop"
      ? "The shaded band at the top (status bar, back button, map tabs) is left out. The Route Flyover button and the Apple Maps label over the map are skipped when tracing, so the bottom isn't cropped. Drag the yellow edges if the map part is wrong."
      : step === "align"
        ? next === "a-image"
          ? "Click a point you can recognise on the screenshot (a junction or a corner): that is A."
          : next === "a-map"
            ? "Now click the same place on the map."
            : next === "b-image"
              ? "Click a second point on the screenshot, far from A: that is B."
              : next === "b-map"
                ? "Now click the same place for B on the map."
                : solved?.ok
                  ? "Lined up. Check the see-through screenshot sits over the map; redo a point if not."
                  : "These points don't fit. Redo A or B."
        : mode === "erase"
          ? "Drag over stray bits on the map to rub them out."
          : mode === "start" || mode === "end"
            ? `Click the map where the round ${mode === "start" ? "started (red dot)" : "ended (green dot)"}.`
            : "Trace the route, check it on the map, erase anything that isn't route, then save.";

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-3" aria-label={`Screenshot ${index + 1} of ${total}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-blue-900">
            Screenshot {index + 1} of {total}
            {shot.originalName ? <span className="ml-2 text-sm font-normal text-gray-600">{shot.originalName}</span> : null}
          </h2>
          <p className="text-xs text-gray-500">{shot.stored ? "Screenshot stored" : "Screenshot not stored: it stays in this browser while you work on it."}</p>
        </div>
        <nav aria-label="Steps" className="flex gap-1">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              disabled={(s.id === "trace" && !transform) || (s.id !== "crop" && !image)}
              aria-current={step === s.id ? "step" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${step === s.id ? "bg-blue-900 text-white" : "border border-gray-300 text-gray-800 hover:bg-gray-50"}`}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>
      <p className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900" role="status">
        {instruction}
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="min-w-0">
          <ScreenshotPane
            url={image.url}
            width={image.width}
            height={image.height}
            crop={crop}
            onCrop={setCrop}
            mode={step === "crop" ? "crop" : step === "align" && (next === "a-image" || next === "b-image") ? "pick" : "view"}
            points={[a.image, b.image]}
            onPick={pickImage}
            lines={step === "trace" ? pixelLines : []}
            dots={step === "trace" ? dots : undefined}
          />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="relative">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a place: a postcode like BH24 1 or a town like Ringwood"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              aria-label="Find a place on the map"
            />
            {places.length > 0 && (
              <ul className="absolute z-[1000] mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                {places.map((p) => (
                  <li key={`${p.label}-${p.detail}`}>
                    <button
                      type="button"
                      className="flex w-full justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50"
                      onClick={() => {
                        mapHandle.current?.fitBbox(p.bbox);
                        setPlaces([]);
                        setQuery(p.label);
                      }}
                    >
                      <span className="font-medium text-gray-900">{p.label}</span>
                      <span className="text-xs text-gray-500">{p.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="h-[60vh] min-h-[360px] overflow-hidden rounded-lg border border-gray-200">
            <AlignMap
              handleRef={mapHandle}
              focus={focus}
              mode={mode}
              points={[a.map, b.map]}
              overlay={transform && showOverlay && step !== "crop" ? { url: image.url, width: image.width, height: image.height, transform } : null}
              overlayOpacity={opacity}
              lines={step === "trace" ? lines : []}
              markers={step === "trace" ? markers : {}}
              brushPx={brushPx}
              onPick={pickMap}
              onErase={(centre, radiusM) => {
                if (!stroke.current) {
                  stroke.current = true;
                  setUndo((u) => [...u, lines]);
                }
                setLines((current) => eraseCircle(current, centre, radiusM));
              }}
              onEraseEnd={() => (stroke.current = false)}
              onMarker={(which, p) => {
                setMarkers((m) => ({ ...m, [which]: p }));
                setMode("view");
              }}
            />
          </div>
        </div>
      </div>

      {step === "align" && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={() => setA({ image: null, map: null })} className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-800 hover:bg-gray-50">
            Redo A
          </button>
          <button type="button" onClick={() => setB({ image: null, map: null })} className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-800 hover:bg-gray-50">
            Redo B
          </button>
          {solved && !solved.ok && <span className="text-red-700" role="alert">{solved.error}</span>}
          {solved?.ok && (
            <span className="text-gray-700">
              Off by {solved.alignment.errorsPx.map((e) => `${e.toFixed(1)} px`).join(" and ")}
              {solved.alignment.rotated ? `, turned ${solved.alignment.transform.rotationDeg.toFixed(1)}°` : ", north up"}; about {solved.alignment.metresPerPixel.toFixed(2)} m a pixel.
            </span>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} /> Show the screenshot on the map
          </label>
          <label className="flex items-center gap-2">
            See-through
            <input type="range" min={0.1} max={0.9} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} aria-label="How see-through the screenshot is" />
          </label>
        </div>
      )}

      {step === "trace" && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={trace} disabled={tracing || !transform || !image.pixels} className="rounded-md bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {tracing ? "Tracing..." : lines.length ? "Trace again" : "Trace the route"}
          </button>
          <label className="flex items-center gap-2">
            Colour tolerance
            <input type="range" min={MIN_TOLERANCE} max={MAX_TOLERANCE} step={5} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} aria-label="Colour tolerance" />
            <span className="w-8 tabular-nums">{tolerance}</span>
          </label>
          <button
            type="button"
            aria-pressed={mode === "erase"}
            onClick={() => setMode(mode === "erase" ? "view" : "erase")}
            disabled={lines.length === 0}
            className={`rounded-md px-3 py-1.5 font-semibold disabled:opacity-50 ${mode === "erase" ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-800 hover:bg-gray-50"}`}
          >
            Eraser
          </button>
          {mode === "erase" && (
            <label className="flex items-center gap-2">
              Size
              <input type="range" min={8} max={70} step={2} value={brushPx} onChange={(e) => setBrushPx(Number(e.target.value))} aria-label="Eraser size" />
            </label>
          )}
          <button
            type="button"
            onClick={() => {
              setLines(undo[undo.length - 1] ?? lines);
              setUndo((u) => u.slice(0, -1));
            }}
            disabled={undo.length === 0}
            className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            Undo
          </button>
          <button type="button" aria-pressed={mode === "start"} onClick={() => setMode(mode === "start" ? "view" : "start")} className="rounded-md border border-red-300 px-3 py-1.5 font-semibold text-red-700 hover:bg-red-50">
            {markers.start ? "Move start" : "Set start"}
          </button>
          <button type="button" aria-pressed={mode === "end"} onClick={() => setMode(mode === "end" ? "view" : "end")} className="rounded-md border border-green-300 px-3 py-1.5 font-semibold text-green-800 hover:bg-green-50">
            {markers.end ? "Move end" : "Set end"}
          </button>
          <span className="text-gray-700">
            {lines.length ? `${lines.length} piece${lines.length === 1 ? "" : "s"}, ${formatDistance(linesLengthM(lines))}` : "No line yet"}
          </span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
        <button type="button" onClick={onSkip} className="rounded-md px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
          {skipLabel}
        </button>
        {step === "crop" && (
          <button type="button" onClick={() => setStep("align")} className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            Next: line up
          </button>
        )}
        {step === "align" && (
          <button type="button" onClick={() => setStep("trace")} disabled={!transform} className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            Next: trace
          </button>
        )}
        {step === "trace" && (
          <button type="button" onClick={save} disabled={saving || !transform} className="rounded-md bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">
            {saving ? "Saving..." : index + 1 < total ? "Save and next" : "Save"}
          </button>
        )}
      </div>
    </section>
  );
}
