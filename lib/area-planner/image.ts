import type { Position } from "geojson";
import { geometryBbox, labelPoint, type AreaGeometry } from "./geometry";
import { leafletText, totalText, type ShareView } from "./share-view";
import { MAP_TILES, tileUrl } from "./tiles";

// The "Download image" PNG for one distributor: a header in the project's
// business colours with the title for distributors and the date, their
// name and total, the map tiles with only their areas and labels, and the
// credits. Drawn in the browser onto a canvas from the ShareView alone, so
// it can hold nothing the view doesn't: no pay, no client, no households,
// no other distributor. An LDB image carries nothing of FDH. Pure: it draws
// through the small Canvas2D interface below, which tests record.

export type Canvas2D = Pick<
  CanvasRenderingContext2D,
  | "fillStyle"
  | "strokeStyle"
  | "lineWidth"
  | "lineJoin"
  | "font"
  | "textAlign"
  | "textBaseline"
  | "globalAlpha"
  | "fillRect"
  | "fillText"
  | "measureText"
  | "beginPath"
  | "moveTo"
  | "lineTo"
  | "closePath"
  | "fill"
  | "stroke"
  | "drawImage"
  | "save"
  | "restore"
  | "rect"
  | "clip"
>;

export type LoadImage = (src: string) => Promise<CanvasImageSource | null>;

export const IMAGE_BRANDS = {
  // The white logo, cropped to its own shape (1080 by 400).
  FDH: { heading: "Flyer Distribution Hampshire", band: "#1E3A8A", logo: "/Flyer Distribution Logo White Cropped.webp" },
  LDB: { heading: "Leaflet Distribution Bournemouth", band: "#487531", logo: null },
} as const;

export const IMAGE_CREDITS =
  `Map ${MAP_TILES.attributionText}. Postcode boundaries contain OS, Royal Mail and ONS data, Crown copyright and database rights 2026.`;

export const IMAGE_WIDTH = 1600;
const HEADER_H = 130;
const STRIP_H = 70;
export const MAP_H = 1000;
const FOOTER_H = 60;
export const IMAGE_HEIGHT = HEADER_H + STRIP_H + MAP_H + FOOTER_H;
const MAP_TOP = HEADER_H + STRIP_H;
const TILE = MAP_TILES.tileSize;
const MIN_ZOOM = 10;
const MAX_ZOOM = 17;
const FONT = "Arial, Helvetica, sans-serif";

// Web Mercator: longitude and latitude to world pixels at a zoom.
export function worldPixel(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const scale = TILE * 2 ** zoom;
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  };
}

export type ImagePlan = {
  zoom: number;
  // The world pixel at the map box's top left corner.
  originX: number;
  originY: number;
  tiles: { x: number; y: number; z: number; left: number; top: number }[];
};

// The closest zoom that fits every area (with a margin), centred.
export function planImage(geometries: AreaGeometry[]): ImagePlan {
  let [w, s, e, n] = [180, 90, -180, -90];
  for (const g of geometries) {
    const [gw, gs, ge, gn] = geometryBbox(g);
    w = Math.min(w, gw);
    s = Math.min(s, gs);
    e = Math.max(e, ge);
    n = Math.max(n, gn);
  }
  let zoom = MAX_ZOOM;
  for (; zoom > MIN_ZOOM; zoom--) {
    const a = worldPixel(w, n, zoom);
    const b = worldPixel(e, s, zoom);
    if (b.x - a.x <= IMAGE_WIDTH * 0.84 && b.y - a.y <= MAP_H * 0.8) break;
  }
  const a = worldPixel(w, n, zoom);
  const b = worldPixel(e, s, zoom);
  const originX = Math.round((a.x + b.x) / 2 - IMAGE_WIDTH / 2);
  const originY = Math.round((a.y + b.y) / 2 - MAP_H / 2);
  const tiles: ImagePlan["tiles"] = [];
  const max = 2 ** zoom;
  for (let ty = Math.floor(originY / TILE); ty * TILE < originY + MAP_H; ty++) {
    for (let tx = Math.floor(originX / TILE); tx * TILE < originX + IMAGE_WIDTH; tx++) {
      if (ty < 0 || ty >= max) continue;
      tiles.push({ x: ((tx % max) + max) % max, y: ty, z: zoom, left: tx * TILE - originX, top: MAP_TOP + ty * TILE - originY });
    }
  }
  return { zoom, originX, originY, tiles };
}

