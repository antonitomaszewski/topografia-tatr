"""Add photos of named places from Wikimedia Commons categories.

Geotagged photos (fetch_photos.py) cover the map unevenly and say where the
camera stood. These ones come from the category of a place
(e.g. "Category:Kozi Wierch"), so the answer is what the photo shows.
Their coordinates are the place's own, taken from the knowledge base.

Output: data/photos_cat.json (same fields as photos_game.json plus "sub": true).
"""
import json
import random

from common import DATA
from fetch_photos import BLOCK, FREE, get, strip_html

PER_PLACE = 8
TARGET = 450


def places():
    """Important places: knowledge-base entries on the Polish side and the border."""
    kb = json.load(open(DATA / "kb" / "valleys.json"))["items"] + json.load(open(DATA / "kb" / "peaks.json"))["items"]
    out = {}
    for it in kb:
        if not it.get("lat") or it.get("kind") not in ("dolina", "szczyt", "przełęcz", "polana", "kocioł", "turnia"):
            continue
        name = it["name"].split(" (")[0]
        names = [name] + ([it["name_sk"]] if it.get("name_sk") else [])
        out[name] = {"names": names, "lat": it["lat"], "lon": it["lon"], "kind": it["kind"], "pl": "PL" in (it.get("country") or "PL")}
    for extra, lat, lon, kind in [("Morskie Oko", 49.1986, 20.0711, "staw"), ("Czarny Staw pod Rysami", 49.1885, 20.0756, "staw"),
                                  ("Wielki Staw Polski", 49.2105, 20.0350, "staw"), ("Czarny Staw Gąsienicowy", 49.2307, 20.0180, "staw"),
                                  ("Smreczyński Staw", 49.2112, 19.8508, "staw"), ("Siklawa", 49.2142, 20.0440, "wodospad"),
                                  ("Wodogrzmoty Mickiewicza", 49.2336, 20.0870, "wodospad"), ("Orla Perć", 49.2194, 20.0252, "szlak")]:
        out.setdefault(extra, {"names": [extra], "lat": lat, "lon": lon, "kind": kind, "pl": True})
    return out


def main():
    random.seed(11)
    P = places()
    have = {p["src"] for p in json.load(open(DATA / "photos_game.json"))}
    # 1. which places have a Commons category
    cats = {}
    titles = [(name, n) for name, p in P.items() for n in p["names"]]
    for i in range(0, len(titles), 50):
        chunk = titles[i:i + 50]
        r = get({"action": "query", "titles": "|".join("Category:" + n for _, n in chunk), "prop": "categoryinfo"})
        for page in r.get("query", {}).get("pages", []):
            files = page.get("categoryinfo", {}).get("files", 0)
            if files:
                for name, n in chunk:
                    if "Category:" + n == page["title"] and name not in cats:
                        cats[name] = page["title"]
    print(f"{len(cats)} of {len(P)} places have a category")
    # 2. files in each category
    out = []
    for name, cat in cats.items():
        r = get({"action": "query", "generator": "categorymembers", "gcmtitle": cat, "gcmtype": "file", "gcmlimit": 40,
                 "prop": "imageinfo", "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1280})
        got = []
        for page in r.get("query", {}).get("pages", []):
            ii = (page.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata", {})
            w, h = ii.get("width", 0), ii.get("height", 0)
            lic = em.get("LicenseShortName", {}).get("value", "")
            title = page["title"][5:].rsplit(".", 1)[0]
            desc = strip_html(em.get("ImageDescription", {}).get("value", ""))[:240]
            if (ii.get("mime") != "image/jpeg" or w < 1200 or not (1.2 <= w / max(h, 1) <= 2.4) or not FREE.search(lic)
                    or BLOCK.search(title) or BLOCK.search(desc) or ii.get("descriptionurl") in have):
                continue
            p = P[name]
            got.append({"t": title[:140], "u": ii.get("thumburl"), "src": ii.get("descriptionurl"),
                        "lat": p["lat"], "lon": p["lon"], "a": strip_html(em.get("Artist", {}).get("value", ""))[:80] or "nieznany",
                        "l": lic, "d": desc, "pl": p["pl"], "label": name, "kind": p["kind"], "sub": True})
        random.shuffle(got)
        out += got[:PER_PLACE]
        print(f"  {name}: {len(got)} usable")
    random.shuffle(out)
    out.sort(key=lambda x: not x["pl"])
    out = out[:TARGET]
    (DATA / "photos_cat.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"saved {len(out)} photos for {len({x['label'] for x in out})} places")


if __name__ == "__main__":
    main()
