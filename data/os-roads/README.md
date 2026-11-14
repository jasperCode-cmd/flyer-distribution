# OS Open Roads for Locate

Rounds' Locate places a screenshot on the map by reading its street names
and fitting them to these streets. This folder holds OS Open Roads road links
(centrelines with their names and road numbers) for the 100 km squares that
cover our postcode areas (SU, SZ, SY and ST: Hampshire, Dorset and around),
inside the box around BH, SO, PO, SP and DT plus 2 km. It is read on the
server only, a few cells at a time, and never sent to browsers.

- Source: OS Open Roads, from the OS Data Hub (release date in `manifest.json`).
- Licence: Open Government Licence v3.0.
- Attribution, shown wherever Locate's placements are shown:
  "Contains OS data © Crown copyright and database right 2026"
  (the year is the release's; `manifest.json` has the exact wording).

## Refreshing it (every April and October)

OS publishes a new release of OS Open Roads twice a year. To update:

1. Install the two Python packages once: `python3 -m pip install pyshp pyproj`
2. From the repository's root: `python3 scripts/os-roads/refresh.py`
   It downloads the release (about 600 MB, into a temporary folder that is
   deleted afterwards), converts it with the OSTN15 grid, and rewrites this
   folder, printing its progress. It takes a few minutes.
3. Check the summary it prints (about 285,000 road links in about 160
   cells, about 4.6 MB). If the release year has changed, update the year in
   `OS_ATTRIBUTION` in `lib/rounds/attribution.ts` to match `manifest.json`.
4. Run the tests (`lib/__tests__/rounds-locate.test.ts` checks the three
   real screenshots still place), then commit `data/os-roads`.

## Layout

- `manifest.json`: the release, licence, attribution, coverage, cell size
  (16,000 Web Mercator metres, about 10 km on the ground) and each cell's
  link count and size.
- `cells/<x>_<y>.bin.gz`: the links that start in that cell, gzipped:
  "OSR1", the names (one "name<TAB>road number" per line), then each link as
  its name's index, its point count and its points as whole Web Mercator
  metres, stepped from the cell's corner (zigzag varints). Read by
  `lib/rounds/locate/roads-format.ts`.
