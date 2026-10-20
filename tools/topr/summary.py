"""Generate summary.md from incidents.json + rankings. usage: python -I summary.py <topr_dir>"""
import json, sys, os
from collections import Counter, defaultdict
D = sys.argv[1]
I = json.load(open(os.path.join(D, 'incidents.json')))
P = json.load(open(os.path.join(D, 'places_ranking.json')))
M = json.load(open(os.path.join(D, 'places_ranking_any_mention.json')))
arts = sorted({(i['article_key'], i['source']) for i in I})
weeks = sorted(i['week'] for i in I if i['week'])
srcs = Counter(s for _, s in arts)
L = []
L.append('# TOPR – gdzie najczęściej dochodzi do akcji ratunkowych\n')
L.append(f"- Artykuły z incydentami: **{len(arts)}** (" + ', '.join(f'{v}× {k}' for k, v in srcs.items()) + ')')
L.append(f"- Zakres: **{weeks[0].split('..')[0]} – {weeks[-1].split('..')[1]}** (z dziurami – patrz niżej)")
L.append(f"- Incydentów: **{len(I)}**; z primary_place: {sum(1 for i in I if i['primary_place'])}; śmiertelnych: {sum(1 for i in I if i['fatal'])}; ze śmigłowcem: {sum(1 for i in I if i['helicopter'] is True)}")
yc = Counter((i['date'] or i['week'].split('..')[1])[:4] for i in I if i['week'])
L.append('- Incydenty wg roku: ' + ', '.join(f'{y}: {c}' for y, c in sorted(yc.items())))
ac = Counter(i['area'] for i in I)
L.append('- Obszar: ' + ', '.join(f'{a}: {c}' for a, c in ac.most_common()))
tc = Counter(i['type'] for i in I)
L.append('- Typy: ' + ', '.join(f'{a}: {c}' for a, c in tc.most_common()) + '\n')
L.append('## Top 40 miejsc (primary_place – miejsce zdarzenia)\n')
L.append('| # | Miejsce | Liczba | Obszar | Główne typy |')
L.append('|---|---|---|---|---|')
for n, r in enumerate(P[:40], 1):
    t = ', '.join(f'{k} {v}' for k, v in list(r['types'].items())[:3])
    L.append(f"| {n} | {r['place']} | {r['count']} | {r['area']} | {t} |")
L.append('\n## Top 25 – każda wzmianka (pole places, z dolinami i schroniskami)\n')
L.append(', '.join(f"{r['place']} ({r['count']})" for r in M[:25]) + '\n')
# seasonal
mon = defaultdict(Counter)
for i in I:
    if i['date']:
        mon[int(i['date'][5:7])][i['type']] += 1
L.append('## Sezonowość (incydenty z datą, wg miesiąca)\n')
L.append('| Mies. | Razem | uraz | zasłab. | utknięcie | zabłądz. | lawina | wspin. | narty | śmiert. |')
L.append('|---|---|---|---|---|---|---|---|---|---|')
keys = ["uraz/wypadek", "zasłabnięcie/choroba", "zablokowanie/utknięcie (nie może zejść)", "zabłądzenie/poszukiwania", "lawina",
        "wspinaczka/taternictwo", "narciarstwo/skitury", "śmiertelny"]
for m in range(1, 13):
    c = mon[m]
    L.append(f"| {m} | {sum(c.values())} | " + ' | '.join(str(c[k]) for k in keys) + ' |')
# top places per type
L.append('\n## Najczęstsze miejsca wg typu\n')
for k in keys + ['jaskinia']:
    pc = Counter(i['primary_place'] for i in I if i['type'] == k and i['primary_place'])
    L.append(f"- **{k}**: " + ', '.join(f'{p} ({c})' for p, c in pc.most_common(10)))
fat = Counter(i['primary_place'] for i in I if i['fatal'] and i['primary_place'])
L.append(f"- **wszystkie śmiertelne (fatal=true)**: " + ', '.join(f'{p} ({c})' for p, c in fat.most_common(12)))
extra = os.path.join(D, 'scripts', 'summary_notes.md')
if os.path.exists(extra):
    L.append('\n' + open(extra).read())
open(os.path.join(D, 'summary.md'), 'w').write('\n'.join(L) + '\n')
print('summary written')
