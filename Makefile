# Data pipeline. The site itself is static: `make serve` is all you need to run it.
PY ?= python3

.PHONY: serve fetch relief map topr data all

serve:            ## run the site locally at http://localhost:8000
	$(PY) -m http.server 8000

fetch:            ## download elevation tiles and OSM data into data/raw/
	cd tools && $(PY) fetch_dem.py && $(PY) fetch_osm.py

relief:           ## render relief.jpg from the elevation tiles
	cd tools && $(PY) render_relief.py

map:              ## process OSM data and the border profile
	cd tools && $(PY) process_osm.py && $(PY) border_profile.py

topr:             ## locate TOPR report places on the map
	cd tools && $(PY) geocode_topr.py

data:             ## assemble data.js from everything in data/
	cd tools && $(PY) build_data.py

all: fetch relief map topr data
