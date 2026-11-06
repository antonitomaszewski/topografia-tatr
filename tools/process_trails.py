"""Named hiking-trail sections of the Polish Tatras from OSM route relations.

TPN-style relations are named after their end points ("Iwaniacka Przełęcz -
Hala Ornak") and carry the trail colour. Each becomes a "wskaż szlak" target
whose geometry is the list of its member ways.

Output: data/derived/trails.json  [{"name", "color", "lines": [[[lat, lon], ...], ...]}]
"""
import json
import math
import re

from common import DERIVED, RAW

COLORS = {"red", "blue", "green", "yellow", "black"}


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    dm, im = 0, 0
    for i in range(1, len(pts) - 1):
        p = pts[i]
        d = abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L if L > 1e-12 else math.hypot(p[0] - a[0], p[1] - a[1])
        if d > dm:
            dm, im = d, i
    return rdp(pts[:im + 1], eps)[:-1] + rdp(pts[im:], eps) if dm > eps else [a, b]


def main():
    rels = json.load(open(RAW / "osm" / "hiking.json"))["elements"]
    out, seen = [], set()
    for r in rels:
        t = r["tags"]
        name = (t.get("name") or "").strip()
        color = t.get("colour") or t.get("osmc:symbol", "").split(":")[0]
        if color not in COLORS or not re.search(r"\s[-–]\s", name):
            continue
        name = re.sub(r"\s+-\s+", " – ", name)
        if (name, color) in seen:
            continue
        lines = []
        for m in r.get("members", []):
            g = [p for p in m.get("geometry") or [] if p]
            if m["type"] == "way" and len(g) > 1:
                pts = [[p["lat"], p["lon"] * 0.654] for p in g]
                lines.append([[round(p[0], 5), round(p[1] / 0.654, 5)] for p in rdp(pts, 0.00005)])
        if lines:
            seen.add((name, color))
            out.append({"name": name, "color": color, "lines": lines})
    (DERIVED / "trails.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(out)} named trail sections")


if __name__ == "__main__":
    main()
