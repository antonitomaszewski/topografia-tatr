"""Turn raw OSM downloads into the compact map layers in data/derived/osm.js."""
import collections
import json
import math

from common import DERIVED, RAW

F = json.load(open(RAW / "osm" / "features.json"))["elements"]
T = json.load(open(RAW / "osm" / "hiking.json"))["elements"]
B = json.load(open(RAW / "osm" / "border.json"))["elements"]
def rdp(pts,eps):
    if len(pts)<3: return pts
    a,b=pts[0],pts[-1]; dx,dy=b[0]-a[0],b[1]-a[1]; L=math.hypot(dx,dy)
    dm,im=0,0
    for i in range(1,len(pts)-1):
        p=pts[i]; d=abs(dy*p[0]-dx*p[1]+b[0]*a[1]-b[1]*a[0])/L if L>1e-12 else math.hypot(p[0]-a[0],p[1]-a[1])
        if d>dm: dm,im=d,i
    if dm>eps: return rdp(pts[:im+1],eps)[:-1]+rdp(pts[im:],eps)
    return [a,b]
def geom(e,eps):
    g=[[p["lat"],p["lon"]*0.654] for p in e.get("geometry",[]) if p]  # scale lon for isotropic simplification
    g=rdp(g,eps)
    return [[round(p[0],5),round(p[1]/0.654,5)] for p in g]
def nm(t):
    pl=t.get("name:pl"); n=t.get("name","")
    if pl and pl!=n: return pl, n
    return n, ""
def ele(t):
    try: return round(float(t.get("ele","").replace(",",".").split()[0]))
    except: return None
def center(e):
    if "lat" in e: return [round(e["lat"],5),round(e["lon"],5)]
    if "center" in e: return [round(e["center"]["lat"],5),round(e["center"]["lon"],5)]
    g=e.get("geometry") or []
    if not g and "bounds" in e: b=e["bounds"]; return [round((b["minlat"]+b["maxlat"])/2,5),round((b["minlon"]+b["maxlon"])/2,5)]
    g=[p for p in g if p]
    return [round(sum(p["lat"] for p in g)/len(g),5),round(sum(p["lon"] for p in g)/len(g),5)]
out=collections.defaultdict(list)
for e in F:
    t=e.get("tags",{}); n,alt=nm(t)
    nat=t.get("natural")
    if nat=="peak" and n: out["peak"].append([n,alt,*center(e),ele(t)])
    elif (nat=="saddle" or t.get("mountain_pass")=="yes") and n and e["type"]=="node": out["saddle"].append([n,alt,*center(e),ele(t)])
    elif nat in("valley","couloir","gully") and e["type"]=="way":
        low=n.lower(); kind="z" if ("żleb" in low or "žľab" in low or "žlab" in low or "žleb" in low or "kuluar" in low or "kuloár" in low or "rynna" in low) else ("k" if ("kocio" in low or "kotl" in low or "kotol" in low) else "d")
        out["valley"].append([n,alt,kind,geom(e,0.00025)])
    elif nat=="valley": out["valleypt"].append([n,alt,*center(e)])
    elif nat in("ridge","arete") and e["type"]=="way": out["ridge"].append([n,alt,geom(e,0.0002)])
    elif nat=="cliff" and e["type"]=="way": out["cliff"].append([n,alt,geom(e,0.0002)])
    elif nat=="water":
        if e["type"]=="way": out["lake"].append([n,alt,ele(t),geom(e,0.00004)])
        else:
            for m in e.get("members",[]):
                if m.get("role")=="outer" and m.get("geometry"): out["lake"].append([n,alt,ele(t),geom(m,0.00004)])
    elif t.get("waterway") in("river","stream"): out["stream"].append([n,alt,1 if t["waterway"]=="river" else 0,geom(e,0.00015)])
    elif nat=="waterfall": out["waterfall"].append([n,alt,*center(e)])
    elif nat=="cave_entrance": out["cave"].append([n,alt,*center(e),ele(t)])
    elif nat=="spring": pass
    elif t.get("tourism") in("alpine_hut","wilderness_hut"): out["hut"].append([n,alt,*center(e),ele(t),t["tourism"]=="alpine_hut"])
    elif t.get("emergency")=="mountain_rescue" or t.get("amenity")=="mountain_rescue": out["rescue"].append([n,alt,*center(e)])
    elif t.get("place") in("town","village"): out["town"].append([n,alt,*center(e),t["place"]=="town"])
    elif t.get("place") in("hamlet","locality","isolated_dwelling"): out["locality"].append([n,alt,*center(e)])
    elif "aerialway" in t and t["aerialway"] in("cable_car","gondola","chair_lift","mixed_lift"): out["aerial"].append([n,t["aerialway"],geom(e,0.0001)])
# merge valley multiple ways same name? keep.
# trails
ways={}
for r in T:
    t=r["tags"]; col=t.get("colour") or t.get("osmc:symbol","").split(":")[0]
    if col not in("red","blue","green","yellow","black"): continue
    for m in r.get("members",[]):
        if m["type"]!="way" or not m.get("geometry"): continue
        w=ways.setdefault(m["ref"],{"c":[],"g":m})
        if col not in w["c"]: w["c"].append(col)
# colors code: r,b(blue),g,y,k(black)
code={"red":"r","blue":"b","green":"g","yellow":"y","black":"k"}
out["trail"]=[["".join(code[c] for c in w["c"]),geom(w["g"],0.00004)] for w in ways.values()]
out["border"]=[geom(w,0.00005) for w in B]
for k,v in out.items(): print(k,len(v))
s=json.dumps(out,ensure_ascii=False,separators=(",",":"))
open(DERIVED / "osm.js", "w").write("window.OSM="+s+";")
print(len(s)/1e6,"MB")