function point(plan: ImagePlan, [lng, lat]: Position): [number, number] {
  const p = worldPixel(lng, lat, plan.zoom);
  return [p.x - plan.originX, MAP_TOP + p.y - plan.originY];
}

function tracePath(ctx: Canvas2D, plan: ImagePlan, geometry: AreaGeometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  ctx.beginPath();
  for (const rings of polys) {
    for (const ring of rings) {
      ring.forEach((pos, i) => {
        const [x, y] = point(plan, pos);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
    }
  }
}

function fitText(ctx: Canvas2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}...`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}...`;
}

export type DrawResult = { missingTiles: number };

export async function drawShareImage(ctx: Canvas2D, view: ShareView, loadImage: LoadImage): Promise<DrawResult> {
  const brand = IMAGE_BRANDS[view.business];
  const plan = planImage(view.areas.map((a) => a.geometry));

  // Map tiles first, a plain grey where one can't be loaded.
  const images = await Promise.all(plan.tiles.map((t) => loadImage(tileUrl(t.z, t.x, t.y))));
  let missingTiles = 0;
  ctx.fillStyle = "#E5E7EB";
  ctx.fillRect(0, MAP_TOP, IMAGE_WIDTH, MAP_H);
  plan.tiles.forEach((t, i) => {
    const image = images[i];
    if (image) ctx.drawImage(image, t.left, t.top, TILE, TILE);
    else missingTiles++;
  });

  // The distributor's areas.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, MAP_TOP, IMAGE_WIDTH, MAP_H);
  ctx.clip();
  ctx.lineJoin = "round";
  for (const area of view.areas) {
    tracePath(ctx, plan, area.geometry);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = view.distributor.colour;
    ctx.fill("evenodd");
    ctx.globalAlpha = 1;
    ctx.strokeStyle = view.distributor.colour;
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  view.areas.forEach((area, i) => {
    const at = labelPoint(area.geometry);
    const [x, y] = point(plan, [at.lng, at.lat]);
    const text = fitText(ctx, `${area.label ?? `Area ${i + 1}`}: ${leafletText(area.leafletCount)}`, 520);
    const width = ctx.measureText(text).width + 20;
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x - width / 2, y - 18, width, 36);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#94A3B8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(x - width / 2, y - 18, width, 36);
    ctx.stroke();
    ctx.fillStyle = "#0F172A";
    ctx.fillText(text, x, y + 1);
  });
  ctx.restore();

  // Header: the business, the title and the date.
  ctx.fillStyle = brand.band;
  ctx.fillRect(0, 0, IMAGE_WIDTH, HEADER_H);
  let textLeft = 40;
  if (brand.logo) {
    const logo = await loadImage(brand.logo);
    if (logo) {
      ctx.drawImage(logo, 32, 25, 216, 80);
      textLeft = 280;
    }
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText(brand.heading, textLeft, 38);
  ctx.font = `bold 40px ${FONT}`;
  ctx.fillText(fitText(ctx, view.title, IMAGE_WIDTH - textLeft - 40), textLeft, 84);
  ctx.font = `22px ${FONT}`;
  ctx.fillText(`Prepared ${view.preparedOn}${view.campaignStart ? `, delivery from ${view.campaignStart}` : ""}`, textLeft, 116);

  // The distributor and their total.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, HEADER_H, IMAGE_WIDTH, STRIP_H);
  ctx.fillStyle = view.distributor.colour;
  ctx.fillRect(40, HEADER_H + 23, 24, 24);
  ctx.fillStyle = "#0F172A";
  ctx.font = `bold 28px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText(fitText(ctx, view.distributor.name, 900), 78, HEADER_H + STRIP_H / 2);
  ctx.textAlign = "right";
  ctx.font = `24px ${FONT}`;
  ctx.fillText(`Total: ${totalText(view)}`, IMAGE_WIDTH - 40, HEADER_H + STRIP_H / 2);

  // Credits.
  ctx.fillStyle = "#F1F5F9";
  ctx.fillRect(0, MAP_TOP + MAP_H, IMAGE_WIDTH, FOOTER_H);
  ctx.fillStyle = "#334155";
  ctx.font = `18px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(fitText(ctx, IMAGE_CREDITS, IMAGE_WIDTH - 80), 40, MAP_TOP + MAP_H + FOOTER_H / 2);

  return { missingTiles };
}
