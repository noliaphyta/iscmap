#!/usr/bin/env python3
"""
OCR ingestion for "Find a Room" (dot-only, label-driven).

Scans a floor plan image for room-number text, and emits a validated
`labels` array to merge into that floor's data/floorN.json. This replaces
manual polygon tracing for now — see README "Known limitations".

A room's location is defined as the centroid of its detected text bounding
box. No other geometry is involved. Only 4-digit room numbers (optionally
suffixed with one letter, e.g. "1221A") are accepted — 3-digit and other
malformed OCR reads are rejected.

Usage:
    python3 tools/ocr_ingest.py --floor 1 \
        --image assets/floorplans/ISC-1.png \
        --out /tmp/floor1-labels.json

    # Merge results into data/floor1.json's "labels"/"flagged" keys yourself,
    # or pass --merge to write the merged file directly (keeps everything
    # else in the file untouched). Flagged items are merged too, so they
    # show up in tools/label-editor.html for manual review.
    python3 tools/ocr_ingest.py --floor 1 \
        --image assets/floorplans/ISC-1.png \
        --data data/floor1.json --merge

Requires: pytesseract, Pillow, and the `tesseract` binary.
"""

import argparse
import json
import re
import sys
from collections import defaultdict

import numpy as np
from PIL import Image
import pytesseract

# Room number format: exactly 4 digits, optional trailing letter suite
# (e.g. "1221A", "0101B"). No 3-digit numbers accepted.
ROOM_NUMBER_RE = re.compile(r"^\d{4}[A-Z]?$")

# First-floor image -> room must start with digit "1", etc. Adjust here if
# the building's real numbering scheme doesn't map floor N -> prefix N
# (e.g. if floor 0 uses prefix "0" or ground-floor rooms use no leading
# digit at all — verify against a few known real room numbers first).
def expected_prefix(floor):
    return str(floor)

# Below this confidence (tesseract's 0-100 scale, normalized to 0-1 here),
# a detection is flagged for manual review rather than auto-included.
CONFIDENCE_GATE = 0.75

# Tesseract's default single-pass OCR misses small text scattered across a
# large architectural drawing. --psm 11 ("sparse text, no particular
# order") is tuned for exactly this: many short, disconnected text
# fragments rather than paragraphs.
TESSERACT_CONFIG = "--psm 11 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


# A single full-image OCR pass loses almost all room-number text on a
# drawing this large: each label is only ~15-25px tall against a
# 4000x3297px canvas, well below the point size tesseract is tuned for.
# Fix: slice into overlapping tiles, upscale each tile, OCR separately,
# then translate coordinates back to full-image space. TILE_SIZE and
# OVERLAP are in *source* pixels (pre-upscale); OVERLAP just needs to be
# comfortably larger than one room-number label so nothing is cut in half
# at every tile boundary.
TILE_SIZE = 800
OVERLAP = 150
UPSCALE = 3

# Room-number text is printed in black, but sits directly on top of the
# floor plan's category fill colors (green, pink, magenta, etc.), not a
# plain white background. Tesseract reads that as noise almost entirely
# (verified empirically - raw/grayscale tiles returned near-garbage even
# upscaled). Binarizing first - keep only dark ("ink") pixels as black,
# everything else white - strips the color fill out and made the biggest
# accuracy difference of anything in this script.
BINARIZE_THRESHOLD = 100  # 0-255 luminance; below this = text/line ink


def binarize(img):
    arr = np.array(img.convert("RGB"))
    gray = arr.mean(axis=2)
    mask = gray < BINARIZE_THRESHOLD
    out = np.where(mask[..., None], 0, 255).astype("uint8")
    out = np.repeat(out, 3, axis=2)
    return Image.fromarray(out)


def _tile_bounds(total, tile_size, overlap):
    bounds = []
    start = 0
    while start < total:
        end = min(start + tile_size, total)
        bounds.append((start, end))
        if end == total:
            break
        start += tile_size - overlap
    return bounds


