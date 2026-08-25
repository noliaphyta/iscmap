#!/usr/bin/env python3
"""
Merges a floor's QA'd `rooms` array from data/source/floorN.json into the
public data/floorN.json that the live app actually fetches.

Room data lives in data/source/ (not fetched by the browser) until someone
has verified it against the real building - see data/source/README.md and
the "Room data" section of the top-level README for why. Once a floor's
rooms are verified, run this to publish them:

    python3 tools/publish-rooms.py 2        # publish floor 2 only
    python3 tools/publish-rooms.py --all     # publish every floor in FLOORS

This only ever touches the `rooms` key - imageSize/image/features in the
public file are left exactly as they are, since those were never the
unreliable part.

Once at least one floor has been published this way, flip ROOMS_ENABLED
to true in src/mapConfig.js to turn the real room-polygon layer back on.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SOURCE_DIR = DATA_DIR / "source"

# Keep in sync with FLOORS in src/mapConfig.js.
ALL_FLOORS = [0, 1, 2, 3]


def publish(floor: int) -> None:
    public_path = DATA_DIR / f"floor{floor}.json"
    source_path = SOURCE_DIR / f"floor{floor}.json"

    if not source_path.exists():
        print(f"floor {floor}: no data/source/floor{floor}.json, skipping", file=sys.stderr)
        return
    if not public_path.exists():
        print(f"floor {floor}: no data/floor{floor}.json, skipping", file=sys.stderr)
        return

    source = json.loads(source_path.read_text())
    public = json.loads(public_path.read_text())

    rooms = source.get("rooms", [])
    public["rooms"] = rooms
    public_path.write_text(json.dumps(public, indent=2) + "\n")

    print(f"floor {floor}: published {len(rooms)} rooms")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("floor", nargs="?", type=int, help="single floor number to publish")
    group.add_argument("--all", action="store_true", help="publish every floor in FLOORS")
    args = parser.parse_args()

    floors = ALL_FLOORS if args.all else [args.floor]
    for floor in floors:
        publish(floor)


if __name__ == "__main__":
    main()
