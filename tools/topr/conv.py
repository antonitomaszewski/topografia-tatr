"""Convert compact manual extraction lines to JSONL.
line: KEY|units|MM-DD or -|T|H|A|primary|other places ; separated|outcome
T: U uraz, Z zasłabnięcie, B zablokowanie, P poszukiwania, L lawina, W wspinaczka, N narty, J jaskinia, S śmiertelny, I inne
   (append F for fatal when T is not S, e.g. LF)
H: 1 heli, 0 no heli, - unknown.  A: PL, SK, X (poza Tatrami), ? (nieznany)
usage: python -I conv.py in.txt out.jsonl
"""
import json, sys
T = {'U': 'uraz/wypadek', 'Z': 'zasłabnięcie/choroba', 'B': 'zablokowanie/utknięcie (nie może zejść)',
     'P': 'zabłądzenie/poszukiwania', 'L': 'lawina', 'W': 'wspinaczka/taternictwo', 'N': 'narciarstwo/skitury',
     'J': 'jaskinia', 'S': 'śmiertelny', 'I': 'inne'}
AR = {'PL': 'Tatry PL', 'SK': 'Tatry SK', 'X': 'poza Tatrami', '?': 'nieznany'}
out = []
for n, ln in enumerate(open(sys.argv[1]), 1):
    ln = ln.strip()
    if not ln or ln.startswith('#'):
        continue
    f = ln.split('|')
    assert len(f) == 9, (n, ln)
    key, us, d, t, h, a, pp, pl, oc = [x.strip() for x in f]
    ids = []
    for part in us.split(','):
        if '-' in part:
            x, y = part.split('-'); ids += list(range(int(x), int(y) + 1))
        else:
            ids.append(int(part))
    date = None
    if d != '-':
        y = int(key[1:5]); km = int(key[6:8]); m = int(d[:2])
        if m - km > 6: y -= 1
        date = f'{y}-{d}'
    fatal = t.startswith('S') or t.endswith('F')
    tt = T[t[0]]
    places = [pp] if pp else []
    places += [p.strip() for p in pl.split(';') if p.strip()]
    out.append({'a': key, 'u': ids, 'date': date, 'places': places, 'primary_place': pp or None,
                'area': AR[a], 'type': tt, 'helicopter': {'1': True, '0': False}.get(h), 'outcome_short': oc,
                'fatal': fatal})
open(sys.argv[2], 'w').write(''.join(json.dumps(o, ensure_ascii=False) + '\n' for o in out))
print(len(out), 'records')