def run_ocr(image_path):
    """Returns a list of raw detections: {text, x1, y1, x2, y2, confidence}
    in full-image pixel coordinates."""
    img = Image.open(image_path)
    if img.mode != "RGB":
        # tesseract handles RGBA inconsistently (transparent regions can
        # read as noise) - flatten onto white first, matching how the
        # floor plans render in-app before the landscape chroma-key step.
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
        img = bg

    width, height = img.size
    x_tiles = _tile_bounds(width, TILE_SIZE, OVERLAP)
    y_tiles = _tile_bounds(height, TILE_SIZE, OVERLAP)

    detections = []
    total_tiles = len(x_tiles) * len(y_tiles)
    done = 0
    for (x1, x2) in x_tiles:
        for (y1, y2) in y_tiles:
            done += 1
            tile = img.crop((x1, y1, x2, y2))
            tile = binarize(tile)
            tile = tile.resize((tile.width * UPSCALE, tile.height * UPSCALE), Image.LANCZOS)

            data = pytesseract.image_to_data(
                tile, config=TESSERACT_CONFIG, output_type=pytesseract.Output.DICT
            )
            n = len(data["text"])
            for i in range(n):
                text = data["text"][i].strip()
                if not text:
                    continue
                conf_raw = data["conf"][i]
                try:
                    conf = float(conf_raw)
                except (TypeError, ValueError):
                    continue
                if conf < 0:  # tesseract uses -1 for non-text regions
                    continue

                tx, ty, tw, th = (data["left"][i], data["top"][i],
                                   data["width"][i], data["height"][i])
                # Translate tile-local, upscaled coords back to full-image
                # source coords.
                fx1 = x1 + tx / UPSCALE
                fy1 = y1 + ty / UPSCALE
                fx2 = x1 + (tx + tw) / UPSCALE
                fy2 = y1 + (ty + th) / UPSCALE
                detections.append({
                    "text": text,
                    "x1": round(fx1), "y1": round(fy1),
                    "x2": round(fx2), "y2": round(fy2),
                    "confidence": round(conf / 100.0, 3),
                })
            if done % 10 == 0 or done == total_tiles:
                print(f"  tile {done}/{total_tiles}...", file=sys.stderr)

    return detections


def merge_adjacent_characters(detections):
    """
    Tesseract frequently splits one room-number label into separate
    single/few-character detections (e.g. "1","3","3","5" instead of
    "1335") at this font size, even after upscaling. Reassemble detections
    that sit on the same text line and are close enough horizontally to
    plausibly be one label, in left-to-right reading order.

    Conservative on purpose: a false merge (joining two unrelated numbers)
    fails the regex/dedupe checks downstream same as a bad OCR read would,
    but a missed merge just means a real room silently doesn't make it in
    - so this errs toward merging when in doubt.
    """
    if not detections:
        return detections

    # Sort by vertical position, then horizontal, so line-grouping and
    # left-to-right joining both fall out of one pass.
    dets = sorted(detections, key=lambda d: (d["y1"], d["x1"]))

    merged = []
    used = [False] * len(dets)

    for i, d in enumerate(dets):
        if used[i]:
            continue
        group = [d]
        used[i] = True
        height = d["y2"] - d["y1"]
        cursor = d

        # Greedily extend rightward: next detection must vertically overlap
        # this one's line and start within roughly one character-width of
        # where this one ends.
        for j in range(i + 1, len(dets)):
            if used[j]:
                continue
            cand = dets[j]
            v_overlap = min(d["y2"], cand["y2"]) - max(d["y1"], cand["y1"])
            same_line = v_overlap > 0.5 * height
            gap = cand["x1"] - cursor["x2"]
            close_enough = 0 <= gap <= height  # character width scales with height
            if same_line and close_enough:
                group.append(cand)
                used[j] = True
                cursor = cand

        if len(group) == 1:
            merged.append(d)
        else:
            text = "".join(g["text"] for g in group)
            merged.append({
                "text": text,
                "x1": min(g["x1"] for g in group),
                "y1": min(g["y1"] for g in group),
                "x2": max(g["x2"] for g in group),
                "y2": max(g["y2"] for g in group),
                "confidence": round(sum(g["confidence"] for g in group) / len(group), 3),
            })

    return merged


