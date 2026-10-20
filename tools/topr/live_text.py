import json,re,sys,html
from bs4 import BeautifulSoup
d=sys.argv[1]
posts=[]
for f in ['posts_full_p1.json','posts_full_p2.json']:
    posts+=json.load(open(f'{d}/{f}'))
out=[]
for p in posts:
    if '/en/' in p['link']: continue
    s=BeautifulSoup(p['content']['rendered'],'html.parser')
    paras=[re.sub(r'\s+',' ',x.get_text(' ')).strip() for x in s.find_all(['p','li','h2','h3','h4'])]
    paras=[x for x in paras if x]
    out.append({'id':p['id'],'date':p['date'],'link':p['link'],'title':html.unescape(p['title']['rendered']),'paras':paras})
json.dump(out,open(f'{d}/live_posts_text.json','w'),ensure_ascii=False,indent=1)
for o in out: print(o['date'][:10],o['id'],len(' '.join(o['paras'])),o['title'])
