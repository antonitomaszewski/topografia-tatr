"""Order the named peaks and passes along the PL/SK border and sample an
elevation profile along it. Outputs data/derived/border_seq.json and profile.json."""
import json
import math

import numpy as np

from common import DERIVED, RAW

NEAR_M = 45      # max distance from the border line to count an object as "on the ridge"
STEP_M = 60      # profile sampling step


def border_chain():
    segs = [[(p["lat"], p["lon"]) for p in w["geometry"]] for w in json.load(open(RAW / "osm" / "border.json"))["elements"]]
    chain = segs.pop(0)
    while segs:
        for i, s in enumerate(segs):
            if s[0] == chain[-1]: chain += s[1:]
            elif s[-1] == chain[-1]: chain += s[::-1][1:]
            elif s[-1] == chain[0]: chain = s + chain[1:]
            elif s[0] == chain[0]: chain = s[::-1] + chain[1:]
            else: continue
            segs.pop(i)
            break
        else:
            break
    return chain


def main():
    osm = json.loads((DERIVED / "osm.js").read_text()[len("window.OSM="):-1])
    chain = border_chain()
    K = 111320 * math.cos(math.radians(49.2))
    P = [(a * 111320, b * K) for a, b in chain]
    cum = [0.0]
    for a, b in zip(P, P[1:]):
        cum.append(cum[-1] + math.dist(a, b))

    def near(lat, lon):
        q = (lat * 111320, lon * K)
        best = (1e9, 0)
        for i, (a, b) in enumerate(zip(P, P[1:])):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = dx * dx + dy * dy or 1
            t = max(0, min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L))
            d = math.dist(q, (a[0] + t * dx, a[1] + t * dy))
            if d < best[0]:
                best = (d, cum[i] + t * math.dist(a, b))
        return best

    seq = []
    for kind in ("peak", "saddle"):
        for p in osm[kind]:
            d, s = near(p[2], p[3])
            if d < NEAR_M:
                seq.append({"km": round(s / 1000, 2), "kind": kind, "name": p[0], "alt": p[1], "ele": p[4]})
    seq.sort(key=lambda o: o["km"])
    (DERIVED / "border_seq.json").write_text(json.dumps(seq, ensure_ascii=False))

    g = json.loads((DERIVED / "geo.json").read_text())
    H = np.load(RAW / "H.npy")
    n = 256 * 2 ** g["Z"]

    def elev(lat, lon):
        x = (lon + 180) / 360 * n - g["ox"]
        r = math.radians(lat)
        y = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n - g["oy"]
        xi, yi = round(x), round(y)
        return float(H[yi, xi]) if 0 <= yi < H.shape[0] and 0 <= xi < H.shape[1] else None

    prof, nxt = [], 0.0
    for i, (a, b) in enumerate(zip(chain, chain[1:])):
        while nxt <= cum[i + 1]:
            t = (nxt - cum[i]) / ((cum[i + 1] - cum[i]) or 1)
            la, lo = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            e = elev(la, lo)
            prof.append([round(nxt / 1000, 3), round(e) if e else None, round(la, 5), round(lo, 5)])
            nxt += STEP_M
    (DERIVED / "profile.json").write_text(json.dumps(prof))
    print(len(seq), "objects on the border,", len(prof), "profile samples")


if __name__ == "__main__":
    main()
