// The map tiles, in one place: where they come from and the credit shown
// with them on the map, on every image and on every private link page.
// Standard OpenStreetMap tiles, used lightly within the OSMF tile usage
// policy (a few staff and the odd distributor link; no prefetching or bulk
// download). To switch provider, change this setting; next.config.ts reads
// the host from here for the map pages' Content-Security-Policy.

export const MAP_TILES = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  host: "https://tile.openstreetmap.org",
  maxZoom: 19,
  tileSize: 256,
  attributionHtml: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  attributionText: "© OpenStreetMap contributors",
} as const;

export function tileUrl(z: number, x: number, y: number): string {
  return MAP_TILES.url.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));
}
