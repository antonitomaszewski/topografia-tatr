"""Assemble everything the page needs into data.js (window.TATRY)."""
import json
import re

from common import DATA, DERIVED, ROOT

# photos with peak names drawn on them would give the answer away
ANNOTATED = re.compile(r"opis|podpis|labell?ed|annotat|z nazwami|with names|names of|nazwy|legend|T\d{2}\.\d", re.I)


def game_photos(*files):
    photos = [p for f in files for p in load(f, [])]
    return [p for p in photos if not ANNOTATED.search(p["t"] + " " + (p.get("d") or ""))]


# coordinates of rescue HQs, taken from their OSM objects
HQ = {"TOPR": (49.28479, 19.96473), "Horsk": (49.13993, 20.22303)}


def load(path, default):
    try:
        return json.load(open(path))
    except FileNotFoundError:
        print("missing", path.relative_to(ROOT))
        return default


def main():
    osm = json.loads((DERIVED / "osm.js").read_text()[len("window.OSM="):-1])
    geo = load(DERIVED / "geo.json", {})
    valleys = load(DATA / "kb" / "valleys.json", {"structure": [], "items": []})
    peaks = load(DATA / "kb" / "peaks.json", {"items": [], "trails": [], "huts": []})
    for h in peaks.get("huts", []):
        for prefix, (lat, lon) in HQ.items():
            if h.get("lat") is None and h["name"].startswith(prefix):
                h["lat"], h["lon"] = lat, lon
    data = {
        "osm": osm,
        "bounds": geo.get("bounds"),
        "border": load(DERIVED / "border_seq.json", []),
        "profile": load(DERIVED / "profile.json", []),
        "kb": {
            "structure": valleys.get("structure", []),
            "valleys": valleys.get("items", []),
            "peaks": peaks.get("items", []),
            "trails": peaks.get("trails", []),
            "huts": peaks.get("huts", []),
            "extra": load(DATA / "kb" / "extra.json", {}),
        },
        "gamePhotos": game_photos(DATA / "photos_game.json", DATA / "photos_cat.json"),
        "photos": [p for p in load(DATA / "photos.json", [])
                   if (ROOT / "photos" / p["file"]).exists() and not ANNOTATED.search(p["title_pl"])],
        "topr": {
            "incidents": load(DATA / "topr" / "incidents.json", []),
            "ranking": load(DATA / "topr" / "places_ranking.json", []),
            "geo": load(DATA / "topr" / "geocoded.json", {}),
        },
    }
    (ROOT / "data.js").write_text("window.TATRY=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";")
    print(f"data.js {(ROOT / 'data.js').stat().st_size / 1e6:.1f} MB, "
          f"{len(data['photos'])}+{len(data['gamePhotos'])} photos, {len(data['topr']['incidents'])} incidents")


if __name__ == "__main__":
    main()