def validate_and_dedupe(detections, floor):
    """
    Applies format/prefix/confidence rules, then dedupes by room number
    (keeping the highest-confidence detection). Returns (labels, flagged, rejected).
    """
    prefix = expected_prefix(floor)
    candidates = defaultdict(list)  # room_number -> list of detections
    rejected = []

    for det in detections:
        text = det["text"].upper()
        if not ROOM_NUMBER_RE.match(text):
            rejected.append({**det, "reason": "format"})
            continue
        if not text.startswith(prefix):
            rejected.append({**det, "reason": f"floor prefix (expected {prefix}xxx)"})
            continue
        candidates[text].append(det)

    labels = []
    flagged = []
    conflicts = []

    for room_number, dets in candidates.items():
        dets.sort(key=lambda d: d["confidence"], reverse=True)
        best = dets[0]
        if len(dets) > 1:
            conflicts.append({"room_number": room_number, "count": len(dets)})

        x1, y1, x2, y2 = best["x1"], best["y1"], best["x2"], best["y2"]
        entry = {
            "room_number": room_number,
            "floor": floor,
            "x": round((x1 + x2) / 2),
            "y": round((y1 + y2) / 2),
            "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
            "confidence": best["confidence"],
        }

        if best["confidence"] < CONFIDENCE_GATE:
            flagged.append(entry)
        else:
            labels.append(entry)

    return labels, flagged, rejected, conflicts


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--floor", type=int, required=True)
    ap.add_argument("--image", required=True, help="Path to the floor plan PNG")
    ap.add_argument("--out", help="Write labels JSON here")
    ap.add_argument("--data", help="Path to data/floorN.json (for --merge)")
    ap.add_argument("--merge", action="store_true",
                     help="Write labels directly into --data's \"labels\" key")
    args = ap.parse_args()

    print(f"Running OCR on {args.image} (this can take a minute on a 4000px image)...",
          file=sys.stderr)
    detections = run_ocr(args.image)
    print(f"  {len(detections)} raw text detections", file=sys.stderr)

    detections = merge_adjacent_characters(detections)
    print(f"  {len(detections)} after merging adjacent characters", file=sys.stderr)

    labels, flagged, rejected, conflicts = validate_and_dedupe(detections, args.floor)

    print(f"  {len(labels)} accepted, {len(flagged)} flagged (low confidence), "
          f"{len(rejected)} rejected (format/prefix)", file=sys.stderr)
    if conflicts:
        print(f"  {len(conflicts)} room number(s) detected more than once "
              f"(kept highest-confidence): {[c['room_number'] for c in conflicts]}",
              file=sys.stderr)
    if flagged:
        flagged_ids = [f["room_number"] for f in flagged]
        print(f"  FLAGGED for manual review (confidence < {CONFIDENCE_GATE}): {flagged_ids}",
              file=sys.stderr)

    result = {"labels": labels, "flagged": flagged}

    if args.out:
        with open(args.out, "w") as f:
            json.dump(result, f, indent=2)
        print(f"Wrote {args.out}", file=sys.stderr)

    if args.merge:
        if not args.data:
            sys.exit("--merge requires --data <path to floorN.json>")
        with open(args.data) as f:
            floor_data = json.load(f)
        floor_data["labels"] = labels
        floor_data["flagged"] = flagged
        with open(args.data, "w") as f:
            json.dump(floor_data, f, indent=2)
        print(f"Merged {len(labels)} labels + {len(flagged)} flagged into {args.data}"
              f" (\"labels\"/\"flagged\" keys). Review flagged items in tools/label-editor.html.",
              file=sys.stderr)


if __name__ == "__main__":
    main()
