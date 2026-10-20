"""Collect ~1000 geotagged Tatra landscape photos from Wikimedia Commons.

The photos are not downloaded: the game loads thumbnails straight from
upload.wikimedia.org. This script stores only metadata in data/photos_game.json:
thumbnail URL, camera location, author, licence and, when the title or
categories name a known place, that place as the answer label.

Selection:
- geotagged files inside the Tatras (geosearch over a grid of small boxes),
- landscape JPEGs >= 1200 px wide under a free licence,
- camera point at >= 1000 m a.s.l. according to the DEM (drops town shots),
- titles/categories without animals, plants, buildings, people etc.,
- spread over 1 km cells (at most PER_CELL per cell), Polish side preferred.
"""
import json
import math
import random
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

import numpy as np

from common import DATA, DERIVED, RAW

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "TopografiaTatr/1.0 (educational study game; Python urllib)"}
AREA = dict(south=49.12, north=49.31, west=19.62, east=20.30)
TARGET = 1000
PER_CELL = 12
MIN_ELE = 1000

# stems match anywhere in a word; WORDS only as whole words (short or ambiguous ones)
STEMS = ("świstak swistak kozic marmot chamois kamzík svišť niedźwied jeleń ptak vták motyl butterfl owad insect "
         "chrząszcz beetle pająk spider ślimak snail jaszczur lizard salamand traszk kwiat flower květ goryczk "
         "gentian krokus crocus szarotk edelweiss dzwonk campanula storczyk orchid saxifrag skalnic porost lichen "
         "grzyb mushroom fungus roślin rastlin kościół church kostol kaplic chapel pomnik monument tablic plaque "
         "cmentarz cemetery wnętrz interior restaurac bufet kuchni jadalni pensjonat ludzie people turyści tourists "
         "portret portrait selfie ratownik rescuer wedding samochód autobus pociąg stacja station parking kolejk "
         "lanovk wyciąg gondol drogowskaz signpost tabliczk bilet ticket").split()
WORDS = "bird ptaki moss mech plant car cars bus train vlak lift sign map mapa logo dom house hotel willa villa room izba koń horse owce sheep krowa cow pies dog kot cat".split()
BLOCK = re.compile("|".join(map(re.escape, STEMS)) + r"|\b(?:" + "|".join(WORDS) + r")\b", re.I)

FREE = re.compile(r"^(cc|public domain|pd|cc0)", re.I)


DELAY = 1.0   # seconds between API calls; Commons answers 429 when hit faster


def get(params):
    params = {**params, "format": "json", "formatversion": 2, "maxlag": 5}
    wait = 20
    for attempt in range(8):
        try:
            req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers=UA)
            r = json.load(urllib.request.urlopen(req, timeout=60))
            time.sleep(DELAY)
            if "error" in r and r["error"].get("code") == "maxlag":
                raise RuntimeError("maxlag")
            return r
        except urllib.error.HTTPError as e:
            retry = int(e.headers.get("Retry-After") or wait)
            print(f"  HTTP {e.code}, waiting {retry}s")
            time.sleep(retry)
        except Exception as e:
            print(f"  {str(e)[:60]}, waiting {wait}s")
            time.sleep(wait)
        wait = min(wait * 2, 300)
    return {}


def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", s).strip()


