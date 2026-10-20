"""Download OpenStreetMap data for the Tatras through the Overpass API.

Public Overpass servers are often overloaded, so each query rotates
between mirrors with exponential backoff.
"""
import json
import sys
import time
import urllib.parse
import urllib.request

from common import RAW

MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
B = "(49.08,19.55,49.34,20.36)"
B_IN = "(49.12,19.6,49.3,20.32)"

QUERIES = {
    "features": f"""[out:json][timeout:180];
(
 node["natural"~"peak|saddle|valley|waterfall|cave_entrance|spring|rock|cliff|ridge|arete|couloir|gully"]["name"]{B};
 way["natural"~"valley|ridge|arete|couloir|gully|cliff"]["name"]{B};
 node["mountain_pass"="yes"]{B};
 nwr["tourism"~"alpine_hut|wilderness_hut|hotel|guest_house"]["name"]{B_IN};
 nwr["natural"="water"]["name"]{B};
 way["waterway"~"river|stream"]["name"]{B};
 node["place"~"town|village|hamlet|locality|isolated_dwelling"]["name"]{B};
 way["aerialway"]{B};
 nwr["emergency"~"mountain_rescue|rescue_box"]{B};
 nwr["amenity"="mountain_rescue"]{B};
);
out geom;""",
    "hiking": f"""[out:json][timeout:180];
(relation["route"="hiking"]{B_IN};);
out geom;""",
    "border": f"""[out:json][timeout:120];
relation["boundary"="administrative"]["admin_level"="2"]["ISO3166-1"~"PL|SK"]->.r;
way(r.r){B};
out geom;""",
}


def overpass(query, tries=12):
    wait = 10
    for i in range(tries):
        ep = MIRRORS[i % len(MIRRORS)]
        try:
            req = urllib.request.Request(ep, data=urllib.parse.urlencode({"data": query}).encode(),
                                         headers={"User-Agent": "TopografiaTatr/1.0 (educational)"})
            body = urllib.request.urlopen(req, timeout=240).read()
            json.loads(body)
            return body
        except Exception as e:
            print(f"  {ep}: {str(e)[:70]}; retry in {wait}s")
            time.sleep(wait)
            wait = min(wait * 1.5, 60)
    raise SystemExit("Overpass: all retries failed")


def main(names):
    out = RAW / "osm"
    out.mkdir(parents=True, exist_ok=True)
    for name in names or QUERIES:
        print("fetching", name)
        body = overpass(QUERIES[name])
        (out / f"{name}.json").write_bytes(body)
        print("  elements:", len(json.loads(body)["elements"]))


if __name__ == "__main__":
    main(sys.argv[1:])
