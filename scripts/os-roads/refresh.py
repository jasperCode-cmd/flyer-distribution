#!/usr/bin/env python3
# Refresh the bundled OS Open Roads data that Rounds' Locate looks street
# names up in (data/os-roads). OS publishes a new release every April and
# October; run this after each one, check the summary, and commit the result.
#
# What it does: downloads OS Open Roads (GB, Shapefile) from the OS Data Hub,
# keeps the road links in the 100 km squares covering our postcode areas
# (SU, SZ, SY, ST) inside the box around them (from data/area-planner) plus
# 2 km, converts them to longitude and latitude with the OSTN15 grid (so
# accurate to about 0.1 m), then to Web Mercator metres, and writes one small
# gzipped file per 16 km Mercator cell (about 10 km on the ground) plus a
# manifest. See data/os-roads/README.md for the file layout.
#
# Needs Python 3.10+ with: python3 -m pip install pyshp pyproj
# Usage: python3 scripts/os-roads/refresh.py [--work DIR] [--out DIR]
# Takes a few minutes: the download is about 600 MB (deleted afterwards).
import argparse, gzip, json, math, os, shutil, sys, tempfile, time, urllib.request, zipfile

try:
    import shapefile  # pyshp
    from pyproj import Transformer, datadir
except ImportError:
    sys.exit("Needs pyshp and pyproj: python3 -m pip install pyshp pyproj")

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DOWNLOADS = "https://api.os.uk/downloads/v1/products/OpenRoads/downloads"
OSTN15 = "https://cdn.proj.org/uk_os_OSTN15_NTv2_OSGBtoETRS.tif"
SQUARES = ["SU", "SZ", "SY", "ST"]
MARGIN_M = 2000
CELL_M = 16000  # Web Mercator metres
EARTH_RADIUS_M = 6378137
FORMAT = 1


def log(msg):
    print(msg, flush=True)


