# Area Planner data sources

Built 2026-10-19T21:38:16.208Z from a source file made 2026-10-19T21:36:38.696Z.

## Datasets

- ONS Postcode Directory (AUG 2026), multi-CSV release: onspd.zip
  (sha256 ab51f1e82bd5beeb1089c3732ea6e11d62eb5693d619e2c4f4dd8c4baaa69293). Live, small-user postcodes and their 2021 Output Areas.
- Census 2021 TS041 Number of Households by Output Area (Nomis bulk download): census2021-ts041.zip,
  entry census2021-ts041-oa.csv (sha256 e4f11fc0ea22393fe3be444027878e67b51d2a44687e122c37439d19a548cb9f).
- Output Areas (December 2021) Boundaries EW BGC (V2), generalised (20m) and clipped to the coastline,
  from https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Output_Areas_2021_EW_BGC_V2/FeatureServer/0/query, fetched 2026-10-19T21:36:38.947Z (8482 Output Areas).

## How the shapes are made

Each Output Area is put in the postcode sector holding most of its live postcodes, and a sector's
shape is the union of its Output Areas (a district's, of its sectors'). These are approximations of
the Royal Mail boundaries, which are not open data: an edge can be out by up to one Output Area.
Household estimates weight each Output Area's Census 2021 households by how much of it falls inside
a shape.

## Credits

- Source: Office for National Statistics licensed under the Open Government Licence v.3.0
- Contains OS data © Crown copyright and database right 2026
- Contains Royal Mail data © Royal Mail copyright and database right 2026
- Census 2021 household counts (TS041) by Output Area, ONS

Postcode areas: BH, SO, PO, SP, DT. Output Areas: 8482. Sectors: 390
(10 too small to map). Districts: 105. Households: 1121690.
