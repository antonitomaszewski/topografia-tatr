"""Shared paths and settings for the data pipeline."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"            # downloaded inputs (git-ignored)
DERIVED = DATA / "derived"    # processed map data (committed)

ZOOM = 13                     # terrain tile zoom (~12 m/px at 49°N)
BBOX = dict(west=19.55, east=20.36, south=49.08, north=49.34)
