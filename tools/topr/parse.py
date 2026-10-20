"""Parse raw articles (Wayback kronika + live topr.pl posts) into clean paragraphs and numbered units.
usage: python -I parse.py <topr_dir>
"""
import json, re, sys, os, html, glob
from bs4 import BeautifulSoup

D = sys.argv[1]
RAW = os.path.join(D, 'raw')

# live posts that are rescue reports (Polish versions only). Decided by reading titles/contents.
LIVE_IDS = [12210, 11965, 11940, 11893, 11872, 11744, 11680, 11538, 11500, 11439, 11414, 11373,
            11326, 11268, 11181, 11129, 11016, 10860, 10836, 10759, 10713, 10543, 10474, 10356,
            10268, 10190, 10023, 9978, 9928, 9775, 9705, 9437, 9213, 9173, 8817, 8721, 8627,
            8575, 8470, 8410]

BOILER = re.compile(r'^(Polecamy|Aktualności|Kronika TOPR|Akademia Górska|Przekaż 1)', re.I)


def clean_lines(text):
    text = re.sub(r'\[/?vc_[^\]]*\]', '\n', text)
    text = text.replace('\xa0', ' ')
    out = []
    for ln in text.split('\n'):
        ln = re.sub(r'[ \t\r]+', ' ', ln).strip()
        if ln:
            out.append(ln)
    return out


def body_of(soup):
    for sel in ['[itemprop=articleBody]', 'article.item-page', 'div.item-page', 'div.entry-content',
                'div.elementor-widget-theme-post-content', 'article', '.component-content', '#rt-mainbody']:
        el = soup.select_one(sel)
        if el and len(el.get_text(strip=True)) > 300:
            return el
    return soup.body or soup


def paras_from_html(h):
    soup = BeautifulSoup(h, 'html.parser')
    for t in soup(['script', 'style', 'noscript']):
        t.decompose()
    title = soup.title.get_text(strip=True) if soup.title else ''
    el = body_of(soup)
    # make block elements line breaks
    for br in el.find_all('br'):
        br.replace_with('\n')
    for b in el.find_all(['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4', 'tr']):
        b.insert_after('\n')
    lines = clean_lines(el.get_text(''))
    return title, lines


ABBR = r'(?:Dol|Przeł|Przel|Wlk|Wielk|Wyż|Wyz|Pd|Pn|Zach|Wsch|Płd|Płn|godz|ok|św|ul|tzw|m\.in|np|im|nr|ks|gen|dr|W|Ł|M|S|H|Hz|D|Ż|ż|r|ok|tj|ww|tys|min|Zm|Gł|Gł|ul|Mał|Mn|Kam|Szp|Sch|schr|ew|wg|al|Pol|Czerw|Kasp|Grz|Ch|Kw|Kot|Sp|Stw)'


def split_units(para):
    # split a paragraph into sentence-like units; over-splitting is fine (incidents can span units)
    # protect abbreviations and dates/times
    p = para
    p = re.sub(r'\b(' + ABBR[3:-1] + r')\. ', lambda m: m.group(1) + '.\u0001', p)
    p = re.sub(r'(\d)\. (?=\d)', '\\1.\u0001', p)
    parts = re.split(r'(?<=[.!?])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ0-9„"(])', p)
    return [x.replace('\u0001', ' ').strip() for x in parts if x.strip()]


def main():
    arts = []
    # Wayback kronika
    lst = {}
    for ln in open(os.path.join(RAW, 'kronika_list.txt')):
        k, u = ln.split()
        dd, mm, yy = k.split('-')
        lst[f'{yy}-{mm}-{dd}'] = u
    for f in sorted(glob.glob(os.path.join(RAW, 'wayback', '20*.html'))):
        key = os.path.basename(f)[:-5]
        h = open(f, 'rb').read().decode('utf-8', errors='replace')
        title, lines = paras_from_html(h)
        # drop trailing boilerplate after the article
        cut = len(lines)
        for i, l in enumerate(lines):
            if i > 3 and BOILER.match(l):
                cut = i
                break
        lines = lines[:cut]
        arts.append({'key': 'K' + key, 'source': 'wayback (stara strona topr.pl, Kronika TOPR)',
                     'url': lst.get(key, ''), 'published': key, 'title': title, 'paras': lines})
    # live posts
    posts = []
    for f in ['posts_full_p1.json', 'posts_full_p2.json']:
        posts += json.load(open(os.path.join(RAW, 'live', f)))
    byid = {p['id']: p for p in posts}
    for pid in LIVE_IDS:
        p = byid[pid]
        soup = BeautifulSoup('<div class="entry-content">' + p['content']['rendered'] + '</div>', 'html.parser')
        el = soup.div
        for br in el.find_all('br'):
            br.replace_with('\n')
        for b in el.find_all(['p', 'div', 'li', 'h1', 'h2', 'h3', 'h4']):
            b.insert_after('\n')
        lines = clean_lines(el.get_text(''))
        lines = [l for l in lines if not re.fullmatch(r'\[.*\]', l)]
        arts.append({'key': f'L{pid}', 'source': 'topr.pl', 'url': p['link'], 'published': p['date'][:10],
                     'title': html.unescape(p['title']['rendered']), 'paras': lines})
    # units
    for a in arts:
        units = []
        for pi, para in enumerate(a['paras']):
            for s in split_units(para):
                units.append({'id': len(units), 'p': pi, 't': s})
        a['units'] = units
    json.dump(arts, open(os.path.join(D, 'articles.json'), 'w'), ensure_ascii=False, indent=0)
    print(len(arts), 'articles', sum(len(a['units']) for a in arts), 'units')


main()
