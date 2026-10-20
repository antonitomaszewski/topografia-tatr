"""print articles compactly: python -I show.py <topr_dir> key1 key2 ..."""
import json,sys,os
A={a['key']:a for a in json.load(open(os.path.join(sys.argv[1],'articles.json')))}
for k in sys.argv[2:]:
    a=A[k]; print(f"##### {k}")
    for u in a['units']:
        t=u['t']
        print(f"{u['id']}| {t}")
