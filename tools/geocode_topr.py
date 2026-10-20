"""Match place names from TOPR weekly reports to map coordinates.

Exact name matches against OSM objects first; tools/topr_aliases.json maps
other spellings either to an OSM name or to explicit [lat, lon].
Writes data/topr/geocoded.json and prints the places left without a location.
"""
import json
import re
import unicodedata

from common import DATA, DERIVED, ROOT


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").replace("ł", "l")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def main():
    d = json.loads((DERIVED / "osm.js").read_text()[len("window.OSM="):-1])
    rank = json.load(open(DATA / "topr" / "places_ranking.json"))
    alias = json.load(open(ROOT / "tools" / "topr_aliases.json"))
    names = {}

    def reg(n, lat, lon):
        if n:
            names.setdefault(norm(n), []).append((lat, lon, n))

    for k in ("peak", "saddle", "hut", "town", "locality", "rescue", "cave", "waterfall", "valleypt"):
        for p in d.get(k, []):
            reg(p[0], p[2], p[3]); reg(p[1], p[2], p[3])
    lines = d["valley"] + [[l[0], l[1], 0, l[3]] for l in d["lake"]] + [[r[0], r[1], 0, r[2]] for r in d["ridge"]]
    for v in lines:
        if v[3]:
            m = v[3][len(v[3]) // 2]
            reg(v[0], m[0], m[1]); reg(v[1], m[0], m[1])

    out, miss = {}, []
    for r in rank:
        p = r["place"]
        a = alias.get(p)
        if isinstance(a, list):
            out[p] = {"lat": a[0], "lon": a[1]}
            continue
        cands = names.get(norm(a or p))
        if cands:
            lat, lon, n = cands[0]
            out[p] = {"name": n, "lat": lat, "lon": lon}
        else:
            miss.append((p, r["count"]))
    (DATA / "topr" / "geocoded.json").write_text(json.dumps(out, ensure_ascii=False, indent=0))
    print(len(out), "located,", len(miss), "without location")
    for p, c in sorted(miss, key=lambda x: -x[1])[:30]:
        print(f"  {c:3d}  {p}")


if __name__ == "__main__":
    main()
