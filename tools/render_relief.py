"""Stitch DEM tiles, then render the shaded-relief image used as the map base.

Outputs: relief.jpg (repo root), data/raw/H.npy (elevation grid),
data/derived/geo.json (image bounds in lat/lon, Web Mercator).
"""
import json
import math

import numpy as np
from PIL import Image

from common import BBOX, DERIVED, RAW, ROOT, ZOOM
from fetch_dem import tile_range


def stitch():
    x0, x1, y0, y1 = tile_range()
    H = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), np.float32)
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            a = np.asarray(Image.open(RAW / "dem" / f"{ZOOM}_{x}_{y}.png").convert("RGB"), np.float32)
            H[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = \
                a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    n = 256 * 2**ZOOM
    px = lambda lon: (lon + 180) / 360 * n - x0 * 256
    py = lambda lat: (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n - y0 * 256
    cx0, cx1, cy0, cy1 = int(px(BBOX["west"])), int(px(BBOX["east"])), int(py(BBOX["north"])), int(py(BBOX["south"]))
    H = H[cy0:cy1, cx0:cx1]
    ox, oy = x0 * 256 + cx0, y0 * 256 + cy0
    lon = lambda x: x / n * 360 - 180
    lat = lambda y: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    geo = {"Z": ZOOM, "ox": ox, "oy": oy, "w": H.shape[1], "h": H.shape[0],
           "bounds": {"west": lon(ox), "east": lon(ox + H.shape[1]), "north": lat(oy), "south": lat(oy + H.shape[0])}}
    return H, geo


def blur(H, sigma=1.7, r=5):
    k = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * sigma**2))
    k /= k.sum()
    Hp = np.pad(H, r, mode="edge")
    Hp = np.apply_along_axis(lambda row: np.convolve(row, k, "same"), 1, Hp)
    Hp = np.apply_along_axis(lambda col: np.convolve(col, k, "same"), 0, Hp)
    return Hp[r:-r, r:-r]


def shade(H):
    res = 156543.03 / 2**ZOOM * math.cos(math.radians(49.2))
    gy, gx = np.gradient(blur(H), res)        # gy: towards south
    dzdx, dzdy = gx, -gy                      # east, north
    nz = 1 / np.sqrt(dzdx**2 + dzdy**2 + 1)
    nx, ny = -dzdx * nz, -dzdy * nz

    def light(az, alt):
        a, b = math.radians(az), math.radians(alt)
        return np.clip(nx * math.sin(a) * math.cos(b) + ny * math.cos(a) * math.cos(b) + nz * math.sin(b), 0, 1)

    hs = 0.6 * light(315, 35) + 0.25 * light(255, 40) + 0.15 * light(10, 55)
    slope = np.degrees(np.arccos(nz))
    stops = [(600, (200, 212, 178)), (900, (186, 204, 160)), (1200, (160, 188, 138)), (1500, (176, 190, 146)),
             (1750, (206, 200, 170)), (2000, (214, 206, 192)), (2300, (226, 222, 216)), (2600, (244, 243, 242))]
    e = np.clip(H, 600, 2600)
    rgb = np.stack([np.interp(e, [s[0] for s in stops], [s[1][i] for s in stops]) for i in range(3)], -1)
    rock = (np.clip((slope - 30) / 20, 0, 1) * np.clip((H - 1300) / 400, 0, 1))[..., None]
    rgb = rgb * (1 - rock * 0.6) + np.array([205, 200, 196]) * rock * 0.6
    return Image.fromarray(np.clip(rgb * (0.28 + 0.95 * hs)[..., None], 0, 255).astype(np.uint8))


def main():
    H, geo = stitch()
    np.save(RAW / "H.npy", H)
    shade(H).save(ROOT / "relief.jpg", quality=80, optimize=True, progressive=True)
    DERIVED.mkdir(parents=True, exist_ok=True)
    (DERIVED / "geo.json").write_text(json.dumps(geo))
    print("relief.jpg", H.shape, "elev", int(H.min()), "-", int(H.max()))


if __name__ == "__main__":
    main()
