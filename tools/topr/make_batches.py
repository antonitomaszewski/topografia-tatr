"""Build batch text files for extraction. usage: python -I make_batches.py <topr_dir> <max_chars>"""
import json, sys, os
D = sys.argv[1]
MAX = int(sys.argv[2])
A = json.load(open(os.path.join(D, 'articles.json')))
os.makedirs(os.path.join(D, 'batches'), exist_ok=True)


def render(a):
    out = [f"##### ARTICLE {a['key']} | published {a['published']} | {a['title']}"]
    lastp = None
    for u in a['units']:
        if u['p'] != lastp:
            out.append(f"--- para {u['p']}")
            lastp = u['p']
        out.append(f"{u['id']}| {u['t']}")
    return '\n'.join(out) + '\n\n'


live = [a for a in A if a['key'].startswith('L')]
kron = sorted([a for a in A if a['key'].startswith('K')], key=lambda a: a['key'])
batches = [[render(a) for a in sorted(live, key=lambda a: a['published'])]]
cur, size = [], 0
for a in kron:
    r = render(a)
    if cur and size + len(r) > MAX:
        batches.append(cur)
        cur, size = [], 0
    cur.append(r)
    size += len(r)
if cur:
    batches.append(cur)
for i, b in enumerate(batches):
    open(os.path.join(D, 'batches', f'batch_{i:02d}.txt'), 'w').write(''.join(b))
    print(i, len(b), sum(len(x) for x in b))
