import { MAP_TILES } from "@/lib/area-planner/tiles";

// Credits for what Rounds' maps show. Placements made by Locate are fitted to
// OS Open Roads (Open Government Licence), so its credit goes with every map
// and page showing rounds' routes, beside OpenStreetMap's for the map tiles.
// The year is the bundled release's (data/os-roads/manifest.json; a test
// checks they match).
export const OS_ATTRIBUTION = "Contains OS data © Crown copyright and database right 2026";
export const ROUNDS_MAP_CREDIT = `Map ${MAP_TILES.attributionText}. ${OS_ATTRIBUTION}`;
