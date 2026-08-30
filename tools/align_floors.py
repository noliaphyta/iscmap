#!/usr/bin/env python3
"""
Align a single building's per-floor geojson into one shared coordinate
space, using elevator/stairway shafts as physical reference points.

WHY THIS EXISTS
----------------
fetch_all_floors_final.py (see library.txt / that script) pulls one
CREATE_SELECTION_XML response per floor from FAMIS. Each response's pixel
coordinates are apparently relative to whatever pan/zoom state the
VisualMap UI happened to be in when that floor was captured - there's no
guarantee different floors share an origin, and for the library they
verifiably don't (see README.md's "Room data" section for the discovered
per-floor bounding boxes). ISC's two buildings didn't have this problem -
their translate-only alignment was done upstream, before this repo ever
saw the data (see README.md) - but nothing upstream has done that for the
library, so it has to happen here.

THE METHOD
----------
Elevator shafts and stairwells physically penetrate every floor of a
building at the same (x, y) location - floor 3's elevator shaft #1 sits
directly above floor 2's elevator shaft #1. FAMIS's room-numbering
convention happens to make these easy to find: a room's floor-prefix
character is stripped off to get its physical identifier, e.g.
"1EL1" (elevator 1 on Floor1) and "3EL1" (elevator 1 on Floor3) share the
suffix "EL1" and are the same physical shaft. Same for stairwells
("0ST_C", "1ST_C", "2ST_C", "3ST_C", "4ST_C", "BST_C" -> suffix "ST_C").

For each floor, this script:
  1. Finds every Category=Circulation / SubCategory in {Elevator,Stairway}
     room, and computes its centroid.
  2. Groups those centroids by suffix (physical shaft/stairwell identity).
  3. For every floor other than the reference floor, finds the suffixes
     it shares with the reference floor and averages
     (reference_centroid - this_floor_centroid) across all of them to get
     one (dx, dy) translation. Multiple anchors per floor act as a
     built-in sanity check - see --report for the spread across anchors,
     which is small enough here (a few pixels out of ~500-1000 pixel
     floor extents) to trust a translate-only model with no rotation or
     scale correction needed.
  4. Applies that (dx, dy) to every coordinate of every feature on that
     floor (not just the anchors) - Polygon rings only; this repo's data
     has no other geometry type (checked before writing this).

A floor with zero shared suffixes with the reference floor can't be
aligned by this method and is left untouched (a warning is printed) -
pick a different --reference or add a floor-to-floor chain manually if
that happens.

USAGE
-----
    python3 align_floors.py path/to/some-building.geojson [--reference "Library_Basement"] [--write] [--report]

Without --write, this only prints the computed offsets (dry run) - use
--report to also print the per-anchor spread that backs the "translate-
only is good enough" claim above. Pass --write to overwrite the input
file in place with aligned coordinates. Always diff or back up the file
first; this is a one-way, in-place transform with no undo.
"""
import argparse
import json
import statistics
import sys
from collections import defaultdict


def centroid(geometry):
    if not geometry:
        return None
    if geometry["type"] != "Polygon":
        raise ValueError(f"Unsupported geometry type {geometry['type']!r} - this script only handles Polygon/null")
    ring = geometry["coordinates"][0]
    xs = [c[0] for c in ring]
    ys = [c[1] for c in ring]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def translate_geometry(geometry, dx, dy):
    if not geometry:
        return geometry
    geometry["coordinates"] = [
        [[x + dx, y + dy] for x, y in ring] for ring in geometry["coordinates"]
    ]
    return geometry


def compute_offsets(features, reference_floor, report=False):
    anchors = defaultdict(dict)  # suffix -> {floor_label: (x, y)}
    for f in features:
        p = f["properties"]
        if p.get("Category") == "Circulation" and p.get("SubCategory") in ("Elevator", "Stairway"):
            c = centroid(f.get("geometry"))
            if c is not None:
                anchors[p["room_number"][1:]][p["floor_label"]] = c

    floors = sorted(set(f["properties"]["floor_label"] for f in features))
    if reference_floor not in floors:
        sys.exit(f"--reference {reference_floor!r} not found; floors present: {floors}")

    offsets = {reference_floor: (0.0, 0.0)}
    for floor in floors:
        if floor == reference_floor:
            continue
        dxs, dys, matched = [], [], []
        for suffix, by_floor in anchors.items():
            if reference_floor in by_floor and floor in by_floor:
                rx, ry = by_floor[reference_floor]
                fx, fy = by_floor[floor]
                dxs.append(rx - fx)
                dys.append(ry - fy)
                matched.append(suffix)
        if not dxs:
            print(f"WARNING: {floor} shares no elevator/stairway suffix with {reference_floor} - left unaligned", file=sys.stderr)
            continue
        dx, dy = statistics.mean(dxs), statistics.mean(dys)
        offsets[floor] = (dx, dy)
        if report:
            spread_x = (max(dxs) - min(dxs)) if len(dxs) > 1 else 0.0
            spread_y = (max(dys) - min(dys)) if len(dys) > 1 else 0.0
            print(f"{floor}: {len(dxs)} anchors {matched}")
            print(f"  offset=({dx:.2f}, {dy:.2f})  spread=({spread_x:.2f}, {spread_y:.2f})")
    return offsets


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("geojson_path")
    ap.add_argument("--reference", default=None, help="floor_label to align every other floor onto (default: whichever floor has the most rooms)")
    ap.add_argument("--write", action="store_true", help="overwrite geojson_path in place (default: dry run, offsets only)")
    ap.add_argument("--report", action="store_true", help="print per-anchor spread for each computed offset")
    args = ap.parse_args()

    with open(args.geojson_path) as fh:
        data = json.load(fh)
    features = data["features"]

    reference = args.reference
    if reference is None:
        counts = defaultdict(int)
        for f in features:
            counts[f["properties"]["floor_label"]] += 1
        reference = max(counts, key=counts.get)
        print(f"No --reference given, defaulting to {reference!r} ({counts[reference]} rooms)")

    offsets = compute_offsets(features, reference, report=args.report)

    for f in features:
        floor = f["properties"]["floor_label"]
        dx, dy = offsets.get(floor, (0.0, 0.0))
        if (dx, dy) != (0.0, 0.0):
            translate_geometry(f.get("geometry"), dx, dy)

    if args.write:
        with open(args.geojson_path, "w") as fh:
            json.dump(data, fh, indent=2)
        print(f"Wrote aligned coordinates to {args.geojson_path}")
    else:
        print("Dry run - pass --write to apply. Offsets:")
        for floor, (dx, dy) in offsets.items():
            print(f"  {floor}: ({dx:.2f}, {dy:.2f})")


if __name__ == "__main__":
    main()
