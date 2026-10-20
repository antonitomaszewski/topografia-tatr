# Topografia Tatr

Gra do nauki topografii Tatr przed egzaminem do TOPR. Najwięcej szczegółów dotyczy polskiej strony, ale obejmuje też pogranicze słowackie.

**Gra.** Wszystkie tryby działają na ślepej mapie z prawdziwym reliefem, szlakami i stawami.
- **Egzamin:** 20 pytań mieszanych, na końcu wynik w procentach i przebieg z błędami.
- **Zdjęcie: gdzie to jest?** Około 1300 zdjęć z Wikimedia Commons. Klikasz na mapie i dostajesz punkty za odległość.
- **Zdjęcie: co to za miejsce?** Wybór jednej z czterech nazw.
- **Mapa: wskaż miejsce / co to jest?** Szczyty, przełęcze, doliny, stawy i schroniska.
- **Akcje TOPR: gdzie to było?** Prawdziwe opisy akcji z ukrytą nazwą miejsca.
- **Grań, kierunki, pytania z opisów.**

Błędne odpowiedzi wracają częściej. Postępy i najlepsze wyniki zapisują się w przeglądarce.

**Akcje TOPR.** Ranking miejsc, w których ratownicy interweniują najczęściej, według tygodniowych podsumowań z topr.pl.

**Zdjęcia do gry** nie są przechowywane w repo. Strona ładuje miniatury prosto z upload.wikimedia.org, więc gra wymaga internetu. W `data/` są tylko adresy, współrzędne, autorzy i licencje. Są dwa rodzaje zdjęć:
- **z geotagiem** (`data/photos_game.json`): odpowiedzią jest miejsce, z którego zrobiono zdjęcie;
- **z kategorii miejsca na Commons** (`data/photos_cat.json`): odpowiedzią jest miejsce widoczne na zdjęciu.

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
photos/                         wybrane zdjęcia z Wikimedia Commons (lokalne)
data/kb/                        opisy: doliny i układ Tatr, szczyty/przełęcze/szlaki/schroniska, pomyłki
data/topr/                      zdarzenia z raportów TOPR, ranking miejsc, ich lokalizacje
data/photos.json                opisy zdjęć z photos/, autorzy i licencje
data/photos_game.json           zdjęcia z geotagiem (metadane z Commons)
data/photos_cat.json            zdjęcia z kategorii miejsc (metadane z Commons)
data/derived/                   przetworzone warstwy mapy (OSM, profil grani)
data/raw/                       pobrane dane źródłowe (nie są w gicie)
tools/                          potok danych (Python)
```

## Przebudowa danych

Potrzebne tylko wtedy, gdy chcesz odświeżyć dane z OSM lub poprawić opisy.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r tools/requirements.txt
make all       # pobiera DEM i OSM, renderuje relief, zbiera zdjęcia, składa data.js
```

Kroki można też uruchamiać osobno:

| Polecenie | Co robi |
|---|---|
| `make fetch` | pobiera dane źródłowe (DEM, OSM) |
| `make relief` | renderuje `relief.jpg` |
| `make map` | przetwarza dane OSM i profil grani |
| `make photos` | zbiera zdjęcia do gry z Wikimedia Commons (wolne, API ma limity) |
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
