"""Merge extracted JSONL batches into incidents.json + rankings.
usage: python -I aggregate.py <topr_dir>
"""
import json, sys, os, glob, re, datetime
from collections import Counter, defaultdict

D = sys.argv[1]
A = {a['key']: a for a in json.load(open(os.path.join(D, 'articles.json')))}
NORM = json.load(open(os.path.join(D, 'scripts', 'place_norm.json')))  # variant -> canonical
ACCESS = {'Palenica Białczańska', 'Brzeziny', 'Kuźnice', 'Siwa Polana', 'Kiry', 'Zahradziska',
          'Wodogrzmoty Mickiewicza', 'Zazadnia', 'Łysa Polana', 'Wierch Poroniec', 'Gonciska'}
TYPES = ["uraz/wypadek", "zasłabnięcie/choroba", "zablokowanie/utknięcie (nie może zejść)", "zabłądzenie/poszukiwania",
         "lawina", "wspinaczka/taternictwo", "narciarstwo/skitury", "jaskinia", "śmiertelny", "inne"]


def norm(p):
    if p is None:
        return None
    p = re.sub(r'\s+', ' ', p.strip().strip('.,;'))
    q = NORM.get(p, p)
    return q or None


def week_of(a):
    """Return 'start..end' for the article's period."""
    if a['key'].startswith('K'):
        end = datetime.date.fromisoformat(a['key'][1:])
        return (end - datetime.timedelta(days=6)).isoformat() + '..' + end.isoformat()
    return None


incidents, problems = [], []
for f in sorted(glob.glob(os.path.join(D, 'extracted', '*.jsonl'))):
    for ln, line in enumerate(open(f)):
        if not line.strip():
            continue
        try:
            r = json.loads(line)
        except Exception as e:
            problems.append(f'{f}:{ln}: {e}')
            continue
        a = A.get(r.get('a'))
        if not a:
            problems.append(f'{f}:{ln}: unknown article {r.get("a")}')
            continue
        units = {u['id']: u['t'] for u in a['units']}
        ids = [i for i in r.get('u', []) if i in units]
        if not ids:
            problems.append(f'{f}:{ln}: no valid units')
        text = ' '.join(units[i] for i in sorted(set(ids)))
        t = r.get('type')
        if t not in TYPES:
            problems.append(f'{f}:{ln}: bad type {t}')
            t = 'inne'
        places = []
        for p in r.get('places') or []:
            q = norm(p)
            if q and q not in places:
                places.append(q)
        pp = norm(r.get('primary_place'))
        # trailheads / transport destinations are dropped unless they are the incident spot
        places = [q for q in places if q == pp or q not in ACCESS]
        if pp and pp not in places:
            places.insert(0, pp)
        incidents.append({
            'article_url': a['url'], 'article_key': a['key'], 'source': a['source'],
            'article_title': a['title'], 'published': a['published'],
            'week': r.get('week') or week_of(a),
            'date': r.get('date'), 'text': text, 'places': places, 'primary_place': pp,
            'area': r.get('area'), 'type': t, 'fatal': bool(r.get('fatal')),
            'helicopter': r.get('helicopter'), 'outcome_short': r.get('outcome_short'),
        })

# live posts: week = min..max incident dates within the article, else published date
by_art = defaultdict(list)
for i in incidents:
    by_art[i['article_key']].append(i)
for k, L in by_art.items():
    if k.startswith('K'):
        end = k[1:]
        ds = sorted(i['date'] for i in L if i['date'] and i['date'] <= end)
        start = (datetime.date.fromisoformat(end) - datetime.timedelta(days=6)).isoformat()
        if ds and ds[0] < start:
            start = ds[0]
        for i in L:
            i['week'] = start + '..' + end
    if k.startswith('L'):
        ds = sorted(i['date'] for i in L if i['date'])
        w = (ds[0] + '..' + ds[-1]) if ds else A[k]['published'] + '..' + A[k]['published']
        for i in L:
            i['week'] = w

incidents.sort(key=lambda i: (i['week'] or '', i['date'] or '', i['article_key']))
json.dump(incidents, open(os.path.join(D, 'incidents.json'), 'w'), ensure_ascii=False, indent=1)


HUT = {'Schronisko Murowaniec': 'Hala Gąsienicowa',
       'Schronisko w Dolinie Pięciu Stawów Polskich': 'Dolina Pięciu Stawów Polskich',
       'Schronisko nad Morskim Okiem': 'Morskie Oko',
       'Schronisko na Hali Kondratowej': 'Hala Kondratowa',
       'Schronisko PTTK na Hali Ornak': 'Hala Ornak',
       'Schronisko w Dolinie Chochołowskiej': 'Polana Chochołowska',
       'Schronisko w Dolinie Roztoki': 'Dolina Roztoki'}


def rk(p):
    return HUT.get(p, p)


def ranking(key_fn):
    cnt, types, ex, area = Counter(), defaultdict(Counter), defaultdict(list), defaultdict(Counter)
    for i in incidents:
        for p in key_fn(i):
            cnt[p] += 1
            area[p][i.get('area') or 'nieznany'] += 1
            types[p][i['type']] += 1
            if len(ex[p]) < 3:
                s = i['text']
                ex[p].append((s[:220] + '…') if len(s) > 220 else s)
    return [{'place': p, 'count': c, 'area': area[p].most_common(1)[0][0], 'types': dict(types[p].most_common()), 'examples': ex[p]}
            for p, c in cnt.most_common()]


prim = ranking(lambda i: [rk(i['primary_place'])] if i['primary_place'] else [])
anym = ranking(lambda i: list(dict.fromkeys(rk(p) for p in i['places'])))
json.dump(prim, open(os.path.join(D, 'places_ranking.json'), 'w'), ensure_ascii=False, indent=1)
json.dump(anym, open(os.path.join(D, 'places_ranking_any_mention.json'), 'w'), ensure_ascii=False, indent=1)
print(len(incidents), 'incidents;', len(prim), 'primary places;', len(problems), 'problems')
for p in problems[:30]:
    print('  ', p)
