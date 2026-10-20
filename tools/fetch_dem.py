"""Download Terrarium elevation tiles covering the Tatras."""
import concurrent.futures as cf
import math
import urllib.request

from common import BBOX, RAW, ZOOM

URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"


def tile_x(lon):
    return (lon + 180) / 360 * 2**ZOOM


def tile_y(lat):
    r = math.radians(lat)
    return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**ZOOM


def tile_range():
    return (int(tile_x(BBOX["west"])), int(tile_x(BBOX["east"])),
            int(tile_y(BBOX["north"])), int(tile_y(BBOX["south"])))


def main():
    out = RAW / "dem"
    out.mkdir(parents=True, exist_ok=True)
    x0, x1, y0, y1 = tile_range()

    def get(xy):
        x, y = xy
        p = out / f"{ZOOM}_{x}_{y}.png"
        if not p.exists():
            urllib.request.urlretrieve(URL.format(z=ZOOM, x=x, y=y), p)

    tiles = [(x, y) for x in range(x0, x1 + 1) for y in range(y0, y1 + 1)]
    with cf.ThreadPoolExecutor(16) as ex:
        list(ex.map(get, tiles))
    print(f"{len(tiles)} tiles in {out}")


if __name__ == "__main__":
    main()