def fetch(url, path, timeout=60, label="file"):
    # Downloads with progress lines; a stalled connection fails after `timeout` seconds.
    req = urllib.request.Request(url, headers={"User-Agent": "os-roads-refresh/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r, open(path, "wb") as f:
        total = int(r.headers.get("Content-Length") or 0)
        done, last = 0, 0.0
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
            done += len(chunk)
            if time.time() - last > 10:
                last = time.time()
                log(f"  {label}: {done >> 20} MB" + (f" of {total >> 20} MB" if total else ""))
    log(f"  {label}: done, {done >> 20} MB")


def area_box():
    # The box around every mappable postcode in the Area Planner's data, in lng/lat.
    with gzip.open(os.path.join(ROOT, "data", "area-planner", "postcodes", "index.json.gz"), "rt") as f:
        items = json.load(f)["items"]
    b = [math.inf, math.inf, -math.inf, -math.inf]
    for code, kind, households, mappable, x0, y0, x1, y1, key in items:
        if mappable != 1:
            continue
        b = [min(b[0], x0 / 1e5), min(b[1], y0 / 1e5), max(b[2], x1 / 1e5), max(b[3], y1 / 1e5)]
    return b


def mercator(lng, lat):
    x = EARTH_RADIUS_M * math.radians(lng)
    y = -EARTH_RADIUS_M * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return x, y


def varint(v, buf):
    while True:
        b = v & 0x7F
        v >>= 7
        if v:
            buf.append(b | 0x80)
        else:
            buf.append(b)
            return


def zigzag(v):
    return (v << 1) ^ (v >> 63)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--work", help="where to download to (default: a temporary folder, deleted after)")
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "os-roads"))
    args = ap.parse_args()
    work = args.work or tempfile.mkdtemp(prefix="os-roads-")
    os.makedirs(work, exist_ok=True)
    started = time.time()
    try:
        log("1. Finding the latest OS Open Roads release")
        with urllib.request.urlopen(urllib.request.Request(DOWNLOADS, headers={"User-Agent": "os-roads-refresh/1.0"}), timeout=60) as r:
            files = json.load(r)
        shp = next(f for f in files if f["format"].startswith("ESRI"))
        log(f"  {shp['fileName']}, {int(shp['size']) >> 20} MB")
        zip_path = os.path.join(work, shp["fileName"])
        if not os.path.exists(zip_path):
            log("2. Downloading (about 600 MB)")
            fetch(shp["url"], zip_path, label="OS Open Roads")
        log("3. Unpacking our squares: " + ", ".join(SQUARES))
        release = None
        with zipfile.ZipFile(zip_path) as z:
            for info in z.infolist():
                name = os.path.basename(info.filename)
                if any(name.startswith(f"{sq}_RoadLink.") for sq in SQUARES):
                    with z.open(info) as src, open(os.path.join(work, name), "wb") as dst:
                        shutil.copyfileobj(src, dst)
                    release = "%04d-%02d-%02d" % info.date_time[:3]
        log(f"  release dated {release}")
        grid_dir = os.path.join(work, "proj")
        os.makedirs(grid_dir, exist_ok=True)
        if not os.path.exists(os.path.join(grid_dir, os.path.basename(OSTN15))):
            log("4. Downloading the OSTN15 grid")
            fetch(OSTN15, os.path.join(grid_dir, os.path.basename(OSTN15)), label="OSTN15")
        datadir.append_data_dir(grid_dir)
        to_ll = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
        from_ll = Transformer.from_crs("EPSG:4326", "EPSG:27700", always_xy=True)
        # OSTN15 in use: a known point to 1e-5 degrees (the 7-parameter shift is metres out).
        if abs(to_ll.transform(444000, 112000)[0] + 1.37559) > 1e-4:
            sys.exit("The OSTN15 grid isn't being used; stopping rather than writing shifted data.")

        box = area_box()
        corners = [from_ll.transform(x, y) for x in (box[0], box[2]) for y in (box[1], box[3])]
        e0, e1 = min(c[0] for c in corners) - MARGIN_M, max(c[0] for c in corners) + MARGIN_M
        n0, n1 = min(c[1] for c in corners) - MARGIN_M, max(c[1] for c in corners) + MARGIN_M
        log(f"5. Reading road links in the box around our postcode areas (lng {box[0]:.3f} to {box[2]:.3f}, lat {box[1]:.3f} to {box[3]:.3f}, plus 2 km)")
        cells = {}
        kept = 0
        for sq in SQUARES:
            r = shapefile.Reader(os.path.join(work, f"{sq}_RoadLink"), encoding="cp1252", encodingErrors="replace")
            fields = [f[0] for f in r.fields[1:]]
            iname, inum = fields.index("name1"), fields.index("roadNumber")
            for i, sr in enumerate(r.iterShapeRecords()):
                if i % 50000 == 0:
                    log(f"  {sq}: {i} of {len(r)} links read, {kept} kept so far")
                b = sr.shape.bbox
                if b[2] < e0 or b[0] > e1 or b[3] < n0 or b[1] > n1:
                    continue
                xs, ys = zip(*sr.shape.points)
                lngs, lats = to_ll.transform(xs, ys)
                pts = [mercator(a, c) for a, c in zip(lngs, lats)]
                pts = [(round(x), round(y)) for x, y in pts]
                # Drop repeated points (from rounding).
                pts = [p for k, p in enumerate(pts) if k == 0 or p != pts[k - 1]]
                if len(pts) < 2:
                    continue
                key = (math.floor(pts[0][0] / CELL_M), math.floor(pts[0][1] / CELL_M))
                cell = cells.setdefault(key, {"names": {}, "links": []})
                label = f"{sr.record[iname].strip()}\t{sr.record[inum].strip()}"
                idx = cell["names"].setdefault(label, len(cell["names"]))
                cell["links"].append((idx, pts))
                kept += 1
        log(f"  {kept} road links kept in {len(cells)} cells")

        log("6. Writing " + os.path.relpath(args.out, ROOT))
        out_cells = os.path.join(args.out, "cells")
        if os.path.isdir(out_cells):
            shutil.rmtree(out_cells)
        os.makedirs(out_cells)
        manifest_cells = {}
        total = 0
        for (cx, cy), cell in sorted(cells.items()):
            buf = bytearray(b"OSR1")
            names = "\n".join(k for k, _ in sorted(cell["names"].items(), key=lambda kv: kv[1])).encode("utf-8")
            varint(len(names), buf)
            buf += names
            varint(len(cell["links"]), buf)
            ox, oy = cx * CELL_M, cy * CELL_M
            for idx, pts in cell["links"]:
                varint(idx, buf)
                varint(len(pts), buf)
                px, py = ox, oy
                for x, y in pts:
                    varint(zigzag(x - px), buf)
                    varint(zigzag(y - py), buf)
                    px, py = x, y
            data = gzip.compress(bytes(buf), 9, mtime=0)
            key = f"{cx}_{cy}"
            with open(os.path.join(out_cells, f"{key}.bin.gz"), "wb") as f:
                f.write(data)
            manifest_cells[key] = {"links": len(cell["links"]), "bytes": len(data)}
            total += len(data)
        manifest = {
            "format": FORMAT,
            "source": "OS Open Roads",
            "release": release,
            "licence": "Open Government Licence v3.0",
            "attribution": f"Contains OS data © Crown copyright and database right {release[:4] if release else time.strftime('%Y')}",
            "coverage": {"lngLat": box, "marginM": MARGIN_M, "squares": SQUARES},
            "cellM": CELL_M,
            "links": kept,
            "bytes": total,
            "cells": manifest_cells,
        }
        with open(os.path.join(args.out, "manifest.json"), "w") as f:
            json.dump(manifest, f, indent=1)
            f.write("\n")
        log(f"Done in {time.time() - started:.0f} s: {kept} road links, {len(cells)} cells, {total / 1e6:.1f} MB. Check the attribution year in the app matches the manifest, then commit data/os-roads.")
    finally:
        if not args.work:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