def norm(s):
    s = unicodedata.normalize("NFD", (s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").replace("ł", "l")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


# ---------- 1. candidates from geosearch ----------
def geosearch():
    seen = {}
    lat_step, lon_step = 0.02, 0.03
    lat = AREA["south"]
    while lat < AREA["north"]:
        lon = AREA["west"]
        while lon < AREA["east"]:
            box = f"{lat + lat_step}|{lon}|{lat}|{lon + lon_step}"
            r = get({"action": "query", "list": "geosearch", "gsbbox": box, "gsnamespace": 6, "gslimit": 500})
            for g in r.get("query", {}).get("geosearch", []):
                seen[g["pageid"]] = (g["title"], g["lat"], g["lon"])
            lon += lon_step
        lat += lat_step
        print(f"  lat {lat:.2f}: {len(seen)} files so far")
    return seen


# ---------- 2. metadata ----------
def metadata(ids):
    out = {}
    ids = list(ids)
    for i in range(0, len(ids), 50):
        r = get({"action": "query", "pageids": "|".join(map(str, ids[i:i + 50])),
                 "prop": "imageinfo|categories", "iiprop": "url|size|mime|extmetadata",
                 "iiurlwidth": 1280, "cllimit": "max", "clshow": "!hidden"})
        for p in r.get("query", {}).get("pages", []):
            if p.get("imageinfo"):
                out[p["pageid"]] = p
        if i % 1000 == 0:
            print(f"  metadata {i}/{len(ids)}")
    return out


# ---------- 3. place labels ----------
def gazetteer():
    osm = json.loads((DERIVED / "osm.js").read_text()[len("window.OSM="):-1])
    names = []

    def add(n, kind, lat, lon, alt=""):
        if n and len(norm(n)) >= 4:
            names.append((n, kind, lat, lon))
        if alt and len(norm(alt)) >= 4:
            names.append((n, kind, lat, lon, alt))

    for p in osm["peak"]:
        if p[4] and p[4] >= 1400:
            add(p[0], "szczyt", p[2], p[3], p[1])
    for p in osm["saddle"]:
        if p[4] and p[4] >= 1400 and re.search(r"przełęcz|sedlo|zawrat|liliowe|karb|krzyżne", p[0], re.I):
            add(p[0], "przełęcz", p[2], p[3], p[1])
    for v in osm["valley"]:
        if v[3] and re.search(r"dolin|kocioł|kotlin", v[0], re.I):
            m = v[3][len(v[3]) // 2]
            add(v[0], "dolina", m[0], m[1], v[1])
    for l in osm["lake"]:
        if l[0] and l[3]:
            la = sum(p[0] for p in l[3]) / len(l[3]); lo = sum(p[1] for p in l[3]) / len(l[3])
            add(l[0], "staw", la, lo, l[1])
    for h in osm["hut"]:
        if h[5]:
            add(h[0], "schronisko", h[2], h[3], h[1])
    for t in osm["locality"]:
        if re.search(r"^(hala|polana)\b", t[0], re.I):
            add(t[0], "polana", t[2], t[3])
    for extra in ("Hala Gąsienicowa", "Orla Perć"):
        pass
    gz = []
    for e in names:
        label, kind, lat, lon = e[:4]
        phrase = e[4] if len(e) > 4 else label
        toks = norm(phrase).split()
        gz.append((toks, label, kind, lat, lon))
    gz.sort(key=lambda g: -len(" ".join(g[0])))
    return gz


def tok_match(a, b):
    """Polish/Slovak inflection-tolerant token match (Dolina ~ Dolinie, Rysy ~ Rysów)."""
    if a == b:
        return True
    k = max(4, min(len(a), len(b)) - 3)
    return len(a) >= 4 and len(b) >= 4 and a[:k] == b[:k] and abs(len(a) - len(b)) <= 4


def find_label(text_toks, lat, lon, gz):
    for toks, label, kind, glat, glon in gz:
        n = len(toks)
        if n == 1 and len(toks[0]) < 5:
            continue
        for i in range(len(text_toks) - n + 1):
            if all(tok_match(text_toks[i + j], toks[j]) for j in range(n)):
                d = math.hypot((glat - lat) * 111, (glon - lon) * 73)
                if d < 9:
                    return label, kind, round(d, 1)
    return None


def main():
    random.seed(7)
    g = json.loads((DERIVED / "geo.json").read_text())
    H = np.load(RAW / "H.npy")
    n = 256 * 2 ** g["Z"]

    def elev(lat, lon):
        x = (lon + 180) / 360 * n - g["ox"]
        r = math.radians(lat)
        y = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n - g["oy"]
        xi, yi = round(x), round(y)
        return float(H[yi, xi]) if 0 <= yi < H.shape[0] and 0 <= xi < H.shape[1] else 0

    print("1/4 geosearch")
    cache = RAW / "commons_geosearch.json"
    if cache.exists():
        cand = {int(k): tuple(v) for k, v in json.load(open(cache)).items()}
    else:
        cand = geosearch()
        cache.write_text(json.dumps(cand))
    cand = {k: v for k, v in cand.items() if v[0].lower().endswith((".jpg", ".jpeg")) and not BLOCK.search(v[0])
            and elev(v[1], v[2]) >= MIN_ELE}
    print(f"  {len(cand)} candidates after title/elevation filter")

    print("2/4 metadata")
    mcache = RAW / "commons_meta.json"
    meta = {int(k): v for k, v in json.load(open(mcache)).items()} if mcache.exists() else {}
    missing = [k for k in cand if k not in meta]
    if missing:
        meta.update(metadata(missing))
        mcache.write_text(json.dumps(meta))

    print("3/4 filter and label")
    profile = json.loads((DERIVED / "profile.json").read_text())
    ring = [[49.42, 19.40]] + [[p[2], p[3]] for p in profile] + [[49.45, 20.16], [49.9, 20.16], [49.9, 19.40]]

    def is_pl(lat, lon):
        inside = False
        for i in range(len(ring)):
            (yi, xi), (yj, xj) = ring[i], ring[i - 1]
            if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                inside = not inside
        return inside

    gz = gazetteer()
    good = []
    for pid, (title, lat, lon) in cand.items():
        p = meta.get(pid)
        if not p:
            continue
        ii = p["imageinfo"][0]
        em = ii.get("extmetadata", {})
        w, h = ii.get("width", 0), ii.get("height", 0)
        lic = em.get("LicenseShortName", {}).get("value", "")
        if ii.get("mime") != "image/jpeg" or w < 1200 or not (1.2 <= w / max(h, 1) <= 2.4) or not FREE.search(lic):
            continue
        cats = [c["title"][9:] for c in p.get("categories", [])]
        desc = strip_html(em.get("ImageDescription", {}).get("value", ""))[:240]
        if BLOCK.search(" ".join(cats)) or BLOCK.search(desc):
            continue
        label = None
        for text in [" ".join(cats), title[5:].rsplit(".", 1)[0], desc]:
            label = find_label(norm(text).split(), lat, lon, gz)
            if label:
                break
        good.append({
            "t": title[5:].rsplit(".", 1)[0][:140],
            "u": ii.get("thumburl"),
            "src": ii.get("descriptionurl"),
            "lat": round(lat, 5), "lon": round(lon, 5),
            "ele": round(elev(lat, lon)),
            "a": strip_html(em.get("Artist", {}).get("value", ""))[:80] or "nieznany",
            "l": lic,
            "d": desc,
            "pl": is_pl(lat, lon),
            "label": label[0] if label else None,
            "kind": label[1] if label else None,
            "ld": label[2] if label else None,   # km from camera to the named place
            "q": any("Quality images" in c or "Valued images" in c for c in cats),
        })
    print(f"  {len(good)} usable, {sum(1 for x in good if x['label'])} with a place label")

    print("4/4 spread over the map")
    cells = {}
    for x in good:
        cells.setdefault((round(x["lat"] / 0.009), round(x["lon"] / 0.0137)), []).append(x)
    picked = []
    for items in cells.values():
        items.sort(key=lambda x: (not x["q"], not x["label"], random.random()))
        picked += items[:PER_CELL]
    pl = [x for x in picked if x["pl"]]
    sk = [x for x in picked if not x["pl"]]
    random.shuffle(pl); random.shuffle(sk)
    pl.sort(key=lambda x: (not x["label"], not x["q"]))
    sk.sort(key=lambda x: (not x["label"], not x["q"]))
    n_pl = min(len(pl), int(TARGET * 0.65))
    final = pl[:n_pl] + sk[:TARGET - n_pl]
    if len(final) < TARGET:
        final += pl[n_pl:n_pl + TARGET - len(final)]
    for x in final:
        del x["q"]
    (DATA / "photos_game.json").write_text(json.dumps(final, ensure_ascii=False, separators=(",", ":")))
    print(f"saved {len(final)} photos: {sum(x['pl'] for x in final)} PL, "
          f"{sum(1 for x in final if x['label'])} labelled")


if __name__ == "__main__":
    main()
