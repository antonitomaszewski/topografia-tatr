"""Collect named places of the Polish Tatras from Polish Wikipedia.

Walks the Tatra topography categories (peaks, passes, valleys, gullies,
ridges, rock formations, meadows, waters, huts, caves, trails), takes the
coordinates of each article and keeps those on the Polish side or on the
border. The result feeds the "Mapa: wskaż miejsce" game.

Output: data/wiki_places.json
  [{"name", "title", "kind", "lat", "lon", "pl", "border"}]
"""
import json
import math
import re
import time
import urllib.error
import urllib.parse
import urllib.request

from common import DATA, DERIVED

API = "https://pl.wikipedia.org/w/api.php"
UA = {"User-Agent": "TopografiaTatr/1.0 (educational study game; Python urllib)"}

# root category -> kind used in the game
ROOTS = {
    "Szczyty tatrzańskie": "szczyt",
    "Przełęcze tatrzańskie": "przełęcz",
    "Doliny tatrzańskie": "dolina",
    "Kotły lodowcowe Tatr": "kocioł",
    "Granie i grzbiety tatrzańskie": "grań",
    "Formacje skalne Tatr": "skała",
    "Równie i upłazy tatrzańskie": "równia/upłaz",
    "Lodospady tatrzańskie": "lodospad",
    "Polany tatrzańskie": "polana",
    "Sieć wodna Tatr": "woda",
    "Schroniska tatrzańskie": "schronisko",
    "Jaskinie tatrzańskie": "jaskinia",
    "Drogi i szlaki tatrzańskie": "szlak",
}
MAX_DEPTH = 4
SKIP_CAT = re.compile(r"słowack|tatry słowackie|ludzie|historia|katastrof|kultur|w literaturze", re.I)
BORDER_M = 300


def get(params):
    params = {**params, "format": "json", "formatversion": 2, "maxlag": 5}
    wait = 10
    for _ in range(8):
        try:
            req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers=UA)
            r = json.load(urllib.request.urlopen(req, timeout=60))
            time.sleep(0.3)
            return r
        except urllib.error.HTTPError as e:
            time.sleep(int(e.headers.get("Retry-After") or wait))
        except Exception:
            time.sleep(wait)
        wait = min(wait * 2, 120)
    return {}


def members(cat):
    """All (title, ns) in a category, following continuation."""
    out, cont = [], {}
    while True:
        r = get({"action": "query", "list": "categorymembers", "cmtitle": "Kategoria:" + cat,
                 "cmlimit": 500, "cmtype": "page|subcat", **cont})
        out += [(m["title"], m["ns"]) for m in r.get("query", {}).get("categorymembers", [])]
        if "continue" not in r:
            return out
        cont = {"cmcontinue": r["continue"]["cmcontinue"]}


def crawl():
    """title -> kind; the first root that reaches a page wins (roots are ordered by priority)."""
    pages, seen_cats = {}, set()
    for root, kind in ROOTS.items():
        queue = [(root, 0)]
        while queue:
            cat, depth = queue.pop()
            if cat in seen_cats:
                continue
            seen_cats.add(cat)
            for title, ns in members(cat):
                if ns == 14 and depth < MAX_DEPTH and not SKIP_CAT.search(title):
                    queue.append((title[10:], depth + 1))
                elif ns == 0:
                    pages.setdefault(title, kind)
        print(f"  {root}: {len(pages)} pages so far")
    return pages


def coordinates(titles):
    out = {}
    titles = list(titles)
    for i in range(0, len(titles), 50):
        r = get({"action": "query", "titles": "|".join(titles[i:i + 50]), "prop": "coordinates", "colimit": "max"})
        for p in r.get("query", {}).get("pages", []):
            c = p.get("coordinates")
            if c:
                out[p["title"]] = (c[0]["lat"], c[0]["lon"])
    return out


CAVE = re.compile(r"^(jaskinia|dziura|grota|schron|szczelina|nyża|okap|koleba|komin w|studnia)\b", re.I)
GULLY = re.compile(r"żleb|kuluar|rynna|żlebek", re.I)
WATER = re.compile(r"staw|siklaw|potok|wodospad|źródło|wywierzysko|młaka|jeziorko", re.I)


def classify(name, kind):
    """Wikipedia files gullies under rock formations and some caves under waters; fix by name."""
    if CAVE.search(name):
        return "jaskinia"
    if GULLY.search(name):
        return "żleb"
    if WATER.search(name) and kind not in ("schronisko", "polana"):
        return "woda"
    return kind


def display_name(title):
    """'Kozi Wierch (Tatry)' -> 'Kozi Wierch'."""
    return re.sub(r"\s*\([^)]*\)$", "", title)


def main():
    print("1/3 categories")
    pages = crawl()
    print("2/3 coordinates")
    coords = coordinates(pages)
    print(f"  {len(coords)} of {len(pages)} pages have coordinates")

    profile = json.loads((DERIVED / "profile.json").read_text())
    ring = [[49.42, 19.40]] + [[p[2], p[3]] for p in profile] + [[49.45, 20.16], [49.9, 20.16], [49.9, 19.40]]
    bpts = profile[::2]

    def is_pl(lat, lon):
        inside = False
        for i in range(len(ring)):
            (yi, xi), (yj, xj) = ring[i], ring[i - 1]
            if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                inside = not inside
        return inside

    def border_dist(lat, lon):
        k = math.cos(math.radians(lat))
        return min(math.hypot((p[2] - lat) * 111320, (p[3] - lon) * 111320 * k) for p in bpts)

    print("3/3 Polish side")
    out = []
    for title, (lat, lon) in coords.items():
        if not (49.12 <= lat <= 49.32 and 19.70 <= lon <= 20.25):
            continue
        pl, bd = is_pl(lat, lon), border_dist(lat, lon)
        if pl or bd <= BORDER_M:
            out.append({"name": display_name(title), "title": title, "kind": classify(display_name(title), pages.get(title, "inne")),
                        "lat": round(lat, 5), "lon": round(lon, 5), "pl": pl, "border": bd <= BORDER_M})
    out.sort(key=lambda x: (x["kind"], x["name"]))
    (DATA / "wiki_places.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    kinds = {}
    for x in out:
        kinds[x["kind"]] = kinds.get(x["kind"], 0) + 1
    print(f"saved {len(out)} places:", ", ".join(f"{k} {v}" for k, v in sorted(kinds.items(), key=lambda kv: -kv[1])))


if __name__ == "__main__":
    main()
