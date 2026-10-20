# Topografia Tatr

Interaktywna mapa i atlas Tatr do nauki topografii przed egzaminem do TOPR. Najwięcej szczegółów dotyczy polskiej strony, ale obejmuje też pogranicze słowackie.

- **Mapa:** relief z modelu terenu oraz szczyty, przełęcze, doliny, żleby, stawy, potoki, szlaki w kolorach PTTK, schroniska i granica PL/SK. Kliknięcie obiektu pokazuje opis, sąsiednie obiekty (kierunek i odległość), zdjęcia i akcje TOPR z tego miejsca. Jest też tryb „mapa ślepa” bez nazw.
- **Układ Tatr:** podział pasma, granice części, doliny od zachodu na wschód, profil wysokościowy grani granicznej i częste pomyłki.
- **Atlas:** opisy dolin, szczytów, przełęczy, szlaków i schronisk z pytaniami kontrolnymi.
- **Akcje TOPR:** ranking miejsc, w których ratownicy interweniują najczęściej, według tygodniowych podsumowań z topr.pl.
- **Quiz:**
  - wskaż na mapie,
  - co to za miejsce,
  - gdzie była akcja,
  - kolejność na grani,
  - kierunki,
  - pytania z opisów,
  - zdjęcia.

## Uruchomienie lokalnie

Strona jest statyczna, nie wymaga budowania ani instalowania zależności.

```bash
make serve          # albo: python3 -m http.server 8000
```

Następnie otwórz http://localhost:8000.

Otwarcie `index.html` bezpośrednio z dysku (`file://`) też zadziała w większości przeglądarek. Serwer jest jednak pewniejszy.

## GitHub Pages

1. Wypchnij repozytorium na GitHub.
2. Otwórz *Settings → Pages* i w polu *Build and deployment* ustaw: *Deploy from a branch*, gałąź `main`, katalog `/ (root)`.
3. Po minucie strona będzie pod adresem `https://<login>.github.io/topografia-tatr/`.

## Struktura

```
index.html, style.css, app.js   strona (Leaflet z cdnjs, fonty z Google Fonts)
data.js                         wszystkie dane strony, generowane przez tools/build_data.py
relief.jpg                      podkład mapy, generowany przez tools/render_relief.py
photos/                         zdjęcia z Wikimedia Commons
data/kb/                        opisy: doliny i układ Tatr, szczyty/przełęcze/szlaki/schroniska, pomyłki
data/topr/                      zdarzenia z raportów TOPR, ranking miejsc, ich lokalizacje
data/photos.json                opisy zdjęć, autorzy i licencje
data/derived/                   przetworzone warstwy mapy (OSM, profil grani)
data/raw/                       pobrane dane źródłowe (nie są w gicie)
tools/                          potok danych (Python)
```

## Przebudowa danych

Potrzebne tylko wtedy, gdy chcesz odświeżyć dane z OSM lub poprawić opisy.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r tools/requirements.txt
make all       # pobiera DEM i OSM, renderuje relief, przetwarza dane, składa data.js
```

Kroki można też uruchamiać osobno:

| Polecenie | Co robi |
|---|---|
| `make fetch` | pobiera dane źródłowe (DEM, OSM) |
| `make relief` | renderuje `relief.jpg` |
| `make map` | przetwarza dane OSM i profil grani |
| `make topr` | lokalizuje miejsca z raportów TOPR na mapie |
| `make data` | składa `data.js` |

**Edycja treści:** po zmianie plików w `data/kb/` wystarczy uruchomić `make data`.

**Nowe nazwy miejsc z raportów TOPR:** dopisz je do `tools/topr_aliases.json`. Wartością może być nazwa obiektu z OSM albo współrzędne `[lat, lon]`. Potem uruchom `make topr data`.

Skrypty, którymi pobrano i rozbito raporty TOPR na pojedyncze zdarzenia, są w `tools/topr/` (dla wglądu). Podział na zdarzenia był częściowo ręczny.

## Źródła i licencje

- **Dane mapy:** © współtwórcy OpenStreetMap, licencja [ODbL](https://opendatacommons.org/licenses/odbl/).
- **Model terenu:** [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen/AWS, m.in. SRTM).
- **Opisy:** na podstawie polskiej Wikipedii (CC BY-SA 4.0).
- **Zdjęcia:** Wikimedia Commons. Autor i licencja każdego zdjęcia są w `data/photos.json` i w podpisie po powiększeniu zdjęcia.
- **Akcje ratownicze:** tygodniowe podsumowania działań ratowniczych publikowane na [topr.pl](https://topr.pl).

To materiał do nauki, nie mapa do nawigacji. Przebieg i zamknięcia szlaków sprawdzaj w aktualnych komunikatach TPN i TANAP.
